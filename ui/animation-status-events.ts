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
                const isFreezeDurationEnd =
                    ev &&
                    ev.type === deps.eventTypes.STATUS_REMOVED &&
                    removedSpecialUpper === 'FREEZE' &&
                    statusRemoveReason === 'duration_end' &&
                    !after.special;

                if (isStatusTick) {
                    const disc = await deps.waitForDisc(target.r, target.col, 4);
                    if (!disc) return;
                    deps.syncDiscTimerOnly(disc, after);
                    return;
                }

                if (isFreezeDurationEnd) {
                    await deps.fadeOutFreezeOverlay(cell, deps.overlayCrossfadeMs);
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

                const specialTypeUpper = afterSpecialUpper;
                const visualSpecialType = (specialTypeUpper === 'INHERITED_HYPERACTIVE') ? null : after.special;
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
