import {
  CpuCardQuiescenceProtocolError,
  createCpuCardQuiescenceRequest,
  executeCpuCardQuiescenceRequest,
  parseCpuCardQuiescenceRequest,
  verifyCpuCardQuiescenceResponse
} from '../game/ai/cpu-card-quiescence';
import { chooseMoveByLookaheadInWorker } from '../game/ai/cpu-policy-lookahead-worker-runtime';

const CpuPolicyCore: any = require('../game/ai/cpu-policy-core');
const SharedBoardUtils: any = require('../shared/shared-board-utils');

function serializeShape(context: any) {
  const view = SharedBoardUtils.createBoardView(context.gameState, {
    cardState: context.cardState,
    strict: false
  });
  const topology = view.topology;
  const expansionOwnerByKey: Record<string, number> = {};
  for (const cell of view.expansionCells) {
    expansionOwnerByKey[`${cell.row},${cell.col}`] = cell.owner;
  }
  return {
    minRow: topology.contentBounds.minRow,
    maxRow: topology.contentBounds.maxRow,
    minCol: topology.contentBounds.minCol,
    maxCol: topology.contentBounds.maxCol,
    playableKeys: Array.from(topology.playableKeys),
    meteorHoleKeys: Array.from(topology.holeKeys),
    expansionCells: view.expansionCells.map((cell: any) => ({ ...cell })),
    expansionOwnerByKey,
    standard8x8: SharedBoardUtils.isStandardBoard8x8(context)
  };
}

function createRequest() {
  const board = Array.from({ length: 4 }, () => Array(4).fill(0));
  const boardShape = {
    minRow: 0,
    maxRow: 3,
    minCol: -1,
    maxCol: 3,
    playableKeys: ['0,-1', '0,0', '0,1'],
    meteorHoleKeys: ['0,1'],
    expansionCells: [{ side: 'left', row: 0, col: -1, owner: 0 }],
    expansionOwnerByKey: { '0,-1': 0 },
    standard8x8: false
  };
  return createCpuCardQuiescenceRequest({
    requestId: 'card-quiescence:1:2',
    decisionEpoch: 2,
    stateVersion: 'local-turn:1',
    turnNumber: 1,
    playerKey: 'white',
    level: 6,
    playerValue: -1,
    board,
    boardShape,
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
  test('projects an explicit shape DTO and executes the pure lookahead on a detached board', () => {
    const request = createRequest();
    const chooseMove = jest.fn((moves, options) => {
      expect(options.board).not.toBe(request.board);
      expect(Array.isArray(options.board)).toBe(true);
      const shape = options.boardShape;
      expect(shape.playableKeys).toEqual(['0,-1', '0,0', '0,1']);
      expect(shape.expansionCells).toEqual([{ side: 'left', row: 0, col: -1, owner: 0 }]);
      expect(shape.expansionOwnerByKey).toEqual({ '0,-1': 0 });
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

  test('rejects invalid player and expansion owner encodings', () => {
    expect(() => createCpuCardQuiescenceRequest({
      ...createRequest(),
      playerValue: 0
    })).toThrow(CpuCardQuiescenceProtocolError);

    const request = createRequest();
    expect(() => createCpuCardQuiescenceRequest({
      ...request,
      board: request.board.map((row, rowIndex) => (
        rowIndex === 0 ? [2, ...row.slice(1)] : row.slice()
      ))
    })).toThrow(CpuCardQuiescenceProtocolError);

    expect(() => createCpuCardQuiescenceRequest({
      ...request,
      boardShape: {
        ...request.boardShape,
        expansionCells: [{ side: 'left', row: 0, col: -1, owner: 2 }],
        expansionOwnerByKey: { '0,-1': 2 }
      }
    })).toThrow(CpuCardQuiescenceProtocolError);
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
      boardShape: serializeShape(SharedBoardUtils.createBoardContext({
        board,
        boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
        boardExpansion: { cells: [] }
      }, { markers: [] })),
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

  test('keeps full edge evaluation parity with the headless lookahead', () => {
    const board = [
      [-1, 1, 1, -1],
      [0, -1, -1, 1],
      [0, 1, 0, -1],
      [-1, -1, -1, 1]
    ];
    const legalMoves = [
      { row: 1, col: 0, flips: [{ row: 1, col: 1 }, { row: 1, col: 2 }] },
      { row: 2, col: 0, flips: [{ row: 1, col: 1 }] },
      { row: 2, col: 2, flips: [{ row: 1, col: 2 }] }
    ];
    const search = {
      depth: 4,
      maxBranch: 6,
      nodeBudget: 1_000_000,
      maxTimeMs: 10_000,
      endgameSolveEmpties: 3,
      endgameDepth: 6,
      endgameNodeBudget: 1_000_000,
      endgameMaxTimeMs: 10_000
    };
    const expected = CpuPolicyCore.chooseMoveByLookahead(legalMoves, {
      board,
      playerValue: 1,
      level: 6,
      ...search
    });
    const request = createCpuCardQuiescenceRequest({
      requestId: 'card-quiescence:edge-parity',
      decisionEpoch: 5,
      stateVersion: 8,
      turnNumber: 6,
      playerKey: 'black',
      level: 6,
      playerValue: 1,
      board,
      boardShape: serializeShape(SharedBoardUtils.createBoardContext({
        board,
        boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
        boardExpansion: { cells: [] }
      }, { markers: [] })),
      legalMoves,
      search
    });

    expect(expected).toMatchObject({ row: 2, col: 2 });
    expect(executeCpuCardQuiescenceRequest(request, chooseMoveByLookaheadInWorker).bestMove)
      .toMatchObject({ row: expected.row, col: expected.col });
  });

  test('keeps irregular-board topology parity with the headless lookahead', () => {
    const board = [
      [-1, 1, 0, 1, 1],
      [1, 1, 1, -1, -1],
      [1, 1, -1, 1, -1],
      [0, -1, 0, 1, 0],
      [0, 1, 0, 1, -1]
    ];
    const gameState = {
      board,
      boardConfig: { rows: 5, cols: 5, shape: 'rectangle' },
      boardExpansion: { cells: [] }
    };
    const context = SharedBoardUtils.createBoardContext(gameState, {
      markers: [{
        kind: 'specialStone',
        row: 0,
        col: 0,
        data: { type: 'METEOR_HOLE' }
      }]
    });
    const boardShape = serializeShape(context);
    const legalMoves = [
      { row: 3, col: 2, flips: [{ row: 2, col: 2 }] },
      { row: 4, col: 2, flips: [{ row: 3, col: 1 }] }
    ];
    const search = {
      depth: 4,
      maxBranch: 6,
      nodeBudget: 1_000_000,
      maxTimeMs: 10_000,
      endgameSolveEmpties: 3,
      endgameDepth: 6,
      endgameNodeBudget: 1_000_000,
      endgameMaxTimeMs: 10_000
    };
    const expected = CpuPolicyCore.chooseMoveByLookahead(legalMoves, {
      board: context,
      playerValue: 1,
      level: 6,
      ...search
    });
    const request = createCpuCardQuiescenceRequest({
      requestId: 'card-quiescence:irregular-parity',
      decisionEpoch: 6,
      stateVersion: 9,
      turnNumber: 7,
      playerKey: 'black',
      level: 6,
      playerValue: 1,
      board,
      boardShape,
      legalMoves,
      search
    });

    expect(executeCpuCardQuiescenceRequest(request, chooseMoveByLookaheadInWorker).bestMove)
      .toMatchObject({ row: expected.row, col: expected.col });
  });

  test('keeps multi-ring expansion and hole topology through JSON and structuredClone', () => {
    const board = Array.from({ length: 4 }, () => Array(4).fill(0));
    board[1][3] = 1;
    const boardExpansion = {
      cells: [
        { side: 'right', row: 1, col: 4, owner: -1 },
        { side: 'right', row: 1, col: 5, owner: 0 }
      ]
    };
    const cardState = {
      markers: [{
        kind: 'specialStone',
        row: 0,
        col: 0,
        data: { type: 'METEOR_HOLE' }
      }]
    };
    const gameState = {
      board,
      boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
      boardExpansion
    };
    const context = SharedBoardUtils.createBoardContext(gameState, cardState);
    const legalMoves = SharedBoardUtils.getLegalMovesBasic(context, 1);
    const search = {
      depth: 2,
      maxBranch: 4,
      nodeBudget: 10000,
      maxTimeMs: 10000,
      endgameSolveEmpties: 4,
      endgameDepth: 4,
      endgameNodeBudget: 10000,
      endgameMaxTimeMs: 10000
    };
    const request = createCpuCardQuiescenceRequest({
      requestId: 'card-quiescence:expansion-hole-roundtrip',
      decisionEpoch: 7,
      stateVersion: 10,
      turnNumber: 8,
      playerKey: 'black',
      level: 6,
      playerValue: 1,
      board,
      boardShape: serializeShape(context),
      legalMoves,
      search
    });
    const jsonRequest = JSON.parse(JSON.stringify(request));
    const clonedRequest = typeof structuredClone === 'function'
      ? structuredClone(jsonRequest)
      : jsonRequest;

    expect(legalMoves).toContainEqual({
      row: 1,
      col: 5,
      flips: [{ row: 1, col: 4 }]
    });
    expect(clonedRequest.boardShape).toEqual(request.boardShape);
    expect(executeCpuCardQuiescenceRequest(clonedRequest, chooseMoveByLookaheadInWorker).bestMove)
      .toMatchObject({ row: 1, col: 5 });
  });
});
