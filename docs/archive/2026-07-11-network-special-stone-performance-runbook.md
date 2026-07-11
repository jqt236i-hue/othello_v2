---
status: complete
owner: repository-maintainers
scope: network-special-stone-performance
created: 2026-07-11
updated: 2026-07-11
---

# ネット対戦・特殊石大量局面の外面不変最適化 実行手順書

## 1. 文書の役割

**対象:** [設計書](../superpowers/specs/2026-07-11-network-special-stone-performance-design.md) と [実装計画](2026-07-11-network-special-stone-performance-plan.md) に従う実装担当者。

**文書の役割:** checkout確認、baseline、編集、focused test、広域検証、計測、commit、停止、rollbackを、実行順どおりに示した完了済みrunbookである。

**Source of truth:** player-visible behaviorは `01-rulebook.md` と `正本/*.md`、内部authorityは `docs/architecture-contracts.md`。本runbookは仕様変更を許可しない。

**Non-goals:** CPU最適化、演出短縮、payload schema変更、並列特殊石処理、履歴rewriteは行わない。

## 2. 実行前の必須条件

次をすべて満たすまでPhase 0を開始しない。

- [ ] ユーザーが本計画の実装開始を指示している。
- [ ] 同じphysical checkoutで別の実装taskが走っていない。
- [ ] `git status --short` の全pathを説明できる。
- [ ] unrelated dirty fileがない。ある場合はユーザー判断を得ている。
- [ ] root `AGENTS.md` と対象directoryの `AGENTS.md` を読み直した。
- [ ] `01-rulebook.md`、`docs/architecture-contracts.md`、関連する `正本/*.md` を読み、変更不要であることを確認した。
- [ ] Node/npmとlockfileが利用可能である。
- [ ] 長時間selfplay/trainingを実行しないことを確認した。

### Preflight commands

```powershell
git status --short
git rev-parse HEAD
node --version
npm --version
npm run check:window
```

**Expected:** working treeはclean、または本taskと無関係で安全に分離できる既知変更のみ。`check:window`はPASS。

**Stop:** dirty fileのownerが不明、正本間で挙動が曖昧、既存checkが説明なく失敗する場合。

## 3. 全task共通ループ

各Taskで必ず次の順番を使う。

1. `git status --short`。
2. planのTaskと対象fileのnested `AGENTS.md`を読む。
3. 対象の現行sourceと既存testを読む。
4. focused baselineを実行する。
5. characterization testまたはstructural counter testを先に追加する。
6. 新規testが構造変更を要求する場合、狙った理由でFAILすることを確認する。既存behavior characterizationは変更前からPASSさせる。
7. `apply_patch`でroot sourceだけを編集する。
8. focused testを実行する。
9. `npm run typecheck` と必要な境界checkを実行する。
10. `git diff --check`、task fileのdiff、`git status --short`を確認する。
11. task-owned fileだけをstageする。`git add -A`は禁止。
12. coherentなtask commitを作る。
13. 次Taskへ進む。

### 共通停止フォーマット

停止時は次を記録する。

```text
Task:
Command:
Expected:
Observed:
Changed files:
Invariant at risk:
Decision needed:
```

test削除、`.skip`、期待値の安易な更新、broad catch、silent fallbackで続行しない。

## 4. Phase 0 — Fixtureとbaseline

### 4.1 Task 0.1: 決定的fixture

#### Baseline inspection

```powershell
rg -n "create.*CardState|makeInitialSnapshot|turn-start|marker order|SeededPRNG" test game workers --glob "*.ts"
npm run test:jest -- test/game.turn-start-marker-order.test.ts test/game.protection-context.test.ts test/utils.match-authority.publish-response.test.ts
```

#### Implement

- [ ] `test/helpers/network-special-stone-performance-fixtures.ts` を追加。
- [ ] light / dense / special fixtureをseed固定で構築。
- [ ] timestampだけを除外するcomparison helperを追加。
- [ ] `test/network.special-stone-late-game-parity.test.ts` を追加。
- [ ] 同一fixtureを2回実行し、canonical state、events、presentation events、PRNG stateが同じことをassert。
- [ ] Worker/local pathへ渡せるplain JSON shapeであることをassert。

#### Verify

```powershell
npm run test:jest -- test/network.special-stone-late-game-parity.test.ts test/game.turn-start-marker-order.test.ts test/game.protection-context.test.ts
npm run test:jest -- test/network.special-stone-late-game-parity.test.ts
git diff --check
```

#### Completion

- [ ] 2回のtest runがPASS。
- [ ] fixture digestが一致。
- [ ] 非実在marker shapeがない。
- [ ] production source変更なし。

#### Commit

```powershell
git add test/helpers/network-special-stone-performance-fixtures.ts test/network.special-stone-late-game-parity.test.ts
git commit -m "test: add late special-stone performance fixtures"
```

### 4.2 Task 0.2: Perf harnessとbaseline

#### Implement

- [ ] `scripts/perf/measure-network-special-stone-late-game.ts` を追加。
- [ ] current CLI build/wrapper conventionに従う。
- [ ] `package.json` に `perf:network-special-stone` を追加する場合、他scriptを変更しない。
- [ ] test injected counterでscan/compile/clone/projection/save回数を取得。
- [ ] normal modeでinstrumentationが無効であるtestを追加。
- [ ] output JSON key orderとseedを固定。

#### Verify harness

```powershell
npm run test:jest -- test/scripts.measure-network-special-stone-performance.test.ts
npm run build:ts
npm run perf:network-special-stone -- --iterations 10 --dry-run
```

**Expected:** dry-runはfixture、measure名、output pathだけを表示し、tracked baselineを上書きしない。

#### Capture baseline

```powershell
npm run perf:network-special-stone -- --iterations 100 --output docs/perf/2026-07-11-network-special-stone-baseline.json
```

- [ ] JSONからMarkdown reportを生成。
- [ ] commit、Node version、OS、iterations、fixture digestを記録。
- [ ] payload bytesとevent/phase/duration countを記録。
- [ ] timingとoperation countを分ける。

#### Completion

- [ ] 同じcommandで再生成可能。
- [ ] secret、token、room credentialが出力されない。
- [ ] normal playへdebug globalを追加していない。
- [ ] baseline JSON/Markdownを目視確認。

#### Commit

```powershell
git add scripts/perf/measure-network-special-stone-late-game.ts test/scripts.measure-network-special-stone-performance.test.ts package.json package-lock.json docs/perf/2026-07-11-network-special-stone-baseline.json docs/perf/2026-07-11-network-special-stone-baseline.md
git commit -m "perf: capture network special-stone baseline"
```

存在しないwrapper、package-lock変更なしのpathはstage対象から外す。

## 5. Phase 1 — Marker context線形化

### 5.1 Task 1.1: MarkerContextIndex

#### Baseline

```powershell
npm run test:jest -- test/game.marker-cell-index.test.ts test/game.protection-context.test.ts test/network.special-stone-late-game-parity.test.ts
```

#### Test first

- [ ] 元marker順を保つ分類test。
- [ ] same marker object identityを返すtest。
- [ ] byCell/frozen/bomb/manifest matrix。
- [ ] marker source iteration counterが1であるtest。

#### Implement

- [ ] `game/logic/cards/markers.ts` に共通index builder。
- [ ] existing `createMarkerCellIndex()` を同builderへ委譲。
- [ ] `markers_adapter.ts` に重複builderを作らない。
- [ ] sort、clone、canonical mutationをしない。

#### Verify

```powershell
npm run test:jest -- test/game.marker-cell-index.test.ts test/game.protection-context.performance-contract.test.ts test/game.protection-context.test.ts
npm run typecheck
npm run check:window
git diff --check
```

#### Completion

- [ ] source iterationは1回。
- [ ] public marker lookup parity一致。
- [ ] headless layerへUI依存なし。

#### Commit

```powershell
git add game/logic/cards/markers.ts game/logic/markers_adapter.ts test/game.marker-cell-index.test.ts test/game.protection-context.performance-contract.test.ts
git commit -m "perf: index marker context in one pass"
```

### 5.2 Task 1.2: Protection context

#### Characterize

- [ ] old resultをtest oracleとしてfixture JSONまたはtest-local helperで固定。
- [ ] registry flip protection、freeze、manifest、bomb、blockade、additional protectionを覆う。

#### Implement

- [ ] `buildCardProtectionContext()` が1 marker snapshotを利用。
- [ ] per-special `isFrozenCellForCard()` 呼び出しを除去。
- [ ] `frozenCellKeys.has()` へ置換。
- [ ] result array順を維持。

#### Verify

```powershell
npm run test:jest -- test/game.protection-context.performance-contract.test.ts test/game.protection-context.test.ts test/game.marker-cell-index.test.ts test/network.special-stone-late-game-parity.test.ts
npm run typecheck
npm run build:ts
npm run check:window
npm run perf:network-special-stone -- --measure protection-context --iterations 100 --compare docs/perf/2026-07-11-network-special-stone-baseline.json
```

#### Completion

- [ ] nested marker scan = 0。
- [ ] state/events digest一致。
- [ ] median <= baseline 50%。
- [ ] light p95悪化 <= 5%。

#### Commit

```powershell
git add game/logic/cards-internal/protection-context.ts game/logic/cards/markers.ts test/game.protection-context.performance-contract.test.ts test/game.protection-context.test.ts
git commit -m "perf: linearize card protection context"
```

## 6. Phase 2 — 合法手context compile

### 6.1 Task 2.1: Compile helper

#### Baseline

```powershell
npm run test:jest -- test/game.protection-context.test.ts test/game.move-generator.expansion-pending.test.ts test/game.pass-handler.test.ts
```

#### Implement

- [ ] array contextとcompiled contextの型を定義。
- [ ] compile helperは各Setを1回構築。
- [ ] standalone `getFlipsWithContext()` はlegacy inputを受理。
- [ ] expanded board、blocked endpointをcharacterize。

#### Verify

```powershell
npm run test:jest -- test/game.core.compiled-flip-context.test.ts test/game.protection-context.test.ts test/game.move-generator.expansion-pending.test.ts
npm run typecheck
npm run check:window
```

#### Completion

- [ ] compiled/uncompiled flips完全一致。
- [ ] move/flip順一致。
- [ ] public API互換。

#### Commit

```powershell
git add game/logic/core.ts game/logic/cards/flips.ts game/logic/context.ts test/game.core.compiled-flip-context.test.ts
git commit -m "perf: compile flip context once"
```

### 6.2 Task 2.2: Legal move共有

#### Implement

- [ ] `getLegalMoves()` invocation開始時にcompile。
- [ ] `hasLegalMove()` と `getFreePlacementMoves()` も同じ方式。
- [ ] move generatorが不要な再context化をしない。
- [ ] compile counterを注入可能にするがnormal modeへglobalを出さない。

#### Verify

```powershell
npm run test:jest -- test/game.core.compiled-flip-context.test.ts test/game.move-generator.expansion-pending.test.ts test/game.pass-handler.test.ts test/network.special-stone-late-game-parity.test.ts
npm run typecheck
npm run build:ts
npm run perf:network-special-stone -- --measure legal-moves --iterations 100 --compare docs/perf/2026-07-11-network-special-stone-baseline.json
```

#### Completion

- [ ] compile count = 1 / invocation。
- [ ] median <= baseline 70%。
- [ ] passとpending結果一致。

#### Commit

```powershell
git add game/logic/core.ts game/move-generator.ts test/game.core.compiled-flip-context.test.ts test/game.move-generator.expansion-pending.test.ts
git commit -m "perf: reuse compiled legal-move context"
```

## 7. Phase 3 — Render / presentation共有

### 7.1 Task 3.1: BoardProjection

#### Baseline

```powershell
npm run test:jest -- test/ui.stone-rendering.test.ts test/ui.render-scheduler.test.ts test/ui.diff-renderer-timer-patch.test.ts
```

#### Implement

- [ ] render-scope projection builderをpure/read-onlyにする。
- [ ] `board-renderer` のselection modeと`diff-renderer/projector`が共有。
- [ ] protection/legal/target countersをtest注入。
- [ ] render終了後にprojection参照を破棄。
- [ ] snapshot変化をまたぐmemoizationをしない。

#### Verify

```powershell
npm run test:jest -- test/ui.board-render-projection.test.ts test/ui.stone-rendering.test.ts test/ui.render-scheduler.test.ts test/ui.diff-renderer-timer-patch.test.ts
npm run typecheck
npm run build:ts
npm run check:window
npm run perf:network-special-stone -- --measure board-projection --iterations 100 --compare docs/perf/2026-07-11-network-special-stone-baseline.json
```

#### Completion

- [ ] protection/legal各 <= 1 / render。
- [ ] cell stateとhint完全一致。
- [ ] median <= baseline 75%。

#### Browser build and commit

```powershell
npm run build:browser
git diff --check
git add ui/board-renderer.ts ui/diff-renderer.ts ui/diff-renderer/projector.ts shared/board-hint-projection.ts test/ui.board-render-projection.test.ts public/module-registry.js index.html
git commit -m "perf: share board render projection"
```

生成差分が存在する場合だけstageする。

### 7.2 Task 3.2: PresentationEventIndex

#### Implement

- [ ] helperのownerを確認。game-onlyなら`game/turn/pipeline-ui/`、runtime-portableなら`shared/`。
- [ ] first/last match semanticsをtest化。
- [ ] original event objectとarray orderを保持。
- [ ] mapper invocationごとに1 index。

#### Verify

```powershell
npm run test:jest -- test/game.turn-presentation-event-index.test.ts test/game.turn-start-marker-order.test.ts test/game.pipeline-ui-adapter.spawn.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npm run typecheck
npm run build:ts
npm run check:window
```

#### Completion

- [ ] playback digest一致。
- [ ] phase/order/duration一致。
- [ ] event index build <= 1 / mapping。

#### Commit

```powershell
git add game/turn/presentation-helpers.ts game/turn/pipeline_ui_adapter.ts test/game.turn-presentation-event-index.test.ts
git commit -m "perf: index presentation event lookups"
```

新規helperは確定したliteral pathだけを追加でstageする。directory単位のstageは禁止する。

## 8. Phase 4 — Publish artifacts

### 8.1 Task 4.1: Builder

#### Baseline

```powershell
npm run test:jest -- test/utils.match-authority.publish-response.test.ts test/utils.match-authority.public-snapshot.test.ts test/workers.match-worker-publish-controller.test.ts
```

実際のtest filenameが異なる場合は `rg --files test | rg "match-authority|match-worker|publish"` で現行suiteを選び、planへ記録する。

#### Implement

- [ ] canonical hash + 3 viewer projectionを短命artifactへ集約。
- [ ] projection objectをroomへ保存しない。
- [ ] viewer別redaction matrixをcharacterize。
- [ ] call counterで各viewer1回をassert。

#### Verify

```powershell
npm run test:jest -- test/utils.match-authority.publish-artifacts.test.ts test/utils.match-authority.publish-response.test.ts
npm run typecheck
npm run build:ts
npm run test:network:parity
```

#### Completion

- [ ] black/white/spectator projection各1回。
- [ ] projected/authoritative hash一致。
- [ ] public API互換。

#### Commit

```powershell
git add utils/match-authority.ts utils/match-authority/projection.ts utils/match-publish-controller.ts workers/match-worker.ts test/utils.match-authority.publish-artifacts.test.ts
git commit -m "perf: reuse publish viewer projections"
```

### 8.2 Task 4.2: Response/journal/SSE reuse

#### Implement

- [ ] response、journal、SSE builderへartifactを明示引数で渡す。
- [ ] ownership境界だけclone。
- [ ] journal entry mutationとlive payload mutationが相互影響しないtest。
- [ ] local serverとWorker parity。

#### Verify

```powershell
npm run test:jest -- test/utils.match-authority.publish-artifacts.test.ts test/utils.match-authority.presentation-journal.test.ts test/workers.match-worker-publish-controller.test.ts test/local-match-server.publish-contract.test.ts
npm run typecheck
npm run build:ts
npm run test:network:parity
npm run perf:network-special-stone -- --measure publish-prepare --iterations 30 --compare docs/perf/2026-07-11-network-special-stone-baseline.json
```

#### Completion

- [ ] response/SSE/journal normalized equality。
- [ ] payload bytes/shapeに意図しない差なし。
- [ ] median <= baseline 80%。

#### Mirror and commit

```powershell
npm run worker:prepare
git diff --check
git add utils/match-publish-controller.ts utils/match-authority/presentation-journal.ts workers/match-worker.ts workers/match-worker-broadcast-controller.ts scripts/local-match-server.ts test/utils.match-authority.publish-artifacts.test.ts test/utils.match-authority.presentation-journal.test.ts test/workers.match-worker-publish-controller.test.ts test/local-match-server.publish-contract.test.ts
git commit -m "perf: reuse accepted publish artifacts"
```

コマンドにないtask-owned testを追加した場合も、`git status --short test` を確認してliteral pathだけを個別stageする。

## 9. Phase 5 — Single persist

### 9.1 Task 5.1: Failure characterization

- [ ] save success / failure。
- [ ] SSE send success / failure。
- [ ] stream 0件。
- [ ] reconnect with resume buffer。
- [ ] duplicate operation retry。
- [ ] state/journal/buffer version alignment。

```powershell
npm run test:jest -- test/workers.match-worker.publish-persistence.test.ts test/utils.match-authority.presentation-journal.test.ts
```

**Completion:** implementation前に全現行結果が明示される。

**Commit:** characterizationだけを独立commitする。

```powershell
git add test/workers.match-worker.publish-persistence.test.ts
git commit -m "test: characterize publish persistence ordering"
```

### 9.2 Task 5.2: Persist統合

#### Implement

- [ ] SSE recordをsend前に作成。
- [ ] accepted state/journal/log/bufferをroomへ反映。
- [ ] `saveRoom()` 1回。
- [ ] save成功後にSSE send。
- [ ] response timingとfailure responseを既存契約に合わせる。

#### Verify

```powershell
npm run test:jest -- test/workers.match-worker.publish-persistence.test.ts test/utils.match-authority.presentation-journal.test.ts test/workers.match-worker-publish-controller.test.ts
npm run typecheck
npm run build:ts
npm run test:network:parity
npm run match:check
```

#### Completion

- [ ] save count = 1 / accepted publish。
- [ ] save failureでsuccessを返さない。
- [ ] SSE failure後もresume可能。
- [ ] duplicate retryで二重version進行なし。

#### Commit

```powershell
npm run worker:prepare
git add utils/match-publish-controller.ts workers/match-worker-broadcast-controller.ts workers/match-worker.ts utils/match-authority/journal.ts test/workers.match-worker.publish-persistence.test.ts
git commit -m "perf: persist accepted publish once"
```

## 10. Phase 6 — Client snapshot ownership

### 10.1 Task 6.1: Inventory/guard

```powershell
npm run test:jest -- test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.network-client.visual-catchup.test.ts test/ui.network-visual-state-store-readonly.test.ts
```

- [ ] set/get/commit/renderごとのclone countを記録。
- [ ] rendererにfrozen snapshotを渡し、mutationがないことを確認。
- [ ] playback lag/idle両方を覆う。

**Commit:** test-only characterization。

### 10.2 Task 6.2: Readonly peek

#### Implement

- [ ] public clone-returning getterを維持。
- [ ] renderer専用readonly peekを追加。
- [ ] visual commit時にownership copyを1回。
- [ ] board rendererのstrict network state resolverだけをpeekへ接続。
- [ ] dev/test freezeをnormal playから除外。

#### Verify

```powershell
npm run test:jest -- test/ui.network-visual-state-store-readonly.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.network-client.visual-catchup.test.ts test/ui.network-snapshot.move-source-empty.test.ts test/ui.render-scheduler.test.ts
npm run typecheck
npm run build:ts
npm run check:window
npm run test:network:parity
npm run perf:network-special-stone -- --measure client-snapshot --iterations 100 --compare docs/perf/2026-07-11-network-special-stone-baseline.json
```

#### Completion

- [ ] render peek clone = 0。
- [ ] frozen mutation error = 0。
- [ ] median <= baseline 80%。
- [ ] Single Visual Writer tests PASS。

#### Browser build and commit

```powershell
npm run build:browser
git add ui/network/visual-state-store.ts ui/network/snapshot.ts ui/network/presentation-timeline.ts ui/board-renderer.ts test/ui.network-visual-state-store-readonly.test.ts public/module-registry.js index.html
git commit -m "perf: avoid network snapshot clone on render"
```

## 11. Phase 7 — Playback phase batching

### 11.1 Baseline

```powershell
npm run test:jest -- test/ui.animation-layout-batch-source.test.ts test/ui.animation-destroy-source-batching.test.ts test/ui.animation-engine.test.ts
npm run test:jest:noanim
```

- [ ] late-special playbackでlayout read、create/append/remove、refresh request数を記録。
- [ ] phase/event/duration/sound digestを記録。

### 11.2 Implement

- [ ] existing phase contextへcell/layout/overlay cacheを追加または再利用。
- [ ] cross-phase cache禁止。
- [ ] await/duration変更禁止。
- [ ] final refreshをschedulerへ1回request。

### 11.3 Verify

```powershell
npm run test:jest -- test/ui.animation-layout-batch-source.test.ts test/ui.animation-destroy-source-batching.test.ts test/ui.animation-engine.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npm run test:jest:noanim
npm run typecheck
npm run build:ts
npm run check:window
npm run build:browser
```

### Completion

- [ ] phase/event/duration/sound digest一致。
- [ ] layout/DOM operation count低下。
- [ ] board refreshはplayback後1回。
- [ ] noanimとnormal timing tests PASS。

### Commit

```powershell
git add ui/animation-engine.ts ui/layout-read-batch.ts ui/transient-overlay-batch.ts test/ui.animation-layout-batch-source.test.ts test/ui.animation-destroy-source-batching.test.ts test/ui.animation-engine.test.ts test/ui.animation-special-stone-phase-batching.test.ts public/module-registry.js index.html
git commit -m "perf: batch special-stone playback phase work"
```

追加で変更したanimation handlerも、stage前にtask-ownedであることを確認してliteral pathだけを個別追加する。

## 12. Phase 8 — Final measurementと総合検証

### 12.1 Final benchmark

baselineと同じruntimeで2回取得する。

```powershell
npm run perf:network-special-stone -- --warmup 25 --iterations 500 --integration-iterations 160 --output docs/perf/2026-07-11-network-special-stone-final-run1.json
npm run perf:network-special-stone -- --warmup 25 --iterations 500 --integration-iterations 160 --output docs/perf/2026-07-11-network-special-stone-final-run2.json
npm run perf:network-special-stone -- --compare docs/perf/2026-07-11-network-special-stone-baseline.json --inputs docs/perf/2026-07-11-network-special-stone-final-run1.json,docs/perf/2026-07-11-network-special-stone-final-run2.json --output docs/perf/2026-07-11-network-special-stone-comparison.md
```

script CLIが異なる場合、Task 0.2で確定した同等commandを使い、本runbookを更新する。

### 12.2 Required automated bundle

```powershell
npm run test:jest -- test/network.special-stone-late-game-parity.test.ts test/game.protection-context.performance-contract.test.ts test/game.core.compiled-flip-context.test.ts test/ui.board-render-projection.test.ts test/game.turn-presentation-event-index.test.ts test/utils.match-authority.publish-artifacts.test.ts test/workers.match-worker.publish-persistence.test.ts test/ui.network-visual-state-store-readonly.test.ts
npm run typecheck
npm run build:ts
npm run check:window
npm run test:network:parity
npm run build:browser
npm run worker:prepare
npm run checkall
npm run match:check
```

### 12.3 Browser / network verification

最小の2-client network scenarioを実行する。

- [x] 両clientで同じ特殊石20状態を受信。
- [x] turn-start特殊石が`createdSeq`順。
- [x] phase、音、animation durationがbaseline traceと一致。
- [x] playback中に最終盤面が先行表示されない。
- [x] backlog中は入力lock、drain後に解除。
- [x] 最終盤面、手札、charge、marker timerが両client一致。
- [x] 途中reconnect後にjournalから順序どおり復旧。
- [x] spectator projectionとhidden informationが正しい。
- [x] console/page error 0。

必要な既存E2Eを `rg --files test/e2e tests/visual-regression` から選び、最小scenarioだけを実行する。新規E2Eが必要ならPhase 0 fixtureを再利用し、debug-only setupをnormal gameへ残さない。

### 12.4 Completion report

`docs/perf/2026-07-11-network-special-stone-completion-report.md` に記載する。

- starting/ending commit;
- task commits;
- before/after operation counts;
- before/after median/p95;
- payload bytes;
- event/phase/duration parity;
- automated commandsと結果;
- browser/network scenario結果;
- initial failure/retryがあれば両方;
- 残る固定animation時間;
- residual risk;
- rollback commit一覧。

### 12.5 Final completion checklist

- [x] Plan Phase 0～8がcomplete。
- [x] 設計書の外面挙動不変契約が全PASS。
- [x] operation-count条件が全PASS。
- [x] timing条件がrun1/run2ともPASS。
- [x] public payload shape/hash/redaction一致。
- [x] accepted publish save count = 1。
- [x] normal render clone count = 0。
- [x] full automated bundle PASS。
- [x] 2-client/reconnect/spectator確認PASS。
- [x] browser buildとWorker mirror生成済み。
- [x] completion report作成済み。
- [x] normal playにperf instrumentationなし。
- [x] TODO/fallback/二重authorityなし。
- [x] `git status --short` clean（task-owned diffをcommit後、unrelated別task差分を除く）。
- [x] 全task-owned変更commit済み。

1つでも未達なら「部分完了」と報告し、planをactiveのまま残す。

## 13. Rollback手順

### 未commit task

1. `git status --short` とtask diffを保存。
2. taskで追加・変更したpathだけを`apply_patch`で戻す。
3. baseline focused testを再実行。
4. unrelated fileへ触れていないことを確認。

### Commit済みtask

1. downstream taskが依存していないか確認。
2. ユーザーに影響範囲を報告。
3. destructive resetを使わず、対象commitの明示的revert commitを作る。
4. focused test、network parity、必要なbuildを再実行。

### Phase 5緊急rollback

single-persistでreconnect/durability問題が出た場合:

1. 新規publish受付を止められる運用境界を確認。
2. Task 5.2だけをrevert。
3. 旧二段save経路へ戻す。
4. Worker sourceをbuildし、`worker:prepare`でmirror生成。
5. persistence、network parity、match smokeを再実行。
6. 失敗条件をcompletion reportへ残す。

## 14. 禁止事項

- `git reset --hard`、`git checkout --`、untracked一括削除。
- `git add -A`。
- failing testの削除、skip、timeoutの無制限延長。
- animation durationやphase gap短縮でbenchmarkを通すこと。
- playback frame drop、latest snapshot jump。
- client previewをauthorityにすること。
- marker/event順をSet/Map iteration順へ置き換えること。
- operationをまたぐ無効化不明cache。
- Worker/local serverの別最適化。
- generated/mirrorの手編集。
- secret、seat token、room credentialをperf reportへ保存すること。
