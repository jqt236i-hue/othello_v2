declare const __non_webpack_require__: NodeRequire | undefined;
const _require: NodeRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { fork } = require('child_process');
const { runBenchmark } = require('./benchmark-selfplay-policy');
const {
    loadResolvedTrainingConfig,
    applyAdoptionArgsFromResolvedConfig
} = require('./training-resolved-config-utils');
const {
    buildPolicyGatePayloadHeader,
    attachPolicyGateDecisionDiagnostics
} = require('./policy-gate-result-utils');
const {
    buildSeedList,
    buildSeedSchedule
} = require('./policy-seed-utils');
const { DEFAULT_SELFPLAY_WHITE_DECK_CODE } = require('./selfplay-deck-options');

function parseArgs(argv) {
    const args = {
        games: 300,
        seed: 1,
        seedCount: 1,
        seedStride: 1000,
        jobs: 1,
        progressEvery: 100,
        maxPlies: 220,
        threshold: 0.05,
        confidenceLevel: 0.95,
        minLowerBound: -1,
        minSeedUplift: -1,
        minSeedPassCount: 0,
        aRate: 0.2,
        bRate: 0.2,
        blackDeckCode: null,
        whiteDeckCode: DEFAULT_SELFPLAY_WHITE_DECK_CODE,
        tacticalWeight: 0,
        tacticalDepthOpening: 4,
        tacticalDepthMid: 6,
        tacticalDepthEnd: 8,
        tacticalBeamWidth: 12,
        policyScoreWeight: 1,
        heuristicWeight: 1,
        whitePriority: 0,
        qualityWeightCorner: 0,
        qualityWeightEdge: 0,
        qualityWeightCornerRecovery: 0,
        qualityWeightCornerRecapture: 0,
        qualityWeightEdgeRecovery: 0,
        qualityWeightCornerHold: 0,
        qualityWeightCornerHoldTurns: 0,
        qualityWeightEdgeHold: 0,
        qualityWeightEdgeChain: 0,
        qualityWeightFinalCornerShare: 0,
        qualityWeightFinalEdgeShare: 0,
        qualityWeightFinalLongestEdgeRunShare: 0,
        qualityWeightBonus: 0,
        qualityWeightCardImmediate: 0,
        qualityWeightCardFuture: 0,
        qualityWeightPlaceDelta: 0,
        qualityWeightCornerDonationAvoidance: 0,
        qualityWeightOpponentSafeEdgeAvoidance: 0,
        qualityWeightOwnSafeEdge: 0,
        qualityWeightOwnEdgeGapAvoidance: 0,
        qualityWeightOpponentEdgeCut: 0,
        baselineModelPath: null,
        opponentModelPath: null,
        candidateModelPath: null,
        gatePhase: 'quality',
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
        if (a === '--progress-every') { args.progressEvery = Number(argv[++i]); specified.add('progressEvery'); continue; }
        if (a === '--max-plies') { args.maxPlies = Number(argv[++i]); specified.add('maxPlies'); continue; }
        if (a === '--threshold') { args.threshold = Number(argv[++i]); specified.add('threshold'); continue; }
        if (a === '--confidence-level') { args.confidenceLevel = Number(argv[++i]); specified.add('confidenceLevel'); continue; }
        if (a === '--min-lower-bound') { args.minLowerBound = Number(argv[++i]); specified.add('minLowerBound'); continue; }
        if (a === '--min-seed-uplift') { args.minSeedUplift = Number(argv[++i]); specified.add('minSeedUplift'); continue; }
        if (a === '--min-seed-pass-count') { args.minSeedPassCount = Number(argv[++i]); specified.add('minSeedPassCount'); continue; }
        if (a === '--a-rate') { args.aRate = Number(argv[++i]); specified.add('aRate'); continue; }
        if (a === '--b-rate') { args.bRate = Number(argv[++i]); specified.add('bRate'); continue; }
        if (a === '--black-deck-code') { args.blackDeckCode = String(argv[++i] || '').trim() || null; specified.add('blackDeckCode'); continue; }
        if (a === '--white-deck-code') { args.whiteDeckCode = String(argv[++i] || '').trim() || null; specified.add('whiteDeckCode'); continue; }
        if (a === '--no-white-deck-code') { args.whiteDeckCode = null; specified.add('whiteDeckCode'); continue; }
        if (a === '--tactical-weight') { args.tacticalWeight = Number(argv[++i]); specified.add('tacticalWeight'); continue; }
        if (a === '--tactical-depth-opening') { args.tacticalDepthOpening = Number(argv[++i]); specified.add('tacticalDepthOpening'); continue; }
        if (a === '--tactical-depth-mid') { args.tacticalDepthMid = Number(argv[++i]); specified.add('tacticalDepthMid'); continue; }
        if (a === '--tactical-depth-end') { args.tacticalDepthEnd = Number(argv[++i]); specified.add('tacticalDepthEnd'); continue; }
        if (a === '--tactical-beam-width') { args.tacticalBeamWidth = Number(argv[++i]); specified.add('tacticalBeamWidth'); continue; }
        if (a === '--policy-score-weight') { args.policyScoreWeight = Number(argv[++i]); specified.add('policyScoreWeight'); continue; }
        if (a === '--heuristic-weight') { args.heuristicWeight = Number(argv[++i]); specified.add('heuristicWeight'); continue; }
        if (a === '--white-priority') { args.whitePriority = Number(argv[++i]); specified.add('whitePriority'); continue; }
        if (a === '--quality-weight-corner') { args.qualityWeightCorner = Number(argv[++i]); specified.add('qualityWeightCorner'); continue; }
        if (a === '--quality-weight-edge') { args.qualityWeightEdge = Number(argv[++i]); specified.add('qualityWeightEdge'); continue; }
        if (a === '--quality-weight-corner-recovery') { args.qualityWeightCornerRecovery = Number(argv[++i]); specified.add('qualityWeightCornerRecovery'); continue; }
        if (a === '--quality-weight-corner-recapture') { args.qualityWeightCornerRecapture = Number(argv[++i]); specified.add('qualityWeightCornerRecapture'); continue; }
        if (a === '--quality-weight-edge-recovery') { args.qualityWeightEdgeRecovery = Number(argv[++i]); specified.add('qualityWeightEdgeRecovery'); continue; }
        if (a === '--quality-weight-corner-hold') { args.qualityWeightCornerHold = Number(argv[++i]); specified.add('qualityWeightCornerHold'); continue; }
        if (a === '--quality-weight-corner-hold-turns') { args.qualityWeightCornerHoldTurns = Number(argv[++i]); specified.add('qualityWeightCornerHoldTurns'); continue; }
        if (a === '--quality-weight-edge-hold') { args.qualityWeightEdgeHold = Number(argv[++i]); specified.add('qualityWeightEdgeHold'); continue; }
        if (a === '--quality-weight-edge-chain') { args.qualityWeightEdgeChain = Number(argv[++i]); specified.add('qualityWeightEdgeChain'); continue; }
        if (a === '--quality-weight-final-corner-share') { args.qualityWeightFinalCornerShare = Number(argv[++i]); specified.add('qualityWeightFinalCornerShare'); continue; }
        if (a === '--quality-weight-final-edge-share') { args.qualityWeightFinalEdgeShare = Number(argv[++i]); specified.add('qualityWeightFinalEdgeShare'); continue; }
        if (a === '--quality-weight-final-longest-edge-run-share') { args.qualityWeightFinalLongestEdgeRunShare = Number(argv[++i]); specified.add('qualityWeightFinalLongestEdgeRunShare'); continue; }
        if (a === '--quality-weight-bonus') { args.qualityWeightBonus = Number(argv[++i]); specified.add('qualityWeightBonus'); continue; }
        if (a === '--quality-weight-card-immediate') { args.qualityWeightCardImmediate = Number(argv[++i]); specified.add('qualityWeightCardImmediate'); continue; }
        if (a === '--quality-weight-card-future') { args.qualityWeightCardFuture = Number(argv[++i]); specified.add('qualityWeightCardFuture'); continue; }
        if (a === '--quality-weight-place-delta') { args.qualityWeightPlaceDelta = Number(argv[++i]); specified.add('qualityWeightPlaceDelta'); continue; }
        if (a === '--quality-weight-corner-donation-avoidance') { args.qualityWeightCornerDonationAvoidance = Number(argv[++i]); specified.add('qualityWeightCornerDonationAvoidance'); continue; }
        if (a === '--quality-weight-opponent-safe-edge-avoidance') { args.qualityWeightOpponentSafeEdgeAvoidance = Number(argv[++i]); specified.add('qualityWeightOpponentSafeEdgeAvoidance'); continue; }
        if (a === '--quality-weight-own-safe-edge') { args.qualityWeightOwnSafeEdge = Number(argv[++i]); specified.add('qualityWeightOwnSafeEdge'); continue; }
        if (a === '--quality-weight-own-edge-gap-avoidance') { args.qualityWeightOwnEdgeGapAvoidance = Number(argv[++i]); specified.add('qualityWeightOwnEdgeGapAvoidance'); continue; }
        if (a === '--quality-weight-opponent-edge-cut') { args.qualityWeightOpponentEdgeCut = Number(argv[++i]); specified.add('qualityWeightOpponentEdgeCut'); continue; }
        if (a === '--baseline-model') { args.baselineModelPath = path.resolve(process.cwd(), argv[++i]); specified.add('baselineModelPath'); continue; }
        if (a === '--opponent-model') { args.opponentModelPath = path.resolve(process.cwd(), argv[++i]); specified.add('opponentModelPath'); continue; }
        if (a === '--candidate-model') { args.candidateModelPath = path.resolve(process.cwd(), argv[++i]); specified.add('candidateModelPath'); continue; }
        if (a === '--gate-phase') { args.gatePhase = String(argv[++i] || '').trim().toLowerCase(); specified.add('gatePhase'); continue; }
        if (a === '--resolved-config') { args.resolvedConfigPath = path.resolve(process.cwd(), argv[++i]); specified.add('resolvedConfigPath'); continue; }
        if (a === '--out' || a === '-o') { args.out = path.resolve(process.cwd(), argv[++i]); specified.add('out'); continue; }
        if (a === '--verbose') { args.verbose = true; continue; }
    }

    if (args.resolvedConfigPath) {
        const resolvedConfig = loadResolvedTrainingConfig(args.resolvedConfigPath);
        applyAdoptionArgsFromResolvedConfig(args, specified, resolvedConfig);
    }

    if (args.help) return args;

    if (!Number.isFinite(args.games) || args.games < 1) throw new Error('--games must be >= 1');
    if (!Number.isFinite(args.seed)) throw new Error('--seed must be a number');
    if (!Number.isFinite(args.seedCount) || args.seedCount < 1) throw new Error('--seed-count must be >= 1');
    if (!Number.isFinite(args.seedStride) || args.seedStride < 1) throw new Error('--seed-stride must be >= 1');
    if (!Number.isFinite(args.jobs) || args.jobs < 1) throw new Error('--jobs must be >= 1');
    args.jobs = Math.floor(args.jobs);
    if (!Number.isFinite(args.progressEvery) || args.progressEvery < 0) throw new Error('--progress-every must be >= 0');
    args.progressEvery = Math.floor(args.progressEvery);
    if (!Number.isFinite(args.maxPlies) || args.maxPlies < 1) throw new Error('--max-plies must be >= 1');
    if (!Number.isFinite(args.threshold) || args.threshold < 0 || args.threshold > 1) throw new Error('--threshold must be in [0,1]');
    if (!Number.isFinite(args.confidenceLevel) || args.confidenceLevel < 0.5 || args.confidenceLevel >= 1) {
        throw new Error('--confidence-level must be in [0.5,1)');
    }
    if (!Number.isFinite(args.minLowerBound) || args.minLowerBound < -1 || args.minLowerBound > 1) {
        throw new Error('--min-lower-bound must be in [-1,1]');
    }
    if (!Number.isFinite(args.minSeedUplift) || args.minSeedUplift < -1 || args.minSeedUplift > 1) throw new Error('--min-seed-uplift must be in [-1,1]');
    if (!Number.isFinite(args.minSeedPassCount) || args.minSeedPassCount < 0) throw new Error('--min-seed-pass-count must be >= 0');
    args.minSeedPassCount = Math.floor(args.minSeedPassCount);
    if (args.minSeedPassCount > args.seedCount) throw new Error('--min-seed-pass-count must be <= --seed-count');
    if (!Number.isFinite(args.aRate) || args.aRate < 0 || args.aRate > 1) throw new Error('--a-rate must be in [0,1]');
    if (!Number.isFinite(args.bRate) || args.bRate < 0 || args.bRate > 1) throw new Error('--b-rate must be in [0,1]');
    if (!Number.isFinite(args.tacticalWeight) || args.tacticalWeight < 0) throw new Error('--tactical-weight must be >= 0');
    if (!Number.isFinite(args.tacticalDepthOpening) || args.tacticalDepthOpening < 0) throw new Error('--tactical-depth-opening must be >= 0');
    if (!Number.isFinite(args.tacticalDepthMid) || args.tacticalDepthMid < 0) throw new Error('--tactical-depth-mid must be >= 0');
    if (!Number.isFinite(args.tacticalDepthEnd) || args.tacticalDepthEnd < 0) throw new Error('--tactical-depth-end must be >= 0');
    if (!Number.isFinite(args.tacticalBeamWidth) || args.tacticalBeamWidth < 0) throw new Error('--tactical-beam-width must be >= 0');
    args.tacticalDepthOpening = Math.floor(args.tacticalDepthOpening);
    args.tacticalDepthMid = Math.floor(args.tacticalDepthMid);
    args.tacticalDepthEnd = Math.floor(args.tacticalDepthEnd);
    args.tacticalBeamWidth = Math.floor(args.tacticalBeamWidth);
    if (!Number.isFinite(args.policyScoreWeight) || args.policyScoreWeight < 0) throw new Error('--policy-score-weight must be >= 0');
    if (!Number.isFinite(args.heuristicWeight) || args.heuristicWeight < 0) throw new Error('--heuristic-weight must be >= 0');
    if (!Number.isFinite(args.whitePriority) || args.whitePriority < 0 || args.whitePriority > 1) {
        throw new Error('--white-priority must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightCorner) || args.qualityWeightCorner < 0 || args.qualityWeightCorner > 1) {
        throw new Error('--quality-weight-corner must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightEdge) || args.qualityWeightEdge < 0 || args.qualityWeightEdge > 1) {
        throw new Error('--quality-weight-edge must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightCornerRecovery) || args.qualityWeightCornerRecovery < 0 || args.qualityWeightCornerRecovery > 1) {
        throw new Error('--quality-weight-corner-recovery must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightCornerRecapture) || args.qualityWeightCornerRecapture < 0 || args.qualityWeightCornerRecapture > 1) {
        throw new Error('--quality-weight-corner-recapture must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightEdgeRecovery) || args.qualityWeightEdgeRecovery < 0 || args.qualityWeightEdgeRecovery > 1) {
        throw new Error('--quality-weight-edge-recovery must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightCornerHold) || args.qualityWeightCornerHold < 0 || args.qualityWeightCornerHold > 1) {
        throw new Error('--quality-weight-corner-hold must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightCornerHoldTurns) || args.qualityWeightCornerHoldTurns < 0 || args.qualityWeightCornerHoldTurns > 1) {
        throw new Error('--quality-weight-corner-hold-turns must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightEdgeHold) || args.qualityWeightEdgeHold < 0 || args.qualityWeightEdgeHold > 1) {
        throw new Error('--quality-weight-edge-hold must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightEdgeChain) || args.qualityWeightEdgeChain < 0 || args.qualityWeightEdgeChain > 1) {
        throw new Error('--quality-weight-edge-chain must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightFinalCornerShare) || args.qualityWeightFinalCornerShare < 0 || args.qualityWeightFinalCornerShare > 1) {
        throw new Error('--quality-weight-final-corner-share must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightFinalEdgeShare) || args.qualityWeightFinalEdgeShare < 0 || args.qualityWeightFinalEdgeShare > 1) {
        throw new Error('--quality-weight-final-edge-share must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightFinalLongestEdgeRunShare) || args.qualityWeightFinalLongestEdgeRunShare < 0 || args.qualityWeightFinalLongestEdgeRunShare > 1) {
        throw new Error('--quality-weight-final-longest-edge-run-share must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightBonus) || args.qualityWeightBonus < 0 || args.qualityWeightBonus > 1) {
        throw new Error('--quality-weight-bonus must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightCardImmediate) || args.qualityWeightCardImmediate < 0 || args.qualityWeightCardImmediate > 1) {
        throw new Error('--quality-weight-card-immediate must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightCardFuture) || args.qualityWeightCardFuture < 0 || args.qualityWeightCardFuture > 1) {
        throw new Error('--quality-weight-card-future must be in [0,1]');
    }
    if (!Number.isFinite(args.qualityWeightPlaceDelta) || args.qualityWeightPlaceDelta < 0 || args.qualityWeightPlaceDelta > 1) {
        throw new Error('--quality-weight-place-delta must be in [0,1]');
    }
    for (const [key, flag] of [
        ['qualityWeightCornerDonationAvoidance', '--quality-weight-corner-donation-avoidance'],
        ['qualityWeightOpponentSafeEdgeAvoidance', '--quality-weight-opponent-safe-edge-avoidance'],
        ['qualityWeightOwnSafeEdge', '--quality-weight-own-safe-edge'],
        ['qualityWeightOwnEdgeGapAvoidance', '--quality-weight-own-edge-gap-avoidance'],
        ['qualityWeightOpponentEdgeCut', '--quality-weight-opponent-edge-cut'],
    ]) {
        if (!Number.isFinite(args[key]) || args[key] < 0 || args[key] > 1) {
            throw new Error(`${flag} must be in [0,1]`);
        }
    }
    if (!['quick', 'quality', 'final'].includes(args.gatePhase)) {
        throw new Error('--gate-phase must be quick, quality, or final');
    }
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
        '  -j, --jobs <n>              Parallel worker processes for seeds (default: 1)',
        '      --progress-every <n>    Progress log interval by benchmark games (default: 100, 0=off)',
        '      --max-plies <n>         Max plies per game (default: 220)',
        '      --threshold <r>         Required average uplift as decimal (default: 0.05)',
        '      --confidence-level <r>  One-sided confidence level for uplift lower bound [0.5..1) (default: 0.95)',
        '      --min-lower-bound <r>   Required lower confidence bound of uplift [-1..1] (default: -1=off)',
        '      --min-seed-uplift <r>   Required minimum per-seed uplift [-1..1] (default: -1)',
        '      --min-seed-pass-count <n>  Required number of per-seed threshold passes (default: 0)',
        '      --a-rate <r>            Card usage rate for Policy A [0..1] (default: 0.2)',
        '      --b-rate <r>            Card usage rate for Policy B [0..1] (default: 0.2)',
        '      --tactical-weight <r>   Shared tactical lookahead weight for both policies (default: 0)',
        '      --tactical-depth-opening <n> Tactical search depth in opening phase (default: 4)',
        '      --tactical-depth-mid <n> Tactical search depth in mid phase (default: 6)',
        '      --tactical-depth-end <n> Tactical search depth in end phase (default: 8)',
        '      --tactical-beam-width <n> Tactical search beam width (default: 12)',
        '      --policy-score-weight <r>  Model score weight for both policies (default: 1)',
        '      --heuristic-weight <r>  Heuristic score weight for both policies (default: 1)',
        '      --white-priority <r>    Weight of A-as-white score in decision [0..1] (default: 0)',
        '      --quality-weight-corner <r>          Weight for corner-take quality [0..1] (default: 0)',
        '      --quality-weight-edge <r>            Weight for edge-take quality [0..1] (default: 0)',
        '      --quality-weight-corner-recovery <r> Weight for corner-recovery quality [0..1] (default: 0)',
        '      --quality-weight-corner-recapture <r> Weight for corner-recapture quality [0..1] (default: 0)',
        '      --quality-weight-edge-recovery <r>   Weight for edge-recovery quality [0..1] (default: 0)',
        '      --quality-weight-corner-hold <r>     Weight for corner-hold quality [0..1] (default: 0)',
        '      --quality-weight-corner-hold-turns <r> Weight for corner-hold-turns quality [0..1] (default: 0)',
        '      --quality-weight-edge-hold <r>       Weight for edge-hold quality [0..1] (default: 0)',
        '      --quality-weight-edge-chain <r>      Weight for contiguous-edge quality [0..1] (default: 0)',
        '      --quality-weight-final-corner-share <r> Weight for final corner share quality [0..1] (default: 0)',
        '      --quality-weight-final-edge-share <r>   Weight for final edge share quality [0..1] (default: 0)',
        '      --quality-weight-final-longest-edge-run-share <r> Weight for final longest-edge-run share quality [0..1] (default: 0)',
        '      --quality-weight-corner-donation-avoidance <r> Weight for corner-donation avoidance quality [0..1] (default: 0)',
        '      --quality-weight-opponent-safe-edge-avoidance <r> Weight for opponent safe-edge avoidance quality [0..1] (default: 0)',
        '      --quality-weight-own-safe-edge <r>      Weight for own safe-edge extension quality [0..1] (default: 0)',
        '      --quality-weight-own-edge-gap-avoidance <r> Weight for own edge-gap avoidance quality [0..1] (default: 0)',
        '      --quality-weight-opponent-edge-cut <r> Weight for opponent edge-cut quality [0..1] (default: 0)',
        '      --quality-weight-bonus <r>           Weight for selected-bonus quality [0..1] (default: 0)',
        '      --quality-weight-card-immediate <r>  Weight for card immediate value quality [0..1] (default: 0)',
        '      --quality-weight-card-future <r>     Weight for card 3-ply future value quality [0..1] (default: 0)',
        '      --quality-weight-place-delta <r>     Weight for place immediate value quality [0..1] (default: 0)',
        '      --baseline-model <p>    Baseline policy-table JSON for Policy A (optional)',
        '      --opponent-model <p>    Shared opponent policy-table JSON for Policy B in both runs (optional)',
        '      --candidate-model <p>   Candidate policy-table JSON (required)',
        '      --gate-phase <name>     Resolved-config gate preset: quick | quality | final (default: quality)',
        '      --resolved-config <p>   Apply defaults from a resolved training profile JSON',
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
        const out = fn();
        if (out && typeof out.then === 'function') {
            return out.finally(() => {
                console.log = originalLog;
                console.warn = originalWarn;
            });
        }
        console.log = originalLog;
        console.warn = originalWarn;
        return out;
    } catch (err) {
        console.log = originalLog;
        console.warn = originalWarn;
        throw err;
    }
}

function computeWhitePerspectiveScore(result) {
    const side = result && result.bySide ? result.bySide.blackB_whiteA : null;
    if (!side) return 0;
    const a = Number(side.A) || 0;
    const b = Number(side.B) || 0;
    const draw = Number(side.draw) || 0;
    const total = a + b + draw;
    if (total <= 0) return 0;
    return (a + (draw * 0.5)) / total;
}

function normalizeSignedMetric(value, scale) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    const s = Number(scale);
    if (!Number.isFinite(s) || s <= 0) return 0;
    return Math.tanh(n / s);
}

function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function qualityMetricsForPolicyA(result) {
    const q = result && result.quality && result.quality.A ? result.quality.A : null;
    if (!q) {
        return {
            cornerTakeRate: 0,
            edgeTakeWhenAvailableRate: 0,
            cornerRecoveryRate: 0,
            cornerRecaptureRate: 0,
            edgeRecoveryRate: 0,
            cornerHoldRate: 0,
            avgCornerHoldTurnsNext3Plies: 0,
            edgeHoldRate: 0,
            avgEdgeChainSwing: 0,
            finalCornerShare: 0,
            finalEdgeShare: 0,
            finalLongestEdgeRunShare: 0,
            avgCornerSwing: 0,
            avgEdgeSwing: 0,
            avgSelectedCellBonus: 0,
            avgCardImmediateDiscDelta: 0,
            avgCardFutureDiscDelta3Ply: 0,
            avgPlaceDiscDelta: 0,
            cornerDonationRate: 0,
            opponentSafeEdgeAllowedRate: 0,
            ownSafeEdgeExtendRate: 0,
            avgOwnSafeEdgeRunDelta: 0,
            ownEdgeGapRate: 0,
            avgOwnEdgeGapDelta: 0,
            opponentEdgeCutRate: 0,
            badLowMobilityRate: 0,
            normCorner: 0,
            normEdge: 0,
            normCornerRecovery: 0,
            normCornerRecapture: 0,
            normEdgeRecovery: 0,
            normCornerHold: 0,
            normCornerHoldTurns: 0,
            normEdgeHold: 0,
            normEdgeChain: 0,
            normFinalCornerShare: 0,
            normFinalEdgeShare: 0,
            normFinalLongestEdgeRunShare: 0,
            normCornerSwing: 0,
            normEdgeSwing: 0,
            normBonus: 0,
            normCardImmediate: 0,
            normCardFuture: 0,
            normPlaceDelta: 0,
            normCornerDonationAvoidance: 0,
            normOpponentSafeEdgeAvoidance: 0,
            normOwnSafeEdge: 0,
            normOwnEdgeGapAvoidance: 0,
            normOpponentEdgeCut: 0,
            normBadLowMobilityAvoidance: 0
        };
    }
    const cornerTakeRate = clamp01(q.cornerTakeRate);
    const edgeTakeWhenAvailableRate = clamp01(q.edgeTakeWhenAvailableRate);
    const cornerRecoveryRate = clamp01(q.cornerRecoveryRate);
    const cornerRecaptureRate = clamp01(q.cornerRecaptureRate);
    const edgeRecoveryRate = clamp01(q.edgeRecoveryRate);
    const cornerHoldRate = clamp01(q.cornerHoldRate);
    const avgCornerHoldTurnsNext3Plies = Number.isFinite(Number(q.avgCornerHoldTurnsNext3Plies))
        ? Number(q.avgCornerHoldTurnsNext3Plies)
        : 0;
    const edgeHoldRate = clamp01(q.edgeHoldRate);
    const avgEdgeChainSwing = Number.isFinite(Number(q.avgEdgeChainSwing)) ? Number(q.avgEdgeChainSwing) : 0;
    const finalCornerShare = clamp01(q.finalCornerShare);
    const finalEdgeShare = clamp01(q.finalEdgeShare);
    const finalLongestEdgeRunShare = clamp01(q.finalLongestEdgeRunShare);
    const avgCornerSwing = Number.isFinite(Number(q.avgCornerSwing)) ? Number(q.avgCornerSwing) : 0;
    const avgEdgeSwing = Number.isFinite(Number(q.avgEdgeSwing)) ? Number(q.avgEdgeSwing) : 0;
    const avgSelectedCellBonus = Number.isFinite(Number(q.avgSelectedCellBonus)) ? Number(q.avgSelectedCellBonus) : 0;
    const avgCardImmediateDiscDelta = Number.isFinite(Number(q.avgCardImmediateDiscDelta)) ? Number(q.avgCardImmediateDiscDelta) : 0;
    const avgCardFutureDiscDelta3Ply = Number.isFinite(Number(q.avgCardFutureDiscDelta3Ply))
        ? Number(q.avgCardFutureDiscDelta3Ply)
        : 0;
    const avgPlaceDiscDelta = Number.isFinite(Number(q.avgPlaceDiscDelta)) ? Number(q.avgPlaceDiscDelta) : 0;
    const cornerDonationRate = clamp01(q.cornerDonationRate);
    const opponentSafeEdgeAllowedRate = clamp01(q.opponentSafeEdgeAllowedRate);
    const ownSafeEdgeExtendRate = clamp01(q.ownSafeEdgeExtendRate);
    const avgOwnSafeEdgeRunDelta = Number.isFinite(Number(q.avgOwnSafeEdgeRunDelta)) ? Number(q.avgOwnSafeEdgeRunDelta) : 0;
    const ownEdgeGapRate = clamp01(q.ownEdgeGapRate);
    const avgOwnEdgeGapDelta = Number.isFinite(Number(q.avgOwnEdgeGapDelta)) ? Number(q.avgOwnEdgeGapDelta) : 0;
    const opponentEdgeCutRate = clamp01(q.opponentEdgeCutRate);
    const badLowMobilityRate = clamp01(q.badLowMobilityRate);
    return {
        cornerTakeRate,
        edgeTakeWhenAvailableRate,
        cornerRecoveryRate,
        cornerRecaptureRate,
        edgeRecoveryRate,
        cornerHoldRate,
        avgCornerHoldTurnsNext3Plies,
        edgeHoldRate,
        avgEdgeChainSwing,
        finalCornerShare,
        finalEdgeShare,
        finalLongestEdgeRunShare,
        avgCornerSwing,
        avgEdgeSwing,
        avgSelectedCellBonus,
        avgCardImmediateDiscDelta,
        avgCardFutureDiscDelta3Ply,
        avgPlaceDiscDelta,
        cornerDonationRate,
        opponentSafeEdgeAllowedRate,
        ownSafeEdgeExtendRate,
        avgOwnSafeEdgeRunDelta,
        ownEdgeGapRate,
        avgOwnEdgeGapDelta,
        opponentEdgeCutRate,
        badLowMobilityRate,
        normCorner: cornerTakeRate,
        normEdge: edgeTakeWhenAvailableRate,
        normCornerRecovery: cornerRecoveryRate,
        normCornerRecapture: cornerRecaptureRate,
        normEdgeRecovery: edgeRecoveryRate,
        normCornerHold: cornerHoldRate,
        normCornerHoldTurns: clamp01(avgCornerHoldTurnsNext3Plies / 3),
        normEdgeHold: edgeHoldRate,
        normEdgeChain: normalizeSignedMetric(avgEdgeChainSwing, 10),
        normFinalCornerShare: finalCornerShare,
        normFinalEdgeShare: finalEdgeShare,
        normFinalLongestEdgeRunShare: finalLongestEdgeRunShare,
        normCornerSwing: normalizeSignedMetric(avgCornerSwing, 1.5),
        normEdgeSwing: normalizeSignedMetric(avgEdgeSwing, 2.5),
        normBonus: normalizeSignedMetric(avgSelectedCellBonus, 4),
        normCardImmediate: normalizeSignedMetric(avgCardImmediateDiscDelta, 3),
        normCardFuture: normalizeSignedMetric(avgCardFutureDiscDelta3Ply, 3),
        normPlaceDelta: normalizeSignedMetric(avgPlaceDiscDelta, 3),
        normCornerDonationAvoidance: 1 - cornerDonationRate,
        normOpponentSafeEdgeAvoidance: 1 - opponentSafeEdgeAllowedRate,
        normOwnSafeEdge: clamp01(ownSafeEdgeExtendRate + (Math.max(0, avgOwnSafeEdgeRunDelta) / 4)),
        normOwnEdgeGapAvoidance: 1 - clamp01(ownEdgeGapRate + (Math.max(0, avgOwnEdgeGapDelta) / 4)),
        normOpponentEdgeCut: opponentEdgeCutRate,
        normBadLowMobilityAvoidance: 1 - badLowMobilityRate
    };
}

function computeQualityScore(metrics, weights) {
    return (
        (metrics.normCorner * weights.corner) +
        (metrics.normEdge * weights.edge) +
        (metrics.normCornerRecovery * weights.cornerRecovery) +
        (metrics.normCornerRecapture * weights.cornerRecapture) +
        (metrics.normEdgeRecovery * weights.edgeRecovery) +
        (metrics.normCornerHold * weights.cornerHold) +
        (metrics.normCornerHoldTurns * weights.cornerHoldTurns) +
        (metrics.normEdgeHold * weights.edgeHold) +
        (metrics.normEdgeChain * weights.edgeChain) +
        (metrics.normFinalCornerShare * weights.finalCornerShare) +
        (metrics.normFinalEdgeShare * weights.finalEdgeShare) +
        (metrics.normFinalLongestEdgeRunShare * weights.finalLongestEdgeRunShare) +
        (metrics.normCornerSwing * weights.cornerSwing) +
        (metrics.normEdgeSwing * weights.edgeSwing) +
        (metrics.normBonus * weights.bonus) +
        (metrics.normCardImmediate * weights.cardImmediate) +
        (metrics.normCardFuture * weights.cardFuture) +
        (metrics.normPlaceDelta * weights.placeDelta) +
        (metrics.normCornerDonationAvoidance * weights.cornerDonationAvoidance) +
        (metrics.normOpponentSafeEdgeAvoidance * weights.opponentSafeEdgeAvoidance) +
        (metrics.normOwnSafeEdge * weights.ownSafeEdge) +
        (metrics.normOwnEdgeGapAvoidance * weights.ownEdgeGapAvoidance) +
        (metrics.normOpponentEdgeCut * weights.opponentEdgeCut)
    );
}

function computeAdoptionDecision(baseline, candidate, threshold, whitePriority, qualityWeights) {
    const whiteWeight = Number.isFinite(whitePriority)
        ? Math.max(0, Math.min(1, Number(whitePriority)))
        : 0;
    const qWeights = Object.assign({
        corner: 0,
        edge: 0,
        cornerRecovery: 0,
        cornerRecapture: 0,
        edgeRecovery: 0,
        cornerHold: 0,
        cornerHoldTurns: 0,
        edgeHold: 0,
        edgeChain: 0,
        finalCornerShare: 0,
        finalEdgeShare: 0,
        finalLongestEdgeRunShare: 0,
        cornerSwing: 0,
        edgeSwing: 0,
        bonus: 0,
        cardImmediate: 0,
        cardFuture: 0,
        placeDelta: 0,
        cornerDonationAvoidance: 0,
        opponentSafeEdgeAvoidance: 0,
        ownSafeEdge: 0,
        ownEdgeGapAvoidance: 0,
        opponentEdgeCut: 0
    }, qualityWeights || {});
    const baselineOverallScore = baseline.result.score.APercent;
    const candidateOverallScore = candidate.result.score.APercent;
    const baselineWhiteScore = computeWhitePerspectiveScore(baseline.result);
    const candidateWhiteScore = computeWhitePerspectiveScore(candidate.result);
    const baselineCoreScore = (baselineOverallScore * (1 - whiteWeight)) + (baselineWhiteScore * whiteWeight);
    const candidateCoreScore = (candidateOverallScore * (1 - whiteWeight)) + (candidateWhiteScore * whiteWeight);
    const baselineQualityMetrics = qualityMetricsForPolicyA(baseline.result);
    const candidateQualityMetrics = qualityMetricsForPolicyA(candidate.result);
    const baselineQualityScore = computeQualityScore(baselineQualityMetrics, qWeights);
    const candidateQualityScore = computeQualityScore(candidateQualityMetrics, qWeights);
    const baselineScore = baselineCoreScore + baselineQualityScore;
    const candidateScore = candidateCoreScore + candidateQualityScore;
    const uplift = candidateScore - baselineScore;
    const passed = uplift >= threshold;
    return {
        whitePriority: whiteWeight,
        baselineOverallScore,
        candidateOverallScore,
        baselineWhiteScore,
        candidateWhiteScore,
        baselineCoreScore,
        candidateCoreScore,
        baselineQualityScore,
        candidateQualityScore,
        baselineQualityMetrics,
        candidateQualityMetrics,
        qualityWeights: qWeights,
        baselineScore,
        candidateScore,
        uplift,
        threshold,
        passed
    };
}

function confidenceZScore(confidenceLevel) {
    const c = Number(confidenceLevel);
    if (!Number.isFinite(c)) return 1.6448536269514722;
    if (c >= 0.999) return 3.0902323061678132;
    if (c >= 0.995) return 2.5758293035489004;
    if (c >= 0.99) return 2.3263478740408408;
    if (c >= 0.975) return 1.959963984540054;
    if (c >= 0.95) return 1.6448536269514722;
    if (c >= 0.9) return 1.2815515655446004;
    if (c >= 0.8) return 0.8416212335729143;
    if (c >= 0.7) return 0.5244005127080409;
    if (c >= 0.6) return 0.2533471031357997;
    return 0;
}

function createPolicyAdoptionAbortError(message) {
    const err = new Error(message || 'policy adoption aborted');
    err.code = 'POLICY_ADOPTION_ABORTED';
    return err;
}

function isPolicyAdoptionAbortError(err) {
    return !!(err && err.code === 'POLICY_ADOPTION_ABORTED');
}

function isBenchmarkAbortError(err) {
    return !!(err && err.code === 'BENCHMARK_ABORTED');
}

function computeAdoptionDecisionAverage(seedDecisions, threshold, minSeedUplift, minSeedPassCount, confidenceLevel, minLowerBound) {
    const requiredMinSeedUplift = Number.isFinite(minSeedUplift) ? minSeedUplift : -1;
    const requiredMinSeedPassCount = Number.isFinite(minSeedPassCount) ? Math.max(0, Math.floor(minSeedPassCount)) : 0;
    const requiredConfidenceLevel = Number.isFinite(confidenceLevel) ? confidenceLevel : 0.95;
    const requiredMinLowerBound = Number.isFinite(minLowerBound) ? minLowerBound : -1;
    if (!Array.isArray(seedDecisions) || seedDecisions.length <= 0) {
        return {
            baselineScore: 0,
            candidateScore: 0,
            uplift: 0,
            upliftStdDev: 0,
            upliftStdErr: 0,
            upliftLowerBound: 0,
            confidenceLevel: requiredConfidenceLevel,
            requiredMinLowerBound,
            minSeedUplift: 0,
            threshold,
            requiredMinSeedUplift,
            requiredMinSeedPassCount,
            passed: false,
            passedByAverage: false,
            passedByLowerBound: false,
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
    const upliftValues = [];

    for (const one of seedDecisions) {
        const oneBaseline = Number(one && one.baselineScore) || 0;
        const oneCandidate = Number(one && one.candidateScore) || 0;
        const oneUplift = Number(one && one.uplift) || 0;
        baselineSum += oneBaseline;
        candidateSum += oneCandidate;
        upliftSum += oneUplift;
        upliftValues.push(oneUplift);
        if (oneUplift < minSeedUpliftObserved) minSeedUpliftObserved = oneUplift;
        if (one && one.passed === true) seedPassCount += 1;
    }

    const seedCount = seedDecisions.length;
    const baselineScore = baselineSum / seedCount;
    const candidateScore = candidateSum / seedCount;
    const uplift = upliftSum / seedCount;
    if (!Number.isFinite(minSeedUpliftObserved)) minSeedUpliftObserved = 0;
    let upliftVariance = 0;
    if (seedCount > 1) {
        for (const v of upliftValues) upliftVariance += (v - uplift) * (v - uplift);
        upliftVariance /= (seedCount - 1);
    }
    const upliftStdDev = Math.sqrt(Math.max(0, upliftVariance));
    const upliftStdErr = seedCount > 0 ? (upliftStdDev / Math.sqrt(seedCount)) : 0;
    const z = confidenceZScore(requiredConfidenceLevel);
    const upliftLowerBound = uplift - (z * upliftStdErr);
    const passedByAverage = uplift >= threshold;
    const passedByLowerBound = requiredMinLowerBound <= -1
        ? true
        : upliftLowerBound >= requiredMinLowerBound;
    const passedByMinSeedUplift = minSeedUpliftObserved >= requiredMinSeedUplift;
    const passedBySeedPassCount = seedPassCount >= requiredMinSeedPassCount;
    const passed = passedByAverage && passedByLowerBound && passedByMinSeedUplift && passedBySeedPassCount;

    return {
        baselineScore,
        candidateScore,
        uplift,
        upliftStdDev,
        upliftStdErr,
        upliftLowerBound,
        confidenceLevel: requiredConfidenceLevel,
        requiredMinLowerBound,
        minSeedUplift: minSeedUpliftObserved,
        threshold,
        requiredMinSeedUplift,
        requiredMinSeedPassCount,
        passed,
        passedByAverage,
        passedByLowerBound,
        passedByMinSeedUplift,
        passedBySeedPassCount,
        seedCount,
        seedPassCount
    };
}

function sumConfiguredQualityWeights(options) {
    return [
        'qualityWeightCorner',
        'qualityWeightEdge',
        'qualityWeightCornerRecovery',
        'qualityWeightCornerRecapture',
        'qualityWeightEdgeRecovery',
        'qualityWeightCornerHold',
        'qualityWeightCornerHoldTurns',
        'qualityWeightEdgeHold',
        'qualityWeightEdgeChain',
        'qualityWeightFinalCornerShare',
        'qualityWeightFinalEdgeShare',
        'qualityWeightFinalLongestEdgeRunShare',
        'qualityWeightBonus',
        'qualityWeightCardImmediate',
        'qualityWeightCardFuture',
        'qualityWeightPlaceDelta',
        'qualityWeightCornerDonationAvoidance',
        'qualityWeightOpponentSafeEdgeAvoidance',
        'qualityWeightOwnSafeEdge',
        'qualityWeightOwnEdgeGapAvoidance',
        'qualityWeightOpponentEdgeCut'
    ].reduce((sum, key) => sum + (Number(options && options[key]) || 0), 0);
}

function defaultDecisionSelector(entry) {
    return entry && entry.decision ? entry.decision : null;
}

function getDecisionSelector(options) {
    return typeof (options && options.decisionSelector) === 'function'
        ? options.decisionSelector
        : defaultDecisionSelector;
}

function getMaxPossibleSeedUplift(options) {
    if (Number.isFinite(options && options.maxPossibleSeedUplift)) {
        return Math.max(0, Number(options.maxPossibleSeedUplift));
    }
    return 1 + sumConfiguredQualityWeights(options);
}

function evaluateEarlyFailure(seedDecisions, totalSeedCount, options) {
    if (!Array.isArray(seedDecisions) || seedDecisions.length <= 0) return null;

    const safeTotalSeedCount = Math.max(seedDecisions.length, Math.floor(Number(totalSeedCount) || 0));
    const completedSeedCount = seedDecisions.length;
    const remainingSeedCount = Math.max(0, safeTotalSeedCount - completedSeedCount);
    const requiredMinSeedPassCount = Number.isFinite(options && options.minSeedPassCount)
        ? Math.max(0, Math.floor(options.minSeedPassCount))
        : 0;
    const requiredMinSeedUplift = Number.isFinite(options && options.minSeedUplift)
        ? Number(options.minSeedUplift)
        : -1;
    const threshold = Number.isFinite(options && options.threshold) ? Number(options.threshold) : 0;
    const requiredMinLowerBound = Number.isFinite(options && options.minLowerBound)
        ? Number(options.minLowerBound)
        : -1;
    const maxPossibleSeedUplift = getMaxPossibleSeedUplift(options);

    let upliftSum = 0;
    let seedPassCount = 0;
    let minSeedUpliftObserved = Infinity;
    for (const one of seedDecisions) {
        const uplift = Number(one && one.uplift) || 0;
        upliftSum += uplift;
        if (one && one.passed === true) seedPassCount += 1;
        if (uplift < minSeedUpliftObserved) minSeedUpliftObserved = uplift;
    }
    if (!Number.isFinite(minSeedUpliftObserved)) minSeedUpliftObserved = 0;

    const remainingPossibleSeedPassCount = seedPassCount + remainingSeedCount;
    const maxAchievableAverageUplift = safeTotalSeedCount > 0
        ? ((upliftSum + (remainingSeedCount * maxPossibleSeedUplift)) / safeTotalSeedCount)
        : 0;

    if (requiredMinSeedUplift > -1 && minSeedUpliftObserved < requiredMinSeedUplift) {
        return {
            reason: 'min-seed-uplift-impossible',
            completedSeedCount,
            remainingSeedCount,
            seedPassCount,
            remainingPossibleSeedPassCount,
            requiredMinSeedUplift,
            minSeedUpliftObserved,
            maxPossibleSeedUplift,
            maxAchievableAverageUplift
        };
    }
    if (remainingPossibleSeedPassCount < requiredMinSeedPassCount) {
        return {
            reason: 'min-seed-pass-count-impossible',
            completedSeedCount,
            remainingSeedCount,
            seedPassCount,
            remainingPossibleSeedPassCount,
            requiredMinSeedPassCount,
            minSeedUpliftObserved,
            maxPossibleSeedUplift,
            maxAchievableAverageUplift
        };
    }
    if (maxAchievableAverageUplift < threshold) {
        return {
            reason: 'average-threshold-impossible',
            completedSeedCount,
            remainingSeedCount,
            seedPassCount,
            remainingPossibleSeedPassCount,
            threshold,
            minSeedUpliftObserved,
            maxPossibleSeedUplift,
            maxAchievableAverageUplift
        };
    }
    if (requiredMinLowerBound > -1 && maxAchievableAverageUplift < requiredMinLowerBound) {
        return {
            reason: 'lower-bound-impossible',
            completedSeedCount,
            remainingSeedCount,
            seedPassCount,
            remainingPossibleSeedPassCount,
            requiredMinLowerBound,
            minSeedUpliftObserved,
            maxPossibleSeedUplift,
            maxAchievableAverageUplift
        };
    }

    return null;
}

function buildEarlyStopDecision(seedDecisions, totalSeedCount, options, earlyStop) {
    const partial = computeAdoptionDecisionAverage(
        seedDecisions,
        options.threshold,
        options.minSeedUplift,
        options.minSeedPassCount,
        options.confidenceLevel,
        options.minLowerBound
    );
    const decision = Object.assign({}, partial, {
        seedCount: Math.max(seedDecisions.length, Math.floor(Number(totalSeedCount) || 0)),
        seedPassCount: Number.isFinite(earlyStop && earlyStop.seedPassCount)
            ? earlyStop.seedPassCount
            : partial.seedPassCount,
        passed: false,
        earlyStop: true,
        earlyStopReason: earlyStop && earlyStop.reason ? earlyStop.reason : 'unknown',
        completedSeedCount: Number.isFinite(earlyStop && earlyStop.completedSeedCount)
            ? earlyStop.completedSeedCount
            : seedDecisions.length,
        remainingSeedCount: Number.isFinite(earlyStop && earlyStop.remainingSeedCount)
            ? earlyStop.remainingSeedCount
            : 0,
        remainingPossibleSeedPassCount: Number.isFinite(earlyStop && earlyStop.remainingPossibleSeedPassCount)
            ? earlyStop.remainingPossibleSeedPassCount
            : partial.seedPassCount,
        maxAchievableAverageUplift: Number.isFinite(earlyStop && earlyStop.maxAchievableAverageUplift)
            ? earlyStop.maxAchievableAverageUplift
            : partial.uplift,
        maxPossibleSeedUplift: Number.isFinite(earlyStop && earlyStop.maxPossibleSeedUplift)
            ? earlyStop.maxPossibleSeedUplift
            : getMaxPossibleSeedUplift(options)
    });

    if (decision.earlyStopReason === 'min-seed-uplift-impossible') {
        decision.passedByMinSeedUplift = false;
        decision.minSeedUplift = Number.isFinite(earlyStop && earlyStop.minSeedUpliftObserved)
            ? earlyStop.minSeedUpliftObserved
            : decision.minSeedUplift;
    }
    if (decision.earlyStopReason === 'min-seed-pass-count-impossible') {
        decision.passedBySeedPassCount = false;
    }
    if (decision.earlyStopReason === 'average-threshold-impossible') {
        decision.passedByAverage = false;
    }
    if (decision.earlyStopReason === 'lower-bound-impossible') {
        decision.passedByLowerBound = false;
    }

    return decision;
}

function logEarlyStop(earlyStop) {
    if (!earlyStop) return;
    console.log(
        `[policy-adoption] early-stop reason=${earlyStop.reason} completed_seeds=${earlyStop.completedSeedCount || 0} ` +
        `remaining_seeds=${earlyStop.remainingSeedCount || 0} seed_pass=${earlyStop.seedPassCount || 0} ` +
        `seed_pass_possible=${earlyStop.remainingPossibleSeedPassCount || 0} max_avg_uplift=${Number(earlyStop.maxAchievableAverageUplift || 0).toFixed(3)}`
    );
}

function buildSeedBenchmarkJobPlan(totalJobs, seedCount, cpuCount) {
    const safeCpuCount = Math.max(1, Math.floor(Number(cpuCount) || os.cpus().length || 1));
    const safeSeedCount = Math.max(1, Math.floor(Number(seedCount) || 1));
    const safeTotalJobs = Math.max(1, Math.min(Math.floor(Number(totalJobs) || 1), safeCpuCount));

    if (safeTotalJobs <= safeSeedCount) {
        return {
            totalJobs: safeTotalJobs,
            seedWorkers: safeTotalJobs,
            benchmarkJobsBySeed: new Array(safeSeedCount).fill(1)
        };
    }

    const baseJobs = Math.floor(safeTotalJobs / safeSeedCount);
    const remainder = safeTotalJobs % safeSeedCount;
    const benchmarkJobsBySeed = [];
    for (let i = 0; i < safeSeedCount; i++) {
        benchmarkJobsBySeed.push(baseJobs + (i < remainder ? 1 : 0));
    }

    return {
        totalJobs: safeTotalJobs,
        seedWorkers: safeSeedCount,
        benchmarkJobsBySeed
    };
}

async function runOneSeed(options, seedIndex, totalSeeds, currentSeed, log, startedAtMs) {
    const seedStartedAt = Date.now();
    const benchmarkJobs = Number.isFinite(options.benchmarkJobs) && options.benchmarkJobs > 0
        ? Math.max(1, Math.floor(options.benchmarkJobs))
        : 1;
    const shouldStop = typeof options.shouldStop === 'function' ? options.shouldStop : null;
    const common = {
        games: options.games,
        seed: currentSeed,
        jobs: benchmarkJobs,
        shouldStop,
        maxPlies: options.maxPlies,
        blackDeckCode: options.blackDeckCode,
        whiteDeckCode: options.whiteDeckCode,
        policyA: {
            allowCardUsage: true,
            cardUsageRate: options.aRate,
            tacticalWeight: options.tacticalWeight,
            tacticalDepthOpening: options.tacticalDepthOpening,
            tacticalDepthMid: options.tacticalDepthMid,
            tacticalDepthEnd: options.tacticalDepthEnd,
            tacticalBeamWidth: options.tacticalBeamWidth,
            policyScoreWeight: options.policyScoreWeight,
            heuristicWeight: options.heuristicWeight
        },
        policyB: {
            allowCardUsage: true,
            cardUsageRate: options.bRate,
            tacticalWeight: options.tacticalWeight,
            tacticalDepthOpening: options.tacticalDepthOpening,
            tacticalDepthMid: options.tacticalDepthMid,
            tacticalDepthEnd: options.tacticalDepthEnd,
            tacticalBeamWidth: options.tacticalBeamWidth,
            policyScoreWeight: options.policyScoreWeight,
            heuristicWeight: options.heuristicWeight
        }
    };
    const progressEvery = Number.isFinite(options.progressEvery)
        ? Math.max(0, Math.floor(options.progressEvery))
        : 100;
    const benchmarkGamesTotal = options.games * 2;

    log(`[policy-adoption] seed ${seedIndex + 1}/${totalSeeds} start seed=${currentSeed}`);

    let baselineProgressLogged = 0;
    log(`[policy-adoption] seed ${seedIndex + 1}/${totalSeeds} baseline start seed=${currentSeed}`);
    const baseline = await runBenchmark(Object.assign({}, common, {
        modelAPath: options.baselineModelPath || undefined,
        modelBPath: options.opponentModelPath || undefined,
        onProgress: (progress) => {
            const completed = Number(progress && progress.completed) || 0;
            const total = Number(progress && progress.total) || benchmarkGamesTotal;
            if (progressEvery <= 0) return;
            if (completed < total && (completed - baselineProgressLogged) < progressEvery) return;
            baselineProgressLogged = completed;
            const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
            const elapsedSec = ((Date.now() - seedStartedAt) / 1000).toFixed(1);
            log(
                `[policy-adoption] seed ${seedIndex + 1}/${totalSeeds} baseline progress ` +
                `seed=${currentSeed} games=${completed}/${total} pct=${pct} elapsed_s=${elapsedSec}`
            );
        }
    }));
    const baselineElapsedSec = ((Date.now() - seedStartedAt) / 1000).toFixed(1);
    log(
        `[policy-adoption] seed ${seedIndex + 1}/${totalSeeds} baseline done seed=${currentSeed} ` +
        `score=${baseline.result.score.APercent.toFixed(3)} elapsed_s=${baselineElapsedSec}`
    );

    let candidateProgressLogged = 0;
    log(`[policy-adoption] seed ${seedIndex + 1}/${totalSeeds} candidate start seed=${currentSeed}`);
    const candidate = await runBenchmark(Object.assign({}, common, {
        modelAPath: options.candidateModelPath,
        modelBPath: options.opponentModelPath || undefined,
        onProgress: (progress) => {
            const completed = Number(progress && progress.completed) || 0;
            const total = Number(progress && progress.total) || benchmarkGamesTotal;
            if (progressEvery <= 0) return;
            if (completed < total && (completed - candidateProgressLogged) < progressEvery) return;
            candidateProgressLogged = completed;
            const pct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';
            const elapsedSec = ((Date.now() - seedStartedAt) / 1000).toFixed(1);
            log(
                `[policy-adoption] seed ${seedIndex + 1}/${totalSeeds} candidate progress ` +
                `seed=${currentSeed} games=${completed}/${total} pct=${pct} elapsed_s=${elapsedSec}`
            );
        }
    }));
    const oneDecision = computeAdoptionDecision(
        baseline,
        candidate,
        options.threshold,
        options.whitePriority,
        {
            corner: options.qualityWeightCorner,
            edge: options.qualityWeightEdge,
            cornerRecovery: options.qualityWeightCornerRecovery,
            cornerRecapture: options.qualityWeightCornerRecapture,
            edgeRecovery: options.qualityWeightEdgeRecovery,
            cornerHold: options.qualityWeightCornerHold,
            cornerHoldTurns: options.qualityWeightCornerHoldTurns,
            edgeHold: options.qualityWeightEdgeHold,
            edgeChain: options.qualityWeightEdgeChain,
            finalCornerShare: options.qualityWeightFinalCornerShare,
            finalEdgeShare: options.qualityWeightFinalEdgeShare,
            finalLongestEdgeRunShare: options.qualityWeightFinalLongestEdgeRunShare,
            cornerSwing: 0,
            edgeSwing: 0,
            bonus: options.qualityWeightBonus,
            cardImmediate: options.qualityWeightCardImmediate,
            cardFuture: options.qualityWeightCardFuture,
            placeDelta: options.qualityWeightPlaceDelta,
            cornerDonationAvoidance: options.qualityWeightCornerDonationAvoidance,
            opponentSafeEdgeAvoidance: options.qualityWeightOpponentSafeEdgeAvoidance,
            ownSafeEdge: options.qualityWeightOwnSafeEdge,
            ownEdgeGapAvoidance: options.qualityWeightOwnEdgeGapAvoidance,
            opponentEdgeCut: options.qualityWeightOpponentEdgeCut
        }
    );
    const elapsedSec = ((Date.now() - seedStartedAt) / 1000).toFixed(1);
    const totalElapsedSec = ((Date.now() - startedAtMs) / 1000).toFixed(1);
    log(
        `[policy-adoption] seed ${seedIndex + 1}/${totalSeeds} done seed=${currentSeed} ` +
        `baseline=${oneDecision.baselineScore.toFixed(3)} candidate=${oneDecision.candidateScore.toFixed(3)} ` +
        `uplift=${oneDecision.uplift.toFixed(3)} white_priority=${oneDecision.whitePriority.toFixed(2)} pass=${oneDecision.passed} elapsed_s=${elapsedSec} total_elapsed_s=${totalElapsedSec}`
    );

    return {
        seed: currentSeed,
        baseline,
        candidate,
        decision: oneDecision
    };
}

function buildAdoptionPayload(options, perSeed, startedAt, runtime) {
    const runtimeOptions = runtime || {};
    const decisionSelector = getDecisionSelector(options);
    const selectedSeedDecisions = perSeed.map((entry) => decisionSelector(entry, options));
    const seedSchedule = buildSeedSchedule(
        options.seed,
        options.seedCount,
        options.seedStride,
        perSeed.map((entry) => entry && entry.seed)
    );
    const rawDecision = runtimeOptions.earlyStop
        ? buildEarlyStopDecision(selectedSeedDecisions, options.seedCount, options, runtimeOptions.earlyStop)
        : computeAdoptionDecisionAverage(
            selectedSeedDecisions,
            options.threshold,
            options.minSeedUplift,
            options.minSeedPassCount,
            options.confidenceLevel,
            options.minLowerBound
        );
    const decision = attachPolicyGateDecisionDiagnostics(rawDecision);
    const first = perSeed[0] || null;
    const progressEvery = Number.isFinite(options.progressEvery)
        ? Math.max(0, Math.floor(options.progressEvery))
        : 100;
    const totalElapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);
    console.log(`[policy-adoption] done total_elapsed_s=${totalElapsedSec}`);
    const benchmarkSchemaVersion = first && first.baseline ? first.baseline.schemaVersion : null;

    return {
        ...buildPolicyGatePayloadHeader({
            gateFamily: 'adoption',
            gateType: options.gatePhase || 'quality',
            benchmarkSchemaVersion
        }),
        gateFamily: 'adoption',
        gateType: options.gatePhase || 'quality',
        config: {
            games: options.games,
            seed: options.seed,
            seedCount: options.seedCount,
            seedStride: options.seedStride,
            jobs: options.jobs,
            progressEvery,
            maxPlies: options.maxPlies,
            threshold: options.threshold,
            confidenceLevel: options.confidenceLevel,
            minLowerBound: options.minLowerBound,
            minSeedUplift: options.minSeedUplift,
            minSeedPassCount: options.minSeedPassCount,
            aRate: options.aRate,
            bRate: options.bRate,
            tacticalWeight: options.tacticalWeight,
            tacticalDepthOpening: options.tacticalDepthOpening,
            tacticalDepthMid: options.tacticalDepthMid,
            tacticalDepthEnd: options.tacticalDepthEnd,
            tacticalBeamWidth: options.tacticalBeamWidth,
            policyScoreWeight: options.policyScoreWeight,
            heuristicWeight: options.heuristicWeight,
            whitePriority: options.whitePriority,
            qualityWeightCorner: options.qualityWeightCorner,
            qualityWeightEdge: options.qualityWeightEdge,
            qualityWeightCornerRecovery: options.qualityWeightCornerRecovery,
            qualityWeightCornerRecapture: options.qualityWeightCornerRecapture,
            qualityWeightEdgeRecovery: options.qualityWeightEdgeRecovery,
            qualityWeightCornerHold: options.qualityWeightCornerHold,
            qualityWeightCornerHoldTurns: options.qualityWeightCornerHoldTurns,
            qualityWeightEdgeHold: options.qualityWeightEdgeHold,
            qualityWeightEdgeChain: options.qualityWeightEdgeChain,
            qualityWeightFinalCornerShare: options.qualityWeightFinalCornerShare,
            qualityWeightFinalEdgeShare: options.qualityWeightFinalEdgeShare,
            qualityWeightFinalLongestEdgeRunShare: options.qualityWeightFinalLongestEdgeRunShare,
            qualityWeightBonus: options.qualityWeightBonus,
            qualityWeightCardImmediate: options.qualityWeightCardImmediate,
            qualityWeightCardFuture: options.qualityWeightCardFuture,
            qualityWeightPlaceDelta: options.qualityWeightPlaceDelta,
            qualityWeightCornerDonationAvoidance: options.qualityWeightCornerDonationAvoidance,
            qualityWeightOpponentSafeEdgeAvoidance: options.qualityWeightOpponentSafeEdgeAvoidance,
            qualityWeightOwnSafeEdge: options.qualityWeightOwnSafeEdge,
            qualityWeightOwnEdgeGapAvoidance: options.qualityWeightOwnEdgeGapAvoidance,
            qualityWeightOpponentEdgeCut: options.qualityWeightOpponentEdgeCut,
            baselineModelPath: options.baselineModelPath || null,
            opponentModelPath: options.opponentModelPath || null,
            candidateModelPath: options.candidateModelPath
        },
        seedSchedule,
        baseline: first ? first.baseline : null,
        candidate: first ? first.candidate : null,
        completedSeedCount: perSeed.length,
        scheduledSeedCount: options.seedCount,
        earlyStop: runtimeOptions.earlyStop || null,
        perSeed,
        decision
    };
}

async function runSeedEvaluationsSequential(options) {
    const seeds = buildSeedList(options.seed, options.seedCount, options.seedStride);
    const perSeed = [];
    const startedAt = Date.now();
    const progressEvery = Number.isFinite(options.progressEvery)
        ? Math.max(0, Math.floor(options.progressEvery))
        : 100;
    const jobPlan = buildSeedBenchmarkJobPlan(options.jobs || 1, seeds.length, os.cpus().length);
    const decisionSelector = getDecisionSelector(options);
    console.log(
        `[policy-adoption] start games=${options.games} seeds=${seeds.length} max_plies=${options.maxPlies} ` +
        `a_rate=${options.aRate} b_rate=${options.bRate} tactical_weight=${options.tacticalWeight} tactical_depth=${options.tacticalDepthOpening}/${options.tacticalDepthMid}/${options.tacticalDepthEnd} beam=${options.tacticalBeamWidth} policy_weight=${options.policyScoreWeight} heuristic_weight=${options.heuristicWeight} white_priority=${options.whitePriority} ` +
        `q_corner=${options.qualityWeightCorner} q_edge=${options.qualityWeightEdge} q_corner_recovery=${options.qualityWeightCornerRecovery} q_corner_recapture=${options.qualityWeightCornerRecapture} q_edge_recovery=${options.qualityWeightEdgeRecovery} q_corner_hold=${options.qualityWeightCornerHold} q_corner_hold_turns=${options.qualityWeightCornerHoldTurns} q_edge_hold=${options.qualityWeightEdgeHold} q_edge_chain=${options.qualityWeightEdgeChain} q_final_corner=${options.qualityWeightFinalCornerShare} q_final_edge=${options.qualityWeightFinalEdgeShare} q_final_longest_edge_run=${options.qualityWeightFinalLongestEdgeRunShare} q_corner_donation_avoid=${options.qualityWeightCornerDonationAvoidance} q_opp_safe_edge_avoid=${options.qualityWeightOpponentSafeEdgeAvoidance} q_own_safe_edge=${options.qualityWeightOwnSafeEdge} q_own_gap_avoid=${options.qualityWeightOwnEdgeGapAvoidance} q_opp_edge_cut=${options.qualityWeightOpponentEdgeCut} q_bonus=${options.qualityWeightBonus} q_card=${options.qualityWeightCardImmediate} q_card_future=${options.qualityWeightCardFuture} q_place=${options.qualityWeightPlaceDelta} ` +
        `jobs=1 total_jobs=${jobPlan.totalJobs} benchmark_jobs=${jobPlan.benchmarkJobsBySeed[0] || 1} progress_every=${progressEvery} script=${__filename}`
    );

    let earlyStop = null;
    for (let seedIndex = 0; seedIndex < seeds.length; seedIndex++) {
        const currentSeed = seeds[seedIndex];
        perSeed.push(await runOneSeed(Object.assign({}, options, {
            benchmarkJobs: jobPlan.benchmarkJobsBySeed[seedIndex] || 1
        }), seedIndex, seeds.length, currentSeed, console.log, startedAt));
        const seedDecisions = perSeed.map((entry) => decisionSelector(entry, options));
        earlyStop = evaluateEarlyFailure(seedDecisions, seeds.length, options);
        if (earlyStop) {
            logEarlyStop(earlyStop);
            break;
        }
    }

    return {
        perSeed,
        startedAt,
        earlyStop
    };
}

async function runAdoptionCheck(options) {
    const execution = await runSeedEvaluationsSequential(options);
    return buildAdoptionPayload(options, execution.perSeed, execution.startedAt, {
        earlyStop: execution.earlyStop
    });
}

function runWorkerSeedTask() {
    const payloadRaw = process.env.POLICY_ADOPTION_WORKER_TASK;
    if (!payloadRaw) throw new Error('missing POLICY_ADOPTION_WORKER_TASK');
    const task = JSON.parse(payloadRaw);
    let abortRequested = false;
    if (typeof process.on === 'function') {
        process.on('message', (msg) => {
            if (msg && msg.type === 'abort') abortRequested = true;
        });
    }
    const log = (line) => {
        if (typeof process.send === 'function') process.send({ type: 'log', line });
    };
    return withFilteredConsole(!task.options.verbose, async () => {
        try {
            const perSeed = await runOneSeed(Object.assign({}, task.options, {
                benchmarkJobs: task.benchmarkJobs,
                shouldStop: () => abortRequested
            }), task.seedIndex, task.totalSeeds, task.currentSeed, log, task.startedAt);
            if (typeof process.send === 'function') process.send({ type: 'result', perSeed });
        } catch (err) {
            if (isBenchmarkAbortError(err) || isPolicyAdoptionAbortError(err)) {
                if (typeof process.send === 'function') process.send({ type: 'aborted' });
                return;
            }
            throw err;
        }
    });
}

function startSeedInChild(task) {
    const child = fork(__filename, [], {
        env: Object.assign({}, process.env, {
            POLICY_ADOPTION_WORKER: '1',
            POLICY_ADOPTION_WORKER_TASK: JSON.stringify(task)
        }),
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });
    let done = false;
    let abortRequested = false;
    const promise = new Promise((resolve, reject) => {
        const finish = (err, value) => {
            if (done) return;
            done = true;
            if (err) reject(err);
            else resolve(value);
        };
        child.on('message', (msg) => {
            if (!msg || typeof msg !== 'object') return;
            if (msg.type === 'log' && typeof msg.line === 'string') {
                console.log(msg.line);
                return;
            }
            if (msg.type === 'aborted') {
                finish(createPolicyAdoptionAbortError('policy adoption worker aborted'));
                return;
            }
            if (msg.type === 'result' && msg.perSeed) {
                finish(null, msg.perSeed);
            }
        });
        child.once('error', (err) => finish(err));
        child.once('exit', (code, signal) => {
            if (done) return;
            if (abortRequested && code === 0) {
                finish(createPolicyAdoptionAbortError('policy adoption worker aborted'));
                return;
            }
            if (code === 0) finish(new Error('worker exited without result'));
            else finish(new Error(`worker failed code=${code} signal=${signal || 'none'}`));
        });
    });

    return {
        promise,
        abort: () => {
            if (done) return;
            abortRequested = true;
            if (child.connected) {
                try {
                    child.send({ type: 'abort' });
                    return;
                } catch (err) {
                    // Fall through to kill if IPC is already gone.
                }
            }
            if (!child.killed) {
                try {
                    child.kill();
                } catch (err) {
                    // Ignore late abort races.
                }
            }
        }
    };
}

function getPolicyAdoptionWorkerRetryLimit(options) {
    if (Number.isFinite(options && options.workerRetryLimit)) {
        return Math.max(0, Math.floor(Number(options.workerRetryLimit)));
    }
    return 1;
}

async function runSeedEvaluationsParallel(options) {
    const seeds = buildSeedList(options.seed, options.seedCount, options.seedStride);
    const perSeed = new Array(seeds.length);
    const startedAt = Date.now();
    const progressEvery = Number.isFinite(options.progressEvery)
        ? Math.max(0, Math.floor(options.progressEvery))
        : 100;
    const cpuCount = Math.max(1, os.cpus().length);
    const jobPlan = buildSeedBenchmarkJobPlan(options.jobs || 1, seeds.length, cpuCount);
    const jobs = jobPlan.seedWorkers;
    const decisionSelector = getDecisionSelector(options);
    const benchmarkJobsSummary = jobPlan.totalJobs > jobs
        ? ` benchmark_jobs=${jobPlan.benchmarkJobsBySeed.join(',')}`
        : '';
    console.log(
        `[policy-adoption] start games=${options.games} seeds=${seeds.length} max_plies=${options.maxPlies} ` +
        `a_rate=${options.aRate} b_rate=${options.bRate} tactical_weight=${options.tacticalWeight} tactical_depth=${options.tacticalDepthOpening}/${options.tacticalDepthMid}/${options.tacticalDepthEnd} beam=${options.tacticalBeamWidth} policy_weight=${options.policyScoreWeight} heuristic_weight=${options.heuristicWeight} white_priority=${options.whitePriority} ` +
        `q_corner=${options.qualityWeightCorner} q_edge=${options.qualityWeightEdge} q_corner_recovery=${options.qualityWeightCornerRecovery} q_corner_recapture=${options.qualityWeightCornerRecapture} q_edge_recovery=${options.qualityWeightEdgeRecovery} q_corner_hold=${options.qualityWeightCornerHold} q_corner_hold_turns=${options.qualityWeightCornerHoldTurns} q_edge_hold=${options.qualityWeightEdgeHold} q_edge_chain=${options.qualityWeightEdgeChain} q_final_corner=${options.qualityWeightFinalCornerShare} q_final_edge=${options.qualityWeightFinalEdgeShare} q_final_longest_edge_run=${options.qualityWeightFinalLongestEdgeRunShare} q_corner_donation_avoid=${options.qualityWeightCornerDonationAvoidance} q_opp_safe_edge_avoid=${options.qualityWeightOpponentSafeEdgeAvoidance} q_own_safe_edge=${options.qualityWeightOwnSafeEdge} q_own_gap_avoid=${options.qualityWeightOwnEdgeGapAvoidance} q_opp_edge_cut=${options.qualityWeightOpponentEdgeCut} q_bonus=${options.qualityWeightBonus} q_card=${options.qualityWeightCardImmediate} q_card_future=${options.qualityWeightCardFuture} q_place=${options.qualityWeightPlaceDelta} ` +
        `jobs=${jobs} total_jobs=${jobPlan.totalJobs}${benchmarkJobsSummary} progress_every=${progressEvery} script=${__filename}`
    );

    let cursor = 0;
    let earlyStop = null;
    const activeWorkers = new Map();
    const abortActiveWorkers = () => {
        for (const controller of activeWorkers.values()) controller.abort();
    };
    const launchNext = async () => {
        while (true) {
            if (earlyStop) return;
            const i = cursor;
            if (i >= seeds.length) return;
            cursor += 1;
            const currentSeed = seeds[i];
            const task = {
                options,
                seedIndex: i,
                totalSeeds: seeds.length,
                currentSeed,
                benchmarkJobs: jobPlan.benchmarkJobsBySeed[i] || 1,
                startedAt
            };
            const retryLimit = getPolicyAdoptionWorkerRetryLimit(options);
            let attempt = 0;
            try {
                while (true) {
                    const controller = startSeedInChild(task);
                    activeWorkers.set(i, controller);
                    try {
                        perSeed[i] = await controller.promise;
                        activeWorkers.delete(i);
                        break;
                    } catch (err) {
                        activeWorkers.delete(i);
                        if (isPolicyAdoptionAbortError(err)) throw err;
                        if (attempt >= retryLimit) throw err;
                        attempt += 1;
                        const message = err && err.message ? err.message : String(err);
                        console.warn(
                            `[policy-adoption] seed retry ${attempt}/${retryLimit} seed=${currentSeed}: ${message}`
                        );
                    }
                }
                const seedDecisions = perSeed
                    .filter(Boolean)
                    .map((entry) => decisionSelector(entry, options));
                earlyStop = evaluateEarlyFailure(seedDecisions, seeds.length, options);
                if (earlyStop) {
                    logEarlyStop(earlyStop);
                    abortActiveWorkers();
                    return;
                }
            } catch (err) {
                activeWorkers.delete(i);
                if (isPolicyAdoptionAbortError(err) && earlyStop) return;
                throw err;
            }
        }
    };

    const workers = [];
    for (let i = 0; i < jobs; i++) workers.push(launchNext());
    await Promise.all(workers);
    return {
        perSeed: perSeed.filter(Boolean),
        startedAt,
        earlyStop
    };
}

async function runSeedEvaluations(options) {
    if ((options.jobs || 1) <= 1 || (options.seedCount || 1) <= 1) {
        return runSeedEvaluationsSequential(options);
    }
    return runSeedEvaluationsParallel(options);
}

async function runAdoptionCheckParallel(options) {
    const execution = await runSeedEvaluationsParallel(options);
    return buildAdoptionPayload(options, execution.perSeed, execution.startedAt, {
        earlyStop: execution.earlyStop
    });
}

async function main() {
    if (process.env.POLICY_ADOPTION_WORKER === '1') {
        await runWorkerSeedTask();
        return;
    }
    const args = parseArgs(process.argv.slice(2));
    if (args.help) { printHelp(); return; }

    const result = await withFilteredConsole(!args.verbose, async () => {
        if ((args.jobs || 1) <= 1 || (args.seedCount || 1) <= 1) return await runAdoptionCheck(args);
        return runAdoptionCheckParallel(args);
    });
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(result, null, 2), 'utf8');
        console.log(`[policy-adoption] wrote: ${args.out}`);
    }
    const d = result.decision;
    console.log(
        `[policy-adoption] baseline=${d.baselineScore.toFixed(3)} candidate=${d.candidateScore.toFixed(3)} uplift=${d.uplift.toFixed(3)} uplift_lb=${d.upliftLowerBound.toFixed(3)} lb_req=${d.requiredMinLowerBound.toFixed(3)} conf=${d.confidenceLevel.toFixed(3)} min_seed_uplift=${d.minSeedUplift.toFixed(3)} threshold=${d.threshold.toFixed(3)} ` +
        `seeds=${d.seedCount || 1} seed_pass=${d.seedPassCount || 0}/${d.seedCount || 0} min_seed_req=${d.requiredMinSeedPassCount || 0} tactical_weight=${args.tacticalWeight.toFixed(2)} tactical_depth=${args.tacticalDepthOpening}/${args.tacticalDepthMid}/${args.tacticalDepthEnd} beam=${args.tacticalBeamWidth} ` +
        `policy_weight=${args.policyScoreWeight.toFixed(2)} heuristic_weight=${args.heuristicWeight.toFixed(2)} white_priority=${args.whitePriority.toFixed(2)} q_corner=${args.qualityWeightCorner.toFixed(3)} q_edge=${args.qualityWeightEdge.toFixed(3)} q_corner_recovery=${args.qualityWeightCornerRecovery.toFixed(3)} q_corner_recapture=${args.qualityWeightCornerRecapture.toFixed(3)} q_edge_recovery=${args.qualityWeightEdgeRecovery.toFixed(3)} ` +
        `q_corner_hold=${args.qualityWeightCornerHold.toFixed(3)} q_corner_hold_turns=${args.qualityWeightCornerHoldTurns.toFixed(3)} q_edge_hold=${args.qualityWeightEdgeHold.toFixed(3)} q_edge_chain=${args.qualityWeightEdgeChain.toFixed(3)} q_final_corner=${args.qualityWeightFinalCornerShare.toFixed(3)} q_final_edge=${args.qualityWeightFinalEdgeShare.toFixed(3)} q_final_longest_edge_run=${args.qualityWeightFinalLongestEdgeRunShare.toFixed(3)} q_corner_donation_avoid=${args.qualityWeightCornerDonationAvoidance.toFixed(3)} q_opp_safe_edge_avoid=${args.qualityWeightOpponentSafeEdgeAvoidance.toFixed(3)} q_own_safe_edge=${args.qualityWeightOwnSafeEdge.toFixed(3)} q_own_gap_avoid=${args.qualityWeightOwnEdgeGapAvoidance.toFixed(3)} q_opp_edge_cut=${args.qualityWeightOpponentEdgeCut.toFixed(3)} q_bonus=${args.qualityWeightBonus.toFixed(3)} q_card=${args.qualityWeightCardImmediate.toFixed(3)} q_card_future=${args.qualityWeightCardFuture.toFixed(3)} q_place=${args.qualityWeightPlaceDelta.toFixed(3)} early_stop=${d.earlyStopReason || 'none'} failure_reason=${d.primaryFailureReason || 'none'} pass=${d.passed}`
    );
    process.exit(d.passed ? 0 : 2);
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[policy-adoption] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}

export = {
    parseArgs,
    computeAdoptionDecision,
    computeAdoptionDecisionAverage,
    buildAdoptionPayload,
    buildEarlyStopDecision,
    buildSeedList,
    buildSeedBenchmarkJobPlan,
    evaluateEarlyFailure,
    getPolicyAdoptionWorkerRetryLimit,
    runSeedEvaluations,
    runAdoptionCheck,
    runAdoptionCheckParallel
};
