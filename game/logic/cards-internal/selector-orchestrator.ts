/**
 * @file selector-orchestrator.ts
 * @description Pending target selector orchestration shared between Browser and Headless.
 */

import PendingSelectionRegistry = require('./pending-selection-registry');

interface SelectorContext {
    cardState?: any;
    gameState?: any;
    playerKey?: string;
    pending?: any;
    constants?: any;
    helpers?: any;
    selectorsModule?: any;
    localSelectors?: any;
}

function getPendingType(context: SelectorContext): string {
    const pending = context && context.pending;
    return pending && pending.type ? String(pending.type) : '';
}

function getConstants(context: SelectorContext): { emptyValue: number; blackValue: number; whiteValue: number } {
    const constants = (context && context.constants) || {};
    return {
        emptyValue: Number.isFinite(Number(constants.EMPTY)) ? Number(constants.EMPTY) : 0,
        blackValue: Number.isFinite(Number(constants.BLACK)) ? Number(constants.BLACK) : 1,
        whiteValue: Number.isFinite(Number(constants.WHITE)) ? Number(constants.WHITE) : -1
    };
}

function requireBoardView(context: SelectorContext): any {
    const helpers = (context && context.helpers) || {};
    if (typeof helpers.createBoardViewForCard !== 'function') {
        throw new Error('[selector-orchestrator] createBoardViewForCard is required');
    }
    const boardView = helpers.createBoardViewForCard(context.cardState, context.gameState);
    if (!boardView || !Array.isArray(boardView.coordinates) || typeof boardView.get !== 'function') {
        throw new Error('[selector-orchestrator] createBoardViewForCard returned an invalid BoardView');
    }
    return boardView;
}

function forEachBoardShapeCell(context: SelectorContext, iteratee: (row: number, col: number, value: number) => void): void {
    const boardView = requireBoardView(context);
    for (const cell of boardView.coordinates) {
        const value = boardView.get(cell.row, cell.col);
        if (value === null) {
            throw new Error(`[selector-orchestrator] BoardView returned null for playable cell ${cell.row},${cell.col}`);
        }
        iteratee(cell.row, cell.col, value);
    }
}

function invokeModuleSelector(context: SelectorContext, type: string): any {
    const registryEntry = PendingSelectionRegistry.getPendingSelectionEntry(type);
    const registryTarget = registryEntry && registryEntry.target ? registryEntry.target : null;
    const selectorsModule = context && context.selectorsModule;
    if (!registryTarget || !selectorsModule) return null;
    const selector = selectorsModule[registryTarget.method];
    if (typeof selector !== 'function') return null;
    return selector(...getSelectorArgs(context, registryTarget.argsKey));
}

function getSelectorArgs(context: SelectorContext, argsKey: string): any[] {
    switch (argsKey) {
    case 'board':
        return [context.cardState, context.gameState];
    case 'player':
        return [context.cardState, context.gameState, context.playerKey];
    case 'player_pending':
        return [context.cardState, context.gameState, context.playerKey, context.pending];
    default:
        return [context.cardState, context.gameState, context.playerKey];
    }
}

function invokeLocal(context: SelectorContext, name: string, args: any[]): any {
    const localSelectors = (context && context.localSelectors) || {};
    const selector = localSelectors[name];
    if (typeof selector !== 'function') return [];
    return selector(...args);
}

function getDestroyTargetsFallback(context: SelectorContext): { row: number; col: number }[] {
    const { emptyValue } = getConstants(context);
    const res: { row: number; col: number }[] = [];

    forEachBoardShapeCell(context, (row, col, ownerValue) => {
        if (ownerValue !== emptyValue) {
            res.push({ row, col });
        }
    });
    return res;
}

function getSwapTargetsFallback(context: SelectorContext): { row: number; col: number }[] {
    const { blackValue, whiteValue } = getConstants(context);
    const playerVal = context.playerKey === 'black' ? blackValue : whiteValue;
    const opponentVal = -playerVal;
    const cardState = context && context.cardState;
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const res: { row: number; col: number }[] = [];

    const isHiddenTrapForPlayer = (marker: any) => (
        marker &&
        marker.kind === 'specialStone' &&
        marker.data &&
        marker.data.type === 'TRAP' &&
        marker.owner &&
        marker.owner !== context.playerKey
    );

    const pushSwapTarget = (targetRow: number, targetCol: number, ownerValue: number) => {
        if (ownerValue !== opponentVal) return;
        const hasSpecialOrBomb = markers.some((marker: any) => {
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

    forEachBoardShapeCell(context, (row, col, ownerValue) => {
        pushSwapTarget(row, col, ownerValue);
    });
    return res;
}

function getPositionSwapTargetsFallback(context: SelectorContext): { row: number; col: number }[] {
    const { emptyValue } = getConstants(context);
    const helpers = (context && context.helpers) || {};
    const isPositionSwapProtectedCell = helpers.isPositionSwapProtectedCell;
    const pending = context && context.pending;
    const first = pending && pending.firstTarget
        ? { row: pending.firstTarget.row, col: pending.firstTarget.col }
        : null;
    const res: { row: number; col: number }[] = [];

    const pushPositionSwapTarget = (targetRow: number, targetCol: number, ownerValue: number) => {
        if (ownerValue === emptyValue) return;
        if (first && first.row === targetRow && first.col === targetCol) return;
        if (typeof isPositionSwapProtectedCell === 'function' && isPositionSwapProtectedCell(context.cardState, targetRow, targetCol)) {
            return;
        }
        res.push({ row: targetRow, col: targetCol });
    };

    forEachBoardShapeCell(context, (row, col, ownerValue) => {
        pushPositionSwapTarget(row, col, ownerValue);
    });
    return res;
}

function getSelectableTargetsForPending(context: SelectorContext): any[] {
    const type = getPendingType(context);
    if (!type) return [];

    const moduleTargets = invokeModuleSelector(context, type);
    if (Array.isArray(moduleTargets)) return moduleTargets;

    if (type === 'DESTROY_ONE_STONE') return getDestroyTargetsFallback(context);
    if (type === 'SWAP_WITH_ENEMY') return getSwapTargetsFallback(context);
    if (type === 'POSITION_SWAP_WILL') return getPositionSwapTargetsFallback(context);

    const registryEntry = PendingSelectionRegistry.getPendingSelectionEntry(type);
    if (registryEntry && registryEntry.target && registryEntry.target.method) {
        const registryTargets = invokeLocal(context, registryEntry.target.method, getSelectorArgs(context, registryEntry.target.argsKey));
        if (Array.isArray(registryTargets)) return registryTargets;
    }
    return [];
}

export = {
    getSelectableTargetsForPending
};
