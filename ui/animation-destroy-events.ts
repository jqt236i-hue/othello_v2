export {};

declare const animateFadeOutAt: any;

type AnimationDestroyEventDeps = {
    eventTypes: any;
    fadeOutMs: any;
    getCellEl: (row: any, col: any) => any;
    sleep: (ms: any) => Promise<any>;
    getTargetCause: (target: any) => string;
    getTargetReason: (target: any) => string;
    isSuperCrushCause: (cause: any) => boolean;
    getSuperCrushDestinationContext: (row: any, col: any) => any;
    resolveSuperCrushTargetDelayMs?: (target: any) => any;
    resolveOwnerColorFromBefore: (ownerBefore: any) => any;
    shouldPreserveDiscOnDestroy: (target: any) => boolean;
    resolveDestroyTargetHighlightMinimumMs: (target: any) => any;
    resolveEffectTargetHighlightTone: (eventType: any, target: any) => any;
    runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => Promise<any>;
    resolveDestroySourceAnimationProfile: (target: any) => any;
    playDestroySourceAnimation: (target: any, profile: any) => Promise<any>;
    animateDestroyGhostAtCell: (cell: any, ownerColor: any) => Promise<any>;
    createDisc?: (state: any) => any;
    removeDiscFromCell: (cell: any, disc: any) => any;
    resolveOwnerClassFromColor: (ownerColor: any) => string;
    onDestroyGhostFallback?: (target: any, context: any) => void;
    animateFadeOutAt?: (row: any, col: any, options?: any) => Promise<any>;
};

function getDocumentRef(): any {
    return (typeof document !== 'undefined') ? document : null;
}

function resolveDestroyGhostVisualState(target: any, ownerColor: any) {
    if (target && target.before && (target.before.color === 1 || target.before.color === -1)) {
        return target.before;
    }
    if (ownerColor === 1 || ownerColor === -1) {
        return {
            color: ownerColor,
            special: null,
            timer: null,
            owner: ownerColor === 1 ? 'black' : 'white'
        };
    }
    return null;
}

async function animateDestroyVisualGhostAtCell(cell: any, target: any, ownerColor: any, deps: AnimationDestroyEventDeps) {
    const ghostState = resolveDestroyGhostVisualState(target, ownerColor);
    const canCreateVisualGhost = !!(deps.createDisc && ghostState);
    if (!canCreateVisualGhost) {
        if (ownerColor === null) {
            await deps.sleep(deps.fadeOutMs);
        } else {
            await deps.animateDestroyGhostAtCell(cell, ownerColor);
        }
        return;
    }

    const ghost = deps.createDisc ? deps.createDisc(ghostState) : null;
    if (!ghost) {
        await deps.animateDestroyGhostAtCell(cell, ownerColor);
        return;
    }
    ghost.style.pointerEvents = 'none';
    ghost.classList.add('destroy-fade');
    cell.appendChild(ghost);
    await deps.sleep(deps.fadeOutMs);
    if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
}

async function handleDestroyEvent(ev: any, deps: AnimationDestroyEventDeps) {
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    const promises = targets.map(async (target: any) => {
        const superCrushDelay = deps.resolveSuperCrushTargetDelayMs
            ? deps.resolveSuperCrushTargetDelayMs(target)
            : 0;
        if (superCrushDelay > 0) {
            await deps.sleep(superCrushDelay);
        }

        const cell = deps.getCellEl(target.r, target.col);
        if (!cell) return;
        const destroyCause = deps.getTargetCause(target);
        const destroyReason = deps.getTargetReason(target);
        const isSuperCrushCollision = deps.isSuperCrushCause(destroyCause) && (
            destroyReason.indexOf('super_buoyancy_collision') === 0 ||
            destroyReason.indexOf('super_gravity_collision') === 0 ||
            destroyReason.indexOf('super_attraction_collision') === 0
        );
        const superCrushDestinationContext = isSuperCrushCollision
            ? deps.getSuperCrushDestinationContext(target.r, target.col)
            : null;
        const ownerColor = deps.resolveOwnerColorFromBefore(target && target.ownerBefore);
        const disc = cell.querySelector('.disc');
        const preserveDiscOnDestroy = deps.shouldPreserveDiscOnDestroy(target);
        const destroyHighlightMinimumMs = deps.resolveDestroyTargetHighlightMinimumMs(target);
        const canRenderDestroyGhostWithoutDisc = resolveDestroyGhostVisualState(target, ownerColor) !== null;
        const shouldPreserveDestroyPlaybackWithoutDisc =
            isSuperCrushCollision ||
            canRenderDestroyGhostWithoutDisc ||
            !!deps.resolveEffectTargetHighlightTone(deps.eventTypes.DESTROY, target);
        if (!disc && !shouldPreserveDestroyPlaybackWithoutDisc) return;

        await deps.runWithEffectTargetHighlight(cell, deps.eventTypes.DESTROY, target, async () => {
            const sourceAnimationProfile = deps.resolveDestroySourceAnimationProfile(target);
            const useGhostOnlyDestroy = !disc || (
                isSuperCrushCollision &&
                (superCrushDestinationContext && superCrushDestinationContext.sourceHadDisc === false)
            );
            if (useGhostOnlyDestroy && !disc && typeof deps.onDestroyGhostFallback === 'function') {
                deps.onDestroyGhostFallback(target, {
                    reason: destroyReason,
                    cause: destroyCause,
                    canRenderDestroyGhostWithoutDisc,
                    isSuperCrushCollision
                });
            }
            if (useGhostOnlyDestroy) {
                await deps.playDestroySourceAnimation(target, sourceAnimationProfile);
                if (preserveDiscOnDestroy) {
                    await deps.sleep(Math.max(120, Math.floor(Number(deps.fadeOutMs) / 2)));
                    return;
                }
                await animateDestroyVisualGhostAtCell(cell, target, ownerColor, deps);
                return;
            }

            await deps.playDestroySourceAnimation(target, sourceAnimationProfile);
            if (sourceAnimationProfile && sourceAnimationProfile.afterDestroy === 'clearCell') {
                if (preserveDiscOnDestroy) {
                    await deps.sleep(Math.max(120, Math.floor(Number(deps.fadeOutMs) / 2)));
                    return;
                }
                cell.innerHTML = '';
                return;
            }
            if (preserveDiscOnDestroy) {
                await deps.sleep(Math.max(120, Math.floor(Number(deps.fadeOutMs) / 2)));
                return;
            }

            const isGluttonousEatDestroy =
                destroyCause === 'GLUTTONOUS_WILL' &&
                destroyReason.indexOf('gluttonous_eat') === 0;
            if (isGluttonousEatDestroy) {
                return;
            }

            const fadeOutAtFn = typeof deps.animateFadeOutAt === 'function'
                ? deps.animateFadeOutAt
                : ((typeof animateFadeOutAt === 'function') ? animateFadeOutAt : null);
            if (fadeOutAtFn) {
                await fadeOutAtFn(target.r, target.col, { createGhost: true, color: ownerColor });

                try {
                    const hasFade = cell.querySelector('.disc.destroy-fade');
                    if (!hasFade) {
                        const documentRef = getDocumentRef();
                        if (documentRef && typeof documentRef.createElement === 'function') {
                            const ghost = documentRef.createElement('div');
                            const ownerClass = deps.resolveOwnerClassFromColor(ownerColor);
                            ghost.className = 'disc ' + ownerClass;
                            ghost.style.pointerEvents = 'none';
                            ghost.classList.add('destroy-fade');
                            cell.appendChild(ghost);
                            await deps.sleep(deps.fadeOutMs);
                            if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
                        }
                    }
                } catch (e: any) { /* ignore */ }
            } else {
                if (disc) {
                    disc.classList.add('destroy-fade');
                    await deps.sleep(deps.fadeOutMs);
                } else if (ownerColor !== null) {
                    await deps.animateDestroyGhostAtCell(cell, ownerColor);
                } else {
                    await deps.sleep(deps.fadeOutMs);
                }
            }
            deps.removeDiscFromCell(cell, disc);
        }, destroyHighlightMinimumMs);
    });
    await Promise.all(promises);
}

module.exports = {
    handleDestroyEvent
};
