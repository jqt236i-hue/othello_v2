/**
 * Minimal AISystem (game/ai/level-system.js)
 * Purpose: Provide a simple, deterministic AISystem implementation so that the
 * game can rely on `AISystem` being present in normal http-server runs.
 *
 * This is intentionally small and self-contained: it picks the first legal move
 * and does not mutate UI or rule state.
 */
(function (root) {
    const AISystem = {
        selectMove(gameState, cardState, candidateMoves, level = 1, ctx = null) {
            if (!candidateMoves || !candidateMoves.length) return null;
            // deterministic: choose first candidate move
            return candidateMoves[0];
        },
        selectCardToUse(cardState, gameState, playerKey, level, legalMoves, ctx) {
            // default: do not use a card
            return null;
        }
    };

    // Expose to global (browser) for script-tag builds
    try { if (typeof root !== 'undefined' && typeof root.AISystem === 'undefined') root.AISystem = AISystem; } catch (e) { /* ignore */ }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AISystem;
    }
})(typeof self !== 'undefined' ? self : this);
