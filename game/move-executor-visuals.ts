declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
  if (typeof __non_webpack_require__ !== 'undefined') {
    return __non_webpack_require__(id);
  }
  if (typeof require === 'function') {
    return require(id);
  }
  throw new Error('Unable to require ' + id);
}

// Module-level variable for injected UI visuals implementation
let __uiImpl_move_exec_visuals: any = {};

// getMoveExecutorVisuals exists for the export (historically referenced)
const getMoveExecutorVisuals: any = undefined;

// Visual helpers and animation sequence for move execution

function readMoveExecutorVisualFunction(name: string): any {
    const impl = __uiImpl_move_exec_visuals || {};
    return typeof impl[name] === 'function' ? impl[name] : null;
}

function applyFlipAnimations(flipsToAnimate: any) {
    const fn = readMoveExecutorVisualFunction('applyFlipAnimations');
    if (fn) return fn(flipsToAnimate);
    return undefined;
}

function setDiscColorAt(row: any, col: any, color: any) {
    const fn = readMoveExecutorVisualFunction('setDiscColorAt');
    if (fn) return fn(row, col, color);
    return undefined;
}

function removeBombOverlayAt(row: any, col: any) {
    const fn = readMoveExecutorVisualFunction('removeBombOverlayAt');
    if (fn) return fn(row, col);
    return undefined;
}

function clearAllStoneVisualEffectsAt(row: any, col: any) {
    const fn = readMoveExecutorVisualFunction('clearAllStoneVisualEffectsAt');
    if (fn) return fn(row, col);
    return undefined;
}

function syncDiscVisualToCurrentState(row: any, col: any) {
    const fn = readMoveExecutorVisualFunction('syncDiscVisualToCurrentState');
    if (fn) return fn(row, col);
    return undefined;
}

function getFlipAnimMs() {
    const fn = readMoveExecutorVisualFunction('getFlipAnimMs');
    const val = fn ? fn() : undefined;
    return typeof val === 'number' ? val : 600;
}

function getPhaseGapMs() {
    const fn = readMoveExecutorVisualFunction('getPhaseGapMs');
    const val = fn ? fn() : undefined;
    return typeof val === 'number' ? val : 200;
}

function getTurnTransitionGapMs() {
    const fn = readMoveExecutorVisualFunction('getTurnTransitionGapMs');
    const val = fn ? fn() : undefined;
    return typeof val === 'number' ? val : getPhaseGapMs();
}

// Timers abstraction injection - use game/timers when available instead of direct timers
let timers: any = null;
try { timers = _require('../timers'); } catch (e) { /* ignore */ }
const _waitMs = (ms: any) => (timers && typeof timers.waitMs === 'function') ? timers.waitMs(ms) : Promise.resolve();

async function animateFlipsWithDeferredColor(flips: any, fromColor: any, toColor: any) {
    const fn = readMoveExecutorVisualFunction('animateFlipsWithDeferredColor');
    if (fn) return fn(flips, fromColor, toColor);
    return undefined;
}

async function animateRegenBack(regenedPositions: any, flipperColor: any) {
    const fn = readMoveExecutorVisualFunction('animateRegenBack');
    if (fn) return fn(regenedPositions, flipperColor);
    return undefined;
}

// Game-side wrappers for common UI animations (safe no-op when UI not present)
async function animateFadeOutAt(row: any, col: any, options: any) {
    const fn = readMoveExecutorVisualFunction('animateFadeOutAt');
    if (fn) return fn(row, col, options);
    const delay = (options && options.durationMs) ? options.durationMs : 0;
    return _waitMs(delay);
}

async function animateDestroyAt(row: any, col: any, options: any) {
    const fn = readMoveExecutorVisualFunction('animateDestroyAt');
    if (fn) return fn(row, col, options);
    const delay = (options && options.durationMs) ? options.durationMs : 0;
    return _waitMs(delay);
}

async function animateHyperactiveMove(from: any, to: any, options?: any) {
    const fn = readMoveExecutorVisualFunction('animateHyperactiveMove');
    if (fn) return fn(from, to, options);
    return Promise.resolve();
}

async function animateHyperactiveMoveChain(moves: any) {
    const fn = readMoveExecutorVisualFunction('animateHyperactiveMoveChain');
    if (fn) return fn(moves);
    if (!Array.isArray(moves)) {
        return Promise.resolve();
    }
    for (const move of moves) {
        if (!move || !move.from || !move.to) continue;
        await animateHyperactiveMove(move.from, move.to);
    }
    return Promise.resolve();
}

function hasPlaybackEngine() {
    const fn = readMoveExecutorVisualFunction('hasPlaybackEngine');
    return fn ? fn() === true : false;
}

async function playDrawAnimation(player: any, drawnCardId: any) {
    const fn = readMoveExecutorVisualFunction('playDrawAnimation');
    if (fn) return fn(player, drawnCardId);
    return Promise.resolve();
}

async function updateDeckVisual() {
    const fn = readMoveExecutorVisualFunction('updateDeckVisual');
    if (fn) return fn();
    return Promise.resolve();
}

function applyPendingSpecialstoneVisual(move: any, pendingType: any) {
    const fn = readMoveExecutorVisualFunction('applyPendingSpecialstoneVisual');
    if (fn) return fn(move, pendingType);
    return undefined;
}

async function runMoveVisualSequence(move: any, hadSelection: any, phases: any, effects: any, immediate: any) {
    const fn = readMoveExecutorVisualFunction('runMoveVisualSequence');
    if (fn && fn !== runMoveVisualSequence) return fn(move, hadSelection, phases, effects, immediate);
    return undefined;
}

// Expose to Node.js requires; game/ side is intentionally DOM-free and delegates to UI at runtime
// Provide a small DI boundary so UI can inject implementations for visual helpers.
__uiImpl_move_exec_visuals = {};
function setUIImpl(obj: any) { __uiImpl_move_exec_visuals = obj || {}; }
function clearUIImpl() { __uiImpl_move_exec_visuals = {}; }

// CommonJS (Node/tests) export. In browser script-tag mode, `module` is undefined.
export = {
    applyFlipAnimations,
    setDiscColorAt,
    removeBombOverlayAt,
    clearAllStoneVisualEffectsAt,
    syncDiscVisualToCurrentState,
    getFlipAnimMs,
    getPhaseGapMs,
    getTurnTransitionGapMs,
    animateFlipsWithDeferredColor,
    animateRegenBack,
    animateFadeOutAt,
    animateDestroyAt,
    animateHyperactiveMove,
    animateHyperactiveMoveChain,
    hasPlaybackEngine,
    playDrawAnimation,
    updateDeckVisual,
    applyPendingSpecialstoneVisual,
    runMoveVisualSequence,
    getMoveExecutorVisuals,
    setUIImpl,
    clearUIImpl
};
// NOTE: Legacy global attachments have been removed from game/ and are now the responsibility of `ui/bootstrap.js` or
// `ui/move-executor-visuals.js` to provide if needed. This keeps `game/` free of global side-effects.
