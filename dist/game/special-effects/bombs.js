"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const SharedConstants = _require('../../shared-constants');
const MarkersAdapter = _require('../logic/markers_adapter');
const TurnPipelinePhases = _require('../turn/turn_pipeline_phases');
const CardLogic = _require('../logic/cards');
const Core = _require('../logic/core');
const ControllerEvents = _require('../controller-events');
const LOG_MESSAGES = _require('../log-messages');
const { getPlayerKey } = _require('../card-effects/helpers');
const GameControllerSlim = _require('../game-controller-slim');
async function processBombs(precomputedEvents = null) {
    const bombMarkers = (typeof MarkersAdapter !== 'undefined' && MarkersAdapter && typeof MarkersAdapter.getBombMarkers === 'function')
        ? MarkersAdapter.getBombMarkers(cardState)
        : (cardState && cardState.markers ? cardState.markers.filter((m) => m.kind === 'specialStone' && m.data && m.data.category === 'bomb') : []);
    if (!bombMarkers || bombMarkers.length === 0)
        return;
    const bombOwnerValByPos = new Map();
    for (const b of bombMarkers) {
        const ownerVal = b.owner === 'black' ? SharedConstants.BLACK : SharedConstants.WHITE;
        bombOwnerValByPos.set(String(b.row) + ',' + String(b.col), ownerVal);
    }
    const activeKey = (typeof getPlayerKey === 'function') ? getPlayerKey(gameState.currentPlayer) : (gameState.currentPlayer === SharedConstants.BLACK ? 'black' : 'white');
    const events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (events.length === 0) {
        if (typeof TurnPipelinePhases !== 'undefined' && typeof TurnPipelinePhases.applyTurnStartPhase === 'function') {
            TurnPipelinePhases.applyTurnStartPhase(CardLogic, Core, cardState, gameState, activeKey, events);
        }
        else {
            console.error('[PROCESS-BOMBS] TurnPipelinePhases.applyTurnStartPhase not available; skipping bomb processing');
            return;
        }
    }
    const bombEvents = events.filter((e) => e.type === 'bombs_exploded');
    if (!bombEvents || bombEvents.length === 0) {
        try {
            if (typeof ControllerEvents.emitGameStateChange === 'function')
                ControllerEvents.emitGameStateChange();
        }
        catch (e) { /* ignore */ }
        return;
    }
    const hasPlayback = (typeof globalThis !== 'undefined' && globalThis.PlaybackEngine && typeof globalThis.PlaybackEngine.playPresentationEvents === 'function'); // globalThis — UI/bootstrap dependency, keep
    const alreadyAnimated = new Set();
    for (const bombEvent of bombEvents) {
        const result = (bombEvent && bombEvent.details) ? bombEvent.details : null;
        if (!result || !result.exploded || result.exploded.length === 0)
            continue;
        for (const pos of result.exploded) {
            if (typeof ControllerEvents.emitLogAdded === 'function')
                ControllerEvents.emitLogAdded(LOG_MESSAGES.bombExploded(GameControllerSlim.posToNotation(pos.row, pos.col)));
        }
        if (hasPlayback) {
            try {
                if (typeof ControllerEvents.emitBoardUpdate === 'function')
                    ControllerEvents.emitBoardUpdate();
            }
            catch (e) { /* ignore */ }
            continue;
        }
        const explodedKeySet = new Set((result.exploded || []).map((p) => String(p.row) + ',' + String(p.col)));
        const batch = [];
        for (const pos of (result.destroyed || [])) {
            const key = String(pos.row) + ',' + String(pos.col);
            if (alreadyAnimated.has(key))
                continue;
            alreadyAnimated.add(key);
            if (explodedKeySet.has(key)) {
                // globalThis — UI/bootstrap dependency, keep
                batch.push(globalThis.animateFadeOutAt(pos.row, pos.col, {
                    createGhost: true,
                    color: bombOwnerValByPos.get(key)
                }));
            }
            else {
                // globalThis — UI/bootstrap dependency, keep
                batch.push(globalThis.animateFadeOutAt(pos.row, pos.col)); // globalThis — UI/bootstrap dependency, keep
            }
        }
        if (batch.length > 0)
            await Promise.all(batch);
    }
    if (!hasPlayback) {
        try {
            if (typeof ControllerEvents.emitBoardUpdate === 'function')
                ControllerEvents.emitBoardUpdate();
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof ControllerEvents.emitGameStateChange === 'function')
                ControllerEvents.emitGameStateChange();
        }
        catch (e) { /* ignore */ }
    }
}
async function explodeBombUI(row, col) {
    if (typeof ControllerEvents.emitLogAdded === 'function')
        ControllerEvents.emitLogAdded(LOG_MESSAGES.bombExploded(GameControllerSlim.posToNotation(row, col)));
    const hasCellAt = (targetRow, targetCol) => {
        if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8)
            return true;
        const expansion = (typeof gameState !== 'undefined' && gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion)
            return false;
        const cells = Array.isArray(expansion.cells)
            ? expansion.cells
            : (expansion.active ? [expansion] : []);
        return cells.some((cell) => {
            if (!cell || typeof cell !== 'object')
                return false;
            const cellRow = Number(cell.row);
            const cellCol = Number.isInteger(cell.col)
                ? cell.col
                : (cell.side === 'left' ? -1 : (cell.side === 'right' ? 8 : null));
            return cellRow === targetRow && cellCol === targetCol;
        });
    };
    const targets = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (hasCellAt(r, c)) {
                targets.push({ r, col: c, after: { color: 0, special: null, timer: null } });
            }
        }
    }
    if (typeof globalThis.AnimationEngine !== 'undefined' && globalThis.AnimationEngine && typeof globalThis.AnimationEngine.play === 'function') { // globalThis — UI/bootstrap dependency, keep
        await globalThis.AnimationEngine.play([{ type: 'destroy', phase: 3, targets }]); // globalThis — UI/bootstrap dependency, keep
    }
    else {
        const tasks = targets.map((t) => globalThis.animateDestroyAt(t.r, t.col)); // globalThis — UI/bootstrap dependency, keep
        await Promise.all(tasks);
    }
}
const Bombs = {
    processBombs,
    explodeBombUI
};
module.exports = Bombs;
//# sourceMappingURL=bombs.js.map