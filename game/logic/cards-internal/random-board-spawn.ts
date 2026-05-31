export {};

type RandomBoardSpawnDeps = {
    getEmptyBoardShapeCellsForCard: (cardState: any, gameState: any) => any[];
    isBlockedCell: (cardState: any, row: any, col: any, gameState: any) => boolean;
    sampleRandomPositions: (positions: any, count: any, prng: any) => any[];
    BoardOpsModule?: any;
    CardBreedingModule?: any;
    getCardContext: (cardState: any, gameState: any) => any;
    getFlipsWithContextLocal: (context: any, row: any, col: any, player: any, options?: any) => any;
    clearBombAt: (cardState: any, row: any, col: any) => any;
    clearHyperactiveAtPositions: (cardState: any, positions: any) => any;
    BLACK: any;
    WHITE: any;
    setCellValueForCard: (gameState: any, row: any, col: any, value: any) => any;
    allocateStoneId: (cardState: any) => any;
    setStoneIdAtForCard: (cardState: any, gameState: any, row: any, col: any, stoneId: any) => any;
    emitPresentationEvent: (cardState: any, event: any) => any;
    getReinforcementWillTargets: (cardState: any, gameState: any, playerKey: any) => any[];
    readCardPendingEffect: (cardState: any, playerKey: any) => any;
    clearCardPendingEffect: (cardState: any, playerKey: any, options?: any) => any;
    equalityWillMaxSpawns: number;
    reinforcementWillSpawnCount: number;
    supportTroopsWillSpawnCount: number;
};

function collectRandomBoardSpawnablePositions(cardState: any, gameState: any, predicate: any, deps: RandomBoardSpawnDeps) {
    return deps.getEmptyBoardShapeCellsForCard(cardState, gameState)
        .filter((cell: any) => {
            if (!cell) return false;
            if (deps.isBlockedCell(cardState, cell.row, cell.col, gameState)) return false;
            if (typeof predicate === 'function' && predicate(cell) !== true) return false;
            return true;
        });
}

function resolveRandomBoardSpawnEffectUsage(cardState: any, gameState: any, playerKey: any, requestedCount: any, prng: any, cause: any, reason: any, options: any = {}, deps: RandomBoardSpawnDeps) {
    const normalizedRequestedCount = Number.isFinite(Number(requestedCount))
        ? Math.max(0, Math.trunc(Number(requestedCount)))
        : 0;
    const targets = deps.sampleRandomPositions(
        collectRandomBoardSpawnablePositions(cardState, gameState, options.targetFilter, deps),
        normalizedRequestedCount,
        prng
    );
    const spawnMetaFactory = (typeof options.spawnMetaFactory === 'function')
        ? options.spawnMetaFactory
        : ((spawnIndex: any) => ({
            owner: playerKey,
            requestedCount: normalizedRequestedCount,
            spawnIndex
        }));
    const normalFlip = options.normalFlip === true;
    const player = playerKey === 'white' ? deps.WHITE : deps.BLACK;
    let spawned: any[] = [];
    let flipped: any[] = [];
    let usedSharedSpawnAndFlip = false;
    let sharedSpawnAndFlipBatch = null;
    let sharedSpawnCount = 0;

    if (normalFlip && deps.BoardOpsModule && typeof deps.BoardOpsModule.spawnAt === 'function' && typeof deps.BoardOpsModule.changeAt === 'function') {
        if (deps.CardBreedingModule && typeof deps.CardBreedingModule.spawnAndFlipBatch === 'function') {
            sharedSpawnAndFlipBatch = deps.CardBreedingModule.spawnAndFlipBatch;
        }
        if (sharedSpawnAndFlipBatch) {
            const batch = sharedSpawnAndFlipBatch(
                cardState,
                gameState,
                playerKey,
                player,
                targets.filter(Boolean),
                cause,
                reason,
                {
                    row: Number.isInteger(options.anchorRow) ? options.anchorRow : null,
                    col: Number.isInteger(options.anchorCol) ? options.anchorCol : null
                },
                {
                    getCardContext: deps.getCardContext,
                    getFlipsWithContext: deps.getFlipsWithContextLocal,
                    clearBombAt: deps.clearBombAt,
                    clearHyperactiveAtPositions: deps.clearHyperactiveAtPositions,
                    changeCause: cause,
                    changeReason: options.flipReason || 'breeding_flip',
                    BoardOps: {
                        spawnAt: (innerCardState: any, innerGameState: any, row: any, col: any, ownerKey: any, spawnCause: any, spawnReason: any) => {
                            sharedSpawnCount += 1;
                            const spawnIndex = sharedSpawnCount;
                            return deps.BoardOpsModule.spawnAt(
                                innerCardState,
                                innerGameState,
                                row,
                                col,
                                ownerKey,
                                spawnCause,
                                spawnReason,
                                spawnMetaFactory(spawnIndex, { row, col })
                            );
                        },
                        runSpawnBlock: deps.BoardOpsModule && typeof deps.BoardOpsModule.runSpawnBlock === 'function'
                            ? deps.BoardOpsModule.runSpawnBlock
                            : null,
                        changeAt: (innerCardState: any, innerGameState: any, row: any, col: any, ownerKey: any, flipCause: any, flipReason: any, meta: any) => (
                            deps.BoardOpsModule.changeAt(innerCardState, innerGameState, row, col, ownerKey, flipCause, flipReason, meta)
                        )
                    }
                }
            );
            usedSharedSpawnAndFlip = true;
            spawned = Array.isArray(batch && batch.spawned) ? batch.spawned.slice() : [];
            flipped = Array.isArray(batch && batch.flipped) ? batch.flipped.slice() : [];
        }
    }

    if (!normalFlip || !usedSharedSpawnAndFlip) {
        spawned = [];
        flipped = [];
        const validTargets = targets.filter(Boolean);
        if (deps.BoardOpsModule && typeof deps.BoardOpsModule.spawnMany === 'function') {
            const batch = deps.BoardOpsModule.spawnMany(
                cardState,
                gameState,
                validTargets,
                playerKey,
                cause,
                reason,
                {
                    requestedCount: normalizedRequestedCount,
                    metaFactory: (spawnIndex: any, target: any) => spawnMetaFactory(spawnIndex, target)
                }
            );
            spawned = Array.isArray(batch && batch.spawned) ? batch.spawned.slice() : [];
        } else {
            for (const target of validTargets) {
                const spawnIndex: number = spawned.length + 1;
                const spawnMeta: any = spawnMetaFactory(spawnIndex, target);
                let spawnRes = null;
                if (deps.BoardOpsModule && typeof deps.BoardOpsModule.spawnAt === 'function') {
                    spawnRes = deps.BoardOpsModule.spawnAt(
                        cardState,
                        gameState,
                        target.row,
                        target.col,
                        playerKey,
                        cause,
                        reason,
                        spawnMeta
                    );
                } else {
                    const playerValue = playerKey === 'white' ? deps.WHITE : deps.BLACK;
                    const wroteCell = deps.setCellValueForCard(gameState, target.row, target.col, playerValue);
                    if (wroteCell) {
                        const stoneId = deps.allocateStoneId(cardState);
                        deps.setStoneIdAtForCard(cardState, gameState, target.row, target.col, stoneId);
                        deps.emitPresentationEvent(cardState, {
                            type: 'SPAWN',
                            stoneId,
                            row: target.row,
                            col: target.col,
                            ownerAfter: playerKey,
                            cause,
                            reason,
                            meta: spawnMeta
                        });
                        spawnRes = { spawned: true, stoneId };
                    }
                }
                if (!(spawnRes && spawnRes.spawned)) continue;
                spawned.push({
                    row: target.row,
                    col: target.col,
                    stoneId: spawnRes.stoneId || null
                });
            }
        }
    }

    return {
        applied: true,
        requestedCount: normalizedRequestedCount,
        spawnedCount: spawned.length,
        spawned,
        flippedCount: flipped.length,
        flipped
    };
}

function resolveEqualityWillUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: RandomBoardSpawnDeps) {
    return resolveRandomBoardSpawnEffectUsage(
        cardState,
        gameState,
        playerKey,
        deps.equalityWillMaxSpawns,
        prng,
        'EQUALITY_WILL',
        'equality_will_spawn',
        {
            normalFlip: true,
            flipReason: 'equality_will_flip',
            spawnMetaFactory: (spawnIndex: any) => ({
                owner: playerKey,
                requestedCount: deps.equalityWillMaxSpawns,
                spawnIndex
            })
        },
        deps
    );
}

function canUseReinforcementWillForPlayer(cardState: any, gameState: any, playerKey: any, deps: RandomBoardSpawnDeps) {
    return deps.getReinforcementWillTargets(cardState, gameState, playerKey).length > 0;
}

function resolveReinforcementLikeUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: RandomBoardSpawnDeps, options: any) {
    const requestedCount = Number.isFinite(Number(options && options.requestedCount))
        ? Math.max(0, Math.trunc(Number(options.requestedCount)))
        : 0;
    const pendingType = String(options && options.pendingType || '');
    const pending = deps.readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== pendingType) {
        return { applied: false, reason: 'not_pending', requestedCount: 0, spawnedCount: 0, spawned: [], flippedCount: 0, flipped: [] };
    }
    const targetSet = new Set(deps.getReinforcementWillTargets(cardState, gameState, playerKey).map((cell: any) => `${cell.row},${cell.col}`));
    if (targetSet.size <= 0) {
        deps.clearCardPendingEffect(cardState, playerKey);
        return { applied: false, reason: 'no_targets', requestedCount, spawnedCount: 0, spawned: [], flippedCount: 0, flipped: [] };
    }
    const result = resolveRandomBoardSpawnEffectUsage(
        cardState,
        gameState,
        playerKey,
        requestedCount,
        prng,
        options.cause,
        options.spawnReason,
        {
            normalFlip: true,
            flipReason: options.flipReason,
            targetFilter: (cell: any) => targetSet.has(`${cell.row},${cell.col}`),
            spawnMetaFactory: (spawnIndex: any) => ({
                owner: playerKey,
                requestedCount,
                spawnIndex
            })
        },
        deps
    );
    deps.clearCardPendingEffect(cardState, playerKey);
    return result;
}

function resolveReinforcementWillUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: RandomBoardSpawnDeps) {
    return resolveReinforcementLikeUsage(cardState, gameState, playerKey, prng, deps, {
        pendingType: 'REINFORCEMENT_WILL',
        requestedCount: deps.reinforcementWillSpawnCount,
        cause: 'REINFORCEMENT_WILL',
        spawnReason: 'reinforcement_will_spawn',
        flipReason: 'reinforcement_will_flip'
    });
}

function canUseSupportTroopsWillForPlayer(cardState: any, gameState: any, playerKey: any, deps: RandomBoardSpawnDeps) {
    return canUseReinforcementWillForPlayer(cardState, gameState, playerKey, deps);
}

function resolveSupportTroopsWillUsage(cardState: any, gameState: any, playerKey: any, prng: any, deps: RandomBoardSpawnDeps) {
    return resolveReinforcementLikeUsage(cardState, gameState, playerKey, prng, deps, {
        pendingType: 'SUPPORT_TROOPS_WILL',
        requestedCount: deps.supportTroopsWillSpawnCount,
        cause: 'SUPPORT_TROOPS_WILL',
        spawnReason: 'support_troops_will_spawn',
        flipReason: 'support_troops_will_flip'
    });
}

module.exports = {
    collectRandomBoardSpawnablePositions,
    resolveRandomBoardSpawnEffectUsage,
    resolveEqualityWillUsage,
    canUseReinforcementWillForPlayer,
    resolveReinforcementWillUsage,
    canUseSupportTroopsWillForPlayer,
    resolveSupportTroopsWillUsage
};
