"use strict";
/**
 * @file marker-bridge.ts
 * @description UI-side adapter to derive legacy specialStones/bombs from markers.
 */
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function ensureLegacyMarkers(cardState) {
    if (!cardState || !Array.isArray(cardState.markers))
        return;
    if (typeof MarkersAdapter === 'undefined' || !MarkersAdapter)
        return;
    if (typeof MarkersAdapter.markersToSpecialStones === 'function') {
        cardState.specialStones = MarkersAdapter.markersToSpecialStones(cardState.markers);
    }
    if (typeof MarkersAdapter.markersToBombs === 'function') {
        cardState.bombs = MarkersAdapter.markersToBombs(cardState.markers);
    }
}
if (typeof window !== 'undefined') {
    window.ensureLegacyMarkers = ensureLegacyMarkers;
}
module.exports = {
    ensureLegacyMarkers
};
//# sourceMappingURL=marker-bridge.js.map