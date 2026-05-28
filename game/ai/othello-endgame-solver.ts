"use strict";

function terminalDiscDiff(board: any, playerKey: any, helpers: any): number {
  const discs = helpers.countDiscsForPlayer(board, playerKey);
  return discs.own - discs.opp;
}

function boardKeyForExact(board: any, playerKey: any, passCount: number): string {
  const rows = Array.isArray(board)
    ? board.map((row: any) => Array.isArray(row) ? row.join(',') : '').join(';')
    : '';
  return `${playerKey}|${passCount}|${rows}`;
}

function solveExactValue(board: any, playerKey: any, passCount: number, state: any, helpers: any): number {
  state.nodes += 1;
  if (state.nodes > state.nodeBudget || Date.now() > state.deadline) {
    state.aborted = true;
    return 0;
  }
  const key = boardKeyForExact(board, playerKey, passCount);
  if (state.cache.has(key)) return state.cache.get(key);
  const legalMoves = helpers.collectLegalMovesForPlayer(board, playerKey);
  if (passCount >= 2 || helpers.countEmptyCells(board) <= 0) {
    const terminal = terminalDiscDiff(board, playerKey, helpers);
    state.cache.set(key, terminal);
    return terminal;
  }
  if (legalMoves.length <= 0) {
    const passed = -solveExactValue(board, helpers.oppositePlayerKey(playerKey), passCount + 1, state, helpers);
    state.cache.set(key, passed);
    return passed;
  }
  let best = Number.NEGATIVE_INFINITY;
  const ordered = legalMoves
    .slice()
    .sort((left: any, right: any) => helpers.scoreMoveSafety(board, right, playerKey) - helpers.scoreMoveSafety(board, left, playerKey));
  for (const move of ordered) {
    const nextBoard = helpers.applyMoveForRerank(board, move, playerKey);
    if (!nextBoard) continue;
    const score = -solveExactValue(nextBoard, helpers.oppositePlayerKey(playerKey), 0, state, helpers);
    if (score > best) best = score;
    if (state.aborted) break;
  }
  const value = Number.isFinite(best) ? best : terminalDiscDiff(board, playerKey, helpers);
  state.cache.set(key, value);
  return value;
}

function chooseExactEndgameMove(candidates: any[], context: any, config: any, helpers: any) {
  if (!context || !Array.isArray(context.board)) return null;
  const empties = helpers.countEmptyCells(context.board);
  if (empties > config.exactSolveEmpties) return null;
  const playerKey = context.playerKey === 'black' ? 'black' : 'white';
  const state = {
    nodes: 0,
    nodeBudget: config.exactSolveNodeBudget,
    deadline: Date.now() + config.exactSolveMaxMs,
    aborted: false,
    cache: new Map()
  };
  let best: any = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  const ordered = candidates
    .slice()
    .sort((left, right) => helpers.scoreMoveSafety(context.board, right, playerKey) - helpers.scoreMoveSafety(context.board, left, playerKey));
  for (const move of ordered) {
    const nextBoard = helpers.applyMoveForRerank(context.board, move, playerKey);
    if (!nextBoard) continue;
    const score = -solveExactValue(nextBoard, helpers.oppositePlayerKey(playerKey), 0, state, helpers);
    if (state.aborted) return null;
    if (score > bestScore || (score === bestScore && best && (move.row < best.row || (move.row === best.row && move.col < best.col)))) {
      best = move;
      bestScore = score;
    }
  }
  return best;
}

export {
  chooseExactEndgameMove
};
