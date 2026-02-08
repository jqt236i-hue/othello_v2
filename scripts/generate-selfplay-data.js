#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runSelfPlayGames, SELFPLAY_SCHEMA_VERSION } = require('../src/engine/selfplay-runner');

function parseArgs(argv) {
    const args = {
        games: 100,
        seed: 1,
        maxPlies: 220,
        out: path.resolve(process.cwd(), 'data', 'selfplay.ndjson'),
        allowCardUsage: true,
        cardUsageRate: 0.2,
        verbose: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            args.help = true;
            continue;
        }
        if (a === '--games' || a === '-g') {
            args.games = Number(argv[++i]);
            continue;
        }
        if (a === '--seed' || a === '-s') {
            args.seed = Number(argv[++i]);
            continue;
        }
        if (a === '--max-plies') {
            args.maxPlies = Number(argv[++i]);
            continue;
        }
        if (a === '--out' || a === '-o') {
            args.out = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (a === '--no-cards') {
            args.allowCardUsage = false;
            continue;
        }
        if (a === '--with-cards') {
            args.allowCardUsage = true;
            continue;
        }
        if (a === '--card-usage-rate') {
            args.cardUsageRate = Number(argv[++i]);
            continue;
        }
        if (a === '--verbose') {
            args.verbose = true;
            continue;
        }
    }

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.cardUsageRate) || args.cardUsageRate < 0 || args.cardUsageRate > 1) {
        throw new Error('--card-usage-rate must be in [0,1]');
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/generate-selfplay-data.js [options]',
        '',
        'Options:',
        '  -g, --games <n>           Number of self-play games (default: 100)',
        '  -s, --seed <n>            Base seed (default: 1)',
        '      --max-plies <n>       Max plies per game (default: 220)',
        '  -o, --out <path>          Output NDJSON path (default: data/selfplay.ndjson)',
        '      --with-cards          Enable card usage in self-play (default: on)',
        '      --no-cards            Disable card usage in self-play',
        '      --card-usage-rate <r> Probability of using a card if legal moves exist (default: 0.2)',
        '      --verbose             Keep internal game debug logs',
        '  -h, --help                Show this help'
    ].join('\n'));
}

function withFilteredConsole(enabled, fn) {
    if (!enabled) return fn();

    const originalLog = console.log;
    const originalWarn = console.warn;
    const shouldDrop = (firstArg) => {
        if (typeof firstArg !== 'string') return false;
        return firstArg.startsWith('[BOARDOPS]') ||
            firstArg.startsWith('[WORK_DEBUG]') ||
            firstArg.startsWith('[TurnPipeline]') ||
            firstArg.startsWith('[HYPERACTIVE]') ||
            firstArg.startsWith('[presentation]');
    };

    console.log = (...args) => {
        if (shouldDrop(args[0])) return;
        originalLog(...args);
    };
    console.warn = (...args) => {
        if (shouldDrop(args[0])) return;
        originalWarn(...args);
    };

    try {
        return fn();
    } finally {
        console.log = originalLog;
        console.warn = originalWarn;
    }
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    const summaryPath = `${args.out}.summary.json`;
    const outStream = fs.createWriteStream(args.out, { encoding: 'utf8' });

    let finishedGames = 0;
    const startedAt = Date.now();

    const result = withFilteredConsole(!args.verbose, () => runSelfPlayGames({
        games: args.games,
        baseSeed: args.seed,
        maxPlies: args.maxPlies,
        allowCardUsage: args.allowCardUsage,
        cardUsageRate: args.cardUsageRate,
        onRecord: (record) => {
            outStream.write(`${JSON.stringify(record)}\n`);
        },
        onGameEnd: (gameSummary) => {
            finishedGames += 1;
            if (finishedGames % 10 === 0 || finishedGames === args.games) {
                console.log(`[selfplay] ${finishedGames}/${args.games} completed (last winner: ${gameSummary.winner})`);
            }
        }
    }));

    outStream.end();

    const elapsedMs = Date.now() - startedAt;
    const payload = {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        config: {
            games: args.games,
            seed: args.seed,
            maxPlies: args.maxPlies,
            allowCardUsage: args.allowCardUsage,
            cardUsageRate: args.cardUsageRate
        },
        summary: result.summary
    };
    fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`[selfplay] records: ${args.out}`);
    console.log(`[selfplay] summary: ${summaryPath}`);
    console.log(`[selfplay] totalGames=${result.summary.totalGames} avgPlies=${result.summary.avgPlies.toFixed(2)} wins=${JSON.stringify(result.summary.wins)}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[selfplay] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs
};
