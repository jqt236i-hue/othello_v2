/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CpuPolicyBoard } from './cpu-policy-core-types';

type CpuPolicyBoardCountsConfig = {
    SharedBoardUtils?: any;
    isFiniteNumber?: (value: unknown) => boolean;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

export function createCpuPolicyBoardCounts(config?: CpuPolicyBoardCountsConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuPolicyBoardCountsConfig;
    const sharedBoardUtils = cfg.SharedBoardUtils || null;
    const isFiniteNumber = typeof cfg.isFiniteNumber === 'function' ? cfg.isFiniteNumber : fallbackIsFiniteNumber;

    function countBoardDiscsForPlayer(board: CpuPolicyBoard | null | undefined, playerValue: number): { own: number; opp: number; empties: number } {
        if (
            sharedBoardUtils &&
            typeof sharedBoardUtils.collectBoardCoordinates === 'function' &&
            typeof sharedBoardUtils.getCellValue === 'function'
        ) {
            let own = 0;
            let opp = 0;
            let empties = 0;
            for (const cell of sharedBoardUtils.collectBoardCoordinates(board)) {
                const v = sharedBoardUtils.getCellValue(board, cell.row, cell.col);
                if (v === playerValue) own += 1;
                else if (v === -playerValue) opp += 1;
                else if (v === 0) empties += 1;
            }
            return { own, opp, empties };
        }
        if (!Array.isArray(board)) return { own: 0, opp: 0, empties: 0 };
        let own = 0;
        let opp = 0;
        let empties = 0;
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (v === playerValue) own += 1;
                else if (v === -playerValue) opp += 1;
                else if (v === 0) empties += 1;
            }
        }
        return { own, opp, empties };
    }

    function countBoardEdgeDiscsForPlayer(board: CpuPolicyBoard | null | undefined, playerValue: number): { ownEdges: number; oppEdges: number } {
        if (sharedBoardUtils && typeof sharedBoardUtils.countEdgeControl === 'function') {
            return sharedBoardUtils.countEdgeControl(board, playerValue);
        }
        if (!Array.isArray(board) || board.length <= 0) return { ownEdges: 0, oppEdges: 0 };
        const maxRow = board.length - 1;
        let ownEdges = 0;
        let oppEdges = 0;
        for (let row = 0; row < board.length; row++) {
            const line = Array.isArray(board[row]) ? board[row] : [];
            if (line.length <= 0) continue;
            const maxCol = line.length - 1;
            for (let col = 0; col < line.length; col++) {
                const isEdge = row === 0 || row === maxRow || col === 0 || col === maxCol;
                const isCorner = (row === 0 || row === maxRow) && (col === 0 || col === maxCol);
                if (!isEdge || isCorner) continue;
                const value = line[col];
                if (value === playerValue) ownEdges += 1;
                else if (value === -playerValue) oppEdges += 1;
            }
        }
        return { ownEdges, oppEdges };
    }

    function estimateOwnOppDiscs(discDiff: unknown, empties: unknown, totalCells: unknown): { own: number; opp: number; occupied: number; totalCells: number } {
        const safeTotalCells = isFiniteNumber(totalCells)
            ? Math.max(1, Math.floor(Number(totalCells)))
            : 64;
        const safeEmpties = isFiniteNumber(empties)
            ? Math.max(0, Math.min(safeTotalCells, Math.floor(Number(empties))))
            : 0;
        const occupied = safeTotalCells - safeEmpties;
        const safeDiscDiff = isFiniteNumber(discDiff) ? Number(discDiff) : 0;
        const rawOwn = Math.floor((occupied + safeDiscDiff) / 2);
        const own = Math.max(0, Math.min(occupied, rawOwn));
        const opp = Math.max(0, occupied - own);
        return { own, opp, occupied, totalCells: safeTotalCells };
    }

    return {
        countBoardDiscsForPlayer,
        countBoardEdgeDiscsForPlayer,
        estimateOwnOppDiscs
    };
}
