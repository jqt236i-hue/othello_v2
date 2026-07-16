export {};

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

const PlaybackFlipMarker = _require('./playback-flip-marker');

type AnimationFlipEventDeps = {
    eventTypes: any;
    flipMs: any;
    fadeOutMs: any;
    zombieBiteMs: any;
    isNoAnim: () => boolean;
    getCellEl: (row: any, col: any) => any;
    getCellClientRect: (row: any, col: any) => {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    } | null;
    resolveOwnerColorFromBefore: (ownerBefore: any) => any;
    resolveOwnerClassFromColor: (ownerColor: any) => string;
    syncDiscVisual: (disc: any, after: any) => any;
    runWithEffectTargetHighlight: (cell: any, eventType: any, target: any, runner: any, minimumVisibleMs: any) => Promise<any>;
    sleep: (ms: any) => Promise<any>;
    animationShared: any;
    waitForZombieSourcePrelude?: (target: any) => Promise<void>;
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

function isZombieInfectionTarget(target: any) {
    return String(target && target.cause || '').toUpperCase() === 'ZOMBIE' &&
        String(target && target.reason || '').toLowerCase() === 'zombie_infection';
}

function prefersReducedMotion() {
    try {
        return typeof window !== 'undefined' &&
            typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {
        return false;
    }
}

async function playZombieBiteAnimation(target: any, targetCell: any, deps: AnimationFlipEventDeps) {
    if (!isZombieInfectionTarget(target) || deps.isNoAnim() || prefersReducedMotion()) return;
    if (typeof deps.waitForZombieSourcePrelude === 'function') {
        try {
            targetCell.classList.add('zombie-bite-active');
            await deps.waitForZombieSourcePrelude(target);
        } finally {
            targetCell.classList.remove('zombie-bite-active');
        }
        return;
    }
    const meta = target && target.meta && typeof target.meta === 'object' ? target.meta : {};
    if (!Number.isInteger(meta.sourceRow) || !Number.isInteger(meta.sourceCol)) return;
    const documentRef = getDocumentRef();
    if (!targetCell || !documentRef || typeof documentRef.createElement !== 'function') return;

    const layer = targetCell.closest && targetCell.closest('#board, .board, .game-board');
    const host = layer || documentRef.body;
    if (!host || typeof host.appendChild !== 'function') return;

    const hostRect = host.getBoundingClientRect();
    const sourceRect = deps.getCellClientRect(meta.sourceRow, meta.sourceCol);
    const targetRect = deps.getCellClientRect(target.r, target.col);
    if (!sourceRect || !targetRect) return;
    const sourceX = sourceRect.left + sourceRect.width / 2 - hostRect.left;
    const sourceY = sourceRect.top + sourceRect.height / 2 - hostRect.top;
    const targetX = targetRect.left + targetRect.width / 2 - hostRect.left;
    const targetY = targetRect.top + targetRect.height / 2 - hostRect.top;
    const deltaX = targetX - sourceX;
    const deltaY = targetY - sourceY;
    const distance = Math.max(1, Math.hypot(deltaX, deltaY));
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

    const shadow = documentRef.createElement('div');
    shadow.className = 'zombie-bite-shadow';
    shadow.style.left = `${sourceX}px`;
    shadow.style.top = `${sourceY}px`;
    shadow.style.width = `${distance}px`;
    shadow.style.transform = `rotate(${angle}deg)`;

    const upperFang = documentRef.createElement('div');
    upperFang.className = 'zombie-bite-fang zombie-bite-fang--upper';
    const lowerFang = documentRef.createElement('div');
    lowerFang.className = 'zombie-bite-fang zombie-bite-fang--lower';
    for (const fang of [upperFang, lowerFang]) {
        fang.style.left = `${targetX}px`;
        fang.style.top = `${targetY}px`;
        fang.style.setProperty('--zombie-bite-angle', `${angle}deg`);
    }

    try {
        host.appendChild(shadow);
        host.appendChild(upperFang);
        host.appendChild(lowerFang);
        targetCell.classList.add('zombie-bite-active');
        await deps.sleep(Math.max(1, Number(deps.zombieBiteMs) || 800));
    } finally {
        targetCell.classList.remove('zombie-bite-active');
        for (const element of [shadow, upperFang, lowerFang]) {
            if (element.parentNode) element.parentNode.removeChild(element);
        }
    }
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

            await playZombieBiteAnimation(target, cell, deps);
            deps.syncDiscVisual(disc, after);

            if (isZombieInfectionTarget(target)) {
                // Zombie infection (cause ZOMBIE / reason zombie_infection):
                // the bite animation is the visual story. Skip the regular
                // flip pathway (no playback flip marker, no triggerFlip,
                // no flipMs wait / removeFlip cleanup) so the infected
                // stone settles directly into the player's corpse-stone look.
                return;
            }

            try {
                PlaybackFlipMarker.markPlaybackFlippedDisc(disc);
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
    playZombieBiteAnimation,
    handleFlipEvent
};
