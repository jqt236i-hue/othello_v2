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

async function handleFlipEvent(ev: any, deps: AnimationFlipEventDeps) {
    const targets = Array.isArray(ev && ev.targets) ? ev.targets : [];
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

            try {
                if (target.ownerBefore === 'black' || target.ownerBefore === 'white') {
                    const before = {
                        color: (target.ownerBefore === 'black') ? 1 : -1,
                        special: target.specialBefore || null,
                        timer: target.timerBefore || null
                    };
                    deps.syncDiscVisual(disc, before);
                }
            } catch (e: any) { /* ignore */ }

            try {
                if (deps.animationShared && typeof deps.animationShared.triggerFlip === 'function') {
                    deps.animationShared.triggerFlip(disc);
                }
            } catch (e: any) { /* ignore */ }

            await deps.sleep(Number(deps.flipMs) / 2);
            deps.syncDiscVisual(disc, after);

            await deps.sleep(Number(deps.flipMs) / 2);
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
    handleFlipEvent
};
