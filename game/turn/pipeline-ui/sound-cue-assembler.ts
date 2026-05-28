declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

function readRuntimeModuleGlobal(globalKey: string): any {
    if (!globalKey) return null;
    try {
        if (typeof self !== 'undefined' && (self as any)[globalKey]) {
            return (self as any)[globalKey];
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function requirePipelineUIModule(id: string, globalKey: string): any {
    try {
        return _require(id);
    } catch (e) {
        return readRuntimeModuleGlobal(globalKey);
    }
}

const PipelineUICardEconomySoundCuesModule = requirePipelineUIModule('./card-economy-sound-cues', 'PipelineUICardEconomySoundCues');
const PipelineUICoreSoundCuesModule = requirePipelineUIModule('./core-sound-cues', 'PipelineUICoreSoundCues');
const PipelineUIDestroySoundCuesModule = requirePipelineUIModule('./destroy-sound-cues', 'PipelineUIDestroySoundCues');
const PipelineUISelectionSoundCuesModule = requirePipelineUIModule('./selection-sound-cues', 'PipelineUISelectionSoundCues');
const PipelineUISoundCueHelpersModule = requirePipelineUIModule('./sound-cue-helpers', 'PipelineUISoundCueHelpers');

type SoundCueAssemblerDeps = {
    bombDestroyCauses: Set<string>;
    cardEffectFlipSoundKey: string;
    ultimateAnchorMoveSoundKey: string;
    cardEffectSpawnProfiles: any[];
    soundEventType: string;
    maxPhase: (playbackEvents: any) => number;
    phaseNum: (value: any) => number;
    clonePlaybackEventWithPhase: (ev: any, phase: any) => any;
    findPhase: (playbackEvents: any, predicate: any, fallbackPhase: any) => any;
    rawDetailCount: (ev: any) => number;
    hasRawEvent: (rawEvents: any, type: any, predicate?: any) => boolean;
    countCardEffectFlipFallbackEvents: (rawEvents: any) => number;
    isCardEffectSpawnEventLike: (target: any, profile: any) => boolean;
    isCardEffectSpawnPlaybackEvent: (ev: any, profile: any) => boolean;
    isCardEffectFlipPresentationEvent: (target: any) => boolean;
    isDestroyWithCause: (target: any, causes: any) => boolean;
    isHyperactiveMoveTarget: (target: any) => boolean;
    isLivingWillRestoreEventLike: (target: any) => boolean;
    isSeedSproutEventLike: (target: any) => boolean;
    isSpecialDurationExpiredPlaybackEvent: (ev: any) => boolean;
    isUltimateAnchorMoveTarget: (target: any) => boolean;
    getMoveIntent: (target: any) => any;
    isBoardShrinkDestroyTarget: (target: any) => boolean;
    isSuperCrushMoveTarget: (target: any) => boolean;
    isWorkFlipOrDestroyRemovedPresentationEvent: (ev: any) => boolean;
    isDestroyDragonBreathDestroyTarget: (target: any) => boolean;
    isDestroyRemovalOutcome: (target: any) => boolean;
    isGluttonousEatDestroyTarget: (target: any) => boolean;
    isGoldSilverSelfDestroyEvent: (ev: any) => boolean;
    isGoldSilverSelfDestroyTarget: (target: any) => boolean;
    isLightningDestroyTarget: (target: any) => boolean;
    isRobotVacuumSuckDestroyTarget: (target: any) => boolean;
    isSniperShotDestroyTarget: (target: any) => boolean;
    isSpecialDurationExpiredDestroyTarget: (target: any) => boolean;
    isUltimateDestroyGodDestroyTarget: (target: any) => boolean;
    isWillHunterKingSlashDestroyTarget: (target: any) => boolean;
};

function getSoundCueHelperModule(): any {
    if (!(PipelineUISoundCueHelpersModule && typeof PipelineUISoundCueHelpersModule.createSoundCuePlanningContext === 'function')) {
        throw new Error('PipelineUISoundCueAssembler helper module unavailable');
    }
    return PipelineUISoundCueHelpersModule;
}

function getCoreSoundCuePlanner(): any {
    if (!(PipelineUICoreSoundCuesModule && typeof PipelineUICoreSoundCuesModule.planCoreSoundCues === 'function')) {
        throw new Error('PipelineUISoundCueAssembler core planner module unavailable');
    }
    return PipelineUICoreSoundCuesModule;
}

function getSelectionSoundCuePlanner(): any {
    if (!(PipelineUISelectionSoundCuesModule && typeof PipelineUISelectionSoundCuesModule.planSelectionSoundCues === 'function')) {
        throw new Error('PipelineUISoundCueAssembler selection planner module unavailable');
    }
    return PipelineUISelectionSoundCuesModule;
}

function getCardEconomySoundCuePlanner(): any {
    if (!(PipelineUICardEconomySoundCuesModule && typeof PipelineUICardEconomySoundCuesModule.planCardAndEconomySoundCues === 'function')) {
        throw new Error('PipelineUISoundCueAssembler card/economy planner module unavailable');
    }
    return PipelineUICardEconomySoundCuesModule;
}

function getDestroySoundCuePlanner(): any {
    if (!(PipelineUIDestroySoundCuesModule && typeof PipelineUIDestroySoundCuesModule.planDestroySoundCues === 'function')) {
        throw new Error('PipelineUISoundCueAssembler destroy planner module unavailable');
    }
    return PipelineUIDestroySoundCuesModule;
}

function createSoundCueRuntimeHelpers(deps: SoundCueAssemblerDeps) {
    const helperModule = getSoundCueHelperModule();

    function createSoundCuePlanningContext(playbackEvents: any, rawEvents: any, presentationEvents: any) {
        return helperModule.createSoundCuePlanningContext(
            playbackEvents,
            rawEvents,
            presentationEvents,
            { maxPhase: deps.maxPhase }
        );
    }

    function pushSoundCue(ctx: any, soundKey: any, phase: any, sourceType: any, options: any = {}) {
        return helperModule.pushSoundCue(
            ctx,
            soundKey,
            phase,
            sourceType,
            options,
            {
                phaseNum: deps.phaseNum,
                soundEventType: deps.soundEventType
            }
        );
    }

    function tagCardUseAnimationPlaybackTarget(ctx: any, patch: any) {
        return helperModule.tagCardUseAnimationPlaybackTarget(ctx, patch);
    }

    function appendPlaybackEventsIntoCardUseAnimationTarget(ctx: any, propertyName: any, playbackEvents: any) {
        return helperModule.appendPlaybackEventsIntoCardUseAnimationTarget(
            ctx,
            propertyName,
            playbackEvents,
            {
                clonePlaybackEventWithPhase: deps.clonePlaybackEventWithPhase,
                phaseNum: deps.phaseNum
            }
        );
    }

    function movePlaybackEventsIntoCardUseAnimationTarget(ctx: any, predicate: any, propertyName: any) {
        return helperModule.movePlaybackEventsIntoCardUseAnimationTarget(
            ctx,
            predicate,
            propertyName,
            {
                clonePlaybackEventWithPhase: deps.clonePlaybackEventWithPhase,
                phaseNum: deps.phaseNum
            }
        );
    }

    function moveFirstPlaybackEventIntoCardUseAnimationTarget(ctx: any, sourceEvents: any, predicate: any, propertyName: any) {
        return helperModule.moveFirstPlaybackEventIntoCardUseAnimationTarget(
            ctx,
            sourceEvents,
            predicate,
            propertyName,
            {
                clonePlaybackEventWithPhase: deps.clonePlaybackEventWithPhase,
                phaseNum: deps.phaseNum
            }
        );
    }

    function collectUniquePhases(playbackEvents: any, predicate: any) {
        return helperModule.collectUniquePhases(playbackEvents, predicate, { phaseNum: deps.phaseNum });
    }

    function pushCueForPhases(ctx: any, phases: any, soundKey: any, sourceType: any) {
        return helperModule.pushCueForPhases(ctx, phases, soundKey, sourceType, { pushSoundCue });
    }

    function pushRepeatedCueForMatchingTargets(ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any) {
        return helperModule.pushRepeatedCueForMatchingTargets(
            ctx,
            events,
            targetPredicate,
            soundKey,
            sourceType,
            {
                phaseNum: deps.phaseNum,
                pushSoundCue
            }
        );
    }

    function pushCueForMatchingEventPhases(ctx: any, events: any, targetPredicate: any, soundKey: any, sourceType: any) {
        return helperModule.pushCueForMatchingEventPhases(
            ctx,
            events,
            targetPredicate,
            soundKey,
            sourceType,
            {
                collectUniquePhases,
                pushCueForPhases
            }
        );
    }

    function pushRepeatedCueForCardEffectSpawnProfiles(ctx: any, events: any, soundKey: any) {
        return helperModule.pushRepeatedCueForCardEffectSpawnProfiles(
            ctx,
            events,
            soundKey,
            {
                cardEffectSpawnProfiles: deps.cardEffectSpawnProfiles,
                isCardEffectSpawnEventLike: deps.isCardEffectSpawnEventLike,
                pushRepeatedCueForMatchingTargets
            }
        );
    }

    function deferFirstCardEffectSpawnIntoDisappearPlayback(ctx: any, profile: any, soundKey: any) {
        return helperModule.deferFirstCardEffectSpawnIntoDisappearPlayback(
            ctx,
            profile,
            soundKey,
            {
                clonePlaybackEventWithPhase: deps.clonePlaybackEventWithPhase,
                hasRawEvent: deps.hasRawEvent,
                isCardEffectSpawnPlaybackEvent: deps.isCardEffectSpawnPlaybackEvent,
                moveFirstPlaybackEventIntoCardUseAnimationTarget,
                phaseNum: deps.phaseNum,
                soundEventType: deps.soundEventType
            }
        );
    }

    return {
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
}

function createCoreSoundCueDeps(deps: SoundCueAssemblerDeps, runtimeHelpers: any) {
    return {
        bombDestroyCauses: deps.bombDestroyCauses,
        cardEffectFlipSoundKey: deps.cardEffectFlipSoundKey,
        ultimateAnchorMoveSoundKey: deps.ultimateAnchorMoveSoundKey,
        collectUniquePhases: runtimeHelpers.collectUniquePhases,
        countCardEffectFlipFallbackEvents: deps.countCardEffectFlipFallbackEvents,
        findPhase: deps.findPhase,
        hasRawEvent: deps.hasRawEvent,
        isCardEffectFlipPresentationEvent: deps.isCardEffectFlipPresentationEvent,
        isDestroyWithCause: deps.isDestroyWithCause,
        isHyperactiveMoveTarget: deps.isHyperactiveMoveTarget,
        isLivingWillRestoreEventLike: deps.isLivingWillRestoreEventLike,
        isSeedSproutEventLike: deps.isSeedSproutEventLike,
        isSpecialDurationExpiredPlaybackEvent: deps.isSpecialDurationExpiredPlaybackEvent,
        isUltimateAnchorMoveTarget: deps.isUltimateAnchorMoveTarget,
        pushCueForPhases: runtimeHelpers.pushCueForPhases,
        pushRepeatedCueForCardEffectSpawnProfiles: runtimeHelpers.pushRepeatedCueForCardEffectSpawnProfiles,
        pushRepeatedCueForMatchingTargets: runtimeHelpers.pushRepeatedCueForMatchingTargets,
        pushSoundCue: runtimeHelpers.pushSoundCue,
        rawDetailCount: deps.rawDetailCount
    };
}

function createSelectionSoundCueDeps(deps: SoundCueAssemblerDeps, runtimeHelpers: any) {
    return {
        findPhase: deps.findPhase,
        getMoveIntent: deps.getMoveIntent,
        hasRawEvent: deps.hasRawEvent,
        isBoardShrinkDestroyTarget: deps.isBoardShrinkDestroyTarget,
        isSuperCrushMoveTarget: deps.isSuperCrushMoveTarget,
        pushSoundCue: runtimeHelpers.pushSoundCue,
        rawDetailCount: deps.rawDetailCount
    };
}

function createCardEconomySoundCueDeps(deps: SoundCueAssemblerDeps, runtimeHelpers: any) {
    return {
        cardEffectSpawnProfiles: deps.cardEffectSpawnProfiles,
        deferFirstCardEffectSpawnIntoDisappearPlayback: runtimeHelpers.deferFirstCardEffectSpawnIntoDisappearPlayback,
        findPhase: deps.findPhase,
        hasRawEvent: deps.hasRawEvent,
        isWorkFlipOrDestroyRemovedPresentationEvent: deps.isWorkFlipOrDestroyRemovedPresentationEvent,
        movePlaybackEventsIntoCardUseAnimationTarget: runtimeHelpers.movePlaybackEventsIntoCardUseAnimationTarget,
        phaseNum: deps.phaseNum,
        pushSoundCue: runtimeHelpers.pushSoundCue,
        tagCardUseAnimationPlaybackTarget: runtimeHelpers.tagCardUseAnimationPlaybackTarget
    };
}

function createDestroySoundCueDeps(deps: SoundCueAssemblerDeps, runtimeHelpers: any) {
    return {
        bombDestroyCauses: deps.bombDestroyCauses,
        collectUniquePhases: runtimeHelpers.collectUniquePhases,
        findPhase: deps.findPhase,
        pushCueForMatchingEventPhases: runtimeHelpers.pushCueForMatchingEventPhases,
        pushCueForPhases: runtimeHelpers.pushCueForPhases,
        pushRepeatedCueForMatchingTargets: runtimeHelpers.pushRepeatedCueForMatchingTargets,
        pushSoundCue: runtimeHelpers.pushSoundCue,
        isBoardShrinkDestroyTarget: deps.isBoardShrinkDestroyTarget,
        isDestroyDragonBreathDestroyTarget: deps.isDestroyDragonBreathDestroyTarget,
        isDestroyRemovalOutcome: deps.isDestroyRemovalOutcome,
        isGluttonousEatDestroyTarget: deps.isGluttonousEatDestroyTarget,
        isGoldSilverSelfDestroyEvent: deps.isGoldSilverSelfDestroyEvent,
        isGoldSilverSelfDestroyTarget: deps.isGoldSilverSelfDestroyTarget,
        isLightningDestroyTarget: deps.isLightningDestroyTarget,
        isRobotVacuumSuckDestroyTarget: deps.isRobotVacuumSuckDestroyTarget,
        isSniperShotDestroyTarget: deps.isSniperShotDestroyTarget,
        isSpecialDurationExpiredDestroyTarget: deps.isSpecialDurationExpiredDestroyTarget,
        isSpecialDurationExpiredPlaybackEvent: deps.isSpecialDurationExpiredPlaybackEvent,
        isUltimateDestroyGodDestroyTarget: deps.isUltimateDestroyGodDestroyTarget,
        isWillHunterKingSlashDestroyTarget: deps.isWillHunterKingSlashDestroyTarget
    };
}

function appendSoundEffectPlaybackEvents(playbackEvents: any, rawEvents: any, presentationEvents: any, deps: SoundCueAssemblerDeps) {
    const runtimeHelpers = createSoundCueRuntimeHelpers(deps);
    const ctx = runtimeHelpers.createSoundCuePlanningContext(playbackEvents, rawEvents, presentationEvents);
    if (!ctx.raw.length && !ctx.base.length) return ctx.base;

    getCoreSoundCuePlanner().planCoreSoundCues(ctx, createCoreSoundCueDeps(deps, runtimeHelpers));
    getSelectionSoundCuePlanner().planSelectionSoundCues(ctx, createSelectionSoundCueDeps(deps, runtimeHelpers));
    getCardEconomySoundCuePlanner().planCardAndEconomySoundCues(ctx, createCardEconomySoundCueDeps(deps, runtimeHelpers));
    getDestroySoundCuePlanner().planDestroySoundCues(ctx, createDestroySoundCueDeps(deps, runtimeHelpers));

    ctx.added.sort((a: any, b: any) => deps.phaseNum(a.phase) - deps.phaseNum(b.phase));
    return ctx.base.concat(ctx.added);
}

const PipelineUISoundCueAssemblerModule = {
    appendSoundEffectPlaybackEvents
};

export = PipelineUISoundCueAssemblerModule;
