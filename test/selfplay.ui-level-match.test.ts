const {
    resolveMatchProfileId,
    parseArgs,
    applyBenchmarkModeBeforeInit,
    applyBenchmarkModeAfterInit,
    buildFailureSnapshot,
    buildMatchQuery,
    resolveServeRoot,
    startServer
} = require('../scripts/run-ui-level-match');

describe('ui level match script args', () => {
    test('selects supported display levels through their actual profile IDs', () => {
        expect([6, 7, 8, 9, 10].map(resolveMatchProfileId)).toEqual(['6', '7-board-executor', '8-theory-incarnation', '9-ending-ash', '10-observed-dark-dragon']);
        for (const invalid of [0, 11, 1.5, NaN]) expect(() => resolveMatchProfileId(invalid)).toThrow();
    });
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

    test('buildMatchQuery eagerly loads CPU policy when ONNX is required', () => {
        expect(buildMatchQuery({
            requireOnnxLoaded: true,
            requireTargetModelLoaded: false,
            requireValueModelLoaded: false
        })).toBe('?eagerCpuPolicy=1&cpuOnnx=1');

        expect(buildMatchQuery({
            requireOnnxLoaded: false,
            requireTargetModelLoaded: false,
            requireValueModelLoaded: false
        })).toBe('');
    });

    test('resolveServeRoot points dist CLI execution at the repository root', () => {
        const sourceScriptDir = require('path').join(process.cwd(), 'scripts');
        const distScriptDir = require('path').join(process.cwd(), 'dist', 'scripts');

        expect(resolveServeRoot(sourceScriptDir)).toBe(process.cwd());
        expect(resolveServeRoot(distScriptDir)).toBe(process.cwd());
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
            __BENCH_ULTRA_FAST_MODE: true,
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

describe('ui level match gate-only model overlay (R08)', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const http = require('http');
    const crypto = require('crypto');

    function get(port: number, urlPath: string): Promise<{ status: number; body: Buffer }> {
        return new Promise((resolve, reject) => {
            http.get({ host: '127.0.0.1', port, path: urlPath }, (res: any) => {
                const chunks: Buffer[] = [];
                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
            }).on('error', reject);
        });
    }

    test('serves overlay files in place of root model files, records them, and leaves root alone', async () => {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ui-level-overlay-'));
        const rootDir = path.join(tempDir, 'root');
        const overlayDir = path.join(tempDir, 'bundle');
        fs.mkdirSync(path.join(rootDir, 'data', 'models'), { recursive: true });
        fs.mkdirSync(path.join(overlayDir, 'data', 'models'), { recursive: true });
        fs.writeFileSync(path.join(rootDir, 'index.html'), '<html></html>');
        fs.writeFileSync(path.join(rootDir, 'data', 'models', 'policy-net.onnx'), 'root-model');
        fs.writeFileSync(path.join(rootDir, 'data', 'models', 'othello.json'), 'root-only');
        fs.writeFileSync(path.join(overlayDir, 'data', 'models', 'policy-net.onnx'), 'candidate-model');
        const served: any[] = [];
        const server = startServer(rootDir, 0, overlayDir, served);
        await new Promise((resolve) => server.once('listening', resolve));
        try {
            const port = server.address().port;
            expect((await get(port, '/data/models/policy-net.onnx?v=1')).body.toString()).toBe('candidate-model');
            expect((await get(port, '/data/models/othello.json')).body.toString()).toBe('root-only');
            expect(served).toEqual([{ path: 'data/models/policy-net.onnx', bytes: 15,
                sha256: crypto.createHash('sha256').update('candidate-model').digest('hex') }]);
            expect(fs.readFileSync(path.join(rootDir, 'data', 'models', 'policy-net.onnx'), 'utf8')).toBe('root-model');
            expect(parseArgs(['--model-overlay-dir', overlayDir]).modelOverlayDir).toBe(path.resolve(overlayDir));
        } finally {
            await new Promise((resolve) => server.close(resolve));
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
