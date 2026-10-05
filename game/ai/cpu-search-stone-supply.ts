/**
 * @file cpu-search-stone-supply.ts
 * @description Lv10〜12 の評価関数で使う持ち石ルール（01-rulebook.md §7.3）の特徴量。
 * 合法手・終局は実際のターン処理（Core / cardState）が決める。ここは打ち切り局面の見積もりだけを返す。
 * 持ち石ルール無効時は null / 0 を返し、従来の評価をそのまま使う。
 */
import StoneSupply = require('../../shared/stone-supply');
import { estimatePlacementLeadFromCounts } from './cpu-policy-lookahead-stone-supply';
import { getCardMultiPlacementCount } from './cpu-policy-card-stone-supply';

export type SearchStoneSupply = Readonly<{ own: number; opp: number }>;

export function readSearchStoneSupply(cardState: unknown, player: 'black' | 'white'): SearchStoneSupply | null {
    const own = StoneSupply.getStoneSupplyRemaining(cardState, player);
    const opp = StoneSupply.getStoneSupplyRemaining(cardState, player === 'black' ? 'white' : 'black');
    if (own === null || opp === null) return null;
    return { own, opp };
}

/** 実際に置ける残り回数。ルール無効時は空きマス数。 */
export function resolveSearchRemainingPlacements(empty: number, supply: SearchStoneSupply | null): number {
    const safeEmpty = Number.isFinite(empty) ? Math.max(0, Math.floor(empty)) : 0;
    return supply ? Math.min(safeEmpty, supply.own + supply.opp) : safeEmpty;
}

/**
 * 交互に置いた場合に自分が相手より多く置ける回数の見積もり。
 * 持ち石の少ない側が先に尽きると、多い側は空きが残る限り単独で置き続けられる。
 * 両者の持ち石が空きに対して十分なら 0（従来の空きマス基準の局面と同じ扱い）。
 */
export function estimateStonePlacementLead(empty: number, supply: SearchStoneSupply | null): number {
    if (!supply) return 0;
    return estimatePlacementLeadFromCounts(empty, supply.own, supply.opp);
}

/**
 * 手札の石を置く前提のカードの価値係数（0〜1）。石を置かずに効くカードは 1。
 * 持ち石切れでは使えないため 0、残りが少ないほど・連続配置の回数に足りないほど下げる。
 * 持ち石が空きより先に尽きる局面の連続配置は総配置数を増やさないため割り引く。
 */
export function resolveStonePlacementCardValueFactor(cardType: unknown, ownRemaining: number, oppRemaining: number, empty: number): number {
    if (!StoneSupply.isStonePlacementCardType(cardType)) return 1;
    const own = Math.max(0, Math.floor(Number(ownRemaining) || 0));
    const opp = Math.max(0, Math.floor(Number(oppRemaining) || 0));
    if (own <= 0) return 0;
    let factor = 1;
    const placements = getCardMultiPlacementCount(cardType);
    if (placements > 1) {
        if (String(cardType).toUpperCase() !== 'INFINITE_PLACE') factor *= Math.min(1, own / placements);
        if (own + opp <= Math.max(0, Math.floor(Number(empty) || 0))) factor *= .6;
    }
    if (own <= 5) factor *= (own + 1) / 7;
    return factor;
}

/** どちらかが持ち石切れなら、合法手 0 は機動力の差ではない（終局まで置けないだけ）。 */
export function isSearchStoneSupplyBlockingMobility(supply: SearchStoneSupply | null): boolean {
    return !!supply && (supply.own <= 0 || supply.opp <= 0);
}
