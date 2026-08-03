# 対局中ランタイム・ホットパス最適化 設計書

## 文書情報

- 状態: 実装・検証完了
- 作成日: 2026-08-04
- 対象: 通常のPixi盤面、盤面入力、カメラ、オンラインsnapshot intake / presentation delivery
- プレイヤー向け仕様: 変更しない
- 関連契約: `01-rulebook.md`、`正本/演出正本.md`、`正本/ターン進行正本.md`、`正本/共通ルール正本.md`、`docs/architecture-contracts.md`
- 既存の前提設計: `docs/implementation/pixijs-board-source-trajectory-design.md`、`docs/implementation/network-presentation-continuity-repair-design.md`
- 実装計画: `docs/implementation/in-game-runtime-hot-path-optimization-plan.md`
- 実測結果: `docs/perf/2026-08-04-in-game-runtime-hot-path-optimization.md`、`docs/perf/2026-08-04-in-game-runtime-browser-performance.md`

## 1. 結論

調査対象の6項目はいずれも、ロード時間ではなく対局中のmain thread負荷として実在する。主因は、確定済みの静的情報を60Hzの更新、pointer event、camera event、snapshot intakeのたびに再構築していることである。

今回の基本方針は、表示品質を落として負荷を隠すことではない。確定情報を境界で一度だけ準備し、毎フレームの仕事を既存オブジェクトの数値更新へ縮退させる。ゲーム結果、演出の見た目、時間、順序、効果音、入力可能になる時点、ネット対戦のvisual settlementは維持する。

| 対象 | 現在の重い仕事 | 採用する構造 |
| --- | --- | --- |
| 特殊カード軌道演出 | clip、線・円・polygon descriptor生成、Graphics再描画 | 軌道ごとのprepared render plan + 静的primitive + scalar-only tick |
| 演出中のscope確認 | 全盤面・pool・display treeを含むfull diagnostics | O(1) operational queryとfull diagnosticsの分離 |
| 石・エフェクト更新 | transformだけのtickでも静的paintを再構築 | static paint revisionとdynamic transformの分離 |
| frame revision | topology/cellをvisual用とinteraction用に二重sort/serialize | 1回のsort/passで2 fingerprintを生成しWeakMap cache |
| 入力・カメラ | raw pointermoveごとの候補全走査、eventごとの全scene描画 | hit-test projection、pointermove/camera eventのrAF coalescing |
| online snapshot | board検査、clone、freeze、presentation payloadの重複 | accepted snapshotのsingle preparation、最小previous projection、versioned envelope compaction |

## 2. 調査根拠

### 2.1 特殊カード軌道演出

`ui/pixi/effects/source-trajectory.ts` では、`buildLightningGeometry()` が開始時に一度だけjagged pathを作る一方、各tickの `lightningVisual()` が同じpathを再clipし、main 4層・branch 3層のline descriptorへ展開する。`beamVisual()` と `biteVisual()` も、各tickで線、円、放射線、polygonを再生成する。

`ui/pixi/board-scene.ts` の `drawSourceTrajectoryVisual()` は受け取ったdescriptorに対してGraphicsをclearし、線・円・polygonを毎回描き直す。alpha、scale、reveal量しか変わらないtickにも同じ経路が入る。

現在の上限構成を、main 11 segment、branch 14 segment、main 4層、branch 3層、8対象、60Hzとして静的に概算すると、line descriptorだけで次の規模になる。

```text
(11 × 4 + 14 × 3) × 8 × 60 = 41,280 descriptors/秒
```

beamのlayer、circle、impact rayなどを含めれば「約44,000個/秒」は妥当な上限概算である。ただし、これは実機allocation profileの実測値ではない。実装前baselineで実測counterとallocation samplingを採取する。

### 2.2 scope確認にfull diagnosticsを使用

`ui/pixi/board-playback.ts` と `ui/pixi/effects/source-trajectory.ts` は、scopeがまだ有効かを確認するだけの箇所で `scene.getDiagnostics().playbackScopeKey` を参照する。

一方、`ui/pixi/board-scene.ts` の `getDiagnostics()` は、pool diagnostics取得、active cell/stone走査、display tree再帰count、ghost/effect/trajectoryの配列化、world keyやtopology revealのsort、結果objectのfreezeまで行う。`ui/pixi/board-backend.ts` もactive run count確認のためにplayback全体のdiagnosticsを構築する。

診断は必要だが、normal-playの制御分岐に使うAPIとしては責務と計算量が過大である。

### 2.3 静的paintの再構築

`ui/pixi/board-scene.ts` のplayback ghost更新は、位置・scale・rotation・alphaの変更でもstone viewの `update()` を呼ぶ。`ui/pixi/stone-view.ts` の更新署名にはscene座標が含まれ、署名が変わると複数GraphicsとTextを再構築する。

playback effectも `updatePlaybackEffect()` から `drawPlaybackEffect()` へ入り、Graphicsのclear/drawとText style設定を行った後にtransformを適用する。静的形状と動的transformが同じ更新APIに混在している。

### 2.4 frame revisionの二重走査

`ui/board-visual/frame-presenter.ts` は `modelFingerprint()` と `modelInteractionFingerprint()` で、それぞれcell配列をmap/sortし、topology配列を再sortして安定serializeする。

`ui/board-visual/model.ts` はmodel生成時にtopology key配列を既に正規化・sortし、各cellに `visualSignature` と `hintInputSignature` を持たせている。cell入力順は契約上sort済みとは限らないためsort自体は必要だが、同じmodelで2回行う必要はない。

### 2.5 入力・カメラ

`ui/pixi/board-input.ts` はraw `globalpointermove` ごとにfrozen snapshotを作り、hit test、active pressへのmove dispatch、hover更新を同期実行する。

`ui/board-input-controller.ts` の `hitTestClientPoint()` は毎回全cellからinteractive候補配列を作り、anchor、row reference、column referenceを検索する。逆算後のkey lookupはO(1)だが、その前段がO(N)である。inverse projectionが成立しない場合は候補を再走査する。

`ui/pixi/camera.ts` はscroll、ResizeObserver、visualViewport resize/scrollを個別に同期処理し、同一layoutでも `onLayoutChange` を通知する。`ui/pixi/board-backend.ts` は通知ごとにapplication resize、scene apply、renderer renderを行う。

### 2.6 online snapshotとpresentation payload

`ui/network/snapshot.ts` は受信snapshotをauthority検査した後、`ui/network/snapshot-canonical.ts` のsanitizeでもboard contractを再検査する。accepted snapshotではraw側とclone側で同じboardを深く検査する構造になっている。

適用時にはprevious `gameState` / `cardState` 全体をcloneし、global置換用にnext stateを再cloneし、さらに `authoritativeMatchState` へ同じ全stateをcloneする。調査時点で `authoritativeMatchState.gameState` のruntime参照はなく、`cardState` から利用されるのはpublish用の `turnIndex` だけである。

`workers/match-worker.ts` と `scripts/local-match-server.ts` のaccepted publish / snapshot payloadは、envelopeの `snapshot` と `playbackEvents` に加え、`presentationFrames[]` 内にも同じplaybackと `snapshotAfter` を含む。journalのself-contained frameは再接続契約上必要だが、同じlive envelope内の重複は不要である。既存のlate special-card fixtureでは約90,760 byte中、top-level playback重複が約35,606 byte、envelope snapshotとframe snapshotの重複が約9,366 byteだった。これは代表fixtureの測定値であり、全payload共通の比率ではない。

## 3. 絶対に維持する契約

### 3.1 プレイヤー体験

- 軌道の色、線幅、glow層、円、牙、影、sprite、alpha、scale、rotation、easing、durationを変えない。
- 攻撃元と対象の論理座標、画面外区間のclip、対象まで到達してから結果を見せる順序を変えない。
- `events[]`、phase、action、target gate、着弾、ハイライト、破壊・反転・生成、効果音の意味順を変えない。
- animation中の入力lock、終了時のvisual settlement、手番交代、リザルト表示の時点を変えない。
- pointerdown/up/cancel、longpress、hover、touchとmouseの操作結果を変えない。
- 解像度、particle数、対象数、FPS上限、演出時間を品質tierとして下げない。

このため、`01-rulebook.md` と `正本/` は今回の内部最適化では変更しない。実装中に現状と正本の差を発見した場合は最適化へ混ぜず、仕様判断を先に行う。

### 3.2 描画アーキテクチャ

- `ui/board-visual/controller.ts` がSingle Visual Writerを所有する。
- active Pixi laneは1 application、1 canvas、1 WebGL context、1 animation clockを維持する。
- source-to-targetが盤面座標の軌道は既存のboard-owned effect layer、timeline、pool、leaseを使う。
- DOM互換盤面をactive Pixi effectの部分fallbackにしない。
- static cache、paint revision、hit-test projection、prepared render planはpresentation cacheであり、canonical gameplay authorityにしない。
- context loss、abort、scope release、strict settlementの失敗を成功として扱わない。

### 3.3 ネットワーク

- server snapshotだけがauthorityであり、client previewやvisual storeをauthorityにしない。
- `operationId` idempotency、seat/spectator projection、session epoch、stateVersion、projected snapshot hashを維持する。
- canonical snapshot laneとvisual timeline laneを統合しない。
- pending selectionのaction identity、stage、対象、UI/network signal bridgeを変更せず、snapshot最適化後も同じselectionだけを継続する。
- presentation frameのjournal保存形はself-containedのまま維持する。
- reconnect、SSE replay、journal gap recoveryではordered frameを飛ばさず、visual settlement完了前に入力を再開しない。
- Workerとlocal serverは同じshared contract/helperを使い、別実装にしない。

## 4. 非対象

- CPU探索、selfplay、学習処理
- 起動時bundle分割、画像・音声の先読み、初回ロード時間
- カードルール、対象決定、乱数、盤面結果の変更
- Pixiから別renderer/engineへの置換
- DOM手札、HUD、modal、chatの全面的な再設計
- `visual-state-store` のcopy-on-commit / deep-freeze契約を全面的にzero-copy化すること
- presentation journalを参照形式へ変えて自己完結性を失わせること

## 5. 全体構造

対局中ホットパスを、次の3層へ分ける。

1. canonical / event境界: gameplay結果、ordered event、server snapshotを検証する。
2. prepare境界: 変更が確定した時だけ、描画形状、fingerprint、hit-test projection、snapshot cloneを準備する。
3. tick / event境界: 既存objectの数値更新、O(1) query、最新pointer/camera sampleの処理だけを行う。

prepareの無効化条件は明示的なrevisionまたはlifecycle eventに限定し、「安全のため毎回再構築」は採用しない。ただしcacheが欠損・不整合・context recovery中の場合はfail closedで正規prepareへ戻す。

## 6. 詳細設計

### 6.1 Prepared Source Trajectory Render Plan

#### 6.1.1 所有境界

- `ui/pixi/effects/source-trajectory.ts`: request、profile、geometry、timingからplanを一度compileし、timeline progressをscalar updateへ変換する。
- 新規 `ui/pixi/effects/source-trajectory-render-plan.ts`: easing parser、profile別static geometry、clip済みprimitive、dynamic scalar samplerを純粋に生成する。
- `ui/pixi/board-scene.ts`: planからpool viewを準備し、static Graphicsを描く。tickではpreallocated dynamic stateを読み、transform、alpha、mask boundsだけを更新する。
- `ui/pixi/timeline.ts`: duration、deadline、cancel、settlementのauthorityを維持する。trajectory側の最適化のために別tickerを追加しない。

概念上のcontractは次のdiscriminated unionとする。実装名はこの責務に合わせる。

```ts
type PreparedSourceTrajectoryRenderPlan =
  | PreparedProjectilePlan
  | PreparedSuctionPlan
  | PreparedBeamPlan
  | PreparedLightningPlan
  | PreparedBitePlan;

interface PreparedPlanBase {
  readonly profile: BoardSourceTrajectoryProfile;
  readonly geometryRevision: string;
  readonly durationMs: number;
  sampleInto(progress: number, target: MutableTrajectoryScalarState): void;
}
```

`sampleInto()` は配列、line/circle/polygon descriptor、frozen frame objectを返さない。viewが所有する固定shapeのalpha、scale、position、rotation、reveal mask値をpreallocated bufferへ書く。

#### 6.1.2 profile別の静的・動的分離

| profile | prepare時に一度行うこと | tickで行うこと |
| --- | --- | --- |
| projectile | texture、始終点、clip、基準rotationを確定 | sprite position/rotation/scale/alpha |
| suction | texture、始終点、clipを確定 | sprite position/scale/alpha |
| beam/fire/water/grass | full layered beam、muzzle ring、impact rayをlocal座標で描画 | reveal mask、layer alpha、ring/ray scaleとalpha |
| lightning | jagged main/branch path生成、clip、main 4層・branch 3層を各Graphicsへ描画 | main/branch alphaとroot visibility |
| bite | shadow path、2つのfang shapeを描画 | shadow reveal、fang position/scale/alpha |

beam revealは線を短く描き直すのではなく、現在と同じ始終点・clip結果を持つfull beamに対するmaskで表現する。biteの影も同様にreveal maskを使う。maskで現在の輪郭と一致しないprofileは、static geometryをsegment containerへ分けて既存keyframe境界でvisible/alphaを切り替える。pixel差が残る場合はそのprofileだけ実装をlandingしない。

#### 6.1.3 easing、clip、layout invalidation

- cubic-bezier文字列はplan compile時に一度parseし、sample関数を保持する。
- `clipSegment()`、`clipPath()`、`clipPolygonToRect()`、impact ray生成はcompile時に行う。
- board topology、cellSize、orientation、scene offset、effect clip rect、appearance/theme revision、texture generation、render sessionが変わった場合はplan/viewを一度再prepareする。
- cameraのclient originだけが変わる `client-only` changeではscene座標とclipを再prepareしない。
- render-space changeまたはcontext restoreでは、現在progressを保ったまま新plan/viewへ再prepareし、同じtimeline時刻から再開する。音、ログ、game eventを再発火しない。
- outer board/effect maskとoffscreen target gateは既存のまま残す。

#### 6.1.4 描画更新

`drawSourceTrajectoryVisual()` の「clearして全descriptorを再描画する」APIを、次に分割する。

- `prepareSourceTrajectoryView(plan, invalidation)`: acquireまたはrevision変更時だけGraphicsを描く。
- `applySourceTrajectoryScalars(state)`: tickごとにContainer/Graphics/Sprite/Maskの数値だけを更新する。
- `releaseSourceTrajectoryView(scope)`: 既存pool/leaseへ返す。

profileごとのContainer/Graphics数はplanで固定し、tick中にchildを追加・削除・sortしない。

### 6.2 Operational Query API

full diagnosticsをnormal-playの制御APIから切り離す。

`PixiBoardScene` に次のO(1) queryを追加する。

```ts
isPlaybackScopeActive(scopeKey: string): boolean;
```

scope keyはsceneが既に保持しているactive scopeと直接比較する。呼び出し側はdiagnostics shapeを知らない。

timeline/playbackには次を追加する。

```ts
hasActiveRuns(): boolean;
getActiveRunCount(): number;
```

`ui/pixi/board-playback.ts`、source trajectory release、`ui/pixi/board-backend.ts` のnormal pathはこのAPIだけを使う。`getDiagnostics()` はdebug UI、test、明示performance capture用に残し、normal control flowから到達させない。

diagnostics結果のmemoizeは採用しない。診断時に最新の完全情報を返す責務と、制御時に安価な情報を返す責務を別APIにする。

### 6.3 Static Paint RevisionとDynamic Transform

#### 6.3.1 playback effect

`PlaybackEffectRecord` にstatic paint keyを保持する。keyは少なくとも次を含む。

- effect kind / tone / label / inner edge構成
- cellSize、theme revision、appearance revision
- texture/renderer generation、context generation

`preparePlaybackEffectPaint()` はacquire、key変更、context restore時だけGraphics clear/drawとText style設定を行う。`applyPlaybackEffectTransform()` は毎tick、position、scale、rotation、alpha、visibleだけを更新する。

#### 6.3.2 ghost / stone view

`ui/pixi/stone-view.ts` の現在の単一 `update()` を、互換wrapperを保ったまま内部で次に分割する。

- `prepareStaticVisual(cell, context)`: stone/marker種別、owner、badge、label、cellSize、theme、appearance、texture generationが変わった時だけpaintする。
- `applyTransform(transform)`: sceneX/Y、scale、rotation、alpha、visibleだけを更新する。

static signatureからsceneX/Yとanimation transformを除外する。通常盤面更新の既存 `update()` は両処理を順に呼ぶためpublic behaviorを変えない。playback ghostはstatic keyが同じtickでは `applyTransform()` だけを呼ぶ。

marker ghostも同じ境界を使い、stoneとmarkerで別のcache authorityを作らない。

#### 6.3.3 invalidation

次ではstatic paintを必ず無効化する。

- acquire後の初回表示
- cell visual/stone/marker signature変更
- cellSize、orientationのpaint依存値、theme、appearance、texture generation変更
- context restore、renderer recreation、pool世代変更
- plan/viewのownership変更

alpha、position、scale、rotation、camera client originだけでは無効化しない。

### 6.4 Board Model Fingerprintの1-pass化

`ui/board-visual/frame-presenter.ts` 内部に、modelごとのexact fingerprint pairを返す関数を置く。

```ts
type ModelFingerprintPair = Readonly<{
  visual: string;
  interaction: string;
}>;

const fingerprintCache = new WeakMap<BoardRenderModel, ModelFingerprintPair>();
```

初回計算は次の順序にする。

1. `model.topology` の既にcanonicalなkey配列をそのまま1回serializeする。
2. `model.cells` をkeyで1回だけsortする。
3. 1 loopでvisual descriptorとinteraction descriptorを同時に組み立てる。
4. exact stable stringを2本生成してWeakMapへ保存する。
5. 同じfrozen model objectの再composeではcacheを返す。

cell入力順は公開契約上固定しないため、sortの全廃はしない。hash衝突によるrender skipを避けるため、非暗号hashへ置換せず現在と同じexact string比較を維持する。`frameToken` は引き続きfingerprintから除外する。

`compose()` が作るrevision付き `nextModel` についてもcache可能だが、元modelとfingerprint内容が同じであることを明示してpairを関連付け、再serializeはしない。

### 6.5 Input Hot Path

#### 6.5.1 hit-test projection

`BoardInputController.syncModel()` で、model/input/layout revisionに対応するprojectionを構築する。

```ts
interface BoardHitTestProjection {
  readonly modelCommitId: number;
  readonly boardDigest: string;
  readonly anchorKey: string | null;
  readonly rowReferenceKey: string | null;
  readonly columnReferenceKey: string | null;
  readonly interactiveKeys: ReadonlySet<string>;
  readonly fallbackKeys: readonly string[];
}
```

layout実測値はcamera側の `layoutRevision` ごとにlazy cacheする。最初のhitでanchor、row reference、column referenceのrectからaffine grid stepを作り、以後は次だけを行う。

1. client座標をrow/colへ逆算する。
2. `currentCellByKey` と `interactiveKeys` で穴・盤外・非interactiveを除外する。
3. candidateのrectを1件取得し、境界内かを確認する。

projectionが成立しない不規則layoutだけ `fallbackKeys` を走査する。そのfallback結果も同じlayout revision中はgeometry cacheを使う。model、layout revision、input lockの意味が変わればcacheを破棄する。

円形盤、穴、拡張盤の負座標、盤面回転、viewer orientationはkey lookupと最終rect確認で正しさを担保する。

#### 6.5.2 pointermove coalescing

coalesce対象はmoveだけとする。

- pointermoveごとに最新snapshotをpointerId別slotへ上書きし、1本のrAFを予約する。
- 1 frame内では各active pointerの最新sampleだけをhit testし、press moveとhover enter/leaveを更新する。
- pointerdown、pointerup、pointerupoutside、pointercancelは同期処理を維持する。
- up/cancel/leave/destroyの直前に同pointerのpending moveを同期flushまたはcancelし、移動によるlongpress取消とrelease判定を失わない。
- layout retry用の既存 `pendingRetry` はmove coalescing slotと混ぜない。
- duplicate native/federated eventの既存ownershipとpreventDefault契約を維持する。

### 6.6 Camera Event CoalescingとChange分類

`camera.sync()` と明示 `camera.refresh()` はcanonical frame適用、復旧、外部の同期要求に使うため同期のまま残す。scroll、ResizeObserver、visualViewportのevent listenerだけを1本のrAFへcoalesceする。

`applySync()` はlayoutとcanvas viewportを確定した後、前回との比較結果を次の3種で通知する。

```ts
type PixiBoardCameraChangeKind = 'none' | 'client-only' | 'render-space';

interface PixiBoardCameraChange {
  readonly kind: PixiBoardCameraChangeKind;
  readonly layout: BoardViewportLayout;
  readonly canvasViewport: PixiBoardCanvasViewport;
}
```

- `none`: 完全に同一。DOM style write、callback、renderer renderを行わない。
- `client-only`: client originまたはvisual viewport mappingだけが変わり、scene座標、cellSize、DPR、scroll、viewport/canvas寸法、orientation、frame insetは同一。cameraの公開geometryとbackendのcurrent frame layoutだけを更新し、scene apply / GPU renderを行わない。
- `render-space`: 上記以外。従来どおりapplication resize、scene apply、renderを1回行う。

surface/canvas styleは値が変わる場合だけ書く。分類に確信できないfieldは `render-space` とし、描画省略より見た目の正しさを優先する。

camera callback中のerrorは既存どおりactive visual transactionをabortする。coalescingやno-change fast pathを成功形のsilent fallbackにしない。

### 6.7 Accepted SnapshotのSingle Preparation

#### 6.7.1 authority envelopeとdeep board validationの分離

`ui/network/snapshot-canonical.ts` に2段階のAPIを置く。

1. `inspectAuthoritativeSnapshotEnvelope()`: authority、viewer projection、own-hand visibility、version metadataだけを検査する。stale判定前にdeep board scanを行わない。
2. `prepareIncomingAuthoritativeSnapshot()`: accepted candidateを一度cloneし、clone上でboard contractを一度だけ検査し、transient presentation state除去とcharge正規化を行い、prepared resultを返す。

```ts
interface PreparedIncomingSnapshot {
  readonly snapshot: Readonly<AuthoritativeSnapshot>;
  readonly meta: SnapshotMeta;
  readonly version: number | null;
  readonly transientStateStripped: TransientStripSummary | null;
}
```

順序は、cheap envelope検査、version/stale gate、clone、cloneのdeep validation、sanitize、applyとする。検査対象と適用対象を同じcloneにすることでTOCTOUを避ける。clone/validation失敗はrejectし、raw objectへfallbackして適用しない。

#### 6.7.2 previous stateの最小projection

accepted snapshot適用前に必要なのは次である。

- previous board geometry descriptor
- black/white charge値
- transient presentation queue
- busy/playback state
- strict frame用base visual snapshotが未設定の場合のbase snapshot

通常の継続frameではprevious `gameState` / `cardState` 全体をcloneしない。base visual snapshotが必要な初回・recovery境界だけ、visual-state-storeの既存ownership APIへ1回のsnapshot copyを渡す。

global `gameState` / `cardState` へのcopyと、visual-state-storeのcopy-on-commit/deep-freezeは責務が異なるため、初期段階では維持する。mutable globalとreadonly render snapshotを同一objectにしない。

#### 6.7.3 authoritative mirrorの縮小

`state.authoritativeMatchState.gameState` と `.cardState` のfull cloneを廃止し、publish freshnessに必要な `authoritativeTurnIndex` scalarを保持する。既存の次は維持する。

- stateVersion
- authority
- projectedForSeat
- turnStartReconciled
- projectedSnapshotHash
- lastAppliedProjectedSnapshotHash

`getCurrentPublishTurnIndex()` は `authoritativeTurnIndex` とlive turn indexの最大値を使う。reset、leave、session epoch変更ではscalarとmetadataを同時にclearする。

### 6.8 Versioned Presentation Envelope Compaction

この変更だけはrolling deployment中の旧client互換性があるため、前項のclient CPU最適化と別phaseにする。

#### 6.8.1 negotiation

共有定数 `PRESENTATION_ENVELOPE_VERSION = 2` とpure helperを、新規 `shared/network-presentation-envelope.ts` に置く。

- publish request bodyへclientが `presentationEnvelopeVersion: 2` を付ける。そのresponseだけV2を許可する。
- EventSource URLへ `presentationEnvelopeVersion=2` を付ける。serverはstream infoへversionを保存し、そのconnectionへ送るpayloadだけV2へcompactする。
- capability欠損、1、未知値はlegacy full envelopeを返す。serverが勝手にV2を返さない。
- serverはV2 payloadのtop levelへ `presentationEnvelopeVersion: 2` を付ける。
- presentation journal endpointとroomに保存するjournal entryは常にself-contained legacy/full shapeを維持する。

`presentationEnvelopeVersion` はtransport metadataであり、canonical action、baseVersion、turnIndex、pending selection identity、operationIdのidempotency key/digestへ含めない。operation cacheとSSE bufferはfull canonical resultを保持し、capability別のwire変換はcache hit後・delivery直前に行う。同じoperationIdをlegacy/V2のどちらで再取得してもgame resultとpresentation digestは同一で、wire representationだけが異なる。stream queryもviewer認証、session epoch、resume event IDのidentityへ含めない。

SSE bufferもfull viewer payloadを保持する。live送信・buffer replayの直前にstream capabilityに応じてcompactすることで、同じbufferがlegacy clientとV2 clientの両方を回復できる。

compactorはfull payloadをdeep cloneしない。envelopeと参照化するframeだけをshallow copyし、省略対象のsnapshot/playbackをcopyしない。元のfull payload、journal、bufferはmutationしない。accepted publishで既に作るblack/white/spectator別artifactをpublish response、SSE full buffer、V2 deliveryの共通入力として再利用し、同じviewer snapshotを経路ごとに再projectしない。

#### 6.8.2 V2 wire shape

V2でvalid `presentationFrames` が1件以上ある場合、top-level `playbackEvents` を省略する。client intakeは既にframeを優先するが、V2 resolverでもこの規則を検査する。

frameの `snapshotAfter` が同じenvelopeの `snapshot` と一致する場合だけ、次の参照へ置換する。

```ts
interface EnvelopeSnapshotRefV2 {
  readonly kind: 'envelope-snapshot';
  readonly stateVersion: number;
  readonly projectedSnapshotHash: string;
}
```

一致条件はすべて必須とする。

- frame `stateVersionTo`、reference `stateVersion`、envelope snapshot versionが一致する。
- frame、reference、envelope snapshotの `projectedSnapshotHash` が非空かつ一致する。
- roomIdが一致する。
- seat projectionまたはspectator projectionが一致する。
- frame `snapshotAfter` がserver側で存在し、同じviewer用artifactから生成されている。

一致しないframeはfull `snapshotAfter` を残す。複数frameを同じenvelopeへ含む場合、通常は最新の一致frameだけが参照になり、過去frameはfull snapshotを持つ。

#### 6.8.3 client resolution

`ui/network/intake-envelope.ts` はV2を受け取った場合、canonical frame normalizeより前にreferenceを解決する。

- top-level versionが2でないpayloadのreferenceはrejectする。
- 上記version/hash/room/projection条件をclient側でも再検査する。
- validならframeの `snapshotAfter` としてenvelope snapshot objectを設定する。
- malformed、unknown kind、hash mismatch、projection mismatchはpayload全体を通常適用せず、既存state-sync/journal recoveryを要求する。
- 不一致時に「最新snapshotらしいもの」を推測して採用しない。

解決後は既存の `shared/network-presentation-frame.ts`、intake coordinator、visual timeline、visual-state-storeへ従来のself-contained frame shapeを渡す。下流へV2分岐を広げない。

#### 6.8.4 Worker/local parity

compact/resolve条件はshared pure helperを正本にする。Workerとlocal serverは、request/stream capabilityの読取とdelivery直前の呼出しだけをruntime固有処理として持つ。

idempotent publish replayでも、そのrequestが宣言したresponse versionに従う。room canonical stateやoperation cacheの同一性はwire shapeで変えない。

## 7. 計測設計と完了判定

normal-playへ常時telemetryを追加しない。既存 `?debug=1` / performance harnessまたはtest injectionで、次のcounterを取得する。

| 領域 | 構造的な合格条件 |
| --- | --- |
| trajectory | steady tick中のclip関数、line/circle/polygon descriptor array生成、static Graphics.clearが0 |
| diagnostics | normal playback/scope/release/active-run分岐からfull `getDiagnostics()` 呼出しが0 |
| effect/ghost | transform-only tickでstatic repaint、Text style設定、stone prepareが0 |
| frame revision | 新modelのcell sortが1回、cell visitが1回、同一model再composeは0回 |
| input | 1 animation frame内の同pointer move burstに対するhit/hover更新が最大1回。up/cancel前flushは必ず1回以下 |
| camera | event burstあたりrefresh最大1回。`none` と `client-only` のrenderer.renderは0 |
| snapshot | accepted snapshotあたりdeep board inspectionが1回。通常継続適用のfull previous-state cloneとauthoritative full mirror cloneが0 |
| V2 envelope | frameありpayloadのtop-level playback重複が0。exact match frameだけsnapshot reference化 |

実機比較は同一build、同一browser、同一DPR、同一盤面fixtureでbaseline/candidateを交互に測る。

- 8対象lightningのanimation区間で、trajectory更新のallocation countをbaseline比90%以上削減し、同区間のtrajectory JS self time p95をbaseline比70%以上削減する。
- high-polling pointer fixtureで、dispatch結果traceはbaselineと一致し、hit-test回数はraw move数ではなく描画frame数に上限づける。
- resize/scroll burst fixtureで、最終geometryはbaselineと一致し、full render回数をcoalesced render-space change数に一致させる。
- large accepted snapshot fixtureで、canonical result/hash/visualSeqは一致し、snapshot intake JS time p95をbaseline比30%以上削減する。達しない場合も構造条件を満たしたcounterと残存profileを報告し、wire/ownership契約を弱めない。
- representative late special-card fixtureのV2 JSON byte数を記録し、legacyとの比較で少なくとも30%削減する。legacy payloadは互換baselineと同じshapeを保つ。
- アプリ起因Long Task 50ms以上を0、50ms以上のRAF stallを0とし、全体frame p95をbaselineより悪化させない。

数値目標を達成するために演出を短縮・間引きすることは禁止する。未達時はprofileと残存allocationを再調査する。

## 8. 検証戦略

### 8.1 見た目とsettlement

- 全source trajectory profileについて、既存duration内の固定progress点 `0, 0.1, 0.25, 0.5, 0.75, 0.9, 1` で、始終点、clip後bounds、layer色/幅/alpha、sprite transform、target gateをbaseline fixtureと比較する。
- screenshot ROIをdesktop/mobile、通常盤/拡張盤、黒白orientation、画面外source/targetで比較する。
- animation duration、phase order、sound/log回数、input lock解除、strict settlementを既存testとbrowser playtestで確認する。
- context loss中のactive trajectory、abort、scope replacement、pool reuseで二重再生・orphan view・二重settlementがないことを確認する。

### 8.2 入力とカメラ

- mouse/touch、tap/drag/longpress、pointerupoutside/cancel、同frame move→upをevent traceで比較する。
- 4x4～16x16、円形、穴、負座標拡張、盤面回転、scroll済み盤面でhit resultを全cell中心・境界付近に対して検証する。
- ResizeObserver、scroll、visualViewport resize/scrollのburstとclient-only移動をfake RAFで決定的に検証する。

### 8.3 ネットワーク

- black/white/spectator projection、legacy/V2、publish response/SSE live/SSE replay、idempotent replayを組合せる。
- session epoch変更、leave/rejoin、stale stream、hash mismatch、malformed ref、unknown versionをfail-closedで検証する。
- journal endpointは常にfull frameで、gap recovery後のvisualSeq/stateVersion/settlementがlegacyと一致することを確認する。
- Worker/local server parityとworker mirrorを既存scriptで確認する。

## 9. 代替案と不採用理由

### 演出FPS、線数、particle、解像度を下げる

見た目と時間感覚が変わるため不採用。

### 毎tickの最終descriptor objectをprogressごとにmemoizeする

progressが連続値でcache hitが乏しく、量子化すれば動きが変わり、無制限cacheならメモリが増えるため不採用。静的geometryとscalar stateを分ける。

### effect全体をRenderTextureへ焼く

DPR、skin、clip、context restoreで再生成条件が広く、alpha以外のprofile transformと品質一致が難しいため一括採用しない。既存primitiveを静的描画する。

### full diagnosticsを短時間memoizeする

制御分岐が巨大diagnostics shapeへ依存したままになり、最新性の責務も曖昧になるため不採用。O(1) queryを分離する。

### model revisionを非暗号hashへ変える

collisionで必要な描画をskipする可能性があるため不採用。1-pass化しつつexact stringを維持する。

### 全pointer/camera eventをdebounceする

up/cancel、longpress、recoveryの時点がずれるため不採用。moveとevent-driven refreshだけをrAF coalesceし、terminal event前にflushする。

### snapshot objectを全面的にzero-copy共有する

mutable global、readonly visual snapshot、server authorityのownershipが混ざるため不採用。重複検査と不要cloneだけを除去する。

### negotiationなしで重複fieldを削除する

キャッシュ済み旧clientがframe/referenceを解釈できず、rolling deployment中の対局を壊すため不採用。明示V2 opt-inを必須にする。

### journal snapshotを参照形式にする

再接続とgap recoveryのself-contained contractを壊すため不採用。live envelope内だけをcompactする。

## 10. リスクと封じ込め

| リスク | 封じ込め |
| --- | --- |
| mask方式でbeam/bite輪郭が変わる | profile別固定progressのsemantic/pixel baseline。差があるprofileは旧描画のままlandingを止める |
| layout変更中にprepared clipが古くなる | render-space revisionで一度再prepareし、timeline progressを維持 |
| static signature漏れで古い石・effectが残る | invalidation matrixのtest、context generationをkeyへ含める |
| WeakMap cacheがmutationを見逃す | modelは既存どおりdeep-frozen objectだけを対象にし、identity reuseをtestする |
| pointermove coalescingでlongpress取消を失う | terminal event前の同期flushとevent trace test |
| client-only分類誤りでsceneがずれる | field allowlist方式。未分類はrender-spaceへ倒す |
| cheap authority検査後に不正boardを適用する | clone後のdeep validationを必須化し、prepared object以外をapplyしない |
| V2 snapshot refが別viewerを指す | room/version/hash/projectionの全一致。失敗時はrecovery、推測fallback禁止 |
| legacy/V2でWorker/localがdriftする | shared helper、network parity、同じfixtureでbyte/semantic digest比較 |

## 11. 完了条件

- 6領域すべてで、前節の構造的合格条件をtest counterで証明できる。
- プレイヤー向けの見た目、演出時間、イベント順、音、入力、結果、visual settlementに差分がない。
- normal Pixi laneが1 application/canvas/context/tickerのままである。
- legacy network clientは従来payloadで動作し、V2 clientだけがcompact payloadを受ける。
- presentation journal、SSE replay、reconnect、idempotent publish、black/white/spectator projectionが維持される。
- focused Jest、typecheck、browser/Vite build、Pixi playback/fallback/cross-platform smoke、network parity、visual/browser検証が成功する。
- root source変更後にbrowser artifactsとworker mirrorを既存generatorから更新し、手編集しない。

## 12. Self-review

- 初案では軌道visual stateを毎tick immutable objectとして返す想定だったが、配列を消してもobject allocationが残るため、view所有のpreallocated scalar bufferへ修正した。
- lightningだけを特別扱いするとbeam、bite、ghost/effectの同じ問題が残るため、static paint / dynamic transformという共通境界へ整理した。
- cell配列もmodel生成時にsort済みと仮定しかけたが、現契約では入力順が保証されないため、sortは1回だけ残した。
- camera eventをすべて非同期化するとcanonical applyとrecoveryを遅らせるため、event listenerだけをcoalesceし、明示sync/refreshは同期のまま残した。
- snapshot cloneを一括削除する案はvisual-state-storeのownershipを壊すため撤回し、deep validationの重複、full previous clone、未使用authoritative mirrorへ範囲を限定した。
- live payloadの重複をjournalまで除去する案は再接続契約を壊すため撤回し、保存/bufferはfull、deliveryだけversioned compactとした。
- V2をserver側で自動選択する案は旧client互換性がないため、publish responseとSSE connectionの個別opt-inへ修正した。
- 既存の正本を照合し、画面外clip、着弾後の結果、直列再生、入力lock、最終settlementを明示的な受入条件へ追加した。

## 13. 実装・検証結果

2026-08-04に本設計の実装と検証を完了した。採用した境界は設計どおりで、演出の品質、時間、順序、入力解放、canonical result、network authority、visual settlementは変更していない。

| 領域 | 完了内容 | 主commit |
| --- | --- | --- |
| operational query | scope / active run確認をO(1) APIへ分離 | `469ad07d3` |
| frame fingerprint | visual / interaction fingerprintを1回のcanonical passへ統合 | `d8b0e95ed` |
| static view | stone、ghost、effectのstatic paintとdynamic transformを分離 | `ab8513f65` |
| source trajectory | geometry、clip、primitive、easingを事前compileし、steady tickをscalar-only化 | `5abe4f1bc` |
| input / camera | affine hit projection、pointermoveとcamera eventのrAF coalescingを実装 | `4e5368766`、`fe03fb0c4` |
| snapshot intake | accepted candidateのclone / deep inspectionを1回へ統合 | `8b6392239` |
| presentation V2 | shared resolve契約、Worker/local配信、client opt-inを段階導入 | `78bf19025`、`de54e2c73`、`4be7d9375` |

構造・CPU・wireの合否はすべて通過した。8対象・60 tickのtrajectory動的descriptorは26,160件から0件、tick batch p95は10.8795 msから0.1334 ms、snapshot 32-intake batch p95は21.4063 msから13.587 ms、viewer別V2 payloadは約49.4%削減された。semantic digestはlegacyとV2で同一である。

ブラウザではheavy scenarioのPixi RAF p95が16.7～16.8 ms、最大16.8 ms、50 ms以上stallが0件だった。4 laneの標準長時間測定では、測定と並行したローカル処理中のclassic laneだけに計3件のstallが記録されたが、同一artifact・同一commitでclassic Pixi / DOMを各10分単独再測定すると、合計71,840 RAF intervalで50 ms以上stallは0件だった。初回失敗を破棄せず、環境干渉を含む結果と単独再測定を `docs/perf/2026-08-04-in-game-runtime-browser-performance.md` に併記した。

focused / parity / browser verificationではnetwork parity 35 suite・563 test、Pixi playback 232 scenario、Chrome / Firefox / WebKit × desktop / mobile × Pixi / DOMの12 smoke、runtime fallback、visual regressionの0 pixel差を確認した。`01-rulebook.md` と `正本/` は変更していない。
