type CardUsagePendingStageOptions = {
    cardState: any;
    gameState: any;
    cardType: string;
    cardId: string;
    chargeOwnerKey: string;
    removedCard: any;
    heavenOffers: any;
    condemnOffers: any;
    observerWillOffers: any;
    CardPendingStateManagerModule: any;
    writeCardPendingEffect?: (cardState: any, playerKey: string, pending: any, options?: any) => void;
    readCardPendingEffect?: (cardState: any, playerKey: string) => any;
    getBoardExpansionGodRequiredSelectionCount?: (cardState: any, gameState: any, playerKey: string) => number;
    getBoardShrinkSelectionCount?: () => number;
    workDebugLog?: (cardState: any, ...args: any[]) => void;
};

function commitCardUsagePendingState(options: CardUsagePendingStageOptions): any {
    const pendingOffers = options.heavenOffers || options.condemnOffers || options.observerWillOffers || undefined;
    const pendingManager = options.CardPendingStateManagerModule;
    const needsSelection = !!(
        pendingManager &&
        typeof pendingManager.requiresTargetSelection === 'function' &&
        pendingManager.requiresTargetSelection(options.cardType)
    );
    const pendingEffectState = pendingManager && typeof pendingManager.createPendingEffectState === 'function'
        ? pendingManager.createPendingEffectState({
            cardType: options.cardType,
            cardId: options.cardId,
            sourceHandIndex: options.removedCard ? options.removedCard.handIndex : undefined,
            needsSelection,
            offers: pendingOffers
        })
        : {
            type: options.cardType,
            cardId: options.cardId,
            sourceHandIndex: options.removedCard ? options.removedCard.handIndex : undefined,
            stage: needsSelection ? 'selectTarget' : null,
            offers: pendingOffers,
            selectedCount: (options.cardType === 'BOARD_EXPANSION_GOD' || options.cardType === 'BOARD_SHRINK_WILL') ? 0 : undefined,
            maxSelections: options.cardType === 'BOARD_EXPANSION_GOD'
                ? 2
                : (options.cardType === 'BOARD_SHRINK_WILL' ? (typeof options.getBoardShrinkSelectionCount === 'function' ? options.getBoardShrinkSelectionCount() : 3) : undefined),
            selectedTargets: (options.cardType === 'BOARD_EXPANSION_GOD' || options.cardType === 'BOARD_SHRINK_WILL') ? [] : undefined,
            placementsRemaining: options.cardType === 'LAST_RESORT' ? 3 : undefined
        };

    if (typeof options.writeCardPendingEffect === 'function') {
        options.writeCardPendingEffect(
            options.cardState,
            options.chargeOwnerKey,
            options.cardType === 'BOARD_EXECUTOR' ? null : pendingEffectState
        );
    }

    if (options.cardType === 'BOARD_EXPANSION_GOD' && typeof options.readCardPendingEffect === 'function') {
        const pending = options.readCardPendingEffect(options.cardState, options.chargeOwnerKey);
        if (pending && typeof options.getBoardExpansionGodRequiredSelectionCount === 'function') {
            const requiredSelections = options.getBoardExpansionGodRequiredSelectionCount(options.cardState, options.gameState, options.chargeOwnerKey);
            pending.selectedCount = 0;
            pending.maxSelections = requiredSelections > 0 ? requiredSelections : 1;
            pending.selectedTargets = Array.isArray(pending.selectedTargets) ? pending.selectedTargets : [];
        }
    }

    if (options.cardType === 'BOARD_SHRINK_WILL' && typeof options.readCardPendingEffect === 'function') {
        const pending = options.readCardPendingEffect(options.cardState, options.chargeOwnerKey);
        if (pending) {
            pending.selectedCount = 0;
            pending.maxSelections = typeof options.getBoardShrinkSelectionCount === 'function' ? options.getBoardShrinkSelectionCount() : 3;
            pending.selectedTargets = Array.isArray(pending.selectedTargets) ? pending.selectedTargets : [];
        }
    }

    if (options.cardType === 'WORK_WILL') {
        if (!options.cardState.workNextPlacementArmedByPlayer) options.cardState.workNextPlacementArmedByPlayer = { black: false, white: false };
        options.cardState.workNextPlacementArmedByPlayer[options.chargeOwnerKey] = true;
        if (typeof options.workDebugLog === 'function') {
            options.workDebugLog(options.cardState, '[WORK_DEBUG] Card played: WORK_WILL armed for', options.chargeOwnerKey);
        }
    }

    return { needsSelection, pendingEffectState };
}

export = {
    commitCardUsagePendingState
};
