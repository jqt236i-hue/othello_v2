type GeneratedSpawnFlipResolverConfig = {
    cardSpawnAndFlipModule?: any;
    cardHyperactiveModule?: any;
    black?: any;
    white?: any;
    BoardOpsModule?: any;
    getCardContext?: any;
    getFlipsWithContext?: any;
    clearBombAt?: any;
    clearHyperactiveAtPositions?: any;
    defaultPrng?: any;
    isBlockedCell?: any;
    destroyAt?: any;
};

export function createGeneratedSpawnFlipResolver(config: GeneratedSpawnFlipResolverConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as GeneratedSpawnFlipResolverConfig;

    function ensureGeneratedSpawnFlipResolver(cardState: any): any {
        if (!cardState || typeof cardState !== 'object') return cardState;
        if (!(cardState._generatedSpawnFlipResolverInstalled === true && typeof cardState._generatedSpawnFlipResolver === 'function')) {
            const resolveGeneratedFlipBatch = cfg.cardSpawnAndFlipModule && typeof cfg.cardSpawnAndFlipModule.resolveGeneratedFlipBatch === 'function'
                ? cfg.cardSpawnAndFlipModule.resolveGeneratedFlipBatch
                : null;
            const generatedSpawnFlipResolver = (nextCardState: any, nextGameState: any, entries: any[]) => {
                if (!resolveGeneratedFlipBatch || !Array.isArray(entries) || entries.length === 0) return [];
                const results: any[] = [];
                for (const entry of entries) {
                    if (!entry || !Number.isInteger(entry.row) || !Number.isInteger(entry.col)) continue;
                    const ownerKey = entry.ownerKey === 'white' ? 'white' : 'black';
                    const ownerValue = ownerKey === 'white' ? cfg.white : cfg.black;
                    const flipped = resolveGeneratedFlipBatch(
                        nextCardState,
                        nextGameState,
                        ownerKey,
                        ownerValue,
                        [{ row: entry.row, col: entry.col }],
                        {
                            BoardOps: cfg.BoardOpsModule,
                            getCardContext: cfg.getCardContext,
                            getFlipsWithContext: cfg.getFlipsWithContext,
                            clearBombAt: cfg.clearBombAt,
                            changeCause: entry.changeCause || entry.cause || 'SYSTEM',
                            changeReason: entry.changeReason || `${String(entry.reason || 'generated_spawn').toLowerCase()}_flip`,
                            changeMeta: entry.changeMeta || null
                        }
                    );
                    if (flipped.length > 0 && typeof cfg.clearHyperactiveAtPositions === 'function') {
                        cfg.clearHyperactiveAtPositions(nextCardState, flipped);
                    }
                    results.push({
                        ownerKey,
                        cause: entry.cause || null,
                        reason: entry.reason || null,
                        spawned: [{ row: entry.row, col: entry.col }],
                        flipped
                    });
                }
                return results;
            };
            Object.defineProperty(cardState, '_generatedSpawnFlipResolver', {
                value: generatedSpawnFlipResolver,
                configurable: true,
                writable: true,
                enumerable: false
            });
            Object.defineProperty(cardState, '_generatedSpawnFlipResolverInstalled', {
                value: true,
                configurable: true,
                writable: true,
                enumerable: false
            });
        }
        if (!(cardState._evasionMoveFlipResolverInstalled === true && typeof cardState._evasionMoveFlipResolver === 'function')) {
            const evasionMoveFlipResolver = (nextCardState: any, nextGameState: any, entry: any) => {
                if (!cfg.cardHyperactiveModule || typeof cfg.cardHyperactiveModule.resolveEvasionMoveFlips !== 'function') {
                    return { ownerKey: null, flipped: [], moved: [], destroyed: [] };
                }
                if (!entry || !Number.isInteger(entry.row) || !Number.isInteger(entry.col)) {
                    return { ownerKey: null, flipped: [], moved: [], destroyed: [] };
                }
                const reason = String(entry.reason || 'evasion_move');
                return cfg.cardHyperactiveModule.resolveEvasionMoveFlips(
                    nextCardState,
                    nextGameState,
                    { row: entry.row, col: entry.col },
                    entry.randomSource || cfg.defaultPrng,
                    {
                        defaultPrng: cfg.defaultPrng,
                        clearHyperactiveAtPositions: cfg.clearHyperactiveAtPositions,
                        isBlockedCell: cfg.isBlockedCell,
                        BoardOps: cfg.BoardOpsModule,
                        destroyAt: cfg.destroyAt,
                        getCardContext: cfg.getCardContext,
                        getFlipsWithContext: cfg.getFlipsWithContext
                    },
                    {
                        flipCause: entry.changeCause || entry.cause || 'SYSTEM',
                        flipReason: entry.changeReason || `${reason.toLowerCase()}_flip`
                    }
                );
            };
            Object.defineProperty(cardState, '_evasionMoveFlipResolver', {
                value: evasionMoveFlipResolver,
                configurable: true,
                writable: true,
                enumerable: false
            });
            Object.defineProperty(cardState, '_evasionMoveFlipResolverInstalled', {
                value: true,
                configurable: true,
                writable: true,
                enumerable: false
            });
        }
        return cardState;
    }

    return { ensureGeneratedSpawnFlipResolver };
}

module.exports = {
    createGeneratedSpawnFlipResolver
};
