import * as fs from 'fs';
import * as path from 'path';
import * as HandSelectionStage from '../game/turn/action-phase/pre-placement-selection-hand-stage';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection';

function createOptions(pending: any, action: any, CardLogic: any) {
    const events: any[] = [];
    const emitHandRemovePresentation = jest.fn();
    const emitHandAddPresentation = jest.fn();
    return {
        options: {
            CardLogic, cardState: {}, gameState: {}, playerKey: 'black', action, events, prng: { random: () => 0 }, pending,
            createDestroyOutcome: jest.fn(), isDestroyOutcomeResolved: jest.fn(), applyTrapEffectsAfterSelection: jest.fn(), handOffTurnAfterSelection: jest.fn(),
            emitDurationSelectionStatusTick: jest.fn(), emitHandRemovePresentation, emitHandAddPresentation
        },
        events,
        emitHandRemovePresentation,
        emitHandAddPresentation
    };
}

describe('pre-placement hand selection stage', () => {
    test.each([
        ['stage', (options: any) => HandSelectionStage.resolveHandSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves condemn event before hand presentation', (_label, resolve) => {
        const CardLogic = { applyCondemnWill: jest.fn(() => ({ applied: true, destroyedCardId: 'enemy_01' })) };
        const { options, events, emitHandRemovePresentation } = createOptions(
            { type: 'CONDEMN_WILL' }, { type: 'place', condemnTargetIndex: 0 }, CardLogic
        );

        expect(resolve(options)).toBe(true);
        expect(events).toEqual([{ type: 'condemn_selected', player: 'black', condemnTargetIndex: 0, applied: true, destroyedCardId: 'enemy_01' }]);
        expect(emitHandRemovePresentation).toHaveBeenCalledWith({
            player: 'white', count: 1, reason: 'condemn_will', cardId: 'enemy_01', cardIds: ['enemy_01']
        });
    });

    test.each([
        ['stage', (options: any) => HandSelectionStage.resolveHandSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves observer steal presentation metadata', (_label, resolve) => {
        const CardLogic = { applyObserverWillChoice: jest.fn(() => ({ applied: true, stolenCardId: 'enemy_02', stolenCardCopyId: 4, repaymentAmount: 3 })) };
        const { options, events, emitHandRemovePresentation, emitHandAddPresentation } = createOptions(
            { type: 'OBSERVER_WILL', cardId: 'observer_01' }, { type: 'place', observerWillTargetIndex: 1 }, CardLogic
        );

        expect(resolve(options)).toBe(true);
        expect(events).toEqual([{
            type: 'observer_will_selected', player: 'black', observerWillTargetIndex: 1, applied: true,
            stolenCardId: 'enemy_02', stolenCardCopyId: 4, repaymentAmount: 3
        }]);
        expect(emitHandRemovePresentation).toHaveBeenCalledWith({
            player: 'white', count: 1, reason: 'observer_will', cardId: 'enemy_02', cardIds: ['enemy_02']
        });
        expect(emitHandAddPresentation).toHaveBeenCalledWith({
            player: 'black', count: 1, reason: 'observer_will', cardId: 'enemy_02',
            meta: { sourceType: 'OBSERVER_WILL', sourceCardId: 'observer_01' }
        });
    });

    test.each([
        (options: any) => HandSelectionStage.resolveHandSelection(options),
        (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)
    ])('emits the failed condemn selection before throwing', (resolve) => {
        const CardLogic = { applyCondemnWill: jest.fn(() => ({ applied: false, reason: 'protected' })) };
        const { options, events, emitHandRemovePresentation } = createOptions(
            { type: 'CONDEMN_WILL' }, { type: 'place', condemnTargetIndex: 0 }, CardLogic
        );

        expect(() => resolve(options)).toThrow('CONDEMN_WILL selection failed: protected');
        expect(events).toEqual([{ type: 'condemn_selected', player: 'black', condemnTargetIndex: 0, applied: false, destroyedCardId: null }]);
        expect(emitHandRemovePresentation).not.toHaveBeenCalled();
    });

    test('keeps the public facade free of hand selection mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'turn', 'action-phase', 'pre-placement-selection.ts'), 'utf8');

        expect(source).toContain('HandSelectionStage.resolveHandSelection(opts)');
        expect(source).not.toContain('applyCondemnWill(');
        expect(source).not.toContain('applyObserverWillChoice(');
    });
});
