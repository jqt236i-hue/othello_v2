# PixiJS board source trajectory migration implementation plan

- Status: completed
- Last reviewed: 2026-07-19
- Design authority: `docs/implementation/pixijs-board-source-trajectory-design.md`
- Predecessor: completed `docs/implementation/pixijs-playfield-migration-plan.md` Phase 0～10
- Player-visible specification: 2026-07-19にoffscreen区間の表示を明確化
- Deployment: 本計画外。別途ユーザー指示がある場合だけ行う

## 1. Execution rules

1. 開始時にroot/closest `AGENTS.md`と`git status --short`を確認する。
2. pre-existing dirty filesをrelated/unrelated/generated/unknownへ分類し、unrelated changeをstage、commit、revert、delete、overwriteしない。
3. `01-rulebook.md`、`正本/演出正本.md`、`正本/ターン進行正本.md`、`docs/architecture-contracts.md`と設計書を正本とする。
4. Phase 0から依存順に進め、各PhaseのVerificationとDone whenを満たしてから次へ進む。
5. coherent unitごとにtask-owned filesだけを明示stage/commitする。`git add -A`を使わない。
6. root `.ts`を正本として編集し、browser/Worker mirrorは既存generatorから更新する。generated/mirrorをsource-editしない。
7. offscreen区間は `01-rulebook.md` と `正本/演出正本.md` の明確化に従ってowner clip内だけを描く。全profileの移動は常に実source石中心から実target石中心までであり、offscreenを理由にviewport端へ終点を置き換える、別石へretargetする、画面端でearly impactすることを禁止する。それ以外の色、形、意味、表示時間、発動順、対応条件、可視範囲を変える必要が出た場合は停止し、該当正本の更新要否をユーザーへ確認する。
8. canonical `events[]`、`sequenceIndex`、`actionId`、`effectBlockId`、`phase`、network authority/payload、game RNGを変更しない。
9. Single Visual Writer、strict-network settlement handle、required `applyCommittedFrame`後のvisual settlement、sparse model、viewport materialization、排他的DOM fallbackを維持する。
10. 新しいPixi Application/canvas/WebGL context、第二board writer、effect単位のDOM fallbackを追加しない。
11. Phase 0では現行DOMのowner範囲外pixelをlegacy overflowとして記録する。移行後の期待値はlogical endpoint/durationを維持したowner clip交差であり、旧overflowを新baselineへ要求しない。

## 2. Fixed scope

通常Pixi laneへ移すのは `sniperShot`、`robotVacuumSuck`、`destroyDragonBreath`、`meteorGodBlackBeam`、`lightningDestroyed`、`udgDestroyed`、`zombieBite` の7profileだけである。

`willHunterKingSlash`は既存Pixi target-local impactのままにし、重複移植しない。手札/カード/HUDと盤面を横断するtrajectory、fullscreen/global UI、特殊カード暗転、バナー、吹き出しはDOMのままにする。

## 3. Commit sequence

| Unit | Content | Commit condition |
| --- | --- | --- |
| A | Phase 0 parity baseline | fixture/testだけ、runtime route差分なし、全profileの時間方向pixel unionとlegacy overflowを記録 |
| B | Phase 1 typed contract | dormant contractがcurrent classifierと一致 |
| C | Phase 2 dormant Pixi renderer | default route未変更、unit/lifecycle pass |
| D | Phase 3 atomic cutover | Pixi/DOM両backend、旧path cleanup、active-trajectory context-loss/排他的fallback smokeが同一commitでpass |
| E | Phase 4 recovery/network hardening | context/strict settlement pass |
| F | Phase 5～6 browser、docs、generated/mirror | 全blocking verification pass |

Pixiだけ、またはDOMだけが未実装の中間default commitを作らない。

## Phase 0 — Current behavior and visible-bounds baseline

### Purpose

現在のDOM global source trajectoryを、後続Pixi/DOM両実装が共有するmachine-readable contractへ固定する。runtime routeは変更しない。

### Files

- add `test/fixtures/board-source-trajectory-contract.ts`
- add `test/ui.board-source-trajectory-baseline.test.ts`
- update `test/ui.animation-destroy-source-batching.test.ts`
- update `test/ui.global-board-effect-presenter.test.ts`
- update `test/ui.presentation-dispatcher.test.ts`
- add `scripts/board-source-trajectory-browser-check.ts`
- add `test/scripts.board-source-trajectory-browser-check.test.ts`

### Work

1. 7profileのcause/reason、source/target resolver、direction、owner、duration、deadline、target impact owner、NOANIM、reduced-motion、seed inputをfixture化する。
2. `sniperShot` ownerを `target.projectileOwner → meta.projectileOwner → ownerBeforeの反対色 → black` として固定する。
3. multi-target traceを保存し、同一launchで `source1 → source2 → ... → first board phase/impact` になることを固定する。
4. flip batchのraw event/raw target順、combined flip後のdedupe数、target gateを別々に保存する。
5. canonical input `events[]` digestはそのまま保存する。旧global/new backend固有route名は診断欄へ分離し、source start、impact/pulse start、trajectory settle、removal/changeを共通のsemantic trajectory traceへ正規化して相対順を比較できるfixtureにする。
6. normal、`NOANIM=1`、reduced-motionのduration/gate digestとlightning seed digestを保存し、game RNG非消費を確認する。
7. DOM browser checkでdesktop/mobile viewport、DPR 1/2、通常/scroll済み拡張盤面を実行する。各profileの同期start直前からsettleまで毎animation frameのpainted nontransparent pixel boundsを採取し、その時間方向union、board viewport、2cell gutter、z-order、overlay node数を記録する。
8. current DOM pixelが `board viewport + 2cell gutter` の外へ出るfixtureはlegacy overflowとして明示する。移行後はlogical source/targetとdurationを保ち、中心線は実board viewportとの交差だけ、painted haloはviewport +既存2cell gutter内だけを描く期待値を別欄へ固定する。

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/ui.board-source-trajectory-baseline.test.ts test/ui.animation-destroy-source-batching.test.ts test/ui.global-board-effect-presenter.test.ts test/ui.presentation-dispatcher.test.ts test/scripts.board-source-trajectory-browser-check.test.ts
npm run build:vite
node dist/scripts/board-source-trajectory-browser-check.js --backend=dom --baseline
git diff --check
```

### Done when

- 7profileのcurrent visual/timing/order/motion/seed contractが一意にfixture化される。
- raw multi-target start順とflip dedupe前後を再現できる。
- 全profile・全supported fixtureの時間方向pixel union、owner範囲外pixel、移行後のclip交差期待値が記録される。
- production routeとplayer-visible behaviorは未変更である。

## Phase 1 — Typed classifier, request and profile contract

### Purpose

DOM/Pixiが同じ分類、endpoint、timing、gate identityを使うUI-only contractを追加する。dispatcher routeはまだ切り替えない。

### Files

- update `shared/presentation-effect-profiles.ts`
- add `ui/board-visual/source-trajectory.ts`
- update `ui/board-visual/types.ts` only if required
- add `test/ui.board-source-trajectory-contract.test.ts`
- update `test/ui.presentation-visual-seed.test.ts`
- update `test/ui.board-visual-effect-bounds.test.ts` only for dormant family validation

### Work

1. cause/reason parserを複製せず、7profileのboard-source classification APIをshared profile moduleへ追加する。`requiresGlobalDestroyPrelude()`はPhase 3までcompat aliasとして残してよい。
2. frozen profile registry、`BoardSourceTrajectoryRequest`、typed errorを追加する。
3. requestに `trajectoryId`、event/target ordinal、world endpoints、direction、owner、visualSeed、readonly original event/targetを持たせる。canonical/network stateへ保存しない。
4. raw events/raw targetsを受信順に列挙し、flip dedupe後targetへ対応trajectoryId列を関連付けるpure helperを作る。
5. endpoint、owner、duration、motion、seed policyをregistryへ集約し、rendererでcause/reasonやfallback ownerを再解釈しない。
6. known profileの欠損はtyped preflight errorにする。offscreenだがtopology上有効なcoordinateをinvalid扱いしない。
7. `board-source-trajectory`をfinite haloのboard-owned familyとして追加できる状態にする。historical Phase 0 inventoryとcurrent routeはまだ変えない。

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/ui.board-source-trajectory-contract.test.ts test/ui.presentation-visual-seed.test.ts test/ui.board-visual-effect-bounds.test.ts
npm run typecheck
npm run check:window
git diff --check
```

### Done when

- 7profileが一つのregistryに過不足なく登録される。
- Phase 0 fixtureとrequest digestが一致する。
- raw order、flip mapping、owner、duration、seedをrenderer外で一意に解決できる。
- default outputは未変更である。

## Phase 2 — Dormant Pixi trajectory renderer

### Purpose

既存Pixi Application、effect layer、timeline、pool/leaseだけを使うrendererを、default routeへ接続する前に完成させる。

### Files

- add `ui/pixi/effects/source-trajectory.ts`
- update `ui/pixi/effects/types.ts`
- update `ui/pixi/board-scene.ts`
- update `ui/pixi/board-playback.ts` only for dormant test harness
- update `ui/pixi/texture-manager.ts` / `ui/pixi/pools.ts` only if existing ports are insufficient
- add `test/ui.pixi-source-trajectory.test.ts`
- update `test/ui.pixi-board-playback.test.ts`
- update `test/ui.pixi-reduced-motion.test.ts`
- update `test/ui.pixi-texture-manager.test.ts` when leases change

### Work

1. 既存effect layer内にpooled handlesを追加し、新Application/canvas/renderer/ticker/contextを作らない。
2. projectile/suctionをstone texture Sprite、breath/black beamをGraphics/geometry、lightningをseeded polyline、zombieをshadow/fang primitivesで実装する。
3. target flash/ring/impactは既存`destroy.ts`/`flip.ts`のownerとし、二重描画しない。
4. 移行当時はPhase 0 timing baselineとして、dragonのduration+120msとblack beamのduration+140msをfixtureへ記録した。この基準は後に通常のanimation finish＋safety deadlineへ置き換えられ、現行fixtureは `docs/architecture-contracts.md` 7.3.1 と設計書5.2の現行契約に従う。
5. 全raw requestを同期startしてPromise mapを作った後だけboard callbackを呼ぶ二段executorを実装する。
6. geometryを同一frame/topology/layout revisionからsnapshotし、開始前revision changeだけ再計算する。開始後endpointを動かさない。
7. cell objectを参照せずworld→sceneを求め、source/target/path/void cellを追加materializeしない。
8. 中心line/pathは実board viewportとの交差だけを描く。pathが横切ればoffscreen endpointsでも描き、完全非交差はobject 0で同じdurationをsettleする。glow/branch/fangのpainted haloだけは既存2cell gutterまで許可する。
9. backing storeをvisible viewport +既存2cell gutter以上へ拡大しない。
10. NOANIMはobject 0/duration 0。destroy系reduced-motionはcurrent durationを維持し、zombie sourceだけ省略する。
11. completion/abort/reset/destroy/skin switchでhandle/leaseを一度だけ解放し、最後のrender後にtickerを止める。
12. profile/primitive別created/live/pooled/destroyed、offscreen-no-object、lease、active run diagnosticsを追加する。
13. production dispatcherからはまだ呼ばない。

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/ui.pixi-source-trajectory.test.ts test/ui.pixi-board-playback.test.ts test/ui.pixi-reduced-motion.test.ts test/ui.pixi-texture-manager.test.ts
npm run typecheck
git diff --check
```

### Done when

- 7profileがPhase 0 geometry/timing/seed digestを再現する。
- `source1 → source2 → first board callback`が一致する。
- offscreen、negative world、expansion/shrink、layout revision fixtureがpassする。
- 50回反復、abort、reset、skin switch後にobject/lease/ticker/backingがbaselineへ戻る。
- default routeはcurrent DOM global presenterのままである。

## Phase 3 — Atomic backend ownership cutover

### Purpose

Pixi/DOM両backendを同じcommitでbackend-owned二段preludeへ切り替え、synthetic global source pathを削除する。

### Files

- update `ui/presentation/dispatcher.ts`
- update `ui/board-visual/playback-types.ts`, `types.ts`
- update `ui/animation-engine.ts`
- update `ui/pixi/board-playback.ts`
- update `ui/pixi/effects/destroy.ts`, `flip.ts`
- update `ui/board-dom-compat/backend.ts`, `playback.ts`, `runtime.ts`
- add/move compatibility implementation to `ui/board-dom-compat/source-trajectory.ts`
- remove/reduce `ui/presentation/global-board-effect-presenter.ts` after caller count 0
- remove/relocate `ui/animation-destroy-source-events.ts` and facade only after import graphs are updated
- update `ui/board-visual/effect-bounds.ts`, `effect-branch-inventory.ts`
- update `styles-animations.css`, `styles-board-dom-compat.css`
- update `scripts/pixijs-runtime-fallback-browser-check.ts`
- update `test/scripts.pixijs-runtime-fallback-browser-check.test.ts`
- update the focused active-trajectory cases in `test/ui.pixi-context-recovery.test.ts`, `test/ui.board-visual-context-recovery.test.ts`
- update focused dispatcher/Pixi/DOM/inventory tests

### Work

1. Pixi `playPhase()`は全raw trajectoryを先にstartし、backend-local Promise mapをprojectionへ渡す。
2. `destroy.ts`/`flip.ts`は対応trajectoryIdを待つ。impact/pulseは並行可だが全source startより後に始める。
3. flip requestはdedupe前に全startし、deduped target visualは関連する全Promiseを待つ。
4. DOM backendも同じ二段mapを作り、既存handlersはgateを待ってsourceを二重startしない。DOM trajectoryも中心line/pathを実board viewportでclipし、旧fullscreen overflowを残さない。
5. zombie fixed-body版とboard-host版をPhase 0 baselineで比較し、current parityを満たす一実装へ統合する。
6. dispatcherはoriginal `destroy`/`flip`だけをboard backendへ渡し、synthetic source eventsを作らない。
7. AnimationEngineのsynthetic handlers、global presenter import、geometry/timer/random glueを削除する。real globalとUI↔board trajectoryは変更しない。
8. `BoardPlaybackPhaseScope.waitForTargetPrelude`を削除し、controller/dispatcherへ別visual portを追加しない。
9. Pixi/DOM `validatePhase()`がprofile、endpoint、owner、assetをstep launch前にfail-closed検証する。
10. current inventoryを `board-source-trajectory` と `cross-surface-trajectory` へ分け、historical Phase 0 inventoryは保持する。
11. zombie source CSSをDOM compatibility scopeへ移し、Pixi laneでtrajectory DOM/SVG classを生成しない。
12. default classic/Viteの評価済み実行graphからDOM source modulesを外し、compatibility backendが排他的に選択された時だけ評価する。復旧用の未評価registry accessorとDOM scope限定CSSは許容する。
13. default cutoverをcommitする前に、active trajectory中のcontext lossを一回発生させ、Pixi restoreまたは排他的DOM fallbackへ収束し、final digest一致、sound/log重複0、canvas/DOM同時writer 0をfocused fixtureとbrowser smokeで確認する。
14. 両backend、dispatcher、inventory、minimum recovery/fallback smoke、testsがpassしてからatomic commitする。

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/ui.presentation-dispatcher.test.ts test/ui.animation-destroy-source-batching.test.ts test/ui.board-source-trajectory-contract.test.ts test/ui.pixi-source-trajectory.test.ts test/ui.pixi-board-playback.test.ts test/ui.board-visual-effect-bounds.test.ts test/ui.board-visual-effect-branch-inventory.test.ts test/ui.board-dom-compat.isolation.test.ts test/ui.pixi-context-recovery.test.ts test/ui.board-visual-context-recovery.test.ts test/scripts.pixijs-runtime-fallback-browser-check.test.ts
npm run test:jest:noanim -- --runTestsByPath test/ui.presentation-dispatcher.test.ts test/ui.pixi-source-trajectory.test.ts test/ui.pixi-board-playback.test.ts
npm run typecheck
npm run check:board-test-selectors
npm run match:pixi-runtime-fallback-check
rg -n "destroy_source_animation|zombie_bite_source_animation|GlobalBoardEffectPresenter" ui scripts test --glob "*.ts" --glob "*.js"
git diff --check
```

`rg`はmigration assertion/明示compat fixture以外のruntime caller 0を要求する。削除/移動したtest pathは実在する後継pathへ更新する。

### Done when

- default Pixi laneは7profileをPixi effect layerだけから描画する。
- forced DOM laneはDOM backendだけから描画する。
- 全source startがfirst board impactより先で、target gate/final digestがbaselineと一致する。
- synthetic source global events、public prelude callback、default global presenter importが0になる。
- UI↔board/global DOMは不変で、Pixi/DOMは同時mount/writeしない。
- active trajectory中のminimum context-loss/排他的fallback smokeがfinal digest一致、sound/log重複0でpassする。

## Phase 4 — Context recovery and strict-network settlement

### Files

- update `test/ui.board-visual-context-recovery.test.ts`
- update `test/ui.pixi-context-recovery.test.ts`
- update `test/e2e/pixijs-context-recovery.e2e.test.ts`
- update `test/ui.network-presentation-timeline.test.ts`
- update `test/ui.network-playback-dispatcher.test.ts`
- update `test/ui.presentation-handler.playback-claim.test.ts`
- update `test/ui.board-visual-controller-settlement.test.ts`
- change controller/network source only if a failing contract exposes a real gap

### Work

1. active trajectory中のcontext lossでoriginal Pixi phaseがabortし、controllerがcheckpointed original launchをreplayするfixtureを追加する。
2. Pixi restoreと5秒後DOM fallbackの両方でtrajectory、target effect、final digestを完了する。
3. recovery replayでsound/log/global UI重複0を固定する。
4. abort/reset/context switchでPromiseをstrandedにせずold handles/leasesを解放する。
5. unknown profile/invalid endpoint/required asset failureをfirst visual/sound launch前のpreflight errorにする。
6. strict-networkはtrajectory phase完了後もvisual-store commitとrequired `applyCommittedFrame`成功前にhandle/claims/tracker/input lockを保持する。
7. `applyCommittedFrame` retryはcommitted frame applyだけを再試行し、trajectory/event/sound/logを再発火しない。
8. 既存phase historyで足りる場合は新trajectory checkpoint/settlement handleを追加しない。

### Verification

```powershell
npx jest --runInBand --runTestsByPath test/ui.board-visual-context-recovery.test.ts test/ui.pixi-context-recovery.test.ts test/ui.board-visual-controller-settlement.test.ts test/ui.network-presentation-timeline.test.ts test/ui.network-playback-dispatcher.test.ts test/ui.presentation-handler.playback-claim.test.ts
npm run test:network:parity
git diff --check
```

### Done when

- active trajectoryがPixi restore、排他的DOM fallback、または既存reload-required errorへ収束する。
- sound/log/global UI重複0である。
- strict settlementはrequired `applyCommittedFrame`成功後にだけtracker/observer/releaseへ進む。
- network authorityとSingle Visual Writerに変更がない。

## Phase 5 — Browser, visual, viewport and lifecycle gate

### Files

- update `scripts/pixijs-board-playback-browser-check.ts`
- update `scripts/board-source-trajectory-browser-check.ts`
- update `test/scripts.pixijs-board-browser-check.test.ts`
- update `test/scripts.pixijs-board-playback-browser-check.test.ts`
- update `test/e2e/special_effects.e2e.test.ts`
- update `test/e2e/pixijs-context-recovery.e2e.test.ts`
- update visual baseline only when current intended appearance is proven equivalent

### Work

1. classic/Vite public pathで7profileを実行する。canonical input `events[]`、sound/log、final digestは完全一致を要求し、旧global/new backend固有route名は比較せず、共通semantic trajectory traceへ正規化したstart/settle/impact/commit順を比較する。
2. Pixi laneでcanvas/context 1、DOM cell 0、trajectory DOM/SVG overlay 0、idle ticker 0をassertする。
3. forced DOM laneでcanvas/context 0、DOMだけが完了し、Pixi object/lease 0をassertする。
4. desktop/mobile、DPR 1/2、normal/expanded/shrunk/negative coordinate、scroll前後を実行する。
5. source/target offscreen、path横断、完全非交差を確認する。
6. 50回反復、abort、reset、skin switch、same-model apply後にobject/lease/backing/tickerが単調増加しないことを確認する。
7. DOM baselineとPixi screenshotをprofile別ROIで比較し、renderer差を理由にthreshold/baselineを無条件に緩めない。
8. Chromium/Firefox/WebKitのdesktop/mobile機能smokeを一回実行する。physical mobileと4run×10分soakはoptionalのままとする。

### Verification

```powershell
npm run build:vite
npm run match:pixijs-board-playback-check
node dist/scripts/board-source-trajectory-browser-check.js --backend=pixi
node dist/scripts/board-source-trajectory-browser-check.js --backend=dom
npm run compare:browser-lanes
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run test:visual
npm run check:board-test-selectors
```

### Done when

- 7profileがclassic/Viteと3 browser engineのsupported viewportで完了する。
- exclusive mount、one context、no trajectory DOM overlay、bounded backing/materializationがpassする。
- canonical `events[]`/sound/log/final digest、正規化semantic trajectory trace、visible direction/timing/meaningがPhase 0と一致する。
- short stressでresource growthがない。

## Phase 6 — Architecture docs, generated surfaces and final gate

### Files

- update `docs/architecture-contracts.md`
- update `docs/board-special-effects-current-behavior.md` where ownership would be stale
- update this design/plan only for implementation-discovered internal clarification
- generated browser registry/cachebuster from `npm run build:browser`
- generated Worker mirror from `npm run worker:prepare`
- generator source needed to keep classic/Vite/Worker lists aligned

### Work

1. architecture contractへ、board-cell trajectoryがactive backend `playPhase()`の一部でsecond visual portではないことを記載する。
2. default Pixiの評価済み実行graphにDOM source implementationがなく、compatibility選択時にはregistryの未評価accessorとDOM scope限定CSSから必要module/styleが揃うことを固定する。
3. browser/Vite/Worker outputsをgeneratorから更新し、mirror driftを検証する。
4. focused suites後にfull Jestを一回だけ実行する。NOANIMはPhase 3 focused pathsをblocking evidenceとし、全suite二重実行は新failureが示さない限り要求しない。
5. `01-rulebook.md`と`正本/*.md`に変更がないことを確認する。必要ならcommitせず仕様判断へ戻る。
6. final status/diffを確認し、task-owned source/test/docs/generated/mirrorだけを明示stage/commitする。

### Final verification

```powershell
npm run typecheck
npm run checkall
npm run test:jest
npm run test:network:parity
npm run build:browser
npm run build:vite
npm run match:pixijs-board-playback-check
npm run compare:browser-lanes
npm run match:pixi-runtime-fallback-check
npm run match:cross-platform-smoke:vite
npm run test:visual
npm run check:board-test-selectors
npm run worker:prepare
npm run check:worker-mirror
git diff --check
git status --short
```

既存scriptがbuildを内包する場合はそのcontractを優先する。testをskip/deleteしたり、期待値やthresholdを無根拠に緩めない。retry passなら初回failureと推定原因も報告する。

### Done when

- Phase 0～5のDone whenがすべて満たされる。
- focused/full tests、network parity、classic/Vite、fallback、cross-platform、visual、selector、mirrorがpassする。
- generated driftがなく、default Pixiの評価済み実行graphからDOM source runtimeが外れる。復旧用registry accessorは通常経路で未評価のままである。
- architecture contractと最終ownershipが一致する。
- task-owned diffだけがcoherent commitsになり、production deployは行っていない。

## 4. Final checklist

- [x] 7profileが通常Pixi effect layerから描画される
- [x] `willHunterKingSlash`を重複実装していない
- [x] UI↔board / fullscreen / global UIはDOMのまま
- [x] raw順で全sourceをfirst board impactより前にstartする
- [x] flip dedupe前requestとdedupe後target gateが対応する
- [x] target removal/changeは対応trajectory/impact完了後だけ
- [x] duration/deadline/owner/direction/NOANIM/reduced-motionが一致する
- [x] canonical `events[]`、sound、log、phase/final digestが完全一致し、旧/new routeはsemantic trajectory traceで順序一致する
- [x] game RNG、network payload/authorityを変更していない
- [x] one Application/canvas/context/backend/board writer
- [x] sparse model/viewport materializationを維持し、cell/voidを増やさない
- [x] backingはvisible viewport +既存2cell gutter上限
- [x] Pixi laneのtrajectory DOM/SVG overlay 0
- [x] DOM compatibilityはlazy/排他的で7profileを完了する
- [x] context recoveryのsound/log/global UI重複0
- [x] strict handleはrequired `applyCommittedFrame`成功後まで保持
- [x] abort/reset/recovery/skin switch後にobject/lease/tickerがbaselineへ戻る
- [x] offscreen区間は更新済み`01-rulebook.md`/`正本/演出正本.md`どおりで、それ以外のdisplay spec変更がない
- [x] task-owned filesだけをverified commitsへ含めた

## 5. Self-review decisions

- dispatcherに`playSourceTrajectory()`を増やす案はsecond visual pathと別recovery unitを作るため不採用。
- target内でsource/impactを交互に始める案はcurrent launch順を崩すため、backend内二段preludeへ修正。
- DOM内蔵animationのgate削除だけでは順序とzombie座標/clipが変わるため、DOMにも同じ二段Promise mapを要求。
- Pixi 2cell clipはcurrent fixed overlayのpixelを減らし得るため、Phase 0で演出全時間の毎frame pixel-bounds unionを測る。2026-07-19に長距離狙撃のlegacy overflowを実測し、ユーザー確認によりlogical endpointを保ちつつ見えていない区間を描かない契約へ改訂した。
- 旧synthetic global event名と新backend-local call名は一致しないため、canonical `events[]`は完全一致、内部routeは共通semantic trajectory traceで比較する。
- default cutoverをrecovery未検証でcommitしないよう、active-trajectory context-loss/排他的fallbackのminimum smokeをPhase 3 commit gateへ前倒しする。
- long soak/physical inputはblockingへ戻さず、short lifecycle stressとcross-browser機能smokeでriskを検証する。
