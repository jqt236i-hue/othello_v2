export {};

type AnimationStatusEventDeps = {
    eventTypes: any;
    visuals: any;
    overlayCrossfadeMs: any;
    regenConsumeFadeMs: any;
    getCellEl: (row: any, col: any) => any;
    resolveStatusChangeHighlightTone: (ev: any, target: any) => any;
    runWithTransientCellHighlight: (cell: any, highlightTone: any, runner: any, minimumVisibleMs: any, extraClasses: any[]) => Promise<any>;
    resolveStatusChangeHighlightMinimumMs: (highlightTone: any) => any;
    waitForDisc: (row: any, col: any, retries: any) => Promise<any>;
    syncDiscTimerOnly: (disc: any, after: any) => any;
    fadeOutFreezeOverlay: (cell: any, durationMs: any) => Promise<any>;
    crossfadeDiscToState: (disc: any, after: any, durationMs: any) => Promise<any>;
    isBoardShrinkHoleStatusChange: (ev: any, target: any) => boolean;
    playBoardShrinkHolePushIn: (cell: any) => Promise<any>;
    removeDiscFromCell: (cell: any, disc: any) => any;
    resolveVisualColorFromState: (visualAfter: any, disc: any, visualOwner: any) => any;
    syncDiscVisual: (disc: any, visualAfter: any) => any;
};

function isCausalReplayCellRestoration(ev: any): boolean {
    const meta = (ev && ev.meta && typeof ev.meta === 'object') ? ev.meta : {};
    const cause = String(meta.cellRestorationCause || '').toUpperCase();
    if (cause === 'CAUSAL_REPLAY_WILL') return true;
    const reason = String(meta.reason || ev && ev.reason || '').toLowerCase();
    const restoredAs = String(meta.restoredAs || '').toLowerCase();
    return reason === 'causal_replay_selected' && restoredAs === 'normal_empty_cell';
}

function clearRestoredHoleCellPresentation(cell: any): void {
    if (!cell || !cell.classList) return;
    try {
        cell.classList.remove(
            'blocked-cell',
            'meteor-hole-cell',
            'board-shrink-hole-cell',
            'selectable-friendly',
            'selectable-friendly-no-circle'
        );
    } catch (e) { /* ignore */ }
    try {
        const marks = cell.querySelectorAll
            ? cell.querySelectorAll('.meteor-hole-mark, .board-shrink-hole-mark, .blockade-mark')
            : [];
        marks.forEach((mark: any) => {
            try {
                if (mark && mark.parentNode) mark.parentNode.removeChild(mark);
            } catch (e) { /* ignore */ }
        });
    } catch (e) { /* ignore */ }
}

async function handleStatusChangeEvent(ev: any, deps: AnimationStatusEventDeps) {
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    const promises = targets.map(async (target: any) => {
        const cell = deps.getCellEl(target.r, target.col);
        if (!cell) return;

        const highlightTone = deps.resolveStatusChangeHighlightTone(ev, target);
        await deps.runWithTransientCellHighlight(
            cell,
            highlightTone,
            async () => {
                const after = target.after || {};
                const rawType = String(ev && ev.rawType ? ev.rawType : '').toUpperCase();
                const afterSpecialUpper = String(after && after.special ? after.special : '').toUpperCase();
                const isStatusTick = rawType === 'STATUS_TICK';
                const statusRemoveReason = String(
                    (ev && ev.meta && ev.meta.reason) ||
                    (ev && ev.reason) ||
                    ''
                ).toLowerCase();
                const removedSpecialUpper = String(ev && ev.meta && ev.meta.special ? ev.meta.special : '').toUpperCase();
                const poisonSpecialUpper = removedSpecialUpper || String(ev && ev.meta && ev.meta.special || '').toUpperCase();
                const isPoisonStatus = poisonSpecialUpper === 'POISONED' || poisonSpecialUpper === 'POISON_CELL';
                const isFreezeDurationEnd =
                    ev &&
                    ev.type === deps.eventTypes.STATUS_REMOVED &&
                    removedSpecialUpper === 'FREEZE' &&
                    statusRemoveReason === 'duration_end' &&
                    !after.special;

                if (isStatusTick) {
                    if (isPoisonStatus) {
                        const selector = poisonSpecialUpper === 'POISONED' ? '.poison-status-badge' : '.poison-cell-turn';
                        const timer = cell.querySelector(selector);
                        if (timer && ev.meta && Number.isFinite(Number(ev.meta.timer))) timer.textContent = String(Math.max(0, Math.trunc(Number(ev.meta.timer))));
                        return;
                    }
                    const disc = await deps.waitForDisc(target.r, target.col, 4);
                    if (!disc) return;
                    deps.syncDiscTimerOnly(disc, after);
                    return;
                }

                if (isFreezeDurationEnd) {
                    await deps.fadeOutFreezeOverlay(cell, deps.overlayCrossfadeMs);
                    return;
                }

                if (isPoisonStatus) return;

                if (isCausalReplayCellRestoration(ev)) {
                    clearRestoredHoleCellPresentation(cell);
                    return;
                }

                if (afterSpecialUpper === 'METEOR_HOLE') {
                    if (deps.isBoardShrinkHoleStatusChange(ev, target)) {
                        await deps.playBoardShrinkHolePushIn(cell);
                        return;
                    }
                    const staleDisc = cell.querySelector('.disc');
                    if (staleDisc) deps.removeDiscFromCell(cell, staleDisc);
                    return;
                }

                const disc = await deps.waitForDisc(target.r, target.col, 4);
                if (!disc) return;

                const isRegenConsumed =
                    ev &&
                    ev.type === deps.eventTypes.STATUS_REMOVED &&
                    ev.meta &&
                    ev.meta.special === 'REGEN' &&
                    ev.meta.reason === 'regen_consumed' &&
                    !after.special;

                const isLossWillReset =
                    ev &&
                    ev.type === deps.eventTypes.STATUS_REMOVED &&
                    ev.meta &&
                    ev.meta.reason === 'loss_will_reset' &&
                    !after.special;

                if (isRegenConsumed) {
                    await deps.crossfadeDiscToState(disc, after, deps.regenConsumeFadeMs);
                    return;
                }

                if (isLossWillReset) {
                    await deps.crossfadeDiscToState(disc, after, deps.overlayCrossfadeMs);
                    return;
                }

                const visualSpecialType = after.special;
                const effectKey = window.getEffectKeyForSpecialType(visualSpecialType);
                const metaOwner = (ev && ev.meta && Object.prototype.hasOwnProperty.call(ev.meta, 'owner'))
                    ? ev.meta.owner
                    : null;
                const visualOwner = (Object.prototype.hasOwnProperty.call(after, 'owner')
                    && after.owner !== null
                    && typeof after.owner !== 'undefined'
                    && after.owner !== '')
                    ? after.owner
                    : metaOwner;
                const visualAfter = Object.assign({}, after);
                const resolvedVisualColor = deps.resolveVisualColorFromState(
                    visualAfter,
                    disc,
                    visualOwner
                );
                if ((visualAfter.owner === null || typeof visualAfter.owner === 'undefined' || visualAfter.owner === '')
                    && visualOwner !== null
                    && typeof visualOwner !== 'undefined'
                    && visualOwner !== '') {
                    visualAfter.owner = visualOwner;
                }
                if (visualSpecialType && (resolvedVisualColor === 1 || resolvedVisualColor === -1)) {
                    visualAfter.color = resolvedVisualColor;
                }

                if (deps.visuals.crossfadeStoneVisual) {
                    const crossfadeOptions: any = {
                        effectKey,
                        owner: (visualOwner !== null && typeof visualOwner !== 'undefined' && visualOwner !== '')
                            ? visualOwner
                            : (resolvedVisualColor === 1 || resolvedVisualColor === -1
                                ? resolvedVisualColor
                                : after.color),
                        durationMs: deps.overlayCrossfadeMs,
                        fadeIn: !!visualSpecialType
                    };
                    if (resolvedVisualColor === 1 || resolvedVisualColor === -1) {
                        crossfadeOptions.newColor = resolvedVisualColor;
                    }
                    await deps.visuals.crossfadeStoneVisual(disc, crossfadeOptions);
                    deps.syncDiscVisual(disc, visualAfter);
                } else {
                    deps.syncDiscVisual(disc, visualAfter);
                }
            },
            deps.resolveStatusChangeHighlightMinimumMs(highlightTone),
            []
        );
    });
    await Promise.all(promises);
}

module.exports = {
    handleStatusChangeEvent
};
