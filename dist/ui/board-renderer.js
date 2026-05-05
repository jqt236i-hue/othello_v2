"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
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
var OwnerHelpersModule = null;
if (typeof require === 'function') {
    try {
        OwnerHelpersModule = require('../utils/owner-helpers');
    }
    catch (e) { /* ignore */ }
}
if (!OwnerHelpersModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.OwnerHelpers)
            OwnerHelpersModule = globalThis.OwnerHelpers;
    }
    catch (e) { /* ignore */ }
}
var BoardRendererSoundEngineAccessModule = null;
if (typeof require === 'function') {
    try {
        BoardRendererSoundEngineAccessModule = require('./sound-engine-access');
    }
    catch (e) { /* ignore */ }
}
function _getBoardShapeForBoardRenderer() {
    const state = (typeof gameState !== 'undefined' && gameState && typeof gameState === 'object')
        ? gameState
        : ((typeof window !== 'undefined' && window.gameState && typeof window.gameState === 'object') ? window.gameState : null);
    const board = state && Array.isArray(state.board) ? state.board : null;
    let rows = Array.isArray(board) ? board.length : 8;
    let cols = 0;
    if (Array.isArray(board)) {
        for (const row of board) {
            if (Array.isArray(row))
                cols = Math.max(cols, row.length);
        }
    }
    if (!Number.isInteger(rows) || rows <= 0)
        rows = 8;
    if (!Number.isInteger(cols) || cols <= 0)
        cols = 8;
    return { rows, cols };
}
let boardPixelSizingObserver = null;
let boardPixelSizingObservedFrame = null;
let boardPixelSizingObservedElement = null;
let boardPixelSizingWindowHandlerInstalled = false;
let timeStopBgmPausedByBoardRenderer = false;
const STANDARD_BOARD_BASELINE_ROWS = 8;
const STANDARD_BOARD_BASELINE_COLS = 8;
const BOARD_FRAME_OVERSIZE_TOLERANCE_PX = 1;
function _resolveSoundEngineAccessForBoardRenderer() {
    if (BoardRendererSoundEngineAccessModule)
        return BoardRendererSoundEngineAccessModule;
    try {
        if (typeof window !== 'undefined' && window.SoundEngineAccessModule) {
            BoardRendererSoundEngineAccessModule = window.SoundEngineAccessModule;
            return BoardRendererSoundEngineAccessModule;
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SoundEngineAccessModule) {
            BoardRendererSoundEngineAccessModule = globalThis.SoundEngineAccessModule;
            return BoardRendererSoundEngineAccessModule;
        }
    }
    catch (e) { /* ignore */ }
    return null;
}
function _resolveSoundEngineForBoardRenderer() {
    const accessModule = _resolveSoundEngineAccessForBoardRenderer();
    if (accessModule && typeof accessModule.resolveSoundEngine === 'function') {
        return accessModule.resolveSoundEngine(typeof window !== 'undefined' ? window : globalThis);
    }
    try {
        if (typeof SoundEngine !== 'undefined' && SoundEngine)
            return SoundEngine;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.SoundEngine)
            return window.SoundEngine;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SoundEngine)
            return globalThis.SoundEngine;
    }
    catch (e) { /* ignore */ }
    return null;
}
function _isBgmPlayingForBoardRenderer(engine) {
    const accessModule = _resolveSoundEngineAccessForBoardRenderer();
    if (accessModule && typeof accessModule.isBgmPlaying === 'function') {
        return accessModule.isBgmPlaying(engine);
    }
    return !!(engine && engine.allowBgmPlay === true && engine.bgm && engine.bgm.paused !== true);
}
function _isBoardShapeOversizeForPixelSizing(shape) {
    const rows = shape && Number.isFinite(shape.rows) ? shape.rows : STANDARD_BOARD_BASELINE_ROWS;
    const cols = shape && Number.isFinite(shape.cols) ? shape.cols : STANDARD_BOARD_BASELINE_COLS;
    return rows > STANDARD_BOARD_BASELINE_ROWS || cols > STANDARD_BOARD_BASELINE_COLS;
}
function _normalizeBoardShapeForPixelSizing(shapeOrState) {
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
function _clearBoardPixelSizingVars(boardElement) {
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
    const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
    _clearBoardFramePixelSizingVars(frameElement);
    _setBoardOversizeLayoutState(frameElement, false);
}
function _getBoardFrameElementForPixelSizing(boardElement) {
    if (!boardElement)
        return null;
    if (typeof boardElement.closest === 'function') {
        const closestFrame = boardElement.closest('#board-frame');
        if (closestFrame)
            return closestFrame;
    }
    if (typeof document !== 'undefined' && document && typeof document.getElementById === 'function') {
        return document.getElementById('board-frame');
    }
    return null;
}
function _clearBoardFramePixelSizingVars(frameElement) {
    if (!frameElement || !frameElement.style)
        return;
    frameElement.style.removeProperty('--board-frame-outer-width');
    frameElement.style.removeProperty('--board-frame-outer-height');
}
function _getBoardLayoutContainerForPixelSizing(frameElement) {
    if (frameElement && typeof frameElement.closest === 'function') {
        const closestContainer = frameElement.closest('#game-container');
        if (closestContainer)
            return closestContainer;
    }
    if (typeof document !== 'undefined' && document && typeof document.getElementById === 'function') {
        return document.getElementById('game-container');
    }
    return null;
}
function _setBoardOversizeLayoutState(frameElement, active) {
    const oversizeActive = !!active;
    if (typeof document !== 'undefined' && document && document.body && document.body.classList) {
        document.body.classList.toggle('board-oversize-active', oversizeActive);
    }
    const layoutContainer = _getBoardLayoutContainerForPixelSizing(frameElement);
    if (layoutContainer && layoutContainer.classList) {
        layoutContainer.classList.toggle('board-oversize-active', oversizeActive);
    }
}
function _measureBoardFrameBaseOuterSize(frameElement) {
    if (!frameElement || typeof document === 'undefined' || !document || typeof document.createElement !== 'function') {
        return null;
    }
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.position = 'absolute';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = 'calc(var(--board-frame-inner-size) + (var(--board-frame-padding) * 2))';
    probe.style.height = 'calc(var(--board-frame-inner-size) + (var(--board-frame-padding) * 2))';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.boxSizing = 'border-box';
    probe.style.padding = '0';
    probe.style.margin = '0';
    probe.style.border = '0';
    frameElement.appendChild(probe);
    let rect = null;
    if (typeof probe.getBoundingClientRect === 'function') {
        rect = probe.getBoundingClientRect();
    }
    frameElement.removeChild(probe);
    if (!rect || !(rect.width > 0) || !(rect.height > 0))
        return null;
    return { width: rect.width, height: rect.height };
}
function _getContentRectSizeForPixelSizing(element) {
    if (!element || typeof window === 'undefined' || typeof window.getComputedStyle !== 'function' || typeof element.getBoundingClientRect !== 'function') {
        return null;
    }
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    const borderX = Number.parseFloat(style.borderLeftWidth || '0') + Number.parseFloat(style.borderRightWidth || '0');
    const borderY = Number.parseFloat(style.borderTopWidth || '0') + Number.parseFloat(style.borderBottomWidth || '0');
    const width = rect.width - (Number.isFinite(borderX) ? borderX : 0);
    const height = rect.height - (Number.isFinite(borderY) ? borderY : 0);
    if (!(width > 0) || !(height > 0))
        return null;
    return { width, height };
}
function _getBoardBoxMetricsForPixelSizing(boardElement) {
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
function _getBoardFrameMetricsForPixelSizing(boardElement) {
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
function _getBoardBaseSizeForPixelSizing(boardElement) {
    const frameMetrics = _getBoardFrameMetricsForPixelSizing(boardElement);
    if (frameMetrics) {
        return {
            frameMetrics,
            width: frameMetrics.innerWidth,
            height: frameMetrics.innerHeight,
            baselineCellSize: Math.max(1, Math.floor(Math.min(frameMetrics.innerWidth / STANDARD_BOARD_BASELINE_COLS, frameMetrics.innerHeight / STANDARD_BOARD_BASELINE_ROWS)))
        };
    }
    const contentRect = _getContentRectSizeForPixelSizing(boardElement);
    if (!contentRect)
        return null;
    return {
        frameMetrics: null,
        width: contentRect.width,
        height: contentRect.height,
        baselineCellSize: 0
    };
}
function _applyBoardFramePixelSizing(frameMetrics, outerWidth, outerHeight, shape) {
    if (!frameMetrics || !frameMetrics.frameElement || !frameMetrics.frameElement.style)
        return;
    const frameWidth = Math.max(frameMetrics.baseOuterWidth, outerWidth + frameMetrics.paddingX);
    const frameHeight = Math.max(frameMetrics.baseOuterHeight, outerHeight + frameMetrics.paddingY);
    const allowFrameExpansion = _isBoardShapeOversizeForPixelSizing(shape);
    const oversizeActive = allowFrameExpansion && (frameWidth > (frameMetrics.baseOuterWidth + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)
        || frameHeight > (frameMetrics.baseOuterHeight + BOARD_FRAME_OVERSIZE_TOLERANCE_PX));
    if (allowFrameExpansion && frameWidth > (frameMetrics.baseOuterWidth + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)) {
        frameMetrics.frameElement.style.setProperty('--board-frame-outer-width', `${frameWidth}px`);
    }
    else {
        frameMetrics.frameElement.style.removeProperty('--board-frame-outer-width');
    }
    if (allowFrameExpansion && frameHeight > (frameMetrics.baseOuterHeight + BOARD_FRAME_OVERSIZE_TOLERANCE_PX)) {
        frameMetrics.frameElement.style.setProperty('--board-frame-outer-height', `${frameHeight}px`);
    }
    else {
        frameMetrics.frameElement.style.removeProperty('--board-frame-outer-height');
    }
    _setBoardOversizeLayoutState(frameMetrics.frameElement, oversizeActive);
}
function _handleBoardPixelSizingViewportChange() {
    if (!boardPixelSizingObservedElement)
        return;
    syncBoardPixelSizing(boardPixelSizingObservedElement);
}
function _ensureBoardPixelSizingObserver(boardElement) {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function' && !boardPixelSizingWindowHandlerInstalled) {
        window.addEventListener('resize', _handleBoardPixelSizingViewportChange, { passive: true });
        boardPixelSizingWindowHandlerInstalled = true;
    }
    boardPixelSizingObservedElement = boardElement || boardPixelSizingObservedElement;
    const frameElement = _getBoardFrameElementForPixelSizing(boardElement);
    if (typeof ResizeObserver !== 'function' || !frameElement)
        return;
    if (boardPixelSizingObserver && boardPixelSizingObservedFrame === frameElement)
        return;
    if (boardPixelSizingObserver && typeof boardPixelSizingObserver.disconnect === 'function') {
        try {
            boardPixelSizingObserver.disconnect();
        }
        catch (e) { /* ignore */ }
    }
    boardPixelSizingObservedFrame = frameElement;
    try {
        boardPixelSizingObserver = new ResizeObserver(_handleBoardPixelSizingViewportChange);
        boardPixelSizingObserver.observe(frameElement);
    }
    catch (e) {
        boardPixelSizingObserver = null;
    }
}
function syncBoardPixelSizing(boardElement, shapeInput) {
    const shape = _normalizeBoardShapeForPixelSizing(shapeInput);
    if (!boardElement || !boardElement.style)
        return shape;
    _ensureBoardPixelSizingObserver(boardElement);
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
    return shape;
}
function _applyBoardCssVarsForBoardRenderer(boardElement) {
    const shape = _getBoardShapeForBoardRenderer();
    if (boardElement && boardElement.style) {
        boardElement.style.setProperty('--board-rows', String(shape.rows));
        boardElement.style.setProperty('--board-cols', String(shape.cols));
    }
    syncBoardPixelSizing(boardElement, shape);
    return shape;
}
var PlaybackStateModule = null;
if (typeof require === 'function') {
    try {
        PlaybackStateModule = require('./playback-state-manager');
    }
    catch (e) { /* ignore */ }
}
if (!PlaybackStateModule) {
    try {
        if (typeof globalThis !== 'undefined' && globalThis.PlaybackStateManager)
            PlaybackStateModule = globalThis.PlaybackStateManager;
    }
    catch (e) { /* ignore */ }
}
function _isVisualPlaybackActiveForBoardRenderer() {
    if (PlaybackStateModule && typeof PlaybackStateModule.getPlaybackActive === 'function') {
        return PlaybackStateModule.getPlaybackActive() === true;
    }
    return false;
}
function _getCardStateForBoardRendererPlayback() {
    try {
        if (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
            return cardState;
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object')
            return window.cardState;
    }
    catch (e) { /* ignore */ }
    return null;
}
function _hasPendingPlaybackEventsForBoardRenderer() {
    if (PlaybackStateModule && typeof PlaybackStateModule.hasPendingVisualPlayback === 'function') {
        try {
            return PlaybackStateModule.hasPendingVisualPlayback(_getCardStateForBoardRendererPlayback()) === true;
        }
        catch (e) { /* ignore */ }
    }
    return false;
}
function _shouldSkipBoardRenderForPlayback() {
    if (PlaybackStateModule && typeof PlaybackStateModule.shouldDeferBoardUpdate === 'function') {
        try {
            return PlaybackStateModule.shouldDeferBoardUpdate({
                cardState: _getCardStateForBoardRendererPlayback()
            }) === true;
        }
        catch (e) { /* ignore */ }
    }
    return _isVisualPlaybackActiveForBoardRenderer() || _hasPendingPlaybackEventsForBoardRenderer();
}
function _isTimeStopActiveForBoardRenderer() {
    try {
        const state = (typeof cardState !== 'undefined' && cardState && typeof cardState === 'object')
            ? cardState
            : ((typeof window !== 'undefined' && window.cardState && typeof window.cardState === 'object') ? window.cardState : null);
        const remainingByPlayer = state && state.timeStopConsecutiveTurnsRemainingByPlayer;
        if (!remainingByPlayer || typeof remainingByPlayer !== 'object')
            return false;
        const blackRemaining = Number(remainingByPlayer.black);
        const whiteRemaining = Number(remainingByPlayer.white);
        return (Number.isFinite(blackRemaining) && blackRemaining > 0) || (Number.isFinite(whiteRemaining) && whiteRemaining > 0);
    }
    catch (e) {
        return false;
    }
}
function _syncTimeStopClassForBoardRenderer() {
    if (typeof document === 'undefined')
        return;
    const active = _isTimeStopActiveForBoardRenderer();
    const soundEngine = _resolveSoundEngineForBoardRenderer();
    if (soundEngine && typeof soundEngine.pauseBgm === 'function' && typeof soundEngine.playBgm === 'function') {
        if (active) {
            if (_isBgmPlayingForBoardRenderer(soundEngine)) {
                timeStopBgmPausedByBoardRenderer = true;
                try {
                    soundEngine.pauseBgm();
                }
                catch (e) {
                    timeStopBgmPausedByBoardRenderer = false;
                }
            }
        }
        else if (timeStopBgmPausedByBoardRenderer) {
            timeStopBgmPausedByBoardRenderer = false;
            try {
                soundEngine.playBgm();
            }
            catch (e) { /* ignore */ }
        }
    }
    else if (!active) {
        timeStopBgmPausedByBoardRenderer = false;
    }
    try {
        if (document.documentElement && document.documentElement.classList) {
            document.documentElement.classList.toggle('time-stop-active', active);
        }
        if (document.body && document.body.classList) {
            document.body.classList.toggle('time-stop-active', active);
        }
    }
    catch (e) {
        // UI only
    }
}
function applyTimeStopLegalEmphasis(cell, active) {
    if (!cell || !cell.classList)
        return;
    const shouldEmphasize = !!active && (cell.classList.contains('legal') ||
        cell.classList.contains('legal-free') ||
        cell.classList.contains('selectable-friendly'));
    cell.classList.toggle('time-stop-legal-emphasis', shouldEmphasize);
}
function _addPendingSelectedTargetHighlightKey(out, target) {
    if (!out || !target)
        return;
    const row = Number(target.row);
    const col = Number(target.col);
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return;
    out.add(`${row},${col}`);
}
function collectPendingSelectedTargetHighlightKeys(pending) {
    const out = new Set();
    if (!pending || pending.stage !== 'selectTarget')
        return out;
    const pendingType = String(pending.type || '').toUpperCase();
    if (pendingType === 'POSITION_SWAP_WILL' ||
        pendingType === 'BOARD_EXPANSION_GOD' ||
        pendingType === 'BOARD_SHRINK_GOD') {
        _addPendingSelectedTargetHighlightKey(out, pending.firstTarget);
    }
    if (pendingType === 'BOARD_EXPANSION_GOD' ||
        pendingType === 'BOARD_SHRINK_WILL') {
        const selectedTargets = Array.isArray(pending.selectedTargets) ? pending.selectedTargets : [];
        for (const target of selectedTargets) {
            _addPendingSelectedTargetHighlightKey(out, target);
        }
    }
    return out;
}
function renderBoard() {
    _syncTimeStopClassForBoardRenderer();
    // Single Visual Writer: skip renders while playback is active or already queued.
    if (_shouldSkipBoardRenderForPlayback()) {
        return;
    }
    // Determine whether we are in a "target selection" card mode.
    // In selection mode, normal "placeable move" hints must not appear.
    try {
        const player = gameState.currentPlayer;
        const playerKey = getPlayerKey(player);
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        const selectableTargets = (typeof CardLogic !== 'undefined' && CardLogic && typeof CardLogic.getSelectableTargets === 'function')
            ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
            : [];
        const isSelectingTarget = !!(pending &&
            pending.stage === 'selectTarget' &&
            Array.isArray(selectableTargets) &&
            selectableTargets.length > 0);
        if (boardEl)
            boardEl.classList.toggle('selection-mode', isSelectingTarget);
    }
    catch (e) {
        // UI only
    }
    syncBoardPixelSizing(boardEl);
    // Use differential rendering if available
    if (typeof renderBoardDiff === 'function') {
        renderBoardDiff(boardEl);
    }
    else {
        // diff-renderer is required; avoid legacy full render path
        console.error('[Board Renderer] diff-renderer.js not loaded; rendering skipped');
        return;
    }
    updateOccupancyUI();
}
/**
 * フォールバック：全セル再描画
 * Fallback: Full board re-render (legacy method)
 */
function _isBoardHiddenTrapForBoardRenderer(marker) {
    if (!marker || !marker.data || marker.data.type !== 'TRAP')
        return false;
    // Hidden traps stay visually normal for both seats until reveal timing events.
    return true;
}
function _isFlipEvadeSpecialTypeForBoard(type) {
    const typeUpper = String(type || '').toUpperCase();
    return (typeUpper === 'HYPERACTIVE' ||
        typeUpper === 'EXTREME_HYPERACTIVE' ||
        typeUpper === 'ESCAPE_HYPERACTIVE' ||
        typeUpper === 'ULTIMATE_HYPERACTIVE' ||
        typeUpper === 'WILL_HUNTER_KING' ||
        typeUpper === 'AFTERIMAGE_WILL');
}
function _isDestroyEvadeSpecialTypeForBoard(type) {
    const typeUpper = String(type || '').toUpperCase();
    return typeUpper === 'WILL_HUNTER_KING' || typeUpper === 'ULTIMATE_HYPERACTIVE' || typeUpper === 'EXTREME_HYPERACTIVE' || typeUpper === 'AFTERIMAGE_WILL';
}
function _resolveDestroyEvadeDisplayForBoard(special, inherited) {
    const specialTypeUpper = String(special && special.type ? special.type : '').toUpperCase();
    const specialSupportsDestroyEvade = _isDestroyEvadeSpecialTypeForBoard(specialTypeUpper);
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
function _resolveStrongWillDisplayTurnsForBoard(data) {
    if (String(data && data.type ? data.type : '').toUpperCase() !== 'PERMA_PROTECTED')
        return undefined;
    const rawThreshold = Number(data && data.strongWillPromotionThreshold);
    const threshold = Number.isFinite(rawThreshold) ? Math.max(1, Math.trunc(rawThreshold)) : 10;
    const rawProgress = Number(data && data.strongWillPromotionOwnerTurnStarts);
    const progress = Number.isFinite(rawProgress) ? Math.max(0, Math.trunc(rawProgress)) : 0;
    return Math.max(0, threshold - progress);
}
function _resolveSpecialDisplayTurnsForBoard(data) {
    const primary = Number(data && data.remainingOwnerTurns);
    if (Number.isFinite(primary))
        return Math.max(0, Math.trunc(primary));
    const strongWillRemaining = _resolveStrongWillDisplayTurnsForBoard(data);
    if (strongWillRemaining !== undefined)
        return strongWillRemaining;
    if (String(data && data.type ? data.type : '').toUpperCase() === 'REGEN') {
        const regenRemaining = Number(data && data.regenRemaining);
        if (Number.isFinite(regenRemaining))
            return Math.max(0, Math.trunc(regenRemaining));
    }
    return undefined;
}
function _isBombCategoryMarkerForBoard(marker) {
    if (!marker || typeof marker !== 'object')
        return false;
    if (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.isBombCategoryMarker === 'function') {
        return MarkersAdapter.isBombCategoryMarker(marker);
    }
    const data = (marker.data && typeof marker.data === 'object') ? marker.data : null;
    const category = String(data && data.category ? data.category : '').trim().toLowerCase();
    const type = String(data && data.type ? data.type : '').trim().toUpperCase();
    return marker.kind === 'bomb' || category === 'bomb' || type === 'TIME_BOMB';
}
function _applyDoubleDigitTimerClassForBoard(timerElement, rawValue) {
    if (!timerElement)
        return;
    const numericValue = Number(rawValue);
    if (!Number.isFinite(numericValue))
        return;
    if (Math.abs(Math.trunc(numericValue)) >= 10) {
        timerElement.classList.add('timer-double-digit');
    }
}
function _resolveNetworkLocalPlayerKeyForBoard() {
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.resolveLocalPlayerKey === 'function') {
            return OwnerHelpersModule.resolveLocalPlayerKey(typeof window !== 'undefined' ? window : null);
        }
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined') {
            if (window.NetworkMatchClient && typeof window.NetworkMatchClient.getSeatKey === 'function') {
                const seatKey = window.NetworkMatchClient.getSeatKey();
                if (seatKey === 'white' || seatKey === 'black')
                    return seatKey;
            }
            const directKeys = [window.LOCAL_PLAYER_KEY, window.__LOCAL_PLAYER_KEY, window.BOARD_VIEWER_KEY];
            for (const key of directKeys) {
                if (key === 'white' || key === 'black')
                    return key;
            }
        }
    }
    catch (e) { /* ignore */ }
    return 'black';
}
function _canLocalPlayerControlCurrentTurnForBoard() {
    let isNetworkMode = false;
    try {
        if (OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function') {
            isNetworkMode = OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null);
        }
        else {
            let matchMode = null;
            try {
                matchMode = (typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
                    ? window.getCurrentMatchMode()
                    : (typeof window !== 'undefined' ? window.MATCH_MODE : null);
            }
            catch (e) { /* ignore */ }
            isNetworkMode = matchMode === 'network';
        }
    }
    catch (e) { /* ignore */ }
    const currentPlayerKey = gameState.currentPlayer === WHITE ? 'white' : 'black';
    const isHvH = !!(typeof window !== 'undefined' && window.DEBUG_HUMAN_VS_HUMAN === true);
    // FATE_WILL: if another player controls this turn, only the controller can operate.
    // Applies in network mode and in local non-HvH mode.
    if (isNetworkMode || !isHvH) {
        const cs = (typeof cardState !== 'undefined' && cardState) ? cardState : null;
        const fwc = cs && cs.fateWillControllerByTurnOwner;
        const controller = fwc && fwc[currentPlayerKey];
        if (controller) {
            const localPlayerKey = _resolveNetworkLocalPlayerKeyForBoard();
            return controller === localPlayerKey;
        }
    }
    if (!isNetworkMode)
        return true;
    const localPlayerKey = _resolveNetworkLocalPlayerKeyForBoard();
    return currentPlayerKey === localPlayerKey;
}
function renderBoardFull() {
    _syncTimeStopClassForBoardRenderer();
    // Single Visual Writer: skip renders while playback is active or already queued.
    if (_shouldSkipBoardRenderForPlayback()) {
        return;
    }
    boardEl.innerHTML = '';
    const player = gameState.currentPlayer;
    const context = CardLogic.getCardContext(cardState);
    const playerKey = getPlayerKey(player);
    const pending = cardState.pendingEffectByPlayer[playerKey];
    const isTabooReversePending = !!(pending && pending.type === 'TABOO_REVERSE_WILL');
    const timeStopActive = _isTimeStopActiveForBoardRenderer();
    const freePlacementActive = !!(pending && ((typeof CardLogic !== 'undefined' &&
        CardLogic &&
        typeof CardLogic.isFreePlacementPendingType === 'function' &&
        CardLogic.isFreePlacementPendingType(pending.type)) ||
        pending.type === 'FREE_PLACEMENT' ||
        pending.type === 'SNIPER_WILL' ||
        pending.type === 'LAST_RESORT'));
    const selectableTargets = CardLogic.getSelectableTargets
        ? CardLogic.getSelectableTargets(cardState, gameState, playerKey)
        : [];
    const isSelectingTarget = !!(pending &&
        pending.stage === 'selectTarget' &&
        Array.isArray(selectableTargets) &&
        selectableTargets.length > 0);
    if (boardEl)
        boardEl.classList.toggle('selection-mode', isSelectingTarget);
    const boardShape = _applyBoardCssVarsForBoardRenderer(boardEl);
    const selectableTargetSet = new Set(selectableTargets.map((p) => p.row + ',' + p.col));
    const isNetworkMode = !!(OwnerHelpersModule && typeof OwnerHelpersModule.isNetworkMode === 'function'
        ? OwnerHelpersModule.isNetworkMode(typeof window !== 'undefined' ? window : null)
        : ((typeof window !== 'undefined' && typeof window.getCurrentMatchMode === 'function')
            ? window.getCurrentMatchMode() === 'network'
            : ((typeof window !== 'undefined' ? window.MATCH_MODE : null) === 'network')));
    // FATE_WILL: show legal hints and allow interaction during the controlled (victim's) turn.
    const isFateWillControlledTurn = !!(cardState && cardState.fateWillControllerByTurnOwner && cardState.fateWillControllerByTurnOwner[playerKey]);
    const isHumanTurn = isNetworkMode
        ? _canLocalPlayerControlCurrentTurnForBoard()
        : ((gameState.currentPlayer === BLACK) ||
            (window.DEBUG_HUMAN_VS_HUMAN && gameState.currentPlayer === WHITE) ||
            isFateWillControlledTurn);
    const showLegalHints = isHumanTurn && !isSelectingTarget && _canLocalPlayerControlCurrentTurnForBoard();
    const selectedTargetHighlightSet = isHumanTurn
        ? collectPendingSelectedTargetHighlightKeys(pending)
        : new Set();
    let normalLegalSet = new Set();
    if (showLegalHints) {
        const legalMoves = getLegalMoves(gameState, context.protectedStones, context.permaProtectedStones);
        normalLegalSet = new Set(legalMoves.map((m) => `${m.row},${m.col}`));
    }
    const tabooLegalSet = new Set();
    if (showLegalHints && isTabooReversePending && typeof CardLogic.getTabooReverseCandidates === 'function') {
        for (let r = 0; r < boardShape.rows; r++) {
            for (let c = 0; c < boardShape.cols; c++) {
                if (gameState.board[r][c] !== EMPTY)
                    continue;
                const candidates = CardLogic.getTabooReverseCandidates(cardState, gameState, playerKey, r, c);
                if (!Array.isArray(candidates) || candidates.length === 0)
                    continue;
                tabooLegalSet.add(`${r},${c}`);
            }
        }
    }
    const legalSet = new Set([...normalLegalSet, ...tabooLegalSet]);
    // Build unified special/bomb maps from markers (primary)
    const markerKinds = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && MarkersAdapter.MARKER_KINDS)
        ? MarkersAdapter.MARKER_KINDS
        : { SPECIAL_STONE: 'specialStone', BOMB: 'bomb' };
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const specialMap = new Map();
    const guardMap = new Map();
    const livingWillMap = new Map();
    const inheritedMap = new Map();
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
        if (m.kind === markerKinds.SPECIAL_STONE && m.data && m.data.type) {
            if (_isBoardHiddenTrapForBoardRenderer(m))
                continue;
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
            specialMap.set(`${m.row},${m.col}`, {
                row: m.row,
                col: m.col,
                type: m.data.type,
                owner: m.owner,
                remainingOwnerTurns: _resolveSpecialDisplayTurnsForBoard(m.data),
                destroyEvadeRemaining: _isDestroyEvadeSpecialTypeForBoard(markerTypeUpper)
                    ? (Number.isFinite(Number(m.data.destroyEvadeRemaining))
                        ? Math.max(0, Math.trunc(Number(m.data.destroyEvadeRemaining)))
                        : ((markerTypeUpper === 'ULTIMATE_HYPERACTIVE' || markerTypeUpper === 'EXTREME_HYPERACTIVE') ? 1 : null))
                    : null,
                flipEvadeRemaining: _isFlipEvadeSpecialTypeForBoard(markerTypeUpper)
                    ? (Number.isFinite(Number(m.data.flipEvadeRemaining))
                        ? Math.max(0, Math.trunc(Number(m.data.flipEvadeRemaining)))
                        : ((markerTypeUpper === 'ULTIMATE_HYPERACTIVE' || markerTypeUpper === 'EXTREME_HYPERACTIVE') ? 3 : null))
                    : 0
            });
        }
    }
    try {
        const sproutByOwner = (cardState && cardState.breedingSproutByOwner && typeof cardState.breedingSproutByOwner === 'object')
            ? cardState.breedingSproutByOwner
            : { black: [], white: [] };
        const addSprout = (ownerKey, positions) => {
            const ownerVal = ownerKey === 'black' ? BLACK : WHITE;
            if (!Array.isArray(positions))
                return;
            for (const p of positions) {
                if (!p || !Number.isInteger(p.row) || !Number.isInteger(p.col))
                    continue;
                if (p.row < 0 || p.row >= boardShape.rows || p.col < 0 || p.col >= boardShape.cols)
                    continue;
                if (gameState.board[p.row][p.col] !== ownerVal)
                    continue;
                sproutMap.set(`${p.row},${p.col}`, true);
            }
        };
        addSprout('black', sproutByOwner.black);
        addSprout('white', sproutByOwner.white);
    }
    catch (e) { /* ignore */ }
    // Helper for effect key mapping: delegate to canonical visual-effects map.
    const getEffectKeyForType = (type) => {
        if (typeof getEffectKeyForSpecialType === 'function')
            return getEffectKeyForSpecialType(type);
        try {
            if (typeof SPECIAL_TYPE_TO_EFFECT_KEY !== 'undefined' && SPECIAL_TYPE_TO_EFFECT_KEY) {
                return SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
            }
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof window !== 'undefined' && window.SPECIAL_TYPE_TO_EFFECT_KEY) {
                return window.SPECIAL_TYPE_TO_EFFECT_KEY[type] || null;
            }
        }
        catch (e) { /* ignore */ }
        return null;
    };
    // Helper to normalize owner
    const getOwnerVal = (owner) => {
        if (owner === 'black' || owner === BLACK || owner === 1)
            return BLACK;
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
            if (showLegalHints && gameState.board[r][c] === EMPTY) {
                if (freePlacementActive) {
                    cell.classList.add('legal-free');
                }
                else if (legalSet.has(key)) {
                    cell.classList.add('legal');
                }
                if (tabooLegalSet.has(key)) {
                    cell.classList.add('effect-target-highlight');
                }
            }
            if (isSelectedTargetHighlighted) {
                cell.classList.add('effect-target-highlight-positive');
            }
            if (isHumanTurn && selectableTargetSet.has(key)) {
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
                const inheritedData = inheritedMap.get(key);
                const destroyEvadeDisplay = _resolveDestroyEvadeDisplayForBoard(special, inheritedData);
                const specialCanShowFlipEvade = !!(special &&
                    _isFlipEvadeSpecialTypeForBoard(special.type) &&
                    Number.isFinite(Number(special.flipEvadeRemaining)));
                const specialCanShowDestroyEvade = !!(special &&
                    _isDestroyEvadeSpecialTypeForBoard(special.type) &&
                    Number.isFinite(Number(destroyEvadeDisplay.special)));
                const specialFlipEvade = specialCanShowFlipEvade
                    ? Math.max(0, Math.trunc(Number(special.flipEvadeRemaining)))
                    : null;
                const inheritedFlipEvade = (inheritedData && Number.isFinite(Number(inheritedData.flipEvadeRemaining)))
                    ? Math.max(0, Math.trunc(Number(inheritedData.flipEvadeRemaining)))
                    : null;
                const inheritedDestroyEvadeForDisplay = destroyEvadeDisplay.inherited;
                const mergedFlipEvade = (specialFlipEvade !== null && inheritedFlipEvade !== null)
                    ? (specialFlipEvade + inheritedFlipEvade)
                    : null;
                const specialFlipEvadeForDisplay = mergedFlipEvade !== null ? mergedFlipEvade : specialFlipEvade;
                const inheritedFlipEvadeForDisplay = mergedFlipEvade !== null ? null : inheritedFlipEvade;
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
                    if (special.remainingOwnerTurns !== undefined) {
                        const timer = document.createElement('div');
                        timer.className =
                            (special.type === 'DRAGON' || special.type === 'DESTROY_DRAGON') ? 'dragon-timer'
                                : (special.type === 'ULTIMATE_DESTROY_GOD' ? 'udg-timer'
                                    : (special.type === 'BREEDING' ? 'breeding-timer'
                                        : (special.type === 'WORK' ? 'work-timer'
                                            : ((special.type === 'TIME_STOP' || special.type === 'PERMA_PROTECTED') ? 'countdown-timer' : 'special-timer'))));
                        const remaining = Math.max(0, Math.trunc(Number(special.remainingOwnerTurns)));
                        timer.textContent = String(remaining);
                        _applyDoubleDigitTimerClassForBoard(timer, remaining);
                        discHud.appendChild(timer);
                    }
                    if (specialCanShowFlipEvade && Number.isFinite(specialFlipEvadeForDisplay)) {
                        const evadeTimer = document.createElement('div');
                        evadeTimer.className = 'stone-timer flip-evade-timer';
                        const evadeRemaining = Math.max(0, Math.trunc(Number(specialFlipEvadeForDisplay)));
                        evadeTimer.textContent = String(evadeRemaining);
                        _applyDoubleDigitTimerClassForBoard(evadeTimer, evadeRemaining);
                        discHud.appendChild(evadeTimer);
                    }
                    if (specialCanShowDestroyEvade) {
                        const destroyEvadeTimer = document.createElement('div');
                        destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
                        const destroyEvadeRemaining = Math.max(0, Math.trunc(Number(destroyEvadeDisplay.special)));
                        destroyEvadeTimer.textContent = String(destroyEvadeRemaining);
                        _applyDoubleDigitTimerClassForBoard(destroyEvadeTimer, destroyEvadeRemaining);
                        discHud.appendChild(destroyEvadeTimer);
                    }
                }
                if (livingWill) {
                    disc.classList.add('living-will-aura');
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
                if (inheritedData && typeof inheritedData.remainingOwnerTurns === 'number') {
                    const inheritedTimer = document.createElement('div');
                    inheritedTimer.className = 'stone-timer special-timer inherited-hyperactive-timer';
                    const inheritedRemaining = Math.max(0, Math.trunc(inheritedData.remainingOwnerTurns));
                    inheritedTimer.textContent = String(inheritedRemaining);
                    _applyDoubleDigitTimerClassForBoard(inheritedTimer, inheritedRemaining);
                    discHud.appendChild(inheritedTimer);
                }
                if (Number.isFinite(inheritedFlipEvadeForDisplay)) {
                    const evadeTimer = document.createElement('div');
                    evadeTimer.className = 'stone-timer flip-evade-timer';
                    const inheritedEvadeRemaining = Math.max(0, Math.trunc(Number(inheritedFlipEvadeForDisplay)));
                    evadeTimer.textContent = String(inheritedEvadeRemaining);
                    _applyDoubleDigitTimerClassForBoard(evadeTimer, inheritedEvadeRemaining);
                    discHud.appendChild(evadeTimer);
                }
                if (Number.isFinite(inheritedDestroyEvadeForDisplay) && !specialCanShowDestroyEvade) {
                    const destroyEvadeTimer = document.createElement('div');
                    destroyEvadeTimer.className = 'stone-timer destroy-evade-timer';
                    const inheritedDestroyEvadeRemaining = Math.max(0, Math.trunc(Number(inheritedDestroyEvadeForDisplay)));
                    destroyEvadeTimer.textContent = String(inheritedDestroyEvadeRemaining);
                    _applyDoubleDigitTimerClassForBoard(destroyEvadeTimer, inheritedDestroyEvadeRemaining);
                    discHud.appendChild(destroyEvadeTimer);
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
            }
            else {
                cell.addEventListener('click', () => handleCellClick(r, c));
            }
            boardEl.appendChild(cell);
        }
    }
}
// NOTE:
// Animation helpers (destroy/fade-out) are intentionally defined in `ui/animation-utils.js`.
// Keeping a second copy here risks load-order bugs (different class names / CSS wiring).
function updateOccupancyUI() {
    const counts = countDiscs(gameState);
    const total = counts.black + counts.white;
    let blackPct = 50, whitePct = 50;
    if (total > 0) {
        blackPct = Math.round((counts.black / total) * 100);
        whitePct = 100 - blackPct;
    }
    const blackEl = document.getElementById('occ-black');
    const whiteEl = document.getElementById('occ-white');
    if (blackEl)
        blackEl.innerHTML = `<div class="occ-dot"></div>黒 ${blackPct}%`;
    if (whiteEl)
        whiteEl.innerHTML = `<div class="occ-dot"></div>白 ${whitePct}%`;
}
function _findDirectDiscChildByClass(disc, className) {
    if (!disc || !disc.children)
        return null;
    for (const child of disc.children) {
        if (child && child.classList && child.classList.contains(className))
            return child;
    }
    return null;
}
function _resolveDiscOwnerDescriptor(owner) {
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
        return !!(typeof document !== 'undefined' &&
            document &&
            document.documentElement &&
            document.documentElement.classList &&
            document.documentElement.classList.contains('stone-base-images-ready'));
    }
    catch (e) {
        return false;
    }
}
function _resolveDiscImageState(renderState, baseImage) {
    if (renderState && typeof renderState.imageState === 'string' && renderState.imageState) {
        return renderState.imageState;
    }
    const hasBaseImage = typeof baseImage === 'string' && baseImage.trim() && baseImage !== 'none';
    return (hasBaseImage && _areStoneBaseImagesReady()) ? 'loaded' : 'fallback';
}
function ensureDiscSkeleton(disc) {
    if (!disc || typeof document === 'undefined' || typeof disc.appendChild !== 'function') {
        return { face: null, base: null, overlay: null, hud: null };
    }
    let face = _findDirectDiscChildByClass(disc, 'disc__face');
    let hud = _findDirectDiscChildByClass(disc, 'disc__hud');
    if (!face) {
        face = document.createElement('div');
        face.className = 'disc__face';
        if (disc.firstChild)
            disc.insertBefore(face, disc.firstChild);
        else
            disc.appendChild(face);
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
        if (child === face || child === hud)
            continue;
        childrenToMove.push(child);
    }
    for (const child of childrenToMove) {
        hud.appendChild(child);
    }
    return { face, base, overlay, hud };
}
function getDiscHudRoot(disc) {
    const skeleton = ensureDiscSkeleton(disc);
    return (skeleton && skeleton.hud) ? skeleton.hud : disc;
}
function applyDiscRenderState(disc, renderState = {}) {
    if (!disc || !disc.style || typeof disc.style.setProperty !== 'function')
        return;
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
        ? (Object.prototype.hasOwnProperty.call(renderState, 'baseFallbackColor')
            ? renderState.baseFallbackColor
            : ownerDescriptor.fallbackColor)
        : 'transparent';
    ensureDiscSkeleton(disc);
    try {
        disc.dataset.renderMode = renderMode;
    }
    catch (e) { /* ignore */ }
    try {
        disc.dataset.effect = renderState.effectKey || 'normal';
    }
    catch (e) { /* ignore */ }
    try {
        disc.dataset.imageState = imageState;
    }
    catch (e) { /* ignore */ }
    try {
        disc.style.setProperty('--disc-base-image', baseImage);
    }
    catch (e) { /* ignore */ }
    try {
        disc.style.setProperty('--stone-image', baseImage);
    }
    catch (e) { /* ignore */ }
    try {
        disc.style.setProperty('--disc-base-fallback-color', fallbackColor || 'transparent');
    }
    catch (e) { /* ignore */ }
    try {
        disc.style.removeProperty('--disc-base-color');
    }
    catch (e) { /* ignore */ }
    if (overlayImage) {
        try {
            disc.style.setProperty('--disc-overlay-image', overlayImage);
        }
        catch (e) { /* ignore */ }
        try {
            disc.style.setProperty('--special-stone-image', overlayImage);
        }
        catch (e) { /* ignore */ }
    }
    else {
        try {
            disc.style.removeProperty('--disc-overlay-image');
        }
        catch (e) { /* ignore */ }
        try {
            disc.style.removeProperty('--special-stone-image');
        }
        catch (e) { /* ignore */ }
    }
    if (Number.isFinite(overlayScale) && overlayScale > 0 && overlayScale !== 1) {
        try {
            disc.style.setProperty('--disc-overlay-scale', String(overlayScale));
        }
        catch (e) { /* ignore */ }
    }
    else {
        try {
            disc.style.removeProperty('--disc-overlay-scale');
        }
        catch (e) { /* ignore */ }
    }
}
// Expose in CommonJS for tests and in browser globals for legacy callers
function setDiscStoneImage(disc, val) {
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
    ensureDiscSkeleton,
    getDiscHudRoot,
    applyDiscRenderState,
    setDiscStoneImage,
    syncBoardPixelSizing
};
if (typeof window !== 'undefined') {
    // Prefer board-renderer as the canonical renderBoard implementation.
    window.renderBoard = renderBoard;
    window.updateOccupancyUI = window.updateOccupancyUI || updateOccupancyUI;
    window.collectPendingSelectedTargetHighlightKeys = window.collectPendingSelectedTargetHighlightKeys || collectPendingSelectedTargetHighlightKeys;
    window.ensureDiscSkeleton = window.ensureDiscSkeleton || ensureDiscSkeleton;
    window.getDiscHudRoot = window.getDiscHudRoot || getDiscHudRoot;
    window.applyDiscRenderState = window.applyDiscRenderState || applyDiscRenderState;
    window.setDiscStoneImage = window.setDiscStoneImage || setDiscStoneImage;
    window.syncBoardPixelSizing = window.syncBoardPixelSizing || syncBoardPixelSizing;
}
module.exports = BoardRenderer;
//# sourceMappingURL=board-renderer.js.map