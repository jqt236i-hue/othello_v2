jest.useFakeTimers();

describe('move-executor CPU scheduling DI', () => {
    const modPath = require.resolve('../game/move-executor');
    const distModPath = require.resolve('../dist/game/move-executor');
    beforeEach(() => {
        delete require.cache[modPath];
        delete require.cache[distModPath];
        delete global.BoardOps;
        delete global.PresentationHelper;
        delete global.processCpuTurn;
        delete global.isGameOver;
        delete global.showResult;
        delete global.waitForPlaybackIdle;
        delete global.MATCH_MODE;
        delete global.DEBUG_HUMAN_VS_HUMAN;
        global.WHITE = -1;
    });
    afterEach(() => {
        const moveExecutor = require('../game/move-executor.js');
        moveExecutor.setUIImpl({
            getNetworkTurnHandoff: null,
            resolveCpuDecisionLevelForPlayer: null,
            readExplicitCpuTurnDelayMs: null
        });
    });
    function installProcessingMirror(moveExecutor: any) {
        moveExecutor.setUIImpl({
            setProcessing: (next: boolean) => {
                global.isProcessing = next === true;
            }
        });
    }

    test.each([
        { nextPlayerKey: 'white', nextPlayerValue: -1, actingPlayerKey: 'black', controllerMap: {} },
        { nextPlayerKey: 'black', nextPlayerValue: 1, actingPlayerKey: 'white', controllerMap: { black: 'white' } }
    ])('uses the actual $nextPlayerKey Lv1 policy for place handoff', async ({
        nextPlayerKey,
        nextPlayerValue,
        actingPlayerKey,
        controllerMap
    }) => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            fateWillControllerByTurnOwner: controllerMap,
            turnIndex: 0
        };
        global.gameState = {
            currentPlayer: actingPlayerKey === 'black' ? 1 : -1,
            board: Array(8).fill(null).map(() => Array(8).fill(0)),
            turnNumber: 6
        };

        const moveExecutor = require('../game/move-executor.js');
        installProcessingMirror(moveExecutor);
        const resolveCpuDecisionLevelForPlayer = jest.fn(() => 1);
        const scheduleCpuTurn = jest.fn(() => true);
        const networkTurnHandoff = {
            finalizeNetworkTurnHandoff: jest.fn(async (options: any) => {
                options.scheduleCpuTurn({
                    delayMs: options.cpuDelayMs,
                    expectedTurnNumber: 6,
                    nextPlayerKey
                });
                return { ok: true, scheduledCpu: true, nextPlayerKey };
            })
        };
        moveExecutor.setUIImpl({
            scheduleCpuTurn,
            processCpuTurn: jest.fn(),
            resolveCpuDecisionLevelForPlayer,
            readExplicitCpuTurnDelayMs: () => null,
            getNetworkTurnHandoff: () => networkTurnHandoff
        });

        await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: actingPlayerKey === 'black' ? 1 : -1 },
            false,
            actingPlayerKey,
            {
                runTurnWithAdapter: jest.fn(() => ({
                    ok: true,
                    nextGameState: { ...global.gameState, currentPlayer: nextPlayerValue },
                    nextCardState: global.cardState,
                    playbackEvents: [],
                    phases: {},
                    placementEffects: {},
                    immediate: {}
                }))
            },
            {}
        );

        expect(resolveCpuDecisionLevelForPlayer).toHaveBeenCalledWith(nextPlayerKey);
        expect(scheduleCpuTurn).toHaveBeenCalledWith(0, expect.any(Function));
    });

    test('place handoff gives an explicit UI override priority over Lv1', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = {
            pendingEffectByPlayer: { black: null, white: null },
            fateWillControllerByTurnOwner: {},
            turnIndex: 0
        };
        global.gameState = {
            currentPlayer: 1,
            board: Array(8).fill(null).map(() => Array(8).fill(0)),
            turnNumber: 6
        };
        const moveExecutor = require('../game/move-executor.js');
        installProcessingMirror(moveExecutor);
        const scheduleCpuTurn = jest.fn(() => true);
        const networkTurnHandoff = {
            finalizeNetworkTurnHandoff: jest.fn(async (options: any) => {
                options.scheduleCpuTurn({
                    delayMs: options.cpuDelayMs,
                    expectedTurnNumber: 6,
                    nextPlayerKey: 'white'
                });
                return { ok: true, scheduledCpu: true, nextPlayerKey: 'white' };
            })
        };
        moveExecutor.setUIImpl({
            scheduleCpuTurn,
            processCpuTurn: jest.fn(),
            resolveCpuDecisionLevelForPlayer: () => 1,
            readExplicitCpuTurnDelayMs: () => 19.8,
            getNetworkTurnHandoff: () => networkTurnHandoff
        });

        await moveExecutor.executeMoveViaPipeline(
            { row: 2, col: 3, player: 1 },
            false,
            'black',
            {
                runTurnWithAdapter: jest.fn(() => ({
                    ok: true,
                    nextGameState: { ...global.gameState, currentPlayer: -1 },
                    nextCardState: global.cardState,
                    playbackEvents: [],
                    phases: {},
                    placementEffects: {},
                    immediate: {}
                }))
            },
            {}
        );

        expect(scheduleCpuTurn).toHaveBeenCalledWith(19, expect.any(Function));
    });

    test('uses injected scheduler and CPU processor instead of global processCpuTurn', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        // nextGameState currentPlayer should be WHITE to force CPU scheduling
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };

        const moveExecutor = require('../game/move-executor.js');
        installProcessingMirror(moveExecutor);
        const move = { row: 2, col: 3, player: 1 };
        const playerKey = 'black';

        const fakeRes = {
            ok: true,
            nextGameState: { currentPlayer: -1 }, // CPU turn next
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'PLAYBACK_EVENTS', events: [] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const pipeline = {}; // not used by adapter mock

        const mockCpu = jest.fn();
        const scheduleCpuTurn = jest.fn((delay, cb) => setTimeout(cb, delay));
        moveExecutor.setUIImpl({ scheduleCpuTurn, processCpuTurn: mockCpu });

        // Act
        await moveExecutor.executeMoveViaPipeline(move, false, playerKey, adapter, pipeline);

        // Fast-forward timers used for CPU delay
        jest.runAllTimers();

        expect(scheduleCpuTurn).toHaveBeenCalled();
        expect(mockCpu).toHaveBeenCalled();
    });

    test('stale scheduled CPU callback is skipped when turn/player changed', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)), turnNumber: 12 };
        global.isProcessing = false;

        const moveExecutor = require('../game/move-executor.js');
        installProcessingMirror(moveExecutor);
        const move = { row: 2, col: 3, player: 1 };
        const playerKey = 'black';

        const fakeRes = {
            ok: true,
            nextGameState: { currentPlayer: -1, turnNumber: 12 }, // WHITE turn expected
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'PLAYBACK_EVENTS', events: [] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const pipeline = {};
        const mockCpu = jest.fn();
        moveExecutor.setUIImpl({
            scheduleCpuTurn: (_delay: number, cb: () => void) => setTimeout(cb, 0),
            processCpuTurn: mockCpu
        });

        await moveExecutor.executeMoveViaPipeline(move, false, playerKey, adapter, pipeline);

        expect(global.isProcessing).toBe(true);
        // Simulate state changed before delayed callback fires.
        global.gameState.currentPlayer = 1;
        jest.runAllTimers();

        expect(mockCpu).not.toHaveBeenCalled();
        expect(global.isProcessing).toBe(false);
    });

    test('scheduled CPU callback follows runtime state when legacy gameState is stale', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)), turnNumber: 12 };
        global.isProcessing = false;

        const moveExecutor = require('../game/move-executor.js');
        installProcessingMirror(moveExecutor);
        const move = { row: 2, col: 3, player: 1 };
        const playerKey = 'black';
        let runtimeGameStateOverride: any = null;

        const fakeRes = {
            ok: true,
            nextGameState: { currentPlayer: -1, turnNumber: 12 },
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'PLAYBACK_EVENTS', events: [] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const pipeline = {};
        const mockCpu = jest.fn();
        const delayedCallbacks: Array<() => void> = [];
        moveExecutor.setUIImpl({
            scheduleCpuTurn: (_delay: number, cb: () => void) => {
                delayedCallbacks.push(cb);
                return delayedCallbacks.length;
            },
            processCpuTurn: mockCpu,
            resolveRuntimeValue: (name: string) => name === 'gameState'
                ? (runtimeGameStateOverride || global.gameState)
                : global[name]
        });

        await moveExecutor.executeMoveViaPipeline(move, false, playerKey, adapter, pipeline);
        expect(delayedCallbacks).toHaveLength(1);

        runtimeGameStateOverride = { currentPlayer: -1, turnNumber: 12 };
        global.gameState.currentPlayer = 1;
        delayedCallbacks[0]();

        expect(mockCpu).toHaveBeenCalledTimes(1);
        expect(global.isProcessing).toBe(false);
    });

    test('missing CPU processor declines scheduling and clears processing', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)), turnNumber: 8 };
        global.isProcessing = false;

        const moveExecutor = require('../game/move-executor.js');
        installProcessingMirror(moveExecutor);
        const move = { row: 2, col: 3, player: 1 };
        const playerKey = 'black';

        const fakeRes = {
            ok: true,
            nextGameState: { currentPlayer: -1, turnNumber: 8 },
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'PLAYBACK_EVENTS', events: [] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };

        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const scheduleCpuTurn = jest.fn((delay, cb) => setTimeout(cb, delay));
        moveExecutor.setUIImpl({ scheduleCpuTurn, processCpuTurn: null });

        await moveExecutor.executeMoveViaPipeline(move, false, playerKey, adapter, {});

        expect(scheduleCpuTurn).not.toHaveBeenCalled();
        expect(global.isProcessing).toBe(false);
        jest.runAllTimers();
        expect(global.isProcessing).toBe(false);
    });

    test('injected match mode suppresses CPU scheduling before legacy global', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.MATCH_MODE = 'cpu';
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)), turnNumber: 9 };
        global.isProcessing = false;

        const moveExecutor = require('../game/move-executor.js');
        installProcessingMirror(moveExecutor);
        const move = { row: 2, col: 3, player: 1 };
        const playerKey = 'black';
        const fakeRes = {
            ok: true,
            nextGameState: { currentPlayer: -1, turnNumber: 9 },
            nextCardState: global.cardState,
            playbackEvents: [{ type: 'PLAYBACK_EVENTS', events: [] }],
            phases: {},
            placementEffects: {},
            immediate: {}
        };
        const adapter = { runTurnWithAdapter: jest.fn(() => fakeRes) };
        const scheduleCpuTurn = jest.fn((delay, cb) => setTimeout(cb, delay));
        const mockCpu = jest.fn();

        moveExecutor.setUIImpl({
            scheduleCpuTurn,
            processCpuTurn: mockCpu,
            readMatchMode: () => 'network',
            readHumanVsHumanMode: () => false
        });

        await moveExecutor.executeMoveViaPipeline(move, false, playerKey, adapter, {});

        expect(scheduleCpuTurn).not.toHaveBeenCalled();
        expect(mockCpu).not.toHaveBeenCalled();
        expect(global.isProcessing).toBe(false);
    });
});
