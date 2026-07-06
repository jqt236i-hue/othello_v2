import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

// PR1: debug-only perf benchmark helper (window.__DEV_PERF__ === true or ?perf=1).
// OFF path is zero-cost: every helper early-returns after the internal flag check.
let PerfBenchmarks: any = null;
if (typeof _require === 'function') {
    try { PerfBenchmarks = _require('./perf-benchmarks'); } catch (e: any) { /* ignore */ }
}
if (!PerfBenchmarks && typeof globalThis !== 'undefined') {
    try {
        const globalPerf = (globalThis as any).PerfBenchmarks;
        if (globalPerf) PerfBenchmarks = globalPerf;
    } catch (e: any) { /* ignore */ }
}

declare const gameState: any;
declare const cardState: any;
declare const boardEl: any;
declare const getPlayerKey: (...args: any[]) => any;
declare const CardLogic: any;
declare const getLegalMoves: (...args: any[]) => any;
declare const renderBoardDiff: (...args: any[]) => any;
declare const forceFullRender: (...args: any[]) => any;
declare const BLACK: number;
declare const WHITE: number;
declare const EMPTY: number;
declare const MarkersAdapter: any;
declare const applyStoneVisualEffect: (...args: any[]) => any;
declare const applyTrapStoneFallbackVisual: (...args: any[]) => any;
declare const getEffectKeyForSpecialType: (...args: any[]) => any;
declare const SPECIAL_TYPE_TO_EFFECT_KEY: any;
declare const attachBoardCellInteraction: (...args: any[]) => any;
declare const handleCellClick: (...args: any[]) => any;
declare const countDiscs: (...args: any[]) => any;

/**
 * @file board-renderer.js
 * @description 盤面レンダリング（差分レンダリング対応版）
 * Board rendering with differential rendering support
 */

/**
 * 盤面を描画（差分レンダリング使用）
 * Render board using differential rendering for performance
 * 
 * Note: Requires diff-renderer.js to be loaded first
 */
var OwnerHelpersModule: any = null;
if (typeof require === 'function') {
    try { OwnerHelpersModule = require('../utils/owner-helpers'); } catch (e: any) { /* ignore */ }
}
if (!OwnerHelpersModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).OwnerHelpers) OwnerHelpersModule = (globalThis as any).OwnerHelpers;
    } catch (e: any) { /* ignore */ }
}

var BoardRendererSoundEngineAccessModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererSoundEngineAccessModule = require('./sound-engine-access'); } catch (e: any) { /* ignore */ }
}

var BoardRendererManifestStoneRegistryModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererManifestStoneRegistryModule = require('../shared/manifest-stone-registry'); } catch (e: any) { /* ignore */ }
}

var BoardRendererStoneStatusSnapshotModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererStoneStatusSnapshotModule = require('../shared/stone-status-snapshot'); } catch (e: any) { /* ignore */ }
}

var BoardRendererHintProjectionModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererHintProjectionModule = require('../shared/board-hint-projection'); } catch (e: any) { /* ignore */ }
}

var BoardRendererStoneHelpersRegistryModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererStoneHelpersRegistryModule = require('./board-renderer/stone-helpers'); } catch (e: any) { /* ignore */ }
}

function _getBoardHintProjectionForBoardRenderer() {
    if (BoardRendererHintProjectionModule) return BoardRendererHintProjectionModule;
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).BoardHintProjection) {
            BoardRendererHintProjectionModule = (globalThis as any).BoardHintProjection;
            return BoardRendererHintProjectionModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _buildBoardHintProjectionForBoardRenderer(gameStateValue: any, cardStateValue: any, playerKey: any, boardShape: any, canControlCurrentTurn: boolean, isHumanTurn: boolean) {
    const projectionModule = _getBoardHintProjectionForBoardRenderer();
    if (!projectionModule || typeof projectionModule.buildBoardHintProjection !== 'function') return null;
    return projectionModule.buildBoardHintProjection({
        gameState: gameStateValue,
        cardState: cardStateValue,
        playerKey,
        boardShape,
        canControlCurrentTurn,
        isHumanTurn,
        cardLogic: (typeof CardLogic !== 'undefined' ? CardLogic : null),
        getLegalMoves: (typeof getLegalMoves === 'function' ? getLegalMoves : null)
    });
}

function _resolveNetworkVisualStateStoreForBoardRenderer() {
    try {
        if (typeof window !== 'undefined' && (window as any).NetworkVisualStateStore) {
            return (window as any).NetworkVisualStateStore;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).NetworkVisualStateStore) {
            return (globalThis as any).NetworkVisualStateStore;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveNetworkPresentationTimelineForBoardRenderer() {
    try {
        if (typeof window !== 'undefined' && (window as any).NetworkPresentationTimeline) {
            return (window as any).NetworkPresentationTimeline;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).NetworkPresentationTimeline) {
            return (globalThis as any).NetworkPresentationTimeline;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _isStrictNetworkVisualRenderActiveForBoardRenderer() {
    const store = _resolveNetworkVisualStateStoreForBoardRenderer();
    try {
        const diagnostics = store && typeof store.getDiagnostics === 'function'
            ? store.getDiagnostics()
            : null;
        if (diagnostics && diagnostics.lagging === true) return true;
    } catch (e: any) { /* ignore */ }
    const timeline = _resolveNetworkPresentationTimelineForBoardRenderer();
    try {
        const diagnostics = timeline && typeof timeline.getDiagnostics === 'function'
            ? timeline.getDiagnostics()
            : null;
        return !!(
            diagnostics &&
            (
                diagnostics.playing === true ||
                diagnostics.paused === true ||
                Number(diagnostics.pendingFrameCount) > 0
            )
        );
    } catch (e: any) { /* ignore */ }
    return false;
}

function _resolveGlobalGameStateForBoardRenderer() {
    try {
        if (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object') return gameState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && (window as any).gameState && typeof (window as any).gameState === 'object') return (window as any).gameState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).gameState && typeof (globalThis as any).gameState === 'object') return (globalThis as any).gameState;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveGlobalCardStateForBoardRenderer() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && (window as any).cardState && typeof (window as any).cardState === 'object') return (window as any).cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object') return (globalThis as any).cardState;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveBoardRenderStateForBoardRenderer() {
    if (_isStrictNetworkVisualRenderActiveForBoardRenderer()) {
        const store = _resolveNetworkVisualStateStoreForBoardRenderer();
        try {
            const snapshot = store && typeof store.getRenderSnapshot === 'function'
                ? store.getRenderSnapshot()
                : null;
            if (snapshot && snapshot.gameState && snapshot.cardState) {
                return {
                    gameState: snapshot.gameState,
                    cardState: snapshot.cardState,
                    source: 'network_visual_state'
                };
            }
        } catch (e: any) { /* ignore */ }
    }
    return {
        gameState: _resolveGlobalGameStateForBoardRenderer(),
        cardState: _resolveGlobalCardStateForBoardRenderer(),
        source: 'global'
    };
}

function _getBoardShapeForBoardRenderer() {
    const state = _resolveBoardRenderStateForBoardRenderer().gameState;
    const board = state && Array.isArray(state.board) ? state.board : null;
    let rows = Array.isArray(board) ? board.length : 8;
    let cols = 0;
    if (Array.isArray(board)) {
        for (const row of board) {
            if (Array.isArray(row)) cols = Math.max(cols, row.length);
        }
    }
    if (!Number.isInteger(rows) || rows <= 0) rows = 8;
    if (!Number.isInteger(cols) || cols <= 0) cols = 8;
    return { rows, cols };
}

// PR2 N3 syncBoardPixelSizing dirty gate.
// Revision 2 (PR2 v2):
//   signature expanded from (rows, cols, frameExists) to a 12-key composite that
//   also catches element identity swaps, skin switches, layout scale changes,
//   frame padding changes, and devicePixelRatio shifts. getComputedStyle() is
//   intentionally NOT used in signature computation (would reflow inside the
//   gate we just opened to remove reflow). The dirty flag is forced true on:
//     - module load (initial sync)
//     - _handleBoardPixelSizingViewportChange (window/frame resize)
//     - _ensureBoardPixelSizingObserver when the observed frame is swapped
//     - ResizeObserver-less / frame-absent fallback paths
//     - visibilitychange (when document becomes visible)
//     - pageshow (bfcache restoration)
let _boardPixelSizingSignature: string | null = null;
let _boardPixelSizingDirty = true;
let boardPixelSizingObserver: any = null;
let boardPixelSizingObservedFrame: any = null;
let boardPixelSizingObservedElement: any = null;
let boardPixelSizingWindowHandlerInstalled = false;
let _boardPixelSizingPageStateHandlersInstalled = false;
let timeStopBgmPausedByBoardRenderer = false;
const _boardElementIdentityToken = new WeakMap<any, number>();
const _frameElementIdentityToken = new WeakMap<any, number>();
let _nextBoardElementIdentity = 1;
let _nextFrameElementIdentity = 1;
const STANDARD_BOARD_BASELINE_ROWS = 8;
const STANDARD_BOARD_BASELINE_COLS = 8;
const BOARD_FRAME_OVERSIZE_TOLERANCE_PX = 1;

function _getManifestStoneRegistryForBoardRenderer() {
    if (BoardRendererManifestStoneRegistryModule) return BoardRendererManifestStoneRegistryModule;
    try {
        if (typeof window !== 'undefined' && (window as any).ManifestStoneRegistry) {
            BoardRendererManifestStoneRegistryModule = (window as any).ManifestStoneRegistry;
            return BoardRendererManifestStoneRegistryModule;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).ManifestStoneRegistry) {
            BoardRendererManifestStoneRegistryModule = (globalThis as any).ManifestStoneRegistry;
            return BoardRendererManifestStoneRegistryModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _getStoneStatusSnapshotForBoardRenderer() {
    if (BoardRendererStoneStatusSnapshotModule) return BoardRendererStoneStatusSnapshotModule;
    try {
        if (typeof window !== 'undefined' && (window as any).StoneStatusSnapshot) {
            BoardRendererStoneStatusSnapshotModule = (window as any).StoneStatusSnapshot;
            return BoardRendererStoneStatusSnapshotModule;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).StoneStatusSnapshot) {
            BoardRendererStoneStatusSnapshotModule = (globalThis as any).StoneStatusSnapshot;
            return BoardRendererStoneStatusSnapshotModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveSpecialTimerClassForBoard(type: any) {
    const snapshotModule = _getStoneStatusSnapshotForBoardRenderer();
    if (snapshotModule && typeof snapshotModule.createSpecialStoneStatusSnapshot === 'function') {
        const snapshot = snapshotModule.createSpecialStoneStatusSnapshot({ type }, { mode: 'raw' });
        if (snapshot && snapshot.timerClass) return String(snapshot.timerClass);
    }
    const typeUpper = String(type || '').toUpperCase();
    return (typeUpper === 'DRAGON' || typeUpper === 'DESTROY_DRAGON') ? 'dragon-timer'
        : (typeUpper === 'ULTIMATE_DESTROY_GOD' ? 'udg-timer'
            : (typeUpper === 'BREEDING' ? 'breeding-timer'
                : (typeUpper === 'WORK' ? 'work-timer'
                    : (typeUpper === 'TIME_STOP' ? 'countdown-timer' : 'special-timer'))));
}

function _isManifestStoneTypeForBoardRenderer(rawType: any) {
    const registry = _getManifestStoneRegistryForBoardRenderer();
    if (registry && typeof registry.isManifestStoneType === 'function') {
        return registry.isManifestStoneType(rawType) === true;
    }
    const typeKey = String(rawType || '').trim().toUpperCase();
    return typeKey === 'THEORY_INCARNATION' || typeKey === 'BOARD_EXECUTOR' || typeKey === 'OBSERVER_WILL';
}

function _isActiveManifestAuraMarkerForBoard(marker: any, manifestMarkerKind: any, specialMarkerKind: any) {
    if (!marker || typeof marker !== 'object') return false;
    const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
    const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
    if (!typeKey) return false;
    const kind = String((marker && marker.kind) || '').trim();
    const isManifestKind = kind === manifestMarkerKind || kind === 'manifestStone';
    const isLegacyManifestType = (kind === specialMarkerKind || !kind) && _isManifestStoneTypeForBoardRenderer(typeKey);
    if (!isManifestKind && !isLegacyManifestType) return false;
    const remainingRaw = data.remainingOwnerTurns ?? data.remainingTurns ?? marker.remainingOwnerTurns ?? marker.remainingTurns;
    if (remainingRaw == null) return true;
    const remaining = Number(remainingRaw);
    return !Number.isFinite(remaining) || remaining > 0;
}

function _getManifestAuraOwnerClassForBoard(owner: any) {
    return (owner === 'black' || owner === BLACK || owner === 1) ? 'black' : 'white';
}

function _resolveSoundEngineAccessForBoardRenderer() {
    if (BoardRendererSoundEngineAccessModule) return BoardRendererSoundEngineAccessModule;
    try {
        if (typeof window !== 'undefined' && window.SoundEngineAccessModule) {
            BoardRendererSoundEngineAccessModule = window.SoundEngineAccessModule;
            return BoardRendererSoundEngineAccessModule;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SoundEngineAccessModule) {
            BoardRendererSoundEngineAccessModule = (globalThis as any).SoundEngineAccessModule;
            return BoardRendererSoundEngineAccessModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveSoundEngineForBoardRenderer() {
    const accessModule = _resolveSoundEngineAccessForBoardRenderer();
    if (accessModule && typeof accessModule.resolveSoundEngine === 'function') {
        return accessModule.resolveSoundEngine(typeof window !== 'undefined' ? window : globalThis);
    }
    try {
        if (typeof SoundEngine !== 'undefined' && SoundEngine) return SoundEngine;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.SoundEngine) return window.SoundEngine;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SoundEngine) return (globalThis as any).SoundEngine;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _isBgmPlayingForBoardRenderer(engine: any) {
    const accessModule = _resolveSoundEngineAccessForBoardRenderer();
    if (accessModule && typeof accessModule.isBgmPlaying === 'function') {
        return accessModule.isBgmPlaying(engine);
    }
    return !!(engine && engine.allowBgmPlay === true && engine.bgm && engine.bgm.paused !== true);
}

function _isBoardShapeOversizeForPixelSizing(shape: any) {
    const rows = shape && Number.isFinite(shape.rows) ? shape.rows : STANDARD_BOARD_BASELINE_ROWS;
    const cols = shape && Number.isFinite(shape.cols) ? shape.cols : STANDARD_BOARD_BASELINE_COLS;
    return rows > STANDARD_BOARD_BASELINE_ROWS || cols > STANDARD_BOARD_BASELINE_COLS;
}

function _normalizeBoardShapeForPixelSizing(shapeOrState: any) {
    const rows = Number(shapeOrState && shapeOrState.rows);
    const cols = Number(shapeOrState && shapeOrState.cols);
    if (Number.isFinite(rows) && Number.isFinite(cols)) {
        return {
            rows: Math.max(1, Math.trunc(rows)),
            cols: Math.max(1, Math.trunc(cols))
        };
    }
    return _getBoardShapeForBoardRenderer();
}

function _clearBoardPixelSizingVars(boardElement: any) {
    if (boardElement && boardElement.style) {
        boardElement.style.removeProperty('width');
        boardElement.style.removeProperty('height');
        boardElement.style.removeProperty('left');
        boardElement.style.removeProperty('top');
        boardElement.style.removeProperty('transform');
        boardElement.style.removeProperty('--board-cell-size-px');
        boardElement.style.removeProperty('--board-disc-inset-px');
        boardElement.style.removeProperty('--board-disc-size-px');
    }
    _clearBoardExpansionLayerGeometry(boardElement);
    const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
    _clearBoardFramePixelSizingVars(frameElement);
    _setBoardOversizeLayoutState(frameElement, false);
}

function _getBoardFrameElementForPixelSizing(boardElement: any) {
    if (!boardElement) return null;
    if (typeof boardElement.closest === 'function') {
        const closestFrame = boardElement.closest('#board-frame');
        if (closestFrame) return closestFrame;
    }
    if (typeof document !== 'undefined' && document && typeof document.getElementById === 'function') {
        return document.getElementById('board-frame');
    }
    return null;
}

function resolveBoardExpansionLayerElement(boardElement: any, createIfMissing?: any) {
    if (typeof document === 'undefined' || !document) return null;
    const boardFrame = _getBoardFrameElementForPixelSizing(boardElement);
    const boardStack = boardFrame && boardFrame.parentElement
        ? boardFrame.parentElement
        : (boardElement && boardElement.parentElement ? boardElement.parentElement : null);
    if (!boardStack) return null;

    let layer = null;
    if (typeof boardStack.querySelector === 'function') {
        layer = boardStack.querySelector('#board-expansion-layer');
    }
    if (layer || !createIfMissing || typeof document.createElement !== 'function') {
        return layer;
    }

    layer = document.createElement('div');
    layer.id = 'board-expansion-layer';
    layer.setAttribute('aria-hidden', 'true');
    const chargeHudLayer = typeof boardStack.querySelector === 'function'
        ? boardStack.querySelector('#charge-hud-layer')
        : null;
    if (chargeHudLayer && chargeHudLayer.parentNode === boardStack) {
        boardStack.insertBefore(layer, chargeHudLayer);
    } else if (boardFrame && boardFrame.parentNode === boardStack) {
        boardStack.insertBefore(layer, boardFrame.nextSibling);
    } else {
        boardStack.appendChild(layer);
    }
    return layer;
}

function _clearBoardExpansionLayerGeometry(boardElement: any) {
    const expansionLayer = resolveBoardExpansionLayerElement(boardElement, false);
    if (!expansionLayer || !expansionLayer.style) return;
    expansionLayer.style.removeProperty('left');
    expansionLayer.style.removeProperty('top');
    expansionLayer.style.removeProperty('width');
    expansionLayer.style.removeProperty('height');
    expansionLayer.style.removeProperty('--board-rows');
    expansionLayer.style.removeProperty('--board-cols');
}

function syncBoardExpansionLayerGeometry(boardElement: any, shapeInput?: any) {
    const expansionLayer = resolveBoardExpansionLayerElement(boardElement, true);
    const shape = _normalizeBoardShapeForPixelSizing(shapeInput);
    if (!expansionLayer || !expansionLayer.style) return shape;

    expansionLayer.style.setProperty('--board-rows', String(shape.rows));
    expansionLayer.style.setProperty('--board-cols', String(shape.cols));

    if (!boardElement) return shape;

    let width = 0;
    let height = 0;
    let left = 0;
    let top = 0;

    if (typeof boardElement.getBoundingClientRect === 'function') {
        const boardRect = boardElement.getBoundingClientRect();
        width = Number.isFinite(boardRect.width) ? boardRect.width : 0;
        height = Number.isFinite(boardRect.height) ? boardRect.height : 0;
        const offsetParent = expansionLayer.offsetParent || expansionLayer.parentElement;
        if (offsetParent && typeof offsetParent.getBoundingClientRect === 'function') {
            const offsetRect = offsetParent.getBoundingClientRect();
            left = Number.isFinite(boardRect.left) && Number.isFinite(offsetRect.left) ? boardRect.left - offsetRect.left : 0;
            top = Number.isFinite(boardRect.top) && Number.isFinite(offsetRect.top) ? boardRect.top - offsetRect.top : 0;
        }
    }

    if (!(width > 0)) {
        const styleWidth = Number.parseFloat(boardElement.style && boardElement.style.width ? boardElement.style.width : '0');
        width = Number.isFinite(styleWidth) ? styleWidth : 0;
    }
    if (!(height > 0)) {
        const styleHeight = Number.parseFloat(boardElement.style && boardElement.style.height ? boardElement.style.height : '0');
        height = Number.isFinite(styleHeight) ? styleHeight : 0;
    }
    if (!Number.isFinite(left) || !Number.isFinite(top)) {
        left = 0;
        top = 0;
    }

    expansionLayer.style.left = `${left}px`;
    expansionLayer.style.top = `${top}px`;
    if (width > 0) expansionLayer.style.width = `${width}px`;
    else expansionLayer.style.removeProperty('width');
    if (height > 0) expansionLayer.style.height = `${height}px`;
    else expansionLayer.style.removeProperty('height');

    return shape;
}

function _clearBoardFramePixelSizingVars(frameElement: any) {
    if (!frameElement || !frameElement.style) return;
    frameElement.style.removeProperty('--board-frame-outer-width');
    frameElement.style.removeProperty('--board-frame-outer-height');
}

function _getBoardLayoutContainerForPixelSizing(frameElement: any) {
    if (frameElement && typeof frameElement.closest === 'function') {
        const closestContainer = frameElement.closest('#game-container');
        if (closestContainer) return closestContainer;
    }
    if (typeof document !== 'undefined' && document && typeof document.getElementById === 'function') {
        return document.getElementById('game-container');
    }
    return null;
}

function _setBoardOversizeLayoutState(frameElement: any, active: any) {
    const oversizeActive = !!active;
    if (typeof document !== 'undefined' && document && document.body && document.body.classList) {
        document.body.classList.toggle('board-oversize-active', oversizeActive);
    }
    const layoutContainer = _getBoardLayoutContainerForPixelSizing(frameElement);
    if (layoutContainer && layoutContainer.classList) {
        layoutContainer.classList.toggle('board-oversize-active', oversizeActive);
    }
}

function _measureBoardFrameBaseOuterSize(frameElement: any) {
    if (!frameElement || typeof document === 'undefined' || !document || typeof document.createElement !== 'function') {
        return null;
    }
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = 'calc(var(--board-frame-inner-size) + var(--board-frame-padding-left) + var(--board-frame-padding-right))';
    probe.style.height = 'calc(var(--board-frame-inner-size) + var(--board-frame-padding-top) + var(--board-frame-padding-bottom))';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.boxSizing = 'border-box';
    probe.style.padding = '0';
    probe.style.margin = '0';
    probe.style.border = '0';
    frameElement.appendChild(probe);
    let rect: any = null;
    if (typeof probe.getBoundingClientRect === 'function') {
        rect = probe.getBoundingClientRect();
    }
    frameElement.removeChild(probe);
    if (!rect || !(rect.width > 0) || !(rect.height > 0)) return null;
    return { width: rect.width, height: rect.height };
}

function _getContentRectSizeForPixelSizing(element: any) {
    if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function' || typeof element.getBoundingClientRect !== 'function') {
        return null;
    }
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const borderX = Number.parseFloat(style.borderLeftWidth || '0') + Number.parseFloat(style.borderRightWidth || '0');
    const borderY = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderBottomWidth || '0');
    const width = rect.width - (Number.isFinite(borderX) ? borderX : 0);
    const height = rect.height - (Number.isFinite(borderY) ? borderY : 0);
    if (!(width > 0) || !(height > 0)) return null;
    return { width, height };
}

function _getBoardBoxMetricsForPixelSizing(boardElement: any) {
    if (!boardElement || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
        return { borderX: 0, borderY: 0, boxSizing: '' };
    }
    const style = window.getComputedStyle(boardElement);
    const borderX = Number.parseFloat(style.borderLeftWidth || '0') + Number.parseFloat(style.borderRightWidth || '0');
    const borderY = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderBottomWidth || '0');
    return {
        borderX: Number.isFinite(borderX) ? borderX : 0,
        borderY: Number.isFinite(borderY) ? borderY : 0,
        boxSizing: String(style.boxSizing || '').trim().toLowerCase()
    };
}

function _getBoardFrameMetricsForPixelSizing(boardElement: any) {
    const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
    if (frameElement && typeof window !== 'undefined' && typeof window.getComputedStyle === 'function' && typeof frameElement.getBoundingClientRect === 'function') {
        const frameStyle = window.getComputedStyle(frameElement);
        const paddingX = Number.parseFloat(frameStyle.paddingLeft || '0') + Number.parseFloat(frameStyle.paddingRight || '0');
        const paddingY = Number.parseFloat(frameStyle.paddingTop || '0') + Number.parseFloat(frameStyle.paddingBottom || '0');
        const measuredBaseOuterSize = _measureBoardFrameBaseOuterSize(frameElement);
        const fallbackRect = frameElement.getBoundingClientRect();
        const baseOuterWidth = measuredBaseOuterSize && measuredBaseOuterSize.width > 0
            ? measuredBaseOuterSize.width
            : fallbackRect.width;
        const baseOuterHeight = measuredBaseOuterSize && measuredBaseOuterSize.height > 0
            ? measuredBaseOuterSize.height
            : fallbackRect.height;
        const normalizedPaddingX = Number.isFinite(paddingX) ? paddingX : 0;
        const normalizedPaddingY = Number.isFinite(paddingY) ? paddingY : 0;
        const innerWidth = baseOuterWidth - normalizedPaddingX;
        const innerHeight = baseOuterHeight - normalizedPaddingY;
        if (innerWidth > 0 && innerHeight > 0) {
            return {
                frameElement,
                baseOuterWidth,
                baseOuterHeight,
                paddingX: normalizedPaddingX,
                paddingY: normalizedPaddingY,
                innerWidth,
                innerHeight
            };
        }
    }
    return null;
}

function _getBoardBaseSizeForPixelSizing(boardElement: any) {
    const frameMetrics = _getBoardFrameMetricsForPixelSizing(boardElement);
    if (frameMetrics) {
        return {
            frameMetrics,
            width: frameMetrics.innerWidth,
            height: frameMetrics.innerHeight,
            baselineCellSize: Math.max(1, Math.floor(Math.min(
                frameMetrics.innerWidth / STANDARD_BOARD_BASELINE_COLS,
                frameMetrics.innerHeight / STANDARD_BOARD_BASELINE_ROWS
            )))
        };
    }
    const contentRect = _getContentRectSizeForPixelSizing(boardElement);
    if (!contentRect) return null;
    return {
        frameMetrics: null,
        width: contentRect.width,
        height: contentRect.height,
        baselineCellSize: 0
    };
}

function _applyBoardFramePixelSizing(frameMetrics: any, outerWidth: any, outerHeight: any, shape: any) {
    if (!frameMetrics || !frameMetrics.frameElement || !frameMetrics.frameElement.style) return;
    const frameWidth = Math.max(frameMetrics.baseOuterWidth, outerWidth + frameMetrics.paddingX);
    const frameHeight = Math.max(frameMetrics.baseOuterHeight, outerHeight + frameMetrics.paddingY);
    const allowFrameExpansion = _isBoardShapeOversizeForPixelSizing(shape);
    const oversizeActive = allowFrameExpansion && (
        frameWidth > (frameMetrics.baseOuterWidth + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)
        || frameHeight > (frameMetrics.baseOuterHeight + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)
    );
    if (allowFrameExpansion && frameWidth > (frameMetrics.baseOuterWidth + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)) {
        frameMetrics.frameElement.style.setProperty('--board-frame-outer-width', `${frameWidth}px`);
    } else {
        frameMetrics.frameElement.style.removeProperty('--board-frame-outer-width');
    }
    if (allowFrameExpansion && frameHeight > (frameMetrics.baseOuterHeight + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)) {
        frameMetrics.frameElement.style.setProperty('--board-frame-outer-height', `${frameHeight}px`);
    } else {
        frameMetrics.frameElement.style.removeProperty('--board-frame-outer-height');
    }
    _setBoardOversizeLayoutState(frameMetrics.frameElement, oversizeActive);
}

// PR2 v2: page-state listeners (visibilitychange / pageshow). Visible-tab
// transitions and bfcache restoration can re-introduce viewport / DPR
// changes without firing resize, so we always re-sync on those events.
function _installBoardPixelSizingPageStateHandlers() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    if (_boardPixelSizingPageStateHandlersInstalled) return;
    window.addEventListener('visibilitychange', () => {
        if (typeof document !== 'undefined' && document && (document as any).visibilityState === 'visible') {
            _boardPixelSizingDirty = true;
        }
    });
    window.addEventListener('pageshow', () => {
        _boardPixelSizingDirty = true;
    });
    _boardPixelSizingPageStateHandlersInstalled = true;
}

// PR2 v2: stable identity tokens for boardEl / frameEl. Same ref always returns
// the same token; a ref swap gets a fresh token which immediately invalidates
// the cached signature.
function _getBoardElementIdentityToken(el: any): number {
    if (!el) return 0;
    let t = _boardElementIdentityToken.get(el);
    if (t === undefined) {
        t = _nextBoardElementIdentity++;
        _boardElementIdentityToken.set(el, t);
    }
    return t;
}

function _getFrameElementIdentityToken(el: any): number {
    if (!el) return 0;
    let t = _frameElementIdentityToken.get(el);
    if (t === undefined) {
        t = _nextFrameElementIdentity++;
        _frameElementIdentityToken.set(el, t);
    }
    return t;
}

// PR2 v2: 12-key signature. All entries are stable across normal renders and
// change only at the boundaries where _boardPixelSizingDirty is forced true:
//   1-2: shape rows/cols
//   3-4: boardEl / frameEl WeakMap identity tokens
//   5-6: root data-board-skin-id / data-board-frame-skin-id (skin switch)
//   7:   --layout-stage-scale (inline root style, layout profile scale)
//   8-11: --board-frame-padding-{top,right,bottom,left} (frame skin switch)
//   12:  window.devicePixelRatio (DPR shift)
// getComputedStyle() is intentionally avoided here (would force layout
// inside the very gate that exists to avoid layout).
function _computeBoardPixelSizingSignature(boardElement: any, shape: any): string {
    const frameEl = _getBoardFrameElementForPixelSizing(boardElement);
    const docEl = (typeof document !== 'undefined' && document && document.documentElement) || null;
    const rootStyle = (docEl && (docEl as any).style) || null;
    const rootDataset = (docEl && (docEl as any).dataset) || null;
    const dpr = (typeof window !== 'undefined' && Number.isFinite((window as any).devicePixelRatio))
        ? String((window as any).devicePixelRatio) : '0';
    const boardSkinId = rootDataset ? String((rootDataset as any).boardSkinId || '') : '';
    const frameSkinId = rootDataset ? String((rootDataset as any).boardFrameSkinId || '') : '';
    const layoutScale = rootStyle ? rootStyle.getPropertyValue('--layout-stage-scale') : '';
    const padTop = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-top') : '';
    const padRight = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-right') : '';
    const padBottom = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-bottom') : '';
    const padLeft = rootStyle ? rootStyle.getPropertyValue('--board-frame-padding-left') : '';
    return [
        shape.rows,
        shape.cols,
        _getBoardElementIdentityToken(boardElement),
        _getFrameElementIdentityToken(frameEl),
        boardSkinId,
        frameSkinId,
        layoutScale,
        padTop, padRight, padBottom, padLeft,
        dpr
    ].join('|');
}

function _handleBoardPixelSizingViewportChange() {
    if (!boardPixelSizingObservedElement) return;
    // PR2 (N3 dirty gate): window/frame resize must always re-sync even when
    // the (shape, frame) signature is unchanged.
    _boardPixelSizingDirty = true;
    syncBoardPixelSizing(boardPixelSizingObservedElement);
}

function _ensureBoardPixelSizingObserver(boardElement: any) {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !boardPixelSizingWindowHandlerInstalled) {
        window.addEventListener('resize', _handleBoardPixelSizingViewportChange, { passive: true });
        boardPixelSizingWindowHandlerInstalled = true;
        // PR2 v2: page-state listeners installed alongside the resize listener
        // so they share the same one-time setup contract.
        _installBoardPixelSizingPageStateHandlers();
    }

    boardPixelSizingObservedElement = boardElement || boardPixelSizingObservedElement;
    const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
    // PR2 v2: in fallback / frame-detached paths, the cached signature can no
    // longer be trusted to represent current state, so force the next
    // syncBoardPixelSizing() call into the full path.
    if (typeof ResizeObserver !== 'function' || !frameElement) {
        _boardPixelSizingDirty = true;
        return;
    }
    if (boardPixelSizingObserver && boardPixelSizingObservedFrame === frameElement) return;

    if (boardPixelSizingObserver && typeof boardPixelSizingObserver.disconnect === 'function') {
        try {
            boardPixelSizingObserver.disconnect();
        } catch (e: any) { /* ignore */ }
    }

    boardPixelSizingObservedFrame = frameElement;
    try {
        boardPixelSizingObserver = new ResizeObserver(_handleBoardPixelSizingViewportChange);
        boardPixelSizingObserver.observe(frameElement);
    } catch (e: any) {
        boardPixelSizingObserver = null;
    }
    // PR2 (N3 dirty gate): when the observed frame element is swapped (or this
    // is the first live element), the cached signature no longer applies.
    // Force re-sync on the next syncBoardPixelSizing call.
    _boardPixelSizingDirty = true;
}

function syncBoardPixelSizing(boardElement: any, shapeInput?: any) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('syncBoardPixelSizing');
    try {
        const shape = _normalizeBoardShapeForPixelSizing(shapeInput);
    if (!boardElement || !boardElement.style) return shape;

    _ensureBoardPixelSizingObserver(boardElement);

    // PR2 (N3 dirty gate): skip the body when signature is unchanged and no
    // force-dirty flag was set. The skipped steps include getComputedStyle,
    // getBoundingClientRect (incl. the snap-to-whole-pixel call), every
    // style.* write, and the follow-on syncBoardExpansionLayerGeometry.
    // PR2 v2: signature expanded to 12 keys (shape, element identity tokens,
    // root skin ids, layout-stage-scale, frame padding vars, DPR) so that
    // skin switches and layout-scale changes invalidate the cached gate.
    const _currentSig = _computeBoardPixelSizingSignature(boardElement, shape);
    if (!_boardPixelSizingDirty && _currentSig === _boardPixelSizingSignature) {
        return shape;
    }

    const boxMetrics = _getBoardBoxMetricsForPixelSizing(boardElement);
    const baseSize = _getBoardBaseSizeForPixelSizing(boardElement);
    if (!baseSize || !(baseSize.width > 0) || !(baseSize.height > 0)) {
        _clearBoardPixelSizingVars(boardElement);
        return shape;
    }

    const measuredCellSize = Math.max(1, Math.floor(Math.min(baseSize.width / shape.cols, baseSize.height / shape.rows)));
    const cellSize = Math.max(1, Math.max(measuredCellSize, baseSize.baselineCellSize || 0));
    if (!(cellSize > 0)) {
        _clearBoardPixelSizingVars(boardElement);
        return shape;
    }

    const discInset = Math.max(1, Math.round(cellSize * 0.0505));
    const discSize = Math.max(1, cellSize - (discInset * 2));
    const contentWidth = cellSize * shape.cols;
    const contentHeight = cellSize * shape.rows;
    const outerWidth = contentWidth + (boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderX : 0);
    const outerHeight = contentHeight + (boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderY : 0);
    boardElement.style.width = `${outerWidth}px`;
    boardElement.style.height = `${outerHeight}px`;
    boardElement.style.setProperty('--board-cell-size-px', `${cellSize}px`);
    boardElement.style.setProperty('--board-disc-inset-px', `${discInset}px`);
    boardElement.style.setProperty('--board-disc-size-px', `${discSize}px`);
    _applyBoardFramePixelSizing(baseSize.frameMetrics, outerWidth, outerHeight, shape);

    boardElement.style.removeProperty('left');
    boardElement.style.removeProperty('top');
    boardElement.style.removeProperty('transform');
    if (typeof boardElement.getBoundingClientRect === 'function') {
        const snappedRect = boardElement.getBoundingClientRect();
        const snapX = Number.isFinite(snappedRect.left) ? (Math.round(snappedRect.left) - snappedRect.left) : 0;
        const snapY = Number.isFinite(snappedRect.top) ? (Math.round(snappedRect.top) - snappedRect.top) : 0;
        if (Math.abs(snapX) > 0.001 || Math.abs(snapY) > 0.001) {
            // Keep the board aligned to whole pixels without compositing the full board via transform.
            boardElement.style.left = `${snapX}px`;
            boardElement.style.top = `${snapY}px`;
        }
    }
    syncBoardExpansionLayerGeometry(boardElement, shape);
    // PR2 (N3 dirty gate): commit new signature and clear the dirty flag so
    // the next call (with the same signature) can early-return.
    _boardPixelSizingSignature = _currentSig;
    _boardPixelSizingDirty = false;
    return shape;
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('syncBoardPixelSizing');
    }
}

function _applyBoardCssVarsForBoardRenderer(boardElement: any) {
    const shape = _getBoardShapeForBoardRenderer();
    if (boardElement && boardElement.style) {
        boardElement.style.setProperty('--board-rows', String(shape.rows));
        boardElement.style.setProperty('--board-cols', String(shape.cols));
    }
    syncBoardPixelSizing(boardElement, shape);
    return shape;
}

var PlaybackStateModule: any = null;
if (typeof require === 'function') {
    try { PlaybackStateModule = require('./playback-state-manager'); } catch (e: any) { /* ignore */ }
}
if (!PlaybackStateModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackStateManager) PlaybackStateModule = (globalThis as any).PlaybackStateManager;
    } catch (e: any) { /* ignore */ }
}

function _getBoardUpdateSyncRuntimeForBoardRenderer() {
    if (typeof require === 'function') {
        try { return require('./board-update-sync-runtime'); } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).BoardUpdateSyncRuntime) {
            return (globalThis as any).BoardUpdateSyncRuntime;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _isVisualPlaybackActiveForBoardRenderer() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return false;
}

function _getCardStateForBoardRendererPlayback() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _hasPendingPlaybackEventsForBoardRenderer() {
    if (PlaybackStateModule && typeof PlaybackStateModule.hasPendingVisualPlayback === 'function') {
        try {
            return PlaybackStateModule.hasPendingVisualPlayback(_getCardStateForBoardRendererPlayback()) === true;
        } catch (e: any) { /* ignore */ }
    }
    return false;
}

function _shouldSkipBoardRenderForPlayback() {
    if (PlaybackStateModule && typeof PlaybackStateModule.shouldDeferBoardUpdate === 'function') {
        try {
            return PlaybackStateModule.shouldDeferBoardUpdate({
                cardState: _getCardStateForBoardRendererPlayback()
            }) === true;
        } catch (e: any) { /* ignore */ }
    }
    return _isVisualPlaybackActiveForBoardRenderer() || _hasPendingPlaybackEventsForBoardRenderer();
}

function _peekBoardUpdateSyncContextForBoardRenderer() {
    const runtime = _getBoardUpdateSyncRuntimeForBoardRenderer();
    if (runtime && typeof runtime.peekBoardUpdateSyncContext === 'function') {
        try {
            const context = runtime.peekBoardUpdateSyncContext();
            if (context && typeof context === 'object') return context;
        } catch (e: any) { /* ignore */ }
    }
    return null;
}

function _isTimeStopActiveForBoardRenderer() {
    try {
        const state = _resolveBoardRenderStateForBoardRenderer().cardState;
        const remainingByPlayer = state && state.timeStopConsecutiveTurnsRemainingByPlayer;
        if (!remainingByPlayer || typeof remainingByPlayer !== 'object') return false;
        const blackRemaining = Number(remainingByPlayer.black);
        const whiteRemaining = Number(remainingByPlayer.white);
        return (Number.isFinite(blackRemaining) && blackRemaining > 0) || (Number.isFinite(whiteRemaining) && whiteRemaining > 0);
    } catch (e: any) {
        return false;
    }
}

function _syncTimeStopClassForBoardRenderer() {
    if (typeof document === 'undefined') return;
    const active = _isTimeStopActiveForBoardRenderer();
    const soundEngine = _resolveSoundEngineForBoardRenderer();
    if (soundEngine && typeof soundEngine.pauseBgm === 'function' && typeof soundEngine.playBgm === 'function') {
        if (active) {
            if (_isBgmPlayingForBoardRenderer(soundEngine)) {
                timeStopBgmPausedByBoardRenderer = true;
                try { soundEngine.pauseBgm(); } catch (e: any) { timeStopBgmPausedByBoardRenderer = false; }
            }
        } else if (timeStopBgmPausedByBoardRenderer) {
            timeStopBgmPausedByBoardRenderer = false;
            try { soundEngine.playBgm(); } catch (e: any) { /* ignore */ }
        }
    } else if (!active) {
        timeStopBgmPausedByBoardRenderer = false;
    }
    try {
        if (document.documentElement && document.documentElement.classList) {
            document.documentElement.classList.toggle('time-stop-active', active);
        }
        if (document.body && document.body.classList) {
            document.body.classList.toggle('time-stop-active', active);
        }
    } catch (e: any) {
        // UI only
    }
}

function applyTimeStopLegalEmphasis(cell: any, active: any) {
    if (!cell || !cell.classList) return;
    const shouldEmphasize = !!active && (
        cell.classList.contains('legal') ||
        cell.classList.contains('legal-free') ||
        cell.classList.contains('selectable-friendly')
    );
    cell.classList.toggle('time-stop-legal-emphasis', shouldEmphasize);
}

const collectPendingSelectedTargetHighlightKeys = (pending: any) => {
    const projectionModule = _getBoardHintProjectionForBoardRenderer();
    if (projectionModule && typeof projectionModule.collectPendingSelectedTargetHighlightKeys === 'function') {
        return projectionModule.collectPendingSelectedTargetHighlightKeys(pending);
    }
    return new Set();
};

const collectRandomSpawnPreviewHighlightKeys = (cardStateValue: any, gameStateValue: any, playerKey: any, options?: any) => {
    const projectionModule = _getBoardHintProjectionForBoardRenderer();
    if (projectionModule && typeof projectionModule.collectRandomSpawnPreviewHighlightKeys === 'function') {
        return projectionModule.collectRandomSpawnPreviewHighlightKeys({
            cardState: cardStateValue,
            gameState: gameStateValue,
            playerKey,
            cardLogic: (typeof CardLogic !== 'undefined' ? CardLogic : null)
        }, options && options.pending, options);
    }
    return new Set();
};

const BOARD_SHRINK_GOD_DIRECTION_HINT_CLASS = 'board-shrink-god-direction-hint';
const BOARD_SHRINK_GOD_DIRECTION_HINT_TARGET_CLASS = 'board-shrink-god-direction-target';
const BOARD_SHRINK_GOD_DIRECTION_HINT_DIRECTION_CLASSES = [
    'board-shrink-god-direction-up',
    'board-shrink-god-direction-down',
    'board-shrink-god-direction-left',
    'board-shrink-god-direction-right'
];
const BOARD_SHRINK_WILL_DIRECTION_HINT_CLASS = 'board-shrink-will-direction-hint';
const BOARD_SHRINK_WILL_DIRECTION_HINT_TARGET_CLASS = 'board-shrink-will-direction-target';
const BOARD_SHRINK_WILL_DIRECTION_HINT_DIRECTION_CLASSES = [
    'board-shrink-will-direction-up',
    'board-shrink-will-direction-down',
    'board-shrink-will-direction-left',
    'board-shrink-will-direction-right'
];
const BOARD_EXPANSION_DIRECTION_HINT_CLASS = 'board-expansion-direction-hint';
const BOARD_EXPANSION_DIRECTION_HINT_TARGET_CLASS = 'board-expansion-direction-target';
const BOARD_EXPANSION_DIRECTION_HINT_DIRECTION_CLASSES = [
    'board-expansion-direction-up',
    'board-expansion-direction-down',
    'board-expansion-direction-left',
    'board-expansion-direction-right',
    'board-expansion-direction-up-left',
    'board-expansion-direction-up-right',
    'board-expansion-direction-down-left',
    'board-expansion-direction-down-right'
];

function _getBoardDirectionHintArrowText(direction: any) {
    return direction === 'up'
        ? '↑'
        : direction === 'down'
            ? '↓'
            : direction === 'left'
                ? '←'
                : direction === 'up-left'
                    ? '↖'
                    : direction === 'up-right'
                        ? '↗'
                        : direction === 'down-left'
                            ? '↙'
                            : direction === 'down-right'
                                ? '↘'
                                : '→';
}

function _clearBoardShrinkGodDirectionHintForBoard(cell: any) {
    if (!cell || !cell.classList) return;
    cell.classList.remove(BOARD_SHRINK_GOD_DIRECTION_HINT_TARGET_CLASS, ...BOARD_SHRINK_GOD_DIRECTION_HINT_DIRECTION_CLASSES);
    if (cell.dataset) {
        delete cell.dataset.boardShrinkGodDirectionHint;
    }
    const hint = typeof cell.querySelector === 'function'
        ? cell.querySelector(`.${BOARD_SHRINK_GOD_DIRECTION_HINT_CLASS}`)
        : null;
    if (hint && hint.parentNode === cell) {
        hint.parentNode.removeChild(hint);
    }
}

function _clearBoardShrinkWillDirectionHintForBoard(cell: any) {
    if (!cell || !cell.classList) return;
    cell.classList.remove(BOARD_SHRINK_WILL_DIRECTION_HINT_TARGET_CLASS, ...BOARD_SHRINK_WILL_DIRECTION_HINT_DIRECTION_CLASSES);
    if (cell.dataset) {
        delete cell.dataset.boardShrinkWillDirectionHint;
    }
    const hint = typeof cell.querySelector === 'function'
        ? cell.querySelector(`.${BOARD_SHRINK_WILL_DIRECTION_HINT_CLASS}`)
        : null;
    if (hint && hint.parentNode === cell) {
        hint.parentNode.removeChild(hint);
    }
}

function _clearBoardExpansionDirectionHintForBoard(cell: any) {
    if (!cell || !cell.classList) return;
    cell.classList.remove(BOARD_EXPANSION_DIRECTION_HINT_TARGET_CLASS, ...BOARD_EXPANSION_DIRECTION_HINT_DIRECTION_CLASSES);
    if (cell.dataset) {
        delete cell.dataset.boardExpansionDirectionHint;
    }
    const hint = typeof cell.querySelector === 'function'
        ? cell.querySelector(`.${BOARD_EXPANSION_DIRECTION_HINT_CLASS}`)
        : null;
    if (hint && hint.parentNode === cell) {
        hint.parentNode.removeChild(hint);
    }
}

function _ensureBoardShrinkGodDirectionHintForBoard(cell: any, direction: any) {
    if (!cell || !cell.classList) return;
    const arrowText = _getBoardDirectionHintArrowText(direction);
    cell.classList.add(BOARD_SHRINK_GOD_DIRECTION_HINT_TARGET_CLASS, `board-shrink-god-direction-${direction}`);
    if (cell.dataset) {
        cell.dataset.boardShrinkGodDirectionHint = direction;
    }
    let hint = typeof cell.querySelector === 'function'
        ? cell.querySelector(`.${BOARD_SHRINK_GOD_DIRECTION_HINT_CLASS}`)
        : null;
    if (!hint && typeof document !== 'undefined') {
        hint = document.createElement('div');
        hint.className = BOARD_SHRINK_GOD_DIRECTION_HINT_CLASS;
        hint.setAttribute('aria-hidden', 'true');
        cell.appendChild(hint);
    }
    if (!hint) return;
    hint.textContent = arrowText;
    if (hint.dataset) {
        hint.dataset.direction = direction;
    }
    hint.style.position = 'absolute';
    hint.style.top = '50%';
    hint.style.left = '50%';
    hint.style.transform = 'translate(-50%, -50%)';
    hint.style.display = 'flex';
    hint.style.alignItems = 'center';
    hint.style.justifyContent = 'center';
    hint.style.width = 'calc(24px * var(--layout-stage-scale))';
    hint.style.height = 'calc(24px * var(--layout-stage-scale))';
    hint.style.borderRadius = '999px';
    hint.style.border = 'var(--layout-size-border-thin) solid rgba(218, 246, 255, 0.78)';
    hint.style.background = 'linear-gradient(180deg, rgba(16, 68, 76, 0.94) 0%, rgba(8, 29, 34, 0.92) 100%)';
    hint.style.boxShadow = '0 0 calc(8px * var(--layout-stage-scale)) rgba(122, 244, 255, 0.35)';
    hint.style.color = '#f7fdff';
    hint.style.fontFamily = '"DotGothic16", "MS Gothic", "Osaka-Mono", monospace';
    hint.style.fontSize = 'calc(15px * var(--layout-stage-scale))';
    hint.style.fontWeight = '700';
    hint.style.lineHeight = '1';
    hint.style.textShadow = '0 0 calc(3px * var(--layout-stage-scale)) rgba(255, 255, 255, 0.28)';
    hint.style.pointerEvents = 'none';
    hint.style.userSelect = 'none';
    hint.style.zIndex = '48';
}

function _ensureBoardShrinkWillDirectionHintForBoard(cell: any, direction: any) {
    if (!cell || !cell.classList) return;
    const arrowText = _getBoardDirectionHintArrowText(direction);
    cell.classList.add(BOARD_SHRINK_WILL_DIRECTION_HINT_TARGET_CLASS, `board-shrink-will-direction-${direction}`);
    if (cell.dataset) {
        cell.dataset.boardShrinkWillDirectionHint = direction;
    }
    let hint = typeof cell.querySelector === 'function'
        ? cell.querySelector(`.${BOARD_SHRINK_WILL_DIRECTION_HINT_CLASS}`)
        : null;
    if (!hint && typeof document !== 'undefined') {
        hint = document.createElement('div');
        hint.className = BOARD_SHRINK_WILL_DIRECTION_HINT_CLASS;
        hint.setAttribute('aria-hidden', 'true');
        cell.appendChild(hint);
    }
    if (!hint) return;
    hint.textContent = arrowText;
    if (hint.dataset) {
        hint.dataset.direction = direction;
    }
    hint.style.position = 'absolute';
    hint.style.top = '50%';
    hint.style.left = '50%';
    hint.style.transform = 'translate(-50%, -50%)';
    hint.style.display = 'flex';
    hint.style.alignItems = 'center';
    hint.style.justifyContent = 'center';
    hint.style.width = 'calc(24px * var(--layout-stage-scale))';
    hint.style.height = 'calc(24px * var(--layout-stage-scale))';
    hint.style.borderRadius = '999px';
    hint.style.border = 'var(--layout-size-border-thin) solid rgba(218, 246, 255, 0.78)';
    hint.style.background = 'linear-gradient(180deg, rgba(45, 29, 76, 0.94) 0%, rgba(21, 12, 38, 0.92) 100%)';
    hint.style.boxShadow = '0 0 calc(8px * var(--layout-stage-scale)) rgba(202, 139, 255, 0.36)';
    hint.style.color = '#fdf8ff';
    hint.style.fontFamily = '"DotGothic16", "MS Gothic", "Osaka-Mono", monospace';
    hint.style.fontSize = 'calc(15px * var(--layout-stage-scale))';
    hint.style.fontWeight = '700';
    hint.style.lineHeight = '1';
    hint.style.textShadow = '0 0 calc(3px * var(--layout-stage-scale)) rgba(255, 255, 255, 0.28)';
    hint.style.pointerEvents = 'none';
    hint.style.userSelect = 'none';
    hint.style.zIndex = '48';
}

function _ensureBoardExpansionDirectionHintForBoard(cell: any, direction: any) {
    if (!cell || !cell.classList) return;
    const arrowText = _getBoardDirectionHintArrowText(direction);
    cell.classList.add(BOARD_EXPANSION_DIRECTION_HINT_TARGET_CLASS, `board-expansion-direction-${direction}`);
    if (cell.dataset) {
        cell.dataset.boardExpansionDirectionHint = direction;
    }
    let hint = typeof cell.querySelector === 'function'
        ? cell.querySelector(`.${BOARD_EXPANSION_DIRECTION_HINT_CLASS}`)
        : null;
    if (!hint && typeof document !== 'undefined') {
        hint = document.createElement('div');
        hint.className = BOARD_EXPANSION_DIRECTION_HINT_CLASS;
        hint.setAttribute('aria-hidden', 'true');
        cell.appendChild(hint);
    }
    if (!hint) return;
    hint.textContent = arrowText;
    if (hint.dataset) {
        hint.dataset.direction = direction;
    }
    hint.style.position = 'absolute';
    hint.style.top = '50%';
    hint.style.left = '50%';
    hint.style.transform = 'translate(-50%, -50%)';
    hint.style.display = 'flex';
    hint.style.alignItems = 'center';
    hint.style.justifyContent = 'center';
    hint.style.width = 'calc(24px * var(--layout-stage-scale))';
    hint.style.height = 'calc(24px * var(--layout-stage-scale))';
    hint.style.borderRadius = '999px';
    hint.style.border = 'var(--layout-size-border-thin) solid rgba(218, 246, 255, 0.78)';
    hint.style.background = 'linear-gradient(180deg, rgba(16, 76, 65, 0.94) 0%, rgba(8, 34, 29, 0.92) 100%)';
    hint.style.boxShadow = '0 0 calc(8px * var(--layout-stage-scale)) rgba(116, 255, 228, 0.35)';
    hint.style.color = '#f7fffc';
    hint.style.fontFamily = '"DotGothic16", "MS Gothic", "Osaka-Mono", monospace';
    hint.style.fontSize = 'calc(15px * var(--layout-stage-scale))';
    hint.style.fontWeight = '700';
    hint.style.lineHeight = '1';
    hint.style.textShadow = '0 0 calc(3px * var(--layout-stage-scale)) rgba(255, 255, 255, 0.28)';
    hint.style.pointerEvents = 'none';
    hint.style.userSelect = 'none';
    hint.style.zIndex = '48';
}

function _syncBoardShrinkGodDirectionHintsForBoard(boardEl: any, hintProjection: any) {
    if (!boardEl || typeof boardEl.querySelectorAll !== 'function') return;
    const projection = hintProjection && typeof hintProjection === 'object' ? hintProjection : {};
    const hintMap = projection.boardShrinkGodDirectionHintMap instanceof Map
        ? projection.boardShrinkGodDirectionHintMap
        : new Map();
    const willHintMap = projection.boardShrinkWillDirectionHintMap instanceof Map
        ? projection.boardShrinkWillDirectionHintMap
        : new Map();
    const expansionHintMap = projection.boardExpansionDirectionHintMap instanceof Map
        ? projection.boardExpansionDirectionHintMap
        : new Map();
    const cells = boardEl.querySelectorAll('.cell');
    cells.forEach((cell: any) => {
        const row = Number(cell && cell.dataset ? cell.dataset.row : NaN);
        const col = Number(cell && cell.dataset ? cell.dataset.col : NaN);
        const key = Number.isInteger(row) && Number.isInteger(col) ? `${row},${col}` : null;
        if (!key || !hintMap.has(key)) {
            _clearBoardShrinkGodDirectionHintForBoard(cell);
        } else {
            _ensureBoardShrinkGodDirectionHintForBoard(cell, hintMap.get(key));
        }
        if (!key || !willHintMap.has(key)) {
            _clearBoardShrinkWillDirectionHintForBoard(cell);
        } else {
            _ensureBoardShrinkWillDirectionHintForBoard(cell, willHintMap.get(key));
        }
        if (!key || !expansionHintMap.has(key)) {
            _clearBoardExpansionDirectionHintForBoard(cell);
        } else {
            _ensureBoardExpansionDirectionHintForBoard(cell, expansionHintMap.get(key));
        }
    });
}

function renderBoard() {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('renderBoard');
    try {
        _syncTimeStopClassForBoardRenderer();
        // Single Visual Writer: skip renders while playback is active or already queued.
        if (_shouldSkipBoardRenderForPlayback()) {
            return;
        }
        // Determine whether we are in a "target selection" card mode.
    // In selection mode, normal "placeable move" hints must not appear.
    try {
        const renderState = _resolveBoardRenderStateForBoardRenderer();
        const renderGameState = renderState.gameState;
        const renderCardState = renderState.cardState;
        const player = renderGameState.currentPlayer;
        const playerKey = getPlayerKey(player);
        const pending = renderCardState && renderCardState.pendingEffectByPlayer ? renderCardState.pendingEffectByPlayer[playerKey] : null;
        const selectableTargets = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(renderCardState, renderGameState, playerKey)
            : [];
        const isSelectingTarget = !!(
            pending &&
            pending.stage === 'selectTarget' &&
            Array.isArray(selectableTargets) &&
            selectableTargets.length > 0
        );
        if (boardEl) boardEl.classList.toggle('selection-mode', isSelectingTarget);
    } catch (e: any) {
        // UI only
    }
    syncBoardPixelSizing(boardEl);

    // Use differential rendering if available
    if (typeof renderBoardDiff === 'function') {
        renderBoardDiff(boardEl);
    } else {
        // diff-renderer is required; avoid legacy full render path
        console.error('[Board Renderer] diff-renderer.js not loaded; rendering skipped');
        return;
    }
    updateOccupancyUI();
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('renderBoard');
    }
}

/**
 * フォールバック：全セル再描画
 * Fallback: Full board re-render (legacy method)
 */
function _isBoardHiddenTrapForBoardRenderer(marker: any) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // Hidden traps stay visually normal for both seats until reveal timing events.
    return true;
}

function _isFlipEvadeSpecialTypeForBoard(type: any) {
    const typeUpper = String(type || '').toUpperCase();
    return (
        typeUpper === 'HYPERACTIVE' ||
        typeUpper === 'EXTREME_HYPERACTIVE' ||
        typeUpper === 'ESCAPE_HYPERACTIVE' ||
        typeUpper === 'ULTIMATE_HYPERACTIVE' ||
        typeUpper === 'WILL_HUNTER_KING' ||
        typeUpper === 'AFTERIMAGE_WILL'
    );
}

function _isDestroyEvadeSpecialTypeForBoard(type: any) {
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'WILL_HUNTER_KING' || typeUpper === 'ULTIMATE_HYPERACTIVE' || typeUpper === 'EXTREME_HYPERACTIVE' || typeUpper === 'AFTERIMAGE_WILL';
}

function _resolveDestroyEvadeDisplayForBoard(special: any) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsDestroyEvade = _isDestroyEvadeSpecialTypeForBoard(specialTypeUpper);
    return (special && specialSupportsDestroyEvade && Number.isFinite(Number(special.destroyEvadeRemaining)))
        ? Math.max(0, Math.trunc(Number(special.destroyEvadeRemaining)))
        : null;
}

function _resolveSpecialDisplayTurnsForBoard(data: any) {
    if (String(data && data.type ? data.type : '').toUpperCase() === 'REGEN') return undefined;
    const primary = Number(data && data.remainingOwnerTurns);
    if (Number.isFinite(primary)) return Math.max(0, Math.trunc(primary));
    return undefined;
}

function _isBombCategoryMarkerForBoard(marker: any) {
    if (!marker || typeof marker !== 'object') return false;
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
        return MarkersAdapter.isBombCategoryMarker(marker);
    }
    const data = (marker.data && typeof marker.data === 'object') ? marker.data : null;
    const category = String(data && data.category ? data.category : '').trim().toLowerCase();
    const type = String(data && data.type ? data.type : '').trim().toUpperCase();
    return marker.kind === 'bomb' || category === 'bomb' || type === 'TIME_BOMB';
}

function _applyDoubleDigitTimerClassForBoard(timerElement: any, rawValue: any) {
    if (!timerElement) return;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return;
    if (Math.abs(Math.trunc(numericValue)) >= 10) {
        timerElement.classList.add('timer-double-digit');
    }
}

function _resolveNetworkLocalPlayerKeyForBoard() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
        }
    } catch (e: any) { /* ignore */ }
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
    } catch (e: any) { /* ignore */ }
    return 'black';
}

function _canLocalPlayerControlCurrentTurnForBoard(gameStateValue?: any, cardStateValue?: any) {
    const renderGameState = gameStateValue || _resolveBoardRenderStateForBoardRenderer().gameState;
    const renderCardState = cardStateValue || _resolveBoardRenderStateForBoardRenderer().cardState;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveNetworkInputPermissions === 'function') {
            return OwnerHelpersModule.resolveNetworkInputPermissions({
                rootRef: typeof window !== 'undefined' ? window : null,
                cardState: renderCardState,
                gameState: renderGameState,
                currentPlayer: renderGameState && renderGameState.currentPlayer,
                localPlayerKey: _resolveNetworkLocalPlayerKeyForBoard(),
                debugHumanVsHuman: typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN === true
            }).canOperateBoard === true;
        }
    } catch (e: any) { /* fallback to legacy local checks */ }
    let isNetworkMode = false;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            isNetworkMode = OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null);
        } else {
            let matchMode: any = null;
            try {
                matchMode = (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
                    ? window.getCurrentMatchMode()
                    : (typeof window !== 'undefined' ? window.MATCH_MODE : null);
            } catch (e: any) { /* ignore */ }
            isNetworkMode = matchMode === 'network';
        }
    } catch (e: any) { /* ignore */ }
    const currentPlayerKey = renderGameState.currentPlayer === WHITE ? 'white' : 'black';
    const isHvH = !!(typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN === true);
    // FATE_WILL: if another player controls this turn, only the controller can operate.
    // Applies in network mode and in local non-HvH mode.
    if (isNetworkMode || !isHvH) {
        const cs = renderCardState || null;
        const fwc = cs && cs.fateWillControllerByTurnOwner;
        const controller = fwc && fwc[currentPlayerKey];
        if (controller) {
            const localPlayerKey = _resolveNetworkLocalPlayerKeyForBoard();
            return controller === localPlayerKey;
        }
    }
    if (!isNetworkMode) return true;
    const localPlayerKey = _resolveNetworkLocalPlayerKeyForBoard();
    return currentPlayerKey === localPlayerKey;
}

function _resolveBoardFullRenderDelegate() {
    try {
        if (typeof forceFullRender === 'function') return forceFullRender;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof window.forceFullRender === 'function') return window.forceFullRender;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveBoardDiffRenderDelegate() {
    try {
        if (typeof renderBoardDiff === 'function') return renderBoardDiff;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof window.renderBoardDiff === 'function') return window.renderBoardDiff;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveBoardDiffResetDelegate() {
    try {
        const diffRendererModule = _require('./diff-renderer');
        if (diffRendererModule && typeof diffRendererModule.resetRenderStats === 'function') {
            return diffRendererModule.resetRenderStats;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof window.resetRenderStats === 'function') return window.resetRenderStats;
    } catch (e: any) { /* ignore */ }
    return null;
}

function renderBoardFull() {
    _syncTimeStopClassForBoardRenderer();
    // Single Visual Writer: skip renders while playback is active or already queued.
    if (_shouldSkipBoardRenderForPlayback()) {
        return;
    }
    const fullRender = _resolveBoardFullRenderDelegate();
    if (typeof fullRender === 'function') {
        fullRender(boardEl);
        return;
    }
    const diffRender = _resolveBoardDiffRenderDelegate();
    if (typeof diffRender === 'function') {
        const resetDiffRender = _resolveBoardDiffResetDelegate();
        if (typeof resetDiffRender === 'function') {
            resetDiffRender();
        }
        diffRender(boardEl);
        return;
    }
    renderBoardFullLegacy();
}

function renderBoardFullLegacy() {
    _syncTimeStopClassForBoardRenderer();
    // Single Visual Writer: skip renders while playback is active or already queued.
    if (_shouldSkipBoardRenderForPlayback()) {
        return;
    }
    const renderState = _resolveBoardRenderStateForBoardRenderer();
    const gameState = renderState.gameState;
    const cardState = renderState.cardState;
    boardEl.innerHTML = '';
    const player = gameState.currentPlayer;
    const context = CardLogic.getCardContext(cardState);
    const playerKey = getPlayerKey(player);
    const pending = cardState.pendingEffectByPlayer[playerKey];
    const isTabooReversePending = !!(pending && pending.type === 'TABOO_REVERSE_WILL');
    const timeStopActive = _isTimeStopActiveForBoardRenderer();
    const freePlacementActive = !!(pending && (
        (typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.isFreePlacementPendingType === 'function' &&
            CardLogic.isFreePlacementPendingType(pending.type)) ||
        pending.type === 'FREE_PLACEMENT' ||
        pending.type === 'SNIPER_WILL' ||
        pending.type === 'LAST_RESORT'
    ));
    const boardShape = _applyBoardCssVarsForBoardRenderer(boardEl);
    const isNetworkMode = !!(OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function'
        ? OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null)
        : ((typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
            ? window.getCurrentMatchMode() === 'network'
            : ((typeof window !== 'undefined' ? window.MATCH_MODE : null) === 'network')));
    // FATE_WILL: show legal hints and allow interaction during the controlled (victim's) turn.
    const isFateWillControlledTurn = !!(cardState && cardState.fateWillControllerByTurnOwner && cardState.fateWillControllerByTurnOwner[playerKey]);
    const canControlCurrentTurn = _canLocalPlayerControlCurrentTurnForBoard(gameState, cardState);
    const isHumanTurn = isNetworkMode
        ? canControlCurrentTurn
        : ((gameState.currentPlayer === BLACK) ||
            (window.DEBUG_HUMAN_VS_HUMAN && gameState.currentPlayer === WHITE) ||
            isFateWillControlledTurn);
    const hintProjection = _buildBoardHintProjectionForBoardRenderer(
        gameState,
        cardState,
        playerKey,
        boardShape,
        canControlCurrentTurn,
        isHumanTurn
    ) || {};
    const selectableTargets = Array.isArray(hintProjection.selectableTargets) ? hintProjection.selectableTargets : [];
    const selectableTargetSet = hintProjection.selectableTargetSet instanceof Set ? hintProjection.selectableTargetSet : new Set();
    const isSelectingTarget = hintProjection.isSelectingTarget === true;
    if (boardEl) boardEl.classList.toggle('selection-mode', isSelectingTarget);
    const randomSpawnPreviewSet = hintProjection.randomSpawnPreviewSet instanceof Set ? hintProjection.randomSpawnPreviewSet : new Set();
    const showLegalHints = hintProjection.showLegalHints === true;
    const selectedTargetHighlightSet = hintProjection.selectedTargetHighlightSet instanceof Set ? hintProjection.selectedTargetHighlightSet : new Set();
    const boardShrinkGodPreviewHighlightSet = hintProjection.boardShrinkGodPreviewHighlightSet instanceof Set ? hintProjection.boardShrinkGodPreviewHighlightSet : new Set();
    const legalSet = hintProjection.legalSet instanceof Set ? hintProjection.legalSet : new Set();
    const tabooLegalSet = hintProjection.tabooLegalSet instanceof Set ? hintProjection.tabooLegalSet : new Set();

    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', MANIFEST_STONE: 'manifestStone', BOMB: 'bomb' };
    const specialMarkerKind = markerKinds.SPECIAL_STONE || 'specialStone';
    const manifestMarkerKind = markerKinds.MANIFEST_STONE || 'manifestStone';
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const specialMap = new Map();
    const guardMap = new Map();
    const livingWillMap = new Map();
    const manifestAuraMap = new Map();
    const bombMap = new Map();
    const sproutMap = new Map();
    for (const m of markers) {
        if (_isBombCategoryMarkerForBoard(m) && m.data) {
            bombMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                remainingTurns: m.data.remainingTurns,
                owner: m.owner
            });
            continue;
        }
        if ((m.kind === specialMarkerKind || m.kind === manifestMarkerKind) && m.data && m.data.type) {
            if (_isBoardHiddenTrapForBoardRenderer(m)) continue;
            if (_isActiveManifestAuraMarkerForBoard(m, manifestMarkerKind, specialMarkerKind)) {
                manifestAuraMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner
                });
            }
            if (m.data.type === 'GUARD') {
                guardMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            if (m.data.type === 'LIVING_WILL') {
                livingWillMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner
                });
                continue;
            }
            const markerTypeUpper = String(m.data.type || '').toUpperCase();
            const isManifestType = _isManifestStoneTypeForBoardRenderer(markerTypeUpper);
            const isManifestKind = m.kind === manifestMarkerKind || m.kind === 'manifestStone';
            if (isManifestType && !isManifestKind) {
                continue;
            }
            specialMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: isManifestType
                    ? m.data.remainingOwnerTurns
                    : _resolveSpecialDisplayTurnsForBoard(m.data),
                regenRemaining: (!isManifestType && markerTypeUpper === 'REGEN' && Number.isFinite(Number(m.data.regenRemaining)))
                    ? Math.max(0, Math.trunc(Number(m.data.regenRemaining)))
                    : null,
                destroyEvadeRemaining: (!isManifestType && _isDestroyEvadeSpecialTypeForBoard(markerTypeUpper))
                    ? (
                        Number.isFinite(Number(m.data.destroyEvadeRemaining))
                            ? Math.max(0, Math.trunc(Number(m.data.destroyEvadeRemaining)))
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 2 : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? 5 : null))
                    )
                    : null,
                flipEvadeRemaining: (!isManifestType && _isFlipEvadeSpecialTypeForBoard(markerTypeUpper))
                    ? (
                        Number.isFinite(Number(m.data.flipEvadeRemaining))
                            ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                            : (markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ? 5 : (markerTypeUpper === 'EXTREME_HYPERACTIVE' ? 5 : null))
                    )
                    : 0
            });
        }
    }
    try {
        const sproutByOwner = (cardState && cardState.breedingSproutByOwner && typeof cardState.breedingSproutByOwner === 'object')
            ? cardState.breedingSproutByOwner
            : { black: [], white: [] };
        const addSprout = (ownerKey: any, positions: any) => {
            const ownerVal = ownerKey === 'black' ? BLACK : WHITE;
            if (!Array.isArray(positions)) return;
            for (const p of positions) {
                if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col)) continue;
                if (p.row < 0 || p.row >= boardShape.rows || p.col < 0 || p.col >= boardShape.cols) continue;
                if (gameState.board[p.row][p.col] !== ownerVal) continue;
                sproutMap.set(`${p.row},${p.col}`, true);
            }
        };
        addSprout('black', sproutByOwner.black);
        addSprout('white', sproutByOwner.white);
    } catch (e: any) { /* ignore */ }

    // Helper for effect key mapping: delegate to canonical visual-effects map.
    const getEffectKeyForType = (type: any) => {
        if (typeof getEffectKeyForSpecialType === 'function') return getEffectKeyForSpecialType(type);
        try {
            if (typeof SPECIAL_TYPE_TO_EFFECT_KEY !== 'undefined' && SPECIAL_TYPE_TO_EFFECT_KEY) {
                return SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
            }
        } catch (e: any) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window.SPECIAL_TYPE_TO_EFFECT_KEY) {
                return window.SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
            }
        } catch (e: any) { /* ignore */ }
        return null;
    };

    // Helper to normalize owner
    const getOwnerVal = (owner: any) => {
        if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
        return WHITE;
    };

    for (let r = 0; r < boardShape.rows; r++) {
        for (let c = 0; c < boardShape.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = String(r);
            cell.dataset.col = String(c);

            // Human turn gets legal move hints (Black always, White in HvH)
            const key = r + ',' + c;
            const isSelectedTargetHighlighted = selectedTargetHighlightSet.has(key);
            const isRandomSpawnPreview = randomSpawnPreviewSet.has(key);
            if (showLegalHints && gameState.board[r][c] === EMPTY) {
                if (freePlacementActive) {
                    cell.classList.add('legal-free');
                } else if (legalSet.has(key)) {
                    cell.classList.add('legal');
                }
                if (tabooLegalSet.has(key)) {
                    cell.classList.add('effect-target-highlight-positive');
                }
            }
            if (isSelectedTargetHighlighted) {
                cell.classList.add('effect-target-highlight-positive');
            }
            if (isRandomSpawnPreview) {
                cell.classList.add('random-spawn-preview');
            }
            if (isHumanTurn && (selectableTargetSet.has(key) || boardShrinkGodPreviewHighlightSet.has(key))) {
                cell.classList.add('selectable-friendly');
            }
            applyTimeStopLegalEmphasis(cell, timeStopActive);

            const val = gameState.board[r][c];
            if (val !== EMPTY) {
                cell.classList.add('has-disc');
                const disc = document.createElement('div');
                disc.className = 'disc ' + (val === BLACK ? 'black' : 'white');
                ensureDiscSkeleton(disc);
                setDiscStoneImage(disc, val);
                const discHud = getDiscHudRoot(disc);

                // Unified special stone visual effect
                const special = specialMap.get(key);
                const livingWill = livingWillMap.get(key);
                const manifestAura = manifestAuraMap.get(key);
                const destroyEvadeDisplay = _resolveDestroyEvadeDisplayForBoard(special);
                const specialCanShowFlipEvade = !!(
                    special &&
                    _isFlipEvadeSpecialTypeForBoard(special.type) &&
                    Number.isFinite(Number(special.flipEvadeRemaining))
                );
                const specialCanShowDestroyEvade = !!(
                    special &&
                    _isDestroyEvadeSpecialTypeForBoard(special.type) &&
                    Number.isFinite(Number(destroyEvadeDisplay))
                );
                const specialCanShowRegenBadge = !!(
                    special &&
                    String(special.type || '').toUpperCase() === 'REGEN' &&
                    Number.isFinite(Number(special.regenRemaining))
                );
                if (specialCanShowRegenBadge) {
                    cell.classList.add('has-regen-badge');
                }
                const specialFlipEvade = specialCanShowFlipEvade
                    ? Math.max(0, Math.trunc(Number(special.flipEvadeRemaining)))
                    : null;
                if (special) {
                    const effectKey = getEffectKeyForType(special.type);
                    if (effectKey) {
                        applyStoneVisualEffect(disc, effectKey, { owner: getOwnerVal(special.owner) });
                    }
                    // Robust fallback: ensure reveal-only trap image is visible if visual-map lookup/DI fails.
                    if (special.type === 'TRAP_REVEAL' && typeof applyTrapStoneFallbackVisual === 'function') {
                        applyTrapStoneFallbackVisual(disc, getOwnerVal(special.owner));
                    }

                    // Ensure WORK visuals are applied even if mapping returns null
                    if (special.type === 'WORK') {
                        applyStoneVisualEffect(disc, 'workStone', { owner: getOwnerVal(special.owner) });
                    }

                    // Add timer for effects with remaining turns
                    const displayTurns = _resolveSpecialDisplayTurnsForBoard({
                        type: special.type,
                        remainingOwnerTurns: special.remainingOwnerTurns,
                        regenRemaining: special.regenRemaining
                    });
                    if (displayTurns !== undefined) {
                        const timer = document.createElement('div');
                        timer.className = _resolveSpecialTimerClassForBoard(special.type);
                        const remaining = Math.max(0, Math.trunc(Number(displayTurns)));
                        timer.textContent = String(remaining);
                        _applyDoubleDigitTimerClassForBoard(timer, remaining);
                        discHud.appendChild(timer);
                    }

                    if (specialCanShowRegenBadge) {
                        const regenBadge = document.createElement('div');
                        regenBadge.className = 'stone-regen-badge';
                        const regenRemaining = Math.max(0, Math.trunc(Number(special.regenRemaining)));
                        regenBadge.setAttribute('data-count', String(regenRemaining));
                        const regenValue = document.createElement('span');
                        regenValue.className = 'stone-regen-badge-value';
                        regenValue.textContent = String(regenRemaining);
                        regenBadge.appendChild(regenValue);
                        _applyDoubleDigitTimerClassForBoard(regenBadge, regenRemaining);
                        discHud.appendChild(regenBadge);
                    }

                    if (specialCanShowFlipEvade && Number.isFinite(specialFlipEvade)) {
                        const evadeTimer = document.createElement('div');
                        evadeTimer.className = 'stone-timer flip-evade-timer';
                        const evadeRemaining = Math.max(0, Math.trunc(Number(specialFlipEvade)));
                        evadeTimer.textContent = String(evadeRemaining);
                        _applyDoubleDigitTimerClassForBoard(evadeTimer, evadeRemaining);
                        discHud.appendChild(evadeTimer);
                    }

                    if (specialCanShowDestroyEvade) {
                        const destroyEvadeTimer = document.createElement('div');
                        destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
                        const destroyEvadeRemaining = Math.max(0, Math.trunc(Number(destroyEvadeDisplay)));
                        destroyEvadeTimer.textContent = String(destroyEvadeRemaining);
                        _applyDoubleDigitTimerClassForBoard(destroyEvadeTimer, destroyEvadeRemaining);
                        discHud.appendChild(destroyEvadeTimer);
                    }
                }

                if (livingWill) {
                    disc.classList.add('living-will-aura');
                }

                if (manifestAura) {
                    disc.classList.add('manifest-stone-aura', `manifest-stone-aura-${_getManifestAuraOwnerClassForBoard(manifestAura.owner)}`);
                }

                // 爆弾チェック
                const bomb = bombMap.get(key);
                if (bomb) {
                    const bombOwner = getOwnerVal(bomb.owner);
                    if (typeof applyStoneVisualEffect === 'function') {
                        applyStoneVisualEffect(disc, 'timeBombStone', { owner: bombOwner });
                    }
                    disc.classList.add('bomb', 'special-stone', bombOwner === BLACK ? 'bomb-black' : 'bomb-white');
                    const timeLabel = document.createElement('div');
                    timeLabel.className = 'bomb-timer countdown-timer';
                    const bombRemaining = Math.max(0, Math.trunc(Number(bomb.remainingTurns)));
                    timeLabel.textContent = String(bombRemaining);
                    _applyDoubleDigitTimerClassForBoard(timeLabel, bombRemaining);
                    discHud.appendChild(timeLabel);
                }

                const guardData = guardMap.get(key);
                if (guardData && typeof guardData.remainingOwnerTurns === 'number') {
                    const guardTimer = document.createElement('div');
                    guardTimer.className = 'guard-timer';
                    const guardRemaining = Math.max(0, Math.trunc(guardData.remainingOwnerTurns));
                    guardTimer.textContent = String(guardRemaining);
                    _applyDoubleDigitTimerClassForBoard(guardTimer, guardRemaining);
                    discHud.appendChild(guardTimer);
                }

                if (sproutMap.has(key)) {
                    disc.classList.add('breeding-sprout');
                    const sproutIcon = document.createElement('div');
                    sproutIcon.className = 'breeding-sprout-icon';
                    discHud.appendChild(sproutIcon);
                }

                cell.appendChild(disc);
            }

            if (typeof attachBoardCellInteraction === 'function') {
                attachBoardCellInteraction(cell, r, c);
            } else {
                cell.addEventListener('click', () => handleCellClick(r, c));
            }
            boardEl.appendChild(cell);
        }
    }
    _syncBoardShrinkGodDirectionHintsForBoard(boardEl, hintProjection);
}

// NOTE:
// Animation helpers (destroy/fade-out) are intentionally defined in `ui/animation-utils.js`.
// Keeping a second copy here risks load-order bugs (different class names / CSS wiring).

function updateOccupancyUI() {
    const renderState = _resolveBoardRenderStateForBoardRenderer();
    const counts = countDiscs(renderState.gameState);
    const total = counts.black + counts.white;

    let blackPct = 50, whitePct = 50;
    if (total > 0) {
        blackPct = Math.round((counts.black / total) * 100);
        whitePct = 100 - blackPct;
    }

    const blackEl = document.getElementById('occ-black');
    const whiteEl = document.getElementById('occ-white');

    if (blackEl) blackEl.innerHTML = `<div class="occ-dot"></div>黒 ${blackPct}%`;
    if (whiteEl) whiteEl.innerHTML = `<div class="occ-dot"></div>白 ${whitePct}%`;
}

function _findDirectDiscChildByClass(disc: any, className: any) {
    if (!disc || !disc.children) return null;
    for (const child of disc.children) {
        if (child && child.classList && child.classList.contains(className)) return child;
    }
    return null;
}

function _resolveDiscOwnerDescriptor(owner: any) {
    const blackValue = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const whiteValue = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const normalized = (owner === whiteValue || owner === -1 || owner === 'white' || owner === '-1')
        ? 'white'
        : 'black';
    return normalized === 'white'
        ? {
            key: 'white',
            value: whiteValue,
            className: 'white',
            baseImage: 'var(--normal-stone-white-image)',
            fallbackColor: '#ffffff'
        }
        : {
            key: 'black',
            value: blackValue,
            className: 'black',
            baseImage: 'var(--normal-stone-black-image)',
            fallbackColor: '#050505'
        };
}

function _areStoneBaseImagesReady() {
    try {
        return !!(
            typeof document !== 'undefined' &&
            document &&
            document.documentElement &&
            document.documentElement.classList &&
            document.documentElement.classList.contains('stone-base-images-ready')
        );
    } catch (e: any) {
        return false;
    }
}

function _resolveDiscImageState(renderState: any, baseImage: any) {
    if (renderState && typeof renderState.imageState === 'string' && renderState.imageState) {
        return renderState.imageState;
    }
    const hasBaseImage = typeof baseImage === 'string' && baseImage.trim() && baseImage !== 'none';
    return (hasBaseImage && _areStoneBaseImagesReady()) ? 'loaded' : 'fallback';
}

function ensureDiscSkeleton(disc: any) {
    if (!disc || typeof document === 'undefined' || typeof disc.appendChild !== 'function') {
        return { face: null, base: null, overlay: null, hud: null };
    }

    let face = _findDirectDiscChildByClass(disc, 'disc__face');
    let hud = _findDirectDiscChildByClass(disc, 'disc__hud');

    if (!face) {
        face = document.createElement('div');
        face.className = 'disc__face';
        if (disc.firstChild) disc.insertBefore(face, disc.firstChild);
        else disc.appendChild(face);
    }
    if (!hud) {
        hud = document.createElement('div');
        hud.className = 'disc__hud';
        disc.appendChild(hud);
    }

    let base = _findDirectDiscChildByClass(face, 'disc__base-image');
    if (!base) {
        base = document.createElement('div');
        base.className = 'disc__base-image';
        face.appendChild(base);
    }

    let overlay = _findDirectDiscChildByClass(face, 'disc__overlay-image');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'disc__overlay-image';
        face.appendChild(overlay);
    }

    const childrenToMove = [];
    for (const child of Array.from(disc.childNodes)) {
        if (child === face || child === hud) continue;
        childrenToMove.push(child);
    }
    for (const child of childrenToMove) {
        hud.appendChild(child);
    }

    return { face, base, overlay, hud };
}

function getDiscHudRoot(disc: any) {
    const skeleton = ensureDiscSkeleton(disc);
    return (skeleton && skeleton.hud) ? skeleton.hud : disc;
}

function applyDiscRenderState(disc: any, renderState: any = {}) {
    if (!disc || !disc.style || typeof disc.style.setProperty !== 'function') return;

    const blackValue = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const whiteValue = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const owner = (renderState.owner !== undefined && renderState.owner !== null)
        ? renderState.owner
        : (disc.classList && disc.classList.contains('white') ? whiteValue : blackValue);
    const ownerDescriptor = _resolveDiscOwnerDescriptor(owner);
    const requestedRenderMode = renderState.renderMode || 'base-only';
    const baseImage = renderState.baseImage || ownerDescriptor.baseImage;
    const overlayImage = renderState.overlayImage || null;
    const overlayScale = Number(renderState.scale);
    const imageState = _resolveDiscImageState(renderState, baseImage);
    const renderMode = ((requestedRenderMode === 'replace' || requestedRenderMode === 'overlay') && !overlayImage)
        ? 'base-only'
        : requestedRenderMode;
    const fallbackColor = imageState === 'fallback'
        ? (
            Object.prototype.hasOwnProperty.call(renderState, 'baseFallbackColor')
                ? renderState.baseFallbackColor
                : ownerDescriptor.fallbackColor
        )
        : 'transparent';

    ensureDiscSkeleton(disc);

    try { disc.dataset.renderMode = renderMode; } catch (e: any) { /* ignore */ }
    try { disc.dataset.effect = renderState.effectKey || 'normal'; } catch (e: any) { /* ignore */ }
    try { disc.dataset.imageState = imageState; } catch (e: any) { /* ignore */ }
    try { disc.style.setProperty('--disc-base-image', baseImage); } catch (e: any) { /* ignore */ }
    try { disc.style.setProperty('--stone-image', baseImage); } catch (e: any) { /* ignore */ }
    try { disc.style.setProperty('--disc-base-fallback-color', fallbackColor || 'transparent'); } catch (e: any) { /* ignore */ }
    try { disc.style.removeProperty('--disc-base-color'); } catch (e: any) { /* ignore */ }

    if (overlayImage) {
        try { disc.style.setProperty('--disc-overlay-image', overlayImage); } catch (e: any) { /* ignore */ }
        try { disc.style.setProperty('--special-stone-image', overlayImage); } catch (e: any) { /* ignore */ }
    } else {
        try { disc.style.removeProperty('--disc-overlay-image'); } catch (e: any) { /* ignore */ }
        try { disc.style.removeProperty('--special-stone-image'); } catch (e: any) { /* ignore */ }
    }

    if (Number.isFinite(overlayScale) && overlayScale > 0 && overlayScale !== 1) {
        try { disc.style.setProperty('--disc-overlay-scale', String(overlayScale)); } catch (e: any) { /* ignore */ }
    } else {
        try { disc.style.removeProperty('--disc-overlay-scale'); } catch (e: any) { /* ignore */ }
    }
}

// Expose in CommonJS for tests and in browser globals for legacy callers
function setDiscStoneImage(disc: any, val: any) {
    applyDiscRenderState(disc, {
        owner: val,
        renderMode: 'base-only',
        effectKey: 'normal'
    });
}

// Expose in CommonJS for tests and in browser globals for legacy callers
const BoardRenderer = {
            renderBoard,
            renderBoardFull,
            updateOccupancyUI,
            applyTimeStopLegalEmphasis,
            collectPendingSelectedTargetHighlightKeys,
            collectRandomSpawnPreviewHighlightKeys,
            ensureDiscSkeleton,
            getDiscHudRoot,
            applyDiscRenderState,
            setDiscStoneImage,
            syncBoardPixelSizing,
            syncBoardExpansionLayerGeometry,
            resolveBoardExpansionLayerElement
        };
if (
    BoardRendererStoneHelpersRegistryModule &&
    typeof BoardRendererStoneHelpersRegistryModule.setBoardRendererStoneHelpers === 'function'
) {
    BoardRendererStoneHelpersRegistryModule.setBoardRendererStoneHelpers(BoardRenderer);
}
export = BoardRenderer;
if (typeof window !== 'undefined') {
    // Prefer board-renderer as the canonical renderBoard implementation.
    window.renderBoard = renderBoard;
    window.updateOccupancyUI = window.updateOccupancyUI || updateOccupancyUI;
    window.collectPendingSelectedTargetHighlightKeys = window.collectPendingSelectedTargetHighlightKeys || collectPendingSelectedTargetHighlightKeys;
    window.collectRandomSpawnPreviewHighlightKeys = window.collectRandomSpawnPreviewHighlightKeys || collectRandomSpawnPreviewHighlightKeys;
    window.ensureDiscSkeleton = window.ensureDiscSkeleton || ensureDiscSkeleton;
    window.getDiscHudRoot = window.getDiscHudRoot || getDiscHudRoot;
    window.applyDiscRenderState = window.applyDiscRenderState || applyDiscRenderState;
    window.setDiscStoneImage = window.setDiscStoneImage || setDiscStoneImage;
    window.syncBoardPixelSizing = window.syncBoardPixelSizing || syncBoardPixelSizing;
    window.syncBoardExpansionLayerGeometry = window.syncBoardExpansionLayerGeometry || syncBoardExpansionLayerGeometry;
    window.resolveBoardExpansionLayerElement = window.resolveBoardExpansionLayerElement || resolveBoardExpansionLayerElement;
}
