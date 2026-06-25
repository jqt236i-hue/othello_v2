type CpuDecisionPendingScoreConfig = {
    getCurrentCpuBoard: () => any;
    resolvePlayerValue: (playerKey: any) => any;
    getBoardCellValueSafe: (board: any, row: any, col: any) => any;
    isCornerCell: (row: any, col: any, board?: any) => any;
    isEdgeCell: (row: any, col: any, board?: any) => any;
    countAdjacentCellsByValue: (board: any, row: any, col: any, value: any) => any;
    getBoardBonusValueAt: (row: any, col: any) => any;
    getMarkerProfileAt: (playerKey: any, row: any, col: any) => any;
    getTimedMarkerProfileAt: (playerKey: any, row: any, col: any) => any;
    scoreSeatStrategicValue: (playerKey: any, row: any, col: any, markerProfile: any) => any;
    countBoardStatsForPlayer: (playerValue: any) => any;
    getCornerProximity: (row: any, col: any, boardOverride: any) => any;
    getCpuSmartnessLevel: (playerKey: any) => any;
    getCardState: () => any;
    getCpuPolicyCore: () => any;
    buildMovePlanContext: (playerKey: any, level: any, candidateMoves: any) => any;
    simulatePendingPlacementBoard: (board: any, playerValue: any, target: any) => any;
    getStrongWindLandingProfile: (row: any, col: any) => any;
    getForcedCornerLaneBonus: (pendingType: any, row: any, col: any, board: any, playerValue: any) => any;
    getForcedCornerLaneAntiPatternPenalty: (pendingType: any, row: any, col: any, board: any, playerValue: any) => any;
    isCloneSplitEligibleSource: (playerKey: any, row: any, col: any, markerProfile?: any) => any;
};

function createEmptyMarkerProfile(): any {
    return {
        ownSpecialScore: 0,
        oppSpecialScore: 0,
        ownBombCount: 0,
        oppBombCount: 0
    };
}

export function createCpuDecisionPendingScore(config: CpuDecisionPendingScoreConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionPendingScoreConfig;

    const getBoardCellValueSafe = (board: any, row: any, col: any): any => (
        typeof cfg.getBoardCellValueSafe === 'function' ? cfg.getBoardCellValueSafe(board, row, col) : null
    );
    const isCornerCell = (row: any, col: any, board?: any): any => (
        typeof cfg.isCornerCell === 'function' ? cfg.isCornerCell(row, col, board) : false
    );
    const isEdgeCell = (row: any, col: any, board?: any): any => (
        typeof cfg.isEdgeCell === 'function' ? cfg.isEdgeCell(row, col, board) : false
    );
    const countAdjacentCellsByValue = (board: any, row: any, col: any, value: any): any => (
        typeof cfg.countAdjacentCellsByValue === 'function' ? cfg.countAdjacentCellsByValue(board, row, col, value) : 0
    );
    const getBoardBonusValueAt = (row: any, col: any): any => (
        typeof cfg.getBoardBonusValueAt === 'function' ? cfg.getBoardBonusValueAt(row, col) : 0
    );
    const getMarkerProfileAt = (playerKey: any, row: any, col: any): any => (
        (typeof cfg.getMarkerProfileAt === 'function' && cfg.getMarkerProfileAt(playerKey, row, col)) || createEmptyMarkerProfile()
    );
    const getTimedMarkerProfileAt = (playerKey: any, row: any, col: any): any => (
        typeof cfg.getTimedMarkerProfileAt === 'function' ? cfg.getTimedMarkerProfileAt(playerKey, row, col) : null
    );
    const scoreSeatStrategicValue = (playerKey: any, row: any, col: any, markerProfile: any): any => (
        typeof cfg.scoreSeatStrategicValue === 'function' ? cfg.scoreSeatStrategicValue(playerKey, row, col, markerProfile) : 0
    );
    const countBoardStatsForPlayer = (playerValue: any): any => (
        (typeof cfg.countBoardStatsForPlayer === 'function' && cfg.countBoardStatsForPlayer(playerValue)) || { discDiff: 0 }
    );
    const getCornerProximity = (row: any, col: any, boardOverride: any): any => (
        typeof cfg.getCornerProximity === 'function' ? cfg.getCornerProximity(row, col, boardOverride) : null
    );
    const getStrongWindLandingProfile = (row: any, col: any): any => (
        typeof cfg.getStrongWindLandingProfile === 'function' ? cfg.getStrongWindLandingProfile(row, col) : null
    );
    const getForcedCornerLaneBonus = (pendingType: any, row: any, col: any, board: any, playerValue: any): any => (
        typeof cfg.getForcedCornerLaneBonus === 'function' ? cfg.getForcedCornerLaneBonus(pendingType, row, col, board, playerValue) : 0
    );
    const getForcedCornerLaneAntiPatternPenalty = (pendingType: any, row: any, col: any, board: any, playerValue: any): any => (
        typeof cfg.getForcedCornerLaneAntiPatternPenalty === 'function' ? cfg.getForcedCornerLaneAntiPatternPenalty(pendingType, row, col, board, playerValue) : 0
    );
    const isCloneSplitEligibleSource = (playerKey: any, row: any, col: any, markerProfile?: any): any => (
        typeof cfg.isCloneSplitEligibleSource === 'function' ? cfg.isCloneSplitEligibleSource(playerKey, row, col, markerProfile) : true
    );

    function scorePendingTargetByType(playerKey: any, pendingType: any, target: any, pending: any): any {
        if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) return Number.NEGATIVE_INFINITY;
        const board = typeof cfg.getCurrentCpuBoard === 'function' ? cfg.getCurrentCpuBoard() : null;
        if (!board) return Number.NEGATIVE_INFINITY;

        const playerValue = typeof cfg.resolvePlayerValue === 'function'
            ? cfg.resolvePlayerValue(playerKey)
            : (playerKey === 'black' ? 1 : -1);
        const opponentValue = -playerValue;
        const row = target.row;
        const col = target.col;
        const cell = getBoardCellValueSafe(board, row, col);
        const onBoard = cell !== null;
        const own = onBoard && cell === playerValue;
        const opp = onBoard && cell === opponentValue;
        const empty = onBoard && cell === 0;
        const corner = onBoard && isCornerCell(row, col, board);
        const edge = onBoard && !corner && isEdgeCell(row, col, board);
        const ownAdj = onBoard ? countAdjacentCellsByValue(board, row, col, playerValue) : 0;
        const oppAdj = onBoard ? countAdjacentCellsByValue(board, row, col, opponentValue) : 0;
        const emptyAdj = onBoard ? countAdjacentCellsByValue(board, row, col, 0) : 0;
        const bonus = onBoard ? getBoardBonusValueAt(row, col) : 0;
        const markerProfile = getMarkerProfileAt(playerKey, row, col);
        const timedProfile = onBoard ? getTimedMarkerProfileAt(playerKey, row, col) : null;
        const seatValue = onBoard ? scoreSeatStrategicValue(playerKey, row, col, markerProfile) : 0;
        const stats = countBoardStatsForPlayer(playerValue);
        const discDiff = Number.isFinite(stats.discDiff) ? Number(stats.discDiff) : 0;
        const cornerHint = getCornerProximity(row, col, board);
        const level = typeof cfg.getCpuSmartnessLevel === 'function'
            ? Number(cfg.getCpuSmartnessLevel(playerKey) || 1)
            : 1;
        const cardState = typeof cfg.getCardState === 'function' ? cfg.getCardState() : null;
        const CpuPolicyCore = typeof cfg.getCpuPolicyCore === 'function' ? cfg.getCpuPolicyCore() : null;
        const markers = (cardState && Array.isArray(cardState.markers)) ? cardState.markers : [];

        function hasSpecialMarkerTypeAt(targetRow: any, targetCol: any, markerType: any): any {
            return markers.some((marker: any) => (
                marker &&
                marker.kind === 'specialStone' &&
                marker.row === targetRow &&
                marker.col === targetCol &&
                marker.data &&
                marker.data.type === markerType
            ));
        }

        function scoreBoardShrinkLine(lineCells: any): any {
            if (!Array.isArray(lineCells) || lineCells.length <= 0) return Number.NEGATIVE_INFINITY;
            let lineScore = 0;
            let changeableCount = 0;
            for (const lineCell of lineCells) {
                if (!lineCell || !Number.isInteger(lineCell.row) || !Number.isInteger(lineCell.col)) continue;
                const lineRow = lineCell.row;
                const lineCol = lineCell.col;
                const boardValue = getBoardCellValueSafe(board, lineRow, lineCol);
                if (boardValue === null) continue;
                const lineCorner = isCornerCell(lineRow, lineCol, board);
                const lineEdge = !lineCorner && isEdgeCell(lineRow, lineCol, board);
                const frozen = hasSpecialMarkerTypeAt(lineRow, lineCol, 'FREEZE');
                if (frozen) {
                    lineScore -= 180;
                    continue;
                }
                changeableCount += 1;
                if (boardValue === opponentValue) {
                    lineScore += lineCorner ? 1600 : (lineEdge ? 520 : 180);
                } else if (boardValue === playerValue) {
                    lineScore += lineCorner ? -2600 : (lineEdge ? -320 : -120);
                } else {
                    lineScore += lineCorner ? 260 : (lineEdge ? 120 : 40);
                }
                const lineOwnAdj = countAdjacentCellsByValue(board, lineRow, lineCol, playerValue);
                const lineOppAdj = countAdjacentCellsByValue(board, lineRow, lineCol, opponentValue);
                const lineMarkerProfile = getMarkerProfileAt(playerKey, lineRow, lineCol);
                lineScore += (lineOppAdj - lineOwnAdj) * (lineEdge ? 60 : 34);
                lineScore += (lineMarkerProfile.oppSpecialScore - lineMarkerProfile.ownSpecialScore) * 1.4;
                lineScore += (lineMarkerProfile.oppBombCount - lineMarkerProfile.ownBombCount) * 180;
                lineScore += getBoardBonusValueAt(lineRow, lineCol) * 120;
            }
            if (changeableCount <= 0) return -4000;
            return lineScore + (changeableCount * 140);
        }

        let score = 0;
        const destructiveMarkerScore =
            markerProfile.oppSpecialScore - markerProfile.ownSpecialScore +
            ((markerProfile.oppBombCount - markerProfile.ownBombCount) * 220);

        switch (String(pendingType || '')) {
        case 'FREE_PLACEMENT':
        case 'LAST_RESORT': {
            if (!empty) return -5000;
            const level = typeof cfg.getCpuSmartnessLevel === 'function'
                ? Number(cfg.getCpuSmartnessLevel(playerKey) || 1)
                : 1;
            const isLastResort = String(pendingType || '') === 'LAST_RESORT';
            const placementsRemaining = Math.max(1, Number(pending && pending.placementsRemaining) || (isLastResort ? 3 : 1));
            const flips = Array.isArray(target.flips) ? target.flips.length : 0;

            if (corner) score += 42000;
            else if (edge) score += 8600;
            else score -= 1400;

            score += flips * 420;
            score += bonus * 900;
            score += (oppAdj * 180) - (ownAdj * 110);
            score += (emptyAdj * 70);

            if (cornerHint) {
                const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
                if (cornerCell === 0) {
                    score += cornerHint.kind === 'X' ? -18000 : -11000;
                } else if (cornerCell === playerValue) {
                    score += cornerHint.kind === 'X' ? 1600 : 900;
                }
            }

            const planContext = (CpuPolicyCore && typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function')
                ? cfg.buildMovePlanContext(playerKey, Math.max(4, level), [])
                : null;
            if (planContext && CpuPolicyCore && typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function') {
                const moveLike = {
                    row,
                    col,
                    flips: Array.isArray(target.flips) ? target.flips : []
                };
                let planScore = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(moveLike, planContext) || 0);
                if (!Number.isFinite(planScore)) planScore = 0;
                score += planScore * 0.18;
            }

            const after = typeof cfg.simulatePendingPlacementBoard === 'function'
                ? cfg.simulatePendingPlacementBoard(board, playerValue, target)
                : null;
            if (after && CpuPolicyCore && typeof CpuPolicyCore.scoreMoveForCornerEdgePlan === 'function') {
                const afterContext = {
                    level: Math.max(4, level),
                    board: after,
                    playerValue,
                    ownCharge: (cardState && cardState.charge && Number.isFinite(cardState.charge[playerKey]))
                        ? Number(cardState.charge[playerKey])
                        : 0,
                    boardBonusByCell: (cardState && cardState.boardBonusByCell && typeof cardState.boardBonusByCell === 'object')
                        ? cardState.boardBonusByCell
                        : null,
                    boardBonusConsumedByCell: (cardState && cardState.boardBonusConsumedByCell && typeof cardState.boardBonusConsumedByCell === 'object')
                        ? cardState.boardBonusConsumedByCell
                        : null,
                    reserveRecoveryCardReady: false,
                    reserveRecoveryCardCostGap: 0,
                    hasCornerHoldCardReady: false,
                    pendingType: String(pendingType || ''),
                    pendingPlacementsRemaining: placementsRemaining,
                    preferEdgeRetention: true
                };
                // Penalize spots that likely create immediate corner swing against us.
                let postRisk = Number(CpuPolicyCore.scoreMoveForCornerEdgePlan(
                    { row, col, flips: [] },
                    afterContext
                ) || 0);
                if (!Number.isFinite(postRisk)) postRisk = 0;
                score += postRisk * 0.04;
            }

            if (isLastResort) {
                if (placementsRemaining >= 2) {
                    if (!corner && !edge && bonus <= 0) score -= 2000;
                    score += (discDiff <= -8 ? 320 : 0);
                } else {
                    score += flips * 220;
                    if (discDiff <= -6) score += 280;
                    if (discDiff >= 8 && !corner && !edge) score -= 420;
                }
            }
            return score;
        }
        case 'DESTROY_ONE_STONE':
            score += opp ? 220 : -260;
            if (corner) score += opp ? 3400 : -4600;
            else if (edge) score += opp ? 900 : -1100;
            score += destructiveMarkerScore * 1.2;
            score += (oppAdj - ownAdj) * 70;
            if (discDiff <= -8 && opp) score += 180;
            if (discDiff >= 8 && own) score -= 180;
            if (empty) score -= 2200;
            return score;
        case 'STRONG_WIND_WILL':
            score += opp ? 180 : -220;
            if (corner) score += opp ? 2200 : -3400;
            else if (edge) score += opp ? 620 : -900;
            score += destructiveMarkerScore * 0.9;
            score += (oppAdj - ownAdj) * 55;
            score += seatValue * (opp ? 0.14 : -0.08);
            {
                const landingProfile = getStrongWindLandingProfile(row, col);
                if (landingProfile) {
                    score += landingProfile.maxDistance * (opp ? 70 : 40);
                    if (opp) {
                        score -= landingProfile.longestCornerCount * 260;
                        score -= landingProfile.longestEdgeCount * 80;
                        score -= landingProfile.longestRiskCount * 55;
                        score -= landingProfile.averageBonus * 90;
                    } else if (own) {
                        score += landingProfile.longestCornerCount * 360;
                        score += landingProfile.longestEdgeCount * 90;
                        score += landingProfile.averageBonus * 110;
                        score -= landingProfile.longestRiskCount * 40;
                    }
                }
            }
            if (discDiff >= 6 && own) score -= 220;
            return score;
        case 'BUOYANCY_WILL':
        case 'SUPER_BUOYANCY_WILL':
        case 'GRAVITY_WILL':
        case 'SUPER_GRAVITY_WILL':
        case 'SUPER_ATTRACTION_WILL':
            score += opp ? 220 : -260;
            if (corner) score += opp ? 2800 : -3800;
            else if (edge) score += opp ? 840 : -1100;
            score += getForcedCornerLaneBonus(pendingType, row, col, board, playerValue);
            score += getForcedCornerLaneAntiPatternPenalty(pendingType, row, col, board, playerValue);
            if (own) {
                if (edge) score += 560;
                if (corner) score -= 1200;
            }
            if (opp) {
                if (corner) score -= 3200;
                else if (edge) score -= 920;
            }
            score += destructiveMarkerScore * 1.15;
            score += (oppAdj - ownAdj) * 80;
            if (discDiff >= 6 && own) score -= 260;
            return score;
        case 'SWAP_WITH_ENEMY':
            if (!corner || !opp) return -1000000;
            score += opp ? 260 : -600;
            if (corner) score += opp ? 3600 : -2600;
            else if (edge) score += opp ? 1100 : -900;
            score += destructiveMarkerScore * 1.3;
            score += (oppAdj - ownAdj) * 120;
            score += seatValue * 0.18;
            if (discDiff <= -8) score += 200;
            return score;
        case 'POSITION_SWAP_WILL': {
            const first = pending && pending.firstTarget ? pending.firstTarget : null;
            if (first && Number.isInteger(first.row) && Number.isInteger(first.col)) {
                const firstCell = getBoardCellValueSafe(board, first.row, first.col);
                const firstOwn = firstCell === playerValue;
                const firstOpp = firstCell === opponentValue;
                const firstMarkerProfile = getMarkerProfileAt(playerKey, first.row, first.col);
                const firstSeatValue = scoreSeatStrategicValue(playerKey, first.row, first.col, firstMarkerProfile);
                if (firstOpp) {
                    score += own ? 460 : -500;
                    if (corner && own) score -= 3400;
                    else if (edge && own) score -= 900;
                    else if (own) score += 260;
                    if (own) score += (firstSeatValue - seatValue) * 0.35;
                } else if (firstOwn) {
                    score += opp ? 520 : -520;
                    if (corner && opp) score += 3500;
                    else if (edge && opp) score += 1000;
                    else if (opp) score += 220;
                    if (corner && own) score -= 3200;
                    if (opp) score += (seatValue - firstSeatValue) * 0.35;
                } else {
                    score += opp ? 180 : (own ? -120 : 0);
                }
                score += destructiveMarkerScore;
                return score;
            }
            // First pick: prefer grabbing strong opponent stones first.
            score += opp ? 220 : -160;
            if (corner && opp) score += 2900;
            else if (edge && opp) score += 900;
            if (corner && own) score -= 2600;
            score += destructiveMarkerScore * 1.1;
            score += seatValue * 0.14;
            return score;
        }
        case 'TRAP_WILL':
            if (!own) return -2800;
            if (corner) score -= 1800;
            else if (edge) score += 220;
            score += (oppAdj * 180) - (ownAdj * 60) + (emptyAdj * 30);
            score += markerProfile.ownSpecialScore * 0.3;
            return score;
        case 'GUARD_WILL':
        case 'GUARDIAN_GOD':
            if (!own) return -2800;
            if (corner) score -= 5200;
            else if (edge) score += 360;
            score += bonus * 110;
            score += (ownAdj * 40) + (oppAdj * 20);
            score += markerProfile.ownSpecialScore * 1.15;
            if (timedProfile) {
                score += timedProfile.ownTimedScore * 3.1;
                score += timedProfile.ownRemainingSum * 70;
                score += timedProfile.ownCriticalCount * 380;
                if (timedProfile.ownTimedCount <= 0 && markerProfile.ownSpecialScore <= 0) score -= 2200;
            } else if (markerProfile.ownSpecialScore <= 0) {
                score -= 900;
            }
            // Guard effects are wasted on inherently stable corners. Prefer
            // vulnerable high-value timed stones (work, robot, dragons, observer).
            if (corner) {
                score -= 1800;
                if (timedProfile && timedProfile.ownTimedCount > 0) score -= 1200;
            }
            if (markerProfile.ownSpecialScore >= 260 && (!timedProfile || timedProfile.ownTimedCount <= 0)) {
                score -= 1200;
            }
            if (markerProfile.ownSpecialScore >= 520 && (!timedProfile || timedProfile.ownCriticalCount <= 0)) {
                score -= 800;
            }
            if (timedProfile) {
                if (timedProfile.ownTimedCount > 0) score += 900;
                if (timedProfile.ownCriticalCount > 0) score += 1400;
            }
            return score;
        case 'LIVING_WILL': {
            if (!own) return -2800;
            const hasGuard = hasSpecialMarkerTypeAt(row, col, 'GUARD');
            const hasRegen = hasSpecialMarkerTypeAt(row, col, 'REGEN');
            if (corner) score += 260;
            else if (edge) score += 180;
            score += bonus * 90;
            score += seatValue * 0.12;
            score += markerProfile.ownSpecialScore * 1.85;
            score += (oppAdj * 48) - (ownAdj * 10) + (emptyAdj * 24);
            if (timedProfile) {
                score += timedProfile.ownTimedScore * 2.7;
                score += timedProfile.ownRemainingSum * 48;
                score += timedProfile.ownCriticalCount * 560;
                if (timedProfile.ownTimedCount > 0) score += 820;
                if (timedProfile.ownCriticalCount > 0) score += 1250;
            }
            if (markerProfile.ownSpecialScore <= 0 && (!timedProfile || timedProfile.ownTimedCount <= 0)) {
                score -= 1200;
            }
            if (hasGuard) score -= 700;
            if (hasRegen) score += 460;
            return score;
        }
        case 'EXTEND_LIFE_WILL':
        case 'EXTEND_LIFE_GOD': {
            const isExtendLifeGod = String(pendingType || '') === 'EXTEND_LIFE_GOD';
            if (!own) return -2800;
            if (corner) score += isExtendLifeGod ? 680 : 520;
            else if (edge) score += isExtendLifeGod ? 320 : 220;
            score += markerProfile.ownSpecialScore * (isExtendLifeGod ? 2.8 : 2.0);
            if (timedProfile) {
                score += timedProfile.ownTimedScore * (isExtendLifeGod ? 3.1 : 2.2);
                score += timedProfile.ownRemainingSum * (isExtendLifeGod ? 68 : 52);
                score += timedProfile.ownCriticalCount * (isExtendLifeGod ? 360 : 260);
                score -= timedProfile.oppTimedScore * 1.3;
                if (timedProfile.ownTimedCount <= 0) score -= isExtendLifeGod ? 1800 : 1400;
            }
            score += seatValue * 0.08;
            score += (oppAdj * (isExtendLifeGod ? 52 : 40));
            return score;
        }
        case 'CORROSION_WILL':
            if (!onBoard) return -2800;
            score += markerProfile.oppSpecialScore * 2.2;
            score -= markerProfile.ownSpecialScore * 1.6;
            score += (markerProfile.oppBombCount * 220) - (markerProfile.ownBombCount * 140);
            if (timedProfile) {
                score += timedProfile.oppTimedScore * 2.3;
                score += timedProfile.oppRemainingSum * 60;
                score += timedProfile.oppCriticalCount * 180;
                score -= timedProfile.ownTimedScore * 1.8;
                score -= timedProfile.ownRemainingSum * 46;
                if (timedProfile.oppTimedCount <= 0 && markerProfile.oppSpecialScore <= 0) score -= 1800;
            }
            if (opp) score += 260;
            if (own) score -= 180;
            if (corner) score += opp ? 900 : -900;
            else if (edge) score += opp ? 240 : -240;
            score += seatValue * (opp ? 0.06 : -0.04);
            score += (oppAdj - ownAdj) * 30;
            return score;
        case 'TELEPORT_WILL':
            score += opp ? 160 : -220;
            if (corner) score += opp ? 4200 : -5200;
            else if (edge) score += opp ? 900 : -900;
            score += destructiveMarkerScore;
            score += (oppAdj - ownAdj) * 45;
            return score;
        case 'CELL_TELEPORT_WILL':
            score += opp ? 220 : (own ? -280 : 60);
            if (corner) score += opp ? 3000 : -4200;
            else if (edge) score += opp ? 900 : -1200;
            if (!onBoard) score += opp ? 420 : (own ? -520 : 80);
            score += destructiveMarkerScore * 1.15;
            score += (oppAdj - ownAdj) * 70;
            return score;
        case 'TEMPT_WILL':
        case 'CAPTURE_WILL':
            score += opp ? 300 : -400;
            if (corner) score += opp ? 2600 : -2200;
            else if (edge) score += opp ? 900 : -700;
            score += destructiveMarkerScore * 1.5;
            return score;
        case 'CLONE_WILL':
            if (!own) return -2600;
            if (level >= 6 && !isCloneSplitEligibleSource(playerKey, row, col, markerProfile)) return -8000;
            if (corner) score -= 260;
            else if (edge) score += 120;
            score += (emptyAdj * 165) + (oppAdj * 95) - (ownAdj * 18);
            score += markerProfile.ownSpecialScore * 0.85;
            score += markerProfile.ownBombCount * 180;
            score += seatValue * 0.06;
            if (timedProfile) {
                score += timedProfile.ownTimedScore * 1.05;
                score += timedProfile.ownRemainingSum * 30;
                score += timedProfile.ownTimedCount * 160;
            }
            if (emptyAdj <= 1) score -= 120;
            return score;
        case 'METEOR_WILL':
            score += opp ? 240 : (own ? -260 : 40);
            if (corner) score += opp ? 260 : (own ? -4200 : 260);
            else if (edge) score += opp ? 1000 : (own ? -1100 : 120);
            score += destructiveMarkerScore * 1.4;
            score += (oppAdj - ownAdj) * 90;
            return score;
        case 'CAUSAL_REPLAY_WILL':
            score += 80;
            if (corner) score += 1800;
            else if (edge) score += 420;
            score += Math.max(0, seatValue) * 0.18;
            score += bonus * 100;
            return score;
        case 'BOARD_SHRINK_WILL':
            if (Array.isArray(target.lineCells) && target.lineCells.length > 0) {
                return scoreBoardShrinkLine(target.lineCells);
            }
            score += opp ? 220 : (own ? -280 : 60);
            if (corner) score += opp ? 1400 : (own ? -5200 : 320);
            else if (edge) score += opp ? 820 : (own ? -960 : 180);
            score += destructiveMarkerScore * 1.55;
            score += (oppAdj - ownAdj) * 88;
            score += bonus * 100;
            return score;
        case 'BOARD_SHRINK_GOD': {
            if (Array.isArray(target.lineCells) && target.lineCells.length > 0) {
                return scoreBoardShrinkLine(target.lineCells);
            }
            if (Array.isArray(target.lineTargets) && target.lineTargets.length > 0) {
                let bestLineScore = Number.NEGATIVE_INFINITY;
                for (const lineTarget of target.lineTargets) {
                    const oneLineScore = scoreBoardShrinkLine(lineTarget && lineTarget.lineCells);
                    if (oneLineScore > bestLineScore) bestLineScore = oneLineScore;
                }
                return bestLineScore + (target.lineTargets.length * 60);
            }
            score += corner ? 240 : 40;
            score += destructiveMarkerScore * 0.6;
            return score;
        }
        case 'BLOCKADE_WILL':
            if (!empty && onBoard) score -= 1800;
            if (edge) score += 220;
            if (cornerHint) {
                const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
                if (cornerCell === 0) {
                    score += cornerHint.kind === 'X' ? 900 : 520;
                }
            }
            score += (oppAdj * 130) - (ownAdj * 40);
            if (!onBoard) score += 260;
            return score;
        case 'SEED_WILL':
            if (!empty && onBoard) return -2400;
            if (corner) score -= 1600;
            else if (edge) score += 380;
            else score += 180;
            if (cornerHint) {
                const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
                if (cornerCell === 0) {
                    score += cornerHint.kind === 'X' ? -1400 : -520;
                } else if (cornerCell === playerValue) {
                    score += cornerHint.kind === 'X' ? 220 : 140;
                }
            }
            score += (ownAdj * 85) - (oppAdj * 30);
            score += emptyAdj * 36;
            score += bonus * 110;
            score += seatValue * 0.08;
            if (discDiff <= -8) score += 120;
            if (discDiff >= 10) score -= 90;
            return score;
        case 'WORK_WILL':

            if (!own) return -2800;
            if (corner) score += 2600;
            else if (edge) score += 1680;
            else score -= 1100;
            if (cornerHint) {
                const cornerCell = getBoardCellValueSafe(board, cornerHint.corner[0], cornerHint.corner[1]);
                if (cornerCell === 0) {
                    score += cornerHint.kind === 'X' ? -2200 : -1300;
                }
            }
            score += bonus * 160;
            score += (ownAdj * 80) - (oppAdj * 120);
            if (emptyAdj <= 2) score += 180;
            else if (emptyAdj >= 4) score -= 520;
            if (!corner && !edge && ownAdj <= 1) score -= 640;
            if (!corner && !edge && oppAdj >= ownAdj) score -= 360;
            if (discDiff <= -10) score += 120;
            return score;
        case 'BOARD_EXPANSION_WILL':
        case 'BOARD_EXPANSION_GOD': {
            if (!corner || !opp) return -1000000;
            score += pendingType === 'BOARD_EXPANSION_GOD' ? 3400 : 3000;
            score += Math.max(0, seatValue) * 0.12;
            if (discDiff <= -8) score += 180;
            if (discDiff <= -14) score += 120;
            return score;
        }
        default:
            // Deterministic stable fallback.
            score += (corner ? 12 : 0) + (edge ? 4 : 0) + bonus;
            return score;
        }
    }

    return {
        scorePendingTargetByType
    };
}

module.exports = {
    createCpuDecisionPendingScore
};
