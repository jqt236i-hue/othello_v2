/**
 * @file ui.js
 * @description メインUIモジュール（縮小版）
 * ボード描画、ステータス更新、BGMボタン更新を担当
 * 
 * 分割されたモジュール:
 * - ui/animation-utils.js - アニメーション関数
 * - ui/result-overlay.js - 結果表示
 * - ui/event-handlers.js - イベントハンドラ
 */

// ===== Global UI State =====
// (shared with other modules via window scope)

let isProcessing = false;
let mccfrPolicy = null;
let cpuSmartness = { black: 1, white: 1 }; // 1:標準,2:位置重視,3:反転重視

// Register UI globals via UIBootstrap to centralize global exposure
try {
    const uiBootstrap = require('./ui/bootstrap');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
        uiBootstrap.registerUIGlobals({
            isProcessing,
            mccfrPolicy,
            cpuSmartness,
            DEBUG_HUMAN_VS_HUMAN: false
        });
    }
} catch (e) { /* ignore in non-module contexts */ }

// DOM要素キャッシュ
const boardEl = document.getElementById('board');
const logEl = document.getElementById('log');
const cpuCharacterImg = document.getElementById('cpu-character-img');
const cpuLevelLabel = document.getElementById('cpu-level-label');
const handLayer = document.getElementById('handLayer');
const handWrapper = document.getElementById('handWrapper');
const heldStone = document.getElementById('heldStone');

// Register DOM elements via UIBootstrap so other modules can access them from the canonical source
try {
    const uiBootstrap = require('./ui/bootstrap');
    if (uiBootstrap && typeof uiBootstrap.registerUIGlobals === 'function') {
        uiBootstrap.registerUIGlobals({ boardEl, logEl });
    }
} catch (e) { /* ignore in non-module contexts */ }

// Helper to obtain canonical UI globals (prefer bootstrap, fallback to window)
function _getUIGlobals() {
    try {
        const uiBootstrap = require('./ui/bootstrap');
        if (uiBootstrap && typeof uiBootstrap.getRegisteredUIGlobals === 'function') return uiBootstrap.getRegisteredUIGlobals();
    } catch (e) { /* ignore */ }
    return (typeof window !== 'undefined') ? window : {};
}


// ===== Event System Integration =====
if (typeof GameEvents !== 'undefined' && GameEvents.gameEvents) {
    GameEvents.gameEvents.on(GameEvents.EVENT_TYPES.BOARD_UPDATED, () => {
        // If presentation events are pending, defer to PlaybackEngine.
        try {
            const pending = (cardState && Array.isArray(cardState._presentationEventsPersist)) ? cardState._presentationEventsPersist.length : 0;
            const live = (cardState && Array.isArray(cardState.presentationEvents)) ? cardState.presentationEvents.length : 0;
            if (pending > 0 || live > 0) return;
        } catch (e) { /* ignore */ }
        renderBoard();
    });
    GameEvents.gameEvents.on(GameEvents.EVENT_TYPES.GAME_STATE_CHANGED, () => {
        renderBoard();
        updateStatus();
    });
    GameEvents.gameEvents.on(GameEvents.EVENT_TYPES.CARD_STATE_CHANGED, () => {
        if (typeof renderCardUI === 'function') renderCardUI();
    });
    GameEvents.gameEvents.on(GameEvents.EVENT_TYPES.STATUS_UPDATED, () => {
        updateStatus();
    });
    GameEvents.gameEvents.on(GameEvents.EVENT_TYPES.LOG_ADDED, (msg) => {
        if (typeof addLog === 'function') addLog(msg);
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
function renderBoard() {
    // Delegate to the canonical implementation in ui/board-renderer.js.
    try {
        const mod = require('./ui/board-renderer');
        if (mod && typeof mod.renderBoard === 'function') return mod.renderBoard();
    } catch (e) { /* ignore require failures in browser */ }

    // If the board renderer has already installed a global function, use it.
    try {
        if (typeof window !== 'undefined' && typeof window.renderBoard === 'function' && window.renderBoard !== renderBoard) {
            return window.renderBoard();
        }
    } catch (e) { /* ignore */ }
}

// ===== Occupancy UI =====

/**
 * 占有率UIを更新
 * Update occupancy percentage display
 */
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

    if (blackEl) blackEl.innerHTML = `<div class="occ-dot"></div>黒 ${blackPct}%`;
    if (whiteEl) whiteEl.innerHTML = `<div class="occ-dot"></div>白 ${whitePct}%`;
}

/**
 * Defensive helper: ensure WORK stones always have visual effect applied
 * This runs after a render and fixes cases where diff rendering or animation
 * skipping prevents the normal effect application path from running.
 */
function ensureWorkVisualsApplied() {
    try {
        // Diagnostic log to capture invocation in user environments
        try { window._lastEnsureVisualsTs = Date.now(); } catch (e) {}
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const works = markers.filter(m => m && m.kind === 'specialStone' && m.data && m.data.type === 'WORK');
        console.log('[VISUAL_DEBUG] ensureWorkVisualsApplied invoked; workMarkers:', works.length);
        if (!works.length) return;

        const normalizeOwner = (owner) => (owner === 'black' || owner === BLACK || owner === 1) ? BLACK : WHITE;

        for (const w of works) {
            const sel = `.cell[data-row="${w.row}"][data-col="${w.col}"] .disc`;
            const disc = document.querySelector(sel);
            if (!disc) continue;
            const imgVar = (disc.style && disc.style.getPropertyValue) ? disc.style.getPropertyValue('--special-stone-image') : null;
            const hasImage = imgVar && String(imgVar).trim().length > 0;
            const hasClass = disc.classList && disc.classList.contains('work-stone');
            if (!hasImage || !hasClass) {
                applyStoneVisualEffect(disc, 'workStone', { owner: normalizeOwner(w.owner) });
            }
        }
    } catch (e) {
        // Defensive: don't let UI crash for visuals
        console.warn('[UI] ensureWorkVisualsApplied failed', e && e.message ? e.message : e);
    }
}

// Expose helper for diagnostics/tests
window.ensureWorkVisualsApplied = ensureWorkVisualsApplied;

// Simple debounce helper used by observer
function debounce(fn, wait) {
    let t = null;
    return function() {
        const args = arguments;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(null, args), wait);
    };
}

// Preload WORK stone images to avoid timing / network race conditions
function preloadWorkStoneImages() {
    if (window._workStoneImagesPreloaded) return;
    window._workStoneImagesPreloaded = true;
    const paths = [
        'assets/images/stones/work_stone-black.png',
        'assets/images/stones/work_stone-white.png'
    ];
    // Consider loaded once all either loaded or errored (we don't want to block forever)
    window._workStoneImagesLoaded = false;
    let resolvedCount = 0;
    const finalize = () => {
        resolvedCount++;
        if (resolvedCount >= paths.length) window._workStoneImagesLoaded = true;
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
        setTimeout(() => { if (typeof window !== 'undefined') { window._workStoneImagesLoaded = true; } }, 5000);
    }
}

// MutationObserver fallback: watches board DOM changes and reapplies missing WORK visuals
function setupWorkVisualsObserver() {
    if (window._workVisualsObserver) return; // already set
    const board = document.getElementById('board');
    if (!board) return;

    const run = debounce(() => {
        try {
            ensureWorkVisualsApplied();
        } catch (e) { /* defensive */ }
    }, 50);

    const mo = new MutationObserver(() => run());
    mo.observe(board, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-row', 'data-col'] });
    window._workVisualsObserver = mo;
    window._teardownWorkVisualsObserver = () => { mo.disconnect(); window._workVisualsObserver = null; };
}

// Initialize helpers once (call from UI entrypoint)
function initWorkVisualsHelpers() {
    try {
        preloadWorkStoneImages();
        setupWorkVisualsObserver();
        // ensure visuals once at init time
        setTimeout(() => ensureWorkVisualsApplied(), 60);
    } catch (e) { /* defensive */ }
}


// ===== Work visual diagnostics (temporary) =====
function collectWorkVisualDiagnostics() {
    const res = {};
    res.timestamp = Date.now();
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    res.specialStonesCount = markers.filter(m => m && m.kind === 'specialStone' && m.data && m.data.type === 'WORK').length;
    res.fullSpecialStonesCount = markers.filter(m => m && m.kind === 'specialStone').length;
    const g = _getUIGlobals();
    res.workImagesPreloaded = !!(g._workStoneImagesPreloaded || window._workStoneImagesPreloaded);
    res.workImagesLoadedFlag = !!(g._workStoneImagesLoaded || window._workStoneImagesLoaded);
    res.observerActive = !!(g._workVisualsObserver || window._workVisualsObserver);
    res.lastApplyWorkTs = (g._lastApplyWorkTs !== undefined ? g._lastApplyWorkTs : (window._lastApplyWorkTs || null));
    res.lastEnsureVisualsTs = (g._lastEnsureVisualsTs !== undefined ? g._lastEnsureVisualsTs : (window._lastEnsureVisualsTs || null));
    res.lastInjected = (g._lastWorkInjected !== undefined ? g._lastWorkInjected : (window._lastWorkInjected || null));
    // Arm status for Work next placement
    res.workArmedBy = (cardState && cardState.workNextPlacementArmedByPlayer) ? cardState.workNextPlacementArmedByPlayer : { black: false, white: false };

    // resource check
    const entries = (performance && performance.getEntriesByType) ? performance.getEntriesByType('resource').filter(e => /work_stone/.test(e.name)) : [];
    res.resources = entries.map(e => ({ name: e.name, size: e.transferSize || e.encodedBodySize || 0 }));

    // per-special diagnostics
    res.perSpecial = [];
    if (cardState && Array.isArray(cardState.markers)) {
        for (const s of cardState.markers) {
            if (!s || s.kind !== 'specialStone' || !s.data || s.data.type !== 'WORK') continue;
            const item = { row: s.row, col: s.col, owner: s.owner || (s.data && s.data.ownerColor) || null };
            const sel = `.cell[data-row="${s.row}"][data-col="${s.col}"] .disc`;
            const disc = document.querySelector(sel);
            if (!disc) {
                item.discPresent = false;
            } else {
                item.discPresent = true;
                item.classes = [...disc.classList];
                item.inlineVar = disc.style.getPropertyValue('--special-stone-image') || null;
                item.inlineBg = disc.style.backgroundImage || null;
                item.computedBefore = getComputedStyle(disc, '::before').getPropertyValue('background-image') || null;
                item.injectImg = !!disc.querySelector('.special-stone-img');
            }
            res.perSpecial.push(item);
        }
    }

    return res;
}

function updateWorkVisualDiagnosticsBadge() {
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
            html += `resources: ${d.resources.map(r => r.name.split('/').pop() + '(' + r.size + ')').join(', ')}\n`;
        }
        for (const s of d.perSpecial) {
            html += `(${s.row},${s.col}) disc:${s.discPresent} classes:${s.classes ? s.classes.join('|') : '-'} var:${s.inlineVar ? 'yes' : 'no'} bg:${s.inlineBg ? 'yes' : 'no'} before:${s.computedBefore ? 'yes' : 'no'} img:${s.injectImg}\n`;
        }
        badge.textContent = html;
    } catch (e) { /* defensive */ }
}

function teardownWorkVisualDiagnosticsBadge() {
    try {
        const existing = document.getElementById('work-visual-diagnostics');
        if (existing) existing.remove();
        if (window._workDiagInterval) {
            clearInterval(window._workDiagInterval);
            window._workDiagInterval = null;
        }
    } catch (e) { /* defensive */ }
}

function initWorkVisualDiagnosticsBadge() {
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
            try { navigator.clipboard && navigator.clipboard.writeText(JSON.stringify(collectWorkVisualDiagnostics(), null, 2)); } catch (e) {}
        });
        document.body.appendChild(badge);
        // periodic update
        window._workDiagInterval = setInterval(updateWorkVisualDiagnosticsBadge, 600);
        // one immediate update
        setTimeout(updateWorkVisualDiagnosticsBadge, 80);

        // expose getter
        window.getWorkVisualDiagnostics = collectWorkVisualDiagnostics;
    } catch (e) { /* defensive */ }
}

// Diagnostics init (call from UI entrypoint; DEBUG flag gates the badge)
function initWorkVisualDiagnosticsAuto() {
    // default: hidden
    if (typeof window.DEBUG_WORK_VISUALS === 'undefined') window.DEBUG_WORK_VISUALS = false;
    // Always expose diagnostic getter for tests / programmatic access
    window.getWorkVisualDiagnostics = collectWorkVisualDiagnostics;
    window.toggleWorkVisualDiagnostics = function(show) {
        if (show) initWorkVisualDiagnosticsBadge(); else teardownWorkVisualDiagnosticsBadge();
    };
    if (window.DEBUG_WORK_VISUALS) initWorkVisualDiagnosticsBadge(); else teardownWorkVisualDiagnosticsBadge();
}

// Expose helper in UI global for the single entrypoint to call
window.initWorkVisualsHelpers = initWorkVisualsHelpers;
window.initWorkVisualDiagnosticsAuto = initWorkVisualDiagnosticsAuto;


// ===== BGM UI Helper =====

// Delegating shims — actual implementations live in ui/bootstrap.js so they are
// available during early initialization. Define light fallbacks only if they
// aren't already present (e.g., in test environments).
if (typeof updateBgmButtons === 'undefined') {
    function updateBgmButtons() {
        if (typeof window !== 'undefined' && typeof window.updateBgmButtons === 'function' && window.updateBgmButtons !== updateBgmButtons) {
            return window.updateBgmButtons();
        }
        // fallback: try to update if DOM exists
        try {
            const bgmPlayBtn = document.getElementById('bgmPlayBtn');
            const bgmPauseBtn = document.getElementById('bgmPauseBtn');
            if (typeof SoundEngine !== 'undefined' && SoundEngine.allowBgmPlay && !SoundEngine.bgm?.paused) {
                if (bgmPlayBtn) bgmPlayBtn.classList.add('btn-active');
                if (bgmPauseBtn) bgmPauseBtn.classList.remove('btn-active');
            } else {
                if (bgmPlayBtn) bgmPlayBtn.classList.remove('btn-active');
                if (bgmPauseBtn) bgmPauseBtn.classList.add('btn-active');
            }
        } catch (e) { /* defensive */ }
    }
}

// ===== Logging =====

/**
 * Log entry delegation shim: prefer global implementation
 */
if (typeof addLog === 'undefined') {
    function addLog(text) {
        if (typeof window !== 'undefined' && typeof window.addLog === 'function' && window.addLog !== addLog) {
            return window.addLog(text);
        }
        if (typeof console !== 'undefined' && console.log) console.log('[log]', String(text));
    }
}

// ===== Status Display =====

/**
 * ステータスを更新
 * Update status display
 */
if (typeof updateStatus === 'undefined') {
    function updateStatus() {
        if (typeof window !== 'undefined' && typeof window.updateStatus === 'function' && window.updateStatus !== updateStatus) {
            return window.updateStatus();
        }
        if (typeof updateCpuCharacter === 'function') updateCpuCharacter();
    }
}

/**
 * CPUキャラクター表示を更新
 * Update CPU character image and level label
 */
    function updateCpuCharacter() {
        // Delegate to ui/status-display.js (single source of truth).
        try {
            if (typeof window !== 'undefined' && typeof window.updateCpuCharacter === 'function' && window.updateCpuCharacter !== updateCpuCharacter) {
                return window.updateCpuCharacter();
            }
        } catch (e) { /* ignore */ }
        try {
            const mod = require('./ui/status-display');
            if (mod && typeof mod.updateCpuCharacter === 'function') return mod.updateCpuCharacter();
        } catch (e) { /* ignore */ }
    }

    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            renderBoard,
            updateOccupancyUI,
            updateBgmButtons,
            addLog,
            updateStatus,
            updateCpuCharacter
        };
    }
