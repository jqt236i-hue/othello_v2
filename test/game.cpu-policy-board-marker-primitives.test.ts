import * as Primitives from '../game/ai/cpu-policy-board-marker-primitives';

describe('CPU board marker primitives', () => {
  test('preserves board-neighbor and marker profile scoring independently of the CPU facade', () => {
    const board = [
      [1, 0, -1],
      [0, 1, 0],
      [-1, 0, 1]
    ];
    const cardState = {
      markers: [
        { kind: 'specialStone', owner: 'black', row: 1, col: 1, data: { type: 'WORK', remainingOwnerTurns: 2 } },
        { kind: 'specialStone', owner: 'white', row: 1, col: 1, data: { type: 'GUARD', remainingOwnerTurns: 4 } },
        { kind: 'bomb', owner: 'white', row: 1, col: 1, data: { type: 'TIME_BOMB' } }
      ]
    };

    expect(Primitives.getBoardCellValueSafe(null, board, 1, 1)).toBe(1);
    expect(Primitives.countAdjacentCellsByValue(null, board, 1, 1, 0)).toBe(4);
    expect(Primitives.getMarkerPriorityValue('WORK')).toBe(320);
    expect(Primitives.getTimedMarkerProfileAt(cardState, 'black', 1, 1)).toEqual({
      ownTimedCount: 1,
      oppTimedCount: 1,
      ownTimedScore: 376,
      oppTimedScore: 392,
      ownRemainingSum: 2,
      oppRemainingSum: 4,
      ownCriticalCount: 1,
      oppCriticalCount: 0
    });
    expect(Primitives.getMarkerProfileAt(cardState, 'black', 1, 1)).toEqual({
      ownSpecialScore: 320,
      oppSpecialScore: 280,
      ownBombCount: 0,
      oppBombCount: 1
    });
  });
});
