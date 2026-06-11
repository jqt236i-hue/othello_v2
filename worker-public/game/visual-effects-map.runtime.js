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
const TIME_STOP_STONE_IMAGE_BY_OWNER = {
    '1': 'assets/images/stones/TIME_STOP-black.png',
    '-1': 'assets/images/stones/TIME_STOP-white.png'
};
const DEFAULT_CARD_VISUAL_SIDE = '1';
const NORMAL_STONE_IMAGE_FILE_KEYS = Object.freeze([
    'normal_stone-black.png',
    'normal_stone-white.png',
    'normal-stone-black.png',
    'normal-stone-white.png'
]);

/**
 * カード種別 → ビジュアル効果定義
 * 
 * 各エントリ：
 * - cssClass: DOM に付与する CSS クラス
 * - renderMode: 'replace' | 'overlay'
 *   - 'replace': 通常石 base を隠して特殊石画像へ置換
 *   - 'overlay': 通常石 base を残したまま上に重ねる
 * - imagePath: 単一画像パス
 * - imagePathByOwner: オーナー別画像パス
 * - imagePathByPlayer: プレイヤー別画像パス
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

    rainbowStone: {
        cssClass: 'rainbow-stone',
        cssMethod: 'background',
        imagePath: 'assets/images/stones/rainbow_stone.png',
        dataAttributes: {}
    },

    crystalStone: {
        cssClass: 'crystal-stone',
        cssMethod: 'background',
        imagePath: 'assets/images/stones/crystal_stone.png',
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
            'background-color': 'transparent'
        }
    },
    // 絶対保護（最強の意志）
    absoluteProtectedStone: {
        cssClass: 'absolute-protected-stone',
        cssMethod: 'background',
        imagePathByOwner: {
            '1': 'assets/images/stones/absolute_protect_next_stone-black.png',   // BLACK owner
            '-1': 'assets/images/stones/absolute_protect_next_stone-white.png'   // WHITE owner
        },
        backgroundSize: '100% 100%',
        dataAttributes: {},
        clearStyles: {
            'background-color': 'transparent'
        }
    },
    theoryIncarnationStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/theory_incarnation-black.png',
            '-1': 'assets/images/stones/theory_incarnation-white.png'
        },
        dataAttributes: {}
    },
    boardExecutorStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/board_executor-black.png',
            '-1': 'assets/images/stones/board_executor-white.png'
        },
        dataAttributes: {}
    },
    observerWillStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/OBSERVER_WILL-black.png',
            '-1': 'assets/images/stones/OBSERVER_WILL-white.png'
        },
        dataAttributes: {}
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
            'background-color': 'transparent'
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
    proliferationStone: {
        cssClass: 'breeding-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/PROLIFERATION_WILL-black.png',
            '-1': 'assets/images/stones/PROLIFERATION_WILL-white.png'
        },
        dataAttributes: {}
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
    stoneSalvationGod: {
        cssClass: 'stone-salvation-god',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/STONE_SALVATION_GOD-black.png',
            '-1': 'assets/images/stones/STONE_SALVATION_GOD-white.png'
        },
        dataAttributes: {}
    },
    sniperStone: {
        cssClass: 'sniper-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/sna-black.png',
            '-1': 'assets/images/stones/sna-white.png'
        },
        dataAttributes: {}
    },
    lightningStone: {
        cssClass: 'lightning-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/rakurai-black.png',
            '-1': 'assets/images/stones/rakurai-white.png'
        },
        dataAttributes: {}
    },
    meteorGodStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/METEOR_GOD-black.png',
            '-1': 'assets/images/stones/METEOR_GOD-white.png'
        },
        dataAttributes: {}
    },
    ghostStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/GHOST_WILL-black.png',
            '-1': 'assets/images/stones/GHOST_WILL-white.png'
        },
        dataAttributes: {}
    },
    afterimageStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/ZAN-BLACK.png',
            '-1': 'assets/images/stones/ZAN-WHITE.png'
        },
        dataAttributes: {}
    },
    willHunterKingStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/WILL_HUNTER_KING-black.png',
            '-1': 'assets/images/stones/WILL_HUNTER_KING-white.png'
        },
        dataAttributes: {}
    },
    destroyDragonStone: {
        cssClass: 'ultimate-dragon',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/DESTROY_DRAGON-black.png',
            '-1': 'assets/images/stones/DESTROY_DRAGON-white.png'
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
    escapeHyperactiveStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/ESCAPE_WILL-black.png',
            '-1': 'assets/images/stones/ESCAPE_WILL-white.png'
        },
        dataAttributes: {}
    },
    extremeHyperactiveStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/EXTREME_HYPERACTIVE_WILL-black.png',
            '-1': 'assets/images/stones/EXTREME_HYPERACTIVE_WILL-white.png'
        },
        dataAttributes: {}
    },
    robotVacuumStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/ROBOT_VACUUM_WILL-black.png',
            '-1': 'assets/images/stones/ROBOT_VACUUM_WILL-white.png'
        },
        dataAttributes: {}
    },
    gluttonousStone: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/GLUTTONOUS_WILL-black.png',
            '-1': 'assets/images/stones/GLUTTONOUS_WILL-white.png'
        },
        dataAttributes: {}
    },
    ultimateHyperactiveGod: {
        cssClass: 'hyperactive-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/ULTIMATE_HYPERACTIVE_GOD-black.png',
            '-1': 'assets/images/stones/ULTIMATE_HYPERACTIVE_GOD-white.png'
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
    },
    timeStopStone: {
        cssClass: 'time-stop-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: TIME_STOP_STONE_IMAGE_BY_OWNER,
        dataAttributes: {}
    },
    crossBombStone: {
        cssClass: 'cross-bomb-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/X_BOMB-black.png',
            '-1': 'assets/images/stones/X_BOMB-white.png'
        },
        dataAttributes: {}
    },
    xBombStone: {
        cssClass: 'cross-bomb-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/CROSS_BOMB-black.png',
            '-1': 'assets/images/stones/CROSS_BOMB-white.png'
        },
        dataAttributes: {}
    },
    trapStone: {
        cssClass: 'trap-stone',
        cssMethod: 'pseudoElement',
        imagePathByOwner: {
            '1': 'assets/images/stones/trap_stone-black.png',
            '-1': 'assets/images/stones/trap_stone-white.png'
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
    'PROLIFERATION_WILL': 'proliferationStone',
    'ULTIMATE_DESTROY_GOD': 'ultimateDestroyGod',
    'STONE_SALVATION_GOD': 'stoneSalvationGod',
    'SNIPER_WILL': 'sniperStone',
    'LIGHTNING_WILL': 'lightningStone',
    'METEOR_GOD': 'meteorGodStone',
    'GHOST_WILL': 'ghostStone',
    'AFTERIMAGE_WILL': 'afterimageStone',
    'WILL_HUNTER_KING': 'willHunterKingStone',
    'DESTROY_DRAGON_WILL': 'destroyDragonStone',
    'ULTIMATE_HYPERACTIVE_GOD': 'ultimateHyperactiveGod',
    'HYPERACTIVE_WILL': 'hyperactiveStone',
    'EXTREME_HYPERACTIVE_WILL': 'extremeHyperactiveStone',
    'ESCAPE_WILL': 'escapeHyperactiveStone',
    'ROBOT_VACUUM_WILL': 'robotVacuumStone',
    'GLUTTONOUS_WILL': 'gluttonousStone',
    'INSTANT_HYPERACTIVE_WILL': 'hyperactiveStone',
    'REGEN_WILL': 'regenStone',
    'GOLD_STONE': 'goldStone',
    'RAINBOW_STONE': 'rainbowStone',
    'SILVER_STONE': 'silverStone',
    // Ensure WORK pending visuals are applied at placement-time as well
    'WORK_WILL': 'workStone'
    ,
    'TIME_BOMB': 'timeBombStone',
    'TIME_STOP_GOD': 'timeStopStone',
    'CROSS_BOMB': 'crossBombStone',
    'X_BOMB': 'xBombStone',
    'TRAP_WILL': 'trapStone'
};

function getEffectKeyForPendingType(pendingType) {
    return PENDING_TYPE_TO_EFFECT_KEY[pendingType] || null;
}

function normalizeVisualSide(value, fallbackValue) {
    if (value === null || typeof value === 'undefined') {
        return fallbackValue || null;
    }
    const normalized = String(value).trim().toLowerCase();
    if (!normalized) {
        return fallbackValue || null;
    }
    if (normalized === '1' || normalized === 'black' || normalized === 'b') {
        return '1';
    }
    if (normalized === '-1' || normalized === 'white' || normalized === 'w') {
        return '-1';
    }
    return fallbackValue || null;
}

function collectEffectImagePaths(effect) {
    if (!effect || typeof effect !== 'object') {
        return [];
    }
    const paths = [];
    const pushPath = (value) => {
        if (typeof value !== 'string' || !value || paths.includes(value)) {
            return;
        }
        paths.push(value);
    };

    pushPath(effect.imagePath);
    if (effect.imagePathByOwner && typeof effect.imagePathByOwner === 'object') {
        Object.values(effect.imagePathByOwner).forEach(pushPath);
    }
    if (effect.imagePathByPlayer && typeof effect.imagePathByPlayer === 'object') {
        Object.values(effect.imagePathByPlayer).forEach(pushPath);
    }
    return paths;
}

function isNormalStoneImagePath(imagePath) {
    const normalized = String(imagePath || '').toLowerCase();
    if (!normalized) {
        return false;
    }
    return NORMAL_STONE_IMAGE_FILE_KEYS.some((key) => normalized.includes(key));
}

function _pickMappedImagePath(pathMap, preferredKey, fallbackKey) {
    if (!pathMap || typeof pathMap !== 'object') {
        return null;
    }
    if (preferredKey && typeof pathMap[preferredKey] === 'string' && pathMap[preferredKey]) {
        return pathMap[preferredKey];
    }
    if (fallbackKey && typeof pathMap[fallbackKey] === 'string' && pathMap[fallbackKey]) {
        return pathMap[fallbackKey];
    }
    const firstPath = Object.values(pathMap).find((value) => typeof value === 'string' && value);
    return firstPath || null;
}

function resolveEffectImagePath(effect, options = {}) {
    if (!effect || typeof effect !== 'object') {
        return null;
    }
    if (typeof effect.imagePath === 'string' && effect.imagePath) {
        return effect.imagePath;
    }

    const ownerKey = normalizeVisualSide(options.owner, null);
    const fallbackOwnerKey = normalizeVisualSide(options.fallbackOwner, DEFAULT_CARD_VISUAL_SIDE) || DEFAULT_CARD_VISUAL_SIDE;
    const playerKey = normalizeVisualSide(options.player, ownerKey || null);
    const fallbackPlayerKey = normalizeVisualSide(options.fallbackPlayer, fallbackOwnerKey) || fallbackOwnerKey;

    const ownerPath = _pickMappedImagePath(effect.imagePathByOwner, ownerKey, fallbackOwnerKey);
    if (ownerPath) {
        return ownerPath;
    }
    const playerPath = _pickMappedImagePath(effect.imagePathByPlayer, playerKey, fallbackPlayerKey);
    if (playerPath) {
        return playerPath;
    }

    const paths = collectEffectImagePaths(effect);
    return paths.length ? paths[0] : null;
}

function getCardVisualImagePaths(cardType) {
    const effectKey = getEffectKeyForPendingType(cardType);
    if (!effectKey) {
        return [];
    }
    return collectEffectImagePaths(GAME_STONE_VISUAL_EFFECTS[effectKey]);
}

function resolveCardVisualImagePath(cardType, options = {}) {
    const effectKey = getEffectKeyForPendingType(cardType);
    if (!effectKey) {
        return null;
    }
    return resolveEffectImagePath(GAME_STONE_VISUAL_EFFECTS[effectKey], options);
}

function cardTypeUsesNonNormalStoneImage(cardType) {
    const paths = getCardVisualImagePaths(cardType);
    if (!paths.length) {
        return false;
    }
    return paths.some((path) => !isNormalStoneImagePath(path));
}

// Special stone marker type -> visual effect key (used by board renderer)
const SPECIAL_TYPE_TO_EFFECT_KEY = {
    'PROTECTED': 'protectedStoneTemporary',
    'PERMA_PROTECTED': 'protectedStone',
    'DRAGON': 'ultimateDragon',
    'BREEDING': 'breedingStone',
    'PROLIFERATION': 'proliferationStone',
    'ULTIMATE_DESTROY_GOD': 'ultimateDestroyGod',
    'STONE_SALVATION_GOD': 'stoneSalvationGod',
    'SNIPER': 'sniperStone',
    'LIGHTNING': 'lightningStone',
    'METEOR_GOD': 'meteorGodStone',
    'GHOST': 'ghostStone',
    'AFTERIMAGE_WILL': 'afterimageStone',
    'WILL_HUNTER_KING': 'willHunterKingStone',
    'DESTROY_DRAGON': 'destroyDragonStone',
    'ULTIMATE_HYPERACTIVE': 'ultimateHyperactiveGod',
    'HYPERACTIVE': 'hyperactiveStone',
    'EXTREME_HYPERACTIVE': 'extremeHyperactiveStone',
    'ESCAPE_HYPERACTIVE': 'escapeHyperactiveStone',
    'ROBOT_VACUUM': 'robotVacuumStone',
    'GLUTTONOUS': 'gluttonousStone',
    'REGEN': 'regenStone',
    'GOLD': 'goldStone',
    'RAINBOW': 'rainbowStone',
    'SILVER': 'silverStone',
    'WORK': 'workStone'
    ,
    'TIME_BOMB': 'timeBombStone',
    'TIME_STOP': 'timeStopStone',
    'CROSS_BOMB': 'crossBombStone',
    'X_BOMB': 'xBombStone',
    'TRAP': 'trapStone',
    'TRAP_REVEAL': 'trapStone',
    'THEORY_INCARNATION': 'theoryIncarnationStone',
    'BOARD_EXECUTOR': 'boardExecutorStone',
    'OBSERVER_WILL': 'observerWillStone',
    'ABSOLUTE_PROTECTED': 'absoluteProtectedStone'
};

function normalizeStoneVisualDefinitions(map) {
    for (const effect of Object.values(map)) {
        if (!effect || typeof effect !== 'object') continue;
        if (typeof effect.renderMode !== 'string' || !effect.renderMode) {
            effect.renderMode = 'replace';
        }
        const scale = Number(effect.scale);
        effect.scale = (Number.isFinite(scale) && scale > 0) ? scale : 1;
        if (typeof effect.shadowProfile !== 'string' || !effect.shadowProfile) {
            effect.shadowProfile = 'default';
        }
    }
}

normalizeStoneVisualDefinitions(GAME_STONE_VISUAL_EFFECTS);

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
        collectEffectImagePaths,
        resolveEffectImagePath,
        getCardVisualImagePaths,
        resolveCardVisualImagePath,
        isNormalStoneImagePath,
        cardTypeUsesNonNormalStoneImage,
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
        collectEffectImagePaths,
        resolveEffectImagePath,
        getCardVisualImagePaths,
        resolveCardVisualImagePath,
        isNormalStoneImagePath,
        cardTypeUsesNonNormalStoneImage,
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
        const browserGlobal = (typeof globalThis !== 'undefined' && globalThis && globalThis['window'])
            ? globalThis['window']
            : null;
        if (browserGlobal) {
            browserGlobal.GameVisualEffectsMap = mapObj;
            browserGlobal.STONE_VISUAL_EFFECTS = GAME_STONE_VISUAL_EFFECTS;
            browserGlobal.PENDING_TYPE_TO_EFFECT_KEY = PENDING_TYPE_TO_EFFECT_KEY;
            browserGlobal.SPECIAL_TYPE_TO_EFFECT_KEY = SPECIAL_TYPE_TO_EFFECT_KEY;
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
