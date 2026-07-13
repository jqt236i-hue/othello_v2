import {
  CPU_CANDIDATE_SCORING_PROTOCOL_VERSION,
  createCpuCandidateDigest,
  createCpuCandidateScoringBoardShape,
  createCpuCandidateScoringRequest,
  isCpuCandidateScoringRequest,
  scoreCpuCandidateRequest,
  verifyCpuCandidateScoringBatch,
  verifyCpuCandidateScoringResponse,
  type CpuCandidateCellClassification,
  type CpuCandidateScoringMove
} from '../game/ai/cpu-candidate-scoring';
import { createCpuPolicyBoardPrimitives } from '../game/ai/cpu-policy-board-primitives';

function makeRequest(overrides: Record<string, unknown> = {}) {
  const candidateMoves: CpuCandidateScoringMove[] = [
    { row: 0, col: 0, flips: [{ row: 1, col: 1 }, { row: 2, col: 2 }] },
    { row: 0, col: 3, flips: [] },
    { row: 1, col: 1, flips: [] },
    { row: 0, col: 1, flips: [] }
  ];
  const classifications: CpuCandidateCellClassification[] = [
    { row: 0, col: 0, isCorner: true, isEdge: true, isXSquare: false, isCSquare: false },
    { row: 0, col: 3, isCorner: false, isEdge: true, isXSquare: false, isCSquare: false },
    { row: 1, col: 1, isCorner: false, isEdge: false, isXSquare: true, isCSquare: false },
    { row: 0, col: 1, isCorner: false, isEdge: true, isXSquare: false, isCSquare: true }
  ];
  return createCpuCandidateScoringRequest({
    requestId: 'fixture-1',
    decisionEpoch: 8,
    stateVersion: 22,
    turnNumber: 14,
    playerKey: 'white',
    level: 6,
    boardShape: createCpuCandidateScoringBoardShape(7, 7, classifications),
    candidateMoves,
    ...overrides
  } as any);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('pure CPU candidate scoring boundary', () => {
  test('keeps exact base heuristic, overlapping corner/edge bonus, and deterministic tie score', () => {
    const request = makeRequest();
    const response = scoreCpuCandidateRequest(request);

    expect(response.scores.map((score) => score.heuristicScore)).toEqual([
      15800, // two flips + corner + edge + Lv5 corner bonus
      600,
      -1800,
      -400 // edge + C + Lv6 C penalty
    ]);
    expect(response.scores[0].tieScore).toBe(
      (7 - 0) * 0.001 + (7 - 0) * 0.0001 + (4 - 0) * 0.00001
    );
    expect(response.scores[2].tieScore).toBe(
      (7 - 1) * 0.001 + (7 - 1) * 0.0001 + (4 - 2) * 0.00001
    );
    expect(response.scores[0].totalScore).toBe(
      response.scores[0].heuristicScore + response.scores[0].tieScore
    );
  });

  test('candidate and context digests cover order, flips, level, and projected board shape', () => {
    const base = makeRequest();
    const reordered = makeRequest({ candidateMoves: base.candidateMoves.slice().reverse() });
    const changedFlips = clone(base.candidateMoves);
    changedFlips[0].flips.push({ row: 3, col: 3 });
    const flipped = makeRequest({ candidateMoves: changedFlips });
    const changedLevel = makeRequest({ level: 5 });
    const changedShape = makeRequest({
      boardShape: createCpuCandidateScoringBoardShape(7, 7, [])
    });

    expect(reordered.candidateDigest).not.toBe(base.candidateDigest);
    expect(flipped.candidateDigest).not.toBe(base.candidateDigest);
    expect(changedLevel.candidateDigest).toBe(base.candidateDigest);
    expect(changedLevel.contextDigest).not.toBe(base.contextDigest);
    expect(changedShape.contextDigest).not.toBe(base.contextDigest);
    expect(createCpuCandidateDigest(base.candidateMoves)).toBe(base.candidateDigest);
  });

  test('rejects malformed/non-finite requests and stale or mismatched responses', () => {
    const request = makeRequest();
    const response = scoreCpuCandidateRequest(request);

    const nonFinite = clone(request) as any;
    nonFinite.candidateMoves[0].row = Number.NaN;
    expect(isCpuCandidateScoringRequest(nonFinite)).toBe(false);
    expect(() => scoreCpuCandidateRequest(nonFinite)).toThrow(/validation/);

    const badProtocol = clone(request) as any;
    badProtocol.protocolVersion = CPU_CANDIDATE_SCORING_PROTOCOL_VERSION + 1;
    expect(isCpuCandidateScoringRequest(badProtocol)).toBe(false);

    const staleEpoch = clone(response);
    staleEpoch.decisionEpoch += 1;
    expect(verifyCpuCandidateScoringResponse(request, staleEpoch)).toBe(false);

    const wrongCoordinate = clone(response);
    wrongCoordinate.scores[1].col += 1;
    expect(verifyCpuCandidateScoringResponse(request, wrongCoordinate)).toBe(false);

    const nonFiniteScore = clone(response) as any;
    nonFiniteScore.scores[0].tieScore = Number.POSITIVE_INFINITY;
    expect(verifyCpuCandidateScoringResponse(request, nonFiniteScore)).toBe(false);

    expect(verifyCpuCandidateScoringBatch(request, { request, response })).toBe(true);
  });

  test('matches the legacy formula across bounded deterministic randomized fixtures', () => {
    let seed = 0x6d2b79f5;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 0x100000000;
    };
    const primitives = createCpuPolicyBoardPrimitives();

    for (let fixture = 0; fixture < 120; fixture += 1) {
      const rows = 4 + Math.floor(random() * 9);
      const cols = 4 + Math.floor(random() * 9);
      const board = Array.from({ length: rows }, () => Array(cols).fill(0));
      const count = 1 + Math.floor(random() * 24);
      const moves = Array.from({ length: count }, () => {
        const flipCount = Math.floor(random() * 12);
        return {
          row: Math.floor(random() * rows),
          col: Math.floor(random() * cols),
          flips: Array.from({ length: flipCount }, () => ({
            row: Math.floor(random() * rows),
            col: Math.floor(random() * cols)
          }))
        };
      });
      const level = 1 + Math.floor(random() * 8);
      const shape = primitives.createCandidateScoringBoardShape(moves as any, board as any);
      const request = createCpuCandidateScoringRequest({
        requestId: `random-${fixture}`,
        decisionEpoch: fixture,
        stateVersion: fixture,
        turnNumber: fixture,
        playerKey: fixture % 2 === 0 ? 'black' : 'white',
        level,
        boardShape: shape,
        candidateMoves: moves
      });
      const response = scoreCpuCandidateRequest(request);

      response.scores.forEach((score, index) => {
        const move = moves[index];
        const legacyHeuristic = primitives.scoreMoveHeuristic(move as any, level, board as any);
        const legacyTie =
          (rows - 1 - move.row) * 0.001 +
          (cols - 1 - move.col) * 0.0001 +
          (moves.length - index) * 0.00001;
        expect(score.heuristicScore).toBe(legacyHeuristic);
        expect(score.tieScore).toBe(legacyTie);
        expect(score.totalScore).toBe(legacyHeuristic + legacyTie);
      });
    }
  });
});
