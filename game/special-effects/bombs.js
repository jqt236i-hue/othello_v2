/**
 * @file bombs.js
 * @description Bomb handling (tick + explosion UI)
 */

/**
 * Process all bombs: decrement turn counters and explode those that reach 0
 * @async
 * @returns {Promise<void>}
 */
async function processBombs(precomputedEvents = null) {
    const bombMarkers = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function')
        ? MarkersAdapter.getBombMarkers(cardState)
        : (cardState && cardState.markers ? cardState.markers.filter(m => m.kind === 'bomb') : []);
    if (!bombMarkers || bombMarkers.length === 0) return;

    // Snapshot bomb owners BEFORE ticking, because tickBombs removes exploded bombs from cardState.bombs.
    const bombOwnerValByPos = new Map();
    for (const b of bombMarkers) {
        const ownerVal = b.owner === 'black' ? BLACK : WHITE;
        bombOwnerValByPos.set(`${b.row},${b.col}`, ownerVal);
    }

    // Use pipeline-produced events if provided, otherwise compute them here
    const activeKey = (typeof getPlayerKey === 'function') ? getPlayerKey(gameState.currentPlayer) : (gameState.currentPlayer === BLACK ? 'black' : 'white');
    const events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (events.length === 0) {
        if (typeof TurnPipelinePhases !== 'undefined' && typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {
            TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, activeKey, events);
        } else {
            console.error('[PROCESS-BOMBS] TurnPipelinePhases.applyTurnStartPhase not available; skipping bomb processing');
            return;
        }
    }

    // Look for all bombs_exploded events produced by the pipeline; process them in order
    const bombEvents = events.filter(e => e.type === 'bombs_exploded');
    if (!bombEvents || bombEvents.length === 0) {
        // Nothing exploded but counters may have changed; emit status update
        try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e) { /* ignore */ }
        return;
    }

    const hasPlayback = (typeof globalThis !== 'undefined' && globalThis.PlaybackEngine && typeof globalThis.PlaybackEngine.playPresentationEvents === 'function');

    const alreadyAnimated = new Set();

    for (const bombEvent of bombEvents) {
        const result = (bombEvent && bombEvent.details) ? bombEvent.details : null;
        if (!result || !result.exploded || result.exploded.length === 0) continue;

        // Log explosions for this event
        for (const pos of result.exploded) {
            if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.bombExploded(posToNotation(pos.row, pos.col)));
        }

        if (hasPlayback) {
            // PlaybackEngine will handle destroy visuals; ensure UI consumes presentation events.
            try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }
            continue;
        }

        // Fallback path: animate all destroyed stones in one batch to match simultaneous destroy visuals.
        const explodedKeySet = new Set((result.exploded || []).map(p => `${p.row},${p.col}`));
        const batch = [];
        for (const pos of (result.destroyed || [])) {
            const key = `${pos.row},${pos.col}`;
            if (alreadyAnimated.has(key)) continue;
            alreadyAnimated.add(key);

            if (explodedKeySet.has(key)) {
                batch.push(animateFadeOutAt(pos.row, pos.col, {
                    createGhost: true,
                    color: bombOwnerValByPos.get(key)
                }));
            } else {
                batch.push(animateFadeOutAt(pos.row, pos.col));
            }
        }
        if (batch.length > 0) await Promise.all(batch);
    }

    if (!hasPlayback) {
        // Update board display after animations
        try { if (typeof emitBoardUpdate === 'function') emitBoardUpdate(); } catch (e) { /* ignore */ }

        // Always update status
        try { if (typeof emitGameStateChange === 'function') emitGameStateChange(); } catch (e) { /* ignore */ }
    }
}

/**
 * Handle UI for bomb explosion
 * @param {number} row
 * @param {number} col
 */
async function explodeBombUI(row, col) {
    if (typeof emitLogAdded === 'function') emitLogAdded(LOG_MESSAGES.bombExploded(posToNotation(row, col)));

    // Animate 3x3 destruction using canonical presentation path when available
    // Note: Logical stones are already removed by CardLogic, but UI is stale so we can animate
    const targets = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < 8 && c >= 0 && c < 8) {
                // Build a destroy target payload so AnimationEngine can handle fade-out
                targets.push({ r, col: c, after: { color: 0, special: null, timer: null } });
            }
        }
    }

    if (typeof AnimationEngine !== 'undefined' && AnimationEngine && typeof AnimationEngine.play === 'function') {
        // Use the AnimationEngine to ensure playback locking and consistent fade-out visuals
        await AnimationEngine.play([{ type: 'destroy', phase: 3, targets }]);
    } else {
        // Fallback to legacy per-cell destroy animation
        const tasks = targets.map(t => animateDestroyAt(t.r, t.col));
        await Promise.all(tasks);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { processBombs, explodeBombUI };
}
