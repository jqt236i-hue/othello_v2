describe('move-executor presentation emission', () => {
    const modPath = require.resolve('../game/move-executor');
    beforeEach(() => {
        jest.resetModules();
        // clear module cache
        delete require.cache[modPath];
        // reset globals
        delete global.BoardOps;
        delete global.PresentationHelper;
        delete global.onTurnStart;
        delete global.NetworkMatchClient;
        delete global.isGameOver;
        delete global.showResult;
        delete global.PlaybackStateManager;
    });
    function installProcessingMirror(moveExecutor: any) {
        moveExecutor.setUIImpl({
            setProcessing: (next: boolean) => {
                global.isProcessing = next === true;
            }
        });
    }
    function installImmediateNetworkHandoff(moveExecutor: any, handler?: (opts: any) => any) {
        const finalizeNetworkTurnHandoff = jest.fn(async (opts: any) => {
            if (typeof handler === 'function') return handler(opts);
            if (typeof opts.publishSnapshot === 'function') {
                opts.publishSnapshot({
                    playerKey: opts.playerKey,
                    actionType: opts.actionType,
                    action: opts.action,
                    playbackEvents: opts.playbackEvents
                });
            }
            return { ok: true, scheduledCpu: false };
        });
        moveExecutor.setUIImpl({
            networkTurnHandoff: { finalizeNetworkTurnHandoff }
        });
        return finalizeNetworkTurnHandoff;
    }

    test('executeMoveViaPipeline emits PLAYBACK_EVENTS via injected PresentationHelper runtime when playbackEvents present', async () => {
        // arrange
        global.BoardOps = { emitPresentationEvent: jest.fn() };

        // minimal cardState/gameState
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };

        const moveExecutor = require('../game/move-executor.js');
        const presentationRuntime = {
            emitPresentationEvent: (cardState, ev) => {
                global.BoardOps.emitPresentationEvent(cardState, ev);
                return true;
            }
        };
        const presentation = require('../game/logic/presentation');
        presentation.setPresentationRuntime(presentationRuntime);
        try { require('../dist/game/logic/presentation').setPresentationRuntime(presentationRuntime); } catch (e) { /* ignore */ }
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

    test('injected presentation hook is preferred over global BoardOps', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };

        const emitPresentationEvent = jest.fn(() => true);
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({ emitPresentationEvent });

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
        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(emitPresentationEvent).toHaveBeenCalledWith(expect.objectContaining({
            type: 'PLAYBACK_EVENTS'
        }));
        expect(global.BoardOps.emitPresentationEvent).not.toHaveBeenCalled();
    });

    test('processing state is delegated through setProcessing bridge, not PlaybackStateManager shape', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };

        const setProcessing = jest.fn();
        const getPlaybackStateManager = jest.fn(() => ({
            setBusyState: jest.fn(),
            setProcessing: jest.fn()
        }));
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            setProcessing,
            getPlaybackStateManager
        });

        const publishPromise = Promise.resolve({ ok: true });
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                skippedLocalExecution: true,
                publishPromise
            }))
        };

        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(setProcessing).toHaveBeenCalledWith(true);
        expect(setProcessing).toHaveBeenLastCalledWith(false);
        expect(getPlaybackStateManager).not.toHaveBeenCalled();
    });

    test('injected network publisher is preferred over global NetworkMatchClient', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: jest.fn()
        };

        const publishSnapshot = jest.fn();
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            publishSnapshot,
            isNetworkPublishActive: () => true
        });
        installImmediateNetworkHandoff(moveExecutor);

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
        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            playerKey: 'black',
            actionType: 'place'
        }));
        expect(global.NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();
    });

    test('turn-start integrity latch aborts publish, CPU handoff, and later board callbacks', async () => {
        let blocked = false;
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: -1, turnNumber: 9, board: Array(8).fill(null).map(() => Array(8).fill(0)) };
        global.onTurnStart = jest.fn(async () => {
            blocked = true;
            return { playbackEvents: [{ type: 'turn_start_draw', phase: 1 }] };
        });
        const publishSnapshot = jest.fn(async () => ({ ok: true }));
        const scheduleCpuTurn = jest.fn();
        const processCpuTurn = jest.fn();
        const emitBoardUpdate = jest.fn(() => true);
        const setProcessing = jest.fn();
        const finalizeNetworkTurnHandoff = jest.fn(async (options: any) => {
            await options.onTurnStart(global.gameState.currentPlayer);
            if (options.isAborted()) {
                options.setProcessing(false);
                return {
                    ok: false,
                    reason: 'runtime_unavailable',
                    result: { ok: false, reason: 'RUNTIME_UNAVAILABLE' },
                    scheduledCpu: false
                };
            }
            await options.publishSnapshot({});
            options.scheduleCpuTurn({ delayMs: 0, expectedTurnNumber: 9, nextPlayerKey: 'white' });
            options.onHumanTurnReady({ nextPlayerKey: 'white' });
            return { ok: true };
        });
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            networkTurnHandoff: { finalizeNetworkTurnHandoff },
            isCardRuntimeIntegrityBlocked: () => blocked,
            isNetworkPublishActive: () => true,
            publishSnapshot,
            scheduleCpuTurn,
            processCpuTurn,
            emitBoardUpdate,
            setProcessing
        });
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                nextGameState: global.gameState,
                nextCardState: global.cardState,
                playbackEvents: [],
                phases: {},
                placementEffects: {},
                immediate: {}
            }))
        };

        await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: 1 },
            false,
            'black',
            adapter,
            {}
        );

        expect(finalizeNetworkTurnHandoff).toHaveBeenCalledWith(expect.objectContaining({
            isAborted: expect.any(Function)
        }));
        expect(publishSnapshot).not.toHaveBeenCalled();
        expect(scheduleCpuTurn).not.toHaveBeenCalled();
        expect(processCpuTurn).not.toHaveBeenCalled();
        expect(emitBoardUpdate).not.toHaveBeenCalled();
        expect(setProcessing).toHaveBeenLastCalledWith(false);
    });

    test('ネット対戦では publish 応答を待ち、終局表示を authoritative snapshot へ委譲する', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.isGameOver = jest.fn(() => true);
        global.showResult = jest.fn();
        global.NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: jest.fn()
        };

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            publishSnapshot: (meta: any) => global.NetworkMatchClient.publishSnapshot(meta),
            isNetworkPublishActive: () => true
        });
        const finalizeNetworkTurnHandoff = installImmediateNetworkHandoff(moveExecutor, async (opts: any) => {
            opts.publishSnapshot({
                playerKey: opts.playerKey,
                actionType: opts.actionType,
                action: opts.action,
                playbackEvents: opts.playbackEvents
            });
            return { ok: true, gameOver: true, scheduledCpu: false };
        });
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

        expect(global.showResult).not.toHaveBeenCalled();
        expect(finalizeNetworkTurnHandoff).toHaveBeenCalledWith(expect.objectContaining({
            awaitPublishResult: true,
            deferResultToAuthoritativeSnapshot: true
        }));
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

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            publishSnapshot: (meta: any) => global.NetworkMatchClient.publishSnapshot(meta),
            isNetworkPublishActive: () => true
        });
        installImmediateNetworkHandoff(moveExecutor, async (opts: any) => {
            const turnStartResult = await opts.onTurnStart(global.gameState.currentPlayer);
            const combinedPlaybackEvents = opts.playbackEvents.concat(turnStartResult.playbackEvents || []);
            opts.publishSnapshot({
                playerKey: opts.playerKey,
                actionType: opts.actionType,
                action: opts.action,
                playbackEvents: combinedPlaybackEvents
            });
            return { ok: true, scheduledCpu: false };
        });
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

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            publishSnapshot: (meta: any) => global.NetworkMatchClient.publishSnapshot(meta),
            isNetworkPublishActive: () => true
        });
        installImmediateNetworkHandoff(moveExecutor, async (opts: any) => {
            const turnStartResult = await opts.onTurnStart(global.gameState.currentPlayer);
            const combinedPlaybackEvents = opts.playbackEvents.concat(turnStartResult.playbackEvents || []);
            opts.publishSnapshot({
                playerKey: opts.playerKey,
                actionType: opts.actionType,
                action: opts.action,
                playbackEvents: combinedPlaybackEvents
            });
            return { ok: true, scheduledCpu: false };
        });
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

        const moveExecutor = require('../game/move-executor.js');
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

    test('再生イベントがないときは CARD_STATE_CHANGED に任せて即時 renderCardUI を重ねない', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.renderCardUI = jest.fn();
        global.emitCardStateChange = jest.fn(() => true);

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            emitCardStateChange: () => global.emitCardStateChange()
        });
        const fakeRes = {
            ok: true,
            nextGameState: global.gameState,
            nextCardState: global.cardState,
            playbackEvents: [],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const move = { row: 2, col: 3, player: 1 };

        await moveExecutor.executeMoveViaPipeline(move, false, 'black', adapter, {});

        expect(global.emitCardStateChange).toHaveBeenCalledTimes(1);
        expect(global.renderCardUI).not.toHaveBeenCalled();
    });

    test('再生イベントありの通常着手でも布石表示だけは即時同期する', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            turnIndex: 0,
            charge: { black: 2, white: 0 }
        };
        global.gameState = {
            currentPlayer: -1,
            board: Array(8).fill().map(() => Array(8).fill(0))
        };
        global.onTurnStart = jest.fn(async () => ({ playbackEvents: [] }));

        const syncVisibleChargeDisplaysNow = jest.fn(() => true);
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            syncVisibleChargeDisplaysNow
        });

        const fakeRes = {
            ok: true,
            nextGameState: global.gameState,
            nextCardState: {
                pendingEffectByPlayer: { black: null, white: null },
                turnIndex: 1,
                charge: { black: 5, white: 0 }
            },
            playbackEvents: [{ type: 'place', phase: 1, targets: [{ r: 2, col: 3 }] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };

        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(syncVisibleChargeDisplaysNow).toHaveBeenCalledTimes(1);
        expect(global.onTurnStart).toHaveBeenCalledTimes(1);
    });

    test('再生イベントありの通常着手でも game state change を通知して詳細UIを後続同期できる', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = {
            currentPlayer: 1,
            consecutivePasses: 1,
            board: Array(8).fill(null).map(() => Array(8).fill(0))
        };
        global.onTurnStart = jest.fn(async () => ({ playbackEvents: [] }));
        global.emitGameStateChange = jest.fn(() => true);
        global.emitCardStateChange = jest.fn(() => true);
        global.renderCardUI = jest.fn();

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            emitGameStateChange: () => global.emitGameStateChange(),
            emitCardStateChange: () => global.emitCardStateChange()
        });
        const nextGameState = Object.assign({}, global.gameState, {
            currentPlayer: -1,
            consecutivePasses: 0,
            turnNumber: 2
        });
        const fakeRes = {
            ok: true,
            nextGameState,
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'flip', phase: 1, targets: [{ row: 2, col: 3 }] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };
        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };

        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(global.emitGameStateChange).toHaveBeenCalledTimes(1);
        expect(global.emitCardStateChange).not.toHaveBeenCalled();
        expect(global.renderCardUI).not.toHaveBeenCalled();
        expect(global.gameState.consecutivePasses).toBe(0);
    });

    test('game state change sees PLAYBACK_EVENTS before board render can consume final board state', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            turnIndex: 0,
            presentationEvents: [],
            _presentationEventsPersist: []
        };
        global.gameState = {
            currentPlayer: 1,
            board: Array(8).fill(null).map(() => Array(8).fill(0))
        };
        global.onTurnStart = jest.fn(async () => ({ playbackEvents: [] }));

        const observedDuringGameStateChange: any[] = [];
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            getNetworkTurnHandoff: () => ({}),
            emitPresentationEvent: (ev: any) => {
                if (!Array.isArray(global.cardState.presentationEvents)) global.cardState.presentationEvents = [];
                if (!Array.isArray(global.cardState._presentationEventsPersist)) global.cardState._presentationEventsPersist = [];
                global.cardState.presentationEvents.push(ev);
                global.cardState._presentationEventsPersist.push(ev);
                return true;
            },
            emitGameStateChange: () => {
                observedDuringGameStateChange.push({
                    live: (global.cardState.presentationEvents || []).map((ev: any) => ev && ev.type),
                    persist: (global.cardState._presentationEventsPersist || []).map((ev: any) => ev && ev.type)
                });
                return true;
            }
        });
        const nextCardState = {
            pendingEffectByPlayer: { black: null, white: null },
            turnIndex: 1,
            presentationEvents: [],
            _presentationEventsPersist: [{ type: 'DESTROY', row: 3, col: 3 }]
        };
        const nextGameState = {
            currentPlayer: -1,
            board: Array(8).fill(null).map(() => Array(8).fill(0))
        };
        const fakeRes = {
            ok: true,
            nextGameState,
            nextCardState,
            playbackEvents: [{ type: 'destroy', phase: 2, targets: [{ r: 3, col: 3 }] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };
        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };

        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(observedDuringGameStateChange).toHaveLength(1);
        expect(observedDuringGameStateChange[0].live).toContain('PLAYBACK_EVENTS');
        expect(observedDuringGameStateChange[0].persist).toContain('PLAYBACK_EVENTS');
    });

    test('UIブリッジがない場合は global renderVisibleChargeDisplays を直接探索しない', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            turnIndex: 0,
            charge: { black: 2, white: 0 }
        };
        global.gameState = {
            currentPlayer: -1,
            board: Array(8).fill().map(() => Array(8).fill(0))
        };
        global.onTurnStart = jest.fn(async () => ({ playbackEvents: [] }));
        global.renderVisibleChargeDisplays = jest.fn(() => true);

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({});

        const fakeRes = {
            ok: true,
            nextGameState: global.gameState,
            nextCardState: {
                pendingEffectByPlayer: { black: null, white: null },
                turnIndex: 1,
                charge: { black: 5, white: 0 }
            },
            playbackEvents: [{ type: 'place', phase: 1, targets: [{ r: 2, col: 3 }] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };

        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(global.renderVisibleChargeDisplays).not.toHaveBeenCalled();
        expect(global.onTurnStart).toHaveBeenCalledTimes(1);
    });

    test('skipped local execution without publishPromise clears processing through setProcessing bridge', async () => {
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.isProcessing = true;
        const setProcessing = jest.fn((next: boolean) => {
            global.isProcessing = next === true;
        });

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            setProcessing
        });
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({ skippedLocalExecution: true }))
        };

        await moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});

        expect(setProcessing).toHaveBeenCalledWith(false);
        expect(global.isProcessing).toBe(false);
    });

    test('skipped local execution keeps processing locked until publishPromise settles', async () => {
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };
        global.isProcessing = false;
        global.emitBoardUpdate = jest.fn();
        const setProcessing = jest.fn((next: boolean) => {
            global.isProcessing = next === true;
        });

        let resolvePublish: any;
        const publishPromise = new Promise((resolve) => {
            resolvePublish = resolve;
        });

        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            setProcessing
        });
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                skippedLocalExecution: true,
                publishPromise
            }))
        };

        const executionPromise = moveExecutor.executeMoveViaPipeline({ row: 2, col: 3, player: 1 }, false, 'black', adapter, {});
        await Promise.resolve();

        expect(setProcessing).toHaveBeenCalledWith(true);
        expect(global.isProcessing).toBe(true);

        resolvePublish({ ok: true });
        await executionPromise;

        expect(setProcessing).toHaveBeenLastCalledWith(false);
        expect(global.isProcessing).toBe(false);
    });

    test('accepted network-only execution drains visuals but suppresses board refresh after the integrity latch', async () => {
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill(null).map(() => Array(8).fill(0)) };
        let blocked = false;
        const emitBoardUpdate = jest.fn(() => true);
        const waitForAuthoritativeVisualSettlement = jest.fn(async () => {
            blocked = true;
            return { ok: true };
        });
        const setProcessing = jest.fn();
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            emitBoardUpdate,
            isCardRuntimeIntegrityBlocked: () => blocked,
            waitForAuthoritativeVisualSettlement,
            setProcessing
        });
        const publishResult = { ok: true, presentationCursor: { visualSeq: 22 } };
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                skippedLocalExecution: true,
                publishPromise: Promise.resolve(publishResult)
            }))
        };

        const result = await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: 1 },
            false,
            'black',
            adapter,
            {}
        );

        expect(waitForAuthoritativeVisualSettlement).toHaveBeenCalledWith(publishResult);
        expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable', result: publishResult });
        expect(emitBoardUpdate).not.toHaveBeenCalled();
        expect(setProcessing).toHaveBeenLastCalledWith(false);
    });

    test('raw runtime-unavailable network result never refreshes the board', async () => {
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill(null).map(() => Array(8).fill(0)) };
        const emitBoardUpdate = jest.fn(() => true);
        const waitForAuthoritativeVisualSettlement = jest.fn();
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({ emitBoardUpdate, waitForAuthoritativeVisualSettlement });
        const publishResult = { ok: false, reason: 'RUNTIME_UNAVAILABLE' };
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                skippedLocalExecution: true,
                publishPromise: Promise.resolve(publishResult)
            }))
        };

        const result = await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: 1 }, false, 'black', adapter, {}
        );

        expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable', result: publishResult });
        expect(waitForAuthoritativeVisualSettlement).not.toHaveBeenCalled();
        expect(emitBoardUpdate).not.toHaveBeenCalled();
    });

    test('ordinary network rejection keeps the existing board refresh recovery', async () => {
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill(null).map(() => Array(8).fill(0)) };
        const emitBoardUpdate = jest.fn(() => true);
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({ emitBoardUpdate });
        const publishResult = { ok: false, reason: 'OUT_OF_TURN' };
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                skippedLocalExecution: true,
                publishPromise: Promise.resolve(publishResult)
            }))
        };

        const result = await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: 1 }, false, 'black', adapter, {}
        );

        expect(result).toMatchObject({ ok: false, reason: 'network_publish_failed', result: publishResult });
        expect(emitBoardUpdate).toHaveBeenCalledTimes(1);
    });

    test('runtime-unavailable handoff remains structured without a local latch or board refresh', async () => {
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: -1, board: Array(8).fill(null).map(() => Array(8).fill(0)) };
        const emitBoardUpdate = jest.fn(() => true);
        const handoffResult = { ok: false, reason: 'RUNTIME_UNAVAILABLE' };
        const finalizeNetworkTurnHandoff = jest.fn(async () => handoffResult);
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            emitBoardUpdate,
            networkTurnHandoff: { finalizeNetworkTurnHandoff },
            isCardRuntimeIntegrityBlocked: () => false
        });
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                nextGameState: global.gameState,
                nextCardState: global.cardState,
                playbackEvents: [],
                phases: {},
                placementEffects: {},
                immediate: {}
            }))
        };

        const result = await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: 1 }, false, 'black', adapter, {}
        );

        expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable', result: handoffResult });
        expect(emitBoardUpdate).not.toHaveBeenCalled();
    });

    test('runtime-unavailable handoff drains an authority-accepted visual sequence before stopping', async () => {
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: -1, board: Array(8).fill(null).map(() => Array(8).fill(0)) };
        const emitBoardUpdate = jest.fn(() => true);
        const publishResult = { ok: true, presentationCursor: { visualSeq: 28 } };
        const handoffResult = {
            ok: false,
            reason: 'runtime_unavailable',
            authoritativePublishAccepted: true,
            publishResult
        };
        const waitForAuthoritativeVisualSettlement = jest.fn(async () => ({ ok: true, visualSeq: 28 }));
        const finalizeNetworkTurnHandoff = jest.fn(async () => handoffResult);
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            emitBoardUpdate,
            networkTurnHandoff: { finalizeNetworkTurnHandoff },
            isCardRuntimeIntegrityBlocked: () => false,
            waitForAuthoritativeVisualSettlement
        });
        const adapter = {
            runTurnWithAdapter: jest.fn(() => ({
                ok: true,
                nextGameState: global.gameState,
                nextCardState: global.cardState,
                playbackEvents: [],
                phases: {},
                placementEffects: {},
                immediate: {}
            }))
        };

        const result = await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: 1 }, false, 'black', adapter, {}
        );

        expect(waitForAuthoritativeVisualSettlement).toHaveBeenCalledWith(publishResult);
        expect(result).toMatchObject({ ok: false, reason: 'runtime_unavailable', result: handoffResult });
        expect(emitBoardUpdate).not.toHaveBeenCalled();
    });
});
