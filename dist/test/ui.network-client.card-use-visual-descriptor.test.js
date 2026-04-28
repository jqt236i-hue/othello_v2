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
function createSnapshot(stateVersion) {
    return {
        stateVersion,
        gameState: {
            currentPlayer: 1,
            turnNumber: 4,
            board: Array.from({ length: 8 }, () => Array(8).fill(0))
        },
        cardState: {
            turnIndex: 2,
            hands: { black: ['card_1'], white: [] },
            charge: { black: 10, white: 10 },
            pendingEffectByPlayer: { black: null, white: null },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            lastUsedCardByPlayer: { black: null, white: null },
            markers: [],
            discard: []
        }
    };
}
describe('NetworkMatchClient card use visual descriptor transport', () => {
    let dom;
    let resolvePublish;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.localStorage = dom.window.localStorage;
        global.BLACK = 1;
        global.WHITE = -1;
        global.gameState = createSnapshot(10).gameState;
        global.cardState = createSnapshot(10).cardState;
        global.isGameOver = jest.fn(() => false);
        global.EventSource = class MockEventSource {
            addEventListener() { }
            close() { }
        };
        global.fetch = jest.fn(async (url, init = {}) => {
            const parsedUrl = new URL(String(url));
            const pathName = parsedUrl.pathname;
            if (pathName === '/api/match/create') {
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'VDT',
                    seatKey: 'black',
                    seatToken: 'seat-token',
                    stateVersion: 10,
                    snapshot: createSnapshot(10)
                });
            }
            if (pathName === '/api/match/publish') {
                return new Promise((resolve) => {
                    resolvePublish = () => resolve(jsonResponse(200, {
                        ok: true,
                        roomId: 'VDT',
                        stateVersion: 11,
                        snapshot: createSnapshot(11)
                    }));
                });
            }
            return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
        });
    });
    afterEach(() => {
        try {
            if (dom && dom.window && typeof dom.window.close === 'function')
                dom.window.close();
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
        delete global.isGameOver;
        delete global.EventSource;
        delete global.fetch;
    });
    test('tracked publish keeps visualDescriptor while stripping DOM-only fields', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const sourceCardEl = document.createElement('div');
        sourceCardEl.className = 'card-item visible';
        const publishPromise = client.publishSnapshot({
            playerKey: 'black',
            actionType: 'place',
            action: {
                type: 'place',
                player: 'black',
                row: 2,
                col: 3
            },
            playbackEvents: [{
                    type: 'card_use_animation',
                    phase: 1,
                    targets: [{
                            player: 'black',
                            owner: 'black',
                            cardId: 'card_1',
                            visualDescriptor: {
                                cardId: 'card_1',
                                name: 'Descriptor Card',
                                cost: 11,
                                costTier: 'blue'
                            },
                            sourceCardEl,
                            sourceCardRect: {
                                left: 200,
                                top: 480,
                                width: 90,
                                height: 120,
                                right: 290,
                                bottom: 600
                            }
                        }]
                }]
        });
        await Promise.resolve();
        await Promise.resolve();
        const state = client.getState();
        expect(state.publishTracker.operations).toHaveLength(1);
        const trackedTarget = state.publishTracker.operations[0].requestMeta.playbackEvents[0].targets[0];
        expect(trackedTarget.visualDescriptor).toEqual({
            cardId: 'card_1',
            name: 'Descriptor Card',
            cost: 11,
            costTier: 'blue'
        });
        expect(trackedTarget.sourceCardEl).toBeUndefined();
        expect(trackedTarget.sourceCardRect).toBeUndefined();
        expect(typeof resolvePublish).toBe('function');
        resolvePublish();
        await expect(publishPromise).resolves.toEqual(expect.objectContaining({ ok: true }));
    });
});
//# sourceMappingURL=ui.network-client.card-use-visual-descriptor.test.js.map