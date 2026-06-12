# Random Target Exclusion Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all confirmed random-selection bugs where blocked cells, hole cells, frozen cells, absolute-protected stones, or inviolable manifestation stones are selected and then silently fail or create inconsistent bookkeeping.

**Execution status:** Implemented and verified on 2026-06-12 with the focused regression suite and `npm run typecheck`.

**Architecture:** Align candidate generation with the authoritative `BoardOps` rejection rules instead of relying on late failure. Keep the core headless: add/use selector predicates and injected deps, not UI state. Fix shared spawn bookkeeping so a failed `spawnAt()` cannot produce spawned/frontier/flip side effects.

**Tech Stack:** TypeScript/CommonJS modules, Jest with `ts-jest`, existing card logic modules under `game/logic`.

---

## File Map

- Modify: `game/logic/card-resolution/theory-incarnation.ts`
  - Exclude blocked cells from theory-number rewriting and theory roulette spawn availability.
- Modify: `game/logic/cards.ts`
  - Pass blocking/absolute helpers into theory, breeding, ribo/time-stop, and observer deps as needed.
- Modify: `game/logic/cards/breeding.ts`
  - Require the common `isBlockedCell` behavior for breeding neighbor candidates.
- Modify: `game/logic/cards-internal/spawn-and-flip.ts`
  - Treat `BoardOps.spawnAt(...).spawned === false` as a failed spawn and skip spawned output/flips for that target.
- Modify: `game/logic/cards-internal/ribo-time-stop.ts`
  - Exclude self-destruction candidates that `BoardOps.destroyAt` would reject for absolute protection, inviolable manifestation, guard, frozen, or destroy-evasion according to the relevant cost effect.
- Modify: `game/logic/card-resolution/observer-will.ts`
  - Exclude guard/frozen candidates in addition to absolute-protected candidates for repayment shortage destruction.
- Modify: `test/game.theory-incarnation.test.ts`
  - Add regression coverage for theory holes/blocked cells.
- Modify: `test/game.breeding-frontier.test.ts`
  - Add regression coverage for breeding holes/empty freezes.
- Modify: `test/game.cards.spawn-and-flip-module.test.ts`
  - Update shared spawn semantics and add failed-spawn regression coverage.
- Modify: `test/game.ribo-will.test.ts`
  - Add regression coverage for protected/frozen self-destruction candidates.
- Modify: `test/game.time-stop-god.test.ts`
  - Add regression coverage for absolute/inviolable time-stop cost candidates.
- Modify: `test/game.observer-will-repayment.test.ts`
  - Add regression coverage for guard/frozen observer repayment candidates.
- Check/update if needed: `01-rulebook.md`, `cards/card-interaction-effects.ts`
  - Only if current player-facing text says protected/frozen stones are valid random-destruction cost targets. Do not churn text if existing wording remains accurate.

---

### Task 1: Theory Incarnation Candidate Filtering

**Files:**
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
- Modify: `game/logic/cards.ts`
- Test: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Write failing tests for holes not becoming theory cells**

Add tests near the existing theory incarnation placement/spawn tests:

```ts
test('理論の化身は穴・封鎖・空凍結マスを理論数字マス化しない', () => {
  const prng = createPrng([0]);
  const cardState: any = CardLogic.createCardState(prng);
  const gameState = createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK));
  gameState.board[0][0] = Shared.EMPTY;
  gameState.board[0][1] = Shared.EMPTY;
  gameState.board[0][2] = Shared.EMPTY;
  gameState.board[0][3] = Shared.EMPTY;
  cardState.hands.black = ['theory_incarnation_01'];
  cardState.charge.black = 0;
  cardState.numberCellCollectedTotalByPlayer.black = 42;
  CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'METEOR_HOLE' });
  CardLogic.addMarker(cardState, 'specialStone', 0, 1, 'black', { type: 'BLOCKADE', remainingOwnerTurns: 3 });
  CardLogic.addMarker(cardState, 'specialStone', 0, 2, 'black', { type: 'FREEZE', remainingOwnerTurns: 2 });

  expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'theory_incarnation_01', null, { prng })).toBe(true);
  const sessionId = cardState.theoryIncarnationStateByPlayer.black.sessionId;
  const cells = cardState.theoryNumberCellsBySession[sessionId].cells;

  expect(cells['0,0']).toBeUndefined();
  expect(cells['0,1']).toBeUndefined();
  expect(cells['0,2']).toBeUndefined();
  expect(cells['0,3']).toBeDefined();
  expect(cardState.boardBonusByCell['0,0']).toBeUndefined();
  expect(cardState.boardBonusByCell['0,1']).toBeUndefined();
  expect(cardState.boardBonusByCell['0,2']).toBeUndefined();
});
```

- [ ] **Step 2: Write failing test for roulette excluding blocked theory cells**

Add a test that simulates stale blocked theory cells and expects the roulette to choose only the valid cell:

```ts
test('理論の化身ルーレットは穴・封鎖・空凍結の理論数字マスを候補にしない', () => {
  const prng = createPrng([0]);
  const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
  const gameState = createGameState();
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.BLACK));
  gameState.board[0][0] = Shared.EMPTY;
  gameState.board[0][1] = Shared.EMPTY;
  gameState.board[0][2] = Shared.EMPTY;
  gameState.board[0][3] = Shared.EMPTY;
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 3 },
    white: null
  };
  cardState.theoryNumberCellsBySession = {
    theory_black_1: {
      ownerKey: 'black',
      cells: {
        '0,0': { row: 0, col: 0, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } },
        '0,1': { row: 0, col: 1, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } },
        '0,2': { row: 0, col: 2, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } },
        '0,3': { row: 0, col: 3, spawnType: 'SNIPER', sourceCardId: 'sniper_01', sourceCardType: 'SNIPER_WILL', markerData: { type: 'SNIPER', sourceType: 'THEORY_INCARNATION' } }
      }
    }
  };
  CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'METEOR_HOLE' });
  CardLogic.addMarker(cardState, 'specialStone', 0, 1, 'black', { type: 'BLOCKADE', remainingOwnerTurns: 3 });
  CardLogic.addMarker(cardState, 'specialStone', 0, 2, 'black', { type: 'FREEZE', remainingOwnerTurns: 2 });
  CardLogic.addMarker(cardState, 'manifestStone', 3, 3, 'black', {
    type: 'THEORY_INCARNATION',
    remainingOwnerTurns: 3,
    absoluteProtected: true,
    sourceType: 'THEORY_INCARNATION',
    sessionId: 'theory_black_1'
  });

  const result = CardLogic.processTheoryIncarnationMarkerAtTurnStart(cardState, gameState, 'black', 3, 3, prng);

  expect(result.spawned).toEqual(expect.objectContaining({ row: 0, col: 3, type: 'SNIPER' }));
  expect(result.spawned.roulette.candidateCells).toEqual([{ row: 0, col: 3 }]);
  expect(gameState.board[0][3]).toBe(Shared.BLACK);
  expect(gameState.board[0][0]).toBe(Shared.EMPTY);
});
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts
```

Expected before implementation: the new tests fail because blocked empty cells are included.

- [ ] **Step 4: Implement theory blocked-cell predicate**

In `theory-incarnation.ts`, change `getBoardCells` and `isCellAvailableForTheorySpawn` to use an injected `isBlockedCell`:

```ts
function isBlockedForTheory(cardState: any, gameState: GameState, row: number, col: number, deps: any): boolean {
    if (deps && typeof deps.isBlockedCell === 'function') {
        return deps.isBlockedCell(cardState, row, col, gameState) === true;
    }
    return false;
}

function getBoardCells(cardState: CardState, gameState: GameState, deps: any): Array<{ row: number; col: number }> {
    const board = gameState && Array.isArray((gameState as any).board) ? (gameState as any).board : [];
    const cells: Array<{ row: number; col: number }> = [];
    for (let row = 0; row < board.length; row += 1) {
        const line = Array.isArray(board[row]) ? board[row] : [];
        for (let col = 0; col < line.length; col += 1) {
            const value = typeof deps.getCellValueForCard === 'function'
                ? deps.getCellValueForCard(gameState, row, col)
                : line[col];
            if (!(value === deps.EMPTY || value === 0)) continue;
            if (isBlockedForTheory(cardState, gameState, row, col, deps)) continue;
            cells.push({ row, col });
        }
    }
    return cells;
}
```

Update the call in `applyTheoryIncarnationUsage`:

```ts
for (const cell of getBoardCells(cardState, gameState, deps)) {
```

Update `isCellAvailableForTheorySpawn`:

```ts
if (isBlockedForTheory(cardState, gameState, row, col, deps)) return false;
```

In `cards.ts`, add `isBlockedCell` to `getTheoryIncarnationResolutionDeps()`:

```ts
isBlockedCell,
```

- [ ] **Step 5: Verify theory tests pass**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Only if no unrelated files are staged:

```powershell
git add game/logic/card-resolution/theory-incarnation.ts game/logic/cards.ts test/game.theory-incarnation.test.ts
git commit -m "Fix theory incarnation blocked roulette targets"
```

---

### Task 2: Breeding Candidate Filtering and Spawn Failure Semantics

**Files:**
- Modify: `game/logic/cards.ts`
- Modify: `game/logic/cards/breeding.ts`
- Modify: `game/logic/cards-internal/spawn-and-flip.ts`
- Test: `test/game.breeding-frontier.test.ts`
- Test: `test/game.cards.spawn-and-flip-module.test.ts`

- [ ] **Step 1: Update shared spawn-and-flip tests**

In `test/game.cards.spawn-and-flip-module.test.ts`, change the existing bookkeeping test's `spawnAt` mock to a successful result:

```ts
const spawnAt = jest.fn(() => ({ spawned: true, stoneId: 'spawn-1' }));
```

Add a new failure test:

```ts
test('does not report spawned or apply generated flips when BoardOps rejects spawn', () => {
  const cardState = { markers: [] };
  const gameState = { board: createBoard() };
  const spawnAt = jest.fn(() => ({ spawned: false, reason: 'blocked_destination' }));
  const changeAt = jest.fn(() => ({ changed: true }));

  const result = spawnAndFlipBatch(
    cardState,
    gameState,
    'black',
    1,
    [{ row: 2, col: 2 }],
    'BREEDING',
    'breeding_spawned',
    { row: 3, col: 3 },
    {
      BoardOps: { spawnAt, changeAt },
      getCardContext: () => ({ protectedStones: [] }),
      getFlipsWithContext: () => [[2, 3]]
    }
  );

  expect(result).toEqual({ spawned: [], flipped: [] });
  expect(spawnAt).toHaveBeenCalledTimes(1);
  expect(changeAt).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add breeding hole/freeze regression tests**

In `test/game.breeding-frontier.test.ts`, add:

```ts
test('does not spawn breeding stone onto meteor hole cell', () => {
  const { cardState, gameState } = makeState();
  const prng = { random: () => 0.0 };
  placeBreedingAnchor(cardState, gameState, 3, 3);
  for (const [r, c] of [[2,3],[2,4],[3,2],[3,4],[4,2],[4,3],[4,4]]) {
    gameState.board[r][c] = 1;
  }
  cardState.markers.push({ id: 902, kind: 'specialStone', row: 2, col: 2, owner: 'black', data: { type: 'METEOR_HOLE' } });

  const immediate = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, 'black', 3, 3, prng);

  expect(immediate.spawned).toHaveLength(0);
  expect(gameState.board[2][2]).toBe(0);
  expect(cardState.breedingFrontierByAnchorId['101']).toEqual([]);
});

test('does not spawn breeding stone onto empty frozen cell', () => {
  const { cardState, gameState } = makeState();
  const prng = { random: () => 0.0 };
  placeBreedingAnchor(cardState, gameState, 3, 3);
  for (const [r, c] of [[2,3],[2,4],[3,2],[3,4],[4,2],[4,3],[4,4]]) {
    gameState.board[r][c] = 1;
  }
  cardState.markers.push({ id: 903, kind: 'specialStone', row: 2, col: 2, owner: 'black', data: { type: 'FREEZE', remainingOwnerTurns: 2 } });

  const immediate = CardLogic.processBreedingEffectsAtAnchor(cardState, gameState, 'black', 3, 3, prng);

  expect(immediate.spawned).toHaveLength(0);
  expect(gameState.board[2][2]).toBe(0);
  expect(cardState.breedingFrontierByAnchorId['101']).toEqual([]);
});
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.spawn-and-flip-module.test.ts test/game.breeding-frontier.test.ts
```

Expected before implementation: new tests fail.

- [ ] **Step 4: Pass `isBlockedCell` into breeding deps**

In all three breeding wrapper calls in `game/logic/cards.ts`, add:

```ts
isBlockedCell,
```

The three wrappers are:
- `processBreedingEffects`
- `processBreedingEffectsAtAnchor`
- `processBreedingEffectsAtTurnStartAnchor`

- [ ] **Step 5: Broaden breeding fallback block check**

In `game/logic/cards/breeding.ts`, update the fallback in `_isBlockedByBlockade` so standalone module use also rejects all blocking cell markers:

```ts
const type = String(marker && marker.data && marker.data.type ? marker.data.type : '').toUpperCase();
if (type !== 'BLOCKADE' && type !== 'METEOR_HOLE' && type !== 'FREEZE') return false;
```

- [ ] **Step 6: Fix shared spawn-and-flip failure handling**

In `game/logic/cards-internal/spawn-and-flip.ts`, after `spawnAt`, skip failed targets:

```ts
if (deps.BoardOps && (!spawnRes || spawnRes.spawned !== true)) {
    continue;
}
```

Place this before `spawned.push(...)` and before `resolveGeneratedFlipBatch(...)`.

- [ ] **Step 7: Mirror the local fallback in breeding**

In `game/logic/cards/breeding.ts`, update `_spawnAndFlipBatchLocal` with the same guard:

```ts
if (deps.BoardOps && (!spawnRes || spawnRes.spawned !== true)) {
    continue;
}
```

Place it before the local `spawned.push(...)` and before flip processing.

- [ ] **Step 8: Verify breeding/spawn tests pass**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.spawn-and-flip-module.test.ts test/game.breeding-frontier.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add game/logic/cards.ts game/logic/cards/breeding.ts game/logic/cards-internal/spawn-and-flip.ts test/game.breeding-frontier.test.ts test/game.cards.spawn-and-flip-module.test.ts
git commit -m "Fix breeding blocked spawn bookkeeping"
```

---

### Task 3: Ribo and Time Stop God Self-Destruction Candidates

**Files:**
- Modify: `game/logic/cards.ts`
- Modify: `game/logic/cards-internal/ribo-time-stop.ts`
- Test: `test/game.ribo-will.test.ts`
- Test: `test/game.time-stop-god.test.ts`

- [ ] **Step 1: Add RIBO regression test**

In `test/game.ribo-will.test.ts`, add:

```ts
test('布石不足のランダム自石破壊は絶対保護・不可侵・守護・凍結を候補にしない', () => {
  const { prng, cardState, gameState } = makeState(0);
  cardState.debugNoDraw = true;
  cardState.lastTurnStartedFor = 'white';
  cardState.charge.black = 0;
  cardState.riboRepaymentsByPlayer.black = [{
    remainingOwnerTurns: 9,
    repaymentAmount: 4,
    shortageDestroyCount: 4
  }];
  for (let col = 0; col < 5; col += 1) gameState.board[0][col] = SharedConstants.BLACK;
  CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'ABSOLUTE_PROTECTED', remainingOwnerTurns: 5 });
  CardLogic.addMarker(cardState, 'manifestStone', 0, 1, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 3, absoluteProtected: true });
  CardLogic.addMarker(cardState, 'specialStone', 0, 2, 'black', { type: 'GUARD', remainingOwnerTurns: 3 });
  CardLogic.addMarker(cardState, 'specialStone', 0, 3, 'black', { type: 'FREEZE', remainingOwnerTurns: 2 });

  const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' }, prng);
  const shortageEvent = res.events.find((event) => event && event.type === 'ribo_will_shortage');

  expect(shortageEvent).toMatchObject({ destroyedCount: 1, remainingOwnerTurns: 8 });
  expect(gameState.board[0][0]).toBe(SharedConstants.BLACK);
  expect(gameState.board[0][1]).toBe(SharedConstants.BLACK);
  expect(gameState.board[0][2]).toBe(SharedConstants.BLACK);
  expect(gameState.board[0][3]).toBe(SharedConstants.BLACK);
  expect(gameState.board[0][4]).toBe(SharedConstants.EMPTY);
});
```

- [ ] **Step 2: Add Time Stop God regression test**

In `test/game.time-stop-god.test.ts`, add:

```ts
test('時間停石コストは絶対保護・不可侵の自石を破壊候補に数えない', () => {
  const { prng, cardState, gameState } = makeState();
  for (let col = 0; col < Shared.TIME_STOP_GOD_SELF_DESTROY_COUNT; col += 1) {
    gameState.board[0][col] = Shared.BLACK;
  }
  CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'ABSOLUTE_PROTECTED', remainingOwnerTurns: 5 });
  CardLogic.addMarker(cardState, 'manifestStone', 0, 1, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 3, absoluteProtected: true });
  CardLogic.addMarker(cardState, 'manifestStone', 0, 2, 'black', { type: 'BOARD_EXECUTOR', remainingOwnerTurns: 4, absoluteProtected: true });

  expect(CardLogic.getTimeStopGodDestroyableCount(cardState, gameState, 'black')).toBe(0);
});
```

If `makeState()` in that file does not expose `prng`, use the local helper names already present in `test/game.time-stop-god.test.ts`.

- [ ] **Step 3: Run failing tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.ribo-will.test.ts test/game.time-stop-god.test.ts
```

Expected before implementation: new tests fail.

- [ ] **Step 4: Inject absolute-protection helper into ribo/time-stop deps**

In `getCardRiboTimeStopDeps()` in `game/logic/cards.ts`, add:

```ts
isAbsoluteProtectedCell,
```

- [ ] **Step 5: Add destroyable self-stone predicate**

In `game/logic/cards-internal/ribo-time-stop.ts`, add a helper near the collectors:

```ts
function isSelfStoneDestroyableForCost(cardState: any, row: number, col: number, deps: RiboTimeStopDeps, options: any = {}) {
    if (deps.isGuardProtectedCell(cardState, row, col)) return false;
    if (typeof deps.isAbsoluteProtectedCell === 'function' && deps.isAbsoluteProtectedCell(cardState, row, col)) return false;
    if (options.excludeFrozen === true && deps.isFrozenCellForCard(cardState, row, col)) return false;
    if (options.excludeDestroyEvade === true) {
        const marker = deps.findSpecialMarkerAt(cardState, row, col);
        const destroyEvadeRemaining = Number(marker && marker.data && marker.data.destroyEvadeRemaining);
        if (Number.isFinite(destroyEvadeRemaining) && destroyEvadeRemaining > 0) return false;
    }
    return true;
}
```

Update the `RiboTimeStopDeps` type with:

```ts
isAbsoluteProtectedCell: (cardState: any, row: any, col: any) => boolean;
```

- [ ] **Step 6: Use the predicate in collectors**

In `collectRiboDestroyableOwnStonePositions`, replace guard-only checks:

```ts
if (!isSelfStoneDestroyableForCost(cardState, row, col, deps, { excludeFrozen: true })) continue;
```

For `collectTimeStopGodDestroyableOwnStonePositions`, simplify to:

```ts
return collectRiboDestroyableOwnStonePositions(cardState, gameState, playerKey, deps).filter((pos: any) => {
    if (!pos) return false;
    return isSelfStoneDestroyableForCost(cardState, pos.row, pos.col, deps, {
        excludeFrozen: true,
        excludeDestroyEvade: true
    });
});
```

If this double-checks guard/absolute, keep it for clarity; the list is small and deterministic.

- [ ] **Step 7: Verify tests pass**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.ribo-will.test.ts test/game.time-stop-god.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add game/logic/cards.ts game/logic/cards-internal/ribo-time-stop.ts test/game.ribo-will.test.ts test/game.time-stop-god.test.ts
git commit -m "Exclude protected self-destruction cost targets"
```

---

### Task 4: Observer Will Repayment Candidates

**Files:**
- Modify: `game/logic/cards.ts`
- Modify: `game/logic/card-resolution/observer-will.ts`
- Test: `test/game.observer-will-repayment.test.ts`

- [ ] **Step 1: Add observer repayment regression test**

In `test/game.observer-will-repayment.test.ts`, add:

```ts
test('shortage destruction excludes guarded and frozen own stones', () => {
  const cardState = createCardState();
  const gameState = createGameState();
  gameState.board = [
    [1, 1, 1],
    [0, 0, 0],
    [0, 0, 0]
  ];
  cardState.charge.black = 0;
  CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'GUARD', remainingOwnerTurns: 3 });
  CardLogic.addMarker(cardState, 'specialStone', 0, 1, 'black', { type: 'FREEZE', remainingOwnerTurns: 2 });
  cardState.observerWillRepaymentsByPlayer.black.push({
    sourceType: 'OBSERVER_WILL',
    status: 'active',
    stolenCardId: 'meteor_01',
    repaymentAmount: 3,
    remainingOwnerTurns: 9,
    shortageDestroyCount: 4
  });

  const summary = CardLogic.processObserverWillRepaymentsAtTurnStart(cardState, gameState, 'black', createPrng());

  expect(summary.entries[0]).toEqual(expect.objectContaining({
    shortage: true,
    destroyedCount: 1,
    destroyed: [{ row: 0, col: 2 }]
  }));
  expect(gameState.board[0][0]).toBe(1);
  expect(gameState.board[0][1]).toBe(1);
  expect(gameState.board[0][2]).toBe(0);
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.observer-will-repayment.test.ts
```

Expected before implementation: new test fails with `destroyedCount: 0` or attempts protected candidates first.

- [ ] **Step 3: Inject guard/frozen helpers into observer deps**

In `getObserverWillResolutionDeps()` in `game/logic/cards.ts`, add:

```ts
isGuardProtectedCell,
isFrozenCellForCard,
```

- [ ] **Step 4: Filter observer self-destruction candidates**

In `collectObserverWillDestroyableOwnStones` in `game/logic/card-resolution/observer-will.ts`, add after the absolute check:

```ts
if (typeof deps.isGuardProtectedCell === 'function' && deps.isGuardProtectedCell(cardState, row, col)) continue;
if (typeof deps.isFrozenCellForCard === 'function' && deps.isFrozenCellForCard(cardState, row, col)) continue;
```

- [ ] **Step 5: Verify observer tests pass**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.observer-will-repayment.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add game/logic/cards.ts game/logic/card-resolution/observer-will.ts test/game.observer-will-repayment.test.ts
git commit -m "Exclude protected observer repayment targets"
```

---

### Task 5: Documentation and Focused Regression Sweep

**Files:**
- Maybe modify: `01-rulebook.md`
- Maybe modify: `cards/card-interaction-effects.ts`

- [ ] **Step 1: Check rule text for candidate semantics**

Run:

```powershell
rg -n "返済|ランダム.*破壊|理論数字|繁殖|時間停石|観測者|穴マス|凍結|守護|絶対保護|不可侵" 01-rulebook.md cards/card-interaction-effects.ts
```

Expected: identify whether text explicitly allows impossible protected targets.

- [ ] **Step 2: Update only misleading visible text**

If text needs clarification, use this wording pattern in `01-rulebook.md` near the relevant card sections:

```md
- ランダム自石破壊の候補は、実際に破壊できる自分の石に限る。完全保護・凍結・絶対保護・不可侵顕現石など、破壊できない石は候補に含めない
```

For theory wording, use:

```md
- 理論数字マス化とルーレット候補は、現在配置可能な通常空きマスに限る。穴マス・封鎖マス・凍結マスは候補に含めない
```

For breeding wording, use:

```md
- 生成候補は周囲8マスの通常空きマスに限る。穴マス・封鎖マス・凍結マスには生成しない
```

- [ ] **Step 3: Run all focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts test/game.breeding-frontier.test.ts test/game.cards.spawn-and-flip-module.test.ts test/game.ribo-will.test.ts test/game.time-stop-god.test.ts test/game.observer-will-repayment.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run:

```powershell
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Inspect final diff**

Run:

```powershell
git status --short
git diff -- game/logic/card-resolution/theory-incarnation.ts game/logic/cards.ts game/logic/cards/breeding.ts game/logic/cards-internal/spawn-and-flip.ts game/logic/cards-internal/ribo-time-stop.ts game/logic/card-resolution/observer-will.ts test/game.theory-incarnation.test.ts test/game.breeding-frontier.test.ts test/game.cards.spawn-and-flip-module.test.ts test/game.ribo-will.test.ts test/game.time-stop-god.test.ts test/game.observer-will-repayment.test.ts 01-rulebook.md cards/card-interaction-effects.ts
```

Expected: only intentional files changed for this fix. Existing unrelated dirty files must remain unstaged.

- [ ] **Step 6: Commit docs/final verification if changed**

If Task 5 changed docs or visible text:

```powershell
git add 01-rulebook.md cards/card-interaction-effects.ts
git commit -m "Clarify random protected target exclusions"
```

If Task 5 only ran verification, do not create a commit.

---

## Final Verification

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts test/game.breeding-frontier.test.ts test/game.cards.spawn-and-flip-module.test.ts test/game.ribo-will.test.ts test/game.time-stop-god.test.ts test/game.observer-will-repayment.test.ts
npm run typecheck
```

If these pass and no generated/mirror files are intentionally affected, stop. Do not run `worker:prepare` unless a later implementation changes generated deploy assets or catalog output.

## Self-Review Notes

- Spec coverage: theory roulette, theory number-cell rewrite, breeding spawn, shared spawn bookkeeping, RIBO shortage, Time Stop God cost, Observer repayment all have a task and a focused test.
- No placeholders: every code-changing step includes exact target files, snippets, and commands.
- Type consistency: new injected helpers use existing names from `cards.ts`: `isBlockedCell`, `isAbsoluteProtectedCell`, `isGuardProtectedCell`, `isFrozenCellForCard`.
