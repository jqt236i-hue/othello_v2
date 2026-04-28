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
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const { parseAuditArgs, compareContexts, createAuditReport, recordComparison, finalizeAuditReport } = require('../scripts/audit-card-context-parity');
describe('card context parity audit script', () => {
    test('parseAuditArgs keeps filters and output path', () => {
        const parsed = parseAuditArgs([
            '--games', '4',
            '--seed', '9',
            '--types', 'REBUILD_WILL,WORK_WILL',
            '--type', 'CLONE_WILL',
            '--out', 'tmp/audit.json'
        ]);
        expect(parsed.games).toBe(4);
        expect(parsed.seed).toBe(9);
        expect(parsed.types).toEqual(['REBUILD_WILL', 'WORK_WILL', 'CLONE_WILL']);
        expect(parsed.out).toContain(path.join('tmp', 'audit.json'));
    });
    test('compareContexts only reports changed fields', () => {
        const diff = compareContexts({
            deckRemaining: 10,
            cloneSplitEligibleSourceCount: 0,
            handCardIds: ['a', 'b']
        }, {
            handCardIds: ['a', 'b'],
        }, ['deckRemaining', 'cloneSplitEligibleSourceCount', 'handCardIds']);
        expect(diff).toEqual({
            deckRemaining: { live: 10 },
            cloneSplitEligibleSourceCount: { live: 0 }
        });
    });
    test('finalizeAuditReport keeps the largest score mismatch sample', () => {
        const report = createAuditReport({ games: 1, seed: 1 });
        recordComparison(report, {
            seed: 1,
            ply: 4,
            playerKey: 'black',
            cardId: 'clone_01',
            type: 'CLONE_WILL',
            useDiff: 12,
            retentionDiff: 0,
            ctxDiff: { cloneSplitEligibleSourceCount: { live: 0 } },
            liveDecision: { score: -1000000 },
            selfplayDecision: { score: -999988 },
            liveRetention: { score: -40 },
            selfplayRetention: { score: -40 }
        });
        recordComparison(report, {
            seed: 1,
            ply: 8,
            playerKey: 'white',
            cardId: 'clone_01',
            type: 'CLONE_WILL',
            useDiff: 42,
            retentionDiff: 0,
            ctxDiff: { cloneSplitEligibleSourceCount: { live: 0 } },
            liveDecision: { score: -1000000 },
            selfplayDecision: { score: -999958 },
            liveRetention: { score: -40 },
            selfplayRetention: { score: -40 }
        });
        const finalized = finalizeAuditReport(report);
        expect(finalized.totalCardComparisons).toBe(2);
        expect(finalized.summary[0].type).toBe('CLONE_WILL');
        expect(finalized.summary[0].scoreMismatchCount).toBe(2);
        expect(finalized.summary[0].maxUseDiff).toBe(42);
        expect(finalized.summary[0].sample.ply).toBe(8);
        expect(finalized.summary[0].ctxDiffFieldCounts.cloneSplitEligibleSourceCount).toBe(2);
        expect(finalized.examples[0].useDiff).toBe(42);
    });
});
//# sourceMappingURL=selfplay.card-context-parity-audit.test.js.map