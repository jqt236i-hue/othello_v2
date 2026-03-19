// ===== Card Rendering =====

var PlaybackStateModule = null;
if (typeof require === 'function') {
    try { PlaybackStateModule = require('../ui/playback-state-manager'); } catch (e) { /* ignore */ }
}
if (!PlaybackStateModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager) PlaybackStateModule = globalThis.PlaybackStateManager;
    } catch (e) { /* ignore */ }
}

function getCardCostTier(cost) {
    const safeCost = Number.isFinite(cost) ? cost : 0;
    if (safeCost === 0) return 'white';
    if (safeCost >= 31) return 'special';
    if (safeCost >= 21) return 'gold';
    if (safeCost >= 16) return 'purple';
    if (safeCost >= 11) return 'blue';
    if (safeCost >= 6) return 'red';
    return 'gray';
}

var _lastChargeForDelta = { black: null, white: null, turnIndex: null };

function _resolveChargeMaxForRender() {
    try {
        if (typeof CHARGE_MAX !== 'undefined' && Number.isFinite(Number(CHARGE_MAX))) {
            return Number(CHARGE_MAX);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && Number.isFinite(Number(window.CHARGE_MAX))) {
            return Number(window.CHARGE_MAX);
        }
    } catch (e) { /* ignore */ }
    return 99;
}

function _getCurrentMatchMode() {
    try {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.getCurrentMatchMode === 'function') {
            return OwnerHelpers.getCurrentMatchMode(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function') {
            return window.getCurrentMatchMode();
        }
        if (typeof window !== 'undefined' && window.MATCH_MODE) {
            return String(window.MATCH_MODE);
        }
    } catch (e) { /* ignore */ }
    return 'cpu';
}

function _getLocalPlayerKeyForNetwork() {
    try {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.resolveLocalPlayerKey === 'function') {
            return OwnerHelpers.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            if (window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
                const seatKey = window.NetworkMatchClient.getSeatKey();
                if (seatKey === 'white' || seatKey === 'black') return seatKey;
            }
            const directKeys = [window.LOCAL_PLAYER_KEY, window.__LOCAL_PLAYER_KEY, window.BOARD_VIEWER_KEY];
            for (const key of directKeys) {
                if (key === 'white' || key === 'black') return key;
            }
        }
    } catch (e) { /* ignore */ }
    return 'black';
}

function _resolveCardRendererGameState() {
    try {
        if (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object') return gameState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.gameState && typeof window.gameState === 'object') return window.gameState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.gameState && typeof globalThis.gameState === 'object') return globalThis.gameState;
    } catch (e) { /* ignore */ }
    return null;
}

function _resolveCardRendererCardState() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.cardState && typeof globalThis.cardState === 'object') return globalThis.cardState;
    } catch (e) { /* ignore */ }
    return null;
}

function _getCardRendererPlaybackStaleMs() {
    try {
        if (typeof window !== 'undefined') {
            const ms = Number(window.PASS_STALE_PLAYBACK_MS);
            if (Number.isFinite(ms) && ms > 0) return ms;
        }
    } catch (e) { /* ignore */ }
    return 3500;
}

function _isStaleVisualPlaybackLockForRender() {
    try {
        if (!_isVisualPlaybackActiveForRender()) return false;
        if (typeof window !== 'undefined' && window.AnimationEngine && typeof window.AnimationEngine.isPlaying === 'boolean') {
            return window.AnimationEngine.isPlaying !== true;
        }
        const startedAt = _getPlaybackStartedAtForRender();
        if (Number.isFinite(startedAt)) {
            return (Date.now() - startedAt) > _getCardRendererPlaybackStaleMs();
        }
    } catch (e) { /* ignore */ }
    return false;
}

function _isVisualPlaybackActiveForRender() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return (typeof window !== 'undefined' && window.VisualPlaybackActive === true);
}

function _getPlaybackStartedAtForRender() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackStartedAt === 'function') {
        return PlaybackStateModule.getPlaybackStartedAt();
    }
    if (typeof window === 'undefined') return null;
    const startedAt = Number(window.__playbackActiveSince);
    return Number.isFinite(startedAt) ? startedAt : null;
}

function _isCardAnimatingForRender() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getCardAnimating === 'function') {
        return PlaybackStateModule.getCardAnimating() === true;
    }
    return (
        (typeof isCardAnimating !== 'undefined' && !!isCardAnimating) ||
        (typeof window !== 'undefined' && !!window.isCardAnimating) ||
        _isVisualPlaybackActiveForRender()
    );
}


function _isHiddenHandTokenForRender(cardId) {
    try {
        if (typeof OwnerHelpers !== 'undefined' && OwnerHelpers && typeof OwnerHelpers.isHiddenHandToken === 'function') {
            return OwnerHelpers.isHiddenHandToken(cardId);
        }
    } catch (e) { /* ignore */ }
    return typeof cardId === 'string' && /^__hidden_hand__:(black|white):(\d+)$/.test(cardId);
}

function _createHiddenHandCardElement(cardId, ownerKey) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item hidden';
    cardEl.dataset.cardId = cardId;
    cardEl.dataset.ownerKey = ownerKey;
    cardEl.textContent = 'CARD';
    return cardEl;
}
function _refreshDebugHandLayoutIfNeeded() {
    try {
        if (typeof require === 'function') {
            const uiBootstrap = require('../ui/bootstrap');
            if (uiBootstrap && typeof uiBootstrap.getRegisteredUIGlobals === 'function') {
                const globals = uiBootstrap.getRegisteredUIGlobals() || {};
                if (typeof globals.refreshDebugHandLayout === 'function') {
                    globals.refreshDebugHandLayout();
                    return;
                }
            }
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof window.refreshDebugHandLayout === 'function') {
            window.refreshDebugHandLayout();
        }
    } catch (e) { /* ignore */ }
}

function createCardFaceElement(cardId) {
    const cardDef = CARD_DEFS.find(c => c.id === cardId);
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item visible';

    const cost = cardDef ? (cardDef.cost || 0) : 0;
    const costTier = getCardCostTier(cost);
    const tierClass = `cost-tier-${costTier}`;
    cardEl.classList.add(tierClass);

    const nameSpan = document.createElement('span');
    nameSpan.className = 'card-name';
    nameSpan.textContent = cardDef ? cardDef.name : '?';
    cardEl.appendChild(nameSpan);

    const costBadge = document.createElement('div');
    costBadge.className = 'card-cost-badge';
    costBadge.classList.add(tierClass);
    costBadge.textContent = `コスト${cost}`;
    cardEl.appendChild(costBadge);

    cardEl.dataset.cardId = cardId;
    return cardEl;
}

function _normalizeCardStateForRender(state) {
    if (!state || typeof state !== 'object') return null;

    if (!state.charge || typeof state.charge !== 'object') state.charge = {};
    state.charge.black = Number.isFinite(Number(state.charge.black)) ? Number(state.charge.black) : 0;
    state.charge.white = Number.isFinite(Number(state.charge.white)) ? Number(state.charge.white) : 0;

    if (!state.hands || typeof state.hands !== 'object') state.hands = {};
    if (!Array.isArray(state.hands.black)) state.hands.black = [];
    if (!Array.isArray(state.hands.white)) state.hands.white = [];

    if (!state.decks || typeof state.decks !== 'object') state.decks = {};
    if (!Array.isArray(state.decks.black)) state.decks.black = [];
    if (!Array.isArray(state.decks.white)) state.decks.white = [];

    if (!Array.isArray(state.discard)) state.discard = [];
    if (!Array.isArray(state.chargeDeltaEvents)) state.chargeDeltaEvents = [];

    if (!state.pendingEffectByPlayer || typeof state.pendingEffectByPlayer !== 'object') {
        state.pendingEffectByPlayer = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.pendingEffectByPlayer, 'black')) state.pendingEffectByPlayer.black = null;
    if (!Object.prototype.hasOwnProperty.call(state.pendingEffectByPlayer, 'white')) state.pendingEffectByPlayer.white = null;

    if (!state.hasUsedCardThisTurnByPlayer || typeof state.hasUsedCardThisTurnByPlayer !== 'object') {
        state.hasUsedCardThisTurnByPlayer = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.hasUsedCardThisTurnByPlayer, 'black')) state.hasUsedCardThisTurnByPlayer.black = false;
    if (!Object.prototype.hasOwnProperty.call(state.hasUsedCardThisTurnByPlayer, 'white')) state.hasUsedCardThisTurnByPlayer.white = false;

    if (!state.hasDestroyedCardThisTurnByPlayer || typeof state.hasDestroyedCardThisTurnByPlayer !== 'object') {
        state.hasDestroyedCardThisTurnByPlayer = {};
    }
    if (!Object.prototype.hasOwnProperty.call(state.hasDestroyedCardThisTurnByPlayer, 'black')) state.hasDestroyedCardThisTurnByPlayer.black = false;
    if (!Object.prototype.hasOwnProperty.call(state.hasDestroyedCardThisTurnByPlayer, 'white')) state.hasDestroyedCardThisTurnByPlayer.white = false;

    if (!state.activeEffectsByPlayer || typeof state.activeEffectsByPlayer !== 'object') {
        state.activeEffectsByPlayer = {};
    }
    if (!Array.isArray(state.activeEffectsByPlayer.black)) state.activeEffectsByPlayer.black = [];
    if (!Array.isArray(state.activeEffectsByPlayer.white)) state.activeEffectsByPlayer.white = [];

    return state;
}

function consumeChargeDeltaEvents(cardState, chargeDeltaHandler) {
    if (!cardState || !Array.isArray(cardState.chargeDeltaEvents) || cardState.chargeDeltaEvents.length === 0) {
        return false;
    }
    const events = cardState.chargeDeltaEvents
        .filter((ev) => ev && Number.isFinite(Number(ev.delta)) && Number(ev.delta) !== 0)
        .sort((a, b) => {
            const sa = Number(a.seq || 0);
            const sb = Number(b.seq || 0);
            return sa - sb;
        });

    cardState.chargeDeltaEvents.length = 0;
    if (!chargeDeltaHandler || events.length === 0) return events.length > 0;

    const totalsByPlayer = { black: 0, white: 0 };
    const playerOrder = [];
    for (const ev of events) {
        const player = (ev.player === 'white' || ev.player === -1 || ev.player === '-1') ? 'white' : 'black';
        if (totalsByPlayer[player] === 0) playerOrder.push(player);
        totalsByPlayer[player] += Number(ev.delta);
    }
    for (const player of playerOrder) {
        const totalDelta = Number(totalsByPlayer[player] || 0);
        if (totalDelta !== 0) {
            chargeDeltaHandler(player, totalDelta);
        }
    }
    return true;
}

function renderCardUI() {
    const gameState = _resolveCardRendererGameState();
    const cardState = _normalizeCardStateForRender(_resolveCardRendererCardState());
    if (!gameState || !Array.isArray(gameState.board) || gameState.board.length !== 8 || !cardState) {
        return;
    }

    // Get elements
    const deckBlackEl = document.getElementById('deck-black');
    const deckWhiteEl = document.getElementById('deck-white');
    const handBlackEl = document.getElementById('hand-black');
    const handWhiteEl = document.getElementById('hand-white');

    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const matchMode = _getCurrentMatchMode();
    const isNetworkMode = matchMode === 'network';
    const localPlayerKey = isNetworkMode ? _getLocalPlayerKeyForNetwork() : null;
    const bottomOwnerKey = isNetworkMode
        ? localPlayerKey
        : 'black';
    const topOwnerKey = bottomOwnerKey === 'black' ? 'white' : 'black';

    if (deckBlackEl) deckBlackEl.dataset.ownerKey = bottomOwnerKey;
    if (deckWhiteEl) deckWhiteEl.dataset.ownerKey = topOwnerKey;

    // Update charge display
    const chargeBlackEl = document.getElementById('charge-black');
    const chargeWhiteEl = document.getElementById('charge-white');
    const chargeMax = _resolveChargeMaxForRender();
    if (chargeBlackEl) {
        chargeBlackEl.textContent = `布石: ${cardState.charge[bottomOwnerKey] || 0} / ${chargeMax}`;
    }
    if (chargeWhiteEl) {
        chargeWhiteEl.textContent = `布石: ${cardState.charge[topOwnerKey] || 0} / ${chargeMax}`;
    }

    const baseChargeDeltaHandler = (typeof window !== 'undefined' && window.StoneVisuals && typeof window.StoneVisuals.showChargeDelta === 'function')
        ? window.StoneVisuals.showChargeDelta
        : null;
    const chargeDeltaHandler = baseChargeDeltaHandler
        ? (playerKey, delta) => {
            const ownerKey = (playerKey === 'white' || playerKey === -1 || playerKey === '-1') ? 'white' : 'black';
            const slotKey = ownerKey === bottomOwnerKey ? 'black' : 'white';
            baseChargeDeltaHandler(slotKey, delta);
        }
        : null;
    const chargeState = (cardState && cardState.charge) ? cardState.charge : { black: 0, white: 0 };
    const currentBlackCharge = Number.isFinite(chargeState.black) ? chargeState.black : Number(chargeState.black || 0);
    const currentWhiteCharge = Number.isFinite(chargeState.white) ? chargeState.white : Number(chargeState.white || 0);
    const currentTurnIndex = (cardState && typeof cardState.turnIndex === 'number') ? cardState.turnIndex : null;

    if (currentTurnIndex !== null && _lastChargeForDelta.turnIndex !== null && currentTurnIndex < _lastChargeForDelta.turnIndex) {
        _lastChargeForDelta.black = null;
        _lastChargeForDelta.white = null;
    }
    if (currentTurnIndex === 0 && _lastChargeForDelta.turnIndex !== 0) {
        _lastChargeForDelta.black = null;
        _lastChargeForDelta.white = null;
    }

    const consumedQueue = consumeChargeDeltaEvents(cardState, chargeDeltaHandler);

    if (!consumedQueue) {
        if (_lastChargeForDelta.black !== null) {
            const deltaBlack = currentBlackCharge - _lastChargeForDelta.black;
            if (deltaBlack !== 0 && chargeDeltaHandler) chargeDeltaHandler('black', deltaBlack);
        }
        if (_lastChargeForDelta.white !== null) {
            const deltaWhite = currentWhiteCharge - _lastChargeForDelta.white;
            if (deltaWhite !== 0 && chargeDeltaHandler) chargeDeltaHandler('white', deltaWhite);
        }
    }

    _lastChargeForDelta.black = currentBlackCharge;
    _lastChargeForDelta.white = currentWhiteCharge;
    _lastChargeForDelta.turnIndex = currentTurnIndex;
    const decks = (cardState && cardState.decks && typeof cardState.decks === 'object') ? cardState.decks : null;
    const deckCountBlack = (decks && Array.isArray(decks.black))
        ? decks.black.length
        : (Array.isArray(cardState.deck) ? cardState.deck.length : 0);
    const deckCountWhite = (decks && Array.isArray(decks.white))
        ? decks.white.length
        : (Array.isArray(cardState.deck) ? cardState.deck.length : 0);
    const initialByPlayer = (cardState && cardState.initialDeckSizeByPlayer && typeof cardState.initialDeckSizeByPlayer === 'object')
        ? cardState.initialDeckSizeByPlayer
        : null;
    const totalBlack = Number.isFinite(initialByPlayer && initialByPlayer.black)
        ? initialByPlayer.black
        : (Number.isFinite(cardState.initialDeckSize) ? cardState.initialDeckSize : 30);
    const totalWhite = Number.isFinite(initialByPlayer && initialByPlayer.white)
        ? initialByPlayer.white
        : (Number.isFinite(cardState.initialDeckSize) ? cardState.initialDeckSize : 30);
    const deckRatioBlack = Math.max(0, Math.min(1, deckCountBlack / Math.max(1, totalBlack)));
    const deckRatioWhite = Math.max(0, Math.min(1, deckCountWhite / Math.max(1, totalWhite)));

    // Set visuals for Black deck
    if (deckBlackEl) {
        deckBlackEl.style.setProperty('--deck-ratio', deckRatioBlack);
        const countLabel = deckBlackEl.querySelector('.deck-count');
        if (countLabel) countLabel.textContent = `${deckCountBlack}/${totalBlack}`;
    }

    // Set visuals for White deck
    if (deckWhiteEl) {
        deckWhiteEl.style.setProperty('--deck-ratio', deckRatioWhite);
        const countLabel = deckWhiteEl.querySelector('.deck-count');
        if (countLabel) countLabel.textContent = `${deckCountWhite}/${totalWhite}`;
    }

    const isBlackTurn = gameState.currentPlayer === BLACK;
    const isAnimating = _isCardAnimatingForRender();
    const staleVisualPlaybackLock = _isStaleVisualPlaybackLockForRender();
    const isDebugUnlimited = (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true);
    const inputPlayerKey = isNetworkMode
        ? localPlayerKey
        : (isDebugHvH ? (isBlackTurn ? 'black' : 'white') : 'black');
    const pending = cardState.pendingEffectByPlayer[inputPlayerKey];
    const allowDuringAnimForSell = !!(pending && pending.type === 'SELL_CARD_WILL' && pending.stage === 'selectTarget');
    const canInteract = !isAnimating || allowDuringAnimForSell || staleVisualPlaybackLock || isDebugUnlimited;

    const fadeState = (typeof window !== 'undefined')
        ? (window.__handFadeInState || window.__handFadeInHint || null)
        : null;
    const fadePlayerKey = fadeState && fadeState.playerKey ? fadeState.playerKey : null;
    const fadeCount = fadeState && Number.isFinite(fadeState.count) ? fadeState.count : 0;
    const handRevealState = (typeof window !== 'undefined' && window.__handSequentialRevealState && typeof window.__handSequentialRevealState === 'object')
        ? window.__handSequentialRevealState
        : null;
    const revealPlayerKey = (handRevealState && (handRevealState.playerKey === 'black' || handRevealState.playerKey === 'white'))
        ? handRevealState.playerKey
        : null;
    const revealVisibleCount = (handRevealState && Number.isFinite(handRevealState.visibleCount))
        ? Math.max(0, Math.trunc(handRevealState.visibleCount))
        : null;

    function renderHandSlot(containerEl, ownerKey, revealByDefault) {
        if (!containerEl) return;
        containerEl.innerHTML = '';
        containerEl.dataset.ownerKey = ownerKey;
        const handTrackEl = document.createElement('div');
        handTrackEl.className = 'hand-track';
        containerEl.appendChild(handTrackEl);

        const ownerHandRaw = (cardState.hands && Array.isArray(cardState.hands[ownerKey])) ? cardState.hands[ownerKey] : [];
        const ownerHand = (revealPlayerKey === ownerKey && Number.isFinite(revealVisibleCount))
            ? ownerHandRaw.slice(0, Math.min(ownerHandRaw.length, revealVisibleCount))
            : ownerHandRaw;
        const shouldFade = fadePlayerKey === ownerKey && fadeCount > 0;
        const ownerHandLen = ownerHand.length;
        const selectedOwnerKey = (cardState.selectedCardOwnerKey === 'white' || cardState.selectedCardOwnerKey === 'black')
            ? cardState.selectedCardOwnerKey
            : inputPlayerKey;

        ownerHand.forEach((cardId, idx) => {
            let cardEl = document.createElement('div');
            const canShowFace = isNetworkMode
                ? (ownerKey === localPlayerKey)
                : revealByDefault;
            const isHiddenToken = _isHiddenHandTokenForRender(cardId);

            if (!canShowFace || isHiddenToken) {
                cardEl = _createHiddenHandCardElement(cardId, ownerKey);
            } else {
                const cardDef = CARD_DEFS.find(c => c.id === cardId);
                cardEl = createCardFaceElement(cardId);

                const cost = cardDef ? (cardDef.cost || 0) : 0;

                const hasNotUsedThisTurn = isDebugUnlimited ? true : !cardState.hasUsedCardThisTurnByPlayer[ownerKey];
                const canAfford = isDebugUnlimited ? true : ((cardState.charge[ownerKey] || 0) >= cost);
                const isOwnerTurn = ownerKey === 'black' ? isBlackTurn : !isBlackTurn;
                const canInspectOwnerHand = isNetworkMode
                    ? (ownerKey === localPlayerKey)
                    : (isDebugHvH ? true : (ownerKey === 'black'));
                const canControlOwnerHand = isNetworkMode
                    ? (ownerKey === localPlayerKey && isOwnerTurn)
                    : (isDebugHvH ? isOwnerTurn : (ownerKey === 'black' && isOwnerTurn));
                const usable = canControlOwnerHand && canInteract && hasNotUsedThisTurn && canAfford;

                if (canInspectOwnerHand && canInteract) {
                    cardEl.classList.add('clickable');
                    cardEl.addEventListener('click', () => onCardClick(cardId, ownerKey));
                }
                if (usable) {
                    cardEl.classList.add('usable');
                }
                if (cardState.selectedCardId === cardId && selectedOwnerKey === ownerKey) {
                    cardEl.classList.add('selected');
                }

                cardEl.dataset.cardId = cardId;
                cardEl.dataset.ownerKey = ownerKey;
            }

            if (shouldFade && idx >= Math.max(0, ownerHandLen - fadeCount)) {
                cardEl.classList.add('card-fade-prep');
            }

            handTrackEl.appendChild(cardEl);
        });
    }

    renderHandSlot(handBlackEl, bottomOwnerKey, true);
    renderHandSlot(handWhiteEl, topOwnerKey, isDebugHvH === true);
    _refreshDebugHandLayoutIfNeeded();

    // Update Card Detail Panel
    updateCardDetailPanel();

    // Update Discard Display
    const discardCountEl = document.getElementById('discard-count');
    if (discardCountEl) {
        discardCountEl.textContent = cardState.discard.length;
    }

    // Update Active Effect Slots (Phase 2: always empty)
    const activeBlackEl = document.getElementById('active-black');
    const activeWhiteEl = document.getElementById('active-white');
    if (activeBlackEl) {
        const content = activeBlackEl.querySelector('.effect-slot-content');
        if (content) {
            const effects = (cardState.activeEffectsByPlayer && cardState.activeEffectsByPlayer.black) || [];
            content.textContent = effects.length > 0 ? effects.map(e => e.name).join(', ') : 'なし';
        }
    }
    if (activeWhiteEl) {
        const content = activeWhiteEl.querySelector('.effect-slot-content');
        if (content) {
            const effects = cardState.activeEffectsByPlayer.white;
            content.textContent = effects.length > 0 ? effects.map(e => e.name).join(', ') : 'なし';
        }
    }
}
