"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
async function processBombs(precomputedEvents = null) {
    const bombMarkers = (typeof globalThis.MarkersAdapter !== 'undefined' && globalThis.MarkersAdapter && typeof globalThis.MarkersAdapter.getBombMarkers === 'function')
        ? globalThis.MarkersAdapter.getBombMarkers(globalThis.cardState)
        : (globalThis.cardState && globalThis.cardState.markers ? globalThis.cardState.markers.filter((m) => m.kind === 'specialStone' && m.data && m.data.category === 'bomb') : []);
    if (!bombMarkers || bombMarkers.length === 0)
        return;
    const bombOwnerValByPos = new Map();
    for (const b of bombMarkers) {
        const ownerVal = b.owner === 'black' ? globalThis.BLACK : globalThis.WHITE;
        bombOwnerValByPos.set(String(b.row) + ',' + String(b.col), ownerVal);
    }
    const activeKey = (typeof globalThis.getPlayerKey === 'function') ? globalThis.getPlayerKey(globalThis.gameState.currentPlayer) : (globalThis.gameState.currentPlayer === globalThis.BLACK ? 'black' : 'white');
    const events = Array.isArray(precomputedEvents) ? precomputedEvents.slice() : [];
    if (events.length === 0) {
        if (typeof globalThis.TurnPipelinePhases !== 'undefined' && typeof globalThis.TurnPipelinePhases.applyTurnStartPhase === 'function') {
            globalThis.TurnPipelinePhases.applyTurnStartPhase(globalThis.CardLogic, globalThis.Core, globalThis.cardState, globalThis.gameState, activeKey, events);
        }
        else {
            console.error('[PROCESS-BOMBS] TurnPipelinePhases.applyTurnStartPhase not available; skipping bomb processing');
            return;
        }
    }
    const bombEvents = events.filter((e) => e.type === 'bombs_exploded');
    if (!bombEvents || bombEvents.length === 0) {
        try {
            if (typeof globalThis.emitGameStateChange === 'function')
                globalThis.emitGameStateChange();
        }
        catch (e) { /* ignore */ }
        return;
    }
    const hasPlayback = (typeof globalThis !== 'undefined' && globalThis.PlaybackEngine && typeof globalThis.PlaybackEngine.playPresentationEvents === 'function');
    const alreadyAnimated = new Set();
    for (const bombEvent of bombEvents) {
        const result = (bombEvent && bombEvent.details) ? bombEvent.details : null;
        if (!result || !result.exploded || result.exploded.length === 0)
            continue;
        for (const pos of result.exploded) {
            if (typeof globalThis.emitLogAdded === 'function')
                globalThis.emitLogAdded(globalThis.LOG_MESSAGES.bombExploded(globalThis.posToNotation(pos.row, pos.col)));
        }
        if (hasPlayback) {
            try {
                if (typeof globalThis.emitBoardUpdate === 'function')
                    globalThis.emitBoardUpdate();
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
                batch.push(globalThis.animateFadeOutAt(pos.row, pos.col, {
                    createGhost: true,
                    color: bombOwnerValByPos.get(key)
                }));
            }
            else {
                batch.push(globalThis.animateFadeOutAt(pos.row, pos.col));
            }
        }
        if (batch.length > 0)
            await Promise.all(batch);
    }
    if (!hasPlayback) {
        try {
            if (typeof globalThis.emitBoardUpdate === 'function')
                globalThis.emitBoardUpdate();
        }
        catch (e) { /* ignore */ }
        try {
            if (typeof globalThis.emitGameStateChange === 'function')
                globalThis.emitGameStateChange();
        }
        catch (e) { /* ignore */ }
    }
}
async function explodeBombUI(row, col) {
    if (typeof globalThis.emitLogAdded === 'function')
        globalThis.emitLogAdded(globalThis.LOG_MESSAGES.bombExploded(globalThis.posToNotation(row, col)));
    const hasCellAt = (targetRow, targetCol) => {
        if (targetRow >= 0 && targetRow < 8 && targetCol >= 0 && targetCol < 8)
            return true;
        const expansion = (typeof globalThis.gameState !== 'undefined' && globalThis.gameState && globalThis.gameState.boardExpansion && typeof globalThis.gameState.boardExpansion === 'object')
            ? globalThis.gameState.boardExpansion
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
    if (typeof globalThis.AnimationEngine !== 'undefined' && globalThis.AnimationEngine && typeof globalThis.AnimationEngine.play === 'function') {
        await globalThis.AnimationEngine.play([{ type: 'destroy', phase: 3, targets }]);
    }
    else {
        const tasks = targets.map((t) => globalThis.animateDestroyAt(t.r, t.col));
        await Promise.all(tasks);
    }
}
const Bombs = {
    processBombs,
    explodeBombUI
};
module.exports = Bombs;
//# sourceMappingURL=bombs.js.map