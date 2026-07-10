import * as fs from 'fs';
import * as path from 'path';
import * as ReverseSelectionStage from '../game/turn/action-phase/pre-placement-selection-reverse-stage';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection';

function createOptions(overrides: Record<string, any> = {}) {
    const events: any[] = [];
    const applyTrapEffectsAfterSelection = jest.fn();
    const CardLogic = {
        applyReverseWill: jest.fn(() => ({
            applied: true,
            owner: 'white',
            flipped: [{ row: 3, col: 4 }],
            blocked: [{ row: 4, col: 4 }],
            blockedByGhost: true,
            logicalFlipCount: 2,
            flipCount: 1
        }))
    };
    return {
        options: {
            CardLogic,
            cardState: { marker: 'state' },
            gameState: { board: [] },
            playerKey: 'black',
            action: { type: 'place', reverseWillTarget: { row: 2, col: 3 } },
            events,
            prng: { random: () => 0 },
            pending: { type: 'REVERSE_WILL' },
            createDestroyOutcome: jest.fn(),
            isDestroyOutcomeResolved: jest.fn(),
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

describe('pre-placement reverse selection stage', () => {
    test.each([
        ['stage', (options: any) => ReverseSelectionStage.resolveReverseWillSelection(options)],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves mutation, event assembly, and settlement', (_label, resolve) => {
        const { options, events, CardLogic, applyTrapEffectsAfterSelection } = createOptions();

        expect(resolve(options)).toBe(true);
        expect(CardLogic.applyReverseWill).toHaveBeenCalledWith(options.cardState, options.gameState, 'black', 2, 3);
        expect(events).toEqual([{
            type: 'reverse_will_flipped',
            player: 'black',
            owner: 'white',
            target: { row: 2, col: 3 },
            applied: true,
            details: [{ row: 3, col: 4 }],
            blocked: [{ row: 4, col: 4 }],
            blockedByGhost: true,
            logicalFlipCount: 2,
            flipCount: 1
        }]);
        expect(applyTrapEffectsAfterSelection).toHaveBeenCalledTimes(1);
    });

    test.each([
        (options: any) => ReverseSelectionStage.resolveReverseWillSelection(options),
        (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)
    ])('rejects a missing target before mutation or settlement', (resolve) => {
        const { options, events, CardLogic, applyTrapEffectsAfterSelection } = createOptions({
            action: { type: 'place' }
        });

        expect(() => resolve(options)).toThrow('REVERSE_WILL requires reverseWillTarget before placement');
        expect(CardLogic.applyReverseWill).not.toHaveBeenCalled();
        expect(events).toEqual([]);
        expect(applyTrapEffectsAfterSelection).not.toHaveBeenCalled();
    });

    test('keeps the public facade free of the reverse mutation body', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'turn', 'action-phase', 'pre-placement-selection.ts'), 'utf8');

        expect(source).toContain('ReverseSelectionStage.resolveReverseWillSelection(opts)');
        expect(source).not.toContain('applyReverseWill(');
    });
});
