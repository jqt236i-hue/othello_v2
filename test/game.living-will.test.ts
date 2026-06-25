import * as SharedConstants from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as BoardOps from '../game/logic/board_ops.js';

describe('LIVING_WILL (生きる意志)', () => {
  function makeState() {
    const prng = { shuffle: (items) => items, random: () => 0 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState };
  }

  function findMarker(cardState, row, col, type) {
    return (cardState.markers || []).find((marker) => (
      marker &&
      marker.row === row &&
      marker.col === col &&
      marker.data &&
      marker.data.type === type
    ));
  }

  test('applyCardUsage enters selection and destroy consumes living will to restore the same stone', () => {
    const livingDef = (SharedConstants.CARD_DEFS || []).find((def) => def && def.type === 'LIVING_WILL');
    expect(livingDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[2][2] = 1;
    cardState.hands.black = [livingDef.id];
    cardState.charge.black = livingDef.cost;

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', livingDef.id)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({
      type: 'LIVING_WILL',
      stage: 'selectTarget'
    });

    const applied = CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 2);
    expect(applied).toMatchObject({ applied: true, row: 2, col: 2 });
    expect(findMarker(cardState, 2, 2, 'LIVING_WILL')).toBeTruthy();

    const destroyed = BoardOps.destroyAt(cardState, gameState, 2, 2, 'SYSTEM', 'unit_test_destroy');
    expect(destroyed).toMatchObject({
      livingWillRevived: true,
      relocated: false,
      from: { row: 2, col: 2 },
      to: { row: 2, col: 2 }
    });
    expect(gameState.board[2][2]).toBe(1);
    expect(findMarker(cardState, 2, 2, 'LIVING_WILL')).toBeUndefined();
  });

  test('target selector excludes bombs and already-living stones but keeps strong stones targetable', () => {
    const { cardState, gameState } = makeState();
    gameState.board[0][0] = 1;
    gameState.board[0][1] = 1;
    gameState.board[0][2] = 1;
    gameState.board[0][3] = 1;

    cardState.markers.push(
      {
        id: 1,
        kind: 'specialStone',
        row: 0,
        col: 0,
        owner: 'black',
        data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 }
      },
      {
        id: 2,
        kind: 'specialStone',
        row: 0,
        col: 1,
        owner: 'black',
        data: { type: 'PERMA_PROTECTED' }
      },
      {
        id: 3,
        kind: 'specialStone',
        row: 0,
        col: 2,
        owner: 'black',
        data: { type: 'LIVING_WILL', baseline: { owner: 'black', value: 1, markers: [] } }
      }
    );

    expect(CardLogic.getLivingWillTargets(cardState, gameState, 'black')).toEqual([
      { row: 0, col: 1 },
      { row: 0, col: 3 }
    ]);
  });

  test('capture will is nullified by living will and does not add the captured card to hand', () => {
    const dragonDef = (SharedConstants.CARD_DEFS || []).find((def) => def && def.type === 'ULTIMATE_REVERSE_DRAGON');
    expect(dragonDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    gameState.board[3][3] = 1;
    cardState.markers.push({
      id: 10,
      kind: 'specialStone',
      row: 3,
      col: 3,
      owner: 'black',
      data: {
        type: 'DRAGON',
        remainingOwnerTurns: 4,
        sourceType: 'ULTIMATE_REVERSE_DRAGON',
        sourceCardId: dragonDef.id
      }
    });

    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 3, 3)).toMatchObject({ applied: true });

    cardState.pendingEffectByPlayer.white = { type: 'CAPTURE_WILL', stage: 'selectTarget', sourceHandIndex: 0 };
    cardState.hands.white = [];
    const captured = CardLogic.applyCaptureWill(cardState, gameState, 'white', 3, 3);

    expect(captured).toMatchObject({
      applied: true,
      livingWillRevived: true,
      sourceSpecialType: 'DRAGON'
    });
    expect(cardState.hands.white).toEqual([]);
    expect(gameState.board[3][3]).toBe(1);
    expect(findMarker(cardState, 3, 3, 'DRAGON')).toBeTruthy();
    expect(findMarker(cardState, 3, 3, 'LIVING_WILL')).toBeUndefined();
  });

  test('owner-turn duration expiry restores the attached-time marker state once', () => {
    const { cardState, gameState } = makeState();
    gameState.board[1][1] = 1;
    cardState.markers.push({
      id: 20,
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3, sourceType: 'GUARD_WILL', sourceCardId: 'guard_01' }
    });

    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 1, 1)).toMatchObject({ applied: true });

    const currentGuard = findMarker(cardState, 1, 1, 'GUARD');
    currentGuard.data.remainingOwnerTurns = 1;

    CardLogic.onTurnStart(cardState, 'black', gameState);

    const restoredGuard = findMarker(cardState, 1, 1, 'GUARD');
    expect(restoredGuard).toBeTruthy();
    expect(restoredGuard.data.remainingOwnerTurns).toBe(3);
    expect(findMarker(cardState, 1, 1, 'LIVING_WILL')).toBeUndefined();
  });

  test('owner-turn duration expiry flips lines captured from the restored stone', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = 1;
    gameState.board[4][5] = -1;
    gameState.board[4][6] = 1;
    cardState.markers.push({
      id: 21,
      kind: 'specialStone',
      row: 4,
      col: 4,
      owner: 'black',
      data: { type: 'GUARD', remainingOwnerTurns: 3, sourceType: 'GUARD_WILL', sourceCardId: 'guard_01' }
    });

    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 4, 4)).toMatchObject({ applied: true });

    const currentGuard = findMarker(cardState, 4, 4, 'GUARD');
    currentGuard.data.remainingOwnerTurns = 1;

    CardLogic.onTurnStart(cardState, 'black', gameState);

    expect(gameState.board[4][4]).toBe(1);
    expect(gameState.board[4][5]).toBe(1);
    expect(gameState.board[4][6]).toBe(1);
    expect(cardState.charge.black).toBe(1);
    expect(findMarker(cardState, 4, 4, 'GUARD')).toBeTruthy();
    expect(findMarker(cardState, 4, 4, 'LIVING_WILL')).toBeUndefined();
  });

  test('meteor-style destroy relocates the revival to another empty cell', () => {
    const { cardState, gameState } = makeState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(-1));
    gameState.board[2][2] = 1;
    gameState.board[5][5] = 0;

    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 2)).toMatchObject({ applied: true });

    const destroyed = BoardOps.destroyAt(cardState, gameState, 2, 2, 'METEOR_WILL', 'meteor_destroy', {
      random: { random: () => 0 }
    });

    expect(destroyed).toMatchObject({
      livingWillRevived: true,
      relocated: true,
      from: { row: 2, col: 2 },
      to: { row: 5, col: 5 }
    });
    expect(gameState.board[2][2]).toBe(0);
    expect(gameState.board[5][5]).toBe(1);
    expect(findMarker(cardState, 5, 5, 'LIVING_WILL')).toBeUndefined();
  });

  test('post-flip revive restores the original owner and consumes living will', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = 1;

    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 4, 4)).toMatchObject({ applied: true });

    gameState.board[4][4] = -1;
    const result = CardLogic.applyLivingWillAfterFlips(cardState, gameState, [{ row: 4, col: 4 }], 'white');

    expect(result).toEqual({ restored: [{ row: 4, col: 4 }] });
    expect(gameState.board[4][4]).toBe(1);
    expect(findMarker(cardState, 4, 4, 'LIVING_WILL')).toBeUndefined();
  });

  test('post-flip revive flips lines captured from the restored stone', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = 1;
    gameState.board[4][5] = -1;
    gameState.board[4][6] = 1;

    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 4, 4)).toMatchObject({ applied: true });

    gameState.board[4][4] = -1;
    const result = CardLogic.applyLivingWillAfterFlips(cardState, gameState, [{ row: 4, col: 4 }], 'white');

    expect(result).toEqual({
      restored: [{ row: 4, col: 4 }],
      flipped: [{ row: 4, col: 5 }]
    });
    expect(gameState.board[4][4]).toBe(1);
    expect(gameState.board[4][5]).toBe(1);
    expect(gameState.board[4][6]).toBe(1);
    expect(cardState.charge.black).toBe(1);
    expect(findMarker(cardState, 4, 4, 'LIVING_WILL')).toBeUndefined();
  });

  test('destroy-triggered revive flips lines captured from the restored stone', () => {
    const { cardState, gameState } = makeState();
    gameState.board[4][4] = 1;
    gameState.board[4][5] = -1;
    gameState.board[4][6] = 1;

    cardState.pendingEffectByPlayer.black = { type: 'LIVING_WILL', stage: 'selectTarget' };
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 4, 4)).toMatchObject({ applied: true });

    const destroyed = BoardOps.destroyAt(cardState, gameState, 4, 4, 'SYSTEM', 'unit_test_destroy');

    expect(destroyed).toMatchObject({
      livingWillRevived: true,
      relocated: false,
      from: { row: 4, col: 4 },
      to: { row: 4, col: 4 }
    });
    expect(gameState.board[4][4]).toBe(1);
    expect(gameState.board[4][5]).toBe(1);
    expect(gameState.board[4][6]).toBe(1);
    expect(cardState.charge.black).toBe(1);
    expect(findMarker(cardState, 4, 4, 'LIVING_WILL')).toBeUndefined();
  });
});
