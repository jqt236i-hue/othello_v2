# Living Will (生きる意志) Refactoring Plan

## Goal
Simplify the 「生きる意志」 implementation by unifying all loss-interception paths into a single entry point, while preserving the agreed rule semantics:
- Revival triggers on **stone loss** only (flip, destroy, capture, duration expiry, special-loss, board-shrinking/meteor)
- Non-loss effects (freeze, swap, move) are **not** intercepted
- Visual presentation still shows disappearance followed by revival

---

## Files Modified

### Core Module
- `game/logic/cards/living_will.ts`

### Call Sites (replace scattered logic with unified entry)
- `game/logic/board_ops.ts`
- `game/cards/effects/ownership.ts`
- `game/logic/cards-internal/effect-timing.ts`
- `game/logic/cards.ts`
- `game/turn/turn_pipeline_phases.ts`

### Compatibility Wrappers (update exports if needed)
- `game/cards/effects/living-will.ts`
- `game/card-effects/living-will.ts`

---

## Step 1: Design `tryReviveWithLivingWill` Unified Entry Point

### Location
`game/logic/cards/living_will.ts` — new exported function.

### Signature
```ts
function tryReviveWithLivingWill(
  cardState: CardState,
  gameState: GameState,
  row: number,
  col: number,
  trigger: {
    kind: 'destroy' | 'flip' | 'capture' | 'special_loss' | 'duration_end' | 'loss_will' | 'meteor' | 'board_shrink';
    cause?: string | null;
    reason?: string | null;
    forceRelocation?: boolean;
    flippedBy?: PlayerKey | null;
  },
  deps: LivingWillDeps
): {
  revived: boolean;
  consumed: boolean;
  reason?: string;
  source?: CellPosition;
  destination?: CellPosition;
  relocated?: boolean;
}
```

### Behavior
1. Calls `findLivingWillMarkerAt(cardState, row, col)`
2. If none found → return `{ revived: false, consumed: false }`
3. Calls `restoreFromLivingWillSnapshot(...)` with the provided trigger
4. Returns its result mapped to `{ revived, consumed, ... }`

### Benefit
Callers no longer need to:
- Import `findLivingWillMarkerAt`
- Check module availability manually
- Call `restoreFromLivingWillSnapshot` directly

---

## Step 2: Refactor `restoreFromLivingWillSnapshot`

### Current Problem
`restoreFromLivingWillSnapshot` is ~100 lines mixing:
- Snapshot/baseline validation
- Relocation decision
- Marker cleanup
- Board operations (spawnAt / changeAt)
- Baseline marker restoration

### Refactor into two phases

#### Phase A: `buildRestorePlan`
```ts
function buildRestorePlan(
  livingWillMarker: any,
  trigger: LivingWillTrigger,
  deps: LivingWillDeps
): {
  canRestore: boolean;
  owner: PlayerKey;
  source: CellPosition;
  destination: CellPosition;
  relocate: boolean;
  baseline: LivingWillBaseline;
  visualMeta: any;
} | null
```

#### Phase B: `executeRestore`
```ts
function executeRestore(
  cardState: CardState,
  gameState: GameState,
  plan: RestorePlan,
  deps: LivingWillDeps
): RestoreResult
```

`restoreFromLivingWillSnapshot` becomes a thin orchestrator:
```ts
function restoreFromLivingWillSnapshot(...) {
  const plan = buildRestorePlan(...);
  if (!plan) return { restored: false, consumed: false };
  return executeRestore(...);
}
```

---

## Step 3: Consolidate `restoreBaselineMarkers` Special-Stone Branching

### Current State
Switch statement in `normalizeRestoreMarkerData` with ~40 cases for special stone defaults.

### Refactor
Create a declarative defaults table:
```ts
const SPECIAL_RESTORE_DEFAULTS: Record<string, (defaults: DurationDefaults) => Partial<any>> = {
  REGEN: (d) => ({ regenRemaining: d.regenReviveLimit, remainingOwnerTurns: d.regenReviveLimit }),
  DRAGON: (d) => ({ remainingOwnerTurns: d.ultimateDragonTurns }),
  BREEDING: (d) => ({ remainingOwnerTurns: d.breedingTurns }),
  // ... etc
};
```

`normalizeRestoreMarkerData` becomes:
```ts
function normalizeRestoreMarkerData(marker: any, ownerKey: PlayerKey, deps: LivingWillDeps): any {
  const defaults = getDurationDefaults(deps);
  const markerData = cloneStructuredValue(marker?.data ?? {});
  const type = String(markerData.type || '').toUpperCase();

  markerData.ownerColor = ownerKey;
  if (markerData.expiresForPlayer !== undefined) markerData.expiresForPlayer = ownerKey;

  const applyDefaults = SPECIAL_RESTORE_DEFAULTS[type];
  if (applyDefaults) Object.assign(markerData, applyDefaults(defaults));

  if (HYPERACTIVE_TYPES.has(type)) delete markerData.hyperactiveSeq;

  return markerData;
}
```

### Benefit
Adding a new special stone no longer requires editing a switch statement — just add a row to the table.

---

## Step 4: Update Call Sites

### 4.1 `game/logic/board_ops.ts` — `destroyStone`

**Current:**
```ts
const livingWillMarker = cardLivingWillModule?.findLivingWillMarkerAt(...);
if (livingWillMarker && cardLivingWillModule?.restoreFromLivingWillSnapshot) {
  // ... direct restore call, emit DESTROY, then spawn/change
}
```

**After:**
```ts
const reviveResult = tryReviveWithLivingWill(cardState, gameState, row, col, {
  kind: 'destroy',
  cause,
  reason
}, { BoardOps: { spawnAt, changeAt, ... }, random: meta?.random });

if (reviveResult.revived) {
  return createDestroyOutcome(DESTROY_OUTCOME_KINDS.LIVING_WILL_RESTORED, {
    reason: 'living_will_restored',
    from: { row, col },
    to: reviveResult.destination,
    owner: baseline.owner, // from plan or marker
    livingWillRevived: true,
    relocated: reviveResult.relocated
  });
}
```

### 4.2 `game/logic/board_ops.ts` — `revertSpecialStoneAt`

Same pattern: replace `findLivingWillMarkerAt` + `shouldTriggerForSpecialLoss` + `restoreFromLivingWillSnapshot` with `tryReviveWithLivingWill`.

### 4.3 `game/cards/effects/ownership.ts` — capture handling

**Current:**
```ts
const livingWillMarker = CardLivingWillModule?.findLivingWillMarkerAt(...);
// ... capture logic ...
if (livingWillMarker) {
  CardLivingWillModule.restoreFromLivingWillSnapshot(...);
}
```

**After:**
```ts
const reviveResult = tryReviveWithLivingWill(..., { kind: 'capture', ... });
if (reviveResult.revived) {
  // Skip hand-add, emit revival presentation
  return { applied: true, livingWillRevived: true, ... };
}
// Continue with normal capture
```

### 4.4 `game/logic/cards-internal/effect-timing.ts`

Replace `getTrackedLivingWillMarker` + `restoreTrackedLivingWill` with `tryReviveWithLivingWill`.

### 4.5 `game/logic/cards.ts` — guard removal

Replace direct `restoreFromLivingWillSnapshot` loop with `tryReviveWithLivingWill`.

### 4.6 `game/turn/turn_pipeline_phases.ts` — flip aftermath

**Current:** `applyLivingWillAfterFlips` iterates flips and calls `restoreFromLivingWillSnapshot` per flip.

**After:** Keep the iteration, but call `tryReviveWithLivingWill` per flipped cell. Optionally inline `applyLivingWillAfterFlips` into the pipeline since it's no longer a complex module call.

---

## Step 5: Update Exports

### `game/logic/cards/living_will.ts`
Add to exports:
```ts
export = {
  tryReviveWithLivingWill,      // NEW
  applyLivingWill,
  applyLivingWillAfterFlips,    // keep for compat, or deprecate
  findLivingWillMarkerAt,
  shouldTriggerForSpecialLoss,  // keep for compat
  restoreFromLivingWillSnapshot // keep for compat
};
```

### `game/logic/cards.ts`
Update exported `CardLogic` to expose `tryReviveWithLivingWill` if needed by other modules.

### `game/cards/effects/living-will.ts`
Re-export `tryReviveWithLivingWill` if downstream code uses this wrapper.

---

## Step 6: Remove Deprecated Paths (Optional, in follow-up)

After all call sites migrate to `tryReviveWithLivingWill`:
- Remove `getTrackedLivingWillMarker` and `restoreTrackedLivingWill` from `effect-timing.ts`
- Remove `applyLivingWillAfterFlips` from `cards.ts` if fully inlined
- Mark `shouldTriggerForSpecialLoss` as deprecated if no longer used externally

---

## Verification Plan

### Type Check
```bash
npm run typecheck
```

### Build
```bash
npm run build:ts
```

### Tests to Run
```bash
npx jest --runInBand --runTestsByPath test/game.card-effects.living-will.test.ts
npx jest --runInBand --runTestsByPath test/game.living-will.test.ts
npx jest --runInBand --testPathPattern "board_ops"
npx jest --runInBand --testPathPattern "pipeline"
npx jest --runInBand --testPathPattern "effect-timing"
```

### Check for Browser API Leaks in game/
```bash
npm run check:window
```

### Worker Mirror Sync
If any `game/` or `cards/` files changed:
```bash
npm run worker:prepare
```

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Call sites missed | Full grep for `findLivingWillMarkerAt` and `restoreFromLivingWillSnapshot` before and after |
| Behavior change in flip revival | Ensure visual meta (`living_will_restored`) is still emitted with same fields |
| Capture-with-revive path broken | Run capture-related tests; verify `HAND_ADD` is skipped when revived |
| Relocation logic affected | Test meteor / board-shrink scenarios explicitly |
| Type errors from export changes | `typecheck` before commit |

---

## Estimated Scope

- Lines added: ~120 (new unified function + data table)
- Lines removed: ~200 (duplicate call-site logic)
- Net: ~80 lines reduction in `game/` directory
- Files touched: 8
- Test impact: All existing living-will tests should pass without modification (pure refactor)
