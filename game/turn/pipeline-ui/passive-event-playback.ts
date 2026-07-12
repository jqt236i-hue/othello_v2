type PassiveEventPlaybackContext = {
    ev: any;
    phaseState: any;
    pEvent: any;
    playbackBase: any;
    playbackEvents: any[];
    presentationEvents: any[];
};

type PassiveEventPlaybackDeps = {
    normalizePlayerKey: (value: any) => any;
    preparePassivePlaybackPhaseState: (phaseState: any, options?: any) => any;
    isBoardShrinkHoleStatusAppliedPresentationEvent: (ev: any) => boolean;
    isLivingWillConsumedStatus: (ev: any) => boolean;
    hasLivingWillTriggeredDestroyPresentationEventAt: (presentationEvents: any[], row: any, col: any) => boolean;
    hasLivingWillRestoreChangePresentationEventAt: (presentationEvents: any[], row: any, col: any) => boolean;
    planDestroyPlayback: (phaseState: any, ev: any, destroyMeta: any, playbackBase: any) => any;
    livingWillCause: string;
    livingWillConsumedReason: string;
    isSpecialDurationExpiredStatusRemovedEvent: (ev: any) => boolean;
    isRegenConsumedStatus: (ev: any) => boolean;
    planDurationEndRevertPlaybackPhase: (phaseState: any, hasPriorPlaybackEvent: any) => any;
    createCardVisualDescriptor: (cardId: any, meta: any) => any;
    resolveWorkIncomeBubbleText: (ev: any) => any;
    resolveWorkRemovedBubbleText: (ev: any) => any;
    isWorkDurationExpiredPresentationEvent: (ev: any) => boolean;
    hasLivingWillRestorePresentationEventForSource: (presentationEvents: any[], row: any, col: any, special: any) => boolean;
    createPlaybackEvent: (playbackBase: any, type: any, phase: any, targets: any) => any;
    hasDurationEndMarker: (reason: any, cause?: any) => boolean;
    isManifestStoneType: (rawType: any) => boolean;
};

function getEventMeta(ev: any) {
    return (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : null;
}

function getSacrificeWillMeta(meta: any) {
    return (meta && meta.sacrificeWill && typeof meta.sacrificeWill === 'object')
        ? meta.sacrificeWill
        : null;
}

function getBubbleOwner(ev: any) {
    return ev.owner || ev.player || (ev.meta && ev.meta.owner) || null;
}

function getTrimmedText(primary: any, fallback: any) {
    const primaryText = typeof primary === 'string' ? primary.trim() : '';
    if (primaryText) return primaryText;
    const fallbackText = typeof fallback === 'string' ? fallback.trim() : '';
    return fallbackText || null;
}

function pushObserverBubblePlaybackEvent(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps, targets: any, rawType: any) {
    ctx.playbackEvents.push(Object.assign(
        deps.createPlaybackEvent(ctx.playbackBase, 'observer_bubble', ctx.phaseState.currentPhase, targets),
        { rawType }
    ));
}

function mapPlayHandAnimation(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    const ownerKey = deps.normalizePlayerKey(ctx.ev.owner || ctx.ev.player);
    ctx.pEvent.type = 'place_hand_animation';
    ctx.pEvent.phase = 0;
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        player: ownerKey,
        owner: ownerKey
    }];
}

function mapStatusApplied(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    if (!deps.isBoardShrinkHoleStatusAppliedPresentationEvent(ctx.ev)) {
        deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    }
    ctx.pEvent.type = 'status_applied';
    ctx.pEvent.targets = [{ r: ctx.ev.row, col: ctx.ev.col }];
}

function mapStatusTick(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    ctx.pEvent.type = 'status_applied';
    ctx.pEvent.targets = [{ r: ctx.ev.row, col: ctx.ev.col }];
}

function mapLivingWillConsumedStatus(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    if (
        deps.hasLivingWillTriggeredDestroyPresentationEventAt(ctx.presentationEvents, ctx.ev.row, ctx.ev.col) ||
        deps.hasLivingWillRestoreChangePresentationEventAt(ctx.presentationEvents, ctx.ev.row, ctx.ev.col)
    ) {
        ctx.pEvent.type = null;
        ctx.pEvent.targets = [];
        return;
    }
    const livingWillMeta = getEventMeta(ctx.ev);
    const destroyPlan = deps.planDestroyPlayback(
        ctx.phaseState,
        {
            type: 'DESTROY',
            row: ctx.ev.row,
            col: ctx.ev.col,
            cause: deps.livingWillCause,
            reason: deps.livingWillConsumedReason
        },
        livingWillMeta,
        ctx.playbackBase
    );
    ctx.pEvent.type = 'destroy';
    ctx.pEvent.phase = destroyPlan.phase;
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        ownerBefore: livingWillMeta && livingWillMeta.owner ? livingWillMeta.owner : null,
        cause: deps.livingWillCause,
        reason: deps.livingWillConsumedReason,
        meta: livingWillMeta
    }];
}

function isManifestDurationEndStatusRemoved(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    const meta = getEventMeta(ctx.ev);
    const special = String((meta && meta.special) || ctx.ev.special || '').trim();
    if (!special || !deps.isManifestStoneType(special)) return false;
    const reason = (meta && meta.reason) || ctx.ev.reason || '';
    const cause = ctx.ev.cause || (meta && meta.cause) || '';
    return deps.hasDurationEndMarker(reason, cause);
}

function mapStatusRemoved(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    if (deps.isLivingWillConsumedStatus(ctx.ev)) {
        mapLivingWillConsumedStatus(ctx, deps);
        return;
    }
    const isManifestEnding = isManifestDurationEndStatusRemoved(ctx, deps);
    const preserveDurationEndRevert = deps.isSpecialDurationExpiredStatusRemovedEvent(ctx.ev);
    deps.preparePassivePlaybackPhaseState(ctx.phaseState, {
        preserveDurationEndRevert: preserveDurationEndRevert || isManifestEnding
    });
    ctx.pEvent.type = isManifestEnding ? 'manifest_ending' : 'status_removed';
    ctx.pEvent.targets = [{ r: ctx.ev.row, col: ctx.ev.col }];
    if (deps.isRegenConsumedStatus(ctx.ev)) {
        ctx.phaseState.currentPhase++;
        ctx.pEvent.phase = ctx.phaseState.currentPhase;
    } else if (preserveDurationEndRevert || isManifestEnding) {
        ctx.pEvent.phase = deps.planDurationEndRevertPlaybackPhase(ctx.phaseState, ctx.playbackEvents.length > 0);
    }
}

function mapHandRemove(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    ctx.pEvent.type = 'hand_remove';
    ctx.pEvent.targets = [{
        player: ctx.ev.player || null,
        count: Number.isFinite(ctx.ev.count) ? ctx.ev.count : 0,
        reason: ctx.ev.reason || null,
        cardId: ctx.ev.cardId || null,
        cardIds: Array.isArray(ctx.ev.cardIds) ? ctx.ev.cardIds.slice() : null
    }];
    ctx.phaseState.currentPhase++;
    ctx.pEvent.phase = ctx.phaseState.currentPhase;
}

function mapHandAdd(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    const evMeta = getEventMeta(ctx.ev);
    const handAddReason = ctx.ev.reason || (evMeta && evMeta.reason) || null;
    const isCaptureWillHandAdd = String(handAddReason || '').trim().toLowerCase() === 'capture_will';
    const handAddVisualDescriptor = deps.createCardVisualDescriptor(ctx.ev.cardId || null, evMeta || null);
    ctx.pEvent.type = isCaptureWillHandAdd ? 'capture_to_hand_animation' : 'hand_add';
    ctx.pEvent.targets = [{
        player: ctx.ev.player || null,
        cardId: ctx.ev.cardId || null,
        count: Number.isFinite(ctx.ev.count) ? ctx.ev.count : 1,
        reason: handAddReason,
        sourceType: evMeta && evMeta.sourceType ? evMeta.sourceType : null,
        sourceCardId: evMeta && evMeta.sourceCardId ? evMeta.sourceCardId : null,
        sourceName: evMeta && evMeta.sourceName ? evMeta.sourceName : null,
        sourceSpecialType: evMeta && evMeta.sourceSpecialType ? evMeta.sourceSpecialType : null,
        sourceRow: evMeta && Number.isInteger(evMeta.sourceRow) ? evMeta.sourceRow : null,
        sourceCol: evMeta && Number.isInteger(evMeta.sourceCol) ? evMeta.sourceCol : null,
        sourceOwner: evMeta && evMeta.sourceOwner ? evMeta.sourceOwner : null,
        stoneId: evMeta && Number.isInteger(evMeta.stoneId) ? evMeta.stoneId : null,
        insertIndex: evMeta && Number.isInteger(evMeta.insertIndex) ? evMeta.insertIndex : null,
        generatedName: evMeta && evMeta.generatedName ? evMeta.generatedName : null,
        visualDescriptor: handAddVisualDescriptor
    }];
    ctx.phaseState.currentPhase++;
    ctx.pEvent.phase = ctx.phaseState.currentPhase;
}

function mapCardUsed(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    const evMeta = getEventMeta(ctx.ev);
    const visualDescriptor = deps.createCardVisualDescriptor(ctx.ev.cardId || null, evMeta || null);
    ctx.pEvent.type = 'card_use_animation';
    ctx.pEvent.targets = [{
        player: ctx.ev.player || null,
        owner: (evMeta && evMeta.owner) ? evMeta.owner : (ctx.ev.player || null),
        cardId: ctx.ev.cardId || null,
        cardType: (evMeta && evMeta.cardType) ? evMeta.cardType : null,
        cost: (evMeta && Number.isFinite(evMeta.cost)) ? evMeta.cost : null,
        name: (evMeta && evMeta.name) ? evMeta.name : null,
        nullifiedBySacrificeWill: !!(evMeta && evMeta.nullifiedBySacrificeWill === true),
        cardUseVanishEffect: (evMeta && evMeta.cardUseVanishEffect) ? evMeta.cardUseVanishEffect : null,
        sacrificeWill: getSacrificeWillMeta(evMeta),
        visualDescriptor
    }];
    ctx.phaseState.currentPhase++;
    ctx.pEvent.phase = ctx.phaseState.currentPhase;
}

function mapWorkIncome(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    ctx.pEvent.type = 'log';
    ctx.pEvent.targets = [];
    if (!Number.isInteger(ctx.ev.row) || !Number.isInteger(ctx.ev.col)) return;
    pushObserverBubblePlaybackEvent(ctx, deps, [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        owner: getBubbleOwner(ctx.ev),
        gained: Number(ctx.ev.gained) || 0,
        text: deps.resolveWorkIncomeBubbleText(ctx.ev),
        incomeStep: Number.isFinite(Number(ctx.ev.incomeStep))
            ? Number(ctx.ev.incomeStep)
            : (Number.isFinite(Number(ctx.ev.meta && ctx.ev.meta.incomeStep)) ? Number(ctx.ev.meta.incomeStep) : null)
    }], 'WORK_BUBBLE');
}

function mapWorkRemoved(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    const isDurationExpired = deps.isWorkDurationExpiredPresentationEvent(ctx.ev);
    deps.preparePassivePlaybackPhaseState(ctx.phaseState, {
        preserveDurationEndRevert: isDurationExpired
    });
    ctx.pEvent.type = 'log';
    ctx.pEvent.targets = [];
    if (isDurationExpired) {
        ctx.pEvent.phase = deps.planDurationEndRevertPlaybackPhase(ctx.phaseState, ctx.playbackEvents.length > 0);
    }
    if (
        isDurationExpired ||
        !Number.isInteger(ctx.ev.row) ||
        !Number.isInteger(ctx.ev.col) ||
        deps.hasLivingWillRestorePresentationEventForSource(ctx.presentationEvents, ctx.ev.row, ctx.ev.col, 'WORK') ||
        ctx.presentationEvents.some((candidate: any) => (
            candidate && candidate.type === 'SPECIAL_STONE_BUBBLE' && candidate.special === 'WORK' &&
            Number(candidate.row) === Number(ctx.ev.row) && Number(candidate.col) === Number(ctx.ev.col)
        ))
    ) {
        return;
    }
    pushObserverBubblePlaybackEvent(ctx, deps, [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        owner: getBubbleOwner(ctx.ev),
        gained: 0,
        text: deps.resolveWorkRemovedBubbleText(ctx.ev)
    }], 'WORK_BUBBLE');
}

function mapWorkBubble(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState, { clearWillHunter: false });
    ctx.pEvent.type = 'observer_bubble';
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        owner: getBubbleOwner(ctx.ev),
        gained: Number(ctx.ev.gained) || 0,
        text: getTrimmedText(ctx.ev.text, deps.resolveWorkIncomeBubbleText(ctx.ev))
    }];
}

function resolveSpecialStoneBubbleScenario(ev: any) {
    return getTrimmedText(ev && ev.scenario, ev && ev.meta && ev.meta.scenario);
}

function resolveSpecialStoneBubbleReason(ev: any, scenario: any) {
    return getTrimmedText(ev && ev.reason, ev && ev.meta && ev.meta.reason) || scenario;
}

function resolveSpecialStoneBubbleCause(ev: any) {
    return getTrimmedText(ev && ev.cause, ev && ev.meta && ev.meta.cause);
}

function resolveSpecialStoneBubbleSpecial(ev: any) {
    return getTrimmedText(ev && ev.special, ev && ev.meta && ev.meta.special);
}

function mapSpecialStoneBubble(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    const bubbleScenario = resolveSpecialStoneBubbleScenario(ctx.ev);
    const bubbleReason = resolveSpecialStoneBubbleReason(ctx.ev, bubbleScenario);
    const bubbleCause = resolveSpecialStoneBubbleCause(ctx.ev);
    const special = resolveSpecialStoneBubbleSpecial(ctx.ev);
    deps.preparePassivePlaybackPhaseState(ctx.phaseState, {
        clearWillHunter: false,
        preserveDurationEndRevert: deps.hasDurationEndMarker(bubbleScenario || bubbleReason, bubbleCause)
    });
    if (
        (bubbleScenario === 'destroy' || bubbleScenario === 'duration_end' || bubbleScenario === 'escape_exploded') &&
        deps.hasLivingWillRestorePresentationEventForSource(ctx.presentationEvents, ctx.ev.row, ctx.ev.col, special)
    ) {
        ctx.pEvent.type = null;
        ctx.pEvent.targets = [];
        return;
    }
    ctx.pEvent.type = 'observer_bubble';
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        owner: getBubbleOwner(ctx.ev),
        gained: Number(ctx.ev.gained) || 0,
        text: getTrimmedText(ctx.ev.text, ctx.ev.meta && ctx.ev.meta.text),
        special,
        scenario: bubbleScenario,
        reason: bubbleReason
    }];
}

function mapObserverBubble(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    ctx.pEvent.type = 'observer_bubble';
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        owner: getBubbleOwner(ctx.ev),
        gained: Number(ctx.ev.gained) || 0,
        text: getTrimmedText(ctx.ev.text, ctx.ev.meta && ctx.ev.meta.text)
    }];
}

function mapRoundBonusBanner(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    ctx.pEvent.type = 'round_bonus_banner';
    ctx.pEvent.targets = [{
        amount: Number(ctx.ev.amount) || 0,
        roundNumber: Number(ctx.ev.roundNumber) || 0,
        durationMs: Number(ctx.ev.durationMs) || 2200,
        text: getTrimmedText(ctx.ev.text, null)
    }];
}

function mapChargeBubble(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    deps.preparePassivePlaybackPhaseState(ctx.phaseState);
    ctx.pEvent.phase = ctx.phaseState.currentPhase;
    ctx.pEvent.type = 'observer_bubble';
    ctx.pEvent.targets = [{
        r: ctx.ev.row,
        col: ctx.ev.col,
        owner: getBubbleOwner(ctx.ev),
        gained: Number(ctx.ev.gained) || 0,
        text: getTrimmedText(ctx.ev.text, null),
        bubbleKind: 'charge',
        sourceType: (ctx.ev.meta && ctx.ev.meta.sourceType) ? ctx.ev.meta.sourceType : null
    }];
}

function mapPassivePresentationEvent(ctx: PassiveEventPlaybackContext, deps: PassiveEventPlaybackDeps) {
    switch (ctx.ev && ctx.ev.type) {
        case 'PLAY_HAND_ANIMATION':
            mapPlayHandAnimation(ctx, deps);
            return true;
        case 'STATUS_APPLIED':
            mapStatusApplied(ctx, deps);
            return true;
        case 'STATUS_TICK':
            mapStatusTick(ctx, deps);
            return true;
        case 'STATUS_REMOVED':
            mapStatusRemoved(ctx, deps);
            return true;
        case 'HAND_CLEAR':
        case 'HAND_REMOVE':
            mapHandRemove(ctx, deps);
            return true;
        case 'DRAW_CARD':
        case 'HAND_ADD':
            mapHandAdd(ctx, deps);
            return true;
        case 'CARD_USED':
            mapCardUsed(ctx, deps);
            return true;
        case 'WORK_INCOME':
            mapWorkIncome(ctx, deps);
            return true;
        case 'WORK_REMOVED':
            mapWorkRemoved(ctx, deps);
            return true;
        case 'WORK_BUBBLE':
            mapWorkBubble(ctx, deps);
            return true;
        case 'SPECIAL_STONE_BUBBLE':
            mapSpecialStoneBubble(ctx, deps);
            return true;
        case 'OBSERVER_BUBBLE':
            mapObserverBubble(ctx, deps);
            return true;
        case 'ROUND_BONUS_BANNER':
            mapRoundBonusBanner(ctx, deps);
            return true;
        case 'CHARGE_BUBBLE':
            mapChargeBubble(ctx, deps);
            return true;
        default:
            return false;
    }
}

module.exports = {
    mapPassivePresentationEvent
};
