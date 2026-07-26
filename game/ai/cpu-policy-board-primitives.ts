/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CpuPolicyBoard, CpuPolicyMove, CpuPolicyPosition } from './cpu-policy-core-types';
import {
    createCpuCandidateScoringBoardShape,
    scoreCpuCandidateHeuristic,
    type CpuCandidateCellClassification,
    type CpuCandidateScoringBoardShape
} from './cpu-candidate-scoring';

type CpuPolicyBoardShape = CpuPolicyBoard | number | null | undefined;

interface CpuPolicyBoardGeometry {
    maxR: number;
    maxC: number;
}

type CpuPolicyBoardPrimitivesConfig = {
    SharedBoardUtils?: any;
    isFiniteNumber?: (value: unknown) => boolean;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

export function createCpuPolicyBoardPrimitives(config?: CpuPolicyBoardPrimitivesConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuPolicyBoardPrimitivesConfig;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const isFiniteNumber = typeof cfg.isFiniteNumber === 'function' ? cfg.isFiniteNumber : fallbackIsFiniteNumber;

    function resolveBoardGeometry(boardOrRows: CpuPolicyBoardShape, colsMaybe?: number | null): CpuPolicyBoardGeometry {
        if (boardOrRows && typeof boardOrRows === 'object' && !Array.isArray(boardOrRows)
            && sharedBoardUtils && typeof sharedBoardUtils.resolveBoardBounds === 'function') {
            const bounds = sharedBoardUtils.resolveBoardBounds(boardOrRows);
            if (bounds) return { maxR: bounds.maxRow, maxC: bounds.maxCol };
        }
        if (Array.isArray(boardOrRows)) {
            if (boardOrRows.length <= 0) return { maxR: 7, maxC: 7 };
            let maxC = -1;
            for (const oneRow of boardOrRows) {
                if (Array.isArray(oneRow) && oneRow.length > 0) {
                    maxC = Math.max(maxC, oneRow.length - 1);
                }
            }
            if (maxC < 0) maxC = boardOrRows.length - 1;
            return { maxR: boardOrRows.length - 1, maxC };
        }
        const rows = isFiniteNumber(boardOrRows) ? Math.max(1, Math.floor(Number(boardOrRows))) : 8;
        const cols = isFiniteNumber(colsMaybe) ? Math.max(1, Math.floor(Number(colsMaybe))) : rows;
        return { maxR: rows - 1, maxC: cols - 1 };
    }

    function isCorner(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
        if (sharedBoardUtils && typeof sharedBoardUtils.isCorner === 'function') {
            return sharedBoardUtils.isCorner(row, col, boardOrRows, colsMaybe);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
        return (row === 0 || row === geom.maxR) && (col === 0 || col === geom.maxC);
    }

    function isEdge(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
        if (sharedBoardUtils && typeof sharedBoardUtils.isEdge === 'function') {
            return sharedBoardUtils.isEdge(row, col, boardOrRows, colsMaybe);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
        return row === 0 || row === geom.maxR || col === 0 || col === geom.maxC;
    }

    function isXSquare(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
        if (sharedBoardUtils && typeof sharedBoardUtils.isXSquare === 'function') {
            return sharedBoardUtils.isXSquare(row, col, boardOrRows, colsMaybe);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
        if (geom.maxR < 2 || geom.maxC < 2) return false;
        const nearTopBottomRows = row === 1 || row === (geom.maxR - 1);
        const nearLeftRightCols = col === 1 || col === (geom.maxC - 1);
        return nearTopBottomRows && nearLeftRightCols;
    }

    function isCSquare(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
        if (sharedBoardUtils && typeof sharedBoardUtils.isCSquare === 'function') {
            return sharedBoardUtils.isCSquare(row, col, boardOrRows, colsMaybe);
        }
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
        if (geom.maxR < 2 || geom.maxC < 2) return false;
        const nearTopBottom = (row === 0 || row === geom.maxR) && (col === 1 || col === (geom.maxC - 1));
        const nearLeftRight = (col === 0 || col === geom.maxC) && (row === 1 || row === (geom.maxR - 1));
        return nearTopBottom || nearLeftRight;
    }

    function scoreMoveHeuristic(move: CpuPolicyMove, level = 1, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): number {
        const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
        const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
        const flips = Array.isArray(move.flips) ? move.flips.length : 0;
        return scoreCpuCandidateHeuristic({
            level,
            flipCount: flips,
            isCorner: isCorner(row, col, boardOrRows, colsMaybe),
            isEdge: isEdge(row, col, boardOrRows, colsMaybe),
            isXSquare: isXSquare(row, col, boardOrRows, colsMaybe),
            isCSquare: isCSquare(row, col, boardOrRows, colsMaybe)
        });
    }

    function createCandidateScoringBoardShape(
        candidateMoves: CpuPolicyMove[],
        boardOrRows?: CpuPolicyBoardShape,
        colsMaybe?: number | null
    ): CpuCandidateScoringBoardShape {
        const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
        const tieMaxR = geom.maxR >= 0 ? geom.maxR : 7;
        const tieMaxC = geom.maxC >= 0 ? geom.maxC : 7;
        const classifications: CpuCandidateCellClassification[] = (Array.isArray(candidateMoves) ? candidateMoves : []).map((move) => {
            const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
            const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
            return {
                row,
                col,
                isCorner: isCorner(row, col, boardOrRows, colsMaybe),
                isEdge: isEdge(row, col, boardOrRows, colsMaybe),
                isXSquare: isXSquare(row, col, boardOrRows, colsMaybe),
                isCSquare: isCSquare(row, col, boardOrRows, colsMaybe)
            };
        });
        return createCpuCandidateScoringBoardShape(tieMaxR, tieMaxC, classifications);
    }

    function cloneBoard(board: CpuPolicyBoard | null | undefined): CpuPolicyBoard {
        if (sharedBoardUtils && typeof sharedBoardUtils.cloneBoard === 'function') {
            return sharedBoardUtils.cloneBoard(board);
        }
        if (!Array.isArray(board)) return [];
        return board.map((row) => Array.isArray(row) ? row.slice() : []);
    }

    function inBoard(board: CpuPolicyBoard | null | undefined, row: number, col: number): boolean {
        if (sharedBoardUtils && typeof sharedBoardUtils.hasPlayableCell === 'function') {
            return sharedBoardUtils.hasPlayableCell(board, row, col);
        }
        return (
            Array.isArray(board) &&
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= 0 &&
            row < board.length &&
            Array.isArray(board[row]) &&
            col >= 0 &&
            col < board[row].length
        );
    }

    function getFlipsBasic(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): CpuPolicyMove['flips'] {
        if (sharedBoardUtils && typeof sharedBoardUtils.getFlipsBasic === 'function') {
            return sharedBoardUtils.getFlipsBasic(board, row, col, playerValue);
        }
        throw new Error('SharedBoardUtils.getFlipsBasic is required by CPU board primitives');
    }

    function getLegalMovesBasic(board: CpuPolicyBoard | null | undefined, playerValue: number): CpuPolicyMove[] {
        if (sharedBoardUtils && typeof sharedBoardUtils.getLegalMovesBasic === 'function') {
            return sharedBoardUtils.getLegalMovesBasic(board, playerValue);
        }
        throw new Error('SharedBoardUtils.getLegalMovesBasic is required by CPU board primitives');
    }

    function applyMoveToBoard(board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number): CpuPolicyBoard {
        const out = cloneBoard(board);
        if (!move || !inBoard(out, move.row, move.col)) return out;
        if (sharedBoardUtils && typeof sharedBoardUtils.setCellValue === 'function') {
            sharedBoardUtils.setCellValue(out, move.row, move.col, playerValue);
        } else {
            out[move.row][move.col] = playerValue;
        }
        const flips: CpuPolicyPosition[] = Array.isArray(move.flips) && move.flips.length > 0
            ? move.flips
            : (getFlipsBasic(out, move.row, move.col, playerValue) || []);
        for (const one of flips) {
            if (!one || !inBoard(out, one.row, one.col)) continue;
            if (sharedBoardUtils && typeof sharedBoardUtils.setCellValue === 'function') {
                sharedBoardUtils.setCellValue(out, one.row, one.col, playerValue);
            } else {
                out[one.row][one.col] = playerValue;
            }
        }
        return out;
    }

    return {
        resolveBoardGeometry,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        scoreMoveHeuristic,
        createCandidateScoringBoardShape,
        cloneBoard,
        inBoard,
        getFlipsBasic,
        getLegalMovesBasic,
        applyMoveToBoard
    };
}
