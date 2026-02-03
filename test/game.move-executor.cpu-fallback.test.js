jest.useFakeTimers();

describe('move-executor CPU scheduling fallback', () => {
    const modPath = require.resolve('../game/move-executor');
    beforeEach(() => {
        delete require.cache[modPath];
        delete global.BoardOps;
        delete global.PresentationHelper;
        delete global.processCpuTurn;
        global.WHITE = -1;
    });

    test('when UI scheduler is absent but global processCpuTurn exists, it is used', async () => {
        global.BoardOps = { emitPresentationEvent: jest.fn() };
        global.cardState = { pendingEffectByPlayer: { black: null, white: null }, turnIndex: 0 };
        // nextGameState currentPlayer should be WHITE to force CPU scheduling
        global.gameState = { currentPlayer: 1, board: Array(8).fill().map(() => Array(8).fill(0)) };

        const moveExecutor = require('../game/move-executor');

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
        global.processCpuTurn = mockCpu;

        // Act
        await moveExecutor.executeMoveViaPipeline(move, false, playerKey, adapter, pipeline);

        // Fast-forward timers used for CPU delay
        jest.runAllTimers();

        expect(mockCpu).toHaveBeenCalled();
    });
});
