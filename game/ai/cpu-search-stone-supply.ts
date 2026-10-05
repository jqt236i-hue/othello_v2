/**
 * @file cpu-search-stone-supply.ts
 * @description Lv10〜12 の評価関数で使う持ち石ルール（01-rulebook.md §7.3）の特徴量。
 * 合法手・終局は実際のターン処理（Core / cardState）が決める。ここは打ち切り局面の見積もりだけを返す。
 * 持ち石ルール無効時は null / 0 を返し、従来の評価をそのまま使う。
 */
import StoneSupply = require('../../shared/stone-supply');
import { estimatePlacementLeadFromCounts } from './cpu-policy-lookahead-stone-supply';

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

/** どちらかが持ち石切れなら、合法手 0 は機動力の差ではない（終局まで置けないだけ）。 */
export function isSearchStoneSupplyBlockingMobility(supply: SearchStoneSupply | null): boolean {
    return !!supply && (supply.own <= 0 || supply.opp <= 0);
}
