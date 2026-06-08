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
let latestBattleStatusEventText = '';
const ROUND_DISPLAY_BONUS_FADE_OUT_MS = 320;
const HERO_DEFAULT_LABEL = 'リバーシの勇者';
const HERO_IMAGE_SRC = 'assets/images/hero/hero.png';
const NETWORK_OPPONENT_HERO_CLASS = 'is-network-opponent-hero';
const NETWORK_WAITING_NAME = '接続待ち';
const PORTRAIT_SPEECH_ROLE_CPU = 'cpu';
const PORTRAIT_SPEECH_CONFIG: any = {
    cpu: {
        role: PORTRAIT_SPEECH_ROLE_CPU,
        bubbleId: 'cpu-speech-bubble',
        imageId: 'cpu-character-img',
        panelId: 'cpu-character-panel'
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

function resolveSpecialCpuPresentation(): any {
    return null;
}

function applySpecialCpuPanelState(specialPresentation: any, charImg: any, levelLabel: any): void {
    const panel = document.getElementById('cpu-character-panel');
    const faded = !!(specialPresentation && specialPresentation.fadeOut === true);
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

function applyCpuLevelLabelInteractivity(levelLabel: any, interactive: boolean, label: string): void {
    if (!levelLabel) return;
    levelLabel.textContent = label;
    if (levelLabel.classList) {
        levelLabel.classList.toggle('is-noninteractive', !interactive);
    }
    if (typeof levelLabel.setAttribute === 'function') {
        levelLabel.setAttribute('aria-disabled', interactive ? 'false' : 'true');
        levelLabel.setAttribute('aria-label', interactive ? 'CPUレベル一覧を開く' : '対戦相手表示');
        levelLabel.title = interactive ? 'クリックでCPUレベル一覧を表示' : '対戦相手表示';
    }
    if ('disabled' in levelLabel) {
        (levelLabel as HTMLButtonElement).disabled = !interactive;
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
        applyCpuLevelLabelInteractivity(levelLabel, false, `${toSeatLabel(opponentSeatKey)}:${opponentName}`);
    }
    return true;
}

function normalizePortraitSpeechRole(value: any): string {
    return PORTRAIT_SPEECH_ROLE_CPU;
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
        const laneWidth = Math.floor(viewportWidth - boardRect.right - lanePadding);
        if (laneWidth > 0) bubbleMaxWidth = Math.min(bubbleMaxWidth, laneWidth);
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
        : [PORTRAIT_SPEECH_ROLE_CPU];
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

function formatBattleStatusRoundNumber(roundNumber: number): string {
    const safeRound = Number.isFinite(roundNumber) && roundNumber >= 0
        ? Math.trunc(roundNumber)
        : 1;
    return String(safeRound).padStart(2, '0');
}

function normalizePlayerKeyForStatusDisplay(value: any): PlayerKey {
    try {
        if (StatusDisplayOwnerHelpersModule && typeof StatusDisplayOwnerHelpersModule.normalizePlayerKey === 'function') {
            return StatusDisplayOwnerHelpersModule.normalizePlayerKey(value, 'black');
        }
    } catch (e) { /* ignore */ }
    try {
        const whiteValue = (typeof (WHITE as any) !== 'undefined') ? (WHITE as any) : -1;
        if (value === whiteValue || value === -1 || value === 'white') return 'white';
    } catch (e) { /* ignore */ }
    return 'black';
}

function getLocalPlayerKeyForBattleStatus(): PlayerKey {
    if (isNetworkModeForLabels()) {
        return normalizePlayerKeyForStatusDisplay(getOwnSeatKeyForLabels());
    }
    return 'black';
}

function resolveBattleStatusTurnLabel(): string {
    const state = getGameStateForStatusDisplay();
    const currentPlayer = normalizePlayerKeyForStatusDisplay(state && state.currentPlayer);
    const localPlayer = getLocalPlayerKeyForBattleStatus();
    return currentPlayer === localPlayer ? 'あなたのターン' : '相手のターン';
}

function countBoardStonesForBattleStatus(): { black: number; white: number } {
    const state = getGameStateForStatusDisplay();
    const board = state && Array.isArray(state.board) ? state.board : [];
    const counts = { black: 0, white: 0 };
    for (const row of board) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            if (cell === 0 || cell === null || cell === undefined || cell === '') continue;
            if (cell === -1 || cell === 'white' || cell === 'WHITE') {
                counts.white += 1;
                continue;
            }
            if (cell === 1 || cell === 'black' || cell === 'BLACK') {
                counts.black += 1;
                continue;
            }
            const key = normalizePlayerKeyForStatusDisplay(cell);
            if (key === 'white') counts.white += 1;
            if (key === 'black') counts.black += 1;
        }
    }
    return counts;
}

function resolveBattleStatusLatestText(): string {
    return latestBattleStatusEventText || '-';
}

function ensureBattleStatusPanel(): any {
    const panel = getEffectLivePanelElement();
    if (!panel) return null;
    if (panel.getAttribute('data-battle-status-panel') === '1') return panel;
    panel.classList.add('battle-status-panel');
    panel.setAttribute('data-battle-status-panel', '1');
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-label', '戦況');
    panel.innerHTML = [
        '<div class="battle-status-topline">',
        '  <div class="battle-status-round"></div>',
        '  <div class="battle-status-kicker">戦況</div>',
        '</div>',
        '<div class="battle-status-score" aria-label="石数">',
        '  <span class="battle-status-count battle-status-count--black"></span>',
        '  <span class="battle-status-score-separator">/</span>',
        '  <span class="battle-status-count battle-status-count--white"></span>',
        '</div>',
        '<div class="battle-status-turn"></div>',
        '<div class="battle-status-latest"></div>'
    ].join('');
    return panel;
}

function updateBattleStatusPanel(): void {
    const panel = ensureBattleStatusPanel();
    if (!panel) return;
    const roundEl = panel.querySelector('.battle-status-round');
    const blackEl = panel.querySelector('.battle-status-count--black');
    const whiteEl = panel.querySelector('.battle-status-count--white');
    const turnEl = panel.querySelector('.battle-status-turn');
    const latestEl = panel.querySelector('.battle-status-latest');
    const counts = countBoardStonesForBattleStatus();
    if (roundEl) roundEl.textContent = `ROUND ${formatBattleStatusRoundNumber(resolveRoundNumberForStatusDisplay())}`;
    if (blackEl) blackEl.textContent = `黒 ${counts.black}`;
    if (whiteEl) whiteEl.textContent = `白 ${counts.white}`;
    if (turnEl) turnEl.textContent = resolveBattleStatusTurnLabel();
    if (latestEl) latestEl.textContent = `直近 ${resolveBattleStatusLatestText()}`;
}

function normalizeBattleStatusEventText(message: any): string {
    const raw = String(message && typeof message === 'object' && typeof message.text === 'string' ? message.text : message || '').trim();
    if (!raw) return '';
    const cardUseMatch = raw.match(/^(黒|白)がカードを使用:\s*([^()]+?)(?:\s*\(|$)/);
    if (cardUseMatch) return `${cardUseMatch[1]}: ${cardUseMatch[2].trim()}`;
    if (/布石\s*[+-]|布石[＋+]|数字マス.*布石/.test(raw)) return '';
    return raw.replace(/\s+/g, ' ');
}

function recordBattleStatusEvent(message: any): boolean {
    const text = normalizeBattleStatusEventText(message);
    if (!text) {
        updateBattleStatusPanel();
        return false;
    }
    latestBattleStatusEventText = text;
    updateBattleStatusPanel();
    return true;
}

function clearBattleStatusPanel(): void {
    latestBattleStatusEventText = '';
    updateBattleStatusPanel();
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
    updateBattleStatusPanel();
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
    const selectLevel = Number((document.getElementById('smartWhite') as HTMLSelectElement | null)?.value);
    const level = Number.isFinite(selectLevel)
        ? Math.max(1, Math.min(6, Math.floor(selectLevel)))
        : (((typeof cpuSmartness !== 'undefined' && cpuSmartness) ? (cpuSmartness as any).white : 1) || 1);
    const specialPresentation = resolveSpecialCpuPresentation();
    const useNetworkHeroPresentation = !specialPresentation && isNetworkModeForLabels();
    const displayLevel = level;
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
            applySpecialCpuPanelState(specialPresentation, charImg, levelLabel);
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
            applySpecialCpuPanelState(specialPresentation, charImg, levelLabel);
            console.warn(`敵キャラクター画像が見つかりません: ${primaryPath}`);
        };
        img.src = primaryPath;

        const defaultName = (CPU_LEVEL_NAMES as any)[level] || ('レベル ' + level);
        if (specialPresentation) {
            applyCpuLevelLabelInteractivity(levelLabel, false, String(specialPresentation.label));
            if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        }
        else if (!applyNetworkSeatLabels(levelLabel)) {
            applyCpuLevelLabelInteractivity(levelLabel, true, `Lv${level} ${defaultName}`);
        }
        else {
            applyNetworkSeatLabels(levelLabel);
        }
    }
}

if (typeof window !== 'undefined') {
    try { (window as any).showCpuSpeechBubble = showCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).hideCpuSpeechBubble = hideCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).positionCpuSpeechBubble = positionCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).showRoundBonusDisplay = showRoundBonusDisplay; } catch (e) { /* ignore */ }
    try { (window as any).clearRoundDisplayBonus = clearRoundDisplayBonus; } catch (e) { /* ignore */ }
    try { (window as any).updateCpuCharacter = updateCpuCharacter; } catch (e) { /* ignore */ }
    try { (window as any).updateStatus = updateStatus; } catch (e) { /* ignore */ }
    try { (window as any).recordBattleStatusEvent = recordBattleStatusEvent; } catch (e) { /* ignore */ }
    try { (window as any).clearBattleStatusPanel = clearBattleStatusPanel; } catch (e) { /* ignore */ }
    try { (window as any).updateFateWillBanner = updateFateWillBanner; } catch (e) { /* ignore */ }
    try { updateBattleStatusPanel(); } catch (e) { /* ignore */ }
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
    showRoundBonusDisplay,
    clearRoundDisplayBonus,
    updateCpuCharacter,
    updateStatus,
    updateBattleStatusPanel,
    recordBattleStatusEvent,
    clearBattleStatusPanel,
    updateFateWillBanner,
    updateRoundDisplay,
    showResult,
    showResultOverlay
};

export = StatusDisplayModule;
