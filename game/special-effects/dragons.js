/**
 * @file dragons.js
 * @description Ultimate Reverse Dragon effect handlers
 */

var mv = (typeof mv !== 'undefined') ? mv : null;
try { mv = (typeof require === 'function') ? require('../move-executor-visuals') : mv; } catch (e) { mv = mv || null; }
// Timers abstraction (injected by UI)
var timers = null;
try { timers = (typeof require === 'function') ? require('../timers') : timers; } catch (e) { timers = timers || null; }
var waitMs = (ms) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());
var BoardOpsModule = null;
try { BoardOpsModule = (typeof require === 'function') ? require('../logic/board_ops') : (typeof BoardOps !== 'undefined' ? BoardOps : null); } catch (e) { BoardOpsModule = BoardOpsModule || null; }
var BoardPresentation = null;
if (typeof require === 'function') {
    try { BoardPresentation = require('../logic/presentation'); } catch (e) { /* ignore */ }
}
if (!BoardPresentation && typeof globalThis !== 'undefined' && globalThis.PresentationHelper) {
    BoardPresentation = globalThis.PresentationHelper;
}
function emitPresentationEventViaBoardOps(ev) {
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : (typeof globalThis !== 'undefined' ? globalThis.PresentationHelper : null);
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    try { console.warn('[dragons] Presentation helper not available'); } catch (e) { }
    return false;
} 

/**
 * Process ultimate reverse dragons: convert surrounding enemy stones
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @returns {Promise<void}
 */
async function processUltimateReverseDragonsAtTurnStart(player, precomputedEvents = null) {
    // Get dragons from unified specialStones
    const dragons = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState).filter(m => m.data && m.data.type === 'DRAGON')
        : (cardState && cardState.markers ? cardState.markers.filter(m => m.kind === 'specialStone' && m.data && m.data.type === 'DRAGON') : []);
    if (dragons.length === 0) return;

    const playerKey = player === BLACK ? 'black' : 'white';

    // Prefer pipeline-produced computation. Use TurnPipelinePhases to perform turn-start processing which includes dragon effects.
    let result = null;
    let regenRes = { regened: [], captureFlips: [] };
    const events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (!events.length) {
        if (typeof TurnPipelinePhases !== 'undefined' && typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {
            TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, events);
        }
    }
    if (events.length) {

        // Build result shape from events
        result = { converted: [], destroyed: [], anchors: [] };

        for (const ev of events) {
            if (ev.type === 'dragon_converted_start' || ev.type === 'dragon_converted_immediate') {
                if (Array.isArray(ev.details)) result.converted.push(...ev.details);
            }
            if (ev.type === 'dragon_destroyed_anchor_start' || ev.type === 'dragon_destroyed_anchor_immediate') {
                if (Array.isArray(ev.details)) result.destroyed.push(...ev.details);
            }
            if (ev.type === 'udg_expired_start' || ev.type === 'udg_expired_immediate') {
                if (Array.isArray(ev.details)) result.anchors.push(...ev.details);
            }
            if (ev.type === 'regen_triggered_start' && Array.isArray(ev.details)) {
                regenRes.regened.push(...ev.details);
            }
            if (ev.type === 'regen_capture_flipped_start' && Array.isArray(ev.details)) {
                regenRes.captureFlips.push(...ev.details);
            }
        }

        // If capture flips require clearing hyperactive marks, pipeline phases already make those logic changes.

        // Dragon timer visuals are UI-only. Emit a board update and let UI sync any timer elements from state.
        if (Array.isArray(result.anchors) && result.anchors.length > 0) {
            if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        }

        // Charge updates MUST be applied by the rule pipeline; do not mutate rule state here.
        if (result.converted.length > 0) {
            if (typeof emitCardStateChange === 'function') emitCardStateChange();
            else console.warn('[DRAGONS] charge updates should come from pipeline; emitCardStateChange not available');
        }

        // Log conversions
        if (result.converted.length > 0) {
            if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.dragonConverted(getPlayerName(player), result.converted.length));
        }
    } else {
        console.error('[DRAGONS] No precomputed events provided and pipeline unavailable; skipping dragon processing');
        return;
    }

    let delay = 800;
    if (typeof require === 'function') {
        try {
            const { getAnimationTiming } = require('../../constants/animation-constants');
            delay = getAnimationTiming('FLIP_ANIMATION_DURATION') || delay;
        } catch (e) { /* ignore */ }
    } else if (typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming === 'function') {
        delay = globalThis.getAnimationTiming('FLIP_ANIMATION_DURATION') || delay;
    }

    if (result.converted.length > 0) {
        // IMPORTANT:
        // Do NOT re-render the board here.
        // When a dragon expires on the same tick it converts stones, CardLogic has already
        // set the anchor cell to EMPTY. A re-render would remove the anchor disc before
        // we can run the fade-out animation, making it "instantly disappear" sometimes.
        // We only need manual visual tweaks because converted targets already have discs.

        const regenedSet = new Set((regenRes.regened || []).map(p => `${p.row},${p.col}`));
        const hasAnchors = Array.isArray(result.anchors) && result.anchors.length > 0;
        const allAnchorsFinal = hasAnchors && result.anchors.every(a => a.remainingNow === 0);
        const showSplitAnimation = !allAnchorsFinal; // skip the artificial delay on the final-expiry activation

        const setDiscColorAt = (row, col, color) => {
            try { const vis = require('../move-executor-visuals'); if (vis && typeof vis.setDiscColorAt === 'function') return vis.setDiscColorAt(row, col, color); } catch (e) { /* ignore in non-UI */ }
            return undefined;
        };

        const removeBombOverlayAt = (row, col) => {
            try { const vis = require('../move-executor-visuals'); if (vis && typeof vis.removeBombOverlayAt === 'function') return vis.removeBombOverlayAt(row, col); } catch (e) { /* ignore in non-UI */ }
            return undefined;
        };

        // Ensure converted stones visually become the new color immediately.
        const initialColor = showSplitAnimation ? -player : player;
        for (const pos of result.converted) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip visual change for Regen stones

            // Bombs become normal stones when flipped, so remove bomb visuals immediately.
            removeBombOverlayAt(pos.row, pos.col);
            setDiscColorAt(pos.row, pos.col, initialColor);

            // If it was a special stone (like Regen but NOT regened now, though that shouldn't happen here),
            // remove its effect because it's been flipped.
            // Request a UI-side cross-fade for regen visuals via presentation events
            emitPresentationEventViaBoardOps({ type: 'CROSSFADE_STONE', row: pos.row, col: pos.col, effectKey: 'regenStone', owner: player, fadeIn: false, durationMs: 600 });
        }

        // Flip suppression is handled by applyFlipAnimations below for consistency.
        // (No per-disc class toggles here.)

        // Emit CHANGE presentation events for converted flips so UI handles flip visuals via Playback
        const flipCoords = result.converted
            .filter(p => !regenedSet.has(`${p.row},${p.col}`))
            .map(p => [p.row, p.col]);
        if (flipCoords.length > 0 && showSplitAnimation) {
            await waitMs(delay);
            for (const pos of result.converted) {
                if (regenedSet.has(`${pos.row},${pos.col}`)) continue;
                setDiscColorAt(pos.row, pos.col, player);
            }
        }

        if (regenRes.regened && regenRes.regened.length) {
            // Use universal cross-fade system
            for (const pos of regenRes.regened) {
                const ownerColor = gameState.board[pos.row][pos.col];
                // Ask UI to perform cross-fade via presentation event (UI decides whether to run it)
                emitPresentationEventViaBoardOps({ type: 'CROSSFADE_STONE', row: pos.row, col: pos.col, effectKey: 'regenStone', owner: ownerColor, newColor: ownerColor, durationMs: 600, autoFadeOut: true, fadeWholeStone: true });
            }
        }

        // Regen capture flips (do not include the "flip back" itself; only capture flips)
        if (regenRes.captureFlips && regenRes.captureFlips.length) {
            if (showSplitAnimation) {
                for (const pos of regenRes.captureFlips) {
                    setDiscColorAt(pos.row, pos.col, -player);
                }
                await waitMs(delay);
                for (const pos of regenRes.captureFlips) {
                    setDiscColorAt(pos.row, pos.col, player);
                }
            } else {
                for (const pos of regenRes.captureFlips) {
                    setDiscColorAt(pos.row, pos.col, player);
                }
            }
        }
    }

    // Animate destroyed anchors (fade-out) after conversions
    for (const pos of result.destroyed) {
        if (mv && typeof mv.animateFadeOutAt === 'function') await mv.animateFadeOutAt(pos.row, pos.col, { createGhost: true, color: player, effectKey: 'ultimateDragon' });
    }

    // Final UI sync after all animations
    emitBoardUpdate();
    emitGameStateChange();
}

/**
 * Placement-turn immediate activation for a newly placed dragon anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
async function processUltimateReverseDragonImmediateAtPlacement(player, row, col, precomputedResult = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    // Prefer precomputed result (from pipeline); otherwise abort to avoid UI-side logic writes
    let result = precomputedResult;
    let regenRes = { regened: [], captureFlips: [] };
    if (!result) {
        console.error('[DRAGON IMMEDIATE] No precomputed pipeline result provided; cannot compute dragon immediate effects from UI');
        return;
    }

    // If pipeline augmented result with regen info, use it
    regenRes = result.regen || result.regenRes || regenRes;

    if (result.converted && result.converted.length > 0) {
        cardState.charge[playerKey] = Math.min(30, cardState.charge[playerKey] + result.converted.length);
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.dragonConvertedImmediate(getPlayerName(player), result.converted.length));
    }

    const delay = typeof FLIP_ANIMATION_DURATION_MS !== 'undefined' ? FLIP_ANIMATION_DURATION_MS : 800;
    if (result.converted.length > 0) {
        emitBoardUpdate();

        const regenedSet = new Set((regenRes.regened || []).map(p => `${p.row},${p.col}`));

        const setDiscColorAt = (r, c, color) => {
            try {
                const vis = require('../move-executor-visuals');
                if (vis && typeof vis.setDiscColorAt === 'function') return vis.setDiscColorAt(r, c, color);
            } catch (e) { /* ignore */ }
            return undefined;
        };

        // Timers abstraction (injected by UI)
        let timers = null;
        if (typeof require === 'function') {
            try { timers = require('../timers'); } catch (e) { /* ignore */ }
        }

        const waitMs = (ms) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());


        const ownerColor = player === BLACK ? BLACK : WHITE;
        const fromColor = -ownerColor;

        // Prepare converted stones to show the pre-flip color
        for (const pos of result.converted) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) {
                // Ensure regen overlay is removed so icon doesn't interfere with flip
                await removeRegenOverlayAt(pos.row, pos.col);
            }
            setDiscColorAt(pos.row, pos.col, fromColor);
        }

        const flipCoords = result.converted
            .filter(p => !regenedSet.has(`${p.row},${p.col}`))
            .map(p => [p.row, p.col]);
        if (flipCoords.length > 0) {
            for (const [r, c] of flipCoords) {
                const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
            }
            // Wait for animation duration before finalizing colors
            await waitMs(delay);
        }
        for (const pos of result.converted) {
            setDiscColorAt(pos.row, pos.col, ownerColor);
        }

        if (regenRes.regened && regenRes.regened.length) {
            // Use universal cross-fade system
            for (const pos of regenRes.regened) {
                const actualOwnerColor = gameState.board[pos.row][pos.col];
                // Ask UI to perform cross-fade via presentation event
                emitPresentationEventViaBoardOps({ type: 'CROSSFADE_STONE', row: pos.row, col: pos.col, effectKey: 'regenStone', owner: actualOwnerColor, newColor: actualOwnerColor, durationMs: 600, autoFadeOut: true, fadeWholeStone: true });
            }
        }

        if (regenRes.captureFlips && regenRes.captureFlips.length) {
            const capCoords = regenRes.captureFlips.map(p => [p.row, p.col]);
            for (const pos of regenRes.captureFlips) {
                setDiscColorAt(pos.row, pos.col, -ownerColor);
            }
            if (capCoords.length > 0) {
                for (const [r, c] of capCoords) {
                    const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                    const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                    emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
                }
            }
            await waitMs(delay);
        }
    }

    emitBoardUpdate();
    emitGameStateChange();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processUltimateReverseDragonsAtTurnStart,
        processUltimateReverseDragonImmediateAtPlacement
    };
}
