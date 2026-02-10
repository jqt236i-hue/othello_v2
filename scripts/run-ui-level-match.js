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
            const mime = ext === '.html' ? 'text/html'
                : ext === '.js' ? 'application/javascript'
                    : ext === '.css' ? 'text/css'
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

    try {
        page.setDefaultTimeout(args.timeoutMs);
        page.setDefaultNavigationTimeout(args.timeoutMs);

        await page.goto(`http://127.0.0.1:${port}/`);
        await page.waitForSelector('#smartBlack');
        await page.waitForSelector('#smartWhite');

        await page.selectOption('#smartBlack', String(args.black)).catch(() => {});
        await page.selectOption('#smartWhite', String(args.white)).catch(() => {});

        await page.evaluate(() => {
            const b = document.getElementById('smartBlack');
            const w = document.getElementById('smartWhite');
            if (b) b.dispatchEvent(new Event('change'));
            if (w) w.dispatchEvent(new Event('change'));
        });

        await page.click('#resetBtn').catch(() => {});
        await page.click('#autoToggleBtn').catch(() => {});

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

        return {
            levels: { black: args.black, white: args.white },
            finishedAt: new Date().toISOString(),
            result
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
