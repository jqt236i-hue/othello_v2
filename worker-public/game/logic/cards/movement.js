/**
 * @file movement.js
 * @description Strong-wind style movement helpers (Shared between Browser and Headless)
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardMovement = factory(root.SharedConstants);
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

    function collectVerticalCrushMovePlan(cardState, gameState, row, col, dr, deps) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
        if (dr !== -1 && dr !== 1) return null;

        const hasBoardShapeCellForCard = deps.hasBoardShapeCellForCard || (() => false);
        const isBlockedCell = deps.isBlockedCell || (() => false);
        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const findSpecialMarkerAt = deps.findSpecialMarkerAt || (() => null);

        const firstRow = row + dr;
        if (!hasBoardShapeCellForCard(cardState, gameState, firstRow, col)) return null;

        const destroyed = [];
        let to = null;
        for (let currentRow = firstRow; hasBoardShapeCellForCard(cardState, gameState, currentRow, col); currentRow += dr) {
            if (isBlockedCell(cardState, currentRow, col, gameState)) break;

            if (getCellValueForCard(gameState, currentRow, col) !== EMPTY) {
                const guard = findSpecialMarkerAt(cardState, currentRow, col, 'GUARD');
                if (guard) break;
                destroyed.push({ row: currentRow, col });
                const ghost = findSpecialMarkerAt(cardState, currentRow, col, 'GHOST');
                if (!ghost) {
                    to = { row: currentRow, col };
                }
                continue;
            }

            to = { row: currentRow, col };
        }

        if (!to) return null;
        const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);
        if (movedDistance <= 0) return null;

        return {
            from: { row, col },
            to,
            destroyed,
            direction: { dr, dc: 0 },
            movedDistance
        };
    }

    function getStrongWindMoveOptions(cardState, gameState, row, col, deps) {
        const hasBoardShapeCellForCard = deps.hasBoardShapeCellForCard || (() => false);
        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const isBlockedCell = deps.isBlockedCell || (() => false);
        const dirs = [
            { dr: -1, dc: 0 },
            { dr: 1, dc: 0 },
            { dr: 0, dc: -1 },
            { dr: 0, dc: 1 }
        ];
        const options = [];

        for (const direction of dirs) {
            const nextRow = row + direction.dr;
            const nextCol = col + direction.dc;
            if (!hasBoardShapeCellForCard(cardState, gameState, nextRow, nextCol)) continue;
            if (getCellValueForCard(gameState, nextRow, nextCol) !== EMPTY) continue;
            if (isBlockedCell(cardState, nextRow, nextCol, gameState)) continue;

            let targetRow = nextRow;
            let targetCol = nextCol;
            while (true) {
                const probeRow = targetRow + direction.dr;
                const probeCol = targetCol + direction.dc;
                if (!hasBoardShapeCellForCard(cardState, gameState, probeRow, probeCol)) break;
                if (getCellValueForCard(gameState, probeRow, probeCol) !== EMPTY) break;
                if (isBlockedCell(cardState, probeRow, probeCol, gameState)) break;
                targetRow = probeRow;
                targetCol = probeCol;
            }

            const distance = Math.abs(targetRow - row) + Math.abs(targetCol - col);
            options.push({
                direction,
                target: { row: targetRow, col: targetCol },
                distance
            });
        }

        return options;
    }

    function applyStrongWindWill(cardState, gameState, playerKey, row, col, prng, deps = {}) {
        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== 'STRONG_WIND_WILL' || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const setCellValueForCard = deps.setCellValueForCard || (() => false);
        const moveAt = deps.moveAt || null;
        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const options = getStrongWindMoveOptions(cardState, gameState, row, col, deps);
        if (!options.length) return { applied: false, reason: 'no_move_options' };

        const maxDistance = options.reduce((maxValue, option) => Math.max(maxValue, Number(option && option.distance) || 0), 0);
        const bestOptions = options.filter((option) => (Number(option && option.distance) || 0) === maxDistance);
        const randomSource = resolveRandomSource(prng);
        const selected = bestOptions[resolveRandomIndex(randomSource, bestOptions.length)] || bestOptions[0];
        const to = selected.target;
        const movedDistance = Math.abs(to.row - row) + Math.abs(to.col - col);

        moveMarkers(cardState, row, col, to.row, to.col, deps);

        if (typeof moveAt === 'function') {
            const result = moveAt(cardState, gameState, row, col, to.row, to.col, 'STRONG_WIND_WILL', 'strong_wind_move');
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
        return {
            applied: true,
            from: { row, col },
            to,
            direction: selected.direction,
            movedDistance,
            chargeGained: 0
        };
    }

    function applyVerticalCrushWill(cardState, gameState, playerKey, row, col, config, deps = {}) {
        const cfg = config || {};
        const pendingType = String(cfg.pendingType || '');
        const direction = Number(cfg.direction);
        const moveReason = String(cfg.moveReason || '').trim();
        const destroyReason = String(cfg.destroyReason || '').trim();
        const targetGetter = typeof cfg.targetGetter === 'function' ? cfg.targetGetter : (() => []);
        const getCellValueForCard = deps.getCellValueForCard || (() => null);
        const destroyAt = deps.destroyAt || null;
        const destroyAtLegacy = deps.destroyAtLegacy || (() => false);
        const resolveDestroy = deps.isDestroyResolved || ((result) => !!(result && result.destroyed));
        const moveAt = deps.moveAt || null;
        const setCellValueForCard = deps.setCellValueForCard || (() => false);

        const pending = cardState && cardState.pendingEffectByPlayer ? cardState.pendingEffectByPlayer[playerKey] : null;
        if (!pending || pending.type !== pendingType || pending.stage !== 'selectTarget') {
            return { applied: false, reason: 'not_pending' };
        }

        const cellValue = getCellValueForCard(gameState, row, col);
        if (cellValue === null) return { applied: false, reason: 'out_of_board' };
        if (cellValue === EMPTY) return { applied: false, reason: 'empty' };

        const targets = targetGetter(cardState, gameState);
        const allowed = Array.isArray(targets) && targets.some((target) => target && target.row === row && target.col === col);
        if (!allowed) return { applied: false, reason: 'invalid_target' };

        const plan = collectVerticalCrushMovePlan(cardState, gameState, row, col, direction, deps);
        if (!plan) return { applied: false, reason: 'no_move_options' };

        const totalTravelDistance = Number(plan.movedDistance) || Math.abs(plan.to.row - row) || 1;
        const destroyed = [];
        for (let index = 0; index < plan.destroyed.length; index += 1) {
            const target = plan.destroyed[index];
            if (!target) continue;

            const collisionDistance = Math.abs(target.row - row);
            const collisionProgress = Math.max(0, Math.min(1, collisionDistance / totalTravelDistance));

            if (typeof destroyAt === 'function') {
                const result = destroyAt(
                    cardState,
                    gameState,
                    target.row,
                    target.col,
                    pendingType,
                    destroyReason,
                    {
                        sourceRow: row,
                        sourceCol: col,
                        collisionIndex: index + 1,
                        collisionCount: plan.destroyed.length,
                        collisionProgress,
                        travelDistance: totalTravelDistance,
                        travelToRow: plan.to.row,
                        travelToCol: plan.to.col
                    }
                );
                if (!resolveDestroy(result)) {
                    return { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                }
            } else {
                const destroyedOk = destroyAtLegacy(cardState, gameState, target.row, target.col);
                if (!destroyedOk) {
                    return { applied: false, reason: 'destroy_failed', failedAt: { row: target.row, col: target.col } };
                }
            }

            destroyed.push({ row: target.row, col: target.col });
        }

        moveMarkers(cardState, row, col, plan.to.row, plan.to.col, deps);

        if (typeof moveAt === 'function') {
            const result = moveAt(
                cardState,
                gameState,
                row,
                col,
                plan.to.row,
                plan.to.col,
                pendingType,
                moveReason,
                {
                    collisionCount: destroyed.length,
                    travelDistance: totalTravelDistance
                }
            );
            if (!result || !result.moved) {
                return { applied: false, reason: 'move_failed' };
            }
        } else {
            const cleared = setCellValueForCard(gameState, row, col, EMPTY);
            const placed = setCellValueForCard(gameState, plan.to.row, plan.to.col, cellValue);
            if (!cleared || !placed) {
                return { applied: false, reason: 'move_failed' };
            }
        }

        cardState.pendingEffectByPlayer[playerKey] = null;
        return {
            applied: true,
            from: { row, col },
            to: plan.to,
            destroyed,
            destroyedCount: destroyed.length,
            movedDistance: plan.movedDistance,
            direction: plan.direction
        };
    }

    function applySuperBuoyancyWill(cardState, gameState, playerKey, row, col, deps = {}) {
        return applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
            pendingType: 'SUPER_BUOYANCY_WILL',
            direction: -1,
            moveReason: 'super_buoyancy_move',
            destroyReason: 'super_buoyancy_collision',
            targetGetter: deps.getSuperBuoyancyTargets
        }, deps);
    }

    function applySuperGravityWill(cardState, gameState, playerKey, row, col, deps = {}) {
        return applyVerticalCrushWill(cardState, gameState, playerKey, row, col, {
            pendingType: 'SUPER_GRAVITY_WILL',
            direction: 1,
            moveReason: 'super_gravity_move',
            destroyReason: 'super_gravity_collision',
            targetGetter: deps.getSuperGravityTargets
        }, deps);
    }

    return {
        applyStrongWindWill,
        applySuperBuoyancyWill,
        applySuperGravityWill
    };
}));
