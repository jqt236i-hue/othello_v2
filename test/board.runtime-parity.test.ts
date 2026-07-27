import { createCpuPolicyBoardPrimitives } from '../game/ai/cpu-policy-board-primitives';
import {
  createCpuCardQuiescenceRequest,
  executeCpuCardQuiescenceRequest
} from '../game/ai/cpu-card-quiescence';
import {
  chooseMoveByLookaheadInWorker,
  createCpuWorkerBoardUtils
} from '../game/ai/cpu-policy-lookahead-worker-runtime';
import { createSelfplayBoardPrimitives } from '../src/engine/selfplay-board-primitives';

const Core: any = require('../game/logic/core.js');
const CardLogic: any = require('../game/logic/cards.js');
const SharedBoardUtils: any = require('../shared/shared-board-utils.js');

function normalizeMoves(moves: any[]) {
  return moves.map((move) => ({
    row: move.row,
    col: move.col,
    flips: move.flips.map((flip: any) => (
      Array.isArray(flip)
        ? { row: flip[0], col: flip[1] }
        : { row: flip.row, col: flip.col }
    ))
  }));
}

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
    baseKeys: Array.from(topology.baseKeys),
    playableKeys: Array.from(topology.playableKeys),
    meteorHoleKeys: Array.from(topology.holeKeys),
    expansionCells: view.expansionCells.map((cell: any) => ({ ...cell })),
    expansionOwnerByKey,
    standard8x8: SharedBoardUtils.isStandardBoard8x8(context)
  };
}

describe('board runtime parity', () => {
  test('worker gives an expansion cell precedence over a dense matrix void at the same coordinate', () => {
    const workerBoardUtils = createCpuWorkerBoardUtils();
    const matrix = Array.from({ length: 4 }, () => Array(4).fill(Core.EMPTY));
    const context = workerBoardUtils.createBoardContext(matrix, {
      minRow: 0,
      maxRow: 1,
      minCol: 0,
      maxCol: 1,
      baseKeys: ['0,1', '1,0', '1,1'],
      playableKeys: ['0,0', '0,1', '1,0', '1,1'],
      meteorHoleKeys: [],
      expansionCells: [{ side: 'top', row: 0, col: 0, owner: Core.WHITE }],
      expansionOwnerByKey: { '0,0': Core.WHITE },
      standard8x8: false
    });

    expect(workerBoardUtils.getCellValue(context, 0, 0)).toBe(Core.WHITE);
    expect(matrix[0][0]).toBe(Core.EMPTY);

    const before = JSON.stringify({
      board: matrix,
      shape: {
        ...context.shape,
        baseKeys: Array.from(context.shape.baseKeys),
        playableKeys: Array.from(context.shape.playableKeys),
        meteorHoleKeys: Array.from(context.shape.meteorHoleKeys),
      },
    });
    expect(workerBoardUtils.setCellValues(context, [
      { row: 0, col: 0, value: 7 },
    ])).toBe(false);
    expect(workerBoardUtils.setCellValues(context, [
      { row: 0, col: 0, value: Core.BLACK },
      { row: 0, col: 0, value: Core.WHITE },
    ])).toBe(false);
    expect(JSON.stringify({
      board: matrix,
      shape: {
        ...context.shape,
        baseKeys: Array.from(context.shape.baseKeys),
        playableKeys: Array.from(context.shape.playableKeys),
        meteorHoleKeys: Array.from(context.shape.meteorHoleKeys),
      },
    })).toBe(before);

    expect(workerBoardUtils.setCellValues(context, [
      { row: 0, col: 0, value: Core.BLACK },
      { row: 0, col: 1, value: Core.BLACK }
    ])).toBe(true);
    expect(workerBoardUtils.getCellValue(context, 0, 0)).toBe(Core.BLACK);
    expect(context.shape.expansionCells[0].owner).toBe(Core.BLACK);
    expect(matrix[0][0]).toBe(Core.EMPTY);
    expect(matrix[0][1]).toBe(Core.EMPTY);
    expect(context.board[0][1]).toBe(Core.BLACK);
  });

  test('root and worker preserve a circle-envelope expansion through DTO legal search and apply', () => {
    const gameState = Core.createGameState({
      rows: 10,
      cols: 10,
      shape: 'circle'
    });
    gameState.board = Array.from({ length: 10 }, () => Array(10).fill(Core.EMPTY));
    gameState.board[0][3] = Core.BLACK;
    gameState.boardExpansion = {
      cells: [
        { side: 'top', row: 0, col: 1, owner: Core.EMPTY },
        { side: 'top', row: 0, col: 2, owner: Core.WHITE }
      ],
      usedByPlayer: { black: true, white: false }
    };
    const cardState = { markers: [] };
    const rootContext = SharedBoardUtils.createBoardContext(gameState, cardState);
    const rootMove = Core.getLegalMoves(gameState, Core.BLACK, { cardState })
      .find((move: any) => move.row === 0 && move.col === 1);

    expect(rootMove).toEqual({
      row: 0,
      col: 1,
      flips: [[0, 2]]
    });
    expect(gameState.board[0][2]).toBe(Core.EMPTY);

    const boardShape = JSON.parse(JSON.stringify(serializeShape(rootContext)));
    const board = JSON.parse(JSON.stringify(gameState.board));
    const workerBoardUtils = createCpuWorkerBoardUtils();
    const workerContext = workerBoardUtils.createBoardContext(board, boardShape);
    const workerMoves = normalizeMoves(
      workerBoardUtils.getLegalMovesBasic(workerContext, Core.BLACK)
    );

    expect(workerMoves).toContainEqual(normalizeMoves([rootMove])[0]);
    const workerCpu = createCpuPolicyBoardPrimitives({
      SharedBoardUtils: workerBoardUtils
    });
    const after = workerCpu.applyMoveToBoard(
      workerContext,
      rootMove,
      Core.BLACK
    ) as any;
    expect(workerBoardUtils.getCellValue(after, 0, 1)).toBe(Core.BLACK);
    expect(workerBoardUtils.getCellValue(after, 0, 2)).toBe(Core.BLACK);
    expect(after.board[0][2]).toBe(Core.EMPTY);

    expect(chooseMoveByLookaheadInWorker([rootMove], {
      board,
      boardShape,
      playerValue: Core.BLACK,
      level: 6,
      depth: 1,
      maxBranch: 2,
      nodeBudget: 100,
      maxTimeMs: 1000,
      endgameSolveEmpties: 0,
      endgameDepth: 1,
      endgameNodeBudget: 100,
      endgameMaxTimeMs: 1000
    })).toMatchObject({ row: 0, col: 1 });
  });

  test('root, CPU, selfplay, and worker agree on multi-ring expansion with a hole', () => {
    const gameState = Core.createGameState({ rows: 4, cols: 4, shape: 'rectangle' });
    gameState.board = Array.from({ length: 4 }, () => Array(4).fill(Core.EMPTY));
    gameState.board[1][3] = Core.BLACK;
    gameState.boardExpansion = {
      cells: [
        { side: 'right', row: 1, col: 4, owner: Core.WHITE },
        { side: 'right', row: 1, col: 5, owner: Core.EMPTY }
      ],
      usedByPlayer: { black: true, white: false }
    };
    const cardState = CardLogic.createCardState({ random: () => 0, shuffle: (items: any[]) => items });
    cardState.markers.push({
      id: 'hole',
      markerId: 'hole',
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'METEOR_HOLE' }
    });

    const rootMoves = normalizeMoves(Core.getLegalMoves(
      gameState,
      Core.BLACK,
      { cardState }
    ));
    const boardContext = SharedBoardUtils.createBoardContext(gameState, cardState);
    const denseFallback = {
      getFlipsBasic: () => {
        throw new Error('dense CPU fallback must not run');
      },
      getLegalMovesBasic: () => {
        throw new Error('dense CPU fallback must not run');
      }
    };
    const cpu = createCpuPolicyBoardPrimitives({
      SharedBoardUtils,
      OthelloCore: denseFallback
    });
    const selfplay = createSelfplayBoardPrimitives({
      Core,
      CardLogic,
      SharedBoardUtils,
      OthelloCore: denseFallback
    });
    const cpuMoves = normalizeMoves(cpu.getLegalMovesBasic(boardContext, Core.BLACK));
    const selfplayBoard = selfplay.getSelfplayBoard(gameState, cardState);
    const selfplayMoves = normalizeMoves(selfplay.getLegalMovesBasic(selfplayBoard, Core.BLACK));

    expect(rootMoves).toEqual([{
      row: 1,
      col: 5,
      flips: [{ row: 1, col: 4 }]
    }]);
    expect(cpuMoves).toEqual(rootMoves);
    expect(selfplayMoves).toEqual(rootMoves);

    const request = createCpuCardQuiescenceRequest({
      requestId: 'board-runtime-parity',
      decisionEpoch: 1,
      stateVersion: 1,
      turnNumber: 1,
      playerKey: 'black',
      level: 6,
      playerValue: Core.BLACK,
      board: gameState.board,
      boardShape: serializeShape(boardContext),
      legalMoves: rootMoves,
      search: {
        depth: 2,
        maxBranch: 4,
        nodeBudget: 10000,
        maxTimeMs: 10000,
        endgameSolveEmpties: 4,
        endgameDepth: 4,
        endgameNodeBudget: 10000,
        endgameMaxTimeMs: 10000
      }
    });
    const roundTripped = JSON.parse(JSON.stringify(request));
    const workerResponse = executeCpuCardQuiescenceRequest(
      roundTripped,
      chooseMoveByLookaheadInWorker
    );

    expect(workerResponse.bestMove).toEqual(rootMoves[0]);
  });

  test('root and worker both exclude an expansion cell replaced by a meteor hole', () => {
    const gameState = Core.createGameState({ rows: 4, cols: 4, shape: 'rectangle' });
    gameState.board = Array.from({ length: 4 }, () => Array(4).fill(Core.EMPTY));
    gameState.boardExpansion = {
      cells: [
        { side: 'right', row: 1, col: 4, owner: Core.EMPTY },
        { side: 'right', row: 1, col: 5, owner: Core.WHITE }
      ],
      usedByPlayer: { black: true, white: false }
    };
    const cardState = {
      markers: [{
        id: 'expansion-hole',
        markerId: 'expansion-hole',
        kind: 'specialStone',
        row: 1,
        col: 4,
        owner: 'black',
        data: { type: 'METEOR_HOLE' }
      }]
    };
    const rootContext = SharedBoardUtils.createBoardContext(gameState, cardState);
    const boardShape = serializeShape(rootContext);

    expect(boardShape.meteorHoleKeys).toContain('1,4');
    expect(boardShape.playableKeys).not.toContain('1,4');
    expect(boardShape.expansionCells).toContainEqual(
      expect.objectContaining({ row: 1, col: 4 })
    );

    const workerBoardUtils = createCpuWorkerBoardUtils();
    const workerContext = workerBoardUtils.createBoardContext(
      JSON.parse(JSON.stringify(gameState.board)),
      JSON.parse(JSON.stringify(boardShape))
    );

    expect(workerBoardUtils.getCellValue(workerContext, 1, 4)).toBeNull();
    expect(workerBoardUtils.collectBoardCoordinates(workerContext))
      .not.toContainEqual({ row: 1, col: 4 });
    expect(workerContext.shape.expansionCells)
      .toContainEqual(expect.objectContaining({ row: 1, col: 4 }));
    expect(workerBoardUtils.getCellValue(workerContext, 1, 5)).toBe(Core.WHITE);
  });
});
