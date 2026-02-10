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

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SharedConstants = factory();
    }
})(typeof self !== 'undefined' ? self : this, function () {
    // ===== BOARD STATE CONSTANTS =====
    const BLACK = 1;
    const WHITE = -1;
    const EMPTY = 0;

    // ===== BOARD NAVIGATION =====
    const DIRECTIONS = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1], [0, 1],
        [1, -1], [1, 0], [1, 1]
    ];

    // ===== GAME CONSTANTS (canonicalized) =====
    // These constants are the single source of truth for core game parameters.
    const BOARD_SIZE = 8;
    const HAND_LIMIT = 5;
    const CHARGE_LIMIT = 3;
    const DRAW_PERIOD = 1; // number of cards drawn per draw action
    const DEFAULT_DECK = [
        // Minimal example deck structure; real deck is defined elsewhere (cards/catalog.json)
        { id: 'free_01', count: 1 },
        { id: 'hard_01', count: 1 },
        { id: 'swap_01', count: 1 }
    ];

    // ===== CARD DEFINITIONS =====
    // Primary source of truth: `cards/catalog.json` (and `cards/catalog.js` in browser).
    // Fallback: the inline CARD_DEFS below (kept for resilience).

    // Load catalog cards if available
    let catalogCards = null;
    try {
        // Browser path: loaded via <script src="cards/catalog.js">
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards)) {
            catalogCards = window.CardCatalog.cards.map(c => ({
                id: c.id,
                name: c.name,
                type: c.type,
                cost: c.cost,
                desc: c.desc,
                enabled: c.enabled
            }));
        }
    } catch (e) {
        // ignore
    }
    try {
        // Node path: load JSON directly
        if (!catalogCards && typeof module === 'object' && module.exports) {
            // eslint-disable-next-line global-require
            const json = require('./cards/catalog.json');
            if (json && Array.isArray(json.cards)) {
                catalogCards = json.cards.map(c => ({
                    id: c.id,
                    name: c.name_ja,
                    type: c.type,
                    cost: c.cost,
                    desc: c.desc_ja,
                    enabled: c.enabled
                }));
            }
        }
    } catch (e) {
        // ignore
    }
    // 23-card deck: FREE_PLACEMENT(4), PROTECTED_NEXT_STONE(4), SWAP_WITH_ENEMY(4), 
    // PERMA_PROTECT_NEXT_STONE(4), DESTROY_ONE_STONE(4), TIME_BOMB(3)
    // 20-card deck (Rule 4.1)
    const CARD_DEFS_FALLBACK = [
        // TREASURE_BOX (宝箱) - 1 card, cost: 0
        { id: 'chest_01', name: '宝箱', type: 'TREASURE_BOX', cost: 0, desc: '使用時に布石を1〜3ランダムで獲得する。' },

        // FREE_PLACEMENT (自由の意志) - 1 card, cost: 2
        { id: 'free_01', name: '自由の意志', type: 'FREE_PLACEMENT', cost: 2, desc: '反転できなくても、空いているマスならどこにでも石を置ける' },



        // PROTECTED_NEXT_STONE (弱い意志) - 1 card, cost: 1
        { id: 'hard_01', name: '弱い意志', type: 'PROTECTED_NEXT_STONE', cost: 1, desc: '次に置いた石は、次の相手ターンの間、反転されない' },

        // SWAP_WITH_ENEMY (交換の意志) - 1 card, cost: 5
        { id: 'swap_01', name: '交換の意志', type: 'SWAP_WITH_ENEMY', cost: 5, desc: '次に置く石を、相手の石1つと入れ替えて配置できる' },

        // SACRIFICE_WILL (生贄の意志) - 1 card, cost: 5
        { id: 'sacrifice_01', name: '生贄の意志', type: 'SACRIFICE_WILL', cost: 5, desc: '盤面上の自分の石を最大3つまで選んで破壊し、1つにつき布石を5獲得する。' },

        // PERMA_PROTECT_NEXT_STONE (強い意志) - 1 card, cost: 12
        { id: 'perma_01', name: '強い意志', type: 'PERMA_PROTECT_NEXT_STONE', cost: 12, desc: '次に置いた石は、ずっと反転されない。' },
        // STRONG_WIND_WILL (強風の意志) - 1 card, cost: 9
        { id: 'strong_wind_01', name: '強風の意志', type: 'STRONG_WIND_WILL', cost: 9, desc: '盤面の石1つを選び、進める上下左右のいずれかへランダムに端まで飛ばす。' },

        { id: 'inherit_01', name: '意志の継承', type: 'INHERIT_WILL', cost: 12, desc: '盤面上の自分の通常石を1つ選び、強い意志状態にする。' },
        { id: 'trap_01', name: '罠の意志', type: 'TRAP_WILL', cost: 14, desc: '自分の石を1つ罠石にする。次の相手ターン中に反転されると、相手の布石全没収＋手札3枚没収。' },

        { id: 'chain_01', name: '連鎖の意志', type: 'CHAIN_WILL', cost: 22, desc: 'このターンの配置で発生した通常反転を起点に、追加反転を最大2回まで行う。' },

        { id: 'regen_01', name: '復活の意志', type: 'REGEN_WILL', cost: 15, desc: '次に置いた石は1回だけ再生し、反転されたら元の色に戻る。戻った結果、そのマスを起点に挟める列があれば成立する方向の石を反転する。' },

        // DESTROY_ONE_STONE (破壊神) - 1 card, cost: 10
        { id: 'destroy_01', name: '破壊神', type: 'DESTROY_ONE_STONE', cost: 10, desc: '盤上の石を1つ選び、破壊する。' },

        // TIME_BOMB (時限爆弾) - 1 card, cost: 13
        { id: 'bomb_01', name: '時限爆弾', type: 'TIME_BOMB', cost: 13, desc: '盤面上の自分の石1つを時限爆弾化。3ターン後に周囲9マスを破壊。反転されると解除。' },

        // ULTIMATE_REVERSE_DRAGON (究極反転龍) - 1 card, cost: 30
        { id: 'udr_01', name: '究極反転龍', type: 'ULTIMATE_REVERSE_DRAGON', cost: 30, desc: '次に置く石を龍化。配置ターン即時＋自ターン開始時、周囲8マスの相手石を自分色に反転（反転数はチャージ対象）。持続5ターン（配置ターン含め最大6回発動）で消滅。' },

        // BREEDING_WILL (繁殖の意志) - 1 card, cost: 16
        { id: 'breeding_01', name: '繁殖の意志', type: 'BREEDING_WILL', cost: 16, desc: '次に置く石を儀式石化。配置ターン即時＋自ターン開始時、周囲8マスの空きマスに石を1個生成。生成石で挟める場合は通常反転（反転数はチャージ対象）。持続3ターン（配置ターン含め最大4回生成）で儀式石は破壊。' },
        { id: 'cross_bomb_01', name: '十字爆弾', type: 'CROSS_BOMB', cost: 18, desc: '次に置く石を十字爆弾化。通常反転後に即起爆し、中心と縦横1マスの石を破壊する。' },

        // HYPERACTIVE_WILL (多動の意志) - 1 card, cost: 8
        { id: 'hyperactive_01', name: '多動の意志', type: 'HYPERACTIVE_WILL', cost: 8, desc: '次に置く石を多動石化。両者のターン開始時に、周囲8マスの空きへランダムに1マス移動し、移動後に挟める場合は通常反転。' },

        // SELL_CARD_WILL (売却の意志) - 1 card, cost: 8
        { id: 'sell_01', name: '売却の意志', type: 'SELL_CARD_WILL', cost: 8, desc: 'カード使用後、自分の手札から1枚を売却し、そのカードのコスト分の布石を獲得する。' },

        // PLUNDER_WILL (吸収の意志) - 1 card, cost: 4
        { id: 'plunder_will', name: '吸収の意志', type: 'PLUNDER_WILL', cost: 4, desc: '次の反転数だけ相手の布石を奪う。' },

        { id: 'work_01', name: '出稼ぎの意志', type: 'WORK_WILL', cost: 11, desc: '次の配置をアンカーにして、その石がある限り自ターン開始時に1,2,4,8,16の順でチャージを得る（最大30）。石が相手に取られるか破壊されると効果は終了する。' },

        // DOUBLE_PLACE (二連投石) - 1 card, cost: 24
        { id: 'double_01', name: '二連投石', type: 'DOUBLE_PLACE', cost: 24, desc: 'このターン、石を2回置ける。' },
        // HEAVEN_BLESSING (天の恵み) - 1 card, cost: 3
        { id: 'heaven_01', name: '天の恵み', type: 'HEAVEN_BLESSING', cost: 3, desc: 'ランダムな候補5枚から1枚を選んで獲得する。' },
        // CONDEMN_WILL (断罪の意志) - 1 card, cost: 6
        { id: 'condemn_01', name: '断罪の意志', type: 'CONDEMN_WILL', cost: 6, desc: '相手手札を公開し、1枚選んで破壊する。' },

        // GOLD_STONE (金の意志) - 1 card, cost: 6
        { id: 'gold_stone', name: '金の意志', type: 'GOLD_STONE', cost: 6, desc: '次の反転で得る布石が4倍。使用後その石は消滅する。' },

        // STEAL_CARD (略奪の意志) - 1 card, cost: 7
        { id: 'steal_card_01', name: '略奪の意志', type: 'STEAL_CARD', cost: 7, desc: '反転枚数ぶん相手手札を奪う。手札上限超過分は自分のデッキに加える。' },

        // GUARD_WILL (守る意志) - 1 card, cost: 7
        { id: 'guard_01', name: '守る意志', type: 'GUARD_WILL', cost: 7, desc: '自分の石1つに完全保護を付与する。3ターン持続。' },

        // ULTIMATE_DESTROY_GOD (究極破壊神) - 1 card, cost: 25
        { id: 'udg_01', name: '究極破壊神', type: 'ULTIMATE_DESTROY_GOD', cost: 25, desc: '次に置く石を究極破壊神化。配置ターン即時＋自ターン開始時、周囲8マスの敵石を破壊。持続3ターン（配置ターン含め最大4回）。' },

        // ULTIMATE_HYPERACTIVE_GOD (究極多動神) - 1 card, cost: 28
        { id: 'ultimate_hyperactive_01', name: '究極多動神', type: 'ULTIMATE_HYPERACTIVE_GOD', cost: 28, desc: '次に置く石を究極多動神化。両者ターン開始時に1マス移動を2回行い、着地隣接の敵石を最大2マス吹き飛ばす。成功1回ごとに布石+2。' }
    ];

    const CARD_DEFS = (catalogCards && catalogCards.length) ? catalogCards : CARD_DEFS_FALLBACK;

    // ===== DERIVED MAPPINGS =====
    const CARD_TYPE_BY_ID = CARD_DEFS.reduce((map, card) => {
        map[card.id] = card.type;
        return map;
    }, {});

    const CARD_TYPES = [
        'TREASURE_BOX',
        'FREE_PLACEMENT',
        'PROTECTED_NEXT_STONE',
        'SWAP_WITH_ENEMY',
        'SACRIFICE_WILL',
        'PERMA_PROTECT_NEXT_STONE',
        'STRONG_WIND_WILL',
        'INHERIT_WILL',
        'TRAP_WILL',
        'TEMPT_WILL',
        'CHAIN_WILL',
        'REGEN_WILL',
        'DESTROY_ONE_STONE',
        'TIME_BOMB',
        'ULTIMATE_REVERSE_DRAGON',
        'BREEDING_WILL',
        'CROSS_BOMB',
        'DOUBLE_PLACE',
        'HEAVEN_BLESSING',
        'CONDEMN_WILL',
        'PLUNDER_WILL',
        'WORK_WILL',
        'GOLD_STONE',
        'SILVER_STONE',
        'STEAL_CARD',
        'GUARD_WILL',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE_GOD',
        'HYPERACTIVE_WILL',
        'SELL_CARD_WILL'
    ];

    // ===== DEBUG MODE =====
    // グローバルデバッグモード設定（初期値は false）
    const DEBUG_MODE = {
        TURBO_AI_BATTLE: false,    // レベル1同士の超高速対局（モーションなし）
        SKIP_ANIMATIONS: false      // アニメーションをスキップ
    };

    // TIME BOMB default turns
    const TIME_BOMB_TURNS = 3;

    // Destroy fade duration (ms)
    // Used by UI animation utilities to align JS waiting with CSS animation time
    const DESTROY_FADE_MS = 500;

    // ===== EXPORT =====
    const exports = {
        // Board constants
        BLACK,
        WHITE,
        EMPTY,
        DIRECTIONS,
        BOARD_SIZE,
        HAND_LIMIT,
        CHARGE_LIMIT,
        DRAW_PERIOD,
        DEFAULT_DECK,

        // Card definitions
        CARD_DEFS,
        CARD_TYPE_BY_ID,
        CARD_TYPES,

        // Card info
        MAX_SWAP_TARGETS: 6,
        MAX_DESTROY_TARGETS: 8,
        TIME_BOMB_TURNS: TIME_BOMB_TURNS,
        DESTROY_FADE_MS: DESTROY_FADE_MS,
    };

    // Also expose key constants directly on global scope for legacy compatibility
    if (typeof window !== 'undefined') {
        window.BLACK = BLACK;
        window.WHITE = WHITE;
        window.EMPTY = EMPTY;
        window.DIRECTIONS = DIRECTIONS;
        window.CARD_DEFS = CARD_DEFS;
        window.CARD_TYPE_BY_ID = CARD_TYPE_BY_ID;
        window.CARD_TYPES = CARD_TYPES;
        window.DEBUG_MODE = DEBUG_MODE;
        window.TIME_BOMB_TURNS = TIME_BOMB_TURNS;
        window.DESTROY_FADE_MS = DESTROY_FADE_MS;
        // Expose new canonical game constants for browser usage
        window.BOARD_SIZE = BOARD_SIZE;
        window.HAND_LIMIT = HAND_LIMIT;
        window.CHARGE_LIMIT = CHARGE_LIMIT;
        window.DRAW_PERIOD = DRAW_PERIOD;
        window.DEFAULT_DECK = DEFAULT_DECK;
    }

    return exports;
});
