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
        readNetworkSeatKey: () => {
            const client = (global as any).NetworkMatchClient;
            if (client && typeof client.getSeatKey === 'function') return client.getSeatKey();
            return (global as any).LOCAL_PLAYER_KEY;
        },
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
            getSeatKey: jest.fn(() => (global as any).LOCAL_PLAYER_KEY),
            publishSnapshot: jest.fn()
        };
        delete (global as any).CardLogic;
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

    test('pass rejected でも両者行動不能なら実際のパス遷移で終局へ進める', async () => {
        delete require.cache[modPath];
        const applyPass = jest.fn((state: any) => ({
            ...state,
            currentPlayer: -state.currentPlayer,
            consecutivePasses: (Number.isFinite(Number(state.consecutivePasses)) ? Number(state.consecutivePasses) : 0) + 1,
            turnNumber: (Number.isFinite(Number(state.turnNumber)) ? Number(state.turnNumber) : 0) + 1
        }));
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'stale pass rejection' }]
            }))
        };
        (global as any).Core = {
            getLegalMoves: jest.fn(() => []),
            applyPass
        };
        (global as any).cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            pendingEffectByPlayer: { black: null, white: null }
        };
        (global as any).gameState = {
            currentPlayer: (global as any).BLACK,
            consecutivePasses: 0,
            turnNumber: 7
        };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);

        await expect(ph.processPassTurn('black', false)).resolves.toBe(true);

        expect(applyPass).toHaveBeenCalledTimes(2);
        expect((global as any).showResult).toHaveBeenCalledTimes(1);
        expect((global as any).gameState).toEqual(expect.objectContaining({
            currentPlayer: (global as any).BLACK,
            consecutivePasses: 2,
            turnNumber: 9
        }));
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

    test('pass rejected かつ未解決pendingがあれば終局救済しない', async () => {
        delete require.cache[modPath];
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn(() => ({
                ok: false,
                events: [{ type: 'action_rejected', reason: 'ILLEGAL_PASS', message: 'pending action remains' }]
            }))
        };
        (global as any).Core = {
            getLegalMoves: jest.fn(() => []),
            applyPass: jest.fn((state: any) => ({
                ...state,
                currentPlayer: -state.currentPlayer,
                consecutivePasses: (Number(state.consecutivePasses) || 0) + 1
            }))
        };
        (global as any).cardState = {
            turnIndex: 0,
            turnCountByPlayer: { black: 0, white: 0 },
            hands: { black: [], white: [] },
            pendingEffectByPlayer: {
                black: { type: 'DESTROY_ONE_STONE', stage: 'selectTarget' },
                white: null
            }
        };
        (global as any).gameState = {
            currentPlayer: (global as any).BLACK,
            consecutivePasses: 0,
            turnNumber: 7
        };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);

        await expect(ph.processPassTurn('black', false)).resolves.toBe(false);

        expect((global as any).showResult).not.toHaveBeenCalled();
        expect((global as any).Core.applyPass).not.toHaveBeenCalled();
        expect((global as any).gameState.consecutivePasses).toBe(0);
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

    test('ensureCurrentPlayerCanActOrPass は人間ターンでも行動不能なら自動パスする', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        try {
            const ph = require('../game/pass-handler');
            injectPassHandlerFakeTimerService(ph);
            injectPassHandlerRuntimeFromGlobals(ph);
            const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
            expect(handled).toBe(true);
            expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
            await jest.runOnlyPendingTimersAsync();
            expect((global as any).TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
        }
    });

    test('ensureCurrentPlayerCanActOrPass は使用可能カードがあれば人間ターンを自動パスしない', () => {
        delete require.cache[modPath];
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        (global as any).CardLogic = { hasUsableCard: jest.fn(() => true) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).CardLogic.hasUsableCard).toHaveBeenCalledWith(
            (global as any).cardState,
            (global as any).gameState,
            'black'
        );
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

    test('ensureCurrentPlayerCanActOrPass は人間コントローラーが white 手番を代理操作中でも行動不能なら自動パスする', () => {
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
        expect(handled).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).toHaveBeenCalledTimes(1);
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

    test('network mode でも手番プレイヤーが行動不能なら pass command を送る', () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'white';
        (global as any).gameState = { currentPlayer: (global as any).WHITE };
        (global as any).cardState = { turnIndex: 4, turnCountByPlayer: { black: 0, white: 1 }, hands: { black: [], white: [] } };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            playerKey: 'white',
            actionType: 'pass',
            action: { type: 'pass', playerKey: 'white', turnIndex: 4 },
            playbackEvents: []
        }));
    });

    test('network mode の black 手番自動パスは black delay ではなく pass command を送る', () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'black';
        (global as any).gameState = { currentPlayer: (global as any).BLACK };
        (global as any).cardState = { turnIndex: 5, turnCountByPlayer: { black: 1, white: 1 }, hands: { black: [], white: [] } };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            playerKey: 'black',
            actionType: 'pass',
            action: { type: 'pass', playerKey: 'black', turnIndex: 5 },
            playbackEvents: []
        }));
    });

    test('network mode では非手番側クライアントが自動 pass command を送らない', () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'white';
        (global as any).gameState = { currentPlayer: (global as any).BLACK };
        (global as any).cardState = { turnIndex: 5, turnCountByPlayer: { black: 1, white: 1 }, hands: { black: [], white: [] } };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(false);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect((global as any).NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();
    });

    test('network processPassTurn は次手番へローカル遷移せず pass command を送る', async () => {
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
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect((global as any).onTurnStart).not.toHaveBeenCalled();
        expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            playerKey: 'black',
            actionType: 'pass',
            action: { type: 'pass', playerKey: 'black', turnIndex: 0 },
            playbackEvents: []
        }));
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

    test('white CPU scheduling clears processing before invoking CPU after pass', async () => {
        jest.useFakeTimers();
        delete require.cache[modPath];
        const processingStates: boolean[] = [];
        (global as any).processCpuTurn = jest.fn(() => {
            processingStates.push((global as any).isProcessing === true);
        });
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
            injectPassHandlerRuntimeFromGlobals(ph);

            await expect(ph.processPassTurn('black', false)).resolves.toBe(true);
            expect((global as any).isProcessing).toBe(true);

            await jest.runOnlyPendingTimersAsync();

            expect((global as any).processCpuTurn).toHaveBeenCalledTimes(1);
            expect(processingStates).toEqual([false]);
            expect((global as any).isProcessing).toBe(false);
        } finally {
            jest.clearAllTimers();
            jest.useRealTimers();
            delete (global as any).CPU_TURN_DELAY_MS;
        }
    });

    test('network mode と手番の表記揺れを正規化して自動 pass command を送る', () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = ' WHITE ';
        (global as any).gameState = { currentPlayer: ' WHITE ' };
        (global as any).cardState = { turnIndex: 6, turnCountByPlayer: { black: 0, white: 2 }, hands: { black: [], white: [] } };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = { getLegalMoves: jest.fn(() => []) };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            playerKey: 'white',
            actionType: 'pass',
            action: { type: 'pass', playerKey: 'white', turnIndex: 6 },
            playbackEvents: []
        }));
    });

    test('network mode は配置ロック中の合法手を行動可能扱いせず pass command を送る', () => {
        delete require.cache[modPath];
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'white';
        (global as any).gameState = { currentPlayer: (global as any).WHITE };
        (global as any).cardState = { turnIndex: 8, turnCountByPlayer: { black: 2, white: 2 }, hands: { black: [], white: [] } };
        (global as any).TurnPipeline = makeTurnPipeline();
        (global as any).Core = {
            getLegalMoves: jest.fn(() => [{ row: 2, col: 3, flips: [[3, 3]] }])
        };
        (global as any).CardLogic = {
            getCardContext: jest.fn(() => ({})),
            hasUsableCard: jest.fn(() => false),
            isPlacementLockedForPlayer: jest.fn(() => true)
        };
        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const handled = ph.ensureCurrentPlayerCanActOrPass({ useBlackDelay: true });
        expect(handled).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
            playerKey: 'white',
            actionType: 'pass',
            action: { type: 'pass', playerKey: 'white', turnIndex: 8 },
            playbackEvents: []
        }));
    });

    test('network pass publish はローカル適用せず現在 turnIndex の command を送る', async () => {
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
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect(publishSnapshotMock).toHaveBeenCalledTimes(1);
        const payload = publishSnapshotMock.mock.calls[0][0];
        expect(payload.snapshot).toBeUndefined();
        expect(payload).toEqual(expect.objectContaining({
            playerKey: 'black',
            actionType: 'pass',
            playbackEvents: []
        }));
        expect(payload.action).toEqual({ type: 'pass', playerKey: 'black', turnIndex: 3 });
        expect((global as any).cardState.turnIndex).toBe(3);
        expect((global as any).cardState.hands.white).toEqual([]);
    });

    test('network FATE_WILL pass publish は controller seat を actor に使う', async () => {
        delete require.cache[modPath];
        const publishSnapshotMock = jest.fn();
        (global as any).MATCH_MODE = 'network';
        (global as any).LOCAL_PLAYER_KEY = 'black';
        (global as any).cardState = {
            turnIndex: 3,
            turnCountByPlayer: { black: 1, white: 0 },
            lastTurnStartedFor: 'white',
            fateWillControllerByTurnOwner: { black: null, white: 'black' },
            hands: { black: ['black_card'], white: ['white_card'] }
        };
        (global as any).gameState = { currentPlayer: (global as any).WHITE, turnNumber: 7, consecutivePasses: 0 };
        (global as any).TurnPipeline = {
            applyTurnSafe: jest.fn((cs: any, gs: any) => ({
                ok: true,
                gameState: Object.assign({}, gs, { currentPlayer: (global as any).BLACK, turnNumber: 8, consecutivePasses: 1 }),
                cardState: Object.assign({}, cs, {
                    turnIndex: 4,
                    turnCountByPlayer: { black: 1, white: 0 },
                    lastTurnStartedFor: 'white',
                    fateWillControllerByTurnOwner: { black: null, white: 'black' },
                    hands: { black: ['black_card'], white: ['white_card'] }
                }),
                events: []
            }))
        };
        (global as any).getLegalMoves = jest.fn(() => [{ row: 0, col: 0, flips: [[0, 1]] }]);
        (global as any).onTurnStart = jest.fn(() => {
            (global as any).cardState.hands.black = ['black_card', 'black_draw'];
            (global as any).cardState.turnIndex = 5;
            (global as any).cardState.turnCountByPlayer.black = 2;
            (global as any).cardState.lastTurnStartedFor = 'black';
        });
        (global as any).NetworkMatchClient = {
            isActive: jest.fn(() => true),
            publishSnapshot: publishSnapshotMock
        };

        const ph = require('../game/pass-handler');
        injectPassHandlerRuntimeFromGlobals(ph);
        const ok = await ph.processPassTurn('black', false);

        expect(ok).toBe(true);
        expect((global as any).TurnPipeline.applyTurnSafe).not.toHaveBeenCalled();
        expect(publishSnapshotMock).toHaveBeenCalledTimes(1);
        const payload = publishSnapshotMock.mock.calls[0][0];
        expect(payload.playerKey).toBe('black');
        expect(payload.action).toEqual({ type: 'pass', playerKey: 'black', turnIndex: 3 });
        expect((global as any).cardState.hands.black).toEqual(['black_card']);
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
