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

    test('builds the pending object with the canonical manager factory when the manager is not injected', () => {
        const PendingStateManager = require('../game/logic/cards-internal/pending-state-manager');
        const cases = [
            { cardType: 'BOARD_SHRINK_WILL', removedCard: { handIndex: 1 }, shrinkCount: 4 },
            { cardType: 'DESTROY_ONE_STONE', removedCard: { handIndex: 0 } },
            { cardType: 'LAST_RESORT', removedCard: { handIndex: 3 } },
            { cardType: 'HEAVEN_BLESSING', removedCard: { handIndex: 2 }, heavenOffers: [{ id: 'offer' }] }
        ];
        for (const entry of cases as any[]) {
            for (const injected of [null, {}]) {
                const cardState = createCardState();
                const writes: any[] = [];
                const result = CardUsagePendingStage.commitCardUsagePendingState({
                    cardState, gameState: {}, cardType: entry.cardType, cardId: 'card_01', chargeOwnerKey: 'black',
                    removedCard: entry.removedCard, heavenOffers: entry.heavenOffers || null, condemnOffers: null, observerWillOffers: null,
                    CardPendingStateManagerModule: injected,
                    writeCardPendingEffect: (state: any, playerKey: string, pending: any) => { writes.push(pending); state.pendingEffectByPlayer[playerKey] = pending; },
                    readCardPendingEffect: (state: any, playerKey: string) => state.pendingEffectByPlayer[playerKey],
                    getBoardShrinkSelectionCount: () => entry.shrinkCount || 3
                });
                const expected = PendingStateManager.createPendingEffectState({
                    cardType: entry.cardType,
                    cardId: 'card_01',
                    sourceHandIndex: entry.removedCard.handIndex,
                    needsSelection: PendingStateManager.requiresTargetSelection(entry.cardType),
                    offers: entry.heavenOffers || undefined
                });
                if (entry.cardType === 'BOARD_SHRINK_WILL') {
                    expected.selectedCount = 0;
                    expected.maxSelections = entry.shrinkCount;
                    expected.selectedTargets = [];
                }
                expect({ cardType: entry.cardType, injected, needsSelection: result.needsSelection })
                    .toEqual({ cardType: entry.cardType, injected, needsSelection: PendingStateManager.requiresTargetSelection(entry.cardType) });
                expect(result.pendingEffectState).toEqual(expected);
                expect(writes).toEqual([expected]);
            }
        }
    });

    test('normalizes the source hand index exactly like the canonical factory', () => {
        const cardState = createCardState();
        const result = CardUsagePendingStage.commitCardUsagePendingState({
            cardState, gameState: {}, cardType: 'DESTROY_ONE_STONE', cardId: 'destroy_01', chargeOwnerKey: 'black',
            removedCard: { handIndex: '2' }, heavenOffers: null, condemnOffers: null, observerWillOffers: null,
            CardPendingStateManagerModule: null,
            writeCardPendingEffect: jest.fn()
        });
        expect(result.pendingEffectState.sourceHandIndex).toBeUndefined();
    });

    test('keeps the effect resolver free of pending-state mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cards', 'effect-resolver.ts'), 'utf8');
        expect(source).toContain('CardUsagePendingStage.commitCardUsagePendingState({');
        expect(source).not.toContain('const boardExpansionGodPending = readCardPendingEffect(');
    });
});
