import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as BoardOps from '../game/logic/board_ops.js';
import * as SharedConstants from '../shared-constants.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

function createEmptyBoard() {
  return Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
}

function findSeedMarker(cardState, row, col) {
  return (cardState.markers || []).find((marker) => (
    marker &&
    marker.kind === 'specialStone' &&
    marker.row === row &&
    marker.col === col &&
    marker.data &&
    marker.data.type === 'SEED'
  )) || null;
}

describe('SEED_WILL（種まきの意志）', () => {
  test('カード使用で種をまき、5回目の自ターン開始で通常石が芽生えると通常反転する', () => {
    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'SEED_WILL');
    expect(def).toBeTruthy();

    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = createEmptyBoard();
    gameState.currentPlayer = Core.BLACK;
    gameState.board[3][0] = Core.BLACK;
    gameState.board[3][1] = Core.WHITE;

    cardState.charge.black = 99;
    cardState.hands.black = [def.id];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('SEED_WILL');

    const planted = CardLogic.applySeedWill(cardState, gameState, 'black', 3, 2);
    expect(planted).toEqual(expect.objectContaining({ applied: true, row: 3, col: 2 }));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(CardLogic.isBlockedCell(cardState, 3, 2, gameState)).toBe(false);
    expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(5);

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(4);

    CardLogic.onTurnStart(cardState, 'white', gameState, createPrng());
    expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(4);

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(3);
    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(2);
    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());
    expect(findSeedMarker(cardState, 3, 2).data.remainingOwnerTurns).toBe(1);

    CardLogic.onTurnStart(cardState, 'black', gameState, createPrng());

    expect(findSeedMarker(cardState, 3, 2)).toBeNull();
    expect(gameState.board[3][2]).toBe(Core.BLACK);
    expect(gameState.board[3][1]).toBe(Core.BLACK);
  });

  test('turn start の芽生え反転でも布石と反転後追従処理を通す', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    cardState.charge.black = 0;
    cardState.chargeGainedTotal.black = 0;

    gameState.board = createEmptyBoard();
    gameState.board[3][0] = Core.BLACK;
    gameState.board[3][1] = Core.WHITE;
    cardState.markers.push({
      id: 71,
      kind: 'specialStone',
      row: 3,
      col: 2,
      owner: 'black',
      data: { type: 'SEED', remainingOwnerTurns: 1 }
    });

    const events = [];
    TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, 'black', events, createPrng());

    expect(findSeedMarker(cardState, 3, 2)).toBeNull();
    expect(gameState.board[3][2]).toBe(Core.BLACK);
    expect(gameState.board[3][1]).toBe(Core.BLACK);
    expect(cardState.charge.black).toBe(1);
    expect(cardState.chargeGainedTotal.black).toBe(1);
  });

  test('種マスに石が置かれると種が無効化される', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = createEmptyBoard();
    cardState.pendingEffectByPlayer.black = {
      type: 'SEED_WILL',
      stage: 'selectTarget',
      cardId: 'seed_01'
    };

    const planted = CardLogic.applySeedWill(cardState, gameState, 'black', 2, 2);
    expect(planted.applied).toBe(true);
    expect(findSeedMarker(cardState, 2, 2)).toBeTruthy();

    const spawnRes = BoardOps.spawnAt(cardState, gameState, 2, 2, 'white', 'TEST', 'manual_spawn');
    expect(spawnRes && spawnRes.spawned).toBe(true);
    expect(findSeedMarker(cardState, 2, 2)).toBeNull();
    expect(gameState.board[2][2]).toBe(Core.WHITE);
    expect((cardState.presentationEvents || [])).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_REMOVED',
        row: 2,
        col: 2,
        reason: 'seed_invalidated',
        meta: expect.objectContaining({
          special: 'SEED',
          reason: 'seed_invalidated'
        })
      })
    ]));
  });

  test('spawnMany emits ordered SPAWN events with inferred spawn intent', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    gameState.board = createEmptyBoard();

    const result = BoardOps.spawnMany(
      cardState,
      gameState,
      [{ row: 1, col: 1 }, { row: 1, col: 2 }],
      'black',
      'REINFORCEMENT_WILL',
      'reinforcement_will_spawn',
      { requestedCount: 2 }
    );

    expect(result).toMatchObject({ applied: true, requestedCount: 2, spawnedCount: 2, failedCount: 0 });
    expect(gameState.board[1][1]).toBe(Core.BLACK);
    expect(gameState.board[1][2]).toBe(Core.BLACK);
    const spawnEvents = (cardState.presentationEvents || []).filter((event) => event && event.type === 'SPAWN');
    expect(spawnEvents.map((event) => [event.row, event.col])).toEqual([[1, 1], [1, 2]]);
    expect(spawnEvents.map((event) => event.meta && event.meta.spawnIndex)).toEqual([1, 2]);
    expect(spawnEvents.every((event) => event.meta && event.meta.spawnIntent === 'normal_spawn')).toBe(true);
  });

  test('spawnMany keeps spawnIndex sequential for successful spawns when a target fails', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    gameState.board = createEmptyBoard();

    const result = BoardOps.spawnMany(
      cardState,
      gameState,
      [{ row: 99, col: 99 }, { row: 1, col: 2 }],
      'black',
      'REINFORCEMENT_WILL',
      'reinforcement_will_spawn',
      { requestedCount: 2 }
    );

    expect(result).toMatchObject({ applied: true, requestedCount: 2, spawnedCount: 1, failedCount: 1 });
    expect(gameState.board[1][2]).toBe(Core.BLACK);
    const spawnEvents = (cardState.presentationEvents || []).filter((event) => event && event.type === 'SPAWN');
    expect(spawnEvents.map((event) => [event.row, event.col])).toEqual([[1, 2]]);
    expect(spawnEvents.map((event) => event.meta && event.meta.spawnIndex)).toEqual([1]);
  });

  test('種マスは封鎖と凍結の対象にならない', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;

    gameState.board = createEmptyBoard();
    cardState.pendingEffectByPlayer.black = {
      type: 'SEED_WILL',
      stage: 'selectTarget',
      cardId: 'seed_01'
    };

    const planted = CardLogic.applySeedWill(cardState, gameState, 'black', 4, 4);
    expect(planted.applied).toBe(true);

    const seedTargets = CardLogic.getSeedTargets(cardState, gameState, 'black');
    const blockadeTargets = CardLogic.getBlockadeTargets(cardState, gameState, 'black');
    const freezeTargets = CardLogic.getFreezeTargets(cardState, gameState, 'black');

    expect(seedTargets.some((target) => target.row === 4 && target.col === 4)).toBe(false);
    expect(blockadeTargets.some((target) => target.row === 4 && target.col === 4)).toBe(false);
    expect(freezeTargets.some((target) => target.row === 4 && target.col === 4)).toBe(false);
  });
});
