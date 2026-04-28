#!/usr/bin/env node
// @ts-nocheck
'use strict';

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function defaultJobs() {
    const cpuCount = Array.isArray(os.cpus()) ? os.cpus().length : 1;
    return Math.max(1, Math.min(10, cpuCount));
}

function makeRunTag() {
    return `hardcase_${new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14)}`;
}

function parseArgs(argv: string[]) {
    const args = {
        trainGames: 8000,
        evalGames: 1600,
        selfplayJobs: defaultJobs(),
        seed: 1,
        evalSeedOffset: 100000,
        maxPlies: 220,
        allowCardUsage: true,
        cardUsageRate: 0.6,
        selfplayPolicyMixRate: 0.75,
        selfplayPolicyPoolSampling: 'recency',
        selfplayPolicyPoolRecencyDecay: 2.0,
        selfplayPolicyCurrentAnchorRate: 0.35,
        selfplayCardUsageRateJitter: 0.15,
        selfplayTacticalWeightMin: 0.9,
        selfplayTacticalWeightMax: 1.5,
        selfplayTacticalDepthOpening: 4,
        selfplayTacticalDepthMid: 6,
        selfplayTacticalDepthEnd: 8,
        selfplayTacticalBeamWidth: 10,
        selfplayTeacherCommitteeWeightMin: 36,
        selfplayTeacherCommitteeWeightMax: 56,
        selfplayTeacherCommitteeConsensusBonusMin: 420,
        selfplayTeacherCommitteeConsensusBonusMax: 760,
        pythonPath: path.resolve(process.cwd(), '.venv', 'Scripts', 'python.exe'),
        runsDir: path.resolve(process.cwd(), 'data', 'runs'),
        modelsDir: path.resolve(process.cwd(), 'data', 'models'),
        summaryOut: '',
        runTag: '',
        bootstrapPolicyModelPath: '',
        verbose: false,
        help: false
    };

    for (let i = 0; i < argv.length; i++) {
        const token = String(argv[i] || '');
        if (token === '--help' || token === '-h') { args.help = true; continue; }
        if (token === '--train-games') { args.trainGames = Number(argv[++i]); continue; }
        if (token === '--eval-games') { args.evalGames = Number(argv[++i]); continue; }
        if (token === '--selfplay-jobs') { args.selfplayJobs = Number(argv[++i]); continue; }
        if (token === '--seed') { args.seed = Number(argv[++i]); continue; }
        if (token === '--eval-seed-offset') { args.evalSeedOffset = Number(argv[++i]); continue; }
        if (token === '--max-plies') { args.maxPlies = Number(argv[++i]); continue; }
        if (token === '--with-cards') { args.allowCardUsage = true; continue; }
        if (token === '--no-cards') { args.allowCardUsage = false; continue; }
        if (token === '--card-usage-rate') { args.cardUsageRate = Number(argv[++i]); continue; }
        if (token === '--selfplay-policy-mix-rate') { args.selfplayPolicyMixRate = Number(argv[++i]); continue; }
        if (token === '--selfplay-policy-pool-sampling') { args.selfplayPolicyPoolSampling = String(argv[++i] || '').trim().toLowerCase(); continue; }
        if (token === '--selfplay-policy-pool-recency-decay') { args.selfplayPolicyPoolRecencyDecay = Number(argv[++i]); continue; }
        if (token === '--selfplay-policy-current-anchor-rate') { args.selfplayPolicyCurrentAnchorRate = Number(argv[++i]); continue; }
        if (token === '--selfplay-card-usage-rate-jitter') { args.selfplayCardUsageRateJitter = Number(argv[++i]); continue; }
        if (token === '--selfplay-tactical-weight-min') { args.selfplayTacticalWeightMin = Number(argv[++i]); continue; }
        if (token === '--selfplay-tactical-weight-max') { args.selfplayTacticalWeightMax = Number(argv[++i]); continue; }
        if (token === '--selfplay-tactical-depth-opening') { args.selfplayTacticalDepthOpening = Number(argv[++i]); continue; }
        if (token === '--selfplay-tactical-depth-mid') { args.selfplayTacticalDepthMid = Number(argv[++i]); continue; }
        if (token === '--selfplay-tactical-depth-end') { args.selfplayTacticalDepthEnd = Number(argv[++i]); continue; }
        if (token === '--selfplay-tactical-beam-width') { args.selfplayTacticalBeamWidth = Number(argv[++i]); continue; }
        if (token === '--selfplay-teacher-committee-weight-min') { args.selfplayTeacherCommitteeWeightMin = Number(argv[++i]); continue; }
        if (token === '--selfplay-teacher-committee-weight-max') { args.selfplayTeacherCommitteeWeightMax = Number(argv[++i]); continue; }
        if (token === '--selfplay-teacher-committee-consensus-bonus-min') { args.selfplayTeacherCommitteeConsensusBonusMin = Number(argv[++i]); continue; }
        if (token === '--selfplay-teacher-committee-consensus-bonus-max') { args.selfplayTeacherCommitteeConsensusBonusMax = Number(argv[++i]); continue; }
        if (token === '--python') { args.pythonPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--runs-dir') { args.runsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--models-dir') { args.modelsDir = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--summary-out') { args.summaryOut = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--run-tag') { args.runTag = String(argv[++i] || '').trim(); continue; }
        if (token === '--bootstrap-policy-model') { args.bootstrapPolicyModelPath = path.resolve(process.cwd(), argv[++i]); continue; }
        if (token === '--verbose') { args.verbose = true; continue; }
    }

    if (!Number.isFinite(args.trainGames) || args.trainGames < 1) throw new Error('--train-games must be >= 1');
    if (!Number.isFinite(args.evalGames) || args.evalGames < 1) throw new Error('--eval-games must be >= 1');
    if (!Number.isFinite(args.selfplayJobs) || args.selfplayJobs < 1) throw new Error('--selfplay-jobs must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.evalSeedOffset) || args.evalSeedOffset < 1) throw new Error('--eval-seed-offset must be >= 1');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    return args;
}

function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/run-hardcase-mining.js [options]',
        '',
        'Options:',
        '      --train-games <n>      Training self-play games',
        '      --eval-games <n>       Eval self-play games',
        '      --selfplay-jobs <n>    Parallel self-play workers',
        '      --seed <n>             Base seed',
        '      --eval-seed-offset <n> Eval seed offset',
        '      --max-plies <n>        Max plies',
        '      --with-cards           Enable card usage',
        '      --no-cards             Disable card usage',
        '      --card-usage-rate <r>  Card usage rate',
        '      --python <path>        Python path',
        '      --runs-dir <path>      Runs root path',
        '      --models-dir <path>    Models root path',
        '      --summary-out <path>   Summary JSON path',
        '      --run-tag <tag>        Run tag',
        '      --bootstrap-policy-model <path> Bootstrap policy-table path',
        '      --verbose              Verbose subprocess logs',
        '  -h, --help                 Show this help'
    ].join('\n'));
}

function runCommand(stepName: any, executable: any, stepArgs: any) {
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

function buildPaths(args: any) {
    const runTag = args.runTag || makeRunTag();
    const runDir = args.summaryOut ? path.dirname(args.summaryOut) : path.resolve(args.runsDir, runTag);
    return {
        runTag,
        runDir,
        trainDataPath: path.resolve(runDir, `selfplay.train.${runTag}.ndjson`),
        trainHardcasePath: path.resolve(runDir, `selfplay.train.hardcase.${runTag}.ndjson`),
        evalDataPath: path.resolve(runDir, `selfplay.eval.${runTag}.ndjson`),
        evalHardcasePath: path.resolve(runDir, `selfplay.eval.hardcase.${runTag}.ndjson`),
        trainHardcaseSummaryPath: path.resolve(runDir, `selfplay.train.hardcase.${runTag}.summary.json`),
        evalHardcaseSummaryPath: path.resolve(runDir, `selfplay.eval.hardcase.${runTag}.summary.json`),
        trainTeacherSolutionPath: path.resolve(runDir, `teacher_solution.train.${runTag}.ndjson`),
        evalTeacherSolutionPath: path.resolve(runDir, `teacher_solution.eval.${runTag}.ndjson`)
    };
}

function writeSummary(summaryPath: any, payload: any) {
    fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
    fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2), 'utf8');
}

function buildGenerateArgs(args: any, seed: any, outPath: any, hardcaseOutPath: any, seedFamily: any, dataLane: any, games: any) {
    const out = [
        path.resolve('scripts', 'generate-selfplay-data.js'),
        '--games', String(games),
        '--seed', String(seed),
        '--max-plies', String(args.maxPlies),
        '--out', outPath,
        '--hardcase-out', hardcaseOutPath,
        '--seed-family', seedFamily,
        '--data-lane', dataLane,
        '--jobs', String(args.selfplayJobs),
        '--policy-mix-rate', String(args.selfplayPolicyMixRate),
        '--policy-pool-sampling', String(args.selfplayPolicyPoolSampling),
        '--policy-pool-recency-decay', String(args.selfplayPolicyPoolRecencyDecay),
        '--policy-current-anchor-rate', String(args.selfplayPolicyCurrentAnchorRate),
        '--card-usage-rate-jitter', String(args.selfplayCardUsageRateJitter),
        '--tactical-weight-min', String(args.selfplayTacticalWeightMin),
        '--tactical-weight-max', String(args.selfplayTacticalWeightMax),
        '--tactical-depth-opening', String(args.selfplayTacticalDepthOpening),
        '--tactical-depth-mid', String(args.selfplayTacticalDepthMid),
        '--tactical-depth-end', String(args.selfplayTacticalDepthEnd),
        '--tactical-beam-width', String(args.selfplayTacticalBeamWidth),
        '--teacher-committee-weight-min', String(args.selfplayTeacherCommitteeWeightMin),
        '--teacher-committee-weight-max', String(args.selfplayTeacherCommitteeWeightMax),
        '--teacher-committee-consensus-bonus-min', String(args.selfplayTeacherCommitteeConsensusBonusMin),
        '--teacher-committee-consensus-bonus-max', String(args.selfplayTeacherCommitteeConsensusBonusMax)
    ];
    if (args.allowCardUsage) out.push('--with-cards', '--card-usage-rate', String(args.cardUsageRate));
    else out.push('--no-cards', '--card-usage-rate', '0');
    if (args.bootstrapPolicyModelPath) out.push('--policy-model', args.bootstrapPolicyModelPath);
    if (args.verbose) out.push('--verbose');
    return out;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    const startedAt = Date.now();
    const paths = buildPaths(args);
    const summaryPath = args.summaryOut || path.resolve(paths.runDir, 'hardcase-mining.summary.json');
    fs.mkdirSync(paths.runDir, { recursive: true });

    const steps = [];
    steps.push(runCommand(
        'generate-train',
        process.execPath,
        buildGenerateArgs(args, args.seed, paths.trainDataPath, paths.trainHardcasePath, 'train', 'train-main', args.trainGames)
    ));
    steps.push(runCommand(
        'generate-eval',
        process.execPath,
        buildGenerateArgs(args, args.seed + args.evalSeedOffset, paths.evalDataPath, paths.evalHardcasePath, 'eval', 'eval-suite', args.evalGames)
    ));
    steps.push(runCommand(
        'summarize-train-hardcases',
        process.execPath,
        [path.resolve('scripts', 'export-hardcase-summary.js'), '--input', paths.trainHardcasePath, '--out', paths.trainHardcaseSummaryPath]
    ));
    steps.push(runCommand(
        'summarize-eval-hardcases',
        process.execPath,
        [path.resolve('scripts', 'export-hardcase-summary.js'), '--input', paths.evalHardcasePath, '--out', paths.evalHardcaseSummaryPath]
    ));
    steps.push(runCommand(
        'export-train-teacher-solutions',
        process.execPath,
        [path.resolve('scripts', 'export-teacher-solutions.js'), '--input', paths.trainHardcasePath, '--out', paths.trainTeacherSolutionPath]
    ));
    steps.push(runCommand(
        'export-eval-teacher-solutions',
        process.execPath,
        [path.resolve('scripts', 'export-teacher-solutions.js'), '--input', paths.evalHardcasePath, '--out', paths.evalTeacherSolutionPath]
    ));

    const payload = {
        schemaVersion: 'hardcase_mining_run.v1',
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        config: {
            trainGames: args.trainGames,
            evalGames: args.evalGames,
            selfplayJobs: args.selfplayJobs,
            seed: args.seed,
            evalSeedOffset: args.evalSeedOffset,
            maxPlies: args.maxPlies,
            allowCardUsage: args.allowCardUsage,
            cardUsageRate: args.cardUsageRate,
            selfplayPolicyMixRate: args.selfplayPolicyMixRate,
            selfplayPolicyPoolSampling: args.selfplayPolicyPoolSampling,
            selfplayPolicyPoolRecencyDecay: args.selfplayPolicyPoolRecencyDecay,
            selfplayPolicyCurrentAnchorRate: args.selfplayPolicyCurrentAnchorRate,
            selfplayCardUsageRateJitter: args.selfplayCardUsageRateJitter,
            selfplayTacticalWeightMin: args.selfplayTacticalWeightMin,
            selfplayTacticalWeightMax: args.selfplayTacticalWeightMax,
            selfplayTacticalDepthOpening: args.selfplayTacticalDepthOpening,
            selfplayTacticalDepthMid: args.selfplayTacticalDepthMid,
            selfplayTacticalDepthEnd: args.selfplayTacticalDepthEnd,
            selfplayTacticalBeamWidth: args.selfplayTacticalBeamWidth,
            selfplayTeacherCommitteeWeightMin: args.selfplayTeacherCommitteeWeightMin,
            selfplayTeacherCommitteeWeightMax: args.selfplayTeacherCommitteeWeightMax,
            selfplayTeacherCommitteeConsensusBonusMin: args.selfplayTeacherCommitteeConsensusBonusMin,
            selfplayTeacherCommitteeConsensusBonusMax: args.selfplayTeacherCommitteeConsensusBonusMax,
            bootstrapPolicyModelPath: args.bootstrapPolicyModelPath || null
        },
        paths,
        steps
    };
    writeSummary(summaryPath, payload);
    console.log(`[hardcase-mining] summary=${summaryPath}`);
}

if (require.main === module) {
    try {
        main();
    } catch (err) {
        console.error('[hardcase-mining] failed:', err && err.message ? err.message : err);
        process.exit(1);
    }
}
