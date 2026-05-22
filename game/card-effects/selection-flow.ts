import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;
const root: any = (typeof globalThis !== 'undefined') ? globalThis as any : (typeof global !== 'undefined' ? global as any : undefined);

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

    let cachedNetworkTurnHandoff: any = null;
    let cachedPendingCoordinator: any = null;
    let cachedPendingStateManager: any = null;
    let selectionSignalBridge: any = null;
    const localSelectionBusyState = {
        processing: false,
        cardAnimating: false
    };

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
        if (!cachedNetworkTurnHandoff && root && root.NetworkTurnHandoff) {
            cachedNetworkTurnHandoff = root.NetworkTurnHandoff;
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

    function getPendingStateManager() {
        if (cachedPendingStateManager && typeof cachedPendingStateManager === 'object') {
            return cachedPendingStateManager;
        }
        if (typeof require === 'function') {
            try { cachedPendingStateManager = require('../logic/cards-internal/pending-state-manager'); } catch (e) { /* ignore */ }
        }
        if (!cachedPendingStateManager && root && root.CardPendingStateManager) {
            cachedPendingStateManager = root.CardPendingStateManager;
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
        if (!cachedPendingCoordinator && root && root.PendingCoordinator) {
            cachedPendingCoordinator = root.PendingCoordinator;
        }
        return cachedPendingCoordinator;
    }

    function getPlaybackStateManager() {
        const bridge = getSignalBridge();
        if (bridge && bridge.playbackStateManager && typeof bridge.playbackStateManager === 'object') {
            return bridge.playbackStateManager;
        }
        const getPlaybackStateManagerFromBridge = readSignalBridgeMethod('getPlaybackStateManager');
        if (getPlaybackStateManagerFromBridge) {
            try {
                const playbackStateFromBridge = getPlaybackStateManagerFromBridge();
                if (playbackStateFromBridge && typeof playbackStateFromBridge === 'object') {
                    return playbackStateFromBridge;
                }
            } catch (e) { /* ignore */ }
        }
        return null;
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
            if (root && typeof root.structuredClone === 'function') {
                return root.structuredClone(value);
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
        const playbackState = getPlaybackStateManager();
        const normalized = nextValue === true;
        localSelectionBusyState.processing = normalized;
        if (!playbackState || typeof playbackState !== 'object') return true;
        try {
            if (typeof playbackState.setBusyState === 'function') {
                playbackState.setBusyState({ processing: normalized });
                return true;
            }
            if (typeof playbackState.setProcessing === 'function') {
                playbackState.setProcessing(normalized);
                return true;
            }
        } catch (e) { /* ignore */ }
        return true;
    }

    function setSelectionCardAnimating(nextValue: any) {
        const playbackState = getPlaybackStateManager();
        const normalized = nextValue === true;
        localSelectionBusyState.cardAnimating = normalized;
        if (!playbackState || typeof playbackState !== 'object') return true;
        try {
            if (typeof playbackState.setBusyState === 'function') {
                playbackState.setBusyState({ cardAnimating: normalized });
                return true;
            }
            if (typeof playbackState.setCardAnimating === 'function') {
                playbackState.setCardAnimating(normalized);
                return true;
            }
        } catch (e) { /* ignore */ }
        return true;
    }

    function setSelectionBusy(nextValue: any) {
        const playbackState = getPlaybackStateManager();
        const normalized = nextValue === true;
        localSelectionBusyState.processing = normalized;
        localSelectionBusyState.cardAnimating = normalized;
        if (playbackState && typeof playbackState === 'object') {
            try {
                if (typeof playbackState.setBusyState === 'function') {
                    playbackState.setBusyState({
                        processing: normalized,
                        cardAnimating: normalized
                    });
                    return true;
                }
            } catch (e) { /* ignore */ }
        }
        return true;
    }

    function readSelectionBusyState() {
        const playbackState = getPlaybackStateManager();
        if (!playbackState || typeof playbackState !== 'object') {
            return {
                processing: localSelectionBusyState.processing === true,
                cardAnimating: localSelectionBusyState.cardAnimating === true
            };
        }

        let processing = false;
        let cardAnimating = false;
        try {
            if (typeof playbackState.getProcessing === 'function') {
                processing = playbackState.getProcessing() === true;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof playbackState.getCardAnimating === 'function') {
                cardAnimating = playbackState.getCardAnimating() === true;
            }
        } catch (e) { /* ignore */ }

        return {
            processing,
            cardAnimating
        };
    }

    function shouldAllowSelectionEntryDuringPlayback(playerKey: any, pendingType: any) {
        const playbackState = getPlaybackStateManager();
        if (!playbackState || typeof playbackState.shouldAllowSelectionEntryDuringPlayback !== 'function') {
            return false;
        }
        try {
            return playbackState.shouldAllowSelectionEntryDuringPlayback({
                playerKey,
                pendingType
            }) === true;
        } catch (e) {
            return false;
        }
    }

    function clearSelectionEntryDuringPlayback() {
        const playbackState = getPlaybackStateManager();
        if (!playbackState || typeof playbackState.clearSelectionEntryPlaybackContext !== 'function') {
            return false;
        }
        try {
            playbackState.clearSelectionEntryPlaybackContext();
            return true;
        } catch (e) {
            return false;
        }
    }

    function readMatchMode() {
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
        return null;
    }

    function hasActiveNetworkPublishClient() {
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
        const readHumanVsHumanMode = readSignalBridgeMethod('readHumanVsHumanMode');
        if (readHumanVsHumanMode) {
            try {
                const explicit = readHumanVsHumanMode();
                if (typeof explicit !== 'undefined' && explicit !== null) return explicit === true;
            } catch (e) { /* ignore and fall back to legacy root */ }
        }
        return !!(root && (root.DEBUG_HUMAN_VS_HUMAN === true || readMatchMode() === 'network'));
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
                const gameStateRef = root && root.gameState ? root.gameState : null;
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
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return;

        const waitForPlaybackViaBridge = readSignalBridgeMethod('waitForPlaybackIdle');
        if (waitForPlaybackViaBridge) {
            try {
                await waitForPlaybackViaBridge(playbackEvents);
                return;
            } catch (e) { /* ignore */ }
        }

        const networkTurnHandoff = getNetworkTurnHandoff();
        if (networkTurnHandoff && typeof networkTurnHandoff.waitForPlaybackIdleIfNeeded === 'function') {
            return networkTurnHandoff.waitForPlaybackIdleIfNeeded(playbackEvents);
        }
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
        const opts = (options && typeof options === 'object') ? options : {};
        const pendingType = normalizePendingType(opts.pendingType);
        const contract = resolvePendingSelectionContract(pendingType);
        const playerKey = opts.playerKey || 'black';
        const actionType = opts.actionType || 'place';
        const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents.slice() : [];
        const cardStateValue = opts.cardStateValue || (root ? root.cardState : null);
        const pendingByPlayer = cardStateValue && cardStateValue.pendingEffectByPlayer;
        if (
            !(opts.action && typeof opts.action === 'object')
            && pendingByPlayer
            && pendingByPlayer[playerKey]
        ) {
            syncPendingSelectionActionCache(cardStateValue);
        }
        const pendingAction = (opts.action && typeof opts.action === 'object')
            ? storePendingSelectionAction(playerKey, opts.action, pendingType)
            : readPendingSelectionAction(playerKey);
        const ensureFn = typeof opts.ensureCurrentPlayerCanActOrPass === 'function'
            ? opts.ensureCurrentPlayerCanActOrPass
            : null;
        let skipNetworkPublish = opts.skipNetworkPublish === true;
        const clearCardAnimatingOnFinish = opts.clearCardAnimatingOnFinish !== false;
        const currentPending = pendingByPlayer ? pendingByPlayer[playerKey] : null;
        if (
            !skipNetworkPublish
            && contract
            && contract.deferNetworkPublish === true
            && contract.kind === 'multi_stage'
            && pendingAction
            && pendingAction.deferNetworkPublish === true
            && normalizePendingType(currentPending && currentPending.type) === pendingType
            && String(currentPending && currentPending.stage || '') === 'selectTarget'
        ) {
            skipNetworkPublish = true;
        }

        if (contract && contract.turnOutcome === 'end_turn') {
            const networkTurnHandoff = getNetworkTurnHandoff();
            let publishFailureHandled = false;
            if (!networkTurnHandoff || typeof networkTurnHandoff.finalizeNetworkTurnHandoff !== 'function') {
                setSelectionProcessing(false);
                if (clearCardAnimatingOnFinish) setSelectionCardAnimating(false);
                if (ensureFn) {
                    try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
                }
                return false;
            }

            const handoffResult = await networkTurnHandoff.finalizeNetworkTurnHandoff({
                awaitPublishResult: readMatchMode() === 'network' && contract.deferNetworkPublish === true && hasActiveNetworkPublishClient(),
                playerKey,
                actionType,
                action: pendingAction,
                playbackEvents,
                skipLocalPlaybackWait: readMatchMode() === 'network' && contract.deferNetworkPublish === true && hasActiveNetworkPublishClient(),
                humanMode: isHumanVsHumanModeEnabled(),
                setProcessing: setSelectionProcessing,
                onPublishFailed: () => {
                    publishFailureHandled = true;
                    clearPendingSelectionAction(playerKey);
                    if (clearCardAnimatingOnFinish) setSelectionCardAnimating(false);
                    if (ensureFn) {
                        try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
                    }
                },
                publishSnapshot: ({ playerKey: publishPlayerKey, action: publishAction, playbackEvents: publishPlaybackEvents }: { playerKey: any; action: any; playbackEvents: any }) => {
                    const publishMeta = {
                        playerKey: publishPlayerKey,
                        actionType,
                        action: publishAction || pendingAction,
                        playbackEvents: publishPlaybackEvents
                    };
                    return publishPendingSelectionSnapshot(publishMeta);
                },
                scheduleCpuTurn: scheduleWhiteCpuTurn,
                onHumanTurnReady: opts.onHumanTurnReady
            });
            if (readMatchMode() === 'network' && contract.deferNetworkPublish === true && hasActiveNetworkPublishClient()) {
                if (!handoffResult || handoffResult.ok !== true) {
                    if (!publishFailureHandled) {
                        clearPendingSelectionAction(playerKey);
                        setSelectionProcessing(false);
                        if (clearCardAnimatingOnFinish) setSelectionCardAnimating(false);
                        if (ensureFn) {
                            try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
                        }
                    }
                    return false;
                }
            }
            if (!shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType)) {
                clearPendingSelectionAction(playerKey);
            }
            if (clearCardAnimatingOnFinish) setSelectionCardAnimating(false);
            return true;
        }

        if (contract && contract.waitForPlaybackIdle && !(readMatchMode() === 'network' && contract.deferNetworkPublish === true && hasActiveNetworkPublishClient())) {
            await waitForSelectionPlaybackIdle(playbackEvents);
        }

        if (contract && contract.deferNetworkPublish && !skipNetworkPublish) {
            const publishMeta = {
                playerKey,
                actionType,
                action: pendingAction,
                playbackEvents
            };
            publishPendingSelectionSnapshot(publishMeta);
        }

        if (!shouldRetainPendingSelectionAction(cardStateValue, playerKey, pendingType)) {
            clearPendingSelectionAction(playerKey);
        }

        setSelectionProcessing(false);
        if (clearCardAnimatingOnFinish) setSelectionCardAnimating(false);

        if (typeof opts.onSettled === 'function') {
            try { await opts.onSettled(); } catch (e) { /* ignore */ }
        }

        if (ensureFn) {
            try { ensureFn({ useBlackDelay: opts.useBlackDelay !== false }); } catch (e) { /* ignore */ }
        }

        return true;
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
        if (typeof require === 'function') {
            try { return require('../logic/presentation'); } catch (e) { /* ignore */ }
        }
        return null;
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
        if (typeof require === 'function') {
            try { return require('../turn/pipeline_ui_adapter'); } catch (e) { /* ignore */ }
        }
        return null;
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
        if (typeof require === 'function') {
            try { return require('../turn/turn_pipeline'); } catch (e) { /* ignore */ }
        }
        return null;
    }

    function resolveRootFunction(name: any) {
        if (!root || typeof name !== 'string') return null;
        return typeof root[name] === 'function' ? root[name] : null;
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
        const opts = (options && typeof options === 'object') ? options : {};
        return {
            cardState: opts.cardState || (root ? root.cardState : null),
            gameState: opts.gameState || (root ? root.gameState : null)
        };
    }

    function applySelectionStateResult(result: any, options: any) {
        const stateRefs = resolveSelectionStateRefs(options);
        let nextCardState = stateRefs.cardState;
        let nextGameState = stateRefs.gameState;

        if (result && result.nextCardState) {
            nextCardState = applyStateSnapshotInPlace(nextCardState, result.nextCardState);
            if (root) {
                root.cardState = nextCardState;
            }
        }
        if (result && result.nextGameState) {
            nextGameState = applyStateSnapshotInPlace(nextGameState, result.nextGameState);
            if (root) {
                root.gameState = nextGameState;
            }
        }
        return {
            cardState: nextCardState,
            gameState: nextGameState
        };
    }

    function resolveAuthoritativeSelectionState() {
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
                cardStateValue || (root ? root.cardState : null)
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

        const playbackState = getPlaybackStateManager();
        if (playbackState && typeof playbackState.armBoardUpdateContext === 'function') {
            try {
                playbackState.armBoardUpdateContext(context);
                return true;
            } catch (e) { /* ignore */ }
        }
        return false;
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

    function buildPendingTypeAllowList(options: any, fallbackPendingType: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const list = Array.isArray(opts.pendingTypes)
            ? opts.pendingTypes.slice()
            : (typeof opts.pendingType === 'string' && opts.pendingType ? [opts.pendingType] : []);
        if (typeof fallbackPendingType === 'string' && fallbackPendingType) {
            list.push(fallbackPendingType);
        }
        return Array.from(new Set(list.map(normalizePendingType).filter((value: any) => !!value)));
    }

    function getSelectionPending(playerKey: any, options: any) {
        const normalizedPlayerKey = normalizeSelectionPlayerKey(playerKey);
        const opts = (options && typeof options === 'object') ? options : {};
        const stateRefs = resolveSelectionStateRefs(opts);
        const pendingCoordinator = getPendingCoordinator();
        const pending = (pendingCoordinator && typeof pendingCoordinator.readPendingEffect === 'function')
            ? pendingCoordinator.readPendingEffect(stateRefs.cardState, normalizedPlayerKey)
            : (stateRefs.cardState && stateRefs.cardState.pendingEffectByPlayer
                ? stateRefs.cardState.pendingEffectByPlayer[normalizedPlayerKey]
                : null);
        if (!pending || typeof pending !== 'object') {
            return { pending: null, pendingType: null };
        }
        const pendingType = normalizePendingType(pending.type);
        const allowList = buildPendingTypeAllowList(opts, pendingType);
        const requiredStage = typeof opts.stage === 'string' && opts.stage
            ? opts.stage
            : 'selectTarget';
        if (requiredStage && pending.stage !== requiredStage) {
            return { pending: null, pendingType };
        }
        if (allowList.length > 0 && allowList.indexOf(pendingType) === -1) {
            return { pending: null, pendingType };
        }
        return { pending, pendingType };
    }

    function defaultSelectionHandoffRender() {
        const emitBoardUpdateViaBridge = readSignalBridgeMethod('emitBoardUpdate');
        if (typeof emitBoardUpdateViaBridge !== 'function') return;
        try { emitBoardUpdateViaBridge(); } catch (e) { /* ignore */ }
    }

    async function previewPendingSelectionExecution(options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const adapter = resolveTurnPipelineUIAdapter();
        const pipeline = resolveTurnPipeline();
        if (!adapter || typeof adapter.runTurnWithAdapter !== 'function' || !pipeline) {
            return {
                ok: true,
                result: null,
                appliedSelection: true
            };
        }

        const previewCardState = cloneData(opts.cardState || (root ? root.cardState : null));
        const previewGameState = cloneData(opts.gameState || (root ? root.gameState : null));
        const previewAction = clonePendingSelectionAction(opts.action) || {};
        previewAction.__suppressUiLogs = true;

        const previewResult = adapter.runTurnWithAdapter(
            previewCardState,
            previewGameState,
            opts.playerKey,
            previewAction,
            pipeline
        );
        if (!previewResult || previewResult.ok === false) {
            return {
                ok: false,
                result: previewResult || { ok: false, reason: 'selection_preview_failed' },
                appliedSelection: false
            };
        }

        const previewContext = Object.assign({}, opts.context || {}, {
            action: previewAction,
            result: previewResult,
            cardState: previewResult.nextCardState || previewCardState,
            gameState: previewResult.nextGameState || previewGameState,
            playbackEvents: Array.isArray(previewResult.playbackEvents) ? previewResult.playbackEvents : []
        });
        const appliedSelection = (typeof opts.validateResult === 'function')
            ? (await opts.validateResult(previewContext))
            : true;
        return {
            ok: !!appliedSelection,
            result: previewResult,
            appliedSelection: !!appliedSelection
        };
    }

    async function executePendingSelection(options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const row = Number(opts.row);
        const col = Number(opts.col);
        const playerKey = normalizeSelectionPlayerKey(opts.playerKey);
        const actionType = typeof opts.actionType === 'string' && opts.actionType
            ? opts.actionType
            : 'place';
        const stateRefs = resolveSelectionStateRefs(opts);

        const pendingInfo = getSelectionPending(playerKey, opts);
        const pending = pendingInfo.pending;
        const resolvedPendingType = pendingInfo.pendingType;
        const allowSelectionEntryDuringPlayback = shouldAllowSelectionEntryDuringPlayback(playerKey, resolvedPendingType);
        const busyState = readSelectionBusyState();
        if (
            busyState.processing === true
            || (busyState.cardAnimating === true && allowSelectionEntryDuringPlayback !== true)
        ) {
            return { ok: false, reason: 'busy' };
        }

        if (allowSelectionEntryDuringPlayback === true) {
            clearSelectionEntryDuringPlayback();
        }
        const ownsSelectionCardAnimating = allowSelectionEntryDuringPlayback !== true;
        setSelectionProcessing(true);
        if (ownsSelectionCardAnimating) {
            setSelectionCardAnimating(true);
        }

        let shouldFinalize = false;
        let pendingAction: any = null;
        let playbackEvents = [];
        let executionResult = null;
        let appliedSelection = null;
        let skipFinalizeNetworkPublish = false;
        let shouldClearPendingActionOnExit = false;
        let shouldClearPendingEffectOnExit = false;
        let pendingFailureReason = null;

        function markPendingActionFailure(reason: any) {
            if (!pendingAction || typeof pendingAction !== 'object') return;
            shouldClearPendingActionOnExit = true;
            pendingFailureReason = typeof reason === 'string' && reason ? reason : 'selection_failed';
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
            const normalizedActionPayload = (actionPayload && typeof actionPayload === 'object')
                ? actionPayload
                : {};

            pendingAction = createPendingSelectionAction(playerKey, resolvedPendingType, normalizedActionPayload, {
                cardState: stateRefs.cardState,
                actionType
            });
            const contract = resolvePendingSelectionContract(resolvedPendingType);

            if (shouldUseNetworkPublishOnlyPendingSelection(resolvedPendingType)) {
                const publishResult = await Promise.resolve(publishPendingSelectionSnapshot({
                    playerKey,
                    actionType,
                    action: pendingAction,
                    playbackEvents: []
                }));
                if (!publishResult || publishResult.ok !== true) {
                    markPendingActionFailure('network_publish_failed');
                    const ensureFn = resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                    if (typeof ensureFn === 'function') {
                        ensureFn({ useBlackDelay: true });
                    }
                    return {
                        ok: false,
                        reason: 'network_publish_failed',
                        result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                    };
                }
                return {
                    ok: true,
                    pendingType: resolvedPendingType,
                    action: pendingAction,
                    result: publishResult,
                    appliedSelection: true,
                    playbackEvents: [],
                    publishedByNetwork: true
                };
            }

            if (
                readMatchMode() === 'network'
                && contract
                && contract.kind === 'multi_stage'
                && contract.deferNetworkPublish
                && hasActiveNetworkPublishClient()
            ) {
                const preview = await previewPendingSelectionExecution({
                    playerKey,
                    action: pendingAction,
                    cardState: stateRefs.cardState,
                    gameState: stateRefs.gameState,
                    context: baseContext,
                    validateResult: opts.validateResult
                });
                if (!preview.ok) {
                    markPendingActionFailure('selection_not_applied');
                    emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                        action: pendingAction,
                        result: preview.result
                    }));
                    return {
                        ok: false,
                        reason: 'selection_not_applied',
                        result: preview.result
                    };
                }

                const previewPendingByPlayer = preview.result && preview.result.nextCardState && preview.result.nextCardState.pendingEffectByPlayer;
                const previewPending = previewPendingByPlayer ? previewPendingByPlayer[playerKey] : null;
                const previewPendingType = normalizePendingType(previewPending && previewPending.type);
                const isIntermediateStage = !!previewPendingType && previewPendingType === resolvedPendingType;

                if (!isIntermediateStage) {
                    const publishResult = await Promise.resolve(publishPendingSelectionSnapshot({
                        playerKey,
                        actionType,
                        action: pendingAction,
                        playbackEvents: []
                    }));
                    if (!publishResult || publishResult.ok !== true) {
                        markPendingActionFailure('network_publish_failed');
                        const ensureFn = resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                        if (typeof ensureFn === 'function') {
                            ensureFn({ useBlackDelay: true });
                        }
                        return {
                            ok: false,
                            reason: 'network_publish_failed',
                            result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                        };
                    }

                    const authoritativeState = resolveAuthoritativeSelectionState();
                    if (!shouldRetainPendingSelectionAction(authoritativeState.cardState || stateRefs.cardState, playerKey, resolvedPendingType)) {
                        clearPendingSelectionAction(playerKey);
                    }

                    return {
                        ok: true,
                        pendingType: resolvedPendingType,
                        action: pendingAction,
                        result: preview.result,
                        publishResult,
                        appliedSelection: preview.appliedSelection,
                        playbackEvents: [],
                        publishedByNetwork: true
                    };
                }

                executionResult = preview.result;
                appliedSelection = preview.appliedSelection;
                const appliedState = applySelectionStateResult(executionResult, stateRefs);
                playbackEvents = Array.isArray(executionResult.playbackEvents)
                    ? executionResult.playbackEvents
                    : [];

                const liveContext = Object.assign({}, baseContext, {
                    action: pendingAction,
                    result: executionResult,
                    appliedSelection,
                    cardState: appliedState.cardState,
                    gameState: appliedState.gameState,
                    playbackEvents
                });
                const playbackMeta = (typeof opts.buildPlaybackMeta === 'function')
                    ? opts.buildPlaybackMeta(liveContext)
                    : { cause: resolvedPendingType, target: { row, col } };
                emitSelectionPlaybackEvents(playbackEvents, playbackMeta, appliedState.cardState);

                if (opts.emitStateChanges !== false) {
                    emitSelectionStateChangeSignals(playbackEvents);
                }

                if (typeof opts.afterStateChange === 'function') {
                    await opts.afterStateChange(liveContext);
                }

                skipFinalizeNetworkPublish = true;
                shouldFinalize = true;
                return {
                    ok: true,
                    pendingType: resolvedPendingType,
                    action: pendingAction,
                    result: executionResult,
                    appliedSelection,
                    playbackEvents,
                    intermediatePreviewApplied: true
                };
            }

            if (shouldUsePreviewThenPublishOnlyPendingSelection(resolvedPendingType)) {
                const preview = await previewPendingSelectionExecution({
                    playerKey,
                    action: pendingAction,
                    cardState: stateRefs.cardState,
                    gameState: stateRefs.gameState,
                    context: baseContext,
                    validateResult: opts.validateResult
                });
                if (!preview.ok) {
                    markPendingActionFailure('selection_not_applied');
                    emitSelectionMessage(opts.invalidMessage, Object.assign({}, baseContext, {
                        action: pendingAction,
                        result: preview.result
                    }));
                    return {
                        ok: false,
                        reason: 'selection_not_applied',
                        result: preview.result
                    };
                }

                const publishResult = await Promise.resolve(publishPendingSelectionSnapshot({
                    playerKey,
                    actionType,
                    action: pendingAction,
                    playbackEvents: []
                }));
                if (!publishResult || publishResult.ok !== true) {
                    markPendingActionFailure('network_publish_failed');
                    return {
                        ok: false,
                        reason: 'network_publish_failed',
                        result: publishResult || { ok: false, reason: 'NETWORK_PUBLISH_FAILED' }
                    };
                }

                const authoritativeState = resolveAuthoritativeSelectionState();
                if (!shouldRetainPendingSelectionAction(authoritativeState.cardState || stateRefs.cardState, playerKey, resolvedPendingType)) {
                    clearPendingSelectionAction(playerKey);
                }

                return {
                    ok: true,
                    pendingType: resolvedPendingType,
                    action: pendingAction,
                    result: preview.result,
                    publishResult,
                    appliedSelection: preview.appliedSelection,
                    playbackEvents: [],
                    publishedByNetwork: true
                };
            }

            const adapter = resolveTurnPipelineUIAdapter();
            const pipeline = resolveTurnPipeline();
            executionResult = (adapter && pipeline && typeof adapter.runTurnWithAdapter === 'function')
                ? adapter.runTurnWithAdapter(stateRefs.cardState, stateRefs.gameState, playerKey, pendingAction, pipeline)
                : null;

            if (!executionResult || executionResult.ok === false) {
                markPendingActionFailure('selection_rejected');
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
                markPendingActionFailure('selection_not_applied');
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
            const suppressLocalPlayback = shouldSuppressLocalPlaybackForDeferredNetworkSelection(resolvedPendingType);
            if (suppressLocalPlayback) {
                playbackEvents = [];
            }

            const liveContext = Object.assign({}, baseContext, {
                action: pendingAction,
                result: executionResult,
                appliedSelection,
                cardState: appliedState.cardState,
                gameState: appliedState.gameState,
                playbackEvents
            });

            if (!suppressLocalPlayback) {
                const playbackMeta = (typeof opts.buildPlaybackMeta === 'function')
                    ? opts.buildPlaybackMeta(liveContext)
                    : { cause: resolvedPendingType, target: { row, col } };
                emitSelectionPlaybackEvents(playbackEvents, playbackMeta, appliedState.cardState);
            }

            if (opts.emitStateChanges !== false) {
                emitSelectionStateChangeSignals(playbackEvents);
            }

            if (typeof opts.afterStateChange === 'function') {
                await opts.afterStateChange(liveContext);
            }

            shouldFinalize = true;
            return {
                ok: true,
                pendingType: resolvedPendingType,
                action: pendingAction,
                result: executionResult,
                appliedSelection,
                playbackEvents
            };
        } finally {
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
                        skipNetworkPublish: skipFinalizeNetworkPublish,
                        clearCardAnimatingOnFinish: ownsSelectionCardAnimating
                    }, (opts.finalizeOptions && typeof opts.finalizeOptions === 'object') ? opts.finalizeOptions : {});
                    await finalizePendingSelectionFlow(finalizeOptions);
                } catch (e) {
                    setSelectionProcessing(false);
                    if (ownsSelectionCardAnimating) {
                        setSelectionCardAnimating(false);
                    }
                    const ensureFn = resolveRootFunction('ensureCurrentPlayerCanActOrPass');
                    if (typeof ensureFn === 'function') {
                        try { ensureFn({ useBlackDelay: true }); } catch (ignore) { /* ignore */ }
                    }
                }
            } else {
                if (shouldClearPendingActionOnExit) {
                    clearPendingSelectionFailureState(stateRefs.cardState, playerKey, {
                        clearPendingEffect: shouldClearPendingEffectOnExit,
                        failureReason: pendingFailureReason
                    });
                    pendingAction = null;
                }
                setSelectionProcessing(false);
                if (ownsSelectionCardAnimating) {
                    setSelectionCardAnimating(false);
                }
            }
        }
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
