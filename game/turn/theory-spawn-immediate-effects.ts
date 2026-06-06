type ResolveTheorySpawnImmediateEffectsOptions = {
    CardLogic: any;
    cardState: any;
    gameState: any;
    playerKey: any;
    events: any[];
    spawned: any;
    prng: any;
    awardBoardChargeGain?: (CardLogic: any, cardState: any, playerKey: any, amount: any, payload: any) => void;
};

function pushDetailsEvent(events: any[], type: string, details: any): void {
    if (!Array.isArray(events) || !Array.isArray(details) || details.length <= 0) return;
    events.push({ type, details });
}

function awardCharge(options: ResolveTheorySpawnImmediateEffectsOptions, amount: any, payload: any): void {
    if (typeof options.awardBoardChargeGain !== 'function') return;
    options.awardBoardChargeGain(options.CardLogic, options.cardState, options.playerKey, amount, payload);
}

function resolveTheorySpawnImmediateEffects(options: ResolveTheorySpawnImmediateEffectsOptions): void {
    const opts = (options && typeof options === 'object') ? options : ({} as ResolveTheorySpawnImmediateEffectsOptions);
    const spawned = opts.spawned || null;
    const row = Number(spawned && spawned.row);
    const col = Number(spawned && spawned.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return;
    const typeKey = String(spawned.type || '').trim().toUpperCase();
    const p = opts.prng || undefined;

    if (typeKey === 'DRAGON' && typeof opts.CardLogic.processDragonEffectsAtAnchor === 'function') {
        const dragonNow = opts.CardLogic.processDragonEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col);
        if (dragonNow && dragonNow.converted && dragonNow.converted.length) {
            awardCharge(opts, dragonNow.converted.length, {
                anchorRow: row,
                anchorCol: col,
                moved: dragonNow.moved,
                sourceType: 'dragon_immediate'
            });
            opts.events.push({ type: 'dragon_converted_immediate', details: dragonNow.converted });
        }
        return;
    }

    if (typeKey === 'BREEDING' && typeof opts.CardLogic.processBreedingEffectsAtAnchor === 'function') {
        const breedingNow = opts.CardLogic.processBreedingEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, p);
        pushDetailsEvent(opts.events, 'breeding_spawned_immediate', breedingNow && breedingNow.spawned);
        if (breedingNow && breedingNow.flipped && breedingNow.flipped.length) {
            awardCharge(opts, breedingNow.flipped.length, {
                anchorRow: row,
                anchorCol: col,
                sourceType: 'breeding_immediate'
            });
            opts.events.push({ type: 'breeding_flipped_immediate', details: breedingNow.flipped });
        }
        return;
    }

    if (typeKey === 'ULTIMATE_DESTROY_GOD' && typeof opts.CardLogic.processUltimateDestroyGodEffectsAtAnchor === 'function') {
        const udgNow = opts.CardLogic.processUltimateDestroyGodEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, {
            decrementRemainingOwnerTurns: false
        });
        pushDetailsEvent(opts.events, 'udg_destroyed_immediate', udgNow && udgNow.destroyed);
        return;
    }

    if (typeKey === 'DESTROY_DRAGON' && typeof opts.CardLogic.processDestroyDragonEffectsAtAnchor === 'function') {
        const destroyDragonNow = opts.CardLogic.processDestroyDragonEffectsAtAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        pushDetailsEvent(opts.events, 'destroy_dragon_destroyed_immediate', destroyDragonNow && destroyDragonNow.destroyed);
        pushDetailsEvent(opts.events, 'destroy_dragon_expired_immediate', destroyDragonNow && destroyDragonNow.expired);
        return;
    }

    if (typeKey === 'SNIPER' && typeof opts.CardLogic.processSniperWillEffectsAtTurnStartAnchor === 'function') {
        const sniperNow = opts.CardLogic.processSniperWillEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        pushDetailsEvent(opts.events, 'sniper_destroyed_immediate', sniperNow && sniperNow.destroyed);
        pushDetailsEvent(opts.events, 'sniper_expired_immediate', sniperNow && sniperNow.expired);
        return;
    }

    if (typeKey === 'LIGHTNING' && typeof opts.CardLogic.processLightningWillEffectsAtTurnStartAnchor === 'function') {
        const lightningNow = opts.CardLogic.processLightningWillEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        pushDetailsEvent(opts.events, 'lightning_destroyed_immediate', lightningNow && lightningNow.destroyed);
        pushDetailsEvent(opts.events, 'lightning_expired_immediate', lightningNow && lightningNow.expired);
        return;
    }

    if (typeKey === 'WILL_HUNTER_KING' && typeof opts.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor === 'function') {
        const willHunterKingNow = opts.CardLogic.processWillHunterKingEffectsAtTurnStartAnchor(opts.cardState, opts.gameState, opts.playerKey, row, col, {
            decrementRemainingOwnerTurns: false,
            random: p
        });
        pushDetailsEvent(opts.events, 'will_hunter_king_destroyed_immediate', willHunterKingNow && willHunterKingNow.destroyed);
        pushDetailsEvent(opts.events, 'will_hunter_king_moved_immediate', willHunterKingNow && willHunterKingNow.moved);
        pushDetailsEvent(opts.events, 'will_hunter_king_expired_immediate', willHunterKingNow && willHunterKingNow.expired);
    }
}

export = {
    resolveTheorySpawnImmediateEffects
};
