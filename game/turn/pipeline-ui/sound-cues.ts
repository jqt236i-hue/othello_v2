type SoundCuePlannerDeps = {
    soundEventType: string;
    cardEffectFlipSoundKey: string;
    ultimateAnchorMoveSoundKey: string;
    bombDestroyCauses: Set<string>;
    cardEffectSpawnProfiles: any[];
    phaseNum: (value: any) => number;
    clonePlaybackEventWithPhase: (event: any, phase: any) => any;
    maxPhase: (events: any) => number;
    findPhase: (events: any, predicate: any, fallbackPhase: any) => number;
    rawDetailCount: (event: any) => number;
    hasRawEvent: (events: any, type: any, predicate?: any) => boolean;
    isCardEffectSpawnEventLike: (event: any, profile: any) => boolean;
    isSeedSproutEventLike: (event: any) => boolean;
    isLivingWillRestoreEventLike: (event: any) => boolean;
    isCardEffectSpawnPlaybackEvent: (event: any, profile: any) => boolean;
    isDestroyWithCause: (target: any, causes: any) => boolean;
    isCardEffectFlipPresentationEvent: (event: any) => boolean;
    countCardEffectFlipFallbackEvents: (rawEvents: any) => number;
    isUltimateAnchorMoveTarget: (target: any) => boolean;
    isHyperactiveMoveTarget: (target: any) => boolean;
    isSpecialDurationExpiredPlaybackEvent: (event: any) => boolean;
    getMoveIntent: (target: any) => string;
    isSuperCrushMoveTarget: (target: any) => boolean;
    isBoardShrinkDestroyTarget: (target: any) => boolean;
    isWorkFlipOrDestroyRemovedPresentationEvent: (event: any) => boolean;
    isSniperShotDestroyTarget: (target: any) => boolean;
    isLightningDestroyTarget: (target: any) => boolean;
    isUltimateDestroyGodDestroyTarget: (target: any) => boolean;
    isDestroyDragonBreathDestroyTarget: (target: any) => boolean;
    isRobotVacuumSuckDestroyTarget: (target: any) => boolean;
    isGluttonousEatDestroyTarget: (target: any) => boolean;
    isWillHunterKingSlashDestroyTarget: (target: any) => boolean;
    isGoldSilverSelfDestroyEvent: (event: any) => boolean;
    isDestroyRemovalOutcome: (target: any) => boolean;
    isGenericDestroyPlaybackEvent: (event: any) => boolean;
};

function createSoundCuePlanningContext(playbackEvents: any, rawEvents: any, presentationEvents: any, deps: SoundCuePlannerDeps) {
    const base = Array.isArray(playbackEvents) ? playbackEvents.slice() : [];
    return {
        base,
        raw: Array.isArray(rawEvents) ? rawEvents : [],
        pres: Array.isArray(presentationEvents) ? presentationEvents : [],
        fallbackPhase: deps.maxPhase(base) + 1,
        added: [],
        seenSingleKeys: new Set()
    };
}

function pushSoundCue(ctx: any, soundKey: any, phase: any, sourceType: any, deps: SoundCuePlannerDeps, options: any = {}) {
    const key = String(soundKey || '').trim();
    const allowRepeat = !!(options && options.allowRepeat === true);
    if (!key) return;
    if (!allowRepeat) {
        if (ctx.seenSingleKeys.has(key)) return;
        ctx.seenSingleKeys.add(key);
    }
    ctx.added.push({
        type: deps.soundEventType,
        phase: deps.phaseNum(phase),
        targets: [{ soundKey: key }],
        meta: sourceType ? { sourceType } : null
    });
}

function tagCardUseAnimationPlaybackTarget(ctx: any, patch: any) {
    const anchorIndex = ctx.base.findIndex((ev: any) => ev && ev.type === 'card_use_animation');
    if (anchorIndex < 0) return false;
    const anchor = ctx.base[anchorIndex];
    const targets = Array.isArray(anchor.targets) ? anchor.targets.slice() : [];
    const firstTarget = targets[0] ? Object.assign({}, targets[0]) : {};
    targets[0] = Object.assign(firstTarget, patch || {});
    anchor.targets = targets;
    return true;
}

function appendPlaybackEventsIntoCardUseAnimationTarget(ctx: any, propertyName: any, playbackEvents: any, deps: SoundCuePlannerDeps) {
    const deferredEvents = Array.isArray(playbackEvents)
        ? playbackEvents
            .filter((ev: any) => !!ev)
            .map((ev: any) => deps.clonePlaybackEventWithPhase(ev, deps.phaseNum(ev && ev.phase)))
        : [];
    if (!deferredEvents.length) return false;
    const anchorIndex = ctx.base.findIndex((ev: any) => ev && ev.type === 'card_use_animation');
    if (anchorIndex < 0) return false;
    const anchor = ctx.base[anchorIndex];
    const targets = Array.isArray(anchor.targets) ? anchor.targets.slice() : [];
    const firstTarget = targets[0] ? Object.assign({}, targets[0]) : {};
    const existingEvents = Array.isArray(firstTarget[propertyName])
        ? firstTarget[propertyName]
            .filter((ev: any) => !!ev)
            .map((ev: any) => deps.clonePlaybackEventWithPhase(ev, deps.phaseNum(ev && ev.phase)))
        : [];
    firstTarget[propertyName] = existingEvents.concat(deferredEvents);
    targets[0] = firstTarget;
    anchor.targets = targets;
    return true;
}

function movePlaybackEventsIntoCardUseAnimationTarget(ctx: any, predicate: any, propertyName: any, deps: SoundCuePlannerDeps) {
    const deferredEvents = ctx.base.filter((ev: any) => !!ev && predicate(ev));
    if (!deferredEvents.length) return false;
    if (!appendPlaybackEventsIntoCardUseAnimationTarget(ctx, propertyName, deferredEvents, deps)) return false;
    for (let i = ctx.base.length - 1; i >= 0; i -= 1) {
        if (ctx.base[i] && predicate(ctx.base[i])) ctx.base.splice(i, 1);
    }
    return true;
}

function moveFirstPlaybackEventIntoCardUseAnimationTarget(ctx: any, sourceEvents: any, predicate: any, propertyName: any, deps: SoundCuePlannerDeps) {
    if (!Array.isArray(sourceEvents)) return false;
    const matchIndex = sourceEvents.findIndex((ev: any) => !!ev && predicate(ev));
    if (matchIndex < 0) return false;
    const matchedEvent = sourceEvents[matchIndex];
    if (!appendPlaybackEventsIntoCardUseAnimationTarget(ctx, propertyName, [matchedEvent], deps)) return false;
    sourceEvents.splice(matchIndex, 1);
    return true;
}

function collectUniquePhases(playbackEvents: any, predicate: any, deps: SoundCuePlannerDeps) {
    return Array.from(new Set(
        (Array.isArray(playbackEvents) ? playbackEvents : [])
            .filter((ev: any) => predicate(ev))
            .map((ev: any) => deps.phaseNum(ev && ev.phase))
            .filter((phase: any) => phase > 0)
    )).sort((a: any, b: any) => a - b);
}

function pushCueForPhases(ctx: any, phases: any, soundKey: any, sourceType: any, deps: SoundCuePlannerDeps) {
    for (const phase of phases) {
        pushSoundCue(ctx, soundKey, phase, sourceType, deps, { allowRepeat: true });
    }
}

function pushRepeatedCueForMatchingTargets(ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any, deps: SoundCuePlannerDeps) {
    for (const ev of Array.isArray(events) ? events : []) {
        const phase = deps.phaseNum(ev && ev.phase);
        const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
        const hitCount = targets.filter((target: any) => targetPredicate(target)).length;
        for (let i = 0; i < hitCount; i += 1) {
            pushSoundCue(ctx, soundKey, phase, sourceType, deps, { allowRepeat: true });
        }
    }
}

function pushCueForMatchingEventPhases(ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any, deps: SoundCuePlannerDeps) {
    const phases = collectUniquePhases(events, (ev: any) => (
        ev &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => targetPredicate(target))
    ), deps);
    pushCueForPhases(ctx, phases, soundKey, sourceType, deps);
}

function pushRepeatedCueForCardEffectSpawnProfiles(ctx: any, events: any, soundKey: any, deps: SoundCuePlannerDeps) {
    for (const profile of deps.cardEffectSpawnProfiles) {
        pushRepeatedCueForMatchingTargets(
            ctx,
            events,
            (target: any) => deps.isCardEffectSpawnEventLike(target, profile),
            soundKey,
            profile.soundSourceType,
            deps
        );
    }
}

function deferFirstCardEffectSpawnIntoDisappearPlayback(ctx: any, profile: any, soundKey: any, deps: SoundCuePlannerDeps) {
    if (!deps.hasRawEvent(ctx.raw, profile.rawResolvedType, (ev: any) => Number(ev && ev.spawnedCount) > 0)) {
        return;
    }
    const movedSpawn = moveFirstPlaybackEventIntoCardUseAnimationTarget(
        ctx,
        ctx.base,
        (ev: any) => deps.isCardEffectSpawnPlaybackEvent(ev, profile),
        'disappearPlaybackEvents',
        deps
    );
    if (!movedSpawn) return;
    moveFirstPlaybackEventIntoCardUseAnimationTarget(
        ctx,
        ctx.added,
        (ev: any) => ev &&
            ev.type === deps.soundEventType &&
            ev.meta &&
            ev.meta.sourceType === profile.soundSourceType &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => String(target && target.soundKey ? target.soundKey : '').trim() === String(soundKey || '').trim()),
        'disappearPlaybackEvents',
        deps
    );
}

function planCoreSoundCues(ctx: any, deps: SoundCuePlannerDeps) {
    const bombDestroyPhases = collectUniquePhases(
        ctx.base,
        (ev: any) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t: any) => deps.isDestroyWithCause(t, deps.bombDestroyCauses)),
        deps
    );
    if (bombDestroyPhases.length > 0) {
        pushCueForPhases(ctx, bombDestroyPhases, 'bomb_explode', 'bomb_destroy', deps);
    } else if (deps.hasRawEvent(ctx.raw, 'bombs_exploded', (ev: any) => !!(ev && ev.details))) {
        pushSoundCue(ctx, 'bomb_explode', ctx.fallbackPhase, 'bombs_exploded', deps);
    }

    const breedingPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'spawn' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            return cause === 'BREEDING' || reason.indexOf('breeding_spawn') === 0;
        }),
        ctx.fallbackPhase
    );
    if (
        deps.hasRawEvent(ctx.raw, 'breeding_spawned_start', (ev: any) => deps.rawDetailCount(ev) > 0) ||
        deps.hasRawEvent(ctx.raw, 'breeding_spawned_immediate', (ev: any) => deps.rawDetailCount(ev) > 0)
    ) {
        pushSoundCue(ctx, 'breeding_spawn', breedingPhase, 'breeding_spawned', deps);
    }
    pushRepeatedCueForCardEffectSpawnProfiles(
        ctx,
        ctx.base.filter((ev: any) => ev && ev.type === 'spawn'),
        'breeding_spawn',
        deps
    );

    const seedSproutEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'spawn' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isSeedSproutEventLike(target))
    ));
    if (seedSproutEvents.length > 0) {
        pushRepeatedCueForMatchingTargets(
            ctx,
            seedSproutEvents,
            (target: any) => deps.isSeedSproutEventLike(target),
            'seed_sprout',
            'seed_sprout',
            deps
        );
    }

    const livingWillRestoreEvents = ctx.base.filter((ev: any) => (
        ev &&
        (ev.type === 'spawn' || ev.type === 'flip') &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isLivingWillRestoreEventLike(target))
    ));
    if (livingWillRestoreEvents.length > 0) {
        pushRepeatedCueForMatchingTargets(
            ctx,
            livingWillRestoreEvents,
            (target: any) => deps.isLivingWillRestoreEventLike(target),
            'living_will_restored',
            'living_will_restored',
            deps
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
    const cardEffectFlipPhases = collectUniquePhases(
        ctx.base,
        (ev: any) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t: any) => shouldIncludeCardEffectFlipTarget(t)),
        deps
    );
    if (cardEffectFlipPhases.length > 0) {
        pushCueForPhases(ctx, cardEffectFlipPhases, deps.cardEffectFlipSoundKey, 'card_effect_flip', deps);
    } else {
        const cardEffectFlipFallbackCount = deps.countCardEffectFlipFallbackEvents(ctx.raw);
        for (let i = 0; i < cardEffectFlipFallbackCount; i += 1) {
            pushSoundCue(ctx, deps.cardEffectFlipSoundKey, ctx.fallbackPhase + i, 'card_effect_flip', deps, { allowRepeat: true });
        }
    }

    const ultimateAnchorMoveEvents = ctx.base.filter((ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => deps.isUltimateAnchorMoveTarget(t)));
    if (ultimateAnchorMoveEvents.length > 0) {
        pushRepeatedCueForMatchingTargets(
            ctx,
            ultimateAnchorMoveEvents,
            (target: any) => deps.isUltimateAnchorMoveTarget(target),
            deps.ultimateAnchorMoveSoundKey,
            'ultimate_anchor_moved',
            deps
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
            pushSoundCue(ctx, deps.ultimateAnchorMoveSoundKey, ctx.fallbackPhase + i, 'ultimate_anchor_moved', deps, { allowRepeat: true });
        }
    }

    const hyperactiveMoveEvents = ctx.base.filter((ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => deps.isHyperactiveMoveTarget(t)));
    if (hyperactiveMoveEvents.length > 0) {
        pushRepeatedCueForMatchingTargets(
            ctx,
            hyperactiveMoveEvents,
            (target: any) => deps.isHyperactiveMoveTarget(target),
            'hyperactive_move',
            'hyperactive_moved',
            deps
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
            pushSoundCue(ctx, 'hyperactive_move', ctx.fallbackPhase + i, 'hyperactive_moved', deps, { allowRepeat: true });
        }
    }

    const specialRevertedPhase = deps.findPhase(ctx.base, deps.isSpecialDurationExpiredPlaybackEvent, ctx.fallbackPhase);
    if (ctx.base.some(deps.isSpecialDurationExpiredPlaybackEvent)) {
        pushSoundCue(ctx, 'special_reverted', specialRevertedPhase, 'special_reverted', deps);
    }
}

function planSelectionSoundCues(ctx: any, deps: SoundCuePlannerDeps) {
    const trapSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TRAP',
        ctx.fallbackPhase
    );
    const timeBombSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'TIME_BOMB',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'trap_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'trap_select', trapSelectPhase, 'trap_selected', deps);
    }
    if (deps.hasRawEvent(ctx.raw, 'time_bomb_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'trap_select', timeBombSelectPhase, 'time_bomb_selected', deps);
    }

    const guardSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'GUARD',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'guard_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'guard_select', guardSelectPhase, 'guard_selected', deps);
    }

    const livingWillPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'LIVING_WILL',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'living_will_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'living_will_selected', livingWillPhase, 'living_will_selected', deps);
    }

    const hyperactiveInheritSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'INHERITED_HYPERACTIVE',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'hyperactive_inherit_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'guard_select', hyperactiveInheritSelectPhase, 'hyperactive_inherit_selected', deps);
    }

    const blockadeSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'BLOCKADE',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'blockade_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'blockade_select', blockadeSelectPhase, 'blockade_selected', deps);
    }

    const freezeSelectPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'FREEZE',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'freeze_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'freeze_select', freezeSelectPhase, 'freeze_selected', deps);
    }

    const trapTriggeredEvent = ctx.raw.find((ev: any) => ev && ev.type === 'trap_triggered' && deps.rawDetailCount(ev) > 0);
    const trapTriggeredDetail = trapTriggeredEvent && Array.isArray(trapTriggeredEvent.details)
        ? trapTriggeredEvent.details[0]
        : null;
    const trapTriggeredPhase = (trapTriggeredDetail && Number.isInteger(trapTriggeredDetail.row) && Number.isInteger(trapTriggeredDetail.col))
        ? deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t: any) => t && t.r === trapTriggeredDetail.row && t.col === trapTriggeredDetail.col),
            ctx.fallbackPhase
        )
        : ctx.fallbackPhase;
    if (trapTriggeredEvent) {
        pushSoundCue(ctx, 'trap_triggered', trapTriggeredPhase, 'trap_triggered', deps);
    }

    const strongWindPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            if (deps.getMoveIntent(t) === 'wind_move') return true;
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            return cause === 'STRONG_WIND_WILL' || reason.indexOf('strong_wind_move') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'strong_wind_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'strong_wind_move', strongWindPhase, 'strong_wind_selected', deps);
    }

    const positionSwapPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            if (deps.getMoveIntent(t) === 'position_swap') return true;
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            return cause === 'POSITION_SWAP_WILL' || reason.indexOf('position_swap') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'position_swap_selected', (ev: any) => !!(ev && ev.applied && ev.completed))) {
        pushSoundCue(ctx, 'position_swap_move', positionSwapPhase, 'position_swap_selected', deps);
    }

    const superBuoyancyPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            if (!deps.isSuperCrushMoveTarget(t)) return false;
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            return cause === 'BUOYANCY_WILL' || cause === 'SUPER_BUOYANCY_WILL';
        }),
        ctx.fallbackPhase
    );
    const hasBuoyancySelected = deps.hasRawEvent(ctx.raw, 'buoyancy_selected', (ev: any) => !!(ev && ev.applied));
    const hasSuperBuoyancySelected = deps.hasRawEvent(ctx.raw, 'super_buoyancy_selected', (ev: any) => !!(ev && ev.applied));
    if (hasBuoyancySelected || hasSuperBuoyancySelected) {
        pushSoundCue(ctx, 'super_buoyancy_move', superBuoyancyPhase, hasBuoyancySelected ? 'buoyancy_selected' : 'super_buoyancy_selected', deps);
    }

    const superGravityPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            if (!deps.isSuperCrushMoveTarget(t)) return false;
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            return cause === 'GRAVITY_WILL' || cause === 'SUPER_GRAVITY_WILL';
        }),
        ctx.fallbackPhase
    );
    const hasGravitySelected = deps.hasRawEvent(ctx.raw, 'gravity_selected', (ev: any) => !!(ev && ev.applied));
    const hasSuperGravitySelected = deps.hasRawEvent(ctx.raw, 'super_gravity_selected', (ev: any) => !!(ev && ev.applied));
    if (hasGravitySelected || hasSuperGravitySelected) {
        pushSoundCue(ctx, 'super_gravity_move', superGravityPhase, hasGravitySelected ? 'gravity_selected' : 'super_gravity_selected', deps);
    }

    const superAttractionPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            if (!deps.isSuperCrushMoveTarget(t)) return false;
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            return cause === 'SUPER_ATTRACTION_WILL';
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'super_attraction_selected', (ev: any) => !!(ev && ev.applied && ev.completed !== false))) {
        pushSoundCue(ctx, 'super_attraction_move', superAttractionPhase, 'super_attraction_selected', deps);
    }

    const teleportPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            if (deps.getMoveIntent(t) === 'teleport_move') return true;
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            return cause === 'TELEPORT_WILL' || reason.indexOf('teleport_move') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'teleport_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'teleport_select', teleportPhase, 'teleport_selected', deps);
    }

    const trapMisfirePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            return reason.indexOf('trap_disarmed') >= 0 || reason.indexOf('trap_expired') >= 0;
        }),
        ctx.fallbackPhase
    );
    if (
        deps.hasRawEvent(ctx.raw, 'trap_disarmed', (ev: any) => deps.rawDetailCount(ev) > 0) ||
        deps.hasRawEvent(ctx.raw, 'trap_expired', (ev: any) => deps.rawDetailCount(ev) > 0)
    ) {
        pushSoundCue(ctx, 'trap_misfire', trapMisfirePhase, 'trap_misfire', deps);
    }

    const clonePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'move' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            return !!(t && t.clone === true) || cause === 'CLONE_WILL' || cause === 'PROLIFERATION_WILL';
        }),
        ctx.fallbackPhase
    );
    if (
        deps.hasRawEvent(ctx.raw, 'clone_selected', (ev: any) => !!(ev && ev.applied)) ||
        ctx.pres.some((ev: any) => (
            ev &&
            ev.type === 'SPAWN' &&
            String(ev.cause || '').toUpperCase() === 'PROLIFERATION_WILL' &&
            String(ev.reason || '').toLowerCase().indexOf('proliferation_spawn') === 0
        ))
    ) {
        pushSoundCue(ctx, 'clone_spawn', clonePhase, 'clone_selected', deps);
    }

    const extendLifePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() !== 'TRAP',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'extend_life_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'extend_life', extendLifePhase, 'extend_life_selected', deps);
    }

    const corrosionPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'card_use_animation',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'corrosion_will_resolved', (ev: any) => Number(ev && ev.affectedCount) > 0)) {
        pushSoundCue(ctx, 'corrosion_tick', corrosionPhase, 'corrosion_will_resolved', deps);
    }

    const temptPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'flip' && Array.isArray(ev.targets) && ev.targets.some((t: any) => {
            const cause = String(t && t.cause ? t.cause : '').toUpperCase();
            const reason = String(t && t.reason ? t.reason : '').toLowerCase();
            return cause === 'TEMPT_WILL' || reason.indexOf('tempt_applied') === 0;
        }),
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'tempt_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'tempt_select', temptPhase, 'tempt_selected', deps);
    }

    const capturePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'capture_to_hand_animation',
        ctx.fallbackPhase
    );
    if (deps.hasRawEvent(ctx.raw, 'capture_selected', (ev: any) => !!(ev && ev.applied))) {
        pushSoundCue(ctx, 'tempt_select', capturePhase, 'capture_selected', deps);
    }

    const hasBoardShrinkDestroyPlayback = ctx.base.some((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isBoardShrinkDestroyTarget(target))
    ));
    const boardShrinkPhase = deps.findPhase(
        ctx.base,
        (ev: any) => (
            ev &&
            ev.type === 'status_applied' &&
            (
                (ev.meta && String(ev.meta.special || '').toUpperCase() === 'METEOR_HOLE') ||
                (Array.isArray(ev.targets) && ev.targets.some((target: any) => (
                    target &&
                    target.after &&
                    String(target.after.special || '').toUpperCase() === 'METEOR_HOLE'
                )))
            )
        ),
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        )
    );
    if (
        !hasBoardShrinkDestroyPlayback &&
        deps.hasRawEvent(ctx.raw, 'board_shrink_selected', (ev: any) => !!(
            ev &&
            ev.applied &&
            ev.completed !== false &&
            Array.isArray(ev.changedTargets) &&
            ev.changedTargets.length > 0
        ))
    ) {
        pushSoundCue(ctx, 'board_shrink_selected', boardShrinkPhase, 'board_shrink_selected', deps);
    }
}

function planCardAndEconomySoundCues(ctx: any, deps: SoundCuePlannerDeps) {
    const cardUseAnimationPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'card_use_animation',
        0
    );
    const postCardUsePhase = cardUseAnimationPhase > 0 ? (cardUseAnimationPhase + 1) : ctx.fallbackPhase;
    const hasCardUse = (
        ctx.pres.some((ev: any) => !!ev && ev.type === 'CARD_USED') ||
        deps.hasRawEvent(ctx.raw, 'card_used')
    );
    const hasTreasureGain = deps.hasRawEvent(ctx.raw, 'treasure_box_gain', (ev: any) => Number(ev && ev.gained) > 0);
    if (hasCardUse && cardUseAnimationPhase > 0) {
        pushSoundCue(ctx, 'card_use_button', cardUseAnimationPhase, 'card_used', deps);
    }
    if (hasTreasureGain) {
        pushSoundCue(ctx, 'treasure_gain', postCardUsePhase, 'treasure_box_gain', deps);
    }

    const roundBonusBannerPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'round_bonus_banner',
        ctx.fallbackPhase
    );
    const hasRoundBonusBanner = ctx.pres.some((ev: any) => (
        ev &&
        ev.type === 'ROUND_BONUS_BANNER' &&
        Number(ev.amount) > 0
    ));
    if (hasRoundBonusBanner) {
        pushSoundCue(ctx, 'round_bonus', roundBonusBannerPhase, 'round_bonus', deps);
    }

    if (deps.hasRawEvent(ctx.raw, 'loss_will_resolved', (ev: any) => Number(ev && ev.removedCount) > 0)) {
        tagCardUseAnimationPlaybackTarget(ctx, { disappearSoundKey: 'loss_will_reset' });
        movePlaybackEventsIntoCardUseAnimationTarget(
            ctx,
            (ev: any) => ev && ev.type === 'status_removed' && ev.meta && ev.meta.reason === 'loss_will_reset',
            'disappearPlaybackEvents',
            deps
        );
    }
    for (const profile of deps.cardEffectSpawnProfiles) {
        deferFirstCardEffectSpawnIntoDisappearPlayback(ctx, profile, 'breeding_spawn', deps);
    }

    const strongWillPromotedPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.type === 'status_applied' && ev.meta && ev.meta.reason === 'strong_will_promoted',
        ctx.fallbackPhase
    );
    const hasStrongWillPromotion = ctx.pres.some((ev: any) => (
        ev &&
        ev.type === 'STATUS_APPLIED' &&
        String(ev.reason || (ev.meta && ev.meta.reason) || '').toLowerCase() === 'strong_will_promoted'
    ));
    if (hasStrongWillPromotion) {
        pushSoundCue(ctx, 'strong_will_promoted', strongWillPromotedPhase, 'strong_will_promoted', deps);
    }

    const condemnPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev &&
            ev.type === 'hand_remove' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => String(target && target.reason ? target.reason : '').toLowerCase() === 'condemn_will'),
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        )
    );
    if (deps.hasRawEvent(ctx.raw, 'condemn_selected', (ev: any) => !!(ev && ev.applied && ev.destroyedCardId))) {
        pushSoundCue(ctx, 'stone_destroy', condemnPhase, 'condemn_selected', deps);
    }

    const executionPhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev &&
            ev.type === 'hand_remove' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => String(target && target.reason ? target.reason : '').toLowerCase() === 'execution_will'),
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'card_use_animation',
            ctx.fallbackPhase
        )
    );
    if (deps.hasRawEvent(ctx.raw, 'execution_will_resolved', (ev: any) => Number(ev && ev.destroyedCount) > 0)) {
        pushSoundCue(ctx, 'stone_destroy', executionPhase, 'execution_will_resolved', deps);
    }

    const workIncomePhase = deps.findPhase(
        ctx.base,
        (ev: any) => ev && ev.rawType === 'WORK_INCOME',
        deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.type === 'status_applied' && ev.meta && String(ev.meta.special || '').toUpperCase() === 'WORK',
            ctx.fallbackPhase
        )
    );
    const hasWorkIncome16 = ctx.pres.some((ev: any) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) === 16);
    const hasWorkIncome = ctx.pres.some((ev: any) => ev && ev.type === 'WORK_INCOME' && Number(ev.gained) > 0);
    if (hasWorkIncome16) {
        pushSoundCue(ctx, 'work_income_16', workIncomePhase, 'work_income', deps);
    } else if (hasWorkIncome && !hasTreasureGain) {
        pushSoundCue(ctx, 'charge_gain_common', workIncomePhase, 'work_income', deps);
    }

    const workRemovedEvents = ctx.pres.filter((ev: any) => deps.isWorkFlipOrDestroyRemovedPresentationEvent(ev));
    if (workRemovedEvents.length > 0) {
        const workRemovedPlaybackEvents = ctx.base.filter((ev: any) => ev && ev.rawType === 'WORK_REMOVED');
        const workRemovedFallbackPhase = deps.findPhase(
            ctx.base,
            (ev: any) => ev && ev.rawType === 'WORK_REMOVED',
            ctx.fallbackPhase
        );
        for (let i = 0; i < workRemovedEvents.length; i += 1) {
            const playbackEv = workRemovedPlaybackEvents[i];
            const phase = playbackEv ? deps.phaseNum(playbackEv.phase) : workRemovedFallbackPhase;
            pushSoundCue(ctx, 'work_removed', phase, 'work_removed', deps, { allowRepeat: true });
        }
    }
}

function planDestroySoundCues(ctx: any, deps: SoundCuePlannerDeps) {
    const sniperDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((t: any) => deps.isSniperShotDestroyTarget(t))
    ));
    if (sniperDestroyEvents.length > 0) {
        pushRepeatedCueForMatchingTargets(
            ctx,
            sniperDestroyEvents,
            (target: any) => deps.isSniperShotDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'sniper_shot',
            deps
        );
    }

    const lightningDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((t: any) => deps.isLightningDestroyTarget(t))
    ));
    if (lightningDestroyEvents.length > 0) {
        pushRepeatedCueForMatchingTargets(
            ctx,
            lightningDestroyEvents,
            (target: any) => deps.isLightningDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'lightning_destroyed',
            deps
        );
    }

    const ultimateDestroyGodDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((t: any) => deps.isUltimateDestroyGodDestroyTarget(t))
    ));
    if (ultimateDestroyGodDestroyEvents.length > 0) {
        pushCueForMatchingEventPhases(
            ctx,
            ultimateDestroyGodDestroyEvents,
            (target: any) => deps.isUltimateDestroyGodDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'udg_destroyed',
            deps
        );
    }

    const destroyDragonDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((t: any) => deps.isDestroyDragonBreathDestroyTarget(t))
    ));
    if (destroyDragonDestroyEvents.length > 0) {
        pushCueForMatchingEventPhases(
            ctx,
            destroyDragonDestroyEvents,
            (target: any) => deps.isDestroyDragonBreathDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'destroy_dragon_breath',
            deps
        );
    }

    const robotVacuumSuckPhases = collectUniquePhases(
        ctx.base,
        (ev: any) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((t: any) => deps.isRobotVacuumSuckDestroyTarget(t)),
        deps
    );
    pushCueForPhases(ctx, robotVacuumSuckPhases, 'robot_vacuum_suck', 'robot_vacuum_suck', deps);

    const gluttonousDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((t: any) => deps.isGluttonousEatDestroyTarget(t))
    ));
    if (gluttonousDestroyEvents.length > 0) {
        pushCueForMatchingEventPhases(
            ctx,
            gluttonousDestroyEvents,
            (target: any) => deps.isGluttonousEatDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'gluttonous_eat',
            deps
        );
    }

    const willHunterKingDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((t: any) => deps.isWillHunterKingSlashDestroyTarget(t))
    ));
    if (willHunterKingDestroyEvents.length > 0) {
        pushCueForMatchingEventPhases(
            ctx,
            willHunterKingDestroyEvents,
            (target: any) => deps.isWillHunterKingSlashDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'will_hunter_king_slash',
            deps
        );
    }

    const goldSilverSelfDestroyPhases = collectUniquePhases(ctx.base, (ev: any) => deps.isGoldSilverSelfDestroyEvent(ev), deps);
    pushCueForPhases(ctx, goldSilverSelfDestroyPhases, 'charge_gain_common', 'gold_silver_self_destroy', deps);

    const boardShrinkDestroyPhases = collectUniquePhases(
        ctx.base,
        (ev: any) => ev &&
            ev.type === 'destroy' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((t: any) => deps.isBoardShrinkDestroyTarget(t) && deps.isDestroyRemovalOutcome(t)),
        deps
    );
    pushCueForPhases(ctx, boardShrinkDestroyPhases, 'board_shrink_selected', 'board_shrink_selected', deps);

    if (ctx.base.some(deps.isGenericDestroyPlaybackEvent)) {
        const genericDestroyPhase = deps.findPhase(ctx.base, deps.isGenericDestroyPlaybackEvent, ctx.fallbackPhase);
        pushSoundCue(ctx, 'stone_destroy', genericDestroyPhase, 'destroy', deps);
    }
}

function appendSoundEffectPlaybackEvents(playbackEvents: any, rawEvents: any, presentationEvents: any, deps: SoundCuePlannerDeps) {
    const ctx = createSoundCuePlanningContext(playbackEvents, rawEvents, presentationEvents, deps);
    if (!ctx.raw.length && !ctx.base.length) return ctx.base;
    planCoreSoundCues(ctx, deps);
    planSelectionSoundCues(ctx, deps);
    planCardAndEconomySoundCues(ctx, deps);
    planDestroySoundCues(ctx, deps);
    ctx.added.sort((a: any, b: any) => deps.phaseNum(a.phase) - deps.phaseNum(b.phase));
    return ctx.base.concat(ctx.added);
}

const PipelineUISoundCuesModule = {
    appendSoundEffectPlaybackEvents
};

export = PipelineUISoundCuesModule;
