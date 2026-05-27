type ResolvePlacementImmediateEffectsOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    action: any;
    events: any[];
    effects: any;
    prng: any;
    othelloMode: boolean;
    boardBonusGained: number;
    flipCount: number;
    awardBoardChargeGain: (CardLogic: any, cardState: any, playerKey: any, amount: any, options: any) => void;
    applyPostFlipRevives: (CardLogic: any, cardState: any, gameState: any, flips: any, ownerKey: any) => any;
    buildPlacementChargeBubblePayload: (playerKey: any, row: any, col: any, flipCount: number, boardBonusGained: number, effects: any) => any;
    emitBoardChargeBubblePresentation: (CardLogic: any, cardState: any, payload: any) => void;
    emitSpecialStonePlacementBubbleFromEffects: (CardLogic: any, cardState: any, playerKey: any, row: any, col: any, effects: any, prng: any) => void;
    emitObserverBubblePresentation: (CardLogic: any, cardState: any, payload: any) => void;
    emitWorkBubblePresentation: (CardLogic: any, cardState: any, payload: any) => void;
    pickRandomLine: (lines: any, prng: any) => any;
    observerPlaceLines: any[];
    workPlaceLines: any[];
    pushTrapEvents: (events: any[], trapRes: any) => void;
    emitTrapHandRemoveEvents: (CardLogic: any, cardState: any, trapRes: any) => void;
    debugLog: (...args: any[]) => void;
};

function applyInstantHyperactiveFollowups(options: ResolvePlacementImmediateEffectsOptions, instantHyper: any): void {
    if (!(instantHyper && instantHyper.flipped && instantHyper.flipped.length)) {
        return;
    }
    const reviveRes = options.applyPostFlipRevives(
        options.CardLogic,
        options.cardState,
        options.gameState,
        instantHyper.flipped,
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
}

function resolvePlacementImmediateEffects(options: ResolvePlacementImmediateEffectsOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolvePlacementImmediateEffectsOptions);
    const action = opts.action || {};
    const effects = opts.effects || null;
    const p = opts.prng || undefined;

    if (!opts.othelloMode) {
        const placementChargeBubble = opts.buildPlacementChargeBubblePayload(
            opts.playerKey,
            action.row,
            action.col,
            opts.flipCount,
            opts.boardBonusGained,
            effects
        );
        if (placementChargeBubble) {
            opts.emitBoardChargeBubblePresentation(opts.CardLogic, opts.cardState, placementChargeBubble);
        }
        opts.emitSpecialStonePlacementBubbleFromEffects(
            opts.CardLogic,
            opts.cardState,
            opts.playerKey,
            action.row,
            action.col,
            effects,
            p
        );
    }

    if (effects && effects.dragonPlaced && typeof opts.CardLogic.processDragonEffectsAtAnchor === 'function') {
        const dragonNow = opts.CardLogic.processDragonEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col);
        if (dragonNow.converted && dragonNow.converted.length) {
            opts.awardBoardChargeGain(opts.CardLogic, opts.cardState, opts.playerKey, dragonNow.converted.length, {
                anchorRow: action.row,
                anchorCol: action.col,
                moved: dragonNow.moved,
                sourceType: 'dragon_immediate'
            });
            opts.events.push({ type: 'dragon_converted_immediate', details: dragonNow.converted });
        }
    }

    if (effects && effects.breedingPlaced && typeof opts.CardLogic.processBreedingEffectsAtAnchor === 'function') {
        const breedingNow = opts.CardLogic.processBreedingEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, p);
        if (breedingNow.spawned && breedingNow.spawned.length) {
            opts.events.push({ type: 'breeding_spawned_immediate', details: breedingNow.spawned });
        }
        if (breedingNow.flipped && breedingNow.flipped.length) {
            opts.awardBoardChargeGain(opts.CardLogic, opts.cardState, opts.playerKey, breedingNow.flipped.length, {
                anchorRow: action.row,
                anchorCol: action.col,
                sourceType: 'breeding_immediate'
            });
            opts.events.push({ type: 'breeding_flipped_immediate', details: breedingNow.flipped });
        }
    }

    if (effects && effects.ultimateDestroyGodPlaced && typeof opts.CardLogic.processUltimateDestroyGodEffectsAtAnchor === 'function') {
        const udgNow = opts.CardLogic.processUltimateDestroyGodEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, { decrementRemainingOwnerTurns: false });
        if (udgNow.destroyed && udgNow.destroyed.length) {
            opts.events.push({ type: 'udg_destroyed_immediate', details: udgNow.destroyed });
        }
    }

    if (effects && effects.destroyDragonPlaced && typeof opts.CardLogic.processDestroyDragonEffectsAtAnchor === 'function') {
        const destroyDragonNow = opts.CardLogic.processDestroyDragonEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        if (destroyDragonNow && destroyDragonNow.destroyed && destroyDragonNow.destroyed.length) {
            opts.events.push({ type: 'destroy_dragon_destroyed_immediate', details: destroyDragonNow.destroyed });
        }
        if (destroyDragonNow && destroyDragonNow.expired && destroyDragonNow.expired.length) {
            opts.events.push({ type: 'destroy_dragon_expired_immediate', details: destroyDragonNow.expired });
        }
    }

    if (effects && effects.sniperPlaced && typeof opts.CardLogic.processSniperWillEffectsAtTurnStartAnchor === 'function') {
        const sniperNow = opts.CardLogic.processSniperWillEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        if (sniperNow && sniperNow.destroyed && sniperNow.destroyed.length) {
            opts.events.push({ type: 'sniper_destroyed_immediate', details: sniperNow.destroyed });
        }
        if (sniperNow && sniperNow.expired && sniperNow.expired.length) {
            opts.events.push({ type: 'sniper_expired_immediate', details: sniperNow.expired });
        }
    }

    if (effects && effects.lightningPlaced && typeof opts.CardLogic.processLightningWillEffectsAtTurnStartAnchor === 'function') {
        const lightningNow = opts.CardLogic.processLightningWillEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        if (lightningNow && lightningNow.destroyed && lightningNow.destroyed.length) {
            opts.events.push({ type: 'lightning_destroyed_immediate', details: lightningNow.destroyed });
        }
        if (lightningNow && lightningNow.expired && lightningNow.expired.length) {
            opts.events.push({ type: 'lightning_expired_immediate', details: lightningNow.expired });
        }
    }

    if (effects && effects.willHunterKingPlaced && typeof opts.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
        const willHunterKingNow = opts.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        if (willHunterKingNow && willHunterKingNow.destroyed && willHunterKingNow.destroyed.length) {
            opts.events.push({ type: 'will_hunter_king_destroyed_immediate', details: willHunterKingNow.destroyed });
        }
        if (willHunterKingNow && willHunterKingNow.moved && willHunterKingNow.moved.length) {
            opts.events.push({ type: 'will_hunter_king_moved_immediate', details: willHunterKingNow.moved });
        }
        if (willHunterKingNow && willHunterKingNow.expired && willHunterKingNow.expired.length) {
            opts.events.push({ type: 'will_hunter_king_expired_immediate', details: willHunterKingNow.expired });
        }
    }

    if (effects && effects.observerPlaced) {
        const line = opts.pickRandomLine(opts.observerPlaceLines, p);
        if (line) {
            opts.emitObserverBubblePresentation(opts.CardLogic, opts.cardState, {
                player: opts.playerKey,
                row: action.row,
                col: action.col,
                text: line,
                reason: 'placed'
            });
        }
    }

    if (effects && effects.workPlaced) {
        const line = opts.pickRandomLine(opts.workPlaceLines, p);
        if (line) {
            opts.emitWorkBubblePresentation(opts.CardLogic, opts.cardState, {
                player: opts.playerKey,
                row: action.row,
                col: action.col,
                text: line,
                reason: 'placed'
            });
        }
    }

    if (effects && effects.hyperactivePlaced && !effects.instantHyperactivePlaced) {
        opts.debugLog('[TurnPipeline] hyperactivePlaced detected on placement — immediate activation suppressed by spec');
    }

    if (effects && effects.instantHyperactivePlaced && typeof opts.CardLogic.processInstantHyperactiveMoveAtAnchor === 'function') {
        const instantHyper = opts.CardLogic.processInstantHyperactiveMoveAtAnchor(opts.cardState, opts.gameState, opts.playerKey, action.row, action.col, p);
        if (instantHyper && instantHyper.moved && instantHyper.moved.length) {
            opts.events.push({ type: 'hyperactive_moved_immediate', details: instantHyper.moved });
        }
        if (instantHyper && instantHyper.flipped && instantHyper.flipped.length) {
            opts.events.push({ type: 'hyperactive_flipped_immediate', details: instantHyper.flipped });
            opts.awardBoardChargeGain(opts.CardLogic, opts.cardState, opts.playerKey, instantHyper.flipped.length, {
                anchorRow: action.row,
                anchorCol: action.col,
                moved: instantHyper.moved,
                sourceType: 'instant_hyperactive_immediate'
            });
        }
        if (instantHyper && instantHyper.destroyed && instantHyper.destroyed.length) {
            opts.events.push({ type: 'hyperactive_destroyed_immediate', details: instantHyper.destroyed });
        }
        if (instantHyper && instantHyper.flipped && instantHyper.flipped.length && typeof opts.CardLogic.applyRegenAfterFlips === 'function') {
            applyInstantHyperactiveFollowups(opts, instantHyper);
        }
    }

    if (effects && effects.ultimateHyperactivePlaced) {
        opts.debugLog('[TurnPipeline] ultimateHyperactivePlaced detected on placement — immediate activation suppressed by spec');
    }

    if (typeof opts.CardLogic.processTrapEffects === 'function') {
        const trapRes = opts.CardLogic.processTrapEffects(opts.cardState, opts.gameState, opts.playerKey, { expireOnOwnerTurnStart: false });
        opts.pushTrapEvents(opts.events, trapRes);
        opts.emitTrapHandRemoveEvents(opts.CardLogic, opts.cardState, trapRes);
    }
}

const ActionPhasePlacementImmediateEffectsModule = {
    resolvePlacementImmediateEffects
};

export = ActionPhasePlacementImmediateEffectsModule;
