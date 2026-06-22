# Network Battle Repair And Boot-Safe Optimization Implementation Plan (Revised)

**Document role:** Active implementation plan and remaining-work checklist for network battle repair.

**Target:** Browser network battle mode, boot-time lazy loading, generated browser/Worker surfaces, and the local/public verification path.

**Source of truth:** Player-visible behavior follows `01-rulebook.md`; architecture boundaries follow `docs/architecture-contracts.md`; root source files are authoritative and `worker-public/` is a generated mirror.

**Non-goals:** This plan does not change card rules, rebalance cards, edit generated mirrors by hand, deploy publicly without approval, or continue the old boot-splitting tasks that are superseded below.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This revised plan supersedes every earlier version of `docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md`.

**Goal:** ネット対戦モードを安定化しつつ、起動軽量化の副作用でデバッグ、スキン、ガチャ、ランキング、CPU、演出、通常プレイが崩れない状態へ段階的に修復する。

**Architecture:** 先に「起動時に必要な薄い UI shell」と「クリック後に読んでよい重い feature body」を明文化し、全ての lazy 化は browser smoke と rollback 可能な小 commit に通してから進める。ネット同期は server snapshot を canonical、presentation timeline を visual、board DOM を Single Visual Writer に限定するが、大規模置換ではなく既存経路を characterization test で固定してから順に細くする。生成物と mirror は既存スクリプトでのみ更新し、`public/module-registry.js` や `worker-public/` を手編集しない。

**Tech Stack:** TypeScript, browser CommonJS compatibility runtime, Cloudflare Workers, local match server, Jest, Playwright, `npm run build:browser`, `npm run check:generated-network-surface`, `npm run test:network:parity`, `npm run match:boot-performance-check`, `npm run worker:prepare`.

---

## Why This Revision Exists

The previous plan correctly identified network sync and rendering risks, but it treated boot optimization as a module-size problem instead of a product-runtime contract problem. That caused visible UI entry points to be moved behind lazy loading without proving that their button handlers still existed at startup.

Confirmed side effects from the previous execution:

- `ui/handlers/debug` was classified optional, so `setupDebugControls` could be missing and `#debugModeBtn` could disappear.
- `ui/handlers/hand-skin` depended on optional `ui/hand-skin/*` modules and returned `null` instead of installing a lazy click bridge.
- Ranking UI had the same class of issue when `LeaderboardClient` was unavailable at startup.
- Other dirty changes appeared outside the original network scope, including animation lookup and `worker-public` CSS mirror drift. These must not be swept into the network repair unless they are separately classified and tested.

Already repaired in commit `37fc2bc4 Restore lazy UI controls after boot split`:

- `ui/handlers/debug` is startup-required.
- `ui/handlers/hand-skin` is a required shell that lazy-loads the `cosmetic` group.
- `leaderboard-client` is lazy-loaded through the `leaderboard` group when the ranking panel first opens.
- `match:boot-performance-check` still confirms optional registry and ONNX are not loaded at startup.

## Revised Execution Rules

- Freeze the old plan. Do not continue any unchecked task from the previous version unless it also appears in this revised plan.
- Every optimization must preserve visible control availability first, then performance second.
- A startup-visible button must have a startup-loaded shell module. Only the heavy body behind the button may be optional.
- Each optional group needs all three of these before merge: unit contract, browser smoke, and boot performance check.
- No broad prefix may be marked optional until every visible entry point under that prefix is audited.
- Every implementation unit ends in a small commit after focused verification.
- Do not stage unrelated dirty files. Current known unrelated dirty files include animation tests/source and `worker-public/styles-layout-*.css`.
- Stop immediately if `git status --short` shows an overlapping dirty file that the current task needs to edit.
- Do not deploy publicly from this plan without explicit user approval.

## Boot Classification Contract

Required startup shell modules:

```text
ui/bootstrap
ui/bootstrap/lazy-runtime-loader
ui/network-client
ui/network/*
ui/handlers/debug
ui/handlers/gacha
ui/handlers/hand-skin
ui/handlers/match-mode
ui/handlers/match-mode/leaderboard-controller
ui/board-renderer
ui/presentation-handler
```

Optional feature body modules:

```text
game/ai/policy-onnx-runtime
game/ai/othello-onnx-runtime
node_modules/onnxruntime-web
othello-ai/
ui/gacha/
ui/storage/gacha
shared/gacha
shared/observation-gacha
ui/hand-skin/
ui/background-skin/
ui/font-skin/
ui/board-skin/
ui/stone-skin/
ui/cosmetics/
ui/leaderboard-client
ui/debug-card-search
data/dialogue/
```

Disallowed optional classifications unless a required shell is first proven:

```text
ui/handlers/debug
ui/handlers/gacha
ui/handlers/hand-skin
ui/handlers/match-mode
ui/debug
```

`ui/debug-card-search` may remain optional; `ui/handlers/debug` must not.

## File Map

Plan and docs:

- Modify: `docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md`
- Phase 10 contract update: `docs/architecture-contracts.md`

Boot and lazy loading:

- Modify: `scripts/build-module-registry.ts`
- Modify: `entry-browser.js`
- Modify: `index.html`
- Modify: `ui/bootstrap/lazy-runtime-loader.ts`
- Modify: `ui/handlers/debug.ts`
- Modify: `ui/handlers/gacha.ts`
- Modify: `ui/handlers/hand-skin.ts`
- Modify: `ui/handlers/match-mode/leaderboard-controller.ts`
- Test: `test/scripts.build-module-registry.boot-contract.test.ts`
- Test: `test/ui.bootstrap.lazy-runtime-loader.test.ts`
- Test: `test/ui.gacha-handler.test.ts`
- Test: `test/ui.hand-skin-handler.test.ts`
- Test: `test/ui.match-mode.leaderboard-limit.test.ts`
- Create: `scripts/browser-ui-control-smoke.ts`

Generated surface safety:

- Keep: `scripts/check-generated-network-surface.ts`
- Keep: `test/scripts.check-generated-network-surface.test.ts`
- Generated by command only: `dist/`, `public/module-registry.js`, `public/module-registry.optional.js`, `worker-public/`

Network repair:

- Modify cautiously: `ui/network-client.ts`
- Modify cautiously: `ui/network/publish-flow.ts`
- Modify cautiously: `ui/network/stream-snapshot.ts`
- Modify cautiously: `ui/network/session-lifecycle.ts`
- Modify cautiously: `ui/network/snapshot.ts`
- Modify cautiously: `ui/network/presentation-timeline.ts`
- Modify cautiously: `ui/render-scheduler.ts`
- Modify cautiously: `cards/card-interaction-pending-settlement.ts`
- Modify cautiously: `ui/playback-state-manager.ts`
- Test: `test/ui.network-client.*.test.ts`
- Test: `test/ui.network-snapshot.*.test.ts`
- Test: `test/ui.animation-engine.test.ts`
- Test: `test/e2e/network-battle-complete-smoke.test.ts`

## Remaining Work Snapshot (2026-06-22)

This section is the current executor-facing backlog. It supersedes the older interpretation that Phase 4 through Phase 6 require new skeleton modules: the intake, trace, reconnect, and visual-settlement modules already exist. The remaining work is characterization, hardening, and verification against those modules.

Evidence already present in the repo:

- `ui/network/debug-trace.ts`
- `ui/network/intake-envelope.ts`
- `ui/network/intake-coordinator.ts`
- `ui/network/reconnect-controller.ts`
- `ui/network/visual-settlement.ts`
- `ui/playback-state-manager.ts`
- `cards/card-interaction-pending-settlement.ts`
- `test/ui.network-debug-trace.test.ts`
- `test/ui.network-intake-envelope.test.ts`
- `test/ui.network-intake-coordinator.test.ts`
- `test/ui.network-reconnect-controller.test.ts`
- `test/ui.network-visual-settlement.test.ts`
- `test/e2e/network-battle-complete-smoke.test.ts`

Completed or protected checkpoints:

- Phase 0 plan rewrite is committed as `3c2cc798 Revise network repair plan for boot safety`.
- Lazy UI control repair is committed as `37fc2bc4 Restore lazy UI controls after boot split`.
- Browser UI control smoke is committed as `139ff37c Add browser UI control startup smoke`.
- `match:ui-control-smoke` exists and covers debug, hand skin, gacha, and leaderboard startup controls.
- `match:boot-performance-check` remains the gate for optional registry and ONNX startup regressions.

Current phase status:

| Phase | Status | Remaining concrete work |
| --- | --- | --- |
| Phase 0 | Complete for the revised plan | Re-run dirty-worktree classification before each implementation unit. |
| Phase 1 | Mostly complete | Re-run boot contract, lazy loader, UI handler, smoke, and boot performance checks before any new lazy-loading change. |
| Phase 2 | Complete | Keep `match:ui-control-smoke` in the required verification bundle. |
| Phase 3 | Open gate | Inspect generated and mirror diffs before staging any Worker/browser mirror output. |
| Phase 4 | Partially implemented | R2, R3, and R4 below. |
| Phase 5 | Partially implemented | R5 and R6 below. |
| Phase 6 | Partially implemented | R7 below. |
| Phase 7 | Not started | R8 below. |
| Phase 8 | Active guardrail | Apply to every future boot optimization. |
| Phase 9 | Not complete | R9 and R10 below. |

### Remaining Task R1: Establish A Clean Network Baseline

**Files:**

- Read: repository working tree
- Modify: none

- [ ] Run:

```powershell
git status --short
```

Expected on 2026-06-22 before this task list was written: dirty files existed outside this plan, including `01-rulebook.md`, `styles-base.css`, animation tests/source, generated `worker-public/` files, and `test/ui.background-css-default.test.ts`. Do not edit or stage those files for network-plan bookkeeping.

- [ ] Run the baseline checks:

```powershell
npm run match:boot-performance-check
npm run match:ui-control-smoke
npm run match:playback-board-writer-check
npx jest --runInBand --runTestsByPath test/ui.network-debug-trace.test.ts test/ui.network-intake-envelope.test.ts test/ui.network-intake-coordinator.test.ts test/ui.network-reconnect-controller.test.ts test/ui.network-visual-settlement.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts
```

Expected: all pass before semantic network changes begin. A failure in these commands is a blocker for R2 through R8 until the failing path is classified.

### Remaining Task R2: Harden The Network Trace Schema

**Files:**

- Modify: `ui/network/debug-trace.ts`
- Modify: `test/ui.network-debug-trace.test.ts`
- Modify after the trace API is proven in isolation: `ui/network-client.ts`
- Modify after the coordinator trace payload is proven in isolation: `ui/network/intake-coordinator.ts`

- [ ] Add explicit trace fields:

```ts
playbackActive: boolean | null;
decision: 'accepted' | 'deduped' | 'stale' | 'deferred' | 'refresh_requested' | 'rejected' | null;
```

- [ ] Keep existing fields:

```text
type
source
operationId
stateVersion
visualSeq
boardWriter
timestamp
accepted
reason
```

- [ ] Extend `test/ui.network-debug-trace.test.ts` with this focused case:

```ts
const trace = createNetworkDebugTrace({ limit: 2, now: () => 100 });
trace.record('network_intake_submit', {
  source: 'stream',
  operationId: 'op1',
  stateVersion: 1,
  visualSeq: 1,
  boardWriter: 'network_timeline',
  playbackActive: true,
  decision: 'accepted',
  reason: 'presentation_frames'
});
trace.record('network_intake_submit', {
  source: 'state_sync',
  operationId: 'op2',
  stateVersion: 2,
  visualSeq: 2,
  boardWriter: 'none',
  playbackActive: false,
  decision: 'deduped',
  reason: 'duplicate_operation_state'
});
trace.record('network_intake_submit', {
  source: 'stream',
  operationId: 'op3',
  stateVersion: 3,
  visualSeq: 3,
  boardWriter: 'network_timeline',
  playbackActive: false,
  decision: 'accepted',
  reason: 'fresh_state'
});
expect(trace.snapshot()).toEqual([
  expect.objectContaining({ operationId: 'op2', playbackActive: false, decision: 'deduped' }),
  expect.objectContaining({ operationId: 'op3', playbackActive: false, decision: 'accepted' })
]);
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-debug-trace.test.ts test/ui.network-intake-coordinator.test.ts
```

Expected: trace dumps explain which intake source won, which source was deduped, and whether visual playback was active at the decision point.

### Remaining Task R3: Prove Every Intake Source Uses The Coordinator

**Files:**

- Modify: `test/ui.network-client.apply-coordinator.test.ts`
- Modify: `test/ui.network-client.reconnect-sync.test.ts`
- Modify: `test/ui.network-stream-snapshot.test.ts`
- Modify after red tests: `ui/network/publish-flow.ts`
- Modify after red tests: `ui/network/stream-snapshot.ts`
- Modify after red tests: `ui/network/session-lifecycle.ts`

- [ ] Add a source matrix test that covers:

```text
publish_response
stream
state_sync
presentation_journal
heartbeat_recovery
```

- [ ] For each source, assert:

```text
NetworkIntakeCoordinator.submit is called once
networkDebugTrace records the same source
direct renderBoard/renderBoardFull/flushVisualUpdates/emitBoardUpdate is not called from the source handler
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-client.apply-coordinator.test.ts test/ui.network-client.reconnect-sync.test.ts test/ui.network-stream-snapshot.test.ts
```

Expected: all authoritative network state arrivals enter through the intake coordinator before board refresh or presentation enqueue.

### Remaining Task R4: Characterize Duplicate Source Arrival

**Files:**

- Modify: `test/ui.network-intake-coordinator.test.ts`
- Modify: `test/ui.network-client.apply-coordinator.test.ts`
- Modify after red tests: `ui/network/intake-coordinator.ts`
- Modify after red tests: `ui/network-client.ts`

- [ ] Add a test for the same `operationId`, `stateVersion`, and `visualSeq` arriving through `publish_response` and then `stream`.

- [ ] Assert the exact result:

```text
canonical snapshot applied count: 1
presentation frame enqueue count: 1
board refresh request count: 0
trace decisions: accepted, deduped
duplicateOperation: true on the second submit result
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-intake-coordinator.test.ts test/ui.network-client.apply-coordinator.test.ts
npm run test:network:parity
```

Expected: POST response, SSE, state sync, and journal replay cannot double-apply the same visual transition.

### Remaining Task R5: Keep Single Visual Writer Enforcement Green

**Files:**

- Read first: `scripts/check-playback-board-writer.ts`
- Modify after a failing gate: `ui/render-scheduler.ts`
- Modify after a failing gate: `ui/network/presentation-timeline.ts`
- Modify after a failing gate: `ui/network-client.ts`

- [ ] Run:

```powershell
npm run match:playback-board-writer-check
```

- [ ] When the gate reports a direct writer, remove that specific direct call path or route it through the existing presentation timeline / render scheduler path.

- [ ] Re-run:

```powershell
npm run match:playback-board-writer-check
npx jest --runInBand --runTestsByPath test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.network-presentation-timeline.test.ts
```

Expected: no network playback path writes board DOM directly while visual playback is active.

### Remaining Task R6: Finish Pending Selection visualSeq Settlement

**Files:**

- Modify: `test/ui.card-interaction-pending-network.test.ts`
- Modify: `test/ui.network-snapshot.pending-presentation-reconcile.test.ts`
- Modify: `test/ui.playback-state-manager.test.ts`
- Modify after red tests: `cards/card-interaction-pending-settlement.ts`
- Modify after red tests: `ui/playback-state-manager.ts`
- Modify after red tests: `ui/network/visual-settlement.ts`

- [ ] Add a normal-success test where publish result contains `presentationCursor.visualSeq: 12`.

- [ ] Assert the exact sequence:

```text
waitForNetworkVisualSeq(12, { operationId }) is called
busy or selection lock remains true before visualSeq 12 settles
visualSeq 11 settlement does not release the lock
visualSeq 12 settlement releases the lock
clearOrphanNetworkPlaybackQueues is not called during normal success
```

- [ ] Keep orphan cleanup only for abort, stale recovery, or explicit abandonment paths, and record a trace entry when cleanup runs.

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.card-interaction-pending-network.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.playback-state-manager.test.ts
npm run test:network:parity
```

Expected: pending card selection settles on authoritative visual playback completion, not on a fixed 1,500 ms cleanup path.

### Remaining Task R7: Reconnect One-Flight And Journal Catch-Up Audit

**Files:**

- Modify: `test/ui.network-reconnect-controller.test.ts`
- Modify: `test/ui.network-client.reconnect-sync.test.ts`
- Modify after red tests: `ui/network/reconnect-controller.ts`
- Modify after red tests: `ui/network/session-lifecycle.ts`
- Modify after red tests: `ui/network/intake-coordinator.ts`

- [ ] Add or extend a test where heartbeat recovery and reconnect recovery are requested in the same tick.

- [ ] Assert:

```text
syncLatestStateWithRetry call count: 1
networkRecoverySyncInFlight prevents duplicate reconnect recovery
heartbeatResyncInFlight prevents duplicate heartbeat recovery
presentation_journal submits a NetworkSnapshotEnvelope
presentation_journal does not call direct board render
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-reconnect-controller.test.ts test/ui.network-client.reconnect-sync.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts
npm run test:network:parity
```

Expected: reconnect, heartbeat recovery, state sync, and presentation journal catch-up are one-flight and idempotent.

### Remaining Task R8: Add Ack-Only POST Behind A Compatibility Flag

**Files:**

- Modify after R2 through R7 pass: `workers/match-worker-publish-controller.ts`
- Modify after R2 through R7 pass: `scripts/local-match-server.ts`
- Modify after R2 through R7 pass: `utils/match-authority.ts`
- Modify after R2 through R7 pass: `ui/network/publish-flow.ts`
- Test: `test/workers.match-publish-idempotency.test.ts`
- Test: `test/ui.network-client.publish-base-version.test.ts`
- Test: `test/ui.network-publish-flow.contract.test.ts`

- [ ] Preserve the default response mode:

```ts
const publishResponseMode = room.publishResponseMode || 'snapshot_compat';
```

- [ ] Add ack-only coverage that returns:

```ts
{
  ok: true,
  operationId,
  stateVersion: room.stateVersion,
  presentationCursor: buildPresentationCursor(room),
  publishMeta,
  serverTime
}
```

- [ ] Assert snapshot-compatible POST remains the default for both Worker and local match server.

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-publish-idempotency.test.ts test/ui.network-client.publish-base-version.test.ts test/ui.network-publish-flow.contract.test.ts test/ui.network-client.reconnect-sync.test.ts
npm run test:network:parity
```

Expected: payload reduction is opt-in only, and default network battle behavior is unchanged until the compatibility flag is deliberately switched.

### Remaining Task R9: Run The Local Two-Browser Smoke As The Final Local Gate

**Files:**

- Read/modify after failure classification: `test/e2e/network-battle-complete-smoke.test.ts`

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/e2e/network-battle-complete-smoke.test.ts
```

Expected:

```text
/api/match/publish 500 count: 0
unexpected publish 409 count: 0
duplicate visualSeq playback count: 0
direct board write during playback count: 0
stuck busy lock count: 0
final canonical board hash matches across both clients
```

### Remaining Task R10: Public Live Check After Explicit Approval

**Files:**

- Create after live check: `docs/network-live-check-2026-06-22.md`

- [ ] Before asking for deployment approval, run:

```powershell
npm run typecheck
npm run build:browser
npm run check:generated-network-surface
npm run test:network:parity
npm run match:boot-performance-check
npm run match:ui-control-smoke
npm run worker:prepare
```

- [ ] Ask the user for explicit deployment approval.

- [ ] After approval, verify `https://card.reversi-0.workers.dev/` with two independent browser sessions, Chrome as one player and Edge as the other.

- [ ] Capture the live-check report fields:

```text
roomId
Chrome console summary
Edge console summary
publish status summary
request failure summary
network debug trace from both browsers
screenshots before reconnect
screenshots after reconnect
final canonical board hash from both browsers
```

Expected: the public live check reproduces the local gate with no publish 500, no duplicate playback, no direct board write during playback, no stuck busy lock, and matching final canonical board hash.

## Phase 0: Freeze, Inventory, And Safety Baseline

Goal: make the repo safe to continue from the current partially repaired state.

### Task 0.1: Classify Dirty Worktree

**Files:**

- Read: repository working tree
- Modify: none

- [ ] Run:

```powershell
git status --short
```

Expected currently: unrelated dirty files may remain:

```text
 M test/ui.animation-engine.test.ts
 M test/ui.animation-utils.hand-fallback.test.ts
 M ui/animation-engine.ts
 M ui/animation-utils.ts
 M worker-public/styles-layout-info.css
 M worker-public/styles-layout-result.css
```

- [ ] If any task below needs one of those files, inspect the diff before editing:

```powershell
git diff -- test/ui.animation-engine.test.ts test/ui.animation-utils.hand-fallback.test.ts ui/animation-engine.ts ui/animation-utils.ts
git diff -- worker-public/styles-layout-info.css worker-public/styles-layout-result.css
```

Expected: either classify as related and include focused verification, or leave untouched.

### Task 0.2: Commit This Revised Plan Before Further Implementation

**Files:**

- Modify: `docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md`

- [ ] Run:

```powershell
git diff -- docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md
git diff --check -- docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md
```

Expected: only this revised plan is changed, and no whitespace errors.

- [ ] Commit only this plan:

```powershell
git add docs/superpowers/plans/2026-06-22-network-battle-complete-repair-optimization.md
git commit -m "Revise network repair plan for boot safety"
```

Expected: unrelated dirty files stay unstaged.

## Phase 1: Lock The Boot Contract Before More Optimization

Goal: prevent debug, skin, gacha, ranking, CPU, and normal play from disappearing again.

### Task 1.1: Extend Registry Classification Tests

**Files:**

- Modify: `test/scripts.build-module-registry.boot-contract.test.ts`
- Modify: `scripts/build-module-registry.ts`

- [ ] Add classification expectations:

```ts
test('keeps visible UI handler shells in startup registry', () => {
  expect(classifyBrowserBootModule('dist/ui/handlers/debug')).toBe('required');
  expect(classifyBrowserBootModule('dist/ui/handlers/gacha')).toBe('required');
  expect(classifyBrowserBootModule('dist/ui/handlers/hand-skin')).toBe('required');
  expect(classifyBrowserBootModule('dist/ui/handlers/match-mode')).toBe('required');
  expect(classifyBrowserBootModule('dist/ui/handlers/match-mode/leaderboard-controller')).toBe('required');
});

test('keeps heavy feature bodies optional', () => {
  expect(classifyBrowserBootModule('dist/ui/debug-card-search')).toBe('optional');
  expect(classifyBrowserBootModule('dist/ui/gacha/gacha-overlay-controller')).toBe('optional');
  expect(classifyBrowserBootModule('dist/ui/hand-skin/controller')).toBe('optional');
  expect(classifyBrowserBootModule('dist/ui/background-skin/controller')).toBe('optional');
  expect(classifyBrowserBootModule('dist/ui/font-skin/controller')).toBe('optional');
  expect(classifyBrowserBootModule('dist/ui/leaderboard-client')).toBe('optional');
  expect(classifyBrowserBootModule('dist/game/ai/policy-onnx-runtime')).toBe('optional');
  expect(classifyBrowserBootModule('node_modules/onnxruntime-web/dist/ort.min')).toBe('optional');
});
```

- [ ] Run red/green:

```powershell
npx jest --runInBand --runTestsByPath test/scripts.build-module-registry.boot-contract.test.ts
```

Expected: PASS only after the classifier follows the contract above.

### Task 1.2: Add Lazy Loader Group Tests

**Files:**

- Modify: `test/ui.bootstrap.lazy-runtime-loader.test.ts`
- Modify: `ui/bootstrap/lazy-runtime-loader.ts`

- [ ] Ensure the test covers all known lazy groups:

```ts
await loader.load('gacha');
await loader.load('cosmetic');
await loader.load('leaderboard');
await loader.load('commentary');
await loader.load('cpu');
expect(loadedScripts).toEqual(['public/module-registry.optional.js']);
expect(loader.isLoaded('gacha')).toBe(true);
expect(loader.isLoaded('cosmetic')).toBe(true);
expect(loader.isLoaded('leaderboard')).toBe(true);
expect(loader.isLoaded('commentary')).toBe(true);
expect(loader.isLoaded('cpu')).toBe(true);
expect(loader.isLoaded('onnx')).toBe(false);
```

- [ ] Verify ONNX still loads the ONNX script only for the ONNX group:

```ts
await loader.load('onnx');
expect(loadedScripts).toEqual([
  'public/module-registry.optional.js',
  'node_modules/onnxruntime-web/dist/ort.min.js'
]);
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.bootstrap.lazy-runtime-loader.test.ts
```

Expected: optional registry is loaded once; ONNX script is not loaded by cosmetic, gacha, leaderboard, commentary, or cpu groups.

### Task 1.3: Add Required-Shell Lazy-Body Unit Tests

**Files:**

- Modify: `test/ui.gacha-handler.test.ts`
- Modify: `test/ui.hand-skin-handler.test.ts`
- Modify: `test/ui.match-mode.leaderboard-limit.test.ts`
- Modify only if tests fail: `ui/handlers/gacha.ts`
- Modify only if tests fail: `ui/handlers/hand-skin.ts`
- Modify only if tests fail: `ui/handlers/match-mode/leaderboard-controller.ts`

- [ ] For gacha, test missing gacha body at startup:

```ts
const loadLazyRuntimeGroup = jest.fn(async (group) => {
  expect(group).toBe('gacha');
  global.GachaOverlayControllerModule = fakeControllerModule;
  return true;
});
const api = setupGachaControls({ root: window, loadLazyRuntimeGroup });
document.getElementById('gachaOpenBtn')!.click();
await Promise.resolve();
expect(loadLazyRuntimeGroup).toHaveBeenCalledTimes(1);
```

- [ ] For hand skin, keep the existing lazy test behavior:

```ts
const api = mod.setupHandSkinControls({ root: window, loadLazyRuntimeGroup });
document.getElementById('handSkinBtn').click();
await Promise.resolve();
expect(loadLazyRuntimeGroup).toHaveBeenCalledWith('cosmetic');
expect(controllerApi.openPanel).toHaveBeenCalledTimes(1);
```

- [ ] For ranking, keep the existing lazy test behavior:

```ts
window.loadLazyRuntimeGroup = jest.fn(async (group) => {
  expect(group).toBe('leaderboard');
  window.LeaderboardClient = lazyClient;
  return true;
});
document.getElementById('leaderboardOpenBtn')!.click();
await new Promise((resolve) => setImmediate(resolve));
expect(window.loadLazyRuntimeGroup).toHaveBeenCalledTimes(1);
expect(fetchLeaderboard).toHaveBeenCalledWith(expect.objectContaining({ limit: 100, mode: 'all', category: 'score' }));
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.gacha-handler.test.ts test/ui.hand-skin-handler.test.ts test/ui.match-mode.leaderboard-limit.test.ts
```

Expected: visible shells install click behavior even when feature bodies are not loaded at startup.

## Phase 2: Add Browser UI Control Smoke

Goal: unit tests are not enough; the actual built browser must prove visible controls survive startup splitting.

### Task 2.1: Create Browser UI Control Smoke Script

**Files:**

- Create: `scripts/browser-ui-control-smoke.ts`
- Modify: `package.json`

- [ ] Add a script that starts the local static server, launches Chromium, opens `/?debug=1`, and checks:

```ts
interface UiControlSmokeResult {
  debugButtonVisible: boolean;
  optionalRegistryLoadedAtStartup: boolean;
  handSkinOpensAfterClick: boolean;
  gachaOpensAfterClick: boolean;
  leaderboardOpensAfterClick: boolean;
  optionalRegistryLoadedAfterLazyClick: boolean;
  consoleErrors: string[];
}
```

- [ ] The smoke must fail if:

```text
debugButtonVisible !== true
optionalRegistryLoadedAtStartup !== false
handSkinOpensAfterClick !== true
gachaOpensAfterClick !== true
leaderboardOpensAfterClick !== true
optionalRegistryLoadedAfterLazyClick !== true
consoleErrors contains TypeError, ReferenceError, module not found, or Failed to load resource for module-registry.optional.js
```

- [ ] Add npm script:

```json
"match:ui-control-smoke": "npm run build:browser && node dist/scripts/browser-ui-control-smoke.js"
```

- [ ] Run:

```powershell
npm run match:ui-control-smoke
```

Expected: JSON result exits 0.

### Task 2.2: Gate Boot Performance With UI Control Smoke

**Files:**

- Modify: `scripts/browser-boot-performance-check.ts`
- Modify: `package.json`

- [ ] Keep `match:boot-performance-check` focused on byte/boot-time metrics.

- [ ] Add combined manual gate command to documentation, not necessarily a package script:

```powershell
npm run match:boot-performance-check
npm run match:ui-control-smoke
```

Expected: performance improvement is never accepted without visible-control smoke.

## Phase 3: Generated Surface And Mirror Discipline

Goal: prevent source, dist, browser registry, and worker mirror drift from hiding regressions.

### Task 3.1: Keep Generated Network Surface Checker Green

**Files:**

- Keep: `scripts/check-generated-network-surface.ts`
- Keep: `test/scripts.check-generated-network-surface.test.ts`
- Modify generated only by command: `public/module-registry.js`, `public/module-registry.optional.js`, `worker-public/`

- [ ] Run before any network behavior change:

```powershell
npm run check:generated-network-surface
```

Expected: PASS. If it fails, run source build/mirror commands before debugging runtime symptoms.

- [ ] After any root-to-worker impact, run:

```powershell
npm run build:browser
npm run worker:prepare
npm run check:generated-network-surface
```

Expected: only generated/mirror files from the scripts change.

### Task 3.2: Never Stage Broad Worker Mirror Diffs Blindly

**Files:**

- Generated mirror: `worker-public/`

- [ ] Before staging worker mirror files, inspect:

```powershell
git diff --stat -- worker-public
git diff -- worker-public/public/module-registry.js worker-public/index.html
git diff -- worker-public/styles-layout-info.css worker-public/styles-layout-result.css
```

Expected: stage only files directly generated by the current task. If CSS files changed without a root CSS source change and the task is not CSS, leave them unstaged and report them.

## Phase 4: Network Repair By Characterization, Not Rewrite

Goal: keep the network repair, but stop treating a giant replacement as a single implementation unit.

### Task 4.1: Add Trace Before Changing Semantics

**Files:**

- Create if not already present: `ui/network/debug-trace.ts`
- Create if not already present: `test/ui.network-debug-trace.test.ts`
- Modify: `ui/network-client.ts`

- [ ] Add trace entries for:

```text
source
operationId
stateVersion
visualSeq
boardWriter
playbackActive
decision
reason
```

- [ ] Focused test:

```ts
const trace = createNetworkDebugTrace({ limit: 2, now: () => 100 });
trace.record({ source: 'stream', operationId: 'op1', stateVersion: 1, visualSeq: 1, boardWriter: 'timeline', playbackActive: false, decision: 'accepted' });
trace.record({ source: 'state_sync', operationId: 'op2', stateVersion: 2, visualSeq: 2, boardWriter: 'none', playbackActive: true, decision: 'deferred' });
trace.record({ source: 'stream', operationId: 'op3', stateVersion: 3, visualSeq: 3, boardWriter: 'timeline', playbackActive: false, decision: 'accepted' });
expect(trace.snapshot().map((entry) => entry.operationId)).toEqual(['op2', 'op3']);
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-debug-trace.test.ts
```

Expected: PASS before any behavior changes.

### Task 4.2: Characterize Existing Duplicate Intake

**Files:**

- Modify: `test/ui.network-client.apply-coordinator.test.ts` or nearest existing network-client test
- Modify only after red test: `ui/network-client.ts`

- [ ] Add a failing test that sends the same transition through publish response and SSE:

```ts
expect(playback.enqueue).toHaveBeenCalledTimes(1);
expect(boardWriter.directRenderCalls).toBe(0);
expect(trace.snapshot().filter((entry) => entry.operationId === 'op_same')).toHaveLength(2);
```

- [ ] Implement only enough dedupe to make this pass.

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-client.apply-coordinator.test.ts
```

Expected: duplicate source arrival is traceable and idempotent.

### Task 4.3: Introduce Intake Envelope Behind Compatibility Path

**Files:**

- Create or modify: `ui/network/intake-envelope.ts`
- Create or modify: `ui/network/intake-coordinator.ts`
- Test: `test/ui.network-intake-envelope.test.ts`
- Test: `test/ui.network-intake-coordinator.test.ts`
- Modify cautiously: `ui/network/publish-flow.ts`
- Modify cautiously: `ui/network/stream-snapshot.ts`
- Modify cautiously: `ui/network/session-lifecycle.ts`

- [ ] Define the envelope:

```ts
export type NetworkIntakeSource =
  | 'publish_response'
  | 'stream'
  | 'state_sync'
  | 'presentation_journal'
  | 'heartbeat_recovery';

export interface NetworkSnapshotEnvelope {
  source: NetworkIntakeSource;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  snapshot: unknown | null;
  presentationFrames: unknown[];
  playbackEvents: unknown[];
  force: boolean;
  receivedAt: number;
}
```

- [ ] The first implementation must preserve existing response shapes. Do not switch server POST to ack-only in this phase.

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-intake-envelope.test.ts test/ui.network-intake-coordinator.test.ts
npm run test:network:parity
```

Expected: compatibility behavior passes before optimizing payloads.

## Phase 5: Single Visual Writer And Pending Selection Settlement

Goal: remove board-write races without re-breaking animation or controls.

### Task 5.1: Keep Board Writer Check As A Required Gate

**Files:**

- Keep: existing playback board writer check script/test
- Modify when the gate exposes a direct board-write path: `ui/render-scheduler.ts`, `ui/network/presentation-timeline.ts`, `ui/network-client.ts`

- [ ] Run before and after board-writer changes:

```powershell
npm run match:playback-board-writer-check
```

Expected: PASS. Any direct `renderBoard`, `renderBoardFull`, `flushVisualUpdates`, or `emitBoardUpdate` during active playback must be traceable as a failure.

### Task 5.2: Replace Normal Pending Timeout With visualSeq Settlement

**Files:**

- Modify: `cards/card-interaction-pending-settlement.ts`
- Modify: `ui/playback-state-manager.ts`
- Test: `test/ui.network-snapshot.pending-presentation-reconcile.test.ts`
- Test: `test/ui.playback-state-manager.test.ts`

- [ ] Add a failing test where pending selection completes only after the expected `visualSeq` is marked played:

```ts
settlement.trackPendingSelection({ operationId: 'op_pending', visualSeq: 12 });
settlement.onPublishAck({ operationId: 'op_pending', stateVersion: 20 });
expect(settlement.isBusy()).toBe(true);
settlement.onVisualSeqSettled(11);
expect(settlement.isBusy()).toBe(true);
settlement.onVisualSeqSettled(12);
expect(settlement.isBusy()).toBe(false);
```

- [ ] Remove normal-success deletion of `PLAYBACK_EVENTS` queues. Keep explicit abort cleanup only for stale abandoned recovery, with trace entry.

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.playback-state-manager.test.ts test/ui.animation-engine.test.ts
npm run test:network:parity
```

Expected: no normal 1,500 ms cleanup path is required for successful settlement.

## Phase 6: Reconnect Recovery As One Flight

Goal: reconnect, heartbeat resync, state sync, and journal catch-up cannot independently apply the same board transition.

### Task 6.1: Add One-Flight Recovery Test

**Files:**

- Modify: `test/ui.network-client.reconnect-sync.test.ts`
- Modify or create: `test/ui.network-reconnect-controller.test.ts`
- Modify only after red: `ui/network/reconnect-controller.ts` or existing reconnect code

- [ ] Add test:

```ts
controller.maybeSyncFromHeartbeat({ stateVersion: 4 });
controller.scheduleReconnectRecoverySync();
await Promise.resolve();
expect(syncLatestStateWithRetry).toHaveBeenCalledTimes(1);
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-client.reconnect-sync.test.ts test/ui.network-reconnect-controller.test.ts
```

Expected: one recovery request in flight at a time.

### Task 6.2: Route Journal Catch-Up Through Intake

**Files:**

- Modify: `ui/network/session-lifecycle.ts`
- Modify: `ui/network/intake-coordinator.ts`
- Modify: `test/ui.network-client.reconnect-sync.test.ts`

- [ ] Journal recovery submits `source: 'presentation_journal'` envelope and does not directly request a board render.

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/ui.network-client.reconnect-sync.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts
npm run test:network:parity
```

Expected: reconnect catch-up is idempotent and uses the same intake path.

## Phase 7: Payload Optimization Only After Stability

Goal: reduce network payloads after duplicate intake, reconnect, and playback settlement are proven stable.

### Task 7.1: Keep Snapshot-Compatible POST Until Tests Prove Ack-Only

**Files:**

- Modify in this phase: `workers/match-worker-publish-controller.ts`
- Modify in this phase: `utils/match-authority.ts`
- Modify in this phase: `ui/network/publish-flow.ts`
- Test: `test/workers.match-publish-idempotency.test.ts`
- Test: `test/ui.network-client.publish-base-version.test.ts`

- [ ] Do not remove snapshot-compatible POST response in the same commit as intake coordinator introduction.

- [ ] Add feature flag:

```ts
const publishResponseMode = room.publishResponseMode || 'snapshot_compat';
```

- [ ] Ack-only mode response:

```ts
{
  ok: true,
  operationId,
  stateVersion: room.stateVersion,
  presentationCursor: buildPresentationCursor(room),
  publishMeta,
  serverTime
}
```

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/workers.match-publish-idempotency.test.ts test/ui.network-client.publish-base-version.test.ts test/ui.network-client.reconnect-sync.test.ts
npm run test:network:parity
```

Expected: snapshot compatibility remains green; ack-only is covered by targeted tests before it can become default.

## Phase 8: Browser Boot Optimization Rules Going Forward

Goal: preserve the current performance win without breaking other game modes.

### Task 8.1: Every New Optional Group Requires A Required Shell

**Files:**

- Modify for each optional group change: `scripts/build-module-registry.ts`
- Modify for each optional group change: shell handler under `ui/handlers/`
- Modify for each optional group change: `test/scripts.build-module-registry.boot-contract.test.ts`

- [ ] For any proposed optional prefix, add this checklist to the commit message or final report:

```text
visible entry point:
required shell module:
optional body modules:
lazy group name:
unit lazy test:
browser smoke:
boot performance check:
```

- [ ] If any item is missing, do not mark the prefix optional.

### Task 8.2: Required Verification For Boot Changes

**Files:**

- No source file if only running verification

- [ ] Run all commands for any boot optimization commit:

```powershell
npx jest --runInBand --runTestsByPath test/scripts.build-module-registry.boot-contract.test.ts test/ui.bootstrap.lazy-runtime-loader.test.ts test/ui.gacha-handler.test.ts test/ui.hand-skin-handler.test.ts test/ui.match-mode.leaderboard-limit.test.ts
npm run match:boot-performance-check
npm run match:ui-control-smoke
```

Expected:

- optional registry not loaded at startup
- ONNX script not loaded at startup
- debug button visible under `?debug=1`
- hand skin panel opens
- gacha overlay opens
- leaderboard panel opens

## Phase 9: End-To-End And Live Verification

Goal: prove network play works after the safer staged repairs.

### Task 9.1: Local Two-Browser Network Smoke

**Files:**

- Keep/modify: `test/e2e/network-battle-complete-smoke.test.ts`

- [ ] Run:

```powershell
npx jest --runInBand --runTestsByPath test/e2e/network-battle-complete-smoke.test.ts
```

Expected:

```text
/api/match/publish 500 count: 0
unexpected publish 409 count: 0
duplicate visualSeq playback count: 0
direct board write during playback count: 0
stuck busy lock count: 0
final canonical board hash matches across both clients
```

### Task 9.2: Public Live Check Only After User Approval

**Files:**

- Create as the live-check report artifact: `docs/network-live-check-YYYY-MM-DD.md`

- [ ] Before deploy request:

```powershell
npm run test:network:parity
npm run match:boot-performance-check
npm run match:ui-control-smoke
npm run worker:prepare
```

- [ ] Ask the user explicitly before deploying. Do not run deploy commands from this plan without approval.

- [ ] After deploy approval, run Chrome/Edge live check against:

```text
https://card.reversi-0.workers.dev/
```

- [ ] Capture:

```text
roomId
Chrome console summary
Edge console summary
network request summary
debug trace dump from both browsers
screenshots before and after reconnect
final board hash from both browsers
```

## Stop Conditions

Stop and report instead of continuing if any of these happens:

- `#debugModeBtn`, `#handSkinBtn`, `#gachaOpenBtn`, or `#leaderboardOpenBtn` becomes unavailable in browser smoke.
- optional registry loads at startup without a test-approved reason.
- ONNX loads at startup.
- a network change requires editing `game/`, `shared/`, or card logic to read browser state.
- generated/mirror diffs include unrelated CSS or asset changes.
- live or local network smoke shows publish 500.
- a task needs to overwrite an unrelated dirty file.

## Verification Ladder

Run the smallest relevant checks after each task:

```powershell
npx jest --runInBand --runTestsByPath <focused-test-files>
```

For boot changes:

```powershell
npx jest --runInBand --runTestsByPath test/scripts.build-module-registry.boot-contract.test.ts test/ui.bootstrap.lazy-runtime-loader.test.ts test/ui.gacha-handler.test.ts test/ui.hand-skin-handler.test.ts test/ui.match-mode.leaderboard-limit.test.ts
npm run match:boot-performance-check
npm run match:ui-control-smoke
```

For network runtime changes:

```powershell
npm run check:generated-network-surface
npm run test:network:parity
npm run match:playback-board-writer-check
npx jest --runInBand --runTestsByPath test/e2e/network-battle-complete-smoke.test.ts
```

Before public deployment:

```powershell
npm run typecheck
npm run build:browser
npm run check:generated-network-surface
npm run test:network:parity
npm run match:boot-performance-check
npm run match:ui-control-smoke
npm run worker:prepare
```

## Completion Criteria

The revised repair is complete only when all are true:

- This revised plan is committed and the old unchecked plan tasks are no longer used.
- Boot classification tests prove visible handler shells are required and heavy bodies are optional.
- Browser UI control smoke proves debug, hand skin, gacha, and leaderboard controls work after startup split.
- Boot performance check proves optional registry and ONNX are not loaded at startup.
- Generated network surface checker passes.
- Network parity passes.
- Single Visual Writer check passes.
- Local two-browser network smoke passes.
- `worker-public` is synced only through `npm run worker:prepare`, with unrelated mirror CSS diffs excluded unless explicitly part of the task.
- Public live Chrome/Edge verification passes after explicit deployment approval.

## Self-Review

- Spec coverage: this revision covers the user-reported boot regressions, the original network repair goal, generated/mirror safety, rollback/stop conditions, and live verification.
- Placeholder scan: no unresolved placeholder markers are intentionally left; every task names files, commands, and expected outcomes.
- Type consistency: lazy groups are consistently named `gacha`, `cosmetic`, `leaderboard`, `commentary`, `cpu`, and `onnx`; network intake source names match the revised envelope.
- Risk correction: the highest-risk part of the old plan was broad boot splitting without UI smoke. This revision moves boot contract and UI smoke before further optimization or network refactor work.
