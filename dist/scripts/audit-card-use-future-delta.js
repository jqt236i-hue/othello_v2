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
    const options = {
        games: 20,
        seed: 1,
        maxPlies: 220,
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
function toFiniteNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}
function shouldAuditType(type, filterTypes) {
    if (!type)
        return false;
    if (!Array.isArray(filterTypes) || filterTypes.length === 0)
        return true;
    return filterTypes.includes(type);
}
function loadCardTypeMap(rootDir) {
    const catalogPath = path.join(rootDir, 'cards', 'catalog.json');
    const catalogPayload = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    const catalog = Array.isArray(catalogPayload)
        ? catalogPayload
        : (Array.isArray(catalogPayload && catalogPayload.cards) ? catalogPayload.cards : []);
    const map = Object.create(null);
    for (const def of catalog) {
        if (!def || typeof def.id !== 'string' || !def.id.trim())
            continue;
        map[def.id] = typeof def.type === 'string' ? def.type : null;
    }
    return map;
}
function resolveSelectedUseCardType(record, cardTypeById) {
    if (!record || typeof record !== 'object')
        return null;
    if (Array.isArray(record.decisionCandidates)) {
        const useCardId = typeof record.useCardId === 'string' ? record.useCardId : null;
        for (const candidate of record.decisionCandidates) {
            if (!candidate || candidate.decisionKind !== 'use')
                continue;
            if (candidate.isSelected === true && typeof candidate.cardType === 'string' && candidate.cardType) {
                return candidate.cardType;
            }
        }
        if (useCardId) {
            for (const candidate of record.decisionCandidates) {
                if (!candidate || candidate.decisionKind !== 'use')
                    continue;
                if (candidate.cardId === useCardId && typeof candidate.cardType === 'string' && candidate.cardType) {
                    return candidate.cardType;
                }
            }
        }
    }
    if (typeof record.useCardType === 'string' && record.useCardType)
        return record.useCardType;
    if (typeof record.useCardId === 'string' && record.useCardId && cardTypeById) {
        return cardTypeById[record.useCardId] || null;
    }
    return null;
}
function createTypeBucket() {
    return {
        count: 0,
        futureDiscDelta3PlySum: 0,
        handSizeSum: 0,
        legalMovesSum: 0,
        negativeCount: 0,
        zeroLegalCount: 0,
        cornerEmergencyCount: 0,
        forceUseCount: 0,
        highBonusCount: 0,
        cornerNowCount: 0,
        edgeNowCount: 0,
        reasonTagCounts: Object.create(null)
    };
}
function createAuditReport(config) {
    return {
        config: Object.assign({}, config),
        totalUseActions: 0,
        byType: Object.create(null)
    };
}
function normalizeHandSize(record) {
    if (Array.isArray(record && record.handCards))
        return record.handCards.length;
    if (record && record.decisionScoreSummary && Number.isFinite(Number(record.decisionScoreSummary.handSize))) {
        return Number(record.decisionScoreSummary.handSize);
    }
    return 0;
}
function normalizeReasonTags(record) {
    if (!record || !Array.isArray(record.decisionReasonTags))
        return [];
    return record.decisionReasonTags.map((tag) => String(tag));
}
function deriveReasonTags(record, facts) {
    const tags = [];
    const pushUnique = (tag) => {
        const normalized = String(tag || '').trim();
        if (!normalized || tags.includes(normalized))
            return;
        tags.push(normalized);
    };
    pushUnique('decision:use');
    if ((facts && facts.legalMoves) <= 2)
        pushUnique('low_legal_moves');
    if ((facts && facts.handSize) >= 4)
        pushUnique('hand_pressure');
    if (facts && facts.cornerEmergency)
        pushUnique('corner_emergency');
    if (facts && facts.forceUseCard)
        pushUnique('force_use_card');
    if (facts && facts.highBonusMoveAvailable)
        pushUnique('high_bonus_move_available');
    if (facts && facts.hasCornerMoveNow)
        pushUnique('corner_move_available');
    if (facts && facts.hasEdgeMoveNow)
        pushUnique('edge_move_available');
    return tags;
}
function recordUseCard(report, record, cardType) {
    if (!report || !record || !cardType)
        return;
    if (!report.byType[cardType])
        report.byType[cardType] = createTypeBucket();
    const bucket = report.byType[cardType];
    const futureDiscDelta3Ply = toFiniteNumber(record.futureDiscDelta3Ply);
    const handSize = normalizeHandSize(record);
    const legalMoves = Math.max(0, toFiniteNumber(record.legalMoves));
    const forceUseCard = record.forceUseCard === true || toFiniteNumber(record.forceUseCard) > 0 || legalMoves <= 0;
    const highBonusMoveAvailable = record.highBonusMoveAvailable === true || toFiniteNumber(record.highBonusMoveAvailable) > 0;
    const cornerEmergency = record.cornerEmergency === true || toFiniteNumber(record.cornerEmergency) > 0;
    const hasCornerMoveNow = record.hasCornerMoveNow === true || toFiniteNumber(record.hasCornerMoveNow) > 0;
    const hasEdgeMoveNow = record.hasEdgeMoveNow === true || toFiniteNumber(record.hasEdgeMoveNow) > 0;
    const rawReasonTags = normalizeReasonTags(record);
    const reasonTags = rawReasonTags.length > 0
        ? rawReasonTags
        : deriveReasonTags(record, {
            handSize,
            legalMoves,
            forceUseCard,
            highBonusMoveAvailable,
            cornerEmergency,
            hasCornerMoveNow,
            hasEdgeMoveNow
        });
    report.totalUseActions += 1;
    bucket.count += 1;
    bucket.futureDiscDelta3PlySum += futureDiscDelta3Ply;
    bucket.handSizeSum += handSize;
    bucket.legalMovesSum += legalMoves;
    if (futureDiscDelta3Ply < 0)
        bucket.negativeCount += 1;
    if (legalMoves === 0)
        bucket.zeroLegalCount += 1;
    if (cornerEmergency)
        bucket.cornerEmergencyCount += 1;
    if (forceUseCard)
        bucket.forceUseCount += 1;
    if (highBonusMoveAvailable)
        bucket.highBonusCount += 1;
    if (hasCornerMoveNow)
        bucket.cornerNowCount += 1;
    if (hasEdgeMoveNow)
        bucket.edgeNowCount += 1;
    for (const tag of reasonTags) {
        bucket.reasonTagCounts[tag] = (bucket.reasonTagCounts[tag] || 0) + 1;
    }
}
function finalizeAuditReport(report) {
    const summary = Object.entries(report.byType)
        .map(([type, bucket]) => ({
        type,
        count: bucket.count,
        avgFutureDiscDelta3Ply: bucket.count > 0 ? Number((bucket.futureDiscDelta3PlySum / bucket.count).toFixed(4)) : 0,
        avgHandSize: bucket.count > 0 ? Number((bucket.handSizeSum / bucket.count).toFixed(4)) : 0,
        avgLegalMoves: bucket.count > 0 ? Number((bucket.legalMovesSum / bucket.count).toFixed(4)) : 0,
        negativeCount: bucket.negativeCount,
        negativeRate: bucket.count > 0 ? Number((bucket.negativeCount / bucket.count).toFixed(4)) : 0,
        zeroLegalRate: bucket.count > 0 ? Number((bucket.zeroLegalCount / bucket.count).toFixed(4)) : 0,
        cornerEmergencyRate: bucket.count > 0 ? Number((bucket.cornerEmergencyCount / bucket.count).toFixed(4)) : 0,
        forceUseRate: bucket.count > 0 ? Number((bucket.forceUseCount / bucket.count).toFixed(4)) : 0,
        highBonusRate: bucket.count > 0 ? Number((bucket.highBonusCount / bucket.count).toFixed(4)) : 0,
        cornerNowRate: bucket.count > 0 ? Number((bucket.cornerNowCount / bucket.count).toFixed(4)) : 0,
        edgeNowRate: bucket.count > 0 ? Number((bucket.edgeNowCount / bucket.count).toFixed(4)) : 0,
        topReasonTags: Object.entries(bucket.reasonTagCounts)
            .sort((left, right) => {
            if (right[1] !== left[1])
                return right[1] - left[1];
            return String(left[0]).localeCompare(String(right[0]));
        })
            .slice(0, 6)
    }))
        .sort((left, right) => {
        if (left.avgFutureDiscDelta3Ply !== right.avgFutureDiscDelta3Ply) {
            return left.avgFutureDiscDelta3Ply - right.avgFutureDiscDelta3Ply;
        }
        if (right.negativeRate !== left.negativeRate)
            return right.negativeRate - left.negativeRate;
        if (right.count !== left.count)
            return right.count - left.count;
        return String(left.type).localeCompare(String(right.type));
    });
    return {
        config: report.config,
        totalUseActions: report.totalUseActions,
        summary
    };
}
async function runCardUseFutureDeltaAudit(options) {
    const rootDir = process.cwd();
    const cardTypeById = loadCardTypeMap(rootDir);
    const report = createAuditReport({
        games: options.games,
        seed: options.seed,
        maxPlies: options.maxPlies,
        allowCardUsage: options.allowCardUsage,
        cardUsageRate: options.cardUsageRate,
        types: Array.isArray(options.types) ? options.types.slice() : null
    });
    const benchmark = await (0, benchmark_selfplay_policy_1.runBenchmark)({
        games: options.games,
        seed: options.seed,
        maxPlies: options.maxPlies,
        jobs: 1,
        policyA: {
            allowCardUsage: options.allowCardUsage,
            cardUsageRate: options.cardUsageRate
        },
        policyB: {
            allowCardUsage: options.allowCardUsage,
            cardUsageRate: options.cardUsageRate
        },
        onRecord: (record) => {
            if (!record || record.actionType !== 'use_card')
                return;
            const cardType = resolveSelectedUseCardType(record, cardTypeById);
            if (!shouldAuditType(cardType, options.types))
                return;
            recordUseCard(report, record, cardType);
        }
    });
    return {
        benchmark,
        audit: finalizeAuditReport(report)
    };
}
function printHelp() {
    console.log('Usage:');
    console.log('  node scripts/audit-card-use-future-delta.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --games <n>             Base game count per side (default: 20)');
    console.log('  --seed <n>              Starting seed (default: 1)');
    console.log('  --max-plies <n>         Max plies per game (default: 220)');
    console.log('  --card-usage-rate <r>   Card usage rate for both policies (default: 0.35)');
    console.log('  --allow-card-usage      Enable card usage (default)');
    console.log('  --no-card-usage         Disable card usage');
    console.log('  --types <a,b,c>         Restrict summary to specific card types');
    console.log('  --type <name>           Add one more card type filter');
    console.log('  --out <path>            Write audit JSON');
    console.log('  -h, --help              Show this help');
    console.log('');
    console.log('Notes:');
    console.log('  - Forces sequential benchmark execution so onRecord can inspect each use-card row.');
    console.log('  - Uses record.legalMoves (not ad-hoc legalMovesCount summaries) for legal-move stats.');
}
async function main() {
    const options = parseAuditArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }
    const startedAt = Date.now();
    const result = await runCardUseFutureDeltaAudit(options);
    const elapsedMs = Date.now() - startedAt;
    const payload = {
        generatedAt: new Date().toISOString(),
        elapsedMs,
        schemaVersion: 'card-use-future-delta-audit.v1',
        benchmark: {
            totalGames: Number(result.benchmark && result.benchmark.config && result.benchmark.config.games) || 0,
            avgPlies: Number(result.benchmark && result.benchmark.result && result.benchmark.result.avgPlies) || 0
        },
        summary: result.audit.summary
    };
    if (options.out) {
        fs.mkdirSync(path.dirname(options.out), { recursive: true });
        fs.writeFileSync(options.out, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    }
    console.log(JSON.stringify(payload, null, 2));
}
if (require.main === module) {
    main().catch((err) => {
        console.error(err && err.stack ? err.stack : err);
        process.exit(1);
    });
}
module.exports = {
    parseAuditArgs,
    loadCardTypeMap,
    resolveSelectedUseCardType,
    createAuditReport,
    recordUseCard,
    finalizeAuditReport,
    runCardUseFutureDeltaAudit
};
//# sourceMappingURL=audit-card-use-future-delta.js.map