describe('move-executor presentation emission', () => {
    const modPath = require.resolve('../game/move-executor');
    beforeEach(() => {
        // clear module cache
        delete require.cache[modPath];
        // reset globals
        delete global.BoardOps;
        delete global.PresentationHelper;
        delete global.onTurnStart;
        delete global.NetworkMatchClient;
        delete global.isGameOver;
        delete global.showResult;
    });

    test('executeMoveViaPipeline emits PLAYBACK_EVENTS via PresentationHelper when playbackEvents present', async () => {
        // arrange
        global.BoardOps = { emitPresentationEvent: jest.fn() };

        // minimal cardState/gameState
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };

        const moveExecutor = require('../game/move-executor');

        const move = { row: 2, col: 3, player: 1 };
        const playerKey = 'black';

        const fakeRes = {
            ok: true,
            nextGameState: global.gameState,
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'PLAYBACK_EVENTS', events: [] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const pipeline = {}; // not used by adapter mock

        // act
        await moveExecutor.executeMoveViaPipeline(move, false, playerKey, adapter, pipeline);

        // assert
        expect(global.BoardOps.emitPresentationEvent).toHaveBeenCalled();
        const call = global.BoardOps.emitPresentationEvent.mock.calls[0];
        expect(call[1] && call[1].type).toBe('PLAYBACK_EVENTS');
    });

    test('終局時は showResult 後にネットへ最終スナップショットを送る', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.isGameOver = jest.fn(() => true);
        global.showResult = jest.fn();
        global.NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: jest.fn()
        };

        const moveExecutor = require('../game/move-executor');

        const fakeRes = {
            ok: true,
            nextGameState: global.gameState,
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'move', phase: 1, targets: [] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const move = { row: 2, col: 3, player: 1 };

        await moveExecutor.executeMoveViaPipeline(move, false, 'black', adapter, {});

        expect(global.showResult).toHaveBeenCalledTimes(1);
        expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);
        expect(global.NetworkMatchClient.publishSnapshot.mock.calls[0][0]).toMatchObject({
            playerKey: 'black',
            actionType: 'place'
        });
    });

    test('ネット送信にonTurnStart由来の再生イベントを含める', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.onTurnStart = jest.fn(async () => ({
            playbackEvents: [
                {
                    type: 'move',
                    phase: 50,
                    targets: [{ from: { r: 2, col: 3 }, to: { r: 2, col: 4 } }]
                }
            ]
        }));
        global.NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: jest.fn()
        };

        const moveExecutor = require('../game/move-executor');

        const fakeRes = {
            ok: true,
            nextGameState: global.gameState,
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'place', phase: 1, targets: [{ r: 2, col: 3 }] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const move = { row: 2, col: 3, player: 1 };

        await moveExecutor.executeMoveViaPipeline(move, false, 'black', adapter, {});

        expect(global.onTurnStart).toHaveBeenCalledTimes(1);
        expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);

        const payload = global.NetworkMatchClient.publishSnapshot.mock.calls[0][0];
        expect(Array.isArray(payload.playbackEvents)).toBe(true);
        expect(payload.playbackEvents).toHaveLength(2);
        expect(payload.playbackEvents[0].type).toBe('place');
        expect(payload.playbackEvents[1].type).toBe('move');
        expect(payload.snapshot).toBeUndefined();
    });

    test('ネット送信は command payload を優先し snapshot を含めない', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            turnIndex: 0,
            hands: { black: ['black_card'], white: [] },
            turnCountByPlayer: { black: 1, white: 0 },
            lastTurnStartedFor: 'black'
        };
        global.gameState = {
            currentPlayer: 1,
            turnNumber: 0,
            board: Array(8).fill().map(() => Array(8).fill(0))
        };
        global.onTurnStart = jest.fn(async () => {
            global.cardState.hands.white = ['white_draw'];
            global.cardState.turnIndex = 2;
            global.cardState.turnCountByPlayer.white = 1;
            global.cardState.lastTurnStartedFor = 'white';
            return {
                playbackEvents: [
                    { type: 'hand_add', phase: 2, targets: [{ player: 'white', cardId: 'white_draw' }] }
                ]
            };
        });
        global.NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: jest.fn()
        };

        const moveExecutor = require('../game/move-executor');

        const nextCardState = {
            pendingEffectByPlayer: { black: null, white: null },
            turnIndex: 1,
            hands: { black: ['black_card'], white: [] },
            turnCountByPlayer: { black: 1, white: 0 },
            lastTurnStartedFor: 'black'
        };
        const nextGameState = {
            currentPlayer: -1,
            turnNumber: 1,
            board: Array(8).fill().map(() => Array(8).fill(0))
        };
        const fakeRes = {
            ok: true,
            nextGameState,
            nextCardState,
            playbackEvents: [{ type: 'place', phase: 1, targets: [{ r: 2, col: 3 }] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const move = { row: 2, col: 3, player: 1 };

        await moveExecutor.executeMoveViaPipeline(move, false, 'black', adapter, {});

        const payload = global.NetworkMatchClient.publishSnapshot.mock.calls[0][0];
        expect(payload.action).toEqual(expect.objectContaining({
            type: 'place',
            row: 2,
            col: 3,
            turnIndex: 0
        }));
        expect(payload.snapshot).toBeUndefined();
        expect(payload.playbackEvents).toHaveLength(2);
        expect(global.cardState.hands.white).toEqual(['white_draw']);
    });

    test('hand_remove再生があるときは即時renderCardUIをスキップする', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.renderCardUI = jest.fn();
        global.emitCardStateChange = jest.fn();

        const moveExecutor = require('../game/move-executor');

        const fakeRes = {
            ok: true,
            nextGameState: global.gameState,
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'hand_remove', phase: 1, targets: [{ player: 'white', count: 1 }] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const move = { row: 2, col: 3, player: 1 };

        await moveExecutor.executeMoveViaPipeline(move, false, 'black', adapter, {});

        expect(global.renderCardUI).not.toHaveBeenCalled();
        expect(global.emitCardStateChange).not.toHaveBeenCalled();
    });
});