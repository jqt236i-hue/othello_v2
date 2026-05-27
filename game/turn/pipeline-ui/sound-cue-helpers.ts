type CreateSoundCuePlanningContextDeps = {
    maxPhase: (playbackEvents: any) => number;
};

type PushSoundCueDeps = {
    phaseNum: (value: any) => number;
    soundEventType: string;
};

type PlaybackEventCloneDeps = {
    clonePlaybackEventWithPhase: (ev: any, phase: any) => any;
    phaseNum: (value: any) => number;
};

type PushCueForPhasesDeps = {
    pushSoundCue: (ctx: any, soundKey: any, phase: any, sourceType: any, options?: any) => void;
};

type PushRepeatedCueForMatchingTargetsDeps = {
    phaseNum: (value: any) => number;
    pushSoundCue: (ctx: any, soundKey: any, phase: any, sourceType: any, options?: any) => void;
};

type PushCueForMatchingEventPhasesDeps = {
    collectUniquePhases: (playbackEvents: any, predicate: any) => any[];
    pushCueForPhases: (ctx: any, phases: any, soundKey: any, sourceType: any) => void;
};

type PushRepeatedCueForCardEffectSpawnProfilesDeps = {
    cardEffectSpawnProfiles: any[];
    isCardEffectSpawnEventLike: (target: any, profile: any) => boolean;
    pushRepeatedCueForMatchingTargets: (ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any) => void;
};

type DeferCardEffectSpawnDeps = {
    hasRawEvent: (rawEvents: any, type: any, predicate?: any) => boolean;
    isCardEffectSpawnPlaybackEvent: (ev: any, profile: any) => boolean;
    moveFirstPlaybackEventIntoCardUseAnimationTarget: (ctx: any, sourceEvents: any, predicate: any, propertyName: any) => boolean;
    soundEventType: string;
};

function createSoundCuePlanningContext(playbackEvents: any, rawEvents: any, presentationEvents: any, deps: CreateSoundCuePlanningContextDeps) {
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

function pushSoundCue(ctx: any, soundKey: any, phase: any, sourceType: any, options: any = {}, deps: PushSoundCueDeps) {
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

function appendPlaybackEventsIntoCardUseAnimationTarget(ctx: any, propertyName: any, playbackEvents: any, deps: PlaybackEventCloneDeps) {
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

function movePlaybackEventsIntoCardUseAnimationTarget(ctx: any, predicate: any, propertyName: any, deps: PlaybackEventCloneDeps) {
    const deferredEvents = ctx.base.filter((ev: any) => !!ev && predicate(ev));
    if (!deferredEvents.length) return false;
    if (!appendPlaybackEventsIntoCardUseAnimationTarget(ctx, propertyName, deferredEvents, deps)) return false;
    for (let index = ctx.base.length - 1; index >= 0; index -= 1) {
        if (ctx.base[index] && predicate(ctx.base[index])) ctx.base.splice(index, 1);
    }
    return true;
}

function moveFirstPlaybackEventIntoCardUseAnimationTarget(ctx: any, sourceEvents: any, predicate: any, propertyName: any, deps: PlaybackEventCloneDeps) {
    if (!Array.isArray(sourceEvents)) return false;
    const matchIndex = sourceEvents.findIndex((ev: any) => !!ev && predicate(ev));
    if (matchIndex < 0) return false;
    const matchedEvent = sourceEvents[matchIndex];
    if (!appendPlaybackEventsIntoCardUseAnimationTarget(ctx, propertyName, [matchedEvent], deps)) return false;
    sourceEvents.splice(matchIndex, 1);
    return true;
}

function collectUniquePhases(playbackEvents: any, predicate: any, deps: { phaseNum: (value: any) => number }) {
    return Array.from(new Set(
        (Array.isArray(playbackEvents) ? playbackEvents : [])
            .filter((ev: any) => predicate(ev))
            .map((ev: any) => deps.phaseNum(ev && ev.phase))
            .filter((phase: any) => phase > 0)
    )).sort((a: any, b: any) => a - b);
}

function pushCueForPhases(ctx: any, phases: any, soundKey: any, sourceType: any, deps: PushCueForPhasesDeps) {
    for (const phase of phases) {
        deps.pushSoundCue(ctx, soundKey, phase, sourceType, { allowRepeat: true });
    }
}

function pushRepeatedCueForMatchingTargets(ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any, deps: PushRepeatedCueForMatchingTargetsDeps) {
    for (const ev of Array.isArray(events) ? events : []) {
        const phase = deps.phaseNum(ev && ev.phase);
        const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
        const hitCount = targets.filter((target: any) => targetPredicate(target)).length;
        for (let index = 0; index < hitCount; index += 1) {
            deps.pushSoundCue(ctx, soundKey, phase, sourceType, { allowRepeat: true });
        }
    }
}

function pushCueForMatchingEventPhases(ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any, deps: PushCueForMatchingEventPhasesDeps) {
    const phases = deps.collectUniquePhases(events, (ev: any) => (
        ev &&
        Array.isArray(ev.targets) &&
        ev.targets.some((target: any) => targetPredicate(target))
    ));
    deps.pushCueForPhases(ctx, phases, soundKey, sourceType);
}

function pushRepeatedCueForCardEffectSpawnProfiles(ctx: any, events: any, soundKey: any, deps: PushRepeatedCueForCardEffectSpawnProfilesDeps) {
    for (const profile of deps.cardEffectSpawnProfiles) {
        deps.pushRepeatedCueForMatchingTargets(
            ctx,
            events,
            (target: any) => deps.isCardEffectSpawnEventLike(target, profile),
            soundKey,
            profile.soundSourceType
        );
    }
}

function deferFirstCardEffectSpawnIntoDisappearPlayback(ctx: any, profile: any, soundKey: any, deps: DeferCardEffectSpawnDeps & PlaybackEventCloneDeps) {
    if (!deps.hasRawEvent(ctx.raw, profile.rawResolvedType, (ev: any) => Number(ev && ev.spawnedCount) > 0)) {
        return;
    }
    const movedSpawn = deps.moveFirstPlaybackEventIntoCardUseAnimationTarget(
        ctx,
        ctx.base,
        (ev: any) => deps.isCardEffectSpawnPlaybackEvent(ev, profile),
        'disappearPlaybackEvents'
    );
    if (!movedSpawn) return;
    deps.moveFirstPlaybackEventIntoCardUseAnimationTarget(
        ctx,
        ctx.added,
        (ev: any) => ev &&
            ev.type === deps.soundEventType &&
            ev.meta &&
            ev.meta.sourceType === profile.soundSourceType &&
            Array.isArray(ev.targets) &&
            ev.targets.some((target: any) => String(target && target.soundKey ? target.soundKey : '').trim() === String(soundKey || '').trim()),
        'disappearPlaybackEvents'
    );
}

const PipelineUISoundCueHelpersModule = {
    appendPlaybackEventsIntoCardUseAnimationTarget,
    collectUniquePhases,
    createSoundCuePlanningContext,
    deferFirstCardEffectSpawnIntoDisappearPlayback,
    moveFirstPlaybackEventIntoCardUseAnimationTarget,
    movePlaybackEventsIntoCardUseAnimationTarget,
    pushCueForMatchingEventPhases,
    pushCueForPhases,
    pushRepeatedCueForCardEffectSpawnProfiles,
    pushRepeatedCueForMatchingTargets,
    pushSoundCue,
    tagCardUseAnimationPlaybackTarget
};

export = PipelineUISoundCueHelpersModule;
