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

function requireCardEffectsHelperModuleOrNull(id: string): any {
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const MarkersAdapter: any = requireCardEffectsHelperModuleOrNull('../logic/markers_adapter');
const VisualEffectsMap: any = requireCardEffectsHelperModuleOrNull('../visual-effects-map');
const CardEffectsOwnerHelpersModule: any = requireCardEffectsHelperModuleOrNull('../../utils/owner-helpers');

// Map player const to string key
function getPlayerKey(player: number): string {
    try {
        if (CardEffectsOwnerHelpersModule && typeof CardEffectsOwnerHelpersModule.normalizePlayerKey === 'function') {
            return CardEffectsOwnerHelpersModule.normalizePlayerKey(player, 'black');
        }
    } catch (e) { /* ignore */ }
    return player === BLACK ? 'black' : 'white';
}

function getPlayerDisplayName(player: number): string {
    return getPlayerKey(player) === 'black' ? '黒' : '白';
}

function getOwner(player: number): number {
    return getPlayerKey(player) === 'black' ? BLACK : WHITE;
}

/**
 * 指定プレイヤーのアクティブな保護石リストを取得
 * @param {number} player - BLACK (1) or WHITE (-1)
 * @returns {Array} 保護石リスト [{row, col, remainingTurns}]
 */
function getActiveProtectionForPlayer(player: number): any[] {
    if (!CardSystem.cardState || !CardSystem.cardState.markers) return [];
    const playerKey = getPlayerKey(player);
    const markers: any[] = (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(CardSystem.cardState)
        : (CardSystem.cardState.markers || []).filter((m: any) => m.kind === 'specialStone');
    return markers.filter((m: any) =>
        m.owner === playerKey && m.data && m.data.type === 'PROTECTED'
    );
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
        getEffectKeyForType
    };
}

export {};
