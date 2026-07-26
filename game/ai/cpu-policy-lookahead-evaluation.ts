import type { CpuPolicyBoard, CpuPolicyMove } from './cpu-policy-core-types';

type CpuPolicyLookaheadEvaluationDeps = {
    SharedBoardUtils?: any;
    inBoard?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => boolean;
    isCorner?: (row: number, col: number, boardOrRows?: CpuPolicyBoard | number | null, colsMaybe?: number | null) => boolean;
    isEdge?: (row: number, col: number, boardOrRows?: CpuPolicyBoard | number | null, colsMaybe?: number | null) => boolean;
    countBoardDiscsForPlayer?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => { own: number; opp: number; empties: number };
    countCornersFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    countEdgesFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    getLegalMovesBasic?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyMove[];
    resolveForcedPassFeature?: (ownMoves: number, oppMoves: number, empties: number) => { signal: number; score: number };
    countCornerMovesFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    countXsAndCsFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => { x: number; c: number };
    resolveLookaheadParityFeature?: (board: CpuPolicyBoard | null | undefined, empties: number) => { score: number };
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

function fallbackGetBoardCellValue(
    board: CpuPolicyBoard | null | undefined,
    row: number,
    col: number
): unknown {
    if (!Array.isArray(board)) return null;
    const denseRow = board[row];
    return Array.isArray(denseRow) ? denseRow[col] : null;
}

export function createCpuPolicyLookaheadEvaluation(deps?: CpuPolicyLookaheadEvaluationDeps) {
    const SharedBoardUtils = deps?.SharedBoardUtils || null;
    const inBoard = typeof deps?.inBoard === 'function' ? deps.inBoard : fallbackInBoard;
    const isCorner = typeof deps?.isCorner === 'function' ? deps.isCorner : null;
    const isEdge = typeof deps?.isEdge === 'function' ? deps.isEdge : (() => false);
    const countBoardDiscsForPlayer = typeof deps?.countBoardDiscsForPlayer === 'function'
        ? deps.countBoardDiscsForPlayer
        : (() => ({ own: 0, opp: 0, empties: 0 }));
    const countCornersFor = typeof deps?.countCornersFor === 'function' ? deps.countCornersFor : (() => 0);
    const countEdgesFor = typeof deps?.countEdgesFor === 'function' ? deps.countEdgesFor : (() => 0);
    const getLegalMovesBasic = typeof deps?.getLegalMovesBasic === 'function' ? deps.getLegalMovesBasic : (() => []);
    const resolveForcedPassFeature = typeof deps?.resolveForcedPassFeature === 'function'
        ? deps.resolveForcedPassFeature
        : (() => ({ signal: 0, score: 0 }));
    const countCornerMovesFor = typeof deps?.countCornerMovesFor === 'function' ? deps.countCornerMovesFor : (() => 0);
    const countXsAndCsFor = typeof deps?.countXsAndCsFor === 'function'
        ? deps.countXsAndCsFor
        : (() => ({ x: 0, c: 0 }));
    const resolveLookaheadParityFeature = typeof deps?.resolveLookaheadParityFeature === 'function'
        ? deps.resolveLookaheadParityFeature
        : (() => ({ score: 0 }));

    function countFrontierDiscsFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
        if (!board || typeof board !== 'object') return 0;
        const dirs = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        let count = 0;
        const cells = (
            SharedBoardUtils &&
            typeof SharedBoardUtils.collectBoardCoordinates === 'function'
        )
            ? SharedBoardUtils.collectBoardCoordinates(board)
            : null;
        if (Array.isArray(cells)) {
            for (const cell of cells) {
                if (!cell) continue;
                const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                    ? SharedBoardUtils.getCellValue(board, cell.row, cell.col)
                    : fallbackGetBoardCellValue(board, cell.row, cell.col);
                if (value !== playerValue) continue;
                let frontier = false;
                for (const d of dirs) {
                    const nr = cell.row + d[0];
                    const nc = cell.col + d[1];
                    if (!inBoard(board, nr, nc)) continue;
                    const neighborValue = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                        ? SharedBoardUtils.getCellValue(board, nr, nc)
                        : fallbackGetBoardCellValue(board, nr, nc);
                    if (neighborValue === 0) {
                        frontier = true;
                        break;
                    }
                }
                if (frontier) count += 1;
            }
            return count;
        }
        if (!Array.isArray(board)) return 0;
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < row.length; c++) {
                if (row[c] !== playerValue) continue;
                let frontier = false;
                for (const d of dirs) {
                    const nr = r + d[0];
                    const nc = c + d[1];
                    if (!inBoard(board, nr, nc)) continue;
                    if (board[nr][nc] === 0) {
                        frontier = true;
                        break;
                    }
                }
                if (frontier) count += 1;
            }
        }
        return count;
    }

    function countAnchoredEdgeDiscsFromCorners(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
        if (!board || typeof board !== 'object') return 0;
        const anchored = new Set<string>();
        const corners = (
            SharedBoardUtils &&
            typeof SharedBoardUtils.getCornerCells === 'function'
        )
            ? SharedBoardUtils.getCornerCells(board)
            : (Array.isArray(board) ? [
                { row: 0, col: 0 },
                { row: 0, col: Array.isArray(board[0]) ? (board[0].length - 1) : 0 },
                { row: board.length - 1, col: 0 },
                { row: board.length - 1, col: Array.isArray(board[0]) ? (board[0].length - 1) : 0 }
            ] : []);
        const directions = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1]
        ];
        const pushIfOwn = (r: number, c: number) => {
            const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                ? SharedBoardUtils.getCellValue(board, r, c)
                : fallbackGetBoardCellValue(board, r, c);
            if (inBoard(board, r, c) && value === playerValue) anchored.add(`${r},${c}`);
        };
        const walkLine = (startR: number, startC: number, dr: number, dc: number) => {
            let r = startR;
            let c = startC;
            while (inBoard(board, r, c)) {
                const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                    ? SharedBoardUtils.getCellValue(board, r, c)
                    : fallbackGetBoardCellValue(board, r, c);
                if (value !== playerValue) break;
                anchored.add(`${r},${c}`);
                r += dr;
                c += dc;
            }
        };

        for (const corner of corners) {
            if (!corner || !inBoard(board, corner.row, corner.col)) continue;
            pushIfOwn(corner.row, corner.col);
            const cornerValue = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                ? SharedBoardUtils.getCellValue(board, corner.row, corner.col)
                : fallbackGetBoardCellValue(board, corner.row, corner.col);
            if (cornerValue !== playerValue) continue;
            for (const dir of directions) {
                const nr = corner.row + dir[0];
                const nc = corner.col + dir[1];
                if (!inBoard(board, nr, nc) || !isEdge(nr, nc, board)) continue;
                walkLine(corner.row, corner.col, dir[0], dir[1]);
            }
        }
        return anchored.size;
    }

    function evaluateBoardForLookahead(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
        const disc = countBoardDiscsForPlayer(board, playerValue);
        const discDiff = disc.own - disc.opp;
        const empties = Number.isFinite(disc.empties) ? disc.empties : 0;
        const discWeight = empties <= 10 ? 34 : (empties <= 22 ? 16 : 8);

        const ownCorners = countCornersFor(board, playerValue);
        const oppCorners = countCornersFor(board, -playerValue);
        const cornerDiff = ownCorners - oppCorners;

        const ownEdges = countEdgesFor(board, playerValue);
        const oppEdges = countEdgesFor(board, -playerValue);
        const edgeDiff = ownEdges - oppEdges;

        const ownLegal = getLegalMovesBasic(board, playerValue);
        const oppLegal = getLegalMovesBasic(board, -playerValue);
        const ownMoves = ownLegal.length;
        const oppMoves = oppLegal.length;
        const mobilityDiff = ownMoves - oppMoves;
        const passPressure = resolveForcedPassFeature(ownMoves, oppMoves, empties);
        const ownCornerMoves = isCorner
            ? ownLegal.filter((move) => move && isCorner(move.row, move.col, board)).length
            : countCornerMovesFor(board, playerValue);
        const oppCornerMoves = isCorner
            ? oppLegal.filter((move) => move && isCorner(move.row, move.col, board)).length
            : countCornerMovesFor(board, -playerValue);
        const cornerMobilityDiff = ownCornerMoves - oppCornerMoves;
        const ownFrontier = countFrontierDiscsFor(board, playerValue);
        const oppFrontier = countFrontierDiscsFor(board, -playerValue);
        const frontierDiff = oppFrontier - ownFrontier;
        const ownAnchoredEdges = countAnchoredEdgeDiscsFromCorners(board, playerValue);
        const oppAnchoredEdges = countAnchoredEdgeDiscsFromCorners(board, -playerValue);
        const anchoredEdgeDiff = ownAnchoredEdges - oppAnchoredEdges;

        const ownRisk = countXsAndCsFor(board, playerValue);
        const oppRisk = countXsAndCsFor(board, -playerValue);
        const parityFeature = resolveLookaheadParityFeature(board, empties);

        return (
            (cornerDiff * 3400) +
            (edgeDiff * 180) +
            (anchoredEdgeDiff * 320) +
            (mobilityDiff * 225) +
            passPressure.score +
            (cornerMobilityDiff * 1450) +
            (frontierDiff * 105) +
            (discDiff * discWeight) +
            parityFeature.score +
            ((oppRisk.x - ownRisk.x) * 520) +
            ((oppRisk.c - ownRisk.c) * 230)
        );
    }

    function evaluateTerminalBoardForLookahead(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
        const disc = countBoardDiscsForPlayer(board, playerValue);
        const diff = disc.own - disc.opp;
        if (diff === 0) return 0;
        const score = 1_000_000 + (Math.abs(diff) * 10_000);
        return diff > 0 ? score : -score;
    }

    return {
        countFrontierDiscsFor,
        countAnchoredEdgeDiscsFromCorners,
        evaluateBoardForLookahead,
        evaluateTerminalBoardForLookahead
    };
}
