describe('pass-handler flows', () => {
    import * as path from 'path';
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
        global.MATCH_MODE = 'cpu';
        global.DEBUG_HUMAN_VS_HUMAN = false;
        global.LOCAL_PLAYER_KEY = 'black';
        global.Core = {
            getLegalMoves: jest.fn(() => [])
        };
        delete global.getLegalMoves;
        global.NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: jest.fn()
        };
        // Remove TurnPipeline if exists
        delete global.TurnPipeline;
        delete global.TurnPipelinePhases;
    });

    test('handleBlackPassWhenNoMoves calls applyPassViaPipeline and continues without throwing', async () => {
        // Provide a fake TurnPipeline with applyTurnSafe
        global.TurnPipeline = makeTurnPipeline();
        import * as ph from '../game/pass-handler.js';

        // Call the function and ensure it resolves
        await expect(ph.handleBlackPassWhenNoMoves()).resolves.toBeUndefined();
    });

    test('processPassTurn handles pass and does not throw when TurnPipeline present', async () => {
        global.TurnPipeline = makeTurnPipeline();
        import * as ph from '../game/pass-handler.js';
        await expect(ph.processPassTurn('black', false)).resolves.toBeTruthy();
    });

    test('getLegalMoves 未定義でも handleBlackPassWhenNoMoves が投げない', async () => {
        delete require.cache[modPath];
        delete global.getLegalMoves;
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: global.BLACK };
        global.TurnPipeline = makeTurnPipeline();
        import * as ph from '../game/pass-handler.js';
        await expect(ph.handleBlackPassWhenNoMoves()).resolves.toBeUndefined();
    });

    test('getLegalMoves 未定義でも processPassTurn が投げない', async () => {
        delete require.cache[modPath];
        delete global.getLegalMoves;
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: global.BLACK };
        global.TurnPipeline = makeTurnPipeline();
        import * as ph from '../game/pass-handler.js';
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
        import * as ph from '../game/pass-handler.js';
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
        import * as ph from '../game/pass-handler.js';
        await expect(ph.processPassTurn('black', false)).resolves.toBe(false);
        expect(global.showResult).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は行動可能なら何もしない', () => {
        delete require.cache[modPath];
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect(global.TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は人間ターンでは自動パスしない', () => {
        delete require.cache[modPath];
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect(global.TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は target-selection pending 中なら自動パスしない', () => {
        delete require.cache[modPath];
        global.cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            pendingEffectByPlayer: {
                black: { type: 'GUARD_WILL', stage: 'selectTarget' },
                white: null
            }
        };
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect(global.TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass はCPUターンでは自動パスする', () => {
        delete require.cache[modPath];
        global.gameState = { currentPlayer: global.WHITE };
        global.cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            fateWillControllerByTurnOwner: { black: null, white: null }
        };
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect(global.TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
    });

    test('ensureCurrentPlayerCanActOrPass は人間コントローラーが white 手番を代理操作中なら自動パスしない', () => {
        delete require.cache[modPath];
        global.gameState = { currentPlayer: global.WHITE };
        global.cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            fateWillControllerByTurnOwner: { black: null, white: 'black' }
        };
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect(global.TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は white CPU が black 手番を代理操作中なら owner-keyed に自動パスする', () => {
        delete require.cache[modPath];
        global.gameState = { currentPlayer: global.BLACK };
        global.cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            fateWillControllerByTurnOwner: { black: 'white', white: null }
        };
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect(global.TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
        expect(global.TurnPipeline.applyTurnSafe.mock.calls[0][2]).toBe('black');
    });

    test('network mode では手番プレイヤーでも自動パスしない', () => {
        delete require.cache[modPath];
        global.MATCH_MODE = 'network';
        global.LOCAL_PLAYER_KEY = 'white';
        global.gameState = { currentPlayer: global.WHITE };
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect(global.TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('processPassTurn は次手番が人間で行動不能でも即終局しない', async () => {
        delete require.cache[modPath];
        global.MATCH_MODE = 'network';
        global.LOCAL_PLAYER_KEY = 'black';
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: global.BLACK, turnNumber: 10, consecutivePasses: 0 };
        global.TurnPipeline = {
            applyTurnSafe: jest.fn((cs, gs) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: global.WHITE, turnNumber: 11, consecutivePasses: 1 }),
                cardState: cs,
                events: []
            }))
        };
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const ok = await ph.processPassTurn('black', false);
        expect(ok).toBe(true);
        expect(global.showResult).not.toHaveBeenCalled();
        expect(global.TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
        expect(global.onTurnStart).toHaveBeenCalledWith(global.WHITE);
    });

    test('white CPU scheduling is skipped when state changed before delay callback', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: global.BLACK, turnNumber: 3 };
        global.Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        global.TurnPipeline = makeTurnPipeline();

        import * as ph from '../game/pass-handler.js';
        await ph.processPassTurn('black', false);

        // Before delayed callback executes, state changed away from white turn.
        global.gameState.currentPlayer = global.BLACK;
        jest.runAllTimers();

        expect(global.processCpuTurn).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('white CPU scheduling retries briefly when processCpuTurn becomes available after pass', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        delete global.processCpuTurn;
        global.CPU_TURN_DELAY_MS = 10;
        global.cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        global.gameState = { currentPlayer: global.BLACK, turnNumber: 3 };
        global.Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        global.TurnPipeline = {
            applyTurnSafe: jest.fn((cs, gs) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: global.WHITE, turnNumber: 4 }),
                cardState: cs,
                events: []
            }))
        };

        import * as ph from '../game/pass-handler.js';
        await expect(ph.processPassTurn('black', false)).resolves.toBe(true);

        jest.advanceTimersByTime(10);
        const cpuTurnMock = jest.fn();
        global.processCpuTurn = cpuTurnMock;
        globalThis.processCpuTurn = cpuTurnMock;
        jest.advanceTimersByTime(32);

        expect(cpuTurnMock).toHaveBeenCalledTimes(1);
        delete global.CPU_TURN_DELAY_MS;
        jest.useRealTimers();
    });

    test('network mode と手番の表記揺れを正規化して自動パスを抑止する', () => {
        delete require.cache[modPath];
        global.MATCH_MODE = 'network';
        global.LOCAL_PLAYER_KEY = ' WHITE ';
        global.gameState = { currentPlayer: ' WHITE ' };
        global.TurnPipeline = makeTurnPipeline();
        global.Core = { getLegalMoves: jest.fn(() => []) };
        import * as ph from '../game/pass-handler.js';
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect(global.TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('network pass publish は command payload を送り snapshot を含めない', async () => {
        delete require.cache[modPath];
        global.MATCH_MODE = 'network';
        global.cardState = {
            turnIndex: 3,
            turnCountByPlayer: { black: 1, white: 0 },
            lastTurnStartedFor: 'black',
            hands: { black: ['black_card'], white: [] }
        };
        global.gameState = { currentPlayer: global.BLACK, turnNumber: 7, consecutivePasses: 0 };
        global.TurnPipeline = {
            applyTurnSafe: jest.fn((cs, gs) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: global.WHITE, turnNumber: 8, consecutivePasses: 1 }),
                cardState: Object.assign({}, cs, {
                    turnIndex: 4,
                    turnCountByPlayer: { black: 1, white: 0 },
                    lastTurnStartedFor: 'black',
                    hands: { black: ['black_card'], white: [] }
                }),
                events: []
            }))
        };
        global.getLegalMoves = jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]);
        global.onTurnStart = jest.fn(() => {
            global.cardState.hands.white = ['white_draw'];
            global.cardState.turnIndex = 5;
            global.cardState.turnCountByPlayer.white = 1;
            global.cardState.lastTurnStartedFor = 'white';
        });

        import * as ph from '../game/pass-handler.js';
        const ok = await ph.processPassTurn('black', false);

        expect(ok).toBe(true);
        expect(global.NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);
        const payload = global.NetworkMatchClient.publishSnapshot.mock.calls[0][0];
        expect(payload.snapshot).toBeUndefined();
        expect(payload.action).toEqual({ type: 'pass', playerKey: 'black', turnIndex: 4 });
        expect(global.cardState.hands.white).toEqual(['white_draw']);
    });

    test('pass reject clears processing through PlaybackStateManager when available', async () => {
        delete require.cache[modPath];
        global.isProcessing = true;
        global.PlaybackStateManager = {
            setBusyState: jest.fn()
        };
        global.TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'Illegal pass: legal moves available' }]
            }))
        };
        global.Core = {
            getLegalMoves: jest.fn((state, player) => player === global.BLACK ? [{ row: 0, col: 0, flips: [[0, 1]] }] : [])
        };

        import * as ph from '../game/pass-handler.js';
        await expect(ph.processPassTurn('black', false)).resolves.toBe(false);

        expect(global.PlaybackStateManager.setBusyState).toHaveBeenCalledWith({ processing: false });
        expect(global.isProcessing).toBe(false);
    });
});
