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
        if (a === '--headed') {
            args.headless = false;
            continue;
        }
    }

    if (!Number.isFinite(args.black) || args.black < 1) throw new Error('--black must be >= 1');
    if (!Number.isFinite(args.white) || args.white < 1) throw new Error('--white must be >= 1');
    if (args.seed !== null && !Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) throw new Error('--timeout-ms must be >= 1000');

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

async function runMatch(args) {
    const root = path.resolve(__dirname, '..');
    const server = startServer(root, 0);
    await new Promise(resolve => setTimeout(resolve, 200));
    const port = server.address().port;
    const browser = await chromium.launch({ headless: args.headless });
    const page = await browser.newPage();
    await page.addInitScript(() => {
        try { globalThis.__BENCH_FAST_MODE = true; } catch (e) { /* ignore */ }
        try { globalThis.ANIMATION_RETRY_DELAY_MS = 0; } catch (e) { /* ignore */ }
        try {
            const originalSetTimeout = globalThis.setTimeout ? globalThis.setTimeout.bind(globalThis) : null;
            if (originalSetTimeout) {
                globalThis.setTimeout = function benchSetTimeout(fn, ms, ...rest) {
                    const n = Number(ms);
                    const capped = Number.isFinite(n) ? Math.max(0, Math.min(n, 16)) : 0;
                    return originalSetTimeout(fn, capped, ...rest);
                };
            }
        } catch (e) { /* ignore */ }
        try {
            const originalSetInterval = globalThis.setInterval ? globalThis.setInterval.bind(globalThis) : null;
            if (originalSetInterval) {
                globalThis.setInterval = function benchSetInterval(fn, ms, ...rest) {
                    const n = Number(ms);
                    const capped = Number.isFinite(n) ? Math.max(1, Math.min(n, 16)) : 1;
                    return originalSetInterval(fn, capped, ...rest);
                };
            }
        } catch (e) { /* ignore */ }
        try {
            if (typeof globalThis.getAnimationTiming !== 'function') {
                globalThis.getAnimationTiming = () => 0;
            } else {
                const originalGetAnimationTiming = globalThis.getAnimationTiming.bind(globalThis);
                globalThis.getAnimationTiming = function benchGetAnimationTiming(key) {
                    const base = Number(originalGetAnimationTiming(key));
                    if (!Number.isFinite(base)) return 0;
                    return Math.min(base, 16);
                };
            }
        } catch (e) { /* ignore */ }
    });
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
        if (consoleMessages.length >= 300) return;
        consoleMessages.push({
            type: msg.type(),
            text: msg.text()
        });
    });
    page.on('pageerror', (err) => {
        if (pageErrors.length >= 100) return;
        pageErrors.push(String(err && err.message ? err.message : err));
    });

    try {
        page.setDefaultTimeout(args.timeoutMs);
        page.setDefaultNavigationTimeout(args.timeoutMs);

        await page.goto(`http://127.0.0.1:${port}/`);
        await page.waitForSelector('#smartBlack');
        await page.waitForSelector('#smartWhite');

        // Benchmark mode: reduce animation waits so headless matches finish reliably.
        await page.evaluate(() => {
            try { globalThis.ANIMATION_RETRY_DELAY_MS = 0; } catch (e) { /* ignore */ }
            try {
                const original = (typeof globalThis.getAnimationTiming === 'function')
                    ? globalThis.getAnimationTiming.bind(globalThis)
                    : null;
                if (original) {
                    globalThis.getAnimationTiming = function patchedGetAnimationTiming(key) {
                        const base = Number(original(key));
                        if (!Number.isFinite(base)) return 0;
                        return Math.min(base, 16);
                    };
                }
            } catch (e) { /* ignore */ }
            try {
                if (globalThis.autoSimple && typeof globalThis.autoSimple.setIntervalMs === 'function') {
                    globalThis.autoSimple.setIntervalMs(16);
                }
            } catch (e) { /* ignore */ }
        });

        await page.selectOption('#smartBlack', String(args.black));
        await page.selectOption('#smartWhite', String(args.white));

        await page.evaluate(() => {
            const b = document.getElementById('smartBlack');
            const w = document.getElementById('smartWhite');
            if (b) b.dispatchEvent(new Event('change'));
            if (w) w.dispatchEvent(new Event('change'));
        });

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

        if (args.seed !== null && Number.isFinite(args.seed)) {
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
            await page.click('#resetBtn').catch(() => {});
        }
        await page.click('#autoToggleBtn');
        await page.waitForFunction(() => {
            const btn = document.getElementById('autoToggleBtn');
            const txt = btn ? String(btn.textContent || '') : '';
            return txt.includes('ON') || (globalThis.AUTO_MODE_ACTIVE === true);
        }, { timeout: 5000 });

        await page.waitForFunction(() => {
            return !!(window.gameState && window.gameState.__resultShown === true);
        }, { timeout: args.timeoutMs });

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
            finishedAt: new Date().toISOString(),
            result,
            runtimeStatus,
            consoleMessages,
            pageErrors
        };
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
    runMatch
};
