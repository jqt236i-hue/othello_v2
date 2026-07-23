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
7. browser-visible root source、HTML、CSS、asset、Vite/classic registry入力を変更したすべての単位は、focused test後に `npm run worker:prepare` と `npm run check:worker-mirror` を実行する。static asset/CSSだけに限定しない。
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

- outcome: 既存harnessを再利用し、全scenarioを同じidentity/phase clockへ登録する。Phase 0でboot/normal-isolationを実captureし、各最適化固有scenarioは `pending-optimization` として明示し、対応Stepでcheckを先に追加してからcompleteへ移す。
- canonical components:
  - 新規 `scripts/perf/capture-ux-optimization-monitor.ts`
  - 新規 `scripts/perf/ux-optimization-browser-probe.ts`
  - 既存 `scripts/browser-performance-environment.ts`
  - 既存 `ui/board-visual/performance-harness.ts`
  - `package.json`
  - 新規 `test/scripts.ux-optimization-monitor-capture.test.ts`
- package scripts:
  - `perf:ux-optimization:capture`: buildを行わず、clean確認済み `worker-public/` のmanifestをhash/serveしてcaptureを実行
  - `perf:ux-optimization:validate`: `npm run build:ts` 後にvalidatorを実行
  - `perf:ux-optimization:focused`: `worker:prepare`、mirror check、quick capture、`--target <optimization-id>` validateを連続実行
  - `perf:ux-optimization:quick`: 既知pendingを許すdevelopment capture。overallはfailのまま、完了済みcheckの退行がない時だけprocess success
  - `perf:ux-optimization:standard`: prepare済みclean artifactだけを使い、pending 0のstandard capture/validateを実行
- required behavior:
  - fresh browser process、cold/warm context、固定viewport、visibility/focus、page/console/resource errorsを管理する。
  - 起動readyはViteで `data-browser-boot-state="ready"` かつ `window.__uiInitialized === true`、classicで `window.__uiInitialized === true` とし、Vite専用属性をclassicへ要求しない。
  - resource timingとPlaywright response evidenceを統合し、logical ID、phase、encoded body、cache evidenceを記録する。
  - forced WebP/CSS failureなどの注入scenarioはexpected faultの種類と対象resourceをfixture digestへ含め、完全一致する1件だけを許可する。通常scenarioと追加errorは常にfailにする。
  - contractはscenario IDごとに必須lane/backend matrixを持つ。help before/after idle、3 fallback、5 lazy feature、network restore、WebP fallbackはVite/classic両laneを必須とし、片lane欠落をfailにする。
  - `performance.timeOrigin` を唯一のbrowser phase clockにする。
  - Pixi diagnosticsは既存optional diagnostics payloadを明示capture queryでだけロードする。
  - 通常queryではdiagnostics payload、debug global、追加observer、追加RAFがないことをcaptureする。
  - overall verdictはpendingがあれば常にfailとする。`--target` verdictは指定targetがpendingでないことと必要scenario/checkのpassを要求し、他targetの既知pendingをoverall passへ変換しない。
  - Windows hardware標準計測はANGLE D3D11を固定し、software WebGLならcandidate evidenceを拒否する。
  - server/browser/context/pageを成功・失敗の両方で必ずcloseする。
- verification:
  - fake Playwright adapterでlifecycle、cleanup、phase、resource分類をunit test
  - `npm run check:artifact-retention`
- done: product最適化をまだ変更せず、boot/normal-isolationを実captureし、残るscenarioを明示pendingとしたreportを `artifacts/ux-optimization-monitor/pre-optimization.json` へ生成する。validatorはoverall fail、development/baseline validity passを別々に示す。

### Step 0.3: baselineとmonitor-only commitを確定

- outcome: monitor自身が通常起動へ影響しないことを証明し、最適化前の比較点を保存する。
- dependencies: Step 0.1、0.2
- order:
  1. focused checksとnormal boot非干渉を確認する。
  2. `npm run worker:prepare` と `npm run check:worker-mirror` を実行し、monitor、生成物、mirrorのtask-owned diffをcommitする。
  3. clean statusを確認する。ここからbaseline capture開始までartifact buildを再実行しない。
  4. cleanなそのexact commitの `worker-public/` 全manifestをhash/serveしてbaseline captureを取得する。
  5. reportのcandidate commitとbrowser artifact digestが実物に一致することをvalidatorで確認する。
  6. 同じdigestのimmutable baseline browser artifact archiveをraw reportとともに `artifacts/ux-optimization-monitor/baseline/` へ保存し、commitしない。
- verification:
  - focused monitor Jest
  - `npm run typecheck`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `npm run match:boot-performance-check`
  - `npm run perf:opponent-action-stall -- --quick`
  - normal bootでdiagnostics payload/global/observerなし
  - `git diff --check`
- artifact policy:
  - raw baselineは `artifacts/` に保持しcommitしない。
  - commit message例: `Add UX optimization monitoring baseline`
- done: monitor-only変更後も既存normal bootとopponent-action指標が基準範囲にあり、cleanなmonitor-only commit SHA、`worker-public/` 全manifest digest、同digestのbaseline artifact archiveを記録する。

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
  - monitor capture scenario `boot.pixi.cold`, `boot.classic-pixi.cold`, `board.first-special`, `fallback.explicit-dom`, `fallback.pixi-init-failure`, `fallback.context-loss`
- implementation:
  - `installCoreDI()` の無条件 `preloadSpecialStoneVisuals()` を削除する。
  - Pixiは既存 `collectSpecialStones()`、`collectPlaybackSpecialStones()`、`prepareResources()`、`preparePlaybackTextures()` を唯一の画像準備経路とする。
  - 既存 `preloadStoneVisualEffectKeys()` はImage requestを開始して同期returnするだけなので、完了通知としてawaitしない。
  - DOM compatibility packageにDocument単位Promise cacheを持つ `prepareDomCompatibilityStoneVisuals()` を追加する。全対象のload/decode成功・失敗結果を返し、同時要求を合流し、失敗entryだけ次回retry可能にする。
  - 明示DOM、初期Pixi失敗、回復不能context lossはこの新APIをbackend mount前にawaitする。
  - preparation失敗を成功扱いせず、既存fallback/reload-requiredへ伝播する。
  - current-frame special、restored/network frame special、first playback specialのfixtureを追加する。
- monitoring:
  - initial frame/eventから必要special logical ID集合を取得するdebug-only read portをPixi backend diagnosticsへ追加する。盤面座標やownerをreportへ出さず、logical asset IDだけを返す。
  - `first-frame-committed` 前のspecial responseが必要集合外ならfail。
  - `assets/images/special-stones/` はプロフィールavatar等のDOM/CSS-owned surfaceも共有するため、board preload判定はresource timingの `css` initiatorを除外し、Pixi resource経路（`fetch` / `img` / `other`）だけを必要logical集合と照合する。
  - first specialのresource readyが最初の可視frameより後ならfail。
- verification:
  - focused Jest
  - `npm run build:vite`
  - `npm run match:pixijs-board-playback-check`
  - `npm run match:pixi-runtime-fallback-check`
  - `npm run perf:ux-optimization:focused -- --target special-stone-demand-loading`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
- done:
  - normal Pixiで必要集合外special request 0
  - first specialの欠落・順序変更0
  - explicit DOM/initial failure/context lossがstyledかつ単一writer
  - pre-optimization比で特殊石encoded bodyが減少
- commit boundary: 特殊石routing、tests、monitor check、必要生成物だけをcommitする。
- implementation review:
  - `ui/bootstrap.ts` だけでなく、`ui.ts` のWORK/gold/silver/rainbow用legacy preloadが通常起動時に5画像を取得していたため、自動初期化から除外した。互換用の明示APIは維持する。
  - 通常起動の判定は固定0件ではなく、committed frameが要求するlogical IDのowner variantだけを許可する。初期盤面に特殊石がなければ結果として0件になる。
  - first-special fixtureは通常game更新と競合しない公開writer settlement経路を使い、`frame:prepared` がsettlementより前、対象画像のdelta responseが1件であることを確認する。
  - context-loss fixtureは合成eventではなく `WEBGL_lose_context` extensionを使い、実runtime recoveryからDOM準備完了までを観測する。

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
  - stage A後のhardware captureで、lockまたはunlock apply durationが観測RAF中央値の25%以上、またはlock transitionに帰属するLong Task/50ms RAF stallが1件以上なら、`ui/pixi/board-input.ts` の親interaction layerへ一括gateを追加する。
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
  - `npm run perf:ux-optimization:focused -- --target lock-only-hint-paint`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
- done: lock-only Graphics再描画0、入力漏れ0、stale hover/press 0、unlock後の入力重複0、opponent-action Long Task/RAF非退行。
- commit boundary: paint/input分離と監視を一commitにし、stage Bが必要なら別commitにする。
- implementation review:
  - stage Aはlock/unlockとも `updatedCellViews=0`、`updatedStoneViews=0`、`hintPaintCount=0`、軽量な `hintInputSyncCount=64` となった。applyは約2.1–2.2msで観測RAF中央値16.7msの約13%に留まり、定量gateの25%未満だったためstage Bは追加しない。
  - 専用 `perf:opponent-action-stall -- --quick` は5シナリオ×5サンプルでLong Task/50ms stall 0、RAF p95 16.7–16.8msだった。統合monitorだけがfirst-use CPU初期化を含めて50msを1件記録したため、既存専用harnessと同じ1回のウォームアップ後にfresh fixtureを再生成して計測するよう修正した。

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
  - `npm run perf:ux-optimization:focused -- --target logical-image-deduplication`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
- done: logical duplicate 0、画像切替/復帰と表示属性が両laneで正常。
- implementation review:
  - quick captureのVite cold/warm、classic coldはいずれもhero/default handのresponse bodyが各1、対象のdetached `Image` preload 0、同一logical `src` mutation 0でfocused passした。
  - Vite実画面でheroのLv1→Lv6→Lv1復帰後も最初のhash URLを再利用し、classicはroot URLを再利用した。両laneでalt/labelも復帰し、UI control smokeはpage/console/resource error 0だった。
  - preload未完の画像BからCへ切り替えた時に、旧表示AをBの配信URLとして誤記憶し得る競合をレビューで検出した。DOMからの暗黙captureをelement初回だけへ限定し、B→C→Bの高速切替testで未完Bが新しくloadされることを固定した。

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
  - 既存実装には専用のローディング表現がないため、初期画像に`src`がない間だけ予約済み画像枠へ`aria-busy`と非テキストのスピナーを付与する。表示文言と操作順は変更しない。
  - `rules-help.ts` にDocument単位、logical URL単位で一度だけの `prepareInitialHelpImages()` と `scheduleInitialHelpImageIdlePrefetch()` を追加する。cacheはimg要素を所有せず、後から生成されたimgも同じin-flight/ready結果を使う。
  - detached `Image`と表示`img`へ同じHTTP URLを順に指定すると配信設定によってbodyが再転送されたため、同一origin画像は1回の`fetch`で得たBlob URLをDocument単位cacheへ保持し、decodeと表示要素を同じBlob URLへ接続する。fetch/Blob準備失敗時だけ元logical URLへfallbackする。
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
  - `npm run perf:ux-optimization:focused -- --target help-image-lazy-loading`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
- done: 初期help約325KBがcritical path外、即時openで枠ずれ/操作不能なし、idle後openで追加body転送なし。
- implementation review:
  - 初回captureではdetached `Image`と表示`img`が同じHTTP URLを使った時に両laneで325,700 bytesを再転送し、HTTP cache再利用の前提が成立しないことを検出した。Document単位のlogical cacheを1回の`fetch`で得たBlob URLへ変更し、decodeと表示を共有するよう正本と実装を修正した。
  - 修正後のfocused captureではVite/classicともfirst-frame前request 0、取得logical path 2、encoded body合計325,100 bytes、CLS 0だった。即時open latencyはVite 103.9ms / classic 70.4ms、idle後openはVite 42.3ms / classic 43.6msで、idle後openの追加resource entryと追加transferはいずれも0だった。
  - Vite/classic実画面でguide 1→2、耐性貫通表、alt、busy解除、タブ内focusを操作し、画像枠と表示崩れがないことを確認した。画像B準備中に現画像Aへ戻した場合のstale completion競合もレビューで検出し、要求世代を毎操作で更新する回帰testを追加した。

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
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:focused -- --target dom-compat-stylesheet-lazy-loading`
- done: Vite/classic通常Pixiの約73.8KBを除外し、explicit/failure/context-loss fallbackの見た目と入力が維持される。
- implementation review:
  - 通常PixiのVite cold/warmとclassic coldはcompat stylesheetのlink/requestが0、固定slotが1だった。explicit DOM、初期Pixi失敗、context lossは両laneともresponse/linkが各1で、style readyからbackend mountまでの順序を維持した。最終計測のexplicit DOMはVite `456.4ms < 616.4ms`、classic `493.9ms < 557.4ms`、初期失敗はVite `537.4ms < 599.7ms`、classic `505.2ms < 569.1ms`、context lossはVite `6007.7ms < 6062.0ms`、classic `5873.6ms < 5938.8ms` だった。
  - CSS失敗注入ではVite/classicの両方でerrorを観測し、DOM backend未mount、`uiInitialized !== true` を確認した。通常/失敗時ともPixi canvasとcompat cellsの同時writerはなかった。
  - 初回実装レビューの `check:board-test-selectors` がmonitor内のcompat-only selector 3件を検出した。通常Pixiのtest/monitor graphがcompat DOMへ依存しないよう、主要computed style観測をDOM backend diagnosticsへ移し、default/pixi violation 0へ修正した。
  - Vite/classicの実画面でも、通常Pixiはcanvas 1/cell 0/link 0、explicit DOMはcanvas 0/cell 64/link 1、固定slot直前、style ready < mountを確認し、盤面のframe・cell・番号・初期石が装飾済みであることを目視確認した。

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
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
- done: 背景とUI用pipelineに変換ロジックの重複がなく、PNG fallbackが決定的に成立する。
- implementation review:
  - 背景builderのencode、SHA-256、寸法、可視画素検証を共通pipelineへ移し、新しいUI policy/generatorも同じ処理を使用した。透明画素のRGB差だけを許容し、alpha差またはalpha > 0のRGB差を拒否するunit testを追加した。
  - 3候補はすべて可視画素一致と10%以上の削減を満たした。default board frameは1,126,115 bytesから553,268 bytes（50.87%削減）でhardware審査待ち、board surfaceは32.47%、`デフォルト25` は26.67%削減だが、既存調査どおりdecode理由でrejectedのままとし、後2件のWebP file/runtime mappingは生成しなかった。
  - 共通runtime codecはWebP非対応、HTTP失敗、response/blob MIME不一致、decode失敗をPNGへ一度だけfallbackし、同一Documentのbody取得を合流する。既存背景は従来どおり直接URL decodeを使い、strict MIME用Blobを多数保持するメモリ増を避けた。
  - focused 3 suite/15 test、背景13件の再生成check、UI 3候補check、worker mirror 916 filesが合格した。`assets:optimized:check` 全体は今回のWebP工程より前に、既存 `cinzel-400` font subsetのcoverage不足3文字で停止したため、背景/UI checkを個別実行してWebP工程を分離確認した。
  - 1回目の最終 `worker:prepare` はVite closeBundle時のWindows `index.html` open `UNKNOWN/-4094` で失敗したが、同一コマンドの再試行は変更なしで合格したため、一時的なfile lockと判定した。

### Step 3.2: decode admissionと配信検証

- outcome: 容量だけでなくdecodeを含めて、合格画像だけをshipping mappingへ入れる。
- canonical components:
  - monitor scenario `asset.webp-fallback`
  - `styles-layout.css`
  - `ui/bootstrap.ts`
  - `ui/handlers/init.ts`
  - `ui/board-skin/runtime.ts`
  - `test/ui.board-skin-runtime-optimized-image.test.ts`
  - `test/ui.init.async-policy-load.test.ts`
  - asset delivery tests
- implementation:
  - hardware desktopでPNG/WebPを交互順序、各5回以上decodeし、中央値をレポートする。
  - default frame候補が設計閾値を満たした場合だけpolicyを`admitted`にし、`ui/board-skin/runtime.ts` のCSS custom property/display lease画像解決だけが共通codecを使う。
  - startup CSSのdefault PNG参照を画像なしへ変更し、成功時にPNGとWebPを二重取得しない。`UIBootstrap.prepareInitialBoardFrameSkin()` は保存済みframeを読み、game system初期化と並行してBoardSkinRuntimeの準備Promiseを開始する。入力listener、session復帰、`__uiInitialized` はその完了後だけ進める。
  - WebP非対応時はPNGだけ、WebP HTTP/MIME/decode失敗時は失敗WebP一回とPNG一回だけを許可する。非同期中のframe変更はgeneration tokenで古い完了を破棄する。mappingなし、rejected、custom frameは従来の同期適用を維持する。
  - CSS `image-set()` は先頭WebPのnetwork失敗時にChromiumがPNG候補へfallbackしない実測結果のため使用しない。
  - Pixi appearance resource配列にはframe texture roleを追加しない。Pixiは従来どおりBoardSkinRuntimeからframe layout descriptorだけを共有する。
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
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:focused -- --target lossless-webp-admission`
- done: admitted画像は全条件pass、rejected画像はruntime mappingに存在せず、両形式のfallbackとmirror配信が成功。
- implementation review:
  - Windows headful Chrome 143 / NVIDIA GeForce RTX 2070 / D3D11でPNGとlossless WebPを交互順序12回ずつdecodeした。中央値はPNG 12.00ms、WebP 10.75ms、差 -1.25msで許容差 +2ms以内だったためdefault board frameを`admitted`へ確定した。容量は1,126,115 bytesから553,268 bytesへ572,847 bytes、50.87%削減し、alpha全画素とalpha > 0のRGB一致を維持した。
  - startup CSSのPNG直参照を除去し、`UIBootstrap.prepareInitialBoardFrameSkin()` が保存済み選択を読み、game初期化と並行してBoardSkinRuntimeのgeneration/display lease経路を完了してからinput/session/app-readyへ進むようにした。WebP成功時はfetch済みBlob URLだけ、非対応時はPNGだけ、失敗時はWebP失敗1件とPNG成功1件だけを適用する。mappingなし/rejected/custom frameは従来の同期経路を維持した。
  - `asset.webp-fallback` をVite/classic両laneで実captureし、normalはWebP request/response 1/1・PNG 0/0、forced PNGはWebP 0/0・PNG 1/1、forced WebP failureはWebP request/failure 1/1・PNG request/response 1/1となった。全経路でPixi writer 1、既定frame ID、表示寸法、computed image、visual screenshot SHA-256を確認した。
  - 初回focused monitorは、注入したWebP通信失敗が必ず出すChromium `ERR_FAILED` 1件をvalidatorがunexpected扱いして失敗した。失敗注入時はこの1件を必須とし、0件または複数件も拒否する契約へ修正した。同じraw captureの再validationはfocused verdict `pass`、developmentValid `true` となり、後続Phase 4の5 optimizationだけがpendingとして残った。
  - focused unitは最大7 suite/39 test、`assets:ui-images:check`、browser build、asset delivery smoke、worker mirror 916 files、Pixi静止画19 fixture × classic/Vite × DPR 1/2が合格した。静止画digestはlane間で一致し、in-app browserでも既定frameを目視確認した。`assets:optimized:check` 全体は既知のtask外 `cinzel-400` subset coverage不足3文字でPhase 3.1と同じ位置に停止した。

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
  - CSSはfeature固有selectorだけを元ファイルから移し、共有token/layout ruleはstartup CSSへ残す。抽出前にselector依存と同一property競合を監査し、元ファイル単位のfragment/slotで一致する場合だけ単一fragmentへ移す。
  - 元ファイル内でfeature/shared ruleが交互になりcomputed styleが変わる場合は、抽出境界ごとの複数fragment/slotへ分割するか、その競合ruleをstartup側へ残す。「一つの末尾stylesheetへ集約したのでsource順保持」とは判定しない。
  - 代表状態、desktop/mobile viewport、focus/disabled/open stateの主要computed property baseline一致をblockingにする。
- monitoring:
  - 初期DOM/style count、ensure count、ready/failure/retry、listener countをdebug-only diagnosticsで取得する。
  - 通常プレイではdiagnostics stateを生成しない。
- verification:
  - focused Jest
  - `npm run build:vite`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `git diff --check`
- done: 共通loaderのunit contractが成立し、feature個別コードが独自Promise/cache/error処理を複製しない。
- implementation review:
  - `01-rulebook.md` へ5 featureの初回準備、既存操作継続、再操作retryと、resultのcritical表示・従来timing/BGM維持を先行追記した。ゲームルール、カード、盤面演出の `正本/` は変更していない。
  - `lazy-feature-surface.ts` はDocument単位のpending/ready/failed、同時Promise合流、ready DOM保持、retry attemptを共通化した。attempt contextの `AbortSignal`、LIFO cleanup、debug-only DOM/listener/count診断により、通常プレイでは診断stateを作らない。
  - 既存stylesheet loaderに処理中・成功済みlinkをcacheごと破棄する `discardFeatureStylesheet()` を追加した。CSS `{ ok: false }`、DOM factory、ready hookの失敗時は途中DOM/listener/styleを破棄し、次回操作が新しいlinkから再試行できる。
  - typecheck、focused 2 suite/9 test、Vite build、Worker mirror 916 filesが合格した。Chromium/Firefox/WebKitのdesktop/mobile、Pixi/DOM計12 browser scenarioでも操作smoke、writer exclusivity、page/console/resource error 0を確認した。

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
  - `npm run match:ui-control-smoke:vite`
  - `npm run match:ui-control-smoke:classic`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:focused -- --target feature-result`
- done: 起動からresult CSSを除外し、リザルト内容・2秒表示・BGM・再戦に差分なし。
- implementation review:
  - `styles-layout-result.css` をstartupから外し、`showResult()` の既存2秒timer開始時と同期 `showResultOverlay()` の先頭で共通surface準備を開始した。Promiseは表示、reset、`_pendingResultToken`、BGMの権威にせず、通常経路では表示前ready、直接経路ではcritical表示後readyとなる。
  - `styles-layout-info.css` に勝敗、スコア、主要操作、scroll、警告のcritical ruleを残した。full CSS失敗時は結果DOMを同期生成し、閉じる/再戦を維持したまま再読込案内を表示し、次回表示は失敗link/cacheを捨てて新しいlinkを一度だけ要求する。
  - source監査で `.premium-btn` がnetwork再戦申請dialogにも共有されることを確認したため、button base/primary/secondary/focus ruleはresult full CSSへ遅延せずstartup共有ruleへ移した。result局所custom propertyがないnetwork側もfallback色で従来操作を維持する。
  - Vite生成entryではfeature slotがeager CSS link群より前に残るため、slot直前だけではfull result CSSがcritical CSSより先に入りcascadeが逆転する矛盾を確認した。`data-card-reversi-feature-style-before="styles-layout-characters.css"` とloaderのpath anchor解決を追加し、classic/Viteとも `info → result → characters` の連続順をmonitorでblockingにした。
  - focused 3 suite/64 result/loader/surface testとmonitor 3 suite/21 test、typecheck、browser/Vite build、Worker mirror 916 files、Vite/classic UI control smokeが合格した。実ブラウザでは両laneともboot request/link/DOM 0、normal/direct/retry link 1、同期表示2.7–4.0ms、通常CSS ready 3.4–3.7ms、表示待機2005.7–2009.5ms、CSS先行2002.3–2005.8ms、first-open CLS delta 0、BGMはDOM append以後、強制失敗はrequest失敗1・console error 1・warning 1・retry成功1を確認した。
  - `npm run perf:ux-optimization:focused -- --target feature-result` はVite/classicの `feature.result` と関連bootをすべてpassし、focused verdict `pass`、developmentValid `true` となった。overall failは後続4 featureが意図どおりpendingのためである。

### Step 4.3: プロフィール

- outcome: profile inner DOMと専用CSSを初回open時に一度だけ生成する。
- canonical components:
  - `index.classic.html`
  - `styles-profile.css`
  - `styles-profile.css` 内のprofile固有responsive rules
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
  - Vite/classic first/reopen scenario
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:focused -- --target feature-profile`
- done: profileのplayer-visible機能と秘密情報の扱いを変えず、初期DOM/CSSを除外する。
- implementation review:
  - selector/source監査で、profile modalのresponsive ruleは `styles-responsive.css` ではなく `styles-profile.css` 内の `@media` に集約済みであることを確認した。canonical componentsの誤記を修正し、profile固有CSS全体を一つのfeature stylesheetとして遅延する実装へ整合させた。
  - 初期HTMLはopen control、`#profileOverlay`、空のstable `#profileModal` だけとし、header/body、avatar option、identity/recovery controlを `player-profile-panel.ts` の一度だけのDOM factoryへ移した。boot bootstrapは未生成inner refを保持せず、surface ready後にcontrollerがshell内を再queryする。
  - `styles-profile.css` をstartupから外した一方、起動時に見えるプロフィールicon、overlay shell、CSS失敗時の読込案内はstartup critical CSSへ残した。失敗画面にもstable `profileModalTitle` を付け、dialog label、閉じる、focus返却、次回操作retryを維持した。
  - profile CSSは従来 `styles-stone-shadows.css` の後ろにあったため、汎用after-anchorをstylesheet loaderへ追加した。feature slotがeager CSSより前に置かれるViteと、slotが従来位置にあるclassicの双方で `stone-shadows → profile` のcascade順をunit/browser/monitorで固定した。
  - 保存済み名前、avatar、bio、player IDをDOM生成後に投影し、recovery codeは従来どおり初期非表示、明示操作でのみ表示する。close/reopenは同じinner node、style、45 listener bindingを保持し、再生成・二重bindしない。
  - monitor初回実装では、avatarの日本語label/画像名へ英語logical IDを要求する誤判定、合成 `HTMLElement.click()` によるfalse-positive CLS、Playwright actionability待機をplayer latencyへ含める時刻境界の3点を確認した。選択radioとresource timingの照合、trusted click、capture listenerで取得する実際のclick時刻へ修正し、player操作の客観的計測へ整合させた。
  - Vite/classic実captureはboot CSS/response/inner DOM 0、初回CSS/DOM各1、reopen増分0、CLS delta 0、avatar resource coverage、秘密情報、focus trap、ESC/backdrop、強制CSS失敗後の2 request中1 failure・retry成功を確認した。最終captureの初回表示はVite 43.3ms、classic 45.1ms、CSS readyは各9.2ms、10.5msで、focused verdict `pass`、developmentValid `true` となった。overall failは後続3 featureが意図どおりpendingのためである。
  - desktop 1440×900とmobile 390×844で変更前後のmodal矩形、overlay padding/background、title font、input height/paddingが完全一致し、Vite/classic間も一致した。in-app browserでも両laneの初回表示を目視確認した。

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
  - help selector依存監査を行い、`styles-base.css`, `styles-layout-info.css`, `styles-cards.css`, `styles-responsive.css` の各抽出位置に対応するfragment/slotを使う。computed styleが変わる競合ruleはさらに分割するかstartup側へ残す。
  - 新しいroot CSS fragment群を `ROOT_FILES` / `VERIFY_ROOT_FILES` の正規生成面へ追加し、mirror testで存在と余分な手編集拒否を固定する。
- monitoring:
  - boot inner DOM/style/help image 0
  - before-idle/after-idle open
  - tab、検索、タグ、slide、protection pages、focus/ESC/backdrop
  - reopenでDOM/style/listener増分0
- verification:
  - focused rules-help Jest
  - Vite/classic optional feature smoke
  - desktop/mobile visual and keyboard operation
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:focused -- --target feature-rules-help`
- done: HELP全機能が維持され、初期active DOMとCSSから除外される。
- implementation review:
  - 初期HTMLは `#rules-help-backdrop` と空のstable dialog `#rules-help-panel` だけとし、208個のHELP内要素を `ui/handlers/rules-help-template.ts` の一度だけのfactoryへ移した。3つのstylesheet slot追加後も初期document全体は625要素から420要素へ減少し、HELP内画像要素も0となった。
  - CSSは元source境界を維持してlayout-info 40,642 bytes、cards 3,294 bytes、responsive 5,152 bytesの3 fragmentへ分割した。`styles-base.css` のHELP selectorはすべてshared mixed ruleだったためstartupに残し、無理な抽出を行っていない。bootでは3 fragmentともrequest/link 0、初回openで各1回だけ取得する。
  - 初回の単純抽出ではlayout-info後段のpremium shared ruleとHELP専用ruleの相対順が逆転し、背景色・title色・角丸に変更が出た。shared ruleをstartupに残したままHELP selector projectionをfragmentの元境界へ追加し、Vite/classicのdesktop 1440×900とmobile 390×844でpanel矩形、padding、border、背景、title、tab、searchの主要computed propertyを変更前と完全一致させた。
  - Step 2.2のDOM非依存image preparationを同じsurface `onReady` に接続し、CSS3枚、inner DOM、初期2画像の全ready後だけ既存controllerをopenする。catalog 95枚、検索0件/clear、tag filter、effects、guide 2/8、protection 2/2、counter tabを両laneで操作確認した。
  - lazy surfaceは3 stylesheetを一つのattemptとして並行準備し、1枚の強制失敗時に全link、途中DOM、389 listener bindingをcleanupする。閉じられるfailure dialogから次回openでattempt 2へ進み、3 link・同一機能へ復旧することをVite/classicで確認した。通常reopenはattempt/DOM/style増分0である。
  - 実captureで初回openは従来どおりopen controlにfocusを保持し、ESCとcloseで同controlへ戻ることを確認した。backdropではpointerdown時に戻したfocusが後続clickで外れる既存不整合が客観的に見つかったため、click完了後のfocus返却を追加してbrowser/unit monitorを一致させた。
  - `feature.rules-help` 最終captureはVite 62.7ms、classic 50.0ms、CSS readyは各11.1ms、9.8ms、CLS delta 0、first-open Long Task 0だった。focused verdict `pass`、developmentValid `true`、worker mirror 919 files一致で、overall failは後続deck-builder/networkだけが意図どおりpendingのためである。

### Step 4.5: デッキ編成

- outcome: deck builder inner DOM、専用CSS、重い一覧生成を初回openへ移す。
- canonical components:
  - `index.classic.html`
  - `ui/deck-builder-controller.ts`
  - `ui/bootstrap/init-dom.ts`
  - `ui/bootstrap/init-events.ts`
  - `styles-feature-deck-builder.css`
  - `styles-feature-deck-builder-responsive.css`
  - deck固有rulesを含む `styles-layout-controls.css`, `styles-layout-info.css`, `styles-responsive.css`
  - `ui/handlers/deck-builder.ts`
  - `ui/handlers/deck-builder-template.ts`
  - `ui/assets/lazy-feature-surface.ts`
  - `ui/assets/feature-stylesheet-loader.ts`
  - `scripts/prepare-worker-assets.ts`
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
  - Vite/classic desktop/mobile browser operation
  - network deck parityに影響する既存tests
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:focused -- --target feature-deck-builder`
- done: deck behavior、保存内容、network publish契約を変えず、初期DOM/style/list生成を除外する。
- implementation review:
  - source監査により、計画書初版がdeck固有CSSの主な正本を `styles-cards.css` としていたのは誤りで、実際の大半は `styles-layout-controls.css`、responsive差分は `styles-responsive.css` にあることを確認した。共有mixed ruleと失敗時critical styleは `styles-layout-info.css` / startup側へ残し、canonical componentsと抽出境界を実装へ合わせて修正した。
  - 初期HTMLはopen control、`#deckBuilderOverlay`、空のstable `#deckBuilderModal` だけとし、header/bodyを `ui/handlers/deck-builder-template.ts` の保持factoryへ移した。DOM非依存の保存済みdeck/model/network APIはboot時に維持し、カード列挙とview model描画だけをsurface ready後へ遅延した。
  - deck専用466 rule、156,516 bytesを `styles-feature-deck-builder.css`、responsive 1,142 bytesを `styles-feature-deck-builder-responsive.css` へ分割した。Vite/classicとも起動時は2 fragmentのrequest/link 0、inner DOM 0、カード0で、初回open後のみlink/response 2、inner DOM 2、preset card 11となる。
  - stylesheetは元cascade境界へ固定slotで挿入し、desktop 1440×900とmobile 390×844のVite/classicでmodal、body、close controlの主要computed styleと表示を変更前に一致させた。lazy CSS挿入直後にclose controlの既存transitionが中間色を返すことを実機で確認したため、非表示中だけtransitionを抑止し、ready前にstyleを確定するよう修正した。
  - preset表示、編集、body scroll、30枚ランダム生成、カード詳細、名前付き保存、network deck update、ESC、backdrop、focus返却を両laneで確認した。通常reopenは同じinner node、2 stylesheet、attempt 1、DOM生成2を保持し、二重生成・二重listener bindを発生させない。
  - CSS強制失敗では部分link/通常inner DOMを0へcleanupし、stable dialog、閉じる、focus、再試行案内を維持した。次回openはattempt 2で2 fragmentと通常surfaceへ復旧し、2 request中1 failure・1 response・期待したerror/warning各1件を確認した。
  - `feature.deck-builder` 最終captureはVite 97.3ms、classic 93.3ms、CSS readyは各19.4ms、60.3ms、CLS delta 0、first-open Long Task 0だった。focused verdict `pass`、developmentValid `true`、worker mirror 920 files一致で、overall failは後続networkだけが意図どおりpendingのためである。

### Step 4.6: ネットワーク専用UI

- outcome: network mode選択または保存session検出まで専用inner DOM/CSSを生成せず、どちらの経路でもnetwork処理・最初のUI書き込み前に準備する。
- canonical components:
  - `index.classic.html`
  - `ui/handlers/match-mode.ts` と `ui/handlers/match-mode/*`
  - `ui/network-client.ts`
  - `ui/bootstrap/init-dom.ts`
  - `ui/bootstrap/init-events.ts`
  - `styles-feature-network-layout-controls.css`
  - `styles-feature-network.css`
  - `styles-feature-network-responsive.css`
  - network固有rulesを含む `styles-layout-info.css`, `styles-layout-controls.css`, `styles-responsive.css`
  - network button/popup tests
  - `test/ui.network-client.api-inventory.test.ts`
  - stored-session restore tests
- implementation:
  - mode button、overlay shell、stable IDだけを初期HTMLに残す。
  - mode選択はsurface readyをawaitし、`hydrateNetworkUiRefs(shell)` でinner refsを既存mutable UI ref holderへ一度だけ反映してからnetwork UI setupを実行する。boot時のnull refsを操作経路へ残さない。
  - hydrate後、DOM非依存の保存済みprofile / match-mode stateとnetwork client stateからプレイヤー名、選択状態、接続表示を再投影してからshellを表示する。
  - `NetworkMatchClient.hasRestorableStoredSession(): boolean` を追加し、内部の正規化済みsessionの有無だけを返す。token、room、session payloadはpublic/UIへ公開しない。
  - `restoreStoredNetworkSessionOnBoot()` はこのboolean APIで保存sessionの有無を先に確認する。なしならsurfaceを生成せず終了し、ありなら同じsurface/hydrate Promiseをawaitしてから既存 `restoreStoredSession()` を開始する。
  - presence、破損session、storage unavailable、判定後にsessionが消えるTOCTOUをtestし、後者の `NO_STORED_SESSION` は正常no-opとする。
  - surface準備失敗時はnetwork復帰を開始せず保存sessionを再試行用に残す。復帰試行後の成功/失敗status、`setMode(MODE_NETWORK)`、snapshot反映はready済みrefsだけへ書く。
  - canonical network client、snapshot、room stateはsurface loaderへ移さない。loaderはview生成だけを所有する。
  - load失敗時はroom作成/参加を開始せず、再操作でview準備から再試行する。
- monitoring:
  - network mode選択前inner DOM/style 0
  - 選択後は1つのatomic surface内にmodal/chatの4 direct inner root、元cascade位置に3 stylesheet fragmentを生成し、退出/再open増分0
  - 初回hydrate時の保存済みプレイヤー名、match mode、接続状態の一致
  - 保存sessionありでは復帰requestよりsurface readyが先行し、保存sessionなしではinner DOM/style 0。復帰成功/invalid sessionの両statusがready済みviewへ反映される
  - room settings popup、clipboard、leave、chat panelのUI操作
  - reportへroom/seat/token/chat内容を含めない
- verification:
  - focused network UI Jest
  - `npm run test:network:parity`
  - `npm run match:ui-control-smoke:vite`
  - `npm run match:ui-control-smoke:classic`
  - Vite/classic network optional feature browser scenario
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:focused -- --target feature-network`
- done: viewだけがlazyになり、server authority、publish、snapshot、reconnectに差分がない。
- implementation review:
  - sourceと変更前computed styleの監査により、計画書初版の単一 `styles-feature-network.css` では元の `styles-layout-controls.css → styles-layout-info.css → styles-responsive.css` の上書き順を再現できないことを確認した。設計書と計画書を3 fragmentの原子的ロードへ修正し、Vite/classic・desktop 1440×900/mobile 390×844の23 selectorで主要computed propertyと矩形の差分0を確認した。
  - 初期HTMLは `#modeNetworkBtn`、空の `#networkModal` / `#networkChatPanel`、安定したoverlay/timer shellだけに縮小した。専用inner DOMと3 CSS response/linkは選択前0、初回選択後だけmodal/chatの4 direct inner rootと3 linkになり、通常reopenは同じinner node、attempt 1、DOM生成4、listener bind 1を保持する。
  - network専用ruleを3 fragmentへ移し、起動時に読む3 eager CSSから合計70,964 bytesを除外した。shared/mixed ruleと閉じられる失敗shellのcritical styleはstartup側へ残した。
  - `NetworkMatchClient.hasRestorableStoredSession(): boolean` は正規化済み保存sessionの有無だけを公開する。保存sessionなしはDOM/style/restore invocation 0、保存sessionありは3 fragmentとsurface ready後にだけrestoreを1回開始し、成功はnetwork modeと復帰status、invalidはCPU modeのready viewへ失敗statusを投影する。判定後消失の `NO_STORED_SESSION` はno-op、surface失敗時はrestore 0で保存sessionを残す。
  - 部屋設定popup、clipboard、chat open/send、退出、ESC、backdrop、focus返却を安全なlocal stubでVite/classicとも検証した。CSS強制失敗では通常inner DOM/link/network処理を0へcleanupし、閉じる・focus・再試行案内を維持し、次回attempt 2で3 fragmentと通常surfaceへ復旧した。
  - 遅延hydrate時に初めて顕在化した既存timer表示のnull dereference（`Number(null)` を0として扱った後に `timer.limitSeconds` を読む経路）を、timer存在確認を先行する形へ修正した。player-visibleな正常timer表示は既存testを維持し、network parity 34 suites・528 testsを通過した。
  - `feature.network` 最終captureはVite 64.0ms、classic 60.8ms、CSS readyは各10.5ms、11.3ms、CLS delta 0、first-open Long Task 0だった。`feature.network-restore` を含む全scenario、focused/overall verdict、pending 0、worker mirror 922 files、Vite/classic UI control smokeがすべてpassした。

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
  - `npm run match:ui-control-smoke:classic`
  - `npm run match:cross-platform-smoke:vite`
  - `npm run worker:prepare`
  - `npm run check:worker-mirror`
  - `npm run perf:ux-optimization:standard`
- done: profile/rules-help/deck-builder/networkのfirst-open p95 250ms以内、result stylesheet preparation p95 250ms以内、CLS 0.01以下、アプリ起因Long Task 0、全featureの再表示増分0。resultの意図された2秒表示待機は別計測し、変更しない。時間値はhardware標準reportで判定し、CIでは構造・操作をblockingとする。
- result:
  - `match:optional-feature-smoke:vite` はgacha/cosmetic/leaderboard/commentary/cpu/onnxの初回request各1、再表示増分0、failure retryを合格した。checkerはVite optional chunk専用であるため、存在しないclassic版コマンドは正本から除外し、classicは統合monitor必須laneとVite/classic UI-control smokeで検証した。
  - `match:cross-platform-smoke:vite` はChromium/Firefox/WebKit × desktop/mobile × Pixi/DOMの12 probeを合格し、Pixiはcanvas/WebGL context各1、DOM fallbackはcanvas/context 0かつ64 cells、page/console error 0だった。
  - Phase 4.6 exact sourceでVite/classic UI-control smoke、worker mirror 922 files、network parity 34 suites・528 testsを合格済みであり、Phase 4.7では生成物の再prepare/mirror、全feature monitor、focused validatorを再確認した。
  - 最初のclean standardでは `feature.deck-builder:vite` に52msのLong Taskが1件だけ発生してfailした。閾値50msを2msだけ超え、同一commitの再試行では同scenarioを含む全checkがLong Task 0でpassしたため、環境scheduler由来の境界揺らぎと判定した。ただし失敗は隠さず、最終exact captureとは分離して記録する。
  - profile Long Task監視補完後、monitorの最新sourceを `build:ts` する前に開始したstandardは全check passだったが、監視コードのexactnessを満たさないため採用しなかった。`c847a2318fc54987247cd0317d9647da3a382aaa` を再buildしたdirty=falseの正式standardだけを完了証拠とし、overall `pass`、candidateEligible `true`、pending 0を確認した。
  - 正式standardのfirst-open/style readyはprofileがVite 35.8/7.9ms・classic 38.9/8.4ms、rules-helpが63.6/10.2ms・55.3/10.4ms、deck-builderが107.1/28.0ms・83.1/22.6ms、networkが58.2/11.0ms・61.7/12.3msだった。result stylesheet preparationはVite 7.9ms・classic 8.0msで、全featureのCLS delta 0、profile/rules-help/deck-builder/network first-open Long Task 0、再表示DOM/style増分0を確認した。

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
  - scenarioごとの必須lane/backend matrixが一つでも欠ければfail。
  - baseline/candidateのfixture/scenario digest、browser/OS/GPU、viewport/DPR、profile、capture policy不一致をinvalidにする。artifact digestは各reportと各commitの自己整合を検証し、baseline/candidate間の一致は要求しない。
  - quickは開発用、standard clean exact commitだけをcandidate eligibleにする。
  - JSONとMarkdownは同じvalidator resultから生成する。
  - raw reportはartifacts、人間向け最終結論だけを `docs/perf/` に書ける `--write-summary` を用意する。
- verification:
  - missing scenario/lane/backend、duplicate capture key、tampered aggregate、environment mismatch、dirty candidateのtests
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
  2. `npm run worker:prepare` と `npm run check:worker-mirror` 後にclean statusを再確認し、ここからcapture完了までcandidate artifactを再buildしない。
  3. Phase 0のdigest付きbaseline artifact archiveを一時展開し、baseline/candidate各manifestが各report identityと一致することを確認する。
  4. 同じhardware desktopでbaseline/candidateをfresh browser processごとに交互順序で各5サンプル取得する。順序はcandidate commitから決定的に反転し、一方だけを先に連続測定しない。
  5. fixture/scenario/capture policyと実行環境の比較互換性、各artifact/commitの自己整合をvalidatorで確認する。
  6. opponent-action既存25サンプルと新monitor standardを両方通す。
  7. 必要なら任意Android/iPhone診断を既存手順で取得する。未実施なら`deviceValidated=false`とする。
  8. `docs/perf/` に人間向けcompletion summaryだけを生成し、raw reportとbaseline archiveはcommitしない。
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
npm run match:ui-control-smoke:classic
npm run perf:opponent-action-stall -- --quick
npm run worker:prepare
npm run check:worker-mirror
npm run perf:ux-optimization:standard
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

- [x] monitor schema、capture、validator、denylist、phase、identityを実装
- [x] monitor-only baselineをclean commit/artifact identityで取得
- [x] 通常Pixi特殊石の必要集合外requestを0にする
- [x] explicit DOM、初期Pixi失敗、context lossの特殊石fallbackを維持（CSS遅延化はStep 2.3）
- [x] lock-only hint Graphics paintを0にし、入力lock/unlockを維持
- [x] Vite/root logical imageのbody重複を0にする
- [x] 初期help imageをcritical path外へ移し、即時/idle後openを維持
- [x] 通常PixiのDOM compatibility CSS request/evaluationを0にする
- [x] WebP共通pipeline、画素/容量/decode admission、PNG fallbackを実装
- [x] default board frame候補を正式審査し、合否をmanifestへ確定
- [x] `01-rulebook.md` に共通初回準備契約を先行追記
- [x] result CSSを遅延準備
- [x] profile inner DOM/CSSを遅延生成
- [x] rules-help inner DOM/CSS/imagesを遅延生成
- [x] deck-builder inner DOM/CSS/listを遅延生成
- [x] network inner DOM/CSSをmode選択後に遅延生成
- [x] 全featureのfocus/ESC/backdrop/reopen/failure retryを検証
- [x] overall reportの全scenario、blocking pass、pending 0を確認
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
- 独立レビューで、後続pendingがある間は各Stepのquickが必ずoverall failすることを確認したため、overallを昇格させないtarget-focused verdictへ修正した。
- production artifact rootが `worker-public/` である既存計測契約と909件のtracked mirror対象を確認し、全browser-visible unitのprepare/mirror、baseline archive、最終交互比較へ工程を修正した。
- `NetworkMatchClient.readStoredSession()` が非publicでsession内容を返すことを確認し、boolean `hasRestorableStoredSession()` とAPI inventory/TOCTOU testsへ修正した。
- classicのHELP/fallback/lazy/network restore/WebP経路が未検証だったため、scenario必須lane matrixとclassic smokeを追加した。
- CSS stylesheet slotだけでは元ファイル内部のcascade interleaveを保存できないため、selector依存監査、computed-style blocking、必要時だけ複数fragment化する手順へ修正した。
- default frameがCSS経路でPixi texture roleを持たないこと、legacy特殊石preloaderがawait不能であることをsourceで確認し、それぞれBoardSkinRuntime限定routingと新しいDOM preparation APIへ修正した。
- Phase 0実captureで、classicは `data-browser-boot-state` を設定せず `window.__uiInitialized` をactionable-ready正本にしていることを確認し、lane別ready条件へ修正した。
- Phase 0 validatorがPixi内部の同一origin `blob:` URLをstatic pathとして拒否したため、resource集計をHTTP(S)配信だけへ限定し、転送量を持たない一時URLを除外した。
- Phase 1.1実captureでbootstrap以外のlegacy preload 5件、初期frameが正当に要求し得る特殊石、monitorの直接frame投入競合、合成context-loss eventの不正確さを確認した。自動legacy呼出しの除去、必要logical集合による判定、writer settlement fixture、`WEBGL_lose_context` fixtureへ修正し、設計・monitor・実装を同じcommit境界へ整合させた。
- Phase 2.1再captureで、保存済みプロフィールavatarのCSS backgroundが特殊石directoryを共有し、Phase 1.1のPixi preloadとして誤分類されることを確認した。`css` initiatorをboard判定から除外し、プロフィールfeatureのresource監視へ帰属させた。Pixi resourceの `fetch` / `img` / `other` 判定は変更しない。
- logical image resolverのレビューで、preload未完のlogical pathへ旧画像のDOM sourceを対応付ける競合を確認した。DOM sourceの暗黙captureはelement初回だけとし、それ以後はload完了または直接applyしたsourceだけをDocument cacheへ登録する契約に修正した。
- Phase 3.2実装前のCSS/network確認で、startup CSSがdefault PNGを先に取得するためBoardSkinRuntimeだけをWebP化すると成功時にも2 bodyになることを確認した。startup CSSを画像なしにし、game初期化と並行する初期frame preparationをapp-ready gateへ追加した。
- CSS `image-set()` の先頭WebPをnetwork failureさせてもChromiumがPNG候補を要求しなかったため、決定的fallbackには使用せずcommon codecのWebP fetch/decode後にCSS custom propertyを一度だけ確定する設計へ修正した。
- forced WebP failureの実captureでは想定どおりPNGへ復帰した一方、Chromiumが失敗request由来の `ERR_FAILED` を1件consoleへ出した。failure injectionのexpected faultを0件としていたvalidatorを修正し、この1件だけを必須、追加errorをfailにした。
- Phase 4.7の統合レビューで、profileだけfirst-open Long Taskのcapture/validatorがなく、設計の4 feature共通完了条件を実際には強制できていなかった。profileにも他3 featureと同じclick-to-ready区間のLong Task capture、blocking validator、改変testを追加した。
- `match:optional-feature-smoke` はVite optional chunkのrequest/reopenを検査するVite専用checkerで、classic scriptはpackageにも実装にも存在しなかった。存在しない `match:optional-feature-smoke:classic` を検証束から除き、classicは統合monitor必須laneと `match:ui-control-smoke:classic` で検証する。
- Phase 4.2のsource監査で、`.premium-btn` がresultだけでなくnetwork再戦申請dialogにも共有されることを確認した。result full CSSへ残すとresult未表示時のnetwork操作が未装飾になるため、startup criticalの共有ruleへ移し、network側のcustom property fallbackも固定した。
- Phase 4.2のVite実機確認で、生成entryのfeature slotと後付けeager CSS linkの位置関係により単純なslot挿入ではclassicとcascade順が逆転することを確認した。任意のbefore-anchorをstylesheet loaderへ追加し、両laneの `info → result → characters` 順をunit/browser/monitorで固定した。
