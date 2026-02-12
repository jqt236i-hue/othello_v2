#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { runBenchmark } = require('./benchmark-selfplay-policy');

function parseArgs(argv) {
    const args = {
        games: 300,
        seed: 1,
        seedCount: 1,
        seedStride: 1000,
        maxPlies: 220,
        threshold: 0.05,
        minSeedUplift: -1,
        minSeedPassCount: 0,
        aRate: 0.2,
        bRate: 0.2,
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
        if (a === '--seed-count') { args.seedCount = Number(argv[++i]); continue; }
        if (a === '--seed-stride') { args.seedStride = Number(argv[++i]); continue; }
        if (a === '--max-plies') { args.maxPlies = Number(argv[++i]); continue; }
        if (a === '--threshold') { args.threshold = Number(argv[++i]); continue; }
        if (a === '--min-seed-uplift') { args.minSeedUplift = Number(argv[++i]); continue; }
        if (a === '--min-seed-pass-count') { args.minSeedPassCount = Number(argv[++i]); continue; }
        if (a === '--a-rate') { args.aRate = Number(argv[++i]); continue; }
        if (a === '--b-rate') { args.bRate = Number(argv[++i]); continue; }
        if (a === '--candidate-model') { args.candidateModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--out' || a === '-o') { args.out = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.help) return args;

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.seedCount) || args.seedCount < 1) throw new Error('--seed-count must be >= 1');
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) throw new Error('--threshold must be in [0,1]');
    if (!Number.isFinite(args.minSeedUplift) || args.minSeedUplift < -1 || args.minSeedUplift > 1) throw new Error('--min-seed-uplift must be in [-1,1]');
    if (!Number.isFinite(args.minSeedPassCount) || args.minSeedPassCount < 0) throw new Error('--min-seed-pass-count must be >= 0');
    args.minSeedPassCount = Math.floor(args.minSeedPassCount);
    if (args.minSeedPassCount > args.seedCount) throw new Error('--min-seed-pass-count must be <= --seed-count');
    if (!Number.isFinite(args.aRate) || args.aRate < 0 || args.aRate > 1) throw new Error('--a-rate must be in [0,1]');
    if (!Number.isFinite(args.bRate) || args.bRate < 0 || args.bRate > 1) throw new Error('--b-rate must be in [0,1]');
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
        '      --seed-count <n>        Number of different seeds to evaluate and average (default: 1)',
        '      --seed-stride <n>       Seed step between runs (default: 1000)',
        '      --max-plies <n>         Max plies per game (default: 220)',
        '      --threshold <r>         Required average uplift as decimal (default: 0.05)',
        '      --min-seed-uplift <r>   Required minimum per-seed uplift [-1..1] (default: -1)',
        '      --min-seed-pass-count <n>  Required number of per-seed threshold passes (default: 0)',
        '      --a-rate <r>            Card usage rate for Policy A [0..1] (default: 0.2)',
        '      --b-rate <r>            Card usage rate for Policy B [0..1] (default: 0.2)',
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

function computeAdoptionDecisionAverage(seedDecisions, threshold, minSeedUplift, minSeedPassCount) {
    const requiredMinSeedUplift = Number.isFinite(minSeedUplift) ? minSeedUplift : -1;
    const requiredMinSeedPassCount = Number.isFinite(minSeedPassCount) ? Math.max(0, Math.floor(minSeedPassCount)) : 0;
    if (!Array.isArray(seedDecisions) || seedDecisions.length <= 0) {
        return {
            baselineScore: 0,
            candidateScore: 0,
            uplift: 0,
            minSeedUplift: 0,
            threshold,
            requiredMinSeedUplift,
            requiredMinSeedPassCount,
            passed: false,
            passedByAverage: false,
            passedByMinSeedUplift: false,
            passedBySeedPassCount: false,
            seedCount: 0,
            seedPassCount: 0
        };
    }

    let baselineSum = 0;
    let candidateSum = 0;
    let upliftSum = 0;
    let seedPassCount = 0;
    let minSeedUpliftObserved = Infinity;

    for (const one of seedDecisions) {
        const oneBaseline = Number(one && one.baselineScore) || 0;
        const oneCandidate = Number(one && one.candidateScore) || 0;
        const oneUplift = Number(one && one.uplift) || 0;
        baselineSum += oneBaseline;
        candidateSum += oneCandidate;
        upliftSum += oneUplift;
        if (oneUplift < minSeedUpliftObserved) minSeedUpliftObserved = oneUplift;
        if (one && one.passed === true) seedPassCount += 1;
    }

    const seedCount = seedDecisions.length;
    const baselineScore = baselineSum / seedCount;
    const candidateScore = candidateSum / seedCount;
    const uplift = upliftSum / seedCount;
    if (!Number.isFinite(minSeedUpliftObserved)) minSeedUpliftObserved = 0;
    const passedByAverage = uplift >= threshold;
    const passedByMinSeedUplift = minSeedUpliftObserved >= requiredMinSeedUplift;
    const passedBySeedPassCount = seedPassCount >= requiredMinSeedPassCount;
    const passed = passedByAverage && passedByMinSeedUplift && passedBySeedPassCount;

    return {
        baselineScore,
        candidateScore,
        uplift,
        minSeedUplift: minSeedUpliftObserved,
        threshold,
        requiredMinSeedUplift,
        requiredMinSeedPassCount,
        passed,
        passedByAverage,
        passedByMinSeedUplift,
        passedBySeedPassCount,
        seedCount,
        seedPassCount
    };
}

function buildSeedList(baseSeed, seedCount, seedStride) {
    const out = [];
    for (let i = 0; i < seedCount; i++) {
        out.push(baseSeed + (i * seedStride));
    }
    return out;
}

function runAdoptionCheck(options) {
    const seeds = buildSeedList(options.seed, options.seedCount, options.seedStride);
    const perSeed = [];

    for (const currentSeed of seeds) {
        const common = {
            games: options.games,
            seed: currentSeed,
            maxPlies: options.maxPlies,
            policyA: { allowCardUsage: true, cardUsageRate: options.aRate },
            policyB: { allowCardUsage: true, cardUsageRate: options.bRate }
        };

        const baseline = runBenchmark(common);
        const candidate = runBenchmark(Object.assign({}, common, {
            modelAPath: options.candidateModelPath
        }));
        const oneDecision = computeAdoptionDecision(baseline, candidate, options.threshold);
        perSeed.push({
            seed: currentSeed,
            baseline,
            candidate,
            decision: oneDecision
        });
    }

    const decision = computeAdoptionDecisionAverage(
        perSeed.map((x) => x.decision),
        options.threshold,
        options.minSeedUplift,
        options.minSeedPassCount
    );
    const first = perSeed[0] || null;

    return {
        generatedAt: new Date().toISOString(),
        schemaVersion: first && first.baseline ? first.baseline.schemaVersion : null,
        config: {
            games: options.games,
            seed: options.seed,
            seedCount: options.seedCount,
            seedStride: options.seedStride,
            maxPlies: options.maxPlies,
            threshold: options.threshold,
            minSeedUplift: options.minSeedUplift,
            minSeedPassCount: options.minSeedPassCount,
            aRate: options.aRate,
            bRate: options.bRate,
            candidateModelPath: options.candidateModelPath
        },
        baseline: first ? first.baseline : null,
        candidate: first ? first.candidate : null,
        perSeed,
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
    console.log(`[policy-adoption] baseline=${d.baselineScore.toFixed(3)} candidate=${d.candidateScore.toFixed(3)} uplift=${d.uplift.toFixed(3)} min_seed_uplift=${d.minSeedUplift.toFixed(3)} threshold=${d.threshold.toFixed(3)} seeds=${d.seedCount || 1} seed_pass=${d.seedPassCount || 0}/${d.seedCount || 0} min_seed_req=${d.requiredMinSeedPassCount || 0} pass=${d.passed}`);
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
    computeAdoptionDecisionAverage,
    buildSeedList,
    runAdoptionCheck
};
