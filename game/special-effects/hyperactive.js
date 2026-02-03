/**
 * @file hyperactive.js
 * @description Hyperactive effect handlers
 */

var mv = (typeof mv !== 'undefined') ? mv : null;
try { mv = (typeof require === 'function') ? require('../move-executor-visuals') : mv; } catch (e) { mv = mv || null; }
var BoardOpsModule = null;
try { BoardOpsModule = (typeof require === 'function') ? require('../logic/board_ops') : (typeof BoardOps !== 'undefined' ? BoardOps : null); } catch (e) { BoardOpsModule = BoardOpsModule || null; }
// Shared constants (prefer canonical require, fall back to globals)
let BLACK = null, WHITE = null;
try { ({ BLACK, WHITE } = (typeof require === 'function' ? require('../../shared-constants') : (typeof SharedConstants !== 'undefined' ? SharedConstants : {}))); } catch (e) { BLACK = typeof globalThis !== 'undefined' ? globalThis.BLACK : BLACK; WHITE = typeof globalThis !== 'undefined' ? globalThis.WHITE : WHITE; }

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
    try { console.warn('[hyperactive] Presentation helper not available'); } catch (e) { }
    return false;
} 

/**
 * Process hyperactive stone moves at turn start (both players).
 * Runs AFTER bombs/dragons/breeding.
 * @async
 * @param {number} player - Current player (BLACK=1 or WHITE=-1)
 * @param {Object} [precomputedResult] - Optional pre-computed result from logic layer
 * @returns {Promise<void>}
 */
async function processHyperactiveMovesAtTurnStart(player, precomputedResult = null, precomputedEvents = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    // Prefer pipeline-produced precomputedResult; if not provided, use TurnPipelinePhases to compute turn-start effects.
    let result = precomputedResult;
    let events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (!result) {
        if (events.length === 0) {
            if (typeof TurnPipelinePhases !== 'undefined' && typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {
                TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, events);
            } else {
                console.error('[HYPERACTIVE] TurnPipelinePhases not available; cannot compute hyperactive moves safely from UI');
                return;
            }
        }

        // Collect hyperactive-related details from events
        result = {
            moved: [],
            destroyed: [],
            flipped: [],
            flippedByOwner: {}
        };

        for (const ev of events) {
            if (ev.type === 'hyperactive_moved_start' || ev.type === 'hyperactive_moved_immediate') {
                if (Array.isArray(ev.details)) result.moved.push(...ev.details);
            }
            if (ev.type === 'hyperactive_destroyed_start' || ev.type === 'hyperactive_destroyed_immediate') {
                if (Array.isArray(ev.details)) result.destroyed.push(...ev.details);
            }
            if (ev.type === 'hyperactive_flipped_start' || ev.type === 'hyperactive_flipped_immediate') {
                if (Array.isArray(ev.details)) result.flipped.push(...ev.details);
            }
            if (ev.type === 'hyperactive_flipped_start' && Array.isArray(ev.details)) {
                for (const p of ev.details) {
                    const owner = p.owner || null;
                    if (!owner) continue;
                    result.flippedByOwner[owner] = result.flippedByOwner[owner] || [];
                    result.flippedByOwner[owner].push({ row: p.row, col: p.col });
                }
            }

            if (ev.type === 'regen_triggered_start' && Array.isArray(ev.details)) {
                // Add to regen triggered
                result.regenTriggered = (result.regenTriggered || []).concat(ev.details);
            }
            if (ev.type === 'regen_capture_flipped_start' && Array.isArray(ev.details)) {
                result.regenCaptureFlips = (result.regenCaptureFlips || []).concat(ev.details);
            }
        }
    }

    const byOwner = result.flippedByOwner || {};
    const regenTriggered = result.regenTriggered || [];
    const regenCaptureFlips = result.regenCaptureFlips || [];

    if (result.moved && result.moved.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactiveMoved(result.moved.length));
    }
    if (result.destroyed && result.destroyed.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactiveDestroyed(result.destroyed.length));
    }
    if (regenTriggered.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.regenTriggered(regenTriggered.length));
    }
    if (regenCaptureFlips.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.regenCapture(regenCaptureFlips.length));
    }

    // Single Visual Writer: if PlaybackEngine is available in the browser, skip manual DOM animations here.
    // PresentationEvents already encode MOVE/CHANGE and will be consumed by PlaybackEngine.
    // Prefer canonical UI registration: check UIBootstrap registered globals first
    try {
        const uiBootstrap = require('../../ui/bootstrap');
        if (uiBootstrap && typeof uiBootstrap.getRegisteredUIGlobals === 'function') {
            const g = uiBootstrap.getRegisteredUIGlobals();
            if (g && g.PlaybackEngine && typeof g.PlaybackEngine.playPresentationEvents === 'function') {
                try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) {}
                return;
            }
        }
    } catch (e) { /* ignore */ }

    // Fallback: check globalThis PlaybackEngine (avoid using window in non-UI modules)
    try {
        const hasUiPlayback = (typeof globalThis !== 'undefined' && globalThis.PlaybackEngine && typeof globalThis.PlaybackEngine.playPresentationEvents === 'function');
        if (hasUiPlayback) { try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) {} return; }
    } catch (e) { /* ignore */ }

    // Animate using the pre-move DOM first, then sync to post-move state.
    if (result.destroyed.length > 0) {
        for (const pos of result.destroyed) {
            if (mv && typeof mv.animateFadeOutAt === 'function') {
                await mv.animateFadeOutAt(pos.row, pos.col);
            }
        }
    }
    if (result.moved.length > 0) {
        for (const m of result.moved) {
            if (mv && typeof mv.animateHyperactiveMove === 'function') {
                await mv.animateHyperactiveMove(m.from, m.to);
            }
        }
    }
    emitBoardUpdate();

    let delay = 800;
    if (typeof require === 'function') {
        try {
            const { getAnimationTiming } = require('../../constants/animation-constants');
            delay = getAnimationTiming('FLIP_ANIMATION_DURATION') || delay;
        } catch (e) { }
    } else if (typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming === 'function') {
        delay = globalThis.getAnimationTiming('FLIP_ANIMATION_DURATION') || delay;
    }

    const setDiscColorAt = (row, col, color) => {
        try {
            const vis = require('../move-executor-visuals');
            if (vis && typeof vis.setDiscColorAt === 'function') return vis.setDiscColorAt(row, col, color);
        } catch (e) { /* ignore */ }
        return undefined;
    };

    // Timers abstraction (injected by UI)
    let timers = null;
    if (typeof require === 'function') {
        try { timers = require('../timers'); } catch (e) { /* ignore */ }
    }

    const waitMs = (ms) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());

    if (result.flipped.length > 0) {
        // Stage: make flipped stones visually start from the "before flip" color.
        const regenedSet = new Set(regenTriggered.map(p => `${p.row},${p.col}`));
        for (const pos of result.flipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip staging for Regen stones

            const ownerKey = (byOwner.black || []).some(p => p.row === pos.row && p.col === pos.col) ? 'black'
                : ((byOwner.white || []).some(p => p.row === pos.row && p.col === pos.col) ? 'white' : null);
            const toColor = ownerKey === 'black' ? BLACK : (ownerKey === 'white' ? WHITE : null);
            if (toColor == null) continue;
            const fromColor = -toColor;
            setDiscColorAt(pos.row, pos.col, fromColor);
        }

        const flipCoords = result.flipped
            .filter(p => !regenedSet.has(`${p.row},${p.col}`))
            .map(p => [p.row, p.col]);
        if (flipCoords.length > 0) {
            // Emit CHANGE presentation events for each flip so UI handles flip visuals via Playback
            for (const [r, c] of flipCoords) {
                const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
            }
            await waitMs(delay);
        }

        // Finish initial flip colors
        for (const pos of result.flipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip color sync for Regen stones

            const ownerKey = (byOwner.black || []).some(p => p.row === pos.row && p.col === pos.col) ? 'black'
                : ((byOwner.white || []).some(p => p.row === pos.row && p.col === pos.col) ? 'white' : null);
            const toColor = ownerKey === 'black' ? BLACK : (ownerKey === 'white' ? WHITE : null);
            if (toColor == null) continue;
            setDiscColorAt(pos.row, pos.col, toColor);
        }

        // Regen back (Use universal cross-fade instead of flips)
        if (regenTriggered.length > 0) {
            // Ask UI to perform cross-fade via presentation events
            for (const pos of regenTriggered) {
                const ownerColor = gameState.board[pos.row][pos.col];
                emitPresentationEventViaBoardOps({ type: 'CROSSFADE_STONE', row: pos.row, col: pos.col, effectKey: 'regenStone', owner: ownerColor, newColor: ownerColor, durationMs: 600, autoFadeOut: true, fadeWholeStone: true });
            }
        }

        // Regen capture flips
        if (regenCaptureFlips.length > 0) {
            for (const pos of regenCaptureFlips) {
                const toColor = gameState.board[pos.row][pos.col];
                setDiscColorAt(pos.row, pos.col, -toColor);
            }
            const capCoords = regenCaptureFlips.map(p => [p.row, p.col]);
            if (capCoords.length > 0) {
                for (const [r, c] of capCoords) {
                    const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                    const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                    emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
                }
                await waitMs(delay);
            }
            for (const pos of regenCaptureFlips) {
                const toColor = gameState.board[pos.row][pos.col];
                setDiscColorAt(pos.row, pos.col, toColor);
            }
        }

        // Charge updates MUST be performed by the rule pipeline (TurnPipelinePhases).
        // UI must not mutate rule state directly. If pipeline has already applied charges,
        // emit a sync to update UI; otherwise log a diagnostic for triage.
        if (typeof emitCardStateChange === 'function') {
            // Refresh UI-only views; do not mutate cardState here.
            emitCardStateChange();
        } else {
            console.warn('[HYPERACTIVE] charge updates should be performed by pipeline; emitCardStateChange not available');
        }
    }

    emitBoardUpdate();
    emitGameStateChange();
}

/**
 * Placement-turn immediate activation for a newly placed hyperactive stone.
 * Runs AFTER normal flip animations, and before turn ends.
 * @param {number} player
 * @param {number} row
 * @param {number} col
 * @param {Object} [precomputedResult]
 */
async function processHyperactiveImmediateAtPlacement(player, row, col, precomputedResult = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    // Immediate activation on placement was removed by spec change (2026-01-26).
    // If precomputedResult is provided (legacy test hooks), we will still animate it; otherwise, silently no-op.
    if (!precomputedResult) {
        console.log('[HYPERACTIVE IMMEDIATE] immediate activation on placement is deprecated; skipping');
        return;
    }

    const result = precomputedResult;
    const byOwner = {};
    byOwner[playerKey] = result.flipped || [];

    const regenTriggered = result.regenTriggered || [];
    const regenCaptureFlips = result.regenCaptureFlips || [];

    if (result.moved && result.moved.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactiveMovedImmediate());
    }
    if (result.destroyed && result.destroyed.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactiveDestroyedImmediate());
    }

    // Animate using the pre-move DOM first, then sync to post-move state.
    if (result.destroyed.length > 0) {
        for (const pos of result.destroyed) {
            if (mv && typeof mv.animateFadeOutAt === 'function') {
                await mv.animateFadeOutAt(pos.row, pos.col);
            }
        }
    }
    if (result.moved.length > 0) {
        for (const m of result.moved) {
            if (mv && typeof mv.animateHyperactiveMove === 'function') {
                await mv.animateHyperactiveMove(m.from, m.to);
            }
        }
    }
    emitBoardUpdate();

    if (result.flipped.length > 0) {
        let _getAnimationTiming_hyper = null;
        if (typeof require === 'function') {
            try { ({ getAnimationTiming: _getAnimationTiming_hyper } = require('../../constants/animation-constants')); } catch (e) { /* ignore */ }
        }
        if (typeof _getAnimationTiming_hyper !== 'function' && typeof globalThis !== 'undefined' && typeof globalThis.getAnimationTiming === 'function') {
            _getAnimationTiming_hyper = globalThis.getAnimationTiming;
        }
        const delay = (typeof _getAnimationTiming_hyper === 'function' ? _getAnimationTiming_hyper('FLIP_ANIMATION_DURATION') : undefined) || 800;

        const setDiscColorAt = (r, c, color) => {
            try { const mv = require('../move-executor-visuals'); if (mv && typeof mv.setDiscColorAt === 'function') return mv.setDiscColorAt(row, col, color); } catch (e) { /* ignore in non-UI */ }
            try {
                const vis = require('../move-executor-visuals');
                if (vis && typeof vis.setDiscColorAt === 'function') return vis.setDiscColorAt(r, c, color);
            } catch (e) { /* ignore */ }
            return undefined;
        }; 


        const regenedSet = new Set(regenTriggered.map(p => `${p.row},${p.col}`));
        const toColor = player;
        const fromColor = -toColor;
        for (const pos of result.flipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip staging for Regen stones

            setDiscColorAt(pos.row, pos.col, fromColor);
        }

        const flipCoords = result.flipped
            .filter(p => !regenedSet.has(`${p.row},${p.col}`))
            .map(p => [p.row, p.col]);
        if (flipCoords.length > 0) {
            for (const [r, c] of flipCoords) {
                const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
            }
            await waitMs(delay);
        }

        for (const pos of result.flipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip color sync for Regen stones
            setDiscColorAt(pos.row, pos.col, toColor);
        }

        if (regenTriggered.length > 0) {
            // Ask UI to perform cross-fade via presentation events
            for (const pos of regenTriggered) {
                const ownerColor = gameState.board[pos.row][pos.col];
                emitPresentationEventViaBoardOps({ type: 'CROSSFADE_STONE', row: pos.row, col: pos.col, effectKey: 'regenStone', owner: ownerColor, newColor: ownerColor, durationMs: 600, autoFadeOut: true, fadeWholeStone: true });
            }
        }

        if (regenCaptureFlips.length > 0) {
            for (const pos of regenCaptureFlips) {
                const to = gameState.board[pos.row][pos.col];
                setDiscColorAt(pos.row, pos.col, -to);
            }
            const capCoords = regenCaptureFlips.map(p => [p.row, p.col]);
            if (capCoords.length > 0) {
                for (const [r, c] of capCoords) {
                    const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                    const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                    emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
                }
                await waitMs(delay);
            }
            for (const pos of regenCaptureFlips) {
                const to = gameState.board[pos.row][pos.col];
                setDiscColorAt(pos.row, pos.col, to);
            }
        }

        cardState.charge[playerKey] = Math.min(30, (cardState.charge[playerKey] || 0) + result.flipped.length);
        if (regenCaptureFlips.length > 0) {
            for (const pos of regenCaptureFlips) {
                const color = gameState.board[pos.row][pos.col];
                const key = color === BLACK ? 'black' : (color === WHITE ? 'white' : null);
                if (!key) continue;
                cardState.charge[key] = Math.min(30, (cardState.charge[key] || 0) + 1);
            }
        }
    }

    emitBoardUpdate();
    emitGameStateChange();

    // Yield to UI paint cycle if a timer implementation is available
    if (timers && typeof timers.requestFrame === 'function') {
        await timers.requestFrame();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        processHyperactiveMovesAtTurnStart,
        processHyperactiveImmediateAtPlacement
    };
}
