/**
 * @file stone-supply.ts
 * @description 持ち石ルール（各プレイヤーが置ける石数の上限）の純粋ヘルパー。
 * cardState.stoneSupply に保持し、Browser / Worker / local server / headless で共有する。
 */

'use strict';

type StoneSupplyPlayerKey = 'black' | 'white';

interface StoneSupplyState {
    initial: number;
    remainingByPlayer: Record<StoneSupplyPlayerKey, number>;
}

/**
 * 効果が「自分で石を置くこと」に依存するカード種別。持ち石切れでは使用できない。
 * 自由配置・投石連鎖、次に置く石を特殊石化 / 強化するカード、次に置く石として顕現石を出すカードを含む。
 * 対象選択だけで効果が成立するカードや、使用時に即解決するカードは含めない。
 */
const STONE_PLACEMENT_CARD_TYPES: ReadonlySet<string> = new Set([
    'LAST_RESORT',
    'FREE_PLACEMENT',
    'DOUBLE_PLACE',
    'TRIPLE_PLACE',
    'QUAD_PLACE',
    'INFINITE_PLACE',
    'SNIPER_WILL',
    'PROTECTED_NEXT_STONE',
    'PERMA_PROTECT_NEXT_STONE',
    'GHOST_WILL',
    'SACRIFICE_WILL',
    'ZOMBIE_WILL',
    'AFTERIMAGE_WILL',
    'DOUBLE_CHAIN_WILL',
    'TRIPLE_CHAIN_WILL',
    'QUAD_CHAIN_WILL',
    'INFINITE_CHAIN_WILL',
    'TABOO_REVERSE_WILL',
    'REGEN_WILL',
    'ULTIMATE_REVERSE_DRAGON',
    'BREEDING_WILL',
    'PROLIFERATION_WILL',
    'CROSS_BOMB',
    'X_BOMB',
    'HYPERACTIVE_WILL',
    'EXTREME_HYPERACTIVE_WILL',
    'INSTANT_HYPERACTIVE_WILL',
    'ULTIMATE_HYPERACTIVE_GOD',
    'ESCAPE_WILL',
    'ROBOT_VACUUM_WILL',
    'GLUTTONOUS_WILL',
    'WILL_HUNTER_KING',
    'WORK_WILL',
    'ULTIMATE_WORK_GOD',
    'FIRE_WILL',
    'WATER_WILL',
    'GRASS_WILL',
    'GOLD_STONE',
    'SILVER_STONE',
    'RAINBOW_STONE',
    'CRYSTAL_STONE',
    'STONE_SALVATION_GOD',
    'DESTROY_DRAGON_WILL',
    'LIGHTNING_WILL',
    'ULTIMATE_DESTROY_GOD',
    'METEOR_GOD',
    'TIME_STOP_GOD',
    'TIME_STOP_DEITY',
    'BOARD_EXECUTOR',
    'THEORY_INCARNATION'
]);

function toNonNegativeInteger(value: unknown, fallback: number): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(0, Math.floor(n));
}

function normalizeStoneSupplyPlayerKey(value: unknown): StoneSupplyPlayerKey | null {
    const key = String(value || '').trim().toLowerCase();
    if (key === 'black' || key === 'white') return key;
    return null;
}

/**
 * 対局エントリ（ローカル / ネット部屋）で使う ON/OFF 判定。
 * 明示的に false を指定した場合だけ OFF とし、未指定は既定 ON。
 */
function resolveStoneSupplyEnabledOption(value: unknown): boolean {
    return value !== false;
}

/**
 * 持ち石の初期値 = ベース盤面で石を置けるマス数の半分（切り捨て）− 自分の初期配置石数。
 * 円形盤面などの欠けマスは数えない。初期配置は黒白同数なので openingStoneCount の半分を各自の初期配置石数とする。
 */
function computeInitialStoneSupply(mainBoardCellCount: unknown, openingStoneCount: unknown): number {
    const cells = toNonNegativeInteger(mainBoardCellCount, 0);
    const openingPerPlayer = Math.floor(toNonNegativeInteger(openingStoneCount, 0) / 2);
    return Math.max(0, Math.floor(cells / 2) - openingPerPlayer);
}

function createStoneSupplyState(initial: unknown): StoneSupplyState {
    const value = toNonNegativeInteger(initial, 0);
    return {
        initial: value,
        remainingByPlayer: { black: value, white: value }
    };
}

function readStoneSupplyState(cardState: unknown): StoneSupplyState | null {
    if (!cardState || typeof cardState !== 'object') return null;
    const supply = (cardState as Record<string, unknown>).stoneSupply;
    if (!supply || typeof supply !== 'object') return null;
    return supply as StoneSupplyState;
}

function cloneStoneSupplyState(value: unknown): StoneSupplyState | null {
    if (!value || typeof value !== 'object') return null;
    const source = value as Record<string, any>;
    const initial = toNonNegativeInteger(source.initial, 0);
    const remaining = (source.remainingByPlayer && typeof source.remainingByPlayer === 'object')
        ? source.remainingByPlayer
        : {};
    return {
        initial,
        remainingByPlayer: {
            black: toNonNegativeInteger(remaining.black, initial),
            white: toNonNegativeInteger(remaining.white, initial)
        }
    };
}

/** 持ち石ルール無効時は null。 */
function getStoneSupplyRemaining(cardState: unknown, playerKey: unknown): number | null {
    const supply = readStoneSupplyState(cardState);
    const key = normalizeStoneSupplyPlayerKey(playerKey);
    if (!supply || !key) return null;
    const remaining = supply.remainingByPlayer ? supply.remainingByPlayer[key] : 0;
    return toNonNegativeInteger(remaining, 0);
}

function isStoneSupplyExhausted(cardState: unknown, playerKey: unknown): boolean {
    const remaining = getStoneSupplyRemaining(cardState, playerKey);
    return remaining !== null && remaining <= 0;
}

/** 持ち石を1個消費する。ルール無効時は何もしない。 */
function consumeStoneSupply(cardState: unknown, playerKey: unknown): number | null {
    const supply = readStoneSupplyState(cardState);
    const key = normalizeStoneSupplyPlayerKey(playerKey);
    if (!supply || !key) return null;
    if (!supply.remainingByPlayer || typeof supply.remainingByPlayer !== 'object') {
        supply.remainingByPlayer = { black: 0, white: 0 };
    }
    const before = toNonNegativeInteger(supply.remainingByPlayer[key], 0);
    if (before <= 0) {
        throw new Error('Illegal move: stone supply exhausted');
    }
    supply.remainingByPlayer[key] = before - 1;
    return before - 1;
}

function isStonePlacementCardType(cardType: unknown): boolean {
    return STONE_PLACEMENT_CARD_TYPES.has(String(cardType || '').trim().toUpperCase());
}

/** 黒白とも持ち石が 0（ルール無効時は false）。両者の持ち石切れは終局条件になる。 */
function areAllStoneSuppliesExhausted(cardState: unknown): boolean {
    return isStoneSupplyExhausted(cardState, 'black') && isStoneSupplyExhausted(cardState, 'white');
}

/** 持ち石切れで配置できないプレイヤーキー一覧。 */
function listStoneSupplyExhaustedPlayerKeys(cardState: unknown): StoneSupplyPlayerKey[] {
    const keys: StoneSupplyPlayerKey[] = [];
    if (isStoneSupplyExhausted(cardState, 'black')) keys.push('black');
    if (isStoneSupplyExhausted(cardState, 'white')) keys.push('white');
    return keys;
}

export = {
    STONE_PLACEMENT_CARD_TYPES,
    isStonePlacementCardType,
    areAllStoneSuppliesExhausted,
    resolveStoneSupplyEnabledOption,
    computeInitialStoneSupply,
    createStoneSupplyState,
    cloneStoneSupplyState,
    getStoneSupplyRemaining,
    isStoneSupplyExhausted,
    consumeStoneSupply,
    listStoneSupplyExhaustedPlayerKeys
};
