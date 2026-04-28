// @ts-nocheck
"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
const BoardOpsModule = _require('../board_ops');
const DestroyOutcomeContract = (() => {
    try {
        return _require('../../../shared/destroy-outcome-contract');
    }
    catch (_e) {
        return null;
    }
})();
const DESTROY_OUTCOME_KINDS = (DestroyOutcomeContract && DestroyOutcomeContract.DESTROY_OUTCOME_KINDS)
    || Object.freeze({
        DESTROYED: 'destroyed',
        REGENERATED: 'regenerated',
        GHOST_BLOCKED: 'ghost_blocked',
        PROLIFERATED: 'proliferated',
        EVADED_MOVE: 'evaded_move'
    });
function resolveBoardDims(gameState) {
    const board = gameState && Array.isArray(gameState.board) ? gameState.board : null;
    const rows = board && board.length > 0 ? board.length : 8;
    const cols = board && Array.isArray(board[0]) && board[0].length > 0 ? board[0].length : rows;
    return { rows, cols };
}
function isMainBoardCell(row, col, gameState) {
    const dims = resolveBoardDims(gameState);
    return Number.isInteger(row) && row >= 0 && row < dims.rows && Number.isInteger(col) && col >= 0 && col < dims.cols;
}
function resolveExpansionSide(side, row, col, gameState) {
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom')
        return side;
    const dims = resolveBoardDims(gameState);
    if (col === -1)
        return 'left';
    if (col === dims.cols)
        return 'right';
    if (row === -1)
        return 'top';
    if (row === dims.rows)
        return 'bottom';
    return null;
}
function isExpansionCoordinate(row, col, gameState) {
    if (!Number.isInteger(row) || !Number.isInteger(col))
        return false;
    const dims = resolveBoardDims(gameState);
    if (row < -1 || row > dims.rows || col < -1 || col > dims.cols)
        return false;
    if (isMainBoardCell(row, col, gameState))
        return false;
    return true;
}
function normalizeExpansionOwner(owner) {
    return (owner === 1 || owner === -1) ? owner : 0;
}
function getExpansionCells(gameState) {
    const expansion = (gameState && gameState.boardExpansion && typeof gameState.boardExpansion === 'object')
        ? gameState.boardExpansion
        : null;
    if (!expansion)
        return [];
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
            if (!Number.isInteger(col) && side === 'left')
                col = -1;
            if (!Number.isInteger(col) && side === 'right')
                col = resolveBoardDims(gameState).cols;
        }
        else {
            side = source;
            row = legacyRow;
            if (side === 'left')
                col = -1;
            if (side === 'right')
                col = resolveBoardDims(gameState).cols;
        }
        if (!isExpansionCoordinate(row, col, gameState))
            return;
        if (cells.some((cell) => cell && cell.row === row && cell.col === col))
            return;
        cells.push({
            side: resolveExpansionSide(side, row, col, gameState),
            row,
            col,
            owner: normalizeExpansionOwner(owner || 0)
        });
    };
    if (Array.isArray(expansion.cells)) {
        for (const cell of expansion.cells) {
            if (!cell || typeof cell !== 'object')
                continue;
            pushCell(cell);
        }
    }
    if (cells.length === 0 && expansion.active === true) {
        pushCell(expansion);
    }
    return cells;
}
function syncLegacyExpansionFields(expansion, gameState) {
    if (!expansion || typeof expansion !== 'object')
        return;
    if (!Array.isArray(expansion.cells))
        expansion.cells = [];
    const latest = expansion.cells.length > 0 ? expansion.cells[expansion.cells.length - 1] : null;
    expansion.active = !!latest;
    expansion.side = latest ? resolveExpansionSide(latest.side, latest.row, latest.col, gameState) : null;
    expansion.row = latest ? latest.row : null;
    expansion.owner = latest ? normalizeExpansionOwner(latest.owner) : 0;
}
function getCellValue(gameState, row, col) {
    if (!gameState || !Array.isArray(gameState.board))
        return null;
    if (isMainBoardCell(row, col, gameState)) {
        return gameState.board[row][col];
    }
    for (const cell of getExpansionCells(gameState)) {
        if (!cell)
            continue;
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
    const kind = (source && source.kind) || (source && source.regenerated ? DESTROY_OUTCOME_KINDS.REGENERATED
        : source && source.proliferated ? DESTROY_OUTCOME_KINDS.PROLIFERATED
            : source && source.blockedByGhost ? DESTROY_OUTCOME_KINDS.GHOST_BLOCKED
                : source && source.evaded ? DESTROY_OUTCOME_KINDS.EVADED_MOVE
                    : source && source.destroyed ? DESTROY_OUTCOME_KINDS.DESTROYED
                        : null);
    const outcome = Object.assign({}, source, {
        destroyed: kind === DESTROY_OUTCOME_KINDS.DESTROYED || source.destroyed === true,
        regenerated: kind === DESTROY_OUTCOME_KINDS.REGENERATED || source.regenerated === true,
        evaded: kind === DESTROY_OUTCOME_KINDS.EVADED_MOVE || source.evaded === true,
        blockedByGhost: kind === DESTROY_OUTCOME_KINDS.GHOST_BLOCKED || source.blockedByGhost === true,
        proliferated: kind === DESTROY_OUTCOME_KINDS.PROLIFERATED || source.proliferated === true
    });
    if (kind)
        outcome.kind = kind;
    if (outcome.to && typeof outcome.destination === 'undefined')
        outcome.destination = outcome.to;
    if (outcome.from && typeof outcome.source === 'undefined')
        outcome.source = outcome.from;
    return outcome;
}
function isDestroyResolved(result) {
    if (DestroyOutcomeContract && typeof DestroyOutcomeContract.isDestroyOutcomeResolved === 'function') {
        return DestroyOutcomeContract.isDestroyOutcomeResolved(result);
    }
    return !!(result && (result.destroyed || result.regenerated || result.evaded || result.blockedByGhost || result.proliferated));
}
function applyDestroyOneStone(cardState, gameState, playerKey, row, col, deps = {}) {
    const result = createDestroyOutcome({});
    if (!gameState)
        return result;
    const BoardOps = deps.BoardOps || BoardOpsModule;
    const destroyAtFn = deps.destroyAt;
    // Prefer BoardOps.destroyAt to ensure unified behavior and presentation event emission
    if (BoardOps && typeof BoardOps.destroyAt === 'function') {
        const res = BoardOps.destroyAt(cardState, gameState, row, col, 'DESTROY_ONE_STONE', 'destroy_one_stone');
        if (isDestroyResolved(res)) {
            const cs = cardState;
            cs.pendingEffectByPlayer = cs.pendingEffectByPlayer || { black: null, white: null };
            cs.pendingEffectByPlayer[playerKey] = null;
            return createDestroyOutcome(res);
        }
        // If BoardOps rejected destroy (e.g. guard protection), do not bypass with fallback paths.
        if (res && res.destroyed === false) {
            return result;
        }
    }
    // If destroyAt function provided
    if (typeof destroyAtFn === 'function') {
        if (getCellValue(gameState, row, col) === 0)
            return result;
        const destroyed = destroyAtFn(cardState, gameState, row, col);
        if (destroyed) {
            const cs = cardState;
            cs.pendingEffectByPlayer = cs.pendingEffectByPlayer || { black: null, white: null };
            cs.pendingEffectByPlayer[playerKey] = null;
            return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
        }
    }
    // Fallback: original inline behavior
    if (getCellValue(gameState, row, col) === 0)
        return result;
    if (cardState && cardState.markers) {
        cardState.markers = cardState.markers.filter((m) => !(m.row === row && m.col === col));
    }
    if (isMainBoardCell(row, col, gameState)) {
        gameState.board[row][col] = 0;
    }
    else if (gameState.boardExpansion && typeof gameState.boardExpansion === 'object') {
        const expansion = gameState.boardExpansion;
        const cells = getExpansionCells(gameState).map((cell) => ({ ...cell }));
        for (let i = 0; i < cells.length; i++) {
            const cell = cells[i];
            if (!cell || typeof cell !== 'object')
                continue;
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
        syncLegacyExpansionFields(expansion, gameState);
    }
    const cs = cardState;
    cs.pendingEffectByPlayer = cs.pendingEffectByPlayer || { black: null, white: null };
    cs.pendingEffectByPlayer[playerKey] = null;
    return createDestroyOutcome(DESTROY_OUTCOME_KINDS.DESTROYED);
}
module.exports = {
    applyDestroyOneStone
};
//# sourceMappingURL=destroy_one_stone.js.map