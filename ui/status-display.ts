import type { CardState, GameState, PlayerKey } from '../src/types';

'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require) as NodeRequire;

let portraitSpeechHideTimer: any = null;
let portraitSpeechViewportHandlersBound = false;
let roundDisplayViewportHandlersBound = false;
let roundDisplayResizeObserver: any = null;
let roundDisplayBonusTimer: any = null;
let roundDisplayBonusFadeTimer: any = null;
let roundDisplayBonusState: any = null;
const ROUND_DISPLAY_BONUS_FADE_OUT_MS = 320;
const HERO_DEFAULT_LABEL = 'オセロの勇者';
const HERO_IMAGE_SRC = 'assets/images/hero/hero.png';
const NETWORK_OPPONENT_HERO_CLASS = 'is-network-opponent-hero';
const NETWORK_WAITING_NAME = '接続待ち';
const PORTRAIT_SPEECH_ROLE_CPU = 'cpu';
const PORTRAIT_SPEECH_ROLE_HERO = 'hero';
const PORTRAIT_SPEECH_CONFIG: any = {
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
let StatusDisplayOwnerHelpersModule: any = null;
if (typeof _require === 'function') {
    try { StatusDisplayOwnerHelpersModule = _require('../utils/owner-helpers'); } catch (e) { /* ignore */ }
}
if (!StatusDisplayOwnerHelpersModule) {
    try {
        if (typeof window !== 'undefined' && window && (window as any).OwnerHelpers) StatusDisplayOwnerHelpersModule = (window as any).OwnerHelpers;
    } catch (e) { /* ignore */ }
}

function normalizeSeatKeyForLabel(value: any): string {
    try {
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.normalizePlayerKey === 'function') {
            return StatusDisplayOwnerHelpersModule.normalizePlayerKey(value, 'black');
        }
    } catch (e) { /* ignore */ }
    return value === 'white' ? 'white' : 'black';
}

function toSeatLabel(value: any): string {
    return normalizeSeatKeyForLabel(value) === 'white' ? '白' : '黒';
}

function normalizeNetworkDisplayName(value: any): string {
    const normalized = String(value || '').replace(/\s+/g, ' ').trim();
    return normalized;
}

function isNetworkModeForLabels(): boolean {
    try {
        if (typeof window === 'undefined' || !window) return false;
        if ((window as any).MatchMode && typeof (window as any).MatchMode.isNetworkModeActive === 'function') {
            return !!(window as any).MatchMode.isNetworkModeActive();
        }
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.isNetworkMode === 'function') {
            return !!StatusDisplayOwnerHelpersModule.isNetworkMode(window);
        }
        return (window as any).MATCH_MODE === 'network' || (window as any).__MATCH_MODE === 'network';
    } catch (e) {
        return false;
    }
}

function getNetworkSeatNamesForLabels(): any {
    try {
        if (typeof window !== 'undefined' && window && (window as any).NetworkMatchClient && typeof (window as any).NetworkMatchClient.getSeatNames === 'function') {
            const names = (window as any).NetworkMatchClient.getSeatNames();
            if (names && typeof names === 'object') return names;
        }
    } catch (e) { /* ignore */ }
    return { black: '', white: '' };
}

function getOwnSeatKeyForLabels(): string {
    try {
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return normalizeSeatKeyForLabel(StatusDisplayOwnerHelpersModule.resolveLocalPlayerKey(window));
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window && (window as any).NetworkMatchClient && typeof (window as any).NetworkMatchClient.getSeatKey === 'function') {
            return normalizeSeatKeyForLabel((window as any).NetworkMatchClient.getSeatKey());
        }
    } catch (e) { /* ignore */ }
    return 'black';
}

function getTutorialStateApiForStatus(): any {
    try {
        if (typeof window !== 'undefined' && window && (window as any).Tutorial && (window as any).Tutorial.State) {
            return (window as any).Tutorial.State;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function getStoryEncounterApiForStatus(): any {
    try {
        if (typeof window !== 'undefined' && window && (window as any).Story && (window as any).Story.Encounter) {
            return (window as any).Story.Encounter;
        }
    } catch (e) { /* ignore */ }
    return null;
}

function resolveStoryEncounterCpuPresentation(): any {
    const encounterApi = getStoryEncounterApiForStatus();
    if (!encounterApi || typeof encounterApi.resolveStoryEncounterPresentation !== 'function') {
        return null;
    }
    return encounterApi.resolveStoryEncounterPresentation();
}

function resolveObserverDuelCpuPresentation(): any {
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

function applyObserverDuelCpuPanelState(observerDuelPresentation: any, charImg: any, levelLabel: any): void {
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

function applyNetworkSeatLabels(levelLabel: any): boolean {
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

function normalizePortraitSpeechRole(value: any): string {
    return value === PORTRAIT_SPEECH_ROLE_HERO ? PORTRAIT_SPEECH_ROLE_HERO : PORTRAIT_SPEECH_ROLE_CPU;
}

function resolvePortraitSpeechConfig(value: any): any {
    const roleValue = value && typeof value === 'object'
        ? (value.speakerRole || value.role)
        : value;
    const role = normalizePortraitSpeechRole(roleValue);
    return PORTRAIT_SPEECH_CONFIG[role] || PORTRAIT_SPEECH_CONFIG.cpu;
}

function getPortraitSpeechBubbleElement(value: any): any {
    if (typeof document === 'undefined') return null;
    const config = resolvePortraitSpeechConfig(value);
    return document.getElementById(config.bubbleId);
}

function ensurePortraitSpeechBubbleElement(value: any): any {
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

function getPortraitSpeechAnchorRect(value: any): any {
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

function getPortraitSpeechBoardRect(): any {
    const boardAnchor = getRoundDisplayBoardAnchorElement();
    if (!boardAnchor || typeof boardAnchor.getBoundingClientRect !== 'function') return null;
    const rect = boardAnchor.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.right) || rect.right <= rect.left) return null;
    return rect;
}

function getPortraitSpeechBubbleBaseMaxWidth(viewportWidth: number): number {
    if (viewportWidth <= 900) {
        return Math.min(Math.floor(viewportWidth * 0.72), 320);
    }
    return Math.min(Math.floor(viewportWidth * 0.46), 420);
}

function clampPortraitSpeechBubbleToViewport(bubble: any, fallbackLeft: number, viewportWidth: number): void {
    const viewportMargin = 8;
    const bRect = bubble.getBoundingClientRect();
    if (bRect.top < viewportMargin) {
        const currentTop = Number.parseFloat(bubble.style.top) || 24;
        bubble.style.top = `${currentTop + (viewportMargin - bRect.top)}px`;
    }

    const adjusted = bubble.getBoundingClientRect();
    if (adjusted.left < viewportMargin || adjusted.right > viewportWidth - viewportMargin) {
        const currentLeft = Number.parseFloat(bubble.style.left) || fallbackLeft;
        if (adjusted.left < viewportMargin) {
            bubble.style.left = `${currentLeft + (viewportMargin - adjusted.left)}px`;
        } else if (adjusted.right > viewportWidth - viewportMargin) {
            bubble.style.left = `${currentLeft - (adjusted.right - (viewportWidth - viewportMargin))}px`;
        }
    }
}

function keepPortraitSpeechBubbleOutsideBoard(bubble: any, role: string, boardRect: any, viewportWidth: number): void {
    if (!bubble || !boardRect) return;
    const boardGap = viewportWidth <= 900 ? 8 : 12;
    const bubbleRect = bubble.getBoundingClientRect();
    const currentLeft = Number.parseFloat(bubble.style.left) || ((bubbleRect.left + bubbleRect.right) / 2);

    if (role === PORTRAIT_SPEECH_ROLE_HERO && bubbleRect.right > boardRect.left - boardGap) {
        bubble.style.left = `${currentLeft - (bubbleRect.right - (boardRect.left - boardGap))}px`;
        return;
    }
    if (role === PORTRAIT_SPEECH_ROLE_CPU && bubbleRect.left < boardRect.right + boardGap) {
        bubble.style.left = `${currentLeft + ((boardRect.right + boardGap) - bubbleRect.left)}px`;
    }
}

function positionPortraitSpeechBubble(value: any): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const config = resolvePortraitSpeechConfig(value);
    const bubble = getPortraitSpeechBubbleElement(config.role);
    if (!bubble || !bubble.classList.contains('is-visible')) return;
    const rect = getPortraitSpeechAnchorRect(config.role);
    if (!rect) return;

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
    const gap = viewportWidth <= 900 ? 14 : 18;
    const anchorCenterX = rect.left + (rect.width / 2);
    const baseMaxWidth = getPortraitSpeechBubbleBaseMaxWidth(viewportWidth);
    const boardRect = getPortraitSpeechBoardRect();
    const boardGap = viewportWidth <= 900 ? 8 : 12;
    const viewportMargin = 8;
    let bubbleMaxWidth = baseMaxWidth;

    if (boardRect) {
        const lanePadding = viewportMargin + boardGap;
        if (config.role === PORTRAIT_SPEECH_ROLE_HERO) {
            const laneWidth = Math.floor(boardRect.left - lanePadding);
            if (laneWidth > 0) bubbleMaxWidth = Math.min(bubbleMaxWidth, laneWidth);
        } else {
            const laneWidth = Math.floor(viewportWidth - boardRect.right - lanePadding);
            if (laneWidth > 0) bubbleMaxWidth = Math.min(bubbleMaxWidth, laneWidth);
        }
    }

    bubble.style.maxWidth = `${Math.max(1, Math.round(bubbleMaxWidth))}px`;
    bubble.style.left = `${anchorCenterX}px`;
    bubble.style.top = `${Math.max(24, rect.top - gap)}px`;

    clampPortraitSpeechBubbleToViewport(bubble, anchorCenterX, viewportWidth);
    keepPortraitSpeechBubbleOutsideBoard(bubble, config.role, boardRect, viewportWidth);
    clampPortraitSpeechBubbleToViewport(bubble, anchorCenterX, viewportWidth);
}

function positionAllPortraitSpeechBubbles(): void {
    positionPortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_CPU);
    positionPortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_HERO);
}

function bindPortraitSpeechViewportHandlers(): void {
    if (portraitSpeechViewportHandlersBound || typeof window === 'undefined') return;
    portraitSpeechViewportHandlersBound = true;
    const handler = () => {
        try { positionAllPortraitSpeechBubbles(); } catch (e) { /* ignore */ }
    };
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    window.addEventListener('scroll', handler, { passive: true });
}

function hidePortraitSpeechBubble(role?: string): void {
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

function positionCpuSpeechBubble(): void {
    positionPortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_CPU);
}

function hideCpuSpeechBubble(): void {
    hidePortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_CPU);
}

function hideHeroSpeechBubble(): void {
    hidePortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_HERO);
}

function showPortraitSpeechBubble(text: string, options: any = {}): void {
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

function getGameStateForStatusDisplay(): any {
    try {
        if (typeof window !== 'undefined' && window && (window as any).gameState) return (window as any).gameState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof (gameState as any) !== 'undefined' && (gameState as any)) return (gameState as any);
    } catch (e) { /* ignore */ }
    return null;
}

function getRoundDisplayElement(): any {
    if (typeof document === 'undefined') return null;
    return document.getElementById('round-display-panel');
}

function getEffectLivePanelElement(): any {
    if (typeof document === 'undefined') return null;
    return document.getElementById('effect-live-panel');
}

function getRoundDisplayBoardAnchorElement(): any {
    if (typeof document === 'undefined') return null;
    return document.getElementById('board-frame') || document.getElementById('board');
}

function getLayoutStageScaleForStatusDisplay(): number {
    if (typeof window === 'undefined' || typeof document === 'undefined' || !document.documentElement) return 1;
    try {
        const rootStyle = window.getComputedStyle(document.documentElement);
        const scale = Number.parseFloat(rootStyle.getPropertyValue('--layout-stage-scale'));
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    } catch (e) {
        return 1;
    }
}

function resolveRoundNumberForStatusDisplay(): number {
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

function setRoundDisplayVisibility(roundEl: any, visible: boolean): void {
    if (!roundEl) return;
    roundEl.style.display = visible ? 'inline-flex' : 'none';
    roundEl.style.visibility = visible ? 'visible' : 'hidden';
}

function hasActiveRoundDisplayBonus(): boolean {
    return !!(roundDisplayBonusState && typeof roundDisplayBonusState.text === 'string' && roundDisplayBonusState.text.trim());
}

function setRoundDisplayBonusClass(roundEl: any, active: boolean): void {
    if (!roundEl || !roundEl.classList) return;
    if (active) roundEl.classList.add('is-round-bonus-active');
    else roundEl.classList.remove('is-round-bonus-active');
}

function setRoundDisplayBonusFadeClass(roundEl: any, active: boolean): void {
    if (!roundEl || !roundEl.classList) return;
    if (active) roundEl.classList.add('is-round-bonus-fading');
    else roundEl.classList.remove('is-round-bonus-fading');
}

function activateRoundDisplayBonus(roundEl: any): void {
    if (!roundEl) return;
    if (roundEl.classList && roundEl.classList.contains('is-round-bonus-active')) {
        roundEl.classList.remove('is-round-bonus-active');
        void roundEl.offsetWidth;
    }
    setRoundDisplayBonusFadeClass(roundEl, false);
    setRoundDisplayBonusClass(roundEl, true);
}

function clearRoundDisplayBonusTimers(): void {
    if (roundDisplayBonusTimer) {
        clearTimeout(roundDisplayBonusTimer);
        roundDisplayBonusTimer = null;
    }
    if (roundDisplayBonusFadeTimer) {
        clearTimeout(roundDisplayBonusFadeTimer);
        roundDisplayBonusFadeTimer = null;
    }
}

function startRoundDisplayBonusFadeOut(fadeOutMs: number, updateAfterClear = true): void {
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

function clearRoundDisplayBonus(updateAfterClear = true): void {
    clearRoundDisplayBonusTimers();
    roundDisplayBonusState = null;
    const roundEl = getRoundDisplayElement();
    setRoundDisplayBonusFadeClass(roundEl, false);
    setRoundDisplayBonusClass(roundEl, false);
    if (updateAfterClear) updateRoundDisplay();
}

function resolveRoundDisplayText(): string {
    if (hasActiveRoundDisplayBonus()) {
        return roundDisplayBonusState.text.trim();
    }
    return `ROUND ${resolveRoundNumberForStatusDisplay()}`;
}

function showRoundBonusDisplay(payload: any): void {
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

function positionRoundDisplay(): void {
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

function bindRoundDisplayViewportHandlers(): void {
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

function updateRoundDisplay(): void {
    const roundEl = getRoundDisplayElement();
    if (!roundEl) return;
    roundEl.textContent = resolveRoundDisplayText();
    setRoundDisplayBonusClass(roundEl, hasActiveRoundDisplayBonus());
    bindRoundDisplayViewportHandlers();
    positionRoundDisplay();
}

function showCpuSpeechBubble(text: string, options: any = {}): void {
    showPortraitSpeechBubble(text, options);
}

function showHeroSpeechBubble(text: string, options: any = {}): void {
    const bubbleOptions = Object.assign({}, options || {}, { speakerRole: PORTRAIT_SPEECH_ROLE_HERO });
    showPortraitSpeechBubble(text, bubbleOptions);
}

const FATE_WILL_BANNER_ID = 'fate-will-banner';

function _getCardStateForFateWillBanner(): any {
    try { if (typeof (cardState as any) !== 'undefined' && (cardState as any)) return (cardState as any); } catch (e) { /* ignore */ }
    try { if (typeof window !== 'undefined' && window && (window as any).cardState) return (window as any).cardState; } catch (e) { /* ignore */ }
    return null;
}

function _getFateWillBannerText(): string | null {
    const cs = _getCardStateForFateWillBanner();
    const gs = getGameStateForStatusDisplay();
    if (!cs || !cs.fateWillControllerByTurnOwner || !gs) return null;
    const BLACK_VAL = (typeof (BLACK as any) !== 'undefined') ? (BLACK as any) : 1;
    const currentPlayerKey = gs.currentPlayer === BLACK_VAL ? 'black' : 'white';
    const controller = cs.fateWillControllerByTurnOwner[currentPlayerKey];
    if (!controller) return null;
    if (!isNetworkModeForLabels()) return '運命の意志発動中';
    const localSeat = getOwnSeatKeyForLabels();
    if (localSeat === controller) return '運命の意志発動中 ▸ 代理操作中';
    return '運命の意志発動中 ▸ 相手代理操作中';
}

function getFateWillBannerElement(): any {
    if (typeof document === 'undefined') return null;
    return document.getElementById(FATE_WILL_BANNER_ID);
}

function ensureFateWillBannerElement(): any {
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

function updateFateWillBanner(): void {
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

function updateStatus(): void {
    updateRoundDisplay();
    updateCpuCharacter();
    try { updateFateWillBanner(); } catch (e) { /* ignore */ }
}

function applyCpuCharacterLevelScale(charImg: any, level: any): void {
    if (!charImg) {
        return;
    }

    const levelNumber = Number(level);
    const normalizedLevel = Number.isFinite(levelNumber)
        ? Math.min(6, Math.max(1, Math.round(levelNumber)))
        : 1;
    const CPU_BASE_VISUAL_SCALE = 0.88;
    const levelScale = CPU_BASE_VISUAL_SCALE * (1 + ((normalizedLevel - 1) * 0.1));

    charImg.style.width = '';
    charImg.style.height = '';
    charImg.style.transform = '';
    charImg.style.transformOrigin = '';
    charImg.style.setProperty('--cpu-level-scale', levelScale.toFixed(3));
}

function resetCpuCharacterLevelScale(charImg: any): void {
    if (!charImg) {
        return;
    }
    charImg.style.width = '';
    charImg.style.height = '';
    charImg.style.transform = '';
    charImg.style.transformOrigin = '';
    charImg.style.removeProperty('--cpu-level-scale');
}

function setCpuCharacterNetworkHeroState(charImg: any, enabled: boolean): void {
    if (!charImg || !charImg.classList) {
        return;
    }
    if (enabled) {
        charImg.classList.add(NETWORK_OPPONENT_HERO_CLASS);
    } else {
        charImg.classList.remove(NETWORK_OPPONENT_HERO_CLASS);
    }
}

function updateCpuCharacter(): void {
    const level = (cpuSmartness as any).white || 1;
    const storyEncounterPresentation = resolveStoryEncounterCpuPresentation();
    const observerDuelPresentation = resolveObserverDuelCpuPresentation();
    const specialPresentation = storyEncounterPresentation || observerDuelPresentation;
    const useNetworkHeroPresentation = !specialPresentation && isNetworkModeForLabels();
    const displayLevel = observerDuelPresentation ? 6 : level;
    const charImg = (getElement as any)('cpuCharacterImg');
    const levelLabel = (getElement as any)('cpuLevelLabel');
    const heroLabel = document.getElementById('hero-label');

    try {
        if (typeof window !== 'undefined' && window && typeof (window as any).syncDisplayedHandSkin === 'function') {
            (window as any).syncDisplayedHandSkin(window);
        }
    } catch (e) { /* ignore */ }
    
    if (charImg && levelLabel) {
        const primaryPath = useNetworkHeroPresentation
            ? HERO_IMAGE_SRC
            : (specialPresentation && specialPresentation.imageSrc
                ? String(specialPresentation.imageSrc)
                : `assets/images/cpu/level${displayLevel}.png`);
        const fallbackCandidates: string[] = [];
        const levelImagePath = `assets/images/cpu/level${displayLevel}.png`;
        const legacyFallbackPath = `assets/cpu-characters/level${displayLevel}.png`;
        if (!useNetworkHeroPresentation) {
            if (levelImagePath !== primaryPath) fallbackCandidates.push(levelImagePath);
            fallbackCandidates.push(legacyFallbackPath);
        }
        let fallbackIndex = 0;
        charImg.alt = useNetworkHeroPresentation
            ? '対戦相手の勇者'
            : (specialPresentation ? String(specialPresentation.label || '敵CPU') : '敵CPU');
        setCpuCharacterNetworkHeroState(charImg, useNetworkHeroPresentation);
        
        const img = new Image();
        img.onload = () => {
            charImg.src = img.src;
            if (useNetworkHeroPresentation) resetCpuCharacterLevelScale(charImg);
            else applyCpuCharacterLevelScale(charImg, displayLevel);
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
            resetCpuCharacterLevelScale(charImg);
            applyObserverDuelCpuPanelState(observerDuelPresentation, charImg, levelLabel);
            console.warn(`敵キャラクター画像が見つかりません: ${primaryPath}`);
        };
        img.src = primaryPath;

        levelLabel.textContent = specialPresentation
            ? specialPresentation.label
            : ((CPU_LEVEL_NAMES as any)[level] || 'レベル ' + level);
        if (specialPresentation) {
            if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        } else {
            applyNetworkSeatLabels(levelLabel);
        }
    }
}

if (typeof window !== 'undefined') {
    try { (window as any).showCpuSpeechBubble = showCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).hideCpuSpeechBubble = hideCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).positionCpuSpeechBubble = positionCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).showHeroSpeechBubble = showHeroSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).hideHeroSpeechBubble = hideHeroSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).showRoundBonusDisplay = showRoundBonusDisplay; } catch (e) { /* ignore */ }
    try { (window as any).clearRoundDisplayBonus = clearRoundDisplayBonus; } catch (e) { /* ignore */ }
    try { (window as any).updateCpuCharacter = updateCpuCharacter; } catch (e) { /* ignore */ }
    try { (window as any).updateStatus = updateStatus; } catch (e) { /* ignore */ }
    try { (window as any).updateFateWillBanner = updateFateWillBanner; } catch (e) { /* ignore */ }
    try { updateRoundDisplay(); } catch (e) { /* ignore */ }
}

function resolveResultOverlayApiForStatusDisplay(): any {
    try {
        if (typeof _require === 'function') {
            const resultOverlay = _require('./result-overlay');
            if (resultOverlay && typeof resultOverlay === 'object') return resultOverlay;
        }
    } catch (e) { /* ignore */ }

    try {
        if (typeof globalThis !== 'undefined') {
            const api: any = {
                showResult: (typeof (globalThis as any).showResult === 'function' && (globalThis as any).showResult !== showResult)
                    ? (globalThis as any).showResult.bind(globalThis)
                    : null,
                showResultOverlay: (typeof (globalThis as any).showResultOverlay === 'function' && (globalThis as any).showResultOverlay !== showResultOverlay)
                    ? (globalThis as any).showResultOverlay.bind(globalThis)
                    : null
            };
            if (api.showResult || api.showResultOverlay) return api;
        }
    } catch (e) { /* ignore */ }

    return null;
}

function showResult(): any {
    const resultOverlayApi = resolveResultOverlayApiForStatusDisplay();
    if (!resultOverlayApi || typeof resultOverlayApi.showResult !== 'function') {
        console.warn('[status-display] result-overlay.showResult unavailable');
        return;
    }
    return resultOverlayApi.showResult();
}

function showResultOverlay(): any {
    const resultOverlayApi = resolveResultOverlayApiForStatusDisplay();
    if (!resultOverlayApi || typeof resultOverlayApi.showResultOverlay !== 'function') {
        console.warn('[status-display] result-overlay.showResultOverlay unavailable');
        return;
    }
    return resultOverlayApi.showResultOverlay();
}

const StatusDisplayModule = {
    showCpuSpeechBubble,
    hideCpuSpeechBubble,
    positionCpuSpeechBubble,
    showHeroSpeechBubble,
    hideHeroSpeechBubble,
    showRoundBonusDisplay,
    clearRoundDisplayBonus,
    updateCpuCharacter,
    updateStatus,
    updateFateWillBanner,
    updateRoundDisplay,
    showResult,
    showResultOverlay
};

export = StatusDisplayModule;
