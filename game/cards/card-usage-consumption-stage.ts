type CardUsageConsumptionOptions = {
    cardState: any;
    handKey: string;
    chargeOwnerKey: string;
    cardId: string;
    handIndex: number;
    cost: number;
    noConsume: boolean;
    removeHandCardAt?: (cardState: any, handKey: string, handIndex: number) => any;
    addCardToDiscard?: (cardState: any, cardId: string, cardCopyId: any) => void;
    addChargeValue?: (cardState: any, playerKey: string, value: number, reason: string) => void;
    clearUsedSelectedCard?: (cardState: any, cardId: string, ownerKey: string) => void;
};

function consumeCardUsage(options: CardUsageConsumptionOptions): any {
    let removedCard: any = null;
    if (!options.noConsume) {
        if (typeof options.removeHandCardAt !== 'function') return { ok: false, removedCard: null };
        removedCard = options.removeHandCardAt(options.cardState, options.handKey, options.handIndex);
        if (!removedCard || removedCard.cardId !== options.cardId) return { ok: false, removedCard: null };
        if (typeof options.addCardToDiscard === 'function') {
            options.addCardToDiscard(options.cardState, removedCard.cardId, removedCard.cardCopyId);
        }
        if (typeof options.addChargeValue === 'function') {
            options.addChargeValue(options.cardState, options.chargeOwnerKey, -options.cost, 'card_use_cost');
        }
        options.cardState.hasUsedCardThisTurnByPlayer[options.chargeOwnerKey] = true;
        options.cardState.cardUseCountByPlayer = options.cardState.cardUseCountByPlayer || { black: 0, white: 0 };
        options.cardState.cardUseCountByPlayer[options.chargeOwnerKey] = (options.cardState.cardUseCountByPlayer[options.chargeOwnerKey] || 0) + 1;
    }
    options.cardState.lastUsedCardByPlayer[options.chargeOwnerKey] = options.cardId;
    if (typeof options.clearUsedSelectedCard === 'function') {
        options.clearUsedSelectedCard(options.cardState, options.cardId, options.handKey);
    }
    return { ok: true, removedCard };
}

export = {
    consumeCardUsage
};
