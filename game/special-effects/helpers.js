/**
 * @file helpers.js
 * @description Shared helpers for special effects
 */

/**
 * Clear all special effects (protection, bombs, dragons) at a specific position
 * Used by DESTROY effect
 * @param {number} row 
 * @param {number} col 
 */
function clearSpecialAt(row, col) {
    // Use local implementation (matches card-effects-applier.js)
    local_clearSpecialAt(row, col);
}

// Monkey-patch generic data cleanup into CardLogic or just implement locally?
// CardLogic doesn't have 'removeSpecialsAt'.
// We'll implement it locally using direct array manipulation for now, 
// matching previous behavior.

function local_clearSpecialAt(row, col) {
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.removeMarkersAt === 'function') {
        MarkersAdapter.removeMarkersAt(cardState, row, col);
        return;
    }
    if (cardState && cardState.markers) {
        cardState.markers = cardState.markers.filter(m => !(m.row === row && m.col === col));
    }
}

function getFlipBlockers() {
    if (!cardState || !cardState.markers) return [];
    const specials = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState)
        : cardState.markers.filter(m => m.kind === 'specialStone');
    return specials
        .filter(s => s.data && (s.data.type === 'PERMA_PROTECTED' || s.data.type === 'DRAGON' || s.data.type === 'BREEDING' || s.data.type === 'ULTIMATE_DESTROY_GOD'))
        .map(s => ({ row: s.row, col: s.col, owner: s.owner }));
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        clearSpecialAt: local_clearSpecialAt,
        getFlipBlockers
    };
}

// Exposing helpers to the browser global object is a UI responsibility. If a consumer needs
// a global helper for debug/visualization, the UI layer should import this module and attach
// functions to the browser global explicitly. This keeps `game/**` free of direct references to browser globals.
if (typeof globalThis !== 'undefined') {
    try { globalThis.getFlipBlockers = getFlipBlockers; } catch (e) { /* ignore */ }
}
