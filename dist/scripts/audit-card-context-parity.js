"use strict";
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
// @ts-nocheck
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const Module = __importStar(require("module"));
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const FIELD_NAMES = [
    'deckRemaining',
    'cloneSplitEligibleSourceCount',
    'sacrificeSelectedCount',
    'handCardIds',
    'usableCardIds',
    'ownEdges',
    'oppEdges',
    'maxLegalBoardBonus'
];
function parseAuditArgs(argv) {
    const options = {
        games: 5,
        seed: 1,
        maxPlies: 160,
        allowCardUsage: true,
        cardUsageRate: 0.35,
        types: null,
        out: null,
        help: false
    };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--help' || arg === '-h') {
            options.help = true;
            continue;
        }
        if (arg === '--games') {
            options.games = Math.max(1, Number(argv[++i] || options.games));
            continue;
        }
        if (arg === '--seed') {
            options.seed = Number(argv[++i] || options.seed);
            continue;
        }
        if (arg === '--max-plies') {
            options.maxPlies = Math.max(1, Number(argv[++i] || options.maxPlies));
            continue;
        }
        if (arg === '--card-usage-rate') {
            options.cardUsageRate = Number(argv[++i] || options.cardUsageRate);
            continue;
        }
        if (arg === '--allow-card-usage') {
            options.allowCardUsage = true;
            continue;
        }
        if (arg === '--no-card-usage') {
            options.allowCardUsage = false;
            continue;
        }
        if (arg === '--types') {
            const raw = String(argv[++i] || '');
            const values = raw.split(',').map((one) => String(one || '').trim()).filter((one) => one.length > 0);
            options.types = values.length > 0 ? Array.from(new Set(values)) : null;
            continue;
        }
        if (arg === '--type') {
            const value = String(argv[++i] || '').trim();
            if (!value)
                continue;
            options.types = Array.isArray(options.types) ? options.types.slice() : [];
            if (!options.types.includes(value))
                options.types.push(value);
            continue;
        }
        if (arg === '--out') {
            options.out = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
    }
    return options;
}
function loadSelfplayRunnerInternals(rootDir) {
    const runnerFile = path.join(rootDir, 'src', 'engine', 'selfplay-runner.js');
    let code = fs.readFileSync(runnerFile, 'utf8');
    code += '\nmodule.exports.__cardContextParityInternal = { createInitialState, applyDecisionWithRetry, normalizeOptions, buildCardDecisionContext, getDirectUsableCardIds };';
    const loaded = new Module(runnerFile, module);
    loaded.filename = runnerFile;
    loaded.paths = Module._nodeModulePaths(path.dirname(runnerFile));
    loaded._compile(code, runnerFile);
    return {
        runner: loaded.exports,
        internal: loaded.exports.__cardContextParityInternal
    };
}
function sameFieldValue(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
}
function compareContexts(liveContext, selfplayContext, fieldNames = FIELD_NAMES) {
    const diff = {};
    for (const fieldName of fieldNames) {
        const liveValue = liveContext ? liveContext[fieldName] : undefined;
        const selfplayValue = selfplayContext ? selfplayContext[fieldName] : undefined;
        if (!sameFieldValue(liveValue, selfplayValue)) {
            const one = {};
            if (liveValue !== undefined)
                one.live = liveValue;
            if (selfplayValue !== undefined)
                one.selfplay = selfplayValue;
            diff[fieldName] = one;
        }
    }
    return diff;
}
function createTypeBucket() {
    return {
        count: 0,
        contextMismatchCount: 0,
        scoreMismatchCount: 0,
        useDiffCount: 0,
        retentionDiffCount: 0,
        maxUseDiff: 0,
        maxRetentionDiff: 0,
        ctxDiffFieldCounts: Object.create(null),
        sample: null
    };
}
function createAuditReport(config) {
    return {
        config: Object.assign({}, config),
        auditedTurns: 0,
        totalCardComparisons: 0,
        byType: Object.create(null),
        examples: []
    };
}
function pickSample(current, candidate) {
    if (!current)
        return candidate;
    const currentMagnitude = Math.max(Math.abs(current.useDiff || 0), Math.abs(current.retentionDiff || 0));
    const nextMagnitude = Math.max(Math.abs(candidate.useDiff || 0), Math.abs(candidate.retentionDiff || 0));
    if (nextMagnitude > currentMagnitude)
        return candidate;
    if (nextMagnitude < currentMagnitude)
        return current;
    const currentCtxFields = current.ctxDiff ? Object.keys(current.ctxDiff).length : 0;
    const nextCtxFields = candidate.ctxDiff ? Object.keys(candidate.ctxDiff).length : 0;
    return nextCtxFields > currentCtxFields ? candidate : current;
}
function recordComparison(report, comparison) {
    if (!report || !comparison)
        return;
    const type = String(comparison.type || comparison.cardId || 'unknown');
    if (!report.byType[type])
        report.byType[type] = createTypeBucket();
    const bucket = report.byType[type];
    const ctxFields = Object.keys(comparison.ctxDiff || {});
    const hasContextMismatch = ctxFields.length > 0;
    const hasUseDiff = comparison.useDiff !== 0;
    const hasRetentionDiff = comparison.retentionDiff !== 0;
    const hasScoreMismatch = hasUseDiff || hasRetentionDiff;
    report.totalCardComparisons += 1;
    bucket.count += 1;
    if (hasContextMismatch) {
        bucket.contextMismatchCount += 1;
        for (const fieldName of ctxFields) {
            bucket.ctxDiffFieldCounts[fieldName] = (bucket.ctxDiffFieldCounts[fieldName] || 0) + 1;
        }
    }
    if (hasScoreMismatch)
        bucket.scoreMismatchCount += 1;
    if (hasUseDiff)
        bucket.useDiffCount += 1;
    if (hasRetentionDiff)
        bucket.retentionDiffCount += 1;
    if (Math.abs(comparison.useDiff) > Math.abs(bucket.maxUseDiff))
        bucket.maxUseDiff = comparison.useDiff;
    if (Math.abs(comparison.retentionDiff) > Math.abs(bucket.maxRetentionDiff))
        bucket.maxRetentionDiff = comparison.retentionDiff;
    if (hasContextMismatch || hasScoreMismatch) {
        const sample = {
            seed: comparison.seed,
            ply: comparison.ply,
            playerKey: comparison.playerKey,
            cardId: comparison.cardId,
            useDiff: comparison.useDiff,
            retentionDiff: comparison.retentionDiff,
            ctxDiff: comparison.ctxDiff
        };
        bucket.sample = pickSample(bucket.sample, sample);
    }
    if (hasScoreMismatch && report.examples.length < 30) {
        report.examples.push({
            seed: comparison.seed,
            ply: comparison.ply,
            playerKey: comparison.playerKey,
            cardId: comparison.cardId,
            type,
            useDiff: comparison.useDiff,
            retentionDiff: comparison.retentionDiff,
            ctxDiff: comparison.ctxDiff,
            liveDecision: comparison.liveDecision,
            selfplayDecision: comparison.selfplayDecision,
            liveRetention: comparison.liveRetention,
            selfplayRetention: comparison.selfplayRetention
        });
    }
}
function finalizeAuditReport(report) {
    const summary = Object.entries(report.byType)
        .map(([type, bucket]) => ({
        type,
        count: bucket.count,
        contextMismatchCount: bucket.contextMismatchCount,
        scoreMismatchCount: bucket.scoreMismatchCount,
        useDiffCount: bucket.useDiffCount,
        retentionDiffCount: bucket.retentionDiffCount,
        maxUseDiff: bucket.maxUseDiff,
        maxRetentionDiff: bucket.maxRetentionDiff,
        ctxDiffFieldCounts: bucket.ctxDiffFieldCounts,
        sample: bucket.sample
    }))
        .sort((left, right) => {
        const leftMagnitude = Math.max(Math.abs(left.maxUseDiff), Math.abs(left.maxRetentionDiff));
        const rightMagnitude = Math.max(Math.abs(right.maxUseDiff), Math.abs(right.maxRetentionDiff));
        if (rightMagnitude !== leftMagnitude)
            return rightMagnitude - leftMagnitude;
        if (right.scoreMismatchCount !== left.scoreMismatchCount)
            return right.scoreMismatchCount - left.scoreMismatchCount;
        if (right.contextMismatchCount !== left.contextMismatchCount)
            return right.contextMismatchCount - left.contextMismatchCount;
        return right.count - left.count;
    });
    const examples = report.examples.slice().sort((left, right) => {
        const leftMagnitude = Math.max(Math.abs(left.useDiff), Math.abs(left.retentionDiff));
        const rightMagnitude = Math.max(Math.abs(right.useDiff), Math.abs(right.retentionDiff));
        return rightMagnitude - leftMagnitude;
    });
    return {
        config: report.config,
        auditedTurns: report.auditedTurns,
        totalCardComparisons: report.totalCardComparisons,
        summary,
        examples
    };
}
function toRoundedDiff(value) {
    return Number(Number(value || 0).toFixed(4));
}
function shouldAuditType(type, filterTypes) {
    if (!Array.isArray(filterTypes) || filterTypes.length === 0)
        return true;
    return filterTypes.includes(type);
}
async function runCardContextParityAudit(options) {
    const rootDir = process.cwd();
    const Core = require(path.join(rootDir, 'game', 'logic', 'core.js'));
    const CardLogic = require(path.join(rootDir, 'game', 'logic', 'cards.js'));
    const CpuPolicyCore = require(path.join(rootDir, 'game', 'ai', 'cpu-policy-core.js'));
    const CpuDecision = require(path.join(rootDir, 'game', 'cpu-decision.js'));
    const loadedRunner = loadSelfplayRunnerInternals(rootDir);
    const runner = loadedRunner.runner;
    const internal = loadedRunner.internal;
    const normalizedOptions = internal.normalizeOptions({
        maxPlies: options.maxPlies,
        allowCardUsage: options.allowCardUsage,
        cardUsageRate: options.cardUsageRate
    });
    const report = createAuditReport({
        games: options.games,
        seed: options.seed,
        maxPlies: normalizedOptions.maxPlies,
        allowCardUsage: normalizedOptions.allowCardUsage,
        cardUsageRate: normalizedOptions.cardUsageRate,
        types: Array.isArray(options.types) ? options.types.slice() : null,
        fields: FIELD_NAMES.slice()
    });
    for (let gameIndex = 0; gameIndex < options.games; gameIndex += 1) {
        const seed = options.seed + gameIndex;
        const state = internal.createInitialState(seed);
        const actionCounterRef = { value: 0 };
        for (let ply = 0; ply < normalizedOptions.maxPlies; ply += 1) {
            if (Core.isGameOver(state.gameState))
                break;
            const playerKey = state.gameState.currentPlayer === Core.BLACK ? 'black' : 'white';
            const execution = internal.applyDecisionWithRetry(state, gameIndex, ply, playerKey, runner.getPolicyForPlayer(normalizedOptions, playerKey), actionCounterRef);
            const legalMoves = execution.decision && Array.isArray(execution.decision.legalMoves)
                ? execution.decision.legalMoves
                : [];
            const usableCardIds = internal.getDirectUsableCardIds(state.cardState, state.gameState, playerKey);
            if (usableCardIds.length > 0) {
                report.auditedTurns += 1;
                global.gameState = state.gameState;
                global.cardState = state.cardState;
                global.BLACK = Core.BLACK;
                global.WHITE = Core.WHITE;
                const liveContext = CpuDecision.buildCardUseDecisionContext(playerKey, 6, legalMoves.length, legalMoves, usableCardIds);
                const selfplayContext = internal.buildCardDecisionContext(state.gameState, state.cardState, playerKey, legalMoves.length, legalMoves, usableCardIds);
                for (const cardId of usableCardIds) {
                    const cardDef = CardLogic.getCardDef(cardId) || null;
                    const type = cardDef && typeof cardDef.type === 'string' ? cardDef.type : cardId;
                    if (!shouldAuditType(type, options.types))
                        continue;
                    const liveDecision = CpuPolicyCore.scoreCardUseDecision(cardId, CardLogic.getCardCost, CardLogic.getCardDef, liveContext);
                    const selfplayDecision = CpuPolicyCore.scoreCardUseDecision(cardId, CardLogic.getCardCost, CardLogic.getCardDef, selfplayContext);
                    const liveRetention = CpuPolicyCore.scoreCardRetentionForSell(cardId, CardLogic.getCardCost, CardLogic.getCardDef, liveContext);
                    const selfplayRetention = CpuPolicyCore.scoreCardRetentionForSell(cardId, CardLogic.getCardCost, CardLogic.getCardDef, selfplayContext);
                    recordComparison(report, {
                        seed,
                        ply,
                        playerKey,
                        cardId,
                        type,
                        useDiff: toRoundedDiff(selfplayDecision.score - liveDecision.score),
                        retentionDiff: toRoundedDiff(selfplayRetention.score - liveRetention.score),
                        ctxDiff: compareContexts(liveContext, selfplayContext),
                        liveDecision,
                        selfplayDecision,
                        liveRetention,
                        selfplayRetention
                    });
                }
            }
            state.cardState = execution.result.cardState;
            state.gameState = execution.result.gameState;
            state.stateVersion = execution.result.nextStateVersion;
        }
    }
    return finalizeAuditReport(report);
}
function printHelp() {
    console.log('Usage:');
    console.log('  node scripts/audit-card-context-parity.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --games <n>             Number of simulated seed starts (default: 5)');
    console.log('  --seed <n>              Starting seed (default: 1)');
    console.log('  --max-plies <n>         Max plies per game (default: 160)');
    console.log('  --card-usage-rate <n>   Card usage rate for selfplay simulation (default: 0.35)');
    console.log('  --allow-card-usage      Enable card usage (default)');
    console.log('  --no-card-usage         Disable card usage');
    console.log('  --types <a,b,c>         Limit audit to card types');
    console.log('  --type <type>           Add one card type filter');
    console.log('  --out <path>            Write JSON payload');
}
async function main() {
    const options = parseAuditArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }
    const startedAt = Date.now();
    const audit = await runCardContextParityAudit(options);
    const payload = {
        generatedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startedAt,
        schemaVersion: 'card-context-parity.v1',
        audit
    };
    if (options.out) {
        fs.writeFileSync(options.out, JSON.stringify(payload, null, 2));
    }
    console.log(JSON.stringify(payload, null, 2));
}
if (require.main === module) {
    main().catch((error) => {
        console.error('[audit-card-context-parity] failed:', error && error.stack ? error.stack : error);
        process.exitCode = 1;
    });
}
module.exports = {
    FIELD_NAMES,
    parseAuditArgs,
    compareContexts,
    createTypeBucket,
    createAuditReport,
    recordComparison,
    finalizeAuditReport,
    runCardContextParityAudit
};
//# sourceMappingURL=audit-card-context-parity.js.map