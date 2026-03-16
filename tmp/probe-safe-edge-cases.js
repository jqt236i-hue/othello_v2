const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = process.cwd();
const Core = require(path.join(root, 'game', 'logic', 'core.js'));
const filename = path.join(root, 'src', 'engine', 'selfplay-runner.js');
let code = fs.readFileSync(filename, 'utf8');
code += `\nmodule.exports.__internal = { createInitialState, applyDecisionWithRetry, normalizeOptions, buildMovePlanContext, buildCornerPlanState, getDirectUsableCardIds, scoreMove, scoreTacticalMove };`;
const m = new Module(filename, module);
m.filename = filename;
m.paths = Module._nodeModulePaths(path.dirname(filename));
m._compile(code, filename);
const runner = m.exports;
const internal = runner.__internal;
const CpuPolicyCore = require(path.join(root, 'game', 'ai', 'cpu-policy-core.js'));
const cases = [{seed:1, ply:56, gameIndex:0}, {seed:12, ply:63, gameIndex:11}, {seed:3, ply:53, gameIndex:2}];
const options = internal.normalizeOptions({ maxPlies: 220, allowCardUsage: true, cardUsageRate: 0.35 });
const out = [];
for (const target of cases) {
  const state = internal.createInitialState(target.seed);
  const actionCounterRef = { value: 0 };
  let snap = null;
  for (let ply = 0; ply < options.maxPlies; ply++) {
    if (Core.isGameOver(state.gameState)) break;
    const playerKey = state.gameState.currentPlayer === 1 ? 'black' : 'white';
    const playerPolicy = runner.getPolicyForPlayer(options, playerKey);
    const execution = internal.applyDecisionWithRetry(state, target.gameIndex, ply, playerKey, playerPolicy, actionCounterRef);
    if (ply === target.ply) {
      const decisionContext = execution.decisionContext || { gameState: state.gameState, cardState: state.cardState, playerKey };
      const gameState = decisionContext.gameState;
      const cardState = decisionContext.cardState;
      const legalMoves = execution.decision.legalMoves || Core.getLegalMoves(gameState, gameState.currentPlayer, {});
      const usableCardIds = internal.getDirectUsableCardIds(cardState, gameState, playerKey);
      const planState = internal.buildCornerPlanState(gameState, cardState, playerKey, legalMoves, usableCardIds);
      const movePlanContext = internal.buildMovePlanContext(gameState, cardState, playerKey, legalMoves, usableCardIds);
      const scoreContext = Object.assign({}, decisionContext, { planState, movePlanContext });
      const scored = legalMoves.map((move) => ({
        row: move.row,
        col: move.col,
        planScore: Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, movePlanContext) || 0),
        tactical: Number(internal.scoreTacticalMove(move, scoreContext, options) || 0)
      })).sort((a,b)=>b.planScore-a.planScore || a.row-b.row || a.col-b.col);
      snap = { target, playerKey, selected: execution.action, board: runner.encodeBoard(gameState.board), planState, scored };
      break;
    }
    state.cardState = execution.result.cardState;
    state.gameState = execution.result.gameState;
    state.stateVersion = execution.result.nextStateVersion;
  }
  out.push(snap);
}
fs.writeFileSync(path.join(root,'tmp','safe-edge-probes.json'), JSON.stringify(out,null,2));
