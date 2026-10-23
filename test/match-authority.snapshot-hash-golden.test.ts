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
  "baseline-light/authoritative": ["fnv1a32:938e8ffd", "fnv1a32:938e8ffd"],
  "baseline-light/public-black": ["fnv1a32:708e928f", "fnv1a32:708e928f"],
  "baseline-light/public-white": ["fnv1a32:a42cb243", "fnv1a32:a42cb243"],
  "baseline-light/public-spectator": ["fnv1a32:f2a9e7cf", "fnv1a32:f2a9e7cf"],
  "late-dense/authoritative": ["fnv1a32:a6bdaed3", "fnv1a32:a6bdaed3"],
  "late-dense/public-black": ["fnv1a32:573dbdd7", "fnv1a32:573dbdd7"],
  "late-dense/public-white": ["fnv1a32:754df54c", "fnv1a32:754df54c"],
  "late-dense/public-spectator": ["fnv1a32:229f8b10", "fnv1a32:229f8b10"],
  "late-special-20/authoritative": ["fnv1a32:8902f4ac", "fnv1a32:8902f4ac"],
  "late-special-20/public-black": ["fnv1a32:e95b767a", "fnv1a32:e95b767a"],
  "late-special-20/public-white": ["fnv1a32:34dbd7da", "fnv1a32:34dbd7da"],
  "late-special-20/public-spectator": ["fnv1a32:c0113cd6", "fnv1a32:c0113cd6"],
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
