import * as fs from 'fs';
import * as path from 'path';
import * as DestroySelectionStage from '../game/turn/action-phase/pre-placement-selection-destroy-stage';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection';

function createOptions(overrides: Record<string, any> = {}) {
    const events: any[] = [];
    const applyTrapEffectsAfterSelection = jest.fn();
    const CardLogic = {
        applyDestroyEffectDetailed: jest.fn(() => ({
            kind: 'regenerated',
            destroyed: false,
            regenerated: true,
            evaded: false,
            blockedByGhost: false,
            proliferated: false,
            reason: 'revived',
            from: { row: 2, col: 3 },
            to: { row: 3, col: 3 },
            generatedSpawnFlipResults: [{ ownerKey: 'black', flipped: [{ row: 3, col: 3 }] }]
        }))
    };
    return {
        options: {
            CardLogic,
            cardState: { marker: 'state' },
            gameState: { board: [] },
            playerKey: 'black',
            action: { type: 'place', destroyTarget: { row: 2, col: 3 } },
            events,
            prng: { random: () => 0 },
            pending: { type: 'DESTROY_ONE_STONE' },
            createDestroyOutcome: (value: any) => value,
            isDestroyOutcomeResolved: (value: any) => !!(value && value.kind),
            applyTrapEffectsAfterSelection,
            handOffTurnAfterSelection: jest.fn(),
            emitDurationSelectionStatusTick: jest.fn(),
            emitHandRemovePresentation: jest.fn(),
            emitHandAddPresentation: jest.fn(),
            ...overrides
        },
        events,
        CardLogic,
        applyTrapEffectsAfterSelection
    };
}

describe('pre-placement destroy selection stage', () => {
    test.each([
        ['stage', (options: any) => DestroySelectionStage.resolveDestroyOneStoneSelection(options)],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves mutation, event assembly, and settlement', (_label, resolve) => {
        const { options, events, CardLogic, applyTrapEffectsAfterSelection } = createOptions();

        expect(resolve(options)).toEqual({
            handled: true,
            generatedSpawnFlipResults: [{ ownerKey: 'black', flipped: [{ row: 3, col: 3 }] }]
        });
        expect(CardLogic.applyDestroyEffectDetailed).toHaveBeenCalledWith(
            options.cardState,
            options.gameState,
            'black',
            2,
            3
        );
        expect(events).toEqual([{
            type: 'destroy_selected',
            player: 'black',
            target: { row: 2, col: 3 },
            applied: true,
            kind: 'regenerated',
            destroyed: false,
            regenerated: true,
            evaded: false,
            blockedByGhost: false,
            proliferated: false,
            reason: 'revived',
            from: { row: 2, col: 3 },
            to: { row: 3, col: 3 }
        }]);
        expect(applyTrapEffectsAfterSelection).toHaveBeenCalledTimes(1);
    });

    test.each([
        (options: any) => DestroySelectionStage.resolveDestroyOneStoneSelection(options),
        (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)
    ])('rejects a missing target before mutation or settlement', (resolve) => {
        const { options, events, CardLogic, applyTrapEffectsAfterSelection } = createOptions({
            action: { type: 'place' }
        });

        expect(() => resolve(options)).toThrow('DESTROY_ONE_STONE requires destroyTarget before placement');
        expect(CardLogic.applyDestroyEffectDetailed).not.toHaveBeenCalled();
        expect(events).toEqual([]);
        expect(applyTrapEffectsAfterSelection).not.toHaveBeenCalled();
    });

    test('keeps the public facade free of the destroy mutation body', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'turn', 'action-phase', 'pre-placement-selection.ts'), 'utf8');

        expect(source).toContain('DestroySelectionStage.resolveDestroyOneStoneSelection(opts)');
        expect(source).not.toContain('applyDestroyEffectDetailed');
    });
});
