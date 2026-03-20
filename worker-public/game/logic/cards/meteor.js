/**
 * @file meteor.js
 * @description Meteor helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardMeteor = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
        ? Number(SharedConstants.EMPTY)
        : 0;

    function applyMeteorWill(cardState, gameState, playerKey, row, col, deps = {}) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'METEOR_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const getMeteorTargets = deps.getMeteorTargets || (() => []);
        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const destroyAt = deps.destroyAt || null;
        const isDestroyResolved = deps.isDestroyResolved || ((result) => !!(result && result.destroyed));
        const clearStoneIdAtForCard = deps.clearStoneIdAtForCard || (() => {});
        const setCellValueForCard = deps.setCellValueForCard || (() => false);
        const removeMarkersAt = deps.removeMarkersAt || (() => {});
        const addMarker = deps.addMarker || (() => false);

        const targets = getMeteorTargets(cardState, gameState, playerKey);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };

        let destroyed = false;
        if (cellValue !== EMPTY) {
            if (typeof destroyAt === 'function') {
                const result = destroyAt(
                    cardState,
                    gameState,
                    row,
                    col,
                    'METEOR_WILL',
                    'meteor_cell_destroy',
                    { ignoreGuard: true }
                );
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
        } else {
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

    return {
        applyMeteorWill
    };
}));