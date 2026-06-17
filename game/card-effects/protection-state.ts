export {};

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire | null = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : (typeof require !== 'undefined' ? require : null);

function requireCardEffectProtectionModuleOrNull(id: string): any {
    if (!_require) return null;
    try {
        return _require(id);
    } catch (e) {
        return null;
    }
}

const SharedConstants: any = requireCardEffectProtectionModuleOrNull('../../shared-constants') || {};
const MarkersAdapter: any = requireCardEffectProtectionModuleOrNull('../logic/markers_adapter');
const OwnerHelpers: any = requireCardEffectProtectionModuleOrNull('../../utils/owner-helpers');

const BLACK = SharedConstants.BLACK ?? 1;
const WHITE = SharedConstants.WHITE ?? -1;

function getPlayerKey(player: number): string {
    try {
        if (OwnerHelpers && typeof OwnerHelpers.normalizePlayerKey === 'function') {
            return OwnerHelpers.normalizePlayerKey(player, 'black');
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

function getSpecialMarkers(cardState: any): any[] {
    if (!cardState || !cardState.markers) return [];
    if (MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function') {
        const markers = MarkersAdapter.getSpecialMarkers(cardState);
        return Array.isArray(markers) ? markers : [];
    }
    return (cardState.markers || []).filter((marker: any) => marker && marker.kind === 'specialStone');
}

function getActiveProtectionForCardState(cardState: any, player: number): any[] {
    const playerKey = getPlayerKey(player);
    return getSpecialMarkers(cardState).filter((marker: any) =>
        marker.owner === playerKey && marker.data && marker.data.type === 'PROTECTED'
    );
}

module.exports = {
    getPlayerKey,
    getPlayerDisplayName,
    getOwner,
    getActiveProtectionForCardState
};
