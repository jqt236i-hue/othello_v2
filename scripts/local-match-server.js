const http = require('http');
const { URL } = require('url');

const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const TurnPipelinePhases = require('../game/turn/turn_pipeline_phases');
const SeededPRNG = require('../game/schema/prng');
const deepClone = require('../utils/deepClone');

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
const CHAT_MAX_LENGTH = 20;
const CHAT_HISTORY_LIMIT = 40;

const rooms = new Map();

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

function makeRoomId() {
    let id = '';
    for (let i = 0; i < ROOM_ID_LENGTH; i += 1) {
        id += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
    }
    return id;
}

function makeSeatToken() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 24; i += 1) {
        token += chars[Math.floor(Math.random() * chars.length)];
    }
    return token;
}

function makeInitialSnapshot(seed) {
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

function makeRoom() {
    let roomId = makeRoomId();
    while (rooms.has(roomId)) {
        roomId = makeRoomId();
    }

    const seed = Date.now();
    const room = {
        roomId,
        seed,
        snapshot: makeInitialSnapshot(seed),
        stateVersion: 0,
        seats: { black: false, white: false },
        seatTokens: { black: makeSeatToken(), white: makeSeatToken() },
        chatMessages: [],
        chatSeq: 0,
        streams: new Set(),
        updatedAt: Date.now()
    };
    rooms.set(roomId, room);
    return room;
}

function toPublicSeats(room) {
    return {
        black: !!(room && room.seats && room.seats.black),
        white: !!(room && room.seats && room.seats.white)
    };
}

function toPublicSnapshot(room) {
    const shot = deepClone(room.snapshot || {});
    shot.stateVersion = room.stateVersion;
    shot.updatedAt = room.updatedAt;
    return shot;
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

function writeSse(res, eventName, payload) {
    const data = JSON.stringify(payload || {});
    if (eventName) res.write(`event: ${eventName}\n`);
    res.write(`data: ${data}\n\n`);
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

function broadcastSnapshot(room, meta) {
    const payload = {
        ok: true,
        roomId: room.roomId,
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room),
        seats: toPublicSeats(room),
        playbackEvents: Array.isArray(meta && meta.playbackEvents) ? meta.playbackEvents : [],
        playerKey: meta && meta.playerKey ? normalizePlayerKey(meta.playerKey) : null,
        actionType: meta && meta.actionType ? String(meta.actionType) : null
    };

    for (const stream of Array.from(room.streams)) {
        try {
            writeSse(stream, 'snapshot', payload);
        } catch (e) {
            try { stream.end(); } catch (endError) { /* ignore */ }
            room.streams.delete(stream);
        }
    }
}

function buildPresencePayload(room, meta) {
    return {
        ok: true,
        roomId: room.roomId,
        type: meta && meta.type ? String(meta.type) : 'join',
        seatKey: meta && meta.seatKey ? normalizePlayerKey(meta.seatKey) : 'black',
        rejoined: !!(meta && meta.rejoined),
        seats: toPublicSeats(room),
        serverTime: Date.now()
    };
}

function broadcastPresence(room, meta) {
    const payload = buildPresencePayload(room, meta);
    for (const stream of Array.from(room.streams)) {
        try {
            writeSse(stream, 'presence', payload);
        } catch (e) {
            try { stream.end(); } catch (endError) { /* ignore */ }
            room.streams.delete(stream);
        }
    }
}

function broadcastChat(room, payload) {
    for (const stream of Array.from(room.streams)) {
        try {
            writeSse(stream, 'chat', payload);
        } catch (e) {
            try { stream.end(); } catch (endError) { /* ignore */ }
            room.streams.delete(stream);
        }
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

async function handleCreate(req, res) {
    const room = makeRoom();
    room.seats.black = true;

    writeJson(res, 200, {
        ok: true,
        roomId: room.roomId,
        seatKey: 'black',
        seatToken: room.seatTokens.black,
        seats: toPublicSeats(room),
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room),
        serverTime: Date.now()
    });
}

async function handleJoin(req, res) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const requestedSeatKey = parseSeatKeyOptional(body.seatKey);
    const providedToken = String(body.seatToken || '').trim();
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
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

    room.seats[seatKey] = true;
    room.updatedAt = Date.now();

    writeJson(res, 200, {
        ok: true,
        roomId,
        seatKey,
        seatToken,
        rejoined: !!rejoined,
        seats: toPublicSeats(room),
        stateVersion: room.stateVersion,
        snapshot: toPublicSnapshot(room),
        serverTime: Date.now()
    });

    broadcastPresence(room, {
        type: 'join',
        seatKey,
        rejoined: !!rejoined
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
    room.updatedAt = Date.now();

    broadcastPresence(room, {
        type: 'leave',
        seatKey,
        rejoined: false
    });

    if (!room.seats.black && !room.seats.white && room.streams.size === 0) {
        rooms.delete(roomId);
    }

    writeJson(res, 200, { ok: true });
}

async function handlePublish(req, res) {
    const body = await parseBody(req);
    const roomId = String(body.roomId || '').trim().toUpperCase();
    const seatKey = normalizePlayerKey(body.seatKey);
    const playerKey = normalizePlayerKey(body.playerKey);
    const seatToken = String(body.seatToken || '').trim();
    const baseVersion = Number.isFinite(Number(body.baseVersion)) ? Number(body.baseVersion) : null;
    const snapshot = body.snapshot;

    const room = rooms.get(roomId);
    if (!room) {
        writeJson(res, 404, { ok: false, rejectedReason: 'ROOM_NOT_FOUND' });
        return;
    }
    if (!room.seats[seatKey]) {
        writeJson(res, 403, { ok: false, rejectedReason: 'SEAT_NOT_JOINED', snapshot: toPublicSnapshot(room), seats: toPublicSeats(room), stateVersion: room.stateVersion });
        return;
    }
    if (seatKey !== playerKey) {
        writeJson(res, 403, { ok: false, rejectedReason: 'SEAT_MISMATCH', snapshot: toPublicSnapshot(room), seats: toPublicSeats(room), stateVersion: room.stateVersion });
        return;
    }
    if (!seatToken || !room.seatTokens || room.seatTokens[seatKey] !== seatToken) {
        writeJson(res, 403, { ok: false, rejectedReason: 'SEAT_TOKEN_MISMATCH', snapshot: toPublicSnapshot(room), seats: toPublicSeats(room), stateVersion: room.stateVersion });
        return;
    }
    if (baseVersion === null || baseVersion !== room.stateVersion) {
        writeJson(res, 409, { ok: false, rejectedReason: 'VERSION_MISMATCH', snapshot: toPublicSnapshot(room), seats: toPublicSeats(room), stateVersion: room.stateVersion });
        return;
    }

    const expectedPlayerKey = getCurrentPlayerKey(room.snapshot && room.snapshot.gameState);
    if (playerKey !== expectedPlayerKey) {
        writeJson(res, 409, { ok: false, rejectedReason: 'OUT_OF_TURN', snapshot: toPublicSnapshot(room), seats: toPublicSeats(room), stateVersion: room.stateVersion });
        return;
    }

    if (!snapshot || typeof snapshot !== 'object' || !snapshot.gameState || !snapshot.cardState) {
        writeJson(res, 400, { ok: false, rejectedReason: 'INVALID_SNAPSHOT', snapshot: toPublicSnapshot(room), seats: toPublicSeats(room), stateVersion: room.stateVersion });
        return;
    }

    room.stateVersion += 1;
    const nextSnapshot = deepClone(snapshot);
    nextSnapshot.stateVersion = room.stateVersion;
    nextSnapshot.updatedAt = Date.now();
    room.snapshot = nextSnapshot;
    room.updatedAt = nextSnapshot.updatedAt;

    const meta = {
        playerKey,
        actionType: body.actionType ? String(body.actionType) : null,
        playbackEvents: Array.isArray(body.playbackEvents) ? body.playbackEvents : []
    };

    broadcastSnapshot(room, meta);

    writeJson(res, 200, {
        ok: true,
        roomId,
        stateVersion: room.stateVersion,
        seats: toPublicSeats(room),
        snapshot: toPublicSnapshot(room)
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
        seats: toPublicSeats(room)
    };

    broadcastChat(room, payload);

    writeJson(res, 200, {
        ok: true,
        roomId: room.roomId,
        message,
        seats: toPublicSeats(room),
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
    writeJson(res, 200, {
        ok: true,
        roomId,
        stateVersion: room.stateVersion,
        seats: toPublicSeats(room),
        snapshot: toPublicSnapshot(room)
    });
}

function handleStream(req, res, urlObj) {
    const roomId = String((urlObj.searchParams.get('roomId') || '')).trim().toUpperCase();
    if (!roomId || !rooms.has(roomId)) {
        writeJson(res, 404, { ok: false, reason: 'ROOM_NOT_FOUND' });
        return;
    }

    const room = rooms.get(roomId);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    room.streams.add(res);

    writeSse(res, 'snapshot', {
        ok: true,
        roomId,
        stateVersion: room.stateVersion,
        seats: toPublicSeats(room),
        snapshot: toPublicSnapshot(room),
        playbackEvents: []
    });

    writeSse(res, 'chat', {
        ok: true,
        roomId,
        type: 'history',
        seats: toPublicSeats(room),
        messages: toPublicChatMessages(room)
    });

    req.on('close', () => {
        room.streams.delete(res);
    });
}

const server = http.createServer(async (req, res) => {
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

server.listen(PORT, HOST, () => {
    console.log(`LOCAL_MATCH_SERVER:${HOST}:${PORT}`);
});
