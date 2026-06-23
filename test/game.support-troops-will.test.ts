'use strict';

const Shared = require('../shared-constants.js');
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as BoardOps from '../game/logic/board_ops.js';

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

function createBoard(fill = Shared.EMPTY) {
  return Array.from({ length: 8 }, () => Array(8).fill(fill));
}

function createCardState(prng, cardId, cost) {
  const cardState = CardLogic.createCardState(prng);
  cardState.debugNoDraw = true;
  cardState.hands.black = [cardId];
  cardState.charge.black = Math.max(99, Number(cost) || 0);
  return cardState;
}

function getSupportTroopsDef() {
  return (Shared.CARD_DEFS || []).find((card) => card && card.type === 'SUPPORT_TROOPS_WILL');
}

function getSupportTroopsSpawnEvents(result) {
  return (result.presentationEvents || []).filter((event) => (
    event &&
    event.type === 'SPAWN' &&
    event.cause === 'SUPPORT_TROOPS_WILL' &&
    event.reason === 'support_troops_will_spawn'
  ));
}

function getSupportTroopsFlipEvents(result) {
  return (result.presentationEvents || []).filter((event) => (
    event &&
    event.type === 'CHANGE' &&
    event.cause === 'SUPPORT_TROOPS_WILL' &&
    event.reason === 'support_troops_will_flip'
  ));
}

describe('SUPPORT_TROOPS_WILL（援軍の意志）', () => {
  const supportTroopsDef = getSupportTroopsDef();

  test('候補条件は増援の意志と同じで、角辺以外で石に隣接する空きマスだけを候補にする', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard();
    board[3][3] = Shared.BLACK;

    const gameState = createGameState(board);
    const cardState = createCardState(createPrng([0]), supportTroopsDef.id, supportTroopsDef.cost);

    expect(CardLogic.getSupportTroopsWillTargets(cardState, gameState, 'black')).toEqual([
      { row: 2, col: 2 },
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 2 },
      { row: 3, col: 4 },
      { row: 4, col: 2 },
      { row: 4, col: 3 },
      { row: 4, col: 4 }
    ]);
    expect(CardLogic.getSupportTroopsWillTargetCount(cardState, gameState, 'black')).toBe(8);
    expect(CardLogic.canUseSupportTroopsWillForPlayer(cardState, gameState, 'black')).toBe(true);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain(supportTroopsDef.id);
  });

  test('候補が無い局面では使用できない', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard();
    const gameState = createGameState(board);
    const cardState = createCardState(createPrng([0]), supportTroopsDef.id, supportTroopsDef.cost);

    expect(CardLogic.getSupportTroopsWillTargets(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).not.toContain(supportTroopsDef.id);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', supportTroopsDef.id)).toBe(false);
  });

  test('使用が確定したらカード選択状態を残さない', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard();
    board[3][3] = Shared.BLACK;
    const gameState = createGameState(board);
    const cardState = createCardState(createPrng([0]), supportTroopsDef.id, supportTroopsDef.cost);
    cardState.selectedCardId = supportTroopsDef.id;
    cardState.selectedCardOwnerKey = 'black';

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', supportTroopsDef.id)).toBe(true);

    expect(cardState.selectedCardId).toBeNull();
    expect(cardState.selectedCardOwnerKey).toBeNull();
  });

  test('use_cardで即時解決し、候補が十分あれば通常石を3個配置できる', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard();
    board[3][3] = Shared.BLACK;

    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, supportTroopsDef.id, supportTroopsDef.cost);
    const gameState = createGameState(board);

    const spawnSpy = jest.spyOn(BoardOps, 'spawnAt');
    try {
      const result = TurnPipeline.applyTurn(
        cardState,
        gameState,
        'black',
        { type: 'use_card', useCardId: supportTroopsDef.id },
        prng
      );

      const resolveEvent = result.events.find((event) => event && event.type === 'support_troops_will_resolved');
      const spawnEvents = getSupportTroopsSpawnEvents(result);

      expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
      expect(resolveEvent).toMatchObject({
        type: 'support_troops_will_resolved',
        player: 'black',
        requestedCount: 3,
        spawnedCount: 3,
        flippedCount: 0
      });
      expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([[2, 2], [2, 3], [2, 4]]);

      expect(spawnSpy).toHaveBeenCalledTimes(3);
      expect(spawnEvents).toHaveLength(3);
      expect(spawnEvents.map((event) => [event.row, event.col])).toEqual([[2, 2], [2, 3], [2, 4]]);
      expect(spawnEvents.map((event) => event.meta && event.meta.spawnIndex)).toEqual([1, 2, 3]);
      expect(spawnEvents.every((event) => event.meta && event.meta.requestedCount === 3)).toBe(true);
      expect(gameState.board[2][2]).toBe(Shared.BLACK);
      expect(gameState.board[2][3]).toBe(Shared.BLACK);
      expect(gameState.board[2][4]).toBe(Shared.BLACK);
    } finally {
      spawnSpy.mockRestore();
    }
  });

  test('直前パスが残っていても、援軍の意志で盤面を変えたら連続パス数をリセットする', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard();
    board[3][3] = Shared.BLACK;

    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, supportTroopsDef.id, supportTroopsDef.cost);
    const gameState = createGameState(board);
    gameState.consecutivePasses = 1;

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: supportTroopsDef.id },
      prng
    );

    const resolveEvent = result.events.find((event) => event && event.type === 'support_troops_will_resolved');
    expect(resolveEvent).toMatchObject({
      type: 'support_troops_will_resolved',
      spawnedCount: 3
    });
    expect(result.gameState.consecutivePasses).toBe(0);
  });

  test('候補が2マスしか無い局面では、置ける分だけ配置する', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard(Shared.BLACK);
    board[2][2] = Shared.EMPTY;
    board[2][3] = Shared.EMPTY;

    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, supportTroopsDef.id, supportTroopsDef.cost);
    const gameState = createGameState(board);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: supportTroopsDef.id },
      prng
    );

    const resolveEvent = result.events.find((event) => event && event.type === 'support_troops_will_resolved');
    const spawnEvents = getSupportTroopsSpawnEvents(result);

    expect(resolveEvent).toMatchObject({
      type: 'support_troops_will_resolved',
      player: 'black',
      requestedCount: 3,
      spawnedCount: 2,
      flippedCount: 0
    });
    expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([[2, 2], [2, 3]]);
    expect(spawnEvents).toHaveLength(2);
    expect(spawnEvents.map((event) => event.meta && event.meta.spawnIndex)).toEqual([1, 2]);
  });

  test('複数配置の途中でも通常反転を行う', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard(Shared.BLACK);
    board[2][2] = Shared.EMPTY;
    board[4][2] = Shared.EMPTY;
    board[4][4] = Shared.EMPTY;
    board[2][3] = Shared.WHITE;

    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, supportTroopsDef.id, supportTroopsDef.cost);
    const gameState = createGameState(board);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: supportTroopsDef.id },
      prng
    );

    const resolveEvent = result.events.find((event) => event && event.type === 'support_troops_will_resolved');
    const flipEvents = getSupportTroopsFlipEvents(result);

    expect(resolveEvent).toMatchObject({
      type: 'support_troops_will_resolved',
      player: 'black',
      requestedCount: 3,
      spawnedCount: 3,
      flippedCount: 1
    });
    expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([[2, 2], [4, 2], [4, 4]]);
    expect(resolveEvent.flipped).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 3 })
    ]));
    expect(flipEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ row: 2, col: 3, reason: 'support_troops_will_flip' })
    ]));
    expect(gameState.board[2][3]).toBe(Shared.BLACK);
    expect(result.cardState.totalFlipCountByPlayer.black).toBe(1);
  });
});
