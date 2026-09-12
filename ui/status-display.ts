import type { PlayerKey } from '../src/types';
import {
    setLogicalImageSourceIfChanged
} from './assets/logical-image-source';

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
let turnArrivalToastHideTimer: any = null;
let turnArrivalToastFadeTimer: any = null;
let turnArrivalToastPositionTimer: any = null;
let turnArrivalToastLastSignature = '';
let turnArrivalToastViewportHandlersBound = false;
let turnArrivalToastResizeObserver: any = null;
let latestBattleStatusEventText = '';
let battleStatusNetworkTimerInfo: any = null;
const battleStatusRenderSignatureByElement = new WeakMap<object, string>();
const ROUND_DISPLAY_BONUS_FADE_OUT_MS = 320;
const TURN_ARRIVAL_TOAST_ID = 'turn-arrival-toast';
const TURN_ARRIVAL_TOAST_VISIBLE_MS = 15000;
const TURN_ARRIVAL_TOAST_FADE_OUT_MS = 360;
const TURN_ARRIVAL_TOAST_REFERENCE_WIDTH = 164;
const TURN_ARRIVAL_TOAST_PHONE_REFERENCE_WIDTH = 132;
const HERO_DEFAULT_LABEL = 'リバーシの勇者';
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

function requestPortraitImage(
    target: HTMLImageElement,
    primaryPath: string,
    fallbackPaths: readonly string[],
    onLoad: (resolvedSrc: string) => void,
    onError: () => void
): boolean {
    return setLogicalImageSourceIfChanged(target, primaryPath, {
        fallbackLogicalPaths: fallbackPaths,
        onLoad: (deliveredSource) => onLoad(deliveredSource),
        onError
    });
}

function unrefStatusDisplayTimer(timer: any): void {
    if (timer && typeof timer.unref === 'function') {
        try { timer.unref(); } catch (e) { /* ignore */ }
    }
}

const CpuOpponentProfiles = _require('../shared/cpu-opponent-profiles');
const CpuProfileSelection = _require('./cpu-profile-selection');
const StatusDisplayBoardUtils = _require('../shared/shared-board-utils');
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

function isNetworkSpectatorActiveForLabels(): boolean {
    try {
        if (!isNetworkModeForLabels()) return false;
        if (typeof window === 'undefined' || !window) return false;
        const client = (window as any).NetworkMatchClient;
        return !!(client && typeof client.isSpectator === 'function' && client.isSpectator() === true);
    } catch (e) {
        return false;
    }
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
        levelLabel.classList.toggle('cpu-level-label-multiline', label.includes('\n'));
    }
    if (typeof levelLabel.setAttribute === 'function') {
        levelLabel.setAttribute('aria-disabled', interactive ? 'false' : 'true');
        levelLabel.setAttribute('aria-label', interactive ? 'CPU・盤面設定を開く' : '対戦相手表示');
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
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === PORTRAIT_SPEECH_ROLE_HERO || normalized === 'local' || normalized === 'self') {
        return PORTRAIT_SPEECH_ROLE_HERO;
    }
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
    return Math.min(Math.floor(viewportWidth * 0.38), 360);
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
    } else if (role === PORTRAIT_SPEECH_ROLE_HERO && bubbleRect.right > boardRect.left - boardGap) {
        bubble.style.left = `${currentLeft - (bubbleRect.right - (boardRect.left - boardGap))}px`;
    }
}

function positionPortraitSpeechBubble(value: any): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    // Both portrait callouts are CSS-hidden in the phone portrait profile.
    // Keep their text/state intact so an orientation change can reveal and
    // position them, but avoid forced layout reads while they cannot paint.
    if (isPhonePortraitStatusLayout()) return;
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
        const laneWidth = config.role === PORTRAIT_SPEECH_ROLE_HERO
            ? Math.floor(boardRect.left - lanePadding)
            : Math.floor(viewportWidth - boardRect.right - lanePadding);
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

function positionHeroSpeechBubble(): void {
    positionPortraitSpeechBubble(PORTRAIT_SPEECH_ROLE_HERO);
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

function getCardStateForStatusDisplay(): any {
    try {
        if (typeof window !== 'undefined' && window && (window as any).cardState) return (window as any).cardState;
    } catch (e) { /* ignore */ }
    try {
        if (typeof (cardState as any) !== 'undefined' && (cardState as any)) return (cardState as any);
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
    if (isNetworkSpectatorActiveForLabels()) return '観測中';
    const state = getGameStateForStatusDisplay();
    const currentPlayer = normalizePlayerKeyForStatusDisplay(state && state.currentPlayer);
    const localPlayer = getLocalPlayerKeyForBattleStatus();
    return currentPlayer === localPlayer ? 'あなたのターン' : '相手のターン';
}

function isPhonePortraitStatusLayout(): boolean {
    if (typeof document === 'undefined' || !document.documentElement) return false;
    const root = document.documentElement;
    return root.classList.contains('layout-profile-phone-portrait')
        || root.getAttribute('data-layout-profile') === 'layout-profile-phone-portrait';
}

function resolveTurnArrivalToastState(): { signature: string; kind: 'self' | 'enemy'; playerSide: PlayerKey; text: string } | null {
    if (isNetworkSpectatorActiveForLabels()) return null;
    const state = getGameStateForStatusDisplay();
    if (!state || state.currentPlayer === null || state.currentPlayer === undefined) return null;
    const currentPlayer = normalizePlayerKeyForStatusDisplay(state.currentPlayer);
    const localPlayer = getLocalPlayerKeyForBattleStatus();
    const turnNumber = Number.isFinite(Number(state.turnNumber)) ? Math.trunc(Number(state.turnNumber)) : 0;
    const roundNumber = Number.isFinite(Number(state.roundNumber)) ? Math.trunc(Number(state.roundNumber)) : 0;
    const kind = currentPlayer === localPlayer ? 'self' : 'enemy';
    return {
        signature: `${currentPlayer}:${localPlayer}:${turnNumber}:${roundNumber}`,
        kind,
        playerSide: currentPlayer,
        text: kind === 'self' ? 'Your Turn' : 'Enemy Turn'
    };
}

function getTurnArrivalToastElement(): any {
    if (typeof document === 'undefined') return null;
    return document.getElementById(TURN_ARRIVAL_TOAST_ID);
}

function ensureTurnArrivalToastElement(): any {
    if (typeof document === 'undefined' || !document.body) return null;
    let el = getTurnArrivalToastElement();
    if (el) return el;
    el = document.createElement('div');
    el.id = TURN_ARRIVAL_TOAST_ID;
    el.className = 'turn-arrival-toast';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.setAttribute('role', 'status');
    el.innerHTML = [
        '<span class="turn-arrival-toast-rail" aria-hidden="true"></span>',
        '<span class="turn-arrival-toast-text"></span>'
    ].join('');
    document.body.appendChild(el);
    return el;
}

function positionTurnArrivalToast(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const toast = getTurnArrivalToastElement();
    const boardAnchor = getRoundDisplayBoardAnchorElement();
    if (!toast || !toast.classList.contains('is-visible')) return;
    if (!boardAnchor || typeof boardAnchor.getBoundingClientRect !== 'function') return;

    const boardRect = boardAnchor.getBoundingClientRect();
    if (!Number.isFinite(boardRect.right) || !Number.isFinite(boardRect.bottom)) return;
    const scale = getLayoutStageScaleForStatusDisplay();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 1280;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 720;
    const toastWidth = Number.isFinite(Number(toast.offsetWidth)) ? Number(toast.offsetWidth) : 0;
    const measuredToastHeight = Number.isFinite(Number(toast.offsetHeight)) ? Number(toast.offsetHeight) : 0;
    const isPhonePortrait = isPhonePortraitStatusLayout();
    const toastHeight = measuredToastHeight > 0
        ? measuredToastHeight
        : Math.round((isPhonePortrait ? 30 : 40) * scale);
    const boardEdgeInset = Math.max(1, Math.round(3 * scale));
    const targetRight = isPhonePortrait
        ? Math.max(8, Math.min(Math.round(boardRect.right - boardEdgeInset), viewportWidth - 8))
        : Math.max(8, Math.min(Math.round(boardRect.right + (6 * scale)), viewportWidth - 8));
    const referenceWidth = Math.round(
        (isPhonePortrait ? TURN_ARRIVAL_TOAST_PHONE_REFERENCE_WIDTH : TURN_ARRIVAL_TOAST_REFERENCE_WIDTH) * scale
    );
    const anchoredWidth = toastWidth > 0 ? Math.min(toastWidth, referenceWidth) : referenceWidth;
    const desiredLeft = targetRight - anchoredWidth;
    const maxLeft = Math.max(8, viewportWidth - toastWidth - 8);
    const boardLeftInset = isPhonePortrait && Number.isFinite(boardRect.left)
        ? Math.round(boardRect.left + boardEdgeInset)
        : 8;
    const left = Math.max(boardLeftInset, Math.min(desiredLeft, maxLeft));
    const targetBottom = isPhonePortrait
        ? Math.max(8 + toastHeight, Math.min(Math.round(boardRect.bottom - boardEdgeInset), viewportHeight - 8))
        : Math.max(8 + toastHeight, Math.min(Math.round(boardRect.bottom + (15 * scale)), viewportHeight - 8));
    const boardTopInset = isPhonePortrait && Number.isFinite(boardRect.top)
        ? Math.round(boardRect.top + boardEdgeInset)
        : 8;
    const top = Math.max(boardTopInset, targetBottom - toastHeight);
    toast.style.left = `${left}px`;
    toast.style.top = `${top}px`;
}

function scheduleTurnArrivalToastPositionRefresh(): void {
    positionTurnArrivalToast();
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
        try {
            window.requestAnimationFrame(() => {
                try { positionTurnArrivalToast(); } catch (e) { /* ignore */ }
            });
        } catch (e) { /* ignore */ }
    }
    if (turnArrivalToastPositionTimer) {
        clearTimeout(turnArrivalToastPositionTimer);
        turnArrivalToastPositionTimer = null;
    }
    turnArrivalToastPositionTimer = setTimeout(() => {
        turnArrivalToastPositionTimer = null;
        positionTurnArrivalToast();
    }, 180);
    unrefStatusDisplayTimer(turnArrivalToastPositionTimer);
}

function bindTurnArrivalToastViewportHandlers(): void {
    if (turnArrivalToastViewportHandlersBound || typeof window === 'undefined') return;
    turnArrivalToastViewportHandlersBound = true;
    const reposition = () => {
        try { positionTurnArrivalToast(); } catch (e) { /* ignore */ }
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('orientationchange', reposition);
    window.addEventListener('scroll', reposition, { passive: true });
    if (typeof ResizeObserver === 'function') {
        try {
            const boardAnchor = getRoundDisplayBoardAnchorElement();
            if (boardAnchor) {
                turnArrivalToastResizeObserver = new ResizeObserver(reposition);
                turnArrivalToastResizeObserver.observe(boardAnchor);
            }
        } catch (e) { /* ignore */ }
    }
}

function hideTurnArrivalToast(): void {
    const toast = getTurnArrivalToastElement();
    if (!toast) return;
    toast.classList.add('is-hiding');
    if (turnArrivalToastFadeTimer) {
        clearTimeout(turnArrivalToastFadeTimer);
        turnArrivalToastFadeTimer = null;
    }
    turnArrivalToastFadeTimer = setTimeout(() => {
        const currentToast = getTurnArrivalToastElement();
        if (!currentToast) return;
        currentToast.classList.remove('is-visible', 'is-hiding', 'is-self', 'is-enemy', 'is-black-turn', 'is-white-turn');
    }, TURN_ARRIVAL_TOAST_FADE_OUT_MS);
    unrefStatusDisplayTimer(turnArrivalToastFadeTimer);
}

function showTurnArrivalToast(state: { kind: 'self' | 'enemy'; playerSide: PlayerKey; text: string }): void {
    const toast = ensureTurnArrivalToastElement();
    if (!toast) return;
    const textEl = typeof toast.querySelector === 'function'
        ? toast.querySelector('.turn-arrival-toast-text')
        : null;
    if (textEl) textEl.textContent = state.text;
    else toast.textContent = state.text;

    bindTurnArrivalToastViewportHandlers();
    if (turnArrivalToastHideTimer) {
        clearTimeout(turnArrivalToastHideTimer);
        turnArrivalToastHideTimer = null;
    }
    if (turnArrivalToastFadeTimer) {
        clearTimeout(turnArrivalToastFadeTimer);
        turnArrivalToastFadeTimer = null;
    }
    toast.classList.remove('is-visible', 'is-hiding', 'is-self', 'is-enemy', 'is-black-turn', 'is-white-turn');
    toast.classList.add(state.kind === 'self' ? 'is-self' : 'is-enemy');
    toast.classList.add(state.playerSide === 'white' ? 'is-white-turn' : 'is-black-turn');
    void toast.offsetWidth;
    toast.classList.add('is-visible');
    scheduleTurnArrivalToastPositionRefresh();
    turnArrivalToastHideTimer = setTimeout(() => {
        turnArrivalToastHideTimer = null;
        hideTurnArrivalToast();
    }, TURN_ARRIVAL_TOAST_VISIBLE_MS);
    unrefStatusDisplayTimer(turnArrivalToastHideTimer);
}

function syncTurnArrivalToast(): void {
    const state = resolveTurnArrivalToastState();
    if (!state) return;
    if (state.signature === turnArrivalToastLastSignature) {
        return;
    }
    turnArrivalToastLastSignature = state.signature;
    showTurnArrivalToast(state);
}

function countBoardStonesForBattleStatus(): { black: number; white: number } {
    const state = getGameStateForStatusDisplay();
    if (!state || !Array.isArray(state.board)) return { black: 0, white: 0 };
    if (!StatusDisplayBoardUtils || typeof StatusDisplayBoardUtils.countStateDiscs !== 'function') {
        throw new Error('SharedBoardUtils.countStateDiscs is required by status-display');
    }
    return StatusDisplayBoardUtils.countStateDiscs(state, getCardStateForStatusDisplay());
}

function resolveBattleStatusLatestText(): string {
    return latestBattleStatusEventText || '-';
}

function normalizeBattleStatusTimerSeatKey(value: any): PlayerKey {
    return normalizePlayerKeyForStatusDisplay(value);
}

function resolveBattleStatusNetworkTimerText(): { text: string; ariaLabel: string } {
    if (!isNetworkModeForLabels()) return { text: '', ariaLabel: '' };
    const timer = (battleStatusNetworkTimerInfo && typeof battleStatusNetworkTimerInfo === 'object')
        ? battleStatusNetworkTimerInfo
        : null;
    if (!timer || timer.active !== true) return { text: '', ariaLabel: '' };

    const limitSeconds = Number.isFinite(Number(timer.limitSeconds))
        ? Math.max(1, Math.trunc(Number(timer.limitSeconds)))
        : 120;
    const remainingMs = Number.isFinite(Number(timer.remainingMs)) ? Number(timer.remainingMs) : null;
    const remainingSeconds = remainingMs === null
        ? limitSeconds
        : Math.max(0, Math.ceil(remainingMs / 1000));
    const turnSeatKey = normalizeBattleStatusTimerSeatKey(timer.turnSeatKey);
    const turnSeatLabel = turnSeatKey === 'white' ? '白' : '黒';

    return {
        text: `残り ${remainingSeconds}秒`,
        ariaLabel: `ネット対戦 ${turnSeatLabel}の手番 残り ${remainingSeconds} 秒`
    };
}

function renderBattleStatusNetworkTimer(el: any): void {
    if (!el) return;
    const display = resolveBattleStatusNetworkTimerText();
    if (el.textContent !== display.text) el.textContent = display.text;
    const hidden = !display.text;
    if (el.hidden !== hidden) el.hidden = hidden;
    if (display.ariaLabel) {
        if (el.getAttribute('aria-label') !== display.ariaLabel) {
            el.setAttribute('aria-label', display.ariaLabel);
        }
    } else if (el.hasAttribute('aria-label')) {
        el.removeAttribute('aria-label');
    }
}

function setBattleStatusNetworkTimerInfo(timerInfo: any): void {
    battleStatusNetworkTimerInfo = (timerInfo && typeof timerInfo === 'object') ? timerInfo : null;
    updateBattleStatusPanel();
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
        '  <div class="battle-status-network-timer" hidden></div>',
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

function renderBattleStatusStoneCount(el: any, color: 'black' | 'white', count: number): void {
    if (!el) return;
    const signature = `${color}:${count}`;
    if (battleStatusRenderSignatureByElement.get(el) === signature) return;
    const label = color === 'white' ? '白石' : '黒石';
    const compactLabel = color === 'white' ? '白' : '黒';
    el.setAttribute('aria-label', `${label} ${count}`);
    el.innerHTML = [
        `<span class="battle-status-stone battle-status-stone--${color}" aria-hidden="true"></span>`,
        `<span class="battle-status-count-label" aria-hidden="true">${compactLabel}</span>`,
        `<span class="battle-status-count-value">${count}</span>`
    ].join('');
    battleStatusRenderSignatureByElement.set(el, signature);
}

function setBattleStatusTextIfChanged(el: any, text: string): void {
    if (el && el.textContent !== text) el.textContent = text;
}

function updateBattleStatusPanel(): void {
    const panel = ensureBattleStatusPanel();
    if (!panel) return;
    const roundEl = panel.querySelector('.battle-status-round');
    const timerEl = panel.querySelector('.battle-status-network-timer');
    const blackEl = panel.querySelector('.battle-status-count--black');
    const whiteEl = panel.querySelector('.battle-status-count--white');
    const turnEl = panel.querySelector('.battle-status-turn');
    const latestEl = panel.querySelector('.battle-status-latest');
    const counts = countBoardStonesForBattleStatus();
    setBattleStatusTextIfChanged(roundEl, `ROUND ${resolveRoundNumberForStatusDisplay()}`);
    renderBattleStatusNetworkTimer(timerEl);
    renderBattleStatusStoneCount(blackEl, 'black', counts.black);
    renderBattleStatusStoneCount(whiteEl, 'white', counts.white);
    setBattleStatusTextIfChanged(turnEl, resolveBattleStatusTurnLabel());
    renderBattleStatusLatestText(latestEl, resolveBattleStatusLatestText());
    syncTurnArrivalToast();
}

function readCpuProfileValue(playerKey: 'black' | 'white'): string {
    try {
        if (CpuProfileSelection && typeof CpuProfileSelection.readCpuProfileValueFromSelect === 'function') {
            return String(CpuProfileSelection.readCpuProfileValueFromSelect(playerKey, typeof document !== 'undefined' ? document : null) || '');
        }
    } catch (e) {
        return '';
    }
    return '';
}

function readWhiteCpuProfileValue(): string {
    return readCpuProfileValue('white');
}

function updateHeroCharacterForBlackCpuProfile(): void {
    if (isNetworkModeForLabels()) return;
    const heroImg = document.getElementById('hero-character-img') as HTMLImageElement | null;
    const heroLabel = document.getElementById('hero-label');
    if (!heroImg) {
        if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        return;
    }

    const selectedProfileValue = readCpuProfileValue('black');
    const fallbackLevel = (((typeof cpuSmartness !== 'undefined' && cpuSmartness) ? (cpuSmartness as any).black : 1) || 1);
    const cpuProfile = CpuOpponentProfiles.getCpuOpponentProfile(selectedProfileValue || fallbackLevel);
    const useCpuPortrait = !!(cpuProfile && Number(cpuProfile.level) >= 6);
    const primaryPath = useCpuPortrait
        ? String(cpuProfile.portraitSrc || HERO_IMAGE_SRC)
        : HERO_IMAGE_SRC;
    const label = useCpuPortrait
        ? String(cpuProfile.name || HERO_DEFAULT_LABEL)
        : HERO_DEFAULT_LABEL;

    heroImg.alt = label;
    if (heroLabel) heroLabel.textContent = label;

    requestPortraitImage(heroImg, primaryPath, [HERO_IMAGE_SRC], () => {
        heroImg.style.opacity = '';
    }, () => {
        heroImg.style.opacity = '0.3';
    });
}

function renderBattleStatusLatestText(el: any, text: string): void {
    if (!el) return;
    const valueText = text || '-';
    const signature = `latest:${valueText}`;
    if (battleStatusRenderSignatureByElement.get(el) === signature) return;
    el.textContent = '';
    const label = document.createElement('span');
    label.className = 'battle-status-latest-label';
    label.textContent = '直近';
    const value = document.createElement('span');
    value.className = 'battle-status-latest-value';
    value.textContent = valueText;
    el.appendChild(label);
    el.appendChild(document.createTextNode(' '));
    el.appendChild(value);
    battleStatusRenderSignatureByElement.set(el, signature);
}

function compactBattleStatusText(value: any): string {
    return String(value && typeof value === 'object' && typeof value.text === 'string' ? value.text : value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function stripBattleStatusActorPrefix(text: string): string {
    return String(text || '').replace(/^(黒|白)(?:\(Lv\d+\))?\s*[：:]\s*/, '').trim();
}

function isFastBattleStatusNoise(text: string): boolean {
    const raw = compactBattleStatusText(text);
    if (!raw) return true;
    const withoutActor = stripBattleStatusActorPrefix(raw);
    if (/布石\s*[+-]|布石[＋+]|数字マス.*布石/.test(raw)) return true;
    if (/^==\s*(黒|白)のターン/.test(raw)) return true;
    if (/^(黒|白)(?:\(Lv\d+\))?がドローしました$/.test(raw)) return true;
    if (/^(黒|白)(?:\(Lv\d+\))?が\d+枚反転！?$/.test(raw)) return true;
    if (/^パス(?:\s|$|\()/.test(withoutActor)) return true;
    if (/^(?:[A-Z]\d+|左外\d+|右外\d+)\s+に置き、\d+枚反転！?$/.test(withoutActor)) return true;
    return false;
}

function normalizeBattleStatusEventText(message: any): string {
    const raw = compactBattleStatusText(message);
    if (!raw) return '';
    const cardUseMatch = raw.match(/^(黒|白)(?:\(Lv\d+\))?がカードを使用[：:]\s*([^()]+?)(?:\s*\(|$)/);
    if (cardUseMatch) return `${cardUseMatch[2].trim()}を使用`;
    if (isFastBattleStatusNoise(raw)) return '';
    const legacyCardEffectMatch = raw.match(/^(黒|白)(?:\(Lv\d+\))?が(.+?)で\s*(.+)$/);
    if (legacyCardEffectMatch) return `${legacyCardEffectMatch[2].trim()}: ${legacyCardEffectMatch[3].trim()}`.replace(/\s+/g, ' ');
    const withoutActor = stripBattleStatusActorPrefix(raw);
    if (isFastBattleStatusNoise(withoutActor)) return '';
    const cardEffectMatch = withoutActor.match(/^(.+?)で\s*(.+)$/);
    if (cardEffectMatch) return `${cardEffectMatch[1].trim()}: ${cardEffectMatch[2].trim()}`.replace(/\s+/g, ' ');
    return withoutActor.replace(/\s+/g, ' ');
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
    if (!visible) roundEl.style.opacity = '0';
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
    if (roundEl) roundEl.textContent = '';
    if (updateAfterClear) updateRoundDisplay();
}

function resolveRoundDisplayText(): string {
    if (hasActiveRoundDisplayBonus()) {
        return roundDisplayBonusState.text.trim();
    }
    return '';
}

function formatRoundBonusDisplayText(amount: number): string {
    return `ROUND BONUS +${amount} 布石`;
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
    const text = formatRoundBonusDisplayText(amount);
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
    const boardAnchor = getRoundDisplayBoardAnchorElement();
    if (!roundEl) return;
    if (!hasActiveRoundDisplayBonus()) {
        setRoundDisplayVisibility(roundEl, false);
        return;
    }
    if (!boardAnchor || typeof boardAnchor.getBoundingClientRect !== 'function') {
        setRoundDisplayVisibility(roundEl, false);
        return;
    }

    const boardRect = boardAnchor.getBoundingClientRect();
    if (!Number.isFinite(boardRect.left) || !Number.isFinite(boardRect.top) || !Number.isFinite(boardRect.width)) return;

    const scale = getLayoutStageScaleForStatusDisplay();
    setRoundDisplayVisibility(roundEl, true);
    roundEl.style.left = `${Math.round(boardRect.left + (boardRect.width / 2))}px`;
    roundEl.style.top = `${Math.round(Math.max(8, boardRect.top - (24 * scale)))}px`;
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
            const boardAnchor = getRoundDisplayBoardAnchorElement();
            if (boardAnchor) {
                roundDisplayResizeObserver = new ResizeObserver(reposition);
                roundDisplayResizeObserver.observe(boardAnchor);
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
    showPortraitSpeechBubble(text, Object.assign({}, options || {}, { speakerRole: PORTRAIT_SPEECH_ROLE_CPU }));
}

function showHeroSpeechBubble(text: string, options: any = {}): void {
    showPortraitSpeechBubble(text, Object.assign({}, options || {}, { speakerRole: PORTRAIT_SPEECH_ROLE_HERO }));
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
        ? Math.min(10, Math.max(1, Math.round(levelNumber)))
        : 1;
    const CPU_BASE_VISUAL_SCALE = 0.88;
    const CPU_LEVEL_VISUAL_SCALE_STEP = 0.07;
    const levelScale = CPU_BASE_VISUAL_SCALE * (1 + ((normalizedLevel - 1) * CPU_LEVEL_VISUAL_SCALE_STEP));

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
    const selectedProfileValue = readWhiteCpuProfileValue();
    const fallbackLevel = (((typeof cpuSmartness !== 'undefined' && cpuSmartness) ? (cpuSmartness as any).white : 1) || 1);
    const cpuProfile = CpuOpponentProfiles.getCpuOpponentProfile(selectedProfileValue || fallbackLevel);
    const level = cpuProfile.level;
    const hasNamedProfileOverride = cpuProfile.id !== String(cpuProfile.level);
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
            : (hasNamedProfileOverride
                ? String(cpuProfile.portraitSrc)
                : (specialPresentation && specialPresentation.imageSrc
                ? String(specialPresentation.imageSrc)
                : String(cpuProfile.portraitSrc || `assets/images/cpu/level${displayLevel}.png`)));
        const fallbackCandidates: string[] = [];
        const levelImagePath = `assets/images/cpu/level${displayLevel}.png`;
        const legacyFallbackPath = `assets/cpu-characters/level${displayLevel}.png`;
        if (!useNetworkHeroPresentation) {
            if (levelImagePath !== primaryPath) fallbackCandidates.push(levelImagePath);
            fallbackCandidates.push(legacyFallbackPath);
        }
        charImg.alt = useNetworkHeroPresentation
            ? '対戦相手の勇者'
            : (hasNamedProfileOverride
                ? String(cpuProfile.name)
                : (specialPresentation ? String(specialPresentation.label || '敵CPU') : '敵CPU'));
        setCpuCharacterNetworkHeroState(charImg, useNetworkHeroPresentation);
        if (useNetworkHeroPresentation) resetCpuCharacterLevelScale(charImg);
        else applyCpuCharacterLevelScale(charImg, displayLevel);
        applySpecialCpuPanelState(specialPresentation, charImg, levelLabel);
        
        requestPortraitImage(charImg, primaryPath, fallbackCandidates, () => {
            try { positionCpuSpeechBubble(); } catch (e) { /* ignore */ }
        }, () => {
            resetCpuCharacterLevelScale(charImg);
            applySpecialCpuPanelState(specialPresentation, charImg, levelLabel);
            if (!(specialPresentation && specialPresentation.fadeOut === true)) {
                charImg.style.opacity = '0.3';
            }
            console.warn(`敵キャラクター画像が見つかりません: ${primaryPath}`);
        });

        const defaultName = hasNamedProfileOverride
            ? String(cpuProfile.name)
            : ((CPU_LEVEL_NAMES as any)[level] || ('レベル ' + level));
        if (specialPresentation) {
            applyCpuLevelLabelInteractivity(levelLabel, false, String(specialPresentation.label));
            if (heroLabel) heroLabel.textContent = HERO_DEFAULT_LABEL;
        }
        else if (!applyNetworkSeatLabels(levelLabel)) {
            applyCpuLevelLabelInteractivity(levelLabel, true, `Lv${level}${level === 10 ? '\n' : ' '}${defaultName}`);
        }
        else {
            applyNetworkSeatLabels(levelLabel);
        }
    }
    try { updateHeroCharacterForBlackCpuProfile(); } catch (e) { /* ignore */ }
}

if (typeof window !== 'undefined') {
    try { (window as any).showCpuSpeechBubble = showCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).showHeroSpeechBubble = showHeroSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).hideCpuSpeechBubble = hideCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).hideHeroSpeechBubble = hideHeroSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).positionCpuSpeechBubble = positionCpuSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).positionHeroSpeechBubble = positionHeroSpeechBubble; } catch (e) { /* ignore */ }
    try { (window as any).showRoundBonusDisplay = showRoundBonusDisplay; } catch (e) { /* ignore */ }
    try { (window as any).clearRoundDisplayBonus = clearRoundDisplayBonus; } catch (e) { /* ignore */ }
    try { (window as any).setBattleStatusNetworkTimerInfo = setBattleStatusNetworkTimerInfo; } catch (e) { /* ignore */ }
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
    showHeroSpeechBubble,
    hideCpuSpeechBubble,
    hideHeroSpeechBubble,
    positionCpuSpeechBubble,
    positionHeroSpeechBubble,
    showRoundBonusDisplay,
    clearRoundDisplayBonus,
    updateCpuCharacter,
    updateStatus,
    updateBattleStatusPanel,
    setBattleStatusNetworkTimerInfo,
    recordBattleStatusEvent,
    clearBattleStatusPanel,
    updateFateWillBanner,
    updateRoundDisplay,
    showResult,
    showResultOverlay
};

export = StatusDisplayModule;
