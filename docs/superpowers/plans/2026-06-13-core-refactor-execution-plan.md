# Core Refactor Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `ui/bootstrap.ts`, `ui/diff-renderer.ts`, and `game/cpu-decision.ts` を、挙動を変えずに責務単位へ分割し、今後のCPU強化・表示同期・bootstrap変更を安全にする。

**Architecture:** Public entry points and import paths stay stable: callers continue to import `ui/bootstrap`, `ui/diff-renderer`, and `game/cpu-decision`. New files are internal modules consumed by those compatibility shells. Each pass adds characterization coverage first, extracts one responsibility, verifies focused tests, then commits before moving to the next pass.

**Tech Stack:** TypeScript/CommonJS compatibility wrappers, Jest/ts-jest, existing `npm run build:ts`, `npm run check:window`, `node scripts/check-refactor-safety.js`, and focused Jest suites.

---

## Scope And Invariants

This is a behavior-preserving refactor. Do not change player-visible rules, card behavior, network authority, snapshot formats, public exports, URL routes, generated mirrors, model formats, or dependency versions.

Preserve these contracts throughout:

- `01-rulebook.md` remains the gameplay source of truth.
- `docs/architecture-contracts.md` module boundaries remain valid.
- `worker-public/`, `dist/`, and generated registries are not edited as source.
- `game/` and `shared/` stay headless.
- `ui/diff-renderer.ts` remains compatible with the Single Visual Writer contract.
- `game/cpu-decision.ts` continues exporting the same `module.exports` keys unless a separate API migration is explicitly approved.
- Bootstrap order stays DOM -> events -> game -> network.

Current unrelated dirty files must be kept out of refactor commits. At the start of every task, run:

```powershell
git status --short
```

If unrelated dirty files overlap the task files, pause and inspect the exact diff before editing. Stage only files listed in that task.

## File Structure Target

### Bootstrap

Keep:

- `ui/bootstrap.ts` as the compatibility shell and public `UIBootstrap` export.

Create or modify internal modules:

- `ui/bootstrap/runtime-resolvers.ts`: shared runtime lookup helpers now duplicated in CPU/pass/network wiring.
- `ui/bootstrap/cpu-runtime-wiring.ts`: CPU turn handler and CPU decision DI wiring.
- `ui/bootstrap/pass-runtime-wiring.ts`: pass-handler DI wiring.
- `ui/bootstrap/asset-manifest-runtime.ts`: asset manifest load/apply/status helpers.

### Diff Renderer

Keep:

- `ui/diff-renderer.ts` as the public renderer facade and compatibility global exporter.

Create internal modules:

- `ui/diff-renderer/viewer-context.ts`: local player, network seat, match mode, and debug-HvH viewer context resolution.
- `ui/diff-renderer/stone-info-panel.ts`: stone info panel DOM creation, positioning, and dismissal.
- `ui/diff-renderer/special-marker-renderer.ts`: special marker and board overlay DOM creation helpers.
- `ui/diff-renderer/telemetry.ts`: debug-only renderer telemetry helpers.

### CPU Decision

Keep:

- `game/cpu-decision.ts` as the compatibility shell and public `module.exports` surface.

Create internal modules:

- `game/cpu-decision-runtime.ts`: runtime module lookup, debug flags, match mode, query search, global fallback boundary.
- `game/cpu-decision-onnx-move.ts`: `selectMoveFromOnnxPolicyAsync` and related ONNX move gating/refinement.
- `game/cpu-decision-placement-priority.ts`: Lv6 placement candidate filtering and plan score helpers.
- `game/cpu-decision-public-api.ts`: checked export assembly for `cpu-decision.ts`.

Do not rename existing public exports. New modules are private implementation details.

## Execution Rules

- One task equals one commit.
- Write or extend tests before moving production code.
- Prefer moving code verbatim first, then cleaning names in a separate pass.
- Do not combine bootstrap, diff-renderer, and CPU changes in the same commit.
- After each task, run `git diff --check`, the task's focused tests, and `npm run build:ts`.
- Run `npm run check:window` after any task touching `game/`, `shared/`, or UI-to-game wiring.
- Run `node scripts/check-refactor-safety.js` after any task touching CPU, worker, authority, or public runtime boundary code.
- Run `npm run worker:prepare` only when a root source change must be mirrored for worker assets; inspect generated output before staging.

## Task 0: Baseline And Guardrails

**Files:**

- Read: `docs/architecture-contracts.md`
- Read: `ui/bootstrap/AGENTS.md`
- Read: `package.json`
- No production edits

- [ ] **Step 1: Confirm dirty tree and classify unrelated files**

Run:

```powershell
git status --short
```

Expected: Any existing unrelated dirty files are listed and left untouched.

- [ ] **Step 2: Run baseline boundary checks**

Run:

```powershell
npm run check:window
node scripts/check-refactor-safety.js
npm run build:ts
```

Expected: all exit `0`. If a command fails before refactoring, record the failure and do not start extraction until the baseline is understood.

- [ ] **Step 3: Record baseline line counts**

Run:

```powershell
$targets=@('ui/bootstrap.ts','ui/diff-renderer.ts','game/cpu-decision.ts')
foreach($f in $targets){ $lines=(Get-Content $f | Measure-Object -Line).Lines; "$f $lines" }
```

Expected: a simple before snapshot for later comparison.

## Task 1: Bootstrap Runtime Resolver Characterization

**Files:**

- Modify: `test/ui.bootstrap.cpu-early-registration.test.ts`
- Modify: `test/ui.bootstrap-shared.test.ts` if existing assertions already cover registered globals
- No production edits

- [ ] **Step 1: Add characterization for runtime resolver precedence**

Add tests that assert the current behavior:

- registered UI globals win over `globalThis` functions for `resolveRuntimeFunction`
- unknown names return `null`
- runtime values only read own properties from `globalThis`
- `readMatchMode` prefers `getCurrentMatchMode()` over `MATCH_MODE`

Use existing bootstrap test style. The assertions should call bootstrap-installed CPU/pass runtimes through the existing test doubles, not through new production helpers.

- [ ] **Step 2: Run tests and confirm current behavior**

Run:

```powershell
npx jest --runInBand test/ui.bootstrap.cpu-early-registration.test.ts test/ui.bootstrap-shared.test.ts
```

Expected: pass before production changes. These are characterization tests, so they should describe existing behavior.

- [ ] **Step 3: Commit characterization only**

Run:

```powershell
git status --short
git add test/ui.bootstrap.cpu-early-registration.test.ts test/ui.bootstrap-shared.test.ts
git commit -m "Characterize bootstrap runtime resolvers"
```

Only stage files that actually changed.

## Task 2: Extract Bootstrap Runtime Resolvers

**Files:**

- Create: `ui/bootstrap/runtime-resolvers.ts`
- Modify: `ui/bootstrap.ts`
- Test: `test/ui.bootstrap.cpu-early-registration.test.ts`
- Test: `test/ui.bootstrap-shared.test.ts`

- [ ] **Step 1: Create helper module**

Create `ui/bootstrap/runtime-resolvers.ts` with this public internal API:

```typescript
export type RegisteredGlobalsReader = () => Record<string, any> | null;

export type RuntimeResolverDeps = {
  getRegisteredUIGlobals: RegisteredGlobalsReader;
  readDebugQueryString?: () => string;
  isDebugSessionEnabled?: () => boolean;
  debugLog?: (...args: any[]) => any;
};

export function createRuntimeResolvers(deps: RuntimeResolverDeps) {
  const safeDeps = deps || {} as RuntimeResolverDeps;
  function resolveRuntimeFunction(name: string): Function | null {
    try {
      if (typeof name !== 'string') return null;
      const registered = typeof safeDeps.getRegisteredUIGlobals === 'function'
        ? safeDeps.getRegisteredUIGlobals()
        : null;
      const registeredCandidate = registered && (registered as any)[name];
      if (typeof registeredCandidate === 'function') return registeredCandidate;
      if (typeof globalThis === 'undefined') return null;
      const candidate = (globalThis as any)[name];
      return typeof candidate === 'function' ? candidate : null;
    } catch (e) {
      return null;
    }
  }

  function resolveRuntimeValue(name: string): any {
    try {
      if (typeof name !== 'string' || typeof globalThis === 'undefined') return undefined;
      return Object.prototype.hasOwnProperty.call(globalThis, name)
        ? (globalThis as any)[name]
        : undefined;
    } catch (e) {
      return undefined;
    }
  }

  function readMatchMode(): any {
    try {
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
        return (globalThis as any).getCurrentMatchMode();
      }
      if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
    } catch (e) { /* ignore */ }
    return null;
  }

  function readHumanVsHumanMode(): boolean {
    try {
      return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
    } catch (e) { /* ignore */ }
    return false;
  }

  return {
    resolveRuntimeFunction,
    resolveRuntimeValue,
    readMatchMode,
    readHumanVsHumanMode,
    readQuerySearch: () => (
      typeof safeDeps.readDebugQueryString === 'function' ? safeDeps.readDebugQueryString() : ''
    ),
    isDebugLogAvailable: () => (
      typeof safeDeps.isDebugSessionEnabled === 'function' && safeDeps.isDebugSessionEnabled() === true
    ),
    debugLog: typeof safeDeps.debugLog === 'function' ? safeDeps.debugLog : function noopDebugLog() { return false; }
  };
}

module.exports = {
  createRuntimeResolvers
};
```

- [ ] **Step 2: Replace duplicated inline functions in `ui/bootstrap.ts`**

Import with the existing CommonJS-friendly pattern:

```typescript
let BootstrapRuntimeResolvers: any = null;
try { BootstrapRuntimeResolvers = require('./bootstrap/runtime-resolvers'); } catch (e: any) { /* ignore */ }
```

Inside `installNetworkDI`, build one resolver object:

```typescript
const runtimeResolvers = BootstrapRuntimeResolvers && typeof BootstrapRuntimeResolvers.createRuntimeResolvers === 'function'
  ? BootstrapRuntimeResolvers.createRuntimeResolvers({
      getRegisteredUIGlobals,
      readDebugQueryString,
      isDebugSessionEnabled,
      debugLog
    })
  : null;
```

Replace duplicated `readMatchMode`, `readHumanVsHumanMode`, `resolveRuntimeFunction`, and `resolveRuntimeValue` blocks with calls to `runtimeResolvers` only when the helper exists. Preserve the previous inline fallback in the same commit only if needed to keep browser script boot resilient.

- [ ] **Step 3: Run focused bootstrap tests**

Run:

```powershell
npx jest --runInBand test/ui.bootstrap.cpu-early-registration.test.ts test/ui.bootstrap-shared.test.ts
npm run build:ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git diff --check
git status --short
git add ui/bootstrap/runtime-resolvers.ts ui/bootstrap.ts test/ui.bootstrap.cpu-early-registration.test.ts test/ui.bootstrap-shared.test.ts
git commit -m "Extract bootstrap runtime resolvers"
```

## Task 3: Extract Bootstrap CPU And Pass Runtime Wiring

**Files:**

- Create: `ui/bootstrap/cpu-runtime-wiring.ts`
- Create: `ui/bootstrap/pass-runtime-wiring.ts`
- Modify: `ui/bootstrap.ts`
- Test: `test/ui.bootstrap.cpu-early-registration.test.ts`
- Test: `test/cpu-turn-handler.network-guard.test.ts`
- Test: `test/game.pass-handler.test.ts`

- [ ] **Step 1: Characterize current CPU/pass DI**

Extend tests to assert:

- `processCpuTurn`, `processAutoBlackTurn`, and `selectMoveFromOnnxPolicyAsync` are registered when modules expose them.
- CPU timer service is injected.
- pass handler receives `processCpuTurn`, `readMatchMode`, `showResult`, `getActionManager`, and `getNetworkTurnHandoff`.
- missing optional modules do not throw.

Run:

```powershell
npx jest --runInBand test/ui.bootstrap.cpu-early-registration.test.ts test/cpu-turn-handler.network-guard.test.ts test/game.pass-handler.test.ts
```

Expected: pass before extraction.

- [ ] **Step 2: Move CPU wiring verbatim**

Create `ui/bootstrap/cpu-runtime-wiring.ts` exporting:

```typescript
export type CpuRuntimeWiringDeps = {
  requireModule: (id: string) => any;
  timerService: any;
  runtimeResolvers: any;
  readCpuSmartnessValueFromSelect: (id: string) => any;
  getPlaybackStateModuleForReset: () => any;
  registerUIGlobals: (globals: Record<string, any>) => any;
};

export function installCpuRuntimeWiring(deps: CpuRuntimeWiringDeps): { registeredGlobals: Record<string, any> } {
  const cpu = deps.requireModule('../game/cpu-turn-handler');
  let cpuDecision: any = null;
  try { cpuDecision = deps.requireModule('../game/cpu-decision'); } catch (e) { cpuDecision = null; }
  const cpuGlobals: Record<string, any> = {};
  if (cpu && typeof cpu.processCpuTurn === 'function') cpuGlobals.processCpuTurn = cpu.processCpuTurn;
  if (cpu && typeof cpu.processAutoBlackTurn === 'function') cpuGlobals.processAutoBlackTurn = cpu.processAutoBlackTurn;
  if (cpuDecision && typeof cpuDecision.selectMoveFromOnnxPolicyAsync === 'function') {
    cpuGlobals.selectMoveFromOnnxPolicyAsync = cpuDecision.selectMoveFromOnnxPolicyAsync;
  }
  return { registeredGlobals: cpuGlobals };
}

module.exports = { installCpuRuntimeWiring };
```

Then move the remaining `setCpuTurnTimerService` and `setCpuUIImpl` object into the helper without changing object keys or fallback behavior.

- [ ] **Step 3: Move pass wiring verbatim**

Create `ui/bootstrap/pass-runtime-wiring.ts` exporting:

```typescript
export type PassRuntimeWiringDeps = {
  requireModule: (id: string) => any;
  timerService: any;
  runtimeResolvers: any;
  registerUIGlobals: (globals: Record<string, any>) => any;
};

export function installPassRuntimeWiring(deps: PassRuntimeWiringDeps): { registeredGlobals: Record<string, any> } {
  const passHandler = deps.requireModule('../game/pass-handler');
  const passGlobals: Record<string, any> = {};
  if (passHandler && typeof passHandler.processPassTurn === 'function') passGlobals.processPassTurn = passHandler.processPassTurn;
  if (passHandler && typeof passHandler.ensureCurrentPlayerCanActOrPass === 'function') {
    passGlobals.ensureCurrentPlayerCanActOrPass = passHandler.ensureCurrentPlayerCanActOrPass;
  }
  return { registeredGlobals: passGlobals };
}

module.exports = { installPassRuntimeWiring };
```

Then move the remaining `setPassHandlerTimerService` and `setPassHandlerRuntime` object into the helper without changing object keys or fallback behavior.

- [ ] **Step 4: Keep public bootstrap shell stable**

In `ui/bootstrap.ts`, `installNetworkDI(timerService)` should call the two helpers and still call `registerUIGlobals` in the same effective order. Do not change `UIBootstrap` export keys.

- [ ] **Step 5: Validate**

Run:

```powershell
npx jest --runInBand test/ui.bootstrap.cpu-early-registration.test.ts test/cpu-turn-handler.network-guard.test.ts test/game.pass-handler.test.ts
npm run check:window
npm run build:ts
```

Expected: all pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git diff --check
git add ui/bootstrap/cpu-runtime-wiring.ts ui/bootstrap/pass-runtime-wiring.ts ui/bootstrap.ts test/ui.bootstrap.cpu-early-registration.test.ts test/cpu-turn-handler.network-guard.test.ts test/game.pass-handler.test.ts
git commit -m "Extract bootstrap CPU and pass wiring"
```

## Task 4: Extract Bootstrap Asset Manifest Runtime

**Files:**

- Create: `ui/bootstrap/asset-manifest-runtime.ts`
- Modify: `ui/bootstrap.ts`
- Test: `test/ui.bootstrap.asset-manifest.test.ts` or the existing bootstrap test file that already covers asset manifest status

- [ ] **Step 1: Add or extend asset manifest characterization**

Cover these existing results:

- no `fetch` returns `{ status: 'unavailable', reason: 'fetch-unavailable' }`
- `file:` or `origin === 'null'` returns `{ status: 'skipped', reason: 'file-origin' }`
- non-ok response returns `{ status: 'error', reason: 'fetch-failed', code }`
- invalid shape returns `{ status: 'error', reason: 'invalid-manifest' }`
- valid manifest calls `setLoadedAssetManifest` and returns `{ status: 'ok', manifest }`
- `applyAssetManifest` strict mode returns error when preload fails
- `applyAssetManifest` compat mode returns fallback when preload fails

Run:

```powershell
npx jest --runInBand test/ui.bootstrap.asset-manifest.test.ts
```

If the file does not exist, create it and run that exact command.

- [ ] **Step 2: Extract asset manifest functions**

Move these functions from `ui/bootstrap.ts` to `ui/bootstrap/asset-manifest-runtime.ts`:

- `setLoadedAssetManifest`
- `getLoadedAssetManifest`
- `refreshLoadedAssetManifest`
- `applyAssetManifest`
- `handleGameInit`

Keep `preloadAssets` in `ui/bootstrap.ts` if it depends on `installGameDI`; pass it into the new module as a dependency:

```typescript
export type AssetManifestRuntimeDeps = {
  preloadAssets: (manifest: any, opts: any) => Promise<any>;
  isAssetManifestShape: (manifest: any) => boolean;
  dispatchAssetManifestUpdated: (manifest: any, opts: any) => any;
};
```

- [ ] **Step 3: Keep `UIBootstrap` export stable**

`ui/bootstrap.ts` must still expose:

- `preloadAssets`
- `applyAssetManifest`
- `handleGameInit`
- `setLoadedAssetManifest`
- `getLoadedAssetManifest`
- `refreshLoadedAssetManifest`
- `ASSET_MANIFEST_UPDATED_EVENT`

- [ ] **Step 4: Validate**

Run:

```powershell
npx jest --runInBand test/ui.bootstrap.asset-manifest.test.ts test/ui.bootstrap-shared.test.ts
npm run build:ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git diff --check
git add ui/bootstrap/asset-manifest-runtime.ts ui/bootstrap.ts test/ui.bootstrap.asset-manifest.test.ts test/ui.bootstrap-shared.test.ts
git commit -m "Extract bootstrap asset manifest runtime"
```

## Task 5: Diff Renderer Viewer Context Characterization

**Files:**

- Create or modify: `test/ui.diff-renderer.viewer-context.test.ts`
- No production edits

- [ ] **Step 1: Characterize viewer context behavior**

Cover current behavior around `ui/diff-renderer.ts` line 1776:

- network mode uses `NetworkMatchClient.getSeatKey()` when active.
- local keys check `LOCAL_PLAYER_KEY`, `__LOCAL_PLAYER_KEY`, and `BOARD_VIEWER_KEY`.
- human-vs-human debug flag is reflected.
- missing `window` or missing network client returns a non-throwing fallback.

Use `jest.resetModules()` and temporary `global.window` fields the same way existing UI tests do.

- [ ] **Step 2: Run characterization**

Run:

```powershell
npx jest --runInBand test/ui.diff-renderer.viewer-context.test.ts
```

Expected: pass before extraction.

- [ ] **Step 3: Commit**

Run:

```powershell
git diff --check
git add test/ui.diff-renderer.viewer-context.test.ts
git commit -m "Characterize diff renderer viewer context"
```

## Task 6: Extract Diff Renderer Viewer Context

**Files:**

- Create: `ui/diff-renderer/viewer-context.ts`
- Modify: `ui/diff-renderer.ts`
- Test: `test/ui.diff-renderer.viewer-context.test.ts`
- Test: `test/ui.network-snapshot.single-writer-baseline.test.ts`

- [ ] **Step 1: Create helper module**

Create `ui/diff-renderer/viewer-context.ts`:

```typescript
export type DiffRendererViewerContext = {
  seatKey: 'black' | 'white' | null;
  localPlayerKey: 'black' | 'white' | null;
  isNetworkMode: boolean;
  debugHumanVsHuman: boolean;
};

function normalizePlayerKey(value: any): 'black' | 'white' | null {
  return value === 'black' || value === 'white' ? value : null;
}

export function resolveDiffRendererViewerContext(root: any): DiffRendererViewerContext {
  const win = root || (typeof window !== 'undefined' ? window : null);
  let seatKey: 'black' | 'white' | null = null;
  try {
    if (win && win.NetworkMatchClient && typeof win.NetworkMatchClient.getSeatKey === 'function') {
      seatKey = normalizePlayerKey(win.NetworkMatchClient.getSeatKey());
    }
  } catch (e) { seatKey = null; }
  let localPlayerKey: 'black' | 'white' | null = null;
  try {
    const directKeys = [win && win.LOCAL_PLAYER_KEY, win && win.__LOCAL_PLAYER_KEY, win && win.BOARD_VIEWER_KEY];
    for (const key of directKeys) {
      localPlayerKey = normalizePlayerKey(key);
      if (localPlayerKey) break;
    }
  } catch (e) { localPlayerKey = null; }
  let isNetworkMode = false;
  try {
    isNetworkMode = !!(
      win &&
      (
        (typeof win.getCurrentMatchMode === 'function' && win.getCurrentMatchMode() === 'network') ||
        win.MATCH_MODE === 'network'
      )
    );
  } catch (e) { isNetworkMode = false; }
  return {
    seatKey,
    localPlayerKey,
    isNetworkMode,
    debugHumanVsHuman: !!(win && win.DEBUG_HUMAN_VS_HUMAN === true)
  };
}

module.exports = {
  resolveDiffRendererViewerContext
};
```

- [ ] **Step 2: Replace inline viewer lookup**

In `ui/diff-renderer.ts`, require the helper and replace the local seat/mode resolution block with `resolveDiffRendererViewerContext(window)`. Keep fallback behavior if the helper is unavailable.

- [ ] **Step 3: Validate**

Run:

```powershell
npx jest --runInBand test/ui.diff-renderer.viewer-context.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npm run build:ts
```

Expected: all pass.

- [ ] **Step 4: Commit**

Run:

```powershell
git diff --check
git add ui/diff-renderer/viewer-context.ts ui/diff-renderer.ts test/ui.diff-renderer.viewer-context.test.ts
git commit -m "Extract diff renderer viewer context"
```

## Task 7: Extract Stone Info Panel

**Files:**

- Create: `ui/diff-renderer/stone-info-panel.ts`
- Modify: `ui/diff-renderer.ts`
- Test: existing stone info panel tests, or create `test/ui.diff-renderer.stone-info-panel.test.ts`

- [ ] **Step 1: Characterize panel DOM behavior**

Cover:

- creates `#stone-info-panel` if missing
- reuses existing panel if present
- appends near `#manifest-effect-panel` / `#effect-live-panel` order when those panels exist
- pointerdown outside the panel hides or dismisses according to current behavior
- hover-capable and hover-none media query branches do not throw

Run:

```powershell
npx jest --runInBand test/ui.diff-renderer.stone-info-panel.test.ts
```

- [ ] **Step 2: Move DOM panel helpers**

Move the stone info panel creation, positioning, touch/hover detection, and outside-click handling from `ui/diff-renderer.ts` into `ui/diff-renderer/stone-info-panel.ts`.

Keep exported helper names internal:

```typescript
export function ensureStoneInfoPanel(doc: Document): HTMLElement | null;
export function hideStoneInfoPanel(doc: Document): boolean;
export function attachStoneInfoPanelDismissHandlers(doc: Document): void;
```

- [ ] **Step 3: Keep public compatibility**

`ui/diff-renderer.ts` must still export and globally register `showSpecialStoneInfoAt` exactly as before.

- [ ] **Step 4: Validate**

Run:

```powershell
npx jest --runInBand test/ui.diff-renderer.stone-info-panel.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npm run build:ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git diff --check
git add ui/diff-renderer/stone-info-panel.ts ui/diff-renderer.ts test/ui.diff-renderer.stone-info-panel.test.ts
git commit -m "Extract diff renderer stone info panel"
```

## Task 8: Extract Special Marker Renderer

**Files:**

- Create: `ui/diff-renderer/special-marker-renderer.ts`
- Modify: `ui/diff-renderer.ts`
- Test: `test/ui.diff-renderer.special-marker-renderer.test.ts`
- Test: `test/ui.animation-engine.guard-timer.test.ts`

- [ ] **Step 1: Characterize marker DOM output**

Cover at least these marker categories with existing fixture state:

- hole / blockade / seed / bonus labels
- timed marker labels
- guard / freeze / evade timers
- special stone effect key mapping

Assert DOM class names and key dataset values already used by CSS or tests. Do not assert cosmetic pixel positions unless a current test already treats them as contract.

- [ ] **Step 2: Move marker element builders**

Move pure DOM element builders into `ui/diff-renderer/special-marker-renderer.ts`:

```typescript
export type SpecialMarkerRenderDeps = {
  documentRef: Document;
  animationShared: any;
  readDebugFlag: (name: string) => boolean;
};

export function createSpecialMarkerRenderer(deps: SpecialMarkerRenderDeps) {
  return {
    createHoleMark,
    createBlockadeMark,
    createSeedMark,
    createBonusLabel,
    createTimedMarkerLabel,
    createGuardTimerLabel,
    createFreezeMark
  };
}
```

Use the exact current class names and text content.

- [ ] **Step 3: Keep board write ownership unchanged**

Only move element creation. Do not move the outer board update loop or playback-active write guards in this pass.

- [ ] **Step 4: Validate**

Run:

```powershell
npx jest --runInBand test/ui.diff-renderer.special-marker-renderer.test.ts test/ui.animation-engine.guard-timer.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts
npm run build:ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git diff --check
git add ui/diff-renderer/special-marker-renderer.ts ui/diff-renderer.ts test/ui.diff-renderer.special-marker-renderer.test.ts
git commit -m "Extract diff renderer special marker rendering"
```

## Task 9: CPU Runtime Boundary Characterization

**Files:**

- Modify: `test/cpu.decision.refactor.test.ts`
- Modify: `test/cpu.decision.public-api.test.ts`
- No production edits

- [ ] **Step 1: Lock public export surface**

Confirm `test/cpu.decision.public-api.test.ts` still asserts the full sorted export key list. If a new export is needed only for tests, do not add it. Test through existing public functions or internal factory modules.

- [ ] **Step 2: Add runtime boundary characterization**

In `test/cpu.decision.refactor.test.ts`, add tests for:

- injected `readMatchMode()` overrides legacy globals
- injected `readCpuSmartness()` overrides `global.cpuSmartness`
- injected `readModule('OthelloOnnxRuntime')` is used before static module fallback
- `setCpuDecisionRuntime(null)` clears injected runtime

Run:

```powershell
npx jest --runInBand test/cpu.decision.refactor.test.ts test/cpu.decision.public-api.test.ts
```

Expected: pass before production extraction.

- [ ] **Step 3: Commit**

Run:

```powershell
git diff --check
git add test/cpu.decision.refactor.test.ts test/cpu.decision.public-api.test.ts
git commit -m "Characterize CPU decision runtime boundary"
```

## Task 10: Extract CPU Decision Runtime

**Files:**

- Create: `game/cpu-decision-runtime.ts`
- Modify: `game/cpu-decision.ts`
- Test: `test/cpu.decision.refactor.test.ts`
- Test: `test/cpu.decision.public-api.test.ts`

- [ ] **Step 1: Create runtime module**

Move these responsibilities from `game/cpu-decision.ts`:

- `setCpuDecisionRuntime`
- `readRuntimeModule`
- `resolveCpuDecisionMatchMode`
- `isOthelloModeForCpuDecision`
- `readCpuDecisionQuerySearch`
- debug flag read helpers

Keep the public setter re-exported by `game/cpu-decision.ts`.

Initial module API:

```typescript
export type CpuDecisionRuntime = Record<string, any> | null;

export function createCpuDecisionRuntimeBoundary() {
  let runtime: CpuDecisionRuntime = null;
  function setCpuDecisionRuntime(next: any): void {
    if (!next || typeof next !== 'object') {
      runtime = null;
      return;
    }
    runtime = Object.assign({}, runtime || {}, next);
  }
  function readRuntimeModule(moduleKey: any): any {
    try {
      if (runtime && typeof runtime.readModule === 'function') return runtime.readModule(moduleKey);
    } catch (e) { /* ignore */ }
    return null;
  }
  return {
    setCpuDecisionRuntime,
    readRuntimeModule
  };
}

module.exports = {
  createCpuDecisionRuntimeBoundary
};
```

Add the remaining functions after the initial move while preserving return values exactly.

- [ ] **Step 2: Wire shell through runtime boundary**

In `game/cpu-decision.ts`, instantiate the boundary once at module scope and replace direct access to the old `cpuDecisionRuntime` variable with boundary methods.

- [ ] **Step 3: Validate**

Run:

```powershell
npx jest --runInBand test/cpu.decision.refactor.test.ts test/cpu.decision.public-api.test.ts
npm run check:window
node scripts/check-refactor-safety.js
npm run build:ts
```

- [ ] **Step 4: Commit**

Run:

```powershell
git diff --check
git add game/cpu-decision-runtime.ts game/cpu-decision.ts test/cpu.decision.refactor.test.ts test/cpu.decision.public-api.test.ts
git commit -m "Extract CPU decision runtime boundary"
```

## Task 11: Extract CPU ONNX Move Decision

**Files:**

- Create: `game/cpu-decision-onnx-move.ts`
- Modify: `game/cpu-decision.ts`
- Test: `test/cpu.decision.refactor.test.ts`
- Test: `test/game.othello-onnx-runtime.test.ts`

- [ ] **Step 1: Characterize ONNX move behavior**

Ensure `test/cpu.decision.refactor.test.ts` covers:

- normal Othello mode uses `OthelloOnnxRuntime`
- card CPU Lv6 normal placement uses `OthelloOnnxRuntime` before card ONNX
- custom board returns `null`
- latency pre-gate returns `null`
- budget timeout returns `null`
- Lv5 returns ONNX tactical result without Lv6 lookahead correction
- Lv6 applies tactical correction and lookahead correction when applicable

Run:

```powershell
npx jest --runInBand test/cpu.decision.refactor.test.ts -t "selectMoveFromOnnxPolicyAsync"
```

- [ ] **Step 2: Move ONNX move function and direct helpers**

Move from `game/cpu-decision.ts` into `game/cpu-decision-onnx-move.ts`:

- `selectMoveFromOnnxPolicyAsync`
- `selectMoveByLookahead`
- `refineOnnxMoveByTacticalPlan`
- direct support helpers used only by ONNX move selection

Do not move card ONNX, pending ONNX, or card selection in this task.

Use dependency injection rather than importing the whole shell:

```typescript
export type CpuDecisionOnnxMoveDeps = {
  getCurrentCpuBoard: () => any;
  resolvePendingType: (playerKey: any) => any;
  shouldUseOthelloOnnxRuntime: () => boolean;
  shouldForceCardModeLv6Placement: (playerKey: any, pendingType: any, boardRef: any) => any;
  isOthelloModeForCpuDecision: () => boolean;
  resolveOthelloOnnxRuntime: () => any;
  resolvePolicyOnnxRuntime: () => any;
  canUseStandardBoardCpuPolicy: (boardRef: any, featureKey: any, playerKey: any, level: any) => any;
  filterMovesByLv6PlacementPriority: (playerKey: any, level: any, candidateMoves: any) => any;
  filterLv6OpenCornerAdjacentMoves: (candidateMoves: any, board: any) => any;
  evaluateCpuOnnxLatencyGate: (runtime: any, operationKey: any, level: any) => any;
  logCpuOnnxLatencyDegrade: (level: any, playerKey: any, operationKey: any, reason: any) => any;
  resolveCpuLv6OnnxRuntimeBudgetMs: (level: any, operationKey: any) => any;
  awaitCpuPromiseWithinBudget: (factory: any, budgetMs: any, timeoutValue: any) => Promise<any>;
  getCpuOnnxBudgetTimeout: () => any;
  buildOnnxContext: (playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, candidateMoves?: any) => any;
  getHandCardIdsForPlayer: (playerKey: any) => any[];
  resolveCandidateMoveByCoord: (candidateMoves: any, move: any) => any;
  buildMovePlanContext: (playerKey: any, level: any, candidateMoves: any) => any;
  cpuDebugLog: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};
```

- [ ] **Step 3: Keep public export stable**

`game/cpu-decision.ts` still exports `selectMoveFromOnnxPolicyAsync`. It should delegate to the new module.

- [ ] **Step 4: Validate**

Run:

```powershell
npx jest --runInBand test/cpu.decision.refactor.test.ts -t "selectMoveFromOnnxPolicyAsync"
npx jest --runInBand test/game.othello-onnx-runtime.test.ts test/cpu.decision.public-api.test.ts
npm run check:window
node scripts/check-refactor-safety.js
npm run build:ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git diff --check
git add game/cpu-decision-onnx-move.ts game/cpu-decision.ts test/cpu.decision.refactor.test.ts
git commit -m "Extract CPU ONNX move decision"
```

## Task 12: Extract CPU Placement Priority

**Files:**

- Create: `game/cpu-decision-placement-priority.ts`
- Modify: `game/cpu-decision.ts`
- Test: `test/cpu.decision.refactor.test.ts`

- [ ] **Step 1: Characterize placement priority**

Ensure tests cover:

- corner candidates are forced before special-removal candidates
- special-removal candidates are forced before edge candidates
- safe edge candidates are forced before inner candidates
- risky open-corner edge and C-square are excluded when safer alternatives exist
- `FREE_PLACEMENT` and `LAST_RESORT` still use pending-specific evaluation

Run:

```powershell
npx jest --runInBand test/cpu.decision.refactor.test.ts -t "selectCpuMoveWithPolicy|FREE_PLACEMENT|LAST_RESORT"
```

- [ ] **Step 2: Move placement filtering**

Move from `game/cpu-decision.ts`:

- `scoreLv6PlacementPlanMove`
- `filterLv6SpecialRemovalMoves`
- `filterLv6EdgeMovesByPlan`
- `filterMovesByLv6PlacementPriority`
- `filterCloneSplitTargetsForLv6` only if its dependencies remain local and tests cover clone behavior in the same pass

Keep behavior identical. Do not tune weights in this task.

- [ ] **Step 3: Validate**

Run:

```powershell
npx jest --runInBand test/cpu.decision.refactor.test.ts -t "selectCpuMoveWithPolicy|FREE_PLACEMENT|LAST_RESORT|cpuSelectCloneWillWithPolicy"
npm run check:window
npm run build:ts
```

- [ ] **Step 4: Commit**

Run:

```powershell
git diff --check
git add game/cpu-decision-placement-priority.ts game/cpu-decision.ts test/cpu.decision.refactor.test.ts
git commit -m "Extract CPU placement priority helpers"
```

## Task 13: CPU Public API Assembly Guard

**Files:**

- Create: `game/cpu-decision-public-api.ts`
- Modify: `game/cpu-decision.ts`
- Test: `test/cpu.decision.public-api.test.ts`

- [ ] **Step 1: Create checked public API adapter**

Create `game/cpu-decision-public-api.ts`:

```typescript
export type CpuDecisionPublicApi = Record<string, any>;

const REQUIRED_CPU_DECISION_EXPORTS = [
  'applyCardChoice',
  'applyHandCardDestroy',
  'buildCardUseDecisionContext',
  'buildOnnxContext',
  'computeCpuAction',
  'cpuMaybeDestroyHandCardWithPolicy',
  'cpuMaybeUseCardWithPolicy',
  'selectCardToUse',
  'selectCpuMoveWithPolicy',
  'selectMoveFromOnnxPolicyAsync',
  'setCpuDecisionRuntime'
];

export function assertCpuDecisionPublicApi(api: CpuDecisionPublicApi): CpuDecisionPublicApi {
  for (const key of REQUIRED_CPU_DECISION_EXPORTS) {
    if (!api || typeof api[key] === 'undefined') {
      throw new Error(`cpu-decision public API missing ${key}`);
    }
  }
  return api;
}

module.exports = {
  REQUIRED_CPU_DECISION_EXPORTS,
  assertCpuDecisionPublicApi
};
```

- [ ] **Step 2: Route shell export through adapter**

In `game/cpu-decision.ts`, build the existing export object into `const cpuDecisionPublicApi = assertCpuDecisionPublicApi({ ... })` and `module.exports = cpuDecisionPublicApi`.

- [ ] **Step 3: Keep full public API test**

`test/cpu.decision.public-api.test.ts` must still assert the full sorted key list, not only the required subset.

- [ ] **Step 4: Validate**

Run:

```powershell
npx jest --runInBand test/cpu.decision.public-api.test.ts test/cpu.decision.refactor.test.ts -t "selectMoveFromOnnxPolicyAsync|selectCpuMoveWithPolicy|selectCardToUse"
node scripts/check-refactor-safety.js
npm run build:ts
```

- [ ] **Step 5: Commit**

Run:

```powershell
git diff --check
git add game/cpu-decision-public-api.ts game/cpu-decision.ts test/cpu.decision.public-api.test.ts
git commit -m "Guard CPU decision public API assembly"
```

## Task 14: Full Refactor Validation

**Files:**

- No production edits unless validation reveals a refactor-caused failure

- [ ] **Step 1: Run boundary and build checks**

Run:

```powershell
npm run check:window
node scripts/check-refactor-safety.js
npm run build:ts
```

Expected: all exit `0`.

- [ ] **Step 2: Run focused suites for touched areas**

Run:

```powershell
npx jest --runInBand test/ui.bootstrap.cpu-early-registration.test.ts test/ui.bootstrap-shared.test.ts test/cpu-turn-handler.network-guard.test.ts test/game.pass-handler.test.ts
npx jest --runInBand test/ui.diff-renderer.viewer-context.test.ts test/ui.diff-renderer.stone-info-panel.test.ts test/ui.diff-renderer.special-marker-renderer.test.ts test/ui.network-snapshot.single-writer-baseline.test.ts test/ui.animation-engine.guard-timer.test.ts
npx jest --runInBand test/cpu.decision.refactor.test.ts test/cpu.decision.public-api.test.ts test/game.othello-onnx-runtime.test.ts
```

Expected: all pass. If `test/cpu.decision.refactor.test.ts` still has a pre-existing unrelated `CRYSTAL_STONE` failure, run the CPU refactor-specific focused selectors and record the unrelated failure separately.

- [ ] **Step 3: Run broader checks if no unrelated dirty files block them**

Run:

```powershell
npm run checkall
```

Expected: exit `0`. If unrelated dirty generated files make this noisy, report exact files and use focused validation above as the refactor gate.

- [ ] **Step 4: Inspect remaining line counts**

Run:

```powershell
$targets=@('ui/bootstrap.ts','ui/diff-renderer.ts','game/cpu-decision.ts')
foreach($f in $targets){ $lines=(Get-Content $f | Measure-Object -Line).Lines; "$f $lines" }
```

Expected direction:

- `ui/bootstrap.ts` reduced by CPU/pass/asset-manifest wiring.
- `ui/diff-renderer.ts` reduced by viewer context, panel, and marker helpers.
- `game/cpu-decision.ts` reduced by runtime boundary, ONNX move, and placement priority helpers.

- [ ] **Step 5: Do not commit from the final validation task**

If Task 14 changes no files, do not commit. If validation reveals a defect, return to the task that owns the affected area, make the fix there, rerun that task's validation, and commit under that task's commit step. Task 14 is only the final gate.

```powershell
git diff --check
git status --short
```

## Stop Conditions

Stop and report before continuing if any of these happen:

- A public export key must change.
- A test reveals current behavior is likely wrong but the requested pass is refactor-only.
- A module split requires changing network snapshot shape, worker response shape, action payload shape, model format, or generated catalog schema.
- `game/` would need a DOM, sound, timer, or network client dependency.
- A task touches unrelated dirty files that cannot be separated safely.
- A single diff becomes too large to review in one screen per file.

## Rollback

Each task is one commit. Roll back the last pass with:

```powershell
git log --oneline -5
git revert HEAD
```

Do not use `git reset --hard` or discard unrelated dirty files.

## Recommended Execution Mode

Use subagent-driven development if available: one fresh worker per task, main thread reviews the diff and runs validation before the next task. If executing inline, complete exactly one task and one commit before starting the next task.
