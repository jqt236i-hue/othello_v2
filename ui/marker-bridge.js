/**
 * @file marker-bridge.js
 * @description UI-side adapter to derive legacy specialStones/bombs from markers.
 */

(function () {
    'use strict';

    function ensureLegacyMarkers(cardState) {
        if (!cardState || !Array.isArray(cardState.markers)) return;
        if (typeof MarkersAdapter === 'undefined' || !MarkersAdapter) return;
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
})();
