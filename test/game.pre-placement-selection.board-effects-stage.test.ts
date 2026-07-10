import * as fs from 'fs';
import * as path from 'path';
import * as BoardEffectsSelectionStage from '../game/turn/action-phase/pre-placement-selection-board-effects-stage';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection';

function createOptions(pending: any, action: any, CardLogic: any) {
    const events: any[] = [];
    return {
        options: {
            CardLogic, cardState: {}, gameState: {}, playerKey: 'black', action, events, prng: { random: () => 0 }, pending,
            createDestroyOutcome: jest.fn(), isDestroyOutcomeResolved: jest.fn(), applyTrapEffectsAfterSelection: jest.fn(), handOffTurnAfterSelection: jest.fn(),
            emitDurationSelectionStatusTick: jest.fn(), emitHandRemovePresentation: jest.fn(), emitHandAddPresentation: jest.fn()
        },
        events
    };
}

describe('pre-placement board effects selection stage', () => {
    test.each([
        ['stage', (options: any) => BoardEffectsSelectionStage.resolveBoardEffectsSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves expansion-god first-selection metadata', (_label, resolve) => {
        const CardLogic = { applyBoardExpansionGod: jest.fn(() => ({ applied: true, completed: false, selectedCount: 1, maxSelections: 2, remainingSelections: 1, selectedTargets: [{ row: 1, col: 2 }] })) };
        const { options, events } = createOptions({ type: 'BOARD_EXPANSION_GOD' }, { type: 'place', expansionTarget: { row: 1, col: 2 } }, CardLogic);
        expect(resolve(options)).toBe(true);
        expect(events).toEqual([{
            type: 'board_expansion_first_selected', player: 'black', cardType: 'BOARD_EXPANSION_GOD', target: { row: 1, col: 2 },
            selectedCount: 1, maxSelections: 2, remainingSelections: 1, selectedTargets: [{ row: 1, col: 2 }], applied: true, completed: false
        }]);
    });

    test.each([
        ['stage', (options: any) => BoardEffectsSelectionStage.resolveBoardEffectsSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves meteor PRNG and causal replay event fields', (_label, resolve) => {
        const meteorLogic = { applyMeteorWill: jest.fn(() => ({ applied: true, destroyed: true })) };
        const meteor = createOptions({ type: 'METEOR_WILL' }, { type: 'place', meteorTarget: { row: 3, col: 4 } }, meteorLogic);
        expect(resolve(meteor.options)).toBe(true);
        expect(meteorLogic.applyMeteorWill).toHaveBeenCalledWith(meteor.options.cardState, meteor.options.gameState, 'black', 3, 4, meteor.options.prng);
        expect(meteor.events).toEqual([{ type: 'meteor_selected', player: 'black', target: { row: 3, col: 4 }, applied: true, destroyed: true }]);

        const causalLogic = { applyCausalReplayWill: jest.fn(() => ({ applied: true, restored: true })) };
        const causal = createOptions({ type: 'CAUSAL_REPLAY_WILL' }, { type: 'place', causalReplayTarget: { row: 2, col: 2 } }, causalLogic);
        expect(resolve(causal.options)).toBe(true);
        expect(causal.events).toEqual([{ type: 'causal_replay_selected', player: 'black', target: { row: 2, col: 2 }, applied: true, restored: true }]);
    });

    test('keeps the public facade free of board-effect mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'turn', 'action-phase', 'pre-placement-selection.ts'), 'utf8');
        expect(source).toContain('BoardEffectsSelectionStage.resolveBoardEffectsSelection(opts)');
        expect(source).not.toContain('applyBoardExpansionGod(');
        expect(source).not.toContain('applyMeteorWill(');
    });
});
