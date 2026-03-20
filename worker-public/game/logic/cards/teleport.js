/**
 * @file teleport.js
 * @description Teleport helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardTeleport = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants) {
    'use strict';

    const EMPTY = Number.isFinite(Number(SharedConstants && SharedConstants.EMPTY))
        ? Number(SharedConstants.EMPTY)
        : 0;

    function resolveRandomSource(prng) {
        return (prng && typeof prng.random === 'function')
            ? prng
            : { random: Math.random };
    }

    function resolveRandomIndex(randomSource, length) {
        if (!Number.isInteger(length) || length <= 0) return 0;
        const raw = Math.floor(randomSource.random() * length);
        if (!Number.isInteger(raw)) return 0;
        return Math.max(0, Math.min(length - 1, raw));
    }

    function getMarkers(cardState, deps) {
        if (deps && typeof deps.getMarkers === 'function') {
            return deps.getMarkers(cardState);
        }
        return Array.isArray(cardState && cardState.markers) ? cardState.markers : [];
    }

    function moveMarkers(cardState, fromRow, fromCol, toRow, toCol, deps) {
        const markers = getMarkers(cardState, deps);
        for (const marker of markers) {
            if (!marker) continue;
            if (marker.row !== fromRow || marker.col !== fromCol) continue;
            marker.row = toRow;
            marker.col = toCol;
        }
    }

    function leaveMeteorHoleAt(cardState, gameState, playerKey, row, col, deps) {
        const clearStoneIdAtForCard = deps.clearStoneIdAtForCard || (() => {});
        const setCellValueForCard = deps.setCellValueForCard || (() => false);
        const removeMarkersAt = deps.removeMarkersAt || (() => {});
        const addMarker = deps.addMarker || (() => false);

        clearStoneIdAtForCard(cardState, gameState, row, col);
        setCellValueForCard(gameState, row, col, EMPTY);
        removeMarkersAt(cardState, row, col);
        addMarker(cardState, 'specialStone', row, col, playerKey, {
            type: 'METEOR_HOLE'
        });
    }

    function applyTeleportWill(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'TELEPORT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const setCellValueForCard = deps.setCellValueForCard || (() => false);
        const getTeleportTargets = deps.getTeleportTargets || (() => []);
        const getTeleportDestinations = deps.getTeleportDestinations || (() => []);
        const moveAt = deps.moveAt || null;

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const targets = getTeleportTargets(cardState, gameState);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const destinations = getTeleportDestinations(cardState, gameState);
        if (!Array.isArray(destinations) || !destinations.length) {
            return { applied: false, reason: 'no_destination' };
        }

        const randomSource = resolveRandomSource(prng);
        const to = destinations[resolveRandomIndex(randomSource, destinations.length)] || destinations[0];

        moveMarkers(cardState, row, col, to.row, to.col, deps);

        if (typeof moveAt === 'function') {
            const result = moveAt(cardState, gameState, row, col, to.row, to.col, 'TELEPORT_WILL', 'teleport_move');
            if (!result || !result.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return { applied: true, from: { row, col }, to };
    }

    function applyCellTeleportWill(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'CELL_TELEPORT_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const getCellTeleportTargets = deps.getCellTeleportTargets || (() => []);
        const getCellTeleportDestinations = deps.getCellTeleportDestinations || (() => []);
        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const ensureExpansionCellForCard = deps.ensureExpansionCellForCard || (() => false);
        const moveAt = deps.moveAt || null;
        const setCellValueForCard = deps.setCellValueForCard || (() => false);
        const getStoneIdAtForCard = deps.getStoneIdAtForCard || (() => null);
        const clearStoneIdAtForCard = deps.clearStoneIdAtForCard || (() => {});
        const setStoneIdAtForCard = deps.setStoneIdAtForCard || (() => false);

        const targets = getCellTeleportTargets(cardState, gameState);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const destinations = getCellTeleportDestinations(cardState, gameState)
            .filter((target) => !(target && target.row === row && target.col === col));
        if (!destinations.length) return { applied: false, reason: 'no_destination' };

        const randomSource = resolveRandomSource(prng);
        const to = destinations[resolveRandomIndex(randomSource, destinations.length)] || destinations[0];
        const createdDestination = !to.active;

        if (!ensureExpansionCellForCard(gameState, to.row, to.col, EMPTY)) {
            return { applied: false, reason: 'invalid_destination' };
        }

        let moved = false;
        if (typeof moveAt === 'function') {
            const result = moveAt(cardState, gameState, row, col, to.row, to.col, 'CELL_TELEPORT_WILL', 'teleport_move');
            if (result && result.reason === 'out_of_board') {
                return { applied: false, reason: 'move_failed' };
            }
            if (result && result.reason === 'absolute_protected_source') {
                return { applied: false, reason: 'absolute_protected' };
            }
            moved = !!(result && result.moved);
        }

        if (!moved) {
            const sourceStoneId = getStoneIdAtForCard(cardState, gameState, row, col);
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, to.row, to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
            clearStoneIdAtForCard(cardState, gameState, row, col);
            setStoneIdAtForCard(cardState, gameState, to.row, to.col, sourceStoneId);
        }

        moveMarkers(cardState, row, col, to.row, to.col, deps);
        leaveMeteorHoleAt(cardState, gameState, playerKey, row, col, deps);

        cardState.pendingEffectByPlayer[playerKey] = null;
        return {
            applied: true,
            from: { row, col },
            to: { row: to.row, col: to.col },
            createdDestination
        };
    }

    return {
        applyTeleportWill,
        applyCellTeleportWill
    };
}));