const path = require('path');
const {
    parseAuditArgs,
    resolveSelectedUseCardType,
    createAuditReport,
    recordUseCard,
    finalizeAuditReport
} = require('../scripts/audit-card-use-future-delta');

describe('card use future delta audit script', () => {
    test('parseAuditArgs keeps filters and output path', () => {
        const parsed = parseAuditArgs([
            '--games', '4',
            '--seed', '9',
            '--types', 'SELL_CARD_WILL,REBUILD_WILL',
            '--type', 'CLONE_WILL',
            '--out', 'tmp/audit.json'
        ]);

        expect(parsed.games).toBe(4);
        expect(parsed.seed).toBe(9);
        expect(parsed.types).toEqual(['SELL_CARD_WILL', 'REBUILD_WILL', 'CLONE_WILL']);
        expect(parsed.out).toContain(path.join('tmp', 'audit.json'));
    });

    test('resolveSelectedUseCardType prefers selected candidate and falls back to catalog map', () => {
        expect(resolveSelectedUseCardType({
            useCardId: 'sell_01',
            decisionCandidates: [
                { decisionKind: 'use', cardId: 'sell_01', cardType: 'SELL_CARD_WILL', isSelected: true }
            ]
        }, { sell_01: 'LOSS_WILL' })).toBe('SELL_CARD_WILL');

        expect(resolveSelectedUseCardType({
            useCardId: 'rebuild_01'
        }, { rebuild_01: 'REBUILD_WILL' })).toBe('REBUILD_WILL');
    });

    test('finalizeAuditReport uses record.legalMoves for summary stats', () => {
        const report = createAuditReport({ games: 1, seed: 1 });

        recordUseCard(report, {
            actionType: 'use_card',
            useCardId: 'sell_01',
            futureDiscDelta3Ply: -2,
            legalMoves: 3,
            legalMovesCount: 0,
            handCards: ['sell_01', 'clone_01'],
            decisionReasonTags: ['decision:use', 'force_use_card'],
            cornerEmergency: true,
            hasEdgeMoveNow: true
        }, 'SELL_CARD_WILL');

        recordUseCard(report, {
            actionType: 'use_card',
            useCardId: 'sell_01',
            futureDiscDelta3Ply: 2,
            legalMoves: 0,
            legalMovesCount: 99,
            handCards: ['sell_01', 'clone_01', 'meteor_01'],
            decisionReasonTags: ['decision:use', 'high_bonus_move_available'],
            highBonusMoveAvailable: true,
            hasCornerMoveNow: true
        }, 'SELL_CARD_WILL');

        const finalized = finalizeAuditReport(report);
        expect(finalized.totalUseActions).toBe(2);
        expect(finalized.summary).toHaveLength(1);
        expect(finalized.summary[0]).toMatchObject({
            type: 'SELL_CARD_WILL',
            count: 2,
            avgFutureDiscDelta3Ply: 0,
            avgHandSize: 2.5,
            avgLegalMoves: 1.5,
            negativeCount: 1,
            negativeRate: 0.5,
            zeroLegalRate: 0.5,
            cornerEmergencyRate: 0.5,
            forceUseRate: 0.5,
            highBonusRate: 0.5,
            cornerNowRate: 0.5,
            edgeNowRate: 0.5
        });
        expect(finalized.summary[0].topReasonTags).toEqual([
            ['decision:use', 2],
            ['force_use_card', 1],
            ['high_bonus_move_available', 1]
        ]);
    });
});
