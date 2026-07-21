type RandomSource = { random(): number };

type ImmediateEffectContext = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    row: number;
    col: number;
    typeKey: string;
    randomSource: RandomSource | null | undefined;
    source?: 'placement' | 'theory_spawn';
    awardBoardChargeGain?: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
};

function requireRandomSource(source: any): RandomSource {
    if (source && typeof source.random === 'function') return source;
    throw new Error('ImmediateEffectDispatcher requires an injected deterministic PRNG.');
}

function normalizeTypeKey(value: any): string {
    return String(value || '').trim().toUpperCase();
}

function pushDetailsEvent(events: any[], type: string, details: any): void {
    if (!Array.isArray(events) || !Array.isArray(details) || details.length <= 0) return;
    events.push({ type, details });
}

function awardCharge(ctx: ImmediateEffectContext, amount: any, payload: any): void {
    if (typeof ctx.awardBoardChargeGain !== 'function') return;
    ctx.awardBoardChargeGain(ctx.CardLogic, ctx.cardState, ctx.playerKey, amount, payload);
}

function buildImmediateOptions(randomSource: RandomSource, extra: any = {}): any {
    return Object.assign({
        decrementRemainingOwnerTurns: false,
        random: randomSource,
        randomSource
    }, extra || {});
}

function pushOwnershipChangeReactionEvents(ctx: ImmediateEffectContext, flips: any[], sourceType: string): void {
    if (!Array.isArray(flips) || !flips.length || typeof ctx.CardLogic.applyPostFlipRevives !== 'function') return;
    const reaction = ctx.CardLogic.applyPostFlipRevives(ctx.cardState, ctx.gameState, flips, ctx.playerKey);
    const regenRes = reaction && reaction.regenRes;
    const livingWillRes = reaction && reaction.livingWillRes;
    if (regenRes && Array.isArray(regenRes.regened) && regenRes.regened.length) {
        ctx.events.push({ type: 'regen_triggered', details: regenRes.regened });
    }
    if (regenRes && Array.isArray(regenRes.captureFlips) && regenRes.captureFlips.length) {
        const firstCapture = regenRes.captureFlips[0] || {};
        awardCharge(ctx, regenRes.captureFlips.length, {
            targetRow: firstCapture.row,
            targetCol: firstCapture.col,
            sourceType: `${sourceType}_regen_capture`
        });
        ctx.events.push({ type: 'regen_capture_flipped', details: regenRes.captureFlips });
    }
    if (livingWillRes && Array.isArray(livingWillRes.restored) && livingWillRes.restored.length) {
        ctx.events.push({ type: 'living_will_triggered', details: livingWillRes.restored });
    }
}

function resolveImmediateEffects(context: ImmediateEffectContext): void {
    const ctx = (context && typeof context === 'object') ? context : ({} as ImmediateEffectContext);
    const row = Number(ctx.row);
    const col = Number(ctx.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    const typeKey = normalizeTypeKey(ctx.typeKey);
    if (!typeKey) return;
    const randomSource = requireRandomSource(ctx.randomSource);

    if (typeKey === 'DRAGON' && typeof ctx.CardLogic.processDragonEffectsAtAnchor === 'function') {
        const dragonNow = ctx.CardLogic.processDragonEffectsAtAnchor(ctx.cardState, ctx.gameState, ctx.playerKey, row, col, {
            randomSource
        });
        if (dragonNow && dragonNow.converted && dragonNow.converted.length) {
            awardCharge(ctx, dragonNow.converted.length, {
                anchorRow: row,
                anchorCol: col,
                moved: dragonNow.moved,
                sourceType: 'dragon_immediate'
            });
            ctx.events.push({ type: 'dragon_converted_immediate', details: dragonNow.converted });
            pushOwnershipChangeReactionEvents(ctx, dragonNow.converted, 'dragon_immediate');
        }
        return;
    }

    if (typeKey === 'BREEDING' && typeof ctx.CardLogic.processBreedingEffectsAtAnchor === 'function') {
        const breedingNow = ctx.CardLogic.processBreedingEffectsAtAnchor(ctx.cardState, ctx.gameState, ctx.playerKey, row, col, randomSource);
        pushDetailsEvent(ctx.events, 'breeding_spawned_immediate', breedingNow && breedingNow.spawned);
        if (breedingNow && breedingNow.flipped && breedingNow.flipped.length) {
            awardCharge(ctx, breedingNow.flipped.length, {
                anchorRow: row,
                anchorCol: col,
                sourceType: 'breeding_immediate'
            });
            ctx.events.push({ type: 'breeding_flipped_immediate', details: breedingNow.flipped });
        }
        return;
    }

    if (typeKey === 'ULTIMATE_DESTROY_GOD' && typeof ctx.CardLogic.processUltimateDestroyGodEffectsAtAnchor === 'function') {
        const udgNow = ctx.CardLogic.processUltimateDestroyGodEffectsAtAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'udg_destroyed_immediate', udgNow && udgNow.destroyed);
        return;
    }

    if (typeKey === 'DESTROY_DRAGON' && typeof ctx.CardLogic.processDestroyDragonEffectsAtAnchor === 'function') {
        const destroyDragonNow = ctx.CardLogic.processDestroyDragonEffectsAtAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'destroy_dragon_destroyed_immediate', destroyDragonNow && destroyDragonNow.destroyed);
        pushDetailsEvent(ctx.events, 'destroy_dragon_expired_immediate', destroyDragonNow && destroyDragonNow.expired);
        return;
    }

    if (typeKey === 'SNIPER' && typeof ctx.CardLogic.processSniperWillEffectsAtTurnStartAnchor === 'function') {
        const sniperNow = ctx.CardLogic.processSniperWillEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'sniper_destroyed_immediate', sniperNow && sniperNow.destroyed);
        pushDetailsEvent(ctx.events, 'sniper_expired_immediate', sniperNow && sniperNow.expired);
        return;
    }

    if (typeKey === 'LIGHTNING' && typeof ctx.CardLogic.processLightningWillEffectsAtTurnStartAnchor === 'function') {
        const lightningNow = ctx.CardLogic.processLightningWillEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'lightning_destroyed_immediate', lightningNow && lightningNow.destroyed);
        pushDetailsEvent(ctx.events, 'lightning_expired_immediate', lightningNow && lightningNow.expired);
        return;
    }

    if (typeKey === 'METEOR_GOD' && typeof ctx.CardLogic.processMeteorGodEffectsAtTurnStartAnchor === 'function') {
        const meteorGodNow = ctx.CardLogic.processMeteorGodEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'meteor_god_destroyed_immediate', meteorGodNow && meteorGodNow.destroyed);
        pushDetailsEvent(ctx.events, 'meteor_god_expired_immediate', meteorGodNow && meteorGodNow.expired);
        return;
    }

    if (typeKey === 'WILL_HUNTER_KING' && typeof ctx.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
        const willHunterKingNow = ctx.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(
            ctx.cardState,
            ctx.gameState,
            ctx.playerKey,
            row,
            col,
            buildImmediateOptions(randomSource)
        );
        pushDetailsEvent(ctx.events, 'will_hunter_king_destroyed_immediate', willHunterKingNow && willHunterKingNow.destroyed);
        pushDetailsEvent(ctx.events, 'will_hunter_king_moved_immediate', willHunterKingNow && willHunterKingNow.moved);
        pushDetailsEvent(ctx.events, 'will_hunter_king_expired_immediate', willHunterKingNow && willHunterKingNow.expired);
    }
}

export = {
    resolveImmediateEffects
};
