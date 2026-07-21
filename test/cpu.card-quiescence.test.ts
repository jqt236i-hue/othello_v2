import {
  CpuCardQuiescenceProtocolError,
  createCpuCardQuiescenceRequest,
  executeCpuCardQuiescenceRequest,
  parseCpuCardQuiescenceRequest,
  verifyCpuCardQuiescenceResponse
} from '../game/ai/cpu-card-quiescence';
import { chooseMoveByLookaheadInWorker } from '../game/ai/cpu-policy-lookahead-worker-runtime';

const CpuPolicyCore: any = require('../game/ai/cpu-policy-core');

function createRequest() {
  const board = Array.from({ length: 4 }, () => Array(4).fill(0));
  Object.defineProperty(board, '__sharedBoardShapeMeta', {
    configurable: true,
    value: {
      minRow: 0,
      maxRow: 3,
      minCol: 0,
      maxCol: 3,
      playableKeys: new Set(['0,0', '0,1']),
      meteorHoleKeys: new Set(['0,1']),
      expansionCells: [],
      expansionOwnerByKey: {},
      standard8x8: false
    }
  });
  return createCpuCardQuiescenceRequest({
    requestId: 'card-quiescence:1:2',
    decisionEpoch: 2,
    stateVersion: 'local-turn:1',
    turnNumber: 1,
    playerKey: 'white',
    level: 6,
    playerValue: -1,
    board,
    legalMoves: [{ row: 0, col: 0, flips: [{ row: 1, col: 1 }] }],
    search: {
      depth: 4,
      maxBranch: 6,
      nodeBudget: 120000,
      maxTimeMs: 300,
      endgameSolveEmpties: 12,
      endgameDepth: 10,
      endgameNodeBudget: 600000,
      endgameMaxTimeMs: 700
    },
    boardBonusByCell: { '0,0': 2 },
    boardBonusConsumedByCell: { '0,0': false }
  });
}

describe('CPU card-quiescence portable contract', () => {
  test('projects shape metadata and executes the pure lookahead on a detached board', () => {
    const request = createRequest();
    const chooseMove = jest.fn((moves, options) => {
      expect(options.board).not.toBe(request.board);
      expect((options.board as any).__sharedBoardShapeMeta.playableKeys).toEqual(new Set(['0,0', '0,1']));
      expect(options.boardBonusByCell).toEqual({ '0,0': 2 });
      return moves[0];
    });

    const response = executeCpuCardQuiescenceRequest(request, chooseMove);

    expect(chooseMove).toHaveBeenCalledTimes(1);
    expect(response.bestMove).toEqual(request.legalMoves[0]);
    expect(verifyCpuCardQuiescenceResponse(request, response)).toBe(true);
  });

  test('forwards serializable placement priors and lookahead weights', () => {
    const request = createCpuCardQuiescenceRequest({
      ...createRequest(),
      priorScoreByCell: { '0,0': 321.5 },
      priorWeight: 62,
      searchWeight: 1.8
    });
    const chooseMove = jest.fn((moves, options) => {
      expect(options.scoreMove(moves[0])).toBe(321.5);
      expect(options.priorWeight).toBe(62);
      expect(options.searchWeight).toBe(1.8);
      return moves[0];
    });

    expect(executeCpuCardQuiescenceRequest(request, chooseMove).bestMove)
      .toEqual(request.legalMoves[0]);
  });

  test('rejects tampered request digests and mismatched responses', () => {
    const request = createRequest();
    expect(() => parseCpuCardQuiescenceRequest({ ...request, level: 5 }))
      .toThrow(CpuCardQuiescenceProtocolError);

    const response = executeCpuCardQuiescenceRequest(request, (moves) => moves[0]);
    expect(verifyCpuCardQuiescenceResponse(request, { ...response, decisionEpoch: 3 })).toBe(false);
    expect(verifyCpuCardQuiescenceResponse(request, {
      ...response,
      bestMove: { row: 3, col: 3, flips: [] }
    })).toBe(false);
  });

  test('rejects unbounded board and move payloads before execution', () => {
    expect(() => createCpuCardQuiescenceRequest({
      ...createRequest(),
      board: Array.from({ length: 65 }, () => [0])
    } as any)).toThrow(CpuCardQuiescenceProtocolError);
  });

  test('selects the same move as the headless core for the same bounded position', () => {
    const board = [
      [0, 0, 0, 0],
      [0, -1, 1, 0],
      [0, 1, -1, 0],
      [0, 0, 0, 0]
    ];
    const legalMoves = [
      { row: 0, col: 1, flips: [{ row: 1, col: 1 }] },
      { row: 1, col: 0, flips: [[1, 1]] },
      { row: 2, col: 3, flips: [{ row: 2, col: 2 }] },
      { row: 3, col: 2, flips: [[2, 2]] }
    ];
    const search = {
      depth: 4,
      maxBranch: 4,
      nodeBudget: 120000,
      maxTimeMs: 10000,
      endgameSolveEmpties: 8,
      endgameDepth: 10,
      endgameNodeBudget: 600000,
      endgameMaxTimeMs: 10000
    };
    const request = createCpuCardQuiescenceRequest({
      requestId: 'card-quiescence:parity',
      decisionEpoch: 3,
      stateVersion: 7,
      turnNumber: 4,
      playerKey: 'black',
      level: 6,
      playerValue: 1,
      board,
      legalMoves,
      search,
      priorScoreByCell: {
        '0,1': 10,
        '1,0': 20,
        '2,3': 30,
        '3,2': 40
      },
      priorWeight: 62,
      searchWeight: 1.8
    });
    const normalizedMoves = legalMoves.map((move) => ({
      row: move.row,
      col: move.col,
      flips: move.flips.map((flip: any) => Array.isArray(flip)
        ? { row: flip[0], col: flip[1] }
        : flip)
    }));

    const expected = CpuPolicyCore.chooseMoveByLookahead(normalizedMoves, {
      board,
      playerValue: 1,
      level: 6,
      ...search,
      scoreMove: (move: any) => ({
        '0,1': 10,
        '1,0': 20,
        '2,3': 30,
        '3,2': 40
      }[`${move.row},${move.col}`] || 0),
      priorWeight: 62,
      searchWeight: 1.8
    });
    const response = executeCpuCardQuiescenceRequest(request, chooseMoveByLookaheadInWorker);

    expect(response.bestMove).toMatchObject({ row: expected.row, col: expected.col });
  });
});
