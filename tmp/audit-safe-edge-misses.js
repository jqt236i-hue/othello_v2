const fs = require('fs');
const path = require('path');
const root = process.cwd();
const Core = require(path.join(root, 'game', 'logic', 'core.js'));
function parseBoard(boardStr) {
  return String(boardStr || '').split('/').map(r => r.split('').map(ch => ch==='B' ? 1 : ch==='W' ? -1 : 0));
}
function isCorner(r,c){return (r===0||r===7)&&(c===0||c===7);}
function isEdge(r,c){return r===0||r===7||c===0||c===7;}
function adjacentCorner(r,c){
  if (!isEdge(r,c) || isCorner(r,c)) return null;
  if (r===0 && c===1) return {row:0,col:0};
  if (r===1 && c===0) return {row:0,col:0};
  if (r===0 && c===6) return {row:0,col:7};
  if (r===1 && c===7) return {row:0,col:7};
  if (r===6 && c===0) return {row:7,col:0};
  if (r===7 && c===1) return {row:7,col:0};
  if (r===6 && c===7) return {row:7,col:7};
  if (r===7 && c===6) return {row:7,col:7};
  return null;
}
function isSafeEdge(board, move){
  if (!move || !isEdge(move.row, move.col) || isCorner(move.row, move.col)) return false;
  const ac = adjacentCorner(move.row, move.col);
  if (!ac) return true;
  const cornerVal = board[ac.row] && board[ac.row][ac.col];
  return cornerVal !== 0;
}
const selfplay = require(path.join(root, 'src', 'engine', 'selfplay-runner.js'));
const result = selfplay.runSelfPlayGames({games:20,baseSeed:1,maxPlies:220,allowCardUsage:true,cardUsageRate:0.35});
const records = Array.isArray(result.records) ? result.records : [];
let safeEdgeAvailableCount = 0;
let safeEdgeMissCount = 0;
const worst = [];
for (const rec of records) {
  if (!rec || rec.actionType !== 'place' || rec.hasCornerMoveNow) continue;
  const board = parseBoard(rec.board);
  const player = rec.player === 'black' ? 1 : -1;
  const moves = Core.getLegalMoves({board, currentPlayer: player}, player, {});
  const safeEdges = moves.filter(m => isSafeEdge(board, m));
  if (safeEdges.length <= 0) continue;
  safeEdgeAvailableCount += 1;
  const selectedIsSafeEdge = safeEdges.some(m => m.row === rec.row && m.col === rec.col);
  if (!selectedIsSafeEdge) {
    safeEdgeMissCount += 1;
    worst.push({seed:rec.seed,ply:rec.ply,row:rec.row,col:rec.col,future:rec.futureDiscDelta3Ply,safeEdges:safeEdges.map(m=>({row:m.row,col:m.col,flips:Array.isArray(m.flips)?m.flips.length:0}))});
  }
}
worst.sort((a,b)=>(a.future??0)-(b.future??0));
const out = {safeEdgeAvailableCount,safeEdgeMissCount,worst:worst.slice(0,20)};
fs.writeFileSync(path.join(root,'tmp','safe-edge-audit.json'), JSON.stringify(out,null,2));
