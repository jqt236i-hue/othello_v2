const BoardMovement = require('../scripts/cpu-movement-board-experiment');
const boardMovementVm = require('vm');
const BoardMovementCards = require('../game/logic/cards');
const BoardMovementCore = require('../game/logic/core');
const BoardMovementPrng = require('../game/schema/prng');
require('../game/logic/presentation').setPresentationRuntime({ emitPresentationEvent: require('../game/logic/board_ops').emitPresentationEvent });

test('movement and following placement evaluation supports expanded boards without mutating live state', async () => {
    const rng = BoardMovementPrng.createPRNG(123);
    const cs = BoardMovementCards.createCardState(rng);
    const gs = BoardMovementCore.createGameState();
    gs.boardExpansion = { active: false, side: null, row: null, owner: 0, usedByPlayer: { black: false, white: false }, cells: [
        { side: 'left', row: 1, col: -1, owner: 0 }, { side: 'left', row: 2, col: -1, owner: 0 }, { side: 'left', row: 3, col: -1, owner: 1 }
    ] };
    cs.hasUsedCardThisTurnByPlayer.black = true;
    cs.pendingEffectByPlayer.black = { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' };
    const before = JSON.stringify({ cs, gs, rng: rng.getState() });
    const targets = BoardMovementCards.getSuperBuoyancyTargets(cs, gs);
    const policy = { choosePendingTargetWithPolicyAsync: async () => targets[0] };
    const root: any = { gameState: gs, require: (name: string) => name === 'game/ai/cpu-policy-pending-targets' ? policy : name === 'card-system'
        ? { getCardState: () => cs, getGamePrng: () => rng } : require('../' + name) };
    boardMovementVm.runInNewContext(`(${BoardMovement.installMovementBoardExperiment.toString()})({color:'black'})`,
        { window: root, performance: { now: () => 0 } });
    const selected = await (policy.choosePendingTargetWithPolicyAsync as any)('black', 'SUPER_BUOYANCY_WILL', targets);
    expect(targets).toContainEqual(selected);
    expect(JSON.stringify({ cs, gs, rng: rng.getState() })).toBe(before);
    const event = root.__cardHoldEvents[0];
    expect(event.liveUnchanged).toBe(true);
    expect(event.evaluated.length).toBeGreaterThan(0);
    expect(event.evaluated.length).toBeLessThanOrEqual(16);
    expect(event.evaluated.some((e: any) => e.followingMove)).toBe(true);
});
