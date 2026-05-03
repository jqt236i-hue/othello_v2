// @ts-nocheck
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;

/**
 * @file helpers.js
 * @description Shared helpers for card effects
 */

// Imports replacing globalThis references
const { BLACK, WHITE } = _require('../../shared-constants');
const CardSystem = _require('../../card-system');
const MarkersAdapter = (function() {
    try { return _require('../logic/markers_adapter'); } catch (e) { return null; }
})();
const VisualEffectsMap = (function() {
    try { return _require('../visual-effects-map'); } catch (e) { return null; }
})();

const CardEffectsOwnerHelpersModule = (function() {
    try { return _require('../../utils/owner-helpers'); } catch (e) { return null; }
})();

// Map player const to string key
function getPlayerKey(player) {
    try {
        if (CardEffectsOwnerHelpersModule && typeof CardEffectsOwnerHelpersModule.normalizePlayerKey === 'function') {
            return CardEffectsOwnerHelpersModule.normalizePlayerKey(player, 'black');
        }
    } catch (e) { /* ignore */ }
    return player === BLACK ? 'black' : 'white';
}

function getPlayerDisplayName(player) {
    return getPlayerKey(player) === 'black' ? '黒' : '白';
}

function getOwner(player) {
    return getPlayerKey(player) === 'black' ? BLACK : WHITE;
}

/**
 * 指定プレイヤーのアクティブな保護石リストを取得
 * @param {number} player - BLACK (1) or WHITE (-1)
 * @returns {Array} 保護石リスト [{row, col, remainingTurns}]
 */
function getActiveProtectionForPlayer(player) {
    if (!CardSystem.cardState || !CardSystem.cardState.markers) return [];
    const playerKey = getPlayerKey(player);
    const markers = (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(CardSystem.cardState)
        : (CardSystem.cardState.markers || []).filter(m => m.kind === 'specialStone');
    return markers.filter(m =>
        m.owner === playerKey && m.data && m.data.type === 'PROTECTED'
    );
}

/**
 * Map special stone type to visual effect key
 * @param {string} type - Special stone type
 * @returns {string|null} Effect key for applyStoneVisualEffect
 */
function getEffectKeyForType(type) {
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
        getEffectKeyForType
    };
}

// @compat - globalThis writes for legacy browser/script-tag compatibility
if (typeof globalThis !== 'undefined') {
    try { globalThis.getPlayerKey = getPlayerKey; } catch (e) { /* ignore */ }
    try { globalThis.getPlayerDisplayName = getPlayerDisplayName; } catch (e) { /* ignore */ }
    try { globalThis.getOwner = getOwner; } catch (e) { /* ignore */ }
    try { globalThis.getActiveProtectionForPlayer = getActiveProtectionForPlayer; } catch (e) { /* ignore */ }
    try { globalThis.getEffectKeyForType = getEffectKeyForType; } catch (e) { /* ignore */ }
}

export {};
