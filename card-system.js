// ===== Card System (Phase 3) =====
// Uses shared CardLogic for state management and core operations
// Uses SeededPRNG for deterministic game initialization

if (typeof CardLogic === 'undefined') {
    console.error('CardLogic is not loaded. Please include game/logic/cards.js');
}

// Global card state container (reference stable)
let cardState = {};

// Animation flag
let isCardAnimating = false;

// Global PRNG for deterministic game - seeded at game start
let gamePrng = null;

/**
 * Initialize or reset the game PRNG with a seed.
 * @param {number} [seed] - Optional seed. If omitted, uses current time.
 */
function initGamePrng(seed) {
    // For online/replay determinism, do NOT fall back to Math.random.
    // SeededPRNG must be loaded (index.html includes game/schema/prng.js).
    if (typeof SeededPRNG === 'undefined' || !SeededPRNG || typeof SeededPRNG.createPRNG !== 'function') {
        throw new Error('[CardSystem] SeededPRNG is required but not available');
    }

    gamePrng = SeededPRNG.createPRNG(seed !== undefined ? seed : Date.now());
    console.log('[CardSystem] PRNG initialized with seed:', gamePrng._seed);
}

/**
 * Get the current game PRNG (for injection into CardLogic)
 */
function getGamePrng() {
    if (!gamePrng) {
        initGamePrng();
    }
    return gamePrng;
}

// ===== Card State Management =====

function initCardState(seed) {
    // Initialize PRNG if not already done
    initGamePrng(seed);

    const prng = getGamePrng();
    const newState = CardLogic.createCardState(prng);

    // Wipe and copy properties to maintain global reference
    for (const key in cardState) delete cardState[key];
    Object.assign(cardState, newState);

    console.log('🎴 Deck initialized with', cardState.deck.length, 'cards');
    // For browser test harness: prefer UIBootstrap registration for exposing cardState; fallback to globalThis for legacy
    try {
        const uiBootstrap = require('./ui/bootstrap');
        if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
            uiBootstrap.registerUIGlobals({ cardState });
        }
    } catch (e) { /* ignore */ }
    try { if (typeof globalThis !== 'undefined') globalThis.cardState = cardState; } catch (e) {}
}

// Exports for CommonJS (tests)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initCardState,
        commitDraw,
        drawCard,
        getCardState: () => cardState
    };
}

function commitDraw(player) {
    const playerKey = player === BLACK ? 'black' : 'white';
    const prng = getGamePrng();

    // Check deck state before draw for logging
    const wasDeckEmpty = cardState.deck.length === 0;
    const wasDiscardEmpty = cardState.discard.length === 0;

    const cardId = CardLogic.commitDraw(cardState, playerKey, prng);

    if (cardId === null && wasDeckEmpty && wasDiscardEmpty) {
        addLog('山札・捨て札が空のためドローなし');
    }

    return cardId;
}

function drawCard(player) {
    return commitDraw(player);
}
