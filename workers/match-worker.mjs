import deepClone from '../utils/deepClone.js';
import matchAuthority from '../utils/match-authority.js';
import networkActionSchemaModule from '../shared/network-action-schema.js';
import playbackEventHelpersModule from '../shared/playback-event-helpers.js';

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 3;
const SEAT_TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SEAT_TOKEN_LENGTH = 24;
const ROOM_STORAGE_KEY = 'match_room_state_v1';
const MatchAuthority = matchAuthority || {};
const NetworkActionSchema = networkActionSchemaModule || {};
const PlaybackEventHelpers = playbackEventHelpersModule || {};
const PLAYER_KEYS = Array.isArray(MatchAuthority.PLAYER_KEYS) ? MatchAuthority.PLAYER_KEYS : Object.freeze(['black', 'white']);
const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;
const NETWORK_PLAYER_NAME_MAX = 7;
const LEADERBOARD_STORAGE_KEY = 'global_score_leaderboard_v3';
const LEADERBOARD_STORAGE_VERSION = 3;
const LEADERBOARD_ROOM_ID = '__leaderboard__';
const LEADERBOARD_PLAYER_NAME_MAX = NETWORK_PLAYER_NAME_MAX;
const LEADERBOARD_DEFAULT_LIMIT = 10;
const LEADERBOARD_MAX_LIMIT = 100;
const LEADERBOARD_MAX_STORED_PLAYERS = 200;
const LEADERBOARD_PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const NETWORK_TURN_LIMIT_SECONDS = 120;
const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;
const SSE_HEARTBEAT_INTERVAL_MS = 20000;
const SSE_WRITE_TIMEOUT_MS = 2500;
const NETWORK_DEBUG_FILL_HAND_ACTION = 'debug_fill_hand';
const OPERATION_ID_MAX_LENGTH = Number.isFinite(Number(MatchAuthority.OPERATION_ID_MAX_LENGTH))
    ? Number(MatchAuthority.OPERATION_ID_MAX_LENGTH)
    : 128;

let coreLogicModulePromise = null;
let deckModulesPromise = null;
let turnStartModulesPromise = null;
let turnPipelineModulesPromise = null;
let debugActionsModulePromise = null;

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function withCORS(response) {
    const headers = new Headers(response.headers);
    Object.entries(CORS_HEADERS).forEach(([key, value]) => headers.set(key, value));
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
    });
}

function jsonResponse(statusCode, payload) {
    return new Response(JSON.stringify(payload || {}), {
        status: statusCode,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            ...CORS_HEADERS
        }
    });
}

function normalizePlayerKey(value) {
    if (MatchAuthority && typeof MatchAuthority.normalizePlayerKey === 'function') {
        return MatchAuthority.normalizePlayerKey(value, 'black');
    }
    const parsed = parseSeatKeyOptional(value);
    return parsed || 'black';
}

function parseSeatKeyOptional(value) {
    if (MatchAuthority && typeof MatchAuthority.parseSeatKeyOptional === 'function') {
        return MatchAuthority.parseSeatKeyOptional(value);
    }
    return null;
}

function getCurrentPlayerKey(gameState) {
    if (MatchAuthority && typeof MatchAuthority.getCurrentPlayerKey === 'function') {
        return MatchAuthority.getCurrentPlayerKey(gameState);
    }
    if (!gameState) return 'black';
    return normalizePlayerKey(gameState.currentPlayer);
}

function getOpponentKey(playerKey) {
    if (MatchAuthority && typeof MatchAuthority.getOpponentKey === 'function') {
        return MatchAuthority.getOpponentKey(playerKey);
    }
    return normalizePlayerKey(playerKey) === 'white' ? 'black' : 'white';
}

function makeHiddenHandToken(ownerKey, handIndex) {
    if (MatchAuthority && typeof MatchAuthority.makeHiddenHandToken === 'function') {
        return MatchAuthority.makeHiddenHandToken(ownerKey, handIndex);
    }
    const normalizedOwner = normalizePlayerKey(ownerKey);
    const idx = Number.isFinite(Number(handIndex)) ? Math.max(0, Math.trunc(Number(handIndex))) : 0;
    return `__hidden_hand__:${normalizedOwner}:${idx}`;
}

function parseHiddenHandToken(value) {
    if (MatchAuthority && typeof MatchAuthority.parseHiddenHandToken === 'function') {
        return MatchAuthority.parseHiddenHandToken(value);
    }
    return null;
}

function resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue) {
    if (MatchAuthority && typeof MatchAuthority.resolveAuthenticatedSeatKey === 'function') {
        return MatchAuthority.resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue);
    }
    return null;
}

function normalizeEffectLogMessages(values) {
    if (MatchAuthority && typeof MatchAuthority.normalizeEffectLogMessages === 'function') {
        return MatchAuthority.normalizeEffectLogMessages(values);
    }
    const source = Array.isArray(values) ? values : [];
    const next = [];
    for (let index = 0; index < source.length; index += 1) {
        const text = String(source[index] || '').trim();
        if (!text) continue;
        if (next.length > 0 && next[next.length - 1] === text) continue;
        next.push(text);
    }
    return next;
}

function appendEffectLogMessages(...lists) {
    const merged = [];
    for (let index = 0; index < lists.length; index += 1) {
        const list = Array.isArray(lists[index]) ? lists[index] : [];
        for (let innerIndex = 0; innerIndex < list.length; innerIndex += 1) {
            merged.push(list[innerIndex]);
        }
    }
    return normalizeEffectLogMessages(merged);
}

function getSeatLabelJa(playerKey) {
    return normalizePlayerKey(playerKey) === 'white' ? '白' : '黒';
}

function resolveActionCardId(action) {
    if (!action || typeof action !== 'object') return '';
    if (action.useCardId) return String(action.useCardId);
    if (action.cardId) return String(action.cardId);
    return '';
}

function resolveActionCardDisplayName(action, cardLogic) {
    const cardId = resolveActionCardId(action);
    if (!cardId) return '';
    const cardDef = (cardLogic && typeof cardLogic.getCardDef === 'function')
        ? cardLogic.getCardDef(cardId)
        : null;
    const displayName = cardDef && cardDef.name ? String(cardDef.name).trim() : '';
    return displayName || cardId;
}

function buildNetworkCardUseEffectLogs(action, playerKey, cardLogic) {
    const actionType = String(action && (action.type || action.actionType) ? (action.type || action.actionType) : '').trim().toLowerCase();
    if (actionType !== 'use_card') return [];
    const displayName = resolveActionCardDisplayName(action, cardLogic);
    if (!displayName) return [];
    return [`${getSeatLabelJa(playerKey)}がカードを使用: ${displayName}`];
}

function collectPipelineEffectLogMessages(rawEvents, presentationEvents, playerKey, playbackAdapter) {
    const adapter = (playbackAdapter && typeof playbackAdapter.mapEffectLogsFromPipeline === 'function')
        ? playbackAdapter
        : null;
    if (!adapter) return [];
    try {
        return normalizeEffectLogMessages(
            adapter.mapEffectLogsFromPipeline(rawEvents, presentationEvents, playerKey) || []
        );
    } catch (e) {
        return [];
    }
}

function randomFromChars(chars, length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += chars[bytes[i] % chars.length];
    }
    return out;
}

function makeRoomId() {
    return randomFromChars(ROOM_ID_CHARS, ROOM_ID_LENGTH);
}

function makeSeatToken() {
    return randomFromChars(SEAT_TOKEN_CHARS, SEAT_TOKEN_LENGTH);
}

function loadCoreLogicModule() {
    if (!coreLogicModulePromise) {
        coreLogicModulePromise = import('../game/logic/core.js').then((mod) => mod.default || mod);
    }
    return coreLogicModulePromise;
}

function loadDeckModules() {
    if (!deckModulesPromise) {
        deckModulesPromise = Promise.all([
            import('../shared/deck-spec.js').then((mod) => mod.default || mod),
            import('../shared/deck-codec.js').then((mod) => mod.default || mod)
        ]).then(([deckSpecHelpers, deckCodecModule]) => ({ deckSpecHelpers, deckCodecModule }));
    }
    return deckModulesPromise;
}

function loadTurnStartModules() {
    if (!turnStartModulesPromise) {
        turnStartModulesPromise = Promise.all([
            import('../game/logic/core.js').then((mod) => mod.default || mod),
            import('../game/logic/cards.js').then((mod) => mod.default || mod),
            import('../game/turn/turn_pipeline_phases.js').then((mod) => mod.default || mod),
            import('../game/schema/prng.js').then((mod) => mod.default || mod)
        ]).then(([Core, CardLogic, TurnPipelinePhases, SeededPRNG]) => ({
            Core,
            CardLogic,
            TurnPipelinePhases,
            SeededPRNG
        }));
    }
    return turnStartModulesPromise;
}

function loadTurnPipelineModules() {
    if (!turnPipelineModulesPromise) {
        turnPipelineModulesPromise = Promise.all([
            import('../game/turn/turn_pipeline.js').then((mod) => mod.default || mod),
            import('../game/schema/prng.js').then((mod) => mod.default || mod),
            import('../game/turn/pipeline_ui_adapter.js').then((mod) => mod.default || mod),
            import('../game/logic/cards.js').then((mod) => mod.default || mod)
        ]).then(([TurnPipeline, SeededPRNG, TurnPipelineUIAdapter, CardLogic]) => ({
            TurnPipeline,
            SeededPRNG,
            TurnPipelineUIAdapter,
            CardLogic
        }));
    }
    return turnPipelineModulesPromise;
}

function loadDebugActionsModule() {
    if (!debugActionsModulePromise) {
        debugActionsModulePromise = import('../game/debug/debug-actions.js').then((mod) => mod.default || mod);
    }
    return debugActionsModulePromise;
}

function parseJsonBody(raw) {
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function normalizeRoomId(value) {
    const roomId = String(value || '').trim().toUpperCase();
    return roomId || '';
}

function isNetworkDebugFillHandAction(value) {
    return String(value || '').trim().toLowerCase() === NETWORK_DEBUG_FILL_HAND_ACTION;
}

function isNetworkDebugFillHandPayload(value) {
    if (!value || typeof value !== 'object') return false;
    if (isNetworkDebugFillHandAction(value.actionType)) return true;
    return isNetworkDebugFillHandAction(value.action && value.action.type);
}

function normalizeNetworkPlayerName(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, NETWORK_PLAYER_NAME_MAX).join('');
}

function normalizeOperationId(value) {
    if (MatchAuthority && typeof MatchAuthority.normalizeOperationId === 'function') {
        return MatchAuthority.normalizeOperationId(value);
    }
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return Array.from(normalized).slice(0, OPERATION_ID_MAX_LENGTH).join('');
}

function ensureAcceptedOperationsBySeat(room) {
    if (MatchAuthority && typeof MatchAuthority.ensureAcceptedOperationsBySeat === 'function') {
        return MatchAuthority.ensureAcceptedOperationsBySeat(room);
    }
    return { black: null, white: null };
}

function normalizeLeaderboardPlayerId(value) {
    const normalized = String(value || '').trim();
    if (!LEADERBOARD_PLAYER_ID_RE.test(normalized)) return null;
    return normalized;
}

function normalizeLeaderboardPlayerName(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    const clipped = Array.from(normalized).slice(0, LEADERBOARD_PLAYER_NAME_MAX).join('');
    return clipped || 'ななし';
}

function normalizeLeaderboardMode(value) {
    if (value === 'network') return 'network';
    if (value === 'cpu') return 'cpu';
    return 'cpu';
}

function clampLeaderboardScore(value) {
    const score = Number(value);
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(100000, Math.trunc(score)));
}

function normalizeLeaderboardCpuLevel(value) {
    if (!Number.isFinite(Number(value))) return null;
    const level = Math.trunc(Number(value));
    return Math.max(1, Math.min(6, level));
}

function normalizeLeaderboardLimit(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return LEADERBOARD_DEFAULT_LIMIT;
    return Math.max(1, Math.min(LEADERBOARD_MAX_LIMIT, Math.trunc(parsed)));
}

function normalizeLeaderboardEntry(value, fallbackPlayerId) {
    if (!value || typeof value !== 'object') return null;

    const playerId = normalizeLeaderboardPlayerId(value.playerId || fallbackPlayerId);
    if (!playerId) return null;

    const updatedAt = Number.isFinite(Number(value.updatedAt))
        ? Math.max(0, Math.trunc(Number(value.updatedAt)))
        : Date.now();
    const submittedAt = Number.isFinite(Number(value.submittedAt))
        ? Math.max(0, Math.trunc(Number(value.submittedAt)))
        : updatedAt;

    return {
        playerId,
        playerName: normalizeLeaderboardPlayerName(value.playerName),
        bestScore: clampLeaderboardScore(value.bestScore),
        lastScore: clampLeaderboardScore(value.lastScore),
        mode: normalizeLeaderboardMode(value.mode),
        cpuLevel: normalizeLeaderboardCpuLevel(value.cpuLevel),
        scoreVersion: Number.isFinite(Number(value.scoreVersion)) ? Math.max(0, Math.trunc(Number(value.scoreVersion))) : null,
        turnCount: Number.isFinite(Number(value.turnCount)) ? Math.max(0, Math.trunc(Number(value.turnCount))) : null,
        updatedAt,
        submittedAt
    };
}

function sortLeaderboardEntries(entries) {
    entries.sort((a, b) => {
        if (b.bestScore !== a.bestScore) return b.bestScore - a.bestScore;
        if (a.updatedAt !== b.updatedAt) return a.updatedAt - b.updatedAt;
        return String(a.playerName || '').localeCompare(String(b.playerName || ''), 'ja');
    });
}

async function makeInitialSnapshot(seed, options) {
    const { Core, CardLogic, TurnPipelinePhases, SeededPRNG } = await loadTurnStartModules();
    const gameState = Core.createGameState();
    const prng = SeededPRNG.createPRNG(seed);
    const opts = (options && typeof options === 'object') ? options : {};
    const cardInitOptions = buildInitialDeckSnapshotOptions(opts);
    const cardState = CardLogic.createCardState(prng, cardInitOptions);

    const startupEvents = [];
    TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        Core,
        cardState,
        gameState,
        'black',
        startupEvents,
        prng
    );

    return {
        gameState,
        cardState,
        stateVersion: 0,
        updatedAt: Date.now()
    };
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function mergeWithDefaultShape(defaultValue, overrideValue) {
    if (Array.isArray(defaultValue)) {
        return Array.isArray(overrideValue) ? deepClone(overrideValue) : deepClone(defaultValue);
    }

    if (isPlainObject(defaultValue)) {
        const result = deepClone(defaultValue);
        if (!isPlainObject(overrideValue)) {
            return result;
        }
        for (const [key, value] of Object.entries(overrideValue)) {
            const baseValue = Object.prototype.hasOwnProperty.call(defaultValue, key)
                ? defaultValue[key]
                : undefined;
            result[key] = mergeWithDefaultShape(baseValue, value);
        }
        return result;
    }

    return (typeof overrideValue === 'undefined')
        ? deepClone(defaultValue)
        : deepClone(overrideValue);
}

function mixSeed(seed, value) {
    const numeric = Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0;
    const normalizedSeed = (Number(seed) >>> 0) || 1;
    return ((normalizedSeed ^ (numeric >>> 0)) * 1664525 + 1013904223) >>> 0;
}

function createWorkerTurnStartSeed(room, snapshot, playerKey) {
    const gameState = snapshot && snapshot.gameState;
    const cardState = snapshot && snapshot.cardState;
    let seed = Number.isFinite(Number(room && room.seed)) ? (Math.trunc(Number(room.seed)) >>> 0) : 1;
    seed = mixSeed(seed, snapshot && snapshot.stateVersion);
    seed = mixSeed(seed, gameState && gameState.turnNumber);
    seed = mixSeed(seed, cardState && cardState.turnIndex);
    seed = mixSeed(seed, playerKey === 'white' ? 0x9E3779B1 : 0x243F6A88);
    return seed || 1;
}

function createWorkerTurnStartPrng(room, snapshot, playerKey, SeededPRNG) {
    const savedState = snapshot && snapshot.cardState && snapshot.cardState.prngState;
    if (
        savedState
        && typeof savedState === 'object'
        && Number.isFinite(Number(savedState.seed))
        && Number.isFinite(Number(savedState.calls))
        && typeof SeededPRNG.fromState === 'function'
    ) {
        try {
            return SeededPRNG.fromState({
                seed: Math.trunc(Number(savedState.seed)),
                calls: Math.max(0, Math.trunc(Number(savedState.calls)))
            });
        } catch (e) {
            // Fall through to derived seed when the serialized state is unusable.
        }
    }
    return SeededPRNG.createPRNG(createWorkerTurnStartSeed(room, snapshot, playerKey));
}

function normalizeCardStateForWorkerTurnStart(room, snapshot, CardLogic, SeededPRNG) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const currentCardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
        ? snapshot.cardState
        : {};
    const currentPlayerKey = getCurrentPlayerKey(snapshot.gameState);
    const baselinePrng = SeededPRNG.createPRNG(createWorkerTurnStartSeed(room, snapshot, currentPlayerKey));
    const baselineCardState = CardLogic.createCardState(baselinePrng, buildInitialDeckSnapshotOptions(room));
    snapshot.cardState = mergeWithDefaultShape(baselineCardState, currentCardState);
    if (!Array.isArray(snapshot.cardState.presentationEvents)) {
        snapshot.cardState.presentationEvents = [];
    }
    if (!Array.isArray(snapshot.cardState._presentationEventsPersist)) {
        snapshot.cardState._presentationEventsPersist = [];
    }
    return snapshot.cardState;
}

function createCommandActionPrng(room, snapshot, SeededPRNG) {
    const savedState = snapshot && snapshot.cardState && snapshot.cardState.prngState;
    if (
        savedState
        && typeof savedState === 'object'
        && Number.isFinite(Number(savedState.seed))
        && Number.isFinite(Number(savedState.calls))
        && typeof SeededPRNG.fromState === 'function'
    ) {
        try {
            return SeededPRNG.fromState({
                seed: Math.trunc(Number(savedState.seed)),
                calls: Math.max(0, Math.trunc(Number(savedState.calls)))
            });
        } catch (e) {
            // Fall through to derived seed.
        }
    }
    return SeededPRNG.createPRNG(createWorkerTurnStartSeed(room, snapshot, getCurrentPlayerKey(snapshot && snapshot.gameState)));
}

function mapServerPresentationToPlaybackEvents(presentationEvents, rawEvents, snapshot, playbackAdapter, playerKey) {
    const events = Array.isArray(presentationEvents) ? presentationEvents : [];

    const adapter = (playbackAdapter && typeof playbackAdapter.mapToPlaybackEvents === 'function')
        ? playbackAdapter
        : null;

    if (PlaybackEventHelpers && typeof PlaybackEventHelpers.assemblePlaybackEvents === 'function') {
        return PlaybackEventHelpers.assemblePlaybackEvents({
            rawEvents: Array.isArray(rawEvents) ? rawEvents : [],
            presentationEvents: events,
            snapshot,
            fallbackPlayerKey: playerKey || null,
            adapter,
            normalizePlayerKey
        });
    }

    const rawPlacePlaybackEvents = (PlaybackEventHelpers && typeof PlaybackEventHelpers.mapRawPlaceEventsToPlayback === 'function')
        ? PlaybackEventHelpers.mapRawPlaceEventsToPlayback(Array.isArray(rawEvents) ? rawEvents : [], {
            fallbackPlayerKey: playerKey || null,
            fallbackTurnIndex: (snapshot && snapshot.cardState && typeof snapshot.cardState.turnIndex === 'number') ? snapshot.cardState.turnIndex : 0,
            normalizePlayerKey: normalizePlayerKey
        })
        : [];

    const playbackEvents = (!adapter)
        ? rawPlacePlaybackEvents.concat(events)
        : rawPlacePlaybackEvents.concat(
            adapter.mapToPlaybackEvents(
                events,
                snapshot && snapshot.cardState,
                snapshot && snapshot.gameState
            ) || []
        );

    return {
        playbackEvents: Array.isArray(playbackEvents) ? deepClone(playbackEvents) : [],
        diagnostics: null
    };
}

function collectServerPlaybackEvents(snapshot, rawEvents, playbackAdapter) {
    const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object')
        ? snapshot.cardState
        : null;
    const playerKey = getCurrentPlayerKey(snapshot && snapshot.gameState);
    if (!cardState) {
        return {
            playbackEvents: [],
            diagnostics: null,
            presentationEvents: [],
            playerKey
        };
    }

    let presentationEvents = [];
    if (Array.isArray(cardState.presentationEvents) && cardState.presentationEvents.length > 0) {
        presentationEvents = deepClone(cardState.presentationEvents);
        if (Array.isArray(cardState._presentationEventsPersist)) {
            cardState._presentationEventsPersist.length = 0;
        }
    } else if (Array.isArray(cardState._presentationEventsPersist) && cardState._presentationEventsPersist.length > 0) {
        presentationEvents = deepClone(cardState._presentationEventsPersist);
    }
    cardState.presentationEvents = [];
    cardState._presentationEventsPersist = [];
    delete cardState._currentActionMeta;
    const assembly = mapServerPresentationToPlaybackEvents(presentationEvents, rawEvents, snapshot, playbackAdapter, playerKey);
    return Object.assign({}, assembly || {}, {
        playbackEvents: Array.isArray(assembly && assembly.playbackEvents) ? assembly.playbackEvents : [],
        diagnostics: assembly ? assembly.diagnostics || null : null,
        presentationEvents,
        playerKey
    });
}

function getPlaybackAssemblyWarnings(diagnostics) {
    const list = (diagnostics && Array.isArray(diagnostics.warnings)) ? diagnostics.warnings : [];
    return list.filter((warning) => String(warning || '').trim());
}

function toDebugPlaybackDiagnostics(diagnostics, networkDebugEnabled) {
    const warnings = getPlaybackAssemblyWarnings(diagnostics);
    if (!warnings.length || networkDebugEnabled !== true) return null;
    return deepClone(diagnostics);
}

function reportPlaybackAssemblyDiagnostics(context, diagnostics, options = {}) {
    const warnings = getPlaybackAssemblyWarnings(diagnostics);
    if (!warnings.length) return;

    const message = `[playback-assembly:${context}] ${warnings.join('; ')}`;
    const isTestEnv = typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV === 'test';
    if (isTestEnv) {
        throw new Error(message);
    }
    if (options.networkDebugEnabled === true) {
        console.warn(message, diagnostics);
        return;
    }
    console.error(message);
}

function buildPublishPayload(room, viewerSeatKey, options = {}) {
    const serverTime = Number.isFinite(Number(options.serverTime)) ? Number(options.serverTime) : Date.now();
    const networkDebugEnabled = toPublicNetworkDebugEnabled(room);
    const payloadOptions = {
        ok: options.ok === true,
        roomId: room && room.roomId,
        stateVersion: room ? room.stateVersion : null,
        snapshot: Object.prototype.hasOwnProperty.call(options, 'snapshot')
            ? options.snapshot
            : toPublicSnapshot(room, viewerSeatKey),
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled,
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(options.playbackEvents) ? options.playbackEvents : [],
        effectLogs: normalizeEffectLogMessages(options.effectLogs),
        serverTime,
        idempotentReplay: options.idempotentReplay === true,
        publishMeta: options.publishMeta || null
    };
    if (Object.prototype.hasOwnProperty.call(options, 'rejectedReason')) {
        payloadOptions.rejectedReason = options.rejectedReason || null;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'errorMessage')) {
        payloadOptions.errorMessage = options.errorMessage || null;
    }
    if (Object.prototype.hasOwnProperty.call(options, 'playbackDiagnostics')) {
        payloadOptions.playbackDiagnostics = toDebugPlaybackDiagnostics(options.playbackDiagnostics, networkDebugEnabled);
    }
    if (MatchAuthority && typeof MatchAuthority.buildPublishResponsePayload === 'function') {
        return MatchAuthority.buildPublishResponsePayload(payloadOptions);
    }
    return payloadOptions;
}

function captureTurnStartHandState(snapshot) {
    const playerKey = getCurrentPlayerKey(snapshot && snapshot.gameState);
    const hands = (snapshot && snapshot.cardState && snapshot.cardState.hands && typeof snapshot.cardState.hands === 'object')
        ? snapshot.cardState.hands
        : {};
    return {
        playerKey,
        hand: playerKey && Array.isArray(hands[playerKey]) ? hands[playerKey].slice() : []
    };
}

function appendTurnStartDrawPlaybackEvents(playbackAssembly, snapshot, handState, playbackAdapter) {
    const assembly = (playbackAssembly && typeof playbackAssembly === 'object')
        ? playbackAssembly
        : { playbackEvents: Array.isArray(playbackAssembly) ? playbackAssembly : [], diagnostics: null };
    const baseEvents = Array.isArray(assembly.playbackEvents) ? assembly.playbackEvents.slice() : [];
    const playerKey = normalizePlayerKey(handState && handState.playerKey);
    if (!playerKey) return assembly;

    const adapter = (playbackAdapter && typeof playbackAdapter.mapToPlaybackEvents === 'function')
        ? playbackAdapter
        : null;
    if (!adapter) return assembly;

    const hands = (snapshot && snapshot.cardState && snapshot.cardState.hands && typeof snapshot.cardState.hands === 'object')
        ? snapshot.cardState.hands
        : {};
    const beforeHand = Array.isArray(handState && handState.hand) ? handState.hand : [];
    const afterHand = Array.isArray(hands[playerKey]) ? hands[playerKey] : [];
    if (afterHand.length <= beforeHand.length) return assembly;

    const drawPresentationEvents = afterHand
        .slice(beforeHand.length)
        .filter((cardId) => cardId !== null && typeof cardId !== 'undefined')
        .map((cardId) => ({
            type: 'DRAW_CARD',
            player: playerKey,
            cardId,
            count: 1
        }));
    if (drawPresentationEvents.length === 0) return assembly;

    const drawPlaybackEvents = adapter.mapToPlaybackEvents(
        drawPresentationEvents,
        snapshot && snapshot.cardState,
        snapshot && snapshot.gameState
    ) || [];
    if (!Array.isArray(drawPlaybackEvents) || drawPlaybackEvents.length === 0) return assembly;
    const playbackEvents = (PlaybackEventHelpers && typeof PlaybackEventHelpers.appendPlaybackEventsAfter === 'function')
        ? PlaybackEventHelpers.appendPlaybackEventsAfter(baseEvents, drawPlaybackEvents)
        : baseEvents.concat(deepClone(drawPlaybackEvents));
    return Object.assign({}, assembly, {
        playbackEvents,
        diagnostics: assembly.diagnostics
    });
}

async function reconcileTurnStartAndCollectPlayback(room, snapshot, playbackAdapter) {
    const handState = captureTurnStartHandState(snapshot);
    if (MatchAuthority && typeof MatchAuthority.stripTransientPresentationState === 'function') {
        MatchAuthority.stripTransientPresentationState(snapshot);
    } else if (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object') {
        snapshot.cardState.presentationEvents = [];
        snapshot.cardState._presentationEventsPersist = [];
        delete snapshot.cardState._currentActionMeta;
    }
    const rawEvents = await reconcileTurnStartIfNeeded(room, snapshot, { includeRawEvents: true });
    const modules = (playbackAdapter && typeof playbackAdapter.mapToPlaybackEvents === 'function')
        ? { TurnPipelineUIAdapter: playbackAdapter }
        : await loadTurnPipelineModules();
    const adapter = modules && modules.TurnPipelineUIAdapter ? modules.TurnPipelineUIAdapter : null;
    const playbackAssembly = collectServerPlaybackEvents(snapshot, rawEvents, adapter);
    const effectLogs = collectPipelineEffectLogMessages(
        rawEvents,
        playbackAssembly && Array.isArray(playbackAssembly.presentationEvents) ? playbackAssembly.presentationEvents : [],
        playbackAssembly && playbackAssembly.playerKey ? playbackAssembly.playerKey : getCurrentPlayerKey(snapshot && snapshot.gameState),
        adapter
    );
    return appendTurnStartDrawPlaybackEvents(
        Object.assign({}, playbackAssembly, { effectLogs }),
        snapshot,
        handState,
        adapter
    );
}

async function applyCommandPublishToSnapshot(room, body, playerKey) {
    if (!NetworkActionSchema || typeof NetworkActionSchema.buildAction !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE' };
    }

    const currentSnapshot = (room && room.snapshot && room.snapshot.gameState && room.snapshot.cardState)
        ? deepClone(room.snapshot)
        : null;
    if (!currentSnapshot) {
        return { ok: false, rejectedReason: 'INVALID_SNAPSHOT' };
    }
    if (MatchAuthority && typeof MatchAuthority.stripTransientChargeDeltaState === 'function') {
        MatchAuthority.stripTransientChargeDeltaState(currentSnapshot);
    }

    const currentTurnIndex = Number.isFinite(Number(currentSnapshot.cardState && currentSnapshot.cardState.turnIndex))
        ? Number(currentSnapshot.cardState.turnIndex)
        : 0;
    if (isNetworkDebugFillHandPayload(body)) {
        if (!toPublicNetworkDebugEnabled(room)) {
            return { ok: false, rejectedReason: 'NETWORK_DEBUG_DISABLED' };
        }
        const DebugActions = await loadDebugActionsModule();
        if (!DebugActions || typeof DebugActions.fillDebugHand !== 'function') {
            return { ok: false, rejectedReason: 'DEBUG_ACTIONS_UNAVAILABLE' };
        }

        const applied = DebugActions.fillDebugHand(currentSnapshot.cardState, { playerKey });
        if (!applied) {
            return { ok: false, rejectedReason: 'DEBUG_FILL_HAND_FAILED' };
        }

        if (MatchAuthority && typeof MatchAuthority.stripTransientPresentationState === 'function') {
            MatchAuthority.stripTransientPresentationState(currentSnapshot);
        }

        return {
            ok: true,
            snapshot: currentSnapshot,
            playbackEvents: [],
            playbackDiagnostics: null,
            effectLogs: [],
            action: { type: NETWORK_DEBUG_FILL_HAND_ACTION, playerKey }
        };
    }

    const builtAction = NetworkActionSchema.buildAction({
        actionType: body.actionType,
        actor: body.actor,
        params: body.params,
        actionId: body.actionId,
        turnIndex: body.turnIndex,
        action: body.action
    }, playerKey, currentTurnIndex);

    if (!builtAction || !builtAction.action) {
        return { ok: false, rejectedReason: 'COMMAND_REQUIRED' };
    }
    if (normalizePlayerKey(builtAction.actor) !== playerKey) {
        return { ok: false, rejectedReason: 'SEAT_MISMATCH' };
    }

    const { TurnPipeline, SeededPRNG, TurnPipelineUIAdapter, CardLogic } = await loadTurnPipelineModules();
    if (!TurnPipeline || typeof TurnPipeline.applyTurnSafe !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
    }

    const prng = createCommandActionPrng(room, currentSnapshot, SeededPRNG);
    const result = TurnPipeline.applyTurnSafe(
        currentSnapshot.cardState,
        currentSnapshot.gameState,
        playerKey,
        builtAction.action,
        prng,
        {
            currentStateVersion: currentTurnIndex,
            prngState: currentSnapshot.cardState && currentSnapshot.cardState.prngState
        }
    );

    if (!result || result.ok !== true) {
        return {
            ok: false,
            rejectedReason: (result && result.rejectedReason) || 'COMMAND_REJECTED',
            errorMessage: result && result.errorMessage ? String(result.errorMessage) : null,
            events: result && Array.isArray(result.events) ? result.events : []
        };
    }

    const nextSnapshot = {
        gameState: result.gameState,
        cardState: result.cardState
    };
    const playbackAssembly = mapServerPresentationToPlaybackEvents(
        result.presentationEvents,
        result.events,
        nextSnapshot,
        TurnPipelineUIAdapter,
        playerKey
    );
    reportPlaybackAssemblyDiagnostics('worker-action', playbackAssembly && playbackAssembly.diagnostics, {
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });
    const playbackEvents = (playbackAssembly && Array.isArray(playbackAssembly.playbackEvents))
        ? playbackAssembly.playbackEvents
        : [];
    const actionPresentationEvents = Array.isArray(result.presentationEvents)
        ? result.presentationEvents
        : ((result.cardState && Array.isArray(result.cardState.presentationEvents)) ? result.cardState.presentationEvents : []);
    const actionEffectLogs = appendEffectLogMessages(
        buildNetworkCardUseEffectLogs(builtAction.action, playerKey, CardLogic),
        collectPipelineEffectLogMessages(result.events, actionPresentationEvents, playerKey, TurnPipelineUIAdapter)
    );

    const turnStartPlaybackAssembly = await reconcileTurnStartAndCollectPlayback(room, nextSnapshot, TurnPipelineUIAdapter);
    reportPlaybackAssemblyDiagnostics('worker-turn-start', turnStartPlaybackAssembly && turnStartPlaybackAssembly.diagnostics, {
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });
    const turnStartPlaybackEvents = (turnStartPlaybackAssembly && Array.isArray(turnStartPlaybackAssembly.playbackEvents))
        ? turnStartPlaybackAssembly.playbackEvents
        : [];
    const turnStartEffectLogs = (turnStartPlaybackAssembly && Array.isArray(turnStartPlaybackAssembly.effectLogs))
        ? turnStartPlaybackAssembly.effectLogs
        : [];
    const combinedPlaybackEvents = (PlaybackEventHelpers && typeof PlaybackEventHelpers.appendPlaybackEventsAfter === 'function')
        ? PlaybackEventHelpers.appendPlaybackEventsAfter(playbackEvents, turnStartPlaybackEvents)
        : playbackEvents.concat(deepClone(turnStartPlaybackEvents));
    const combinedEffectLogs = appendEffectLogMessages(actionEffectLogs, turnStartEffectLogs);

    if (MatchAuthority && typeof MatchAuthority.stripTransientPresentationState === 'function') {
        MatchAuthority.stripTransientPresentationState(nextSnapshot);
    }

    return {
        ok: true,
        snapshot: nextSnapshot,
        playbackEvents: combinedPlaybackEvents,
        playbackDiagnostics: toDebugPlaybackDiagnostics(playbackAssembly && playbackAssembly.diagnostics, toPublicNetworkDebugEnabled(room)),
        effectLogs: combinedEffectLogs,
        action: builtAction.action
    };
}

async function reconcileTurnStartIfNeeded(room, snapshot, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (!snapshot || !snapshot.gameState || !snapshot.cardState) return opts.includeRawEvents ? [] : snapshot;

    const currentPlayerKey = getCurrentPlayerKey(snapshot.gameState);
    const lastTurnStartedFor = parseSeatKeyOptional(snapshot.cardState.lastTurnStartedFor);
    if (lastTurnStartedFor === currentPlayerKey) {
        return opts.includeRawEvents ? [] : snapshot;
    }

    const { Core, CardLogic, TurnPipelinePhases, SeededPRNG } = await loadTurnStartModules();
    if (typeof Core.isGameOver === 'function' && Core.isGameOver(snapshot.gameState)) {
        return opts.includeRawEvents ? [] : snapshot;
    }

    normalizeCardStateForWorkerTurnStart(room, snapshot, CardLogic, SeededPRNG);
    const prng = createWorkerTurnStartPrng(room, snapshot, currentPlayerKey, SeededPRNG);
    const turnStartEvents = [];
    TurnPipelinePhases.applyTurnStartPhase(
        CardLogic,
        Core,
        snapshot.cardState,
        snapshot.gameState,
        currentPlayerKey,
        turnStartEvents,
        prng
    );
    return opts.includeRawEvents ? turnStartEvents : snapshot;
}

function cloneSnapshotWithVersion(room) {
    const shot = deepClone(room && room.snapshot ? room.snapshot : {});
    shot.stateVersion = room ? room.stateVersion : 0;
    shot.updatedAt = room ? room.updatedAt : Date.now();
    return shot;
}

function projectSnapshotForViewer(room, viewerSeatKey) {
    const shot = cloneSnapshotWithVersion(room);
    if (!shot || typeof shot !== 'object') return shot;

    const cardState = (shot.cardState && typeof shot.cardState === 'object') ? shot.cardState : null;
    if (!cardState) return shot;

    const viewer = parseSeatKeyOptional(viewerSeatKey);
    const hands = (cardState.hands && typeof cardState.hands === 'object') ? cardState.hands : {};
    const sourceHands = {};
    cardState.hands = cardState.hands && typeof cardState.hands === 'object' ? cardState.hands : {};

    for (const ownerKey of PLAYER_KEYS) {
        const ownerHand = Array.isArray(hands[ownerKey]) ? hands[ownerKey].slice() : [];
        sourceHands[ownerKey] = ownerHand;
        if (viewer && ownerKey === viewer) {
            cardState.hands[ownerKey] = ownerHand.slice();
            continue;
        }
        cardState.hands[ownerKey] = ownerHand.map((_, handIndex) => makeHiddenHandToken(ownerKey, handIndex));
    }

    const selectedOwnerKey = parseSeatKeyOptional(cardState.selectedCardOwnerKey);
    if (!viewer || !selectedOwnerKey || selectedOwnerKey !== viewer) {
        cardState.selectedCardId = null;
        cardState.selectedCardOwnerKey = null;
    }

    if (cardState.pendingEffectByPlayer && typeof cardState.pendingEffectByPlayer === 'object') {
        for (const ownerKey of PLAYER_KEYS) {
            const pending = cardState.pendingEffectByPlayer[ownerKey];
            if (!pending || pending.type !== 'CONDEMN_WILL' || !Array.isArray(pending.offers)) continue;
            const opponentKey = getOpponentKey(ownerKey);
            const opponentHand = Array.isArray(sourceHands[opponentKey]) ? sourceHands[opponentKey] : [];
            const revealToViewer = !!(viewer && ownerKey === viewer);
            pending.offers = pending.offers.map((offer, idx) => {
                const parsedToken = offer && offer.cardId ? parseHiddenHandToken(offer.cardId) : null;
                const fallbackIndex = parsedToken && Number.isInteger(parsedToken.handIndex) ? parsedToken.handIndex : idx;
                const handIndex = (offer && Number.isInteger(offer.handIndex)) ? offer.handIndex : fallbackIndex;
                if (revealToViewer) {
                    const visibleCardId = (Number.isInteger(handIndex) && handIndex >= 0 && handIndex < opponentHand.length)
                        ? opponentHand[handIndex]
                        : null;
                    return {
                        handIndex,
                        cardId: visibleCardId || makeHiddenHandToken(opponentKey, handIndex)
                    };
                }
                return {
                    handIndex,
                    cardId: makeHiddenHandToken(opponentKey, handIndex)
                };
            });
        }
    }

    return shot;
}

function toPublicSnapshot(room, viewerSeatKey) {
    if (MatchAuthority && typeof MatchAuthority.buildPublicSnapshot === 'function') {
        return MatchAuthority.buildPublicSnapshot(room, viewerSeatKey || null);
    }
    return projectSnapshotForViewer(room, viewerSeatKey || null);
}

function toPublicSeats(room) {
    return {
        black: !!(room && room.seats && room.seats.black),
        white: !!(room && room.seats && room.seats.white)
    };
}

function toPublicSeatNames(room) {
    const names = (room && room.seatNames && typeof room.seatNames === 'object') ? room.seatNames : {};
    return {
        black: normalizeNetworkPlayerName(names.black),
        white: normalizeNetworkPlayerName(names.white)
    };
}

function normalizeDeckSizeValue(value) {
    if (value === null || typeof value === 'undefined' || value === '') return null;
    return Number.isFinite(Number(value))
        ? Math.max(0, Math.trunc(Number(value)))
        : null;
}

function cloneInitialDeckSpecByPlayer(value) {
    const source = (value && typeof value === 'object') ? value : {};
    return {
        black: (source.black && typeof source.black === 'object') ? deepClone(source.black) : null,
        white: (source.white && typeof source.white === 'object') ? deepClone(source.white) : null
    };
}

function normalizeRoomDeckMetadata(value) {
    const source = (value && typeof value === 'object') ? value : null;
    if (!source) return null;

    const mode = String(source.mode || '').trim();
    const sharedDeckCode = String(source.deckCode || '').trim();
    const sharedDeckSize = normalizeDeckSizeValue(source.deckSize);
    const deckCodeByPlayerSource = (source.deckCodeByPlayer && typeof source.deckCodeByPlayer === 'object')
        ? source.deckCodeByPlayer
        : null;
    const deckSizeByPlayerSource = (source.deckSizeByPlayer && typeof source.deckSizeByPlayer === 'object')
        ? source.deckSizeByPlayer
        : null;
    const hasExplicitPerPlayerData = !!(deckCodeByPlayerSource || deckSizeByPlayerSource);
    const deckCodeByPlayer = {
        black: deckCodeByPlayerSource
            ? String(deckCodeByPlayerSource.black || '').trim()
            : (mode === 'shared' ? sharedDeckCode : ''),
        white: deckCodeByPlayerSource
            ? String(deckCodeByPlayerSource.white || '').trim()
            : (mode === 'shared' ? sharedDeckCode : '')
    };
    const deckSizeByPlayer = {
        black: deckSizeByPlayerSource
            ? normalizeDeckSizeValue(deckSizeByPlayerSource.black)
            : (mode === 'shared' ? sharedDeckSize : null),
        white: deckSizeByPlayerSource
            ? normalizeDeckSizeValue(deckSizeByPlayerSource.white)
            : (mode === 'shared' ? sharedDeckSize : null)
    };
    const hasPerPlayerData = !!(
        deckCodeByPlayer.black ||
        deckCodeByPlayer.white ||
        deckSizeByPlayer.black !== null ||
        deckSizeByPlayer.white !== null
    );

    if (!hasPerPlayerData && !sharedDeckCode && sharedDeckSize === null) {
        return null;
    }

    return {
        mode: (mode === 'shared' && (sharedDeckCode || sharedDeckSize !== null))
            ? 'shared'
            : ((mode === 'perPlayer' || hasExplicitPerPlayerData)
                ? 'perPlayer'
                : ((sharedDeckCode || sharedDeckSize !== null) ? 'shared' : 'perPlayer')),
        source: String(source.source || 'room').trim() || 'room',
        deckCode: sharedDeckCode,
        deckSize: sharedDeckSize,
        deckCodeByPlayer,
        deckSizeByPlayer
    };
}

function hasRoomDeckMetadataEntries(value) {
    const metadata = normalizeRoomDeckMetadata(value);
    if (!metadata) return false;

    return !!(
        metadata.deckCode ||
        metadata.deckSize !== null ||
        metadata.deckCodeByPlayer.black ||
        metadata.deckCodeByPlayer.white ||
        metadata.deckSizeByPlayer.black !== null ||
        metadata.deckSizeByPlayer.white !== null
    );
}

function buildInitialDeckSnapshotOptions(value) {
    const source = (value && typeof value === 'object') ? value : {};
    const initialDeckSpecByPlayer = cloneInitialDeckSpecByPlayer(source.initialDeckSpecByPlayer);
    if (initialDeckSpecByPlayer.black || initialDeckSpecByPlayer.white) {
        return { initialDeckSpecByPlayer };
    }

    const initialDeckSpec = (source.initialDeckSpec && typeof source.initialDeckSpec === 'object')
        ? deepClone(source.initialDeckSpec)
        : null;
    return initialDeckSpec ? { initialDeckSpec } : {};
}

function getRoomInitialDeckSpecByPlayer(room) {
    const initialDeckSpecByPlayer = cloneInitialDeckSpecByPlayer(room && room.initialDeckSpecByPlayer);
    if (initialDeckSpecByPlayer.black || initialDeckSpecByPlayer.white) {
        return initialDeckSpecByPlayer;
    }

    const sharedDeckSpec = (room && room.initialDeckSpec && typeof room.initialDeckSpec === 'object')
        ? room.initialDeckSpec
        : null;
    if (!sharedDeckSpec) {
        return { black: null, white: null };
    }

    return {
        black: deepClone(sharedDeckSpec),
        white: deepClone(sharedDeckSpec)
    };
}

function assignRoomDeckSelection(room, seatKey, deckSelection) {
    if (!room || !deckSelection || deckSelection.hasCustomDeck !== true) return;

    const normalizedSeatKey = normalizePlayerKey(seatKey);
    const initialDeckSpecByPlayer = getRoomInitialDeckSpecByPlayer(room);
    initialDeckSpecByPlayer[normalizedSeatKey] = deepClone(deckSelection.deckSpec);
    room.initialDeckSpecByPlayer = initialDeckSpecByPlayer;
    room.initialDeckSpec = null;

    const roomDeck = normalizeRoomDeckMetadata(room.roomDeck) || {
        mode: 'perPlayer',
        source: 'room',
        deckCode: '',
        deckSize: null,
        deckCodeByPlayer: { black: '', white: '' },
        deckSizeByPlayer: { black: null, white: null }
    };

    roomDeck.mode = 'perPlayer';
    roomDeck.source = 'room';
    roomDeck.deckCode = '';
    roomDeck.deckSize = null;
    roomDeck.deckCodeByPlayer = Object.assign({ black: '', white: '' }, roomDeck.deckCodeByPlayer || {});
    roomDeck.deckSizeByPlayer = Object.assign({ black: null, white: null }, roomDeck.deckSizeByPlayer || {});
    roomDeck.deckCodeByPlayer[normalizedSeatKey] = String(deckSelection.deckCode || '').trim();
    roomDeck.deckSizeByPlayer[normalizedSeatKey] = normalizeDeckSizeValue(deckSelection.deckSize);

    room.roomDeck = hasRoomDeckMetadataEntries(roomDeck) ? roomDeck : null;
}

function toPublicRoomDeck(room) {
    const metadata = normalizeRoomDeckMetadata(room && room.roomDeck);
    const snapshotDeckSizes = {
        black: normalizeDeckSizeValue(
            room
            && room.snapshot
            && room.snapshot.cardState
            && room.snapshot.cardState.initialDeckSizeByPlayer
            && room.snapshot.cardState.initialDeckSizeByPlayer.black
        ),
        white: normalizeDeckSizeValue(
            room
            && room.snapshot
            && room.snapshot.cardState
            && room.snapshot.cardState.initialDeckSizeByPlayer
            && room.snapshot.cardState.initialDeckSizeByPlayer.white
        )
    };
    const snapshotDeckSize = snapshotDeckSizes.black !== null
        ? snapshotDeckSizes.black
        : normalizeDeckSizeValue(room && room.snapshot && room.snapshot.cardState && room.snapshot.cardState.initialDeckSize);

    if (metadata && metadata.mode === 'perPlayer') {
        const deckCodeByPlayer = {
            black: String(metadata.deckCodeByPlayer.black || '').trim(),
            white: String(metadata.deckCodeByPlayer.white || '').trim()
        };
        const deckSizeByPlayer = {
            black: metadata.deckSizeByPlayer.black !== null ? metadata.deckSizeByPlayer.black : snapshotDeckSizes.black,
            white: metadata.deckSizeByPlayer.white !== null ? metadata.deckSizeByPlayer.white : snapshotDeckSizes.white
        };
        const sharedDeckCode = deckCodeByPlayer.black && deckCodeByPlayer.black === deckCodeByPlayer.white
            ? deckCodeByPlayer.black
            : '';
        const sharedDeckSize = sharedDeckCode && deckSizeByPlayer.black === deckSizeByPlayer.white
            ? deckSizeByPlayer.black
            : null;

        return {
            mode: 'perPlayer',
            deckCode: sharedDeckCode,
            deckSize: sharedDeckSize,
            deckCodeByPlayer,
            deckSizeByPlayer,
            source: metadata.source || 'room'
        };
    }

    if (!metadata && snapshotDeckSize === null) return null;

    return {
        mode: metadata && metadata.mode ? String(metadata.mode) : 'shared',
        deckCode: metadata && metadata.deckCode ? String(metadata.deckCode).trim() : '',
        deckSize: metadata && metadata.deckSize !== null ? metadata.deckSize : snapshotDeckSize,
        source: metadata && metadata.source ? String(metadata.source) : 'room'
    };
}

function toPublicNetworkDebugEnabled(room) {
    return !!(room && room.networkDebugEnabled === true);
}

function toPublicChatMessages(room) {
    const messages = Array.isArray(room && room.chatMessages) ? room.chatMessages : [];
    return messages.map((entry) => ({
        id: Number.isFinite(Number(entry && entry.id)) ? Number(entry.id) : 0,
        seatKey: normalizePlayerKey(entry && entry.seatKey),
        text: String(entry && entry.text ? entry.text : ''),
        serverTime: Number.isFinite(Number(entry && entry.serverTime)) ? Number(entry.serverTime) : Date.now()
    }));
}

function hasTwoActiveSeats(room) {
    return !!(room && room.seats && room.seats.black && room.seats.white);
}

function resolveTurnSeatKey(room) {
    return getCurrentPlayerKey(room && room.snapshot && room.snapshot.gameState);
}

function createPausedTurnTimer(room) {
    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active: false,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: null,
        turnDeadlineAt: null
    };
}

function createActiveTurnTimer(room, nowMs) {
    const now = Number.isFinite(Number(nowMs)) ? Math.max(0, Math.trunc(Number(nowMs))) : Date.now();
    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active: true,
        turnSeatKey: resolveTurnSeatKey(room),
        turnStartedAt: now,
        turnDeadlineAt: now + NETWORK_TURN_LIMIT_MS
    };
}

function areTurnTimersEqual(a, b) {
    const left = (a && typeof a === 'object') ? a : {};
    const right = (b && typeof b === 'object') ? b : {};
    const leftSeat = parseSeatKeyOptional(left.turnSeatKey) || 'black';
    const rightSeat = parseSeatKeyOptional(right.turnSeatKey) || 'black';
    const leftStarted = Number.isFinite(Number(left.turnStartedAt)) ? Number(left.turnStartedAt) : null;
    const rightStarted = Number.isFinite(Number(right.turnStartedAt)) ? Number(right.turnStartedAt) : null;
    const leftDeadline = Number.isFinite(Number(left.turnDeadlineAt)) ? Number(left.turnDeadlineAt) : null;
    const rightDeadline = Number.isFinite(Number(right.turnDeadlineAt)) ? Number(right.turnDeadlineAt) : null;

    return (
        !!left.active === !!right.active
        && leftSeat === rightSeat
        && leftStarted === rightStarted
        && leftDeadline === rightDeadline
        && Number(left.limitSeconds) === Number(right.limitSeconds)
    );
}

function toPublicTurnTimer(room, nowMs) {
    const timer = (room && room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
    const serverNow = Number.isFinite(Number(nowMs)) ? Number(nowMs) : Date.now();
    const deadline = timer && Number.isFinite(Number(timer.turnDeadlineAt)) ? Number(timer.turnDeadlineAt) : null;
    const startedAt = timer && Number.isFinite(Number(timer.turnStartedAt)) ? Number(timer.turnStartedAt) : null;
    const active = !!(timer && timer.active === true && deadline !== null);

    return {
        limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
        active,
        turnSeatKey: parseSeatKeyOptional(timer && timer.turnSeatKey) || resolveTurnSeatKey(room),
        turnStartedAt: active ? startedAt : null,
        turnDeadlineAt: active ? deadline : null,
        remainingMs: active && deadline !== null ? Math.max(0, Math.trunc(deadline - serverNow)) : null
    };
}

function parseChatMessageText(value) {
    const normalized = String(value || '').replace(/[\r\n]+/g, ' ').trim();
    if (!normalized) {
        return { ok: false, reason: 'MESSAGE_REQUIRED' };
    }
    const chars = Array.from(normalized);
    if (chars.length > CHAT_MAX_LENGTH) {
        return { ok: false, reason: 'MESSAGE_TOO_LONG' };
    }
    return { ok: true, text: chars.join('') };
}

function buildSnapshotPayload(room, meta, viewerSeatKey) {
    const serverTime = Date.now();
    return {
        ok: true,
        roomId: room.roomId,
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room, viewerSeatKey),
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : [],
        effectLogs: normalizeEffectLogMessages(meta && meta.effectLogs),
        playbackDiagnostics: toDebugPlaybackDiagnostics(meta && meta.playbackDiagnostics, toPublicNetworkDebugEnabled(room)),
        operationId: meta && meta.operationId ? String(meta.operationId) : null,
        playerKey: meta && meta.playerKey ? normalizePlayerKey(meta.playerKey) : null,
        actionType: meta && meta.actionType ? String(meta.actionType) : null,
        serverTime
    };
}

function buildPresencePayload(room, meta) {
    const serverTime = Date.now();
    const seatKey = meta && meta.seatKey ? normalizePlayerKey(meta.seatKey) : 'black';
    const seatNames = toPublicSeatNames(room);
    return {
        ok: true,
        roomId: room.roomId,
        type: meta && meta.type ? String(meta.type) : 'join',
        seatKey,
        playerName: normalizeNetworkPlayerName(seatNames[seatKey]),
        rejoined: !!(meta && meta.rejoined),
        seats: toPublicSeats(room),
        seatNames,
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    };
}

function buildHeartbeatPayload(room, serverTime) {
    return {
        ok: true,
        roomId: room.roomId,
        stateVersion: Number.isFinite(Number(room.stateVersion)) ? Number(room.stateVersion) : 0,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    };
}

function resolveSeatForJoin(room, requestedSeatKey, providedToken) {
    const token = String(providedToken || '').trim();
    const requested = parseSeatKeyOptional(requestedSeatKey);

    if (requested) {
        if (token && room.seatTokens && room.seatTokens[requested] === token) return requested;
        if (!room.seats[requested]) return requested;
        return null;
    }

    if (token && room.seatTokens) {
        if (room.seatTokens.black === token) return 'black';
        if (room.seatTokens.white === token) return 'white';
    }

    if (!room.seats.black) return 'black';
    if (!room.seats.white) return 'white';
    return null;
}

function sseChunk(eventName, payload, eventId) {
    const data = JSON.stringify(payload || {});
    const hasEventId = !(eventId === null || typeof eventId === 'undefined' || String(eventId) === '');
    const idLine = hasEventId ? `id: ${String(eventId)}\n` : '';
    const eventLine = eventName ? `event: ${eventName}\n` : '';
    return `${idLine}${eventLine}data: ${data}\n\n`;
}

function getRoomStub(env, roomId) {
    const doId = env.MATCH_ROOM.idFromName(roomId);
    return env.MATCH_ROOM.get(doId);
}

function getLeaderboardStub(env) {
    return getRoomStub(env, LEADERBOARD_ROOM_ID);
}

async function forwardJsonToRoom(env, roomId, pathname, payload) {
    const stub = getRoomStub(env, roomId);
    const req = new Request(`https://room${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
    });
    const response = await stub.fetch(req);
    return withCORS(response);
}

async function forwardGetToRoom(env, roomId, pathname, sourceUrl) {
    const stub = getRoomStub(env, roomId);
    const urlObj = new URL(sourceUrl);
    const target = new URL(`https://room${pathname}`);
    for (const [key, value] of urlObj.searchParams.entries()) {
        target.searchParams.set(key, value);
    }
    target.searchParams.set('roomId', roomId);

    const req = new Request(target.toString(), { method: 'GET' });
    const response = await stub.fetch(req);
    return withCORS(response);
}

async function forwardJsonToLeaderboard(env, pathname, payload) {
    const stub = getLeaderboardStub(env);
    const req = new Request(`https://room${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
    });
    const response = await stub.fetch(req);
    return withCORS(response);
}

async function forwardGetToLeaderboard(env, pathname, sourceUrl) {
    const stub = getLeaderboardStub(env);
    const urlObj = new URL(sourceUrl);
    const target = new URL(`https://room${pathname}`);
    for (const [key, value] of urlObj.searchParams.entries()) {
        target.searchParams.set(key, value);
    }
    const req = new Request(target.toString(), { method: 'GET' });
    const response = await stub.fetch(req);
    return withCORS(response);
}

async function resolveDeckSelection(rawDeckCodeValue) {
    const rawDeckCode = String(rawDeckCodeValue || '').trim();
    if (!rawDeckCode) {
        return {
            ok: true,
            hasCustomDeck: false,
            deckSpec: null,
            deckCode: '',
            deckSize: null
        };
    }

    try {
        const { deckSpecHelpers, deckCodecModule } = await loadDeckModules();
        const decodedDeckSpec = deckCodecModule.decodeDeckCode(rawDeckCode);
        const normalizedDeckSpec = deckSpecHelpers.normalizeDeckSpec(decodedDeckSpec);
        const summary = deckSpecHelpers.summarizeDeckSpec(normalizedDeckSpec);
        const canonicalDeckCode = deckCodecModule.encodeDeckSpec(normalizedDeckSpec);
        return {
            ok: true,
            hasCustomDeck: true,
            deckSpec: normalizedDeckSpec,
            deckCode: canonicalDeckCode,
            deckSize: Number.isFinite(Number(summary && summary.deckSize)) ? Number(summary.deckSize) : null
        };
    } catch (error) {
        return {
            ok: false,
            reason: (error && error.code) ? String(error.code) : 'DECK_CODE_INVALID',
            error
        };
    }
}

async function handleCreate(env, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const networkDebugEnabled = opts.networkDebugEnabled === true;
    const deckSelection = await resolveDeckSelection(opts.deckCode);
    if (!deckSelection.ok) {
        return jsonResponse(400, {
            ok: false,
            reason: deckSelection.reason || 'DECK_CODE_INVALID'
        });
    }

    const initialDeckSpecByPlayer = deckSelection.hasCustomDeck
        ? { black: deckSelection.deckSpec }
        : null;
    const roomDeck = deckSelection.hasCustomDeck
        ? {
            mode: 'perPlayer',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: {
                black: deckSelection.deckCode,
                white: ''
            },
            deckSizeByPlayer: {
                black: deckSelection.deckSize,
                white: null
            },
            source: 'room'
        }
        : null;

    for (let attempt = 0; attempt < 12; attempt += 1) {
        const roomId = makeRoomId();
        const seed = Date.now();
        const snapshot = await makeInitialSnapshot(seed, {
            initialDeckSpecByPlayer
        });
        const stub = getRoomStub(env, roomId);
        const req = new Request('https://room/internal/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                roomId,
                seed,
                snapshot,
                playerName: opts.playerName,
                networkDebugEnabled,
                initialDeckSpecByPlayer,
                roomDeck
            })
        });
        const response = await stub.fetch(req);
        if (response.status === 409) {
            continue;
        }
        return withCORS(response);
    }
    return jsonResponse(500, { ok: false, reason: 'CREATE_RETRY_EXHAUSTED' });
}

async function parsePostBody(request) {
    const raw = await request.text();
    const body = parseJsonBody(raw);
    if (body === null) {
        return { ok: false, response: jsonResponse(400, { ok: false, reason: 'INVALID_JSON' }) };
    }
    return { ok: true, body };
}

async function handleMatchApi(request, env) {
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && pathname === '/api/match/create') {
        const parsed = await parsePostBody(request);
        if (!parsed.ok) return parsed.response;
        return handleCreate(env, parsed.body || {});
    }

    if (request.method === 'POST' && (pathname === '/api/match/join' || pathname === '/api/match/leave' || pathname === '/api/match/publish' || pathname === '/api/match/chat')) {
        const parsed = await parsePostBody(request);
        if (!parsed.ok) return parsed.response;

        const body = parsed.body || {};
        const roomId = normalizeRoomId(body.roomId);
        if (!roomId) {
            return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        }
        body.roomId = roomId;

        return forwardJsonToRoom(env, roomId, pathname, body);
    }

    if (request.method === 'GET' && (pathname === '/api/match/state' || pathname === '/api/match/stream')) {
        const roomId = normalizeRoomId(urlObj.searchParams.get('roomId') || '');
        if (!roomId) {
            return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        }
        return forwardGetToRoom(env, roomId, pathname, request.url);
    }

    return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
}

async function handleLeaderboardApi(request, env) {
    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === 'POST' && pathname === '/api/leaderboard/submit') {
        const parsed = await parsePostBody(request);
        if (!parsed.ok) return parsed.response;
        return forwardJsonToLeaderboard(env, pathname, parsed.body || {});
    }

    if (request.method === 'GET' && pathname === '/api/leaderboard/list') {
        return forwardGetToLeaderboard(env, pathname, request.url);
    }

    return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
}

export class MatchRoomDurableObject {
    constructor(state) {
        this.state = state;
        this.room = null;
        this.roomLoaded = false;
        this.streams = new Map();
        this.streamSeq = 0;
        this.encoder = new TextEncoder();
        this.heartbeatTimerId = null;
        this.sseEventBuffer = [];
    }

    async loadRoom() {
        if (this.roomLoaded) return;
        this.room = await this.state.storage.get(ROOM_STORAGE_KEY) || null;
        this.roomLoaded = true;
    }

    async saveRoom() {
        await this.state.storage.put(ROOM_STORAGE_KEY, this.room);
    }

    async removeRoom() {
        this.room = null;
        this.sseEventBuffer = [];
        if (this.heartbeatTimerId !== null) {
            try { clearTimeout(this.heartbeatTimerId); } catch (e) { /* ignore */ }
            this.heartbeatTimerId = null;
        }
        await this.state.storage.delete(ROOM_STORAGE_KEY);
    }

    nextSseEventId() {
        const room = this.room;
        if (!room || typeof room !== 'object') {
            return `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        const prevSeq = Number.isFinite(Number(room.eventSeq))
            ? Math.max(0, Math.trunc(Number(room.eventSeq)))
            : 0;
        const nextSeq = prevSeq + 1;
        room.eventSeq = nextSeq;

        const roomId = normalizeRoomId(room.roomId || 'room') || 'room';
        const stateVersion = Number.isFinite(Number(room.stateVersion))
            ? Math.max(0, Math.trunc(Number(room.stateVersion)))
            : 0;

        return `${roomId}_${stateVersion}_${nextSeq}`;
    }

    rememberBufferedSseEvent(record) {
        if (!MatchAuthority || typeof MatchAuthority.appendBufferedSseEvent !== 'function') return;
        this.sseEventBuffer = MatchAuthority.appendBufferedSseEvent(this.sseEventBuffer, record);
    }

    buildBufferedSnapshotEvent(meta, eventId) {
        const payloadByViewer = {
            black: buildSnapshotPayload(this.room, meta, 'black'),
            white: buildSnapshotPayload(this.room, meta, 'white')
        };
        return {
            record: {
                eventId,
                eventName: 'snapshot',
                payloadByViewer
            },
            payloadByViewer
        };
    }

    prepareSnapshotBroadcast(meta) {
        const eventId = this.nextSseEventId();
        const { record, payloadByViewer } = this.buildBufferedSnapshotEvent(meta, eventId);
        return {
            eventId,
            record,
            payloadByViewer,
            fallbackPayload: buildSnapshotPayload(this.room, meta, null)
        };
    }

    async broadcastPreparedSnapshot(preparedSnapshot) {
        if (!this.room || !preparedSnapshot) return;
        this.rememberBufferedSseEvent(preparedSnapshot.record);
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId, streamInfo]) => {
            const viewerSeatKey = streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null;
            const payload = (viewerSeatKey && preparedSnapshot.payloadByViewer[viewerSeatKey])
                ? preparedSnapshot.payloadByViewer[viewerSeatKey]
                : preparedSnapshot.fallbackPayload;
            return this.sendSse(streamId, 'snapshot', payload, { eventId: preparedSnapshot.eventId });
        }));
    }

    ensureHeartbeatTimer() {
        if (this.heartbeatTimerId !== null) return;
        if (this.streams.size === 0) return;

        this.heartbeatTimerId = setTimeout(() => {
            this.heartbeatTimerId = null;
            if (this.streams.size === 0) return;

            this.broadcastHeartbeat().catch(() => {
                // Keep heartbeat loop resilient even if one tick fails.
            }).finally(() => {
                this.ensureHeartbeatTimer();
            });
        }, SSE_HEARTBEAT_INTERVAL_MS);
    }

    async broadcastHeartbeat() {
        if (!this.room) return;
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;

        const serverTime = Date.now();
        const payload = buildHeartbeatPayload(this.room, serverTime);
        const eventId = this.nextSseEventId();
        this.rememberBufferedSseEvent({
            eventId,
            eventName: 'heartbeat',
            payload
        });

        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'heartbeat', payload, { eventId })
        )));
    }

    async closeStream(streamId) {
        const stream = this.streams.get(streamId);
        if (!stream) return;
        this.streams.delete(streamId);
        if (this.streams.size === 0 && this.heartbeatTimerId !== null) {
            try { clearTimeout(this.heartbeatTimerId); } catch (e) { /* ignore */ }
            this.heartbeatTimerId = null;
        }
        try {
            await stream.writer.close();
        } catch (e) {
            try { stream.writer.releaseLock(); } catch (inner) { /* ignore */ }
        }
    }

    async sendSse(streamId, eventName, payload, options) {
        const stream = this.streams.get(streamId);
        if (!stream) return;
        const opts = (options && typeof options === 'object') ? options : {};
        const hasEventId = Object.prototype.hasOwnProperty.call(opts, 'eventId');
        const eventId = hasEventId ? opts.eventId : this.nextSseEventId();
        const timeoutMs = Number.isFinite(Number(opts.timeoutMs))
            ? Math.max(0, Math.trunc(Number(opts.timeoutMs)))
            : SSE_WRITE_TIMEOUT_MS;
        const chunk = sseChunk(eventName, payload, eventId);
        try {
            const writePromise = stream.writer.write(this.encoder.encode(chunk));
            if (timeoutMs > 0) {
                await Promise.race([
                    writePromise,
                    new Promise((_, reject) => {
                        setTimeout(() => reject(new Error('SSE_WRITE_TIMEOUT')), timeoutMs);
                    })
                ]);
            } else {
                await writePromise;
            }
        } catch (e) {
            await this.closeStream(streamId);
        }
    }

    async broadcastSnapshot(meta) {
        if (!this.room) return;
        const preparedSnapshot = meta && meta.__preparedSnapshot
            ? meta.__preparedSnapshot
            : this.prepareSnapshotBroadcast(meta);
        await this.broadcastPreparedSnapshot(preparedSnapshot);
    }

    async broadcastPresence(meta) {
        if (!this.room) return;
        const payload = buildPresencePayload(this.room, meta || {});
        const eventId = this.nextSseEventId();
        this.rememberBufferedSseEvent({
            eventId,
            eventName: 'presence',
            payload
        });
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'presence', payload, { eventId })
        )));
    }

    async broadcastChat(payload) {
        if (!this.room) return;
        const eventId = this.nextSseEventId();
        this.rememberBufferedSseEvent({
            eventId,
            eventName: 'chat',
            payload
        });
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;
        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'chat', payload, { eventId })
        )));
    }

    createRoomState(roomId, initOptions) {
        const opts = initOptions || {};
        const seed = Number.isFinite(Number(opts.seed)) ? Number(opts.seed) : Date.now();
        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? deepClone(opts.snapshot) : null;
        const initialDeckSpec = (opts.initialDeckSpec && typeof opts.initialDeckSpec === 'object') ? deepClone(opts.initialDeckSpec) : null;
        const initialDeckSpecByPlayer = (opts.initialDeckSpecByPlayer && typeof opts.initialDeckSpecByPlayer === 'object')
            ? cloneInitialDeckSpecByPlayer(opts.initialDeckSpecByPlayer)
            : null;
        const roomDeck = (opts.roomDeck && typeof opts.roomDeck === 'object') ? deepClone(opts.roomDeck) : null;
        const networkDebugEnabled = opts.networkDebugEnabled === true;
        const nowMs = Date.now();
        return {
            roomId,
            seed,
            snapshot,
            initialDeckSpec,
            initialDeckSpecByPlayer,
            roomDeck,
            networkDebugEnabled,
            stateVersion: 0,
            seats: { black: false, white: false },
            seatNames: { black: '', white: '' },
            seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
            turnTimer: {
                limitSeconds: NETWORK_TURN_LIMIT_SECONDS,
                active: false,
                turnSeatKey: getCurrentPlayerKey(snapshot && snapshot.gameState),
                turnStartedAt: null,
                turnDeadlineAt: null
            },
            lastAcceptedOperationBySeat: {
                black: null,
                white: null
            },
            eventSeq: 0,
            chatMessages: [],
            chatSeq: 0,
            updatedAt: nowMs
        };
    }

    async isSnapshotGameOver(snapshot) {
        if (!snapshot || !snapshot.gameState) return false;
        try {
            const core = await loadCoreLogicModule();
            if (!core || typeof core.isGameOver !== 'function') return false;
            return !!core.isGameOver(snapshot.gameState);
        } catch (e) {
            return false;
        }
    }

    async refreshTurnTimer(options) {
        const opts = options || {};
        const room = this.room;
        if (!room) return false;

        const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.max(0, Math.trunc(Number(opts.nowMs))) : Date.now();
        const turnSeatKey = resolveTurnSeatKey(room);
        const shouldRunBySeats = hasTwoActiveSeats(room);
        const isGameOver = shouldRunBySeats ? await this.isSnapshotGameOver(room.snapshot) : false;
        const shouldBeActive = shouldRunBySeats && !isGameOver;

        if (!shouldBeActive) {
            const pausedTimer = createPausedTurnTimer(room);
            const changed = !areTurnTimersEqual(room.turnTimer, pausedTimer);
            room.turnTimer = pausedTimer;
            return changed;
        }

        const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!opts.forceRestart && timer && timer.active === true) {
            const timerSeatKey = parseSeatKeyOptional(timer.turnSeatKey);
            const timerDeadline = Number(timer.turnDeadlineAt);
            if (timerSeatKey === turnSeatKey && Number.isFinite(timerDeadline)) {
                timer.limitSeconds = NETWORK_TURN_LIMIT_SECONDS;
                return false;
            }
        }

        const activeTimer = createActiveTurnTimer(room, nowMs);
        const changed = !areTurnTimersEqual(room.turnTimer, activeTimer);
        room.turnTimer = activeTimer;
        return changed;
    }

    async applyExpiredTurnTimeoutIfNeeded(options) {
        const opts = options || {};
        if (!this.room) return { applied: false };

        const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.max(0, Math.trunc(Number(opts.nowMs))) : Date.now();
        const timerRefreshed = await this.refreshTurnTimer({ nowMs, forceRestart: false });
        if (timerRefreshed) {
            this.room.updatedAt = nowMs;
            await this.saveRoom();
        }

        const room = this.room;
        const timer = (room && room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
        if (!timer || timer.active !== true) return { applied: false };

        const deadline = Number(timer.turnDeadlineAt);
        if (!Number.isFinite(deadline) || deadline > nowMs) return { applied: false };

        const snapshot = room && room.snapshot && typeof room.snapshot === 'object' ? room.snapshot : null;
        if (!snapshot || !snapshot.gameState || !snapshot.cardState) return { applied: false };

        const timedOutSeatKey = parseSeatKeyOptional(timer.turnSeatKey) || resolveTurnSeatKey(room);
        const currentTurnSeatKey = resolveTurnSeatKey(room);
        if (timedOutSeatKey !== currentTurnSeatKey) {
            const corrected = await this.refreshTurnTimer({ nowMs, forceRestart: true });
            if (corrected) {
                room.updatedAt = nowMs;
                await this.saveRoom();
            }
            return { applied: false };
        }

        const core = await loadCoreLogicModule();
        const nextSnapshot = deepClone(snapshot);
        nextSnapshot.gameState = core.applyPass(nextSnapshot.gameState);
        if (nextSnapshot.cardState && typeof nextSnapshot.cardState === 'object') {
            nextSnapshot.cardState.presentationEvents = [];
            nextSnapshot.cardState._presentationEventsPersist = [];
            delete nextSnapshot.cardState._currentActionMeta;
            if (
                parseSeatKeyOptional(nextSnapshot.cardState.selectedCardOwnerKey) === timedOutSeatKey
            ) {
                nextSnapshot.cardState.selectedCardId = null;
                nextSnapshot.cardState.selectedCardOwnerKey = null;
            }
        }
        if (nextSnapshot.cardState && nextSnapshot.cardState.pendingEffectByPlayer && typeof nextSnapshot.cardState.pendingEffectByPlayer === 'object') {
            nextSnapshot.cardState.pendingEffectByPlayer[timedOutSeatKey] = null;
        }
        const serverPlaybackAssembly = await reconcileTurnStartAndCollectPlayback(room, nextSnapshot);
        reportPlaybackAssemblyDiagnostics('worker-timeout-pass', serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, {
            networkDebugEnabled: toPublicNetworkDebugEnabled(room)
        });
        const serverPlaybackEvents = (serverPlaybackAssembly && Array.isArray(serverPlaybackAssembly.playbackEvents))
            ? serverPlaybackAssembly.playbackEvents
            : [];
        const serverEffectLogs = (serverPlaybackAssembly && Array.isArray(serverPlaybackAssembly.effectLogs))
            ? serverPlaybackAssembly.effectLogs
            : [];

        room.stateVersion = Number.isFinite(Number(room.stateVersion))
            ? Math.max(0, Math.trunc(Number(room.stateVersion))) + 1
            : 1;

        nextSnapshot.stateVersion = room.stateVersion;
        nextSnapshot.updatedAt = nowMs;
        room.snapshot = nextSnapshot;
        room.updatedAt = nowMs;

        await this.refreshTurnTimer({ nowMs, forceRestart: true });
        await this.saveRoom();

        await this.broadcastSnapshot({
            playerKey: timedOutSeatKey,
            actionType: 'timeout_pass',
            playbackEvents: serverPlaybackEvents,
            effectLogs: serverEffectLogs,
            playbackDiagnostics: toDebugPlaybackDiagnostics(serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, toPublicNetworkDebugEnabled(room)),
            operationId: `timeout_${room.stateVersion}_${nowMs}`
        });

        return {
            applied: true,
            stateVersion: room.stateVersion,
            playerKey: timedOutSeatKey
        };
    }

    async handleInternalCreate(urlObj, body) {
        await this.loadRoom();
        if (this.room) {
            return jsonResponse(409, { ok: false, reason: 'ROOM_EXISTS' });
        }
        const payload = (body && typeof body === 'object') ? body : {};
        const roomId = normalizeRoomId(payload.roomId || (urlObj && urlObj.searchParams ? urlObj.searchParams.get('roomId') : ''));
        const seed = Number.isFinite(Number(payload.seed)) ? Number(payload.seed) : Date.now();
        const snapshot = (payload.snapshot && typeof payload.snapshot === 'object') ? payload.snapshot : null;
        const playerName = normalizeNetworkPlayerName(payload.playerName);
        const initialDeckSpec = (payload.initialDeckSpec && typeof payload.initialDeckSpec === 'object')
            ? deepClone(payload.initialDeckSpec)
            : null;
        const initialDeckSpecByPlayer = (payload.initialDeckSpecByPlayer && typeof payload.initialDeckSpecByPlayer === 'object')
            ? cloneInitialDeckSpecByPlayer(payload.initialDeckSpecByPlayer)
            : null;
        const roomDeck = (payload.roomDeck && typeof payload.roomDeck === 'object')
            ? deepClone(payload.roomDeck)
            : null;
        const networkDebugEnabled = payload.networkDebugEnabled === true;

        if (!roomId) {
            return jsonResponse(400, { ok: false, reason: 'ROOM_ID_REQUIRED' });
        }
        if (!snapshot || !snapshot.gameState || !snapshot.cardState) {
            return jsonResponse(400, { ok: false, reason: 'SNAPSHOT_REQUIRED' });
        }
        if (!playerName) {
            return jsonResponse(400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        }

        this.room = this.createRoomState(roomId, {
            seed,
            snapshot,
            initialDeckSpec,
            initialDeckSpecByPlayer,
            roomDeck,
            networkDebugEnabled
        });
        this.sseEventBuffer = [];
        this.room.seats.black = true;
        this.room.seatNames.black = playerName;
        this.room.updatedAt = Date.now();
        await this.refreshTurnTimer({ nowMs: this.room.updatedAt, forceRestart: false });
        await this.saveRoom();

        const serverTime = Date.now();

        return jsonResponse(200, {
            ok: true,
            roomId: this.room.roomId,
            seatKey: 'black',
            playerName,
            seatToken: this.room.seatTokens.black,
            seats: toPublicSeats(this.room),
            seatNames: toPublicSeatNames(this.room),
            roomDeck: toPublicRoomDeck(this.room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(this.room),
            stateVersion: this.room.stateVersion,
            snapshot: toPublicSnapshot(this.room, 'black'),
            turnTimer: toPublicTurnTimer(this.room, serverTime),
            serverTime
        });
    }

    async handleJoin(body) {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        const deckSelection = await resolveDeckSelection(body.deckCode);
        if (!deckSelection.ok) {
            return jsonResponse(400, {
                ok: false,
                reason: deckSelection.reason || 'DECK_CODE_INVALID'
            });
        }

        const playerName = normalizeNetworkPlayerName(body.playerName);
        if (!playerName) {
            return jsonResponse(400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        }

        const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
        const providedToken = String(body.seatToken || '').trim();
        const seatKey = resolveSeatForJoin(room, requestedSeatKey, providedToken);
        if (!seatKey) {
            return jsonResponse(409, { ok: false, reason: 'ROOM_FULL' });
        }

        if (!room.seatTokens || !room.seatTokens[seatKey]) {
            room.seatTokens = room.seatTokens || {};
            room.seatTokens[seatKey] = makeSeatToken();
        }
        const seatToken = room.seatTokens[seatKey];
        const rejoined = providedToken && providedToken === seatToken;

        const hadTwoSeats = hasTwoActiveSeats(room);
        room.seats[seatKey] = true;
        room.seatNames = room.seatNames && typeof room.seatNames === 'object'
            ? room.seatNames
            : { black: '', white: '' };
        room.seatNames[seatKey] = playerName;
        if (deckSelection.hasCustomDeck) {
            assignRoomDeckSelection(room, seatKey, deckSelection);
        }

        const hasTwoSeatsNow = hasTwoActiveSeats(room);
        let rebasedInitialSnapshot = false;
        if (!hadTwoSeats && hasTwoSeatsNow && room.stateVersion === 0) {
            try {
                const nextSnapshot = await makeInitialSnapshot(room.seed, buildInitialDeckSnapshotOptions(room));
                room.stateVersion = 1;
                nextSnapshot.stateVersion = room.stateVersion;
                nextSnapshot.updatedAt = Date.now();
                room.snapshot = nextSnapshot;
                room.updatedAt = nextSnapshot.updatedAt;
                rebasedInitialSnapshot = true;
            } catch (e) {
                return jsonResponse(500, { ok: false, reason: 'JOIN_DECK_INIT_FAILED' });
            }
        } else {
            room.updatedAt = Date.now();
        }

        await this.refreshTurnTimer({
            nowMs: room.updatedAt,
            forceRestart: !hadTwoSeats && hasTwoSeatsNow
        });
        await this.saveRoom();

        if (rebasedInitialSnapshot) {
            await this.broadcastSnapshot({
                playerKey: seatKey,
                actionType: 'join_room',
                playbackEvents: [],
                operationId: `join_room_${room.stateVersion}`
            });
        }

        await this.broadcastPresence({
            type: 'join',
            seatKey,
            rejoined: !!rejoined
        });

        const serverTime = Date.now();
        return jsonResponse(200, {
            ok: true,
            roomId: room.roomId,
            seatKey,
            playerName,
            seatToken,
            rejoined: !!rejoined,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            stateVersion: room.stateVersion,
            snapshot: toPublicSnapshot(room, seatKey),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        });
    }

    async handleLeave(body) {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(200, { ok: true });
        }

        const seatKey = normalizePlayerKey(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();

        if (seatToken && room.seatTokens && room.seatTokens[seatKey] !== seatToken) {
            return jsonResponse(403, { ok: false, reason: 'SEAT_TOKEN_MISMATCH' });
        }

        room.seats[seatKey] = false;
        room.seatNames = room.seatNames && typeof room.seatNames === 'object'
            ? room.seatNames
            : { black: '', white: '' };
        room.seatNames[seatKey] = '';
        room.updatedAt = Date.now();
        await this.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: false });

        await this.broadcastPresence({
            type: 'leave',
            seatKey,
            rejoined: false
        });

        if (!room.seats.black && !room.seats.white && this.streams.size === 0) {
            await this.removeRoom();
        } else {
            await this.saveRoom();
        }

        const serverTime = Date.now();
        return jsonResponse(200, {
            ok: true,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        });
    }

    async handlePublish(body) {
        await this.loadRoom();
        const room = this.room;

        if (!room) {
            return jsonResponse(404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = normalizePlayerKey(body.seatKey);
        const playerKey = normalizePlayerKey(body.playerKey);
        const seatToken = String(body.seatToken || '').trim();
        const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
        const actionType = String(body.actionType || '').trim().toLowerCase();
        const operationId = normalizeOperationId(body.operationId);
        const isRematchResetAction = actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
        const isNetworkDebugAction = isNetworkDebugFillHandPayload(body);
        const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
        const acceptedOperationsBySeat = ensureAcceptedOperationsBySeat(room);

        if (!room.seats[seatKey]) {
            return jsonResponse(403, buildPublishPayload(room, viewerSeatKey, {
                ok: false,
                rejectedReason: 'SEAT_NOT_JOINED',
                publishMeta: {
                    kind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion,
                    rejectedReason: 'SEAT_NOT_JOINED'
                }
            }));
        }

        if (seatKey !== playerKey) {
            return jsonResponse(403, buildPublishPayload(room, viewerSeatKey, {
                ok: false,
                rejectedReason: 'SEAT_MISMATCH',
                publishMeta: {
                    kind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion,
                    rejectedReason: 'SEAT_MISMATCH'
                }
            }));
        }

        if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
            return jsonResponse(403, buildPublishPayload(room, null, {
                ok: false,
                rejectedReason: 'SEAT_TOKEN_MISMATCH',
                publishMeta: {
                    kind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion,
                    rejectedReason: 'SEAT_TOKEN_MISMATCH'
                }
            }));
        }

        const lastAcceptedOperation = MatchAuthority && typeof MatchAuthority.findAcceptedOperationBySeat === 'function'
            ? MatchAuthority.findAcceptedOperationBySeat(room, seatKey, operationId)
            : acceptedOperationsBySeat[seatKey];
        if (
            operationId &&
            lastAcceptedOperation &&
            typeof lastAcceptedOperation === 'object'
        ) {
            const serverTime = Date.now();
            return jsonResponse(200, buildPublishPayload(room, seatKey, {
                ok: true,
                idempotentReplay: true,
                serverTime,
                publishMeta: {
                    kind: 'idempotent_replay',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion,
                    replayedStateVersion: lastAcceptedOperation.stateVersion
                }
            }));
        }

        if (baseVersion === null || baseVersion !== room.stateVersion) {
            const rejectedReason = MatchAuthority && typeof MatchAuthority.classifyVersionRejectionReason === 'function'
                ? MatchAuthority.classifyVersionRejectionReason(baseVersion, room.stateVersion)
                : 'VERSION_MISMATCH';
            return jsonResponse(409, buildPublishPayload(room, seatKey, {
                ok: false,
                rejectedReason,
                publishMeta: {
                    kind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion,
                    rejectedReason
                }
            }));
        }

        const expectedPlayerKey = getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
        if (playerKey !== expectedPlayerKey) {
            const allowOutOfTurnRematch = isRematchResetAction && await this.isSnapshotGameOver(room.snapshot);
            const allowOutOfTurnNetworkDebug = isNetworkDebugAction && toPublicNetworkDebugEnabled(room);
            const allowFateWillController = MatchAuthority && typeof MatchAuthority.isFateWillControllerForCurrentTurn === 'function'
                && MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, playerKey);
            if (!allowOutOfTurnRematch && !allowOutOfTurnNetworkDebug && !allowFateWillController) {
                return jsonResponse(409, buildPublishPayload(room, seatKey, {
                    ok: false,
                    rejectedReason: 'OUT_OF_TURN',
                    publishMeta: {
                        kind: 'rejected',
                        operationId,
                        actionType,
                        receivedBaseVersion: baseVersion,
                        authoritativeStateVersion: room.stateVersion,
                        rejectedReason: 'OUT_OF_TURN'
                    }
                }));
            }
        }

        const hasCommandPayload = !!(
            !isRematchResetAction
            && body
            && typeof body === 'object'
            && (
                (body.params && typeof body.params === 'object')
                || (body.actor && String(body.actor).trim())
                || (body.action && typeof body.action === 'object')
            )
        );

        let nextSnapshot;
        let serverPlaybackEvents = [];
        let serverEffectLogs = [];
        let serverPlaybackDiagnostics = null;
        if (isRematchResetAction) {
            const rematchSeed = Date.now();
            try {
                nextSnapshot = await makeInitialSnapshot(rematchSeed, buildInitialDeckSnapshotOptions(room));
                room.seed = rematchSeed;
            } catch (e) {
                return jsonResponse(500, buildPublishPayload(room, seatKey, {
                    ok: false,
                    rejectedReason: 'REMATCH_RESET_FAILED',
                    publishMeta: {
                        kind: 'rejected',
                        operationId,
                        actionType,
                        receivedBaseVersion: baseVersion,
                        authoritativeStateVersion: room.stateVersion,
                        rejectedReason: 'REMATCH_RESET_FAILED'
                    }
                }));
            }
        } else if (hasCommandPayload) {
            const commandResult = await applyCommandPublishToSnapshot(room, body, playerKey);
            if (!commandResult.ok) {
                return jsonResponse(409, buildPublishPayload(room, seatKey, {
                    ok: false,
                    rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED',
                    errorMessage: commandResult.errorMessage || null,
                    publishMeta: {
                        kind: 'rejected',
                        operationId,
                        actionType,
                        receivedBaseVersion: baseVersion,
                        authoritativeStateVersion: room.stateVersion,
                        rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED'
                    }
                }));
            }
            nextSnapshot = commandResult.snapshot;
            serverPlaybackEvents = Array.isArray(commandResult.playbackEvents) ? commandResult.playbackEvents : [];
            serverEffectLogs = Array.isArray(commandResult.effectLogs) ? commandResult.effectLogs : [];
            serverPlaybackDiagnostics = commandResult.playbackDiagnostics || null;
        } else {
            return jsonResponse(409, buildPublishPayload(room, seatKey, {
                ok: false,
                rejectedReason: 'COMMAND_REQUIRED',
                publishMeta: {
                    kind: 'rejected',
                    operationId,
                    actionType,
                    receivedBaseVersion: baseVersion,
                    authoritativeStateVersion: room.stateVersion,
                    rejectedReason: 'COMMAND_REQUIRED'
                }
            }));
        }

        room.stateVersion += 1;
        nextSnapshot.stateVersion = room.stateVersion;
        nextSnapshot.updatedAt = Date.now();

        room.snapshot = nextSnapshot;
        room.updatedAt = nextSnapshot.updatedAt;
        if (operationId) {
            const acceptedEntry = {
                operationId,
                stateVersion: room.stateVersion,
                updatedAt: room.updatedAt
            };
            if (MatchAuthority && typeof MatchAuthority.rememberAcceptedOperationBySeat === 'function') {
                MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, acceptedEntry);
            } else {
                acceptedOperationsBySeat[seatKey] = acceptedEntry;
            }
        }
        await this.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: !isNetworkDebugAction });

        const meta = {
            playerKey,
            actionType: body.actionType ? String(body.actionType) : null,
            playbackEvents: serverPlaybackEvents,
            effectLogs: serverEffectLogs,
            playbackDiagnostics: serverPlaybackDiagnostics,
            operationId: operationId || null
        };
        const serverTime = Date.now();
        const preparedSnapshot = this.prepareSnapshotBroadcast(meta);
        const responsePayload = buildPublishPayload(room, seatKey, {
            ok: true,
            serverTime,
            playbackEvents: serverPlaybackEvents,
            effectLogs: serverEffectLogs,
            playbackDiagnostics: serverPlaybackDiagnostics,
            publishMeta: {
                kind: 'accepted',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion
            }
        });
        if (MatchAuthority && typeof MatchAuthority.stripTransientChargeDeltaState === 'function') {
            MatchAuthority.stripTransientChargeDeltaState(room.snapshot);
        }
        await this.saveRoom();
        await this.broadcastSnapshot({
            ...meta,
            __preparedSnapshot: preparedSnapshot
        });
        return jsonResponse(200, responsePayload);
    }

    async handleState(urlObj) {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = parseSeatKeyOptional(urlObj && urlObj.searchParams ? urlObj.searchParams.get('seatKey') : null);
        const seatToken = String(urlObj && urlObj.searchParams ? (urlObj.searchParams.get('seatToken') || '') : '').trim();
        const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
        if (!viewerSeatKey) {
            return jsonResponse(403, { ok: false, reason: seatToken ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED' });
        }

        const serverTime = Date.now();

        return jsonResponse(200, {
            ok: true,
            roomId: room.roomId,
            stateVersion: room.stateVersion,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            snapshot: toPublicSnapshot(room, viewerSeatKey),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        });
    }

    async handleStream(request) {
        await this.loadRoom();
        const room = this.room;
        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const urlObj = new URL(request.url);
        const seatKey = parseSeatKeyOptional(urlObj.searchParams.get('seatKey') || '');
        const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
        const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
        if (!viewerSeatKey) {
            return jsonResponse(403, { ok: false, reason: seatToken ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED' });
        }

        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();

        this.streamSeq += 1;
        const streamId = `sse_${this.streamSeq}_${Date.now()}`;
        this.streams.set(streamId, { writer, seatKey: viewerSeatKey });
        this.ensureHeartbeatTimer();
        const lastEventId = String(request.headers.get('Last-Event-ID') || '').trim();
        const replayEvents = MatchAuthority && typeof MatchAuthority.getBufferedSseReplayEvents === 'function'
            ? MatchAuthority.getBufferedSseReplayEvents(this.sseEventBuffer, lastEventId, viewerSeatKey)
            : null;

        const onAbort = () => {
            this.closeStream(streamId).catch(() => {});
        };

        try {
            if (request.signal && typeof request.signal.addEventListener === 'function') {
                request.signal.addEventListener('abort', onAbort, { once: true });
            }
        } catch (e) { /* ignore */ }

        const initialPayload = buildSnapshotPayload(room, { playbackEvents: [] }, viewerSeatKey);

        queueMicrotask(() => {
            (async () => {
                try {
                    if (Array.isArray(replayEvents)) {
                        if (replayEvents.length > 0) {
                            for (const event of replayEvents) {
                                await this.sendSse(streamId, event.eventName, event.payload, { eventId: event.eventId });
                            }
                        } else {
                            await this.sendSse(streamId, 'heartbeat', buildHeartbeatPayload(room, Date.now()), { eventId: null });
                        }
                        return;
                    }
                    await this.sendSse(streamId, 'snapshot', initialPayload);
                    await this.sendSse(streamId, 'chat', {
                        ok: true,
                        roomId: room.roomId,
                        type: 'history',
                        seats: toPublicSeats(room),
                        seatNames: toPublicSeatNames(room),
                        roomDeck: toPublicRoomDeck(room),
                        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
                        messages: toPublicChatMessages(room)
                    });
                } catch (e) {
                    this.closeStream(streamId).catch(() => {});
                }
            })();
        });

        return new Response(readable, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
                Connection: 'keep-alive',
                ...CORS_HEADERS
            }
        });
    }

    async loadLeaderboardStore() {
        const empty = {
            version: LEADERBOARD_STORAGE_VERSION,
            players: {},
            updatedAt: Date.now()
        };

        const raw = await this.state.storage.get(LEADERBOARD_STORAGE_KEY);
        if (!raw || typeof raw !== 'object') return empty;

        const playersRaw = (raw.players && typeof raw.players === 'object') ? raw.players : {};
        const players = {};

        for (const [key, entry] of Object.entries(playersRaw)) {
            const normalized = normalizeLeaderboardEntry(entry, key);
            if (!normalized) continue;
            players[normalized.playerId] = normalized;
        }

        const updatedAt = Number.isFinite(Number(raw.updatedAt))
            ? Math.max(0, Math.trunc(Number(raw.updatedAt)))
            : Date.now();

        return {
            version: LEADERBOARD_STORAGE_VERSION,
            players,
            updatedAt
        };
    }

    async saveLeaderboardStore(store) {
        await this.state.storage.put(LEADERBOARD_STORAGE_KEY, {
            version: LEADERBOARD_STORAGE_VERSION,
            players: (store && store.players && typeof store.players === 'object') ? store.players : {},
            updatedAt: Number.isFinite(Number(store && store.updatedAt)) ? Math.max(0, Math.trunc(Number(store.updatedAt))) : Date.now()
        });
    }

    listLeaderboardEntries(store, limit) {
        const rows = Object.values((store && store.players) || {})
            .map((entry) => normalizeLeaderboardEntry(entry))
            .filter(Boolean);

        sortLeaderboardEntries(rows);

        const clipped = rows.slice(0, normalizeLeaderboardLimit(limit));
        return clipped.map((entry, index) => ({
            rank: index + 1,
            playerId: entry.playerId,
            playerName: entry.playerName,
            bestScore: entry.bestScore,
            mode: entry.mode,
            cpuLevel: entry.cpuLevel,
            updatedAt: entry.updatedAt,
            scoreVersion: entry.scoreVersion,
            turnCount: entry.turnCount
        }));
    }

    async handleLeaderboardSubmit(body) {
        const playerId = normalizeLeaderboardPlayerId(body && body.playerId);
        if (!playerId) {
            return jsonResponse(400, { ok: false, reason: 'PLAYER_ID_REQUIRED' });
        }

        const playerName = normalizeLeaderboardPlayerName(body && body.playerName);
        const score = clampLeaderboardScore(body && body.score);
        const mode = normalizeLeaderboardMode(body && body.mode);
        const cpuLevel = normalizeLeaderboardCpuLevel(body && body.cpuLevel);
        const scoreVersion = Number.isFinite(Number(body && body.scoreVersion)) ? Math.max(0, Math.trunc(Number(body.scoreVersion))) : null;
        const turnCount = Number.isFinite(Number(body && body.turnCount)) ? Math.max(0, Math.trunc(Number(body.turnCount))) : null;

        const store = await this.loadLeaderboardStore();
        const now = Date.now();
        const current = normalizeLeaderboardEntry(store.players[playerId], playerId);
        const previousBest = current ? current.bestScore : 0;
        const updated = score > previousBest;
        const bestScore = updated ? score : previousBest;
        const nextMode = (updated || !current) ? mode : current.mode;
        const nextCpuLevel = (updated || !current) ? cpuLevel : current.cpuLevel;
        const nextScoreVersion = (updated || !current) ? scoreVersion : current.scoreVersion;
        const nextTurnCount = (updated || !current) ? turnCount : current.turnCount;

        store.players[playerId] = {
            playerId,
            playerName,
            bestScore,
            lastScore: score,
            mode: nextMode,
            cpuLevel: nextCpuLevel,
            scoreVersion: nextScoreVersion,
            turnCount: nextTurnCount,
            updatedAt: updated ? now : (current ? current.updatedAt : now),
            submittedAt: now
        };

        const allRows = Object.values(store.players)
            .map((entry) => normalizeLeaderboardEntry(entry))
            .filter(Boolean);
        sortLeaderboardEntries(allRows);

        if (allRows.length > LEADERBOARD_MAX_STORED_PLAYERS) {
            const keep = new Set(allRows.slice(0, LEADERBOARD_MAX_STORED_PLAYERS).map((entry) => entry.playerId));
            for (const id of Object.keys(store.players)) {
                if (!keep.has(id)) delete store.players[id];
            }
        }

        store.updatedAt = now;
        await this.saveLeaderboardStore(store);

        const listLimit = normalizeLeaderboardLimit(body && body.limit);
        const entries = this.listLeaderboardEntries(store, listLimit);
        const playerRank = allRows.findIndex((entry) => entry.playerId === playerId) + 1;

        return jsonResponse(200, {
            ok: true,
            version: LEADERBOARD_STORAGE_VERSION,
            playerId,
            playerName,
            updated,
            previousBest,
            bestScore,
            score,
            rank: playerRank > 0 ? playerRank : null,
            entries,
            updatedAt: store.updatedAt,
            serverTime: Date.now()
        });
    }

    async handleLeaderboardList(urlObj) {
        const limit = normalizeLeaderboardLimit(urlObj && urlObj.searchParams ? urlObj.searchParams.get('limit') : LEADERBOARD_DEFAULT_LIMIT);
        const store = await this.loadLeaderboardStore();
        const entries = this.listLeaderboardEntries(store, limit);

        return jsonResponse(200, {
            ok: true,
            version: LEADERBOARD_STORAGE_VERSION,
            limit,
            entries,
            updatedAt: store.updatedAt,
            serverTime: Date.now()
        });
    }

    async fetch(request) {
        const urlObj = new URL(request.url);
        const pathname = urlObj.pathname;

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method === 'POST' && pathname === '/api/leaderboard/submit') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleLeaderboardSubmit(parsed || {});
        }

        if (request.method === 'GET' && pathname === '/api/leaderboard/list') {
            return this.handleLeaderboardList(urlObj);
        }

        if (request.method === 'POST' && pathname === '/internal/create') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleInternalCreate(urlObj, parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/join') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleJoin(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/leave') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleLeave(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/publish') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handlePublish(parsed || {});
        }

        if (request.method === 'POST' && pathname === '/api/match/chat') {
            const parsed = parseJsonBody(await request.text());
            if (parsed === null) return jsonResponse(400, { ok: false, reason: 'INVALID_JSON' });
            return this.handleChat(parsed || {});
        }

        if (request.method === 'GET' && pathname === '/api/match/state') {
            return this.handleState(urlObj);
        }

        if (request.method === 'GET' && pathname === '/api/match/stream') {
            return this.handleStream(request);
        }

        return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
    }

    async handleChat(body) {
        await this.loadRoom();
        const room = this.room;

        if (!room) {
            return jsonResponse(404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        }

        await this.applyExpiredTurnTimeoutIfNeeded();

        const seatKey = normalizePlayerKey(body.seatKey);
        const seatToken = String(body.seatToken || '').trim();
        if (!room.seats[seatKey]) {
            return jsonResponse(403, {
                ok: false,
                reason: 'SEAT_NOT_JOINED',
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }
        if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
            return jsonResponse(403, {
                ok: false,
                reason: 'SEAT_TOKEN_MISMATCH',
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }
        if (!room.seats.black || !room.seats.white) {
            return jsonResponse(409, {
                ok: false,
                reason: 'CHAT_DISABLED',
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }

        const parsedText = parseChatMessageText(body.message);
        if (!parsedText.ok) {
            return jsonResponse(400, {
                ok: false,
                reason: parsedText.reason,
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                maxLength: CHAT_MAX_LENGTH,
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }

        room.chatSeq = Number.isFinite(Number(room.chatSeq)) ? Number(room.chatSeq) : 0;
        room.chatSeq += 1;

        const message = {
            id: room.chatSeq,
            seatKey,
            text: parsedText.text,
            serverTime: Date.now()
        };

        room.chatMessages = Array.isArray(room.chatMessages) ? room.chatMessages : [];
        room.chatMessages.push(message);
        if (room.chatMessages.length > CHAT_HISTORY_LIMIT) {
            room.chatMessages.splice(0, room.chatMessages.length - CHAT_HISTORY_LIMIT);
        }
        room.updatedAt = message.serverTime;
        await this.saveRoom();

        const payload = {
            ok: true,
            roomId: room.roomId,
            type: 'message',
            message,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room)
        };

        await this.broadcastChat(payload);

        return jsonResponse(200, {
            ok: true,
            roomId: room.roomId,
            message,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            networkDebugEnabled: toPublicNetworkDebugEnabled(room),
            turnTimer: toPublicTurnTimer(room),
            serverTime: Date.now()
        });
    }
}

export default {
    async fetch(request, env) {
        const urlObj = new URL(request.url);

        if (urlObj.pathname.startsWith('/api/match/')) {
            return handleMatchApi(request, env);
        }

        if (urlObj.pathname.startsWith('/api/leaderboard/')) {
            return handleLeaderboardApi(request, env);
        }

        if (env.ASSETS && typeof env.ASSETS.fetch === 'function') {
            return env.ASSETS.fetch(request);
        }

        return new Response('Not Found', { status: 404 });
    }
};
