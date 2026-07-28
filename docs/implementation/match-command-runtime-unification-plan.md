# Worker／ローカル共通コマンド実行 統合実装計画

## 文書の役割

- Status: reviewed implementation plan; implementation not started
- Date: 2026-07-28
- 設計の一次情報: `docs/implementation/match-command-runtime-unification-design.md`
- 内部契約の一次情報: `docs/architecture-contracts.md`
- 対象: Worker／local server の canonical match command execution cluster
- 非対象: プレイヤー向け仕様、UI、カード効果、room lifecycle、HTTP／storage／SSE adapter の再設計

この計画は、設計書で確定した「同期shared stage＋runtime adapter」を実装するための手順である。設計判断が必要になった場合、計画を局所的に補完して進めず、設計書へ戻って矛盾を解消する。

## 1. 実装開始ゲート

調査時の作業ツリーには、火・草・水の意志、演出、Pixi、generated／mirror にまたがる未コミット変更がある。これらは本件の変更ではない。

実装担当は次の条件をすべて満たすまで、ソース変更を開始しない。

1. 既存の別作業が完了し、`git status --short` がクリーンである。
2. `HEAD` が実装対象の最新統合点である。
3. `workers/match-worker.ts`、`scripts/local-match-server.ts`、`utils/match-command-runtime.ts`、`utils/match-runtime-ports.ts` に他作業の未統合差分がない。
4. baseline testが現行`HEAD`で再現する。

クリーンにならない場合は、worktreeを勝手に作らず、該当ファイルと状況を報告して停止する。

## 2. 実装中に守る不変条件

- `utils/match-publish-controller.ts`がpublish transactionの所有者であり続ける。
- `game/turn/turn_pipeline.ts`がgameplay ruleの所有者であり続ける。
- shared command runtimeはversion commit、save、broadcastをしない。
- Workerのdynamic importはauthority mutation開始前に解決する。
- localの`applyCommandPublishToSnapshot()`と`local-match-runtime.applyCommand()`は同期のままにする。
- raw events、playback、effect logs、pending identity、PRNG消費、charge deltaの値と順序を変えない。
- `worker-public/`、`dist/`、generated registryは直接編集しない。
- `01-rulebook.md`と`正本/*.md`は変更しない。
- missing capabilityをambient global、silent no-op、成功形fallbackで補わない。

## 3. 予定する変更面

### 既存ファイル

- `utils/match-runtime-ports.ts`
- `utils/match-command-runtime.ts`
- `utils/match-runtime-core.ts`（削除）
- `utils/match-authority/projection.ts`
- `scripts/local-match-server.ts`
- `scripts/local-match-runtime.ts`
- `workers/match-worker.ts`
- `workers/match-worker-timeout-controller.ts`
- `test/match-command-runtime.test.ts`
- `test/match-runtime-parity.test.ts`
- `test/local-match-server.publish-contract.test.ts`
- 関連する`test/workers.match-*.test.ts`
- `docs/architecture-contracts.md`

### 追加候補

- `test/match-command-runtime-authority.test.ts`

新しいproduction moduleは原則追加しない。`utils/match-command-runtime.ts`が大きくなり、内部型だけを分離する必要が出た場合でも、authority entryを増やさず、`utils/match-runtime-ports.ts`の型へ収める。

`utils/match-runtime-core.ts`、`executeMatchRuntimeCommand()`、`MatchCommandRuntimePort`はTask 6で削除する。既知production consumerの`scripts/local-match-runtime.ts`はthin local facadeを直接同期呼出しする。

## 4. Task 0 — baselineとcharacterizationを固定する

### 目的

コード移動前に、Workerとlocalが現在返す意味を比較可能なfixtureへ固定する。

### 手順

1. `git status --short`と対象ファイルの`git diff`を確認する。
2. `rg`で次のconsumer／symbol inventoryを保存する。
   - `applyCommandPublishToSnapshot`
   - `prepareMatchCommandAction`
   - `shouldSkipMatchCommandTurnStart`
   - `executeMatchRuntimeCommand`
   - `applyCommandToSnapshot`
   - `TurnPipeline.applyTurnSafe`
   - `validateAuthoritativePendingSelectionResult`
   - `reconcileTurnStartAndCollectPlayback`
3. `test/match-runtime-parity.test.ts`のfixture helperを拡張し、同じcanonical snapshot、command、seedをWorker/local両側へ渡す比較表を作る。viewer projectionを入力に使わない。
4. `test/match-command-runtime-authority.test.ts`をTask 0で必ず追加する。既存fixtureで直接比較できない内部result shapeのcharacterizationと、既存test名／scenario対応表をここへ置く。
5. summary比較ではなく、full raw event object、full playback event object、effect logs、PRNG `{seed, calls}`、pending identity、charge delta、turn-start実行回数を比較する。viewer projectionは既存projection contract testへ分離する。

### 固定する値

- `ok`、`rejectedReason`、`errorMessage`
- next `gameState`と`cardState`
- serialized PRNG stateとcalls
- ordered raw `events[]`
- action playback、turn-start playback、合成後playback
- action effect logs、turn-start logs、合成後logs
- resolved `action`
- pending instance、`pendingEffectId`
- `skipTurnStart`とpost-action reconciliation実行有無
- charge deltaのaction直後、turn-start後、最終snapshotでの扱い
- debug fill、projection metadata／両hand hidden token拒否の結果
- timeout force-pass
- Worker/local facadeのnormal success、debug success、pipeline rejection shape
- accepted/rejected/idempotent replay/direct local runtimeのpublic deltaとcanonical delta

### 必須scenario

- 通常place成功／拒否
- 全カードuse
- pending follow-up成功／stale／invalid target
- sub-placement継続
- current player継続／交代
- turn-start eventなし／複数
- serialized PRNG正常／破損／欠落
- AUTO disabled／成功／planner unavailable／actionなし
- network debug disabled／fill成功／fill失敗
- canonical handでのdebug use-card成功／projection metadataまたはいずれかのhidden handを含むsnapshotの両runtime拒否
- pipeline rejection with raw events
- invalid authoritative pending result
- timeout force-pass
- game over直前／直後

### 検証

```powershell
npx jest --runInBand --runTestsByPath test/match-command-runtime.test.ts test/match-command-runtime-authority.test.ts test/match-runtime-parity.test.ts test/local-match-server.publish-contract.test.ts test/local-match-server.presentation-journal.test.ts test/workers.match-prng-contract.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-auto-turn-authority.test.ts test/workers.match-worker-timeout-controller.test.ts test/network.playback-event-assembly.contract.test.ts
npm run test:match:parity
```

既存テストが同じ値を既に固定している場合は、重複testを増やさず、そのtest名とscenarioの対応表を新規authority testへ記録する。挙動を変えずにcharacterizationだけを追加し、通過後に独立commitする。

## 5. Task 1 — typed DTO／capability契約を追加する

### 目的

runtime module全体を渡さず、各shared stageが必要とする能力だけを型で固定する。

### 変更

`utils/match-runtime-ports.ts`へ次を追加する。

- `MatchCommandSnapshotCapabilities`
- `MatchCommandSchemaCapabilities`
- `MatchAutoCommandCapabilities`
- `MatchCommandDebugCapabilities`
- `MatchCommandRandomCapabilities`
- `MatchCommandPipelineCapabilities`
- `MatchCommandTurnStartCapabilities`
- `MatchCommandAuthorityCapabilities`
- `MatchCommandPresentationCapabilities`
- `MatchCommandExecutionCapabilities`
- `MatchCommandAuthorityContext`
- `MatchCommandInitialDeckOptions`
- `PreparedMatchCommandExecution`
- `AppliedMatchCommandExecution`
- `MatchCommandPresentationAssembly`
- `TurnStartReconciliationResult`
- `MatchCommandPrepareResult`
- `MatchCommandExecutionSuccess`
- `MatchCommandExecutionFailure`
- `MatchCommandExecutionResult`

各interfaceは利用する関数とDTOだけを持つ。Worker module namespace、local server、request、Durable Object state、`globalThis`を型へ含めない。

### 実装規則

- success/failureはdiscriminated unionにする。
- `snapshot`、`body`、`resolvedAction`、raw eventsの境界は`unknown`を受けてもstage内でvalidate済みDTOへ狭める。
- contextにはcanonical snapshot、authority-resolved player key、room seed、state version、typed initial deck／board options、network debug/auto flagだけを含める。
- authority player keyはouter authority layerから受け取り、bodyのactor/playerKey/paramsから再導出しない。
- contextにraw room、seat token、storage、stream、request、Durable Object stateを含めない。
- `turnStart` groupは事前解決済みの同期関数だけを持ち、Promise／dynamic importを含めない。
- shared success resultは`rawEvents`を持つ。Worker/local success facadeは現行どおりこれを省略し、Workerだけがdebug `action`とpipeline failure `events`を保持、local serverは現行どおり両者を省略する。
- capability不足のerror codeをTask 0 fixtureと一致させる。
- runtime adapterのmodule可用性preflightと、shared stageのbranch-required capability validationを別の型にする。

### 検証

```powershell
npm run typecheck
npx jest --runInBand --runTestsByPath test/match-command-runtime.test.ts
```

型追加だけでruntime behaviorを変えず、通過後に独立commitする。

## 6. Task 2 — shared prepare／apply stageを実装する

### 目的

canonical commandの準備とgameplay outcome決定を`utils/match-command-runtime.ts`へ一元化する。

### shared API

次はsingle executor内部stageの具体名である。unit test用exportは可能だが、production adapterは直接呼ばない。

- `prepareMatchCommandExecution()`
- `applyPreparedMatchCommandExecution()`

### `prepareMatchCommandExecution()`

次の順序を現行fixtureどおりに実装する。

1. current branchに必要なcapability validation
2. shared `validateCanonicalMatchCommandSnapshot()`でprojection metadataとblack/white両handのhidden tokenを検査し、違反時は`INVALID_SNAPSHOT`
3. snapshot clone
4. stale charge delta cleanup。presentation stateは現行順序どおりturn-start直前／finalizeまで残す
5. debug fill terminal branch
6. AUTO canonical body resolution
7. `prepareMatchCommandAction()`
8. PRNG restore／contextのroom seed/state versionからderived seed fallback
9. `shouldSkipMatchCommandTurnStart()`

Worker側のdynamic importとprojected hidden-hand repairをこの関数内へ入れない。repairは削除し、test/debug harnessもcanonical snapshotを渡す。

### `applyPreparedMatchCommandExecution()`

次だけを一度実行する。

1. `TurnPipeline.applyTurnSafe()`
2. rejection projection
3. `validateAuthoritativePendingSelectionResult()`
4. applied DTO construction

adapterへruleの再計算やretryを残さない。

### test

- capability不足ごとのfail-closed code
- raw room／storage／streamをcontextへ渡せない型contract
- `_meta.projectedForSeat`／`_meta.viewerRole`または両handのhidden tokenを両runtime共通で拒否
- debug fill terminal result
- AUTO成功／失敗
- seat／pending validation
- PRNG stateの3経路
- sub-placement／pending skip
- pipeline成功／拒否
- invalid authoritative pending result
- `applyTurnSafe()` call countが1

### 検証

```powershell
npm run typecheck
npx jest --runInBand --runTestsByPath test/match-command-runtime.test.ts test/match-command-runtime-authority.test.ts
```

このTaskではWorker/local production adapterをまだ切り替えない。unit testから新APIを直接検証し、通過後に独立commitする。

## 7. Task 3 — shared presentation／turn-start／finalizeとsingle entryを実装する

### 目的

action resultからpresentationを組み立て、turn-startを実行して合成する処理を一元化し、A〜Eを所有する唯一のproduction entryを完成させる。

### shared API

- `assembleMatchCommandActionPresentation()`
- `shouldReconcileMatchCommandTurnStart()`
- `reconcileMatchCommandTurnStart()`
- `finalizeMatchCommandExecution()`
- `executeMatchCommand()`

### 処理境界

`assembleMatchCommandActionPresentation()`:

- raw eventsからaction playback／presentation eventsを作る。
- action effect logsを作る。
- diagnostics DTOを返す。
- pre-action→post-actionの`restoreMissingChargeDeltaEvents()`を一度だけ適用し、turn-start前のaction delta queueをDTOへ退避する。
- charge delta queue以外のcanonical gameplay fieldを変更しない。

`shouldReconcileMatchCommandTurnStart()`:

- `skipTurnStart`
- pre-action player
- post-action current player

だけから実行要否を返す。

`reconcileMatchCommandTurnStart()`:

- preloaded sync `turnStart` capabilitiesだけを使う。
- turn-start前hand capture、presentation cleanup、last-started player、game over、card-state normalization、PRNG復元、`applyTurnStartPhase()`、PRNG保存を現行順序で一度だけ行う。
- raw events、playback、effect logs、draw playbackを`TurnStartReconciliationResult`へまとめる。
- Promise、dynamic import、runtime room、storage、streamを読まない。

`finalizeMatchCommandExecution()`:

- action playbackの後へturn-start playbackをappendする。
- action logsの後へturn-start logsをappendする。
- turn-start後queueが空ならStage Cで退避したaction deltaを戻し、非emptyならそのqueueを保持する。
- transient presentation stateを除去する。
- shared success resultを返す。

`executeMatchCommand()`:

- A→B→C→D→Eを同期的に一度だけorchestrateする。
- debug/rejection terminal resultでは後続stageを呼ばない。
- production adapterが呼べるcanonical entryをこれ一つにする。
- local inputに対してthenableを返さない。

### test

- raw event順を保持
- action→turn-start playback順
- action→turn-start effect log順
- diagnostics on/off
- reconciliation不要時にcapabilityを呼ばない
- turn-start capabilityは事前解決済みで、executor実行中のPromise生成が0
- charge deltaの保存／復元
- final transient cleanup
- production orchestrationのstage call order／call count

### 検証

```powershell
npm run typecheck
npx jest --runInBand --runTestsByPath test/match-command-runtime.test.ts test/match-command-runtime-authority.test.ts test/network.playback-event-assembly.contract.test.ts test/shared.playback-event-helpers.test.ts
```

production adapterはまだ切り替えず、unit testでsingle entryを直接通してから独立commitする。

## 8. Task 4 — local adapterをshared stageへ切り替える

### 目的

同期contractを維持したまま、`scripts/local-match-server.ts`のcanonical command bodyをshared authorityへ委譲する。

### 変更

1. static CommonJS importsからtyped capability builderを作る。
2. 現行どおりschema、pipelineのmodule可用性preflightをcommand body処理前に行い、既存error precedenceを維持する。
3. outer authority layerが確定した`playerKey`を含む`MatchCommandAuthorityContext`を構築し、bodyからplayerを再導出せず、seat token／storage／HTTP stateを切り離す。
4. `executeMatchCommand()`を一度だけ同期呼出しする。
5. shared resultを既存local result shapeへprojectし、success `rawEvents`、debug successの`action`、pipeline failureの`events`を省略する。
6. `includePreviousSnapshotForChargeDelta: false`を維持し、payload builderでprevious snapshot deltaを復元しない。
7. 旧prepare、PRNG、direct pipeline、pending result validation、turn-start reconciliation、playback/log append、success bodyを同じTaskで削除する。
8. `applyExpiredTurnTimeoutIfNeeded()`のcommand失敗時`Core.applyPass()`／独自turn-start fallbackを削除する。timeout commandが成功しなければsnapshot、version、timer authorityを変更せず`applied: false`にする。
9. local facadeとtimeout pathに個別stage orchestrationを残さない。

`test/local-match-server.presentation-journal.test.ts`へ、timeout command rejection時にsnapshot、state version、turn timer、presentation journalが変化しないcaseを明示的に追加する。

### 同期contract test

```ts
const facadeResult = LocalMatchServer.applyCommandPublishToSnapshot(room, body, playerKey);
expect(facadeResult && typeof (facadeResult as any).then).not.toBe('function');

const publicResult = runtime.applyCommand(body);
expect(publicResult && typeof (publicResult as any).then).not.toBe('function');
```

fake timerや`await`で同期性を隠さない。

### 検証

```powershell
npm run typecheck
npx jest --runInBand --runTestsByPath test/match-command-runtime.test.ts test/match-runtime-parity.test.ts test/local-match-server.publish-contract.test.ts test/local-match-server.presentation-journal.test.ts
npm run test:match:parity
```

Workerはまだ旧経路なので、ここでlocal結果をTask 0 fixtureと比較できる。通過後に独立commitする。

## 9. Task 5 — Worker adapterをshared stageへ切り替える

### 目的

Worker固有の非同期module resolutionを外縁へ残し、canonical command bodyをshared authorityへ委譲する。

### 変更

1. command種別から必要capabilityをauthority mutation前に解決する。
2. preload registryとmodule cacheを既存経路のまま使う。
3. 現行どおりschemaをentry preflightし、debug fill branchでは不要なpipeline moduleを要求しないerror precedenceを維持する。
4. normal commandではpipeline、presentation、turn-start moduleもentry前に常に解決する。canonical apply後に`await`しない。
5. `repairNetworkDebugProjectedHandForCardUse()`を削除し、test/debug harnessが公開projectionをroomへ戻している箇所をcanonical fixtureへ直す。raw bodyからrepair actionを再構築しない。
6. outer authority layerが確定した`playerKey`を含む`MatchCommandAuthorityContext`を構築する。projection metadata／両hand検査はWorker固有実装を置かず、shared Stage Aへ委譲する。
7. `executeMatchCommand()`を一度だけ同期呼出しする。
8. shared resultを既存Worker result shapeへprojectし、success時の`rawEvents`は省略、debug successの`action`とpipeline failureの`events`を保持する。
9. Worker側の`includePreviousSnapshotForChargeDelta`を`false`へ変更し、payload builderでprevious snapshot deltaを復元しない。
10. 旧prepare、PRNG、direct pipeline、pending result validation、turn-start reconciliation、playback/log append、success bodyを同じTaskで削除する。
11. `workers/match-worker-timeout-controller.ts`から`loadCoreLogicModule`、`Core.applyPass()`、`reconcileTurnStartAndCollectPlayback()` fallbackを削除する。`applyTimeoutPassToSnapshot` resolver可用性は`refreshTurnTimer()`／saveより前に検査し、不在／失敗ならauthority mutation前に`applied: false`を返す。

preloadは設計書のbranch表どおりにする。regular/debug use-card/timeoutはAUTO plannerをloadせず、AUTOだけがplanner群を要求し、debug fillだけがDebugActionsを要求する。

### fail-closed確認

- schema module不在
- pipeline module不在
- AUTO planner load失敗
- debug action module不在
- turn-start module load失敗
- preload key不整合
- projection metadata／blackまたはwhite handのhidden token
- timeout resolver不在／shared command rejection

既存error codeとHTTP/publish projectionを維持する。

### 検証

```powershell
npm run typecheck
npx jest --runInBand --runTestsByPath test/workers.match-publish-sanitize.test.ts test/workers.match-publish-idempotency.test.ts test/workers.match-publish-effect-logs.test.ts test/workers.match-pending-effect-id.test.ts test/workers.match-prng-contract.test.ts test/workers.match-auto-turn-authority.test.ts test/workers.match-worker-timeout-controller.test.ts test/workers.match-worker-publish-controller.test.ts test/workers.match-worker.publish-persistence.test.ts test/match-publish-controller.authority.test.ts test/network.playback-event-assembly.contract.test.ts test/match-runtime-parity.test.ts
npm run test:match:parity
```

通過後に独立commitする。

## 10. Task 6 — 旧core削除からarchitecture／generated同期まで一括で閉じる

### 目的

旧bodyとcallback authority入口を完全に除去し、direct local runtimeのtransient delta lifecycleをpublish controllerと揃え、authority guard、architecture contract、browser/Vite registry、Worker mirrorまで同じ整合したcommitで閉じる。

### `MatchRuntimeCore`

1. `scripts/local-match-runtime.ts`を`LocalMatchServer.applyCommandPublishToSnapshot()`の直接同期呼出しへ移す。
2. `test/network.authority-path-hardening.test.ts`の旧callback-forwarding testをsingle executor／local facade authority testへ置き換える。
3. `utils/match-runtime-core.ts`を削除する。
4. `utils/match-command-runtime.ts`から`executeMatchRuntimeCommand()`を削除する。
5. `utils/match-runtime-ports.ts`から`MatchCommandRuntimePort`と旧generic command DTOを削除する。
6. source／test／generated registry以外のconsumerが0であることを`rg`で確認する。

### direct local runtime charge delta

1. shared resultのdelta入りsnapshotからreturn用public snapshotをcloneする。
2. public responseを構築した後、return前にcanonical `room.snapshot`へ`stripTransientChargeDeltaState()`を適用する。
3. previous snapshotからの`restoreMissingChargeDeltaEvents()`を削除する。
4. accepted responseには今回delta、`runtime.getSnapshot()`には`[]`、rejected／idempotent replayでは新規deltaなしを固定する。

### charge delta hash contract

1. `utils/match-authority/projection.ts`のcanonical/projected hash source cloneで`cardState.chargeDeltaEvents`を必ず`[]`にする。
2. delta-bearing accepted responseとdelta-free recovery snapshotが、同じstate version／gameplay stateなら同じcanonical hashと`projectedSnapshotHash`を持つtestを追加する。
3. publish controllerがcleanup後の`room.snapshot`を再hashしても`room.authoritativeStateHash`と一致することを固定する。
4. direct local runtimeもpublic clone作成前／canonical cleanup後でauthority hashが変わらないことを固定する。
5. rejectionとidempotent replayでhashが変わらないことを固定する。

### authority guard

`test/match-command-runtime-authority.test.ts`へ、ASTまたは安定したsource inspectionで次を固定する。

- `workers/match-worker.ts`と`scripts/local-match-server.ts`に`TurnPipeline.applyTurnSafe(`がない。
- 両adapterに`validateAuthoritativePendingSelectionResult(`がない。
- 両adapterにcommand-pathの`prepareMatchCommandAction(`がない。
- shared `utils/match-command-runtime.ts`にこれらのowner呼び出しがある。
- projection metadata／hidden hand validationがshared `validateCanonicalMatchCommandSnapshot()`だけにあり、Worker/local adapterに独自判定がない。
- Worker/local両facadeがshared stageを呼ぶ。
- Worker/local両facadeが個別stageでなく`executeMatchCommand()`だけを呼ぶ。
- local timeout pathと`workers/match-worker-timeout-controller.ts`に`Core.applyPass()`／独自turn-start fallbackがない。
- timeout controllerはshared timeout resolver不在時にauthority mutation前の`applied: false`となる。
- `utils/match-runtime-core.ts`、`executeMatchRuntimeCommand`、`MatchCommandRuntimePort`が残っていない。
- `repairNetworkDebugProjectedHandForCardUse`が残っていない。
- runtime import cycleがない。

行数、文字列全体、関数の並び順をguardにしない。必要ならTypeScript ASTでcall expressionのcalleeを検査する。

### inventory

Task 0と同じ72関数inventoryを取り直し、command execution clusterだけが減ったことを確認する。route、room lifecycle、payload decorationの残存重複はこのTaskで動かさない。

### 検証

```powershell
npm run typecheck
npm run check:window
npx jest --runInBand --runTestsByPath test/match-command-runtime-authority.test.ts test/match-command-runtime.test.ts test/match-runtime-parity.test.ts test/network.authority-path-hardening.test.ts test/local-match-server.publish-contract.test.ts test/utils.match-authority.public-snapshot.test.ts test/utils.match-authority.publish-artifacts.test.ts test/workers.match-publish-sanitize.test.ts
npm run test:match:parity
```

このfocused検証後もまだcommitしない。削除sourceとgenerated registryが不整合な中間commitを作らず、以下のarchitecture／generated／最終検証まで同じTaskで続ける。

### architecture文書

`docs/architecture-contracts.md`へ次だけを反映する。

- `utils/match-command-runtime.ts`がWorker/localのcanonical command execution ownerである。
- A〜Eの順序を同期`executeMatchCommand()`だけが所有する。
- Worker/localはcontext construction、module preflight/resolution、result projection、runtime I/Oだけを担うadapterである。
- local sync、Worker async pre-entry loader、executor内await禁止という境界。
- charge deltaはshared Stage C/Eが今回queueを作り、public artifact生成後にouter controller/facadeがcanonical queueを除去する。
- canonical／projected hashはtransient charge deltaを入力から除外する。
- projected-hand repairは削除し、production/testともcanonical snapshotをauthorityへ渡す。
- §8.5／§8.7へ`chargeDeltaEvents`をcanonical／projected hash sourceから除外し、公開snapshot shapeは変えないことを追記する。
- §13の重複 debt はcommand execution clusterについてだけ解消済みとし、他のnetwork constants／route logicの重複は残す。

`01-rulebook.md`と`正本/*.md`は変更しない。

### generated／mirror

旧source module削除後に`npm run build:browser`で`public/module-registry.js`とcachebusterを更新する。root sourceとtestが通ってから一度だけ`npm run worker:prepare`を実行する。`worker-public/`の差分はgenerator出力であることを確認し、手で修正しない。

生成後、次を確認する。

```powershell
rg -n "match-runtime-core|executeMatchRuntimeCommand|MatchCommandRuntimePort" browser-vite/generated/startup-modules.ts public/module-registry.js worker-public/public/module-registry.js
```

期待結果は0件である。

### 最終検証

```powershell
npm run typecheck
npm run build:ts
npm run check:window
npm run test:match:parity
npm run test:network:parity
npm run build:browser
npm run worker:prepare
npm run checkall
git diff --check
git status --short
```

`worker:prepare`が`build:vite`を内包するため、直前に重複して`build:vite`を実行しない。旧source module削除でclassic registryが変わるため`build:browser`は必須である。表示自体は変更しないのでvisual testは必須ではない。公開network behaviorに差が出た場合だけ、最小のnetwork E2Eを追加する。

### 最終diff確認

- task-owned source、test、architecture doc、generator outputだけが含まれる。
- `worker-public/`にroot対応のない手編集がない。
- `dist/`をcommit対象に含めない。
- `01-rulebook.md`と`正本/*.md`に差分がない。
- unrelated user changesがない。

すべて通過後、Task 6のsource削除、test、architecture doc、browser/Vite registry、Worker mirrorを一つの整合したcommitにする。以前のTask commitをsquashする必要はない。

## 11. 完了判定表

| 設計要件 | 実装箇所 | 証明 |
| --- | --- | --- |
| canonical prepareが一つ | `utils/match-command-runtime.ts` | unit＋authority guard |
| pipeline applyが一つ | `utils/match-command-runtime.ts` | call count test＋authority guard |
| pending result validationが一つ | `utils/match-command-runtime.ts` | unit＋authority guard |
| A〜E orchestrationが一つ | `executeMatchCommand()` | stage order/call count＋authority guard |
| action presentation/turn-start/finalizeが一つ | `utils/match-command-runtime.ts` | playback/log ordering tests |
| Worker async差をentry前へ外縁化 | `workers/match-worker.ts` | module failure tests＋executor中Promise 0 |
| local sync維持 | `scripts/local-match-server.ts`、`scripts/local-match-runtime.ts` | non-thenable test |
| timeoutもsingle authority | local timeout path、`workers/match-worker-timeout-controller.ts` | resolver不在fail-closed＋fallback 0 guard |
| publish transaction不変 | `utils/match-publish-controller.ts` | authority/publish contract tests |
| Worker/local outcome一致 | parity fixtures | `npm run test:match:parity` |
| charge delta ownerが一つ | shared Stage C/E＋outer cleanup | accepted/rejected/replay/direct truth-table test |
| delta cleanupでhash不変 | `utils/match-authority/projection.ts` | cleanup前後canonical/projected hash test |
| projection repairを削除 | Worker／test harness | shared canonical snapshot guard＋consumer 0 |
| callback coreを削除 | `utils/match-runtime-core.ts`削除 | consumer 0＋authority guard |
| network contract不変 | publish/SSE tests | `npm run test:network:parity` |
| mirrorは生成のみ | `worker-public/` | `npm run worker:prepare`＋diff review |
| ownership/hash契約を正確に更新 | `docs/architecture-contracts.md` §8.5／§8.7／§13 | doc diff review |

## 12. 停止条件

次の場合は推測で進めず停止し、設計判断を求める。

- baseline時点でWorker/localの結果が既に一致しない。
- local sync consumerがPromise化なしでは共有stageを呼べない。
- production room snapshotがprojection metadataまたはいずれかのhandのhidden tokenを含める正規経路が見つかる。
- charge delta差が互換処理ではなくplayer-visible rule差を示す。
- existing public payload shapeの両立にnetwork API変更が必要になる。
- authority module間のcycleを解くために新しい依存方向が必要になる。
- unrelated dirty changeが対象ファイルと重なり、安全に分離できない。
- focusedまたはparity testが再試行なしに再現しない。

## 13. Self-review

初案ではWorkerとlocalを同時に切り替える一つの大きなTaskにしていた。しかし、それではshared stageの不具合かruntime adapterの不具合かを切り分けにくい。characterization、typed ports、single executor、local migration、Worker migration、旧core削除／guardの順に分離し、各段階を通過したcommitとして残す構成へ修正した。

また、行数減少や72個の同名関数削減を完了条件にすると、無関係なroute logicまで動かす誘因になる。authority symbolの直接呼出し禁止と、shared stageのowner存在を構造guardにし、command clusterだけを閉じるよう修正した。

Workerのprojected hidden-hand repairをshared hookやpre-authority adapterへ移す案は、canonical action確定前にraw bodyの解釈を複製する。repair自体を削除し、test/debug harnessもcanonical snapshotを渡す。projection metadataまたはいずれかのhandのhidden tokenは、shared Stage Aだけが両runtime共通でfail closedにする。

Workerのturn-start moduleをaction apply後にloadする案も、mutation途中の`await`を残すため退けた。normal commandの必要moduleをすべてentry前に解決し、両runtimeが同じ同期`executeMatchCommand()`を一度だけ呼ぶ形へ固定した。

charge deltaは現行localとWorkerで責務位置が異なる。実装時判断へ残さず、shared Stage C/Eが今回queueを作り、outer controller／direct facadeがpublic artifact生成後にcanonical queueを除去し、previous snapshotからは再構築しない真理値表へ固定した。

delta入りresponseを作った後にcanonical queueを除去すると、現行hash実装では同一versionのhashが変わる。canonical／projected hash sourceから`chargeDeltaEvents`を除外し、cleanup前後でhash不変とするcontractを追加した。

`MatchRuntimeCore`を維持／削除の選択肢も残さず、既知consumerをlocal facadeへ移して旧core／portを削除する。

旧core削除だけを先にcommitするとgenerated registryとWorker mirrorが削除済みsourceを参照するため、Task 6はarchitecture更新と全generator同期まで一つのcommitに統合した。

timeout resolver不在時の`Core.applyPass()` fallbackも別authorityになるため、local/Worker双方から削除し、shared resolverが成功しなければauthority mutation前にfail closedとする手順・test・guardを追加した。

自己レビュー時点で、実装担当が選ぶ必要のある公開仕様、authority owner、migration順序、検証基準は残していない。
