const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = process.cwd();
const fixture = JSON.parse(fs.readFileSync(path.join(root,'tmp','nonstandard-case-seed1-ply56.json'),'utf8'));
const filename = path.join(root, 'src', 'engine', 'selfplay-runner.js');
let code = fs.readFileSync(filename, 'utf8');
code += `\nmodule.exports.__internal = { resolveForcedPlacementCandidates, getShapeAwareBoard, isSafeEdgePlacementCandidate };`;
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(code, filename);
const { resolveForcedPlacementCandidates, getShapeAwareBoard, isSafeEdgePlacementCandidate } = m.exports.__internal;
const shapedBoard = getShapeAwareBoard(fixture.gameState.board, fixture.gameState, fixture.cardState);
const info = {
  shapedSafe: fixture.legalMoves.map(m => ({ row:m.row, col:m.col, safe:isSafeEdgePlacementCandidate(m, shapedBoard) })),
  rawForced: resolveForcedPlacementCandidates(fixture.legalMoves, {}, fixture.gameState.board),
  shapedForced: resolveForcedPlacementCandidates(fixture.legalMoves, {}, shapedBoard)
};
console.log(JSON.stringify(info,null,2));
