import {
  REPORT_SCHEMA_VERSION,
  buildTacticalSafetyFixtureManifest,
  digestTacticalSafetyFixtureManifest,
  stableFixtureJson
} from '../scripts/perf/measure-cpu-tactical-safety';

function fixture(overrides: Record<string, any> = {}): any {
  return {
    id: 'placement-corner-white',
    operation: 'avoidTacticalBlunder',
    randomSeed: 1,
    input: {
      gameState: { board: [[0, -1], [1, 0]], currentPlayer: -1, turnNumber: 43 },
      cardState: { hands: { black: [], white: [] }, charge: { black: 0, white: 99 } },
      playerKey: 'white',
      level: 6,
      selected: { row: 1, col: 1 },
      candidates: [{ row: 1, col: 1 }],
      cardId: null,
      pendingType: null,
      forceUseCard: false,
      randomState: { seed: 1, calls: 0 }
    },
    ...overrides
  };
}

describe('tactical safety measurement fixture identity', () => {
  test('uses a canonical manifest that changes for board, seed, and candidate changes', () => {
    const baseline = buildTacticalSafetyFixtureManifest([fixture()]);
    const changedBoard = buildTacticalSafetyFixtureManifest([fixture({
      input: { ...fixture().input, gameState: { ...fixture().input.gameState, board: [[0, -1], [1, 1]] } }
    })]);
    const changedSeed = buildTacticalSafetyFixtureManifest([fixture({ randomSeed: 2 })]);
    const changedCandidate = buildTacticalSafetyFixtureManifest([fixture({
      input: { ...fixture().input, selected: { row: 0, col: 0 }, candidates: [{ row: 0, col: 0 }] }
    })]);

    const digest = digestTacticalSafetyFixtureManifest(baseline);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digestTacticalSafetyFixtureManifest(changedBoard)).not.toBe(digest);
    expect(digestTacticalSafetyFixtureManifest(changedSeed)).not.toBe(digest);
    expect(digestTacticalSafetyFixtureManifest(changedCandidate)).not.toBe(digest);
  });

  test('is independent of object property insertion order', () => {
    expect(stableFixtureJson({ b: { y: 2, x: 1 }, a: [2, 1] }))
      .toBe(stableFixtureJson({ a: [2, 1], b: { x: 1, y: 2 } }));
    expect(REPORT_SCHEMA_VERSION).toBe('cpu_tactical_safety_context_measurement.v2');
  });
});
