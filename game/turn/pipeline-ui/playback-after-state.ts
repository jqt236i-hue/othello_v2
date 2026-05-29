type PlaybackAfterStateDeps = {
    getVisualSpecialFromMeta: (meta: any) => any;
    shouldPreferFinalVisualStateForStatusApplied: (eventSpecialRaw: any, visualSpecial: any, livingWillAura: any) => boolean;
    getPrimaryTimerFromMeta: (meta: any) => any;
    getInheritedTimerFromMeta: (meta: any) => any;
    getInheritedOwnerFromMeta: (meta: any) => any;
    getFlipEvadeRemainingFromMeta: (meta: any) => any;
    getInheritedFlipEvadeRemainingFromMeta: (meta: any) => any;
    getDestroyEvadeRemainingFromMeta: (meta: any) => any;
    getVisualStateAt: (row: any, col: any, cardState: any, gameState: any) => any;
};

function ownerToColor(owner: any) {
    if (owner === 'black' || owner === 1 || owner === '1') return 1;
    if (owner === 'white' || owner === -1 || owner === '-1') return -1;
    return 0;
}

function createEmptyVisualState() {
    return {
        color: 0,
        special: null,
        timer: null,
        owner: null,
        inheritedTimer: null,
        inheritedOwner: null,
        flipEvadeRemaining: null,
        inheritedFlipEvadeRemaining: null,
        destroyEvadeRemaining: null,
        livingWillAura: false
    };
}

function createEventSourcedVisual(target: any, targetMeta: any, ownerHint: any, deps: PlaybackAfterStateDeps) {
    const visualOwner = (targetMeta && targetMeta.owner) || ((ownerHint === 'black' || ownerHint === 'white') ? ownerHint : null);
    return {
        color: ownerToColor(ownerHint || (targetMeta && targetMeta.owner)),
        special: deps.getVisualSpecialFromMeta(targetMeta),
        timer: deps.getPrimaryTimerFromMeta(targetMeta),
        owner: visualOwner,
        inheritedTimer: deps.getInheritedTimerFromMeta(targetMeta),
        inheritedOwner: deps.getInheritedOwnerFromMeta(targetMeta),
        flipEvadeRemaining: deps.getFlipEvadeRemainingFromMeta(targetMeta),
        inheritedFlipEvadeRemaining: deps.getInheritedFlipEvadeRemainingFromMeta(targetMeta),
        destroyEvadeRemaining: deps.getDestroyEvadeRemainingFromMeta(targetMeta),
        livingWillAura: targetMeta && targetMeta.livingWillAura === true
    };
}

function createEventSourcedAfter(target: any, targetMeta: any, deps: PlaybackAfterStateDeps) {
    return createEventSourcedVisual(target, targetMeta, target && target.ownerAfter, deps);
}

function createEventSourcedBefore(target: any, targetMeta: any, deps: PlaybackAfterStateDeps) {
    return createEventSourcedVisual(target, targetMeta, target && target.ownerBefore, deps);
}

function createMoveAfter(target: any, targetMeta: any, deps: PlaybackAfterStateDeps) {
    return createEventSourcedVisual(target, targetMeta, target && target.ownerAfter, deps);
}

function createMoveBefore(target: any, targetMeta: any, deps: PlaybackAfterStateDeps) {
    return createEventSourcedVisual(target, targetMeta, target && target.ownerBefore, deps);
}

function createStatusBefore(playbackType: any, presentationEvent: any, target: any, finalCardState: any, finalGameState: any, deps: PlaybackAfterStateDeps) {
    const eventMeta = presentationEvent && presentationEvent.meta && typeof presentationEvent.meta === 'object'
        ? presentationEvent.meta
        : null;
    const ownerFromEvent = (eventMeta && eventMeta.owner) || (target && target.ownerBefore) || null;
    const visual = deps.getVisualStateAt(target.r, target.col, finalCardState, finalGameState);
    const before = createEventSourcedVisual(target, eventMeta, ownerFromEvent, deps);
    if (before.color === 0 && visual && (visual.color === 1 || visual.color === -1)) {
        before.color = visual.color;
    }
    if (!before.owner && visual && visual.owner) {
        before.owner = visual.owner;
    }
    if (playbackType === 'status_applied') {
        before.special = null;
        before.timer = null;
        before.inheritedTimer = null;
        before.inheritedOwner = null;
        before.flipEvadeRemaining = null;
        before.inheritedFlipEvadeRemaining = null;
        before.destroyEvadeRemaining = null;
        before.livingWillAura = false;
    }
    return before;
}

function createStatusAfter(playbackType: any, presentationEvent: any, target: any, finalCardState: any, finalGameState: any, deps: PlaybackAfterStateDeps) {
    const visual = deps.getVisualStateAt(target.r, target.col, finalCardState, finalGameState);
    const eventMeta = presentationEvent && presentationEvent.meta && typeof presentationEvent.meta === 'object'
        ? presentationEvent.meta
        : null;
    const specialFromEventRaw = (eventMeta && eventMeta.special) || null;
    const specialFromEvent = deps.getVisualSpecialFromMeta(eventMeta);
    const ownerFromEvent = (eventMeta && eventMeta.owner) || null;
    const inheritedTimerFromEvent = deps.getInheritedTimerFromMeta(eventMeta);
    const inheritedOwnerFromEvent = deps.getInheritedOwnerFromMeta(eventMeta);
    const flipEvadeRemainingFromEvent = deps.getFlipEvadeRemainingFromMeta(eventMeta);
    const inheritedFlipEvadeRemainingFromEvent = deps.getInheritedFlipEvadeRemainingFromMeta(eventMeta);
    const destroyEvadeRemainingFromEvent = deps.getDestroyEvadeRemainingFromMeta(eventMeta);
    const isStatusRemoved = playbackType === 'status_removed';
    const preferFinalVisualStateForApply = !isStatusRemoved &&
        deps.shouldPreferFinalVisualStateForStatusApplied(
            specialFromEventRaw,
            visual.special || null,
            visual.livingWillAura === true
        );
    let color = visual.color || 0;
    if (color === 0 && (specialFromEventRaw === 'TRAP' || specialFromEventRaw === 'TRAP_REVEAL')) {
        if (ownerFromEvent === 'black' || ownerFromEvent === 1 || ownerFromEvent === '1') color = 1;
        if (ownerFromEvent === 'white' || ownerFromEvent === -1 || ownerFromEvent === '-1') color = -1;
    }
    const specialForVisual = isStatusRemoved
        ? (visual.special || null)
        : (preferFinalVisualStateForApply ? (visual.special || null) : (specialFromEvent || visual.special || null));
    const timerForVisual = isStatusRemoved
        ? (visual.timer || null)
        : (preferFinalVisualStateForApply ? (visual.timer || null) : ((eventMeta && eventMeta.timer) || visual.timer || null));
    const ownerForVisual = isStatusRemoved
        ? (visual.owner || null)
        : (preferFinalVisualStateForApply ? (visual.owner || ownerFromEvent || null) : (ownerFromEvent || visual.owner || null));
    const inheritedTimerForVisual = isStatusRemoved
        ? (visual.inheritedTimer || null)
        : (preferFinalVisualStateForApply ? (visual.inheritedTimer || null) : (inheritedTimerFromEvent || visual.inheritedTimer || null));
    const inheritedOwnerForVisual = isStatusRemoved
        ? (visual.inheritedOwner || null)
        : (preferFinalVisualStateForApply ? (visual.inheritedOwner || null) : (inheritedOwnerFromEvent || visual.inheritedOwner || null));
    const flipEvadeRemainingForVisual = isStatusRemoved
        ? (visual.flipEvadeRemaining ?? null)
        : (preferFinalVisualStateForApply
            ? (visual.flipEvadeRemaining ?? null)
            : ((flipEvadeRemainingFromEvent ?? visual.flipEvadeRemaining) ?? null));
    const inheritedFlipEvadeRemainingForVisual = isStatusRemoved
        ? (visual.inheritedFlipEvadeRemaining ?? null)
        : (preferFinalVisualStateForApply
            ? (visual.inheritedFlipEvadeRemaining ?? null)
            : ((inheritedFlipEvadeRemainingFromEvent ?? visual.inheritedFlipEvadeRemaining) ?? null));
    const destroyEvadeRemainingForVisual = isStatusRemoved
        ? (visual.destroyEvadeRemaining ?? null)
        : (preferFinalVisualStateForApply
            ? (visual.destroyEvadeRemaining ?? null)
            : ((destroyEvadeRemainingFromEvent ?? visual.destroyEvadeRemaining) ?? null));
    return {
        color,
        special: specialForVisual,
        timer: timerForVisual,
        owner: ownerForVisual,
        inheritedTimer: inheritedTimerForVisual,
        inheritedOwner: inheritedOwnerForVisual,
        flipEvadeRemaining: flipEvadeRemainingForVisual,
        inheritedFlipEvadeRemaining: inheritedFlipEvadeRemainingForVisual,
        destroyEvadeRemaining: destroyEvadeRemainingForVisual,
        livingWillAura: visual.livingWillAura === true
    };
}

function populatePlaybackEventAfterState(playbackEvent: any, presentationEvent: any, finalCardState: any, finalGameState: any, deps: PlaybackAfterStateDeps) {
    if (!playbackEvent || playbackEvent.type === 'log' || playbackEvent.type === 'card_use_animation' || playbackEvent.type === 'observer_bubble') {
        return playbackEvent;
    }
    const eventMeta = (presentationEvent && presentationEvent.meta && typeof presentationEvent.meta === 'object')
        ? presentationEvent.meta
        : null;
    const targets = Array.isArray(playbackEvent.targets) ? playbackEvent.targets : [];
    for (const target of targets) {
        const targetMeta = (target && target.meta && typeof target.meta === 'object') ? target.meta : eventMeta;
        if (playbackEvent.type === 'spawn') {
            target.before = target.before || createEmptyVisualState();
            target.after = target.after || createEventSourcedAfter(target, targetMeta, deps);
        } else if (playbackEvent.type === 'move') {
            target.before = target.before || createMoveBefore(target, targetMeta, deps);
            target.after = target.after || createMoveAfter(target, targetMeta, deps);
        } else if (playbackEvent.type === 'destroy') {
            target.before = target.before || createEventSourcedBefore(target, targetMeta, deps);
            target.after = target.after || createEmptyVisualState();
        } else if (playbackEvent.type === 'status_applied' || playbackEvent.type === 'status_removed') {
            target.before = target.before || createStatusBefore(playbackEvent.type, presentationEvent, target, finalCardState, finalGameState, deps);
            target.after = target.after || createStatusAfter(playbackEvent.type, presentationEvent, target, finalCardState, finalGameState, deps);
        } else if (target.ownerAfter !== undefined) {
            target.before = target.before || createEventSourcedBefore(target, targetMeta, deps);
            target.after = target.after || createEventSourcedAfter(target, targetMeta, deps);
        } else {
            target.before = target.before || createEmptyVisualState();
            target.after = target.after || createEmptyVisualState();
        }
    }
    return playbackEvent;
}

module.exports = {
    populatePlaybackEventAfterState
};
