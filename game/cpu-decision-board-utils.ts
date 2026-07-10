type SharedBoardUtilsPort = {
    isStandardBoard8x8: (board: any) => boolean;
    isCornerCell: (row: any, col: any, board: any) => boolean;
    isEdgeCell: (row: any, col: any, board: any) => boolean;
};

type CpuDecisionBoardUtilsConfig = {
    sharedBoardUtils: SharedBoardUtilsPort;
};

const REQUIRED_SHARED_BOARD_UTILS_METHODS = [
    'isStandardBoard8x8',
    'isCornerCell',
    'isEdgeCell'
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
        if (!Array.isArray(board) || board.length <= 0) return false;
        return board.every((row: any) => Array.isArray(row) && row.length > 0);
    }

    // These counts intentionally retain the pre-refactor CPU semantics.  In
    // particular, they use the raw matrix boundary rather than board-shape
    // metadata; moving them here removes the duplicate root body without
    // changing historical CPU scoring on expanded or ragged boards.
    function countBoardEmpties(board: any): number {
        if (!Array.isArray(board)) return 0;
        let empties = 0;
        for (let row = 0; row < board.length; row += 1) {
            const cells = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < cells.length; col += 1) {
                if (cells[col] === 0) empties += 1;
            }
        }
        return empties;
    }

    function countCornerControl(board: any, playerValue: any): { ownCorners: number; oppCorners: number } {
        if (!isPlayableBoard(board)) return { ownCorners: 0, oppCorners: 0 };
        const maxRow = board.length - 1;
        const maxCol = Array.isArray(board[0]) ? (board[0].length - 1) : maxRow;
        const corners = [
            [0, 0],
            [0, maxCol],
            [maxRow, 0],
            [maxRow, maxCol]
        ];
        let ownCorners = 0;
        let oppCorners = 0;
        for (const [rowIndex, colIndex] of corners) {
            const row = Array.isArray(board[rowIndex]) ? board[rowIndex] : null;
            if (!row || colIndex < 0 || colIndex >= row.length) continue;
            const value = row[colIndex];
            if (value === playerValue) ownCorners += 1;
            else if (value === -playerValue) oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    }

    function countEdgeControl(board: any, playerValue: any): { ownEdges: number; oppEdges: number } {
        if (!isPlayableBoard(board)) return { ownEdges: 0, oppEdges: 0 };
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = 0; row < board.length; row += 1) {
            const cells = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < cells.length; col += 1) {
                if (!sharedBoardUtils.isEdgeCell(row, col, board) || sharedBoardUtils.isCornerCell(row, col, board)) continue;
                const value = cells[col];
                if (value === playerValue) ownEdges += 1;
                else if (value === -playerValue) oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
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
