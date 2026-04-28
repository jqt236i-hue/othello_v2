"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const local_match_server_js_1 = require("../scripts/local-match-server.js");
function requestJson(port, method, path, payload) {
    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path,
            method,
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let raw = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { raw += chunk; });
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode || 0,
                        data: raw ? JSON.parse(raw) : {}
                    });
                }
                catch (error) {
                    reject(error);
                }
            });
        });
        req.on('error', reject);
        if (payload !== undefined) {
            req.write(JSON.stringify(payload));
        }
        req.end();
    });
}
async function listen(server) {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            server.removeListener('error', reject);
            resolve();
        });
    });
    return server.address().port;
}
async function closeServer(server) {
    await new Promise((resolve) => server.close(() => resolve()));
}
function openStream(port, roomId, seatKey, seatToken, options) {
    return new Promise((resolve, reject) => {
        const opts = (options && typeof options === 'object') ? options : {};
        const hasWrapperOptions = Object.prototype.hasOwnProperty.call(opts, 'headers')
            || Object.prototype.hasOwnProperty.call(opts, 'lastEventId');
        const headers = hasWrapperOptions ? (opts.headers || {}) : opts;
        const lastEventId = hasWrapperOptions ? String(opts.lastEventId || '').trim() : '';
        const resumeQuery = lastEventId ? `&lastEventId=${encodeURIComponent(lastEventId)}` : '';
        const req = http.request({
            hostname: '127.0.0.1',
            port,
            path: `/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=${encodeURIComponent(seatKey)}&seatToken=${encodeURIComponent(seatToken)}${resumeQuery}`,
            method: 'GET',
            headers: headers || {}
        }, (res) => {
            let firstChunk = '';
            const onData = (chunk) => {
                firstChunk += String(chunk || '');
                if (!firstChunk.includes('\n\n'))
                    return;
                res.off('data', onData);
                resolve({ req, res, firstChunk });
            };
            res.setEncoding('utf8');
            res.on('data', onData);
            res.on('error', reject);
        });
        req.on('error', reject);
        req.end();
    });
}
describe('local match server leave contract', () => {
    afterEach(() => {
        (0, local_match_server_js_1.resetRoomsForTests)();
    });
    test('leave rotates seat token, rejects old token, and closes leaving stream', async () => {
        const server = (0, local_match_server_js_1.createLocalMatchServer)();
        let stream = null;
        const port = await listen(server);
        try {
            const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
            expect(created.status).toBe(200);
            const roomId = created.data.roomId;
            const oldSeatToken = created.data.seatToken;
            const joinedWhite = await requestJson(port, 'POST', '/api/match/join', {
                roomId,
                seatKey: 'white',
                playerName: 'しろ'
            });
            expect(joinedWhite.status).toBe(200);
            stream = await openStream(port, roomId, 'black', oldSeatToken);
            expect(stream.firstChunk).toContain('event: snapshot');
            const left = await requestJson(port, 'POST', '/api/match/leave', {
                roomId,
                seatKey: 'black',
                seatToken: oldSeatToken
            });
            expect(left.status).toBe(200);
            const staleState = await requestJson(port, 'GET', `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(oldSeatToken)}`);
            expect(staleState.status).toBe(403);
            expect(staleState.data.reason).toBe('SEAT_TOKEN_MISMATCH');
            const rejoined = await requestJson(port, 'POST', '/api/match/join', {
                roomId,
                seatKey: 'black',
                playerName: 'くろ2'
            });
            expect(rejoined.status).toBe(200);
            expect(rejoined.data.seatToken).not.toBe(oldSeatToken);
        }
        finally {
            try {
                if (stream && stream.req)
                    stream.req.destroy();
            }
            catch (e) { }
            await closeServer(server);
        }
    });
    test('leave rejects missing and stale seat token without clearing the seat', async () => {
        const server = (0, local_match_server_js_1.createLocalMatchServer)();
        const port = await listen(server);
        try {
            const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
            expect(created.status).toBe(200);
            const roomId = created.data.roomId;
            const oldSeatToken = created.data.seatToken;
            const missingLeave = await requestJson(port, 'POST', '/api/match/leave', {
                roomId,
                seatKey: 'black',
                seatToken: ''
            });
            expect(missingLeave.status).toBe(403);
            expect(missingLeave.data.reason).toBe('SEAT_TOKEN_REQUIRED');
            const staleLeave = await requestJson(port, 'POST', '/api/match/leave', {
                roomId,
                seatKey: 'black',
                seatToken: 'stale-token'
            });
            expect(staleLeave.status).toBe(403);
            expect(staleLeave.data.reason).toBe('SEAT_TOKEN_MISMATCH');
            let roomState = null;
            const captured = (0, local_match_server_js_1.patchRoomSnapshotForTests)(roomId, (room) => {
                roomState = {
                    blackStillJoined: !!(room && room.seats && room.seats.black),
                    blackSeatToken: room && room.seatTokens ? room.seatTokens.black : null
                };
            });
            expect(captured).toBe(true);
            const state = await requestJson(port, 'GET', `/api/match/state?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent(oldSeatToken)}`);
            expect(state.status).toBe(200);
            expect(state.data.ok).toBe(true);
            expect(roomState).toEqual({
                blackStillJoined: true,
                blackSeatToken: oldSeatToken
            });
        }
        finally {
            await closeServer(server);
        }
    });
    test('stream rejects missing and stale seat token', async () => {
        const server = (0, local_match_server_js_1.createLocalMatchServer)();
        const port = await listen(server);
        try {
            const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
            expect(created.status).toBe(200);
            const roomId = created.data.roomId;
            const missingToken = await requestJson(port, 'GET', `/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=`);
            expect(missingToken.status).toBe(403);
            expect(missingToken.data.reason).toBe('SEAT_TOKEN_REQUIRED');
            const staleToken = await requestJson(port, 'GET', `/api/match/stream?roomId=${encodeURIComponent(roomId)}&seatKey=black&seatToken=${encodeURIComponent('stale-token')}`);
            expect(staleToken.status).toBe(403);
            expect(staleToken.data.reason).toBe('SEAT_TOKEN_MISMATCH');
        }
        finally {
            await closeServer(server);
        }
    });
    test('stream replays buffered snapshot from Last-Event-ID for the authenticated seat', async () => {
        const server = (0, local_match_server_js_1.createLocalMatchServer)();
        let stream = null;
        const port = await listen(server);
        try {
            const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
            expect(created.status).toBe(200);
            const roomId = created.data.roomId;
            const seatToken = created.data.seatToken;
            const joinedWhite = await requestJson(port, 'POST', '/api/match/join', {
                roomId,
                seatKey: 'white',
                playerName: 'しろ'
            });
            expect(joinedWhite.status).toBe(200);
            const patched = (0, local_match_server_js_1.patchRoomSnapshotForTests)(roomId, (room) => {
                room.sseEventBuffer = [
                    {
                        id: `${roomId}_1_1`,
                        event: 'heartbeat',
                        payload: { ok: true, roomId, stateVersion: 1 }
                    },
                    {
                        id: `${roomId}_2_2`,
                        event: 'snapshot',
                        payloadByViewer: {
                            black: {
                                ok: true,
                                roomId,
                                stateVersion: 2,
                                playbackEvents: [{ type: 'observer_bubble', phase: 2, targets: [{ player: 'black', text: 'resume' }] }],
                                effectLogs: ['白がカードを使用: 交換'],
                                snapshot: {
                                    stateVersion: 2,
                                    _meta: {
                                        authority: 'server',
                                        version: 2,
                                        projectedForSeat: 'black',
                                        turnStartReconciled: true
                                    },
                                    gameState: {
                                        board: Array.from({ length: 8 }, () => Array(8).fill(0)),
                                        currentPlayer: -1,
                                        turnNumber: 2,
                                        consecutivePasses: 0
                                    },
                                    cardState: {
                                        hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] },
                                        charge: { black: 0, white: 0 },
                                        pendingEffectByPlayer: { black: null, white: null },
                                        hasUsedCardThisTurnByPlayer: { black: false, white: false },
                                        lastUsedCardByPlayer: { black: null, white: null },
                                        markers: [],
                                        discard: [],
                                        turnIndex: 2
                                    }
                                }
                            },
                            white: {
                                ok: true,
                                roomId,
                                stateVersion: 2,
                                playbackEvents: [],
                                effectLogs: ['白がカードを使用: 交換'],
                                snapshot: {
                                    stateVersion: 2,
                                    _meta: {
                                        authority: 'server',
                                        version: 2,
                                        projectedForSeat: 'white',
                                        turnStartReconciled: true
                                    },
                                    gameState: {
                                        board: Array.from({ length: 8 }, () => Array(8).fill(0)),
                                        currentPlayer: -1,
                                        turnNumber: 2,
                                        consecutivePasses: 0
                                    },
                                    cardState: {
                                        hands: { black: ['__hidden_hand__:black:0'], white: ['w1'] },
                                        charge: { black: 0, white: 0 },
                                        pendingEffectByPlayer: { black: null, white: null },
                                        hasUsedCardThisTurnByPlayer: { black: false, white: false },
                                        lastUsedCardByPlayer: { black: null, white: null },
                                        markers: [],
                                        discard: [],
                                        turnIndex: 2
                                    }
                                }
                            }
                        }
                    }
                ];
            });
            expect(patched).toBe(true);
            stream = await openStream(port, roomId, 'black', seatToken, { 'Last-Event-ID': `${roomId}_1_1` });
            expect(stream.firstChunk).toContain('event: snapshot');
            expect(stream.firstChunk).toContain(`id: ${roomId}_2_2`);
            expect(stream.firstChunk).toContain('"observer_bubble"');
            expect(stream.firstChunk).toContain('"__hidden_hand__:white:0"');
            expect(stream.firstChunk).not.toContain('"type":"history"');
        }
        finally {
            try {
                if (stream && stream.req)
                    stream.req.destroy();
            }
            catch (e) { }
            await closeServer(server);
        }
    });
    test('stream replays buffered snapshot from lastEventId query for the authenticated seat', async () => {
        const server = (0, local_match_server_js_1.createLocalMatchServer)();
        let stream = null;
        const port = await listen(server);
        try {
            const created = await requestJson(port, 'POST', '/api/match/create', { playerName: 'くろ' });
            expect(created.status).toBe(200);
            const roomId = created.data.roomId;
            const seatToken = created.data.seatToken;
            const joinedWhite = await requestJson(port, 'POST', '/api/match/join', {
                roomId,
                seatKey: 'white',
                playerName: 'しろ'
            });
            expect(joinedWhite.status).toBe(200);
            const patched = (0, local_match_server_js_1.patchRoomSnapshotForTests)(roomId, (room) => {
                room.sseEventBuffer = [
                    {
                        id: `${roomId}_1_1`,
                        event: 'heartbeat',
                        payload: { ok: true, roomId, stateVersion: 1 }
                    },
                    {
                        id: `${roomId}_2_2`,
                        event: 'snapshot',
                        payloadByViewer: {
                            black: {
                                ok: true,
                                roomId,
                                stateVersion: 2,
                                playbackEvents: [{ type: 'observer_bubble', phase: 2, targets: [{ player: 'black', text: 'resume' }] }],
                                effectLogs: ['白がカードを使用: 交換'],
                                snapshot: {
                                    stateVersion: 2,
                                    _meta: {
                                        authority: 'server',
                                        version: 2,
                                        projectedForSeat: 'black',
                                        turnStartReconciled: true
                                    },
                                    gameState: {
                                        board: Array.from({ length: 8 }, () => Array(8).fill(0)),
                                        currentPlayer: -1,
                                        turnNumber: 2,
                                        consecutivePasses: 0
                                    },
                                    cardState: {
                                        hands: { black: ['b1'], white: ['__hidden_hand__:white:0'] },
                                        charge: { black: 0, white: 0 },
                                        pendingEffectByPlayer: { black: null, white: null },
                                        hasUsedCardThisTurnByPlayer: { black: false, white: false },
                                        lastUsedCardByPlayer: { black: null, white: null },
                                        markers: [],
                                        discard: [],
                                        turnIndex: 2
                                    }
                                }
                            },
                            white: {
                                ok: true,
                                roomId,
                                stateVersion: 2,
                                playbackEvents: [],
                                effectLogs: ['白がカードを使用: 交換'],
                                snapshot: {
                                    stateVersion: 2,
                                    _meta: {
                                        authority: 'server',
                                        version: 2,
                                        projectedForSeat: 'white',
                                        turnStartReconciled: true
                                    },
                                    gameState: {
                                        board: Array.from({ length: 8 }, () => Array(8).fill(0)),
                                        currentPlayer: -1,
                                        turnNumber: 2,
                                        consecutivePasses: 0
                                    },
                                    cardState: {
                                        hands: { black: ['__hidden_hand__:black:0'], white: ['w1'] },
                                        charge: { black: 0, white: 0 },
                                        pendingEffectByPlayer: { black: null, white: null },
                                        hasUsedCardThisTurnByPlayer: { black: false, white: false },
                                        lastUsedCardByPlayer: { black: null, white: null },
                                        markers: [],
                                        discard: [],
                                        turnIndex: 2
                                    }
                                }
                            }
                        }
                    }
                ];
            });
            expect(patched).toBe(true);
            stream = await openStream(port, roomId, 'black', seatToken, { lastEventId: `${roomId}_1_1` });
            expect(stream.firstChunk).toContain('event: snapshot');
            expect(stream.firstChunk).toContain(`id: ${roomId}_2_2`);
            expect(stream.firstChunk).toContain('"observer_bubble"');
            expect(stream.firstChunk).toContain('"__hidden_hand__:white:0"');
            expect(stream.firstChunk).not.toContain('"type":"history"');
        }
        finally {
            try {
                if (stream && stream.req)
                    stream.req.destroy();
            }
            catch (e) { }
            await closeServer(server);
        }
    });
});
//# sourceMappingURL=local-match-server.leave-contract.test.js.map