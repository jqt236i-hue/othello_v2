declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

/**
 * @file ui.ts
 * @description メインUIモジュール（縮小版）
 * ボード描画、ステータス更新、BGMボタン更新を担当
 * 
 * 分割されたモジュール:
 * - ui/animation-utils.js - アニメーション関数
 * - ui/result-overlay.js - 結果表示
 * - ui/event-handlers.js - イベントハンドラ
 */

export let isProcessing = false;
export let mccfrPolicy: any = null;
let cpuSmartness = { black: 1, white: 1 }; // 1:標準,2:位置重視,3:反転重視

// Register UI globals via UIBootstrap to centralize global exposure
try {
    const uiBootstrap = require('./ui/bootstrap');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
        uiBootstrap.registerUIGlobals({
            isProcessing,
            mccfrPolicy,
            DEBUG_HUMAN_VS_HUMAN: false
        });
    }
} catch (e) { /* ignore in non-module contexts */ }

// DOM要素キャッシュ
export const boardEl = document.getElementById('board');
export const logEl = document.getElementById('log');
export const cpuCharacterImg = document.getElementById('cpu-character-img');
export const cpuLevelLabel = document.getElementById('cpu-level-label');
export const handLayer = document.getElementById('handLayer');
export const handWrapper = document.getElementById('handWrapper');
export const heldStone = document.getElementById('heldStone');

export function clearEffectLivePanel() {
    try {
        const clearBattleStatusPanel = (typeof window !== 'undefined' && window)
            ? (window as any).clearBattleStatusPanel
            : null;
        if (typeof clearBattleStatusPanel === 'function') {
            clearBattleStatusPanel();
        }
    } catch (e) { /* ignore */ }
}

// Register DOM elements via UIBootstrap so other modules can access them from the canonical source
try {
    const uiBootstrap = require('./ui/bootstrap');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
        uiBootstrap.registerUIGlobals({ boardEl, logEl });
    }
} catch (e) { /* ignore in non-module contexts */ }

// Helper to obtain canonical UI globals (prefer bootstrap, fallback to window)
export function _getUIGlobals(): any {
    try {
        const uiBootstrap = require('./ui/bootstrap');
        if (uiBootstrap && typeof uiBootstrap.getRegisteredUIGlobals === 'function') return uiBootstrap.getRegisteredUIGlobals();
    } catch (e) { /* ignore */ }
    return (typeof window !== 'undefined') ? window : {};
}

export function _hasPendingPlaybackOrPresentation(): boolean {
    try {
        const playbackState = (typeof window !== 'undefined' && window && (window as any).PlaybackStateManager && typeof (window as any).PlaybackStateManager.shouldDeferUiSync === 'function')
            ? (window as any).PlaybackStateManager
            : ((typeof globalThis !== 'undefined' && globalThis && (globalThis as any).PlaybackStateManager && typeof (globalThis as any).PlaybackStateManager.shouldDeferUiSync === 'function')
                ? (globalThis as any).PlaybackStateManager
                : null);
        if (playbackState) {
            return playbackState.shouldDeferUiSync({
                cardState: (typeof (window as any).cardState !== 'undefined' && (window as any).cardState && typeof (window as any).cardState === 'object') ? (window as any).cardState : null
            }) === true;
        }
        const playback = (typeof window !== 'undefined') ? ((window as any).VisualPlaybackActive === true) : false;
        return playback;
    } catch (e) {
        return (typeof window !== 'undefined') ? ((window as any).VisualPlaybackActive === true) : false;
    }
}

export let _deferredUiSyncQueued = false;
export let _deferredUiSyncNeedsBoardRender = false;
export let _deferredUiSyncNeedsStatusUpdate = false;
export let _cardUiSyncQueued = false;
export let _cardUiSyncFlushScheduled = false;
export let _cardUiSyncDeferredUntilIdle = false;
export let _cardUiSyncReasons: string[] = [];

export function _getUiSyncRaf() {
    return (typeof requestAnimationFrame === 'function')
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(cb, 16) as any;
}

export function _queueUiSyncMicrotask(callback: () => void) {
    if (typeof queueMicrotask === 'function') {
        queueMicrotask(callback);
        return;
    }
    Promise.resolve().then(callback).catch(() => {});
}

export function _queueDeferredUiSyncWork(options?: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (opts.renderBoard === true) _deferredUiSyncNeedsBoardRender = true;
    if (opts.updateStatus === true) _deferredUiSyncNeedsStatusUpdate = true;
}

export function _flushDeferredUiSyncWork() {
    const shouldRenderBoard = _deferredUiSyncNeedsBoardRender;
    const shouldUpdateStatus = _deferredUiSyncNeedsStatusUpdate;
    _deferredUiSyncNeedsBoardRender = false;
    _deferredUiSyncNeedsStatusUpdate = false;
    if (shouldRenderBoard) {
        try { renderBoard(); } catch (e) { /* ignore */ }
    }
    if (shouldUpdateStatus) {
        try { updateStatus(); } catch (e) { /* ignore */ }
    }
}

export function _deferUiSyncUntilPlaybackIdle(options?: any) {
    _queueDeferredUiSyncWork(options);
    if (_deferredUiSyncQueued) return;
    _deferredUiSyncQueued = true;
    const raf = _getUiSyncRaf();
    const tick = () => {
        if (_hasPendingPlaybackOrPresentation()) {
            raf(tick);
            return;
        }
        _deferredUiSyncQueued = false;
        _flushDeferredUiSyncWork();
    };
    raf(tick);
}

export function _runWhenPlaybackIdle(onIdle: () => void, options?: any) {
    if (_hasPendingPlaybackOrPresentation()) {
        _deferUiSyncUntilPlaybackIdle(options);
        return;
    }
    onIdle();
}

export function _resolveRenderCardUiForSync() {
    try {
        if (typeof (window as any).renderCardUI === 'function') return (window as any).renderCardUI;
    } catch (e) { /* ignore */ }
    try {
        const globals = _getUIGlobals();
        if (globals && typeof globals.renderCardUI === 'function') return globals.renderCardUI;
    } catch (e) { /* ignore */ }
    try {
        if (typeof window !== 'undefined' && typeof (window as any).renderCardUI === 'function') return (window as any).renderCardUI;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).renderCardUI === 'function') return (globalThis as any).renderCardUI;
    } catch (e) { /* ignore */ }
    return null;
}

export function _resolveRenderVisibleChargeDisplaysForSync() {
    try {
        if (typeof (window as any).renderVisibleChargeDisplays === 'function') return (window as any).renderVisibleChargeDisplays;
    } catch (e) { /* ignore */ }
    try {
        const globals = _getUIGlobals();
        if (globals && typeof globals.renderVisibleChargeDisplays === 'function') return globals.renderVisibleChargeDisplays;
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && typeof (globalThis as any).renderVisibleChargeDisplays === 'function') return (globalThis as any).renderVisibleChargeDisplays;
    } catch (e) { /* ignore */ }
    try {
        const cardRenderer = require('./cards/card-renderer');
        if (cardRenderer && typeof cardRenderer.renderVisibleChargeDisplays === 'function') {
            return cardRenderer.renderVisibleChargeDisplays;
        }
    } catch (e) { /* ignore */ }
    return null;
}

export function _syncVisibleChargeDisplaysNow() {
    const renderVisibleChargeDisplaysFn = _resolveRenderVisibleChargeDisplaysForSync();
    if (typeof renderVisibleChargeDisplaysFn !== 'function') return false;
    try {
        renderVisibleChargeDisplaysFn();
        return true;
    } catch (e) {
        return false;
    }
}

export function _flushCardUiSyncQueue(options?: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    if (!_cardUiSyncQueued) return false;
    if (opts.ignorePlayback !== true && _hasPendingPlaybackOrPresentation()) {
        _deferCardUiSyncUntilPlaybackIdle();
        return false;
    }
    _cardUiSyncQueued = false;
    _cardUiSyncDeferredUntilIdle = false;
    _cardUiSyncReasons = [];
    const renderCardUiFn = _resolveRenderCardUiForSync();
    if (typeof renderCardUiFn !== 'function') {
        return false;
    }
    try {
        renderCardUiFn();
        return true;
    } catch (e) {
        return false;
    }
}

export function _scheduleCardUiSyncFlush() {
    if (_cardUiSyncFlushScheduled) return;
    _cardUiSyncFlushScheduled = true;
    _queueUiSyncMicrotask(() => {
        _cardUiSyncFlushScheduled = false;
        _flushCardUiSyncQueue();
    });
}

export function _deferCardUiSyncUntilPlaybackIdle() {
    if (_cardUiSyncDeferredUntilIdle) return;
    _cardUiSyncDeferredUntilIdle = true;
    const raf = _getUiSyncRaf();
    const tick = () => {
        if (!_cardUiSyncQueued) {
            _cardUiSyncDeferredUntilIdle = false;
            return;
        }
        if (_hasPendingPlaybackOrPresentation()) {
            raf(tick);
            return;
        }
        _cardUiSyncDeferredUntilIdle = false;
        _scheduleCardUiSyncFlush();
    };
    raf(tick);
}

export function requestCardUiSync(reason?: string, options?: any) {
    const opts = (options && typeof options === 'object') ? options : {};
    const normalizedReason = String(reason || opts.reason || '').trim();
    if (normalizedReason) {
        _cardUiSyncReasons.push(normalizedReason);
    }
    _cardUiSyncQueued = true;
    if (opts.deferUntilIdle === false) {
        return _flushCardUiSyncQueue({ ignorePlayback: true });
    }
    _scheduleCardUiSyncFlush();
    return true;
}

export function updateEffectLivePanel(text?: string) {
    const msg = String(text || '').trim();
    if (!msg) return;
    try {
        const recorder = (typeof window !== 'undefined' && window)
            ? (window as any).recordBattleStatusEvent
            : null;
        if (typeof recorder === 'function') recorder(msg);
    } catch (e) { /* ignore */ }
}

export function isCardEffectOnlyLogLine(text?: string) {
    const t = String(text || '').trim();
    if (!t) return false;

    // Internal/technical lines are not player-facing logs.
    if (t.startsWith('PresentationEvent:')) return true;

    // Card usage itself should remain in the normal log.
    if (t.includes('カードを使用')) return false;

    // Card usage/effect lines should live in the effect-only panel.
    const cardEffectHints = [
        '破壊の意志',
        '時限爆弾',
        '究極反転龍',
        '繁殖石',
        '究極破壊神',
        '多動石',
        '復活石',
        '生贄',
        '売却',
        '天の恵み',
        '断罪',
        '誘惑',
        '封鎖',
        '継承',
        '交換',
        '二連投石',
        '十字爆弾',
        '反転保護',
        '永続反転保護',
        '吸収',
        '出稼ぎ'
    ];
    return cardEffectHints.some((k) => t.includes(k));
}

export let _commentaryBroker: any = null;

export function _resolveCommentaryBroker() {
    if (_commentaryBroker) return _commentaryBroker;
    try {
        if (typeof window !== 'undefined' && (window as any).CommentaryBroker) {
            _commentaryBroker = (window as any).CommentaryBroker;
            return _commentaryBroker;
        }
    } catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && (globalThis as any).CommentaryBroker) {
            _commentaryBroker = (globalThis as any).CommentaryBroker;
            return _commentaryBroker;
        }
    } catch (e) { /* ignore */ }
    try {
        _commentaryBroker = require('./ui/commentary-broker');
        return _commentaryBroker;
    } catch (e) { /* ignore */ }
    return null;
}

export function _ensureCommentaryBrokerInitialized() {
    const broker = _resolveCommentaryBroker();
    if (!broker || typeof broker.initBroker !== 'function') return broker;
    try {
        broker.initBroker({
            root: (typeof globalThis !== 'undefined') ? globalThis : null,
            addLog: (typeof addLog === 'function') ? addLog : null,
            getShowCpuSpeechBubble: () => {
                try {
                    if (typeof window !== 'undefined' && typeof (window as any).showCpuSpeechBubble === 'function') {
                        return (window as any).showCpuSpeechBubble;
                    }
                } catch (e) { /* ignore */ }
                return null;
            }
        });
    } catch (e) { /* ignore */ }
    return broker;
}

export function _resetCommentaryTracking(resetRuntime?: boolean) {
    if (resetRuntime !== true) return;
    const broker = _ensureCommentaryBrokerInitialized();
    if (broker && typeof broker.resetState === 'function') {
        try {
            broker.resetState();
        } catch (e) { /* ignore */ }
    }
}


// ===== Event System Integration =====
if (typeof (window as any).GameEvents !== 'undefined' && (window as any).GameEvents.gameEvents) {
    (window as any).GameEvents.gameEvents.on((window as any).GameEvents.EVENT_TYPES.BOARD_UPDATED, () => {
        _runWhenPlaybackIdle(() => {
            renderBoard();
        }, {
            renderBoard: true
        });
    });
    (window as any).GameEvents.gameEvents.on((window as any).GameEvents.EVENT_TYPES.GAME_STATE_CHANGED, () => {
        _runWhenPlaybackIdle(() => {
            renderBoard();
            updateStatus();
        }, {
            renderBoard: true,
            updateStatus: true
        });
    });
    (window as any).GameEvents.gameEvents.on((window as any).GameEvents.EVENT_TYPES.CARD_STATE_CHANGED, () => {
        _syncVisibleChargeDisplaysNow();
        requestCardUiSync('event:card-state-changed');
    });
    (window as any).GameEvents.gameEvents.on((window as any).GameEvents.EVENT_TYPES.STATUS_UPDATED, () => {
        updateStatus();
    });
    (window as any).GameEvents.gameEvents.on((window as any).GameEvents.EVENT_TYPES.GAME_RESET, () => {
        clearEffectLivePanel();
        _resetCommentaryTracking(true);
    });
    (window as any).GameEvents.gameEvents.on((window as any).GameEvents.EVENT_TYPES.LOG_ADDED, (msg: any) => {
        const isObjectPayload = !!(msg && typeof msg === 'object' && typeof msg.text === 'string');
        const text = isObjectPayload ? msg.text : String(msg);
        const kind = isObjectPayload ? msg.kind : 'normal';
        const normalizeEffectLogText = (rawText: string) => {
            const normalized = String(rawText || '').trim();
            if (normalized === '反転保護を付与') return '弱い石: 反転保護';
            if (normalized === '永続反転保護を付与') return '強い石: 永続反転保護';
            return normalized;
        };
        if (kind === 'effect') {
            updateEffectLivePanel(normalizeEffectLogText(text));
            return;
        }
        if (kind === 'commentary' && isObjectPayload) {
            const broker = _ensureCommentaryBrokerInitialized();
            if (broker && typeof broker.showCommentaryEntry === 'function') {
                broker.showCommentaryEntry(msg, { log: false });
            }
            return;
        }
        if (isCardEffectOnlyLogLine(text)) return;
        if (typeof addLog === 'function') addLog(text);
    });
}

// ===== Board Rendering =====

/**
 * ボードを描画
 * Render the game board with all discs, legal moves, and special effects
 */
// ===== Board Rendering =====

/**
 * Render the board with all stones and visual effects
 * @description Main rendering function that displays:
 * - Board cells with legal move highlights
 * - Stone discs with appropriate colors
 * - Protection visuals (temporary/permanent)
 * - Special effects (bombs, dragons, pending card effects)
 */
export function renderBoard() {
    // If the board renderer has already installed a global function, use it.
    try {
        if (typeof window !== 'undefined' && typeof (window as any).renderBoard === 'function' && (window as any).renderBoard !== renderBoard) {
            return (window as any).renderBoard();
        }
    } catch (e) { /* ignore */ }

    // Delegate to the canonical implementation in ui/board-renderer.js.
    try {
        const mod = require('./ui/board-renderer');
        if (mod && typeof mod.renderBoard === 'function') return mod.renderBoard();
    } catch (e) { /* ignore require failures in browser */ }
}

// ===== Occupancy UI =====

/**
 * 占有率UIを更新
 * Update occupancy percentage display
 */
export function updateOccupancyUI() {
    const counts = (window as any).countDiscs((window as any).gameState);
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

/**
 * Defensive helper: ensure WORK stones always have visual effect applied
 * This runs after a render and fixes cases where diff rendering or animation
 * skipping prevents the normal effect application path from running.
 */
export function ensureWorkVisualsApplied() {
    try {
        // Diagnostic log to capture invocation in user environments
        try { (window as any)._lastEnsureVisualsTs = Date.now(); } catch (e) { /* Intentionally empty: diagnostic timestamp */ }
        const markers = ((window as any).cardState && Array.isArray((window as any).cardState.markers)) ? (window as any).cardState.markers : [];
        const works = markers.filter((m: any) => m && m.kind === 'specialStone' && m.data && m.data.type === 'WORK');
        if (typeof window !== 'undefined' && (window as any).DEBUG_WORK_VISUALS === true) {
            console.log('[VISUAL_DEBUG] ensureWorkVisualsApplied invoked; workMarkers:', works.length);
        }
        if (!works.length) return;

        const normalizeOwner = (owner: any) => (owner === 'black' || owner === (window as any).BLACK || owner === 1) ? (window as any).BLACK : (window as any).WHITE;

        for (const w of works) {
            const sel = `.cell[data-row="${w.row}"][data-col="${w.col}"] .disc`;
            const disc = document.querySelector(sel);
            if (!disc) continue;
            const discEl = disc as HTMLElement;
            const imgVar = discEl.style.getPropertyValue('--disc-overlay-image') || discEl.style.getPropertyValue('--special-stone-image');
            const hasImage = imgVar && String(imgVar).trim().length > 0;
            const hasClass = disc.classList && disc.classList.contains('work-stone');
            if (!hasImage || !hasClass) {
                (window as any).applyStoneVisualEffect(disc, 'workStone', { owner: normalizeOwner(w.owner) });
            }
        }
    } catch (e) {
        // Defensive: don't let UI crash for visuals
        console.warn('[UI] ensureWorkVisualsApplied failed', (e as any) && (e as any).message ? (e as any).message : e);
    }
}

// Expose helper for diagnostics/tests
(window as any).ensureWorkVisualsApplied = ensureWorkVisualsApplied;

// Simple debounce helper used by observer
export function debounce(fn: Function, wait: number) {
    let t: any = null;
    return function(...args: any[]) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(null, args), wait);
    };
}

// Preload WORK stone images to avoid timing / network race conditions
export function preloadWorkStoneImages() {
    if ((window as any)._workStoneImagesPreloaded) return;
    (window as any)._workStoneImagesPreloaded = true;
    const paths = [
        'assets/images/stones/work_stone-black.png',
        'assets/images/stones/work_stone-white.png'
    ];
    // Consider loaded once all either loaded or errored (we don't want to block forever)
    (window as any)._workStoneImagesLoaded = false;
    let resolvedCount = 0;
    const finalize = () => {
        resolvedCount++;
        if (resolvedCount >= paths.length) (window as any)._workStoneImagesLoaded = true;
    };
    paths.forEach(p => {
        try {
            const img = new Image();
            img.onload = finalize;
            img.onerror = finalize;
            img.src = p;
        } catch (e) {
            finalize();
        }
    });
    // Timeout safety: mark loaded after 5s to avoid blocking indefinitely
    // Avoid starting long timeout during tests (prevents open handles)
    if (!(typeof process !== 'undefined' && process.env && (process.env.JEST_WORKER_ID || process.env.NODE_ENV === 'test'))) {
        setTimeout(() => { if (typeof window !== 'undefined') { (window as any)._workStoneImagesLoaded = true; } }, 5000);
    }
}

export function preloadImmediateSpecialStoneImages() {
    if ((window as any)._immediateSpecialStoneImagesPreloaded) return;
    (window as any)._immediateSpecialStoneImagesPreloaded = true;
    try {
        if (typeof (window as any).preloadStoneVisualEffectKeys === 'function') {
            (window as any).preloadStoneVisualEffectKeys([
                'goldStone',
                'silverStone',
                'rainbowStone',
            ]);
        }
    } catch (e) { /* defensive */ }
}

// MutationObserver fallback: watches board DOM changes and reapplies missing WORK visuals
export function setupWorkVisualsObserver() {
    if ((window as any)._workVisualsObserver) return; // already set
    const board = document.getElementById('board');
    if (!board) return;

    const run = debounce(() => {
        try {
            ensureWorkVisualsApplied();
        } catch (e) { /* defensive */ }
    }, 50);

    const mo = new MutationObserver(() => run());
    mo.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-row', 'data-col'] });
    (window as any)._workVisualsObserver = mo;
    (window as any)._teardownWorkVisualsObserver = () => { mo.disconnect(); (window as any)._workVisualsObserver = null; };
}

// Initialize helpers once (call from UI entrypoint)
export function initWorkVisualsHelpers() {
    try {
        preloadWorkStoneImages();
        preloadImmediateSpecialStoneImages();
        setupWorkVisualsObserver();
        // ensure visuals once at init time
        setTimeout(() => ensureWorkVisualsApplied(), 60);
    } catch (e) { /* defensive */ }
}


// ===== Work visual diagnostics (temporary) =====
export function collectWorkVisualDiagnostics() {
    const res: any = {};
    res.timestamp = Date.now();
    const markers = ((window as any).cardState && Array.isArray((window as any).cardState.markers)) ? (window as any).cardState.markers : [];
    res.specialStonesCount = markers.filter((m: any) => m && m.kind === 'specialStone' && m.data && m.data.type === 'WORK').length;
    res.fullSpecialStonesCount = markers.filter((m: any) => m && m.kind === 'specialStone').length;
    const g = _getUIGlobals();
    res.workImagesPreloaded = !!(g._workStoneImagesPreloaded || (window as any)._workStoneImagesPreloaded);
    res.workImagesLoadedFlag = !!(g._workStoneImagesLoaded || (window as any)._workStoneImagesLoaded);
    res.observerActive = !!(g._workVisualsObserver || (window as any)._workVisualsObserver);
    res.lastApplyWorkTs = (g._lastApplyWorkTs !== undefined ? g._lastApplyWorkTs : ((window as any)._lastApplyWorkTs || null));
    res.lastEnsureVisualsTs = (g._lastEnsureVisualsTs !== undefined ? g._lastEnsureVisualsTs : ((window as any)._lastEnsureVisualsTs || null));
    res.lastInjected = (g._lastWorkInjected !== undefined ? g._lastWorkInjected : ((window as any)._lastWorkInjected || null));
    // Arm status for Work next placement
    res.workArmedBy = ((window as any).cardState && (window as any).cardState.workNextPlacementArmedByPlayer) ? (window as any).cardState.workNextPlacementArmedByPlayer : { black: false, white: false };

    // resource check
    const entries = ((performance as any) && (performance as any).getEntriesByType) ? (performance as any).getEntriesByType('resource').filter((e: any) => /work_stone/.test(e.name)) : [];
    res.resources = entries.map((e: any) => ({ name: e.name, size: e.transferSize || e.encodedBodySize || 0 }));

    // per-special diagnostics
    res.perSpecial = [];
    if ((window as any).cardState && Array.isArray((window as any).cardState.markers)) {
        for (const s of (window as any).cardState.markers) {
            if (!s || s.kind !== 'specialStone' || !s.data || s.data.type !== 'WORK') continue;
            const item: any = { row: s.row, col: s.col, owner: s.owner || (s.data && s.data.ownerColor) || null };
            const sel = `.cell[data-row="${s.row}"][data-col="${s.col}"] .disc`;
            const disc = document.querySelector(sel);
            if (!disc) {
                item.discPresent = false;
            } else {
                item.discPresent = true;
                item.classes = [...disc.classList];
                item.inlineVar = (disc as HTMLElement).style.getPropertyValue('--disc-overlay-image') || (disc as HTMLElement).style.getPropertyValue('--special-stone-image') || null;
                item.renderMode = (disc as HTMLElement).dataset.renderMode || null;
                const overlayEl = disc.querySelector('.disc__overlay-image');
                item.overlayBg = overlayEl ? (getComputedStyle(overlayEl).getPropertyValue('background-image') || null) : null;
                item.shadowVisible = !!(getComputedStyle(disc, '::before').getPropertyValue('opacity') || '').trim();
            }
            res.perSpecial.push(item);
        }
    }

    return res;
}

export function updateWorkVisualDiagnosticsBadge() {
    try {
        let badge = document.getElementById('work-visual-diagnostics');
        if (!badge) return;
        const d = collectWorkVisualDiagnostics();
        let html = '';
        html += `WORK markers: ${d.specialStonesCount} / total markers: ${d.fullSpecialStonesCount}\n`;
        html += `preloaded: ${d.workImagesPreloaded} loadedFlag: ${d.workImagesLoadedFlag} observer:${d.observerActive}\n`;
        html += `lastApply: ${d.lastApplyWorkTs ? new Date(d.lastApplyWorkTs).toLocaleTimeString() : '-'} lastEnsure: ${d.lastEnsureVisualsTs ? new Date(d.lastEnsureVisualsTs).toLocaleTimeString() : '-'}\n`;
        if (d.lastInjected) html += `injected: ${d.lastInjected.key} ${d.lastInjected.imgPath}\n`;
        if (d.resources && d.resources.length) {
            html += `resources: ${d.resources.map((r: any) => r.name.split('/').pop() + '(' + r.size + ')').join(', ')}\n`;
        }
        for (const s of d.perSpecial) {
            html += `(${s.row},${s.col}) disc:${s.discPresent} classes:${s.classes ? s.classes.join('|') : '-'} var:${s.inlineVar ? 'yes' : 'no'} bg:${s.inlineBg ? 'yes' : 'no'} before:${s.computedBefore ? 'yes' : 'no'} img:${s.injectImg}\n`;
        }
        badge.textContent = html;
    } catch (e) { /* defensive */ }
}

export function teardownWorkVisualDiagnosticsBadge() {
    try {
        const existing = document.getElementById('work-visual-diagnostics');
        if (existing) existing.remove();
        if ((window as any)._workDiagInterval) {
            clearInterval((window as any)._workDiagInterval);
            (window as any)._workDiagInterval = null;
        }
    } catch (e) { /* defensive */ }
}

export function initWorkVisualDiagnosticsBadge() {
    try {
        if (!document || !document.body) return;
        // dont initialize twice
        if (document.getElementById('work-visual-diagnostics')) return;
        const badge = document.createElement('pre');
        badge.id = 'work-visual-diagnostics';
        badge.title = 'Work visual diagnostics (temporary) - click to copy data';
        badge.style.position = 'fixed';
        badge.style.right = '8px';
        badge.style.bottom = '8px';
        badge.style.background = 'rgba(0,0,0,0.6)';
        badge.style.color = '#fff';
        badge.style.padding = '8px';
        badge.style.fontSize = '12px';
        badge.style.zIndex = '99999';
        badge.style.maxWidth = '320px';
        badge.style.maxHeight = '220px';
        badge.style.overflow = 'auto';
        badge.style.borderRadius = '6px';
        badge.style.boxShadow = '0 2px 8px rgba(0,0,0,0.6)';
        badge.style.whiteSpace = 'pre-wrap';
        badge.style.cursor = 'pointer';
        badge.addEventListener('click', () => {
            try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(collectWorkVisualDiagnostics(), null, 2)); } catch (e) { /* Intentionally empty: clipboard may be unavailable */ }
        });
        document.body.appendChild(badge);
        // periodic update
        (window as any)._workDiagInterval = setInterval(updateWorkVisualDiagnosticsBadge, 600);
        // one immediate update
        setTimeout(updateWorkVisualDiagnosticsBadge, 80);

        // expose getter
        (window as any).getWorkVisualDiagnostics = collectWorkVisualDiagnostics;
    } catch (e) { /* defensive */ }
}

// Diagnostics init (call from UI entrypoint; DEBUG flag gates the badge)
export function initWorkVisualDiagnosticsAuto() {
    // default: hidden
    if (typeof (window as any).DEBUG_WORK_VISUALS === 'undefined') (window as any).DEBUG_WORK_VISUALS = false;
    // Always expose diagnostic getter for tests / programmatic access
    (window as any).getWorkVisualDiagnostics = collectWorkVisualDiagnostics;
    (window as any).toggleWorkVisualDiagnostics = function(show: boolean) {
        if (show) initWorkVisualDiagnosticsBadge(); else teardownWorkVisualDiagnosticsBadge();
    };
    if ((window as any).DEBUG_WORK_VISUALS) initWorkVisualDiagnosticsBadge(); else teardownWorkVisualDiagnosticsBadge();
}

// Expose helper in UI global for the single entrypoint to call
(window as any).initWorkVisualsHelpers = initWorkVisualsHelpers;
(window as any).preloadImmediateSpecialStoneImages = preloadImmediateSpecialStoneImages;
(window as any).initWorkVisualDiagnosticsAuto = initWorkVisualDiagnosticsAuto;
(window as any).clearEffectLivePanel = clearEffectLivePanel;
(window as any).requestCardUiSync = requestCardUiSync;
(window as any).syncVisibleChargeDisplaysNow = _syncVisibleChargeDisplaysNow;
try {
    if (typeof globalThis !== 'undefined') {
        (globalThis as any).requestCardUiSync = requestCardUiSync;
        (globalThis as any).syncVisibleChargeDisplaysNow = _syncVisibleChargeDisplaysNow;
    }
} catch (e) { /* ignore */ }


// ===== BGM UI Helper =====

// Delegating shims — actual implementations live in ui/bootstrap.js so they are
// available during early initialization. Define light fallbacks only if they
// aren't already present (e.g., in test environments).
export function updateBgmButtons() {
    if (typeof window !== 'undefined' && typeof (window as any).updateBgmButtons === 'function' && (window as any).updateBgmButtons !== updateBgmButtons) {
        return (window as any).updateBgmButtons();
    }
    // fallback: try to update if DOM exists
    try {
        const bgmPlayBtn = document.getElementById('bgmPlayBtn');
        const bgmPauseBtn = document.getElementById('bgmPauseBtn');
        if (typeof (window as any).SoundEngine !== 'undefined' && (window as any).SoundEngine.allowBgmPlay && !(window as any).SoundEngine.bgm?.paused) {
            if (bgmPlayBtn) bgmPlayBtn.classList.add('btn-active');
            if (bgmPauseBtn) bgmPauseBtn.classList.remove('btn-active');
        } else {
            if (bgmPlayBtn) bgmPlayBtn.classList.remove('btn-active');
            if (bgmPauseBtn) bgmPauseBtn.classList.add('btn-active');
        }
    } catch (e) { /* defensive */ }
}

// ===== Logging =====

/**
 * Log entry delegation shim: prefer global implementation
 */
export function addLog(text: string) {
    if (typeof window !== 'undefined' && typeof (window as any).addLog === 'function' && (window as any).addLog !== addLog) {
        return (window as any).addLog(text);
    }
    if (typeof console !== 'undefined' && console.log) console.log('[log]', String(text));
}

// ===== Status Display =====

/**
 * ステータスを更新
 * Update status display
 */
export function updateStatus() {
    if (typeof window !== 'undefined' && typeof (window as any).updateStatus === 'function' && (window as any).updateStatus !== updateStatus) {
        return (window as any).updateStatus();
    }
    if (typeof updateCpuCharacter === 'function') updateCpuCharacter();
}

/**
 * CPUキャラクター表示を更新
 * Update CPU character image and level label
 */
export function updateCpuCharacter() {
    // Delegate to ui/status-display.js (single source of truth).
    try {
        if (typeof window !== 'undefined' && typeof (window as any).updateCpuCharacter === 'function' && (window as any).updateCpuCharacter !== updateCpuCharacter) {
            return (window as any).updateCpuCharacter();
        }
    } catch (e) { /* ignore */ }
    try {
        const mod = require('./ui/status-display');
        if (mod && typeof mod.updateCpuCharacter === 'function') return mod.updateCpuCharacter();
    } catch (e) { /* ignore */ }
}

export default {
    renderBoard,
    updateOccupancyUI,
    updateBgmButtons,
    addLog,
    updateStatus,
    updateCpuCharacter,
    isProcessing,
    mccfrPolicy,
    clearEffectLivePanel,
    requestCardUiSync,
    ensureWorkVisualsApplied,
    initWorkVisualsHelpers,
    preloadImmediateSpecialStoneImages,
    initWorkVisualDiagnosticsAuto,
    collectWorkVisualDiagnostics
};
