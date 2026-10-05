/**
 * @file cpu-policy-card-stone-supply.ts
 * @description 持ち石ルール（01-rulebook.md §7.3）下のカード使用・温存判断の補正。全レベル共通のカード方針から使う。
 * 持ち石ルール無効時（ownStoneSupply / oppStoneSupply が null）は常に 0 を返し、従来の判断を変えない。
 */
import StoneSupply = require('../../shared/stone-supply');

type CpuCardStoneSupplyContext = {
    ownStoneSupply?: number | null;
    oppStoneSupply?: number | null;
    empties?: number;
};

/** 1回の使用で行う配置回数（通常配置1回を含む）。投石連鎖・最後の切り札の追加配置ぶんが持ち石を前倒しで消費する。 */
const MULTI_PLACEMENT_COUNT_BY_CARD_TYPE: Readonly<Record<string, number>> = Object.freeze({
    DOUBLE_PLACE: 2,
    TRIPLE_PLACE: 3,
    QUAD_PLACE: 4,
    INFINITE_PLACE: 6,
    LAST_RESORT: 3
});

/** 持ち石がこの数以下になったら「次に置く石」系を控え、石を置かずに効くカードを相対的に重視する。 */
const LOW_STONE_SUPPLY_THRESHOLD = 5;

function readSupply(value: unknown): number | null {
    if (value === null || typeof value === 'undefined') return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
}

export function resolveCardStoneSupplyState(ctx: CpuCardStoneSupplyContext | null | undefined) {
    const own = readSupply(ctx && ctx.ownStoneSupply);
    const opp = readSupply(ctx && ctx.oppStoneSupply);
    if (own === null || opp === null) return null;
    const empties = Number.isFinite(Number(ctx && ctx.empties)) ? Math.max(0, Math.floor(Number(ctx && ctx.empties))) : 0;
    return { own, opp, empties, ownExhausted: own <= 0, oppExhausted: opp <= 0 };
}

export function getCardMultiPlacementCount(cardType: unknown): number {
    const key = String(cardType || '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(MULTI_PLACEMENT_COUNT_BY_CARD_TYPE, key)
        ? MULTI_PLACEMENT_COUNT_BY_CARD_TYPE[key]
        : 0;
}

/**
 * カード使用スコアへの加算値。
 * - 投石連鎖・最後の切り札: 持ち石が盤面より先に尽きる局面では追加配置は総配置数を増やさず、
 *   自分の持ち石切れを早めて相手に最後の配置を渡すため減点する。持ち石が配置回数に足りない分も減点する。
 * - 次に置く石を強化するカード等（石を置く前提のカード）: 持ち石が少ないほど減点する。
 * - 石を置かずに効くカード: 持ち石が少ないほど相対的に加点する。
 */
export function scoreCardStoneSupplyUseAdjustment(cardType: unknown, ctx: CpuCardStoneSupplyContext | null | undefined): number {
    const supply = resolveCardStoneSupplyState(ctx);
    if (!supply) return 0;
    const lowSupplyGap = Math.max(0, LOW_STONE_SUPPLY_THRESHOLD + 1 - supply.own);
    if (!StoneSupply.isStonePlacementCardType(cardType)) {
        return lowSupplyGap * 2;
    }
    let adjustment = 0 - lowSupplyGap * 3;
    const placements = getCardMultiPlacementCount(cardType);
    if (placements > 1) {
        const usablePlacements = Math.min(placements, supply.own);
        const extraPlacements = Math.max(0, usablePlacements - 1);
        const supplyBindsBeforeBoard = supply.own + supply.opp <= supply.empties;
        if (supplyBindsBeforeBoard && extraPlacements > 0) {
            adjustment -= extraPlacements * 8;
            const ownAfter = supply.own - usablePlacements;
            if (ownAfter < supply.opp) adjustment -= Math.min(24, (supply.opp - ownAfter) * 2);
        }
        // 無限投石は合法手が尽きるまで置く効果で、規定回数を持たないため不足分の減点はしない。
        const isInfinitePlace = String(cardType || '').trim().toUpperCase() === 'INFINITE_PLACE';
        if (supply.own < placements && !isInfinitePlace) {
            adjustment -= (placements - supply.own) * 6;
        }
    }
    return adjustment;
}

/**
 * 手札温存スコアへの加算値（低いほど手札破壊の対象になりやすい）。
 * 持ち石切れ・残りわずかの時、石を置く前提のカードは使えない / 使い切れないため温存価値を下げる。
 */
export function scoreCardStoneSupplyRetentionAdjustment(cardType: unknown, ctx: CpuCardStoneSupplyContext | null | undefined): number {
    const supply = resolveCardStoneSupplyState(ctx);
    if (!supply || !StoneSupply.isStonePlacementCardType(cardType)) return 0;
    if (supply.ownExhausted) return -400;
    const lowSupplyGap = Math.max(0, LOW_STONE_SUPPLY_THRESHOLD + 1 - supply.own);
    let adjustment = 0 - lowSupplyGap * 20;
    const placements = getCardMultiPlacementCount(cardType);
    if (placements > 1 && supply.own < placements) adjustment -= (placements - supply.own) * 30;
    return adjustment;
}
