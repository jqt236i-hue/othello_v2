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
    function installProcessingMirror(moveExecutor: any) {
        moveExecutor.setUIImpl({
            setProcessing: (next: boolean) => {
                global.isProcessing = next === true;
            }
        });
    }

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
