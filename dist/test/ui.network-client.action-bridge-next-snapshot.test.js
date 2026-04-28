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
        _meta: {
            authority: 'server',
            version: stateVersion,
            projectedForSeat: null,
            turnStartReconciled: true
        },
        gameState: {
            currentPlayer: 1,
            turnNumber: 1
        },
        cardState: {
            selectedCardId: null,
            selectedCardOwnerKey: null,
            hands: { black: ['sample_card'], white: [] },
            charge: { black: 10, white: 10 },
            boardBonusByCell: { '2,3': 5 },
            boardBonusConsumedByCell: {},
            pendingEffectByPlayer: { black: null, white: null },
            hasUsedCardThisTurnByPlayer: { black: false, white: false },
            hasDestroyedCardThisTurnByPlayer: { black: false, white: false },
            lastUsedCardByPlayer: { black: null, white: null },
            markers: [],
            discard: [],
            turnIndex: 1
        }
    };
}
function createUseCardAction(playerKey = 'black', useCardId = 'sample_card', turnIndex = 1) {
    return {
        type: 'use_card',
        playerKey,
        useCardId,
        turnIndex
    };
}
describe('NetworkMatchClient action bridge snapshot', () => {
    let dom;
    let publishPayloads;
    beforeEach(() => {
        jest.resetModules();
        dom = new jsdom_1.JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
        global.window = dom.window;
        global.document = dom.window.document;
        global.location = dom.window.location;
        global.localStorage = dom.window.localStorage;
        global.BLACK = 1;
        global.WHITE = -1;
        const initial = createSnapshot(20);
        global.gameState = initial.gameState;
        global.cardState = initial.cardState;
        global.addLog = jest.fn();
        global.emitCardStateChange = jest.fn();
        global.emitGameStateChange = jest.fn();
        global.emitBoardUpdate = jest.fn();
        global.renderCardUI = jest.fn();
        global.EventSource = class MockEventSource {
            addEventListener() { }
            close() { }
        };
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn((_cs, _gs, _player, action) => {
                if (action && action.type === 'destroy_hand_card') {
                    return {
                        ok: true,
                        nextGameState: {
                            currentPlayer: 1,
                            turnNumber: 2
                        },
                        nextCardState: {
                            ...createSnapshot(20).cardState,
                            hands: { black: [], white: [] },
                            hasDestroyedCardThisTurnByPlayer: { black: true, white: false },
                            discard: ['sample_card']
                        },
                        playbackEvents: []
                    };
                }
                return {
                    ok: true,
                    nextGameState: {
                        currentPlayer: 1,
                        turnNumber: 2
                    },
                    nextCardState: {
                        ...createSnapshot(20).cardState,
                        charge: { black: 7, white: 10 },
                        hasUsedCardThisTurnByPlayer: { black: true, white: false },
                        discard: ['sample_card']
                    },
                    playbackEvents: []
                };
            })
        };
        window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;
        publishPayloads = [];
        global.fetch = jest.fn(async (url, init = {}) => {
            const parsedUrl = new URL(String(url));
            const path = parsedUrl.pathname;
            if (path === '/api/match/create') {
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'ROOM1234',
                    seatKey: 'black',
                    seatToken: 'seat-token',
                    stateVersion: 20,
                    snapshot: createSnapshot(20)
                });
            }
            if (path === '/api/match/publish') {
                const body = JSON.parse(init.body || '{}');
                publishPayloads.push(body);
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'ROOM1234',
                    stateVersion: 21,
                    snapshot: body.snapshot
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
        delete global.TurnPipelineUIAdapter;
        delete global.fetch;
    });
    test('use_card送信でcommand payloadを使いclient snapshotを送らない', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const action = { type: 'use_card', useCardId: 'hard_01' };
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', action, {});
        expect(result.ok).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(publishPayloads).toHaveLength(1);
        const payload = publishPayloads[0];
        expect(payload.actionType).toBe('use_card');
        expect(payload.actor).toBe('black');
        expect(payload.params).toEqual({ useCardId: 'hard_01' });
        expect(payload.snapshot).toBeUndefined();
        expect(payload.playbackEvents).toBeUndefined();
    });
    test('destroy_hand_card送信でcommand payloadを使いclient snapshotを送らない', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const action = { type: 'destroy_hand_card', destroyCardId: 'sample_card' };
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', action, {});
        expect(result.ok).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(publishPayloads).toHaveLength(1);
        const payload = publishPayloads[0];
        expect(payload.actionType).toBe('destroy_hand_card');
        expect(payload.actor).toBe('black');
        expect(payload.params).toEqual({ destroyCardId: 'sample_card' });
        expect(payload.snapshot).toBeUndefined();
        expect(payload.playbackEvents).toBeUndefined();
    });
    test('nextCardState で deferred pending が生まれる use_card でも初回 command は即 publish する', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        global.TurnPipelineUIAdapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                nextGameState: {
                    currentPlayer: 1,
                    turnNumber: 2
                },
                nextCardState: {
                    ...createSnapshot(20).cardState,
                    charge: { black: 7, white: 10 },
                    hasUsedCardThisTurnByPlayer: { black: true, white: false },
                    pendingEffectByPlayer: {
                        black: { type: 'TRAP_WILL', stage: 'selectTarget' },
                        white: null
                    },
                    discard: ['sample_card']
                },
                playbackEvents: []
            }))
        };
        window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const action = { type: 'use_card', useCardId: 'trap_01' };
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', action, {});
        expect(result.ok).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0]).toEqual(expect.objectContaining({
            actionType: 'use_card',
            actor: 'black',
            params: {
                useCardId: 'trap_01'
            }
        }));
    });
    test('pending な use_card はローカル pending を作らず authority publish を待つ', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        global.cardState.hands.black = ['guard_01'];
        global.cardState.charge.black = 10;
        global.cardState.discard = [];
        global.cardState.hasUsedCardThisTurnByPlayer.black = false;
        global.cardState.lastUsedCardByPlayer.black = null;
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', createUseCardAction('black', 'guard_01'), {});
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            pendingSelectionActive: true,
            skippedLocalExecution: true,
            publishPromise: expect.any(Promise),
            nextCardState: global.cardState,
            nextGameState: global.gameState
        }));
        expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
        expect(global.cardState.hands.black).toEqual(['guard_01']);
        expect(global.cardState.charge.black).toBe(10);
        expect(global.cardState.discard).toEqual([]);
        expect(global.cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
        expect(global.cardState.lastUsedCardByPlayer.black).toBeNull();
        expect(result.playbackEvents).toEqual([]);
        await result.publishPromise;
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0]).toEqual(expect.objectContaining({
            actionType: 'use_card',
            actor: 'black',
            params: {
                useCardId: 'guard_01'
            }
        }));
    });
    test('HEAVEN_BLESSING の pending use_card は authority publish に寄せてローカル pending を作らない', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        import * as CardLogic from '../game/logic/cards.js';
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        global.cardState.hands.black = ['heaven_01'];
        global.cardState.charge.black = 10;
        global.cardState.turnIndex = 4;
        global.cardState.pendingEffectByPlayer.black = null;
        const expectedOffers = CardLogic.buildHeavenBlessingOffers('heaven_01', null, CardLogic.buildHeavenBlessingSeedHint(global.cardState, 'black'));
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', createUseCardAction('black', 'heaven_01', 4), {});
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            pendingSelectionActive: true,
            skippedLocalExecution: true,
            publishPromise: expect.any(Promise)
        }));
        expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
        await result.publishPromise;
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0]).toEqual(expect.objectContaining({
            actionType: 'use_card',
            actor: 'black',
            turnIndex: 4,
            params: {
                useCardId: 'heaven_01'
            }
        }));
    });
    test('CONDEMN_WILL の pending use_card は authority publish に寄せてローカル pending を作らない', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        global.cardState.hands.black = ['condemn_01'];
        global.cardState.hands.white = ['__hidden_hand__:white:0', '__hidden_hand__:white:1'];
        global.cardState.pendingEffectByPlayer.black = null;
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', createUseCardAction('black', 'condemn_01'), {});
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            pendingSelectionActive: true,
            skippedLocalExecution: true,
            publishPromise: expect.any(Promise)
        }));
        expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
        await result.publishPromise;
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0]).toEqual(expect.objectContaining({
            actionType: 'use_card',
            actor: 'black',
            turnIndex: 1,
            params: {
                useCardId: 'condemn_01'
            }
        }));
    });
    test('pending card の type を解決できない use_card は explicit reject しクラッシュしない', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        global.cardState.hands.black = ['sample_card'];
        global.cardState.charge.black = 10;
        global.cardState.discard = [];
        global.cardState.pendingEffectByPlayer.black = null;
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', createUseCardAction('black', 'missing_card_01'), {});
        expect(result).toEqual(expect.objectContaining({
            ok: false,
            rejectedReason: 'PENDING_CARD_TYPE_UNRESOLVED',
            cardId: 'missing_card_01'
        }));
        expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
        expect(global.cardState.hands.black).toEqual(['sample_card']);
        expect(global.cardState.charge.black).toBe(10);
        expect(global.cardState.discard).toEqual([]);
        expect(publishPayloads).toHaveLength(0);
    });
    test('PendingCoordinator が無くても pending use_card は authority publish できる', async () => {
        jest.doMock('../game/turn/pending-coordinator', () => null);
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        global.cardState.hands.black = ['guard_01'];
        global.cardState.charge.black = 10;
        global.cardState.discard = [];
        global.cardState.pendingEffectByPlayer.black = null;
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', createUseCardAction('black', 'guard_01'), {});
        expect(result).toEqual(expect.objectContaining({
            ok: true,
            pendingSelectionActive: true,
            skippedLocalExecution: true,
            publishPromise: expect.any(Promise)
        }));
        expect(global.cardState.pendingEffectByPlayer.black).toBeNull();
        expect(global.cardState.hands.black).toEqual(['guard_01']);
        expect(global.cardState.charge.black).toBe(10);
        expect(global.cardState.discard).toEqual([]);
        await result.publishPromise;
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0]).toEqual(expect.objectContaining({
            actionType: 'use_card',
            actor: 'black',
            params: {
                useCardId: 'guard_01'
            }
        }));
    });
    test('PendingCoordinator が無くても非 pending use_card はローカル実行しつつ publish できる', async () => {
        jest.doMock('../game/turn/pending-coordinator', () => null);
        jest.doMock('../game/logic/cards', () => {
            const actual = jest.requireActual('../game/logic/cards');
            return {
                ...actual,
                getCardDef(cardId) {
                    if (cardId === 'plain_01') {
                        return { id: 'plain_01', type: 'DOUBLE_CHAIN_WILL', cost: 3 };
                    }
                    return actual.getCardDef(cardId);
                }
            };
        });
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', createUseCardAction('black', 'plain_01'), {});
        expect(result).toEqual(expect.objectContaining({
            ok: true
        }));
        expect(result.skippedLocalExecution).not.toBe(true);
        expect(result.nextCardState.charge.black).toBe(7);
        expect(typeof result.publishPromise.then).toBe('function');
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0]).toEqual(expect.objectContaining({
            actionType: 'use_card',
            actor: 'black',
            params: { useCardId: 'plain_01' }
        }));
        expect(client.getState().publishTracker.operations[0].requestMeta).toEqual(expect.objectContaining({
            usedSnapshotFallback: true
        }));
    });
    test('即時 use_card の publish 応答は一致時に shadow playback で再適用する', async () => {
        jest.doMock('../game/turn/pending-coordinator', () => null);
        jest.doMock('../game/logic/cards', () => {
            const actual = jest.requireActual('../game/logic/cards');
            return {
                ...actual,
                getCardDef(cardId) {
                    if (cardId === 'plain_01') {
                        return { id: 'plain_01', type: 'DOUBLE_CHAIN_WILL', cost: 3 };
                    }
                    return actual.getCardDef(cardId);
                }
            };
        });
        const playbackEvents = [{
                type: 'sound_effect',
                phase: 1,
                targets: [{ soundKey: 'card_use_button' }]
            }];
        global.TurnPipelineUIAdapter.runTurnWithAdapter = jest.fn((_cs, _gs, _player, action) => {
            if (action && action.type === 'use_card') {
                return {
                    ok: true,
                    nextGameState: {
                        currentPlayer: 1,
                        turnNumber: 2
                    },
                    nextCardState: {
                        ...createSnapshot(20).cardState,
                        charge: { black: 7, white: 10 },
                        hasUsedCardThisTurnByPlayer: { black: true, white: false },
                        discard: ['plain_01']
                    },
                    playbackEvents
                };
            }
            return {
                ok: true,
                nextGameState: createSnapshot(20).gameState,
                nextCardState: createSnapshot(20).cardState,
                playbackEvents: []
            };
        });
        window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;
        const responseSnapshot = createSnapshot(21);
        responseSnapshot.gameState.turnNumber = 2;
        responseSnapshot.cardState.charge.black = 7;
        responseSnapshot.cardState.hasUsedCardThisTurnByPlayer.black = true;
        responseSnapshot.cardState.discard = ['plain_01'];
        global.fetch = jest.fn(async (url, init = {}) => {
            const parsedUrl = new URL(String(url));
            const path = parsedUrl.pathname;
            if (path === '/api/match/create') {
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'ROOM1234',
                    seatKey: 'black',
                    seatToken: 'seat-token',
                    stateVersion: 20,
                    snapshot: createSnapshot(20)
                });
            }
            if (path === '/api/match/publish') {
                publishPayloads.push(JSON.parse(init.body || '{}'));
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'ROOM1234',
                    stateVersion: 21,
                    snapshot: responseSnapshot,
                    playbackEvents
                });
            }
            return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
        });
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        global.gameState = {
            currentPlayer: 1,
            turnNumber: 2
        };
        global.cardState = {
            ...createSnapshot(20).cardState,
            charge: { black: 7, white: 10 },
            hasUsedCardThisTurnByPlayer: { black: true, white: false },
            discard: ['plain_01']
        };
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(createSnapshot(20).cardState, createSnapshot(20).gameState, 'black', createUseCardAction('black', 'plain_01'), {});
        await result.publishPromise;
        const telemetry = client.getNetworkTelemetry();
        const appliedEvent = telemetry.recentEvents.find((entry) => entry && entry.type === 'publish_response_snapshot_applied');
        expect(appliedEvent).toBeTruthy();
        expect(appliedEvent.details).toEqual(expect.objectContaining({
            usedShadowPlayback: true
        }));
    });
    test('publish成功レスポンスのsnapshotを即反映し断罪候補の不明カードを解消する', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        global.cardState.pendingEffectByPlayer.black = {
            type: 'CONDEMN_WILL',
            stage: 'selectTarget',
            offers: [{ handIndex: 0, cardId: '__hidden_hand__:white:0' }]
        };
        global.fetch = jest.fn(async (url, init = {}) => {
            const parsedUrl = new URL(String(url));
            const path = parsedUrl.pathname;
            if (path === '/api/match/publish') {
                JSON.parse(init.body || '{}');
                const responseSnapshot = createSnapshot(21);
                return jsonResponse(200, {
                    ok: true,
                    roomId: 'ROOM1234',
                    stateVersion: 21,
                    snapshot: {
                        ...responseSnapshot,
                        cardState: {
                            ...responseSnapshot.cardState,
                            pendingEffectByPlayer: {
                                ...responseSnapshot.cardState.pendingEffectByPlayer,
                                black: {
                                    type: 'CONDEMN_WILL',
                                    stage: 'selectTarget',
                                    offers: [{ handIndex: 0, cardId: 'gold_stone' }]
                                }
                            }
                        }
                    }
                });
            }
            return jsonResponse(404, { ok: false, reason: 'NOT_FOUND' });
        });
        const result = await client.publishSnapshot({
            actionType: 'use_card',
            playerKey: 'black',
            action: createUseCardAction()
        });
        expect(result.ok).toBe(true);
        expect(global.cardState.pendingEffectByPlayer.black.offers[0].cardId).toBe('gold_stone');
    });
    test('place action は Single Writer で action bridge 内から publishSnapshot を呼ぶ', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const action = { type: 'place', row: 2, col: 3, playerKey: 'black' };
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', action, {});
        expect(result.ok).toBe(true);
        expect(result.skippedLocalExecution).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        // Single Writer: place は action bridge 内で command publish する
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0].actionType).toBe('place');
        expect(publishPayloads[0].actor).toBe('black');
        expect(publishPayloads[0].params).toEqual({ row: 2, col: 3 });
        expect(publishPayloads[0].snapshot).toBeUndefined();
        expect(publishPayloads[0].playbackEvents).toBeUndefined();
    });
    test('pass action は Single Writer でローカル実行をスキップし publishSnapshot を呼ぶ', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        // pass では originalRunTurnWithAdapter が呼ばれないことを検証
        const originalMock = jest.fn(() => ({
            ok: true,
            nextGameState: { currentPlayer: -1, turnNumber: 2 },
            nextCardState: createSnapshot(20).cardState,
            playbackEvents: []
        }));
        global.TurnPipelineUIAdapter = { runTurnWithAdapter: originalMock };
        window.TurnPipelineUIAdapter = global.TurnPipelineUIAdapter;
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const action = { type: 'pass', playerKey: 'black' };
        const result = window.TurnPipelineUIAdapter.runTurnWithAdapter(global.cardState, global.gameState, 'black', action, {});
        expect(result.ok).toBe(true);
        expect(result.skippedLocalExecution).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 0));
        // Single Writer: pass は action bridge 内で command publish する
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0].actionType).toBe('pass');
        // originalRunTurnWithAdapter は呼ばれない
        expect(originalMock).not.toHaveBeenCalled();
    });
    test('publishSnapshot は local hand animation source を shadow playback 用に保持しつつ network payload へ送らない', async () => {
        require('../ui/network-client.js');
        const client = window.NetworkMatchClient;
        expect(client).toBeTruthy();
        const created = await client.createRoom({ serverUrl: 'http://localhost:8787', playerName: 'くろ' });
        expect(created.ok).toBe(true);
        const playbackEvents = [{
                type: 'card_use_animation',
                phase: 1,
                targets: [{
                        player: 'black',
                        owner: 'black',
                        cardId: 'sample_card',
                        name: 'Sample Card',
                        sourceCardEl: { localOnly: true, id: 'card-dom-node' },
                        sourceCardRect: {
                            left: 220,
                            top: 500,
                            width: 90,
                            height: 120,
                            right: 310,
                            bottom: 620
                        }
                    }]
            }];
        const result = await client.publishSnapshot({
            actionType: 'use_card',
            playerKey: 'black',
            playbackEvents,
            action: createUseCardAction()
        });
        expect(result.ok).toBe(true);
        expect(publishPayloads).toHaveLength(1);
        expect(publishPayloads[0].playbackEvents).toBeUndefined();
        expect(publishPayloads[0].snapshot).toBeUndefined();
        expect(playbackEvents[0].targets[0].sourceCardEl).toEqual({ localOnly: true, id: 'card-dom-node' });
        expect(playbackEvents[0].targets[0].sourceCardRect).toEqual({
            left: 220,
            top: 500,
            width: 90,
            height: 120,
            right: 310,
            bottom: 620
        });
    });
});
//# sourceMappingURL=ui.network-client.action-bridge-next-snapshot.test.js.map