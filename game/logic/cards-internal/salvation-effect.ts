type SalvationEffectDeps = {
    readCardPendingEffect?: (cardState: any, playerKey: any) => any;
    ensureSalvationDestroyedLedger?: (cardState: any) => any;
    clearCardPendingEffect?: (cardState: any, playerKey: any) => any;
    resolveRandomBoardSpawnEffectUsage?: (
        cardState: any,
        gameState: any,
        playerKey: any,
        requestedCount: any,
        prng: any,
        cause: any,
        reason: any,
        options: any
    ) => any;
};

export function cloneSalvationDestroyedEntries(entries: any) {
    if (!Array.isArray(entries)) return [];
    return entries.map((entry: any) => ({
        row: entry && entry.row,
        col: entry && entry.col,
        owner: (entry && (entry.owner === 'black' || entry.owner === 'white')) ? entry.owner : null,
        wasSpecial: !!(entry && entry.wasSpecial === true)
    }));
}

export function cloneSalvationDestroyedLedger(source: any) {
    const ledger = (source && typeof source === 'object') ? source : {};
    return {
        black: cloneSalvationDestroyedEntries(ledger.black),
        white: cloneSalvationDestroyedEntries(ledger.white)
    };
}

export function ensureSalvationDestroyedLedger(cardState: any) {
    if (!cardState || typeof cardState !== 'object') {
        return null;
    }
    if (
        cardState.prevOpponentTurnDestroyedStonesByPlayer
        && typeof cardState.prevOpponentTurnDestroyedStonesByPlayer === 'object'
        && Array.isArray(cardState.prevOpponentTurnDestroyedStonesByPlayer.black)
        && Array.isArray(cardState.prevOpponentTurnDestroyedStonesByPlayer.white)
    ) {
        return cardState.prevOpponentTurnDestroyedStonesByPlayer;
    }
    cardState.prevOpponentTurnDestroyedStonesByPlayer = cloneSalvationDestroyedLedger(
        cardState.prevOpponentTurnDestroyedStonesByPlayer || cardState.prevOpponentTurnDestroyedNormalByPlayer
    );
    return cardState.prevOpponentTurnDestroyedStonesByPlayer;
}

export function createCardSalvationEffect(deps?: SalvationEffectDeps) {
    const readCardPendingEffect = typeof deps?.readCardPendingEffect === 'function'
        ? deps.readCardPendingEffect
        : (() => null);
    const ensureSalvationDestroyedLedger = typeof deps?.ensureSalvationDestroyedLedger === 'function'
        ? deps.ensureSalvationDestroyedLedger
        : (() => null);
    const clearCardPendingEffect = typeof deps?.clearCardPendingEffect === 'function'
        ? deps.clearCardPendingEffect
        : (() => null);
    const resolveRandomBoardSpawnEffectUsage = typeof deps?.resolveRandomBoardSpawnEffectUsage === 'function'
        ? deps.resolveRandomBoardSpawnEffectUsage
        : null;

    function applySalvationWill(cardState: any, gameState: any, playerKey: any, prng: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'SALVATION_WILL') {
            return { applied: false, reason: 'not_pending', spawned: [], requestedCount: 0, spawnedCount: 0 };
        }
        const ledger = ensureSalvationDestroyedLedger(cardState);
        const tracked = ledger && Array.isArray(ledger[playerKey])
            ? ledger[playerKey].slice()
            : [];
        if (tracked.length === 0) {
            if (ledger) {
                ledger[playerKey] = [];
            }
            clearCardPendingEffect(cardState, playerKey);
            return { applied: false, reason: 'no_tracked_stones', spawned: [], requestedCount: 0, spawnedCount: 0 };
        }
        if (!resolveRandomBoardSpawnEffectUsage) {
            throw new Error('[cards.js] resolveRandomBoardSpawnEffectUsage not available');
        }
        const requestedCount = tracked.length;
        const result = resolveRandomBoardSpawnEffectUsage(
            cardState,
            gameState,
            playerKey,
            requestedCount,
            prng,
            'SALVATION_WILL',
            'salvation_spawn',
            {
                normalFlip: true,
                flipReason: 'salvation_flip',
                spawnMetaFactory: (spawnIndex: any) => ({
                    owner: playerKey,
                    requestedCount,
                    spawnIndex
                })
            }
        );
        if (ledger) {
            ledger[playerKey] = [];
        }
        clearCardPendingEffect(cardState, playerKey);
        return result;
    }

    return {
        applySalvationWill
    };
}
