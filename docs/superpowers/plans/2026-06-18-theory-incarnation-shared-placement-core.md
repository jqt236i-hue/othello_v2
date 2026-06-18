# Theory Incarnation Shared Placement Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route `理論の化身` special-stone materialization through a shared headless board placement and flip core so selected theory cells flip bracketed stones while zero-flip materialization still works.

**Architecture:** Extend the existing `game/logic/cards-internal/spawn-and-flip.ts` helper with a one-cell place-like core. Normal placement keeps turn-flow ownership in `game/turn/action-phase/place-resolution.ts`, while theory spawn keeps roulette ownership in `game/logic/card-resolution/theory-incarnation.ts` and calls the shared core only for board mutation. Immediate special-stone effects continue to use `game/turn/immediate-effect-dispatcher.ts`.

**Tech Stack:** TypeScript/CommonJS-compatible modules, Jest, existing `BoardOps`, existing `CardLogic`, existing turn pipeline.

---

## File Structure

- Modify: `01-rulebook.md`
  - Add the player-visible rule that theory-spawned stones flip bracketed lines but still appear with zero flips.
- Modify: `正本/カード仕様正本.md`
  - Mirror the same `理論の化身` behavior summary.
- Modify: `game/logic/cards-internal/spawn-and-flip.ts`
  - Add `spawnAndFlipPlacement` and export it beside `spawnAndFlipBatch`.
- Modify: `game/logic/cards.ts`
  - Expose the shared helper through dependencies used by normal placement and theory resolution.
- Modify: `game/turn/action-phase/place-resolution.ts`
  - Replace the embedded normal placement board-write block with `spawnAndFlipPlacement`.
- Modify: `game/logic/card-resolution/theory-incarnation.ts`
  - Use `spawnAndFlipPlacement` after roulette selection and before marker creation.
- Modify: `test/game.theory-incarnation.test.ts`
  - Add behavior tests for theory spawn flipping and zero-flip preservation.
- Modify: `test/game.cards.spawn-and-flip-module.test.ts`
  - Add unit tests for the new helper.

## Task 1: Document The Player-Visible Rule

**Files:**
- Modify: `01-rulebook.md`
- Modify: `正本/カード仕様正本.md`

- [ ] **Step 1: Update `01-rulebook.md`**

Under `### 10.23.1.0 THEORY_INCARNATION（理論の化身）`, add this bullet near the existing special-stone spawn bullets:

```markdown
- 理論の化身で出現する特殊石は、確定した理論数字マスへ通常配置と同じ反転判定で配置される。挟める列がある場合はその列の敵石を反転し、挟める列がない場合でも従来通り特殊石は出現する
```

- [ ] **Step 2: Update `正本/カード仕様正本.md`**

In the `理論の化身` row, add the same behavior to the description:

```markdown
出現時は確定マスで通常配置と同じ反転判定を行い、挟める列があれば反転する。挟める列がなくても特殊石の出現は成立する。
```

- [ ] **Step 3: Verify the docs mention both halves of the rule**

Run:

```powershell
rg -n "挟める列|通常配置と同じ反転判定|挟める列がなくても" 01-rulebook.md 正本/カード仕様正本.md
```

Expected: both files contain the new rule text.

## Task 2: RED Theory Behavior Tests

**Files:**
- Modify: `test/game.theory-incarnation.test.ts`

- [ ] **Step 1: Add a bracketed-line theory spawn test**

Add this test inside the existing `describe('理論の化身', () => {` block:

```ts
test('理論召喚は確定マスで挟める列があれば通常配置と同じ反転を行う', () => {
  const prng = createPrng([0]);
  const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
  const gameState = createGameState();
  gameState.currentPlayer = Shared.BLACK;
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
  gameState.board[0][0] = Shared.EMPTY;
  gameState.board[0][1] = Shared.WHITE;
  gameState.board[0][2] = Shared.BLACK;
  cardState.charge.black = 0;
  cardState.numberCellCollectedTotalByPlayer.black = 42;
  cardState.boardBonusByCell = { '0,0': 5 };
  cardState.boardBonusConsumedByCell = {};
  cardState.theoryNumberCellByCell = {
    '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' }
  };
  cardState.theoryNumberCellsBySession = {
    theory_black_1: {
      ownerKey: 'black',
      cells: {
        '0,0': {
          row: 0,
          col: 0,
          value: 5,
          originalValue: 0,
          originalConsumed: false,
          spawnType: 'GHOST',
          sourceCardId: 'ghost_01',
          sourceCardType: 'GHOST_WILL',
          sourceCardCost: 5,
          markerData: {
            type: 'GHOST',
            remainingOwnerTurns: 8,
            sourceType: 'THEORY_INCARNATION',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL'
          }
        }
      }
    }
  };
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
    white: null
  };
  CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
    type: 'THEORY_INCARNATION',
    remainingOwnerTurns: 5,
    absoluteProtected: true,
    sourceType: 'THEORY_INCARNATION'
  });

  const result = CardLogic.processTheoryIncarnationMarkerAtTurnStart(cardState, gameState, 'black', 2, 2, prng);

  expect(result.spawned).toEqual(expect.objectContaining({
    row: 0,
    col: 0,
    type: 'GHOST',
    flips: [{ row: 0, col: 1 }]
  }));
  expect(gameState.board[0][0]).toBe(Shared.BLACK);
  expect(gameState.board[0][1]).toBe(Shared.BLACK);
  expect(gameState.board[0][2]).toBe(Shared.BLACK);
  expect(cardState.charge.black).toBe(0);
  expect(cardState.numberCellCollectedTotalByPlayer.black).toBe(42);
  expect(cardState.boardBonusConsumedByCell['0,0']).toBe(true);
});
```

- [ ] **Step 2: Add a zero-flip preservation test**

Add this test next to the bracketed-line test:

```ts
test('理論召喚は挟める列がない確定マスでも従来通り特殊石を出現させる', () => {
  const prng = createPrng([0]);
  const cardState: any = CardLogic.createCardState(prng, { plainReversi: true });
  const gameState = createGameState();
  gameState.currentPlayer = Shared.BLACK;
  gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
  gameState.board[0][0] = Shared.EMPTY;
  cardState.boardBonusByCell = { '0,0': 5 };
  cardState.boardBonusConsumedByCell = {};
  cardState.theoryNumberCellByCell = {
    '0,0': { sessionId: 'theory_black_1', ownerKey: 'black' }
  };
  cardState.theoryNumberCellsBySession = {
    theory_black_1: {
      ownerKey: 'black',
      cells: {
        '0,0': {
          row: 0,
          col: 0,
          value: 5,
          originalValue: 0,
          originalConsumed: false,
          spawnType: 'GHOST',
          sourceCardId: 'ghost_01',
          sourceCardType: 'GHOST_WILL',
          sourceCardCost: 5,
          markerData: {
            type: 'GHOST',
            remainingOwnerTurns: 8,
            sourceType: 'THEORY_INCARNATION',
            sourceCardId: 'ghost_01',
            sourceCardType: 'GHOST_WILL'
          }
        }
      }
    }
  };
  cardState.theoryIncarnationStateByPlayer = {
    black: { sessionId: 'theory_black_1', ownerKey: 'black', remainingSpawnCount: 5 },
    white: null
  };
  CardLogic.addMarker(cardState, 'manifestStone', 2, 2, 'black', {
    type: 'THEORY_INCARNATION',
    remainingOwnerTurns: 5,
    absoluteProtected: true,
    sourceType: 'THEORY_INCARNATION'
  });

  const result = CardLogic.processTheoryIncarnationMarkerAtTurnStart(cardState, gameState, 'black', 2, 2, prng);

  expect(result.spawned).toEqual(expect.objectContaining({
    row: 0,
    col: 0,
    type: 'GHOST',
    flips: []
  }));
  expect(gameState.board[0][0]).toBe(Shared.BLACK);
  expect(cardState.markers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      row: 0,
      col: 0,
      owner: 'black',
      data: expect.objectContaining({
        type: 'GHOST',
        sourceType: 'THEORY_INCARNATION'
      })
    })
  ]));
  expect(cardState.boardBonusConsumedByCell['0,0']).toBe(true);
});
```

- [ ] **Step 3: Run RED tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts
```

Expected before implementation: the bracketed-line test fails because `gameState.board[0][1]` remains `Shared.WHITE`, and both new tests fail if `result.spawned.flips` is missing.

## Task 3: Add Unit Coverage For The Shared Core

**Files:**
- Modify: `test/game.cards.spawn-and-flip-module.test.ts`

- [ ] **Step 1: Import the new helper in the test file**

Change the import to:

```ts
const { spawnAndFlipBatch, spawnAndFlipPlacement } = require('../game/logic/cards-internal/spawn-and-flip');
```

- [ ] **Step 2: Add a unit test for bracketed placement**

Add this test:

```ts
test('spawnAndFlipPlacement spawns first and flips bracketed stones through BoardOps', () => {
  const cardState: any = {};
  const gameState: any = {
    board: [
      [0, -1, 1],
      [0, 0, 0],
      [0, 0, 0]
    ]
  };
  const calls: string[] = [];
  const BoardOps = {
    spawnAt: jest.fn((cs, gs, row, col, playerKey, cause, reason, meta) => {
      calls.push(`spawn:${row},${col}:${cause}:${reason}:${meta.special}`);
      gs.board[row][col] = 1;
      return { spawned: true, stoneId: 'stone_1' };
    }),
    changeAt: jest.fn((cs, gs, row, col, playerKey, cause, reason) => {
      calls.push(`change:${row},${col}:${cause}:${reason}`);
      gs.board[row][col] = 1;
      return { changed: true };
    })
  };

  const result = spawnAndFlipPlacement({
    cardState,
    gameState,
    playerKey: 'black',
    playerValue: 1,
    row: 0,
    col: 0,
    allowZeroFlips: false,
    BoardOps,
    getCardContext: () => ({}),
    getFlipsWithContext: () => [[0, 1]],
    spawnCause: 'THEORY_INCARNATION',
    spawnReason: 'theory_incarnation_spawn',
    flipCause: 'THEORY_INCARNATION',
    flipReason: 'theory_incarnation_flip',
    spawnMeta: { special: 'GHOST' }
  });

  expect(result).toEqual(expect.objectContaining({
    spawned: true,
    stoneId: 'stone_1',
    attemptedFlips: [[0, 1]],
    appliedFlips: [[0, 1]]
  }));
  expect(calls).toEqual([
    'spawn:0,0:THEORY_INCARNATION:theory_incarnation_spawn:GHOST',
    'change:0,1:THEORY_INCARNATION:theory_incarnation_flip'
  ]);
  expect(gameState.board[0]).toEqual([1, 1, 1]);
});
```

- [ ] **Step 3: Add a unit test for zero-flip rejection and allowance**

Add this test:

```ts
test('spawnAndFlipPlacement rejects zero flips unless allowZeroFlips is true', () => {
  const baseOptions: any = {
    cardState: {},
    gameState: { board: [[0]] },
    playerKey: 'black',
    playerValue: 1,
    row: 0,
    col: 0,
    BoardOps: {
      spawnAt: jest.fn((cs, gs, row, col) => {
        gs.board[row][col] = 1;
        return { spawned: true };
      }),
      changeAt: jest.fn()
    },
    getCardContext: () => ({}),
    getFlipsWithContext: () => [],
    spawnCause: 'SYSTEM',
    spawnReason: 'standard_place',
    flipCause: 'SYSTEM',
    flipReason: 'standard_flip'
  };

  expect(() => spawnAndFlipPlacement({ ...baseOptions, allowZeroFlips: false })).toThrow('Illegal move: no flips and zero-flip placement is not allowed');

  const result = spawnAndFlipPlacement({ ...baseOptions, allowZeroFlips: true });

  expect(result).toEqual(expect.objectContaining({
    spawned: true,
    attemptedFlips: [],
    appliedFlips: []
  }));
  expect(baseOptions.gameState.board[0][0]).toBe(1);
});
```

- [ ] **Step 4: Run RED unit tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.spawn-and-flip-module.test.ts
```

Expected before implementation: FAIL because `spawnAndFlipPlacement` is not exported.

## Task 4: Implement The Shared Placement Core

**Files:**
- Modify: `game/logic/cards-internal/spawn-and-flip.ts`

- [ ] **Step 1: Add exported types and helper function**

Add this function above the existing `const CardSpawnAndFlip = {` export object:

```ts
type SpawnAndFlipPlacementOptions = {
    cardState: SpawnAndFlipCardState;
    gameState: SpawnAndFlipGameState;
    playerKey: any;
    playerValue: any;
    row: number;
    col: number;
    allowZeroFlips: boolean;
    BoardOps?: SpawnAndFlipBoardOps | null;
    getCardContext?: (cardState: SpawnAndFlipCardState) => SpawnAndFlipContext;
    getFlipsWithContext?: (gameState: SpawnAndFlipGameState, row: number, col: number, playerValue: any, context: SpawnAndFlipContext) => Array<[number, number]>;
    resolveFlipEvasion?: (flips: Array<[number, number]>) => { remainingFlips?: Array<[number, number]> } | null;
    clearBombAt?: (cardState: SpawnAndFlipCardState, row: number, col: number) => void;
    clearHyperactiveAtPositions?: (cardState: SpawnAndFlipCardState, positions: SpawnAndFlipPosition[]) => void;
    spawnCause: string;
    spawnReason: string;
    flipCause: string;
    flipReason: string;
    spawnMeta?: Record<string, unknown> | null;
    flipMeta?: Record<string, unknown> | null;
};

function spawnAndFlipPlacement(options: SpawnAndFlipPlacementOptions): any {
    const opts = options || ({} as SpawnAndFlipPlacementOptions);
    const row = Number(opts.row);
    const col = Number(opts.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) {
        throw new Error('Illegal move: invalid placement cell');
    }
    const getCardContext = opts.getCardContext || (() => ({ protectedStones: [], permaProtectedStones: [] }));
    const getFlipsWithContext = opts.getFlipsWithContext || (() => []);
    const context = getCardContext(opts.cardState);
    const attemptedFlips = getFlipsWithContext(opts.gameState, row, col, opts.playerValue, context);
    if ((!Array.isArray(attemptedFlips) || attemptedFlips.length === 0) && !opts.allowZeroFlips) {
        throw new Error('Illegal move: no flips and zero-flip placement is not allowed');
    }

    const spawnRes = opts.BoardOps && typeof opts.BoardOps.spawnAt === 'function'
        ? opts.BoardOps.spawnAt(opts.cardState, opts.gameState, row, col, opts.playerKey, opts.spawnCause, opts.spawnReason, opts.spawnMeta || undefined)
        : (setBoardCell(opts.gameState, row, col, opts.playerValue), { spawned: true });
    if (spawnRes && spawnRes.spawned === false) {
        return { spawned: false, attemptedFlips, appliedFlips: [], flipEvadeResult: null };
    }

    let remainingFlips = Array.isArray(attemptedFlips) ? attemptedFlips.slice() : [];
    const flipEvadeResult = typeof opts.resolveFlipEvasion === 'function'
        ? opts.resolveFlipEvasion(remainingFlips)
        : null;
    if (flipEvadeResult && Array.isArray(flipEvadeResult.remainingFlips)) {
        remainingFlips = flipEvadeResult.remainingFlips.slice();
    }

    const appliedFlips: Array<[number, number]> = [];
    for (const [flipRow, flipCol] of remainingFlips) {
        const changeRes = opts.BoardOps && typeof opts.BoardOps.changeAt === 'function'
            ? opts.BoardOps.changeAt(opts.cardState, opts.gameState, flipRow, flipCol, opts.playerKey, opts.flipCause, opts.flipReason, opts.flipMeta || undefined)
            : (setBoardCell(opts.gameState, flipRow, flipCol, opts.playerValue), { changed: true });
        if (changeRes && changeRes.changed) {
            appliedFlips.push([flipRow, flipCol]);
        }
    }

    if (appliedFlips.length > 0 && typeof opts.clearBombAt === 'function') {
        for (const [flipRow, flipCol] of appliedFlips) {
            opts.clearBombAt(opts.cardState, flipRow, flipCol);
        }
    }
    if (appliedFlips.length > 0 && typeof opts.clearHyperactiveAtPositions === 'function') {
        opts.clearHyperactiveAtPositions(opts.cardState, appliedFlips.map(([flipRow, flipCol]) => ({ row: flipRow, col: flipCol })));
    }

    return {
        spawned: true,
        stoneId: spawnRes ? spawnRes.stoneId : undefined,
        attemptedFlips,
        appliedFlips,
        flipEvadeResult
    };
}
```

- [ ] **Step 2: Export the helper**

Change the export object to:

```ts
const CardSpawnAndFlip = {
    resolveGeneratedFlipBatch,
    spawnAndFlipBatch,
    spawnAndFlipPlacement
};
```

- [ ] **Step 3: Run unit tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.cards.spawn-and-flip-module.test.ts
```

Expected: PASS for the new helper tests and existing spawn-and-flip tests.

## Task 5: Route Normal Placement Through The Shared Core

**Files:**
- Modify: `game/turn/action-phase/place-resolution.ts`
- Modify: `game/logic/cards.ts`

- [ ] **Step 1: Expose a helper from `game/logic/cards.ts`**

Add a wrapper near `consumeGeneratedSpawnFlipResults` exports:

```ts
function spawnAndFlipPlacement(options: any) {
    if (!CardSpawnAndFlipModule || typeof CardSpawnAndFlipModule.spawnAndFlipPlacement !== 'function') {
        throw new Error('[cards.js] CardSpawnAndFlip.spawnAndFlipPlacement not available');
    }
    return CardSpawnAndFlipModule.spawnAndFlipPlacement(options);
}
```

Add `spawnAndFlipPlacement` to the returned `CardLogic` API object.

- [ ] **Step 2: Replace the embedded board-write block in normal placement**

In `game/turn/action-phase/place-resolution.ts`, replace the current section that starts with:

```ts
let flipEvadeResult = null;

if (opts.BoardOps && typeof opts.BoardOps.spawnAt === 'function') {
```

and ends before:

```ts
emitFlipEvadeEvents(opts.events, flipEvadeResult);
```

with:

```ts
const spawnCause = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'FREE_PLACEMENT' : 'SYSTEM';
const spawnReason = (pendingType === 'FREE_PLACEMENT' || pendingType === 'LAST_RESORT') ? 'free_placement_place' : 'standard_place';
const spawnMeta: Record<string, any> = {};
if (pendingType === 'GOLD_STONE') {
    spawnMeta.special = 'GOLD';
    spawnMeta.owner = opts.playerKey;
} else if (pendingType === 'RAINBOW_STONE') {
    spawnMeta.special = 'RAINBOW';
    spawnMeta.owner = opts.playerKey;
} else if (pendingType === 'SILVER_STONE') {
    spawnMeta.special = 'SILVER';
    spawnMeta.owner = opts.playerKey;
} else if (pendingType === 'CROSS_BOMB') {
    spawnMeta.special = 'CROSS_BOMB';
    spawnMeta.owner = opts.playerKey;
} else if (pendingType === 'X_BOMB') {
    spawnMeta.special = 'X_BOMB';
    spawnMeta.owner = opts.playerKey;
}
const flipCause = tabooReverseApplied ? 'TABOO_REVERSE_WILL' : 'SYSTEM';
const flipReason = tabooReverseApplied ? 'taboo_reverse_flip' : 'standard_flip';
const boardPlacement = opts.CardLogic.spawnAndFlipPlacement({
    cardState: opts.cardState,
    gameState: opts.gameState,
    playerKey: opts.playerKey,
    playerValue,
    row: action.row,
    col: action.col,
    allowZeroFlips: freePlacement,
    BoardOps: opts.BoardOps,
    getCardContext: () => ctx,
    getFlipsWithContext: () => flips,
    resolveFlipEvasion: (candidateFlips: any[]) => (
        candidateFlips.length > 0 && typeof opts.CardLogic.resolveHyperactiveFlipEvasion === 'function'
            ? opts.CardLogic.resolveHyperactiveFlipEvasion(opts.cardState, opts.gameState, candidateFlips, opts.playerKey, p)
            : null
    ),
    clearBombAt: typeof opts.CardLogic.clearBombAt === 'function' ? opts.CardLogic.clearBombAt.bind(opts.CardLogic) : undefined,
    clearHyperactiveAtPositions: typeof opts.CardLogic.clearHyperactiveAtPositions === 'function' ? opts.CardLogic.clearHyperactiveAtPositions.bind(opts.CardLogic) : undefined,
    spawnCause,
    spawnReason,
    flipCause,
    flipReason,
    spawnMeta: Object.keys(spawnMeta).length > 0 ? spawnMeta : null,
    flipMeta: tabooReverseApplied ? { allowGhostFlip: true } : null
});
flipEvadeResult = boardPlacement.flipEvadeResult || null;
flips = Array.isArray(boardPlacement.appliedFlips) ? boardPlacement.appliedFlips.slice() : [];
flipCount = flips.length;
if (tabooReverseApplied && opts.CardLogic && typeof opts.CardLogic.transferCellMarkerOwnership === 'function') {
    for (const [fr, fc] of flips) {
        opts.CardLogic.transferCellMarkerOwnership(opts.cardState, fr, fc, opts.playerKey);
    }
}
```

- [ ] **Step 3: Remove duplicate post-flip cleanup**

Remove the following blocks in `place-resolution.ts` that call `clearBombAt` and `clearHyperactiveAtPositions` for primary flips, because `spawnAndFlipPlacement` now owns that cleanup:

```ts
if (!tabooReverseApplied && flips.length > 0 && typeof opts.CardLogic.clearBombAt === 'function') {
    for (const [row, col] of flips) {
        opts.CardLogic.clearBombAt(opts.cardState, row, col);
    }
}
if (!tabooReverseApplied && flips.length > 0 && typeof opts.CardLogic.clearHyperactiveAtPositions === 'function') {
    const flippedPositions = flips.map(([row, col]: [any, any]) => ({ row, col }));
    opts.CardLogic.clearHyperactiveAtPositions(opts.cardState, flippedPositions);
}
```

- [ ] **Step 4: Run normal placement regression tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.card-effects.placement.test.ts test/game.free-placement-like-pending.test.ts test/cards.pending-selection-contract.test.ts test/workers.match-publish-sanitize.test.ts
```

Expected: PASS.

## Task 6: Route Theory Spawn Through The Shared Core

**Files:**
- Modify: `game/logic/cards.ts`
- Modify: `game/logic/card-resolution/theory-incarnation.ts`

- [ ] **Step 1: Add dependencies to theory resolution**

In `getTheoryIncarnationResolutionDeps()` in `game/logic/cards.ts`, add:

```ts
Core,
BoardOps: BoardOpsModule,
spawnAndFlipPlacement,
resolveSafeCardContext,
resolveHyperactiveFlipEvasion,
clearBombAt,
clearHyperactiveAtPositions
```

- [ ] **Step 2: Replace direct `spawnAt` in `spawnTheorySpecialStone`**

In `game/logic/card-resolution/theory-incarnation.ts`, replace the direct `deps.spawnAt` call block with:

```ts
const ownerValue = ownerKey === 'white' ? deps.WHITE : deps.BLACK;
const boardPlacement = typeof deps.spawnAndFlipPlacement === 'function'
    ? deps.spawnAndFlipPlacement({
        cardState,
        gameState,
        playerKey: ownerKey,
        playerValue: ownerValue,
        row: picked.cell.row,
        col: picked.cell.col,
        allowZeroFlips: true,
        BoardOps: deps.BoardOps,
        getCardContext: () => (
            typeof deps.resolveSafeCardContext === 'function'
                ? deps.resolveSafeCardContext(cardState)
                : { protectedStones: [], permaProtectedStones: [] }
        ),
        getFlipsWithContext: deps.Core && typeof deps.Core.getFlipsWithContext === 'function'
            ? deps.Core.getFlipsWithContext
            : (() => []),
        resolveFlipEvasion: (candidateFlips: any[]) => (
            candidateFlips.length > 0 && typeof deps.resolveHyperactiveFlipEvasion === 'function'
                ? deps.resolveHyperactiveFlipEvasion(cardState, gameState, candidateFlips, ownerKey, prng)
                : null
        ),
        clearBombAt: typeof deps.clearBombAt === 'function' ? deps.clearBombAt : undefined,
        clearHyperactiveAtPositions: typeof deps.clearHyperactiveAtPositions === 'function' ? deps.clearHyperactiveAtPositions : undefined,
        spawnCause: THEORY_MARKER_TYPE,
        spawnReason: 'theory_incarnation_spawn',
        flipCause: THEORY_MARKER_TYPE,
        flipReason: 'theory_incarnation_flip',
        spawnMeta: {
            special: markerData.type,
            owner: ownerKey,
            sourceCardId: picked.cell.sourceCardId || null,
            sourceCardType: picked.cell.sourceCardType || null,
            theorySpawnRoulette: roulette
        }
    })
    : null;
if (!boardPlacement || boardPlacement.spawned !== true) return null;
```

- [ ] **Step 3: Preserve marker creation and add flips to the result payload**

Keep the existing `deps.addMarker` call after the shared core call. Change the returned payload to include:

```ts
flips: Array.isArray(boardPlacement.appliedFlips)
    ? boardPlacement.appliedFlips.map(([row, col]: [number, number]) => ({ row, col }))
    : []
```

- [ ] **Step 4: Run theory tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts
```

Expected: PASS, including the new bracketed-line and zero-flip tests.

## Task 7: Verify Presentation And Immediate Effects

**Files:**
- Test: `test/ui.theory-incarnation-animation.test.ts`
- Test: `test/ui.stone-rendering.test.ts`
- Test: `test/shared.playback-event-helpers.test.ts`

- [ ] **Step 1: Run focused presentation tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/ui.theory-incarnation-animation.test.ts test/ui.stone-rendering.test.ts test/shared.playback-event-helpers.test.ts
```

Expected: PASS. This confirms roulette metadata, stone rendering counters, and playback helper output still work.

- [ ] **Step 2: Run immediate-effect focused tests**

Run:

```powershell
npm run test:jest -- --runTestsByPath test/game.theory-incarnation.test.ts test/game.cards.spawn-and-flip-module.test.ts
```

Expected: PASS. This confirms `意志狩りの王` and other theory-spawn immediate effects still flow through the existing dispatcher.

## Task 8: Build, Mirror, And Commit

**Files:**
- Generated/mirror after source changes: `dist/*`, `public/module-registry.js`, `worker-public/*`

- [ ] **Step 1: Run TypeScript checks**

Run:

```powershell
npm run typecheck
npm run build:ts
```

Expected: both commands exit 0.

- [ ] **Step 2: Run browser build**

Run:

```powershell
npm run build:browser
```

Expected: exits 0 and updates generated browser registry if required.

- [ ] **Step 3: Prepare worker mirror**

Run:

```powershell
npm run worker:prepare
```

Expected: exits 0 and verifies the worker mirror.

- [ ] **Step 4: Inspect diff before staging**

Run:

```powershell
git status --short
git diff -- 01-rulebook.md 正本/カード仕様正本.md game/logic/cards-internal/spawn-and-flip.ts game/logic/cards.ts game/turn/action-phase/place-resolution.ts game/logic/card-resolution/theory-incarnation.ts test/game.theory-incarnation.test.ts test/game.cards.spawn-and-flip-module.test.ts
```

Expected: only the implementation, tests, docs, and generated/mirror outputs intentionally produced by this plan are included. Pre-existing unrelated dirty files remain unstaged.

- [ ] **Step 5: Stage only this task's files**

Run:

```powershell
git add -- 01-rulebook.md 正本/カード仕様正本.md game/logic/cards-internal/spawn-and-flip.ts game/logic/cards.ts game/turn/action-phase/place-resolution.ts game/logic/card-resolution/theory-incarnation.ts test/game.theory-incarnation.test.ts test/game.cards.spawn-and-flip-module.test.ts
git add -- public/module-registry.js worker-public/index.html worker-public/public/module-registry.js
```

Only stage generated files if `git diff` shows they were produced by this implementation. Do not stage unrelated user work.

- [ ] **Step 6: Commit**

Run:

```powershell
git commit -m "Share placement core for theory spawn"
```

Expected: commit succeeds.

## Self Review

- Spec coverage: the plan updates player-visible docs, adds failing tests, adds the shared core, routes normal placement and theory spawn through it, verifies presentation and immediate effects, and runs build/mirror checks.
- Placeholder scan: the plan contains no placeholder tokens or open-ended implementation instructions.
- Type consistency: the new helper is named `spawnAndFlipPlacement` in tests, implementation, `cards.ts`, and theory resolution dependencies.
- Scope check: this plan intentionally does not refactor all normal pending marker construction into `SpecialStoneMarkerFactory`; that is separate from the board placement path and has a broader blast radius.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-18-theory-incarnation-shared-placement-core.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.

2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.
