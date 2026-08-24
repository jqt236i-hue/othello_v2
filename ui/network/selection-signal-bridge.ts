import CardRuntimeIntegrity = require('../card-runtime-integrity');

function readRuntimeValue(root: any, key: string): any {
    try {
        if (root && typeof root[key] !== 'undefined') return root[key];
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined') return (globalThis as any)[key];
    } catch (e) { /* ignore */ }
    return null;
}

function writeRuntimeValue(root: any, key: string, value: any): boolean {
    try {
        const target = root || (typeof globalThis !== 'undefined' ? globalThis : null);
        if (!target) return false;
        target[key] = value;
        return true;
    } catch (e) {
        return false;
    }
}

function createNetworkSelectionSignalBridge(options: any): any {
    const config = options || {};
    const root = config.root || (typeof globalThis !== 'undefined' ? globalThis : null);
    const client = config.client || {};
    const isCardRuntimeIntegrityBlocked = (): boolean => {
        if (typeof config.isCardRuntimeIntegrityBlocked === 'function') {
            try { return config.isCardRuntimeIntegrityBlocked() === true; } catch (_error) { return true; }
        }
        return !!(
            CardRuntimeIntegrity
            && typeof CardRuntimeIntegrity.isCardRuntimeIntegrityBlocked === 'function'
            && CardRuntimeIntegrity.isCardRuntimeIntegrityBlocked() === true
        );
    };
    return {
        readMatchMode: () => {
            try {
                if (root && typeof root.getCurrentMatchMode === 'function') return root.getCurrentMatchMode();
            } catch (e) { /* ignore */ }
            return readRuntimeValue(root, 'MATCH_MODE');
        },
        getGameState: () => readRuntimeValue(root, 'gameState'),
        getCardState: () => readRuntimeValue(root, 'cardState'),
        setGameState: (nextGameState: any) => writeRuntimeValue(root, 'gameState', nextGameState),
        setCardState: (nextCardState: any) => writeRuntimeValue(root, 'cardState', nextCardState),
        getActionManager: () => readRuntimeValue(root, 'ActionManager'),
        getTurnPipelineUIAdapter: () => readRuntimeValue(root, 'TurnPipelineUIAdapter'),
        getTurnPipeline: () => readRuntimeValue(root, 'TurnPipeline'),
        waitForPlaybackIdle: (playbackEvents: any) => {
            const waitForPlayback = typeof config.waitForPlaybackIdle === 'function'
                ? config.waitForPlaybackIdle
                : readRuntimeValue(root, 'waitForPlaybackIdle');
            if (typeof waitForPlayback !== 'function') return undefined;
            return waitForPlayback(playbackEvents);
        },
        waitForAuthoritativeVisualSettlement: (publishResult: any) => {
            if (typeof config.waitForAuthoritativeVisualSettlement === 'function') {
                return config.waitForAuthoritativeVisualSettlement(publishResult);
            }
            if (typeof client.waitForAuthoritativeVisualSettlement === 'function') {
                return client.waitForAuthoritativeVisualSettlement(publishResult);
            }
            return undefined;
        },
        publishSnapshot: (meta: any) => {
            if (isCardRuntimeIntegrityBlocked()) {
                return Promise.resolve({ ok: false, reason: 'RUNTIME_UNAVAILABLE' });
            }
            if (typeof client.publishSnapshot !== 'function') return undefined;
            if (typeof client.isActive === 'function' && client.isActive() !== true) return undefined;
            if (typeof client.isSpectator === 'function' && client.isSpectator() === true) return undefined;
            return client.publishSnapshot(meta);
        },
        isNetworkPublishActive: () => {
            if (isCardRuntimeIntegrityBlocked()) return false;
            if (typeof client.publishSnapshot !== 'function') return false;
            if (typeof client.isSpectator === 'function' && client.isSpectator() === true) return false;
            if (typeof client.isActive === 'function') return client.isActive() === true;
            return true;
        },
        isCardRuntimeIntegrityBlocked,
        armBoardUpdateDuringPlayback: (context: any) => {
            return typeof config.armBoardUpdateDuringPlayback === 'function'
                ? config.armBoardUpdateDuringPlayback(context)
                : false;
        }
    };
}

function installNetworkSelectionSignalBridge(options: any): boolean {
    const config = options || {};
    const selectionFlow = config.selectionFlow;
    if (!selectionFlow || typeof selectionFlow.setSignalBridge !== 'function') return false;
    selectionFlow.setSignalBridge(createNetworkSelectionSignalBridge(config));
    return true;
}

export = {
    createNetworkSelectionSignalBridge,
    installNetworkSelectionSignalBridge
};
