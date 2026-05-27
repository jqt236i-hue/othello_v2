declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;
const LOG_MESSAGES = _require('../log-messages');
const ControllerEvents = _require('../controller-events');
const { getPlayerDisplayName } = _require('../card-effects/helpers');

/**
 * @file udg.js
 * @description Ultimate Destroy God effect handlers
 */

let __uiImpl_udg: any = {};
function setUIImpl(obj: any) { __uiImpl_udg = obj || {}; }

function emitUdgLog(message: any): void {
    if (__uiImpl_udg && typeof __uiImpl_udg.emitLogAdded === 'function') {
        __uiImpl_udg.emitLogAdded(message, 'effect');
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitLogAdded === 'function') {
        ControllerEvents.emitLogAdded(message, 'effect');
    }
}

function emitUdgBoardUpdate(): void {
    if (__uiImpl_udg && typeof __uiImpl_udg.emitBoardUpdate === 'function') {
        __uiImpl_udg.emitBoardUpdate();
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitBoardUpdate === 'function') ControllerEvents.emitBoardUpdate();
}

function emitUdgGameStateChange(): void {
    if (__uiImpl_udg && typeof __uiImpl_udg.emitGameStateChange === 'function') {
        __uiImpl_udg.emitGameStateChange();
        return;
    }
    if (ControllerEvents && typeof ControllerEvents.emitGameStateChange === 'function') ControllerEvents.emitGameStateChange();
}

function getUdgPlayerName(player: number): string {
    if (__uiImpl_udg && typeof __uiImpl_udg.getPlayerName === 'function') {
        return __uiImpl_udg.getPlayerName(player);
    }
    return getPlayerDisplayName(player);
}

function hasPlaybackEngineForUdg(): boolean {
    return typeof __uiImpl_udg.playPresentationEvents === 'function';
}

async function animateUdgFadeOut(row: number, col: number, options?: any): Promise<any> {
    if (__uiImpl_udg && typeof __uiImpl_udg.animateFadeOutAt === 'function') {
        return __uiImpl_udg.animateFadeOutAt(row, col, options);
    }
    return undefined;
}

/**
 * Process ultimate destroy gods: destroy surrounding enemy stones (Destroy)
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @returns {Promise<void>}
 */
async function processUltimateDestroyGodsAtTurnStart(player: number, precomputedResult: any = null, precomputedEvents: any = null) {
    const udgs = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState).filter((m: any) => m.data && m.data.type === 'ULTIMATE_DESTROY_GOD')
        : (cardState && cardState.markers ? cardState.markers.filter((m: any) => m.kind === 'specialStone' && m.data && m.data.type === 'ULTIMATE_DESTROY_GOD') : []);
    if (!udgs.length) return;

    const hasPlayback = hasPlaybackEngineForUdg();

    const playerKey = player === BLACK ? 'black' : 'white';
    // Prefer precomputed result (from pipeline). If not provided, try to extract from events.
    let result = precomputedResult;
    if (!result) {
        if (Array.isArray(precomputedEvents) && precomputedEvents.length) {
            // Build result from events
            result = { destroyed: [], expired: [], anchors: [] };
            for (const ev of precomputedEvents) {
                if (ev.type === 'udg_destroyed_start' || ev.type === 'udg_destroyed_immediate') {
                    if (Array.isArray(ev.details)) result.destroyed.push(...ev.details);
                }
                if (ev.type === 'udg_expired_start' || ev.type === 'udg_expired_immediate') {
                    if (Array.isArray(ev.details)) result.expired.push(...ev.details);
                }
                if (ev.type === 'udg_anchor_start' || ev.type === 'udg_anchor_immediate') {
                    if (Array.isArray(ev.details)) result.anchors.push(...ev.details);
                }
            }
        } else {
            console.error('[UDG] No precomputed pipeline result/events provided; skipping UDG presentation');
            return;
        }
    }

    // UDG anchor timer visuals are UI-only. Let the UI sync timers from state (emit a board update).
    if (Array.isArray(result.anchors) && result.anchors.length > 0) {
        emitUdgBoardUpdate();
    }

    if (result.destroyed.length > 0) {
        emitUdgLog(LOG_MESSAGES.udgDestroyed(getUdgPlayerName(player), result.destroyed.length));
    }

    if (hasPlayback) {
        // PlaybackEngine will handle destroy visuals; ensure UI consumes presentation events.
        try { emitUdgBoardUpdate(); } catch (e) { /* ignore */ }
        return;
    }

    // Fade-out destroyed stones as a batch
    if (result.destroyed.length > 0) {
        const unique = new Map();
        for (const p of result.destroyed) unique.set(`${p.row},${p.col}`, p);
        await Promise.all(Array.from(unique.values()).map(p => animateUdgFadeOut(p.row, p.col)));
    }

    // Fade-out expired anchors AFTER destroying surroundings
    if (Array.isArray(result.expired) && result.expired.length > 0) {
        const unique = new Map();
        for (const p of result.expired) unique.set(`${p.row},${p.col}`, p);
        for (const p of unique.values()) {
            await animateUdgFadeOut(p.row, p.col, { createGhost: true, color: player, effectKey: 'ultimateDestroyGod' });
        }
    }

    emitUdgBoardUpdate();
    emitUdgGameStateChange();
}

/**
 * Placement-turn immediate activation for a newly placed UDG anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
async function processUltimateDestroyGodImmediateAtPlacement(player: number, row: number, col: number, precomputedResult: any = null) {
    const playerKey = player === BLACK ? 'black' : 'white';
    if (!precomputedResult) {
        console.error('[UDG IMMEDIATE] No precomputed pipeline result provided; skipping UDG presentation');
        return;
    }
    const result = precomputedResult;

    if (result.destroyed.length > 0) {
        emitUdgLog(LOG_MESSAGES.udgDestroyedImmediate(getUdgPlayerName(player), result.destroyed.length));
        const unique = new Map();
        for (const p of result.destroyed) unique.set(`${p.row},${p.col}`, p);
        await Promise.all(Array.from(unique.values()).map(p => animateUdgFadeOut(p.row, p.col)));
    }

    emitUdgBoardUpdate();
    emitUdgGameStateChange();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setUIImpl,
        processUltimateDestroyGodsAtTurnStart,
        processUltimateDestroyGodImmediateAtPlacement
    };
}

export {};
