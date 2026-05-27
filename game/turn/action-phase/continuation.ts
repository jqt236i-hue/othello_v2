type ResolvePlacementContinuationOptions = {
    Core: any;
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    pendingType: any;
    preExtra: number;
    turnNumberBeforePlace: number;
    events: any[];
    resolveSafeCardContext: (CardLogic: any, cardState: any) => any;
    readPendingForActionPhase: (cardState: any, playerKey: any) => any;
    clearPendingForActionPhase: (cardState: any, playerKey: any) => any;
    keepTurnActive: () => void;
    handOffCompletedTurn: () => void;
};

function hasContinuationMovesForPendingType(options: ResolvePlacementContinuationOptions, pendingType: any): boolean {
    const ctx = options.resolveSafeCardContext(options.CardLogic, options.cardState);
    const playerValue = options.playerKey === 'black' ? options.Core.BLACK : options.Core.WHITE;
    if (pendingType === 'LAST_RESORT' && typeof options.Core.getFreePlacementMoves === 'function') {
        const moves = options.Core.getFreePlacementMoves(options.gameState, playerValue, ctx);
        return Array.isArray(moves) && moves.length > 0;
    }
    const moves = options.Core.getLegalMoves(options.gameState, playerValue, ctx);
    return Array.isArray(moves) && moves.length > 0;
}

function clearMultiPlaceStateForPlayer(cardState: any, playerKey: any): void {
    if (!cardState) return;
    if (!cardState.extraPlaceRemainingByPlayer) cardState.extraPlaceRemainingByPlayer = { black: 0, white: 0 };
    if (!cardState.infinitePlaceActiveByPlayer) cardState.infinitePlaceActiveByPlayer = { black: false, white: false };
    if (!cardState.multiPlaceSourceTypeByPlayer) cardState.multiPlaceSourceTypeByPlayer = { black: null, white: null };
    cardState.extraPlaceRemainingByPlayer[playerKey] = 0;
    cardState.infinitePlaceActiveByPlayer[playerKey] = false;
    cardState.multiPlaceSourceTypeByPlayer[playerKey] = null;
}

function resolvePlacementContinuation(options: ResolvePlacementContinuationOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolvePlacementContinuationOptions);
    const cardState = opts.cardState;
    const playerKey = opts.playerKey;
    const continuationSourceType = (cardState.multiPlaceSourceTypeByPlayer && typeof cardState.multiPlaceSourceTypeByPlayer[playerKey] === 'string')
        ? cardState.multiPlaceSourceTypeByPlayer[playerKey]
        : null;
    const infinitePlaceActive = !!(cardState.infinitePlaceActiveByPlayer && cardState.infinitePlaceActiveByPlayer[playerKey]);

    if (opts.preExtra > 0) {
        cardState.extraPlaceRemainingByPlayer[playerKey] = Math.max(0, (cardState.extraPlaceRemainingByPlayer[playerKey] || 0) - 1);
        opts.events.push({
            type: 'extra_place_consumed',
            player: playerKey,
            sourceType: continuationSourceType || (opts.pendingType === 'LAST_RESORT' ? 'LAST_RESORT' : null),
            remaining: cardState.extraPlaceRemainingByPlayer[playerKey] || 0
        });
    }

    let postExtra = cardState.extraPlaceRemainingByPlayer[playerKey] || 0;
    const pendingAfterPlacement = opts.readPendingForActionPhase(cardState, playerKey);
    const hasLastResortContinuation = !!(
        pendingAfterPlacement &&
        pendingAfterPlacement.type === 'LAST_RESORT' &&
        Number(pendingAfterPlacement.placementsRemaining || 0) > 0
    );

    let keepTurnForContinuation = false;
    if (infinitePlaceActive) {
        keepTurnForContinuation = hasContinuationMovesForPendingType(opts, continuationSourceType);
        if (!keepTurnForContinuation) {
            clearMultiPlaceStateForPlayer(cardState, playerKey);
        }
    } else if (postExtra > 0) {
        const continuationPendingType = hasLastResortContinuation ? 'LAST_RESORT' : continuationSourceType;
        keepTurnForContinuation = hasContinuationMovesForPendingType(opts, continuationPendingType);
        if (!keepTurnForContinuation) {
            if (hasLastResortContinuation) {
                opts.clearPendingForActionPhase(cardState, playerKey);
            }
            clearMultiPlaceStateForPlayer(cardState, playerKey);
            postExtra = 0;
        }
    } else {
        clearMultiPlaceStateForPlayer(cardState, playerKey);
    }

    if (keepTurnForContinuation) {
        opts.keepTurnActive();
        return;
    }
    opts.handOffCompletedTurn();
}

const ActionPhaseContinuationModule = {
    resolvePlacementContinuation
};

export = ActionPhaseContinuationModule;
