import fs from 'fs';
import path from 'path';

describe('shared board compatibility facade', () => {
  test('keeps only approved wrapper and boundary primitives', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../shared/shared-board-utils.ts'), 'utf8');
    const declared = Array.from(source.matchAll(/^    function (\w+)\(/gm), (match) => match[1]);

    expect(declared).toEqual([
      'toBoardCellKey',
      'normalizeOwner',
      'isPaddedBoardCoordinate',
      'toPaddedBoardIndex',
      'fromPaddedBoardIndex',
      'toCellChar',
      'transformCoord',
      'encodeBoard',
      'canonicalizeBoard',
      'mapCoordToCanonical',
      'makeCanonicalActionKey',
      'formatPosTextJa',
      'posToNotation'
    ]);
    expect(source).not.toMatch(/function (buildShapeMeta|resolveBoardBounds|getFlipsBasic|summarizeEdgeRuns|buildRiskCellSets)\(/);
  });
});
