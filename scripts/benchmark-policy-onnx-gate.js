#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const {
    loadResolvedTrainingConfig,
    applyOnnxGateArgsFromResolvedConfig
} = require('./training-resolved-config-utils');

function defaultJobs() {
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    return Math.max(1, Math.min(12, cpuCount));
}

function parseArgs(argv) {
    const args = {
        games: 8,
        seed: 1,
        seedCount: 1,
        seedStride: 1000,
        jobs: defaultJobs(),
        threshold: 0.5,
        minSeedScore: 0,
        minSeedPassCount: 0,
        blackLevel: 6,
        whiteLevel: 6,
        candidateColorMode: 'both',
        timeoutMs: 180000,
        matchRetries: 1,
        maxTotalMs: 900000,
        candidateOnnxPath: null,
        candidateOnnxMetaPath: null,
        candidateCardOnnxPath: null,
        candidateCardOnnxMetaPath: null,
        targetOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx'),
        targetOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-net.onnx.meta.json'),
        targetCardOnnxPath: path.resolve(process.cwd(), 'data', 'models', 'policy-card.onnx'),
        targetCardOnnxMetaPath: path.resolve(process.cwd(), 'data', 'models', 'policy-card.onnx.meta.json'),
        resolvedConfigPath: null,
        out: null,
        verbose: false,
        help: false
    };
    const specified = new Set();

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--games' || a === '-g') { args.games = Number(argv[++i]); specified.add('games'); continue; }
        if (a === '--seed' || a === '-s') { args.seed = Number(argv[++i]); specified.add('seed'); continue; }
        if (a === '--seed-count') { args.seedCount = Number(argv[++i]); specified.add('seedCount'); continue; }
        if (a === '--seed-stride') { args.seedStride = Number(argv[++i]); specified.add('seedStride'); continue; }
        if (a === '--jobs' || a === '-j') { args.jobs = Number(argv[++i]); specified.add('jobs'); continue; }
        if (a === '--threshold') { args.threshold = Number(argv[++i]); specified.add('threshold'); continue; }
        if (a === '--min-seed-score') { args.minSeedScore = Number(argv[++i]); specified.add('minSeedScore'); continue; }
        if (a === '--min-seed-pass-count') { args.minSeedPassCount = Number(argv[++i]); specified.add('minSeedPassCount'); continue; }
        if (a === '--black-level') { args.blackLevel = Number(argv[++i]); specified.add('blackLevel'); continue; }
        if (a === '--white-level') { args.whiteLevel = Number(argv[++i]); specified.add('whiteLevel'); continue; }
        if (a === '--candidate-color-mode') { args.candidateColorMode = String(argv[++i] || '').toLowerCase(); specified.add('candidateColorMode'); continue; }
        if (a === '--timeout-ms') { args.timeoutMs = Number(argv[++i]); specified.add('timeoutMs'); continue; }
        if (a === '--match-retries') { args.matchRetries = Number(argv[++i]); specified.add('matchRetries'); continue; }
        if (a === '--max-total-ms') { args.maxTotalMs = Number(argv[++i]); specified.add('maxTotalMs'); continue; }
        if (a === '--candidate-onnx') { args.candidateOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateOnnxPath'); continue; }
        if (a === '--candidate-onnx-meta') { args.candidateOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateOnnxMetaPath'); continue; }
        if (a === '--candidate-card-onnx') { args.candidateCardOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateCardOnnxPath'); continue; }
        if (a === '--candidate-card-onnx-meta') { args.candidateCardOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateCardOnnxMetaPath'); continue; }
        if (a === '--target-onnx') { args.targetOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetOnnxPath'); continue; }
        if (a === '--target-onnx-meta') { args.targetOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetOnnxMetaPath'); continue; }
        if (a === '--target-card-onnx') { args.targetCardOnnxPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetCardOnnxPath'); continue; }
        if (a === '--target-card-onnx-meta') { args.targetCardOnnxMetaPath = path.resolve(process.cwd(), argv[++i]); specified.add('targetCardOnnxMetaPath'); continue; }
        if (a === '--resolved-config') { args.resolvedConfigPath = path.resolve(process.cwd(), argv[++i]); specified.add('resolvedConfigPath'); continue; }
        if (a === '--out' || a === '-o') { args.out = path.resolve(process.cwd(), argv[++i]); specified.add('out'); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.resolvedConfigPath) {
        const resolvedConfig = loadResolvedTrainingConfig(args.resolvedConfigPath);
        applyOnnxGateArgsFromResolvedConfig(args, specified, resolvedConfig);
    }

    if (args.help) return args;

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.seedCount) || args.seedCount < 1) throw new Error('--seed-count must be >= 1');
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    if (!Number.isFinite(args.jobs) || args.jobs < 1) throw new Error('--jobs must be >= 1');
    args.jobs = Math.floor(args.jobs);
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) throw new Error('--threshold must be in [0,1]');
    if (!Number.isFinite(args.minSeedScore) || args.minSeedScore < 0 || args.minSeedScore > 1) throw new Error('--min-seed-score must be in [0,1]');
    if (!Number.isFinite(args.minSeedPassCount) || args.minSeedPassCount < 0) throw new Error('--min-seed-pass-count must be >= 0');
    args.minSeedPassCount = Math.floor(args.minSeedPassCount);
    if (args.minSeedPassCount > args.seedCount) throw new Error('--min-seed-pass-count must be <= --seed-count');
    if (!Number.isFinite(args.blackLevel) || args.blackLevel < 1 || args.blackLevel > 6) throw new Error('--black-level must be in [1,6]');
    if (!Number.isFinite(args.whiteLevel) || args.whiteLevel < 1 || args.whiteLevel > 6) throw new Error('--white-level must be in [1,6]');
    if (!['both', 'white'].includes(args.candidateColorMode)) {
        throw new Error('--candidate-color-mode must be one of: both, white');
    }
    if (!Number.isFinite(args.timeoutMs) || args.timeoutMs < 1000) throw new Error('--timeout-ms must be >= 1000');
    if (!Number.isFinite(args.matchRetries) || args.matchRetries < 0) throw new Error('--match-retries must be >= 0');
    args.matchRetries = Math.floor(args.matchRetries);
    if (!Number.isFinite(args.maxTotalMs) || args.maxTotalMs < 0) throw new Error('--max-total-ms must be >= 0');
    if (!args.candidateOnnxPath) throw new Error('--candidate-onnx is required');
    if (!args.candidateOnnxMetaPath) args.candidateOnnxMetaPath = `${args.candidateOnnxPath}.meta.json`;
    if (!fs.existsSync(args.candidateOnnxPath)) throw new Error(`candidate onnx not found: ${args.candidateOnnxPath}`);
    if (!fs.existsSync(args.candidateOnnxMetaPath)) throw new Error(`candidate onnx meta not found: ${args.candidateOnnxMetaPath}`);
    if (args.candidateCardOnnxPath) {
        if (!args.candidateCardOnnxMetaPath) args.candidateCardOnnxMetaPath = `${args.candidateCardOnnxPath}.meta.json`;
        if (!fs.existsSync(args.candidateCardOnnxPath)) throw new Error(`candidate card onnx not found: ${args.candidateCardOnnxPath}`);
        if (!fs.existsSync(args.candidateCardOnnxMetaPath)) throw new Error(`candidate card onnx meta not found: ${args.candidateCardOnnxMetaPath}`);
    }

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
        '  -j, --jobs <n>               Parallel match workers (default: auto, up to 12)',
        '      --threshold <r>          Required average score [0..1] (default: 0.5)',
        '      --min-seed-score <r>     Required minimum per-seed score [0..1] (default: 0)',
        '      --min-seed-pass-count <n> Required count of seeds scoring >= threshold (default: 0)',
        '      --black-level <n>        Candidate side level when black (default: 6)',
        '      --white-level <n>        Baseline side level when white (default: 6)',
        '      --candidate-color-mode <m> Candidate side usage: both | white (default: both)',
        '      --timeout-ms <n>         Per-match timeout (default: 180000)',
        '      --match-retries <n>      Retry count for a failed match (default: 1)',
        '      --max-total-ms <n>       Total gate time budget in ms (default: 900000, 0=off)',
        '      --candidate-onnx <path>  Candidate ONNX file path (required)',
        '      --candidate-onnx-meta <path> Candidate ONNX meta path (default: <candidate>.meta.json)',
        '      --candidate-card-onnx <path> Optional candidate card-specialist ONNX path',
        '      --candidate-card-onnx-meta <path> Candidate card-specialist meta path (default: <candidate-card>.meta.json)',
        '      --target-onnx <path>     Deployed ONNX path used by browser runtime',
        '      --target-onnx-meta <path> Deployed ONNX meta path used by browser runtime',
        '      --target-card-onnx <path> Deployed card-specialist ONNX path used by browser runtime',
        '      --target-card-onnx-meta <path> Deployed card-specialist meta path used by browser runtime',
        '      --resolved-config <path> Apply defaults from a resolved training profile JSON',
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
    const onnxStatus = runtime.onnx && typeof runtime.onnx === 'object' ? runtime.onnx : null;
    const onnxLoaded = !!(onnxStatus && onnxStatus.loaded === true);
    const cardModelLoaded = !!(onnxStatus && onnxStatus.cardModelLoaded === true);
    const logs = Array.isArray(matchPayload && matchPayload.consoleMessages) ? matchPayload.consoleMessages : [];
    let runtimeErrorCount = 0;
    let cardRuntimeErrorCount = 0;
    for (const log of logs) {
        const text = String(log && log.text ? log.text : '');
        if (!text) continue;
        if (text.includes('[CPU] policy-onnx runtime failed')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx not loaded')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-onnx loading failed')) runtimeErrorCount += 1;
        if (text.includes('[CPU] policy-card runtime failed')) cardRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-card not loaded')) cardRuntimeErrorCount += 1;
        if (text.includes('[CPU] policy-card loading failed')) cardRuntimeErrorCount += 1;
    }
    return { onnxLoaded, runtimeErrorCount, cardModelLoaded, cardRuntimeErrorCount };
}

function computeOnnxGateDecision(perSeed, options, diagnostics) {
    const requireCardLoaded = !!(diagnostics && diagnostics.requireCardLoaded);
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
            cardLoadedMatches: 0,
            totalMatches: 0,
            runtimeErrorCount: 0,
            cardRuntimeErrorCount: 0,
            matchErrorCount: 0,
            passedByAverage: false,
            passedByMinSeedScore: false,
            passedBySeedPassCount: false,
            passedByOnnxLoaded: false,
            passedByNoRuntimeErrors: false,
            passedByCardLoaded: !requireCardLoaded,
            passedByNoCardRuntimeErrors: !requireCardLoaded,
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
    const cardLoadedMatches = Number(diagnostics && diagnostics.cardLoadedMatches) || 0;
    const runtimeErrorCount = Number(diagnostics && diagnostics.runtimeErrorCount) || 0;
    const cardRuntimeErrorCount = Number(diagnostics && diagnostics.cardRuntimeErrorCount) || 0;
    const matchErrorCount = Number(diagnostics && diagnostics.matchErrorCount) || 0;

    const passedByAverage = averageScore >= options.threshold;
    const passedByMinSeedScore = minSeedScore >= options.minSeedScore;
    const passedBySeedPassCount = seedPassCount >= options.minSeedPassCount;
    const passedByOnnxLoaded = totalMatches > 0 && onnxLoadedMatches >= totalMatches;
    const passedByCardLoaded = !requireCardLoaded || (totalMatches > 0 && cardLoadedMatches >= totalMatches);
    const passedByNoRuntimeErrors = runtimeErrorCount === 0;
    const passedByNoCardRuntimeErrors = !requireCardLoaded || cardRuntimeErrorCount === 0;
    const passedByNoMatchErrors = matchErrorCount === 0;
    const passed = passedByAverage &&
        passedByMinSeedScore &&
        passedBySeedPassCount &&
        passedByOnnxLoaded &&
        passedByCardLoaded &&
        passedByNoRuntimeErrors &&
        passedByNoCardRuntimeErrors &&
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
        cardLoadedMatches,
        totalMatches,
        runtimeErrorCount,
        cardRuntimeErrorCount,
        matchErrorCount,
        passedByAverage,
        passedByMinSeedScore,
        passedBySeedPassCount,
        passedByOnnxLoaded,
        passedByCardLoaded,
        passedByNoRuntimeErrors,
        passedByNoCardRuntimeErrors,
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
        '--require-onnx-loaded',
        '--onnx-wait-ms', String(options.onnxWaitMs || Math.max(10000, Math.floor(options.timeoutMs * 0.5))),
        '--out', outPath
    ];
    const shown = [process.execPath].concat(args).join(' ');
    if (options.verbose) console.log(`[onnx-gate] run: ${shown}`);
    const spawnTimeoutMs = Math.max(120000, options.timeoutMs + 60000);

    return new Promise((resolve, reject) => {
        let stderr = '';
        const child = spawn(process.execPath, args, {
            cwd: process.cwd(),
            env: process.env,
            stdio: options.verbose ? 'inherit' : 'pipe',
            timeout: spawnTimeoutMs,
            killSignal: 'SIGKILL'
        });

        if (!options.verbose && child.stderr) {
            child.stderr.on('data', (chunk) => { stderr += String(chunk); });
        }
        child.once('error', (err) => {
            reject(err);
        });
        child.once('close', (code, signal) => {
            if (code !== 0) {
                const timeoutLike = code === null && signal === 'SIGKILL';
                if (timeoutLike) {
                    reject(new Error(`run-ui-level-match timed out (spawn timeout ${spawnTimeoutMs}ms, game timeout ${options.timeoutMs}ms)`));
                    return;
                }
                const suffix = stderr.trim();
                reject(new Error(`run-ui-level-match failed (exit=${code} signal=${signal || 'none'}) ${suffix}`));
                return;
            }
            try {
                const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
                resolve(payload);
            } catch (err) {
                reject(err);
            } finally {
                try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
            }
        });
    });
}

function buildMatchTasks(options, seeds) {
    const tasks = [];
    for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
        const seed = seeds[seedIndex];
        for (let gameIndex = 0; gameIndex < options.games; gameIndex++) {
            const gameSeed = seed + gameIndex;
            if (options.candidateColorMode !== 'white') {
                tasks.push({
                    seedIndex,
                    seed,
                    gameSeed,
                    candidateColor: 'black',
                    blackLevel: options.blackLevel,
                    whiteLevel: options.whiteLevel
                });
            }
            tasks.push({
                seedIndex,
                seed,
                gameSeed,
                candidateColor: 'white',
                blackLevel: options.whiteLevel,
                whiteLevel: options.blackLevel
            });
        }
    }
    return tasks;
}

async function runOnnxGate(options) {
    const requireCardLoaded = !!options.candidateCardOnnxPath;
    const backupOnnx = backupFile(options.targetOnnxPath);
    const backupOnnxMeta = backupFile(options.targetOnnxMetaPath);
    const backupCardOnnx = requireCardLoaded ? backupFile(options.targetCardOnnxPath) : null;
    const backupCardOnnxMeta = requireCardLoaded ? backupFile(options.targetCardOnnxMetaPath) : null;
    const seeds = buildSeedList(options.seed, options.seedCount, options.seedStride);
    const seedState = seeds.map((seed) => ({
        seed,
        scoreSum: 0,
        matchCount: 0,
        totals: { win: 0, draw: 0, loss: 0 }
    }));
    const diagnostics = {
        totalMatches: 0,
        onnxLoadedMatches: 0,
        cardLoadedMatches: 0,
        runtimeErrorCount: 0,
        cardRuntimeErrorCount: 0,
        matchErrorCount: 0,
        matchRetryCount: 0,
        maxTotalMs: options.maxTotalMs,
        timedOut: false,
        requireCardLoaded
    };
    const gateStartedAt = Date.now();

    fs.mkdirSync(path.dirname(options.targetOnnxPath), { recursive: true });
    fs.mkdirSync(path.dirname(options.targetOnnxMetaPath), { recursive: true });
    const sameOnnxPath = path.resolve(options.candidateOnnxPath) === path.resolve(options.targetOnnxPath);
    const sameOnnxMetaPath = path.resolve(options.candidateOnnxMetaPath) === path.resolve(options.targetOnnxMetaPath);
    if (!sameOnnxPath) fs.copyFileSync(options.candidateOnnxPath, options.targetOnnxPath);
    if (!sameOnnxMetaPath) fs.copyFileSync(options.candidateOnnxMetaPath, options.targetOnnxMetaPath);
    if (requireCardLoaded) {
        fs.mkdirSync(path.dirname(options.targetCardOnnxPath), { recursive: true });
        fs.mkdirSync(path.dirname(options.targetCardOnnxMetaPath), { recursive: true });
        const sameCardOnnxPath = path.resolve(options.candidateCardOnnxPath) === path.resolve(options.targetCardOnnxPath);
        const sameCardOnnxMetaPath = path.resolve(options.candidateCardOnnxMetaPath) === path.resolve(options.targetCardOnnxMetaPath);
        if (!sameCardOnnxPath) fs.copyFileSync(options.candidateCardOnnxPath, options.targetCardOnnxPath);
        if (!sameCardOnnxMetaPath) fs.copyFileSync(options.candidateCardOnnxMetaPath, options.targetCardOnnxMetaPath);
    }

    try {
        const tasks = buildMatchTasks(options, seeds);
        const jobs = Math.max(1, Math.min(options.jobs, tasks.length));
        let cursor = 0;

        const runWorker = async () => {
            while (true) {
                if (diagnostics.timedOut) return;
                const taskIndex = cursor;
                if (taskIndex >= tasks.length) return;
                cursor += 1;

                if (options.maxTotalMs > 0 && (Date.now() - gateStartedAt) >= options.maxTotalMs) {
                    diagnostics.timedOut = true;
                    diagnostics.matchErrorCount += 1;
                    return;
                }

                const task = tasks[taskIndex];
                const state = seedState[task.seedIndex];
                if (!options.verbose) {
                    console.log(`[onnx-gate] match-start seed=${task.gameSeed} candidateColor=${task.candidateColor} totalMatches=${diagnostics.totalMatches + 1}`);
                }
                diagnostics.totalMatches += 1;
                state.matchCount += 1;
                let completed = false;
                let attempt = 0;
                const maxAttempts = 1 + Math.max(0, Number(options.matchRetries) || 0);
                while (!completed && attempt < maxAttempts) {
                    attempt += 1;
                    try {
                    const payload = await runUiLevelMatch({
                        blackLevel: task.blackLevel,
                        whiteLevel: task.whiteLevel,
                        seed: task.gameSeed,
                        timeoutMs: options.timeoutMs,
                        onnxWaitMs: Math.max(10000, Math.min(options.timeoutMs, 45000)),
                        verbose: options.verbose
                    });
                        const score = scoreWinnerForCandidate(payload.result.winner, task.candidateColor);
                        state.scoreSum += score;
                        if (score === 1) state.totals.win += 1;
                        else if (score === 0.5) state.totals.draw += 1;
                        else state.totals.loss += 1;

                        const diag = collectOnnxDiagnostics(payload);
                        if (diag.onnxLoaded) diagnostics.onnxLoadedMatches += 1;
                        if (requireCardLoaded && diag.cardModelLoaded) diagnostics.cardLoadedMatches += 1;
                        diagnostics.runtimeErrorCount += diag.runtimeErrorCount;
                        diagnostics.cardRuntimeErrorCount += diag.cardRuntimeErrorCount;
                        completed = true;
                    } catch (err) {
                        const msg = err && err.message ? err.message : String(err);
                        const hasRetry = attempt < maxAttempts;
                        if (hasRetry) {
                            diagnostics.matchRetryCount += 1;
                            if (options.verbose) {
                                console.warn(`[onnx-gate] match retry ${attempt}/${maxAttempts - 1} seed=${task.gameSeed} candidateColor=${task.candidateColor}: ${msg}`);
                            }
                            continue;
                        }
                        diagnostics.matchErrorCount += 1;
                        state.totals.loss += 1;
                        if (msg.includes('timed out')) diagnostics.timedOut = true;
                        if (options.verbose) {
                            console.warn(`[onnx-gate] match failed seed=${task.gameSeed} candidateColor=${task.candidateColor}: ${msg}`);
                        }
                        completed = true;
                    }
                }
                if (!options.verbose && diagnostics.totalMatches > 0 && (diagnostics.totalMatches % 8) === 0) {
                    console.log(`[onnx-gate] progress matches=${diagnostics.totalMatches} timedOut=${diagnostics.timedOut}`);
                }
            }
        };

        const workers = [];
        for (let i = 0; i < jobs; i++) workers.push(runWorker());
        await Promise.all(workers);
    } finally {
        restoreFile(options.targetOnnxPath, backupOnnx);
        restoreFile(options.targetOnnxMetaPath, backupOnnxMeta);
        if (requireCardLoaded) {
            restoreFile(options.targetCardOnnxPath, backupCardOnnx);
            restoreFile(options.targetCardOnnxMetaPath, backupCardOnnxMeta);
        }
    }

    const perSeed = [];
    for (const state of seedState) {
        if (state.matchCount <= 0) continue;
        perSeed.push({
            seed: state.seed,
            candidateScore: state.matchCount > 0 ? (state.scoreSum / state.matchCount) : 0,
            matches: state.matchCount,
            totals: state.totals
        });
    }

    const decision = computeOnnxGateDecision(perSeed, options, diagnostics);
    return {
        generatedAt: new Date().toISOString(),
        config: {
            games: options.games,
            seed: options.seed,
            seedCount: options.seedCount,
            seedStride: options.seedStride,
            jobs: options.jobs,
            threshold: options.threshold,
            minSeedScore: options.minSeedScore,
            minSeedPassCount: options.minSeedPassCount,
            blackLevel: options.blackLevel,
            whiteLevel: options.whiteLevel,
            candidateColorMode: options.candidateColorMode,
            timeoutMs: options.timeoutMs,
            matchRetries: options.matchRetries,
            maxTotalMs: options.maxTotalMs,
            candidateOnnxPath: options.candidateOnnxPath,
            candidateOnnxMetaPath: options.candidateOnnxMetaPath,
            candidateCardOnnxPath: options.candidateCardOnnxPath || null,
            candidateCardOnnxMetaPath: options.candidateCardOnnxMetaPath || null
        },
        perSeed,
        diagnostics,
        decision
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }
    const payload = await runOnnxGate(args);
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(payload, null, 2), 'utf8');
        console.log(`[onnx-gate] wrote: ${args.out}`);
    }
    const d = payload.decision;
    console.log(
        `[onnx-gate] avg=${d.averageScore.toFixed(3)} min_seed=${d.minSeedScore.toFixed(3)} threshold=${d.threshold.toFixed(3)} ` +
        `seed_pass=${d.seedPassCount}/${d.seedCount} onnx_loaded=${d.onnxLoadedMatches}/${d.totalMatches} ` +
        `card_loaded=${d.cardLoadedMatches}/${d.totalMatches} runtime_errors=${d.runtimeErrorCount} ` +
        `card_runtime_errors=${d.cardRuntimeErrorCount} match_errors=${d.matchErrorCount} pass=${d.passed}`
    );
    process.exit(d.passed ? 0 : 2);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[onnx-gate] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    buildSeedList,
    computeOnnxGateDecision,
    runOnnxGate
};
