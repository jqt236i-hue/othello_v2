type FateEffectDeps = {
    readCardPendingEffect?: (cardState: any, playerKey: any) => any;
    clearCardPendingEffect?: (cardState: any, playerKey: any) => any;
};

/** A reservation survives the controller's extra turns; only the target turn activates it. */
export function beginFateWillTurn(cardState: any, turnOwnerKey: string): void {
    if (!cardState?.fateWillControllerByTurnOwner?.[turnOwnerKey]) return;
    if (!cardState.fateWillPhaseByTurnOwner) cardState.fateWillPhaseByTurnOwner = { black: null, white: null };
    cardState.fateWillPhaseByTurnOwner[turnOwnerKey] = 'active';
}

/** Completion is shared by placement, selection-only completion, pass and timeout. */
export function completeFateWillTurn(cardState: any, turnOwnerKey: string): void {
    if (!cardState?.fateWillControllerByTurnOwner?.[turnOwnerKey]) return;
    // Missing phase is an older snapshot of an already controlled turn.
    if (cardState.fateWillPhaseByTurnOwner?.[turnOwnerKey] === 'waiting') return;
    cardState.fateWillControllerByTurnOwner[turnOwnerKey] = null;
    if (cardState.fateWillPhaseByTurnOwner) cardState.fateWillPhaseByTurnOwner[turnOwnerKey] = null;
}

export function createCardFateEffect(deps?: FateEffectDeps) {
    const readCardPendingEffect = typeof deps?.readCardPendingEffect === 'function'
        ? deps.readCardPendingEffect
        : (() => null);
    const clearCardPendingEffect = typeof deps?.clearCardPendingEffect === 'function'
        ? deps.clearCardPendingEffect
        : (() => null);

    function getFateWillControllerForTurnOwner(cardState: any, turnOwnerKey: any) {
        if (!cardState || !cardState.fateWillControllerByTurnOwner) return null;
        const key = String(turnOwnerKey || '');
        if (key !== 'black' && key !== 'white') return null;
        return cardState.fateWillControllerByTurnOwner[key] || null;
    }

    function applyFateWill(cardState: any, playerKey: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'FATE_WILL') {
            return { applied: false, reason: 'not_pending' };
        }
        const opponentKey = playerKey === 'black' ? 'white' : 'black';
        if (!cardState.fateWillControllerByTurnOwner) {
            cardState.fateWillControllerByTurnOwner = { black: null, white: null };
        }
        const opponentAlreadyControlled = !!cardState.fateWillControllerByTurnOwner[opponentKey];
        const currentTurnIsControlled = !!cardState.fateWillControllerByTurnOwner[playerKey];
        const alreadyActive = opponentAlreadyControlled || currentTurnIsControlled;
        if (!alreadyActive) {
            cardState.fateWillControllerByTurnOwner[opponentKey] = playerKey;
            if (!cardState.fateWillPhaseByTurnOwner) cardState.fateWillPhaseByTurnOwner = { black: null, white: null };
            cardState.fateWillPhaseByTurnOwner[opponentKey] = 'waiting';
        }
        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, stacked: alreadyActive, controllerKey: playerKey, turnOwnerKey: opponentKey };
    }

    return {
        getFateWillControllerForTurnOwner,
        applyFateWill
    };
}
