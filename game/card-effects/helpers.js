/**
 * @file helpers.js
 * @description Shared helpers for card effects
 */

// Map player const to string key
function getPlayerKey(player) {
    return player === BLACK ? 'black' : 'white';
}

function getPlayerDisplayName(player) {
    return player === BLACK ? '黒' : '白';
}

function getOwner(player) {
    return player === BLACK ? BLACK : WHITE;
}

/**
 * 指定プレイヤーのアクティブな保護石リストを取得
 * @param {number} player - BLACK (1) or WHITE (-1)
 * @returns {Array} 保護石リスト [{row, col, remainingTurns}]
 */
function getActiveProtectionForPlayer(player) {
    if (!cardState || !cardState.markers) return [];
    const playerKey = player === BLACK ? 'black' : 'white';
    const markers = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState)
        : (cardState.markers || []).filter(m => m.kind === 'specialStone');
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
    try {
        if (typeof require === 'function') {
            const mod = require('../visual-effects-map');
            if (mod && typeof mod.getEffectKeyForSpecialType === 'function') {
                return mod.getEffectKeyForSpecialType(type);
            }
        }
    } catch (e) { /* ignore */ }
    try {
        if (
            typeof globalThis !== 'undefined' &&
            globalThis.GameVisualEffectsMap &&
            typeof globalThis.GameVisualEffectsMap.getEffectKeyForSpecialType === 'function'
        ) {
            return globalThis.GameVisualEffectsMap.getEffectKeyForSpecialType(type);
        }
    } catch (e) { /* ignore */ }
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
