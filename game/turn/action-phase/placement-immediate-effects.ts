const ImmediateEffectDispatcher = require('../immediate-effect-dispatcher');

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

    const immediateTypes = [
        effects && effects.dragonPlaced ? 'DRAGON' : null,
        effects && effects.breedingPlaced ? 'BREEDING' : null,
        effects && effects.ultimateDestroyGodPlaced ? 'ULTIMATE_DESTROY_GOD' : null,
        effects && effects.destroyDragonPlaced ? 'DESTROY_DRAGON' : null,
        effects && effects.sniperPlaced ? 'SNIPER' : null,
        effects && effects.lightningPlaced ? 'LIGHTNING' : null,
        effects && effects.firePlaced ? 'FIRE' : null,
        effects && effects.waterPlaced ? 'WATER' : null,
        effects && effects.grassPlaced ? 'GRASS' : null,
        effects && effects.meteorGodPlaced ? 'METEOR_GOD' : null,
        effects && effects.willHunterKingPlaced ? 'WILL_HUNTER_KING' : null
    ].filter(Boolean);

    for (const typeKey of immediateTypes) {
        ImmediateEffectDispatcher.resolveImmediateEffects({
            CardLogic: opts.CardLogic,
            cardState: opts.cardState,
            gameState: opts.gameState,
            playerKey: opts.playerKey,
            events: opts.events,
            row: action.row,
            col: action.col,
            typeKey,
            randomSource: p,
            source: 'placement',
            awardBoardChargeGain: opts.awardBoardChargeGain
        });
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
