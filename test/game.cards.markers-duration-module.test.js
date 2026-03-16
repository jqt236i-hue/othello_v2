const CardMarkers = require('../game/logic/cards/markers');

describe('CardMarkers duration effects', () => {
  test('applyExtendLifeWill doubles timed markers on the selected cell and clears pending', () => {
    const cardState = {
      pendingEffectByPlayer: {
        black: { type: 'EXTEND_LIFE_WILL', stage: 'selectTarget', cardId: 'extend_01' }
      },
      markers: [
        { id: 1, row: 2, col: 2, kind: 'specialStone', owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 5 } },
        { id: 2, row: 2, col: 2, kind: 'specialStone', owner: 'black', data: { type: 'GUARD', remainingOwnerTurns: 3 } }
      ]
    };

    const result = CardMarkers.applyExtendLifeWill(cardState, {}, 'black', 2, 2, {
      getExtendLifeTargets: () => [{ row: 2, col: 2 }]
    });

    expect(result).toEqual({
      applied: true,
      row: 2,
      col: 2,
      previousRemainingOwnerTurns: 5,
      newRemainingOwnerTurns: 10
    });
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(10);
    expect(cardState.markers[1].data.remainingOwnerTurns).toBe(6);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('applyCorrosionWill halves timed markers on the selected cell and returns detail rows', () => {
    const cardState = {
      pendingEffectByPlayer: {
        black: { type: 'CORROSION_WILL', stage: 'selectTarget', cardId: 'corrosion_01' }
      },
      markers: [
        { id: 1, row: 3, col: 4, kind: 'specialStone', owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 5 } },
        { id: 2, row: 3, col: 4, kind: 'specialStone', owner: 'white', data: { type: 'GUARD', remainingOwnerTurns: 2 } },
        { id: 3, row: 1, col: 1, kind: 'specialStone', owner: 'black', data: { type: 'WORK', remainingOwnerTurns: 4 } }
      ]
    };

    const result = CardMarkers.applyCorrosionWill(cardState, {}, 'black', 3, 4, {
      getCorrosionTargets: () => [{ row: 3, col: 4 }]
    });

    expect(result.applied).toBe(true);
    expect(result.affectedCount).toBe(2);
    expect(result.details).toEqual([
      {
        row: 3,
        col: 4,
        owner: 'black',
        special: 'WORK',
        previousRemainingOwnerTurns: 5,
        newRemainingOwnerTurns: 2
      },
      {
        row: 3,
        col: 4,
        owner: 'white',
        special: 'GUARD',
        previousRemainingOwnerTurns: 2,
        newRemainingOwnerTurns: 1
      }
    ]);
    expect(cardState.markers[0].data.remainingOwnerTurns).toBe(2);
    expect(cardState.markers[1].data.remainingOwnerTurns).toBe(1);
    expect(cardState.markers[2].data.remainingOwnerTurns).toBe(4);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });
});