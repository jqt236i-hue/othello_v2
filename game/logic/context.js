/**
 * @file context.js
 * @description Helper to obtain card-related context for CoreLogic and move generation.
 * Provides a safe fallback when CardLogic is not available (e.g., during early bootstrap or tests).
 */

function mapBombMarkers(cardState) {
    if (!cardState) return [];
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function') {
        return MarkersAdapter.getBombMarkers(cardState).map(m => ({
            row: m.row,
            col: m.col,
            remainingTurns: m.data ? m.data.remainingTurns : undefined,
            owner: m.owner,
            placedTurn: m.data ? m.data.placedTurn : undefined,
            createdSeq: m.createdSeq
        }));
    }
    return [];
}

function getSafeCardContext(cardState, protectedStones, permaProtectedStones) {
    // Prefer CardLogic when available
    if (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getCardContext === 'function') {
        try {
            return CardLogic.getCardContext(cardState);
        } catch (e) {
            console.warn('[getSafeCardContext] CardLogic.getCardContext threw — falling back to safe context:', e && e.message);
        }
    }

    // Try requiring the local game logic implementation
    if (typeof require === 'function') {
        try {
            const cardsImpl = require('./cards');
            if (cardsImpl && typeof cardsImpl.getCardContext === 'function') {
                return cardsImpl.getCardContext(cardState);
            }
        } catch (e) { /* ignore */ }
    }

    // Last-resort safe fallback
    return {
        protectedStones: protectedStones || [],
        permaProtectedStones: permaProtectedStones || [],
        bombs: mapBombMarkers(cardState)
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getSafeCardContext, mapBombMarkers };
}
