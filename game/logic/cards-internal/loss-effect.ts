type LossEffectDeps = {
    readCardPendingEffect?: (cardState: any, playerKey: any) => any;
    clearCardPendingEffect?: (cardState: any, playerKey: any) => any;
    collectLossWillRemovals?: (cardState: any) => any;
    getCellValueForCard?: (gameState: any, row: any, col: any) => any;
    emitPresentationEvent?: (cardState: any, event: any) => any;
    findLivingWillMarkerAt?: (cardState: any, row: any, col: any) => any;
    restoreFromLivingWillSnapshot?: (cardState: any, gameState: any, marker: any, trigger: any, deps: any) => any;
    getLivingWillModuleContext?: () => any;
    emptyValue?: any;
};

export function createCardLossEffect(deps?: LossEffectDeps) {
    const readCardPendingEffect = typeof deps?.readCardPendingEffect === 'function'
        ? deps.readCardPendingEffect
        : (() => null);
    const clearCardPendingEffect = typeof deps?.clearCardPendingEffect === 'function'
        ? deps.clearCardPendingEffect
        : (() => null);
    const collectLossWillRemovals = typeof deps?.collectLossWillRemovals === 'function'
        ? deps.collectLossWillRemovals
        : (() => ({ guardedCells: new Set(), removableSpecials: [], removableBombs: [], removed: [] }));
    const getCellValueForCard = typeof deps?.getCellValueForCard === 'function'
        ? deps.getCellValueForCard
        : (() => null);
    const emitPresentationEvent = typeof deps?.emitPresentationEvent === 'function'
        ? deps.emitPresentationEvent
        : (() => null);
    const findLivingWillMarkerAt = typeof deps?.findLivingWillMarkerAt === 'function'
        ? deps.findLivingWillMarkerAt
        : (() => null);
    const restoreFromLivingWillSnapshot = typeof deps?.restoreFromLivingWillSnapshot === 'function'
        ? deps.restoreFromLivingWillSnapshot
        : (() => null);
    const getLivingWillModuleContext = typeof deps?.getLivingWillModuleContext === 'function'
        ? deps.getLivingWillModuleContext
        : (() => null);
    const emptyValue = deps?.emptyValue;

    function applyLossWill(cardState: any, gameState: any, playerKey: any) {
        const pending = readCardPendingEffect(cardState, playerKey);
        if (!pending || pending.type !== 'LOSS_WILL') {
            return { applied: false, reason: 'not_pending', removedCount: 0, removed: [] };
        }

        const lossWillRemovals = collectLossWillRemovals(cardState);
        const removed: any[] = Array.isArray(lossWillRemovals?.removed) ? lossWillRemovals.removed : [];
        const removalItems: any[] = [
            ...(Array.isArray(lossWillRemovals?.removableSpecials) ? lossWillRemovals.removableSpecials : []),
            ...(Array.isArray(lossWillRemovals?.removableBombs) ? lossWillRemovals.removableBombs : [])
        ];
        const removalSet = new Set<any>(removalItems);
        const livingWillRestores = new Map();
        for (const entry of removed) {
            if (!Number.isInteger(entry.row) || !Number.isInteger(entry.col)) continue;
            const key = `${entry.row},${entry.col}`;
            if (livingWillRestores.has(key)) continue;
            if (getCellValueForCard(gameState, entry.row, entry.col) === emptyValue) continue;
            const livingWillMarker = findLivingWillMarkerAt(cardState, entry.row, entry.col);
            if (livingWillMarker) livingWillRestores.set(key, livingWillMarker);
        }

        if (Array.isArray(cardState?.markers)) {
            cardState.markers = cardState.markers.filter((marker: any) => !removalSet.has(marker));
        }

        for (const entry of removed) {
            if (!Number.isInteger(entry.row) || !Number.isInteger(entry.col)) continue;
            if (!gameState || !Array.isArray(gameState.board)) continue;
            if (!Array.isArray(gameState.board[entry.row])) continue;
            if (gameState.board[entry.row][entry.col] === emptyValue) continue;

            emitPresentationEvent(cardState, {
                type: 'STATUS_REMOVED',
                row: entry.row,
                col: entry.col,
                cause: 'LOSS_WILL',
                reason: 'loss_will_reset',
                meta: {
                    special: entry.type,
                    owner: entry.owner,
                    reason: 'loss_will_reset'
                }
            });
        }

        for (const livingWillMarker of livingWillRestores.values()) {
            restoreFromLivingWillSnapshot(
                cardState,
                gameState,
                livingWillMarker,
                {
                    triggerKind: 'loss_will',
                    sourceRow: livingWillMarker.row,
                    sourceCol: livingWillMarker.col,
                    cause: 'LOSS_WILL',
                    reason: 'loss_will_reset'
                },
                getLivingWillModuleContext()
            );
        }

        clearCardPendingEffect(cardState, playerKey);
        return { applied: true, removedCount: removed.length, removed };
    }

    return {
        applyLossWill
    };
}
