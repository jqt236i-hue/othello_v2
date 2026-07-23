# UX保持ランタイム最適化・完全監視 実装計画

## 文書の役割

- 役割: [UX保持ランタイム最適化・完全監視 設計書](ux-preserving-runtime-optimization-observability-design.md)を実装するための順序、変更境界、検証、完了条件
- 設計正本: `docs/implementation/ux-preserving-runtime-optimization-observability-design.md`
- 内部契約: `docs/architecture-contracts.md` §4、§7.3、§11、§12
- プレイヤー向け仕様: `01-rulebook.md`
- 対象: 7最適化、5つのlazy feature単位、capture/validator/CI監視
- 非目標: ゲームルール、カード効果、盤面演出順、network authority、CPU policy、selfplay/training

## 実行原則

1. 各単位の開始時に `git status --short` を確認し、関連しない変更があれば作業を止める。
2. root sourceと仕様を先に変更し、生成物や `worker-public/` を直接編集しない。
3. 各最適化は、baseline、監視check、実装、focused verification、browser capture、commitを一単位で完了する。
4. 実測値を通すために演出、イベント、テスト、判定閾値を弱めない。
5. raw report、trace、screenshotは `artifacts/ux-optimization-monitor/` に出し、コミットしない。
6. browser-visible root変更後は `npm run build:browser`、Vite配信変更を含む場合は包含する `npm run build:vite` を実行する。
7. static asset/CSSを変更した単位は `npm run worker:prepare` とmirror checkを実行する。
8. 各単位のdone条件を満たしたらtask-ownedファイルだけをstageし、小さなcommitを作る。

## Phase 0: 監視基盤と最適化前baseline

### Step 0.1: 共通monitor contractを実装

- outcome: 全scenario、schema、phase、gate、profile、denylistを一つの正本から参照できる。
- canonical components:
  - 新規 `scripts/perf/ux-optimization-monitor-contract.ts`
  - 新規 `scripts/perf/validate-ux-optimization-monitor.ts`
  - 新規 `test/scripts.ux-optimization-monitor-contract.test.ts`
  - 新規 `test/scripts.ux-optimization-monitor-validator.test.ts`
- required behavior:
  - schema versionを `ux_preserving_runtime_optimization_report.v1` に固定する。
  - verdictは `pass | fail | unsupported | not-applicable` だけを許可する。
  - blocking checkのunsupported/not-applicableをoverall passにしない。物理端末専用checkだけnot-applicableを許可する。
  - nearest-rank percentileをraw sampleからvalidatorが再計算する。
  - reportを再帰走査し、`board`, `hand`, `hands`, `cardState`, `gameState`, `seatToken`, `operationId`, `snapshot`, `action` を拒否する。
  - static resource pathはquery/hashを除く同一origin allowlistだけを受理する。
  - candidate commit、dirty state、artifact digest、fixture/scenario digest、environment、visibility/focusを必須にする。
  - baseline/candidateの各artifact digestが各自のcommit配信物に一致することを個別に検証する。両artifact digestの相互一致は要求せず、fixture/scenario digestと実行環境/profile/capture policyの一致を比較互換性条件にする。
- verification:
  - schema欠落、未知verdict、自己申告pass改ざん、forbidden key、異なるenvironment比較がfailになるunit test
  - percentile、phase ordering、optional physical not-applicableのunit test
- done: validatorがcapture側の集計や自己申告を信用せず、許可された生データからoverall verdictを決定できる。

### Step 0.2: capture orchestratorと共通browser probeを実装

- outcome: 既存harnessを再利用し、全scenarioを同じidentityとphase clockで取得できる。
- canonical components:
  - 新規 `scripts/perf/capture-ux-optimization-monitor.ts`
  - 新規 `scripts/perf/ux-optimization-browser-probe.ts`
  - 既存 `scripts/browser-performance-environment.ts`
  - 既存 `ui/board-visual/performance-harness.ts`
  - `package.json`
  - 新規 `test/scripts.ux-optimization-monitor-capture.test.ts`
- package scripts:
  - `perf:ux-optimization:capture`: `npm run build:vite` 後にcaptureを実行
  - `perf:ux-optimization:validate`: `npm run build:ts` 後にvalidatorを実行
  - `perf:ux-optimization:quick`: quick captureとvalidateを連続実行
  - `perf:ux-optimization:standard`: standard captureとvalidateを連続実行
- required behavior:
  - fresh browser process、cold/warm context、固定viewport、visibility/focus、page/console/resource errorsを管理する。
  - resource timingとPlaywright response evidenceを統合し、logical ID、phase、encoded body、cache evidenceを記録する。
  - forced WebP/CSS failureなどの注入scenarioはexpected faultの種類と対象resourceをfixture digestへ含め、完全一致する1件だけを許可する。通常scenarioと追加errorは常にfailにする。
  - `performance.timeOrigin` を唯一のbrowser phase clockにする。
  - Pixi diagnosticsは既存optional diagnostics payloadを明示capture queryでだけロードする。
  - 通常queryではdiagnostics payload、debug global、追加observer、追加RAFがないことをcaptureする。
  - Windows hardware標準計測はANGLE D3D11を固定し、software WebGLならcandidate evidenceを拒否する。
  - server/browser/context/pageを成功・失敗の両方で必ずcloseする。
- verification:
  - fake Playwright adapterでlifecycle、cleanup、phase、resource分類をunit test
  - `npm run check:artifact-retention`
- done: product最適化をまだ変更せず、quick reportを `artifacts/ux-optimization-monitor/pre-optimization.json` へ生成してvalidatorが現在の未最適項目をfailとして列挙できる。

### Step 0.3: baselineとmonitor-only commitを確定

- outcome: monitor自身が通常起動へ影響しないことを証明し、最適化前の比較点を保存する。
- dependencies: Step 0.1、0.2
- order:
  1. focused checksとnormal boot非干渉を確認する。
  2. monitor-onlyのtask-owned diffをcommitする。
  3. cleanなそのexact commitからbaseline captureを取得する。
  4. reportのcandidate commitとbrowser artifact digestが実物に一致することをvalidatorで確認する。
- verification:
  - focused monitor Jest
  - `npm run typecheck`
  - `npm run build:vite`
  - `npm run match:boot-performance-check`
  - `npm run perf:opponent-action-stall -- --quick`
  - normal bootでdiagnostics payload/global/observerなし
  - `git diff --check`
- artifact policy:
  - raw baselineは `artifacts/` に保持しcommitしない。
  - commit message例: `Add UX optimization monitoring baseline`
- done: monitor-only変更後も既存normal bootとopponent-action指標が基準範囲にあり、cleanなmonitor-only commit SHAとbrowser artifact digestをbaseline reportへ記録する。

## Phase 1: 最大効果の最適化

### Step 1.1: 特殊石を需要駆動ロードへ切り替える

- outcome: 通常Pixi起動の全特殊石preloadを除去し、現frameと直近playbackだけを準備する。
- canonical components:
  - `ui/bootstrap.ts`
  - `ui/board-renderer.ts`
  - `ui/pixi/board-backend.ts`
  - `ui/visual-effects-map.ts`
  - `browser-vite/main.ts`
  - `test/ui.bootstrap.specialstone-preload.test.ts`
  - `test/ui.pixi-board-backend.test.ts`
  - `test/ui.pixi-board-playback.test.ts`
  - `test/ui.board-renderer.backend-selection.test.ts`
  - monitor capture scenario `boot.pixi.cold`, `board.first-special`, 3 fallback scenarios
- implementation:
  - `installCoreDI()` の無条件 `preloadSpecialStoneVisuals()` を削除する。
  - Pixiは既存 `collectSpecialStones()`、`collectPlaybackSpecialStones()`、`prepareResources()`、`preparePlaybackTextures()` を唯一の画像準備経路とする。
  - legacy一括preloaderはDOM compatibility packageの準備関数へ移し、明示DOM、初期Pixi失敗、回復不能context lossでbackend mount前にawaitする。
  - preload失敗を成功扱いせず、既存fallback/reload-requiredへ伝播する。
  - current-frame special、restored/network frame special、first playback specialのfixtureを追加する。
- monitoring:
  - initial frame/eventから必要special logical ID集合を取得するdebug-only read portをPixi backend diagnosticsへ追加する。盤面座標やownerをreportへ出さず、logical asset IDだけを返す。
  - `first-frame-committed` 前のspecial responseが必要集合外ならfail。
  - first specialのresource readyが最初の可視frameより後ならfail。
- verification:
  - focused Jest
  - `npm run build:vite`
  - `npm run match:pixijs-board-playback-check`
  - `npm run match:pixi-runtime-fallback-check`
  - `npm run perf:ux-optimization:quick`
  - `npm run worker:prepare`
- done:
  - normal Pixiで必要集合外special request 0
  - first specialの欠落・順序変更0
  - explicit DOM/initial failure/context lossがstyledかつ単一writer
  - pre-optimization比で特殊石encoded bodyが減少
- commit boundary: 特殊石routing、tests、monitor check、必要生成物だけをcommitする。

### Step 1.2: lock-only hint Graphics再描画を止める

- outcome: ロックだけの変化で64セルのGraphics clear/destroy/redrawを行わない。
- canonical components:
  - `ui/board-visual/model.ts`
  - `ui/board-visual/types.ts`
  - `ui/pixi/hint-view.ts`
  - `ui/pixi/board-scene.ts`
  - `ui/pixi/board-input.ts`
  - `test/ui.pixi-board-scene.test.ts`
  - `test/ui.pixi-board-input.test.ts`
  - `test/ui.board-input-controller.test.ts`
  - `test/e2e/board-input-backends.e2e.test.ts`
  - monitor scenario `board.lock-toggle`
- implementation stage A:
  - hint viewのpaint signatureを、legal/selectable/selected/keyboard cursor/hover/preview/selection/directionとgeometry/themeから作る。
  - `interactionLocked` をpaint signatureから除外する。
  - cursor/eventMode/hitAreaの軽量同期を別関数・別signatureへ分離する。
  - diagnosticsを `hintPaintCount` と `hintInputSyncCount` に分け、既存集計の意味を移行testで固定する。
- implementation stage B gate:
  - stage A後のstandard captureでlock transitionに有意な同期負荷が残る場合だけ、`ui/pixi/board-input.ts` の親interaction layerへ一括gateを追加する。
  - 親gate導入時は無効化前に `syncInputState()` を呼び、press、hover、long-pressをclearする。ゲーム側 `isInputLocked` 判定は残す。
  - stage Aだけで合格した場合は親gateを追加しない。planの未完扱いにはしない。
- monitoring:
  - lock以外が同一のfixtureで `updatedCellViews=0`、`updatedStoneViews=0`、`hintPaintCount=0` をblockingにする。
  - `hintInputSyncCount`、sync duration、RAF、Long Taskを記録する。
  - lock中のpointer/touch/keyboard command 0、unlock後の最初のcommand 1を確認する。
- verification:
  - focused Jest/E2E
  - `npm run match:pixijs-board-playback-check`
  - `npm run perf:opponent-action-stall -- --quick`
  - `npm run perf:ux-optimization:quick`
- done: lock-only Graphics再描画0、入力漏れ0、stale hover/press 0、unlock後の入力重複0、opponent-action Long Task/RAF非退行。
- commit boundary: paint/input分離と監視を一commitにし、stage Bが必要なら別commitにする。

## Phase 2: 低リスクの起動resource削減

### Step 2.1: logical image resolverで二重取得を止める

- outcome: Vite hash URLとroot pathを同じ画像として扱う。
- canonical components:
  - 新規 `ui/assets/logical-image-source.ts`
  - `index.classic.html`
  - `ui/status-display.ts`
  - `ui/hand-skin/runtime.ts`
  - `test/ui.status-display.network-seat.test.ts`
  - `test/ui.hand-skin-handler.test.ts`
  - `test/ui.hero-asset-path.test.ts`
  - monitor scenario `boot.pixi.cold`, `boot.pixi.warm`
- API:
  - `captureLogicalImageSource(element, logicalPath)`
  - `resolveLogicalImageSource(document, logicalPath)`
  - `setLogicalImageSourceIfChanged(element, logicalPath, options)`
  - Document単位のlogical→delivered URL mapとelement単位の世代/署名をWeakMapで保持する。
- implementation:
  - heroとdefault handのHTMLへ `data-card-reversi-logical-src` を付ける。Viteは実 `src` だけを書き換え、logical pathを保持する。
  - boot時に `currentSrc || src` をdelivered URLとしてcaptureする。
  - 同じlogical pathの更新では `new Image()` と `src` mutationを行わない。
  - 別portrait/skinへ変更して戻る場合はcaptured delivered URLを再利用する。
  - alt、class、scale、label、skin IDは画像ロードの有無にかかわらず同期する。
- monitoring:
  - logical IDごとのresponse body取得回数、`src` mutation、Image generationをdebug captureする。
  - hero/default handのcold boot body取得を各1回以下にする。
- verification:
  - focused Jest
  - `npm run build:vite`
  - classic/Vite browser check
  - `npm run perf:ux-optimization:quick`
- done: logical duplicate 0、画像切替/復帰と表示属性が両laneで正常。

### Step 2.2: ヘルプ画像を初回表示/idleへ移す

- outcome: 初期盤面準備中の非表示help image取得をなくし、即時openとidle後openを両立する。
- canonical components:
  - `index.classic.html`
  - `ui/handlers/rules-help.ts`
  - `ui/handlers/init.ts`
  - `test/ui.rules-help-panel.test.ts`
  - monitor scenario `help.before-idle`, `help.after-idle`
- implementation:
  - 最初のguide/早見表画像から初期 `src` を外し、logical pathとwidth/heightまたはaspect-ratioを保持する。
  - `rules-help.ts` にDocument単位、logical URL単位で一度だけの `prepareInitialHelpImages()` と `scheduleInitialHelpImageIdlePrefetch()` を追加する。cacheはimg要素を所有せず、後から生成されたimgも同じin-flight/ready結果を使う。
  - `waitForInitialBoardVisualReady()` がready確認済みcontrollerを返すか、その直後に `uiBootstrap.getBoardVisualController()` で同じinstanceを取得し、schedulerへ明示dependencyとして渡す。global探索は追加しない。
  - schedulerはinit chainからawaitしないbackground taskとして開始し、渡されたcontrollerの既存 `waitForIdle()` で最新idle frame settlementまで待ってからidle prefetchを予約する。listener登録、保存session復帰、`uiInitialized` を待たせず、内部errorは診断化してunhandled rejectionを出さない。
  - `requestIdleCallback` または代替timerのcallback時にもcontrollerの `getMode()==='idle'` と `isIdleSettlementPending()===false` を再確認し、playback/recovery/新しいsettlement中なら次のidleまで再予約する。
  - user openが先ならidle taskをcancelし、同じin-flight Promiseをopen処理がawaitする。
  - slide切替の現画像保持・次画像preload契約を維持する。
- monitoring:
  - first frame前のhelp request 0
  - idle prefetch startがboard idle以後
  - boardがidleへ到達する前でもinit listener登録と保存session復帰が進行する
  - 即時open/idle後openの画像complete、CLS、focus、first-open latency
- verification:
  - focused Jest
  - `npm run build:vite`
  - desktop/mobile viewport browser operation
  - `npm run perf:ux-optimization:quick`
- done: 初期help約325KBがcritical path外、即時openで枠ずれ/操作不能なし、idle後openで追加body転送なし。

### Step 2.3: DOM互換CSSをbackend選択時だけ読む

- outcome: 通常Pixiでcompat CSSを取得・評価せず、DOM backendはstyle ready後だけmountする。
- canonical components:
  - `index.classic.html`
  - `scripts/build-vite-entry.ts`
  - `scripts/sync-browser-script-versions.ts`
  - `ui/assets/feature-stylesheet-loader.ts`
  - `ui/board-renderer.ts`
  - `browser-vite/main.ts`
  - `test/scripts.vite-entry.test.ts`
  - `test/ui.feature-stylesheet-loader.test.ts`
  - `test/ui.board-dom-compat.isolation.test.ts`
  - `test/scripts.pixijs-runtime-fallback-browser-check.test.ts`
- implementation:
  - stylesheet loaderへ `board-dom-compat` groupと固定挿入slotを追加する。
  - `index.classic.html` のeager linkを、同じhead位置に置く `data-card-reversi-feature-style-slot="board-dom-compat"` markerへ置き換える。loaderは生成したlinkをmarker直前へ挿入し、classic/Viteで元のcascade位置を維持する。
  - `scripts/build-vite-entry.ts` はslot markerをVite entryへ保持し、compat stylesheetをstartup metaへ含めない。
  - `scripts/sync-browser-script-versions.ts` はlazy stylesheet markerもcache version同期対象として扱う。
  - explicit DOM、initial failure、context lossのcompatibility module準備がCSS Promiseもawaitする。
  - load errorはbackendをmountせず、既存error/reload-requiredへ伝播する。
- monitoring:
  - Vite/classic normal Pixiでcompat CSS request/evaluation 0
  - 3 fallback経路でload count 1、style ready < backend mount
  - canvasとcompat cellsの同時active 0
  - stylesheet slot/orderと主要computed styleを確認
- verification:
  - focused Jest
  - `npm run build:vite`
  - `npm run match:pixi-runtime-fallback-check`
  - `npm run match:cross-platform-smoke:vite`
  - `npm run check:board-test-selectors`
  - `npm run worker:prepare`
- done: Vite/classic通常Pixiの約73.8KBを除外し、explicit/failure/context-loss fallbackの見た目と入力が維持される。

## Phase 3: 選別式lossless WebP

### Step 3.1: 共通encoder/verifierとruntime fallbackを作る

- outcome: 既存背景最適化と新しいUI/盤面画像が同じlossless検証・fallbackを使う。
- canonical components:
  - 既存 `scripts/assets/build-background-images.ts`
  - 新規 `scripts/assets/lossless-webp-pipeline.ts`
  - 新規 `scripts/assets/build-optimized-ui-images.ts`
  - 新規 `scripts/assets/optimized-ui-images.policy.json`
  - 生成 `assets/images/optimized-ui-images.json`
  - 生成 `ui/assets/optimized-ui-images.generated.ts`
  - 新規 `ui/assets/optimized-image-codec.ts`
  - 既存 `ui/assets/background-image-codec.ts`
  - `package.json`
  - 新規 `test/assets.optimized-ui-images.test.ts`
  - 新規 `test/ui.optimized-image-codec.test.ts`
- implementation:
  - encode/hash/dimension/raw pixel検証を共通pipelineへ抽出し、背景builderもそれを使う。
  - visible equalityはalpha全画素一致、alpha > 0のRGB一致で判定する。透明画素の不可視RGB差だけを許可する。
  - policyはsource path、critical-path区分、admission状態、測定根拠を持つ。generator outputを手編集しない。
  - runtimeはWebP support、load/decode success、generation tokenを共通化し、失敗時にPNGへ一度だけfallbackする。
  - 背景CSS helperは共通codecへ委譲し、既存APIを維持する。
  - packageへ `assets:ui-images:build/check` を追加し、`assets:optimized:check` に含める。
- initial candidates:
  - `assets/images/board/board-frame-marsh-forged-iron-v1.png` を正式hardware decode計測へ進める。
  - `assets/images/board/board-surface-bluegreen-felt-v1.png` と `assets/images/background/デフォルト25.png` は調査でdecode悪化したため、初期採用不可としてpolicyに理由を残し、shipping mappingへ含めない。
- verification:
  - stale/missing output、pixel mismatch、10%未満削減をcheckでfail
  - WebP support false、HTTP failure、decode failure、MIME mismatch、stale callbackのunit test
- done: 背景とUI用pipelineに変換ロジックの重複がなく、PNG fallbackが決定的に成立する。

### Step 3.2: decode admissionと配信検証

- outcome: 容量だけでなくdecodeを含めて、合格画像だけをshipping mappingへ入れる。
- canonical components:
  - monitor scenario `asset.webp-fallback`
  - `ui/board-skin/runtime.ts`
  - `ui/pixi/appearance-resolver.ts`
  - asset delivery tests
- implementation:
  - hardware desktopでPNG/WebPを交互順序、各5回以上decodeし、中央値をレポートする。
  - default frame候補が設計閾値を満たした場合だけpolicyを`admitted`にし、CSS/Pixiの両画像解決が共通codecを使う。
  - 閾値を満たさない場合は`rejected`のままPNGを維持する。最適化項目の完了は「審査pipelineと明示結果」であり、不合格画像を無理に採用しない。
- monitoring:
  - manifest hash/bytes/pixel equality
  - normal WebP、forced PNG、forced WebP failure
  - logical duplicate、resource retry count、visual screenshot/computed image
- verification:
  - `npm run assets:optimized:check`
  - focused Jest
  - `npm run build:vite`
  - `npm run match:asset-delivery-smoke:vite`
  - `npm run match:pixijs-board-static-check`
  - `npm run worker:prepare`
  - `npm run perf:ux-optimization:standard`
- done: admitted画像は全条件pass、rejected画像はruntime mappingに存在せず、両形式のfallbackとmirror配信が成功。

## Phase 4: 非表示UIの縦割り遅延化

### Step 4.1: player-visible初回準備契約と共通surface loader

- outcome: 5 featureが同じ一度だけのCSS/DOM準備、競合、失敗、再試行契約を使う。
- canonical components:
  - `01-rulebook.md`
  - 新規 `ui/assets/lazy-feature-surface.ts`
  - `ui/assets/feature-stylesheet-loader.ts`
  - `index.classic.html`
  - 新規 `test/ui.lazy-feature-surface.test.ts`
  - `test/ui.feature-stylesheet-loader.test.ts`
- specification:
  - ガチャ/SKINの既存初回準備契約と同じ方向で、リザルト、プロフィール、HELP、デッキ、ネット対戦設定の初回準備中も既存操作を保ち、準備完了後に同じ操作を継続し、失敗時は再操作で再試行できることを `01-rulebook.md` へ追記する。
  - ゲームルール、カード、盤面演出の `正本/` は変更しない。
- API:
  - `registerLazyFeatureSurface({ id, stylesheetGroup, ensureDom, onReady, onFailure })`
  - `ensureLazyFeatureSurface(id): Promise<ReadySurface>`
  - `getLazyFeatureSurfaceDiagnostics(id)`
- behavior:
  - Document単位でpending/ready/failedを管理し、同時要求を同じPromiseへ合流する。
  - `ensureFeatureStylesheet()` はrejectではなく `{ ok: false }` を返す経路があるため、surface loaderは `ok !== true` を失敗として扱い、DOM readyへ進めない。
  - failed時は作りかけDOM/listener/styleを破棄し、次回再試行できる。
  - ready surfaceはclose時に保持し、再生成しない。
  - HTMLにはopen control、stable shell ID、ARIA参照だけを残す。
  - `init-dom.ts` はopen controlとshellだけをboot時に取得する。inner refsは各feature controllerがsurface ready後に自身のshellから取得し、boot時のnullを再利用しない。
  - CSSはfeature固有selectorだけを元ファイルから移し、共有token/layout ruleはstartup CSSへ残す。feature内の元source順を保ち、固定slotへ挿入する。
- monitoring:
  - 初期DOM/style count、ensure count、ready/failure/retry、listener countをdebug-only diagnosticsで取得する。
  - 通常プレイではdiagnostics stateを生成しない。
- verification:
  - focused Jest
  - `npm run build:vite`
  - `git diff --check`
- done: 共通loaderのunit contractが成立し、feature個別コードが独自Promise/cache/error処理を複製しない。

### Step 4.2: リザルト

- outcome: 既に動的生成されるresult DOMを維持し、専用CSSだけを終局前に遅延準備する。
- canonical components:
  - `styles-layout-result.css`
  - `styles-layout-info.css`
  - `styles-responsive.css`
  - `ui/result-overlay.ts`
  - result tests
- implementation:
  - 勝敗、スコア、主要ボタン、focus outlineを読める最小critical result CSSだけをstartup側へ残す。残るresult固有rulesを既存 `styles-layout-result.css` へsource順で集約し、このファイルを `result` feature stylesheetとしてstartup link/metaから外す。
  - `showResult()` が既存2秒待機の開始時にfull CSS Promiseも開始する。
  - 公開 `showResultOverlay()` は同期DOM生成と戻り値の互換を維持する。直接呼出し時もfull CSS準備は開始するが、そのPromiseで既存DOM生成を遅らせず、critical CSSで直ちに操作可能にする。通常の `showResult()` 経路は2秒の先行準備時間を利用する。
  - 既存 `_pendingResultToken` による2秒timerのstale callback防止を維持し、stylesheet Promiseをoverlay表示やresetの権威にしない。
  - full CSSが失敗した場合は最小critical CSSで結果と主要操作を表示し、既存警告面から再読込を案内する。結果を非表示、未装飾、操作不能にしない。
  - BGMは従来どおり実際のresult overlay表示と同時に開始し、結果計算やcanonical terminal stateをCSS readyの権威にしない。
  - overlay DOMは既存どおり表示時に生成し、close時に破棄する現在契約を維持する。このfeatureに共通inner DOM factoryを無理に追加しない。
- monitoring:
  - boot時result CSS 0、終局通知前0、終局時1
  - 通常 `showResult()` 経路は表示時full style ready、直接同期呼出しと失敗時はcritical style ready。表示順/BGM/focus/再戦を維持
  - forced full CSS failureでもcritical表示、閉じる、再戦、再表示が操作可能
- verification:
  - focused result Jest
  - CPU終局とnetwork result browser scenario
  - desktop/mobile visual check
- done: 起動からresult CSSを除外し、リザルト内容・2秒表示・BGM・再戦に差分なし。

### Step 4.3: プロフィール

- outcome: profile inner DOMと専用CSSを初回open時に一度だけ生成する。
- canonical components:
  - `index.classic.html`
  - `styles-profile.css`
  - profile固有の `styles-responsive.css`
  - `ui/player-profile-panel.ts`
  - `ui/bootstrap/init-dom.ts`
  - `ui/bootstrap/init-events.ts`
  - profile tests
- implementation:
  - open control、`#profileOverlay` shell、stable dialog IDだけを初期HTMLに残す。
  - inner DOM factoryを `player-profile-panel.ts` が所有し、storage/state modelをDOM生成前にも保持できるよう分離する。
  - `init-dom.ts` は未生成inner refsを必須にしない。boot時の `setupPlayerProfilePanel()` は安定して存在するopen controlとshellだけを登録する。
  - 初回openでsurface readyを待ち、生成後のinner refsを再queryしてlistenerを一度だけbindし、保存済みprofile modelを投影してから表示する。
  - close / reopenでは同じinner DOMとlistenerを再利用し、再生成や二重bindをしない。
- monitoring:
  - boot inner DOM/style 0、first open各1、second open増分0
  - focus trap、ESC、backdrop、open buttonへのfocus返却
  - 保存済み名前/avatar/bio/player ID/recovery codeの動作
  - close / reopen後のinner DOM identity維持、listener重複0
- verification:
  - focused profile Jest
  - desktop/mobile first/reopen browser operation
- done: profileのplayer-visible機能と秘密情報の扱いを変えず、初期DOM/CSSを除外する。

### Step 4.4: ルールヘルプ

- outcome: HELP inner DOM、専用CSS、初期画像を同じsurface準備へ統合する。
- canonical components:
  - `index.classic.html`
  - `ui/handlers/rules-help.ts`
  - `ui/bootstrap/init-dom.ts`
  - `ui/bootstrap/init-events.ts`
  - help固有rulesを含む `styles-base.css`, `styles-layout-info.css`, `styles-cards.css`, `styles-responsive.css`
  - `scripts/prepare-worker-assets.ts`
  - `test/scripts.prepare-worker-assets.test.ts`
  - `test/ui.rules-help-panel.test.ts`
- implementation:
  - open control、backdrop、dialog shell、stable IDだけを初期HTMLに残す。
  - boot時の `setupRulesHelp()` はopen controlとshellへ軽量listenerだけを配線し、初回openでsurfaceをensureした後にinner refsをshellから取得して既存handlerを一度だけ配線する。
  - catalog/search/effect/glossary/guide/protection UIを `rules-help.ts` のfactoryで一度だけ生成する。
  - Step 2.2のimage preparation Promiseをsurface readyへ接続する。
  - feature固有CSSを `styles-feature-rules-help.css` へ集約し、共有card/token rulesはstartup側へ残す。
  - 新しいroot CSSを `ROOT_FILES` / `VERIFY_ROOT_FILES` の正規生成面へ追加し、mirror testで存在と余分な手編集拒否を固定する。
- monitoring:
  - boot inner DOM/style/help image 0
  - before-idle/after-idle open
  - tab、検索、タグ、slide、protection pages、focus/ESC/backdrop
  - reopenでDOM/style/listener増分0
- verification:
  - focused rules-help Jest
  - optional feature smoke
  - desktop/mobile visual and keyboard operation
- done: HELP全機能が維持され、初期active DOMとCSSから除外される。

### Step 4.5: デッキ編成

- outcome: deck builder inner DOM、専用CSS、重い一覧生成を初回openへ移す。
- canonical components:
  - `index.classic.html`
  - `ui/deck-builder-controller.ts`
  - `ui/bootstrap/init-dom.ts`
  - `ui/bootstrap/init-events.ts`
  - `styles-feature-deck-builder.css`
  - deck固有rulesを含む `styles-cards.css`, `styles-layout-info.css`, `styles-responsive.css`
  - deck builder tests
- implementation:
  - open control、overlay/dialog shell、stable IDだけを初期HTMLに残す。
  - boot時はopen controlとshellだけへlistenerを配線し、body/header inner factoryとcontroller setupを同じsurface Promiseへ置く。controllerはready後にinner refsをshellから取得する。
  - saved deck/stateはDOM非依存modelで先に読めるが、カード一覧DOMはopen前に作らない。
  - current feature stylesheet loaderの `deck-builder` groupを固定slot対応へ移行する。
- monitoring:
  - boot inner DOM/style/card list 0
  - first open各1、second open増分0
  - preset、編集、保存、ランダム生成、詳細、scroll、network deck update
- verification:
  - focused deck Jest
  - desktop/mobile browser operation
  - network deck parityに影響する既存tests
- done: deck behavior、保存内容、network publish契約を変えず、初期DOM/style/list生成を除外する。

### Step 4.6: ネットワーク専用UI

- outcome: network mode選択または保存session検出まで専用inner DOM/CSSを生成せず、どちらの経路でもnetwork処理・最初のUI書き込み前に準備する。
- canonical components:
  - `index.classic.html`
  - `ui/handlers/match-mode.ts` と `ui/handlers/match-mode/*`
  - `ui/bootstrap/init-dom.ts`
  - `ui/bootstrap/init-events.ts`
  - `styles-feature-network.css`
  - network固有rulesを含む `styles-layout-info.css`, `styles-layout-controls.css`, `styles-responsive.css`
  - network button/popup tests
  - stored-session restore tests
- implementation:
  - mode button、overlay shell、stable IDだけを初期HTMLに残す。
  - mode選択はsurface readyをawaitし、`hydrateNetworkUiRefs(shell)` でinner refsを既存mutable UI ref holderへ一度だけ反映してからnetwork UI setupを実行する。boot時のnull refsを操作経路へ残さない。
  - hydrate後、DOM非依存の保存済みprofile / match-mode stateとnetwork client stateからプレイヤー名、選択状態、接続表示を再投影してからshellを表示する。
  - `restoreStoredNetworkSessionOnBoot()` は既存 `NetworkMatchClient.readStoredSession()` で保存sessionの有無を先に確認する。なしならsurfaceを生成せず終了し、ありなら同じsurface/hydrate Promiseをawaitしてから `restoreStoredSession()` を開始する。
  - surface準備失敗時はnetwork復帰を開始せず保存sessionを再試行用に残す。復帰試行後の成功/失敗status、`setMode(MODE_NETWORK)`、snapshot反映はready済みrefsだけへ書く。
  - canonical network client、snapshot、room stateはsurface loaderへ移さない。loaderはview生成だけを所有する。
  - load失敗時はroom作成/参加を開始せず、再操作でview準備から再試行する。
- monitoring:
  - network mode選択前inner DOM/style 0
  - 選択後各1、退出/再open増分0
  - 初回hydrate時の保存済みプレイヤー名、match mode、接続状態の一致
  - 保存sessionありでは復帰requestよりsurface readyが先行し、保存sessionなしではinner DOM/style 0。復帰成功/invalid sessionの両statusがready済みviewへ反映される
  - room settings popup、clipboard、leave、chat panelのUI操作
  - reportへroom/seat/token/chat内容を含めない
- verification:
  - focused network UI Jest
  - `npm run test:network:parity`
  - `npm run match:ui-control-smoke:vite`
  - network optional feature browser scenario
- done: viewだけがlazyになり、server authority、publish、snapshot、reconnectに差分がない。

### Step 4.7: lazy feature CSS/DOM統合回帰

- outcome: 5 featureのcascade、first-open、再表示、同時要求を横断検証する。
- dependencies: Step 4.1〜4.6
- monitoring:
  - feature別initial/first/reopen DOM/style/listener counts
  - computed style snapshot、desktop/mobile screenshot
  - profile/rules-help/deck-builder/network first-open p95、result stylesheet preparation p95、CLS、Long Task
  - stylesheet orderとfailure/retry
- verification:
  - focused feature suites
  - `npm run match:optional-feature-smoke:vite`
  - `npm run match:ui-control-smoke:vite`
  - `npm run match:cross-platform-smoke:vite`
  - `npm run perf:ux-optimization:standard`
- done: profile/rules-help/deck-builder/networkのfirst-open p95 250ms以内、result stylesheet preparation p95 250ms以内、CLS 0.01以下、アプリ起因Long Task 0、全featureの再表示増分0。resultの意図された2秒表示待機は別計測し、変更しない。時間値はhardware標準reportで判定し、CIでは構造・操作をblockingとする。

## Phase 5: 全体ゲートと継続監視

### Step 5.1: overall validatorと比較レポートを完成

- outcome: 全最適化を一つのJSON/Markdown結果で判定し、未完項目を隠せない。
- canonical components:
  - `scripts/perf/capture-ux-optimization-monitor.ts`
  - `scripts/perf/validate-ux-optimization-monitor.ts`
  - 新規 `scripts/perf/render-ux-optimization-monitor-report.ts`
  - monitor unit tests
- required behavior:
  - 全scenarioと全blocking gateが存在しなければfail。
  - `pending-optimization` を0以外ならfail。
  - baseline/candidateのfixture/scenario digest、browser/OS/GPU、viewport/DPR、profile、capture policy不一致をinvalidにする。artifact digestは各reportと各commitの自己整合を検証し、baseline/candidate間の一致は要求しない。
  - quickは開発用、standard clean exact commitだけをcandidate eligibleにする。
  - JSONとMarkdownは同じvalidator resultから生成する。
  - raw reportはartifacts、人間向け最終結論だけを `docs/perf/` に書ける `--write-summary` を用意する。
- verification:
  - missing scenario、duplicate scenario、tampered aggregate、environment mismatch、dirty candidateのtests
- done: validator以外がoverall passを生成できず、全7項目/5 featureのtraceability matrixがレポートにある。

### Step 5.2: CIへ決定的ゲートを追加

- outcome: PR/pushごとに構造退行を検知し、共有runner速度で不安定にしない。
- canonical components:
  - `.github/workflows/node-test.yml`
  - `package.json`
  - monitor capture/validator
- implementation:
  - Chromiumを用いる独立 `ux-optimization-guard` jobを追加する。
  - `npx playwright install --with-deps chromium` 後、CI profileを実行する。
  - CI profileはresource集合、phase、logical duplicate、DOM/style counts、lock paint、fallback、input、asset manifest/fallback、errorsをblockingにする。
  - absolute boot/first-open時間は記録するがadvisoryにし、hardware standard thresholdを共有runnerへ適用しない。
  - failure時だけreport artifactを短期uploadし、repoへcommitしない。
- verification:
  - local CI profile
  - workflow syntax inspection
  - intentional fixture violationがjobをfailさせるvalidator unit test
- done: CIが全決定的契約を毎回検査し、performance timing noiseだけでfailしない。

### Step 5.3: clean candidate standard captureと最終検証

- outcome: 正確なcommit/artifact identityで、UXと性能を最終判定する。
- procedure:
  1. 全実装・生成物・testsをcommitし、clean statusを確認する。
  2. 同じhardware desktopでstandard captureを5 fresh process取得する。
  3. baselineとcandidateのidentity適合をvalidatorで確認する。
  4. opponent-action既存25サンプルと新monitor standardを両方通す。
  5. 必要なら任意Android/iPhone診断を既存手順で取得する。未実施なら`deviceValidated=false`とする。
  6. `docs/perf/` に人間向けcompletion summaryだけを生成し、raw reportはcommitしない。
- full verification bundle:

```powershell
npm run checkall
npm run typecheck
npm run build:ts
npm run build:vite
npm run test:jest
npm run test:network:parity
npm run assets:optimized:check
npm run match:pixijs-board-playback-check
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run match:optional-feature-smoke:vite
npm run match:asset-delivery-smoke:vite
npm run match:ui-control-smoke:vite
npm run perf:opponent-action-stall -- --quick
npm run perf:ux-optimization:standard
npm run worker:prepare
npm run check:worker-mirror
git diff --check
git status --short
```

- done:
  - report identity valid、blocking pass、pending 0、通常scenarioのpage/console/resource error 0、失敗注入scenarioは契約済みexpected fault以外0
  - normal play diagnostics leakage 0
  - opponent-action Long Task 0、50ms RAF stall 0、ticker idle
  - board readyがbaselineより `100ms` かつ `5%` を両方超えて悪化しない
  - profile/rules-help/deck-builder/network first-open p95とresult stylesheet preparation p95が250ms以内、CLS 0.01以下
  - task-owned final diffと生成物/mirrorを確認し、completion summaryをcommitする

## ロールバック境界

- 特殊石: normal Pixiのbootstrap呼出しとDOM fallback preloader routingだけを戻せる。
- lock: paint/input signature分離を戻せる。親gateは必要時の独立commitなので別に戻せる。
- logical image: `logical-image-source.ts` と2 consumerの導入を独立して戻せる。
- help image: idle schedulerと初期 `src` を同じcommitで戻せる。
- compat CSS: classic/Viteのstartup除外、固定slot、fallback awaitを同じcommitで戻せる。
- WebP: policyのadmission mappingだけを外すとPNGへ戻り、source PNGは常に残る。
- lazy feature: featureごとのshell/inner/CSSを独立commitで戻せる。network authorityやgame stateは各commitに含めない。
- CI: monitor jobはproduct runtimeから独立して戻せるが、blocking checkを削除して製品最適化だけ残すロールバックは行わない。checkに誤りがある場合は根拠を確認してvalidatorを修正する。

## 完了チェックリスト

- [ ] monitor schema、capture、validator、denylist、phase、identityを実装
- [ ] monitor-only baselineをclean commit/artifact identityで取得
- [ ] 通常Pixi特殊石の必要集合外requestを0にする
- [ ] explicit DOM、初期Pixi失敗、context lossの特殊石/CSS fallbackを維持
- [ ] lock-only hint Graphics paintを0にし、入力lock/unlockを維持
- [ ] Vite/root logical imageのbody重複を0にする
- [ ] 初期help imageをcritical path外へ移し、即時/idle後openを維持
- [ ] 通常PixiのDOM compatibility CSS request/evaluationを0にする
- [ ] WebP共通pipeline、画素/容量/decode admission、PNG fallbackを実装
- [ ] default board frame候補を正式審査し、合否をmanifestへ確定
- [ ] `01-rulebook.md` に共通初回準備契約を先行追記
- [ ] result CSSを遅延準備
- [ ] profile inner DOM/CSSを遅延生成
- [ ] rules-help inner DOM/CSS/imagesを遅延生成
- [ ] deck-builder inner DOM/CSS/listを遅延生成
- [ ] network inner DOM/CSSをmode選択後に遅延生成
- [ ] 全featureのfocus/ESC/backdrop/reopen/failure retryを検証
- [ ] overall reportの全scenario、blocking pass、pending 0を確認
- [ ] CIの決定的guard jobを有効化
- [ ] hardware desktop standard captureをclean exact commitで合格
- [ ] 物理端末未実施時は`deviceValidated=false`を明示
- [ ] browser build、asset checks、mirror、network parityを合格
- [ ] raw artifactsをcommitせず、人間向けcompletion summaryだけを保存
- [ ] final `git diff --check`、status、task-owned staged diffを確認
- [ ] 各実装単位と最終summaryをproject policyどおりcommit

## Self-review

- 初回案ではmonitor基盤を最後に追加していたが、最適化中の未監視期間が生じるため、最初にcapture/validatorを導入し、各単位でcheckと実装を同時に完成させる順序へ変更した。
- monitor導入後すぐCIへ接続すると未最適状態で常時failするため、focused checkは各単位で使い、全 `pending-optimization` が0になったPhase 5でoverall CI jobを有効化する順序にした。
- lock最適化で親入力gateを必須にしていたが、目的はGraphics再描画の除去であり入力リスクが過大だった。paint/input診断を分離し、親gateはstage A後の実測で必要な場合だけの独立単位に修正した。
- result DOMは `ui/result-overlay.ts` が既に表示時生成しているため、共通inner DOM factoryを重ねず、CSSの遅延と既存表示契約の監視だけに限定した。
- lazy featureの初回待機はplayer-visible timingなので、実装より前の `01-rulebook.md` 更新をPhase 4の最初へ追加した。カード、ターン、盤面演出の `正本/` は変更対象にしない。
- WebPは既存背景pipelineと重複する新実装を避けるため、encode/verifyとruntime fallbackを共通化し、背景APIを維持する移行にした。
- 調査でdecodeが悪化した盤面surfaceと背景を採用候補から外し、default board frameだけを正式審査へ進める具体的順序にした。不合格でもpipelineと明示結果を完了扱いにし、容量のためにUXを犠牲にしない。
- CSSを一括分割するとcascade原因を切り分けられないため、result、profile、rules-help、deck-builder、networkの順に独立commit/visual checkを置いた。
- performance絶対値を共有CIでblockingにせず、CIは決定的契約、同一hardware standardは時間/RAF gateと役割を分けた。
- `worker-public/`、`index.html`、Vite registryなどを直接編集する手順がないこと、各単位でroot sourceから生成することを確認した。
- 全設計完了条件を最後のチェックリストとPhase 5 standard gateへ対応付け、実装モデルが会話情報なしで対象、順序、検証、停止条件を判断できることを確認した。
- help idle prefetchをboard visual readyだけで開始する案は、最新idle frame settlementと競合し得るため、`waitForIdle()` とcallback時のmode再確認を追加した。
- lazy inner DOMを削除してもboot時ref取得を維持する案はnull参照を固定するため、各feature controllerがsurface ready後にrefsを取得する手順へ修正した。
- result full CSS失敗でoverlayを抑止する案は終局操作を失わせ、同期 `showResultOverlay()` をPromise化すると既存呼び出し契約も壊すため、最小critical CSS、2秒待機中の先行準備、同期DOM生成、失敗時の操作可能表示へ修正した。
- 新しいrules-help root CSSがworker mirrorから欠落するため、`prepare-worker-assets.ts` とmirror testをStep 4.4のcanonical componentsへ追加した。
- artifact digestをbaseline/candidate比較キーにすると正当な最適化差分をすべてinvalidにするため、各reportの自己整合と環境/fixtureの比較互換性を分離した。
- resultの既存2秒待機を共通first-open 250ms閾値へ含める矛盾を修正し、resultはstylesheet preparation、他featureはinteractive readyを測るよう分離した。
- failure injectionが通常のresource error 0契約と矛盾しないよう、fixture digestに固定したexpected fault 1件だけを許可し、追加errorをfailにする規則を追加した。
- help idle待機をinit chainでawaitするとイベント登録と保存session復帰を止めるため、明示controllerを使う非blocking background taskと進行監視を追加した。
- network mode buttonだけを遅延化の入口にすると保存session自動復帰が未生成refsへ書くため、保存session検出後・復帰試行前のsurface準備と専用scenarioを追加した。
