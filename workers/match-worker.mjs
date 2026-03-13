import deepClone from '../utils/deepClone.js';

const ROOM_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_ID_LENGTH = 3;
const SEAT_TOKEN_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const SEAT_TOKEN_LENGTH = 24;
const ROOM_STORAGE_KEY = 'match_room_state_v1';
const PLAYER_KEYS = Object.freeze(['black', 'white']);
const HIDDEN_HAND_TOKEN_RE = /^__hidden_hand__:(black|white):(\d+)$/;
const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;
const NETWORK_PLAYER_NAME_MAX = 7;
const LEADERBOARD_STORAGE_KEY = 'global_score_leaderboard_v3';
const LEADERBOARD_STORAGE_VERSION = 3;
const LEADERBOARD_ROOM_ID = '__leaderboard__';
const LEADERBOARD_PLAYER_NAME_MAX = NETWORK_PLAYER_NAME_MAX;
const LEADERBOARD_DEFAULT_LIMIT = 10;
const LEADERBOARD_MAX_LIMIT = 30;
const LEADERBOARD_MAX_STORED_PLAYERS = 200;
const LEADERBOARD_PLAYER_ID_RE = /^[A-Za-z0-9_-]{8,80}$/;
const NETWORK_TURN_LIMIT_SECONDS = 120;
const NETWORK_TURN_LIMIT_MS = NETWORK_TURN_LIMIT_SECONDS * 1000;
const SSE_HEARTBEAT_INTERVAL_MS = 20000;
const SSE_WRITE_TIMEOUT_MS = 2500;
const OPERATION_ID_MAX_LENGTH = 128;

let coreLogicModulePromise = null;

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
    const parsed = parseSeatKeyOptional(value);
    return parsed || 'black';
}

function parseSeatKeyOptional(value) {
    if (value === 1 || value === '1') return 'black';
    if (value === -1 || value === '-1') return 'white';

    const normalized = (value === null || typeof value === 'undefined')
        ? ''
        : String(value).trim().toLowerCase();

    if (normalized === 'black' || normalized === '1' || normalized === '+1') return 'black';
    if (normalized === 'white' || normalized === '-1') return 'white';
    return null;
}

function getCurrentPlayerKey(gameState) {
    if (!gameState) return 'black';
    return normalizePlayerKey(gameState.currentPlayer);
}

function getOpponentKey(playerKey) {
    return normalizePlayerKey(playerKey) === 'white' ? 'black' : 'white';
}

function makeHiddenHandToken(ownerKey, handIndex) {
    const normalizedOwner = normalizePlayerKey(ownerKey);
    const idx = Number.isFinite(Number(handIndex)) ? Math.max(0, Math.trunc(Number(handIndex))) : 0;
    return `__hidden_hand__:${normalizedOwner}:${idx}`;
}

function parseHiddenHandToken(value) {
    const match = String(value || '').match(HIDDEN_HAND_TOKEN_RE);
    if (!match) return null;
    const ownerKey = normalizePlayerKey(match[1]);
    const handIndex = Number(match[2]);
    if (!Number.isInteger(handIndex) || handIndex < 0) return null;
    return { ownerKey, handIndex };
}

function resolveCardIdFromHiddenToken(value, previousHands) {
    const parsed = parseHiddenHandToken(value);
    if (!parsed) return null;
    const ownerHand = (previousHands && Array.isArray(previousHands[parsed.ownerKey]))
        ? previousHands[parsed.ownerKey]
        : null;
    if (!ownerHand) return null;
    if (parsed.handIndex < 0 || parsed.handIndex >= ownerHand.length) return null;
    return ownerHand[parsed.handIndex];
}

function resolveAuthenticatedSeatKey(room, seatKeyValue, seatTokenValue) {
    if (!room || !room.seatTokens) return null;
    const seatToken = String(seatTokenValue || '').trim();
    if (!seatToken) return null;

    const requestedSeat = parseSeatKeyOptional(seatKeyValue);
    if (requestedSeat) {
        return room.seatTokens[requestedSeat] === seatToken ? requestedSeat : null;
    }
    if (room.seatTokens.black === seatToken) return 'black';
    if (room.seatTokens.white === seatToken) return 'white';
    return null;
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

function normalizeNetworkPlayerName(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return Array.from(normalized).slice(0, NETWORK_PLAYER_NAME_MAX).join('');
}

function normalizeOperationId(value) {
    const normalized = String(value || '').trim();
    if (!normalized) return '';
    return Array.from(normalized).slice(0, OPERATION_ID_MAX_LENGTH).join('');
}

function ensureAcceptedOperationsBySeat(room) {
    const source = (room && room.lastAcceptedOperationBySeat && typeof room.lastAcceptedOperationBySeat === 'object')
        ? room.lastAcceptedOperationBySeat
        : {};

    const normalized = {
        black: (source.black && typeof source.black === 'object') ? source.black : null,
        white: (source.white && typeof source.white === 'object') ? source.white : null
    };

    if (room && typeof room === 'object') {
        room.lastAcceptedOperationBySeat = normalized;
    }

    return normalized;
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

async function makeInitialSnapshot(seed) {
    const [{ default: Core }, { default: CardLogic }, { default: TurnPipelinePhases }, { default: SeededPRNG }] = await Promise.all([
        import('../game/logic/core.js'),
        import('../game/logic/cards.js'),
        import('../game/turn/turn_pipeline_phases.js'),
        import('../game/schema/prng.js')
    ]);
    const gameState = Core.createGameState();
    const prng = SeededPRNG.createPRNG(seed);
    const cardState = CardLogic.createCardState(prng);

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

function rehydrateSnapshotForPublish(previousSnapshot, incomingSnapshot) {
    const nextSnapshot = deepClone(incomingSnapshot || {});
    if (!nextSnapshot.cardState || typeof nextSnapshot.cardState !== 'object') {
        nextSnapshot.cardState = {};
    }
    const nextCardState = nextSnapshot.cardState;
    const previousCardState = (previousSnapshot && previousSnapshot.cardState && typeof previousSnapshot.cardState === 'object')
        ? previousSnapshot.cardState
        : {};
    const previousHands = (previousCardState.hands && typeof previousCardState.hands === 'object')
        ? previousCardState.hands
        : {};

    if (!nextCardState.hands || typeof nextCardState.hands !== 'object') {
        nextCardState.hands = {};
    }

    for (const ownerKey of PLAYER_KEYS) {
        const incomingHand = Array.isArray(nextCardState.hands[ownerKey]) ? nextCardState.hands[ownerKey] : [];
        nextCardState.hands[ownerKey] = incomingHand.map((cardId) => {
            const resolved = resolveCardIdFromHiddenToken(cardId, previousHands);
            return resolved || cardId;
        });
    }

    if (Array.isArray(nextCardState.discard)) {
        nextCardState.discard = nextCardState.discard.map((cardId) => {
            const resolved = resolveCardIdFromHiddenToken(cardId, previousHands);
            return resolved || cardId;
        });
    }

    return nextSnapshot;
}

function toPublicSnapshot(room, viewerSeatKey) {
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

async function handleCreate(env, options) {
    const opts = (options && typeof options === 'object') ? options : {};
    for (let attempt = 0; attempt < 12; attempt += 1) {
        const roomId = makeRoomId();
        const seed = Date.now();
        const snapshot = await makeInitialSnapshot(seed);
        const stub = getRoomStub(env, roomId);
        const req = new Request('https://room/internal/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId, seed, snapshot, playerName: opts.playerName })
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

        const payload = {
            ok: true,
            roomId: this.room.roomId,
            stateVersion: Number.isFinite(Number(this.room.stateVersion)) ? Number(this.room.stateVersion) : 0,
            seats: toPublicSeats(this.room),
            seatNames: toPublicSeatNames(this.room),
            turnTimer: toPublicTurnTimer(this.room, serverTime),
            serverTime
        };
        const eventId = this.nextSseEventId();

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
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;

        const eventId = this.nextSseEventId();
        await Promise.all(streamEntries.map(([streamId, streamInfo]) => {
            const payload = buildSnapshotPayload(this.room, meta, streamInfo && streamInfo.seatKey ? streamInfo.seatKey : null);
            return this.sendSse(streamId, 'snapshot', payload, { eventId });
        }));
    }

    async broadcastPresence(meta) {
        if (!this.room) return;
        const payload = buildPresencePayload(this.room, meta || {});
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;

        const eventId = this.nextSseEventId();
        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'presence', payload, { eventId })
        )));
    }

    async broadcastChat(payload) {
        if (!this.room) return;
        const streamEntries = Array.from(this.streams.entries());
        if (streamEntries.length === 0) return;

        const eventId = this.nextSseEventId();
        await Promise.all(streamEntries.map(([streamId]) => (
            this.sendSse(streamId, 'chat', payload, { eventId })
        )));
    }

    createRoomState(roomId, initOptions) {
        const opts = initOptions || {};
        const seed = Number.isFinite(Number(opts.seed)) ? Number(opts.seed) : Date.now();
        const snapshot = (opts.snapshot && typeof opts.snapshot === 'object') ? deepClone(opts.snapshot) : null;
        const nowMs = Date.now();
        return {
            roomId,
            seed,
            snapshot,
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
        if (nextSnapshot.cardState && nextSnapshot.cardState.pendingEffectByPlayer && typeof nextSnapshot.cardState.pendingEffectByPlayer === 'object') {
            nextSnapshot.cardState.pendingEffectByPlayer[timedOutSeatKey] = null;
        }

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
            playbackEvents: [],
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
            snapshot
        });
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
        room.updatedAt = Date.now();
        await this.refreshTurnTimer({
            nowMs: room.updatedAt,
            forceRestart: !hadTwoSeats && hasTwoActiveSeats(room)
        });
        await this.saveRoom();

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
        const snapshot = body.snapshot;
        const actionType = String(body.actionType || '').trim().toLowerCase();
        const operationId = normalizeOperationId(body.operationId);
        const isRematchResetAction = actionType === 'reset_game' || actionType === 'rematch' || actionType === 'restart';
        const viewerSeatKey = resolveAuthenticatedSeatKey(room, seatKey, seatToken);
        const acceptedOperationsBySeat = ensureAcceptedOperationsBySeat(room);

        if (!room.seats[seatKey]) {
            return jsonResponse(403, {
                ok: false,
                rejectedReason: 'SEAT_NOT_JOINED',
                snapshot: toPublicSnapshot(room, viewerSeatKey),
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                stateVersion: room.stateVersion,
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }

        if (seatKey !== playerKey) {
            return jsonResponse(403, {
                ok: false,
                rejectedReason: 'SEAT_MISMATCH',
                snapshot: toPublicSnapshot(room, viewerSeatKey),
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                stateVersion: room.stateVersion,
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }

        if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
            return jsonResponse(403, {
                ok: false,
                rejectedReason: 'SEAT_TOKEN_MISMATCH',
                snapshot: toPublicSnapshot(room, null),
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                stateVersion: room.stateVersion,
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }

        const lastAcceptedOperation = acceptedOperationsBySeat[seatKey];
        if (
            operationId &&
            lastAcceptedOperation &&
            typeof lastAcceptedOperation === 'object' &&
            String(lastAcceptedOperation.operationId || '') === operationId
        ) {
            const serverTime = Date.now();
            return jsonResponse(200, {
                ok: true,
                roomId: room.roomId,
                stateVersion: room.stateVersion,
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                snapshot: toPublicSnapshot(room, seatKey),
                turnTimer: toPublicTurnTimer(room, serverTime),
                serverTime,
                idempotentReplay: true
            });
        }

        if (baseVersion === null || baseVersion !== room.stateVersion) {
            return jsonResponse(409, {
                ok: false,
                rejectedReason: 'VERSION_MISMATCH',
                snapshot: toPublicSnapshot(room, seatKey),
                seats: toPublicSeats(room),
                seatNames: toPublicSeatNames(room),
                stateVersion: room.stateVersion,
                turnTimer: toPublicTurnTimer(room),
                serverTime: Date.now()
            });
        }

        const expectedPlayerKey = getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
        if (playerKey !== expectedPlayerKey) {
            const allowOutOfTurnRematch = isRematchResetAction && await this.isSnapshotGameOver(room.snapshot);
            if (!allowOutOfTurnRematch) {
                return jsonResponse(409, {
                    ok: false,
                    rejectedReason: 'OUT_OF_TURN',
                    snapshot: toPublicSnapshot(room, seatKey),
                    seats: toPublicSeats(room),
                    seatNames: toPublicSeatNames(room),
                    stateVersion: room.stateVersion,
                    turnTimer: toPublicTurnTimer(room),
                    serverTime: Date.now()
                });
            }
        }

        let nextSnapshot;
        if (isRematchResetAction) {
            const rematchSeed = Date.now();
            try {
                nextSnapshot = await makeInitialSnapshot(rematchSeed);
                room.seed = rematchSeed;
            } catch (e) {
                return jsonResponse(500, {
                    ok: false,
                    rejectedReason: 'REMATCH_RESET_FAILED',
                    snapshot: toPublicSnapshot(room, seatKey),
                    seats: toPublicSeats(room),
                    seatNames: toPublicSeatNames(room),
                    stateVersion: room.stateVersion,
                    turnTimer: toPublicTurnTimer(room),
                    serverTime: Date.now()
                });
            }
        } else {
            if (!snapshot || typeof snapshot !== 'object' || !snapshot.gameState || !snapshot.cardState) {
                return jsonResponse(400, {
                    ok: false,
                    rejectedReason: 'INVALID_SNAPSHOT',
                    snapshot: toPublicSnapshot(room, seatKey),
                    seats: toPublicSeats(room),
                    seatNames: toPublicSeatNames(room),
                    stateVersion: room.stateVersion,
                    turnTimer: toPublicTurnTimer(room),
                    serverTime: Date.now()
                });
            }
            nextSnapshot = rehydrateSnapshotForPublish(room.snapshot, snapshot);
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
        await this.refreshTurnTimer({ nowMs: room.updatedAt, forceRestart: true });

        await this.saveRoom();

        const meta = {
            playerKey,
            actionType: body.actionType ? String(body.actionType) : null,
            playbackEvents: Array.isArray(body.playbackEvents) ? body.playbackEvents : [],
            operationId: operationId || null
        };

        await this.broadcastSnapshot(meta);

        const serverTime = Date.now();
        return jsonResponse(200, {
            ok: true,
            roomId: room.roomId,
            stateVersion: room.stateVersion,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
            snapshot: toPublicSnapshot(room, seatKey),
            turnTimer: toPublicTurnTimer(room, serverTime),
            serverTime
        });
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
                    await this.sendSse(streamId, 'snapshot', initialPayload);
                    await this.sendSse(streamId, 'chat', {
                        ok: true,
                        roomId: room.roomId,
                        type: 'history',
                        seats: toPublicSeats(room),
                        seatNames: toPublicSeatNames(room),
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
            seatNames: toPublicSeatNames(room)
        };

        await this.broadcastChat(payload);

        return jsonResponse(200, {
            ok: true,
            roomId: room.roomId,
            message,
            seats: toPublicSeats(room),
            seatNames: toPublicSeatNames(room),
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
