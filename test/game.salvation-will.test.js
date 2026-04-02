/* eslint-env jest */
const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const BoardOps = require('../game/logic/board_ops');

function createPrng(sequence = [0]) {
  let index = 0;
  return {
    shuffle: (arr) => arr,
    random: () => {
      const i = Math.min(index, sequence.length - 1);
      index += 1;
      return sequence[i];
    }
  };
}

function createGameState(board) {
  return {
    board,
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
}

function createSparseGameState(blackPositions, whitePositions) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
  for (const [row, col] of blackPositions || []) board[row][col] = Shared.BLACK;
  for (const [row, col] of whitePositions || []) board[row][col] = Shared.WHITE;
  return createGameState(board);
}

function getSalvationDef() {
  return (Shared.CARD_DEFS || []).find((c) => c && c.type === 'SALVATION_WILL');
}

function createCardState(prng, cardId, cost) {
  const cardState = CardLogic.createCardState(prng);
  cardState.debugNoDraw = true;
  cardState.hands.black = [cardId];
  cardState.charge.black = Math.max(99, Number(cost) || 0);
  return cardState;
}

function getSalvationSpawnEvents(result) {
  return (result.presentationEvents || []).filter((e) => (
    e &&
    e.type === 'SPAWN' &&
    e.cause === 'SALVATION_WILL' &&
    e.reason === 'salvation_spawn'
  ));
}

function getSalvationFlipEvents(result) {
  return (result.presentationEvents || []).filter((e) => (
    e &&
    e.type === 'CHANGE' &&
    e.cause === 'SALVATION_WILL' &&
    e.reason === 'salvation_flip'
  ));
}

describe('SALVATION_WILL（救済の意志）', () => {
  const salvationDef = getSalvationDef();

  test('catalog entry exists with correct id, type, and cost', () => {
    expect(salvationDef).toBeTruthy();
    expect(salvationDef.id).toBe('salvation_01');
    expect(salvationDef.type).toBe('SALVATION_WILL');
    expect(Number(salvationDef.cost)).toBe(17);
  });

  test('使用不可: 直前の相手ターンで破壊された自分の通常石が0枚の場合', () => {
    expect(salvationDef).toBeTruthy();
    const prng = createPrng([0]);
    const cardState = createCardState(prng, salvationDef.id, salvationDef.cost);
    const gameState = createSparseGameState([[3, 3]], [[4, 4]]);
    // No destroyed stones tracked
    cardState.prevOpponentTurnDestroyedNormalByPlayer = { black: [], white: [] };

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', salvationDef.id)).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('使用可能: 直前の相手ターンで自分の通常石が1枚以上破壊された場合', () => {
    expect(salvationDef).toBeTruthy();
    const prng = createPrng([0]);
    const cardState = createCardState(prng, salvationDef.id, salvationDef.cost);
    const gameState = createSparseGameState([[3, 3]], [[4, 4]]);
    cardState.prevOpponentTurnDestroyedNormalByPlayer = {
      black: [{ row: 2, col: 2 }],
      white: []
    };

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain(salvationDef.id);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', salvationDef.id)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'SALVATION_WILL' });
  });

  test('use_card: 破壊された石の数だけランダムな空きマスに石を生成し、復活石から通常反転する', () => {
    expect(salvationDef).toBeTruthy();
    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, salvationDef.id, salvationDef.cost);
    // First revived stone at (0,3) should flip the two white stones between it and the black stone at (0,0).
    const gameState = createSparseGameState(
      [[0, 0], [7, 7]],
      [[0, 1], [0, 2]]
    );
    // Simulate 2 black stones destroyed on opponent's previous turn
    cardState.prevOpponentTurnDestroyedNormalByPlayer = {
      black: [{ row: 1, col: 0 }, { row: 1, col: 1 }],
      white: []
    };

    const spawnSpy = jest.spyOn(BoardOps, 'spawnAt');
    try {
      const result = TurnPipeline.applyTurn(
        cardState,
        gameState,
        'black',
        { type: 'use_card', useCardId: salvationDef.id },
        prng
      );

      const resolveEvent = result.events.find((e) => e && e.type === 'salvation_will_resolved');
      const spawnEvents = getSalvationSpawnEvents(result);
      const flipEvents = getSalvationFlipEvents(result);

      expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
      expect(resolveEvent).toMatchObject({
        type: 'salvation_will_resolved',
        player: 'black',
        requestedCount: 2,
        spawnedCount: 2,
        flippedCount: 2
      });
      expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([
        [0, 3],
        [0, 4]
      ]);
      expect((resolveEvent.flipped || []).map((entry) => [entry.row, entry.col])).toEqual([
        [0, 2],
        [0, 1]
      ]);

      expect(spawnSpy).toHaveBeenCalledTimes(2);
      expect(spawnSpy.mock.calls.map((call) => [call[2], call[3]])).toEqual([
        [0, 3],
        [0, 4]
      ]);
      for (const call of spawnSpy.mock.calls) {
        expect(call[4]).toBe('black');
        expect(call[5]).toBe('SALVATION_WILL');
        expect(call[6]).toBe('salvation_spawn');
        expect(call[7]).toEqual(expect.objectContaining({ owner: 'black', requestedCount: 2 }));
      }

      expect(spawnEvents).toHaveLength(2);
      expect(spawnEvents.map((e) => [e.row, e.col])).toEqual([
        [0, 3],
        [0, 4]
      ]);
      expect(spawnEvents.map((e) => e.meta && e.meta.spawnIndex)).toEqual([1, 2]);
      expect(flipEvents.map((e) => [e.row, e.col])).toEqual([
        [0, 2],
        [0, 1]
      ]);
      expect(gameState.board[0][1]).toBe(Shared.BLACK);
      expect(gameState.board[0][2]).toBe(Shared.BLACK);
      expect(gameState.board[0][3]).toBe(Shared.BLACK);
      expect(gameState.board[0][4]).toBe(Shared.BLACK);
      expect(result.cardState.totalFlipCountByPlayer.black).toBe(2);
    } finally {
      spawnSpy.mockRestore();
    }
  });

  test('use_card後: 履歴が消費され2度目の救済はできない', () => {
    expect(salvationDef).toBeTruthy();
    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, salvationDef.id, salvationDef.cost);
    const gameState = createSparseGameState([[7, 7]], [[0, 0], [0, 1]]);
    cardState.prevOpponentTurnDestroyedNormalByPlayer = {
      black: [{ row: 1, col: 0 }],
      white: []
    };

    TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: salvationDef.id },
      prng
    );

    // History must be empty after use
    expect(cardState.prevOpponentTurnDestroyedNormalByPlayer.black).toEqual([]);

    // Attempting to use again (after re-adding to hand) should fail
    cardState.hands.black = [salvationDef.id];
    cardState.charge.black = 99;
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', salvationDef.id)).toBe(false);
  });

  test('特殊石は破壊されても救済の追跡対象に含まれない', () => {
    expect(salvationDef).toBeTruthy();
    const prng = createPrng([0]);
    const cardState = CardLogic.createCardState(prng);
    cardState.debugNoDraw = true;
    cardState._activeTurnPlayer = 'white';

    const gameState = createSparseGameState([[2, 2], [3, 3]], []);

    // Mark (2,2) as a special stone
    if (!Array.isArray(cardState.markers)) cardState.markers = [];
    const specialKind = 'specialStone';
    cardState.markers.push({ kind: specialKind, row: 2, col: 2 });

    // Initialize destruction tracking
    cardState.prevOpponentTurnDestroyedNormalByPlayer = { black: [], white: [] };

    // Destroy both black stones while white is the active turn player
    BoardOps.destroyAt(cardState, gameState, 2, 2, 'TEST', 'test_special');
    BoardOps.destroyAt(cardState, gameState, 3, 3, 'TEST', 'test_normal');

    const tracked = cardState.prevOpponentTurnDestroyedNormalByPlayer.black;
    // Only the normal stone at (3,3) should be tracked; the special stone at (2,2) is excluded
    expect(tracked).toHaveLength(1);
    expect(tracked[0]).toEqual({ row: 3, col: 3 });
  });

  test('封鎖された空きマスはスポーン候補から除外され、他の空きマスに生成される', () => {
    expect(salvationDef).toBeTruthy();
    const prng = createPrng([0, 0]);
    const cardState = createCardState(prng, salvationDef.id, salvationDef.cost);
    // Board: mostly white-filled; two empty cells at (5,0) and (6,0); black stone at (7,7)
    const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.WHITE));
    board[5][0] = Shared.EMPTY; // blocked below
    board[6][0] = Shared.EMPTY; // available
    board[7][7] = Shared.BLACK;
    const gameState = createGameState(board);

    // Place a BLOCKADE marker on (5,0) — the only blocked empty cell
    if (!Array.isArray(cardState.markers)) cardState.markers = [];
    cardState.markers.push({
      id: 'blockade_test_1',
      kind: 'specialStone',
      row: 5,
      col: 0,
      data: { type: 'BLOCKADE', remainingOwnerTurns: 3 }
    });

    // 2 stones destroyed → requests 2 spawns, but only 1 unblocked empty cell exists
    cardState.prevOpponentTurnDestroyedNormalByPlayer = {
      black: [{ row: 1, col: 0 }, { row: 2, col: 0 }],
      white: []
    };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: salvationDef.id },
      prng
    );

    const resolveEvent = result.events.find((e) => e && e.type === 'salvation_will_resolved');
    expect(resolveEvent).toMatchObject({ requestedCount: 2, spawnedCount: 1 });

    const spawnEvents = getSalvationSpawnEvents(result);
    expect(spawnEvents).toHaveLength(1);
    // Must have spawned on (6,0) — the unblocked empty cell — never on (5,0)
    expect(spawnEvents[0]).toMatchObject({ row: 6, col: 0 });
    const blockedUsed = spawnEvents.some((e) => e.row === 5 && e.col === 0);
    expect(blockedUsed).toBe(false);
  });

  test('空きマスが要求数より少ない場合は存在する数だけ生成する', () => {
    expect(salvationDef).toBeTruthy();
    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, salvationDef.id, salvationDef.cost);
    // Only 1 empty cell available; 3 stones were destroyed
    const board = Array.from({ length: 8 }, () => Array(8).fill(Shared.WHITE));
    board[7][7] = Shared.EMPTY;
    board[0][0] = Shared.BLACK; // black's 1 stone
    const gameState = createGameState(board);
    cardState.prevOpponentTurnDestroyedNormalByPlayer = {
      black: [{ row: 1, col: 0 }, { row: 1, col: 1 }, { row: 1, col: 2 }],
      white: []
    };

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: salvationDef.id },
      prng
    );

    const resolveEvent = result.events.find((e) => e && e.type === 'salvation_will_resolved');
    expect(resolveEvent).toMatchObject({
      requestedCount: 3,
      spawnedCount: 1
    });
    const spawnEvents = getSalvationSpawnEvents(result);
    expect(spawnEvents).toHaveLength(1);
    expect(spawnEvents[0].row).toBe(7);
    expect(spawnEvents[0].col).toBe(7);
  });
});
