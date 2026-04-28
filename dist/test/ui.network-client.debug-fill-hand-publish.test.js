"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsdom_1 = require("jsdom");
function jsonResponse(status, data) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data
    };
}
function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}
function createSnapshot(stateVersion) {
    return {
        stateVersion,
        gameState: {
            currentPlayer: 1,
            turnNumber: 1,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        },
        cardState: {
            selectedCardId: null,
            selectedCardOwnerKey: null,
            hands: { black: [], white: [] },
            charge: { black: 10, white: 10 },
            pendingEffectByPlayer: { black: null, white: null },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            lastUsedCardByPlayer: { black: null, white: null },
            markers: [],
            discard: [],
            turnIndex: 1
        }
    };
}
describe('NetworkMatchClient debug fill hand publish tracking', () => {
    let dom;
    let publishBodies;
    let releasePublishResponse;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.localStorage = dom.window.localStorage;
        global.BLACK = 1;
        global.WHITE = -1;
        const initial = createSnapshot(10);
        global.gameState = cloneJson(initial.gameState);
        global.cardState = cloneJson(initial.cardState);
        global.addLog = jest.fn();
        global.emitCardStateChange = jest.fn();
        global.emitGameStateChange = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.renderCardUI = jest.fn();
        global.EventSource = class MockEventSource {
            addEventListener() { }
            close() { }
        };
        publishBodies = [];
        let resolvePublish;
        const publishResponseGate = new Promise((resolve) => {
            resolvePublish = resolve;
        });
        releasePublishResponse = () => resolvePublish();
        global.fetch = jest.fn(async (url, init = {}) => {
            const parsedUrl = new URL(String(url));
            const path = parsedUrl.pathname;
            if (path === '/api/match/create') {
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'DBG',
                    seatKey: 'black',
                    seatToken: 'seat-token',
                    stateVersion: 10,
                    networkDebugEnabled: true,
                    snapshot: createSnapshot(10)
                });
            }
            if (path === '/api/match/publish') {
                const body = JSON.parse(init.body || '{}');
                publishBodies.push(body);
                await publishResponseGate;
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'DBG',
                    stateVersion: 11,
                    snapshot: createSnapshot(11),
                    playbackEvents: []
                });
            }
            return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
        });
    });
    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function') {
                dom.window.close();
            }
        }
        catch (e) {
            // ignore
        }
        delete global.window;
        delete global.document;
        delete global.location;
        delete global.localStorage;
        delete global.BLACK;
        delete global.WHITE;
        delete global.gameState;
        delete global.cardState;
        delete global.addLog;
        delete global.emitCardStateChange;
        delete global.emitGameStateChange;
        delete global.emitBoardUpdate;
        delete global.renderCardUI;
        delete global.EventSource;
        delete global.fetch;
    });
    test('getState exposes debug_fill_hand publishTracker settlement for automation waits', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({
            serverUrl: 'http://localhost:8787',
            playerName: 'くろ',
            networkDebugEnabled: true
        });
        expect(created.ok).toBe(true);
        expect(typeof client.getState).toBe('function');
        const publishPromise = client.publishSnapshot({
            playerKey: 'black',
            actionType: 'debug_fill_hand',
            playbackEvents: [],
            action: { type: 'debug_fill_hand' }
        });
        await Promise.resolve();
        await Promise.resolve();
        const pendingState = client.getState();
        expect(pendingState.stateVersion).toBe(10);
        expect(pendingState.networkDebugEnabled).toBe(true);
        expect(pendingState.publishTracker.operations).toHaveLength(1);
        expect(pendingState.publishTracker.operations[0]).toEqual(expect.objectContaining({
            phase: expect.stringMatching(/queued|inflight/),
            responseSettled: false,
            selfSnapshotReceived: false,
            requestMeta: expect.objectContaining({
                actionType: 'debug_fill_hand',
                actor: 'black',
                params: {},
                playbackEvents: [],
                usedSnapshotFallback: false
            })
        }));
        releasePublishResponse();
        const result = await publishPromise;
        expect(result.ok).toBe(true);
        expect(publishBodies).toHaveLength(1);
        expect(publishBodies[0]).toEqual(expect.objectContaining({
            actionType: 'debug_fill_hand',
            actor: 'black',
            params: {},
            action: expect.objectContaining({ type: 'debug_fill_hand' })
        }));
        const settledState = client.getState();
        expect(settledState.stateVersion).toBe(11);
        expect(settledState.publishTracker.operations).toEqual(expect.arrayContaining([
            expect.objectContaining({
                phase: 'acknowledged',
                responseSettled: true,
                responseVersion: 11,
                selfSnapshotReceived: false,
                requestMeta: expect.objectContaining({
                    actionType: 'debug_fill_hand'
                })
            })
        ]));
        settledState.publishTracker.operations[0].responseSettled = false;
        expect(client.getState().publishTracker.operations[0].responseSettled).toBe(true);
    });
});
//# sourceMappingURL=ui.network-client.debug-fill-hand-publish.test.js.map