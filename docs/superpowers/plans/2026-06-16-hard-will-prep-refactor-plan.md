# Hard Will Prep Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the behavior-preserving refactoring and preparation needed before implementing `硬い意志` / `破壊保護`.

**Architecture:** This plan does not add the card, catalog entry, `HARD_WILL` type, or player-facing rulebook text. It centralizes destroy-protection lookup around `shared/special-stone-registry.ts`, keeps `game/` headless, and adds a reusable UI timer hook so a later destroy-protection stone status can be added without another `GUARD`-specific branch.

**Tech Stack:** TypeScript/CommonJS-compatible modules, Jest, existing board rendering CSS, `npm run typecheck`, focused Jest checks, and no generated or mirror edits.

---

## Scope Boundary

This plan prepares the repository for `硬い意志` only. Do not add any of these in this pass:

- `硬い意志` to `01-rulebook.md`
- `hard_will_01` or another card ID to `cards/catalog.json`
- `HARD_WILL` to `src/types/card.ts`
- `DESTROY_PROTECTION` or another new marker type to `shared/special-stone-registry.ts`
- pending selection registry entries
- CPU hard-will logic
- generated catalog files
- `worker-public/` mirror updates

The intended stopping point is a behavior-preserving refactor that keeps all existing cards working and makes the subsequent card implementation smaller.

## Working Tree Prerequisite

Do not start implementation in the current dirty checkout unless unrelated changes are resolved or explicitly approved.

At plan creation time, unrelated dirty areas included `01-rulebook.md`, UI/style/sound/help files, deleted `artifacts/`, `worker-public/`, and hand-card-swipe files. A worker executing this plan must start with:

```powershell
git status --short
```

Expected before implementation: either a clean worktree, or only files intentionally owned by the current pass. If unrelated changes remain, report them and wait for an instruction before editing.

## File Map

- Create: `game/logic/cards-internal/destroy-protection-context.ts`
  - Pure helper that finds special-stone markers whose registry entry has `destroyProtected: true`.
  - Preserves existing `GUARD` reason and `ignoreGuard` behavior.
  - Contains no DOM, `window`, sound, timer, network, or hidden runtime authority dependency.
- Create: `game/logic/cards-internal/destroy-protection-context.js`
  - Checked-in CommonJS wrapper matching existing `cards-internal` wrapper style.
- Create: `test/game.destroy-protection-context.test.ts`
  - Characterization for the helper and `BoardOps.destroyAt` existing behavior.
- Modify: `game/logic/board_ops.ts`
  - Delegates destroy-protection marker lookup to the new helper after absolute protection and before frozen/ghost/evade handling.
- Modify: `ui/diff-renderer/special-marker-renderer.ts`
  - Adds reusable stone-status timer label creation and a destroy-protection timer label factory.
- Modify: `test/ui.diff-renderer.special-marker-renderer.test.ts`
  - Covers the new renderer helper without requiring a new marker type.
- Modify: `styles-board.css`
  - Adds a reserved `.stone-destroy-protection-timer` style that does not render until a caller uses it.
- Modify: `docs/architecture-contracts.md`
  - Documents that destroy-protection behavior must derive from `shared/special-stone-registry.ts`.

## Task 1: Add Destroy-Protection Context Tests

**Files:**
- Create: `test/game.destroy-protection-context.test.ts`

- [ ] **Step 1: Write the failing helper and BoardOps characterization tests**

Create `test/game.destroy-protection-context.test.ts`:

```typescript
/* eslint-env jest */

const Core = require('../game/logic/core.js');
import * as BoardOps from '../game/logic/board_ops.js';

const DestroyProtectionContext = require('../game/logic/cards-internal/destroy-protection-context');

function createEmptyGameState() {
  const gameState = Core.createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
  gameState.currentPlayer = Core.BLACK;
  gameState.turnNumber = 1;
  gameState.consecutivePasses = 0;
  return gameState;
}

function marker(type: string, row = 2, col = 3, owner: 'black' | 'white' = 'black') {
  return {
    id: `${type}-${row}-${col}`,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: { type }
  };
}

function registry(entries: Record<string, any>) {
  return {
    getSpecialStoneInfo(type: any) {
      return entries[String(type || '').toUpperCase()] || null;
    },
    SPECIAL_STONE_REGISTRY: entries
  };
}

describe('destroy-protection context', () => {
  test('finds registry-backed destroy protection without requiring BoardOps changes per new type', () => {
    const cardState = {
      markers: [
        marker('DESTROY_PROTECTION', 2, 3),
        marker('NOT_PROTECTED', 4, 4)
      ]
    };

    const found = DestroyProtectionContext.resolveDestroyProtectionAt(cardState, 2, 3, {
      SpecialStoneRegistry: registry({
        DESTROY_PROTECTION: { destroyProtected: true },
        NOT_PROTECTED: { destroyProtected: false }
      })
    });

    expect(found).toEqual(expect.objectContaining({
      type: 'DESTROY_PROTECTION',
      reason: 'destroy_protected'
    }));
    expect(found.marker).toBe(cardState.markers[0]);
  });

  test('keeps GUARD reason stable and lets ignoreGuard bypass only GUARD', () => {
    const guardState = { markers: [marker('GUARD', 1, 1)] };
    const genericState = { markers: [marker('DESTROY_PROTECTION', 1, 1)] };
    const fakeRegistry = registry({
      GUARD: { destroyProtected: true },
      DESTROY_PROTECTION: { destroyProtected: true }
    });

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(guardState, 1, 1, {
      SpecialStoneRegistry: fakeRegistry
    })).toEqual(expect.objectContaining({
      type: 'GUARD',
      reason: 'guard_protected'
    }));

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(guardState, 1, 1, {
      SpecialStoneRegistry: fakeRegistry,
      ignoreGuard: true
    })).toBeNull();

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(genericState, 1, 1, {
      SpecialStoneRegistry: fakeRegistry,
      ignoreGuard: true
    })).toEqual(expect.objectContaining({
      type: 'DESTROY_PROTECTION',
      reason: 'destroy_protected'
    }));
  });

  test('ignores non-special markers and markers outside the requested cell', () => {
    const cardState = {
      markers: [
        { ...marker('DESTROY_PROTECTION', 2, 2), kind: 'bomb' },
        marker('DESTROY_PROTECTION', 2, 3)
      ]
    };
    const fakeRegistry = registry({
      DESTROY_PROTECTION: { destroyProtected: true }
    });

    expect(DestroyProtectionContext.resolveDestroyProtectionAt(cardState, 2, 2, {
      SpecialStoneRegistry: fakeRegistry
    })).toBeNull();
    expect(DestroyProtectionContext.resolveDestroyProtectionAt(cardState, 2, 3, {
      SpecialStoneRegistry: fakeRegistry
    })).toEqual(expect.objectContaining({
      type: 'DESTROY_PROTECTION',
      reason: 'destroy_protected'
    }));
  });

  test('BoardOps.destroyAt keeps current GUARD behavior through the shared helper', () => {
    const gameState = createEmptyGameState();
    const cardState = { markers: [marker('GUARD', 3, 3)] };
    gameState.board[3][3] = Core.BLACK;

    const blocked = BoardOps.destroyAt(cardState, gameState, 3, 3, 'TEST', 'guard_block');

    expect(blocked.destroyed).toBe(false);
    expect(blocked.reason).toBe('guard_protected');
    expect(BoardOps.getCellValue(gameState, 3, 3)).toBe(Core.BLACK);
  });

  test('BoardOps.destroyAt still destroys GUARD when ignoreGuard is explicitly set', () => {
    const gameState = createEmptyGameState();
    const cardState = { markers: [marker('GUARD', 3, 3)] };
    gameState.board[3][3] = Core.BLACK;

    const destroyed = BoardOps.destroyAt(cardState, gameState, 3, 3, 'TEST', 'guard_bypass', {
      ignoreGuard: true
    });

    expect(destroyed.destroyed).toBe(true);
    expect(BoardOps.getCellValue(gameState, 3, 3)).toBe(Core.EMPTY);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails because the helper does not exist**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.destroy-protection-context.test.ts
```

Expected: FAIL with a module resolution error for `game/logic/cards-internal/destroy-protection-context`.

## Task 2: Add the Pure Destroy-Protection Helper

**Files:**
- Create: `game/logic/cards-internal/destroy-protection-context.ts`
- Create: `game/logic/cards-internal/destroy-protection-context.js`

- [ ] **Step 1: Add the TypeScript helper**

Create `game/logic/cards-internal/destroy-protection-context.ts`:

```typescript
type Marker = {
    kind?: string;
    row?: number;
    col?: number;
    data?: {
        type?: unknown;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

type SpecialStoneRegistryLike = {
    getSpecialStoneInfo?: (type: string) => any;
    SPECIAL_STONE_REGISTRY?: Record<string, any>;
};

type ResolveOptions = {
    SpecialStoneRegistry?: SpecialStoneRegistryLike | null;
    markerKinds?: { SPECIAL_STONE?: string } | null;
    ignoreGuard?: boolean;
};

const DEFAULT_SPECIAL_MARKER_KIND = 'specialStone';

function normalizeSpecialStoneType(rawType: unknown): string | null {
    if (rawType === null || typeof rawType === 'undefined') return null;
    const normalized = String(rawType).trim().toUpperCase();
    return normalized || null;
}

function getSpecialStoneInfo(registry: SpecialStoneRegistryLike | null | undefined, type: string | null): any {
    if (!registry || !type) return null;
    if (typeof registry.getSpecialStoneInfo === 'function') {
        const info = registry.getSpecialStoneInfo(type);
        if (info) return info;
    }
    if (registry.SPECIAL_STONE_REGISTRY && registry.SPECIAL_STONE_REGISTRY[type]) {
        return registry.SPECIAL_STONE_REGISTRY[type];
    }
    return null;
}

function isSpecialMarkerAt(marker: Marker, row: number, col: number, options: ResolveOptions): boolean {
    if (!marker || marker.row !== row || marker.col !== col) return false;
    const specialKind = options.markerKinds && options.markerKinds.SPECIAL_STONE
        ? options.markerKinds.SPECIAL_STONE
        : DEFAULT_SPECIAL_MARKER_KIND;
    return marker.kind === specialKind || marker.kind === DEFAULT_SPECIAL_MARKER_KIND;
}

function getDestroyProtectionReasonForType(rawType: unknown, options: ResolveOptions = {}): string | null {
    const type = normalizeSpecialStoneType(rawType);
    if (!type) return null;
    if (type === 'GUARD') return options.ignoreGuard === true ? null : 'guard_protected';
    if (type === 'ABSOLUTE_PROTECTED') return 'absolute_protected';

    const info = getSpecialStoneInfo(options.SpecialStoneRegistry, type);
    if (info && info.destroyProtected === true) return 'destroy_protected';
    return null;
}

function resolveDestroyProtectionAt(cardState: any, row: number, col: number, options: ResolveOptions = {}) {
    const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
    for (const marker of markers) {
        if (!isSpecialMarkerAt(marker, row, col, options)) continue;
        const type = normalizeSpecialStoneType(marker && marker.data && marker.data.type);
        const reason = getDestroyProtectionReasonForType(type, options);
        if (reason) {
            return {
                marker,
                type,
                reason
            };
        }
    }
    return null;
}

export = {
    normalizeSpecialStoneType,
    getDestroyProtectionReasonForType,
    resolveDestroyProtectionAt
};
```

- [ ] **Step 2: Add the checked-in CommonJS wrapper**

Create `game/logic/cards-internal/destroy-protection-context.js`:

```javascript
'use strict';

module.exports = require('../../../dist/game/logic/cards-internal/destroy-protection-context');
```

- [ ] **Step 3: Run the helper test again**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.destroy-protection-context.test.ts
```

Expected: the helper unit tests pass, and the BoardOps tests still fail until `board_ops.ts` delegates to the helper.

## Task 3: Delegate BoardOps Destroy Protection to the Helper

**Files:**
- Modify: `game/logic/board_ops.ts`
- Test: `test/game.destroy-protection-context.test.ts`

- [ ] **Step 1: Add a local module accessor near the existing registry accessors**

In `game/logic/board_ops.ts`, after `getManifestStoneRegistryModule()`, add:

```typescript
function getDestroyProtectionContextModule(): any {
    return safeRequire('./cards-internal/destroy-protection-context') || getRuntimeGlobalValue('DestroyProtectionContext');
}
```

- [ ] **Step 2: Replace the local GUARD marker scan in `_destroyAtCore`**

In `_destroyAtCore`, keep the absolute-protection check first:

```typescript
if (_isAbsoluteProtectedCell(cardState, row, col)) return { destroyed: false, reason: 'absolute_protected' };
```

Then replace the existing `guardMarker` block with:

```typescript
const ignoreGuard = !!(meta && meta.ignoreGuard === true);
const ignoreRegen = !!(meta && meta.ignoreRegen === true);
const destroyProtectionContext = getDestroyProtectionContextModule();
if (destroyProtectionContext && typeof destroyProtectionContext.resolveDestroyProtectionAt === 'function') {
    const protection = destroyProtectionContext.resolveDestroyProtectionAt(cardState, row, col, {
        SpecialStoneRegistry: getSpecialStoneRegistryModule(),
        markerKinds: MARKER_KINDS,
        ignoreGuard
    });
    if (protection && protection.reason) {
        return { destroyed: false, reason: protection.reason };
    }
}
```

Remove the old local `const cardMarkers = getCardMarkersModule();`, `const guardMarker = ...`, and `if (guardMarker && !ignoreGuard)` block from `_destroyAtCore`. Do not remove `getCardMarkersModule()` from the file because other board operations still use it.

- [ ] **Step 3: Run the focused BoardOps/helper test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.destroy-protection-context.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run existing absolute protection regression**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.absolute-protect-next-stone.test.ts
```

Expected: PASS. `ABSOLUTE_PROTECTED` still returns `absolute_protected`.

- [ ] **Step 5: Commit the headless preparation unit if the working tree is isolated**

Run:

```powershell
git status --short
git add game/logic/cards-internal/destroy-protection-context.ts game/logic/cards-internal/destroy-protection-context.js game/logic/board_ops.ts test/game.destroy-protection-context.test.ts
git commit -m "refactor: centralize destroy protection lookup"
```

Expected: commit succeeds only with files from Tasks 1-3 staged. If unrelated dirty files remain, do not commit and report the exact conflicting files.

## Task 4: Add Reusable Destroy-Protection Timer UI Hooks

**Files:**
- Modify: `ui/diff-renderer/special-marker-renderer.ts`
- Modify: `test/ui.diff-renderer.special-marker-renderer.test.ts`
- Modify: `styles-board.css`

- [ ] **Step 1: Extend the marker renderer test**

In `test/ui.diff-renderer.special-marker-renderer.test.ts`, update the test named `creates blockade seed bonus timed guard and freeze labels` so it also checks the new destroy-protection label:

```typescript
    const destroyProtection = renderer.createDestroyProtectionTimerLabel(8);
    expect(destroyProtection.className).toContain('stone-timer');
    expect(destroyProtection.className).toContain('stone-destroy-protection-timer');
    expect(destroyProtection.textContent).toBe('8');
```

Update the final `applied.map(...)` expectation in the same test to:

```typescript
    expect(applied.map((one) => one.className)).toEqual([
      'seed-turn countdown-timer',
      'stone-timer flip-evade-timer',
      'guard-timer',
      'stone-timer stone-destroy-protection-timer'
    ]);
```

- [ ] **Step 2: Run the renderer test to verify it fails**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.diff-renderer.special-marker-renderer.test.ts
```

Expected: FAIL because `createDestroyProtectionTimerLabel` is not a function.

- [ ] **Step 3: Add the reusable renderer functions**

In `ui/diff-renderer/special-marker-renderer.ts`, after `createGuardTimerLabel`, add:

```typescript
  function createStoneStatusTimerLabel(className: string, value: any) {
    const normalizedClassName = String(className || '').trim() || 'special-timer';
    const classes = normalizedClassName.split(/\s+/).filter(Boolean);
    const fullClassName = classes.includes('stone-timer')
      ? normalizedClassName
      : `stone-timer ${normalizedClassName}`;
    return createTimedMarkerLabel(fullClassName, value);
  }

  function createDestroyProtectionTimerLabel(value: any) {
    return createStoneStatusTimerLabel('stone-destroy-protection-timer', value);
  }
```

In the returned object, add both functions:

```typescript
    createStoneStatusTimerLabel,
    createDestroyProtectionTimerLabel,
```

- [ ] **Step 4: Add reserved CSS for the destroy-protection timer**

In `styles-board.css`, after the `.guard-timer.timer-double-digit` block, add:

```css
.stone-destroy-protection-timer {
    top: calc(3px * var(--layout-stage-scale));
    left: calc(3px * var(--layout-stage-scale));
    bottom: auto;
    transform: none;
    color: #fff8da;
    background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0) 48%),
        rgba(92, 72, 26, 0.92);
    border: var(--layout-size-border-thin) solid rgba(255, 218, 118, 0.78);
    border-radius: calc(3px * var(--layout-stage-scale));
    box-shadow:
        0 0 4px rgba(0, 0, 0, 0.52),
        inset 0 1px 1px rgba(255, 255, 255, 0.28);
    z-index: 75;
}

.stone-destroy-protection-timer.timer-double-digit {
    min-width: calc(20px * var(--layout-stage-scale));
    font-size: calc(9px * var(--layout-stage-scale));
}
```

This CSS is inert until a caller appends an element with `.stone-destroy-protection-timer`.

- [ ] **Step 5: Run the renderer test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.diff-renderer.special-marker-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the UI hook unit if the working tree is isolated**

Run:

```powershell
git status --short
git add ui/diff-renderer/special-marker-renderer.ts test/ui.diff-renderer.special-marker-renderer.test.ts styles-board.css
git commit -m "refactor: prepare destroy protection timer UI"
```

Expected: commit succeeds only with files from Task 4 staged. If unrelated dirty files remain, do not commit and report the exact conflicting files.

## Task 5: Document the Destroy-Protection Contract

**Files:**
- Modify: `docs/architecture-contracts.md`

- [ ] **Step 1: Add a destroy-protection context section**

In `docs/architecture-contracts.md`, after section `10.1 Flip-protection context`, add:

```markdown
### 10.2 Destroy-protection context

`shared/special-stone-registry.ts` is the source of truth for special-stone destroy protection.
Core destruction paths must resolve marker-level destroy protection through `game/logic/cards-internal/destroy-protection-context.ts` or a wrapper that delegates to it.

Do not add local hand-written lists of destroy-protected special-stone types in `game/logic/board_ops.ts`, card effect modules, target resolvers, CPU helpers, worker logic, or UI presentation.

`GUARD` keeps its existing `guard_protected` reason and remains bypassable only by explicit `ignoreGuard` metadata. Other registry-backed `destroyProtected` statuses must not become bypassable through `ignoreGuard` unless their rulebook entry says so.

When adding a new destroy-protected stone status:

- set `destroyProtected: true` in `shared/special-stone-registry.ts`
- classify the status through the registry instead of adding a local BoardOps branch
- cover the blocker with registry-wide tests and one focused destruction regression
- keep cell removal, holes, movement, ownership changes, and non-destroy effects outside this protection unless the rulebook explicitly says otherwise
```

- [ ] **Step 2: Run a focused text check**

Run:

```powershell
rg -n "Destroy-protection context|destroy-protection-context|ignoreGuard" docs/architecture-contracts.md game/logic/board_ops.ts game/logic/cards-internal/destroy-protection-context.ts
```

Expected: output includes the new architecture section, the BoardOps helper call, and the helper source.

- [ ] **Step 3: Commit the architecture note if the working tree is isolated**

Run:

```powershell
git status --short
git add docs/architecture-contracts.md
git commit -m "docs: document destroy protection contract"
```

Expected: commit succeeds only with `docs/architecture-contracts.md` staged. If unrelated dirty files remain, do not commit and report the exact conflicting files.

## Task 6: Final Verification

**Files:**
- No new files.

- [ ] **Step 1: Run the focused test bundle**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.destroy-protection-context.test.ts test/game.absolute-protect-next-stone.test.ts test/ui.diff-renderer.special-marker-renderer.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run build:ts because a new `.ts` helper was added under `game/logic/cards-internal`**

Run:

```powershell
npm run build:ts
```

Expected: PASS and `dist/game/logic/cards-internal/destroy-protection-context.js` is produced by the build. Do not stage `dist/` unless repo policy for this checkout requires it and the user explicitly approves generated output staging.

- [ ] **Step 4: Confirm no generated or mirror files were edited**

Run:

```powershell
git status --short
```

Expected for this plan's work: only the files listed in the File Map are changed, or no changes remain because the task commits were created. `worker-public/`, generated card catalogs, and `public/module-registry.js` must not be part of this preparation pass.

## Self-Review Checklist

- [ ] The plan keeps `game/` headless and avoids DOM, sound, timers, UI state, and network clients in core logic.
- [ ] Existing `GUARD` destroy blocking still returns `guard_protected`.
- [ ] Existing `ignoreGuard` metadata bypasses only `GUARD`.
- [ ] `ABSOLUTE_PROTECTED` still returns `absolute_protected`.
- [ ] The UI helper and CSS do not render anything until a card implementation appends the new timer label.
- [ ] No `硬い意志` catalog, rulebook, pending-selection, CPU, generated catalog, or worker mirror change is included.
- [ ] All task commits, if created, stage only files owned by the task.

## Execution Handoff

Plan complete when this file is saved. Two execution options:

**1. Subagent-Driven (recommended)** - Dispatch a fresh subagent per task, review between tasks, fastest isolated iteration.

**2. Inline Execution** - Execute tasks in this session using executing-plans, batching commands with review checkpoints.

Before either path, resolve or explicitly approve the existing unrelated dirty checkout state.
