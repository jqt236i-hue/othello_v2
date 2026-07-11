# Flip Protection Context Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated hand-written flip-protection type lists so normal-flip-like effects, target lookup, and regen fallback all derive flip protection from `shared/special-stone-registry.ts`.

**Architecture:** Add one pure `game/logic/cards-internal/protection-context.ts` helper that receives `SpecialStoneRegistry`, constants, and marker accessors through explicit deps. `game/cards/effect-resolver.ts`, `game/cards/target-resolver.ts`, and `game/logic/cards/regen.ts` will call that helper through their existing module/dependency boundaries. The helper must not read `globalThis`, `self`, `window`, DOM, sound, timers, or network clients.

**Tech Stack:** TypeScript/CommonJS-compatible modules, checked-in `.js` wrapper for the new source module, Jest, `npm run typecheck`, `npm run build:ts`, and focused registry-wide smoke checks.

---

## Strict Review Corrections

The first draft had defects that this revision fixes:

- Do not put runtime global lookup in the new helper. `game/logic/cards-internal/AGENTS.md` prefers pure helpers and explicit deps over hidden globals.
- Add the checked-in `.js` wrapper for the new `.ts` module. Other `cards-internal` modules have this wrapper pattern, and root source `require()` paths depend on it outside ts-jest.
- Do not hard-code a `FLIP_PROTECTED_TYPES` test list. Tests must enumerate `shared/special-stone-registry.ts` so future `flipProtected` additions are covered automatically.
- Keep `PROTECTED` shape-compatible: it remains in `protectedStones`; registry-backed permanent flip blockers, except `PROTECTED`, go in `permaProtectedStones`.
- Preserve `regen` fallback behavior for `ULTIMATE_HYPERACTIVE` as an explicit extra protected marker predicate. It is not a `flipProtected` registry trait.
- Do not add manifest handling to `target-resolver` as an accidental behavior change. `effect-resolver` keeps manifest context; `target-resolver` passes an empty manifest accessor unless a separate rule decision is made.
- Fail loudly when the shared registry is unavailable instead of silently returning an empty protection context.

## Current Structural Problems

- `shared/special-stone-registry.ts` is the source that knows `flipProtected: true`, but callers still have local `s.data.type === '...'` lists.
- `game/cards/effect-resolver.ts` and `game/cards/target-resolver.ts` independently build similar context objects.
- `game/logic/cards/regen.ts` has a fallback context used by `BoardOps.destroyAt` paths where `CardLogic.getCardContext` is not injected.
- The prior `METEOR_GOD` bug happened because a duplicated list drifted.

This cleanup is intended to be behavior-preserving. Do not edit `01-rulebook.md` or `正本/` unless implementation discovers that the intended player-visible rule is unclear or changing.

## Working Tree Prerequisite

Do not start implementation in the current dirty checkout unless unrelated changes are resolved or explicitly approved.

At plan revision time, unrelated dirty areas included `01-rulebook.md`, UI/style/sound/help files, `worker-public/`, deleted `artifacts/`, and hand-card-swipe files. A worker executing this plan must start with:

```powershell
git status --short
```

Expected before implementation: either a clean worktree, or only files intentionally owned by the current pass.

## File Map

- Create: `game/logic/cards-internal/protection-context.ts`
  - Pure helper for `protectedStones`, `absoluteProtectedStones`, `permaProtectedStones`, `bombs`, and `blockedCells`.
  - Accepts `SpecialStoneRegistry`, `ManifestStoneRegistry`, constants, marker accessors, and optional extra marker predicates through deps.
  - Contains no runtime global lookup.
- Create: `game/logic/cards-internal/protection-context.js`
  - Standard root wrapper over `.ts` in Jest and `dist/` otherwise.
- Create: `test/game.protection-context.test.ts`
  - Direct characterization tests for registry-backed context construction.
- Modify: `game/cards/effect-resolver.ts`
  - Delegates `getCardContext` to the shared helper.
  - Passes existing manifest, bomb, blocking, and frozen-cell deps.
- Modify: `game/cards/target-resolver.ts`
  - Delegates its local `getCardContext` to the shared helper.
  - Passes no manifest accessor to preserve current target behavior.
- Modify: `game/logic/cards/regen.ts`
  - Keeps injected `deps.getCardContext` as the preferred path.
  - Uses the shared helper only for fallback context and passes the existing `SpecialStoneRegistryModule`.
- Modify: `test/game.reverse-will.test.ts`
  - Expands target regression by enumerating current registry `flipProtected` types.
- Modify: `test/game.regen.consume-visual.test.ts`
  - Expands destroy-triggered regen capture regression by enumerating current registry `flipProtected` types.
- Modify: `docs/architecture-contracts.md`
  - Documents that card protection context must derive flip protection from the registry, not local type lists.

## Task 1: Add Characterization Tests for the Shared Helper

**Files:**
- Create: `test/game.protection-context.test.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `test/game.protection-context.test.ts`:

```typescript
const Shared = require('../shared-constants.js');
const SpecialStoneRegistry = require('../shared/special-stone-registry.js');
const ManifestStoneRegistry = require('../shared/manifest-stone-registry.js');
const ProtectionContext = require('../game/logic/cards-internal/protection-context');

function marker(type: string, row: number, col: number, owner: 'black' | 'white' = 'white', data: any = {}) {
  return {
    id: `${type}-${row}-${col}`,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: { type, ...data }
  };
}

function registryFlipProtectedTypes(): string[] {
  return Object.entries(SpecialStoneRegistry.SPECIAL_STONE_REGISTRY || {})
    .filter(([, info]: any) => info && info.flipProtected === true)
    .map(([type]) => String(type));
}

function build(cardState: any, extraDeps: any = {}) {
  return ProtectionContext.buildCardProtectionContext(cardState, {
    constants: Shared,
    SpecialStoneRegistry,
    ManifestStoneRegistry,
    ...extraDeps
  });
}

describe('card protection context', () => {
  test('derives flip-blocking context from the shared special stone registry', () => {
    const protectedTypes = registryFlipProtectedTypes();
    expect(protectedTypes).toEqual(expect.arrayContaining([
      'PROTECTED',
      'METEOR_GOD',
      'LIGHTNING',
      'STONE_SALVATION_GOD'
    ]));

    const markers = protectedTypes.map((type, index) => (
      marker(type, Math.floor(index / 8), index % 8, 'white', { remainingOwnerTurns: 6 })
    ));
    markers.push(marker('REGEN', 7, 6, 'black', { regenRemaining: 2 }));
    markers.push(marker('ULTIMATE_HYPERACTIVE', 7, 7, 'black', { remainingOwnerTurns: 6 }));

    const context = build({ markers });

    expect(context.protectedStones).toEqual([
      expect.objectContaining({ row: 0, col: 0, owner: 'white' })
    ]);
    expect(context.permaProtectedStones).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 0, col: 0 })
    ]));

    for (const type of protectedTypes.filter((entry) => entry !== 'PROTECTED')) {
      const original = markers.find((entry) => entry.data.type === type);
      expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
        { row: original.row, col: original.col, owner: Shared.WHITE }
      ]));
    }
    expect(context.permaProtectedStones).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 7, col: 6 }),
      expect.objectContaining({ row: 7, col: 7 })
    ]));
  });

  test('keeps frozen/blocking context explicit and separate from registry flip protection', () => {
    const cardState = {
      markers: [
        marker('FREEZE', 3, 4, 'white', { remainingOwnerTurns: 5 }),
        marker('BLOCKADE', 2, 2, 'black', { remainingOwnerTurns: 3 }),
        marker('METEOR_HOLE', 5, 5, 'black', { remainingOwnerTurns: 4 })
      ]
    };

    const context = build(cardState, {
      getBlockingMarkers: (state: any) => state.markers.filter((entry: any) => (
        ['FREEZE', 'BLOCKADE', 'METEOR_HOLE'].includes(entry.data.type)
      )),
      isFrozenCellForCard: (_state: any, row: number, col: number) => row === 3 && col === 4
    });

    expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
      { row: 3, col: 4, owner: Shared.WHITE }
    ]));
    expect(context.blockedCells).toEqual([
      { row: 3, col: 4, type: 'FREEZE', remainingOwnerTurns: 5, owner: 'white' },
      { row: 2, col: 2, type: 'BLOCKADE', remainingOwnerTurns: 3, owner: 'black' },
      { row: 5, col: 5, type: 'METEOR_HOLE', remainingOwnerTurns: 4, owner: 'black' }
    ]);
  });

  test('carries bomb and manifest context when the caller supplies manifest markers', () => {
    const bomb = marker('TIME_BOMB', 5, 5, 'black', { category: 'bomb', remainingTurns: 2, placedTurn: 7 });
    const manifest = {
      id: 'manifest-observer',
      kind: 'manifestStone',
      row: 6,
      col: 6,
      owner: 'black',
      data: { type: 'OBSERVER_WILL' }
    };
    const cardState = { markers: [bomb, manifest] };

    const context = build(cardState, {
      getSpecialMarkers: (state: any) => state.markers.filter((entry: any) => entry.kind === 'specialStone'),
      getManifestMarkers: (state: any) => state.markers.filter((entry: any) => entry.kind === 'manifestStone'),
      getBombMarkers: (state: any) => state.markers.filter((entry: any) => entry.data && entry.data.category === 'bomb')
    });

    expect(context.absoluteProtectedStones).toEqual(expect.arrayContaining([
      { row: 6, col: 6, owner: Shared.BLACK }
    ]));
    expect(context.permaProtectedStones).toEqual(expect.arrayContaining([
      { row: 6, col: 6, owner: Shared.BLACK }
    ]));
    expect(context.bombs).toEqual([
      expect.objectContaining({ row: 5, col: 5, owner: 'black', remainingTurns: 2, placedTurn: 7 })
    ]);
  });

  test('requires the shared special stone registry instead of silently degrading', () => {
    expect(() => ProtectionContext.buildCardProtectionContext({ markers: [] }, { constants: Shared }))
      .toThrow('[protection-context] SpecialStoneRegistry.getSpecialStoneInfo required');
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.protection-context.test.ts
```

Expected: FAIL because `../game/logic/cards-internal/protection-context` does not exist.

- [ ] **Step 3: Commit nothing**

Do not commit after a RED-only test. Continue directly to Task 2.

## Task 2: Implement the Pure Protection Context Helper

**Files:**
- Create: `game/logic/cards-internal/protection-context.ts`
- Create: `game/logic/cards-internal/protection-context.js`
- Test: `test/game.protection-context.test.ts`

- [ ] **Step 1: Add the helper module**

Create `game/logic/cards-internal/protection-context.ts`:

```typescript
type Marker = {
    kind?: string;
    row?: number;
    col?: number;
    owner?: unknown;
    data?: Record<string, unknown> | null;
    createdSeq?: unknown;
};

type ConstantsLike = {
    BLACK?: unknown;
    WHITE?: unknown;
};

type SpecialStoneRegistryLike = {
    getSpecialStoneInfo(rawType: unknown): { flipProtected?: boolean } | null;
    isAbsoluteProtectedSpecialType?(rawType: unknown): boolean;
    normalizeSpecialStoneType?(rawType: unknown): string | null;
};

type ManifestStoneRegistryLike = {
    isManifestStoneType?(rawType: unknown): boolean;
};

type ProtectionContextDeps = {
    constants?: ConstantsLike;
    SpecialStoneRegistry?: SpecialStoneRegistryLike | null;
    ManifestStoneRegistry?: ManifestStoneRegistryLike | null;
    getSpecialMarkers?(cardState: unknown): Marker[];
    getManifestMarkers?(cardState: unknown): Marker[];
    getBombMarkers?(cardState: unknown): Marker[];
    getBlockingMarkers?(cardState: unknown): Marker[];
    isFrozenCellForCard?(cardState: unknown, row: number, col: number): boolean;
    isAdditionalPermaProtectedMarker?(marker: Marker, cardState: unknown): boolean;
};

function requireSpecialStoneRegistry(deps: ProtectionContextDeps): SpecialStoneRegistryLike {
    const registry = deps && deps.SpecialStoneRegistry;
    if (!registry || typeof registry.getSpecialStoneInfo !== 'function') {
        throw new Error('[protection-context] SpecialStoneRegistry.getSpecialStoneInfo required');
    }
    return registry;
}

function toNumberOrFallback(value: unknown, fallback: number): number {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : fallback;
}

function ownerValue(owner: unknown, constants: ConstantsLike = {}): unknown {
    const black = toNumberOrFallback(constants.BLACK, 1);
    const white = toNumberOrFallback(constants.WHITE, -1);
    if (owner === 'black' || Number(owner) === black) return black;
    if (owner === 'white' || Number(owner) === white) return white;
    return owner;
}

function normalizeMarkerType(marker: Marker, registry?: SpecialStoneRegistryLike): string {
    const rawType = marker && marker.data ? marker.data.type : null;
    if (registry && typeof registry.normalizeSpecialStoneType === 'function') {
        const normalized = registry.normalizeSpecialStoneType(rawType);
        return normalized ? String(normalized) : '';
    }
    return String(rawType || '').trim().toUpperCase();
}

function isManifestStoneType(rawType: unknown, manifestRegistry?: ManifestStoneRegistryLike | null): boolean {
    if (manifestRegistry && typeof manifestRegistry.isManifestStoneType === 'function') {
        return manifestRegistry.isManifestStoneType(rawType) === true;
    }
    const type = String(rawType || '').trim().toUpperCase();
    return type === 'THEORY_INCARNATION' || type === 'BOARD_EXECUTOR' || type === 'OBSERVER_WILL';
}

function defaultSpecialMarkers(cardState: any): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => entry && entry.kind === 'specialStone')
        : [];
}

function defaultManifestMarkers(cardState: any, manifestRegistry?: ManifestStoneRegistryLike | null): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => (
            entry &&
            (entry.kind === 'manifestStone' || entry.kind === 'specialStone') &&
            entry.data &&
            isManifestStoneType(entry.data.type, manifestRegistry)
        ))
        : [];
}

function defaultBombMarkers(cardState: any): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => entry && entry.data && entry.data.category === 'bomb')
        : [];
}

function defaultBlockingMarkers(cardState: any, registry: SpecialStoneRegistryLike): Marker[] {
    return cardState && Array.isArray(cardState.markers)
        ? cardState.markers.filter((entry: Marker) => {
            const type = normalizeMarkerType(entry, registry);
            return entry && entry.kind === 'specialStone' && (
                type === 'BLOCKADE' ||
                type === 'METEOR_HOLE' ||
                type === 'FREEZE'
            );
        })
        : [];
}

function isRegistryFlipProtectedMarker(marker: Marker, registry: SpecialStoneRegistryLike): boolean {
    const type = normalizeMarkerType(marker, registry);
    if (!type || type === 'PROTECTED') return false;
    const info = registry.getSpecialStoneInfo(type);
    return !!(info && info.flipProtected === true);
}

function isAbsoluteProtectedMarker(marker: Marker, registry: SpecialStoneRegistryLike): boolean {
    const type = normalizeMarkerType(marker, registry);
    if (registry && typeof registry.isAbsoluteProtectedSpecialType === 'function') {
        return registry.isAbsoluteProtectedSpecialType(type) === true;
    }
    return type === 'ABSOLUTE_PROTECTED';
}

function mapPosition(marker: Marker) {
    return { row: marker.row, col: marker.col, owner: marker.owner };
}

function mapOwnerPosition(marker: Marker, constants: ConstantsLike) {
    return { row: marker.row, col: marker.col, owner: ownerValue(marker.owner, constants) };
}

function buildCardProtectionContext(cardState: unknown, deps: ProtectionContextDeps = {}) {
    const registry = requireSpecialStoneRegistry(deps);
    const constants = deps.constants || {};
    const manifestRegistry = deps.ManifestStoneRegistry || null;
    const getSpecialMarkers = typeof deps.getSpecialMarkers === 'function'
        ? deps.getSpecialMarkers
        : defaultSpecialMarkers;
    const getManifestMarkers = typeof deps.getManifestMarkers === 'function'
        ? deps.getManifestMarkers
        : ((state: unknown) => defaultManifestMarkers(state, manifestRegistry));
    const getBombMarkers = typeof deps.getBombMarkers === 'function'
        ? deps.getBombMarkers
        : defaultBombMarkers;
    const getBlockingMarkers = typeof deps.getBlockingMarkers === 'function'
        ? deps.getBlockingMarkers
        : ((state: unknown) => defaultBlockingMarkers(state, registry));

    const specials = getSpecialMarkers(cardState) || [];
    const manifests = getManifestMarkers(cardState) || [];

    const protectedStones = specials
        .filter((entry) => normalizeMarkerType(entry, registry) === 'PROTECTED')
        .map(mapPosition);

    const absoluteProtectedStones = specials
        .filter((entry) => isAbsoluteProtectedMarker(entry, registry))
        .concat(manifests)
        .map((entry) => mapOwnerPosition(entry, constants));

    const permaProtectedStones = specials
        .filter((entry) => {
            if (!entry || !entry.data) return false;
            const type = normalizeMarkerType(entry, registry);
            if (isRegistryFlipProtectedMarker(entry, registry)) return true;
            if (type === 'FREEZE') return true;
            if (
                typeof deps.isFrozenCellForCard === 'function' &&
                typeof entry.row === 'number' &&
                typeof entry.col === 'number' &&
                deps.isFrozenCellForCard(cardState, entry.row, entry.col)
            ) {
                return true;
            }
            if (typeof deps.isAdditionalPermaProtectedMarker === 'function') {
                return deps.isAdditionalPermaProtectedMarker(entry, cardState) === true;
            }
            return false;
        })
        .concat(manifests)
        .map((entry) => mapOwnerPosition(entry, constants));

    const bombs = getBombMarkers(cardState).map((entry) => ({
        row: entry.row,
        col: entry.col,
        remainingTurns: entry.data ? entry.data.remainingTurns : undefined,
        owner: entry.owner,
        placedTurn: entry.data ? entry.data.placedTurn : undefined,
        createdSeq: entry.createdSeq
    }));

    const blockedCells = getBlockingMarkers(cardState).map((entry) => ({
        row: entry.row,
        col: entry.col,
        type: entry.data ? entry.data.type : null,
        remainingOwnerTurns: entry.data ? entry.data.remainingOwnerTurns : undefined,
        owner: entry.owner
    }));

    return {
        protectedStones,
        absoluteProtectedStones,
        permaProtectedStones,
        bombs,
        blockedCells
    };
}

export = {
    buildCardProtectionContext,
    isRegistryFlipProtectedMarker,
    normalizeMarkerType
};
```

- [ ] **Step 2: Add the source wrapper**

Create `game/logic/cards-internal/protection-context.js`:

```javascript
module.exports = process.env.JEST_WORKER_ID && typeof globalThis.expect === 'function'
    ? require('./protection-context.ts')
    : require('../../../dist/game/logic/cards-internal/protection-context');
```

- [ ] **Step 3: Run helper tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.protection-context.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript verification**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit Task 2**

Run:

```powershell
git add -- game/logic/cards-internal/protection-context.ts game/logic/cards-internal/protection-context.js test/game.protection-context.test.ts
git commit -m "Add shared card protection context"
```

Expected: commit includes only the helper, wrapper, and helper tests.

## Task 3: Move `effect-resolver` Context to the Helper

**Files:**
- Modify: `game/cards/effect-resolver.ts`
- Test: `test/game.protection-context.test.ts`

- [ ] **Step 1: Add module loads**

In `game/cards/effect-resolver.ts`, near the existing module constants, add:

```typescript
const SpecialStoneRegistry = loadRuntimeModule('../../shared/special-stone-registry', 'SpecialStoneRegistry', null);
const CardProtectionContext = loadRuntimeModule('../logic/cards-internal/protection-context', 'CardProtectionContext', null);
```

Keep the existing `ManifestStoneRegistry` constant. Remove the local `isManifestStoneType` helper only if it becomes unused.

- [ ] **Step 2: Replace `getCardContext` implementation**

Replace the body of `getCardContext(cardState, deps)` with:

```typescript
function getCardContext(cardState: any, deps: any) {
  if (!CardProtectionContext || typeof CardProtectionContext.buildCardProtectionContext !== 'function') {
    throw new Error('[effect-resolver] CardProtectionContext.buildCardProtectionContext not available');
  }
  if (!SpecialStoneRegistry || typeof SpecialStoneRegistry.getSpecialStoneInfo !== 'function') {
    throw new Error('[effect-resolver] SpecialStoneRegistry.getSpecialStoneInfo not available');
  }
  const {
    getSpecialMarkers,
    getManifestMarkers,
    getBombMarkers,
    getBlockingMarkers,
    isFrozenCellForCard
  } = deps || {};
  return CardProtectionContext.buildCardProtectionContext(cardState, {
    constants: SharedConstants,
    SpecialStoneRegistry,
    ManifestStoneRegistry,
    getSpecialMarkers,
    getManifestMarkers,
    getBombMarkers,
    getBlockingMarkers,
    isFrozenCellForCard
  });
}
```

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.protection-context.test.ts test/game.reverse-will.test.ts test/game.regen.consume-visual.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run TypeScript verification**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit Task 3**

Run:

```powershell
git add -- game/cards/effect-resolver.ts
git commit -m "Use shared protection context in effect resolver"
```

Expected: one-file commit.

## Task 4: Move `target-resolver` Context to the Helper

**Files:**
- Modify: `game/cards/target-resolver.ts`
- Modify: `test/game.reverse-will.test.ts`

- [ ] **Step 1: Expand reverse target regression using the registry**

In `test/game.reverse-will.test.ts`, add this helper near the existing imports:

```typescript
const SpecialStoneRegistry = require('../shared/special-stone-registry.js');

function registryFlipProtectedTypes(): string[] {
  return Object.entries(SpecialStoneRegistry.SPECIAL_STONE_REGISTRY || {})
    .filter(([, info]: any) => info && info.flipProtected === true)
    .map(([type]) => String(type));
}
```

Replace the single `METEOR_GOD` target regression with:

```typescript
test.each(registryFlipProtectedTypes())('does not list reverse targets through %s', (specialType) => {
  const { cardState, gameState } = makeState();
  gameState.board[3][3] = Shared.BLACK;
  gameState.board[3][4] = Shared.WHITE;
  gameState.board[3][5] = Shared.BLACK;
  cardState.markers.push({
    id: `${specialType}-protected`,
    kind: 'specialStone',
    row: 3,
    col: 4,
    owner: 'white',
    data: { type: specialType, remainingOwnerTurns: 6 }
  });

  const targets = CardLogic.getReverseWillTargets(cardState, gameState);

  expect(targets).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ row: 3, col: 3 })
  ]));
  expect(targets).not.toEqual(expect.arrayContaining([
    expect.objectContaining({ row: 3, col: 5 })
  ]));
});
```

- [ ] **Step 2: Run the expanded target test before refactoring**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.reverse-will.test.ts
```

Expected: PASS with the current temporary `SpecialStoneRegistry` target fix. If it fails, stop and investigate before refactoring.

- [ ] **Step 3: Add the helper module load**

In `game/cards/target-resolver.ts`, keep the existing `SpecialStoneRegistry` module load and add:

```typescript
const CardProtectionContext = loadRuntimeModule('../logic/cards-internal/protection-context', 'CardProtectionContext');
```

- [ ] **Step 4: Replace target resolver context construction**

Replace the body of local `getCardContext(cardState)` with:

```typescript
    function getCardContext(cardState: any) {
        if (!CardProtectionContext || typeof CardProtectionContext.buildCardProtectionContext !== 'function') {
            throw new Error('[target-resolver] CardProtectionContext.buildCardProtectionContext not available');
        }
        if (!SpecialStoneRegistry || typeof SpecialStoneRegistry.getSpecialStoneInfo !== 'function') {
            throw new Error('[target-resolver] SpecialStoneRegistry.getSpecialStoneInfo not available');
        }
        return CardProtectionContext.buildCardProtectionContext(cardState, {
            constants: SharedConstants,
            SpecialStoneRegistry,
            getSpecialMarkers,
            getManifestMarkers: () => [],
            getBombMarkers: () => [],
            getBlockingMarkers: (state: any) => {
                const specials = getSpecialMarkers(state);
                return specials.filter((entry: any) => {
                    const type = String(entry && entry.data && entry.data.type || '').toUpperCase();
                    return type === 'BLOCKADE' || type === 'METEOR_HOLE' || type === 'FREEZE';
                });
            }
        });
    }
```

The explicit `getManifestMarkers: () => []` preserves current `target-resolver` behavior. Do not broaden reverse-target filtering to manifest stones in this task.

- [ ] **Step 5: Run target tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.reverse-will.test.ts test/game.protection-context.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run TypeScript verification**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 7: Commit Task 4**

Run:

```powershell
git add -- game/cards/target-resolver.ts test/game.reverse-will.test.ts
git commit -m "Use shared protection context in target resolver"
```

Expected: commit includes only target resolver and reverse-will tests.

## Task 5: Move `regen` Fallback Context to the Helper

**Files:**
- Modify: `game/logic/cards/regen.ts`
- Modify: `test/game.regen.consume-visual.test.ts`

- [ ] **Step 1: Expand regen regression using the registry**

In `test/game.regen.consume-visual.test.ts`, add this helper near the existing imports:

```typescript
const SpecialStoneRegistry = require('../shared/special-stone-registry.js');

function registryFlipProtectedTypes(): string[] {
  return Object.entries(SpecialStoneRegistry.SPECIAL_STONE_REGISTRY || {})
    .filter(([, info]: any) => info && info.flipProtected === true)
    .map(([type]) => String(type));
}
```

Add this test:

```typescript
test.each(registryFlipProtectedTypes())('destroy-triggered regen capture does not flip through %s', (specialType) => {
  const board = Array(8).fill(null).map(() => Array(8).fill(0));
  board[3][3] = Core.BLACK;
  board[3][4] = Core.WHITE;
  board[3][5] = Core.BLACK;

  const cardState = CardLogic.createCardState(createPrng());
  cardState.markers.push(
    {
      id: 'regen-direct',
      row: 3,
      col: 3,
      kind: 'specialStone',
      owner: 'black',
      createdSeq: 1,
      data: { type: 'REGEN', regenRemaining: 2, ownerColor: Core.BLACK }
    },
    {
      id: `${specialType}-protected`,
      row: 3,
      col: 4,
      kind: 'specialStone',
      owner: 'white',
      createdSeq: 2,
      data: { type: specialType, remainingOwnerTurns: 6 }
    }
  );

  const destroyed = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');

  expect(destroyed).toMatchObject({
    kind: 'regenerated',
    regenerated: true,
    captureFlips: []
  });
  expect(board[3][3]).toBe(Core.BLACK);
  expect(board[3][4]).toBe(Core.WHITE);
});
```

- [ ] **Step 2: Run the expanded regen test before refactoring**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.regen.consume-visual.test.ts
```

Expected: PASS with the current direct registry fallback. If it fails, stop and investigate before refactoring.

- [ ] **Step 3: Inject the helper into `regen` factory**

In `game/logic/cards/regen.ts`, change the factory calls so `ProtectionContextModule` is the fifth argument:

```typescript
return (root.CardRegen = factory(
    root.SharedConstants,
    root.SharedBoardUtils || null,
    root.CardMarkers || null,
    root.SpecialStoneRegistry || null,
    root.CardProtectionContext || null
));
```

In the CommonJS branch, require the helper:

```typescript
let ProtectionContextModule = null;
try {
    ProtectionContextModule = require('../cards-internal/protection-context');
} catch (e) { /* ignore */ }
```

Then pass it into `factory(...)`:

```typescript
return factory(
    require('../../../shared-constants'),
    require('../../../shared/shared-board-utils'),
    CardMarkersModule,
    SpecialStoneRegistryModule,
    ProtectionContextModule
);
```

Update the factory signature:

```typescript
}(typeof self !== 'undefined' ? self : this, function (
    SharedConstants: any,
    SharedBoardUtils: any,
    CardMarkersModule: any,
    SpecialStoneRegistryModule: any,
    ProtectionContextModule: any
) {
```

- [ ] **Step 4: Replace regen's local flip-protection fallback**

Remove `getSpecialStoneRegistryModule()` and `isFlipProtectedSpecialMarker()`.

Replace the `getCardContext` fallback inside `_getRegenCardContext(cardState, deps)` with:

```typescript
        const getCardContext = typeof deps.getCardContext === 'function'
            ? deps.getCardContext
            : null;
        const buildFallbackCardContext = () => {
            if (!ProtectionContextModule || typeof ProtectionContextModule.buildCardProtectionContext !== 'function') {
                throw new Error('[regen] CardProtectionContext.buildCardProtectionContext not available');
            }
            if (!SpecialStoneRegistryModule || typeof SpecialStoneRegistryModule.getSpecialStoneInfo !== 'function') {
                throw new Error('[regen] SpecialStoneRegistry.getSpecialStoneInfo not available');
            }
            return ProtectionContextModule.buildCardProtectionContext(cardState, {
                constants: SharedConstants,
                SpecialStoneRegistry: SpecialStoneRegistryModule,
                getManifestMarkers: () => [],
                getBombMarkers: () => [],
                isAdditionalPermaProtectedMarker(marker: any) {
                    if (!(marker && marker.data)) return false;
                    if (String(marker.data.type || '').toUpperCase() !== 'ULTIMATE_HYPERACTIVE') return false;
                    const remaining = Number(marker.data.remainingOwnerTurns);
                    return !Number.isFinite(remaining) || remaining > 0;
                }
            });
        };
```

Keep the existing `clearBombAt` block unchanged, then replace:

```typescript
        const context = getCardContext(cardState);
```

with:

```typescript
        const context = getCardContext ? getCardContext(cardState) : buildFallbackCardContext();
```

- [ ] **Step 5: Run regen tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.regen.consume-visual.test.ts test/game.protection-context.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run combined focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.protection-context.test.ts test/game.reverse-will.test.ts test/game.regen.consume-visual.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run TypeScript verification**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 8: Commit Task 5**

Run:

```powershell
git add -- game/logic/cards/regen.ts test/game.regen.consume-visual.test.ts
git commit -m "Use shared protection context for regen fallback"
```

Expected: commit includes only regen source and regen tests.

## Task 6: Remove Remaining Hand-Written Flip-Protection Lists

**Files:**
- Modify only runtime files found by the searches below.

- [ ] **Step 1: Search for stale production lists**

Run:

```powershell
rg -n "s\\.data\\.type === '(ABSOLUTE_PROTECTED|PERMA_PROTECTED|DRAGON|BREEDING|DESTROY_DRAGON|LIGHTNING|METEOR_GOD|GLUTTONOUS|ULTIMATE_DESTROY_GOD|GUARD|STONE_SALVATION_GOD)'|m\\.data\\.type === '(ABSOLUTE_PROTECTED|PERMA_PROTECTED|DRAGON|BREEDING|DESTROY_DRAGON|LIGHTNING|METEOR_GOD|GLUTTONOUS|ULTIMATE_DESTROY_GOD|GUARD|STONE_SALVATION_GOD)'|isFlipProtectedSpecialMarker|permaProtectedStones = specials|FLIP_PROTECTED_TYPES" game shared test -S
```

Expected after Tasks 3-5: no production duplicate list remains. Test references should either enumerate the registry or be unrelated.

- [ ] **Step 2: Replace any remaining duplicated runtime list**

If the search finds a runtime duplicate, replace it with one of these forms:

```typescript
CardProtectionContext.buildCardProtectionContext(cardState, {
  constants: SharedConstants,
  SpecialStoneRegistry,
  ManifestStoneRegistry,
  getSpecialMarkers,
  getManifestMarkers,
  getBombMarkers,
  getBlockingMarkers,
  isFrozenCellForCard
});
```

or, for a single marker predicate:

```typescript
const info = SpecialStoneRegistry.getSpecialStoneInfo(marker.data.type);
return !!(info && info.flipProtected === true);
```

Do not change `FREEZE`, `BLOCKADE`, `METEOR_HOLE`, ghost, manifest, absolute protection, complete protection, destroy protection, or evasion traits unless that code is already part of protection-context construction.

- [ ] **Step 3: Run focused tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.protection-context.test.ts test/game.reverse-will.test.ts test/game.regen.consume-visual.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit Task 6 if runtime changes were made**

Run:

```powershell
git add -- <only-files-edited-in-task-6>
git commit -m "Remove duplicate flip protection lists"
```

Expected: no commit if the search found no production duplicates.

## Task 7: Document the Internal Contract

**Files:**
- Modify: `docs/architecture-contracts.md`

- [ ] **Step 1: Add protection context contract**

In `docs/architecture-contracts.md`, under `## 10. Effect-resolution contracts`, add:

```markdown
### 10.1 Card protection context

Card flip-protection context must derive special-stone flip protection from `shared/special-stone-registry.ts` (`flipProtected: true`) rather than local hand-written type lists.

`game/logic/cards-internal/protection-context.ts` is the shared helper for `protectedStones`, `absoluteProtectedStones`, `permaProtectedStones`, `bombs`, and `blockedCells` context used by normal-flip-like card effects, target resolvers, and fallback card paths. It must receive registry and marker access dependencies explicitly; it must not discover `globalThis`, `self`, `window`, DOM, sound, timers, or network clients.

`PROTECTED` remains represented in `protectedStones` for compatibility. Other registry `flipProtected: true` markers are represented in `permaProtectedStones`. Frozen/blocking cells, manifest inviolability, ghost pass-through, destroy protection, and evasion traits are separate traits and must not be collapsed into registry flip protection without an explicit rule change.
```

- [ ] **Step 2: Run doc/source search**

Run:

```powershell
rg -n "hand-written type lists|flipProtected: true|protection-context|Card protection context|globalThis|self" docs/architecture-contracts.md game/logic/cards-internal/protection-context.ts game/cards/effect-resolver.ts game/cards/target-resolver.ts game/logic/cards/regen.ts -S
```

Expected:
- the new contract is discoverable
- `protection-context.ts` has no `globalThis` or `self`
- no stale instruction says to maintain local flip-protection lists

- [ ] **Step 3: Commit Task 7**

Run:

```powershell
git add -- docs/architecture-contracts.md
git commit -m "Document shared flip protection context"
```

Expected: docs-only commit.

## Task 8: Browser/Worker Surface Validation

**Files:**
- No source edits expected.
- Generated files may change only through approved scripts on a clean worktree.

- [ ] **Step 1: Run TypeScript checks**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Run focused Jest**

Run:

```powershell
npx jest --runInBand --runTestsByPath test/game.protection-context.test.ts test/game.reverse-will.test.ts test/game.regen.consume-visual.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run boundary check**

Run:

```powershell
npm run check:window
```

Expected: PASS. The new helper must not introduce new `globalThis`, `self`, `window`, DOM, sound, timer, or network dependencies into `game/logic/cards-internal/protection-context.ts`.

- [ ] **Step 4: Run browser build**

Run:

```powershell
npm run build:browser
```

Expected: exit 0. Review generated diffs before staging. Do not hand-edit `public/module-registry.js` or `dist/`.

- [ ] **Step 5: Run worker prepare only if generated browser assets changed**

Run only if browser/static assets require worker mirror sync:

```powershell
npm run worker:prepare
```

Expected: exit 0. Review `worker-public/` diffs and stage only generated mirror files from this pass.

- [ ] **Step 6: Commit generated/mirror sync if needed**

Run:

```powershell
git add -- public/module-registry.js worker-public/public/module-registry.js <other-generated-files-from-this-pass>
git commit -m "Sync protection context browser assets"
```

Expected: commit only generated outputs intentionally produced by build scripts. Skip this commit if no generated files changed.

## Task 9: Final Audit and Completion

**Files:**
- No planned edits.

- [ ] **Step 1: Run registry-wide smoke script**

Run:

```powershell
@'
const CardLogic = require('./game/logic/cards.js');
const Core = require('./game/logic/core.js');
const BoardOps = require('./game/logic/board_ops.js');
const Registry = require('./shared/special-stone-registry.js');
function createPrng() { return { shuffle: (arr) => arr, random: () => 0.5 }; }
const types = Object.entries(Registry.SPECIAL_STONE_REGISTRY || {})
  .filter(([, info]) => info && info.flipProtected === true)
  .map(([type]) => type);
const reverseFailures = [];
const regenFailures = [];
for (const type of types) {
  const board = Array(8).fill(null).map(() => Array(8).fill(0));
  board[3][3] = Core.BLACK;
  board[3][4] = Core.WHITE;
  board[3][5] = Core.BLACK;
  const cardState = CardLogic.createCardState(createPrng());
  cardState.markers.push({ id: `${type}-protected`, row: 3, col: 4, kind: 'specialStone', owner: 'white', createdSeq: 1, data: { type, remainingOwnerTurns: 6 } });
  const targets = CardLogic.getReverseWillTargets(cardState, { board }).filter(t => t.row === 3 && (t.col === 3 || t.col === 5));
  if (targets.length) reverseFailures.push({ type, targets });
}
for (const type of types) {
  const board = Array(8).fill(null).map(() => Array(8).fill(0));
  board[3][3] = Core.BLACK;
  board[3][4] = Core.WHITE;
  board[3][5] = Core.BLACK;
  const cardState = CardLogic.createCardState(createPrng());
  cardState.markers.push(
    { id: 'regen-direct', row: 3, col: 3, kind: 'specialStone', owner: 'black', createdSeq: 1, data: { type: 'REGEN', regenRemaining: 2, ownerColor: Core.BLACK } },
    { id: `${type}-protected`, row: 3, col: 4, kind: 'specialStone', owner: 'white', createdSeq: 2, data: { type, remainingOwnerTurns: 6 } }
  );
  const destroyed = BoardOps.destroyAt(cardState, { board }, 3, 3, 'DESTROY_ONE_STONE', 'destroy_selected');
  if ((destroyed.captureFlips || []).length || board[3][4] !== Core.WHITE) regenFailures.push({ type, captureFlips: destroyed.captureFlips, value: board[3][4] });
}
console.log(JSON.stringify({ checkedCount: types.length, reverseFailures, regenFailures }, null, 2));
if (reverseFailures.length || regenFailures.length) process.exit(1);
'@ | node -
```

Expected:

```json
{
  "checkedCount": 12,
  "reverseFailures": [],
  "regenFailures": []
}
```

- [ ] **Step 2: Run final focused validation**

Run:

```powershell
npm run typecheck
npm run build:ts
npx jest --runInBand --runTestsByPath test/game.protection-context.test.ts test/game.reverse-will.test.ts test/game.regen.consume-visual.test.ts
npm run check:window
```

Expected: all commands exit 0.

- [ ] **Step 3: Inspect final diff**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected:
- no whitespace errors from `git diff --check`
- only intended files are dirty
- unrelated dirty files are not staged

- [ ] **Step 4: Final report**

Report:
- whether `01-rulebook.md` and `正本/` stayed unchanged because this was behavior-preserving
- commits created per task
- exact validation commands and results
- whether generated browser/worker surfaces changed
- any unrelated dirty files left in the checkout

## Risk Level

Medium. The change is behavior-preserving but touches shared target/effect context used by UI, CPU, headless, and browser-served code. The risk is controlled by direct helper characterization, registry-enumerated regressions, explicit dependency injection, boundary checks, and small commits.

## Rollback Approach

Each task is a small commit. Revert in reverse order with:

```powershell
git revert <commit>
```

If a generated sync commit exists, revert it first, then revert source commits.

## Out of Scope

- Changing card rules, costs, or registry `flipProtected` values.
- Adding manifest blocking to `target-resolver`.
- Reclassifying `ULTIMATE_HYPERACTIVE` as registry `flipProtected`.
- Merging ghost, freeze, absolute protection, complete protection, inviolable manifest behavior, evasion, and destroy protection into one trait.
- Removing compatibility wrappers or public import paths.
- Running long selfplay or training jobs.

## Self-Review

- Spec coverage: The plan covers the known `METEOR_GOD` drift class, removes duplicated runtime flip-protection lists, preserves current special cases, adds direct and integration tests, documents the contract, and validates browser/worker surfaces.
- Placeholder scan: No placeholder markers, vague follow-up steps, or undefined plan steps remain.
- Type consistency: The helper API is consistently named `buildCardProtectionContext(cardState, deps)` and requires `SpecialStoneRegistry.getSpecialStoneInfo`.
