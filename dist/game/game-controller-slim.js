"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const CARD_TYPE_BY_ID = globalThis.CARD_DEFS.reduce((acc, c) => {
    acc[c.id] = c.type;
    return acc;
}, {});
const GameControllerSharedBoardUtils = (() => {
    try {
        return _require('../shared/shared-board-utils');
    }
    catch (e) { /* ignore */ }
    try {
        if (typeof globalThis !== 'undefined' && globalThis.SharedBoardUtils) {
            return globalThis.SharedBoardUtils;
        }
    }
    catch (e) { /* ignore */ }
    return null;
})();
function posToNotation(row, col) {
    if (GameControllerSharedBoardUtils && typeof GameControllerSharedBoardUtils.posToNotation === 'function') {
        return GameControllerSharedBoardUtils.posToNotation(row, col);
    }
    const cols = 'abcdefgh';
    return cols[col] + (row + 1);
}
function initializeGame() {
    if (typeof globalThis.createGameState === 'undefined') {
        console.error('[Game Controller] game-core-logic.js not loaded');
        return;
    }
    if (typeof globalThis.processBombs === 'undefined') {
        console.error('[Game Controller] special-effects-handler.js not loaded');
        return;
    }
    if (typeof globalThis.applyProtectionAfterMove === 'undefined') {
        console.error('[Game Controller] card-effects-applier.js not loaded');
        return;
    }
    if (typeof globalThis.cpuMaybeUseCardWithPolicy === 'undefined') {
        console.error('[Game Controller] cpu-decision.js not loaded');
        return;
    }
    if (typeof globalThis.executeMove === 'undefined') {
        console.error('[Game Controller] turn-manager.js not loaded');
        return;
    }
    console.log('[Game Controller] All modules loaded successfully');
    if (typeof globalThis.gameState === 'undefined') {
        globalThis.gameState = globalThis.createGameState();
    }
    if (typeof globalThis.CpuPolicy !== 'undefined' && typeof globalThis.CpuPolicy.loadPolicyForLevel === 'function') {
        globalThis.CpuPolicy.loadPolicyForLevel(1)
            .then((policy) => {
            globalThis.mccfrPolicy = policy;
            console.log('[Game Controller] MCCFR policy loaded');
        })
            .catch((err) => {
            console.warn('[Game Controller] Failed to load MCCFR policy:', err);
        });
    }
}
const GameControllerSlim = {
    initializeGame,
    posToNotation,
    CARD_TYPE_BY_ID
};
module.exports = GameControllerSlim;
//# sourceMappingURL=game-controller-slim.js.map