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

    const SELECTOR_HANDLER_CONFIGS = Object.freeze({
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
        TEMPT_WILL: {
            method: 'getTemptWillTargets',
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
        CAPTURE_WILL: {
            method: 'getCaptureWillTargets',
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
        EXTEND_LIFE_GOD: {
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
        const config = SELECTOR_HANDLER_CONFIGS[type];
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

    function invokeLocalSelector(context, type) {
        const config = SELECTOR_HANDLER_CONFIGS[type];
        if (!config) return [];
        return invokeLocal(context, config.method, config.args(context));
    }

    function forEachSelectableCell(context, visitor) {
        if (typeof visitor !== 'function') return;
        const gameState = context && context.gameState;
        if (!gameState || !Array.isArray(gameState.board)) return;

        for (let row = 0; row < gameState.board.length; row += 1) {
            const boardRow = Array.isArray(gameState.board[row]) ? gameState.board[row] : [];
            for (let col = 0; col < boardRow.length; col += 1) {
                visitor(row, col, boardRow[col], null);
            }
        }

        for (const expansion of getExpansionDescriptors(context)) {
            if (!expansion) continue;
            visitor(expansion.row, expansion.col, Number(expansion.owner), expansion.side || null);
        }
    }

    function getDestroyTargetsFallback(context) {
        const { emptyValue } = getConstants(context);
        const res = [];
        forEachSelectableCell(context, (row, col, ownerValue) => {
            if (ownerValue !== emptyValue) {
                res.push({ row, col });
            }
        });
        return res;
    }


    function getSwapTargetsFallback(context) {
        const { blackValue, whiteValue } = getConstants(context);
        const playerVal = context.playerKey === 'black' ? blackValue : whiteValue;
        const opponentVal = -playerVal;
        const cardState = context && context.cardState;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
        const res = [];

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

        forEachSelectableCell(context, (row, col, ownerValue) => {
            pushSwapTarget(row, col, ownerValue);
        });
        return res;
    }

    function getPositionSwapTargetsFallback(context) {
        const { emptyValue } = getConstants(context);
        const helpers = (context && context.helpers) || {};
        const isPositionSwapProtectedCell = helpers.isPositionSwapProtectedCell;
        const pending = context && context.pending;
        const first = pending && pending.firstTarget
            ? { row: pending.firstTarget.row, col: pending.firstTarget.col }
            : null;
        const res = [];

        const pushPositionSwapTarget = (targetRow, targetCol, ownerValue) => {
            if (ownerValue === emptyValue) return;
            if (first && first.row === targetRow && first.col === targetCol) return;
            if (typeof isPositionSwapProtectedCell === 'function' && isPositionSwapProtectedCell(context.cardState, targetRow, targetCol)) {
                return;
            }
            res.push({ row: targetRow, col: targetCol });
        };

        forEachSelectableCell(context, (row, col, ownerValue) => {
            pushPositionSwapTarget(row, col, ownerValue);
        });
        return res;
    }

    function getSelectableTargetsForPending(context) {
        const type = getPendingType(context);
        if (!type) return [];

        const moduleTargets = invokeModuleSelector(context, type);
        if (Array.isArray(moduleTargets)) return moduleTargets;

        if (type === 'DESTROY_ONE_STONE') return getDestroyTargetsFallback(context);
        if (type === 'SWAP_WITH_ENEMY') return getSwapTargetsFallback(context);
        if (type === 'POSITION_SWAP_WILL') return getPositionSwapTargetsFallback(context);

        const localTargets = invokeLocalSelector(context, type);
        if (Array.isArray(localTargets) && localTargets.length > 0) {
            return localTargets;
        }
        return [];
    }

    return {
        getSelectableTargetsForPending
    };
}));
