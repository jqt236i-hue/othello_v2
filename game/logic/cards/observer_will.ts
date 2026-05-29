type ObserverWillDeps = {
    defaultPrng: any;
    blackValue: any;
    whiteValue: any;
    markerKinds: any;
    resolveDeterministicRandomSource: (randomLike: any, fallbackLike: any, label: any) => any;
    getSpecialMarkers: (cardState: any) => any[];
    removeMarkersAt: (cardState: any, row: any, col: any, options?: any) => any;
    addChargeWithTotal: (cardState: any, playerKey: any, amount: any) => any;
    revertSpecialStoneWithPresentation: (
        cardState: any,
        gameState: any,
        row: any,
        col: any,
        specialType: any,
        ownerKey: any,
        cause: any,
        reason: any,
        meta: any
    ) => any;
};

function createObserverResult(): any {
    return {
        activated: false,
        triggered: false,
        gained: 0,
        remainingOwnerTurns: null,
        expired: []
    };
}

function hasObserverOptionShape(prngOrOpts: any): boolean {
    return !!(
        prngOrOpts &&
        typeof prngOrOpts === 'object' &&
        Object.prototype.hasOwnProperty.call(prngOrOpts, 'decrementRemainingOwnerTurns')
    );
}

function resolveObserverOptions(prngOrOpts: any, deps: ObserverWillDeps): any {
    const hasOptionShape = hasObserverOptionShape(prngOrOpts);
    const opts = hasOptionShape
        ? Object.assign({ random: deps.defaultPrng, decrementRemainingOwnerTurns: true }, prngOrOpts)
        : { random: prngOrOpts || deps.defaultPrng, decrementRemainingOwnerTurns: true };
    const randomCandidate = (
        hasOptionShape &&
        prngOrOpts &&
        Object.prototype.hasOwnProperty.call(prngOrOpts, 'random')
    )
        ? prngOrOpts.random
        : prngOrOpts;
    opts.random = deps.resolveDeterministicRandomSource(
        randomCandidate,
        opts.random,
        'CardLogic.processObserverWillEffectsAtTurnStartAnchor'
    );
    return opts;
}

function resolveObserverRandomSource(opts: any, defaultPrng: any): any {
    if (opts && typeof opts.random === 'function') {
        return { random: opts.random };
    }
    if (opts && opts.random && typeof opts.random.random === 'function') {
        return opts.random;
    }
    return defaultPrng;
}

export function processObserverWillEffectsAtTurnStartAnchor(
    cardState: any,
    gameState: any,
    playerKey: any,
    row: any,
    col: any,
    prngOrOpts: any,
    deps: ObserverWillDeps
): any {
    const opts = resolveObserverOptions(prngOrOpts, deps);
    const result = createObserverResult();

    if (!cardState || !gameState) return result;

    const marker = deps.getSpecialMarkers(cardState).find((entry: any) => {
        if (!entry || entry.row !== row || entry.col !== col) return false;
        if (entry.owner !== playerKey) return false;
        const data = entry.data || {};
        return String(data.type || '').toUpperCase() === 'OBSERVER';
    });
    if (!marker) return result;

    const playerValue = playerKey === 'black' ? (deps.blackValue || 1) : (deps.whiteValue || -1);
    const boardRow = Array.isArray(gameState.board) ? gameState.board[row] : null;
    const cellValue = Array.isArray(boardRow) ? boardRow[col] : null;

    result.activated = true;
    if (cellValue !== playerValue) {
        deps.removeMarkersAt(cardState, row, col, {
            kind: deps.markerKinds ? deps.markerKinds.SPECIAL_STONE : 'specialStone',
            type: 'OBSERVER',
            owner: playerKey
        });
        result.remainingOwnerTurns = 0;
        result.expired.push({ row, col, owner: playerKey, reason: 'anchor_lost' });
        return result;
    }

    const randomSource = resolveObserverRandomSource(opts, deps.defaultPrng);
    const procRoll = Number(randomSource.random());
    if (procRoll < 0.3) {
        const gainRoll = Number(randomSource.random());
        const gain = 1 + Math.floor(Math.max(0, Math.min(0.999999, gainRoll)) * 5);
        const added = deps.addChargeWithTotal(cardState, playerKey, gain);
        result.triggered = true;
        result.gained = added;
    }

    const shouldDecrement = opts.decrementRemainingOwnerTurns !== false;
    const markerData = marker.data || {};
    if (shouldDecrement && typeof markerData.remainingOwnerTurns === 'number') {
        markerData.remainingOwnerTurns -= 1;
        result.remainingOwnerTurns = markerData.remainingOwnerTurns;
        if (markerData.remainingOwnerTurns <= 0) {
            const revertRes = deps.revertSpecialStoneWithPresentation(
                cardState,
                gameState,
                row,
                col,
                'OBSERVER',
                playerKey,
                'OBSERVER_WILL',
                'duration_end',
                {
                    owner: playerKey,
                    timer: 0
                }
            );
            if (revertRes && revertRes.reverted) {
                result.remainingOwnerTurns = 0;
                result.expired.push({ row, col, owner: playerKey, reason: 'duration_end' });
            }
        }
    } else {
        result.remainingOwnerTurns = (typeof markerData.remainingOwnerTurns === 'number')
            ? markerData.remainingOwnerTurns
            : null;
    }

    return result;
}

module.exports = {
    processObserverWillEffectsAtTurnStartAnchor
};
