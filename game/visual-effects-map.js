/**
 * @file visual-effects-map.js
 * @description 統一されたビジュアル効果管理
 * 石の外見変更（画像参照）をカード種別ごとにマッピング・管理
 * 
 * 新規カード追加時：このファイルのマップに1行追加すれば OK
 */
// IMPORTANT:
// This file is loaded in the browser via <script> tags *and* is also used by Node/tests.
// To avoid polluting the global scope (and colliding with ui/visual-effects-map.js),
// wrap everything in an IIFE and only export via module.exports (CommonJS).
(function () {
console.log('[VISUAL_EFFECTS] game/visual-effects-map.js loaded');

/**
 * カード種別 → ビジュアル効果定義
 * 
 * 各エントリ：
 * - cssClass: DOM に付与する CSS クラス
 * - cssMethod: 'background' | 'pseudoElement'
 *   - 'background': 直接背景画像設定（金の意志など）
 *   - 'pseudoElement': ::before 擬似要素で重ね合わせ（ドラゴンなど）
 * - imagePath: 単一画像パス（cssMethod='background' の場合）
 * - imagePathByOwner: オーナー別画像パス（cssMethod='pseudoElement' + owner分岐の場合）
 * - imagePathByPlayer: プレイヤー別画像パス（cssMethod='background' + player分岐の場合）
 * - dataAttributes: 追加で付与するデータ属性（例: {'data-ud': 'black'}）
 */
const GAME_STONE_VISUAL_EFFECTS = {
    goldStone: {
        cssClass: 'gold-stone',
        cssMethod: 'background',
        imagePath: 'assets/images/stones/gold_stone.png',
        dataAttributes: {}
    },

    silverStone: {
        cssClass: 'silver-stone',
        cssMethod: 'background',
        imagePath: 'assets/images/stones/silver.stone.png',
        dataAttributes: {}
    },
    // 永久保護（強い意志）
    protectedStone: {
        cssClass: 'protected-stone',
        cssMethod: 'background',
        imagePathByOwner: {
            '1': 'assets/images/stones/perma_protect_next_stone-black.png',    // BLACK owner
            '-1': 'assets/images/stones/perma_protect_next_stone-white.png'   // WHITE owner
        },
        // 表示上のサイズ調整（通常石と同じサイズに合わせる）
        backgroundSize: '100% 100%',
        dataAttributes: {},
        clearStyles: {
            'background-color': 'transparent',
            'box-shadow': 'none',
            'border': 'none'
        }
    },
    // 短期保護（弱い意志）
    protectedStoneTemporary: {
        cssClass: 'protected-gray',
        cssMethod: 'background',
        imagePath: 'assets/images/stones/protected_next_stone.png',
        // 短期保護も通常石と同じサイズに合わせる
        backgroundSize: '100% 100%',
        dataAttributes: {},
        clearStyles: {
            'background-color': 'transparent',
            'box-shadow': 'none',
            'border': 'none'
        }
    },
    ultimateDragon: {
        cssClass: 'ultimate-dragon',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/ultimate_reverse_dragon-black.png',    // BLACK owner → black dragon
            '-1': 'assets/images/stones/ultimate_reverse_dragon-white.png'     // WHITE owner → white dragon
        },
        dataAttributes: {} // data-ud は renderBoard 内で owner に応じて付与
    },
    breedingStone: {
        cssClass: 'breeding-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/BREEDING_WILL-black.png',    // BLACK owner → black breeding
            '-1': 'assets/images/stones/BREEDING_WILL-white.png'     // WHITE owner → white breeding
        },
        dataAttributes: {} // data-breeding は renderBoard 内で owner に応じて付与
    },
    ultimateDestroyGod: {
        cssClass: 'ultimate-destroy-god',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/ULTIMATE_DESTROY_GOD-black.png',
            '-1': 'assets/images/stones/ULTIMATE_DESTROY_GOD-white.png'
        },
        dataAttributes: {}
    },
    hyperactiveStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/HYPERACTIVE_WILL-black.png',
            '-1': 'assets/images/stones/HYPERACTIVE_WILL-white.png'
        },
        dataAttributes: {}
    },
    regenStone: {
        cssClass: 'regen-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/regen_stone-black.png',
            '-1': 'assets/images/stones/regen_stone-white.png'
        },
        dataAttributes: {}
    },
    workStone: {
        cssClass: 'work-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/work_stone-black.png',
            '-1': 'assets/images/stones/work_stone-white.png'
        },
        // Use full-size overlay
        backgroundSize: '100% 100%',
        dataAttributes: {}
    },
    timeBombStone: {
        cssClass: 'time-bomb-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/TIME_BOMB-black.png',
            '-1': 'assets/images/stones/TIME_BOMB-white.png'
        },
        dataAttributes: {}
    }
};

// Pending effect type -> visual effect key (used for placement-time visuals)
const PENDING_TYPE_TO_EFFECT_KEY = {
    'PROTECTED_NEXT_STONE': 'protectedStoneTemporary',
    'PERMA_PROTECT_NEXT_STONE': 'protectedStone',
    'ULTIMATE_REVERSE_DRAGON': 'ultimateDragon',
    'BREEDING_WILL': 'breedingStone',
    'ULTIMATE_DESTROY_GOD': 'ultimateDestroyGod',
    'HYPERACTIVE_WILL': 'hyperactiveStone',
    'REGEN_WILL': 'regenStone',
    'GOLD_STONE': 'goldStone',
    'SILVER_STONE': 'silverStone',
    // Ensure WORK pending visuals are applied at placement-time as well
    'WORK_WILL': 'workStone'
    ,
    'TIME_BOMB': 'timeBombStone'
};

function getEffectKeyForPendingType(pendingType) {
    return PENDING_TYPE_TO_EFFECT_KEY[pendingType] || null;
}

// Special stone marker type -> visual effect key (used by board renderer)
const SPECIAL_TYPE_TO_EFFECT_KEY = {
    'PROTECTED': 'protectedStoneTemporary',
    'PERMA_PROTECTED': 'protectedStone',
    'DRAGON': 'ultimateDragon',
    'BREEDING': 'breedingStone',
    'ULTIMATE_DESTROY_GOD': 'ultimateDestroyGod',
    'HYPERACTIVE': 'hyperactiveStone',
    'REGEN': 'regenStone',
    'GOLD': 'goldStone',
    'SILVER': 'silverStone',
    'WORK': 'workStone'
    ,
    'TIME_BOMB': 'timeBombStone'
};

function getEffectKeyForSpecialType(type) {
    return SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
}

/**
 * 石要素にビジュアル効果を適用
 * @param {HTMLElement} discElement - .disc 要素
 * @param {string} effectKey - STONE_VISUAL_EFFECTS のキー（例: 'goldStone', 'ultimateDragon'）
 * @param {Object} options - オプション
 *   - owner: カードの所有者 (BLACK=1, WHITE=-1)
 *   - player: プレイヤー (BLACK=1, WHITE=-1)
 */
let __uiImpl_visual_effects = {};
function setUIImpl(obj) { __uiImpl_visual_effects = obj || {}; }

function applyStoneVisualEffect(discElement, effectKey, options = {}) {
    // Prefer injected UI implementation if available
    if (__uiImpl_visual_effects && typeof __uiImpl_visual_effects.applyStoneVisualEffect === 'function') {
        const fn = __uiImpl_visual_effects.applyStoneVisualEffect;
        if (fn !== applyStoneVisualEffect) return fn(discElement, effectKey, options);
    }
    // UI implementations should be injected by the bootstrap code via setUIImpl.
    // Avoid requiring UI from game/
    return undefined;
} 

/**
 * 石要素からビジュアル効果を削除
 * @param {HTMLElement} discElement - .disc 要素
 * @param {string} effectKey - 削除する効果キー
 */
function removeStoneVisualEffect(discElement, effectKey) {
    if (__uiImpl_visual_effects && typeof __uiImpl_visual_effects.removeStoneVisualEffect === 'function') {
        return __uiImpl_visual_effects.removeStoneVisualEffect(discElement, effectKey);
    }
    // UI implementations should be injected by the bootstrap code via setUIImpl.
    // Avoid requiring UI from game/
    return undefined;
} 

/**
 * サポート対象のビジュアル効果キー一覧を取得
 * @returns {string[]}
 */
function getSupportedEffectKeys() {
    return Object.keys(GAME_STONE_VISUAL_EFFECTS);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STONE_VISUAL_EFFECTS: GAME_STONE_VISUAL_EFFECTS,
        PENDING_TYPE_TO_EFFECT_KEY,
        getEffectKeyForPendingType,
        SPECIAL_TYPE_TO_EFFECT_KEY,
        getEffectKeyForSpecialType,
        applyStoneVisualEffect,
        removeStoneVisualEffect,
        getSupportedEffectKeys,
        // DI setter for UI layer
        setUIImpl
    };
}

// Expose the canonical map to UI.
//
// Important: This file is loaded in the browser via <script> tags where `require` is NOT available.
// Therefore, we must attach to `globalThis` so ui/visual-effects-map.js can read the GameVisualEffectsMap global.
//
// When `require` is available (Node/tests), also register via ui/bootstrap.js for DI consistency.
try {
    const mapObj = {
        STONE_VISUAL_EFFECTS: GAME_STONE_VISUAL_EFFECTS,
        PENDING_TYPE_TO_EFFECT_KEY,
        getEffectKeyForPendingType,
        SPECIAL_TYPE_TO_EFFECT_KEY,
        getEffectKeyForSpecialType,
        applyStoneVisualEffect,
        removeStoneVisualEffect,
        getSupportedEffectKeys,
        setUIImpl
    };

    // Always provide browser-friendly globals.
    try {
        if (typeof globalThis !== 'undefined') {
            globalThis.GameVisualEffectsMap = mapObj;
            globalThis.STONE_VISUAL_EFFECTS = GAME_STONE_VISUAL_EFFECTS;
            globalThis.PENDING_TYPE_TO_EFFECT_KEY = PENDING_TYPE_TO_EFFECT_KEY;
            globalThis.SPECIAL_TYPE_TO_EFFECT_KEY = SPECIAL_TYPE_TO_EFFECT_KEY;
        }
    } catch (e) { /* ignore */ }

    // Prefer UIBootstrap registration when available (Node/tests or special bundlers).
    try {
        if (typeof require === 'function') {
            const uiBootstrap = require('../shared/ui-bootstrap-shared');
            if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
                uiBootstrap.registerUIGlobals({ GameVisualEffectsMap: mapObj, STONE_VISUAL_EFFECTS: GAME_STONE_VISUAL_EFFECTS });
            }
        }
    } catch (e) { /* ignore */ }

    // Notify UI synchronously that the shared visual-effects map is ready so visuals can be applied immediately.
    try {
        if (typeof globalThis !== 'undefined' && typeof globalThis.__visualEffectsMapReady === 'function') {
            globalThis.__visualEffectsMapReady();
        }
    } catch (e) { /* ignore */ }
} catch (e) { /* ignore */ }

// Global helper: adjust all special stone visuals in one place
// Delegate special stone scale change to UI implementation; game/ should not touch document directly.
function setSpecialStoneScale(scale) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.__setSpecialStoneScaleImpl__ === 'function') {
        try { __uiImpl.__setSpecialStoneScaleImpl__(scale); } catch (e) { /* ignore */ }
    } else {
        // No-op in non-UI environments
    }
}
/**
 * === 新規カード効果の追加方法 ===
 * 
 * STONE_VISUAL_EFFECTS にマップを追加するだけで OK。
 * 
 * 例1：背景画像パターン（金の意志と同じ方式）
 * 
 *   iceShield: {
 *       cssClass: 'ice-shield',
 *       cssMethod: 'background',
 *       imagePath: 'assets/images/stones/ice-shield.png',
 *       dataAttributes: {}
 *   }
 * 
 * 例2：擬似要素パターン（究極反転龍と同じ方式、所有者別画像）
 * 
 *   flameOrb: {
 *       cssClass: 'flame-orb',
 *       cssMethod: 'pseudoElement',
 *       imagePathByOwner: {
 *           1: 'assets/images/stones/flame-orb-white.png',    // BLACK owner
 *           '-1': 'assets/images/stones/flame-orb-black.png'   // WHITE owner
 *       },
 *       dataAttributes: { 'data-flame': 'active' }
 *   }
 * 
 * 例3：使用コード（ui.js 内の renderBoard 内など）
 * 
 *   if (someEffect) {
 *       applyStoneVisualEffect(disc, 'iceShield');
 *   }
 * 
 *   if (anotherEffect && owner !== undefined) {
 *       applyStoneVisualEffect(disc, 'flameOrb', { owner });
 *   }
 * 
 * 例4：CSS側（styles-board.css）
 * 
 *   // iceShield の場合（背景画像）
 *   .disc.ice-shield {
 *       background-image: url('assets/images/stones/ice-shield.png') !important;
 *       background-size: 100% 100% !important;
 *       border: none !important;
 *   }
 * 
 *   // flameOrb の場合（::before擬似要素）
 *   .disc.flame-orb::before {
 *       content: '';
 *       background-size: contain;
 *       background-position: center center;
 *       background-repeat: no-repeat;
 *   }
 * 
 *   .disc.flame-orb[data-flame="active"] {
 *       // 追加スタイル
 *       box-shadow: 0 0 15px rgba(255, 100, 0, 0.8);
 *   }
 */
})(); // end IIFE
