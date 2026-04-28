// @ts-nocheck
import type { CardState, GameState, PlayerKey } from '../../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const root = (typeof window !== 'undefined' ? window : globalThis);

const DEFAULT_SERVER_URL = 'http://127.0.0.1:8787';
    const SERVER_URL_STORAGE_KEY = 'network_match_server_url';
    const ROOM_ID_LENGTH = 3;
    const ROOM_ID_RE = /^[A-Z0-9]{3}$/;
    const PLAYER_NAME_MAX = 7;
    const CHAT_MAX_LENGTH = 20;
    const CHAT_HISTORY_LIMIT = 40;
    const TURN_TIMER_DEFAULT_LIMIT = 120;
    const RECONNECT_BASE_DELAY_MS = 500;
    const RECONNECT_MIN_DELAY_MS = 250;
    const RECONNECT_MAX_DELAY_MS = 30000;
    const RECONNECT_MAX_EXPONENT = 7;
    const REQUEST_TIMEOUT_MS = 10000;
    const STREAM_WATCHDOG_INTERVAL_MS = 5000;
    const STREAM_STALE_TIMEOUT_MS = 25000;
    const RECONNECT_STREAM_RECOVERY_WAIT_MS = 350;
    const PUBLISH_RETRY_MAX_ATTEMPTS = 3;
    const PUBLISH_RETRY_BASE_DELAY_MS = 400;
    const PUBLISH_RETRY_MAX_DELAY_MS = 4000;
    const PUBLISH_TRACKER_MAX_OPERATIONS = 32;
    const PUBLISH_TRACKER_RETENTION_MS = 60000;
    const NETWORK_TELEMETRY_RECENT_LIMIT = 40;
    const PlaybackStateModule = (typeof require === 'function')
        ? (() => {
            try { return require('./playback-state-manager'); } catch (e) { return root.PlaybackStateManager || null; }
        })()
        : (root.PlaybackStateManager || null);
    const PendingCoordinatorModule = (typeof require === 'function')
        ? (() => {
            try { return require('../game/turn/pending-coordinator'); } catch (e) { return root.PendingCoordinator || null; }
        })()
        : (root.PendingCoordinator || null);
    const PendingStateManagerModule = (typeof require === 'function')
        ? (() => {
            try { return require('../game/logic/cards-internal/pending-state-manager'); } catch (e) { return root.CardPendingStateManager || null; }
        })()
        : (root.CardPendingStateManager || null);
    const ResultOverlayModule = (typeof require === 'function')
        ? (() => {
            try { return require('./result-overlay'); } catch (e) { return root || null; }
        })()
        : (root || null);

    function resolvePendingSelectionContract(cardType) {
        if (!cardType) return null;
        try {
            if (PendingCoordinatorModule && typeof PendingCoordinatorModule.getPendingSelectionContract === 'function') {
                const contract = PendingCoordinatorModule.getPendingSelectionContract(cardType);
                if (contract && typeof contract === 'object') return contract;
            }
        } catch (e) { /* ignore */ }
        try {
            if (PendingStateManagerModule && typeof PendingStateManagerModule.resolvePendingSelectionContract === 'function') {
                const contract = PendingStateManagerModule.resolvePendingSelectionContract(cardType);
                if (contract && typeof contract === 'object') return contract;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function shouldDeferNetworkPublishForPendingType(cardType) {
        if (!cardType) return false;
        try {
            if (PendingCoordinatorModule && typeof PendingCoordinatorModule.shouldDeferNetworkPublishForPendingType === 'function') {
                return PendingCoordinatorModule.shouldDeferNetworkPublishForPendingType(cardType) === true;
            }
        } catch (e) { /* ignore */ }
        const contract = resolvePendingSelectionContract(cardType);
        return !!(contract && contract.deferNetworkPublish === true);
    }

    function syncPendingSelectionActionCache(pendingEffectByPlayer) {
        const syncOptions = {};
        try {
            if (
                PlaybackStateModule
                && typeof PlaybackStateModule.getProcessing === 'function'
                && PlaybackStateModule.getProcessing() === true
                && state
                && state.seatKey
            ) {
                syncOptions.preservePlayerKeys = [normalizePlayerKey(state.seatKey)];
            }
        } catch (e) { /* ignore */ }
        try {
            if (PendingCoordinatorModule && typeof PendingCoordinatorModule.syncPendingSelectionActionCache === 'function') {
                return PendingCoordinatorModule.syncPendingSelectionActionCache(
                    pendingEffectByPlayer,
                    syncOptions.preservePlayerKeys ? syncOptions : undefined
                );
            }
        } catch (e) { /* ignore */ }
        return {
            cleared: [],
            retained: []
        };
    }

    function createInitialResultPresentationState() {
        if (ResultOverlayModule && typeof ResultOverlayModule.createEmptyResultPresentationState === 'function') {
            return ResultOverlayModule.createEmptyResultPresentationState();
        }
        return {
            lastResultVersionShown: null,
            resultShownForUnversioned: false
        };
    }

    function resetNetworkResultPresentationState(resultState) {
        if (!resultState || typeof resultState !== 'object') {
            return createInitialResultPresentationState();
        }
        if (ResultOverlayModule && typeof ResultOverlayModule.resetResultPresentationState === 'function') {
            return ResultOverlayModule.resetResultPresentationState(resultState);
        }
        resultState.lastResultVersionShown = null;
        resultState.resultShownForUnversioned = false;
        return resultState;
    }

    function getPlaybackActive() {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
                return PlaybackStateModule.getPlaybackActive() === true;
            }
        } catch (e) { /* ignore */ }
        return false;
    }

    function clearBoardUpdateContext() {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.clearBoardUpdateContext === 'function') {
                PlaybackStateModule.clearBoardUpdateContext();
            }
        } catch (e) { /* ignore */ }
    }

    function clearPlaybackStateForLeave() {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.abortPlayback === 'function') {
                PlaybackStateModule.abortPlayback();
                return;
            }
        } catch (e) { /* ignore */ }
        clearBoardUpdateContext();
    }

    function armSuppressDiffBoardUpdateContext(reason) {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.armBoardUpdateContext === 'function') {
                PlaybackStateModule.armBoardUpdateContext({
                    suppressFallbackFlip: true,
                    source: 'network-client',
                    reason: reason || 'self_snapshot_sync'
                });
            }
        } catch (e) { /* ignore */ }
    }

    function shouldClearStaleBoardUpdateContext(options) {
        const opts = options || {};
        if (opts.force !== true) return false;
        if (opts.boardUpdateContext && typeof opts.boardUpdateContext === 'object') return false;
        if (Array.isArray(opts.playbackEvents) && opts.playbackEvents.length > 0) return false;
        if (Array.isArray(opts.shadowPlaybackEvents) && opts.shadowPlaybackEvents.length > 0) return false;
        return getPlaybackActive() !== true;
    }

    function normalizeRoomId(value) {
        const roomId = String(value || '').trim().toUpperCase();
        return roomId;
    }

    function normalizeServerUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) {
            return raw.replace(/\/+$/, '');
        }
        try {
            const protocol = (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) ? location.protocol : 'http:';
            return `${protocol}//${raw}`.replace(/\/+$/, '');
        } catch (e) {
            return `http://${raw}`.replace(/\/+$/, '');
        }
    }

    function resolveTimerHost() {
        try {
            if (root && typeof root.setTimeout === 'function' && typeof root.clearTimeout === 'function') {
                return root;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && typeof globalThis.setTimeout === 'function' && typeof globalThis.clearTimeout === 'function') {
                return globalThis;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function scheduleTimeout(callback, ms) {
        const host = resolveTimerHost();
        if (!host || typeof host.setTimeout !== 'function') return 0;
        return host.setTimeout(callback, ms);
    }

    function clearScheduledTimeout(handle) {
        if (!handle) return;
        const host = resolveTimerHost();
        if (!host || typeof host.clearTimeout !== 'function') return;
        try { host.clearTimeout(handle); } catch (e) { /* ignore */ }
    }

    function deriveSameOriginServerUrl() {
        try {
            if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && location.origin) {
                return withTrailingSlashRemoved(location.origin);
            }
        } catch (e) { /* ignore */ }
        return DEFAULT_SERVER_URL;
    }

    function deriveInitialServerUrl() {
        try {
            if (typeof location !== 'undefined' && location.search) {
                const params = new URLSearchParams(location.search);
                const byQuery = normalizeServerUrl(params.get('matchServer') || '');
                if (byQuery) return byQuery;
            }
        } catch (e) { /* ignore */ }

        try {
            const byWindow = normalizeServerUrl(root.MATCH_SERVER_URL || '');
            if (byWindow) return byWindow;
        } catch (e) { /* ignore */ }

        try {
            if (typeof localStorage !== 'undefined') {
                const byStorage = normalizeServerUrl(localStorage.getItem(SERVER_URL_STORAGE_KEY) || '');
                if (byStorage) return byStorage;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && location.hostname) {
                return deriveSameOriginServerUrl();
            }
        } catch (e) { /* ignore */ }

        return deriveSameOriginServerUrl();
    }

    const initialResultPresentationState = createInitialResultPresentationState();
    const state = {
        active: false,
        roomId: '',
        seatKey: 'black',
        seatToken: '',
        roomSeats: { black: false, white: false },
        seatNames: { black: '', white: '' },
        seatHandSkins: { black: '', white: '' },
        roomDeck: null,
        roomBoardConfig: null,
        networkDebugEnabled: false,
        serverUrl: deriveInitialServerUrl(),
        stateVersion: null,
        eventSource: null,
        lastStreamActivityAt: 0,
        lastStreamEventId: '',
        streamWatchdogTimerId: 0,
        statusWriter: null,
        roomStateListener: null,
        chatListener: null,
        chatHistory: [],
        publishChain: Promise.resolve(),
        publishTracker: {
            nextSequence: 0,
            operations: []
        },
        lastResultVersionShown: initialResultPresentationState.lastResultVersionShown,
        resultShownForUnversioned: initialResultPresentationState.resultShownForUnversioned,
        reconnectTimerId: null,
        reconnectAttempt: 0,
        turnTimer: {
            limitSeconds: TURN_TIMER_DEFAULT_LIMIT,
            active: false,
            turnSeatKey: 'black',
            turnStartedAt: null,
            turnDeadlineAt: null
        },
        turnTimerListener: null,
        turnTimerTickHandle: 0,
        turnTimerSyncRequestedDeadline: null,
        serverTimeOffsetMs: 0,
        heartbeatResyncInFlight: false,
        reconnectRecoveryTimerId: null,
        reconnectRecoveryPending: false,
        appliedStateVersion: null,
        pendingForceSyncPlaybackVersion: null,
        pendingForceSyncPlaybackSource: '',
        pendingForceSyncPlaybackSignature: '',
        authoritativeMatchState: {
            gameState: null,
            cardState: null,
            stateVersion: null,
            authority: null,
            projectedForSeat: null,
            turnStartReconciled: false,
            projectedSnapshotHash: null,
            lastAppliedProjectedSnapshotHash: null
        },
        localPresentationState: {
            preservedQueues: null,
            lastPlaybackEvents: [],
            busy: false,
            playbackSuppressed: false
        },
        networkTelemetry: {
            counts: {},
            recentEvents: []
        }
    };

    let networkCommentaryModule = null;
    let networkActionSchemaModule = null;
    let networkPublishRequestModule = null;
    let networkSnapshotModule = null;
    let networkSessionSeatModule = null;
    let networkSessionLifecycleModule = null;
    let networkCommandPayloadModule = null;
    let networkActionBridgeModule = null;
    let networkApplyCoordinatorModule = null;
    let networkReconnectControllerModule = null;
    let networkPublishTrackerModule = null;
    let cardLogicModule = null;
    let networkCommentaryController = null;
    let networkSnapshotController = null;
    let networkSessionSeatController = null;
    let networkSessionLifecycleController = null;
    let networkActionBridgeController = null;
    let networkReconnectController = null;
    let networkPublishTrackerController = null;
    let ownerHelpers = null;

    if (typeof require === 'function') {
        try { networkCommentaryModule = require('./network/commentary'); } catch (e) { /* ignore */ }
        try { networkActionSchemaModule = require('../shared/network-action-schema'); } catch (e) { /* ignore */ }
        try { networkPublishRequestModule = require('./network/publish-request'); } catch (e) { /* ignore */ }
        try { networkSnapshotModule = require('./network/snapshot'); } catch (e) { /* ignore */ }
        try { networkSessionSeatModule = require('./network/session-seat'); } catch (e) { /* ignore */ }
        try { networkSessionLifecycleModule = require('./network/session-lifecycle'); } catch (e) { /* ignore */ }
        try { networkCommandPayloadModule = require('./network/command-payload'); } catch (e) { /* ignore */ }
        try { networkActionBridgeModule = require('./network/action-bridge'); } catch (e) { /* ignore */ }
        try { networkApplyCoordinatorModule = require('./network/apply-coordinator'); } catch (e) { /* ignore */ }
        try { networkReconnectControllerModule = require('./network/reconnect-controller'); } catch (e) { /* ignore */ }
        try { networkPublishTrackerModule = require('./network/publish-tracker'); } catch (e) { /* ignore */ }
    }

    function resolveNetworkCommentaryModule() {
        if (networkCommentaryModule) return networkCommentaryModule;

        try {
            if (root && root.NetworkCommentaryModule) {
                networkCommentaryModule = root.NetworkCommentaryModule;
                return networkCommentaryModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkCommentaryModule) {
                networkCommentaryModule = globalThis.NetworkCommentaryModule;
                return networkCommentaryModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkActionSchemaModule() {
        if (networkActionSchemaModule) return networkActionSchemaModule;

        try {
            if (root && root.NetworkActionSchema) {
                networkActionSchemaModule = root.NetworkActionSchema;
                return networkActionSchemaModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkActionSchema) {
                networkActionSchemaModule = globalThis.NetworkActionSchema;
                return networkActionSchemaModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkSnapshotModule() {
        if (networkSnapshotModule) return networkSnapshotModule;

        try {
            if (root && root.NetworkSnapshotModule) {
                networkSnapshotModule = root.NetworkSnapshotModule;
                return networkSnapshotModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkSnapshotModule) {
                networkSnapshotModule = globalThis.NetworkSnapshotModule;
                return networkSnapshotModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkSessionSeatModule() {
        if (networkSessionSeatModule) return networkSessionSeatModule;

        try {
            if (root && root.NetworkSessionSeatModule) {
                networkSessionSeatModule = root.NetworkSessionSeatModule;
                return networkSessionSeatModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkSessionSeatModule) {
                networkSessionSeatModule = globalThis.NetworkSessionSeatModule;
                return networkSessionSeatModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkSessionLifecycleModule() {
        if (networkSessionLifecycleModule) return networkSessionLifecycleModule;

        try {
            if (root && root.NetworkSessionLifecycleModule) {
                networkSessionLifecycleModule = root.NetworkSessionLifecycleModule;
                return networkSessionLifecycleModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkSessionLifecycleModule) {
                networkSessionLifecycleModule = globalThis.NetworkSessionLifecycleModule;
                return networkSessionLifecycleModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkCommandPayloadModule() {
        if (networkCommandPayloadModule) return networkCommandPayloadModule;

        try {
            if (root && root.NetworkCommandPayloadModule) {
                networkCommandPayloadModule = root.NetworkCommandPayloadModule;
                return networkCommandPayloadModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkCommandPayloadModule) {
                networkCommandPayloadModule = globalThis.NetworkCommandPayloadModule;
                return networkCommandPayloadModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkActionBridgeModule() {
        if (networkActionBridgeModule) return networkActionBridgeModule;

        try {
            if (root && root.NetworkActionBridgeModule) {
                networkActionBridgeModule = root.NetworkActionBridgeModule;
                return networkActionBridgeModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkActionBridgeModule) {
                networkActionBridgeModule = globalThis.NetworkActionBridgeModule;
                return networkActionBridgeModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkApplyCoordinatorModule() {
        if (networkApplyCoordinatorModule) return networkApplyCoordinatorModule;

        try {
            if (root && root.NetworkApplyCoordinatorModule) {
                networkApplyCoordinatorModule = root.NetworkApplyCoordinatorModule;
                return networkApplyCoordinatorModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkApplyCoordinatorModule) {
                networkApplyCoordinatorModule = globalThis.NetworkApplyCoordinatorModule;
                return networkApplyCoordinatorModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkReconnectControllerModule() {
        if (networkReconnectControllerModule) return networkReconnectControllerModule;

        try {
            if (root && root.NetworkReconnectControllerModule) {
                networkReconnectControllerModule = root.NetworkReconnectControllerModule;
                return networkReconnectControllerModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkReconnectControllerModule) {
                networkReconnectControllerModule = globalThis.NetworkReconnectControllerModule;
                return networkReconnectControllerModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkPublishTrackerModule() {
        if (networkPublishTrackerModule) return networkPublishTrackerModule;

        try {
            if (root && root.NetworkPublishTrackerModule) {
                networkPublishTrackerModule = root.NetworkPublishTrackerModule;
                return networkPublishTrackerModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkPublishTrackerModule) {
                networkPublishTrackerModule = globalThis.NetworkPublishTrackerModule;
                return networkPublishTrackerModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveCardLogicModule() {
        if (cardLogicModule) return cardLogicModule;

        try {
            if (typeof require === 'function') {
                cardLogicModule = require('../game/logic/cards');
                if (cardLogicModule) return cardLogicModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (root && root.CardLogic) {
                cardLogicModule = root.CardLogic;
                return cardLogicModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.CardLogic) {
                cardLogicModule = globalThis.CardLogic;
                return cardLogicModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function resolveNetworkPublishRequestModule() {
        if (networkPublishRequestModule) return networkPublishRequestModule;

        try {
            if (root && root.NetworkPublishRequestModule) {
                networkPublishRequestModule = root.NetworkPublishRequestModule;
                return networkPublishRequestModule;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.NetworkPublishRequestModule) {
                networkPublishRequestModule = globalThis.NetworkPublishRequestModule;
                return networkPublishRequestModule;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function getNetworkCommentaryController() {
        if (networkCommentaryController) return networkCommentaryController;
        const mod = resolveNetworkCommentaryModule();
        if (!mod || typeof mod.createNetworkCommentaryController !== 'function') return null;
        networkCommentaryController = mod.createNetworkCommentaryController({
            root,
            getState: () => state,
            normalizePlayerKey
        });
        return networkCommentaryController;
    }

    function getNetworkSnapshotController() {
        if (networkSnapshotController) return networkSnapshotController;
        const mod = resolveNetworkSnapshotModule();
        if (!mod || typeof mod.createNetworkSnapshotController !== 'function') return null;
        networkSnapshotController = mod.createNetworkSnapshotController({
            root,
            getState: () => state,
            onTelemetry: (type, details) => recordNetworkTelemetry(type, details),
            syncPendingSelectionActionCache
        });
        return networkSnapshotController;
    }

    function getNetworkSessionSeatController() {
        if (networkSessionSeatController) return networkSessionSeatController;
        const mod = resolveNetworkSessionSeatModule();
        if (!mod || typeof mod.createNetworkSessionSeatController !== 'function') return null;
        networkSessionSeatController = mod.createNetworkSessionSeatController({
            root,
            getState: () => state,
            isActive,
            normalizePlayerKey,
            normalizeRoomId,
            playerNameMax: PLAYER_NAME_MAX,
            prepareSessionActivation: (payload) => {
                state.lastStreamEventId = '';
                state.appliedStateVersion = getSnapshotStateVersion(payload && payload.snapshot);
                clearPendingForceSyncPlaybackRecovery();
            },
            onResetSessionState: () => {
                state.appliedStateVersion = null;
                state.lastStreamEventId = '';
                state.authoritativeMatchState.gameState = null;
                state.authoritativeMatchState.cardState = null;
                state.authoritativeMatchState.stateVersion = null;
                state.authoritativeMatchState.authority = null;
                state.authoritativeMatchState.projectedForSeat = null;
                state.authoritativeMatchState.turnStartReconciled = false;
                state.authoritativeMatchState.projectedSnapshotHash = null;
                state.authoritativeMatchState.lastAppliedProjectedSnapshotHash = null;
                resetPublishTracker();
                clearPendingForceSyncPlaybackRecovery();
            },
            updateTurnTimerFromPayload: (payload) => updateTurnTimerFromPayload(payload),
            ensureActionBridge: () => ensureActionBridge(),
            applySnapshot: (snapshot, options) => applySnapshot(snapshot, options),
            resetResultPresentationState: (resultState) => resetNetworkResultPresentationState(resultState)
        });
        return networkSessionSeatController;
    }

    function getNetworkSessionLifecycleController() {
        if (networkSessionLifecycleController) return networkSessionLifecycleController;
        const mod = resolveNetworkSessionLifecycleModule();
        if (!mod || typeof mod.createNetworkSessionLifecycleController !== 'function') return null;
        networkSessionLifecycleController = mod.createNetworkSessionLifecycleController({
            getState: () => state,
            setServerUrl,
            normalizePlayerName,
            normalizeRoomId,
            roomIdPattern: ROOM_ID_RE,
            roomIdLength: ROOM_ID_LENGTH,
            playerNameMax: PLAYER_NAME_MAX,
            cloneData: cloneDataForCommandPayload,
            readSelectedHandSkinId,
            requestJson,
            isMatchApiMissing,
            emitStatus,
            readSeatClaim,
            clearSeatClaim,
            shouldRetryJoinWithoutStoredClaim,
            activateSessionFromResponse,
            resetNetworkTelemetry,
            openStream,
            getKnownProjectedSnapshotHash,
            applyPayloadSessionState,
            shouldSkipForceSyncSnapshot,
            applySnapshotThroughCoordinator,
            rememberPendingForceSyncPlaybackRecovery,
            recordNetworkTelemetry,
            getSnapshotStateVersion,
            clearPlaybackStateForLeave,
            clearPendingForceSyncPlaybackRecovery,
            resetSessionState,
            resetTurnTimerState,
            closeStream,
            teardownActionBridge
        });
        return networkSessionLifecycleController;
    }

    function getNetworkActionBridgeController() {
        if (networkActionBridgeController) return networkActionBridgeController;
        const mod = resolveNetworkActionBridgeModule();
        if (!mod || typeof mod.createNetworkActionBridge !== 'function') return null;
        networkActionBridgeController = mod.createNetworkActionBridge({
            root,
            isActive: () => state.active,
            normalizePlayerKey,
            cardLogicModule: resolveCardLogicModule(),
            queueCommandPublish: (playerKey, action, options) => queueCommandPublish(playerKey, action, options),
            shouldDeferNetworkPublishForPendingType
        });
        return networkActionBridgeController;
    }

    function getNetworkReconnectController() {
        if (networkReconnectController) return networkReconnectController;
        const mod = resolveNetworkReconnectControllerModule();
        if (!mod || typeof mod.createNetworkReconnectController !== 'function') return null;
        networkReconnectController = mod.createNetworkReconnectController({
            getState: () => state,
            isActive,
            scheduleTimeout,
            clearScheduledTimeout,
            emitStatus,
            openStream: (options) => openStream(options),
            syncLatestStateWithRetry: (options) => syncLatestStateWithRetry(options),
            recordNetworkTelemetry: (type, details) => recordNetworkTelemetry(type, details),
            getAppliedStateVersion,
            computeRetryDelayMs,
            reconnectRecoveryWaitMs: RECONNECT_STREAM_RECOVERY_WAIT_MS,
            streamWatchdogIntervalMs: STREAM_WATCHDOG_INTERVAL_MS,
            streamStaleTimeoutMs: STREAM_STALE_TIMEOUT_MS,
            reconnectBaseDelayMs: RECONNECT_BASE_DELAY_MS,
            reconnectMaxDelayMs: RECONNECT_MAX_DELAY_MS
        });
        return networkReconnectController;
    }

    function getNetworkPublishTrackerController() {
        if (networkPublishTrackerController) return networkPublishTrackerController;
        const mod = resolveNetworkPublishTrackerModule();
        if (!mod || typeof mod.createNetworkPublishTracker !== 'function') return null;
        networkPublishTrackerController = mod.createNetworkPublishTracker({
            getState: () => state,
            cloneData: cloneDataForCommandPayload,
            getSnapshotStateVersion,
            maxOperations: PUBLISH_TRACKER_MAX_OPERATIONS,
            retentionMs: PUBLISH_TRACKER_RETENTION_MS
        });
        return networkPublishTrackerController;
    }

    function invokeControllerMethod(resolveController, methodName, argsLike, fallback) {
        const controller = (typeof resolveController === 'function') ? resolveController() : null;
        if (controller && typeof controller[methodName] === 'function') {
            return controller[methodName].apply(controller, argsLike || []);
        }
        if (typeof fallback === 'function') {
            return fallback.apply(null, argsLike || []);
        }
        return fallback;
    }

    function resolveHandSkinUiModule() {
        try {
            if (root && root.HandSkinUiModule) {
                return root.HandSkinUiModule;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof require === 'function') {
                return require('./handlers/hand-skin.js');
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.HandSkinUiModule) {
                return globalThis.HandSkinUiModule;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveOwnerHelpers() {
        if (ownerHelpers) return ownerHelpers;

        try {
            if (root && root.OwnerHelpers) {
                ownerHelpers = root.OwnerHelpers;
                return ownerHelpers;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof require === 'function') {
                ownerHelpers = require('../utils/owner-helpers');
                if (ownerHelpers) return ownerHelpers;
            }
        } catch (e) { /* ignore */ }

        try {
            if (typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) {
                ownerHelpers = globalThis.OwnerHelpers;
                return ownerHelpers;
            }
        } catch (e) { /* ignore */ }

        return null;
    }

    function normalizePlayerKey(value) {
        try {
            const schema = resolveNetworkActionSchemaModule();
            if (schema && typeof schema.normalizePlayerKey === 'function') {
                return schema.normalizePlayerKey(value, 'black');
            }
        } catch (e) { /* ignore */ }

        try {
            const helpers = resolveOwnerHelpers();
            if (helpers && typeof helpers.normalizePlayerKey === 'function') {
                return helpers.normalizePlayerKey(value, 'black');
            }
        } catch (e) { /* ignore */ }

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();

        if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
        if (value === 1 || normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        return 'black';
    }

    function cloneDataForCommandPayload(value) {
        try {
            if (typeof globalThis !== 'undefined' && typeof globalThis.structuredClone === 'function') {
                return globalThis.structuredClone(value);
            }
        } catch (e) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function createNetworkTelemetryState() {
        return {
            counts: {},
            recentEvents: []
        };
    }

    function resetNetworkTelemetry() {
        state.networkTelemetry = createNetworkTelemetryState();
    }

    function recordNetworkTelemetry(type, details) {
        const eventType = String(type || '').trim();
        if (!eventType) return;

        const telemetry = (state.networkTelemetry && typeof state.networkTelemetry === 'object')
            ? state.networkTelemetry
            : createNetworkTelemetryState();
        state.networkTelemetry = telemetry;
        telemetry.counts = (telemetry.counts && typeof telemetry.counts === 'object')
            ? telemetry.counts
            : {};
        telemetry.recentEvents = Array.isArray(telemetry.recentEvents)
            ? telemetry.recentEvents
            : [];

        telemetry.counts[eventType] = Number.isFinite(Number(telemetry.counts[eventType]))
            ? Number(telemetry.counts[eventType]) + 1
            : 1;

        let safeDetails = null;
        if (details && typeof details === 'object') {
            try {
                safeDetails = cloneDataForCommandPayload(details);
            } catch (e) {
                safeDetails = { cloneFailed: true };
            }
        }

        telemetry.recentEvents.push({
            type: eventType,
            at: Date.now(),
            details: safeDetails
        });
        if (telemetry.recentEvents.length > NETWORK_TELEMETRY_RECENT_LIMIT) {
            telemetry.recentEvents.splice(0, telemetry.recentEvents.length - NETWORK_TELEMETRY_RECENT_LIMIT);
        }

        if (state.networkDebugEnabled === true) {
            let suffix = '';
            try {
                const encoded = safeDetails ? JSON.stringify(safeDetails) : '';
                if (encoded) suffix = ` ${encoded}`;
            } catch (e) { /* ignore */ }
            emitEffectLog(`[network-debug] ${eventType}${suffix}`);
        }
    }

    function getNetworkTelemetry() {
        try {
            return cloneDataForCommandPayload(state.networkTelemetry || createNetworkTelemetryState());
        } catch (e) {
            return createNetworkTelemetryState();
        }
    }

    function cloneReadableNetworkStateValue(value, fallbackValue) {
        if (typeof value === 'undefined') return fallbackValue;
        try {
            return cloneDataForCommandPayload(value);
        } catch (e) {
            return fallbackValue;
        }
    }

    function cloneTrackedPublishRequestMeta(requestMeta) {
        if (!requestMeta || typeof requestMeta !== 'object') return null;
        return {
            actionType: requestMeta.actionType || null,
            actor: requestMeta.actor || null,
            params: (requestMeta.params && typeof requestMeta.params === 'object')
                ? cloneReadableNetworkStateValue(requestMeta.params, null)
                : null,
            playbackEvents: Array.isArray(requestMeta.playbackEvents)
                ? cloneReadableNetworkStateValue(requestMeta.playbackEvents, [])
                : [],
            usedSnapshotFallback: requestMeta.usedSnapshotFallback === true,
            snapshotProjectedHash: (typeof requestMeta.snapshotProjectedHash === 'string' && requestMeta.snapshotProjectedHash)
                ? requestMeta.snapshotProjectedHash
                : null
        };
    }

    function cloneTrackedPublishEntry(entry) {
        if (!entry || typeof entry !== 'object' || !entry.operationId) return null;
        return {
            operationId: String(entry.operationId || ''),
            sequence: Number.isFinite(Number(entry.sequence)) ? Number(entry.sequence) : null,
            phase: String(entry.phase || ''),
            responseSettled: entry.responseSettled === true,
            responseVersion: Number.isFinite(Number(entry.responseVersion)) ? Number(entry.responseVersion) : null,
            selfSnapshotReceived: entry.selfSnapshotReceived === true,
            selfSnapshotVersion: Number.isFinite(Number(entry.selfSnapshotVersion)) ? Number(entry.selfSnapshotVersion) : null,
            appliedSource: entry && typeof entry.appliedSource === 'string' ? entry.appliedSource : '',
            appliedVersion: Number.isFinite(Number(entry.appliedVersion)) ? Number(entry.appliedVersion) : null,
            completedAt: Number.isFinite(Number(entry.completedAt)) ? Number(entry.completedAt) : null,
            requestMeta: cloneTrackedPublishRequestMeta(entry.requestMeta)
        };
    }

    function getState() {
        const tracker = ensurePublishTracker();
        const operations = Array.isArray(tracker.operations)
            ? tracker.operations.map((entry) => cloneTrackedPublishEntry(entry)).filter((entry) => !!entry)
            : [];
        return {
            active: state.active === true,
            roomId: String(state.roomId || ''),
            seatKey: normalizePlayerKey(state.seatKey),
            roomSeats: cloneReadableNetworkStateValue(state.roomSeats || { black: false, white: false }, { black: false, white: false }),
            seatNames: cloneReadableNetworkStateValue(state.seatNames || { black: '', white: '' }, { black: '', white: '' }),
            seatHandSkins: cloneReadableNetworkStateValue(state.seatHandSkins || { black: '', white: '' }, { black: '', white: '' }),
            roomDeck: cloneReadableNetworkStateValue(state.roomDeck, null),
            roomBoardConfig: cloneReadableNetworkStateValue(state.roomBoardConfig, null),
            networkDebugEnabled: state.networkDebugEnabled === true,
            stateVersion: Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null,
            publishTracker: {
                nextSequence: Number.isFinite(Number(tracker.nextSequence)) ? Number(tracker.nextSequence) : 0,
                operations
            }
        };
    }

    function getSnapshotStateVersion(snapshot) {
        const meta = getSnapshotMeta(snapshot);
        if (meta && meta.version !== null) return meta.version;
        return Number.isFinite(Number(snapshot && snapshot.stateVersion))
            ? Number(snapshot.stateVersion)
            : null;
    }

    function getSnapshotMeta(snapshot) {
        if (!snapshot || typeof snapshot !== 'object' || !snapshot._meta || typeof snapshot._meta !== 'object') {
            return null;
        }
        const meta = snapshot._meta;
        return {
            authority: String(meta.authority || '').trim().toLowerCase(),
            version: Number.isFinite(Number(meta.version)) ? Number(meta.version) : null,
            projectedForSeat: normalizePlayerKey(meta.projectedForSeat),
            turnStartReconciled: meta.turnStartReconciled !== false,
            projectedSnapshotHash: (typeof meta.projectedSnapshotHash === 'string' && meta.projectedSnapshotHash)
                ? meta.projectedSnapshotHash
                : null
        };
    }

    function getAppliedStateVersion() {
        if (Number.isFinite(Number(state.appliedStateVersion))) {
            return Number(state.appliedStateVersion);
        }
        return Number.isFinite(Number(state.stateVersion))
            ? Number(state.stateVersion)
            : null;
    }

    function getCurrentPublishTurnIndex() {
        const authoritativeCardState = state.authoritativeMatchState && state.authoritativeMatchState.cardState
            && typeof state.authoritativeMatchState.cardState === 'object'
            ? state.authoritativeMatchState.cardState
            : null;
        const liveCardState = root && root.cardState && typeof root.cardState === 'object'
            ? root.cardState
            : ((typeof globalThis !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object')
                ? globalThis.cardState
                : null);
        const authoritativeTurnIndex = authoritativeCardState && Number.isFinite(Number(authoritativeCardState.turnIndex))
            ? Math.trunc(Number(authoritativeCardState.turnIndex))
            : null;
        const liveTurnIndex = liveCardState && Number.isFinite(Number(liveCardState.turnIndex))
            ? Math.trunc(Number(liveCardState.turnIndex))
            : null;
        if (authoritativeTurnIndex !== null && liveTurnIndex !== null) {
            return Math.max(authoritativeTurnIndex, liveTurnIndex);
        }
        if (authoritativeTurnIndex !== null) {
            return authoritativeTurnIndex;
        }
        if (liveTurnIndex !== null) {
            return liveTurnIndex;
        }
        const liveGameState = root && root.gameState && typeof root.gameState === 'object'
            ? root.gameState
            : ((typeof globalThis !== 'undefined' && globalThis.gameState && typeof globalThis.gameState === 'object')
                ? globalThis.gameState
                : null);
        if (liveGameState && Number.isFinite(Number(liveGameState.turnNumber))) {
            return Math.trunc(Number(liveGameState.turnNumber));
        }
        return null;
    }

    function computeForceSyncPlaybackRecoverySignature(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return '';
        if (!snapshot.gameState || typeof snapshot.gameState !== 'object') return '';
        if (!snapshot.cardState || typeof snapshot.cardState !== 'object') return '';
        try {
            const signatureCardState = cloneDataForCommandPayload(snapshot.cardState);
            delete signatureCardState.presentationEvents;
            delete signatureCardState._presentationEventsPersist;
            delete signatureCardState.chargeDeltaEvents;
            return JSON.stringify({
                gameState: cloneDataForCommandPayload(snapshot.gameState),
                cardState: signatureCardState
            });
        } catch (e) {
            return '';
        }
    }

    function computeCurrentPlaybackRecoverySignature() {
        const currentSnapshot = getCurrentSnapshotForPublish();
        return computeForceSyncPlaybackRecoverySignature(currentSnapshot);
    }

    // The actor already played `requestMeta.playbackEvents` locally before publishing
    // (both the use_card immediate path with usedSnapshotFallback=true and the
    // post-action publish path that runs `originalRunTurnWithAdapter` first). When
    // the server's authoritative response echoes the same events back, replaying
    // them visibly produces a 2x animation. The reliable signal is
    // `requestedPlaybackEvents.length > 0` — actor pre-played, so suppress.
    // For publish-response we additionally require the response snapshot signature
    // to match the actor's current state, which guarantees the response is the
    // echo of the same action and not a divergent server correction.
    function shouldApplyPublishResponseAsShadowPlayback(trackedPublish, snapshot, playbackEvents) {
        if (!trackedPublish || typeof trackedPublish !== 'object') return false;
        if (!trackedPublish.requestMeta) return false;
        const requestedPlaybackEvents = getTrackedPublishRequestedPlaybackEvents(trackedPublish);
        if (!Array.isArray(requestedPlaybackEvents) || requestedPlaybackEvents.length === 0) return false;
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        const snapshotSignature = computeForceSyncPlaybackRecoverySignature(snapshot);
        if (!snapshotSignature) return false;
        const currentSignature = computeCurrentPlaybackRecoverySignature();
        return !!currentSignature && currentSignature === snapshotSignature;
    }

    // SSE stream variant: when the actor already drained playback locally
    // (any path that produced `requestMeta.playbackEvents`), the broadcast
    // snapshot would replay the same animations. Route those through shadow
    // playback so the actor does not see the same card-use / flip animation
    // twice. trackedPublish presence (matched by operationId in the SSE payload)
    // guarantees this is the echo of this actor's own action.
    function shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish, playbackEvents) {
        if (!trackedPublish || typeof trackedPublish !== 'object') return false;
        if (!trackedPublish.requestMeta) return false;
        const requestedPlaybackEvents = getTrackedPublishRequestedPlaybackEvents(trackedPublish);
        if (!Array.isArray(requestedPlaybackEvents) || requestedPlaybackEvents.length === 0) return false;
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        return true;
    }

    function clearPendingForceSyncPlaybackRecovery() {
        state.pendingForceSyncPlaybackVersion = null;
        state.pendingForceSyncPlaybackSource = '';
        state.pendingForceSyncPlaybackSignature = '';
    }

    function rememberPendingForceSyncPlaybackRecovery(snapshot, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const snapshotVersion = getSnapshotStateVersion(snapshot);
        const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
        if (snapshotVersion === null) {
            clearPendingForceSyncPlaybackRecovery();
            return false;
        }
        if (opts.force !== true || playbackEvents.length > 0) {
            const pendingVersion = Number.isFinite(Number(state.pendingForceSyncPlaybackVersion))
                ? Number(state.pendingForceSyncPlaybackVersion)
                : null;
            if (pendingVersion !== null && snapshotVersion >= pendingVersion) {
                clearPendingForceSyncPlaybackRecovery();
            }
            return false;
        }
        state.pendingForceSyncPlaybackVersion = snapshotVersion;
        state.pendingForceSyncPlaybackSource = typeof opts.source === 'string' ? opts.source : '';
        state.pendingForceSyncPlaybackSignature = computeForceSyncPlaybackRecoverySignature(snapshot);
        return true;
    }

    function consumePendingForceSyncPlaybackRecovery(snapshotOrVersion) {
        const snapshotVersion = Number.isFinite(Number(snapshotOrVersion))
            ? Number(snapshotOrVersion)
            : getSnapshotStateVersion(snapshotOrVersion);
        const pendingVersion = Number.isFinite(Number(state.pendingForceSyncPlaybackVersion))
            ? Number(state.pendingForceSyncPlaybackVersion)
            : null;
        if (snapshotVersion === null || pendingVersion === null || snapshotVersion < pendingVersion) {
            return false;
        }
        clearPendingForceSyncPlaybackRecovery();
        return true;
    }

    function shouldRecoverForceSyncedStreamPlayback(snapshot, playbackEvents) {
        const pendingVersion = Number.isFinite(Number(state.pendingForceSyncPlaybackVersion))
            ? Number(state.pendingForceSyncPlaybackVersion)
            : null;
        const pendingSignature = typeof state.pendingForceSyncPlaybackSignature === 'string'
            ? state.pendingForceSyncPlaybackSignature
            : '';
        const snapshotVersion = getSnapshotStateVersion(snapshot);
        const localVersion = getAppliedStateVersion();
        if (pendingVersion === null || snapshotVersion === null) return false;
        if (snapshotVersion !== pendingVersion) return false;
        if (!Array.isArray(playbackEvents) || playbackEvents.length <= 0) return false;
        if (shouldSkipForceSyncSnapshot(snapshot)) return false;
        if (pendingSignature && computeForceSyncPlaybackRecoverySignature(snapshot) !== pendingSignature) return false;
        return localVersion === snapshotVersion;
    }

    function isVersionConflictReason(reasonValue) {
        const reason = String(reasonValue || '').trim();
        return reason === 'VERSION_MISMATCH'
            || reason === 'VERSION_AHEAD'
            || reason === 'VERSION_BEHIND'
            || reason === 'VERSION_GAP';
    }

    function getVersionConflictTelemetryKey(reasonValue) {
        const reason = String(reasonValue || '').trim();
        if (reason === 'VERSION_AHEAD') return 'publish_version_ahead';
        if (reason === 'VERSION_BEHIND') return 'publish_version_behind';
        if (reason === 'VERSION_GAP') return 'publish_version_gap';
        if (reason === 'VERSION_MISMATCH') return 'publish_version_mismatch';
        return '';
    }

    function resolveRejectedPublishSnapshotHandling(entry, payload, rejectedReason, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const reason = String(rejectedReason || '').trim() || 'PUBLISH_REJECTED';
        const snapshot = (payload && payload.snapshot && typeof payload.snapshot === 'object')
            ? payload.snapshot
            : null;
        const localStateVersionBefore = Number.isFinite(Number(state.stateVersion))
            ? Number(state.stateVersion)
            : null;
        const rejectionStateVersion = Number.isFinite(Number(payload && payload.stateVersion))
            ? Number(payload.stateVersion)
            : null;

        if (rejectionStateVersion !== null && (localStateVersionBefore === null || rejectionStateVersion > localStateVersionBefore)) {
            state.stateVersion = rejectionStateVersion;
        }

        const snapshotVersion = getSnapshotStateVersion(snapshot);
        if (!snapshot) {
            return { shouldApplySnapshot: false, skipReason: 'missing_snapshot', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
        }
        if (entry && hasNewerQueuedPublish(entry.sequence)) {
            return { shouldApplySnapshot: false, skipReason: 'newer_local_publish', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
        }
        if (snapshotVersion === null) {
            return { shouldApplySnapshot: false, skipReason: 'missing_snapshot_version', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
        }
        if (localStateVersionBefore !== null && snapshotVersion < localStateVersionBefore) {
            return { shouldApplySnapshot: false, skipReason: 'stale_snapshot_version', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
        }
        if (isVersionConflictReason(reason) && localStateVersionBefore !== null && snapshotVersion === localStateVersionBefore) {
            return { shouldApplySnapshot: false, skipReason: 'same_version_version_mismatch', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
        }
        if (shouldSkipForceSyncSnapshot(snapshot, {
            ignoreSequence: entry && entry.sequence,
            localProjectedSnapshotHash: opts.localProjectedSnapshotHash || null
        })) {
            return { shouldApplySnapshot: false, skipReason: 'skip_force_sync_guard', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
        }
        return { shouldApplySnapshot: true, skipReason: null, snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }

    function buildPublishCommandPayload(info, playerKey) {
        const moduleRef = resolveNetworkCommandPayloadModule();
        if (!moduleRef || typeof moduleRef.buildPublishCommandPayload !== 'function') {
            return null;
        }
        return moduleRef.buildPublishCommandPayload(info, {
            playerKey,
            normalizePlayerKey,
            pendingCoordinator: PendingCoordinatorModule
        });
    }

    function withTrailingSlashRemoved(url) {
        return String(url || '').replace(/\/+$/, '');
    }

    function createOperationId() {
        const nowPart = Date.now().toString(36);
        const randPart = Math.random().toString(36).slice(2, 10);
        return `op_${nowPart}_${randPart}`;
    }

    function readSeatClaim(roomId) {
        return invokeControllerMethod(getNetworkSessionSeatController, 'readSeatClaim', arguments, null);
    }

    function writeSeatClaim(roomId, seatKey, seatToken) {
        invokeControllerMethod(getNetworkSessionSeatController, 'writeSeatClaim', arguments, undefined);
    }

    function clearSeatClaim(roomId) {
        invokeControllerMethod(getNetworkSessionSeatController, 'clearSeatClaim', arguments, undefined);
    }

    function emitStatus(text, isError) {
        if (typeof state.statusWriter === 'function') {
            try {
                state.statusWriter(String(text || ''), !!isError);
                return;
            } catch (e) { /* ignore */ }
        }
        try {
            if (typeof addLog === 'function') {
                addLog(String(text || ''));
            }
        } catch (e) { /* ignore */ }
    }

    function emitEffectLog(text) {
        const line = String(text || '').trim();
        if (!line) return;
        try {
            if (root && typeof root.emitEffectLog === 'function' && root.emitEffectLog !== emitEffectLog) {
                root.emitEffectLog(line);
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            if (root && typeof root.emitLogAdded === 'function') {
                root.emitLogAdded(line, 'effect');
                return;
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis !== root) {
                if (typeof globalThis.emitEffectLog === 'function' && globalThis.emitEffectLog !== emitEffectLog) {
                    globalThis.emitEffectLog(line);
                    return;
                }
                if (typeof globalThis.emitLogAdded === 'function') {
                    globalThis.emitLogAdded(line, 'effect');
                    return;
                }
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof addLog === 'function') {
                addLog(line);
            }
        } catch (e) { /* ignore */ }
    }

    function getPayloadEffectLogs(payload) {
        const source = (payload && Array.isArray(payload.effectLogs)) ? payload.effectLogs : [];
        const normalized = [];
        for (let index = 0; index < source.length; index += 1) {
            const line = String(source[index] || '').trim();
            if (!line) continue;
            if (normalized.length > 0 && normalized[normalized.length - 1] === line) continue;
            normalized.push(line);
        }
        return normalized;
    }

    function emitPayloadEffectLogs(payload) {
        const effectLogs = getPayloadEffectLogs(payload);
        for (let index = 0; index < effectLogs.length; index += 1) {
            emitEffectLog(effectLogs[index]);
        }
        return effectLogs.length;
    }

    function emitStatusAndEffectLog(text, isError) {
        emitStatus(text, isError);
        if (typeof state.statusWriter === 'function') {
            emitEffectLog(text);
        }
    }

    function emitSnapshotCommentary(payload, snapshot, isSelfOperation, playbackEvents) {
        invokeControllerMethod(getNetworkCommentaryController, 'emitSnapshotCommentary', arguments, undefined);
    }

    function getSeatDisplayName(seatKey) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'getSeatDisplayName',
            arguments,
            () => (normalizePlayerKey(seatKey) === 'white' ? '白' : '黒')
        );
    }

    function normalizePlayerName(value) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'normalizePlayerName',
            arguments,
            () => String(value || '').replace(/\s+/g, ' ').trim()
        );
    }

    function normalizeRoomSeats(value) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'normalizeRoomSeats',
            arguments,
            () => ({ black: !!(value && value.black), white: !!(value && value.white) })
        );
    }

    function normalizeSeatNames(value) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'normalizeSeatNames',
            arguments,
            () => ({ black: normalizePlayerName(value && value.black), white: normalizePlayerName(value && value.white) })
        );
    }

    function normalizeSeatHandSkins(value) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'normalizeSeatHandSkins',
            arguments,
            () => ({ black: String((value && value.black) || '').trim(), white: String((value && value.white) || '').trim() })
        );
    }

    function hasTwoPlayers() {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'hasTwoPlayers',
            arguments,
            () => !!(state.roomSeats && state.roomSeats.black && state.roomSeats.white)
        );
    }

    function emitRoomStateChanged() {
        invokeControllerMethod(getNetworkSessionSeatController, 'emitRoomStateChanged', arguments, undefined);
    }

    function updateRoomSeatsFromPayload(payload) {
        invokeControllerMethod(getNetworkSessionSeatController, 'updateRoomSeatsFromPayload', arguments, undefined);
    }

    function readSelectedHandSkinId() {
        const handSkinUiModule = resolveHandSkinUiModule();
        if (handSkinUiModule && typeof handSkinUiModule.readStoredHandSkinId === 'function') {
            try {
                return String(handSkinUiModule.readStoredHandSkinId(root)).trim() || 'default';
            } catch (e) { /* ignore */ }
        }
        const storageKey = String((handSkinUiModule && handSkinUiModule.HAND_SKIN_STORAGE_KEY) || 'othello.handSkin').trim() || 'othello.handSkin';
        try {
            if (typeof localStorage !== 'undefined') {
                return String(localStorage.getItem(storageKey) || '').trim() || 'default';
            }
        } catch (e) { /* ignore */ }
        return 'default';
    }

    function applyPayloadSessionState(payload) {
        if (!payload || typeof payload !== 'object') return;
        updateTurnTimerFromPayload(payload);
        updateRoomSeatsFromPayload(payload);
        const snapshotMeta = getSnapshotMeta(payload.snapshot);
        if (snapshotMeta && snapshotMeta.authority === 'server') {
            state.authoritativeMatchState.stateVersion = getSnapshotStateVersion(payload.snapshot);
            state.authoritativeMatchState.authority = snapshotMeta.authority;
            state.authoritativeMatchState.projectedForSeat = snapshotMeta.projectedForSeat;
            state.authoritativeMatchState.turnStartReconciled = snapshotMeta.turnStartReconciled;
            state.authoritativeMatchState.projectedSnapshotHash = snapshotMeta.projectedSnapshotHash;
        }
        const warnings = (payload.playbackDiagnostics && Array.isArray(payload.playbackDiagnostics.warnings))
            ? payload.playbackDiagnostics.warnings.filter((warning) => String(warning || '').trim())
            : [];
        if (warnings.length > 0) {
            recordNetworkTelemetry('playback_diagnostics_warning', {
                source: payload.type || payload.actionType || 'network_payload',
                warnings
            });
        }
    }

    function normalizeTurnTimerPayload(value) {
        const source = (value && typeof value === 'object') ? value : {};
        const limitSeconds = Number.isFinite(Number(source.limitSeconds))
            ? Math.max(1, Math.trunc(Number(source.limitSeconds)))
            : TURN_TIMER_DEFAULT_LIMIT;
        const turnSeatKey = normalizePlayerKey(source.turnSeatKey);
        const turnStartedAt = Number.isFinite(Number(source.turnStartedAt))
            ? Math.max(0, Math.trunc(Number(source.turnStartedAt)))
            : null;
        const turnDeadlineAt = Number.isFinite(Number(source.turnDeadlineAt))
            ? Math.max(0, Math.trunc(Number(source.turnDeadlineAt)))
            : null;
        const active = !!source.active && turnDeadlineAt !== null;

        return {
            limitSeconds,
            active,
            turnSeatKey,
            turnStartedAt: active ? turnStartedAt : null,
            turnDeadlineAt: active ? turnDeadlineAt : null
        };
    }

    function updateServerTimeOffset(serverTimeValue) {
        const serverTime = Number(serverTimeValue);
        if (!Number.isFinite(serverTime)) return;
        state.serverTimeOffsetMs = serverTime - Date.now();
    }

    function maybeSyncFromHeartbeat(payload) {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.maybeSyncFromHeartbeat !== 'function') return;
        controller.maybeSyncFromHeartbeat(payload);
    }

    function getAdjustedNowMs() {
        return Date.now() + (Number.isFinite(state.serverTimeOffsetMs) ? state.serverTimeOffsetMs : 0);
    }

    function waitForMs(ms) {
        const waitMs = Number.isFinite(Number(ms)) ? Math.max(0, Math.trunc(Number(ms))) : 0;
        return new Promise((resolve) => {
            scheduleTimeout(resolve, waitMs);
        });
    }

    function ensurePublishTracker() {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.ensurePublishTracker !== 'function') {
            throw new Error('NetworkPublishTrackerModule unavailable');
        }
        return controller.ensurePublishTracker();
    }

    function pruneTrackedPublishes() {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.pruneTrackedPublishes !== 'function') {
            throw new Error('NetworkPublishTrackerModule unavailable');
        }
        return controller.pruneTrackedPublishes();
    }

    function resetPublishTracker() {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.resetPublishTracker !== 'function') return;
        controller.resetPublishTracker();
    }

    function createTrackedPublish(operationId, requestMeta) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.createTrackedPublish !== 'function') {
            throw new Error('NetworkPublishTrackerModule unavailable');
        }
        return controller.createTrackedPublish(operationId, requestMeta);
    }

    function getTrackedPublishRequestedPlaybackEvents(entry) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.getTrackedPublishRequestedPlaybackEvents !== 'function') return [];
        return controller.getTrackedPublishRequestedPlaybackEvents(entry);
    }

    function findTrackedPublish(operationId) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.findTrackedPublish !== 'function') return null;
        return controller.findTrackedPublish(operationId);
    }

    function settleTrackedPublish(entry) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.settleTrackedPublish !== 'function') return;
        controller.settleTrackedPublish(entry);
    }

    function markTrackedPublishInFlight(entry) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishInFlight !== 'function') return;
        controller.markTrackedPublishInFlight(entry);
    }

    function markTrackedPublishResponse(entry, stateVersionValue) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishResponse !== 'function') return;
        controller.markTrackedPublishResponse(entry, stateVersionValue);
    }

    function markTrackedPublishSelfSnapshot(entry, snapshot) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishSelfSnapshot !== 'function') return;
        controller.markTrackedPublishSelfSnapshot(entry, snapshot);
    }

    function markTrackedPublishSnapshotApplied(entry, snapshot, source) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishSnapshotApplied !== 'function') return;
        controller.markTrackedPublishSnapshotApplied(entry, snapshot, source);
    }

    function hasTrackedPublishPresentedResult(entry) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.hasTrackedPublishPresentedResult !== 'function') return false;
        return controller.hasTrackedPublishPresentedResult(entry);
    }

    function markTrackedPublishResultPresented(entry, snapshot) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishResultPresented !== 'function') return;
        controller.markTrackedPublishResultPresented(entry, snapshot);
    }

    function hasPendingLocalPublishes(options) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.hasPendingLocalPublishes !== 'function') return false;
        return controller.hasPendingLocalPublishes(options);
    }

    function hasNewerQueuedPublish(sequence) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.hasNewerQueuedPublish !== 'function') return false;
        return controller.hasNewerQueuedPublish(sequence);
    }

    function getPendingLocalPublishProjectedSnapshotHash(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const ignoredSequence = Number.isFinite(Number(opts.ignoreSequence))
            ? Number(opts.ignoreSequence)
            : null;
        const tracker = ensurePublishTracker();
        const operations = Array.isArray(tracker && tracker.operations) ? tracker.operations : [];
        for (let index = operations.length - 1; index >= 0; index -= 1) {
            const entry = operations[index];
            if (!entry || (entry.phase !== 'queued' && entry.phase !== 'inflight')) continue;
            if (ignoredSequence !== null && Number(entry.sequence) === ignoredSequence) continue;
            const requestMeta = entry.requestMeta;
            if (
                requestMeta
                && typeof requestMeta.snapshotProjectedHash === 'string'
                && requestMeta.snapshotProjectedHash
            ) {
                return requestMeta.snapshotProjectedHash;
            }
        }
        return null;
    }

    function applySnapshotThroughCoordinator(snapshot, options) {
        const mod = resolveNetworkApplyCoordinatorModule();
        if (!mod || typeof mod.applySnapshotThroughCoordinator !== 'function') {
            throw new Error('NetworkApplyCoordinatorModule unavailable');
        }
        return mod.applySnapshotThroughCoordinator(snapshot, Object.assign({}, options, {
            getSnapshotStateVersion,
            hasNewerQueuedPublish,
            applySnapshot,
            markTrackedPublishSnapshotApplied,
            onAppliedVersion: (appliedVersion) => {
                state.appliedStateVersion = appliedVersion;
                state.stateVersion = appliedVersion;
            }
        }));
    }

    function isTerminalSnapshotForResult(snapshot) {
        const gameState = snapshot && snapshot.gameState;
        if (!gameState || typeof gameState !== 'object') return false;
        try {
            if (typeof root.isGameOver === 'function') {
                return !!root.isGameOver(gameState);
            }
        } catch (e) { /* ignore */ }
        return gameState.currentPlayer === -1;
    }

    function getKnownProjectedSnapshotHash() {
        if (
            state.authoritativeMatchState
            && typeof state.authoritativeMatchState.lastAppliedProjectedSnapshotHash === 'string'
            && state.authoritativeMatchState.lastAppliedProjectedSnapshotHash
        ) {
            return state.authoritativeMatchState.lastAppliedProjectedSnapshotHash;
        }
        if (
            state.authoritativeMatchState
            && typeof state.authoritativeMatchState.projectedSnapshotHash === 'string'
            && state.authoritativeMatchState.projectedSnapshotHash
        ) {
            return state.authoritativeMatchState.projectedSnapshotHash;
        }
        return null;
    }

    function shouldSkipForceSyncSnapshot(snapshot, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const remoteVersion = getSnapshotStateVersion(snapshot);
        const localVersion = getAppliedStateVersion();
        const pendingLocalPublish = hasPendingLocalPublishes(opts);
        const remoteMeta = getSnapshotMeta(snapshot);
        const remoteHash = remoteMeta && remoteMeta.projectedSnapshotHash ? remoteMeta.projectedSnapshotHash : null;
        const localHash = (typeof opts.localProjectedSnapshotHash === 'string' && opts.localProjectedSnapshotHash)
            ? opts.localProjectedSnapshotHash
            : (getPendingLocalPublishProjectedSnapshotHash(opts) || getKnownProjectedSnapshotHash());

        if (!pendingLocalPublish) return false;

        if (remoteVersion === null) return true;
        if (localVersion === null) return false;
        if (
            remoteVersion === localVersion
            && remoteHash
            && localHash
            && remoteHash !== localHash
        ) {
            return false;
        }
        return remoteVersion <= localVersion;
    }

    function computeRetryDelayMs(baseDelayMs, maxDelayMs, attempt) {
        const base = Number.isFinite(Number(baseDelayMs))
            ? Math.max(100, Math.trunc(Number(baseDelayMs)))
            : 300;
        const max = Number.isFinite(Number(maxDelayMs))
            ? Math.max(base, Math.trunc(Number(maxDelayMs)))
            : RECONNECT_MAX_DELAY_MS;
        const exponent = Math.max(0, Math.min(RECONNECT_MAX_EXPONENT, Number.isFinite(Number(attempt)) ? Number(attempt) : 0));
        const nextBase = Math.min(max, base * (2 ** exponent));
        const jitterMs = Math.floor(Math.random() * Math.max(1, nextBase));
        return Math.max(RECONNECT_MIN_DELAY_MS, jitterMs);
    }

    async function syncLatestStateWithRetry(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const maxAttempts = Number.isFinite(Number(opts.maxAttempts))
            ? Math.max(1, Math.trunc(Number(opts.maxAttempts)))
            : 3;
        const baseDelayMs = Number.isFinite(Number(opts.baseDelayMs))
            ? Math.max(100, Math.trunc(Number(opts.baseDelayMs)))
            : 350;

        let lastError = null;
        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            if (!isActive()) {
                return { ok: false, reason: 'INACTIVE' };
            }

            try {
                const result = await syncLatestState();
                if (result && result.ok === true) {
                    return result;
                }
                lastError = new Error(result && result.reason ? String(result.reason) : 'STATE_SYNC_FAILED');
            } catch (e) {
                lastError = e;
            }

            if (attempt >= (maxAttempts - 1)) break;

            const delayMs = computeRetryDelayMs(baseDelayMs, RECONNECT_MAX_DELAY_MS, attempt);
            await waitForMs(delayMs);
        }

        throw (lastError || new Error('STATE_SYNC_RETRY_EXHAUSTED'));
    }

    function getTurnTimerInfo() {
        const timer = normalizeTurnTimerPayload(state.turnTimer);
        const deadlineAt = Number.isFinite(Number(timer.turnDeadlineAt)) ? Number(timer.turnDeadlineAt) : null;
        const active = !!timer.active && deadlineAt !== null;
        const remainingMs = active ? Math.max(0, deadlineAt - getAdjustedNowMs()) : null;

        return {
            limitSeconds: timer.limitSeconds,
            active,
            turnSeatKey: timer.turnSeatKey,
            turnStartedAt: active ? timer.turnStartedAt : null,
            turnDeadlineAt: active ? deadlineAt : null,
            remainingMs,
            isOwnTurn: active && timer.turnSeatKey === state.seatKey
        };
    }

    function emitTurnTimerChanged() {
        if (typeof state.turnTimerListener !== 'function') return;
        try {
            state.turnTimerListener(getTurnTimerInfo());
        } catch (e) { /* ignore */ }
    }

    function clearTurnTimerTick() {
        if (!state.turnTimerTickHandle) return;
        clearScheduledTimeout(state.turnTimerTickHandle);
        state.turnTimerTickHandle = 0;
    }

    function maybeSyncLatestStateAfterTimeout(timerInfo) {
        if (!timerInfo || timerInfo.active !== true) return;
        if (!Number.isFinite(Number(timerInfo.turnDeadlineAt))) return;
        if (!isActive()) return;
        if (!state.seatToken) return;

        const deadlineAt = Number(timerInfo.turnDeadlineAt);
        if (state.turnTimerSyncRequestedDeadline === deadlineAt) return;
        state.turnTimerSyncRequestedDeadline = deadlineAt;

        syncLatestState().catch(() => {
            // keep countdown loop stable even when one sync request fails
        });
    }

    function scheduleTurnTimerTick() {
        clearTurnTimerTick();

        const info = getTurnTimerInfo();
        emitTurnTimerChanged();

        if (!info.active) return;

        const waitMs = (info.remainingMs !== null && info.remainingMs <= 10000) ? 250 : 1000;
        state.turnTimerTickHandle = scheduleTimeout(() => {
            state.turnTimerTickHandle = 0;
            const nextInfo = getTurnTimerInfo();
            emitTurnTimerChanged();
            if (nextInfo.active && nextInfo.remainingMs !== null && nextInfo.remainingMs <= 0) {
                maybeSyncLatestStateAfterTimeout(nextInfo);
            }
            scheduleTurnTimerTick();
        }, waitMs);
    }

    function resetTurnTimerState() {
        state.turnTimer = normalizeTurnTimerPayload(null);
        state.turnTimerSyncRequestedDeadline = null;
        state.serverTimeOffsetMs = 0;
        state.heartbeatResyncInFlight = false;
        clearTurnTimerTick();
        emitTurnTimerChanged();
    }

    function updateTurnTimerFromPayload(payload) {
        if (!payload || typeof payload !== 'object') return;

        updateServerTimeOffset(payload.serverTime);

        if (!Object.prototype.hasOwnProperty.call(payload, 'turnTimer')) return;

        const prevDeadline = Number.isFinite(Number(state.turnTimer && state.turnTimer.turnDeadlineAt))
            ? Number(state.turnTimer.turnDeadlineAt)
            : null;
        const nextTimer = normalizeTurnTimerPayload(payload.turnTimer);

        state.turnTimer = nextTimer;

        const nextDeadline = Number.isFinite(Number(nextTimer.turnDeadlineAt)) ? Number(nextTimer.turnDeadlineAt) : null;
        if (!nextTimer.active || nextDeadline !== prevDeadline) {
            state.turnTimerSyncRequestedDeadline = null;
        }

        scheduleTurnTimerTick();
    }

    function ensureOwnSeatJoined() {
        invokeControllerMethod(getNetworkSessionSeatController, 'ensureOwnSeatJoined', arguments, undefined);
    }

    function normalizeChatText(value) {
        return String(value || '').replace(/[\r\n]+/g, ' ').trim();
    }

    function countTextChars(value) {
        return Array.from(String(value || '')).length;
    }

    function normalizeChatMessage(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const text = normalizeChatText(entry.text);
        if (!text) return null;
        return {
            id: Number.isFinite(Number(entry.id)) ? Number(entry.id) : Date.now(),
            seatKey: normalizePlayerKey(entry.seatKey),
            text,
            serverTime: Number.isFinite(Number(entry.serverTime)) ? Number(entry.serverTime) : Date.now()
        };
    }

    function emitChatEvent(payload) {
        if (typeof state.chatListener !== 'function') return;
        try {
            state.chatListener(payload);
        } catch (e) { /* ignore */ }
    }

    function handleChatPayload(payload) {
        if (!payload || payload.ok !== true) return;

        applyPayloadSessionState(payload);

        const type = String(payload.type || 'message');
        if (type === 'history') {
            const list = Array.isArray(payload.messages) ? payload.messages : [];
            const normalized = list
                .map((entry) => normalizeChatMessage(entry))
                .filter((entry) => !!entry);
            state.chatHistory = normalized.slice(-CHAT_HISTORY_LIMIT);
            emitChatEvent({
                type: 'history',
                messages: state.chatHistory.slice()
            });
            return;
        }

        const message = normalizeChatMessage(payload.message);
        if (!message) return;

        state.chatHistory.push(message);
        if (state.chatHistory.length > CHAT_HISTORY_LIMIT) {
            state.chatHistory.splice(0, state.chatHistory.length - CHAT_HISTORY_LIMIT);
        }

        emitChatEvent({
            type: 'message',
            message
        });
    }

    function handlePresencePayload(payload) {
        if (!payload || payload.ok !== true) return;

        applyPayloadSessionState(payload);

        const type = String(payload.type || 'join');
        if (type !== 'join' && type !== 'leave') return;

        const joinedSeatKey = normalizePlayerKey(payload.seatKey);
        if (joinedSeatKey === state.seatKey) return;

        const seatName = getSeatDisplayName(joinedSeatKey);
        const message = (type === 'leave')
            ? `ネット対戦: ${seatName}が退出しました`
            : (payload.rejoined
                ? `ネット対戦: ${seatName}が再接続しました`
                : `ネット対戦: ${seatName}が接続しました`);
        emitStatusAndEffectLog(message, false);
    }

    function handleTimeoutPassPayload(payload) {
        if (!payload || payload.ok !== true) return;
        if (String(payload.actionType || '') !== 'timeout_pass') return;

        const timedOutSeatKey = normalizePlayerKey(payload.playerKey);
        if (timedOutSeatKey === state.seatKey) {
            emitStatusAndEffectLog('ネット対戦: あなたの手番が時間切れになりました', false);
            return;
        }

        const seatName = getSeatDisplayName(timedOutSeatKey);
        emitStatusAndEffectLog(`ネット対戦: ${seatName}の手番が時間切れになりました`, false);
    }

    function applySnapshot(snapshot, options) {
        if (shouldClearStaleBoardUpdateContext(options)) {
            clearBoardUpdateContext();
            recordNetworkTelemetry('force_snapshot_cleared_stale_board_update_context', {
                force: true,
                hasPlaybackEvents: !!(options && Array.isArray(options.playbackEvents) && options.playbackEvents.length > 0),
                hasShadowPlaybackEvents: !!(options && Array.isArray(options.shadowPlaybackEvents) && options.shadowPlaybackEvents.length > 0)
            });
        }
        const applied = invokeControllerMethod(getNetworkSnapshotController, 'applySnapshot', arguments, false);
        if (applied) {
            const snapshotVersion = getSnapshotStateVersion(snapshot);
            if (snapshotVersion !== null) {
                state.appliedStateVersion = snapshotVersion;
            }
        }
        return applied;
    }

    function activateSessionFromResponse(data, fallbackRoomId) {
        invokeControllerMethod(getNetworkSessionSeatController, 'activateSessionFromResponse', arguments, undefined);
    }

    function resetSessionState() {
        invokeControllerMethod(getNetworkSessionSeatController, 'resetSessionState', arguments, () => {
            state.active = false;
            state.roomId = '';
            state.seatKey = 'black';
            state.seatToken = '';
            state.roomSeats = { black: false, white: false };
            state.seatNames = { black: '', white: '' };
            state.seatHandSkins = { black: '', white: '' };
            state.roomDeck = null;
            state.roomBoardConfig = null;
            state.networkDebugEnabled = false;
            state.chatHistory = [];
            state.stateVersion = null;
            state.appliedStateVersion = null;
            state.lastStreamEventId = '';
            state.authoritativeMatchState.gameState = null;
            state.authoritativeMatchState.cardState = null;
            state.authoritativeMatchState.stateVersion = null;
            state.authoritativeMatchState.authority = null;
            state.authoritativeMatchState.projectedForSeat = null;
            state.authoritativeMatchState.turnStartReconciled = false;
            state.authoritativeMatchState.projectedSnapshotHash = null;
            state.authoritativeMatchState.lastAppliedProjectedSnapshotHash = null;
            resetPublishTracker();
            clearPendingForceSyncPlaybackRecovery();
            resetNetworkResultPresentationState(state);
            setSeatGlobals('black');
            emitRoomStateChanged();
        });
    }

    function setSeatGlobals(seatKey) {
        invokeControllerMethod(getNetworkSessionSeatController, 'setSeatGlobals', arguments, undefined);
    }

    function parseStreamEventPayload(event) {
        try {
            return JSON.parse((event && event.data) || '{}');
        } catch (e) {
            return null;
        }
    }

    function createStreamPayloadHandler(payloadHandler) {
        return function handleParsedStreamEvent(event) {
            const payload = parseStreamEventPayload(event);
            if (!payload) return;
            rememberStreamEventId(event);
            markStreamActivity();
            payloadHandler(payload);
        };
    }

    async function requestJson(method, path, payload) {
        const url = `${withTrailingSlashRemoved(state.serverUrl)}${path}`;
        const init = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (payload !== undefined) {
            init.body = JSON.stringify(payload);
        }

        let timeoutId = 0;
        let controller = null;
        try {
            if (typeof AbortController === 'function') {
                controller = new AbortController();
                init.signal = controller.signal;
                timeoutId = scheduleTimeout(() => {
                    try { controller.abort(); } catch (e) { /* ignore */ }
                }, REQUEST_TIMEOUT_MS);
            }
        } catch (e) { /* ignore */ }

        try {
            const response = await fetch(url, init);
            const data = await response.json().catch(() => ({}));
            return { ok: response.ok, status: response.status, data };
        } finally {
            if (timeoutId) {
                clearScheduledTimeout(timeoutId);
            }
        }
    }

    function sanitizePlaybackValueForPublish(value) {
        if (Array.isArray(value)) {
            return value.map((item) => sanitizePlaybackValueForPublish(item));
        }
        if (!value || typeof value !== 'object') return value;

        const sanitized = {};
        const keys = Object.keys(value);
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (key === 'sourceCardEl' || key === 'sourceCardRect') continue;
            sanitized[key] = sanitizePlaybackValueForPublish(value[key]);
        }
        return sanitized;
    }

    function sanitizePlaybackEventsForPublish(playbackEvents) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length <= 0) return [];
        return playbackEvents.map((event) => sanitizePlaybackValueForPublish(event));
    }

    function queueCommandPublish(playerKey, action, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const normalizedPlayerKey = normalizePlayerKey(playerKey);
        const resolvedActionType = String(
            opts.actionType || (action && (action.type || action.actionType)) || 'action'
        ).trim();
        return publishSnapshot({
            playerKey: normalizedPlayerKey,
            actionType: resolvedActionType,
            playbackEvents: Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [],
            usedSnapshotFallback: opts.usedSnapshotFallback === true,
            action
        });
    }

    function isMatchApiMissing(res) {
        return !!(res && Number(res.status) === 404);
    }

    function shouldRetryJoinWithoutStoredClaim(res) {
        const reason = String(res && res.data && res.data.reason ? res.data.reason : '').trim();
        return reason === 'ROOM_FULL' || reason === 'SEAT_TOKEN_MISMATCH';
    }

    function ensureActionBridge() {
        const controller = getNetworkActionBridgeController();
        if (!controller || typeof controller.install !== 'function') return false;
        return controller.install() === true;
    }

    function teardownActionBridge() {
        const controller = getNetworkActionBridgeController();
        if (!controller || typeof controller.teardown !== 'function') return;
        controller.teardown();
    }

    function clearReconnectTimer() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.clearReconnectTimer !== 'function') return;
        controller.clearReconnectTimer();
    }

    function clearReconnectRecoveryTimer() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.clearReconnectRecoveryTimer !== 'function') return;
        controller.clearReconnectRecoveryTimer();
    }

    function completeReconnectRecoveryFromStream() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.completeReconnectRecoveryFromStream !== 'function') return;
        controller.completeReconnectRecoveryFromStream();
    }

    function scheduleReconnectRecoverySync() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.scheduleReconnectRecoverySync !== 'function') return;
        controller.scheduleReconnectRecoverySync();
    }

    function clearStreamWatchdogTimer() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.clearStreamWatchdogTimer !== 'function') return;
        controller.clearStreamWatchdogTimer();
    }

    function markStreamActivity() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.markStreamActivity !== 'function') return;
        controller.markStreamActivity();
    }

    function rememberStreamEventId(event) {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.rememberStreamEventId !== 'function') return;
        controller.rememberStreamEventId(event);
    }

    function scheduleStreamWatchdog() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.scheduleStreamWatchdog !== 'function') return;
        controller.scheduleStreamWatchdog();
    }

    function scheduleStreamReconnect() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.scheduleStreamReconnect !== 'function') return;
        controller.scheduleStreamReconnect();
    }

    function closeStream() {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.closeStream !== 'function') return;
        controller.closeStream();
    }

    function isRetryablePublishStatus(status) {
        const code = Number(status);
        return code === 408 || code === 429 || code === 500 || code === 502 || code === 503 || code === 504;
    }

    async function publishRequestWithRetry(payload) {
        let lastError = null;

        for (let attempt = 0; attempt < PUBLISH_RETRY_MAX_ATTEMPTS; attempt += 1) {
            try {
                const res = await requestJson('POST', '/api/match/publish', payload);
                if (!isRetryablePublishStatus(res && res.status) || attempt >= (PUBLISH_RETRY_MAX_ATTEMPTS - 1)) {
                    return res;
                }
            } catch (e) {
                lastError = e;
                if (attempt >= (PUBLISH_RETRY_MAX_ATTEMPTS - 1)) {
                    throw e;
                }
            }

            const delayMs = computeRetryDelayMs(PUBLISH_RETRY_BASE_DELAY_MS, PUBLISH_RETRY_MAX_DELAY_MS, attempt);
            await waitForMs(delayMs);
        }

        throw (lastError || new Error('PUBLISH_RETRY_EXHAUSTED'));
    }

    function openStream(options) {
        const opts = options || {};
        closeStream();
        if (!state.active || !state.roomId) return;
        if (typeof EventSource !== 'function') {
            emitStatus('ネット対戦: この環境ではリアルタイム接続に未対応です', true);
            return;
        }

        const resumeEventId = opts.reconnect === true
            ? String(state.lastStreamEventId || '').trim()
            : '';
        const resumeQuery = resumeEventId
            ? `&lastEventId=${encodeURIComponent(resumeEventId)}`
            : '';
        const streamUrl = `${withTrailingSlashRemoved(state.serverUrl)}/api/match/stream?roomId=${encodeURIComponent(state.roomId)}&seatKey=${encodeURIComponent(state.seatKey)}&seatToken=${encodeURIComponent(state.seatToken || '')}${resumeQuery}`;
        const es = new EventSource(streamUrl);
        state.eventSource = es;
        markStreamActivity();
        scheduleStreamWatchdog();

        const onSnapshot = (payload) => {
            if (!payload || payload.ok !== true) return;
            applyPayloadSessionState(payload);
            const snapshot = payload.snapshot;
            const playbackEvents = Array.isArray(payload.playbackEvents) ? payload.playbackEvents : [];
            const operationId = payload && payload.operationId ? String(payload.operationId) : '';
            const snapshotVersion = getSnapshotStateVersion(snapshot);
            const trackedPublish = findTrackedPublish(operationId);
            const isSelfOperation = !!trackedPublish;
            const isTerminalResultSnapshot = isTerminalSnapshotForResult(snapshot);

            const shouldShadowStreamPlayback = isSelfOperation
                && shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish, playbackEvents);
            const streamPlaybackEvents = shouldShadowStreamPlayback ? [] : playbackEvents;
            const streamShadowPlaybackEvents = shouldShadowStreamPlayback ? playbackEvents : [];
            const streamShadowPlaybackSource = shouldShadowStreamPlayback ? 'stream_self_shadow' : undefined;
            let applied = applySnapshotThroughCoordinator(snapshot, {
                source: 'stream',
                trackedPublish,
                applyOptions: {
                    playbackEvents: streamPlaybackEvents,
                    shadowPlaybackEvents: streamShadowPlaybackEvents,
                    shadowPlaybackSource: streamShadowPlaybackSource,
                    force: false,
                    skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
                }
            });
            const recoveredForcedPlayback = !applied && shouldRecoverForceSyncedStreamPlayback(snapshot, playbackEvents)
                ? applySnapshot(snapshot, {
                    force: true,
                    playbackEvents: streamPlaybackEvents,
                    shadowPlaybackEvents: streamShadowPlaybackEvents,
                    shadowPlaybackSource: streamShadowPlaybackSource,
                    skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
                })
                : false;
            if (!applied && recoveredForcedPlayback) {
                applied = true;
                if (snapshotVersion !== null) {
                    state.appliedStateVersion = snapshotVersion;
                }
                if (trackedPublish) {
                    markTrackedPublishSnapshotApplied(trackedPublish, snapshot, 'stream_force_recovery');
                }
                recordNetworkTelemetry('stream_playback_recovered_after_force_sync', {
                    operationId,
                    snapshotVersion,
                    playbackEventCount: playbackEvents.length,
                    recoverySource: state.pendingForceSyncPlaybackSource || ''
                });
            }
            if (applied) {
                consumePendingForceSyncPlaybackRecovery(snapshotVersion);
                if (isSelfOperation && isTerminalResultSnapshot) {
                    markTrackedPublishResultPresented(trackedPublish, snapshot);
                }
                if (shouldShadowStreamPlayback) {
                    recordNetworkTelemetry('stream_self_snapshot_shadow_playback', {
                        operationId,
                        snapshotVersion,
                        playbackEventCount: playbackEvents.length
                    });
                }
                const emittedEffectLogCount = emitPayloadEffectLogs(payload);
                if (emittedEffectLogCount === 0) {
                    emitSnapshotCommentary(payload, snapshot, isSelfOperation, playbackEvents);
                }
            }
            if (isSelfOperation) {
                markTrackedPublishSelfSnapshot(trackedPublish, snapshot);
            }
            handleTimeoutPassPayload(payload);
            pruneTrackedPublishes();
        };

        const handleStreamEvent = createStreamPayloadHandler((payload) => {
            completeReconnectRecoveryFromStream();
            onSnapshot(payload);
        });
        const handlePresenceEvent = createStreamPayloadHandler(handlePresencePayload);
        const handleChatEvent = createStreamPayloadHandler(handleChatPayload);
        const handleHeartbeatEvent = createStreamPayloadHandler((payload) => {
            completeReconnectRecoveryFromStream();
            applyPayloadSessionState(payload);
            maybeSyncFromHeartbeat(payload);
        });

        es.addEventListener('snapshot', handleStreamEvent);
        es.addEventListener('presence', handlePresenceEvent);
        es.addEventListener('chat', handleChatEvent);
        es.addEventListener('heartbeat', handleHeartbeatEvent);
        es.onmessage = handleStreamEvent;

        es.onopen = () => {
            markStreamActivity();
            scheduleStreamWatchdog();
            clearReconnectTimer();
            const hadReconnect = !!opts.reconnect || Number(state.reconnectAttempt || 0) > 0;
            state.reconnectAttempt = 0;
            if (hadReconnect) {
                emitStatus('ネット対戦: 接続を回復しました', false);
                scheduleReconnectRecoverySync();
            }
        };

        es.onerror = () => {
            emitStatus('ネット対戦: 接続が不安定です（再接続待機）', true);
            if (!isActive()) return;

            const openState = (typeof EventSource !== 'undefined' && Number.isFinite(Number(EventSource.OPEN)))
                ? Number(EventSource.OPEN)
                : 1;
            const readyState = Number.isFinite(Number(es.readyState)) ? Number(es.readyState) : null;
            if (readyState !== openState) {
                scheduleStreamReconnect();
            }
        };
    }

    function isActive() {
        return state.active === true && !!state.roomId;
    }

    function setStatusWriter(writer) {
        state.statusWriter = typeof writer === 'function' ? writer : null;
    }

    function setServerUrl(url) {
        const normalized = normalizeServerUrl(url);
        state.serverUrl = normalized
            ? withTrailingSlashRemoved(normalized)
            : deriveSameOriginServerUrl();
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(SERVER_URL_STORAGE_KEY, state.serverUrl);
            }
        } catch (e) { /* ignore */ }
    }

    function getServerUrl() {
        return state.serverUrl;
    }

    function createRoom(options) {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'createRoom',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function joinRoom(roomId, options) {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'joinRoom',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function syncLatestState() {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'syncLatestState',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function getCurrentAppliedGameState() {
        try {
            if (root && root.gameState && typeof root.gameState === 'object') return root.gameState;
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis.gameState && typeof globalThis.gameState === 'object') {
                return globalThis.gameState;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function isCurrentAppliedGameOver() {
        const currentGameState = getCurrentAppliedGameState();
        if (!currentGameState) return false;

        try {
            const gameOverFn = (root && typeof root.isGameOver === 'function')
                ? root.isGameOver
                : ((typeof globalThis !== 'undefined' && typeof globalThis.isGameOver === 'function') ? globalThis.isGameOver : null);
            if (typeof gameOverFn === 'function') {
                return !!gameOverFn(currentGameState);
            }
        } catch (e) { /* ignore */ }

        return false;
    }

    function leaveRoom() {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'leaveRoom',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function getCurrentSnapshotForPublish() {
        return invokeControllerMethod(getNetworkSnapshotController, 'getCurrentSnapshotForPublish', arguments, null);
    }

    function publishSnapshot(meta) {
        if (!isActive()) return Promise.resolve({ ok: false, reason: 'INACTIVE' });
        if (!state.seatToken) return Promise.resolve({ ok: false, reason: 'SEAT_TOKEN_REQUIRED' });

        const info = meta || {};
        const playerKey = normalizePlayerKey(info.playerKey || state.seatKey);
        if (playerKey !== state.seatKey) {
            emitStatus(`ネット対戦: 操作主体が座席と不一致です (${playerKey} != ${state.seatKey})`, true);
            return Promise.resolve({ ok: false, reason: 'SEAT_MISMATCH_LOCAL' });
        }
        const operationId = createOperationId();
        const publishRequestModule = resolveNetworkPublishRequestModule();
        const publishRequest = publishRequestModule && typeof publishRequestModule.buildPublishRequest === 'function'
            ? publishRequestModule.buildPublishRequest(info, {
                playerKey,
                operationId,
                roomId: state.roomId,
                seatKey: state.seatKey,
                seatToken: state.seatToken,
                baseVersion: state.stateVersion,
                turnIndex: getCurrentPublishTurnIndex(),
                buildPublishCommandPayload: buildPublishCommandPayload
            })
            : null;
        if (!publishRequest || !publishRequest.commandPayload || !publishRequest.requestPayload) {
            return Promise.resolve({ ok: false, reason: 'COMMAND_REQUIRED' });
        }
        const commandPayload = publishRequest.commandPayload;
        const queuedPlaybackEvents = sanitizePlaybackEventsForPublish(info.playbackEvents);
        const queuedActionType = publishRequest.queuedActionType;
        const trackedPublish = createTrackedPublish(operationId, {
            actionType: queuedActionType,
            actor: commandPayload ? (commandPayload.actor || playerKey) : playerKey,
            params: commandPayload ? (commandPayload.params || {}) : null,
            playbackEvents: queuedPlaybackEvents,
            usedSnapshotFallback: info.usedSnapshotFallback === true,
            snapshotProjectedHash: getSnapshotMeta(info && info.snapshot) && getSnapshotMeta(info && info.snapshot).projectedSnapshotHash
        });

        state.publishChain = state.publishChain
            .then(async () => {
                if (!isActive()) {
                    settleTrackedPublish(trackedPublish);
                    return { ok: false, reason: 'INACTIVE' };
                }
                if (!state.seatToken) {
                    settleTrackedPublish(trackedPublish);
                    return { ok: false, reason: 'SEAT_TOKEN_REQUIRED' };
                }

                const payload = Object.assign({}, publishRequest.requestPayload, {
                    roomId: state.roomId,
                    seatKey: state.seatKey,
                    seatToken: state.seatToken,
                    playerKey,
                    actionType: queuedActionType,
                    operationId,
                    baseVersion: state.stateVersion
                });

                markTrackedPublishInFlight(trackedPublish);
                const res = await publishRequestWithRetry(payload);
                if (!res.ok || !res.data || res.data.ok !== true) {
                    const reason = (res.data && res.data.rejectedReason) || 'PUBLISH_REJECTED';
                    const localProjectedSnapshotHashBefore = getKnownProjectedSnapshotHash();
                    applyPayloadSessionState(res.data);
                    const rejectionHandling = resolveRejectedPublishSnapshotHandling(trackedPublish, res.data, reason, {
                        localProjectedSnapshotHash: localProjectedSnapshotHashBefore
                    });
                    const versionTelemetryKey = getVersionConflictTelemetryKey(reason);
                    recordNetworkTelemetry(versionTelemetryKey || 'publish_rejected', {
                        reason,
                        operationId,
                        sequence: trackedPublish.sequence,
                        snapshotVersion: rejectionHandling.snapshotVersion,
                        rejectionStateVersion: rejectionHandling.rejectionStateVersion,
                        localStateVersionBefore: rejectionHandling.localStateVersionBefore
                    });
                    if (versionTelemetryKey && versionTelemetryKey !== 'publish_version_mismatch') {
                        recordNetworkTelemetry('publish_version_mismatch', {
                            reason,
                            operationId,
                            sequence: trackedPublish.sequence,
                            snapshotVersion: rejectionHandling.snapshotVersion,
                            rejectionStateVersion: rejectionHandling.rejectionStateVersion,
                            localStateVersionBefore: rejectionHandling.localStateVersionBefore
                        });
                    }
                    if (rejectionHandling.shouldApplySnapshot) {
                        const rejectionPlaybackEvents = Array.isArray(res.data.playbackEvents) ? res.data.playbackEvents : [];
                        const applied = applySnapshotThroughCoordinator(res.data.snapshot, {
                            source: 'publish_rejection',
                            trackedPublish,
                            applyOptions: {
                                force: true,
                                playbackEvents: rejectionPlaybackEvents
                            }
                        });
                        if (applied) {
                            rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
                                source: 'publish_rejection',
                                force: true,
                                playbackEvents: rejectionPlaybackEvents
                            });
                        }
                        recordNetworkTelemetry('publish_rejection_snapshot_applied', {
                            reason,
                            operationId,
                            applied,
                            snapshotVersion: rejectionHandling.snapshotVersion
                        });
                    } else {
                        recordNetworkTelemetry('publish_rejection_snapshot_skipped', {
                            reason,
                            operationId,
                            skipReason: rejectionHandling.skipReason,
                            snapshotVersion: rejectionHandling.snapshotVersion
                        });
                    }
                    settleTrackedPublish(trackedPublish);
                    emitStatus(`ネット対戦: 操作が拒否されました (${reason})`, true);
                    return { ok: false, reason };
                }
                applyPayloadSessionState(res.data);
                const responseStateVersion = Number.isFinite(Number(res.data.stateVersion))
                    ? Number(res.data.stateVersion)
                    : null;
                if (responseStateVersion !== null) {
                    const currentAppliedVersion = getAppliedStateVersion();
                    if (currentAppliedVersion === null || responseStateVersion >= currentAppliedVersion) {
                        state.stateVersion = responseStateVersion;
                    }
                }
                markTrackedPublishResponse(trackedPublish, responseStateVersion);
                if (res.data && res.data.idempotentReplay === true) {
                    recordNetworkTelemetry('publish_idempotent_replay_ack', {
                        operationId,
                        responseStateVersion
                    });
                }
                if (res.data && res.data.snapshot) {
                    const serverPlaybackEvents = Array.isArray(res.data.playbackEvents) ? res.data.playbackEvents : [];
                    const shouldShadowPlaybackResponse = shouldApplyPublishResponseAsShadowPlayback(
                        trackedPublish,
                        res.data.snapshot,
                        serverPlaybackEvents
                    );
                    const applied = applySnapshotThroughCoordinator(res.data.snapshot, {
                        source: 'publish_response',
                        trackedPublish,
                        applyOptions: {
                            force: true,
                            playbackEvents: shouldShadowPlaybackResponse ? [] : serverPlaybackEvents,
                            shadowPlaybackEvents: shouldShadowPlaybackResponse ? serverPlaybackEvents : [],
                            shadowPlaybackSource: shouldShadowPlaybackResponse ? 'publish_response_shadow' : undefined,
                            skipResultOverlay: hasTrackedPublishPresentedResult(trackedPublish)
                        }
                    });
                    if (applied) {
                        rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
                            source: 'publish_response',
                            force: true,
                            playbackEvents: shouldShadowPlaybackResponse ? [] : serverPlaybackEvents
                        });
                        emitPayloadEffectLogs(res.data);
                        recordNetworkTelemetry('publish_response_snapshot_applied', {
                            operationId,
                            applied,
                            responseStateVersion,
                            playbackEventCount: serverPlaybackEvents.length,
                            usedShadowPlayback: shouldShadowPlaybackResponse
                        });
                    } else {
                        recordNetworkTelemetry('publish_response_snapshot_skipped', {
                            operationId,
                            responseStateVersion,
                            snapshotVersion: getSnapshotStateVersion(res.data.snapshot)
                        });
                    }
                }
                pruneTrackedPublishes();
                return { ok: true };
            })
            .catch((error) => {
                const message = error && error.message ? error.message : 'PUBLISH_ERROR';
                settleTrackedPublish(trackedPublish);
                emitStatus(`ネット対戦: 通信失敗 (${message})`, true);
                return { ok: false, reason: 'PUBLISH_ERROR' };
            })
            .finally(() => {
                pruneTrackedPublishes();
            });

        return state.publishChain;
    }

    async function requestRematch() {
        if (!isActive()) return { ok: false, reason: 'INACTIVE' };
        clearBoardUpdateContext();

        const makeRequest = () => publishSnapshot({
            playerKey: state.seatKey,
            actionType: 'reset_game',
            action: {
                type: 'reset_game',
                playerKey: state.seatKey
            },
            playbackEvents: []
        });

        let firstResult = null;
        try {
            firstResult = await makeRequest();
        } catch (e) {
            return { ok: false, reason: 'REMATCH_REQUEST_FAILED' };
        }

        if (firstResult && firstResult.ok === true) return firstResult;
        if (!firstResult || !isVersionConflictReason(firstResult.reason)) return firstResult || { ok: false, reason: 'REMATCH_REQUEST_FAILED' };

        try {
            await syncLatestStateWithRetry({ maxAttempts: 2, baseDelayMs: 250 });
        } catch (e) {
            // keep rematch flow best-effort; fall through to one retry publish
        }

        if (!isCurrentAppliedGameOver()) {
            return { ok: true, reason: 'ALREADY_REMATCHED' };
        }

        try {
            return await makeRequest();
        } catch (e) {
            return { ok: false, reason: 'REMATCH_REQUEST_FAILED' };
        }
    }

    function getSeatKey() {
        return state.seatKey;
    }

    function getRoomId() {
        return state.roomId;
    }

    function getStateVersion() {
        return state.stateVersion;
    }

    function getRoomSeats() {
        return normalizeRoomSeats(state.roomSeats);
    }

    function getSeatNames() {
        return normalizeSeatNames(state.seatNames);
    }

    function getSeatHandSkins() {
        return normalizeSeatHandSkins(state.seatHandSkins);
    }

    function getRoomDeck() {
        return (state.roomDeck && typeof state.roomDeck === 'object')
            ? Object.assign({}, state.roomDeck)
            : null;
    }

    function getRoomBoardConfig() {
        if (state.active !== true) return null;
        return (state.roomBoardConfig && typeof state.roomBoardConfig === 'object')
            ? cloneReadableNetworkStateValue(state.roomBoardConfig, null)
            : null;
    }

    function setRoomStateListener(listener) {
        state.roomStateListener = (typeof listener === 'function') ? listener : null;
        emitRoomStateChanged();
    }

    function setTurnTimerListener(listener) {
        state.turnTimerListener = (typeof listener === 'function') ? listener : null;
        emitTurnTimerChanged();
    }

    function setChatListener(listener) {
        state.chatListener = (typeof listener === 'function') ? listener : null;
        if (state.chatListener && state.chatHistory.length > 0) {
            emitChatEvent({
                type: 'history',
                messages: state.chatHistory.slice()
            });
        }
    }

    function getChatMaxLength() {
        return CHAT_MAX_LENGTH;
    }

    async function sendChatMessage(text) {
        if (!isActive()) {
            return { ok: false, reason: 'INACTIVE' };
        }
        if (!state.seatToken) {
            return { ok: false, reason: 'SEAT_TOKEN_REQUIRED' };
        }

        const normalizedText = normalizeChatText(text);
        if (!normalizedText) {
            emitStatus('チャットは1文字以上入力してください', true);
            return { ok: false, reason: 'MESSAGE_REQUIRED' };
        }

        if (countTextChars(normalizedText) > CHAT_MAX_LENGTH) {
            emitStatus(`チャットは${CHAT_MAX_LENGTH}文字以内で入力してください`, true);
            return { ok: false, reason: 'MESSAGE_TOO_LONG' };
        }

        const payload = {
            roomId: state.roomId,
            seatKey: state.seatKey,
            seatToken: state.seatToken,
            message: normalizedText
        };

        const res = await requestJson('POST', '/api/match/chat', payload);
        if (!res.ok || !res.data || res.data.ok !== true) {
            const reason = (res.data && res.data.reason) || 'CHAT_SEND_FAILED';
            applyPayloadSessionState(res.data);

            if (reason === 'CHAT_DISABLED') {
                emitStatus('チャットは2人そろってから利用できます', true);
            } else if (reason === 'MESSAGE_TOO_LONG') {
                emitStatus(`チャットは${CHAT_MAX_LENGTH}文字以内で入力してください`, true);
            } else if (reason === 'MESSAGE_REQUIRED') {
                emitStatus('チャットは1文字以上入力してください', true);
            } else if (isMatchApiMissing(res)) {
                emitStatus('ネット対戦: チャットAPI(/api/match/chat)が見つかりません', true);
            } else {
                emitStatus('チャット送信に失敗しました', true);
            }

            return { ok: false, reason };
        }

        applyPayloadSessionState(res.data);

        return {
            ok: true,
            message: normalizeChatMessage(res.data.message)
        };
    }

    async function updateHandSkin(selectedHandSkinId) {
        if (!isActive()) {
            return { ok: false, reason: 'INACTIVE' };
        }
        if (!state.seatToken) {
            return { ok: false, reason: 'SEAT_TOKEN_REQUIRED' };
        }

        const payload = {
            roomId: state.roomId,
            seatKey: state.seatKey,
            seatToken: state.seatToken,
            selectedHandSkinId: String(selectedHandSkinId || readSelectedHandSkinId()).trim() || 'default'
        };

        const res = await requestJson('POST', '/api/match/hand-skin', payload);
        if (!res.ok || !res.data || res.data.ok !== true) {
            const reason = (res.data && res.data.reason) || 'HAND_SKIN_UPDATE_FAILED';
            applyPayloadSessionState(res.data);

            if (isMatchApiMissing(res)) {
                emitStatus('ネット対戦: 手スキン同期API(/api/match/hand-skin)が見つかりません', true);
            } else if (reason === 'SEAT_NOT_JOINED') {
                emitStatus('ネット対戦: 部屋参加後に手の見た目を同期できます', true);
            } else {
                emitStatus('ネット対戦: 手の見た目の同期に失敗しました', true);
            }

            return { ok: false, reason };
        }

        applyPayloadSessionState(res.data);
        return {
            ok: true,
            seatHandSkins: getSeatHandSkins()
        };
    }

    const api = {
        isActive,
        setStatusWriter,
        setServerUrl,
        getServerUrl,
        setRoomStateListener,
        setTurnTimerListener,
        getRoomSeats,
        getSeatNames,
        getSeatHandSkins,
        hasTwoPlayers,
        setChatListener,
        getChatMaxLength,
        sendChatMessage,
        updateHandSkin,
        createRoom,
        joinRoom,
        leaveRoom,
        syncLatestState,
        publishSnapshot,
        requestRematch,
        applySnapshot,
        getSeatKey,
        getRoomId,
        getState,
        getStateVersion,
        getRoomDeck,
        getRoomBoardConfig,
        getNetworkTelemetry
    };
export = api;
