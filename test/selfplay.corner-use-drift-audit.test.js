const path = require('path');
const {
    parseAuditArgs,
    createCornerUseDriftAudit,
    createCornerUseDriftStreamState,
    processCornerUseDriftRecord,
    finalizeCornerUseDriftAudit
} = require('../scripts/audit-corner-use-drift');

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
