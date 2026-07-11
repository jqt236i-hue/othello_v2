let lastActiveManifestWorldBackground: any = null;
let manifestWorldBackgroundEndTimer: any = null;
let lastActiveManifestBgm: any = null;
let manifestBgmEndTimer: any = null;

function clearTimer(timerHandle: any, getTimer: () => any): void {
    if (timerHandle === null) return;
    try {
        const timer = getTimer();
        if (timer && typeof timer.clearTimeout === 'function') timer.clearTimeout(timerHandle);
        else clearTimeout(timerHandle);
    } catch (e) { /* ignore */ }
}

function clearManifestEndingOverlay(documentRef: any): void {
    try {
        if (!documentRef) return;
        const overlays = Array.from(documentRef.querySelectorAll('.manifest-ending-overlay'));
        overlays.forEach((overlay: any) => {
            try {
                if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            } catch (e) { /* ignore */ }
        });
    } catch (e) { /* ignore */ }
}

function clearManifestWorldBackground(body: any): void {
    body.classList.remove('manifest-world-background-active', 'manifest-world-background-ending');
    body.removeAttribute('data-manifest-world-background-key');
    body.removeAttribute('data-manifest-world-background-source');
    body.style.removeProperty('--manifest-world-background');
}

function syncManifestWorldEffects(options: any): void {
    const documentRef = options.document;
    const getTimer = typeof options.getTimer === 'function' ? options.getTimer : () => null;
    const soundEngine = options.soundEngine;
    const activeBgm = typeof options.findActiveManifestBgm === 'function'
        ? options.findActiveManifestBgm(options.cardState)
        : null;
    if (soundEngine && typeof soundEngine.syncManifestBgmOverride === 'function') {
        try {
            if (activeBgm) {
                if (manifestBgmEndTimer !== null) {
                    clearTimer(manifestBgmEndTimer, getTimer);
                    manifestBgmEndTimer = null;
                }
                lastActiveManifestBgm = { key: activeBgm.key, track: activeBgm.track };
                soundEngine.syncManifestBgmOverride(activeBgm.key, activeBgm.track);
            } else {
                if (manifestBgmEndTimer === null) {
                    if (!lastActiveManifestBgm) {
                        soundEngine.syncManifestBgmOverride(null, null);
                    } else {
                        lastActiveManifestBgm = null;
                    }
                }
            }
        } catch (e) { /* ignore */ }
    }

    try {
        if (!documentRef || !documentRef.body) return;
        const body = documentRef.body;
        const activeBackground = typeof options.findActiveManifestBackground === 'function'
            ? options.findActiveManifestBackground(options.cardState)
            : null;
        if (activeBackground && activeBackground.imagePath) {
            const imagePath = String(activeBackground.imagePath || '').trim();
            if (!imagePath) return;
            clearManifestEndingOverlay(documentRef);
            if (manifestWorldBackgroundEndTimer !== null) {
                clearTimer(manifestWorldBackgroundEndTimer, getTimer);
                manifestWorldBackgroundEndTimer = null;
            }
            body.classList.remove('manifest-world-background-ending');
            body.classList.add('manifest-world-background-active');
            body.setAttribute('data-manifest-world-background-key', String(activeBackground.key || 'manifest_world'));
            body.setAttribute('data-manifest-world-background-source', String(activeBackground.source || 'marker'));
            body.style.setProperty('--manifest-world-background', `url("${imagePath}")`);
            lastActiveManifestWorldBackground = {
                key: activeBackground.key || 'manifest_world',
                imagePath,
                source: activeBackground.source || 'marker'
            };
            return;
        }
        if (lastActiveManifestWorldBackground && lastActiveManifestWorldBackground.imagePath) {
            lastActiveManifestWorldBackground = null;
            clearManifestWorldBackground(body);
            return;
        }
        clearManifestWorldBackground(body);
    } catch (e) { /* ignore */ }
}

function resetManifestWorldEffects(options: any): void {
    lastActiveManifestWorldBackground = null;
    lastActiveManifestBgm = null;
    clearManifestEndingOverlay(options && options.document);
    const getTimer = options && typeof options.getTimer === 'function' ? options.getTimer : () => null;
    clearTimer(manifestWorldBackgroundEndTimer, getTimer);
    manifestWorldBackgroundEndTimer = null;
    clearTimer(manifestBgmEndTimer, getTimer);
    manifestBgmEndTimer = null;
}

export = {
    syncManifestWorldEffects,
    resetManifestWorldEffects
};
