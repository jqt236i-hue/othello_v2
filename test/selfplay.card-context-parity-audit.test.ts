import * as path from 'path';
const {
    parseAuditArgs,
    compareContexts,
    createAuditReport,
    recordComparison,
    finalizeAuditReport
} = require('../scripts/audit-card-context-parity');

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
        const diff = compareContexts(
            {
                deckRemaining: 10,
                cloneSplitEligibleSourceCount: 0,
                handCardIds: ['a', 'b']
            },
            {
                handCardIds: ['a', 'b'],
            },
            ['deckRemaining', 'cloneSplitEligibleSourceCount', 'handCardIds']
        );

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
