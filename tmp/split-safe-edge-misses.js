const fs = require('fs');
const path = require('path');
const root = process.cwd();
const Core = require(path.join(root, 'game', 'logic', 'core.js'));
const selfplay = require(path.join(root, 'src', 'engine', 'selfplay-runner.js'));
function parseBoard(boardStr) {
  return String(boardStr || '').split('/').map(r => r.split('').map(ch => ch==='B' ? 1 : ch==='W' ? -1 : 0));
}
function isStandard(board){return Array.isArray(board)&&board.length===8&&board.every(r=>Array.isArray(r)&&r.length===8);}
function isCorner(r,c,board){
  const rows = Array.isArray(board)?board.length:0; const cols = rows && Array.isArray(board[0])?board[0].length:0;
  if (!rows || !cols) return false;
  return (r===0||r===rows-1)&&(c===0||c===cols-1);
}
function isEdge(r,c,board){
  const rows = Array.isArray(board)?board.length:0; const cols = rows && Array.isArray(board[0])?board[0].length:0;
  if (!rows || !cols) return false;
  return r===0||r===rows-1||c===0||c===cols-1;
}
function adjacentCorner(r,c,board){
  const rows = Array.isArray(board)?board.length:0; const cols = rows && Array.isArray(board[0])?board[0].length:0;
  if (!isEdge(r,c,board) || isCorner(r,c,board) || rows<=0 || cols<=0) return null;
  const maxR=rows-1,maxC=cols-1;
  if (r===0 && c===1) return {row:0,col:0};
  if (r===1 && c===0) return {row:0,col:0};
  if (r===0 && c===maxC-1) return {row:0,col:maxC};
  if (r===1 && c===maxC) return {row:0,col:maxC};
  if (r===maxR-1 && c===0) return {row:maxR,col:0};
  if (r===maxR && c===1) return {row:maxR,col:0};
  if (r===maxR-1 && c===maxC) return {row:maxR,col:maxC};
  if (r===maxR && c===maxC-1) return {row:maxR,col:maxC};
  return null;
}
function isSafeEdge(board, move){
  if (!move || !isEdge(move.row, move.col, board) || isCorner(move.row, move.col, board)) return false;
  const ac = adjacentCorner(move.row, move.col, board);
  if (!ac) return true;
  const cornerVal = board[ac.row] && board[ac.row][ac.col];
  return cornerVal !== 0;
}
const result = selfplay.runSelfPlayGames({games:20,baseSeed:1,maxPlies:220,allowCardUsage:true,cardUsageRate:0.35});
const counts = {standard:{available:0,miss:0},nonstandard:{available:0,miss:0}};
for (const rec of result.records||[]) {
  if (!rec || rec.actionType !== 'place' || rec.hasCornerMoveNow) continue;
  const board = parseBoard(rec.board);
  const kind = isStandard(board) ? 'standard' : 'nonstandard';
  const player = rec.player === 'black' ? 1 : -1;
  const moves = Core.getLegalMoves({board, currentPlayer: player}, player, {});
  const safeEdges = moves.filter(m => isSafeEdge(board, m));
  if (!safeEdges.length) continue;
  counts[kind].available += 1;
  const selectedIsSafeEdge = safeEdges.some(m => m.row === rec.row && m.col === rec.col);
  if (!selectedIsSafeEdge) counts[kind].miss += 1;
}
fs.writeFileSync(path.join(root,'tmp','safe-edge-split.json'), JSON.stringify(counts,null,2));
