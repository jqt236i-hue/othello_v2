import * as fs from 'fs';
import * as path from 'path';
import * as MovementSelectionStage from '../game/turn/action-phase/pre-placement-selection-movement-stage';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection';

function createOptions(pending: any, action: any, CardLogic: any) {
    const events: any[] = [];
    const applyTrapEffectsAfterSelection = jest.fn();
    return {
        options: {
            CardLogic,
            cardState: {},
            gameState: { board: [] },
            playerKey: 'black',
            action,
            events,
            prng: { random: () => 0 },
            pending,
            createDestroyOutcome: jest.fn(),
            isDestroyOutcomeResolved: jest.fn(),
            applyTrapEffectsAfterSelection,
            handOffTurnAfterSelection: jest.fn(),
            emitDurationSelectionStatusTick: jest.fn(),
            emitHandRemovePresentation: jest.fn(),
            emitHandAddPresentation: jest.fn()
        },
        events,
        applyTrapEffectsAfterSelection
    };
}

describe('pre-placement movement selection stage', () => {
    test.each([
        ['stage', (options: any) => MovementSelectionStage.resolveMovementSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves a buoyancy selection event and settlement', (_label, resolve) => {
        const CardLogic = { applyBuoyancyWill: jest.fn(() => ({ applied: true, from: { row: 4, col: 2 }, to: { row: 0, col: 2 }, destroyed: [{ row: 1, col: 2 }] })) };
        const { options, events, applyTrapEffectsAfterSelection } = createOptions(
            { type: 'BUOYANCY_WILL' },
            { type: 'place', buoyancyTarget: { row: 4, col: 2 } },
            CardLogic
        );

        expect(resolve(options)).toBe(true);
        expect(CardLogic.applyBuoyancyWill).toHaveBeenCalledWith(options.cardState, options.gameState, 'black', 4, 2);
        expect(events).toEqual([{
            type: 'buoyancy_selected', player: 'black', target: { row: 4, col: 2 }, applied: true,
            from: { row: 4, col: 2 }, to: { row: 0, col: 2 }, destroyed: [{ row: 1, col: 2 }]
        }]);
        expect(applyTrapEffectsAfterSelection).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['stage', (options: any) => MovementSelectionStage.resolveMovementSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves super attraction first-target metadata', (_label, resolve) => {
        const CardLogic = { applySuperAttractionWill: jest.fn(() => ({ applied: true, completed: false, firstTarget: { row: 2, col: 2 }, pathCells: [{ row: 2, col: 2 }] })) };
        const { options, events, applyTrapEffectsAfterSelection } = createOptions(
            { type: 'SUPER_ATTRACTION_WILL' },
            { type: 'place', superAttractionTarget: { row: 2, col: 2 } },
            CardLogic
        );

        expect(resolve(options)).toBe(true);
        expect(events).toEqual([{
            type: 'super_attraction_first_selected', player: 'black', target: { row: 2, col: 2 }, applied: true,
            completed: false, firstTarget: { row: 2, col: 2 }, from: null, to: null, destroyed: [],
            selectedPathVariant: null, pathCells: [{ row: 2, col: 2 }], segments: [], waypoints: []
        }]);
        expect(applyTrapEffectsAfterSelection).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['stage', (options: any) => MovementSelectionStage.resolveMovementSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves cell teleport selection and PRNG injection', (_label, resolve) => {
        const CardLogic = { applyCellTeleportWill: jest.fn(() => ({ applied: true, from: { row: 3, col: 3 }, to: { row: 5, col: 5 }, createdDestination: true })) };
        const { options, events, applyTrapEffectsAfterSelection } = createOptions(
            { type: 'CELL_TELEPORT_WILL' },
            { type: 'place', teleportTarget: { row: 3, col: 3 } },
            CardLogic
        );

        expect(resolve(options)).toBe(true);
        expect(CardLogic.applyCellTeleportWill).toHaveBeenCalledWith(options.cardState, options.gameState, 'black', 3, 3, options.prng);
        expect(events).toEqual([{
            type: 'teleport_selected', player: 'black', cardType: 'CELL_TELEPORT_WILL', target: { row: 3, col: 3 },
            applied: true, from: { row: 3, col: 3 }, to: { row: 5, col: 5 }, createdDestination: true
        }]);
        expect(applyTrapEffectsAfterSelection).toHaveBeenCalledTimes(1);
    });

    test.each([
        (options: any) => MovementSelectionStage.resolveMovementSelection(options),
        (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)
    ])('preserves missing and falsy target handling', (resolve) => {
        const CardLogic = { applyStrongWindWill: jest.fn() };
        const missing = createOptions({ type: 'STRONG_WIND_WILL' }, { type: 'place' }, CardLogic);
        expect(() => resolve(missing.options)).toThrow('STRONG_WIND_WILL requires strongWindTarget before placement');
        expect(CardLogic.applyStrongWindWill).not.toHaveBeenCalled();

        const falsy = createOptions({ type: 'STRONG_WIND_WILL' }, { type: 'place', strongWindTarget: false }, CardLogic);
        const result = resolve(falsy.options);
        expect(result && result.matched ? result.result : result).toBe(false);
        expect(CardLogic.applyStrongWindWill).not.toHaveBeenCalled();
        expect(falsy.events).toEqual([]);
        expect(falsy.applyTrapEffectsAfterSelection).not.toHaveBeenCalled();
    });

    test('keeps the public facade free of movement mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'turn', 'action-phase', 'pre-placement-selection.ts'), 'utf8');

        expect(source).toContain('MovementSelectionStage.resolveMovementSelection(opts)');
        expect(source).not.toContain('applyStrongWindWill(');
        expect(source).not.toContain('applyTeleportWill(');
    });
});
