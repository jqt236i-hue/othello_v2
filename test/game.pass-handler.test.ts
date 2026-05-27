import * as path from 'path';

const modPath = path.resolve(__dirname, '..', 'game', 'pass-handler.js');

const makeTurnPipeline = () => ({
    applyTurnSafe: jest.fn((cs: any, gs: any) => ({
        ok: true,
        gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE }),
        cardState: cs,
        events: []
    }))
});

const injectPassHandlerRuntimeFromGlobals = (ph: any) => {
    ph.setPassHandlerRuntime({
        processCpuTurn: (global as any).processCpuTurn,
        readMatchMode: () => (global as any).MATCH_MODE,
        readHumanVsHumanMode: () => (global as any).DEBUG_HUMAN_VS_HUMAN === true,
        resolveRuntimeFunction: (name: string) => {
            const candidate = (global as any)[name];
            return typeof candidate === 'function' ? candidate : null;
        },
        showResult: () => (global as any).showResult(),
        setProcessing: (next: boolean) => {
            (global as any).isProcessing = next === true;
            const playbackState = (global as any).PlaybackStateManager;
            if (playbackState && typeof playbackState.setBusyState === 'function') {
                playbackState.setBusyState({ processing: next === true });
            }
        },
        publishSnapshot: (meta: any) => {
            const client = (global as any).NetworkMatchClient;
            if (!client || typeof client.publishSnapshot !== 'function') return undefined;
            if (typeof client.isActive === 'function' && !client.isActive()) return undefined;
            return client.publishSnapshot(meta);
        }
    });
};

const injectPassHandlerFakeTimerService = (ph: any) => {
    ph.setPassHandlerTimerService({
        setTimeout: (callback: () => void, delay: number) => setTimeout(callback, delay),
        clearTimeout: (id: any) => clearTimeout(id)
    });
};

describe('pass-handler flows', () => {
    beforeEach(() => {
        jest.resetModules();
        // Clear cached modules and set minimal globals
        delete require.cache[modPath];
        (global as any).BLACK = 1;
        (global as any).WHITE = -1;
        (global as any).processCpuTurn = jest.fn();
        (global as any).onTurnStart = jest.fn();
        (global as any).showResult = jest.fn();
        (global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        (global as any).gameState = { currentPlayer: 1 };
        (global as any).MATCH_MODE = 'cpu';
        (global as any).DEBUG_HUMAN_VS_HUMAN = false;
        (global as any).LOCAL_PLAYER_KEY = 'black';
        (global as any).Core = {
            getLegalMoves: jest.fn(() => [])
        };
        delete (global as any).getLegalMoves;
        (global as any).NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: jest.fn()
        };
        // Remove TurnPipeline if exists
        delete (global as any).TurnPipeline;
        delete (global as any).TurnPipelinePhases;
        // Reset isProcessing
        (global as any).isProcessing = false;
    });

    test('handleBlackPassWhenNoMoves calls applyPassViaPipeline and continues without throwing', async () => {
        jest.useFakeTimers();
        // Provide a fake TurnPipeline with applyTurnSafe that advances to white turn
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE }),
                cardState: cs,
                events: []
            }))
        };
        try {
            const ph = require('../game/pass-handler');
            injectPassHandlerFakeTimerService(ph);

            // Call the function and ensure the delayed pass path resolves.
            await expect(ph.handleBlackPassWhenNoMoves()).resolves.toBeUndefined();
            await jest.runOnlyPendingTimersAsync();

            expect((global as any).TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    test('processPassTurn handles pass and does not throw when TurnPipeline present', async () => {
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE }),
                cardState: cs,
                events: []
            }))
        };
        const ph = require('../game/pass-handler');
        await expect(ph.processPassTurn('black', false)).resolves.toBeTruthy();
    });

    test('getLegalMoves 未定義でも handleBlackPassWhenNoMoves が投げない', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        delete (global as any).getLegalMoves;
        (global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        (global as any).gameState = { currentPlayer: (global as any).BLACK };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE }),
                cardState: cs,
                events: []
            }))
        };
        try {
            const ph = require('../game/pass-handler');
            injectPassHandlerFakeTimerService(ph);
            await expect(ph.handleBlackPassWhenNoMoves()).resolves.toBeUndefined();
            await jest.runOnlyPendingTimersAsync();

            expect((global as any).TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    test('getLegalMoves 未定義でも processPassTurn が投げない', async () => {
        delete require.cache[modPath];
        delete (global as any).getLegalMoves;
        (global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        (global as any).gameState = { currentPlayer: (global as any).BLACK };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE }),
                cardState: cs,
                events: []
            }))
        };
        const ph = require('../game/pass-handler');
        await expect(ph.processPassTurn('black', false)).resolves.toBeTruthy();
    });

    test('pass rejected でも両者行動不能なら終局表示する', async () => {
        delete require.cache[modPath];
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'Illegal pass: usable card available' }]
            }))
        };
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        // Ensure both players have no moves so finalizeNoActionTerminal triggers
        (global as any).cardState = { 
            turnIndex: 0, 
            turnCountByPlayer: { black: 0, white: 0 }, 
            hands: { black: [], white: [] } 
        };
        (global as any).gameState = { currentPlayer: (global as any).BLACK };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        await expect(ph.processPassTurn('black', false)).resolves.toBe(true);
        expect((global as any).showResult).toHaveBeenCalledTimes(1);
        expect((global as any).gameState.consecutivePasses).toBe(2);
    });

    test('pass rejected かつ行動可能なら終局表示しない', async () => {
        delete require.cache[modPath];
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'Illegal pass: legal moves available' }]
            }))
        };
        (global as any).Core = {
            getLegalMoves: jest.fn((state: any, player: any) => player === (global as any).BLACK ? [{ row: 0, col: 0, flips: [[0, 1]] }] : [])
        };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        await expect(ph.processPassTurn('black', false)).resolves.toBe(false);
        expect((global as any).showResult).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は行動可能なら何もしない', () => {
        delete require.cache[modPath];
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        const ph = require('../game/pass-handler');
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は人間ターンでは自動パスしない', () => {
        delete require.cache[modPath];
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は target-selection pending 中なら自動パスしない', () => {
        delete require.cache[modPath];
        (global as any).cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            pendingEffectByPlayer: {
                black: { type: 'GUARD_WILL', stage: 'selectTarget' },
                white: null
            }
        };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass はCPUターンでは自動パスする', () => {
        delete require.cache[modPath];
        (global as any).gameState = { currentPlayer: (global as any).WHITE };
        (global as any).cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            fateWillControllerByTurnOwner: { black: null, white: null }
        };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
    });

    test('ensureCurrentPlayerCanActOrPass は人間コントローラーが white 手番を代理操作中なら自動パスしない', () => {
        delete require.cache[modPath];
        (global as any).gameState = { currentPlayer: (global as any).WHITE };
        (global as any).cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            fateWillControllerByTurnOwner: { black: null, white: 'black' }
        };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('ensureCurrentPlayerCanActOrPass は white CPU が black 手番を代理操作中なら owner-keyed に自動パスする', () => {
        delete require.cache[modPath];
        (global as any).gameState = { currentPlayer: (global as any).BLACK };
        (global as any).cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            fateWillControllerByTurnOwner: { black: 'white', white: null }
        };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: false });
        expect(handled).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
        expect((global as any).TurnPipeline.applyTurnSafe.mock.calls[0][2]).toBe('black');
    });

    test('network mode では手番プレイヤーでも自動パスしない', () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'white';
        (global as any).gameState = { currentPlayer: (global as any).WHITE };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('processPassTurn は次手番が人間で行動不能でも即終局しない', async () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'black';
        (global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        (global as any).gameState = { currentPlayer: (global as any).BLACK, turnNumber: 10, consecutivePasses: 0 };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE, turnNumber: 11, consecutivePasses: 1 }),
                cardState: cs,
                events: []
            }))
        };
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const ok = await ph.processPassTurn('black', false);
        expect(ok).toBe(true);
        expect((global as any).showResult).not.toHaveBeenCalled();
        expect((global as any).TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
        expect((global as any).onTurnStart).toHaveBeenCalledWith((global as any).WHITE);
    });

    test('white CPU scheduling is skipped when state changed before delay callback', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        const cpuTurnMock = jest.fn();
        (global as any).processCpuTurn = cpuTurnMock;
        (global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        (global as any).gameState = { currentPlayer: (global as any).BLACK, turnNumber: 3 };
        (global as any).Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE, turnNumber: 4 }),
                cardState: cs,
                events: []
            }))
        };

        const ph = require('../game/pass-handler');
        injectPassHandlerFakeTimerService(ph);
        await ph.processPassTurn('black', false);

        // Before delayed callback executes, state changed away from white turn.
        (global as any).gameState.currentPlayer = (global as any).BLACK;
        jest.runAllTimers();

        expect(cpuTurnMock).not.toHaveBeenCalled();
        jest.useRealTimers();
    });

    test('white CPU scheduling retries briefly when processCpuTurn becomes available after pass', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        const cpuTurnMock = jest.fn();
        (global as any).processCpuTurn = cpuTurnMock;
        (global as any).CPU_TURN_DELAY_MS = 10;
        (global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        (global as any).gameState = { currentPlayer: (global as any).BLACK, turnNumber: 3 };
        (global as any).Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        // Ensure Core is available to the module
        (globalThis as any).Core = (global as any).Core;
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE, turnNumber: 4 }),
                cardState: cs,
                events: []
            }))
        };

        try {
            const ph = require('../game/pass-handler');
            injectPassHandlerFakeTimerService(ph);
            await expect(ph.processPassTurn('black', false)).resolves.toBe(true);

            // Check that gameState was updated to white's turn
            expect((global as any).gameState.currentPlayer).toBe((global as any).WHITE);

            // The CPU turn should be scheduled, but it must not fire before time advances.
            expect(cpuTurnMock).not.toHaveBeenCalled();
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
            delete (global as any).CPU_TURN_DELAY_MS;
        }
    });

    test('white CPU scheduling uses injected processCpuTurn before legacy global', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        const legacyCpuTurnMock = jest.fn();
        const injectedCpuTurnMock = jest.fn();
        (global as any).processCpuTurn = legacyCpuTurnMock;
        (global as any).CPU_TURN_DELAY_MS = 10;
        (global as any).cardState = { turnIndex: 0, turnCountByPlayer: { black: 0, white: 0 }, hands: { black: [], white: [] } };
        (global as any).gameState = { currentPlayer: (global as any).BLACK, turnNumber: 3 };
        (global as any).Core = { getLegalMoves: jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]) };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE, turnNumber: 4 }),
                cardState: cs,
                events: []
            }))
        };

        try {
            const ph = require('../game/pass-handler');
            injectPassHandlerFakeTimerService(ph);
            ph.setPassHandlerRuntime({
                processCpuTurn: injectedCpuTurnMock,
                readMatchMode: () => 'cpu',
                readHumanVsHumanMode: () => false
            });

            await expect(ph.processPassTurn('black', false)).resolves.toBe(true);
            await jest.runOnlyPendingTimersAsync();

            expect(injectedCpuTurnMock).toHaveBeenCalledTimes(1);
            expect(legacyCpuTurnMock).not.toHaveBeenCalled();
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
            delete (global as any).CPU_TURN_DELAY_MS;
        }
    });

    test('network mode と手番の表記揺れを正規化して自動パスを抑止する', () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = ' WHITE ';
        (global as any).gameState = { currentPlayer: ' WHITE ' };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
    });

    test('network pass publish は command payload を送り snapshot を含めない', async () => {
        delete require.cache[modPath];
        const publishSnapshotMock = jest.fn();
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'black';
        (global as any).cardState = {
            turnIndex: 3,
            turnCountByPlayer: { black: 1, white: 0 },
            lastTurnStartedFor: 'black',
            hands: { black: ['black_card'], white: [] }
        };
        (global as any).gameState = { currentPlayer: (global as any).BLACK, turnNumber: 7, consecutivePasses: 0 };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).WHITE, turnNumber: 8, consecutivePasses: 1 }),
                cardState: Object.assign({}, cs, {
                    turnIndex: 4,
                    turnCountByPlayer: { black: 1, white: 0 },
                    lastTurnStartedFor: 'black',
                    hands: { black: ['black_card'], white: [] }
                }),
                events: []
            }))
        };
        (global as any).getLegalMoves = jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]);
        (global as any).onTurnStart = jest.fn(() => {
            (global as any).cardState.hands.white = ['white_draw'];
            (global as any).cardState.turnIndex = 5;
            (global as any).cardState.turnCountByPlayer.white = 1;
            (global as any).cardState.lastTurnStartedFor = 'white';
        });

        (global as any).NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: publishSnapshotMock
        };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const ok = await ph.processPassTurn('black', false);

        expect(ok).toBe(true);
        expect(publishSnapshotMock).toHaveBeenCalledTimes(1);
        const payload = publishSnapshotMock.mock.calls[0][0];
        expect(payload.snapshot).toBeUndefined();
        expect(payload.action).toEqual({ type: 'pass', playerKey: 'black', turnIndex: 4 });
        expect((global as any).cardState.hands.white).toEqual(['white_draw']);
    });

    test('pass reject clears processing through runtime bridge', async () => {
        delete require.cache[modPath];
        const setBusyStateMock = jest.fn();
        (global as any).isProcessing = true;
        (global as any).PlaybackStateManager = {
            setBusyState: setBusyStateMock
        };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'Illegal pass: legal moves available' }]
            }))
        };
        (global as any).Core = {
            getLegalMoves: jest.fn((state: any, player: any) => player === (global as any).BLACK ? [{ row: 0, col: 0, flips: [[0, 1]] }] : [])
        };

        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        await expect(ph.processPassTurn('black', false)).resolves.toBe(false);

        expect(setBusyStateMock).toHaveBeenCalledWith({ processing: false });
        expect((global as any).isProcessing).toBe(false);
    });
});
