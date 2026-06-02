import * as CardClone from '../game/logic/cards/clone.js';

function createBombMarker(id, row, col, owner, remainingTurns) {
  return {
    id,
    kind: 'specialStone',
    row,
    col,
    owner,
    data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns }
  };
}

describe('CardClone module', () => {
  test('applyCloneWill copies source markers onto the spawned stone', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'CLONE_WILL', stage: 'selectTarget', cardId: 'clone_01' } },
      markers: [
        { id: 's1', kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'DRAGON', remainingOwnerTurns: 2 } },
        createBombMarker('b1', 3, 3, 'black', 3)
      ]
    };
    const added = [];

    const result = CardClone.applyCloneWill(cardState, {}, 'black', 3, 3, { random: () => 0 }, {
      getCloneTargets: () => [{ row: 3, col: 3 }],
      getCellValueForCard: (state, row, col) => (row === 3 && col === 3 ? 1 : 0),
      getSpecialMarkers: (state) => state.markers.filter((marker) => marker.kind === 'specialStone' && (!marker.data || marker.data.category !== 'bomb')),
      getBombMarkers: (state) => state.markers.filter((marker) => marker.kind === 'specialStone' && marker.data && marker.data.category === 'bomb'),
      collectEmptyNeighborCellsForCard: () => [{ row: 3, col: 4 }],
      spawnAt: jest.fn(() => ({ spawned: true })),
      addMarker: jest.fn((cs, kind, row, col, owner, data) => {
        added.push({ kind, row, col, owner, data });
        cs.markers.push({ kind, row, col, owner, data });
        return true;
      })
    });

    expect(result).toEqual({ applied: true, source: { row: 3, col: 3 }, spawned: [{ row: 3, col: 4 }], flipped: [] });
    expect(added).toEqual(expect.arrayContaining([
      { kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'DRAGON', remainingOwnerTurns: 2 } },
      { kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 } }
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('applyCloneWill keeps pending and skips marker copy when spawnAt fails', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'CLONE_WILL', stage: 'selectTarget', cardId: 'clone_01' } },
      markers: [
        { id: 's1', kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'DRAGON', remainingOwnerTurns: 2 } }
      ]
    };
    const addMarker = jest.fn();

    const result = CardClone.applyCloneWill(cardState, {}, 'black', 3, 3, { random: () => 0 }, {
      getCloneTargets: () => [{ row: 3, col: 3 }],
      getCellValueForCard: (state, row, col) => (row === 3 && col === 3 ? 1 : 0),
      getSpecialMarkers: (state) => state.markers.filter((marker) => marker.kind === 'specialStone'),
      getBombMarkers: () => [],
      collectEmptyNeighborCellsForCard: () => [{ row: 3, col: 4 }],
      spawnAt: jest.fn(() => ({ spawned: false, reason: 'blocked_destination' })),
      addMarker
    });

    expect(result).toEqual({ applied: false, reason: 'blocked_destination' });
    expect(addMarker).not.toHaveBeenCalled();
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({ type: 'CLONE_WILL', stage: 'selectTarget', cardId: 'clone_01' }));
    expect(cardState.markers).toHaveLength(1);
  });

});
