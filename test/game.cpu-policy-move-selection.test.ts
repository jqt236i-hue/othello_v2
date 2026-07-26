import { createCpuPolicyMoveSelection } from '../game/ai/cpu-policy-move-selection';
import {
  createCpuCandidateScoringBoardShape,
  createCpuCandidateScoringRequest,
  scoreCpuCandidateRequest
} from '../game/ai/cpu-candidate-scoring';

describe('cpu-policy move selection module', () => {
  test('computeLegalMoveMetrics aggregates flips, gain, and board bonus', () => {
    const helpers = createCpuPolicyMoveSelection();
    const metrics = helpers.computeLegalMoveMetrics([
      { row: 1, col: 1, flips: [{}, {}] } as any,
      { row: 2, col: 2, flips: [{}] } as any
    ], (row: number, col: number) => (row === 2 && col === 2 ? 3 : 0));

    expect(metrics).toEqual({
      maxLegalFlips: 2,
      avgLegalFlips: 1.5,
      maxLegalGain: 4,
      maxLegalBoardBonus: 3
    });
  });

  test('rankMoves uses learned score, heuristic score, and stable tie-break', () => {
    const a = { id: 'a', row: 4, col: 4 } as any;
    const b = { id: 'b', row: 1, col: 1 } as any;
    const helpers = createCpuPolicyMoveSelection({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveHeuristic: (move: any) => (move.id === 'a' ? 1 : 0)
    });

    const ranked = helpers.rankMoves([a, b], 4, {
      enableHeuristic: true,
      scoreMove: (move: any) => (move.id === 'b' ? 3 : 0)
    } as any);

    expect(ranked).toEqual([b, a]);
  });

  test('uses a fully matched precomputed batch and falls back locally for stale or malformed replies', () => {
    const a = { id: 'a', row: 0, col: 0, flips: [] } as any;
    const b = { id: 'b', row: 7, col: 7, flips: [] } as any;
    const shape = createCpuCandidateScoringBoardShape(7, 7, []);
    const request = createCpuCandidateScoringRequest({
      requestId: 'precomputed-1',
      decisionEpoch: 4,
      stateVersion: 12,
      turnNumber: 8,
      playerKey: 'white',
      level: 4,
      boardShape: shape,
      candidateMoves: [a, b]
    });
    const response = scoreCpuCandidateRequest(request);
    response.scores[1].heuristicScore = 100;
    response.scores[1].totalScore = response.scores[1].heuristicScore + response.scores[1].tieScore;

    const helpers = createCpuPolicyMoveSelection({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveHeuristic: () => 0,
      createCandidateScoringBoardShape: () => shape
    });

    expect(helpers.rankMoves([a, b], 4, {
      enableHeuristic: true,
      expectedCandidateScoringRequest: request,
      candidateScoringBatch: { request, response }
    })).toEqual([b, a]);

    const staleResponse = JSON.parse(JSON.stringify(response));
    staleResponse.turnNumber += 1;
    expect(helpers.rankMoves([a, b], 4, {
      enableHeuristic: true,
      expectedCandidateScoringRequest: request,
      candidateScoringBatch: { request, response: staleResponse }
    })).toEqual([a, b]);

    const malformedResponse = JSON.parse(JSON.stringify(response));
    malformedResponse.scores[1].tieScore = Number.NaN;
    expect(helpers.rankMoves([a, b], 4, {
      enableHeuristic: true,
      expectedCandidateScoringRequest: request,
      candidateScoringBatch: { request, response: malformedResponse }
    })).toEqual([a, b]);

    const currentRequest = createCpuCandidateScoringRequest({
      requestId: 'precomputed-2',
      decisionEpoch: 5,
      stateVersion: 13,
      turnNumber: 9,
      playerKey: 'white',
      level: 4,
      boardShape: shape,
      candidateMoves: [a, b]
    });
    expect(helpers.rankMoves([a, b], 4, {
      enableHeuristic: true,
      expectedCandidateScoringRequest: currentRequest,
      candidateScoringBatch: { request, response }
    })).toEqual([a, b]);
  });

  test('builds the canonical scorer request from an explicit attempt identity', () => {
    const a = { row: 2, col: 3, flips: [[3, 3]] } as any;
    const b = { row: 4, col: 5, flips: [] } as any;
    const shape = createCpuCandidateScoringBoardShape(7, 7, []);
    const helpers = createCpuPolicyMoveSelection({
      createCandidateScoringBoardShape: () => shape
    });
    const identity = {
      requestId: 'worker-attempt-17',
      decisionEpoch: 17,
      stateVersion: 'room:42',
      turnNumber: 9,
      playerKey: 'white'
    };

    const request = helpers.createExpectedCandidateScoringRequest([a, b], 4, null, identity);

    expect(request).toMatchObject({ ...identity, level: 4, boardShape: shape });
    expect(request.candidateMoves).toEqual([
      { row: 2, col: 3, flips: [{ row: 3, col: 3 }] },
      b,
    ]);
  });

  test('does not swallow or repeat learned-score callback failures', () => {
    const a = { id: 'a', row: 0, col: 0, flips: [] } as any;
    const b = { id: 'b', row: 7, col: 7, flips: [] } as any;
    const shape = createCpuCandidateScoringBoardShape(7, 7, []);
    const helpers = createCpuPolicyMoveSelection({
      isFiniteNumber: (value: unknown) => Number.isFinite(Number(value)),
      resolveBoardGeometry: () => ({ maxR: 7, maxC: 7 }),
      scoreMoveHeuristic: () => 0,
      createCandidateScoringBoardShape: () => shape
    });
    const scoreMove = jest.fn(() => {
      throw new Error('learned score failed');
    });

    expect(() => helpers.rankMoves([a, b], 4, { scoreMove })).toThrow('learned score failed');
    expect(scoreMove).toHaveBeenCalledTimes(1);
  });
});
