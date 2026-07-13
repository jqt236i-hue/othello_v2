import { createCpuDecisionMoveSelection } from '../game/cpu-decision-move-selection';

const MOVES = [
  { id: 'low-profit', row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
  { id: 'profitable-a', row: 4, col: 5, flips: [{}, {}, {}] },
  { id: 'profitable-b', row: 5, col: 4, flips: [{}, {}, {}, {}] }
];

function createHarness(options: { level?: number; pendingType?: string; forceLv6Placement?: boolean } = {}) {
  const expectedRequest = { requestId: 'expected-score-request' };
  const chooseMove = jest.fn(() => MOVES[2]);
  const createExpectedCandidateScoringRequest = jest.fn(() => expectedRequest);
  const core = {
    chooseMove,
    createExpectedCandidateScoringRequest
  };
  const filterMovesByLv6PlacementPriority = jest.fn((_player, _level, moves) => moves);
  const filterLv6OpenCornerAdjacentMoves = jest.fn((moves) => moves);
  const config = {
    buildLv6LookaheadOptions: jest.fn(),
    buildMovePlanContext: jest.fn(() => null),
    choosePendingTargetWithPolicy: jest.fn(() => null),
    createLearnedScoreFn: jest.fn(() => null),
    createLookaheadMetaLogger: jest.fn(),
    cpuDebugLog: jest.fn(),
    error: jest.fn(),
    filterLv6OpenCornerAdjacentMoves,
    filterMovesByLv6PlacementPriority,
    getAISystem: jest.fn(() => null),
    getCardState: jest.fn(() => ({})),
    getBoardBonusValueAt: jest.fn(() => 0),
    getCpuPolicyCore: jest.fn(() => core),
    getCpuRng: jest.fn(() => ({ random: () => 0.5 })),
    getCurrentCpuBoard: jest.fn(() => Array.from({ length: 8 }, () => Array(8).fill(0))),
    getGameState: jest.fn(() => ({ board: [] })),
    isAISystemAvailable: jest.fn(() => false),
    isPlayableBoard: jest.fn(() => false),
    maybeOverrideWithStrictPendingPlacement: jest.fn((move) => move),
    readCpuPendingEffect: jest.fn(() => null),
    resolveCpuLv6LookaheadWeights: jest.fn(() => ({})),
    resolveCpuSmartnessLevel: jest.fn(() => options.level ?? 6),
    resolvePendingType: jest.fn(() => options.pendingType ?? 'GOLD_STONE'),
    resolvePlayerValue: jest.fn(() => -1),
    selectMoveFromLearnedPolicy: jest.fn(() => null),
    selectMoveFromOthelloPolicy: jest.fn(() => null),
    shouldForceCardModeLv6Placement: jest.fn(() => options.forceLv6Placement === true),
    warn: jest.fn()
  };
  return {
    selection: createCpuDecisionMoveSelection(config as any),
    config,
    core,
    chooseMove,
    createExpectedCandidateScoringRequest,
    expectedRequest,
    filterMovesByLv6PlacementPriority,
    filterLv6OpenCornerAdjacentMoves
  };
}

describe('CPU decision candidate-scoring handoff', () => {
  test('builds the Worker request after economic and Lv6 placement filters without duplicate logs', () => {
    const harness = createHarness({ level: 5 });
    const identity = {
      requestId: 'cpu-score-9',
      decisionEpoch: 9,
      stateVersion: 33,
      turnNumber: 15,
      playerKey: 'white'
    };

    const request = harness.selection.prepareCpuCandidateScoringRequest(MOVES, 'white', identity);

    expect(request).toBe(harness.expectedRequest);
    expect(harness.filterMovesByLv6PlacementPriority).toHaveBeenCalledWith(
      'white',
      5,
      [MOVES[1], MOVES[2]],
      { emitDebugLog: false }
    );
    expect(harness.filterLv6OpenCornerAdjacentMoves).not.toHaveBeenCalled();
    expect(harness.createExpectedCandidateScoringRequest).toHaveBeenCalledWith(
      [MOVES[1], MOVES[2]],
      5,
      null,
      identity
    );
    expect(harness.config.cpuDebugLog).not.toHaveBeenCalled();
  });

  test.each([
    [{ level: 6 }, 'higher-level selector'],
    [{ level: 4, pendingType: 'FREE_PLACEMENT' }, 'pending selector'],
    [{ level: 4, forceLv6Placement: true }, 'forced Lv6 selector']
  ])('does not speculatively score before the %s route', (options) => {
    const harness = createHarness(options as any);
    const request = harness.selection.prepareCpuCandidateScoringRequest(MOVES, 'white', {
      requestId: 'cpu-score-10',
      decisionEpoch: 10,
      stateVersion: null,
      turnNumber: 16,
      playerKey: 'white'
    });

    expect(request).toBeNull();
    expect(harness.filterMovesByLv6PlacementPriority).not.toHaveBeenCalled();
    expect(harness.createExpectedCandidateScoringRequest).not.toHaveBeenCalled();
  });

  test('passes the attempt-local precompute only into the final policy-core choice', () => {
    const harness = createHarness();
    const precompute = {
      expectedRequest: harness.expectedRequest,
      batch: { request: harness.expectedRequest, response: { scores: [] } }
    };

    const selected = harness.selection.selectCpuMoveWithPolicy(MOVES, 'white', precompute);

    expect(selected).toBe(MOVES[2]);
    expect(harness.filterMovesByLv6PlacementPriority).toHaveBeenCalledWith(
      'white',
      6,
      [MOVES[1], MOVES[2]],
      { emitDebugLog: true }
    );
    expect(harness.chooseMove).toHaveBeenCalledWith(
      [MOVES[1], MOVES[2]],
      6,
      expect.objectContaining({ random: expect.any(Function) }),
      null,
      expect.objectContaining({
        expectedCandidateScoringRequest: harness.expectedRequest,
        candidateScoringBatch: precompute.batch
      })
    );
  });
});
