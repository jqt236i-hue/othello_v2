describe('move-executor presentation emission', () => {
    const modPath = require.resolve('../game/move-executor');
    beforeEach(() => {
        // clear module cache
        delete require.cache[modPath];
        // reset globals
        delete global.BoardOps;
        delete global.PresentationHelper;
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
});