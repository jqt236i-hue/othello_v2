
declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const RuntimeStateAccessModule = _require('../runtime-state-access');

declare const gameState: any;
declare const cardState: any;
declare const SoundEngine: any;
declare const MarkersAdapter: any;
declare const CardLogic: any;
declare const getPlayerKey: (...args: any[]) => any;
declare const getLegalMoves: (...args: any[]) => any;
declare const syncBoardPixelSizing: (...args: any[]) => any;
declare const applyStoneVisualEffect: (...args: any[]) => any;
declare const applyTrapStoneFallbackVisual: (...args: any[]) => any;
declare const getEffectKeyForSpecialType: (...args: any[]) => any;
declare const SPECIAL_TYPE_TO_EFFECT_KEY: any;
declare const handleCellClick: (...args: any[]) => any;
declare const BLACK: number;
declare const WHITE: number;
declare const EMPTY: number;

// PR1: debug-only perf benchmark helper (window.__DEV_PERF__ === true or ?perf=1).
// OFF path is zero-cost: every helper early-returns after the internal flag check.
let PerfBenchmarks: any = null;
if (typeof _require === 'function') {
    try { PerfBenchmarks = _require('../perf-benchmarks'); } catch (e: any) { /* ignore */ }
}
if (!PerfBenchmarks && typeof globalThis !== 'undefined') {
    try {
        const globalPerf = (globalThis as any).PerfBenchmarks;
        if (globalPerf) PerfBenchmarks = globalPerf;
    } catch (e: any) { /* ignore */ }
}

const DiffRendererEquality = _require('../board-visual/equality');
const DiffRendererProjector = _require('../board-visual/model-builder');
const DiffRendererDomPatcher = _require('./dom-patcher');
const DiffRendererInteractionBinder = _require('./input');
const DiffRendererWorldEffects = _require('../presentation/manifest-world-effects');
const CommittedWorldStateModule = _require('../presentation/committed-world-state');
const StoneInfoControllerModule = _require('../presentation/stone-info-controller');
const StoneInfoPresentationCapabilities = StoneInfoControllerModule.getStoneInfoPresentationCapabilities();
const cellStatesEqual = DiffRendererEquality.cellStatesEqual;

/**
 * @file diff-renderer.js
 * @description 差分レンダリングシステム - Virtual DOM的なアプローチで盤面更新を最適化
 * Differential rendering system for optimized board updates
 */

/**
 * @typedef {Object} CellState
 * @property {number} value - セルの値 (BLACK=1, WHITE=-1, EMPTY=0)
 * @property {boolean} isLegal - 合法手かどうか
 * @property {boolean} isLegalFree - 自由配置可能かどうか
 * @property {boolean} isTabooLegal - 禁忌の反転で置けるかどうか
 * @property {boolean} isRandomSpawnPreview - 増援/援軍の候補プレビューかどうか
 * @property {boolean} isExtendLifeTarget - 延命カード選択対象かどうか
 * @property {boolean} isProtected - 一時保護されているか
 * @property {boolean} isPermaProtected - 永久保護されているか
 * @property {string|null} permaOwner - 永久保護の所有者 ('black'|'white'|null)
 * @property {Object|null} bomb - 爆弾情報 {remainingTurns: number}
 * @property {Object|null} dragon - 龍情報 {owner: number, remainingOwnerTurns: number}
 * @property {boolean} breedingSprout - 繁殖生成の1ターン草表示
 */

/**
 * 前回のレンダリング状態を保持
 * Stores previous render state for diff calculation
 * @type {Array<Array<CellState>>|null}
 */
let previousBoardState: any = null;
/**
 * DOM要素キャッシュ - セル要素の参照を保持
 * Cache of cell DOM elements for fast access
 * @type {Array<Array<HTMLElement>>}
 */
let cellCache: any[] = [];
let cellCacheMap = new Map();
let boardDomSignature: any = null;
let boardDomElement: any = null;
let lastBoardExpansionRevealSoundKey: any = null;
let suppressBoardExpansionRevealSoundThisRender = false;
let superAttractionHoverPreview: any = null;
let activePreparedVisualStateForDiff: {
  gameState: any;
  cardState: any;
  stateVersion?: number;
} | null = null;
let DiffRendererManifestStoneRegistryModule: any = null;
let BoardHintProjectionModule: any = null;
const FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF = Object.freeze([
    'THEORY_INCARNATION',
    'BOARD_EXECUTOR',
    'OBSERVER_WILL'
]);

function _getPlayerKeyForDiff(value: any): 'black' | 'white' | null {
    try {
        if (typeof getPlayerKey === 'function') return getPlayerKey(value);
    } catch (e: any) { /* classic global is optional in isolated/runtime tests */ }
    if (OwnerHelpersModule && typeof OwnerHelpersModule.normalizePlayerKeyOptional === 'function') {
        return OwnerHelpersModule.normalizePlayerKeyOptional(value);
    }
    if (value === 'black' || value === 1 || value === '1') return 'black';
    if (value === 'white' || value === -1 || value === '-1') return 'white';
    return null;
}

function _getBoardValueConstantsForDiff() {
    const shared = SharedConstantsModuleForDiff;
    return {
        BLACK: shared && Number.isFinite(Number(shared.BLACK))
            ? Number(shared.BLACK)
            : ((typeof BLACK !== 'undefined') ? BLACK : 1),
        WHITE: shared && Number.isFinite(Number(shared.WHITE))
            ? Number(shared.WHITE)
            : ((typeof WHITE !== 'undefined') ? WHITE : -1),
        EMPTY: shared && Number.isFinite(Number(shared.EMPTY))
            ? Number(shared.EMPTY)
            : ((typeof EMPTY !== 'undefined') ? EMPTY : 0)
    };
}

function _getManifestStoneRegistryForDiff() {
    if (DiffRendererManifestStoneRegistryModule) return DiffRendererManifestStoneRegistryModule;
    if (typeof require === 'function') {
        try {
            DiffRendererManifestStoneRegistryModule = require('../../shared/manifest-stone-registry');
            return DiffRendererManifestStoneRegistryModule;
        } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof window !== 'undefined' && (window as any).ManifestStoneRegistry) {
            DiffRendererManifestStoneRegistryModule = (window as any).ManifestStoneRegistry;
            return DiffRendererManifestStoneRegistryModule;
        }
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).ManifestStoneRegistry) {
            DiffRendererManifestStoneRegistryModule = (globalThis as any).ManifestStoneRegistry;
            return DiffRendererManifestStoneRegistryModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _isManifestStoneTypeForDiff(rawType: any) {
    const registry = _getManifestStoneRegistryForDiff();
    if (registry && typeof registry.isManifestStoneType === 'function') {
        return registry.isManifestStoneType(rawType) === true;
    }
    const typeKey = String(rawType || '').trim().toUpperCase();
    return FALLBACK_MANIFEST_STONE_TYPES_FOR_DIFF.includes(typeKey);
}

function _isActiveManifestAuraMarkerForDiff(marker: any, manifestMarkerKind: any, specialMarkerKind: any) {
    if (!marker || typeof marker !== 'object') return false;
    const data = marker.data && typeof marker.data === 'object' ? marker.data : marker;
    const typeKey = String((data && data.type) || (marker && marker.type) || '').trim().toUpperCase();
    if (!typeKey) return false;
    const kind = String((marker && marker.kind) || '').trim();
    const isManifestKind = kind === manifestMarkerKind || kind === 'manifestStone';
    const isLegacyManifestType = (kind === specialMarkerKind || !kind) && _isManifestStoneTypeForDiff(typeKey);
    if (!isManifestKind && !isLegacyManifestType) return false;
    const remainingRaw = data.remainingOwnerTurns ?? data.remainingTurns ?? marker.remainingOwnerTurns ?? marker.remainingTurns;
    if (remainingRaw == null) return true;
    const remaining = Number(remainingRaw);
    return !Number.isFinite(remaining) || remaining > 0;
}

function _getManifestAuraOwnerClassForDiff(owner: any) {
    const constants = _getBoardValueConstantsForDiff();
    return (owner === 'black' || owner === constants.BLACK) ? 'black' : 'white';
}

function _getBoardShapeForDiff(gameState: any) {
    const config = _resolveBoardConfigForDiff(gameState);
    return { rows: config.rows, cols: config.cols };
}

function _normalizeBoardShapeInputForDiff(shapeOrGameState: any) {
    const rows = Number(shapeOrGameState && shapeOrGameState.rows);
    const cols = Number(shapeOrGameState && shapeOrGameState.cols);
    if (Number.isFinite(rows) && Number.isFinite(cols)) {
        return {
            rows: Math.max(1, Math.trunc(rows)),
            cols: Math.max(1, Math.trunc(cols))
        };
    }
    return _getBoardShapeForDiff(shapeOrGameState);
}

function _getStateBoardShapeForDiff(state: any) {
    if (state && state._boardShape) {
        return _normalizeBoardShapeInputForDiff(state._boardShape);
    }
    if (!Array.isArray(state)) {
        return { rows: 8, cols: 8 };
    }
    let cols = 0;
    for (const row of state) {
        if (Array.isArray(row)) cols = Math.max(cols, row.length);
    }
    return {
        rows: state.length > 0 ? state.length : 8,
        cols: cols > 0 ? cols : 8
    };
}

function _applyBoardCssVarsForDiff(boardEl: any, gameState: any) {
    const shape = _getBoardRenderGeometryForDiff(gameState);
    if (boardEl && boardEl.style) {
        boardEl.style.setProperty('--board-rows', String(shape.rows));
        boardEl.style.setProperty('--board-cols', String(shape.cols));
    }
    const syncBoardPixelSizing = _getBoardRendererHelperForDiff('syncBoardPixelSizing');
    if (syncBoardPixelSizing) {
        syncBoardPixelSizing(boardEl, shape);
    }
    return shape;
}

function _getBoardTopologyForDiff(gameState: any, cardStateOverride?: any) {
    return _createBoardViewForDiff(gameState, cardStateOverride).topology;
}

function _getBoardRenderGeometryForDiff(gameState: any) {
    const baseShape = _getBoardShapeForDiff(gameState);
    const topology = _getBoardTopologyForDiff(gameState);
    const bounds = topology && topology.renderBounds;
    if (!bounds) return { ...baseShape, minRow: 0, maxRow: baseShape.rows - 1, minCol: 0, maxCol: baseShape.cols - 1 };
    return {
        rows: bounds.maxRow - bounds.minRow + 1,
        cols: bounds.maxCol - bounds.minCol + 1,
        baseRows: baseShape.rows,
        baseCols: baseShape.cols,
        minRow: bounds.minRow,
        maxRow: bounds.maxRow,
        minCol: bounds.minCol,
        maxCol: bounds.maxCol
    };
}

function _applyBoardGridPositionForDiff(cell: any, row: any, col: any, gameState: any) {
    if (!cell || !cell.style) return;
    const geometry = _getBoardRenderGeometryForDiff(gameState);
    cell.style.gridRow = String(row - geometry.minRow + 1);
    cell.style.gridColumn = String(col - geometry.minCol + 1);
    cell.style.top = '';
    cell.style.left = '';
    cell.style.right = '';
    cell.style.bottom = '';
}

var BoardRendererStoneHelpersRegistryModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererStoneHelpersRegistryModule = require('../board-renderer/stone-helpers'); } catch (e: any) { /* ignore */ }
}
var StoneStatusSnapshotModule: any = null;
if (typeof require === 'function') {
    try { StoneStatusSnapshotModule = require('../../shared/stone-status-snapshot'); } catch (e: any) { /* ignore */ }
}
var SharedBoardUtilsModule: any = null;
if (typeof require === 'function') {
    try { SharedBoardUtilsModule = require('../../shared/shared-board-utils'); } catch (e: any) { /* ignore */ }
}
var BoardUpdateSyncRuntimeModule: any = null;
if (typeof require === 'function') {
    try { BoardUpdateSyncRuntimeModule = require('../board-update-sync-runtime'); } catch (e: any) { /* ignore */ }
}
const PlaybackFlipMarker = _require('../playback-flip-marker');

function _getGlobalScopeForDiff() {
    return (typeof globalThis !== 'undefined')
        ? globalThis
        : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : ({} as any)));
}

function _getStoneStatusSnapshotForDiff() {
    if (StoneStatusSnapshotModule) return StoneStatusSnapshotModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.StoneStatusSnapshot || null;
}

function _getBoardUpdateSyncRuntimeForDiff() {
    if (BoardUpdateSyncRuntimeModule) return BoardUpdateSyncRuntimeModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.BoardUpdateSyncRuntime || null;
}

function _getSharedBoardUtilsForDiff() {
    if (SharedBoardUtilsModule) return SharedBoardUtilsModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.SharedBoardUtils || null;
}

function _requireSharedBoardUtilsForDiff() {
    const sharedBoardUtils = _getSharedBoardUtilsForDiff();
    if (
        !sharedBoardUtils
        || typeof sharedBoardUtils.createBoardView !== 'function'
        || typeof sharedBoardUtils.resolveBoardConfig !== 'function'
    ) {
        throw new Error('[BoardDomCompat] SharedBoardUtils board kernel unavailable');
    }
    return sharedBoardUtils;
}

function _resolveBoardConfigForDiff(value: any) {
    return _requireSharedBoardUtilsForDiff().resolveBoardConfig(value);
}

function _createBoardViewForDiff(gameState: any, cardStateOverride?: any) {
    const cardStateValue = typeof cardStateOverride === 'undefined'
        ? _resolveCardStateForDiffRender()
        : cardStateOverride;
    return _requireSharedBoardUtilsForDiff().createBoardView(gameState, {
        cardState: cardStateValue,
        strict: true
    });
}

function _getBoardRendererHelperForDiff(name: any) {
    if (
        BoardRendererStoneHelpersRegistryModule &&
        typeof BoardRendererStoneHelpersRegistryModule.getBoardRendererStoneHelper === 'function'
    ) {
        const helper = BoardRendererStoneHelpersRegistryModule.getBoardRendererStoneHelper(name);
        if (typeof helper === 'function') return helper;
    }
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any)[name] === 'function') {
        return (globalThis as any)[name];
    }
    return null;
}

function _isTimeStopActiveForDiff() {
    if (typeof document === 'undefined') return false;
    try {
        return !!(
            (document.documentElement && document.documentElement.classList && document.documentElement.classList.contains('time-stop-active')) ||
            (document.body && document.body.classList && document.body.classList.contains('time-stop-active'))
        );
    } catch (e: any) {
        return false;
    }
}

function _applyTimeStopLegalEmphasisForDiff(cell: any) {
    const helper = _getBoardRendererHelperForDiff('applyTimeStopLegalEmphasis');
    if (typeof helper === 'function') {
        helper(cell, _isTimeStopActiveForDiff());
        return;
    }
    if (!cell || !cell.classList) return;
    const active = _isTimeStopActiveForDiff();
    const shouldEmphasize = !!active && (
        cell.classList.contains('legal') ||
        cell.classList.contains('legal-free') ||
        cell.classList.contains('selectable-friendly')
    );
    cell.classList.toggle('time-stop-legal-emphasis', shouldEmphasize);
}

function _playBoardExpansionRevealSoundForDiff() {
    try {
        if (typeof SoundEngine === 'undefined' || !SoundEngine || typeof SoundEngine.playEffectByKey !== 'function') {
            return;
        }
        if (typeof SoundEngine.init === 'function') {
            SoundEngine.init();
        }
        SoundEngine.playEffectByKey('board_expansion_reveal');
    } catch (e: any) { /* ignore */ }
}

function _getBoardHintProjectionForDiff() {
    if (BoardHintProjectionModule) return BoardHintProjectionModule;
    if (typeof require === 'function') {
        try {
            BoardHintProjectionModule = require('../../shared/board-hint-projection');
            return BoardHintProjectionModule;
        } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).BoardHintProjection) {
            BoardHintProjectionModule = (globalThis as any).BoardHintProjection;
            return BoardHintProjectionModule;
        }
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveBoardExpansionLayerForDiff(boardEl: any, createIfMissing?: any) {
    const resolveLayer = _getBoardRendererHelperForDiff('resolveBoardExpansionLayerElement');
    if (resolveLayer) {
        return resolveLayer(boardEl, createIfMissing);
    }
    if (typeof document === 'undefined' || !document || !boardEl) return null;
    const boardFrame = typeof boardEl.closest === 'function' ? boardEl.closest('#board-frame') : null;
    const boardStack = boardFrame && boardFrame.parentElement
        ? boardFrame.parentElement
        : boardEl.parentElement;
    if (!boardStack) return null;

    let layer = typeof boardStack.querySelector === 'function'
        ? boardStack.querySelector('#board-expansion-layer')
        : null;
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

function _getRenderedCellsForDiff(boardEl: any) {
    const cells: any[] = [];
    if (boardEl && typeof boardEl.querySelectorAll === 'function') {
        cells.push(...Array.from(boardEl.querySelectorAll('.cell')));
    }
    const expansionLayer = _resolveBoardExpansionLayerForDiff(boardEl, false);
    if (expansionLayer && typeof expansionLayer.querySelectorAll === 'function') {
        cells.push(...Array.from(expansionLayer.querySelectorAll('.cell')));
    }
    return cells;
}

function _buildBoardHintProjectionForDiff(gameStateValue: any, cardStateValue: any, playerKey: any, boardShape: any, canControlCurrentTurn: boolean, isHumanTurn: boolean, expansions: any[], cardContext?: any, operationCounters?: any) {
    const projectionModule = _getBoardHintProjectionForDiff();
    if (!projectionModule || typeof projectionModule.buildBoardHintProjection !== 'function') return null;
    return projectionModule.buildBoardHintProjection({
        gameState: gameStateValue,
        cardState: cardStateValue,
        playerKey,
        boardShape,
        canControlCurrentTurn,
        isHumanTurn,
        expansions,
        cardContext,
        operationCounters,
        cardLogic: (typeof CardLogic !== 'undefined' ? CardLogic : null),
        getLegalMoves: (typeof getLegalMoves === 'function' ? getLegalMoves : null)
    });
}

function _resetManifestWorldEffectsForDiff() {
    if (!DiffRendererWorldEffects || typeof DiffRendererWorldEffects.resetManifestWorldEffects !== 'function') {
        throw new Error('[DiffRenderer] world effects reset capability unavailable');
    }
    DiffRendererWorldEffects.resetManifestWorldEffects({
        document: (typeof document !== 'undefined' ? document : null),
        getTimer: () => (
            AnimationShared && typeof AnimationShared.getTimer === 'function'
                ? AnimationShared.getTimer()
                : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : null)
        )
    });
}
function _scheduleBoardExpansionRevealSoundForDiff(revealExpansionKeys: any, boardSignature: any) {
    const keys = Array.isArray(revealExpansionKeys)
        ? revealExpansionKeys.slice()
        : Array.from(revealExpansionKeys || []);
    if (!keys.length) return;
    if (suppressBoardExpansionRevealSoundThisRender) return;

    const soundKey = `${String(boardSignature || '')}:${keys.sort().join('|')}`;
    if (soundKey === lastBoardExpansionRevealSoundKey) return;
    lastBoardExpansionRevealSoundKey = soundKey;

    try {
        const root = (typeof window !== 'undefined' && window)
            ? window
            : ((typeof globalThis !== 'undefined' && globalThis) ? globalThis : null);
        if (root && typeof root.requestAnimationFrame === 'function') {
            root.requestAnimationFrame(() => {
                _playBoardExpansionRevealSoundForDiff();
            });
            return;
        }
    } catch (e: any) { /* ignore */ }

    _playBoardExpansionRevealSoundForDiff();
}

function _isMainBoardCellForDiff(row: any, col: any, shapeOrGameState?: any) {
    return !!_requireSharedBoardUtilsForDiff().isMainBoardCell(
        row,
        col,
        shapeOrGameState
    );
}

function _resolveExpansionSideForDiff(side: any, row: any, col: any, shapeOrGameState: any) {
    return _requireSharedBoardUtilsForDiff().resolveExpansionSide(
        side,
        row,
        col,
        shapeOrGameState
    );
}

function _isExpansionCoordinateForDiff(row: any, col: any, shapeOrGameState: any) {
    return !!_requireSharedBoardUtilsForDiff().isExpansionCoordinate(
        row,
        col,
        shapeOrGameState
    );
}

function _isExpansionCellForDiff(row: any, col: any, gameState: any) {
    const topology = _getBoardTopologyForDiff(gameState);
    if (topology && topology.expansionKeys && typeof topology.expansionKeys.has === 'function') {
        return topology.expansionKeys.has(`${row},${col}`);
    }
    return _getExpansionDescriptorsForDiff(gameState).some((cell) => cell && cell.row === row && cell.col === col);
}

function _applyBoardEdgeClassesForDiff(cell: any, row: any, col: any, shapeOrGameState: any) {
    if (!cell || !cell.classList) return;
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    cell.classList.toggle('cell-edge-left', col === 0);
    cell.classList.toggle('cell-edge-right', col === shape.cols - 1);
    cell.classList.toggle('cell-edge-top', row === 0);
    cell.classList.toggle('cell-edge-bottom', row === shape.rows - 1);
}

function _isBoardContourCellForDiff(row: number, col: number, gameState: any) {
    if (_getExpansionDescriptorsForDiff(gameState).some((exp) => exp && exp.row === row && exp.col === col)) {
        return true;
    }
    const sharedBoardUtils = _getSharedBoardUtilsForDiff();
    if (sharedBoardUtils && typeof sharedBoardUtils.isMainBoardCell === 'function') {
        return !!sharedBoardUtils.isMainBoardCell(row, col, gameState);
    }
    const shape = _getBoardShapeForDiff(gameState);
    return row >= 0 && row < shape.rows && col >= 0 && col < shape.cols;
}

function _isSquareRectangularBoardForDiff(gameState: any) {
    const topology = _getBoardTopologyForDiff(gameState);
    if (!topology) return false;
    return topology.baseRows === topology.baseCols
        && topology.baseKeys
        && typeof topology.baseKeys.has === 'function'
        && Number.isFinite(Number(topology.baseKeys.size))
        && topology.baseKeys.size === topology.baseRows * topology.baseCols;
}

function _applyBoardContourEdgeClassesForDiff(cell: any, row: number, col: number, gameState: any) {
    if (!cell || !cell.classList) return;
    if (_isSquareRectangularBoardForDiff(gameState)) {
        cell.classList.remove(
            'board-frame-edge-top',
            'board-frame-edge-right',
            'board-frame-edge-bottom',
            'board-frame-edge-left'
        );
        return;
    }
    cell.classList.toggle('board-frame-edge-top', !_isBoardContourCellForDiff(row - 1, col, gameState));
    cell.classList.toggle('board-frame-edge-right', !_isBoardContourCellForDiff(row, col + 1, gameState));
    cell.classList.toggle('board-frame-edge-bottom', !_isBoardContourCellForDiff(row + 1, col, gameState));
    cell.classList.toggle('board-frame-edge-left', !_isBoardContourCellForDiff(row, col - 1, gameState));
}

function _getExpansionDescriptorsForDiff(gameState: any): any[] {
    return Array.from(_createBoardViewForDiff(gameState).expansionCells);
}

function _getExpansionDescriptorForDiff(gameState: any) {
    const descriptors = _getExpansionDescriptorsForDiff(gameState);
    return descriptors.length > 0 ? descriptors[0] : null;
}

function _getBoardDomSignatureForDiff(gameState: any) {
    const boardShape = _getBoardShapeForDiff(gameState);
    const topology = _getBoardTopologyForDiff(gameState);
    const baseShape = topology && topology.baseKeys
        && typeof topology.baseKeys.has === 'function'
        && Number.isFinite(Number(topology.baseKeys.size))
        && topology.baseKeys.size === topology.baseRows * topology.baseCols
        ? 'dense'
        : 'sparse';
    const descriptors = _getExpansionDescriptorsForDiff(gameState);
    const geometry = _getBoardRenderGeometryForDiff(gameState);
    const boundsToken = `${geometry.minRow},${geometry.maxRow},${geometry.minCol},${geometry.maxCol}`;
    if (!descriptors.length) return `base:${baseShape}:${boardShape.rows}x${boardShape.cols}:${boundsToken}`;
    const tokens = descriptors
        .map((desc) => `${desc.row},${desc.col}`)
        .sort();
    return `expanded:${baseShape}:${boardShape.rows}x${boardShape.cols}:${boundsToken}:${tokens.join('|')}`;
}

function _getExpansionStateListForDiff(state: any): any[] {
    if (state && Array.isArray(state._expansionCells)) return state._expansionCells.filter(Boolean);
    if (state && state._expansionCell) return [state._expansionCell];
    return [];
}

function _getExpansionRevealKeysForDiff(previousState: any, nextDescriptors: any, allowReveal: any) {
    if (!allowReveal) return new Set();
    const previousKeys = new Set(
        _getExpansionStateListForDiff(previousState)
            .map((exp: any) => `${exp.row},${exp.col}`)
    );
    return new Set(
        (Array.isArray(nextDescriptors) ? nextDescriptors : [])
            .filter(Boolean)
            .map((exp) => `${exp.row},${exp.col}`)
            .filter((key) => !previousKeys.has(key))
    );
}

function _applyDoubleDigitTimerClassForDiff(timerElement: any, rawValue: any) {
    if (!timerElement) return;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue)) return;
    if (Math.abs(Math.trunc(numericValue)) >= 10) {
        timerElement.classList.add('timer-double-digit');
    }
}
function _setTimedLabelTextForDiff(label: any, value: any) {
    if (!label) return false;
    const numericValue = Number(value);
    const remaining = Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0;
    if (label.classList && label.classList.contains('stone-regen-badge')) {
        label.setAttribute('data-count', String(remaining));
        let valueLabel = label.querySelector ? label.querySelector('.stone-regen-badge-value') : null;
        if (!valueLabel) {
            label.textContent = '';
            valueLabel = document.createElement('span');
            valueLabel.className = 'stone-regen-badge-value';
            label.appendChild(valueLabel);
        }
        valueLabel.textContent = String(remaining);
        label.classList.remove('timer-double-digit');
        _applyDoubleDigitTimerClassForDiff(label, remaining);
        return true;
    }
    label.textContent = String(remaining);
    label.classList.remove('timer-double-digit');
    _applyDoubleDigitTimerClassForDiff(label, remaining);
    return true;
}
function _isFiniteTimedLabelValueForDiff(value: any) {
    if (value === null || typeof value === 'undefined') return false;
    return Number.isFinite(Number(value));
}
function _timerClassToSelectorForDiff(className: any) {
    const parts = String(className || '')
        .split(/\s+/)
        .map((part) => part.trim())
        .filter(Boolean);
    if (!parts.length) return '';
    return parts.map((part) => `.${part}`).join('');
}
function _findSpecialPrimaryTimerLabelForDiff(disc: any, special: any) {
    if (!disc || !disc.querySelectorAll || !special) return null;
    const snapshot = _createSpecialStoneStatusSnapshotForDiff({
        type: special.type,
        remainingOwnerTurns: special.remainingOwnerTurns,
        regenRemaining: special.regenRemaining,
        flipEvadeRemaining: special.flipEvadeRemaining,
        destroyEvadeRemaining: special.destroyEvadeRemaining
    }, { mode: 'raw' });
    const timerClass = (snapshot && snapshot.timerClass) ? snapshot.timerClass : 'special-timer';
    const selector = _timerClassToSelectorForDiff(timerClass);
    if (!selector) return null;
    const candidates = Array.from(disc.querySelectorAll(selector));
    return candidates.find((label: any) => !(
        label.classList.contains('flip-evade-timer') ||
        label.classList.contains('destroy-evade-timer') ||
        label.classList.contains('stone-regen-badge') ||
        label.classList.contains('bomb-timer') ||
        label.classList.contains('guard-timer') ||
        label.classList.contains('inherited-timer')
    )) || null;
}
function _patchChangedTimedLabelForDiff(label: any, previousValue: any, nextValue: any, setValue: any) {
    if (previousValue === nextValue) return { ok: true, patched: false };
    if (!_isFiniteTimedLabelValueForDiff(previousValue)) return { ok: false, patched: false };
    if (!_isFiniteTimedLabelValueForDiff(nextValue)) return { ok: false, patched: false };
    if (!label) return { ok: false, patched: false };
    return {
        ok: true,
        patched: _setTimedLabelTextForDiff(label, setValue)
    };
}
function _cloneCellStateWithTimedLabelsNormalizedForDiff(source: any) {
    if (!source || typeof source !== 'object') return source;
    const cloned = {
        ...source,
        special: source.special ? { ...source.special } : source.special,
        inherited: source.inherited ? { ...source.inherited } : source.inherited,
        guard: source.guard ? { ...source.guard } : source.guard,
        bomb: source.bomb ? { ...source.bomb } : source.bomb,
        blockade: source.blockade ? { ...source.blockade } : source.blockade,
        frozen: source.frozen ? { ...source.frozen } : source.frozen,
        seed: source.seed ? { ...source.seed } : source.seed,
        poisonCell: source.poisonCell ? { ...source.poisonCell } : source.poisonCell,
        poisoned: source.poisoned ? { ...source.poisoned } : source.poisoned,
        scorchedCell: source.scorchedCell ? { ...source.scorchedCell } : source.scorchedCell,
        healingCell: source.healingCell ? { ...source.healingCell } : source.healingCell,
        scorched: source.scorched ? { ...source.scorched } : source.scorched
    };
    if (cloned.special) {
        cloned.special.remainingOwnerTurns = 0;
        cloned.special.regenRemaining = 0;
        cloned.special.flipEvadeRemaining = 0;
        cloned.special.destroyEvadeRemaining = 0;
    }
    if (cloned.inherited) {
        cloned.inherited.remainingOwnerTurns = 0;
        cloned.inherited.flipEvadeRemaining = 0;
        cloned.inherited.destroyEvadeRemaining = 0;
    }
    if (cloned.guard) cloned.guard.remainingOwnerTurns = 0;
    if (cloned.bomb) cloned.bomb.remainingTurns = 0;
    if (cloned.blockade) cloned.blockade.remainingOwnerTurns = 0;
    if (cloned.frozen) cloned.frozen.remainingOwnerTurns = 0;
    if (cloned.seed) cloned.seed.remainingOwnerTurns = 0;
    if (cloned.poisonCell) cloned.poisonCell.remainingTurns = 0;
    if (cloned.poisoned) cloned.poisoned.remainingTurns = 0;
    if (cloned.scorchedCell) cloned.scorchedCell.remainingTurns = 0;
    if (cloned.healingCell) cloned.healingCell.remainingTurns = 0;
    if (cloned.scorched) cloned.scorched.remainingTurns = 0;
    return cloned;
}
function _onlyTimedLabelsChangedForDiff(prevState: any, state: any) {
    if (!prevState || !state) return false;
    const prevComparable = _cloneCellStateWithTimedLabelsNormalizedForDiff(prevState);
    const nextComparable = _cloneCellStateWithTimedLabelsNormalizedForDiff(state);
    return cellStatesEqual(prevComparable, nextComparable);
}
function _tryPatchTimedMarkerLabelsForDiff(cell: any, prevState: any, state: any) {
    if (!_onlyTimedLabelsChangedForDiff(prevState, state)) return false;
    const disc = cell && cell.querySelector ? cell.querySelector('.disc') : null;
    if (!disc) return false;
    let patched = false;
    const patch = (label: any, previousValue: any, nextValue: any, setValue: any = nextValue) => {
        const result = _patchChangedTimedLabelForDiff(label, previousValue, nextValue, setValue);
        if (!result.ok) return false;
        patched = result.patched || patched;
        return true;
    };
    if (prevState.special && state.special && prevState.special.remainingOwnerTurns !== state.special.remainingOwnerTurns) {
        if (!patch(_findSpecialPrimaryTimerLabelForDiff(disc, state.special), prevState.special.remainingOwnerTurns, state.special.remainingOwnerTurns)) return false;
    }
    if (prevState.special && state.special && prevState.special.regenRemaining !== state.special.regenRemaining) {
        if (!patch(disc.querySelector('.stone-regen-badge'), prevState.special.regenRemaining, state.special.regenRemaining)) return false;
    }
    if (prevState.special && state.special && prevState.special.flipEvadeRemaining !== state.special.flipEvadeRemaining) {
        if (!patch(disc.querySelector('.flip-evade-timer'), prevState.special.flipEvadeRemaining, state.special.flipEvadeRemaining)) return false;
    }
    if (prevState.special && state.special && prevState.special.destroyEvadeRemaining !== state.special.destroyEvadeRemaining) {
        if (!patch(disc.querySelector('.destroy-evade-timer'), prevState.special.destroyEvadeRemaining, state.special.destroyEvadeRemaining)) return false;
    }
    if (prevState.guard && state.guard && prevState.guard.remainingOwnerTurns !== state.guard.remainingOwnerTurns) {
        if (!patch(disc.querySelector('.guard-timer'), prevState.guard.remainingOwnerTurns, state.guard.remainingOwnerTurns)) return false;
    }
    if (prevState.bomb && state.bomb && prevState.bomb.remainingTurns !== state.bomb.remainingTurns) {
        if (!patch(disc.querySelector('.bomb-timer.countdown-timer'), prevState.bomb.remainingTurns, state.bomb.remainingTurns)) return false;
    }
    if (prevState.inherited && state.inherited && prevState.inherited.remainingOwnerTurns !== state.inherited.remainingOwnerTurns) {
        if (!patch(disc.querySelector('.inherited-timer'), prevState.inherited.remainingOwnerTurns, state.inherited.remainingOwnerTurns)) return false;
    }
    if (prevState.blockade && state.blockade && prevState.blockade.remainingOwnerTurns !== state.blockade.remainingOwnerTurns) {
        if (!patch(cell.querySelector('.blockade-turn'), prevState.blockade.remainingOwnerTurns, state.blockade.remainingOwnerTurns)) return false;
    }
    if (prevState.frozen && state.frozen && prevState.frozen.remainingOwnerTurns !== state.frozen.remainingOwnerTurns) {
        if (!patch(cell.querySelector('.freeze-turn'), prevState.frozen.remainingOwnerTurns, state.frozen.remainingOwnerTurns)) return false;
    }
    if (prevState.seed && state.seed && prevState.seed.remainingOwnerTurns !== state.seed.remainingOwnerTurns) {
        if (!patch(cell.querySelector('.seed-turn.countdown-timer'), prevState.seed.remainingOwnerTurns, state.seed.remainingOwnerTurns)) return false;
    }
    if (prevState.poisonCell && state.poisonCell && prevState.poisonCell.remainingTurns !== state.poisonCell.remainingTurns) {
        if (!patch(cell.querySelector('.poison-cell-turn'), prevState.poisonCell.remainingTurns, state.poisonCell.remainingTurns)) return false;
    }
    if (prevState.poisoned && state.poisoned && prevState.poisoned.remainingTurns !== state.poisoned.remainingTurns) {
        if (!patch(cell.querySelector('.poison-lethal-timer'), prevState.poisoned.remainingTurns, state.poisoned.remainingTurns)) return false;
    }
    if (prevState.scorchedCell && state.scorchedCell && prevState.scorchedCell.remainingTurns !== state.scorchedCell.remainingTurns) {
        if (!patch(cell.querySelector('.scorched-cell-turn'), prevState.scorchedCell.remainingTurns, state.scorchedCell.remainingTurns)) return false;
    }
    if (prevState.healingCell && state.healingCell && prevState.healingCell.remainingTurns !== state.healingCell.remainingTurns) {
        if (!patch(cell.querySelector('.healing-cell-turn'), prevState.healingCell.remainingTurns, state.healingCell.remainingTurns)) return false;
    }
    if (prevState.scorched && state.scorched && prevState.scorched.remainingTurns !== state.scorched.remainingTurns) {
        if (!patch(cell.querySelector('.scorch-lethal-timer'), prevState.scorched.remainingTurns, state.scorched.remainingTurns)) return false;
    }
    return patched;
}

function _resolveSpecialDisplayTurnsForDiff(data: any) {
    if (String(data && data.type ? data.type : '').toUpperCase() === 'REGEN') return undefined;
    const primary = Number(data && data.remainingOwnerTurns);
    if (Number.isFinite(primary)) return Math.max(0, Math.trunc(primary));
    const infection = Number(data && data.turnsUntilInfection);
    if (Number.isFinite(infection)) return Math.max(0, Math.trunc(infection));
    return undefined;
}

function _isBombCategoryMarkerForDiff(marker: any) {
    if (!marker || typeof marker !== 'object') return false;
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
        return MarkersAdapter.isBombCategoryMarker(marker);
    }
    const data = (marker.data && typeof marker.data === 'object') ? marker.data : null;
    const category = String(data && data.category ? data.category : '').trim().toLowerCase();
    const type = String(data && data.type ? data.type : '').trim().toUpperCase();
    return marker.kind === 'bomb' || category === 'bomb' || type === 'TIME_BOMB';
}

function _cacheCell(row: any, col: any, cell: any) {
    if (!cellCache[row]) cellCache[row] = [];
    cellCache[row][col] = cell;
    cellCacheMap.set(`${row},${col}`, cell);
}

function _getCachedCell(row: any, col: any) {
    return cellCacheMap.get(`${row},${col}`) || null;
}

// Shared animation helpers (normalized)
var AnimationShared = (typeof require === 'function') ? require('../animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);
var SharedConstantsModuleForDiff: any = null;
if (typeof _require === 'function') {
    try { SharedConstantsModuleForDiff = _require('../../shared-constants'); } catch (e: any) { /* ignore */ }
}
if (!SharedConstantsModuleForDiff) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).SharedConstants) {
            SharedConstantsModuleForDiff = (globalThis as any).SharedConstants;
        }
    } catch (e: any) { /* ignore */ }
}
var OwnerHelpersModule: any = null;
if (typeof require === 'function') {
    try { OwnerHelpersModule = require('../../utils/owner-helpers'); } catch (e: any) { /* ignore */ }
}
if (!OwnerHelpersModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).OwnerHelpers) OwnerHelpersModule = (globalThis as any).OwnerHelpers;
    } catch (e: any) { /* ignore */ }
}
var ViewerContextModule: any = null;
if (typeof require === 'function') {
    try { ViewerContextModule = require('../board-visual/viewer-context'); } catch (e: any) { /* ignore */ }
}
var SpecialMarkerRendererModule: any = null;
if (typeof require === 'function') {
    try { SpecialMarkerRendererModule = require('./special-marker-renderer'); } catch (e: any) { /* ignore */ }
}
var PlaybackStateModule: any = null;
if (typeof require === 'function') {
    try { PlaybackStateModule = require('../playback-state-manager'); } catch (e: any) { /* ignore */ }
}
if (!PlaybackStateModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).PlaybackStateManager) PlaybackStateModule = (globalThis as any).PlaybackStateManager;
    } catch (e: any) { /* ignore */ }
}

function _isVisualPlaybackActiveForDiff() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return false;
}

function _createSpecialMarkerRendererForDiff() {
    if (typeof document === 'undefined') return null;
    if (SpecialMarkerRendererModule && typeof SpecialMarkerRendererModule.createSpecialMarkerRenderer === 'function') {
        return SpecialMarkerRendererModule.createSpecialMarkerRenderer({
            documentRef: document,
            applyDoubleDigitTimerClass: _applyDoubleDigitTimerClassForDiff
        });
    }
    return null;
}

function _consumeBoardUpdateContextForDiff() {
    if (PlaybackStateModule && typeof PlaybackStateModule.consumeBoardUpdateContext === 'function') {
        const context = PlaybackStateModule.consumeBoardUpdateContext();
        if (context && typeof context === 'object') return context;
    }
    return null;
}

function _peekBoardUpdateSyncContextForDiff() {
    const runtime = _getBoardUpdateSyncRuntimeForDiff();
    if (runtime && typeof runtime.peekBoardUpdateSyncContext === 'function') {
        const context = runtime.peekBoardUpdateSyncContext();
        if (context && typeof context === 'object') return context;
    }
    return null;
}

function _consumeBoardUpdateSyncContextForDiff() {
    const runtime = _getBoardUpdateSyncRuntimeForDiff();
    if (runtime && typeof runtime.consumeBoardUpdateSyncContext === 'function') {
        const context = runtime.consumeBoardUpdateSyncContext();
        if (context && typeof context === 'object') return context;
    }
    return null;
}

// Internal (per-render) flag to suppress fallback flip animation.
// AnimationEngine already animates flip events; DiffRenderer is used to sync final DOM state after playback.
let suppressFallbackFlipThisRender = false;
let pendingMoveSourceKeysThisRender: any = null;
let pendingFlipTargetKeysThisRender: any = null;
function _getCardStateForDiffPlayback() {
    return RuntimeStateAccessModule.resolveCurrentRuntimeObject('cardState', () => {
        try {
            return (typeof cardState !== 'undefined') ? cardState : null;
        } catch (e: any) {
            return null;
        }
    });
}

function _hasPendingPlaybackEvents() {
    if (PlaybackStateModule && typeof PlaybackStateModule.hasPendingVisualPlayback === 'function') {
        try {
            return PlaybackStateModule.hasPendingVisualPlayback(_getCardStateForDiffPlayback()) === true;
        } catch (e: any) { /* ignore */ }
    }
    return false;
}

function _hasClaimedVisualPlaybackForDiff() {
    if (PlaybackStateModule && typeof PlaybackStateModule.hasClaimedVisualPlayback === 'function') {
        try {
            return PlaybackStateModule.hasClaimedVisualPlayback() === true;
        } catch (e: any) { /* ignore */ }
    }
    try {
        if (typeof window !== 'undefined' && (window as any).__visualPlaybackClaimActive === true) return true;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).__visualPlaybackClaimActive === true) return true;
    } catch (e: any) { /* ignore */ }
    return false;
}

function _getPendingPlaybackQueueEntriesForDiff() {
    const state = _getCardStateForDiffPlayback();
    if (PlaybackStateModule && typeof PlaybackStateModule.getPresentationQueueEntries === 'function') {
        try {
            return PlaybackStateModule.getPresentationQueueEntries(state);
        } catch (e: any) { /* ignore */ }
    }
    return [];
}

function _getPlaybackEventsFromQueueEntryForDiff(entry: any) {
    if (!entry || typeof entry !== 'object') return [];
    if (entry.type === 'PLAYBACK_EVENTS' && Array.isArray(entry.events)) {
        return entry.events;
    }
    return [entry];
}

function _extractMoveSourceKeyFromPlaybackTargetForDiff(target: any) {
    if (!target || typeof target !== 'object') return null;

    const from = (target.from && typeof target.from === 'object') ? target.from : null;
    let row = _normalizeBoardCoord(from && (Object.prototype.hasOwnProperty.call(from, 'r') ? from.r : from.row));
    let col = _normalizeBoardCoord(
        from && (
            Object.prototype.hasOwnProperty.call(from, 'col')
                ? from.col
                : (Object.prototype.hasOwnProperty.call(from, 'c') ? from.c : from.column)
        )
    );

    if (row === null) row = _normalizeBoardCoord(Object.prototype.hasOwnProperty.call(target, 'prevRow') ? target.prevRow : target.fromRow);
    if (col === null) col = _normalizeBoardCoord(Object.prototype.hasOwnProperty.call(target, 'prevCol') ? target.prevCol : target.fromCol);

    return row !== null && col !== null ? `${row},${col}` : null;
}

function _extractCellKeyFromPlaybackTargetForDiff(target: any) {
    if (!target || typeof target !== 'object') return null;

    const row = _normalizeBoardCoord(
        Object.prototype.hasOwnProperty.call(target, 'row')
            ? target.row
            : (Object.prototype.hasOwnProperty.call(target, 'r') ? target.r : target.y)
    );
    const col = _normalizeBoardCoord(
        Object.prototype.hasOwnProperty.call(target, 'col')
            ? target.col
            : (Object.prototype.hasOwnProperty.call(target, 'c') ? target.c : target.x)
    );

    return row !== null && col !== null ? `${row},${col}` : null;
}

function _collectPendingMoveSourceKeysForDiff() {
    const keys = new Set();
    const pendingEntries = _getPendingPlaybackQueueEntriesForDiff();
    for (const entry of pendingEntries) {
        const playbackEvents = _getPlaybackEventsFromQueueEntryForDiff(entry);
        for (const playbackEvent of playbackEvents) {
            if (String(playbackEvent && playbackEvent.type || '').toLowerCase() !== 'move') continue;
            const targets = Array.isArray(playbackEvent.targets) ? playbackEvent.targets : [];
            for (const target of targets) {
                const key = _extractMoveSourceKeyFromPlaybackTargetForDiff(target);
                if (key) keys.add(key);
            }
        }
    }
    return keys;
}

function _collectPendingFlipTargetKeysForDiff() {
    const keys = new Set();
    const pendingEntries = _getPendingPlaybackQueueEntriesForDiff();
    for (const entry of pendingEntries) {
        const playbackEvents = _getPlaybackEventsFromQueueEntryForDiff(entry);
        for (const playbackEvent of playbackEvents) {
            const eventType = String(playbackEvent && playbackEvent.type || '').toLowerCase();
            if (eventType !== 'flip' && eventType !== 'change') continue;
            const targets = eventType === 'change'
                ? [playbackEvent]
                : (Array.isArray(playbackEvent.targets) ? playbackEvent.targets : []);
            for (const target of targets) {
                const key = _extractCellKeyFromPlaybackTargetForDiff(target);
                if (key) keys.add(key);
            }
        }
    }
    return keys;
}

function _hasPendingMoveSourceAtForDiff(row: any, col: any) {
    const key = `${row},${col}`;
    const keys = pendingMoveSourceKeysThisRender || _collectPendingMoveSourceKeysForDiff();
    return keys.has(key);
}

function _hasPendingFlipTargetAtForDiff(row: any, col: any) {
    const key = `${row},${col}`;
    const keys = pendingFlipTargetKeysThisRender || _collectPendingFlipTargetKeysForDiff();
    return keys.has(key);
}

function _hasRecentPlaybackFlipMarkerForDiff(disc: any) {
    return !!(
        PlaybackFlipMarker &&
        typeof PlaybackFlipMarker.hasRecentPlaybackFlipMarker === 'function' &&
        PlaybackFlipMarker.hasRecentPlaybackFlipMarker(disc)
    );
}

function _normalizeBoardUpdateContextKeySetForDiff(value: any) {
    const keys = new Set();
    if (!Array.isArray(value)) return keys;
    for (const raw of value) {
        const key = String(raw || '').trim();
        if (key) keys.add(key);
    }
    return keys;
}

function _mergeBoardUpdateContextKeySetsForDiff(contextKeys: any, queueKeys: any) {
    const merged = new Set();
    if (contextKeys && typeof contextKeys.forEach === 'function') {
        contextKeys.forEach((key: any) => {
            const normalized = String(key || '').trim();
            if (normalized) merged.add(normalized);
        });
    }
    if (queueKeys && typeof queueKeys.forEach === 'function') {
        queueKeys.forEach((key: any) => {
            const normalized = String(key || '').trim();
            if (normalized) merged.add(normalized);
        });
    }
    return merged;
}

function _preservePendingPlaybackDiffContextForFinalSync() {
    if (!PlaybackStateModule || typeof PlaybackStateModule.armBoardUpdateContext !== 'function') return;
    const moveSourceKeys = Array.from(_collectPendingMoveSourceKeysForDiff());
    const flipTargetKeys = Array.from(_collectPendingFlipTargetKeysForDiff());
    if (moveSourceKeys.length === 0 && flipTargetKeys.length === 0) return;
    try {
        PlaybackStateModule.armBoardUpdateContext({
            source: 'diff-renderer',
            reason: 'deferred_playback_board_sync',
            pendingMoveSourceKeys: moveSourceKeys,
            pendingFlipTargetKeys: flipTargetKeys
        });
    } catch (e: any) { /* ignore */ }
}

function _resolveNetworkVisualStateStoreForDiff() {
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

function _resolveNetworkPresentationTimelineForDiff() {
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

function _isStrictNetworkVisualRenderActiveForDiff() {
    const store = _resolveNetworkVisualStateStoreForDiff();
    try {
        const diagnostics = store && typeof store.getDiagnostics === 'function'
            ? store.getDiagnostics()
            : null;
        if (diagnostics && diagnostics.lagging === true) return true;
    } catch (e: any) { /* ignore */ }
    const timeline = _resolveNetworkPresentationTimelineForDiff();
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

function _resolveNetworkVisualRenderSnapshotForDiff() {
    const store = _resolveNetworkVisualStateStoreForDiff();
    try {
        const snapshot = store && typeof store.peekRenderSnapshot === 'function'
            ? store.peekRenderSnapshot()
            : (store && typeof store.getRenderSnapshot === 'function' ? store.getRenderSnapshot() : null);
        if (snapshot && snapshot.gameState && snapshot.cardState) return snapshot;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveNetworkVisualInputEpochForDiff(snapshot: any, viewerContext: any) {
    if (!viewerContext || viewerContext.isNetworkMode !== true) {
        return Object.freeze({ stateVersion: null, visualSeq: null });
    }
    const store = _resolveNetworkVisualStateStoreForDiff();
    let diagnostics: any = null;
    try {
        diagnostics = store && typeof store.getDiagnostics === 'function'
            ? store.getDiagnostics()
            : null;
    } catch (e: any) { diagnostics = null; }
    const snapshotVersion = snapshot && typeof snapshot.stateVersion === 'number'
        && Number.isInteger(snapshot.stateVersion)
        ? snapshot.stateVersion
        : null;
    const visualVersion = diagnostics && typeof diagnostics.visualVersion === 'number'
        && Number.isInteger(diagnostics.visualVersion)
        ? diagnostics.visualVersion
        : null;
    const visualSeq = diagnostics && typeof diagnostics.visualSeq === 'number'
        && Number.isInteger(diagnostics.visualSeq)
        ? diagnostics.visualSeq
        : null;
    return Object.freeze({
        stateVersion: snapshotVersion ?? visualVersion,
        visualSeq
    });
}

function _resolveLocalVisualRenderPairForDiff() {
    const currentGameState = RuntimeStateAccessModule.resolveCurrentRuntimeObject('gameState', () => {
        try { return (typeof gameState !== 'undefined') ? gameState : null; }
        catch (e: any) { return null; }
    });
    const currentCardState = RuntimeStateAccessModule.resolveCurrentRuntimeObject('cardState', () => {
        try { return (typeof cardState !== 'undefined') ? cardState : null; }
        catch (e: any) { return null; }
    });
    return {
        gameState: currentGameState,
        cardState: currentCardState || {}
    };
}

function _resolveVisualRenderPairForDiff() {
    if (activePreparedVisualStateForDiff) {
        return {
            gameState: activePreparedVisualStateForDiff.gameState,
            cardState: activePreparedVisualStateForDiff.cardState,
            stateVersion: activePreparedVisualStateForDiff.stateVersion
        };
    }
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot) {
        return {
            gameState: visualSnapshot.gameState,
            cardState: visualSnapshot.cardState,
            stateVersion: visualSnapshot.stateVersion
        };
    }
    return _resolveLocalVisualRenderPairForDiff();
}

function _resolveGameStateForDiffRender() {
    if (activePreparedVisualStateForDiff) return activePreparedVisualStateForDiff.gameState;
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot && visualSnapshot.gameState) return visualSnapshot.gameState;
    return _resolveLocalVisualRenderPairForDiff().gameState;
}

function _resolveCardStateForDiffRender() {
    if (activePreparedVisualStateForDiff) return activePreparedVisualStateForDiff.cardState;
    const visualSnapshot = _resolveNetworkVisualRenderSnapshotForDiff();
    if (visualSnapshot && visualSnapshot.cardState) return visualSnapshot.cardState;
    return _resolveLocalVisualRenderPairForDiff().cardState;
}

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

function _getBoardDirectionHintArrowTextForDiff(direction: any) {
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

function _clearBoardShrinkGodDirectionHintForDiff(cell: any) {
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

function _clearBoardShrinkWillDirectionHintForDiff(cell: any) {
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

function _clearBoardExpansionDirectionHintForDiff(cell: any) {
    if (!cell || !cell.classList) return;
    cell.classList.remove(BOARD_EXPANSION_DIRECTION_HINT_TARGET_CLASS, ...BOARD_EXPANSION_DIRECTION_HINT_DIRECTION_CLASSES);
    if (cell.dataset) {
        delete cell.dataset.boardExpansionDirectionHint;
    }
    const hints = typeof cell.querySelectorAll === 'function'
        ? Array.from(cell.querySelectorAll(`.${BOARD_EXPANSION_DIRECTION_HINT_CLASS}`))
        : [];
    for (const hint of hints as any[]) {
        if (hint && hint.parentNode === cell) hint.parentNode.removeChild(hint);
    }
}

function _ensureBoardShrinkGodDirectionHintForDiff(cell: any, direction: any, hintId?: string) {
    if (!cell || !cell.classList) return;
    const arrowText = _getBoardDirectionHintArrowTextForDiff(direction);
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
        hint.dataset.hintId = String(hintId || '');
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

function _ensureBoardShrinkWillDirectionHintForDiff(cell: any, direction: any, hintId?: string) {
    if (!cell || !cell.classList) return;
    const arrowText = _getBoardDirectionHintArrowTextForDiff(direction);
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
        hint.dataset.hintId = String(hintId || '');
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

function _ensureBoardExpansionDirectionHintForDiff(
    cell: any,
    rawDirections: any,
    hintKind: 'board-expansion-god' | 'board-expansion-will',
    cellKey?: string,
    exactHintIdMap?: Map<string, string>
) {
    if (!cell || !cell.classList) return;
    const directions = (Array.isArray(rawDirections) ? rawDirections : [rawDirections])
        .map((value: any) => String(value || '').toLowerCase())
        .filter((value: string, index: number, list: string[]) => !!value && list.indexOf(value) === index);
    _clearBoardExpansionDirectionHintForDiff(cell);
    if (!directions.length) return;
    cell.classList.add(BOARD_EXPANSION_DIRECTION_HINT_TARGET_CLASS, ...directions.map((direction: string) => `board-expansion-direction-${direction}`));
    if (cell.dataset) {
        cell.dataset.boardExpansionDirectionHint = directions.join(',');
    }
    if (typeof document === 'undefined') return;
    const positions: Record<string, { top: string; left: string }> = {
        up: { top: '14%', left: '50%' },
        down: { top: '86%', left: '50%' },
        left: { top: '50%', left: '14%' },
        right: { top: '50%', left: '86%' },
        'up-left': { top: '18%', left: '18%' },
        'up-right': { top: '18%', left: '82%' },
        'down-left': { top: '82%', left: '18%' },
        'down-right': { top: '82%', left: '82%' }
    };
    for (const direction of directions) {
        const hint = document.createElement('div');
        hint.className = BOARD_EXPANSION_DIRECTION_HINT_CLASS;
        hint.setAttribute('role', 'button');
        hint.tabIndex = 0;
        hint.setAttribute('aria-label', `盤面を${_getBoardDirectionHintArrowTextForDiff(direction)}方向へ拡張`);
        cell.appendChild(hint);
        hint.textContent = _getBoardDirectionHintArrowTextForDiff(direction);
        if (hint.dataset) {
            hint.dataset.direction = direction;
            const fallbackCellKey = `${String(cell.dataset && cell.dataset.row)},${String(cell.dataset && cell.dataset.col)}`;
            hint.dataset.hintId = exactHintIdMap?.get(`${String(cellKey || fallbackCellKey)}:${direction}`)
                || `${hintKind}:${fallbackCellKey}:${direction}`;
        }
        const position = positions[direction] || positions.right;
        hint.style.position = 'absolute';
        hint.style.top = position.top;
        hint.style.left = position.left;
        hint.style.transform = 'translate(-50%, -50%)';
        hint.style.display = 'flex';
        hint.style.alignItems = 'center';
        hint.style.justifyContent = 'center';
        hint.style.width = 'calc(20px * var(--layout-stage-scale))';
        hint.style.height = 'calc(20px * var(--layout-stage-scale))';
        hint.style.borderRadius = '999px';
        hint.style.border = 'var(--layout-size-border-thin) solid rgba(218, 246, 255, 0.78)';
        hint.style.background = 'linear-gradient(180deg, rgba(16, 76, 65, 0.94) 0%, rgba(8, 34, 29, 0.92) 100%)';
        hint.style.boxShadow = '0 0 calc(8px * var(--layout-stage-scale)) rgba(116, 255, 228, 0.35)';
        hint.style.color = '#f7fffc';
        hint.style.fontFamily = '"DotGothic16", "MS Gothic", "Osaka-Mono", monospace';
        hint.style.fontSize = 'calc(13px * var(--layout-stage-scale))';
        hint.style.fontWeight = '700';
        hint.style.lineHeight = '1';
        hint.style.textShadow = '0 0 calc(3px * var(--layout-stage-scale)) rgba(255, 255, 255, 0.28)';
        hint.style.pointerEvents = 'auto';
        hint.style.cursor = 'pointer';
        hint.style.userSelect = 'none';
        hint.style.zIndex = '48';
    }
}

function _syncBoardShrinkGodDirectionHintsForDiff(boardEl: any, preparedRenderProjection?: any) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('_syncBoardShrinkGodDirectionHintsForDiff');
    try {
        if (!boardEl) return;
    let projection = preparedRenderProjection && preparedRenderProjection.hintProjection;
    if (!projection || typeof projection !== 'object') {
        const gameState = _resolveGameStateForDiffRender();
        const cardState = _resolveCardStateForDiffRender();
        const playerKey = gameState ? _getPlayerKeyForDiff(gameState.currentPlayer) : null;
        const boardShape = _getBoardShapeForDiff(gameState);
        projection = _buildBoardHintProjectionForDiff(
            gameState,
            cardState,
            playerKey,
            boardShape,
            false,
            true,
            _getExpansionDescriptorsForDiff(gameState)
        ) || {};
    }
    const hintMap = projection.boardShrinkGodDirectionHintMap instanceof Map
        ? projection.boardShrinkGodDirectionHintMap
        : new Map();
    const willHintMap = projection.boardShrinkWillDirectionHintMap instanceof Map
        ? projection.boardShrinkWillDirectionHintMap
        : new Map();
    const expansionHintMap = projection.boardExpansionDirectionHintMap instanceof Map
        ? projection.boardExpansionDirectionHintMap
        : new Map();
    const expansionHintIdMap = projection.boardExpansionDirectionHintIdMap instanceof Map
        ? projection.boardExpansionDirectionHintIdMap
        : new Map();
    const expansionHintKind = String(
        preparedRenderProjection && preparedRenderProjection.pending && preparedRenderProjection.pending.type || ''
    ).toUpperCase() === 'BOARD_EXPANSION_WILL'
        ? 'board-expansion-will'
        : 'board-expansion-god';
    const cells = _getRenderedCellsForDiff(boardEl);
    cells.forEach((cell: any) => {
        const row = Number(cell && cell.dataset ? cell.dataset.row : NaN);
        const col = Number(cell && cell.dataset ? cell.dataset.col : NaN);
        const key = Number.isInteger(row) && Number.isInteger(col) ? `${row},${col}` : null;
        if (!key || !hintMap.has(key)) {
            _clearBoardShrinkGodDirectionHintForDiff(cell);
        } else {
            const direction = hintMap.get(key);
            _ensureBoardShrinkGodDirectionHintForDiff(
                cell,
                direction,
                `board-shrink-god:${key}:${direction}`
            );
        }
        if (!key || !willHintMap.has(key)) {
            _clearBoardShrinkWillDirectionHintForDiff(cell);
        } else {
            const direction = willHintMap.get(key);
            _ensureBoardShrinkWillDirectionHintForDiff(
                cell,
                direction,
                `board-shrink-will:${key}:${direction}`
            );
        }
        if (!key || !expansionHintMap.has(key)) {
            _clearBoardExpansionDirectionHintForDiff(cell);
        } else {
            _ensureBoardExpansionDirectionHintForDiff(
                cell,
                expansionHintMap.get(key),
                expansionHintKind,
                key,
                expansionHintIdMap
            );
        }
    });
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('_syncBoardShrinkGodDirectionHintsForDiff');
    }
}

function _normalizeSuperAttractionPreviewPoint(point: any) {
    const row = Number(point && point.row);
    const col = Number(point && point.col);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function _getCurrentPendingForSuperAttractionPreview() {
    const gs = _resolveGameStateForDiffRender();
    const cs = _resolveCardStateForDiffRender();
    if (!gs || !cs || !cs.pendingEffectByPlayer) return null;
    const playerKey = _getPlayerKeyForDiff(gs.currentPlayer);
    if (!playerKey) return null;
    const pending = cs.pendingEffectByPlayer[playerKey];
    if (!pending || pending.stage !== 'selectTarget' || pending.type !== 'SUPER_ATTRACTION_WILL') return null;
    const firstTarget = _normalizeSuperAttractionPreviewPoint(pending.firstTarget);
    if (!firstTarget) return null;
    return { gameState: gs, cardState: cs, playerKey, pending, firstTarget };
}

function _getSuperAttractionPreviewSignature(context: any, row: number, col: number) {
    const pending = context && context.pending;
    const first = context && context.firstTarget;
    return [
        context && context.playerKey,
        pending && pending.cardId ? pending.cardId : '',
        pending && pending.pendingEffectId ? pending.pendingEffectId : '',
        first ? first.row : '',
        first ? first.col : '',
        row,
        col
    ].join('|');
}

function _requestSuperAttractionPreviewRender() {
    if (!boardDomElement) return;
    try {
        const scheduler = _require('../render-scheduler');
        if (scheduler && typeof scheduler.requestBoardRender === 'function') {
            scheduler.requestBoardRender({ source: 'ui.diff-renderer', reason: 'super-attraction-hover' });
            return;
        }
        const renderBoard = _getBoardRendererHelperForDiff('renderBoard');
        if (typeof renderBoard === 'function') renderBoard();
    } catch (e: any) { /* UI-only hover update */ }
}

function _clearSuperAttractionHoverPreview() {
    if (!superAttractionHoverPreview) return false;
    superAttractionHoverPreview = null;
    _requestSuperAttractionPreviewRender();
    return true;
}

function _setSuperAttractionHoverPreview(row: any, col: any) {
    const target = _normalizeSuperAttractionPreviewPoint({ row, col });
    const context = _getCurrentPendingForSuperAttractionPreview();
    if (!target || !context) return _clearSuperAttractionHoverPreview();
    if (target.row === context.firstTarget.row && target.col === context.firstTarget.col) {
        return _clearSuperAttractionHoverPreview();
    }
    if (typeof CardLogic === 'undefined' || !CardLogic || typeof CardLogic.getSuperAttractionPathPreview !== 'function') {
        return _clearSuperAttractionHoverPreview();
    }
    const signature = _getSuperAttractionPreviewSignature(context, target.row, target.col);
    if (superAttractionHoverPreview && superAttractionHoverPreview.signature === signature) {
        return false;
    }
    let candidates: any[] = [];
    try {
        const result = CardLogic.getSuperAttractionPathPreview(
            context.cardState,
            context.gameState,
            context.firstTarget,
            target
        );
        candidates = Array.isArray(result) ? result : [];
    } catch (e: any) {
        candidates = [];
    }
    if (candidates.length <= 0) return _clearSuperAttractionHoverPreview();

    superAttractionHoverPreview = {
        signature,
        firstTarget: context.firstTarget,
        target,
        candidates
    };
    _requestSuperAttractionPreviewRender();
    return true;
}

function _getActiveSuperAttractionPreviewForDiff(pending: any) {
    if (!superAttractionHoverPreview || !pending || pending.type !== 'SUPER_ATTRACTION_WILL') return null;
    if (!pending.firstTarget) return null;
    const first = _normalizeSuperAttractionPreviewPoint(pending.firstTarget);
    const previewFirst = _normalizeSuperAttractionPreviewPoint(superAttractionHoverPreview.firstTarget);
    if (!first || !previewFirst || first.row !== previewFirst.row || first.col !== previewFirst.col) return null;
    return superAttractionHoverPreview;
}

function _collectSuperAttractionPreviewKeys(preview: any) {
    const pathKeys = new Set();
    const destinationKeys = new Set();
    if (!preview || !Array.isArray(preview.candidates)) {
        return { pathKeys, destinationKeys };
    }
    const target = _normalizeSuperAttractionPreviewPoint(preview.target);
    if (target) destinationKeys.add(`${target.row},${target.col}`);
    for (const candidate of preview.candidates) {
        const pathCells = Array.isArray(candidate && candidate.pathCells) ? candidate.pathCells : [];
        for (const point of pathCells) {
            const normalized = _normalizeSuperAttractionPreviewPoint(point);
            if (!normalized) continue;
            pathKeys.add(`${normalized.row},${normalized.col}`);
        }
    }
    return { pathKeys, destinationKeys };
}

function _buildEmptyCellStateForDiffRender(shapeOrGameState: any) {
    const boardShape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    const emptyVal = (typeof EMPTY !== 'undefined') ? EMPTY : 0;
    const state: any = [];
    for (let r = 0; r < boardShape.rows; r++) {
        state[r] = [];
        for (let c = 0; c < boardShape.cols; c++) {
            state[r][c] = {
                value: emptyVal,
                isLegal: false,
                isLegalFree: false,
                isTabooLegal: false,
                isRandomSpawnPreview: false,
                isSelectedTargetHighlighted: false,
                isSuperAttractionPathPreview: false,
                isSuperAttractionPreviewDestination: false,
                isSelectableFriendly: false,
                isExtendLifeTarget: false,
                breedingSprout: false,
                boardBonus: null,
                theoryNumberCell: false,
                special: null,
                inherited: null,
                guard: null,
                bomb: null,
                blockade: null,
                frozen: null,
                poisonCell: null,
                poisoned: null,
                scorchedCell: null,
                healingCell: null,
                scorched: null,
                destroyEvadeRemaining: null
            };
        }
    }
    state._expansionCells = [];
    state._expansionCell = null;
    state._boardShape = boardShape;
    return state;
}

function _resolveFlipEvadeDisplayForDiff(special: any) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsFlipEvade = (
        specialTypeUpper === 'HYPERACTIVE' ||
        specialTypeUpper === 'EXTREME_HYPERACTIVE' ||
        specialTypeUpper === 'ESCAPE_HYPERACTIVE' ||
        specialTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
        specialTypeUpper === 'WILL_HUNTER_KING' ||
        specialTypeUpper === 'AFTERIMAGE_WILL'
    );
    return (
        special &&
        specialSupportsFlipEvade &&
        special.flipEvadeRemaining !== null &&
        typeof special.flipEvadeRemaining !== 'undefined' &&
        Number.isFinite(Number(special.flipEvadeRemaining))
    )
        ? Math.max(0, Math.trunc(Number(special.flipEvadeRemaining)))
        : null;
}

function _resolveDestroyEvadeDisplayForDiff(special: any) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsDestroyEvade = (
        specialTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
        specialTypeUpper === 'EXTREME_HYPERACTIVE' ||
        specialTypeUpper === 'WILL_HUNTER_KING' ||
        specialTypeUpper === 'AFTERIMAGE_WILL'
    );
    return (
        special &&
        specialSupportsDestroyEvade &&
        special.destroyEvadeRemaining !== null &&
        typeof special.destroyEvadeRemaining !== 'undefined' &&
        Number.isFinite(Number(special.destroyEvadeRemaining))
    )
        ? Math.max(0, Math.trunc(Number(special.destroyEvadeRemaining)))
        : null;
}

function _isBoardHiddenTrap(marker: any) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // Hidden traps stay visually normal for both seats until reveal timing events.
    return true;
}

function _resolveViewerContextForDiff(preparedCardState?: any) {
    const root = typeof window !== 'undefined' ? window : null;
    try {
        if (ViewerContextModule && typeof ViewerContextModule.resolveDiffRendererViewerContext === 'function') {
            return ViewerContextModule.resolveDiffRendererViewerContext(root, OwnerHelpersModule, preparedCardState);
        }
    } catch (e: any) { /* fallback to local resolution */ }
    let localPlayerKey: any = null;
    let isNetworkMode = false;
    let isSpectator = false;
    try {
        const directKeys = [root && root.LOCAL_PLAYER_KEY, root && root.__LOCAL_PLAYER_KEY, root && root.BOARD_VIEWER_KEY];
        for (const key of directKeys) {
            if (key === 'white' || key === 'black') {
                localPlayerKey = key;
                break;
            }
        }
    } catch (e: any) { localPlayerKey = null; }
    try {
        isNetworkMode = !!(
            root &&
            (
                (typeof root.getCurrentMatchMode === 'function' && root.getCurrentMatchMode() === 'network') ||
                root.MATCH_MODE === 'network'
            )
        );
    } catch (e: any) { isNetworkMode = false; }
    try {
        isSpectator = !!(
            root
            && root.NetworkMatchClient
            && typeof root.NetworkMatchClient.isSpectator === 'function'
            && root.NetworkMatchClient.isSpectator() === true
        );
    } catch (e: any) { isSpectator = false; }
    return {
        seatKey: null,
        localPlayerKey,
        isNetworkMode,
        isSpectator,
        debugHumanVsHuman: !!(root && root.DEBUG_HUMAN_VS_HUMAN === true)
    };
}

function _resolveNetworkLocalPlayerKeyForDiff(preparedViewerContext?: any) {
    const viewerContext = preparedViewerContext || _resolveViewerContextForDiff();
    if (viewerContext.localPlayerKey === 'white' || viewerContext.localPlayerKey === 'black') {
        return viewerContext.localPlayerKey;
    }
    if (viewerContext.seatKey === 'white' || viewerContext.seatKey === 'black') {
        return viewerContext.seatKey;
    }
    return 'black';
}

function _canLocalPlayerControlCurrentTurnForDiff(
    preparedGameState?: any,
    preparedCardState?: any,
    preparedViewerContext?: any
) {
    const gameStateValue = preparedGameState || _resolveGameStateForDiffRender();
    const cardStateValue = preparedCardState || _resolveCardStateForDiffRender();
    const viewerContext = preparedViewerContext || _resolveViewerContextForDiff();
    if (viewerContext && viewerContext.isSpectator === true) return false;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveNetworkInputPermissions === 'function') {
            return OwnerHelpersModule.resolveNetworkInputPermissions({
                rootRef: typeof window !== 'undefined' ? window : null,
                cardState: cardStateValue,
                gameState: gameStateValue,
                currentPlayer: gameStateValue && gameStateValue.currentPlayer,
                localPlayerKey: _resolveNetworkLocalPlayerKeyForDiff(viewerContext),
                debugHumanVsHuman: viewerContext.debugHumanVsHuman === true
            }).canOperateBoard === true;
        }
    } catch (e: any) { /* fallback to legacy local checks */ }
    const isNetworkMode = viewerContext.isNetworkMode === true;
    const currentPlayerKey = gameStateValue
        && gameStateValue.currentPlayer === _getBoardValueConstantsForDiff().WHITE
        ? 'white'
        : 'black';
    const isHvH = viewerContext.debugHumanVsHuman === true;
    if (isNetworkMode || !isHvH) {
        const fwc = cardStateValue && cardStateValue.fateWillControllerByTurnOwner;
        const controller = fwc && fwc[currentPlayerKey];
        if (controller) {
            const localPlayerKey = _resolveNetworkLocalPlayerKeyForDiff(viewerContext);
            return controller === localPlayerKey;
        }
    }
    if (!isNetworkMode) return true;
    const localPlayerKey = _resolveNetworkLocalPlayerKeyForDiff(viewerContext);
    return currentPlayerKey === localPlayerKey;
}

function _createSpecialStoneStatusSnapshotForDiff(input: any, options: any) {
    const snapshotModule = _getStoneStatusSnapshotForDiff();
    if (snapshotModule && typeof snapshotModule.createSpecialStoneStatusSnapshot === 'function') {
        return snapshotModule.createSpecialStoneStatusSnapshot(input, options);
    }
    return null;
}

function _shouldShowFlipProtectionBadgeForDiff(input: any) {
    const snapshot = _createSpecialStoneStatusSnapshotForDiff(input, { mode: 'raw' });
    return !!(snapshot && snapshot.hasFlipProtection);
}

function _createFlipProtectionBadgeForDiff(markerRenderer: any) {
    if (markerRenderer && typeof markerRenderer.createFlipProtectionBadge === 'function') {
        return markerRenderer.createFlipProtectionBadge();
    }
    if (typeof document === 'undefined') return null;
    const badge = document.createElement('div');
    badge.className = 'stone-flip-protection-badge';
    badge.textContent = '反';
    badge.setAttribute('aria-hidden', 'true');
    return badge;
}

function _normalizeBoardCoord(value: any) {
    const num = Number(value);
    return Number.isInteger(num) ? num : null;
}

function _hasHyperactiveLikeStateForDiff(state: any) {
    if (!state || typeof state !== 'object') return false;
    const specialSnapshot = _createSpecialStoneStatusSnapshotForDiff({
        type: state.special && state.special.type,
        remainingOwnerTurns: state.special && state.special.remainingOwnerTurns,
        regenRemaining: state.special && state.special.regenRemaining,
        flipEvadeRemaining: state.special && state.special.flipEvadeRemaining,
        destroyEvadeRemaining: state.special && state.special.destroyEvadeRemaining,
        hasGuard: !!state.guard
    }, { mode: 'raw' });
    return !!(specialSnapshot && specialSnapshot.hasMobility);
}

function attachBoardCellInteraction(cell: any, row: any, col: any) {
    if (!DiffRendererInteractionBinder || typeof DiffRendererInteractionBinder.bindBoardCellInteraction !== 'function') {
        throw new Error('[DiffRenderer] interaction binder capability unavailable');
    }
    return DiffRendererInteractionBinder.bindBoardCellInteraction({
        showIdleStoneInfoPanel: StoneInfoPresentationCapabilities.showIdleStoneInfoPanel,
        getInputController: () => {
            const getBoardInputController = _getBoardRendererHelperForDiff('getBoardInputController');
            if (typeof getBoardInputController !== 'function') {
                throw new Error('[DiffRenderer] BoardRenderer.getBoardInputController unavailable');
            }
            return getBoardInputController();
        }
    }, cell, row, col);
}

function getBoardInputPresentationCapabilities() {
    return Object.freeze({
        ...StoneInfoPresentationCapabilities,
        setHoveredCell: _setSuperAttractionHoverPreview,
        clearHoveredCell: _clearSuperAttractionHoverPreview
    });
}
/**
* 盤面を初期化（最初の1回のみ全レンダリング）
 * Initialize board with full rendering (first time only)
 * @param {HTMLElement} boardEl - 盤面要素
 */
function _getBoardMaterializationSignatureForDiff(boardRenderModel?: any, viewportLayout?: any): string {
    if (!boardRenderModel || !boardRenderModel.topology || !Array.isArray(boardRenderModel.cells)) {
        return ':topology:missing';
    }
    const topology = boardRenderModel.topology;
    const sortedKeyToken = (values: any): string => (
        Array.isArray(values)
            ? values.map((value: any) => String(value || '')).sort().join('|')
            : ''
    );
    const expansionSideToken = boardRenderModel.cells
        .filter((cell: any) => cell && cell.expansionSide)
        .map((cell: any) => `${String(cell.key || `${cell.row},${cell.col}`)}=${String(cell.expansionSide)}`)
        .sort()
        .join('|');
    // Hole/playable changes patch an existing cell; they do not change which
    // DOM cells are materialized. Keeping them out also preserves transient
    // highlight ownership stored on the cell across causal-replay restores.
    const topologySignature = [
        ':topology',
        String(topology.baseShape || ''),
        `${Number(topology.baseRows)},${Number(topology.baseCols)}`,
        `${Number(topology.minRow)},${Number(topology.maxRow)},${Number(topology.minCol)},${Number(topology.maxCol)}`,
        `${Number(topology.renderRowOffset)},${Number(topology.renderColOffset)},${Number(topology.renderRows)},${Number(topology.renderCols)}`,
        `base=${sortedKeyToken(topology.baseKeys)}`,
        `existing=${sortedKeyToken(topology.existingKeys)}`,
        `expansionSides=${expansionSideToken}`
    ].join(':');
    if (!viewportLayout || !viewportLayout.visibleWorldWindow) return topologySignature;
    try {
        const BoardVisualModel = _require('../board-visual/model');
        const materializedWindow = BoardVisualModel.getBoardViewportMaterializationWindow({
            model: boardRenderModel,
            visibleWindow: viewportLayout.visibleWorldWindow,
            overscanCells: 1,
            effectGutterCells: 2
        });
        if (!materializedWindow) return `${topologySignature}:viewport:empty`;
        return `${topologySignature}:viewport:${materializedWindow.minRow},${materializedWindow.maxRow},${materializedWindow.minCol},${materializedWindow.maxCol}`;
    } catch (e: any) {
        return `${topologySignature}:viewport:invalid`;
    }
}

function initializeBoardDOM(boardEl: any, boardRenderModel?: any, viewportLayout?: any) {
    if (!boardRenderModel || !boardRenderModel.topology || !Array.isArray(boardRenderModel.cells)) {
        throw new Error('[BoardDomCompat] initializeBoardDOM requires a complete BoardRenderModel');
    }
    const gameState = _resolveGameStateForDiffRender();
    _applyBoardCssVarsForDiff(boardEl, gameState);
    const boardShape = _getBoardShapeForDiff(gameState);
    const expansions: any[] = boardRenderModel.cells
        .filter((cell: any) => cell && cell.expansionSide)
        .map((cell: any) => ({
            row: cell.row,
            col: cell.col,
            side: cell.expansionSide
        }));
    const expansionLayer = _resolveBoardExpansionLayerForDiff(boardEl, true);
    boardEl.innerHTML = '';
    if (expansionLayer) expansionLayer.innerHTML = '';
    cellCache = [];
    cellCacheMap = new Map();
    let hasVoidCells = false;

    boardEl.classList.toggle('board-square-regular', _isSquareRectangularBoardForDiff(gameState));
    boardEl.classList.toggle(
        'board-standard-8x8',
        _isSquareRectangularBoardForDiff(gameState) && boardShape.rows === 8 && boardShape.cols === 8
    );

    boardEl.classList.remove('board-expanded-left', 'board-expanded-right', 'board-expanded-top', 'board-expanded-bottom');
    if (expansions.some((exp: any) => exp && exp.side === 'left')) boardEl.classList.add('board-expanded-left');
    if (expansions.some((exp: any) => exp && exp.side === 'right')) boardEl.classList.add('board-expanded-right');
    if (expansions.some((exp: any) => exp && exp.side === 'top')) boardEl.classList.add('board-expanded-top');
    if (expansions.some((exp: any) => exp && exp.side === 'bottom')) boardEl.classList.add('board-expanded-bottom');

    const BoardVisualModel = _require('../board-visual/model');
    const renderCells: any[] = Array.from(BoardVisualModel.materializeBoardViewport({
        model: boardRenderModel,
        visibleWindow: viewportLayout && viewportLayout.visibleWorldWindow
            ? viewportLayout.visibleWorldWindow
            : {
                minRow: boardRenderModel.topology.minRow,
                maxRow: boardRenderModel.topology.maxRow,
                minCol: boardRenderModel.topology.minCol,
                maxCol: boardRenderModel.topology.maxCol
            },
        overscanCells: viewportLayout && viewportLayout.visibleWorldWindow ? 1 : 0,
        effectGutterCells: viewportLayout && viewportLayout.visibleWorldWindow ? 2 : 0
    })) as any[];

    for (const renderedCell of renderCells) {
            const r = renderedCell.row;
            const c = renderedCell.col;
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = String(r);
            cell.dataset.col = String(c);
            _applyBoardGridPositionForDiff(cell, r, c, gameState);
            const key = `${r},${c}`;
            const exists = renderedCell.kind !== 'void';
            if (!exists) {
                hasVoidCells = true;
                cell.classList.add('cell-void');
                cell.setAttribute('aria-hidden', 'true');
                boardEl.appendChild(cell);
                continue;
            }
            if (renderedCell.expansionSide) {
                const expansion = expansions.find((desc: any) => desc && desc.row === r && desc.col === c);
                cell.classList.add('cell-expanded');
                if (expansion && expansion.side) cell.classList.add(`cell-expanded-${expansion.side}`);
            }
            _applyBoardEdgeClassesForDiff(cell, r, c, boardShape);
            _applyBoardContourEdgeClassesForDiff(cell, r, c, gameState);
            attachBoardCellInteraction(cell, r, c);
            boardEl.appendChild(cell);
            _cacheCell(r, c, cell);
    }

    // DOM compatibility owns only the materialized board surface. The shared
    // frame presenter owns #board-frame skin/layout and base-shape policy.
    boardEl.classList.toggle('board-has-void-cells', hasVoidCells);

    boardDomSignature = _getBoardDomSignatureForDiff(gameState)
        + _getBoardMaterializationSignatureForDiff(boardRenderModel, viewportLayout);

    previousBoardState = null;
    if (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true) {
        console.log('[DiffRenderer] Board DOM initialized with cell cache');
    }
}


function createBoardRenderInputs(presentationOverlayState?: unknown, baseVisualStateOverride?: any) {
    const BoardVisualModel = _require('../board-visual/model');
    const override = baseVisualStateOverride && typeof baseVisualStateOverride === 'object'
        && baseVisualStateOverride.gameState && typeof baseVisualStateOverride.gameState === 'object'
        && baseVisualStateOverride.cardState && typeof baseVisualStateOverride.cardState === 'object'
        ? baseVisualStateOverride
        : null;
    const visualPair = override || _resolveVisualRenderPairForDiff();
    const viewerContext = _resolveViewerContextForDiff(visualPair.cardState);
    return Object.freeze({
        baseVisualState: Object.freeze({
            gameState: visualPair.gameState,
            cardState: visualPair.cardState,
            inputEpoch: _resolveNetworkVisualInputEpochForDiff(
                visualPair,
                viewerContext
            ),
            viewerContext: Object.freeze({ ...viewerContext }),
            canControlCurrentTurn: _canLocalPlayerControlCurrentTurnForDiff(
                visualPair.gameState,
                visualPair.cardState,
                viewerContext
            )
        }),
        presentationOverlayState: BoardVisualModel.validateBoardPresentationOverlayState(presentationOverlayState)
    });
}

function createBoardPresentationOverlayState(renderProjection: any, cellState: any, initialOverlay?: unknown) {
    const BoardVisualModel = _require('../board-visual/model');
    const base = BoardVisualModel.validateBoardPresentationOverlayState(initialOverlay);
    const previewHints = Array.from(base.previewHints || []);
    const previewCellKeys = new Set(base.previewCellKeys || []);
    const selectedCellKeys = new Set(base.selectedCellKeys || []);
    const directionHints = Array.from(base.directionHints || []);
    const collect = (cell: any, row: number, col: number) => {
        if (!cell) return;
        const cellKey = `${row},${col}`;
        const addPreview = (kind: string, active: boolean) => {
            if (!active) return;
            previewCellKeys.add(cellKey);
            previewHints.push({ cellKey, kind });
        };
        addPreview('random-spawn', cell.isRandomSpawnPreview === true);
        addPreview('selected-target', cell.isSelectedTargetHighlighted === true);
        addPreview('super-attraction-path', cell.isSuperAttractionPathPreview === true);
        addPreview('super-attraction-destination', cell.isSuperAttractionPreviewDestination === true);
        if (cell.isSelectedTargetHighlighted === true) selectedCellKeys.add(cellKey);
    };
    const shape = _getStateBoardShapeForDiff(cellState);
    for (let row = 0; row < shape.rows; row += 1) {
        for (let col = 0; col < shape.cols; col += 1) collect(cellState && cellState[row] && cellState[row][col], row, col);
    }
    for (const expansion of _getExpansionStateListForDiff(cellState)) {
        collect(expansion, expansion.row, expansion.col);
    }
    const hintProjection = renderProjection && renderProjection.hintProjection && typeof renderProjection.hintProjection === 'object'
        ? renderProjection.hintProjection
        : {};
    const collectDirectionHints = (mapValue: any, kind: string) => {
        if (!(mapValue instanceof Map)) return;
        for (const [cellKey, rawDirections] of mapValue.entries()) {
            const directions = (Array.isArray(rawDirections) ? rawDirections : [rawDirections])
                .map((value: any) => String(value || '').trim())
                .filter((value: string) => !!value);
            for (const directionKey of directions) {
                directionHints.push({
                    id: `${kind}:${String(cellKey)}:${directionKey}`,
                    cellKey: String(cellKey),
                    directionKey,
                    kind
                });
            }
        }
    };
    const expansionKind = String(renderProjection && renderProjection.pending && renderProjection.pending.type || '').toUpperCase() === 'BOARD_EXPANSION_WILL'
        ? 'board-expansion-will'
        : 'board-expansion-god';
    collectDirectionHints(hintProjection.boardExpansionDirectionHintMap, expansionKind);
    collectDirectionHints(hintProjection.boardShrinkWillDirectionHintMap, 'board-shrink-will');
    collectDirectionHints(hintProjection.boardShrinkGodDirectionHintMap, 'board-shrink-god');
    const hoverTarget = superAttractionHoverPreview && superAttractionHoverPreview.target;
    const hoveredCellKey = hoverTarget && Number.isInteger(hoverTarget.row) && Number.isInteger(hoverTarget.col)
        ? `${hoverTarget.row},${hoverTarget.col}`
        : base.hoveredCellKey;
    const interactionLocked = base.interactionLocked === true || !!(
        PlaybackStateModule
        && typeof PlaybackStateModule.shouldDeferBoardUpdate === 'function'
        && PlaybackStateModule.shouldDeferBoardUpdate({ cardState: renderProjection && renderProjection.cardState }) === true
    );
    return BoardVisualModel.validateBoardPresentationOverlayState({
        ...base,
        hoveredCellKey,
        previewCellKeys: Array.from(previewCellKeys),
        previewHints,
        selectedCellKeys: Array.from(selectedCellKeys),
        directionHints,
        interactionLocked
    });
}

function _createCellStateProjectorContextForDiff(inputs?: any) {
    const base = inputs && inputs.baseVisualState && typeof inputs.baseVisualState === 'object'
        ? inputs.baseVisualState
        : null;
    const constants = _getBoardValueConstantsForDiff();
    return {
        state: {
            resolveGameState: base ? () => base.gameState : _resolveGameStateForDiffRender,
            resolveCardState: base ? () => base.cardState : _resolveCardStateForDiffRender,
            resolveInputEpoch: base ? () => base.inputEpoch : () => null,
            getBoardShape: _getBoardShapeForDiff,
            buildEmptyCellState: _buildEmptyCellStateForDiffRender,
            cardLogic: (typeof CardLogic !== 'undefined' ? CardLogic : undefined),
            getPlayerKey: _getPlayerKeyForDiff,
            resolveViewerContext: base && base.viewerContext
                ? () => base.viewerContext
                : _resolveViewerContextForDiff,
            normalizeViewerContext: (value: any) => (
                ViewerContextModule && typeof ViewerContextModule.toBoardViewerContext === 'function'
                    ? ViewerContextModule.toBoardViewerContext(value)
                    : (value === 'white' || value === 'spectator' ? value : 'black')
            ),
            canLocalPlayerControlCurrentTurn: base && typeof base.canControlCurrentTurn === 'boolean'
                ? () => base.canControlCurrentTurn
                : () => _canLocalPlayerControlCurrentTurnForDiff(
                    base && base.gameState,
                    base && base.cardState,
                    base && base.viewerContext
                ),
            resolveBoardConfig: _resolveBoardConfigForDiff,
            createBoardView: (gameStateValue: any, options?: any) => _createBoardViewForDiff(
                gameStateValue,
                base ? base.cardState : options && options.cardState
            ),
            constants
        },
        hints: {
            buildBoardHintProjection: _buildBoardHintProjectionForDiff,
            getActiveSuperAttractionPreview: _getActiveSuperAttractionPreviewForDiff,
            collectSuperAttractionPreviewKeys: _collectSuperAttractionPreviewKeys
        },
        markers: {
            adapter: (typeof MarkersAdapter !== 'undefined' ? MarkersAdapter : undefined),
            isReversiMode: _isReversiModeForDiffRenderer,
            isBombCategory: _isBombCategoryMarkerForDiff,
            isBoardHiddenTrap: _isBoardHiddenTrap,
            isActiveManifestAura: _isActiveManifestAuraMarkerForDiff,
            isManifestStoneType: _isManifestStoneTypeForDiff,
            resolveSpecialDisplayTurns: _resolveSpecialDisplayTurnsForDiff,
            isFiniteTimedLabelValue: _isFiniteTimedLabelValueForDiff,
            resolveFlipEvadeDisplay: _resolveFlipEvadeDisplayForDiff,
            resolveDestroyEvadeDisplay: _resolveDestroyEvadeDisplayForDiff
        },
        debug: {
            isDebugWorkVisuals: () => (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true),
            isDebugHumanVsHuman: () => (typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN),
            warn: (...args: any[]) => console.warn(...args),
            log: (...args: any[]) => console.log(...args)
        }
    };
}

/**
 * 現在のゲーム状態からセル状態を構築
 * Build cell state from current game state
 * @returns {Array<Array<CellState>>} 8x8セル状態配列
 */
function createBoardRenderProjection(operationCounters?: any, inputs?: any) {
    return DiffRendererProjector.createBoardRenderProjection(_createCellStateProjectorContextForDiff(inputs), operationCounters);
}

function buildCurrentCellState(renderProjection?: any, inputs?: any) {
    return DiffRendererProjector.buildCurrentCellState(_createCellStateProjectorContextForDiff(inputs), renderProjection);
}

function buildBoardRenderModel(renderProjection?: any, cellState?: any, options?: any) {
    return DiffRendererProjector.buildBoardRenderModel(
        _createCellStateProjectorContextForDiff(options && options.inputs),
        renderProjection,
        cellState,
        options
    );
}

function _createCellDomPatcherContextForDiff() {
    const constants = _getBoardValueConstantsForDiff();
    return {
        board: {
            getBoardShape: _getBoardShapeForDiff,
            resolveGameState: _resolveGameStateForDiffRender,
            isExpansionCoordinate: _isExpansionCoordinateForDiff,
            isExpansionCell: _isExpansionCellForDiff,
            resolveExpansionSide: _resolveExpansionSideForDiff,
            applyBoardGridPosition: _applyBoardGridPositionForDiff,
            applyBoardEdgeClasses: _applyBoardEdgeClassesForDiff,
            applyBoardContourEdgeClasses: _applyBoardContourEdgeClassesForDiff,
            applyTimeStopLegalEmphasis: _applyTimeStopLegalEmphasisForDiff,
            constants: { EMPTY: constants.EMPTY }
        },
        playback: {
            isVisualPlaybackActive: _isVisualPlaybackActiveForDiff,
            hasPendingMoveSourceAt: _hasPendingMoveSourceAtForDiff,
            hasHyperactiveLikeState: _hasHyperactiveLikeStateForDiff,
            tryPatchTimedMarkerLabels: _tryPatchTimedMarkerLabelsForDiff,
            suppressFallbackFlip: suppressFallbackFlipThisRender,
            hasPendingFlipTargetAt: _hasPendingFlipTargetAtForDiff,
            hasRecentPlaybackFlipMarker: _hasRecentPlaybackFlipMarkerForDiff
        },
        runtime: {
            animationShared: AnimationShared,
            window: (typeof window !== 'undefined' ? window : undefined),
            location: (typeof location !== 'undefined' ? location : undefined),
            sharedConstants: (typeof SharedConstants !== 'undefined' ? SharedConstants : undefined),
            timerRegistry: (typeof TimerRegistry !== 'undefined' ? TimerRegistry : undefined),
            boardUpdateDispatch: (typeof BoardUpdateDispatch !== 'undefined' ? BoardUpdateDispatch : undefined),
            emitBoardUpdate: (typeof emitBoardUpdate === 'function' ? emitBoardUpdate : undefined),
            document: (typeof document !== 'undefined' ? document : undefined)
        },
        markers: {
            createSpecialMarkerRenderer: _createSpecialMarkerRendererForDiff
        },
        stones: {
            constants: { BLACK: constants.BLACK, WHITE: constants.WHITE },
            getDiscStoneHelper: _getBoardRendererHelperForDiff,
            createSpecialStoneStatusSnapshot: _createSpecialStoneStatusSnapshotForDiff,
            shouldShowFlipProtectionBadge: _shouldShowFlipProtectionBadgeForDiff,
            createFlipProtectionBadge: _createFlipProtectionBadgeForDiff,
            getEffectKeyForType,
            applyStoneVisualEffect: (typeof applyStoneVisualEffect === 'function' ? applyStoneVisualEffect : undefined),
            applyTrapStoneFallbackVisual: (typeof applyTrapStoneFallbackVisual === 'function' ? applyTrapStoneFallbackVisual : undefined),
            resolveSpecialDisplayTurns: _resolveSpecialDisplayTurnsForDiff,
            applyDoubleDigitTimerClass: _applyDoubleDigitTimerClassForDiff,
            getManifestAuraOwnerClass: _getManifestAuraOwnerClassForDiff
        }
    };
}

function updateCellDOM(cell: any, state: any, row: any, col: any, prevState: any) {
    return DiffRendererDomPatcher.updateCellDOM(_createCellDomPatcherContextForDiff(), cell, state, row, col, prevState);
}

/**
 * Map special stone type to visual effect key
 * @param {string} type - Special stone type
 * @returns {string|null} Effect key for applyStoneVisualEffect
 */
function getEffectKeyForType(type: any) {
    // Delegate to the canonical map in visual-effects-map.js when available.
    if (typeof getEffectKeyForSpecialType === 'function') {
        return getEffectKeyForSpecialType(type);
    }
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
}

function reconcileCellHasDiscClasses(boardEl: any) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('reconcileCellHasDiscClasses');
    try {
        if (!boardEl) return;
        const cells = _getRenderedCellsForDiff(boardEl);
        cells.forEach((cell: any) => {
            try {
                const hasDisc = !!cell.querySelector('.disc');
                if (hasDisc) cell.classList.add('has-disc');
                else cell.classList.remove('has-disc');
            } catch (e: any) { /* ignore */ }
        });
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('reconcileCellHasDiscClasses');
    }
}

function canShowSelectableFriendlyForState(state: any): boolean {
    if (!state || !state.isSelectableFriendly || state.frozen) return false;
    if (!state.blockade) return true;
    return String(state.blockade.type || '').toUpperCase() === 'METEOR_HOLE';
}

const TRANSIENT_CELL_HIGHLIGHT_CLASSES_FOR_DIFF = Object.freeze([
    'effect-target-highlight',
    'effect-target-highlight-positive',
    'effect-target-highlight-placement'
]);

function getActiveTransientCellHighlightClassForDiff(cell: any): string | null {
    const value = String(
        cell &&
        cell.dataset &&
        cell.dataset.transientCellHighlightClass ||
        ''
    ).trim();
    return TRANSIENT_CELL_HIGHLIGHT_CLASSES_FOR_DIFF.indexOf(value) >= 0 ? value : null;
}

function applyActiveTransientCellHighlightForDiff(cell: any): void {
    const className = getActiveTransientCellHighlightClassForDiff(cell);
    if (!className || !cell || !cell.classList) return;
    cell.classList.add(className);
}

function reconcileCellHintClasses(boardEl: any, currentState: any) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('reconcileCellHintClasses');
    try {
        if (!boardEl || !currentState || typeof currentState !== 'object') return;
        const boardShape = _getStateBoardShapeForDiff(currentState);
        const expansionStateMap = new Map(
            _getExpansionStateListForDiff(currentState)
                .filter(Boolean)
                .map((exp: any) => [`${exp.row},${exp.col}`, exp])
        );
        const cells = _getRenderedCellsForDiff(boardEl);
        cells.forEach((cell: any) => {
            try {
                if (cell.classList && cell.classList.contains('cell-void')) return;
                const row = Number(cell && cell.dataset ? cell.dataset.row : NaN);
                const col = Number(cell && cell.dataset ? cell.dataset.col : NaN);
                if (!Number.isInteger(row) || !Number.isInteger(col)) return;
                const state = expansionStateMap.get(`${row},${col}`)
                    || ((row >= 0 && row < boardShape.rows && col >= 0 && col < boardShape.cols)
                        ? currentState[row][col]
                        : null);
                const canShowHint = !!(state && !state.blockade && !state.frozen);
                const shouldShowLegalFree = !!(canShowHint && state && state.isLegalFree);
                const shouldShowLegal = !!(canShowHint && state && state.isLegal && !shouldShowLegalFree);
                const shouldShowTabooLegal = !!(canShowHint && state && state.isTabooLegal);
                const shouldShowRandomSpawnPreview = !!(canShowHint && state && state.isRandomSpawnPreview);
                const shouldShowSelectedTargetHighlight = !!(state && state.isSelectedTargetHighlighted);
                const shouldShowSuperAttractionPathPreview = !!(state && state.isSuperAttractionPathPreview);
                const shouldShowSuperAttractionPreviewDestination = !!(state && state.isSuperAttractionPreviewDestination);
                const shouldShowSelectable = canShowSelectableFriendlyForState(state);
                const shouldShowExtendLifeTarget = !!(canShowHint && state && state.isExtendLifeTarget);
                const shouldShowKeyboardCursor = !!(state && state.isKeyboardCursor);
                const transientHighlightClass = getActiveTransientCellHighlightClassForDiff(cell);
                const shouldRaiseRegenBadge = !!(
                    state &&
                    state.special &&
                    String(state.special.type || '').toUpperCase() === 'REGEN' &&
                    Number.isFinite(Number(state.special.regenRemaining))
                );

                cell.classList.toggle('legal-free', shouldShowLegalFree);
                cell.classList.toggle('legal', shouldShowLegal);
                cell.classList.toggle('effect-target-highlight', transientHighlightClass === 'effect-target-highlight');
                cell.classList.toggle('effect-target-highlight-positive', shouldShowSelectedTargetHighlight || shouldShowTabooLegal || transientHighlightClass === 'effect-target-highlight-positive');
                cell.classList.toggle('effect-target-highlight-placement', transientHighlightClass === 'effect-target-highlight-placement');
                cell.classList.toggle('random-spawn-preview', shouldShowRandomSpawnPreview);
                cell.classList.toggle('super-attraction-path-preview', shouldShowSuperAttractionPathPreview);
                cell.classList.toggle('super-attraction-preview-destination', shouldShowSuperAttractionPreviewDestination);
                cell.classList.toggle('selectable-friendly', shouldShowSelectable);
                cell.classList.toggle('selectable-friendly-no-circle', shouldShowExtendLifeTarget);
                cell.classList.toggle('keyboard-legal-cursor', shouldShowKeyboardCursor);
                cell.classList.toggle('has-regen-badge', shouldRaiseRegenBadge);
                _applyTimeStopLegalEmphasisForDiff(cell);
            } catch (e: any) { /* ignore */ }
        });
    } finally {
        if (PerfBenchmarks) PerfBenchmarks.perfEnd('reconcileCellHintClasses');
    }
}

function _syncSelectionModeForDiff(boardEl: any, renderProjection?: any) {
    if (!boardEl || !boardEl.classList) return;
    try {
        const projection = renderProjection || createBoardRenderProjection();
        const isSelectingTarget = !!(projection && projection.hintProjection && projection.hintProjection.isSelectingTarget === true);
        boardEl.classList.toggle('selection-mode', isSelectingTarget);
    } catch (e: any) {
        boardEl.classList.remove('selection-mode');
    }
}

/**
 * 差分レンダリング実行
 * Execute differential rendering
 * @param {HTMLElement} boardEl - 盤面要素
 * @returns {number} 更新されたセル数
 */
function renderBoardDiff(
    boardEl: any,
    preparedRenderProjection?: any,
    preparedCellState?: any,
    preparedBoardRenderModel?: any,
    options?: { authorizedByBoardVisualController?: boolean; viewportLayout?: any }
) {
    if (PerfBenchmarks) PerfBenchmarks.perfStart('renderBoardDiff');
    // PR1 summary accumulators live in function scope so the outer finally
    // can emit them. The inner try/finally below still mutates these via the
    // _measureUpdateCellDOM wrapper. updatedCount is reset to 0 inside the
    // initial/diff render branches; it stays null on early returns.
    let updatedCount: number | null = null;
    let updateCellDOMCount = 0;
    let updateCellDOMDurationMs = 0;
    // PR1.5: gating. OFF path falls through to a bare updateCellDOM with no
    // performance.now() and no counter increment, so the instrumentation
    // does not touch the normal play path.
    const _measureUpdateCellDOM = (cell: any, state: any, row: any, col: any, prevState: any) => {
        const _perfOn = !!(PerfBenchmarks && typeof PerfBenchmarks.isPerfBenchEnabled === 'function' && PerfBenchmarks.isPerfBenchEnabled());
        if (!_perfOn) {
            updateCellDOM(cell, state, row, col, prevState);
            return;
        }
        const _t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
        updateCellDOM(cell, state, row, col, prevState);
        const _t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
        updateCellDOMCount++;
        updateCellDOMDurationMs += _t1 - _t0;
    };
    const renderProjection = preparedRenderProjection || createBoardRenderProjection();
    const previousPreparedVisualState = activePreparedVisualStateForDiff;
    activePreparedVisualStateForDiff = renderProjection && renderProjection.valid === true
        ? {
            gameState: renderProjection.gameState,
            cardState: renderProjection.cardState,
            stateVersion: renderProjection.inputEpochSource?.stateVersion
        }
        : null;
    try {
    if (boardEl && boardDomElement && boardDomElement !== boardEl) {
        previousBoardState = null;
        cellCache = [];
        cellCacheMap = new Map();
        boardDomSignature = null;
    }
    if (boardEl) boardDomElement = boardEl;
    // Single Visual Writer detection: prevent diff/rerender during active playback
    const shouldDeferBoardUpdate = !!(
        PlaybackStateModule
        && typeof PlaybackStateModule.shouldDeferBoardUpdate === 'function'
        && PlaybackStateModule.shouldDeferBoardUpdate({ cardState: _getCardStateForDiffPlayback() }) === true
    );
    const hasPendingPlaybackEvents = _hasPendingPlaybackEvents();
    const hasClaimedVisualPlayback = _hasClaimedVisualPlaybackForDiff();
    const visualPlaybackActive = _isVisualPlaybackActiveForDiff();
    const boardHasPlaybackLock = !!(boardEl && boardEl.classList && boardEl.classList.contains('playback-locked'));
    if (
        options?.authorizedByBoardVisualController !== true
        && (hasPendingPlaybackEvents || hasClaimedVisualPlayback || (visualPlaybackActive && boardHasPlaybackLock))
        && shouldDeferBoardUpdate
    ) {
        if (typeof window !== 'undefined' && window.__DEV__ === true) {
            throw new Error('renderBoardDiff called during active VisualPlayback (dev fail-fast)');
        } else {
            // Do not abort playback here; aborting causes animations to disappear mid-sequence.
            // Instead, skip this render. AnimationEngine requests a final emitBoardUpdate after playback ends.
            _preservePendingPlaybackDiffContextForFinalSync();
            console.warn('renderBoardDiff called during active VisualPlayback. Skipping diff render until playback ends.');
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.singleVisualWriterHits = (window.__telemetry__.singleVisualWriterHits || 0) + 1; }
            return 0;
        }
    }
    if (!boardEl) return 0;
    const resolvedCellState = preparedCellState || buildCurrentCellState(renderProjection);
    const resolvedBoardRenderModel = preparedBoardRenderModel || buildBoardRenderModel(
        renderProjection,
        resolvedCellState,
        {
            overlay: createBoardPresentationOverlayState(
                renderProjection,
                resolvedCellState
            )
        }
    );
    _syncSelectionModeForDiff(boardEl, renderProjection);

    // One-shot suppression set by AnimationEngine at the end of playback.
    // This prevents DiffRenderer from replaying the fallback ".flip" when syncing the final board state.
    _consumeBoardUpdateSyncContextForDiff();
    const boardUpdateContext = _consumeBoardUpdateContextForDiff();
    suppressFallbackFlipThisRender = !!(boardUpdateContext && boardUpdateContext.suppressFallbackFlip === true);
    suppressBoardExpansionRevealSoundThisRender = !!(boardUpdateContext && boardUpdateContext.suppressBoardExpansionRevealSound === true);
    pendingMoveSourceKeysThisRender = _mergeBoardUpdateContextKeySetsForDiff(
        _normalizeBoardUpdateContextKeySetForDiff(boardUpdateContext && boardUpdateContext.pendingMoveSourceKeys),
        _collectPendingMoveSourceKeysForDiff()
    );
    pendingFlipTargetKeysThisRender = _mergeBoardUpdateContextKeySetsForDiff(
        _normalizeBoardUpdateContextKeySetForDiff(boardUpdateContext && boardUpdateContext.pendingFlipTargetKeys),
        _collectPendingFlipTargetKeysForDiff()
    );

    try {
        const gameState = _resolveGameStateForDiffRender();
        const nextSignature = _getBoardDomSignatureForDiff(gameState)
            + _getBoardMaterializationSignatureForDiff(resolvedBoardRenderModel, options && options.viewportLayout);
        // 初回またはキャッシュが空の場合は全レンダリング
        if (!cellCacheMap.size || boardDomSignature !== nextSignature) {
            const nextExpansions = _getExpansionDescriptorsForDiff(gameState);
            const revealExpansionKeys = _getExpansionRevealKeysForDiff(
                previousBoardState,
                nextExpansions,
                !!cellCacheMap.size && boardDomSignature !== null
            );
            initializeBoardDOM(boardEl, resolvedBoardRenderModel, options && options.viewportLayout);
            previousBoardState = resolvedCellState;
            const initialBoardShape = _getStateBoardShapeForDiff(previousBoardState);
            // Initial full render
            for (let r = 0; r < initialBoardShape.rows; r++) {
                for (let c = 0; c < initialBoardShape.cols; c++) {
                    const cell = _getCachedCell(r, c);
                    if (cell) _measureUpdateCellDOM(cell, previousBoardState[r][c], r, c, null);
                }
            }
            const initialExpansions = _getExpansionStateListForDiff(previousBoardState);
            for (const exp of initialExpansions) {
                if (!exp) continue;
                const expCell = _getCachedCell(exp.row, exp.col);
                if (expCell) {
                    _measureUpdateCellDOM(expCell, exp, exp.row, exp.col, null);
                    if (revealExpansionKeys.has(`${exp.row},${exp.col}`)) {
                        expCell.classList.add('cell-expanded-reveal');
                    }
                }
            }
            reconcileCellHasDiscClasses(boardEl);
            reconcileCellHintClasses(boardEl, previousBoardState);
            _syncBoardShrinkGodDirectionHintsForDiff(boardEl, renderProjection);
            _scheduleBoardExpansionRevealSoundForDiff(revealExpansionKeys, nextSignature);
            if (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true) {
                console.log('[DiffRenderer] Initial full render complete');
            }
            return cellCacheMap.size;
        }

        const currentState = resolvedCellState;
        const currentBoardShape = _getStateBoardShapeForDiff(currentState);
        // updatedCount / updateCellDOMCount / updateCellDOMDurationMs are
        // declared at function scope above so the outer finally can emit them.
        updatedCount = 0;

        // 差分検出と更新
        for (let r = 0; r < currentBoardShape.rows; r++) {
            for (let c = 0; c < currentBoardShape.cols; c++) {
                const prev = previousBoardState ? previousBoardState[r][c] : null;
                const curr = currentState[r][c];

                if (!cellStatesEqual(prev, curr)) {
                    const cell = _getCachedCell(r, c);
                    if (cell) {
                        _measureUpdateCellDOM(cell, curr, r, c, prev);
                        updatedCount++;
                    }
                }
            }
        }

        const prevExpList = _getExpansionStateListForDiff(previousBoardState);
        const currExpList = _getExpansionStateListForDiff(currentState);
        const prevExpMap: Map<string, any> = new Map(prevExpList.filter(Boolean).map((exp: any) => [`${exp.row},${exp.col}`, exp]));
        const currExpMap: Map<string, any> = new Map(currExpList.filter(Boolean).map((exp: any) => [`${exp.row},${exp.col}`, exp]));
        const expansionKeys = new Set([...prevExpMap.keys(), ...currExpMap.keys()]);
        for (const key of expansionKeys) {
            const prevExp = prevExpMap.get(key) || null;
            const currExp = currExpMap.get(key) || null;
            if (!currExp) continue;
            if (!cellStatesEqual(prevExp, currExp)) {
                const cell = _getCachedCell(currExp.row, currExp.col);
                if (cell) {
                    _measureUpdateCellDOM(cell, currExp, currExp.row, currExp.col, prevExp);
                    updatedCount++;
                }
            }
        }

        previousBoardState = currentState;

        if (updatedCount > 0 && typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true) {
            console.log(`[DiffRenderer] Updated ${updatedCount}/${cellCacheMap.size} cells`);
        }

        reconcileCellHasDiscClasses(boardEl);
        reconcileCellHintClasses(boardEl, currentState);
        _syncBoardShrinkGodDirectionHintsForDiff(boardEl, renderProjection);

        return updatedCount;
    } finally {
        suppressFallbackFlipThisRender = false;
        suppressBoardExpansionRevealSoundThisRender = false;
        pendingMoveSourceKeysThisRender = null;
        pendingFlipTargetKeysThisRender = null;
    }
    } finally {
        activePreparedVisualStateForDiff = previousPreparedVisualState;
        // PR1.5: gating. Outer finally builds the summary detail object only
        // when the perf bench is enabled. OFF path: only perfEnd is called and
        // the helper itself early-returns without any allocation or work.
        const _perfOn = !!(PerfBenchmarks && typeof PerfBenchmarks.isPerfBenchEnabled === 'function' && PerfBenchmarks.isPerfBenchEnabled());
        if (PerfBenchmarks && _perfOn) {
            PerfBenchmarks.perfMarkOnly('renderBoardDiff.summary', {
                updatedCount: updatedCount,
                totalCells: typeof cellCacheMap !== 'undefined' && cellCacheMap && typeof cellCacheMap.size === 'number' ? cellCacheMap.size : null,
                updateCellDOMCount: updateCellDOMCount,
                updateCellDOMDurationMs: updateCellDOMDurationMs
            });
        }
        if (PerfBenchmarks) {
            PerfBenchmarks.perfEnd('renderBoardDiff');
        }
    }
}

/**
 * Compatibility facade for callers that still use the historical
 * `forceFullRender()` API. BoardRenderer owns the active controller and is
 * therefore the only legal entry point for a full board write.
 */
function forceFullRender(_boardEl?: any) {
    const renderBoardFull = _getBoardRendererHelperForDiff('renderBoardFull');
    if (typeof renderBoardFull !== 'function') {
        throw new Error('BoardRenderer.renderBoardFull is unavailable');
    }
    return renderBoardFull();
}

/**
 * レンダリング統計をリセット
 * Reset rendering statistics
 */
function resetRenderStats() {
    previousBoardState = null;
    cellCache = [];
    cellCacheMap = new Map();
    boardDomSignature = null;
    boardDomElement = null;
    lastBoardExpansionRevealSoundKey = null;
    superAttractionHoverPreview = null;
    _resetManifestWorldEffectsForDiff();
}

function _isReversiModeForDiffRenderer() {
    const root = (typeof window !== 'undefined')
        ? window
        : (typeof globalThis !== 'undefined' ? globalThis : null);
    try {
        if (root && typeof (root as any).getCurrentMatchMode === 'function') {
            const mode = (root as any).getCurrentMatchMode();
            if (mode === 'reversi' || mode === 'othello') return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (root && (((root as any).REVERSI_MODE_ACTIVE === true) || ((root as any).__REVERSI_MODE_ACTIVE === true))) {
            return true;
        }
    } catch (e) { /* ignore */ }
    try {
        if (root && (((root as any).OTHELLO_MODE_ACTIVE === true) || ((root as any).__OTHELLO_MODE_ACTIVE === true))) {
            return true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

// Export helpers for Node/Jest test harness
const DiffRenderer = {
    initializeBoardDOM,
    createBoardRenderInputs,
    createBoardPresentationOverlayState,
    buildCurrentCellState,
    buildBoardRenderModel,
    createBoardRenderProjection,
    createCommittedManifestPresentationState: CommittedWorldStateModule.createCommittedManifestPresentationState,
    presentCommittedWorldState: CommittedWorldStateModule.presentCommittedWorldState,
    renderBoardDiff,
    forceFullRender,
    resetRenderStats,
    attachBoardCellInteraction,
    getBoardInputPresentationCapabilities,
    showSpecialStoneInfoAt: StoneInfoPresentationCapabilities.showSpecialStoneInfoAt
};
export = DiffRenderer;
if (typeof window !== 'undefined') {
    window.forceFullRender = forceFullRender;
    window.resetRenderStats = resetRenderStats;
    window.attachBoardCellInteraction = attachBoardCellInteraction;
    window.showSpecialStoneInfoAt = StoneInfoPresentationCapabilities.showSpecialStoneInfoAt;
}
