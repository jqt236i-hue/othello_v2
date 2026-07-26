import { normalizeBoardPositionsStrict } from '../../shared/board/move-codec';

type PendingTargetDeps = {
    resolveSharedBoardUtilsModule?: () => any;
    getCurrentCpuBoard?: () => any;
    getBoardCellValueSafe?: (board: any, row: any, col: any) => any;
    cloneBoardForCpu?: (board: any) => any;
    setBoardCellValue?: (board: any, row: any, col: any, value: any) => any;
    setBoardCellValues?: (
        board: any,
        updates: Array<{ row: number; col: number; value: number }>
    ) => boolean;
    pendingTargetSelector?: any;
    scorePendingTargetByType?: (playerKey: any, pendingType: any, target: any, pending: any) => any;
    cpuDecisionPendingOnnx?: any;
    resolveCpuCardPolicyLevelFromLevel?: (level: any) => any;
};

export function getCornerProximity(row: any, col: any, boardOverride: any, deps?: PendingTargetDeps): any {
    const activeDeps = deps || {};
    const board = boardOverride && typeof boardOverride === 'object'
        ? boardOverride
        : (typeof activeDeps.getCurrentCpuBoard === 'function' ? activeDeps.getCurrentCpuBoard() : null);
    const boardUtils = typeof activeDeps.resolveSharedBoardUtilsModule === 'function'
        ? activeDeps.resolveSharedBoardUtilsModule()
        : null;
    if (!board || !boardUtils) return null;
    if (typeof boardUtils.getCornerProximity === 'function') {
        return boardUtils.getCornerProximity(row, col, board);
    }
    if (typeof boardUtils.getCornerCells !== 'function') return null;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    const isX = typeof boardUtils.isXSquare === 'function'
        ? boardUtils.isXSquare(row, col, board)
        : false;
    const isC = !isX && typeof boardUtils.isCSquare === 'function'
        ? boardUtils.isCSquare(row, col, board)
        : false;
    if (!isX && !isC) return null;

    const getCell = typeof activeDeps.getBoardCellValueSafe === 'function'
        ? activeDeps.getBoardCellValueSafe
        : ((source: any, r: any, c: any) => (Array.isArray(source) && Array.isArray(source[r]) ? source[r][c] : null));
    const corners = boardUtils.getCornerCells(board);
    for (const corner of corners) {
        if (!corner || !Number.isInteger(corner.row) || !Number.isInteger(corner.col)) continue;
        for (const vertical of [-1, 1]) {
            for (const horizontal of [-1, 1]) {
                const verticalCell = getCell(board, corner.row + vertical, corner.col);
                const horizontalCell = getCell(board, corner.row, corner.col + horizontal);
                if (verticalCell !== null || horizontalCell !== null) continue;
                const inwardRow = corner.row - vertical;
                const inwardCol = corner.col - horizontal;
                if (isX && inwardRow === row && inwardCol === col) {
                    return { kind: 'X', corner: [corner.row, corner.col] };
                }
                if (isC && (
                    (inwardRow === row && corner.col === col) ||
                    (corner.row === row && inwardCol === col)
                )) {
                    return { kind: 'C', corner: [corner.row, corner.col] };
                }
            }
        }
    }
    return null;
}

export function getForcedCornerLaneBonus(pendingType: any, row: any, col: any, board: any, playerValue: any, deps?: PendingTargetDeps): any {
    const activeDeps = deps || {};
    if (!board || typeof board !== 'object') return 0;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const getCell = activeDeps.getBoardCellValueSafe;
    if (typeof getCell !== 'function' || getCell(board, row, col) !== playerValue) return 0;
    const boardUtils = typeof activeDeps.resolveSharedBoardUtilsModule === 'function'
        ? activeDeps.resolveSharedBoardUtilsModule()
        : null;
    const bounds = boardUtils && typeof boardUtils.resolveBoardBounds === 'function'
        ? boardUtils.resolveBoardBounds(board)
        : null;
    if (!bounds) return 0;
    if (col !== bounds.minCol && col !== bounds.maxCol) return 0;

    if (String(pendingType || '') === 'BUOYANCY_WILL' || String(pendingType || '') === 'SUPER_BUOYANCY_WILL') {
        if (row <= bounds.minRow) return 0;
        return getCell(board, bounds.minRow, col) === 0 ? 2600 : 0;
    }
    if (String(pendingType || '') === 'GRAVITY_WILL' || String(pendingType || '') === 'SUPER_GRAVITY_WILL') {
        if (row >= bounds.maxRow) return 0;
        return getCell(board, bounds.maxRow, col) === 0 ? 2600 : 0;
    }
    return 0;
}

export function getForcedCornerLaneAntiPatternPenalty(pendingType: any, row: any, col: any, board: any, playerValue: any, deps?: PendingTargetDeps): any {
    const activeDeps = deps || {};
    if (!board || typeof board !== 'object') return 0;
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const getCell = activeDeps.getBoardCellValueSafe;
    if (typeof getCell !== 'function') return 0;
    const targetCell = getCell(board, row, col);
    if (targetCell === null || targetCell === playerValue) return 0;
    const type = String(pendingType || '');
    const boardUtils = typeof activeDeps.resolveSharedBoardUtilsModule === 'function'
        ? activeDeps.resolveSharedBoardUtilsModule()
        : null;
    const bounds = boardUtils && typeof boardUtils.resolveBoardBounds === 'function'
        ? boardUtils.resolveBoardBounds(board)
        : null;
    if (!bounds) return 0;

    if (type === 'BUOYANCY_WILL' || type === 'SUPER_BUOYANCY_WILL') {
        if (row <= bounds.minRow) return 0;
        const landingCorner =
            (col === bounds.minCol) ? [bounds.minRow, bounds.minCol] :
            (col === bounds.maxCol ? [bounds.minRow, bounds.maxCol] : null);
        if (!landingCorner) return 0;
        return getCell(board, landingCorner[0], landingCorner[1]) === 0 ? -5200 : 0;
    }
    if (type === 'GRAVITY_WILL' || type === 'SUPER_GRAVITY_WILL') {
        if (row >= bounds.maxRow) return 0;
        const landingCorner =
            (col === bounds.minCol) ? [bounds.maxRow, bounds.minCol] :
            (col === bounds.maxCol ? [bounds.maxRow, bounds.maxCol] : null);
        if (!landingCorner) return 0;
        return getCell(board, landingCorner[0], landingCorner[1]) === 0 ? -5200 : 0;
    }
    return 0;
}

export function simulatePendingPlacementBoard(board: any, playerValue: any, target: any, deps?: PendingTargetDeps): any {
    const activeDeps = deps || {};
    if (!board || typeof board !== 'object') return null;
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return null;
    const cloneBoard = typeof activeDeps.cloneBoardForCpu === 'function'
        ? activeDeps.cloneBoardForCpu
        : ((source: any) => source.map((row: any) => (Array.isArray(row) ? row.slice() : [])));
    const setCell = typeof activeDeps.setBoardCellValue === 'function'
        ? activeDeps.setBoardCellValue
        : ((source: any, row: any, col: any, value: any) => {
            if (!Array.isArray(source) || !Array.isArray(source[row])) return false;
            source[row][col] = value;
            return true;
        });
    const next = cloneBoard(board);
    const flips = normalizeBoardPositionsStrict(
        Array.isArray(target.flips) ? target.flips : []
    );
    if (!flips) return null;
    const updates = [
        { row: target.row, col: target.col, value: playerValue },
        ...flips.map((flip) => ({
            row: flip.row,
            col: flip.col,
            value: playerValue
        }))
    ];
    if (typeof activeDeps.setBoardCellValues === 'function') {
        return activeDeps.setBoardCellValues(next, updates) ? next : null;
    }
    if (!setCell(next, target.row, target.col, playerValue)) return null;
    for (const one of flips) {
        if (!setCell(next, one.row, one.col, playerValue)) return null;
    }
    return next;
}

export function choosePendingTargetWithPolicy(playerKey: any, pendingType: any, targets: any, pending: any, deps?: PendingTargetDeps): any {
    const activeDeps = deps || {};
    if (
        activeDeps.pendingTargetSelector &&
        typeof activeDeps.pendingTargetSelector.choosePendingTargetWithPolicy === 'function'
    ) {
        return activeDeps.pendingTargetSelector.choosePendingTargetWithPolicy({
            playerKey,
            pendingType,
            pending,
            targets,
            scoreTarget: (target: any) => (
                typeof activeDeps.scorePendingTargetByType === 'function'
                    ? activeDeps.scorePendingTargetByType(playerKey, pendingType, target, pending)
                    : Number.NEGATIVE_INFINITY
            )
        });
    }

    if (!Array.isArray(targets) || targets.length <= 0) return null;
    let best: any = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const one of targets) {
        const score = typeof activeDeps.scorePendingTargetByType === 'function'
            ? activeDeps.scorePendingTargetByType(playerKey, pendingType, one, pending)
            : Number.NEGATIVE_INFINITY;
        if (score > bestScore) {
            bestScore = score;
            best = one;
            continue;
        }
        if (score === bestScore && best) {
            const row = Number(one && one.row);
            const col = Number(one && one.col);
            const bestRow = Number(best && best.row);
            const bestCol = Number(best && best.col);
            if (row < bestRow || (row === bestRow && col < bestCol)) {
                best = one;
            }
        }
    }
    return best || targets[0];
}

export function buildPendingTargetOnnxContext(playerKey: any, level: any, pendingType: any, targets: any, deps?: PendingTargetDeps): any {
    const activeDeps = deps || {};
    const policyLevel = typeof activeDeps.resolveCpuCardPolicyLevelFromLevel === 'function'
        ? activeDeps.resolveCpuCardPolicyLevelFromLevel(level)
        : level;
    return activeDeps.cpuDecisionPendingOnnx && typeof activeDeps.cpuDecisionPendingOnnx.buildPendingTargetOnnxContext === 'function'
        ? activeDeps.cpuDecisionPendingOnnx.buildPendingTargetOnnxContext(playerKey, policyLevel, pendingType, targets)
        : {};
}

export function choosePendingTargetWithPolicyAsync(playerKey: any, pendingType: any, targets: any, pending: any, deps?: PendingTargetDeps): Promise<any> {
    const activeDeps = deps || {};
    return activeDeps.cpuDecisionPendingOnnx && typeof activeDeps.cpuDecisionPendingOnnx.choosePendingTargetWithPolicyAsync === 'function'
        ? activeDeps.cpuDecisionPendingOnnx.choosePendingTargetWithPolicyAsync(playerKey, pendingType, targets, pending)
        : Promise.resolve(Array.isArray(targets) && targets.length ? targets[0] : null);
}
