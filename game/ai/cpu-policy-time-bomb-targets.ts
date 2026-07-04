type TimeBombTargetDeps = {
    getCurrentCpuBoard?: () => any;
    getBoardCellValueSafe?: (board: any, row: any, col: any) => any;
    resolvePlayerValue?: (playerKey: any) => any;
    countBoardStatsForPlayer?: (playerValue: any) => any;
    isCornerCell?: (row: any, col: any, board?: any) => any;
    isEdgeCell?: (row: any, col: any, board?: any) => any;
    getMarkerProfileAt?: (playerKey: any, row: any, col: any) => any;
    getTimedMarkerProfileAt?: (playerKey: any, row: any, col: any) => any;
    random?: () => number;
};

function zeroMarkerProfile() {
    return { ownSpecialScore: 0, oppSpecialScore: 0, ownBombCount: 0, oppBombCount: 0 };
}

function zeroTimedProfile() {
    return { ownRemainingSum: 0, oppRemainingSum: 0 };
}

export function scoreTimeBombTarget(playerKey: any, target: any, deps?: TimeBombTargetDeps): any {
    const activeDeps = deps || {};
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return -Infinity;
    const board = typeof activeDeps.getCurrentCpuBoard === 'function' ? activeDeps.getCurrentCpuBoard() : null;
    if (!board) return -Infinity;
    const getCell = activeDeps.getBoardCellValueSafe;
    if (typeof getCell !== 'function' || getCell(board, target.row, target.col) === null) return -Infinity;

    const playerValue = typeof activeDeps.resolvePlayerValue === 'function'
        ? activeDeps.resolvePlayerValue(playerKey)
        : (String(playerKey || '').toLowerCase() === 'black' ? 1 : -1);
    const stats = typeof activeDeps.countBoardStatsForPlayer === 'function'
        ? (activeDeps.countBoardStatsForPlayer(playerValue) || {})
        : {};
    let score = 0;
    let oppCornerHits = 0;
    let ownCornerHits = 0;

    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            const r = target.row + dr;
            const c = target.col + dc;
            const cell = getCell(board, r, c);
            if (cell === null || cell === 0) continue;

            const corner = typeof activeDeps.isCornerCell === 'function' ? activeDeps.isCornerCell(r, c, board) : false;
            const edge = typeof activeDeps.isEdgeCell === 'function' ? activeDeps.isEdgeCell(r, c, board) : false;
            const weight = corner ? 12 : (edge ? 4 : 2);
            const isOwn = cell === playerValue;
            const markerProfile = typeof activeDeps.getMarkerProfileAt === 'function'
                ? activeDeps.getMarkerProfileAt(playerKey, r, c)
                : zeroMarkerProfile();
            const timedProfile = typeof activeDeps.getTimedMarkerProfileAt === 'function'
                ? activeDeps.getTimedMarkerProfileAt(playerKey, r, c)
                : zeroTimedProfile();
            if (isOwn) {
                score -= weight * 100;
                score -= Number(markerProfile.ownSpecialScore || 0) * 0.55;
                score -= Number(markerProfile.ownBombCount || 0) * 160;
                score -= Number(timedProfile.ownRemainingSum || 0) * 36;
                if (corner) ownCornerHits += 1;
            } else {
                score += weight * 100;
                score += Number(markerProfile.oppSpecialScore || 0) * 0.55;
                score += Number(markerProfile.oppBombCount || 0) * 160;
                score += Number(timedProfile.oppRemainingSum || 0) * 36;
                if (corner) oppCornerHits += 1;
            }
        }
    }

    const discDiff = Number(stats.discDiff || 0);
    if (discDiff <= -8) score += 140;
    if (discDiff <= -14) score += 80;
    if (discDiff >= 8) score -= 140;
    if (discDiff >= 12) score -= 70;
    if (oppCornerHits > 0) score += 2400 * oppCornerHits;
    if (ownCornerHits > 0) score -= 3200 * ownCornerHits;
    if (discDiff >= 0 && oppCornerHits <= 0) score -= 220;

    const random = typeof activeDeps.random === 'function' ? activeDeps.random : (() => 0);
    score += random() * 0.01;
    return score;
}

export function chooseTimeBombTargetWithPolicy(playerKey: any, targets: any, deps?: TimeBombTargetDeps): any {
    if (!Array.isArray(targets) || targets.length <= 0) return null;
    let best: any = null;
    let bestScore = -Infinity;
    for (const target of targets) {
        const score = scoreTimeBombTarget(playerKey, target, deps);
        if (score > bestScore) {
            bestScore = score;
            best = target;
        }
    }
    return best || targets[0];
}

