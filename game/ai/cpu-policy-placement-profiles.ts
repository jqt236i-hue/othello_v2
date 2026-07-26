import type { CpuPolicyBoard, CpuPolicyMove, CpuPolicyPosition } from './cpu-policy-core-types';

type CpuPolicyPlacementProfilesDeps = {
    getBoardCellValueSafe?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => unknown;
    inBoard?: (board: CpuPolicyBoard | null | undefined, row: number, col: number) => boolean;
    isCorner?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isEdge?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isXSquare?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    isCSquare?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => boolean;
    adjacentCornerFor?: (row: number, col: number, board?: CpuPolicyBoard | number | null | undefined, colsMaybe?: number | null) => CpuPolicyPosition | null;
    applyMoveToBoard?: (board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number) => CpuPolicyBoard;
    countAnchoredEdgeDiscsFromCorners?: (board: CpuPolicyBoard | null | undefined, playerValue: number) => number;
};

function fallbackStrikeProfile() {
    return {
        oppAdjCount: 0,
        oppCornerCount: 0,
        oppEdgeCount: 0
    };
}

export function createCpuPolicyPlacementProfiles(deps?: CpuPolicyPlacementProfilesDeps) {
    const getBoardCellValueSafe = typeof deps?.getBoardCellValueSafe === 'function' ? deps.getBoardCellValueSafe : (() => null);
    const inBoard = typeof deps?.inBoard === 'function' ? deps.inBoard : (() => false);
    const isCorner = typeof deps?.isCorner === 'function' ? deps.isCorner : (() => false);
    const isEdge = typeof deps?.isEdge === 'function' ? deps.isEdge : (() => false);
    const isXSquare = typeof deps?.isXSquare === 'function' ? deps.isXSquare : (() => false);
    const isCSquare = typeof deps?.isCSquare === 'function' ? deps.isCSquare : (() => false);
    const adjacentCornerFor = typeof deps?.adjacentCornerFor === 'function' ? deps.adjacentCornerFor : (() => null);
    const applyMoveToBoard = typeof deps?.applyMoveToBoard === 'function' ? deps.applyMoveToBoard : ((board: any) => board);
    const countAnchoredEdgeDiscsFromCorners = typeof deps?.countAnchoredEdgeDiscsFromCorners === 'function'
        ? deps.countAnchoredEdgeDiscsFromCorners
        : (() => 0);

    function countAdjacentCellsByValue(board: CpuPolicyBoard | null | undefined, row: number, col: number, value: number): number {
        if (!board || typeof board !== 'object' || !Number.isInteger(row) || !Number.isInteger(col)) return 0;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = row + dr;
                const nc = col + dc;
                if (getBoardCellValueSafe(board, nr, nc) === value) count += 1;
            }
        }
        return count;
    }

    function computePlacementStabilityProxy(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): number {
        if (!board || typeof board !== 'object' || !inBoard(board, row, col)) return 0;
        let score = 0;
        if (isCorner(row, col, board)) score += 4.2;
        else if (isEdge(row, col, board)) score += 2.1;
        else score -= 0.8;

        if (isXSquare(row, col, board)) score -= 2.8;
        if (isCSquare(row, col, board)) score -= 1.7;

        const ownAdj = countAdjacentCellsByValue(board, row, col, playerValue);
        const oppAdj = countAdjacentCellsByValue(board, row, col, -playerValue);
        const emptyAdj = countAdjacentCellsByValue(board, row, col, 0);
        score += (ownAdj * 0.65);
        score += (oppAdj * 0.2);
        score -= (emptyAdj * 0.75);

        const adjacentCorner = adjacentCornerFor(row, col, board);
        if (adjacentCorner && inBoard(board, adjacentCorner.row, adjacentCorner.col)) {
            const cornerVal = getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col);
            if (cornerVal === playerValue) score += 1.5;
            else if (cornerVal === -playerValue) score -= 0.6;
        }

        return score;
    }

    function evaluateMoveStabilityProfile(
        board: CpuPolicyBoard | null | undefined,
        move: CpuPolicyMove | null | undefined,
        playerValue: number,
        ownAnchoredEdgesBefore?: number | null
    ): { stabilityProxy: number; anchoredEdgeDelta: number } {
        if (!board || typeof board !== 'object' || !move) {
            return {
                stabilityProxy: Number.NEGATIVE_INFINITY,
                anchoredEdgeDelta: Number.NEGATIVE_INFINITY
            };
        }
        const row = Number(move.row);
        const col = Number(move.col);
        if (!Number.isInteger(row) || !Number.isInteger(col) || !inBoard(board, row, col)) {
            return {
                stabilityProxy: Number.NEGATIVE_INFINITY,
                anchoredEdgeDelta: Number.NEGATIVE_INFINITY
            };
        }
        const after = applyMoveToBoard(board, move, playerValue);
        const anchoredBefore = Number.isFinite(ownAnchoredEdgesBefore)
            ? Number(ownAnchoredEdgesBefore)
            : countAnchoredEdgeDiscsFromCorners(board, playerValue);
        return {
            stabilityProxy: computePlacementStabilityProxy(after, row, col, playerValue),
            anchoredEdgeDelta: countAnchoredEdgeDiscsFromCorners(after, playerValue) - anchoredBefore
        };
    }

    function countAdjacentOpponentStrikeProfile(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number) {
        const out = fallbackStrikeProfile();
        if (!board || typeof board !== 'object' || !inBoard(board, row, col)) return out;
        const opponentValue = -playerValue;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const targetRow = row + dr;
                const targetCol = col + dc;
                if (getBoardCellValueSafe(board, targetRow, targetCol) !== opponentValue) continue;
                out.oppAdjCount += 1;
                if (isCorner(targetRow, targetCol, board)) out.oppCornerCount += 1;
                else if (isEdge(targetRow, targetCol, board)) out.oppEdgeCount += 1;
            }
        }
        return out;
    }

    function collectUltimateHyperactiveLandingProfile(
        board: CpuPolicyBoard | null | undefined,
        row: number,
        col: number,
        playerValue: number,
        maxDistance?: number | null
    ) {
        const out = {
            count: 0,
            maxDistance: 0,
            longRangeCount: 0,
            enemyAdjSum: 0,
            cornerPressureCount: 0,
            edgeLandingCount: 0
        };
        if (!board || typeof board !== 'object' || !inBoard(board, row, col)) return out;
        const opponentValue = -playerValue;
        const normalizedMaxDistance = Number(maxDistance);
        const maxRange = Number.isInteger(normalizedMaxDistance) && normalizedMaxDistance > 0 ? normalizedMaxDistance : 5;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                for (let distance = 1; distance <= maxRange; distance++) {
                    const targetRow = row + (dr * distance);
                    const targetCol = col + (dc * distance);
                    if (!inBoard(board, targetRow, targetCol)) break;
                    if (getBoardCellValueSafe(board, targetRow, targetCol) !== 0) continue;
                    out.count += 1;
                    if (distance > out.maxDistance) out.maxDistance = distance;
                    if (distance >= 3) out.longRangeCount += 1;
                    out.enemyAdjSum += countAdjacentCellsByValue(board, targetRow, targetCol, opponentValue);
                    if (isEdge(targetRow, targetCol, board)) out.edgeLandingCount += 1;
                    const strike = countAdjacentOpponentStrikeProfile(board, targetRow, targetCol, playerValue);
                    if (strike.oppCornerCount > 0) out.cornerPressureCount += 1;
                }
            }
        }
        return out;
    }

    return {
        countAdjacentCellsByValue,
        computePlacementStabilityProxy,
        evaluateMoveStabilityProfile,
        countAdjacentOpponentStrikeProfile,
        collectUltimateHyperactiveLandingProfile
    };
}
