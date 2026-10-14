import { buildSnapshotHashEdgeCases } from './helpers/snapshot-hash-golden-cases';
import { createAllNetworkSpecialStonePerformanceFixtures, createAuthorityRoomFromFixture, runHeadlessFixtureTurnStart } from './helpers/network-special-stone-performance-fixtures';

const MatchAuthority: any = require('../utils/match-authority');
const Authority = MatchAuthority.default || MatchAuthority;

function hashes() {
  const cases: Array<{ id: string; snapshot: unknown }> = [];
  for (const fixture of createAllNetworkSpecialStonePerformanceFixtures()) {
    const room: any = createAuthorityRoomFromFixture(fixture);
    room.snapshot = runHeadlessFixtureTurnStart(fixture).snapshot;
    cases.push({ id: `${fixture.id}/authoritative`, snapshot: room.snapshot });
    for (const seat of ['black', 'white', null]) cases.push({ id: `${fixture.id}/public-${seat || 'spectator'}`, snapshot: Authority.buildPublicSnapshot(room, seat) });
  }
  cases.push(...buildSnapshotHashEdgeCases());
  return Object.fromEntries(cases.map(({ id, snapshot }) => {
    const before = JSON.stringify(snapshot);
    const value = [Authority.computeAuthoritativeStateHash(snapshot), Authority.computeProjectedSnapshotHash(snapshot)];
    expect(JSON.stringify(snapshot)).toBe(before);
    return [id, value];
  }));
}

/** Recorded with the clone-based hash source before the direct walk. V2/V3
 * snapshotAfterRef and the client projectedSnapshotHash depend on these. */
const GOLDEN: Record<string, [string, string]> = {
  "baseline-light/authoritative": ["fnv1a32:131a8405", "fnv1a32:131a8405"],
  "baseline-light/public-black": ["fnv1a32:0fc43c25", "fnv1a32:0fc43c25"],
  "baseline-light/public-white": ["fnv1a32:49b37eb6", "fnv1a32:49b37eb6"],
  "baseline-light/public-spectator": ["fnv1a32:b7cf19f2", "fnv1a32:b7cf19f2"],
  "late-dense/authoritative": ["fnv1a32:c799c6e2", "fnv1a32:c799c6e2"],
  "late-dense/public-black": ["fnv1a32:2fa4f3bc", "fnv1a32:2fa4f3bc"],
  "late-dense/public-white": ["fnv1a32:af769dbc", "fnv1a32:af769dbc"],
  "late-dense/public-spectator": ["fnv1a32:df77eb48", "fnv1a32:df77eb48"],
  "late-special-20/authoritative": ["fnv1a32:36be133c", "fnv1a32:36be133c"],
  "late-special-20/public-black": ["fnv1a32:62a82e52", "fnv1a32:62a82e52"],
  "late-special-20/public-white": ["fnv1a32:93b12bbd", "fnv1a32:93b12bbd"],
  "late-special-20/public-spectator": ["fnv1a32:cb209e79", "fnv1a32:cb209e79"],
  "null": ["fnv1a32:5465b825", "fnv1a32:5465b825"],
  "empty": ["fnv1a32:5465b825", "fnv1a32:5465b825"],
  "meta-hashes-and-extra": ["fnv1a32:0e7b7fc4", "fnv1a32:0e7b7fc4"],
  "charge-deltas-present": ["fnv1a32:186485a2", "fnv1a32:186485a2"],
  "charge-deltas-absent": ["fnv1a32:1dc2dd53", "fnv1a32:1dc2dd53"],
  "expansion-unsorted": ["fnv1a32:5ca22551", "fnv1a32:5ca22551"],
  "expansion-not-array": ["fnv1a32:8361e7fa", "fnv1a32:8361e7fa"],
  "array-parts": ["fnv1a32:694b6281", "fnv1a32:694b6281"],
  "numbers-and-holes": ["fnv1a32:a5df9d05", "fnv1a32:a5df9d05"],
  "function-fallback": ["fnv1a32:76fbfc8d", "fnv1a32:76fbfc8d"],
  "map-and-date": ["fnv1a32:430e1d20", "fnv1a32:430e1d20"]
};

test('authoritative and projected snapshot hash strings stay byte-identical', () => {
  const actual = hashes();
  if (process.env.PRINT_SNAPSHOT_HASH_GOLDEN === '1') console.log(JSON.stringify(actual, null, 2));
  expect(actual).toEqual(GOLDEN);
});
