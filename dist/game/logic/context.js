"use strict";
/**
 * @file context.ts
 * @description Helper to obtain card-related context for CoreLogic and move generation.
 * Provides a safe fallback when CardLogic is not available (e.g., during early bootstrap or tests).
 */
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
function mapBombMarkers(cardState) {
    if (!cardState)
        return [];
    try {
        const MarkersAdapter = _require('./markers_adapter');
        if (MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function') {
            return MarkersAdapter.getBombMarkers(cardState).map((m) => ({
                row: m.row,
                col: m.col,
                remainingTurns: m.data ? m.data.remainingTurns : undefined,
                owner: m.owner,
                placedTurn: m.data ? m.data.placedTurn : undefined,
                createdSeq: m.createdSeq
            }));
        }
    }
    catch (_e) { /* ignore */ }
    return [];
}
function mapBlockedMarkers(cardState) {
    if (!cardState || !Array.isArray(cardState.markers))
        return [];
    return cardState.markers
        .filter((m) => (m &&
        m.kind === 'specialStone' &&
        m.data &&
        (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE' || m.data.type === 'FREEZE')))
        .map((m) => ({
        row: m.row,
        col: m.col,
        type: m.data ? m.data.type : null,
        remainingOwnerTurns: m.data ? m.data.remainingOwnerTurns : undefined,
        owner: m.owner
    }));
}
function getSafeCardContext(cardState, protectedStones, permaProtectedStones) {
    // Prefer CardLogic when available
    try {
        const cardsImpl = _require('./cards');
        if (cardsImpl && typeof cardsImpl.getCardContext === 'function') {
            return cardsImpl.getCardContext(cardState);
        }
    }
    catch (e) {
        console.warn('[getSafeCardContext] CardLogic.getCardContext threw — falling back to safe context:', e && e.message);
    }
    // Last-resort safe fallback
    return {
        protectedStones: protectedStones || [],
        permaProtectedStones: permaProtectedStones || [],
        bombs: mapBombMarkers(cardState),
        blockedCells: mapBlockedMarkers(cardState)
    };
}
module.exports = {
    getSafeCardContext,
    mapBombMarkers,
    mapBlockedMarkers,
    mapBlockadeMarkers: mapBlockedMarkers
};
//# sourceMappingURL=context.js.map