type BoardEventPlaybackDeps = {
    batchDestroyCauses: Set<string>;
    superCrushCauses: Set<string>;
    stoneSalvationGodCause: string;
    cardEffectSpawnProfiles: any[];
    deferredSpawnPlaybackProfiles: any[];
    destroyOutcomeKinds: Record<string, any>;
    isCardEffectSpawnEventLike: (ev: any, profile: any) => boolean;
    matchesSpawnCauseAndReason: (subject: any, cause: any, reasonPrefix: any) => boolean;
    getDestroyOutcomeKind: (meta: any) => any;
    getMoveIntent: (target: any) => any;
    getPrimaryTimerFromMeta: (meta: any) => any;
    getFlipEvadeRemainingFromMeta: (meta: any) => any;
    getDestroyEvadeRemainingFromMeta: (meta: any) => any;
    isChainFlipPresentationEvent: (ev: any) => boolean;
    getChainFlipLink: (ev: any) => any;
    isRegenTriggeredChange: (ev: any) => boolean;
    isLivingWillRestorePresentationEvent: (ev: any) => boolean;
    isLivingWillRestoreChange: (ev: any) => boolean;
};

function createPlaybackPhaseState() {
    return {
        currentPhase: 1,
        prevWasChainFlip: false,
        prevChainFlipLink: null,
        prevDestroyCause: null,
        prevBatchDestroyKey: null,
        durationEndRevertPhase: null,
        superCrushPhase: null,
        superCrushActionId: null,
        gluttonousEatPhase: null,
        gluttonousEatActionId: null,
        willHunterKingSlashPhase: null,
        prevWasProliferationDestroy: false
    };
}

function createPlaybackEventBase(ev: any, finalCardState: any) {
    return {
        meta: ev && ev.meta ? ev.meta : null,
        rawType: ev && ev.type ? ev.type : null,
        actionId: ev && ev.actionId ? ev.actionId : null,
        effectBlockId: ev && ev.effectBlockId ? ev.effectBlockId : (ev && ev.meta && ev.meta.effectBlockId ? ev.meta.effectBlockId : null),
        turnIndex: (ev && typeof ev.turnIndex === 'number')
            ? ev.turnIndex
            : (finalCardState && typeof finalCardState.turnIndex === 'number' ? finalCardState.turnIndex : 0),
        plyIndex: (ev && typeof ev.plyIndex === 'number') ? ev.plyIndex : null
    };
}

function createPlaybackEvent(playbackBase: any, type: any, phase: any, targets: any) {
    return Object.assign({
        type,
        phase,
        targets: Array.isArray(targets) ? targets : []
    }, playbackBase || null);
}

function clearChainFlipPhaseState(phaseState: any) {
    phaseState.prevWasChainFlip = false;
    phaseState.prevChainFlipLink = null;
}

function preparePassivePlaybackPhaseState(phaseState: any, options?: any) {
    clearChainFlipPhaseState(phaseState);
    phaseState.prevDestroyCause = null;
    phaseState.prevBatchDestroyKey = null;
    if (!options || options.clearWillHunter !== false) {
        phaseState.willHunterKingSlashPhase = null;
    }
    if (!options || options.preserveDurationEndRevert !== true) {
        phaseState.durationEndRevertPhase = null;
    }
}

function planDurationEndRevertPlaybackPhase(phaseState: any, hasPriorPlaybackEvent: any) {
    if (Number.isInteger(phaseState.durationEndRevertPhase)) {
        return phaseState.durationEndRevertPhase;
    }
    if (hasPriorPlaybackEvent) {
        phaseState.currentPhase++;
    }
    phaseState.durationEndRevertPhase = phaseState.currentPhase;
    return phaseState.durationEndRevertPhase;
}

function clearGroupedDestroyPhaseState(phaseState: any) {
    phaseState.willHunterKingSlashPhase = null;
    phaseState.gluttonousEatPhase = null;
    phaseState.gluttonousEatActionId = null;
    phaseState.superCrushPhase = null;
    phaseState.superCrushActionId = null;
}

function assignActionScopedPhase(phaseState: any, phaseField: any, actionIdField: any, actionId: any) {
    const hasActionMismatch =
        phaseState[phaseField] !== null &&
        phaseState[actionIdField] !== null &&
        actionId !== null &&
        phaseState[actionIdField] !== actionId;
    if (phaseState[phaseField] === null || hasActionMismatch) {
        phaseState.currentPhase++;
        phaseState[phaseField] = phaseState.currentPhase;
    }
    phaseState[actionIdField] = actionId;
    return phaseState[phaseField];
}

function getPresentationActionId(ev: any): string | null {
    const meta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : null;
    const raw = ev && ev.actionId ? ev.actionId : (meta && meta.actionId ? meta.actionId : null);
    const actionId = String(raw || '').trim();
    return actionId ? actionId : null;
}

function getPresentationEffectBlockId(ev: any): string | null {
    const meta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : null;
    const raw = ev && ev.effectBlockId ? ev.effectBlockId : (meta && meta.effectBlockId ? meta.effectBlockId : null);
    const effectBlockId = String(raw || '').trim();
    return effectBlockId ? effectBlockId : null;
}

function isProliferationSpawnPresentationEvent(ev: any) {
    return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'PROLIFERATION_WILL' &&
        String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('proliferation_spawn') === 0;
}

function isDeferredSpawnPresentationEvent(ev: any, deps: BoardEventPlaybackDeps) {
    return !!(
        ev &&
        ev.type === 'SPAWN' &&
        deps.deferredSpawnPlaybackProfiles.some((profile: any) => deps.matchesSpawnCauseAndReason(ev, profile.cause, profile.reasonPrefix))
    );
}

function getCardEffectSpawnProfile(ev: any, deps: BoardEventPlaybackDeps) {
    for (const profile of deps.cardEffectSpawnProfiles) {
        if (deps.isCardEffectSpawnEventLike(ev, profile)) return profile;
    }
    return null;
}

function normalizeTheoryRouletteCell(value: any) {
    const row = Number(value && value.row);
    const col = Number(value && value.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function createTheorySpawnRoulettePlaybackPlan(phase: any, ev: any, spawnMeta: any, playbackBase: any) {
    const roulette = spawnMeta && spawnMeta.theorySpawnRoulette && typeof spawnMeta.theorySpawnRoulette === 'object'
        ? spawnMeta.theorySpawnRoulette
        : null;
    if (!roulette) return null;
    const selectedCell = normalizeTheoryRouletteCell(roulette.selectedCell) || { row: ev.row, col: ev.col };
    const candidateCells = Array.isArray(roulette.candidateCells)
        ? roulette.candidateCells.map(normalizeTheoryRouletteCell).filter((cell: any) => !!cell)
        : [];
    const owner = String((spawnMeta && spawnMeta.owner) || ev.ownerAfter || '').trim() || null;
    return {
        phase,
        type: 'theory_incarnation_spawn_roulette',
        targets: [{
            r: selectedCell.row,
            row: selectedCell.row,
            col: selectedCell.col,
            stoneId: ev.stoneId,
            owner,
            player: owner,
            ownerAfter: ev.ownerAfter || owner,
            cause: ev.cause || null,
            reason: ev.reason || null,
            meta: (playbackBase && playbackBase.meta) || spawnMeta || null,
            spawnedMarkerType: roulette.spawnedMarkerType || spawnMeta.special || null,
            sourceCardId: roulette.sourceCardId || spawnMeta.sourceCardId || null,
            sourceCardType: roulette.sourceCardType || spawnMeta.sourceCardType || null,
            candidateCells,
            selectedCell
        }],
        durationMs: Number.isFinite(Number(roulette.durationMs)) ? Number(roulette.durationMs) : 2500,
        materializeMs: Number.isFinite(Number(roulette.materializeMs)) ? Number(roulette.materializeMs) : 700,
        leadingPlaybackEvents: []
    };
}

function isCloneLikeSpawnPresentationEvent(ev: any, spawnMeta: any) {
    const spawnCause = String(ev && ev.cause ? ev.cause : '').toUpperCase();
    return (
        (spawnCause === 'CLONE_WILL' || spawnCause === 'PROLIFERATION_WILL') &&
        spawnMeta &&
        Number.isInteger(spawnMeta.fromRow) &&
        Number.isInteger(spawnMeta.fromCol)
    );
}

function isGluttonousEatDestroyPresentationEvent(ev: any) {
    return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'GLUTTONOUS_WILL' &&
        String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('gluttonous_eat') === 0;
}

function isSuperCrushDestroyPresentationEvent(ev: any, deps: BoardEventPlaybackDeps) {
    const cause = String(ev && ev.cause ? ev.cause : '').toUpperCase();
    const reason = String(ev && ev.reason ? ev.reason : '').toLowerCase();
    return deps.superCrushCauses.has(cause) &&
        (reason.indexOf('super_buoyancy_collision') === 0 || reason.indexOf('super_gravity_collision') === 0 || reason.indexOf('super_attraction_collision') === 0);
}

function isWillHunterKingSlashDestroyPresentationEvent(ev: any) {
    return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'WILL_HUNTER_KING' &&
        String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('will_hunter_king_slash') === 0;
}

function isBoardShrinkHoleStatusAppliedPresentationEvent(ev: any) {
    const meta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : null;
    return !!(
        ev &&
        ev.type === 'STATUS_APPLIED' &&
        meta &&
        String(meta.special || '').toUpperCase() === 'METEOR_HOLE' &&
        String(meta.visualVariant || '').toUpperCase() === 'BOARD_FRAME'
    );
}

function isGluttonousEatMovePresentationEvent(ev: any, deps: BoardEventPlaybackDeps) {
    const moveIntent = deps.getMoveIntent(ev);
    if (moveIntent === 'hyperactive_move') {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'GLUTTONOUS_WILL';
    }
    return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'GLUTTONOUS_WILL' &&
        String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('gluttonous_eat_move') === 0;
}

function isSuperCrushMovePresentationEvent(ev: any, deps: BoardEventPlaybackDeps) {
    const moveIntent = deps.getMoveIntent(ev);
    if (moveIntent === 'crush_move') return true;
    const cause = String(ev && ev.cause ? ev.cause : '').toUpperCase();
    const reason = String(ev && ev.reason ? ev.reason : '').toLowerCase();
    return deps.superCrushCauses.has(cause) &&
        (reason.indexOf('super_buoyancy_move') === 0 || reason.indexOf('super_gravity_move') === 0 || reason.indexOf('super_attraction_move') === 0);
}

function isWillHunterKingSlashMovePresentationEvent(ev: any, deps: BoardEventPlaybackDeps) {
    const moveIntent = deps.getMoveIntent(ev);
    if (moveIntent === 'anchor_move' || moveIntent === 'hyperactive_move') {
        return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'WILL_HUNTER_KING';
    }
    return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'WILL_HUNTER_KING' &&
        String(ev && ev.reason ? ev.reason : '').toLowerCase().indexOf('will_hunter_king_slash_move') === 0;
}

function isExtremeForcedSwapMovePresentationEvent(ev: any) {
    return String(ev && ev.cause ? ev.cause : '').toUpperCase() === 'EXTREME_HYPERACTIVE_WILL' &&
        String(ev && ev.reason ? ev.reason : '').toLowerCase() === 'extreme_hyperactive_forced_swap';
}

function isExtremeForcedSwapMovePairPresentation(firstEv: any, secondEv: any) {
    if (!isExtremeForcedSwapMovePresentationEvent(firstEv) || !isExtremeForcedSwapMovePresentationEvent(secondEv)) {
        return false;
    }
    if (
        !Number.isInteger(firstEv.prevRow) ||
        !Number.isInteger(firstEv.prevCol) ||
        !Number.isInteger(firstEv.row) ||
        !Number.isInteger(firstEv.col) ||
        !Number.isInteger(secondEv.prevRow) ||
        !Number.isInteger(secondEv.prevCol) ||
        !Number.isInteger(secondEv.row) ||
        !Number.isInteger(secondEv.col)
    ) {
        return false;
    }
    if (
        firstEv.row !== secondEv.prevRow ||
        firstEv.col !== secondEv.prevCol ||
        firstEv.prevRow !== secondEv.row ||
        firstEv.prevCol !== secondEv.col
    ) {
        return false;
    }
    if (
        firstEv.actionId &&
        secondEv.actionId &&
        firstEv.actionId !== secondEv.actionId
    ) {
        return false;
    }
    return true;
}

function canSkipEventBetweenExtremeForcedSwapMoves(firstEv: any, candidateEv: any) {
    const candidateType = String(candidateEv && candidateEv.type ? candidateEv.type : '').toUpperCase();
    if (
        candidateType !== 'STATUS_APPLIED' &&
        candidateType !== 'STATUS_TICK' &&
        candidateType !== 'STATUS_REMOVED'
    ) {
        return false;
    }
    if (
        firstEv &&
        firstEv.actionId &&
        candidateEv &&
        candidateEv.actionId &&
        firstEv.actionId !== candidateEv.actionId
    ) {
        return false;
    }
    return true;
}

function findExtremeForcedSwapMovePairPresentationIndex(presentationEvents: any, firstIndex: any) {
    const firstEv = Array.isArray(presentationEvents) ? presentationEvents[firstIndex] : null;
    if (!isExtremeForcedSwapMovePresentationEvent(firstEv)) return -1;
    for (let index = firstIndex + 1; index < presentationEvents.length; index += 1) {
        const candidateEv = presentationEvents[index];
        if (isExtremeForcedSwapMovePairPresentation(firstEv, candidateEv)) {
            return index;
        }
        if (!canSkipEventBetweenExtremeForcedSwapMoves(firstEv, candidateEv)) {
            break;
        }
    }
    return -1;
}

function createOverlapReturnAfterState(meta: any, overlapOwner: any, overlapSpecial: any, includeMetaVisual: any, deps: BoardEventPlaybackDeps) {
    return {
        color: overlapOwner === 'black' ? 1 : (overlapOwner === 'white' ? -1 : 0),
        special: overlapSpecial,
        timer: includeMetaVisual ? deps.getPrimaryTimerFromMeta(meta) : null,
        owner: overlapOwner || null,
        flipEvadeRemaining: includeMetaVisual ? deps.getFlipEvadeRemainingFromMeta(meta) : null,
        destroyEvadeRemaining: includeMetaVisual ? deps.getDestroyEvadeRemainingFromMeta(meta) : null
    };
}

function createOverlapReturnPlaybackEvent(playbackBase: any, options: any, deps: BoardEventPlaybackDeps) {
    const from = options && options.from ? options.from : null;
    const to = options && options.to ? options.to : null;
    const meta = options && options.meta ? options.meta : null;
    const overlapOwner = (options && typeof options.owner === 'string' && options.owner)
        ? options.owner
        : null;
    const overlapSpecial = options && options.special ? options.special : null;
    return createPlaybackEvent(playbackBase, 'move', options && options.phase, [{
        from: { r: from && from.r, col: from && from.col },
        to: { r: to && to.r, col: to && to.col },
        ownerBefore: overlapOwner,
        ownerAfter: overlapOwner,
        cause: options && Object.prototype.hasOwnProperty.call(options, 'cause') ? options.cause : null,
        reason: options && Object.prototype.hasOwnProperty.call(options, 'reason') ? options.reason : null,
        overlapReturn: true,
        meta,
        sourceRow: from && from.r,
        sourceCol: from && from.col,
        after: createOverlapReturnAfterState(meta, overlapOwner, overlapSpecial, !!(options && options.includeMetaVisual), deps)
    }]);
}

function createExtremeForcedSwapPlaybackEvent(playbackBase: any, phase: any, leadEv: any, followEv: any) {
    const playbackMeta = (playbackBase && playbackBase.meta && typeof playbackBase.meta === 'object')
        ? Object.assign({}, playbackBase.meta)
        : {};
    playbackMeta.sequence = 'extreme_hyperactive_forced_swap';
    return createPlaybackEvent(
        Object.assign({}, playbackBase || {}, { meta: playbackMeta }),
        'move',
        phase,
        [{
            from: { r: leadEv.prevRow, col: leadEv.prevCol },
            to: { r: leadEv.row, col: leadEv.col },
            stoneId: leadEv.stoneId,
            ownerBefore: leadEv.ownerBefore,
            ownerAfter: leadEv.ownerAfter,
            cause: leadEv.cause || null,
            reason: leadEv.reason || null,
            meta: (leadEv && leadEv.meta && typeof leadEv.meta === 'object') ? leadEv.meta : null,
            extremeForcedSwapRole: 'lead'
        }, {
            from: { r: followEv.prevRow, col: followEv.prevCol },
            to: { r: followEv.row, col: followEv.col },
            stoneId: followEv.stoneId,
            ownerBefore: followEv.ownerBefore,
            ownerAfter: followEv.ownerAfter,
            cause: followEv.cause || null,
            reason: followEv.reason || null,
            meta: (followEv && followEv.meta && typeof followEv.meta === 'object') ? followEv.meta : null,
            extremeForcedSwapRole: 'follow'
        }]
    );
}

function getSpawnOverlapReturnSpec(ev: any, spawnMeta: any) {
    if (!isProliferationSpawnPresentationEvent(ev) || !spawnMeta) return null;
    const proliferationTriggeredBy = String(spawnMeta.proliferationTriggeredBy ? spawnMeta.proliferationTriggeredBy : '').toUpperCase();
    const proliferationTriggerReason = String(spawnMeta.proliferationTriggerReason ? spawnMeta.proliferationTriggerReason : '').toLowerCase();
    const isGluttonousTriggered =
        proliferationTriggeredBy === 'GLUTTONOUS_WILL' &&
        proliferationTriggerReason.indexOf('gluttonous_eat') === 0;
    const isWillHunterTriggered =
        proliferationTriggeredBy === 'WILL_HUNTER_KING' &&
        proliferationTriggerReason.indexOf('will_hunter_king_slash') === 0;
    if (
        !Number.isInteger(spawnMeta.sourceRow) ||
        !Number.isInteger(spawnMeta.sourceCol) ||
        !Number.isInteger(spawnMeta.proliferationOriginRow) ||
        !Number.isInteger(spawnMeta.proliferationOriginCol) ||
        (!isGluttonousTriggered && !isWillHunterTriggered)
    ) {
        return null;
    }
    const overlapOwner = (typeof spawnMeta.projectileOwner === 'string' && spawnMeta.projectileOwner)
        ? spawnMeta.projectileOwner
        : ((typeof spawnMeta.owner === 'string' && spawnMeta.owner) ? spawnMeta.owner : ev && ev.ownerAfter);
    return {
        owner: overlapOwner,
        special: isGluttonousTriggered ? 'GLUTTONOUS' : 'WILL_HUNTER_KING',
        cause: proliferationTriggeredBy,
        reason: isGluttonousTriggered ? 'gluttonous_eat_overlap_return' : 'will_hunter_king_slash_overlap_return',
        from: { r: spawnMeta.sourceRow, col: spawnMeta.sourceCol },
        to: { r: spawnMeta.proliferationOriginRow, col: spawnMeta.proliferationOriginCol },
        meta: spawnMeta,
        includeMetaVisual: true
    };
}

function getGhostBlockedOverlapReturnSpec(ev: any, destroyMeta: any, destroyOutcomeKind: any, isGluttonousEatDestroy: any, isWillHunterKingSlashDestroy: any) {
    if (
        destroyOutcomeKind !== 'ghost_blocked' &&
        destroyOutcomeKind !== 'GHOST_BLOCKED'
    ) {
        return null;
    }
    if (
        !destroyMeta ||
        !Number.isInteger(destroyMeta.sourceRow) ||
        !Number.isInteger(destroyMeta.sourceCol) ||
        (!isGluttonousEatDestroy && !isWillHunterKingSlashDestroy)
    ) {
        return null;
    }
    return {
        owner: (typeof destroyMeta.projectileOwner === 'string' && destroyMeta.projectileOwner)
            ? destroyMeta.projectileOwner
            : null,
        special: isGluttonousEatDestroy ? 'GLUTTONOUS' : 'WILL_HUNTER_KING',
        cause: ev && ev.cause ? ev.cause : null,
        reason: isGluttonousEatDestroy ? 'gluttonous_eat_overlap_return' : 'will_hunter_king_slash_overlap_return',
        from: { r: destroyMeta.sourceRow, col: destroyMeta.sourceCol },
        to: { r: ev && ev.row, col: ev && ev.col },
        meta: destroyMeta,
        includeMetaVisual: false
    };
}

function planSpawnPlayback(phaseState: any, ev: any, playbackBase: any, followsProliferationDestroy: any, deps: BoardEventPlaybackDeps) {
    clearChainFlipPhaseState(phaseState);
    phaseState.prevDestroyCause = null;
    phaseState.prevBatchDestroyKey = null;
    phaseState.durationEndRevertPhase = null;
    phaseState.willHunterKingSlashPhase = null;

    const spawnMeta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
    const overlapSpec = getSpawnOverlapReturnSpec(ev, spawnMeta);
    const spawnProfile = getCardEffectSpawnProfile(ev, deps);
    const sequentialSpawnIndex = spawnMeta && Number.isFinite(Number(spawnMeta.spawnIndex))
        ? Math.trunc(Number(spawnMeta.spawnIndex))
        : null;
    const followsPreservedProliferationDestroy =
        followsProliferationDestroy &&
        isProliferationSpawnPresentationEvent(ev);
    let phase = phaseState.currentPhase;
    const leadingPlaybackEvents = [];

    if (followsPreservedProliferationDestroy && !overlapSpec) {
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
    }
    if (overlapSpec) {
        if (!followsPreservedProliferationDestroy) {
            phaseState.currentPhase++;
        }
        leadingPlaybackEvents.push(createOverlapReturnPlaybackEvent(playbackBase, Object.assign({}, overlapSpec, {
            phase: phaseState.currentPhase
        }), deps));
    }
    if (
        spawnProfile &&
        (
            spawnProfile.alwaysAdvancePhase === true ||
            (sequentialSpawnIndex !== null && sequentialSpawnIndex >= spawnProfile.phaseStartIndex)
        )
    ) {
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
    }
    if (deps.isLivingWillRestorePresentationEvent(ev)) {
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
    }

    const theoryRoulettePlan = createTheorySpawnRoulettePlaybackPlan(phase, ev, spawnMeta, playbackBase);
    if (theoryRoulettePlan) {
        return theoryRoulettePlan;
    }

    let type = 'spawn';
    let targets: any;
    if (isCloneLikeSpawnPresentationEvent(ev, spawnMeta)) {
        if (overlapSpec) {
            phaseState.currentPhase++;
            phase = phaseState.currentPhase;
        }
        type = 'move';
        targets = [{
            from: { r: spawnMeta.fromRow, col: spawnMeta.fromCol },
            to: { r: ev.row, col: ev.col },
            stoneId: ev.stoneId,
            ownerBefore: ev.ownerAfter,
            ownerAfter: ev.ownerAfter,
            cause: ev.cause || null,
            reason: ev.reason || null,
            clone: true
        }];
    } else {
        const spawnTarget: any = {
            r: ev.row,
            col: ev.col,
            stoneId: ev.stoneId,
            ownerAfter: ev.ownerAfter,
            cause: ev.cause || null,
            reason: ev.reason || null
        };
        if (spawnMeta && String(ev && ev.cause ? ev.cause : '').toUpperCase() === deps.stoneSalvationGodCause) {
            if (typeof spawnMeta.destroyedOwner === 'string') spawnTarget.destroyedOwner = spawnMeta.destroyedOwner;
            if (typeof spawnMeta.revivedOwner === 'string') spawnTarget.revivedOwner = spawnMeta.revivedOwner;
        }
        targets = [spawnTarget];
    }

    return {
        phase,
        type,
        targets,
        leadingPlaybackEvents
    };
}

function planDestroyPlayback(phaseState: any, ev: any, destroyMeta: any, playbackBase: any, deps: BoardEventPlaybackDeps) {
    clearChainFlipPhaseState(phaseState);
    phaseState.durationEndRevertPhase = null;
    const destroyCauseUpper = String(ev && ev.cause ? ev.cause : '').toUpperCase();
    const isGluttonousEatDestroy = isGluttonousEatDestroyPresentationEvent(ev);
    const isSuperCrushDestroy = isSuperCrushDestroyPresentationEvent(ev, deps);
    const isWillHunterKingSlashDestroy = isWillHunterKingSlashDestroyPresentationEvent(ev);
    let phase: any;

    if (isGluttonousEatDestroy) {
        phaseState.willHunterKingSlashPhase = null;
        phaseState.superCrushPhase = null;
        phaseState.superCrushActionId = null;
        phase = assignActionScopedPhase(
            phaseState,
            'gluttonousEatPhase',
            'gluttonousEatActionId',
            ev && ev.actionId ? ev.actionId : null
        );
    } else if (isSuperCrushDestroy) {
        phaseState.willHunterKingSlashPhase = null;
        phaseState.gluttonousEatPhase = null;
        phaseState.gluttonousEatActionId = null;
        phaseState.superCrushPhase = assignActionScopedPhase(
            phaseState,
            'superCrushPhase',
            'superCrushActionId',
            ev && ev.actionId ? ev.actionId : null
        );
        phase = phaseState.superCrushPhase;
    } else if (isWillHunterKingSlashDestroy) {
        phaseState.gluttonousEatPhase = null;
        phaseState.gluttonousEatActionId = null;
        phaseState.superCrushPhase = null;
        phaseState.superCrushActionId = null;
        phaseState.currentPhase++;
        phaseState.willHunterKingSlashPhase = phaseState.currentPhase;
        phase = phaseState.willHunterKingSlashPhase;
    } else if (deps.batchDestroyCauses.has(destroyCauseUpper)) {
        clearGroupedDestroyPhaseState(phaseState);
        const actionId = getPresentationActionId(ev);
        const effectBlockId = getPresentationEffectBlockId(ev);
        const batchDestroyKey = (actionId || effectBlockId)
            ? [destroyCauseUpper, actionId || '', effectBlockId || ''].join('|')
            : destroyCauseUpper;
        if (phaseState.prevBatchDestroyKey !== batchDestroyKey) {
            phaseState.currentPhase++;
        }
        phaseState.prevBatchDestroyKey = batchDestroyKey;
        phase = phaseState.currentPhase;
    } else {
        clearGroupedDestroyPhaseState(phaseState);
        phaseState.prevBatchDestroyKey = null;
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
    }

    phaseState.prevDestroyCause = destroyCauseUpper;
    const destroyOutcomeKind = deps.getDestroyOutcomeKind(destroyMeta);
    phaseState.prevWasProliferationDestroy = destroyOutcomeKind === deps.destroyOutcomeKinds.PROLIFERATED;

    const overlapSpec = getGhostBlockedOverlapReturnSpec(
        ev,
        destroyMeta,
        destroyOutcomeKind,
        isGluttonousEatDestroy,
        isWillHunterKingSlashDestroy
    );
    const trailingPlaybackEvents = overlapSpec
        ? [createOverlapReturnPlaybackEvent(playbackBase, Object.assign({}, overlapSpec, { phase }), deps)]
        : [];

    return { phase, trailingPlaybackEvents };
}

function planChangePlaybackPhase(phaseState: any, ev: any, deps: BoardEventPlaybackDeps) {
    phaseState.durationEndRevertPhase = null;
    phaseState.prevDestroyCause = null;
    phaseState.prevBatchDestroyKey = null;
    phaseState.willHunterKingSlashPhase = null;
    const isChainFlip = deps.isChainFlipPresentationEvent(ev);
    const chainFlipLink = isChainFlip ? deps.getChainFlipLink(ev) : null;
    let phase = phaseState.currentPhase;
    if (deps.isLivingWillRestoreChange(ev)) {
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
        phaseState.prevWasChainFlip = false;
        phaseState.prevChainFlipLink = null;
        return phase;
    }
    if (isChainFlip && (!phaseState.prevWasChainFlip || phaseState.prevChainFlipLink !== chainFlipLink)) {
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
    }
    if (deps.isRegenTriggeredChange(ev)) {
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
    }
    phaseState.prevWasChainFlip = isChainFlip;
    phaseState.prevChainFlipLink = isChainFlip ? chainFlipLink : null;
    return phase;
}

function planMovePlaybackPhase(phaseState: any, ev: any, deps: BoardEventPlaybackDeps) {
    clearChainFlipPhaseState(phaseState);
    phaseState.durationEndRevertPhase = null;
    phaseState.prevDestroyCause = null;
    phaseState.prevBatchDestroyKey = null;
    const moveActionId = ev && ev.actionId ? ev.actionId : null;
    const isSuperCrushActionMatched =
        phaseState.superCrushActionId === null ||
        moveActionId === null ||
        phaseState.superCrushActionId === moveActionId;
    const isGluttonousActionMatched =
        phaseState.gluttonousEatActionId === null ||
        moveActionId === null ||
        phaseState.gluttonousEatActionId === moveActionId;
    let phase: any;
    if (isGluttonousEatMovePresentationEvent(ev, deps) && phaseState.gluttonousEatPhase !== null && isGluttonousActionMatched) {
        phase = phaseState.gluttonousEatPhase;
    } else if (isSuperCrushMovePresentationEvent(ev, deps) && phaseState.superCrushPhase !== null && isSuperCrushActionMatched) {
        phase = phaseState.superCrushPhase;
    } else if (isWillHunterKingSlashMovePresentationEvent(ev, deps) && phaseState.willHunterKingSlashPhase !== null) {
        phase = phaseState.willHunterKingSlashPhase;
    } else {
        phaseState.currentPhase++;
        phase = phaseState.currentPhase;
    }
    phaseState.gluttonousEatPhase = null;
    phaseState.gluttonousEatActionId = null;
    phaseState.superCrushPhase = null;
    phaseState.superCrushActionId = null;
    phaseState.willHunterKingSlashPhase = null;
    return phase;
}

function getPresentationEffectBlockKey(ev: any) {
    if (!ev || (ev.type !== 'DESTROY' && ev.type !== 'MOVE')) return null;
    const meta = (ev.meta && typeof ev.meta === 'object') ? ev.meta : {};
    const effectBlockId = String(ev.effectBlockId || meta.effectBlockId || '').trim();
    if (effectBlockId) return `effectBlock:${effectBlockId}`;
    const cause = String(ev.cause || '').toUpperCase();
    const sourceRow = Number.isInteger(ev.sourceRow)
        ? ev.sourceRow
        : (Number.isInteger(meta.sourceRow) ? meta.sourceRow : null);
    const sourceCol = Number.isInteger(ev.sourceCol)
        ? ev.sourceCol
        : (Number.isInteger(meta.sourceCol) ? meta.sourceCol : null);
    const projectileOwner = String(ev.projectileOwner || meta.projectileOwner || '').trim();
    const actionId = String(ev.actionId || '').trim();
    return [
        actionId,
        cause,
        sourceRow === null ? '' : String(sourceRow),
        sourceCol === null ? '' : String(sourceCol),
        projectileOwner
    ].join('|');
}

function orderDeferredSpawnsForPlayback(presEvents: any, deps: BoardEventPlaybackDeps) {
    if (!Array.isArray(presEvents) || presEvents.length <= 1) return Array.isArray(presEvents) ? presEvents.slice() : [];
    const ordered: any[] = [];
    const pendingSpawns: any[] = [];
    let currentBlockKey: string | null = null;
    const flushSpawns = () => {
        if (!pendingSpawns.length) return;
        ordered.push(...pendingSpawns);
        pendingSpawns.length = 0;
    };

    for (const ev of presEvents) {
        if (isDeferredSpawnPresentationEvent(ev, deps)) {
            pendingSpawns.push(ev);
            continue;
        }
        const nextBlockKey = getPresentationEffectBlockKey(ev);
        if (!nextBlockKey) {
            flushSpawns();
            currentBlockKey = null;
        } else if (pendingSpawns.length && currentBlockKey === null) {
            flushSpawns();
        } else if (pendingSpawns.length && currentBlockKey !== null && nextBlockKey !== currentBlockKey) {
            flushSpawns();
        }
        ordered.push(ev);
        currentBlockKey = nextBlockKey;
    }
    flushSpawns();
    return ordered;
}

const PipelineUIBoardEventPlaybackModule = {
    clearChainFlipPhaseState,
    createExtremeForcedSwapPlaybackEvent,
    createPlaybackEvent,
    createPlaybackEventBase,
    createPlaybackPhaseState,
    findExtremeForcedSwapMovePairPresentationIndex,
    isBoardShrinkHoleStatusAppliedPresentationEvent,
    isDeferredSpawnPresentationEvent,
    orderDeferredSpawnsForPlayback,
    planChangePlaybackPhase,
    planDestroyPlayback,
    planDurationEndRevertPlaybackPhase,
    planMovePlaybackPhase,
    planSpawnPlayback,
    preparePassivePlaybackPhaseState
};

export = PipelineUIBoardEventPlaybackModule;
