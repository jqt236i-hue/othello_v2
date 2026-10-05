import {
    getCardMultiPlacementCount,
    resolveCardStoneSupplyState,
    scoreCardStoneSupplyRetentionAdjustment,
    scoreCardStoneSupplyUseAdjustment
} from '../game/ai/cpu-policy-card-stone-supply';
import { createCpuPolicyDecisionContext } from '../game/ai/cpu-policy-decision-context';

const core = require('../game/ai/cpu-policy-core');
const catalog = require('../cards/catalog.json');

function findCardIdByType(type: string): string {
    const cards = Array.isArray(catalog.cards) ? catalog.cards : catalog;
    const card = cards.find((one: any) => one && one.type === type);
    if (!card) throw new Error(`missing card type ${type}`);
    return card.id;
}

function cardCost(cardId: string): number {
    const cards = Array.isArray(catalog.cards) ? catalog.cards : catalog;
    const card = cards.find((one: any) => one && one.id === cardId);
    return Number(card && card.cost) || 0;
}

function cardDef(cardId: string): any {
    const cards = Array.isArray(catalog.cards) ? catalog.cards : catalog;
    return cards.find((one: any) => one && one.id === cardId) || null;
}

describe('card policy stone supply (rulebook 7.3)', () => {
    test('rule-off context keeps every adjustment at zero', () => {
        for (const type of ['DOUBLE_PLACE', 'GOLD_STONE', 'DESTROY_ONE_STONE', 'LAST_RESORT']) {
            expect(scoreCardStoneSupplyUseAdjustment(type, { empties: 20 })).toBe(0);
            expect(scoreCardStoneSupplyRetentionAdjustment(type, { empties: 20 })).toBe(0);
        }
        expect(resolveCardStoneSupplyState({ ownStoneSupply: 3 })).toBeNull();
    });

    test('multi placement loses value when supply runs out before the board', () => {
        expect(getCardMultiPlacementCount('TRIPLE_PLACE')).toBe(3);
        // 持ち石が空きより先に尽きる: 追加配置は自分の持ち石切れを早めるだけ。
        const binding = scoreCardStoneSupplyUseAdjustment('TRIPLE_PLACE', { ownStoneSupply: 10, oppStoneSupply: 10, empties: 24 });
        // 空きの方が先に尽きる: 追加配置は純粋な手番得。
        const slack = scoreCardStoneSupplyUseAdjustment('TRIPLE_PLACE', { ownStoneSupply: 20, oppStoneSupply: 20, empties: 24 });
        expect(binding).toBeLessThan(slack);
        expect(slack).toBe(0);
        // 配置回数に持ち石が足りない分はさらに減点。
        expect(scoreCardStoneSupplyUseAdjustment('QUAD_PLACE', { ownStoneSupply: 2, oppStoneSupply: 2, empties: 30 }))
            .toBeLessThan(scoreCardStoneSupplyUseAdjustment('QUAD_PLACE', { ownStoneSupply: 4, oppStoneSupply: 2, empties: 30 }));
    });

    test('low supply favors cards that work without placing a stone', () => {
        const ctx = { ownStoneSupply: 2, oppStoneSupply: 9, empties: 30 };
        expect(scoreCardStoneSupplyUseAdjustment('GOLD_STONE', ctx)).toBeLessThan(0);
        expect(scoreCardStoneSupplyUseAdjustment('DESTROY_ONE_STONE', ctx)).toBeGreaterThan(0);
        expect(scoreCardStoneSupplyUseAdjustment('GOLD_STONE', { ownStoneSupply: 20, oppStoneSupply: 20, empties: 40 })).toBe(0);
        expect(scoreCardStoneSupplyRetentionAdjustment('GOLD_STONE', { ownStoneSupply: 0, oppStoneSupply: 9, empties: 30 })).toBeLessThan(-100);
        expect(scoreCardStoneSupplyRetentionAdjustment('DESTROY_ONE_STONE', { ownStoneSupply: 0, oppStoneSupply: 9, empties: 30 })).toBe(0);
    });

    test('supply-exhausted no-move is not a forced card use or low mobility', () => {
        const { buildCardDecisionContext } = createCpuPolicyDecisionContext();
        const exhausted = buildCardDecisionContext({
            level: 6, playerValue: 1, legalMovesCount: 0, forceUseCard: false, empties: 20,
            ownStoneSupply: 0, oppStoneSupply: 6
        } as any) as any;
        expect(exhausted.forceUseCard).toBe(false);
        expect(exhausted.legalMovesCount).toBe(3);
        expect(exhausted.rawLegalMovesCount).toBe(0);
        expect(exhausted.stoneSupplyExhausted).toBe(true);
        expect(Number.isFinite(exhausted.minUseScore)).toBe(true);
        const stuck = buildCardDecisionContext({ level: 6, playerValue: 1, legalMovesCount: 0, empties: 20 } as any) as any;
        expect(stuck.forceUseCard).toBe(true);
        expect(stuck.legalMovesCount).toBe(0);
        expect(Object.prototype.hasOwnProperty.call(stuck, 'ownStoneSupply')).toBe(false);
    });

    test('shared card scoring applies the adjustment only while the rule is on', () => {
        const doublePlaceId = findCardIdByType('DOUBLE_PLACE');
        const base = {
            level: 6, playerValue: 1, legalMovesCount: 6, discDiff: 0, empties: 24,
            ownCharge: 40, oppCharge: 40, handSize: 2, handCardIds: [doublePlaceId], usableCardIds: [doublePlaceId]
        };
        const off = core.scoreCardUseDecision(doublePlaceId, cardCost, cardDef, base);
        const on = core.scoreCardUseDecision(doublePlaceId, cardCost, cardDef, { ...base, ownStoneSupply: 8, oppStoneSupply: 10 });
        expect(on.score).toBe(off.score + scoreCardStoneSupplyUseAdjustment('DOUBLE_PLACE', { ownStoneSupply: 8, oppStoneSupply: 10, empties: 24 }));
        expect(on.score).toBeLessThan(off.score);
        const retentionOff = core.scoreCardRetentionPriority(doublePlaceId, cardCost, cardDef, base);
        const retentionOn = core.scoreCardRetentionPriority(doublePlaceId, cardCost, cardDef, { ...base, ownStoneSupply: 0, oppStoneSupply: 10 });
        expect(retentionOn.score).toBe(retentionOff.score - 400);
    });
});
