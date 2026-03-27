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

function _normalizeCardDisplayTypeLabel(label) {
    const normalized = String(label || '').trim();
    return normalized || '';
}

function _resolveCardDisplayTypeLabel(cardDef, fallbackCardId) {
    if (cardDef && typeof cardDef === 'object') {
        const directLabel = _normalizeCardDisplayTypeLabel(cardDef.display_type_ja || cardDef.displayTypeJa);
        if (directLabel) return directLabel;
    }

    const cardId = String(fallbackCardId || (cardDef && cardDef.id) || '').trim();
    if (!cardId) return '';

    try {
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards)) {
            const catalogCard = window.CardCatalog.cards.find((entry) => entry && entry.id === cardId);
            if (catalogCard) {
                const catalogLabel = _normalizeCardDisplayTypeLabel(catalogCard.display_type_ja || catalogCard.displayTypeJa);
                if (catalogLabel) return catalogLabel;
            }
        }
    } catch (e) { /* ignore */ }

    return '';
}

function _createCardBadgeRow(cardDef, cost, tierClass, fallbackCardId) {
    const badgeRow = document.createElement('div');
    badgeRow.className = 'card-badge-row';

    const typeLabel = _resolveCardDisplayTypeLabel(cardDef, fallbackCardId);
    if (typeLabel) {
        const typeBadge = document.createElement('div');
        typeBadge.className = 'card-type-badge';
        typeBadge.textContent = typeLabel;
        badgeRow.appendChild(typeBadge);
    }

    const costBadge = document.createElement('div');
    costBadge.className = 'card-cost-badge';
    if (tierClass) {
        costBadge.classList.add(tierClass);
    }
    costBadge.textContent = `コスト${cost}`;
    badgeRow.appendChild(costBadge);

    return badgeRow;
}

var _lastChargeForDelta = { black: null, white: null, turnIndex: null };

function _normalizeChargeValueForRender(value) {
    return Number.isFinite(Number(value))
        ? Number(value)
        : 0;
}

function _renderChargeDisplay(el, currentValue, maxValue) {
    if (!el) return;
    const safeCurrent = _normalizeChargeValueForRender(currentValue);
    const safeMax = _normalizeChargeValueForRender(maxValue);
    el.innerHTML = `<span class="charge-label">布石:</span> <span class="charge-current">${safeCurrent}</span><span class="charge-separator"> / </span><span class="charge-max">${safeMax}</span>`;
}

function _resetChargeDeltaBaseline() {
    _lastChargeForDelta.black = null;
    _lastChargeForDelta.white = null;
    _lastChargeForDelta.turnIndex = null;
}

function _shouldResetChargeDeltaBaseline(currentTurnIndex) {
    if (currentTurnIndex === null || _lastChargeForDelta.turnIndex === null) return false;
    if (currentTurnIndex < _lastChargeForDelta.turnIndex) return true;
    return currentTurnIndex === 0 && _lastChargeForDelta.turnIndex !== 0;
}

function _readChargeDeltaSnapshot(cardState) {
    const chargeState = (cardState && cardState.charge && typeof cardState.charge === 'object')
        ? cardState.charge
        : { black: 0, white: 0 };
    const currentTurnIndex = (cardState && typeof cardState.turnIndex === 'number')
        ? cardState.turnIndex
        : null;
    return {
        black: _normalizeChargeValueForRender(chargeState.black),
        white: _normalizeChargeValueForRender(chargeState.white),
        turnIndex: currentTurnIndex
    };
}

function _rememberChargeDeltaSnapshot(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') {
        _resetChargeDeltaBaseline();
        return;
    }
    _lastChargeForDelta.black = snapshot.black;
    _lastChargeForDelta.white = snapshot.white;
    _lastChargeForDelta.turnIndex = snapshot.turnIndex;
}

function _allowsRawChargeDeltaFallback(matchMode) {
    return matchMode !== 'network';
}

function _consumeRawChargeDeltaFallback(chargeSnapshot, chargeDeltaHandler) {
    if (!chargeSnapshot || !chargeDeltaHandler) return false;
    let consumed = false;
    if (_lastChargeForDelta.black !== null) {
        const deltaBlack = chargeSnapshot.black - _lastChargeForDelta.black;
        if (deltaBlack !== 0) {
            chargeDeltaHandler('black', deltaBlack);
            consumed = true;
        }
    }
    if (_lastChargeForDelta.white !== null) {
        const deltaWhite = chargeSnapshot.white - _lastChargeForDelta.white;
        if (deltaWhite !== 0) {
            chargeDeltaHandler('white', deltaWhite);
            consumed = true;
        }
    }
    return consumed;
}

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

    cardEl.appendChild(_createCardBadgeRow(cardDef, cost, tierClass, cardId));

    cardEl.dataset.cardId = cardId;
    return cardEl;
}

function _normalizeCardStateForRender(state) {
    if (!state || typeof state !== 'object') return null;

    if (!state.charge || typeof state.charge !== 'object') state.charge = {};
    state.charge.black = _normalizeChargeValueForRender(state.charge.black);
    state.charge.white = _normalizeChargeValueForRender(state.charge.white);

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

function _resolveTransientNetworkChargeDeltaEvents() {
    try {
        if (typeof globalThis !== 'undefined' && Array.isArray(globalThis.__networkTransientChargeDeltaEvents)) {
            return globalThis.__networkTransientChargeDeltaEvents;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && Array.isArray(window.__networkTransientChargeDeltaEvents)) {
            return window.__networkTransientChargeDeltaEvents;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function _setTransientNetworkChargeDeltaEvents(events) {
    const nextEvents = Array.isArray(events) ? events : [];
    try {
        if (typeof globalThis !== 'undefined') {
            globalThis.__networkTransientChargeDeltaEvents = nextEvents;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            window.__networkTransientChargeDeltaEvents = nextEvents;
        }
    } catch (e) { /* ignore */ }
}

function _clearTransientNetworkChargeDeltaEvents() {
    _setTransientNetworkChargeDeltaEvents([]);
}

function _shouldRenderChargeDeltaOnHud(ev) {
    if (!ev || ev.popupKind !== 'board') return true;
    const hasAnchor = Number.isInteger(Number(ev.anchorRow)) && Number.isInteger(Number(ev.anchorCol));
    const isGain = Number(ev.delta) > 0;
    if (!hasAnchor || !isGain) {
        try {
            console.warn('[CardRenderer] invalid board charge delta metadata; falling back to HUD', ev);
        } catch (e) { /* ignore */ }
        return true;
    }
    return false;
}

function _normalizeChargeDeltaOwnerKey(playerKey) {
    return (playerKey === 'white' || playerKey === -1 || playerKey === '-1') ? 'white' : 'black';
}

function _mapChargeDeltaOwnerToVisibleSlot(ownerKey, bottomOwnerKey) {
    return ownerKey === bottomOwnerKey ? 'black' : 'white';
}

function _createVisibleChargeDeltaHandler(baseChargeDeltaHandler, bottomOwnerKey) {
    if (!baseChargeDeltaHandler) return null;
    return (playerKey, delta) => {
        const ownerKey = _normalizeChargeDeltaOwnerKey(playerKey);
        const slotKey = _mapChargeDeltaOwnerToVisibleSlot(ownerKey, bottomOwnerKey);
        baseChargeDeltaHandler(slotKey, delta);
    };
}

function _pickHudChargeDeltaDisplayEvent(events) {
    const list = Array.isArray(events) ? events : [];
    if (list.length === 0) return null;
    const hasPositive = list.some((ev) => Number(ev && ev.delta) > 0);
    const hasNegative = list.some((ev) => Number(ev && ev.delta) < 0);
    if (hasPositive && hasNegative) {
        for (let index = list.length - 1; index >= 0; index--) {
            const ev = list[index];
            if (!ev) continue;
            if (Number(ev.delta) >= 0) continue;
            if (String(ev.reason || '').trim() === 'card_use_cost') {
                return ev;
            }
        }
    }
    return null;
}

function consumeChargeDeltaEventList(eventsSource, chargeDeltaHandler) {
    if (!Array.isArray(eventsSource) || eventsSource.length === 0) {
        return false;
    }
    const events = eventsSource
        .filter((ev) => ev && Number.isFinite(Number(ev.delta)) && Number(ev.delta) !== 0)
        .sort((a, b) => {
            const sa = Number(a.seq || 0);
            const sb = Number(b.seq || 0);
            return sa - sb;
        });

    eventsSource.length = 0;
    if (!chargeDeltaHandler || events.length === 0) return events.length > 0;

    const hudEvents = events.filter((ev) => _shouldRenderChargeDeltaOnHud(ev));
    if (hudEvents.length === 0) return events.length > 0;

    const eventsByPlayer = { black: [], white: [] };
    const playerOrder = [];
    for (const ev of hudEvents) {
        const player = _normalizeChargeDeltaOwnerKey(ev.player);
        if (eventsByPlayer[player].length === 0) playerOrder.push(player);
        eventsByPlayer[player].push(ev);
    }
    for (const player of playerOrder) {
        const playerEvents = eventsByPlayer[player];
        const prioritizedEvent = _pickHudChargeDeltaDisplayEvent(playerEvents);
        if (prioritizedEvent) {
            const prioritizedDelta = Number(prioritizedEvent.delta || 0);
            if (prioritizedDelta !== 0) {
                chargeDeltaHandler(player, prioritizedDelta);
            }
            continue;
        }
        const totalDelta = playerEvents.reduce((sum, ev) => sum + Number(ev && ev.delta ? ev.delta : 0), 0);
        if (totalDelta !== 0) {
            chargeDeltaHandler(player, totalDelta);
        }
    }
    return true;
}

function consumeChargeDeltaEvents(cardState, chargeDeltaHandler) {
    const events = (cardState && Array.isArray(cardState.chargeDeltaEvents))
        ? cardState.chargeDeltaEvents
        : null;
    return consumeChargeDeltaEventList(events, chargeDeltaHandler);
}

function consumeTransientNetworkChargeDeltaEvents(chargeDeltaHandler) {
    return consumeChargeDeltaEventList(_resolveTransientNetworkChargeDeltaEvents(), chargeDeltaHandler);
}

function consumeChargeDeltaSourcesForRender(cardState, matchMode, chargeDeltaHandler) {
    const consumedAuthoritativeQueue = consumeChargeDeltaEvents(cardState, chargeDeltaHandler);
    if (consumedAuthoritativeQueue) {
        _clearTransientNetworkChargeDeltaEvents();
        return {
            consumedAuthoritativeQueue: true,
            consumedTransientQueue: false,
            allowRawFallback: _allowsRawChargeDeltaFallback(matchMode)
        };
    }
    return {
        consumedAuthoritativeQueue: false,
        consumedTransientQueue: consumeTransientNetworkChargeDeltaEvents(chargeDeltaHandler),
        allowRawFallback: _allowsRawChargeDeltaFallback(matchMode)
    };
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
        _renderChargeDisplay(chargeBlackEl, cardState.charge[bottomOwnerKey] || 0, chargeMax);
    }
    if (chargeWhiteEl) {
        _renderChargeDisplay(chargeWhiteEl, cardState.charge[topOwnerKey] || 0, chargeMax);
    }

    const baseChargeDeltaHandler = (typeof window !== 'undefined' && window.StoneVisuals && typeof window.StoneVisuals.showChargeDelta === 'function')
        ? window.StoneVisuals.showChargeDelta
        : null;
    const chargeDeltaHandler = _createVisibleChargeDeltaHandler(baseChargeDeltaHandler, bottomOwnerKey);
    const chargeSnapshot = _readChargeDeltaSnapshot(cardState);

    if (_shouldResetChargeDeltaBaseline(chargeSnapshot.turnIndex)) {
        _resetChargeDeltaBaseline();
    }

    const consumedChargeDeltaSources = consumeChargeDeltaSourcesForRender(cardState, matchMode, chargeDeltaHandler);

    // In network mode, charge gain popups must come from authoritative/transient event queues.
    // Falling back to raw total diffs can replay the current total as a fake +gain on turn handoff.
    if (consumedChargeDeltaSources.allowRawFallback
        && !consumedChargeDeltaSources.consumedAuthoritativeQueue
        && !consumedChargeDeltaSources.consumedTransientQueue) {
        _consumeRawChargeDeltaFallback(chargeSnapshot, chargeDeltaHandler);
    }

    _rememberChargeDeltaSnapshot(chargeSnapshot);
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
            const isHiddenToken = _isHiddenHandTokenForRender(cardId);
            const canShowFace = isNetworkMode
                ? (ownerKey === localPlayerKey || !isHiddenToken)
                : revealByDefault;

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
                    ? canShowFace
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
