import { createHash } from 'crypto';
const policy = require('../game/ai/cpu-policy-core');
const catalog = require('../cards/catalog.json');

// Frozen before the scoring split: cover all catalog types, forced use, phase,
// resource pressure and target availability without time/search randomness.
test('card scores preserve the pre-refactor decision matrix', () => {
    let seed = 0x5eeda11;
    const next = (limit: number) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed % limit;
    };
    const digest = createHash('sha256');
    let decisions = 0;
    const countKeys = [
        'ownCorners', 'oppCorners', 'ownEdges', 'oppEdges', 'ownSpecialCount', 'oppSpecialCount',
        'ownBombCount', 'ownGuardCount', 'oppGuardCount', 'maxLegalFlips', 'maxLegalGain',
        'maxLegalBoardBonus', 'ownCornerResetCount', 'oppCornerResetCount', 'ownEdgeResetCount',
        'oppEdgeResetCount', 'cloneSplitEligibleSourceCount', 'massFreezeOwnTargetCount',
        'massFreezeOpponentTargetCount', 'temptHighValueTargetCount', 'swapEnemyNormalCornerTargetCount',
        'boardExpansionWillEnemyCornerTargetCount', 'boardExpansionGodEnemyCornerTargetCount',
        'movementCornerSwingTargetCount', 'oppHandSize', 'deckRemaining'
    ];
    for (let sample = 0; sample < 96; sample++) {
        const context: Record<string, unknown> = {
            level: 1 + sample % 8, playerKey: sample % 2 ? 'white' : 'black',
            forceUseCard: sample % 7 === 0, ownCharge: next(100), oppCharge: next(100),
            discDiff: next(65) - 32, empties: next(61), ownDiscs: next(50),
            handSize: next(6), legalMovesCount: next(12), reserveChargeFloor: next(25),
            hasCornerMoveNow: sample % 3 === 0, hasEdgeMoveNow: sample % 4 === 0,
            minUseScore: next(100) - 30,
            handCardIds: catalog.cards.slice(sample % 10, sample % 10 + 5).map((card: { id: string }) => card.id),
            usableCardIds: catalog.cards.map((card: { id: string }) => card.id)
        };
        for (const key of countKeys) context[key] = next(9);
        for (const card of catalog.cards) {
            const result = policy.scoreCardUseDecision(card.id, () => card.cost, () => card, context);
            digest.update(JSON.stringify([sample, card.id, result.score, result.shouldUse, result.minUseScore, result.reason]));
            decisions++;
        }
    }
    expect({ decisions, sha256: digest.digest('hex') }).toMatchSnapshot();
});
