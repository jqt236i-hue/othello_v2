const MovementCornerSwing = require('../game/cpu-decision-movement-corner-swing');
const SharedBoardUtils = require('../shared/shared-board-utils');

describe('CPU movement corner swing board context', () => {
  test('recognizes an expansion corner without injected 8x8 geometry fallbacks', () => {
    const gameState = {
      board: Array.from({ length: 4 }, () => Array(4).fill(0)),
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion: {
        cells: [{ side: 'left', row: 0, col: -1, owner: -1 }]
      }
    };
    const boardContext = SharedBoardUtils.createBoardContext(gameState, { markers: [] });

    const targets = MovementCornerSwing.filterMovementCornerSwingTargets(
      'SUPER_ATTRACTION_WILL',
      [{ row: 1, col: 1 }],
      {
        boardContext,
        playerValue: 1,
        pending: { firstTarget: { row: 0, col: -1 } }
      }
    );

    expect(targets).toEqual([{ row: 1, col: 1 }]);
  });
});
