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
const SSE_HEARTBEAT_INTERVAL_MS = 20000;

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
    return MatchAuthority.resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue);
}

function validatePublishedHands(snapshot, publishingSeatKey) {
    return MatchAuthority.validatePublishedHands(snapshot, publishingSeatKey);
}

function rehydrateSnapshotForPublish(previousSnapshot, incomingSnapshot) {
    return MatchAuthority.rehydrateSnapshotForPublish(previousSnapshot, incomingSnapshot);
}

function toPublicSnapshot(room, viewerSeatKey) {
    return MatchAuthority.buildPublicSnapshot(room, viewerSeatKey || null);
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

function makeInitialSnapshot(seed, options) {
    const gameState = Core.createGameState();
    const prng = SeededPRNG.createPRNG(seed);
    const opts = (options && typeof options === 'object') ? options : {};
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

function buildInitialDeckOptions(room) {
    const byPlayer = room && room.initialDeckSpecByPlayer;
    if (byPlayer && (byPlayer.black || byPlayer.white)) {
        return { initialDeckSpecByPlayer: deepClone(byPlayer) };
    }
    return {};
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
    const baselineCardState = CardLogic.createCardState(baselinePrng);
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
    if (events.length === 0) return [];

    if (!TurnPipelineUIAdapter || typeof TurnPipelineUIAdapter.mapToPlaybackEvents !== 'function') {
        return deepClone(events);
    }

    let playbackEvents = [];
    try {
        playbackEvents = TurnPipelineUIAdapter.mapToPlaybackEvents(
            events,
            snapshot && snapshot.cardState,
            snapshot && snapshot.gameState
        ) || [];
    } catch (e) {
        playbackEvents = [];
    }

    if (typeof TurnPipelineUIAdapter.appendSoundEffectPlaybackEvents === 'function') {
        try {
            playbackEvents = TurnPipelineUIAdapter.appendSoundEffectPlaybackEvents(
                playbackEvents,
                Array.isArray(rawEvents) ? rawEvents : [],
                events
            ) || playbackEvents;
        } catch (e) { /* ignore */ }
    }

    return Array.isArray(playbackEvents) ? deepClone(playbackEvents) : [];
}

function collectServerPlaybackEvents(snapshot, rawEvents) {
    const cardState = (snapshot && snapshot.cardState && typeof snapshot.cardState === 'object')
        ? snapshot.cardState
        : null;
    if (!cardState) return [];

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
    return mapServerPresentationToPlaybackEvents(presentationEvents, rawEvents, snapshot);
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

function appendTurnStartDrawPlaybackEvents(playbackEvents, snapshot, handState) {
    const baseEvents = Array.isArray(playbackEvents) ? playbackEvents.slice() : [];
    const playerKey = normalizePlayerKey(handState && handState.playerKey);
    if (!playerKey) return baseEvents;

    const hands = (snapshot && snapshot.cardState && snapshot.cardState.hands && typeof snapshot.cardState.hands === 'object')
        ? snapshot.cardState.hands
        : {};
    const beforeHand = Array.isArray(handState && handState.hand) ? handState.hand : [];
    const afterHand = Array.isArray(hands[playerKey]) ? hands[playerKey] : [];
    if (afterHand.length <= beforeHand.length) return baseEvents;

    const drawPresentationEvents = afterHand
        .slice(beforeHand.length)
        .filter((cardId) => cardId !== null && typeof cardId !== 'undefined')
        .map((cardId) => ({
            type: 'DRAW_CARD',
            player: playerKey,
            cardId,
            count: 1
        }));
    if (drawPresentationEvents.length === 0) return baseEvents;

    let drawPlaybackEvents = [];
    try {
        drawPlaybackEvents = TurnPipelineUIAdapter.mapToPlaybackEvents(
            drawPresentationEvents,
            snapshot && snapshot.cardState,
            snapshot && snapshot.gameState
        ) || [];
    } catch (e) {
        drawPlaybackEvents = [];
    }
    if (!Array.isArray(drawPlaybackEvents) || drawPlaybackEvents.length === 0) return baseEvents;

    const basePhase = baseEvents.reduce((maxPhase, event) => {
        const phase = Number(event && event.phase);
        return Number.isFinite(phase) && phase > maxPhase ? phase : maxPhase;
    }, 0);

    const normalizedDrawEvents = drawPlaybackEvents.map((event) => {
        const cloned = deepClone(event);
        const srcPhase = Number(cloned && cloned.phase);
        cloned.phase = basePhase + (Number.isFinite(srcPhase) ? srcPhase : 1);
        return cloned;
    });

    return baseEvents.concat(normalizedDrawEvents);
}

function reconcileTurnStartAndCollectPlayback(room, snapshot) {
    const handState = captureTurnStartHandState(snapshot);
    const rawEvents = reconcileTurnStartIfNeeded(room, snapshot, { includeRawEvents: true });
    const playbackEvents = collectServerPlaybackEvents(snapshot, rawEvents);
    return appendTurnStartDrawPlaybackEvents(playbackEvents, snapshot, handState);
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

    const currentTurnIndex = Number.isFinite(Number(currentSnapshot.cardState && currentSnapshot.cardState.turnIndex))
        ? Number(currentSnapshot.cardState.turnIndex)
        : 0;
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
    const playbackEvents = mapServerPresentationToPlaybackEvents(
        result.presentationEvents,
        result.events,
        nextSnapshot
    );

    playbackEvents.push(...reconcileTurnStartAndCollectPlayback(room, nextSnapshot));
    MatchAuthority.stripTransientPresentationState(nextSnapshot);

    return {
        ok: true,
        snapshot: nextSnapshot,
        playbackEvents
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
            const payload = {
                ok: true,
                roomId: room.roomId,
                stateVersion: Number.isFinite(Number(room.stateVersion)) ? Number(room.stateVersion) : 0,
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                roomDeck: toPublicRoomDeck(room),
                turnTimer: toPublicTurnTimer(room, serverTime),
                serverTime
            };
            const eventId = nextSseEventId(room);
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
        turnTimer: toPublicTurnTimer(room, serverTime),
        playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : [],
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
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    };
}

function broadcastSnapshot(room, meta) {
    if (!room || !room.streams || room.streams.size === 0) return;
    const eventId = nextSseEventId(room);
    for (const [streamId, streamInfo] of room.streams.entries()) {
        const payload = buildSnapshotPayload(room, meta, streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null);
        safeWriteToStream(room, streamId, 'snapshot', payload, eventId);
    }
}

function broadcastPresence(room, meta) {
    if (!room || !room.streams || room.streams.size === 0) return;
    const payload = buildPresencePayload(room, meta || {});
    const eventId = nextSseEventId(room);
    for (const streamId of Array.from(room.streams.keys())) {
        safeWriteToStream(room, streamId, 'presence', payload, eventId);
    }
}

function broadcastChat(room, payload) {
    if (!room || !room.streams || room.streams.size === 0) return;
    const eventId = nextSseEventId(room);
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

function makeRoom() {
    let roomId = makeRoomId();
    while (rooms.has(roomId)) {
        roomId = makeRoomId();
    }

    const seed = Date.now();
    const snapshot = makeInitialSnapshot(seed);
    const room = {
        roomId,
        seed,
        snapshot,
        stateVersion: 0,
        seats: { black: false, white: false },
        seatNames: { black: '', white: '' },
        seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
        roomDeck: null,
        turnTimer: createPausedTurnTimer({ snapshot }),
        lastAcceptedOperationBySeat: { black: null, white: null },
        eventSeq: 0,
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
    const serverPlaybackEvents = reconcileTurnStartAndCollectPlayback(room, nextSnapshot);

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
        operationId: `timeout_${room.stateVersion}_${nowMs}`
    });
    return { applied: true, stateVersion: room.stateVersion };
}

async function handleCreate(req, res) {
    const body = await parseBody(req);
    const playerName = normalizeNetworkPlayerName(body.playerName);
    if (!playerName) {
        writeJson(res, 400, { ok: false, reason: 'PLAYER_NAME_REQUIRED' });
        return;
    }

    const deckSelection = resolveDeckSelection(body.deckCode);
    if (!deckSelection.ok) {
        writeJson(res, 400, { ok: false, reason: deckSelection.reason || 'DECK_CODE_INVALID' });
        return;
    }

    const room = makeRoom();
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
        const nextSnapshot = makeInitialSnapshot(room.seed, buildInitialDeckOptions(room));
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

    if (seatToken && room.seatTokens && room.seatTokens[seatKey] !== seatToken) {
        writeJson(res, 403, { ok: false, reason: 'SEAT_TOKEN_MISMATCH' });
        return;
    }

    room.seats[seatKey] = false;
    room.seatNames[seatKey] = '';
    room.updatedAt = Date.now();
    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: false });

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

    const room = rooms.get(roomId);
    if (!room) {
        writeJson(res, 404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        return;
    }

    applyExpiredTurnTimeoutIfNeeded(room);

    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    const acceptedOperationsBySeat = ensureAcceptedOperationsBySeat(room);

    if (!room.seats[seatKey]) {
        writeJson(res, 403, {
            ok: false,
            rejectedReason: 'SEAT_NOT_JOINED',
            snapshot: toPublicSnapshot(room, viewerSeatKey),
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            stateVersion: room.stateVersion,
            turnTimer: toPublicTurnTimer(room),
            serverTime: Date.now()
        });
        return;
    }

    if (seatKey !== playerKey) {
        writeJson(res, 403, {
            ok: false,
            rejectedReason: 'SEAT_MISMATCH',
            snapshot: toPublicSnapshot(room, viewerSeatKey),
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            stateVersion: room.stateVersion,
            turnTimer: toPublicTurnTimer(room),
            serverTime: Date.now()
        });
        return;
    }

    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
        writeJson(res, 403, {
            ok: false,
            rejectedReason: 'SEAT_TOKEN_MISMATCH',
            snapshot: toPublicSnapshot(room, null),
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            stateVersion: room.stateVersion,
            turnTimer: toPublicTurnTimer(room),
            serverTime: Date.now()
        });
        return;
    }

    const lastAcceptedOperation = acceptedOperationsBySeat[seatKey];
    if (
        operationId
        && lastAcceptedOperation
        && typeof lastAcceptedOperation === 'object'
        && String(lastAcceptedOperation.operationId || '') === operationId
    ) {
        const serverTime = Date.now();
        writeJson(res, 200, {
            ok: true,
            roomId: room.roomId,
            stateVersion: room.stateVersion,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            snapshot: toPublicSnapshot(room, seatKey),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime,
            idempotentReplay: true
        });
        return;
    }

    if (baseVersion === null || baseVersion !== room.stateVersion) {
        writeJson(res, 409, {
            ok: false,
            rejectedReason: 'VERSION_MISMATCH',
            snapshot: toPublicSnapshot(room, seatKey),
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            stateVersion: room.stateVersion,
            turnTimer: toPublicTurnTimer(room),
            serverTime: Date.now()
        });
        return;
    }

    const expectedPlayerKey = getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
    if (playerKey !== expectedPlayerKey) {
        const allowOutOfTurnRematch = isRematchResetAction && typeof Core.isGameOver === 'function' && Core.isGameOver(room.snapshot && room.snapshot.gameState);
        if (!allowOutOfTurnRematch) {
            writeJson(res, 409, {
                ok: false,
                rejectedReason: 'OUT_OF_TURN',
                snapshot: toPublicSnapshot(room, seatKey),
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                roomDeck: toPublicRoomDeck(room),
                stateVersion: room.stateVersion,
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
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
    if (isRematchResetAction) {
        const rematchSeed = Date.now();
        nextSnapshot = makeInitialSnapshot(rematchSeed, buildInitialDeckOptions(room));
        room.seed = rematchSeed;
    } else if (hasCommandPayload) {
        const commandResult = applyCommandPublishToSnapshot(room, body, playerKey);
        if (!commandResult.ok) {
            writeJson(res, 409, {
                ok: false,
                rejectedReason: commandResult.rejectedReason || 'COMMAND_REJECTED',
                snapshot: toPublicSnapshot(room, seatKey),
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                roomDeck: toPublicRoomDeck(room),
                stateVersion: room.stateVersion,
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now(),
                errorMessage: commandResult.errorMessage || null
            });
            return;
        }
        nextSnapshot = commandResult.snapshot;
        serverPlaybackEvents = Array.isArray(commandResult.playbackEvents) ? commandResult.playbackEvents : [];
    } else {
        writeJson(res, 409, {
            ok: false,
            rejectedReason: 'COMMAND_REQUIRED',
            snapshot: toPublicSnapshot(room, seatKey),
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            roomDeck: toPublicRoomDeck(room),
            stateVersion: room.stateVersion,
            turnTimer: toPublicTurnTimer(room),
            serverTime: Date.now()
        });
        return;
    }

    room.stateVersion += 1;
    nextSnapshot.stateVersion = room.stateVersion;
    nextSnapshot.updatedAt = Date.now();
    room.snapshot = nextSnapshot;
    room.updatedAt = nextSnapshot.updatedAt;

    if (operationId) {
        acceptedOperationsBySeat[seatKey] = {
            operationId,
            stateVersion: room.stateVersion,
            updatedAt: room.updatedAt
        };
    }

    refreshTurnTimer(room, { nowMs: room.updatedAt, forceRestart: true });

    const meta = {
        playerKey,
        actionType: body.actionType ? String(body.actionType) : null,
        playbackEvents: serverPlaybackEvents,
        operationId: operationId || null
    };

    broadcastSnapshot(room, meta);

    const serverTime = Date.now();
    writeJson(res, 200, {
        ok: true,
        roomId,
        stateVersion: room.stateVersion,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
        snapshot: toPublicSnapshot(room, seatKey),
        turnTimer: toPublicTurnTimer(room, serverTime),
        serverTime
    });
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
        roomDeck: toPublicRoomDeck(room)
    };

    broadcastChat(room, payload);

    writeJson(res, 200, {
        ok: true,
        roomId: room.roomId,
        message,
        seats: toPublicSeats(room),
        seatNames: toPublicSeatNames(room),
        roomDeck: toPublicRoomDeck(room),
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
        writeJson(res, 403, { ok: false, reason: seatToken ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED' });
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
    const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
    if (!viewerSeatKey) {
        writeJson(res, 403, { ok: false, reason: seatToken ? 'SEAT_TOKEN_MISMATCH' : 'SEAT_TOKEN_REQUIRED' });
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

module.exports = {
    createLocalMatchServer,
    resetRoomsForTests
};

if (require.main === module) {
    const server = createLocalMatchServer();
    server.listen(PORT, HOST, () => {
        console.log(`LOCAL_MATCH_SERVER:${HOST}:${PORT}`);
    });
}
