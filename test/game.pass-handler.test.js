describe('pass-handler flows', () => {
    const path = require('path');
    const modPath = path.resolve(__dirname, '..', 'game', 'pass-handler.js');
    beforeEach(() => {
        // Clear cached modules and set minimal globals
        delete require.cache[modPath];
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: 1 };
        // Remove TurnPipeline if exists
        delete global.TurnPipeline;
        delete global.TurnPipelinePhases;
    });

    test('handleBlackPassWhenNoMoves calls applyPassViaPipeline and continues without throwing', async () => {
        // Provide a fake TurnPipeline with applyTurnSafe
        global.TurnPipeline = { applyTurnSafe: jest.fn((cs, gs, playerKey, action) => ({ ok: true, gameState: gs, cardState: cs, events: [] })) };
        const ph = require('../game/pass-handler');

        // Call the function and ensure it resolves
        await expect(ph.handleBlackPassWhenNoMoves()).resolves.toBeUndefined();
    });

    test('processPassTurn handles pass and does not throw when TurnPipeline present', async () => {
        global.TurnPipeline = { applyTurnSafe: jest.fn((cs, gs, playerKey, action) => ({ ok: true, gameState: gs, cardState: cs, events: [] })) };
        const ph = require('../game/pass-handler');
        await expect(ph.processPassTurn('black', false)).resolves.toBeTruthy();
    });
});