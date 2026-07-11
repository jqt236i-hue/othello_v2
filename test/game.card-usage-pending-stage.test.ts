import * as fs from 'fs';
import * as path from 'path';
import * as CardUsagePendingStage from '../game/cards/card-usage-pending-stage';

function createCardState() {
    return {
        pendingEffectByPlayer: { black: null, white: null },
        workNextPlacementArmedByPlayer: { black: false, white: false }
    };
}

describe('card usage pending stage', () => {
    test('writes expansion-god pending state then normalizes multi-selection count', () => {
        const cardState = createCardState();
        const pendingManager = {
            requiresTargetSelection: jest.fn(() => true),
            createPendingEffectState: jest.fn(() => ({ selectedTargets: null }))
        };
        const writeCardPendingEffect = jest.fn((state, playerKey, pending) => { state.pendingEffectByPlayer[playerKey] = pending; });

        const result = CardUsagePendingStage.commitCardUsagePendingState({
            cardState, gameState: {}, cardType: 'BOARD_EXPANSION_GOD', cardId: 'expand_01', chargeOwnerKey: 'black',
            removedCard: { handIndex: 2 }, heavenOffers: null, condemnOffers: null, observerWillOffers: null,
            CardPendingStateManagerModule: pendingManager, writeCardPendingEffect,
            readCardPendingEffect: (state, playerKey) => state.pendingEffectByPlayer[playerKey],
            getBoardExpansionGodRequiredSelectionCount: () => 3
        });
        expect(result).toMatchObject({ needsSelection: true, pendingEffectState: { selectedTargets: [], selectedCount: 0, maxSelections: 3 } });
        expect(writeCardPendingEffect).toHaveBeenCalledWith(cardState, 'black', expect.objectContaining({ selectedTargets: [], selectedCount: 0, maxSelections: 3 }));
        expect(cardState.pendingEffectByPlayer.black).toMatchObject({ selectedTargets: [], selectedCount: 0, maxSelections: 3 });
        expect(cardState.pendingEffectByPlayer.black.maxSelections).toBe(3);
        expect(cardState.pendingEffectByPlayer.black.selectedCount).toBe(0);
    });

    test('preserves board-executor null pending and WORK armed mutation', () => {
        const boardExecutorState = createCardState();
        const writeCardPendingEffect = jest.fn();
        CardUsagePendingStage.commitCardUsagePendingState({
            cardState: boardExecutorState, gameState: {}, cardType: 'BOARD_EXECUTOR', cardId: 'executor_01', chargeOwnerKey: 'black',
            removedCard: null, heavenOffers: null, condemnOffers: null, observerWillOffers: null,
            CardPendingStateManagerModule: null, writeCardPendingEffect
        });
        expect(writeCardPendingEffect).toHaveBeenCalledWith(boardExecutorState, 'black', null);

        const workState = createCardState();
        const workDebugLog = jest.fn();
        CardUsagePendingStage.commitCardUsagePendingState({
            cardState: workState, gameState: {}, cardType: 'WORK_WILL', cardId: 'work_01', chargeOwnerKey: 'black',
            removedCard: null, heavenOffers: null, condemnOffers: null, observerWillOffers: null,
            CardPendingStateManagerModule: null, workDebugLog
        });
        expect(workState.workNextPlacementArmedByPlayer.black).toBe(true);
        expect(workDebugLog).toHaveBeenCalledWith(workState, '[WORK_DEBUG] Card played: WORK_WILL armed for', 'black');
    });

    test('keeps the effect resolver free of pending-state mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cards', 'effect-resolver.ts'), 'utf8');
        expect(source).toContain('CardUsagePendingStage.commitCardUsagePendingState({');
        expect(source).not.toContain('const boardExpansionGodPending = readCardPendingEffect(');
    });
});
