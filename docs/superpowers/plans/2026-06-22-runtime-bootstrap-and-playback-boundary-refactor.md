# Runtime Bootstrap And Playback Boundary Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop silent half-boot failures in the classic browser runtime and separate network snapshot authority from playback/busy presentation settlement, without changing card rules or player-visible game behavior.

**Architecture:** Keep the current CommonJS/classic browser boot path for now. Add a small boot contract that distinguishes required modules from optional modules, then make `entry-browser.js` fail fast for required module failures. In the network path, keep canonical snapshot application in `ui/network/snapshot.ts`, move presentation queue reconciliation to `ui/network/snapshot-presentation.ts`, and move playback/busy release policy behind the existing playback-state boundary.

**Tech Stack:** TypeScript, CommonJS compatibility runtime, Jest, existing browser build scripts, `npm run check:window`, `npm run build:browser`, `npm run typecheck`, and `npm run test:network:parity` for the network pass.

---

## Document Role

This is an implementation plan, not a gameplay spec. It intentionally allows internal behavior to change where the current behavior is an architectural hazard, but it must not change legal moves, card effects, card costs, turn order, visible card text, or final board/card state.

Source-of-truth documents:

- Gameplay and visible behavior: `01-rulebook.md`
- Architecture boundary: `docs/architecture-contracts.md`
- Root implementation: root source files under `game/`, `ui/`, `shared/`, `utils/`, `scripts/`
- Generated or mirrored output: `dist/`, `public/module-registry.js`, `worker-public/`

Non-goals:

- No full ESM migration.
- No card behavior, cost, target, timing, text, sound, or animation redesign.
- No rulebook update unless implementation discovers an actual player-visible behavior change.
- No source edits in `worker-public/`, `dist/`, or `public/module-registry.js`.
- No broad file splitting just because a file is large.
- No new second board writer, no reordered `events[]`, and no canonical state decision based on animation or sound state.

## Why This Is The Refactor To Do Now

The current project can continue shipping without a large rewrite, but two areas are expensive to leave as-is:

- Browser boot currently treats many module failures as `[boot] skip <module>`, even for modules that are required for gameplay. That makes missing generated modules and stale registry output look like a degraded but successful startup.
- `ui/network/snapshot.ts` is a canonical snapshot applier, a playback event dispatcher, a presentation queue reconciler, and a busy/playback lock recovery policy host. The project already has `ui/network/snapshot-presentation.ts` and `ui/playback-state-manager.ts`; the remaining policy needs to move behind those boundaries before adding more network/playback fixes.

These are not cosmetic refactors. They reduce false-positive browser boots and make future network/playback fixes less likely to weaken the Single Visual Writer and authority contracts.

## Current Baseline Observations

Confirm these before implementation starts:

```powershell
git status --short
npm run check:window
Select-String -Path entry-browser.js -Pattern "console.warn\(\"\\[boot\\] skip|Object.assign\(window|require\("
Select-String -Path ui\network\snapshot.ts -Pattern "shouldReleaseRestoredQueueBusyState|shouldReleaseUnclaimedPlaybackBusyState|shouldClearUndrainedPlaybackQueues|requestDeferredBoardRefreshAfterPlayback"
```

Expected baseline:

- `npm run check:window` passes.
- `entry-browser.js` has many per-module `try/catch` blocks that warn with `[boot] skip`.
- `public/runtime.js` only writes `cache[resolved] = mod.exports` after factory execution, so a circular or failed required module can surface as repeated boot failures instead of a single structured boot diagnostic.
- `ui/network/snapshot.ts` delegates some queue helpers to `ui/network/snapshot-presentation.ts`, but still owns playback drain dispatch, direct dispatch, busy release, stale playback lock release, and undrained queue cleanup decisions.
- `ui/playback-state-manager.ts` already owns playback active flags, visual playback claims, selection settlement locks, busy state, stale playback detection, and `clearPlaybackLock()`.

If `git status --short` reports unrelated dirty files in any planned target, inspect those diffs first and do not overwrite them. This plan can be executed in two independent passes, so a dirty file in the network pass does not block the boot pass.

## File Map

Boot pass:

- Modify `entry-browser.js`: replace required module silent skips with a fail-fast boot loader helper while preserving optional module skips.
- Modify `test/entry-browser.bootstrap-contract.test.ts`: extend the existing static bootstrap contract into required/optional failure checks.
- Modify `scripts/build-module-registry.ts`: expose boot module classification metadata from the existing generated registry source.
- Create `test/scripts.build-module-registry.boot-contract.test.ts`: lock down required/optional boot classification and generated registry metadata.
- Generated by command only, if implementation requires it: `public/module-registry.js`.
- Mirror by command only, if deploy assets need syncing after generated output changed: `worker-public/public/module-registry.js`, `worker-public/entry-browser.js`, and related worker assets from `npm run worker:prepare`.

Network/playback pass:

- Modify `ui/network/snapshot.ts`: keep snapshot application and orchestration, remove local policy for queue/busy release decisions.
- Modify `ui/network/snapshot-presentation.ts`: keep transient queue capture, restore, clear, signature, and reconciliation decisions.
- Modify `ui/playback-state-manager.ts`: own stale playback, unclaimed playback, and playback lock release decisions through explicit exported helpers.
- Modify `test/ui.network-snapshot.pending-presentation-reconcile.test.ts`: preserve current behavior while verifying the decisions are delegated.
- Modify `test/ui.playback-state-manager.test.ts`: cover the new playback settlement helper behavior.
- Modify `test/ui.network-snapshot.single-writer-baseline.test.ts`: keep existing Single Visual Writer expectations stable.
- Modify `docs/architecture-contracts.md`: document the refined snapshot/playback responsibility split after implementation passes.

Do not stage generated or mirror files unless the exact command in this plan created them during the current task and their diffs were inspected.

---

## Pass 1: Browser Boot Fail-Fast Contract

### Task 1: Characterize The Current Boot Loader Surface

**Risk:** Low. Read-only and test-first.

- [ ] Run the baseline commands:

```powershell
git status --short
Select-String -Path entry-browser.js -Pattern "console.warn\(\"\\[boot\\] skip|Object.assign\(window|require\(" | Measure-Object
Select-String -Path public\runtime.js -Pattern "cache\[resolved\]|new Function|__cjsRegister|__cjsAlias"
```

Expected:

- `entry-browser.js` still contains many `[boot] skip` catches and many `Object.assign(window, moduleExports)` style assignments.
- `public/runtime.js` still contains `window.__cjsRegister`, `window.__cjsAlias`, and `cache[resolved] = mod.exports`.

- [ ] Inspect whether `entry-browser.js` has a generator in the current checkout:

```powershell
rg -n "Loads modules in original index.html order|entry-browser|sync-browser-script-versions" scripts docs entry-browser.js
```

Expected:

- `entry-browser.js` is treated as a root runtime exception in the TypeScript migration allowlist.
- `scripts/sync-browser-script-versions.ts` may copy or version browser scripts, but `public/module-registry.js` remains generated by `scripts/build-module-registry.ts`.

Implementation rule for the rest of this pass:

- Edit `scripts/build-module-registry.ts` for generated registry behavior.
- Edit `entry-browser.js` only as the root runtime boot source.
- Do not edit `public/module-registry.js` by hand.

### Task 2: Add Boot Classification Tests

**Risk:** Low. These tests should fail before implementation if the required/optional contract does not exist.

- [ ] Create `test/scripts.build-module-registry.boot-contract.test.ts`.

Required assertions:

```ts
describe('browser module registry boot contract', () => {
  test('classifies core gameplay and bootstrap modules as required', () => {
    const registry = require('../scripts/build-module-registry');
    expect(registry.classifyBrowserBootModule('dist/shared-constants')).toBe('required');
    expect(registry.classifyBrowserBootModule('dist/cards/catalog')).toBe('required');
    expect(registry.classifyBrowserBootModule('dist/game/logic/core')).toBe('required');
    expect(registry.classifyBrowserBootModule('dist/game/logic/cards')).toBe('required');
    expect(registry.classifyBrowserBootModule('dist/game/turn/turn_pipeline')).toBe('required');
    expect(registry.classifyBrowserBootModule('dist/ui/bootstrap')).toBe('required');
    expect(registry.classifyBrowserBootModule('dist/ui/network-client')).toBe('required');
  });

  test('classifies diagnostics, cosmetics, and heavyweight optional runtime modules as optional', () => {
    const registry = require('../scripts/build-module-registry');
    expect(registry.classifyBrowserBootModule('dist/ui/debug-panel')).toBe('optional');
    expect(registry.classifyBrowserBootModule('dist/ui/background-skin-controller')).toBe('optional');
    expect(registry.classifyBrowserBootModule('dist/ui/font-skin-controller')).toBe('optional');
    expect(registry.classifyBrowserBootModule('node_modules/onnxruntime-web/dist/ort.min')).toBe('optional');
  });
});
```

If a listed path is not present in the current registry, replace it with the current equivalent module that already appears in `entry-browser.js`; do not weaken the test to only check array shape.

- [ ] Extend `test/entry-browser.bootstrap-contract.test.ts`.

Add static assertions that require:

- A named helper such as `requireBootModule` or `loadBootModule`.
- A required-mode branch that throws or records a fatal boot error.
- An optional-mode branch that keeps warning with `[boot] skip`.
- No silent empty catch in the boot section.

Add executable `vm`-based assertions only if they can run without loading the real full browser bundle. The minimum executable contract is:

```ts
test('required boot module failure becomes fatal while optional failure is skipped', () => {
  const requiredFailure = new Error('missing required');
  const optionalFailure = new Error('missing optional');
  const calls: string[] = [];
  const fakeWindow: any = {
    console: { warn: jest.fn(), error: jest.fn() },
    __CARD_REVERSI_BOOT_MODULES__: {
      required: ['./dist/shared-constants'],
      optional: ['./dist/ui/debug-panel']
    }
  };
  const fakeRequire = jest.fn((key: string) => {
    calls.push(key);
    if (key === './dist/shared-constants') throw requiredFailure;
    if (key === './dist/ui/debug-panel') throw optionalFailure;
    return {};
  });

  expect(() => runEntryBootstrapWith(fakeWindow, fakeRequire)).toThrow(/shared-constants|missing required/);
  expect(fakeWindow.console.warn).not.toHaveBeenCalledWith(expect.stringContaining('shared-constants'));
});
```

Use an existing helper if one already exists in the test suite. If no reusable helper exists, keep the executable test scoped to the new helper exported through a small test-only extraction rather than evaluating all of `entry-browser.js`.

- [ ] Run the focused tests and confirm the expected failure:

```powershell
npx jest --runInBand test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts
```

Expected before implementation:

- The new registry classification test fails because `classifyBrowserBootModule` is not exported.
- The extended entry-browser contract fails because required module fail-fast handling is not present.

### Task 3: Implement Generated Boot Classification Metadata

**Risk:** Medium. This touches browser boot generation, but not game rules.

- [ ] Modify `scripts/build-module-registry.ts`.

Add:

- `type BrowserBootModuleClass = 'required' | 'optional'`
- `const REQUIRED_BOOT_MODULE_KEYS = new Set<string>(['dist/shared-constants', 'dist/cards/catalog', 'dist/game/logic/core', 'dist/game/logic/cards', 'dist/game/turn/turn_pipeline', 'dist/ui/bootstrap', 'dist/ui/network-client', 'dist/ui/board-renderer', 'dist/ui/presentation-handler'])`
- `const OPTIONAL_BOOT_MODULE_PREFIXES = ['dist/ui/debug', 'dist/ui/background-skin', 'dist/ui/font-skin', 'dist/training', 'node_modules/onnxruntime-web']`
- `function normalizeBootModuleKey(key: string): string`
- `function classifyBrowserBootModule(key: string): BrowserBootModuleClass`
- Include `classifyBrowserBootModule` in the CommonJS export object.

Required modules must include the current equivalents of:

- `dist/shared-constants`
- `dist/cards/catalog`
- `dist/game/logic/core`
- `dist/game/logic/cards`
- `dist/game/turn/turn_pipeline`
- `dist/ui/bootstrap`
- `dist/ui/network-client`
- `dist/ui/board-renderer`
- `dist/ui/presentation-handler`

Optional modules must include current equivalents of:

- debug-only modules
- visual skin/font/background controllers
- training or CPU heavyweight browser helpers that are not needed to render a legal local game
- `node_modules/onnxruntime-web/dist/ort.min`

Do not classify every module as required. The purpose is to fail fast for core gameplay/boot dependencies while preserving optional degradation for diagnostics and heavyweight helpers.

- [ ] Update the generated registry header inside `buildRegistry()` to emit metadata after `_r` and `_a` checks:

```js
window.__CARD_REVERSI_BOOT_MODULES__ = {
  required: [/* generated sorted normalized keys */],
  optional: [/* generated sorted normalized keys */]
};
```

The generated arrays must be sorted for stable diffs.

- [ ] Run:

```powershell
npx jest --runInBand test/scripts.build-module-registry.boot-contract.test.ts
npm run build:browser
```

Expected:

- Jest passes.
- `npm run build:browser` succeeds.
- `public/module-registry.js` changes only through the build command and contains `window.__CARD_REVERSI_BOOT_MODULES__`.

- [ ] Inspect generated diff:

```powershell
git diff -- scripts/build-module-registry.ts public/module-registry.js
Select-String -Path public\module-registry.js -Pattern "__CARD_REVERSI_BOOT_MODULES__|dist/ui/bootstrap|dist/game/logic/core"
```

Expected:

- Source diff is in `scripts/build-module-registry.ts`.
- Generated diff is in `public/module-registry.js`.
- No hand-edited generated formatting outside the generated registry output.

### Task 4: Implement Required Module Fail-Fast In `entry-browser.js`

**Risk:** Medium. A boot regression is visible immediately, but the desired behavior is stricter failure for broken required modules.

- [ ] Modify `entry-browser.js`.

Add a helper near the top of the file:

```js
function getBootModuleClass(moduleKey) {
  var meta = window.__CARD_REVERSI_BOOT_MODULES__ || {};
  var normalized = String(moduleKey || '').replace(/^\.\//, '').replace(/\.js$/, '');
  var required = Array.isArray(meta.required) ? meta.required : [];
  var optional = Array.isArray(meta.optional) ? meta.optional : [];
  if (required.indexOf(normalized) >= 0) return 'required';
  if (optional.indexOf(normalized) >= 0) return 'optional';
  return 'required';
}

function requireBootModule(moduleKey, options) {
  var opts = options || {};
  var bootClass = opts.bootClass || getBootModuleClass(moduleKey);
  try {
    return require(moduleKey);
  } catch (e) {
    if (bootClass === 'optional') {
      console.warn('[boot] skip ' + moduleKey.replace(/^\.\//, '') + ': ' + (e && e.message ? e.message : e));
      return null;
    }
    var err = new Error('[boot] required module failed: ' + moduleKey + ': ' + (e && e.message ? e.message : e));
    err.cause = e;
    throw err;
  }
}
```

If the current test environment cannot support `Error.cause`, store the original error as `err.originalError = e` instead.

- [ ] Replace per-module required boot loads with `requireBootModule`.

Required pattern:

```js
var _mod = requireBootModule("./dist/shared-constants");
if (_mod) Object.assign(window, _mod);
```

Optional pattern:

```js
var _modOptional = requireBootModule("./dist/ui/debug-panel", { bootClass: "optional" });
if (_modOptional) Object.assign(window, _modOptional);
```

- [ ] Keep the existing namespace diagnostic loader contract from `test/entry-browser.bootstrap-contract.test.ts`.

Do not reintroduce empty catches in the namespace section.

- [ ] Run:

```powershell
npx jest --runInBand test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts
npm run build:browser
npm run check:window
```

Expected:

- Focused boot tests pass.
- Browser build succeeds.
- Static boundary check still passes.

### Task 5: Boot Pass Browser Smoke

**Risk:** Medium. This validates that stricter boot does not break a healthy current build.

- [ ] Start the existing local static server or fallback server used by the repo. Prefer the existing script if present in `package.json`; otherwise use the existing local server script:

```powershell
npx ts-node scripts/serve-with-fallback.ts --port 4173
```

Expected:

- Local server starts and serves `index.html`, `entry-browser.js`, `public/runtime.js`, and `public/module-registry.js`.
- If the command is not supported in the current checkout, use the package script that already serves those same files and record the exact command in the implementation final report.

- [ ] Open the local page with the existing browser smoke or Playwright harness if available.

Minimum assertions:

- No `[boot] skip dist/shared-constants` warning.
- No `[boot] skip dist/game/logic/core` warning.
- No `[boot] skip dist/ui/bootstrap` warning.
- The main board UI renders.
- Optional module warnings, if any, do not prevent board render.

- [ ] If generated browser assets changed and deploy mirror parity is required, run:

```powershell
npm run worker:prepare
```

Expected:

- Worker prepare succeeds.
- Mirror diffs are limited to assets produced by the command.

### Task 6: Commit Boot Pass

- [ ] Inspect:

```powershell
git status --short
git diff -- entry-browser.js scripts/build-module-registry.ts test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts public/module-registry.js worker-public
git diff --check -- entry-browser.js scripts/build-module-registry.ts test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts public/module-registry.js worker-public
```

Expected:

- Only boot-pass files and command-generated outputs changed.
- No unrelated dirty file is staged.

- [ ] Stage only intentional boot-pass files:

```powershell
git add -- entry-browser.js scripts/build-module-registry.ts test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts public/module-registry.js
```

If `npm run worker:prepare` was run and mirror diffs are confirmed generated for this pass, also stage the exact changed mirror files:

```powershell
git add -- worker-public/entry-browser.js worker-public/public/module-registry.js
```

- [ ] Commit:

```powershell
git commit -m "Harden browser boot module failures"
```

---

## Pass 2: Network Snapshot And Playback Boundary Split

### Task 7: Characterize Existing Snapshot/Playback Settlement Behavior

**Risk:** Low. Test-first.

- [ ] Run the focused baseline:

```powershell
npx jest --runInBand test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-state-manager.test.ts
```

Expected:

- Existing tests pass before refactor.

- [ ] Add behavior-preserving tests before moving code.

Extend `test/ui.playback-state-manager.test.ts` with tests for new helper behavior:

```ts
test('snapshot settlement keeps claimed playback busy while a playback engine is running', () => {
  const manager = require('../ui/playback-state-manager.js');
  manager.beginPlayback({ startedAt: 1000 });
  global.window.AnimationEngine = { isPlaying: true };

  expect(manager.resolveSnapshotPlaybackSettlement({
    playbackEvents: [{ type: 'flip' }],
    cardState: { presentationEvents: [], _presentationEventsPersist: [] },
    releaseUnclaimedPlayback: true,
    clearUndrainedPlayback: true,
    boardUpdateRequested: true
  })).toMatchObject({
    clearPlaybackLock: false,
    clearTransientPresentationQueues: false,
    keepBusy: true
  });
});
```

Add equivalent tests for:

- no playback events and no pending queues releases stale playback lock when engine is idle;
- playback events queued but not claimed clear undrained playback queues only when board update was requested;
- restored preserved queues release busy only when the restored queue signature still matches and no playback is active.

Extend `test/ui.network-snapshot.pending-presentation-reconcile.test.ts` with a spy proving `applySnapshot()` calls the new playback settlement helper once per applied non-stale snapshot.

- [ ] Run the focused tests and confirm the expected failure:

```powershell
npx jest --runInBand test/ui.playback-state-manager.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts
```

Expected before implementation:

- New tests fail because `resolveSnapshotPlaybackSettlement` is not exported or not used yet.

### Task 8: Add Playback Settlement Helper To `ui/playback-state-manager.ts`

**Risk:** Medium. Busy state regressions are visible in local and network playback.

- [ ] Modify `ui/playback-state-manager.ts`.

Add:

```ts
type SnapshotPlaybackSettlementInput = {
  playbackEvents?: any[];
  presentationState?: any;
  busyStateBeforeSnapshot?: any;
  cardState?: any;
  releaseUnclaimedPlayback?: boolean;
  clearUndrainedPlayback?: boolean;
  boardUpdateRequested?: boolean;
  stalePlaybackTimeoutMs?: number;
};

function resolveSnapshotPlaybackSettlement(input?: SnapshotPlaybackSettlementInput): {
  clearPlaybackLock: boolean;
  clearTransientPresentationQueues: boolean;
  setBusyFalse: boolean;
  keepBusy: boolean;
  reason: string | null;
} {
  const opts = input || {};
  const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
  const hasPlaybackEvents = playbackEvents.length > 0;
  const presentationState = opts.presentationState || {};
  const queueState = getPresentationQueueState(opts.cardState);
  const playbackRunning = isPlaybackRunning({ staleMs: opts.stalePlaybackTimeoutMs });
  const restoredQueues = presentationState.restoredPreservedQueues === true;
  const shouldKeepBusy = presentationState.shouldKeepBusy === true || hasPlaybackEvents;
  return decideSnapshotPlaybackSettlement({
    hasPlaybackEvents,
    restoredQueues,
    restoredQueueSignature: presentationState.restoredQueueSignature || null,
    queueState,
    playbackRunning,
    playbackActive: getPlaybackActive(),
    releaseUnclaimedPlayback: opts.releaseUnclaimedPlayback === true,
    clearUndrainedPlayback: opts.clearUndrainedPlayback === true,
    boardUpdateRequested: opts.boardUpdateRequested === true,
    shouldKeepBusy,
    busyStateBeforeSnapshot: opts.busyStateBeforeSnapshot || null
  });
}
```

Also add one private pure helper in the same file:

```ts
function decideSnapshotPlaybackSettlement(input: {
  hasPlaybackEvents: boolean;
  restoredQueues: boolean;
  restoredQueueSignature: string | null;
  queueState: any;
  playbackRunning: boolean;
  playbackActive: boolean;
  releaseUnclaimedPlayback: boolean;
  clearUndrainedPlayback: boolean;
  boardUpdateRequested: boolean;
  shouldKeepBusy: boolean;
  busyStateBeforeSnapshot: any;
}): {
  clearPlaybackLock: boolean;
  clearTransientPresentationQueues: boolean;
  setBusyFalse: boolean;
  keepBusy: boolean;
  reason: string | null;
}
```

Move the decision logic currently represented by these `ui/network/snapshot.ts` wrappers into this helper:

- `shouldReleaseRestoredQueueBusyState`
- `shouldReleaseStalePlaybackLockAfterSnapshot`
- `shouldReleaseUnclaimedPlaybackBusyState`
- `shouldClearUndrainedPlaybackQueues`

Use existing local helpers in `ui/playback-state-manager.ts` for:

- `getPlaybackActive()`
- `isPlaybackRunning()`
- `isPlaybackStale()`
- `getPlaybackStartedAt()`
- `getPlaybackStaleMs()`
- `hasPendingPresentationEvents()`
- `getPresentationQueueEntries()`

Do not make this helper mutate state. It must only return a decision object. Actual calls to `clearPlaybackLock()`, `setBusyState()`, and transient queue clearing stay in the caller.

- [ ] Export `resolveSnapshotPlaybackSettlement` in both `getRuntimePlaybackState()` and `PlaybackStateManager`.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.playback-state-manager.test.ts
```

Expected:

- Playback-state-manager tests pass.

### Task 9: Narrow `ui/network/snapshot-presentation.ts` To Queue Reconciliation

**Risk:** Low to medium. This should be mostly mechanical once Task 8 exists.

- [ ] Modify `ui/network/snapshot-presentation.ts`.

Keep these exports:

- `clearTransientPresentationQueues`
- `captureTransientPresentationQueues`
- `restoreTransientPresentationQueues`
- `getTransientPresentationQueueSignature`
- `hasPendingPresentationEvents`
- `reconcilePresentationQueues`

Remove these exports after callers are updated:

- `shouldReleaseRestoredQueueBusyState`
- `shouldReleaseStalePlaybackLockAfterSnapshot`
- `shouldReleaseUnclaimedPlaybackBusyState`
- `shouldClearUndrainedPlaybackQueues`

The file should only reason about queue content and queue restoration, not playback engine state, playback started time, or busy flags.

- [ ] Add or adjust tests in `test/ui.network-snapshot.pending-presentation-reconcile.test.ts` so queue behavior remains unchanged:

- preserved queues restore when no new playback is supplied;
- preserved queues are dropped when board geometry changes;
- shadow playback clears transient queues;
- queue signature is stable enough for restored-queue comparison passed into the playback settlement helper.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-snapshot.pending-presentation-reconcile.test.ts
```

Expected:

- Queue reconciliation behavior remains unchanged.

### Task 10: Delegate Snapshot Playback Settlement From `ui/network/snapshot.ts`

**Risk:** Medium to high. This is the core refactor and affects network snapshot playback.

- [ ] Modify `ui/network/snapshot.ts`.

Replace local wrapper functions:

- `shouldReleaseRestoredQueueBusyState`
- `shouldReleaseStalePlaybackLockAfterSnapshot`
- `shouldReleaseUnclaimedPlaybackBusyState`
- `shouldClearUndrainedPlaybackQueues`

with one helper:

```ts
function resolveSnapshotPlaybackSettlement(cardStateRef: any, details: any, refreshState: any, opts: any): any {
  const playbackState = resolvePlaybackStateModule();
  if (playbackState && typeof playbackState.resolveSnapshotPlaybackSettlement === 'function') {
    return playbackState.resolveSnapshotPlaybackSettlement({
      cardState: cardStateRef,
      playbackEvents: details.playbackEvents,
      presentationState: details.presentationState,
      busyStateBeforeSnapshot: details.busyStateBeforeSnapshot,
      releaseUnclaimedPlayback: opts.releaseUnclaimedPlayback === true,
      clearUndrainedPlayback: opts.clearUndrainedPlayback === true,
      boardUpdateRequested: refreshState && refreshState.boardUpdateRequested === true
    });
  }
  return { clearPlaybackLock: false, clearTransientPresentationQueues: false, setBusyFalse: false, keepBusy: false, reason: null };
}
```

Then replace the current release block in `finalizeSnapshotPresentation()` with:

```ts
const settlement = resolveSnapshotPlaybackSettlement(cardStateRef, details, refreshState, opts);
if (settlement.clearTransientPresentationQueues === true) {
  clearTransientPresentationQueues(cardStateRef);
}
if (settlement.clearPlaybackLock === true) {
  clearBusyStateAndPlaybackLock();
} else if (settlement.setBusyFalse === true) {
  setBusyState(false);
}
```

Keep `requestNetworkPlaybackDirectDispatch()`, `requestNetworkPlaybackDrain()`, and `requestDeferredBoardRefreshAfterPlayback()` in `snapshot.ts` for this pass. They are orchestration around snapshot application and can be moved later only after this boundary is stable.

- [ ] Preserve event order:

- `setBusyState(presentationState.shouldKeepBusy === true)` still happens before emitting playback events.
- `armPlaybackLockForIncomingPlayback()` still happens before network playback events are emitted.
- `emitBoardUpdate()` is still deferred when strict network playback starts.
- `renderCardUI()` remains delayed when playback or shadow playback is pending.

- [ ] Run:

```powershell
npx jest --runInBand test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-state-manager.test.ts
```

Expected:

- All focused snapshot/playback tests pass.
- Existing busy call sequences in tests stay the same unless the test only asserted internal helper placement.

### Task 11: Update Architecture Contract

**Risk:** Low. Documentation only, after code proves the split.

- [ ] Modify `docs/architecture-contracts.md`.

Add or update the network presentation section with this contract:

- `ui/network/snapshot.ts` applies canonical server snapshots and orchestrates presentation effects produced by that snapshot.
- `ui/network/snapshot-presentation.ts` owns transient presentation queue capture, restore, clear, signatures, and queue reconciliation.
- `ui/playback-state-manager.ts` owns playback active state, visual playback claims, selection settlement locks, stale playback detection, and snapshot playback settlement decisions.
- Canonical snapshot version/state must not be decided from playback, animation, sound, or queue state.
- Playback settlement may clear presentation queues and busy locks, but it must not rewrite canonical game/card authority fields.

- [ ] Run docs/source checks:

```powershell
git diff -- docs/architecture-contracts.md
git diff --check -- docs/architecture-contracts.md
rg -n "snapshot-presentation|playback-state-manager|snapshot.ts" docs/architecture-contracts.md
```

Expected:

- The doc names the new responsibility split.
- No player-visible rule text changes are made.

### Task 12: Network Pass Verification

**Risk:** Medium. This is the pass that must prove runtime parity.

- [ ] Run focused tests:

```powershell
npx jest --runInBand test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.network-client.visual-catchup.test.ts test/ui.network-playback-recovery.test.ts test/ui.network-presentation-timeline.test.ts test/ui.network-visual-state-store.test.ts test/ui.playback-state-manager.test.ts
```

Expected:

- All tests pass.

- [ ] Run boundary/build checks:

```powershell
npm run check:window
npm run typecheck
npm run build:browser
npm run test:network:parity
```

Expected:

- `check:window` passes.
- Typecheck passes.
- Browser build succeeds.
- Network parity suite passes.
- `public/module-registry.js` may update only through `npm run build:browser`.

- [ ] If the browser build changed generated public assets and deploy mirror parity is required, run:

```powershell
npm run worker:prepare
```

Expected:

- Worker prepare succeeds.
- Mirror diffs are generated outputs only.

### Task 13: Commit Network Pass

- [ ] Inspect:

```powershell
git status --short
git diff -- ui/network/snapshot.ts ui/network/snapshot-presentation.ts ui/playback-state-manager.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-state-manager.test.ts docs/architecture-contracts.md public/module-registry.js worker-public
git diff --check -- ui/network/snapshot.ts ui/network/snapshot-presentation.ts ui/playback-state-manager.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-state-manager.test.ts docs/architecture-contracts.md public/module-registry.js worker-public
```

Expected:

- Only network/pass files and command-generated outputs changed.
- No rulebook or `正本/*.md` changes unless a real visible behavior change was discovered and explicitly handled.

- [ ] Stage only intentional network-pass files:

```powershell
git add -- ui/network/snapshot.ts ui/network/snapshot-presentation.ts ui/playback-state-manager.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-state-manager.test.ts docs/architecture-contracts.md public/module-registry.js
```

If `npm run worker:prepare` was run and mirror diffs are confirmed generated for this pass, stage exact generated mirror files:

```powershell
git add -- worker-public
```

- [ ] Commit:

```powershell
git commit -m "Split network snapshot playback settlement"
```

---

## Final Verification For Both Passes

Run after both commits exist:

```powershell
npm run check:window
npm run typecheck
npm run build:browser
npm run test:network:parity
npx jest --runInBand test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-state-manager.test.ts
git status --short
```

Expected:

- All commands pass.
- `git status --short` is clean, or only contains unrelated pre-existing user work that was not staged.
- Browser boot no longer silently skips required gameplay/bootstrap modules.
- Optional boot modules can still warn and continue.
- Network snapshot canonical application remains separate from presentation queue reconciliation and playback settlement decisions.

## Stop Conditions

Stop and report exact files and failing command output if any of these occur:

- A required boot classification would make a known healthy build fail because a module is loaded only after runtime user interaction.
- A focused snapshot test requires changing canonical snapshot state based on animation, sound, playback lock, or busy state.
- `npm run check:window` reports new forbidden access in `game/` or `shared/`.
- `npm run test:network:parity` fails after the network pass for a reason not explained by the intentional refactor.
- `public/module-registry.js`, `dist/`, or `worker-public/` have pre-existing unrelated diffs that cannot be separated from generated output for this task.

## Completion Report Template

Use this shape in the final implementation report:

```text
実施内容:
- Browser boot: required module failures now fail fast; optional modules still warn and continue.
- Network snapshot/playback: canonical snapshot apply remains in snapshot.ts; queue reconciliation remains in snapshot-presentation.ts; playback settlement decisions are owned by playback-state-manager.ts.

検証:
- npm run check:window
- npm run typecheck
- npm run build:browser
- npm run test:network:parity
- npx jest --runInBand test/entry-browser.bootstrap-contract.test.ts test/scripts.build-module-registry.boot-contract.test.ts test/ui.network-snapshot.pending-presentation-reconcile.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.playback-state-manager.test.ts

生成物:
- public/module-registry.js: build command output
- worker-public/*: worker:prepare output, if run

残リスク:
- Full ESM migration is intentionally not included.
- Further orchestration extraction from snapshot.ts can be considered after this pass, but is not required to unblock current architecture debt.
```
