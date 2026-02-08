describe('pass-handler flows', () => {
    const path = require('path');
    const modPath = path.resolve(__dirname, '..', 'game', 'pass-handler.js');
    const timersPath = path.resolve(__dirname, '..', 'game', 'timers.js');
    const makeTurnPipeline = () => ({
        applyTurnSafe: jest.fn((cs, gs) => ({
            ok: true,
            gameState: Object.assign({}, gs, { currentPlayer: global.WHITE }),
            cardState: cs,
            events: []
        }))
    });
    beforeEach(() => {
        jest.resetModules();
        jest.doMock(timersPath, () => null, { virtual: false });
        // Clear cached modules and set minimal globals
        delete require.cache[modPath];
        global.BLACK = 1;
        global.WHITE = -1;
        global.processCpuTurn = jest.fn();
        global.onTurnStart = jest.fn();
        global.showResult = jest.fn();
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: 1 };
        global.Core = {
            getLegalMoves: jest.fn(() => [])
        };
        // Remove TurnPipeline if exists
        delete global.TurnPipeline;
        delete global.TurnPipelinePhases;
    });

    test('handleBlackPassWhenNoMoves calls applyPassViaPipeline and continues without throwing', async () => {
        // Provide a fake TurnPipeline with applyTurnSafe
        global.TurnPipeline = makeTurnPipeline();
        const ph = require('../game/pass-handler');

        // Call the function and ensure it resolves
        await expect(ph.handleBlackPassWhenNoMoves()).resolves.toBeUndefined();
    });

    test('processPassTurn handles pass and does not throw when TurnPipeline present', async () => {
        global.TurnPipeline = makeTurnPipeline();
        const ph = require('../game/pass-handler');
        await expect(ph.processPassTurn('black', false)).resolves.toBeTruthy();
    });

    test('getLegalMoves 未定義でも handleBlackPassWhenNoMoves が投げない', async () => {
        delete require.cache[modPath];
        delete global.getLegalMoves;
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: global.BLACK };
        global.TurnPipeline = makeTurnPipeline();
        const ph = require('../game/pass-handler');
        await expect(ph.handleBlackPassWhenNoMoves()).resolves.toBeUndefined();
    });

    test('getLegalMoves 未定義でも processPassTurn が投げない', async () => {
        delete require.cache[modPath];
        delete global.getLegalMoves;
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: global.BLACK };
        global.TurnPipeline = makeTurnPipeline();
        const ph = require('../game/pass-handler');
        await expect(ph.processPassTurn('black', false)).resolves.toBeTruthy();
    });

    test('pass rejected でも両者行動不能なら終局表示する', async () => {
        delete require.cache[modPath];
        global.TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'Illegal pass: usable card available' }]
            }))
        };
        global.Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        await expect(ph.processPassTurn('black', false)).resolves.toBe(true);
        expect(global.showResult).toHaveBeenCalledTimes(1);
        expect(global.gameState.consecutivePasses).toBe(2);
    });

    test('pass rejected かつ行動可能なら終局表示しない', async () => {
        delete require.cache[modPath];
        global.TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'Illegal pass: legal moves available' }]
            }))
        };
        global.Core = {
            getLegalMoves: jest.fn((state, player) => player === global.BLACK ? [{ row: 0, col: 0, flips: [[0, 1]] }] : [])
        };
        const ph = require('../game/pass-handler');
        await expect(ph.processPassTurn('black', false)).resolves.toBe(false);
        expect(global.showResult).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は行動可能なら何もしない', () => {
        delete require.cache[modPath];
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        const ph = require('../game/pass-handler');
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect(global.TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は行動不能ならパス処理を起動する', () => {
        delete require.cache[modPath];
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect(global.TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
    });
});
