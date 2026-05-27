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
const LOG_MESSAGES = _require('../log-messages');
const ControllerEvents = _require('../controller-events');
const { getPlayerDisplayName } = _require('../card-effects/helpers');

/**
 * @file breeding.js
 * @description Breeding effect handlers
 */

let __uiImpl_breeding: any = {};
function setUIImpl(obj: any) { __uiImpl_breeding = obj || {}; }

function emitBreedingLog(message: any): void {
    if (__uiImpl_breeding && typeof __uiImpl_breeding.emitLogAdded === 'function') {
        __uiImpl_breeding.emitLogAdded(message, 'effect');
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
        ControllerEvents.emitLogAdded(message, 'effect');
    }
}

function emitBreedingBoardUpdate(): void {
    if (__uiImpl_breeding && typeof __uiImpl_breeding.emitBoardUpdate === 'function') {
        __uiImpl_breeding.emitBoardUpdate();
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitBoardUpdate === 'function') ControllerEvents.emitBoardUpdate();
}

function emitBreedingGameStateChange(): void {
    if (__uiImpl_breeding && typeof __uiImpl_breeding.emitGameStateChange === 'function') {
        __uiImpl_breeding.emitGameStateChange();
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitGameStateChange === 'function') ControllerEvents.emitGameStateChange();
}

function emitBreedingCardStateChange(): void {
    if (__uiImpl_breeding && typeof __uiImpl_breeding.emitCardStateChange === 'function') {
        __uiImpl_breeding.emitCardStateChange();
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitCardStateChange === 'function') ControllerEvents.emitCardStateChange();
}

function getBreedingPlayerName(player: number): string {
    if (__uiImpl_breeding && typeof __uiImpl_breeding.getPlayerName === 'function') {
        return __uiImpl_breeding.getPlayerName(player);
    }
    return getPlayerDisplayName(player);
}

// Timers abstraction (UI may inject via timers.setTimerImpl)
let timers = null;
if (typeof require === 'function') {
    try { timers = _require('../timers'); } catch (e) { /* ignore */ }
}
const waitMs = (ms: number) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());

// Animation timing import through module dependency.
let _getAnimationTiming_baked: ((key: string) => number) | null = null;
if (typeof require === 'function') {
    try { ({ getAnimationTiming: _getAnimationTiming_baked } = _require('../../constants/animation-constants')); } catch (e) { /* ignore */ }
}

function hasPlaybackEngineForBreeding(): boolean {
    return typeof __uiImpl_breeding.playPresentationEvents === 'function';
}

function getAnimationTimingForBreeding(key: string): number | undefined {
    if (__uiImpl_breeding && typeof __uiImpl_breeding.getAnimationTiming === 'function') {
        try { return __uiImpl_breeding.getAnimationTiming(key); } catch (e) { /* ignore */ }
    }
    return typeof _getAnimationTiming_baked === 'function' ? _getAnimationTiming_baked(key) : undefined;
}

/**
 * Process breeding effects (Stone spawning)
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @param {Object} [precomputedResult] - Optional pre-computed result from logic layer
 * @returns {Promise<void>}
 */
async function processBreedingEffectsAtTurnStart(player: number, precomputedEvents: any = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    const hasPlayback = hasPlaybackEngineForBreeding();

    // Prefer a precomputed result from pipeline events if provided
    let result: any = null;
    if (precomputedEvents && Array.isArray(precomputedEvents)) {
        result = { spawned: [], destroyed: [], flipped: [], anchors: [] };
        for (const ev of precomputedEvents) {
            if (ev.type === 'breeding_spawned_start' || ev.type === 'breeding_spawned_immediate') {
                if (Array.isArray(ev.details)) result.spawned.push(...ev.details);
            }
            if (ev.type === 'breeding_destroyed_start' || ev.type === 'breeding_destroyed_immediate') {
                if (Array.isArray(ev.details)) result.destroyed.push(...ev.details);
            }
            if (ev.type === 'breeding_flipped_start' || ev.type === 'breeding_flipped_immediate') {
                if (Array.isArray(ev.details)) result.flipped.push(...ev.details);
            }
            if (ev.type === 'breeding_anchor_start' || ev.type === 'breeding_anchor_immediate') {
                if (Array.isArray(ev.details)) result.anchors.push(...ev.details);
            }
        }
    } else {
        console.error('[BREEDING] No precomputed pipeline events provided; skipping breeding presentation');
        return;
    }

    if (result.spawned.length > 0) {
        emitBreedingLog(LOG_MESSAGES.breedingSpawnedImmediate(getBreedingPlayerName(player), result.spawned.length));
    }

    // Refresh breeding timers BEFORE any fade-out so "0" can be visible on the last tick.
    // Prefer anchors[] returned by the logic layer, because the marker may be removed immediately.
    const timerAnchors = Array.isArray(result.anchors) ? result.anchors : null;
    // Timer updates are UI concerns. UI should derive timer values from `cardState.specialStones`
    // and/or provided presentationEvents (anchors) and render them. Skip DOM manipulation here.

    // Charge updates MUST be applied by the rule pipeline; do not mutate rule state here.
    if (result.flipped.length > 0) {
        emitBreedingCardStateChange();
    }

    if (hasPlayback) {
        // PlaybackEngine will handle visuals; ensure UI consumes presentation events.
        try { emitBreedingBoardUpdate(); } catch (e) { /* ignore */ }
        return;
    }

    // Spawn each stone sequentially (no opacity animation)
    for (const spawn of result.spawned) {
        // UI should create the disc from presentationEvents/BoardOps; preserve timing only
        await waitMs(800);
    }

    // Flip animations for stones affected by the spawned stone
    if (result.flipped.length > 0) {
        // Flip animations are UI responsibilities. Preserve pacing but do not perform DOM changes here.
        const delay = getAnimationTimingForBreeding('FLIP_ANIMATION_DURATION') || 800;
        await waitMs(delay);
    }

    // After spawning and splitting, handle destroyed anchors (fade-out)
    for (const pos of result.destroyed) {
        if (__uiImpl_breeding && typeof __uiImpl_breeding.animateFadeOutAt === 'function') {
            await __uiImpl_breeding.animateFadeOutAt(pos.row, pos.col);
        } else {
            await waitMs(300);
        }
    }

    // Final UI sync after all animations
    try { emitBreedingBoardUpdate(); } catch (e) { /* ignore */ }
    try { emitBreedingGameStateChange(); } catch (e) { /* ignore */ }
}

/**
 * Placement-turn immediate activation for a newly placed breeding anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
async function processBreedingImmediateAtPlacement(player: number, row: number, col: number, precomputedResult: any = null) {
    const playerKey = player === BLACK ? 'black' : 'white';
    if (!precomputedResult) {
        console.error('[BREEDING IMMEDIATE] No precomputed pipeline result provided; skipping breeding presentation');
        return;
    }
    const result = precomputedResult;

    if (result.spawned.length > 0) {
        emitBreedingLog(LOG_MESSAGES.breedingSpawned(getBreedingPlayerName(player), result.spawned.length));
    }
    if (result.flipped.length > 0) {
        emitBreedingCardStateChange();
    }

    // Spawn animation removed — UI should create discs from presentationEvents. Preserve pacing.
    const BREEDING_FADE_MS = 350; // preserve previous pacing
    for (const spawn of result.spawned) {
        await waitMs(BREEDING_FADE_MS);
    }

    // Flip animation for affected stones: UI responsibility. Preserve pacing.
    if (result.flipped.length > 0) {
        const delay = getAnimationTimingForBreeding('FLIP_ANIMATION_DURATION') || 800;
        await waitMs(delay);
    }

}

// Exports
export = {
    processBreedingEffectsAtTurnStart,
    processBreedingImmediateAtPlacement,
    setUIImpl
};
