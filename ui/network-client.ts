import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const addLog: (...args: any[]) => any;
declare const isGameOver: (...args: any[]) => any;

const root: any = (typeof window !== 'undefined' ? window : globalThis);

function resolveNetworkClientModule(requirePath: string, fallbackValue: any): any {
    try {
        const mod = _require(requirePath);
        if (mod) return mod;
    } catch (e: any) { /* ignore */ }
    return fallbackValue || null;
}

function resolveNetworkClientGlobal(globalKey: string): any {
    try {
        if (root && root[globalKey]) {
            return root[globalKey];
        }
    } catch (e: any) { /* ignore */ }

    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any)[globalKey]) {
            return (globalThis as any)[globalKey];
        }
    } catch (e: any) { /* ignore */ }

    return null;
}

function resolveNetworkClientCandidate(readCandidate: () => any): any {
    try {
        const candidate = readCandidate();
        if (candidate) return candidate;
    } catch (e: any) { /* ignore */ }
    return null;
}

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
    const PlaybackStateModule = resolveNetworkClientModule('./playback-state-manager', root.PlaybackStateManager || null);
    const NetworkGameContractAdapterModule = resolveNetworkClientModule('./network/game-contract-adapter', root.NetworkGameContractAdapter || null);
    const ResultOverlayModule = resolveNetworkClientModule('./result-overlay', root || null);
    const NetworkGameContract = NetworkGameContractAdapterModule
        && typeof NetworkGameContractAdapterModule.createNetworkGameContractAdapter === 'function'
        ? NetworkGameContractAdapterModule.createNetworkGameContractAdapter({ root })
        : null;

    function resolvePendingSelectionContract(cardType: any) {
        return NetworkGameContract && typeof NetworkGameContract.getPendingSelectionContract === 'function'
            ? NetworkGameContract.getPendingSelectionContract(cardType)
            : null;
    }

    function shouldDeferNetworkPublishForPendingType(cardType: any) {
        return NetworkGameContract && typeof NetworkGameContract.shouldDeferNetworkPublishForPendingType === 'function'
            ? NetworkGameContract.shouldDeferNetworkPublishForPendingType(cardType) === true
            : false;
    }

    function syncPendingSelectionActionCache(pendingEffectByPlayer: any) {
        const syncOptions: any = {};
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
        } catch (e: any) { /* ignore */ }
        return NetworkGameContract && typeof NetworkGameContract.syncPendingSelectionActionCache === 'function'
            ? NetworkGameContract.syncPendingSelectionActionCache(
                pendingEffectByPlayer,
                syncOptions.preservePlayerKeys ? syncOptions : undefined
            )
            : {
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

    function resetNetworkResultPresentationState(resultState: any) {
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
        } catch (e: any) { /* ignore */ }
        return false;
    }

    function clearBoardUpdateContext() {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.clearBoardUpdateContext === 'function') {
                PlaybackStateModule.clearBoardUpdateContext();
            }
        } catch (e: any) { /* ignore */ }
    }

    function clearPlaybackStateForLeave() {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.abortPlayback === 'function') {
                PlaybackStateModule.abortPlayback();
                return;
            }
        } catch (e: any) { /* ignore */ }
        clearBoardUpdateContext();
    }

    function armSuppressDiffBoardUpdateContext(reason: any) {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.armBoardUpdateContext === 'function') {
                PlaybackStateModule.armBoardUpdateContext({
                    suppressFallbackFlip: true,
                    source: 'network-client',
                    reason: reason || 'self_snapshot_sync'
                });
            }
        } catch (e: any) { /* ignore */ }
    }

    function armBoardUpdateDuringPlayback(context: any) {
        const syncContext = {
            ...(context && typeof context === 'object' ? context : {}),
            allowBoardUpdateDuringPlayback: true
        };
        try {
            const BoardUpdateSyncRuntime = resolveNetworkClientModule(
                './board-update-sync-runtime',
                resolveNetworkClientGlobal('BoardUpdateSyncRuntime')
            );
            if (BoardUpdateSyncRuntime && typeof BoardUpdateSyncRuntime.armBoardUpdateSyncContext === 'function') {
                BoardUpdateSyncRuntime.armBoardUpdateSyncContext(syncContext);
                return true;
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (root && typeof root === 'object') {
                root.__boardUpdateSyncContext = { ...syncContext };
                return true;
            }
        } catch (e: any) { /* ignore */ }
        return false;
    }

    function shouldClearStaleBoardUpdateContext(options: any) {
        const opts = options || {};
        if (opts.force !== true) return false;
        if (opts.boardUpdateContext && typeof opts.boardUpdateContext === 'object') return false;
        if (Array.isArray(opts.playbackEvents) && opts.playbackEvents.length > 0) return false;
        if (Array.isArray(opts.shadowPlaybackEvents) && opts.shadowPlaybackEvents.length > 0) return false;
        return getPlaybackActive() !== true;
    }

    function normalizeRoomId(value: any) {
        const roomId = String(value || '').trim().toUpperCase();
        return roomId;
    }

    function normalizeServerUrl(value: any) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (/^https?:\/\//i.test(raw)) {
            return raw.replace(/\/+$/, '');
        }
        try {
            const protocol = (typeof location !== 'undefined' && /^https?:$/.test(location.protocol)) ? location.protocol : 'http:';
            return `${protocol}//${raw}`.replace(/\/+$/, '');
        } catch (e: any) {
            return `http://${raw}`.replace(/\/+$/, '');
        }
    }

    function resolveTimerHost() {
        try {
            if (root && typeof root.setTimeout === 'function' && typeof root.clearTimeout === 'function') {
                return root;
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && typeof (globalThis as any).setTimeout === 'function' && typeof (globalThis as any).clearTimeout === 'function') {
                return globalThis;
            }
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function scheduleTimeout(callback: any, ms: any) {
        const host = resolveTimerHost();
        if (!host || typeof host.setTimeout !== 'function') return 0;
        return host.setTimeout(callback, ms);
    }

    function clearScheduledTimeout(handle: any) {
        if (!handle) return;
        const host = resolveTimerHost();
        if (!host || typeof host.clearTimeout !== 'function') return;
        try { host.clearTimeout(handle); } catch (e: any) { /* ignore */ }
    }

    function deriveSameOriginServerUrl() {
        try {
            if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && location.origin) {
                return withTrailingSlashRemoved(location.origin);
            }
        } catch (e: any) { /* ignore */ }
        return DEFAULT_SERVER_URL;
    }

    function isLoopbackServerUrl(url: string) {
        if (!url) return false;
        try {
            const parsed = new URL(url);
            const host = String(parsed.hostname || '').toLowerCase();
            return host === '127.0.0.1' || host === 'localhost' || host === '::1';
        } catch (e: any) {
            return false;
        }
    }

    function deriveInitialServerUrl() {
        try {
            if (typeof location !== 'undefined' && location.search) {
                const params = new URLSearchParams(location.search);
                const byQuery = normalizeServerUrl(params.get('matchServer') || '');
                if (byQuery) return byQuery;
            }
        } catch (e: any) { /* ignore */ }

        try {
            const byWindow = normalizeServerUrl(root.MATCH_SERVER_URL || '');
            if (byWindow) return byWindow;
        } catch (e: any) { /* ignore */ }

        try {
            if (typeof localStorage !== 'undefined') {
                const byStorage = normalizeServerUrl(localStorage.getItem(SERVER_URL_STORAGE_KEY) || '');
                if (byStorage) {
                    try {
                        if (
                            typeof location !== 'undefined' &&
                            location &&
                            String(location.protocol || '') === 'https:' &&
                            isLoopbackServerUrl(byStorage)
                        ) {
                            return deriveSameOriginServerUrl();
                        }
                    } catch (e: any) { /* ignore */ }
                    return byStorage;
                }
            }
        } catch (e: any) { /* ignore */ }

        try {
            if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) && location.hostname) {
                return deriveSameOriginServerUrl();
            }
        } catch (e: any) { /* ignore */ }

        return deriveSameOriginServerUrl();
    }

    const initialResultPresentationState = createInitialResultPresentationState();
    const state = {
        active: false,
        roomId: '',
        viewerRole: 'seat',
        spectatorId: '',
        spectatorToken: '',
        spectatorName: '',
        seatKey: 'black',
        seatToken: '',
        roomSeats: { black: false, white: false },
        seatNames: { black: '', white: '' },
        seatHandSkins: { black: '', white: '' },
        roomDeck: null,
        roomBoardConfig: null,
        networkDebugEnabled: false,
        serverUrl: deriveInitialServerUrl(),
        stateVersion: null as any,
        eventSource: null as any,
        lastStreamActivityAt: 0,
        lastStreamEventId: '',
        streamWatchdogTimerId: 0,
        statusWriter: null as any,
        roomStateListener: null as any,
        chatListener: null as any,
        chatHistory: [] as any[],
        publishChain: Promise.resolve() as any,
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
            turnStartedAt: null as any,
            turnDeadlineAt: null as any
        },
        turnTimerListener: null as any,
        turnTimerTickHandle: 0,
        turnTimerSyncRequestedDeadline: null as any,
        serverTimeOffsetMs: 0,
        heartbeatResyncInFlight: false,
        reconnectRecoveryTimerId: null as any,
        reconnectRecoveryPending: false,
        appliedStateVersion: null as any,
        pendingForceSyncPlaybackVersion: null as any,
        pendingForceSyncPlaybackSource: '',
        pendingForceSyncPlaybackSignature: '',
        lastStateSyncRecoveredPlaybackSignature: '',
        authoritativeMatchState: {
            gameState: null as any,
            cardState: null as any,
            stateVersion: null as any,
            authority: null as any,
            projectedForSeat: null as any,
            turnStartReconciled: false,
            projectedSnapshotHash: null as any,
            lastAppliedProjectedSnapshotHash: null as any
        },
        localPresentationState: {
            preservedQueues: null,
            lastPlaybackEvents: [],
            busy: false,
            playbackSuppressed: false
        },
        networkTelemetry: {
            counts: {} as any,
            recentEvents: [] as any[]
        }
    };

    let networkCommentaryModule: any = null;
    let networkActionSchemaModule: any = null;
    let networkPublishRequestModule: any = null;
    let networkPublishFlowModule: any = null;
    let networkSnapshotModule: any = null;
    let networkSessionSeatModule: any = null;
    let networkSessionLifecycleModule: any = null;
    let networkCommandPayloadModule: any = null;
    let networkActionBridgeModule: any = null;
    let networkApplyCoordinatorModule: any = null;
    let networkReconnectControllerModule: any = null;
    let networkPublishTrackerModule: any = null;
    let networkPublishRejectionModule: any = null;
    let networkPlaybackRecoveryModule: any = null;
    let networkRoomEventsModule: any = null;
    let networkStreamSnapshotModule: any = null;
    let networkStreamSessionModule: any = null;
    let networkTransportModule: any = null;
    let networkTurnTimerModule: any = null;
    let cardLogicModule: any = null;
    let networkCommentaryController: any = null;
    let networkSnapshotController: any = null;
    let networkSessionSeatController: any = null;
    let networkSessionLifecycleController: any = null;
    let networkActionBridgeController: any = null;
    let networkReconnectController: any = null;
    let networkPublishTrackerController: any = null;
    let networkPublishRejectionController: any = null;
    let networkPlaybackRecoveryController: any = null;
    let networkRoomEventsController: any = null;
    let networkStreamSnapshotController: any = null;
    let networkStreamSessionController: any = null;
    let networkTransportController: any = null;
    let networkTurnTimerController: any = null;
    let networkPublishFlowController: any = null;
    let ownerHelpers: any = null;
    networkCommentaryModule = resolveNetworkClientModule('./network/commentary', null);
    networkActionSchemaModule = resolveNetworkClientModule('../shared/network-action-schema', null);
    networkPublishRequestModule = resolveNetworkClientModule('./network/publish-request', null);
    networkPublishFlowModule = resolveNetworkClientModule('./network/publish-flow', null);
    networkSnapshotModule = resolveNetworkClientModule('./network/snapshot', null);
    networkSessionSeatModule = resolveNetworkClientModule('./network/session-seat', null);
    networkSessionLifecycleModule = resolveNetworkClientModule('./network/session-lifecycle', null);
    networkCommandPayloadModule = resolveNetworkClientModule('./network/command-payload', null);
    networkActionBridgeModule = resolveNetworkClientModule('./network/action-bridge', null);
    networkApplyCoordinatorModule = resolveNetworkClientModule('./network/apply-coordinator', null);
    networkReconnectControllerModule = resolveNetworkClientModule('./network/reconnect-controller', null);
    networkPublishTrackerModule = resolveNetworkClientModule('./network/publish-tracker', null);
    networkPublishRejectionModule = resolveNetworkClientModule('./network/publish-rejection', null);
    networkPlaybackRecoveryModule = resolveNetworkClientModule('./network/playback-recovery', null);
    networkRoomEventsModule = resolveNetworkClientModule('./network/room-events', null);
    networkStreamSnapshotModule = resolveNetworkClientModule('./network/stream-snapshot', null);
    networkStreamSessionModule = resolveNetworkClientModule('./network/stream-session', null);
    networkTransportModule = resolveNetworkClientModule('./network/transport', null);
    networkTurnTimerModule = resolveNetworkClientModule('./network/turn-timer', null);

    function resolveNetworkCommentaryModule() {
        if (networkCommentaryModule) return networkCommentaryModule;

        networkCommentaryModule = resolveNetworkClientGlobal('NetworkCommentaryModule');
        return networkCommentaryModule;
    }

    function resolveNetworkActionSchemaModule() {
        if (networkActionSchemaModule) return networkActionSchemaModule;

        networkActionSchemaModule = resolveNetworkClientGlobal('NetworkActionSchema');
        return networkActionSchemaModule;
    }

    function resolveNetworkSnapshotModule() {
        if (networkSnapshotModule) return networkSnapshotModule;

        networkSnapshotModule = resolveNetworkClientGlobal('NetworkSnapshotModule');
        return networkSnapshotModule;
    }

    function resolveNetworkSessionSeatModule() {
        if (networkSessionSeatModule) return networkSessionSeatModule;

        networkSessionSeatModule = resolveNetworkClientGlobal('NetworkSessionSeatModule');
        return networkSessionSeatModule;
    }

    function resolveNetworkSessionLifecycleModule() {
        if (networkSessionLifecycleModule) return networkSessionLifecycleModule;

        networkSessionLifecycleModule = resolveNetworkClientGlobal('NetworkSessionLifecycleModule');
        return networkSessionLifecycleModule;
    }

    function resolveNetworkCommandPayloadModule() {
        if (networkCommandPayloadModule) return networkCommandPayloadModule;

        networkCommandPayloadModule = resolveNetworkClientGlobal('NetworkCommandPayloadModule');
        return networkCommandPayloadModule;
    }

    function resolveNetworkActionBridgeModule() {
        if (networkActionBridgeModule) return networkActionBridgeModule;

        networkActionBridgeModule = resolveNetworkClientGlobal('NetworkActionBridgeModule');
        return networkActionBridgeModule;
    }

    function resolveNetworkApplyCoordinatorModule() {
        if (networkApplyCoordinatorModule) return networkApplyCoordinatorModule;

        networkApplyCoordinatorModule = resolveNetworkClientGlobal('NetworkApplyCoordinatorModule');
        return networkApplyCoordinatorModule;
    }

    function resolveNetworkReconnectControllerModule() {
        if (networkReconnectControllerModule) return networkReconnectControllerModule;

        networkReconnectControllerModule = resolveNetworkClientGlobal('NetworkReconnectControllerModule');
        return networkReconnectControllerModule;
    }

    function resolveNetworkPublishTrackerModule() {
        if (networkPublishTrackerModule) return networkPublishTrackerModule;

        networkPublishTrackerModule = resolveNetworkClientGlobal('NetworkPublishTrackerModule');
        return networkPublishTrackerModule;
    }

    function resolveNetworkPublishRejectionModule() {
        if (networkPublishRejectionModule) return networkPublishRejectionModule;

        networkPublishRejectionModule = resolveNetworkClientGlobal('NetworkPublishRejectionModule');
        return networkPublishRejectionModule;
    }

    function resolveNetworkPlaybackRecoveryModule() {
        if (networkPlaybackRecoveryModule) return networkPlaybackRecoveryModule;

        networkPlaybackRecoveryModule = resolveNetworkClientGlobal('NetworkPlaybackRecoveryModule');
        return networkPlaybackRecoveryModule;
    }

    function resolveNetworkRoomEventsModule() {
        if (networkRoomEventsModule) return networkRoomEventsModule;

        networkRoomEventsModule = resolveNetworkClientGlobal('NetworkRoomEventsModule');
        return networkRoomEventsModule;
    }

    function resolveNetworkStreamSnapshotModule() {
        if (networkStreamSnapshotModule) return networkStreamSnapshotModule;

        networkStreamSnapshotModule = resolveNetworkClientGlobal('NetworkStreamSnapshotModule');
        return networkStreamSnapshotModule;
    }

    function resolveNetworkStreamSessionModule() {
        if (networkStreamSessionModule) return networkStreamSessionModule;

        networkStreamSessionModule = resolveNetworkClientGlobal('NetworkStreamSessionModule');
        return networkStreamSessionModule;
    }

    function resolveNetworkTransportModule() {
        if (networkTransportModule) return networkTransportModule;

        networkTransportModule = resolveNetworkClientGlobal('NetworkTransportModule');
        return networkTransportModule;
    }

    function resolveNetworkTurnTimerModule() {
        if (networkTurnTimerModule) return networkTurnTimerModule;

        networkTurnTimerModule = resolveNetworkClientGlobal('NetworkTurnTimerModule');
        return networkTurnTimerModule;
    }

    function resolveCardLogicModule() {
        if (cardLogicModule) return cardLogicModule;

        cardLogicModule = resolveNetworkClientCandidate(() => _require('../game/logic/cards'))
            || resolveNetworkClientCandidate(() => root && root.CardLogic)
            || resolveNetworkClientCandidate(() => (typeof globalThis !== 'undefined' ? (globalThis as any).CardLogic : null));
        return cardLogicModule;
    }

    function resolveNetworkPublishRequestModule() {
        if (networkPublishRequestModule) return networkPublishRequestModule;

        networkPublishRequestModule = resolveNetworkClientGlobal('NetworkPublishRequestModule');
        return networkPublishRequestModule;
    }

    function resolveNetworkPublishFlowModule() {
        if (networkPublishFlowModule) return networkPublishFlowModule;

        networkPublishFlowModule = resolveNetworkClientCandidate(() => _require('./network/publish-flow'))
            || resolveNetworkClientGlobal('NetworkPublishFlowModule');
        return networkPublishFlowModule;
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
            onTelemetry: (type: any, details: any) => recordNetworkTelemetry(type, details),
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
            prepareSessionActivation: (payload: any) => {
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
            updateTurnTimerFromPayload: (payload: any) => updateTurnTimerFromPayload(payload),
            ensureActionBridge: () => ensureActionBridge(),
            applySnapshot: (snapshot: any, options: any) => applySnapshot(snapshot, options),
            resetResultPresentationState: (resultState: any) => resetNetworkResultPresentationState(resultState),
            getServerUrl
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
            readStoredSession,
            clearSeatClaim,
            clearStoredSession,
            activateStoredSession,
            shouldRetryJoinWithoutStoredClaim,
            activateSessionFromResponse,
            activateSpectatorSessionFromResponse,
            resetNetworkTelemetry,
            openStream,
            getKnownProjectedSnapshotHash,
            applyPayloadSessionState,
            shouldSkipForceSyncSnapshot,
            resolveStateSyncRecoveredPlaybackEvents,
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
            resolveCardTypeForId: (cardId: any) => (
                NetworkGameContract && typeof NetworkGameContract.resolveCardTypeForId === 'function'
                    ? NetworkGameContract.resolveCardTypeForId(cardId)
                    : null
            ),
            getPendingEffectType: (cardStateValue: any, playerKey: any) => (
                NetworkGameContract && typeof NetworkGameContract.getPendingEffectType === 'function'
                    ? NetworkGameContract.getPendingEffectType(cardStateValue, playerKey, normalizePlayerKey)
                    : null
            ),
            queueCommandPublish: (playerKey: any, action: any, options: any) => queueCommandPublish(playerKey, action, options),
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
            openStream: (options: any) => openStream(options),
            syncLatestStateWithRetry: (options: any) => syncLatestStateWithRetry(options),
            recordNetworkTelemetry: (type: any, details: any) => recordNetworkTelemetry(type, details),
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

    function getNetworkPublishRejectionController() {
        if (networkPublishRejectionController) return networkPublishRejectionController;
        const mod = resolveNetworkPublishRejectionModule();
        if (!mod || typeof mod.createNetworkPublishRejectionController !== 'function') return null;
        networkPublishRejectionController = mod.createNetworkPublishRejectionController({
            getState: () => state,
            hasNewerQueuedPublish,
            getCurrentPublishTurnIndex,
            getSnapshotStateVersion,
            shouldSkipForceSyncSnapshot
        });
        return networkPublishRejectionController;
    }

    function getNetworkPlaybackRecoveryController() {
        if (networkPlaybackRecoveryController) return networkPlaybackRecoveryController;
        const mod = resolveNetworkPlaybackRecoveryModule();
        if (!mod || typeof mod.createNetworkPlaybackRecoveryController !== 'function') return null;
        networkPlaybackRecoveryController = mod.createNetworkPlaybackRecoveryController({
            getState: () => state,
            cloneData: cloneDataForCommandPayload,
            getCurrentSnapshotForPublish,
            getTrackedPublishRequestedPlaybackEvents,
            getSnapshotStateVersion,
            getAppliedStateVersion,
            shouldSkipForceSyncSnapshot
        });
        return networkPlaybackRecoveryController;
    }

    function getNetworkRoomEventsController() {
        if (networkRoomEventsController) return networkRoomEventsController;
        const mod = resolveNetworkRoomEventsModule();
        if (!mod || typeof mod.createNetworkRoomEventsController !== 'function') return null;
        networkRoomEventsController = mod.createNetworkRoomEventsController({
            getState: () => state,
            normalizePlayerKey,
            chatHistoryLimit: CHAT_HISTORY_LIMIT,
            applyPayloadSessionState,
            emitStatusAndEffectLog,
            getSeatDisplayName
        });
        return networkRoomEventsController;
    }

    function getNetworkStreamSnapshotController() {
        if (networkStreamSnapshotController) return networkStreamSnapshotController;
        const mod = resolveNetworkStreamSnapshotModule();
        if (!mod || typeof mod.createNetworkStreamSnapshotController !== 'function') return null;
        networkStreamSnapshotController = mod.createNetworkStreamSnapshotController({
            getState: () => state,
            applyPayloadSessionState,
            getSnapshotStateVersion,
            findTrackedPublish,
            isTerminalSnapshotForResult,
            shouldApplyStreamSnapshotAsShadowPlayback,
            buildShadowAwarePlaybackApplyOptions,
            applySnapshotThroughCoordinator,
            shouldRecoverForceSyncedStreamPlayback,
            applySnapshot,
            markTrackedPublishSnapshotApplied,
            recordNetworkTelemetry,
            consumePendingForceSyncPlaybackRecovery,
            markTrackedPublishResultPresented,
            emitPayloadEffectLogs,
            emitSnapshotCommentary,
            markTrackedPublishSelfSnapshot,
            handleTimeoutPassPayload,
            pruneTrackedPublishes
        });
        return networkStreamSnapshotController;
    }

    function getNetworkStreamSessionController() {
        if (networkStreamSessionController) return networkStreamSessionController;
        const mod = resolveNetworkStreamSessionModule();
        if (!mod || typeof mod.createNetworkStreamSessionController !== 'function') return null;
        networkStreamSessionController = mod.createNetworkStreamSessionController({
            getState: () => state,
            withTrailingSlashRemoved,
            closeExistingStream: () => closeStream(),
            emitStatus,
            createStreamPayloadHandler,
            markStreamActivity,
            scheduleStreamWatchdog,
            clearReconnectTimer,
            scheduleReconnectRecoverySync,
            scheduleStreamReconnect,
            completeReconnectRecoveryFromStream,
            handlePresencePayload,
            handleChatPayload,
            handleStreamSnapshotPayload,
            applyPayloadSessionState,
            maybeSyncFromHeartbeat,
            isActive
        });
        return networkStreamSessionController;
    }

    function getNetworkTransportController() {
        if (networkTransportController) return networkTransportController;
        const mod = resolveNetworkTransportModule();
        if (!mod || typeof mod.createNetworkTransportController !== 'function') return null;
        networkTransportController = mod.createNetworkTransportController({
            getState: () => state,
            withTrailingSlashRemoved,
            scheduleTimeout,
            clearScheduledTimeout,
            requestTimeoutMs: REQUEST_TIMEOUT_MS,
            publishRetryMaxAttempts: PUBLISH_RETRY_MAX_ATTEMPTS,
            publishRetryBaseDelayMs: PUBLISH_RETRY_BASE_DELAY_MS,
            publishRetryMaxDelayMs: PUBLISH_RETRY_MAX_DELAY_MS,
            computeRetryDelayMs
        });
        return networkTransportController;
    }

    function getNetworkTurnTimerController() {
        if (networkTurnTimerController) return networkTurnTimerController;
        const mod = resolveNetworkTurnTimerModule();
        if (!mod || typeof mod.createNetworkTurnTimerController !== 'function') return null;
        networkTurnTimerController = mod.createNetworkTurnTimerController({
            getState: () => state,
            normalizePlayerKey,
            defaultLimitSeconds: TURN_TIMER_DEFAULT_LIMIT,
            scheduleTimeout,
            clearScheduledTimeout,
            isActive,
            syncLatestState
        });
        return networkTurnTimerController;
    }

    function getNetworkPublishFlowController() {
        if (networkPublishFlowController) return networkPublishFlowController;
        const mod = resolveNetworkPublishFlowModule();
        if (!mod || typeof mod.createNetworkPublishFlowController !== 'function') return null;
        networkPublishFlowController = mod.createNetworkPublishFlowController({
            getState: () => state,
            isActive,
            normalizePlayerKey,
            emitStatus,
            createOperationId,
            resolveNetworkPublishRequestModule,
            getCurrentPublishTurnIndex,
            buildPublishCommandPayload,
            sanitizePlaybackEventsForPublish,
            getSnapshotMeta,
            createTrackedPublish,
            settleTrackedPublish,
            markTrackedPublishInFlight,
            publishRequestWithRetry,
            getKnownProjectedSnapshotHash,
            applyPayloadSessionState,
            resolveRejectedPublishSnapshotHandling,
            getVersionConflictTelemetryKey,
            recordNetworkTelemetry,
            applySnapshotThroughCoordinator,
            rememberPendingForceSyncPlaybackRecovery,
            shouldRetryVersionConflictPublish,
            syncLatestStateWithRetry,
            buildVersionConflictRetryPayload,
            getAppliedStateVersion,
            markTrackedPublishResponse,
            shouldSkipPublishResponseSnapshot,
            shouldApplyPublishResponseAsShadowPlayback,
            buildShadowAwarePlaybackApplyOptions,
            hasTrackedPublishPresentedResult,
            emitPayloadEffectLogs,
            pruneTrackedPublishes,
            getSnapshotStateVersion
        });
        return networkPublishFlowController;
    }

    function invokeControllerMethod(resolveController: any, methodName: any, argsLike: any, fallback: any) {
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
        return resolveNetworkClientCandidate(() => root && root.HandSkinUiModule)
            || resolveNetworkClientCandidate(() => _require('./handlers/hand-skin'))
            || resolveNetworkClientCandidate(() => (typeof globalThis !== 'undefined' ? (globalThis as any).HandSkinUiModule : null));
    }

    function resolveHandSkinStorageModules() {
        return resolveNetworkClientCandidate(() => ({
            shared: _require('../shared/observation-gacha-catalog-shared'),
            progress: _require('./storage/gacha-progress')
        }));
    }

    function resolveOwnerHelpers() {
        if (ownerHelpers) return ownerHelpers;

        ownerHelpers = resolveNetworkClientCandidate(() => root && root.OwnerHelpers)
            || resolveNetworkClientCandidate(() => _require('../utils/owner-helpers'))
            || resolveNetworkClientCandidate(() => (typeof globalThis !== 'undefined' ? (globalThis as any).OwnerHelpers : null));
        return ownerHelpers;
    }

    function normalizePlayerKey(value: any) {
        try {
            const schema = resolveNetworkActionSchemaModule();
            if (schema && typeof schema.normalizePlayerKey === 'function') {
                return schema.normalizePlayerKey(value, 'black');
            }
        } catch (e: any) { /* ignore */ }

        try {
            const helpers = resolveOwnerHelpers();
            if (helpers && typeof helpers.normalizePlayerKey === 'function') {
                return helpers.normalizePlayerKey(value, 'black');
            }
        } catch (e: any) { /* ignore */ }

        const normalized = (value === null || typeof value === 'undefined')
            ? ''
            : String(value).trim().toLowerCase();

        if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
        if (value === 1 || normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
        return 'black';
    }

    function cloneDataForCommandPayload(value: any) {
        try {
            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).structuredClone === 'function') {
                return (globalThis as any).structuredClone(value);
            }
        } catch (e: any) { /* ignore */ }
        return JSON.parse(JSON.stringify(value));
    }

    function createNetworkTelemetryState(): any {
        return {
            counts: {},
            recentEvents: []
        };
    }

    function resetNetworkTelemetry() {
        state.networkTelemetry = createNetworkTelemetryState();
    }

    function recordNetworkTelemetry(type: any, details: any) {
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

        let safeDetails: any = null;
        if (details && typeof details === 'object') {
            try {
                safeDetails = cloneDataForCommandPayload(details);
            } catch (e: any) {
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
            emitNetworkDebugConsole(eventType, safeDetails);
        }
    }

    function getNetworkTelemetry() {
        try {
            return cloneDataForCommandPayload(state.networkTelemetry || createNetworkTelemetryState());
        } catch (e: any) {
            return createNetworkTelemetryState();
        }
    }

    function cloneReadableNetworkStateValue(value: any, fallbackValue: any) {
        if (typeof value === 'undefined') return fallbackValue;
        try {
            return cloneDataForCommandPayload(value);
        } catch (e: any) {
            return fallbackValue;
        }
    }

    function cloneTrackedPublishRequestMeta(requestMeta: any) {
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
            localPlaybackEmitted: requestMeta.localPlaybackEmitted === true,
            usedSnapshotFallback: requestMeta.usedSnapshotFallback === true,
            snapshotProjectedHash: (typeof requestMeta.snapshotProjectedHash === 'string' && requestMeta.snapshotProjectedHash)
                ? requestMeta.snapshotProjectedHash
                : null
        };
    }

    function cloneTrackedPublishEntry(entry: any) {
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
            ? tracker.operations.map((entry: any) => cloneTrackedPublishEntry(entry)).filter((entry: any) => !!entry)
            : [];
        return {
            active: state.active === true,
            roomId: String(state.roomId || ''),
            viewerRole: isSpectator() ? 'spectator' : 'seat',
            spectatorId: isSpectator() ? String(state.spectatorId || '') : '',
            spectatorName: isSpectator() ? String(state.spectatorName || '') : '',
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

    function getSnapshotStateVersion(snapshot: any) {
        const meta = getSnapshotMeta(snapshot);
        if (meta && meta.version !== null) return meta.version;
        return Number.isFinite(Number(snapshot && snapshot.stateVersion))
            ? Number(snapshot.stateVersion)
            : null;
    }

    function getSnapshotMeta(snapshot: any) {
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
            : ((typeof globalThis !== 'undefined' && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object')
                ? (globalThis as any).cardState
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
            : ((typeof globalThis !== 'undefined' && (globalThis as any).gameState && typeof (globalThis as any).gameState === 'object')
                ? (globalThis as any).gameState
                : null);
        if (liveGameState && Number.isFinite(Number(liveGameState.turnNumber))) {
            return Math.trunc(Number(liveGameState.turnNumber));
        }
        return null;
    }

    function computeForceSyncPlaybackRecoverySignature(snapshot: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.computeForceSyncPlaybackRecoverySignature !== 'function') return '';
        return controller.computeForceSyncPlaybackRecoverySignature(snapshot);
    }

    function computeCurrentPlaybackRecoverySignature() {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.computeCurrentPlaybackRecoverySignature !== 'function') return '';
        return controller.computeCurrentPlaybackRecoverySignature();
    }

    function shouldApplyPublishResponseAsShadowPlayback(trackedPublish: any, snapshot: any, playbackEvents: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.shouldApplyPublishResponseAsShadowPlayback !== 'function') return false;
        return controller.shouldApplyPublishResponseAsShadowPlayback(trackedPublish, snapshot, playbackEvents);
    }

    function shouldSkipPublishResponseSnapshot(trackedPublish: any, snapshot: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.shouldSkipPublishResponseSnapshot !== 'function') return false;
        return controller.shouldSkipPublishResponseSnapshot(trackedPublish, snapshot);
    }

    function shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish: any, playbackEvents: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.shouldApplyStreamSnapshotAsShadowPlayback !== 'function') return false;
        return controller.shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish, playbackEvents);
    }

    function buildShadowAwarePlaybackApplyOptions(playbackEvents: any, shouldShadowPlayback: any, shadowPlaybackSource: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.buildShadowAwarePlaybackApplyOptions !== 'function') {
            return {
                playbackEvents: Array.isArray(playbackEvents) ? playbackEvents : [],
                shadowPlaybackEvents: [],
                shadowPlaybackSource: undefined
            };
        }
        return controller.buildShadowAwarePlaybackApplyOptions(playbackEvents, shouldShadowPlayback, shadowPlaybackSource);
    }

    function clearPendingForceSyncPlaybackRecovery() {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.clearPendingForceSyncPlaybackRecovery !== 'function') return;
        controller.clearPendingForceSyncPlaybackRecovery();
    }

    function rememberPendingForceSyncPlaybackRecovery(snapshot: any, options: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.rememberPendingForceSyncPlaybackRecovery !== 'function') return false;
        return controller.rememberPendingForceSyncPlaybackRecovery(snapshot, options);
    }

    function consumePendingForceSyncPlaybackRecovery(snapshotOrVersion: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.consumePendingForceSyncPlaybackRecovery !== 'function') return false;
        return controller.consumePendingForceSyncPlaybackRecovery(snapshotOrVersion);
    }

    function shouldRecoverForceSyncedStreamPlayback(snapshot: any, playbackEvents: any) {
        const controller = getNetworkPlaybackRecoveryController();
        if (!controller || typeof controller.shouldRecoverForceSyncedStreamPlayback !== 'function') return false;
        return controller.shouldRecoverForceSyncedStreamPlayback(snapshot, playbackEvents);
    }

    function isVersionConflictReason(reasonValue: any) {
        const controller = getNetworkPublishRejectionController();
        if (!controller || typeof controller.isVersionConflictReason !== 'function') return false;
        return controller.isVersionConflictReason(reasonValue);
    }

    function getVersionConflictTelemetryKey(reasonValue: any) {
        const controller = getNetworkPublishRejectionController();
        if (!controller || typeof controller.getVersionConflictTelemetryKey !== 'function') return '';
        return controller.getVersionConflictTelemetryKey(reasonValue);
    }

    function shouldRetryVersionConflictPublish(reasonValue: any, actionTypeValue: any, trackedPublish: any) {
        const controller = getNetworkPublishRejectionController();
        if (!controller || typeof controller.shouldRetryVersionConflictPublish !== 'function') return false;
        return controller.shouldRetryVersionConflictPublish(reasonValue, actionTypeValue, trackedPublish);
    }

    function buildVersionConflictRetryPayload(payload: any) {
        const controller = getNetworkPublishRejectionController();
        if (!controller || typeof controller.buildVersionConflictRetryPayload !== 'function') return Object.assign({}, payload);
        return controller.buildVersionConflictRetryPayload(payload);
    }

    function buildStateSyncRecoveredPlaybackSignature(payload: any, playbackEvents: any[]) {
        const source = payload && typeof payload === 'object' ? payload : {};
        const snapshot = source.snapshot && typeof source.snapshot === 'object' ? source.snapshot : null;
        const snapshotVersion = snapshot ? getSnapshotStateVersion(snapshot) : null;
        const signaturePayload = {
            stateVersion: Number.isFinite(Number(source.stateVersion)) ? Number(source.stateVersion) : snapshotVersion,
            operationId: source.operationId ? String(source.operationId) : '',
            playbackEvents
        };
        try {
            return JSON.stringify(cloneDataForCommandPayload(signaturePayload));
        } catch (e: any) {
            return JSON.stringify({
                stateVersion: signaturePayload.stateVersion,
                operationId: signaturePayload.operationId,
                playbackEventCount: playbackEvents.length
            });
        }
    }

    function resolveStateSyncRecoveredPlaybackEvents(payload: any) {
        const playbackEvents = payload && Array.isArray(payload.playbackEvents) ? payload.playbackEvents : [];
        if (playbackEvents.length <= 0) {
            state.lastStateSyncRecoveredPlaybackSignature = '';
            return [];
        }
        const signature = buildStateSyncRecoveredPlaybackSignature(payload, playbackEvents);
        if (signature && state.lastStateSyncRecoveredPlaybackSignature === signature) {
            recordNetworkTelemetry('state_sync_recovered_playback_deduped', {
                stateVersion: Number.isFinite(Number(payload && payload.stateVersion)) ? Number(payload.stateVersion) : null,
                operationId: payload && payload.operationId ? String(payload.operationId) : null,
                playbackEventCount: playbackEvents.length
            });
            return [];
        }
        state.lastStateSyncRecoveredPlaybackSignature = signature;
        return playbackEvents;
    }

    function resolveRejectedPublishSnapshotHandling(entry: any, payload: any, rejectedReason: any, options: any) {
        const controller = getNetworkPublishRejectionController();
        if (!controller || typeof controller.resolveRejectedPublishSnapshotHandling !== 'function') {
            return { shouldApplySnapshot: false, skipReason: 'publish_rejection_controller_unavailable', snapshotVersion: null, rejectionStateVersion: null, localStateVersionBefore: null, reason: String(rejectedReason || '').trim() || 'PUBLISH_REJECTED' };
        }
        return controller.resolveRejectedPublishSnapshotHandling(entry, payload, rejectedReason, options);
    }

    function buildPublishCommandPayload(info: any, playerKey: any) {
        const moduleRef = resolveNetworkCommandPayloadModule();
        if (!moduleRef || typeof moduleRef.buildPublishCommandPayload !== 'function') {
            return null;
        }
        return moduleRef.buildPublishCommandPayload(info, {
            playerKey,
            normalizePlayerKey,
            applyPendingSelectionCardContext: NetworkGameContract && typeof NetworkGameContract.applyPendingSelectionCardContext === 'function'
                ? NetworkGameContract.applyPendingSelectionCardContext
                : null,
            includePlayerParam: true
        });
    }

    function withTrailingSlashRemoved(url: any) {
        return String(url || '').replace(/\/+$/, '');
    }

    function createOperationId() {
        const nowPart = Date.now().toString(36);
        const randPart = Math.random().toString(36).slice(2, 10);
        return `op_${nowPart}_${randPart}`;
    }

    function readSeatClaim(roomId: any) {
        return invokeControllerMethod(getNetworkSessionSeatController, 'readSeatClaim', arguments, null);
    }

    function writeSeatClaim(roomId: any, seatKey: any, seatToken: any) {
        invokeControllerMethod(getNetworkSessionSeatController, 'writeSeatClaim', arguments, undefined);
    }

    function clearSeatClaim(roomId: any) {
        invokeControllerMethod(getNetworkSessionSeatController, 'clearSeatClaim', arguments, undefined);
    }

    function readStoredSession() {
        return invokeControllerMethod(getNetworkSessionSeatController, 'readStoredSession', arguments, null);
    }

    function clearStoredSession() {
        invokeControllerMethod(getNetworkSessionSeatController, 'clearStoredSession', arguments, undefined);
    }

    function activateStoredSession(session: any) {
        return invokeControllerMethod(getNetworkSessionSeatController, 'activateStoredSession', arguments, false);
    }

    function emitStatus(text: any, isError: any) {
        if (typeof state.statusWriter === 'function') {
            try {
                state.statusWriter(String(text || ''), !!isError);
                return;
            } catch (e: any) { /* ignore */ }
        }
        try {
            if (typeof addLog === 'function') {
                addLog(String(text || ''));
            }
        } catch (e: any) { /* ignore */ }
    }

    function emitEffectLog(text: any) {
        const line = String(text || '').trim();
        if (!line) return;
        try {
            if (root && typeof root.emitEffectLog === 'function' && root.emitEffectLog !== emitEffectLog) {
                root.emitEffectLog(line);
                return;
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (root && typeof root.emitLogAdded === 'function') {
                root.emitLogAdded(line, 'effect');
                return;
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && globalThis && globalThis !== root) {
                if (typeof (globalThis as any).emitEffectLog === 'function' && (globalThis as any).emitEffectLog !== emitEffectLog) {
                    (globalThis as any).emitEffectLog(line);
                    return;
                }
                if (typeof (globalThis as any).emitLogAdded === 'function') {
                    (globalThis as any).emitLogAdded(line, 'effect');
                    return;
                }
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof addLog === 'function') {
                addLog(line);
            }
        } catch (e: any) { /* ignore */ }
    }

    function emitNetworkDebugConsole(eventType: any, details: any) {
        const line = `[network-debug] ${String(eventType || '').trim()}`;
        if (!line || line === '[network-debug]') return;
        try {
            if (typeof console !== 'undefined' && console && typeof console.log === 'function') {
                if (details && typeof details === 'object') {
                    console.log(line, details);
                } else {
                    console.log(line);
                }
            }
        } catch (e: any) { /* ignore */ }
    }

    function getPayloadEffectLogs(payload: any) {
        const source = (payload && Array.isArray(payload.effectLogs)) ? payload.effectLogs : [];
        const normalized: any[] = [];
        for (let index = 0; index < source.length; index += 1) {
            const line = String(source[index] || '').trim();
            if (!line) continue;
            if (normalized.length > 0 && normalized[normalized.length - 1] === line) continue;
            normalized.push(line);
        }
        return normalized;
    }

    function emitPayloadEffectLogs(payload: any) {
        const effectLogs = getPayloadEffectLogs(payload);
        for (let index = 0; index < effectLogs.length; index += 1) {
            emitEffectLog(effectLogs[index]);
        }
        return effectLogs.length;
    }

    function emitStatusAndEffectLog(text: any, isError: any) {
        emitStatus(text, isError);
        if (typeof state.statusWriter === 'function') {
            emitEffectLog(text);
        }
    }

    function emitSnapshotCommentary(payload: any, snapshot: any, isSelfOperation: any, playbackEvents: any) {
        invokeControllerMethod(getNetworkCommentaryController, 'emitSnapshotCommentary', arguments, undefined);
    }

    function getSeatDisplayName(seatKey: any) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'getSeatDisplayName',
            arguments,
            () => (normalizePlayerKey(seatKey) === 'white' ? '白' : '黒')
        );
    }

    function normalizePlayerName(value: any) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'normalizePlayerName',
            arguments,
            () => String(value || '').replace(/\s+/g, ' ').trim()
        );
    }

    function normalizeRoomSeats(value: any) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'normalizeRoomSeats',
            arguments,
            () => ({ black: !!(value && value.black), white: !!(value && value.white) })
        );
    }

    function normalizeSeatNames(value: any) {
        return invokeControllerMethod(
            getNetworkSessionSeatController,
            'normalizeSeatNames',
            arguments,
            () => ({ black: normalizePlayerName(value && value.black), white: normalizePlayerName(value && value.white) })
        );
    }

    function normalizeSeatHandSkins(value: any) {
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

    function updateRoomSeatsFromPayload(payload: any) {
        invokeControllerMethod(getNetworkSessionSeatController, 'updateRoomSeatsFromPayload', arguments, undefined);
    }

    function readSelectedHandSkinId() {
        const handSkinUiModule = resolveHandSkinUiModule();
        if (handSkinUiModule && typeof handSkinUiModule.readStoredHandSkinId === 'function') {
            try {
                const selected = String(handSkinUiModule.readStoredHandSkinId(root)).trim() || 'default';
                if (selected !== 'default') return selected;
            } catch (e: any) { /* ignore */ }
        }
        const storageKey = String((handSkinUiModule && handSkinUiModule.HAND_SKIN_STORAGE_KEY) || 'reversi.handSkin').trim() || 'reversi.handSkin';
        try {
            const storage = root && root.localStorage
                ? root.localStorage
                : (typeof localStorage !== 'undefined' ? localStorage : null);
            if (storage) {
                const raw = String(storage.getItem(storageKey) || '').trim();
                if (!raw) return 'default';
                try {
                    const modules = resolveHandSkinStorageModules();
                    const shared = modules && modules.shared;
                    const canonical = shared && typeof shared.normalizeCatalogItemId === 'function'
                        ? String(shared.normalizeCatalogItemId(raw) || '').trim()
                        : raw;
                    const progress = modules && modules.progress;
                    if (canonical && progress && typeof progress.isHandSkinOwned === 'function' && progress.isHandSkinOwned(root, canonical)) {
                        return canonical;
                    }
                } catch (e: any) { /* ignore */ }
                return raw;
            }
        } catch (e: any) { /* ignore */ }
        return 'default';
    }

    function applyPayloadSessionState(payload: any) {
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
            ? payload.playbackDiagnostics.warnings.filter((warning: any) => String(warning || '').trim())
            : [];
        if (warnings.length > 0) {
            recordNetworkTelemetry('playback_diagnostics_warning', {
                source: payload.type || payload.actionType || 'network_payload',
                warnings
            });
        }
    }

    function maybeSyncFromHeartbeat(payload: any) {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.maybeSyncFromHeartbeat !== 'function') return;
        controller.maybeSyncFromHeartbeat(payload);
    }

    function waitForMs(ms: any) {
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

    function createTrackedPublish(operationId: any, requestMeta: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.createTrackedPublish !== 'function') {
            throw new Error('NetworkPublishTrackerModule unavailable');
        }
        return controller.createTrackedPublish(operationId, requestMeta);
    }

    function getTrackedPublishRequestedPlaybackEvents(entry: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.getTrackedPublishRequestedPlaybackEvents !== 'function') return [];
        return controller.getTrackedPublishRequestedPlaybackEvents(entry);
    }

    function findTrackedPublish(operationId: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.findTrackedPublish !== 'function') return null;
        return controller.findTrackedPublish(operationId);
    }

    function settleTrackedPublish(entry: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.settleTrackedPublish !== 'function') return;
        controller.settleTrackedPublish(entry);
    }

    function markTrackedPublishInFlight(entry: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishInFlight !== 'function') return;
        controller.markTrackedPublishInFlight(entry);
    }

    function markTrackedPublishResponse(entry: any, stateVersionValue: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishResponse !== 'function') return;
        controller.markTrackedPublishResponse(entry, stateVersionValue);
    }

    function markTrackedPublishSelfSnapshot(entry: any, snapshot: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishSelfSnapshot !== 'function') return;
        controller.markTrackedPublishSelfSnapshot(entry, snapshot);
    }

    function markTrackedPublishSnapshotApplied(entry: any, snapshot: any, source: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishSnapshotApplied !== 'function') return;
        controller.markTrackedPublishSnapshotApplied(entry, snapshot, source);
    }

    function hasTrackedPublishPresentedResult(entry: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.hasTrackedPublishPresentedResult !== 'function') return false;
        return controller.hasTrackedPublishPresentedResult(entry);
    }

    function markTrackedPublishResultPresented(entry: any, snapshot: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.markTrackedPublishResultPresented !== 'function') return;
        controller.markTrackedPublishResultPresented(entry, snapshot);
    }

    function hasPendingLocalPublishes(options: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.hasPendingLocalPublishes !== 'function') return false;
        return controller.hasPendingLocalPublishes(options);
    }

    function hasNewerQueuedPublish(sequence: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.hasNewerQueuedPublish !== 'function') return false;
        return controller.hasNewerQueuedPublish(sequence);
    }

    function getPendingLocalPublishProjectedSnapshotHash(options: any) {
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

    function applySnapshotThroughCoordinator(snapshot: any, options: any) {
        const mod = resolveNetworkApplyCoordinatorModule();
        if (!mod || typeof mod.applySnapshotThroughCoordinator !== 'function') {
            throw new Error('NetworkApplyCoordinatorModule unavailable');
        }
        return mod.applySnapshotThroughCoordinator(snapshot, Object.assign({}, options, {
            getSnapshotStateVersion,
            hasNewerQueuedPublish,
            applySnapshot,
            markTrackedPublishSnapshotApplied,
            onAppliedVersion: (appliedVersion: any) => {
                state.appliedStateVersion = appliedVersion;
                state.stateVersion = appliedVersion;
            }
        }));
    }

    function isTerminalSnapshotForResult(snapshot: any) {
        const gameState = snapshot && snapshot.gameState;
        if (!gameState || typeof gameState !== 'object') return false;
        try {
            if (typeof root.isGameOver === 'function') {
                return !!root.isGameOver(gameState);
            }
        } catch (e: any) { /* ignore */ }
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

    function shouldSkipForceSyncSnapshot(snapshot: any, options?: any) {
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

    function computeRetryDelayMs(baseDelayMs: any, maxDelayMs: any, attempt: any) {
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

    async function syncLatestStateWithRetry(options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const maxAttempts = Number.isFinite(Number(opts.maxAttempts))
            ? Math.max(1, Math.trunc(Number(opts.maxAttempts)))
            : 3;
        const baseDelayMs = Number.isFinite(Number(opts.baseDelayMs))
            ? Math.max(100, Math.trunc(Number(opts.baseDelayMs)))
            : 350;

        let lastError: any = null;
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
            } catch (e: any) {
                lastError = e;
            }

            if (attempt >= (maxAttempts - 1)) break;

            const delayMs = computeRetryDelayMs(baseDelayMs, RECONNECT_MAX_DELAY_MS, attempt);
            await waitForMs(delayMs);
        }

        throw (lastError || new Error('STATE_SYNC_RETRY_EXHAUSTED'));
    }

    function getTurnTimerInfo() {
        const controller = getNetworkTurnTimerController();
        if (controller && typeof controller.getTurnTimerInfo === 'function') {
            return controller.getTurnTimerInfo();
        }
        return {
            limitSeconds: TURN_TIMER_DEFAULT_LIMIT,
            active: false,
            turnSeatKey: normalizePlayerKey(state.seatKey),
            turnStartedAt: null,
            turnDeadlineAt: null,
            remainingMs: null,
            isOwnTurn: false
        };
    }

    function resetTurnTimerState() {
        const controller = getNetworkTurnTimerController();
        if (!controller || typeof controller.resetTurnTimerState !== 'function') return;
        controller.resetTurnTimerState();
    }

    function updateTurnTimerFromPayload(payload: any) {
        const controller = getNetworkTurnTimerController();
        if (!controller || typeof controller.updateTurnTimerFromPayload !== 'function') return;
        controller.updateTurnTimerFromPayload(payload);
    }

    function ensureOwnSeatJoined() {
        invokeControllerMethod(getNetworkSessionSeatController, 'ensureOwnSeatJoined', arguments, undefined);
    }

    function normalizeChatText(value: any) {
        const controller = getNetworkRoomEventsController();
        if (controller && typeof controller.normalizeChatText === 'function') {
            return controller.normalizeChatText(value);
        }
        return String(value || '').replace(/[\r\n]+/g, ' ').trim();
    }

    function countTextChars(value: any) {
        const controller = getNetworkRoomEventsController();
        if (controller && typeof controller.countTextChars === 'function') {
            return controller.countTextChars(value);
        }
        return Array.from(String(value || '')).length;
    }

    function normalizeChatMessage(entry: any) {
        const controller = getNetworkRoomEventsController();
        if (controller && typeof controller.normalizeChatMessage === 'function') {
            return controller.normalizeChatMessage(entry);
        }
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

    function handleChatPayload(payload: any) {
        const controller = getNetworkRoomEventsController();
        if (!controller || typeof controller.handleChatPayload !== 'function') return;
        controller.handleChatPayload(payload);
    }

    function handlePresencePayload(payload: any) {
        const controller = getNetworkRoomEventsController();
        if (!controller || typeof controller.handlePresencePayload !== 'function') return;
        controller.handlePresencePayload(payload);
    }

    function handleTimeoutPassPayload(payload: any) {
        const controller = getNetworkRoomEventsController();
        if (!controller || typeof controller.handleTimeoutPassPayload !== 'function') return;
        controller.handleTimeoutPassPayload(payload);
    }

    function applySnapshot(snapshot: any, options: any) {
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

    function activateSessionFromResponse(data: any, fallbackRoomId: any) {
        invokeControllerMethod(getNetworkSessionSeatController, 'activateSessionFromResponse', arguments, undefined);
    }

    function activateSpectatorSessionFromResponse(data: any, fallbackRoomId: any) {
        invokeControllerMethod(getNetworkSessionSeatController, 'activateSpectatorSessionFromResponse', arguments, undefined);
    }

    function resetSessionState() {
        invokeControllerMethod(getNetworkSessionSeatController, 'resetSessionState', arguments, () => {
            state.active = false;
            state.roomId = '';
            state.viewerRole = 'seat';
            state.spectatorId = '';
            state.spectatorToken = '';
            state.spectatorName = '';
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
            state.lastStateSyncRecoveredPlaybackSignature = '';
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

    function setSeatGlobals(seatKey: any) {
        invokeControllerMethod(getNetworkSessionSeatController, 'setSeatGlobals', arguments, undefined);
    }

    function requestJson(method: any, path: any, payload: any) {
        const controller = getNetworkTransportController();
        if (!controller || typeof controller.requestJson !== 'function') {
            throw new Error('NetworkTransportModule unavailable');
        }
        return controller.requestJson(method, path, payload);
    }

    function sanitizePlaybackValueForPublish(value: any): any {
        if (Array.isArray(value)) {
            return value.map((item: any) => sanitizePlaybackValueForPublish(item));
        }
        if (!value || typeof value !== 'object') return value;

        const sanitized: any = {};
        const keys = Object.keys(value);
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (key === 'sourceCardEl' || key === 'sourceCardRect') continue;
            sanitized[key] = sanitizePlaybackValueForPublish(value[key]);
        }
        return sanitized;
    }

    function sanitizePlaybackEventsForPublish(playbackEvents: any) {
        if (!Array.isArray(playbackEvents) || playbackEvents.length <= 0) return [];
        return playbackEvents.map((event) => sanitizePlaybackValueForPublish(event));
    }

    function queueCommandPublish(playerKey: any, action: any, options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const normalizedPlayerKey = normalizePlayerKey(playerKey);
        const resolvedActionType = String(
            opts.actionType || (action && (action.type || action.actionType)) || 'action'
        ).trim();
        return publishCommand({
            playerKey: normalizedPlayerKey,
            actionType: resolvedActionType,
            playbackEvents: Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [],
            localPlaybackEmitted: opts.localPlaybackEmitted === true,
            usedSnapshotFallback: opts.usedSnapshotFallback === true,
            action
        });
    }

    function isMatchApiMissing(res: any) {
        const controller = getNetworkTransportController();
        if (controller && typeof controller.isMatchApiMissing === 'function') {
            return controller.isMatchApiMissing(res);
        }
        return !!(res && Number(res.status) === 404);
    }

    function shouldRetryJoinWithoutStoredClaim(res: any) {
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

    function rememberStreamEventId(event: any) {
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

    function publishRequestWithRetry(payload: any) {
        const controller = getNetworkTransportController();
        if (!controller || typeof controller.publishRequestWithRetry !== 'function') {
            throw new Error('NetworkTransportModule unavailable');
        }
        return controller.publishRequestWithRetry(payload);
    }

    function handleStreamSnapshotPayload(payload: any) {
        const controller = getNetworkStreamSnapshotController();
        if (!controller || typeof controller.handleStreamSnapshotPayload !== 'function') return;
        controller.handleStreamSnapshotPayload(payload);
    }

    function openStream(options: any) {
        const controller = getNetworkStreamSessionController();
        if (!controller || typeof controller.openStream !== 'function') return;
        controller.openStream(options);
    }

    function parseStreamEventPayload(event: any) {
        const controller = getNetworkTransportController();
        if (!controller || typeof controller.parseStreamEventPayload !== 'function') return null;
        return controller.parseStreamEventPayload(event);
    }

    function createStreamPayloadHandler(payloadHandler: any) {
        const controller = getNetworkTransportController();
        if (!controller || typeof controller.createStreamPayloadHandler !== 'function') {
            return function noopHandler() { };
        }
        return controller.createStreamPayloadHandler(payloadHandler, {
            rememberStreamEventId,
            markStreamActivity
        });
    }

    function isActive() {
        return state.active === true && !!state.roomId;
    }

    function isSpectator() {
        return isActive() && String(state.viewerRole || '').trim().toLowerCase() === 'spectator';
    }

    function setStatusWriter(writer: any) {
        state.statusWriter = typeof writer === 'function' ? writer : null;
    }

    function setServerUrl(url: any) {
        const normalized = normalizeServerUrl(url);
        state.serverUrl = normalized
            ? withTrailingSlashRemoved(normalized)
            : deriveSameOriginServerUrl();
        try {
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(SERVER_URL_STORAGE_KEY, state.serverUrl);
            }
        } catch (e: any) { /* ignore */ }
    }

    function getServerUrl() {
        return state.serverUrl;
    }

    function createRoom(options: any) {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'createRoom',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function joinRoom(roomId: any, options: any) {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'joinRoom',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function spectateRoom(roomId: any, options: any) {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'spectateRoom',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function listRooms(options: any) {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'listRooms',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE', rooms: [] })
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

    function restoreStoredSession(options?: any) {
        return invokeControllerMethod(
            getNetworkSessionLifecycleController,
            'restoreStoredSession',
            arguments,
            () => Promise.resolve({ ok: false, reason: 'SESSION_LIFECYCLE_UNAVAILABLE' })
        );
    }

    function getCurrentAppliedGameState() {
        try {
            if (root && root.gameState && typeof root.gameState === 'object') return root.gameState;
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof globalThis !== 'undefined' && (globalThis as any).gameState && typeof (globalThis as any).gameState === 'object') {
                return (globalThis as any).gameState;
            }
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function isCurrentAppliedGameOver() {
        const currentGameState = getCurrentAppliedGameState();
        if (!currentGameState) return false;

        try {
            const gameOverFn = (root && typeof root.isGameOver === 'function')
                ? root.isGameOver
                : ((typeof globalThis !== 'undefined' && typeof (globalThis as any).isGameOver === 'function') ? (globalThis as any).isGameOver : null);
            if (typeof gameOverFn === 'function') {
                return !!gameOverFn(currentGameState);
            }
        } catch (e: any) { /* ignore */ }

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

    function publishSnapshot(meta: any) {
        if (isSpectator()) {
            emitStatus('観戦中は操作できません', true);
            return Promise.resolve({ ok: false, reason: 'SPECTATOR_READ_ONLY' });
        }
        const controller = getNetworkPublishFlowController();
        if (!controller || typeof controller.publishSnapshot !== 'function') {
            emitStatus('ネット対戦: 通信失敗 (PUBLISH_FLOW_UNAVAILABLE)', true);
            return Promise.resolve({ ok: false, reason: 'PUBLISH_ERROR' });
        }
        return controller.publishSnapshot(meta);
    }

    function publishCommand(meta: any) {
        return publishSnapshot(meta);
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

        let firstResult: any = null;
        try {
            firstResult = await makeRequest();
        } catch (e: any) {
            return { ok: false, reason: 'REMATCH_REQUEST_FAILED' };
        }

        if (firstResult && firstResult.ok === true) return firstResult;
        if (!firstResult || !isVersionConflictReason(firstResult.reason)) return firstResult || { ok: false, reason: 'REMATCH_REQUEST_FAILED' };

        try {
            await syncLatestStateWithRetry({ maxAttempts: 2, baseDelayMs: 250 });
        } catch (e: any) {
            // keep rematch flow best-effort; fall through to one retry publish
        }

        if (!isCurrentAppliedGameOver()) {
            return { ok: true, reason: 'ALREADY_REMATCHED' };
        }

        try {
            return await makeRequest();
        } catch (e: any) {
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
        if (!isActive()) {
            return null;
        }
        if (state.roomBoardConfig && typeof state.roomBoardConfig === 'object') {
            return cloneReadableNetworkStateValue(state.roomBoardConfig, null);
        }
        const seatController = getNetworkSessionSeatController();
        if (seatController && typeof seatController.normalizeRoomBoardConfig === 'function') {
            const globalGameState = (typeof globalThis !== 'undefined' && (globalThis as any).gameState)
                ? (globalThis as any).gameState
                : null;
            const rootGameState = (root && root.gameState) ? root.gameState : null;
            const fallbackGameState = rootGameState || globalGameState;
            const fallbackConfig = seatController.normalizeRoomBoardConfig(null, {
                snapshot: fallbackGameState ? { gameState: fallbackGameState } : null,
                payload: fallbackGameState ? { boardConfig: fallbackGameState.boardConfig } : null
            });
            if (fallbackConfig && typeof fallbackConfig === 'object') {
                state.roomBoardConfig = fallbackConfig;
                return cloneReadableNetworkStateValue(fallbackConfig, null);
            }
        }
        return null;
    }

    function setRoomStateListener(listener: any) {
        state.roomStateListener = (typeof listener === 'function') ? listener : null;
        emitRoomStateChanged();
    }

    function setTurnTimerListener(listener: any) {
        const controller = getNetworkTurnTimerController();
        if (!controller || typeof controller.setTurnTimerListener !== 'function') return;
        controller.setTurnTimerListener(listener);
    }

    function setChatListener(listener: any) {
        const controller = getNetworkRoomEventsController();
        if (!controller || typeof controller.setChatListener !== 'function') return;
        controller.setChatListener(listener);
    }

    function getChatMaxLength() {
        return CHAT_MAX_LENGTH;
    }

    async function sendChatMessage(text: any) {
        if (!isActive()) {
            return { ok: false, reason: 'INACTIVE' };
        }
        if (isSpectator()) {
            emitStatus('観戦中はチャット送信できません', true);
            return { ok: false, reason: 'SPECTATOR_READ_ONLY' };
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

    async function updateHandSkin(selectedHandSkinId: any) {
        if (!isActive()) {
            return { ok: false, reason: 'INACTIVE' };
        }
        if (isSpectator()) {
            emitStatus('観戦中は操作できません', true);
            return { ok: false, reason: 'SPECTATOR_READ_ONLY' };
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
        spectateRoom,
        listRooms,
        leaveRoom,
        syncLatestState,
        restoreStoredSession,
        publishCommand,
        publishSnapshot,
        requestRematch,
        applySnapshot,
        isSpectator,
        getSeatKey,
        getRoomId,
        getState,
        getStateVersion,
        getRoomDeck,
        getRoomBoardConfig,
        getNetworkTelemetry
    };
    try {
        if (typeof _require === 'function') {
            const selectionFlow = _require('../game/card-effects/selection-flow');
            if (selectionFlow && typeof selectionFlow.setSignalBridge === 'function') {
                selectionFlow.setSignalBridge({
                    readMatchMode: () => {
                        try {
                            if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
                                return (globalThis as any).getCurrentMatchMode();
                            }
                            if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
                        } catch (e) { /* ignore */ }
                        return null;
                    },
                    getGameState: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).gameState : null; } catch (e) { return null; }
                    },
                    getCardState: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).cardState : null; } catch (e) { return null; }
                    },
                    setGameState: (nextGameState: any) => {
                        try {
                            if (typeof globalThis === 'undefined') return false;
                            (globalThis as any).gameState = nextGameState;
                            return true;
                        } catch (e) {
                            return false;
                        }
                    },
                    setCardState: (nextCardState: any) => {
                        try {
                            if (typeof globalThis === 'undefined') return false;
                            (globalThis as any).cardState = nextCardState;
                            return true;
                        } catch (e) {
                            return false;
                        }
                    },
                    getActionManager: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).ActionManager : null; } catch (e) { return null; }
                    },
                    getTurnPipelineUIAdapter: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipelineUIAdapter : null; } catch (e) { return null; }
                    },
                    getTurnPipeline: () => {
                        try { return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipeline : null; } catch (e) { return null; }
                    },
                    publishSnapshot: (meta: any) => {
                        if (typeof api.publishSnapshot !== 'function') return undefined;
                        if (typeof api.isActive === 'function' && api.isActive() !== true) return undefined;
                        if (typeof api.isSpectator === 'function' && api.isSpectator() === true) return undefined;
                        return api.publishSnapshot(meta);
                    },
                    isNetworkPublishActive: () => {
                        if (typeof api.publishSnapshot !== 'function') return false;
                        if (typeof api.isSpectator === 'function' && api.isSpectator() === true) return false;
                        if (typeof api.isActive === 'function') return api.isActive() === true;
                        return true;
                    },
                    armBoardUpdateDuringPlayback: (context: any) => {
                        return armBoardUpdateDuringPlayback(context);
                    }
                });
            }
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined') {
            (globalThis as any).NetworkMatchClient = api;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            (window as any).NetworkMatchClient = api;
        }
    } catch (e) { /* ignore */ }
export = api;
