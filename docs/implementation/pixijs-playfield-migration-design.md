# PixiJS 盤面移行設計

- Status: proposed
- Date: 2026-07-14
- Last reviewed: 2026-07-15（実 presentation・実機 mobile performance・cutover evidence gate を補強）
- Target: ブラウザの盤面、石、盤面上の入力表示、盤面に属する再生演出を PixiJS へ移行する
- Source of truth: root `AGENTS.md`、`01-rulebook.md`、`正本/演出正本.md`、`正本/ターン進行正本.md`、`docs/architecture-contracts.md`、現行 root 実装
- Design dependency: PixiJS `8.18.1` を完全固定して使用する
- Non-goals: ゲームルール、カード効果、演出順序・時間ポリシー、サウンド、ネットワーク authority、CPU/selfplay、カード・HUD・設定・チャット・モーダルの DOM UI、ガチャ画面、全画面を単一 canvas にすること、WebGPU 採用、Worker 内で PixiJS を動かすこと、WebGL 非対応環境を今回の移行だけで非対応化すること

## 1. 結論

最終形は「盤面だけ PixiJS、UI は DOM」のハイブリッド構成とする。

通常起動は PixiJS を使う。現行の対応環境を狭めないため、Pixi runtime/WebGL 初期化失敗と復旧不能な context loss に限り、既存 DOM 盤面を隔離した compatibility backend へ排他的に fallback する。

PixiJS が所有する範囲:

- 盤面表面、通常マス、穴、円形盤面の無効領域、拡張マス
- 通常石・特殊石・石上のバッジ・カウント表示
- 合法手、選択、対象、プレビュー、キーボードカーソルなどの盤面ハイライト
- `PLACE`、`FLIP`、`DESTROY`、`SPAWN`、`MOVE`、盤面上の `STATUS` と、2セル effect gutter 内で完結するカード固有の盤面演出
- 盤面上のポインター hit area と、盤面演出に必要な一時オブジェクト

DOM が所有し続ける範囲:

- `#game-container`、`#board-stack`、`#board-frame` のレイアウト、スクロール、装飾フレーム
- 手札、カード詳細、山札、チャージ HUD、ターン・スコア・ログ、パスボタン
- 設定、ヘルプ、チャット、プロフィール、ランキング、ガチャ、結果画面などの文字・フォーム UI
- 全画面の日本語テキスト、操作ボタン、ライブリージョン、フォーカス管理
- 2セル effect gutter を超える全画面・画面横断の装飾演出。ただしセル/石の最終表示は書かない
- 手札から盤面へ飛ぶカード等、DOM UI を起点とする横断演出。着地点は盤面座標 API から取得する

`#board` は削除せず、CSS Grid のマス群から「Pixi canvas と非表示のアクセシビリティ層を保持する DOM host」へ役割を変える。通常 Pixi path の静的 `#board-expansion-layer` は移行完了後に廃止し、DOM compatibility backend が mount されたときだけ同等の subtree を動的に作る。`#card-fx-layer` は DOM 横断演出用として残す。

この境界なら、高頻度に同時更新される盤面演出は GPU 描画へ集約でき、文字・フォーム・レスポンシブ UI・アクセシビリティは DOM の強みを維持できる。カードや HUD まで PixiJS 化することは、現状では実装量と保守負担に対して利益が小さい。

## 2. 現行実装から得た根拠

### 2.1 authority と視覚状態

- `game/` は canonical state、合法性、カード解決、順序付き `events[]` を所有し、DOM・音・タイマー・ネットワーククライアントに依存できない。
- `ui/network/presentation-timeline.ts` が network visual cursor を、`ui/network/visual-state-store.ts` が描画対象の visual state を所有する。
- `ui/network/snapshot.ts` が受けた canonical snapshot を、再生中に盤面へ直接先送りしてはならない。
- `docs/architecture-contracts.md` の Single Visual Writer 契約により、再生中に canonical 描画と playback 描画が同じ盤面を更新することは禁止されている。

PixiJS はこの境界の外側にある描画アダプターであり、canonical state や network snapshot を直接読まない。

### 2.2 現在の盤面描画

- `ui/diff-renderer.ts` の `initializeBoardDOM()` が全マス DOM と入力 binding を作り、`renderBoardDiff()` が通常時の差分描画を行う。
- `ui/diff-renderer/projector.ts` は capability 注入で描画用セル状態を作る。DOM 依存を取り除けば、PixiJS と DOM の両方が使える投影境界になる。
- `ui/board-renderer.ts` は playback 中の描画 defer を持つ一方、BGM/body class や manifest panel の同期も含んでおり、描画バックエンド交換前に presentation side effect を分離する必要がある。
- 盤面は 4～16、円形、穴、片側拡張、負座標を扱う。PixiJS 側も単純な `rows * cols` 配列ではなく、world coordinate と topology bounds を扱う必要がある。

### 2.3 現在の演出

- `ui/animation-engine.ts` は phase ごとの順序、再生 lock、最終同期を所有し、`PLACE`、`FLIP`、`DESTROY`、`SPAWN`、`MOVE`、各種特殊演出、音、ログ、バナーを一つの大きな DOM 実装で扱う。
- `正本/演出正本.md` は `sequenceIndex`、`actionId`、`effectBlockId`、`phase` の順序を authority とし、UI による順序推測を禁止している。
- `DESTROY` は canonical state がすでに空でも playback が除去表示を所有する。Pixi 移行で最終状態だけ描けばよいわけではない。
- `正本/ターン進行正本.md` は、対象選択・特殊石・ターン遷移を演出完了まで直列に保つことを要求する。

したがって、アニメーション API をカードごとに新設せず、現在の presentation event と phase 順序をそのまま Pixi 側へ渡す。

### 2.4 入力とアクセシビリティ

- `ui/diff-renderer/interaction-binder.ts` は pointer down/up、hover、長押し、touch、方向指定を DOM cell に binding し、最終的に既存の `handleCellClick(row, col, directionKey)` を呼ぶ。
- `ui/game-keyboard-shortcuts.ts` は `.cell.legal` を DOM 検索して W/A/S/D と Space のカーソル操作を行う。
- 方向ヒントは現在 `role="button"`、`tabIndex=0`、`aria-label` を持つ。

canvas 化後は合法手を DOM から逆算できないため、入力 controller は共通 render model を読むように変更する。方向ヒントのフォーカス・読み上げは、PixiJS の汎用 accessibility overlay ではなく、ゲーム固有の小さな DOM semantic layer で維持する。

### 2.5 配信とテスト

- 通常の `index.html` は Vite 生成物、`index.classic.html` は明示的 rollback entry である。
- Vite lane は `browser-vite/main.ts` の `beforeInitialize` で runtime を DI できる。
- classic lane は root の生成済み module registry と script load order を使う。
- `scripts/compare-browser-lanes.ts` は classic/Vite の DOM・layout・pixel 一致を比較する。
- 盤面 DOM selector、`renderBoardDiff()`、`forceFullRender()` に直接依存する test/E2E/visual script が多数ある。実装と同時に stable diagnostic API へ移さなければ、テストのためだけに偽 cell DOM を残すことになる。

### 2.6 現行性能証拠と限界

Phase 0 の同一 desktop Chrome capture では、DOM lane の8x8複数石更新が classic p95 40.9 ms、Vite p95 43.7 ms、16x16 apply がそれぞれ 276.8 ms、271.9 ms だった。少なくとも現行盤面の render/apply 経路には一 frame budget を超える負荷が残っており、盤面を PixiJS backend へ移す根拠は失われていない。

一方、Phase 0 の当該 frame 値は synthetic state mutation と `forceFullRender()` を使う desktop microbenchmark であり、`AnimationEngine` / `PlaybackEngine` が実際に `PLACE`、`FLIP`、`MOVE`、`DESTROY`、`SPAWN`、`STATUS`、特殊演出を dispatch する一手全体の負荷や、physical mobile device の paint/composite、texture upload、thermal throttling を証明しない。したがって次を区別する。

- Phase 0 baseline: topology、pixel、digest、desktop apply cost を固定する再現可能な移行前基準。
- Phase 9 release evidence: public presentation path を使った DOM/Pixi A/B、physical Android Chrome / iPhone Safari、長時間安定性を含む default cutover 判定。

現行実装には `RenderScheduler`、`syncBoardPixelSizing()` の dirty/signature gate、差分 renderer、Single Visual Writer、CPU candidate scoring Worker、lazy runtime loading がすでにある。Pixi 移行はこれらを置き換えず、盤面 DOM/CSS writer と board-local effect の残存負荷を backend 内へ集約する。HUD、手札、global DOM effect、CPU の残存負荷は計測上分離し、盤面の性能問題を理由に全 UI を canvas 化しない。

## 3. 外部技術判断

この計画では PixiJS `8.18.1` を `package.json` と lockfile で完全固定する。実装中の API drift を避けるため、移行期間中の minor 更新も別変更として扱う。

公式資料に基づき、次を固定する。

- `Application` は構築後に非同期 `init()` する。
- production renderer は `preference: 'webgl'` とする。WebGPU はこの移行では使用しない。
- `autoStart: false`、private ticker を使い、ターン制ゲームの idle 中は ticker を停止する。
- pointer interaction は Pixi v8 の `eventMode`、`hitArea`、pointer events を使う。
- PixiJS accessibility extension は初期移行では使用しない。既存のゲーム固有キーボード操作と DOM semantic layer を正本とする。

参照:

- [PixiJS v8.18.1 release](https://github.com/pixijs/pixijs/releases/tag/v8.18.1)
- [Application](https://pixijs.com/8.x/guides/components/application)
- [Renderers](https://pixijs.com/8.x/guides/components/renderers)
- [Events / Interaction](https://pixijs.com/8.x/guides/components/events)
- [Accessibility](https://pixijs.com/8.x/guides/components/accessibility)
- [Render Loop](https://pixijs.com/8.x/guides/concepts/render-loop)

## 4. 不変条件

以下は移行の release gate であり、性能や実装簡略化のために変更しない。

- 同じ操作に対する canonical state、合法性、カード結果、乱数結果、CPU 判断が一致する。
- `events[]` の内容、`sequenceIndex`、`actionId`、`effectBlockId`、`phase`、再生順、音 key、ログ順が一致する。
- playback 中は一つの board visual writer だけが盤面を更新し、終了後に visual state へ一度だけ同期する。
- network では accepted snapshot が authority であり、Pixi object、preview、ticker、animation progress を authority にしない。
- pending selection の publish 経路は既存 UI/network signal bridge のままとする。
- 縦横独立 4～16、奇数盤、円形 6/8/10/12/14/16、穴、特殊形状、負座標を含む多段拡張、overflow scroll が動作する。
- mouse、touch、pen、hover、長押し、方向指定、W/A/S/D、Space、Enter、spectator read-only が維持される。
- `NOANIM=1` と既存 test no-animation policy が決定論的に動作する。
- `prefers-reduced-motion` は既存 effect ごとの短縮/省略 policy を維持し、`NOANIM` と同一扱いにしない。
- 盤面、盤面フレーム、石、カスタム Blob skin の選択 ID と保存形式を変えない。
- PixiJS を `game/`、`shared/`、CPU、Worker に import しない。
- debug/test API は明示的な debug/test flag なしに公開しない。
- normal boot で外部 CDN を要求しない。

## 5. 目標アーキテクチャ

### 5.1 データフロー

```text
local game state ─────────────┐
                              ├─ BoardRenderModelBuilder ── BoardVisualController ── PixiBoardBackend
network visual-state-store ───┘                                  │
                                                                 ├─ idle: applyFrame()
ordered presentation events ─ PresentationEngine/phase planner ──└─ playback: playPhase()

Pixi pointer event ─ BoardInputController ─ existing UI handlers ─ game/network command path
DOM keyboard event ───────────┘
```

`BoardRenderModelBuilder` の入力は local game の現在表示すべき state、または network visual-state-store が選んだ state のどちらかである。network canonical snapshot を bypass して直接渡す API は作らない。

### 5.2 engine-neutral render model

`ui/board-visual/model.ts` に DOM/Pixi 非依存の描画 DTO を置く。`ui/diff-renderer/projector.ts` の投影ロジックは `ui/board-visual/model-builder.ts` へ移し、移行中は DOM backend も同じ DTO を使う。

model builder は既存の board topology、owner/player normalization、special marker、viewer-context helper を呼び、shape/owner/card status を Pixi 用に再解釈・複製しない。

```ts
interface BoardRenderInputs {
  baseVisualState: LocalDisplayState | NetworkVisualState;
  presentationOverlayState: {
    hoveredCellKey: string | null;
    keyboardCursorKey: string | null;
    previewCellKeys: readonly string[];
    selectedCellKeys: readonly string[];
    directionHints: readonly BoardDirectionHint[];
    localPendingHints: readonly BoardPendingHint[];
    interactionLocked: boolean;
  };
}

interface BoardRenderModel {
  visualRevision: number;
  topology: {
    baseRows: number;
    baseCols: number;
    minRow: number;
    maxRow: number;
    minCol: number;
    maxCol: number;
    renderRowOffset: number;
    renderColOffset: number;
  };
  cells: BoardCellVisualState[];
  keyboardCursorKey: string | null;
  viewerContext: 'black' | 'white' | 'spectator';
}

interface BoardVisualFrame {
  model: BoardRenderModel;
  layout: BoardViewportLayout;
  appearance: BoardAppearanceDescriptor;
  theme: BoardVisualThemeDescriptor;
}

interface BoardCellVisualState {
  key: string;             // canonical world key: `${row},${col}`
  row: number;
  col: number;
  renderRow: number;
  renderCol: number;
  kind: 'playable' | 'hole';
  expansionSide: 'top' | 'right' | 'bottom' | 'left' | null;
  boundaryEdges: {
    top: 'none' | 'outer' | 'hole';
    right: 'none' | 'outer' | 'hole';
    bottom: 'none' | 'outer' | 'hole';
    left: 'none' | 'outer' | 'hole';
  };
  stone: BoardStoneVisualState | null;
  markers: readonly BoardMarkerVisualState[];
  interaction: BoardCellInteractionState;
}
```

DTO は以下を含まない。

- DOM node、Pixi `DisplayObject`、texture、callback、Promise
- canonical state を変更する関数
- animation progress、sound state、network client
- CSS class 名を authority とする値

`visualRevision` は UI 内の差分検出用であり、network `stateVersion` の代用ではない。各セルには安定した visual signature を持たせ、backend が同じキーの表示オブジェクトを再利用できるようにする。

`BoardRenderModel.cells` は existing/playable と explicit hole だけを全 world coordinate 分 sparse に保持し、`void` を含めない。`BoardVisualFrame` の topology と layout/camera を受けた scene materializer が、可視 window + overscan/gutter 内のみ「同範囲の world key が `cells` にない」ことから ephemeral void view を導出する。void は gameplay/model state ではなく、backend が任意に捏造する値でもない。DOM compatibility backend も同じ materialization helper を使う。

network の `baseVisualState` は必ず `visual-state-store` が選んだ state とする。一方、hover、keyboard cursor、選択 preview、方向 hint、publish 中の `__networkLocalHint` 等は `presentationOverlayState` として後段で合成する。overlay は stone owner、existing/playable/hole、accepted marker、canonical pending outcome を追加・削除できず、visual store/canonical state へ書き戻さない。

original `boardConfig.shape` は model/backend の分岐入力にしない。Phase 2 で `shared/board/topology.ts` の純粋派生 projection を current/render bounds、dense render offset、existing/playable/hole key sets、existing cell ごとの outer/hole boundary edges まで拡張する。void は render bounds 内で existing/hole key がない座標として可視 window 内だけ導出し、無制限拡張に対する巨大 `voidKeys` set は作らない。browser/headless/Worker で再構築可能な同じ projection を model-builder が消費し、contour、hit area、拡張・縮小表示をその情報だけから作る。shape ID が diagnostics に必要な場合も style/behavior には使用しない。

### 5.3 BoardVisualController と backend port

`ui/board-visual/controller.ts` が active backend と Single Visual Writer state を所有する。

controller の mode は board-writer の内部 substate だけである。global busy、input lock、selection settlement、queue claim の正本は既存 `ui/playback-state-manager.ts` のままとし、controller は独自 busy/input authority を作らない。

```ts
type BoardWriterMode = 'idle' | 'playback' | 'awaiting-frame-commit' | 'recovering' | 'destroyed';

interface BoardVisualBackend {
  readonly kind: 'dom' | 'pixi';
  mount(host: HTMLElement, deps: BoardVisualBackendDeps): Promise<void>;
  applyFrame(frame: BoardVisualFrame): void;
  playPhase(events: readonly PresentationEvent[], context: BoardPlaybackContext): Promise<void>;
  getCellClientRect(row: number, col: number): BoardClientRect | null;
  resize(layout: BoardViewportLayout): void;
  restore(frame: BoardVisualFrame): Promise<void>;
  destroy(): void;
}
```

controller の規則:

1. backend は bootstrap 時に一つだけ mount する。DOM/Pixi の同時 mount・同時描画は禁止する。
2. `idle` の `applyFrame()` は最新 model/layout/appearance/theme を一つの frame として即時反映する。
3. `playback` 中に同じ presentation frame 境界から来た冗長な visual frame は一件の pending latest frame として保持し、backend へ渡さない。
4. phase planner が既存順序で `playPhase()` を await する。
5. local playback は全 phase 完了後に local display state と overlay から model を一度適用し、`idle` に戻る。
6. network playback は全 phase 完了時点の Pixi event 最終表示を保持して `awaiting-frame-commit` へ移り、`dispatchFrame()` を返す。`presentation-timeline.ts` が `visualStateStore.commitFrame()` した後、必須 `applyCommittedFrame` hook が committed visual state と overlay から model を作って一度適用する。hook 成功後にだけ `visualSettlementTracker.markVisualSeqCompleted()` を呼び、通知 observer、writer release、manager finalize を終えてから `idle`/次 frame へ進む。
7. renderer failure を animation success として扱わない。recovery または既存 playback error path へ移る。

一つの run/frame token に対する local 順序は `PlaybackStateManager.begin/claim → BoardVisualController.claimWriter → phase dispatch → local final sync → controller.releaseWriter → PlaybackStateManager.finalize` とする。network は `begin/claim → claimWriter → phase dispatch → visual-store commit → required committed-frame sync → markVisualSeqCompleted → notification observer → controller.releaseWriter → manager.finalize` とする。observer は best-effort であり完了通知を逆転させない。recovery 中は manager claim/busy を維持する。復旧不能時は manager が paused/error settlement を記録して input lock/error surface を保持した後に writer resource を解放し、controller が先に input を開けない。selection settlement lock を保持したまま playback idle を await する経路は作らない。

現行 `ui/presentation-handler.ts` の `finally` release を strict-network 成功時には実行しない。`ui/network/playback-dispatcher.ts` が opaque な settlement handle を timeline へ返し、timeline が上記 commit handshake 完了後に一度だけ release/finalize する。dispatch/handle handoff 前の失敗と local playback は presentation handler 側で解放する。所有者と release 場所が同時に一つになる typed contract とし、context recovery や hook retry でも handle を二重解放しない。

network の別々の accepted presentation frame は pending latest に潰さない。`presentation-timeline.ts` が frame を順番に保持し、各 frame の再生開始時に対応する visual state/model を controller へ渡す。controller の coalescing は一つの active frame 内の重複 render request にだけ適用する。

`applyCommittedFrame` は best-effort observer ではなく timeline の必須 settlement hook とする。hook failure は timeline を pause し input lock/writer/manager claim を維持する。event 自体と visual-store commit は完了済みなので event を再発火せず、committed store から model apply を retry する。成功するまで `visualSettlementTracker.markVisualSeqCompleted()` を呼ばず、selection waiter を解放しない。既存の通知用 `onFrameCommitted` callback は、必須 hook と tracker 完了の後に実行する。

全 commit 経路でこの handshake を保証するため、現行の同期 `markFramePlayed()` は廃止するか `Promise<boolean>` に変え、`drainPlayableFrames()` と同じ `commitFrame()` →必須 `applyCommittedFrame` → `markVisualSeqCompleted` → observer の await 経路だけを使う。fire-and-forget で commit 済みにする公開 API は残さない。

controller は `ready: Promise<void>` を公開する。bootstrap は DOM discovery 後に mount を開始し、初期 model と必須 texture の表示完了を await してから board input、network activation、app-ready signal を有効にする。準備中に届いた render request は一件の initial model として保持し、空 canvas を interactive にしない。

移行中の `DomBoardVisualBackend` は既存 `diff-renderer` と DOM animation を包む adapter である。最終形の `PixiBoardVisualBackend` は同じ port を実装する。これにより上位の `render-scheduler.ts`、`playback-engine.ts`、network reconciliation が backend 種別を判定しない。

### 5.4 presentation orchestration

`ui/animation-engine.ts` の責務を、順序制御と描画実装に分離する。

- `ui/presentation/phase-planner.ts`: 現在の phase grouping・直列/並列条件を純粋ロジックとして保持する。
- `ui/presentation/visual-seed.ts`: event metadata から presentation-only の決定的 seed を作る。
- `ui/presentation/dispatcher.ts`: sound、log、round banner、DOM hand/card overlay、board event を既存順で dispatch する。
- `ui/board-visual/dom-playback.ts`: 現行 `AnimationEngine` から抽出した DOM board event executor。移行/compatibility backend 専用。
- `BoardVisualBackend.playPhase()`: 盤面ピクセルを変更する event だけを処理する。

`DomBoardVisualBackend.playPhase()` は `dom-playback.ts` を一方向に呼ぶ。`dom-playback.ts` は `AnimationEngine`、dispatcher、controller を import/call back せず、event executor が循環しないようにする。

既存 `AnimationEngine.play(events)` の公開契約は移行期間中維持し、内部で新 dispatcher/controller を使う。`playback-engine.ts` の queue、busy lock、network strict playback は書き換えない。

現行の event-count cap 超過時に board update だけを要求して成功 return する分岐は移植しない。cap は warning/diagnostics にだけ使い、planner は全 event を正本順で処理する。renderer/resource failure は typed playback error として timeline を pause し、全 event を再生したように見せない。旧 cap を超える strict-network fixture で全 event completion を検証する。

同じ event が DOM と盤面の両方を使う場合は dispatcher が順序を所有する。例えば手札から盤面への飛翔は DOM overlay が `getCellClientRect()` で終点を求め、着地後の石生成を board backend に await する。DOM overlay は石・セルの最終表示を書かないため、第二の board writer にはならない。

particle 等に visual randomness が必要な場合は、`visualSeq`、`sequenceIndex`、`actionId`、`effectBlockId`、effect kind、target coordinate の安定 tuple から UI 専用 PRNG seed を作る。network metadata がない local batch は dispatcher が ordered batch index から決定的 `presentationBatchId` を付ける。canonical/game RNG と `Math.random()` は使用せず、random 不要の effect は固定 pattern を優先する。

### 5.5 Pixi Application と scene graph

`ui/pixi/board-backend.ts` が一つの `Application` と canvas を `#board` に mount する。初期値は次で固定する。

```ts
{
  preference: 'webgl',
  autoStart: false,
  sharedTicker: false,
  autoDensity: true,
  resolution: Math.min(window.devicePixelRatio || 1, 2),
  antialias: true,
  backgroundAlpha: 0
}
```

controller は `#board` に `data-board-renderer="dom" | "pixi"` を設定する。Pixi 選択時の CSS は host の旧盤面 surface/grid/pseudo-element を無効化し、canvas だけが盤面 pixel を描く。`#board-frame` の装飾背景と layout は無効化しない。

`resizeTo` は使わず、`ResizeObserver`、`visualViewport`、既存の盤面 pixel sizing policy から `BoardViewportLayout` と `BoardCameraState` を明示計算する。盤面全体と同じ大きさの WebGL backbuffer は作らない。

`#board` 内部は次の三層にする。

1. `#board-scroll-viewport`: 利用可能な layout 範囲まで広がり、それを超える logical board を scroll する。
2. `#board-scroll-surface`: topology render bounds と固定 cell size から論理幅・高さだけを持つ DOM spacer。セル DOM は作らない。
3. Pixi canvas/accessibility overlay: scroll viewport の可視範囲に固定し、camera scroll offset から visible cells と overscan だけを描く。

canvas backing store は `visible viewport + effect gutter` に固定し、盤面拡張回数に比例して増やさない。scene materializer は `BoardVisualFrame.model.topology + layout.camera` から可視セルに前後1セルの object overscan を加えた world window を決め、sparse `model.cells` を参照して existing/hole view を、キー不在箇所に ephemeral void view を作る。範囲外の cell view は pool へ戻す。model/topology は全 existing/hole world coordinates を sparse に保持するため、virtualization は gameplay state や合法性を省略しない。

上・左へ bounds が伸びたときは、追加列/行の physical size 分だけ logical origin と `scrollLeft`/`scrollTop` を同一 frame で補正する。下・右では既存 origin を変えない。四方向すべてで、拡張前から存在した任意セルの `getCellClientRect()` は拡張直前・直後で同一とする。cell size は対局開始時の値を維持する。

scene graph の固定順序:

1. `surfaceLayer`: 盤面表面 texture と輪郭
2. `cellLayer`: playable/hole/void、罫線、拡張境界
3. `markerLayer`: 盤面番号・固定 marker
4. `stoneLayer`: 通常石・特殊石・timer/badge
5. `hintLayer`: 合法手、選択、対象、preview、keyboard cursor
6. `playbackLayer`: flip ghost、move ghost、destroy fragment 等
7. `effectLayer`: glow、lightning、particle 等の盤面内 FX
8. `interactionLayer`: 透明 hit area。見た目を持たず input event だけを発行する

可視 world coordinate key ごとに container を保持し、model signature が変わったセルだけ更新する。一時オブジェクトは event 種別ごとの pool を使い、完了時に reset/release する。石ごとの重い filter 常用は避け、sprite、tint、blend、短命 overlay を優先する。

盤外へはみ出す board-local effect のため、`ui/board-visual/effect-bounds.ts` に effect family ごとの最大 visual extent を cell 比率で定義する。canvas は可視範囲の各辺に最大2セル分の effect gutter を持つ。2セルを超える全画面/DOM UI 横断 effect は既存 `#card-fx-layer`/global presenter に route し、stone/cell の最終 pixel は書かない。四隅・四辺の glow、bubble、beam、particle、destroy fragment を fixture 化し、gutter 内で切れないことを確認する。

通常時は `applyFrame()`、skin decode 完了、resize のときだけ `renderer.render()` を呼ぶ。アニメーション中だけ private ticker を開始し、最後の frame を render して停止する。idle 中に canonical state を poll しない。

`ui/pixi/timeline.ts` は既存 presentation duration policy と注入 clock を受け取り、各 effect が個別の raw `setTimeout()` を持たないようにする。browser では private ticker の経過時間を、contract test では manual clock を使う。`NOANIM=1` は duration を 0 に正規化するだけで、同じ start/settle/final-sync 経路を通る。

### 5.6 geometry と座標 bridge

`ui/board-visual/layout.ts` が、topology bounds、stable world origin、cell size、frame inset、camera/scroll offset、viewer orientation、`window.visualViewport.{scale,offsetLeft,offsetTop}`、DPR から world ↔ scene ↔ client 座標を計算する。DOM/Pixi の双方が同じ関数を使い、browser zoom/pinch zoom を相殺しない。

公開するのは読み取り専用の次だけとする。

- `worldToScene(row, col)`
- `sceneToWorld(x, y)`
- `getCellClientRect(row, col)`
- `getBoardClientRect()`

DOM 演出、stone info popover、長押し表示、E2E 操作はこの bridge を使う。`getBoundingClientRect()` で `.cell` を探す実装は段階的に廃止する。

scroll、`visualViewport` resize/scroll、browser zoom、pinch zoom は layout revision を進める。同じ event dispatch 内では一つの revision を固定し、座標変換途中に別 revision を混ぜない。

### 5.7 入力

`ui/board-input-controller.ts` に pointer/keyboard 共通の状態機械を置く。

- Pixi `interactionLayer` は `pointerdown`、`pointermove`、`pointerup`、`pointerupoutside`、`pointercancel` を world coordinate と pointer metadata に正規化して controller へ渡す。
- controller は既存の click、hover、long press、pointer move による long-press cancel、方向選択、input lock、spectator 判定を保持する。overflow 時の pan は scroll viewport 操作であり、新しい盤面 gameplay swipe にはしない。
- 最終 action は既存の `handleCellClick(row, col, directionKey)` などの UI handler を呼び、game/network command path を変えない。
- hit test は topology と render model の `interaction` を使う。Pixi が合法手を計算しない。
- playback、pending selection、modal、spectator 中の lock は既存 settlement state から注入し、canvas 内の見た目から推測しない。

`ui/game-keyboard-shortcuts.ts` は DOM cell collection をやめ、controller が提供する合法セル配列と現在カーソルを使う。W/A/S/D の並び順と tie-break は現行の row/col 規則をそのまま移す。カーソル更新は `presentationOverlayState.keyboardCursorKey` の一経路だけを通り、再投影された model から Pixi hint layer に反映する。

### 5.8 DOM accessibility layer

`#board` 内に `ui/board-accessibility-layer.ts` が管理する非表示 semantic layer を一つ置く。

- 方向ヒントごとに現行と同じ `role="button"`、focusability、`aria-label`、activation を提供する。
- semantic button の focus/blur は Pixi hint layer の focus ring を更新し、canvas 自体は `aria-hidden="true"` として同じ操作を二重公開しない。
- 現在選択中のセルや操作不能理由は既存 status/live region を使う。
- layer は盤面の pixel、石、合法手を描かず、canonical state を保持しない。
- pointer 操作は Pixi hit area が所有し、semantic button の pointer interception は方向ヒントの実際の領域に限定する。
- PixiJS accessibility extension と同時に同じ object を公開しない。

この移行で新しい screen-reader board game 仕様は追加しない。現行のキーボード・方向ヒント契約を回帰させないことを完了条件とする。より広い盤面読み上げは別の player-visible/accessibility 設計として扱う。

### 5.9 visual theme、skin、texture lifecycle

既存の `ui/board-skin/catalog.ts`、`ui/stone-skin/catalog.ts`、`ui/custom-skin/storage.ts` を唯一の catalog/storage とする。Pixi 用 catalog を複製しない。

`ui/board-skin/runtime.ts` と `ui/stone-skin/runtime.ts` に、DOM 適用とは独立した appearance descriptor resolver を追加する。Pixi backend は CSS の `url(...)` 文字列を再解析せず、次の descriptor を受け取る。

```ts
interface BoardAppearanceDescriptor {
  boardSkinId: string;
  boardImageUrl: string;
  boardFrameSkinId: string;
  boardFrameLayout: BoardFrameSkinLayout;
  stoneSkinId: string;
  blackStoneImageUrl: string;
  whiteStoneImageUrl: string;
  revision: number;
}
```

装飾フレーム画像自体は DOM `#board-frame` が描画を続ける。frame layout descriptor は canvas inset/scroll geometry と DOM frame の双方が共有する。

`ui/board-visual/frame-presenter.ts` は model topology と appearance だけを受け、`#board-frame` の skin/layout、`board-has-void-cells`、`#game-container` の oversize class を同期する。これは盤面セル/石を書かない layout presenter であり、board visual writer とは分離する。

frame presenter も `BoardVisualController` の settlement に従う。playback 中の通常 model では frame/oversize class を先に更新せず、expansion/shrink event が指定する phase、または final sync で backend layout と同時に更新する。

色、線幅、shadow/glow、hint、timer/badge、board bonus、方向文字、選択 font は `ui/board-visual/theme.ts` の `BoardVisualThemeDescriptor` にまとめる。現行 `styles-board.css` の semantic visual token を CSS custom property へ整理し、UI 境界の theme resolver が `getComputedStyle()` から検証済みの数値・色・font descriptor へ一度だけ変換する。Pixi は `.cell` 等の selector/class を解析しない。

DOM backend と Pixi backend は移行中に同じ theme descriptor を使う。選択 font の変更と `document.fonts.ready` 後に `themeRevision` を進め、Pixi `Text` を再生成/再描画する。timer、board bonus、方向 hint の font family、weight、double-digit sizing、色と shadow を Phase 0 fixture と比較する。time-stop/manifest 等の world modifier は canonical state ではなく presentation layer が theme modifier として合成する。

playback/recovery 中の appearance/theme change は texture/font の準備だけを進め、active phase へ途中適用しない。controller が final/committed model sync を終えるときに latest descriptor を一度だけ原子的に適用する。

texture manager の規則:

- catalog の相対 path は `document.baseURI` に対して一度だけ absolute URL 化し、Vite chunk URL や module URL を基準にしない。`blob:` URL はそのまま扱う。
- URL と用途から安定 key を作り、同一 URL の texture upload を重複させない。
- 新 skin は全必須 texture の decode/upload 完了後に一 frame で差し替える。
- built-in texture の失敗は default texture または procedural board/stone へフォールバックし、空の盤面を成功扱いしない。
- custom Blob URL の失敗はそのセッションだけ default 表示に戻し、保存済み selected skin ID は破壊しない。
- custom skin の保存原本・selected ID は変更しない。upload 用には表示先の最大 physical pixel size と WebGL `MAX_TEXTURE_SIZE` 以下へ縦横比を保って `createImageBitmap`/offscreen canvas で派生 bitmap を作り、巨大原本をそのまま GPU texture にしない。派生 bitmap 生成失敗時だけ default 表示へ戻す。
- skin 更新・削除・match reset・backend destroy で lease を解放し、参照がなくなった texture/base texture を destroy する。
- `ui/custom-skin/storage.ts` の object URL revoke と GPU texture release の順序を controller で調停する。

### 5.10 Vite/classic への配信

`pixi.js: 8.18.1` を通常 dependency として追加する。

Vite lane:

1. `browser-vite/main.ts` が catch 可能な dynamic `import('pixi.js')` を boot promise の先頭で行い、Pixi chunk の preload/load failure でも app boot を続けられるようにする。
2. 成功時だけ既存 `beforeInitialize` 境界で `UIBootstrap.configurePixiRuntime(PIXI)` を呼び、失敗時は capability に unavailable reason を記録して DOM compatibility backend を選ぶ。
3. UI の Pixi modules は注入された namespace を使い、headless/module registry が npm package を runtime `require()` しないようにする。

両 lane とも runtime 注入判定は DOM discovery より前、`Application.init()` は DOM discovery 後に行う。board controller の `ready` が解決するまで network/input を開始しないため、Vite/classic で async initialization order を変えない。runtime load failure は boot 全体の fatal error にせず、fallback selection 前に確定させる。

classic lane:

1. `scripts/prepare-pixi-classic-assets.ts` が npm package 内の production UMD を、生成物 `public/vendor/pixi-8.18.1.min.js` として検証付きでコピーする。
2. `index.classic.html` は app entry より前に local vendor script を読む。
3. bootstrap 境界だけが `window.PIXI` を読み、同じ `configurePixiRuntime()` へ注入する。

`public/vendor/pixi-8.18.1.min.js`、生成済み `index.html`、`vite-dist/`、`worker-public/` を source-edit しない。root script/HTML/TS を変更後、既存 build と `worker:prepare` で生成する。Worker/headless の実行 graph に PixiJS を含めない。

classic と Vite は同じ Pixi backend を使う。classic は browser boot の rollback lane であって、最終的な DOM board renderer lane ではない。

### 5.11 rollout と compatibility fallback

通常時の backend 選択は bootstrap 前に一度だけ行い、同時 mount はしない。現行の WebGL 非対応環境を切り捨てないため、最終形でも DOM backend を isolated compatibility fallback として保持する。

移行中:

- production default は DOM のままにする。
- `?debug=1&boardRenderer=pixi` と test harness injection だけが Pixi lane を選べる。
- Pixi init/asset failure は、最初の board render 前に DOM backend へ戻せる。途中まで両方を mount しない。

cutover release は、証拠と deployment を循環させないため次の3 unitに分ける。

1. pre-cutover evidence: DOM-default の clean candidate commit から DOM/Pixi を排他的に選べる debug harness を配信し、desktop/physical performance、browser、visual、network、lifecycle gate を通す。reference device manifest は計測前に commit し、結果を見た後の端末差し替えを禁止する。raw report と pre-cutover 判定は report-only commit に保存する。
2. default cutover: unit 1 が pass した後、classic/Vite の default selector と必要な生成物だけを一つの isolated commit で Pixi へ切り替え、その commit SHA の immutable artifact を deploy する。WebGL/runtime/initial texture preflight に失敗した場合だけ、最初の board render 前に DOM compatibility backend を mount する。`?debug=1&boardRenderer=dom` は fallback の継続検証用に残し、通常 query では選択できない。
3. post-deploy evidence: unit 2 の deployed commit SHA に対して production smoke、network match、reconnect、主要特殊演出、supported browser bundle を実行し、結果だけを final cutover report commit に保存する。この report commit まで Phase 9 を完了扱いにしない。

unit 2 に selector、cachebuster、機械生成 browser artifact 以外の runtime change が混ざった場合、unit 1 の evidence は無効として再取得する。post-deploy failureがselector/cachebusterだけなら失敗commitをrevertしてreplacement unit 2を作り、runtime修正ならunit 1へ戻る。rollback は最終passしたunit 2のisolated default-selector commitを戻すことで行い、unit 3のreportには失敗attemptを含むdeployment証跡を保持する。

cleanup release:

- Pixi default path から DOM cell query/writer/animation dependency を除き、既存 DOM 実装を `ui/board-dom-compat/` と scoped stylesheet/test suite へ隔離する。
- default Pixi 実行では cell DOM と `#board-expansion-layer` を作らない。DOM fallback が mount された時だけ compatibility subtree を動的に作る。
- classic entry も Pixi default + 同じ DOM compatibility fallback とする。

fallback は WebGL support policy を別の player-visible decision で変更するまで削除しない。新しい board event は Pixi と compatibility executor の双方で同じ event contract を満たす必要があるが、通常 production path は Pixi だけを実行する。

### 5.12 WebGL context loss と lifecycle

- `webglcontextlost` で default action を抑止し、input を lock、presentation を `recovering` にする。
- controller は各 board phase 開始時に pre-phase model、phase events、board visual completion を checkpoint する。
- context restore 後に texture を再取得し、pre-phase model から scene を復元して active board phase を先頭から再生する。dispatcher の sound/log/DOM global effect は再発火せず、board visual だけを `recoveryReplay` として再生する。
- loss が `awaiting-frame-commit` 中なら event は再生せず、timeline commit 後の committed model を復旧した backend へ一度適用する。
- 復旧中の event を完了扱い・skip 扱いにせず、accepted presentation frame を dequeue しない。phase 成功後に通常 queue を再開する。
- 5 秒以内に restore/replay できなければ、controller は `recovering` 中に Pixi を破棄して DOM compatibility backend を一つだけ mount し、同じ pre-phase model/active board phase を DOM executor で再生する。この recovery switch だけを match 中 backend 交換の例外とし、sound/log/DOM global effect は再発火しない。
- DOM fallback も失敗した場合だけ canonical state を変更せず reload-required error と再読み込み操作を表示する。network match は reload/reconnect で authority snapshot から復元する。
- `visibilitychange` や resize で event 順を変えず、`NOANIM` 以外で演出を自動省略しない。
- reset、room leave、page teardown で ticker、ResizeObserver、event listener、pooled object、texture lease、canvas を破棄する。

## 6. テスト可能性と diagnostics

### 6.1 unit/contract test seam

Jest/jsdom で Pixi renderer 全体を偽装しない。unit test は以下を対象とする。

- render model builder の topology、stone、marker、legal/selection/preview 投影
- layout の world/scene/client 座標変換
- input controller の pointer、long press、keyboard、direction、lock
- phase planner と board/global event dispatch 順序
- BoardVisualController の idle/playback/awaiting-frame-commit/pending-latest/recovery state と PlaybackStateManager token ordering
- appearance descriptor、texture lease、failure fallback

Pixi display tree、WebGL context、pixel 結果は real browser test で確認する。必要最小限の fake runtime は init failure や lifecycle contract に限定する。

### 6.2 gated browser diagnostics

`?debug=1` または test harness flag のときだけ、read-only `window.__boardVisualDebug` を公開する。

- `getBackendKind()`
- `getWriterMode()`
- `getVisualFrameDigest()`
- `getRenderedCell(row, col)`
- `getCellClientRect(row, col)`
- `getDisplayObjectCounts()`
- `getTextureLeaseCounts()`
- `waitForIdle()`

Pixi object、mutable model、network token、canonical state の setter は公開しない。通常 play では global 自体を作らない。

既存 E2E は `.cell` query を diagnostics/座標操作へ移す。visual regression は `#board` host を capture し、canvas の安定描画完了を `waitForIdle()` で待つ。classic-vs-Vite は双方を Pixi backend に揃え、比較 tolerance を移行のために緩めない。

## 7. 検証戦略

### 7.1 correctness

- 既存 projection、stone rendering、expansion、legal hint、special effect tests を render model/backend contract test へ移植する。
- `PLACE`、`FLIP`、`DESTROY`、`SPAWN`、`MOVE` と各特殊演出で、event 入力と完了後 model digest を一致させる。
- `NOANIM=1` で最終 visual digest と event settlement を確認する。
- playback 中に通常 render を要求しても backend `applyFrame()` が呼ばれないことを contract test で固定する。
- network late snapshot、move source empty、destroyed source、pending reconcile、reconnect を visual-state-store 経由で確認する。

### 7.2 visual/browser matrix

- Chromium、Firefox、WebKit
- classic、Vite
- DPR 1、2
- 4x4、4x16、16x4、7x7、8x8、16x16
- 円形 6/10/16（6/8/10/12/14/16 の derivation contract も unit test）
- 8x8 の4星、穴、疑似辺、上下左右の拡張前後、多段拡張、負座標
- default/custom board skin、frame skin、stone skin、Blob skin
- local、CPU、network、spectator
- normal animation、`prefers-reduced-motion: reduce`、`NOANIM=1`
- resize、scroll、context loss/restore

baseline 更新は「renderer を変更したため」だけで一括承認しない。盤面形状、石位置、marker、skin、layer order、演出 key frame を scenario ごとにレビューする。

### 7.3 performance gates

performance gate は「再現可能な desktop A/B」と「physical mobile release gate」の二層にする。どちらも DOM/Pixi を同時 mount せず、同一 fixture/event digest を backend 切替ごとに reload して測る。

#### 7.3.1 計測経路と attribution

- `forceFullRender()` 計測は model/apply microbenchmark と明記し、animation frame の代用にしない。
- animation 計測は isolated fixture でも public `PlaybackEngine` → phase planner/dispatcher → `BoardVisualController.playPhase()` 経路を通す。event を直接 backend method へ注入して成功扱いにしない。
- report schema v1 の scenario ID を `basic.multi-flip-8x8`、`heavy.move-8x8`、`heavy.destroy-spawn-8x8`、`heavy.status-8x8`、`heavy.destroy-source-8x8`、`heavy.theory-manifest-8x8`、`micro.full-marker-16x16`、`stability.expansion-skin` に固定する。heavy threshold は各 scenario を個別判定し、sample を混ぜて遅い effect を隠さない。
- board model build、backend apply、board-local playback、global DOM overlay/HUD、whole-turn settlement を別 measure にし、Pixi 改善と残存 DOM/CPU 負荷を混同しない。
- capture は `document.visibilityState === 'visible'`、focus、font/texture/application ready を確認し、最初の120個の連続 idle rAF interval の median を `nominalFrameIntervalMs` とする。途中の visibility/focus change は report 全体を invalid にする。
- 各 scenario は5回の非集計 warm-up 後、basicを30回、各heavyを20回、micro operationを100回測る。p50/p95/p99 は昇順 sample の `ceil(p * N) - 1` を使う nearest-rank とし、raw sample を削除・winsorizeしない。
- requestAnimationFrame interval の p50/p95/p99/max、nominal interval の1.5倍を超える jank frame 比率、`interval >= 50 ms` の `rafStall50msCount`、presentation start latency、display object/texture lease/canvas backing size を保存する。`rafStall50msCount` は全対象 browser の必須 gate とし、Long Animation Frame / Long Task は対応時だけ CPU attribution に使う optional field とする。
- `browserArtifactSha256` は配信対象fileごとの `{ path, sha256 }` をpath昇順にしたUTF-8 stable JSONのSHA-256とし、LAN URLや生成時刻をdigest入力へ含めない。serverとbrowser reportが同じ値を持たなければcaptureを開始しない。
- event の player-visible duration は正本どおり維持し、短縮を性能改善として数えない。

#### 7.3.2 再現可能な desktop gate

- Phase 0 と同じ machine/browser/viewport/DPR で DOM/Pixi の actual playback と microbenchmark を取得する。
- 8x8 basic board-local scenario の Pixi p95 は「観測した nominal frame interval + 1 ms」以内、jank frame 比率は5%以下、`rafStall50msCount === 0` とする。
- DOM p95 が上記 frame target を外す scenario は Pixi p95 が DOM より20%以上短いこと。DOM が既に target 内なら Pixi は DOM より5%を超えて悪化しないこと。
- 16x16/full marker fixture の個々の input hit test と model apply の同期 measure は50 ms未満とする。
- whole-turn p95 と presentation start latency は DOM より5%を超えて悪化せず、board-local 改善を HUD/global effect の追加負荷で相殺しない。

#### 7.3.3 physical mobile release gate

- physical gate は production entry である Vite lane を、計測前に commit 済みの `reference-devices.json` に記録した physical Android Chrome 1台と physical iPhone Safari 1台で実行する。manifest は exact model、OS/build、browser version、screen/viewport、DPR、refresh setting を固定するが、製品全体の最低対応端末を新設するものではない。端末変更は事前レビューと全report再取得を必要とし、結果確認後の差し替えを禁止する。いずれかの reference device を用意できない場合、Phase 9 の default cutover は未達とする。
- desktop emulation、CPU throttling、Playwright WebKit は代替証拠にしない。normal match ではなく clean candidate commit の production-like LAN artifact を `--manual-host 0.0.0.0` で配信し、DOM/Pixiの明示URLを別reloadして debug-only `Run Suite` → `Export JSON` で取得する。export は Web Share file、未対応時は Blob download を使う。report は schema version、UUID `reportId`、candidate commit SHA、browser artifact SHA-256、lane、URL、fixture/event digest、backend、warm-up/raw sample/集計規則を自己完結して含め、Node validatorへ4 fileをimportする。validatorはfile名/本文の`reportId`を照合し、import後のraw file SHA-256をpre-cutover manifestへ保存する。
- 同一端末の DOM/Pixi capture は画面refresh設定、省電力設定、orientationを維持し、各backend前に5分cool-downする。capture orderはcandidate commit SHA末尾byteの偶奇でDOM-first/Pixi-firstを決定してreportへ記録し、手作業で有利な順序を選ばない。
- 8x8 basic scenario は p95 が nominal frame interval の1.25倍以内、jank frame 比率5%以下、`rafStall50msCount === 0` を必須とする。
- 各heavy board-local scenario は p95 が nominal frame interval の2倍以内、max frame interval 100 ms未満、`rafStall50msCount === 0` とする。DOM がこの target を外す場合は Pixi p95 が20%以上短く、DOM がtarget内ならPixiはDOMより5%を超えて悪化しないこと。global DOM effect の時間は別 measure とする。
- 10分間の basic/heavy/skin/expansion loop を実行し、最後の2分のp95/jank比率が最初の2分から20%を超えて悪化せず、context loss、canvas backing growth、display object/texture lease の単調増加を起こさない。
- physical whole-turn p95 と presentation start latency は DOM より5%を超えて悪化しない。残存 jank が HUD、手札、global DOM effect、CPU に帰属する場合は別 follow-up inventory に記録するが、Pixi の責務を全 UI へ拡張しない。

#### 7.3.4 lifecycle / delivery gate

- idle settle 後に ticker/requestAnimationFrame が継続しない。
- 同じ model を100回 applyし、reset 50回、skin切替50回後に display object 数と texture lease 数が初期 steady state へ戻る。
- 多段拡張で logical surface が増えても canvas backing width/height と live cell view 数が viewport + overscan/gutter 上限を超えて増えない。
- WebGL context は一ページ一個で、全画面演出用の第二 Pixi Application を作らない。
- classic/Vite の asset request、transfer、app-ready、texture decode/upload を report に残し、Pixi chunk/vendor と GPU upload 対象 pixel の増分を明示する。

環境依存値は repository 全体の普遍値とせず、raw sample、集計規則、同一 fixture digest、環境情報を JSON report に保存する。gate failure を tolerance 緩和、sample 除外、演出時間短縮で解消してはならず、Pixi default cutover を保留して原因を修正する。

## 8. 失敗モードと対処

| 失敗 | 検出 | 対処 |
| --- | --- | --- |
| Pixi runtime 未注入 | bootstrap preflight | board init 前に DOM compatibility backend へ fallback |
| WebGL init failure | `Application.init()` reject | 最初の board render 前に DOM compatibility backend を単独 mount |
| texture decode/upload failure | texture manager reject/timeout | default/procedural texture へ原子的に fallback、status と diagnostics に記録 |
| context loss | canvas event | input/playback lock、texture reload、phase replay。5秒で失敗時は DOM compatibility backend へ checkpoint recovery |
| playback 中の通常 render | controller state guard | pending latest visual frame に置換し backend へ渡さない。debug は fail-fast |
| event renderer 未実装 | dispatcher capability check | strict playback error。黙って最終状態へ進めない |
| resize/scroll 中の hit mismatch | layout revision mismatch | input を一 frame保留し、layout 更新後に hit test |
| custom skin revoke race | texture lease test | 新 texture ready → swap → old texture release の順を固定 |
| Pixi/DOM 二重入力 | mount invariant | inactive backend の listener/canvas を作らない |
| test が見た目を DOM から推測 | selector inventory check | `.cell`/`.disc` browser test dependency を diagnostic API へ移行 |

## 9. セキュリティ・プライバシー

- PixiJS と vendor asset は npm lockfile と local build output から配信し、CDN/script injection を使わない。
- network seat token、operationId、chat、profile、local storage 全体を Pixi runtime/diagnostics に渡さない。
- custom skin は既存の MIME、size、IndexedDB validation を通った Blob URL だけを受け取る。
- custom texture は decode dimension と WebGL limit を検証し、保存原本を破壊せず表示解像度へ downsample した派生 bitmap だけを GPU upload する。
- texture URL を HTML として解釈せず、catalog/storage の descriptor から asset loader へ渡す。
- debug diagnostics は read-only、明示 flag 限定とし、token や相手の非公開情報を含めない。

## 10. 採用しない案

### 全 UI を PixiJS にする

手札の長文、設定、モーダル、チャット、フォーム、レスポンシブ、フォーカス、読み上げを canvas へ移す利益が小さく、アクセシビリティと保守性が悪化するため採用しない。

### `game/` から PixiJS を直接呼ぶ

headless、CPU、Worker parity と authority/presentation 境界を破るため採用しない。

### DOM と PixiJS を毎 frame 同時更新する

Single Visual Writer を破り、二重 animation/input と network fast-forward の原因になるため採用しない。

### React wrapper や `@pixi/react` を導入する

現在の UI は React 所有ではなく、追加 framework が lifecycle と ownership を複雑化するため、imperative PixiJS v8 を直接注入する。

### WebGPU を先に採用する

production 推奨と cross-browser 安定性の観点から WebGL を使用する。WebGPU 評価は Pixi 移行完了後の別計画とする。

### PixiJS accessibility extension だけに任せる

既存 W/A/S/D、Space、方向ヒント、modal blocking の契約をそのまま表現しにくく、汎用 DOM overlay とゲーム固有 semantic layer が重複するため採用しない。

### WebGL 非対応環境を仕様変更なしで切り捨てる

現行 DOM 版が動く環境を Pixi 移行だけで非対応にするため採用しない。DOM 実装は通常 path から隔離するが、WebGL init/recovery failure 用 compatibility backend として保持する。

## 11. 文書 authority の扱い

本移行は player-visible behavior を変更しないため、着手時点では `01-rulebook.md` と `正本/*.md` を変更しない。実装中に timing、表示、入力、対応ブラウザなどの仕様変更が必要になった場合は、コードより先に該当正本を更新し、別の product decision として扱う。

backend/controller/model の責務が実装と contract test で安定した段階で、`docs/architecture-contracts.md` の「board DOM writer」を「board visual writer」へ一般化し、PixiJS が presentation adapter であること、network visual state と Single Visual Writer の経路を追記する。

## 12. 完了条件

移行は次をすべて満たした時に完了する。

- classic/Vite の通常起動が Pixi backend を一つだけ mount する。
- default Pixi path は `.cell`/`.disc`/`#board-expansion-layer` を生成せず、DOM board writer/animation dependency が `ui/board-dom-compat/` に隔離されている。
- 全盤面種別、skin、入力、keyboard、spectator、`NOANIM` が既存 player-visible contract と一致する。
- 全 presentation event が正本順で再生され、strict network playback と reconnect が最終 visual state を先送りしない。
- DOM hand/card/HUD/global presentation が座標 bridge 経由で Pixi 盤面と整合する。
- supported browser matrix、visual regression、classic-vs-Vite、network parity、Worker mirror、performance gate が通る。
- actual playback の desktop DOM/Pixi A/B と physical Android Chrome / iPhone Safari gate が通り、10分 loop の thermal/lifecycle degradation が許容範囲内である。
- Phase 9のpre-cutover evidence、isolated default-selector deployment、deployed SHAのpost-smoke reportが別unit/commitで完了し、final cutover reportが実際のdeploymentを参照する。
- idle ticker、display object、texture、listener、ResizeObserver、WebGL context の leak がない。
- `docs/architecture-contracts.md`、build scripts、test harness が Pixi default と mutually exclusive DOM compatibility fallback を説明している。

## 13. 自己レビュー

- authority: PixiJS を visual adapter に限定し、network canonical state への直結を禁止した。
- sequencing: existing `events[]` と phase planner を正本として維持し、未実装 event の silent skip を禁止した。
- Single Visual Writer: backend を排他的に mount し、playback 中は visual frame apply を pending latest に留める規則を明文化した。
- browser delivery: Vite と classic の双方に具体的な runtime injection と local vendor 配信経路を定義した。
- accessibility: DOM cell 依存を input model へ移し、方向ヒント semantic layer を残した。
- topology: 円形、穴、拡張、負座標、scroll を render model/layout の必須要素にした。
- lifecycle: texture、Blob URL、context loss、resize、reset、ticker stop を完了条件に含めた。
- compatibility: WebGL init/recovery failure では mutually exclusive DOM backend を使い、今回の移行で対応環境を狭めない。
- scope: カード/HUD/フォームを DOM に残し、第二 Pixi Application と全画面 canvas 化を除外した。
- verification: unit、real browser、network、visual、performance、mirror の gate を分離した。
- performance evidence: synthetic `forceFullRender()` を microbenchmark に限定し、actual public playback、事前固定reference device、全browser共通`rafStall50msCount`、versioned schema/runbook、10分 stability、board/global attribution を release gate に追加した。
- cutover evidence: pre-cutover、isolated default deployment、deployed-SHA reportを3 unitに分け、deployment前のcommitへproduction結果を要求する循環を除いた。

自己レビューでは、旧 performance gate が desktop synthetic apply と実 animation を区別せず、physical mobile と thermal throttling を完了条件にしていない問題に加え、default cutoverとproduction証拠の循環、Safari observer未対応時の判定不能、端末・取得条件の後付け余地を確認した。二層gate、versioned schema/runbook、事前commitするreference-device manifest、raw rAF stall判定、Unit A/B/Cを追加し、Phase 0 baselineを無効化せず解消した。reference device実値はPhase 9開始前にoperatorが提供する外部entry conditionであり、対応端末仕様の変更ではない。実装者に委ねるmaterial architecture choiceは残していない。個別のeasing・particle数・texture atlas化は、既存見た目と性能gateを満たす範囲の局所実装判断であり、authorityや移行範囲を変更しない。
