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
    const PendingCoordinatorModule = resolveNetworkClientModule('../game/turn/pending-coordinator', root.PendingCoordinator || null);
    const PendingStateManagerModule = resolveNetworkClientModule('../game/logic/cards-internal/pending-state-manager', root.CardPendingStateManager || null);
    const ResultOverlayModule = resolveNetworkClientModule('./result-overlay', root || null);

    function resolvePendingSelectionContract(cardType: any) {
        if (!cardType) return null;
        try {
            if (PendingCoordinatorModule && typeof PendingCoordinatorModule.getPendingSelectionContract === 'function') {
                const contract = PendingCoordinatorModule.getPendingSelectionContract(cardType);
                if (contract && typeof contract === 'object') return contract;
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (PendingStateManagerModule && typeof PendingStateManagerModule.resolvePendingSelectionContract === 'function') {
                const contract = PendingStateManagerModule.resolvePendingSelectionContract(cardType);
                if (contract && typeof contract === 'object') return contract;
            }
        } catch (e: any) { /* ignore */ }
        return null;
    }

    function shouldDeferNetworkPublishForPendingType(cardType: any) {
        if (!cardType) return false;
        try {
            if (PendingCoordinatorModule && typeof PendingCoordinatorModule.shouldDeferNetworkPublishForPendingType === 'function') {
                return PendingCoordinatorModule.shouldDeferNetworkPublishForPendingType(cardType) === true;
            }
        } catch (e: any) { /* ignore */ }
        const contract = resolvePendingSelectionContract(cardType);
        return !!(contract && contract.deferNetworkPublish === true);
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
        try {
            if (PendingCoordinatorModule && typeof PendingCoordinatorModule.syncPendingSelectionActionCache === 'function') {
                return PendingCoordinatorModule.syncPendingSelectionActionCache(
                    pendingEffectByPlayer,
                    syncOptions.preservePlayerKeys ? syncOptions : undefined
                );
            }
        } catch (e: any) { /* ignore */ }
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
        consumedStateSyncPlaybackKey: '',
        pendingForceSyncPlaybackVersion: null as any,
        pendingForceSyncPlaybackSource: '',
        pendingForceSyncPlaybackSignature: '',
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
    let networkSnapshotModule: any = null;
    let networkSessionSeatModule: any = null;
    let networkSessionLifecycleModule: any = null;
    let networkCommandPayloadModule: any = null;
    let networkActionBridgeModule: any = null;
    let networkApplyCoordinatorModule: any = null;
    let networkReconnectControllerModule: any = null;
    let networkPublishTrackerModule: any = null;
    let cardLogicModule: any = null;
    let networkCommentaryController: any = null;
    let networkSnapshotController: any = null;
    let networkSessionSeatController: any = null;
    let networkSessionLifecycleController: any = null;
    let networkActionBridgeController: any = null;
    let networkReconnectController: any = null;
    let networkPublishTrackerController: any = null;
    let ownerHelpers: any = null;
    networkCommentaryModule = resolveNetworkClientModule('./network/commentary', null);
    networkActionSchemaModule = resolveNetworkClientModule('../shared/network-action-schema', null);
    networkPublishRequestModule = resolveNetworkClientModule('./network/publish-request', null);
    networkSnapshotModule = resolveNetworkClientModule('./network/snapshot', null);
    networkSessionSeatModule = resolveNetworkClientModule('./network/session-seat', null);
    networkSessionLifecycleModule = resolveNetworkClientModule('./network/session-lifecycle', null);
    networkCommandPayloadModule = resolveNetworkClientModule('./network/command-payload', null);
    networkActionBridgeModule = resolveNetworkClientModule('./network/action-bridge', null);
    networkApplyCoordinatorModule = resolveNetworkClientModule('./network/apply-coordinator', null);
    networkReconnectControllerModule = resolveNetworkClientModule('./network/reconnect-controller', null);
    networkPublishTrackerModule = resolveNetworkClientModule('./network/publish-tracker', null);

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
            resetResultPresentationState: (resultState: any) => resetNetworkResultPresentationState(resultState)
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
            resolveStateSyncRecoveredPlaybackEvents,
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
        } catch (e: any) {
            return '';
        }
    }

    function computeCurrentPlaybackRecoverySignature() {
        const currentSnapshot = getCurrentSnapshotForPublish();
        return computeForceSyncPlaybackRecoverySignature(currentSnapshot);
    }

    function computePlaybackEventsSignature(playbackEvents: any) {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        if (events.length <= 0) return '';
        try {
            return JSON.stringify(sanitizePlaybackEventsForPublish(events));
        } catch (e: any) {
            return '';
        }
    }

    function computeStateSyncPlaybackRecoveryKey(payload: any) {
        const source = (payload && typeof payload === 'object') ? payload : {};
        const stateVersion = Number.isFinite(Number(source.stateVersion))
            ? Number(source.stateVersion)
            : getSnapshotStateVersion(source.snapshot);
        const operationId = source.operationId ? String(source.operationId).trim() : '';
        const playbackSignature = computePlaybackEventsSignature(source.playbackEvents);
        if (stateVersion === null || !playbackSignature) return '';
        return JSON.stringify({
            stateVersion,
            operationId,
            playbackSignature
        });
    }

    function resolveStateSyncRecoveredPlaybackEvents(payload: any) {
        const playbackEvents = Array.isArray(payload && payload.playbackEvents) ? payload.playbackEvents : [];
        if (playbackEvents.length <= 0) return [];
        const recoveryKey = computeStateSyncPlaybackRecoveryKey(payload);
        if (!recoveryKey) return playbackEvents;
        if (state.consumedStateSyncPlaybackKey && state.consumedStateSyncPlaybackKey === recoveryKey) {
            recordNetworkTelemetry('state_sync_recovered_playback_deduped', {
                stateVersion: Number.isFinite(Number(payload && payload.stateVersion))
                    ? Number(payload.stateVersion)
                    : getSnapshotStateVersion(payload && payload.snapshot),
                operationId: payload && payload.operationId ? String(payload.operationId) : null,
                playbackEventCount: playbackEvents.length
            });
            return [];
        }
        state.consumedStateSyncPlaybackKey = recoveryKey;
        return playbackEvents;
    }

    // Only shadow echoed server playback when the same operation already emitted
    // local playback. Publish-only pending selections carry requested playback
    // metadata for the server, but must still replay the authoritative events.
    // For publish-response we additionally require the response snapshot signature
    // to match the actor's current state, which keeps divergent corrections visible.
    function shouldApplyPublishResponseAsShadowPlayback(trackedPublish: any, snapshot: any, playbackEvents: any) {
        if (!trackedPublish || typeof trackedPublish !== 'object') return false;
        if (!trackedPublish.requestMeta) return false;
        if (hasTrackedPublishLocalPlaybackEmitted(trackedPublish) !== true) return false;
        const requestedPlaybackEvents = getTrackedPublishRequestedPlaybackEvents(trackedPublish);
        if (!Array.isArray(requestedPlaybackEvents) || requestedPlaybackEvents.length === 0) return false;
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        const snapshotSignature = computeForceSyncPlaybackRecoverySignature(snapshot);
        if (!snapshotSignature) return false;
        const currentSignature = computeCurrentPlaybackRecoverySignature();
        return !!currentSignature && currentSignature === snapshotSignature;
    }

    function shouldSkipPublishResponseSnapshot(trackedPublish: any, snapshot: any) {
        if (!trackedPublish || typeof trackedPublish !== 'object') return false;
        if (trackedPublish.selfSnapshotReceived !== true) return false;

        const snapshotVersion = getSnapshotStateVersion(snapshot);
        const selfSnapshotVersion = Number.isFinite(Number(trackedPublish.selfSnapshotVersion))
            ? Number(trackedPublish.selfSnapshotVersion)
            : null;
        const appliedStateVersion = getAppliedStateVersion();
        if (snapshotVersion === null || selfSnapshotVersion === null) return false;
        if (snapshotVersion !== selfSnapshotVersion) return false;
        if (appliedStateVersion !== null && appliedStateVersion < snapshotVersion) return false;

        const snapshotSignature = computeForceSyncPlaybackRecoverySignature(snapshot);
        if (!snapshotSignature) return false;
        const currentSignature = computeCurrentPlaybackRecoverySignature();
        return !!currentSignature && currentSignature === snapshotSignature;
    }

    // SSE stream variant of the same rule: operationId ties the stream payload to
    // the local publish, and localPlaybackEmitted decides whether it is a shadow
    // echo or authoritative playback that still needs to be shown.
    function shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish: any, playbackEvents: any) {
        if (!trackedPublish || typeof trackedPublish !== 'object') return false;
        if (!trackedPublish.requestMeta) return false;
        if (hasTrackedPublishLocalPlaybackEmitted(trackedPublish) !== true) return false;
        const requestedPlaybackEvents = getTrackedPublishRequestedPlaybackEvents(trackedPublish);
        if (!Array.isArray(requestedPlaybackEvents) || requestedPlaybackEvents.length === 0) return false;
        if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
        return true;
    }

    function buildShadowAwarePlaybackApplyOptions(playbackEvents: any, shouldShadowPlayback: any, shadowPlaybackSource: any) {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        const useShadowPlayback = shouldShadowPlayback === true;
        return {
            playbackEvents: useShadowPlayback ? [] : events,
            shadowPlaybackEvents: useShadowPlayback ? events : [],
            shadowPlaybackSource: useShadowPlayback ? shadowPlaybackSource : undefined
        };
    }

    function clearPendingForceSyncPlaybackRecovery() {
        state.pendingForceSyncPlaybackVersion = null;
        state.pendingForceSyncPlaybackSource = '';
        state.pendingForceSyncPlaybackSignature = '';
    }

    function rememberPendingForceSyncPlaybackRecovery(snapshot: any, options: any) {
        const opts = (options && typeof options === 'object') ? options : {};
        const snapshotVersion = getSnapshotStateVersion(snapshot);
        const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
        const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
        if (snapshotVersion === null) {
            clearPendingForceSyncPlaybackRecovery();
            return false;
        }
        if (opts.force !== true || playbackEvents.length > 0 || shadowPlaybackEvents.length > 0) {
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

    function consumePendingForceSyncPlaybackRecovery(snapshotOrVersion: any) {
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

    function shouldRecoverForceSyncedStreamPlayback(snapshot: any, playbackEvents: any) {
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

    function isVersionConflictReason(reasonValue: any) {
        const reason = String(reasonValue || '').trim();
        return reason === 'VERSION_MISMATCH'
            || reason === 'VERSION_AHEAD'
            || reason === 'VERSION_BEHIND'
            || reason === 'VERSION_GAP';
    }

    function getVersionConflictTelemetryKey(reasonValue: any) {
        const reason = String(reasonValue || '').trim();
        if (reason === 'VERSION_AHEAD') return 'publish_version_ahead';
        if (reason === 'VERSION_BEHIND') return 'publish_version_behind';
        if (reason === 'VERSION_GAP') return 'publish_version_gap';
        if (reason === 'VERSION_MISMATCH') return 'publish_version_mismatch';
        return '';
    }

    function shouldRetryVersionConflictPublish(reasonValue: any, actionTypeValue: any, trackedPublish: any) {
        if (!isVersionConflictReason(reasonValue)) return false;
        const actionType = String(actionTypeValue || '').trim().toLowerCase();
        if (actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart') return false;
        if (trackedPublish && hasNewerQueuedPublish(trackedPublish.sequence)) return false;
        return true;
    }

    function buildVersionConflictRetryPayload(payload: any) {
        const retryTurnIndex = getCurrentPublishTurnIndex();
        const retryPayload = Object.assign({}, payload, {
            baseVersion: state.stateVersion,
            turnIndex: retryTurnIndex
        });
        if (retryPayload.action && typeof retryPayload.action === 'object') {
            retryPayload.action = Object.assign({}, retryPayload.action, {
                turnIndex: retryTurnIndex
            });
        }
        return retryPayload;
    }

    function resolveRejectedPublishSnapshotHandling(entry: any, payload: any, rejectedReason: any, options: any) {
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

    function buildPublishCommandPayload(info: any, playerKey: any) {
        const moduleRef = resolveNetworkCommandPayloadModule();
        if (!moduleRef || typeof moduleRef.buildPublishCommandPayload !== 'function') {
            return null;
        }
        return moduleRef.buildPublishCommandPayload(info, {
            playerKey,
            normalizePlayerKey,
            pendingCoordinator: PendingCoordinatorModule,
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

    function normalizeTurnTimerPayload(value: any) {
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

    function updateServerTimeOffset(serverTimeValue: any) {
        const serverTime = Number(serverTimeValue);
        if (!Number.isFinite(serverTime)) return;
        state.serverTimeOffsetMs = serverTime - Date.now();
    }

    function maybeSyncFromHeartbeat(payload: any) {
        const controller = getNetworkReconnectController();
        if (!controller || typeof controller.maybeSyncFromHeartbeat !== 'function') return;
        controller.maybeSyncFromHeartbeat(payload);
    }

    function getAdjustedNowMs() {
        return Date.now() + (Number.isFinite(state.serverTimeOffsetMs) ? state.serverTimeOffsetMs : 0);
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

    function hasTrackedPublishLocalPlaybackEmitted(entry: any) {
        const controller = getNetworkPublishTrackerController();
        if (!controller || typeof controller.hasTrackedPublishLocalPlaybackEmitted !== 'function') return false;
        return controller.hasTrackedPublishLocalPlaybackEmitted(entry) === true;
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
        } catch (e: any) { /* ignore */ }
    }

    function clearTurnTimerTick() {
        if (!state.turnTimerTickHandle) return;
        clearScheduledTimeout(state.turnTimerTickHandle);
        state.turnTimerTickHandle = 0;
    }

    function maybeSyncLatestStateAfterTimeout(timerInfo: any) {
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

    function updateTurnTimerFromPayload(payload: any) {
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

    function normalizeChatText(value: any) {
        return String(value || '').replace(/[\r\n]+/g, ' ').trim();
    }

    function countTextChars(value: any) {
        return Array.from(String(value || '')).length;
    }

    function normalizeChatMessage(entry: any) {
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

    function emitChatEvent(payload: any) {
        if (typeof state.chatListener !== 'function') return;
        try {
            state.chatListener(payload);
        } catch (e: any) { /* ignore */ }
    }

    function handleChatPayload(payload: any) {
        if (!payload || payload.ok !== true) return;

        applyPayloadSessionState(payload);

        const type = String(payload.type || 'message');
        if (type === 'history') {
            const list = Array.isArray(payload.messages) ? payload.messages : [];
            const normalized = list
                .map((entry: any) => normalizeChatMessage(entry))
                .filter((entry: any) => !!entry);
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

    function handlePresencePayload(payload: any) {
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

    function handleTimeoutPassPayload(payload: any) {
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
            state.consumedStateSyncPlaybackKey = '';
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

    function parseStreamEventPayload(event: any) {
        try {
            return JSON.parse((event && event.data) || '{}');
        } catch (e: any) {
            return null;
        }
    }

    function createStreamPayloadHandler(payloadHandler: any) {
        return function handleParsedStreamEvent(event: any) {
            const payload = parseStreamEventPayload(event);
            if (!payload) return;
            rememberStreamEventId(event);
            markStreamActivity();
            payloadHandler(payload);
        };
    }

    async function requestJson(method: any, path: any, payload: any) {
        const url = `${withTrailingSlashRemoved(state.serverUrl)}${path}`;
        const init: any = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (payload !== undefined) {
            init.body = JSON.stringify(payload);
        }

        let timeoutId = 0;
        let controller: any = null;
        try {
            if (typeof AbortController === 'function') {
                controller = new AbortController();
                init.signal = controller.signal;
                timeoutId = scheduleTimeout(() => {
                    try { controller.abort(); } catch (e: any) { /* ignore */ }
                }, REQUEST_TIMEOUT_MS);
            }
        } catch (e: any) { /* ignore */ }

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

    function isRetryablePublishStatus(status: any) {
        const code = Number(status);
        return code === 408 || code === 429 || code === 500 || code === 502 || code === 503 || code === 504;
    }

    async function publishRequestWithRetry(payload: any) {
        let lastError: any = null;
        for (let attempt = 0; attempt < PUBLISH_RETRY_MAX_ATTEMPTS; attempt += 1) {
            try {
                const res = await requestJson('POST', '/api/match/publish', payload);
                if (!isRetryablePublishStatus(res && res.status) || attempt >= (PUBLISH_RETRY_MAX_ATTEMPTS - 1)) {
                    return res;
                }
            } catch (e: any) {
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

    function openStream(options: any) {
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

        const onSnapshot = (payload: any) => {
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
            const streamPlaybackApplyOptions = buildShadowAwarePlaybackApplyOptions(
                playbackEvents,
                shouldShadowStreamPlayback,
                'stream_self_shadow'
            );
            let applied = applySnapshotThroughCoordinator(snapshot, {
                source: 'stream',
                trackedPublish,
                applyOptions: Object.assign({}, streamPlaybackApplyOptions, {
                    force: false,
                    skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
                })
            });
            const recoveredForcedPlayback = !applied && shouldRecoverForceSyncedStreamPlayback(snapshot, playbackEvents)
                ? applySnapshot(snapshot, Object.assign({}, streamPlaybackApplyOptions, {
                    force: true,
                    skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
                }))
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

        const handleStreamEvent = createStreamPayloadHandler((payload: any) => {
            completeReconnectRecoveryFromStream();
            onSnapshot(payload);
        });
        const handlePresenceEvent = createStreamPayloadHandler(handlePresencePayload);
        const handleChatEvent = createStreamPayloadHandler(handleChatPayload);
        const handleHeartbeatEvent = createStreamPayloadHandler((payload: any) => {
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
            localPlaybackEmitted: info.localPlaybackEmitted === true,
            usedSnapshotFallback: info.usedSnapshotFallback === true,
            snapshotProjectedHash: (getSnapshotMeta(info && info.snapshot) || {} as any).projectedSnapshotHash
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
                let res = await publishRequestWithRetry(payload);
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
                    let retryAcceptedAfterResync = false;
                    if (shouldRetryVersionConflictPublish(reason, queuedActionType, trackedPublish)) {
                        try {
                            await syncLatestStateWithRetry({ maxAttempts: 2, baseDelayMs: 150 });
                            const retryPayload = buildVersionConflictRetryPayload(payload);
                            recordNetworkTelemetry('publish_version_conflict_retry', {
                                reason,
                                operationId,
                                sequence: trackedPublish.sequence,
                                retryBaseVersion: retryPayload.baseVersion,
                                retryTurnIndex: retryPayload.turnIndex
                            });
                            const retryRes = await publishRequestWithRetry(retryPayload);
                            if (retryRes && retryRes.ok && retryRes.data && retryRes.data.ok === true) {
                                res = retryRes;
                                retryAcceptedAfterResync = true;
                                recordNetworkTelemetry('publish_version_conflict_retry_accepted', {
                                    reason,
                                    operationId,
                                    sequence: trackedPublish.sequence,
                                    responseStateVersion: Number.isFinite(Number(retryRes.data.stateVersion))
                                        ? Number(retryRes.data.stateVersion)
                                        : null
                                });
                            } else {
                                recordNetworkTelemetry('publish_version_conflict_retry_rejected', {
                                    reason: (retryRes && retryRes.data && retryRes.data.rejectedReason) || 'PUBLISH_REJECTED',
                                    operationId,
                                    sequence: trackedPublish.sequence
                                });
                            }
                        } catch (e: any) {
                            recordNetworkTelemetry('publish_version_conflict_retry_failed', {
                                reason,
                                operationId,
                                sequence: trackedPublish.sequence,
                                error: e && e.message ? String(e.message) : String(e || '')
                            });
                        }
                    }
                    if (!retryAcceptedAfterResync) {
                        settleTrackedPublish(trackedPublish);
                        emitStatus(`ネット対戦: 操作が拒否されました (${reason})`, true);
                        return { ok: false, reason };
                    }
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
                    const shouldSkipPublishResponse = shouldSkipPublishResponseSnapshot(
                        trackedPublish,
                        res.data.snapshot
                    );
                    const serverPlaybackEvents = Array.isArray(res.data.playbackEvents) ? res.data.playbackEvents : [];
                    const shouldShadowPlaybackResponse = shouldApplyPublishResponseAsShadowPlayback(
                        trackedPublish,
                        res.data.snapshot,
                        serverPlaybackEvents
                    );
                    const publishResponsePlaybackApplyOptions = buildShadowAwarePlaybackApplyOptions(
                        serverPlaybackEvents,
                        shouldShadowPlaybackResponse,
                        'publish_response_shadow'
                    );
                    const applied = shouldSkipPublishResponse
                        ? false
                        : applySnapshotThroughCoordinator(res.data.snapshot, {
                            source: 'publish_response',
                            trackedPublish,
                            applyOptions: Object.assign({}, publishResponsePlaybackApplyOptions, {
                                force: true,
                                skipResultOverlay: hasTrackedPublishPresentedResult(trackedPublish)
                            })
                        });
                    if (applied) {
                        rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, Object.assign({}, publishResponsePlaybackApplyOptions, {
                            source: 'publish_response',
                            force: true
                        }));
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
                            snapshotVersion: getSnapshotStateVersion(res.data.snapshot),
                            skipReason: shouldSkipPublishResponse ? 'self_snapshot_already_applied' : 'apply_rejected'
                        });
                    }
                }
                pruneTrackedPublishes();
                return { ok: true };
            })
            .catch((error: any) => {
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
        state.turnTimerListener = (typeof listener === 'function') ? listener : null;
        emitTurnTimerChanged();
    }

    function setChatListener(listener: any) {
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

    async function sendChatMessage(text: any) {
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

    async function updateHandSkin(selectedHandSkinId: any) {
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
        publishCommand,
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
                        return api.publishSnapshot(meta);
                    },
                    isNetworkPublishActive: () => {
                        if (typeof api.publishSnapshot !== 'function') return false;
                        if (typeof api.isActive === 'function') return api.isActive() === true;
                        return true;
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
