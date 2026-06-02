import * as CardMeteor from '../game/logic/cards/meteor.js';

describe('CardMeteor module', () => {
  test('applyMeteorWill creates a meteor hole on an empty target and clears pending', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_01' } },
      markers: [{ id: 'blockade_1', kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'BLOCKADE' } }]
    };
    const added = [];

    const result = CardMeteor.applyMeteorWill(cardState, {}, 'black', 1, 1, {
      getMeteorTargets: () => [{ row: 1, col: 1 }],
      getCellValueForCard: () => 0,
      clearStoneIdAtForCard: jest.fn(),
      setCellValueForCard: jest.fn(() => true),
      removeMarkersAt: jest.fn((cs, row, col) => {
        cs.markers = cs.markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
      }),
      addMarker: jest.fn((cs, kind, row, col, owner, data) => {
        added.push({ kind, row, col, owner, data });
        cs.markers.push({ kind, row, col, owner, data });
        return true;
      })
    });

    expect(result).toEqual({ applied: true, row: 1, col: 1, destroyed: false });
    expect(added).toEqual([{ kind: 'specialStone', row: 1, col: 1, owner: 'black', data: { type: 'METEOR_HOLE' } }]);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('applyMeteorWill uses cell removal for occupied cells before leaving a hole', () => {
    const removed = [];
    const cardState = {
      pendingEffectByPlayer: { white: { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_02' } },
      markers: []
    };

    const result = CardMeteor.applyMeteorWill(cardState, {}, 'white', 3, 3, {
      getMeteorTargets: () => [{ row: 3, col: 3 }],
      getCellValueForCard: () => 1,
      applyCellRemovalAt: (cs, gs, row, col, owner, cause, reason, options) => {
        removed.push({ row, col, owner, cause, reason, options });
        cs.markers.push({ kind: 'specialStone', row, col, owner, data: { type: 'METEOR_HOLE' } });
        return { applied: true, row, col, destroyed: true };
      }
    });

    expect(result).toEqual({ applied: true, row: 3, col: 3, destroyed: true });
    expect(removed).toEqual([
      expect.objectContaining({
        row: 3,
        col: 3,
        owner: 'white',
        cause: 'METEOR_WILL',
        reason: 'meteor_cell_destroy',
        options: expect.objectContaining({
          removalPolicy: 'absolute_only',
          removalKind: 'meteor_hole'
        })
      })
    ]);
    expect(cardState.markers).toEqual([{ kind: 'specialStone', row: 3, col: 3, owner: 'white', data: { type: 'METEOR_HOLE' } }]);
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
  });
});
