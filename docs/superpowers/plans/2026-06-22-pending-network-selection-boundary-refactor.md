# Pending Network Selection Boundary Refactor Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `safe-refactor-lifecycle` first. If executing this plan task-by-task in an implementation session, use `superpowers:executing-plans` or `superpowers:subagent-driven-development` after reading this plan. Track progress by changing checkbox items from `[ ]` to `[x]`.

**Goal:** Reduce the remaining behavior-preserving refactor risk identified by the current repository audit by splitting pending network selection responsibilities into explicit ports/adapters, without changing gameplay rules, card behavior, animation order, network payload shape, public imports, or player-visible UI behavior.

**Primary target:** `cards/card-interaction-pending-network.ts` and its adjacent UI/network bridge callers.

**First safe pass:** Extract and characterize the network-client lookup/publish boundary behind a small internal adapter while keeping all existing exported functions and current timing/order intact.

**Tech stack:** TypeScript, CommonJS compatibility exports, Jest, existing browser boot/runtime, `npm run check:window`, targeted network/card tests, and `npm run test:network:parity` only after a network-contract pass.

---

## Document Role

This is an implementation plan, design note, and execution runbook for a behavior-preserving refactor. It is not a gameplay specification and does not change the source of truth for visible rules.

Source-of-truth documents:

- Gameplay and visible behavior: `01-rulebook.md`
- Internal architecture contracts: `docs/architecture-contracts.md`
- Root implementation source: root files under `cards/`, `game/`, `ui/`, `shared/`, `utils/`, `scripts/`
- Generated or mirrored surfaces: `dist/`, `public/module-registry.js`, `worker-public/`

Non-goals:

- No card rule, card cost, target rule, turn order, text, sound, animation timing, or result-state change.
- No full ESM migration, runtime cache semantics change, or broad boot rewrite.
- No `ui/board-renderer.ts` / `ui/diff-renderer.ts` cycle break in this plan's first implementation pass.
- No CSS selector merge or visual restyle.
- No source edits in `worker-public/`, `dist/`, or `public/module-registry.js`.
- No public import path removal; existing module exports must remain compatible.

## Current Evidence

The latest audit found these current facts:

- `entry-browser.js` remains large and global-heavy, but boot failure handling already has required/optional metadata and focused tests.
- `public/module-registry.js` still has 520 registered modules and 5 dependency cycles.
- `public/runtime.js` still caches modules after factory execution; changing it first would alter circular dependency behavior.
- `cards/card-interaction-pending-network.ts` still resolves `window/globalThis.NetworkMatchClient`, publishes snapshots, manages publish locks, waits for playback drain, clears playback flags/queues, releases busy state, and refreshes card UI in one file.
- `game/card-effects/selection-flow.ts` already uses a signal bridge for network publishing, so this is not currently a `game/` layer `NetworkMatchClient` violation.
- `npm run check:window` passes, confirming source-of-truth `game/` files do not currently contain forbidden browser/global network access.
- Focused tests already exist for the target area:
  - `test/ui.card-interaction-network-boundary.test.ts`
  - `test/ui.card-interaction-pending-network.test.ts`
  - `test/game.pending-selection-flow.test.ts`
  - `test/ui.network-snapshot.single-writer-baseline.test.ts`

Current risk interpretation:

- Boot and snapshot settlement were already partially refactored; do not restart that plan as the next first step.
- The best next small refactor is pending network selection boundary extraction because it is narrow, already has tests, and does not require changing board DOM ownership.
- `ui/board-renderer.ts` / `ui/diff-renderer.ts` remains important, but it should be handled later through characterization, not as the first implementation pass.

## Behavior To Preserve

The refactor must preserve all of the following:

- `cards/card-interaction-pending-network.ts` exported function names and call signatures.
- Current `NetworkMatchClient` active checks:
  - client must exist;
  - `publishSnapshot` must be a function;
  - `isActive()` must be true when present;
  - spectator clients must not publish through helper paths that currently block spectators.
- `publishNetworkDebugFillHand()` payload shape:

```ts
{
  actionType: 'debug_fill_hand',
  playbackEvents: [],
  action: { type: 'debug_fill_hand' }
}
```

- `startNetworkOnlyPendingSelectionPublish()` payload shape:

```ts
{
  playerKey: opts.playerKey,
  actionType: 'place',
  playbackEvents: [],
  action: opts.action
}
```

- Publish lock behavior:
  - duplicate publish for the same normalized player key returns `true`;
  - lock is set before publish;
  - lock clears on publish failure;
  - lock clears only after authoritative playback drain on publish success.
- Success order:
  - publish resolves with `ok === true`;
  - `opts.onSuccess` is called before settlement wait is scheduled;
  - authoritative visual playback drain is awaited;
  - publish lock clears;
  - visual playback flags clear;
  - orphan network playback queues clear;
  - pending selection busy becomes false;
  - card UI refresh runs.
- Failure order:
  - publish failure clears publish lock;
  - pending selection busy becomes false;
  - `opts.onFailure` receives the existing result or `{ ok: false, reason: 'NETWORK_PUBLISH_FAILED' }`;
  - card UI refresh is not newly added on failure unless current behavior already does it.
- Playback and Single Visual Writer constraints:
  - no new board DOM writer;
  - no forced board update during playback;
  - no reordering of `events[]` or playback events;
  - no canonical game/card state decision from animation, sound, playback, or busy flags.

## Design

### Target Shape

Keep `cards/card-interaction-pending-network.ts` as the compatibility facade. Split its internal responsibilities into small adjacent modules only after tests pin the current behavior.

```text
cards/card-interaction-pending-network.ts
  - existing public facade
  - composes injected deps and small helpers
  - keeps module.exports compatibility

cards/card-interaction-network-client.ts
  - resolves root NetworkMatchClient
  - validates active publish client
  - spectator check
  - safe publish wrapper
  - no playback or UI refresh logic

cards/card-interaction-pending-settlement.ts
  - wait for authoritative playback drain
  - clear visual playback flags
  - clear orphan network playback queues
  - no NetworkMatchClient lookup

cards/card-interaction-pending-publish.ts
  - publish-lock sequencing
  - success/failure settlement orchestration
  - no direct window/globalThis lookup
```

Do not create all modules in one pass. The first implementation pass should extract only `card-interaction-network-client.ts` unless the diff remains clearly small.

### Adapter Interfaces

Use plain object/function contracts. Do not introduce a new public class hierarchy.

```ts
type NetworkMatchClientLike = {
  publishSnapshot?: (payload: any) => Promise<any> | any;
  isActive?: () => boolean;
  isSpectator?: () => boolean;
};

type NetworkClientRootLike = {
  NetworkMatchClient?: NetworkMatchClientLike;
};

type PendingSelectionPublisher = {
  getRoot(): NetworkClientRootLike | null;
  getActiveClient(): NetworkMatchClientLike | null;
  isSpectatorActive(): boolean;
  publish(payload: any): Promise<any> | any;
};
```

Initial adapter rules:

- Root lookup may still read `window` and `globalThis`, but only in `cards/card-interaction-network-client.ts`.
- The facade must continue to export `getNetworkMatchClientRoot()` and `getActiveNetworkMatchClient()` by delegating to the new adapter.
- `cards/card-interaction.ts` must not grow new root lookup logic.
- `game/` and `shared/` must not import this adapter.

### Dependency Direction

Allowed:

- `cards/card-interaction-pending-network.ts` -> `cards/card-interaction-network-client.ts`
- `cards/card-interaction-pending-network.ts` -> `cards/card-interaction-pending-settlement.ts`
- `cards/card-interaction.ts` -> existing pending network facade
- `ui/bootstrap.ts` / `ui/network-client.ts` -> `game/card-effects/selection-flow.ts` signal bridge

Forbidden:

- `game/` -> `cards/card-interaction-network-client.ts`
- `game/` -> root `NetworkMatchClient`
- `shared/` -> browser/network client lookup
- `cards/card-interaction-network-client.ts` -> playback-state-manager, board renderer, DOM, or card UI refresh
- any new board DOM write path

### Later Design, Not First Pass

After the client adapter is stable, a later pass may extract settlement helpers. That later pass should preserve the same public exports and tests before moving code.

After settlement extraction, a separate UI/bootstrap pass may consolidate repeated `publishSnapshot` / `isNetworkPublishActive` bridge closures in `ui/bootstrap.ts` and `ui/network-client.ts`. That pass is more sensitive because those bridges touch network active/spectator behavior in multiple runtime paths.

## Execution Preconditions

- Start with:

```powershell
git status --short
```

- If target files have unrelated dirty changes, stop and classify them before editing.
- Do not touch current unrelated dirty files such as CSS, manifest, generated registry, or `worker-public/` outputs unless the active pass explicitly requires them.
- Do not create a branch, tag, worktree, or broad formatter run.
- Commit only after a focused implementation pass is verified. For this planning document itself, no commit is required unless the user requests it or the session policy explicitly switches from plan-only to implementation.

## Pass 0: Baseline Confirmation

**Risk:** Low. Read-only.

- [x] Confirm current target files are clean:

```powershell
git status --short
git diff -- cards/card-interaction-pending-network.ts cards/card-interaction.ts ui/bootstrap.ts ui/network-client.ts
```

Expected:

- No unrelated local edits in target files.
- Existing dirty files outside target scope remain untouched.

- [x] Run current focused baseline:

```powershell
npx jest --runInBand --runTestsByPath test\ui.card-interaction-network-boundary.test.ts test\ui.card-interaction-pending-network.test.ts test\game.pending-selection-flow.test.ts
npm run check:window
```

Expected:

- All focused tests pass.
- `check:window` passes.

Stop if either command fails for reasons touching target files.

## Pass 1: Extract Network Client Lookup Adapter

**Risk:** Low to medium. The extracted code still reads the same root globals and preserves existing exported facade functions.

**Files likely to change:**

- Add: `cards/card-interaction-network-client.ts`
- Modify: `cards/card-interaction-pending-network.ts`
- Modify: `test/ui.card-interaction-network-boundary.test.ts`
- Possibly modify: `test/ui.card-interaction-pending-network.test.ts`
- Generated by command only: `public/module-registry.js`
- Mirror by command only, if deploy assets need syncing: `worker-public/public/module-registry.js` and related worker assets from `npm run worker:prepare`

### Step 1: Strengthen Characterization Tests

- [x] Extend `test/ui.card-interaction-network-boundary.test.ts` to lock current root resolution behavior:

```ts
test('prefers window NetworkMatchClient root over globalThis fallback', () => {
  const pendingNetwork = require('../cards/card-interaction-pending-network');
  const windowRoot: any = { NetworkMatchClient: { publishSnapshot: jest.fn(), isActive: () => true } };
  const oldWindow = (global as any).window;
  (global as any).window = windowRoot;
  (global as any).NetworkMatchClient = { publishSnapshot: jest.fn(), isActive: () => true };

  expect(pendingNetwork.getNetworkMatchClientRoot()).toBe(windowRoot);

  (global as any).window = oldWindow;
});
```

- [x] Add checks for inactive/missing clients:

```ts
test('active client resolver rejects missing publishSnapshot and inactive clients', () => {
  const pendingNetwork = require('../cards/card-interaction-pending-network');
  (global as any).NetworkMatchClient = { isActive: () => true };
  expect(pendingNetwork.getActiveNetworkMatchClient()).toBeNull();

  (global as any).NetworkMatchClient = { publishSnapshot: jest.fn(), isActive: () => false };
  expect(pendingNetwork.getActiveNetworkMatchClient()).toBeNull();
});
```

- [x] Add spectator behavior check:

```ts
test('spectator check tolerates client exceptions', () => {
  const pendingNetwork = require('../cards/card-interaction-pending-network');
  (global as any).NetworkMatchClient = {
    publishSnapshot: jest.fn(),
    isActive: () => true,
    isSpectator: () => { throw new Error('boom'); }
  };
  expect(pendingNetwork.isNetworkSpectatorActive()).toBe(false);
});
```

- [x] Run the focused tests:

```powershell
npx jest --runInBand --runTestsByPath test\ui.card-interaction-network-boundary.test.ts test\ui.card-interaction-pending-network.test.ts
```

Expected:

- Tests pass before production changes. These tests document current behavior.

### Step 2: Add `cards/card-interaction-network-client.ts`

- [x] Create a new internal helper module with these exports:

```ts
function getNetworkMatchClientRoot(): any;
function getActiveNetworkMatchClient(): any;
function isNetworkSpectatorActive(): boolean;
function publishNetworkDebugFillHand(): any;

export = {
  getNetworkMatchClientRoot,
  getActiveNetworkMatchClient,
  isNetworkSpectatorActive,
  publishNetworkDebugFillHand
};
```

Implementation requirements:

- Move the exact current logic from `cards/card-interaction-pending-network.ts`.
- Keep `window` priority over `globalThis`.
- Keep `publishSnapshot`, `isActive`, and `isSpectator` semantics identical.
- Keep debug fill payload exactly unchanged.
- Do not import playback-state-manager or any DOM/UI modules.

### Step 3: Make Pending Network Facade Delegate

- [x] Modify `cards/card-interaction-pending-network.ts`:

```ts
let NetworkClientAdapter: any = null;
try {
  NetworkClientAdapter = require('./card-interaction-network-client');
} catch (e) {
  NetworkClientAdapter = null;
}
```

- [x] Replace local implementations of:

```ts
getNetworkMatchClientRoot
getActiveNetworkMatchClient
isNetworkSpectatorActive
publishNetworkDebugFillHand
```

with delegating wrappers that preserve the existing export names.

Fallback behavior:

- During normal builds, the adapter should always exist.
- If the adapter cannot be required in a legacy/test environment, keep a small local fallback only if existing tests require it. Prefer failing focused tests over silently duplicating full logic twice.

### Step 4: Validate Pass 1

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.card-interaction-network-boundary.test.ts test\ui.card-interaction-pending-network.test.ts test\game.pending-selection-flow.test.ts
npm run check:window
npm run typecheck
npm run build:browser
```

Expected:

- Focused tests pass.
- `check:window` still passes.
- Typecheck passes.
- Browser build succeeds.
- If `public/module-registry.js` changes, the diff is command-generated and includes `cards/card-interaction-network-client`.

Review:

```powershell
git diff -- cards/card-interaction-network-client.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-network-boundary.test.ts test/ui.card-interaction-pending-network.test.ts public/module-registry.js
git diff --check -- cards/card-interaction-network-client.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-network-boundary.test.ts test/ui.card-interaction-pending-network.test.ts public/module-registry.js
Select-String -Path public\module-registry.js -Pattern "cards/card-interaction-network-client"
```

Expected:

- No public export names removed.
- No payload shape changes.
- No generated or mirror files are hand-edited.
- Any `public/module-registry.js` diff is explainable as `npm run build:browser` output.

Commit when executing implementation:

```powershell
git add -- cards/card-interaction-network-client.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-network-boundary.test.ts test/ui.card-interaction-pending-network.test.ts public/module-registry.js
git commit -m "Extract card interaction network client adapter"
```

## Pass 2: Extract Pending Selection Settlement Helpers

**Risk:** Medium. This touches success/failure settlement ordering.

**Files likely to change:**

- Add: `cards/card-interaction-pending-settlement.ts`
- Modify: `cards/card-interaction-pending-network.ts`
- Modify: `test/ui.card-interaction-pending-network.test.ts`

### Step 1: Add Ordering Tests Before Extraction

- [x] Extend `test/ui.card-interaction-pending-network.test.ts` to assert success order explicitly:

```ts
test('successful publish settles only after authoritative playback drain', async () => {
  const order: string[] = [];
  const pendingNetwork = require('../cards/card-interaction-pending-network');
  const drain = jest.fn(() => Promise.resolve().then(() => order.push('drain')));
  const deps = createPendingNetworkDeps({
    playbackStateManager: {
      waitForVisualPlaybackDrain: drain,
      setPlaybackActive: () => order.push('clear-active'),
      setPlaybackStartedAt: () => order.push('clear-started')
    },
    setPendingSelectionBusy: (next: boolean) => order.push(`busy:${next}`),
    renderCardUiSafely: () => order.push('render')
  });

  await startAndFlushSuccessfulPublish(pendingNetwork, deps, {
    onSuccess: () => order.push('success')
  });

  expect(order).toEqual(['success', 'drain', 'clear-active', 'clear-started', 'busy:false', 'render']);
});
```

Use existing test helper names if they differ; do not create broad fake UI state when the current test already has a smaller harness.

- [x] Add failure-order test:

```ts
test('publish failure clears lock and busy before onFailure callback completes', async () => {
  const order: string[] = [];
  deps.setPendingSelectionBusy = jest.fn((next: boolean) => {
    order.push(`busy:${next}`);
  });
  const onFailure = jest.fn(() => {
    order.push(`failure-lock:${publishLocks.black}`);
  });

  pendingNetwork.startNetworkOnlyPendingSelectionPublish({
    playerKey: 'black',
    action: { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' },
    onFailure
  }, deps);

  await flushPromises();
  expect(publishLocks.black).toBe(true);

  resolvePublish && resolvePublish({ ok: false, reason: 'OUT_OF_TURN' });
  await flushPromises();

  expect(order).toEqual(['busy:false', 'failure-lock:false']);
  expect(onFailure).toHaveBeenCalledWith({ ok: false, reason: 'OUT_OF_TURN' });
  expect(deps.playbackStateManager.waitForVisualPlaybackDrain).not.toHaveBeenCalled();
});
```

- [x] Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.card-interaction-pending-network.test.ts
```

Expected:

- Tests pass before extraction, proving they describe current behavior.

### Step 2: Add `cards/card-interaction-pending-settlement.ts`

Move these functions without behavior changes:

- `getWaitForPlaybackIdleFn`
- `getVisualPlaybackDrainFn`
- `waitForAuthoritativeVisualPlaybackDrain`
- `clearAuthoritativeVisualPlaybackFlag`
- `waitForCardUseAnimationIdle`
- `clearOrphanNetworkPlaybackQueues`

Rules:

- Preserve function names and argument shapes.
- No `NetworkMatchClient` access.
- No publish lock logic.
- No payload construction.
- No board DOM writes.

### Step 3: Delegate From Facade

In `cards/card-interaction-pending-network.ts`, delegate settlement helper exports to the new module.

Keep `startNetworkOnlyPendingSelectionPublish()` in the facade for this pass. It should call the delegated helper functions, but the publish orchestration remains visible in one place until tests prove extraction is safe.

### Step 4: Validate Pass 2

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.card-interaction-pending-network.test.ts test\ui.card-interaction-network-boundary.test.ts test\game.pending-selection-flow.test.ts test\ui.network-snapshot.single-writer-baseline.test.ts
npm run check:window
npm run typecheck
```

Expected:

- All focused tests pass.
- No `game/` boundary regression.
- No Single Visual Writer regression.

Review and commit:

```powershell
git diff -- cards/card-interaction-pending-settlement.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-pending-network.test.ts
git diff --check -- cards/card-interaction-pending-settlement.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-pending-network.test.ts
git add -- cards/card-interaction-pending-settlement.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-pending-network.test.ts
git commit -m "Extract pending selection playback settlement"
```

## Pass 3: Extract Publish Orchestration

**Risk:** Medium. This pass can be skipped if Pass 1 and Pass 2 already reduce the file enough.

**Files likely to change:**

- Add: `cards/card-interaction-pending-publish.ts`
- Modify: `cards/card-interaction-pending-network.ts`
- Modify: `test/ui.card-interaction-pending-network.test.ts`

### Step 1: Verify Pass Size

- [x] Count remaining responsibilities:

```powershell
rg -n "function |publishSnapshot|publishLocks|setPendingSelectionBusy|renderCardUiSafely|waitForAuthoritativeVisualPlaybackDrain" cards/card-interaction-pending-network.ts
```

Proceed only if `startNetworkOnlyPendingSelectionPublish()` remains the dominant mixed-responsibility block and tests from Pass 2 are stable.

### Step 2: Extract `startNetworkOnlyPendingSelectionPublish()` Internals

Create:

```ts
function startPendingSelectionPublish(options: any, deps: PendingNetworkDeps, ports: {
  getActiveNetworkMatchClient: () => any;
  waitForAuthoritativeVisualPlaybackDrain: (deps: PendingNetworkDeps) => Promise<any>;
  clearAuthoritativeVisualPlaybackFlag: (deps: PendingNetworkDeps) => boolean;
  clearOrphanNetworkPlaybackQueues: (deps: PendingNetworkDeps) => boolean;
}): boolean
```

Rules:

- Preserve return values exactly.
- Preserve publish lock behavior exactly.
- Preserve success/failure callback timing exactly.
- Preserve current catch/fallback behavior.
- Do not normalize options differently.

Keep the old facade export:

```ts
function startNetworkOnlyPendingSelectionPublish(options: any, deps: PendingNetworkDeps) {
  return PendingPublish.startPendingSelectionPublish(options, deps, ports);
}
```

### Step 3: Validate Pass 3

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.card-interaction-pending-network.test.ts test\ui.card-interaction-network-boundary.test.ts test\game.pending-selection-flow.test.ts
npm run check:window
npm run typecheck
```

Expected:

- No behavior changes in focused tests.

Review and commit:

```powershell
git diff -- cards/card-interaction-pending-publish.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-pending-network.test.ts
git diff --check -- cards/card-interaction-pending-publish.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-pending-network.test.ts
git add -- cards/card-interaction-pending-publish.ts cards/card-interaction-pending-network.ts test/ui.card-interaction-pending-network.test.ts
git commit -m "Extract pending selection publish orchestration"
```

## Pass 4: Consolidate Bootstrap Publish Bridge Duplication

**Risk:** Medium to high. This pass touches `ui/bootstrap.ts`, which has several similar `publishSnapshot` and `isNetworkPublishActive` closures.

This pass must not be combined with Pass 1-3.

**Files likely to change:**

- Add: `ui/bootstrap/network-publish-bridge.ts` or `ui/network/publish-bridge.ts`
- Modify: `ui/bootstrap.ts`
- Modify: `ui/network-client.ts` only if the same helper can be used without changing runtime initialization order.
- Modify/add focused bootstrap tests.

### Step 1: Characterize Existing Duplication

- [ ] Locate current closures:

```powershell
rg -n "publishSnapshot: \\(meta|isNetworkPublishActive|NetworkMatchClient" ui/bootstrap.ts ui/network-client.ts
```

- [ ] Add focused tests for the bridge behavior that currently appears in duplicate closures:

Required cases:

- missing `NetworkMatchClient` returns `undefined` / `false`;
- missing `publishSnapshot` returns `undefined` / `false`;
- inactive client returns `undefined` / `false`;
- spectator client returns `undefined` / `false`;
- active non-spectator client calls `publishSnapshot(meta)`;
- exception returns `undefined` / `false`.

### Step 2: Extract A Bootstrap-Local Helper

Prefer a helper that accepts a root reader instead of reading globals directly:

```ts
function createNetworkPublishBridge(readRoot: () => any, isSpectator: (client: any) => boolean) {
  return {
    publishSnapshot(meta: any) { /* current behavior */ },
    isNetworkPublishActive() { /* current behavior */ }
  };
}
```

Rules:

- Do not change when `selectionFlow.setSignalBridge()` runs.
- Do not change `ui/network-client.ts` global installation order.
- Do not import `cards/card-interaction-network-client.ts` into `ui/bootstrap.ts`; that helper is card-surface scoped.
- Do not add `game/` dependency on this helper.

### Step 3: Validate Pass 4

Run:

```powershell
npx jest --runInBand --runTestsByPath test\ui.bootstrap.cpu-early-registration.test.ts test\game.pending-selection-flow.test.ts test\ui.card-interaction-pending-network.test.ts
npm run check:window
npm run typecheck
npm run build:browser
```

Expected:

- Bootstrap tests pass.
- Build succeeds.
- Generated registry changes, if any, come only from `npm run build:browser` and are inspected.

If generated output changed:

```powershell
git diff -- public/module-registry.js
```

Stage generated output only if the build command produced it for this pass and the diff is understood.

## Pass 5: Board/Diff Renderer Characterization Only

**Risk:** Low if no production code changes. This is preparation for a later plan.

Do not break the `ui/board-renderer.ts` / `ui/diff-renderer.ts` cycle in this plan. Only add tests or tooling that capture current behavior.

### Step 1: Record Current Cycle

```powershell
rg -n "require\\('./diff-renderer'|require\\('./board-renderer'|_require\\('./diff-renderer'|_require\\('./board-renderer')" ui/board-renderer.ts ui/diff-renderer.ts
```

Expected:

- `ui/diff-renderer.ts` imports board-renderer helpers.
- `ui/board-renderer.ts` imports diff-renderer for full/diff rendering.

### Step 2: Add Characterization Tests Only If Missing

Candidate tests:

- playback active suppresses board DOM writes;
- network snapshot playback defers final board update;
- diff fallback flip suppression stays armed for playback snapshots;
- `renderBoardFull` and `forceFullRender` produce the same legal-hint visibility for network viewer seats.

Use existing tests first:

```powershell
npx jest --runInBand --runTestsByPath test\ui.network-snapshot.single-writer-baseline.test.ts test\ui.board-renderer.fallback-legal-hint.test.ts test\ui.network-legal-hints.test.ts
```

If these already cover the behavior, do not add duplicate tests.

## Pass 6: CSS Audit Only

**Risk:** Low if read-only. Do not consolidate selectors in this plan.

Use this pass only after current unrelated CSS dirty files are resolved or intentionally included in a separate visual task.

Read-only audit commands:

```powershell
git status --short
rg -n "#gachaModal|#effect-live-panel|#use-card-btn|#destroy-card-btn|#card-detail-panel" styles-*.css
```

If a CSS refactor is later desired, first add:

- viewport screenshot baselines;
- computed style comparison for hand, board, modal, and card-detail surfaces;
- bounding-box comparison for mobile and desktop.

## Final Verification Bundle

After Pass 1-3 implementation:

```powershell
npx jest --runInBand --runTestsByPath test\ui.card-interaction-network-boundary.test.ts test\ui.card-interaction-pending-network.test.ts test\game.pending-selection-flow.test.ts test\ui.network-snapshot.single-writer-baseline.test.ts
npm run check:window
npm run typecheck
```

After Pass 4 implementation:

```powershell
npx jest --runInBand --runTestsByPath test\ui.bootstrap.cpu-early-registration.test.ts test\game.pending-selection-flow.test.ts test\ui.card-interaction-pending-network.test.ts test\ui.network-snapshot.single-writer-baseline.test.ts
npm run check:window
npm run typecheck
npm run build:browser
```

After any Worker/local/network-contract change, which is not planned for Pass 1-3:

```powershell
npm run test:network:parity
```

## Stop Conditions

Stop and report before continuing if:

- any test requires changing a player-visible rule, card behavior, UI text, sound, or animation timing;
- `startNetworkOnlyPendingSelectionPublish()` payload shape would change;
- publish lock release order would change;
- `opts.onSuccess` / `opts.onFailure` callback timing would change;
- `game/` or `shared/` would need to import a browser/network-client adapter;
- `npm run check:window` finds new forbidden usage;
- a generated or mirror file appears in the diff without an explicit generation command;
- unrelated dirty files overlap a target file and cannot be separated safely.

## Rollback Approach

Each pass should be committed separately. Revert one pass at a time:

```powershell
git revert <commit-sha>
```

Rollback order is reverse execution order. If Pass 3 depends on helpers from Pass 2, revert Pass 3 before Pass 2. Pass 1 should remain independently revertible because the public facade export names stay unchanged.

## Completion Criteria

This refactor series is complete when:

- `cards/card-interaction-pending-network.ts` is a compatibility facade, not the owner of root network-client lookup, playback settlement helpers, and publish orchestration all at once.
- Root `NetworkMatchClient` lookup is isolated to one card-surface adapter.
- Playback settlement helper code is isolated from network-client lookup.
- Existing public exports from `cards/card-interaction-pending-network.ts` remain available.
- Focused card/network/pending-selection tests pass.
- `npm run check:window` passes.
- No generated or mirror file was source-edited.
- Remaining board/diff and CSS work is explicitly deferred to characterization-only follow-up plans.
