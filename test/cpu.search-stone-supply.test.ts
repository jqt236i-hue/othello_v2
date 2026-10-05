import { createProductionPosition } from '../src/engine/production-match';
import { evaluateLv10Position } from '../game/ai/cpu-lv10-search';
import { evaluateLv11Position } from '../game/ai/cpu-lv11-evaluation';
import { evaluateLv12Position, extractLv12ValueFeatures, LV12_VALUE_FEATURE_NAMES } from '../game/ai/cpu-lv12-evaluation';
import {
    estimateStonePlacementLead,
    readSearchStoneSupply,
    resolveSearchRemainingPlacements,
    resolveStonePlacementCardValueFactor
} from '../game/ai/cpu-search-stone-supply';

function positions() {
    const off = createProductionPosition(914001, { black: 10, white: 10 });
    const on = createProductionPosition(914001, { black: 10, white: 10 }, undefined, { stoneSupplyEnabled: true });
    return { off, on };
}

describe('Lv10-12 evaluation with stone supply (rulebook 7.3)', () => {
    test('placement lead counts solo placements after the smaller supply runs out', () => {
        expect(readSearchStoneSupply({}, 'black')).toBeNull();
        expect(estimateStonePlacementLead(20, null)).toBe(0);
        expect(resolveSearchRemainingPlacements(20, null)).toBe(20);
        expect(estimateStonePlacementLead(20, { own: 15, opp: 15 })).toBe(0);
        expect(estimateStonePlacementLead(20, { own: 6, opp: 2 })).toBe(4);
        expect(estimateStonePlacementLead(20, { own: 2, opp: 30 })).toBe(-16);
        expect(resolveSearchRemainingPlacements(20, { own: 2, opp: 3 })).toBe(5);
    });

    test('a fresh supply equal to the empties does not change any evaluation', () => {
        const { off, on } = positions();
        for (const player of ['black', 'white'] as const) {
            expect(evaluateLv10Position(on, player)).toBe(evaluateLv10Position(off, player));
            expect(evaluateLv11Position(on, player)).toBe(evaluateLv11Position(off, player));
            expect(evaluateLv12Position(on, player)).toBe(evaluateLv12Position(off, player));
        }
        const features = extractLv12ValueFeatures(off, 'black');
        expect(features[LV12_VALUE_FEATURE_NAMES.indexOf('stonePlacementLead')]).toBe(0);
        expect(features[LV12_VALUE_FEATURE_NAMES.indexOf('stonePlacementLeadEnd')]).toBe(0);
    });

    test('running short of stones lowers the evaluation for the short side', () => {
        const { on } = positions();
        const balanced = JSON.parse(JSON.stringify(on));
        on.cardState.stoneSupply.remainingByPlayer = { black: 4, white: 20 };
        balanced.cardState.stoneSupply.remainingByPlayer = { black: 20, white: 20 };
        expect(evaluateLv10Position(on, 'black')).toBeLessThan(evaluateLv10Position(balanced, 'black'));
        expect(evaluateLv11Position(on, 'black')).toBeLessThan(evaluateLv11Position(balanced, 'black'));
        expect(evaluateLv12Position(on, 'black')).toBeLessThan(evaluateLv12Position(balanced, 'black'));
        const black = extractLv12ValueFeatures(on, 'black');
        const white = extractLv12ValueFeatures(on, 'white');
        const lead = LV12_VALUE_FEATURE_NAMES.indexOf('stonePlacementLead');
        expect(black[lead]).toBeLessThan(0);
        expect(black[lead] + white[lead]).toBe(0);
    });

    test('placement cards in hand lose value as stones run out', () => {
        expect(resolveStonePlacementCardValueFactor('DESTROY_ONE_STONE', 0, 10, 20)).toBe(1);
        expect(resolveStonePlacementCardValueFactor('GOLD_STONE', 0, 10, 20)).toBe(0);
        expect(resolveStonePlacementCardValueFactor('GOLD_STONE', 20, 20, 20)).toBe(1);
        expect(resolveStonePlacementCardValueFactor('TRIPLE_PLACE', 10, 10, 30)).toBeCloseTo(.6);
        expect(resolveStonePlacementCardValueFactor('TRIPLE_PLACE', 2, 10, 20)).toBeLessThan(.6);
        const { on } = positions();
        on.cardState.hands = { black: ['double_01'], white: [] };
        const handIndex = LV12_VALUE_FEATURE_NAMES.indexOf('hand');
        on.cardState.stoneSupply.remainingByPlayer = { black: 25, white: 25 };
        const full = extractLv12ValueFeatures(on, 'black')[handIndex];
        on.cardState.stoneSupply.remainingByPlayer = { black: 0, white: 25 };
        expect(extractLv12ValueFeatures(on, 'black')[handIndex]).toBe(0);
        expect(full).toBeGreaterThan(0);
        const { off } = positions();
        off.cardState.hands = { black: ['double_01'], white: [] };
        // 25 + 25 < 空き 60 で持ち石が先に尽きるため、二連投石は 0.6 倍に割り引く。
        expect(full).toBeCloseTo(extractLv12ValueFeatures(off, 'black')[handIndex] * .6, 10);
    });
});
