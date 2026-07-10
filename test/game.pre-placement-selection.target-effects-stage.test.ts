import * as fs from 'fs';
import * as path from 'path';
import * as TargetEffectsSelectionStage from '../game/turn/action-phase/pre-placement-selection-target-effects-stage';
import * as PrePlacementSelection from '../game/turn/action-phase/pre-placement-selection';

function createOptions(pending: any, action: any, CardLogic: any) {
    const events: any[] = [];
    const applyTrapEffectsAfterSelection = jest.fn();
    const handOffTurnAfterSelection = jest.fn();
    const emitDurationSelectionStatusTick = jest.fn();
    return {
        options: {
            CardLogic, cardState: {}, gameState: {}, playerKey: 'black', action, events, prng: { random: () => 0 }, pending,
            createDestroyOutcome: jest.fn(), isDestroyOutcomeResolved: jest.fn(), applyTrapEffectsAfterSelection, handOffTurnAfterSelection,
            emitDurationSelectionStatusTick, emitHandRemovePresentation: jest.fn(), emitHandAddPresentation: jest.fn()
        },
        events, applyTrapEffectsAfterSelection, handOffTurnAfterSelection, emitDurationSelectionStatusTick
    };
}

describe('pre-placement target effects selection stage', () => {
    test.each([
        ['stage', (options: any) => TargetEffectsSelectionStage.resolveTargetEffectsSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves capture mutation, event fields, and trap settlement', (_label, resolve) => {
        const CardLogic = { applyCaptureWill: jest.fn(() => ({ applied: true, blockedByGhost: true, capturedCardId: 'work_01', capturedCardType: 'WORK', capturedCardName: '仕事', sourceSpecialType: 'GOLD', insertIndex: 2 })) };
        const { options, events, applyTrapEffectsAfterSelection } = createOptions({ type: 'CAPTURE_WILL' }, { type: 'place', captureTarget: { row: 2, col: 3 } }, CardLogic);
        expect(resolve(options)).toBe(true);
        expect(events).toEqual([{
            type: 'capture_selected', player: 'black', target: { row: 2, col: 3 }, applied: true, blockedByGhost: true,
            capturedCardId: 'work_01', capturedCardType: 'WORK', capturedCardName: '仕事', sourceSpecialType: 'GOLD', insertIndex: 2
        }]);
        expect(applyTrapEffectsAfterSelection).toHaveBeenCalledTimes(1);
    });

    test.each([
        ['stage', (options: any) => TargetEffectsSelectionStage.resolveTargetEffectsSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves swap settlement and clone immediate-flip output', (_label, resolve) => {
        const swapLogic = { applySwapEffect: jest.fn(() => true) };
        const swap = createOptions({ type: 'SWAP_WITH_ENEMY' }, { type: 'place', swapTarget: { row: 1, col: 4 } }, swapLogic);
        expect(resolve(swap.options)).toBe(true);
        expect(swap.events).toEqual([{ type: 'swap_selected', player: 'black', row: 1, col: 4, swapped: true }]);
        expect(swap.applyTrapEffectsAfterSelection).toHaveBeenCalledTimes(1);
        expect(swap.handOffTurnAfterSelection).toHaveBeenCalledTimes(1);

        const cloneResult = { applied: true, spawned: [{ row: 3, col: 3 }], flipped: [{ row: 3, col: 4 }] };
        const cloneLogic = { applyCloneWill: jest.fn(() => cloneResult) };
        const clone = createOptions({ type: 'CLONE_WILL' }, { type: 'place', cloneTarget: { row: 3, col: 3 } }, cloneLogic);
        expect(resolve(clone.options)).toEqual({ handled: true, immediateFlipResult: cloneResult, immediateFlipSourceType: 'clone_will_selection' });
        expect(cloneLogic.applyCloneWill).toHaveBeenCalledWith(clone.options.cardState, clone.options.gameState, 'black', 3, 3, clone.options.prng);
    });

    test.each([
        ['stage', (options: any) => TargetEffectsSelectionStage.resolveTargetEffectsSelection(options).result],
        ['public facade', (options: any) => PrePlacementSelection.resolvePrePlacementSelectionAction(options)]
    ])('%s preserves status-tick settlement for corrosion', (_label, resolve) => {
        const CardLogic = { applyCorrosionWill: jest.fn(() => ({ applied: true, affectedCount: 1, details: [{ row: 4, col: 4 }] })) };
        const { options, events, emitDurationSelectionStatusTick } = createOptions({ type: 'CORROSION_WILL' }, { type: 'place', corrosionTarget: { row: 4, col: 4 } }, CardLogic);
        expect(resolve(options)).toBe(true);
        expect(events).toEqual([{ type: 'corrosion_will_resolved', player: 'black', target: { row: 4, col: 4 }, applied: true, affectedCount: 1, details: [{ row: 4, col: 4 }] }]);
        expect(emitDurationSelectionStatusTick).toHaveBeenCalledWith({ row: 4, col: 4 }, 'corrosion_applied', 'negative');
    });

    test('keeps the public facade free of target-effect mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'turn', 'action-phase', 'pre-placement-selection.ts'), 'utf8');
        expect(source).toContain('TargetEffectsSelectionStage.resolveTargetEffectsSelection(opts)');
        expect(source).not.toContain('applyCaptureWill(');
        expect(source).not.toContain('applyCloneWill(');
    });
});
