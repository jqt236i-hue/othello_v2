import {
  buildCpuTurnAnalysisSeed,
  createCpuTurnAnalysisInvocation,
  deriveCardDecisionAnalysis,
  derivePlacementAnalysis,
  isCpuTurnInvocationIdentityCurrent
} from '../game/cpu-turn-analysis';

function identity(overrides: Record<string, any> = {}) {
  return {
    runId: 7,
    playerKey: 'white',
    turnNumber: 12,
    decisionLevel: 4,
    stateVersion: 33,
    decisionEpoch: 19,
    pendingEffectId: null,
    pendingStage: null,
    retryGeneration: 2,
    ...overrides
  };
}

function seed(overrides: Record<string, any> = {}) {
  return buildCpuTurnAnalysisSeed({
    identity: identity(overrides.identity),
    protection: overrides.protection || [],
    flipBlockers: overrides.flipBlockers || [],
    cardUsability: overrides.cardUsability || Object.freeze({
      usableCardIds: Object.freeze(['card-a']),
      usableCardTypes: Object.freeze(['TYPE_A']),
      selectorEvidence: Object.freeze({}),
      usableSlots: Object.freeze([])
    })
  });
}

describe('CPU turn invocation-scoped analysis', () => {
  test('builds an immutable seed without eagerly deriving card, placement, or commentary data', () => {
    const analysisSeed = seed();

    expect(Object.isFrozen(analysisSeed)).toBe(true);
    expect(Object.isFrozen(analysisSeed.identity)).toBe(true);
    expect(Object.isFrozen(analysisSeed.protection)).toBe(true);
    expect(Object.isFrozen(analysisSeed.flipBlockers)).toBe(true);
    expect(analysisSeed).not.toHaveProperty('cardLegalMoves');
    expect(analysisSeed).not.toHaveProperty('placementCandidates');
    expect(analysisSeed).not.toHaveProperty('commentary');
  });

  test('memoizes each requested derivation and reuses only explicit equivalent move-scan evidence', () => {
    const analysisSeed = seed();
    const sharedScan = jest.fn(() => ({
      cardLegalMoves: [{ row: 2, col: 3, flips: [] }],
      moveScanEvidence: { token: 'same-scan' }
    }));
    const getCardLegalMoves = jest.fn(() => [{ row: 9, col: 9 }]);
    const buildBoardMetrics = jest.fn((moves) => ({ legalMovesCount: moves.length }));
    const generatePlacementCandidates = jest.fn(() => [{ row: 4, col: 5, effectUsed: null }]);
    const reuseMoveScanEvidence = jest.fn((evidence) => (
      evidence.token === 'same-scan'
        ? [{ row: 2, col: 3, flips: [], effectUsed: null, player: -1, playerValue: -1 }]
        : null
    ));
    const turnStartMetrics = jest.fn(() => ({ phase: 'middle', mobility: { black: 4, white: 3 } }));
    const postMoveMetrics = jest.fn(() => ({ phase: 'middle', mobility: { black: 2, white: 5 } }));
    const invocation = createCpuTurnAnalysisInvocation(analysisSeed, {
      card: { deriveEquivalentMoveScan: sharedScan, getCardLegalMoves, buildBoardMetrics },
      placement: { generatePlacementCandidates, reuseMoveScanEvidence },
      commentary: {
        'turn-start': { buildMetrics: turnStartMetrics },
        'post-move': { buildMetrics: postMoveMetrics }
      }
    });

    const cardOne = invocation.deriveCardDecisionAnalysis();
    const cardTwo = invocation.deriveCardDecisionAnalysis();
    const placementOne = invocation.derivePlacementAnalysis(cardOne);
    const placementTwo = invocation.derivePlacementAnalysis(cardTwo);
    const commentaryOne = invocation.deriveCommentaryAnalysis('turn-start');
    const commentaryTwo = invocation.deriveCommentaryAnalysis('turn-start');
    invocation.deriveCommentaryAnalysis('post-move');

    expect(cardOne).toBe(cardTwo);
    expect(placementOne).toBe(placementTwo);
    expect(commentaryOne).toBe(commentaryTwo);
    expect(sharedScan).toHaveBeenCalledTimes(1);
    expect(getCardLegalMoves).not.toHaveBeenCalled();
    expect(buildBoardMetrics).toHaveBeenCalledTimes(1);
    expect(reuseMoveScanEvidence).toHaveBeenCalledTimes(1);
    expect(generatePlacementCandidates).not.toHaveBeenCalled();
    expect(turnStartMetrics).toHaveBeenCalledTimes(1);
    expect(postMoveMetrics).toHaveBeenCalledTimes(1);
    expect(placementOne.placementCandidates).toEqual([
      { row: 2, col: 3, flips: [], effectUsed: null, player: -1, playerValue: -1 }
    ]);
  });

  test('does not derive card analysis for usable zero when the consumer requests placement only', () => {
    const analysisSeed = seed({
      cardUsability: Object.freeze({
        usableCardIds: Object.freeze([]),
        usableCardTypes: Object.freeze([]),
        selectorEvidence: Object.freeze({}),
        usableSlots: Object.freeze([])
      })
    });
    const getCardLegalMoves = jest.fn(() => []);
    const buildBoardMetrics = jest.fn(() => ({}));
    const generatePlacementCandidates = jest.fn(() => [{ row: 2, col: 3 }]);
    const invocation = createCpuTurnAnalysisInvocation(analysisSeed, {
      card: { getCardLegalMoves, buildBoardMetrics },
      placement: { generatePlacementCandidates }
    });

    expect(invocation.derivePlacementAnalysis().placementCandidates).toEqual([{ row: 2, col: 3 }]);
    expect(invocation.derivePlacementAnalysis().placementCandidates).toEqual([{ row: 2, col: 3 }]);
    expect(getCardLegalMoves).not.toHaveBeenCalled();
    expect(buildBoardMetrics).not.toHaveBeenCalled();
    expect(generatePlacementCandidates).toHaveBeenCalledTimes(1);
  });

  test('falls back to purpose-specific placement generation when evidence cannot be reused', () => {
    const analysisSeed = seed();
    const card = deriveCardDecisionAnalysis(analysisSeed, {
      deriveEquivalentMoveScan: () => ({
        cardLegalMoves: [{ row: 1, col: 2 }],
        moveScanEvidence: { token: 'old-input' }
      }),
      getCardLegalMoves: () => []
    });
    const fallback = jest.fn(() => [{ row: 5, col: 6, effectUsed: 'SWAP_WITH_ENEMY' }]);
    const placement = derivePlacementAnalysis(analysisSeed, card, {
      reuseMoveScanEvidence: () => null,
      generatePlacementCandidates: fallback
    });

    expect(fallback).toHaveBeenCalledTimes(1);
    expect(placement.placementCandidates).toEqual([{ row: 5, col: 6, effectUsed: 'SWAP_WITH_ENEMY' }]);
  });

  test.each([
    ['runId', 8],
    ['playerKey', 'black'],
    ['turnNumber', 13],
    ['decisionLevel', 5],
    ['stateVersion', 34],
    ['decisionEpoch', 20],
    ['pendingEffectId', 'pending-2'],
    ['pendingStage', 'selectTarget'],
    ['retryGeneration', 3]
  ])('rejects a stale identity when %s differs', (field, value) => {
    const expected = identity();
    const current = identity({ [field]: value });
    expect(isCpuTurnInvocationIdentityCurrent(expected as any, current as any)).toBe(false);
  });

  test('rejects reuse across an async boundary when stateVersion is unavailable', () => {
    const expected = identity({ stateVersion: null });
    expect(isCpuTurnInvocationIdentityCurrent(expected as any, expected as any)).toBe(true);
    expect(isCpuTurnInvocationIdentityCurrent(expected as any, expected as any, {
      crossedAsyncBoundary: true
    })).toBe(false);
  });
});

describe('CPU move-generator equivalence evidence', () => {
  afterEach(() => {
    jest.resetModules();
    jest.unmock('../game/logic/core');
  });

  test('uses one canonical scan only for the proven no-pending equivalent shape', () => {
    const baseMoves = [
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
      { row: 4, col: 5, flips: [{ row: 4, col: 4 }] }
    ];
    const getLegalMoves = jest.fn(() => baseMoves);
    jest.doMock('../game/logic/core', () => ({ getLegalMoves }));
    const generator = require('../game/move-generator.ts');
    const gameState = {
      currentPlayer: -1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    const cardState = { markers: [] };
    const protection: any[] = [];
    const blockers: any[] = [];
    const scanIdentity = identity();

    const scan = generator.deriveEquivalentCpuMoveScanInState({
      identity: scanIdentity,
      gameState,
      cardState,
      playerValue: -1,
      pending: null,
      protection,
      flipBlockers: blockers
    });

    expect(getLegalMoves).toHaveBeenCalledTimes(1);
    expect(scan.cardLegalMoves).toEqual(baseMoves);
    expect(scan.moveScanEvidence.placementCandidates).toEqual(baseMoves.map((move) => ({
      ...move,
      effectUsed: null,
      player: -1,
      playerValue: -1
    })));
    expect(generator.reuseEquivalentCpuMoveScanEvidence(scan.moveScanEvidence, {
      identity: scanIdentity,
      gameState,
      cardState,
      playerValue: -1,
      pending: null,
      protection,
      flipBlockers: blockers
    })).toEqual(scan.moveScanEvidence.placementCandidates);
    expect(generator.reuseEquivalentCpuMoveScanEvidence(scan.moveScanEvidence, {
      identity: scanIdentity,
      gameState,
      cardState,
      playerValue: -1,
      pending: { type: 'FREE_PLACEMENT' },
      protection,
      flipBlockers: blockers
    })).toBeNull();
  });
});
