#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function parseArgs(argv) {
    const args = {
        iterations: 1,
        maxHours: 6,
        trainGames: 12000,
        evalGames: 2000,
        seed: 1,
        seedStride: 1000,
        evalSeedOffset: 100000,
        maxPlies: 220,
        allowCardUsage: true,
        cardUsageRate: 0.25,
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
        onnxEpochs: 8,
        onnxBatchSize: 2048,
        onnxLr: 0.001,
        onnxHiddenSize: 256,
        onnxDevice: 'auto',
        onnxLogIntervalSteps: 0,
        onnxValSplit: 0.1,
        onnxEarlyStopPatience: 0,
        onnxEarlyStopMinDelta: 0.0,
        onnxEarlyStopMonitor: 'val_loss',
        minVisits: 12,
        shapeImmediate: 0.4,
        quickGames: 500,
        finalGames: 2000,
        threshold: 0.05,
        promoteOnPass: true,
        bootstrapPolicyModelPath: null,
        resumeCheckpointPath: null,
        runTag: null,
        runsDir: path.resolve(process.cwd(), 'data', 'runs'),
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        summaryOut: null,
        verbose: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') { args.help = true; continue; }
        if (a === '--iterations' || a === '-n') { args.iterations = Number(argv[++i]); continue; }
        if (a === '--max-hours') { args.maxHours = Number(argv[++i]); continue; }
        if (a === '--train-games') { args.trainGames = Number(argv[++i]); continue; }
        if (a === '--eval-games') { args.evalGames = Number(argv[++i]); continue; }
        if (a === '--seed' || a === '-s') { args.seed = Number(argv[++i]); continue; }
        if (a === '--seed-stride') { args.seedStride = Number(argv[++i]); continue; }
        if (a === '--eval-seed-offset') { args.evalSeedOffset = Number(argv[++i]); continue; }
        if (a === '--max-plies') { args.maxPlies = Number(argv[++i]); continue; }
        if (a === '--with-cards') { args.allowCardUsage = true; continue; }
        if (a === '--no-cards') { args.allowCardUsage = false; continue; }
        if (a === '--card-usage-rate') { args.cardUsageRate = Number(argv[++i]); continue; }
        if (a === '--python') { args.pythonPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--onnx-epochs') { args.onnxEpochs = Number(argv[++i]); continue; }
        if (a === '--onnx-batch-size') { args.onnxBatchSize = Number(argv[++i]); continue; }
        if (a === '--onnx-lr') { args.onnxLr = Number(argv[++i]); continue; }
        if (a === '--onnx-hidden-size') { args.onnxHiddenSize = Number(argv[++i]); continue; }
        if (a === '--onnx-device') { args.onnxDevice = String(argv[++i] || '').trim().toLowerCase() || 'auto'; continue; }
        if (a === '--onnx-log-interval-steps') { args.onnxLogIntervalSteps = Number(argv[++i]); continue; }
        if (a === '--onnx-val-split') { args.onnxValSplit = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-patience') { args.onnxEarlyStopPatience = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-min-delta') { args.onnxEarlyStopMinDelta = Number(argv[++i]); continue; }
        if (a === '--onnx-early-stop-monitor') { args.onnxEarlyStopMonitor = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (a === '--min-visits') { args.minVisits = Number(argv[++i]); continue; }
        if (a === '--shape-immediate') { args.shapeImmediate = Number(argv[++i]); continue; }
        if (a === '--quick-games') { args.quickGames = Number(argv[++i]); continue; }
        if (a === '--final-games') { args.finalGames = Number(argv[++i]); continue; }
        if (a === '--threshold') { args.threshold = Number(argv[++i]); continue; }
        if (a === '--promote') { args.promoteOnPass = true; continue; }
        if (a === '--no-promote') { args.promoteOnPass = false; continue; }
        if (a === '--bootstrap-policy-model') { args.bootstrapPolicyModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--resume-checkpoint') { args.resumeCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--run-tag') { args.runTag = String(argv[++i] || '').trim(); continue; }
        if (a === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--summary-out') { args.summaryOut = path.resolve(process.cwd(), argv[++i]); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.help) return args;

    if (!Number.isFinite(args.iterations) || args.iterations < 1) throw new Error('--iterations must be >= 1');
    if (!Number.isFinite(args.maxHours) || args.maxHours <= 0) throw new Error('--max-hours must be > 0');
    if (!Number.isFinite(args.trainGames) || args.trainGames < 1) throw new Error('--train-games must be >= 1');
    if (!Number.isFinite(args.evalGames) || args.evalGames < 1) throw new Error('--eval-games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    if (!Number.isFinite(args.evalSeedOffset) || args.evalSeedOffset < 1) throw new Error('--eval-seed-offset must be >= 1');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.cardUsageRate) || args.cardUsageRate < 0 || args.cardUsageRate > 1) {
        throw new Error('--card-usage-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.onnxEpochs) || args.onnxEpochs < 1) throw new Error('--onnx-epochs must be >= 1');
    if (!Number.isFinite(args.onnxBatchSize) || args.onnxBatchSize < 1) throw new Error('--onnx-batch-size must be >= 1');
    if (!Number.isFinite(args.onnxLr) || args.onnxLr <= 0) throw new Error('--onnx-lr must be > 0');
    if (!Number.isFinite(args.onnxHiddenSize) || args.onnxHiddenSize < 8) throw new Error('--onnx-hidden-size must be >= 8');
    if (args.onnxDevice !== 'auto' && args.onnxDevice !== 'cpu' && args.onnxDevice !== 'cuda') {
        throw new Error('--onnx-device must be one of auto/cpu/cuda');
    }
    if (!Number.isFinite(args.onnxLogIntervalSteps) || args.onnxLogIntervalSteps < 0) {
        throw new Error('--onnx-log-interval-steps must be >= 0');
    }
    if (!Number.isFinite(args.onnxValSplit) || args.onnxValSplit < 0 || args.onnxValSplit >= 0.5) {
        throw new Error('--onnx-val-split must be in [0,0.5)');
    }
    if (!Number.isFinite(args.onnxEarlyStopPatience) || args.onnxEarlyStopPatience < 0) {
        throw new Error('--onnx-early-stop-patience must be >= 0');
    }
    if (!Number.isFinite(args.onnxEarlyStopMinDelta) || args.onnxEarlyStopMinDelta < 0) {
        throw new Error('--onnx-early-stop-min-delta must be >= 0');
    }
    if (args.onnxEarlyStopMonitor !== 'val_loss' && args.onnxEarlyStopMonitor !== 'train_loss') {
        throw new Error('--onnx-early-stop-monitor must be val_loss or train_loss');
    }
    if (!Number.isFinite(args.minVisits) || args.minVisits < 1) throw new Error('--min-visits must be >= 1');
    if (!Number.isFinite(args.shapeImmediate) || args.shapeImmediate < 0 || args.shapeImmediate > 1) {
        throw new Error('--shape-immediate must be in [0,1]');
    }
    if (!Number.isFinite(args.quickGames) || args.quickGames < 1) throw new Error('--quick-games must be >= 1');
    if (!Number.isFinite(args.finalGames) || args.finalGames < 1) throw new Error('--final-games must be >= 1');
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) {
        throw new Error('--threshold must be in [0,1]');
    }
    if (args.bootstrapPolicyModelPath && !fs.existsSync(args.bootstrapPolicyModelPath)) {
        throw new Error(`--bootstrap-policy-model not found: ${args.bootstrapPolicyModelPath}`);
    }
    if (args.resumeCheckpointPath && !fs.existsSync(args.resumeCheckpointPath)) {
        throw new Error(`--resume-checkpoint not found: ${args.resumeCheckpointPath}`);
    }
    if (!args.runTag) args.runTag = makeRunTag();
    if (!args.summaryOut) args.summaryOut = path.resolve(args.runsDir, `training-cycle.${args.runTag}.json`);

    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-selfplay-training-cycle.js [options]',
        '',
        'Options:',
        '  -n, --iterations <n>        Number of full training cycles (default: 1)',
        '      --max-hours <h>         Time budget in hours (default: 6)',
        '      --train-games <n>       Self-play games for train data (default: 12000)',
        '      --eval-games <n>        Self-play games for eval data (default: 2000)',
        '  -s, --seed <n>              Base seed (default: 1)',
        '      --seed-stride <n>       Seed step per iteration (default: 1000)',
        '      --eval-seed-offset <n>  Eval seed offset from train seed (default: 100000)',
        '      --max-plies <n>         Max plies per game (default: 220)',
        '      --with-cards            Enable cards in self-play (default: on)',
        '      --no-cards              Disable cards in self-play',
        '      --card-usage-rate <r>   Card usage rate [0..1] (default: 0.25)',
        '      --python <path>         Python executable path (default: .venv/Scripts/python.exe)',
        '      --onnx-epochs <n>       train_policy_onnx --epochs (default: 8)',
        '      --onnx-batch-size <n>   train_policy_onnx --batch-size (default: 2048)',
        '      --onnx-lr <r>           train_policy_onnx --lr (default: 0.001)',
        '      --onnx-hidden-size <n>  train_policy_onnx --hidden-size (default: 256)',
        '      --onnx-device <mode>    train_policy_onnx --device auto/cpu/cuda (default: auto)',
        '      --onnx-log-interval-steps <n>  train_policy_onnx step log interval (default: 0=off)',
        '      --onnx-val-split <r>    train_policy_onnx --val-split [0..0.5) (default: 0.1)',
        '      --onnx-early-stop-patience <n> train_policy_onnx early stop patience (default: 0=off)',
        '      --onnx-early-stop-min-delta <r> train_policy_onnx early stop min delta (default: 0.0)',
        '      --onnx-early-stop-monitor <m> train_policy_onnx monitor val_loss/train_loss (default: val_loss)',
        '      --min-visits <n>        compatibility policy-table --min-visits (default: 12)',
        '      --shape-immediate <r>   compatibility policy-table --shape-immediate (default: 0.4)',
        '      --quick-games <n>       Adoption quick check games (default: 500)',
        '      --final-games <n>       Adoption final check games (default: 2000)',
        '      --threshold <r>         Required uplift threshold [0..1] (default: 0.05)',
        '      --promote               Promote model when final check passes (default: on)',
        '      --no-promote            Skip promotion even when final check passes',
        '      --bootstrap-policy-model <path>  Seed self-play with an existing policy-table JSON',
        '      --resume-checkpoint <path>       Resume ONNX training from checkpoint (.pt)',
        '      --run-tag <tag>         Tag appended to output filenames',
        '      --runs-dir <path>       Output directory for records/results (default: data/runs)',
        '      --models-dir <path>     Output directory for candidate models (default: data/models)',
        '      --summary-out <path>    Output summary JSON path',
        '      --verbose               Keep verbose logs in underlying scripts',
        '  -h, --help                  Show this help'
    ].join('\n'));
}

function makeRunTag() {
    return new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
}

function runCommand(cmd, args, options) {
    const allowExitCodes = options && Array.isArray(options.allowExitCodes) ? options.allowExitCodes : [0];
    const timeoutMs = options && Number.isFinite(options.timeoutMs)
        ? Math.max(1, Math.floor(options.timeoutMs))
        : null;
    const shown = [cmd].concat(args).join(' ');
    console.log(`[training-cycle] run: ${shown}`);
    const startedAt = Date.now();
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: process.cwd(),
        env: process.env,
        timeout: timeoutMs || undefined
    });
    const elapsedMs = Date.now() - startedAt;
    if (result.error) {
        if (result.error.code === 'ETIMEDOUT') {
            const err = new Error(`command timed out after ${timeoutMs}ms: ${shown}`);
            err.code = 'COMMAND_TIMEOUT';
            throw err;
        }
        throw result.error;
    }
    if (!allowExitCodes.includes(result.status)) {
        throw new Error(`command failed (exit=${result.status}): ${shown}`);
    }
    return { status: result.status, elapsedMs };
}

function iterationTag(runTag, iterationIndex) {
    return `${runTag}.it${String(iterationIndex).padStart(2, '0')}`;
}

function buildIterationPaths(args, iterationIndex) {
    const tag = iterationTag(args.runTag, iterationIndex);
    return {
        tag,
        trainDataPath: path.resolve(args.runsDir, `selfplay.train.${tag}.ndjson`),
        evalDataPath: path.resolve(args.runsDir, `selfplay.eval.${tag}.ndjson`),
        onnxModelPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx`),
        onnxMetaPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.onnx.meta.json`),
        checkpointPath: path.resolve(args.modelsDir, `policy-net.candidate.${tag}.checkpoint.pt`),
        onnxMetricsPath: path.resolve(args.runsDir, `train.metrics.${tag}.jsonl`),
        candidateModelPath: path.resolve(args.modelsDir, `policy-table.candidate.${tag}.json`),
        quickAdoptionPath: path.resolve(args.runsDir, `adoption.quick.${tag}.json`),
        finalAdoptionPath: path.resolve(args.runsDir, `adoption.final.${tag}.json`)
    };
}

function readJsonSafe(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

function getRemainingMs(deadlineMs) {
    if (!Number.isFinite(deadlineMs)) return null;
    return Math.max(0, deadlineMs - Date.now());
}

function runIteration(args, iterationIndex, deadlineMs, carryOver) {
    const seed = args.seed + ((iterationIndex - 1) * args.seedStride);
    const evalSeed = seed + args.evalSeedOffset;
    const p = buildIterationPaths(args, iterationIndex);
    const steps = [];
    const guideModelPath = carryOver && carryOver.guideModelPath ? carryOver.guideModelPath : null;
    const resumeCheckpointPath = carryOver && carryOver.resumeCheckpointPath ? carryOver.resumeCheckpointPath : null;
    const generateCardArgs = args.allowCardUsage
        ? ['--with-cards', '--card-usage-rate', String(args.cardUsageRate)]
        : ['--no-cards', '--card-usage-rate', '0'];
    const guideModelArgs = guideModelPath ? ['--policy-model', guideModelPath] : [];
    const verboseArgs = args.verbose ? ['--verbose'] : [];

    fs.mkdirSync(args.runsDir, { recursive: true });
    fs.mkdirSync(args.modelsDir, { recursive: true });

    const runStep = (name, cmd, stepArgs, options) => {
        const remainingMs = getRemainingMs(deadlineMs);
        if (Number.isFinite(remainingMs) && remainingMs <= 0) {
            const err = new Error(`time budget exceeded before ${name}`);
            err.code = 'TIME_BUDGET_EXCEEDED';
            throw err;
        }
        const result = runCommand(cmd, stepArgs, Object.assign({}, options || {}, {
            timeoutMs: Number.isFinite(remainingMs) ? remainingMs : undefined
        }));
        steps.push({ name, ...result });
        return result;
    };

    runStep('generate-train', process.execPath, [
        path.resolve('scripts', 'generate-selfplay-data.js'),
        '--games', String(args.trainGames),
        '--seed', String(seed),
        '--max-plies', String(args.maxPlies),
        '--out', p.trainDataPath
    ].concat(generateCardArgs, guideModelArgs, verboseArgs));

    runStep('generate-eval', process.execPath, [
        path.resolve('scripts', 'generate-selfplay-data.js'),
        '--games', String(args.evalGames),
        '--seed', String(evalSeed),
        '--max-plies', String(args.maxPlies),
        '--out', p.evalDataPath
    ].concat(generateCardArgs, guideModelArgs, verboseArgs));

    runStep('train-policy', args.pythonPath, [
        path.resolve('ai', 'train', 'train_policy_onnx.py'),
        '--input', p.trainDataPath,
        '--onnx-out', p.onnxModelPath,
        '--meta-out', p.onnxMetaPath,
        '--policy-table-out', p.candidateModelPath,
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(args.onnxLr),
        '--hidden-size', String(args.onnxHiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-monitor', args.onnxEarlyStopMonitor,
        '--metrics-out', p.onnxMetricsPath,
        '--min-visits', String(args.minVisits),
        '--shape-immediate', String(args.shapeImmediate),
        '--checkpoint-out', p.checkpointPath
    ].concat(resumeCheckpointPath ? ['--resume-checkpoint', resumeCheckpointPath] : []));

    runStep('evaluate-policy', args.pythonPath, [
        path.resolve('ai', 'train', 'evaluate_policy_table.py'),
        '--input', p.evalDataPath,
        '--model', p.candidateModelPath
    ]);

    runStep('adoption-quick', process.execPath, [
        path.resolve('scripts', 'benchmark-policy-adoption.js'),
        '--games', String(args.quickGames),
        '--seed', String(seed),
        '--max-plies', String(args.maxPlies),
        '--threshold', String(args.threshold),
        '--candidate-model', p.candidateModelPath,
        '--out', p.quickAdoptionPath
    ].concat(verboseArgs), { allowExitCodes: [0, 2] });
    const quickPayload = readJsonSafe(p.quickAdoptionPath);
    const quickPassed = !!(quickPayload && quickPayload.decision && quickPayload.decision.passed);

    let finalPayload = null;
    let finalPassed = false;
    if (quickPassed) {
        runStep('adoption-final', process.execPath, [
            path.resolve('scripts', 'benchmark-policy-adoption.js'),
            '--games', String(args.finalGames),
            '--seed', String(seed),
            '--max-plies', String(args.maxPlies),
            '--threshold', String(args.threshold),
            '--candidate-model', p.candidateModelPath,
            '--out', p.finalAdoptionPath
        ].concat(verboseArgs), { allowExitCodes: [0, 2] });
        finalPayload = readJsonSafe(p.finalAdoptionPath);
        finalPassed = !!(finalPayload && finalPayload.decision && finalPayload.decision.passed);
    }

    let promoted = false;
    if (finalPassed && args.promoteOnPass) {
        runStep('promote-model', process.execPath, [
            path.resolve('scripts', 'promote-policy-model.js'),
            '--adoption-result', p.finalAdoptionPath,
            '--candidate-model', p.candidateModelPath
        ]);
        promoted = true;
    }

    return {
        iteration: iterationIndex,
        seed,
        evalSeed,
        usedGuideModelPath: guideModelPath,
        usedResumeCheckpointPath: resumeCheckpointPath,
        paths: p,
        quickDecision: quickPayload && quickPayload.decision ? quickPayload.decision : null,
        finalDecision: finalPayload && finalPayload.decision ? finalPayload.decision : null,
        promoted,
        steps
    };
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }

    const startedAt = Date.now();
    const deadlineMs = startedAt + Math.floor(args.maxHours * 60 * 60 * 1000);
    const iterations = [];
    let guideModelPath = args.bootstrapPolicyModelPath || null;
    let resumeCheckpointPath = args.resumeCheckpointPath || null;
    let stoppedByTimeBudget = false;
    let stopReason = null;
    for (let i = 1; i <= args.iterations; i++) {
        if (getRemainingMs(deadlineMs) <= 0) {
            stoppedByTimeBudget = true;
            stopReason = `time budget reached before iteration ${i}`;
            break;
        }
        console.log(`[training-cycle] iteration ${i}/${args.iterations} start`);
        let result = null;
        try {
            result = runIteration(args, i, deadlineMs, {
                guideModelPath,
                resumeCheckpointPath
            });
        } catch (err) {
            if (err && (err.code === 'TIME_BUDGET_EXCEEDED' || err.code === 'COMMAND_TIMEOUT')) {
                stoppedByTimeBudget = true;
                stopReason = err.message || 'time budget reached';
                break;
            }
            throw err;
        }
        iterations.push(result);
        if (result && result.paths) {
            if (result.paths.candidateModelPath && fs.existsSync(result.paths.candidateModelPath)) {
                guideModelPath = result.paths.candidateModelPath;
            }
            if (result.paths.checkpointPath && fs.existsSync(result.paths.checkpointPath)) {
                resumeCheckpointPath = result.paths.checkpointPath;
            }
        }
        const finalPassed = !!(result.finalDecision && result.finalDecision.passed);
        console.log(`[training-cycle] iteration ${i} done quick_pass=${!!(result.quickDecision && result.quickDecision.passed)} final_pass=${finalPassed} promoted=${result.promoted}`);
    }
    if (stoppedByTimeBudget) {
        console.warn(`[training-cycle] stopped by time budget: ${stopReason}`);
    }

    const payload = {
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        config: {
            iterations: args.iterations,
            maxHours: args.maxHours,
            trainGames: args.trainGames,
            evalGames: args.evalGames,
            seed: args.seed,
            seedStride: args.seedStride,
            evalSeedOffset: args.evalSeedOffset,
            maxPlies: args.maxPlies,
            allowCardUsage: args.allowCardUsage,
            cardUsageRate: args.cardUsageRate,
            pythonPath: args.pythonPath,
            onnxEpochs: args.onnxEpochs,
            onnxBatchSize: args.onnxBatchSize,
            onnxLr: args.onnxLr,
            onnxHiddenSize: args.onnxHiddenSize,
            onnxDevice: args.onnxDevice,
            onnxLogIntervalSteps: args.onnxLogIntervalSteps,
            onnxValSplit: args.onnxValSplit,
            onnxEarlyStopPatience: args.onnxEarlyStopPatience,
            onnxEarlyStopMinDelta: args.onnxEarlyStopMinDelta,
            onnxEarlyStopMonitor: args.onnxEarlyStopMonitor,
            minVisits: args.minVisits,
            shapeImmediate: args.shapeImmediate,
            quickGames: args.quickGames,
            finalGames: args.finalGames,
            threshold: args.threshold,
            promoteOnPass: args.promoteOnPass,
            bootstrapPolicyModelPath: args.bootstrapPolicyModelPath,
            resumeCheckpointPath: args.resumeCheckpointPath,
            runTag: args.runTag
        },
        latestGuideModelPath: guideModelPath,
        latestResumeCheckpointPath: resumeCheckpointPath,
        stoppedByTimeBudget,
        stopReason,
        iterations
    };

    fs.mkdirSync(path.dirname(args.summaryOut), { recursive: true });
    fs.writeFileSync(args.summaryOut, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[training-cycle] summary: ${args.summaryOut}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[training-cycle] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}

module.exports = {
    parseArgs,
    buildIterationPaths,
    iterationTag,
    makeRunTag
};
