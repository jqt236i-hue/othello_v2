const TargetPlacement = require('../scripts/cpu-target-placement-experiment');
const targetPlacementVm = require('vm');
const TargetPlacementCards = require('../game/logic/cards');
const TargetPlacementCore = require('../game/logic/core');
const TargetPlacementPrng = require('../game/schema/prng');
require('../game/logic/presentation').setPresentationRuntime({ emitPresentationEvent: require('../game/logic/board_ops').emitPresentationEvent });

test('movement and following placement evaluation supports expanded boards without mutating live state', async () => {
    const rng = TargetPlacementPrng.createPRNG(123);
    const cs = TargetPlacementCards.createCardState(rng);
    const gs = TargetPlacementCore.createGameState();
    gs.boardExpansion = { active: false, side: null, row: null, owner: 0, usedByPlayer: { black: false, white: false }, cells: [
        { side: 'left', row: 1, col: -1, owner: 0 }, { side: 'left', row: 2, col: -1, owner: 0 }, { side: 'left', row: 3, col: -1, owner: 1 }
    ] };
    cs.hasUsedCardThisTurnByPlayer.black = true;
    cs.pendingEffectByPlayer.black = { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' };
    const before = JSON.stringify({ cs, gs, rng: rng.getState() });
    const targets = TargetPlacementCards.getSuperBuoyancyTargets(cs, gs);
    const policy = { choosePendingTargetWithPolicyAsync: async () => targets[0] };
    const root: any = { gameState: gs, cardState: cs, require: (name: string) => name === 'game/ai/cpu-policy-pending-targets' ? policy : name === 'card-system'
        ? { getCardState: () => { throw new Error('Stale compatibility state must not be read'); }, getGamePrng: () => rng } : require('../' + name) };
    targetPlacementVm.runInNewContext(`(${TargetPlacement.installTargetPlacementExperiment.toString()})({color:'black'})`,
        { window: root, performance: { now: () => 0 } });
    const selected = await (policy.choosePendingTargetWithPolicyAsync as any)('black', 'SUPER_BUOYANCY_WILL', targets);
    expect(targets).toContainEqual(selected);
    expect(JSON.stringify({ cs, gs, rng: rng.getState() })).toBe(before);
    const event = root.__cardHoldEvents[0];
    expect(event.liveUnchanged).toBe(true);
    expect(event.evaluated.length).toBeGreaterThan(0);
    expect(event.evaluated.length).toBeLessThanOrEqual(4);
    expect(event.evaluated.some((e: any) => e.followingMove)).toBe(true);
    expect(event.steps).toBeLessThanOrEqual(48);
    cs.hands.white = ['gold_stone', 'silver_stone'];
    rng.random();
    const second = await (policy.choosePendingTargetWithPolicyAsync as any)('black', 'SUPER_BUOYANCY_WILL', targets);
    expect(second).toEqual(selected);
    expect(root.__cardHoldEvents[1].evaluated).toEqual(event.evaluated);
    expect(root.__cardHoldEvents[1].liveUnchanged).toBe(true);
});
