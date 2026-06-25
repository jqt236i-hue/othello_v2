import * as CardMeteor from '../game/logic/cards/meteor.js';

describe('CardMeteor module', () => {
  test('applyMeteorWill creates a meteor hole on an empty target through cell removal and clears pending', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_01' } },
      markers: [{ id: 'blockade_1', kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'BLOCKADE' } }]
    };
    const gameState = {};
    const applyCellRemovalAt = jest.fn((cs, gs, row, col, owner, cause, reason, options) => {
      cs.markers = cs.markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
      cs.markers.push({ kind: 'specialStone', row, col, owner, data: { type: 'METEOR_HOLE' } });
      return { applied: true, row, col, destroyed: false, options, cause, reason };
    });

    const result = CardMeteor.applyMeteorWill(cardState, gameState, 'black', 1, 1, {
      getMeteorTargets: () => [{ row: 1, col: 1 }],
      getCellValueForCard: () => 0,
      applyCellRemovalAt
    });

    expect(result).toEqual({ applied: true, row: 1, col: 1, destroyed: false });
    expect(applyCellRemovalAt).toHaveBeenCalledWith(
      cardState,
      gameState,
      1,
      1,
      'black',
      'METEOR_WILL',
      'meteor_cell_destroy',
      expect.objectContaining({
        removalPolicy: 'cell_removal',
        removalKind: 'meteor_hole'
      })
    );
    expect(cardState.markers).toEqual([{ kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'METEOR_HOLE' } }]);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('applyMeteorWill uses cell removal for occupied cells before leaving a hole', () => {
    const cardState = {
      pendingEffectByPlayer: { white: { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_02' } },
      markers: []
    };
    const gameState = {};
    const applyCellRemovalAt = jest.fn((cs, gs, row, col, owner, cause, reason, options) => {
      cs.markers.push({ kind: 'specialStone', row, col, owner, data: { type: 'METEOR_HOLE' } });
      return { applied: true, row, col, destroyed: true, options, cause, reason };
    });

    const result = CardMeteor.applyMeteorWill(cardState, gameState, 'white', 3, 3, {
      getMeteorTargets: () => [{ row: 3, col: 3 }],
      getCellValueForCard: () => 1,
      applyCellRemovalAt
    });

    expect(result).toEqual({ applied: true, row: 3, col: 3, destroyed: true });
    expect(applyCellRemovalAt).toHaveBeenCalledWith(
      cardState,
      gameState,
      3,
      3,
      'white',
      'METEOR_WILL',
      'meteor_cell_destroy',
      expect.objectContaining({
        removalPolicy: 'cell_removal',
        removalKind: 'meteor_hole'
      })
    );
    expect(cardState.markers).toEqual([{ kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'METEOR_HOLE' } }]);
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });

  test('applyMeteorWill refuses occupied cell removal without the canonical cell removal dependency', () => {
    const cardState = {
      pendingEffectByPlayer: { white: { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_03' } },
      markers: []
    };

    const result = CardMeteor.applyMeteorWill(cardState, {}, 'white', 3, 3, {
      getMeteorTargets: () => [{ row: 3, col: 3 }],
      getCellValueForCard: () => 1
    });

  expect(result).toEqual({
    applied: false,
    reason: 'cell_removal_dependency_missing',
    row: 3,
    col: 3,
    destroyed: false
  });
    expect(cardState.markers).toEqual([]);
    expect(cardState.pendingEffectByPlayer.white).toMatchObject({ type: 'METEOR_WILL', stage: 'selectTarget' });
  });
});
