import * as fs from 'fs';
import * as path from 'path';

describe('CardHyperactive static runtime dependencies', () => {
  test('imports canonical board APIs without runtime-global discovery and preserves behavior', () => {
    const sourcePath = path.resolve(__dirname, '..', 'game', 'logic', 'cards', 'hyperactive.ts');
    const source = fs.readFileSync(sourcePath, 'utf8');
    expect(source).toContain("import SharedConstantsImport = require('../../../shared-constants');");
    expect(source).toContain("import BoardUtilsImport = require('../../../shared/shared-board-utils');");
    expect(source).not.toMatch(/safeRequire|globalThis|\bself\s*\./);

    const CardHyperactive = require('../game/logic/cards/hyperactive.ts');
    const gameState: any = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    gameState.board[2][3] = 1;
    gameState.board[4][4] = -1;
    const cardState: any = {
      markers: [{
        kind: 'specialStone',
        row: 2,
        col: 3,
        owner: 'black',
        data: {
          type: 'ESCAPE_HYPERACTIVE',
          remainingOwnerTurns: 5
        }
      }]
    };

    const result = CardHyperactive.processHyperactiveMoveAtAnchor(
      cardState,
      gameState,
      'black',
      2,
      3,
      { random: () => 0 },
      { expectedSpecialType: 'ESCAPE_HYPERACTIVE' }
    );

    expect(result.moved).toHaveLength(1);
    expect(result.destroyed).toEqual([]);
    expect(gameState.board[2][3]).toBe(0);
    expect(cardState.markers[0]).toEqual(expect.objectContaining({ row: 1, col: 2 }));
    expect(gameState.board[1][2]).toBe(1);
  });
});
