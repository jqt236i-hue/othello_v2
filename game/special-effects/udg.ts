declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== "undefined")
  ? __non_webpack_require__
  : require;
const LOG_MESSAGES = _require('../log-messages');
const { getPlayerDisplayName } = _require('../card-effects/helpers');
const SpecialEffectsPresentationBridge = _require('./presentation-bridge');

/**
 * @file udg.js
 * @description Ultimate Destroy God effect handlers
 */

function setUIImpl(obj: any) { SpecialEffectsPresentationBridge.setUIImpl('udg', obj); }

function emitUdgLog(message: any): void {
    SpecialEffectsPresentationBridge.emitLogAdded('udg', message, 'effect');
}

function emitUdgBoardUpdate(): void {
    SpecialEffectsPresentationBridge.emitBoardUpdate('udg');
}

function emitUdgGameStateChange(): void {
    SpecialEffectsPresentationBridge.emitGameStateChange('udg');
}

function getUdgPlayerName(player: number): string {
    return SpecialEffectsPresentationBridge.getPlayerName('udg', player, getPlayerDisplayName);
}

function hasPlaybackEngineForUdg(): boolean {
    return SpecialEffectsPresentationBridge.hasPlaybackEngine('udg');
}

async function animateUdgFadeOut(row: number, col: number, options?: any): Promise<any> {
    const injected = SpecialEffectsPresentationBridge.readFunction('udg', 'animateFadeOutAt');
    if (typeof injected === 'function') {
        return injected(row, col, options);
    }
    return SpecialEffectsPresentationBridge.animateFadeOutAt('udg', row, col, options);
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
