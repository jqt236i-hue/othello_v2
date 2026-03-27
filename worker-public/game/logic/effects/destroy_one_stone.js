/**
 * @file destroy_one_stone.js
 * @description DESTROY_ONE_STONE helper - UMD module for browser and Node.js
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../board_ops'));
    } else {
        root.DestroyOneStone = factory(root.BoardOps);
    }
}(typeof self !== 'undefined' ? self : this, function (BoardOpsModule) {
    'use strict';

    const DestroyOutcomeContract = (() => {
        if (typeof require === 'function') {
            try {
                return require('../../../shared/destroy-outcome-contract');
            } catch (e) {
                return null;
            }
        }
        if (typeof globalThis !== 'undefined' && globalThis.DestroyOutcomeContract) {
            return globalThis.DestroyOutcomeContract;
        }
        return null;
    })();
    const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS)
        || Object.freeze({
            DESTROYED: 'destroyed',
            GHOST_BLOCKED: 'ghost_blocked',
            PROLIFERATED: 'proliferated',
            EVADED_MOVE: 'evaded_move'
        });

    function isMainBoardCell(row, col) {
        return Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8;
    }

    function resolveExpansionSide(side, row, col) {
        if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
        if (col === -1) return 'left';
        if (col === 8) return 'right';
        if (row === -1) return 'top';
        if (row === 8) return 'bottom';
        return null;
    }

    function isExpansionCoordinate(row, col) {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        if (row < -1 || row > 8 || col < -1 || col > 8) return false;
        if (isMainBoardCell(row, col)) return false;
        return true;
    }

    function normalizeExpansionOwner(owner) {
        return (owner === 1 || owner === -1) ? owner : 0;
    }

    function getExpansionCells(gameState) {
        const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
            ? gameState.boardExpansion
            : null;
        if (!expansion) return [];

        const cells = [];
        const pushCell = (source, legacyRow, legacyOwner) => {
            let side = null;
            let row = null;
            let col = null;
            let owner = legacyOwner;

            if (source && typeof source === 'object') {
                side = source.side;
                row = source.row;
                col = source.col;
                owner = source.owner;
                if (!Number.isInteger(col) && side === 'left') col = -1;
                if (!Number.isInteger(col) && side === 'right') col = 8;
            } else {
                side = source;
                row = legacyRow;
                if (side === 'left') col = -1;
                if (side === 'right') col = 8;
            }

            if (!isExpansionCoordinate(row, col)) return;
            if (cells.some((cell) => cell && cell.row === row && cell.col === col)) return;
            cells.push({
                side: resolveExpansionSide(side, row, col),
                row,
                col,
                owner: normalizeExpansionOwner(owner)
            });
        };

        if (Array.isArray(expansion.cells)) {
            for (const cell of expansion.cells) {
                if (!cell || typeof cell !== 'object') continue;
                pushCell(cell);
            }
        }

        if (cells.length === 0 && expansion.active === true) {
            pushCell(expansion);
        }

        return cells;
    }

    function syncLegacyExpansionFields(expansion) {
        if (!expansion || typeof expansion !== 'object') return;
        if (!Array.isArray(expansion.cells)) expansion.cells = [];
        const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
        expansion.active = !!latest;
        expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col) : null;
        expansion.row = latest ? latest.row : null;
        expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
    }

    function getCellValue(gameState, row, col) {
        if (!gameState || !Array.isArray(gameState.board)) return null;
        if (isMainBoardCell(row, col)) {
            return gameState.board[row][col];
        }

        for (const cell of getExpansionCells(gameState)) {
            if (!cell) continue;
            if (cell.row === row && cell.col === col) {
                return normalizeExpansionOwner(cell.owner);
            }
        }

        return null;
    }

    function createDestroyOutcome(kindOrResult, details) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.createDestroyOutcome === 'function') {
            return DestroyOutcomeContract.createDestroyOutcome(kindOrResult, details);
        }
        const source = (typeof kindOrResult === 'string')
            ? Object.assign({}, (details && typeof details === 'object') ? details : {}, { kind: kindOrResult })
            : Object.assign({}, (kindOrResult && typeof kindOrResult === 'object') ? kindOrResult : {});
        const kind = (source && source.kind) || (
            source && source.proliferated ? DESTROY_OUTCOME_KINDS.PROLIFERATED
                : source && source.blockedByGhost ? DESTROY_OUTCOME_KINDS.GHOST_BLOCKED
                    : source && source.evaded ? DESTROY_OUTCOME_KINDS.EVADED_MOVE
                        : source && source.destroyed ? DESTROY_OUTCOME_KINDS.DESTROYED
                            : null
        );
        const outcome = Object.assign({}, source, {
            destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
            evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
            blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
            proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
        });
        if (kind) outcome.kind = kind;
        if (outcome.to && typeof outcome.destination === 'undefined') outcome.destination = outcome.to;
        if (outcome.from && typeof outcome.source === 'undefined') outcome.source = outcome.from;
        return outcome;
    }

    function isDestroyResolved(result) {
        if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
            return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
        }
        return !!(result && (result.destroyed || result.evaded || result.blockedByGhost || result.proliferated));
    }

    function applyDestroyOneStone(cardState, gameState, playerKey, row, col, deps = {}) {
        const result = createDestroyOutcome();
        if (!gameState) return result;

        const BoardOps = deps.BoardOps || BoardOpsModule;
        const destroyAtFn = deps.destroyAt;

        // Prefer BoardOps.destroyAt to ensure unified behavior and presentation event emission
        if (BoardOps && typeof BoardOps.destroyAt === 'function') {
            const res = BoardOps.destroyAt(cardState, gameState, row, col, 'DESTROY_ONE_STONE', 'destroy_one_stone');
            if (isDestroyResolved(res)) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                return createDestroyOutcome(res);
            }
            // If BoardOps rejected destroy (e.g. guard protection), do not bypass with fallback paths.
            if (res && res.destroyed === false) {
                return result;
            }
        }

        // If destroyAt function provided
        if (typeof destroyAtFn === 'function') {
            if (getCellValue(gameState, row, col) === 0) return result;
            const destroyed = destroyAtFn(cardState, gameState, row, col);
            if (destroyed) {
                cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
                cardState.pendingEffectByPlayer[playerKey] = null;
                return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
            }
        }

        // Fallback: original inline behavior
        if (getCellValue(gameState, row, col) === 0) return result;
        if (cardState && cardState.markers) {
            cardState.markers = cardState.markers.filter(m => !(m.row === row && m.col === col));
        }
        if (Number.isInteger(row) && row >= 0 && row < 8 && Number.isInteger(col) && col >= 0 && col < 8) {
            gameState.board[row][col] = 0;
        } else if (gameState.boardExpansion && typeof gameState.boardExpansion === 'object') {
            const expansion = gameState.boardExpansion;
            const cells = getExpansionCells(gameState).map((cell) => ({ ...cell }));
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                if (!cell || typeof cell !== 'object') continue;
                if (cell.row === row && cell.col === col) {
                    cells[i] = Object.assign({}, cell, { owner: 0 });
                }
            }
            expansion.cells = cells.map((cell) => ({
                side: cell.side,
                row: cell.row,
                col: cell.col,
                owner: normalizeExpansionOwner(cell.owner)
            }));
            syncLegacyExpansionFields(expansion);
        }
        cardState.pendingEffectByPlayer = cardState.pendingEffectByPlayer || { black: null, white: null };
        cardState.pendingEffectByPlayer[playerKey] = null;
        return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
    }

    return {
        applyDestroyOneStone
    };
}));
