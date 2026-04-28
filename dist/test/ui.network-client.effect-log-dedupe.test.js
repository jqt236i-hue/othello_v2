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
function createSnapshot(stateVersion, board) {
    return {
        stateVersion,
        _meta: {
            authority: 'server',
            version: stateVersion,
            projectedForSeat: null,
            turnStartReconciled: true
        },
        gameState: {
            currentPlayer: 1,
            turnNumber: 1,
            board: board || Array.from({ length: 8 }, () => Array(8).fill(0))
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
describe('NetworkMatchClient effect log dedupe', () => {
    let dom;
    let eventSourceInstance;
    let requestCommentaryMock;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.localStorage = dom.window.localStorage;
        global.BLACK = 1;
        global.WHITE = -1;
        const initial = createSnapshot(3);
        global.gameState = initial.gameState;
        global.cardState = initial.cardState;
        global.addLog = jest.fn();
        global.emitCardStateChange = jest.fn();
        global.emitGameStateChange = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.renderCardUI = jest.fn();
        global.EventSource = class MockEventSource {
            constructor() {
                eventSourceInstance = this;
            }
            addEventListener() { }
            close() { }
        };
        global.EventSource.OPEN = 1;
        window.EventSource = global.EventSource;
        requestCommentaryMock = jest.fn(async () => '重複しない');
        window.CpuCommentaryRuntime = {
            requestCommentary: requestCommentaryMock
        };
        global.fetch = jest.fn(async (url) => {
            const parsedUrl = new URL(String(url));
            const path = parsedUrl.pathname;
            if (path === '/api/match/join') {
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'ABC',
                    seatKey: 'black',
                    seatToken: 'token_black',
                    seats: { black: true, white: true },
                    stateVersion: 3,
                    snapshot: initial
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
    test('同版 remote snapshot が重複到着しても commentary はログに出ない', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        const joined = await client.joinRoom('ABC', { serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(joined.ok).toBe(true);
        expect(eventSourceInstance).toBeTruthy();
        const board = Array.from({ length: 8 }, () => Array(8).fill(0));
        board[3][3] = 1;
        board[3][4] = -1;
        const snapshot = createSnapshot(4, board);
        snapshot.gameState.turnNumber = 2;
        const payload = {
            ok: true,
            roomId: 'ABC',
            operationId: 'remote-card-use-1',
            playerKey: 'white',
            actionType: 'use_card',
            playbackEvents: [{
                    type: 'card_use_animation',
                    targets: [{ owner: 'white', cardId: 'swap_01' }]
                }],
            snapshot
        };
        eventSourceInstance.onmessage({ data: JSON.stringify(payload) });
        await Promise.resolve();
        await Promise.resolve();
        eventSourceInstance.onmessage({ data: JSON.stringify(payload) });
        await Promise.resolve();
        await Promise.resolve();
        expect(requestCommentaryMock).toHaveBeenCalledTimes(1);
        const commentaryLines = global.addLog.mock.calls
            .map((args) => args && args[0])
            .filter((line) => line === '白CPU: 重複しない');
        expect(commentaryLines).toEqual([]);
    });
});
//# sourceMappingURL=ui.network-client.effect-log-dedupe.test.js.map