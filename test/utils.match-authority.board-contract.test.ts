import * as MatchAuthority from '../utils/match-authority.js';

function createBoardSnapshot(cells: Array<Record<string, unknown>> = []) {
  return {
    stateVersion: 7,
    gameState: {
      board: [
        [1, 1, 1, 1],
        [1, 1, 1, 1],
        [1, -1, -1, -1],
        [-1, -1, -1, -1]
      ],
      boardConfig: {
        rows: 4,
        cols: 4,
        shape: 'rectangle'
      },
      boardExpansion: {
        cells
      }
    },
    cardState: {
      markers: [],
      hands: { black: [], white: [] }
    }
  };
}

describe('match authority board contract', () => {
  test.each([
    ['numeric string', '2'],
    ['single-item array', [2]],
    ['boolean', true],
    ['null', null]
  ])('rejects an explicitly present non-numeric board contract version: %s', (_name, value) => {
    const snapshot: any = createBoardSnapshot([]);
    snapshot._meta = { boardContractVersion: value };

    expect(MatchAuthority.inspectSnapshotBoardContract(snapshot, {
      allowLegacy: true,
      requireFullSnapshot: true
    })).toEqual(expect.objectContaining({
      ok: false,
      version: null,
      legacy: false,
      errors: expect.arrayContaining([expect.stringContaining('unsupported board contract version')])
    }));
  });

  test('an explicit invalid version on a partial snapshot is not treated as legacy', () => {
    const partial = {
      _meta: { boardContractVersion: '2' },
      gameState: { board: [[0]] }
    };

    expect(MatchAuthority.inspectSnapshotBoardContract(partial, {
      allowLegacy: true,
      requireFullSnapshot: false
    })).toEqual(expect.objectContaining({
      ok: false,
      version: null,
      legacy: false,
      errors: expect.arrayContaining([expect.stringContaining('requires gameState and cardState')])
    }));
  });

  test('only a missing version is legacy, and malformed legacy boards are still rejected', () => {
    const validLegacy: any = createBoardSnapshot([]);
    const malformedLegacy: any = createBoardSnapshot([]);
    malformedLegacy.gameState.board = [
      [0, 0],
      [0]
    ];
    malformedLegacy.gameState.boardConfig = {
      rows: 2,
      cols: 2,
      shape: 'rectangle'
    };

    expect(MatchAuthority.inspectSnapshotBoardContract(validLegacy, {
      allowLegacy: true,
      requireFullSnapshot: true
    })).toEqual(expect.objectContaining({
      ok: true,
      version: null,
      legacy: true
    }));
    expect(MatchAuthority.inspectSnapshotBoardContract(malformedLegacy, {
      allowLegacy: true,
      requireFullSnapshot: true
    })).toEqual(expect.objectContaining({
      ok: false,
      version: null,
      legacy: true,
      errors: expect.arrayContaining([expect.stringMatching(/rectangular|row/i)])
    }));
  });

  test('legacy snapshot is canonicalized once and stamped as v2', () => {
    const snapshot: any = createBoardSnapshot([]);
    snapshot.gameState.boardExpansion = {
      cells: [],
      active: true,
      side: 'top',
      row: -1,
      col: 0,
      owner: -1
    };

    const inspection = MatchAuthority.normalizeSnapshotBoardContract(snapshot, {
      allowLegacy: true,
      requireFullSnapshot: true
    });

    expect(inspection).toEqual(expect.objectContaining({
      ok: true,
      legacy: true,
      migrated: true,
      version: MatchAuthority.BOARD_CONTRACT_VERSION
    }));
    expect(snapshot._meta.boardContractVersion).toBe(2);
    expect(snapshot.gameState.boardExpansion.cells).toEqual([]);
    expect(snapshot.gameState.boardExpansion.active).toBe(false);
    expect(snapshot.gameState.boardExpansion.row).toBeNull();
    expect(snapshot.gameState.boardExpansion.col).toBeNull();
  });

  test('v2 rejects duplicate coordinates and invalid owners', () => {
    const duplicate: any = createBoardSnapshot([
      { row: -1, col: 0, side: 'top', owner: -1 },
      { row: -1, col: 0, side: 'top', owner: 0 }
    ]);
    duplicate._meta = { boardContractVersion: 2 };

    const invalidOwner: any = createBoardSnapshot([
      { row: -1, col: 0, side: 'top', owner: 7 }
    ]);
    invalidOwner._meta = { boardContractVersion: 2 };

    expect(MatchAuthority.inspectSnapshotBoardContract(duplicate, {
      allowLegacy: false,
      requireFullSnapshot: true
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('duplicate expansion coordinate')])
    }));
    expect(MatchAuthority.inspectSnapshotBoardContract(invalidOwner, {
      allowLegacy: false,
      requireFullSnapshot: true
    })).toEqual(expect.objectContaining({
      ok: false,
      errors: expect.arrayContaining([expect.stringContaining('invalid owner')])
    }));
  });

  test('v2 accepts only complete same-owner Shinra Bansho God groups', () => {
    const valid: any = createBoardSnapshot([]);
    valid._meta = { boardContractVersion: 2 };
    valid.cardState.markers.push({
      id: 'shinra-valid',
      markerId: 'shinra-valid',
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: {
        type: 'SHINRA_BANSHO_GOD',
        footprint: 'square_2x2.v1',
        permanent: true
      }
    });

    expect(MatchAuthority.inspectSnapshotBoardContract(valid, {
      allowLegacy: false,
      requireFullSnapshot: true
    })).toEqual(expect.objectContaining({ ok: true }));

    const partial = JSON.parse(JSON.stringify(valid));
    partial.gameState.board[1][1] = 0;
    const wrongOwner = JSON.parse(JSON.stringify(valid));
    wrongOwner.gameState.board[1][1] = -1;
    const outside = JSON.parse(JSON.stringify(valid));
    outside.cardState.markers[0].row = 3;
    outside.cardState.markers[0].col = 3;

    for (const malformed of [partial, wrongOwner, outside]) {
      expect(MatchAuthority.inspectSnapshotBoardContract(malformed, {
        allowLegacy: false,
        requireFullSnapshot: true
      })).toEqual(expect.objectContaining({
        ok: false,
        errors: expect.arrayContaining([
          expect.stringContaining('SHINRA_BANSHO_GOD')
        ])
      }));
    }
  });

  test('descriptor order does not change authority hash or mutate canonical state', () => {
    const first: any = createBoardSnapshot([
      { row: -1, col: 2, side: 'top', owner: -1 },
      { row: -1, col: 0, side: 'top', owner: -1 },
      { row: -1, col: 1, side: 'top', owner: -1 }
    ]);
    const second: any = createBoardSnapshot(first.gameState.boardExpansion.cells.slice().reverse());
    MatchAuthority.normalizeSnapshotBoardContract(first, {
      allowLegacy: true,
      requireFullSnapshot: true
    });
    MatchAuthority.normalizeSnapshotBoardContract(second, {
      allowLegacy: true,
      requireFullSnapshot: true
    });
    second.gameState.boardExpansion.cells.reverse();
    const before = JSON.parse(JSON.stringify(second.gameState.boardExpansion.cells));

    expect(MatchAuthority.computeAuthoritativeStateHash(first))
      .toBe(MatchAuthority.computeAuthoritativeStateHash(second));
    expect(second.gameState.boardExpansion.cells).toEqual(before);
  });

  test('shape-aware count includes expansion discs and can reverse the winner', () => {
    const snapshot: any = createBoardSnapshot([
      { row: -1, col: 0, side: 'top', owner: -1 },
      { row: -1, col: 1, side: 'top', owner: -1 },
      { row: -1, col: 2, side: 'top', owner: -1 }
    ]);
    MatchAuthority.normalizeSnapshotBoardContract(snapshot, {
      allowLegacy: true,
      requireFullSnapshot: true
    });

    expect(MatchAuthority.countSnapshotBoardDiscs(snapshot)).toEqual({
      black: 9,
      white: 10
    });
  });

  test.each([
    ['black', undefined],
    ['white', undefined],
    [null, 'spectator']
  ])('public projection preserves v2 metadata for %s', (seatKey, viewerRole) => {
    const snapshot: any = createBoardSnapshot([]);
    MatchAuthority.normalizeSnapshotBoardContract(snapshot, {
      allowLegacy: true,
      requireFullSnapshot: true
    });

    const projected = MatchAuthority.projectSnapshotForViewer(snapshot, seatKey as any, {
      stateVersion: 7,
      viewerRole: viewerRole as any
    });

    expect(projected._meta).toEqual(expect.objectContaining({
      authority: 'server',
      version: 7,
      boardContractVersion: 2
    }));
  });
});
