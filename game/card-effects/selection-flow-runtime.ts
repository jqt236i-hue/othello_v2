interface SelectionFlowRuntimeDeps {
    getSignalBridge?: () => any;
    readSignalBridgeMethod?: (name: any) => any;
    resolveGlobalValue?: (name: any) => any;
}

function readMatchMode(deps?: SelectionFlowRuntimeDeps) {
    const getSignalBridge = deps && typeof deps.getSignalBridge === 'function' ? deps.getSignalBridge : null;
    const readSignalBridgeMethod = deps && typeof deps.readSignalBridgeMethod === 'function' ? deps.readSignalBridgeMethod : null;
    const resolveGlobalValue = deps && typeof deps.resolveGlobalValue === 'function' ? deps.resolveGlobalValue : null;

    const readMatchModeFromBridge = readSignalBridgeMethod ? readSignalBridgeMethod('readMatchMode') : null;
    if (readMatchModeFromBridge) {
        try {
            const mode = readMatchModeFromBridge();
            if (typeof mode !== 'undefined' && mode !== null) return mode;
        } catch (e) { /* ignore and fall back */ }
    }
    const getCurrentMatchModeFromBridge = readSignalBridgeMethod ? readSignalBridgeMethod('getCurrentMatchMode') : null;
    if (getCurrentMatchModeFromBridge) {
        try {
            const mode = getCurrentMatchModeFromBridge();
            if (typeof mode !== 'undefined' && mode !== null) return mode;
        } catch (e) { /* ignore and fall back */ }
    }
    const bridge = getSignalBridge ? getSignalBridge() : null;
    if (bridge && typeof bridge.MATCH_MODE !== 'undefined') return bridge.MATCH_MODE;
    const getCurrentMatchMode = resolveGlobalValue ? resolveGlobalValue('getCurrentMatchMode') : null;
    if (typeof getCurrentMatchMode === 'function') {
        try {
            const mode = getCurrentMatchMode();
            if (typeof mode !== 'undefined' && mode !== null) return mode;
        } catch (e) { /* ignore */ }
    }
    const globalMatchMode = resolveGlobalValue ? resolveGlobalValue('MATCH_MODE') : undefined;
    if (typeof globalMatchMode !== 'undefined') return globalMatchMode;
    const legacyGlobalMatchMode = resolveGlobalValue ? resolveGlobalValue('__MATCH_MODE') : undefined;
    if (typeof legacyGlobalMatchMode !== 'undefined') return legacyGlobalMatchMode;
    return null;
}

function hasActiveNetworkPublishClient(deps?: SelectionFlowRuntimeDeps) {
    const readSignalBridgeMethod = deps && typeof deps.readSignalBridgeMethod === 'function' ? deps.readSignalBridgeMethod : null;
    const isNetworkPublishActiveViaBridge = readSignalBridgeMethod ? readSignalBridgeMethod('isNetworkPublishActive') : null;
    if (typeof isNetworkPublishActiveViaBridge === 'function') {
        try {
            return isNetworkPublishActiveViaBridge() === true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

function isHumanVsHumanModeEnabled(deps?: SelectionFlowRuntimeDeps) {
    const readSignalBridgeMethod = deps && typeof deps.readSignalBridgeMethod === 'function' ? deps.readSignalBridgeMethod : null;
    const readHumanVsHumanMode = readSignalBridgeMethod ? readSignalBridgeMethod('readHumanVsHumanMode') : null;
    if (readHumanVsHumanMode) {
        try {
            const explicit = readHumanVsHumanMode();
            if (typeof explicit !== 'undefined' && explicit !== null) return explicit === true;
        } catch (e) { /* ignore */ }
    }
    return readMatchMode(deps) === 'network';
}

function resolveCurrentGameState(deps?: SelectionFlowRuntimeDeps) {
    const getSignalBridge = deps && typeof deps.getSignalBridge === 'function' ? deps.getSignalBridge : null;
    const readSignalBridgeMethod = deps && typeof deps.readSignalBridgeMethod === 'function' ? deps.readSignalBridgeMethod : null;
    const resolveGlobalValue = deps && typeof deps.resolveGlobalValue === 'function' ? deps.resolveGlobalValue : null;
    const bridge = getSignalBridge ? getSignalBridge() : null;
    if (bridge && bridge.gameState && typeof bridge.gameState === 'object') {
        return bridge.gameState;
    }
    const getGameStateFromBridge = readSignalBridgeMethod ? readSignalBridgeMethod('getGameState') : null;
    if (getGameStateFromBridge) {
        try {
            const state = getGameStateFromBridge();
            if (state && typeof state === 'object') return state;
        } catch (e) { /* ignore */ }
    }
    const globalState = resolveGlobalValue ? resolveGlobalValue('gameState') : null;
    if (globalState && typeof globalState === 'object') return globalState;
    return null;
}

function resolveCurrentCardState(deps?: SelectionFlowRuntimeDeps) {
    const getSignalBridge = deps && typeof deps.getSignalBridge === 'function' ? deps.getSignalBridge : null;
    const readSignalBridgeMethod = deps && typeof deps.readSignalBridgeMethod === 'function' ? deps.readSignalBridgeMethod : null;
    const resolveGlobalValue = deps && typeof deps.resolveGlobalValue === 'function' ? deps.resolveGlobalValue : null;
    const bridge = getSignalBridge ? getSignalBridge() : null;
    if (bridge && bridge.cardState && typeof bridge.cardState === 'object') {
        return bridge.cardState;
    }
    const getCardStateFromBridge = readSignalBridgeMethod ? readSignalBridgeMethod('getCardState') : null;
    if (getCardStateFromBridge) {
        try {
            const state = getCardStateFromBridge();
            if (state && typeof state === 'object') return state;
        } catch (e) { /* ignore */ }
    }
    const globalState = resolveGlobalValue ? resolveGlobalValue('cardState') : null;
    if (globalState && typeof globalState === 'object') return globalState;
    return null;
}

const SelectionFlowRuntimeModule = {
    readMatchMode,
    hasActiveNetworkPublishClient,
    isHumanVsHumanModeEnabled,
    resolveCurrentGameState,
    resolveCurrentCardState
};

const runtimeRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (runtimeRoot && !runtimeRoot.SelectionFlowRuntime) {
    runtimeRoot.SelectionFlowRuntime = SelectionFlowRuntimeModule;
}

export = SelectionFlowRuntimeModule;
