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

  test('候補条件は増援の意志と同じで、石との隣接を問わず盤面の全空きマスを候補にする', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard();
    board[0][1] = Shared.BLACK;

    const gameState = createGameState(board);
    const cardState = createCardState(createPrng([0]), supportTroopsDef.id, supportTroopsDef.cost);

    const targets = CardLogic.getSupportTroopsWillTargets(cardState, gameState, 'black');
    expect(targets).toHaveLength(63);
    expect(targets).toEqual(expect.arrayContaining([
      { row: 0, col: 0 },
      { row: 4, col: 4 },
      { row: 7, col: 7 }
    ]));
    expect(targets).not.toContainEqual({ row: 0, col: 1 });
    expect(CardLogic.getSupportTroopsWillTargetCount(cardState, gameState, 'black')).toBe(63);
    expect(CardLogic.canUseSupportTroopsWillForPlayer(cardState, gameState, 'black')).toBe(true);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toContain(supportTroopsDef.id);
  });

  test('空きマスが無い局面では使用できない', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard().map((row) => row.fill(Shared.BLACK));
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

  test('use_cardで即時解決し、既存の石から離れた空きマスにも通常石を3個配置できる', () => {
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
      expect((resolveEvent.spawned || []).map((entry) => [entry.row, entry.col])).toEqual([[0, 0], [0, 1], [0, 2]]);

      expect(spawnSpy).toHaveBeenCalledTimes(3);
      expect(spawnEvents).toHaveLength(3);
      expect(spawnEvents.map((event) => [event.row, event.col])).toEqual([[0, 0], [0, 1], [0, 2]]);
      expect(spawnEvents.map((event) => event.meta && event.meta.spawnIndex)).toEqual([1, 2, 3]);
      expect(spawnEvents.every((event) => event.meta && event.meta.requestedCount === 3)).toBe(true);
      expect(gameState.board[0][0]).toBe(Shared.BLACK);
      expect(gameState.board[0][1]).toBe(Shared.BLACK);
      expect(gameState.board[0][2]).toBe(Shared.BLACK);
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

  test('配置先の数字マスを複数まとめても出現による布石と理論の化身進捗は獲得しない(数字マスは通常配置と同じく消費される)', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard();
    board[3][3] = Shared.BLACK;

    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, supportTroopsDef.id, supportTroopsDef.cost);
    cardState.charge.black = supportTroopsDef.cost;
    cardState.boardBonusByCell = { '0,0': 4, '0,1': 5, '0,2': 6 };
    const gameState = createGameState(board);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: supportTroopsDef.id },
      prng
    );

    const bonusEvents = result.events.filter((event) => event && event.type === 'board_bonus_gain');
    const numberCellChargeBubbles = (result.presentationEvents || []).filter((event) => (
      event &&
      event.type === 'CHARGE_BUBBLE' &&
      event.meta &&
      event.meta.sourceType === 'number_cell_gain'
    ));

    expect(result.events.find((event) => event && event.type === 'support_troops_will_resolved')).toMatchObject({
      spawnedCount: 3,
      flippedCount: 0
    });
    expect(bonusEvents).toEqual([]);
    expect(numberCellChargeBubbles).toEqual([]);
    expect(cardState.charge.black).toBe(0);
    expect(cardState.boardBonusConsumedByCell['0,0']).toBe(true);
    expect(cardState.boardBonusConsumedByCell['0,1']).toBe(true);
    expect(cardState.boardBonusConsumedByCell['0,2']).toBe(true);
    expect(cardState.numberCellCollectedTotalByPlayer.black || 0).toBe(0);
  });

  test('援軍の各配置で反転が成立すれば反転由来の布石は通常配置と同じく獲得する', () => {
    expect(supportTroopsDef).toBeTruthy();

    const board = createBoard(Shared.BLACK);
    board[2][2] = Shared.EMPTY;
    board[4][2] = Shared.EMPTY;
    board[4][4] = Shared.EMPTY;
    board[2][3] = Shared.WHITE;

    const prng = createPrng([0, 0, 0]);
    const cardState = createCardState(prng, supportTroopsDef.id, supportTroopsDef.cost);
    cardState.charge.black = supportTroopsDef.cost + 20;
    cardState.boardBonusByCell = { '2,2': 9, '4,2': 9, '4,4': 9 };
    const gameState = createGameState(board);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: supportTroopsDef.id },
      prng
    );

    const bonusEvents = result.events.filter((event) => event && event.type === 'board_bonus_gain');
    const resolveEvent = result.events.find((event) => event && event.type === 'support_troops_will_resolved');

    expect(resolveEvent).toMatchObject({
      spawnedCount: 3,
      flippedCount: 1
    });
    expect(bonusEvents).toEqual([]);
    expect(cardState.charge.black).toBe(supportTroopsDef.cost + 20 - supportTroopsDef.cost + 1);
    expect(cardState.boardBonusConsumedByCell['2,2']).toBe(true);
    expect(cardState.boardBonusConsumedByCell['4,2']).toBe(true);
    expect(cardState.boardBonusConsumedByCell['4,4']).toBe(true);
    expect(cardState.numberCellCollectedTotalByPlayer.black || 0).toBe(0);
  });
});
