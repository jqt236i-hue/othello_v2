#!/usr/bin/env node
// @ts-nocheck
'use strict';
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function makeRunTag() {
    return `foundation_${new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14)}`;
}
const MINING_ARG_FLAGS = new Set([
    '--train-games',
    '--eval-games',
    '--selfplay-jobs',
    '--seed',
    '--eval-seed-offset',
    '--max-plies',
    '--with-cards',
    '--no-cards',
    '--card-usage-rate',
    '--selfplay-policy-mix-rate',
    '--selfplay-policy-pool-sampling',
    '--selfplay-policy-pool-recency-decay',
    '--selfplay-policy-current-anchor-rate',
    '--selfplay-card-usage-rate-jitter',
    '--selfplay-tactical-weight-min',
    '--selfplay-tactical-weight-max',
    '--selfplay-tactical-depth-opening',
    '--selfplay-tactical-depth-mid',
    '--selfplay-tactical-depth-end',
    '--selfplay-tactical-beam-width',
    '--selfplay-teacher-committee-weight-min',
    '--selfplay-teacher-committee-weight-max',
    '--selfplay-teacher-committee-consensus-bonus-min',
    '--selfplay-teacher-committee-consensus-bonus-max'
]);
const RETRAIN_ARG_FLAGS = new Set([
    '--with-cards',
    '--no-cards',
    '--onnx-epochs',
    '--onnx-batch-size',
    '--onnx-lr',
    '--onnx-hidden-size',
    '--onnx-device',
    '--onnx-log-interval-steps',
    '--onnx-val-split',
    '--onnx-early-stop-patience',
    '--onnx-early-stop-min-delta',
    '--onnx-early-stop-min-epochs',
    '--onnx-early-stop-monitor',
    '--onnx-early-stop-smoothing-window',
    '--onnx-resume-optimizer',
    '--no-onnx-resume-optimizer',
    '--onnx-card-no-action-weight',
    '--onnx-card-class-balance-power',
    '--onnx-winner-sample-boost',
    '--onnx-loser-sample-weight',
    '--onnx-draw-sample-weight',
    '--onnx-corner-emergency-sample-boost',
    '--onnx-negative-future-disc-sample-boost',
    '--onnx-negative-future-disc-threshold',
    '--onnx-tactical-miss-sample-boost',
    '--onnx-tactical-miss-threshold',
    '--onnx-hand-pressure-sample-boost',
    '--onnx-pending-target-sample-boost',
    '--min-visits',
    '--shape-immediate'
]);
function tokenNeedsValue(token) {
    return ![
        '--help',
        '-h',
        '--with-cards',
        '--no-cards',
        '--verbose',
        '--onnx-resume-optimizer',
        '--no-onnx-resume-optimizer'
    ].includes(token);
}
function parseArgs(argv) {
    const args = {
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
        runsDir: path.resolve(process.cwd(), 'data', 'runs'),
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        summaryOut: '',
        runTag: '',
        bootstrapPolicyModelPath: '',
        resumeCheckpointPath: '',
        miningPassThrough: [],
        retrainPassThrough: [],
        verbose: false,
        help: false
    };
    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        if (token === '--help' || token === '-h') {
            args.help = true;
            continue;
        }
        if (token === '--python') {
            args.pythonPath = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (token === '--runs-dir') {
            args.runsDir = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (token === '--models-dir') {
            args.modelsDir = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (token === '--summary-out') {
            args.summaryOut = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (token === '--run-tag') {
            args.runTag = String(argv[++i] || '').trim();
            continue;
        }
        if (token === '--bootstrap-policy-model') {
            args.bootstrapPolicyModelPath = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (token === '--resume-checkpoint') {
            args.resumeCheckpointPath = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        if (token === '--verbose') {
            args.verbose = true;
            continue;
        }
        if (MINING_ARG_FLAGS.has(token)) {
            args.miningPassThrough.push(token);
            if (tokenNeedsValue(token))
                args.miningPassThrough.push(String(argv[++i] || ''));
            continue;
        }
        if (RETRAIN_ARG_FLAGS.has(token)) {
            args.retrainPassThrough.push(token);
            if (tokenNeedsValue(token))
                args.retrainPassThrough.push(String(argv[++i] || ''));
            continue;
        }
        throw new Error(`unsupported foundation arg: ${token}`);
    }
    return args;
}
function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-foundation-bootstrap.js [options]',
        '',
        'This wrapper runs hardcase mining first, then retrains candidate models',
        'from the generated teacher_solution files.',
        '',
        'Common options:',
        '      --python <path>',
        '      --runs-dir <path>',
        '      --models-dir <path>',
        '      --summary-out <path>',
        '      --run-tag <tag>',
        '      --bootstrap-policy-model <path>',
        '      --resume-checkpoint <path>',
        '      --verbose',
        '',
        'Mining options: --train-games, --eval-games, --selfplay-jobs, --seed, --eval-seed-offset,',
        '--max-plies, --card-usage-rate, --selfplay-*',
        '',
        'Retrain options: --onnx-*, --min-visits, --shape-immediate',
        '',
        '  -h, --help'
    ].join('\n'));
}
function runCommand(stepName, executable, stepArgs) {
    const startedAt = Date.now();
    const result = (0, child_process_1.spawnSync)(executable, stepArgs, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit'
    });
    if (result.error)
        throw result.error;
    const status = Number(result.status);
    if (status !== 0)
        throw new Error(`${stepName} failed (exit=${status})`);
    return {
        name: stepName,
        status,
        elapsedMs: Date.now() - startedAt,
        command: [executable].concat(stepArgs).join(' ')
    };
}
function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const startedAt = Date.now();
    const runTag = args.runTag || makeRunTag();
    const summaryPath = args.summaryOut || path.resolve(args.runsDir, runTag, 'foundation-bootstrap.summary.json');
    const runDir = path.dirname(summaryPath);
    const miningSummaryPath = path.resolve(runDir, 'foundation-bootstrap.mining.summary.json');
    const retrainSummaryPath = path.resolve(runDir, 'foundation-bootstrap.retrain.summary.json');
    fs.mkdirSync(runDir, { recursive: true });
    const steps = [];
    const miningArgs = [
        path.resolve('scripts', 'run-hardcase-mining.js'),
        '--python', args.pythonPath,
        '--runs-dir', args.runsDir,
        '--models-dir', args.modelsDir,
        '--summary-out', miningSummaryPath,
        '--run-tag', runTag
    ]
        .concat(args.bootstrapPolicyModelPath ? ['--bootstrap-policy-model', args.bootstrapPolicyModelPath] : [])
        .concat(args.verbose ? ['--verbose'] : [])
        .concat(args.miningPassThrough);
    steps.push(runCommand('foundation-mining', process.execPath, miningArgs));
    const miningSummary = JSON.parse(fs.readFileSync(miningSummaryPath, 'utf8'));
    const retrainArgs = [
        path.resolve('scripts', 'run-hardcase-retrain.js'),
        '--python', args.pythonPath,
        '--runs-dir', args.runsDir,
        '--models-dir', args.modelsDir,
        '--summary-out', retrainSummaryPath,
        '--run-tag', runTag,
        '--input', miningSummary.paths.trainTeacherSolutionPath,
        '--eval-input', miningSummary.paths.evalTeacherSolutionPath
    ]
        .concat(args.resumeCheckpointPath ? ['--resume-checkpoint', args.resumeCheckpointPath] : [])
        .concat(args.verbose ? ['--verbose'] : [])
        .concat(args.retrainPassThrough);
    steps.push(runCommand('foundation-retrain', process.execPath, retrainArgs));
    const payload = {
        schemaVersion: 'foundation_bootstrap_run.v1',
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        runTag,
        paths: {
            summaryPath,
            miningSummaryPath,
            retrainSummaryPath
        },
        steps
    };
    fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[foundation-bootstrap] summary=${summaryPath}`);
}
if (require.main === module) {
    try {
        main();
    }
    catch (err) {
        console.error('[foundation-bootstrap] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}
//# sourceMappingURL=run-foundation-bootstrap.js.map