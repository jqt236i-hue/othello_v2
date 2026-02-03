// ===== UI Element Cache =====
// Centralized cache of frequently accessed DOM elements to avoid repeated getElementById calls

let elementCache = {
    // Board and display
    board: null,
    boardFrame: null,
    
    // Decks and hands
    deckBlack: null,
    deckWhite: null,
    handBlack: null,
    handWhite: null,
    
    // Charge display
    chargeBlack: null,
    chargeWhite: null,
    
    // Log
    log: null,
    
    // Animation layers
    handLayer: null,
    handWrapper: null,
    heldStone: null,
    cardFxLayer: null,
    handSvg: null,
    
    // CPU character
    cpuCharacterImg: null,
    cpuLevelLabel: null,
    
    // Control buttons
    resetBtn: null,
    muteBtn: null,
    autoToggleBtn: null,
    debugModeBtn: null,
    
    // Sound controls
    seTypeSelect: null,
    seVolSlider: null,
    bgmPlayBtn: null,
    bgmPauseBtn: null,
    bgmTrackSelect: null,
    bgmVolSlider: null,
    
    // AI difficulty controls
    smartBlack: null,
    smartWhite: null,
    
    // Card controls
    useCardBtn: null,
    cancelCardBtn: null,
    cardDetailName: null,
    cardDetailDesc: null,
    useCardReason: null,
    
    // Discard display
    discardCount: null,
    
    // Active effects
    activeBlack: null,
    activeWhite: null,
    
    // Recent cards
    recentCardBlackName: null,
    recentCardBlackDesc: null,
    recentCardWhiteName: null,
    recentCardWhiteDesc: null,
    
    // Occupancy display (if it exists)
    occBlack: null,
    occWhite: null
};

/**
 * Initialize the element cache by querying all elements once
 * Call this function during UI initialization
 */
function initializeElementCache() {
    const idMap = {
        board: 'board',
        boardFrame: 'board-frame',
        deckBlack: 'deck-black',
        deckWhite: 'deck-white',
        handBlack: 'hand-black',
        handWhite: 'hand-white',
        chargeBlack: 'charge-black',
        chargeWhite: 'charge-white',
        log: 'log',
        handLayer: 'handLayer',
        handWrapper: 'handWrapper',
        heldStone: 'heldStone',
        cardFxLayer: 'card-fx-layer',
        handSvg: 'handSvg',
        cpuCharacterImg: 'cpu-character-img',
        cpuLevelLabel: 'cpu-level-label',
        resetBtn: 'resetBtn',
        muteBtn: 'muteBtn',
        debugModeBtn: 'debugModeBtn',
        seTypeSelect: 'seTypeSelect',
        seVolSlider: 'seVolSlider',
        bgmPlayBtn: 'bgmPlayBtn',
        bgmPauseBtn: 'bgmPauseBtn',
        bgmTrackSelect: 'bgmTrackSelect',
        bgmVolSlider: 'bgmVolSlider',
        smartBlack: 'smartBlack',
        smartWhite: 'smartWhite',
        useCardBtn: 'use-card-btn',
        cancelCardBtn: 'cancel-card-btn',
        cardDetailName: 'card-detail-name',
        cardDetailDesc: 'card-detail-desc',
        useCardReason: 'use-card-reason',
        discardCount: 'discard-count',
        activeBlack: 'active-black',
        activeWhite: 'active-white',
        recentCardBlackName: 'recent-card-black-name',
        recentCardBlackDesc: 'recent-card-black-desc',
        recentCardWhiteName: 'recent-card-white-name',
        recentCardWhiteDesc: 'recent-card-white-desc',
        occBlack: 'occ-black',
        occWhite: 'occ-white'
    };
    
    for (const [key, id] of Object.entries(idMap)) {
        elementCache[key] = document.getElementById(id);
    }
}

/**
 * Get a cached element by key
 * @param {string} key - The element key (e.g., 'board', 'deckBlack')
 * @returns {Element|null} The cached element or null if not found
 */
function getElement(key) {
    if (!elementCache[key]) {
        // Lazy load if not cached
        const idMap = {
            board: 'board',
            boardFrame: 'board-frame',
            deckBlack: 'deck-black',
            deckWhite: 'deck-white',
            handBlack: 'hand-black',
            handWhite: 'hand-white',
            chargeBlack: 'charge-black',
            chargeWhite: 'charge-white',
            log: 'log',
            handLayer: 'handLayer',
            handWrapper: 'handWrapper',
            heldStone: 'heldStone',
            cardFxLayer: 'card-fx-layer',
            handSvg: 'handSvg',
            cpuCharacterImg: 'cpu-character-img',
            cpuLevelLabel: 'cpu-level-label'
        };
        const id = idMap[key];
        if (id) {
            elementCache[key] = document.getElementById(id);
        }
    }
    return elementCache[key];
}

/**
 * Clear the cache (useful for testing or DOM resets)
 */
function clearElementCache() {
    for (const key in elementCache) {
        elementCache[key] = null;
    }
}
