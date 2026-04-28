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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const benchmark_policy_adoption_1 = require("./benchmark-policy-adoption");
const benchmark_policy_quality_gate_1 = __importDefault(require("./benchmark-policy-quality-gate"));
const { runQualityGate } = benchmark_policy_quality_gate_1.default;
const policy_seed_utils_1 = __importDefault(require("./policy-seed-utils"));
const { buildSeedSchedule } = policy_seed_utils_1.default;
const seed_bank_manager_1 = __importDefault(require("./seed-bank-manager"));
const { loadSeedBank, resolveSeedScheduleFromBank } = seed_bank_manager_1.default;
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const SUPPORTED_REPLAY_GATE_TYPES = Object.freeze(['quick', 'quality', 'final']);
function normalizeGateType(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return SUPPORTED_REPLAY_GATE_TYPES.includes(normalized) ? normalized : null;
}
function parseArgs(argv) {
    const args = {
        gatePayloadPath: null,
        gateType: null,
        seedBankPath: null,
        candidateModelPath: null,
        baselineModelPath: null,
        opponentModelPath: null,
        out: null,
        verbose: false,
        help: false
    };
    for (let index = 0; index < argv.length; index += 1) {
        const token = String(argv[index] || '').trim();
        if (!token)
            continue;
        if (token === '--help' || token === '-h') {
            args.help = true;
            continue;
        }
        if (token === '--gate-payload') {
            args.gatePayloadPath = path.resolve(process.cwd(), argv[++index]);
            continue;
        }
        if (token === '--gate-type') {
            args.gateType = normalizeGateType(argv[++index]);
            continue;
        }
        if (token === '--seed-bank') {
            args.seedBankPath = path.resolve(process.cwd(), argv[++index]);
            continue;
        }
        if (token === '--candidate-model') {
            args.candidateModelPath = path.resolve(process.cwd(), argv[++index]);
            continue;
        }
        if (token === '--baseline-model') {
            args.baselineModelPath = path.resolve(process.cwd(), argv[++index]);
            continue;
        }
        if (token === '--opponent-model') {
            args.opponentModelPath = path.resolve(process.cwd(), argv[++index]);
            continue;
        }
        if (token === '--out' || token === '-o') {
            args.out = path.resolve(process.cwd(), argv[++index]);
            continue;
        }
        if (token === '--verbose') {
            args.verbose = true;
            continue;
        }
        throw new Error(`unknown argument: ${token}`);
    }
    if (args.help)
        return args;
    if (!args.gatePayloadPath)
        throw new Error('--gate-payload is required');
    return args;
}
function printHelp() {
    console.log([
        'Usage:',
        '  node scripts/replay-adoption-gate.js --gate-payload <path> [options]',
        '',
        'Options:',
        '      --gate-payload <path>    Existing quick/quality/final gate payload JSON (required)',
        '      --gate-type <name>       Replay gate type override: quick | quality | final',
        '      --seed-bank <path>       Optional seed_bank.v1 override',
        '      --candidate-model <path> Override candidate policy-table path',
        '      --baseline-model <path>  Override baseline policy-table path',
        '      --opponent-model <path>  Override shared opponent policy-table path',
        '  -o, --out <path>             Optional replay payload output path',
        '      --verbose                Keep benchmark logs',
        '  -h, --help                   Show this help'
    ].join('\n'));
}
function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function cloneValue(value) {
    return JSON.parse(JSON.stringify(value));
}
function inferReplayGateType(payload, overrideGateType, gatePayloadPath) {
    const normalizedOverride = normalizeGateType(overrideGateType);
    if (normalizedOverride)
        return normalizedOverride;
    const payloadGateType = normalizeGateType(payload && payload.gateType);
    if (payloadGateType)
        return payloadGateType;
    const fileName = path.basename(String(gatePayloadPath || '')).toLowerCase();
    if (fileName.includes('.quick.') || fileName.includes('quick'))
        return 'quick';
    if (fileName.includes('.quality.') || fileName.includes('quality'))
        return 'quality';
    if (fileName.includes('.final.') || fileName.includes('final'))
        return 'final';
    throw new Error('unable to infer replay gate type; use --gate-type');
}
function resolveReplaySeedSchedule(payload, gateType, seedBankPath) {
    if (seedBankPath) {
        const bank = loadSeedBank(seedBankPath);
        return resolveSeedScheduleFromBank(bank, gateType);
    }
    const payloadSeedSchedule = payload && payload.seedSchedule && typeof payload.seedSchedule === 'object'
        ? payload.seedSchedule
        : {};
    const config = payload && payload.config && typeof payload.config === 'object'
        ? payload.config
        : {};
    const schedule = buildSeedSchedule(Number.isFinite(Number(payloadSeedSchedule.baseSeed)) ? Number(payloadSeedSchedule.baseSeed) : config.seed, Number.isFinite(Number(payloadSeedSchedule.seedCount)) ? Number(payloadSeedSchedule.seedCount) : config.seedCount, Number.isFinite(Number(payloadSeedSchedule.seedStride)) ? Number(payloadSeedSchedule.seedStride) : config.seedStride, payloadSeedSchedule.completedSeeds);
    return Object.assign({
        gateType
    }, schedule, {
        scheduledSeeds: Array.isArray(payloadSeedSchedule.scheduledSeeds) && payloadSeedSchedule.scheduledSeeds.length > 0
            ? payloadSeedSchedule.scheduledSeeds.slice()
            : schedule.scheduledSeeds
    });
}
function buildReplayOptions(payload, args) {
    const gateType = inferReplayGateType(payload, args && args.gateType, args && args.gatePayloadPath);
    const config = payload && payload.config && typeof payload.config === 'object'
        ? payload.config
        : {};
    const qualityWeights = config.qualityWeights && typeof config.qualityWeights === 'object'
        ? config.qualityWeights
        : {};
    const seedSchedule = resolveReplaySeedSchedule(payload, gateType, args && args.seedBankPath);
    const options = {
        games: config.games,
        seed: seedSchedule.baseSeed,
        seedCount: seedSchedule.seedCount,
        seedStride: seedSchedule.seedStride,
        jobs: config.jobs,
        progressEvery: config.progressEvery,
        maxPlies: config.maxPlies,
        threshold: config.threshold,
        confidenceLevel: config.confidenceLevel,
        minLowerBound: config.minLowerBound,
        minSeedUplift: config.minSeedUplift,
        minSeedPassCount: config.minSeedPassCount,
        aRate: config.aRate,
        bRate: config.bRate,
        tacticalWeight: config.tacticalWeight,
        tacticalDepthOpening: config.tacticalDepthOpening,
        tacticalDepthMid: config.tacticalDepthMid,
        tacticalDepthEnd: config.tacticalDepthEnd,
        tacticalBeamWidth: config.tacticalBeamWidth,
        policyScoreWeight: config.policyScoreWeight,
        heuristicWeight: config.heuristicWeight,
        whitePriority: config.whitePriority,
        qualityGateStrengthFirst: !!config.qualityGateStrengthFirst,
        qualityWeightCorner: config.qualityWeightCorner ?? qualityWeights.qualityWeightCorner ?? 0,
        qualityWeightEdge: config.qualityWeightEdge ?? qualityWeights.qualityWeightEdge ?? 0,
        qualityWeightCornerRecovery: config.qualityWeightCornerRecovery ?? qualityWeights.qualityWeightCornerRecovery ?? 0,
        qualityWeightCornerRecapture: config.qualityWeightCornerRecapture ?? qualityWeights.qualityWeightCornerRecapture ?? 0,
        qualityWeightEdgeRecovery: config.qualityWeightEdgeRecovery ?? qualityWeights.qualityWeightEdgeRecovery ?? 0,
        qualityWeightCornerHold: config.qualityWeightCornerHold ?? qualityWeights.qualityWeightCornerHold ?? 0,
        qualityWeightCornerHoldTurns: config.qualityWeightCornerHoldTurns ?? qualityWeights.qualityWeightCornerHoldTurns ?? 0,
        qualityWeightEdgeHold: config.qualityWeightEdgeHold ?? qualityWeights.qualityWeightEdgeHold ?? 0,
        qualityWeightEdgeChain: config.qualityWeightEdgeChain ?? qualityWeights.qualityWeightEdgeChain ?? 0,
        qualityWeightFinalCornerShare: config.qualityWeightFinalCornerShare ?? qualityWeights.qualityWeightFinalCornerShare ?? 0,
        qualityWeightFinalEdgeShare: config.qualityWeightFinalEdgeShare ?? qualityWeights.qualityWeightFinalEdgeShare ?? 0,
        qualityWeightFinalLongestEdgeRunShare: config.qualityWeightFinalLongestEdgeRunShare ?? qualityWeights.qualityWeightFinalLongestEdgeRunShare ?? 0,
        qualityWeightBonus: config.qualityWeightBonus ?? qualityWeights.qualityWeightBonus ?? 0,
        qualityWeightCardImmediate: config.qualityWeightCardImmediate ?? qualityWeights.qualityWeightCardImmediate ?? 0,
        qualityWeightCardFuture: config.qualityWeightCardFuture ?? qualityWeights.qualityWeightCardFuture ?? 0,
        qualityWeightPlaceDelta: config.qualityWeightPlaceDelta ?? qualityWeights.qualityWeightPlaceDelta ?? 0,
        baselineModelPath: args && args.baselineModelPath ? args.baselineModelPath : (config.baselineModelPath || null),
        opponentModelPath: args && args.opponentModelPath ? args.opponentModelPath : (config.opponentModelPath || null),
        candidateModelPath: args && args.candidateModelPath ? args.candidateModelPath : (config.candidateModelPath || null),
        gatePhase: gateType,
        verbose: !!(args && args.verbose)
    };
    if (!options.candidateModelPath) {
        throw new Error('replay requires a candidate model path from payload or --candidate-model');
    }
    return {
        gateType,
        seedSchedule,
        options
    };
}
async function replayGate(args, dependencies) {
    const deps = Object.assign({
        runAdoptionCheck: benchmark_policy_adoption_1.runAdoptionCheck,
        runQualityGate
    }, dependencies || {});
    const sourcePayload = readJson(args.gatePayloadPath);
    const replayConfig = buildReplayOptions(sourcePayload, args);
    const runner = replayConfig.gateType === 'quality'
        ? deps.runQualityGate
        : deps.runAdoptionCheck;
    const result = await runner(replayConfig.options);
    result.replay = {
        replayedAt: new Date().toISOString(),
        sourceGatePayloadPath: args.gatePayloadPath,
        sourceGateType: replayConfig.gateType,
        sourceGeneratedAt: sourcePayload && sourcePayload.generatedAt ? sourcePayload.generatedAt : null,
        seedBankPath: args.seedBankPath || null,
        seedSchedule: cloneValue(replayConfig.seedSchedule)
    };
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, JSON.stringify(result, null, 2), 'utf8');
    }
    return result;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        printHelp();
        return;
    }
    const result = await replayGate(args);
    if (args.out) {
        console.log(`[replay-adoption-gate] wrote: ${args.out}`);
    }
    const decision = result && result.decision ? result.decision : null;
    console.log(`[replay-adoption-gate] gate=${result && result.replay ? result.replay.sourceGateType : 'unknown'} ` +
        `pass=${decision && decision.passed === true} failure_reason=${decision && decision.primaryFailureReason ? decision.primaryFailureReason : 'none'}`);
}
if (require.main === module) {
    main().catch((error) => {
        console.error('[replay-adoption-gate] failed:', error && error.message ? error.message : error);
        process.exit(1);
    });
}
module.exports = {
    parseArgs,
    inferReplayGateType,
    buildReplayOptions,
    replayGate
};
//# sourceMappingURL=replay-adoption-gate.js.map