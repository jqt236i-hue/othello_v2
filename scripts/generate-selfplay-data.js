#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const SeededPRNG = require('../game/schema/prng');
const {
    runSelfPlayGames,
    SELFPLAY_SCHEMA_VERSION,
    LEGACY_SELFPLAY_SCHEMA_VERSION
} = require('../src/engine/selfplay-runner');
const {
    loadResolvedTrainingConfig,
    applySelfplayArgsFromResolvedConfig
} = require('./training-resolved-config-utils');

const WORKER_ENV_FLAG = 'SELFPLAY_GENERATE_WORKER';
const WORKER_TASK_ENV = 'SELFPLAY_GENERATE_WORKER_TASK';

function defaultDataLaneForSeedFamily(seedFamily) {
    const normalized = String(seedFamily || 'train').trim().toLowerCase();
    if (normalized === 'eval') return 'eval-suite';
    if (normalized === 'quick') return 'quick-gate';
    if (normalized === 'quality') return 'quality-gate';
    if (normalized === 'onnx-gate') return 'onnx-gate';
    return 'train-main';
}

function buildDefaultHardcaseOutPath(outPath) {
    const resolvedOutPath = path.resolve(process.cwd(), String(outPath || 'data/selfplay.ndjson'));
    const dir = path.dirname(resolvedOutPath);
    const ext = path.extname(resolvedOutPath);
    const base = ext ? path.basename(resolvedOutPath, ext) : path.basename(resolvedOutPath);
    const suffix = ext || '.ndjson';
    return path.join(dir, `${base}.hardcase${suffix}`);
}

function isHardcaseRecord(record) {
    if (!record || typeof record !== 'object') return false;
    if (record.isHardcase === true) return true;
    return Array.isArray(record.hardcaseTags) && record.hardcaseTags.length > 0;
}

function waitForStreamClose(stream) {
    if (!stream) return Promise.resolve();
    return new Promise((resolve, reject) => {
        stream.on('error', reject);
        stream.end(resolve);
    });
}

function parseArgs(argv) {
    const args = {
        games: 100,
        seed: 1,
        maxPlies: 220,
        out: path.resolve(process.cwd(), 'data', 'selfplay.ndjson'),
        hardcaseOut: null,
        allowCardUsage: true,
        cardUsageRate: 0.2,
        policyMixRate: 1,
        cardUsageRateJitter: 0,
        tacticalWeightMin: 1,
        tacticalWeightMax: 1,
        tacticalDepthOpening: 2,
        tacticalDepthMid: 3,
        tacticalDepthEnd: 4,
        tacticalBeamWidth: 0,
        teacherCommitteeWeightMin: 28,
        teacherCommitteeWeightMax: 28,
        teacherCommitteeConsensusBonusMin: 320,
        teacherCommitteeConsensusBonusMax: 320,
        policyScoreWeightMin: 1,
        policyScoreWeightMax: 1,
        heuristicWeightMin: 1,
        heuristicWeightMax: 1,
        jobs: 10,
        workerRetries: 1,
        resumeChunkSize: 0,
        reuseCompletedChunks: false,
        policyModelPath: null,
        policyModelPoolPaths: [],
        policyPoolSampling: 'uniform',
        policyPoolRecencyDecay: 1.0,
        policyCurrentAnchorRate: 0,
        seedFamily: 'train',
        dataLane: null,
        resolvedConfigPath: null,
        verbose: false,
        help: false
    };
    const specified = new Set();

    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--help' || a === '-h') {
            args.help = true;
            continue;
        }
        if (a === '--games' || a === '-g') {
            args.games = Number(argv[++i]);
            specified.add('games');
            continue;
        }
        if (a === '--seed' || a === '-s') {
            args.seed = Number(argv[++i]);
            specified.add('seed');
            continue;
        }
        if (a === '--max-plies') {
            args.maxPlies = Number(argv[++i]);
            specified.add('maxPlies');
            continue;
        }
        if (a === '--out' || a === '-o') {
            args.out = path.resolve(process.cwd(), argv[++i]);
            specified.add('out');
            continue;
        }
        if (a === '--hardcase-out') {
            args.hardcaseOut = path.resolve(process.cwd(), argv[++i]);
            specified.add('hardcaseOut');
            continue;
        }
        if (a === '--no-cards') {
            args.allowCardUsage = false;
            specified.add('allowCardUsage');
            continue;
        }
        if (a === '--with-cards') {
            args.allowCardUsage = true;
            specified.add('allowCardUsage');
            continue;
        }
        if (a === '--card-usage-rate') {
            args.cardUsageRate = Number(argv[++i]);
            specified.add('cardUsageRate');
            continue;
        }
        if (a === '--policy-mix-rate') {
            args.policyMixRate = Number(argv[++i]);
            specified.add('policyMixRate');
            continue;
        }
        if (a === '--card-usage-rate-jitter') {
            args.cardUsageRateJitter = Number(argv[++i]);
            specified.add('cardUsageRateJitter');
            continue;
        }
        if (a === '--tactical-weight-min') {
            args.tacticalWeightMin = Number(argv[++i]);
            specified.add('tacticalWeightMin');
            continue;
        }
        if (a === '--tactical-weight-max') {
            args.tacticalWeightMax = Number(argv[++i]);
            specified.add('tacticalWeightMax');
            continue;
        }
        if (a === '--tactical-depth-opening') {
            args.tacticalDepthOpening = Number(argv[++i]);
            specified.add('tacticalDepthOpening');
            continue;
        }
        if (a === '--tactical-depth-mid') {
            args.tacticalDepthMid = Number(argv[++i]);
            specified.add('tacticalDepthMid');
            continue;
        }
        if (a === '--tactical-depth-end') {
            args.tacticalDepthEnd = Number(argv[++i]);
            specified.add('tacticalDepthEnd');
            continue;
        }
        if (a === '--tactical-beam-width') {
            args.tacticalBeamWidth = Number(argv[++i]);
            specified.add('tacticalBeamWidth');
            continue;
        }
        if (a === '--teacher-committee-weight-min') {
            args.teacherCommitteeWeightMin = Number(argv[++i]);
            specified.add('teacherCommitteeWeightMin');
            continue;
        }
        if (a === '--teacher-committee-weight-max') {
            args.teacherCommitteeWeightMax = Number(argv[++i]);
            specified.add('teacherCommitteeWeightMax');
            continue;
        }
        if (a === '--teacher-committee-consensus-bonus-min') {
            args.teacherCommitteeConsensusBonusMin = Number(argv[++i]);
            specified.add('teacherCommitteeConsensusBonusMin');
            continue;
        }
        if (a === '--teacher-committee-consensus-bonus-max') {
            args.teacherCommitteeConsensusBonusMax = Number(argv[++i]);
            specified.add('teacherCommitteeConsensusBonusMax');
            continue;
        }
        if (a === '--policy-score-weight-min') {
            args.policyScoreWeightMin = Number(argv[++i]);
            specified.add('policyScoreWeightMin');
            continue;
        }
        if (a === '--policy-score-weight-max') {
            args.policyScoreWeightMax = Number(argv[++i]);
            specified.add('policyScoreWeightMax');
            continue;
        }
        if (a === '--heuristic-weight-min') {
            args.heuristicWeightMin = Number(argv[++i]);
            specified.add('heuristicWeightMin');
            continue;
        }
        if (a === '--heuristic-weight-max') {
            args.heuristicWeightMax = Number(argv[++i]);
            specified.add('heuristicWeightMax');
            continue;
        }
        if (a === '--jobs' || a === '-j') {
            args.jobs = Number(argv[++i]);
            specified.add('jobs');
            continue;
        }
        if (a === '--worker-retries') {
            args.workerRetries = Number(argv[++i]);
            specified.add('workerRetries');
            continue;
        }
        if (a === '--resume-chunk-size') {
            args.resumeChunkSize = Number(argv[++i]);
            specified.add('resumeChunkSize');
            continue;
        }
        if (a === '--reuse-completed-chunks') {
            args.reuseCompletedChunks = true;
            continue;
        }
        if (a === '--policy-model') {
            args.policyModelPath = path.resolve(process.cwd(), argv[++i]);
            specified.add('policyModelPath');
            continue;
        }
        if (a === '--policy-model-pool') {
            const raw = String(argv[++i] || '').trim();
            if (!raw) {
                throw new Error('--policy-model-pool requires at least one path');
            }
            const paths = raw
                .split(',')
                .map((one) => one.trim())
                .filter(Boolean)
                .map((one) => path.resolve(process.cwd(), one));
            if (paths.length <= 0) {
                throw new Error('--policy-model-pool requires at least one path');
            }
            args.policyModelPoolPaths.push(...paths);
            specified.add('policyModelPoolPaths');
            continue;
        }
        if (a === '--policy-pool-sampling') {
            args.policyPoolSampling = String(argv[++i] || '').trim().toLowerCase();
            specified.add('policyPoolSampling');
            continue;
        }
        if (a === '--policy-pool-recency-decay') {
            args.policyPoolRecencyDecay = Number(argv[++i]);
            specified.add('policyPoolRecencyDecay');
            continue;
        }
        if (a === '--policy-current-anchor-rate') {
            args.policyCurrentAnchorRate = Number(argv[++i]);
            specified.add('policyCurrentAnchorRate');
            continue;
        }
        if (a === '--seed-family') {
            args.seedFamily = String(argv[++i] || '').trim().toLowerCase();
            specified.add('seedFamily');
            continue;
        }
        if (a === '--data-lane') {
            args.dataLane = String(argv[++i] || '').trim();
            specified.add('dataLane');
            continue;
        }
        if (a === '--resolved-config') {
            args.resolvedConfigPath = path.resolve(process.cwd(), argv[++i]);
            specified.add('resolvedConfigPath');
            continue;
        }
        if (a === '--verbose') {
            args.verbose = true;
            continue;
        }
    }

    const resolvedConfig = args.resolvedConfigPath
        ? loadResolvedTrainingConfig(args.resolvedConfigPath)
        : null;
    if (resolvedConfig) {
        applySelfplayArgsFromResolvedConfig(args, specified, resolvedConfig);
    }
    if (!specified.has('dataLane')) {
        args.dataLane = defaultDataLaneForSeedFamily(args.seedFamily);
    }
    if (resolvedConfig && !specified.has('hardcaseOut')) {
        args.hardcaseOut = buildDefaultHardcaseOutPath(args.out);
    }

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!args.seedFamily) throw new Error('--seed-family must be a non-empty string');
    if (!args.dataLane) throw new Error('--data-lane must be a non-empty string');
    if (!Number.isFinite(args.cardUsageRate) || args.cardUsageRate < 0 || args.cardUsageRate > 1) {
        throw new Error('--card-usage-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.policyMixRate) || args.policyMixRate < 0 || args.policyMixRate > 1) {
        throw new Error('--policy-mix-rate must be in [0,1]');
    }
    if (!Number.isFinite(args.cardUsageRateJitter) || args.cardUsageRateJitter < 0 || args.cardUsageRateJitter > 1) {
        throw new Error('--card-usage-rate-jitter must be in [0,1]');
    }
    if (!Number.isFinite(args.tacticalWeightMin) || args.tacticalWeightMin < 0) {
        throw new Error('--tactical-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.tacticalWeightMax) || args.tacticalWeightMax < 0) {
        throw new Error('--tactical-weight-max must be >= 0');
    }
    if (args.tacticalWeightMax < args.tacticalWeightMin) {
        throw new Error('--tactical-weight-max must be >= --tactical-weight-min');
    }
    if (!Number.isFinite(args.tacticalDepthOpening) || args.tacticalDepthOpening < 0) {
        throw new Error('--tactical-depth-opening must be >= 0');
    }
    if (!Number.isFinite(args.tacticalDepthMid) || args.tacticalDepthMid < 0) {
        throw new Error('--tactical-depth-mid must be >= 0');
    }
    if (!Number.isFinite(args.tacticalDepthEnd) || args.tacticalDepthEnd < 0) {
        throw new Error('--tactical-depth-end must be >= 0');
    }
    if (!Number.isFinite(args.tacticalBeamWidth) || args.tacticalBeamWidth < 0) {
        throw new Error('--tactical-beam-width must be >= 0');
    }
    if (!Number.isFinite(args.teacherCommitteeWeightMin) || args.teacherCommitteeWeightMin < 0) {
        throw new Error('--teacher-committee-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.teacherCommitteeWeightMax) || args.teacherCommitteeWeightMax < 0) {
        throw new Error('--teacher-committee-weight-max must be >= 0');
    }
    if (args.teacherCommitteeWeightMax < args.teacherCommitteeWeightMin) {
        throw new Error('--teacher-committee-weight-max must be >= --teacher-committee-weight-min');
    }
    if (!Number.isFinite(args.teacherCommitteeConsensusBonusMin) || args.teacherCommitteeConsensusBonusMin < 0) {
        throw new Error('--teacher-committee-consensus-bonus-min must be >= 0');
    }
    if (!Number.isFinite(args.teacherCommitteeConsensusBonusMax) || args.teacherCommitteeConsensusBonusMax < 0) {
        throw new Error('--teacher-committee-consensus-bonus-max must be >= 0');
    }
    if (args.teacherCommitteeConsensusBonusMax < args.teacherCommitteeConsensusBonusMin) {
        throw new Error('--teacher-committee-consensus-bonus-max must be >= --teacher-committee-consensus-bonus-min');
    }
    args.tacticalDepthOpening = Math.floor(args.tacticalDepthOpening);
    args.tacticalDepthMid = Math.floor(args.tacticalDepthMid);
    args.tacticalDepthEnd = Math.floor(args.tacticalDepthEnd);
    args.tacticalBeamWidth = Math.floor(args.tacticalBeamWidth);
    if (!Number.isFinite(args.policyScoreWeightMin) || args.policyScoreWeightMin < 0) {
        throw new Error('--policy-score-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.policyScoreWeightMax) || args.policyScoreWeightMax < 0) {
        throw new Error('--policy-score-weight-max must be >= 0');
    }
    if (args.policyScoreWeightMax < args.policyScoreWeightMin) {
        throw new Error('--policy-score-weight-max must be >= --policy-score-weight-min');
    }
    if (!Number.isFinite(args.heuristicWeightMin) || args.heuristicWeightMin < 0) {
        throw new Error('--heuristic-weight-min must be >= 0');
    }
    if (!Number.isFinite(args.heuristicWeightMax) || args.heuristicWeightMax < 0) {
        throw new Error('--heuristic-weight-max must be >= 0');
    }
    if (args.heuristicWeightMax < args.heuristicWeightMin) {
        throw new Error('--heuristic-weight-max must be >= --heuristic-weight-min');
    }
    if (!Number.isFinite(args.jobs) || args.jobs < 1) throw new Error('--jobs must be >= 1');
    args.jobs = Math.floor(args.jobs);
    if (!Number.isFinite(args.workerRetries) || args.workerRetries < 0) {
        throw new Error('--worker-retries must be >= 0');
    }
    args.workerRetries = Math.floor(args.workerRetries);
    if (!Number.isFinite(args.resumeChunkSize) || args.resumeChunkSize < 0) {
        throw new Error('--resume-chunk-size must be >= 0');
    }
    args.resumeChunkSize = Math.floor(args.resumeChunkSize);
    if (args.policyModelPath && !fs.existsSync(args.policyModelPath)) {
        throw new Error(`--policy-model not found: ${args.policyModelPath}`);
    }
    for (const onePath of args.policyModelPoolPaths) {
        if (!fs.existsSync(onePath)) {
            throw new Error(`--policy-model-pool not found: ${onePath}`);
        }
    }
    if (args.policyPoolSampling !== 'uniform' && args.policyPoolSampling !== 'recency') {
        throw new Error('--policy-pool-sampling must be uniform or recency');
    }
    if (!Number.isFinite(args.policyPoolRecencyDecay) || args.policyPoolRecencyDecay <= 0) {
        throw new Error('--policy-pool-recency-decay must be > 0');
    }
    if (!Number.isFinite(args.policyCurrentAnchorRate) || args.policyCurrentAnchorRate < 0 || args.policyCurrentAnchorRate > 1) {
        throw new Error('--policy-current-anchor-rate must be in [0,1]');
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
        '      --hardcase-out <path> Optional hardcase-only NDJSON path',
        '      --with-cards          Enable card usage in self-play (default: on)',
        '      --no-cards            Disable card usage in self-play',
        '      --card-usage-rate <r> Probability of using a card if legal moves exist (default: 0.2)',
        '      --policy-mix-rate <r> Per-player probability of using guide model each game [0..1] (default: 1.0)',
        '      --card-usage-rate-jitter <r> Per-game card usage rate jitter (+/-r) [0..1] (default: 0)',
        '      --tactical-weight-min <r> Min tactical lookahead weight when guide model is used (default: 1)',
        '      --tactical-weight-max <r> Max tactical lookahead weight when guide model is used (default: 1)',
        '      --tactical-depth-opening <n> Tactical search depth in opening phase (default: 2)',
        '      --tactical-depth-mid <n> Tactical search depth in mid phase (default: 3)',
        '      --tactical-depth-end <n> Tactical search depth in end phase (default: 4)',
        '      --tactical-beam-width <n> Tactical search beam width (0=auto, default: 0)',
        '      --teacher-committee-weight-min <r> Min committee voting weight for teacher placement selection (default: 28)',
        '      --teacher-committee-weight-max <r> Max committee voting weight for teacher placement selection (default: 28)',
        '      --teacher-committee-consensus-bonus-min <r> Min committee consensus bonus for teacher placement selection (default: 320)',
        '      --teacher-committee-consensus-bonus-max <r> Max committee consensus bonus for teacher placement selection (default: 320)',
        '      --policy-score-weight-min <r> Min model score weight when guide model is used (default: 1)',
        '      --policy-score-weight-max <r> Max model score weight when guide model is used (default: 1)',
        '      --heuristic-weight-min <r> Min heuristic score weight (default: 1)',
        '      --heuristic-weight-max <r> Max heuristic score weight (default: 1)',
        '  -j, --jobs <n>            Number of parallel self-play workers (default: 10)',
        '      --worker-retries <n>  Retry count for a shard worker that exits unexpectedly (default: 1)',
        '      --resume-chunk-size <n> Completed chunk checkpoint size in games (default: 0=off)',
        '      --reuse-completed-chunks  Reuse fully completed chunk checkpoints before rerunning missing work',
        '      --policy-model <path> Optional policy-table JSON used by both players',
        '      --policy-model-pool <paths> Comma-separated model paths for league-style mixed self-play',
        '      --policy-pool-sampling <mode> Model pool sampling mode: uniform|recency (default: uniform)',
        '      --policy-pool-recency-decay <r> Recency decay (>0) when using recency sampling (default: 1)',
        '      --policy-current-anchor-rate <r> Probability to anchor one side to current model [0..1] (default: 0)',
        '      --seed-family <name>  Seed family label stored in selfplay.v2 metadata (default: train)',
        '      --data-lane <name>    Data lane label stored in selfplay.v2 metadata',
        '      --resolved-config <path> Apply defaults from a resolved training profile JSON',
        '      --verbose             Keep internal game debug logs',
        '  -h, --help                Show this help'
    ].join('\n'));
}

function loadPolicyModel(modelPath) {
    if (!modelPath) return null;
    const raw = fs.readFileSync(modelPath, 'utf8');
    const model = JSON.parse(raw);
    const schema = model && model.schemaVersion;
    if (schema !== 'policy_table.v1' && schema !== 'policy_table.v2' && schema !== SELFPLAY_SCHEMA_VERSION && schema !== LEGACY_SELFPLAY_SCHEMA_VERSION) {
        throw new Error(`unsupported --policy-model schema: ${schema || 'unknown'}`);
    }
    if (!model || typeof model !== 'object' || !model.states || typeof model.states !== 'object') {
        throw new Error('--policy-model must contain states object');
    }
    return model;
}

function dedupePaths(paths) {
    const uniq = new Set();
    const out = [];
    for (const one of (Array.isArray(paths) ? paths : [])) {
        const normalized = path.resolve(process.cwd(), String(one || '').trim());
        if (!normalized || uniq.has(normalized)) continue;
        uniq.add(normalized);
        out.push(normalized);
    }
    return out;
}

function buildPolicyModelPathPool(opts) {
    const out = [];
    if (opts && opts.policyModelPath) out.push(path.resolve(process.cwd(), opts.policyModelPath));
    if (opts && Array.isArray(opts.policyModelPoolPaths)) {
        out.push(...opts.policyModelPoolPaths.map((one) => path.resolve(process.cwd(), one)));
    }
    return dedupePaths(out);
}

function loadPolicyModels(modelPaths) {
    return dedupePaths(modelPaths).map((onePath) => ({
        path: onePath,
        model: loadPolicyModel(onePath)
    }));
}

function createPolicyConfig(base, policyTableModel) {
    return {
        allowCardUsage: !!base.allowCardUsage,
        cardUsageRate: Number(base.cardUsageRate),
        policyTableModel,
        enableTacticalLookahead: true,
        tacticalWeight: 1,
        tacticalDepthOpening: Number(base.tacticalDepthOpening),
        tacticalDepthMid: Number(base.tacticalDepthMid),
        tacticalDepthEnd: Number(base.tacticalDepthEnd),
        tacticalBeamWidth: Number(base.tacticalBeamWidth),
        teacherCommitteeWeight: Number(base.teacherCommitteeWeight),
        teacherCommitteeConsensusBonus: Number(base.teacherCommitteeConsensusBonus)
    };
}

function createPolicyModelPoolResolver(policyModelEntries, baseOptions, resolverOptions) {
    const entries = Array.isArray(policyModelEntries) ? policyModelEntries : [];
    if (entries.length <= 0) return null;
    const opts = resolverOptions || {};
    const samplingMode = String(opts.policyPoolSampling || 'uniform').trim().toLowerCase() === 'recency'
        ? 'recency'
        : 'uniform';
    const recencyDecay = Number.isFinite(opts.policyPoolRecencyDecay)
        ? Math.max(0.0001, Number(opts.policyPoolRecencyDecay))
        : 1;
    const currentAnchorRate = Number.isFinite(opts.policyCurrentAnchorRate)
        ? Math.max(0, Math.min(1, Number(opts.policyCurrentAnchorRate)))
        : 0;
    if (entries.length === 1) {
        const onlyModel = entries[0].model;
        return () => ({
            black: createPolicyConfig(baseOptions, onlyModel),
            white: createPolicyConfig(baseOptions, onlyModel)
        });
    }

    const weights = entries.map((_, idx) => {
        if (samplingMode !== 'recency') return 1;
        return Math.exp(-(idx / recencyDecay));
    });

    const sampleIndex = (rng, excludeIndex) => {
        let total = 0;
        for (let i = 0; i < weights.length; i++) {
            if (i === excludeIndex) continue;
            total += weights[i];
        }
        if (!(total > 0)) {
            for (let i = 0; i < entries.length; i++) {
                if (i !== excludeIndex) return i;
            }
            return 0;
        }
        let ticket = rng.random() * total;
        for (let i = 0; i < weights.length; i++) {
            if (i === excludeIndex) continue;
            ticket -= weights[i];
            if (ticket <= 0) return i;
        }
        for (let i = weights.length - 1; i >= 0; i--) {
            if (i !== excludeIndex) return i;
        }
        return 0;
    };

    return (gameIndex, seed) => {
        const rng = SeededPRNG.createPRNG(
            (Number(seed) || 0) + ((Number(gameIndex) || 0) * 7919) + 193
        );
        let blackIndex = -1;
        let whiteIndex = -1;

        if (currentAnchorRate > 0 && rng.random() < currentAnchorRate) {
            if (rng.random() < 0.5) {
                blackIndex = 0;
                whiteIndex = sampleIndex(rng, 0);
            } else {
                whiteIndex = 0;
                blackIndex = sampleIndex(rng, 0);
            }
        } else {
            blackIndex = sampleIndex(rng, -1);
            whiteIndex = sampleIndex(rng, blackIndex);
        }

        if (blackIndex < 0) blackIndex = 0;
        if (whiteIndex < 0) whiteIndex = blackIndex;

        const blackModel = entries[blackIndex].model;
        const whiteModel = entries[whiteIndex].model;
        return {
            black: createPolicyConfig(baseOptions, blackModel),
            white: createPolicyConfig(baseOptions, whiteModel)
        };
    };
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

function createShardPlan(totalGames, baseSeed, jobs, gameIndexOffset) {
    const safeGames = Math.max(1, Math.floor(Number(totalGames) || 1));
    const safeJobs = Math.max(1, Math.min(safeGames, Math.floor(Number(jobs) || 1)));
    const base = Math.floor(Number(baseSeed) || 1);
    const baseOffset = Math.max(0, Math.floor(Number(gameIndexOffset) || 0));
    const out = [];
    let cursor = 0;
    const basePerShard = Math.floor(safeGames / safeJobs);
    const remainder = safeGames % safeJobs;
    for (let i = 0; i < safeJobs; i++) {
        const games = basePerShard + (i < remainder ? 1 : 0);
        out.push({
            shardIndex: i,
            games,
            seed: base + cursor,
            gameIndexOffset: baseOffset + cursor
        });
        cursor += games;
    }
    return out;
}

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function createChunkPlan(totalGames, baseSeed, chunkSize, gameIndexOffset) {
    const safeGames = Math.max(1, Math.floor(Number(totalGames) || 1));
    const safeChunkSize = Math.max(1, Math.floor(Number(chunkSize) || safeGames));
    const base = Math.floor(Number(baseSeed) || 1);
    const baseOffset = Math.max(0, Math.floor(Number(gameIndexOffset) || 0));
    const out = [];
    let cursor = 0;
    let chunkIndex = 0;
    while (cursor < safeGames) {
        const games = Math.min(safeChunkSize, safeGames - cursor);
        out.push({
            chunkIndex,
            games,
            seed: base + cursor,
            gameIndexOffset: baseOffset + cursor
        });
        cursor += games;
        chunkIndex += 1;
    }
    return out;
}

function buildChunkArtifactDir(outPath) {
    const resolvedOutPath = path.resolve(process.cwd(), String(outPath || 'data/selfplay.ndjson'));
    return path.join(path.dirname(resolvedOutPath), `${path.basename(resolvedOutPath)}.resume-chunks`);
}

function buildChunkArtifactPaths(chunkDir, chunkIndex, includeHardcase) {
    const chunkLabel = String(chunkIndex).padStart(4, '0');
    return {
        outPath: path.join(chunkDir, `selfplay.chunk.${chunkLabel}.ndjson`),
        hardcaseOutPath: includeHardcase
            ? path.join(chunkDir, `selfplay.hardcase.chunk.${chunkLabel}.ndjson`)
            : null,
        summaryPath: path.join(chunkDir, `selfplay.chunk.${chunkLabel}.summary.json`)
    };
}

function fileExists(filePath) {
    if (!filePath) return false;
    try {
        fs.accessSync(filePath, fs.constants.F_OK);
        return true;
    } catch (err) {
        return false;
    }
}

function readJsonFile(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function buildChunkSummaryPayload(chunk, chunkCount, result, elapsedMs) {
    return {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        chunk: {
            chunkIndex: chunk.chunkIndex,
            chunkCount,
            games: chunk.games,
            seed: chunk.seed,
            gameIndexOffset: chunk.gameIndexOffset
        },
        summary: result.summary
    };
}

function isReusableChunkPayload(payload, chunk, chunkCount) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
    const chunkMeta = payload.chunk;
    const summary = payload.summary;
    if (!chunkMeta || typeof chunkMeta !== 'object' || !summary || typeof summary !== 'object') return false;
    if (Number(chunkMeta.chunkIndex) !== chunk.chunkIndex) return false;
    if (Number(chunkMeta.chunkCount) !== chunkCount) return false;
    if (Number(chunkMeta.games) !== chunk.games) return false;
    if (Number(chunkMeta.seed) !== chunk.seed) return false;
    if (Number(chunkMeta.gameIndexOffset) !== chunk.gameIndexOffset) return false;
    if (summary.aborted === true) return false;
    return Number(summary.totalGames || 0) === chunk.games;
}

function loadReusableChunkResult(chunk, chunkCount, chunkPaths) {
    if (!fileExists(chunkPaths.outPath) || !fileExists(chunkPaths.summaryPath)) {
        return null;
    }
    if (chunkPaths.hardcaseOutPath && !fileExists(chunkPaths.hardcaseOutPath)) {
        return null;
    }
    let payload = null;
    try {
        payload = readJsonFile(chunkPaths.summaryPath);
    } catch (err) {
        return null;
    }
    if (!isReusableChunkPayload(payload, chunk, chunkCount)) {
        return null;
    }
    return {
        chunkIndex: chunk.chunkIndex,
        summary: payload.summary,
        outPath: chunkPaths.outPath,
        hardcaseOutPath: chunkPaths.hardcaseOutPath
    };
}

function runSelfPlayShard(options) {
    const opts = options || {};
    const outPath = path.resolve(process.cwd(), opts.outPath || opts.out || 'data/selfplay.shard.ndjson');
    ensureDir(path.dirname(outPath));
    const outStream = fs.createWriteStream(outPath, { encoding: 'utf8' });
    const hardcaseOutPath = opts.hardcaseOutPath
        ? path.resolve(process.cwd(), opts.hardcaseOutPath)
        : null;
    if (hardcaseOutPath) {
        ensureDir(path.dirname(hardcaseOutPath));
    }
    const hardcaseStream = hardcaseOutPath
        ? fs.createWriteStream(hardcaseOutPath, { encoding: 'utf8' })
        : null;

    const modelPathPool = buildPolicyModelPathPool(opts);
    const policyModels = Array.isArray(opts.policyModels)
        ? opts.policyModels
        : loadPolicyModels(modelPathPool);
    const modelResolver = createPolicyModelPoolResolver(policyModels, opts, opts);
    let finishedGames = 0;
    let hardcaseRecords = 0;
    const progressEvery = Number.isFinite(opts.progressEvery) && opts.progressEvery > 0
        ? Math.max(1, Math.floor(opts.progressEvery))
        : 10;

    const startedAt = Date.now();
    const result = withFilteredConsole(!opts.verbose, () => runSelfPlayGames({
        games: Number(opts.games),
        baseSeed: Number(opts.seed),
        gameIndexOffset: Number(opts.gameIndexOffset || 0),
        maxPlies: Number(opts.maxPlies),
        allowCardUsage: !!opts.allowCardUsage,
        cardUsageRate: Number(opts.cardUsageRate),
        policyMixRate: Number(opts.policyMixRate),
        cardUsageRateJitter: Number(opts.cardUsageRateJitter),
        tacticalWeightMin: Number(opts.tacticalWeightMin),
        tacticalWeightMax: Number(opts.tacticalWeightMax),
        tacticalDepthOpening: Number(opts.tacticalDepthOpening),
        tacticalDepthMid: Number(opts.tacticalDepthMid),
        tacticalDepthEnd: Number(opts.tacticalDepthEnd),
        tacticalBeamWidth: Number(opts.tacticalBeamWidth),
        teacherCommitteeWeightMin: Number(opts.teacherCommitteeWeightMin),
        teacherCommitteeWeightMax: Number(opts.teacherCommitteeWeightMax),
        teacherCommitteeConsensusBonusMin: Number(opts.teacherCommitteeConsensusBonusMin),
        teacherCommitteeConsensusBonusMax: Number(opts.teacherCommitteeConsensusBonusMax),
        policyScoreWeightMin: Number(opts.policyScoreWeightMin),
        policyScoreWeightMax: Number(opts.policyScoreWeightMax),
        heuristicWeightMin: Number(opts.heuristicWeightMin),
        heuristicWeightMax: Number(opts.heuristicWeightMax),
        seedFamily: opts.seedFamily,
        dataLane: opts.dataLane,
        playerPolicies: null,
        playerPolicyResolver: modelResolver,
        onRecord: (record) => {
            outStream.write(`${JSON.stringify(record)}\n`);
            if (hardcaseStream && isHardcaseRecord(record)) {
                hardcaseRecords += 1;
                hardcaseStream.write(`${JSON.stringify(record)}\n`);
            }
        },
        onGameEnd: (gameSummary) => {
            finishedGames += 1;
            if (
                finishedGames % progressEvery === 0 ||
                finishedGames === Number(opts.games)
            ) {
                if (typeof opts.onProgress === 'function') {
                    opts.onProgress({
                        completed: finishedGames,
                        total: Number(opts.games),
                        winner: gameSummary && gameSummary.winner ? gameSummary.winner : null
                    });
                }
            }
        }
    }));

    return new Promise((resolve, reject) => {
        const onError = (err) => reject(err);
        outStream.on('error', onError);
        if (hardcaseStream) hardcaseStream.on('error', onError);
        Promise.all([
            waitForStreamClose(outStream),
            waitForStreamClose(hardcaseStream)
        ]).then(() => {
            resolve({
                summary: Object.assign({}, result.summary, { hardcaseRecords }),
                elapsedMs: Date.now() - startedAt,
                outPath,
                hardcaseOutPath
            });
        }).catch(reject);
    });
}

function combineSummary(shardResults) {
    const rows = Array.isArray(shardResults) ? shardResults : [];
    const wins = { black: 0, white: 0, draw: 0 };
    let totalGames = 0;
    let totalPlies = 0;
    let hardcaseRecords = 0;
    for (const one of rows) {
        const s = one && one.summary ? one.summary : null;
        if (!s) continue;
        totalGames += Number(s.totalGames || 0);
        totalPlies += Number(s.totalPlies || 0);
        hardcaseRecords += Number(s.hardcaseRecords || 0);
        const w = s.wins || {};
        wins.black += Number(w.black || 0);
        wins.white += Number(w.white || 0);
        wins.draw += Number(w.draw || 0);
    }
    return {
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        totalGames,
        totalPlies,
        avgPlies: totalGames > 0 ? totalPlies / totalGames : 0,
        hardcaseRecords,
        wins
    };
}

function appendFileToStream(srcPath, outStream) {
    return new Promise((resolve, reject) => {
        const inStream = fs.createReadStream(srcPath, { encoding: 'utf8' });
        const cleanup = () => {
            inStream.off('error', onInError);
            inStream.off('end', onEnd);
            outStream.off('error', onOutError);
        };
        const onInError = (err) => {
            cleanup();
            reject(err);
        };
        const onOutError = (err) => {
            cleanup();
            reject(err);
        };
        const onEnd = () => {
            cleanup();
            resolve();
        };
        inStream.on('error', onInError);
        outStream.on('error', onOutError);
        inStream.on('end', onEnd);
        inStream.pipe(outStream, { end: false });
    });
}

async function mergeShardFiles(shardPaths, outPath) {
    ensureDir(path.dirname(outPath));
    const outStream = fs.createWriteStream(outPath, { encoding: 'utf8' });
    try {
        for (const one of shardPaths) {
            await appendFileToStream(one, outStream);
        }
    } finally {
        await new Promise((resolve, reject) => {
            outStream.on('error', reject);
            outStream.end(resolve);
        });
    }
}

function runShardWorker(task, options) {
    const workerOptions = options || {};
    const shardIndex = Number(task && task.shardIndex);
    return new Promise((resolve, reject) => {
        const child = fork(__filename, [], {
            env: Object.assign({}, process.env, {
                [WORKER_ENV_FLAG]: '1',
                [WORKER_TASK_ENV]: JSON.stringify(task),
                SELFPLAY_DEBUG_STACK: workerOptions.debugStack ? '1' : String(process.env.SELFPLAY_DEBUG_STACK || '0')
            }),
            stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        });
        let done = false;
        const finish = (err, value) => {
            if (done) return;
            done = true;
            if (err) reject(err);
            else resolve(value);
        };
        child.on('message', (msg) => {
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'progress') {
                if (typeof workerOptions.onProgress === 'function') {
                    workerOptions.onProgress(msg);
                }
                return;
            }
            if (msg.type === 'result' && msg.payload) {
                finish(null, msg.payload);
                return;
            }
            if (msg.type === 'error') {
                const error = new Error(msg.message || 'worker error');
                error.workerFailureType = 'message';
                error.shardIndex = Number.isFinite(shardIndex) ? shardIndex : null;
                error.retriable = false;
                finish(error);
            }
        });
        child.once('error', (err) => {
            const error = err instanceof Error ? err : new Error(String(err));
            error.workerFailureType = 'spawn';
            error.shardIndex = Number.isFinite(shardIndex) ? shardIndex : null;
            error.retriable = true;
            finish(error);
        });
        child.once('exit', (code, signal) => {
            if (done) return;
            const suffix = Number.isFinite(shardIndex) ? ` shard=${shardIndex}` : '';
            const error = (code === 0)
                ? new Error(`worker exited without result${suffix}`)
                : new Error(`worker failed code=${code} signal=${signal || 'none'}${suffix}`);
            error.workerFailureType = 'exit';
            error.shardIndex = Number.isFinite(shardIndex) ? shardIndex : null;
            error.exitCode = code;
            error.signal = signal || null;
            error.retriable = true;
            finish(error);
        });
    });
}

function cloneWorkerError(err, message) {
    const source = err instanceof Error ? err : new Error(String(err));
    const target = new Error(message || source.message || String(source));
    const copyKeys = ['workerFailureType', 'shardIndex', 'exitCode', 'signal', 'retriable'];
    for (const key of copyKeys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            target[key] = source[key];
        }
    }
    return target;
}

function isRetriableWorkerFailure(err) {
    return !!(err && err.retriable === true);
}

async function runShardWithRetries(task, args, options) {
    const hooks = options || {};
    const maxAttempts = 1 + Math.max(0, Math.floor(Number(args && args.workerRetries) || 0));
    let attempt = 0;
    let lastError = null;
    while (attempt < maxAttempts) {
        attempt += 1;
        if (attempt > 1 && typeof hooks.onRetryStart === 'function') {
            hooks.onRetryStart(attempt);
        }
        try {
            return await runShardWorker(task, {
                onProgress: hooks.onProgress,
                debugStack: attempt > 1
            });
        } catch (err) {
            lastError = err;
            const hasRetry = attempt < maxAttempts && isRetriableWorkerFailure(err);
            if (!hasRetry) {
                if (attempt <= 1) {
                    throw err;
                }
                throw cloneWorkerError(err, `${err && err.message ? err.message : String(err)} attempts=${attempt}/${maxAttempts}`);
            }
            console.warn(`[selfplay] shard retry ${attempt}/${maxAttempts - 1} shard=${task.shardIndex} seed=${task.seed} games=${task.games}: ${err && err.message ? err.message : String(err)}`);
        }
    }
    if (lastError) {
        throw cloneWorkerError(lastError, `${lastError.message || String(lastError)} attempts=${maxAttempts}/${maxAttempts}`);
    }
    throw new Error(`worker failed shard=${task && task.shardIndex}`);
}

function createWorkerTask(args, shard, shardOutPath, hardcaseOutPath) {
    return {
        shardIndex: shard.shardIndex,
        games: shard.games,
        seed: shard.seed,
        gameIndexOffset: shard.gameIndexOffset,
        maxPlies: args.maxPlies,
        outPath: shardOutPath,
        hardcaseOutPath,
        allowCardUsage: args.allowCardUsage,
        cardUsageRate: args.cardUsageRate,
        policyMixRate: args.policyMixRate,
        cardUsageRateJitter: args.cardUsageRateJitter,
        tacticalWeightMin: args.tacticalWeightMin,
        tacticalWeightMax: args.tacticalWeightMax,
        tacticalDepthOpening: args.tacticalDepthOpening,
        tacticalDepthMid: args.tacticalDepthMid,
        tacticalDepthEnd: args.tacticalDepthEnd,
        tacticalBeamWidth: args.tacticalBeamWidth,
        teacherCommitteeWeightMin: args.teacherCommitteeWeightMin,
        teacherCommitteeWeightMax: args.teacherCommitteeWeightMax,
        teacherCommitteeConsensusBonusMin: args.teacherCommitteeConsensusBonusMin,
        teacherCommitteeConsensusBonusMax: args.teacherCommitteeConsensusBonusMax,
        policyScoreWeightMin: args.policyScoreWeightMin,
        policyScoreWeightMax: args.policyScoreWeightMax,
        heuristicWeightMin: args.heuristicWeightMin,
        heuristicWeightMax: args.heuristicWeightMax,
        policyModelPath: args.policyModelPath,
        policyModelPoolPaths: args.policyModelPoolPaths,
        policyPoolSampling: args.policyPoolSampling,
        policyPoolRecencyDecay: args.policyPoolRecencyDecay,
        policyCurrentAnchorRate: args.policyCurrentAnchorRate,
        seedFamily: args.seedFamily,
        dataLane: args.dataLane,
        verbose: args.verbose,
        progressEvery: 10
    };
}

async function runSelfPlayParallel(args, options) {
    const hooks = options || {};
    const shardPlan = createShardPlan(args.games, args.seed, args.jobs, args.gameIndexOffset);
    const shardDir = hooks.shardDir
        ? path.resolve(process.cwd(), hooks.shardDir)
        : path.resolve(
            path.dirname(args.out),
            `.selfplay-shards-${Date.now()}-${process.pid}`
        );
    ensureDir(shardDir);

    const shardProgress = Array.from({ length: shardPlan.length }, () => 0);
    let nextGlobalLog = 10;
    const shardPromises = [];
    for (const shard of shardPlan) {
        const shardOutPath = path.resolve(
            shardDir,
            `selfplay.shard.${String(shard.shardIndex).padStart(3, '0')}.ndjson`
        );
        const shardHardcaseOutPath = args.hardcaseOut
            ? path.resolve(
                shardDir,
                `selfplay.hardcase.shard.${String(shard.shardIndex).padStart(3, '0')}.ndjson`
            )
            : null;
        const task = createWorkerTask(args, shard, shardOutPath, shardHardcaseOutPath);
        shardPromises.push(runShardWithRetries(task, args, {
            onRetryStart: () => {
                shardProgress[shard.shardIndex] = 0;
            },
            onProgress: (msg) => {
                const idx = Number(msg.shardIndex);
                const completed = Number(msg.completed || 0);
                if (Number.isFinite(idx) && idx >= 0 && idx < shardProgress.length) {
                    shardProgress[idx] = completed;
                    const globalCompleted = shardProgress.reduce((sum, one) => sum + one, 0);
                    if (typeof hooks.onProgress === 'function') {
                        hooks.onProgress({
                            completed: Math.min(args.games, globalCompleted),
                            total: args.games,
                            winner: msg.winner || null
                        });
                    } else if (globalCompleted >= nextGlobalLog || globalCompleted >= args.games) {
                        console.log(`[selfplay] ${Math.min(args.games, globalCompleted)}/${args.games} completed (last winner: ${msg.winner || 'n/a'})`);
                        while (nextGlobalLog <= globalCompleted) nextGlobalLog += 10;
                    }
                }
            }
        }));
    }

    let shardResults = null;
    try {
        shardResults = await Promise.all(shardPromises);
    } catch (err) {
        throw err;
    }

    const sorted = shardResults.slice().sort((a, b) => {
        const ai = Number(a && a.shardIndex);
        const bi = Number(b && b.shardIndex);
        return ai - bi;
    });
    const shardPaths = sorted.map((one) => one.outPath);
    await mergeShardFiles(shardPaths, args.out);
    if (args.hardcaseOut) {
        const hardcaseShardPaths = sorted
            .map((one) => one.hardcaseOutPath)
            .filter(Boolean);
        await mergeShardFiles(hardcaseShardPaths, args.hardcaseOut);
    }
    const summary = combineSummary(sorted);

    try {
        fs.rmSync(shardDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }

    return {
        summary,
        outPath: args.out,
        hardcaseOutPath: args.hardcaseOut || null
    };
}

async function runSelfPlayJob(args, options) {
    const hooks = options || {};
    if (Number(args.jobs) > 1) {
        return runSelfPlayParallel(args, hooks);
    }

    let nextGlobalLog = 10;
    const result = await runSelfPlayShard(Object.assign({}, args, {
        outPath: args.out,
        hardcaseOutPath: args.hardcaseOut,
        onProgress: (progress) => {
            if (typeof hooks.onProgress === 'function') {
                hooks.onProgress(progress);
                return;
            }
            if (progress.completed >= nextGlobalLog || progress.completed === args.games) {
                console.log(`[selfplay] ${progress.completed}/${args.games} completed (last winner: ${progress.winner || 'n/a'})`);
                while (nextGlobalLog <= progress.completed) nextGlobalLog += 10;
            }
        }
    }));
    return {
        summary: result.summary,
        outPath: result.outPath,
        hardcaseOutPath: result.hardcaseOutPath
    };
}

function buildSummaryPayload(args, summary, policyModelPaths, policyModelCount, elapsedMs) {
    return {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        config: {
            games: args.games,
            seed: args.seed,
            maxPlies: args.maxPlies,
            hardcaseOut: args.hardcaseOut,
            allowCardUsage: args.allowCardUsage,
            cardUsageRate: args.cardUsageRate,
            policyMixRate: args.policyMixRate,
            cardUsageRateJitter: args.cardUsageRateJitter,
            tacticalWeightMin: args.tacticalWeightMin,
            tacticalWeightMax: args.tacticalWeightMax,
            tacticalDepthOpening: args.tacticalDepthOpening,
            tacticalDepthMid: args.tacticalDepthMid,
            tacticalDepthEnd: args.tacticalDepthEnd,
            tacticalBeamWidth: args.tacticalBeamWidth,
            teacherCommitteeWeightMin: args.teacherCommitteeWeightMin,
            teacherCommitteeWeightMax: args.teacherCommitteeWeightMax,
            teacherCommitteeConsensusBonusMin: args.teacherCommitteeConsensusBonusMin,
            teacherCommitteeConsensusBonusMax: args.teacherCommitteeConsensusBonusMax,
            policyScoreWeightMin: args.policyScoreWeightMin,
            policyScoreWeightMax: args.policyScoreWeightMax,
            heuristicWeightMin: args.heuristicWeightMin,
            heuristicWeightMax: args.heuristicWeightMax,
            jobs: args.jobs,
            workerRetries: args.workerRetries,
            resumeChunkSize: args.resumeChunkSize,
            reuseCompletedChunks: args.reuseCompletedChunks === true,
            hasPolicyModel: policyModelCount > 0,
            policyModelPath: args.policyModelPath || null,
            policyModelPoolPaths: policyModelPaths,
            policyModelPoolSize: policyModelCount,
            policyPoolSampling: args.policyPoolSampling,
            policyPoolRecencyDecay: args.policyPoolRecencyDecay,
            policyCurrentAnchorRate: args.policyCurrentAnchorRate,
            seedFamily: args.seedFamily,
            dataLane: args.dataLane,
            resolvedConfigPath: args.resolvedConfigPath
        },
        summary
    };
}

async function runSelfPlayWithResumeChunks(args) {
    const chunkSize = Math.floor(Number(args.resumeChunkSize) || 0);
    if (!(chunkSize > 0) || chunkSize >= Number(args.games || 0)) {
        return runSelfPlayJob(args);
    }

    const chunkPlan = createChunkPlan(args.games, args.seed, chunkSize, args.gameIndexOffset);
    const chunkDir = buildChunkArtifactDir(args.out);
    ensureDir(chunkDir);

    const chunkResults = [];
    let completedGames = 0;
    let nextGlobalLog = 10;
    const logProgress = (globalCompleted, winner) => {
        if (globalCompleted < nextGlobalLog && globalCompleted < args.games) {
            return;
        }
        console.log(`[selfplay] ${Math.min(args.games, globalCompleted)}/${args.games} completed (last winner: ${winner || 'n/a'})`);
        while (nextGlobalLog <= globalCompleted) nextGlobalLog += 10;
    };

    for (const chunk of chunkPlan) {
        const chunkPaths = buildChunkArtifactPaths(chunkDir, chunk.chunkIndex, !!args.hardcaseOut);
        const reused = args.reuseCompletedChunks
            ? loadReusableChunkResult(chunk, chunkPlan.length, chunkPaths)
            : null;
        if (reused) {
            console.log(`[selfplay] reuse chunk ${chunk.chunkIndex + 1}/${chunkPlan.length} games=${chunk.games} offset=${chunk.gameIndexOffset}`);
            chunkResults.push(reused);
            completedGames += Number(reused.summary && reused.summary.totalGames || 0);
            logProgress(completedGames, 'reused');
            continue;
        }

        console.log(`[selfplay] run chunk ${chunk.chunkIndex + 1}/${chunkPlan.length} games=${chunk.games} offset=${chunk.gameIndexOffset}`);
        const chunkStartedAt = Date.now();
        const chunkResult = await runSelfPlayJob(Object.assign({}, args, {
            games: chunk.games,
            seed: chunk.seed,
            gameIndexOffset: chunk.gameIndexOffset,
            out: chunkPaths.outPath,
            hardcaseOut: chunkPaths.hardcaseOutPath
        }), {
            onProgress: (progress) => {
                logProgress(completedGames + Number(progress.completed || 0), progress.winner || null);
            }
        });
        const chunkPayload = buildChunkSummaryPayload(chunk, chunkPlan.length, chunkResult, Date.now() - chunkStartedAt);
        fs.writeFileSync(chunkPaths.summaryPath, JSON.stringify(chunkPayload, null, 2), 'utf8');
        chunkResults.push({
            chunkIndex: chunk.chunkIndex,
            summary: chunkResult.summary,
            outPath: chunkPaths.outPath,
            hardcaseOutPath: chunkPaths.hardcaseOutPath
        });
        completedGames += Number(chunkResult.summary && chunkResult.summary.totalGames || 0);
    }

    const sorted = chunkResults.slice().sort((a, b) => Number(a.chunkIndex) - Number(b.chunkIndex));
    await mergeShardFiles(sorted.map((one) => one.outPath), args.out);
    if (args.hardcaseOut) {
        await mergeShardFiles(
            sorted.map((one) => one.hardcaseOutPath).filter(Boolean),
            args.hardcaseOut
        );
    }
    const summary = combineSummary(sorted);
    try {
        fs.rmSync(chunkDir, { recursive: true, force: true });
    } catch (err) { /* ignore */ }
    return {
        summary,
        outPath: args.out,
        hardcaseOutPath: args.hardcaseOut || null
    };
}

async function runWorkerMain() {
    const raw = process.env[WORKER_TASK_ENV];
    if (!raw) throw new Error('missing worker task payload');
    const task = JSON.parse(raw);
    const shardIndex = Number(task.shardIndex || 0);
    const result = await runSelfPlayShard(Object.assign({}, task, {
        onProgress: (progress) => {
            if (typeof process.send === 'function') {
                process.send({
                    type: 'progress',
                    shardIndex,
                    completed: Number(progress.completed || 0),
                    total: Number(progress.total || 0),
                    winner: progress.winner || null
                });
            }
        }
    }));
    if (typeof process.send === 'function') {
        process.send({
            type: 'result',
            payload: {
                shardIndex,
                outPath: result.outPath,
                hardcaseOutPath: result.hardcaseOutPath,
                summary: result.summary
            }
        });
    }
}

async function main() {
    if (process.env[WORKER_ENV_FLAG] === '1') {
        try {
            await runWorkerMain();
            return;
        } catch (err) {
            if (typeof process.send === 'function') {
                process.send({ type: 'error', message: err && err.message ? err.message : String(err) });
            }
            throw err;
        }
    }

    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }

    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    if (args.hardcaseOut) {
        fs.mkdirSync(path.dirname(args.hardcaseOut), { recursive: true });
    }
    const summaryPath = `${args.out}.summary.json`;
    const startedAt = Date.now();
    const policyModelPaths = buildPolicyModelPathPool(args);
    const policyModels = loadPolicyModels(policyModelPaths);
    const result = await runSelfPlayWithResumeChunks(Object.assign({}, args, {
        policyModels
    }));

    const elapsedMs = Date.now() - startedAt;
    const payload = buildSummaryPayload(args, result.summary, policyModelPaths, policyModels.length, elapsedMs);
    fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2), 'utf8');

    console.log(`[selfplay] records: ${args.out}`);
    if (args.hardcaseOut) {
        console.log(`[selfplay] hardcases: ${args.hardcaseOut}`);
    }
    console.log(`[selfplay] summary: ${summaryPath}`);
    console.log(`[selfplay] totalGames=${result.summary.totalGames} avgPlies=${result.summary.avgPlies.toFixed(2)} wins=${JSON.stringify(result.summary.wins)}`);
    if (Number(result.summary.hardcaseRecords || 0) > 0) {
        console.log(`[selfplay] hardcaseRecords=${Number(result.summary.hardcaseRecords || 0)}`);
    }
    if (policyModelPaths.length === 1) {
        console.log(`[selfplay] policyModel=${policyModelPaths[0]}`);
    } else if (policyModelPaths.length > 1) {
        console.log(`[selfplay] policyModelPool=${policyModelPaths.length} models`);
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[selfplay] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

module.exports = {
    parseArgs,
    createShardPlan,
    createChunkPlan,
    buildChunkArtifactDir,
    buildChunkArtifactPaths,
    runShardWorker,
    runSelfPlayParallel,
    runSelfPlayWithResumeChunks,
    isRetriableWorkerFailure
};
