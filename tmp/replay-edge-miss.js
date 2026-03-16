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
const options = internal.normalizeOptions({ maxPlies: 220, allowCardUsage: true, cardUsageRate: 0.35 });
const state = internal.createInitialState(15);
const actionCounterRef = { value: 0 };
let snapshot = null;
for (let ply = 0; ply < options.maxPlies; ply++) {
  if (Core.isGameOver(state.gameState)) break;
  const playerKey = state.gameState.currentPlayer === 1 ? 'black' : 'white';
  const playerPolicy = runner.getPolicyForPlayer(options, playerKey);
  const execution = internal.applyDecisionWithRetry(state, 14, ply, playerKey, playerPolicy, actionCounterRef);
  if (ply === 40) {
    const decisionContext = execution.decisionContext || { gameState: state.gameState, cardState: state.cardState, playerKey };
    const gameState = decisionContext.gameState;
    const cardState = decisionContext.cardState;
    const legalMoves = execution.decision.legalMoves || Core.getLegalMoves(gameState, gameState.currentPlayer, {});
    const usableCardIds = internal.getDirectUsableCardIds(cardState, gameState, playerKey);
    const planState = internal.buildCornerPlanState(gameState, cardState, playerKey, legalMoves, usableCardIds);
    const movePlanContext = internal.buildMovePlanContext(gameState, cardState, playerKey, legalMoves, usableCardIds);
    const rng = { random: () => 0 };
    const scoreContext = Object.assign({}, decisionContext, { planState, movePlanContext });
    const scored = legalMoves.map((move) => ({
      row: move.row,
      col: move.col,
      isEdge: move.row === 0 || move.row === 7 || move.col === 0 || move.col === 7,
      flips: Array.isArray(move.flips) ? move.flips.length : 0,
      planScore: Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(move, movePlanContext) || 0),
      heuristic: Number(internal.scoreMove(move, rng, scoreContext) || 0),
      tactical: Number(internal.scoreTacticalMove(move, scoreContext, options) || 0),
      bonus: (cardState && cardState.boardBonusByCell && cardState.boardBonusByCell[`${move.row},${move.col}`]) || 0
    })).sort((a,b)=>b.planScore-a.planScore || a.row-b.row || a.col-b.col);
    snapshot = {
      selected: execution.action,
      playerKey,
      board: runner.encodeBoard(gameState.board),
      hand: cardState.hands[playerKey],
      usableCardIds,
      charge: cardState.charge[playerKey],
      planState,
      movePlanContext,
      scored
    };
    break;
  }
  state.cardState = execution.result.cardState;
  state.gameState = execution.result.gameState;
  state.stateVersion = execution.result.nextStateVersion;
}
console.log(JSON.stringify(snapshot, null, 2));
