#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
    const args = {
        games: 8,
        seed: 1,
        seedCount: 1,
        seedStride: 1000,
        threshold: 0.5,
        minSeedScore: 0,
        minSeedPassCount: 0,
        blackLevel: 6,
        whiteLevel: 5,
        timeoutMs: 180000,
        maxTotalMs: 900000,
        candidateOnnxPath: null,
        candidateOnnxMetaPath: null,
        targetOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx'),
        targetOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx.meta.json'),
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
        if (a === '--threshold') { args.threshold = Number(argv[++i]); continue; }
        if (a === '--min-seed-score') { args.minSeedScore = Number(argv[++i]); continue; }
        if (a === '--min-seed-pass-count') { args.minSeedPassCount = Number(argv[++i]); continue; }
        if (a === '--black-level') { args.blackLevel = Number(argv[++i]); continue; }
        if (a === '--white-level') { args.whiteLevel = Number(argv[++i]); continue; }
        if (a === '--timeout-ms') { args.timeoutMs = Number(argv[++i]); continue; }
        if (a === '--max-total-ms') { args.maxTotalMs = Number(argv[++i]); continue; }
        if (a === '--candidate-onnx') { args.candidateOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--candidate-onnx-meta') { args.candidateOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-onnx') { args.targetOnnxPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--target-onnx-meta') { args.targetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--out' || a === '-o') { args.out = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.help) return args;

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.seedCount) || args.seedCount < 1) throw new Error('--seed-count must be >= 1');
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) throw new Error('--threshold must be in [0,1]');
    if (!Number.isFinite(args.minSeedScore) || args.minSeedScore < 0 || args.minSeedScore > 1) throw new Error('--min-seed-score must be in [0,1]');
    if (!Number.isFinite(args.minSeedPassCount) || args.minSeedPassCount < 0) throw new Error('--min-seed-pass-count must be >= 0');
    args.minSeedPassCount = Math.floor(args.minSeedPassCount);
    if (args.minSeedPassCount > args.seedCount) throw new Error('--min-seed-pass-count must be <= --seed-count');
    if (!Number.isFinite(args.blackLevel) || args.blackLevel < 1 || args.blackLevel > 6) throw new Error('--black-level must be in [1,6]');
    if (!Number.isFinite(args.whiteLevel) || args.whiteLevel < 1 || args.whiteLevel > 6) throw new Error('--white-level must be in [1,6]');
    if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) throw new Error('--timeout-ms must be >= 1000');
    if (!Number.isFinite(args.maxTotalMs) || args.maxTotalMs < 0) throw new Error('--max-total-ms must be >= 0');
    if (!args.candidateOnnxPath) throw new Error('--candidate-onnx is required');
    if (!args.candidateOnnxMetaPath) args.candidateOnnxMetaPath = `${args.candidateOnnxPath}.meta.json`;
    if (!fs.existsSync(args.candidateOnnxPath)) throw new Error(`candidate onnx not found: ${args.candidateOnnxPath}`);
    if (!fs.existsSync(args.candidateOnnxMetaPath)) throw new Error(`candidate onnx meta not found: ${args.candidateOnnxMetaPath}`);

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/benchmark-policy-onnx-gate.js [options]',
        '',
        'Options:',
        '  -g, --games <n>              Games per side/seed (default: 8)',
        '  -s, --seed <n>               Base seed (default: 1)',
        '      --seed-count <n>         Number of seeds to evaluate (default: 1)',
        '      --seed-stride <n>        Seed step between runs (default: 1000)',
        '      --threshold <r>          Required average score [0..1] (default: 0.5)',
        '      --min-seed-score <r>     Required minimum per-seed score [0..1] (default: 0)',
        '      --min-seed-pass-count <n> Required count of seeds scoring >= threshold (default: 0)',
        '      --black-level <n>        Candidate side level when black (default: 6)',
        '      --white-level <n>        Baseline side level when white (default: 5)',
        '      --timeout-ms <n>         Per-match timeout (default: 180000)',
        '      --max-total-ms <n>       Total gate time budget in ms (default: 900000, 0=off)',
        '      --candidate-onnx <path>  Candidate ONNX file path (required)',
        '      --candidate-onnx-meta <path> Candidate ONNX meta path (default: <candidate>.meta.json)',
        '      --target-onnx <path>     Deployed ONNX path used by browser runtime',
        '      --target-onnx-meta <path> Deployed ONNX meta path used by browser runtime',
        '  -o, --out <path>             Optional JSON output path',
        '      --verbose                Print match-level logs',
        '  -h, --help                   Show this help'
    ].join('\n'));
}

function buildSeedList(baseSeed, seedCount, seedStride) {
    const out = [];
    for (let i = 0; i < seedCount; i++) out.push(baseSeed + (i * seedStride));
    return out;
}

function backupFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
}

function restoreFile(filePath, payload) {
    if (payload === null) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return;
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, payload);
}

function scoreWinnerForCandidate(winner, candidateColor) {
    if (winner === 'draw') return 0.5;
    return winner === candidateColor ? 1 : 0;
}

function collectOnnxDiagnostics(matchPayload) {
    const runtime = matchPayload && matchPayload.runtimeStatus ? matchPayload.runtimeStatus : {};
    const onnxLoaded = !!(runtime.onnx && runtime.onnx.loaded === true);
    const logs = Array.isArray(matchPayload && matchPayload.consoleMessages) ? matchPayload.consoleMessages : [];
    let runtimeErrorCount = 0;
    for (const log of logs) {
        const text = String(log && log.text ? log.text : '');
        if (!text) continue;
        if (text.includes('[CPU] policy-onnx runtime failed')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx not loaded')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx loading failed')) runtimeErrorCount += 1;
    }
    return { onnxLoaded, runtimeErrorCount };
}

function computeOnnxGateDecision(perSeed, options, diagnostics) {
    if (!Array.isArray(perSeed) || perSeed.length <= 0) {
        return {
            averageScore: 0,
            minSeedScore: 0,
            threshold: options.threshold,
            requiredMinSeedScore: options.minSeedScore,
            requiredMinSeedPassCount: options.minSeedPassCount,
            seedCount: 0,
            seedPassCount: 0,
            onnxLoadedMatches: 0,
            totalMatches: 0,
            runtimeErrorCount: 0,
            matchErrorCount: 0,
            passedByAverage: false,
            passedByMinSeedScore: false,
            passedBySeedPassCount: false,
            passedByOnnxLoaded: false,
            passedByNoRuntimeErrors: false,
            passedByNoMatchErrors: false,
            passed: false
        };
    }

    let scoreSum = 0;
    let minSeedScore = Infinity;
    let seedPassCount = 0;
    for (const one of perSeed) {
        const score = Number(one && one.candidateScore) || 0;
        scoreSum += score;
        if (score < minSeedScore) minSeedScore = score;
        if (score >= options.threshold) seedPassCount += 1;
    }
    if (!Number.isFinite(minSeedScore)) minSeedScore = 0;
    const averageScore = scoreSum / perSeed.length;

    const totalMatches = Number(diagnostics && diagnostics.totalMatches) || 0;
    const onnxLoadedMatches = Number(diagnostics && diagnostics.onnxLoadedMatches) || 0;
    const runtimeErrorCount = Number(diagnostics && diagnostics.runtimeErrorCount) || 0;
    const matchErrorCount = Number(diagnostics && diagnostics.matchErrorCount) || 0;

    const passedByAverage = averageScore >= options.threshold;
    const passedByMinSeedScore = minSeedScore >= options.minSeedScore;
    const passedBySeedPassCount = seedPassCount >= options.minSeedPassCount;
    const passedByOnnxLoaded = totalMatches > 0 && onnxLoadedMatches >= totalMatches;
    const passedByNoRuntimeErrors = runtimeErrorCount === 0;
    const passedByNoMatchErrors = matchErrorCount === 0;
    const passed = passedByAverage &&
        passedByMinSeedScore &&
        passedBySeedPassCount &&
        passedByOnnxLoaded &&
        passedByNoRuntimeErrors &&
        passedByNoMatchErrors;

    return {
        averageScore,
        minSeedScore,
        threshold: options.threshold,
        requiredMinSeedScore: options.minSeedScore,
        requiredMinSeedPassCount: options.minSeedPassCount,
        seedCount: perSeed.length,
        seedPassCount,
        onnxLoadedMatches,
        totalMatches,
        runtimeErrorCount,
        matchErrorCount,
        passedByAverage,
        passedByMinSeedScore,
        passedBySeedPassCount,
        passedByOnnxLoaded,
        passedByNoRuntimeErrors,
        passedByNoMatchErrors,
        passed
    };
}

function runUiLevelMatch(options) {
    const outPath = path.resolve(
        process.cwd(),
        'data',
        'runs',
        `onnx-gate.match.${process.pid}.${Date.now()}.${Math.floor(Math.random() * 100000)}.json`
    );
    const args = [
        path.resolve('scripts', 'run-ui-level-match.js'),
        '--black', String(options.blackLevel),
        '--white', String(options.whiteLevel),
        '--seed', String(options.seed),
        '--timeout-ms', String(options.timeoutMs),
        '--out', outPath
    ];
    const shown = [process.execPath].concat(args).join(' ');
    if (options.verbose) console.log(`[onnx-gate] run: ${shown}`);
    // Prevent one hung browser match from stalling the whole training cycle.
    const spawnTimeoutMs = Math.max(120000, options.timeoutMs + 60000);
    const result = spawnSync(process.execPath, args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: options.verbose ? 'inherit' : 'pipe',
        timeout: spawnTimeoutMs,
        killSignal: 'SIGKILL'
    });
    if (result.error) {
        if (result.error.code === 'ETIMEDOUT') {
            throw new Error(`run-ui-level-match timed out (spawn timeout ${spawnTimeoutMs}ms, game timeout ${options.timeoutMs}ms)`);
        }
        throw result.error;
    }
    if (result.status !== 0) {
        const stderr = (result.stderr && result.stderr.length > 0) ? String(result.stderr) : '';
        throw new Error(`run-ui-level-match failed (exit=${result.status}) ${stderr.trim()}`);
    }
    try {
        return JSON.parse(fs.readFileSync(outPath, 'utf8'));
    } finally {
        try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
    }
}

function runOnnxGate(options) {
    const backupOnnx = backupFile(options.targetOnnxPath);
    const backupOnnxMeta = backupFile(options.targetOnnxMetaPath);
    const seeds = buildSeedList(options.seed, options.seedCount, options.seedStride);
    const perSeed = [];
    const diagnostics = {
        totalMatches: 0,
        onnxLoadedMatches: 0,
        runtimeErrorCount: 0,
        matchErrorCount: 0,
        maxTotalMs: options.maxTotalMs,
        timedOut: false
    };
    const gateStartedAt = Date.now();

    fs.mkdirSync(path.dirname(options.targetOnnxPath), { recursive: true });
    fs.mkdirSync(path.dirname(options.targetOnnxMetaPath), { recursive: true });
    const sameOnnxPath = path.resolve(options.candidateOnnxPath) === path.resolve(options.targetOnnxPath);
    const sameOnnxMetaPath = path.resolve(options.candidateOnnxMetaPath) === path.resolve(options.targetOnnxMetaPath);
    if (!sameOnnxPath) fs.copyFileSync(options.candidateOnnxPath, options.targetOnnxPath);
    if (!sameOnnxMetaPath) fs.copyFileSync(options.candidateOnnxMetaPath, options.targetOnnxMetaPath);

    try {
        for (const seed of seeds) {
            let scoreSum = 0;
            let matchCount = 0;
            const totals = { win: 0, draw: 0, loss: 0 };
            for (let gameIndex = 0; gameIndex < options.games; gameIndex++) {
                if (options.maxTotalMs > 0 && (Date.now() - gateStartedAt) >= options.maxTotalMs) {
                    diagnostics.timedOut = true;
                    diagnostics.matchErrorCount += 1;
                    break;
                }
                const gameSeed = seed + gameIndex;
                const runs = [
                    {
                        candidateColor: 'black',
                        options: {
                            blackLevel: options.blackLevel,
                            whiteLevel: options.whiteLevel,
                            seed: gameSeed,
                            timeoutMs: options.timeoutMs,
                            verbose: options.verbose
                        }
                    },
                    {
                        candidateColor: 'white',
                        options: {
                            blackLevel: options.whiteLevel,
                            whiteLevel: options.blackLevel,
                            seed: gameSeed,
                            timeoutMs: options.timeoutMs,
                            verbose: options.verbose
                        }
                    }
                ];

                for (const oneRun of runs) {
                    if (options.maxTotalMs > 0 && (Date.now() - gateStartedAt) >= options.maxTotalMs) {
                        diagnostics.timedOut = true;
                        diagnostics.matchErrorCount += 1;
                        break;
                    }
                    if (!options.verbose) {
                        console.log(`[onnx-gate] match-start seed=${gameSeed} candidateColor=${oneRun.candidateColor} totalMatches=${diagnostics.totalMatches + 1}`);
                    }
                    diagnostics.totalMatches += 1;
                    matchCount += 1;
                    try {
                        const payload = runUiLevelMatch(oneRun.options);
                        const score = scoreWinnerForCandidate(payload.result.winner, oneRun.candidateColor);
                        scoreSum += score;
                        if (score === 1) totals.win += 1;
                        else if (score === 0.5) totals.draw += 1;
                        else totals.loss += 1;

                        const diag = collectOnnxDiagnostics(payload);
                        if (diag.onnxLoaded) diagnostics.onnxLoadedMatches += 1;
                        diagnostics.runtimeErrorCount += diag.runtimeErrorCount;
                    } catch (err) {
                        diagnostics.matchErrorCount += 1;
                        totals.loss += 1;
                        const msg = err && err.message ? err.message : String(err);
                        if (msg.includes('timed out')) {
                            diagnostics.timedOut = true;
                        }
                        if (options.verbose) {
                            console.warn(`[onnx-gate] match failed seed=${gameSeed} candidateColor=${oneRun.candidateColor}: ${msg}`);
                        }
                    }
                }
                if (diagnostics.timedOut) break;
                if (!options.verbose && diagnostics.totalMatches > 0 && (diagnostics.totalMatches % 8) === 0) {
                    console.log(`[onnx-gate] progress matches=${diagnostics.totalMatches} timedOut=${diagnostics.timedOut}`);
                }
            }

            const seedScore = matchCount > 0 ? (scoreSum / matchCount) : 0;
            perSeed.push({
                seed,
                candidateScore: seedScore,
                matches: matchCount,
                totals
            });

            if (diagnostics.timedOut) break;
        }
    } finally {
        restoreFile(options.targetOnnxPath, backupOnnx);
        restoreFile(options.targetOnnxMetaPath, backupOnnxMeta);
    }

    const decision = computeOnnxGateDecision(perSeed, options, diagnostics);
    return {
        generatedAt: new Date().toISOString(),
        config: {
            games: options.games,
            seed: options.seed,
            seedCount: options.seedCount,
            seedStride: options.seedStride,
            threshold: options.threshold,
            minSeedScore: options.minSeedScore,
            minSeedPassCount: options.minSeedPassCount,
            blackLevel: options.blackLevel,
            whiteLevel: options.whiteLevel,
            timeoutMs: options.timeoutMs,
            maxTotalMs: options.maxTotalMs,
            candidateOnnxPath: options.candidateOnnxPath,
            candidateOnnxMetaPath: options.candidateOnnxMetaPath
        },
        perSeed,
        diagnostics,
        decision
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    const payload = runOnnxGate(args);
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(payload, null, 2), 'utf8');
        console.log(`[onnx-gate] wrote: ${args.out}`);
    }
    const d = payload.decision;
    console.log(
        `[onnx-gate] avg=${d.averageScore.toFixed(3)} min_seed=${d.minSeedScore.toFixed(3)} threshold=${d.threshold.toFixed(3)} ` +
        `seed_pass=${d.seedPassCount}/${d.seedCount} onnx_loaded=${d.onnxLoadedMatches}/${d.totalMatches} ` +
        `runtime_errors=${d.runtimeErrorCount} match_errors=${d.matchErrorCount} pass=${d.passed}`
    );
    process.exit(d.passed ? 0 : 2);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[onnx-gate] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    buildSeedList,
    computeOnnxGateDecision
};
