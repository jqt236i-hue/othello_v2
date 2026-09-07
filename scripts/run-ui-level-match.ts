#!/usr/bin/env node
'use strict';

import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as path from 'path';
import { chromium } from 'playwright';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

type LevelMatchArgs = {
    black: number;
    white: number;
    seed: number | null;
    out: string;
    timeoutMs: number;
    requireOnnxLoaded: boolean;
    requireTargetModelLoaded: boolean;
    requireValueModelLoaded: boolean;
    onnxWaitMs: number;
    headless: boolean;
    help: boolean;
};

type DiagnosticMessage = { type: string; text: string };
type NetworkDiagnostic = {
    kind: string;
    status?: number;
    url: string;
    method: string | null;
    failure: string | null;
};

type BenchGlobal = typeof globalThis & Record<string, any>;

function parseArgs(argv: string[]) {
    const args: LevelMatchArgs = {
        black: 1,
        white: 5,
        seed: null,
        out: path.resolve(process.cwd(), 'data', 'runs', 'level-match.json'),
        timeoutMs: 180000,
        requireOnnxLoaded: false,
        requireTargetModelLoaded: false,
        requireValueModelLoaded: false,
        onnxWaitMs: 30000,
        headless: true,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            args.help = true;
            continue;
        }
        if (a === '--black') {
            args.black = Number(argv[++i]);
            continue;
        }
        if (a === '--white') {
            args.white = Number(argv[++i]);
            continue;
        }
        if (a === '--seed') {
            args.seed = Number(argv[++i]);
            continue;
        }
        if (a === '--out' || a === '-o') {
            args.out = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (a === '--timeout-ms') {
            args.timeoutMs = Number(argv[++i]);
            continue;
        }
        if (a === '--require-onnx-loaded') {
            args.requireOnnxLoaded = true;
            continue;
        }
        if (a === '--require-target-model-loaded') {
            args.requireTargetModelLoaded = true;
            continue;
        }
        if (a === '--require-value-model-loaded') {
            args.requireValueModelLoaded = true;
            continue;
        }
        if (a === '--onnx-wait-ms') {
            args.onnxWaitMs = Number(argv[++i]);
            continue;
        }
        if (a === '--headed') {
            args.headless = false;
            continue;
        }
    }

    if (!Number.isFinite(args.black) || args.black < 1) throw new Error('--black must be >= 1');
    if (!Number.isFinite(args.white) || args.white < 1) throw new Error('--white must be >= 1');
    if (args.seed !== null && !Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) throw new Error('--timeout-ms must be >= 1000');
    if (!Number.isFinite(args.onnxWaitMs) || args.onnxWaitMs < 1000) throw new Error('--onnx-wait-ms must be >= 1000');

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-ui-level-match.js [options]',
        '',
        'Options:',
        '  --black <n>       Black CPU level (default: 1)',
        '  --white <n>       White CPU level (default: 5)',
        '  --seed <n>        Optional reset seed (uses Date.now override during reset)',
        '  -o, --out <path>  Output JSON path (default: data/runs/level-match.json)',
        '  --timeout-ms <n>  Max wait time for game end (default: 180000)',
        '  --require-onnx-loaded  Fail if ONNX runtime does not become loaded before start',
        '  --require-target-model-loaded  Also wait for pending-target ONNX before start',
        '  --require-value-model-loaded  Also wait for value ONNX before start',
        '  --onnx-wait-ms <n>     Wait timeout for ONNX load check (default: 30000)',
        '  --headed          Run browser with UI',
        '  -h, --help        Show this help'
    ].join('\n'));
}

function startServer(rootDir: string, port = 0) {
    const server = http.createServer((req: any, res: any) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/') reqPath = '/index.html';
        const filePath = path.join(rootDir, decodeURIComponent(reqPath));
        fs.readFile(filePath, (err: any, data: any) => {
            if (err) {
                res.statusCode = 404;
                res.end('Not found');
                return;
            }
            const ext = path.extname(filePath).toLowerCase();
            const mime = ext === '.html' ? 'text/html; charset=utf-8'
                : (ext === '.js' || ext === '.mjs') ? 'application/javascript; charset=utf-8'
                    : ext === '.css' ? 'text/css; charset=utf-8'
                        : ext === '.json' ? 'application/json; charset=utf-8'
                            : ext === '.wasm' ? 'application/wasm'
                                : ext === '.ico' ? 'image/x-icon'
                                    : 'application/octet-stream';
            res.setHeader('Content-Type', mime);
            res.end(data);
        });
    });
    server.listen(port);
    return server;
}

function resolveServeRoot(scriptDir: string = __dirname) {
    const candidates = [
        path.resolve(scriptDir, '..'),
        path.resolve(scriptDir, '..', '..'),
        process.cwd()
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'index.html'))) {
            return candidate;
        }
    }
    return candidates[0];
}

function applyBenchmarkModeBeforeInit(root: any) {
    const target = (root && typeof root === 'object') ? root : globalThis;
    try { target.__BENCH_FAST_MODE = true; } catch (e) { /* ignore */ }
    try { target.__BENCH_ULTRA_FAST_MODE = true; } catch (e) { /* ignore */ }
    try { target.CPU_MODEL_LOAD_TIMEOUT_MS = 90000; } catch (e) { /* ignore */ }
    try { target.ANIMATION_RETRY_DELAY_MS = 0; } catch (e) { /* ignore */ }
}

function applyBenchmarkModeAfterInit(root: any) {
    const target = (root && typeof root === 'object') ? root : globalThis;
    const shortTimerCapMs = 16;
    // Keep playback abort/watchdog timers at real durations while compressing short visual delays.
    const criticalTimerThresholdMs = 100;
    try { target.ANIMATION_RETRY_DELAY_MS = 0; } catch (e) { /* ignore */ }
    try {
        if (target.__BENCH_TIMEOUT_PATCHED__ !== true) {
            const originalSetTimeout = typeof target.setTimeout === 'function'
                ? target.setTimeout.bind(target)
                : null;
            if (originalSetTimeout) {
                target.setTimeout = function benchSetTimeout(fn: (...args: any[]) => unknown, ms: unknown, ...rest: any[]) {
                    const n = Number(ms);
                    const capped = Number.isFinite(n)
                        ? (n >= criticalTimerThresholdMs
                            ? n
                            : Math.max(0, Math.min(n, shortTimerCapMs)))
                        : 0;
                    return originalSetTimeout(fn, capped, ...rest);
                };
            }
            const originalSetInterval = typeof target.setInterval === 'function'
                ? target.setInterval.bind(target)
                : null;
            if (originalSetInterval) {
                target.setInterval = function benchSetInterval(fn: (...args: any[]) => unknown, ms: unknown, ...rest: any[]) {
                    const n = Number(ms);
                    const capped = Number.isFinite(n)
                        ? (n >= criticalTimerThresholdMs
                            ? n
                            : Math.max(1, Math.min(n, shortTimerCapMs)))
                        : 1;
                    return originalSetInterval(fn, capped, ...rest);
                };
            }
            target.__BENCH_TIMEOUT_PATCHED__ = true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (target.__BENCH_ANIMATION_TIMING_PATCHED__ !== true) {
            if (typeof target.getAnimationTiming !== 'function') {
                target.getAnimationTiming = () => 0;
            } else {
                const originalGetAnimationTiming = target.getAnimationTiming.bind(target);
                target.getAnimationTiming = function benchGetAnimationTiming(key: string) {
                    const base = Number(originalGetAnimationTiming(key));
                    if (!Number.isFinite(base)) return 0;
                    return Math.min(base, shortTimerCapMs);
                };
            }
            target.__BENCH_ANIMATION_TIMING_PATCHED__ = true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (target.autoSimple && typeof target.autoSimple.setIntervalMs === 'function') {
            target.autoSimple.setIntervalMs(16);
        }
    } catch (e) { /* ignore */ }
}

function trimDiagnosticText(value: unknown, maxLength = 240) {
    const text = String(value || '');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function pushBounded(list: any, value: any, limit: any) {
    if (!Array.isArray(list) || list.length >= limit) return;
    list.push(value);
}

function buildFailureSnapshot(snapshot: any, diagnostics: any) {
    const baseSnapshot = (snapshot && typeof snapshot === 'object') ? snapshot : {};
    const diag = (diagnostics && typeof diagnostics === 'object') ? diagnostics : {};
    const consoleMessages = Array.isArray(diag.consoleMessages) ? diag.consoleMessages : [];
    const pageErrors = Array.isArray(diag.pageErrors) ? diag.pageErrors : [];
    const networkErrors = Array.isArray(diag.networkErrors) ? diag.networkErrors : [];
    const errorLikeConsole = consoleMessages.filter((entry: any) => {
        const type = String(entry && entry.type ? entry.type : '').toLowerCase();
        return type === 'error' || type === 'warning' || type === 'assert';
    });
    const recentConsole = (errorLikeConsole.length > 0 ? errorLikeConsole : consoleMessages)
        .slice(-5)
        .map((entry: any) => ({
            type: String(entry && entry.type ? entry.type : 'info'),
            text: trimDiagnosticText(entry && entry.text ? entry.text : '')
        }));
    const recentPageErrors = pageErrors.slice(-5).map((entry: any) => trimDiagnosticText(entry));
    const recentNetworkErrors = networkErrors.slice(-5).map((entry: any) => ({
        kind: String(entry && entry.kind ? entry.kind : 'unknown'),
        status: Number.isFinite(entry && entry.status) ? Number(entry.status) : null,
        method: entry && entry.method ? String(entry.method) : null,
        failure: entry && entry.failure ? trimDiagnosticText(entry.failure, 160) : null,
        url: trimDiagnosticText(entry && entry.url ? entry.url : '', 200)
    }));

    return Object.assign({}, baseSnapshot, {
        consoleMessageCount: consoleMessages.length,
        pageErrorCount: pageErrors.length,
        networkErrorCount: networkErrors.length,
        recentConsoleMessages: recentConsole,
        recentPageErrors,
        recentNetworkErrors
    });
}

function buildMatchQuery(args: Pick<LevelMatchArgs, 'requireOnnxLoaded' | 'requireTargetModelLoaded' | 'requireValueModelLoaded'>) {
    const queryParts = [];
    const requiresOnnxRuntime = args.requireOnnxLoaded ||
        args.requireTargetModelLoaded ||
        args.requireValueModelLoaded;
    if (requiresOnnxRuntime) {
        queryParts.push('eagerCpuPolicy=1');
        queryParts.push('cpuOnnx=1');
    }
    return queryParts.length ? `?${queryParts.join('&')}` : '';
}

async function closeMaintenanceNoticeIfPresent(page: any, timeoutMs = 5000) {
    if (!page || typeof page.locator !== 'function') return false;
    const notice = page.locator('#maintenanceNotice.is-open');
    const noticeCount = await notice.count().catch(() => 0);
    if (noticeCount <= 0) return false;

    const closeButton = page.locator('#maintenanceNoticeCloseBtn');
    const closeCount = await closeButton.count().catch(() => 0);
    if (closeCount > 0) {
        await closeButton.click({ timeout: timeoutMs }).catch(async () => {
            await page.evaluate(() => {
                const button = document.getElementById('maintenanceNoticeCloseBtn');
                if (button instanceof HTMLElement) button.click();
            }).catch(() => undefined);
        });
    } else {
        await page.evaluate(() => {
            const maintenanceNotice = document.getElementById('maintenanceNotice');
            if (!maintenanceNotice) return;
            maintenanceNotice.classList.remove('is-open');
            maintenanceNotice.setAttribute('aria-hidden', 'true');
        }).catch(() => undefined);
    }

    await page.waitForFunction(() => {
        const maintenanceNotice = document.getElementById('maintenanceNotice');
        return !maintenanceNotice ||
            !maintenanceNotice.classList.contains('is-open') ||
            maintenanceNotice.getAttribute('aria-hidden') === 'true';
    }, { timeout: timeoutMs }).catch(() => undefined);
    return true;
}

async function runMatch(args: any) {
    const root = resolveServeRoot(__dirname);
    const startedAt = Date.now();
    const server = startServer(root, 0);
    await new Promise(resolve => setTimeout(resolve, 200));
    const address = server.address() as AddressInfo | null;
    if (!address || typeof address === 'string') {
        throw new Error('local server did not expose a TCP port');
    }
    const port = address.port;
    const browser = await chromium.launch({ headless: args.headless });
    const page = await browser.newPage();
    await page.addInitScript(applyBenchmarkModeBeforeInit);
    const consoleMessages: DiagnosticMessage[] = [];
    const pageErrors: string[] = [];
    const networkErrors: NetworkDiagnostic[] = [];
    let stage = 'launch';
    let progressTimer: ReturnType<typeof setInterval> | null = null;
    if (typeof args.onProgress === 'function') {
        progressTimer = setInterval(() => args.onProgress({ stage }), 10000);
    }
    page.on('console', (msg: any) => {
        pushBounded(consoleMessages, {
            type: msg.type(),
            text: msg.text()
        }, 300);
    });
    page.on('pageerror', (err: any) => {
        pushBounded(pageErrors, String(err && err.message ? err.message : err), 100);
    });
    page.on('requestfailed', (request: any) => {
        pushBounded(networkErrors, {
            kind: 'requestfailed',
            url: request && typeof request.url === 'function' ? request.url() : '',
            method: request && typeof request.method === 'function' ? request.method() : null,
            failure: request && typeof request.failure === 'function' && request.failure()
                ? request.failure().errorText
                : null
        }, 100);
    });
    page.on('response', (response: any) => {
        try {
            const status = Number(response && typeof response.status === 'function' ? response.status() : 0);
            if (!Number.isFinite(status) || status < 400) return;
            const request = response && typeof response.request === 'function' ? response.request() : null;
            pushBounded(networkErrors, {
                kind: 'http',
                status,
                url: response && typeof response.url === 'function' ? response.url() : '',
                method: request && typeof request.method === 'function' ? request.method() : null,
                failure: null
            }, 100);
        } catch (e) { /* ignore */ }
    });

    try {
        page.setDefaultTimeout(args.timeoutMs);
        page.setDefaultNavigationTimeout(args.timeoutMs);

        stage = 'goto';
        const baseQuery = buildMatchQuery(args);
        const query = args.candidateProbe ? `${baseQuery}${baseQuery ? '&' : '?'}noanim=1&eagerCpuPolicy=1` : baseQuery;
        await page.goto(`http://127.0.0.1:${port}/${args.candidateProbe?.classic ? 'index.classic.html' : ''}${query}`);
        stage = 'wait-selectors';
        await page.waitForSelector('#smartBlack', { state: 'attached' });
        await page.waitForSelector('#smartWhite', { state: 'attached' });
        stage = 'wait-ui-init';
        await page.waitForFunction(() => (globalThis as BenchGlobal).__uiInitialized === true, {
            timeout: Math.min(args.timeoutMs, 30000)
        });
        stage = 'close-maintenance-notice';
        await closeMaintenanceNoticeIfPresent(page, 5000);

        // Benchmark mode: reduce animation waits so headless matches finish reliably.
        stage = 'configure-benchmark-mode';
        if (!args.candidateProbe) await page.evaluate(applyBenchmarkModeAfterInit);
        if (args.candidateProbe) {
            await page.evaluate((probe: any) => {
                (window as any).require('game/auto').setIntervalMs(200);
                const api = (window as any).require('game/ai/cpu-candidate-probe');
                api.configure(probe.bundle, probe.color, probe.heads);
            }, args.candidateProbe);
        }

        stage = 'select-levels';
        await page.evaluate((levels: any) => {
            const b = document.getElementById('smartBlack') as HTMLSelectElement | null;
            const w = document.getElementById('smartWhite') as HTMLSelectElement | null;
            if (b) b.value = String(levels.black);
            if (w) w.value = String(levels.white);
            if (b) b.dispatchEvent(new Event('change'));
            if (w) w.dispatchEvent(new Event('change'));
        }, { black: args.black, white: args.white });

        stage = 'verify-levels';
        const selectedLevels = await page.evaluate(() => {
            const b = document.getElementById('smartBlack') as HTMLSelectElement | null;
            const w = document.getElementById('smartWhite') as HTMLSelectElement | null;
            return {
                black: b ? Number(b.value) : null,
                white: w ? Number(w.value) : null
            };
        });
        if (selectedLevels.black !== args.black || selectedLevels.white !== args.white) {
            throw new Error(
                `cpu level select mismatch: expected black=${args.black},white=${args.white} got black=${selectedLevels.black},white=${selectedLevels.white}`
            );
        }

        // ONNX gate requires that the deployed ONNX is actually loaded before the match starts.
        const requiresOnnxRuntime = args.requireOnnxLoaded ||
            args.requireTargetModelLoaded ||
            args.requireValueModelLoaded;
        if (requiresOnnxRuntime) {
            stage = 'wait-onnx';
            await page.waitForFunction((requirements: any) => {
                const resolveRuntime = () => {
                    if (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function') {
                        return window.CpuPolicyOnnxRuntime;
                    }
                    try {
                        const req = (window as any).require;
                        if (typeof req === 'function') {
                            const runtime = req('game/ai/policy-onnx-runtime') || req('game/ai/policy-onnx-runtime.js');
                            if (runtime && typeof runtime.getStatus === 'function') return runtime;
                        }
                    } catch (e) { /* ignore */ }
                    return null;
                };
                const runtime = resolveRuntime();
                const status = runtime ? runtime.getStatus() : null;
                if (!status || status.loaded !== true) return false;
                if (requirements.requireTargetModelLoaded !== true && requirements.requireValueModelLoaded !== true) {
                    return true;
                }
                if (requirements.requireTargetModelLoaded === true && status.targetModelLoaded !== true) return false;
                if (requirements.requireValueModelLoaded === true && status.valueModelLoaded !== true) return false;
                return true;
            }, {
                requireTargetModelLoaded: args.requireTargetModelLoaded === true,
                requireValueModelLoaded: args.requireValueModelLoaded === true
            }, {
                timeout: args.onnxWaitMs
            });
        } else if (args.candidateProbe) {
            stage = 'wait-current-othello-model';
            await page.waitForFunction(() => {
                try { return (window as any).require('game/ai/othello-onnx-runtime').getStatus().loaded === true; }
                catch { return false; }
            }, null, { timeout: 60000 });
        } else {
            try {
                await page.waitForFunction(() => {
                    const resolveRuntime = () => {
                        if (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function') {
                            return window.CpuPolicyOnnxRuntime;
                        }
                        try {
                            const req = (window as any).require;
                            if (typeof req === 'function') {
                                const runtime = req('game/ai/policy-onnx-runtime') || req('game/ai/policy-onnx-runtime.js');
                                if (runtime && typeof runtime.getStatus === 'function') return runtime;
                            }
                        } catch (err) { /* ignore */ }
                        return null;
                    };
                    const runtime = resolveRuntime();
                    const status = runtime ? runtime.getStatus() : null;
                    return !!(status && status.loaded === true);
                }, null, { timeout: args.onnxWaitMs });
            } catch (e) {
                // Best-effort only when not explicitly required.
            }
        }

        if (args.seed !== null && Number.isFinite(args.seed)) {
            stage = 'reset-seeded';
            await page.evaluate((seedValue: any) => {
                const oldNow = Date.now;
                Date.now = () => seedValue;
                try {
                    if (typeof window.resetGame === 'function') {
                        window.resetGame();
                        return;
                    }
                    const btn = document.getElementById('resetBtn');
                    if (btn) btn.click();
                } finally {
                    Date.now = oldNow;
                }
            }, Math.floor(args.seed));
        } else {
            stage = 'reset-default';
            await page.click('#resetBtn').catch(() => {});
        }
        if (args.candidateProbe) {
            stage = 'wait-initial-deal';
            // resetGame starts the initial deal asynchronously; snapshot only after the first turn starts.
            await page.waitForFunction(() => {
                const root = window as any;
                const card = root.require('card-system').getCardState();
                return card?.turnCountByPlayer?.black >= 1 && !root.isProcessing && !root.isCardAnimating &&
                    !root.require('ui/playback-state-manager').isPlaybackRunning();
            }, null, { timeout: 30000 });
        }
        if (typeof args.setupPage === 'function') await args.setupPage(page);
        stage = 'enable-auto';
        const initialState = await page.evaluate(() => {
            const root = window as any;
            return JSON.stringify({ game: root.gameState, card: root.cardState });
        });
        await page.click('#autoToggleBtn');
        stage = 'wait-auto';
        await page.waitForFunction(() => {
            const btn = document.getElementById('autoToggleBtn');
            const txt = btn ? String(btn.textContent || '') : '';
            return txt.includes('ON') || ((globalThis as BenchGlobal).AUTO_MODE_ACTIVE === true);
        }, { timeout: 5000 });

        stage = 'wait-game-finish';
        if (typeof args.onProgress === 'function') {
            if (progressTimer) clearInterval(progressTimer);
            progressTimer = setInterval(() => {
                void page.evaluate(() => ({
                    turn: (window as any).gameState?.turnNumber,
                    auto: (window as any).AUTO_MODE_ACTIVE,
                    processing: (window as any).isProcessing,
                    animating: (window as any).isCardAnimating,
                    playback: (window as any).require('ui/playback-state-manager').isPlaybackRunning(),
                    pending: (window as any).require('card-system').getCardState()?.pendingEffectByPlayer,
                    candidate: (window as any).require('game/ai/cpu-candidate-probe').getStatus()
                })).then(args.onProgress).catch(() => undefined);
            }, 10000);
        }
        await page.waitForFunction(() => {
            const state = window.gameState;
            if (!state) return false;
            if (state.__resultShown === true) return true;
            try {
                if (typeof window.isGameOver === 'function' && window.isGameOver(state) === true) return true;
            } catch (e) { /* ignore */ }
            return false;
        }, { timeout: args.timeoutMs });

        stage = 'collect-result';
        const result = await page.evaluate(() => {
            const board = (window.gameState && window.gameState.board) ? window.gameState.board : [];
            let black = 0;
            let white = 0;
            let empty = 0;
            for (let r = 0; r < board.length; r++) {
                const row = board[r] || [];
                for (let c = 0; c < row.length; c++) {
                    if (row[c] === 1) black++;
                    else if (row[c] === -1) white++;
                    else empty++;
                }
            }
            const winner = black > white ? 'black' : (white > black ? 'white' : 'draw');
            return {
                black,
                white,
                empty,
                winner,
                turnNumber: window.gameState ? window.gameState.turnNumber : null
            };
        });
        stage = 'collect-runtime-status';
        const runtimeStatus = await page.evaluate(() => {
            const resolveOnnxRuntime = () => {
                if (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function') {
                    return window.CpuPolicyOnnxRuntime;
                }
                try {
                    const req = (window as any).require;
                    if (typeof req === 'function') {
                        const runtime = req('game/ai/policy-onnx-runtime') || req('game/ai/policy-onnx-runtime.js');
                        if (runtime && typeof runtime.getStatus === 'function') return runtime;
                    }
                } catch (e) { /* ignore */ }
                return null;
            };
            const onnxRuntime = resolveOnnxRuntime();
            const onnx = onnxRuntime ? onnxRuntime.getStatus() : null;
            const table = (window.CpuPolicyTableRuntime && typeof window.CpuPolicyTableRuntime.getStatus === 'function')
                ? window.CpuPolicyTableRuntime.getStatus()
                : null;
            let candidate = null;
            try { candidate = (window as any).require('game/ai/cpu-candidate-probe').getStatus(); } catch { /* ordinary match */ }
            let othello = null;
            try { othello = (window as any).require('game/ai/othello-onnx-runtime').getStatus(); } catch { /* unavailable */ }
            return { onnx, table, candidate, othello };
        });

        return {
            levels: { black: args.black, white: args.white },
            seed: args.seed,
            startedAt: new Date(startedAt).toISOString(),
            finishedAt: new Date().toISOString(),
            matchDurationMs: Date.now() - startedAt,
            url: page.url(),
            boardRenderer: await page.evaluate(() => document.querySelector('[data-board-renderer]')?.getAttribute('data-board-renderer') || null),
            initialState,
            audit: typeof args.collectPage === 'function' ? await args.collectPage(page) : undefined,
            result,
            runtimeStatus,
            consoleMessages,
            pageErrors,
            networkErrors
        };
    } catch (err) {
        let snapshot = null;
        try {
            snapshot = await page.evaluate(() => {
                const state = window.gameState || null;
                let occupied = 0;
                if (state && Array.isArray(state.board)) {
                    for (const row of state.board) {
                        for (const cell of Array.isArray(row) ? row : []) {
                            if (cell === 1 || cell === -1) occupied += 1;
                        }
                    }
                }
                let terminal = false;
                try {
                    terminal = !!(state && typeof window.isGameOver === 'function' && window.isGameOver(state) === true);
                } catch (e) { /* ignore */ }
                return {
                    stage: (globalThis as BenchGlobal).__benchStage || null,
                    turnNumber: state && Number.isFinite(state.turnNumber) ? state.turnNumber : null,
                    currentPlayer: state ? state.currentPlayer : null,
                    resultShown: !!(state && state.__resultShown === true),
                    terminal,
                    occupied,
                    autoModeActive: (globalThis as BenchGlobal).AUTO_MODE_ACTIVE === true,
                    pendingEffectType: state && state.pendingEffect ? String(state.pendingEffect.type || '') : null,
                    pendingEffectStage: state && state.pendingEffect ? String(state.pendingEffect.stage || '') : null,
                    onnxStatus: (() => {
                        if (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function') {
                            return window.CpuPolicyOnnxRuntime.getStatus();
                        }
                        try {
                            const req = (window as any).require;
                            if (typeof req === 'function') {
                                const runtime = req('game/ai/policy-onnx-runtime') || req('game/ai/policy-onnx-runtime.js');
                                if (runtime && typeof runtime.getStatus === 'function') return runtime.getStatus();
                            }
                        } catch (err) { /* ignore */ }
                        return null;
                    })(),
                    tableStatus: (window.CpuPolicyTableRuntime && typeof window.CpuPolicyTableRuntime.getStatus === 'function')
                        ? window.CpuPolicyTableRuntime.getStatus()
                        : null
                };
            });
            snapshot = buildFailureSnapshot(snapshot, {
                consoleMessages,
                pageErrors,
                networkErrors
            });
        } catch (snapshotErr: any) {
            snapshot = { snapshotError: snapshotErr && snapshotErr.message ? snapshotErr.message : String(snapshotErr) };
        }
        const baseMessage = err && typeof err === 'object' && 'message' in err ? String(err.message) : String(err);
        throw new Error(`[stage:${stage}] ${baseMessage} snapshot=${JSON.stringify(snapshot)}`);
    } finally {
        if (progressTimer) clearInterval(progressTimer);
        await page.close().catch(() => {});
        await browser.close().catch(() => {});
        await new Promise(resolve => server.close(resolve));
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const payload = await runMatch(args);
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[level-match] wrote: ${args.out}`);
    console.log(`[level-match] result: ${payload.result.winner} (black=${payload.result.black}, white=${payload.result.white})`);
}

if (require.main === module) {
    main().catch((err: any) => {
        console.error('[level-match] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

export = {
    parseArgs,
    applyBenchmarkModeBeforeInit,
    applyBenchmarkModeAfterInit,
    buildFailureSnapshot,
    buildMatchQuery,
    closeMaintenanceNoticeIfPresent,
    resolveServeRoot,
    runMatch
};
