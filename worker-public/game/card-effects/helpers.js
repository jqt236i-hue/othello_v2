/**
 * @file helpers.js
 * @description Shared helpers for card effects
 */

let CardEffectsOwnerHelpersModule = null;
if (typeof require === 'function') {
    try { CardEffectsOwnerHelpersModule = require('../../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!CardEffectsOwnerHelpersModule && typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) {
    CardEffectsOwnerHelpersModule = globalThis.OwnerHelpers;
}

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
    if (!cardState || !cardState.markers) return [];
    const playerKey = getPlayerKey(player);
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

if (typeof globalThis !== 'undefined') {
    try { globalThis.getPlayerKey = getPlayerKey; } catch (e) { /* ignore */ }
    try { globalThis.getPlayerDisplayName = getPlayerDisplayName; } catch (e) { /* ignore */ }
    try { globalThis.getOwner = getOwner; } catch (e) { /* ignore */ }
    try { globalThis.getActiveProtectionForPlayer = getActiveProtectionForPlayer; } catch (e) { /* ignore */ }
    try { globalThis.getEffectKeyForType = getEffectKeyForType; } catch (e) { /* ignore */ }
}
