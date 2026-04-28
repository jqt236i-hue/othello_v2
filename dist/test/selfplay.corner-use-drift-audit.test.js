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
const { parseAuditArgs, createCornerUseDriftAudit, createCornerUseDriftStreamState, processCornerUseDriftRecord, finalizeCornerUseDriftAudit } = require('../scripts/audit-corner-use-drift');
describe('corner use drift audit script', () => {
    test('parseAuditArgs extracts audit output without breaking benchmark args', () => {
        const parsed = parseAuditArgs([
            '--games', '4',
            '--seed', '9',
            '--out', 'tmp/bench.json',
            '--audit-out', 'tmp/audit.json'
        ]);
        expect(parsed.benchmarkOptions.games).toBe(4);
        expect(parsed.benchmarkOptions.seed).toBe(9);
        expect(parsed.benchmarkOptions.out).toContain(path.join('tmp', 'bench.json'));
        expect(parsed.auditOut).toContain(path.join('tmp', 'audit.json'));
    });
    test('processCornerUseDriftRecord attributes corner miss to preceding own use', () => {
        const audit = createCornerUseDriftAudit();
        const state = createCornerUseDriftStreamState();
        processCornerUseDriftRecord(audit, state, {
            gameIndex: 0,
            seed: 1,
            ply: 0,
            turnNumber: 12,
            player: 'black',
            actionType: 'use_card',
            useCardId: 'taboo_reverse_01',
            decisionCandidates: [
                {
                    decisionKind: 'use',
                    cardId: 'taboo_reverse_01',
                    cardType: 'TABOO_REVERSE_WILL',
                    isSelected: true
                }
            ],
            decisionReasonTags: ['decision:use', 'hand_pressure', 'threshold_passed'],
            decisionScoreSummary: {
                handSize: 5,
                minUseScore: 4
            }
        });
        processCornerUseDriftRecord(audit, state, {
            gameIndex: 0,
            seed: 1,
            ply: 1,
            turnNumber: 12,
            player: 'black',
            actionType: 'place',
            hasCornerMoveNow: 1,
            row: 0,
            col: 1
        });
        const finalized = finalizeCornerUseDriftAudit(audit);
        expect(finalized.cornerOpportunityPlaceTurns).toBe(1);
        expect(finalized.cornerMissPlaceTurns).toBe(1);
        expect(finalized.cornerOpportunityAfterPrecedingOwnCardUse).toBe(1);
        expect(finalized.cornerMissAfterPrecedingOwnCardUse).toBe(1);
        expect(finalized.cornerOpportunityAfterSameTurnCardUse).toBe(1);
        expect(finalized.byPrecedingUseCardType.TABOO_REVERSE_WILL.cornerMissPlaceTurns).toBe(1);
        expect(finalized.byPrecedingUseReasonTag.hand_pressure.cornerMissPlaceTurns).toBe(1);
        expect(finalized.byPrecedingUseHandSize['5'].cornerMissPlaceTurns).toBe(1);
        expect(finalized.byPrecedingUseMinUseScore['4'].cornerMissPlaceTurns).toBe(1);
    });
});
//# sourceMappingURL=selfplay.corner-use-drift-audit.test.js.map