/** Snapshot shapes whose authoritative/projected hash strings are fixed by
 * test/match-authority.snapshot-hash-golden.test.ts. */
export function buildSnapshotHashEdgeCases(): Array<{ id: string; snapshot: unknown }> {
    const holes: unknown[] = [1, , 3]; // eslint-disable-line no-sparse-arrays
    return [
        { id: 'null', snapshot: null },
        { id: 'empty', snapshot: {} },
        { id: 'meta-hashes-and-extra', snapshot: { _meta: { projectedSnapshotHash: 'x', authoritativeStateHash: 'y', version: 3, note: undefined }, gameState: { board: [[0, 1], [-1, 0]] } } },
        { id: 'charge-deltas-present', snapshot: { cardState: { chargeDeltaEvents: [{ amount: 3 }], charge: { black: 2 } } } },
        { id: 'charge-deltas-absent', snapshot: { cardState: { charge: { black: 2, white: -0 } } } },
        { id: 'expansion-unsorted', snapshot: { gameState: { boardExpansion: { cells: [{ row: 2, col: 1, owner: 1 }, { row: 0, col: 5 }, { row: 2, col: -1 }, { row: '1', col: 0 }], side: 'left' } } } },
        { id: 'expansion-not-array', snapshot: { gameState: { boardExpansion: { cells: 'none' } } } },
        { id: 'array-parts', snapshot: { cardState: [1, 2], _meta: ['a'], gameState: [0] } },
        { id: 'numbers-and-holes', snapshot: { gameState: { values: [NaN, Infinity, -0, 1.5], holes, text: 'く"\n' } } },
        { id: 'function-fallback', snapshot: { gameState: { board: [[1]], helper() { return 1; }, list: [() => 1, 2], when: new Date(0) } } },
        { id: 'map-and-date', snapshot: { gameState: { lookup: new Map([['a', 1]]), when: new Date(0) } } }
    ];
}
