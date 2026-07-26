import type { CpuPolicyBoard, CpuPolicyPosition } from './cpu-policy-core-types';

type CpuPolicyLookaheadParityDeps = {
    SharedBoardUtils?: any;
    inBoard?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => boolean;
};

type CpuPolicyParityFeature = {
    regionCount: number;
    oddRegionCount: number;
    evenRegionCount: number;
    oddEmptyCount: number;
    evenEmptyCount: number;
    signal: number;
    score: number;
};

function fallbackInBoard(board: CpuPolicyBoard | null | undefined, row: number, col: number): boolean {
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

export function createCpuPolicyLookaheadParity(deps?: CpuPolicyLookaheadParityDeps) {
    const SharedBoardUtils = deps?.SharedBoardUtils || null;
    const inBoard = typeof deps?.inBoard === 'function' ? deps.inBoard : fallbackInBoard;

    function collectEmptyRegionParity(board: CpuPolicyBoard | null | undefined): CpuPolicyParityFeature {
        const out: CpuPolicyParityFeature = {
            regionCount: 0,
            oddRegionCount: 0,
            evenRegionCount: 0,
            oddEmptyCount: 0,
            evenEmptyCount: 0,
            signal: 0,
            score: 0
        };
        if (!board || typeof board !== 'object') return out;

        const visited = new Set<string>();
        const dirs = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1]
        ];

        const cells = (
            SharedBoardUtils &&
            typeof SharedBoardUtils.collectBoardCoordinates === 'function'
        )
            ? SharedBoardUtils.collectBoardCoordinates(board)
            : null;

        const iter = Array.isArray(cells)
            ? cells
            : (Array.isArray(board)
                ? board.flatMap((row, r) => (Array.isArray(row) ? row.map((_, c) => ({ row: r, col: c })) : []))
                : []);

        for (const cell of iter) {
            const r = Number(cell && cell.row);
            const c = Number(cell && cell.col);
            const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                ? SharedBoardUtils.getCellValue(board, r, c)
                : (Array.isArray(board[r]) ? board[r][c] : null);
            if (value !== 0) continue;
            const rootKey = `${r},${c}`;
            if (visited.has(rootKey)) continue;

            let size = 0;
            const stack: CpuPolicyPosition[] = [{ row: r, col: c }];
            visited.add(rootKey);
            while (stack.length > 0) {
                const current = stack.pop();
                if (!current) break;
                const cr = current.row;
                const cc = current.col;
                size += 1;
                for (const d of dirs) {
                    const nr = cr + d[0];
                    const nc = cc + d[1];
                    const nextValue = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                        ? SharedBoardUtils.getCellValue(board, nr, nc)
                        : (inBoard(board, nr, nc) ? board[nr][nc] : null);
                    if (!inBoard(board, nr, nc) || nextValue !== 0) continue;
                    const nextKey = `${nr},${nc}`;
                    if (visited.has(nextKey)) continue;
                    visited.add(nextKey);
                    stack.push({ row: nr, col: nc });
                }
            }

            out.regionCount += 1;
            if ((size % 2) === 1) {
                out.oddRegionCount += 1;
                out.oddEmptyCount += size;
            } else {
                out.evenRegionCount += 1;
                out.evenEmptyCount += size;
            }
        }

        return out;
    }

    function resolveLookaheadParityFeature(board: CpuPolicyBoard | null | undefined, empties: number): CpuPolicyParityFeature {
        const parity = collectEmptyRegionParity(board);
        if (!Number.isFinite(empties) || empties <= 0 || empties > 20 || parity.regionCount <= 0) {
            return Object.assign(parity, {
                signal: 0,
                score: 0
            });
        }

        const signal = (parity.oddRegionCount % 2 === 1) ? 1 : -1;
        const baseWeight = empties <= 8 ? 960 : (empties <= 12 ? 720 : (empties <= 16 ? 520 : 320));
        const oddRegionBias = Math.min(180, parity.oddRegionCount * 45);
        return Object.assign(parity, {
            signal,
            score: (signal * baseWeight) + (signal * oddRegionBias)
        });
    }

    function resolveForcedPassFeature(ownMoves: number, oppMoves: number, empties: number): { signal: number; score: number } {
        const noOwnMoves = !Number.isFinite(ownMoves) || ownMoves <= 0;
        const noOppMoves = !Number.isFinite(oppMoves) || oppMoves <= 0;
        if (noOwnMoves === noOppMoves) {
            return {
                signal: 0,
                score: 0
            };
        }
        const weight = empties <= 8 ? 2400 : (empties <= 14 ? 1650 : (empties <= 24 ? 980 : 460));
        return {
            signal: noOwnMoves ? -1 : 1,
            score: noOwnMoves ? -weight : weight
        };
    }

    return {
        collectEmptyRegionParity,
        resolveLookaheadParityFeature,
        resolveForcedPassFeature
    };
}
