declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file helpers.js
 * @description Shared helpers for card effects
 */

// Imports replacing globalThis references
const CardSystem = _require('../../card-system');
const ProtectionState = _require('./protection-state');

function requireCardEffectsHelperModuleOrNull(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const VisualEffectsMap: any = requireCardEffectsHelperModuleOrNull('../visual-effects-map');

const {
    getPlayerKey,
    getPlayerDisplayName,
    getOwner,
    getActiveProtectionForCardState
} = ProtectionState;

/**
 * 指定プレイヤーのアクティブな保護石リストを取得
 * @param {number} player - BLACK (1) or WHITE (-1)
 * @returns {Array} 保護石リスト [{row, col, remainingTurns}]
 */
function getActiveProtectionForPlayer(player: number): any[] {
    return getActiveProtectionForCardState(CardSystem.cardState, player);
}

/**
 * Map special stone type to visual effect key
 * @param {string} type - Special stone type
 * @returns {string|null} Effect key for applyStoneVisualEffect
 */
function getEffectKeyForType(type: string): string | null {
    if (VisualEffectsMap && typeof VisualEffectsMap.getEffectKeyForSpecialType === 'function') {
        try {
            return VisualEffectsMap.getEffectKeyForSpecialType(type);
        } catch (e) { /* ignore */ }
    }
    return null;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getPlayerKey,
        getPlayerDisplayName,
        getOwner,
        getActiveProtectionForPlayer,
        getActiveProtectionForCardState,
        getEffectKeyForType
    };
}

export {};
