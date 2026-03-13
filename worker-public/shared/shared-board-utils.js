(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SharedBoardUtils = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
    'use strict';

    function resolveBoardBounds(boardOrRows, maybeCols) {
        if (Array.isArray(boardOrRows)) {
            if (boardOrRows.length <= 0) return null;
            let maxCol = -1;
            for (const row of boardOrRows) {
                if (Array.isArray(row) && row.length > 0) {
                    maxCol = Math.max(maxCol, row.length - 1);
                }
            }
            if (maxCol < 0) return null;
            return { maxRow: boardOrRows.length - 1, maxCol };
        }
        const rows = Number.isFinite(boardOrRows) ? Math.max(1, Math.floor(boardOrRows)) : 8;
        const cols = Number.isFinite(maybeCols) ? Math.max(1, Math.floor(maybeCols)) : rows;
        return { maxRow: rows - 1, maxCol: cols - 1 };
    }

    function isStandardBoard8x8(board) {
        if (!Array.isArray(board) || board.length !== 8) return false;
        for (const row of board) {
            if (!Array.isArray(row) || row.length !== 8) return false;
        }
        return true;
    }

    function countBoardEmpties(board) {
        if (!Array.isArray(board)) return 0;
        let empties = 0;
        for (let row = 0; row < board.length; row++) {
            const oneRow = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < oneRow.length; col++) {
                if (oneRow[col] === 0) empties += 1;
            }
        }
        return empties;
    }

    function isCornerCell(row, col, boardOrRows, maybeCols) {
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            (row === 0 || row === bounds.maxRow) &&
            (col === 0 || col === bounds.maxCol)
        );
    }

    function isEdgeCell(row, col, boardOrRows, maybeCols) {
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            (row === 0 || row === bounds.maxRow || col === 0 || col === bounds.maxCol)
        );
    }

    function isCorner(row, col, boardOrRows, maybeCols) {
        return isCornerCell(row, col, boardOrRows, maybeCols);
    }

    function isEdge(row, col, boardOrRows, maybeCols) {
        return isEdgeCell(row, col, boardOrRows, maybeCols);
    }

    function isXSquare(row, col, boardOrRows, maybeCols) {
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        return (
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            (row === 1 || row === (bounds.maxRow - 1)) &&
            (col === 1 || col === (bounds.maxCol - 1))
        );
    }

    function isCSquare(row, col, boardOrRows, maybeCols) {
        const bounds = resolveBoardBounds(boardOrRows, maybeCols);
        if (!bounds) return false;
        const nearTopBottom = (row === 0 || row === bounds.maxRow) && (col === 1 || col === (bounds.maxCol - 1));
        const nearLeftRight = (col === 0 || col === bounds.maxCol) && (row === 1 || row === (bounds.maxRow - 1));
        return nearTopBottom || nearLeftRight;
    }

    function isInBounds(board, row, col) {
        return (
            Array.isArray(board) &&
            row >= 0 &&
            row < board.length &&
            Array.isArray(board[row]) &&
            col >= 0 &&
            col < board[row].length
        );
    }

    function getFlipsBasic(board, row, col, playerValue) {
        if (!isInBounds(board, row, col)) return [];
        if (board[row][col] !== 0) return [];
        const dirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        const out = [];
        for (const dir of dirs) {
            const temp = [];
            let currentRow = row + dir[0];
            let currentCol = col + dir[1];
            while (isInBounds(board, currentRow, currentCol) && board[currentRow][currentCol] === -playerValue) {
                temp.push({ row: currentRow, col: currentCol });
                currentRow += dir[0];
                currentCol += dir[1];
            }
            if (temp.length > 0 && isInBounds(board, currentRow, currentCol) && board[currentRow][currentCol] === playerValue) {
                out.push(...temp);
            }
        }
        return out;
    }

    function getLegalMovesBasic(board, playerValue) {
        if (!Array.isArray(board)) return [];
        const moves = [];
        for (let row = 0; row < board.length; row++) {
            const oneRow = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < oneRow.length; col++) {
                const flips = getFlipsBasic(board, row, col, playerValue);
                if (flips.length > 0) moves.push({ row, col, flips });
            }
        }
        return moves;
    }

    function countCornerControl(board, playerValue) {
        if (!Array.isArray(board) || board.length <= 0) return { ownCorners: 0, oppCorners: 0 };
        const bounds = resolveBoardBounds(board);
        if (!bounds) return { ownCorners: 0, oppCorners: 0 };
        const corners = [
            [0, 0],
            [0, bounds.maxCol],
            [bounds.maxRow, 0],
            [bounds.maxRow, bounds.maxCol]
        ];
        let ownCorners = 0;
        let oppCorners = 0;
        for (const point of corners) {
            if (!isInBounds(board, point[0], point[1])) continue;
            const value = board[point[0]][point[1]];
            if (value === playerValue) ownCorners += 1;
            else if (value === -playerValue) oppCorners += 1;
        }
        return { ownCorners, oppCorners };
    }

    function countEdgeControl(board, playerValue) {
        if (!Array.isArray(board) || board.length <= 0) return { ownEdges: 0, oppEdges: 0 };
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = 0; row < board.length; row++) {
            const oneRow = Array.isArray(board[row]) ? board[row] : [];
            for (let col = 0; col < oneRow.length; col++) {
                if (!isEdgeCell(row, col, board) || isCornerCell(row, col, board)) continue;
                const value = oneRow[col];
                if (value === playerValue) ownEdges += 1;
                else if (value === -playerValue) oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
    }

    return {
        resolveBoardBounds,
        isStandardBoard8x8,
        countBoardEmpties,
        isCornerCell,
        isEdgeCell,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        getFlipsBasic,
        getLegalMovesBasic,
        countCornerControl,
        countEdgeControl
    };
}));