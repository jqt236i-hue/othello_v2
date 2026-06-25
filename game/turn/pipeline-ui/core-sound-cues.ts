type CoreSoundCueDeps = {
    bombDestroyCauses: Set<string>;
    cardEffectFlipSoundKey: string;
    ultimateAnchorMoveSoundKey: string;
    collectUniquePhases: (playbackEvents: any, predicate: any) => any[];
    countCardEffectFlipFallbackEvents: (rawEvents: any) => number;
    findPhase: (playbackEvents: any, predicate: any, fallbackPhase: any) => any;
    hasRawEvent: (rawEvents: any, type: any, predicate?: any) => boolean;
    isCardEffectFlipPresentationEvent: (target: any) => boolean;
    isDestroyWithCause: (target: any, causes: any) => boolean;
    isHyperactiveMoveTarget: (target: any) => boolean;
    isLivingWillRestoreEventLike: (target: any) => boolean;
    isSeedSproutEventLike: (target: any) => boolean;
    isSpecialDurationExpiredPlaybackEvent: (ev: any) => boolean;
    isUltimateAnchorMoveTarget: (target: any) => boolean;
    pushCueForPhases: (ctx: any, phases: any, soundKey: any, sourceType: any) => void;
    pushRepeatedCueForCardEffectSpawnProfiles: (ctx: any, events: any, soundKey: any) => void;
    pushRepeatedCueForMatchingTargets: (ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any) => void;
    pushSoundCue: (ctx: any, soundKey: any, phase: any, sourceType: any, options?: any) => void;
    rawDetailCount: (ev: any) => number;
};

function planCoreSoundCues(ctx: any, deps: CoreSoundCueDeps) {
    const isChaosSummonRouletteEvent = (ev: any) => {
        if (!ev || ev.type !== 'theory_incarnation_spawn_roulette') return false;
        const targets = Array.isArray(ev.targets) ? ev.targets : [];
        return targets.some((target: any) => (
            String(target && target.sourceCardType || '').toUpperCase() === 'CHAOS_SUMMON' ||
            String(target && (target.cause || target.spawnCause) || '').toUpperCase() === 'CHAOS_SUMMON' ||
            String(target && (target.reason || target.spawnReason) || '').toLowerCase() === 'chaos_summon_spawn'
        ));
    };

    const bombDestroyPhases = deps.collectUniquePhases(
        ctx.base,
        (ev: any) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((target: any) => deps.isDestroyWithCause(target, deps.bombDestroyCauses))
    );
    if (bombDestroyPhases.length > 0) {
        deps.pushCueForPhases(ctx, bombDestroyPhases, 'bomb_explode', 'bomb_destroy');
    } else if (deps.hasRawEvent(ctx.raw, 'bombs_exploded', (ev: any) => !!(ev && ev.details))) {
        deps.pushSoundCue(ctx, 'bomb_explode', ctx.fallbackPhase, 'bombs_exploded');
    }

    const breedingPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'spawn' && Array.isArray(ev.targets) && ev.targets.some((target: any) => {
            const cause = String(target && target.cause ? target.cause : '').toUpperCase();
            const reason = String(target && target.reason ? target.reason : '').toLowerCase();
            return cause === 'BREEDING' || reason.indexOf('breeding_spawn') === 0;
        }),
        ctx.fallbackPhase
    );
    if (
        deps.hasRawEvent(ctx.raw, 'breeding_spawned_start', (ev: any) => deps.rawDetailCount(ev) > 0) ||
        deps.hasRawEvent(ctx.raw, 'breeding_spawned_immediate', (ev: any) => deps.rawDetailCount(ev) > 0)
    ) {
        deps.pushSoundCue(ctx, 'breeding_spawn', breedingPhase, 'breeding_spawned');
    }
    deps.pushRepeatedCueForCardEffectSpawnProfiles(
        ctx,
        ctx.base.filter((ev: any) => ev && ev.type === 'spawn'),
        'breeding_spawn'
    );

    const chaosSummonSpawnPhases = deps.collectUniquePhases(
        ctx.base,
        isChaosSummonRouletteEvent
    );
    if (chaosSummonSpawnPhases.length > 0) {
        deps.pushCueForPhases(ctx, chaosSummonSpawnPhases, 'chaos_summon_spawn', 'chaos_summon_spawn');
    }

    const theoryIncarnationSpawnPhases = deps.collectUniquePhases(
        ctx.base,
        (ev: any) => ev && ev.type === 'theory_incarnation_spawn_roulette' && !isChaosSummonRouletteEvent(ev)
    );
    if (theoryIncarnationSpawnPhases.length > 0) {
        deps.pushCueForPhases(ctx, theoryIncarnationSpawnPhases, 'theory_incarnation_spawn', 'theory_incarnation_spawn');
    }

    const seedSproutEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'spawn' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isSeedSproutEventLike(target))
    ));
    if (seedSproutEvents.length > 0) {
        deps.pushRepeatedCueForMatchingTargets(
            ctx,
            seedSproutEvents,
            (target: any) => deps.isSeedSproutEventLike(target),
            'seed_sprout',
            'seed_sprout'
        );
    }

    const livingWillRestoreEvents = ctx.base.filter((ev: any) => (
        ev &&
        (ev.type === 'spawn' || ev.type === 'flip') &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isLivingWillRestoreEventLike(target))
    ));
    if (livingWillRestoreEvents.length > 0) {
        deps.pushRepeatedCueForMatchingTargets(
            ctx,
            livingWillRestoreEvents,
            (target: any) => deps.isLivingWillRestoreEventLike(target),
            'living_will_restored',
            'living_will_restored'
        );
    }

    const hasAppliedTemptSelection = deps.hasRawEvent(ctx.raw, 'tempt_selected', (ev: any) => !!(ev && ev.applied));
    const hasTemptSelectionEvent = deps.hasRawEvent(ctx.raw, 'tempt_selected');
    const hasAppliedSwapSelection = deps.hasRawEvent(ctx.raw, 'swap_selected', (ev: any) => !!(ev && ev.swapped));
    const hasSwapSelectionEvent = deps.hasRawEvent(ctx.raw, 'swap_selected');
    const shouldIncludeCardEffectFlipTarget = (target: any) => {
        if (!deps.isCardEffectFlipPresentationEvent(target)) return false;
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        if (reason.indexOf('tempt_applied') === 0) {
            return hasAppliedTemptSelection || !hasTemptSelectionEvent;
        }
        if (reason.indexOf('swap_with_enemy') === 0) {
            return hasAppliedSwapSelection || !hasSwapSelectionEvent;
        }
        return true;
    };
    const cardEffectFlipPhases = deps.collectUniquePhases(
        ctx.base,
        (ev: any) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((target: any) => shouldIncludeCardEffectFlipTarget(target))
    );
    if (cardEffectFlipPhases.length > 0) {
        deps.pushCueForPhases(ctx, cardEffectFlipPhases, deps.cardEffectFlipSoundKey, 'card_effect_flip');
    } else {
        const cardEffectFlipFallbackCount = deps.countCardEffectFlipFallbackEvents(ctx.raw);
        for (let i = 0; i < cardEffectFlipFallbackCount; i += 1) {
            deps.pushSoundCue(ctx, deps.cardEffectFlipSoundKey, ctx.fallbackPhase + i, 'card_effect_flip', { allowRepeat: true });
        }
    }

    const ultimateAnchorMoveEvents = ctx.base.filter((ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => deps.isUltimateAnchorMoveTarget(target)));
    if (ultimateAnchorMoveEvents.length > 0) {
        deps.pushRepeatedCueForMatchingTargets(
            ctx,
            ultimateAnchorMoveEvents,
            (target: any) => deps.isUltimateAnchorMoveTarget(target),
            deps.ultimateAnchorMoveSoundKey,
            'ultimate_anchor_moved'
        );
    } else {
        const fallbackMoveCount = ctx.raw.reduce((sum: any, ev: any) => {
            if (!ev || !ev.type) return sum;
            if (
                ev.type !== 'dragon_moved_start' &&
                ev.type !== 'dragon_moved_immediate' &&
                ev.type !== 'udg_moved_start' &&
                ev.type !== 'udg_moved_immediate' &&
                ev.type !== 'will_hunter_king_moved_start' &&
                ev.type !== 'will_hunter_king_moved_immediate'
            ) {
                return sum;
            }
            return sum + deps.rawDetailCount(ev);
        }, 0);
        for (let i = 0; i < fallbackMoveCount; i += 1) {
            deps.pushSoundCue(ctx, deps.ultimateAnchorMoveSoundKey, ctx.fallbackPhase + i, 'ultimate_anchor_moved', { allowRepeat: true });
        }
    }

    const hyperactiveMoveEvents = ctx.base.filter((ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((target: any) => deps.isHyperactiveMoveTarget(target)));
    if (hyperactiveMoveEvents.length > 0) {
        deps.pushRepeatedCueForMatchingTargets(
            ctx,
            hyperactiveMoveEvents,
            (target: any) => deps.isHyperactiveMoveTarget(target),
            'hyperactive_move',
            'hyperactive_moved'
        );
    } else {
        const fallbackMoveCount = ctx.raw.reduce((sum: any, ev: any) => {
            if (!ev || !ev.type) return sum;
            if (
                ev.type !== 'hyperactive_moved_start' &&
                ev.type !== 'hyperactive_moved_immediate' &&
                ev.type !== 'ultimate_hyperactive_moved_start' &&
                ev.type !== 'ultimate_hyperactive_moved_immediate' &&
                ev.type !== 'robot_vacuum_moved_start' &&
                ev.type !== 'robot_vacuum_moved_immediate'
            ) {
                return sum;
            }
            return sum + deps.rawDetailCount(ev);
        }, 0);
        for (let i = 0; i < fallbackMoveCount; i += 1) {
            deps.pushSoundCue(ctx, 'hyperactive_move', ctx.fallbackPhase + i, 'hyperactive_moved', { allowRepeat: true });
        }
    }

    const specialRevertedPhase = deps.findPhase(ctx.base, deps.isSpecialDurationExpiredPlaybackEvent, ctx.fallbackPhase);
    if (ctx.base.some((ev: any) => deps.isSpecialDurationExpiredPlaybackEvent(ev))) {
        deps.pushSoundCue(ctx, 'special_reverted', specialRevertedPhase, 'special_reverted');
    }
}

const PipelineUICoreSoundCuesModule = {
    planCoreSoundCues
};

export = PipelineUICoreSoundCuesModule;
