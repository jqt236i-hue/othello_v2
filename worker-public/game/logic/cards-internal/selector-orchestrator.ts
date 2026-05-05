/**
 * @file selector-orchestrator.ts
 * @description Pending target selector orchestration shared between Browser and Headless.
 */


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

interface SelectorConfig {
    method: string;
    args: (context: SelectorContext) => any[];
}

const MODULE_SELECTOR_HANDLERS: Record<string, SelectorConfig> = Object.freeze({
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
    LIVING_WILL: {
        method: 'getLivingWillTargets',
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
    BOARD_EXPANSION_WILL: {
        method: 'getBoardExpansionTargets',
        args: (context) => [context.cardState, context.gameState, context.playerKey]
    },
    BOARD_EXPANSION_GOD: {
        method: 'getBoardExpansionGodTargets',
        args: (context) => [context.cardState, context.gameState, context.playerKey]
    },
    BOARD_SHRINK_WILL: {
        method: 'getBoardShrinkTargets',
        args: (context) => [context.cardState, context.gameState, context.playerKey]
    },
    BOARD_SHRINK_GOD: {
        method: 'getBoardShrinkGodTargets',
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
    },
    SEED_WILL: {
        method: 'getSeedTargets',
        args: (context) => [context.cardState, context.gameState, context.playerKey]
    }
});

const LOCAL_SELECTOR_HANDLERS: Record<string, (context: SelectorContext) => any[]> = Object.freeze({
    STRONG_WIND_WILL: (context) => invokeLocal(context, 'getStrongWindTargets', [context.cardState, context.gameState]),
    SUPER_BUOYANCY_WILL: (context) => invokeLocal(context, 'getSuperBuoyancyTargets', [context.cardState, context.gameState]),
    SUPER_GRAVITY_WILL: (context) => invokeLocal(context, 'getSuperGravityTargets', [context.cardState, context.gameState]),
    TEMPT_WILL: (context) => invokeLocal(context, 'getTemptWillTargets', [context.cardState, context.gameState, context.playerKey]),
    CAPTURE_WILL: (context) => invokeLocal(context, 'getCaptureWillTargets', [context.cardState, context.gameState, context.playerKey]),
    TRAP_WILL: (context) => invokeLocal(context, 'getTrapTargets', [context.cardState, context.gameState, context.playerKey]),
    GUARD_WILL: (context) => invokeLocal(context, 'getGuardTargets', [context.cardState, context.gameState, context.playerKey]),
    GUARDIAN_GOD: (context) => invokeLocal(context, 'getGuardTargets', [context.cardState, context.gameState, context.playerKey]),
    LIVING_WILL: (context) => invokeLocal(context, 'getLivingWillTargets', [context.cardState, context.gameState, context.playerKey]),
    TIME_BOMB: (context) => invokeLocal(context, 'getTimeBombTargets', [context.cardState, context.gameState, context.playerKey]),
    TELEPORT_WILL: (context) => invokeLocal(context, 'getTeleportTargets', [context.cardState, context.gameState]),
    CELL_TELEPORT_WILL: (context) => invokeLocal(context, 'getCellTeleportTargets', [context.cardState, context.gameState]),
    CLONE_WILL: (context) => invokeLocal(context, 'getCloneTargets', [context.cardState, context.gameState, context.playerKey]),
    BOARD_EXPANSION_WILL: (context) => invokeLocal(context, 'getBoardExpansionTargets', [context.cardState, context.gameState, context.playerKey]),
    BOARD_EXPANSION_GOD: (context) => invokeLocal(context, 'getBoardExpansionGodTargets', [context.cardState, context.gameState, context.playerKey]),
    BOARD_SHRINK_WILL: (context) => invokeLocal(context, 'getBoardShrinkTargets', [context.cardState, context.gameState, context.playerKey]),
    BOARD_SHRINK_GOD: (context) => invokeLocal(context, 'getBoardShrinkGodTargets', [context.cardState, context.gameState, context.playerKey]),
    EXTEND_LIFE_WILL: (context) => invokeLocal(context, 'getExtendLifeTargets', [context.cardState, context.gameState, context.playerKey]),
    EXTEND_LIFE_GOD: (context) => invokeLocal(context, 'getExtendLifeTargets', [context.cardState, context.gameState, context.playerKey]),
    CORROSION_WILL: (context) => invokeLocal(context, 'getCorrosionTargets', [context.cardState, context.gameState, context.playerKey]),
    BLOCKADE_WILL: (context) => invokeLocal(context, 'getBlockadeTargets', [context.cardState, context.gameState, context.playerKey]),
    METEOR_WILL: (context) => invokeLocal(context, 'getMeteorTargets', [context.cardState, context.gameState, context.playerKey]),
    FREEZE_WILL: (context) => invokeLocal(context, 'getFreezeTargets', [context.cardState, context.gameState, context.playerKey]),
    SEED_WILL: (context) => invokeLocal(context, 'getSeedTargets', [context.cardState, context.gameState, context.playerKey])
});

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

function getExpansionDescriptors(context: SelectorContext): any[] {
    const helpers = (context && context.helpers) || {};
    if (typeof helpers.getExpansionDescriptorsForCard !== 'function') return [];
    const descriptors = helpers.getExpansionDescriptorsForCard(context.gameState);
    return Array.isArray(descriptors) ? descriptors : [];
}

function forEachMainBoardCell(context: SelectorContext, iteratee: (row: number, col: number, value: number) => void): void {
    const gameState = context && context.gameState;
    const board = gameState && gameState.board;
    if (!Array.isArray(board)) return;
    for (let row = 0; row < board.length; row++) {
        const boardRow = board[row];
        if (!Array.isArray(boardRow)) continue;
        for (let col = 0; col < boardRow.length; col++) {
            iteratee(row, col, boardRow[col]);
        }
    }
}

function invokeModuleSelector(context: SelectorContext, type: string): any {
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

function invokeLocal(context: SelectorContext, name: string, args: any[]): any {
    const localSelectors = (context && context.localSelectors) || {};
    const selector = localSelectors[name];
    if (typeof selector !== 'function') return [];
    return selector(...args);
}

function getDestroyTargetsFallback(context: SelectorContext): { row: number; col: number }[] {
    const { emptyValue } = getConstants(context);
    const gameState = context && context.gameState;
    const res: { row: number; col: number }[] = [];
    if (!gameState || !Array.isArray(gameState.board)) return res;

    forEachMainBoardCell(context, (row, col, ownerValue) => {
        if (ownerValue !== emptyValue) {
            res.push({ row, col });
        }
    });

    for (const expansion of getExpansionDescriptors(context)) {
        if (!expansion || Number(expansion.owner) === emptyValue) continue;
        res.push({ row: expansion.row, col: expansion.col });
    }
    return res;
}

function getSwapTargetsFallback(context: SelectorContext): { row: number; col: number }[] {
    const { blackValue, whiteValue } = getConstants(context);
    const playerVal = context.playerKey === 'black' ? blackValue : whiteValue;
    const opponentVal = -playerVal;
    const cardState = context && context.cardState;
    const gameState = context && context.gameState;
    const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];
    const res: { row: number; col: number }[] = [];

    if (!gameState || !Array.isArray(gameState.board)) return res;

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

    forEachMainBoardCell(context, (row, col, ownerValue) => {
        pushSwapTarget(row, col, ownerValue);
    });

    for (const expansion of getExpansionDescriptors(context)) {
        if (!expansion) continue;
        pushSwapTarget(expansion.row, expansion.col, Number(expansion.owner));
    }
    return res;
}

function getPositionSwapTargetsFallback(context: SelectorContext): { row: number; col: number }[] {
    const { emptyValue } = getConstants(context);
    const helpers = (context && context.helpers) || {};
    const isPositionSwapProtectedCell = helpers.isPositionSwapProtectedCell;
    const gameState = context && context.gameState;
    const pending = context && context.pending;
    const first = pending && pending.firstTarget
        ? { row: pending.firstTarget.row, col: pending.firstTarget.col }
        : null;
    const res: { row: number; col: number }[] = [];

    if (!gameState || !Array.isArray(gameState.board)) return res;

    const pushPositionSwapTarget = (targetRow: number, targetCol: number, ownerValue: number) => {
        if (ownerValue === emptyValue) return;
        if (first && first.row === targetRow && first.col === targetCol) return;
        if (typeof isPositionSwapProtectedCell === 'function' && isPositionSwapProtectedCell(context.cardState, targetRow, targetCol)) {
            return;
        }
        res.push({ row: targetRow, col: targetCol });
    };

    forEachMainBoardCell(context, (row, col, ownerValue) => {
        pushPositionSwapTarget(row, col, ownerValue);
    });

    for (const expansion of getExpansionDescriptors(context)) {
        if (!expansion) continue;
        pushPositionSwapTarget(expansion.row, expansion.col, Number(expansion.owner));
    }
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

    const localSelector = LOCAL_SELECTOR_HANDLERS[type];
    if (typeof localSelector === 'function') {
        return localSelector(context);
    }
    return [];
}

export = {
    getSelectableTargetsForPending
};
