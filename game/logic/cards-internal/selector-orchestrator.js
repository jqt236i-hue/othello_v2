/**
 * @file selector-orchestrator.js
 * @description Pending target selector orchestration shared between Browser and Headless.
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.CardSelectorOrchestrator = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MODULE_SELECTOR_HANDLERS = Object.freeze({
        DESTROY_ONE_STONE: {
            method: 'getDestroyTargets',
            args: (context) => [context.cardState, context.gameState]
        },
        STRONG_WIND_WILL: {
            method: 'getStrongWindTargets',
            args: (context) => [context.cardState, context.gameState]
        },
        SUPER_BUOYANCY_WILL: {
            method: 'getSuperBuoyancyTargets',
            args: (context) => [context.cardState, context.gameState]
        },
        SUPER_GRAVITY_WILL: {
            method: 'getSuperGravityTargets',
            args: (context) => [context.cardState, context.gameState]
        },
        SACRIFICE_WILL: {
            method: 'getSacrificeTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        SWAP_WITH_ENEMY: {
            method: 'getSwapTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        POSITION_SWAP_WILL: {
            method: 'getPositionSwapTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey, context.pending]
        },
        TRAP_WILL: {
            method: 'getTrapTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        GUARD_WILL: {
            method: 'getGuardTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        GUARDIAN_GOD: {
            method: 'getGuardTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        HYPERACTIVE_INHERIT_WILL: {
            method: 'getHyperactiveInheritTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        TIME_BOMB: {
            method: 'getTimeBombTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        TELEPORT_WILL: {
            method: 'getTeleportTargets',
            args: (context) => [context.cardState, context.gameState]
        },
        CELL_TELEPORT_WILL: {
            method: 'getCellTeleportTargets',
            args: (context) => [context.cardState, context.gameState]
        },
        CLONE_WILL: {
            method: 'getCloneTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        SPLIT_WILL: {
            method: 'getSplitTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        BOARD_EXPANSION_WILL: {
            method: 'getBoardExpansionTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        BOARD_EXPANSION_GOD: {
            method: 'getBoardExpansionGodTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        EXTEND_LIFE_WILL: {
            method: 'getExtendLifeTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        CORROSION_WILL: {
            method: 'getCorrosionTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        BLOCKADE_WILL: {
            method: 'getBlockadeTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        METEOR_WILL: {
            method: 'getMeteorTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        },
        FREEZE_WILL: {
            method: 'getFreezeTargets',
            args: (context) => [context.cardState, context.gameState, context.playerKey]
        }
    });

    const LOCAL_SELECTOR_HANDLERS = Object.freeze({
        STRONG_WIND_WILL: (context) => invokeLocal(context, 'getStrongWindTargets', [context.cardState, context.gameState]),
        SUPER_BUOYANCY_WILL: (context) => invokeLocal(context, 'getSuperBuoyancyTargets', [context.cardState, context.gameState]),
        SUPER_GRAVITY_WILL: (context) => invokeLocal(context, 'getSuperGravityTargets', [context.cardState, context.gameState]),
        TEMPT_WILL: (context) => invokeLocal(context, 'getTemptWillTargets', [context.cardState, context.gameState, context.playerKey]),
        TRAP_WILL: (context) => invokeLocal(context, 'getTrapTargets', [context.cardState, context.gameState, context.playerKey]),
        GUARD_WILL: (context) => invokeLocal(context, 'getGuardTargets', [context.cardState, context.gameState, context.playerKey]),
        GUARDIAN_GOD: (context) => invokeLocal(context, 'getGuardTargets', [context.cardState, context.gameState, context.playerKey]),
        HYPERACTIVE_INHERIT_WILL: (context) => invokeLocal(context, 'getHyperactiveInheritTargets', [context.cardState, context.gameState, context.playerKey]),
        TIME_BOMB: (context) => invokeLocal(context, 'getTimeBombTargets', [context.cardState, context.gameState, context.playerKey]),
        TELEPORT_WILL: (context) => invokeLocal(context, 'getTeleportTargets', [context.cardState, context.gameState]),
        CELL_TELEPORT_WILL: (context) => invokeLocal(context, 'getCellTeleportTargets', [context.cardState, context.gameState]),
        CLONE_WILL: (context) => invokeLocal(context, 'getCloneTargets', [context.cardState, context.gameState, context.playerKey]),
        SPLIT_WILL: (context) => invokeLocal(context, 'getSplitTargets', [context.cardState, context.gameState, context.playerKey]),
        BOARD_EXPANSION_WILL: (context) => invokeLocal(context, 'getBoardExpansionTargets', [context.cardState, context.gameState, context.playerKey]),
        BOARD_EXPANSION_GOD: (context) => invokeLocal(context, 'getBoardExpansionGodTargets', [context.cardState, context.gameState, context.playerKey]),
        EXTEND_LIFE_WILL: (context) => invokeLocal(context, 'getExtendLifeTargets', [context.cardState, context.gameState, context.playerKey]),
        CORROSION_WILL: (context) => invokeLocal(context, 'getCorrosionTargets', [context.cardState, context.gameState, context.playerKey]),
        BLOCKADE_WILL: (context) => invokeLocal(context, 'getBlockadeTargets', [context.cardState, context.gameState, context.playerKey]),
        METEOR_WILL: (context) => invokeLocal(context, 'getMeteorTargets', [context.cardState, context.gameState, context.playerKey]),
        FREEZE_WILL: (context) => invokeLocal(context, 'getFreezeTargets', [context.cardState, context.gameState, context.playerKey])
    });

    function getPendingType(context) {
        const pending = context && context.pending;
        return pending && pending.type ? String(pending.type) : '';
    }

    function getConstants(context) {
        const constants = (context && context.constants) || {};
        return {
            emptyValue: Number.isFinite(Number(constants.EMPTY)) ? Number(constants.EMPTY) : 0,
            blackValue: Number.isFinite(Number(constants.BLACK)) ? Number(constants.BLACK) : 1,
            whiteValue: Number.isFinite(Number(constants.WHITE)) ? Number(constants.WHITE) : -1
        };
    }

    function getExpansionDescriptors(context) {
        const helpers = (context && context.helpers) || {};
        if (typeof helpers.getExpansionDescriptorsForCard !== 'function') return [];
        const descriptors = helpers.getExpansionDescriptorsForCard(context.gameState);
        return Array.isArray(descriptors) ? descriptors : [];
    }

    function invokeModuleSelector(context, type) {
        const config = MODULE_SELECTOR_HANDLERS[type];
        const selectorsModule = context && context.selectorsModule;
        if (!config || !selectorsModule) return null;
        const selector = selectorsModule[config.method];
        if (typeof selector !== 'function') return null;
        try {
            return selector(...config.args(context));
        } catch (e) {
            return null;
        }
    }

    function invokeLocal(context, name, args) {
        const localSelectors = (context && context.localSelectors) || {};
        const selector = localSelectors[name];
        if (typeof selector !== 'function') return [];
        return selector(...args);
    }

    function getDestroyTargetsFallback(context) {
        const { emptyValue } = getConstants(context);
        const gameState = context && context.gameState;
        const res = [];
        if (!gameState || !Array.isArray(gameState.board)) return res;

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                if (gameState.board[row][col] !== emptyValue) {
                    res.push({ row, col });
                }
            }
        }

        for (const expansion of getExpansionDescriptors(context)) {
            if (!expansion || Number(expansion.owner) === emptyValue) continue;
            res.push({ row: expansion.row, col: expansion.col });
        }
        return res;
    }

    function getSacrificeTargetsFallback(context) {
        const { blackValue, whiteValue } = getConstants(context);
        const helpers = (context && context.helpers) || {};
        const getCurrentBoardShapeCellsForCard = helpers.getCurrentBoardShapeCellsForCard;
        const getCellValueForCard = helpers.getCellValueForCard;
        const res = [];
        if (typeof getCurrentBoardShapeCellsForCard !== 'function' || typeof getCellValueForCard !== 'function') {
            return res;
        }

        const playerVal = context.playerKey === 'black' ? blackValue : whiteValue;
        for (const cell of getCurrentBoardShapeCellsForCard(context.cardState, context.gameState)) {
            if (!cell) continue;
            if (getCellValueForCard(context.gameState, cell.row, cell.col) === playerVal) {
                res.push({ row: cell.row, col: cell.col });
            }
        }
        return res;
    }

    function getSwapTargetsFallback(context) {
        const { blackValue, whiteValue } = getConstants(context);
        const playerVal = context.playerKey === 'black' ? blackValue : whiteValue;
        const opponentVal = -playerVal;
        const cardState = context && context.cardState;
        const gameState = context && context.gameState;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];

        if (!gameState || !Array.isArray(gameState.board)) return res;

        const isHiddenTrapForPlayer = (marker) => (
            marker &&
            marker.kind === 'specialStone' &&
            marker.data &&
            marker.data.type === 'TRAP' &&
            marker.owner &&
            marker.owner !== context.playerKey
        );

        const pushSwapTarget = (targetRow, targetCol, ownerValue) => {
            if (ownerValue !== opponentVal) return;
            const hasSpecialOrBomb = markers.some((marker) => {
                if (!marker || marker.row !== targetRow || marker.col !== targetCol) return false;
                if (marker.kind === 'bomb') return true;
                if (marker.kind !== 'specialStone') return false;
                if (isHiddenTrapForPlayer(marker)) return false;
                const isExpiredUltimateHyperactive = !!(
                    marker.data &&
                    marker.data.type === 'ULTIMATE_HYPERACTIVE' &&
                    Number.isFinite(Number(marker.data.remainingOwnerTurns)) &&
                    Number(marker.data.remainingOwnerTurns) <= 0
                );
                if (isExpiredUltimateHyperactive) return false;
                return true;
            });
            if (hasSpecialOrBomb) return;
            res.push({ row: targetRow, col: targetCol });
        };

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                pushSwapTarget(row, col, gameState.board[row][col]);
            }
        }

        for (const expansion of getExpansionDescriptors(context)) {
            if (!expansion) continue;
            pushSwapTarget(expansion.row, expansion.col, Number(expansion.owner));
        }
        return res;
    }

    function getPositionSwapTargetsFallback(context) {
        const { emptyValue } = getConstants(context);
        const helpers = (context && context.helpers) || {};
        const isPositionSwapProtectedCell = helpers.isPositionSwapProtectedCell;
        const gameState = context && context.gameState;
        const pending = context && context.pending;
        const first = pending && pending.firstTarget
            ? { row: pending.firstTarget.row, col: pending.firstTarget.col }
            : null;
        const res = [];

        if (!gameState || !Array.isArray(gameState.board)) return res;

        const pushPositionSwapTarget = (targetRow, targetCol, ownerValue) => {
            if (ownerValue === emptyValue) return;
            if (first && first.row === targetRow && first.col === targetCol) return;
            if (typeof isPositionSwapProtectedCell === 'function' && isPositionSwapProtectedCell(context.cardState, targetRow, targetCol)) {
                return;
            }
            res.push({ row: targetRow, col: targetCol });
        };

        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                pushPositionSwapTarget(row, col, gameState.board[row][col]);
            }
        }

        for (const expansion of getExpansionDescriptors(context)) {
            if (!expansion) continue;
            pushPositionSwapTarget(expansion.row, expansion.col, Number(expansion.owner));
        }
        return res;
    }

    function getSelectableTargetsForPending(context) {
        const type = getPendingType(context);
        if (!type) return [];

        const moduleTargets = invokeModuleSelector(context, type);
        if (Array.isArray(moduleTargets)) return moduleTargets;

        if (type === 'DESTROY_ONE_STONE') return getDestroyTargetsFallback(context);
        if (type === 'SACRIFICE_WILL') return getSacrificeTargetsFallback(context);
        if (type === 'SWAP_WITH_ENEMY') return getSwapTargetsFallback(context);
        if (type === 'POSITION_SWAP_WILL') return getPositionSwapTargetsFallback(context);

        const localSelector = LOCAL_SELECTOR_HANDLERS[type];
        if (typeof localSelector === 'function') {
            return localSelector(context);
        }
        return [];
    }

    return {
        getSelectableTargetsForPending
    };
}));