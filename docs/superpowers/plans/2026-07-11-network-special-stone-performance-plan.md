---
status: active
owner: repository-maintainers
scope: network-special-stone-performance
created: 2026-07-11
updated: 2026-07-11
---

# ネット対戦・特殊石大量局面の外面不変最適化 実装計画

## 1. 文書の役割

**対象:** [設計書](../specs/2026-07-11-network-special-stone-performance-design.md) で定義した、CPUを含まないネット対戦・特殊石大量局面の軽量化。

**文書の役割:** 実装を依存順に分割し、各phaseの入力、変更対象、成果物、検証、完了条件を定義するアクティブ計画である。具体的なコマンドと一手ずつのチェックリストは [実行手順書](2026-07-11-network-special-stone-performance-runbook.md) に従う。

**Source of truth:** `01-rulebook.md` と `正本/*.md` の外面挙動、`docs/architecture-contracts.md` のauthority / Single Visual Writer契約を変更しない。

**Non-goals:** CPU、カード仕様、演出時間、演出順、public network schema、生成物のsource化は対象外である。

## 2. 実行状態

| Phase | 状態 | 依存 | 完了証拠 |
| --- | --- | --- | --- |
| 0. 再現・baseline | pending | なし | baseline JSON/Markdown、characterization PASS |
| 1. Marker context線形化 | pending | Phase 0 | scan counter、parity、benchmark |
| 2. 合法手context compile | pending | Phase 1 | legal move parity、compile counter |
| 3. Render / presentation投影共有 | pending | Phase 2 | render counter、UI focused tests |
| 4. Worker publish artifact再利用 | pending | Phase 0～3 | viewer parity、projection counter |
| 5. Accepted publish永続化統合 | pending | Phase 4 | failure injection、save counter |
| 6. Client snapshot ownership軽量化 | pending | Phase 3～5 | mutation guard、clone counter |
| 7. Playback phase内軽量化 | pending | Phase 3、6 | duration/order parity、DOM counter |
| 8. 総合検証・完了報告 | pending | Phase 0～7 | final report、全bundle PASS |

既存の `2026-07-11-behavior-preserving-full-refactor-master-plan.md` と同じphysical checkoutで実装phaseを並行実行しない。本計画を開始するときは、他方の通常実装taskが完了・停止していることを確認する。

## 3. 共通制約

- 毎taskの開始と終了に `git status --short` を実行する。
- unrelatedまたは説明不能なdirty fileがあれば実装を開始しない。
- branch、tag、worktreeを作らない。必要ならユーザーの明示指示を得る。
- root TypeScriptを先に編集し、`dist/`、`worker-public/`、`public/module-registry.js` を手編集しない。
- characterization出力が変わった場合、期待値を更新して通さない。
- random call order、marker order、events order、animation phaseを変えない。
- cache/indexはoperation-localとし、canonical stateへ保存しない。
- Workerとlocal serverの共通処理はshared authority helperへ置き、別実装を作らない。
- UIはreadonly projectionのみを保持し、gameplay authorityにしない。
- 各taskはfocused verification後にtask-owned filesだけをcommitする。

## 4. File map

| 領域 | 主な変更候補 | 主な検証候補 |
| --- | --- | --- |
| Marker分類 | `game/logic/cards/markers.ts`, `game/logic/cards-internal/protection-context.ts`, `game/logic/markers_adapter.ts` | `test/game.protection-context.performance-contract.test.ts`, `test/game.marker-cell-index.test.ts`, `test/game.protection-context.test.ts` |
| 合法手 | `game/logic/core.ts`, `game/logic/cards/flips.ts`, `game/move-generator.ts`, `game/logic/context.ts` | `test/game.core.compiled-flip-context.test.ts`, move-generator / protection focused tests |
| Render投影 | `ui/board-renderer.ts`, `ui/diff-renderer.ts`, `ui/diff-renderer/projector.ts`, `shared/board-hint-projection.ts` | `test/ui.board-render-projection.test.ts`, `test/ui.stone-rendering.test.ts`, `test/ui.render-scheduler.test.ts` |
| Presentation検索 | `game/turn/presentation-helpers.ts`, `game/turn/pipeline_ui_adapter.ts`, `game/turn/pipeline-ui/*` | `test/game.turn-presentation-event-index.test.ts`, turn-start order / pipeline adapter tests |
| Worker publish | `utils/match-publish-controller.ts`, `utils/match-authority/projection.ts`, `utils/match-authority/presentation-journal.ts`, `workers/match-worker.ts`, `workers/match-worker-broadcast-controller.ts` | `test/utils.match-authority.publish-artifacts.test.ts`, Worker/local/network parity |
| Client snapshot | `ui/network/snapshot.ts`, `ui/network/visual-state-store.ts`, `ui/network/presentation-timeline.ts`, `ui/network/intake-*` | `test/ui.network-visual-state-store-readonly.test.ts`, existing snapshot/single-writer tests |
| Playback | `ui/animation-engine.ts`, `ui/layout-read-batch.ts`, `ui/transient-overlay-batch.ts`, event handlers | animation, noanim, layout-batch, visual tests |
| Perf harness | `scripts/perf/measure-network-special-stone-late-game.ts`, `test/helpers/*`, `docs/perf/*` | script contract test、baseline/final report |

実装時に実ファイル構造が変わっている場合、同じ責任を持つ現行sourceを探し、計画のfile mapを先に更新してから作業する。

---

## Phase 0 — 決定的な重い局面とbaselineを固定する

### Task 0.1: Characterization fixtureを作る

**Files:**

- Create: `test/helpers/network-special-stone-performance-fixtures.ts`
- Create: `test/network.special-stone-late-game-parity.test.ts`
- Reuse: existing card/turn/network state factories

**Produces:** `baseline-light`、`late-dense`、`late-special-20` の決定的fixtureと、同一seedでcanonical result / events / playbackを比較できるserializer。

**Requirements:**

- 実在するmarker typeと正規のstate shapeだけを使う。
- `late-special-20` が1種類で不自然になる場合、`mobile`、`destroy`、`duration` の複数fixtureへ分割して合計20状態を覆う。
- fixture builderはproduction sourceへdebug stateを追加しない。
- comparison serializerはtimestampだけを明示的に除外し、marker/event順を保持する。

**Verification:** focused Jestを2回実行し、state hash、event digest、PRNG stateが同じであること。

**Task completion:** fixtureが決定的で、ネットワークなしのrule実行とWorker/local authority経路の両方から利用できる。

### Task 0.2: Perf harnessとbaseline reportを作る

**Files:**

- Create: `scripts/perf/measure-network-special-stone-late-game.ts`
- Create or use wrapper according to current TS CLI convention
- Create: `test/scripts.measure-network-special-stone-performance.test.ts`
- Create: `docs/perf/2026-07-11-network-special-stone-baseline.json`
- Create: `docs/perf/2026-07-11-network-special-stone-baseline.md`
- Modify: `package.json` only if a stable perf script is needed

**Measures:** protection context、legal moves、turn start、presentation mapping、publish preparation、payload bytes、client snapshot apply、render projection、event/phase counts。

**Requirements:**

- instrumentationはexplicit perf flagまたはinjected counterでのみ有効。
- normal play globalを追加しない。
- output key order、fixture seed、iteration数を固定する。
- browser measurementとNode measurementを別sectionにする。

**Task completion:** baseline fileにcommit、runtime version、fixture summary、operation counts、median/p95が記録され、同じcommandで再生成できる。

**Phase 0 completion:** fixtureとbaselineが再現可能で、production behaviorは未変更。以降の全phaseに比較対象がある。

---

## Phase 1 — Marker contextを線形化する

### Task 1.1: 共通MarkerContextIndexを実装する

**Files:**

- Modify: `game/logic/cards/markers.ts`
- Modify as needed: `game/logic/markers_adapter.ts`
- Modify: `test/game.marker-cell-index.test.ts`
- Create: `test/game.protection-context.performance-contract.test.ts`

**Produces:** marker配列を1回走査して、分類配列、cell index、frozen keyを返すpure helper。

**Constraints:**

- 入力marker objectをclone・mutate・sortしない。
- 各分類配列の順序は元marker順。
- invalid row/colの既存扱いを変えない。
- existing `createMarkerCellIndex()` は新helperへ委譲するか、同じ内部builderを共有する。

**Verification:** existing index parity、分類matrix、同一object identity、scan counter。

**Task completion:** marker index authorityが1つで、既存public resultが同じ。

### Task 1.2: Protection contextでindexを使用する

**Files:**

- Modify: `game/logic/cards-internal/protection-context.ts`
- Modify call sites only if optional index injection is required
- Extend: `test/game.protection-context.test.ts`
- Extend: `test/game.protection-context.performance-contract.test.ts`

**Produces:** `protectedStones`、`inviolableStones`、`permaProtectedStones`、`bombs`、`blockedCells` を1 marker snapshotから構築する実装。

**Constraints:**

- `isFrozenCellForCard()` をspecialごとに呼ばない。
- manifest重複、freeze、registry flip protection、additional protectionの順序と意味を維持する。
- deps公開形を壊さない。optional index dependencyを追加する場合はfallbackも同じ線形helperを使う。

**Verification:** legacy oracleとのdeep equality、randomized marker matrix、scan counter、focused card tests。

**Task completion:** `late-special-20`でnested full-marker scanが0、protection context medianがbaselineの50%以下。

**Phase 1 completion:** protection contextは線形、全characterization一致、headless境界維持。

---

## Phase 2 — 合法手探索のcontextを1回compileする

### Task 2.1: CompiledFlipContextを追加する

**Files:**

- Modify: `game/logic/core.ts`
- Modify as needed: `game/logic/cards/flips.ts`
- Modify as needed: `game/logic/context.ts`
- Create: `test/game.core.compiled-flip-context.test.ts`

**Produces:** array-based public contextを受けたまま、内部Setを一度だけ構築できるpure compile helper。

**Constraints:**

- `getFlipsWithContext()` の単独呼び出し互換を保つ。
- context配列をmutateしない。
- board expansion、blockade、protected、perma protectedの挙動を維持する。
- exported API追加が不要ならprivate helperにする。

**Verification:** compiled/uncompiled result parity、rectangular/expanded board、blocked endpoint、protected chain tests。

**Task completion:** compiled contextが全fixtureでlegacy resultと一致する。

### Task 2.2: Legal/has/free moveでcompiled contextを共有する

**Files:**

- Modify: `game/logic/core.ts`
- Modify as needed: `game/move-generator.ts`
- Extend existing move-generator and pass tests

**Produces:** `getLegalMoves()`、`hasLegalMove()`、`getFreePlacementMoves()` が1 invocationにつき1回だけcontextをcompileする。

**Constraints:**

- move順、flip配列順を変えない。
- early returnとpass判定を変えない。
- taboo/free/swap pendingの公開move shapeを変えない。

**Verification:** compile counter = 1、move deep equality、pass/network parity focused tests。

**Task completion:** legal move medianがbaselineの70%以下、baseline-light p95悪化が5%以内。

**Phase 2 completion:** protection/blocked Setは候補ごとに再生成されず、全move parityが通る。

---

## Phase 3 — Renderとpresentationの読み取りを共有する

### Task 3.1: Per-render BoardProjectionを導入する

**Files:**

- Modify: `ui/board-renderer.ts`
- Modify: `ui/diff-renderer.ts`
- Modify: `ui/diff-renderer/projector.ts`
- Modify: `shared/board-hint-projection.ts`
- Create: `test/ui.board-render-projection.test.ts`

**Produces:** 1 render内でviewer context、selectable targets、protection context、legal set、marker mapsを共有するreadonly projection。

**Constraints:**

- projectionはrender終了後にcanonical stateへ残さない。
- snapshot versionまたはobject identityをまたいでcacheしない。
- selection mode、legal hint、random spawn preview、board shrink/expansion hintを維持する。
- board DOM writerを増やさない。

**Verification:** projection counter、cell state deep equality、existing stone rendering / scheduler tests。

**Task completion:** 1 renderでprotection contextとlegal generationが各1回以下、board projection medianがbaselineの75%以下。

### Task 3.2: PresentationEventIndexを導入する

**Files:**

- Create or extend a focused pure helper under `game/turn/pipeline-ui/` or `shared/` according to current ownership
- Modify: `game/turn/presentation-helpers.ts`
- Modify: `game/turn/pipeline_ui_adapter.ts`
- Create: `test/game.turn-presentation-event-index.test.ts`

**Produces:** event配列を並べ替えずに、type/cell/action lookupだけを高速化するoperation-local index。

**Constraints:**

- first-match / last-matchの既存意味を個別にcharacterizeする。
- indexをevent生成・phase割当・dedupe判断のauthorityにしない。
- object identityを返す既存helperは同じevent objectを返す。

**Verification:** indexed/legacy lookup matrix、turn-start marker order、pipeline UI adapter focused tests。

**Task completion:** 1 mappingでindex構築1回以下、events/playback digest完全一致。

**Phase 3 completion:** render/presentationの同値読み取りが1回のprojection/indexに集約され、表示・順序は不変。

---

## Phase 4 — Worker publish内のprojectionとpayload準備を再利用する

### Task 4.1: PublishViewerArtifacts builderを追加する

**Files:**

- Modify: `utils/match-authority/projection.ts`
- Modify: `utils/match-authority.ts`
- Modify: `utils/match-publish-controller.ts`
- Modify: `workers/match-worker.ts`
- Modify local server integration if it uses the same helper boundary
- Create: `test/utils.match-authority.publish-artifacts.test.ts`

**Produces:** accepted publish内でcanonical hashと3 viewer projectionを一度だけ作る短命artifact。

**Constraints:**

- artifactをroomへ保存しない。
- hidden hand、trap、observer reveal、spectator projectionを維持する。
- projected hashとauthoritative hashを同じ入力から作る。
- public snapshot APIは互換維持。

**Verification:** direct builderと既存public APIのviewer別deep equality、projection call counter。

**Task completion:** viewer projectionは各1回以下、全hash/payload一致。

### Task 4.2: response / journal / SSEでartifactを再利用する

**Files:**

- Modify: `utils/match-publish-controller.ts`
- Modify: `utils/match-authority/presentation-journal.ts`
- Modify: `workers/match-worker.ts`
- Modify: `workers/match-worker-broadcast-controller.ts`
- Extend Worker/local/network focused tests

**Produces:** 公開JSON shapeを維持したまま、同一viewer snapshot/payloadの再projectionを止める。

**Constraints:**

- presentation journalは必要なsnapshot ownershipを保持する。
- live response objectのmutationがjournal/SSEへ波及しない。
- SSE resume時に同じpayloadを復元する。
- local serverとWorkerを同じhelper経路に揃える。

**Verification:** publish response/SSE/journal snapshot normalized deep equality、operation dedupe、reconnect、spectator parity。

**Task completion:** accepted publish payload準備medianがbaselineの80%以下、public bytes/shapeに意図しない差がない。

**Phase 4 completion:** accepted publish内のviewer投影とhash計算が重複せず、network parityが通る。

---

## Phase 5 — Accepted publishを1回の永続化へまとめる

### Task 5.1: 永続化境界をcharacterizeする

**Files:**

- Create: `test/workers.match-worker.publish-persistence.test.ts`
- Extend broadcast/publish controller tests

**Covers:** accepted publish、save failure、SSE send failure、stream 0件、resume buffer、reconnect、duplicate operation。

**Task completion:** 現行のsave順とfailure semanticsがテストで固定される。

### Task 5.2: Buffer組み立てをsave前へ移す

**Files:**

- Modify: `utils/match-publish-controller.ts`
- Modify: `workers/match-worker-broadcast-controller.ts`
- Modify: `workers/match-worker.ts`
- Modify shared authority journal helper if needed

**Produces:** accepted state、journal、authority log、SSE resume recordを組み立てて1回保存し、その後SSE送信する経路。

**Constraints:**

- storage success前にaccepted successを返さない。
- SSE send failureでも保存済みstateとresume recordが再接続可能。
- duplicate operation retryが二重commitを起こさない。
- presence/chatなど別経路を巻き込まない。

**Verification:** save counter = 1、failure injection、network parity、match smoke。

**Task completion:** accepted publish成功経路のroom persistが1回で、failure/reconnect結果がcharacterizationと一致。

**Phase 5 completion:** storage writeとroom cloneが重複せず、authority durabilityが維持される。

---

## Phase 6 — クライアントsnapshot ownershipを軽量化する

### Task 6.1: Clone inventoryとmutation guardを追加する

**Files:**

- Create: `test/ui.network-visual-state-store-readonly.test.ts`
- Extend: snapshot/single-writer tests
- Add test-only clone counter/deep freeze injection

**Produces:** snapshot apply、visual store set/get、frame commit、render取得のclone回数baselineと、renderer非mutation契約。

**Task completion:** 現在の所有権とmutation有無が決定的に測定できる。

### Task 6.2: readonly render snapshot経路を追加する

**Files:**

- Modify: `ui/network/visual-state-store.ts`
- Modify: `ui/network/snapshot.ts`
- Modify: `ui/network/presentation-timeline.ts`
- Modify: `ui/board-renderer.ts` render-state resolver
- Extend focused UI/network tests

**Produces:** canonical/visual snapshotをcommit時に所有し、rendererはcloneなしreadonly peekを使う経路。既存clone-returning APIは互換維持。

**Constraints:**

- global gameplay stateをvisual storeから書き戻さない。
- playback lag中はvisual snapshot、idle時はcanonical snapshotという既存選択を維持する。
- external callersへmutable internal referenceを公開しない。
- dev/test mutationはfail-fast。

**Verification:** clone counter、deep freeze、strict playback、stream/response race、reconnect tests。

**Task completion:** normal render readonly取得のfull cloneが0、snapshot apply + render preparation medianがbaselineの80%以下。

**Phase 6 completion:** client authority/presentation境界を変えずにclone-on-readが除去される。

---

## Phase 7 — 同一playback phase内のDOM作業をまとめる

### Task 7.1: Phase DOM operation baselineを固定する

**Files:**

- Extend existing animation layout/overlay batching tests
- Add late-special playback synthetic case

**Measures:** layout reads、createElement、append/remove、board refresh requests、phase/duration/event count。

**Task completion:** same-phaseとcross-phaseの期待値が区別される。

### Task 7.2: Layout/overlay/cell lookupを共有する

**Files:**

- Modify only the existing `ui/animation-engine.ts` phase context and current batching helpers
- Modify relevant animation event handlers
- Extend noanim/animation tests

**Constraints:**

- phase間をまとめない。
- duration/await境界を変更しない。
- final board refreshはplayback完了後のSingle Visual Writer経路だけ。
- effect-specific bypassを増やさない。

**Verification:** DOM operation count低下、phase/duration/playback digest一致、visual/noanim tests。

**Task completion:** late-special playbackのlayout readと一時DOM operationがbaselineより減り、表示順・時間は一致。

**Phase 7 completion:** animation仕様時間を維持したまま、CPU/DOM overheadが削減される。

---

## Phase 8 — 総合検証と完了証拠

### Task 8.1: Final benchmarkを取得する

**Files:**

- Create: `docs/perf/2026-07-11-network-special-stone-final.json`
- Create: `docs/perf/2026-07-11-network-special-stone-final.md`
- Create: `docs/perf/2026-07-11-network-special-stone-comparison.md`

**Requirements:** baselineと同じmachine/runtime/fixture/iteration。差がある場合は比較不可として再取得する。

**Task completion:** 設計書のoperation-count条件とtiming条件を表で判定できる。

### Task 8.2: Full verificationを実行する

**Required:** focused Jest、typecheck、build:ts、check:window、checkall、network parity、build:browser、worker:prepare、2-client network E2E、必要最小のvisual check。

**Task completion:** 全command PASS。retryが必要だった場合は初回失敗と理由をreportへ残す。

### Task 8.3: Completion reportとplan statusを更新する

**Files:**

- Create: `docs/perf/2026-07-11-network-special-stone-completion-report.md`
- Modify: this plan status table
- Modify: `docs/superpowers/plans/README.md`
- Archive plan/runbook only after implementation is genuinely complete

**Report includes:** commits、files、commands、before/after、残存固定animation時間、未解決risk、rollback point。

**Phase 8 completion:** 設計書の全体完了条件10項目が証拠付きで満たされる。

## 5. Program completion gate

以下のどれか1つでも欠ける場合、plan statusをcompleteにしない。

- Phase 0～8がすべてcomplete;
- canonical/network/presentation parityが一致;
- operation-count条件がすべて達成;
- timing条件が両after runで達成;
- accepted publish persistが1回;
- readonly render path cloneが0;
- browser/Worker生成物が正本から再生成済み;
- 2-client network E2Eで演出順・再接続・最終盤面が一致;
- completion reportが存在;
- clean working treeとtask-owned commitsが存在。

もしPhase 5のsingle-persistがauthority durabilityを維持できないと証明された場合、そのphaseを勝手に除外しない。計測証拠と代替案を提示し、ユーザーが完了条件を変更するまで本計画は未完のままとする。
