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
        out: null,
        policyA: { allowCardUsage: true, cardUsageRate: 0.2 },
        policyB: { allowCardUsage: true, cardUsageRate: 0.2 },
        modelAPath: null,
        modelBPath: null,
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
        if (a === '--a-no-cards') {
            args.policyA.allowCardUsage = false;
            continue;
        }
        if (a === '--a-with-cards') {
            args.policyA.allowCardUsage = true;
            continue;
        }
        if (a === '--a-rate') {
            args.policyA.cardUsageRate = Number(argv[++i]);
            continue;
        }
        if (a === '--a-model') {
            args.modelAPath = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (a === '--b-no-cards') {
            args.policyB.allowCardUsage = false;
            continue;
        }
        if (a === '--b-with-cards') {
            args.policyB.allowCardUsage = true;
            continue;
        }
        if (a === '--b-rate') {
            args.policyB.cardUsageRate = Number(argv[++i]);
            continue;
        }
        if (a === '--b-model') {
            args.modelBPath = path.resolve(process.cwd(), argv[++i]);
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
    if (!Number.isFinite(args.policyA.cardUsageRate) || args.policyA.cardUsageRate < 0 || args.policyA.cardUsageRate > 1) {
        throw new Error('--a-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.policyB.cardUsageRate) || args.policyB.cardUsageRate < 0 || args.policyB.cardUsageRate > 1) {
        throw new Error('--b-rate must be in [0,1]');
    }

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/benchmark-selfplay-policy.js [options]',
        '',
        'Options:',
        '  -g, --games <n>      Games per side (default: 100)',
        '  -s, --seed <n>       Base seed (default: 1)',
        '      --max-plies <n>  Max plies per game (default: 220)',
        '  -o, --out <path>     Optional JSON output path',
        '      --a-with-cards   Enable cards for Policy A (default: on)',
        '      --a-no-cards     Disable cards for Policy A',
        '      --a-rate <r>     Card usage rate for Policy A (default: 0.2)',
        '      --a-model <path> Optional policy-table JSON for Policy A',
        '      --b-with-cards   Enable cards for Policy B (default: on)',
        '      --b-no-cards     Disable cards for Policy B',
        '      --b-rate <r>     Card usage rate for Policy B (default: 0.2)',
        '      --b-model <path> Optional policy-table JSON for Policy B',
        '      --verbose        Keep internal game debug logs',
        '  -h, --help           Show this help'
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

function mapWinnerToPolicy(winner, blackPolicy) {
    if (winner === 'draw') return 'draw';
    if (winner === 'black') return blackPolicy;
    return blackPolicy === 'A' ? 'B' : 'A';
}

function summarizePolicyResults(resultAB, resultBA) {
    const totals = { A: 0, B: 0, draw: 0 };
    const bySide = {
        blackA_whiteB: { A: 0, B: 0, draw: 0 },
        blackB_whiteA: { A: 0, B: 0, draw: 0 }
    };
    let totalPlies = 0;

    for (const game of resultAB.gameSummaries) {
        const winner = mapWinnerToPolicy(game.winner, 'A');
        bySide.blackA_whiteB[winner] += 1;
        totals[winner] += 1;
        totalPlies += game.plies;
    }
    for (const game of resultBA.gameSummaries) {
        const winner = mapWinnerToPolicy(game.winner, 'B');
        bySide.blackB_whiteA[winner] += 1;
        totals[winner] += 1;
        totalPlies += game.plies;
    }

    const totalGames = resultAB.gameSummaries.length + resultBA.gameSummaries.length;
    const scoreA = totals.A + (totals.draw * 0.5);
    const scoreB = totals.B + (totals.draw * 0.5);

    return {
        totalGames,
        totalPlies,
        avgPlies: totalGames > 0 ? totalPlies / totalGames : 0,
        totals,
        bySide,
        score: {
            A: scoreA,
            B: scoreB,
            APercent: totalGames > 0 ? scoreA / totalGames : 0,
            BPercent: totalGames > 0 ? scoreB / totalGames : 0
        }
    };
}

function runBenchmark(options) {
    const games = Number.isFinite(options.games) ? options.games : 100;
    const seed = Number.isFinite(options.seed) ? options.seed : 1;
    const maxPlies = Number.isFinite(options.maxPlies) ? options.maxPlies : 220;
    const policyA = Object.assign({ allowCardUsage: true, cardUsageRate: 0.2 }, options.policyA || {});
    const policyB = Object.assign({ allowCardUsage: true, cardUsageRate: 0.2 }, options.policyB || {});
    if (options.modelAPath) {
        const raw = fs.readFileSync(options.modelAPath, 'utf8');
        policyA.policyTableModel = JSON.parse(raw);
    }
    if (options.modelBPath) {
        const raw = fs.readFileSync(options.modelBPath, 'utf8');
        policyB.policyTableModel = JSON.parse(raw);
    }

    const resultAB = runSelfPlayGames({
        games,
        baseSeed: seed,
        maxPlies,
        allowCardUsage: false,
        cardUsageRate: 0,
        playerPolicies: {
            black: policyA,
            white: policyB
        }
    });

    const resultBA = runSelfPlayGames({
        games,
        baseSeed: seed,
        maxPlies,
        allowCardUsage: false,
        cardUsageRate: 0,
        playerPolicies: {
            black: policyB,
            white: policyA
        }
    });

    return {
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        config: {
            games,
            seed,
            maxPlies,
            policyA: {
                allowCardUsage: policyA.allowCardUsage,
                cardUsageRate: policyA.cardUsageRate,
                hasModel: !!policyA.policyTableModel,
                modelPath: options.modelAPath || null
            },
            policyB: {
                allowCardUsage: policyB.allowCardUsage,
                cardUsageRate: policyB.cardUsageRate,
                hasModel: !!policyB.policyTableModel,
                modelPath: options.modelBPath || null
            }
        },
        result: summarizePolicyResults(resultAB, resultBA)
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const startedAt = Date.now();
    const benchmark = withFilteredConsole(!args.verbose, () => runBenchmark(args));
    const elapsedMs = Date.now() - startedAt;
    const payload = {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: benchmark.schemaVersion,
        config: benchmark.config,
        result: benchmark.result
    };

    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(payload, null, 2), 'utf8');
        console.log(`[selfplay-benchmark] wrote: ${args.out}`);
    }
    console.log(`[selfplay-benchmark] games=${payload.result.totalGames} avgPlies=${payload.result.avgPlies.toFixed(2)} A=${payload.result.score.APercent.toFixed(3)} B=${payload.result.score.BPercent.toFixed(3)}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[selfplay-benchmark] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    runBenchmark,
    summarizePolicyResults
};
