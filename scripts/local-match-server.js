const http = require('http');
const { URL } = require('url');

const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const TurnPipelineUIAdapter = require('../game/turn/pipeline_ui_adapter');
const SeededPRNG = require('../game/schema/prng');
const deepClone = require('../utils/deepClone');
const MatchAuthority = require('../utils/match-authority');
const NetworkActionSchema = require('../shared/network-action-schema');
const PlaybackEventHelpers = require('../shared/playback-event-helpers');
const DeckCodecModule = require('../shared/deck-codec');
const DeckSpecHelpers = require('../shared/deck-spec');

function readArgValue(name) {
    const key = `--${name}`;
    const idx = process.argv.indexOf(key);
    if (idx >= 0 && idx + 1 < process.argv.length) {
        return String(process.argv[idx + 1] || '').trim();
    }
    return '';
}

const argHost = readArgValue('host');
const argPort = readArgValue('port');
const HOST = argHost || process.env.MATCH_HOST || '127.0.0.1';
const PORT = Number.isFinite(Number(argPort))
    ? Number(argPort)
    : (Number.isFinite(Number(process.env.MATCH_PORT)) ? Number(process.env.MATCH_PORT) : 8787);

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 3;
const SEAT_TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SEAT_TOKEN_LENGTH = 24;
const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;
const NETWORK_PLAYER_NAME_MAX = 7;
const NETWORK_TURN_LIMIT_SECONDS = 120;
const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;
const SSE_HEARTBEAT_INTERVAL_MS = 10000;
const NETWORK_DEBUG_FILL_HAND_ACTION = 'debug_fill_hand';

const rooms = new Map();
let heartbeatIntervalId = 0;

function parseSeatKeyOptional(value) {
    return MatchAuthority.parseSeatKeyOptional(value);
}

function normalizePlayerKey(value) {
    return MatchAuthority.normalizePlayerKey(value, 'black');
}

function getCurrentPlayerKey(gameState) {
    return MatchAuthority.getCurrentPlayerKey(gameState);
}

function normalizeOperationId(value) {
    return MatchAuthority.normalizeOperationId(value);
}

function ensureAcceptedOperationsBySeat(room) {
    return MatchAuthority.ensureAcceptedOperationsBySeat(room);
}

function resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue) {
    return MatchAuthority && typeof MatchAuthority.resolveAuthenticatedSeatKey === 'function'
        ? MatchAuthority.resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue)
        : null;
}

function classifySeatTokenRejectionReason(seatTokenValue) {
    return MatchAuthority && typeof MatchAuthority.classifySeatTokenRejectionReason === 'function'
        ? MatchAuthority.classifySeatTokenRejectionReason(seatTokenValue)
        : (String(seatTokenValue || '').trim() ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED');
}

function toPublicSnapshot(room, viewerSeatKey) {
    return MatchAuthority.buildPublicSnapshot(room, viewerSeatKey || null);
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
    if (MatchAuthority && typeof MatchAuthority.appendEffectLogMessages === 'function') {
        return MatchAuthority.appendEffectLogMessages(...lists);
    }
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

function resolveActionCardDisplayName(action) {
    const cardId = resolveActionCardId(action);
    if (!cardId) return '';
    const cardDef = (CardLogic && typeof CardLogic.getCardDef === 'function')
        ? CardLogic.getCardDef(cardId)
        : null;
    const displayName = cardDef && cardDef.name ? String(cardDef.name).trim() : '';
    return displayName || cardId;
}

function buildNetworkCardUseEffectLogs(action, playerKey) {
    const actionType = String(action && (action.type || action.actionType) ? (action.type || action.actionType) : '').trim().toLowerCase();
    if (actionType !== 'use_card') return [];
    const displayName = resolveActionCardDisplayName(action);
    if (!displayName) return [];
    return [`${getSeatLabelJa(playerKey)}がカードを使用: ${displayName}`];
}

function collectPipelineEffectLogMessages(rawEvents, presentationEvents, playerKey) {
    if (!TurnPipelineUIAdapter || typeof TurnPipelineUIAdapter.mapEffectLogsFromPipeline !== 'function') {
        return [];
    }
    try {
        return normalizeEffectLogMessages(
            TurnPipelineUIAdapter.mapEffectLogsFromPipeline(rawEvents, presentationEvents, playerKey) || []
        );
    } catch (e) {
        return [];
    }
}

function randomFromChars(chars, length) {
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

function makeRoomId() {
    return randomFromChars(ROOM_ID_CHARS, ROOM_ID_LENGTH);
}

function makeSeatToken() {
    return randomFromChars(SEAT_TOKEN_CHARS, SEAT_TOKEN_LENGTH);
}

function normalizeNetworkPlayerName(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, NETWORK_PLAYER_NAME_MAX).join('');
}

function isNetworkDebugFillHandAction(value) {
    return String(value || '').trim().toLowerCase() === NETWORK_DEBUG_FILL_HAND_ACTION;
}

function isNetworkDebugFillHandPayload(value) {
    if (!value || typeof value !== 'object') return false;
    if (isNetworkDebugFillHandAction(value.actionType)) return true;
    return isNetworkDebugFillHandAction(value.action && value.action.type);
}

function makeInitialSnapshot(seed, options) {
    const opts = buildInitialDeckSnapshotOptions(options);
    const gameState = Core.createGameState(opts.boardConfig);
    const prng = SeededPRNG.createPRNG(seed);
    const cardState = CardLogic.createCardState(prng, opts);

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

function resolveDeckSelection(rawDeckCodeValue) {
    const rawDeckCode = String(rawDeckCodeValue || '').trim();
    if (!rawDeckCode) {
        return { ok: true, hasCustomDeck: false, deckSpec: null, deckCode: '', deckSize: null };
    }
    try {
        const decoded = DeckCodecModule.decodeDeckCode(rawDeckCode);
        const normalized = DeckSpecHelpers.normalizeDeckSpec(decoded);
        const summary = DeckSpecHelpers.summarizeDeckSpec(normalized);
        const canonical = DeckCodecModule.encodeDeckSpec(normalized);
        return {
            ok: true,
            hasCustomDeck: true,
            deckSpec: normalized,
            deckCode: canonical,
            deckSize: Number.isFinite(Number(summary && summary.deckSize)) ? Number(summary.deckSize) : null
        };
    } catch (error) {
        return { ok: false, reason: (error && error.code) ? String(error.code) : 'DECK_CODE_INVALID' };
    }
}

function buildInitialDeckSnapshotOptions(room) {
    const source = (room && typeof room === 'object') ? room : {};
    const options = {};
    const byPlayer = source.initialDeckSpecByPlayer;
    if (byPlayer && (byPlayer.black || byPlayer.white)) {
        options.initialDeckSpecByPlayer = deepClone(byPlayer);
    } else if (source.initialDeckSpec && typeof source.initialDeckSpec === 'object') {
        options.initialDeckSpec = deepClone(source.initialDeckSpec);
    }
    const boardConfig = MatchAuthority.resolveRoomBoardConfig(source);
    if (boardConfig) {
        options.boardConfig = boardConfig;
    }
    return options;
}

function assignRoomDeckSelection(room, seatKey, deckSelection) {
    if (!room || !deckSelection || deckSelection.hasCustomDeck !== true) return;
    if (!room.initialDeckSpecByPlayer) {
        room.initialDeckSpecByPlayer = { black: null, white: null };
    }
    room.initialDeckSpecByPlayer[seatKey] = deckSelection.deckSpec ? deepClone(deckSelection.deckSpec) : null;
    if (!room.roomDeck) {
        room.roomDeck = {
            mode: 'perPlayer',
            deckCode: '',
            deckSize: null,
            deckCodeByPlayer: { black: '', white: '' },
            deckSizeByPlayer: { black: null, white: null },
            source: 'room'
        };
    }
    room.roomDeck.deckCodeByPlayer[seatKey] = deckSelection.deckCode || '';
    room.roomDeck.deckSizeByPlayer[seatKey] = deckSelection.deckSize;
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

function createTurnStartSeed(room, snapshot, playerKey) {
    const gameState = snapshot && snapshot.gameState;
    const cardState = snapshot && snapshot.cardState;
    let seed = Number.isFinite(Number(room && room.seed)) ? (Math.trunc(Number(room.seed)) >>> 0) : 1;
    seed = mixSeed(seed, snapshot && snapshot.stateVersion);
    seed = mixSeed(seed, gameState && gameState.turnNumber);
    seed = mixSeed(seed, cardState && cardState.turnIndex);
    seed = mixSeed(seed, playerKey === 'white' ? 0x9E3779B1 : 0x243F6A88);
    return seed || 1;
}

function createTurnStartPrng(room, snapshot, playerKey) {
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
    return SeededPRNG.createPRNG(createTurnStartSeed(room, snapshot, playerKey));
}

function normalizeCardStateForTurnStart(room, snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const currentCardState = (snapshot.cardState && typeof snapshot.cardState === 'object')
        ? snapshot.cardState
        : {};
    const currentPlayerKey = getCurrentPlayerKey(snapshot.gameState);
    const baselinePrng = SeededPRNG.createPRNG(createTurnStartSeed(room, snapshot, currentPlayerKey));
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

function reconcileTurnStartIfNeeded(room, snapshot, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (!snapshot || !snapshot.gameState || !snapshot.cardState) return opts.includeRawEvents ? [] : snapshot;

    const currentPlayerKey = getCurrentPlayerKey(snapshot.gameState);
    const lastTurnStartedFor = parseSeatKeyOptional(snapshot.cardState.lastTurnStartedFor);
    if (lastTurnStartedFor === currentPlayerKey) {
        return opts.includeRawEvents ? [] : snapshot;
    }
    if (typeof Core.isGameOver === 'function' && Core.isGameOver(snapshot.gameState)) {
        return opts.includeRawEvents ? [] : snapshot;
    }

    normalizeCardStateForTurnStart(room, snapshot);
    const prng = createTurnStartPrng(room, snapshot, currentPlayerKey);
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

function mapServerPresentationToPlaybackEvents(presentationEvents, rawEvents, snapshot) {
    const events = Array.isArray(presentationEvents) ? presentationEvents : [];
    if (PlaybackEventHelpers && typeof PlaybackEventHelpers.assemblePlaybackEvents === 'function') {
        return PlaybackEventHelpers.assemblePlaybackEvents({
            rawEvents: Array.isArray(rawEvents) ? rawEvents : [],
            presentationEvents: events,
            snapshot,
            fallbackPlayerKey: getCurrentPlayerKey(snapshot && snapshot.gameState),
            adapter: TurnPipelineUIAdapter,
            normalizePlayerKey
        });
    }

    if (events.length === 0) {
        return { playbackEvents: [], diagnostics: null };
    }

    if (!TurnPipelineUIAdapter || typeof TurnPipelineUIAdapter.mapToPlaybackEvents !== 'function') {
        return { playbackEvents: deepClone(events), diagnostics: null };
    }

    return {
        playbackEvents: TurnPipelineUIAdapter.mapToPlaybackEvents(
            events,
            snapshot && snapshot.cardState,
            snapshot && snapshot.gameState
        ) || [],
        diagnostics: null
    };
}

function collectServerPlaybackEvents(snapshot, rawEvents) {
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
    const assembly = mapServerPresentationToPlaybackEvents(presentationEvents, rawEvents, snapshot);
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
        roomBoardConfig: toPublicRoomBoardConfig(room),
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

function appendTurnStartDrawPlaybackEvents(playbackAssembly, snapshot, handState) {
    const assembly = (playbackAssembly && typeof playbackAssembly === 'object')
        ? playbackAssembly
        : { playbackEvents: Array.isArray(playbackAssembly) ? playbackAssembly : [], diagnostics: null };
    const baseEvents = Array.isArray(assembly.playbackEvents) ? assembly.playbackEvents.slice() : [];
    const playerKey = normalizePlayerKey(handState && handState.playerKey);
    if (!playerKey) return assembly;

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

    const drawPlaybackEvents = TurnPipelineUIAdapter.mapToPlaybackEvents(
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

function reconcileTurnStartAndCollectPlayback(room, snapshot) {
    const handState = captureTurnStartHandState(snapshot);
    if (MatchAuthority && typeof MatchAuthority.stripTransientPresentationState === 'function') {
        MatchAuthority.stripTransientPresentationState(snapshot);
    } else if (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object') {
        snapshot.cardState.presentationEvents = [];
        snapshot.cardState._presentationEventsPersist = [];
        delete snapshot.cardState._currentActionMeta;
    }
    const rawEvents = reconcileTurnStartIfNeeded(room, snapshot, { includeRawEvents: true });
    const playbackAssembly = collectServerPlaybackEvents(snapshot, rawEvents);
    const effectLogs = collectPipelineEffectLogMessages(
        rawEvents,
        playbackAssembly && Array.isArray(playbackAssembly.presentationEvents) ? playbackAssembly.presentationEvents : [],
        playbackAssembly && playbackAssembly.playerKey ? playbackAssembly.playerKey : getCurrentPlayerKey(snapshot && snapshot.gameState)
    );
    return appendTurnStartDrawPlaybackEvents(
        Object.assign({}, playbackAssembly, { effectLogs }),
        snapshot,
        handState
    );
}

function createCommandActionPrng(room, snapshot) {
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
    return SeededPRNG.createPRNG(createTurnStartSeed(room, snapshot, getCurrentPlayerKey(snapshot && snapshot.gameState)));
}

function applyCommandPublishToSnapshot(room, body, playerKey) {
    if (!NetworkActionSchema || typeof NetworkActionSchema.buildAction !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_SCHEMA_UNAVAILABLE' };
    }
    if (!TurnPipeline || typeof TurnPipeline.applyTurnSafe !== 'function') {
        return { ok: false, rejectedReason: 'COMMAND_PIPELINE_UNAVAILABLE' };
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
        const DebugActions = require('../game/debug/debug-actions');
        if (!DebugActions || typeof DebugActions.fillDebugHand !== 'function') {
            return { ok: false, rejectedReason: 'DEBUG_ACTIONS_UNAVAILABLE' };
        }

        const applied = DebugActions.fillDebugHand(currentSnapshot.cardState, { playerKey });
        if (!applied) {
            return { ok: false, rejectedReason: 'DEBUG_FILL_HAND_FAILED' };
        }

        MatchAuthority.stripTransientPresentationState(currentSnapshot);
        return {
            ok: true,
            snapshot: currentSnapshot,
            playbackEvents: [],
            playbackDiagnostics: null,
            effectLogs: []
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

    const prng = createCommandActionPrng(room, currentSnapshot);
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
            errorMessage: result && result.errorMessage ? String(result.errorMessage) : null
        };
    }

    const nextSnapshot = {
        gameState: result.gameState,
        cardState: result.cardState
    };
    const playbackAssembly = mapServerPresentationToPlaybackEvents(
        result.presentationEvents,
        result.events,
        nextSnapshot
    );
    reportPlaybackAssemblyDiagnostics('local-server-action', playbackAssembly && playbackAssembly.diagnostics, {
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    });
    const playbackEvents = (playbackAssembly && Array.isArray(playbackAssembly.playbackEvents))
        ? playbackAssembly.playbackEvents
        : [];
    const actionPresentationEvents = Array.isArray(result.presentationEvents)
        ? result.presentationEvents
        : ((result.cardState && Array.isArray(result.cardState.presentationEvents)) ? result.cardState.presentationEvents : []);
    const actionEffectLogs = appendEffectLogMessages(
        buildNetworkCardUseEffectLogs(builtAction.action, playerKey),
        collectPipelineEffectLogMessages(result.events, actionPresentationEvents, playerKey)
    );

    const turnStartPlaybackAssembly = reconcileTurnStartAndCollectPlayback(room, nextSnapshot);
    reportPlaybackAssemblyDiagnostics('local-server-turn-start', turnStartPlaybackAssembly && turnStartPlaybackAssembly.diagnostics, {
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
    MatchAuthority.stripTransientPresentationState(nextSnapshot);

    return {
        ok: true,
        snapshot: nextSnapshot,
        playbackEvents: combinedPlaybackEvents,
        playbackDiagnostics: toDebugPlaybackDiagnostics(playbackAssembly && playbackAssembly.diagnostics, toPublicNetworkDebugEnabled(room)),
        effectLogs: combinedEffectLogs
    };
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

function refreshTurnTimer(room, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    const nowMs = Number.isFinite(Number(opts.nowMs)) ? Math.max(0, Math.trunc(Number(opts.nowMs))) : Date.now();
    const shouldRunBySeats = hasTwoActiveSeats(room);
    const isGameOver = shouldRunBySeats && typeof Core.isGameOver === 'function' && Core.isGameOver(room && room.snapshot && room.snapshot.gameState);
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
        if (timerSeatKey === resolveTurnSeatKey(room) && Number.isFinite(timerDeadline)) {
            timer.limitSeconds = NETWORK_TURN_LIMIT_SECONDS;
            return false;
        }
    }

    const activeTimer = createActiveTurnTimer(room, nowMs);
    const changed = !areTurnTimersEqual(room.turnTimer, activeTimer);
    room.turnTimer = activeTimer;
    return changed;
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

function toPublicRoomDeck(room) {
    return (room && room.roomDeck) ? deepClone(room.roomDeck) : null;
}

function toPublicRoomBoardConfig(room) {
    return MatchAuthority.resolveRoomBoardConfig(room);
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

function writeJson(res, statusCode, payload) {
    const body = JSON.stringify(payload || {});
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end(body);
}

function sseChunk(eventName, payload, eventId) {
    const data = JSON.stringify(payload || {});
    const hasEventId = !(eventId === null || typeof eventId === 'undefined' || String(eventId) === '');
    const idLine = hasEventId ? `id: ${String(eventId)}\n` : '';
    const eventLine = eventName ? `event: ${eventName}\n` : '';
    return `${idLine}${eventLine}data: ${data}\n\n`;
}

function writeSse(res, eventName, payload, eventId) {
    res.write(sseChunk(eventName, payload, eventId));
}

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', (chunk) => {
            raw += chunk;
            if (raw.length > 5 * 1024 * 1024) {
                reject(new Error('payload_too_large'));
            }
        });
        req.on('end', () => {
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(new Error('invalid_json'));
            }
        });
        req.on('error', reject);
    });
}

function nextSseEventId(room) {
    const prevSeq = Number.isFinite(Number(room && room.eventSeq))
        ? Math.max(0, Math.trunc(Number(room.eventSeq)))
        : 0;
    const nextSeq = prevSeq + 1;
    if (room) room.eventSeq = nextSeq;
    const roomId = room && room.roomId ? String(room.roomId) : 'room';
    const stateVersion = Number.isFinite(Number(room && room.stateVersion))
        ? Math.max(0, Math.trunc(Number(room.stateVersion)))
        : 0;
    return `${roomId}_${stateVersion}_${nextSeq}`;
}

function buildHeartbeatPayload(room, serverTime) {
    return {
        ok: true,
        roomId: room.roomId,
        stateVersion: Number.isFinite(Number(room.stateVersion)) ? Number(room.stateVersion) : 0,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    };
}

function rememberBufferedRoomEvent(room, record) {
    if (!room || !MatchAuthority || typeof MatchAuthority.appendBufferedSseEvent !== 'function') return;
    room.sseEventBuffer = MatchAuthority.appendBufferedSseEvent(room.sseEventBuffer, record);
}

function buildBufferedSnapshotRecord(room, meta, eventId) {
    const payloadByViewer = {
        black: buildSnapshotPayload(room, meta, 'black'),
        white: buildSnapshotPayload(room, meta, 'white')
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

function prepareSnapshotBroadcast(room, meta) {
    const eventId = nextSseEventId(room);
    const { record, payloadByViewer } = buildBufferedSnapshotRecord(room, meta, eventId);
    return {
        eventId,
        record,
        payloadByViewer,
        fallbackPayload: buildSnapshotPayload(room, meta, null)
    };
}

function broadcastPreparedSnapshot(room, preparedSnapshot) {
    if (!room || !preparedSnapshot) return;
    rememberBufferedRoomEvent(room, preparedSnapshot.record);
    if (!room.streams || room.streams.size === 0) return;
    for (const [streamId, streamInfo] of room.streams.entries()) {
        const viewerSeatKey = streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null;
        const payload = (viewerSeatKey && preparedSnapshot.payloadByViewer[viewerSeatKey])
            ? preparedSnapshot.payloadByViewer[viewerSeatKey]
            : preparedSnapshot.fallbackPayload;
        safeWriteToStream(room, streamId, 'snapshot', payload, preparedSnapshot.eventId);
    }
}

function roomHasStreams() {
    for (const room of rooms.values()) {
        if (room && room.streams && room.streams.size > 0) return true;
    }
    return false;
}

function stopHeartbeatLoopIfIdle() {
    if (roomHasStreams()) return;
    if (!heartbeatIntervalId) return;
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = 0;
}

function removeStream(room, streamId) {
    if (!room || !room.streams) return;
    room.streams.delete(streamId);
    if (!room.seats.black && !room.seats.white && room.streams.size === 0) {
        rooms.delete(room.roomId);
    }
    stopHeartbeatLoopIfIdle();
}

function safeWriteToStream(room, streamId, eventName, payload, eventId) {
    const streamInfo = room && room.streams ? room.streams.get(streamId) : null;
    if (!streamInfo || !streamInfo.res || streamInfo.res.writableEnded || streamInfo.res.destroyed) {
        removeStream(room, streamId);
        return;
    }
    try {
        writeSse(streamInfo.res, eventName, payload, eventId);
    } catch (e) {
        try { streamInfo.res.end(); } catch (endError) { /* ignore */ }
        removeStream(room, streamId);
    }
}

function ensureHeartbeatLoop() {
    if (heartbeatIntervalId) return;
    heartbeatIntervalId = setInterval(() => {
        for (const room of rooms.values()) {
            if (!room || !room.streams || room.streams.size === 0) continue;
            const serverTime = Date.now();
            const payload = buildHeartbeatPayload(room, serverTime);
            const eventId = nextSseEventId(room);
            rememberBufferedRoomEvent(room, {
                eventId,
                eventName: 'heartbeat',
                payload
            });
            for (const streamId of Array.from(room.streams.keys())) {
                safeWriteToStream(room, streamId, 'heartbeat', payload, eventId);
            }
        }
        stopHeartbeatLoopIfIdle();
    }, SSE_HEARTBEAT_INTERVAL_MS);
    if (heartbeatIntervalId && typeof heartbeatIntervalId.unref === 'function') {
        heartbeatIntervalId.unref();
    }
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
        roomBoardConfig: toPublicRoomBoardConfig(room),
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
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    };
}

function broadcastSnapshot(room, meta) {
    if (!room) return;
    broadcastPreparedSnapshot(room, prepareSnapshotBroadcast(room, meta));
}

function broadcastPresence(room, meta) {
    if (!room) return;
    const payload = buildPresencePayload(room, meta || {});
    const eventId = nextSseEventId(room);
    rememberBufferedRoomEvent(room, {
        eventId,
        eventName: 'presence',
        payload
    });
    if (!room.streams || room.streams.size === 0) return;
    for (const streamId of Array.from(room.streams.keys())) {
        safeWriteToStream(room, streamId, 'presence', payload, eventId);
    }
}

function closeSeatStreams(room, seatKey) {
    if (!room || !room.streams || !seatKey) return;
    for (const [streamId, streamInfo] of Array.from(room.streams.entries())) {
        if (!streamInfo || streamInfo.seatKey !== seatKey) continue;
        room.streams.delete(streamId);
        try { streamInfo.res.end(); } catch (e) { /* ignore */ }
    }
    stopHeartbeatLoopIfIdle();
}

function broadcastChat(room, payload) {
    if (!room) return;
    const eventId = nextSseEventId(room);
    rememberBufferedRoomEvent(room, {
        eventId,
        eventName: 'chat',
        payload
    });
    if (!room.streams || room.streams.size === 0) return;
    for (const streamId of Array.from(room.streams.keys())) {
        safeWriteToStream(room, streamId, 'chat', payload, eventId);
    }
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

function makeRoom(options) {
    const opts = (options && typeof options === 'object') ? options : {};
    let roomId = makeRoomId();
    while (rooms.has(roomId)) {
        roomId = makeRoomId();
    }

    const seed = Date.now();
    const initialSnapshotOptions = buildInitialDeckSnapshotOptions(opts);
    const snapshot = makeInitialSnapshot(seed, initialSnapshotOptions);
    const room = {
        roomId,
        seed,
        snapshot,
        stateVersion: 0,
        seats: { black: false, white: false },
        seatNames: { black: '', white: '' },
        seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
        roomDeck: null,
        roomBoardConfig: initialSnapshotOptions.boardConfig || MatchAuthority.normalizeRoomBoardConfig(null),
        networkDebugEnabled: opts.networkDebugEnabled === true,
        turnTimer: createPausedTurnTimer({ snapshot }),
        lastAcceptedOperationBySeat: { black: null, white: null },
        eventSeq: 0,
        sseEventBuffer: [],
        chatMessages: [],
        chatSeq: 0,
        streams: new Map(),
        updatedAt: Date.now()
    };
    rooms.set(roomId, room);
    return room;
}

function applyExpiredTurnTimeoutIfNeeded(room) {
    if (!room) return { applied: false };

    const nowMs = Date.now();
    refreshTurnTimer(room, { nowMs, forceRestart: false });

    const timer = (room.turnTimer && typeof room.turnTimer === 'object') ? room.turnTimer : null;
    if (!timer || timer.active !== true) return { applied: false };

    const deadline = Number(timer.turnDeadlineAt);
    if (!Number.isFinite(deadline) || deadline > nowMs) return { applied: false };

    const snapshot = room.snapshot && typeof room.snapshot === 'object' ? room.snapshot : null;
    if (!snapshot || !snapshot.gameState || !snapshot.cardState) return { applied: false };

    const timedOutSeatKey = parseSeatKeyOptional(timer.turnSeatKey) || resolveTurnSeatKey(room);
    const currentTurnSeatKey = resolveTurnSeatKey(room);
    if (timedOutSeatKey !== currentTurnSeatKey) {
        refreshTurnTimer(room, { nowMs, forceRestart: true });
        return { applied: false };
    }

    const nextSnapshot = deepClone(snapshot);
    nextSnapshot.gameState = Core.applyPass(nextSnapshot.gameState);
    MatchAuthority.stripTransientPresentationState(nextSnapshot);
    if (
        nextSnapshot.cardState
        && parseSeatKeyOptional(nextSnapshot.cardState.selectedCardOwnerKey) === timedOutSeatKey
    ) {
        nextSnapshot.cardState.selectedCardId = null;
        nextSnapshot.cardState.selectedCardOwnerKey = null;
    }
    if (nextSnapshot.cardState && nextSnapshot.cardState.pendingEffectByPlayer && typeof nextSnapshot.cardState.pendingEffectByPlayer === 'object') {
        nextSnapshot.cardState.pendingEffectByPlayer[timedOutSeatKey] = null;
    }
    const serverPlaybackAssembly = reconcileTurnStartAndCollectPlayback(room, nextSnapshot);
    reportPlaybackAssemblyDiagnostics('local-server-timeout-pass', serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, {
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
    refreshTurnTimer(room, { nowMs, forceRestart: true });
    broadcastSnapshot(room, {
        playerKey: timedOutSeatKey,
        actionType: 'timeout_pass',
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: toDebugPlaybackDiagnostics(serverPlaybackAssembly && serverPlaybackAssembly.diagnostics, toPublicNetworkDebugEnabled(room)),
        operationId: `timeout_${room.stateVersion}_${nowMs}`
    });
    return { applied: true, stateVersion: room.stateVersion };
}

async function handleCreate(req, res) {
    const body = await parseBody(req);
    const playerName = normalizeNetworkPlayerName(body.playerName);
    const networkDebugEnabled = body.networkDebugEnabled === true;
    const roomBoardConfig = MatchAuthority.normalizeRoomBoardConfig(body.roomBoardConfig);
    if (!playerName) {
        writeJson(res, 400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        return;
    }

    const deckSelection = resolveDeckSelection(body.deckCode);
    if (!deckSelection.ok) {
        writeJson(res, 400, { ok: false, reason: deckSelection.reason || 'DECK_CODE_INVALID' });
        return;
    }

    const room = makeRoom({ networkDebugEnabled, roomBoardConfig });
    room.seats.black = true;
    room.seatNames.black = playerName;
    if (deckSelection.hasCustomDeck) {
        assignRoomDeckSelection(room, 'black', deckSelection);
    }
    room.updatedAt = Date.now();
    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: false });

    const serverTime = Date.now();
    writeJson(res, 200, {
        ok: true,
        roomId: room.roomId,
        seatKey: 'black',
        playerName,
        seatToken: room.seatTokens.black,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room, 'black'),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

async function handleJoin(req, res) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
    const providedToken = String(body.seatToken || '').trim();
    const playerName = normalizeNetworkPlayerName(body.playerName);

    if (!playerName) {
        writeJson(res, 400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        return;
    }
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }

    const deckSelection = resolveDeckSelection(body.deckCode);
    if (!deckSelection.ok) {
        writeJson(res, 400, { ok: false, reason: deckSelection.reason || 'DECK_CODE_INVALID' });
        return;
    }

    const room = rooms.get(roomId);
    const seatKey = resolveSeatForJoin(room, requestedSeatKey, providedToken);
    if (!seatKey) {
        writeJson(res, 409, { ok: false, reason: 'ROOM_FULL' });
        return;
    }

    if (!room.seatTokens || !room.seatTokens[seatKey]) {
        room.seatTokens = room.seatTokens || {};
        room.seatTokens[seatKey] = makeSeatToken();
    }
    const seatToken = room.seatTokens[seatKey];
    const rejoined = providedToken && providedToken === seatToken;

    const hadTwoSeats = hasTwoActiveSeats(room);
    room.seats[seatKey] = true;
    room.seatNames[seatKey] = playerName;
    if (deckSelection.hasCustomDeck) {
        assignRoomDeckSelection(room, seatKey, deckSelection);
    }

    const hasTwoSeatsNow = hasTwoActiveSeats(room);
    let rebasedInitialSnapshot = false;
    if (!hadTwoSeats && hasTwoSeatsNow && room.stateVersion === 0) {
        const nextSnapshot = makeInitialSnapshot(room.seed, buildInitialDeckSnapshotOptions(room));
        room.stateVersion = 1;
        nextSnapshot.stateVersion = room.stateVersion;
        nextSnapshot.updatedAt = Date.now();
        room.snapshot = nextSnapshot;
        room.updatedAt = nextSnapshot.updatedAt;
        rebasedInitialSnapshot = true;
    } else {
        room.updatedAt = Date.now();
    }

    refreshTurnTimer(room, {
        nowMs: room.updatedAt,
        forceRestart: !hadTwoSeats && hasTwoSeatsNow
    });

    if (rebasedInitialSnapshot) {
        broadcastSnapshot(room, {
            playerKey: seatKey,
            actionType: 'join_room',
            playbackEvents: [],
            operationId: `join_room_${room.stateVersion}`
        });
    }

    broadcastPresence(room, {
        type: 'join',
        seatKey,
        rejoined: !!rejoined
    });

    const serverTime = Date.now();
    writeJson(res, 200, {
        ok: true,
        roomId,
        seatKey,
        playerName,
        seatToken,
        rejoined: !!rejoined,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room, seatKey),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

async function handleLeave(req, res) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const seatKey = normalizePlayerKey(body.seatKey);
    const seatToken = String(body.seatToken || '').trim();
    const room = rooms.get(roomId);

    if (!room) {
        writeJson(res, 200, { ok: true });
        return;
    }

    if (resolveAuthenticatedSeatKey(room, seatKey, seatToken) !== seatKey) {
        writeJson(res, 403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        return;
    }

    room.seats[seatKey] = false;
    room.seatNames[seatKey] = '';
    room.seatTokens = room.seatTokens || {};
    room.seatTokens[seatKey] = makeSeatToken();
    room.updatedAt = Date.now();
    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: false });
    closeSeatStreams(room, seatKey);

    broadcastPresence(room, {
        type: 'leave',
        seatKey,
        rejoined: false
    });

    if (!room.seats.black && !room.seats.white && room.streams.size === 0) {
        rooms.delete(roomId);
    }

    const serverTime = Date.now();
    writeJson(res, 200, {
        ok: true,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

async function handlePublish(req, res) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const seatKey = normalizePlayerKey(body.seatKey);
    const playerKey = normalizePlayerKey(body.playerKey || body.actor);
    const seatToken = String(body.seatToken || '').trim();
    const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
    const actionType = String(body.actionType || '').trim().toLowerCase();
    const operationId = normalizeOperationId(body.operationId);
    const isRematchResetAction = actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
    const isNetworkDebugAction = isNetworkDebugFillHandPayload(body);

    const room = rooms.get(roomId);
    if (!room) {
        writeJson(res, 404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        return;
    }

    applyExpiredTurnTimeoutIfNeeded(room);

    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    const acceptedOperationsBySeat = ensureAcceptedOperationsBySeat(room);

    if (!room.seats[seatKey]) {
        writeJson(res, 403, buildPublishPayload(room, viewerSeatKey, {
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
        return;
    }

    if (seatKey !== playerKey) {
        writeJson(res, 403, buildPublishPayload(room, viewerSeatKey, {
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
        return;
    }

    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
        writeJson(res, 403, buildPublishPayload(room, null, {
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
        return;
    }

    if (!(MatchAuthority && typeof MatchAuthority.hasRequiredOperationId === 'function'
        ? MatchAuthority.hasRequiredOperationId(operationId)
        : !!operationId)) {
        writeJson(res, 409, buildPublishPayload(room, seatKey, {
            ok: false,
            rejectedReason: 'OPERATION_ID_REQUIRED',
            publishMeta: {
                kind: 'rejected',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion,
                rejectedReason: 'OPERATION_ID_REQUIRED'
            }
        }));
        return;
    }

    const lastAcceptedOperation = MatchAuthority && typeof MatchAuthority.findAcceptedOperationBySeat === 'function'
        ? MatchAuthority.findAcceptedOperationBySeat(room, seatKey, operationId)
        : (
            operationId
            && acceptedOperationsBySeat[seatKey]
            && acceptedOperationsBySeat[seatKey].operationId === operationId
        )
            ? acceptedOperationsBySeat[seatKey]
            : null;
    if (
        operationId
        && lastAcceptedOperation
        && typeof lastAcceptedOperation === 'object'
    ) {
        const serverTime = Date.now();
        writeJson(res, 200, buildPublishPayload(room, seatKey, {
            ok: true,
            serverTime,
            idempotentReplay: true,
            publishMeta: {
                kind: 'idempotent_replay',
                operationId,
                actionType,
                receivedBaseVersion: baseVersion,
                authoritativeStateVersion: room.stateVersion,
                replayedStateVersion: lastAcceptedOperation.stateVersion
            }
        }));
        return;
    }

    if (baseVersion === null || baseVersion !== room.stateVersion) {
        const rejectedReason = MatchAuthority && typeof MatchAuthority.classifyVersionRejectionReason === 'function'
            ? MatchAuthority.classifyVersionRejectionReason(baseVersion, room.stateVersion)
            : 'VERSION_MISMATCH';
        writeJson(res, 409, buildPublishPayload(room, seatKey, {
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
        return;
    }

    const expectedPlayerKey = getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
    if (playerKey !== expectedPlayerKey) {
        const allowOutOfTurnRematch = isRematchResetAction && typeof Core.isGameOver === 'function' && Core.isGameOver(room.snapshot && room.snapshot.gameState);
        const allowOutOfTurnNetworkDebug = isNetworkDebugAction && toPublicNetworkDebugEnabled(room);
        const allowFateWillController = MatchAuthority.isFateWillControllerForCurrentTurn(room.snapshot, playerKey);
        if (!allowOutOfTurnRematch && !allowOutOfTurnNetworkDebug && !allowFateWillController) {
            writeJson(res, 409, buildPublishPayload(room, seatKey, {
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
            return;
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
        nextSnapshot = makeInitialSnapshot(rematchSeed, buildInitialDeckSnapshotOptions(room));
        room.seed = rematchSeed;
    } else if (hasCommandPayload) {
        const commandResult = applyCommandPublishToSnapshot(room, body, playerKey);
        if (!commandResult.ok) {
            writeJson(res, 409, buildPublishPayload(room, seatKey, {
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
            return;
        }
        nextSnapshot = commandResult.snapshot;
        serverPlaybackEvents = Array.isArray(commandResult.playbackEvents) ? commandResult.playbackEvents : [];
        serverEffectLogs = Array.isArray(commandResult.effectLogs) ? commandResult.effectLogs : [];
        serverPlaybackDiagnostics = commandResult.playbackDiagnostics || null;
    } else {
        writeJson(res, 409, buildPublishPayload(room, seatKey, {
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
        return;
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
        if (typeof MatchAuthority.rememberAcceptedOperationBySeat === 'function') {
            MatchAuthority.rememberAcceptedOperationBySeat(room, seatKey, acceptedEntry);
        } else {
            acceptedOperationsBySeat[seatKey] = acceptedEntry;
        }
    }

    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: !isNetworkDebugAction });

    const meta = {
        playerKey,
        actionType: body.actionType ? String(body.actionType) : null,
        playbackEvents: serverPlaybackEvents,
        effectLogs: serverEffectLogs,
        playbackDiagnostics: serverPlaybackDiagnostics,
        operationId: operationId || null
    };
    const serverTime = Date.now();
    const preparedSnapshot = prepareSnapshotBroadcast(room, meta);
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
    if (typeof MatchAuthority.stripTransientChargeDeltaState === 'function') {
        MatchAuthority.stripTransientChargeDeltaState(room.snapshot);
    }
    broadcastPreparedSnapshot(room, preparedSnapshot);
    writeJson(res, 200, responsePayload);
}

async function handleChat(req, res) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const seatKey = normalizePlayerKey(body.seatKey);
    const seatToken = String(body.seatToken || '').trim();

    const room = rooms.get(roomId);
    if (!room) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }
    if (!room.seats[seatKey]) {
        writeJson(res, 403, { ok: false, reason: 'SEAT_NOT_JOINED', seats: toPublicSeats(room) });
        return;
    }
    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
        writeJson(res, 403, { ok: false, reason: 'SEAT_TOKEN_MISMATCH', seats: toPublicSeats(room) });
        return;
    }
    if (!room.seats.black || !room.seats.white) {
        writeJson(res, 409, { ok: false, reason: 'CHAT_DISABLED', seats: toPublicSeats(room) });
        return;
    }

    const parsedText = parseChatMessageText(body.message);
    if (!parsedText.ok) {
        writeJson(res, 400, { ok: false, reason: parsedText.reason, seats: toPublicSeats(room), maxLength: CHAT_MAX_LENGTH });
        return;
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

    const payload = {
        ok: true,
        roomId: room.roomId,
        type: 'message',
        message,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room)
    };

    broadcastChat(room, payload);

    writeJson(res, 200, {
        ok: true,
        roomId: room.roomId,
        message,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        serverTime: Date.now()
    });
}

function handleState(req, res, urlObj) {
    const roomId = String((urlObj.searchParams.get('roomId') || '')).trim().toUpperCase();
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }
    const room = rooms.get(roomId);
    applyExpiredTurnTimeoutIfNeeded(room);

    const seatKey = parseSeatKeyOptional(urlObj.searchParams.get('seatKey') || '');
    const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!viewerSeatKey) {
        writeJson(res, 403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        return;
    }

    const serverTime = Date.now();
    writeJson(res, 200, {
        ok: true,
        roomId,
        stateVersion: room.stateVersion,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        roomBoardConfig: toPublicRoomBoardConfig(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        snapshot: toPublicSnapshot(room, viewerSeatKey),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
}

function handleStream(req, res, urlObj) {
    const roomId = String((urlObj.searchParams.get('roomId') || '')).trim().toUpperCase();
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }

    const room = rooms.get(roomId);
    applyExpiredTurnTimeoutIfNeeded(room);

    const seatKey = parseSeatKeyOptional(urlObj.searchParams.get('seatKey') || '');
    const seatToken = String(urlObj.searchParams.get('seatToken') || '').trim();
    const resumeEventId = String(urlObj.searchParams.get('lastEventId') || '').trim();
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!viewerSeatKey) {
        writeJson(res, 403, { ok: false, reason: classifySeatTokenRejectionReason(seatToken) });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    const streamId = `sse_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    room.streams.set(streamId, { res, seatKey: viewerSeatKey });
    ensureHeartbeatLoop();

    const lastEventId = String((req && req.headers && req.headers['last-event-id']) || resumeEventId).trim();
    const replayEvents = MatchAuthority && typeof MatchAuthority.getBufferedSseReplayEvents === 'function'
        ? MatchAuthority.getBufferedSseReplayEvents(room.sseEventBuffer, lastEventId, viewerSeatKey)
        : null;

    if (Array.isArray(replayEvents)) {
        if (replayEvents.length > 0) {
            for (const event of replayEvents) {
                writeSse(res, event.eventName, event.payload, event.eventId);
            }
        } else {
            writeSse(res, 'heartbeat', buildHeartbeatPayload(room, Date.now()), null);
        }

        req.on('close', () => {
            removeStream(room, streamId);
        });
        return;
    }

    writeSse(res, 'snapshot', buildSnapshotPayload(room, {
        playbackEvents: [],
        operationId: null,
        playerKey: null,
        actionType: null
    }, viewerSeatKey), nextSseEventId(room));

    writeSse(res, 'chat', {
        ok: true,
        roomId,
        type: 'history',
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        networkDebugEnabled: toPublicNetworkDebugEnabled(room),
        messages: toPublicChatMessages(room)
    }, nextSseEventId(room));

    req.on('close', () => {
        removeStream(room, streamId);
    });
}

function createLocalMatchServer() {
    return http.createServer(async (req, res) => {
        try {
            const urlObj = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
            const pathname = urlObj.pathname;

            if (req.method === 'OPTIONS') {
                res.writeHead(204, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type'
                });
                res.end();
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/create') {
                await handleCreate(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/join') {
                await handleJoin(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/leave') {
                await handleLeave(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/publish') {
                await handlePublish(req, res);
                return;
            }

            if (req.method === 'POST' && pathname === '/api/match/chat') {
                await handleChat(req, res);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/state') {
                handleState(req, res, urlObj);
                return;
            }

            if (req.method === 'GET' && pathname === '/api/match/stream') {
                handleStream(req, res, urlObj);
                return;
            }

            writeJson(res, 404, { ok: false, reason: 'NOT_FOUND' });
        } catch (error) {
            const message = error && error.message ? error.message : String(error);
            writeJson(res, 500, { ok: false, reason: 'SERVER_ERROR', message });
        }
    });
}

function resetRoomsForTests() {
    rooms.clear();
    stopHeartbeatLoopIfIdle();
}

function patchRoomSnapshotForTests(roomId, patchFn) {
    const room = rooms.get(String(roomId || '').toUpperCase());
    if (!room) return false;
    patchFn(room);
    return true;
}

module.exports = {
    createLocalMatchServer,
    resetRoomsForTests,
    patchRoomSnapshotForTests
};

if (require.main === module) {
    const server = createLocalMatchServer();
    server.listen(PORT, HOST, () => {
        console.log(`LOCAL_MATCH_SERVER:${HOST}:${PORT}`);
    });
}
