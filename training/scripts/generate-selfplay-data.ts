declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
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
const { getStandaloneSelfplayTeacherDefaults } = require('./selfplay-teacher-defaults');
const {
    parsePolicyModelPoolPaths,
    validateSelfplayTeacherRangeArgs,
    validateSelfplayPolicyModelArgs
} = require('./selfplay-training-arg-utils');
const {
    DEFAULT_SELFPLAY_WHITE_DECK_CODE,
    resolveInitialDeckCardIdsByPlayer
} = require('./selfplay-deck-options');

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
    const teacherDefaults = getStandaloneSelfplayTeacherDefaults();
    const args = {
        games: 100,
        seed: 1,
        maxPlies: 220,
        out: path.resolve(process.cwd(), 'data', 'selfplay.ndjson'),
        hardcaseOut: null,
        allowCardUsage: true,
        stoneSupplyEnabled: false,
        cardUsageRate: 0.2,
        policyMixRate: teacherDefaults.policyMixRate,
        cardUsageRateJitter: 0,
        tacticalWeightMin: teacherDefaults.tacticalWeightMin,
        tacticalWeightMax: teacherDefaults.tacticalWeightMax,
        tacticalDepthOpening: teacherDefaults.tacticalDepthOpening,
        tacticalDepthMid: teacherDefaults.tacticalDepthMid,
        tacticalDepthEnd: teacherDefaults.tacticalDepthEnd,
        tacticalBeamWidth: teacherDefaults.tacticalBeamWidth,
        teacherCommitteeWeightMin: teacherDefaults.teacherCommitteeWeightMin,
        teacherCommitteeWeightMax: teacherDefaults.teacherCommitteeWeightMax,
        teacherCommitteeConsensusBonusMin: teacherDefaults.teacherCommitteeConsensusBonusMin,
        teacherCommitteeConsensusBonusMax: teacherDefaults.teacherCommitteeConsensusBonusMax,
        policyScoreWeightMin: teacherDefaults.policyScoreWeightMin,
        policyScoreWeightMax: teacherDefaults.policyScoreWeightMax,
        heuristicWeightMin: teacherDefaults.heuristicWeightMin,
        heuristicWeightMax: teacherDefaults.heuristicWeightMax,
        jobs: 10,
        workerRetries: 1,
        resumeChunkSize: 0,
        reuseCompletedChunks: false,
        policyModelPath: null,
        policyModelPoolPaths: [],
        policyPoolSampling: teacherDefaults.policyPoolSampling,
        policyPoolRecencyDecay: teacherDefaults.policyPoolRecencyDecay,
        policyCurrentAnchorRate: teacherDefaults.policyCurrentAnchorRate,
        blackDeckCode: null,
        whiteDeckCode: DEFAULT_SELFPLAY_WHITE_DECK_CODE,
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
        if (a === '--stone-supply') {
            args.stoneSupplyEnabled = true;
            specified.add('stoneSupplyEnabled');
            continue;
        }
        if (a === '--no-stone-supply') {
            args.stoneSupplyEnabled = false;
            specified.add('stoneSupplyEnabled');
            continue;
        }
        if (a === '--card-usage-rate') {
            args.cardUsageRate = Number(argv[++i]);
            specified.add('cardUsageRate');
            continue;
        }
        if (a === '--black-deck-code') {
            args.blackDeckCode = String(argv[++i] || '').trim() || null;
            specified.add('blackDeckCode');
            continue;
        }
        if (a === '--white-deck-code') {
            args.whiteDeckCode = String(argv[++i] || '').trim() || null;
            specified.add('whiteDeckCode');
            continue;
        }
        if (a === '--no-white-deck-code') {
            args.whiteDeckCode = null;
            specified.add('whiteDeckCode');
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
            args.policyModelPoolPaths.push(...parsePolicyModelPoolPaths(argv[++i]));
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
    validateSelfplayTeacherRangeArgs(args);
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
    validateSelfplayPolicyModelArgs(args, fs);

    return args;
}

function printHelp() {
    const teacherDefaults = getStandaloneSelfplayTeacherDefaults();
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
        '      --stone-supply        Enable the stone supply rule (rulebook 7.3; default: off)',
        '      --no-stone-supply     Disable the stone supply rule',
        '      --card-usage-rate <r> Probability of using a card if legal moves exist (default: 0.2)',
        '      --white-deck-code <c> Fixed deckCode for white/CPU self-play (default: CPU white deck)',
        '      --no-white-deck-code  Use the standard random default deck for white too',
        `      --policy-mix-rate <r> Per-player probability of using guide model each game [0..1] (default: ${teacherDefaults.policyMixRate})`,
        '      --card-usage-rate-jitter <r> Per-game card usage rate jitter (+/-r) [0..1] (default: 0)',
        `      --tactical-weight-min <r> Min tactical lookahead weight when guide model is used (default: ${teacherDefaults.tacticalWeightMin})`,
        `      --tactical-weight-max <r> Max tactical lookahead weight when guide model is used (default: ${teacherDefaults.tacticalWeightMax})`,
        `      --tactical-depth-opening <n> Tactical search depth in opening phase (default: ${teacherDefaults.tacticalDepthOpening})`,
        `      --tactical-depth-mid <n> Tactical search depth in mid phase (default: ${teacherDefaults.tacticalDepthMid})`,
        `      --tactical-depth-end <n> Tactical search depth in end phase (default: ${teacherDefaults.tacticalDepthEnd})`,
        `      --tactical-beam-width <n> Tactical search beam width (0=auto, default: ${teacherDefaults.tacticalBeamWidth})`,
        `      --teacher-committee-weight-min <r> Min committee voting weight for teacher placement selection (default: ${teacherDefaults.teacherCommitteeWeightMin})`,
        `      --teacher-committee-weight-max <r> Max committee voting weight for teacher placement selection (default: ${teacherDefaults.teacherCommitteeWeightMax})`,
        `      --teacher-committee-consensus-bonus-min <r> Min committee consensus bonus for teacher placement selection (default: ${teacherDefaults.teacherCommitteeConsensusBonusMin})`,
        `      --teacher-committee-consensus-bonus-max <r> Max committee consensus bonus for teacher placement selection (default: ${teacherDefaults.teacherCommitteeConsensusBonusMax})`,
        `      --policy-score-weight-min <r> Min model score weight when guide model is used (default: ${teacherDefaults.policyScoreWeightMin})`,
        `      --policy-score-weight-max <r> Max model score weight when guide model is used (default: ${teacherDefaults.policyScoreWeightMax})`,
        `      --heuristic-weight-min <r> Min heuristic score weight (default: ${teacherDefaults.heuristicWeightMin})`,
        `      --heuristic-weight-max <r> Max heuristic score weight (default: ${teacherDefaults.heuristicWeightMax})`,
        '  -j, --jobs <n>            Number of parallel self-play workers (default: 10)',
        '      --worker-retries <n>  Retry count for a shard worker that exits unexpectedly (default: 1)',
        '      --resume-chunk-size <n> Completed chunk checkpoint size in games (default: 0=off)',
        '      --reuse-completed-chunks  Reuse fully completed chunk checkpoints before rerunning missing work',
        '      --policy-model <path> Optional policy-table JSON used by both players',
        '      --policy-model-pool <paths> Comma-separated model paths for league-style mixed self-play',
        `      --policy-pool-sampling <mode> Model pool sampling mode: uniform|recency (default: ${teacherDefaults.policyPoolSampling})`,
        `      --policy-pool-recency-decay <r> Recency decay (>0) when using recency sampling (default: ${teacherDefaults.policyPoolRecencyDecay})`,
        `      --policy-current-anchor-rate <r> Probability to anchor one side to current model [0..1] (default: ${teacherDefaults.policyCurrentAnchorRate})`,
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

function buildChunkArtifactPaths(chunkDir, chunkIndex, includeHardcase, attemptId = null) {
    const chunkLabel = String(chunkIndex).padStart(4, '0');
    // Each attempt writes its own files, so a non-reusable earlier attempt is never overwritten.
    const attemptLabel = attemptId ? `.${attemptId}` : '';
    return {
        outPath: path.join(chunkDir, `selfplay.chunk.${chunkLabel}${attemptLabel}.ndjson`),
        hardcaseOutPath: includeHardcase
            ? path.join(chunkDir, `selfplay.hardcase.chunk.${chunkLabel}${attemptLabel}.ndjson`)
            : null,
        // Legacy (pre-manifest) completion record; never trusted for reuse.
        summaryPath: path.join(chunkDir, `selfplay.chunk.${chunkLabel}.summary.json`),
        manifestPath: attemptId ? path.join(chunkDir, `selfplay.chunk.${chunkLabel}${attemptLabel}.manifest.json`) : null
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

// Completion manifest of one resumable chunk. It is written last (atomically), so a chunk without
// one is incomplete. Reuse requires the exact generation identity, schema/producer and output digests.
const CHUNK_MANIFEST_SCHEMA = 'selfplay-chunk-manifest.v2';
const CHUNK_MANIFEST_PRODUCER = Object.freeze({ script: 'training/scripts/generate-selfplay-data', version: 2 });

function sha256Bytes(bytes) {
    return crypto.createHash('sha256').update(bytes).digest('hex');
}

function stableStringify(value) {
    return JSON.stringify(value, (_key, item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
        return Object.fromEntries(Object.keys(item).sort().map((name) => [name, item[name]]));
    });
}

function countNdjsonRecords(bytes) {
    const text = bytes.toString('utf8');
    if (!text) return 0;
    return text.split('\n').filter((line) => line.length > 0).length;
}

function describeChunkOutput(filePath) {
    if (!filePath || !fileExists(filePath)) return null;
    const bytes = fs.readFileSync(filePath);
    return { file: path.basename(filePath), bytes: bytes.length, records: countNdjsonRecords(bytes), sha256: sha256Bytes(bytes) };
}

function digestInputFile(filePath) {
    try {
        return sha256Bytes(fs.readFileSync(filePath));
    } catch (err) {
        return null;
    }
}

/** Everything that determines a chunk's records. Execution-only settings (jobs, retries, verbose,
 * chunk count, paths) are excluded; input models are identified by content, not by name. */
function buildChunkGenerationIdentity(args, chunk) {
    const modelPaths = buildPolicyModelPathPool(args);
    return {
        chunk: {
            chunkIndex: chunk.chunkIndex,
            games: chunk.games,
            seed: chunk.seed,
            gameIndexOffset: chunk.gameIndexOffset
        },
        config: {
            maxPlies: args.maxPlies,
            allowCardUsage: !!args.allowCardUsage,
            stoneSupplyEnabled: args.stoneSupplyEnabled === true,
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
            policyPoolSampling: args.policyPoolSampling,
            policyPoolRecencyDecay: args.policyPoolRecencyDecay,
            policyCurrentAnchorRate: args.policyCurrentAnchorRate,
            blackDeckCode: args.blackDeckCode == null ? null : args.blackDeckCode,
            whiteDeckCode: args.whiteDeckCode == null ? null : args.whiteDeckCode,
            seedFamily: args.seedFamily == null ? null : args.seedFamily,
            dataLane: args.dataLane == null ? null : args.dataLane,
            hardcaseEnabled: !!args.hardcaseOut
        },
        inputs: {
            hasCurrentPolicyModel: !!args.policyModelPath,
            policyModelSha256: modelPaths.map((onePath) => digestInputFile(onePath)),
            cardCatalogSha256: digestInputFile(path.resolve(__dirname, '..', '..', 'cards', 'catalog.json'))
        }
    };
}

function buildChunkManifest(args, chunk, attemptId, chunkResult, chunkPaths, elapsedMs) {
    const identity = buildChunkGenerationIdentity(args, chunk);
    return {
        schema: CHUNK_MANIFEST_SCHEMA,
        producer: CHUNK_MANIFEST_PRODUCER,
        schemaVersion: SELFPLAY_SCHEMA_VERSION,
        attemptId,
        identitySha256: sha256Bytes(stableStringify(identity)),
        identity,
        outputs: {
            selfplay: describeChunkOutput(chunkPaths.outPath),
            hardcase: chunkPaths.hardcaseOutPath ? describeChunkOutput(chunkPaths.hardcaseOutPath) : null,
            illegalMove: describeChunkOutput(chunkResult.illegalMoveHardcaseOutPath)
        },
        summary: chunkResult.summary,
        completedAt: new Date().toISOString(),
        elapsedMs
    };
}

function writeJsonAtomically(filePath, payload) {
    const pending = `${filePath}.pending-${process.pid}`;
    fs.writeFileSync(pending, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(pending, filePath);
}

/** Returns null when reusable, otherwise the reason the manifest is rejected. */
function validateChunkManifest(manifest, chunkDir, expectedIdentitySha256, chunk) {
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return 'unreadable manifest';
    if (manifest.schema !== CHUNK_MANIFEST_SCHEMA) return `schema ${manifest.schema || 'none'}`;
    if (stableStringify(manifest.producer) !== stableStringify(CHUNK_MANIFEST_PRODUCER)) return 'producer version differs';
    if (manifest.schemaVersion !== SELFPLAY_SCHEMA_VERSION) return `record schema ${manifest.schemaVersion || 'none'}`;
    if (manifest.identitySha256 !== expectedIdentitySha256) return 'generation identity differs (settings, models, or card catalog changed)';
    const summary = manifest.summary;
    if (!summary || typeof summary !== 'object' || summary.aborted === true) return 'incomplete summary';
    if (Number(summary.totalGames || 0) !== chunk.games) return 'game count differs';
    const outputs = manifest.outputs || {};
    const expectHardcase = !!(manifest.identity && manifest.identity.config && manifest.identity.config.hardcaseEnabled);
    if (!outputs.selfplay) return 'missing selfplay output';
    if (expectHardcase !== !!outputs.hardcase) return 'hardcase output mismatch';
    const illegalCount = Number(summary.illegalMoveHardcaseRecords || 0);
    if (illegalCount > 0 && !outputs.illegalMove) return 'missing illegal-move sidecar';
    if (outputs.illegalMove && Number(outputs.illegalMove.records) !== illegalCount) return 'illegal-move sidecar count differs';
    for (const [kind, described] of Object.entries(outputs)) {
        if (!described) continue;
        const actual = describeChunkOutput(path.join(chunkDir, (described as any).file));
        if (!actual) return `missing ${kind} file`;
        if (actual.sha256 !== (described as any).sha256 || actual.records !== (described as any).records) return `${kind} file changed or truncated`;
    }
    return null;
}

function toChunkResult(chunk, manifest, chunkDir, manifestPath) {
    const outputs = manifest.outputs;
    return {
        chunkIndex: chunk.chunkIndex,
        summary: manifest.summary,
        outPath: path.join(chunkDir, outputs.selfplay.file),
        hardcaseOutPath: outputs.hardcase ? path.join(chunkDir, outputs.hardcase.file) : null,
        illegalMoveHardcaseOutPath: outputs.illegalMove ? path.join(chunkDir, outputs.illegalMove.file) : null,
        manifest,
        manifestPath
    };
}

function loadReusableChunkResult(args, chunk, chunkDir, warn = (message) => console.warn(message)) {
    const chunkLabel = String(chunk.chunkIndex).padStart(4, '0');
    const expectedIdentitySha256 = sha256Bytes(stableStringify(buildChunkGenerationIdentity(args, chunk)));
    const legacy = buildChunkArtifactPaths(chunkDir, chunk.chunkIndex, false).summaryPath;
    if (fileExists(legacy)) {
        warn(`[selfplay] chunk ${chunk.chunkIndex}: legacy completion record without a manifest is not reused; kept ${path.basename(legacy)} and regenerating in a new attempt`);
    }
    let names = [];
    try {
        names = fs.readdirSync(chunkDir);
    } catch (err) {
        return null;
    }
    const pattern = new RegExp(`^selfplay\\.chunk\\.${chunkLabel}\\.(.+)\\.manifest\\.json$`);
    for (const name of names.filter((one) => pattern.test(one)).sort()) {
        const manifestPath = path.join(chunkDir, name);
        let manifest = null;
        try {
            manifest = readJsonFile(manifestPath);
        } catch (err) {
            manifest = null;
        }
        const reason = validateChunkManifest(manifest, chunkDir, expectedIdentitySha256, chunk);
        if (!reason) return toChunkResult(chunk, manifest, chunkDir, manifestPath);
        warn(`[selfplay] chunk ${chunk.chunkIndex}: ${name} not reused (${reason}); its files are kept`);
    }
    return null;
}

function createChunkAttemptId() {
    return `a${Date.now().toString(36)}-${process.pid}`;
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
    const illegalMoveHardcaseOutPath = `${outPath}.illegal-move.ndjson`;
    let illegalMoveHardcaseStream = null;
    const writeIllegalMoveHardcase = (hardcase) => {
        if (!hardcase || typeof hardcase !== 'object') return;
        if (!illegalMoveHardcaseStream) {
            illegalMoveHardcaseStream = fs.createWriteStream(illegalMoveHardcaseOutPath, {
                encoding: 'utf8'
            });
        }
        illegalMoveHardcaseStream.write(`${JSON.stringify(hardcase)}\n`);
    };

    const modelPathPool = buildPolicyModelPathPool(opts);
    const policyModels = Array.isArray(opts.policyModels)
        ? opts.policyModels
        : loadPolicyModels(modelPathPool);
    const modelResolver = createPolicyModelPoolResolver(policyModels, opts, opts);
    let finishedGames = 0;
    let hardcaseRecords = 0;
    let illegalMoveHardcaseRecords = 0;
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
        stoneSupplyEnabled: opts.stoneSupplyEnabled === true,
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
        initialDeckCardIdsByPlayer: resolveInitialDeckCardIdsByPlayer(opts),
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
        },
        onGameRetryHardcase: (hardcase) => {
            illegalMoveHardcaseRecords += 1;
            writeIllegalMoveHardcase(hardcase);
        }
    }));

    return new Promise((resolve, reject) => {
        const onError = (err) => reject(err);
        outStream.on('error', onError);
        if (hardcaseStream) hardcaseStream.on('error', onError);
        if (illegalMoveHardcaseStream) illegalMoveHardcaseStream.on('error', onError);
        Promise.all([
            waitForStreamClose(outStream),
            waitForStreamClose(hardcaseStream),
            waitForStreamClose(illegalMoveHardcaseStream)
        ]).then(() => {
            resolve({
                summary: Object.assign({}, result.summary, {
                    hardcaseRecords,
                    illegalMoveHardcaseRecords
                }),
                elapsedMs: Date.now() - startedAt,
                outPath,
                hardcaseOutPath,
                illegalMoveHardcaseOutPath: illegalMoveHardcaseRecords > 0 ? illegalMoveHardcaseOutPath : null
            });
        }).catch(reject);
    });
}

function buildIllegalMoveHardcaseOutPath(outPath) {
    return `${path.resolve(process.cwd(), String(outPath || 'data/selfplay.ndjson'))}.illegal-move.ndjson`;
}

function combineSummary(shardResults) {
    const rows = Array.isArray(shardResults) ? shardResults : [];
    const wins = { black: 0, white: 0, draw: 0 };
    let totalGames = 0;
    let totalPlies = 0;
    let hardcaseRecords = 0;
    let illegalMoveHardcaseRecords = 0;
    for (const one of rows) {
        const s = one && one.summary ? one.summary : null;
        if (!s) continue;
        totalGames += Number(s.totalGames || 0);
        totalPlies += Number(s.totalPlies || 0);
        hardcaseRecords += Number(s.hardcaseRecords || 0);
        illegalMoveHardcaseRecords += Number(s.illegalMoveHardcaseRecords || 0);
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
        illegalMoveHardcaseRecords,
        wins
    };
}

function appendFileToStream(srcPath, outStream) {
    return new Promise<void>((resolve, reject) => {
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

function buildMergePartialPath(outPath) {
    return `${String(outPath || '')}.partial`;
}

function buildMergeStatePath(outPath) {
    return `${String(outPath || '')}.merge-state.json`;
}

function writeJsonFileAtomic(filePath, payload) {
    const resolvedPath = path.resolve(process.cwd(), filePath);
    ensureDir(path.dirname(resolvedPath));
    const tempPath = `${resolvedPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.renameSync(tempPath, resolvedPath);
}

function arraysEqual(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
        if (left[i] !== right[i]) return false;
    }
    return true;
}

function loadMergeState(statePath) {
    if (!fileExists(statePath)) return null;
    try {
        const payload = readJsonFile(statePath);
        if (!payload || payload.schemaVersion !== 'selfplay_merge_state.v1') return null;
        return payload;
    } catch (err) {
        return null;
    }
}

function resolveMergeProgress(partialPath, sourceSizes) {
    if (!fileExists(partialPath)) {
        return {
            completedCount: 0,
            truncateBytes: null
        };
    }
    let partialSize = 0;
    try {
        partialSize = fs.statSync(partialPath).size;
    } catch (err) {
        return {
            completedCount: 0,
            truncateBytes: 0
        };
    }
    let completedCount = 0;
    let consumedBytes = 0;
    for (let i = 0; i < sourceSizes.length; i++) {
        const nextTotal = consumedBytes + Number(sourceSizes[i] || 0);
        if (partialSize < nextTotal) break;
        completedCount += 1;
        consumedBytes = nextTotal;
    }
    const truncateBytes = partialSize === consumedBytes ? null : consumedBytes;
    return {
        completedCount,
        truncateBytes
    };
}

async function closeWritableStream(stream) {
    if (!stream) return;
    await new Promise<void>((resolve, reject) => {
        let settled = false;
        const cleanup = () => {
            stream.off('error', onError);
            stream.off('finish', onFinish);
        };
        const onError = (err) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err);
        };
        const onFinish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };
        stream.on('error', onError);
        stream.on('finish', onFinish);
        stream.end();
    });
}

// keepSources: resumable chunks keep their files until the merged outputs are verified;
// temporary worker shards are removed as soon as they are appended.
async function mergeShardFiles(shardPaths, outPath, options: { keepSources?: boolean } = {}) {
    const resolvedOutPath = path.resolve(process.cwd(), outPath);
    const resolvedShardPaths = shardPaths.map((one) => path.resolve(process.cwd(), one));
    const partialPath = buildMergePartialPath(resolvedOutPath);
    const statePath = buildMergeStatePath(resolvedOutPath);
    ensureDir(path.dirname(resolvedOutPath));
    const existingState = loadMergeState(statePath);
    const reusableState = existingState &&
        arraysEqual(existingState.shardPaths, resolvedShardPaths) &&
        Array.isArray(existingState.sourceSizes) &&
        existingState.sourceSizes.length === resolvedShardPaths.length
        ? existingState
        : null;
    const sourceSizes = reusableState
        ? reusableState.sourceSizes.slice()
        : resolvedShardPaths.map((onePath) => {
            if (!fileExists(onePath)) {
                throw new Error(`merge source not found: ${onePath}`);
            }
            return fs.statSync(onePath).size;
        });

    const statePayload = {
        schemaVersion: 'selfplay_merge_state.v1',
        generatedAt: new Date().toISOString(),
        outPath: resolvedOutPath,
        partialPath,
        shardPaths: resolvedShardPaths,
        sourceSizes
    };
    if (!reusableState) {
        try { fs.rmSync(partialPath, { force: true }); } catch (err) { /* ignore */ }
        writeJsonFileAtomic(statePath, statePayload);
    }

    const progress = resolveMergeProgress(partialPath, sourceSizes);
    if (progress.truncateBytes !== null) {
        fs.truncateSync(partialPath, progress.truncateBytes);
    }

    const outStream = fs.createWriteStream(partialPath, {
        encoding: 'utf8',
        flags: progress.completedCount > 0 ? 'a' : 'w'
    });
    try {
        for (let i = progress.completedCount; i < resolvedShardPaths.length; i++) {
            const onePath = resolvedShardPaths[i];
            if (!fileExists(onePath)) {
                throw new Error(`merge source not found: ${onePath}`);
            }
            await appendFileToStream(onePath, outStream);
            if (!options.keepSources) {
                try {
                    fs.rmSync(onePath, { force: true });
                } catch (err) { /* ignore */ }
            }
        }
    } finally {
        await closeWritableStream(outStream);
    }

    try { fs.rmSync(resolvedOutPath, { force: true }); } catch (err) { /* ignore */ }
    fs.renameSync(partialPath, resolvedOutPath);
    try { fs.rmSync(statePath, { force: true }); } catch (err) { /* ignore */ }
}

type WorkerFailureError = Error & {
    workerFailureType?: string;
    shardIndex?: number | null;
    seed?: number | null;
    games?: number | null;
    exitCode?: number | null;
    signal?: string | null;
    retriable?: boolean;
};

type SelfplayRunResult = {
    summary: any;
    outPath: string;
    hardcaseOutPath: string | null;
    illegalMoveHardcaseOutPath: string | null;
};

function runShardWorker(task, options) {
    const workerOptions = options || {};
    const shardIndex = Number(task && task.shardIndex);
    return new Promise<any>((resolve, reject) => {
        const child = fork(__filename, [], {
            env: Object.assign({}, process.env, {
                [WORKER_ENV_FLAG]: '1',
                [WORKER_TASK_ENV]: JSON.stringify(task),
                SELFPLAY_GENERATE_WORKER_SEED: String(Number(task && task.seed)),
                SELFPLAY_GENERATE_WORKER_GAMES: String(Number(task && task.games)),
                SELFPLAY_DEBUG_STACK: workerOptions.debugStack ? '1' : String(process.env.SELFPLAY_DEBUG_STACK || '0')
            }),
            stdio: ['inherit', 'inherit', 'inherit', 'ipc']
        });
        let done = false;
        const finish = (err: any, value?: any) => {
            if (done) return;
            done = true;
            if (err) reject(err);
            else resolve(value);
        };
        child.on('message', (msg: any) => {
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
                const detailParts = [];
                if (Number.isFinite(shardIndex)) detailParts.push(`shard=${shardIndex}`);
                if (Number.isFinite(Number(msg.seed))) detailParts.push(`seed=${Number(msg.seed)}`);
                if (Number.isFinite(Number(msg.games))) detailParts.push(`games=${Number(msg.games)}`);
                const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(' ')})` : '';
                const error = new Error(`${msg.message || 'worker error'}${detailSuffix}`) as WorkerFailureError;
                error.workerFailureType = 'message';
                error.shardIndex = Number.isFinite(shardIndex) ? shardIndex : null;
                error.seed = Number.isFinite(Number(msg.seed)) ? Number(msg.seed) : null;
                error.games = Number.isFinite(Number(msg.games)) ? Number(msg.games) : null;
                error.retriable = false;
                finish(error);
            }
        });
        child.once('error', (err) => {
            const error = (err instanceof Error ? err : new Error(String(err))) as WorkerFailureError;
            error.workerFailureType = 'spawn';
            error.shardIndex = Number.isFinite(shardIndex) ? shardIndex : null;
            error.retriable = true;
            finish(error);
        });
        child.once('exit', (code, signal) => {
            if (done) return;
            const suffix = Number.isFinite(shardIndex) ? ` shard=${shardIndex}` : '';
            const error = ((code === 0)
                ? new Error(`worker exited without result${suffix}`)
                : new Error(`worker failed code=${code} signal=${signal || 'none'}${suffix}`)) as WorkerFailureError;
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
        stoneSupplyEnabled: args.stoneSupplyEnabled === true,
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
        blackDeckCode: args.blackDeckCode,
        whiteDeckCode: args.whiteDeckCode,
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
    const illegalMoveShardPaths = sorted
        .map((one) => one.illegalMoveHardcaseOutPath)
        .filter((one) => one && fileExists(one));
    const illegalMoveHardcaseOutPath = illegalMoveShardPaths.length > 0
        ? buildIllegalMoveHardcaseOutPath(args.out)
        : null;
    if (illegalMoveHardcaseOutPath) {
        await mergeShardFiles(illegalMoveShardPaths, illegalMoveHardcaseOutPath);
    }
    const summary = combineSummary(sorted);

    try {
        fs.rmSync(shardDir, { recursive: true, force: true });
    } catch (e) { /* ignore */ }

    return {
        summary,
        outPath: args.out,
        hardcaseOutPath: args.hardcaseOut || null,
        illegalMoveHardcaseOutPath
    };
}

async function runSelfPlayJob(args, options) {
    const hooks = options || {};
    if (Number(args.jobs) > 1) {
        return runSelfPlayParallel(args, hooks);
    }

    let nextGlobalLog = 10;
    const result = (await runSelfPlayShard(Object.assign({}, args, {
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
    }))) as SelfplayRunResult;
    return {
        summary: result.summary,
        outPath: result.outPath,
        hardcaseOutPath: result.hardcaseOutPath,
        illegalMoveHardcaseOutPath: result.illegalMoveHardcaseOutPath
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
            stoneSupplyEnabled: args.stoneSupplyEnabled === true,
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

async function runSelfPlayWithResumeChunks(args, options: any = {}) {
    const chunkSize = Math.floor(Number(args.resumeChunkSize) || 0);
    if (!(chunkSize > 0) || chunkSize >= Number(args.games || 0)) {
        return runSelfPlayJob(args, {});
    }

    const chunkPlan = createChunkPlan(args.games, args.seed, chunkSize, args.gameIndexOffset);
    const chunkDir = buildChunkArtifactDir(args.out);
    ensureDir(chunkDir);
    const attemptId = options.attemptId || createChunkAttemptId();
    const warn = typeof options.warn === 'function' ? options.warn : (message) => console.warn(message);

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
        const reused = args.reuseCompletedChunks
            ? loadReusableChunkResult(args, chunk, chunkDir, warn)
            : null;
        if (reused) {
            console.log(`[selfplay] reuse chunk ${chunk.chunkIndex + 1}/${chunkPlan.length} games=${chunk.games} offset=${chunk.gameIndexOffset}`);
            chunkResults.push(reused);
            completedGames += Number(reused.summary && reused.summary.totalGames || 0);
            logProgress(completedGames, 'reused');
            continue;
        }

        const chunkPaths = buildChunkArtifactPaths(chunkDir, chunk.chunkIndex, !!args.hardcaseOut, attemptId);
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
        const manifest = buildChunkManifest(args, chunk, attemptId, chunkResult, chunkPaths, Date.now() - chunkStartedAt);
        writeJsonAtomically(chunkPaths.manifestPath, manifest);
        chunkResults.push(toChunkResult(chunk, manifest, chunkDir, chunkPaths.manifestPath));
        completedGames += Number(chunkResult.summary && chunkResult.summary.totalGames || 0);
    }

    const sorted = chunkResults.slice().sort((a, b) => Number(a.chunkIndex) - Number(b.chunkIndex));
    const keepSources = { keepSources: true };
    await mergeShardFiles(sorted.map((one) => one.outPath), args.out, keepSources);
    if (args.hardcaseOut) {
        await mergeShardFiles(
            sorted.map((one) => one.hardcaseOutPath).filter(Boolean),
            args.hardcaseOut,
            keepSources
        );
    }
    const illegalMoveChunkPaths = sorted
        .map((one) => one.illegalMoveHardcaseOutPath)
        .filter((one) => one && fileExists(one));
    const illegalMoveHardcaseOutPath = illegalMoveChunkPaths.length > 0
        ? buildIllegalMoveHardcaseOutPath(args.out)
        : null;
    if (illegalMoveHardcaseOutPath) {
        await mergeShardFiles(illegalMoveChunkPaths, illegalMoveHardcaseOutPath, keepSources);
    }

    // Confirm every merged output holds exactly the manifest records before removing any chunk.
    const expectRecords = (kind) => sorted.reduce((sum, one) => sum + Number(one.manifest.outputs[kind] ? one.manifest.outputs[kind].records : 0), 0);
    const verifyMerged = (kind, filePath) => {
        const expected = expectRecords(kind);
        const actual = filePath && fileExists(filePath) ? countNdjsonRecords(fs.readFileSync(filePath)) : 0;
        if (actual !== expected) {
            throw new Error(`[selfplay] merged ${kind} records ${actual} != chunk manifests ${expected}; chunk files kept in ${chunkDir}`);
        }
    };
    verifyMerged('selfplay', args.out);
    if (args.hardcaseOut) verifyMerged('hardcase', args.hardcaseOut);
    verifyMerged('illegalMove', illegalMoveHardcaseOutPath);

    const summary = combineSummary(sorted);
    // Remove only the chunks this attempt merged (produced now or adopted by reuse). Earlier
    // attempts that were not reusable stay in place as evidence.
    for (const one of sorted) {
        const owned = [one.outPath, one.hardcaseOutPath, one.illegalMoveHardcaseOutPath, one.manifestPath].filter(Boolean);
        for (const filePath of owned) {
            try { fs.rmSync(filePath, { force: true }); } catch (err) { /* keep on failure */ }
        }
    }
    try {
        fs.rmdirSync(chunkDir);
    } catch (err) {
        if (err && err.code === 'ENOTEMPTY') {
            warn(`[selfplay] kept non-reused chunk artifacts in ${chunkDir}`);
        }
    }
    return {
        summary,
        outPath: args.out,
        hardcaseOutPath: args.hardcaseOut || null,
        illegalMoveHardcaseOutPath
    };
}

async function runWorkerMain() {
    const raw = process.env[WORKER_TASK_ENV];
    if (!raw) throw new Error('missing worker task payload');
    const task = JSON.parse(raw);
    const shardIndex = Number(task.shardIndex || 0);
    const result = (await runSelfPlayShard(Object.assign({}, task, {
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
    }))) as SelfplayRunResult;
    if (typeof process.send === 'function') {
        await new Promise<void>((resolve) => {
            process.send!({
                type: 'result',
                payload: {
                    shardIndex,
                    outPath: result.outPath,
                    hardcaseOutPath: result.hardcaseOutPath,
                    illegalMoveHardcaseOutPath: result.illegalMoveHardcaseOutPath,
                    summary: result.summary
                }
            }, () => resolve());
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
                const includeStack = process.env.SELFPLAY_DEBUG_STACK === '1';
                process.send({
                    type: 'error',
                    message: includeStack && err && err.stack
                        ? String(err.stack)
                        : (err && err.message ? err.message : String(err)),
                    seed: Number(process.env.SELFPLAY_GENERATE_WORKER_SEED || Number.NaN),
                    games: Number(process.env.SELFPLAY_GENERATE_WORKER_GAMES || Number.NaN)
                });
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
    if (Number(result.summary.illegalMoveHardcaseRecords || 0) > 0) {
        console.log(`[selfplay] illegalMoveHardcases=${Number(result.summary.illegalMoveHardcaseRecords || 0)} path=${buildIllegalMoveHardcaseOutPath(args.out)}`);
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

export = {
    parseArgs,
    createShardPlan,
    createChunkPlan,
    buildChunkArtifactDir,
    buildChunkArtifactPaths,
    runShardWorker,
    runSelfPlayParallel,
    runSelfPlayWithResumeChunks,
    buildChunkGenerationIdentity,
    isRetriableWorkerFailure
};
