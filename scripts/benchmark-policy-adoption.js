#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runBenchmark } = require('./benchmark-selfplay-policy');

function parseArgs(argv) {
    const args = {
        games: 300,
        seed: 1,
        maxPlies: 220,
        threshold: 0.05,
        candidateModelPath: null,
        out: null,
        verbose: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--games' || a === '-g') { args.games = Number(argv[++i]); continue; }
        if (a === '--seed' || a === '-s') { args.seed = Number(argv[++i]); continue; }
        if (a === '--max-plies') { args.maxPlies = Number(argv[++i]); continue; }
        if (a === '--threshold') { args.threshold = Number(argv[++i]); continue; }
        if (a === '--candidate-model') { args.candidateModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--out' || a === '-o') { args.out = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) throw new Error('--threshold must be in [0,1]');
    if (!args.candidateModelPath) throw new Error('--candidate-model is required');

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/benchmark-policy-adoption.js [options]',
        '',
        'Options:',
        '  -g, --games <n>             Games per side (default: 300)',
        '  -s, --seed <n>              Base seed (default: 1)',
        '      --max-plies <n>         Max plies per game (default: 220)',
        '      --threshold <r>         Required uplift as decimal (default: 0.05)',
        '      --candidate-model <p>   Candidate policy-table JSON (required)',
        '  -o, --out <path>            Optional JSON output path',
        '      --verbose               Keep internal game debug logs',
        '  -h, --help                  Show this help'
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

function computeAdoptionDecision(baseline, candidate, threshold) {
    const baselineScore = baseline.result.score.APercent;
    const candidateScore = candidate.result.score.APercent;
    const uplift = candidateScore - baselineScore;
    const passed = uplift >= threshold;
    return {
        baselineScore,
        candidateScore,
        uplift,
        threshold,
        passed
    };
}

function runAdoptionCheck(options) {
    const common = {
        games: options.games,
        seed: options.seed,
        maxPlies: options.maxPlies,
        policyA: { allowCardUsage: true, cardUsageRate: 0.2 },
        policyB: { allowCardUsage: true, cardUsageRate: 0.2 }
    };

    const baseline = runBenchmark(common);
    const candidate = runBenchmark(Object.assign({}, common, {
        modelAPath: options.candidateModelPath
    }));
    const decision = computeAdoptionDecision(baseline, candidate, options.threshold);

    return {
        generatedAt: new Date().toISOString(),
        schemaVersion: baseline.schemaVersion,
        config: {
            games: options.games,
            seed: options.seed,
            maxPlies: options.maxPlies,
            threshold: options.threshold,
            candidateModelPath: options.candidateModelPath
        },
        baseline,
        candidate,
        decision
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }

    const result = withFilteredConsole(!args.verbose, () => runAdoptionCheck(args));
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(result, null, 2), 'utf8');
        console.log(`[policy-adoption] wrote: ${args.out}`);
    }
    const d = result.decision;
    console.log(`[policy-adoption] baseline=${d.baselineScore.toFixed(3)} candidate=${d.candidateScore.toFixed(3)} uplift=${d.uplift.toFixed(3)} threshold=${d.threshold.toFixed(3)} pass=${d.passed}`);
    process.exit(d.passed ? 0 : 2);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[policy-adoption] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    computeAdoptionDecision,
    runAdoptionCheck
};
