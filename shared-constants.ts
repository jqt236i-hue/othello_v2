/**
 * Shared Constants Module
 * Centralized definitions used across game-logic.js, card-system.js, 
 * cpu-policy.js, and scripts/train-mccfr.js
 * 
 * This module eliminates duplication of:
 * - Board state constants (BLACK, WHITE, EMPTY)
 * - Board navigation constants (DIRECTIONS)
 * - Card definitions (CARD_DEFS, CARD_TYPE_BY_ID)
 * 
 * Usage:
 *   Browser: Include via <script> before other game files
 *   Node.js: const SharedConstants = require('./shared-constants');
 */

// ===== BOARD STATE CONSTANTS =====
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;


export const BLACK = 1;
export const WHITE = -1;
export const EMPTY = 0;

// ===== BOARD NAVIGATION =====
export const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
] as const;

export const ORTHOGONAL_DIRECTIONS = [
    [-1, 0], [1, 0], [0, -1], [0, 1]
] as const;

// ===== GAME CONSTANTS (canonicalized) =====
// These constants are the single source of truth for core game parameters.
export const BOARD_SIZE = 8;
export const DEFAULT_BOARD_ROWS = 8;
export const DEFAULT_BOARD_COLS = 8;
export const MIN_BOARD_ROWS = 4;
export const MAX_BOARD_ROWS = 10;
export const MIN_BOARD_COLS = 4;
export const MAX_BOARD_COLS = 10;
export const HAND_LIMIT = 5;
export const CHARGE_LIMIT = 3;
export const CHARGE_MAX = 99;
export const DRAW_PERIOD = 1; // number of cards drawn per draw action

export const INITIAL_BOARD_BONUS_DISTRIBUTION = [
    { value: 1, count: 7 },
    { value: 2, count: 7 },
    { value: 3, count: 5 },
    { value: 4, count: 4 },
    { value: 5, count: 5 },
    { value: 6, count: 4 },
    { value: 7, count: 3 },
    { value: 8, count: 2 },
    { value: 9, count: 2 },
    { value: 10, count: 1 }
] as const;

export const DEFAULT_DECK = [
    // Minimal example deck structure; real deck is defined elsewhere (cards/catalog.json)
    { id: 'free_01', count: 1 },
    { id: 'hard_01', count: 1 },
    { id: 'swap_01', count: 1 }
] as const;

// ===== CARD DEFINITIONS =====
// Primary source of truth: `cards/catalog.json` (and `cards/catalog.js` in browser).
// Fallback: the generated `cards/catalog.ts` module, which is regenerated from
// the same JSON source and keeps non-browser runtimes resilient without a
// second hand-maintained card list.

function normalizeCatalogCard(c: any) {
    return {
        id: c.id,
        name: c.name || c.name_ja || '',
        type: c.type,
        cost: c.cost,
        desc: c.desc || c.desc_ja || '',
        display_type_ja: c.display_type_ja,
        enabled: c.enabled
    };
}

function normalizeCatalogCards(cards: any): any[] | null {
    if (!Array.isArray(cards)) return null;
    return cards.map(normalizeCatalogCard);
}

function readRuntimeCatalogCards(): any[] | null {
    const runtimeGlobal = (typeof globalThis !== 'undefined')
        ? (globalThis as any)
        : (typeof self !== 'undefined' ? (self as any) : null);
    const catalog = runtimeGlobal && runtimeGlobal.CardCatalog;
    return catalog && Array.isArray(catalog.cards) ? normalizeCatalogCards(catalog.cards) : null;
}

function readGeneratedCatalogCards(): any[] | null {
    try {
        const mod = _require('./cards/catalog');
        const catalog = mod && (mod as any).default ? (mod as any).default : mod;
        return catalog && Array.isArray(catalog.cards) ? normalizeCatalogCards(catalog.cards) : null;
    } catch (e) {
        return null;
    }
}

// Load catalog cards if available
let catalogCards: any[] | null = null;
try {
    // Browser path: loaded via <script src="cards/catalog.js">
    if (typeof window !== 'undefined' && (window as any).CardCatalog && Array.isArray((window as any).CardCatalog.cards)) {
        catalogCards = normalizeCatalogCards((window as any).CardCatalog.cards);
    }
    if (!catalogCards) {
        catalogCards = readRuntimeCatalogCards();
    }
} catch (e) {
    // ignore
}
try {
    // Node path: load JSON directly
    if (!catalogCards && typeof module === 'object' && module.exports) {
        // eslint-disable-next-line global-require
        const path = require('path');
        const json = require(path.resolve(process.cwd(), 'cards', 'catalog.json'));
        if (json && Array.isArray(json.cards)) {
            catalogCards = normalizeCatalogCards(json.cards);
        }
    }
} catch (e) {
    // ignore
}

const CARD_DEFS_FALLBACK = readGeneratedCatalogCards();

export const CARD_DEFS = (catalogCards && catalogCards.length) ? catalogCards : CARD_DEFS_FALLBACK;

if (!Array.isArray(CARD_DEFS) || CARD_DEFS.length === 0) {
    throw new Error('Card catalog could not be loaded from window.CardCatalog, cards/catalog.json, or generated cards/catalog module');
}

// ===== DERIVED MAPPINGS =====
export const CARD_TYPE_BY_ID = CARD_DEFS.reduce((map: Record<string, string>, card: any) => {
    map[card.id] = card.type;
    return map;
}, {} as Record<string, string>);

export const CARD_TYPES = Array.from(new Set(CARD_DEFS.map((card: any) => card.type).filter(Boolean))) as readonly string[];

// ===== DEBUG MODE =====
// グローバルデバッグモード設定（初期値は false）
export const DEBUG_MODE = {
    TURBO_AI_BATTLE: false,    // レベル1同士の超高速対局（モーションなし）
    SKIP_ANIMATIONS: false      // アニメーションをスキップ
};

// TIME BOMB default turns
export const TIME_BOMB_TURNS = 3;
export const TIME_STOP_GOD_TURNS = 5;
export const TIME_STOP_GOD_CONSECUTIVE_TURNS = 2;
export const TIME_STOP_GOD_SELF_DESTROY_COUNT = 3;
// TIME STOP DEITY default turns
export const TIME_STOP_DEITY_TURNS = 5;
export const TIME_STOP_DEITY_CONSECUTIVE_TURNS = 4;
export const TIME_STOP_DEITY_SELF_DESTROY_COUNT = 9;

// Destroy fade duration (ms)
// Used by UI animation utilities to align JS waiting with CSS animation time
// Canonical value also in constants/animation-constants.ts → ANIMATION_TIMINGS.DESTROY_FADE_MS
export const DESTROY_FADE_MS = 500;

// Card info
export const MAX_SWAP_TARGETS = 6;
export const MAX_DESTROY_TARGETS = 8;

// Also expose key constants directly on global scope for legacy compatibility
if (typeof window !== 'undefined') {
    (window as any).BLACK = BLACK;
    (window as any).WHITE = WHITE;
    (window as any).EMPTY = EMPTY;
    (window as any).DIRECTIONS = DIRECTIONS;
    (window as any).ORTHOGONAL_DIRECTIONS = ORTHOGONAL_DIRECTIONS;
    (window as any).CARD_DEFS = CARD_DEFS;
    (window as any).CARD_TYPE_BY_ID = CARD_TYPE_BY_ID;
    (window as any).CARD_TYPES = CARD_TYPES;
    (window as any).DEBUG_MODE = DEBUG_MODE;
    (window as any).TIME_BOMB_TURNS = TIME_BOMB_TURNS;
    (window as any).TIME_STOP_GOD_TURNS = TIME_STOP_GOD_TURNS;
    (window as any).TIME_STOP_GOD_CONSECUTIVE_TURNS = TIME_STOP_GOD_CONSECUTIVE_TURNS;
    (window as any).TIME_STOP_GOD_SELF_DESTROY_COUNT = TIME_STOP_GOD_SELF_DESTROY_COUNT;
    (window as any).TIME_STOP_DEITY_TURNS = TIME_STOP_DEITY_TURNS;
    (window as any).TIME_STOP_DEITY_CONSECUTIVE_TURNS = TIME_STOP_DEITY_CONSECUTIVE_TURNS;
    (window as any).TIME_STOP_DEITY_SELF_DESTROY_COUNT = TIME_STOP_DEITY_SELF_DESTROY_COUNT;
    (window as any).DESTROY_FADE_MS = DESTROY_FADE_MS;
    // Expose new canonical game constants for browser usage
    (window as any).BOARD_SIZE = BOARD_SIZE;
    (window as any).DEFAULT_BOARD_ROWS = DEFAULT_BOARD_ROWS;
    (window as any).DEFAULT_BOARD_COLS = DEFAULT_BOARD_COLS;
    (window as any).MIN_BOARD_ROWS = MIN_BOARD_ROWS;
    (window as any).MAX_BOARD_ROWS = MAX_BOARD_ROWS;
    (window as any).MIN_BOARD_COLS = MIN_BOARD_COLS;
    (window as any).MAX_BOARD_COLS = MAX_BOARD_COLS;
    (window as any).HAND_LIMIT = HAND_LIMIT;
    (window as any).CHARGE_LIMIT = CHARGE_LIMIT;
    (window as any).CHARGE_MAX = CHARGE_MAX;
    (window as any).DRAW_PERIOD = DRAW_PERIOD;
    (window as any).INITIAL_BOARD_BONUS_DISTRIBUTION = INITIAL_BOARD_BONUS_DISTRIBUTION;
    (window as any).DEFAULT_DECK = DEFAULT_DECK;
}

export default {
    BLACK,
    WHITE,
    EMPTY,
    DIRECTIONS,
    ORTHOGONAL_DIRECTIONS,
    BOARD_SIZE,
    DEFAULT_BOARD_ROWS,
    DEFAULT_BOARD_COLS,
    MIN_BOARD_ROWS,
    MAX_BOARD_ROWS,
    MIN_BOARD_COLS,
    MAX_BOARD_COLS,
    HAND_LIMIT,
    CHARGE_LIMIT,
    CHARGE_MAX,
    DRAW_PERIOD,
    INITIAL_BOARD_BONUS_DISTRIBUTION,
    DEFAULT_DECK,
    CARD_DEFS,
    CARD_TYPE_BY_ID,
    CARD_TYPES,
    MAX_SWAP_TARGETS,
    MAX_DESTROY_TARGETS,
    TIME_BOMB_TURNS,
    TIME_STOP_GOD_TURNS,
    TIME_STOP_GOD_CONSECUTIVE_TURNS,
    TIME_STOP_GOD_SELF_DESTROY_COUNT,
    TIME_STOP_DEITY_TURNS,
    TIME_STOP_DEITY_CONSECUTIVE_TURNS,
    TIME_STOP_DEITY_SELF_DESTROY_COUNT,
    DESTROY_FADE_MS,
};
