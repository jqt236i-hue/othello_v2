#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

function parseArgs(argv) {
    const args = {
        black: 1,
        white: 5,
        seed: null,
        out: path.resolve(process.cwd(), 'data', 'runs', 'level-match.json'),
        timeoutMs: 180000,
        requireOnnxLoaded: false,
        requireCardModelLoaded: false,
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
        if (a === '--require-card-model-loaded') {
            args.requireCardModelLoaded = true;
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
        '  --require-card-model-loaded  Also wait for card-specialist capability before start',
        '  --require-target-model-loaded  Also wait for pending-target ONNX before start',
        '  --require-value-model-loaded  Also wait for value ONNX before start',
        '  --onnx-wait-ms <n>     Wait timeout for ONNX load check (default: 30000)',
        '  --headed          Run browser with UI',
        '  -h, --help        Show this help'
    ].join('\n'));
}

function startServer(rootDir, port = 0) {
    const server = http.createServer((req, res) => {
        let reqPath = req.url.split('?')[0];
        if (reqPath === '/') reqPath = '/index.html';
        const filePath = path.join(rootDir, decodeURIComponent(reqPath));
        fs.readFile(filePath, (err, data) => {
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

function applyBenchmarkModeBeforeInit(root) {
    const target = (root && typeof root === 'object') ? root : globalThis;
    try { target.__BENCH_FAST_MODE = true; } catch (e) { /* ignore */ }
    try { target.CPU_MODEL_LOAD_TIMEOUT_MS = 90000; } catch (e) { /* ignore */ }
    try { target.ANIMATION_RETRY_DELAY_MS = 0; } catch (e) { /* ignore */ }
}

function applyBenchmarkModeAfterInit(root) {
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
                target.setTimeout = function benchSetTimeout(fn, ms, ...rest) {
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
                target.setInterval = function benchSetInterval(fn, ms, ...rest) {
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
                target.getAnimationTiming = function benchGetAnimationTiming(key) {
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

function trimDiagnosticText(value, maxLength = 240) {
    const text = String(value || '');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function pushBounded(list, value, limit) {
    if (!Array.isArray(list) || list.length >= limit) return;
    list.push(value);
}

function buildFailureSnapshot(snapshot, diagnostics) {
    const baseSnapshot = (snapshot && typeof snapshot === 'object') ? snapshot : {};
    const diag = (diagnostics && typeof diagnostics === 'object') ? diagnostics : {};
    const consoleMessages = Array.isArray(diag.consoleMessages) ? diag.consoleMessages : [];
    const pageErrors = Array.isArray(diag.pageErrors) ? diag.pageErrors : [];
    const networkErrors = Array.isArray(diag.networkErrors) ? diag.networkErrors : [];
    const errorLikeConsole = consoleMessages.filter((entry) => {
        const type = String(entry && entry.type ? entry.type : '').toLowerCase();
        return type === 'error' || type === 'warning' || type === 'assert';
    });
    const recentConsole = (errorLikeConsole.length > 0 ? errorLikeConsole : consoleMessages)
        .slice(-5)
        .map((entry) => ({
            type: String(entry && entry.type ? entry.type : 'info'),
            text: trimDiagnosticText(entry && entry.text ? entry.text : '')
        }));
    const recentPageErrors = pageErrors.slice(-5).map((entry) => trimDiagnosticText(entry));
    const recentNetworkErrors = networkErrors.slice(-5).map((entry) => ({
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

async function runMatch(args) {
    const root = path.resolve(__dirname, '..');
    const startedAt = Date.now();
    const server = startServer(root, 0);
    await new Promise(resolve => setTimeout(resolve, 200));
    const port = server.address().port;
    const browser = await chromium.launch({ headless: args.headless });
    const page = await browser.newPage();
    await page.addInitScript(applyBenchmarkModeBeforeInit);
    const consoleMessages = [];
    const pageErrors = [];
    const networkErrors = [];
    let stage = 'launch';
    page.on('console', (msg) => {
        pushBounded(consoleMessages, {
            type: msg.type(),
            text: msg.text()
        }, 300);
    });
    page.on('pageerror', (err) => {
        pushBounded(pageErrors, String(err && err.message ? err.message : err), 100);
    });
    page.on('requestfailed', (request) => {
        pushBounded(networkErrors, {
            kind: 'requestfailed',
            url: request && typeof request.url === 'function' ? request.url() : '',
            method: request && typeof request.method === 'function' ? request.method() : null,
            failure: request && typeof request.failure === 'function' && request.failure()
                ? request.failure().errorText
                : null
        }, 100);
    });
    page.on('response', (response) => {
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
        const queryParts = [];
        const requiresOnnxRuntime = args.requireOnnxLoaded ||
            args.requireCardModelLoaded ||
            args.requireTargetModelLoaded ||
            args.requireValueModelLoaded;
        if (requiresOnnxRuntime) {
            queryParts.push('cpuOnnx=1');
        }
        if (args.requireOnnxLoaded || args.requireCardModelLoaded) {
            queryParts.push('cardSpecialist=1');
        }
        const query = queryParts.length ? `?${queryParts.join('&')}` : '';
        await page.goto(`http://127.0.0.1:${port}/${query}`);
        stage = 'wait-selectors';
        await page.waitForSelector('#smartBlack');
        await page.waitForSelector('#smartWhite');
        stage = 'wait-ui-init';
        await page.waitForFunction(() => globalThis.__uiInitialized === true, {
            timeout: Math.min(args.timeoutMs, 30000)
        });

        // Benchmark mode: reduce animation waits so headless matches finish reliably.
        stage = 'configure-benchmark-mode';
        await page.evaluate(applyBenchmarkModeAfterInit);

        stage = 'select-levels';
        await page.selectOption('#smartBlack', String(args.black));
        await page.selectOption('#smartWhite', String(args.white));

        stage = 'dispatch-level-changes';
        await page.evaluate(() => {
            const b = document.getElementById('smartBlack');
            const w = document.getElementById('smartWhite');
            if (b) b.dispatchEvent(new Event('change'));
            if (w) w.dispatchEvent(new Event('change'));
        });

        stage = 'verify-levels';
        const selectedLevels = await page.evaluate(() => {
            const b = document.getElementById('smartBlack');
            const w = document.getElementById('smartWhite');
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
        if (requiresOnnxRuntime) {
            stage = 'wait-onnx';
            await page.waitForFunction((requirements) => {
                const status = (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function')
                    ? window.CpuPolicyOnnxRuntime.getStatus()
                    : null;
                if (!status || status.loaded !== true) return false;
                if (requirements.requireCardModelLoaded !== true) {
                    if (requirements.requireTargetModelLoaded !== true && requirements.requireValueModelLoaded !== true) {
                        return true;
                    }
                } else if (!(status.cardModelLoaded === true || status.hasCardHead === true)) {
                    return false;
                }
                if (requirements.requireTargetModelLoaded === true && status.targetModelLoaded !== true) return false;
                if (requirements.requireValueModelLoaded === true && status.valueModelLoaded !== true) return false;
                return true;
            }, {
                timeout: args.onnxWaitMs
            }, {
                requireCardModelLoaded: args.requireCardModelLoaded === true,
                requireTargetModelLoaded: args.requireTargetModelLoaded === true,
                requireValueModelLoaded: args.requireValueModelLoaded === true
            });
        } else {
            try {
                await page.waitForFunction(() => {
                    const status = (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function')
                        ? window.CpuPolicyOnnxRuntime.getStatus()
                        : null;
                    return !!(status && status.loaded === true);
                }, { timeout: args.onnxWaitMs });
            } catch (e) {
                // Best-effort only when not explicitly required.
            }
        }

        if (args.seed !== null && Number.isFinite(args.seed)) {
            stage = 'reset-seeded';
            await page.evaluate((seedValue) => {
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
        stage = 'enable-auto';
        await page.click('#autoToggleBtn');
        stage = 'wait-auto';
        await page.waitForFunction(() => {
            const btn = document.getElementById('autoToggleBtn');
            const txt = btn ? String(btn.textContent || '') : '';
            return txt.includes('ON') || (globalThis.AUTO_MODE_ACTIVE === true);
        }, { timeout: 5000 });

        stage = 'wait-game-finish';
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
            const onnx = (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function')
                ? window.CpuPolicyOnnxRuntime.getStatus()
                : null;
            const table = (window.CpuPolicyTableRuntime && typeof window.CpuPolicyTableRuntime.getStatus === 'function')
                ? window.CpuPolicyTableRuntime.getStatus()
                : null;
            return { onnx, table };
        });

        return {
            levels: { black: args.black, white: args.white },
            seed: args.seed,
            startedAt: new Date(startedAt).toISOString(),
            finishedAt: new Date().toISOString(),
            matchDurationMs: Date.now() - startedAt,
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
                    stage: globalThis.__benchStage || null,
                    turnNumber: state && Number.isFinite(state.turnNumber) ? state.turnNumber : null,
                    currentPlayer: state ? state.currentPlayer : null,
                    resultShown: !!(state && state.__resultShown === true),
                    terminal,
                    occupied,
                    autoModeActive: globalThis.AUTO_MODE_ACTIVE === true,
                    pendingEffectType: state && state.pendingEffect ? String(state.pendingEffect.type || '') : null,
                    pendingEffectStage: state && state.pendingEffect ? String(state.pendingEffect.stage || '') : null,
                    onnxStatus: (window.CpuPolicyOnnxRuntime && typeof window.CpuPolicyOnnxRuntime.getStatus === 'function')
                        ? window.CpuPolicyOnnxRuntime.getStatus()
                        : null,
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
        } catch (snapshotErr) {
            snapshot = { snapshotError: snapshotErr && snapshotErr.message ? snapshotErr.message : String(snapshotErr) };
        }
        const baseMessage = err && err.message ? err.message : String(err);
        throw new Error(`[stage:${stage}] ${baseMessage} snapshot=${JSON.stringify(snapshot)}`);
    } finally {
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
    main().catch((err) => {
        console.error('[level-match] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    applyBenchmarkModeBeforeInit,
    applyBenchmarkModeAfterInit,
    buildFailureSnapshot,
    runMatch
};
