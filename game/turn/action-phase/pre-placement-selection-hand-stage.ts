type HandSelectionStageOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    events: any[];
    pending: any;
    emitHandRemovePresentation: (payload: any) => void;
    emitHandAddPresentation?: (payload: any) => void;
};

function resolveHeavenBlessingSelection(options: HandSelectionStageOptions): any {
    const pending = options.pending;
    if (!pending || pending.type !== 'HEAVEN_BLESSING') return null;

    const selectedCardId = options.action && options.action.heavenBlessingCardId;
    if (selectedCardId == null) {
        throw new Error('HEAVEN_BLESSING requires heavenBlessingCardId before placement');
    }
    if (!selectedCardId) return { matched: true, result: false };

    const result = options.CardLogic.applyHeavenBlessingChoice(options.cardState, options.playerKey, selectedCardId);
    options.events.push({
        type: 'heaven_blessing_selected',
        player: options.playerKey,
        selectedCardId,
        applied: !!(result && result.applied)
    });
    return { matched: true, result: true };
}

function resolveCondemnSelection(options: HandSelectionStageOptions): any {
    const pending = options.pending;
    if (!pending || pending.type !== 'CONDEMN_WILL') return null;

    const targetIndex = options.action && options.action.condemnTargetIndex;
    if (targetIndex == null) {
        throw new Error('CONDEMN_WILL requires condemnTargetIndex before placement');
    }

    const result = options.CardLogic.applyCondemnWill(options.cardState, options.playerKey, targetIndex);
    options.events.push({
        type: 'condemn_selected',
        player: options.playerKey,
        condemnTargetIndex: targetIndex,
        applied: !!(result && result.applied),
        destroyedCardId: (result && result.destroyedCardId) ? result.destroyedCardId : null
    });
    if (!result || !result.applied) {
        throw new Error(`CONDEMN_WILL selection failed: ${(result && result.reason) || 'invalid_target'}`);
    }

    const opponentKey = options.playerKey === 'black' ? 'white' : 'black';
    options.emitHandRemovePresentation({
        player: opponentKey,
        count: 1,
        reason: 'condemn_will',
        cardId: result.destroyedCardId ? result.destroyedCardId : null,
        cardIds: result.destroyedCardId ? [result.destroyedCardId] : []
    });
    return { matched: true, result: true };
}

function resolveObserverSelection(options: HandSelectionStageOptions): any {
    const pending = options.pending;
    if (!pending || pending.type !== 'OBSERVER_WILL') return null;

    const targetIndex = options.action && options.action.observerWillTargetIndex;
    if (targetIndex == null) {
        throw new Error('OBSERVER_WILL requires observerWillTargetIndex before placement');
    }

    const result = options.CardLogic.applyObserverWillChoice(
        options.cardState,
        options.gameState,
        options.playerKey,
        targetIndex
    );
    options.events.push({
        type: 'observer_will_selected',
        player: options.playerKey,
        observerWillTargetIndex: targetIndex,
        applied: !!(result && result.applied),
        stolenCardId: (result && result.stolenCardId) ? result.stolenCardId : null,
        stolenCardCopyId: (result && Number.isInteger(result.stolenCardCopyId)) ? result.stolenCardCopyId : null,
        repaymentAmount: (result && Number.isFinite(result.repaymentAmount)) ? Number(result.repaymentAmount) : null
    });
    if (!result || !result.applied) {
        throw new Error(`OBSERVER_WILL selection failed: ${(result && result.reason) || 'invalid_target'}`);
    }

    const opponentKey = options.playerKey === 'black' ? 'white' : 'black';
    options.emitHandRemovePresentation({
        player: opponentKey,
        count: 1,
        reason: 'observer_will',
        cardId: result.stolenCardId ? result.stolenCardId : null,
        cardIds: result.stolenCardId ? [result.stolenCardId] : []
    });
    if (typeof options.emitHandAddPresentation === 'function') {
        options.emitHandAddPresentation({
            player: options.playerKey,
            count: 1,
            reason: 'observer_will',
            cardId: result.stolenCardId || null,
            meta: {
                sourceType: 'OBSERVER_WILL',
                sourceCardId: pending.cardId || null
            }
        });
    }
    return { matched: true, result: true };
}

function resolveHandSelection(options: HandSelectionStageOptions): any {
    return resolveHeavenBlessingSelection(options)
        || resolveCondemnSelection(options)
        || resolveObserverSelection(options);
}

export = {
    resolveHandSelection
};
