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

var OwnerHelpersModule = null;
if (typeof require === 'function') {
    try { OwnerHelpersModule = require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!OwnerHelpersModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.OwnerHelpers) OwnerHelpersModule = globalThis.OwnerHelpers;
    } catch (e) { /* ignore */ }
}

var HandAnimationUtilsModule = null;
if (typeof require === 'function') {
    try { HandAnimationUtilsModule = require('../ui/animation-utils'); } catch (e) { /* ignore */ }
}
if (!HandAnimationUtilsModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.HandAnimationUtilsModule) HandAnimationUtilsModule = globalThis.HandAnimationUtilsModule;
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

var _DISPLAY_TYPE_ICON_MAP = {
    '採掘': '\u26CF\uFE0E',
    '守護': '\u26E8\uFE0E',
    '戦闘': '\u2694\uFE0E',
    '執行': '\u2696\uFE0E',
    '禁忌': '\u26A0\uFE0E',
    '殲滅': '\u2620\uFE0E',
    '繁栄': '\u2728',
    '特殊': '\u2726'
};

var _DISPLAY_TYPE_KEY_MAP = {
    '採掘': 'mining',
    '守護': 'guard',
    '戦闘': 'battle',
    '執行': 'judgment',
    '禁忌': 'taboo',
    '殲滅': 'annihilation',
    '繁栄': 'prosperity',
    '特殊': 'special'
};

var _CARD_FACE_SPECIAL_ART_OVERRIDES = {
    seed_01: {
        effectKey: 'seedStone',
        imagePath: 'assets/images/other/seed.png'
    },
    blockade_01: {
        effectKey: 'blockadeMark',
        imagePath: 'assets/images/other/X.png'
    }
};

function _resolveCardDisplayTypeKey(cardDef, fallbackCardId) {
    const typeLabel = _resolveCardDisplayTypeLabel(cardDef, fallbackCardId);
    return _DISPLAY_TYPE_KEY_MAP[typeLabel] || '';
}

function _getGameVisualEffectsMapForCardFaces() {
    try {
        const root = (typeof globalThis !== 'undefined')
            ? globalThis
            : (typeof window !== 'undefined' ? window : null);
        if (
            root &&
            root.GameVisualEffectsMap &&
            root.GameVisualEffectsMap.STONE_VISUAL_EFFECTS &&
            typeof root.GameVisualEffectsMap.resolveCardVisualImagePath === 'function'
        ) {
            return root.GameVisualEffectsMap;
        }
    } catch (e) { /* ignore */ }

    if (typeof require === 'function') {
        try {
            const mod = require('../game/visual-effects-map');
            if (mod && mod.STONE_VISUAL_EFFECTS && typeof mod.resolveCardVisualImagePath === 'function') {
                return mod;
            }
        } catch (e) { /* ignore */ }
    }
    return null;
}

function _normalizeCardFaceVisualSide(value) {
    if (value === 'white' || value === -1 || value === '-1') return '-1';
    if (value === 'black' || value === 1 || value === '1') return '1';
    return null;
}

function _resolveCardDefForFaceVisual(cardDef, fallbackCardId) {
    if (cardDef && typeof cardDef === 'object') {
        return cardDef;
    }

    const cardId = String(fallbackCardId || '').trim();
    if (!cardId) {
        return null;
    }

    try {
        if (typeof CARD_DEFS !== 'undefined' && Array.isArray(CARD_DEFS)) {
            const runtimeDef = CARD_DEFS.find((entry) => entry && entry.id === cardId);
            if (runtimeDef) {
                return runtimeDef;
            }
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof window !== 'undefined' && window.CardCatalog && Array.isArray(window.CardCatalog.cards)) {
            const catalogDef = window.CardCatalog.cards.find((entry) => entry && entry.id === cardId);
            if (catalogDef) {
                return catalogDef;
            }
        }
    } catch (e) { /* ignore */ }

    return null;
}

function _resolveCardSpecialArt(cardDef, fallbackCardId, options) {
    const resolvedCardDef = _resolveCardDefForFaceVisual(cardDef, fallbackCardId);
    const resolvedCardId = String(resolvedCardDef && resolvedCardDef.id ? resolvedCardDef.id : (fallbackCardId || '')).trim();
    if (resolvedCardId && _CARD_FACE_SPECIAL_ART_OVERRIDES[resolvedCardId]) {
        return _CARD_FACE_SPECIAL_ART_OVERRIDES[resolvedCardId];
    }
    const cardType = String(resolvedCardDef && resolvedCardDef.type ? resolvedCardDef.type : '').trim();
    if (!cardType) {
        return null;
    }

    const map = _getGameVisualEffectsMapForCardFaces();
    if (!map) {
        return null;
    }

    const effectKey = (typeof map.getEffectKeyForPendingType === 'function')
        ? map.getEffectKeyForPendingType(cardType)
        : (map.PENDING_TYPE_TO_EFFECT_KEY && map.PENDING_TYPE_TO_EFFECT_KEY[cardType]);
    if (!effectKey) {
        return null;
    }

    const ownerSide = _normalizeCardFaceVisualSide(options && options.ownerKey);
    const imagePath = map.resolveCardVisualImagePath(cardType, {
        owner: ownerSide,
        player: ownerSide,
        fallbackOwner: '1',
        fallbackPlayer: '1'
    });
    if (!imagePath) {
        return null;
    }
    if (typeof map.isNormalStoneImagePath === 'function' && map.isNormalStoneImagePath(imagePath)) {
        return null;
    }

    return {
        effectKey,
        imagePath
    };
}

function applyCardSpecialArtToFace(cardEl, cardDef, options) {
    if (!cardEl || typeof cardEl !== 'object') {
        return cardEl;
    }

    const fallbackCardId = options && options.cardId ? options.cardId : (cardDef && cardDef.id);
    const art = _resolveCardSpecialArt(cardDef, fallbackCardId, options);
    const existingArtEl = cardEl.querySelector('.card-special-art');
    if (!art) {
        cardEl.classList.remove('has-special-art');
        delete cardEl.dataset.cardVisualEffect;
        cardEl.style.removeProperty('--card-special-art-image');
        if (existingArtEl && existingArtEl.parentElement) {
            existingArtEl.parentElement.removeChild(existingArtEl);
        }
        return cardEl;
    }

    let artEl = existingArtEl;
    if (!artEl) {
        artEl = document.createElement('div');
        artEl.className = 'card-special-art';
        artEl.setAttribute('aria-hidden', 'true');
        cardEl.insertBefore(artEl, cardEl.firstChild || null);
    }

    const escapedPath = String(art.imagePath).replace(/"/g, '\\"');
    cardEl.classList.add('has-special-art');
    cardEl.dataset.cardVisualEffect = art.effectKey;
    cardEl.style.setProperty('--card-special-art-image', `url("${escapedPath}")`);
    return cardEl;
}

function _fitCardNameElement(nameEl, retriesRemaining) {
    if (!nameEl || typeof nameEl !== 'object') return;
    const retries = Number.isFinite(retriesRemaining) ? retriesRemaining : 6;

    const runFit = () => {
        try {
            const availableWidth = Math.max(0, nameEl.clientWidth || nameEl.offsetWidth || 0);
            if (!availableWidth) {
                if (retries > 0 && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
                    window.requestAnimationFrame(() => _fitCardNameElement(nameEl, retries - 1));
                }
                return;
            }

            nameEl.style.removeProperty('font-size');
            nameEl.style.removeProperty('letter-spacing');
            const computed = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function')
                ? window.getComputedStyle(nameEl)
                : null;
            const baseFontPx = computed ? parseFloat(computed.fontSize) : NaN;
            if (!Number.isFinite(baseFontPx) || baseFontPx <= 0) return;

            const minFontPx = Math.max(8, Math.ceil(baseFontPx * 0.68));
            let nextFontPx = baseFontPx;
            const applyFontSize = (fontPx) => {
                const snappedFontPx = Math.max(minFontPx, Math.floor(fontPx));
                nameEl.style.fontSize = `${snappedFontPx}px`;
                nextFontPx = snappedFontPx;
            };
            let attempts = 0;
            while (nameEl.scrollWidth > availableWidth && nextFontPx > minFontPx && attempts < 12) {
                applyFontSize(nextFontPx - 1);
                attempts += 1;
            }

            if (nameEl.scrollWidth > availableWidth) {
                nameEl.style.letterSpacing = '-0.03em';
            }
            attempts = 0;
            while (nameEl.scrollWidth > availableWidth && nextFontPx > minFontPx && attempts < 8) {
                applyFontSize(nextFontPx - 1);
                attempts += 1;
            }
        } catch (e) { /* ignore */ }
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(runFit);
    } else {
        runFit();
    }
}

try {
    if (typeof window !== 'undefined') {
        window.fitCardNameElement = _fitCardNameElement;
        window.applyCardSpecialArtToFace = applyCardSpecialArtToFace;
    }
} catch (e) { /* ignore */ }

function _createCardBadgeRow(cardDef, fallbackCardId) {
    const typeLabel = _resolveCardDisplayTypeLabel(cardDef, fallbackCardId);
    if (!typeLabel) return null;

    const badgeRow = document.createElement('div');
    badgeRow.className = 'card-badge-row';

    const typeBadge = document.createElement('div');
    typeBadge.className = 'card-type-badge';
    const icon = _DISPLAY_TYPE_ICON_MAP[typeLabel] || '';
    typeBadge.textContent = icon ? (icon + ' ' + typeLabel) : typeLabel;
    badgeRow.appendChild(typeBadge);

    return badgeRow;
}

function _createCardCostBadge(cost, tierClass) {
    const costBadge = document.createElement('div');
    costBadge.className = 'card-cost-badge';
    if (tierClass) {
        costBadge.classList.add(tierClass);
    }
    const valueSpan = document.createElement('span');
    valueSpan.className = 'cost-value';
    valueSpan.textContent = String(cost);
    const labelSpan = document.createElement('span');
    labelSpan.className = 'cost-label';
    labelSpan.textContent = 'cost';
    costBadge.appendChild(valueSpan);
    costBadge.appendChild(labelSpan);
    return costBadge;
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
    let labelEl = el.querySelector('.charge-label');
    let currentEl = el.querySelector('.charge-current');
    let separatorEl = el.querySelector('.charge-separator');
    let maxEl = el.querySelector('.charge-max');
    if (!labelEl && typeof document !== 'undefined') {
        labelEl = document.createElement('span');
        labelEl.className = 'charge-label';
    }
    if (!currentEl && typeof document !== 'undefined') {
        currentEl = document.createElement('span');
        currentEl.className = 'charge-current';
    }
    if (!separatorEl && typeof document !== 'undefined') {
        separatorEl = document.createElement('span');
        separatorEl.className = 'charge-separator';
    }
    if (!maxEl && typeof document !== 'undefined') {
        maxEl = document.createElement('span');
        maxEl.className = 'charge-max';
    }
    const badgeEl = el.querySelector('.time-stop-status-badge');
    const orderedNodes = [labelEl, currentEl, separatorEl, maxEl].filter(Boolean);
    let insertBeforeNode = badgeEl || null;
    for (let i = orderedNodes.length - 1; i >= 0; i -= 1) {
        const node = orderedNodes[i];
        if (node.parentElement !== el || node.nextSibling !== insertBeforeNode) {
            el.insertBefore(node, insertBeforeNode);
        }
        insertBeforeNode = node;
    }
    if (labelEl) labelEl.textContent = '布石: ';
    if (currentEl) currentEl.textContent = String(safeCurrent);
    if (separatorEl) separatorEl.textContent = ' / ';
    if (maxEl) maxEl.textContent = String(safeMax);
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
        if (OwnerHelpersModule && typeof OwnerHelpersModule.getCurrentMatchMode === 'function') {
            return OwnerHelpersModule.getCurrentMatchMode(typeof window !== 'undefined' ? window : null);
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
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
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

var TIME_STOP_ACTIVE_LABEL = '時間停止発動中';

function _normalizePlayerKeyForRender(playerKey) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
            return OwnerHelpersModule.normalizePlayerKeyOptional(playerKey);
        }
    } catch (e) { /* ignore */ }
    if (playerKey === 'black' || playerKey === 1 || playerKey === '1') return 'black';
    if (playerKey === 'white' || playerKey === -1 || playerKey === '-1') return 'white';
    return null;
}

function _getOpposingPlayerKeyForRender(playerKey) {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.getOpposingPlayerKey === 'function') {
            return OwnerHelpersModule.getOpposingPlayerKey(playerKey);
        }
    } catch (e) { /* ignore */ }
    const normalizedPlayerKey = _normalizePlayerKeyForRender(playerKey);
    if (!normalizedPlayerKey) return null;
    return normalizedPlayerKey === 'black' ? 'white' : 'black';
}

function _resolveTimeStopStatusForRender(cardState, viewerPlayerKey, gameState) {
    const remainingByPlayer = (cardState && cardState.timeStopConsecutiveTurnsRemainingByPlayer && typeof cardState.timeStopConsecutiveTurnsRemainingByPlayer === 'object')
        ? cardState.timeStopConsecutiveTurnsRemainingByPlayer
        : null;
    if (!remainingByPlayer) {
        return { active: false, activeOwnerKey: null, victimKey: null, viewerRole: null };
    }

    const blackRemaining = Number(remainingByPlayer.black);
    const whiteRemaining = Number(remainingByPlayer.white);
    const blackActive = Number.isFinite(blackRemaining) && blackRemaining > 0;
    const whiteActive = Number.isFinite(whiteRemaining) && whiteRemaining > 0;

    let activeOwnerKey = null;
    if (blackActive && !whiteActive) {
        activeOwnerKey = 'black';
    } else if (whiteActive && !blackActive) {
        activeOwnerKey = 'white';
    } else if (blackActive && whiteActive) {
        const currentPlayerKey = _normalizePlayerKeyForRender(gameState && gameState.currentPlayer);
        activeOwnerKey = (currentPlayerKey && Number(remainingByPlayer[currentPlayerKey]) > 0)
            ? currentPlayerKey
            : 'black';
    }

    if (!activeOwnerKey) {
        return { active: false, activeOwnerKey: null, victimKey: null, viewerRole: null };
    }

    const viewerKey = _normalizePlayerKeyForRender(viewerPlayerKey);
    const victimKey = _getOpposingPlayerKeyForRender(activeOwnerKey);
    let viewerRole = null;
    if (viewerKey === activeOwnerKey) {
        viewerRole = 'controller';
    } else if (viewerKey === victimKey) {
        viewerRole = 'victim';
    }
    return { active: true, activeOwnerKey, victimKey, viewerRole };
}

function _syncTimeStopChargeBadgeForRender(chargeEl, active) {
    if (!chargeEl) return;
    const existingBadgeEl = chargeEl.querySelector('.time-stop-status-badge');
    if (!active) {
        if (existingBadgeEl && existingBadgeEl.parentElement) {
            existingBadgeEl.parentElement.removeChild(existingBadgeEl);
        }
        return;
    }
    if (typeof document === 'undefined') return;
    const badgeEl = existingBadgeEl || document.createElement('div');
    badgeEl.className = 'time-stop-status-badge';
    badgeEl.textContent = TIME_STOP_ACTIVE_LABEL;
    if (badgeEl.parentElement !== chargeEl) {
        chargeEl.appendChild(badgeEl);
    }
}

function _syncTimeStopHandOverlayForRender(containerEl, active) {
    if (!containerEl) return;
    const existingOverlayEl = containerEl.querySelector('.time-stop-hand-overlay');
    if (!active) {
        if (existingOverlayEl && existingOverlayEl.parentElement) {
            existingOverlayEl.parentElement.removeChild(existingOverlayEl);
        }
        return;
    }
    if (typeof document === 'undefined') return;
    const overlayEl = existingOverlayEl || document.createElement('div');
    overlayEl.className = 'time-stop-hand-overlay';
    overlayEl.textContent = TIME_STOP_ACTIVE_LABEL;
    if (overlayEl.parentElement !== containerEl) {
        containerEl.appendChild(overlayEl);
    } else if (containerEl.lastElementChild !== overlayEl) {
        containerEl.appendChild(overlayEl);
    }
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
        if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackStaleMs === 'function') {
            return PlaybackStateModule.getPlaybackStaleMs({
                root: (typeof window !== 'undefined') ? window : null
            });
        }
    } catch (e) { /* ignore */ }
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
        if (PlaybackStateModule && typeof PlaybackStateModule.isPlaybackStale === 'function') {
            return PlaybackStateModule.isPlaybackStale({
                root: (typeof window !== 'undefined') ? window : null
            });
        }
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
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isHiddenHandToken === 'function') {
            return OwnerHelpersModule.isHiddenHandToken(cardId);
        }
    } catch (e) { /* ignore */ }
    return typeof cardId === 'string' && /^__hidden_hand__:(black|white):(\d+)$/.test(cardId);
}

function _isHandCardRevealedToViewerForRender(cardState, viewerKey, ownerKey, handIndex) {
    if (!cardState || typeof cardState !== 'object') return false;
    const viewer = viewerKey === 'white' ? 'white' : (viewerKey === 'black' ? 'black' : null);
    const owner = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!viewer || !owner || viewer === owner || !Number.isInteger(Number(handIndex))) return false;

    const normalizedHandIndex = Math.max(0, Math.trunc(Number(handIndex)));

    try {
        if (
            typeof CardLogic !== 'undefined'
            && CardLogic
            && typeof CardLogic.getHandCopyIdAt === 'function'
            && typeof CardLogic.isCardCopyIdRevealedToViewer === 'function'
        ) {
            const copyId = CardLogic.getHandCopyIdAt(cardState, owner, normalizedHandIndex);
            return Number.isInteger(copyId) && CardLogic.isCardCopyIdRevealedToViewer(cardState, viewer, copyId) === true;
        }
    } catch (e) { /* ignore */ }

    const handCopyIdsByPlayer = (cardState._handCopyIdsByPlayer && typeof cardState._handCopyIdsByPlayer === 'object')
        ? cardState._handCopyIdsByPlayer
        : null;
    const revealedHandCopyIdsByViewer = (cardState._revealedHandCopyIdsByViewer && typeof cardState._revealedHandCopyIdsByViewer === 'object')
        ? cardState._revealedHandCopyIdsByViewer
        : null;
    const handCopyIds = handCopyIdsByPlayer && Array.isArray(handCopyIdsByPlayer[owner])
        ? handCopyIdsByPlayer[owner]
        : null;
    const revealedCopyIds = revealedHandCopyIdsByViewer && Array.isArray(revealedHandCopyIdsByViewer[viewer])
        ? revealedHandCopyIdsByViewer[viewer]
        : null;
    if (!handCopyIds || !revealedCopyIds || normalizedHandIndex >= handCopyIds.length) return false;

    const copyId = handCopyIds[normalizedHandIndex];
    return Number.isInteger(copyId) && revealedCopyIds.includes(copyId);
}

function _hasOwnerUsedCardThisActiveTurnForRender(cardState, ownerKey) {
    const normalizedOwnerKey = ownerKey === 'white' ? 'white' : (ownerKey === 'black' ? 'black' : null);
    if (!cardState || typeof cardState !== 'object' || !normalizedOwnerKey) return false;
    if (cardState.lastTurnStartedFor !== normalizedOwnerKey) return false;
    return !!(
        cardState.hasUsedCardThisTurnByPlayer
        && cardState.hasUsedCardThisTurnByPlayer[normalizedOwnerKey]
    );
}

function _createHiddenHandCardElement(cardId, ownerKey) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item hidden';
    cardEl.dataset.cardId = cardId;
    cardEl.dataset.ownerKey = ownerKey;
    cardEl.textContent = 'CARD';
    return cardEl;
}

function _createCaptureReservedSlotElement() {
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item capture-reserved-slot';
    cardEl.style.opacity = '0';
    cardEl.style.pointerEvents = 'none';
    cardEl.setAttribute('aria-hidden', 'true');
    return cardEl;
}

function _detachHandCardClickHandler(cardEl) {
    if (!cardEl || typeof cardEl !== 'object' || !cardEl.__cardClickHandler) return;
    try {
        cardEl.removeEventListener('click', cardEl.__cardClickHandler);
    } catch (e) { /* ignore */ }
    cardEl.__cardClickHandler = null;
}

function _setHandCardClickHandler(cardEl, clickable, cardId, ownerKey) {
    if (!cardEl || typeof cardEl !== 'object') return;
    _detachHandCardClickHandler(cardEl);
    if (!clickable || typeof onCardClick !== 'function') return;
    const handler = () => onCardClick(cardId, ownerKey);
    cardEl.__cardClickHandler = handler;
    cardEl.addEventListener('click', handler);
}

function _ensureHandTrackElement(containerEl) {
    if (!containerEl || typeof document === 'undefined') return null;
    let handTrackEl = containerEl.querySelector('.hand-track');
    if (!handTrackEl) {
        handTrackEl = document.createElement('div');
        handTrackEl.className = 'hand-track';
        const overlayEl = containerEl.querySelector('.time-stop-hand-overlay');
        containerEl.insertBefore(handTrackEl, overlayEl || null);
    }
    return handTrackEl;
}

function _canReuseHandCardElement(cardEl, desiredKind, cardId, ownerKey) {
    if (!cardEl || !cardEl.classList) return false;
    if (desiredKind === 'placeholder') {
        return cardEl.classList.contains('capture-reserved-slot');
    }
    if (desiredKind === 'hidden') {
        return cardEl.classList.contains('hidden') && !cardEl.classList.contains('capture-reserved-slot');
    }
    if (desiredKind === 'face') {
        return (
            cardEl.classList.contains('visible')
            && !cardEl.classList.contains('hidden')
            && !cardEl.classList.contains('capture-reserved-slot')
            && cardEl.dataset.cardId === cardId
            && cardEl.dataset.ownerKey === ownerKey
        );
    }
    return false;
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

function createCardFaceElement(cardId, options) {
    const cardDef = CARD_DEFS.find(c => c.id === cardId);
    const cardEl = document.createElement('div');
    cardEl.className = 'card-item visible';

    const cost = cardDef ? (cardDef.cost || 0) : 0;
    const costTier = getCardCostTier(cost);
    const tierClass = `cost-tier-${costTier}`;
    cardEl.classList.add(tierClass);
    const typeKey = _resolveCardDisplayTypeKey(cardDef, cardId);
    if (typeKey) {
        cardEl.dataset.cardType = typeKey;
    }
    applyCardSpecialArtToFace(cardEl, cardDef, { cardId, ownerKey: options && options.ownerKey });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'card-name';
    nameSpan.textContent = cardDef ? cardDef.name : '?';
    cardEl.appendChild(nameSpan);
    _fitCardNameElement(nameSpan);

    cardEl.appendChild(_createCardCostBadge(cost, tierClass));
    const badgeRow = _createCardBadgeRow(cardDef, cardId);
    if (badgeRow) {
        cardEl.appendChild(badgeRow);
    }

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
    return !!ev;
}

function _normalizeChargeDeltaOwnerKey(playerKey) {
    return _normalizePlayerKeyForRender(playerKey) === 'white' ? 'white' : 'black';
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

function _collectHudChargeDeltaTotalsBySign(events) {
    const list = Array.isArray(events) ? events : [];
    const totals = { increase: 0, decrease: 0 };
    const signOrder = [];
    for (const ev of list) {
        const delta = Number(ev && ev.delta ? ev.delta : 0);
        if (!Number.isFinite(delta) || delta === 0) continue;
        const signKey = delta > 0 ? 'increase' : 'decrease';
        if (totals[signKey] === 0) signOrder.push(signKey);
        totals[signKey] += delta;
    }
    return { totals, signOrder };
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
        const { totals, signOrder } = _collectHudChargeDeltaTotalsBySign(playerEvents);
        for (const signKey of signOrder) {
            const totalDelta = totals[signKey];
            if (totalDelta !== 0) {
                chargeDeltaHandler(player, totalDelta);
            }
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

function _resolveVisibleChargeOwners(matchMode) {
    const isNetworkMode = matchMode === 'network';
    const localPlayerKey = isNetworkMode ? _getLocalPlayerKeyForNetwork() : null;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveVisibleOwnerLayout === 'function') {
            return OwnerHelpersModule.resolveVisibleOwnerLayout({
                bottomOwnerKey: isNetworkMode ? localPlayerKey : 'black',
                defaultBottomOwnerKey: 'black',
                defaultTopOwnerKey: 'white'
            });
        }
    } catch (e) { /* ignore */ }
    const bottomOwnerKey = isNetworkMode
        ? localPlayerKey
        : 'black';
    return {
        bottomOwnerKey,
        topOwnerKey: bottomOwnerKey === 'black' ? 'white' : 'black'
    };
}

function _drainChargeDeltaPopups(cardState, options) {
    const state = _normalizeCardStateForRender(cardState);
    if (!state) {
        return {
            consumedAuthoritativeQueue: false,
            consumedTransientQueue: false,
            consumedRawFallback: false
        };
    }

    const opts = (options && typeof options === 'object') ? options : {};
    const matchMode = opts.matchMode || _getCurrentMatchMode();
    const visibleOwners = _resolveVisibleChargeOwners(matchMode);
    const baseChargeDeltaHandler = (typeof window !== 'undefined' && window.StoneVisuals && typeof window.StoneVisuals.showChargeDelta === 'function')
        ? window.StoneVisuals.showChargeDelta
        : null;
    const chargeDeltaHandler = _createVisibleChargeDeltaHandler(baseChargeDeltaHandler, visibleOwners.bottomOwnerKey);
    const chargeSnapshot = _readChargeDeltaSnapshot(state);

    if (_shouldResetChargeDeltaBaseline(chargeSnapshot.turnIndex)) {
        _resetChargeDeltaBaseline();
    }

    const consumedChargeDeltaSources = consumeChargeDeltaSourcesForRender(state, matchMode, chargeDeltaHandler);
    let consumedRawFallback = false;
    if (opts.allowRawFallback !== false
        && consumedChargeDeltaSources.allowRawFallback
        && !consumedChargeDeltaSources.consumedAuthoritativeQueue
        && !consumedChargeDeltaSources.consumedTransientQueue) {
        consumedRawFallback = _consumeRawChargeDeltaFallback(chargeSnapshot, chargeDeltaHandler);
    }

    _rememberChargeDeltaSnapshot(chargeSnapshot);
    return {
        consumedAuthoritativeQueue: consumedChargeDeltaSources.consumedAuthoritativeQueue,
        consumedTransientQueue: consumedChargeDeltaSources.consumedTransientQueue,
        consumedRawFallback
    };
}

function drainVisibleChargeDeltaPopups(options) {
    return _drainChargeDeltaPopups(_resolveCardRendererCardState(), options);
}

function renderCardUI() {
    const gameState = _resolveCardRendererGameState();
    const cardState = _normalizeCardStateForRender(_resolveCardRendererCardState());
    if (!gameState || !Array.isArray(gameState.board) || gameState.board.length <= 0 || !cardState) {
        return;
    }

    // Get elements
    const deckBlackEl = document.getElementById('deck-black');
    const deckWhiteEl = document.getElementById('deck-white');
    const handBlackEl = document.getElementById('hand-black');
    const handWhiteEl = document.getElementById('hand-white');

    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const matchMode = _getCurrentMatchMode();
    const visibleOwners = _resolveVisibleChargeOwners(matchMode);
    const isNetworkMode = matchMode === 'network';
    const bottomOwnerKey = visibleOwners.bottomOwnerKey;
    const topOwnerKey = visibleOwners.topOwnerKey;
    const localPlayerKey = isNetworkMode ? bottomOwnerKey : null;

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

    _drainChargeDeltaPopups(cardState, { matchMode });
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
    const deckVisualByOwner = {
        black: { count: deckCountBlack, total: totalBlack, ratio: deckRatioBlack },
        white: { count: deckCountWhite, total: totalWhite, ratio: deckRatioWhite }
    };
    const bottomDeckVisual = deckVisualByOwner[bottomOwnerKey] || deckVisualByOwner.black;
    const topDeckVisual = deckVisualByOwner[topOwnerKey] || deckVisualByOwner.white;

    // Set visuals for Black deck
    if (deckBlackEl) {
        deckBlackEl.style.setProperty('--deck-ratio', bottomDeckVisual.ratio);
        const countLabel = deckBlackEl.querySelector('.deck-count');
        if (countLabel) countLabel.textContent = `${bottomDeckVisual.count}/${bottomDeckVisual.total}`;
    }

    // Set visuals for White deck
    if (deckWhiteEl) {
        deckWhiteEl.style.setProperty('--deck-ratio', topDeckVisual.ratio);
        const countLabel = deckWhiteEl.querySelector('.deck-count');
        if (countLabel) countLabel.textContent = `${topDeckVisual.count}/${topDeckVisual.total}`;
    }

    const isBlackTurn = gameState.currentPlayer === BLACK;
    const isAnimating = _isCardAnimatingForRender();
    const staleVisualPlaybackLock = _isStaleVisualPlaybackLockForRender();
    const isDebugUnlimited = (typeof window !== 'undefined' && window.DEBUG_UNLIMITED_USAGE === true);
    const currentTurnOwnerKey = isBlackTurn ? 'black' : 'white';
    const fateWillControllerKey = (cardState.fateWillControllerByTurnOwner && cardState.fateWillControllerByTurnOwner[currentTurnOwnerKey]) || null;
    const fateWillVictimKey = fateWillControllerKey ? currentTurnOwnerKey : null;
    const fateWillIsActive = !!fateWillControllerKey;
    const inputPlayerKey = isNetworkMode
        ? localPlayerKey
        : (isDebugHvH ? (fateWillControllerKey || (isBlackTurn ? 'black' : 'white')) : 'black');
    const localRevealViewerKey = isNetworkMode ? null : _getLocalPlayerKeyForNetwork();
    const pendingOwnerKey = fateWillControllerKey && inputPlayerKey === fateWillControllerKey
        ? currentTurnOwnerKey
        : inputPlayerKey;
    const pending = cardState.pendingEffectByPlayer[pendingOwnerKey];
    const canInteract = !isAnimating || staleVisualPlaybackLock || isDebugUnlimited;
    const timeStopStatus = _resolveTimeStopStatusForRender(cardState, inputPlayerKey, gameState);

    const fadeState = (HandAnimationUtilsModule && typeof HandAnimationUtilsModule.getQueuedHandFadeInState === 'function')
        ? HandAnimationUtilsModule.getQueuedHandFadeInState()
        : ((typeof window !== 'undefined')
            ? (window.__handFadeInState || window.__handFadeInHint || null)
            : null);
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
    const captureReservedState = (typeof window !== 'undefined' && window.__captureReservedHandSlotState && typeof window.__captureReservedHandSlotState === 'object')
        ? window.__captureReservedHandSlotState
        : null;
    const reservedPlayerKey = (captureReservedState && (captureReservedState.playerKey === 'black' || captureReservedState.playerKey === 'white'))
        ? captureReservedState.playerKey
        : null;
    const reservedHandIndex = (captureReservedState && Number.isInteger(captureReservedState.handIndex))
        ? captureReservedState.handIndex
        : null;

    function _getOwnerHandForRender(ownerKey) {
        const ownerHandRaw = (cardState.hands && Array.isArray(cardState.hands[ownerKey])) ? cardState.hands[ownerKey] : [];
        return (revealPlayerKey === ownerKey && Number.isFinite(revealVisibleCount))
            ? ownerHandRaw.slice(0, Math.min(ownerHandRaw.length, revealVisibleCount))
            : ownerHandRaw;
    }

    function _resolveInsertedReservedHandIndex(ownerKey, ownerHandLength) {
        const ownerPending = cardState.pendingEffectByPlayer && cardState.pendingEffectByPlayer[ownerKey];
        if (
            ownerPending
            && ownerPending.type === 'CAPTURE_WILL'
            && ownerPending.stage === 'selectTarget'
            && Number.isInteger(ownerPending.sourceHandIndex)
        ) {
            return Math.max(0, Math.trunc(ownerPending.sourceHandIndex));
        }
        if (
            reservedPlayerKey === ownerKey
            && Number.isInteger(reservedHandIndex)
            && reservedHandIndex >= ownerHandLength
        ) {
            return reservedHandIndex;
        }
        return null;
    }

    function _buildHandRenderEntries(ownerHand, insertedReservedHandIndex) {
        const renderEntries = [];
        for (let idx = 0; idx < ownerHand.length; idx += 1) {
            if (Number.isInteger(insertedReservedHandIndex) && insertedReservedHandIndex === renderEntries.length) {
                renderEntries.push({ kind: 'capture_reserved_placeholder', visualIndex: renderEntries.length });
            }
            renderEntries.push({
                kind: 'card',
                cardId: ownerHand[idx],
                actualIndex: idx,
                visualIndex: renderEntries.length
            });
        }
        if (Number.isInteger(insertedReservedHandIndex) && insertedReservedHandIndex === renderEntries.length) {
            renderEntries.push({ kind: 'capture_reserved_placeholder', visualIndex: renderEntries.length });
        }
        return renderEntries;
    }

    const selectedOwnerKey = (cardState.selectedCardOwnerKey === 'white' || cardState.selectedCardOwnerKey === 'black')
        ? cardState.selectedCardOwnerKey
        : inputPlayerKey;

    function _resolveHandEntryViewState(entry, ownerKey, revealByDefault) {
        const visualIndex = entry && Number.isInteger(entry.visualIndex)
            ? entry.visualIndex
            : 0;
        const isPlaceholderOnly = !!(entry && entry.kind === 'capture_reserved_placeholder');
        const cardId = entry && entry.kind === 'card'
            ? entry.cardId
            : null;
        const actualIndex = entry && entry.kind === 'card' && Number.isInteger(entry.actualIndex)
            ? entry.actualIndex
            : null;
        const isCaptureReservedSlot = isPlaceholderOnly
            || (reservedPlayerKey === ownerKey && reservedHandIndex === visualIndex);
        const state = {
            visualIndex,
            isPlaceholderOnly,
            isCaptureReservedSlot,
            cardId,
            actualIndex,
            desiredKind: isPlaceholderOnly ? 'placeholder' : 'face',
            canInspectOwnerHand: false,
            canAfford: false,
            usable: false,
            isSelected: false
        };

        if (isPlaceholderOnly) {
            return state;
        }

        const isHiddenToken = _isHiddenHandTokenForRender(cardId);
        const isLocallyRevealedOpponentCard = !isNetworkMode
            && !revealByDefault
            && !isHiddenToken
            && _isHandCardRevealedToViewerForRender(cardState, localRevealViewerKey, ownerKey, actualIndex);
        const fateWillIsViewingVictim = fateWillIsActive
            && ownerKey === fateWillVictimKey
            && inputPlayerKey === fateWillControllerKey;
        const fateWillVictimLockedOut = fateWillIsActive
            && ownerKey === fateWillVictimKey
            && inputPlayerKey === fateWillVictimKey;
        const canShowFace = isNetworkMode
            ? (ownerKey === localPlayerKey || fateWillIsViewingVictim || !isHiddenToken)
            : (revealByDefault || isLocallyRevealedOpponentCard || fateWillIsViewingVictim);

        if (state.isCaptureReservedSlot) {
            state.desiredKind = 'placeholder';
            return state;
        }
        if (!canShowFace || isHiddenToken) {
            state.desiredKind = 'hidden';
            return state;
        }

        const cardDef = CARD_DEFS.find(c => c.id === cardId);
        const cost = cardDef ? (cardDef.cost || 0) : 0;
        const hasNotUsedThisTurn = isDebugUnlimited ? true : !_hasOwnerUsedCardThisActiveTurnForRender(cardState, ownerKey);
        const isOwnerTurn = ownerKey === 'black' ? isBlackTurn : !isBlackTurn;
        const canControlOwnerHand = isNetworkMode
            ? ((ownerKey === localPlayerKey && isOwnerTurn && !fateWillVictimLockedOut) || (fateWillIsViewingVictim && isOwnerTurn))
            : (isDebugHvH
                ? (isOwnerTurn && !fateWillVictimLockedOut)
                : ((ownerKey === 'black' && isOwnerTurn && !fateWillVictimLockedOut) || (fateWillIsViewingVictim && isOwnerTurn)));
        state.canAfford = isDebugUnlimited ? true : ((cardState.charge[ownerKey] || 0) >= cost);
        state.canInspectOwnerHand = isNetworkMode
            ? canShowFace
            : (isDebugHvH ? true : (ownerKey === 'black' || fateWillIsViewingVictim));
        state.usable = canControlOwnerHand && canInteract && hasNotUsedThisTurn && state.canAfford;
        state.isSelected = cardState.selectedCardId === cardId && selectedOwnerKey === ownerKey;
        return state;
    }

    function _ensureRenderedHandElement(handTrackEl, existingChildren, entryState, ownerKey) {
        let cardEl = existingChildren[entryState.visualIndex] || null;
        if (_canReuseHandCardElement(cardEl, entryState.desiredKind, entryState.cardId, ownerKey)) {
            return cardEl;
        }
        if (cardEl) {
            _detachHandCardClickHandler(cardEl);
        }
        if (entryState.desiredKind === 'placeholder') {
            cardEl = _createCaptureReservedSlotElement();
        } else if (entryState.desiredKind === 'hidden') {
            cardEl = _createHiddenHandCardElement(entryState.cardId, ownerKey);
        } else {
            cardEl = createCardFaceElement(entryState.cardId, { ownerKey });
        }
        const currentChild = handTrackEl.children[entryState.visualIndex] || null;
        if (currentChild) {
            handTrackEl.replaceChild(cardEl, currentChild);
        } else {
            handTrackEl.appendChild(cardEl);
        }
        return cardEl;
    }

    function _applyRenderedHandElementState(cardEl, entryState, ownerKey, shouldFade, ownerHandLen) {
        if (entryState.desiredKind === 'placeholder') {
            _detachHandCardClickHandler(cardEl);
            cardEl.className = 'card-item capture-reserved-slot';
            cardEl.style.opacity = '0';
            cardEl.style.pointerEvents = 'none';
            cardEl.setAttribute('aria-hidden', 'true');
            delete cardEl.dataset.cardId;
        } else if (entryState.desiredKind === 'hidden') {
            _detachHandCardClickHandler(cardEl);
            cardEl.className = 'card-item hidden';
            cardEl.textContent = 'CARD';
            cardEl.style.removeProperty('opacity');
            cardEl.style.removeProperty('pointer-events');
            cardEl.removeAttribute('aria-hidden');
            if (entryState.cardId) {
                cardEl.dataset.cardId = entryState.cardId;
            }
        } else {
            const canClick = entryState.canInspectOwnerHand && canInteract;
            _setHandCardClickHandler(cardEl, canClick, entryState.cardId, ownerKey);
            cardEl.classList.toggle('clickable', canClick);
            cardEl.classList.toggle('affordable', entryState.canAfford);
            cardEl.classList.toggle('usable', entryState.usable);
            cardEl.classList.toggle('selected', entryState.isSelected);
            cardEl.style.removeProperty('opacity');
            cardEl.style.removeProperty('pointer-events');
            cardEl.removeAttribute('aria-hidden');
            if (entryState.cardId) {
                cardEl.dataset.cardId = entryState.cardId;
            }
        }
        cardEl.dataset.ownerKey = ownerKey;
        cardEl.dataset.handIndex = String(entryState.visualIndex);
        if (!entryState.cardId) {
            delete cardEl.dataset.cardId;
        }
        if (
            !entryState.isPlaceholderOnly
            && shouldFade
            && entryState.actualIndex >= Math.max(0, ownerHandLen - fadeCount)
        ) {
            cardEl.classList.add('card-fade-prep');
        } else {
            cardEl.classList.remove('card-fade-prep');
        }
    }

    function renderHandSlot(containerEl, ownerKey, revealByDefault, visibleSlotKey) {
        if (!containerEl) return;
        containerEl.dataset.ownerKey = ownerKey;
        const showTimeStopVictimOverlay = !!(
            timeStopStatus.active
            && timeStopStatus.viewerRole === 'victim'
            && visibleSlotKey === 'bottom'
        );
        containerEl.classList.toggle('time-stop-hand-overlay-active', showTimeStopVictimOverlay);
        const handTrackEl = _ensureHandTrackElement(containerEl);
        if (!handTrackEl) return;

        const ownerHand = _getOwnerHandForRender(ownerKey);
        const shouldFade = fadePlayerKey === ownerKey && fadeCount > 0;
        const renderEntries = _buildHandRenderEntries(
            ownerHand,
            _resolveInsertedReservedHandIndex(ownerKey, ownerHand.length)
        );
        const existingChildren = Array.from(handTrackEl.children);

        renderEntries.forEach((entry) => {
            const entryState = _resolveHandEntryViewState(entry, ownerKey, revealByDefault);
            const cardEl = _ensureRenderedHandElement(handTrackEl, existingChildren, entryState, ownerKey);
            _applyRenderedHandElementState(cardEl, entryState, ownerKey, shouldFade, ownerHand.length);
        });

        while (handTrackEl.children.length > renderEntries.length) {
            const extraChild = handTrackEl.lastElementChild;
            if (!extraChild) break;
            _detachHandCardClickHandler(extraChild);
            handTrackEl.removeChild(extraChild);
        }

        _syncTimeStopHandOverlayForRender(containerEl, showTimeStopVictimOverlay);
    }

    renderHandSlot(handBlackEl, bottomOwnerKey, true, 'bottom');
    renderHandSlot(handWhiteEl, topOwnerKey, isDebugHvH === true, 'top');
    _syncTimeStopChargeBadgeForRender(chargeWhiteEl, timeStopStatus.active && timeStopStatus.viewerRole === 'controller');
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

try {
    if (typeof window !== 'undefined') {
        window.drainVisibleChargeDeltaPopups = drainVisibleChargeDeltaPopups;
    }
} catch (e) { /* ignore */ }
