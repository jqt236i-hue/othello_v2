# 相手アクション時フレーム停止の統合修正 実装計画

## 文書の役割

- 役割: [相手アクション時フレーム停止の統合修正 設計書](opponent-action-frame-stall-remediation-design.md) を実装・検証・生成面同期まで完了するための実行手順
- 設計authority: `docs/implementation/opponent-action-frame-stall-remediation-design.md`
- プレイヤー向け仕様authority: `01-rulebook.md`
- architecture authority: `docs/architecture-contracts.md`
- 対象: CPU handoff、カード使用可否/判断、着手候補、CPU発話、playback settlement、Pixi invalidation/ticker、FPS診断、性能capture
- 非目標: CPU強さ、カード効果、乱数、演出順/時間、network snapshot/publish protocol、DOM compatibilityの通常path化

## 実装順序と停止条件

以下を順番に進める。各Stepは記載したfocused verificationを通し、task-owned差分を確認してから次へ進む。性能改善は最終画面のFPS数値だけで判定せず、Step 2で作るstage reportを基準にする。

- app-attributed同期sliceが250ms以上残った場合は完了扱いにしない。reportで特定されたownerのStepへ戻り、その同期処理を削減する。
- CPU結果、発話、ordered `events[]`、演出duration、strict network settlementに差が出た場合は、性能値よりcorrectnessを優先して原因を直す。
- 外部負荷由来のraw RAF/Long Taskだけが悪化した場合はrunを無効化して取り直し、共有workstationの偶発stallを隠すために閾値やtestを弱めない。
- sourceはrootを先に変更し、`dist/`、`public/module-registry.js`、`vite-dist/`、`worker-public/`を直接編集しない。

## Step 1: 表示仕様と内部契約を先に確定する

### Outcome

FPSの`MAX`表示と、CPU analysis/playback/Pixiに追加する安定内部契約を正本へ反映する。

### Components

- `01-rulebook.md` 3.1
- `docs/architecture-contracts.md` のCPU runtime boundary、presentation settlement、7.3 Single Visual Writer/Pixi cadence
- `正本/演出正本.md` は確認のみ。演出順・durationを変えないため編集しない。

### Behavior / contract

- FPS表示を`FPS: N`と`MAX: N ms`の2行とし、`MAX`は同じ500ms sample窓内の最大RAF間隔、50ms以上は警告表示と定義する。
- 初回timestamp、background gap、復帰直後の最初のtimestampをframe intervalへ数えない。
- CPU analysisはinvocation限定のadvisory dataで、まずidentity/protection/blockers/card usabilityだけのseedを作り、card legal、placement candidates、commentary basic metricsを必要時に別resultとして派生すると定義する。
- `stateVersion`不明で非同期境界を跨ぐ場合はseed/derived resultを再利用しない。
- deferred playbackは型付きresultを返し、strict成功とcancelのsettlement順を分ける。
- Pixi private tickerだけを上限60Hzにし、既存delta semantics、terminal render、idle stopを維持する。

### Dependencies

- なし

### Verification

- `git diff --check`
- 更新節と実装設計の用語・閾値を相互確認
- `正本/演出正本.md`に変更が不要であることを差分で確認

### Done

- player-visible仕様とstable architecture contractが設計書と矛盾せず、生成物へ先行して更新されている。

## Step 2: 診断instrumentationと再現fixtureを先に実装する

### Outcome

修正前後を同じfixtureで比較でき、CPU同期stageとbrowser frame stallを別々に特定できるmachine-readable reportを作る。

### Components

- `game/cpu-turn-handler.ts`
- `game/cpu-turn-card-phase.ts`
- `game/cpu-turn-move-phase.ts`
- `game/move-executor.ts`
- `game/pass-handler.ts`
- `game/network-turn-handoff.ts`
- `game/cpu-turn-scheduler.ts`
- `ui/perf-benchmarks.ts`
- `ui/bootstrap/cpu-runtime-wiring.ts`
- `scripts/perf/measure-opponent-action-frame-stall.ts`（新規）
- `test/scripts.measure-opponent-action-frame-stall.test.ts`（新規）
- CPU phaseの既存focused tests
- `package.json` の`perf:opponent-action-stall` command

### Behavior / contract

- `game/`は既存の注入済み`readCpuTurnNowMs()`だけでdurationを計り、optional `recordCpuTurnStage` callbackへplain dataを渡す。Performance API、DOM、`window`を参照しない。
- handoff schedulerはperf有効時だけephemeralな`correlationId`を作り、解決delay、schedule timestamp、callback開始timestampを同じoptional recorderへ渡す。その`correlationId`を内部optionで`runCpuTurn()`へ引き渡し、意図的な待機とcallback内同期処理を別metricのまま相関させる。通常pathではIDを生成しない。
- 各entryは`kind: 'sync' | 'wait'`、同一time originの`startMs`/`endMs`、durationを持つ。CPU/card/context/canonical commitの連続関数実行だけを`sync`、timer、Lv6最低思考、Worker、animation/presentation Promise待機を`wait`とする。
- Promise全体をsync stageとして囲まず、呼出前後の同期sliceとawait区間を分ける。
- invocation当たりのsync合計は入れ子entryの単純和ではなく、`sync` timestamp intervalのunion長として集計する。
- stage名を設計書の固定enumへ揃え、同じ`runId`でstart/end/outcomeを一度だけ記録する。error/staleも欠落させない。
- `ui/bootstrap/cpu-runtime-wiring.ts`は`?perf=1`の時だけrecorderを注入する。通常pathではcallback、PerformanceObserver、RAF recorder、report buffer、debug globalを生成しない。
- debug pathは`cpu_turn_frame_stall_report.v1`としてstage、Long Task、Long Animation Frame、RAF interval、Pixi diagnostics delta、artifact/fixture/profile metadataを集約する。
- Long Animation Frame API等をbrowserが提供しない場合はcapabilityを`unsupported`として記録し、そのmetric欠落だけでrunを成功形に捏造したり失敗させたりしない。
- Long Task/Long Animation Frameは同じtime originの`sync` entryとtimestamp区間が重なる場合だけapp-attributedとし、250ms/70% gateは`sync`だけを集計する。
- reportへ盤面全文、手札、seat token、operationIdを含めない。
- capture scriptは次を固定fixtureで実行する。
  - `lv1-empty-or-unusable-hand-place-8x8`
  - `lv1-usable-card-then-place-8x8`
  - `lv1-multi-target-card-playback-8x8`
  - `lv6-worker-backed-place-8x8`
  - `pixi-high-refresh-playback-8x8`
- 各scenarioはwarmup後5回以上、標準captureは20回とし、capture order、browser artifact hash、fixture digest、visibility/focus validityを保存する。
- package commandは`npm run build:vite && node dist/scripts/perf/measure-opponent-action-frame-stall.js`を実行し、`--profile`と`--output`を受ける。標準出力先は`artifacts/opponent-action-frame-stall/`配下とする。

### Dependencies

- Step 1

### Verification

- focused Jestでschema validation、percentile、invalid run除外、機密field非出力、perf OFF時の未注入を確認
- `npm run check:window`
- `npm run typecheck`
- `npm run build:browser`
- `npm run perf:opponent-action-stall -- --profile desktop --output artifacts/opponent-action-frame-stall/baseline.json`を最適化前artifactで実行し、artifact retention規則に従って参照可能にする

### Done

- 同じcommandでbaseline/candidateを比較でき、約0.47〜0.67秒stallをapp-owned同期sliceまたは外部/待機へ機械的に分類でき、通常playへ計測overheadが入らない。

## Step 3: CPU handoff delay policyを一本化する

### Outcome

Lv1のhandoffを確実に0msにし、黒/白CPU、pass、network/local handoffが同じ明示policyを使う。

### Components

- `game/cpu-turn-delay.ts`（新規）
- `game/move-executor.ts`
- `game/pass-handler.ts`
- `game/network-turn-handoff.ts`
- `ui/bootstrap.ts`
- `ui/bootstrap/pass-runtime-wiring.ts`
- 関連するmove/pass/bootstrap runtime wiring
- `test/game.cpu-turn-delay.test.ts`（新規）
- `test/game.move-executor.cpu-fallback.test.ts`
- `test/game.pass-handler.test.ts`
- `test/game.network-turn-handoff.test.ts`
- delay overrideを使うE2E/unit tests

### Behavior / contract

- pure `resolveCpuTurnDelayMs({ playerKey, decisionLevel, explicitDelayMs, defaultDelayMs })`を設計書の優先順位どおり実装する。
- UI boundaryが既存debug/test overrideを有限数として読み、move/passへ明示注入する。game moduleは`CPU_TURN_DELAY_MS` globalを読まない。
- move/passはhandoff後の`nextPlayerKey`でpublic CPU level resolverを呼び、白固定にしない。
- `game/network-turn-handoff.ts`は解決済み`cpuDelayMs`を必須inputとしてnormalizeするだけで、global fallbackやlevel判断を持たない。
- Lv6 minimum think time、animation retry delay、pending selection retry delayは別policyのまま変更しない。
- stale scheduleのturn number/player/generation guardを維持する。

### Dependencies

- Step 2の`handoff-delay` stage

### Verification

- Lv1黒/白はoverrideなし0ms、explicit override優先、Lv2〜6とlevel解決失敗は200msをfocused Jestで確認
- pass/place/network-local handoffのschedule argumentを確認
- global overrideを直接使う既存testsを明示DIへ移行し、通常runtime global readが残らないことを`rg`と`npm run check:window`で確認
- baseline/candidate captureで「待機時間」と「callback同期時間」が別stageとして記録されることを確認

### Done

- 全handoff callerが同じplayer-aware policyを使い、Lv1の200ms誤fallbackが無く、他delay policyを変えていない。

## Step 4: カード使用可否を解析結果化し、重複target探索を除く

### Outcome

使用可能カード0件では重いcontextを作らず、使用可能カードがある場合も同一selectorを同じlaneで二度走査しない。

### Components

- `game/logic/cards-internal/hand-manager.ts`
- `game/logic/cards-internal/hand-access.ts`
- `game/logic/cards.ts`
- `game/cpu-decision-card-choice.ts`
- `game/cpu-decision-card-context.ts`
- `game/cpu-decision-card-actions.ts`
- `game/cpu-decision-movement-corner-swing.ts`
- `game/cpu-decision.ts`
- `test/cpu.decision.card-context.test.ts`
- `test/cpu.decision.card-actions.test.ts`
- `test/cpu.decision.refactor.test.ts`
- CardLogic hand/usage parity tests

### Behavior / contract

- CPU専用ではないpure内部`CardUsabilityAnalysis` APIが`usableCardIds`、type、lane付きselector evidenceを返し、既存`getUsableCardIds()`はID配列compat APIとして委譲する。
- evidence keyはstate/cardState object identity、player、hand index/card copy、selector lane、method、引数を含む。同名local/module selectorを同一視しない。
- debug trap-only準備を通常計算より前へ移し、debug注入後に使用可否analysisを一度作る。
- usable 0件ならcard legal生成、decision context、quiescence、corner plan、decision-context由来の追加target getterを呼ばず`null`を返す。使用可否判定に必要なselectorはlaneごとに一度まで許容する。
- usableありでは設計書のfeature-demand tableにあるtypeだけを計算する。使用可否analysisの同一lane evidenceがあれば再利用し、無ければそのfeatureだけを計算する。
- 未計算fieldは従来の`0`/空配列/空objectを返し、policy API shapeを変えない。
- movement系は手札に存在するtypeだけを走査し、5種類を常時一括走査しない。
- `selectHandCardToDestroy`、fallback、no-legal retryもprepared usability/contextを受け、main CPU pathで再構築しない。
- CardLogicのID順、card copy、charge、targetなし、hidden visibility、fallback選択を変更しない。

### Dependencies

- Step 2の`card-availability`、`card-context-*` stage

### Verification

- empty handまたはcheap precheckだけでusable 0件となるfixtureではcontext/quiescence/corner/target getter call countが0
- targetなし確認でusable 0件となるfixtureでは使用可否selectorがlaneごとに1回以下、context由来の追加target getter/quiescence/cornerが0
- 全対象card typeをtable-driven testし、対応featureだけが1回、別laneは必要な場合だけ各1回
- 旧contextと新contextの全field/default値をfixture比較
- 既存card choice/risk/learned/high-confidence/quiescence tests
- headlessとbrowser公開CardLogicのusable ID順・結果parity
- `npm run check:window`、`npm run typecheck`

### Done

- card legalityと選択結果を変えず、無条件target走査と同一laneの重複走査がcall-count testで消えている。

## Step 5: invocation-scoped analysis seedから必要な用途だけを派生する

### Outcome

1回のCPU invocation内で小さいseedを先に作り、必要になったderived dataだけを共有して、早期reject、カード・着手・実況の意味差、非同期stale安全性を同時に維持する。

### Components

- `game/cpu-turn-analysis.ts`（新規）
- `game/move-generator.ts`
- `game/cpu-turn-handler.ts`
- `game/cpu-turn-card-phase.ts`
- `game/cpu-turn-move-phase.ts`
- `game/cpu-turn-pending-phase.ts`
- `game/cpu-turn-scheduler.ts`
- `game/cpu-decision.ts` とinternal card/move APIs
- `game/cpu-turn-presentation-runtime.ts`
- `shared/commentary-context-helpers.ts`
- `test/game.cpu-turn-analysis.test.ts`（新規）
- CPU phase、Worker scoring、commentaryの既存tests

### Behavior / contract

- `buildCpuTurnAnalysisSeed()`はidentity、protection、blockers、Step 4の`CardUsabilityAnalysis`だけを持つimmutable seedを返す。card legal、placement、commentaryをここで作らない。
- seed identityに`runId`、player、turn、level、`stateVersion`、`decisionEpoch`、pending ID/stage、retry generationを持たせる。
- `deriveCardDecisionAnalysis(seed)`、`derivePlacementAnalysis(seed, priorCardAnalysis?)`、`deriveCommentaryAnalysis(seed, snapshotMoment)`が別のimmutable resultを返し、consumerごとの入力型を固定する。
- usable 0件ではcard decision derivationを呼ばず、move phaseへ進んだ時だけplacement derivationを一度呼ぶ。
- `game/move-generator.ts`に、pendingなし・同一入力等の同値条件を検査して一つの盤面走査からcard/placement shapeを導出する内部APIを置く。条件を満たさない時は既存generatorを用途別に実行する。
- candidate order、`effectUsed`、player metadata、protection/blocker semanticsを変えない。
- commentaryは発話interval/interruptのcheap precheck後、詳細contextが必要なsnapshot momentだけ既存`getLegalMovesBasic()` semanticsで黒白のmobility/advantageを一度作り、card/placement候補から推測しない。precheckはRNGを消費せず、既存の発話可否・乱数順を変えない。
- 着手後発話は着手前derived resultを使わず、canonical resultまたは着手後contextを使う。
- card use、hand destroy、pending resolution後はseed/derived resultを破棄し、resume runで新しく作る。
- `stateVersion`がある経路は全identity fieldを非同期後に照合する。`stateVersion`がない経路は同期範囲だけ再利用し、Worker await/timer/yield後はseedから再構築する。
- Worker scoring responseは既存stateVersionに加えてinvocation `decisionEpoch`/retry generationも一致した時だけ適用する。
- `executeMove`直前のcanonical turn/pending/legal guardを省略しない。

### Dependencies

- Step 4のcard usability analysis
- Step 3のplayer-aware handoff

### Verification

- card/placement/commentaryの既存generator結果を同一fixtureで比較し、意味の異なる結果を流用していないことを確認
- 同値条件fixtureだけ共通board scanが1回、条件外は用途別結果が従来と一致
- usable 0件でseed構築1回、card derivation 0回、move phaseのplacement derivation 1回を確認
- usableあり・カード非使用の同値条件でcard derivationのmove scan evidenceをplacement derivationが一度だけ再利用し、条件外では再利用しないことを確認
- 同じinvocation/snapshot moment内の重複card/placement/commentary context call countを確認
- stateVersion、pending instance、decision epoch、retry generationの各不一致でaction適用0回
- stateVersion不明の非同期境界でseed/derived result再利用0回
- commentaryの文面、2ターン間隔、interrupt、乱数順を既存testsで比較
- Lv1/Lv6、カードあり/なし、no-legal retry、pending targetのfocused Jest
- `npm run check:window`、`npm run typecheck`

### Done

- usable 0件のearly rejectを失わず、必要な同義解析だけがinvocation/snapshot moment内で一度計算され、CPU結果・発話・stale rejectionが従来契約と一致する。

## Step 6: playback finalizationを型付き戻り値へ移行する

### Outcome

callback登録漏れを構造的に無くし、local/strict/watchdog/cancelのclaimとwriterをexactly onceでsettleする。

### Components

- `ui/playback-engine.ts`
- `ui/animation-engine.ts`
- `ui/presentation-handler.ts`
- 必要なら内部型専用の`ui/playback-settlement.ts`（新規）
- `ui/playback-state-manager.ts` は既存owner確認と最小変更
- `test/ui.animation-engine.playback-state.test.ts`
- `test/ui.animation-engine.strict-network.test.ts`
- `test/ui.presentation-handler.playback-claim.test.ts`
- `test/ui.presentation-handler.strict-network.test.ts`
- presentation serial/schedule tests

### Behavior / contract

- `AnimationEngine.play()`はpayloadあり・deferred成功時に`runId`と`mode`を持つ`PlaybackSettlementResult`を必ず返す。
- `mode: 'finalize'`は対象runのmanager finalizeを一度だけ行い、2回目はfalse。
- watchdog/external abort後はwriter settlement完了時だけ`mode: 'already-aborted-ack'`を返し、別runを解除しない。
- error、writer settlement失敗、strict committed-frame準備失敗ではresultを返さずtyped errorをthrowする。
- `PlaybackEngine.playPlaybackBatch()`と`dispatchPresentationEvent()`はresultをそのまま返す。
- `PresentationHandler`はresult shape/runId/modeを検証して登録し、callback side-channelを廃止する。
- local drainは受信順に各finalizerを一度実行してから外側claimを解放する。
- strict成功はcommitted frame apply後にstrict settlement handleがfinalizerを実行する。
- strict cancelはsettlement error記録、writer cancel/abort後にabort-finalizeし、committed applyを要求しない。strict settlement handle以外の実行ownerを作らない。
- migration adapterはroot caller/test移行と同じStep内で削除し、最終diffへ残さない。

期待branch matrixは次で固定する。

| branch | expected result | cleanup |
| --- | --- | --- |
| local通常成功、payloadあり | `finalize`を1個 | local drainがwriter settlement後に一度実行 |
| local abort済み成功return | `already-aborted-ack`を1個 | local drainがwriter settlement後に一度ack |
| strict animation成功・handoff成功 | resultを1個handleへ登録 | success/cancelに応じstrict handleが一度実行 |
| result生成前throw | 0個 | `abortBeforeHandoff`/recovery ownerが一度cleanup |
| strict handoff後cancel | 新規result 0個 | cancel ownerが登録済みresultを一度処理 |
| empty payload | AnimationEngine result 0個 | outer claimだけをrelease |

### Dependencies

- Step 2の`presentation-handoff` stage

### Verification

- local success、empty payload、playback failure、writer failure、watchdog、external abort、strict success、strict cancel、context recoveryのbranch tests
- branch matrixどおりresult個数、runId、mode、finalize true/false、manager/writer release countを検証。成功returnはexactly one、throw/emptyはzero resultかつowner cleanup exactly onceとする
- `local_playback_manager_finalizer_unavailable`を再現したfixtureでconsole errorが無いことを確認
- `npm run test:network:parity`
- `npm run match:pixijs-board-playback-check`

### Done

- deferred成功経路にfinalizer欠落分岐がなく、local/strictのsettlement ownerと順序が設計どおり一つに定まる。

## Step 7: Pixiの不要なview更新・resize・高Hz renderを削減する

### Outcome

Single Visual Writerと演出結果を維持したまま、変化したviewだけを更新し、同一resizeをskipし、active renderを60Hz以下へ抑える。

### Components

- `ui/board-visual/types.ts`
- `ui/board-visual/model.ts`
- `ui/board-visual/frame-presenter.ts`
- `ui/board-visual/controller.ts` はcontract確認とdiagnostics propagationのみ
- `ui/pixi/board-scene.ts`
- `ui/pixi/cell-view.ts`
- `ui/pixi/stone-view.ts`
- `ui/pixi/hint-view.ts`
- `ui/pixi/application.ts`
- `ui/pixi/timeline.ts`
- `ui/pixi/board-backend.ts`
- board/Pixi/context recovery tests

### Behavior / contract

- aggregate `visualSignature`を維持しつつ、`surfaceSignature`、`stoneSignature`、`interactionSignature`をmodelで決定的に生成する。
- view context revisionをsurface/stone/interactionへ分け、各viewが実際のappearance/theme/layout依存だけを見る。
- interaction/hint変更でsurface/stoneをclear/rebuildせず、stone状態変更でcell surfaceを作り直さない。
- width/height/resolutionが同じresizeはrendererへ渡さず`resizeSkippedCount`を増やす。
- mount、DPR/viewport変更、context restore、backend replacementではresize cacheとview signatureをresetする。
- private Pixi tickerへ`maxFPS = 60`を設定する。Timelineへ別clock/throttleを追加しない。
- progressは既存ticker `deltaMS`を積算し、initial render、phase terminal write、explicit terminal render、idle stopを維持する。
- DOM compatibility、semantic layer、controller frame hash、strict committed apply、playback claimを変更しない。

### Dependencies

- Step 6でsettlement ownerが確定済みであること
- `docs/architecture-contracts.md` 7.3と`ui/board-visual/effect-branch-inventory.ts`を実装前に再確認

### Verification

- `test/ui.pixi-application.test.ts`: idempotent resize、cache reset、ticker `maxFPS`
- `test/ui.pixi-board-scene.test.ts`とview tests: dependency matrix、同一frame `updatedViews = 0`
- `test/ui.pixi-timeline.test.ts`: delta semantics、terminal update/render、settlement
- Application/ticker adapterを通す60/144/240Hz相当testでlive render毎秒65以下
- context loss、DPR、orientation、skin/theme、font、hint変更のfocused tests
- `npm run match:pixijs-board-playback-check`
- `npm run match:pixi-runtime-fallback-check`
- `npm run check:board-test-selectors`
- `npm run build:browser`

### Done

- 同一view/geometryのphysical workが0となり、高refresh時もrender上限、既存duration semantics、terminal frame、idle ticker契約が全て成立する。

## Step 8: FPS overlayへ500ms窓の最大frame時間を追加する

### Outcome

プレイヤーが平均FPS低下と単発stallを画面上で区別できる。

### Components

- `ui/fps-display.ts`
- `index.classic.html`（root markup source）
- `styles-layout-controls.css`
- `test/ui.fps-display.test.ts`
- `index.vite.html`、`index.html`、browser artifactsは生成先

### Behavior / contract

- 表示は`FPS: N` / `MAX: N ms`の2行。`MAX`は現在の500ms窓だけの連続RAF timestamp差の最大値。
- 最初のRAFは基準timestampにだけ使い、intervalへ数えない。
- 50ms以上の窓だけ`data-stall="true"`を付け、次の正常窓で解除する。
- background long gap時は両方`--`へresetし、復帰後最初のtimestampも基準点だけに使う。
- OFFでRAF loopをcancelし、hidden/ARIA/session stateの既存挙動を維持する。
- 表示値はgame state、CPU scheduling、Pixi ticker、input gateへ接続しない。

### Dependencies

- Step 1の表示仕様

### Verification

- `test/ui.fps-display.test.ts`で平均/MAX、窓reset、閾値class、初回timestamp、background復帰、OFF cleanupをfake RAFで確認
- markup/CSS contractで2行表示、警告色、画面端固定、pointer-events none、hiddenを確認
- 実ブラウザでON、通常更新、意図的50ms stall警告、回復、OFFを操作確認
- `npm run build:browser`

### Done

- 既存トグル/session挙動を維持して、500ms窓の平均FPSと最大frame間隔が常時読める。

## Step 9: 統合性能gate、cross-runtime検証、生成面同期を完了する

### Outcome

CPUカード/着手の500ms級停止が実際に消え、全authority/presentation契約とbrowser/Worker mirrorが一致した状態を確定する。

### Components

- Step 2のcapture script/report
- 全task-owned root source/tests/docs
- `public/*`、`browser-vite/generated/*`、`vite-dist/*`、`index.html`、`worker-public/*`等のscript生成面
- performance artifactはrepoのretention規則に従う

### Execution

1. focused JestをCPU、playback、Pixi、FPSの順で実行する。
2. `npm run check:window`、`npm run typecheck`、`npm run build:ts`を実行する。
3. `npm run build:browser`でclassic/browser registryとcachebusterを更新する。
4. `npm run worker:prepare`でVite bundleとWorker mirrorをroot sourceから生成する。
5. `npm run test:network:parity`、`npm run match:pixijs-board-playback-check`、`npm run match:pixi-runtime-fallback-check`を実行する。
6. playback/recovery/delivery riskが残る場合は`npm run match:cross-platform-smoke:vite`と最小の関連E2Eを追加する。
7. 同一profileでcandidate captureを取り、baselineと比較する。
8. `git diff --check`、generated/mirror check、task-owned diff、最終`git status --short`を確認する。

### Blocking performance gate

- deterministic call-count/stale/settlement/view/ticker testsが全成功
- Lv1 3scenarioのinvocation当たり`kind: 'sync'`合計p95/maxと、baselineで50ms以上だった各stall-contributing stageのp95/maxがbaseline比70%以上短縮。元から50ms未満のstageはbaselineを`max(5ms, 20%)`より大きく超えない
- 同じtime originでLong Taskと重なる250ms以上のapp-attributed同期sliceが0件。`wait`は別集計でこのgateへ含めない
- Pixi live render毎秒65以下、同一frame `updatedViews = 0`、同一geometryでphysical resize増加0
- CPU選択、発話、turn/pending、ordered events、animation terminal frame、strict/local settlementが回帰なし
- finalizer/writer/settlement errorとunhandled rejectionが0件

### Reference strict gate

- 外部負荷を隔離したvisible/focused環境でLv1 3scenarioの50ms以上app-attributed Long Taskが0件
- RAF interval p95/最大、CPU stage p95/最大が設計書のstrict threshold内
- 60/120/144/240Hzでterminal stateが一致し、capture validityが成立

### Residual-stall loop

blocking gateを外れた場合は、reportの最長stageをownerへ戻す。

- `card-availability`が長い: CardLogic selector evidenceと同一lane重複を再確認する。
- `card-context-*`が長い: feature-demand mappingまたは未共有target countを修正する。
- `move-candidates`/`commentary-context`が長い: 用途別semanticsを保った共通走査・一度計算を確認する。
- `canonical-commit`が長い: headless turn pipelineをprofileし、UI yieldで隠さずpure ownerの重複走査/cloneを修正する。
- `presentation-handoff`またはCPU stage外が長い: playback settlement、board scene apply、view rebuild、resize、GC allocationをPixi diagnosticsとtraceで分離する。
- 原因を特定できない場合も無条件`setTimeout(0)`やno-op finalizerを追加せず、instrumentationを一段細かくして同じgateを再実行する。

### Done

- 必須gateが全て通り、reference strict gateは適用環境で成功するか、適用不能理由とraw reportが明示される。
- browser/generated/Worker mirrorがroot sourceと一致する。
- task-owned filesだけがstageされ、関連しないdirty changeを含めず、検証済みのcoherent commitが作成される。

## 推奨commit境界

1. 仕様・architecture contractとdebug instrumentation/baseline
2. CPU delay、card usability、invocation analysisとfocused tests
3. typed playback settlementとnetwork/Pixi playback tests
4. Pixi invalidation/resize/tickerとbrowser生成面
5. FPS `MAX`表示、最終performance report、mirror同期

各commit前に関連生成面が必要かを確認し、mirror checkが失敗するsource-only中間commitは作らない。`git add -A`は使わず、そのunitのtask-owned pathsだけをstageする。

## Self-review

- 最適化前に計測基盤とbaselineを置き、修正後に「FPSが高く見える」だけで完了しない順序へした。
- delay 0ms化は応答待ちの修正であり、同期stall解消とは別Step・別metricにした。
- カード使用可否がtarget selectorを呼ぶ事実を反映し、early returnだけでなくlane付きevidence再利用まで実装範囲に含めた。
- card legal、placement、commentary basicの意味差を維持し、同値条件が証明できる時だけ共通盤面走査を許可した。
- usable 0件で重い派生を先に作らないよう、一括analysisではなくimmutable seed→必要用途の段階構築にした。
- `stateVersion`が無いローカルpathを同一と推測せず、非同期境界でseed/derived resultを破棄するfail-closed条件を入れた。
- playbackはstrict成功とcancel/abortを分離し、戻り値の伝播ownerと実行ownerを明示した。
- ticker上限testをTimeline直結fake tickではなくApplication/ticker adapter境界へ置き、実装と検証の層を一致させた。
- shared workstationのraw stallをrelease blockerへせず、deterministic契約、app-attributed ceiling、baseline比を必須gateにした。一方で隔離reference環境には50ms strict gateを残した。
- performance entryへcorrelation ID、sync/wait、timestamp rangeを持たせ、意図的waitやPromise待機を同期stallとして誤判定しないようにした。
- playbackの成功return、result生成前throw、strict handoff後cancel、empty payloadごとのresult個数とcleanup ownerをbranch matrixで固定した。
- browser表示へ影響する各root変更後の`npm run build:browser`、cross-runtime変更後のWorker mirror/network parityを計画へ含めた。
- 最終Stepにresidual-stall loopを設け、想定外の重いstageが残ったまま「既知箇所だけ直して完了」としない。
- 独立reviewで指摘されたearly rejectと一括analysisの矛盾、sync/waitを区別できない性能schema、playback失敗branchのresult個数を修正し、再確認でblocking findingなしとなった。

## 完了チェックリスト

- [ ] `01-rulebook.md`と`docs/architecture-contracts.md`を先行更新
- [ ] debug限定stage instrumentationと再現fixtureを実装しbaseline取得
- [ ] player-awareなCPU delay policyへ統合
- [ ] 使用可否0件のcard context完全skip
- [ ] card type別feature-demandとlane付きselector evidence再利用
- [ ] `CpuTurnAnalysisSeed`→用途別derived resultとstateVersion/epoch stale guard
- [ ] CPUカード・着手・発話・headless結果のparity確認
- [ ] typed `PlaybackSettlementResult`へ移行しcallback path削除
- [ ] local/strict/watchdog/cancelのexactly-once settlement確認
- [ ] Pixi view別signature、resize no-op、private ticker 60Hz上限
- [ ] FPS overlayへ500ms窓の`MAX`表示と警告状態を追加
- [ ] focused Jest、window boundary、typecheck/build成功
- [ ] browser performance blocking gate成功
- [ ] 適用可能なreference環境でstrict gate成功または非適用根拠記録
- [ ] Pixi browser/fallback、network parity、必要なE2E成功
- [ ] `npm run build:browser`と`npm run worker:prepare`で生成面同期
- [ ] `git diff --check`、task-owned diff、最終status確認
- [ ] 検証済みtask-owned変更のみcommit
