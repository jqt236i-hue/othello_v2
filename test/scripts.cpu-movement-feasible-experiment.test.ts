const FeasibleExperiment = require('../scripts/cpu-movement-feasible-experiment');
const feasibleVm = require('vm');
const FeasibleCards = require('../game/logic/cards');
const FeasibleCore = require('../game/logic/core');
const FeasiblePrng = require('../game/schema/prng');
const FeasiblePipeline = require('../game/turn/turn_pipeline');
require('../game/logic/presentation').setPresentationRuntime({ emitPresentationEvent: require('../game/logic/board_ops').emitPresentationEvent });

test('avoids repeated super gravity failure against an inviolable stone while preserving live state', async () => {
    const rng = FeasiblePrng.createPRNG(111);
    const cs = FeasibleCards.createCardState(rng);
    const gs = FeasibleCore.createGameState();
    gs.board[2][0] = -1; gs.board[5][0] = 1; gs.board[2][7] = -1;
    cs.markers.push({ id: 1, markerId: '1', row: 5, col: 0, kind: 'manifestStone', owner: 'black', createdSeq: 1,
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 1, inviolable: true } });
    cs.hasUsedCardThisTurnByPlayer.black = true;
    cs.pendingEffectByPlayer.black = { type: 'SUPER_GRAVITY_WILL', stage: 'selectTarget' };
    const clone = (v: any) => JSON.parse(JSON.stringify(v));
    const apply = (target: any) => FeasiblePipeline.applyTurnSafe(clone(cs), clone(gs), 'black', { type: 'place', superGravityTarget: target }, FeasiblePrng.createPRNG(19074000), { skipTurnStart: true });
    const baseline = { row: 2, col: 0 };
    expect(apply(baseline).cardState.pendingEffectByPlayer.black).not.toBeNull();
    const policy = { choosePendingTargetWithPolicyAsync: async (_p: any, _t: any, targets: any[]) => targets.find(t => t.row === 2 && t.col === 0) || targets[0] };
    const root: any = { gameState: gs, require: (name: string) => name === 'game/ai/cpu-policy-pending-targets' ? policy : name === 'card-system'
        ? { getCardState: () => cs, getGamePrng: () => rng } : require('../' + name) };
    const before = JSON.stringify({ cs, gs, rng: rng.getState() });
    feasibleVm.runInNewContext(`(${FeasibleExperiment.installMovementFeasibleExperiment.toString()})({color:'black'})`,
        { window: root, performance: { now: () => 0 } });
    const result = await policy.choosePendingTargetWithPolicyAsync('black', 'SUPER_GRAVITY_WILL', FeasibleCards.getSuperGravityTargets(cs, gs));
    expect(result).not.toEqual(baseline);
    expect(apply(result).cardState.pendingEffectByPlayer.black).toBeNull();
    expect(JSON.stringify({ cs, gs, rng: rng.getState() })).toBe(before);
    expect(root.__cardHoldEvents[0].changed).toBe(true);
    expect(root.__cardHoldEvents[0].evaluated.length).toBeLessThanOrEqual(64);
});
