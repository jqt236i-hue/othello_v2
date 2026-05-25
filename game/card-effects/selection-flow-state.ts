interface SelectionFlowStateDeps {
    getSignalBridge?: () => any;
    readSignalBridgeMethod?: (name: any) => any;
    resolveCurrentCardState?: () => any;
    resolveCurrentGameState?: () => any;
}

function applyStateSnapshotInPlace(currentValue: any, nextValue: any) {
    if (!nextValue || typeof nextValue !== 'object') return nextValue || null;

    if (currentValue && typeof currentValue === 'object' && currentValue !== nextValue) {
        const keys = Object.keys(currentValue);
        for (let index = 0; index < keys.length; index += 1) {
            delete currentValue[keys[index]];
        }
        Object.assign(currentValue, nextValue);
        return currentValue;
    }

    return nextValue;
}

function resolveSelectionStateRefs(options: any, deps?: SelectionFlowStateDeps) {
    const opts = (options && typeof options === 'object') ? options : {};
    const resolveCardState = deps && typeof deps.resolveCurrentCardState === 'function'
        ? deps.resolveCurrentCardState
        : null;
    const resolveGameState = deps && typeof deps.resolveCurrentGameState === 'function'
        ? deps.resolveCurrentGameState
        : null;
    return {
        cardState: opts.cardState || (resolveCardState ? resolveCardState() : null),
        gameState: opts.gameState || (resolveGameState ? resolveGameState() : null)
    };
}

function publishSelectionStateRef(name: any, value: any, deps?: SelectionFlowStateDeps) {
    const readSignalBridgeMethod = deps && typeof deps.readSignalBridgeMethod === 'function'
        ? deps.readSignalBridgeMethod
        : null;
    const getSignalBridge = deps && typeof deps.getSignalBridge === 'function'
        ? deps.getSignalBridge
        : null;
    const methodName = name === 'gameState' ? 'setGameState' : 'setCardState';
    const publishStateRef = readSignalBridgeMethod ? readSignalBridgeMethod(methodName) : null;
    if (publishStateRef) {
        try { return publishStateRef(value) === true; } catch (e) { /* ignore */ }
    }
    const bridge = getSignalBridge ? getSignalBridge() : null;
    if (bridge && typeof bridge === 'object' && name) {
        try {
            bridge[name] = value;
            return true;
        } catch (e) { /* ignore */ }
    }
    return false;
}

function applySelectionStateResult(result: any, options: any, deps?: SelectionFlowStateDeps) {
    const stateRefs = resolveSelectionStateRefs(options, deps);
    let nextCardState = stateRefs.cardState;
    let nextGameState = stateRefs.gameState;

    if (result && result.nextCardState) {
        nextCardState = applyStateSnapshotInPlace(nextCardState, result.nextCardState);
        publishSelectionStateRef('cardState', nextCardState, deps);
    }
    if (result && result.nextGameState) {
        nextGameState = applyStateSnapshotInPlace(nextGameState, result.nextGameState);
        publishSelectionStateRef('gameState', nextGameState, deps);
    }
    return {
        cardState: nextCardState,
        gameState: nextGameState
    };
}

function resolveAuthoritativeSelectionState(deps?: SelectionFlowStateDeps) {
    const stateRefs = resolveSelectionStateRefs({}, deps);
    return {
        cardState: stateRefs.cardState,
        gameState: stateRefs.gameState
    };
}

const SelectionFlowStateModule = {
    applyStateSnapshotInPlace,
    resolveSelectionStateRefs,
    publishSelectionStateRef,
    applySelectionStateResult,
    resolveAuthoritativeSelectionState
};

const stateRoot = (typeof globalThis !== 'undefined')
    ? (globalThis as any)
    : (typeof self !== 'undefined' ? (self as any) : null);
if (stateRoot && !stateRoot.SelectionFlowState) {
    stateRoot.SelectionFlowState = SelectionFlowStateModule;
}

export = SelectionFlowStateModule;
