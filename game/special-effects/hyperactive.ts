/**
 * @file hyperactive.ts
 * @description Hyperactive effect handlers
 */

declare const __non_webpack_require__: NodeRequire | undefined;
declare const cardState: any;
declare const gameState: any;
declare const BoardOps: any;
declare const CardUtils: any;
declare const SharedConstants: any;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;
const LOG_MESSAGES = _require('../log-messages');
const SpecialEffectsPresentationBridge = _require('./presentation-bridge');

let BoardOpsModule: any = null;
try { BoardOpsModule = (typeof require === 'function') ? require('../logic/board_ops') : (typeof BoardOps !== 'undefined' ? BoardOps : null); } catch (e) { BoardOpsModule = BoardOpsModule || null; }
let CardUtilsModule: any = null;
try { CardUtilsModule = (typeof require === 'function') ? require('../logic/cards/utils') : (typeof CardUtils !== 'undefined' ? CardUtils : null); } catch (e) { CardUtilsModule = CardUtilsModule || null; }
let HyperactiveTurnPipelinePhasesModule: any = null;
try { HyperactiveTurnPipelinePhasesModule = (typeof require === 'function') ? require('../turn/turn_pipeline_phases') : null; } catch (e) { HyperactiveTurnPipelinePhasesModule = HyperactiveTurnPipelinePhasesModule || null; }
let HyperactiveCardLogicModule: any = null;
try { HyperactiveCardLogicModule = (typeof require === 'function') ? require('../logic/cards') : null; } catch (e) { HyperactiveCardLogicModule = HyperactiveCardLogicModule || null; }
let HyperactiveCoreModule: any = null;
try { HyperactiveCoreModule = (typeof require === 'function') ? require('../logic/core') : null; } catch (e) { HyperactiveCoreModule = HyperactiveCoreModule || null; }
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

function setUIImpl(obj: any) { SpecialEffectsPresentationBridge.setUIImpl('hyperactive', obj); }

function emitHyperactiveLog(message: any): void {
    SpecialEffectsPresentationBridge.emitLogAdded('hyperactive', message, 'effect');
}

function emitHyperactiveBoardUpdate(): void {
    SpecialEffectsPresentationBridge.emitBoardUpdate('hyperactive');
}

function emitHyperactiveGameStateChange(): void {
    SpecialEffectsPresentationBridge.emitGameStateChange('hyperactive');
}

function emitHyperactiveCardStateChange(): void {
    SpecialEffectsPresentationBridge.emitCardStateChange('hyperactive');
}

function hasPlaybackEngineForHyperactive(): boolean {
    return SpecialEffectsPresentationBridge.hasPlaybackEngine('hyperactive');
}

async function animateHyperactiveFadeOut(row: number, col: number, options?: any): Promise<any> {
    return SpecialEffectsPresentationBridge.animateFadeOutAt('hyperactive', row, col, options);
}

async function runHyperactiveMoveVisual(from: any, to: any): Promise<any> {
    return SpecialEffectsPresentationBridge.animateHyperactiveMove('hyperactive', from, to);
}

async function runHyperactiveMoveChainVisual(moves: any[]): Promise<any> {
    return SpecialEffectsPresentationBridge.animateHyperactiveMoveChain('hyperactive', moves);
}

function setHyperactiveDiscColorAt(row: number, col: number, color: number): any {
    return SpecialEffectsPresentationBridge.setDiscColorAt('hyperactive', row, col, color);
}

function getAnimationTimingForHyperactive(key: string): any {
    const injected = SpecialEffectsPresentationBridge.getAnimationTiming('hyperactive', key);
    if (typeof injected !== 'undefined') return injected;
    if (typeof require === 'function') {
        try {
            const { getAnimationTiming } = require('../../constants/animation-constants');
            if (typeof getAnimationTiming === 'function') return getAnimationTiming(key);
        } catch (e) { /* ignore */ }
    }
    return undefined;
}

function waitHyperactiveMs(ms: number): Promise<any> {
    return SpecialEffectsPresentationBridge.waitMs('hyperactive', ms);
}

function requestHyperactiveFrame(): Promise<any> {
    return SpecialEffectsPresentationBridge.requestFrame('hyperactive');
}

function emitPresentationEventViaBoardOps(ev: any) {
    return SpecialEffectsPresentationBridge.emitPresentationEvent('hyperactive', cardState, ev);
}

function readHyperactiveBoardOwner(row: number, col: number): number | null {
    return SpecialEffectsPresentationBridge.readBoardOwner(gameState, cardState, row, col);
}

function setHyperactiveDiscColorFromOwner(row: number, col: number, invert = false): boolean {
    const owner = readHyperactiveBoardOwner(row, col);
    if (owner !== BLACK && owner !== WHITE) return false;
    const color = owner as number;
    setHyperactiveDiscColorAt(row, col, invert ? -color : color);
    return true;
}

function emitHyperactiveChangeForCurrentOwner(row: number, col: number): boolean {
    const owner = readHyperactiveBoardOwner(row, col);
    if (owner !== BLACK && owner !== WHITE) return false;
    const ownerAfter = owner === BLACK ? 'black' : 'white';
    const ownerBefore = ownerAfter === 'black' ? 'white' : 'black';
    emitPresentationEventViaBoardOps({ type: 'CHANGE', row, col, ownerBefore, ownerAfter });
    return true;
}

function emitHyperactiveRegenCrossfade(row: number, col: number): boolean {
    const owner = readHyperactiveBoardOwner(row, col);
    if (owner !== BLACK && owner !== WHITE) return false;
    emitPresentationEventViaBoardOps({
        type: 'CROSSFADE_STONE',
        row,
        col,
        effectKey: 'regenStone',
        owner,
        newColor: owner,
        durationMs: 600,
        autoFadeOut: true,
        fadeWholeStone: true
    });
    return true;
}

function resolveHyperactiveTurnStartDeps() {
    const phases = HyperactiveTurnPipelinePhasesModule
        && typeof HyperactiveTurnPipelinePhasesModule.applyTurnStartPhase === 'function'
        ? HyperactiveTurnPipelinePhasesModule
        : null;
    const logic = HyperactiveCardLogicModule && typeof HyperactiveCardLogicModule === 'object'
        ? HyperactiveCardLogicModule
        : null;
    const core = HyperactiveCoreModule && typeof HyperactiveCoreModule === 'object'
        ? HyperactiveCoreModule
        : null;
    if (!phases || !logic || !core) return null;
    return { phases, logic, core };
}

/**
 * Process hyperactive stone moves at turn start (both players).
 * Runs AFTER bombs/dragons/breeding.
 */
async function processHyperactiveMovesAtTurnStart(player: number, precomputedResult: any = null, precomputedEvents: any[] | null = null) {
    const playerKey = player === BLACK ? 'black' : 'white';

    // Prefer pipeline-produced precomputedResult; otherwise consume pipeline events.
    let result = precomputedResult;
    const hasPrecomputedEventBatch = Array.isArray(precomputedEvents);
    let events = hasPrecomputedEventBatch ? precomputedEvents.slice() : [];
    if (!result) {
        if (!hasPrecomputedEventBatch) {
            console.error('[HYPERACTIVE] No precomputed pipeline events provided; skipping hyperactive presentation');
            return;
        }
        if (events.length === 0) {
            return;
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
            if (ev.type === 'hyperactive_moved_start' || ev.type === 'hyperactive_moved_immediate' || ev.type === 'zombie_moved_start') {
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
    const zombieMovedCount = (result.moved || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'ZOMBIE').length;
    const normalHyperactiveMovedCount = Math.max(0, (result.moved || []).length - escapeMovedCount - extremeMovedCount - gluttonousMovedCount - zombieMovedCount);
    const extremeDestroyedCount = (result.destroyed || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'EXTREME_HYPERACTIVE').length;
    const escapeDestroyedCount = (result.destroyed || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'ESCAPE_HYPERACTIVE').length;
    const gluttonousDestroyedCount = (result.destroyed || []).filter((d: any) => String(d && d.specialType ? d.specialType : '').toUpperCase() === 'GLUTTONOUS').length;
    const normalHyperactiveDestroyedCount = Math.max(0, (result.destroyed || []).length - escapeDestroyedCount - extremeDestroyedCount - gluttonousDestroyedCount);

    if (normalHyperactiveMovedCount > 0) {
        emitHyperactiveLog(LOG_MESSAGES.hyperactiveMoved(normalHyperactiveMovedCount));
    }
    if (extremeMovedCount > 0 && typeof LOG_MESSAGES.extremeHyperactiveMoved === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.extremeHyperactiveMoved(extremeMovedCount));
    }
    if (escapeMovedCount > 0 && typeof LOG_MESSAGES.escapeHyperactiveMoved === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.escapeHyperactiveMoved(escapeMovedCount));
    }
    if (gluttonousMovedCount > 0 && typeof LOG_MESSAGES.gluttonousMoved === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.gluttonousMoved(gluttonousMovedCount));
    }
    if (zombieMovedCount > 0 && typeof LOG_MESSAGES.zombieMoved === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.zombieMoved(zombieMovedCount));
    }
    if (normalHyperactiveDestroyedCount > 0) {
        emitHyperactiveLog(LOG_MESSAGES.hyperactiveDestroyed(normalHyperactiveDestroyedCount));
    }
    if (extremeDestroyedCount > 0 && typeof LOG_MESSAGES.extremeHyperactiveDestroyed === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.extremeHyperactiveDestroyed(extremeDestroyedCount));
    }
    if (escapeDestroyedCount > 0 && typeof LOG_MESSAGES.escapeHyperactiveDestroyed === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.escapeHyperactiveDestroyed(escapeDestroyedCount));
    }
    if (gluttonousDestroyedCount > 0 && typeof LOG_MESSAGES.gluttonousDestroyed === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.gluttonousDestroyed(gluttonousDestroyedCount));
    }
    if (result.extremeRepelled && result.extremeRepelled.length > 0 && typeof LOG_MESSAGES.extremeHyperactiveRepelled === 'function') {
        emitHyperactiveLog(LOG_MESSAGES.extremeHyperactiveRepelled(result.extremeRepelled.length));
    }
    if (result.ultimateMoved && result.ultimateMoved.length > 0) {
        emitHyperactiveLog(LOG_MESSAGES.ultimateHyperactiveMoved(result.ultimateMoved.length));
    }
    if (result.ultimateDestroyed && result.ultimateDestroyed.length > 0) {
        emitHyperactiveLog(LOG_MESSAGES.ultimateHyperactiveDestroyed(result.ultimateDestroyed.length));
    }
    if (result.ultimateFlipped && result.ultimateFlipped.length > 0) {
        emitHyperactiveLog(LOG_MESSAGES.ultimateHyperactiveFlipped(result.ultimateFlipped.length));
    }
    if (regenTriggered.length > 0) {
        emitHyperactiveLog(LOG_MESSAGES.regenTriggered(regenTriggered.length));
    }
    if (regenCaptureFlips.length > 0) {
        emitHyperactiveLog(LOG_MESSAGES.regenCapture(regenCaptureFlips.length));
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
        if (typeof SpecialEffectsPresentationBridge.readFunction('hyperactive', 'animateHyperactiveMoveChain') === 'function') {
            await runHyperactiveMoveChainVisual(allMoved);
        } else {
            for (const m of allMoved) {
                await runHyperactiveMoveVisual(m.from, m.to);
            }
        }
    }
    try { emitHyperactiveBoardUpdate(); } catch (e) { /* ignore */ }

    const delay = getAnimationTimingForHyperactive('FLIP_ANIMATION_DURATION') || 800;

    const allFlipped = (result.flipped || []).concat(result.ultimateFlipped || []);
    if (allFlipped.length > 0) {
        // Stage: make flipped stones visually start from the "before flip" color.
        const regenedSet = new Set(regenTriggered.map((p: any) => `${p.row},${p.col}`));
        for (const pos of allFlipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip staging for Regen stones

            setHyperactiveDiscColorFromOwner(pos.row, pos.col, true);
        }

        const flipCoords = allFlipped
            .filter((p: any) => !regenedSet.has(`${p.row},${p.col}`))
            .map((p: any) => [p.row, p.col]);
        if (flipCoords.length > 0) {
            // Emit CHANGE presentation events for each flip so UI handles flip visuals via Playback
            for (const [r, c] of flipCoords) {
                emitHyperactiveChangeForCurrentOwner(r, c);
            }
            await waitHyperactiveMs(delay);
        }

        // Finish initial flip colors
        for (const pos of allFlipped) {
            if (regenedSet.has(`${pos.row},${pos.col}`)) continue; // Skip color sync for Regen stones

            setHyperactiveDiscColorFromOwner(pos.row, pos.col);
        }

        // Regen back (Use universal cross-fade instead of flips)
        if (regenTriggered.length > 0) {
            // Ask UI to perform cross-fade via presentation events
            for (const pos of regenTriggered) {
                emitHyperactiveRegenCrossfade(pos.row, pos.col);
            }
        }

        // Regen capture flips
        if (regenCaptureFlips.length > 0) {
            for (const pos of regenCaptureFlips) {
                setHyperactiveDiscColorFromOwner(pos.row, pos.col, true);
            }
            const capCoords = regenCaptureFlips.map((p: any) => [p.row, p.col]);
            if (capCoords.length > 0) {
                for (const [r, c] of capCoords) {
                    emitHyperactiveChangeForCurrentOwner(r, c);
                }
                await waitHyperactiveMs(delay);
            }
            for (const pos of regenCaptureFlips) {
                setHyperactiveDiscColorFromOwner(pos.row, pos.col);
            }
        }

        // Charge updates MUST be performed by the rule pipeline (TurnPipelinePhases).
        // UI must not mutate rule state directly. If pipeline has already applied charges,
        // emit a sync to update UI; otherwise log a diagnostic for triage.
        // Refresh UI-only views; do not mutate cardState here.
        emitHyperactiveCardStateChange();
    }

    emitHyperactiveBoardUpdate();
    emitHyperactiveGameStateChange();
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
        emitHyperactiveLog(LOG_MESSAGES.hyperactiveMovedImmediate());
    }
    if (result.destroyed && result.destroyed.length > 0) {
        emitHyperactiveLog(LOG_MESSAGES.hyperactiveDestroyedImmediate());
    }

    // Animate using the pre-move DOM first, then sync to post-move state.
    if (result.destroyed.length > 0) {
        for (const pos of result.destroyed) {
            await animateHyperactiveFadeOut(pos.row, pos.col);
        }
    }
    if (result.moved.length > 0) {
        for (const m of result.moved) {
            await runHyperactiveMoveVisual(m.from, m.to);
        }
    }
    emitHyperactiveBoardUpdate();

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
                emitHyperactiveChangeForCurrentOwner(r, c);
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
                emitHyperactiveRegenCrossfade(pos.row, pos.col);
            }
        }

        if (regenCaptureFlips.length > 0) {
            for (const pos of regenCaptureFlips) {
                setHyperactiveDiscColorFromOwner(pos.row, pos.col, true);
            }
            const capCoords = regenCaptureFlips.map((p: any) => [p.row, p.col]);
            if (capCoords.length > 0) {
                for (const [r, c] of capCoords) {
                    emitHyperactiveChangeForCurrentOwner(r, c);
                }
                await waitHyperactiveMs(delay);
            }
            for (const pos of regenCaptureFlips) {
                setHyperactiveDiscColorFromOwner(pos.row, pos.col);
            }
        }

        emitHyperactiveCardStateChange();
        if (regenCaptureFlips.length > 0) {
            console.warn('[HYPERACTIVE IMMEDIATE] regen capture charge updates should be performed by pipeline');
        }
    }

    emitHyperactiveBoardUpdate();
    emitHyperactiveGameStateChange();

    await requestHyperactiveFrame();
}

export = {
    setUIImpl,
    processHyperactiveMovesAtTurnStart,
    processHyperactiveImmediateAtPlacement
};
