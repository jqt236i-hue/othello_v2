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

    expect(result).toEqual({ applied: true, source: { row: 3, col: 3 }, spawned: [{ row: 3, col: 4 }] });
    expect(added).toEqual(expect.arrayContaining([
      { kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'DRAGON', remainingOwnerTurns: 2 } },
      { kind: 'specialStone', row: 3, col: 4, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 3 } }
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('applySplitWill halves durations on source and clone markers', () => {
    const cardState = {
      pendingEffectByPlayer: { white: { type: 'SPLIT_WILL', stage: 'selectTarget', cardId: 'split_01' } },
      markers: [
        { id: 's1', kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'DRAGON', remainingOwnerTurns: 5 } },
        createBombMarker('b1', 2, 2, 'white', 3)
      ]
    };
    const added = [];

    const result = CardClone.applySplitWill(cardState, {}, 'white', 2, 2, { random: () => 0 }, {
      getSplitTargets: () => [{ row: 2, col: 2 }],
      getCellValueForCard: (state, row, col) => (row === 2 && col === 2 ? -1 : 0),
      getSpecialMarkers: (state) => state.markers.filter((marker) => marker.kind === 'specialStone' && (!marker.data || marker.data.category !== 'bomb')),
      getBombMarkers: (state) => state.markers.filter((marker) => marker.kind === 'specialStone' && marker.data && marker.data.category === 'bomb'),
      collectEmptyNeighborCellsForCard: () => [{ row: 2, col: 3 }],
      spawnAt: jest.fn(() => ({ spawned: true })),
      addMarker: jest.fn((cs, kind, row, col, owner, data) => {
        added.push({ kind, row, col, owner, data });
        cs.markers.push({ kind, row, col, owner, data });
        return true;
      })
    });

    expect(result).toMatchObject({
      applied: true,
      source: { row: 2, col: 2 },
      spawned: [{ row: 2, col: 3 }]
    });
    expect(cardState.markers.find((marker) => marker.id === 's1').data.remainingOwnerTurns).toBe(2);
    expect(cardState.markers.find((marker) => marker.id === 'b1').data.remainingTurns).toBe(1);
    expect(added).toEqual(expect.arrayContaining([
      { kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'DRAGON', remainingOwnerTurns: 2 } },
      { kind: 'specialStone', row: 2, col: 3, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 1 } }
    ]));
    expect(result.durationChanges).toEqual(expect.arrayContaining([
      expect.objectContaining({ durationKey: 'remainingOwnerTurns', previousDuration: 5, nextDuration: 2 }),
      expect.objectContaining({ durationKey: 'remainingTurns', previousDuration: 3, nextDuration: 1 })
    ]));
    expect(cardState.pendingEffectByPlayer.white).toBeNull();
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

  test('applySplitWill keeps pending and durations when spawnAt fails', () => {
    const cardState = {
      pendingEffectByPlayer: { white: { type: 'SPLIT_WILL', stage: 'selectTarget', cardId: 'split_01' } },
      markers: [
        { id: 's1', kind: 'specialStone', row: 2, col: 2, owner: 'white', data: { type: 'DRAGON', remainingOwnerTurns: 5 } },
        createBombMarker('b1', 2, 2, 'white', 3)
      ]
    };
    const addMarker = jest.fn();

    const result = CardClone.applySplitWill(cardState, {}, 'white', 2, 2, { random: () => 0 }, {
      getSplitTargets: () => [{ row: 2, col: 2 }],
      getCellValueForCard: (state, row, col) => (row === 2 && col === 2 ? -1 : 0),
      getSpecialMarkers: (state) => state.markers.filter((marker) => marker.kind === 'specialStone' && (!marker.data || marker.data.category !== 'bomb')),
      getBombMarkers: (state) => state.markers.filter((marker) => marker.kind === 'specialStone' && marker.data && marker.data.category === 'bomb'),
      collectEmptyNeighborCellsForCard: () => [{ row: 2, col: 3 }],
      spawnAt: jest.fn(() => ({ spawned: false, reason: 'blocked_destination' })),
      addMarker
    });

    expect(result).toEqual({ applied: false, reason: 'blocked_destination' });
    expect(addMarker).not.toHaveBeenCalled();
    expect(cardState.pendingEffectByPlayer.white).toEqual(expect.objectContaining({ type: 'SPLIT_WILL', stage: 'selectTarget', cardId: 'split_01' }));
    expect(cardState.markers.find((marker) => marker.id === 's1').data.remainingOwnerTurns).toBe(5);
    expect(cardState.markers.find((marker) => marker.id === 'b1').data.remainingTurns).toBe(3);
  });
});
