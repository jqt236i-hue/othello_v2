import * as fs from 'fs';
import * as path from 'path';
import * as CardUsageConsumptionStage from '../game/cards/card-usage-consumption-stage';

function createCardState() {
    return {
        hasUsedCardThisTurnByPlayer: { black: false, white: false },
        cardUseCountByPlayer: { black: 0, white: 0 },
        lastUsedCardByPlayer: { black: null, white: null },
        selectedCardId: 'work_01',
        selectedCardOwnerKey: 'black'
    };
}

describe('card usage consumption stage', () => {
    test('commits hand, discard, charge, counters, last-used, and selection cleanup in order', () => {
        const cardState = createCardState();
        const calls: string[] = [];
        const removedCard = { cardId: 'work_01', cardCopyId: 'copy_01', handIndex: 2 };

        const result = CardUsageConsumptionStage.consumeCardUsage({
            cardState, handKey: 'black', chargeOwnerKey: 'black', cardId: 'work_01', handIndex: 2, cost: 4, noConsume: false,
            removeHandCardAt: (_state, handKey, handIndex) => {
                calls.push(`remove:${handKey}:${handIndex}`);
                return removedCard;
            },
            addCardToDiscard: (_state, cardId, copyId) => calls.push(`discard:${cardId}:${copyId}`),
            addChargeValue: (_state, playerKey, value, reason) => calls.push(`charge:${playerKey}:${value}:${reason}`),
            clearUsedSelectedCard: (state, cardId, ownerKey) => {
                calls.push(`clear:${cardId}:${ownerKey}`);
                state.selectedCardId = null;
                state.selectedCardOwnerKey = null;
            }
        });

        expect(result).toEqual({ ok: true, removedCard });
        expect(calls).toEqual(['remove:black:2', 'discard:work_01:copy_01', 'charge:black:-4:card_use_cost', 'clear:work_01:black']);
        expect(cardState.hasUsedCardThisTurnByPlayer.black).toBe(true);
        expect(cardState.cardUseCountByPlayer.black).toBe(1);
        expect(cardState.lastUsedCardByPlayer.black).toBe('work_01');
        expect(cardState.lastUsedCard).toEqual({ cardId: 'work_01', ownerKey: 'black' });
        expect(cardState.selectedCardId).toBeNull();
    });

    test('preserves noConsume last-used and selection cleanup without hand mutation', () => {
        const cardState = createCardState();
        const removeHandCardAt = jest.fn();
        const clearUsedSelectedCard = jest.fn();

        expect(CardUsageConsumptionStage.consumeCardUsage({
            cardState, handKey: 'black', chargeOwnerKey: 'black', cardId: 'work_01', handIndex: 2, cost: 4, noConsume: true,
            removeHandCardAt, clearUsedSelectedCard
        })).toEqual({ ok: true, removedCard: null });
        expect(removeHandCardAt).not.toHaveBeenCalled();
        expect(clearUsedSelectedCard).toHaveBeenCalledWith(cardState, 'work_01', 'black');
        expect(cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
        expect(cardState.lastUsedCardByPlayer.black).toBe('work_01');
        expect(cardState.lastUsedCard).toEqual({ cardId: 'work_01', ownerKey: 'black' });
    });

    test('keeps the effect resolver free of hand-consumption mutation bodies', () => {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'game', 'cards', 'effect-resolver.ts'), 'utf8');
        expect(source).toContain('CardUsageConsumptionStage.consumeCardUsage({');
        expect(source).not.toContain('removedCard = removeHandCardAt(');
    });
});
