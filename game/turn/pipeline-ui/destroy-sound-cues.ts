type DestroySoundCueDeps = {
    bombDestroyCauses: Set<string>;
    collectUniquePhases: (playbackEvents: any, predicate: any) => any[];
    findPhase: (playbackEvents: any, predicate: any, fallbackPhase: any) => any;
    pushCueForMatchingEventPhases: (ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any) => void;
    pushCueForPhases: (ctx: any, phases: any, soundKey: any, sourceType: any) => void;
    pushRepeatedCueForMatchingTargets: (ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any) => void;
    pushSoundCue: (ctx: any, soundKey: any, phase: any, sourceType: any, options?: any) => void;
    isBoardShrinkDestroyTarget: (target: any) => boolean;
    isDestroyDragonBreathDestroyTarget: (target: any) => boolean;
    isDestroyRemovalOutcome: (target: any) => boolean;
    isGluttonousEatDestroyTarget: (target: any) => boolean;
    isGoldSilverSelfDestroyEvent: (ev: any) => boolean;
    isGoldSilverSelfDestroyTarget: (target: any) => boolean;
    isLightningDestroyTarget: (target: any) => boolean;
    isRobotVacuumSuckDestroyTarget: (target: any) => boolean;
    isSniperShotDestroyTarget: (target: any) => boolean;
    isSpecialDurationExpiredDestroyTarget: (target: any) => boolean;
    isSpecialDurationExpiredPlaybackEvent: (ev: any) => boolean;
    isUltimateDestroyGodDestroyTarget: (target: any) => boolean;
    isWillHunterKingSlashDestroyTarget: (target: any) => boolean;
};

function isUltimateWorkGodSelfDestroyTarget(target: any): boolean {
    if (!target || typeof target !== 'object') return false;
    const cause = String(target.cause || '').toUpperCase();
    const reason = String(target.reason || '').toLowerCase();
    return cause === 'ULTIMATE_WORK_GOD' && reason === 'ultimate_work_god_self_destruct';
}

function isGenericDestroyPlaybackEvent(ev: any, deps: DestroySoundCueDeps) {
    if (!ev || ev.type !== 'destroy' || !Array.isArray(ev.targets)) return false;
    if (deps.isSpecialDurationExpiredPlaybackEvent(ev)) return false;
    return ev.targets.some((target: any) => {
        if (!deps.isDestroyRemovalOutcome(target)) return false;
        const cause = String(target && target.cause ? target.cause : '').toUpperCase();
        const reason = String(target && target.reason ? target.reason : '').toLowerCase();
        if (deps.bombDestroyCauses.has(cause)) return false;
        if (cause === 'METEOR_WILL' || cause === 'METEOR_GOD') return false;
        if (deps.isBoardShrinkDestroyTarget(target)) return false;
        if (deps.isSniperShotDestroyTarget(target)) return false;
        if (deps.isLightningDestroyTarget(target)) return false;
        if (deps.isUltimateDestroyGodDestroyTarget(target)) return false;
        if (deps.isDestroyDragonBreathDestroyTarget(target)) return false;
        if (deps.isRobotVacuumSuckDestroyTarget(target)) return false;
        if (deps.isGluttonousEatDestroyTarget(target)) return false;
        if (deps.isWillHunterKingSlashDestroyTarget(target)) return false;
        if (deps.isGoldSilverSelfDestroyTarget(target)) return false;
        if (isUltimateWorkGodSelfDestroyTarget(target)) return false;
        if (deps.isSpecialDurationExpiredDestroyTarget(target)) return false;
        if (cause === 'TRAP_WILL' && (reason.indexOf('trap_expired') >= 0 || reason.indexOf('trap_disarmed') >= 0)) return false;
        return true;
    });
}

function planDestroySoundCues(ctx: any, deps: DestroySoundCueDeps) {
    const sniperDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isSniperShotDestroyTarget(target))
    ));
    if (sniperDestroyEvents.length > 0) {
        deps.pushRepeatedCueForMatchingTargets(
            ctx,
            sniperDestroyEvents,
            (target: any) => deps.isSniperShotDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'sniper_shot'
        );
    }

    const lightningDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isLightningDestroyTarget(target))
    ));
    if (lightningDestroyEvents.length > 0) {
        deps.pushRepeatedCueForMatchingTargets(
            ctx,
            lightningDestroyEvents,
            (target: any) => deps.isLightningDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'lightning_destroyed'
        );
    }

    const ultimateDestroyGodDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isUltimateDestroyGodDestroyTarget(target))
    ));
    if (ultimateDestroyGodDestroyEvents.length > 0) {
        deps.pushCueForMatchingEventPhases(
            ctx,
            ultimateDestroyGodDestroyEvents,
            (target: any) => deps.isUltimateDestroyGodDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'udg_destroyed'
        );
    }

    const destroyDragonDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isDestroyDragonBreathDestroyTarget(target))
    ));
    if (destroyDragonDestroyEvents.length > 0) {
        deps.pushCueForMatchingEventPhases(
            ctx,
            destroyDragonDestroyEvents,
            (target: any) => deps.isDestroyDragonBreathDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'destroy_dragon_breath'
        );
    }

    const robotVacuumSuckPhases = deps.collectUniquePhases(
        ctx.base,
        (ev: any) => ev && ev.type === 'destroy' && Array.isArray(ev.targets) && ev.targets.some((target: any) => deps.isRobotVacuumSuckDestroyTarget(target))
    );
    deps.pushCueForPhases(ctx, robotVacuumSuckPhases, 'robot_vacuum_suck', 'robot_vacuum_suck');

    const gluttonousDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isGluttonousEatDestroyTarget(target))
    ));
    if (gluttonousDestroyEvents.length > 0) {
        deps.pushCueForMatchingEventPhases(
            ctx,
            gluttonousDestroyEvents,
            (target: any) => deps.isGluttonousEatDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'gluttonous_eat'
        );
    }

    const willHunterKingDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => deps.isWillHunterKingSlashDestroyTarget(target))
    ));
    if (willHunterKingDestroyEvents.length > 0) {
        deps.pushCueForMatchingEventPhases(
            ctx,
            willHunterKingDestroyEvents,
            (target: any) => deps.isWillHunterKingSlashDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
            'stone_destroy',
            'will_hunter_king_slash'
        );
    }

    const goldSilverSelfDestroyPhases = deps.collectUniquePhases(ctx.base, (ev: any) => deps.isGoldSilverSelfDestroyEvent(ev));
    deps.pushCueForPhases(ctx, goldSilverSelfDestroyPhases, 'charge_gain_common', 'gold_silver_self_destroy');

    const boardShrinkDestroyPhases = deps.collectUniquePhases(
        ctx.base,
        (ev: any) => ev &&
            ev.type === 'destroy' &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => deps.isBoardShrinkDestroyTarget(target) && deps.isDestroyRemovalOutcome(target))
    );
    deps.pushCueForPhases(ctx, boardShrinkDestroyPhases, 'board_shrink_selected', 'board_shrink_selected');

    const ultimateWorkGodSelfDestroyEvents = ctx.base.filter((ev: any) => (
        ev &&
        ev.type === 'destroy' &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => isUltimateWorkGodSelfDestroyTarget(target))
    ));
    deps.pushRepeatedCueForMatchingTargets(
        ctx,
        ultimateWorkGodSelfDestroyEvents,
        (target: any) => isUltimateWorkGodSelfDestroyTarget(target) && deps.isDestroyRemovalOutcome(target),
        'stone_destroy',
        'ultimate_work_god_self_destruct'
    );

    if (ctx.base.some((ev: any) => isGenericDestroyPlaybackEvent(ev, deps))) {
        const genericDestroyPhase = deps.findPhase(
            ctx.base,
            (ev: any) => isGenericDestroyPlaybackEvent(ev, deps),
            ctx.fallbackPhase
        );
        deps.pushSoundCue(ctx, 'stone_destroy', genericDestroyPhase, 'destroy');
    }
}

const PipelineUIDestroySoundCuesModule = {
    isGenericDestroyPlaybackEvent,
    planDestroySoundCues
};

export = PipelineUIDestroySoundCuesModule;
