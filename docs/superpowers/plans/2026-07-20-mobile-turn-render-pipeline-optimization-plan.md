---
status: active
owner: repository-maintainers
scope: mobile-turn-render-pipeline-optimization
created: 2026-07-20
updated: 2026-07-20
---

# スマホ向け手番描画・Pixi静的レイヤー・非表示パネル画像の実装計画

> **実装担当者向け:** 本計画と [設計書](../specs/2026-07-20-mobile-turn-render-pipeline-optimization-design.md) を正本として、Phase順に1 checkout・1 taskずつ実行する。長時間benchmarkや実機温度測定は完了条件に追加しない。

## 1. 文書の役割

**対象:** 同一手番の盤面更新集約、Pixi盤面背景・罫線・数字の静的texture化、空きセルStoneViewの非materialize化、非表示パネル大型画像の遅延読込を、挙動不変で実装する。

**文書の役割:** 設計をsource-of-truthファイル、依存順、検証、commit単位まで落とした実行正本である。

**Source of truth:** プレイヤー可視仕様は `01-rulebook.md`、内部契約は `docs/architecture-contracts.md`、詳細設計は `docs/superpowers/specs/2026-07-20-mobile-turn-render-pipeline-optimization-design.md` に従う。

**Non-goals:** ルール・CPU・network authority・演出時間の変更、DOM互換backendの改修、画像再圧縮、第二canvas/context/ticker、長時間profiling、全visual regression、実機検証の自動化は行わない。

## 2. 完成状態

| 項目 | 完成状態 |
| --- | --- |
| Local writer | 手番中の通常盤面要求はdirty情報だけをmergeし、settlementで最新frameを1回構築・prepare・applyする |
| Strict network | receipt-bound snapshotからcommitted frameを1回だけapplyし、local dirty stateをauthorityにしない |
| Playback | `events[]` とPixi timelineは順序・回数・settlementを維持する |
| Static surface | 背景、セル面、罫線、穴、星、盤面数字をviewport RenderTextureへbakeし、steady stateは1 Spriteとする |
| Stone ownership | 空きセルはStoneViewをstageに持たず、石/stone markerがあるセルだけmaterializeする |
| Object budget | 通常8×8初期fixtureは500未満、満盤面fixtureは1,000未満を目安とする |
| Hidden panel assets | deck-builder、gacha、network、leaderboardの大型画像は初回openまでrequestしない |
| Delivery | classic、Vite、Worker mirrorを同じlazy stylesheet契約で生成する |

## 3. 共通制約

- 各Phase開始・終了時に `git status --short` を実行する。
- unrelatedまたは説明不能なdirty fileがあれば実装を開始せず、ユーザーへ対象pathを報告する。
- branch、tag、worktreeを作らない。
- root TypeScript/CSSを先に変更し、`dist/`、`public/module-registry.js`、`browser-vite/generated/`、`vite-dist/`、`worker-public/` をsourceとして手編集しない。
- `01-rulebook.md`、`正本/*.md`、`docs/HUMAN-DEV-GUIDE.md` を変更しない。必要になった場合は停止する。
- `ui/board-visual/controller.ts` を唯一のfinal board writer入口として維持する。
- playback eventをcoalesce、skip、並べ替えしない。通常final-frame requestだけをまとめる。
- strict-network commit、recovery、NOANIM、context lossをsuccess-shaped fallbackで握り潰さない。
- 既存テストを削除、skip、弱体化しない。期待値変更は設計どおりの構造変更を表すものに限定する。
- 実機検証、長時間benchmark、`npm run test:visual`、cross-platform smoke、長時間selfplayは実行しない。
- 各Phaseはfocused verification後にtask-owned filesだけをcommitする。`git add -A` は使わない。
- browser-visible root変更後の生成はPhase 4で1回にまとめる。

## 4. File map

| 責務 | 主なsource変更候補 | focused evidence |
| --- | --- | --- |
| 更新集約 | `ui/board-renderer.ts`, `ui/render-scheduler.ts`, new `ui/board-visual/invalidation-accumulator.ts` | `test/ui.render-scheduler.test.ts`, `test/ui.board-renderer.single-writer.test.ts`, `test/ui.board-renderer.recovery-contract.test.ts` |
| Writer settlement | `ui/board-visual/controller.ts`, `ui/board-update-sync-runtime.ts`は必要な場合のみ | `test/ui.board-visual-controller-settlement.test.ts`, `test/ui.board-visual-context-recovery.test.ts` |
| Static layer | new `ui/pixi/static-board-layer.ts`, `ui/pixi/board-scene.ts`, `ui/pixi/cell-view.ts` | `test/ui.pixi-board-scene.test.ts`, `test/ui.pixi-cell-view.test.ts` |
| Sparse StoneView | `ui/pixi/board-scene.ts`, `ui/pixi/stone-view.ts`はAPI変更が必要な場合のみ | `test/ui.pixi-board-scene.test.ts`, `test/ui.pixi-board-playback.test.ts` |
| Renderer/context lifecycle | `ui/pixi/board-backend.ts`, `ui/pixi/application.ts`は参照優先 | `test/ui.pixi-board-backend.test.ts`, `test/ui.pixi-context-recovery.test.ts` |
| Effect/topology contract | `ui/board-visual/effect-branch-inventory.ts`は原則参照のみ | `test/ui.board-visual-effect-branch-inventory.test.ts`, `test/ui.pixi-board-playback.test.ts` |
| Feature CSS loader | new `ui/assets/feature-stylesheet-loader.ts` | new `test/ui.feature-stylesheet-loader.test.ts` |
| Deck assets | `styles-layout-controls.css`, new `styles-feature-deck-builder.css`, `ui/deck-builder-controller.ts` | `test/ui.deck-builder-layout-css.test.ts`, `test/ui.deck-builder-controller.test.ts` |
| Gacha assets | `styles-layout-info.css`, new `styles-feature-gacha.css`, `ui/handlers/gacha.ts`またはactual open controller | `test/ui.gacha-typography-css.test.ts`, `test/ui.gacha-handler.test.ts` |
| Network assets | `styles-layout-info.css`, new `styles-feature-network.css`, `ui/handlers/match-mode.ts`配下のactual open owner | `test/ui.match-mode.network-button.test.ts` |
| Leaderboard assets | `ui/handlers/match-mode/leaderboard-styles.ts`, `ui/handlers/match-mode/leaderboard-controller.ts`, existing `styles-leaderboard.css` | `test/ui.match-mode.leaderboard-styles.test.ts`, `test/ui.match-mode.leaderboard-limit.test.ts` |
| Delivery | `scripts/prepare-worker-assets.ts`; generated browser/Worker outputs | `npm run worker:prepare`, generated diff inspection |

実装時にactual ownerが移動している場合は、同じ責務の現行sourceを見つけてこのFile mapを先に更新する。generatedファイルへ直接合わせない。

## 5. 最小検証セット

本計画では、時間を増やす詳細計測ではなく、原因に直結する回数・構造・request境界を確認する。

### Phase内

- 変更箇所のfocused Jestだけを `--runInBand --runTestsByPath` で実行する。
- `git diff --check` を実行する。
- diagnosticsのcounterとobject countをunit fixtureで確認する。

### 最終

- `npm run typecheck`
- `npm run worker:prepare` — `build:vite`、`build:browser`、mirror生成をこの1回へ集約する。
- `node dist/scripts/pixijs-board-playback-browser-check.js` — 直前buildを再実行せず、短い既存playback smokeだけを実行する。
- lazy asset用の短いresource assertion。既存browser smokeへ小さく追加できる場合はそれを使い、専用の長時間harnessを作らない。
- `git diff --check`、task-owned diff、generated/mirror diff、`git status --short` の確認。

Phase内で同じbuildを繰り返さない。focused test失敗が変更と無関係と証明できない場合は、そのPhaseをcommitしない。

---

## Phase 0 — 安全確認とcharacterization

### Task 0.1: checkoutとauthorityを確認する

**Actions:**

1. `git status --short` を実行する。
2. `docs/architecture-contracts.md` の7.3、`ui/board-visual/effect-branch-inventory.ts`、`ui/board-visual/controller.ts`、`ui/pixi/board-backend.ts`、`ui/pixi/board-scene.ts` を再確認する。
3. root sourceとgenerated/mirrorの境界を確認する。
4. 別taskのdirty fileがあれば停止する。

**Completion:** 本計画だけを安全にcommitでき、Single Visual Writerとeffect routingを説明できる。

### Task 0.2: 小さな構造baselineを固定する

**Actions:**

1. 既存fixtureから通常8×8初期盤面を1つ選び、次だけ記録する。
   - `prepareCount`;
   - `committedApplyCount`;
   - `stalePrepareCount`;
   - `displayObjectCount`;
   - `activeViewCount`;
   - `texture lease count`。
2. local writer中に複数 `renderBoard` requestを出す既存testまたは最小fixtureを確認する。
3. 大型画像pathが起動時CSSに直接存在することをfocused検索で確認する。

**Commands:**

- `npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts test/ui.board-renderer.single-writer.test.ts test/ui.board-visual-controller-settlement.test.ts test/ui.pixi-board-scene.test.ts test/ui.pixi-board-backend.test.ts`
- `rg -n "deck-builder-night-manuscript|gacha-observation-bg|gacha-reference-banner|gacha-crystal-cluster|network-lobby-frame" styles-layout-controls.css styles-layout-info.css`

**Completion:** 既存testがPASSし、baselineは数個のcounterだけで説明できる。新しいperf artifactは作らない。

**Commit:** なし。

**Phase 0 gate:** checkoutが安全で、比較対象が再現できる。

---

## Phase 1 — 同一手番のfinal-frameを1回へ集約する

### Task 1.1: invalidation accumulatorを追加する

**Files:**

- Create: `ui/board-visual/invalidation-accumulator.ts`
- Modify: `ui/render-scheduler.ts`
- Test: `test/ui.render-scheduler.test.ts`

**Requirements:**

- accumulatorは完全な `BoardVisualFrame`、game state、DOM nodeを保持しない。
- writer token/generation、dirty count、bounded source/reason集合、消費状態だけを保持する。
- 同じwriterの複数要求をmergeし、異なるwriter tokenを混ぜない。
- idle requestAnimationFrame batchingは既存どおり動く。
- diagnostics disabled時に大量文字列や時刻を蓄積しない。

**Verification:**

- 同一writerの複数要求が1 dirty generationになる。
- consume成功後にclearされる。
- failure/recovery用retainができる。
- `npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts`
- `git diff --check`

### Task 1.2: playback中のframe構築をsettlementまで遅延する

**Files:**

- Modify: `ui/board-renderer.ts`
- Modify if required: `ui/board-update-sync-runtime.ts`
- Test: `test/ui.board-renderer.single-writer.test.ts`
- Test: `test/ui.board-renderer.recovery-contract.test.ts`

**Requirements:**

- active local writer中の通常 `renderBoard()` はframeを作らずdirtyだけをmergeする。
- board-local playbackとglobal DOM playbackは既存経路を通す。
- `settleBoardVisualWriter(token)` は最新frameを1回構築し、`controller.settleLocalWriter(token, finalFrame)` へ直接渡す。
- `settleAutoBoardVisualWriter()` も同じ専用経路を使う。
- final frame構築時にboard update contextとsync contextを一度だけcaptureする。
- presentation commit成功時だけcontextをconsumeする。
- occupancy UIはsettled frame後に1回更新する。

**Verification:**

- local writer中に3回以上requestしてもframe builderがsettlement時に1回だけ呼ばれる。
- `settleLocalWriter` にfinal frameが直接渡される。
- settlement失敗時にdirty/contextが消えない。
- `npx jest --runInBand --runTestsByPath test/ui.board-renderer.single-writer.test.ts test/ui.board-renderer.recovery-contract.test.ts`
- `git diff --check`

### Task 1.3: controllerの回数契約を固定する

**Files:**

- Modify only if required: `ui/board-visual/controller.ts`
- Modify diagnostics as needed: `ui/board-visual/diagnostics.ts`
- Test: `test/ui.board-visual-controller-settlement.test.ts`
- Test: `test/ui.board-visual-context-recovery.test.ts`

**Requirements:**

- `settleLocalWriter(token, finalFrame)` が1回prepare、1回apply、1回commitになることを固定する。
- strict-network `applyCommittedFrame()` は変更しない。
- mount/recovery/replaceBackendのpending frame契約は残す。
- normal local settlementとrecovery/cancelによるstale preparationをdiagnostics上で区別する。

**Verification:**

- `npx jest --runInBand --runTestsByPath test/ui.board-visual-controller-settlement.test.ts test/ui.board-visual-context-recovery.test.ts`
- local normal fixtureで `stalePrepareCount === 0`。
- strict network、NOANIM、failure recoveryの既存expectationがPASSする。
- `git diff --check`

**Commit:** Task 1.1～1.3のtask-owned source/testだけをcommitする。例: `Batch final board updates per writer`

**Phase 1 gate:** local writerの中間requestがframe/prepare/applyを発生させず、final同期が1回だけ成功する。

---

## Phase 2 — 盤面静的面を1 textureへ統合する

### Task 2.1: cell drawingをpure painterとして再利用可能にする

**Files:**

- Modify: `ui/pixi/cell-view.ts`
- Create if separation is clearer: `ui/pixi/static-board-painter.ts`
- Test: `test/ui.pixi-cell-view.test.ts`

**Requirements:**

- 現在のsurface、texture、hole、inner edge、grid、star、board bonus number、surface markerの見た目をpure draw functionへ分離する。
- painterはgame state、DOM、sound、timer、networkを読まない。
- `cell.surfaceSignature` とtheme/layout/contextだけから決定的に描画する。
- `cell-view.ts` の共通Pixi helperはstone/hintのために維持する。
- このTaskだけではscene ownershipを切り替えない。

**Verification:**

- 既存cell view fixtureのdiagnostic内容と描画primitiveが維持される。
- `npx jest --runInBand --runTestsByPath test/ui.pixi-cell-view.test.ts`
- `git diff --check`

### Task 2.2: StaticBoardLayerを実装する

**Files:**

- Create: `ui/pixi/static-board-layer.ts`
- Modify: `ui/pixi/board-scene.ts`
- Modify: `ui/pixi/board-backend.ts`
- Test: `test/ui.pixi-board-scene.test.ts`
- Test: `test/ui.pixi-board-backend.test.ts`

**Requirements:**

- scene作成時に、既存applicationのrendererをStaticBoardLayerへinjectする。
- 新しいrenderer/application/canvas/contextを作らない。
- visible world window + overscanだけを一時sourceへ描画する。
- RenderTextureのresolutionは既存DPR capに従い、effect gutterを含めない。
- bake後の一時Graphics/Text/containerをdestroyし、stageにはstatic Spriteだけを残す。
- surface signatureが同じframeではrebakeしない。
- stone/interactionだけの変更ではrebakeしない。
- resize、scroll、DPR、fontReady、theme、appearance、surface texture、topology、surface marker変更でinvalidateする。
- backend destroy、replace、context lossでRenderTextureを確実に破棄する。

**Diagnostics:**

- `staticBakeCount`;
- `staticBakeSkipCount`;
- `staticTexturePhysicalWidth/Height`;
- `staticAttachedObjectCount`;
- `staticTemporaryObjectCount` はsettlement後0;
- `staticSurfaceSignature` はdebug向けdigestまたは短いrevision。

**Verification:**

- 64セルと拡張viewportでstatic attached object countがセル数に比例しない。
- 同じsurface + stone changeではbake countが増えない。
- font/layout/topology changeでは1回増える。
- RenderTextureのphysical boundsがvisible viewport由来である。
- `npx jest --runInBand --runTestsByPath test/ui.pixi-board-scene.test.ts test/ui.pixi-board-backend.test.ts`
- `git diff --check`

### Task 2.3: StoneViewをsparse materializeする

**Files:**

- Modify: `ui/pixi/board-scene.ts`
- Modify only if required: `ui/pixi/stone-view.ts`
- Test: `test/ui.pixi-board-scene.test.ts`
- Test: `test/ui.pixi-board-playback.test.ts`

**Requirements:**

- 一体の `RetainedCellViews` poolをHint/InteractionとStoneの別pool/mapへ分離する。
- `hasPixiStoneVisual(cell)` がfalseのセルはStoneViewをstageに持たない。
- stone出現、消滅、移動、spawn、destroy、ghost、override、hideで必要なviewをacquire/releaseする。
- pooled viewはstageから外し、playback leaseを残さない。
- empty cell diagnosticsのためだけにStoneViewを生成しない。
- `getRenderedCell()` の診断意味は維持する。

**Verification:**

- 初期4石fixtureではactive StoneViewが4前後である。
- stone追加/削除でactive/pool countが正しく変わる。
- playback ghost/override後にleaseとviewがreleaseされる。
- `npx jest --runInBand --runTestsByPath test/ui.pixi-board-scene.test.ts test/ui.pixi-board-playback.test.ts`
- `git diff --check`

### Task 2.4: topology patchとcontext recoveryを接続する

**Files:**

- Modify: `ui/pixi/static-board-layer.ts`
- Modify: `ui/pixi/board-scene.ts`
- Modify if required: `ui/pixi/board-backend.ts`
- Test: `test/ui.pixi-board-playback.test.ts`
- Test: `test/ui.pixi-context-recovery.test.ts`
- Test: `test/ui.board-visual-context-recovery.test.ts`

**Requirements:**

- added topology keysをtemporary patchとして既存reveal alphaへ接続する。
- reveal完了時に完成textureへpromoteし、patchをdestroyする。
- NOANIMは即時promoteする。
- shrink/holeは既存playback old/new geometry契約を維持する。
- context loss時はdead RenderTextureとpatchを破棄し、checkpoint/phase replayから復元する。
- effect branch inventoryのroute/finalPixelWriterを変えない。

**Verification:**

- reveal中だけpatch countが正数、settlement後0になる。
- NOANIMはpatchを残さない。
- context restore後にstatic texture generationが更新され、旧textureを参照しない。
- `npx jest --runInBand --runTestsByPath test/ui.pixi-board-playback.test.ts test/ui.pixi-context-recovery.test.ts test/ui.board-visual-context-recovery.test.ts test/ui.board-visual-effect-branch-inventory.test.ts`
- `git diff --check`

### Task 2.5: object budgetを固定する

**Files:**

- Modify: `test/ui.pixi-board-scene.test.ts`
- Modify diagnostics only if needed: `ui/pixi/board-scene.ts`, `ui/pixi/board-backend.ts`

**Requirements:**

- 通常8×8初期fixtureで `displayObjectCount < 500` を確認する。
- 通常8×8満盤面fixtureで `displayObjectCount < 1000` を確認する。
- 数字あり/なしでstatic attached object countが変わらないことを確認する。
- count目標だけのために見た目要素やaccessibility/inputを削除しない。

**Verification:**

- `npx jest --runInBand --runTestsByPath test/ui.pixi-board-scene.test.ts test/ui.pixi-board-backend.test.ts`
- `git diff --check`

**Commit:** Task 2.1～2.5のtask-owned source/testだけをcommitする。途中でコンパイル不能な分割commitを作らない。例: `Bake static Pixi board surfaces`

**Phase 2 gate:** steady stateの静的面が1 Spriteで、空きセルStoneViewがなく、topology/recovery契約がPASSする。

---

## Phase 3 — 非表示パネルの大型画像を初回openまで遅延する

### Task 3.1: 共通feature stylesheet loaderを追加する

**Files:**

- Create: `ui/assets/feature-stylesheet-loader.ts`
- Create: `test/ui.feature-stylesheet-loader.test.ts`

**Requirements:**

- groupは `deck-builder`、`gacha`、`network`、`leaderboard` の閉集合とする。
- groupからstylesheet pathへの対応を1か所だけに置く。
- 未要求groupのlinkをboot時に作らない。
- 同時要求を1 Promiseへdedupeする。
- successful linkは再利用する。
- failure時はlink/cacheをclearし、次回retryする。
- module-registryのstartup versionをqueryへ引き継ぐ。
- failureはwarningを返すが、呼出側がfallback panelを開ける結果型にする。

**Verification:**

- before ensure: link 0;
- concurrent ensure: link 1;
- success retry:追加なし;
- failure retry:古いlink除去後に新link 1;
- version queryとbase URI解決;
- `npx jest --runInBand --runTestsByPath test/ui.feature-stylesheet-loader.test.ts`
- `git diff --check`

### Task 3.2: deck/gacha/network画像URLをfeature CSSへ移す

**Files:**

- Create: `styles-feature-deck-builder.css`
- Create: `styles-feature-gacha.css`
- Create: `styles-feature-network.css`
- Modify: `styles-layout-controls.css`
- Modify: `styles-layout-info.css`
- Modify: `ui/deck-builder-controller.ts`
- Modify: `ui/handlers/gacha.ts`またはactual open owner
- Modify: `ui/handlers/match-mode.ts`配下のactual network open owner
- Test: `test/ui.deck-builder-layout-css.test.ts`
- Test: `test/ui.deck-builder-controller.test.ts`
- Test: `test/ui.gacha-typography-css.test.ts`
- Test: `test/ui.gacha-handler.test.ts`
- Test: `test/ui.match-mode.network-button.test.ts`

**Requirements:**

- startup CSSから対象大型画像のliteral `url(...)` を除去する。
- startup CSSは同じlayout、gradient、color fallbackを保持する。
- feature CSSはCSS custom propertyへ画像URLを与えるだけにし、layoutを二重所有しない。
- actual open intentが確定した時点でloaderを非blockingに呼ぶ。
- close/reopenでlinkを削除しない。
- image load失敗でもopenと操作を妨げない。

**Target paths:**

- `assets/images/ui/deck-builder-night-manuscript-texture.png`
- `assets/images/ui/deck-atelier-observatory.png`
- `assets/images/other/gacha-observation-bg-v1.png`
- `assets/images/other/gacha-reference-banner.png`
- `assets/images/other/gacha-crystal-cluster-v1.png`
- `assets/images/other/network-lobby-frame-v1.png`

**Verification:**

- `rg`で対象URLがfeature CSSにだけ存在する。
- controller testでboot時にensureされず、open時に1回ensureされる。
- `npx jest --runInBand --runTestsByPath test/ui.deck-builder-layout-css.test.ts test/ui.deck-builder-controller.test.ts test/ui.gacha-typography-css.test.ts test/ui.gacha-handler.test.ts test/ui.match-mode.network-button.test.ts`
- `git diff --check`

### Task 3.3: leaderboard CSSをscaffold時ではなく初回open時に読む

**Files:**

- Modify: `ui/handlers/match-mode/leaderboard-styles.ts`
- Modify: `ui/handlers/match-mode/leaderboard-controller.ts`
- Keep asset owner: `styles-leaderboard.css`
- Test: `test/ui.match-mode.leaderboard-styles.test.ts`
- Test: `test/ui.match-mode.leaderboard-limit.test.ts`

**Requirements:**

- controller作成/bind/scaffoldだけではstylesheet linkを追加しない。
- leaderboardを開く直前に共通loaderを呼ぶ。
- result overlayなど別のopen入口も同じgroupをensureする。
- stylesheet failureでも基本overlayとデータ表示を開ける。
- stylesheet内のleaderboard asset URLsは別manifestへ複製しない。

**Verification:**

- boot/bind後link 0、初回open後link 1、再open後link 1。
- leaderboard fetch/load groupの既存lazy contractを維持する。
- `npx jest --runInBand --runTestsByPath test/ui.match-mode.leaderboard-styles.test.ts test/ui.match-mode.leaderboard-limit.test.ts test/ui.leaderboard-modal-title.test.ts`
- `git diff --check`

### Task 3.4: deploy asset listへlazy CSSを追加する

**Files:**

- Modify: `scripts/prepare-worker-assets.ts`
- Modify only if existing test requires: matching script test

**Requirements:**

- 新しい3 CSSをWorker asset mirror対象へ追加する。
- indexのstartup stylesheet一覧へ追加しない。
- source URL caseと実ファイルcaseを一致させる。
- generated mirrorはPhase 4まで作らない。

**Verification:**

- asset file existence/caseのfocused testまたはscript source inspection。
- `git diff --check`

**Commit:** Task 3.1～3.4のroot source/test/CSSだけをcommitする。例: `Lazy-load hidden panel artwork`

**Phase 3 gate:** boot pathに大型画像URLの適用がなく、各初回openだけがfeature stylesheetを要求する。

---

## Phase 4 — 一度だけbuildし、短い統合確認を行う

### Task 4.1: focused regressionをまとめて再実行する

**Commands:**

- `npx jest --runInBand --runTestsByPath test/ui.render-scheduler.test.ts test/ui.board-renderer.single-writer.test.ts test/ui.board-visual-controller-settlement.test.ts test/ui.pixi-board-scene.test.ts test/ui.pixi-board-backend.test.ts test/ui.pixi-board-playback.test.ts test/ui.pixi-context-recovery.test.ts test/ui.feature-stylesheet-loader.test.ts test/ui.deck-builder-controller.test.ts test/ui.gacha-handler.test.ts test/ui.match-mode.network-button.test.ts test/ui.match-mode.leaderboard-styles.test.ts`
- `npm run typecheck`

**Completion:** 変更範囲のwriter、scene、recovery、lazy CSS契約がPASSする。全Jestは実行しない。

### Task 4.2: browserとWorker mirrorを1回だけ生成する

**Command:**

- `npm run worker:prepare`

このcommandに含まれる `build:vite`、`build:browser`、`build:ts` を別に事前実行しない。失敗時はsourceを修正してから1回だけ再実行し、初回失敗と理由を報告する。

**Inspection:**

- `public/module-registry.js` とVite bundleがroot sourceから生成されている。
- 新しいlazy CSSがstartup stylesheet metadataへ混入していない。
- `worker-public/` に新しいlazy CSSが存在する。
- generated diffに無関係なassetや削除がない。

### Task 4.3: 短いbrowser smokeだけを行う

**Commands/Actions:**

1. `node dist/scripts/pixijs-board-playback-browser-check.js` を実行する。
2. 既存の短いbrowser control smokeまたは1回限りのPlaywright assertionで次を確認する。
   - CPU Lv1戦で人間1手 + CPU1手がsettleする;
   - 1 local writerのfinal prepare/applyが各1回;
   - normal pathのstale prepareが0;
   - initial 8×8 display object countが500未満;
   - deck/gacha/network/leaderboard画像は各panel open前にresource entryへ現れず、初回open後に現れる。
3. screenshot比較、長時間loop、温度計測は行わない。

**Completion:** operation count、object count、resource boundaryが短い1 scenarioで一致する。

### Task 4.4: 最終diffと計画状態を確定する

**Files:**

- Update: `docs/superpowers/plans/2026-07-20-mobile-turn-render-pipeline-optimization-plan.md`
- Update: `docs/superpowers/plans/README.md`
- Update design status only if implementation is complete: `docs/superpowers/specs/2026-07-20-mobile-turn-render-pipeline-optimization-design.md`

**Actions:**

1. 実行したcommands、PASS/FAIL、object counts、writer counts、lazy resource assertionを本計画の実行状態へ短く追記する。
2. 実機検証を未実施のまま構造的完了と区別して記載する。
3. `git diff --check` を実行する。
4. `git status --short` とtask-owned diffを確認する。
5. generated/mirrorを含む最終unitをstageし、commitする。例: `Build optimized browser assets`

**Phase 4 gate:** source、generated browser、Worker mirror、focused tests、短いbrowser smokeが揃い、未実施なのはユーザー環境の実機感触確認だけである。

---

## Phase 5 — ユーザー実機確認への引き継ぎ

実装側のcommitを止めるgateにはしない。ユーザーには次の3点だけを確認してもらう。

1. スマホでCPU Lv1戦を数分プレイし、手を動かした時の追従と石の演出順を見る。
2. 従来と同程度の時間で、本体の発熱が軽くなったかを見る。
3. デッキ構築、観測ガチャ、ネット対戦、ランキングを各1回開き、最初はfallbackから装飾へ切り替わっても操作不能にならないことを見る。

問題報告には端末名、OS/browser、発生した画面、操作直前のカード/手番だけあればよい。詳細profilingの採取を最初から要求しない。

## 6. 計画自己レビュー

### 依存順

- Phase 1で不要なframe workを止めてから、Phase 2で1回あたりのscene workを小さくするため、原因の切り分けができる。
- StaticBoardLayerの導入前にpure painterを分離し、導入後にsparse StoneView、topology/recoveryを接続するため、破壊範囲が段階的である。
- lazy CSSは盤面runtimeと独立してPhase 3で実装できるが、同一checkout並行禁止のため順次実行する。
- browser/Worker生成をPhase 4の1回にまとめ、ユーザー要望どおり検証時間を抑えている。

### 境界確認

- game/CPU/network authorityへ変更を入れない。
- playback eventをまとめず、final canonical syncだけをまとめる。
- StaticBoardLayerは既存rendererを注入されるscene内部所有物で、第二application/contextではない。
- topology revealとcontext recoveryを独立Taskにして、静的化で最も壊れやすい経路を見落としていない。
- feature CSSはroot CSSから画像URL ownershipを移すため、optional JSだけの表面的な遅延にならない。

### 検証量

- testはwriter回数、object graph、recovery、lazy linkへ限定した。
- final buildは `worker:prepare` の1回へ集約した。
- browserはLv1の1往復とpanel resource assertionだけで、長時間測定や全visual suiteを含めない。
- 実機温度はユーザー確認へ明示的に引き継ぐが、構造的完了条件を曖昧にしない。

### Stop conditions

次の場合は実装を止め、ユーザーへ判断を求める。

- 演出順、表示内容、入力settlementを変えなければ目標を達成できない。
- static textureが既存端末上限に収まらず、見た目またはeffect gutterの変更が必要になる。
- lazy image化によりpanelを同期的に待たせる製品判断が必要になる。
- unrelated dirty fileと変更対象が重なり、安全に分離できない。
- focused recovery/network testが既存authority契約との設計衝突を示す。
