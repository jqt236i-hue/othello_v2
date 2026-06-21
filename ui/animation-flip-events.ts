export {};

type AnimationFlipEventDeps = {
    eventTypes: any;
    flipMs: any;
    fadeOutMs: any;
    isNoAnim: () => boolean;
    getCellEl: (row: any, col: any) => any;
    resolveOwnerColorFromBefore: (ownerBefore: any) => any;
    resolveOwnerClassFromColor: (ownerColor: any) => string;
    syncDiscVisual: (disc: any, after: any) => any;
    runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => Promise<any>;
    sleep: (ms: any) => Promise<any>;
    animationShared: any;
};

function getDocumentRef(): any {
    return (typeof document !== 'undefined') ? document : null;
}

function getFlipTargetKey(target: any) {
    if (!target || typeof target !== 'object') return null;
    const row = Object.prototype.hasOwnProperty.call(target, 'r') ? target.r : target.row;
    const col = Object.prototype.hasOwnProperty.call(target, 'col')
        ? target.col
        : (Object.prototype.hasOwnProperty.call(target, 'c') ? target.c : target.column);
    if (!Number.isInteger(Number(row)) || !Number.isInteger(Number(col))) return null;
    return `${Number(row)},${Number(col)}`;
}

function mergeDuplicateFlipTarget(previous: any, next: any) {
    const merged = Object.assign({}, previous || {}, next || {});
    if (previous && typeof previous === 'object') {
        if (typeof merged.ownerBefore === 'undefined') merged.ownerBefore = previous.ownerBefore;
        if (typeof merged.specialBefore === 'undefined') merged.specialBefore = previous.specialBefore;
        if (typeof merged.timerBefore === 'undefined') merged.timerBefore = previous.timerBefore;
    }
    if (previous && previous.meta && next && next.meta) {
        merged.meta = Object.assign({}, previous.meta, next.meta);
    }
    return merged;
}

function dedupeFlipTargets(targets: any[]) {
    const deduped: any[] = [];
    const indexByKey = new Map();
    for (const target of targets) {
        const key = getFlipTargetKey(target);
        if (!key) {
            deduped.push(target);
            continue;
        }
        if (!indexByKey.has(key)) {
            indexByKey.set(key, deduped.length);
            deduped.push(target);
            continue;
        }
        const index = indexByKey.get(key);
        deduped[index] = mergeDuplicateFlipTarget(deduped[index], target);
    }
    return deduped;
}

async function handleFlipEvent(ev: any, deps: AnimationFlipEventDeps) {
    const targets = dedupeFlipTargets(Array.isArray(ev && ev.targets) ? ev.targets : []);
    const promises = targets.map(async (target: any) => {
        const cell = deps.getCellEl(target.r, target.col);
        if (!cell) return;

        const blockedByGhost = !!(target && target.meta && target.meta.blockedByGhost);
        if (blockedByGhost) {
            await deps.runWithEffectTargetHighlight(cell, deps.eventTypes.FLIP, target, async () => {
                await deps.sleep(Math.max(120, Math.floor(Number(deps.flipMs) / 2)));
            }, 0);
            return;
        }

        const disc = cell.querySelector('.disc');
        if (!disc) {
            const documentRef = getDocumentRef();
            if (!documentRef || typeof documentRef.createElement !== 'function') return;
            try {
                const ghost = documentRef.createElement('div');
                const ownerColor = deps.resolveOwnerColorFromBefore(target && target.ownerBefore);
                ghost.className = 'disc ' + deps.resolveOwnerClassFromColor(ownerColor);
                ghost.style.pointerEvents = 'none';
                ghost.classList.add('destroy-fade');
                cell.appendChild(ghost);
                await deps.sleep(deps.fadeOutMs);
                if (ghost.parentElement) ghost.parentElement.removeChild(ghost);
            } catch (e: any) { /* ignore */ }
            return;
        }

        const after = target.after || {};
        await deps.runWithEffectTargetHighlight(cell, deps.eventTypes.FLIP, target, async () => {
            if (deps.isNoAnim()) {
                deps.syncDiscVisual(disc, after);
                try { disc.classList.remove('flip'); } catch (e: any) { /* ignore */ }
                return;
            }

            deps.syncDiscVisual(disc, after);
            try {
                if (deps.animationShared && typeof deps.animationShared.triggerFlip === 'function') {
                    deps.animationShared.triggerFlip(disc);
                }
            } catch (e: any) { /* ignore */ }

            await deps.sleep(Number(deps.flipMs));
            try {
                if (deps.animationShared && typeof deps.animationShared.removeFlip === 'function') {
                    deps.animationShared.removeFlip(disc);
                }
            } catch (e: any) { /* ignore */ }
        }, 0);
    });
    await Promise.all(promises);
}

module.exports = {
    dedupeFlipTargets,
    handleFlipEvent
};
