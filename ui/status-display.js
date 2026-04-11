// ===== Status Display =====
// Import difficulty level constants
// (included via <script> in index.html before this file)

let portraitSpeechHideTimer = null;
let portraitSpeechViewportHandlersBound = false;
let roundDisplayViewportHandlersBound = false;
let roundDisplayResizeObserver = null;
let roundDisplayBonusTimer = null;
let roundDisplayBonusFadeTimer = null;
let roundDisplayBonusState = null;
const ROUND_DISPLAY_BONUS_FADE_OUT_MS = 320;
const HERO_DEFAULT_LABEL = 'オセロの勇者';
const NETWORK_WAITING_NAME = '接続待ち';
const PORTRAIT_SPEECH_ROLE_CPU = 'cpu';
const PORTRAIT_SPEECH_ROLE_HERO = 'hero';
const PORTRAIT_SPEECH_CONFIG = {
    cpu: {
        role: PORTRAIT_SPEECH_ROLE_CPU,
        bubbleId: 'cpu-speech-bubble',
        imageId: 'cpu-character-img',
        panelId: 'cpu-character-panel'
    },
    hero: {
        role: PORTRAIT_SPEECH_ROLE_HERO,
        bubbleId: 'hero-speech-bubble',
        imageId: 'hero-character-img',
        panelId: 'hero-character-panel'
    }
};
let StatusDisplayOwnerHelpersModule = null;
if (typeof require === 'function') {
    try { StatusDisplayOwnerHelpersModule = require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!StatusDisplayOwnerHelpersModule) {
    try {
        if (typeof window !== 'undefined' && window && window.OwnerHelpers) StatusDisplayOwnerHelpersModule = window.OwnerHelpers;
    } catch (e) { /* ignore */ }
}

function normalizeSeatKeyForLabel(value) {
    try {
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.normalizePlayerKey === 'function') {
            return StatusDisplayOwnerHelpersModule.normalizePlayerKey(value, 'black');
        }
    } catch (e) { /* ignore */ }
    return value === 'white' ? 'white' : 'black';
}

function toSeatLabel(value) {
    return normalizeSeatKeyForLabel(value) === 'white' ? '白' : '黒';
}

function normalizeNetworkDisplayName(value) {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized;
}

function isNetworkModeForLabels() {
    try {
        if (typeof window === 'undefined' || !window) return false;
        if (window.MatchMode && typeof window.MatchMode.isNetworkModeActive === 'function') {
            return !!window.MatchMode.isNetworkModeActive();
        }
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.isNetworkMode === 'function') {
            return !!StatusDisplayOwnerHelpersModule.isNetworkMode(window);
        }
        return window.MATCH_MODE === 'network' || window.__MATCH_MODE === 'network';
    } catch (e) {
        return false;
    }
}

function getNetworkSeatNamesForLabels() {
    try {
        if (typeof window !== 'undefined' && window && window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatNames === 'function') {
            const names = window.NetworkMatchClient.getSeatNames();
            if (names && typeof names === 'object') return names;
        }
    } catch (e) { /* ignore */ }
    return { black: '', white: '' };
}

function getOwnSeatKeyForLabels() {
    try {
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return normalizeSeatKeyForLabel(StatusDisplayOwnerHelpersModule.resolveLocalPlayerKey(window));
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window && window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
            return normalizeSeatKeyForLabel(window.NetworkMatchClient.getSeatKey());
        }
    } catch (e) { /* ignore */ }
    return 'black';
}

function getTutorialStateApiForStatus() {
    try {
        if (typeof window !== 'undefined' && window && window.Tutorial && window.Tutorial.State) {
            return window.Tutorial.State;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function getStoryEncounterApiForStatus() {
    try {
        if (typeof window !== 'undefined' && window && window.Story && window.Story.Encounter) {
            return window.Story.Encounter;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveStoryEncounterCpuPresentation() {
    const encounterApi = getStoryEncounterApiForStatus();
    if (!encounterApi || typeof encounterApi.resolveStoryEncounterPresentation !== 'function') {
        return null;
    }
    return encounterApi.resolveStoryEncounterPresentation();
}

function resolveObserverDuelCpuPresentation() {
    const stateApi = getTutorialStateApiForStatus();
    if (!stateApi || typeof stateApi.isObserverDuelActive !== 'function' || !stateApi.isObserverDuelActive()) {
        return null;
    }

    const scenario = typeof stateApi.getTutorialScenarioContext === 'function'
        ? stateApi.getTutorialScenarioContext()
        : null;
    return {
        imageSrc: scenario && scenario.observerImageSrc ? String(scenario.observerImageSrc) : 'assets/images/cpu/level6.png',
        label: scenario && scenario.observerName ? String(scenario.observerName) : '盤理の観測者',
        fadeOut: !!(scenario && scenario.observerDuelPostResultPhase === 'fade_out')
    };
}

function applyObserverDuelCpuPanelState(observerDuelPresentation, charImg, levelLabel) {
    const panel = document.getElementById('cpu-character-panel');
    const faded = !!(observerDuelPresentation && observerDuelPresentation.fadeOut === true);
    if (panel) {
        panel.style.transition = 'opacity 280ms ease';
        panel.style.opacity = faded ? '0.18' : '1';
    }
    if (charImg) {
        charImg.style.opacity = faded ? '0.18' : '1';
    }
    if (levelLabel) {
        levelLabel.style.opacity = faded ? '0.42' : '1';
    }
}

function applyNetworkSeatLabels(levelLabel) {
    const heroLabel = document.getElementById('hero-label');
    if (!isNetworkModeForLabels()) {
        if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        return false;
    }

    const ownSeatKey = getOwnSeatKeyForLabels();
    const opponentSeatKey = ownSeatKey === 'white' ? 'black' : 'white';
    const seatNames = getNetworkSeatNamesForLabels();

    const ownName = normalizeNetworkDisplayName(seatNames[ownSeatKey]) || 'あなた';
    const opponentName = normalizeNetworkDisplayName(seatNames[opponentSeatKey]) || NETWORK_WAITING_NAME;

    if (heroLabel) {
        heroLabel.textContent = `${toSeatLabel(ownSeatKey)}:${ownName}`;
    }
    if (levelLabel) {
        levelLabel.textContent = `${toSeatLabel(opponentSeatKey)}:${opponentName}`;
    }
    return true;
}

function normalizePortraitSpeechRole(value) {
    return value === PORTRAIT_SPEECH_ROLE_HERO ? PORTRAIT_SPEECH_ROLE_HERO : PORTRAIT_SPEECH_ROLE_CPU;
}

function resolvePortraitSpeechConfig(value) {
    const roleValue = value && typeof value === 'object'
        ? (value.speakerRole || value.role)
        : value;
    const role = normalizePortraitSpeechRole(roleValue);
    return PORTRAIT_SPEECH_CONFIG[role] || PORTRAIT_SPEECH_CONFIG.cpu;
}

function getPortraitSpeechBubbleElement(value) {
    if (typeof document === 'undefined') return null;
    const config = resolvePortraitSpeechConfig(value);
    return document.getElementById(config.bubbleId);
}

function ensurePortraitSpeechBubbleElement(value) {
    if (typeof document === 'undefined' || !document.body) return null;
    const config = resolvePortraitSpeechConfig(value);
    let bubble = getPortraitSpeechBubbleElement(config.role);
    if (bubble) return bubble;

    bubble = document.createElement('div');
    bubble.id = config.bubbleId;
    bubble.setAttribute('aria-live', 'polite');
    bubble.setAttribute('aria-atomic', 'true');
    bubble.setAttribute('role', 'status');
    document.body.appendChild(bubble);
    return bubble;
}

function getPortraitSpeechAnchorRect(value) {
    if (typeof document === 'undefined') return null;
    const config = resolvePortraitSpeechConfig(value);
    const img = document.getElementById(config.imageId);
    const panel = document.getElementById(config.panelId);
    const target = (img && img.getAttribute('src')) ? img : panel;
    if (!target || typeof target.getBoundingClientRect !== 'function') return null;
    const rect = target.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) return null;
    return rect;
}

function positionPortraitSpeechBubble(value) {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const config = resolvePortraitSpeechConfig(value);
    const bubble = getPortraitSpeechBubbleElement(config.role);
    if (!bubble || !bubble.classList.contains('is-visible')) return;
    const rect = getPortraitSpeechAnchorRect(config.role);
    if (!rect) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
    const gap = viewportWidth <= 900 ? 14 : 18;

    bubble.style.maxWidth = viewportWidth <= 900
        ? `min(72vw, 320px)`
        : `min(46vw, 420px)`;
    bubble.style.left = `${rect.left + (rect.width / 2)}px`;
    bubble.style.top = `${Math.max(24, rect.top - gap)}px`;

    const bRect = bubble.getBoundingClientRect();
    if (bRect.top < 8) {
        const currentTop = Number.parseFloat(bubble.style.top) || 24;
        bubble.style.top = `${currentTop + (8 - bRect.top)}px`;
    }

    const adjusted = bubble.getBoundingClientRect();
    if (adjusted.left < 8 || adjusted.right > viewportWidth - 8) {
        const currentLeft = Number.parseFloat(bubble.style.left) || (rect.left + (rect.width / 2));
        if (adjusted.left < 8) {
            bubble.style.left = `${currentLeft + (8 - adjusted.left)}px`;
        } else if (adjusted.right > viewportWidth - 8) {
            bubble.style.left = `${currentLeft - (adjusted.right - (viewportWidth - 8))}px`;
        }
    }
}

function positionAllPortraitSpeechBubbles() {
    positionPortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_CPU);
    positionPortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_HERO);
}

function bindPortraitSpeechViewportHandlers() {
    if (portraitSpeechViewportHandlersBound || typeof window === 'undefined') return;
    portraitSpeechViewportHandlersBound = true;
    const handler = () => {
        try { positionAllPortraitSpeechBubbles(); } catch (e) { /* ignore */ }
    };
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    window.addEventListener('scroll', handler, { passive: true });
}

function hidePortraitSpeechBubble(role) {
    const roles = role
        ? [normalizePortraitSpeechRole(role)]
        : [PORTRAIT_SPEECH_ROLE_CPU, PORTRAIT_SPEECH_ROLE_HERO];
    roles.forEach((speakerRole) => {
        const bubble = getPortraitSpeechBubbleElement(speakerRole);
        if (!bubble) return;
        bubble.classList.remove('is-visible');
        bubble.textContent = '';
    });
    if (portraitSpeechHideTimer) {
        clearTimeout(portraitSpeechHideTimer);
        portraitSpeechHideTimer = null;
    }
}

function positionCpuSpeechBubble() {
    positionPortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_CPU);
}

function hideCpuSpeechBubble() {
    hidePortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_CPU);
}

function hideHeroSpeechBubble() {
    hidePortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_HERO);
}

function showPortraitSpeechBubble(text, options = {}) {
    const line = String(text || '').trim();
    if (!line || typeof document === 'undefined') return;
    const config = resolvePortraitSpeechConfig(options);
    const bubble = ensurePortraitSpeechBubbleElement(config.role);
    if (!bubble) return;

    bindPortraitSpeechViewportHandlers();
    hidePortraitSpeechBubble(config.role);
    bubble.textContent = line;
    bubble.classList.add('is-visible');
    positionPortraitSpeechBubble(config.role);

    if (portraitSpeechHideTimer) {
        clearTimeout(portraitSpeechHideTimer);
        portraitSpeechHideTimer = null;
    }
}

function getGameStateForStatusDisplay() {
    try {
        if (typeof window !== 'undefined' && window && window.gameState) return window.gameState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof gameState !== 'undefined' && gameState) return gameState;
    } catch (e) { /* ignore */ }
    return null;
}

function getRoundDisplayElement() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('round-display-panel');
}

function getEffectLivePanelElement() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('effect-live-panel');
}

function getRoundDisplayBoardAnchorElement() {
    if (typeof document === 'undefined') return null;
    return document.getElementById('board-frame') || document.getElementById('board');
}

function getLayoutStageScaleForStatusDisplay() {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.documentElement) return 1;
    try {
        const rootStyle = window.getComputedStyle(document.documentElement);
        const scale = Number.parseFloat(rootStyle.getPropertyValue('--layout-stage-scale'));
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    } catch (e) {
        return 1;
    }
}

function resolveRoundNumberForStatusDisplay() {
    const state = getGameStateForStatusDisplay();
    const explicitRoundNumber = Number(state && state.roundNumber);
    if (Number.isFinite(explicitRoundNumber) && explicitRoundNumber >= 1) {
        return Math.trunc(explicitRoundNumber);
    }
    const completedTurns = Number.isFinite(Number(state && state.turnNumber))
        ? Math.max(0, Math.trunc(Number(state.turnNumber)))
        : 0;
    return Math.floor(completedTurns / 2) + 1;
}

function setRoundDisplayVisibility(roundEl, visible) {
    if (!roundEl) return;
    roundEl.style.display = visible ? 'inline-flex' : 'none';
    roundEl.style.visibility = visible ? 'visible' : 'hidden';
}

function hasActiveRoundDisplayBonus() {
    return !!(roundDisplayBonusState && typeof roundDisplayBonusState.text === 'string' && roundDisplayBonusState.text.trim());
}

function setRoundDisplayBonusClass(roundEl, active) {
    if (!roundEl || !roundEl.classList) return;
    if (active) roundEl.classList.add('is-round-bonus-active');
    else roundEl.classList.remove('is-round-bonus-active');
}

function setRoundDisplayBonusFadeClass(roundEl, active) {
    if (!roundEl || !roundEl.classList) return;
    if (active) roundEl.classList.add('is-round-bonus-fading');
    else roundEl.classList.remove('is-round-bonus-fading');
}

function activateRoundDisplayBonus(roundEl) {
    if (!roundEl) return;
    if (roundEl.classList && roundEl.classList.contains('is-round-bonus-active')) {
        roundEl.classList.remove('is-round-bonus-active');
        void roundEl.offsetWidth;
    }
    setRoundDisplayBonusFadeClass(roundEl, false);
    setRoundDisplayBonusClass(roundEl, true);
}

function clearRoundDisplayBonusTimers() {
    if (roundDisplayBonusTimer) {
        clearTimeout(roundDisplayBonusTimer);
        roundDisplayBonusTimer = null;
    }
    if (roundDisplayBonusFadeTimer) {
        clearTimeout(roundDisplayBonusFadeTimer);
        roundDisplayBonusFadeTimer = null;
    }
}

function startRoundDisplayBonusFadeOut(fadeOutMs, updateAfterClear = true) {
    const roundEl = getRoundDisplayElement();
    setRoundDisplayBonusFadeClass(roundEl, true);
    if (roundDisplayBonusFadeTimer) {
        clearTimeout(roundDisplayBonusFadeTimer);
        roundDisplayBonusFadeTimer = null;
    }
    roundDisplayBonusFadeTimer = setTimeout(() => {
        clearRoundDisplayBonus(updateAfterClear);
    }, fadeOutMs);
}

function clearRoundDisplayBonus(updateAfterClear = true) {
    clearRoundDisplayBonusTimers();
    roundDisplayBonusState = null;
    const roundEl = getRoundDisplayElement();
    setRoundDisplayBonusFadeClass(roundEl, false);
    setRoundDisplayBonusClass(roundEl, false);
    if (updateAfterClear) updateRoundDisplay();
}

function resolveRoundDisplayText() {
    if (hasActiveRoundDisplayBonus()) {
        return roundDisplayBonusState.text.trim();
    }
    return `ROUND ${resolveRoundNumberForStatusDisplay()}`;
}

function showRoundBonusDisplay(payload) {
    const data = (payload && typeof payload === 'object') ? payload : {};
    const amount = Number.isFinite(Number(data.amount))
        ? Math.max(0, Math.trunc(Number(data.amount)))
        : 0;
    if (!(amount > 0)) return;
    const durationMs = Number.isFinite(Number(data.durationMs))
        ? Math.max(0, Math.trunc(Number(data.durationMs)))
        : 3000;
    const fadeOutMs = Number.isFinite(Number(data.fadeOutMs))
        ? Math.max(0, Math.trunc(Number(data.fadeOutMs)))
        : ROUND_DISPLAY_BONUS_FADE_OUT_MS;
    const text = (typeof data.text === 'string' && data.text.trim())
        ? data.text.trim()
        : `BONUS ROUND +${amount}`;
    roundDisplayBonusState = { text };
    const roundEl = getRoundDisplayElement();
    if (roundEl) {
        roundEl.textContent = text;
        activateRoundDisplayBonus(roundEl);
    }
    bindRoundDisplayViewportHandlers();
    positionRoundDisplay();
    clearRoundDisplayBonusTimers();
    roundDisplayBonusTimer = setTimeout(() => {
        startRoundDisplayBonusFadeOut(fadeOutMs, true);
    }, durationMs);
}

function positionRoundDisplay() {
    if (typeof window === 'undefined') return;
    const roundEl = getRoundDisplayElement();
    const effectPanel = getEffectLivePanelElement();
    const boardAnchor = getRoundDisplayBoardAnchorElement();
    if (!roundEl || !effectPanel) return;

    const effectStyle = typeof window.getComputedStyle === 'function'
        ? window.getComputedStyle(effectPanel)
        : null;
    if (!effectStyle || effectStyle.display === 'none' || effectStyle.visibility === 'hidden') {
        setRoundDisplayVisibility(roundEl, false);
        return;
    }

    setRoundDisplayVisibility(roundEl, true);
    const effectRect = effectPanel.getBoundingClientRect();
    if (!Number.isFinite(effectRect.left)) return;

    let targetTop = effectRect.top;
    if (boardAnchor && typeof boardAnchor.getBoundingClientRect === 'function') {
        const boardRect = boardAnchor.getBoundingClientRect();
        if (Number.isFinite(boardRect.top)) {
            targetTop = boardRect.top;
        }
    }

    roundEl.style.left = `${Math.round(effectRect.left)}px`;
    roundEl.style.top = `${Math.round(Math.max(8, targetTop))}px`;
}

function bindRoundDisplayViewportHandlers() {
    if (roundDisplayViewportHandlersBound || typeof window === 'undefined') return;
    roundDisplayViewportHandlersBound = true;

    const reposition = () => {
        try { positionRoundDisplay(); } catch (e) { /* ignore */ }
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('orientationchange', reposition);
    window.addEventListener('load', reposition);

    if (typeof ResizeObserver === 'function') {
        try {
            const effectPanel = getEffectLivePanelElement();
            if (effectPanel) {
                roundDisplayResizeObserver = new ResizeObserver(reposition);
                roundDisplayResizeObserver.observe(effectPanel);
            }
        } catch (e) { /* ignore */ }
    }
}

function updateRoundDisplay() {
    const roundEl = getRoundDisplayElement();
    if (!roundEl) return;
    roundEl.textContent = resolveRoundDisplayText();
    setRoundDisplayBonusClass(roundEl, hasActiveRoundDisplayBonus());
    bindRoundDisplayViewportHandlers();
    positionRoundDisplay();
}

function showCpuSpeechBubble(text, options = {}) {
    showPortraitSpeechBubble(text, options);
}

function showHeroSpeechBubble(text, options = {}) {
    const bubbleOptions = Object.assign({}, options || {}, { speakerRole: PORTRAIT_SPEECH_ROLE_HERO });
    showPortraitSpeechBubble(text, bubbleOptions);
}

// ===== FATE_WILL Banner =====

const FATE_WILL_BANNER_ID = 'fate-will-banner';

function _getCardStateForFateWillBanner() {
    try { if (typeof cardState !== 'undefined' && cardState) return cardState; } catch (e) { /* ignore */ }
    try { if (typeof window !== 'undefined' && window && window.cardState) return window.cardState; } catch (e) { /* ignore */ }
    return null;
}

function _getFateWillBannerText() {
    const cs = _getCardStateForFateWillBanner();
    const gs = getGameStateForStatusDisplay();
    if (!cs || !cs.fateWillControllerByTurnOwner || !gs) return null;
    const BLACK_VAL = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const currentPlayerKey = gs.currentPlayer === BLACK_VAL ? 'black' : 'white';
    const controller = cs.fateWillControllerByTurnOwner[currentPlayerKey];
    if (!controller) return null;
    if (!isNetworkModeForLabels()) return '運命の意志発動中';
    const localSeat = getOwnSeatKeyForLabels();
    if (localSeat === controller) return '運命の意志発動中 ▸ 代理操作中';
    return '運命の意志発動中 ▸ 相手代理操作中';
}

function getFateWillBannerElement() {
    if (typeof document === 'undefined') return null;
    return document.getElementById(FATE_WILL_BANNER_ID);
}

function ensureFateWillBannerElement() {
    if (typeof document === 'undefined' || !document.body) return null;
    let el = getFateWillBannerElement();
    if (el) return el;
    el = document.createElement('div');
    el.id = FATE_WILL_BANNER_ID;
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
    return el;
}

function updateFateWillBanner() {
    const text = _getFateWillBannerText();
    if (!text) {
        const el = getFateWillBannerElement();
        if (el) el.classList.remove('is-visible');
        return;
    }
    const el = ensureFateWillBannerElement();
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-visible');
}

function updateStatus() {
    updateRoundDisplay();
    updateCpuCharacter();
    try { updateFateWillBanner(); } catch (e) { /* ignore */ }
}

function applyCpuCharacterLevelScale(charImg, level) {
    if (!charImg) {
        return;
    }

    const levelNumber = Number(level);
    const normalizedLevel = Number.isFinite(levelNumber)
        ? Math.min(6, Math.max(1, Math.round(levelNumber)))
        : 1;
    const CPU_BASE_VISUAL_SCALE = 0.88;
    const levelScale = CPU_BASE_VISUAL_SCALE * (1 + ((normalizedLevel - 1) * 0.1));

    // Keep CPU image on the same stage-based sizing path as other UI elements.
    // Only apply the Lv倍率 via CSS custom property.
    charImg.style.width = '';
    charImg.style.height = '';
    charImg.style.transform = '';
    charImg.style.transformOrigin = '';
    charImg.style.setProperty('--cpu-level-scale', levelScale.toFixed(3));
}

function updateCpuCharacter() {
    const level = cpuSmartness.white || 1;
    const storyEncounterPresentation = resolveStoryEncounterCpuPresentation();
    const observerDuelPresentation = resolveObserverDuelCpuPresentation();
    const specialPresentation = storyEncounterPresentation || observerDuelPresentation;
    const displayLevel = observerDuelPresentation ? 6 : level;
    const charImg = getElement('cpuCharacterImg');
    const levelLabel = getElement('cpuLevelLabel');
    const heroLabel = document.getElementById('hero-label');
    
    if (charImg && levelLabel) {
        const primaryPath = specialPresentation && specialPresentation.imageSrc
            ? String(specialPresentation.imageSrc)
            : `assets/images/cpu/level${displayLevel}.png`;
        const fallbackCandidates = [];
        const levelImagePath = `assets/images/cpu/level${displayLevel}.png`;
        const legacyFallbackPath = `assets/cpu-characters/level${displayLevel}.png`;
        if (levelImagePath !== primaryPath) fallbackCandidates.push(levelImagePath);
        fallbackCandidates.push(legacyFallbackPath);
        let fallbackIndex = 0;
        
        // プリロード + フェード効果（新パス→旧パスの順で試行）
        const img = new Image();
        img.onload = () => {
            charImg.src = img.src;
            applyCpuCharacterLevelScale(charImg, displayLevel);
            applyObserverDuelCpuPanelState(observerDuelPresentation, charImg, levelLabel);
            try { positionCpuSpeechBubble(); } catch (e) { /* ignore */ }
        };
        img.onerror = () => {
            while (fallbackIndex < fallbackCandidates.length) {
                const nextPath = fallbackCandidates[fallbackIndex++];
                if (nextPath && img.src !== nextPath) {
                    img.src = nextPath;
                    return;
                }
            }
            charImg.style.opacity = '0.3';
            charImg.style.transform = '';
            charImg.style.width = '';
            charImg.style.height = '';
            charImg.style.removeProperty('--cpu-level-scale');
            applyObserverDuelCpuPanelState(observerDuelPresentation, charImg, levelLabel);
            console.warn(`敵キャラクター画像が見つかりません: ${primaryPath}`);
        };
        img.src = primaryPath;

        levelLabel.textContent = specialPresentation
            ? specialPresentation.label
            : (CPU_LEVEL_NAMES[level] || 'レベル ' + level);
        if (specialPresentation) {
            if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        } else {
            applyNetworkSeatLabels(levelLabel);
        }
    }
}

if (typeof window !== 'undefined') {
    try { window.showCpuSpeechBubble = showCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { window.hideCpuSpeechBubble = hideCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { window.positionCpuSpeechBubble = positionCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { window.showHeroSpeechBubble = showHeroSpeechBubble; } catch (e) { /* ignore */ }
    try { window.hideHeroSpeechBubble = hideHeroSpeechBubble; } catch (e) { /* ignore */ }
    try { window.showRoundBonusDisplay = showRoundBonusDisplay; } catch (e) { /* ignore */ }
    try { window.clearRoundDisplayBonus = clearRoundDisplayBonus; } catch (e) { /* ignore */ }
    try { window.updateCpuCharacter = updateCpuCharacter; } catch (e) { /* ignore */ }
    try { window.updateStatus = updateStatus; } catch (e) { /* ignore */ }
    try { window.updateFateWillBanner = updateFateWillBanner; } catch (e) { /* ignore */ }
    try { updateRoundDisplay(); } catch (e) { /* ignore */ }
}

function resolveResultOverlayApiForStatusDisplay() {
    try {
        if (typeof require === 'function') {
            const resultOverlay = require('./result-overlay.js');
            if (resultOverlay && typeof resultOverlay === 'object') return resultOverlay;
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof globalThis !== 'undefined') {
            const api = {
                showResult: (typeof globalThis.showResult === 'function' && globalThis.showResult !== showResult)
                    ? globalThis.showResult.bind(globalThis)
                    : null,
                showResultOverlay: (typeof globalThis.showResultOverlay === 'function' && globalThis.showResultOverlay !== showResultOverlay)
                    ? globalThis.showResultOverlay.bind(globalThis)
                    : null
            };
            if (api.showResult || api.showResultOverlay) return api;
        }
    } catch (e) { /* ignore */ }

    return null;
}

function showResult() {
    const resultOverlayApi = resolveResultOverlayApiForStatusDisplay();
    if (!resultOverlayApi || typeof resultOverlayApi.showResult !== 'function') {
        console.warn('[status-display] result-overlay.showResult unavailable');
        return;
    }
    return resultOverlayApi.showResult();
}

// Create or show a result overlay in the center of the screen.
function showResultOverlay() {
    const resultOverlayApi = resolveResultOverlayApiForStatusDisplay();
    if (!resultOverlayApi || typeof resultOverlayApi.showResultOverlay !== 'function') {
        console.warn('[status-display] result-overlay.showResultOverlay unavailable');
        return;
    }
    return resultOverlayApi.showResultOverlay();
}
