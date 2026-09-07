const MovementExperiment = require('../scripts/cpu-movement-experiment');
const movementVm = require('vm');
const MovementCards = require('../game/logic/cards');
const MovementCore = require('../game/logic/core');
const MovementPrng = require('../game/schema/prng');

describe('full-effect movement candidate', () => {
    async function run(hidden: string, rejectBaseline = false) {
        const rng = MovementPrng.createPRNG(101);
        const cs = MovementCards.createCardState(rng);
        const gs = MovementCore.createGameState();
        gs.board = Array.from({ length: 8 }, () => Array(8).fill(0));
        gs.board[5][0] = 1; gs.board[5][7] = 1; gs.board[3][0] = -1;
        cs.hands.white = [hidden]; cs.decks.white = [hidden];
        cs.pendingEffectByPlayer.black = { type: 'SUPER_BUOYANCY_WILL', stage: 'selectTarget' };
        const before = JSON.stringify({ cs, gs, rng: rng.getState() });
        const policy = { choosePendingTargetWithPolicyAsync: async () => ({ row: 5, col: 7 }) };
        const evaluate = jest.fn(async (context: any) => context.board.flat().reduce((a: number, b: number) => a + b, 0));
        const root: any = { gameState: gs, require: (name: string) => {
            if (name === 'game/ai/cpu-policy-pending-targets') return policy;
            if (name === 'card-system') return { getCardState: () => cs, getGamePrng: () => rng };
            if (name === 'game/ai/othello-onnx-runtime') return { evaluatePosition: evaluate };
            if (name === 'game/logic/cards' && rejectBaseline) return { ...MovementCards, applySuperBuoyancyWill: (c: any, g: any, p: string, r: number, col: number) => col === 7 ? { applied: false, reason: 'destroy_failed' } : MovementCards.applySuperBuoyancyWill(c, g, p, r, col) };
            return require('../' + name);
        } };
        movementVm.runInNewContext(`(${MovementExperiment.installMovementExperiment.toString()})({color:'black'})`,
            { window: root, performance: { now: () => 0 } });
        const choice = await (policy.choosePendingTargetWithPolicyAsync as any)('black', 'SUPER_BUOYANCY_WILL', MovementCards.getSuperBuoyancyTargets(cs, gs));
        expect(JSON.stringify({ cs, gs, rng: rng.getState() })).toBe(before);
        expect(evaluate.mock.calls.length).toBeLessThanOrEqual(16);
        expect(root.__cardHoldEvents[0].liveUnchanged).toBe(true);
        return { choice, evaluated: root.__cardHoldEvents[0].evaluated, skipped: root.__cardHoldEvents[0].skipped };
    }
    test('uses canonical collision effects without changing live state or depending on hidden cards', async () => {
        const first = await run('hard_01');
        const second = await run('lightning_01');
        expect(first).toEqual(second);
        expect(first.choice).toMatchObject({ row: 5, col: 0 });
        expect(first.evaluated.some((e: any) => e.material === 2)).toBe(true);
    });
    test('does not replace baseline when its effect cannot be resolved', async () => {
        const result = await run('hard_01', true);
        expect(result.choice).toEqual({ row: 5, col: 7 });
        expect(result.evaluated).toEqual([]);
        expect(result.skipped).toBe('baseline_effect_unresolved');
    });
});
