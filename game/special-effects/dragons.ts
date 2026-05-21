/**
 * @file dragons.ts
 * @description Ultimate Reverse Dragon effect handlers
 */

declare const cardState: any;
declare const gameState: any;
declare const BLACK: number;
declare const WHITE: number;
declare const MarkersAdapter: any;
declare const TurnPipelinePhases: any;
declare const CardLogic: any;
declare const Core: any;
declare const emitBoardUpdate: any;
declare const emitCardStateChange: any;
declare const emitLogAdded: any;
declare const emitGameStateChange: any;
declare const getPlayerName: any;
declare const LOG_MESSAGES: any;
declare const FLIP_ANIMATION_DURATION_MS: any;
declare const globalThis: any;
declare const BoardOps: any;
declare const CardUtils: any;

let mv: any = null;
try { mv = (typeof require === 'function') ? require('../move-executor-visuals') : mv; } catch (e) { mv = mv || null; }
// Timers abstraction (injected by UI)
let timers: any = null;
try { timers = (typeof require === 'function') ? require('../timers') : timers; } catch (e) { timers = timers || null; }
const waitMs = (ms: number) => (timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve());
let BoardOpsModule: any = null;
try { BoardOpsModule = (typeof require === 'function') ? require('../logic/board_ops') : (typeof BoardOps !== 'undefined' ? BoardOps : null); } catch (e) { BoardOpsModule = BoardOpsModule || null; }
let CardUtilsModule: any = null;
try { CardUtilsModule = (typeof require === 'function') ? require('../logic/cards/utils') : (typeof CardUtils !== 'undefined' ? CardUtils : null); } catch (e) { CardUtilsModule = CardUtilsModule || null; }
let CHARGE_MAX = 99;
try {
    const shared = (typeof require === 'function')
        ? require('../../shared-constants')
        : (typeof SharedConstants !== 'undefined' ? SharedConstants : null);
    if (shared && Number.isFinite(Number(shared.CHARGE_MAX))) CHARGE_MAX = Number(shared.CHARGE_MAX);
} catch (e) {
    if (typeof globalThis !== 'undefined' && Number.isFinite(Number(globalThis.CHARGE_MAX))) {
        CHARGE_MAX = Number(globalThis.CHARGE_MAX);
    }
}
let __uiImpl_dragons: any = {};
function setUIImpl(obj: any) { __uiImpl_dragons = obj || {}; }

function hasPlaybackEngineForDragons(): boolean {
    return typeof __uiImpl_dragons.playPresentationEvents === 'function';
}

function getAnimationTimingForDragons(key: string): number | undefined {
    if (__uiImpl_dragons && typeof __uiImpl_dragons.getAnimationTiming === 'function') {
        try { return __uiImpl_dragons.getAnimationTiming(key); } catch (e) { /* ignore */ }
    }
    return undefined;
}

function setDiscColorForDragons(row: number, col: number, color: number): any {
    if (__uiImpl_dragons && typeof __uiImpl_dragons.setDiscColorAt === 'function') {
        return __uiImpl_dragons.setDiscColorAt(row, col, color);
    }
    if (mv && typeof mv.setDiscColorAt === 'function') return mv.setDiscColorAt(row, col, color);
    return undefined;
}

function removeBombOverlayForDragons(row: number, col: number): any {
    if (__uiImpl_dragons && typeof __uiImpl_dragons.removeBombOverlayAt === 'function') {
        return __uiImpl_dragons.removeBombOverlayAt(row, col);
    }
    if (mv && typeof mv.removeBombOverlayAt === 'function') return mv.removeBombOverlayAt(row, col);
    return undefined;
}

async function removeRegenOverlayForDragons(row: number, col: number): Promise<any> {
    if (__uiImpl_dragons && typeof __uiImpl_dragons.removeRegenOverlayAt === 'function') {
        return __uiImpl_dragons.removeRegenOverlayAt(row, col);
    }
    return undefined;
}

async function animateDragonFadeOut(row: number, col: number, options: any): Promise<any> {
    if (__uiImpl_dragons && typeof __uiImpl_dragons.animateFadeOutAt === 'function') {
        return __uiImpl_dragons.animateFadeOutAt(row, col, options);
    }
    if (mv && typeof mv.animateFadeOutAt === 'function') return mv.animateFadeOutAt(row, col, options);
    return undefined;
}

function emitPresentationEventViaBoardOps(ev: any) {
    if (__uiImpl_dragons && typeof __uiImpl_dragons.emitPresentationEvent === 'function') {
        try { return __uiImpl_dragons.emitPresentationEvent(ev); } catch (e) { /* ignore */ }
    }
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : null;
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    try { console.warn('[dragons] Presentation helper not available'); } catch (e) { }
    return false;
}

/**
 * Process ultimate reverse dragons: convert surrounding enemy stones
 * @param player - Current player (BLACK=1 or WHITE=-1)
 */
async function processUltimateReverseDragonsAtTurnStart(player: number, precomputedEvents: any[] | null = null) {
    // Get dragons from unified specialStones
    const dragons = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getSpecialMarkers === 'function')
        ? MarkersAdapter.getSpecialMarkers(cardState).filter((m: any) => m.data && m.data.type === 'DRAGON')
        : (cardState && cardState.markers ? cardState.markers.filter((m: any) => m.kind === 'specialStone' && m.data && m.data.type === 'DRAGON') : []);
    if (dragons.length === 0) return;

    const playerKey = player === BLACK ? 'black' : 'white';

    // Prefer pipeline-produced computation. Use TurnPipelinePhases to perform turn-start processing which includes dragon effects.
    let result: any = null;
    let regenRes = { regened: [] as any[], captureFlips: [] as any[] };
    const events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (!events.length) {
        if (typeof TurnPipelinePhases !== 'undefined' && typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {
            TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, playerKey, events);
        }
    }
    if (events.length) {

        // Build result shape from events
        result = { converted: [] as any[], destroyed: [] as any[], anchors: [] as any[] };

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
            try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
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

    const hasUiPlayback = hasPlaybackEngineForDragons();
    if (hasUiPlayback) {
        // Keep regen cross-fade requests, but avoid legacy DOM animation path during active playback.
        if (regenRes.regened && regenRes.regened.length) {
            for (const pos of regenRes.regened) {
                const ownerColor = gameState.board[pos.row][pos.col];
                emitPresentationEventViaBoardOps({
                    type: 'CROSSFADE_STONE',
                    row: pos.row,
                    col: pos.col,
                    effectKey: 'regenStone',
                    owner: ownerColor,
                    newColor: ownerColor,
                    durationMs: 600,
                    autoFadeOut: true,
                    fadeWholeStone: true
                });
            }
        }
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
        return;
    }

    let delay = 800;
    const injectedDelay = getAnimationTimingForDragons('FLIP_ANIMATION_DURATION');
    if (injectedDelay) {
        delay = injectedDelay;
    } else if (typeof require === 'function') {
        try {
            const { getAnimationTiming } = require('../../constants/animation-constants');
            delay = getAnimationTiming('FLIP_ANIMATION_DURATION') || delay;
        } catch (e) { /* ignore */ }
    }

    if (result.converted.length > 0) {
        // IMPORTANT:
        // Do NOT re-render the board here.
        // When a dragon expires on the same tick it converts stones, CardLogic has already
        // set the anchor cell to EMPTY. A re-render would remove the anchor disc before
        // we can run the fade-out animation, making it "instantly disappear" sometimes.
        // We only need manual visual tweaks because converted targets already have discs.

        const regenedSet = new Set((regenRes.regened || []).map((p: any) => `${p.row},${p.col}`));
        const hasAnchors = Array.isArray(result.anchors) && result.anchors.length > 0;
        const allAnchorsFinal = hasAnchors && result.anchors.every((a: any) => a.remainingNow === 0);
        const showSplitAnimation = !allAnchorsFinal; // skip the artificial delay on the final-expiry activation

        // Ensure converted stones visually become the new color immediately.
        const initialColor = showSplitAnimation ? -player : player;
        for (const pos of result.converted) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip visual change for Regen stones

            // Bombs become normal stones when flipped, so remove bomb visuals immediately.
            removeBombOverlayForDragons(pos.row, pos.col);
            setDiscColorForDragons(pos.row, pos.col, initialColor);
        }

        // Flip suppression is handled by applyFlipAnimations below for consistency.
        // (No per-disc class toggles here.)

        // Emit CHANGE presentation events for converted flips so UI handles flip visuals via Playback
        const flipCoords = result.converted
            .filter((p: any) => !regenedSet.has(`${p.row},${p.col}`))
            .map((p: any) => [p.row, p.col]);
        if (flipCoords.length > 0 && showSplitAnimation) {
            await waitMs(delay);
            for (const pos of result.converted) {
                if (regenedSet.has(`${pos.row},${pos.col}`)) continue;
                setDiscColorForDragons(pos.row, pos.col, player);
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
                    setDiscColorForDragons(pos.row, pos.col, -player);
                }
                await waitMs(delay);
                for (const pos of regenRes.captureFlips) {
                    setDiscColorForDragons(pos.row, pos.col, player);
                }
            } else {
                for (const pos of regenRes.captureFlips) {
                    setDiscColorForDragons(pos.row, pos.col, player);
                }
            }
        }
    }

    // Animate destroyed anchors (fade-out) after conversions
    for (const pos of result.destroyed) {
        await animateDragonFadeOut(pos.row, pos.col, { createGhost: true, color: player, effectKey: 'ultimateDragon' });
    }

    // Final UI sync after all animations
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
    try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e) { /* ignore */ }
}

/**
 * Placement-turn immediate activation for a newly placed dragon anchor.
 * Runs AFTER normal flip animations, and before turn ends.
 */
async function processUltimateReverseDragonImmediateAtPlacement(player: number, row: number, col: number, precomputedResult: any = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    // Prefer precomputed result (from pipeline); otherwise abort to avoid UI-side logic writes
    let result = precomputedResult;
    let regenRes = { regened: [] as any[], captureFlips: [] as any[] };
    if (!result) {
        console.error('[DRAGON IMMEDIATE] No precomputed pipeline result provided; cannot compute dragon immediate effects from UI');
        return;
    }

    // If pipeline augmented result with regen info, use it
    regenRes = result.regen || result.regenRes || regenRes;

    if (result.converted && result.converted.length > 0) {
        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
            CardUtilsModule.addChargeWithDelta(cardState, playerKey, result.converted.length, 'dragon_immediate_convert');
        } else {
            cardState.charge[playerKey] = Math.min(CHARGE_MAX, cardState.charge[playerKey] + result.converted.length);
        }
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.dragonConvertedImmediate(getPlayerName(player), result.converted.length));
    }

    const delay = getAnimationTimingForDragons('FLIP_ANIMATION_DURATION')
        || (typeof FLIP_ANIMATION_DURATION_MS !== 'undefined' ? FLIP_ANIMATION_DURATION_MS : 800);
    if (result.converted.length > 0) {
        emitBoardUpdate();

        const regenedSet = new Set((regenRes.regened || []).map((p: any) => `${p.row},${p.col}`));

        const ownerColor = player === BLACK ? BLACK : WHITE;
        const fromColor = -ownerColor;

        // Prepare converted stones to show the pre-flip color
        for (const pos of result.converted) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) {
                // Ensure regen overlay is removed so icon doesn't interfere with flip
                await removeRegenOverlayForDragons(pos.row, pos.col);
            }
            setDiscColorForDragons(pos.row, pos.col, fromColor);
        }

        const flipCoords = result.converted
            .filter((p: any) => !regenedSet.has(`${p.row},${p.col}`))
            .map((p: any) => [p.row, p.col]);
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
            setDiscColorForDragons(pos.row, pos.col, ownerColor);
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
            const capCoords = regenRes.captureFlips.map((p: any) => [p.row, p.col]);
            for (const pos of regenRes.captureFlips) {
                setDiscColorForDragons(pos.row, pos.col, -ownerColor);
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

export = {
    setUIImpl,
    processUltimateReverseDragonsAtTurnStart,
    processUltimateReverseDragonImmediateAtPlacement
};
