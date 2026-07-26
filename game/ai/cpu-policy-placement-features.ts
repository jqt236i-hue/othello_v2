import type {
    CpuPolicyBoard,
    CpuPolicyMove,
    CpuPolicyMoveOptions,
    CpuPolicyPlacementFeatures,
    CpuPolicyPlacementSeat,
    CpuPolicyPosition
} from './cpu-policy-core-types';
import { normalizeBoardPositions } from '../../shared/board/move-codec';

interface CpuPolicyEdgeRunSummary extends Record<string, unknown> {
    chainStrength?: number;
    longestRun?: number;
    completeLineCount?: number;
    loneDiscCount?: number;
    segmentCount?: number;
    totalOwnedCells?: number;
}

type CpuPolicyDiscStats = {
    own?: number;
    ownDiscs?: number;
    opp?: number;
    oppDiscs?: number;
    empty?: number;
    empties?: number;
};

type CpuPolicyPlacementFeaturesDeps = {
    isFiniteNumber?: (value: unknown) => boolean;
    isCorner?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isEdge?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isXSquare?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isCSquare?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    adjacentCornerFor?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => CpuPolicyPosition | null;
    getBoardCellValueSafe?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => unknown;
    inBoard?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => boolean;
    applyMoveToBoard?: (board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number) => CpuPolicyBoard;
    getLegalMovesBasic?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyMove[];
    countCornerMovesFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    summarizeEdgeRunsFor?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyEdgeRunSummary;
    countAnchoredEdgeDiscsFromCorners?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
    countBoardDiscsForPlayer?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => CpuPolicyDiscStats;
    getBoardBonusAtCell?: (
        boardBonusByCell: Record<string, number> | null | undefined,
        consumedByCell: Record<string, boolean | number> | null | undefined,
        row: number,
        col: number
    ) => number;
};

function fallbackIsFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function numeric(value: unknown, fallback = 0): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function resolveBoardGeometry(board: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) {
    if (Array.isArray(board)) {
        const maxR = Math.max(0, board.length - 1);
        let maxC = maxR;
        for (const row of board) {
            if (Array.isArray(row)) maxC = Math.max(maxC, row.length - 1);
        }
        return { maxR, maxC };
    }
    const rows = Number.isFinite(Number(board)) ? Math.max(1, Math.floor(Number(board))) : 8;
    const cols = Number.isFinite(Number(colsMaybe)) ? Math.max(1, Math.floor(Number(colsMaybe))) : rows;
    return { maxR: rows - 1, maxC: cols - 1 };
}

function fallbackIsCorner(row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(board, colsMaybe);
    return (row === 0 || row === geom.maxR) && (col === 0 || col === geom.maxC);
}

function fallbackIsEdge(row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(board, colsMaybe);
    return row === 0 || row === geom.maxR || col === 0 || col === geom.maxC;
}

function fallbackIsXSquare(row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(board, colsMaybe);
    if (geom.maxR < 2 || geom.maxC < 2) return false;
    return (row === 1 || row === geom.maxR - 1) && (col === 1 || col === geom.maxC - 1);
}

function fallbackIsCSquare(row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(board, colsMaybe);
    if (geom.maxR < 2 || geom.maxC < 2) return false;
    return (
        ((row === 0 || row === geom.maxR) && (col === 1 || col === geom.maxC - 1)) ||
        ((col === 0 || col === geom.maxC) && (row === 1 || row === geom.maxR - 1))
    );
}

function fallbackAdjacentCornerFor(row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null): CpuPolicyPosition | null {
    const geom = resolveBoardGeometry(board, colsMaybe);
    const rowNearTop = row === 1;
    const rowNearBottom = row === geom.maxR - 1;
    const colNearLeft = col === 1;
    const colNearRight = col === geom.maxC - 1;
    if ((rowNearTop || rowNearBottom) && (colNearLeft || colNearRight)) {
        return { row: rowNearTop ? 0 : geom.maxR, col: colNearLeft ? 0 : geom.maxC };
    }
    if ((row === 0 || row === geom.maxR) && (colNearLeft || colNearRight)) {
        return { row, col: colNearLeft ? 0 : geom.maxC };
    }
    if ((col === 0 || col === geom.maxC) && (rowNearTop || rowNearBottom)) {
        return { row: rowNearTop ? 0 : geom.maxR, col };
    }
    return null;
}

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

function fallbackGetBoardCellValueSafe(board: CpuPolicyBoard | null | undefined, row: number, col: number): unknown {
    return fallbackInBoard(board, row, col) ? board![row][col] : null;
}

function fallbackApplyMoveToBoard(board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number): CpuPolicyBoard {
    const out = Array.isArray(board) ? board.map((row) => (Array.isArray(row) ? row.slice() : [])) : [];
    if (!move || !fallbackInBoard(out, move.row, move.col)) return out;
    out[move.row][move.col] = playerValue;
    const flips = normalizeBoardPositions(move.flips);
    for (const one of flips) {
        if (one && fallbackInBoard(out, one.row, one.col)) out[one.row][one.col] = playerValue;
    }
    return out;
}

function collectEdgeLines(board: CpuPolicyBoard | null | undefined): number[][] {
    if (!Array.isArray(board) || board.length <= 0) return [];
    const { maxR, maxC } = resolveBoardGeometry(board);
    const top = Array.from({ length: maxC + 1 }, (_, col) => numeric(fallbackGetBoardCellValueSafe(board, 0, col)));
    const bottom = Array.from({ length: maxC + 1 }, (_, col) => numeric(fallbackGetBoardCellValueSafe(board, maxR, col)));
    const left = Array.from({ length: maxR + 1 }, (_, row) => numeric(fallbackGetBoardCellValueSafe(board, row, 0)));
    const right = Array.from({ length: maxR + 1 }, (_, row) => numeric(fallbackGetBoardCellValueSafe(board, row, maxC)));
    return [top, bottom, left, right];
}

function fallbackSummarizeEdgeRunsFor(board: CpuPolicyBoard | null | undefined, playerValue: number): CpuPolicyEdgeRunSummary {
    let longestRun = 0;
    let chainStrength = 0;
    let totalOwnedCells = 0;
    let segmentCount = 0;
    let loneDiscCount = 0;
    let completeLineCount = 0;
    for (const line of collectEdgeLines(board)) {
        let run = 0;
        let ownedOnLine = 0;
        for (const cell of line) {
            if (cell === playerValue) {
                run += 1;
                ownedOnLine += 1;
                totalOwnedCells += 1;
                continue;
            }
            if (run > 0) {
                segmentCount += 1;
                if (run === 1) loneDiscCount += 1;
                longestRun = Math.max(longestRun, run);
                chainStrength += run;
                run = 0;
            }
        }
        if (run > 0) {
            segmentCount += 1;
            if (run === 1) loneDiscCount += 1;
            longestRun = Math.max(longestRun, run);
            chainStrength += run;
        }
        if (line.length > 0 && ownedOnLine === line.length) completeLineCount += 1;
    }
    return { longestRun, chainStrength, totalOwnedCells, segmentCount, loneDiscCount, completeLineCount };
}

function fallbackCountAnchoredEdgeDiscsFromCorners(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    const { maxR, maxC } = resolveBoardGeometry(board);
    const owned = new Set<string>();
    const scan = (startRow: number, startCol: number, dRow: number, dCol: number) => {
        let row = startRow;
        let col = startCol;
        while (fallbackInBoard(board, row, col) && numeric(fallbackGetBoardCellValueSafe(board, row, col)) === playerValue) {
            owned.add(`${row},${col}`);
            row += dRow;
            col += dCol;
        }
    };
    if (numeric(fallbackGetBoardCellValueSafe(board, 0, 0)) === playerValue) {
        scan(0, 0, 0, 1);
        scan(0, 0, 1, 0);
    }
    if (numeric(fallbackGetBoardCellValueSafe(board, 0, maxC)) === playerValue) {
        scan(0, maxC, 0, -1);
        scan(0, maxC, 1, 0);
    }
    if (numeric(fallbackGetBoardCellValueSafe(board, maxR, 0)) === playerValue) {
        scan(maxR, 0, 0, 1);
        scan(maxR, 0, -1, 0);
    }
    if (numeric(fallbackGetBoardCellValueSafe(board, maxR, maxC)) === playerValue) {
        scan(maxR, maxC, 0, -1);
        scan(maxR, maxC, -1, 0);
    }
    return owned.size;
}

function fallbackCountBoardDiscsForPlayer(board: CpuPolicyBoard | null | undefined, playerValue: number): CpuPolicyDiscStats {
    let own = 0;
    let opp = 0;
    let empties = 0;
    if (Array.isArray(board)) {
        for (const row of board) {
            if (!Array.isArray(row)) continue;
            for (const cell of row) {
                const value = numeric(cell, 0);
                if (value === playerValue) own += 1;
                else if (value === -playerValue) opp += 1;
                else empties += 1;
            }
        }
    }
    return { own, opp, empty: empties, empties };
}

function fallbackGetBoardBonusAtCell(
    boardBonusByCell: Record<string, number> | null | undefined,
    consumedByCell: Record<string, boolean | number> | null | undefined,
    row: number,
    col: number
): number {
    const key = `${row},${col}`;
    if (consumedByCell && consumedByCell[key] === true) return 0;
    return Math.max(0, numeric(boardBonusByCell ? boardBonusByCell[key] : 0));
}

function edgeRunSignal(anchoredCount: number, summary: CpuPolicyEdgeRunSummary): number {
    const longest = numeric(summary.longestRun);
    const chain = numeric(summary.chainStrength);
    return Math.max(anchoredCount, longest, chain);
}

function edgeGapScore(summary: CpuPolicyEdgeRunSummary): number {
    return numeric(summary.segmentCount) + (numeric(summary.loneDiscCount) * 2);
}

function discOwnCount(stats: CpuPolicyDiscStats): number {
    return Math.max(0, numeric(stats.own, numeric(stats.ownDiscs, 0)));
}

function resolveSeat(isCorner: boolean, isEdge: boolean, isXSquare: boolean, isCSquare: boolean): CpuPolicyPlacementSeat {
    if (isCorner) return 'corner';
    if (isXSquare) return 'x';
    if (isCSquare) return 'c';
    if (isEdge) return 'edge';
    return 'inner';
}

function normalizePlayerValue(value: unknown): number {
    return Number(value) < 0 ? -1 : 1;
}

export function createCpuPolicyPlacementFeatures(deps?: CpuPolicyPlacementFeaturesDeps) {
    const isFiniteNumber = typeof deps?.isFiniteNumber === 'function' ? deps.isFiniteNumber : fallbackIsFiniteNumber;
    const isCorner = typeof deps?.isCorner === 'function' ? deps.isCorner : fallbackIsCorner;
    const isEdge = typeof deps?.isEdge === 'function' ? deps.isEdge : fallbackIsEdge;
    const isXSquare = typeof deps?.isXSquare === 'function' ? deps.isXSquare : fallbackIsXSquare;
    const isCSquare = typeof deps?.isCSquare === 'function' ? deps.isCSquare : fallbackIsCSquare;
    const adjacentCornerFor = typeof deps?.adjacentCornerFor === 'function' ? deps.adjacentCornerFor : fallbackAdjacentCornerFor;
    const getBoardCellValueSafe = typeof deps?.getBoardCellValueSafe === 'function' ? deps.getBoardCellValueSafe : fallbackGetBoardCellValueSafe;
    const inBoard = typeof deps?.inBoard === 'function' ? deps.inBoard : fallbackInBoard;
    const applyMoveToBoard = typeof deps?.applyMoveToBoard === 'function' ? deps.applyMoveToBoard : fallbackApplyMoveToBoard;
    const getLegalMovesBasic = typeof deps?.getLegalMovesBasic === 'function' ? deps.getLegalMovesBasic : (() => []);
    const countCornerMovesFor = typeof deps?.countCornerMovesFor === 'function'
        ? deps.countCornerMovesFor
        : ((board: CpuPolicyBoard | null | undefined, playerValue: number) => (
            getLegalMovesBasic(board, playerValue).filter((move) => move && isCorner(move.row, move.col, board)).length
        ));
    const summarizeEdgeRunsFor = typeof deps?.summarizeEdgeRunsFor === 'function' ? deps.summarizeEdgeRunsFor : fallbackSummarizeEdgeRunsFor;
    const countAnchoredEdgeDiscsFromCorners = typeof deps?.countAnchoredEdgeDiscsFromCorners === 'function'
        ? deps.countAnchoredEdgeDiscsFromCorners
        : fallbackCountAnchoredEdgeDiscsFromCorners;
    const countBoardDiscsForPlayer = typeof deps?.countBoardDiscsForPlayer === 'function'
        ? deps.countBoardDiscsForPlayer
        : fallbackCountBoardDiscsForPlayer;
    const getBoardBonusAtCell = typeof deps?.getBoardBonusAtCell === 'function' ? deps.getBoardBonusAtCell : fallbackGetBoardBonusAtCell;

    function evaluatePlacementCandidate(move: CpuPolicyMove, context?: CpuPolicyMoveOptions): CpuPolicyPlacementFeatures {
        const ctx = context && typeof context === 'object' ? context : {};
        const board = ctx.board && typeof ctx.board === 'object' ? ctx.board : null;
        const playerValue = normalizePlayerValue(ctx.playerValue);
        const row = isFiniteNumber(move && move.row) ? Number(move.row) : -1;
        const col = isFiniteNumber(move && move.col) ? Number(move.col) : -1;
        const cornerMove = isCorner(row, col, board);
        const edgeMove = isEdge(row, col, board);
        const xSquare = isXSquare(row, col, board);
        const cSquare = !xSquare && isCSquare(row, col, board);
        const seat = resolveSeat(cornerMove, edgeMove, xSquare, cSquare);
        const boardBonus = getBoardBonusAtCell(
            ctx.boardBonusByCell || null,
            ctx.boardBonusConsumedByCell || null,
            row,
            col
        );
        const moveFlips = move && Array.isArray(move.flips) ? move.flips : [];
        const flipCount = moveFlips.length;
        const adjacentCorner = adjacentCornerFor(row, col, board);
        const adjacentCornerEmpty = !!(
            adjacentCorner &&
            inBoard(board, adjacentCorner.row, adjacentCorner.col) &&
            numeric(getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col), 0) === 0
        );
        const isOpenCornerAdjacentRisk = adjacentCornerEmpty && (xSquare || cSquare);

        const ownEdgeBefore = summarizeEdgeRunsFor(board, playerValue);
        const oppEdgeBefore = summarizeEdgeRunsFor(board, -playerValue);
        const ownAnchoredBefore = countAnchoredEdgeDiscsFromCorners(board, playerValue);
        const oppAnchoredBefore = countAnchoredEdgeDiscsFromCorners(board, -playerValue);
        const ownSafeEdgeRunBefore = edgeRunSignal(ownAnchoredBefore, ownEdgeBefore);
        const opponentSafeEdgeRunBefore = edgeRunSignal(oppAnchoredBefore, oppEdgeBefore);
        const ownEdgeGapBefore = edgeGapScore(ownEdgeBefore);

        const after = applyMoveToBoard(board, move, playerValue);
        const ownEdgeAfter = summarizeEdgeRunsFor(after, playerValue);
        const oppEdgeAfter = summarizeEdgeRunsFor(after, -playerValue);
        const ownAnchoredAfter = countAnchoredEdgeDiscsFromCorners(after, playerValue);
        const oppAnchoredAfter = countAnchoredEdgeDiscsFromCorners(after, -playerValue);
        const ownSafeEdgeRunAfter = edgeRunSignal(ownAnchoredAfter, ownEdgeAfter);
        const opponentSafeEdgeRunAfter = edgeRunSignal(oppAnchoredAfter, oppEdgeAfter);
        const ownAnchoredEdgeDelta = ownAnchoredAfter - ownAnchoredBefore;
        const ownSafeEdgeRunDelta = ownSafeEdgeRunAfter - ownSafeEdgeRunBefore;
        const directOpponentSafeEdgeRunDelta = opponentSafeEdgeRunAfter - opponentSafeEdgeRunBefore;
        const ownEdgeGapAfter = edgeGapScore(ownEdgeAfter);
        const ownEdgeGapDelta = ownEdgeGapAfter - ownEdgeGapBefore;
        const extendsOwnSafeEdge = ownAnchoredEdgeDelta > 0 || (edgeMove && ownSafeEdgeRunDelta >= 2);
        const createsOwnEdgeGap = edgeMove && !cornerMove && ownEdgeGapDelta > 0 && !extendsOwnSafeEdge;
        const breaksOpponentEdgeRun = directOpponentSafeEdgeRunDelta < 0;

        const opponentMoves = getLegalMovesBasic(after, -playerValue);
        const opponentCornerReplyCount = Math.max(
            countCornerMovesFor(after, -playerValue),
            opponentMoves.filter((candidate) => candidate && isCorner(candidate.row, candidate.col, after)).length
        );
        let opponentSafeEdgeRunAllowedCount = 0;
        let maxOpponentReplySafeEdgeDelta = 0;
        for (const opponentMove of opponentMoves) {
            if (!opponentMove) continue;
            const afterOpponent = applyMoveToBoard(after, opponentMove, -playerValue);
            const oppReplyAnchored = countAnchoredEdgeDiscsFromCorners(afterOpponent, -playerValue);
            const oppReplySummary = summarizeEdgeRunsFor(afterOpponent, -playerValue);
            const replySafeEdgeRun = edgeRunSignal(oppReplyAnchored, oppReplySummary);
            const replyDelta = replySafeEdgeRun - opponentSafeEdgeRunAfter;
            if (replyDelta > 0) {
                maxOpponentReplySafeEdgeDelta = Math.max(maxOpponentReplySafeEdgeDelta, replyDelta);
            }
            if (replyDelta >= 2 || (oppReplyAnchored - oppAnchoredAfter) > 0) {
                opponentSafeEdgeRunAllowedCount += 1;
            }
        }
        const opponentSafeEdgeRunDelta = maxOpponentReplySafeEdgeDelta > 0
            ? maxOpponentReplySafeEdgeDelta
            : directOpponentSafeEdgeRunDelta;
        const opponentNextCorner = opponentCornerReplyCount > 0;
        const cornerDonation = !cornerMove && opponentNextCorner;
        const allowsOpponentSafeEdgeRun = opponentSafeEdgeRunAllowedCount > 0;
        const ownLegalMoves = getLegalMovesBasic(after, playerValue);
        const ownCornerReplyCount = Math.max(
            countCornerMovesFor(after, playerValue),
            ownLegalMoves.filter((candidate) => candidate && isCorner(candidate.row, candidate.col, after)).length
        );
        const ownDiscCountAfter = discOwnCount(countBoardDiscsForPlayer(after, playerValue));
        const lowMobilityRisk = ownLegalMoves.length <= 2 || ownDiscCountAfter <= 4;
        const hasCornerEscape = ownCornerReplyCount > 0;
        const hasSafeEdgeEscape = cornerMove || extendsOwnSafeEdge || breaksOpponentEdgeRun;
        const badLowMobilityRisk = lowMobilityRisk && !hasCornerEscape && !hasSafeEdgeEscape;

        return {
            row,
            col,
            playerValue,
            seat,
            isCorner: cornerMove,
            isEdge: edgeMove && !cornerMove,
            isInner: !cornerMove && !edgeMove && !xSquare && !cSquare,
            isCSquare: cSquare,
            isXSquare: xSquare,
            isOpenCornerAdjacentRisk,
            cornerTaken: cornerMove,
            cornerDonation,
            opponentNextCorner,
            opponentCornerReplyCount,
            ownSafeEdgeRunBefore,
            ownSafeEdgeRunAfter,
            ownSafeEdgeRunDelta,
            ownAnchoredEdgeBefore: ownAnchoredBefore,
            ownAnchoredEdgeAfter: ownAnchoredAfter,
            ownAnchoredEdgeDelta,
            extendsOwnSafeEdge,
            opponentSafeEdgeRunBefore,
            opponentSafeEdgeRunAfter,
            opponentSafeEdgeRunDelta,
            opponentSafeEdgeRunAllowedCount,
            allowsOpponentSafeEdgeRun,
            breaksOpponentEdgeRun,
            ownEdgeGapBefore,
            ownEdgeGapAfter,
            ownEdgeGapDelta,
            createsOwnEdgeGap,
            boardBonus,
            flipCount,
            ownDiscCountAfter,
            ownLegalMovesAfter: ownLegalMoves.length,
            hasCornerEscape,
            lowMobilityRisk,
            badLowMobilityRisk
        };
    }

    function evaluatePlacementCandidates(moves: CpuPolicyMove[], context?: CpuPolicyMoveOptions): CpuPolicyPlacementFeatures[] {
        return Array.isArray(moves) ? moves.map((move) => evaluatePlacementCandidate(move, context)) : [];
    }

    return {
        evaluatePlacementCandidate,
        evaluatePlacementCandidates
    };
}
