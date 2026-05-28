declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;

function readRuntimeModuleGlobal(globalKey: string): any {
    if (!globalKey) return null;
    try {
        if (typeof self !== 'undefined' && (self as any)[globalKey]) {
            return (self as any)[globalKey];
        }
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
    } catch (e) { /* ignore */ }
    return null;
}

function requirePipelineUIModule(id: string, globalKey: string): any {
    try {
        return _require(id);
    } catch (e) {
        return readRuntimeModuleGlobal(globalKey);
    }
}

const PipelineUIPlaybackUtilsModule = requirePipelineUIModule('./playback-utils', 'PipelineUIPlaybackUtils');

type GeneratedThrowChainPlaybackDeps = {
    generatedThrowChainReason: string;
    normalizePlayerKey: (playerKey: any) => any;
};

function getPlaybackUtilsModule(): any {
    if (!(PipelineUIPlaybackUtilsModule && typeof PipelineUIPlaybackUtilsModule.extractGeneratedThrowChainPlayback === 'function')) {
        throw new Error('PipelineUIGeneratedThrowChainPlayback playback utils module unavailable');
    }
    return PipelineUIPlaybackUtilsModule;
}

function clearDeferredGeneratedThrowChainPlaybackForPlayer(store: Record<string, any[]>, ownerKey: any) {
    if (ownerKey !== 'black' && ownerKey !== 'white') return;
    store[ownerKey] = [];
}

function clearDeferredGeneratedThrowChainPlayback(playerKey: any, store: Record<string, any[]>, deps: GeneratedThrowChainPlaybackDeps) {
    const ownerKey = deps.normalizePlayerKey(playerKey);
    if (ownerKey) {
        clearDeferredGeneratedThrowChainPlaybackForPlayer(store, ownerKey);
        return;
    }
    clearDeferredGeneratedThrowChainPlaybackForPlayer(store, 'black');
    clearDeferredGeneratedThrowChainPlaybackForPlayer(store, 'white');
}

function setDeferredGeneratedThrowChainPlayback(playerKey: any, events: any, store: Record<string, any[]>, deps: GeneratedThrowChainPlaybackDeps) {
    const ownerKey = deps.normalizePlayerKey(playerKey) || 'black';
    const playbackUtils = getPlaybackUtilsModule();
    store[ownerKey] = Array.isArray(events)
        ? events.map((ev: any) => playbackUtils.clonePlaybackEventWithPhase(ev, playbackUtils.phaseNum(ev && ev.phase)))
        : [];
}

function takeDeferredGeneratedThrowChainPlayback(playerKey: any, store: Record<string, any[]>, deps: GeneratedThrowChainPlaybackDeps) {
    const ownerKey = deps.normalizePlayerKey(playerKey) || 'black';
    const queued = Array.isArray(store[ownerKey]) ? store[ownerKey].slice() : [];
    clearDeferredGeneratedThrowChainPlaybackForPlayer(store, ownerKey);
    return queued;
}

function processGeneratedThrowChainPlayback(playbackEvents: any, action: any, playerKey: any, store: Record<string, any[]>, deps: GeneratedThrowChainPlaybackDeps) {
    const playbackUtils = getPlaybackUtilsModule();
    const split = playbackUtils.extractGeneratedThrowChainPlayback(
        playbackEvents,
        { generatedThrowChainReason: deps.generatedThrowChainReason }
    );
    const actionType = String(action && action.type ? action.type : '').toLowerCase();
    const ownerKey = deps.normalizePlayerKey(playerKey) || 'black';

    if (actionType === 'use_card') {
        if (split.deferredEvents.length > 0) {
            setDeferredGeneratedThrowChainPlayback(ownerKey, split.deferredEvents, store, deps);
            return {
                playbackEvents: split.immediateEvents,
                deferredGeneratedThrowChainHandAdd: {
                    playerKey: ownerKey,
                    count: split.deferredEvents.reduce((sum: any, ev: any) => sum + playbackUtils.countPlaybackCards(ev), 0),
                    reason: deps.generatedThrowChainReason
                }
            };
        }
        return { playbackEvents: split.immediateEvents, deferredGeneratedThrowChainHandAdd: null };
    }

    if (actionType === 'place') {
        const queuedDeferredEvents = takeDeferredGeneratedThrowChainPlayback(ownerKey, store, deps);
        const allDeferredEvents = queuedDeferredEvents.concat(split.deferredEvents);
        return {
            playbackEvents: playbackUtils.appendGeneratedThrowChainPlayback(split.immediateEvents, allDeferredEvents),
            deferredGeneratedThrowChainHandAdd: null
        };
    }

    if (split.deferredEvents.length > 0) {
        setDeferredGeneratedThrowChainPlayback(ownerKey, split.deferredEvents, store, deps);
    }

    return { playbackEvents: split.immediateEvents, deferredGeneratedThrowChainHandAdd: null };
}

const PipelineUIGeneratedThrowChainPlaybackModule = {
    clearDeferredGeneratedThrowChainPlayback,
    processGeneratedThrowChainPlayback
};

export = PipelineUIGeneratedThrowChainPlaybackModule;
