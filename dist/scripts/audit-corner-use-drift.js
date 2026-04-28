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
const benchmark_selfplay_policy_1 = require("./benchmark-selfplay-policy");
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function parseAuditArgs(argv) {
    const benchmarkArgv = [];
    let auditOut = null;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--audit-out') {
            auditOut = path.resolve(process.cwd(), argv[++i]);
            continue;
        }
        benchmarkArgv.push(arg);
    }
    return {
        benchmarkOptions: (0, benchmark_selfplay_policy_1.parseArgs)(benchmarkArgv),
        auditOut
    };
}
function createBreakdownBucket() {
    return {
        cornerOpportunityPlaceTurns: 0,
        cornerTakenPlaceTurns: 0,
        cornerMissPlaceTurns: 0
    };
}
function bumpBreakdown(map, rawKey, taken) {
    const key = rawKey === null || rawKey === undefined || rawKey === '' ? 'unknown' : String(rawKey);
    if (!map[key])
        map[key] = createBreakdownBucket();
    map[key].cornerOpportunityPlaceTurns += 1;
    if (taken)
        map[key].cornerTakenPlaceTurns += 1;
    else
        map[key].cornerMissPlaceTurns += 1;
}
function createCornerUseDriftAudit() {
    return {
        cornerOpportunityPlaceTurns: 0,
        cornerTakenPlaceTurns: 0,
        cornerMissPlaceTurns: 0,
        cornerOpportunityAfterPrecedingOwnCardUse: 0,
        cornerTakenAfterPrecedingOwnCardUse: 0,
        cornerMissAfterPrecedingOwnCardUse: 0,
        cornerOpportunityAfterSameTurnCardUse: 0,
        cornerTakenAfterSameTurnCardUse: 0,
        cornerMissAfterSameTurnCardUse: 0,
        byPrecedingUseCardType: Object.create(null),
        byPrecedingUseReasonTag: Object.create(null),
        byPrecedingUseHandSize: Object.create(null),
        byPrecedingUseMinUseScore: Object.create(null)
    };
}
function createCornerUseDriftStreamState() {
    return {
        currentGameIndex: null,
        currentSeed: null,
        lastPly: -1,
        lastActionByPlayer: {
            black: null,
            white: null
        }
    };
}
function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}
function normalizeMinUseScoreKey(value) {
    return Number.isFinite(Number(value)) ? String(Number(value)) : 'null';
}
function isCornerMove(row, col, size) {
    return ((row === 0 && col === 0) ||
        (row === 0 && col === (size - 1)) ||
        (row === (size - 1) && col === 0) ||
        (row === (size - 1) && col === (size - 1)));
}
function selectedUseCandidate(rec) {
    if (!rec || !Array.isArray(rec.decisionCandidates))
        return null;
    const useCardId = typeof rec.useCardId === 'string' ? rec.useCardId : null;
    for (const candidate of rec.decisionCandidates) {
        if (!candidate || candidate.decisionKind !== 'use')
            continue;
        if (candidate.isSelected === true)
            return candidate;
    }
    if (!useCardId)
        return null;
    for (const candidate of rec.decisionCandidates) {
        if (!candidate || candidate.decisionKind !== 'use')
            continue;
        if (candidate.cardId === useCardId)
            return candidate;
    }
    return null;
}
function buildActionSnapshot(rec) {
    const player = rec && (rec.player === 'black' || rec.player === 'white') ? rec.player : null;
    if (!player)
        return null;
    const selectedCandidate = rec.actionType === 'use_card' ? selectedUseCandidate(rec) : null;
    return {
        player,
        actionType: rec.actionType || null,
        turnNumber: Number.isFinite(Number(rec.turnNumber)) ? Number(rec.turnNumber) : null,
        useCardType: selectedCandidate && selectedCandidate.cardType ? String(selectedCandidate.cardType) : null,
        reasonTags: Array.isArray(rec.decisionReasonTags) ? rec.decisionReasonTags.map((tag) => String(tag)) : [],
        handSize: rec.decisionScoreSummary && Number.isFinite(Number(rec.decisionScoreSummary.handSize))
            ? Number(rec.decisionScoreSummary.handSize)
            : (Array.isArray(rec.handCards) ? rec.handCards.length : null),
        minUseScore: rec.decisionScoreSummary && Number.isFinite(Number(rec.decisionScoreSummary.minUseScore))
            ? Number(rec.decisionScoreSummary.minUseScore)
            : null
    };
}
function isNewGame(state, rec) {
    const ply = Number.isFinite(Number(rec && rec.ply)) ? Number(rec.ply) : -1;
    if (state.currentGameIndex === null)
        return true;
    if (ply <= state.lastPly)
        return true;
    if (Number(rec.gameIndex) !== Number(state.currentGameIndex))
        return true;
    if (Number(rec.seed) !== Number(state.currentSeed))
        return true;
    return false;
}
function resetStreamStateForGame(state, rec) {
    state.currentGameIndex = Number.isFinite(Number(rec && rec.gameIndex)) ? Number(rec.gameIndex) : null;
    state.currentSeed = Number.isFinite(Number(rec && rec.seed)) ? Number(rec.seed) : null;
    state.lastPly = -1;
    state.lastActionByPlayer.black = null;
    state.lastActionByPlayer.white = null;
}
function recordCornerOpportunity(audit, precedingAction, rec) {
    const taken = isCornerMove(Number(rec.row), Number(rec.col), 8);
    audit.cornerOpportunityPlaceTurns += 1;
    if (taken)
        audit.cornerTakenPlaceTurns += 1;
    else
        audit.cornerMissPlaceTurns += 1;
    if (!precedingAction || precedingAction.actionType !== 'use_card')
        return;
    audit.cornerOpportunityAfterPrecedingOwnCardUse += 1;
    if (taken)
        audit.cornerTakenAfterPrecedingOwnCardUse += 1;
    else
        audit.cornerMissAfterPrecedingOwnCardUse += 1;
    bumpBreakdown(audit.byPrecedingUseCardType, precedingAction.useCardType, taken);
    bumpBreakdown(audit.byPrecedingUseHandSize, precedingAction.handSize, taken);
    bumpBreakdown(audit.byPrecedingUseMinUseScore, normalizeMinUseScoreKey(precedingAction.minUseScore), taken);
    for (const tag of precedingAction.reasonTags) {
        bumpBreakdown(audit.byPrecedingUseReasonTag, tag, taken);
    }
    if (Number.isFinite(precedingAction.turnNumber) &&
        Number.isFinite(Number(rec.turnNumber)) &&
        Number(precedingAction.turnNumber) === Number(rec.turnNumber)) {
        audit.cornerOpportunityAfterSameTurnCardUse += 1;
        if (taken)
            audit.cornerTakenAfterSameTurnCardUse += 1;
        else
            audit.cornerMissAfterSameTurnCardUse += 1;
    }
}
function processCornerUseDriftRecord(audit, state, rec) {
    if (!audit || !state || !rec || typeof rec !== 'object')
        return;
    if (isNewGame(state, rec))
        resetStreamStateForGame(state, rec);
    const player = rec.player === 'black' || rec.player === 'white' ? rec.player : null;
    if (!player)
        return;
    const precedingAction = state.lastActionByPlayer[player];
    if (rec.actionType === 'place' && toFiniteNumber(rec.hasCornerMoveNow) > 0) {
        recordCornerOpportunity(audit, precedingAction, rec);
    }
    state.lastActionByPlayer[player] = buildActionSnapshot(rec);
    state.lastPly = Number.isFinite(Number(rec.ply)) ? Number(rec.ply) : state.lastPly;
}
function safeRate(numerator, denominator) {
    if (!denominator)
        return 0;
    return numerator / denominator;
}
function finalizeCornerUseDriftAudit(audit) {
    return {
        cornerOpportunityPlaceTurns: audit.cornerOpportunityPlaceTurns,
        cornerTakenPlaceTurns: audit.cornerTakenPlaceTurns,
        cornerMissPlaceTurns: audit.cornerMissPlaceTurns,
        cornerTakeRate: safeRate(audit.cornerTakenPlaceTurns, audit.cornerOpportunityPlaceTurns),
        cornerOpportunityAfterPrecedingOwnCardUse: audit.cornerOpportunityAfterPrecedingOwnCardUse,
        cornerTakenAfterPrecedingOwnCardUse: audit.cornerTakenAfterPrecedingOwnCardUse,
        cornerMissAfterPrecedingOwnCardUse: audit.cornerMissAfterPrecedingOwnCardUse,
        cornerTakeRateAfterPrecedingOwnCardUse: safeRate(audit.cornerTakenAfterPrecedingOwnCardUse, audit.cornerOpportunityAfterPrecedingOwnCardUse),
        cornerOpportunityAfterSameTurnCardUse: audit.cornerOpportunityAfterSameTurnCardUse,
        cornerTakenAfterSameTurnCardUse: audit.cornerTakenAfterSameTurnCardUse,
        cornerMissAfterSameTurnCardUse: audit.cornerMissAfterSameTurnCardUse,
        cornerTakeRateAfterSameTurnCardUse: safeRate(audit.cornerTakenAfterSameTurnCardUse, audit.cornerOpportunityAfterSameTurnCardUse),
        byPrecedingUseCardType: audit.byPrecedingUseCardType,
        byPrecedingUseReasonTag: audit.byPrecedingUseReasonTag,
        byPrecedingUseHandSize: audit.byPrecedingUseHandSize,
        byPrecedingUseMinUseScore: audit.byPrecedingUseMinUseScore
    };
}
async function runCornerUseDriftAudit(options) {
    const benchmarkOptions = Object.assign({}, options || {});
    if (benchmarkOptions.jobs !== 1) {
        benchmarkOptions.jobs = 1;
    }
    const audit = createCornerUseDriftAudit();
    const state = createCornerUseDriftStreamState();
    const benchmark = await (0, benchmark_selfplay_policy_1.runBenchmark)(Object.assign({}, benchmarkOptions, {
        jobs: 1,
        onRecord: (rec) => processCornerUseDriftRecord(audit, state, rec)
    }));
    return {
        benchmark,
        audit: finalizeCornerUseDriftAudit(audit)
    };
}
function printHelp() {
    console.log('Usage:');
    console.log('  node scripts/audit-corner-use-drift.js [benchmark options] [--audit-out <path>]');
    console.log('');
    console.log('Notes:');
    console.log('  - Reuses benchmark-selfplay-policy options.');
    console.log('  - Forces jobs=1 because onRecord audit is sequential-only.');
    console.log('  - Optional --out writes the benchmark payload.');
    console.log('  - Optional --audit-out writes the corner-use audit payload.');
}
async function main() {
    const parsed = parseAuditArgs(process.argv.slice(2));
    const benchmarkOptions = Object.assign({}, parsed.benchmarkOptions || {});
    if (benchmarkOptions.help) {
        printHelp();
        return;
    }
    const startedAt = Date.now();
    const result = await runCornerUseDriftAudit(benchmarkOptions);
    const elapsedMs = Date.now() - startedAt;
    const benchmarkPayload = {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: result.benchmark.schemaVersion,
        config: result.benchmark.config,
        result: result.benchmark.result
    };
    if (benchmarkOptions.out) {
        fs.mkdirSync(path.dirname(benchmarkOptions.out), { recursive: true });
        fs.writeFileSync(benchmarkOptions.out, JSON.stringify(benchmarkPayload, null, 2), 'utf8');
        console.log(`[corner-use-audit] wrote benchmark: ${benchmarkOptions.out}`);
    }
    const auditPayload = {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        benchmarkConfig: result.benchmark.config,
        benchmarkResult: result.benchmark.result,
        audit: result.audit
    };
    if (parsed.auditOut) {
        fs.mkdirSync(path.dirname(parsed.auditOut), { recursive: true });
        fs.writeFileSync(parsed.auditOut, JSON.stringify(auditPayload, null, 2), 'utf8');
        console.log(`[corner-use-audit] wrote audit: ${parsed.auditOut}`);
    }
    console.log(`[corner-use-audit] cornerOpp=${result.audit.cornerOpportunityPlaceTurns} ` +
        `cornerTaken=${result.audit.cornerTakenPlaceTurns} ` +
        `afterOwnUse=${result.audit.cornerOpportunityAfterPrecedingOwnCardUse} ` +
        `afterOwnUseTaken=${result.audit.cornerTakenAfterPrecedingOwnCardUse}`);
}
if (require.main === module) {
    main().catch((err) => {
        console.error('[corner-use-audit] failed:', err && err.message ? err.message : err);
        process.exit(1);
    });
}
module.exports = {
    parseAuditArgs,
    createCornerUseDriftAudit,
    createCornerUseDriftStreamState,
    processCornerUseDriftRecord,
    finalizeCornerUseDriftAudit,
    runCornerUseDriftAudit
};
//# sourceMappingURL=audit-corner-use-drift.js.map