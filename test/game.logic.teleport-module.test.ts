import * as CardTeleport from '../game/logic/cards/teleport.js';

describe('CardTeleport module', () => {
  test('applyTeleportWill moves marker and clears pending on success', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'TELEPORT_WILL', stage: 'selectTarget', cardId: 'teleport_01' } },
      markers: [{ id: 'bomb_1', kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }]
    };
    const result = CardTeleport.applyTeleportWill(cardState, {}, 'black', 4, 4, { random: () => 0 }, {
      getTeleportTargets: () => [{ row: 4, col: 4 }],
      getTeleportDestinations: () => [{ row: 2, col: 2 }],
      getCellValueForCard: (state, row, col) => (row === 4 && col === 4 ? 1 : (row === 2 && col === 2 ? 0 : null)),
      moveAt: jest.fn(() => ({ moved: true })),
      getMarkers: (state) => state.markers
    });

    expect(result).toEqual({ applied: true, from: { row: 4, col: 4 }, to: { row: 2, col: 2 } });
    expect(cardState.markers[0]).toMatchObject({ row: 2, col: 2 });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('applyCellTeleportWill creates a source hole through cell removal and moves stone ids on fallback move', () => {
    const cardState = {
      pendingEffectByPlayer: { black: { type: 'CELL_TELEPORT_WILL', stage: 'selectTarget', cardId: 'cell_tp_01' } },
      markers: [{ id: 'bomb_2', kind: 'specialStone', row: 4, col: 4, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } }]
    };
    const setCalls = [];
    const stoneIds = { '4,4': 's1' };
    const applyCellRemovalAt = jest.fn((cs, gs, removalRow, removalCol, owner, cause, reason, options) => {
      cs.markers.push({ kind: 'specialStone', row: removalRow, col: removalCol, owner, data: { type: 'METEOR_HOLE' } });
      return { applied: true, row: removalRow, col: removalCol, destroyed: false, options, cause, reason };
    });

    const result = CardTeleport.applyCellTeleportWill(cardState, {}, 'black', 4, 4, { random: () => 0 }, {
      getCellTeleportTargets: () => [{ row: 4, col: 4 }],
      getCellTeleportDestinations: () => [{ row: -1, col: 0, active: false }],
      getCellValueForCard: (state, row, col) => (row === 4 && col === 4 ? 1 : (row === -1 && col === 0 ? 0 : null)),
      ensureExpansionCellForCard: jest.fn(() => true),
      setCellValueForCard: (state, row, col, value) => {
        setCalls.push({ row, col, value });
        return true;
      },
      getStoneIdAtForCard: (cs, gs, row, col) => stoneIds[`${row},${col}`] || null,
      clearStoneIdAtForCard: (cs, gs, row, col) => { delete stoneIds[`${row},${col}`]; },
      setStoneIdAtForCard: (cs, gs, row, col, value) => { stoneIds[`${row},${col}`] = value; return true; },
      removeMarkersAt: jest.fn((cs, row, col) => {
        cs.markers = cs.markers.filter((marker) => !(marker && marker.row === row && marker.col === col));
      }),
      addMarker: jest.fn(),
      applyCellRemovalAt,
      getMarkers: (state) => state.markers
    });

    expect(result).toEqual({ applied: true, from: { row: 4, col: 4 }, to: { row: -1, col: 0 }, createdDestination: true });
    expect(stoneIds['4,4']).toBeUndefined();
    expect(stoneIds['-1,0']).toBe('s1');
    expect(applyCellRemovalAt).toHaveBeenCalledWith(
      cardState,
      {},
      4,
      4,
      'black',
      'CELL_TELEPORT_WILL',
      'cell_teleport_source_cell_remove',
      expect.objectContaining({
        removalPolicy: 'absolute_only',
        removalKind: 'meteor_hole'
      })
    );
    expect(cardState.markers.some((marker) => marker.row === 4 && marker.col === 4 && marker.data && marker.data.type === 'METEOR_HOLE')).toBe(true);
    expect(cardState.markers.some((marker) => marker.id === 'bomb_2' && marker.row === -1 && marker.col === 0)).toBe(true);
    expect(setCalls).toEqual(expect.arrayContaining([
      { row: 4, col: 4, value: 0 },
      { row: -1, col: 0, value: 1 }
    ]));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });
});
