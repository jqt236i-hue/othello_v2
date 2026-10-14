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
});
