import fs from 'fs';
import path from 'path';

describe('shared board context facade', () => {
  test('keeps only approved context wrappers and boundary primitives', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../shared/shared-board-utils.ts'), 'utf8');
    const declared = Array.from(source.matchAll(/^    function (\w+)\(/gm), (match) => match[1]);

    expect(declared).toEqual([
      'toBoardCellKey',
      'normalizeOwner',
      'isRecord',
      'isBoardContext',
      'createBoardContext',
      'clonePlainValue',
      'cloneBoardContext',
      'isPaddedBoardCoordinate',
      'toPaddedBoardIndex',
      'fromPaddedBoardIndex',
      'collectMeteorHoleKeys',
      'isBoardSearchContext',
      'createBoardSearchContext',
      'prepareBoardForSearch',
      'getContextView',
      'resolveReadOnlyBoardView',
      'resolveBoardBounds',
      'isStandardBoard8x8',
      'hasPlayableCell',
      'collectBoardCoordinates',
      'collectBoardCellValues',
      'getCellValue',
      'setCellValue',
      'setCellValues',
      'cloneBoard',
      'countBoardEmpties',
      'forEachBoardShapeCell',
      'countDiscsByPlayer',
      'countDiscs',
      'buildBoardTopology',
      'getFlipsBasic',
      'getLegalMovesBasic',
      'toCellChar',
      'transformCoord',
      'encodeBoard',
      'canonicalizeBoard',
      'mapCoordToCanonical',
      'makeCanonicalActionKey',
      'formatPosTextJa',
      'posToNotation'
    ]);
    expect(source).not.toMatch(/function (attachBoardShape|getBoardShapeMeta|buildShapeMeta|summarizeEdgeRuns|buildRiskCellSets)\(/);
  });
});
