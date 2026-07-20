---
status: implemented
owner: repository-maintainers
scope: mobile-turn-render-pipeline-optimization
created: 2026-07-20
updated: 2026-07-20
---

# スマホ向け手番描画・Pixi静的レイヤー・非表示パネル画像の最適化設計

## 1. 文書の役割

**対象:** スマホでCPU Lv1戦を含む通常プレイ中に発生する手のカクつきと発熱を抑えるため、同一手番中の盤面更新、Pixi盤面の保持オブジェクト、非表示パネルの大型画像読込をまとめて軽量化する。

**文書の役割:** プレイヤー可視挙動を変えずに、どの処理をまとめ、どの描画要素を静的化し、どの画像をいつ読み込むかを定義する内部設計の正本である。実装手順は `docs/superpowers/plans/2026-07-20-mobile-turn-render-pipeline-optimization-plan.md` を正本とする。

**Source of truth:** プレイヤー可視仕様は `01-rulebook.md`、内部境界は `docs/architecture-contracts.md`、作業規約はrootおよび各ディレクトリの `AGENTS.md` に従う。本設計はそれらを置き換えない。

**正本更新方針:** 本件は挙動不変の内部最適化である。`01-rulebook.md`、`正本/*.md`、`docs/HUMAN-DEV-GUIDE.md` は変更しない。演出順、表示内容、入力可能になる時点、画像の見た目を変える必要が判明した場合は実装を停止し、別の仕様変更として判断する。

**Non-goals:** CPU思考ロジック、ゲームルール、ネットワークauthority、カード効果、演出時間そのもの、盤面の二重writer、DOM互換盤面の通常経路化、画像の再圧縮・差し替え、長時間benchmark、実機の温度計測は対象外とする。

## 2. 現状と原因モデル

### 2.1 同一手番で最終的に使われない盤面フレームを準備している

`ui/render-scheduler.ts` は同じanimation frame内の要求を1回にまとめるが、手番処理が複数の非同期phaseをまたぐとphaseごとに `prepareBoardVisualUpdate()` が呼ばれる。`ui/board-renderer.ts` はその都度、盤面投影、セル状態、テーマ、layoutを含む完全な `BoardVisualFrame` を構築する。

再生中の `ui/board-visual/controller.ts` は最新フレームだけを `pendingLatest` に残す。しかし、各フレームを受け取るたびにmicrotaskで `backend.prepareFrame()` を開始するため、後続フレームが来ると準備済みまたは準備中の処理がstaleになる。`ui/pixi/board-backend.ts` も新しい `FrameWork` の開始時に直前workをcancelし、texture setを解放する。

したがって現状は「最新だけを表示する」ことには成功しているが、「最新になる前の投影・画像準備を行わない」構造にはなっていない。ローカル手番のsettlementでも、先に `renderBoard()` でpending frameを投入してから `settleLocalWriter()` が同じframeを拾う二段構えになっている。

### 2.2 静止中にもセル単位のDisplayObjectを大量保持している

`ui/pixi/board-scene.ts` は可視セルごとに `PixiCellView`、`PixiStoneView`、`PixiHintView` を一組で確保する。通常の8×8盤面では64組となる。

- `PixiCellView` は背景、盤面texture、穴、内周、罫線、marker rootなどをセルごとに保持する。
- `PixiStoneView` は空きセルでもshadow、aura、sprite、badgeなど一式を保持する。
- `PixiHintView` はセルごとのhintとinteraction hit areaを保持する。
- 盤面ボーナス数字は `Text` をセルごとに生成する。

この構造により、通常盤面でも診断値がおよそ1,470 DisplayObjectになる。差分署名により多くの再描画はskipできても、stage traversalと描画batch構築の対象オブジェクト数は残る。

### 2.3 非表示パネルの装飾画像が起動時CSSから参照されている

起動時に読み込む `styles-layout-controls.css` と `styles-layout-info.css` は、非表示のデッキ構築、観測ガチャ、ネット対戦パネル用の大型画像を直接 `url(...)` 参照している。主な対象は次のとおりである。

| 機能 | 画像例 | 現行サイズの目安 |
| --- | --- | ---: |
| デッキ構築 | `deck-builder-night-manuscript-texture.png` | 約3.02MB |
| デッキ構築 | `deck-atelier-observatory.png` | 約1.74MB |
| 観測ガチャ | `gacha-observation-bg-v1.png` | 約2.39MB |
| 観測ガチャ | `gacha-reference-banner.png` | 約1.78MB |
| 観測ガチャ | `gacha-crystal-cluster-v1.png` | 約1.07MB |
| ネット対戦 | `network-lobby-frame-v1.png` | 約1.81MB |
| ランキング | podium・number・icon一式 | 別CSSだがscaffold初期化時に読込 |

CSS自体の分割やoptional JavaScript chunkだけでは、起動時CSSに残った画像URLの取得を止められない。画像参照の所有権も「機能を開く」という操作へ移す必要がある。

## 3. 目標と不変条件

### 3.1 目標

1. ローカルの同一visual writer手番では、中間の通常盤面更新要求をdirty情報としてまとめ、settlement時に最新の完全フレームを1回だけ構築する。
2. 1 writerあたり、通常完了時のresource preparationとfinal canonical applyをそれぞれ最大1回にする。
3. 盤面背景、セル面、罫線、穴、星、盤面ボーナス数字を、可視viewport単位の1枚の静的textureへ統合する。
4. 空きセル用の `PixiStoneView` をstageへ保持せず、石または石markerがあるセルだけをmaterializeする。
5. 通常8×8初期盤面のsteady-state DisplayObject数を、約1,470から500未満を目安に削減する。満盤面でも1,000未満を目安とする。
6. デッキ構築、観測ガチャ、ネット対戦、ランキングの大型装飾画像を、その機能を初めて開くまで要求しない。

DisplayObject値は将来の見た目追加で変わり得るため、絶対的な製品仕様にはしない。恒久的な契約は「静的面がセル数に比例してDisplayObjectを増やさないこと」と「空きセルがStoneViewを所有しないこと」である。

### 3.2 必ず守る不変条件

- canonical state、CPUの選択、乱数消費、`events[]` の値と順序を変えない。
- playback event、board-local effect、global DOM effectはまとめたり省略したりしない。まとめるのは再生中に発生する**通常の最終盤面同期要求**だけとする。
- strict-networkはserver snapshotとcommit receiptを正本とし、`applyCommittedFrame()`を1回だけ通す。
- local writer、network writer、recovery、NOANIM、DOM互換fallbackのsettlement時点を変えない。
- PixiとDOM互換backendを同時にmountしない。canvas、WebGL context、ticker、最終盤面writerを増やさない。
- topology expansion/shrink、board-frame hole、negative coordinate、scroll viewport、effect gutterを維持する。
- 盤面画像が読めない場合の既存fallbackを維持する。非表示パネル画像の読込失敗時は、操作可能なgradient/color fallbackを表示し、パネルを使用不能にしない。
- lazy stylesheetはclassic、Vite、Worker mirrorで同じgroup名・URL・retry契約を使う。

## 4. 採用するアーキテクチャ

### 4.1 Writer-scoped盤面無効化accumulator

`ui/board-renderer.ts` の通常更新入口に、writer単位の軽量なinvalidationsを保持する。保持するのは完全なframeではなく、次の情報だけである。

- dirty generation;
- boundedなsource/reason集合;
- theme/font/layout/interactionなどの要求種別;
- 対象writer tokenまたはidle generation;
- settlementで消費済みかどうか。

#### Idle時

既存の `RenderScheduler` によるrequestAnimationFrame単位のcoalescingを維持する。1 flushにつき最新状態から1 frameを構築し、1回submitする。

#### Local playback時

writerをclaimした後の通常 `renderBoard()` は、完全frameを構築せずinvalidationsだけをmergeする。board-local playbackは既存のPixi timelineとprojectionをそのまま実行する。

`settleBoardVisualWriter(token)` は専用のfinal-frame経路で最新canonical/presentation stateを1回だけ読み、`controller.settleLocalWriter(token, finalFrame)` に直接渡す。先に `submitFrame()` してから同じframeをsettleし直す経路は廃止する。

#### Strict-network時

通常のdirty要求はcommit待ちの最終盤面を作らない。visual storeにreceiptで固定されたsnapshotから `applyCommittedBoardVisualFrame()` が1 frameだけ構築し、既存の `controller.applyCommittedFrame()` またはrecovery restoreを通す。成功後にそのwriterのinvalidationsを破棄する。

#### Recovery時

active writerを伴うrecoveryではdirty情報だけを維持し、checkpoint、phase replay、committed recovery frameを優先する。writerを伴わないidle recoveryは、最新状態を失わないため既存のpending/recovery frame契約を維持する。

#### Contextの扱い

`PlaybackStateManager` のboard update contextと `board-update-sync-runtime.ts` のcontextは、中間frameへ焼き付けず、final frame構築時に一度captureする。stickyな抑止flagや座標集合は既存のmerge契約を維持し、final presentation commit成功時に一度だけconsumeする。

### 4.2 Controller/backendの準備契約

`BoardVisualController` のplayback event順序、writer token、committed frame、recovery APIは変更しない。既存の `settleLocalWriter(token, finalFrame)` を正規経路として使い、`pendingLatest` とeager preparationはmount/recovery/互換入力のために残す。

通常のローカル手番がfinal frameを1枚しかcontrollerへ渡さなくなるため、`schedulePendingPreparation()` が中間frameを準備して破棄する状況を通常経路から除去できる。backendのtexture managerが同じURL uploadをcacheする既存機能は維持するが、本件では新しい共有prepared-set APIを増やさない。まず上流で不要なwork自体を発生させない。

診断には少なくとも次を追加または整理する。

- `boardInvalidationRequestCount`;
- `boardInvalidationMergeCount`;
- `finalFrameBuildCount`;
- `finalFrameSubmitCount`;
- writer token別のprepare/apply件数;
- stale prepareの理由（superseded、recovery、destroy）。

通常手番とrecovery/cancelを区別できるcounterにし、debug以外の常時詳細ログは増やさない。

### 4.3 Viewport-baked静的盤面レイヤー

新しい `ui/pixi/static-board-layer.ts` が、盤面の静的面を一時的なsource containerへ描き、Pixi v8 `RenderTexture` にbakeする。stageへ常時置くのは基本的に1枚のSpriteだけとする。

静的レイヤーへ含めるもの:

- board surface fill/texture/overlay;
- playable/hole/board-frame-holeのセル面;
- セルgradient、罫線、outer/inner boundary;
- star points;
- board bonus数字とtheory-number style;
- blockade、seed、poison-cellなど、現在の `surfaceSignature` に含まれるframe-state marker。

静的レイヤーへ含めないもの:

- 通常石・特殊石・石status badge;
- legal/selectable/preview/hover/keyboard cursor/direction hint;
- playback ghost、highlight、trajectory、destroy/move/flip/status effect;
- global DOM演出。

#### Bake範囲とメモリ

論理盤面全体ではなく、現在のvisible world windowと既存overscanに対応するviewport範囲だけをbakeする。effect gutterは透明のまま既存canvas側に残し、静的textureへ含めない。8×8の通常viewportなら、DPR 2でも概ね640×640 physical pixels程度に抑え、巨大な拡張盤面全体のRenderTextureを作らない。

一時sourceのGraphics/Textはbake完了後にstageから外してdestroyする。RenderTexture、Sprite、context generationは静的レイヤー自身が所有し、resize、scroll window、DPR、theme、font ready、board appearance、surface texture、topology、surface markerの変更時だけ再構築する。

静的signatureは少なくとも次を含む。

- render sessionとcontext generation;
- materialization windowとscene offset;
- topologyのexisting/playable/hole keysとoffset;
- materialized cellの `surfaceSignature`;
- cell size、orientation、DPR;
- board appearanceとsurface texture revision;
- surface/grid/boundary/marker/boardBonus用theme revisionとfontReadyEpoch。

stone/interactionだけの変更ではbakeしない。

#### Topology reveal

topology expansionの追加セルは、1枚の完成textureを即座に見せない。旧静的textureをbaseとして保持し、追加セルだけをtemporary patchとして既存 `topologyReveals` のalphaへ接続する。reveal完了時に新しい完成textureへpromoteし、patchを解放する。NOANIMではpatchを経由せず即時promoteする。

board shrinkとhole変更は既存playback effectで旧geometryを見せ、final canonical applyで新しい静的textureへ切り替える。context loss中のpatchは破棄し、controllerのcheckpoint/phase replay契約から再構築する。

### 4.4 Retained viewの分離

現在の `RetainedCellViews` 一体poolを次の所有単位へ分ける。

- `Hint/InteractionView`: 可視playable cellごとに保持する。入力authorityは既存 `BoardInputController` のまま。
- `StoneView`: `hasPixiStoneVisual(cell)` がtrueのセルだけmaterializeする。空になったらstageから外してpoolへ返す。
- `StaticSurface`: セル数に比例する常駐viewを持たず、4.3の1 Spriteへ統合する。
- `TopologyPatchView`: topology reveal中だけ保持する。

playback stone override、hide、ghost、topology alphaは、optional StoneViewとHintViewを別々に扱う。空きセルの `getRenderedCell()` diagnosticsはviewを生成せず、materialized modelと静的projectionから同じ意味のdiagnostic snapshotを返す。

この分離により、初期盤面では64個のHint/InteractionViewと4個前後のStoneViewだけが主なセル比例オブジェクトとなる。満盤面ではStoneViewが64個になるが、旧 `PixiCellView` 一式は復活しない。

### 4.5 Feature-scoped大型画像stylesheet

装飾画像のURLを起動時CSSから取り除き、次のlazy stylesheet groupへ移す。

| Group | 新規/既存CSS | 有効化の契機 |
| --- | --- | --- |
| `deck-builder` | `styles-feature-deck-builder.css` | デッキ構築を初めて開く |
| `gacha` | `styles-feature-gacha.css` | 観測ガチャを初めて開く |
| `network` | `styles-feature-network.css` | ネット対戦パネルを初めて開く |
| `leaderboard` | 既存 `styles-leaderboard.css` | ランキングを初めて開く |

起動時CSSはgradient/color fallbackとlayoutを保持し、大型画像部分をCSS custom propertyへ置換する。feature stylesheetは該当パネルへURL値だけを与える。パネルを閉じてもlinkを保持し、同一sessionで再取得・再decodeしない。

`ui/assets/feature-stylesheet-loader.ts` はgroupとstylesheet pathの唯一の対応表を持つ。機能別controllerは、開く意図が確定した時点で `ensureFeatureStylesheet(group)` を呼ぶ。

- 同じgroupの並行要求は1 Promiseへdedupeする。
- 成功したlinkはsession中再利用する。
- 失敗したlinkは取り除き、Promise cacheをclearして次回openでretryできる。
- stylesheet失敗はパネルopenを拒否せず、fallback表示と短いwarningにする。
- URLには `public/module-registry.js` と同じstartup versionを付与し、classic/Vite/Workerで古いCSSが残らないようにする。
- hover preloadは行わない。モバイルの偶発touchで大型画像を取得しないため、明示的なopen操作を境界とする。

ガチャ結果画像、背景スキン一覧、カードサムネイルなど、もともとパネル内で必要になった時にDOMへ追加される画像は本groupへ一括追加しない。初期取得の原因になっている大型装飾だけを対象とする。

## 5. 検討した代替案

### 5.1 requestAnimationFrame単位のcoalescingだけを強化する

既存 `RenderScheduler` は同一frame内ではすでにcoalesceしている。非同期phaseをまたぐ手番では複数回flushされるため、根本原因を残す。採用しない。

### 5.2 Controllerでstale preparationをcancelし続ける

表示の正しさは保てるが、投影構築とtexture prepareを開始した後に捨てる構造が残る。上流のwriter境界でframeを作らない設計を採用する。

### 5.3 全セルを1つのGraphicsにし、数字Textを64個残す

実装は比較的容易だが、数字とmarkerのDisplayObject、text traversal、cell数比例構造が残る。RenderTextureへbakeする案より削減幅が小さいため採用しない。

### 5.4 論理盤面全体を巨大RenderTextureへbakeする

拡張盤面、DPR 2、effect gutterの組合せでGPU memoryを増やし、発熱対策と逆行する。visible viewportだけをbakeする。

### 5.5 Pixi `cacheAsTexture` をsceneへ直接付ける

簡単だが、cache更新、context loss、topology patch、temporary source破棄の所有権が暗黙になる。明示的なRenderTexture ownerを採用する。

### 5.6 JavaScriptでImageをpreloadしてstyleへ直接URLを設定する

画像decodeの制御はしやすいが、CSS cascadeとclassic/Vite asset pathの責務が二重になる。feature stylesheetを唯一の画像URL ownerにする。

### 5.7 Vite chunkだけで画像を遅延する

classic laneとWorker mirrorに別実装が必要になり、起動時root CSSのURLも残る。共通stylesheet loaderを採用する。

## 6. Error handlingとcleanup

- final frame構築またはprepare失敗は、既存controller recoveryへ入り、成功したようにwriterをreleaseしない。
- invalidation accumulatorはsettlement成功後だけclearする。失敗時はwriter tokenとdirty generationを保持し、restoreに使う。
- superseded/cancelled/recoveryの診断を区別し、正常手番でstaleを隠す広いcatchを追加しない。
- StaticBoardLayerのbake失敗はPixi scene apply failureとして扱い、既存のcontext recoveryまたはDOM fallbackへ渡す。静的レイヤーだけをDOMで描く部分fallbackは作らない。
- RenderTexture、temporary source、topology patch、pooled StoneViewはbackend destroyとcontext replacementで必ずreleaseする。
- lazy stylesheet failureはゲームstateへ影響しない。fallback色を維持し、次回openでretryする。

## 7. 最小限の検証方針

長時間benchmarkや実機温度測定は実装完了条件にしない。次の短い決定的検証だけを行う。

1. focused Jestで、local writer中に複数の通常更新要求を出してもfinal frame build/prepare/applyが各1回になることを確認する。
2. strict-network commit、NOANIM、recovery、topology revealの既存focused testを通す。
3. Pixi scene testで、静的レイヤーがセル数比例のDisplayObjectを残さず、空きセルにStoneViewを作らないことを確認する。
4. 通常8×8 fixtureのdiagnostic countが初期500未満、満盤面1,000未満であることを短いtestで確認する。
5. stylesheet loader testで、各groupはopen前にlinkを作らず、初回ensureで1回だけ作り、failure後にretryできることを確認する。
6. 1回の短いbrowser smokeで、Lv1の1往復、盤面入力、topologyを含む既存代表fixture、パネルopen前後のresource entryだけを見る。
7. root browser source変更後は `npm run build:browser` 相当を含む最終buildとWorker mirror生成を1回だけ行う。

実行しないもの:

- 長時間selfplay・学習;
- 全visual-regression suite;
- 複数端末・複数ブラウザの長時間温度比較;
- 10分以上の自動連続対局;
- 改善率を証明するためだけの詳細profiling。

実機でのカクつきと発熱はユーザー確認へ引き継ぐ。実装側は、原因に直結するoperation countとresource request契約を保証する。

## 8. 完了条件

- ローカルwriter手番の中間通常更新はframeを構築せず、settlementへ1回集約される。
- 1 local writerにつきfinal canonical prepare/applyが各1回で、正常系のstale preparationが0である。
- strict-network、recovery、NOANIM、playback event順序が既存契約どおりである。
- 盤面静的面はsteady stateで1 Spriteを主なwriterとし、cell数比例の `PixiCellView` をstageに持たない。
- 空きセルがStoneViewをstageに持たない。
- 通常8×8初期fixtureが500未満、満盤面fixtureが1,000未満のDisplayObject目安を満たす。
- topology revealはtemporary patchを経て完了後に1枚の静的textureへ戻る。
- 対象大型画像は該当パネルを開く前にrequestされず、初回open後だけ読み込まれる。
- classic、Vite、Worker mirrorでlazy stylesheetが取得できる。
- player-visible rule、text、演出順、入力settlementを変更していない。

## 9. リスクと緩和策

| リスク | 緩和策 |
| --- | --- |
| 中間frameを作らないことで抑止contextを失う | contextはglobal mirrorからfinal frame時に一度captureし、commit成功時だけconsumeする |
| network local stateを誤って表示する | strict-networkはdirty accumulatorからframeを作らずreceipt-bound snapshotだけを使う |
| 静的textureに追加セルが先に見える | topology追加セルはtemporary patchでrevealし、完了後にpromoteする |
| scroll/拡張盤面で巨大textureになる | visible windowだけをbakeし、effect gutterと論理盤面全体を含めない |
| font ready後に数字が古い | `fontReadyEpoch` を静的signatureへ含める |
| context loss後にdead textureを参照する | context generationでinvalidateし、RenderTextureとpatchを全再作成する |
| lazy CSSのcacheが古い | startup version queryを付与し、failed linkは除去してretryする |
| 画像待ちでパネルが開かない | gradient fallbackで即時openし、画像は非blockingに反映する |

## 10. 設計自己レビュー

### レビュー結果

- **仕様境界:** ゲーム結果、CPU、ネットワークauthority、演出順に変更はなく、`01-rulebook.md` と `正本/` の更新は不要である。
- **Single Visual Writer:** final frame、playback、static bakeはいずれも既存Pixi applicationとscene内で完結し、canvas、context、ticker、DOM final pixel writerを増やさない。
- **見落としやすい経路:** strict-network commit、idle recovery、NOANIM、font ready、camera scroll、topology reveal、context lossを明示した。
- **オブジェクト削減:** static surfaceだけでなく、現行の一体poolが空きセルStoneViewを保持する問題も同時に分離し、約1,470から十分な削減が見込める構造にした。
- **画像遅延:** optional JavaScriptだけに依存せず、起動時CSSからURL所有権を外すため、初期requestを実際に止められる。
- **検証量:** 長時間計測を完了条件から外し、writerごとの回数、DisplayObject構造、stylesheet link/resource requestという原因直結の短い検証へ限定した。

### 残余リスク

実機のGPU driver、端末固有のthermal throttling、ブラウザの画像decode特性は自動fixtureだけでは保証できない。実装完了後もユーザーの実機でLv1戦を数分行い、手の追従と発熱傾向を確認する必要がある。ただし、その確認を待たずに「重複workを作らない」「stage graphを縮小する」「未使用画像を取得しない」という構造上の完了は判定できる。
