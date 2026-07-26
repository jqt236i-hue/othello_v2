import { createCpuPolicyBoardPrimitives } from '../game/ai/cpu-policy-board-primitives';
import {
  createCpuCardQuiescenceRequest,
  executeCpuCardQuiescenceRequest
} from '../game/ai/cpu-card-quiescence';
import { chooseMoveByLookaheadInWorker } from '../game/ai/cpu-policy-lookahead-worker-runtime';
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

function serializeShape(board: any) {
  const meta = SharedBoardUtils.getBoardShapeMeta(board);
  return {
    minRow: meta.minRow,
    maxRow: meta.maxRow,
    minCol: meta.minCol,
    maxCol: meta.maxCol,
    playableKeys: Array.from(meta.playableKeys),
    meteorHoleKeys: Array.from(meta.meteorHoleKeys),
    expansionCells: meta.expansionCells.map((cell: any) => ({ ...cell })),
    expansionOwnerByKey: { ...meta.expansionOwnerByKey },
    standard8x8: meta.standard8x8
  };
}

describe('board runtime parity', () => {
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
    const board = SharedBoardUtils.attachBoardShape(gameState.board, {
      boardConfig: gameState.boardConfig,
      boardExpansion: gameState.boardExpansion,
      cardState
    });
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
    const cpuMoves = normalizeMoves(cpu.getLegalMovesBasic(board, Core.BLACK));
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
      board,
      boardShape: serializeShape(board),
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
});
