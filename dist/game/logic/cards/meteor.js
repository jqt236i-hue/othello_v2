"use strict";
/**
 * @file meteor.ts
 * @description Meteor helpers (Shared between Browser and Headless)
 */
function _require(id) {
    if (typeof __non_webpack_require__ !== 'undefined') {
        return __non_webpack_require__(id);
    }
    if (typeof require === 'function') {
        return require(id);
    }
    throw new Error('Unable to require ' + id);
}
const SharedConstants = (typeof module === 'object' && module.exports)
    ? _require('../../../shared-constants')
    : (typeof self !== 'undefined' ? self.SharedConstants : undefined);
const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
    ? Number(SharedConstants.EMPTY)
    : 0;
function applyMeteorWill(cardState, gameState, playerKey, row, col, deps = {}) {
    const cs = cardState;
    const pending = cs && cs.pendingEffectByPlayer ? cs.pendingEffectByPlayer[playerKey] : null;
    if (!pending || pending.type !== 'METEOR_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const getMeteorTargets = deps.getMeteorTargets || (() => []);
    const getCellValueForCard = deps.getCellValueForCard || (() => null);
    const destroyAt = deps.destroyAt || null;
    const isDestroyResolved = deps.isDestroyResolved || ((result) => !!(result && (result.destroyed || result.livingWillRevived)));
    const clearStoneIdAtForCard = deps.clearStoneIdAtForCard || (() => { });
    const setCellValueForCard = deps.setCellValueForCard || (() => false);
    const removeMarkersAt = deps.removeMarkersAt || (() => { });
    const addMarker = deps.addMarker || (() => false);
    const random = deps.random || null;
    const targets = getMeteorTargets(cardState, gameState, playerKey);
    const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
    if (!allowed)
        return { applied: false, reason: 'invalid_target' };
    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null)
        return { applied: false, reason: 'out_of_board' };
    let destroyed = false;
    if (cellValue !== EMPTY) {
        if (typeof destroyAt === 'function') {
            const destroyOptions = { ignoreGuard: true, ignoreRegen: true };
            if (random && typeof random.random === 'function') {
                destroyOptions.random = random;
            }
            const result = destroyAt(cardState, gameState, row, col, 'METEOR_WILL', 'meteor_cell_destroy', destroyOptions);
            destroyed = isDestroyResolved(result);
            if (result && result.reason === 'out_of_board') {
                return { applied: false, reason: 'out_of_board' };
            }
            if (result && result.reason === 'absolute_protected') {
                return { applied: false, reason: 'absolute_protected' };
            }
        }
        if (!destroyed) {
            clearStoneIdAtForCard(cardState, gameState, row, col);
            setCellValueForCard(gameState, row, col, EMPTY);
            removeMarkersAt(cardState, row, col);
            destroyed = true;
        }
    }
    else {
        clearStoneIdAtForCard(cardState, gameState, row, col);
        setCellValueForCard(gameState, row, col, EMPTY);
        removeMarkersAt(cardState, row, col);
    }
    removeMarkersAt(cardState, row, col);
    addMarker(cardState, 'specialStone', row, col, playerKey, {
        type: 'METEOR_HOLE'
    });
    cardState.pendingEffectByPlayer[playerKey] = null;
    return { applied: true, row, col, destroyed };
}
module.exports = {
    applyMeteorWill
};
//# sourceMappingURL=meteor.js.map