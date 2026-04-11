(function (root) {
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
    const NETWORK_LOCAL_PENDING_HINT_TTL_MS = 45000;
    const NETWORK_TELEMETRY_RECENT_LIMIT = 40;
    const PlaybackStateModule = (typeof require === 'function')
        ? (() => {
            try { return require('./playback-state-manager'); } catch (e) { return root.PlaybackStateManager || null; }
        })()
        : (root.PlaybackStateManager || null);
    const PendingSelectionFlow = (typeof require === 'function')
        ? (() => {
            try { return require('../game/card-effects/selection-flow'); } catch (e) { return root.PendingSelectionFlow || null; }
        })()
        : (root.PendingSelectionFlow || null);
    const PendingCoordinatorModule = (typeof require === 'function')
        ? (() => {
            try { return require('../game/turn/pending-coordinator'); } catch (e) { return root.PendingCoordinator || null; }
        })()
        : (root.PendingCoordinator || null);
    const PlaybackEventHelpers = (typeof require === 'function')
        ? (() => {
            try { return require('../shared/playback-event-helpers'); } catch (e) { return root.PlaybackEventHelpers || null; }
        })()
        : (root.PlaybackEventHelpers || null);

    function resolveCardLogicModule() {
        if (root && root.CardLogic) return root.CardLogic;
        if (typeof require === 'function') {
            try { return require('../game/logic/cards'); } catch (e) { return null; }
        }
        return null;
    }

    function resolveCardTypeForId(cardId) {
        if (!cardId) return null;
        const cl = resolveCardLogicModule();
        if (!cl || typeof cl.getCardDef !== 'function') return null;
        const def = cl.getCardDef(cardId);
        return (def && def.type) ? String(def.type) : null;
    }

    function resolvePendingSelectionContract(cardType) {
        if (!cardType) return null;
        try {
            if (PendingCoordinatorModule && typeof PendingCoordinatorModule.getPendingSelectionContract === 'function') {
                const contract = PendingCoordinatorModule.getPendingSelectionContract(cardType);
                if (contract && typeof contract === 'object') return contract;
            }
        } catch (e) { /* ignore */ }
        try {
            if (PendingSelectionFlow && typeof PendingSelectionFlow.resolvePendingSelectionContract === 'function') {
                const contract = PendingSelectionFlow.resolvePendingSelectionContract(cardType);
                if (contract && typeof contract === 'object') return contract;
            }
        } catch (e) { /* ignore */ }
        return null;
    }

    function shouldRestorePendingCardUsePlayback(cardType) {
        const contract = resolvePendingSelectionContract(cardType);
        if (!contract) return false;
        return contract.kind !== 'hand_overlay';
    }

    function buildPendingCardUsePlaybackEvents(playerKey, cardId, cardType) {
        if (!cardId) return [];

        const normalizedPlayerKey = normalizePlayerKey(playerKey);
        const cardLogic = resolveCardLogicModule();
        const cardDef = (cardLogic && typeof cardLogic.getCardDef === 'function')
            ? cardLogic.getCardDef(cardId)
            : null;
        const resolvedCardType = cardType || (cardDef && cardDef.type ? String(cardDef.type) : null);
        const cost = (cardDef && Number.isFinite(Number(cardDef.cost)))
            ? Number(cardDef.cost)
            : null;
        const name = (cardDef && cardDef.name)
            ? String(cardDef.name)
            : null;
        const costTier = (cardDef && cardDef.costTier)
            ? String(cardDef.costTier)
            : null;
        const visualDescriptor = (PlaybackEventHelpers && typeof PlaybackEventHelpers.createCardVisualDescriptor === 'function')
            ? PlaybackEventHelpers.createCardVisualDescriptor(cardId, {
                name,
                cost,
                costTier
            })
            : null;

        return [
            {
                type: 'card_use_animation',
                phase: 1,
                targets: [{
                    player: normalizedPlayerKey,
                    owner: normalizedPlayerKey,
                    cardId,
                    cardType: resolvedCardType,
                    cost,
                    name,
                    visualDescriptor
                }]
            },
            {
                type: 'sound_effect',
                phase: 1,
                targets: [{ soundKey: 'card_use_button' }],
                meta: { sourceType: 'card_used' }
            }
        ];
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

    const state = {
        active: false,
        roomId: '',
        seatKey: 'black',
        seatToken: '',
        roomSeats: { black: false, white: false },
        seatNames: { black: '', white: '' },
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
        originalRunTurnWithAdapter: null,
        actionBridgeInstalled: false,
        publishChain: Promise.resolve(),
        publishTracker: {
            nextSequence: 0,
            operations: []
        },
        lastResultVersionShown: null,
        resultShownForUnversioned: false,
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
            turnStartReconciled: false
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
    let networkSnapshotModule = null;
    let networkSessionSeatModule = null;
    let networkActionSchemaModule = null;
    let networkCommentaryController = null;
    let networkSnapshotController = null;
    let networkSessionSeatController = null;
    let ownerHelpers = null;

    if (typeof require === 'function') {
        try { networkCommentaryModule = require('./network/commentary'); } catch (e) { /* ignore */ }
        try { networkSnapshotModule = require('./network/snapshot'); } catch (e) { /* ignore */ }
        try { networkSessionSeatModule = require('./network/session-seat'); } catch (e) { /* ignore */ }
        try { networkActionSchemaModule = require('../shared/network-action-schema'); } catch (e) { /* ignore */ }
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
            syncPendingSelectionActionCache: PendingSelectionFlow && typeof PendingSelectionFlow.syncPendingSelectionActionCache === 'function'
                ? (pendingEffectByPlayer) => PendingSelectionFlow.syncPendingSelectionActionCache(pendingEffectByPlayer)
                : null
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
            updateTurnTimerFromPayload: (payload) => updateTurnTimerFromPayload(payload),
            ensureActionBridge: () => ensureActionBridge(),
            applySnapshot: (snapshot, options) => applySnapshot(snapshot, options)
        });
        return networkSessionSeatController;
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
            usedSnapshotFallback: requestMeta.usedSnapshotFallback === true
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
            turnStartReconciled: meta.turnStartReconciled !== false
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

    function resolveRejectedPublishSnapshotHandling(entry, payload, rejectedReason) {
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
        if (shouldSkipForceSyncSnapshot(snapshot, { ignoreSequence: entry && entry.sequence })) {
            return { shouldApplySnapshot: false, skipReason: 'skip_force_sync_guard', snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
        }
        return { shouldApplySnapshot: true, skipReason: null, snapshotVersion, rejectionStateVersion, localStateVersionBefore, reason };
    }

    function serializeActionForCommandPayload(action, fallbackPlayerKey) {
        if (!action || typeof action !== 'object') return null;

        const schema = resolveNetworkActionSchemaModule();
        if (schema && typeof schema.serializeAction === 'function') {
            const serialized = schema.serializeAction(action, fallbackPlayerKey);
            if (serialized) return serialized;
        }

        const actionType = String(action.type || action.actionType || '').trim().toLowerCase();
        if (!actionType) return null;

        const payload = {
            actionType,
            actor: normalizePlayerKey(action.actor || action.playerKey || fallbackPlayerKey),
            params: {}
        };
        if (action.actionId) payload.actionId = String(action.actionId);
        if (Number.isFinite(Number(action.turnIndex))) payload.turnIndex = Math.trunc(Number(action.turnIndex));

        const keys = Object.keys(action);
        for (let index = 0; index < keys.length; index += 1) {
            const key = keys[index];
            if (key === 'type' || key === 'actionType' || key === 'actor' || key === 'playerKey' || key === 'actionId' || key === 'turnIndex' || key === 'deferNetworkPublish' || key === 'snapshot' || key === 'playbackEvents') {
                continue;
            }
            if (typeof action[key] === 'undefined') continue;
            payload.params[key] = cloneDataForCommandPayload(action[key]);
        }
        return payload;
    }

    function buildPublishCommandPayload(info, playerKey) {
        const source = (info && typeof info === 'object') ? info : {};
        const action = (source.action && typeof source.action === 'object') ? source.action : null;
        const schema = resolveNetworkActionSchemaModule();
        const actionType = String(source.actionType || (action && (action.type || action.actionType)) || '').trim().toLowerCase();

        if (action) {
            const serialized = serializeActionForCommandPayload(action, playerKey);
            if (serialized) {
                if (!schema || typeof schema.shouldUseCommandPayload !== 'function' || schema.shouldUseCommandPayload(serialized)) {
                    return serialized;
                }
            }
        }

        if (actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart') {
            return {
                actionType,
                actor: normalizePlayerKey(playerKey),
                params: {}
            };
        }

        return null;
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
        const remoteVersion = Number.isFinite(Number(payload && payload.stateVersion))
            ? Number(payload.stateVersion)
            : null;
        if (remoteVersion === null) return;

        const localVersion = getAppliedStateVersion();

        if (localVersion !== null && remoteVersion <= localVersion) return;
        if (state.heartbeatResyncInFlight) return;

        recordNetworkTelemetry('heartbeat_resync_requested', {
            remoteVersion,
            localVersion
        });
        state.heartbeatResyncInFlight = true;
        syncLatestStateWithRetry({ maxAttempts: 2, baseDelayMs: 300 })
            .then(() => {
                recordNetworkTelemetry('heartbeat_resync_succeeded', {
                    remoteVersion,
                    localVersionBefore: localVersion,
                    localVersionAfter: Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null
                });
            })
            .catch(() => {
                recordNetworkTelemetry('heartbeat_resync_failed', {
                    remoteVersion,
                    localVersion
                });
            })
            .finally(() => {
                state.heartbeatResyncInFlight = false;
            });
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
        const tracker = (state.publishTracker && typeof state.publishTracker === 'object')
            ? state.publishTracker
            : null;
        if (tracker && Array.isArray(tracker.operations) && Number.isFinite(Number(tracker.nextSequence))) {
            return tracker;
        }

        state.publishTracker = {
            nextSequence: 0,
            operations: []
        };
        return state.publishTracker;
    }

    function pruneTrackedPublishes() {
        const tracker = ensurePublishTracker();
        const now = Date.now();
        tracker.operations = tracker.operations.filter((entry) => {
            if (!entry || !entry.operationId) return false;
            if (entry.phase === 'settled') return false;
            if (entry.responseSettled === true && entry.selfSnapshotReceived === true) return false;
            if (entry.responseSettled === true && Number.isFinite(Number(entry.completedAt)) && (now - Number(entry.completedAt)) > PUBLISH_TRACKER_RETENTION_MS) {
                return false;
            }
            return true;
        });

        if (tracker.operations.length > PUBLISH_TRACKER_MAX_OPERATIONS) {
            tracker.operations = tracker.operations.slice(tracker.operations.length - PUBLISH_TRACKER_MAX_OPERATIONS);
        }

        return tracker.operations;
    }

    function resetPublishTracker() {
        state.publishTracker = {
            nextSequence: 0,
            operations: []
        };
    }

    function createTrackedPublish(operationId, requestMeta) {
        const tracker = ensurePublishTracker();
        const sequence = Number.isFinite(Number(tracker.nextSequence))
            ? Number(tracker.nextSequence) + 1
            : 1;
        tracker.nextSequence = sequence;

        const entry = {
            operationId: String(operationId || ''),
            sequence,
            phase: 'queued',
            responseSettled: false,
            responseVersion: null,
            selfSnapshotReceived: false,
            selfSnapshotVersion: null,
            appliedSource: '',
            appliedVersion: null,
            completedAt: null,
            requestMeta: (requestMeta && typeof requestMeta === 'object') ? {
                actionType: requestMeta.actionType || null,
                actor: requestMeta.actor || null,
                params: (requestMeta.params && typeof requestMeta.params === 'object') ? cloneDataForCommandPayload(requestMeta.params) : null,
                playbackEvents: Array.isArray(requestMeta.playbackEvents) ? cloneDataForCommandPayload(requestMeta.playbackEvents) : [],
                usedSnapshotFallback: requestMeta.usedSnapshotFallback === true
            } : null
        };
        tracker.operations.push(entry);
        pruneTrackedPublishes();
        return entry;
    }

    function getTrackedPublishRequestedPlaybackEvents(entry) {
        const playbackEvents = entry && entry.requestMeta && Array.isArray(entry.requestMeta.playbackEvents)
            ? entry.requestMeta.playbackEvents
            : [];
        return playbackEvents;
    }

    function findTrackedPublish(operationId) {
        if (!operationId) return null;
        const operations = pruneTrackedPublishes();
        for (let index = 0; index < operations.length; index += 1) {
            const entry = operations[index];
            if (entry && entry.operationId === operationId) {
                return entry;
            }
        }
        return null;
    }

    function settleTrackedPublish(entry) {
        if (!entry || typeof entry !== 'object') return;
        entry.phase = 'settled';
        entry.completedAt = Date.now();
        pruneTrackedPublishes();
    }

    function markTrackedPublishInFlight(entry) {
        if (!entry || typeof entry !== 'object') return;
        entry.phase = 'inflight';
    }

    function markTrackedPublishResponse(entry, stateVersionValue) {
        if (!entry || typeof entry !== 'object') return;
        entry.phase = 'acknowledged';
        entry.responseSettled = true;
        entry.responseVersion = Number.isFinite(Number(stateVersionValue))
            ? Number(stateVersionValue)
            : null;
        entry.completedAt = Date.now();
        if (entry.selfSnapshotReceived === true) {
            settleTrackedPublish(entry);
        } else {
            pruneTrackedPublishes();
        }
    }

    function markTrackedPublishSelfSnapshot(entry, snapshot) {
        if (!entry || typeof entry !== 'object') return;
        entry.selfSnapshotReceived = true;
        entry.selfSnapshotVersion = getSnapshotStateVersion(snapshot);
        if (entry.responseSettled === true) {
            settleTrackedPublish(entry);
        }
    }

    function markTrackedPublishSnapshotApplied(entry, snapshot, source) {
        if (!entry || typeof entry !== 'object') return;
        entry.appliedSource = typeof source === 'string' ? source : '';
        entry.appliedVersion = getSnapshotStateVersion(snapshot);
    }

    function hasTrackedPublishPresentedResult(entry) {
        return !!(entry && entry.resultOverlayPresented === true);
    }

    function markTrackedPublishResultPresented(entry, snapshot) {
        if (!entry || typeof entry !== 'object') return;
        entry.resultOverlayPresented = true;
        entry.resultOverlayVersion = getSnapshotStateVersion(snapshot);
    }

    function hasPendingLocalPublishes(options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const ignoredSequence = Number.isFinite(Number(opts.ignoreSequence))
            ? Number(opts.ignoreSequence)
            : null;
        const operations = pruneTrackedPublishes();
        return operations.some((entry) => {
            if (!entry || (entry.phase !== 'queued' && entry.phase !== 'inflight')) return false;
            if (ignoredSequence === null) return true;
            return Number(entry.sequence) !== ignoredSequence;
        });
    }

    function hasLocalDeferredPendingHint() {
        const localCardState = (root && root.cardState && typeof root.cardState === 'object')
            ? root.cardState
            : ((typeof globalThis !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object')
                ? globalThis.cardState
                : null);
        if (!localCardState || typeof localCardState !== 'object') return false;
        const pendingByPlayer = localCardState.pendingEffectByPlayer;
        if (!pendingByPlayer || typeof pendingByPlayer !== 'object') return false;
        const seatKey = normalizePlayerKey(state.seatKey);
        const pending = pendingByPlayer[seatKey];
        if (!pending || typeof pending !== 'object') return false;
        if (pending.__networkLocalHint !== true) return false;
        const hintSetAt = Number.isFinite(Number(pending.__networkLocalHintSetAt))
            ? Number(pending.__networkLocalHintSetAt)
            : null;
        if (hintSetAt === null || (Date.now() - hintSetAt) > NETWORK_LOCAL_PENDING_HINT_TTL_MS) {
            return false;
        }
        const pendingType = pending.type ? String(pending.type) : '';
        const contract = resolvePendingSelectionContract(pendingType);
        return !!(contract && contract.deferNetworkPublish === true);
    }

    function hasNewerQueuedPublish(sequence) {
        const currentSequence = Number.isFinite(Number(sequence)) ? Number(sequence) : 0;
        const operations = pruneTrackedPublishes();
        return operations.some((entry) => entry && entry.phase !== 'settled' && Number(entry.sequence) > currentSequence);
    }

    function shouldApplyPublishResponseSnapshot(entry, snapshot) {
        if (!entry || !snapshot) return false;
        if (hasNewerQueuedPublish(entry.sequence)) return false;
        if (entry.selfSnapshotReceived !== true) return true;

        const responseVersion = getSnapshotStateVersion(snapshot);
        const selfSnapshotVersion = Number.isFinite(Number(entry.selfSnapshotVersion))
            ? Number(entry.selfSnapshotVersion)
            : null;

        if (responseVersion === null) return false;
        if (selfSnapshotVersion === null) return false;
        return responseVersion > selfSnapshotVersion;
    }

    function shouldApplyTrackedPublishSnapshot(entry, snapshot, source) {
        if (!entry || !snapshot) return true;

        const sourceKey = typeof source === 'string' ? source : '';
        const snapshotVersion = getSnapshotStateVersion(snapshot);
        const appliedVersion = Number.isFinite(Number(entry.appliedVersion))
            ? Number(entry.appliedVersion)
            : null;
        if (snapshotVersion !== null && appliedVersion !== null && snapshotVersion <= appliedVersion) {
            return false;
        }
        if (sourceKey === 'publish_response') {
            return shouldApplyPublishResponseSnapshot(entry, snapshot);
        }
        if (sourceKey === 'stream' && hasNewerQueuedPublish(entry.sequence)) {
            return false;
        }
        return true;
    }

    function applySnapshotThroughCoordinator(snapshot, options) {
        const opts = options || {};
        const trackedPublish = opts.trackedPublish || null;
        const source = typeof opts.source === 'string' ? opts.source : '';
        const applyOptions = (opts.applyOptions && typeof opts.applyOptions === 'object')
            ? opts.applyOptions
            : {};

        if (!shouldApplyTrackedPublishSnapshot(trackedPublish, snapshot, source)) {
            return false;
        }

        const applied = applySnapshot(snapshot, applyOptions);
        if (applied && trackedPublish) {
            markTrackedPublishSnapshotApplied(trackedPublish, snapshot, source);
        }
        if (applied) {
            const appliedVersion = getSnapshotStateVersion(snapshot);
            if (appliedVersion !== null) {
                state.appliedStateVersion = appliedVersion;
            }
        }
        return applied;
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

    function shouldSkipForceSyncSnapshot(snapshot, options) {
        const remoteVersion = getSnapshotStateVersion(snapshot);
        const localVersion = getAppliedStateVersion();
        const pendingLocalPublish = hasPendingLocalPublishes(options);
        const preserveLocalPendingHint = hasLocalDeferredPendingHint()
            && remoteVersion !== null
            && localVersion !== null
            && remoteVersion <= localVersion;

        if (!pendingLocalPublish && !preserveLocalPendingHint) return false;

        if (remoteVersion === null) return true;
        if (localVersion === null) return false;
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
        state.lastStreamEventId = '';
        state.appliedStateVersion = getSnapshotStateVersion(data && data.snapshot);
        clearPendingForceSyncPlaybackRecovery();
        invokeControllerMethod(getNetworkSessionSeatController, 'activateSessionFromResponse', arguments, undefined);
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

    function isMatchApiMissing(res) {
        return !!(res && Number(res.status) === 404);
    }

    function shouldRetryJoinWithoutStoredClaim(res) {
        const reason = String(res && res.data && res.data.reason ? res.data.reason : '').trim();
        return reason === 'ROOM_FULL' || reason === 'SEAT_TOKEN_MISMATCH';
    }

    function ensureActionBridge() {
        if (state.actionBridgeInstalled) return true;
        if (!root.TurnPipelineUIAdapter || typeof root.TurnPipelineUIAdapter.runTurnWithAdapter !== 'function') return false;

        state.originalRunTurnWithAdapter = root.TurnPipelineUIAdapter.runTurnWithAdapter;

        root.TurnPipelineUIAdapter.runTurnWithAdapter = function wrappedRunTurnWithAdapter(cardStateArg, gameStateArg, playerKey, action, turnPipeline) {
            // --- Single Writer: network active 時はローカル実行をスキップ ---
            if (state.active) {
                const actionType = action && (action.type || action.actionType) ? String(action.type || action.actionType) : '';
                const shouldDeferNetworkPublish = !!(action && action.deferNetworkPublish === true);
                const isBoardPlacement = action && Number.isFinite(action.row) && Number.isFinite(action.col);
                const isPass = actionType === 'pass';
                if (!shouldDeferNetworkPublish && (isBoardPlacement || isPass)) {
                    const publishPromise = publishSnapshot({
                        playerKey: normalizePlayerKey(playerKey),
                        actionType: isBoardPlacement ? 'place' : 'pass',
                        playbackEvents: [],
                        action
                    });
                    return { ok: true, skippedLocalExecution: true, playbackEvents: [], publishPromise };
                }

                // Phase 2: cancel_card / destroy_hand_card — skip local, publish directly
                if (!shouldDeferNetworkPublish && (actionType === 'cancel_card' || actionType === 'destroy_hand_card')) {
                    const publishPromise = publishSnapshot({
                        playerKey: normalizePlayerKey(playerKey),
                        actionType,
                        playbackEvents: [],
                        action
                    });
                    return { ok: true, skippedLocalExecution: true, playbackEvents: [], publishPromise };
                }

                // Phase 2: use_card
                if (actionType === 'use_card') {
                    const cardId = action && (action.useCardId || action.cardId);
                    const cardType = resolveCardTypeForId(cardId);
                    const canResolvePendingType = !!cardType;
                    const needsPending = !!(canResolvePendingType
                        && PendingSelectionFlow
                        && typeof PendingSelectionFlow.shouldDeferNetworkPublishForPendingType === 'function'
                        && PendingSelectionFlow.shouldDeferNetworkPublishForPendingType(cardType));

                    if (canResolvePendingType && !needsPending) {
                        // No-target card: skip local, publish directly
                        const publishPromise = publishSnapshot({
                            playerKey: normalizePlayerKey(playerKey),
                            actionType: 'use_card',
                            playbackEvents: [],
                            action
                        });
                        return { ok: true, skippedLocalExecution: true, playbackEvents: [], publishPromise };
                    }

                    if (!canResolvePendingType) {
                        return {
                            ok: false,
                            rejectedReason: 'PENDING_CARD_TYPE_UNRESOLVED',
                            cardId: cardId || null
                        };
                    }

                    if (!PendingCoordinatorModule || typeof PendingCoordinatorModule.setPendingHintLocally !== 'function') {
                        return {
                            ok: false,
                            rejectedReason: 'PENDING_HINT_COORDINATOR_UNAVAILABLE',
                            cardType
                        };
                    }
                    const pendingHintResult = PendingCoordinatorModule.setPendingHintLocally(
                        cardStateArg,
                        normalizePlayerKey(playerKey),
                        cardType,
                        { cardId }
                    );
                    if (!pendingHintResult || pendingHintResult.ok !== true) {
                        return {
                            ok: false,
                            rejectedReason: 'PENDING_HINT_UNAVAILABLE',
                            cardType
                        };
                    }
                    const playbackEvents = shouldRestorePendingCardUsePlayback(cardType)
                        ? buildPendingCardUsePlaybackEvents(playerKey, cardId, cardType)
                        : [];
                    return {
                        ok: true,
                        pendingSelectionActive: true,
                        playbackEvents,
                        nextCardState: cardStateArg,
                        nextGameState: gameStateArg
                    };
                }
            }

            const result = state.originalRunTurnWithAdapter.call(root.TurnPipelineUIAdapter, cardStateArg, gameStateArg, playerKey, action, turnPipeline);

            if (state.active && result && result.ok !== false) {
                const shouldDeferNetworkPublish = !!(action && action.deferNetworkPublish === true);
                const pendingType = (() => {
                    try {
                        const normalizedPlayerKey = normalizePlayerKey(playerKey);
                        const pendingByPlayer = (result.nextCardState && result.nextCardState.pendingEffectByPlayer)
                            ? result.nextCardState.pendingEffectByPlayer
                            : (cardStateArg && cardStateArg.pendingEffectByPlayer);
                        const pending = pendingByPlayer && pendingByPlayer[normalizedPlayerKey];
                        return pending && pending.type ? String(pending.type) : null;
                    } catch (e) {
                        return null;
                    }
                })();
                const shouldDeferPendingSelection = !!(
                    PendingSelectionFlow
                    && typeof PendingSelectionFlow.shouldDeferNetworkPublishForPendingType === 'function'
                    && PendingSelectionFlow.shouldDeferNetworkPublishForPendingType(pendingType)
                );
                if (!shouldDeferNetworkPublish && !shouldDeferPendingSelection) {
                    publishSnapshot({
                        playerKey: normalizePlayerKey(playerKey),
                        actionType: action && (action.type || action.actionType) ? String(action.type || action.actionType) : 'action',
                        playbackEvents: Array.isArray(result.playbackEvents) ? result.playbackEvents : [],
                        action
                    });
                }
            }

            return result;
        };

        state.actionBridgeInstalled = true;
        return true;
    }

    function teardownActionBridge() {
        if (!state.actionBridgeInstalled) return;
        if (root.TurnPipelineUIAdapter && state.originalRunTurnWithAdapter) {
            root.TurnPipelineUIAdapter.runTurnWithAdapter = state.originalRunTurnWithAdapter;
        }
        state.originalRunTurnWithAdapter = null;
        state.actionBridgeInstalled = false;
    }

    function clearReconnectTimer() {
        if (state.reconnectTimerId !== null) {
            clearScheduledTimeout(state.reconnectTimerId);
            state.reconnectTimerId = null;
        }
    }

    function clearReconnectRecoveryTimer() {
        if (state.reconnectRecoveryTimerId !== null) {
            clearScheduledTimeout(state.reconnectRecoveryTimerId);
            state.reconnectRecoveryTimerId = null;
        }
    }

    function completeReconnectRecoveryFromStream() {
        if (!state.reconnectRecoveryPending) return;
        state.reconnectRecoveryPending = false;
        clearReconnectRecoveryTimer();
    }

    function scheduleReconnectRecoverySync() {
        clearReconnectRecoveryTimer();
        state.reconnectRecoveryPending = true;
        state.reconnectRecoveryTimerId = scheduleTimeout(() => {
            state.reconnectRecoveryTimerId = null;
            if (!state.reconnectRecoveryPending) return;
            state.reconnectRecoveryPending = false;
            syncLatestStateWithRetry({ maxAttempts: 3, baseDelayMs: 350 }).catch(() => {
                // Keep stream path resilient; next snapshot or reconnect will recover.
            });
        }, RECONNECT_STREAM_RECOVERY_WAIT_MS);
    }

    function clearStreamWatchdogTimer() {
        if (!state.streamWatchdogTimerId) return;
        clearScheduledTimeout(state.streamWatchdogTimerId);
        state.streamWatchdogTimerId = 0;
    }

    function markStreamActivity() {
        state.lastStreamActivityAt = Date.now();
    }

    function rememberStreamEventId(event) {
        const eventId = String(
            event && typeof event === 'object'
                ? (event.lastEventId || event.eventId || '')
                : ''
        ).trim();
        if (!eventId) return;
        state.lastStreamEventId = eventId;
    }

    function scheduleStreamWatchdog() {
        clearStreamWatchdogTimer();
        if (!isActive()) return;
        if (!state.eventSource) return;

        state.streamWatchdogTimerId = scheduleTimeout(() => {
            state.streamWatchdogTimerId = 0;
            if (!isActive()) return;
            if (!state.eventSource) return;

            const lastActivityAt = Number.isFinite(Number(state.lastStreamActivityAt))
                ? Number(state.lastStreamActivityAt)
                : 0;
            const elapsedMs = Date.now() - lastActivityAt;

            if (elapsedMs >= STREAM_STALE_TIMEOUT_MS) {
                emitStatus('ネット対戦: 配信接続の応答がないため再接続します', true);
                try {
                    if (state.eventSource) {
                        state.eventSource.close();
                    }
                } catch (e) { /* ignore */ }
                state.eventSource = null;
                scheduleStreamReconnect();
                return;
            }

            scheduleStreamWatchdog();
        }, STREAM_WATCHDOG_INTERVAL_MS);
    }

    function scheduleStreamReconnect() {
        if (!isActive()) return;
        if (state.reconnectTimerId !== null) return;

        const attempt = Number.isFinite(Number(state.reconnectAttempt))
            ? Number(state.reconnectAttempt)
            : 0;
        const delayMs = computeRetryDelayMs(RECONNECT_BASE_DELAY_MS, RECONNECT_MAX_DELAY_MS, attempt);
        state.reconnectAttempt = attempt + 1;

        state.reconnectTimerId = scheduleTimeout(() => {
            state.reconnectTimerId = null;
            if (!isActive()) return;
            openStream({ reconnect: true });
        }, delayMs);
    }

    function closeStream() {
        clearReconnectTimer();
        clearReconnectRecoveryTimer();
        state.reconnectRecoveryPending = false;
        clearStreamWatchdogTimer();
        if (state.eventSource) {
            try { state.eventSource.close(); } catch (e) { /* ignore */ }
            state.eventSource = null;
        }
        state.lastStreamActivityAt = 0;
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

            let applied = applySnapshotThroughCoordinator(snapshot, {
                source: 'stream',
                trackedPublish,
                applyOptions: {
                    playbackEvents,
                    force: false,
                    skipResultOverlay: isSelfOperation && !isTerminalResultSnapshot
                }
            });
            const recoveredForcedPlayback = !applied && shouldRecoverForceSyncedStreamPlayback(snapshot, playbackEvents)
                ? applySnapshot(snapshot, {
                    force: true,
                    playbackEvents,
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

    async function createRoom(options) {
        const opts = options || {};
        if (opts.serverUrl) setServerUrl(opts.serverUrl);

        const playerName = normalizePlayerName(opts.playerName);
        if (!playerName) {
            emitStatus(`ニックネームを1〜${PLAYER_NAME_MAX}文字で入力してください`, true);
            return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
        }

        const requestPayload = { playerName };
        if (opts.networkDebugEnabled === true) {
            requestPayload.networkDebugEnabled = true;
        }
        if (opts.deckCode) {
            requestPayload.deckCode = String(opts.deckCode).trim();
        }
        if (opts.roomBoardConfig && typeof opts.roomBoardConfig === 'object') {
            requestPayload.roomBoardConfig = cloneDataForCommandPayload(opts.roomBoardConfig);
        }

        const res = await requestJson('POST', '/api/match/create', requestPayload);
        if (!res.ok || !res.data || res.data.ok !== true) {
            if (isMatchApiMissing(res)) {
                emitStatus('ネット対戦: 対戦用API(/api/match)が見つかりません', true);
                return { ok: false, reason: 'MATCH_API_NOT_FOUND' };
            }
            if (res.data && res.data.reason === 'PLAYER_NAME_REQUIRED') {
                emitStatus(`ニックネームを1〜${PLAYER_NAME_MAX}文字で入力してください`, true);
                return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
            }
            emitStatus('部屋作成に失敗しました', true);
            return { ok: false, reason: (res.data && res.data.reason) || 'CREATE_FAILED' };
        }

        activateSessionFromResponse(Object.assign({}, res.data, { playerName }), '');
        resetNetworkTelemetry();

        openStream();
        emitStatus(`ネット対戦: 部屋 ${state.roomId} を作成（${state.seatKey === 'black' ? '黒' : '白'}）`);

        return {
            ok: true,
            roomId: state.roomId,
            seatKey: state.seatKey,
            playerName,
            networkDebugEnabled: state.networkDebugEnabled === true
        };
    }

    async function joinRoom(roomId, options) {
        const opts = options || {};
        if (opts.serverUrl) setServerUrl(opts.serverUrl);

        const playerName = normalizePlayerName(opts.playerName);
        if (!playerName) {
            emitStatus(`ニックネームを1〜${PLAYER_NAME_MAX}文字で入力してください`, true);
            return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
        }

        const normalizedRoomId = normalizeRoomId(roomId);
        if (!normalizedRoomId) {
            emitStatus('部屋番号を入力してください', true);
            return { ok: false, reason: 'ROOM_ID_REQUIRED' };
        }
        if (!ROOM_ID_RE.test(normalizedRoomId)) {
            emitStatus(`部屋番号は英数字${ROOM_ID_LENGTH}文字で入力してください`, true);
            return { ok: false, reason: 'ROOM_ID_INVALID' };
        }

        const joinPayload = { roomId: normalizedRoomId, playerName };
        if (opts.deckCode) {
            joinPayload.deckCode = String(opts.deckCode).trim();
        }
        const storedClaim = readSeatClaim(normalizedRoomId);
        let usedStoredClaim = false;
        if (storedClaim) {
            joinPayload.seatKey = storedClaim.seatKey;
            joinPayload.seatToken = storedClaim.seatToken;
            usedStoredClaim = true;
        }
        let res = await requestJson('POST', '/api/match/join', joinPayload);
        if ((!res.ok || !res.data || res.data.ok !== true) && usedStoredClaim && shouldRetryJoinWithoutStoredClaim(res)) {
            clearSeatClaim(normalizedRoomId);
            const retryPayload = { roomId: normalizedRoomId, playerName };
            if (opts.deckCode) {
                retryPayload.deckCode = String(opts.deckCode).trim();
            }
            res = await requestJson('POST', '/api/match/join', retryPayload);
        }
        if (!res.ok || !res.data || res.data.ok !== true) {
            if (isMatchApiMissing(res)) {
                emitStatus('ネット対戦: 対戦用API(/api/match)が見つかりません', true);
                return { ok: false, reason: 'MATCH_API_NOT_FOUND' };
            }
            if (res.data && res.data.reason === 'PLAYER_NAME_REQUIRED') {
                emitStatus(`ニックネームを1〜${PLAYER_NAME_MAX}文字で入力してください`, true);
                return { ok: false, reason: 'PLAYER_NAME_REQUIRED' };
            }
            emitStatus('部屋参加に失敗しました', true);
            return { ok: false, reason: (res.data && res.data.reason) || 'JOIN_FAILED' };
        }

        activateSessionFromResponse(Object.assign({}, res.data, { playerName }), normalizedRoomId);
        resetNetworkTelemetry();

        openStream();
        emitStatus(`ネット対戦: 部屋 ${state.roomId} ${res.data.rejoined ? 'へ再参加' : 'に参加'}（${state.seatKey === 'black' ? '黒' : '白'}）`);

        return {
            ok: true,
            roomId: state.roomId,
            seatKey: state.seatKey,
            playerName,
            networkDebugEnabled: state.networkDebugEnabled === true
        };
    }

    async function syncLatestState() {
        if (!state.roomId) return { ok: false, reason: 'NO_ROOM' };
        const path = `/api/match/state?roomId=${encodeURIComponent(state.roomId)}&seatKey=${encodeURIComponent(state.seatKey)}&seatToken=${encodeURIComponent(state.seatToken || '')}`;
        const res = await requestJson('GET', path);
        if (!res.ok || !res.data || res.data.ok !== true) {
            return { ok: false, reason: (res.data && res.data.reason) || 'STATE_FETCH_FAILED' };
        }
        applyPayloadSessionState(res.data);
        let appliedSnapshot = false;
        if (res.data.snapshot) {
            if (!shouldSkipForceSyncSnapshot(res.data.snapshot)) {
                appliedSnapshot = applySnapshotThroughCoordinator(res.data.snapshot, {
                    source: 'state_sync',
                    applyOptions: { force: true }
                });
                if (appliedSnapshot) {
                    rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
                        source: 'state_sync',
                        force: true,
                        playbackEvents: []
                    });
                }
                recordNetworkTelemetry('state_sync_snapshot_applied', {
                    snapshotVersion: getSnapshotStateVersion(res.data.snapshot),
                    force: true
                });
            } else {
                recordNetworkTelemetry('state_sync_snapshot_skipped', {
                    snapshotVersion: getSnapshotStateVersion(res.data.snapshot),
                    localVersion: Number.isFinite(Number(state.stateVersion)) ? Number(state.stateVersion) : null
                });
            }
        }
        return { ok: true, appliedSnapshot };
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

    async function leaveRoom() {
        clearPlaybackStateForLeave();
        clearPendingForceSyncPlaybackRecovery();
        if (!state.roomId) {
            const controller = getNetworkSessionSeatController();
            if (controller && typeof controller.resetSessionState === 'function') {
                controller.resetSessionState();
            } else {
                state.active = false;
                state.seatNames = { black: '', white: '' };
            }
            resetPublishTracker();
            resetNetworkTelemetry();
            resetTurnTimerState();
            closeStream();
            state.lastStreamEventId = '';
            teardownActionBridge();
            return { ok: true };
        }

        const roomId = state.roomId;
        const seatKey = state.seatKey;
        const seatToken = state.seatToken;
        let leaveResponse = null;

        try {
            leaveResponse = await requestJson('POST', '/api/match/leave', { roomId, seatKey, seatToken });
        } catch (e) {
            emitStatus('ネット対戦: 部屋の退出に失敗しました');
            return { ok: false, reason: 'LEAVE_REQUEST_FAILED' };
        }

        const leaveReason = String(leaveResponse && leaveResponse.data && leaveResponse.data.reason ? leaveResponse.data.reason : '').trim();
        if (!(leaveResponse && leaveResponse.ok) && leaveReason !== 'ROOM_NOT_FOUND') {
            emitStatus(`ネット対戦: 部屋の退出に失敗しました (${leaveReason || 'LEAVE_FAILED'})`);
            return {
                ok: false,
                reason: leaveReason || 'LEAVE_FAILED',
                status: leaveResponse ? leaveResponse.status : 0
            };
        }

        const controller = getNetworkSessionSeatController();
        if (controller && typeof controller.resetSessionState === 'function') {
            controller.resetSessionState();
        } else {
            state.active = false;
            state.roomId = '';
            state.seatKey = 'black';
            state.seatToken = '';
            state.roomSeats = { black: false, white: false };
            state.seatNames = { black: '', white: '' };
            state.networkDebugEnabled = false;
            state.chatHistory = [];
            state.stateVersion = null;
            state.appliedStateVersion = null;
            resetPublishTracker();
            state.lastResultVersionShown = null;
            state.resultShownForUnversioned = false;
        }
        state.appliedStateVersion = null;
        resetPublishTracker();
        resetNetworkTelemetry();
        resetTurnTimerState();
        closeStream();
        state.lastStreamEventId = '';
        teardownActionBridge();
        setSeatGlobals('black');
        clearSeatClaim(roomId);
        emitRoomStateChanged();

        emitStatus('ネット対戦: 部屋から退出しました');
        return { ok: true };
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
        const commandPayload = buildPublishCommandPayload(info, playerKey);
        if (!commandPayload) {
            return Promise.resolve({ ok: false, reason: 'COMMAND_REQUIRED' });
        }
        const queuedPlaybackEvents = sanitizePlaybackEventsForPublish(info.playbackEvents);
        const queuedActionType = (commandPayload && commandPayload.actionType)
            ? commandPayload.actionType
            : (info.actionType || null);
        const operationId = createOperationId();
        const trackedPublish = createTrackedPublish(operationId, {
            actionType: queuedActionType,
            actor: commandPayload ? (commandPayload.actor || playerKey) : playerKey,
            params: commandPayload ? (commandPayload.params || {}) : null,
            playbackEvents: queuedPlaybackEvents,
            usedSnapshotFallback: false
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

                const payload = {
                    roomId: state.roomId,
                    seatKey: state.seatKey,
                    seatToken: state.seatToken,
                    playerKey,
                    actionType: queuedActionType,
                    operationId,
                    baseVersion: state.stateVersion
                };

                if (commandPayload) {
                    payload.actor = commandPayload.actor || playerKey;
                    payload.params = commandPayload.params || {};
                    if (commandPayload.actionId) {
                        payload.actionId = commandPayload.actionId;
                    }
                    if (Number.isFinite(Number(commandPayload.turnIndex))) {
                        payload.turnIndex = Math.trunc(Number(commandPayload.turnIndex));
                    }
                }
                if (info.action && typeof info.action === 'object') {
                    payload.action = cloneDataForCommandPayload(info.action);
                }

                markTrackedPublishInFlight(trackedPublish);
                const res = await publishRequestWithRetry(payload);
                if (!res.ok || !res.data || res.data.ok !== true) {
                    const reason = (res.data && res.data.rejectedReason) || 'PUBLISH_REJECTED';
                    applyPayloadSessionState(res.data);
                    const rejectionHandling = resolveRejectedPublishSnapshotHandling(trackedPublish, res.data, reason);
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
                    state.stateVersion = responseStateVersion;
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
                    const applied = applySnapshotThroughCoordinator(res.data.snapshot, {
                        source: 'publish_response',
                        trackedPublish,
                        applyOptions: {
                            force: true,
                            playbackEvents: serverPlaybackEvents,
                            skipResultOverlay: hasTrackedPublishPresentedResult(trackedPublish)
                        }
                    });
                    if (applied) {
                        rememberPendingForceSyncPlaybackRecovery(res.data.snapshot, {
                            source: 'publish_response',
                            force: true,
                            playbackEvents: serverPlaybackEvents
                        });
                        emitPayloadEffectLogs(res.data);
                        recordNetworkTelemetry('publish_response_snapshot_applied', {
                            operationId,
                            applied,
                            responseStateVersion,
                            playbackEventCount: serverPlaybackEvents.length
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

    const api = {
        isActive,
        setStatusWriter,
        setServerUrl,
        getServerUrl,
        setRoomStateListener,
        setTurnTimerListener,
        getRoomSeats,
        getSeatNames,
        hasTwoPlayers,
        setChatListener,
        getChatMaxLength,
        sendChatMessage,
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

    root.NetworkMatchClient = api;
}(typeof window !== 'undefined' ? window : globalThis));
