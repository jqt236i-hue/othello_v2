export {};

type AnimationMoveEventDeps = {
    eventTypes: any;
    moveMs: any;
    effectTargetHighlightClass: string;
    effectTargetPositiveHighlightClass: string;
    highlightToneNegative: string;
    highlightTonePositive: string;
    isNoAnim: () => boolean;
    getCellEl: (row: any, col: any) => any;
    createDisc: (state: any) => any;
    getTargetCause: (target: any) => string;
    getTargetReason: (target: any) => string;
    resolveEffectTargetHighlightTone: (eventType: any, target: any) => any;
    resolveMoveDurationScale: (target: any) => any;
    waitForAnimationFinish: (animation: any, durationMs: any, timeoutBufferMs: any) => Promise<any>;
    syncDiscVisual: (disc: any, after: any) => any;
    removeDiscFromCell: (cell: any, disc: any) => any;
    layoutBatch?: {
        readRect?: (element: any) => any;
    } | null;
};

function readElementRect(element: any, deps: AnimationMoveEventDeps) {
    if (!element) return null;
    const batch = deps && deps.layoutBatch;
    if (batch && typeof batch.readRect === 'function') {
        const rect = batch.readRect(element);
        if (rect) return rect;
    }
    return typeof element.getBoundingClientRect === 'function'
        ? element.getBoundingClientRect()
        : null;
}

function getMoveSemantics(target: any, deps: AnimationMoveEventDeps) {
    const cause = deps.getTargetCause(target);
    const reason = deps.getTargetReason(target);
    const moveIntent = String(target && target.meta && target.meta.moveIntent ? target.meta.moveIntent : '').toLowerCase();
    const extremeForcedSwapRole = String(target && target.extremeForcedSwapRole ? target.extremeForcedSwapRole : '').toLowerCase();
    const isPositionSwapMove =
        moveIntent === 'position_swap' ||
        cause === 'POSITION_SWAP_WILL' ||
        reason === 'position_swap';
    const isFlipEvadeMove =
        moveIntent === 'evade_move' ||
        reason.indexOf('flip_evade_move') >= 0;
    const isDestroyEvadeMove =
        moveIntent === 'evade_move' ||
        cause === 'DESTROY_EVADE' ||
        reason.indexOf('destroy_evade_move') === 0;
    const isTeleportMove =
        moveIntent === 'teleport_move' ||
        cause === 'CELL_TELEPORT_WILL' ||
        cause === 'TELEPORT_WILL' ||
        reason === 'teleport_move';
    const isCloneMove = !!(target && target.clone === true);
    const isOverlapReturnMove =
        (cause === 'GLUTTONOUS_WILL' && reason.indexOf('gluttonous_eat_overlap_return') === 0) ||
        (cause === 'WILL_HUNTER_KING' && reason.indexOf('will_hunter_king_slash_overlap_return') === 0);
    const isExtremeForcedSwapMove =
        extremeForcedSwapRole === 'lead' &&
        cause === 'EXTREME_HYPERACTIVE_WILL' &&
        reason.indexOf('extreme_hyperactive_forced_swap') === 0;
    const isHyperactiveLikeMove = (
        moveIntent === 'hyperactive_move' ||
        moveIntent === 'anchor_move' ||
        cause === 'HYPERACTIVE' ||
        cause === 'AFTERIMAGE_WILL' ||
        cause === 'ESCAPE_HYPERACTIVE' ||
        cause === 'EXTREME_HYPERACTIVE_WILL' ||
        cause === 'ULTIMATE_REVERSE_DRAGON' ||
        cause === 'ULTIMATE_DESTROY_GOD' ||
        cause === 'ROBOT_VACUUM' ||
        cause === 'GLUTTONOUS_WILL' ||
        cause === 'ULTIMATE_HYPERACTIVE' ||
        cause === 'ULTIMATE_HYPERACTIVE_GOD' ||
        reason.indexOf('ultimate_reverse_dragon_move') === 0 ||
        reason.indexOf('ultimate_destroy_god_move') === 0 ||
        reason.indexOf('afterimage_will_flip_evade_move') === 0 ||
        reason.indexOf('hyperactive') >= 0 ||
        reason.indexOf('gluttonous') >= 0 ||
        reason.indexOf('robot_vacuum_move') === 0
    );
    return {
        cause,
        reason,
        moveIntent,
        isPositionSwapMove,
        isFlipEvadeMove,
        isDestroyEvadeMove,
        isTeleportMove,
        isCloneMove,
        isOverlapReturnMove,
        isExtremeForcedSwapMove,
        isHyperactiveLikeMove,
        shouldHighlightBothCells: isPositionSwapMove,
        shouldHideDestinationDiscDuringGhostPlayback:
            !isOverlapReturnMove && !isExtremeForcedSwapMove && (isCloneMove || isHyperactiveLikeMove),
        useGhostOnlyByDefault: isCloneMove || isOverlapReturnMove
    };
}

function getMoveHighlightCells(fromCell: any, toCell: any, moveSemantics: any) {
    if (!moveSemantics) return [toCell];
    if (moveSemantics.shouldHighlightBothCells) return [fromCell, toCell];
    return (moveSemantics.isDestroyEvadeMove || moveSemantics.isFlipEvadeMove) ? [fromCell] : [toCell];
}

function ensureMoveDiscVisible(discEl: any) {
    if (!discEl) return;
    try {
        discEl.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant', 'destroy-fade', 'shatter');
    } catch (e: any) { /* ignore */ }
    try { discEl.style.visibility = 'visible'; } catch (e: any) { /* ignore */ }
    try { discEl.style.opacity = ''; } catch (e: any) { /* ignore */ }
}

function normalizeWaypointPosition(rawPoint: any) {
    const row = Number(rawPoint && rawPoint.row);
    const col = Number(rawPoint && rawPoint.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function resolveMoveWaypointDeltas(target: any, fromRect: any, deps: AnimationMoveEventDeps) {
    const meta = (target && target.meta && typeof target.meta === 'object') ? target.meta : null;
    const rawWaypoints = Array.isArray(meta && meta.waypoints) ? meta.waypoints : [];
    const destination = target && target.to ? { row: Number(target.to.r), col: Number(target.to.col) } : null;
    const normalizedWaypoints = rawWaypoints
        .map((point: any) => normalizeWaypointPosition(point))
        .filter((point: any) => !!point);
    if (
        destination &&
        Number.isInteger(destination.row) &&
        Number.isInteger(destination.col) &&
        !normalizedWaypoints.some((point: any) => point.row === destination.row && point.col === destination.col)
    ) {
        normalizedWaypoints.push(destination);
    }
    if (normalizedWaypoints.length <= 0) return [];

    const out = [];
    for (const point of normalizedWaypoints) {
        const cell = deps.getCellEl(point.row, point.col);
        const rect = readElementRect(cell, deps);
        if (!rect) return [];
        out.push({
            deltaX: rect.left - fromRect.left,
            deltaY: rect.top - fromRect.top
        });
    }
    return out;
}

function resolveMovePathBreakOffsets(target: any) {
    const meta = (target && target.meta && typeof target.meta === 'object') ? target.meta : null;
    const segments = Array.isArray(meta && meta.segments) ? meta.segments : [];
    if (segments.length <= 1) return [];

    const totalLength = segments.reduce((sum: number, segment: any) => {
        const length = Number(segment && segment.length);
        return sum + (Number.isFinite(length) && length > 0 ? length : 0);
    }, 0);
    if (!(totalLength > 0)) return [];

    let travelled = 0;
    const out = [];
    for (let index = 0; index < segments.length - 1; index += 1) {
        const length = Number(segments[index] && segments[index].length);
        travelled += Number.isFinite(length) && length > 0 ? length : 0;
        out.push(Math.max(0, Math.min(1, travelled / totalLength)));
    }
    return out;
}

function buildMoveGhostAnimationSpec(
    moveSemantics: any,
    deltaX: any,
    deltaY: any,
    waypointDeltas: Array<{ deltaX: number; deltaY: number }> = [],
    breakOffsets: number[] = []
) {
    const normalizedCause = String(moveSemantics && moveSemantics.cause ? moveSemantics.cause : '').toUpperCase();
    const normalizedReason = String(moveSemantics && moveSemantics.reason ? moveSemantics.reason : '').toLowerCase();
    const normalizedIntent = String(moveSemantics && moveSemantics.moveIntent ? moveSemantics.moveIntent : '').toLowerCase();
    const pathDeltas = Array.isArray(waypointDeltas) && waypointDeltas.length > 0
        ? waypointDeltas
        : [{ deltaX, deltaY }];
    const finalDelta = pathDeltas[pathDeltas.length - 1] || { deltaX, deltaY };
    const defaultSpec = {
        keyframes: [
            { transform: 'translate(0, 0)' },
            { transform: `translate(${finalDelta.deltaX}px, ${finalDelta.deltaY}px)` }
        ],
        easing: 'cubic-bezier(0.2, 0.85, 0.3, 1)'
    };
    const absX = Math.abs(finalDelta.deltaX);
    const absY = Math.abs(finalDelta.deltaY);
    const dominantTravel = Math.max(absX, absY);
    if (dominantTravel <= 0) return defaultSpec;

    if (normalizedIntent === 'wind_move' || normalizedCause === 'STRONG_WIND_WILL' || normalizedReason.indexOf('strong_wind_move') === 0) {
        const gustOffset = Math.max(10, Math.round(dominantTravel * 0.14));
        const gustX = absX >= absY
            ? Math.round(deltaX * 0.58)
            : Math.round(deltaX * 0.54) + (deltaX >= 0 ? gustOffset : -gustOffset);
        const gustY = absX >= absY
            ? Math.round(deltaY * 0.54) - gustOffset
            : Math.round(deltaY * 0.58);
        return {
            keyframes: [
                { transform: 'translate(0, 0) scale(1)' },
                { transform: `translate(${gustX}px, ${gustY}px) scale(1.08)` },
                { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` }
            ],
            easing: 'cubic-bezier(0.14, 0.92, 0.24, 1)'
        };
    }

    if (
        normalizedCause === 'BUOYANCY_WILL' ||
        normalizedCause === 'SUPER_BUOYANCY_WILL' ||
        (normalizedIntent === 'crush_move' && normalizedReason.indexOf('buoyancy_move') === 0) ||
        (normalizedIntent === 'crush_move' && normalizedReason.indexOf('super_buoyancy_move') === 0)
    ) {
        const lift = Math.max(18, Math.round(dominantTravel * 0.2));
        return {
            keyframes: [
                { transform: 'translate(0, 0) scale(1)' },
                { transform: `translate(${Math.round(deltaX * 0.45)}px, ${Math.round(deltaY * 0.45) - lift}px) scale(1.06)` },
                { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` }
            ],
            easing: 'cubic-bezier(0.12, 0.88, 0.28, 1)'
        };
    }

    if (
        normalizedCause === 'GRAVITY_WILL' ||
        normalizedCause === 'SUPER_GRAVITY_WILL' ||
        normalizedCause === 'SUPER_ATTRACTION_WILL' ||
        (normalizedIntent === 'crush_move' && normalizedReason.indexOf('super_attraction_move') === 0) ||
        (normalizedIntent === 'crush_move' && normalizedReason.indexOf('gravity_move') === 0) ||
        (normalizedIntent === 'crush_move' && normalizedReason.indexOf('super_gravity_move') === 0)
    ) {
        if (
            normalizedCause === 'SUPER_ATTRACTION_WILL' &&
            pathDeltas.length > 1
        ) {
            const keyframes = [{ transform: 'translate(0, 0) scale(1)', offset: 0 }];
            for (let index = 0; index < pathDeltas.length; index += 1) {
                const point = pathDeltas[index];
                const isLast = index === pathDeltas.length - 1;
                const offset = isLast
                    ? 1
                    : Math.max(0, Math.min(1, Number(breakOffsets[index]) || ((index + 1) / pathDeltas.length)));
                keyframes.push({
                    transform: isLast
                        ? `translate(${Math.round(point.deltaX)}px, ${Math.round(point.deltaY)}px) scale(1)`
                        : `translate(${Math.round(point.deltaX)}px, ${Math.round(point.deltaY)}px) scale(1.05)`,
                    offset
                });
            }
            return {
                keyframes,
                easing: 'cubic-bezier(0.36, 0.08, 0.74, 0.98)'
            };
        }

        const drop = Math.max(20, Math.round(dominantTravel * 0.22));
        return {
            keyframes: [
                { transform: 'translate(0, 0) scale(1)' },
                { transform: `translate(${Math.round(deltaX * 0.7)}px, ${Math.round(deltaY * 0.7) + drop}px) scale(1.05)` },
                { transform: `translate(${deltaX}px, ${deltaY}px) scale(1)` }
            ],
            easing: 'cubic-bezier(0.36, 0.08, 0.74, 0.98)'
        };
    }

    if (moveSemantics && moveSemantics.isOverlapReturnMove) {
        const overlapScale = normalizedCause === 'WILL_HUNTER_KING' ? 1.06 : 1.03;
        return {
            keyframes: [
                { transform: 'translate(0, 0) scale(1)' },
                { transform: `translate(${deltaX}px, ${deltaY}px) scale(${overlapScale})` },
                { transform: 'translate(0, 0) scale(1)' }
            ],
            easing: 'cubic-bezier(0.22, 0.78, 0.32, 1)'
        };
    }

    if (moveSemantics && moveSemantics.isExtremeForcedSwapMove) {
        return {
            keyframes: [
                { transform: 'translate(0, 0) scale(1)' },
                { transform: `translate(${Math.round(deltaX * 0.65)}px, ${Math.round(deltaY * 0.65)}px) scale(1.03)` },
                { transform: `translate(${deltaX}px, ${deltaY}px) scale(1.06)` }
            ],
            easing: 'cubic-bezier(0.18, 0.82, 0.28, 1)'
        };
    }

    return defaultSpec;
}

function resolveMoveFallbackState(target: any) {
    const hasBeforeState = target && target.before && (target.before.color === 1 || target.before.color === -1);
    const hasAfterState = target && target.after && (target.after.color === 1 || target.after.color === -1);
    let fallbackState = null;
    if (hasBeforeState) {
        fallbackState = target.before;
    } else if (hasAfterState) {
        fallbackState = target.after;
    } else {
        fallbackState = {
            color: (target && target.ownerAfter === 'black') ? 1 : ((target && target.ownerAfter === 'white') ? -1 : 0),
            special: target && target.after ? target.after.special : null,
            timer: target && target.after ? target.after.timer : null,
            owner: (target && target.after && target.after.owner) || (target && target.ownerAfter) || null
        };
    }
    if (fallbackState.color !== 1 && fallbackState.color !== -1) return null;
    return fallbackState;
}

function resolveMoveDiscContext(fromCell: any, toCell: any, target: any, moveSemantics: any, deps: AnimationMoveEventDeps) {
    let disc = fromCell.querySelector('.disc');
    let sourceCell = fromCell;
    let useGhostOnly = !!(moveSemantics && moveSemantics.useGhostOnlyByDefault);

    if (!disc) {
        const toDisc = toCell.querySelector('.disc');
        if (toDisc) {
            disc = toDisc;
            sourceCell = toCell;
        }
    }

    if (!disc) {
        const fallbackState = resolveMoveFallbackState(target);
        if (!fallbackState) return null;
        disc = deps.createDisc(fallbackState);
        useGhostOnly = true;
    }

    return { disc, sourceCell, useGhostOnly };
}

function moveLiveDiscToDestination(fromCell: any, toCell: any, sourceCell: any, disc: any) {
    if (!disc || !toCell) return null;
    toCell.innerHTML = '';
    ensureMoveDiscVisible(disc);
    toCell.appendChild(disc);
    toCell.classList.add('has-disc');
    if (sourceCell === fromCell) {
        fromCell.innerHTML = '';
        fromCell.classList.remove('has-disc');
    }
    return disc;
}

function syncMoveTargetDiscVisual(target: any, disc: any, deps: AnimationMoveEventDeps) {
    if (!disc || !(target && target.after && (target.after.color === 1 || target.after.color === -1))) return disc;
    try {
        deps.syncDiscVisual(disc, target.after);
    } catch (e: any) { /* ignore */ }
    return disc;
}

function applyImmediateGhostOnlyMoveTarget(target: any, toCell: any, disc: any, deps: AnimationMoveEventDeps) {
    if (!toCell) return null;
    toCell.innerHTML = '';
    const targetDisc = (target && target.after && (target.after.color === 1 || target.after.color === -1))
        ? deps.createDisc(target.after)
        : disc;
    if (!targetDisc) return null;
    ensureMoveDiscVisible(targetDisc);
    toCell.appendChild(targetDisc);
    toCell.classList.add('has-disc');
    return targetDisc;
}

function setCellDiscFromState(cell: any, state: any, deps: AnimationMoveEventDeps) {
    if (!cell) return null;
    cell.innerHTML = '';
    cell.classList.remove('has-disc');
    if (!state || (state.color !== 1 && state.color !== -1)) return null;
    const disc = deps.createDisc(state);
    ensureMoveDiscVisible(disc);
    cell.appendChild(disc);
    cell.classList.add('has-disc');
    return disc;
}

function ensureAnimatedCloneMoveTarget(target: any, toCell: any, deps: AnimationMoveEventDeps) {
    if (!toCell) return null;
    const existingTargetDisc = toCell.querySelector('.disc');
    if (existingTargetDisc) return existingTargetDisc;
    if (!(target && target.after && (target.after.color === 1 || target.after.color === -1))) return null;
    const targetDisc = deps.createDisc(target.after);
    ensureMoveDiscVisible(targetDisc);
    toCell.appendChild(targetDisc);
    toCell.classList.add('has-disc');
    return targetDisc;
}

function hideMoveDestinationDiscForGhostPlayback(toCell: any, disc: any, moveSemantics: any) {
    if (!toCell || !moveSemantics || !moveSemantics.shouldHideDestinationDiscDuringGhostPlayback) return null;
    const liveTargetDisc = toCell.querySelector('.disc');
    if (liveTargetDisc && liveTargetDisc !== disc) {
        liveTargetDisc.style.visibility = 'hidden';
        return liveTargetDisc;
    }
    return null;
}

function hideMoveSourceDiscForGhostPlayback(disc: any, useGhostOnly: any, moveSemantics: any) {
    const shouldHideSourceDisc = !!disc && (!useGhostOnly || (moveSemantics && moveSemantics.isOverlapReturnMove));
    if (!shouldHideSourceDisc) return false;
    disc.style.visibility = 'hidden';
    return true;
}

function createMoveGhost(disc: any, fromRect: any) {
    const ghost = disc.cloneNode(true);
    ghost.classList.remove('destroy-fade', 'shatter');
    ghost.classList.add('stone-instant');
    document.body.appendChild(ghost);

    const discScale = 0.82;
    const discInsetRatio = (1 - discScale) / 2;
    ghost.style.position = 'fixed';
    ghost.style.top = `${fromRect.top + fromRect.height * discInsetRatio}px`;
    ghost.style.left = `${fromRect.left + fromRect.width * discInsetRatio}px`;
    ghost.style.width = `${fromRect.width * discScale}px`;
    ghost.style.height = `${fromRect.height * discScale}px`;
    ghost.style.margin = '0';
    ghost.style.zIndex = '1000';
    return ghost;
}

function createMoveGhostFromState(state: any, fromRect: any, deps: AnimationMoveEventDeps) {
    if (!state || (state.color !== 1 && state.color !== -1)) return null;
    if (typeof document === 'undefined' || !document || !document.body) return null;
    const ghost = deps.createDisc(state);
    ghost.classList.remove('destroy-fade', 'shatter');
    ghost.classList.add('stone-instant');
    document.body.appendChild(ghost);

    const discScale = 0.82;
    const discInsetRatio = (1 - discScale) / 2;
    ghost.style.position = 'fixed';
    ghost.style.top = `${fromRect.top + fromRect.height * discInsetRatio}px`;
    ghost.style.left = `${fromRect.left + fromRect.width * discInsetRatio}px`;
    ghost.style.width = `${fromRect.width * discScale}px`;
    ghost.style.height = `${fromRect.height * discScale}px`;
    ghost.style.margin = '0';
    ghost.style.zIndex = '1000';
    return ghost;
}

function settleMoveGhostIntoCell(ghost: any, cell: any, after: any, deps: AnimationMoveEventDeps) {
    if (!ghost || !cell) return null;
    try {
        if (ghost.parentElement && ghost.parentElement !== cell) {
            ghost.parentElement.removeChild(ghost);
        }
    } catch (e: any) { /* ignore */ }
    try {
        ghost.classList.remove('stone-instant');
        ghost.style.position = '';
        ghost.style.top = '';
        ghost.style.left = '';
        ghost.style.width = '';
        ghost.style.height = '';
        ghost.style.margin = '';
        ghost.style.zIndex = '';
        ghost.style.pointerEvents = '';
        ghost.style.transform = '';
        ghost.style.visibility = 'visible';
        ghost.style.opacity = '';
        ghost.style.transition = '';
    } catch (e: any) { /* ignore */ }
    cell.innerHTML = '';
    cell.appendChild(ghost);
    cell.classList.add('has-disc');
    if (after && (after.color === 1 || after.color === -1)) {
        try { deps.syncDiscVisual(ghost, after); } catch (e: any) { /* ignore */ }
    }
    return ghost;
}

function cleanupMoveGhostPlayback(ghost: any, hiddenTargetDisc: any, discHidden: any, disc: any) {
    if (ghost && ghost.parentElement) {
        ghost.parentElement.removeChild(ghost);
    }
    if (hiddenTargetDisc) {
        try { ensureMoveDiscVisible(hiddenTargetDisc); } catch (e: any) { /* ignore */ }
    }
    if (discHidden) {
        try { ensureMoveDiscVisible(disc); } catch (e: any) { /* ignore */ }
    }
}

function isValidMoveCellPosition(position: any) {
    return !!(
        position &&
        Number.isInteger(position.r) &&
        Number.isInteger(position.col)
    );
}

function hasRenderableDiscState(state: any) {
    return !!(state && (state.color === 1 || state.color === -1));
}

function canApplyExtremeForcedSwapFinalState(lead: any, follow: any) {
    return hasRenderableDiscState(lead && lead.after) &&
        hasRenderableDiscState(follow && follow.after);
}

function applyExtremeForcedSwapFinalState(returnCell: any, overlapCell: any, leadAfter: any, followAfter: any, deps: AnimationMoveEventDeps) {
    if (returnCell) {
        setCellDiscFromState(returnCell, followAfter || null, deps);
    }
    if (overlapCell) {
        setCellDiscFromState(overlapCell, leadAfter || null, deps);
    }
}

function isExtremeForcedSwapMoveEvent(ev: any, deps: AnimationMoveEventDeps) {
    const sequence = String(ev && ev.meta && ev.meta.sequence ? ev.meta.sequence : '').toLowerCase();
    if (sequence === 'extreme_hyperactive_forced_swap') return true;
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    if (targets.length !== 2) return false;
    return targets.every((target: any) => {
        const cause = String(deps.getTargetCause(target) || '').toUpperCase();
        const reason = String(deps.getTargetReason(target) || '').toLowerCase();
        return cause === 'EXTREME_HYPERACTIVE_WILL' && reason === 'extreme_hyperactive_forced_swap';
    });
}

function resolveExtremeForcedSwapMoveTargets(ev: any) {
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    if (targets.length !== 2) return null;
    let lead = targets.find((target: any) => String(target && target.extremeForcedSwapRole ? target.extremeForcedSwapRole : '').toLowerCase() === 'lead') || null;
    let follow = targets.find((target: any) => String(target && target.extremeForcedSwapRole ? target.extremeForcedSwapRole : '').toLowerCase() === 'follow') || null;
    if (!lead || !follow) {
        [lead, follow] = targets;
    }
    if (
        !lead ||
        !follow ||
        !isValidMoveCellPosition(lead.from) ||
        !isValidMoveCellPosition(lead.to) ||
        !isValidMoveCellPosition(follow.from) ||
        !isValidMoveCellPosition(follow.to)
    ) {
        return null;
    }
    if (
        lead.to.r !== follow.from.r ||
        lead.to.col !== follow.from.col ||
        lead.from.r !== follow.to.r ||
        lead.from.col !== follow.to.col
    ) {
        return null;
    }
    return { lead, follow };
}

async function handleExtremeForcedSwapMove(ev: any, deps: AnimationMoveEventDeps) {
    const pairedTargets = resolveExtremeForcedSwapMoveTargets(ev);
    if (!pairedTargets) return false;

    const lead = pairedTargets.lead;
    const follow = pairedTargets.follow;
    const fromCell = deps.getCellEl(lead.from.r, lead.from.col);
    const overlapCell = deps.getCellEl(lead.to.r, lead.to.col);
    const returnCell = deps.getCellEl(follow.to.r, follow.to.col);
    const canApplyFinalState = canApplyExtremeForcedSwapFinalState(lead, follow);
    const leadGhostState = resolveMoveFallbackState(lead);
    const followGhostState = resolveMoveFallbackState(follow);
    if (!fromCell || !overlapCell || !returnCell) {
        if (canApplyFinalState) {
            applyExtremeForcedSwapFinalState(returnCell || fromCell, overlapCell, lead.after, follow.after, deps);
            return true;
        }
        return false;
    }
    if (!leadGhostState || !followGhostState) {
        if (canApplyFinalState) {
            applyExtremeForcedSwapFinalState(returnCell, overlapCell, lead.after, follow.after, deps);
            return true;
        }
        return false;
    }

    const leadSemantics = getMoveSemantics(lead, deps);
    const returnSemantics = getMoveSemantics(follow, deps);
    let highlightedCells: any[] = [];
    let overlapGhost: any = null;
    let returnGhost: any = null;
    const docBody = (typeof document !== 'undefined' && document && document.body) ? document.body : null;
    const sourceDisc = fromCell.querySelector('.disc');
    const occupiedDisc = overlapCell.querySelector('.disc');

    try {
        if (deps.resolveEffectTargetHighlightTone(deps.eventTypes.MOVE, lead)) {
            const cellsToHighlight = getMoveHighlightCells(fromCell, overlapCell, leadSemantics);
            for (const oneCell of cellsToHighlight) {
                if (!oneCell || highlightedCells.indexOf(oneCell) >= 0) continue;
                try {
                    oneCell.classList.add(deps.effectTargetHighlightClass);
                    highlightedCells.push(oneCell);
                } catch (e: any) { /* ignore */ }
            }
        }

        const noAnim = deps.isNoAnim();
        if (noAnim || leadSemantics.isTeleportMove) {
            if (!canApplyFinalState) return false;
            applyExtremeForcedSwapFinalState(returnCell, overlapCell, lead.after, follow.after, deps);
            return true;
        }

        ensureMoveDiscVisible(sourceDisc);
        ensureMoveDiscVisible(occupiedDisc);
        if (sourceDisc) sourceDisc.style.visibility = 'hidden';
        if (occupiedDisc) occupiedDisc.style.visibility = 'hidden';

        const overlapFromRect = readElementRect(fromCell, deps);
        const overlapToRect = readElementRect(overlapCell, deps);
        if (!overlapFromRect || !overlapToRect) {
            if (!canApplyFinalState) return false;
            applyExtremeForcedSwapFinalState(returnCell, overlapCell, lead.after, follow.after, deps);
            return true;
        }
        overlapGhost = createMoveGhostFromState(lead.after || leadGhostState, overlapFromRect, deps);
        if (!overlapGhost) {
            if (!canApplyFinalState) return false;
            applyExtremeForcedSwapFinalState(returnCell, overlapCell, lead.after, follow.after, deps);
            return true;
        }

        try {
            const overlapDurationMs = Math.max(1, Math.round(deps.moveMs));
            let overlapAnim: any = null;
            if (typeof overlapGhost.animate === 'function') {
                try {
                    const overlapSpec = buildMoveGhostAnimationSpec(
                        leadSemantics,
                        overlapToRect.left - overlapFromRect.left,
                        overlapToRect.top - overlapFromRect.top
                    );
                    overlapAnim = overlapGhost.animate(overlapSpec.keyframes, {
                        duration: overlapDurationMs,
                        easing: overlapSpec.easing
                    });
                } catch (e: any) {
                    overlapAnim = null;
                }
            }
            if (overlapAnim) {
                await deps.waitForAnimationFinish(overlapAnim, overlapDurationMs, 220);
            }
            deps.removeDiscFromCell(fromCell, sourceDisc);
            deps.removeDiscFromCell(overlapCell, occupiedDisc);
            overlapGhost = settleMoveGhostIntoCell(overlapGhost, overlapCell, lead.after || null, deps);
        } finally {
            if (docBody && overlapGhost && overlapGhost.parentElement && overlapGhost.parentElement === docBody) {
                overlapGhost.parentElement.removeChild(overlapGhost);
            }
        }

        const returnFromRect = readElementRect(overlapCell, deps);
        const returnToRect = readElementRect(returnCell, deps);
        if (!returnFromRect || !returnToRect) {
            if (!canApplyFinalState) return false;
            applyExtremeForcedSwapFinalState(returnCell, overlapCell, lead.after, follow.after, deps);
            return true;
        }
        returnGhost = createMoveGhostFromState(follow.after || followGhostState, returnFromRect, deps);
        if (!returnGhost) {
            if (!canApplyFinalState) return false;
            applyExtremeForcedSwapFinalState(returnCell, overlapCell, lead.after, follow.after, deps);
            return true;
        }

        try {
            const returnDurationMs = Math.max(1, Math.round(deps.moveMs));
            let returnAnim: any = null;
            if (typeof returnGhost.animate === 'function') {
                try {
                    const returnSpec = buildMoveGhostAnimationSpec(
                        returnSemantics,
                        returnToRect.left - returnFromRect.left,
                        returnToRect.top - returnFromRect.top
                    );
                    returnAnim = returnGhost.animate(returnSpec.keyframes, {
                        duration: returnDurationMs,
                        easing: returnSpec.easing
                    });
                } catch (e: any) {
                    returnAnim = null;
                }
            }
            if (returnAnim) {
                await deps.waitForAnimationFinish(returnAnim, returnDurationMs, 220);
            }
            returnGhost = settleMoveGhostIntoCell(returnGhost, returnCell, follow.after || null, deps);
        } finally {
            if (docBody && returnGhost && returnGhost.parentElement === docBody) {
                returnGhost.parentElement.removeChild(returnGhost);
            }
        }
        return true;
    } finally {
        if (sourceDisc && sourceDisc.parentElement) {
            try { ensureMoveDiscVisible(sourceDisc); } catch (e: any) { /* ignore */ }
        }
        if (occupiedDisc && occupiedDisc.parentElement) {
            try { ensureMoveDiscVisible(occupiedDisc); } catch (e: any) { /* ignore */ }
        }
        for (const highlightedCell of highlightedCells) {
            try { highlightedCell.classList.remove(deps.effectTargetHighlightClass); } catch (e: any) { /* ignore */ }
        }
    }
}

async function handleMoveEvent(ev: any, deps: AnimationMoveEventDeps) {
    if (isExtremeForcedSwapMoveEvent(ev, deps)) {
        const handled = await handleExtremeForcedSwapMove(ev, deps);
        if (handled) return;
    }
    const moveTargets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    const promises = moveTargets.map(async (target: any) => {
        if (!target || !isValidMoveCellPosition(target.from) || !isValidMoveCellPosition(target.to)) return;
        const fromCell = deps.getCellEl(target.from.r, target.from.col);
        const toCell = deps.getCellEl(target.to.r, target.to.col);
        if (!fromCell || !toCell) return;

        const moveSemantics = getMoveSemantics(target, deps);

        let highlightedCells: any[] = [];
        try {
            const highlightTone = deps.resolveEffectTargetHighlightTone(deps.eventTypes.MOVE, target);
            const highlightClass = highlightTone === deps.highlightTonePositive
                ? deps.effectTargetPositiveHighlightClass
                : (highlightTone === deps.highlightToneNegative ? deps.effectTargetHighlightClass : null);
            if (highlightClass) {
                const cellsToHighlight = getMoveHighlightCells(fromCell, toCell, moveSemantics);
                for (const oneCell of cellsToHighlight) {
                    if (!oneCell || highlightedCells.some((entry) => entry.cell === oneCell && entry.className === highlightClass)) continue;
                    try {
                        oneCell.classList.add(highlightClass);
                        highlightedCells.push({ cell: oneCell, className: highlightClass });
                    } catch (e: any) { /* ignore */ }
                }
            }

            const moveContext = resolveMoveDiscContext(fromCell, toCell, target, moveSemantics, deps);
            if (!moveContext) return;
            const disc = moveContext.disc;
            const sourceCell = moveContext.sourceCell;
            const useGhostOnly = moveContext.useGhostOnly;
            ensureMoveDiscVisible(disc);

            const fromRect = readElementRect(fromCell, deps);
            const toRect = readElementRect(toCell, deps);
            if (!fromRect || !toRect) return;
            const deltaX = toRect.left - fromRect.left;
            const deltaY = toRect.top - fromRect.top;
            const waypointDeltas = resolveMoveWaypointDeltas(target, fromRect, deps);
            const breakOffsets = resolveMovePathBreakOffsets(target);
            const noAnim = deps.isNoAnim();

            if (noAnim || moveSemantics.isTeleportMove) {
                try {
                    if (moveSemantics.isOverlapReturnMove) {
                        return;
                    }
                    let targetDisc: any = null;
                    if (!useGhostOnly) {
                        targetDisc = moveLiveDiscToDestination(fromCell, toCell, sourceCell, disc);
                    } else {
                        targetDisc = applyImmediateGhostOnlyMoveTarget(target, toCell, disc, deps);
                    }
                    syncMoveTargetDiscVisual(target, targetDisc, deps);

                    if (moveSemantics.isTeleportMove && !noAnim && targetDisc && typeof targetDisc.animate === 'function') {
                        const durationMs = 140;
                        const anim = targetDisc.animate([
                            { opacity: 0.25, transform: 'scale(0.5)' },
                            { opacity: 1, transform: 'scale(1)' }
                        ], {
                            duration: durationMs,
                            easing: 'cubic-bezier(0.18, 0.9, 0.3, 1)'
                        });
                        await deps.waitForAnimationFinish(anim, durationMs, 120);
                    }
                } catch (e: any) {
                    /* best-effort */
                }
                return;
            }

            const hiddenTargetDisc = hideMoveDestinationDiscForGhostPlayback(toCell, disc, moveSemantics);
            const ghost = createMoveGhost(disc, fromRect);
            let discHidden = hideMoveSourceDiscForGhostPlayback(disc, useGhostOnly, moveSemantics);

            try {
                const durationScale = deps.resolveMoveDurationScale(moveSemantics);
                const durationMs = Math.max(1, Math.round(deps.moveMs * durationScale));

                let anim: any = null;
                if (typeof ghost.animate === 'function') {
                    try {
                        const animationSpec = buildMoveGhostAnimationSpec(moveSemantics, deltaX, deltaY, waypointDeltas, breakOffsets);
                        anim = ghost.animate(animationSpec.keyframes, {
                            duration: durationMs,
                            easing: animationSpec.easing
                        });
                    } catch (e: any) {
                        anim = null;
                    }
                }

                if (!anim) {
                    if (!useGhostOnly) {
                        moveLiveDiscToDestination(fromCell, toCell, sourceCell, disc);
                        discHidden = false;
                    } else if (moveSemantics.isCloneMove) {
                        ensureAnimatedCloneMoveTarget(target, toCell, deps);
                    }
                    return;
                }

                await deps.waitForAnimationFinish(anim, durationMs, 220);

                if (!useGhostOnly) {
                    const targetDisc = moveLiveDiscToDestination(fromCell, toCell, sourceCell, disc);
                    syncMoveTargetDiscVisual(target, targetDisc, deps);
                    discHidden = false;
                } else if (moveSemantics.isCloneMove) {
                    const targetDisc = ensureAnimatedCloneMoveTarget(target, toCell, deps);
                    syncMoveTargetDiscVisual(target, targetDisc, deps);
                }
            } finally {
                cleanupMoveGhostPlayback(ghost, hiddenTargetDisc, discHidden, disc);
            }
        } finally {
            for (const highlightedCell of highlightedCells) {
                try { highlightedCell.cell.classList.remove(highlightedCell.className); } catch (e: any) { /* ignore */ }
            }
        }
    });
    await Promise.all(promises);
}

module.exports = {
    handleMoveEvent
};
