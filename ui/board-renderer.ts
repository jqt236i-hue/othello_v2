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

var WorldStatePresenterModule: any = null;
var BoardWorldStatePresenter: any = null;
if (typeof require === 'function') {
    try {
        WorldStatePresenterModule = require('./presentation/world-state-presenter');
        BoardWorldStatePresenter = WorldStatePresenterModule.createWorldStatePresenter();
    } catch (e: any) { /* ignore */ }
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
    const store = _resolveNetworkVisualStateStoreForBoardRenderer();
    try {
        const snapshot = store && typeof store.peekRenderSnapshot === 'function'
            ? store.peekRenderSnapshot()
            : (store && typeof store.getRenderSnapshot === 'function' ? store.getRenderSnapshot() : null);
        if (snapshot && snapshot.gameState && snapshot.cardState) {
            return {
                gameState: snapshot.gameState,
                cardState: snapshot.cardState,
                source: 'network_visual_state'
            };
        }
    } catch (e: any) { /* ignore */ }
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
const _boardElementIdentityToken = new WeakMap<any, number>();
const _frameElementIdentityToken = new WeakMap<any, number>();
let _nextBoardElementIdentity = 1;
let _nextFrameElementIdentity = 1;
const _boardPixelSizingShapeByElement = new WeakMap<any, any>();
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
    if (!engine || engine.allowBgmPlay !== true) return false;
    if (engine.bgm && engine.bgm.paused !== true) return true;
    return !!(engine._manifestBgm && engine._manifestBgm.paused !== true);
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
        const normalizedRows = Math.max(1, Math.trunc(rows));
        const normalizedCols = Math.max(1, Math.trunc(cols));
        const baseRowsValue = Number(shapeOrState && shapeOrState.baseRows);
        const baseColsValue = Number(shapeOrState && shapeOrState.baseCols);
        const minRowValue = Number(shapeOrState && shapeOrState.minRow);
        const minColValue = Number(shapeOrState && shapeOrState.minCol);
        const baseRows = Number.isFinite(baseRowsValue) ? Math.max(1, Math.trunc(baseRowsValue)) : normalizedRows;
        const baseCols = Number.isFinite(baseColsValue) ? Math.max(1, Math.trunc(baseColsValue)) : normalizedCols;
        const minRow = Number.isFinite(minRowValue) ? Math.trunc(minRowValue) : 0;
        const minCol = Number.isFinite(minColValue) ? Math.trunc(minColValue) : 0;
        return {
            rows: normalizedRows,
            cols: normalizedCols,
            baseRows,
            baseCols,
            minRow,
            minCol,
            maxRow: minRow + normalizedRows - 1,
            maxCol: minCol + normalizedCols - 1
        };
    }
    const fallbackShape = _getBoardShapeForBoardRenderer();
    return {
        rows: fallbackShape.rows,
        cols: fallbackShape.cols,
        baseRows: fallbackShape.rows,
        baseCols: fallbackShape.cols,
        minRow: 0,
        minCol: 0,
        maxRow: fallbackShape.rows - 1,
        maxCol: fallbackShape.cols - 1
    };
}

function _clearBoardPixelSizingVars(boardElement: any) {
    if (boardElement && boardElement.style) {
        boardElement.style.removeProperty('width');
        boardElement.style.removeProperty('height');
        boardElement.style.removeProperty('left');
        boardElement.style.removeProperty('top');
        boardElement.style.removeProperty('transform');
        boardElement.style.removeProperty('--board-cell-size-px');
        boardElement.style.removeProperty('--board-cell-scale');
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

// PR2 v2: sizing signature. All entries are stable across normal renders and
// change only at the boundaries where _boardPixelSizingDirty is forced true:
//   1-2: shape rows/cols
//   3-6: base shape and world-coordinate origin
//   7-8: boardEl / frameEl WeakMap identity tokens
//   9-10: root data-board-skin-id / data-board-frame-skin-id (skin switch)
//   11: --layout-stage-scale (inline root style, layout profile scale)
//   12-15: --board-frame-padding-{top,right,bottom,left} (frame skin switch)
//   16: window.devicePixelRatio (DPR shift)
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
        shape.baseRows,
        shape.baseCols,
        shape.minRow,
        shape.minCol,
        _getBoardElementIdentityToken(boardElement),
        _getFrameElementIdentityToken(frameEl),
        boardSkinId,
        frameSkinId,
        layoutScale,
        padTop, padRight, padBottom, padLeft,
        dpr
    ].join('|');
}

function _getBoardAnchorOffsetForPixelSizing(shape: any, cellSize: number) {
    const baseRows = Number.isFinite(shape && shape.baseRows) ? shape.baseRows : shape.rows;
    const baseCols = Number.isFinite(shape && shape.baseCols) ? shape.baseCols : shape.cols;
    const minRow = Number.isFinite(shape && shape.minRow) ? shape.minRow : 0;
    const minCol = Number.isFinite(shape && shape.minCol) ? shape.minCol : 0;
    const maxRow = Number.isFinite(shape && shape.maxRow) ? shape.maxRow : (minRow + shape.rows - 1);
    const maxCol = Number.isFinite(shape && shape.maxCol) ? shape.maxCol : (minCol + shape.cols - 1);
    const topGrowth = Math.max(0, -minRow);
    const leftGrowth = Math.max(0, -minCol);
    const bottomGrowth = Math.max(0, maxRow - (baseRows - 1));
    const rightGrowth = Math.max(0, maxCol - (baseCols - 1));
    return {
        x: ((rightGrowth - leftGrowth) * cellSize) / 2,
        y: ((bottomGrowth - topGrowth) * cellSize) / 2
    };
}

function _measureBoardPixelSizing(boardElement: any, shape: any) {
    const baseSize = _getBoardBaseSizeForPixelSizing(boardElement);
    if (!baseSize || !(baseSize.width > 0) || !(baseSize.height > 0)) return null;
    const measuredCellSize = Math.max(1, Math.floor(Math.min(baseSize.width / shape.cols, baseSize.height / shape.rows)));
    const baselineCellSize = Math.max(0, Number(baseSize.baselineCellSize) || 0);
    const baseRows = Number.isFinite(shape.baseRows) ? shape.baseRows : shape.rows;
    const baseCols = Number.isFinite(shape.baseCols) ? shape.baseCols : shape.cols;
    const baseMaxGrid = Math.max(baseRows, baseCols);
    const initialBoardScale = baseMaxGrid > STANDARD_BOARD_BASELINE_ROWS
        ? STANDARD_BOARD_BASELINE_ROWS / baseMaxGrid
        : 1;
    const scaledBaselineCellSize = baselineCellSize > 0
        ? Math.max(1, Math.floor(baselineCellSize * initialBoardScale))
        : measuredCellSize;
    const cellSize = baseMaxGrid > STANDARD_BOARD_BASELINE_ROWS
        ? scaledBaselineCellSize
        : Math.max(1, Math.max(measuredCellSize, baselineCellSize));
    return cellSize > 0 ? { baseSize, baselineCellSize, cellSize } : null;
}

function _handleBoardPixelSizingViewportChange() {
    if (!boardPixelSizingObservedElement) return;
    // PR2 (N3 dirty gate): window/frame resize must always re-sync even when
    // the (shape, frame) signature is unchanged.
    _boardPixelSizingDirty = true;
    try {
        const root: any = typeof window !== 'undefined' ? window : globalThis;
        const scheduler = root && root.RenderScheduler;
        if (scheduler && typeof scheduler.requestBoardRender === 'function') {
            scheduler.requestBoardRender({ source: 'board-pixel-sizing', reason: 'viewport-change' });
            return;
        }
    } catch (e: any) { /* fall through to controller render */ }
    renderBoard();
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
        const rememberedShape = boardElement && _boardPixelSizingShapeByElement.get(boardElement);
        const shape = _normalizeBoardShapeForPixelSizing(shapeInput || rememberedShape);
    if (!boardElement || !boardElement.style) return shape;
    if (shapeInput) _boardPixelSizingShapeByElement.set(boardElement, shape);

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
    const measurement = _measureBoardPixelSizing(boardElement, shape);
    if (!measurement) {
        _clearBoardPixelSizingVars(boardElement);
        return shape;
    }
    const { baseSize, baselineCellSize, cellSize } = measurement;

    const discInset = Math.max(1, Math.round(cellSize * 0.0505));
    const discSize = Math.max(1, cellSize - (discInset * 2));
    const contentWidth = cellSize * shape.cols;
    const contentHeight = cellSize * shape.rows;
    const outerWidth = contentWidth + (boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderX : 0);
    const outerHeight = contentHeight + (boxMetrics.boxSizing === 'border-box' ? boxMetrics.borderY : 0);
    boardElement.style.width = `${outerWidth}px`;
    boardElement.style.height = `${outerHeight}px`;
    boardElement.style.setProperty('--board-cell-size-px', `${cellSize}px`);
    boardElement.style.setProperty('--board-cell-scale', baselineCellSize > 0 ? String(cellSize / baselineCellSize) : '1');
    boardElement.style.setProperty('--board-disc-inset-px', `${discInset}px`);
    boardElement.style.setProperty('--board-disc-size-px', `${discSize}px`);
    _applyBoardFramePixelSizing(baseSize.frameMetrics, outerWidth, outerHeight, shape);

    const anchorOffset = _getBoardAnchorOffsetForPixelSizing(shape, cellSize);
    boardElement.style.left = anchorOffset.x ? `${anchorOffset.x}px` : '';
    boardElement.style.top = anchorOffset.y ? `${anchorOffset.y}px` : '';
    boardElement.style.removeProperty('transform');
    if (typeof boardElement.getBoundingClientRect === 'function') {
        const snappedRect = boardElement.getBoundingClientRect();
        const snapX = Number.isFinite(snappedRect.left) ? (Math.round(snappedRect.left) - snappedRect.left) : 0;
        const snapY = Number.isFinite(snappedRect.top) ? (Math.round(snappedRect.top) - snappedRect.top) : 0;
        if (Math.abs(snapX) > 0.001 || Math.abs(snapY) > 0.001) {
            // Keep the board aligned to whole pixels without compositing the full board via transform.
            boardElement.style.left = `${anchorOffset.x + snapX}px`;
            boardElement.style.top = `${anchorOffset.y + snapY}px`;
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
    if (!BoardWorldStatePresenter && WorldStatePresenterModule) {
        BoardWorldStatePresenter = WorldStatePresenterModule.createWorldStatePresenter();
    }
    if (BoardWorldStatePresenter && typeof BoardWorldStatePresenter.presentTimeStop === 'function') {
        BoardWorldStatePresenter.presentTimeStop({
            active,
            document,
            soundEngine,
            isBgmPlaying: _isBgmPlayingForBoardRenderer
        });
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

function prepareBoardVisualUpdate() {
    _syncTimeStopClassForBoardRenderer();
    const controller = getBoardVisualController();
    if (!controller) return null;
    const playbackDeferred = _shouldSkipBoardRenderForPlayback();
    if (playbackDeferred && controller.getMode() === 'idle') {
        AutoBoardWriterTokenForBoardRenderer = controller.claimWriter(
            `legacy-playback:${BoardVisualRevisionForBoardRenderer + 1}`,
            'local'
        );
    }
    const prepared = Object.freeze({
        controller,
        playbackDeferred,
        frame: _buildBoardVisualFrameForBoardRenderer(controller)
    });
    PreparedBoardVisualUpdatesForBoardRenderer.add(prepared);
    return prepared;
}

function renderBoard(preparedVisualUpdate?: any) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('renderBoard');
    try {
        const prepared = preparedVisualUpdate
            && PreparedBoardVisualUpdatesForBoardRenderer.has(preparedVisualUpdate)
            ? preparedVisualUpdate
            : prepareBoardVisualUpdate();
        if (prepared) PreparedBoardVisualUpdatesForBoardRenderer.delete(prepared);
        const controller = prepared && prepared.controller;
        if (!controller) {
            console.error('[Board Renderer] board visual controller unavailable; rendering skipped');
            return;
        }
        const playbackDeferred = prepared.playbackDeferred === true;
        const applied = controller.submitFrame(prepared.frame);
        if (!playbackDeferred && AutoBoardWriterTokenForBoardRenderer) {
            const token = AutoBoardWriterTokenForBoardRenderer;
            controller.releaseWriter(token);
            AutoBoardWriterTokenForBoardRenderer = null;
        }
        if (applied === true || (!playbackDeferred && controller.getMode() === 'idle')) updateOccupancyUI();
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('renderBoard');
    }
}

let BoardVisualRuntimeForBoardRenderer: any = null;
let AutoBoardWriterTokenForBoardRenderer: any = null;
let BoardVisualRevisionForBoardRenderer = 0;
const PreparedBoardVisualUpdatesForBoardRenderer = new WeakSet<object>();

function _isBoardVisualDiagnosticsEnabledForBoardRenderer() {
    try {
        if (typeof window !== 'undefined' && ((window as any).__BOARD_VISUAL_TEST__ === true || (window as any).__DEV__ === true)) return true;
        if (typeof location !== 'undefined') return /(?:^|[?&])debug=1(?:&|$)/.test(String(location.search || ''));
    } catch (e: any) { /* ignore */ }
    return false;
}

function _resolveBoardElementForVisualRuntime() {
    try { if (typeof boardEl !== 'undefined' && boardEl) return boardEl; } catch (e: any) { /* ignore */ }
    try { return typeof document !== 'undefined' ? document.getElementById('board') : null; } catch (e: any) { return null; }
}

function _createBoardVisualRuntimeForBoardRenderer() {
    const host = _resolveBoardElementForVisualRuntime();
    if (!host) return null;
    const ControllerModule = _require('./board-visual/controller');
    const DomBackendModule = _require('./board-visual/dom-backend');
    const DiagnosticsModule = _require('./board-visual/diagnostics');
    const diagnostics = DiagnosticsModule.createBoardVisualDiagnostics({
        enabled: _isBoardVisualDiagnosticsEnabledForBoardRenderer()
    });
    const backend = DomBackendModule.createDomBoardVisualBackend({
        beforeApplyFrame(activeHost: any, frame: any) {
            const topology = frame && frame.model && frame.model.topology || {};
            syncBoardPixelSizing(activeHost, {
                rows: topology.renderRows,
                cols: topology.renderCols,
                baseRows: topology.baseRows,
                baseCols: topology.baseCols,
                minRow: topology.minRow,
                minCol: topology.minCol
            });
        }
    });
    const controller = ControllerModule.createBoardVisualController({ backend, diagnostics });
    const mountPromise = Promise.resolve(controller.mount(host));
    mountPromise.catch((error: any) => {
        diagnostics.record('controller:mount-error', { message: String(error && error.message || error || '') });
    });
    if (controller.ready && typeof controller.ready.catch === 'function') {
        controller.ready.catch(() => { /* readiness is observed through the runtime promise */ });
    }
    const runtime = { controller, diagnostics, host, ready: controller.ready || mountPromise };
    if (diagnostics.enabled === true) {
        const root = typeof window !== 'undefined' ? window : globalThis;
        DiagnosticsModule.installBoardVisualDebugContract(root, diagnostics, controller);
    }
    return runtime;
}

function getBoardVisualController() {
    if (!BoardVisualRuntimeForBoardRenderer) {
        BoardVisualRuntimeForBoardRenderer = _createBoardVisualRuntimeForBoardRenderer();
    }
    return BoardVisualRuntimeForBoardRenderer ? BoardVisualRuntimeForBoardRenderer.controller : null;
}

function configureBoardVisualController(controller: any, options?: any) {
    if (!controller || typeof controller.submitFrame !== 'function') {
        throw new Error('configureBoardVisualController requires a controller');
    }
    const previousRuntime = BoardVisualRuntimeForBoardRenderer;
    if (
        previousRuntime
        && previousRuntime.controller
        && previousRuntime.controller !== controller
        && typeof previousRuntime.controller.destroy === 'function'
    ) {
        previousRuntime.controller.destroy();
    }
    const diagnostics = options && options.diagnostics || null;
    const host = options && options.host || _resolveBoardElementForVisualRuntime();
    BoardVisualRuntimeForBoardRenderer = {
        controller,
        diagnostics,
        host,
        ready: controller.ready || Promise.resolve()
    };
    if (diagnostics && diagnostics.enabled === true) {
        const DiagnosticsModule = _require('./board-visual/diagnostics');
        const root = typeof window !== 'undefined' ? window : globalThis;
        DiagnosticsModule.installBoardVisualDebugContract(root, diagnostics, controller);
    }
    AutoBoardWriterTokenForBoardRenderer = null;
    return controller;
}

function getBoardVisualControllerReady() {
    const controller = getBoardVisualController();
    if (!controller) return Promise.reject(new Error('Board visual controller is unavailable'));
    if (typeof controller.waitUntilReady === 'function') return controller.waitUntilReady();
    return controller.ready || Promise.resolve();
}

function claimBoardVisualWriter(frameToken: string, mode: 'local' | 'network' = 'local') {
    const controller = getBoardVisualController();
    if (!controller) throw new Error('Board visual controller is unavailable');
    if (AutoBoardWriterTokenForBoardRenderer) {
        const adopted = controller.reclaimWriter(AutoBoardWriterTokenForBoardRenderer, frameToken, mode);
        AutoBoardWriterTokenForBoardRenderer = null;
        return adopted;
    }
    return controller.claimWriter(frameToken, mode);
}

function releaseBoardVisualWriter(token: any, finalFrame?: any) {
    const controller = getBoardVisualController();
    if (!controller) throw new Error('Board visual controller is unavailable');
    return controller.releaseWriter(token, finalFrame);
}

async function playBoardVisualPhase(token: any, events: readonly unknown[], phaseScope?: any) {
    const controller = getBoardVisualController();
    if (!controller || typeof controller.playPhase !== 'function') {
        throw new Error('Board visual controller cannot play a presentation phase');
    }
    return controller.playPhase(token, events, phaseScope);
}

function getBoardCellClientRect(row: number, col: number) {
    const controller = getBoardVisualController();
    if (!controller || typeof controller.getCellClientRect !== 'function') return null;
    return controller.getCellClientRect(row, col);
}

async function abortBoardVisualWriterBeforeHandoff(token: any, checkpoint?: any) {
    const controller = getBoardVisualController();
    if (!controller || typeof controller.abortWriterBeforeHandoff !== 'function') {
        throw new Error('Board visual controller cannot abort a writer before handoff');
    }
    return controller.abortWriterBeforeHandoff(token, checkpoint);
}

async function cancelBoardVisualWriterAfterHandoff(token: any, checkpoint?: any) {
    const controller = getBoardVisualController();
    if (!controller || typeof controller.cancelWriterAfterHandoff !== 'function') {
        throw new Error('Board visual controller cannot cancel a writer after handoff');
    }
    if (typeof controller.getActiveWriterToken !== 'function' || controller.getActiveWriterToken() !== token) {
        throw new Error('Board visual cancel token does not own the active frame');
    }
    return controller.cancelWriterAfterHandoff(token, checkpoint);
}

async function settleBoardVisualWriter(token: any) {
    const controller = getBoardVisualController();
    if (!controller) throw new Error('Board visual controller is unavailable');
    if (controller.getMode && controller.getMode() === 'recovering') {
        await controller.restore();
    } else {
        renderBoard();
    }
    return controller.releaseWriter(token);
}

function beginBoardVisualFrameCommit(token: any) {
    const controller = getBoardVisualController();
    if (!controller) throw new Error('Board visual controller is unavailable');
    return controller.beginAwaitingFrameCommit(token);
}

async function applyCommittedBoardVisualFrame(token: any, receipt?: any) {
    const controller = getBoardVisualController();
    if (!controller) throw new Error('Board visual controller is unavailable');
    if (
        receipt
        && (
            receipt.kind !== 'network-visual-commit'
            || receipt.visualSeq !== Number(String(token && token.frameToken || '').split(':').pop())
        )
    ) {
        throw new Error('Committed board visual receipt does not match the writer token');
    }
    const store = _resolveNetworkVisualStateStoreForBoardRenderer();
    if (
        !receipt
        || !store
        || typeof store.isCurrentCommitReceipt !== 'function'
        || store.isCurrentCommitReceipt(receipt) !== true
        || typeof store.getSnapshotForReceipt !== 'function'
    ) {
        throw new Error('Committed board visual receipt is not current for the visual store');
    }
    const committedSnapshot = store.getSnapshotForReceipt(receipt);
    if (
        !committedSnapshot
        || !committedSnapshot.gameState
        || !committedSnapshot.cardState
    ) {
        throw new Error('Committed board visual receipt has no bound snapshot');
    }
    const frame = _buildBoardVisualFrameForBoardRenderer(controller, committedSnapshot);
    if (controller.getMode && controller.getMode() === 'recovering') {
        if (typeof controller.restoreCommittedFrame !== 'function') {
            throw new Error('Board visual controller cannot restore a committed frame');
        }
        return controller.restoreCommittedFrame(token, frame);
    }
    return controller.applyCommittedFrame(token, frame);
}

function enterBoardVisualRecovery(token: any, error?: unknown) {
    const controller = getBoardVisualController();
    if (!controller) throw new Error('Board visual controller is unavailable');
    if (typeof controller.getActiveWriterToken !== 'function' || controller.getActiveWriterToken() !== token) {
        throw new Error('Board visual recovery token does not own the active frame');
    }
    if (
        typeof controller.getActiveFrameToken !== 'function'
        || controller.getActiveFrameToken() !== String(token && token.frameToken || '')
    ) {
        throw new Error('Board visual recovery frame token does not match the active frame');
    }
    return controller.enterRecovery(token, error);
}

function settleAutoBoardVisualWriter() {
    if (!AutoBoardWriterTokenForBoardRenderer) return false;
    const controller = getBoardVisualController();
    if (!controller) return false;
    renderBoard();
    // renderBoard settles the synthetic token itself when playback has
    // already become idle. Only release here when the playback defer gate
    // intentionally kept the token active.
    if (!AutoBoardWriterTokenForBoardRenderer) {
        updateOccupancyUI();
        return true;
    }
    const token = AutoBoardWriterTokenForBoardRenderer;
    controller.releaseWriter(token);
    AutoBoardWriterTokenForBoardRenderer = null;
    updateOccupancyUI();
    return true;
}

function _readBoardCellSizeForLayout(host: any, topology?: any) {
    if (host && topology) {
        const shape = _normalizeBoardShapeForPixelSizing({
            rows: topology.renderRows,
            cols: topology.renderCols,
            baseRows: topology.baseRows,
            baseCols: topology.baseCols,
            minRow: topology.minRow,
            minCol: topology.minCol
        });
        const measurement = _measureBoardPixelSizing(host, shape);
        if (measurement && measurement.cellSize > 0) return measurement.cellSize;
    }
    try {
        const value = parseFloat(String(host && host.style && host.style.getPropertyValue('--board-cell-size-px') || ''));
        if (Number.isFinite(value) && value > 0) return value;
    } catch (e: any) { /* ignore */ }
    return 1;
}

function _readBoardFrameGeometryForLayout(host: any, appearance: any) {
    const fallbackRect = host && typeof host.getBoundingClientRect === 'function'
        ? host.getBoundingClientRect()
        : { left: 0, top: 0 };
    const frame = host && typeof host.closest === 'function' ? host.closest('#board-frame') : null;
    if (!frame || typeof frame.getBoundingClientRect !== 'function') {
        return {
            clientOrigin: { x: Number(fallbackRect.left) || 0, y: Number(fallbackRect.top) || 0 },
            frameInset: { top: 0, right: 0, bottom: 0, left: 0 }
        };
    }
    const frameRect = frame.getBoundingClientRect();
    let computed: any = null;
    try {
        computed = typeof window !== 'undefined' && typeof window.getComputedStyle === 'function'
            ? window.getComputedStyle(frame)
            : null;
    } catch (e: any) { computed = null; }
    let stageScale = 1;
    try {
        const rawScale = document && document.documentElement && document.documentElement.style
            ? document.documentElement.style.getPropertyValue('--layout-stage-scale')
            : '';
        const parsedScale = Number.parseFloat(String(rawScale || ''));
        if (Number.isFinite(parsedScale) && parsedScale > 0) stageScale = parsedScale;
    } catch (e: any) { /* use unit scale */ }
    const descriptor = appearance && appearance.boardFrameLayout || {};
    const inset = (cssField: string, descriptorField: string) => {
        const cssValue = Number.parseFloat(String(computed && computed[cssField] || ''));
        if (Number.isFinite(cssValue)) return cssValue;
        const descriptorValue = Number(descriptor[descriptorField]);
        return Number.isFinite(descriptorValue) ? descriptorValue * stageScale : 0;
    };
    return {
        clientOrigin: { x: Number(frameRect.left) || 0, y: Number(frameRect.top) || 0 },
        frameInset: {
            top: inset('paddingTop', 'paddingTop'),
            right: inset('paddingRight', 'paddingRight'),
            bottom: inset('paddingBottom', 'paddingBottom'),
            left: inset('paddingLeft', 'paddingLeft')
        }
    };
}

function _buildBoardVisualFrameForBoardRenderer(controller: any, baseVisualStateOverride?: any) {
    const DiffRendererModule = _require('./diff-renderer');
    const LayoutModule = _require('./board-visual/layout');
    const ThemeModule = _require('./board-visual/theme');
    const FramePresenterModule = _require('./board-visual/frame-presenter');
    const baseInputs = DiffRendererModule.createBoardRenderInputs(undefined, baseVisualStateOverride);
    const projection = DiffRendererModule.createBoardRenderProjection(undefined, baseInputs);
    const cellState = DiffRendererModule.buildCurrentCellState(projection, baseInputs);
    const presentationOverlayState = DiffRendererModule.createBoardPresentationOverlayState(
        projection,
        cellState,
        baseInputs.presentationOverlayState
    );
    const inputs = Object.freeze({
        baseVisualState: baseInputs.baseVisualState,
        presentationOverlayState
    });
    const visualRevision = ++BoardVisualRevisionForBoardRenderer;
    const model = DiffRendererModule.buildBoardRenderModel(projection, cellState, {
        visualRevision,
        overlay: inputs.presentationOverlayState,
        inputs
    });
    const host = _resolveBoardElementForVisualRuntime();
    const appearance = FramePresenterModule.resolveBoardAppearanceDescriptor(host, visualRevision);
    const frameGeometry = _readBoardFrameGeometryForLayout(host, appearance);
    const layoutCellSize = _readBoardCellSizeForLayout(host, model.topology);
    const viewport = typeof window !== 'undefined' ? (window as any).visualViewport : null;
    const layout = LayoutModule.createBoardViewportLayout(model.topology, {
        revision: visualRevision,
        cellSize: layoutCellSize,
        dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
        clientOrigin: frameGeometry.clientOrigin,
        frameInset: frameGeometry.frameInset,
        visualViewport: {
            scale: viewport && Number(viewport.scale) || 1,
            offsetLeft: viewport && Number(viewport.offsetLeft) || 0,
            offsetTop: viewport && Number(viewport.offsetTop) || 0
        },
        camera: {
            scrollLeft: host && Number(host.scrollLeft) || 0,
            scrollTop: host && Number(host.scrollTop) || 0,
            // The DOM compatibility host is the logical board surface. Its
            // live rect still describes the previous topology until the
            // controller-owned frame presenter applies this frame, so using
            // that rect here would incorrectly clip a shape change. The Pixi
            // viewport supplies its scroll viewport dimensions separately.
            viewportWidth: model.topology.renderCols * layoutCellSize,
            viewportHeight: model.topology.renderRows * layoutCellSize
        }
    });
    const frameToken = controller && controller.getActiveFrameToken()
        ? controller.getActiveFrameToken()
        : `idle:${visualRevision}`;
    return Object.freeze({
        model,
        layout,
        appearance,
        theme: ThemeModule.resolveBoardVisualThemeDescriptor(host, visualRevision),
        frameToken
    });
}

function renderBoardFull() {
    const controller = getBoardVisualController();
    if (controller && typeof controller.invalidate === 'function') controller.invalidate();
    return renderBoard();
}

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
            prepareBoardVisualUpdate,
            renderBoardFull,
            getBoardVisualController,
            getBoardVisualControllerReady,
            configureBoardVisualController,
            claimBoardVisualWriter,
            playBoardVisualPhase,
            getBoardCellClientRect,
            releaseBoardVisualWriter,
            abortBoardVisualWriterBeforeHandoff,
            cancelBoardVisualWriterAfterHandoff,
            settleBoardVisualWriter,
            beginBoardVisualFrameCommit,
            applyCommittedBoardVisualFrame,
            enterBoardVisualRecovery,
            settleAutoBoardVisualWriter,
            buildBoardVisualFrame: _buildBoardVisualFrameForBoardRenderer,
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
    (window as any).prepareBoardVisualUpdate = prepareBoardVisualUpdate;
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
