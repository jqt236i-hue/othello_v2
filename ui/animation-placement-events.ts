export {};

type AnimationPlacementEventDeps = {
    eventTypes: any;
    breedingSpawnFadeMs: any;
    isNoAnim: () => boolean;
    getCellEl: (row: any, col: any) => any;
    createDisc: (state: any) => any;
    runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => Promise<any>;
    resolveSpawnTargetHighlightMinimumMs: (target: any) => any;
    waitForOpacityTransition: (disc: any, durationMs: any, bufferMs: any, starter: any, cleanup: any) => Promise<any>;
};

function isBreedingSpawnTarget(target: any) {
    if (!target) return false;
    const cause = String(target.cause || '').toUpperCase();
    const reason = String(target.reason || '').toLowerCase();
    return cause === 'BREEDING' && reason.indexOf('breeding_spawn') === 0;
}

function getSpawnFadeInMs(target: any, deps: Pick<AnimationPlacementEventDeps, 'breedingSpawnFadeMs'>) {
    if (isBreedingSpawnTarget(target)) return deps.breedingSpawnFadeMs;
    return 0;
}

function getHighlightTarget(target: any, ev: any) {
    if (!target || target.meta) return target;
    const eventMeta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : null;
    return eventMeta ? Object.assign({}, target, { meta: eventMeta }) : target;
}

async function handlePlaceEvent(ev: any, deps: AnimationPlacementEventDeps) {
    const eventType = (ev && ev.type) ? ev.type : deps.eventTypes.PLACE;
    for (const target of ev.targets) {
        const cell = deps.getCellEl(target.r, target.col);
        if (!cell) continue;
        const highlightMinimumMs = eventType === deps.eventTypes.SPAWN
            ? deps.resolveSpawnTargetHighlightMinimumMs(target)
            : 0;

        await deps.runWithEffectTargetHighlight(cell, eventType, getHighlightTarget(target, ev), async () => {
            const after = target.after || {};
            const disc = deps.createDisc(after);

            // Section 5.1: normal placement appears in its final state immediately.
            // Fade-in is reserved for explicit spawn/crossfade paths only.
            cell.innerHTML = '';
            cell.appendChild(disc);
        }, highlightMinimumMs);
    }
    return Promise.resolve();
}

async function handleSpawnEvent(ev: any, deps: AnimationPlacementEventDeps) {
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
    if (!targets.length) return Promise.resolve();

    const normalTargets = [];
    const breedingTargets = [];
    for (const target of targets) {
        if (isBreedingSpawnTarget(target)) breedingTargets.push(target);
        else normalTargets.push(target);
    }

    if (normalTargets.length) {
        await handlePlaceEvent(Object.assign({}, ev, { targets: normalTargets }), deps);
    }

    if (!breedingTargets.length) return Promise.resolve();

    const fadePromises = breedingTargets.map(async (target) => {
        const cell = deps.getCellEl(target.r, target.col);
        if (!cell) return;
        const highlightMinimumMs = deps.resolveSpawnTargetHighlightMinimumMs(target);
        await deps.runWithEffectTargetHighlight(cell, deps.eventTypes.SPAWN, target, async () => {
            const after = target.after || {};
            const disc = deps.createDisc(after);
            cell.innerHTML = '';
            cell.appendChild(disc);

            const fadeMs = getSpawnFadeInMs(target, deps);
            if (deps.isNoAnim() || !Number.isFinite(fadeMs) || fadeMs <= 0) return;

            const prevTransition = disc.style.transition || '';
            disc.style.opacity = '0';
            disc.classList.add('stone-instant');
            disc.offsetHeight;
            disc.classList.remove('stone-instant');
            disc.style.transition = prevTransition ? `${prevTransition}, opacity ${fadeMs}ms ease` : `opacity ${fadeMs}ms ease`;

            await deps.waitForOpacityTransition(
                disc,
                fadeMs,
                120,
                () => {
                    try { requestAnimationFrame(() => { disc.style.opacity = '1'; }); } catch (e: any) { disc.style.opacity = '1'; }
                },
                () => {
                    disc.style.opacity = '';
                    disc.style.transition = prevTransition;
                }
            );
        }, highlightMinimumMs);
    });

    await Promise.all(fadePromises);
}

module.exports = {
    isBreedingSpawnTarget,
    getSpawnFadeInMs,
    handlePlaceEvent,
    handleSpawnEvent
};
