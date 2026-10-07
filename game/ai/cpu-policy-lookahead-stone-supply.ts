/**
 * @file cpu-policy-lookahead-stone-supply.ts
 * @description 盤面だけで読む先読み（Lv6〜9）に持ち石ルール（01-rulebook.md §7.3）を持ち込む純粋ヘルパー。
 * 持ち石ルール無効時は null を扱い、呼び出し側は従来の空きマス基準の計算をそのまま使う。
 */

/** 黒白の残り持ち石。先読みノードごとに不変オブジェクトとして持つ。 */
export type CpuLookaheadStoneSupply = Readonly<{ black: number; white: number }>;

function toRemaining(value: unknown): number | null {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
}

/** 先読みオプションの `stoneSupply`（`{ black, white }`）を正規化する。無効・未指定は null。 */
export function normalizeLookaheadStoneSupply(value: unknown): CpuLookaheadStoneSupply | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Record<string, unknown>;
    const black = toRemaining(source.black);
    const white = toRemaining(source.white);
    if (black === null || white === null) return null;
    return Object.freeze({ black, white });
}

export function getLookaheadStoneSupplyRemaining(supply: CpuLookaheadStoneSupply | null | undefined, playerValue: number): number | null {
    if (!supply) return null;
    return Number(playerValue) >= 0 ? supply.black : supply.white;
}

export function isLookaheadStoneSupplyExhausted(supply: CpuLookaheadStoneSupply | null | undefined, playerValue: number): boolean {
    const remaining = getLookaheadStoneSupplyRemaining(supply, playerValue);
    return remaining !== null && remaining <= 0;
}

/** 黒白とも 0（ルール無効時は false）。両者とも通常配置ができず、盤面だけの先読みではこれ以上進めない。 */
export function areAllLookaheadStoneSuppliesExhausted(supply: CpuLookaheadStoneSupply | null | undefined): boolean {
    return !!supply && supply.black <= 0 && supply.white <= 0;
}

/** 配置1回ぶん消費した次ノードの持ち石。ルール無効時は null のまま。 */
export function consumeLookaheadStoneSupply(supply: CpuLookaheadStoneSupply | null | undefined, playerValue: number): CpuLookaheadStoneSupply | null {
    if (!supply) return null;
    if (Number(playerValue) >= 0) return Object.freeze({ black: Math.max(0, supply.black - 1), white: supply.white });
    return Object.freeze({ black: supply.black, white: Math.max(0, supply.white - 1) });
}

/**
 * 実際に置ける残り回数。持ち石ルール無効時は空きマス数そのもの、
 * 有効時は空きマス数と黒白の残り持ち石合計の小さい方。
 */
export function resolveLookaheadRemainingPlacements(empties: number, supply: CpuLookaheadStoneSupply | null | undefined): number {
    const safeEmpties = Number.isFinite(empties) ? Math.max(0, Math.floor(empties)) : 0;
    if (!supply) return safeEmpties;
    return Math.min(safeEmpties, supply.black + supply.white);
}

/**
 * 交互に置いた場合に自分が相手より多く置ける回数の見積もり（ownRemaining − oppRemaining 側から見た値）。
 * 持ち石の少ない側が先に尽きると、多い側は空きが残る限り単独で置き続けられる。
 * 両者の持ち石が空きに対して十分なら 0（従来の空きマス基準の局面と同じ扱い）。
 */
export function estimatePlacementLeadFromCounts(empties: number, ownRemaining: number, oppRemaining: number): number {
    const safeEmpties = Number.isFinite(empties) ? Math.max(0, Math.floor(empties)) : 0;
    const own = Number.isFinite(ownRemaining) ? Math.max(0, Math.floor(ownRemaining)) : 0;
    const opp = Number.isFinite(oppRemaining) ? Math.max(0, Math.floor(oppRemaining)) : 0;
    const shared = Math.min(own, opp);
    if (shared * 2 >= safeEmpties) return 0;
    const solo = Math.min(safeEmpties - shared * 2, Math.abs(own - opp));
    return Math.sign(own - opp) * solo;
}

export function estimateLookaheadPlacementLead(
    empties: number,
    supply: CpuLookaheadStoneSupply | null | undefined,
    playerValue: number
): number {
    if (!supply) return 0;
    return estimatePlacementLeadFromCounts(
        empties,
        getLookaheadStoneSupplyRemaining(supply, playerValue) || 0,
        getLookaheadStoneSupplyRemaining(supply, -playerValue) || 0
    );
}

/** 置換表キーへ付ける持ち石の識別子。ルール無効時は空文字でキーを変えない。 */
export function encodeLookaheadStoneSupplyKey(supply: CpuLookaheadStoneSupply | null | undefined): string {
    if (!supply) return '';
    return `:s${supply.black},${supply.white}`;
}

/**
 * 持ち石が空きマスより先に尽きる局面での「最後に置く側」シグナル（手番側から見て +1 / -1 / 0）。
 * 交互に置くと、持ち石の多い側が最後に置ける。同数なら後手側（手番でない側）が最後に置く。
 * 空きマスの方が先に尽きる局面は空きマス基準の偶奇に任せるため null を返す。
 */
export function resolveLookaheadSupplyLastPlacementSignal(
    empties: number,
    supply: CpuLookaheadStoneSupply | null | undefined,
    playerValue: number
): number | null {
    if (!supply) return null;
    const own = getLookaheadStoneSupplyRemaining(supply, playerValue) || 0;
    const opp = getLookaheadStoneSupplyRemaining(supply, -playerValue) || 0;
    if (own + opp >= (Number.isFinite(empties) ? empties : 0)) return null;
    if (own === 0 && opp === 0) return 0;
    if (own > opp) return 1;
    return -1;
}
