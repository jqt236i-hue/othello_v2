const runtime: Record<string, any> = globalThis;

function deferred<T = void>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}

describe.each(['lv10', 'lv11', 'lv12', 'lv13', 'comparison'])('%s turn completion owns its asynchronous request', (mode) => {
    let handler: any;
    beforeEach(() => {
        jest.resetModules();
        const Core = require('../game/logic/core');
        const Cards = require('../game/logic/cards');
        Object.assign(runtime, { BLACK: 1, WHITE: -1, MATCH_MODE: 'cpu',
            cpuSmartness: { black: 9, white: mode === 'lv13' ? '13-truth-chaos-emperor-beast' : mode === 'lv12' ? '12-strategy-cpu' : mode === 'lv11' ? '11-execution-chaos-dragon' : mode === 'lv10' ? '10-observed-dark-dragon' : '9-ending-ash' },
            isProcessing: false, isCardAnimating: false, VisualPlaybackActive: false,
            isGameOver: () => false, isDebugLogAvailable: () => false,
            gameState: Core.createGameState(), cardState: Cards.createCardState() });
        runtime.gameState.currentPlayer = -1;
        runtime.cardState.lastTurnStartedFor = 'white';
        handler = require('../game/cpu-turn-handler.js');
        handler.setTimers({ waitMs: () => new Promise(() => {}) });
        handler.setCpuUIImpl({
            readBenchFastMode: () => mode === 'comparison',
            resolveRuntimeValue: (name: string) => runtime[name],
            setProcessing: (next: boolean) => { runtime.isProcessing = next; },
            generateMovesForPlayer: () => Core.getLegalMoves(runtime.gameState, -1)
        });
    });
    afterEach(() => {
        handler.resetCpuTurnHandlerState();
        handler.setTimers(null);
        handler.setCpuUIImpl({});
        for (const name of ['BLACK', 'WHITE', 'MATCH_MODE', 'cpuSmartness', 'isProcessing',
            'isCardAnimating', 'VisualPlaybackActive', 'isGameOver', 'isDebugLogAvailable', 'gameState', 'cardState']) delete runtime[name];
    });

    test('clearing the presentation flag cannot queue another search or extra action', async () => {
        const Core = require('../game/logic/core');
        const move = Core.getLegalMoves(runtime.gameState, -1)[0];
        const advice = deferred<any>(), applying = deferred(), finishApply = deferred();
        const advise = jest.fn(() => advice.promise);
        const executeMove = jest.fn(async () => {
            runtime.isProcessing = false;
            applying.resolve();
            await finishApply.promise;
            return { ok: true };
        });
        handler.setCpuUIImpl({ [mode === 'lv13' ? 'adviseLv13InWorker' : mode === 'lv12' ? 'adviseLv12InWorker' : mode === 'lv11' ? 'adviseLv11InWorker' : mode === 'lv10' ? 'adviseLv10InWorker' : 'adviseComparisonOpponent']: advise, executeMove });
        const first = handler.runCpuTurn('white');
        try {
            expect(advise).toHaveBeenCalledTimes(1);
            runtime.isProcessing = false;
            void handler.runCpuTurn('white');
            expect(advise).toHaveBeenCalledTimes(1);
            advice.resolve({ version: 'test', action: { type: 'place', row: move.row, col: move.col },
                continuation: [], transitions: 1 });
            await applying.promise;
            void handler.runCpuTurn('white');
            expect(advise).toHaveBeenCalledTimes(1);
            expect(executeMove).toHaveBeenCalledTimes(1);
            finishApply.resolve();
            await first;
            await handler.runCpuTurn('white');
            expect(advise).toHaveBeenCalledTimes(2);
            expect(executeMove).toHaveBeenCalledTimes(2);
        } finally {
            advice.resolve({ version: 'test', action: null, continuation: [], transitions: 0 });
            finishApply.resolve();
            await first;
        }
    });

    test('an action exception releases exclusivity for the next legal retry', async () => {
        const Core = require('../game/logic/core');
        const move = Core.getLegalMoves(runtime.gameState, -1)[0];
        const advise = jest.fn(async () => ({ version: 'test', action: { type: 'place', row: move.row, col: move.col },
            continuation: [], transitions: 1 }));
        const executeMove = jest.fn().mockRejectedValueOnce(new Error('failed presentation')).mockResolvedValue({ ok: true });
        handler.setCpuUIImpl({ [mode === 'lv13' ? 'adviseLv13InWorker' : mode === 'lv12' ? 'adviseLv12InWorker' : mode === 'lv11' ? 'adviseLv11InWorker' : mode === 'lv10' ? 'adviseLv10InWorker' : 'adviseComparisonOpponent']: advise, executeMove, emitLogAdded: () => {} });
        const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
        try {
            await handler.runCpuTurn('white');
            await handler.runCpuTurn('white');
            expect(advise).toHaveBeenCalledTimes(2);
            expect(executeMove).toHaveBeenCalledTimes(2);
        } finally { consoleError.mockRestore(); }
    });
});
