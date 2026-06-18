# Theory Placement Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor 理論の化身 and placement-related internals so theory spawns reuse clearer placement paths, special-stone marker data is generated consistently, and phase contracts are explicit while preserving all current player-visible behavior.

**Architecture:** Keep canonical gameplay decisions in `game/` and presentation in turn/UI event consumers. Refactor in small behavior-preserving passes: first lock current behavior with characterization tests, then remove duplicated turn-layer theory spawn handling, clarify the placement helper API, unify special-stone marker data construction, split theory session/spawn responsibilities, replace hidden auto-turn-end flags with explicit internal outcomes, and finally slim `game/logic/cards.ts` wiring without changing public exports.

**Tech Stack:** TypeScript/CommonJS hybrid, Jest with ts-jest, browser runtime globals, Cloudflare Worker mirror generated from root source.

---

## Behavior To Preserve

- 理論の化身の使用条件 remains: collected theory number-cell total `>= 42`.
- 理論ルーレット candidate selection and random draw order remain unchanged.
- 理論召喚は、挟める列があれば通常配置と同じ反転を行う.
- 挟めない理論数字マスでも、従来通り特殊石は出現する.
- 理論召喚で得る布石 is `理論数字マス値 + 実際に反転した石数`.
- 意志狩りの王 and other special stones spawned by theory keep the same marker data, including visible flip/destroy evasion counters.
- `theory_incarnation_spawned`, immediate special-stone events, `theory_incarnation_auto_turn_end`, `pass`, and `theory_incarnation_marker_expired` ordering remains compatible with existing tests.
- No direct DOM, `window`, sound, network, or UI writer dependencies are introduced into `game/logic/*` or shared game logic.
- `worker-public/`, `dist/`, generated catalogs, and `public/module-registry.js` are not edited as source.

## Execution Guardrails

- Start every task with `git status --short`.
- If unrelated dirty changes touch the same file as the task, inspect `git diff -- <file>` before editing and work with the current content.
- Stage only the files listed in the task. Never use `git add -A`.
- Commit after each implementation task if validation for that task passes.
- If validation fails for a reason unrelated to the task, record the exact command and first relevant failure lines before continuing.
- Do not deploy during this refactor plan. Deployment is a separate final step after all desired refactor passes are committed and `npm run worker:prepare` has produced the deploy mirror.

## File Structure

- Modify `game/turn/action-phase/place-resolution.ts`: use a shared theory spawn turn-layer helper and later pass explicit `attemptedFlips` to placement helper.
- Modify `game/turn/turn-start/special-stone-phase.ts`: use the same theory spawn turn-layer helper for turn-start theory spawns.
- Create `game/turn/theory-spawn-resolution.ts`: centralize pushing `theory_incarnation_spawned` and resolving spawn immediate effects.
- Modify `game/logic/cards-internal/spawn-and-flip.ts`: make precomputed flips explicit with `attemptedFlips`.
- Modify `game/logic/card-resolution/special-stone-marker-factory.ts`: keep it as the canonical special-stone marker-data builder.
- Modify `game/logic/cards-internal/effect-timing.ts`: consume the marker factory for normal pending special-stone placement after parity tests.
- Modify `game/logic/card-resolution/theory-incarnation.ts`: gradually extract session/state, spawn-placement, and reward helpers.
- Create `game/logic/card-resolution/theory-incarnation-state.ts`: own player/cell normalization, theory session state, and number-cell restoration helpers.
- Create `game/logic/card-resolution/theory-incarnation-spawn.ts`: own candidate selection, spawn payload construction, and board placement orchestration helpers.
- Create `game/logic/cards-internal/theory-incarnation-bindings.ts`: build theory dependencies for `cards.ts` while preserving public `CardLogic` exports.
- Modify `game/logic/cards.ts`: delegate theory dependency wiring to the new bindings module without changing exported function names.
- Modify tests only where each task states: mainly `test/game.theory-incarnation.test.ts`, `test/game.cards.spawn-and-flip-module.test.ts`, `test/game.specialstone.spawn-meta-backfill.test.ts`, and a new `test/game.special-stone-marker-factory.test.ts`.

---

### Task 0: Baseline Characterization

**Files:**
- Read: `game/logic/card-resolution/theory-incarnation.ts`
- Read: `game/turn/action-phase/place-resolution.ts`
- Read: `game/turn/turn-start/special-stone-phase.ts`
- Read: `game/logic/cards-internal/spawn-and-flip.ts`
- Read: `game/logic/cards-internal/effect-timing.ts`
- Read: `game/logic/card-resolution/special-stone-marker-factory.ts`
- Test: existing Jest tests only

- [ ] **Step 1: Confirm current working tree**

Run:

```powershell
git status --short
```

Expected: either clean, or dirty files are classified before editing. If dirty files include any task target, run `git diff -- <file>` for that file before editing.

- [ ] **Step 2: Run focused baseline tests**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\game.cards.spawn-and-flip-module.test.ts test\game.specialstone.spawn-meta-backfill.test.ts test\shared.special-stone-registry.test.ts
```

Expected: PASS. If this fails before any edits, record it as baseline failure and stop implementation until the failure is understood.

- [ ] **Step 3: Run boundary check**

Run:

```powershell
npm run check:window
```

Expected: PASS. This protects the headless boundary before turn/game refactors.

---

### Task 1: Centralize Theory Spawn Turn-Layer Dispatch

**Files:**
- Create: `game/turn/theory-spawn-resolution.ts`
- Modify: `game/turn/action-phase/place-resolution.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Add event-order characterization to existing theory tests**

In `test/game.theory-incarnation.test.ts`, add event-order assertions to the existing tests for:

- `理論召喚で出た配置直後効果持ち特殊石は即時効果を発動する`
- `理論石配置直後の理論召喚でも配置直後効果を発動する`

Use this helper near the other local helpers:

```ts
function indexOfEventType(events: any[], type: string): number {
  return events.findIndex((event: any) => event && event.type === type);
}
```

Add these assertions to both tests after `const result = ...`:

```ts
const spawnIndex = indexOfEventType(result.events, 'theory_incarnation_spawned');
const destroyIndex = indexOfEventType(result.events, 'will_hunter_king_destroyed_immediate');
const moveIndex = indexOfEventType(result.events, 'will_hunter_king_moved_immediate');
expect(spawnIndex).toBeGreaterThanOrEqual(0);
expect(destroyIndex).toBeGreaterThan(spawnIndex);
expect(moveIndex).toBeGreaterThan(spawnIndex);
```

- [ ] **Step 2: Verify characterization passes before refactor**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts
```

Expected: PASS.

- [ ] **Step 3: Create shared helper**

Create `game/turn/theory-spawn-resolution.ts`:

```ts
const TheorySpawnImmediateEffectsModule = require('./theory-spawn-immediate-effects');

type ResolveTheorySpawnTurnResultOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    spawned: any;
    prng: any;
    timing?: string | null;
    awardBoardChargeGain?: any;
};

function resolveTheorySpawnTurnResult(options: ResolveTheorySpawnTurnResultOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolveTheorySpawnTurnResultOptions);
    if (!opts.spawned || !Array.isArray(opts.events)) return;

    const event: any = {
        type: 'theory_incarnation_spawned',
        player: opts.playerKey,
        detail: opts.spawned
    };
    if (opts.timing) {
        event.timing = opts.timing;
    }
    opts.events.push(event);

    if (TheorySpawnImmediateEffectsModule && typeof TheorySpawnImmediateEffectsModule.resolveTheorySpawnImmediateEffects === 'function') {
        TheorySpawnImmediateEffectsModule.resolveTheorySpawnImmediateEffects({
            CardLogic: opts.CardLogic,
            cardState: opts.cardState,
            gameState: opts.gameState,
            playerKey: opts.playerKey,
            events: opts.events,
            spawned: opts.spawned,
            prng: opts.prng,
            awardBoardChargeGain: opts.awardBoardChargeGain
        });
    }
}

module.exports = {
    resolveTheorySpawnTurnResult
};
```

- [ ] **Step 4: Replace duplicated on-placement dispatch**

In `game/turn/action-phase/place-resolution.ts`, replace:

```ts
const TheorySpawnImmediateEffectsModule = require('../theory-spawn-immediate-effects');
```

with:

```ts
const TheorySpawnResolutionModule = require('../theory-spawn-resolution');
```

Replace the inline `theory_incarnation_spawned` push plus `resolveTheorySpawnImmediateEffects` call with:

```ts
TheorySpawnResolutionModule.resolveTheorySpawnTurnResult({
    CardLogic: opts.CardLogic,
    cardState: opts.cardState,
    gameState: opts.gameState,
    playerKey: opts.playerKey,
    events: opts.events,
    spawned: placementSpawnRes.spawned,
    prng: p,
    timing: 'on_manifest_placement',
    awardBoardChargeGain: opts.applyPlacementBoardBonusGain
});
```

- [ ] **Step 5: Replace duplicated turn-start dispatch**

In `game/turn/turn-start/special-stone-phase.ts`, replace:

```ts
const TheorySpawnImmediateEffectsModule = require('../theory-spawn-immediate-effects');
```

with:

```ts
const TheorySpawnResolutionModule = require('../theory-spawn-resolution');
```

Replace the inline `theory_incarnation_spawned` push plus `resolveTheorySpawnImmediateEffects` call with:

```ts
TheorySpawnResolutionModule.resolveTheorySpawnTurnResult({
    CardLogic: opts.CardLogic,
    cardState: opts.cardState,
    gameState: opts.gameState,
    playerKey: opts.playerKey,
    events: opts.events,
    spawned: res.spawned,
    prng: p,
    awardBoardChargeGain: opts.awardBoardChargeGain
});
```

- [ ] **Step 6: Validate and commit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add game\turn\theory-spawn-resolution.ts game\turn\action-phase\place-resolution.ts game\turn\turn-start\special-stone-phase.ts test\game.theory-incarnation.test.ts
git commit -m "refactor: centralize theory spawn turn dispatch"
```

---

### Task 2: Make Precomputed Placement Flips Explicit

**Files:**
- Modify: `game/logic/cards-internal/spawn-and-flip.ts`
- Modify: `game/turn/action-phase/place-resolution.ts`
- Read: `game/logic/card-resolution/theory-incarnation.ts` to confirm the theory spawn call site continues to compute contextual flips
- Test: `test/game.cards.spawn-and-flip-module.test.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Add a test for explicit precomputed flips**

In `test/game.cards.spawn-and-flip-module.test.ts`, add:

```ts
  test('spawnAndFlipPlacement can use explicit attemptedFlips without recomputing context flips', () => {
    const gameState = { board: [[0, -1, 1]] };
    const BoardOps = {
      spawnAt: jest.fn((cs, gs, row, col) => {
        gs.board[row][col] = 1;
        return { spawned: true };
      }),
      changeAt: jest.fn((cs, gs, row, col) => {
        gs.board[row][col] = 1;
        return { changed: true };
      })
    };
    const getFlipsWithContext = jest.fn(() => {
      throw new Error('getFlipsWithContext should not be called when attemptedFlips is supplied');
    });

    const result = spawnAndFlipPlacement({
      cardState: {},
      gameState,
      playerKey: 'black',
      playerValue: 1,
      row: 0,
      col: 0,
      allowZeroFlips: false,
      BoardOps,
      getCardContext: () => ({ protectedStones: [] }),
      getFlipsWithContext,
      attemptedFlips: [[0, 1]],
      spawnCause: 'SYSTEM',
      spawnReason: 'standard_place',
      flipCause: 'SYSTEM',
      flipReason: 'standard_flip'
    });

    expect(result).toEqual(expect.objectContaining({
      spawned: true,
      attemptedFlips: [[0, 1]],
      appliedFlips: [[0, 1]]
    }));
    expect(getFlipsWithContext).not.toHaveBeenCalled();
    expect(gameState.board[0]).toEqual([1, 1, 1]);
  });
```

- [ ] **Step 2: Verify new test fails**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.cards.spawn-and-flip-module.test.ts -t "explicit attemptedFlips"
```

Expected: FAIL because `attemptedFlips` is not implemented yet.

- [ ] **Step 3: Add `attemptedFlips` option**

In `game/logic/cards-internal/spawn-and-flip.ts`, add to `SpawnAndFlipPlacementOptions`:

```ts
    attemptedFlips?: Array<[number, number]>;
```

Replace:

```ts
    const attemptedFlips = getFlipsWithContext(opts.gameState, row, col, opts.playerValue, context);
```

with:

```ts
    const attemptedFlips = Array.isArray(opts.attemptedFlips)
        ? opts.attemptedFlips.slice()
        : getFlipsWithContext(opts.gameState, row, col, opts.playerValue, context);
```

- [ ] **Step 4: Migrate normal placement call site**

In `game/turn/action-phase/place-resolution.ts`, replace:

```ts
        getCardContext: () => ctx,
        getFlipsWithContext: () => flips,
```

with:

```ts
        getCardContext: () => ctx,
        getFlipsWithContext: opts.Core.getFlipsWithContext,
        attemptedFlips: flips,
```

Do not change the theory call site unless it is also passing precomputed flips. Theory spawn should continue to compute contextual flips at the selected theory cell.

- [ ] **Step 5: Validate and commit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.cards.spawn-and-flip-module.test.ts test\game.theory-incarnation.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add game\logic\cards-internal\spawn-and-flip.ts game\turn\action-phase\place-resolution.ts test\game.cards.spawn-and-flip-module.test.ts
git commit -m "refactor: make placement flips explicit"
```

---

### Task 3: Add Marker-Factory Parity Tests Before Consolidation

**Files:**
- Create: `test/game.special-stone-marker-factory.test.ts`
- Read: `game/logic/card-resolution/special-stone-marker-factory.ts`
- Read: `game/logic/cards-internal/effect-timing.ts`

- [ ] **Step 1: Create marker factory test**

Create `test/game.special-stone-marker-factory.test.ts`:

```ts
import * as SpecialStoneMarkerFactory from '../game/logic/card-resolution/special-stone-marker-factory';

describe('special stone marker factory', () => {
  test('builds WILL_HUNTER_KING marker data with visible evasion counters', () => {
    const markerData = SpecialStoneMarkerFactory.buildMarkerDataForCardType('WILL_HUNTER_KING', {
      constants: { WILL_HUNTER_KING_TURNS: 8 },
      SpecialStoneRegistry: {
        getSpecialStoneInfo: (type: string) => type === 'WILL_HUNTER_KING' ? {
          tagFlipEvadeDefault: 2,
          tagDestroyEvadeDefault: 2
        } : null
      }
    });

    expect(markerData).toEqual({
      type: 'WILL_HUNTER_KING',
      remainingOwnerTurns: 8,
      flipEvadeRemaining: 2,
      destroyEvadeRemaining: 2
    });
  });

  test('builds owner-sensitive WORK marker data', () => {
    const markerData = SpecialStoneMarkerFactory.buildMarkerDataForCardType('WORK_WILL', {
      ownerKey: 'white'
    });

    expect(markerData).toEqual(expect.objectContaining({
      type: 'WORK',
      ownerColor: 'white',
      workStage: 0
    }));
  });

  test('does not build markers for non-spawnable instant or trap effects', () => {
    expect(SpecialStoneMarkerFactory.buildMarkerDataForCardType('INSTANT_HYPERACTIVE_WILL')).toBeNull();
    expect(SpecialStoneMarkerFactory.buildMarkerDataForCardType('TRAP_WILL')).toBeNull();
  });
});
```

- [ ] **Step 2: Validate parity test**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.special-stone-marker-factory.test.ts test\game.theory-incarnation.test.ts test\game.specialstone.spawn-meta-backfill.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit characterization**

Commit:

```powershell
git add test\game.special-stone-marker-factory.test.ts
git commit -m "test: characterize special stone marker factory"
```

---

### Task 4: Use Marker Factory From Normal Pending Special-Stone Placement

**Files:**
- Modify: `game/logic/cards-internal/effect-timing.ts`
- Test: `test/game.special-stone-marker-factory.test.ts`
- Test: `test/game.specialstone.spawn-meta-backfill.test.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Load marker factory with the existing safeRequire pattern**

At the top of `game/logic/cards-internal/effect-timing.ts`, next to the existing `EvasionStatus` constant, add:

```ts
const SpecialStoneMarkerFactory = safeRequire('../card-resolution/special-stone-marker-factory');
const SpecialStoneRegistry = safeRequire('../../../shared/special-stone-registry');
```

Inside the placement-effect function before the pending special-stone blocks, add:

```ts
const buildMarkerDataForCardType = SpecialStoneMarkerFactory && typeof SpecialStoneMarkerFactory.buildMarkerDataForCardType === 'function'
    ? SpecialStoneMarkerFactory.buildMarkerDataForCardType
    : null;
```

- [ ] **Step 2: Replace duplicated WILL_HUNTER_KING marker data**

Replace the inline block:

```ts
{
    type: 'WILL_HUNTER_KING',
    remainingOwnerTurns: constants.WILL_HUNTER_KING_TURNS,
    flipEvadeRemaining: getFlipEvadeDefault('WILL_HUNTER_KING', 2),
    destroyEvadeRemaining: getDestroyEvadeDefault('WILL_HUNTER_KING', 2)
}
```

with:

```ts
const markerData = buildMarkerDataForCardType ? buildMarkerDataForCardType('WILL_HUNTER_KING', {
    ownerKey: playerKey,
    constants,
    SpecialStoneRegistry
}) : {
    type: 'WILL_HUNTER_KING',
    remainingOwnerTurns: constants.WILL_HUNTER_KING_TURNS,
    flipEvadeRemaining: getFlipEvadeDefault('WILL_HUNTER_KING', 2),
    destroyEvadeRemaining: getDestroyEvadeDefault('WILL_HUNTER_KING', 2)
};
```

The final `WILL_HUNTER_KING` block should be:

```ts
if (pending && pending.type === 'WILL_HUNTER_KING' && typeof helpers.addMarker === 'function') {
    const markerData = buildMarkerDataForCardType ? buildMarkerDataForCardType('WILL_HUNTER_KING', {
        ownerKey: playerKey,
        constants,
        SpecialStoneRegistry
    }) : {
        type: 'WILL_HUNTER_KING',
        remainingOwnerTurns: constants.WILL_HUNTER_KING_TURNS,
        flipEvadeRemaining: getFlipEvadeDefault('WILL_HUNTER_KING', 2),
        destroyEvadeRemaining: getDestroyEvadeDefault('WILL_HUNTER_KING', 2)
    };
    helpers.addMarker(cardState, specialStoneKind, row, col, playerKey, markerData);
    effects.willHunterKingPlaced = true;
}
```

Preserve existing `row`, `col`, `owner`, marker kind, event names, and ordering.

- [ ] **Step 3: Migrate only one marker type first**

Do not migrate all special stones in this task. Validate `WILL_HUNTER_KING` first because it is the bug-prone visible-counter case.

- [ ] **Step 4: Validate and commit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.special-stone-marker-factory.test.ts test\game.specialstone.spawn-meta-backfill.test.ts test\game.theory-incarnation.test.ts test\game.will-hunter-king.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add game\logic\cards-internal\effect-timing.ts test\game.special-stone-marker-factory.test.ts
git commit -m "refactor: reuse marker factory for will hunter placement"
```

---

### Task 5: Extract Theory Session State Helpers

**Files:**
- Create: `game/logic/card-resolution/theory-incarnation-state.ts`
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Move only state/session helpers**

Move these helpers from `theory-incarnation.ts` into `theory-incarnation-state.ts` without changing their behavior:

- `ownerKeyOf`
- `cellKeyOf`
- `ensureTheoryState`
- `addNumberCellCollectedTotal`
- `restoreTheoryNumberCells`

Export them with the same names:

```ts
module.exports = {
    ownerKeyOf,
    cellKeyOf,
    ensureTheoryState,
    addNumberCellCollectedTotal,
    restoreTheoryNumberCells
};
```

- [ ] **Step 2: Re-import helpers in `theory-incarnation.ts`**

At the top of `theory-incarnation.ts`, add:

```ts
const TheoryIncarnationState = require('./theory-incarnation-state');
const {
    ownerKeyOf,
    cellKeyOf,
    ensureTheoryState,
    addNumberCellCollectedTotal,
    restoreTheoryNumberCells
} = TheoryIncarnationState;
```

Delete the local helper definitions from `theory-incarnation.ts`. Keep the public exports from `theory-incarnation.ts` unchanged by exporting `addNumberCellCollectedTotal` from the destructured helper. Keep `finalizeTheoryIncarnationAutoTurnEndExpiration` and `consumeTheoryIncarnationAutoTurnEnd` in `theory-incarnation.ts` for this task; they are lifecycle/phase helpers, not pure session-state helpers.

- [ ] **Step 3: Validate and commit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add game\logic\card-resolution\theory-incarnation.ts game\logic\card-resolution\theory-incarnation-state.ts
git commit -m "refactor: extract theory incarnation state helpers"
```

---

### Task 6: Extract Theory Spawn Placement Helpers

**Files:**
- Create: `game/logic/card-resolution/theory-incarnation-spawn.ts`
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
- Test: `test/game.theory-incarnation.test.ts`
- Test: `test/game.cards.spawn-and-flip-module.test.ts`

- [ ] **Step 1: Move spawn-only helpers**

Move these responsibilities into `theory-incarnation-spawn.ts`:

- `isCellAvailableForTheorySpawn`
- `markTheoryCellConsumed`
- `getTheorySpawnNumberValue`
- `awardTheorySpawnCharge`
- `prepareSpawnMarkerData`
- `createTheorySpawnRoulettePayload`
- the board-placement portion of `spawnTheorySpecialStone`

Keep the existing public function `spawnTheorySpecialStone` callable from `theory-incarnation.ts` until all callers are migrated.

- [ ] **Step 2: Preserve the placement behavior explicitly**

In the extracted spawn helper, keep this decision shape:

```ts
const boardPlacement = deps.spawnAndFlipPlacement({
    cardState,
    gameState,
    playerKey,
    playerValue,
    row,
    col,
    allowZeroFlips: true,
    BoardOps: deps.BoardOps,
    getCardContext: () => context,
    getFlipsWithContext: deps.Core.getFlipsWithContext,
    resolveFlipEvasion,
    clearBombAt: deps.clearBombAt,
    clearHyperactiveAtPositions: deps.clearHyperactiveAtPositions,
    spawnCause: 'THEORY_INCARNATION',
    spawnReason: 'theory_incarnation_spawn',
    flipCause: 'THEORY_INCARNATION',
    flipReason: 'theory_incarnation_flip',
    spawnMeta
});
```

The key invariant is `allowZeroFlips: true`: theory still spawns on non-flipping theory number cells.

- [ ] **Step 3: Validate and commit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\game.cards.spawn-and-flip-module.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add game\logic\card-resolution\theory-incarnation.ts game\logic\card-resolution\theory-incarnation-spawn.ts
git commit -m "refactor: extract theory incarnation spawn helpers"
```

---

### Task 7: Make Theory Auto Turn-End Explicit

**Files:**
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
- Modify: `game/turn/turn-start/special-stone-phase.ts`
- Modify: `game/turn/turn-start/marker-phase.ts`
- Modify: `game/turn/turn_pipeline_phases.ts`
- Modify: `game/logic/cards.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Add a characterization assertion for no stale auto-end flag**

In `test/game.theory-incarnation.test.ts`, add this helper near the other local helpers:

```ts
function expectNoPendingTheoryAutoTurnEnd(cardState: any, playerKey: 'black' | 'white'): void {
  const flags = cardState && cardState._theoryIncarnationAutoTurnEndByPlayer;
  expect(!!(flags && flags[playerKey] === true)).toBe(false);
}
```

In `理論石顕現中の自ターン開始で理論数字マスから特殊石を1体出し、ターンを自動終了する`, add:

```ts
expectNoPendingTheoryAutoTurnEnd(cardState, 'black');
```

This locks the current cleanup behavior while still passing after the hidden flag is removed.

- [ ] **Step 2: Verify characterization passes**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts -t "自動終了"
```

Expected: PASS.

- [ ] **Step 3: Change internal return shape**

Change `processTheoryIncarnationMarkerAtTurnStart` so it returns:

```ts
{
    spawned,
    expired,
    autoTurnEnd: true
}
```

when the marker should force auto turn-end. Keep setting the hidden flag during this step only as a compatibility bridge.

- [ ] **Step 4: Thread explicit outcome through turn-start processing**

In `game/turn/turn-start/special-stone-phase.ts`, when processing `THEORY_INCARNATION`, if `res.autoTurnEnd === true`, set a processing-state field:

```ts
processingState.theoryAutoTurnEnd = true;
```

Extend `TurnStartSpecialStoneProcessingState` with:

```ts
theoryAutoTurnEnd?: boolean;
```

Do not push `theory_incarnation_auto_turn_end` in `special-stone-phase.ts`. The event must stay in `turn_pipeline_phases.ts` at the current post marker-processing point to preserve event ordering.

- [ ] **Step 5: Return the explicit marker-processing state through marker phase**

In `game/turn/turn-start/marker-phase.ts`, update the return type of `processTurnStartMarkers` from:

```ts
function processTurnStartMarkers(options: ProcessTurnStartMarkersOptions): { hyperAggregated: any } {
```

to:

```ts
function processTurnStartMarkers(options: ProcessTurnStartMarkersOptions): any {
```

The function already returns `processingState`; no runtime code change is needed beyond the type broadening.

- [ ] **Step 6: Consume explicit outcome in turn pipeline**

In `game/turn/turn_pipeline_phases.ts`, replace the live `CardLogic.consumeTheoryIncarnationAutoTurnEnd` decision with the explicit processing-state result:

```ts
const shouldAutoEndForTheory = processedTurnStartMarkers && processedTurnStartMarkers.theoryAutoTurnEnd === true;
```

Keep the `events.push({ type: 'theory_incarnation_auto_turn_end', player: playerKey })`, `finalizeTheoryIncarnationAutoTurnEndExpiration`, and `applyPassCompletion` calls at the same location where the hidden flag is currently consumed. Also pass the full marker-processing state into post-processing:

```ts
processedTurnStartMarkers
```

instead of:

```ts
{ hyperAggregated }
```

- [ ] **Step 7: Remove compatibility hidden flag after tests pass**

Remove writes to `_theoryIncarnationAutoTurnEndByPlayer` from `theory-incarnation.ts`. Remove `consumeTheoryIncarnationAutoTurnEnd` from `theory-incarnation.ts`, remove the wrapper from `game/logic/cards.ts`, and remove it from the `cardsApi` export after this command shows no remaining live call sites:

```powershell
rg -n "consumeTheoryIncarnationAutoTurnEnd|_theoryIncarnationAutoTurnEndByPlayer" game test
```

Expected remaining references before deletion: the function definition/wrapper/export and the compatibility write. Expected remaining references after deletion: none, except the test helper name if it mentions the old flag intentionally.

- [ ] **Step 8: Validate and commit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts
npm run typecheck
```

Expected: PASS.

Commit:

```powershell
git add game\logic\card-resolution\theory-incarnation.ts game\turn\turn-start\special-stone-phase.ts game\turn\turn-start\marker-phase.ts game\turn\turn_pipeline_phases.ts game\logic\cards.ts test\game.theory-incarnation.test.ts
git commit -m "refactor: make theory auto turn end explicit"
```

---

### Task 8: Slim Theory Wiring In `cards.ts`

**Files:**
- Create: `game/logic/cards-internal/theory-incarnation-bindings.ts`
- Modify: `game/logic/cards.ts`
- Test: `test/game.theory-incarnation.test.ts`
- Test: `test/game.cards.context-builders-module.test.ts`

- [ ] **Step 1: Extract dependency builder only**

Create `game/logic/cards-internal/theory-incarnation-bindings.ts`:

```ts
type TheoryIncarnationBindingOptions = {
    MARKER_KINDS: any;
    BLACK: any;
    WHITE: any;
    EMPTY: any;
    CARD_DEFS: any;
    constants: any;
    SpecialStoneRegistry: any;
    ManifestStoneRegistry: any;
    SpecialStoneMarkerFactory: any;
    Core: any;
    BoardOps: any;
    spawnAndFlipPlacement: any;
    resolveSafeCardContext: any;
    resolveHyperactiveFlipEvasion: any;
    clearBombAt: any;
    clearHyperactiveAtPositions: any;
    addMarker: any;
    getMarkers: any;
    removeMarkerById: any;
    getCellValueForCard: any;
    setCellValueForCard: any;
    isBlockedCell: any;
    sampleRandomPositions: any;
    revertSpecialStoneWithPresentation: any;
    addChargeWithTotal: any;
    spawnAt: any;
};

function buildTheoryIncarnationResolutionDeps(options: TheoryIncarnationBindingOptions): any {
    const opts = (options && typeof options === 'object') ? options : ({} as TheoryIncarnationBindingOptions);
    return {
        MARKER_KINDS: opts.MARKER_KINDS,
        BLACK: opts.BLACK,
        WHITE: opts.WHITE,
        EMPTY: opts.EMPTY,
        CARD_DEFS: opts.CARD_DEFS,
        constants: opts.constants,
        SpecialStoneRegistry: opts.SpecialStoneRegistry,
        ManifestStoneRegistry: opts.ManifestStoneRegistry,
        SpecialStoneMarkerFactory: opts.SpecialStoneMarkerFactory,
        Core: opts.Core,
        BoardOps: opts.BoardOps,
        spawnAndFlipPlacement: opts.spawnAndFlipPlacement,
        resolveSafeCardContext: opts.resolveSafeCardContext,
        resolveHyperactiveFlipEvasion: opts.resolveHyperactiveFlipEvasion,
        clearBombAt: opts.clearBombAt,
        clearHyperactiveAtPositions: opts.clearHyperactiveAtPositions,
        addMarker: opts.addMarker,
        getMarkers: opts.getMarkers,
        removeMarkerById: opts.removeMarkerById,
        getCellValueForCard: opts.getCellValueForCard,
        setCellValueForCard: opts.setCellValueForCard,
        isBlockedCell: opts.isBlockedCell,
        sampleRandomPositions: opts.sampleRandomPositions,
        revertSpecialStoneWithPresentation: opts.revertSpecialStoneWithPresentation,
        addChargeWithTotal: opts.addChargeWithTotal,
        spawnAt: opts.spawnAt
    };
}

const CardTheoryIncarnationBindings = {
    buildTheoryIncarnationResolutionDeps
};

const theoryIncarnationBindingsRuntimeRoot = typeof self !== 'undefined'
    ? (self as any)
    : (typeof global !== 'undefined' ? (global as any) : null);

if (theoryIncarnationBindingsRuntimeRoot) {
    theoryIncarnationBindingsRuntimeRoot.CardTheoryIncarnationBindings = CardTheoryIncarnationBindings;
}

module.exports = CardTheoryIncarnationBindings;
```

- [ ] **Step 2: Use the builder from `cards.ts`**

In `game/logic/cards.ts`, add the module resolver near the other `Card...Module` constants:

```ts
const CardTheoryIncarnationBindings = resolveCardLogicModuleOrGlobal('./cards-internal/theory-incarnation-bindings', 'CardTheoryIncarnationBindings');
```

Then replace the body of `getTheoryIncarnationResolutionDeps()` with:

```ts
if (!CardTheoryIncarnationBindings || typeof CardTheoryIncarnationBindings.buildTheoryIncarnationResolutionDeps !== 'function') {
    throw new Error('CardTheoryIncarnationBindings not loaded');
}
return CardTheoryIncarnationBindings.buildTheoryIncarnationResolutionDeps({
    MARKER_KINDS,
    BLACK,
    WHITE,
    EMPTY,
    CARD_DEFS,
    constants: {
        GHOST_WILL_TURNS,
        AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
        AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
        PROLIFERATION_WILL_TURNS,
        ULTIMATE_DRAGON_TURNS,
        ULTIMATE_DESTROY_GOD_TURNS,
        ULTIMATE_HYPERACTIVE_TURNS,
        STONE_SALVATION_GOD_TURNS,
        SNIPER_WILL_TURNS,
        DESTROY_DRAGON_TURNS,
        LIGHTNING_WILL_TURNS,
        WILL_HUNTER_KING_TURNS,
        ROBOT_VACUUM_TURNS
    },
    SpecialStoneRegistry,
    ManifestStoneRegistry,
    SpecialStoneMarkerFactory: SpecialStoneMarkerFactoryModule,
    Core: resolveCoreLogicForCards(),
    BoardOps: BoardOpsModule,
    spawnAndFlipPlacement,
    resolveSafeCardContext: getCardContext,
    resolveHyperactiveFlipEvasion,
    clearBombAt,
    clearHyperactiveAtPositions,
    addMarker,
    getMarkers,
    removeMarkerById,
    getCellValueForCard,
    setCellValueForCard,
    isBlockedCell,
    sampleRandomPositions,
    revertSpecialStoneWithPresentation,
    addChargeWithTotal,
    spawnAt: BoardOpsModule && typeof BoardOpsModule.spawnAt === 'function'
        ? BoardOpsModule.spawnAt
        : null
});
```

Do not rename exported `CardLogic` functions in this task. The returned dependency object must be identical in shape to the pre-refactor `getTheoryIncarnationResolutionDeps()` result.

- [ ] **Step 3: Validate and commit**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\game.cards.context-builders-module.test.ts
npm run typecheck
npm run build:ts
```

Expected: PASS.

Commit:

```powershell
git add game\logic\cards.ts game\logic\cards-internal\theory-incarnation-bindings.ts
git commit -m "refactor: extract theory incarnation bindings"
```

---

### Task 9: Final Cross-Runtime Validation

**Files:**
- No source edits expected

- [ ] **Step 1: Run focused suite**

Run:

```powershell
npx jest --runInBand --runTestsByPath test\game.theory-incarnation.test.ts test\game.cards.spawn-and-flip-module.test.ts test\game.special-stone-marker-factory.test.ts test\game.specialstone.spawn-meta-backfill.test.ts test\game.will-hunter-king.test.ts test\shared.special-stone-registry.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run type and boundary checks**

Run:

```powershell
npm run typecheck
npm run check:window
```

Expected: PASS.

- [ ] **Step 3: Run broad game tests**

Run:

```powershell
npm run test:jest
```

Expected: PASS.

- [ ] **Step 4: Prepare worker mirror only when deployment is next**

Run this only after all refactor commits are accepted and deployment is intended:

```powershell
npm run worker:prepare
```

Expected: PASS and generated mirror changes are reviewed separately before deploy.

---

## Rollback Plan

- Each task is one commit, so rollback is `git revert <commit>` for the specific pass.
- If Task 7 fails because auto-turn-end phase ordering changes, revert only Task 7 and keep Tasks 1-6.
- If Task 4 reveals marker-data semantic differences, keep Task 3 tests and revert Task 4 implementation. Then migrate marker types one by one with explicit expected differences.
- If Task 8 causes module-load or browser global order issues, revert Task 8 only. It is intentionally last because it is wiring cleanup, not a prerequisite for behavioral safety.

## Out Of Scope For This Refactor

- Changing 理論の化身 rules, spawn count, roulette timing, or costs.
- Changing visible card text or rulebook wording unless a separate spec/text-sync task approves it.
- Editing `worker-public/` manually.
- Deploying to Cloudflare Workers.
- Running long selfplay or training jobs.
