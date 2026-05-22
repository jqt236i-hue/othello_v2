/**
 * @file hyperactive.ts
 * @description Hyperactive effect handlers
 */

declare const cardState: any;
declare const gameState: any;
declare const TurnPipelinePhases: any;
declare const CardLogic: any;
declare const Core: any;
declare const emitLogAdded: any;
declare const LOG_MESSAGES: any;
declare const emitBoardUpdate: any;
declare const emitCardStateChange: any;
declare const emitGameStateChange: any;
declare const BoardOps: any;
declare const CardUtils: any;
declare const SharedConstants: any;

let mv: any = null;
try { mv = (typeof require === 'function') ? require('../move-executor-visuals') : mv; } catch (e) { mv = mv || null; }
let BoardOpsModule: any = null;
try { BoardOpsModule = (typeof require === 'function') ? require('../logic/board_ops') : (typeof BoardOps !== 'undefined' ? BoardOps : null); } catch (e) { BoardOpsModule = BoardOpsModule || null; }
let CardUtilsModule: any = null;
try { CardUtilsModule = (typeof require === 'function') ? require('../logic/cards/utils') : (typeof CardUtils !== 'undefined' ? CardUtils : null); } catch (e) { CardUtilsModule = CardUtilsModule || null; }
// Shared constants (prefer canonical require, fall back to globals)
let BLACK: any = null, WHITE: any = null, CHARGE_MAX = 99;
try {
    ({ BLACK, WHITE, CHARGE_MAX } = (typeof require === 'function' ? require('../../shared-constants') : (typeof SharedConstants !== 'undefined' ? SharedConstants : {})));
} catch (e) {
    try {
        const constants = (typeof SharedConstants !== 'undefined' && SharedConstants) ? SharedConstants : {};
        BLACK = Number.isFinite(Number(constants.BLACK)) ? constants.BLACK : BLACK;
        WHITE = Number.isFinite(Number(constants.WHITE)) ? constants.WHITE : WHITE;
        CHARGE_MAX = Number.isFinite(Number(constants.CHARGE_MAX)) ? Number(constants.CHARGE_MAX) : CHARGE_MAX;
    } catch (_e) { /* ignore */ }
}

let __uiImpl_hyperactive: any = {};
function setUIImpl(obj: any) { __uiImpl_hyperactive = obj || {}; }

function hasPlaybackEngineForHyperactive(): boolean {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.hasPlaybackEngine === 'function') {
        return __uiImpl_hyperactive.hasPlaybackEngine() === true;
    }
    return !!(mv && typeof mv.hasPlaybackEngine === 'function' && mv.hasPlaybackEngine());
}

async function animateHyperactiveFadeOut(row: number, col: number, options?: any): Promise<any> {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.animateFadeOutAt === 'function') {
        return __uiImpl_hyperactive.animateFadeOutAt(row, col, options);
    }
    return mv && typeof mv.animateFadeOutAt === 'function'
        ? mv.animateFadeOutAt(row, col, options)
        : undefined;
}

async function animateHyperactiveMove(from: any, to: any): Promise<any> {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.animateHyperactiveMove === 'function') {
        return __uiImpl_hyperactive.animateHyperactiveMove(from, to);
    }
    return mv && typeof mv.animateHyperactiveMove === 'function'
        ? mv.animateHyperactiveMove(from, to)
        : undefined;
}

async function animateHyperactiveMoveChain(moves: any[]): Promise<any> {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.animateHyperactiveMoveChain === 'function') {
        return __uiImpl_hyperactive.animateHyperactiveMoveChain(moves);
    }
    return mv && typeof mv.animateHyperactiveMoveChain === 'function'
        ? mv.animateHyperactiveMoveChain(moves)
        : undefined;
}

function setHyperactiveDiscColorAt(row: number, col: number, color: number): any {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.setDiscColorAt === 'function') {
        return __uiImpl_hyperactive.setDiscColorAt(row, col, color);
    }
    try {
        const vis = require('../move-executor-visuals');
        if (vis && typeof vis.setDiscColorAt === 'function') return vis.setDiscColorAt(row, col, color);
    } catch (e) { /* ignore */ }
    return undefined;
}

function getAnimationTimingForHyperactive(key: string): any {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.getAnimationTiming === 'function') {
        return __uiImpl_hyperactive.getAnimationTiming(key);
    }
    if (typeof require === 'function') {
        try {
            const { getAnimationTiming } = require('../../constants/animation-constants');
            if (typeof getAnimationTiming === 'function') return getAnimationTiming(key);
        } catch (e) { /* ignore */ }
    }
    return undefined;
}

function waitHyperactiveMs(ms: number): Promise<any> {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.waitMs === 'function') {
        return __uiImpl_hyperactive.waitMs(ms);
    }
    let timers: any = null;
    if (typeof require === 'function') {
        try { timers = require('../timers'); } catch (e) { /* ignore */ }
    }
    return timers && typeof timers.waitMs === 'function' ? timers.waitMs(ms) : Promise.resolve();
}

function requestHyperactiveFrame(): Promise<any> {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.requestFrame === 'function') {
        return __uiImpl_hyperactive.requestFrame();
    }
    let timers: any = null;
    if (typeof require === 'function') {
        try { timers = require('../timers'); } catch (e) { /* ignore */ }
    }
    return timers && typeof timers.requestFrame === 'function' ? timers.requestFrame() : Promise.resolve();
}

function emitPresentationEventViaBoardOps(ev: any) {
    if (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.emitPresentationEvent === 'function') {
        return __uiImpl_hyperactive.emitPresentationEvent(ev);
    }
    try {
        const pres = (typeof require === 'function') ? require('../logic/presentation') : null;
        if (pres && typeof pres.emitPresentationEvent === 'function') return pres.emitPresentationEvent(cardState, ev);
    } catch (e) { /* ignore */ }
    try { console.warn('[hyperactive] Presentation helper not available'); } catch (e) { }
    return false;
}

/**
 * Process hyperactive stone moves at turn start (both players).
 * Runs AFTER bombs/dragons/breeding.
 */
async function processHyperactiveMovesAtTurnStart(player: number, precomputedResult: any = null, precomputedEvents: any[] | null = null) {
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
            moved: [] as any[],
            destroyed: [] as any[],
            flipped: [] as any[],
            extremeRepelled: [] as any[],
            ultimateMoved: [] as any[],
            ultimateDestroyed: [] as any[],
            ultimateFlipped: [] as any[]
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
            if (ev.type === 'extreme_hyperactive_repelled_start' || ev.type === 'extreme_hyperactive_repelled_immediate') {
                if (Array.isArray(ev.details)) result.extremeRepelled.push(...ev.details);
            }
            if (ev.type === 'ultimate_hyperactive_moved_start' || ev.type === 'ultimate_hyperactive_moved_immediate') {
                if (Array.isArray(ev.details)) result.ultimateMoved.push(...ev.details);
            }
            if (ev.type === 'ultimate_hyperactive_destroyed_start' || ev.type === 'ultimate_hyperactive_destroyed_immediate') {
                if (Array.isArray(ev.details)) result.ultimateDestroyed.push(...ev.details);
            }
            if (ev.type === 'ultimate_hyperactive_flipped_start' || ev.type === 'ultimate_hyperactive_flipped_immediate') {
                if (Array.isArray(ev.details)) result.ultimateFlipped.push(...ev.details);
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

    const regenTriggered = result.regenTriggered || [];
    const regenCaptureFlips = result.regenCaptureFlips || [];

    const extremeMovedCount = (result.moved || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'EXTREME_HYPERACTIVE').length;
    const escapeMovedCount = (result.moved || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'ESCAPE_HYPERACTIVE').length;
    const gluttonousMovedCount = (result.moved || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'GLUTTONOUS').length;
    const normalHyperactiveMovedCount = Math.max(0, (result.moved || []).length - escapeMovedCount - extremeMovedCount - gluttonousMovedCount);
    const extremeDestroyedCount = (result.destroyed || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'EXTREME_HYPERACTIVE').length;
    const escapeDestroyedCount = (result.destroyed || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'ESCAPE_HYPERACTIVE').length;
    const gluttonousDestroyedCount = (result.destroyed || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'GLUTTONOUS').length;
    const normalHyperactiveDestroyedCount = Math.max(0, (result.destroyed || []).length - escapeDestroyedCount - extremeDestroyedCount - gluttonousDestroyedCount);

    if (normalHyperactiveMovedCount > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactiveMoved(normalHyperactiveMovedCount));
    }
    if (extremeMovedCount > 0 && typeof LOG_MESSAGES.extremeHyperactiveMoved === 'function') {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.extremeHyperactiveMoved(extremeMovedCount));
    }
    if (escapeMovedCount > 0 && typeof LOG_MESSAGES.escapeHyperactiveMoved === 'function') {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.escapeHyperactiveMoved(escapeMovedCount));
    }
    if (gluttonousMovedCount > 0 && typeof LOG_MESSAGES.gluttonousMoved === 'function') {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.gluttonousMoved(gluttonousMovedCount));
    }
    if (normalHyperactiveDestroyedCount > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.hyperactiveDestroyed(normalHyperactiveDestroyedCount));
    }
    if (extremeDestroyedCount > 0 && typeof LOG_MESSAGES.extremeHyperactiveDestroyed === 'function') {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.extremeHyperactiveDestroyed(extremeDestroyedCount));
    }
    if (escapeDestroyedCount > 0 && typeof LOG_MESSAGES.escapeHyperactiveDestroyed === 'function') {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.escapeHyperactiveDestroyed(escapeDestroyedCount));
    }
    if (gluttonousDestroyedCount > 0 && typeof LOG_MESSAGES.gluttonousDestroyed === 'function') {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.gluttonousDestroyed(gluttonousDestroyedCount));
    }
    if (result.extremeRepelled && result.extremeRepelled.length > 0 && typeof LOG_MESSAGES.extremeHyperactiveRepelled === 'function') {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.extremeHyperactiveRepelled(result.extremeRepelled.length));
    }
    if (result.ultimateMoved && result.ultimateMoved.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.ultimateHyperactiveMoved(result.ultimateMoved.length));
    }
    if (result.ultimateDestroyed && result.ultimateDestroyed.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.ultimateHyperactiveDestroyed(result.ultimateDestroyed.length));
    }
    if (result.ultimateFlipped && result.ultimateFlipped.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.ultimateHyperactiveFlipped(result.ultimateFlipped.length));
    }
    if (regenTriggered.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.regenTriggered(regenTriggered.length));
    }
    if (regenCaptureFlips.length > 0) {
        if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.regenCapture(regenCaptureFlips.length));
    }

    // Single Visual Writer: if PlaybackEngine is available in the browser, skip manual DOM animations here.
    // PresentationEvents already encode MOVE/CHANGE and will be consumed by PlaybackEngine.
    // Prefer canonical UI registration via injected globals/shared shim without importing ui/ from game/.
    if (hasPlaybackEngineForHyperactive()) return;

    // Animate using the pre-move DOM first, then sync to post-move state.
    const allDestroyed = (result.destroyed || []).concat(result.ultimateDestroyed || []);
    if (allDestroyed.length > 0) {
        for (const pos of allDestroyed) {
            await animateHyperactiveFadeOut(pos.row, pos.col);
        }
    }
    const allMoved = (result.moved || [])
        .concat(result.ultimateMoved || []);
    if (allMoved.length > 0) {
        if (
            (__uiImpl_hyperactive && typeof __uiImpl_hyperactive.animateHyperactiveMoveChain === 'function') ||
            (mv && typeof mv.animateHyperactiveMoveChain === 'function')
        ) {
            await animateHyperactiveMoveChain(allMoved);
        } else {
            for (const m of allMoved) {
                await animateHyperactiveMove(m.from, m.to);
            }
        }
    }
    try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }

    const delay = getAnimationTimingForHyperactive('FLIP_ANIMATION_DURATION') || 800;

    const allFlipped = (result.flipped || []).concat(result.ultimateFlipped || []);
    if (allFlipped.length > 0) {
        // Stage: make flipped stones visually start from the "before flip" color.
        const regenedSet = new Set(regenTriggered.map((p: any) => `${p.row},${p.col}`));
        for (const pos of allFlipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip staging for Regen stones

            const toColor = gameState.board[pos.row][pos.col];
            if (toColor !== BLACK && toColor !== WHITE) continue;
            const fromColor = -toColor;
            setHyperactiveDiscColorAt(pos.row, pos.col, fromColor);
        }

        const flipCoords = allFlipped
            .filter((p: any) => !regenedSet.has(`${p.row},${p.col}`))
            .map((p: any) => [p.row, p.col]);
        if (flipCoords.length > 0) {
            // Emit CHANGE presentation events for each flip so UI handles flip visuals via Playback
            for (const [r, c] of flipCoords) {
                const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
            }
            await waitHyperactiveMs(delay);
        }

        // Finish initial flip colors
        for (const pos of allFlipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip color sync for Regen stones

            const toColor = gameState.board[pos.row][pos.col];
            if (toColor !== BLACK && toColor !== WHITE) continue;
            setHyperactiveDiscColorAt(pos.row, pos.col, toColor);
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
                setHyperactiveDiscColorAt(pos.row, pos.col, -toColor);
            }
            const capCoords = regenCaptureFlips.map((p: any) => [p.row, p.col]);
            if (capCoords.length > 0) {
                for (const [r, c] of capCoords) {
                    const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                    const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                    emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
                }
                await waitHyperactiveMs(delay);
            }
            for (const pos of regenCaptureFlips) {
                const toColor = gameState.board[pos.row][pos.col];
                setHyperactiveDiscColorAt(pos.row, pos.col, toColor);
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
 */
async function processHyperactiveImmediateAtPlacement(player: number, row: number, col: number, precomputedResult: any = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    // Immediate activation on placement was removed by spec change (2026-01-26).
    // If precomputedResult is provided (legacy test hooks), we will still animate it; otherwise, silently no-op.
    if (!precomputedResult) {
        console.log('[HYPERACTIVE IMMEDIATE] immediate activation on placement is deprecated; skipping');
        return;
    }

    const result = precomputedResult;
    const byOwner: any = {};
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
            await animateHyperactiveFadeOut(pos.row, pos.col);
        }
    }
    if (result.moved.length > 0) {
        for (const m of result.moved) {
            await animateHyperactiveMove(m.from, m.to);
        }
    }
    emitBoardUpdate();

    if (result.flipped.length > 0) {
        const delay = getAnimationTimingForHyperactive('FLIP_ANIMATION_DURATION') || 800;

        const regenedSet = new Set(regenTriggered.map((p: any) => `${p.row},${p.col}`));
        const toColor = player;
        const fromColor = -toColor;
        for (const pos of result.flipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip staging for Regen stones

            setHyperactiveDiscColorAt(pos.row, pos.col, fromColor);
        }

        const flipCoords = result.flipped
            .filter((p: any) => !regenedSet.has(`${p.row},${p.col}`))
            .map((p: any) => [p.row, p.col]);
        if (flipCoords.length > 0) {
            for (const [r, c] of flipCoords) {
                const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
            }
            await waitHyperactiveMs(delay);
        }

        for (const pos of result.flipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip color sync for Regen stones
            setHyperactiveDiscColorAt(pos.row, pos.col, toColor);
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
                setHyperactiveDiscColorAt(pos.row, pos.col, -to);
            }
            const capCoords = regenCaptureFlips.map((p: any) => [p.row, p.col]);
            if (capCoords.length > 0) {
                for (const [r, c] of capCoords) {
                    const ownerAfter = (gameState.board[r][c] === BLACK) ? 'black' : 'white';
                    const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
                    emitPresentationEventViaBoardOps({ type: 'CHANGE', row: r, col: c, ownerBefore, ownerAfter });
                }
                await waitHyperactiveMs(delay);
            }
            for (const pos of regenCaptureFlips) {
                const to = gameState.board[pos.row][pos.col];
                setHyperactiveDiscColorAt(pos.row, pos.col, to);
            }
        }

        if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
            CardUtilsModule.addChargeWithDelta(cardState, playerKey, result.flipped.length, 'hyperactive_immediate_flip');
        } else {
            cardState.charge[playerKey] = Math.min(CHARGE_MAX || 99, (cardState.charge[playerKey] || 0) + result.flipped.length);
        }
        if (regenCaptureFlips.length > 0) {
            for (const pos of regenCaptureFlips) {
                const color = gameState.board[pos.row][pos.col];
                const key = color === BLACK ? 'black' : (color === WHITE ? 'white' : null);
                if (!key) continue;
                if (CardUtilsModule && typeof CardUtilsModule.addChargeWithDelta === 'function') {
                    CardUtilsModule.addChargeWithDelta(cardState, key, 1, 'regen_capture_flip');
                } else {
                    cardState.charge[key] = Math.min(CHARGE_MAX || 99, (cardState.charge[key] || 0) + 1);
                }
            }
        }
    }

    emitBoardUpdate();
    emitGameStateChange();

    await requestHyperactiveFrame();
}

export = {
    setUIImpl,
    processHyperactiveMovesAtTurnStart,
    processHyperactiveImmediateAtPlacement
};
