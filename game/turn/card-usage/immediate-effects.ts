type ResolveImmediateCardUsageEffectsOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    prng: any;
    pendingType: any;
    addChargeWithTotal: (cardState: any, playerKey: any, amount: any, options: any) => any;
    clearPendingForActionPhase: (cardState: any, playerKey: any) => any;
    transferChargeBetweenPlayers: (cardState: any, fromPlayerKey: any, toPlayerKey: any, amount: any, reasonKey: any) => any;
    applyPostFlipRevives: (CardLogic: any, cardState: any, gameState: any, flips: any, ownerKey: any) => any;
    resolveBoardBonusGain: (CardLogic: any, cardState: any, playerKey: any, row: any, col: any, options: any) => any;
    awardBoardChargeGain: (CardLogic: any, cardState: any, playerKey: any, amount: any, options: any) => void;
    emitHandRemovePresentation: (CardLogic: any, cardState: any, payload: any) => void;
};

function applyImmediateFlipResolutionFollowups(options: ResolveImmediateCardUsageEffectsOptions, result: any, sourceType: string): void {
    if (!result || !Array.isArray(result.flipped) || !result.flipped.length || typeof options.CardLogic.applyRegenAfterFlips !== 'function') {
        return;
    }

    const reviveRes = options.applyPostFlipRevives(
        options.CardLogic,
        options.cardState,
        options.gameState,
        result.flipped,
        options.playerKey
    );
    const regenRes = reviveRes.regenRes;
    const livingWillRes = reviveRes.livingWillRes;
    if (regenRes && regenRes.regened && regenRes.regened.length) {
        options.events.push({ type: 'regen_triggered', details: regenRes.regened });
    }
    if (regenRes && regenRes.captureFlips && regenRes.captureFlips.length) {
        if (typeof options.CardLogic.clearHyperactiveAtPositions === 'function') {
            options.CardLogic.clearHyperactiveAtPositions(options.cardState, regenRes.captureFlips);
        }
        const firstCapture = regenRes.captureFlips[0] || {};
        options.awardBoardChargeGain(options.CardLogic, options.cardState, options.playerKey, regenRes.captureFlips.length, {
            targetRow: firstCapture.row,
            targetCol: firstCapture.col,
            sourceType: 'regen_capture_immediate'
        });
        options.events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
    }
    if (livingWillRes && livingWillRes.restored && livingWillRes.restored.length) {
        options.events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
    }
    const firstFlip = result.flipped[0] || {};
    options.awardBoardChargeGain(options.CardLogic, options.cardState, options.playerKey, result.flipped.length, {
        targetRow: firstFlip.row,
        targetCol: firstFlip.col,
        sourceType
    });
}

function resetConsecutivePassesAfterBoardMutation(gameState: any, result: any): void {
    if (!gameState || typeof gameState !== 'object' || !result || typeof result !== 'object') {
        return;
    }
    const spawnedCount = Number(result.spawnedCount) || (Array.isArray(result.spawned) ? result.spawned.length : 0);
    const flippedCount = Number(result.flippedCount) || (Array.isArray(result.flipped) ? result.flipped.length : 0);
    if (spawnedCount > 0 || flippedCount > 0) {
        gameState.consecutivePasses = 0;
    }
}

function applySpawnedNumberCellGains(options: ResolveImmediateCardUsageEffectsOptions, result: any, spawnedOptions: { skipBoardCharge?: boolean } = {}): void {
    if (!result || !Array.isArray(result.spawned) || !result.spawned.length) {
        return;
    }
    if (typeof options.resolveBoardBonusGain !== 'function') {
        return;
    }
    const skipBoardCharge = spawnedOptions && spawnedOptions.skipBoardCharge === true;
    for (const spawned of result.spawned) {
        const row = Number(spawned && spawned.row);
        const col = Number(spawned && spawned.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) continue;
        const bonusGain = options.resolveBoardBonusGain(
            options.CardLogic,
            options.cardState,
            options.playerKey,
            row,
            col,
            {
                othelloMode: false,
                flipCount: 0,
                skipBoardCharge
            }
        );
        if (bonusGain && (Number(bonusGain.gained) || 0) > 0) {
            options.events.push(Object.assign({
                type: 'board_bonus_gain'
            }, bonusGain));
        }
    }
}

function resolveImmediateCardUsageEffects(options: ResolveImmediateCardUsageEffectsOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolveImmediateCardUsageEffectsOptions);
    const pendingType = opts.pendingType;
    const p = opts.prng || undefined;

    if (pendingType === 'TREASURE_BOX') {
        if (!(p && typeof p.random === 'function')) {
            throw new Error('TurnPipelinePhases.applyCardUsagePhase TREASURE_BOX requires an injected deterministic PRNG.');
        }
        const rnd = p.random();
        const gained = 1 + Math.floor(Math.max(0, Math.min(0.999999, rnd)) * 6);
        opts.addChargeWithTotal(opts.cardState, opts.playerKey, gained, null);
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        opts.events.push({ type: 'treasure_box_gain', player: opts.playerKey, gained });
    }

    if (pendingType === 'RIBO_WILL') {
        const res = (typeof opts.CardLogic.armRiboWillEffect === 'function')
            ? opts.CardLogic.armRiboWillEffect(opts.cardState, opts.playerKey)
            : null;
        if (!res || res.applied !== true) {
            throw new Error('RIBO_WILL resolve failed');
        }
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        opts.events.push({
            type: 'ribo_will_resolved',
            player: opts.playerKey,
            gained: Number(res.gained) || 0,
            repaymentAmount: Number(res.repaymentAmount) || 0,
            remainingOwnerTurns: Number(res.remainingOwnerTurns) || 0
        });
    }

    if (pendingType === 'EQUALITY_WILL') {
        const res = (typeof opts.CardLogic.resolveEqualityWillUsage === 'function')
            ? opts.CardLogic.resolveEqualityWillUsage(opts.cardState, opts.gameState, opts.playerKey)
            : null;
        if (!res || res.applied !== true) {
            throw new Error('EQUALITY_WILL resolve failed');
        }
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        opts.events.push({
            type: 'equality_will_resolved',
            player: res.player || opts.playerKey,
            opponent: res.opponent || (opts.playerKey === 'white' ? 'black' : 'white'),
            requestedAmount: Number(res.requestedAmount) || 0,
            stolenAmount: Number(res.stolenAmount) || 0,
            playerChargeBefore: Number(res.playerChargeBefore) || 0,
            playerChargeAfter: Number(res.playerChargeAfter) || 0,
            opponentChargeBefore: Number(res.opponentChargeBefore) || 0,
            opponentChargeAfter: Number(res.opponentChargeAfter) || 0
        });
    }

    if (pendingType === 'REINFORCEMENT_WILL') {
        const res = (typeof opts.CardLogic.resolveReinforcementWillUsage === 'function')
            ? opts.CardLogic.resolveReinforcementWillUsage(opts.cardState, opts.gameState, opts.playerKey, p)
            : null;
        if (!res || res.applied !== true) {
            throw new Error('REINFORCEMENT_WILL resolve failed');
        }
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        applySpawnedNumberCellGains(opts, res, { skipBoardCharge: true });
        applyImmediateFlipResolutionFollowups(opts, res, 'reinforcement_will_immediate');
        resetConsecutivePassesAfterBoardMutation(opts.gameState, res);
        opts.events.push({
            type: 'reinforcement_will_resolved',
            player: opts.playerKey,
            requestedCount: Number(res.requestedCount) || 0,
            spawnedCount: Number(res.spawnedCount) || 0,
            spawned: Array.isArray(res.spawned) ? res.spawned.slice() : [],
            flippedCount: Number(res.flippedCount) || 0,
            flipped: Array.isArray(res.flipped) ? res.flipped.slice() : []
        });
    }

    if (pendingType === 'SUPPORT_TROOPS_WILL') {
        const res = (typeof opts.CardLogic.resolveSupportTroopsWillUsage === 'function')
            ? opts.CardLogic.resolveSupportTroopsWillUsage(opts.cardState, opts.gameState, opts.playerKey, p)
            : null;
        if (!res || res.applied !== true) {
            throw new Error('SUPPORT_TROOPS_WILL resolve failed');
        }
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        applySpawnedNumberCellGains(opts, res, { skipBoardCharge: true });
        applyImmediateFlipResolutionFollowups(opts, res, 'support_troops_will_immediate');
        resetConsecutivePassesAfterBoardMutation(opts.gameState, res);
        opts.events.push({
            type: 'support_troops_will_resolved',
            player: opts.playerKey,
            requestedCount: Number(res.requestedCount) || 0,
            spawnedCount: Number(res.spawnedCount) || 0,
            spawned: Array.isArray(res.spawned) ? res.spawned.slice() : [],
            flippedCount: Number(res.flippedCount) || 0,
            flipped: Array.isArray(res.flipped) ? res.flipped.slice() : []
        });
    }

    if (pendingType === 'TIME_STOP_GOD') {
        const res = (typeof opts.CardLogic.resolveTimeStopGodUsage === 'function')
            ? opts.CardLogic.resolveTimeStopGodUsage(opts.cardState, opts.gameState, opts.playerKey, p)
            : { applied: false, destroyed: [], destroyedCount: 0, requestedCount: 3 };
        opts.events.push({
            type: 'time_stop_god_cost_resolved',
            player: opts.playerKey,
            destroyed: Array.isArray(res && res.destroyed) ? res.destroyed.slice() : [],
            destroyedCount: Number(res && res.destroyedCount) || 0,
            requestedCount: Number(res && res.requestedCount) || 0
        });
    }

    if (pendingType === 'TIME_STOP_DEITY') {
        const res = (typeof opts.CardLogic.resolveTimeStopDeityUsage === 'function')
            ? opts.CardLogic.resolveTimeStopDeityUsage(opts.cardState, opts.gameState, opts.playerKey, p)
            : { applied: false, destroyed: [], destroyedCount: 0, requestedCount: 9 };
        opts.events.push({
            type: 'time_stop_deity_cost_resolved',
            player: opts.playerKey,
            destroyed: Array.isArray(res && res.destroyed) ? res.destroyed.slice() : [],
            destroyedCount: Number(res && res.destroyedCount) || 0,
            requestedCount: Number(res && res.requestedCount) || 0
        });
    }

    if (pendingType === 'REBUILD_WILL') {
        const clearResult = (typeof opts.CardLogic.clearHandToDiscard === 'function')
            ? opts.CardLogic.clearHandToDiscard(opts.cardState, opts.playerKey)
            : { destroyedCards: [] };
        const destroyedCards = Array.isArray(clearResult && clearResult.destroyedCards)
            ? clearResult.destroyedCards
            : [];
        const destroyedCount = destroyedCards.length;

        if (typeof opts.CardLogic.emitPresentationEvent === 'function') {
            opts.CardLogic.emitPresentationEvent(opts.cardState, {
                type: 'HAND_CLEAR',
                player: opts.playerKey,
                count: destroyedCount,
                reason: 'rebuild_will'
            });
        }

        let drawnCount = 0;
        if (typeof opts.CardLogic.commitDraw === 'function') {
            for (let index = 0; index < 3; index += 1) {
                const drawnCardId = opts.CardLogic.commitDraw(opts.cardState, opts.playerKey, p);
                if (!drawnCardId) break;
                drawnCount += 1;
                if (typeof opts.CardLogic.emitPresentationEvent === 'function') {
                    opts.CardLogic.emitPresentationEvent(opts.cardState, {
                        type: 'DRAW_CARD',
                        player: opts.playerKey,
                        cardId: drawnCardId,
                        count: 1
                    });
                }
            }
        }

        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        opts.events.push({ type: 'rebuild_will_resolved', player: opts.playerKey, destroyedCount, drawnCount });
    }

    if (pendingType === 'REVEAL_HAND_WILL') {
        const res = (typeof opts.CardLogic.applyRevealHandWill === 'function')
            ? opts.CardLogic.applyRevealHandWill(opts.cardState, opts.playerKey)
            : { applied: false, reason: 'missing_logic', revealedCount: 0 };
        if (!res || res.applied !== true) {
            throw new Error(`REVEAL_HAND_WILL resolve failed: ${res && res.reason ? res.reason : 'unknown'}`);
        }
        opts.events.push({
            type: 'reveal_hand_will_resolved',
            player: opts.playerKey,
            opponent: res.opponentKey || (opts.playerKey === 'black' ? 'white' : 'black'),
            revealedCount: Number(res.revealedCount) || 0
        });
    }

    if (pendingType === 'EXECUTION_WILL') {
        const res = (typeof opts.CardLogic.applyExecutionWill === 'function')
            ? opts.CardLogic.applyExecutionWill(opts.cardState, opts.playerKey, p)
            : { applied: false, reason: 'missing_logic', destroyedCount: 0, destroyedCardIds: [] };
        if (!res || res.applied !== true) {
            throw new Error(`EXECUTION_WILL resolve failed: ${res && res.reason ? res.reason : 'unknown'}`);
        }
        const opponentKey = res.opponentKey || (opts.playerKey === 'black' ? 'white' : 'black');
        const destroyedCardIds = Array.isArray(res.destroyedCardIds) ? res.destroyedCardIds.slice() : [];
        const destroyedCount = Number(res.destroyedCount) || destroyedCardIds.length;
        opts.emitHandRemovePresentation(opts.CardLogic, opts.cardState, {
            player: opponentKey,
            count: destroyedCount,
            reason: 'execution_will',
            cardId: destroyedCount === 1 ? destroyedCardIds[0] : null,
            cardIds: destroyedCardIds
        });
        opts.events.push({
            type: 'execution_will_resolved',
            player: opts.playerKey,
            opponent: opponentKey,
            requestedCount: Number(res.requestedCount) || destroyedCount,
            destroyedCount,
            destroyedCardIds
        });
    }

    if (pendingType === 'GLUTTONOUS_WILL') {
        const clearResult = (typeof opts.CardLogic.clearHandToDiscard === 'function')
            ? opts.CardLogic.clearHandToDiscard(opts.cardState, opts.playerKey)
            : { destroyedCards: [] };
        const destroyedCards = Array.isArray(clearResult && clearResult.destroyedCards)
            ? clearResult.destroyedCards
            : [];
        const destroyedCount = destroyedCards.length;

        if (typeof opts.CardLogic.emitPresentationEvent === 'function') {
            opts.CardLogic.emitPresentationEvent(opts.cardState, {
                type: 'HAND_CLEAR',
                player: opts.playerKey,
                count: destroyedCount,
                reason: 'gluttonous_will'
            });
        }

        opts.events.push({ type: 'gluttonous_will_hand_destroyed', player: opts.playerKey, destroyedCount });
    }

    if (pendingType === 'MASS_FREEZE_WILL') {
        const res = (typeof opts.CardLogic.applyMassFreezeWill === 'function')
            ? opts.CardLogic.applyMassFreezeWill(opts.cardState, opts.gameState, opts.playerKey)
            : { applied: false, frozenCount: 0, targets: [] };
        if (!res || res.applied !== true) {
            throw new Error('MASS_FREEZE_WILL resolve failed');
        }
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        opts.events.push({
            type: 'mass_freeze_will_resolved',
            player: opts.playerKey,
            frozenCount: Number(res.frozenCount) || 0,
            targets: Array.isArray(res.targets) ? res.targets.slice() : []
        });
    }

    if (pendingType === 'LOSS_WILL') {
        const res = (typeof opts.CardLogic.applyLossWill === 'function')
            ? opts.CardLogic.applyLossWill(opts.cardState, opts.gameState, opts.playerKey)
            : { applied: false, removedCount: 0 };
        if (!res || res.applied !== true) {
            throw new Error('LOSS_WILL resolve failed');
        }
        const clearResult = (typeof opts.CardLogic.clearHandToDiscard === 'function')
            ? opts.CardLogic.clearHandToDiscard(opts.cardState, opts.playerKey)
            : { destroyedCards: [] };
        const destroyedCards = Array.isArray(clearResult && clearResult.destroyedCards)
            ? clearResult.destroyedCards
            : [];
        const destroyedCount = destroyedCards.length;

        if (typeof opts.CardLogic.emitPresentationEvent === 'function') {
            opts.CardLogic.emitPresentationEvent(opts.cardState, {
                type: 'HAND_CLEAR',
                player: opts.playerKey,
                count: destroyedCount,
                reason: 'loss_will'
            });
        }

        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        opts.events.push({ type: 'loss_will_resolved', player: opts.playerKey, removedCount: Number(res.removedCount) || 0 });
        opts.events.push({ type: 'loss_will_hand_destroyed', player: opts.playerKey, destroyedCount });
    }

    if (pendingType === 'SALVATION_WILL') {
        const res = (typeof opts.CardLogic.applySalvationWill === 'function')
            ? opts.CardLogic.applySalvationWill(opts.cardState, opts.gameState, opts.playerKey, p)
            : { applied: false, spawned: [], requestedCount: 0, spawnedCount: 0 };
        if (!res || res.applied !== true) {
            throw new Error('SALVATION_WILL resolve failed');
        }
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        applyImmediateFlipResolutionFollowups(opts, res, 'salvation_will_immediate');
        resetConsecutivePassesAfterBoardMutation(opts.gameState, res);
        opts.events.push({
            type: 'salvation_will_resolved',
            player: opts.playerKey,
            spawned: Array.isArray(res.spawned) ? res.spawned.slice() : [],
            requestedCount: Number(res.requestedCount) || 0,
            spawnedCount: Number(res.spawnedCount) || 0,
            flippedCount: Number(res.flippedCount) || 0,
            flipped: Array.isArray(res.flipped) ? res.flipped.slice() : []
        });
    }

    if (pendingType === 'FATE_WILL') {
        const res = (typeof opts.CardLogic.applyFateWill === 'function')
            ? opts.CardLogic.applyFateWill(opts.cardState, opts.playerKey)
            : { applied: false, reason: 'not_implemented' };
        if (!res || res.applied !== true) {
            throw new Error('FATE_WILL resolve failed');
        }
        opts.clearPendingForActionPhase(opts.cardState, opts.playerKey);
        opts.events.push({
            type: 'fate_will_resolved',
            player: opts.playerKey,
            opponentKey: res.turnOwnerKey,
            stacked: !!res.stacked,
            controllerKey: res.controllerKey
        });
    }
}

const CardUsageImmediateEffectsModule = {
    resolveImmediateCardUsageEffects
};

export = CardUsageImmediateEffectsModule;
