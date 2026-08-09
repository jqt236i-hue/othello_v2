
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;
import type { BoardRendererFacade } from './board-visual/runtime-ports';
import type { BoardVisualCommitReceipt } from './board-visual/types';

const RuntimeStateAccessModule = _require('./runtime-state-access');
const BoardDomLayoutGeometryModule = _require('./board-visual/dom-layout-geometry');
const BoardVisualRenderStateSourceModule = _require('./board-visual/render-state-source');
const BoardLayoutRuntimeModule = _require('./board-visual/layout-runtime');
const BoardInputRuntimeModule = _require('./board-visual/input-runtime');
const BoardBackendRuntimeModule = _require('./board-visual/backend-runtime');
const BoardFrameRuntimeModule = _require('./board-visual/frame-runtime');
const BoardWriterRuntimeModule = _require('./board-visual/writer-runtime');
const BoardRenderSubmissionRuntimeModule = _require('./board-visual/render-submission-runtime');
const DiscDomRendererModule = _require('./presentation/disc-dom-renderer');
const ensureDiscSkeleton = DiscDomRendererModule.ensureDiscSkeleton;
const getDiscHudRoot = DiscDomRendererModule.getDiscHudRoot;
const applyDiscRenderState = DiscDomRendererModule.applyDiscRenderState;
const setDiscStoneImage = DiscDomRendererModule.setDiscStoneImage;

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

/**
 * @file board-renderer.js
 * @description 盤面レンダリング（差分レンダリング対応版）
 * Board rendering with differential rendering support
 */

/**
 * 盤面を描画（差分レンダリング使用）
 * Render board using differential rendering for performance
 * 
 * DOM compatibility rendering is loaded lazily only when its backend is selected.
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

var BoardRendererBoardUtilsModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererBoardUtilsModule = require('../shared/shared-board-utils'); } catch (e: any) { /* ignore */ }
}
if (!BoardRendererBoardUtilsModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SharedBoardUtils) {
            BoardRendererBoardUtilsModule = (globalThis as any).SharedBoardUtils;
        }
    } catch (e: any) { /* ignore */ }
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
    return _getBoardVisualRenderStateSourceForBoardRenderer()
        .isStrictNetworkVisualRenderActive();
}

function _resolveGlobalGameStateForBoardRenderer() {
    return RuntimeStateAccessModule.resolveCurrentRuntimeObject('gameState', () => {
        try {
            return (typeof gameState !== 'undefined') ? gameState : null;
        } catch (e: any) {
            return null;
        }
    });
}

function _resolveGlobalCardStateForBoardRenderer() {
    return RuntimeStateAccessModule.resolveCurrentRuntimeObject('cardState', () => {
        try {
            return (typeof cardState !== 'undefined') ? cardState : null;
        } catch (e: any) {
            return null;
        }
    });
}

let BoardVisualRenderStateSourceForBoardRenderer: any = null;

function _getBoardVisualRenderStateSourceForBoardRenderer() {
    if (!BoardVisualRenderStateSourceForBoardRenderer) {
        BoardVisualRenderStateSourceForBoardRenderer = BoardVisualRenderStateSourceModule
            .createBoardVisualRenderStateSource({
                getVisualStore: _resolveNetworkVisualStateStoreForBoardRenderer,
                getPresentationTimeline: _resolveNetworkPresentationTimelineForBoardRenderer,
                getLocalPair: () => ({
                    gameState: _resolveGlobalGameStateForBoardRenderer(),
                    cardState: _resolveGlobalCardStateForBoardRenderer() || {}
                })
            });
    }
    return BoardVisualRenderStateSourceForBoardRenderer;
}

function _resolveBoardRenderStateForBoardRenderer() {
    return _getBoardVisualRenderStateSourceForBoardRenderer().resolvePair();
}

function _getBoardShapeForBoardRenderer() {
    const state = _resolveBoardRenderStateForBoardRenderer().gameState;
    if (!state) return { rows: 8, cols: 8 };
    if (!BoardRendererBoardUtilsModule || typeof BoardRendererBoardUtilsModule.resolveBoardConfig !== 'function') {
        throw new Error('SharedBoardUtils.resolveBoardConfig is required by board-renderer');
    }
    const config = BoardRendererBoardUtilsModule.resolveBoardConfig(state);
    return { rows: config.rows, cols: config.cols };
}

let BoardLayoutRuntimeForBoardRenderer: any = null;

function _requestBoardPixelSizingRenderForBoardRenderer() {
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

function _getBoardLayoutRuntimeForBoardRenderer() {
    if (!BoardLayoutRuntimeForBoardRenderer) {
        BoardLayoutRuntimeForBoardRenderer = BoardLayoutRuntimeModule.createBoardLayoutRuntime({
            resolveBoardShape: _getBoardShapeForBoardRenderer,
            requestRender: _requestBoardPixelSizingRenderForBoardRenderer,
            getPerfBenchmarks: () => PerfBenchmarks,
            domLayoutGeometry: BoardDomLayoutGeometryModule
        });
    }
    return BoardLayoutRuntimeForBoardRenderer;
}

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

function resolveBoardExpansionLayerElement(boardElement: any, createIfMissing?: any) {
    return _getBoardLayoutRuntimeForBoardRenderer()
        .resolveBoardExpansionLayerElement(boardElement, createIfMissing);
}

function syncBoardExpansionLayerGeometry(boardElement: any, shapeInput?: any) {
    return _getBoardLayoutRuntimeForBoardRenderer()
        .syncBoardExpansionLayerGeometry(boardElement, shapeInput);
}

function syncBoardPixelSizing(boardElement: any, shapeInput?: any) {
    return _getBoardLayoutRuntimeForBoardRenderer()
        .syncBoardPixelSizing(boardElement, shapeInput);
}

function _applyBoardCssVarsForBoardRenderer(boardElement: any) {
    return _getBoardLayoutRuntimeForBoardRenderer().applyBoardCssVars(boardElement);
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
    return _resolveGlobalCardStateForBoardRenderer();
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

let BoardWriterRuntimeForBoardRenderer: any = null;
let BoardRenderSubmissionRuntimeForBoardRenderer: any = null;

function _getBoardWriterRuntimeForBoardRenderer() {
    if (!BoardWriterRuntimeForBoardRenderer) {
        BoardWriterRuntimeForBoardRenderer = BoardWriterRuntimeModule.createBoardWriterRuntime({
            getController: getBoardVisualController,
            getNextFrameSerial: () => _getBoardFrameRuntimeForBoardRenderer().getNextFrameSerial(),
            shouldDeferRenderForPlayback: _shouldSkipBoardRenderForPlayback,
            renderBoard,
            buildFrame: _buildBoardVisualFrameForBoardRenderer,
            getRenderStateSource: _getBoardVisualRenderStateSourceForBoardRenderer,
            updateOccupancy: updateOccupancyUI
        });
    }
    return BoardWriterRuntimeForBoardRenderer;
}

function _getBoardRenderSubmissionRuntimeForBoardRenderer() {
    if (!BoardRenderSubmissionRuntimeForBoardRenderer) {
        BoardRenderSubmissionRuntimeForBoardRenderer =
            BoardRenderSubmissionRuntimeModule.createBoardRenderSubmissionRuntime({
                getController: getBoardVisualController,
                shouldDeferRenderForPlayback: _shouldSkipBoardRenderForPlayback,
                writerRuntime: _getBoardWriterRuntimeForBoardRenderer(),
                syncTimeStopClass: _syncTimeStopClassForBoardRenderer,
                buildFrame: _buildBoardVisualFrameForBoardRenderer,
                updateOccupancy: updateOccupancyUI,
                getPerfBenchmarks: () => PerfBenchmarks
            });
    }
    return BoardRenderSubmissionRuntimeForBoardRenderer;
}

function prepareBoardVisualUpdate() {
    return _getBoardRenderSubmissionRuntimeForBoardRenderer().prepareUpdate();
}

function renderBoard(preparedVisualUpdate?: any) {
    return _getBoardRenderSubmissionRuntimeForBoardRenderer().render(preparedVisualUpdate);
}

let BoardBackendRuntimeForBoardRenderer: any = null;
let BoardInputRuntimeForBoardRenderer: any = null;
let BoardFrameRuntimeForBoardRenderer: any = null;

function _getBoardFrameRuntimeForBoardRenderer() {
    if (!BoardFrameRuntimeForBoardRenderer) {
        BoardFrameRuntimeForBoardRenderer = BoardFrameRuntimeModule.createBoardFrameRuntime({
            getVisualRuntime: _getBoardVisualRuntimeForBoardRenderer,
            renderBoard,
            resolveSoundEngine: _resolveSoundEngineForBoardRenderer,
            getRenderStateSource: _getBoardVisualRenderStateSourceForBoardRenderer,
            getInputFrameInputs: () => _getBoardInputRuntimeForBoardRenderer().getFrameInputs(),
            resolveHost: _resolveBoardElementForVisualRuntime,
            getBoardUpdateSyncRuntime: _getBoardUpdateSyncRuntimeForBoardRenderer,
            peekBoardUpdateSyncContext: _peekBoardUpdateSyncContextForBoardRenderer,
            playbackState: PlaybackStateModule,
            layoutRuntime: _getBoardLayoutRuntimeForBoardRenderer()
        });
    }
    return BoardFrameRuntimeForBoardRenderer;
}

function _playPixiBoardExpansionRevealSoundForBoardRenderer(keys: readonly string[], frame: any) {
    return _getBoardFrameRuntimeForBoardRenderer().playTopologyRevealSound(keys, frame);
}

function _getBoardBackendRuntimeForBoardRenderer() {
    if (!BoardBackendRuntimeForBoardRenderer) {
        BoardBackendRuntimeForBoardRenderer = BoardBackendRuntimeModule.createBoardBackendRuntime({
            getRenderStateSource: _getBoardVisualRenderStateSourceForBoardRenderer,
            syncBoardPixelSizing,
            renderBoard,
            renderBoardFull,
            getInputController: getBoardInputController,
            applyTimeStopLegalEmphasis,
            resolveBoardExpansionLayerElement,
            playTopologyRevealSound: _playPixiBoardExpansionRevealSoundForBoardRenderer,
            beginApplyFrame: _beginBoardVisualApplyTransactionForBoardRenderer,
            resolveHost: _resolveBoardElementForVisualRuntime,
            subscribeSettledFrame: _subscribeSettledBoardInputForBoardRenderer,
            beforeControllerReplace() {
                _getBoardInputRuntimeForBoardRenderer().replaceController();
                _disposeBoardVisualThemeFontObserverForBoardRenderer();
            },
            installHostResources: _installBoardVisualThemeFontObserverForBoardRenderer,
            afterControllerReplace() {
                _getBoardWriterRuntimeForBoardRenderer().replaceController();
            }
        });
    }
    return BoardBackendRuntimeForBoardRenderer;
}

function _getBoardVisualRuntimeForBoardRenderer() {
    return _getBoardBackendRuntimeForBoardRenderer().getRuntime();
}

function configureBoardVisualBackendForTest(options?: any) {
    return _getBoardBackendRuntimeForBoardRenderer().configureForTest(options);
}

function _resolveBoardElementForVisualRuntime() {
    try { if (typeof boardEl !== 'undefined' && boardEl) return boardEl; } catch (e: any) { /* ignore */ }
    try { return typeof document !== 'undefined' ? document.getElementById('board') : null; } catch (e: any) { return null; }
}

function _getBoardInputRuntimeForBoardRenderer() {
    if (!BoardInputRuntimeForBoardRenderer) {
        BoardInputRuntimeForBoardRenderer = BoardInputRuntimeModule.createBoardInputRuntime({
            getVisualRuntime: _getBoardVisualRuntimeForBoardRenderer,
            renderBoard,
            getRenderStateSource: _getBoardVisualRenderStateSourceForBoardRenderer,
            resolveBoardElement: _resolveBoardElementForVisualRuntime,
            handleCellClick: (row: number, col: number, directionKey?: string) => {
                if (typeof handleCellClick !== 'function') throw new Error('handleCellClick is unavailable');
                return handleCellClick(row, col, directionKey);
            }
        });
    }
    return BoardInputRuntimeForBoardRenderer;
}

function setBoardPresentationPreviewHints(previewHints: unknown, options?: any): boolean {
    return _getBoardInputRuntimeForBoardRenderer().setPreviewHints(previewHints, options);
}

function getBoardInputController() {
    return _getBoardInputRuntimeForBoardRenderer().getController();
}

function activateBoardInputController(options?: { isInputLocked?: () => boolean }) {
    return _getBoardInputRuntimeForBoardRenderer().activate(options);
}

function deactivateBoardInputController() {
    return _getBoardInputRuntimeForBoardRenderer().deactivate();
}

function _subscribeSettledBoardInputForBoardRenderer(controller: any) {
    return _getBoardInputRuntimeForBoardRenderer().subscribeSettledFrame(controller);
}

function _disposeBoardVisualThemeFontObserverForBoardRenderer() {
    return _getBoardFrameRuntimeForBoardRenderer().disposeHostResources();
}

function _installBoardVisualThemeFontObserverForBoardRenderer(host: HTMLElement | null) {
    return _getBoardFrameRuntimeForBoardRenderer().installHostResources(host);
}

function getBoardVisualController() {
    return _getBoardBackendRuntimeForBoardRenderer().getController();
}

function configureBoardVisualController(controller: any, options?: any) {
    return _getBoardBackendRuntimeForBoardRenderer().configureController(controller, options);
}

function getBoardVisualControllerReady() {
    return _getBoardWriterRuntimeForBoardRenderer().getControllerReady();
}

function getBoardVisualControllerReadyForPresentationDrain() {
    return _getBoardWriterRuntimeForBoardRenderer().getControllerReadyForPresentationDrain();
}

function claimBoardVisualWriter(frameToken: string, mode: 'local' | 'network' = 'local') {
    return _getBoardWriterRuntimeForBoardRenderer().claim(frameToken, mode);
}

function releaseBoardVisualWriter(token: any, finalFrame?: any) {
    return _getBoardWriterRuntimeForBoardRenderer().release(token, finalFrame);
}

function playBoardVisualPhase(token: any, events: readonly unknown[], phaseScope?: any) {
    return _getBoardWriterRuntimeForBoardRenderer().playPhase(token, events, phaseScope);
}

function validateBoardVisualPhase(
    events: readonly unknown[],
    phaseScope?: any,
    strictNetworkPlayback = false
) {
    return _getBoardWriterRuntimeForBoardRenderer()
        .validatePhase(events, phaseScope, strictNetworkPlayback);
}

function getBoardCellClientRect(row: number, col: number) {
    return _getBoardWriterRuntimeForBoardRenderer().getCellClientRect(row, col);
}

function abortBoardVisualWriterBeforeHandoff(token: any, checkpoint?: any) {
    return _getBoardWriterRuntimeForBoardRenderer().abortBeforeHandoff(token, checkpoint);
}

function cancelBoardVisualWriterAfterHandoff(token: any, checkpoint?: any) {
    return _getBoardWriterRuntimeForBoardRenderer().cancelAfterHandoff(token, checkpoint);
}

function settleBoardVisualWriter(token: any) {
    return _getBoardWriterRuntimeForBoardRenderer().settle(token);
}

function beginBoardVisualFrameCommit(token: any) {
    return _getBoardWriterRuntimeForBoardRenderer().beginFrameCommit(token);
}

function applyCommittedBoardVisualFrame(token: any, receipt: BoardVisualCommitReceipt) {
    return _getBoardWriterRuntimeForBoardRenderer().applyCommittedFrame(token, receipt);
}

function enterBoardVisualRecovery(token: any, error?: unknown) {
    return _getBoardWriterRuntimeForBoardRenderer().enterRecovery(token, error);
}

function settleAutoBoardVisualWriter(
    options?: { readonly abandonPresentationDrain?: boolean }
): Promise<boolean> {
    return _getBoardWriterRuntimeForBoardRenderer().settleAutoWriter(options);
}

function _beginBoardVisualApplyTransactionForBoardRenderer(frame: any, context: any) {
    return _getBoardFrameRuntimeForBoardRenderer().beginApplyFrame(frame, context);
}

function _buildBoardVisualFrameForBoardRenderer(controller: any, baseVisualStateOverride?: any) {
    return _getBoardFrameRuntimeForBoardRenderer().buildFrame(controller, baseVisualStateOverride);
}

function resetBoardVisualRenderSession() {
    _getBoardLayoutRuntimeForBoardRenderer().resetSession();
    _getBoardInputRuntimeForBoardRenderer().resetSession();
    _getBoardBackendRuntimeForBoardRenderer().resetSession();
    const renderSessionId = _getBoardFrameRuntimeForBoardRenderer().resetSession();
    _getBoardWriterRuntimeForBoardRenderer().resetSession();
    return renderSessionId;
}

function destroyBoardVisualPageRuntime() {
    _getBoardWriterRuntimeForBoardRenderer().destroyPageRuntime();
    _getBoardBackendRuntimeForBoardRenderer().destroyPageRuntime();
    _getBoardInputRuntimeForBoardRenderer().destroyPageRuntime();
    _getBoardLayoutRuntimeForBoardRenderer().destroyPageRuntime();
    _getBoardFrameRuntimeForBoardRenderer().destroyPageRuntime();
}

function getBoardVisualInvalidationDiagnostics() {
    return _getBoardWriterRuntimeForBoardRenderer().getInvalidationDiagnostics();
}

function renderBoardFull() {
    const controller = getBoardVisualController();
    if (controller && typeof controller.invalidate === 'function') controller.invalidate();
    return renderBoard();
}

function updateOccupancyUI() {
    const renderState = _resolveBoardRenderStateForBoardRenderer();
    if (!renderState.gameState || typeof renderState.gameState !== 'object') return;
    if (
        !BoardRendererBoardUtilsModule ||
        typeof BoardRendererBoardUtilsModule.countStateDiscs !== 'function'
    ) {
        throw new Error('SharedBoardUtils.countStateDiscs is required by board-renderer occupancy');
    }
    const counts = BoardRendererBoardUtilsModule.countStateDiscs(
        renderState.gameState,
        renderState.cardState
    );
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

// Expose in CommonJS for tests and in browser globals for legacy callers
const BoardRenderer: BoardRendererFacade = {
            renderBoard,
            prepareBoardVisualUpdate,
            renderBoardFull,
            getBoardVisualController,
            getBoardVisualControllerReady,
            getBoardVisualControllerReadyForPresentationDrain,
            getBoardInputController,
            activateBoardInputController,
            deactivateBoardInputController,
            configureBoardVisualController,
            configureBoardVisualBackendForTest,
            claimBoardVisualWriter,
            validateBoardVisualPhase,
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
            resetBoardVisualRenderSession,
            destroyBoardVisualPageRuntime,
            getBoardVisualInvalidationDiagnostics,
            setBoardPresentationPreviewHints,
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
export = BoardRenderer;
if (typeof window !== 'undefined') {
    // Prefer board-renderer as the canonical renderBoard implementation.
    window.renderBoard = renderBoard;
    (window as any).prepareBoardVisualUpdate = prepareBoardVisualUpdate;
    (window as any).getBoardVisualInvalidationDiagnostics = getBoardVisualInvalidationDiagnostics;
    window.updateOccupancyUI = updateOccupancyUI;
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
