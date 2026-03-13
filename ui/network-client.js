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
    const STREAM_STALE_TIMEOUT_MS = 45000;
    const PUBLISH_RETRY_MAX_ATTEMPTS = 3;
    const PUBLISH_RETRY_BASE_DELAY_MS = 400;
    const PUBLISH_RETRY_MAX_DELAY_MS = 4000;
    const PlaybackStateModule = (typeof require === 'function')
        ? (() => {
            try { return require('./playback-state-manager'); } catch (e) { return root.PlaybackStateManager || null; }
        })()
        : (root.PlaybackStateManager || null);

    function setSuppressNextDiffFlip() {
        try {
            if (PlaybackStateModule && typeof PlaybackStateModule.setSuppressNextDiffFlip === 'function') {
                PlaybackStateModule.setSuppressNextDiffFlip(true);
            } else {
                root.__suppressNextDiffFlip = true;
            }
        } catch (e) { /* ignore */ }
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
        serverUrl: deriveInitialServerUrl(),
        stateVersion: null,
        eventSource: null,
        lastStreamActivityAt: 0,
        streamWatchdogTimerId: 0,
        statusWriter: null,
        roomStateListener: null,
        chatListener: null,
        chatHistory: [],
        originalRunTurnWithAdapter: null,
        actionBridgeInstalled: false,
        publishChain: Promise.resolve(),
        queuedPublishSequence: 0,
        lastPublishedOperationId: null,
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
        heartbeatResyncInFlight: false
    };

    let networkCommentaryModule = null;
    let networkSnapshotModule = null;
    let networkSessionSeatModule = null;
    let networkCommentaryController = null;
    let networkSnapshotController = null;
    let networkSessionSeatController = null;
    let ownerHelpers = null;

    if (typeof require === 'function') {
        try { networkCommentaryModule = require('./network/commentary'); } catch (e) { /* ignore */ }
        try { networkSnapshotModule = require('./network/snapshot'); } catch (e) { /* ignore */ }
        try { networkSessionSeatModule = require('./network/session-seat'); } catch (e) { /* ignore */ }
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
            getState: () => state
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
        try {
            if (typeof addLog === 'function') {
                addLog(String(text || ''));
            }
        } catch (e) { /* ignore */ }
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

        const localVersion = Number.isFinite(Number(state.stateVersion))
            ? Number(state.stateVersion)
            : null;

        if (localVersion !== null && remoteVersion <= localVersion) return;
        if (state.heartbeatResyncInFlight) return;

        state.heartbeatResyncInFlight = true;
        syncLatestStateWithRetry({ maxAttempts: 2, baseDelayMs: 300 })
            .catch(() => {
                // Keep heartbeat path non-blocking even if sync fails.
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
            setTimeout(resolve, waitMs);
        });
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
        try { clearTimeout(state.turnTimerTickHandle); } catch (e) { /* ignore */ }
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
        state.turnTimerTickHandle = setTimeout(() => {
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
        return invokeControllerMethod(getNetworkSnapshotController, 'applySnapshot', arguments, false);
    }

    function activateSessionFromResponse(data, fallbackRoomId) {
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
                timeoutId = setTimeout(() => {
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
                try { clearTimeout(timeoutId); } catch (e) { /* ignore */ }
            }
        }
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
            const result = state.originalRunTurnWithAdapter.call(root.TurnPipelineUIAdapter, cardStateArg, gameStateArg, playerKey, action, turnPipeline);

            if (state.active && result && result.ok !== false) {
                const isBoardPlacement = action && Number.isFinite(action.row) && Number.isFinite(action.col);
                const shouldDeferNetworkPublish = !!(action && action.deferNetworkPublish === true);
                if (!isBoardPlacement && !shouldDeferNetworkPublish) {
                    const nextSnapshot = (result.nextGameState && result.nextCardState)
                        ? {
                            gameState: result.nextGameState,
                            cardState: result.nextCardState
                        }
                        : null;
                    publishSnapshot({
                        playerKey: normalizePlayerKey(playerKey),
                        actionType: action && action.type ? String(action.type) : 'action',
                        playbackEvents: Array.isArray(result.playbackEvents) ? result.playbackEvents : [],
                        snapshot: nextSnapshot
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
            try { clearTimeout(state.reconnectTimerId); } catch (e) { /* ignore */ }
            state.reconnectTimerId = null;
        }
    }

    function clearStreamWatchdogTimer() {
        if (!state.streamWatchdogTimerId) return;
        try { clearTimeout(state.streamWatchdogTimerId); } catch (e) { /* ignore */ }
        state.streamWatchdogTimerId = 0;
    }

    function markStreamActivity() {
        state.lastStreamActivityAt = Date.now();
    }

    function scheduleStreamWatchdog() {
        clearStreamWatchdogTimer();
        if (!isActive()) return;
        if (!state.eventSource) return;

        state.streamWatchdogTimerId = setTimeout(() => {
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

        state.reconnectTimerId = setTimeout(() => {
            state.reconnectTimerId = null;
            if (!isActive()) return;
            openStream({ reconnect: true });
        }, delayMs);
    }

    function closeStream() {
        clearReconnectTimer();
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

        const streamUrl = `${withTrailingSlashRemoved(state.serverUrl)}/api/match/stream?roomId=${encodeURIComponent(state.roomId)}&seatKey=${encodeURIComponent(state.seatKey)}&seatToken=${encodeURIComponent(state.seatToken || '')}`;
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
            let acceptedPlaybackEvents = playbackEvents;
            const isSelfOperation = !!(operationId && state.lastPublishedOperationId && operationId === state.lastPublishedOperationId);
            if (isSelfOperation) {
                acceptedPlaybackEvents = [];
                if (playbackEvents.length > 0) {
                    setSuppressNextDiffFlip();
                }
                state.lastPublishedOperationId = null;
            }
            const applied = applySnapshot(snapshot, { playbackEvents: acceptedPlaybackEvents, force: false, skipResultOverlay: isSelfOperation });
            if (applied) {
                emitSnapshotCommentary(payload, snapshot, isSelfOperation, acceptedPlaybackEvents);
            }
            handleTimeoutPassPayload(payload);
        };

        const handleStreamEvent = createStreamPayloadHandler(onSnapshot);
        const handlePresenceEvent = createStreamPayloadHandler(handlePresencePayload);
        const handleChatEvent = createStreamPayloadHandler(handleChatPayload);
        const handleHeartbeatEvent = createStreamPayloadHandler((payload) => {
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
                syncLatestStateWithRetry({ maxAttempts: 3, baseDelayMs: 350 }).catch(() => {
                    // Keep stream path resilient; next snapshot or reconnect will recover.
                });
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
        if (opts.deckCode) {
            requestPayload.deckCode = String(opts.deckCode).trim();
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

        openStream();
        emitStatus(`ネット対戦: 部屋 ${state.roomId} を作成（${state.seatKey === 'black' ? '黒' : '白'}）`);

        return { ok: true, roomId: state.roomId, seatKey: state.seatKey, playerName };
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

        openStream();
        emitStatus(`ネット対戦: 部屋 ${state.roomId} ${res.data.rejoined ? 'へ再参加' : 'に参加'}（${state.seatKey === 'black' ? '黒' : '白'}）`);

        return { ok: true, roomId: state.roomId, seatKey: state.seatKey, playerName };
    }

    async function syncLatestState() {
        if (!state.roomId) return { ok: false, reason: 'NO_ROOM' };
        const path = `/api/match/state?roomId=${encodeURIComponent(state.roomId)}&seatKey=${encodeURIComponent(state.seatKey)}&seatToken=${encodeURIComponent(state.seatToken || '')}`;
        const res = await requestJson('GET', path);
        if (!res.ok || !res.data || res.data.ok !== true) {
            return { ok: false, reason: (res.data && res.data.reason) || 'STATE_FETCH_FAILED' };
        }
        applyPayloadSessionState(res.data);
        if (res.data.snapshot) {
            applySnapshot(res.data.snapshot, { force: true });
        }
        return { ok: true };
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
        if (!state.roomId) {
            const controller = getNetworkSessionSeatController();
            if (controller && typeof controller.resetSessionState === 'function') {
                controller.resetSessionState();
            } else {
                state.active = false;
                state.seatNames = { black: '', white: '' };
            }
            resetTurnTimerState();
            closeStream();
            teardownActionBridge();
            return { ok: true };
        }

        const roomId = state.roomId;
        const seatKey = state.seatKey;
        const seatToken = state.seatToken;

        try {
            await requestJson('POST', '/api/match/leave', { roomId, seatKey, seatToken });
        } catch (e) { /* ignore */ }

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
            state.chatHistory = [];
            state.stateVersion = null;
            state.queuedPublishSequence = 0;
            state.lastResultVersionShown = null;
            state.resultShownForUnversioned = false;
        }
        resetTurnTimerState();
        closeStream();
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

    function hasNewerQueuedPublish(sequence) {
        const queuedSequence = Number.isFinite(Number(state.queuedPublishSequence))
            ? Number(state.queuedPublishSequence)
            : 0;
        const currentSequence = Number.isFinite(Number(sequence))
            ? Number(sequence)
            : 0;
        return queuedSequence > currentSequence;
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
        const queuedSnapshot = getCurrentSnapshotForPublish(info);
        if (!queuedSnapshot) {
            return Promise.resolve({ ok: false, reason: 'SNAPSHOT_FAILED' });
        }
        const queuedPlaybackEvents = Array.isArray(info.playbackEvents) ? info.playbackEvents.slice() : [];
        const queuedActionType = info.actionType || null;
        const queuedPublishSequence = (Number.isFinite(Number(state.queuedPublishSequence))
            ? Number(state.queuedPublishSequence)
            : 0) + 1;
        state.queuedPublishSequence = queuedPublishSequence;

        const operationId = createOperationId();

        state.publishChain = state.publishChain
            .then(async () => {
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
                    playerKey,
                    actionType: queuedActionType,
                    playbackEvents: queuedPlaybackEvents,
                    operationId,
                    baseVersion: state.stateVersion,
                    snapshot: queuedSnapshot
                };

                state.lastPublishedOperationId = operationId;
                const res = await publishRequestWithRetry(payload);
                if (!res.ok || !res.data || res.data.ok !== true) {
                    const reason = (res.data && res.data.rejectedReason) || 'PUBLISH_REJECTED';
                    applyPayloadSessionState(res.data);
                    if (state.lastPublishedOperationId === operationId) {
                        state.lastPublishedOperationId = null;
                    }
                    if (res.data && res.data.snapshot) {
                        applySnapshot(res.data.snapshot, { force: true });
                    }
                    emitStatus(`ネット対戦: 操作が拒否されました (${reason})`, true);
                    return { ok: false, reason };
                }
                applyPayloadSessionState(res.data);
                if (Number.isFinite(Number(res.data.stateVersion))) {
                    state.stateVersion = Number(res.data.stateVersion);
                }
                if (res.data && res.data.snapshot && !hasNewerQueuedPublish(queuedPublishSequence)) {
                    applySnapshot(res.data.snapshot, { force: true });
                }
                return { ok: true };
            })
            .catch((error) => {
                const message = error && error.message ? error.message : 'PUBLISH_ERROR';
                if (state.lastPublishedOperationId === operationId) {
                    state.lastPublishedOperationId = null;
                }
                emitStatus(`ネット対戦: 通信失敗 (${message})`, true);
                return { ok: false, reason: 'PUBLISH_ERROR' };
            });

        return state.publishChain;
    }

    async function requestRematch() {
        if (!isActive()) return { ok: false, reason: 'INACTIVE' };

        const makeRequest = () => publishSnapshot({
            playerKey: state.seatKey,
            actionType: 'reset_game',
            playbackEvents: []
        });

        let firstResult = null;
        try {
            firstResult = await makeRequest();
        } catch (e) {
            return { ok: false, reason: 'REMATCH_REQUEST_FAILED' };
        }

        if (firstResult && firstResult.ok === true) return firstResult;
        if (!firstResult || firstResult.reason !== 'VERSION_MISMATCH') return firstResult || { ok: false, reason: 'REMATCH_REQUEST_FAILED' };

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
        getStateVersion,
        getRoomDeck
    };

    root.NetworkMatchClient = api;
}(typeof window !== 'undefined' ? window : globalThis));
