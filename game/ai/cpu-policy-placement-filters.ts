type PlacementFilterDeps = {
    placementPriority?: any;
    getCornerProximity?: (row: any, col: any, board: any) => any;
    getBoardCellValueSafe?: (board: any, row: any, col: any) => any;
    isCornerCell?: (row: any, col: any, board?: any) => any;
    getCurrentCpuBoard?: () => any;
    resolvePlayerValue?: (playerKey: any) => any;
    getMarkerProfileAt?: (playerKey: any, row: any, col: any) => any;
    resolveCpuCardPolicyLevelForPlayer?: (playerKey: any) => any;
};

function isOpenCornerAdjacentCell(row: any, col: any, board: any, deps: PlacementFilterDeps): boolean {
    if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return false;
    if (typeof deps.isCornerCell === 'function' && deps.isCornerCell(row, col, board)) return false;
    if (typeof deps.getCornerProximity !== 'function') return false;
    const cornerHint = deps.getCornerProximity(row, col, board);
    if (!cornerHint || !Array.isArray(cornerHint.corner)) return false;
    if (typeof deps.getBoardCellValueSafe !== 'function') return false;
    return deps.getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]) === 0;
}

export function filterLv6OpenCornerAdjacentMoves(candidateMoves: any, board: any, deps?: PlacementFilterDeps): any {
    const activeDeps = deps || {};
    if (
        activeDeps.placementPriority &&
        typeof activeDeps.placementPriority.filterLv6OpenCornerAdjacentMoves === 'function'
    ) {
        return activeDeps.placementPriority.filterLv6OpenCornerAdjacentMoves(candidateMoves, board);
    }
    if (!Array.isArray(candidateMoves) || candidateMoves.length <= 1 || !Array.isArray(board)) return candidateMoves;
    const safeMoves = candidateMoves.filter((move: any) => {
        if (!move) return false;
        const row = Number(move.row);
        const col = Number(move.col);
        if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
        return !isOpenCornerAdjacentCell(row, col, board, activeDeps);
    });
    return safeMoves.length > 0 ? safeMoves : candidateMoves;
}

export function filterMovesByLv6PlacementPriority(playerKey: any, level: any, candidateMoves: any, deps?: PlacementFilterDeps): any {
    const activeDeps = deps || {};
    if (
        activeDeps.placementPriority &&
        typeof activeDeps.placementPriority.filterMovesByLv6PlacementPriority === 'function'
    ) {
        return activeDeps.placementPriority.filterMovesByLv6PlacementPriority(playerKey, level, candidateMoves);
    }
    return Array.isArray(candidateMoves) ? candidateMoves : [];
}

export function isCloneSplitEligibleSource(
    playerKey: any,
    row: any,
    col: any,
    markerProfile?: any,
    deps?: PlacementFilterDeps
): any {
    const activeDeps = deps || {};
    const board = typeof activeDeps.getCurrentCpuBoard === 'function' ? activeDeps.getCurrentCpuBoard() : null;
    const playerValue = typeof activeDeps.resolvePlayerValue === 'function'
        ? activeDeps.resolvePlayerValue(playerKey)
        : (String(playerKey || '').toLowerCase() === 'black' ? 1 : -1);
    if (typeof activeDeps.getBoardCellValueSafe !== 'function') return false;
    if (activeDeps.getBoardCellValueSafe(board, row, col) !== playerValue) return false;

    const profile = markerProfile || (
        typeof activeDeps.getMarkerProfileAt === 'function'
            ? activeDeps.getMarkerProfileAt(playerKey, row, col)
            : null
    );
    if (!profile || typeof profile !== 'object') return false;
    return (
        Number(profile.ownSpecialScore || 0) > 0 ||
        Number(profile.oppSpecialScore || 0) > 0 ||
        Number(profile.ownBombCount || 0) > 0 ||
        Number(profile.oppBombCount || 0) > 0
    );
}

export function filterCloneSplitTargetsForLv6(playerKey: any, targets: any, deps?: PlacementFilterDeps): any {
    const activeDeps = deps || {};
    if (!Array.isArray(targets) || targets.length <= 0) return [];
    const level = typeof activeDeps.resolveCpuCardPolicyLevelForPlayer === 'function'
        ? activeDeps.resolveCpuCardPolicyLevelForPlayer(playerKey)
        : 6;
    if (level < 6) return targets;
    return targets.filter((target: any) => {
        if (!target) return false;
        return isCloneSplitEligibleSource(playerKey, target.row, target.col, undefined, activeDeps);
    });
}

