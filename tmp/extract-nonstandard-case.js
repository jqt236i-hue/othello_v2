const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = process.cwd();
const Core = require(path.join(root, 'game', 'logic', 'core.js'));
const filename = path.join(root, 'src', 'engine', 'selfplay-runner.js');
let code = fs.readFileSync(filename, 'utf8');
code += `\nmodule.exports.__internal = { createInitialState, applyDecisionWithRetry, normalizeOptions };`;
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(code, filename);
const runner = m.exports;
const internal = runner.__internal;
const options = internal.normalizeOptions({ maxPlies: 220, allowCardUsage: true, cardUsageRate: 0.35 });
const state = internal.createInitialState(1);
const actionCounterRef = { value: 0 };
let fixture = null;
for (let ply = 0; ply < options.maxPlies; ply++) {
  if (Core.isGameOver(state.gameState)) break;
  const playerKey = state.gameState.currentPlayer === 1 ? 'black' : 'white';
  const playerPolicy = runner.getPolicyForPlayer(options, playerKey);
  const execution = internal.applyDecisionWithRetry(state, 0, ply, playerKey, playerPolicy, actionCounterRef);
  if (ply === 56) {
    fixture = {
      playerKey,
      selected: execution.action,
      placementMetrics: execution.decision && execution.decision.placementMetrics,
      gameState: execution.decisionContext.gameState,
      cardState: execution.decisionContext.cardState,
      legalMoves: execution.decision.legalMoves
    };
    break;
  }
  state.cardState = execution.result.cardState;
  state.gameState = execution.result.gameState;
  state.stateVersion = execution.result.nextStateVersion;
}
fs.writeFileSync(path.join(root,'tmp','nonstandard-case-seed1-ply56.json'), JSON.stringify(fixture,null,2));
