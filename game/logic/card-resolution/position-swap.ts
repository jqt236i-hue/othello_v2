import type { CardState, GameState, PlayerKey } from '../../../src/types';

(function (root: any, factory: any) {
    if (root && root.SharedConstants) {
        root.CardPositionSwapEffects = factory(root.SharedConstants);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory(require('../../../shared-constants'));
    } else {
        root.CardPositionSwapEffects = factory(root.SharedConstants);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants: any) {
    'use strict';

    const { EMPTY } = SharedConstants || {};

function applyPositionSwapWill(cardState: CardState, gameState: GameState, playerKey: PlayerKey, row: number, col: number, deps: any): Record<string, any> {
    const readCardPendingEffect = deps && deps.readCardPendingEffect;
    const getCellValueForCard = deps && deps.getCellValueForCard;
    const isPositionSwapProtectedCell = deps && deps.isPositionSwapProtectedCell;
    const swapOccupiedCellsWithPresentation = deps && deps.swapOccupiedCellsWithPresentation;
    const clearCardPendingEffect = deps && deps.clearCardPendingEffect;

    if (
        typeof readCardPendingEffect !== 'function' ||
        typeof getCellValueForCard !== 'function' ||
        typeof isPositionSwapProtectedCell !== 'function' ||
        typeof swapOccupiedCellsWithPresentation !== 'function' ||
        typeof clearCardPendingEffect !== 'function'
    ) {
        return { applied: false, reason: 'deps_missing' };
    }

    const pending = readCardPendingEffect(cardState, playerKey);
    if (!pending || pending.type !== 'POSITION_SWAP_WILL' || pending.stage !== 'selectTarget') {
        return { applied: false, reason: 'not_pending' };
    }
    const cellValue = getCellValueForCard(gameState, row, col);
    if (cellValue === null) return { applied: false, reason: 'out_of_board' };
    if (cellValue === EMPTY) return { applied: false, reason: 'empty' };
    if (isPositionSwapProtectedCell(cardState, row, col)) return { applied: false, reason: 'swap_protected' };

    const first = pending.firstTarget ? { row: pending.firstTarget.row, col: pending.firstTarget.col } : null;
    if (!first) {
        pending.firstTarget = { row, col };
        return { applied: true, completed: false, firstTarget: { row, col } };
    }

    if (first.row === row && first.col === col) {
        return { applied: false, reason: 'same_target' };
    }
    const firstValue = getCellValueForCard(gameState, first.row, first.col);
    if (firstValue === null) {
        pending.firstTarget = { row, col };
        return { applied: true, completed: false, firstTarget: { row, col } };
    }
    if (firstValue === EMPTY) {
        pending.firstTarget = { row, col };
        return { applied: true, completed: false, firstTarget: { row, col } };
    }
    if (isPositionSwapProtectedCell(cardState, first.row, first.col)) {
        pending.firstTarget = { row, col };
        return { applied: true, completed: false, firstTarget: { row, col } };
    }

    const swapResult = swapOccupiedCellsWithPresentation(cardState, gameState, first, { row, col }, {
        cause: 'POSITION_SWAP_WILL',
        reason: 'position_swap'
    });
    if (!swapResult || !swapResult.swapped) {
        return { applied: false, reason: (swapResult && swapResult.reason) || 'swap_failed' };
    }
    clearCardPendingEffect(cardState, playerKey);

    return { applied: true, completed: true, from: first, to: { row, col } };
}

    return {
        applyPositionSwapWill
    };
}));
