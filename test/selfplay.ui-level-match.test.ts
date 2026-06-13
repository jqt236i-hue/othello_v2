const {
    parseArgs,
    applyBenchmarkModeBeforeInit,
    applyBenchmarkModeAfterInit,
    buildFailureSnapshot
} = require('../scripts/run-ui-level-match');

describe('ui level match script args', () => {
    test('parseArgs accepts seed and levels', () => {
        const args = parseArgs([
            '--black', '6',
            '--white', '5',
            '--seed', '12345',
            '--timeout-ms', '200000',
            '--out', 'data/runs/level-match.test.json'
        ]);
        expect(args.black).toBe(6);
        expect(args.white).toBe(5);
        expect(args.seed).toBe(12345);
        expect(args.timeoutMs).toBe(200000);
    });

    test('parseArgs validates seed and timeout', () => {
        expect(() => parseArgs(['--seed', 'nan'])).toThrow('--seed must be a number');
        expect(() => parseArgs(['--timeout-ms', '999'])).toThrow('--timeout-ms must be >= 1000');
    });

    test('parseArgs accepts auxiliary ONNX wait requirements', () => {
        const args = parseArgs([
            '--require-onnx-loaded',
            '--require-target-model-loaded',
            '--require-value-model-loaded'
        ]);

        expect(args.requireOnnxLoaded).toBe(true);
        expect(args.requireTargetModelLoaded).toBe(true);
        expect(args.requireValueModelLoaded).toBe(true);
    });

    test('pre-init benchmark mode keeps timer functions untouched', () => {
        const setTimeoutFn = jest.fn();
        const setIntervalFn = jest.fn();
        const root = {
            setTimeout: setTimeoutFn,
            setInterval: setIntervalFn
        };

        applyBenchmarkModeBeforeInit(root);

        expect(root.__BENCH_FAST_MODE).toBe(true);
        expect(root.CPU_MODEL_LOAD_TIMEOUT_MS).toBe(90000);
        expect(root.ANIMATION_RETRY_DELAY_MS).toBe(0);
        expect(root.setTimeout).toBe(setTimeoutFn);
        expect(root.setInterval).toBe(setIntervalFn);
    });

    test('post-init benchmark mode caps only short animation timers', () => {
        const timeoutCalls = [];
        const intervalCalls = [];
        const isolatedApplyBenchmarkModeAfterInit = (0, eval)(`(${applyBenchmarkModeAfterInit.toString()})`);
        const root = {
            setTimeout: jest.fn((fn, ms) => {
                timeoutCalls.push(ms);
                return 1;
            }),
            setInterval: jest.fn((fn, ms) => {
                intervalCalls.push(ms);
                return 2;
            }),
            autoSimple: {
                setIntervalMs: jest.fn()
            }
        };

        isolatedApplyBenchmarkModeAfterInit(root);
        root.setTimeout(() => {}, 50);
        root.setTimeout(() => {}, 100);
        root.setTimeout(() => {}, 90000);
        root.setInterval(() => {}, 40);
        root.setInterval(() => {}, 4000);

        expect(timeoutCalls).toEqual([16, 100, 90000]);
        expect(intervalCalls).toEqual([16, 4000]);
        expect(root.autoSimple.setIntervalMs).toHaveBeenCalledWith(16);
    });

    test('buildFailureSnapshot keeps compact recent diagnostics for timeout errors', () => {
        const snapshot = buildFailureSnapshot(
            {
                stage: 'wait-game-finish',
                currentPlayer: -1
            },
            {
                consoleMessages: [
                    { type: 'log', text: 'boot' },
                    { type: 'warning', text: 'late warning' },
                    { type: 'error', text: 'white cpu handoff stalled' }
                ],
                pageErrors: ['page exploded'],
                networkErrors: [{ kind: 'http', status: 404, method: 'GET', url: 'http://127.0.0.1:8123/data/models/missing.onnx' }]
            }
        );

        expect(snapshot.consoleMessageCount).toBe(3);
        expect(snapshot.pageErrorCount).toBe(1);
        expect(snapshot.networkErrorCount).toBe(1);
        expect(snapshot.recentConsoleMessages).toEqual([
            { type: 'warning', text: 'late warning' },
            { type: 'error', text: 'white cpu handoff stalled' }
        ]);
        expect(snapshot.recentPageErrors).toEqual(['page exploded']);
        expect(snapshot.recentNetworkErrors).toEqual([
            {
                kind: 'http',
                status: 404,
                method: 'GET',
                failure: null,
                url: 'http://127.0.0.1:8123/data/models/missing.onnx'
            }
        ]);
    });
});
