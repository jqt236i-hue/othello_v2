#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const TEACHER_SOLUTION_SCHEMA_VERSION = 'teacher_solution.v1';

function defaultJobs() {
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    return Math.max(1, Math.min(10, cpuCount));
}

function makeRunTag() {
    return `hardcase_retrain_${new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14)}`;
}

function parseArgs(argv) {
    const args = {
        input: '',
        evalInput: '',
        allowCardUsage: true,
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
        runsDir: path.resolve(process.cwd(), 'data', 'runs'),
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        summaryOut: '',
        runTag: '',
        resumeCheckpointPath: '',
        onnxEpochs: 400,
        onnxBatchSize: 1024,
        onnxLr: 0.00065,
        onnxHiddenSize: 320,
        onnxDevice: 'auto',
        onnxLogIntervalSteps: 0,
        onnxValSplit: 0.15,
        onnxEarlyStopPatience: 16,
        onnxEarlyStopMinDelta: 0.00008,
        onnxEarlyStopMinEpochs: 40,
        onnxEarlyStopMonitor: 'val_loss',
        onnxEarlyStopSmoothingWindow: 3,
        onnxResumeOptimizer: false,
        onnxCardNoActionWeight: 0.7,
        onnxCardClassBalancePower: 0.4,
        onnxWinnerSampleBoost: 0.4,
        onnxLoserSampleWeight: 0.9,
        onnxDrawSampleWeight: 1.0,
        onnxCornerEmergencySampleBoost: 0.6,
        onnxNegativeFutureDiscSampleBoost: 0.55,
        onnxNegativeFutureDiscThreshold: -1.0,
        onnxTacticalMissSampleBoost: 0.45,
        onnxTacticalMissThreshold: 0.07,
        onnxHandPressureSampleBoost: 0.5,
        onnxPendingTargetSampleBoost: 0.65,
        minVisits: 2,
        shapeImmediate: 0.45,
        verbose: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--input') { args.input = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--eval-input') { args.evalInput = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--with-cards') { args.allowCardUsage = true; continue; }
        if (token === '--no-cards') { args.allowCardUsage = false; continue; }
        if (token === '--python') { args.pythonPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--summary-out') { args.summaryOut = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--run-tag') { args.runTag = String(argv[++i] || '').trim(); continue; }
        if (token === '--resume-checkpoint') { args.resumeCheckpointPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--onnx-epochs') { args.onnxEpochs = Number(argv[++i]); continue; }
        if (token === '--onnx-batch-size') { args.onnxBatchSize = Number(argv[++i]); continue; }
        if (token === '--onnx-lr') { args.onnxLr = Number(argv[++i]); continue; }
        if (token === '--onnx-hidden-size') { args.onnxHiddenSize = Number(argv[++i]); continue; }
        if (token === '--onnx-device') { args.onnxDevice = String(argv[++i] || '').trim().toLowerCase() || 'auto'; continue; }
        if (token === '--onnx-log-interval-steps') { args.onnxLogIntervalSteps = Number(argv[++i]); continue; }
        if (token === '--onnx-val-split') { args.onnxValSplit = Number(argv[++i]); continue; }
        if (token === '--onnx-early-stop-patience') { args.onnxEarlyStopPatience = Number(argv[++i]); continue; }
        if (token === '--onnx-early-stop-min-delta') { args.onnxEarlyStopMinDelta = Number(argv[++i]); continue; }
        if (token === '--onnx-early-stop-min-epochs') { args.onnxEarlyStopMinEpochs = Number(argv[++i]); continue; }
        if (token === '--onnx-early-stop-monitor') { args.onnxEarlyStopMonitor = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (token === '--onnx-early-stop-smoothing-window') { args.onnxEarlyStopSmoothingWindow = Number(argv[++i]); continue; }
        if (token === '--onnx-resume-optimizer') { args.onnxResumeOptimizer = true; continue; }
        if (token === '--no-onnx-resume-optimizer') { args.onnxResumeOptimizer = false; continue; }
        if (token === '--onnx-card-no-action-weight') { args.onnxCardNoActionWeight = Number(argv[++i]); continue; }
        if (token === '--onnx-card-class-balance-power') { args.onnxCardClassBalancePower = Number(argv[++i]); continue; }
        if (token === '--onnx-winner-sample-boost') { args.onnxWinnerSampleBoost = Number(argv[++i]); continue; }
        if (token === '--onnx-loser-sample-weight') { args.onnxLoserSampleWeight = Number(argv[++i]); continue; }
        if (token === '--onnx-draw-sample-weight') { args.onnxDrawSampleWeight = Number(argv[++i]); continue; }
        if (token === '--onnx-corner-emergency-sample-boost') { args.onnxCornerEmergencySampleBoost = Number(argv[++i]); continue; }
        if (token === '--onnx-negative-future-disc-sample-boost') { args.onnxNegativeFutureDiscSampleBoost = Number(argv[++i]); continue; }
        if (token === '--onnx-negative-future-disc-threshold') { args.onnxNegativeFutureDiscThreshold = Number(argv[++i]); continue; }
        if (token === '--onnx-tactical-miss-sample-boost') { args.onnxTacticalMissSampleBoost = Number(argv[++i]); continue; }
        if (token === '--onnx-tactical-miss-threshold') { args.onnxTacticalMissThreshold = Number(argv[++i]); continue; }
        if (token === '--onnx-hand-pressure-sample-boost') { args.onnxHandPressureSampleBoost = Number(argv[++i]); continue; }
        if (token === '--onnx-pending-target-sample-boost') { args.onnxPendingTargetSampleBoost = Number(argv[++i]); continue; }
        if (token === '--min-visits') { args.minVisits = Number(argv[++i]); continue; }
        if (token === '--shape-immediate') { args.shapeImmediate = Number(argv[++i]); continue; }
        if (token === '--verbose') { args.verbose = true; continue; }
    }

    if (!Number.isFinite(args.onnxEpochs) || args.onnxEpochs < 1) throw new Error('--onnx-epochs must be >= 1');
    if (!Number.isFinite(args.onnxBatchSize) || args.onnxBatchSize < 1) throw new Error('--onnx-batch-size must be >= 1');
    if (!Number.isFinite(args.onnxLr) || args.onnxLr <= 0) throw new Error('--onnx-lr must be > 0');
    if (!Number.isFinite(args.onnxHiddenSize) || args.onnxHiddenSize < 8) throw new Error('--onnx-hidden-size must be >= 8');
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-hardcase-retrain.js [options]',
        '',
        'Options:',
        '      --input <path>          Hardcase or teacher-solution NDJSON input',
        '      --eval-input <path>     Optional eval NDJSON input',
        '      --with-cards            Enable card/target training',
        '      --no-cards              Disable card/target training',
        '      --python <path>         Python path',
        '      --runs-dir <path>       Runs root path',
        '      --models-dir <path>     Models root path',
        '      --summary-out <path>    Summary JSON path',
        '      --run-tag <tag>         Run tag',
        '      --resume-checkpoint <path> Resume checkpoint path',
        '      --onnx-*                Standard ONNX training knobs',
        '      --verbose               Verbose subprocess logs',
        '  -h, --help                  Show this help'
    ].join('\n'));
}

function runCommand(stepName, executable, stepArgs) {
    const startedAt = Date.now();
    const result = spawnSync(executable, stepArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit'
    });
    if (result.error) throw result.error;
    const status = Number(result.status);
    if (status !== 0) throw new Error(`${stepName} failed (exit=${status})`);
    return {
        name: stepName,
        status,
        elapsedMs: Date.now() - startedAt,
        command: [executable].concat(stepArgs).join(' ')
    };
}

function readFirstJsonRecord(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return null;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = String(line || '').trim();
        if (!trimmed) continue;
        try {
            return JSON.parse(trimmed);
        } catch (_) {
            return null;
        }
    }
    return null;
}

function findLatestInput(runsDir) {
    const resolvedRunsDir = path.resolve(process.cwd(), String(runsDir || 'data/runs'));
    if (!fs.existsSync(resolvedRunsDir)) return '';
    const candidates = [];
    const walk = (dirPath) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
                continue;
            }
            if (!entry.isFile()) continue;
            const lower = entry.name.toLowerCase();
            if (lower.endsWith('.ndjson') && (lower.includes('teacher_solution') || lower.includes('.hardcase.'))) {
                const stat = fs.statSync(fullPath);
                candidates.push({
                    fullPath,
                    preferTeacher: lower.includes('teacher_solution') ? 1 : 0,
                    mtimeMs: Number(stat.mtimeMs) || 0
                });
            }
        }
    };
    walk(resolvedRunsDir);
    candidates.sort((a, b) => {
        if (b.preferTeacher !== a.preferTeacher) return b.preferTeacher - a.preferTeacher;
        return b.mtimeMs - a.mtimeMs;
    });
    return candidates.length > 0 ? candidates[0].fullPath : '';
}

function hasCoordinatePendingSelectionRecords(filePath) {
    if (!filePath || !fs.existsSync(filePath)) return false;
    const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
        const trimmed = String(line || '').trim();
        if (!trimmed) continue;
        let record = null;
        try {
            record = JSON.parse(trimmed);
        } catch (_) {
            continue;
        }
        const pendingSelection = record && typeof record === 'object' ? record.pendingSelection : null;
        if (pendingSelection && pendingSelection.kind === 'board_cell' && Number.isInteger(pendingSelection.row) && Number.isInteger(pendingSelection.col)) {
            return true;
        }
    }
    return false;
}

function resolveTrainingSource(inputPath, runDir) {
    const firstRecord = readFirstJsonRecord(inputPath);
    if (firstRecord && firstRecord.schemaVersion === TEACHER_SOLUTION_SCHEMA_VERSION) {
        return {
            sourceInputPath: inputPath,
            trainInputPath: inputPath,
            generatedTeacherSolutionPath: null,
            inputKind: 'teacher_solution'
        };
    }
    const ext = path.extname(inputPath) || '.ndjson';
    const base = path.basename(inputPath, ext);
    const teacherSolutionPath = path.resolve(runDir, `${base}.teacher_solution${ext}`);
    return {
        sourceInputPath: inputPath,
        trainInputPath: teacherSolutionPath,
        generatedTeacherSolutionPath: teacherSolutionPath,
        inputKind: 'hardcase'
    };
}

function buildPaths(args) {
    const runTag = args.runTag || makeRunTag();
    const runDir = args.summaryOut ? path.dirname(args.summaryOut) : path.resolve(args.runsDir, runTag);
    return {
        runTag,
        runDir,
        candidateModelPath: path.resolve(args.modelsDir, `policy-table.candidate.${runTag}.json`),
        onnxModelPath: path.resolve(args.modelsDir, `policy-net.candidate.${runTag}.onnx`),
        onnxMetaPath: path.resolve(args.modelsDir, `policy-net.candidate.${runTag}.onnx.meta.json`),
        checkpointPath: path.resolve(args.modelsDir, `policy-net.candidate.${runTag}.checkpoint.pt`),
        cardOnnxModelPath: path.resolve(args.modelsDir, `policy-card.candidate.${runTag}.onnx`),
        cardOnnxMetaPath: path.resolve(args.modelsDir, `policy-card.candidate.${runTag}.onnx.meta.json`),
        cardCheckpointPath: path.resolve(args.modelsDir, `policy-card.candidate.${runTag}.checkpoint.pt`),
        targetOnnxModelPath: path.resolve(args.modelsDir, `policy-target.candidate.${runTag}.onnx`),
        targetOnnxMetaPath: path.resolve(args.modelsDir, `policy-target.candidate.${runTag}.onnx.meta.json`),
        targetCheckpointPath: path.resolve(args.modelsDir, `policy-target.candidate.${runTag}.checkpoint.pt`),
        valueOnnxModelPath: path.resolve(args.modelsDir, `policy-value.candidate.${runTag}.onnx`),
        valueOnnxMetaPath: path.resolve(args.modelsDir, `policy-value.candidate.${runTag}.onnx.meta.json`),
        valueCheckpointPath: path.resolve(args.modelsDir, `policy-value.candidate.${runTag}.checkpoint.pt`),
        onnxMetricsPath: path.resolve(runDir, `train.metrics.${runTag}.jsonl`),
        cardMetricsPath: path.resolve(runDir, `train.card.metrics.${runTag}.jsonl`),
        targetMetricsPath: path.resolve(runDir, `train.target.metrics.${runTag}.jsonl`),
        valueMetricsPath: path.resolve(runDir, `train.value.metrics.${runTag}.jsonl`),
        hardcaseSummaryPath: path.resolve(runDir, `hardcase.summary.${runTag}.json`)
    };
}

function writeSummary(summaryPath, payload) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2), 'utf8');
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const inputPath = args.input || findLatestInput(args.runsDir);
    if (!inputPath) throw new Error('no input found; specify --input');

    const startedAt = Date.now();
    const paths = buildPaths(args);
    const summaryPath = args.summaryOut || path.resolve(paths.runDir, 'hardcase-retrain.summary.json');
    fs.mkdirSync(paths.runDir, { recursive: true });
    fs.mkdirSync(args.modelsDir, { recursive: true });
    const steps = [];

    const trainSource = resolveTrainingSource(inputPath, paths.runDir);
    if (trainSource.generatedTeacherSolutionPath) {
        steps.push(runCommand(
            'export-train-teacher-solutions',
            process.execPath,
            [path.resolve('scripts', 'export-teacher-solutions.js'), '--input', inputPath, '--out', trainSource.generatedTeacherSolutionPath]
        ));
        steps.push(runCommand(
            'summarize-hardcases',
            process.execPath,
            [path.resolve('scripts', 'export-hardcase-summary.js'), '--input', inputPath, '--out', paths.hardcaseSummaryPath]
        ));
    }

    let evalTrainInputPath = args.evalInput || '';
    let generatedEvalTeacherSolutionPath = null;
    if (evalTrainInputPath) {
        const evalSource = resolveTrainingSource(evalTrainInputPath, paths.runDir);
        if (evalSource.generatedTeacherSolutionPath) {
            steps.push(runCommand(
                'export-eval-teacher-solutions',
                process.execPath,
                [path.resolve('scripts', 'export-teacher-solutions.js'), '--input', evalTrainInputPath, '--out', evalSource.generatedTeacherSolutionPath]
            ));
        }
        evalTrainInputPath = evalSource.trainInputPath;
        generatedEvalTeacherSolutionPath = evalSource.generatedTeacherSolutionPath;
    }

    const trainInputPath = trainSource.trainInputPath;
    const commonTrainArgs = [
        '--epochs', String(args.onnxEpochs),
        '--batch-size', String(args.onnxBatchSize),
        '--lr', String(args.onnxLr),
        '--hidden-size', String(args.onnxHiddenSize),
        '--device', args.onnxDevice,
        '--log-interval-steps', String(args.onnxLogIntervalSteps),
        '--val-split', String(args.onnxValSplit),
        '--early-stop-patience', String(args.onnxEarlyStopPatience),
        '--early-stop-min-delta', String(args.onnxEarlyStopMinDelta),
        '--early-stop-min-epochs', String(args.onnxEarlyStopMinEpochs),
        '--early-stop-monitor', args.onnxEarlyStopMonitor,
        '--early-stop-smoothing-window', String(args.onnxEarlyStopSmoothingWindow),
        '--winner-sample-boost', String(args.onnxWinnerSampleBoost),
        '--loser-sample-weight', String(args.onnxLoserSampleWeight),
        '--draw-sample-weight', String(args.onnxDrawSampleWeight),
        '--corner-emergency-sample-boost', String(args.onnxCornerEmergencySampleBoost),
        '--negative-future-disc-sample-boost', String(args.onnxNegativeFutureDiscSampleBoost),
        '--negative-future-disc-threshold', String(args.onnxNegativeFutureDiscThreshold),
        '--tactical-miss-sample-boost', String(args.onnxTacticalMissSampleBoost),
        '--tactical-miss-threshold', String(args.onnxTacticalMissThreshold),
        '--hand-pressure-sample-boost', String(args.onnxHandPressureSampleBoost),
        '--pending-target-sample-boost', String(args.onnxPendingTargetSampleBoost)
    ];
    const resumeArgs = args.resumeCheckpointPath ? ['--resume-checkpoint', args.resumeCheckpointPath] : [];
    const resumeOptimizerArgs = args.onnxResumeOptimizer ? ['--resume-optimizer'] : [];

    steps.push(runCommand(
        'train-policy',
        args.pythonPath,
        [
            path.resolve('ai', 'train', 'train_policy_onnx.py'),
            '--input', trainInputPath,
            '--onnx-out', paths.onnxModelPath,
            '--meta-out', paths.onnxMetaPath,
            '--policy-table-out', paths.candidateModelPath,
            '--metrics-out', paths.onnxMetricsPath,
            '--min-visits', String(args.minVisits),
            '--shape-immediate', String(args.shapeImmediate),
            '--checkpoint-out', paths.checkpointPath,
            '--card-no-action-weight', String(args.onnxCardNoActionWeight),
            '--card-class-balance-power', String(args.onnxCardClassBalancePower)
        ].concat(commonTrainArgs, resumeArgs, resumeOptimizerArgs)
    ));

    if (evalTrainInputPath) {
        steps.push(runCommand(
            'evaluate-policy',
            args.pythonPath,
            [path.resolve('ai', 'train', 'evaluate_policy_table.py'), '--input', evalTrainInputPath, '--model', paths.candidateModelPath]
        ));
    }

    if (args.allowCardUsage) {
        steps.push(runCommand(
            'train-card-policy',
            args.pythonPath,
            [
                path.resolve('ai', 'train', 'train_card_onnx.py'),
                '--input', trainInputPath,
                '--onnx-out', paths.cardOnnxModelPath,
                '--meta-out', paths.cardOnnxMetaPath,
                '--metrics-out', paths.cardMetricsPath,
                '--checkpoint-out', paths.cardCheckpointPath,
                '--card-no-action-weight', String(args.onnxCardNoActionWeight),
                '--card-class-balance-power', String(args.onnxCardClassBalancePower)
            ].concat(commonTrainArgs, resumeArgs, resumeOptimizerArgs)
        ));
    }

    const hasTargetTrainingData = args.allowCardUsage && hasCoordinatePendingSelectionRecords(trainInputPath);
    if (hasTargetTrainingData) {
        steps.push(runCommand(
            'train-target-policy',
            args.pythonPath,
            [
                path.resolve('ai', 'train', 'train_target_onnx.py'),
                '--input', trainInputPath,
                '--onnx-out', paths.targetOnnxModelPath,
                '--meta-out', paths.targetOnnxMetaPath,
                '--metrics-out', paths.targetMetricsPath,
                '--checkpoint-out', paths.targetCheckpointPath
            ].concat(commonTrainArgs, resumeOptimizerArgs)
        ));
    }

    steps.push(runCommand(
        'train-value-policy',
        args.pythonPath,
        [
            path.resolve('ai', 'train', 'train_value_onnx.py'),
            '--input', trainInputPath,
            '--onnx-out', paths.valueOnnxModelPath,
            '--meta-out', paths.valueOnnxMetaPath,
            '--metrics-out', paths.valueMetricsPath,
            '--checkpoint-out', paths.valueCheckpointPath
        ].concat(commonTrainArgs, resumeOptimizerArgs)
    ));

    const payload = {
        schemaVersion: 'hardcase_retrain_run.v1',
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        config: {
            sourceInputPath: inputPath,
            evalInputPath: args.evalInput || null,
            allowCardUsage: args.allowCardUsage,
            resumeCheckpointPath: args.resumeCheckpointPath || null,
            onnxEpochs: args.onnxEpochs,
            onnxBatchSize: args.onnxBatchSize,
            onnxLr: args.onnxLr,
            onnxHiddenSize: args.onnxHiddenSize,
            onnxDevice: args.onnxDevice,
            onnxHandPressureSampleBoost: args.onnxHandPressureSampleBoost,
            onnxPendingTargetSampleBoost: args.onnxPendingTargetSampleBoost
        },
        inputKind: trainSource.inputKind,
        hasTargetTrainingData,
        paths: Object.assign({}, paths, {
            trainInputPath,
            evalTrainInputPath: evalTrainInputPath || null,
            generatedTeacherSolutionPath: trainSource.generatedTeacherSolutionPath,
            generatedEvalTeacherSolutionPath
        }),
        steps
    };
    writeSummary(summaryPath, payload);
    console.log(`[hardcase-retrain] summary=${summaryPath}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[hardcase-retrain] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}
