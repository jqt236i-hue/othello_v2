type SharedBoardUtilsPort = {
    isStandardBoard8x8: (board: any) => boolean;
    isCornerCell: (row: any, col: any, board: any) => boolean;
    isEdgeCell: (row: any, col: any, board: any) => boolean;
    collectBoardCoordinates: (board: any) => Array<{ row: number; col: number }>;
    getCellValue: (board: any, row: number, col: number) => number | null;
    countCornerControl: (board: any, playerValue: number) => { ownCorners: number; oppCorners: number };
    countEdgeControl: (board: any, playerValue: number) => { ownEdges: number; oppEdges: number };
};

type CpuDecisionBoardUtilsConfig = {
    sharedBoardUtils: SharedBoardUtilsPort;
};

const REQUIRED_SHARED_BOARD_UTILS_METHODS = [
    'isStandardBoard8x8',
    'isCornerCell',
    'isEdgeCell',
    'collectBoardCoordinates',
    'getCellValue',
    'countCornerControl',
    'countEdgeControl'
] as const;

function requireSharedBoardUtils(config: CpuDecisionBoardUtilsConfig): SharedBoardUtilsPort {
    const sharedBoardUtils = config && config.sharedBoardUtils;
    const missingMethod = REQUIRED_SHARED_BOARD_UTILS_METHODS.find((methodName) => (
        !sharedBoardUtils || typeof sharedBoardUtils[methodName] !== 'function'
    ));
    if (missingMethod) {
        throw new Error(`CpuDecisionBoardUtils requires SharedBoardUtils.${missingMethod}`);
    }
    return sharedBoardUtils;
}

/**
 * CPU decision's board-facing composition boundary.
 *
 * SharedBoardUtils owns board geometry.  This adapter deliberately has no
 * geometry fallback: a missing shared dependency is a setup error, not a
 * reason to recompute that policy in cpu-decision.
 */
export function createCpuDecisionBoardUtils(config: CpuDecisionBoardUtilsConfig) {
    const sharedBoardUtils = requireSharedBoardUtils(config);

    function isPlayableBoard(board: any): boolean {
        if (board && typeof board === 'object' && !Array.isArray(board)) {
            return sharedBoardUtils.collectBoardCoordinates(board).length > 0;
        }
        if (!Array.isArray(board) || board.length <= 0) return false;
        return board.every((row: any) => Array.isArray(row) && row.length > 0);
    }

    function countBoardEmpties(board: any): number {
        let empties = 0;
        for (const cell of sharedBoardUtils.collectBoardCoordinates(board)) {
            if (sharedBoardUtils.getCellValue(board, cell.row, cell.col) === 0) empties += 1;
        }
        return empties;
    }

    function countCornerControl(board: any, playerValue: any): { ownCorners: number; oppCorners: number } {
        return sharedBoardUtils.countCornerControl(board, playerValue);
    }

    function countEdgeControl(board: any, playerValue: any): { ownEdges: number; oppEdges: number } {
        return sharedBoardUtils.countEdgeControl(board, playerValue);
    }

    function getBoardBonusValueAt(row: any, col: any, cardState: any): number {
        if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
        if (!cardState || typeof cardState !== 'object') return 0;
        const key = `${row},${col}`;
        if (cardState.boardBonusConsumedByCell && cardState.boardBonusConsumedByCell[key] === true) return 0;
        const raw = Number(cardState.boardBonusByCell && cardState.boardBonusByCell[key]
            ? cardState.boardBonusByCell[key]
            : 0);
        return Number.isFinite(raw) && raw > 0 ? raw : 0;
    }

    function resolveCardType(cardId: any, cardDef: any, cardLogic: any): string {
        if (cardDef && typeof cardDef.type === 'string' && cardDef.type) return cardDef.type;
        if (!cardId || !cardLogic || typeof cardLogic.getCardDef !== 'function') return '';
        try {
            const resolvedCardDef = cardLogic.getCardDef(cardId);
            return (resolvedCardDef && typeof resolvedCardDef.type === 'string') ? resolvedCardDef.type : '';
        } catch (e) {
            return '';
        }
    }

    return {
        countBoardEmpties,
        isStandardBoard8x8: sharedBoardUtils.isStandardBoard8x8,
        isCornerCell: sharedBoardUtils.isCornerCell,
        isEdgeCell: sharedBoardUtils.isEdgeCell,
        countCornerControl,
        countEdgeControl,
        getBoardBonusValueAt,
        resolveCardType
    };
}
