'use strict';

const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const BoardOps = require('../game/logic/board_ops');

function createPrng(sequence = [0.5]) {
  let index = 0;
  return {
    shuffle: (arr) => arr,
    random: () => {
      const safeIndex = Math.min(index, sequence.length - 1);
      const value = sequence[safeIndex];
      index += 1;
      return value;
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

function createBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY));
}

function createCardState(prng, cardId, cost) {
  const cardState = CardLogic.createCardState(prng);
  cardState.debugNoDraw = true;
  cardState.hands.black = [cardId];
  cardState.charge.black = Math.max(99, Number(cost) || 0);
  return cardState;
}

function getReinforcementDef() {
  return (Shared.CARD_DEFS || []).find((card) => card && card.type === 'REINFORCEMENT_WILL');
}

function getReinforcementSpawnEvents(result) {
  return (result.presentationEvents || []).filter((event) => (
    event &&
    event.type === 'SPAWN' &&
    event.cause === 'REINFORCEMENT_WILL' &&
    event.reason === 'reinforcement_will_spawn'
  ));
}

function getReinforcementFlipEvents(result) {
  return (result.presentationEvents || []).filter((event) => (
    event &&
    event.type === 'CHANGE' &&
    event.cause === 'REINFORCEMENT_WILL' &&
    event.reason === 'reinforcement_will_flip'
  ));
}

describe('REINFORCEMENT_WILL（増援の意志）', () => {
  const reinforcementDef = getReinforcementDef();

  test('角辺以外で石に隣接する空きマスだけを候補にする', () => {
    expect(reinforcementDef).toBeTruthy();

    const board = createBoard();
    board[3][3] = Shared.BLACK;

    const gameState = createGameState(board);
    const cardState = createCardState(createPrng([0]), reinforcementDef.id, reinforcementDef.cost);

    expect(CardLogic.getReinforcementWillTargets(cardState, gameState, 'black')).toEqual([
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
      { row: 4, col: 4 }
    ]);
    expect(CardLogic.canUseReinforcementWillForPlayer(cardState, gameState, 'black')).toBe(true);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain(reinforcementDef.id);
  });

  test('候補が無い局面では使用できない', () => {
    expect(reinforcementDef).toBeTruthy();

    const board = createBoard();

    const gameState = createGameState(board);
    const cardState = createCardState(createPrng([0]), reinforcementDef.id, reinforcementDef.cost);

    expect(CardLogic.getReinforcementWillTargets(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).not.toContain(reinforcementDef.id);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', reinforcementDef.id)).toBe(false);
  });

  test('use_cardで即時解決し、反転0でも石に隣接する内側空きへ1個配置できる', () => {
    expect(reinforcementDef).toBeTruthy();

    const board = createBoard();
    board[3][3] = Shared.BLACK;

    const prng = createPrng([0]);
    const cardState = createCardState(prng, reinforcementDef.id, reinforcementDef.cost);
    const gameState = createGameState(board);

    const spawnSpy = jest.spyOn(BoardOps, 'spawnAt');
    try {
      const result = TurnPipeline.applyTurn(
        cardState,
        gameState,
        'black',
        { type: 'use_card', useCardId: reinforcementDef.id },
        prng
      );

      const resolveEvent = result.events.find((event) => event && event.type === 'reinforcement_will_resolved');
      const spawnEvents = getReinforcementSpawnEvents(result);
      const flipEvents = getReinforcementFlipEvents(result);

      expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
      expect(resolveEvent).toMatchObject({
        type: 'reinforcement_will_resolved',
        player: 'black',
        requestedCount: 1,
        spawnedCount: 1,
        flippedCount: 0
      });
      expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([[2, 2]]);
      expect(resolveEvent.flipped || []).toEqual([]);

      expect(spawnSpy).toHaveBeenCalledTimes(1);
      expect(spawnSpy.mock.calls[0][2]).toBe(2);
      expect(spawnSpy.mock.calls[0][3]).toBe(2);
      expect(spawnSpy.mock.calls[0][4]).toBe('black');
      expect(spawnSpy.mock.calls[0][5]).toBe('REINFORCEMENT_WILL');
      expect(spawnSpy.mock.calls[0][6]).toBe('reinforcement_will_spawn');

      expect(spawnEvents).toHaveLength(1);
      expect(spawnEvents[0]).toEqual(expect.objectContaining({
        row: 2,
        col: 2,
        cause: 'REINFORCEMENT_WILL',
        reason: 'reinforcement_will_spawn'
      }));
      expect(spawnEvents[0].meta).toEqual(expect.objectContaining({
        owner: 'black',
        requestedCount: 1,
        spawnIndex: 1
      }));

      expect(flipEvents).toEqual([]);
      expect(gameState.board[2][2]).toBe(Shared.BLACK);
      expect(gameState.board[3][3]).toBe(Shared.BLACK);
      expect(result.cardState.totalFlipCountByPlayer.black).toBe(0);
    } finally {
      spawnSpy.mockRestore();
    }
  });

  test('配置先で挟める列がある時は通常反転も行う', () => {
    expect(reinforcementDef).toBeTruthy();

    const board = createBoard();
    board[2][2] = Shared.BLACK;
    board[2][3] = Shared.WHITE;
    board[2][5] = Shared.WHITE;
    board[2][6] = Shared.BLACK;

    const previewCardState = createCardState(createPrng([0]), reinforcementDef.id, reinforcementDef.cost);
    const previewGameState = createGameState(board.map((row) => row.slice()));
    const targets = CardLogic.getReinforcementWillTargets(previewCardState, previewGameState, 'black');
    const targetIndex = targets.findIndex((cell) => cell && cell.row === 2 && cell.col === 4);
    expect(targetIndex).toBeGreaterThanOrEqual(0);

    const prng = createPrng([(targetIndex + 0.01) / targets.length]);
    const cardState = createCardState(prng, reinforcementDef.id, reinforcementDef.cost);
    const gameState = createGameState(board);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: reinforcementDef.id },
      prng
    );

    const resolveEvent = result.events.find((event) => event && event.type === 'reinforcement_will_resolved');
    const flipEvents = getReinforcementFlipEvents(result);

    expect(resolveEvent).toMatchObject({
      type: 'reinforcement_will_resolved',
      player: 'black',
      requestedCount: 1,
      spawnedCount: 1,
      flippedCount: 2
    });
    expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([[2, 4]]);
    expect(resolveEvent.flipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 3 }),
      expect.objectContaining({ row: 2, col: 5 })
    ]));
    expect(resolveEvent.flipped).toHaveLength(2);
    expect(flipEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 3, reason: 'reinforcement_will_flip' }),
      expect.objectContaining({ row: 2, col: 5, reason: 'reinforcement_will_flip' })
    ]));
    expect(flipEvents).toHaveLength(2);
    expect(gameState.board[2][3]).toBe(Shared.BLACK);
    expect(gameState.board[2][4]).toBe(Shared.BLACK);
    expect(gameState.board[2][5]).toBe(Shared.BLACK);
    expect(result.cardState.totalFlipCountByPlayer.black).toBe(2);
  });
});
