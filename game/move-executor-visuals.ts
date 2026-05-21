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

// Globals injected at runtime by UI
declare var __uiImpl: any;
declare var AnimationEngine: any;
declare var CardLogic: any;

// Module-level variable for injected UI visuals implementation
let __uiImpl_move_exec_visuals: any = {};

// getMoveExecutorVisuals exists for the export (historically referenced)
const getMoveExecutorVisuals: any = undefined;

// Visual helpers and animation sequence for move execution

function _assertNotDuringPlayback() {
    if (__uiImpl_move_exec_visuals && __uiImpl_move_exec_visuals.VisualPlaybackActive === true) {
        if (__uiImpl.__DEV__ === true) {
            throw new Error('Legacy visual helper called during active VisualPlayback (dev fail-fast)');
        } else {
            console.error('Legacy visual helper called during active VisualPlayback. Aborting playback and syncing final state (prod fallback)');
            if (typeof AnimationEngine !== 'undefined' && AnimationEngine && typeof AnimationEngine.abortAndSync === 'function') {
                AnimationEngine.abortAndSync();
            }
            return false;
        }
    }
    return true;
}

function applyFlipAnimations(flipsToAnimate: any) {
    // Delegate to injected UI implementation if present
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.applyFlipAnimations === 'function') {
        return __uiImpl.applyFlipAnimations(flipsToAnimate);
    }
    return undefined;
}

function setDiscColorAt(row: any, col: any, color: any) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.setDiscColorAt === 'function') {
        return __uiImpl.setDiscColorAt(row, col, color);
    }
    return undefined;
}

function removeBombOverlayAt(row: any, col: any) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.removeBombOverlayAt === 'function') {
        return __uiImpl.removeBombOverlayAt(row, col);
    }
    return undefined;
}

function clearAllStoneVisualEffectsAt(row: any, col: any) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.clearAllStoneVisualEffectsAt === 'function') {
        return __uiImpl.clearAllStoneVisualEffectsAt(row, col);
    }
    return undefined;
}

function syncDiscVisualToCurrentState(row: any, col: any) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.syncDiscVisualToCurrentState === 'function') {
        return __uiImpl.syncDiscVisualToCurrentState(row, col);
    }
    return undefined;
}

const TIME_BOMB_TURNS = (typeof CardLogic !== 'undefined' && Number.isFinite(CardLogic.TIME_BOMB_TURNS))
    ? CardLogic.TIME_BOMB_TURNS
    : 3;

function getFlipAnimMs() {
    const val = (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.getFlipAnimMs === 'function') ? __uiImpl.getFlipAnimMs() : undefined;
    return typeof val === 'number' ? val : 600;
}

function getPhaseGapMs() {
    const val = (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.getPhaseGapMs === 'function') ? __uiImpl.getPhaseGapMs() : undefined;
    return typeof val === 'number' ? val : 200;
}

function getTurnTransitionGapMs() {
    const val = (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.getTurnTransitionGapMs === 'function') ? __uiImpl.getTurnTransitionGapMs() : undefined;
    return typeof val === 'number' ? val : getPhaseGapMs();
}

// Timers abstraction injection - use game/timers when available instead of direct timers
let timers: any = null;
try { timers = _require('../timers'); } catch (e) { /* ignore */ }
const _waitMs = (ms: any) => (timers && typeof timers.waitMs === 'function') ? timers.waitMs(ms) : Promise.resolve();

async function animateFlipsWithDeferredColor(flips: any, fromColor: any, toColor: any) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.animateFlipsWithDeferredColor === 'function') {
        return __uiImpl.animateFlipsWithDeferredColor(flips, fromColor, toColor);
    }
    return undefined;
}

async function animateRegenBack(regenedPositions: any, flipperColor: any) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.animateRegenBack === 'function') {
        return __uiImpl.animateRegenBack(regenedPositions, flipperColor);
    }
    return undefined;
}

// Game-side wrappers for common UI animations (safe no-op when UI not present)
async function animateFadeOutAt(row: any, col: any, options: any) {
    if (typeof __uiImpl_move_exec_visuals !== 'undefined' && __uiImpl_move_exec_visuals && typeof __uiImpl_move_exec_visuals.animateFadeOutAt === 'function') {
        return __uiImpl_move_exec_visuals.animateFadeOutAt(row, col, options);
    }
    const delay = (options && options.durationMs) ? options.durationMs : 0;
    return _waitMs(delay);
}

async function animateDestroyAt(row: any, col: any, options: any) {
    if (typeof __uiImpl_move_exec_visuals !== 'undefined' && __uiImpl_move_exec_visuals && typeof __uiImpl_move_exec_visuals.animateDestroyAt === 'function') {
        return __uiImpl_move_exec_visuals.animateDestroyAt(row, col, options);
    }
    const delay = (options && options.durationMs) ? options.durationMs : 0;
    return _waitMs(delay);
}

async function animateHyperactiveMove(from: any, to: any, options?: any) {
    if (typeof __uiImpl_move_exec_visuals !== 'undefined' && __uiImpl_move_exec_visuals && typeof __uiImpl_move_exec_visuals.animateHyperactiveMove === 'function') {
        return __uiImpl_move_exec_visuals.animateHyperactiveMove(from, to, options);
    }
    return Promise.resolve();
}

async function animateHyperactiveMoveChain(moves: any) {
    if (typeof __uiImpl_move_exec_visuals !== 'undefined' && __uiImpl_move_exec_visuals && typeof __uiImpl_move_exec_visuals.animateHyperactiveMoveChain === 'function') {
        return __uiImpl_move_exec_visuals.animateHyperactiveMoveChain(moves);
    }
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
    if (typeof __uiImpl_move_exec_visuals !== 'undefined' && __uiImpl_move_exec_visuals && typeof __uiImpl_move_exec_visuals.hasPlaybackEngine === 'function') {
        return __uiImpl_move_exec_visuals.hasPlaybackEngine() === true;
    }
    return false;
}

async function playDrawAnimation(player: any, drawnCardId: any) {
    if (typeof __uiImpl_move_exec_visuals !== 'undefined' && __uiImpl_move_exec_visuals && typeof __uiImpl_move_exec_visuals.playDrawAnimation === 'function') {
        return __uiImpl_move_exec_visuals.playDrawAnimation(player, drawnCardId);
    }
    return Promise.resolve();
}

async function updateDeckVisual() {
    if (typeof __uiImpl_move_exec_visuals !== 'undefined' && __uiImpl_move_exec_visuals && typeof __uiImpl_move_exec_visuals.updateDeckVisual === 'function') {
        return __uiImpl_move_exec_visuals.updateDeckVisual();
    }
    return Promise.resolve();
}

function applyPendingSpecialstoneVisual(move: any, pendingType: any) {
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.applyPendingSpecialstoneVisual === 'function') {
        return __uiImpl.applyPendingSpecialstoneVisual(move, pendingType);
    }
    return undefined;
}

async function runMoveVisualSequence(move: any, hadSelection: any, phases: any, effects: any, immediate: any) {
    // Delegate to injected UI implementation if present. Ensure we are not delegating to ourselves (avoid infinite recursion).
    if (typeof __uiImpl !== 'undefined' && __uiImpl && typeof __uiImpl.runMoveVisualSequence === 'function' && __uiImpl.runMoveVisualSequence !== runMoveVisualSequence) {
        return __uiImpl.runMoveVisualSequence(move, hadSelection, phases, effects, immediate);
    }
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
