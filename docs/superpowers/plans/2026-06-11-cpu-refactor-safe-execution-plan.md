# CPU Refactor Safe Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CPU関連の巨大hub、重複判定、ONNX特徴量、selfplay/training driftを、プレイヤー向け挙動を変えずに小さな検証可能単位へ分割する。

**Architecture:** root実装を正本とし、`game/` と `shared/` はheadless、`ui/` はpresentation/DI、training/selfplayは教師・検証pipelineとして分離する。公開APIとカード/ターン挙動は維持し、先にcharacterization testで現状を固定してから private module を抽出する。

**Tech Stack:** TypeScript/JavaScript、Jest、PowerShell、既存npm scripts、Cloudflare Worker mirrorは `npm run worker:prepare` 経由のみ。

---

## Document Role

この文書は実装前の安全リファクタリング手順書であり、ゲーム仕様変更書ではない。対象はCPU runtime、CPU policy、ONNX runtime、selfplay/training orchestrationの内部構造改善に限る。

## Source Of Truth

- ルールとプレイヤー表示: `01-rulebook.md`
- 内部境界: `docs/architecture-contracts.md`
- CPU runtime正本: `game/cpu-decision.ts`, `game/cpu-turn-handler.ts`, `game/ai/*`
- Lv6 decision-mode正本: `shared/cpu-lv6-runtime-capability.ts`, `constants/cpu-lv6-shared-profile.ts`
- training profile正本: `training/scripts/load-training-profile.ts`
- generated/mirror: `public/module-registry.js`, `worker-public/*` は先に編集しない。

## Non-Goals

- Lv6の最終意思決定sourceをONNX主導へ変えない。
- カード効果、コスト、表示文言、ターン順、min think timeの仕様を変えない。
- `cpu/` compatibility pathを削除しない。
- `worker-public/` や generated catalog を手編集しない。
- broad formatter、repo-wide rewrite、依存更新、public import path変更は行わない。

## Global Safety Rules

- 各Taskは単独commit可能なサイズにする。
- 最初に `git status --short` を実行し、既存dirty fileを分類する。
- 既存dirty fileと同じファイルを触る場合は `git diff -- game/cpu-decision.ts` のように対象pathを明示して差分を読んでから作業する。
- production変更前に関連characterization testを追加する。
- 公開関数名、export shape、async timing、fallback順序、error fallback、random/time semanticsを維持する。
- `game/`, `shared/`, CPU logicにDOM、window、document、sound、network client discoveryを入れない。
- `npm run check:window` は各CPU runtime pass後に実行する。

## Baseline Verification Bundle

各Task開始前の最低確認:

```powershell
git status --short
npm run check:window
```

大きなphase完了時:

```powershell
npm run typecheck
npm run build:ts
```

Worker mirrorへ影響するroot runtime変更をdeploy surfaceへ反映する時だけ:

```powershell
npm run worker:prepare
```

---

## File Structure Target

### CPU decision

- Keep: `game/cpu-decision.ts`
  - Public compatibility facade only.
  - Existing exported function names remain stable.
- Create: `game/cpu-decision-card-choice.ts`
  - Owns current `selectCardToUse` orchestration and exact fallback order.
- Create: `game/cpu-decision-move-selection.ts`
  - Owns current `selectCpuMoveWithPolicy` orchestration and exact fallback order.
- Create: `game/cpu-decision-pending-actions.ts`
  - Owns per-card `cpuSelect*WithPolicy` pending action construction.
- Modify: existing `game/cpu-decision-card-context.ts`
  - Owns `buildOnnxContext` data assembly and context tests.

### CPU turn handler

- Keep: `game/cpu-turn-handler.ts`
  - Public facade and `runCpuTurn` entrypoint.
- Create: `game/cpu-turn-scheduler.ts`
  - Retry timers, generation counters, pending select retry state.
- Create: `game/cpu-turn-presentation-runtime.ts`
  - Current `createPresentationRuntime` and commentary/presentation adapters.
- Create: `game/cpu-turn-card-phase.ts`
  - Card use phase including ONNX card decision guards.
- Create: `game/cpu-turn-pending-phase.ts`
  - Pending target phase and dispatch lookup.
- Create: `game/cpu-turn-move-phase.ts`
  - Legal move/pass/move execution phase.

### Lv6 decision mode

- Modify: `shared/cpu-lv6-runtime-capability.ts`
  - Add narrowly named helpers if existing resolver API cannot express callers.
- Modify: `game/cpu-turn-handler.ts`, `game/cpu-decision.ts`, `ui/handlers/cpu-policy.ts`
  - Remove local mode string comparisons after tests lock behavior.

### ONNX feature vector

- Create: `game/ai/policy-feature-vector.ts`
  - Pure vector builder, no asset loading, no sessions, no timers.
- Modify: `game/ai/policy-onnx-runtime.ts`
  - Delegates vector building to the new pure module.
- Add tests under `test/` or `game/ai/__tests__/`
  - Verify runtime vector offsets and live/selfplay context parity.

### CPU card taxonomy

- Create: `game/ai/cpu-policy-card-taxonomy.ts`
  - Shared card category sets currently duplicated in policy core/profile code.
- Modify: `game/ai/cpu-policy-core.ts`
- Modify: `game/ai/cpu-policy-card-profiles.ts`
- Add/extend: `test/game.cpu-policy-card-profiles.test.ts`

### Position weights

- Create: `src/engine/selfplay-position-weights.ts`
  - Named selfplay-specific matrix if values intentionally differ.
- Modify: `src/engine/selfplay-runner.ts`
- Modify: `training/engine/selfplay-runner.ts`
- Add test proving `src/engine` and `training/engine` use the same selfplay matrix.

---

## Phase 0: Characterization And API Inventory

**Risk:** Low. No production behavior change.

**Files:**
- Create: `test/cpu.decision.public-api.test.ts`
- Create: `test/cpu.onnx-context.characterization.test.ts`
- Create or extend: `test/shared.cpu-lv6-runtime-capability.test.ts`
- Modify only if needed: Jest test config is not expected to change.

### Task 0.1: Capture `game/cpu-decision.ts` public API

- [ ] **Step 1: Inspect existing exports**

```powershell
rg -n "module\.exports|exports\.|export " game/cpu-decision.ts
```

- [ ] **Step 2: Add public API snapshot test**

Create `test/cpu.decision.public-api.test.ts` with an explicit sorted export list copied from the command output. The test must fail if a later extraction drops or renames a public function.

Use this exact initial export list unless `rg` shows the source changed before implementation starts:

```ts
describe('cpu-decision public api', () => {
  test('keeps exported compatibility surface stable', () => {
    const api = require('../game/cpu-decision.ts');
    expect(Object.keys(api).sort()).toEqual([
      'applyCardChoice',
      'applyHandCardDestroy',
      'buildCardUseDecisionContext',
      'buildOnnxContext',
      'computeCpuAction',
      'cpuMaybeDestroyHandCardWithPolicy',
      'cpuMaybeUseCardWithPolicy',
      'cpuSelectBlockadeWillWithPolicy',
      'cpuSelectBoardExpansionWillWithPolicy',
      'cpuSelectBoardShrinkWithPolicy',
      'cpuSelectBuoyancyWillWithPolicy',
      'cpuSelectCaptureWillWithPolicy',
      'cpuSelectCellTeleportWillWithPolicy',
      'cpuSelectCloneWillWithPolicy',
      'cpuSelectCondemnWillWithPolicy',
      'cpuSelectCorrosionWillWithPolicy',
      'cpuSelectDestroyWithPolicy',
      'cpuSelectExtendLifeWillWithPolicy',
      'cpuSelectFreezeWillWithPolicy',
      'cpuSelectGravityWillWithPolicy',
      'cpuSelectGuardWillWithPolicy',
      'cpuSelectHeavenBlessingWithPolicy',
      'cpuSelectLivingWillWithPolicy',
      'cpuSelectMeteorWillWithPolicy',
      'cpuSelectObserverWillWithPolicy',
      'cpuSelectPositionSwapWillWithPolicy',
      'cpuSelectReverseWillWithPolicy',
      'cpuSelectSeedWillWithPolicy',
      'cpuSelectSuperAttractionWillWithPolicy',
      'cpuSelectSuperBuoyancyWillWithPolicy',
      'cpuSelectSuperGravityWillWithPolicy',
      'cpuSelectSwapWithEnemyWithPolicy',
      'cpuSelectTeleportWillWithPolicy',
      'cpuSelectTemptWillWithPolicy',
      'cpuSelectTimeBombWithPolicy',
      'cpuSelectTrapWillWithPolicy',
      'hasPlanPressureProfileForCardType',
      'isCardChoiceAllowedByHighConfidence',
      'isCardChoiceAllowedByRisk',
      'selectCardFromOnnxPolicyAsync',
      'selectCardToUse',
      'selectCpuMoveWithPolicy',
      'selectHandCardToDestroy',
      'selectMoveFromOnnxPolicyAsync',
      'setCpuDecisionRuntime',
      'setCpuExecutionMode',
      'setCpuRng',
      'setCpuTimerService'
    ].sort());
  });
});
```

- [ ] **Step 3: Run the API test**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.public-api.test.ts
```

Expected: PASS before production edits.

- [ ] **Step 4: Commit**

```powershell
git add test/cpu.decision.public-api.test.ts
git commit -m "test: capture cpu decision public api"
```

### Task 0.2: Characterize ONNX context fields before extension

- [ ] **Step 1: Locate current `buildOnnxContext` callers**

```powershell
rg -n "buildOnnxContext|getCornerPlanFeatures|ownCornersBefore|oppCornersBefore|ownEdgesBefore|oppEdgesBefore" game test training src
```

- [ ] **Step 2: Add context characterization**

Create `test/cpu.onnx-context.characterization.test.ts`. The test should call `buildOnnxContext` through the public API and assert the current core fields used by ONNX runtime, including `playerKey`, `legalMovesCount`, `candidateMoves`, `hasCornerMoveNow`, `hasEdgeMoveNow`, and charge/deck fields already present.

Do not assert the new corner/edge-before fields yet. This test locks current behavior before Task 3 adds those fields intentionally.

- [ ] **Step 3: Run the context test**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.onnx-context.characterization.test.ts
```

Expected: PASS before production edits.

- [ ] **Step 4: Commit**

```powershell
git add test/cpu.onnx-context.characterization.test.ts
git commit -m "test: characterize cpu onnx context"
```

---

## Phase 1: Lv6 Decision-Mode Single Source

**Risk:** Medium. Internal mode guards affect card/move ONNX enablement.

**Files:**
- Modify: `shared/cpu-lv6-runtime-capability.ts`
- Modify: `game/cpu-turn-handler.ts`
- Modify: `game/cpu-decision.ts`
- Modify: `ui/handlers/cpu-policy.ts`
- Test: `test/shared.cpu-lv6-runtime-capability.test.ts`
- Test: `test/ui.cpu-policy-handler.test.ts`
- Test: `test/cpu.turn-handler.onnx-hold.test.ts`
- Test: `test/cpu.lv6-shared-profile.test.ts`

### Task 1.1: Add shared helper for move/card mode questions

- [ ] **Step 1: Write shared resolver tests**

Extend `test/shared.cpu-lv6-runtime-capability.test.ts` with cases for:

- explicit profile mode `policy-table`
- explicit profile mode `onnx`
- explicit profile mode `hybrid`
- missing profile fallback
- standard-board incompatible fallback

Each case must assert both card and move ONNX enablement through shared helper calls.

- [ ] **Step 2: Run the failing or passing baseline**

```powershell
npx jest --runInBand --runTestsByPath test\shared.cpu-lv6-runtime-capability.test.ts
```

Expected: PASS if existing resolver already supports the exact API, otherwise FAIL only because helper names do not exist.

- [ ] **Step 3: Implement helper in `shared/cpu-lv6-runtime-capability.ts`**

Add small pure helpers that wrap the existing canonical resolver. Do not duplicate mode string logic in callers.

Required exported responsibilities:

- resolve whether Lv6 browser runtime may use ONNX for move decision
- resolve whether Lv6 browser runtime may use ONNX for card decision
- preserve the existing capability payload for callers that need full details

- [ ] **Step 4: Replace caller-local string comparisons**

Update these files to call the shared helper:

- `game/cpu-turn-handler.ts`
- `game/cpu-decision.ts`
- `ui/handlers/cpu-policy.ts`

Remove local `mode === 'onnx'` or `mode === 'hybrid'` checks from those caller paths unless the comparison remains inside `shared/cpu-lv6-runtime-capability.ts`.

- [ ] **Step 5: Validate focused tests**

```powershell
npx jest --runInBand --runTestsByPath test\shared.cpu-lv6-runtime-capability.test.ts test\ui.cpu-policy-handler.test.ts test\cpu.turn-handler.onnx-hold.test.ts test\cpu.lv6-shared-profile.test.ts
npm run check:window
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```powershell
git add shared/cpu-lv6-runtime-capability.ts game/cpu-turn-handler.ts game/cpu-decision.ts ui/handlers/cpu-policy.ts test/shared.cpu-lv6-runtime-capability.test.ts
git commit -m "refactor: centralize lv6 decision mode checks"
```

---

## Phase 2: ONNX Context And Feature Vector

**Risk:** Medium. Feature encoding drift can silently change CPU policy.

**Files:**
- Create: `game/ai/policy-feature-vector.ts`
- Modify: `game/ai/policy-onnx-runtime.ts`
- Modify: `game/cpu-decision-card-context.ts` or current owner of `buildOnnxContext`
- Test: `test/cpu.onnx-context.characterization.test.ts`
- Test: `test/game.cpu-policy-onnx-runtime.test.ts`

### Task 2.1: Extract pure feature vector builder

- [ ] **Step 1: Locate current vector assembly**

```powershell
rg -n "buildInputVector|feature_vector|obs\.data|getCornerPlanFeatures" game/ai training/python test
```

- [ ] **Step 2: Add direct vector test before extraction**

Add a test that drives the current ONNX runtime and asserts selected vector offsets for:

- board cells
- current player
- legal move count
- hand/card features
- pending type one-hot
- corner/edge plan features

Use the existing mocked ONNX session style already present in repository tests. The test should observe `session.run.mock.calls[0][0].obs.data` before extraction.

- [ ] **Step 3: Run the test before extraction**

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-policy-onnx-runtime.test.ts
```

Expected: PASS and proves the current vector layout.

- [ ] **Step 4: Create `game/ai/policy-feature-vector.ts`**

Move only pure data-to-vector logic. The new module must not import browser, timer, asset loading, ONNX session, or network code.

Required exports:

- `buildPolicyFeatureVector(context)`
- constants for vector dimensions and stable offset names if current tests need them

- [ ] **Step 5: Delegate from `policy-onnx-runtime.ts`**

Replace the private vector construction body with a call to `buildPolicyFeatureVector(context)`. Preserve array type, length, numeric defaults, missing-field fallback behavior, and error handling.

- [ ] **Step 6: Re-run vector tests**

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-policy-onnx-runtime.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add game/ai/policy-feature-vector.ts game/ai/policy-onnx-runtime.ts test/game.cpu-policy-onnx-runtime.test.ts
git commit -m "refactor: extract pure policy feature vector builder"
```

### Task 2.2: Add missing corner and edge context fields

- [ ] **Step 1: Extend context tests first**

Update `test/cpu.onnx-context.characterization.test.ts` to assert:

- `ownCornersBefore`
- `oppCornersBefore`
- `ownEdgesBefore`
- `oppEdgesBefore`
- `cornerEmergency` if currently derivable from the same board snapshot
- `cornerHoldMode` if currently derivable from the same board snapshot

Expected before implementation: FAIL because fields are absent or undefined.

- [ ] **Step 2: Implement context enrichment**

Modify `game/cpu-decision-card-context.ts` or the current `buildOnnxContext` owner so the fields are computed from the same canonical board/player state as the rest of the context.

Do not change scoring, threshold, or final decision logic in this task.

- [ ] **Step 3: Verify ONNX context and runtime**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.onnx-context.characterization.test.ts test\game.cpu-policy-onnx-runtime.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add game/cpu-decision-card-context.ts test/cpu.onnx-context.characterization.test.ts
git commit -m "refactor: enrich cpu onnx context fields"
```

---

## Phase 3: `game/cpu-decision.ts` Hub Split

**Risk:** Medium. Fallback order and async budget behavior must remain identical.

**Files:**
- Modify: `game/cpu-decision.ts`
- Create: `game/cpu-decision-card-choice.ts`
- Create: `game/cpu-decision-move-selection.ts`
- Create: `game/cpu-decision-pending-actions.ts`
- Existing helpers: `game/cpu-decision-card-actions.ts`, `game/cpu-decision-card-pipeline.ts`, `game/cpu-decision-pending-pipeline.ts`, `game/cpu-decision-pending-onnx.ts`
- Tests: `test/cpu.decision.public-api.test.ts`, `test/cpu.decision.card-context.test.ts`, `test/cpu.decision.card-risk.test.ts`, `test/cpu.decision.card-actions.test.ts`, `test/cpu.decision.card-pipeline.test.ts`, `test/cpu.decision.pending-onnx.test.ts`, `test/cpu.decision.pending-pipeline.test.ts`, `test/cpu.decision.selection-flow.test.ts`

### Task 3.1: Extract card choice orchestrator

- [ ] **Step 1: Add fallback-order characterization**

Add or extend a `selectCardToUse` test that covers these observable branches:

- no usable cards returns no card
- shared policy card decision wins when allowed
- learned policy card decision is used only when allowed by current guards
- highest-cost fallback remains after learned/policy rejection
- AISystem fallback remains last

- [ ] **Step 2: Run the test before extraction**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.public-api.test.ts test\cpu.decision.card-actions.test.ts test\cpu.decision.card-pipeline.test.ts
```

Expected: PASS before production edits.

- [ ] **Step 3: Create `game/cpu-decision-card-choice.ts`**

Move the body of `selectCardToUse` and only the private helpers required by that body. Inject dependencies from `game/cpu-decision.ts` when they are runtime globals or existing local helpers.

Preserve:

- input argument shape
- returned card object shape
- debug trap-only behavior
- Lv6 consensus behavior
- fallback order
- no-card result semantics

- [ ] **Step 4: Leave facade in `game/cpu-decision.ts`**

`game/cpu-decision.ts` should keep exporting `selectCardToUse` and delegate to the extracted module.

- [ ] **Step 5: Validate**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.public-api.test.ts test\cpu.decision.card-actions.test.ts test\cpu.decision.card-pipeline.test.ts test\cpu.decision.card-risk.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add game/cpu-decision.ts game/cpu-decision-card-choice.ts test/cpu.decision.public-api.test.ts test/cpu.decision.card-actions.test.ts test/cpu.decision.card-pipeline.test.ts test/cpu.decision.card-risk.test.ts
git commit -m "refactor: extract cpu card choice orchestrator"
```

### Task 3.2: Extract move selection orchestrator

- [ ] **Step 1: Add move fallback characterization**

Add or extend tests for `selectCpuMoveWithPolicy` covering:

- pending free-placement target path
- learned policy accepted path
- lookahead policy accepted path
- `CpuPolicyCore` fallback path
- AISystem/random fallback path
- no legal moves result

- [ ] **Step 2: Run tests before extraction**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.public-api.test.ts test\cpu.compute.test.ts
```

Expected: PASS before production edits.

- [ ] **Step 3: Create `game/cpu-decision-move-selection.ts`**

Move `selectCpuMoveWithPolicy` orchestration and private helpers directly required for choosing the final move. Do not move unrelated card or pending target code in this pass.

- [ ] **Step 4: Leave facade in `game/cpu-decision.ts`**

Keep the public export and delegate to the new module.

- [ ] **Step 5: Validate**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.public-api.test.ts test\cpu.compute.test.ts test\cpu.decision.selection-flow.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add game/cpu-decision.ts game/cpu-decision-move-selection.ts test/cpu.compute.test.ts test/cpu.decision.public-api.test.ts
git commit -m "refactor: extract cpu move selection orchestrator"
```

### Task 3.3: Extract pending action builders

- [ ] **Step 1: List pending selection functions**

```powershell
rg -n "cpuSelect.*WithPolicy|choosePendingTargetWithPolicy|PendingTargetSelector|pending-selection-registry" game test
```

- [ ] **Step 2: Add registry/dispatch characterization**

Add tests covering at least:

- one normal cell target card
- one hand target card
- `HEAVEN_BLESSING`
- `CONDEMN_WILL`
- `OBSERVER_WILL`
- no valid target fallback

- [ ] **Step 3: Create `game/cpu-decision-pending-actions.ts`**

Move per-card `cpuSelect*WithPolicy` action construction into the new file. Keep `choosePendingTargetWithPolicy` public facade stable unless it is already private.

- [ ] **Step 4: Validate**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.decision.public-api.test.ts test\cpu.decision.pending-onnx.test.ts test\cpu.decision.pending-pipeline.test.ts test\cpu.decision.selection-flow.test.ts test\cpu.turn-handler.pending.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add game/cpu-decision.ts game/cpu-decision-pending-actions.ts test/cpu.decision.pending-onnx.test.ts test/cpu.decision.pending-pipeline.test.ts test/cpu.decision.selection-flow.test.ts test/cpu.turn-handler.pending.test.ts
git commit -m "refactor: extract cpu pending action builders"
```

---

## Phase 4: `game/cpu-turn-handler.ts` Phase Split

**Risk:** Medium. Turn timing, retry, presentation flush, and network guard behavior are sensitive.

**Files:**
- Modify: `game/cpu-turn-handler.ts`
- Create: `game/cpu-turn-scheduler.ts`
- Create: `game/cpu-turn-presentation-runtime.ts`
- Create: `game/cpu-turn-card-phase.ts`
- Create: `game/cpu-turn-pending-phase.ts`
- Create: `game/cpu-turn-move-phase.ts`
- Tests: `test/cpu.turn-handler.*`, `test/game.cpu-turn-handler.presentation-runtime.test.ts`, `test/presentation.schedule.cpu.test.ts`, `test/presentation.board-updated.serial.test.ts`

### Task 4.1: Extract scheduler state

- [ ] **Step 1: Characterize retry scheduling**

Run current scheduler tests:

```powershell
npx jest --runInBand --runTestsByPath test\presentation.schedule.cpu.test.ts test\cpu.turn-handler.pending.test.ts
```

Expected: PASS before extraction.

- [ ] **Step 2: Create `game/cpu-turn-scheduler.ts`**

Move retry timer IDs, generation counters, pending select retry state, and scheduling helpers. The module must receive timer functions by dependency parameter when current code already supports timer injection.

- [ ] **Step 3: Validate**

```powershell
npx jest --runInBand --runTestsByPath test\presentation.schedule.cpu.test.ts test\cpu.turn-handler.pending.test.ts test\cpu.turn-handler.network-guard.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add game/cpu-turn-handler.ts game/cpu-turn-scheduler.ts test/presentation.schedule.cpu.test.ts test/cpu.turn-handler.pending.test.ts
git commit -m "refactor: extract cpu turn scheduler"
```

### Task 4.2: Extract presentation runtime

- [ ] **Step 1: Run presentation tests before extraction**

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-turn-handler.presentation-runtime.test.ts test\presentation.board-updated.serial.test.ts
```

Expected: PASS before extraction.

- [ ] **Step 2: Create `game/cpu-turn-presentation-runtime.ts`**

Move `createPresentationRuntime` and presentation adapter helpers. Keep the game layer headless by accepting injected functions and event arrays; do not import DOM or UI modules directly.

- [ ] **Step 3: Validate**

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-turn-handler.presentation-runtime.test.ts test\presentation.board-updated.serial.test.ts test\cpu.turn-handler.network-guard.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add game/cpu-turn-handler.ts game/cpu-turn-presentation-runtime.ts test/game.cpu-turn-handler.presentation-runtime.test.ts test/presentation.board-updated.serial.test.ts
git commit -m "refactor: extract cpu turn presentation runtime"
```

### Task 4.3: Extract card, pending, and move phases one at a time

Repeat this sequence for each file in this order:

1. `game/cpu-turn-card-phase.ts`
2. `game/cpu-turn-pending-phase.ts`
3. `game/cpu-turn-move-phase.ts`

- [ ] **Step 1: Identify the exact branch block in `runCpuTurn`**

```powershell
rg -n "maybeUseCardFromOnnx|pending|executeMove|pass|legalMoves|runCpuTurn" game/cpu-turn-handler.ts
```

- [ ] **Step 2: Add or select focused tests for that phase**

Card phase:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.turn-handler.onnx-hold.test.ts test\cpu.turn-handler.network-guard.test.ts
```

Pending phase:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.turn-handler.pending.test.ts test\cpu.decision.pending-pipeline.test.ts
```

Move phase:

```powershell
npx jest --runInBand --runTestsByPath test\cpu.turn-handler.test.ts test\cpu.compute.test.ts
```

- [ ] **Step 3: Extract only that phase**

The extracted function must return an explicit result object, for example:

```ts
type CpuTurnPhaseResult =
  | { status: 'handled' }
  | { status: 'continue' }
  | { status: 'retry'; reason: string }
  | { status: 'pass' };
```

Use the exact status names consistently within the extracted module and `runCpuTurn`. Do not expose this type as public API unless needed by tests.

- [ ] **Step 4: Validate after each phase extraction**

```powershell
npx jest --runInBand --runTestsByPath test\cpu.turn-handler.onnx-hold.test.ts test\cpu.turn-handler.pending.test.ts test\cpu.turn-handler.network-guard.test.ts test\game.cpu-turn-handler.presentation-runtime.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 5: Commit after each phase**

```powershell
git add game/cpu-turn-handler.ts game/cpu-turn-card-phase.ts game/cpu-turn-pending-phase.ts game/cpu-turn-move-phase.ts test/cpu.turn-handler.onnx-hold.test.ts test/cpu.turn-handler.pending.test.ts test/cpu.turn-handler.network-guard.test.ts
git commit -m "refactor: extract cpu turn card phase"
```

Use commit messages matching the phase actually extracted.

---

## Phase 5: CPU Card Taxonomy And Profile Coverage

**Risk:** Low to Medium. Category movement is safe only if sets remain byte-for-byte equivalent.

**Files:**
- Create: `game/ai/cpu-policy-card-taxonomy.ts`
- Modify: `game/ai/cpu-policy-core.ts`
- Modify: `game/ai/cpu-policy-card-profiles.ts`
- Test: `test/game.cpu-policy-card-profiles.test.ts`
- Test: `test/game.cpu-policy-core.contract-types.test.ts`

### Task 5.1: Add taxonomy coverage tests

- [ ] **Step 1: Inspect current category sets**

```powershell
rg -n "CARD_TYPES|CardTypes|DEFENSIVE|HIGH_VARIANCE|CORNER|DESTROY|HOLD|RAMP|STABILITY|SWING" game/ai/cpu-policy-core.ts game/ai/cpu-policy-card-profiles.ts
```

- [ ] **Step 2: Add coverage test**

Extend `test/game.cpu-policy-card-profiles.test.ts` so every `cards/catalog.json` card type either has an explicit CPU profile/taxonomy entry or is listed in an intentional neutral bucket.

- [ ] **Step 3: Run baseline**

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-policy-card-profiles.test.ts test\game.cpu-policy-core.contract-types.test.ts
```

Expected: PASS before moving constants.

- [ ] **Step 4: Create taxonomy module**

Move duplicated classification sets into `game/ai/cpu-policy-card-taxonomy.ts`. Export readonly sets or predicate functions. Preserve all set contents exactly.

- [ ] **Step 5: Update imports**

Replace local set definitions in `cpu-policy-core.ts` and `cpu-policy-card-profiles.ts` with imports from the taxonomy module.

- [ ] **Step 6: Validate**

```powershell
npx jest --runInBand --runTestsByPath test\game.cpu-policy-card-profiles.test.ts test\game.cpu-policy-core.contract-types.test.ts test\game.cpu-policy-core.test.ts
npm run check:window
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add game/ai/cpu-policy-card-taxonomy.ts game/ai/cpu-policy-core.ts game/ai/cpu-policy-card-profiles.ts test/game.cpu-policy-card-profiles.test.ts
git commit -m "refactor: centralize cpu card taxonomy"
```

---

## Phase 6: Position Weights Drift Control

**Risk:** Low if values remain unchanged; Medium if values are unified.

**Files:**
- Create: `src/engine/selfplay-position-weights.ts`
- Modify: `src/engine/selfplay-runner.ts`
- Modify: `training/engine/selfplay-runner.ts`
- Test: `test/selfplay.position-weights.test.ts`

### Task 6.1: Preserve current selfplay values in a named module

- [ ] **Step 1: Compare matrices**

```powershell
rg -n "POSITION_WEIGHTS" game/logic src/engine training/engine
```

- [ ] **Step 2: Decide behavior-preserving path**

If selfplay values differ from `game/logic/position-weights.ts`, do not unify values in this task. Extract the selfplay matrix unchanged into `src/engine/selfplay-position-weights.ts`.

- [ ] **Step 3: Update both selfplay runners**

Import the named selfplay matrix from the new module in:

- `src/engine/selfplay-runner.ts`
- `training/engine/selfplay-runner.ts`

If direct cross-directory import is not supported by current build config, keep one source and add a sync test that compares both exported matrices.

- [ ] **Step 4: Add drift test**

Add a test that fails when `src/engine` and `training/engine` selfplay matrices diverge.

- [ ] **Step 5: Validate**

```powershell
npx jest --runInBand --runTestsByPath test\selfplay.position-weights.test.ts test\selfplay.simple-simulation-choosers.test.ts test\selfplay.placement-decision.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/engine/selfplay-position-weights.ts src/engine/selfplay-runner.ts training/engine/selfplay-runner.ts test/selfplay.position-weights.test.ts
git commit -m "refactor: name selfplay position weights"
```

---

## Phase 7: Selfplay And Training Script Decomposition

**Risk:** Medium. CLI defaults and artifact paths are easy to break.

**Files:**
- Modify: `training/scripts/run-selfplay-training-cycle.ts`
- Create: `training/scripts/selfplay-training-cycle-args.ts`
- Create: `training/scripts/selfplay-training-cycle-steps.ts`
- Existing tests: `training/tests/selfplay.training-cycle.test.ts`, `training/tests/selfplay.training-profile-launcher.test.ts`, `training/tests/load-training-profile.sync.test.ts`

### Task 7.1: Extract argument parsing and defaults

- [ ] **Step 1: Run current training-cycle tests**

```powershell
npx jest --runInBand --runTestsByPath training\tests\selfplay.training-cycle.test.ts training\tests\selfplay.training-profile-launcher.test.ts training\tests\load-training-profile.sync.test.ts
```

Expected: PASS before extraction.

- [ ] **Step 2: Create `training/scripts/selfplay-training-cycle-args.ts`**

Move parse/default construction only. Do not move iteration execution or filesystem side effects in this pass.

Required exports:

- `parseSelfplayTrainingCycleArgs(argv)`
- `createSelfplayTrainingCycleDefaults(env)`

- [ ] **Step 3: Delegate from `run-selfplay-training-cycle.ts`**

Keep CLI behavior and default values identical. The original script remains the executable entrypoint.

- [ ] **Step 4: Validate**

```powershell
npx jest --runInBand --runTestsByPath training\tests\selfplay.training-cycle.test.ts training\tests\selfplay.training-profile-launcher.test.ts training\tests\load-training-profile.sync.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add training/scripts/run-selfplay-training-cycle.ts training/scripts/selfplay-training-cycle-args.ts training/tests/selfplay.training-cycle.test.ts training/tests/selfplay.training-profile-launcher.test.ts training/tests/load-training-profile.sync.test.ts
git commit -m "refactor: extract selfplay training cycle args"
```

### Task 7.2: Extract iteration step orchestration

- [ ] **Step 1: Identify side-effect boundaries**

```powershell
rg -n "iteration|spawn|exec|copy|manifest|warehouse|gate|benchmark|train" training/scripts/run-selfplay-training-cycle.ts
```

- [ ] **Step 2: Create `training/scripts/selfplay-training-cycle-steps.ts`**

Move step planning and result aggregation only. Keep actual process execution and artifact writes injected from the entrypoint.

Required result shape:

```ts
type SelfplayTrainingCycleStepResult = {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  command?: string;
  artifactPaths?: string[];
};
```

- [ ] **Step 3: Add step-plan tests**

Extend `training/tests/selfplay.training-cycle.test.ts` to assert the same step names and skip/pass behavior for a small dry-run configuration.

- [ ] **Step 4: Validate**

```powershell
npx jest --runInBand --runTestsByPath training\tests\selfplay.training-cycle.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add training/scripts/run-selfplay-training-cycle.ts training/scripts/selfplay-training-cycle-steps.ts training/tests/selfplay.training-cycle.test.ts
git commit -m "refactor: extract selfplay training cycle steps"
```

---

## Full Validation After All Phases

Run in this order:

```powershell
npm run check:window
npm run typecheck
npm run build:ts
npx jest --runInBand --runTestsByPath test\cpu.decision.public-api.test.ts test\cpu.onnx-context.characterization.test.ts
npx jest --runInBand --runTestsByPath test\shared.cpu-lv6-runtime-capability.test.ts test\ui.cpu-policy-handler.test.ts test\cpu.turn-handler.onnx-hold.test.ts test\cpu.lv6-shared-profile.test.ts
npx jest --runInBand --runTestsByPath test\cpu.decision.card-context.test.ts test\cpu.decision.card-risk.test.ts test\cpu.decision.card-actions.test.ts test\cpu.decision.card-pipeline.test.ts test\cpu.decision.pending-onnx.test.ts test\cpu.decision.pending-pipeline.test.ts test\cpu.decision.selection-flow.test.ts
npx jest --runInBand --runTestsByPath test\cpu.turn-handler.pending.test.ts test\game.cpu-turn-handler.presentation-runtime.test.ts test\presentation.schedule.cpu.test.ts test\presentation.board-updated.serial.test.ts test\cpu.turn-handler.network-guard.test.ts
npx jest --runInBand --runTestsByPath test\game.cpu-policy-card-profiles.test.ts test\game.cpu-policy-core.contract-types.test.ts test\game.cpu-policy-core.test.ts
npx jest --runInBand --runTestsByPath training\tests\selfplay.training-cycle.test.ts training\tests\selfplay.training-profile-launcher.test.ts training\tests\load-training-profile.sync.test.ts
```

If runtime source changes must be mirrored for deployment:

```powershell
npm run worker:prepare
```

Then inspect generated/mirror diff before staging.

## Rollback Procedure

For one failed phase before commit:

```powershell
git diff -- game/cpu-decision.ts game/cpu-decision-card-choice.ts test/cpu.decision.public-api.test.ts
```

Manually revert only the files touched by that phase. Do not run `git reset --hard`, `git checkout --`, or `git clean` unless explicitly approved.

For one failed phase after commit:

```powershell
git revert 0123456789abcdef0123456789abcdef01234567
```

Then re-run the focused tests for the reverted phase.

## Completion Criteria

- `game/cpu-decision.ts` remains the public facade and is materially smaller.
- `game/cpu-turn-handler.ts` remains the public facade and delegates scheduler/presentation/phase work.
- Lv6 mode string checks outside `shared/cpu-lv6-runtime-capability.ts` are removed or justified.
- ONNX feature vector has a pure testable builder.
- `buildOnnxContext` provides corner/edge-before fields with tests.
- CPU card taxonomy has a single source and catalog coverage.
- selfplay position weights have an explicit single source or explicit drift test.
- training cycle parsing and step planning are extracted without CLI behavior changes.
- All focused validation commands for touched phases pass.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-11-cpu-refactor-safe-execution-plan.md`.

Two execution options:

1. Subagent-Driven recommended: dispatch a fresh subagent per phase/task, review between tasks, commit each verified pass.
2. Inline Execution: execute tasks in this session using executing-plans, with review checkpoints after each phase.

Choose one execution mode before implementation begins.
