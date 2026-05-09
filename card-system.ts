// ===== Card System (Phase 3) =====
// Uses shared CardLogic for state management and core operations
// Uses SeededPRNG for deterministic game initialization

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;


try {
    if (typeof window !== 'undefined' && typeof (window as any).CardLogic === 'undefined') {
        console.error('CardLogic is not loaded. Please include game/logic/cards.js');
    }
} catch (e) {
    // window not available in Node.js/test environment
}

// Global card state container (reference stable)
export let cardState: any = {};

// Animation flag
export let isCardAnimating = false;

// Global PRNG for deterministic game - seeded at game start
export let gamePrng: any = null;

/**
 * Initialize or reset the game PRNG with a seed.
 * @param {number} [seed] - Optional seed. If omitted, uses current time.
 */
export function initGamePrng(seed?: number) {
    // For online/replay determinism, do NOT fall back to Math.random.
    // SeededPRNG must be loaded (index.html includes game/schema/prng.js).
    if (typeof (window as any).SeededPRNG === 'undefined' || !(window as any).SeededPRNG || typeof (window as any).SeededPRNG.createPRNG !== 'function') {
        throw new Error('[CardSystem] SeededPRNG is required but not available');
    }

    gamePrng = (window as any).SeededPRNG.createPRNG(seed !== undefined ? seed : Date.now());
    console.log('[CardSystem] PRNG initialized with seed:', gamePrng._seed);
}

/**
 * Get the current game PRNG (for injection into CardLogic)
 */
export function getGamePrng() {
    if (!gamePrng) {
        initGamePrng();
    }
    return gamePrng;
}

// ===== Card State Management =====

function normalizeInitCardStateArgs(seedOrOptions?: any, maybeOptions?: any) {
    const firstLooksLikeOptions = !!(
        seedOrOptions
        && typeof seedOrOptions === 'object'
        && !Array.isArray(seedOrOptions)
        && typeof maybeOptions === 'undefined'
    );

    return {
        seed: firstLooksLikeOptions ? undefined : seedOrOptions,
        options: firstLooksLikeOptions
            ? seedOrOptions
            : ((maybeOptions && typeof maybeOptions === 'object') ? maybeOptions : undefined)
    };
}

export function initCardState(seedOrOptions?: any, maybeOptions?: any) {
    const normalizedArgs = normalizeInitCardStateArgs(seedOrOptions, maybeOptions);

    // Initialize PRNG if not already done
    initGamePrng(normalizedArgs.seed);

    const prng = getGamePrng();
    const newState = (window as any).CardLogic.createCardState(prng, normalizedArgs.options);

    // Wipe and copy properties to maintain global reference
    for (const key in cardState) delete (cardState as any)[key];
    Object.assign(cardState, newState);

    const blackDeckCount = (cardState.decks && Array.isArray(cardState.decks.black)) ? cardState.decks.black.length : (Array.isArray(cardState.deck) ? cardState.deck.length : 0);
    const whiteDeckCount = (cardState.decks && Array.isArray(cardState.decks.white)) ? cardState.decks.white.length : (Array.isArray(cardState.deck) ? cardState.deck.length : 0);
    console.log('🎴 Deck initialized with', `black=${blackDeckCount}, white=${whiteDeckCount}`);
    // For browser test harness: expose cardState on global scope when available
    if (typeof globalThis !== 'undefined') (globalThis as any).cardState = cardState;
}

export function commitDraw(player: any) {
    const playerKey = player === (window as any).BLACK ? 'black' : 'white';
    const prng = getGamePrng();
    const playerDeck = (cardState.decks && Array.isArray(cardState.decks[playerKey]))
        ? cardState.decks[playerKey]
        : (Array.isArray(cardState.deck) ? cardState.deck : []);

    // Check deck state before draw for logging
    const wasDeckEmpty = playerDeck.length === 0;

    const cardId = (window as any).CardLogic.commitDraw(cardState, playerKey, prng);

    if (cardId === null && wasDeckEmpty) {
        (window as any).addLog(`${playerKey === 'black' ? '黒' : '白'}の山札が空のためドローなし`);
    }

    return cardId;
}

export function drawCard(player: any) {
    return commitDraw(player);
}

export function getCardState() {
    return cardState;
}

export default {
    initCardState,
    commitDraw,
    drawCard,
    getCardState,
    initGamePrng,
    getGamePrng,
    cardState,
    isCardAnimating,
    gamePrng
};
