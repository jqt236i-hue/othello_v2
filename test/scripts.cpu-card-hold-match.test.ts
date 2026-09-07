const { patchCardDecisionRegistry, installCardHoldExperiment, summarizeGames, isCpuExperimentGameValid } = require('../scripts/run-cpu-card-hold-match');
const vm = require('vm');

describe('disposable card hold comparison', () => {
    test('rejects CPU exceptions even if the browser recovered and finished the game', () => {
        const result = { color: 'black', audit: [], runtimeStatus: { othello: { loaded: true } }, pageErrors: [], consoleMessages: [] };
        expect(isCpuExperimentGameValid(result, 1, true, true)).toBe(true);
        expect(isCpuExperimentGameValid({ ...result, consoleMessages: [{ text: '[AI] Error in runCpuTurn for black' }] }, 1, true, true)).toBe(false);
        expect(isCpuExperimentGameValid({ ...result, audit: [{ player: 'white', changed: true }] }, 1, true, true)).toBe(false);
        expect(isCpuExperimentGameValid({ ...result, audit: [{ error: 'failure' }] }, 1, true, true)).toBe(false);
        expect(isCpuExperimentGameValid(result, 1, false, true)).toBe(false);
    });
    test('refuses missing or ambiguous interception points', () => {
        const needle = 'return { choice: choice || null, prepared };';
        expect(() => patchCardDecisionRegistry('')).toThrow();
        expect(() => patchCardDecisionRegistry(needle + needle)).toThrow();
        expect(patchCardDecisionRegistry(needle)).toContain('__cardHoldExperiment');
    });
    test('holds only candidate marginal choices with legal placement, preserving prepared state', () => {
        const root: any = { require: (name: string) => name.endsWith('cpu-policy-core')
            ? { scoreCardUseDecision: () => ({ score: 40, minUseScore: 10 }) }
            : { getCardCost: () => 1, getCardDef: () => ({}) } };
        vm.runInNewContext(`(${installCardHoldExperiment.toString()})({color:'black',margin:100})`,
            { window: root, performance: { now: () => 0 } });
        const choice = { cardId: 'hard_01' };
        const prepared = { legalMovesCount: 2, decisionContext: {} };
        expect(root.__cardHoldExperiment('black', choice, prepared)).toEqual({ choice: null, prepared });
        expect(root.__cardHoldExperiment('white', choice, prepared).choice).toBe(choice);
        expect(root.__cardHoldExperiment('black', choice, { legalMovesCount: 0 }).choice).toBe(choice);
        expect(root.__cardHoldExperiment('black', choice, { ...prepared, decisionContext: { forceUseCard: true } }).choice).toBe(choice);
        expect(prepared).toEqual({ legalMovesCount: 2, decisionContext: {} });
    });
    test('counts candidate outcome by color and never grants promotion', () => {
        const game = (color: string, winner: string) => ({ color, result: { winner }, valid: true, audit: [{ held: true }] });
        expect(summarizeGames([game('white', 'white'), game('black', 'white'), game('black', 'draw')]))
            .toEqual({ games: 3, wins: 1, losses: 1, draws: 1, interventions: 3, valid: true, promotionAllowed: false });
    });
});
