import type { CardState, GameState, PlayerKey } from '../src/types';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

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

function _getBoardShapeForDiff(gameState: any) {
    const board = (gameState && Array.isArray(gameState.board)) ? gameState.board : null;
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
    const shape = _getBoardShapeForDiff(gameState);
    if (boardEl && boardEl.style) {
        boardEl.style.setProperty('--board-rows', String(shape.rows));
        boardEl.style.setProperty('--board-cols', String(shape.cols));
    }
    const syncBoardPixelSizing = _getDiscStoneHelperForDiff('syncBoardPixelSizing');
    if (syncBoardPixelSizing) {
        syncBoardPixelSizing(boardEl, shape);
    }
    return shape;
}

var BoardRendererStoneHelpersModule: any = null;
if (typeof require === 'function') {
    try { BoardRendererStoneHelpersModule = require('./board-renderer'); } catch (e: any) { /* ignore */ }
}
var SpecialStoneRegistryModule: any = null;
if (typeof require === 'function') {
    try { SpecialStoneRegistryModule = require('../shared/special-stone-registry'); } catch (e: any) { /* ignore */ }
}
var StoneStatusSnapshotModule: any = null;
if (typeof require === 'function') {
    try { StoneStatusSnapshotModule = require('../shared/stone-status-snapshot'); } catch (e: any) { /* ignore */ }
}
var BoardUpdateSyncRuntimeModule: any = null;
if (typeof require === 'function') {
    try { BoardUpdateSyncRuntimeModule = require('./board-update-sync-runtime'); } catch (e: any) { /* ignore */ }
}

function _getGlobalScopeForDiff() {
    return (typeof globalThis !== 'undefined')
        ? globalThis
        : (typeof self !== 'undefined' ? self : (typeof window !== 'undefined' ? window : ({} as any)));
}

function _getSpecialStoneRegistryForDiff() {
    if (SpecialStoneRegistryModule) return SpecialStoneRegistryModule;
    const globalScope = _getGlobalScopeForDiff();
    return globalScope.SpecialStoneRegistry || null;
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

function _getDiscStoneHelperForDiff(name: any) {
    if (BoardRendererStoneHelpersModule && typeof BoardRendererStoneHelpersModule[name] === 'function') {
        return BoardRendererStoneHelpersModule[name];
    }
    if (typeof window !== 'undefined' && typeof window[name] === 'function') {
        return window[name];
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
    const helper = _getDiscStoneHelperForDiff('applyTimeStopLegalEmphasis');
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
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    return Number.isInteger(row) && Number.isInteger(col) && row >= 0 && row < shape.rows && col >= 0 && col < shape.cols;
}

function _resolveExpansionSideForDiff(side: any, row: any, col: any, shapeOrGameState: any) {
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    if (col === -1) return 'left';
    if (col === shape.cols) return 'right';
    if (row === -1) return 'top';
    if (row === shape.rows) return 'bottom';
    return null;
}

function _isExpansionCoordinateForDiff(row: any, col: any, shapeOrGameState: any) {
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (row < -1 || row > shape.rows || col < -1 || col > shape.cols) return false;
    if (_isMainBoardCellForDiff(row, col, shape)) return false;
    return true;
}

function _applyExpansionCellPositionForDiff(cell: any, row: any, col: any, shapeOrGameState: any) {
    if (!cell) return;
    const shape = _normalizeBoardShapeInputForDiff(shapeOrGameState);
    const rowPercent = 100 / shape.rows;
    const colPercent = 100 / shape.cols;

    if (row === -1) {
        cell.style.top = `${-rowPercent}%`;
    } else if (row === shape.rows) {
        cell.style.top = '100%';
    } else {
        cell.style.top = `${row * rowPercent}%`;
    }

    if (col === -1) {
        cell.style.left = `${-colPercent}%`;
        cell.style.right = '';
    } else if (col === shape.cols) {
        cell.style.left = '100%';
        cell.style.right = '';
    } else {
        cell.style.left = `${col * colPercent}%`;
        cell.style.right = '';
    }

    cell.style.bottom = '';
}

function _getExpansionDescriptorsForDiff(gameState: any) {
    const boardShape = _getBoardShapeForDiff(gameState);
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion) return [];

    const out: any[] = [];
    const pushDescriptor = (source: any, legacyRow?: any, legacyOwner?: any) => {
        let side: any = null;
        let row: any = null;
        let col: any = null;
        let owner = legacyOwner;

        if (source && typeof source === 'object') {
            side = source.side;
            row = source.row;
            col = source.col;
            owner = source.owner;
            if (!Number.isInteger(col) && side === 'left') col = -1;
            if (!Number.isInteger(col) && side === 'right') col = boardShape.cols;
            if (!Number.isInteger(row) && side === 'top') row = -1;
            if (!Number.isInteger(row) && side === 'bottom') row = boardShape.rows;
        } else {
            side = source;
            row = legacyRow;
            if (side === 'left') col = -1;
            if (side === 'right') col = boardShape.cols;
            if (side === 'top') row = -1;
            if (side === 'bottom') row = boardShape.rows;
        }

        if (!_isExpansionCoordinateForDiff(row, col, boardShape)) return;
        if (out.some((desc) => desc && desc.row === row && desc.col === col)) return;
        out.push({
            row,
            col,
            side: _resolveExpansionSideForDiff(side, row, col, boardShape),
            owner: (owner === BLACK || owner === WHITE) ? owner : EMPTY
        });
    };

    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object') continue;
            pushDescriptor(cell);
        }
    }

    if (out.length === 0 && expansion.active === true) {
        pushDescriptor(expansion);
    }

    return out;
}

function _getExpansionDescriptorForDiff(gameState: any) {
    const descriptors = _getExpansionDescriptorsForDiff(gameState);
    return descriptors.length > 0 ? descriptors[0] : null;
}

function _getBoardDomSignatureForDiff(gameState: any) {
    const boardShape = _getBoardShapeForDiff(gameState);
    const descriptors = _getExpansionDescriptorsForDiff(gameState);
    if (!descriptors.length) return `base:${boardShape.rows}x${boardShape.cols}`;
    const tokens = descriptors
        .map((desc) => `${desc.row},${desc.col}`)
        .sort();
    return `expanded:${boardShape.rows}x${boardShape.cols}:${tokens.join('|')}`;
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

function _resolveStrongWillDisplayTurnsForDiff(data: any) {
    if (String(data && data.type ? data.type : '').toUpperCase() !== 'PERMA_PROTECTED') return undefined;
    const rawThreshold = Number(data && data.strongWillPromotionThreshold);
    const threshold = Number.isFinite(rawThreshold) ? Math.max(1, Math.trunc(rawThreshold)) : 10;
    const rawProgress = Number(data && data.strongWillPromotionOwnerTurnStarts);
    const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.trunc(rawProgress)) : 0;
    return Math.max(0, threshold - progress);
}

function _resolveSpecialDisplayTurnsForDiff(data: any) {
    const primary = Number(data && data.remainingOwnerTurns);
    if (Number.isFinite(primary)) return Math.max(0, Math.trunc(primary));
    const strongWillRemaining = _resolveStrongWillDisplayTurnsForDiff(data);
    if (strongWillRemaining !== undefined) return strongWillRemaining;
    if (String(data && data.type ? data.type : '').toUpperCase() === 'REGEN') {
        const regenRemaining = Number(data && data.regenRemaining);
        if (Number.isFinite(regenRemaining)) return Math.max(0, Math.trunc(regenRemaining));
    }
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
var AnimationShared = (typeof require === 'function') ? require('./animation-helpers') : (typeof window !== 'undefined' ? window.AnimationHelpers : null);
var OwnerHelpersModule: any = null;
if (typeof require === 'function') {
    try { OwnerHelpersModule = require('../utils/owner-helpers'); } catch (e: any) { /* ignore */ }
}
if (!OwnerHelpersModule) {
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).OwnerHelpers) OwnerHelpersModule = (globalThis as any).OwnerHelpers;
    } catch (e: any) { /* ignore */ }
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

function _isVisualPlaybackActiveForDiff() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return false;
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
function _getCardStateForDiffPlayback() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _hasPendingPlaybackEvents() {
    if (PlaybackStateModule && typeof PlaybackStateModule.hasPendingVisualPlayback === 'function') {
        try {
            return PlaybackStateModule.hasPendingVisualPlayback(_getCardStateForDiffPlayback()) === true;
        } catch (e: any) { /* ignore */ }
    }
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

function _hasPendingMoveSourceAtForDiff(row: any, col: any) {
    const key = `${row},${col}`;
    const keys = pendingMoveSourceKeysThisRender || _collectPendingMoveSourceKeysForDiff();
    return keys.has(key);
}

function _resolveGameStateForDiffRender() {
    try {
        if (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object') return gameState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.gameState && typeof window.gameState === 'object') return window.gameState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).gameState && typeof (globalThis as any).gameState === 'object') return (globalThis as any).gameState;
    } catch (e: any) { /* ignore */ }
    return null;
}

function _resolveCardStateForDiffRender() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object') return cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') return window.cardState;
    } catch (e: any) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object') return (globalThis as any).cardState;
    } catch (e: any) { /* ignore */ }
    return {};
}

function _collectPendingSelectedTargetHighlightKeysForDiff(pending: any) {
    const helper = _getDiscStoneHelperForDiff('collectPendingSelectedTargetHighlightKeys');
    if (typeof helper === 'function') {
        const result = helper(pending);
        if (result instanceof Set) return result;
        if (Array.isArray(result)) return new Set(result);
    }

    const out = new Set();
    if (!pending || pending.stage !== 'selectTarget') return out;

    const pendingType = String(pending.type || '').toUpperCase();
    const addKey = (target: any) => {
        if (!target) return;
        const row = Number(target.row);
        const col = Number(target.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return;
        out.add(`${row},${col}`);
    };

    if (
        pendingType === 'POSITION_SWAP_WILL' ||
        pendingType === 'SUPER_ATTRACTION_WILL' ||
        pendingType === 'BOARD_EXPANSION_GOD' ||
        pendingType === 'BOARD_SHRINK_GOD'
    ) {
        addKey(pending.firstTarget);
    }
    if (
        pendingType === 'BOARD_EXPANSION_GOD' ||
        pendingType === 'BOARD_SHRINK_WILL'
    ) {
        const selectedTargets = Array.isArray(pending.selectedTargets) ? pending.selectedTargets : [];
        for (const target of selectedTargets) {
            addKey(target);
        }
    }
    return out;
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
    const playerKey = getPlayerKey(gs.currentPlayer);
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
        renderBoardDiff(boardDomElement);
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
                isSelectedTargetHighlighted: false,
                isSuperAttractionPathPreview: false,
                isSuperAttractionPreviewDestination: false,
                isSelectableFriendly: false,
                isExtendLifeTarget: false,
                breedingSprout: false,
                boardBonus: null,
                special: null,
                inherited: null,
                guard: null,
                bomb: null,
                blockade: null,
                frozen: null,
                destroyEvadeRemaining: null
            };
        }
    }
    state._expansionCells = [];
    state._expansionCell = null;
    state._boardShape = boardShape;
    return state;
}

function _resolveFlipEvadeDisplayForDiff(special: any, inherited: any) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsFlipEvade = (
        specialTypeUpper === 'HYPERACTIVE' ||
        specialTypeUpper === 'EXTREME_HYPERACTIVE' ||
        specialTypeUpper === 'ESCAPE_HYPERACTIVE' ||
        specialTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
        specialTypeUpper === 'WILL_HUNTER_KING' ||
        specialTypeUpper === 'AFTERIMAGE_WILL'
    );
    const specialEvade = (special && specialSupportsFlipEvade && Number.isFinite(Number(special.flipEvadeRemaining)))
        ? Math.max(0, Math.trunc(Number(special.flipEvadeRemaining)))
        : null;
    const inheritedEvade = (inherited && Number.isFinite(Number(inherited.flipEvadeRemaining)))
        ? Math.max(0, Math.trunc(Number(inherited.flipEvadeRemaining)))
        : null;
    if (specialEvade !== null && inheritedEvade !== null) {
        return {
            special: specialEvade + inheritedEvade,
            inherited: null
        };
    }
    return {
        special: specialEvade,
        inherited: inheritedEvade
    };
}

function _resolveDestroyEvadeDisplayForDiff(special: any, inherited: any) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsDestroyEvade = (
        specialTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
        specialTypeUpper === 'EXTREME_HYPERACTIVE' ||
        specialTypeUpper === 'WILL_HUNTER_KING' ||
        specialTypeUpper === 'AFTERIMAGE_WILL'
    );
    const specialEvade = (special && specialSupportsDestroyEvade && Number.isFinite(Number(special.destroyEvadeRemaining)))
        ? Math.max(0, Math.trunc(Number(special.destroyEvadeRemaining)))
        : null;
    const inheritedEvade = (inherited && Number.isFinite(Number(inherited.destroyEvadeRemaining)))
        ? Math.max(0, Math.trunc(Number(inherited.destroyEvadeRemaining)))
        : null;
    if (specialEvade !== null && inheritedEvade !== null) {
        return {
            special: specialEvade + inheritedEvade,
            inherited: null
        };
    }
    return {
        special: specialEvade,
        inherited: inheritedEvade
    };
}

const LONG_PRESS_MS = 420;
const LONG_PRESS_MOVE_CANCEL_PX = 8;
const STONE_INFO_TAG_MEANINGS: Record<string, string> = Object.freeze({
    '多動状態': '両者ターン開始時にマス移動する状態。',
    '反転回避': '反転対象になったとき、マス移動でその石だけ回避する。',
    '破壊回避': '破壊対象になったとき、空きマスへ移動してその石だけ回避する。',
    '復活': '失われた時に元の色や状態へ戻る。',
    '残りターン': 'この石状態や特殊石効果が残っているターン数。',
    '特殊石': '通常石画像を使わない石。normal_stone-black.png / normal_stone-white.png 以外の見た目の石。',
    '繁殖生成石': '繁殖の意志でそのターンに新規生成された通常石。次の同一所有者ターン開始まで小さめの双葉表示になる。',
    '幽体': '反転・石破壊の対象にはなるが、その石自身は受けない。交換の意志の対象外で、入替や他の効果は通常どおり受ける。',
    '反転保護': '反転されない。挟める列ごと無効化する。',
    '破壊保護': '破壊効果を受けない。',
    '守る意志適用中': '守る意志または守護神の完全保護が重なっている。',
    '通常石': '通常の石。配置時に挟んだ列を反転できる。'
});
let _stoneInfoTagPanelRefs: any = null;
let _stoneInfoTagPanelState: { open: boolean; key: string | null } = {
    open: false,
    key: null
};
let _stoneInfoTagAutoDismissBound = false;

function _isBoardHiddenTrap(marker: any) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP') return false;
    // Hidden traps stay visually normal for both seats until reveal timing events.
    return true;
}

function _resolveNetworkLocalPlayerKeyForDiff() {
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

function _canLocalPlayerControlCurrentTurnForDiff() {
    let isNetworkMode = false;
    try {
        isNetworkMode = (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function')
            ? OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null)
            : ((typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
                ? window.getCurrentMatchMode() === 'network'
                : ((typeof window !== 'undefined' ? window.MATCH_MODE : null) === 'network'));
    } catch (e: any) { /* ignore */ }
    const currentPlayerKey = gameState.currentPlayer === WHITE ? 'white' : 'black';
    const isHvH = !!(typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN === true);
    if (isNetworkMode || !isHvH) {
        const cs = (typeof cardState !== 'undefined' && cardState) ? cardState : null;
        const fwc = cs && cs.fateWillControllerByTurnOwner;
        const controller = fwc && fwc[currentPlayerKey];
        if (controller) {
            const localPlayerKey = _resolveNetworkLocalPlayerKeyForDiff();
            return controller === localPlayerKey;
        }
    }
    if (!isNetworkMode) return true;
    const localPlayerKey = _resolveNetworkLocalPlayerKeyForDiff();
    return currentPlayerKey === localPlayerKey;
}

function _normalizeSpecialStoneInfoType(rawType: any) {
    if (!rawType) return null;
    const registry = _getSpecialStoneRegistryForDiff();
    if (registry && typeof registry.normalizeSpecialStoneType === 'function') {
        return registry.normalizeSpecialStoneType(rawType);
    }
    return String(rawType).toUpperCase();
}

function _getSpecialStoneInfoForDiff(rawType: any) {
    const type = _normalizeSpecialStoneInfoType(rawType);
    if (!type) return null;
    const registry = _getSpecialStoneRegistryForDiff();
    if (registry && typeof registry.getSpecialStoneInfo === 'function') {
        return registry.getSpecialStoneInfo(type);
    }
    return null;
}

function _createSpecialStoneStatusSnapshotForDiff(input: any, options: any) {
    const snapshotModule = _getStoneStatusSnapshotForDiff();
    if (snapshotModule && typeof snapshotModule.createSpecialStoneStatusSnapshot === 'function') {
        return snapshotModule.createSpecialStoneStatusSnapshot(input, options);
    }
    return null;
}

function _buildSpecialStoneStatusTagsForDiff(inputs: any, options: any) {
    const snapshotModule = _getStoneStatusSnapshotForDiff();
    if (snapshotModule && typeof snapshotModule.buildSpecialStoneStatusTags === 'function') {
        return snapshotModule.buildSpecialStoneStatusTags(inputs, options);
    }
    return (options && options.includeSpecialStone === false) ? [] : ['特殊石'];
}

function _normalizeBoardCoord(value: any) {
    const num = Number(value);
    return Number.isInteger(num) ? num : null;
}

function _isSameBoardCoord(rowA: any, colA: any, rowB: any, colB: any) {
    const aRow = _normalizeBoardCoord(rowA);
    const aCol = _normalizeBoardCoord(colA);
    const bRow = _normalizeBoardCoord(rowB);
    const bCol = _normalizeBoardCoord(colB);
    return aRow !== null && aCol !== null && bRow !== null && bCol !== null && aRow === bRow && aCol === bCol;
}

function _ensureStoneInfoPanel() {
    if (typeof document === 'undefined') return null;
    let panel = document.getElementById('stone-info-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'stone-info-panel';
    panel.className = 'stone-info-panel';
    panel.setAttribute('aria-live', 'polite');
    panel.setAttribute('aria-atomic', 'true');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = [
        '<div id="stone-info-name" class="stone-info-name"></div>',
        '<div id="stone-info-desc" class="stone-info-desc"></div>',
        '<div id="stone-info-meta" class="stone-info-meta"></div>'
    ].join('');
    const effectPanel = document.getElementById('effect-live-panel');
    if (effectPanel && effectPanel.parentNode) {
        effectPanel.parentNode.insertBefore(panel, effectPanel);
    } else {
        document.body.appendChild(panel);
    }
    return panel;
}

function _hideStoneInfoPanel() {
    const panel = _ensureStoneInfoPanel();
    if (!panel) return;
    panel.classList.remove('visible');
    panel.setAttribute('aria-hidden', 'true');
    _closeStoneInfoTagPanel();
}

function _isStoneInfoPanelVisible() {
    if (typeof document === 'undefined') return false;
    const panel = document.getElementById('stone-info-panel');
    return !!(panel && panel.classList.contains('visible'));
}

function _isHoverPointerEvent(ev: any) {
    if (ev && ev.pointerType === 'touch') return false;
    if (ev && (ev.pointerType === 'mouse' || ev.pointerType === 'pen')) return true;
    try {
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            return window.matchMedia('(hover: hover)').matches;
        }
    } catch (e: any) { /* ignore */ }
    return true;
}

function _isTouchStoneInfoEvent(ev: any) {
    if (ev && ev.pointerType === 'touch') return true;
    try {
        if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
            return window.matchMedia('(hover: none)').matches;
        }
    } catch (e: any) { /* ignore */ }
    return false;
}

function _ensureStoneInfoTagPanel() {
    if (typeof document === 'undefined') return null;
    if (_stoneInfoTagPanelRefs && _stoneInfoTagPanelRefs.root && _stoneInfoTagPanelRefs.root.isConnected) {
        return _stoneInfoTagPanelRefs;
    }

    let root = document.getElementById('stone-info-tag-panel');
    if (!root) {
        root = document.createElement('div');
        root.id = 'stone-info-tag-panel';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'false');
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = [
            '<div id="stone-info-tag-header">',
            '  <div id="stone-info-tag-title">詳細</div>',
            '  <button id="stone-info-tag-close-btn" type="button" aria-label="閉じる">×</button>',
            '</div>',
            '<div id="stone-info-tag-body"></div>'
        ].join('');
        document.body.appendChild(root);
    }

    _stoneInfoTagPanelRefs = {
        root,
        title: root.querySelector('#stone-info-tag-title'),
        body: root.querySelector('#stone-info-tag-body'),
        closeBtn: root.querySelector('#stone-info-tag-close-btn')
    };

    if (_stoneInfoTagPanelRefs.closeBtn && _stoneInfoTagPanelRefs.closeBtn.dataset.bound !== '1') {
        _stoneInfoTagPanelRefs.closeBtn.addEventListener('click', () => {
            _closeStoneInfoTagPanel();
        });
        _stoneInfoTagPanelRefs.closeBtn.dataset.bound = '1';
    }

    return _stoneInfoTagPanelRefs;
}

function _closeStoneInfoTagPanel() {
    const refs = _ensureStoneInfoTagPanel();
    if (!refs || !refs.root) return;
    refs.root.classList.remove('is-open');
    refs.root.setAttribute('aria-hidden', 'true');
    _stoneInfoTagPanelState = { open: false, key: null };
}

function _resolveStoneInfoTagMeaningKey(tag: any) {
    const key = String(tag || '').trim();
    if (!key) return '';
    if (key.startsWith('反転回避')) return '反転回避';
    if (key.startsWith('破壊回避')) return '破壊回避';
    if (key.startsWith('復活')) return '復活';
    if (/^残り\d+ターン$/.test(key)) return '残りターン';
    return key;
}

function _toggleStoneInfoTagPanel(tag: any) {
    const key = String(tag || '').trim();
    if (!key) return false;

    const isSame = _stoneInfoTagPanelState.open && _stoneInfoTagPanelState.key === key;
    if (isSame) {
        _closeStoneInfoTagPanel();
        return false;
    }

    const refs = _ensureStoneInfoTagPanel();
    if (!refs || !refs.root || !refs.title || !refs.body) return false;
    const meaningKey = _resolveStoneInfoTagMeaningKey(key);
    const meaning = STONE_INFO_TAG_MEANINGS[meaningKey] || `${key}の説明は未登録です。`;
    refs.title.textContent = key;
    refs.body.textContent = meaning;
    refs.root.classList.add('is-open');
    refs.root.setAttribute('aria-hidden', 'false');
    _stoneInfoTagPanelState = { open: true, key };
    return true;
}

function _bindStoneInfoTagAutoDismiss() {
    if (_stoneInfoTagAutoDismissBound || typeof document === 'undefined') return;
    _stoneInfoTagAutoDismissBound = true;

    document.addEventListener('pointerdown', (event: PointerEvent) => {
        if (!_stoneInfoTagPanelState.open) return;

        const rawTarget = event ? (event.target as Element | null) : null;
        const targetEl = rawTarget && rawTarget.nodeType === 1
            ? rawTarget
            : (rawTarget && rawTarget.parentElement ? rawTarget.parentElement : null);

        if (targetEl && typeof targetEl.closest === 'function') {
            if (targetEl.closest('#stone-info-tag-panel')) return;
            if (targetEl.closest('#stone-info-meta')) return;
        }

        _closeStoneInfoTagPanel();
    }, true);
}

function _renderStoneInfoMetaBadges(metaEl: any, badges: any) {
    if (!metaEl) return;
    metaEl.textContent = '';

    const normalizedBadges = Array.from(new Set(
        (Array.isArray(badges) ? badges : [])
            .map((badge) => String(badge || '').trim())
            .filter((badge) => !!badge)
    ));

    if (!normalizedBadges.length) {
        metaEl.style.display = 'none';
        _closeStoneInfoTagPanel();
        return;
    }

    metaEl.setAttribute('aria-label', '石効果タグ');
    for (const badge of normalizedBadges) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'stone-info-effect-tag stone-info-effect-tag-button';
        chip.textContent = badge;
        chip.setAttribute('aria-label', `${badge}の説明を表示`);
        chip.addEventListener('click', (event) => {
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
            _toggleStoneInfoTagPanel(badge);
        });
        metaEl.appendChild(chip);
    }

    metaEl.style.display = 'flex';
}

function _getMarkerKinds() {
    return (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
}

function _getMarkerEntriesAt(row: any, col: any) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const kinds = _getMarkerKinds();
    const entries = [];

    for (const marker of markers) {
        if (!marker || marker.kind !== kinds.SPECIAL_STONE) continue;
        if (!_isSameBoardCoord(marker.row, marker.col, row, col)) continue;
        if (_isBoardHiddenTrap(marker)) continue;
        entries.push({ kind: kinds.SPECIAL_STONE, marker });
    }

    for (const marker of markers) {
        if (!marker || marker.kind !== kinds.BOMB) continue;
        if (!_isSameBoardCoord(marker.row, marker.col, row, col)) continue;
        entries.push({ kind: kinds.BOMB, marker });
    }

    return entries;
}

function _getMarkerEntryAt(row: any, col: any) {
    const entries = _getMarkerEntriesAt(row, col);
    return entries.length > 0 ? entries[0] : null;
}

function _hasGuardMarkerAt(row: any, col: any) {
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    return markers.some((m: any) => (
        m &&
        m.kind === _getMarkerKinds().SPECIAL_STONE &&
        _isSameBoardCoord(m.row, m.col, row, col) &&
        m.data &&
        m.data.type === 'GUARD'
    ));
}

function _getEntryType(entry: any) {
    if (!entry || !entry.marker) return null;
    if (entry.kind === (_getMarkerKinds().BOMB)) {
        const bombType = (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : 'TIME_BOMB';
        return _normalizeSpecialStoneInfoType(bombType);
    }
    const markerType = (entry.marker.data && entry.marker.data.type) ? entry.marker.data.type : null;
    return _normalizeSpecialStoneInfoType(markerType);
}

function _isOverlayOnlyMarkerEntryForDiff(entry: any) {
    return _getEntryType(entry) === 'LIVING_WILL';
}

function _hasHyperactiveLikeStateForDiff(state: any) {
    if (!state || typeof state !== 'object') return false;
    const specialSnapshot = _createSpecialStoneStatusSnapshotForDiff({
        type: state.special && state.special.type,
        remainingOwnerTurns: state.special && state.special.remainingOwnerTurns,
        flipEvadeRemaining: state.special && state.special.flipEvadeRemaining,
        destroyEvadeRemaining: state.special && state.special.destroyEvadeRemaining,
        hasGuard: !!state.guard
    }, { mode: 'raw' });
    if (specialSnapshot && specialSnapshot.hasMobility) return true;
    return !!state.inherited;
}

function _createEntryStatusInputForDiff(entry: any, hasGuard: any) {
    if (!entry || !entry.marker) return null;
    const type = _getEntryType(entry);
    if (!type) return null;
    const data = entry.marker.data || {};
    const isBomb = entry.kind === _getMarkerKinds().BOMB;
    return {
        type,
        timer: isBomb ? data.remainingTurns : data.remainingOwnerTurns,
        regenRemaining: data.regenRemaining,
        flipEvadeRemaining: data.flipEvadeRemaining,
        destroyEvadeRemaining: data.destroyEvadeRemaining,
        hasGuard: !!hasGuard
    };
}

function _buildSpecialStoneBadges(entries: any, hasGuard: any, primaryInput: any) {
    const resolvedEntries = Array.isArray(entries) ? entries : [];
    const statusInputs = resolvedEntries
        .map((entry) => _createEntryStatusInputForDiff(entry, false))
        .filter((input) => !!input);
    const rawPrimary = primaryInput || (statusInputs.length > 0 ? statusInputs[0] : null);
    const primary = rawPrimary ? Object.assign({}, rawPrimary, { hasGuard: !!hasGuard }) : null;
    return _buildSpecialStoneStatusTagsForDiff(statusInputs, {
        hasGuard,
        primary,
        livingWillAura: resolvedEntries.some((entry) => _isOverlayOnlyMarkerEntryForDiff(entry))
    });
}

const NORMAL_STONE_INFO = {
    black: {
        name: '黒石',
        desc: '通常の石。配置時に挟んだ列を反転できる。'
    },
    white: {
        name: '白石',
        desc: '通常の石。配置時に挟んだ列を反転できる。'
    }
};

const BREEDING_SPROUT_STONE_INFO = {
    black: {
        name: '黒石（繁殖生成）',
        desc: '繁殖の意志でこのターンに生成された石。次の同一所有者ターン開始まで「小さめ + 双葉」で表示される。石としての挙動は通常石と同じ。'
    },
    white: {
        name: '白石（繁殖生成）',
        desc: '繁殖の意志でこのターンに生成された石。次の同一所有者ターン開始まで「小さめ + 双葉」で表示される。石としての挙動は通常石と同じ。'
    }
};

function _getStoneOwnerAt(row: any, col: any) {
    const black = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const white = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const state = _resolveGameStateForDiffRender();

    if (_isMainBoardCellForDiff(row, col)) {
        const board = (state && Array.isArray(state.board)) ? state.board : null;
        const rowValues = board && Array.isArray(board[row]) ? board[row] : null;
        const value = Number(rowValues ? rowValues[col] : NaN);
        if (value === black || value === white) return value;
        return null;
    }

    const expansion = _getExpansionDescriptorsForDiff(state).find((cell) => (
        cell && _isSameBoardCoord(cell.row, cell.col, row, col)
    ));
    if (!expansion) return null;
    const owner = Number(expansion.owner);
    return owner === black || owner === white ? owner : null;
}

function _getNormalStoneInfo(row: any, col: any) {
    const black = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const white = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const owner = _getStoneOwnerAt(row, col);
    if (owner === black) return NORMAL_STONE_INFO.black;
    if (owner === white) return NORMAL_STONE_INFO.white;
    return null;
}

function _getBreedingSproutOwnerKeyAt(row: any, col: any) {
    const cardStateValue = (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
        ? cardState
        : null;
    if (!cardStateValue || typeof cardStateValue.breedingSproutByOwner !== 'object' || !cardStateValue.breedingSproutByOwner) {
        return null;
    }
    const black = (typeof BLACK !== 'undefined') ? BLACK : 1;
    const white = (typeof WHITE !== 'undefined') ? WHITE : -1;
    const owner = _getStoneOwnerAt(row, col);
    if (owner !== black && owner !== white) return null;
    const ownerKey = owner === black ? 'black' : 'white';
    const positions = Array.isArray(cardStateValue.breedingSproutByOwner[ownerKey])
        ? cardStateValue.breedingSproutByOwner[ownerKey]
        : [];
    const isSprout = positions.some((point) => _isSameBoardCoord(point && point.row, point && point.col, row, col));
    return isSprout ? ownerKey : null;
}

function _getBreedingSproutStoneInfo(row: any, col: any) {
    const ownerKey = _getBreedingSproutOwnerKeyAt(row, col);
    if (ownerKey !== 'black' && ownerKey !== 'white') return null;
    return BREEDING_SPROUT_STONE_INFO[ownerKey] || null;
}

function showSpecialStoneInfoAt(row: any, col: any, options?: any) {
    _closeStoneInfoTagPanel();
    const preserveOnEmpty = !!(options && options.preserveOnEmpty);
    const keepOrHideEmpty = () => {
        if (preserveOnEmpty && _isStoneInfoPanelVisible()) return false;
        _hideStoneInfoPanel();
        return false;
    };
    const entries = _getMarkerEntriesAt(row, col);
    const entry = entries.find((one) => !_isOverlayOnlyMarkerEntryForDiff(one)) || null;
    let info: any = null;
    const badges = [];
    if (entry) {
        const type = _getEntryType(entry);
        if (!type) {
            return keepOrHideEmpty();
        }

        const hasGuard = _hasGuardMarkerAt(row, col);
        const primaryInput = _createEntryStatusInputForDiff(entry, hasGuard);
        const primarySnapshot = primaryInput
            ? _createSpecialStoneStatusSnapshotForDiff(primaryInput, { mode: 'info' })
            : null;
        info = primarySnapshot
            ? { name: primarySnapshot.name, desc: primarySnapshot.description }
            : (_getSpecialStoneInfoForDiff(type) || { name: type, desc: '効果情報は未登録です。' });
        badges.push(..._buildSpecialStoneBadges(entries, hasGuard, primaryInput));
    } else {
        const sproutInfo = _getBreedingSproutStoneInfo(row, col);
        if (sproutInfo) {
            info = sproutInfo;
            badges.push('繁殖生成石');
        } else {
            info = _getNormalStoneInfo(row, col);
            if (!info) {
                return keepOrHideEmpty();
            }
            if (entries.length > 0) {
                badges.push(..._buildSpecialStoneBadges(entries, _hasGuardMarkerAt(row, col), null));
            }
            badges.push('通常石');
        }
    }

    const panel = _ensureStoneInfoPanel();
    if (!panel) return false;

    const nameEl = document.getElementById('stone-info-name');
    const descEl = document.getElementById('stone-info-desc');
    const metaEl = document.getElementById('stone-info-meta');
    if (!nameEl || !descEl || !metaEl) return false;

    nameEl.textContent = info.name;
    descEl.textContent = info.desc;
    _renderStoneInfoMetaBadges(metaEl, badges);

    panel.classList.add('visible');
    panel.setAttribute('aria-hidden', 'false');
    panel.style.removeProperty('left');
    panel.style.removeProperty('top');

    return true;
}

let _outsideCloseHandlerBound = false;
function _ensureOutsideCloseHandler() {
    if (_outsideCloseHandlerBound || typeof document === 'undefined') return;
    _outsideCloseHandlerBound = true;
    _bindStoneInfoTagAutoDismiss();
    document.addEventListener('pointerdown', (ev: PointerEvent) => {
        const panel = document.getElementById('stone-info-panel');
        if (!panel || !panel.classList.contains('visible')) return;
        const target = ev.target as Node | null;
        if (panel.contains(target)) return;
        const board = document.getElementById('board');
        if (board && board.contains(target)) return;
        _hideStoneInfoPanel();
    }, true);
}

function attachBoardCellInteraction(cell: any, row: any, col: any) {
    if (!cell) return;

    let pressTimer: any = null;
    let pressActive = false;
    let longPressed = false;
    let startX = 0;
    let startY = 0;

    const clearPress = () => {
        pressActive = false;
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };

    cell.addEventListener('pointerdown', (ev: any) => {
        if (ev.button !== 0) return;
        _ensureOutsideCloseHandler();
        clearPress();
        longPressed = false;
        pressActive = true;
        startX = Number(ev.clientX || 0);
        startY = Number(ev.clientY || 0);
        pressTimer = setTimeout(() => {
            if (!pressActive) return;
            longPressed = true;
            showSpecialStoneInfoAt(row, col);
        }, LONG_PRESS_MS);
    });

    cell.addEventListener('pointerenter', (ev: any) => {
        if (!_isHoverPointerEvent(ev)) return;
        _ensureOutsideCloseHandler();
        _setSuperAttractionHoverPreview(row, col);
        showSpecialStoneInfoAt(row, col, { preserveOnEmpty: true });
    });

    cell.addEventListener('pointermove', (ev: any) => {
        if (_isHoverPointerEvent(ev)) {
            _setSuperAttractionHoverPreview(row, col);
        }
        if (!pressActive) return;
        const dx = Math.abs(Number(ev.clientX || 0) - startX);
        const dy = Math.abs(Number(ev.clientY || 0) - startY);
        if (dx > LONG_PRESS_MOVE_CANCEL_PX || dy > LONG_PRESS_MOVE_CANCEL_PX) {
            clearPress();
        }
    });

    cell.addEventListener('pointerup', (ev: any) => {
        if (!pressActive && !longPressed) return;
        const wasLongPressed = longPressed;
        clearPress();
        if (wasLongPressed) {
            ev.preventDefault();
            return;
        }
        if (_isTouchStoneInfoEvent(ev)) {
            showSpecialStoneInfoAt(row, col);
        }
        handleCellClick(row, col);
    });

    cell.addEventListener('pointercancel', () => clearPress());
    cell.addEventListener('pointerleave', (ev: any) => {
        if (_isHoverPointerEvent(ev)) {
            _clearSuperAttractionHoverPreview();
        }
        clearPress();
    });
    cell.addEventListener('mouseleave', () => {
        _clearSuperAttractionHoverPreview();
        clearPress();
    });
}

/**
 * 盤面を初期化（最初の1回のみ全レンダリング）
 * Initialize board with full rendering (first time only)
 * @param {HTMLElement} boardEl - 盤面要素
 */
function initializeBoardDOM(boardEl: any) {
    const gameState = _resolveGameStateForDiffRender();
    const boardShape = _applyBoardCssVarsForDiff(boardEl, gameState);
    const expansions = _getExpansionDescriptorsForDiff(gameState);
    boardEl.innerHTML = '';
    cellCache = [];
    cellCacheMap = new Map();

    boardEl.classList.remove('board-expanded-left', 'board-expanded-right', 'board-expanded-top', 'board-expanded-bottom');
    if (expansions.some((exp) => exp && exp.side === 'left')) boardEl.classList.add('board-expanded-left');
    if (expansions.some((exp) => exp && exp.side === 'right')) boardEl.classList.add('board-expanded-right');
    if (expansions.some((exp) => exp && exp.side === 'top')) boardEl.classList.add('board-expanded-top');
    if (expansions.some((exp) => exp && exp.side === 'bottom')) boardEl.classList.add('board-expanded-bottom');

    for (let r = 0; r < boardShape.rows; r++) {
        for (let c = 0; c < boardShape.cols; c++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = String(r);
            cell.dataset.col = String(c);
            attachBoardCellInteraction(cell, r, c);
            boardEl.appendChild(cell);
            _cacheCell(r, c, cell);
        }
    }

    for (const expansion of expansions) {
        if (!expansion) continue;
        const cell = document.createElement('div');
        cell.className = `cell cell-expanded cell-expanded-${expansion.side}`;
        cell.dataset.row = String(expansion.row);
        cell.dataset.col = String(expansion.col);
        _applyExpansionCellPositionForDiff(cell, expansion.row, expansion.col, boardShape);
        attachBoardCellInteraction(cell, expansion.row, expansion.col);
        boardEl.appendChild(cell);
        _cacheCell(expansion.row, expansion.col, cell);
    }

    boardDomSignature = _getBoardDomSignatureForDiff(gameState);

    previousBoardState = null;
    if (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true) {
        console.log('[DiffRenderer] Board DOM initialized with cell cache');
    }
}


/**
 * 現在のゲーム状態からセル状態を構築
 * Build cell state from current game state
 * @returns {Array<Array<CellState>>} 8x8セル状態配列
 */
function buildCurrentCellState() {
    const gameState = _resolveGameStateForDiffRender();
    const cardState = _resolveCardStateForDiffRender();
    const boardShape = _getBoardShapeForDiff(gameState);
    if (!gameState || !Array.isArray(gameState.board) || gameState.board.length <= 0 || !Array.isArray(gameState.board[0])) {
        return _buildEmptyCellStateForDiffRender(boardShape);
    }

    const player = gameState.currentPlayer;
    // Minimal, single-site guard: if cardState is missing or incomplete, use an empty context
    // to avoid throwing inside CardLogic.getCardContext during early-init race.
    let context: any;
    if (cardState && Array.isArray(cardState.markers)) {
        context = CardLogic.getCardContext(cardState);
    } else {
        console.warn('[DiffRenderer] cardState missing or incomplete — using empty CardContext to continue rendering');
        context = { protectedStones: [], permaProtectedStones: [], bombs: [] };
    }
    const playerKey = getPlayerKey(player);
    const pending = (cardState && cardState.pendingEffectByPlayer) ? cardState.pendingEffectByPlayer[playerKey] : null;
    const freePlacementActive = !!(pending && (
        (typeof CardLogic !== 'undefined' &&
            CardLogic &&
            typeof CardLogic.isFreePlacementPendingType === 'function' &&
            CardLogic.isFreePlacementPendingType(pending.type)) ||
        pending.type === 'FREE_PLACEMENT' ||
        pending.type === 'SNIPER_WILL' ||
        pending.type === 'LAST_RESORT'
    ));
    const isTabooReversePending = !!(pending && pending.type === 'TABOO_REVERSE_WILL');
    let isNetworkMode = false;
    try {
        isNetworkMode = (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function')
            ? OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null)
            : ((typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
                ? window.getCurrentMatchMode() === 'network'
                : ((typeof window !== 'undefined' ? window.MATCH_MODE : null) === 'network'));
    } catch (e: any) { /* ignore */ }
    const canControlCurrentTurn = _canLocalPlayerControlCurrentTurnForDiff();
    const isFateWillControlledTurn = !!(
        cardState &&
        cardState.fateWillControllerByTurnOwner &&
        cardState.fateWillControllerByTurnOwner[playerKey]
    );
    const isHumanTurn = isNetworkMode
        ? canControlCurrentTurn
        : ((gameState.currentPlayer === BLACK) ||
            (window.DEBUG_HUMAN_VS_HUMAN && gameState.currentPlayer === WHITE) ||
            isFateWillControlledTurn);
    const selectableTargets = CardLogic.getSelectableTargets
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    const isSelectingTarget = !!(
        pending &&
        pending.stage === 'selectTarget' &&
        Array.isArray(selectableTargets) &&
        selectableTargets.length > 0
    );
    const isExtendLifeSelection = !!(
        pending &&
        (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') &&
        (pending.stage === 'selectTarget' || pending.stage == null)
    );
    const showLegalHints = isHumanTurn && !isSelectingTarget && canControlCurrentTurn;
    const expansions = _getExpansionDescriptorsForDiff(gameState);

    let normalLegalSet = new Set();
    if (showLegalHints) {
        const legalMoves = getLegalMoves(gameState, context.protectedStones, context.permaProtectedStones);
        normalLegalSet = new Set(legalMoves.map((m: any) => `${m.row},${m.col}`));
    }

    const tabooLegalSet = new Set();
    if (showLegalHints && isTabooReversePending && typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getTabooReverseCandidates === 'function') {
        const addTabooCell = (row: any, col: any) => {
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            const key = `${row},${col}`;
            const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, playerKey, row, col);
            if (!Array.isArray(candidates) || candidates.length === 0) return;
            tabooLegalSet.add(key);
        };

        for (let r = 0; r < boardShape.rows; r++) {
            for (let c = 0; c < boardShape.cols; c++) {
                if (gameState.board[r][c] !== EMPTY) continue;
                addTabooCell(r, c);
            }
        }
        for (const expansion of expansions) {
            if (!expansion || Number(expansion.owner) !== EMPTY) continue;
            addTabooCell(expansion.row, expansion.col);
        }
    }
    const legalSet = new Set([...normalLegalSet, ...tabooLegalSet]);
    if (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true) {
        console.log('[DiffRenderer] legal hint cells:', legalSet.size, 'player:', player, 'taboo:', isTabooReversePending, 'tabooCells:', tabooLegalSet.size);
    }
    const selectableTargetSet = new Set(selectableTargets.map((p: any) => p.row + ',' + p.col));
    const selectedTargetHighlightSet = isHumanTurn
        ? _collectPendingSelectedTargetHighlightKeysForDiff(pending)
        : new Set();
    const superAttractionPreview = isHumanTurn
        ? _getActiveSuperAttractionPreviewForDiff(pending)
        : null;
    const superAttractionPreviewKeys = _collectSuperAttractionPreviewKeys(superAttractionPreview);

    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const suppressBoardBonus = _isReversiModeForDiffRenderer();
    const boardBonusByCell = (!suppressBoardBonus && cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
        ? cardState.boardBonusByCell
        : {};
    const boardBonusConsumedByCell = (!suppressBoardBonus && cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
        ? cardState.boardBonusConsumedByCell
        : {};
    const specialMap = new Map();
    const guardMap = new Map();
    const livingWillMap = new Map();
    const inheritedMap = new Map();
    const bombMap = new Map();
    const blockadeMap = new Map();
    const freezeMap = new Map();
    const seedMap = new Map();
    const sproutMap = new Map();
    for (const m of markers) {
        if (_isBombCategoryMarkerForDiff(m) && m.data) {
            bombMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                remainingTurns: m.data.remainingTurns,
                owner: m.owner
            });
            continue;
        }
        if (m.kind === markerKinds.SPECIAL_STONE && m.data && m.data.type) {
            if (_isBoardHiddenTrap(m)) continue;
            if (m.data.type === 'INHERITED_HYPERACTIVE') {
                inheritedMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns,
                    flipEvadeRemaining: Number.isFinite(Number(m.data.flipEvadeRemaining))
                        ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                        : null,
                    destroyEvadeRemaining: Number.isFinite(Number(m.data.destroyEvadeRemaining))
                        ? Math.max(0, Math.trunc(Number(m.data.destroyEvadeRemaining)))
                        : null
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
            if (m.data.type === 'BLOCKADE' || m.data.type === 'METEOR_HOLE') {
                blockadeMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    type: m.data.type,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns,
                    visualVariant: typeof m.data.visualVariant === 'string' ? m.data.visualVariant : null
                });
                continue;
            }
            if (m.data.type === 'FREEZE') {
                freezeMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
            }
            if (m.data.type === 'SEED') {
                seedMap.set(`${m.row},${m.col}`, {
                    row: m.row,
                    col: m.col,
                    owner: m.owner,
                    remainingOwnerTurns: m.data.remainingOwnerTurns
                });
                continue;
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
            const markerTypeUpper = String(m.data.type || '').toUpperCase();
            const markerSupportsFlipEvade = (
                markerTypeUpper === 'HYPERACTIVE' ||
                markerTypeUpper === 'EXTREME_HYPERACTIVE' ||
                markerTypeUpper === 'ESCAPE_HYPERACTIVE' ||
                markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
                markerTypeUpper === 'WILL_HUNTER_KING' ||
                markerTypeUpper === 'AFTERIMAGE_WILL'
            );
            specialMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: _resolveSpecialDisplayTurnsForDiff(m.data),
                destroyEvadeRemaining: (
                    markerTypeUpper === 'ULTIMATE_HYPERACTIVE' ||
                    markerTypeUpper === 'EXTREME_HYPERACTIVE' ||
                    markerTypeUpper === 'WILL_HUNTER_KING' ||
                    markerTypeUpper === 'AFTERIMAGE_WILL'
                )
                    ? (
                        Number.isFinite(Number(m.data.destroyEvadeRemaining))
                            ? Math.max(0, Math.trunc(Number(m.data.destroyEvadeRemaining)))
                            : ((markerTypeUpper === 'ULTIMATE_HYPERACTIVE' || markerTypeUpper === 'EXTREME_HYPERACTIVE') ? 1 : (markerTypeUpper === 'AFTERIMAGE_WILL' ? 3 : null))
                    )
                    : null,
                flipEvadeRemaining: markerSupportsFlipEvade
                    ? (
                        Number.isFinite(Number(m.data.flipEvadeRemaining))
                            ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                            : ((markerTypeUpper === 'ULTIMATE_HYPERACTIVE' || markerTypeUpper === 'EXTREME_HYPERACTIVE' || markerTypeUpper === 'AFTERIMAGE_WILL') ? 3 : null)
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

    const existingCellKeySet = new Set();
    for (let r = 0; r < boardShape.rows; r++) {
        for (let c = 0; c < boardShape.cols; c++) {
            existingCellKeySet.add(`${r},${c}`);
        }
    }
    for (const expansion of expansions) {
        if (!expansion || !Number.isInteger(expansion.row) || !Number.isInteger(expansion.col)) continue;
        existingCellKeySet.add(`${expansion.row},${expansion.col}`);
    }

    const holeKeySet = new Set();
    blockadeMap.forEach((blocked, key) => {
        if (String(blocked && blocked.type ? blocked.type : '').toUpperCase() === 'METEOR_HOLE') {
            holeKeySet.add(key);
        }
    });

    const playableKeySet = new Set(existingCellKeySet);
    for (const holeKey of holeKeySet) {
        playableKeySet.delete(holeKey);
    }

    const getBoardShrinkInnerBoundaryMask = (row: any, col: any, visualVariant: any) => {
        if (String(visualVariant || '').toUpperCase() !== 'BOARD_FRAME') return null;
        const edges = [];
        const neighbors = [
            ['top', row - 1, col],
            ['right', row, col + 1],
            ['bottom', row + 1, col],
            ['left', row, col - 1]
        ];
        for (const [edgeName, neighborRow, neighborCol] of neighbors) {
            const neighborKey = `${neighborRow},${neighborCol}`;
            if (!playableKeySet.has(neighborKey)) continue;
            edges.push(edgeName);
        }
        return edges.length ? edges.join(',') : null;
    };

    const state: any = [];
    for (let r = 0; r < boardShape.rows; r++) {
        state[r] = [];
        for (let c = 0; c < boardShape.cols; c++) {
            const key = r + ',' + c;
            const val = gameState.board[r][c];
            const blockade = blockadeMap.get(key) || null;
            const frozen = freezeMap.get(key) || null;
            const seed = seedMap.get(key) || null;
            const isLegal = showLegalHints && val === EMPTY && legalSet.has(key);
            const isTabooLegal = showLegalHints && val === EMPTY && tabooLegalSet.has(key);
            const isLegalFree = showLegalHints && val === EMPTY && freePlacementActive;
            const isSelectedTargetHighlighted = isHumanTurn && selectedTargetHighlightSet.has(key);
            const isSuperAttractionPathPreview = isHumanTurn && superAttractionPreviewKeys.pathKeys.has(key);
            const isSuperAttractionPreviewDestination = isHumanTurn && superAttractionPreviewKeys.destinationKeys.has(key);
            const isSelectableFriendly = isHumanTurn && selectableTargetSet.has(key);
            const isExtendLifeTarget = isSelectableFriendly && isExtendLifeSelection;
            const bonusValueRaw = (val === EMPTY && !blockade && !frozen && !seed && boardBonusConsumedByCell[key] !== true)
                ? Number(boardBonusByCell[key] || 0)
                : 0;
            const boardBonus = Number.isFinite(bonusValueRaw) && bonusValueRaw > 0 ? bonusValueRaw : null;

            // Get special stone at this position
            const special = val !== EMPTY ? specialMap.get(key) : null;
            const inherited = val !== EMPTY ? inheritedMap.get(key) : null;
            const guard = val !== EMPTY ? guardMap.get(key) : null;
            const livingWill = val !== EMPTY ? livingWillMap.get(key) : null;
            const bomb = val !== EMPTY ? bombMap.get(key) : null;
            const flipEvadeDisplay = _resolveFlipEvadeDisplayForDiff(special, inherited);
            const destroyEvadeDisplay = _resolveDestroyEvadeDisplayForDiff(special, inherited);
            const specialSupportsFlipEvade = !!(
                special &&
                (
                    String(special.type || '').toUpperCase() === 'HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'EXTREME_HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'ESCAPE_HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'ULTIMATE_HYPERACTIVE' ||
                    String(special.type || '').toUpperCase() === 'WILL_HUNTER_KING' ||
                    String(special.type || '').toUpperCase() === 'AFTERIMAGE_WILL'
                )
            );

            // Normalize owner to BLACK/WHITE constant
            const getOwnerVal = (owner: any) => {
                if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
                return WHITE;
            };

            state[r][c] = {
                value: val,
                isLegal: isLegal && !isLegalFree,
                isLegalFree,
                isTabooLegal,
                isSelectedTargetHighlighted,
                isSuperAttractionPathPreview,
                isSuperAttractionPreviewDestination,
                isSelectableFriendly,
                isExtendLifeTarget,
                breedingSprout: (val !== EMPTY) && sproutMap.has(key),
                boardBonus,
                // Unified special stone field
                special: special ? {
                    type: special.type,
                    owner: getOwnerVal(special.owner),
                    remainingOwnerTurns: special.remainingOwnerTurns,
                    flipEvadeRemaining: specialSupportsFlipEvade ? flipEvadeDisplay.special : 0,
                    destroyEvadeRemaining: destroyEvadeDisplay.special
                } : null,
                livingWillAura: !!livingWill,
                inherited: inherited ? {
                    owner: getOwnerVal(inherited.owner),
                    remainingOwnerTurns: inherited.remainingOwnerTurns,
                    flipEvadeRemaining: flipEvadeDisplay.inherited,
                    destroyEvadeRemaining: destroyEvadeDisplay.inherited
                } : null,
                guard: guard ? {
                    owner: getOwnerVal(guard.owner),
                    remainingOwnerTurns: guard.remainingOwnerTurns
                } : null,
                bomb: bomb ? { remainingTurns: bomb.remainingTurns, owner: getOwnerVal(bomb.owner) } : null,
                blockade: blockade ? {
                    type: blockade.type,
                    owner: getOwnerVal(blockade.owner),
                    remainingOwnerTurns: blockade.remainingOwnerTurns,
                    visualVariant: blockade.visualVariant,
                    innerBoundaryMask: getBoardShrinkInnerBoundaryMask(r, c, blockade.visualVariant)
                } : null,
                frozen: frozen ? {
                    owner: getOwnerVal(frozen.owner),
                    remainingOwnerTurns: frozen.remainingOwnerTurns
                } : null,
                seed: seed ? {
                    owner: getOwnerVal(seed.owner),
                    remainingOwnerTurns: seed.remainingOwnerTurns
                } : null,
                destroyEvadeRemaining: destroyEvadeDisplay.special !== null ? destroyEvadeDisplay.special : destroyEvadeDisplay.inherited
            };
        }
    }

    state._boardShape = boardShape;
    state._expansionCells = [];
    for (const expansion of expansions) {
        if (!expansion) continue;
        const expKey = `${expansion.row},${expansion.col}`;
        const expVal = expansion.owner;
        const isLegal = showLegalHints && expVal === EMPTY && legalSet.has(expKey);
        const isTabooLegal = showLegalHints && expVal === EMPTY && tabooLegalSet.has(expKey);
        const isLegalFree = showLegalHints && expVal === EMPTY && freePlacementActive;
        const isSelectedTargetHighlighted = isHumanTurn && selectedTargetHighlightSet.has(expKey);
        const isSuperAttractionPathPreview = isHumanTurn && superAttractionPreviewKeys.pathKeys.has(expKey);
        const isSuperAttractionPreviewDestination = isHumanTurn && superAttractionPreviewKeys.destinationKeys.has(expKey);
        const isSelectableFriendly = isHumanTurn && selectableTargetSet.has(expKey);
        const isExtendLifeTarget = isSelectableFriendly && isExtendLifeSelection;
        const blockade = blockadeMap.get(expKey) || null;
        const frozen = freezeMap.get(expKey) || null;
        const seed = seedMap.get(expKey) || null;
        const special = expVal !== EMPTY ? specialMap.get(expKey) : null;
        const inherited = expVal !== EMPTY ? inheritedMap.get(expKey) : null;
        const guard = expVal !== EMPTY ? guardMap.get(expKey) : null;
        const livingWill = expVal !== EMPTY ? livingWillMap.get(expKey) : null;
        const bomb = expVal !== EMPTY ? bombMap.get(expKey) : null;
        const flipEvadeDisplay = _resolveFlipEvadeDisplayForDiff(special, inherited);
        const destroyEvadeDisplay = _resolveDestroyEvadeDisplayForDiff(special, inherited);
        const specialSupportsFlipEvade = !!(
            special &&
            (
                String(special.type || '').toUpperCase() === 'HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'EXTREME_HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'ESCAPE_HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'ULTIMATE_HYPERACTIVE' ||
                String(special.type || '').toUpperCase() === 'WILL_HUNTER_KING' ||
                String(special.type || '').toUpperCase() === 'AFTERIMAGE_WILL'
            )
        );

        const getOwnerVal = (owner: any) => {
            if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
            return WHITE;
        };

        state._expansionCells.push({
            row: expansion.row,
            col: expansion.col,
            side: expansion.side,
            value: expVal,
            isLegal: isLegal && !isLegalFree,
            isLegalFree,
            isTabooLegal,
            isSelectedTargetHighlighted,
            isSuperAttractionPathPreview,
            isSuperAttractionPreviewDestination,
            isSelectableFriendly,
            isExtendLifeTarget,
            breedingSprout: false,
            boardBonus: null,
            frozen: frozen ? {
                owner: getOwnerVal(frozen.owner),
                remainingOwnerTurns: frozen.remainingOwnerTurns
            } : null,
            seed: seed ? {
                owner: getOwnerVal(seed.owner),
                remainingOwnerTurns: seed.remainingOwnerTurns
            } : null,
            special: special ? {
                type: special.type,
                owner: getOwnerVal(special.owner),
                remainingOwnerTurns: special.remainingOwnerTurns,
                flipEvadeRemaining: specialSupportsFlipEvade ? flipEvadeDisplay.special : 0,
                destroyEvadeRemaining: destroyEvadeDisplay.special
            } : null,
            livingWillAura: !!livingWill,
            inherited: inherited ? {
                owner: getOwnerVal(inherited.owner),
                remainingOwnerTurns: inherited.remainingOwnerTurns,
                flipEvadeRemaining: flipEvadeDisplay.inherited,
                destroyEvadeRemaining: destroyEvadeDisplay.inherited
            } : null,
            guard: guard ? {
                owner: getOwnerVal(guard.owner),
                remainingOwnerTurns: guard.remainingOwnerTurns
            } : null,
            bomb: bomb ? { remainingTurns: bomb.remainingTurns, owner: getOwnerVal(bomb.owner) } : null,
            blockade: blockade ? {
                type: blockade.type,
                owner: getOwnerVal(blockade.owner),
                remainingOwnerTurns: blockade.remainingOwnerTurns,
                visualVariant: blockade.visualVariant,
                innerBoundaryMask: getBoardShrinkInnerBoundaryMask(expansion.row, expansion.col, blockade.visualVariant)
            } : null,
            destroyEvadeRemaining: destroyEvadeDisplay.special !== null ? destroyEvadeDisplay.special : destroyEvadeDisplay.inherited
        });
    }
    state._expansionCell = state._expansionCells.length > 0 ? state._expansionCells[0] : null;
    return state;
}

/**
 * 2つのセル状態を比較
 * Compare two cell states for equality
 * @param {CellState|null} a - 前回の状態
 * @param {CellState} b - 現在の状態
 * @returns {boolean} 同一かどうか
 */
function cellStatesEqual(a: any, b: any) {
    if (!a) return false;
    if (a.value !== b.value) return false;
    if (a.isLegal !== b.isLegal) return false;
    if (a.isLegalFree !== b.isLegalFree) return false;
    if (!!a.isTabooLegal !== !!b.isTabooLegal) return false;
    if (!!a.isSelectedTargetHighlighted !== !!b.isSelectedTargetHighlighted) return false;
    if (!!a.isSuperAttractionPathPreview !== !!b.isSuperAttractionPathPreview) return false;
    if (!!a.isSuperAttractionPreviewDestination !== !!b.isSuperAttractionPreviewDestination) return false;
    if (a.isSelectableFriendly !== b.isSelectableFriendly) return false;
    if (!!a.isExtendLifeTarget !== !!b.isExtendLifeTarget) return false;
    if (!!a.breedingSprout !== !!b.breedingSprout) return false;
    if (a.boardBonus !== b.boardBonus) return false;
    if (!!a.livingWillAura !== !!b.livingWillAura) return false;

    // Compare unified special stone
    if ((a.special === null) !== (b.special === null)) return false;
    if (a.special && b.special) {
        if (a.special.type !== b.special.type) return false;
        if (a.special.owner !== b.special.owner) return false;
        if (a.special.remainingOwnerTurns !== b.special.remainingOwnerTurns) return false;
        if (a.special.flipEvadeRemaining !== b.special.flipEvadeRemaining) return false;
        if (a.special.destroyEvadeRemaining !== b.special.destroyEvadeRemaining) return false;
    }

    if ((a.inherited === null) !== (b.inherited === null)) return false;
    if (a.inherited && b.inherited) {
        if (a.inherited.owner !== b.inherited.owner) return false;
        if (a.inherited.remainingOwnerTurns !== b.inherited.remainingOwnerTurns) return false;
        if (a.inherited.flipEvadeRemaining !== b.inherited.flipEvadeRemaining) return false;
        if (a.inherited.destroyEvadeRemaining !== b.inherited.destroyEvadeRemaining) return false;
    }

    if ((a.guard === null) !== (b.guard === null)) return false;
    if (a.guard && b.guard) {
        if (a.guard.owner !== b.guard.owner) return false;
        if (a.guard.remainingOwnerTurns !== b.guard.remainingOwnerTurns) return false;
    }

    // Compare bomb state
    if ((a.bomb === null) !== (b.bomb === null)) return false;
    if (a.bomb && b.bomb) {
        if (a.bomb.remainingTurns !== b.bomb.remainingTurns) return false;
        if (a.bomb.owner !== b.bomb.owner) return false;
    }

    if ((a.blockade === null) !== (b.blockade === null)) return false;
    if (a.blockade && b.blockade) {
        if ((a.blockade.type || null) !== (b.blockade.type || null)) return false;
        if (a.blockade.remainingOwnerTurns !== b.blockade.remainingOwnerTurns) return false;
        if (a.blockade.owner !== b.blockade.owner) return false;
        if ((a.blockade.visualVariant || null) !== (b.blockade.visualVariant || null)) return false;
        if ((a.blockade.innerBoundaryMask || null) !== (b.blockade.innerBoundaryMask || null)) return false;
    }

    if ((a.frozen === null) !== (b.frozen === null)) return false;
    if (a.frozen && b.frozen) {
        if (a.frozen.remainingOwnerTurns !== b.frozen.remainingOwnerTurns) return false;
        if (a.frozen.owner !== b.frozen.owner) return false;
    }

    if ((a.seed === null) !== (b.seed === null)) return false;
    if (a.seed && b.seed) {
        if (a.seed.remainingOwnerTurns !== b.seed.remainingOwnerTurns) return false;
        if (a.seed.owner !== b.seed.owner) return false;
    }

    return true;
}

function updateCellDOM(cell: any, state: any, row: any, col: any, prevState: any) {
    const boardShape = _getBoardShapeForDiff(_resolveGameStateForDiffRender());
    const isExpansionCell = _isExpansionCoordinateForDiff(row, col, boardShape);
    const expansionSide = _resolveExpansionSideForDiff(state && state.side ? state.side : null, row, col, boardShape);

    // If a destroy-fade is actively running on this disc, skip re-rendering this cell
    // so we don't interrupt the disappearance animation.
    const currentDisc = cell.querySelector('.disc');
    if (currentDisc && currentDisc.classList.contains('destroy-fade')) {
        return;
    }

    // Recover from stale hidden classes/styles that can remain after playback race conditions.
    // During active playback we still skip to avoid clobbering in-flight transitions.
    if (currentDisc && (
        currentDisc.classList.contains('stone-hidden') ||
        currentDisc.classList.contains('stone-hidden-all') ||
        currentDisc.classList.contains('stone-instant')
    )) {
        const isPlaybackActive = _isVisualPlaybackActiveForDiff();
        if (isPlaybackActive) return;
        try {
            currentDisc.classList.remove('stone-hidden', 'stone-hidden-all', 'stone-instant');
            currentDisc.style.opacity = '';
            currentDisc.style.visibility = '';
        } catch (e: any) { /* ignore */ }
    }

    // Also skip if an animation overlay is active in this cell
    if (cell.querySelector('.stone-fade-overlay')) {
        return;
    }

    // If a stone is being removed and playback didn't handle it, apply a fallback destroy-fade.
    // Source cells for queued move playback become EMPTY before the motion starts, so they must
    // sync directly to empty instead of being misclassified as destroy-fades.
    if (prevState && prevState.value !== EMPTY && state.value === EMPTY && currentDisc) {
        if (_hasPendingMoveSourceAtForDiff(row, col) || _hasHyperactiveLikeStateForDiff(prevState)) {
            cell.classList.remove('has-disc');
            cell.innerHTML = '';
            return;
        }
        const noAnim = (AnimationShared && typeof AnimationShared.isNoAnim === 'function') ? AnimationShared.isNoAnim() : ((typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) || (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)));
        if (!noAnim) {
            currentDisc.classList.add('destroy-fade');
            const fadeMs = (typeof SharedConstants !== 'undefined' && SharedConstants.DESTROY_FADE_MS)
                ? SharedConstants.DESTROY_FADE_MS
                : ((typeof window !== 'undefined' && window.DESTROY_FADE_MS) ? window.DESTROY_FADE_MS : 500);
            const timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer() : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : { setTimeout: (fn: any, ms: any) => setTimeout(fn, ms) });
            timer.setTimeout(() => {
                try {
                    cell.classList.remove('has-disc');
                    cell.innerHTML = '';
                } catch (e: any) { /* ignore */ }
                try {
                    if (typeof BoardUpdateDispatch !== 'undefined' && BoardUpdateDispatch && typeof BoardUpdateDispatch.requestBoardUpdate === 'function') {
                        BoardUpdateDispatch.requestBoardUpdate();
                    } else if (typeof emitBoardUpdate === 'function') {
                        emitBoardUpdate();
                    }
                } catch (e: any) { /* ignore */ }
            }, fadeMs + 50);
            return;
        }
    }

    // Clear existing classes and content
    cell.className = 'cell';
    cell.innerHTML = '';
    if (isExpansionCell) {
        cell.classList.add('cell-expanded');
        if (expansionSide) {
            cell.classList.add(`cell-expanded-${expansionSide}`);
        }
        _applyExpansionCellPositionForDiff(cell, row, col, boardShape);
    } else {
        cell.style.top = '';
        cell.style.left = '';
        cell.style.right = '';
        cell.style.bottom = '';
    }

    // Add legal move indicators
    if (state.isLegalFree && !state.blockade && !state.frozen) {
        cell.classList.add('legal-free');
    } else if (state.isLegal && !state.blockade && !state.frozen) {
        cell.classList.add('legal');
    }
    if (state.isSelectedTargetHighlighted) {
        cell.classList.add('effect-target-highlight-positive');
    }
    if (state.isSuperAttractionPathPreview) {
        cell.classList.add('super-attraction-path-preview');
    }
    if (state.isSuperAttractionPreviewDestination) {
        cell.classList.add('super-attraction-preview-destination');
    }
    if (state.isTabooLegal && !state.blockade && !state.frozen) {
        cell.classList.add('effect-target-highlight-positive');
    }
    if (state.isSelectableFriendly && !state.blockade && !state.frozen) {
        cell.classList.add('selectable-friendly');
    }
    if (state.isExtendLifeTarget && !state.blockade && !state.frozen) {
        cell.classList.add('selectable-friendly-no-circle');
    }
    _applyTimeStopLegalEmphasisForDiff(cell);

    if (state.blockade) {
        cell.classList.add('blocked-cell');
        const blockedType = String(state.blockade.type || '').toUpperCase();
        const blockedVisualVariant = String(state.blockade.visualVariant || '').toUpperCase();
        if (blockedType === 'METEOR_HOLE') {
            if (blockedVisualVariant === 'BOARD_FRAME') {
                cell.classList.add('board-shrink-hole-cell');
                const holeMark = document.createElement('div');
                holeMark.className = 'board-shrink-hole-mark';
                const innerBoundaryMask = typeof state.blockade.innerBoundaryMask === 'string'
                    ? state.blockade.innerBoundaryMask.split(',').map((edge: any) => String(edge || '').trim()).filter((edge: any) => !!edge)
                    : [];
                for (const edge of innerBoundaryMask) {
                    const edgeEl = document.createElement('div');
                    edgeEl.className = `board-shrink-hole-inner-edge inner-edge-${edge}`;
                    holeMark.appendChild(edgeEl);
                }
                cell.appendChild(holeMark);
            } else {
                cell.classList.add('meteor-hole-cell');
                const holeMark = document.createElement('div');
                holeMark.className = 'meteor-hole-mark';
                cell.appendChild(holeMark);
            }
        } else {
            const blockadeMark = document.createElement('div');
            blockadeMark.className = 'blockade-mark';
            const remain = Number(state.blockade.remainingOwnerTurns);
            if (Number.isFinite(remain)) {
                const turnLabel = document.createElement('div');
                turnLabel.className = 'blockade-turn';
                turnLabel.textContent = String(Math.max(0, remain));
                blockadeMark.appendChild(turnLabel);
            }
            cell.appendChild(blockadeMark);
        }
    }

    if (state.seed && state.value === EMPTY && !state.blockade) {
        cell.classList.add('seeded-cell');
        const seedMark = document.createElement('div');
        seedMark.className = 'seed-mark';
        const seedIcon = document.createElement('div');
        seedIcon.className = 'seed-icon';
        seedMark.appendChild(seedIcon);
        const remain = Number(state.seed.remainingOwnerTurns);
        if (Number.isFinite(remain)) {
            const turnLabel = document.createElement('div');
            turnLabel.className = 'seed-turn countdown-timer';
            turnLabel.textContent = String(Math.max(0, Math.trunc(remain)));
            _applyDoubleDigitTimerClassForDiff(turnLabel, remain);
            seedMark.appendChild(turnLabel);
        }
        cell.appendChild(seedMark);
    }

    if (state.value === EMPTY && Number.isFinite(state.boardBonus) && state.boardBonus > 0) {
        cell.classList.add('has-board-bonus');
        const bonusLabel = document.createElement('div');
        bonusLabel.className = 'board-bonus-number';
        bonusLabel.textContent = String(state.boardBonus);
        cell.appendChild(bonusLabel);
    }

    // Create disc if occupied
    if (state.value !== EMPTY) {
        cell.classList.add('has-disc');
        const disc = document.createElement('div');
        disc.className = 'disc ' + (state.value === BLACK ? 'black' : 'white');
        const ensureDiscSkeletonForDiff = _getDiscStoneHelperForDiff('ensureDiscSkeleton');
        const setDiscStoneImageForDiff = _getDiscStoneHelperForDiff('setDiscStoneImage');
        const getDiscHudRootForDiff = _getDiscStoneHelperForDiff('getDiscHudRoot');
        if (ensureDiscSkeletonForDiff) ensureDiscSkeletonForDiff(disc);
        const discHud = getDiscHudRootForDiff ? getDiscHudRootForDiff(disc) : disc;

        // Ensure the canonical render state for a normal stone is present before special overlays apply.
        try {
            if (setDiscStoneImageForDiff) {
                setDiscStoneImageForDiff(disc, state.value);
            } else {
                try {
                    disc.style.setProperty('--stone-image', (state.value === BLACK ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)'));
                    disc.style.setProperty('--disc-base-image', (state.value === BLACK ? 'var(--normal-stone-black-image)' : 'var(--normal-stone-white-image)'));
                    disc.dataset.renderMode = 'base-only';
                    disc.dataset.effect = 'normal';
                } catch (e: any) { /* ignore */ }
            }
        } catch (e: any) { /* ignore */ }

        const normalizeOwnerVal = (owner: any) => {
            if (owner === 'black' || owner === BLACK || owner === 1) return BLACK;
            return WHITE;
        };
        const specialStatusSnapshot = state.special
            ? _createSpecialStoneStatusSnapshotForDiff({
                type: state.special.type,
                remainingOwnerTurns: state.special.remainingOwnerTurns,
                flipEvadeRemaining: state.special.flipEvadeRemaining,
                destroyEvadeRemaining: state.special.destroyEvadeRemaining,
                hasGuard: !!state.guard
            }, { mode: 'raw' })
            : null;
        const canShowSpecialFlipEvade = !!(
            specialStatusSnapshot &&
            specialStatusSnapshot.hasFlipEvade &&
            Number.isFinite(state.special.flipEvadeRemaining)
        );
        const canShowDestroyEvade = !!(
            specialStatusSnapshot &&
            specialStatusSnapshot.hasDestroyEvade &&
            Number.isFinite(state.special.destroyEvadeRemaining)
        );

        // Unified special stone visual effect
        if (state.special) {
            const effectKey = getEffectKeyForType(state.special.type);
            if (effectKey) {
                applyStoneVisualEffect(disc, effectKey, { owner: normalizeOwnerVal(state.special.owner) });
            }
            // Robust fallback: ensure reveal-only trap image is visible if visual-map lookup/DI fails.
            if (state.special.type === 'TRAP_REVEAL' && typeof applyTrapStoneFallbackVisual === 'function') {
                applyTrapStoneFallbackVisual(disc, normalizeOwnerVal(state.special.owner));
            }

            // Ensure WORK visuals are applied even if mapping lookup fails
            if (state.special.type === 'WORK') {
                applyStoneVisualEffect(disc, 'workStone', { owner: normalizeOwnerVal(state.special.owner) });
            }

            // Add timer for effects with remaining turns
            if (state.special.remainingOwnerTurns !== undefined) {
                const timer = document.createElement('div');
                timer.className = (specialStatusSnapshot && specialStatusSnapshot.timerClass)
                    ? specialStatusSnapshot.timerClass
                    : 'special-timer';
                const remaining = Math.max(0, Math.trunc(Number(state.special.remainingOwnerTurns)));
                timer.textContent = String(remaining);
                _applyDoubleDigitTimerClassForDiff(timer, remaining);
                discHud.appendChild(timer);
            }

            if (canShowSpecialFlipEvade) {
                const evadeTimer = document.createElement('div');
                evadeTimer.className = 'stone-timer flip-evade-timer';
                const specialEvadeRemaining = Math.max(0, Math.trunc(state.special.flipEvadeRemaining));
                evadeTimer.textContent = String(specialEvadeRemaining);
                _applyDoubleDigitTimerClassForDiff(evadeTimer, specialEvadeRemaining);
                discHud.appendChild(evadeTimer);
            }

            if (canShowDestroyEvade) {
                const destroyEvadeTimer = document.createElement('div');
                destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
                const destroyEvadeRemaining = Math.max(0, Math.trunc(state.special.destroyEvadeRemaining));
                destroyEvadeTimer.textContent = String(destroyEvadeRemaining);
                _applyDoubleDigitTimerClassForDiff(destroyEvadeTimer, destroyEvadeRemaining);
                discHud.appendChild(destroyEvadeTimer);
            }
        }

        if (state.livingWillAura) {
            disc.classList.add('living-will-aura');
        }

        // Add bomb UI (independent of special effects)
        if (state.bomb) {
            const bombOwnerClass = state.bomb.owner === BLACK ? 'bomb-black' : 'bomb-white';
            if (typeof applyStoneVisualEffect === 'function') {
                applyStoneVisualEffect(disc, 'timeBombStone', { owner: state.bomb.owner });
            }
            disc.classList.add('bomb', 'special-stone', bombOwnerClass);
            const timeLabel = document.createElement('div');
            timeLabel.className = 'bomb-timer countdown-timer';
            const bombRemaining = Math.max(0, Math.trunc(Number(state.bomb.remainingTurns)));
            timeLabel.textContent = String(bombRemaining);
            _applyDoubleDigitTimerClassForDiff(timeLabel, bombRemaining);
            discHud.appendChild(timeLabel);
        }

        if (state.guard && typeof state.guard.remainingOwnerTurns === 'number') {
            const guardTimer = document.createElement('div');
            guardTimer.className = 'guard-timer';
            const guardRemaining = Math.max(0, Math.trunc(state.guard.remainingOwnerTurns));
            guardTimer.textContent = String(guardRemaining);
            _applyDoubleDigitTimerClassForDiff(guardTimer, guardRemaining);
            discHud.appendChild(guardTimer);
        }

        if (state.inherited && typeof state.inherited.remainingOwnerTurns === 'number') {
            const inheritedTimer = document.createElement('div');
            inheritedTimer.className = 'stone-timer special-timer inherited-hyperactive-timer';
            const inheritedRemaining = Math.max(0, Math.trunc(state.inherited.remainingOwnerTurns));
            inheritedTimer.textContent = String(inheritedRemaining);
            _applyDoubleDigitTimerClassForDiff(inheritedTimer, inheritedRemaining);
            discHud.appendChild(inheritedTimer);
        }

        if (
            state.inherited &&
            Number.isFinite(state.inherited.flipEvadeRemaining) &&
            !canShowSpecialFlipEvade
        ) {
            const evadeTimer = document.createElement('div');
            evadeTimer.className = 'stone-timer flip-evade-timer';
            const inheritedEvadeRemaining = Math.max(0, Math.trunc(state.inherited.flipEvadeRemaining));
            evadeTimer.textContent = String(inheritedEvadeRemaining);
            _applyDoubleDigitTimerClassForDiff(evadeTimer, inheritedEvadeRemaining);
            discHud.appendChild(evadeTimer);
        }
        if (
            state.inherited &&
            Number.isFinite(state.inherited.destroyEvadeRemaining) &&
            !canShowDestroyEvade
        ) {
            const destroyEvadeTimer = document.createElement('div');
            destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
            const inheritedDestroyEvadeRemaining = Math.max(0, Math.trunc(state.inherited.destroyEvadeRemaining));
            destroyEvadeTimer.textContent = String(inheritedDestroyEvadeRemaining);
            _applyDoubleDigitTimerClassForDiff(destroyEvadeTimer, inheritedDestroyEvadeRemaining);
            discHud.appendChild(destroyEvadeTimer);
        }

        if (state.breedingSprout) {
            disc.classList.add('breeding-sprout');
            const sproutIcon = document.createElement('div');
            sproutIcon.className = 'breeding-sprout-icon';
            discHud.appendChild(sproutIcon);
        }

        cell.appendChild(disc);

        // Fallback flip animation in case PlaybackEngine path fails:
        // when a stone stays occupied but owner changes, add a quick flip class.
        const noAnim = (AnimationShared && typeof AnimationShared.isNoAnim === 'function') ? AnimationShared.isNoAnim() : ((typeof window !== 'undefined' && window.DISABLE_ANIMATIONS === true) || (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)));
        if (!suppressFallbackFlipThisRender && !noAnim && prevState && prevState.value !== EMPTY && prevState.value !== state.value) {
            const flipMs = (typeof window !== 'undefined' && window.AnimationConstants && window.AnimationConstants.FLIP_MS) ? window.AnimationConstants.FLIP_MS : 600;
            try {
                if (AnimationShared && AnimationShared.triggerFlip) AnimationShared.triggerFlip(disc);
                const timer = (AnimationShared && AnimationShared.getTimer) ? AnimationShared.getTimer() : (typeof TimerRegistry !== 'undefined' ? TimerRegistry : { setTimeout: (fn: any, ms: any) => setTimeout(fn, ms) });
                timer.setTimeout(() => { try { if (AnimationShared && AnimationShared.removeFlip) AnimationShared.removeFlip(disc); else disc.classList.remove('flip'); } catch (e: any) { /* Intentionally empty: DOM cleanup guard */ } }, flipMs);
            } catch (e: any) { /* ignore */ }
        }

    }

    if (state.frozen) {
        cell.classList.add('frozen-cell');
        const freezeMark = document.createElement('div');
        freezeMark.className = 'freeze-mark';
        const remain = Number(state.frozen.remainingOwnerTurns);
        if (Number.isFinite(remain)) {
            const turnLabel = document.createElement('div');
            turnLabel.className = 'freeze-turn';
            turnLabel.textContent = String(Math.max(0, Math.trunc(remain)));
            freezeMark.appendChild(turnLabel);
        }
        cell.appendChild(freezeMark);
    }
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
    if (!boardEl || typeof boardEl.querySelectorAll !== 'function') return;
    const cells = boardEl.querySelectorAll('.cell');
    cells.forEach((cell: any) => {
        try {
            const hasDisc = !!cell.querySelector('.disc');
            if (hasDisc) cell.classList.add('has-disc');
            else cell.classList.remove('has-disc');
        } catch (e: any) { /* ignore */ }
    });
}

function reconcileCellHintClasses(boardEl: any, currentState: any) {
    if (!boardEl || !currentState || typeof currentState !== 'object') return;
    const boardShape = _getStateBoardShapeForDiff(currentState);
    const expansionStateMap = new Map(
        _getExpansionStateListForDiff(currentState)
            .filter(Boolean)
            .map((exp: any) => [`${exp.row},${exp.col}`, exp])
    );
    const cells = boardEl.querySelectorAll('.cell');
    cells.forEach((cell: any) => {
        try {
            const row = Number(cell && cell.dataset ? cell.dataset.row : NaN);
            const col = Number(cell && cell.dataset ? cell.dataset.col : NaN);
            if (!Number.isInteger(row) || !Number.isInteger(col)) return;
            const state = (row >= 0 && row < boardShape.rows && col >= 0 && col < boardShape.cols)
                ? currentState[row][col]
                : (expansionStateMap.get(`${row},${col}`) || null);
            const canShowHint = !!(state && !state.blockade && !state.frozen);
            const shouldShowLegalFree = !!(canShowHint && state && state.isLegalFree);
            const shouldShowLegal = !!(canShowHint && state && state.isLegal && !shouldShowLegalFree);
            const shouldShowTabooLegal = !!(canShowHint && state && state.isTabooLegal);
            const shouldShowSelectedTargetHighlight = !!(state && state.isSelectedTargetHighlighted);
            const shouldShowSuperAttractionPathPreview = !!(state && state.isSuperAttractionPathPreview);
            const shouldShowSuperAttractionPreviewDestination = !!(state && state.isSuperAttractionPreviewDestination);
            const shouldShowSelectable = !!(canShowHint && state && state.isSelectableFriendly);
            const shouldShowExtendLifeTarget = !!(canShowHint && state && state.isExtendLifeTarget);

            cell.classList.toggle('legal-free', shouldShowLegalFree);
            cell.classList.toggle('legal', shouldShowLegal);
            cell.classList.toggle('effect-target-highlight', false);
            cell.classList.toggle('effect-target-highlight-positive', shouldShowSelectedTargetHighlight || shouldShowTabooLegal);
            cell.classList.toggle('super-attraction-path-preview', shouldShowSuperAttractionPathPreview);
            cell.classList.toggle('super-attraction-preview-destination', shouldShowSuperAttractionPreviewDestination);
            cell.classList.toggle('selectable-friendly', shouldShowSelectable);
            cell.classList.toggle('selectable-friendly-no-circle', shouldShowExtendLifeTarget);
            _applyTimeStopLegalEmphasisForDiff(cell);
        } catch (e: any) { /* ignore */ }
    });
}

/**
 * 差分レンダリング実行
 * Execute differential rendering
 * @param {HTMLElement} boardEl - 盤面要素
 * @returns {number} 更新されたセル数
 */
function renderBoardDiff(boardEl: any) {
    if (boardEl && boardDomElement && boardDomElement !== boardEl) {
        previousBoardState = null;
        cellCache = [];
        cellCacheMap = new Map();
        boardDomSignature = null;
    }
    if (boardEl) boardDomElement = boardEl;
    // Single Visual Writer detection: prevent diff/rerender during active playback
    const boardUpdateSyncContext = _peekBoardUpdateSyncContextForDiff();
    const allowBoardUpdateDuringPlayback = !!(
        boardUpdateSyncContext
        && boardUpdateSyncContext.allowBoardUpdateDuringPlayback === true
    );
    const shouldDeferBoardUpdate = !!(
        PlaybackStateModule
        && typeof PlaybackStateModule.shouldDeferBoardUpdate === 'function'
        && PlaybackStateModule.shouldDeferBoardUpdate({ cardState: _getCardStateForDiffPlayback() }) === true
    );
    const hasPendingPlaybackEvents = _hasPendingPlaybackEvents();
    const visualPlaybackActive = _isVisualPlaybackActiveForDiff();
    const boardHasPlaybackLock = !!(boardEl && boardEl.classList && boardEl.classList.contains('playback-locked'));
    if ((hasPendingPlaybackEvents || (visualPlaybackActive && boardHasPlaybackLock)) && shouldDeferBoardUpdate && !allowBoardUpdateDuringPlayback) {
        if (typeof window !== 'undefined' && window.__DEV__ === true) {
            throw new Error('renderBoardDiff called during active VisualPlayback (dev fail-fast)');
        } else {
            // Do not abort playback here; aborting causes animations to disappear mid-sequence.
            // Instead, skip this render. AnimationEngine requests a final emitBoardUpdate after playback ends.
            console.warn('renderBoardDiff called during active VisualPlayback. Skipping diff render until playback ends.');
            if (typeof window !== 'undefined') { window.__telemetry__ = window.__telemetry__ || { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }; window.__telemetry__.singleVisualWriterHits = (window.__telemetry__.singleVisualWriterHits || 0) + 1; }
            return 0;
        }
    }

    // One-shot suppression set by AnimationEngine at the end of playback.
    // This prevents DiffRenderer from replaying the fallback ".flip" when syncing the final board state.
    _consumeBoardUpdateSyncContextForDiff();
    const boardUpdateContext = _consumeBoardUpdateContextForDiff();
    suppressFallbackFlipThisRender = !!(boardUpdateContext && boardUpdateContext.suppressFallbackFlip === true);
    suppressBoardExpansionRevealSoundThisRender = !!(boardUpdateContext && boardUpdateContext.suppressBoardExpansionRevealSound === true);
    pendingMoveSourceKeysThisRender = _collectPendingMoveSourceKeysForDiff();

    try {
        const gameState = _resolveGameStateForDiffRender();
        const nextSignature = _getBoardDomSignatureForDiff(gameState);
        // 初回またはキャッシュが空の場合は全レンダリング
        if (!cellCacheMap.size || boardDomSignature !== nextSignature) {
            const nextExpansions = _getExpansionDescriptorsForDiff(gameState);
            const revealExpansionKeys = _getExpansionRevealKeysForDiff(
                previousBoardState,
                nextExpansions,
                !!cellCacheMap.size && boardDomSignature !== null
            );
            initializeBoardDOM(boardEl);
            previousBoardState = buildCurrentCellState();
            const initialBoardShape = _getStateBoardShapeForDiff(previousBoardState);
            // Initial full render
            for (let r = 0; r < initialBoardShape.rows; r++) {
                for (let c = 0; c < initialBoardShape.cols; c++) {
                    const cell = _getCachedCell(r, c);
                    if (cell) updateCellDOM(cell, previousBoardState[r][c], r, c, null);
                }
            }
            const initialExpansions = _getExpansionStateListForDiff(previousBoardState);
            for (const exp of initialExpansions) {
                if (!exp) continue;
                const expCell = _getCachedCell(exp.row, exp.col);
                if (expCell) {
                    updateCellDOM(expCell, exp, exp.row, exp.col, null);
                    if (revealExpansionKeys.has(`${exp.row},${exp.col}`)) {
                        expCell.classList.add('cell-expanded-reveal');
                    }
                }
            }
            reconcileCellHasDiscClasses(boardEl);
            reconcileCellHintClasses(boardEl, previousBoardState);
            _scheduleBoardExpansionRevealSoundForDiff(revealExpansionKeys, nextSignature);
            if (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true) {
                console.log('[DiffRenderer] Initial full render complete');
            }
            return cellCacheMap.size;
        }

        const currentState = buildCurrentCellState();
        const currentBoardShape = _getStateBoardShapeForDiff(currentState);
        let updatedCount = 0;

        // 差分検出と更新
        for (let r = 0; r < currentBoardShape.rows; r++) {
            for (let c = 0; c < currentBoardShape.cols; c++) {
                const prev = previousBoardState ? previousBoardState[r][c] : null;
                const curr = currentState[r][c];

                if (!cellStatesEqual(prev, curr)) {
                    const cell = _getCachedCell(r, c);
                    if (cell) {
                        updateCellDOM(cell, curr, r, c, prev);
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
                    updateCellDOM(cell, currExp, currExp.row, currExp.col, prevExp);
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

        return updatedCount;
    } finally {
        suppressFallbackFlipThisRender = false;
        suppressBoardExpansionRevealSoundThisRender = false;
        pendingMoveSourceKeysThisRender = null;
    }
}

/**
 * 強制的に全セルを再レンダリング
 * Force full re-render of all cells
 * @param {HTMLElement} boardEl - 盤面要素
 */
function forceFullRender(boardEl: any) {
    previousBoardState = null;
    cellCache = [];
    cellCacheMap = new Map();
    boardDomSignature = null;
    initializeBoardDOM(boardEl);
    renderBoardDiff(boardEl);
    if (typeof window !== 'undefined' && window.DEBUG_WORK_VISUALS === true) {
        console.log('[DiffRenderer] Full render forced');
    }
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
    buildCurrentCellState,
    renderBoardDiff,
    forceFullRender,
    resetRenderStats,
    attachBoardCellInteraction,
    showSpecialStoneInfoAt
};
export = DiffRenderer;
if (typeof window !== 'undefined') {
    window.forceFullRender = forceFullRender;
    window.resetRenderStats = resetRenderStats;
    window.attachBoardCellInteraction = attachBoardCellInteraction;
    window.showSpecialStoneInfoAt = showSpecialStoneInfoAt;
}
