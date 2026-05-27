import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

    let cachedNetworkTurnHandoff: any = null;
    let cachedPendingCoordinator: any = null;
    let cachedPendingStateManager: any = null;
    let cachedSelectionFlowStateModule: any = null;
    let cachedSelectionFlowRuntimeModule: any = null;
    let cachedSelectionFlowNetworkHandoffModule: any = null;
    let cachedSelectionFlowPendingExecutionModule: any = null;
    let selectionSignalBridge: any = null;
    const localSelectionBusyState = {
        processing: false,
        cardAnimating: false
    };
    let nextSelectionSettlementLockId = 1;
    const activeSelectionSettlementLocks: any[] = [];
    let sharedSelectionBusyLockToken: any = null;

    function normalizePendingType(pendingType: any) {
        return String(pendingType || '').trim().toUpperCase();
    }

    function getNetworkTurnHandoff() {
        if (cachedNetworkTurnHandoff && typeof cachedNetworkTurnHandoff === 'object') {
            return cachedNetworkTurnHandoff;
        }
        if (typeof require === 'function') {
            try { cachedNetworkTurnHandoff = require('../network-turn-handoff'); } catch (e) { /* ignore */ }
        }
        return cachedNetworkTurnHandoff;
    }

    function setSignalBridge(bridge: any) {
        selectionSignalBridge = (bridge && typeof bridge === 'object') ? bridge : null;
        return selectionSignalBridge;
    }

    function clearSignalBridge() {
        selectionSignalBridge = null;
        return true;
    }

    function getSignalBridge() {
        return selectionSignalBridge;
    }

    function readSignalBridgeMethod(name: any) {
        const bridge = getSignalBridge();
        if (!bridge || typeof name !== 'string') return null;
        return (typeof bridge[name] === 'function') ? bridge[name] : null;
    }

    function invokeSignalBridgeMethod(name: string, args: any[] = []) {
        const bridge = getSignalBridge();
        if (!bridge || typeof name !== 'string') return undefined;
        const method = bridge[name];
        if (typeof method !== 'function') return undefined;
        try {
            return method.apply(bridge, Array.isArray(args) ? args : []);
        } catch (e) {
            return undefined;
        }
    }

    function resolveGlobalValue(name: any) {
        if (typeof name !== 'string' || !name) return undefined;
        const bridge = getSignalBridge();
        try {
            const resolveRuntimeValue = readSignalBridgeMethod('resolveRuntimeValue')
                || readSignalBridgeMethod('readRuntimeValue');
            if (resolveRuntimeValue) {
                const value = resolveRuntimeValue(name);
                if (typeof value !== 'undefined') return value;
            }
        } catch (e) { /* ignore */ }
        try {
            if (bridge && Object.prototype.hasOwnProperty.call(bridge, name)) {
                return bridge[name];
            }
        } catch (e) { /* ignore */ }
        return undefined;
    }

    function requireSelectionFlowModuleOrNull(id: string): any {
        if (typeof require !== 'function') return null;
        try {
            return require(id);
        } catch (e) {
            /* ignore */
        }
        return null;
    }

    function requireSelectionFlowModuleWithFallback(ids: string[]): any {
        if (!Array.isArray(ids) || ids.length === 0) return null;
        for (let index = 0; index < ids.length; index += 1) {
            const id = ids[index];
            if (typeof id !== 'string' || !id) continue;
            const loaded = requireSelectionFlowModuleOrNull(id);
            if (loaded && typeof loaded === 'object') {
                return loaded;
            }
        }
        return null;
    }

    function getSelectionFlowStateModule() {
        if (cachedSelectionFlowStateModule && typeof cachedSelectionFlowStateModule === 'object') {
            return cachedSelectionFlowStateModule;
        }
        const globalStateModule = resolveGlobalValue('SelectionFlowState');
        if (globalStateModule && typeof globalStateModule === 'object') {
            cachedSelectionFlowStateModule = globalStateModule;
            return cachedSelectionFlowStateModule;
        }
        cachedSelectionFlowStateModule = requireSelectionFlowModuleWithFallback([
            './selection-flow-state',
            './selection-flow-state.js'
        ]);
        return cachedSelectionFlowStateModule;
    }

    function getSelectionFlowRuntimeModule() {
        if (cachedSelectionFlowRuntimeModule && typeof cachedSelectionFlowRuntimeModule === 'object') {
            return cachedSelectionFlowRuntimeModule;
        }
        const globalRuntimeModule = resolveGlobalValue('SelectionFlowRuntime');
        if (globalRuntimeModule && typeof globalRuntimeModule === 'object') {
            cachedSelectionFlowRuntimeModule = globalRuntimeModule;
            return cachedSelectionFlowRuntimeModule;
        }
        cachedSelectionFlowRuntimeModule = requireSelectionFlowModuleWithFallback([
            './selection-flow-runtime',
            './selection-flow-runtime.js'
        ]);
        return cachedSelectionFlowRuntimeModule;
    }

    function getSelectionFlowNetworkHandoffModule() {
        if (cachedSelectionFlowNetworkHandoffModule && typeof cachedSelectionFlowNetworkHandoffModule === 'object') {
            return cachedSelectionFlowNetworkHandoffModule;
        }
        const globalNetworkHandoffModule = resolveGlobalValue('SelectionFlowNetworkHandoff');
        if (globalNetworkHandoffModule && typeof globalNetworkHandoffModule === 'object') {
            cachedSelectionFlowNetworkHandoffModule = globalNetworkHandoffModule;
            return cachedSelectionFlowNetworkHandoffModule;
        }
        cachedSelectionFlowNetworkHandoffModule = requireSelectionFlowModuleWithFallback([
            './selection-flow-network-handoff',
            './selection-flow-network-handoff.js'
        ]);
        return cachedSelectionFlowNetworkHandoffModule;
    }

    function getSelectionFlowPendingExecutionModule() {
        if (cachedSelectionFlowPendingExecutionModule && typeof cachedSelectionFlowPendingExecutionModule === 'object') {
            return cachedSelectionFlowPendingExecutionModule;
        }
        const globalPendingExecutionModule = resolveGlobalValue('SelectionFlowPendingExecution');
        if (globalPendingExecutionModule && typeof globalPendingExecutionModule === 'object') {
            cachedSelectionFlowPendingExecutionModule = globalPendingExecutionModule;
            return cachedSelectionFlowPendingExecutionModule;
        }
        cachedSelectionFlowPendingExecutionModule = requireSelectionFlowModuleWithFallback([
            './selection-flow-pending-execution',
            './selection-flow-pending-execution.js'
        ]);
        return cachedSelectionFlowPendingExecutionModule;
    }

    function getPendingStateManager() {
        if (cachedPendingStateManager && typeof cachedPendingStateManager === 'object') {
            return cachedPendingStateManager;
        }
        if (typeof require === 'function') {
            try { cachedPendingStateManager = require('../logic/cards-internal/pending-state-manager'); } catch (e) { /* ignore */ }
        }
        return cachedPendingStateManager;
    }

    function getPendingCoordinator() {
        if (cachedPendingCoordinator && typeof cachedPendingCoordinator === 'object') {
            return cachedPendingCoordinator;
        }
        if (typeof require === 'function') {
            try { cachedPendingCoordinator = require('../turn/pending-coordinator'); } catch (e) { /* ignore */ }
        }
        return cachedPendingCoordinator;
    }

    function beginSelectionSettlementLock(meta: any) {
        const token = {
            id: nextSelectionSettlementLockId++,
            meta: (meta && typeof meta === 'object') ? Object.assign({}, meta) : null,
            playbackToken: null
        };
        token.playbackToken = invokeSignalBridgeMethod('acquireSelectionSettlementLock', [token.meta]) || null;
        activeSelectionSettlementLocks.push(token);
        return { id: token.id };
    }

    function endSelectionSettlementLock(token: any) {
        const tokenId = Number(token && token.id);
        if (!Number.isFinite(tokenId)) return false;
        const lockIndex = activeSelectionSettlementLocks.findIndex((entry) => Number(entry && entry.id) === tokenId);
        if (lockIndex < 0) return false;
        const [lockEntry] = activeSelectionSettlementLocks.splice(lockIndex, 1);
        if (lockEntry && lockEntry.playbackToken) {
            invokeSignalBridgeMethod('releaseSelectionSettlementLock', [lockEntry.playbackToken]);
        }
        return true;
    }

    function isSelectionSettlementLocked() {
        return activeSelectionSettlementLocks.length > 0;
    }

    function resolvePendingSelectionContract(pendingType: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.getPendingSelectionContract !== 'function') {
            return null;
        }
        return pendingCoordinator.getPendingSelectionContract(pendingType);
    }

    function isSelectionOnlyEndTurnPendingType(pendingType: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.isSelectionOnlyEndTurnPendingType !== 'function') {
            return false;
        }
        return pendingCoordinator.isSelectionOnlyEndTurnPendingType(pendingType);
    }

    function shouldDeferNetworkPublishForPendingType(pendingType: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.shouldDeferNetworkPublishForPendingType !== 'function') {
            return false;
        }
        return pendingCoordinator.shouldDeferNetworkPublishForPendingType(pendingType);
    }

    function shouldWaitForPlaybackIdleForPendingType(pendingType: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.shouldWaitForPlaybackIdleForPendingType !== 'function') {
            return false;
        }
        return pendingCoordinator.shouldWaitForPlaybackIdleForPendingType(pendingType);
    }

    function cloneData(value: any) {
        try {
            if (typeof structuredClone === 'function') {
                return structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function normalizeSelectionPlayerKey(playerKey: any) {
        return String(playerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
    }

    function resolveSelectionTurnPlayerKeyOptional(value: any) {
        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();
        if (normalized === 'white' || normalized === '-1') return 'white';
        if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        if (value === -1) return 'white';
        if (value === 1) return 'black';
        return null;
    }

    function clonePendingSelectionAction(action: any) {
        if (!action || typeof action !== 'object') return null;
        try {
            return cloneData(action);
        } catch (e) {
            return Object.assign({}, action);
        }
    }

    function storePendingSelectionAction(playerKey: any, action: any, pendingType: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.storePendingSelectionAction !== 'function') {
            return clonePendingSelectionAction(action);
        }
        return pendingCoordinator.storePendingSelectionAction(playerKey, action, pendingType);
    }

    function readPendingSelectionAction(playerKey: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.readPendingSelectionAction !== 'function') {
            return null;
        }
        return pendingCoordinator.readPendingSelectionAction(playerKey);
    }

    function clearPendingSelectionAction(playerKey: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.clearPendingSelectionAction !== 'function') {
            return false;
        }
        return pendingCoordinator.clearPendingSelectionAction(playerKey);
    }

    function clearPendingSelectionFailureState(cardStateValue: any, playerKey: any, options: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (pendingCoordinator && typeof pendingCoordinator.clearPendingSelectionFailureState === 'function') {
            return pendingCoordinator.clearPendingSelectionFailureState(cardStateValue, playerKey, options);
        }
        const opts = (options && typeof options === 'object') ? options : {};
        if (opts.clearPendingEffect === true && cardStateValue && cardStateValue.pendingEffectByPlayer) {
            cardStateValue.pendingEffectByPlayer[normalizeSelectionPlayerKey(playerKey)] = null;
        }
        clearPendingSelectionAction(playerKey);
        return true;
    }

    function syncPendingSelectionActionCache(pendingEffectByPlayer: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.syncPendingSelectionActionCache !== 'function') {
            return {
                cleared: [],
                retained: []
            };
        }
        return pendingCoordinator.syncPendingSelectionActionCache(pendingEffectByPlayer);
    }

    function shouldRetainPendingSelectionAction(cardStateValue: any, playerKey: any, pendingType: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (!pendingCoordinator || typeof pendingCoordinator.shouldRetainPendingSelectionAction !== 'function') {
            return false;
        }
        return pendingCoordinator.shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType);
    }

    function capturePendingSelectionSnapshot(gameStateValue: any, cardStateValue: any) {
        const networkTurnHandoff = getNetworkTurnHandoff();
        if (networkTurnHandoff && typeof networkTurnHandoff.captureNetworkPublishSnapshot === 'function') {
            return networkTurnHandoff.captureNetworkPublishSnapshot(gameStateValue, cardStateValue);
        }
        if (!gameStateValue || !cardStateValue) return null;
        try {
            return {
                gameState: cloneData(gameStateValue),
                cardState: cloneData(cardStateValue)
            };
        } catch (e) {
            return null;
        }
    }

    function publishPendingSelectionSnapshot(meta: any) {
        const payload = (meta && typeof meta === 'object') ? meta : {};
        const publishSnapshotViaBridge = readSignalBridgeMethod('publishSnapshot');
        if (publishSnapshotViaBridge) {
            try {
                return publishSnapshotViaBridge(payload);
            } catch (e) { /* ignore */ }
        }
        return undefined;
    }

    function setSelectionProcessing(nextValue: any) {
        const normalized = nextValue === true;
        localSelectionBusyState.processing = normalized;
        invokeSignalBridgeMethod('setSelectionProcessing', [normalized]);
        return true;
    }

    function setSelectionCardAnimating(nextValue: any) {
        const normalized = nextValue === true;
        localSelectionBusyState.cardAnimating = normalized;
        invokeSignalBridgeMethod('setSelectionCardAnimating', [normalized]);
        return true;
    }

    function setSelectionBusy(nextValue: any) {
        const normalized = nextValue === true;
        if (normalized) {
            if (!sharedSelectionBusyLockToken) {
                sharedSelectionBusyLockToken = beginSelectionSettlementLock({ source: 'selection_busy_bridge' });
            }
        } else if (sharedSelectionBusyLockToken) {
            endSelectionSettlementLock(sharedSelectionBusyLockToken);
            sharedSelectionBusyLockToken = null;
        }
        localSelectionBusyState.processing = normalized;
        localSelectionBusyState.cardAnimating = normalized;
        invokeSignalBridgeMethod('setSelectionBusy', [normalized]);
        return true;
    }

    function readSelectionBusyState() {
        const settlementLocked = isSelectionSettlementLocked();
        const bridgeState = invokeSignalBridgeMethod('readSelectionBusyState', [{
            settlementLocked,
            localSelectionBusyState: Object.assign({}, localSelectionBusyState)
        }]);
        if (bridgeState && typeof bridgeState === 'object') {
            return {
                processing: settlementLocked || bridgeState.processing === true,
                cardAnimating: settlementLocked || bridgeState.cardAnimating === true
            };
        }

        return {
            processing: settlementLocked || localSelectionBusyState.processing === true,
            cardAnimating: settlementLocked || localSelectionBusyState.cardAnimating === true
        };
    }

    function shouldAllowSelectionEntryDuringPlayback(playerKey: any, pendingType: any) {
        return invokeSignalBridgeMethod('shouldAllowSelectionEntryDuringPlayback', [{ playerKey, pendingType }]) === true;
    }

    function clearSelectionEntryDuringPlayback() {
        return invokeSignalBridgeMethod('clearSelectionEntryPlaybackContext') === true;
    }

    function readMatchMode() {
        const runtimeModule = getSelectionFlowRuntimeModule();
        if (runtimeModule && typeof runtimeModule.readMatchMode === 'function') {
            return runtimeModule.readMatchMode({
                getSignalBridge,
                readSignalBridgeMethod,
                resolveGlobalValue
            });
        }
        const readMatchModeFromBridge = readSignalBridgeMethod('readMatchMode');
        if (readMatchModeFromBridge) {
            try {
                const mode = readMatchModeFromBridge();
                if (typeof mode !== 'undefined' && mode !== null) return mode;
            } catch (e) { /* ignore and fall back to legacy root */ }
        }
        const getCurrentMatchModeFromBridge = readSignalBridgeMethod('getCurrentMatchMode');
        if (getCurrentMatchModeFromBridge) {
            try {
                const mode = getCurrentMatchModeFromBridge();
                if (typeof mode !== 'undefined' && mode !== null) return mode;
            } catch (e) { /* ignore and fall back to legacy root */ }
        }
        const bridge = getSignalBridge();
        if (bridge && typeof bridge.MATCH_MODE !== 'undefined') return bridge.MATCH_MODE;
        const getCurrentMatchMode = resolveGlobalValue('getCurrentMatchMode');
        if (typeof getCurrentMatchMode === 'function') {
            try {
                const mode = getCurrentMatchMode();
                if (typeof mode !== 'undefined' && mode !== null) return mode;
            } catch (e) { /* ignore */ }
        }
        const globalMatchMode = resolveGlobalValue('MATCH_MODE');
        if (typeof globalMatchMode !== 'undefined') return globalMatchMode;
        const legacyGlobalMatchMode = resolveGlobalValue('__MATCH_MODE');
        if (typeof legacyGlobalMatchMode !== 'undefined') return legacyGlobalMatchMode;
        return null;
    }

    function hasActiveNetworkPublishClient() {
        const runtimeModule = getSelectionFlowRuntimeModule();
        if (runtimeModule && typeof runtimeModule.hasActiveNetworkPublishClient === 'function') {
            return runtimeModule.hasActiveNetworkPublishClient({
                readSignalBridgeMethod
            });
        }
        const isNetworkPublishActiveViaBridge = readSignalBridgeMethod('isNetworkPublishActive');
        if (typeof isNetworkPublishActiveViaBridge === 'function') {
            try {
                return isNetworkPublishActiveViaBridge() === true;
            } catch (e) {
                return false;
            }
        }
        return false;
    }

    function shouldUseNetworkPublishOnlyPendingSelection(pendingType: any) {
        if (readMatchMode() !== 'network') return false;
        if (!shouldDeferNetworkPublishForPendingType(pendingType)) return false;
        const contract = resolvePendingSelectionContract(pendingType);
        if (contract && contract.kind === 'multi_stage') return false;
        if (!isSelectionOnlyEndTurnPendingType(pendingType)) return false;
        return hasActiveNetworkPublishClient();
    }

    function shouldUsePreviewThenPublishOnlyPendingSelection(pendingType: any) {
        if (shouldUseNetworkPublishOnlyPendingSelection(pendingType)) return false;
        if (readMatchMode() !== 'network') return false;
        if (!shouldDeferNetworkPublishForPendingType(pendingType)) return false;
        if (!hasActiveNetworkPublishClient()) return false;
        const contract = resolvePendingSelectionContract(pendingType);
        if (!contract) return false;
        if (contract.kind === 'multi_stage' || contract.kind === 'hand_overlay') return false;
        return true;
    }

    function shouldSuppressLocalPlaybackForDeferredNetworkSelection(pendingType: any) {
        if (readMatchMode() !== 'network') return false;
        if (!shouldDeferNetworkPublishForPendingType(pendingType)) return false;
        if (isSelectionOnlyEndTurnPendingType(pendingType)) return false;
        return hasActiveNetworkPublishClient();
    }

    function isHumanVsHumanModeEnabled() {
        const runtimeModule = getSelectionFlowRuntimeModule();
        if (runtimeModule && typeof runtimeModule.isHumanVsHumanModeEnabled === 'function') {
            return runtimeModule.isHumanVsHumanModeEnabled({
                readSignalBridgeMethod,
                getSignalBridge,
                resolveGlobalValue
            });
        }
        const readHumanVsHumanMode = readSignalBridgeMethod('readHumanVsHumanMode');
        if (readHumanVsHumanMode) {
            try {
                const explicit = readHumanVsHumanMode();
                if (typeof explicit !== 'undefined' && explicit !== null) return explicit === true;
            } catch (e) { /* ignore */ }
        }
        return readMatchMode() === 'network';
    }

    function resolveCurrentGameState() {
        const runtimeModule = getSelectionFlowRuntimeModule();
        if (runtimeModule && typeof runtimeModule.resolveCurrentGameState === 'function') {
            return runtimeModule.resolveCurrentGameState({
                getSignalBridge,
                readSignalBridgeMethod,
                resolveGlobalValue
            });
        }
        const bridge = getSignalBridge();
        if (bridge && bridge.gameState && typeof bridge.gameState === 'object') {
            return bridge.gameState;
        }
        const getGameStateFromBridge = readSignalBridgeMethod('getGameState');
        if (getGameStateFromBridge) {
            try {
                const state = getGameStateFromBridge();
                if (state && typeof state === 'object') return state;
            } catch (e) { /* ignore */ }
        }
        const globalState = resolveGlobalValue('gameState');
        if (globalState && typeof globalState === 'object') return globalState;
        return null;
    }

    function resolveCurrentCardState() {
        const runtimeModule = getSelectionFlowRuntimeModule();
        if (runtimeModule && typeof runtimeModule.resolveCurrentCardState === 'function') {
            return runtimeModule.resolveCurrentCardState({
                getSignalBridge,
                readSignalBridgeMethod,
                resolveGlobalValue
            });
        }
        const bridge = getSignalBridge();
        if (bridge && bridge.cardState && typeof bridge.cardState === 'object') {
            return bridge.cardState;
        }
        const getCardStateFromBridge = readSignalBridgeMethod('getCardState');
        if (getCardStateFromBridge) {
            try {
                const state = getCardStateFromBridge();
                if (state && typeof state === 'object') return state;
            } catch (e) { /* ignore */ }
        }
        const globalState = resolveGlobalValue('cardState');
        if (globalState && typeof globalState === 'object') return globalState;
        return null;
    }

    function scheduleWhiteCpuTurn(options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const safeDelay = Number.isFinite(Number(opts.delayMs)) ? Math.max(0, Math.trunc(Number(opts.delayMs))) : 0;
        const expectedTurnNumber = Number.isFinite(Number(opts.expectedTurnNumber)) ? Number(opts.expectedTurnNumber) : null;
        const expectedPlayerKey = (typeof opts.nextPlayerKey === 'undefined' || opts.nextPlayerKey === null)
            ? null
            : normalizeSelectionPlayerKey(opts.nextPlayerKey);
        const scheduleCpuTurn = readSignalBridgeMethod('scheduleCpuTurn');
        const processCpuTurn = readSignalBridgeMethod('processCpuTurn');
        if (!scheduleCpuTurn || !processCpuTurn) return false;
        const tid = scheduleCpuTurn(safeDelay, () => {
            try {
                const gameStateRef = resolveCurrentGameState();
                const currentPlayer = gameStateRef ? gameStateRef.currentPlayer : null;
                const currentTurnNumber = (gameStateRef && Number.isFinite(Number(gameStateRef.turnNumber))) ? Number(gameStateRef.turnNumber) : null;
                const currentPlayerKey = resolveSelectionTurnPlayerKeyOptional(currentPlayer);
                if (expectedPlayerKey && currentPlayerKey !== expectedPlayerKey) return;
                if (expectedTurnNumber !== null && currentTurnNumber !== null && expectedTurnNumber !== currentTurnNumber) return;
                processCpuTurn();
            } catch (e) { /* ignore */ }
        });
        if (tid && typeof tid.unref === 'function') tid.unref();
        return true;
    }

    async function waitForSelectionPlaybackIdle(playbackEvents: any) {
        const networkHandoffModule = getSelectionFlowNetworkHandoffModule();
        if (!networkHandoffModule || typeof networkHandoffModule.waitForSelectionPlaybackIdle !== 'function') {
            return;
        }
        return networkHandoffModule.waitForSelectionPlaybackIdle(playbackEvents, {
            getNetworkTurnHandoff,
            waitForPlaybackViaBridge: async (events: any) => {
                const waitForPlaybackViaBridge = readSignalBridgeMethod('waitForPlaybackIdle');
                if (typeof waitForPlaybackViaBridge !== 'function') return;
                await waitForPlaybackViaBridge(events);
            }
        });
    }

    function resolveActionManager() {
        const bridge = getSignalBridge();
        if (bridge && bridge.actionManager && typeof bridge.actionManager === 'object') {
            return bridge.actionManager;
        }
        const getActionManagerFromBridge = readSignalBridgeMethod('getActionManager');
        if (getActionManagerFromBridge) {
            try {
                const manager = getActionManagerFromBridge();
                if (manager && typeof manager === 'object') return manager;
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function createPendingSelectionAction(playerKey: any, pendingType: any, actionPayload: any, options: any) {
        const pendingCoordinator = getPendingCoordinator();
        if (pendingCoordinator && typeof pendingCoordinator.createPendingSelectionAction === 'function') {
            return pendingCoordinator.createPendingSelectionAction(playerKey, pendingType, actionPayload, options);
        }
        const opts = (options && typeof options === 'object') ? options : {};
        const normalizedPayload = Object.assign({}, actionPayload || {});
        const actionType = typeof opts.actionType === 'string' && opts.actionType ? opts.actionType : 'place';
        const actionManager = resolveActionManager();
        const action = (actionManager && actionManager.ActionManager && typeof actionManager.ActionManager.createAction === 'function')
            ? actionManager.ActionManager.createAction(actionType, playerKey, normalizedPayload)
            : Object.assign({ type: actionType }, normalizedPayload);
        if (action && opts.cardState && typeof opts.cardState.turnIndex === 'number') {
            action.turnIndex = opts.cardState.turnIndex;
        }
        return storePendingSelectionAction(playerKey, action, pendingType);
    }

    async function finalizePendingSelectionFlow(options: any) {
        const networkHandoffModule = getSelectionFlowNetworkHandoffModule();
        if (!networkHandoffModule || typeof networkHandoffModule.finalizePendingSelectionFlow !== 'function') {
            return false;
        }
        return networkHandoffModule.finalizePendingSelectionFlow(options, {
            normalizePendingType,
            resolvePendingSelectionContract,
            resolveCurrentCardState,
            syncPendingSelectionActionCache,
            storePendingSelectionAction,
            readPendingSelectionAction,
            shouldRetainPendingSelectionAction,
            clearPendingSelectionAction,
            readMatchMode,
            hasActiveNetworkPublishClient,
            isHumanVsHumanModeEnabled,
            getNetworkTurnHandoff,
            setSelectionProcessing,
            setSelectionCardAnimating,
            publishPendingSelectionSnapshot,
            scheduleWhiteCpuTurn,
            waitForPlaybackViaBridge: async (playbackEvents: any) => {
                const waitForPlaybackViaBridge = readSignalBridgeMethod('waitForPlaybackIdle');
                if (typeof waitForPlaybackViaBridge !== 'function') return;
                await waitForPlaybackViaBridge(playbackEvents);
            }
        });
    }

    function resolvePresentationHelper() {
        const bridge = getSignalBridge();
        if (bridge && bridge.presentationHelper && typeof bridge.presentationHelper === 'object') {
            return bridge.presentationHelper;
        }
        const getPresentationHelperFromBridge = readSignalBridgeMethod('getPresentationHelper');
        if (getPresentationHelperFromBridge) {
            try {
                const helper = getPresentationHelperFromBridge();
                if (helper && typeof helper === 'object') return helper;
            } catch (e) { /* ignore */ }
        }
        return requireSelectionFlowModuleOrNull('../logic/presentation');
    }

    function resolveTurnPipelineUIAdapter() {
        const bridge = getSignalBridge();
        if (bridge && bridge.turnPipelineUIAdapter && typeof bridge.turnPipelineUIAdapter === 'object') {
            return bridge.turnPipelineUIAdapter;
        }
        const getAdapterFromBridge = readSignalBridgeMethod('getTurnPipelineUIAdapter');
        if (getAdapterFromBridge) {
            try {
                const adapter = getAdapterFromBridge();
                if (adapter && typeof adapter === 'object') return adapter;
            } catch (e) { /* ignore */ }
        }
        const globalAdapter = resolveGlobalValue('TurnPipelineUIAdapter');
        if (globalAdapter && typeof globalAdapter === 'object') return globalAdapter;
        return requireSelectionFlowModuleOrNull('../turn/pipeline_ui_adapter');
    }

    function resolveTurnPipeline() {
        const bridge = getSignalBridge();
        if (bridge && bridge.turnPipeline && typeof bridge.turnPipeline === 'object') {
            return bridge.turnPipeline;
        }
        const getPipelineFromBridge = readSignalBridgeMethod('getTurnPipeline');
        if (getPipelineFromBridge) {
            try {
                const pipeline = getPipelineFromBridge();
                if (pipeline && typeof pipeline === 'object') return pipeline;
            } catch (e) { /* ignore */ }
        }
        const globalPipeline = resolveGlobalValue('TurnPipeline');
        if (globalPipeline && typeof globalPipeline === 'object') return globalPipeline;
        return requireSelectionFlowModuleOrNull('../turn/turn_pipeline');
    }

    function resolveRootFunction(name: any) {
        if (typeof name !== 'string') return null;
        const bridgeFn = readSignalBridgeMethod(name);
        if (bridgeFn) return bridgeFn;
        const globalFn = resolveGlobalValue(name);
        if (typeof globalFn === 'function') return globalFn;
        if (name === 'ensureCurrentPlayerCanActOrPass') {
            try {
                const passHandler = _require('../pass-handler');
                return passHandler && typeof passHandler.ensureCurrentPlayerCanActOrPass === 'function'
                    ? passHandler.ensureCurrentPlayerCanActOrPass
                    : null;
            } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveSelectionMessage(message: any, context: any) {
        const value = (typeof message === 'function')
            ? message(context || {})
            : message;
        return String(value || '').trim();
    }

    function emitSelectionMessage(message: any, context: any) {
        const text = resolveSelectionMessage(message, context);
        if (!text) return false;
        const emitMessageViaBridge = readSignalBridgeMethod('emitMessage');
        if (typeof emitMessageViaBridge !== 'function') return false;
        try {
            return emitMessageViaBridge(text, context || {}) === true;
        } catch (e) {
            return false;
        }
    }

    function applyStateSnapshotInPlace(currentValue: any, nextValue: any) {
        const stateModule = getSelectionFlowStateModule();
        if (stateModule && typeof stateModule.applyStateSnapshotInPlace === 'function') {
            return stateModule.applyStateSnapshotInPlace(currentValue, nextValue);
        }
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

    function resolveSelectionStateRefs(options?: any) {
        const stateModule = getSelectionFlowStateModule();
        if (stateModule && typeof stateModule.resolveSelectionStateRefs === 'function') {
            return stateModule.resolveSelectionStateRefs(options, {
                resolveCurrentCardState,
                resolveCurrentGameState
            });
        }
        const opts = (options && typeof options === 'object') ? options : {};
        return {
            cardState: opts.cardState || resolveCurrentCardState(),
            gameState: opts.gameState || resolveCurrentGameState()
        };
    }

    function publishSelectionStateRef(name: any, value: any) {
        const stateModule = getSelectionFlowStateModule();
        if (stateModule && typeof stateModule.publishSelectionStateRef === 'function') {
            return stateModule.publishSelectionStateRef(name, value, {
                readSignalBridgeMethod,
                getSignalBridge
            });
        }
        const methodName = name === 'gameState' ? 'setGameState' : 'setCardState';
        const publishStateRef = readSignalBridgeMethod(methodName);
        if (publishStateRef) {
            try { return publishStateRef(value) === true; } catch (e) { /* ignore */ }
        }
        const bridge = getSignalBridge();
        if (bridge && typeof bridge === 'object' && name) {
            try {
                bridge[name] = value;
                return true;
            } catch (e) { /* ignore */ }
        }
        return false;
    }

    function applySelectionStateResult(result: any, options: any) {
        const stateModule = getSelectionFlowStateModule();
        if (stateModule && typeof stateModule.applySelectionStateResult === 'function') {
            return stateModule.applySelectionStateResult(result, options, {
                readSignalBridgeMethod,
                getSignalBridge,
                resolveCurrentCardState,
                resolveCurrentGameState
            });
        }
        const stateRefs = resolveSelectionStateRefs(options);
        let nextCardState = stateRefs.cardState;
        let nextGameState = stateRefs.gameState;

        if (result && result.nextCardState) {
            nextCardState = applyStateSnapshotInPlace(nextCardState, result.nextCardState);
            publishSelectionStateRef('cardState', nextCardState);
        }
        if (result && result.nextGameState) {
            nextGameState = applyStateSnapshotInPlace(nextGameState, result.nextGameState);
            publishSelectionStateRef('gameState', nextGameState);
        }
        return {
            cardState: nextCardState,
            gameState: nextGameState
        };
    }

    function resolveAuthoritativeSelectionState() {
        const stateModule = getSelectionFlowStateModule();
        if (stateModule && typeof stateModule.resolveAuthoritativeSelectionState === 'function') {
            return stateModule.resolveAuthoritativeSelectionState({
                resolveCurrentCardState,
                resolveCurrentGameState
            });
        }
        const stateRefs = resolveSelectionStateRefs();
        return {
            cardState: stateRefs.cardState,
            gameState: stateRefs.gameState
        };
    }

    function emitSelectionPlaybackEvents(playbackEvents: any, meta: any, cardStateValue: any) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        const emitPlaybackEventsViaBridge = readSignalBridgeMethod('emitPlaybackEvents');
        if (typeof emitPlaybackEventsViaBridge !== 'function') return false;
        try {
            return emitPlaybackEventsViaBridge(
                playbackEvents,
                (meta && typeof meta === 'object') ? meta : {},
                cardStateValue || resolveCurrentCardState()
            ) === true;
        } catch (e) {
            return false;
        }
    }

    function shouldSuppressBoardExpansionRevealSound(playbackEvents: any) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        return playbackEvents.some((event) => {
            if (!event || event.type !== 'move' || !Array.isArray(event.targets)) return false;
            return event.targets.some((target: any) => normalizePendingType(target && target.cause) === 'CELL_TELEPORT_WILL');
        });
    }

    function armSelectionBoardUpdateContext(playbackEvents: any) {
        if (!shouldSuppressBoardExpansionRevealSound(playbackEvents)) return false;

        const context = {
            source: 'selection-flow',
            reason: 'pre_playback_state_sync',
            suppressBoardExpansionRevealSound: true
        };

        return invokeSignalBridgeMethod('armSelectionBoardUpdateContext', [context]) === true;
    }

    function emitSelectionStateChangeSignals(playbackEvents: any) {
        armSelectionBoardUpdateContext(playbackEvents);
        const emitStateChangesViaBridge = readSignalBridgeMethod('emitStateChanges');
        if (typeof emitStateChangesViaBridge !== 'function') return false;
        try {
            return emitStateChangesViaBridge(playbackEvents) === true;
        } catch (e) {
            return false;
        }
    }

    function defaultSelectionHandoffRender() {
        const emitBoardUpdateViaBridge = readSignalBridgeMethod('emitBoardUpdate');
        if (typeof emitBoardUpdateViaBridge !== 'function') return;
        try { emitBoardUpdateViaBridge(); } catch (e) { /* ignore */ }
    }

    async function executePendingSelectionCompatibilityFallback(options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const row = Number(opts.row);
        const col = Number(opts.col);
        const playerKey = normalizeSelectionPlayerKey(opts.playerKey);
        const actionType = typeof opts.actionType === 'string' && opts.actionType
            ? opts.actionType
            : 'place';
        const stateRefs = resolveSelectionStateRefs(opts);
        const pendingCoordinator = getPendingCoordinator();
        const pending = (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function')
            ? pendingCoordinator.readPendingEffect(stateRefs.cardState, playerKey)
            : (stateRefs.cardState && stateRefs.cardState.pendingEffectByPlayer
                ? stateRefs.cardState.pendingEffectByPlayer[playerKey]
                : null);
        const resolvedPendingType = normalizePendingType(pending && pending.type);
        const allowSelectionEntryDuringPlayback = shouldAllowSelectionEntryDuringPlayback(playerKey, resolvedPendingType);
        const busyState = readSelectionBusyState();
        if (
            allowSelectionEntryDuringPlayback !== true
            && (busyState.processing === true || busyState.cardAnimating === true)
        ) {
            return { ok: false, reason: 'busy' };
        }
        if (allowSelectionEntryDuringPlayback === true) {
            clearSelectionEntryDuringPlayback();
        }
        const selectionSettlementLockToken = beginSelectionSettlementLock({
            playerKey,
            pendingType: resolvedPendingType,
            actionType,
            source: 'selection_flow_compatibility'
        });
        const ownsSelectionCardAnimating = allowSelectionEntryDuringPlayback !== true;
        setSelectionProcessing(true);
        if (ownsSelectionCardAnimating) {
            setSelectionCardAnimating(true);
        }
        let shouldFinalize = false;
        let pendingAction: any = null;
        let playbackEvents: any[] = [];
        let executionResult: any = null;
        let appliedSelection = null;
        let shouldClearPendingActionOnExit = false;

        function markPendingActionFailure() {
            if (!pendingAction || typeof pendingAction !== 'object') return;
            shouldClearPendingActionOnExit = true;
        }

        try {
            if (!pending || !resolvedPendingType) {
                return { ok: false, reason: 'pending_unavailable' };
            }
            const baseContext = {
                row,
                col,
                playerKey,
                pending,
                pendingType: resolvedPendingType,
                cardState: stateRefs.cardState,
                gameState: stateRefs.gameState,
                stateRefs
            };
            if (typeof opts.beforeRun === 'function') {
                const beforeRunResult = await opts.beforeRun(baseContext);
                if (beforeRunResult === false) {
                    return { ok: false, reason: 'before_run_rejected' };
                }
            }
            const actionPayload = (typeof opts.buildActionPayload === 'function')
                ? (await opts.buildActionPayload(baseContext))
                : Object.assign({}, opts.actionPayload || {});
            pendingAction = createPendingSelectionAction(playerKey, resolvedPendingType, actionPayload, {
                cardState: stateRefs.cardState,
                actionType
            });
            const adapter = resolveTurnPipelineUIAdapter();
            const pipeline = resolveTurnPipeline();
            executionResult = (adapter && pipeline && typeof adapter.runTurnWithAdapter === 'function')
                ? adapter.runTurnWithAdapter(stateRefs.cardState, stateRefs.gameState, playerKey, pendingAction, pipeline)
                : null;
            if (!executionResult || executionResult.ok === false) {
                markPendingActionFailure();
                emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult
                }));
                return {
                    ok: false,
                    reason: 'selection_rejected',
                    result: executionResult
                };
            }

            appliedSelection = (typeof opts.validateResult === 'function')
                ? (await opts.validateResult(Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult
                })))
                : true;
            if (!appliedSelection) {
                markPendingActionFailure();
                emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult
                }));
                return {
                    ok: false,
                    reason: 'selection_not_applied',
                    result: executionResult
                };
            }

            const appliedState = applySelectionStateResult(executionResult, stateRefs);
            playbackEvents = Array.isArray(executionResult.playbackEvents)
                ? executionResult.playbackEvents
                : [];
            const playbackMeta = (typeof opts.buildPlaybackMeta === 'function')
                ? opts.buildPlaybackMeta(Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult,
                    appliedSelection,
                    cardState: appliedState.cardState,
                    gameState: appliedState.gameState,
                    playbackEvents
                }))
                : { cause: resolvedPendingType, target: { row, col } };
            emitSelectionPlaybackEvents(playbackEvents, playbackMeta, appliedState.cardState);
            if (opts.emitStateChanges !== false) {
                emitSelectionStateChangeSignals(playbackEvents);
            }
            if (typeof opts.afterStateChange === 'function') {
                await opts.afterStateChange(Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult,
                    appliedSelection,
                    cardState: appliedState.cardState,
                    gameState: appliedState.gameState,
                    playbackEvents
                }));
            }
            shouldFinalize = true;
            return {
                ok: true,
                pendingType: resolvedPendingType,
                action: pendingAction,
                result: executionResult,
                appliedSelection,
                playbackEvents,
                fallbackExecution: true
            };
        } finally {
            endSelectionSettlementLock(selectionSettlementLockToken);
            if (shouldFinalize) {
                try {
                    const finalizeOptions = Object.assign({
                        playerKey,
                        pendingType: resolvedPendingType,
                        actionType,
                        action: pendingAction,
                        playbackEvents,
                        gameStateValue: stateRefs.gameState,
                        cardStateValue: stateRefs.cardState,
                        onHumanTurnReady: defaultSelectionHandoffRender,
                        ensureCurrentPlayerCanActOrPass: resolveRootFunction('ensureCurrentPlayerCanActOrPass'),
                        clearCardAnimatingOnFinish: true
                    }, (opts.finalizeOptions && typeof opts.finalizeOptions === 'object') ? opts.finalizeOptions : {});
                    await finalizePendingSelectionFlow(finalizeOptions);
                } catch (e) {
                    setSelectionProcessing(false);
                    setSelectionCardAnimating(false);
                }
            } else {
                if (shouldClearPendingActionOnExit) {
                    clearPendingSelectionFailureState(stateRefs.cardState, playerKey, {
                        clearPendingEffect: false,
                        failureReason: 'selection_failed'
                    });
                }
                setSelectionProcessing(false);
                setSelectionCardAnimating(false);
            }
        }
    }

    async function executePendingSelection(options: any) {
        const pendingExecutionModule = getSelectionFlowPendingExecutionModule();
        if (!pendingExecutionModule || typeof pendingExecutionModule.executePendingSelection !== 'function') {
            return executePendingSelectionCompatibilityFallback(options);
        }
        const opts = (options && typeof options === 'object')
            ? Object.assign({ defaultSelectionHandoffRender }, options)
            : { defaultSelectionHandoffRender };
        return pendingExecutionModule.executePendingSelection(opts, {
            normalizePendingType,
            normalizeSelectionPlayerKey,
            resolveSelectionStateRefs,
            getPendingCoordinator,
            shouldAllowSelectionEntryDuringPlayback,
            readSelectionBusyState,
            beginSelectionSettlementLock,
            endSelectionSettlementLock,
            clearSelectionEntryDuringPlayback,
            setSelectionProcessing,
            setSelectionCardAnimating,
            createPendingSelectionAction,
            resolvePendingSelectionContract,
            shouldUseNetworkPublishOnlyPendingSelection,
            shouldUsePreviewThenPublishOnlyPendingSelection,
            shouldSuppressLocalPlaybackForDeferredNetworkSelection,
            publishPendingSelectionSnapshot,
            readMatchMode,
            hasActiveNetworkPublishClient,
            resolveAuthoritativeSelectionState,
            shouldRetainPendingSelectionAction,
            clearPendingSelectionAction,
            applySelectionStateResult,
            emitSelectionPlaybackEvents,
            emitSelectionStateChangeSignals,
            resolveTurnPipelineUIAdapter,
            resolveTurnPipeline,
            cloneData,
            clonePendingSelectionAction,
            emitSelectionMessage,
            resolveRootFunction,
            finalizePendingSelectionFlow,
            clearPendingSelectionFailureState
        });
    }

export = {
    PENDING_SELECTION_CONTRACTS: (function () {
        const pendingStateManager = getPendingStateManager();
        return pendingStateManager && pendingStateManager.PENDING_SELECTION_CONTRACTS
            ? pendingStateManager.PENDING_SELECTION_CONTRACTS
            : Object.freeze({});
    }()),
    resolvePendingSelectionContract,
    isSelectionOnlyEndTurnPendingType,
    shouldDeferNetworkPublishForPendingType,
    shouldWaitForPlaybackIdleForPendingType,
    setSelectionProcessing,
    setSelectionCardAnimating,
    setSelectionBusy,
    beginSelectionSettlementLock,
    endSelectionSettlementLock,
    isSelectionSettlementLocked,
    createPendingSelectionAction,
    readPendingSelectionAction,
    syncPendingSelectionActionCache,
    waitForSelectionPlaybackIdle,
    finalizePendingSelectionFlow,
    setSignalBridge,
    clearSignalBridge,
    applySelectionStateResult,
    emitSelectionPlaybackEvents,
    executePendingSelection,
    capturePendingSelectionSnapshot,
    publishPendingSelectionSnapshot
};
