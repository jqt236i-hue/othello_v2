/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayScoreTargetChoosersConfig = {
    CardLogic?: any;
    choosePendingTargetByScore?: (targets: any[], scoreFn: (target: any) => number) => any;
    evaluatePositionValue?: (row: any, col: any, boardOrSize?: any) => number;
    toPlayerValue?: (playerKey: any) => any;
    getCellOwnerValueForSelfplay?: (gameState: any, row: any, col: any) => any;
    isCorner?: (row: any, col: any, board?: any) => boolean;
    isEdge?: (row: any, col: any, board?: any) => boolean;
    countDiscsByValue?: (gameState: any, playerValue: any) => number;
};

function getCorrosionMarkerTypeWeight(type: any) {
    if (type === 'WORK') return 2800;
    if (type === 'GUARD') return 2400;
    if (type === 'BLOCKADE') return 2200;
    if (type === 'REGEN') return 1800;
    if (type === 'ULTIMATE_DESTROY_GOD') return 2600;
    if (type === 'ULTIMATE_HYPERACTIVE_GOD') return 2400;
    if (type === 'HYPERACTIVE') return 1400;
    return 900;
}

export function createSelfplayScoreTargetChoosers(config?: SelfplayScoreTargetChoosersConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayScoreTargetChoosersConfig;
    const cardLogic = cfg.CardLogic || null;
    const choosePendingTargetByScore = typeof cfg.choosePendingTargetByScore === 'function'
        ? cfg.choosePendingTargetByScore
        : (() => null);
    const evaluatePositionValue = typeof cfg.evaluatePositionValue === 'function'
        ? cfg.evaluatePositionValue
        : (() => 0);
    const toPlayerValue = typeof cfg.toPlayerValue === 'function'
        ? cfg.toPlayerValue
        : ((playerKey: any) => playerKey);
    const getCellOwnerValueForSelfplay = typeof cfg.getCellOwnerValueForSelfplay === 'function'
        ? cfg.getCellOwnerValueForSelfplay
        : (() => 0);
    const isCorner = typeof cfg.isCorner === 'function'
        ? cfg.isCorner
        : (() => false);
    const isEdge = typeof cfg.isEdge === 'function'
        ? cfg.isEdge
        : (() => false);
    const countDiscsByValue = typeof cfg.countDiscsByValue === 'function'
        ? cfg.countDiscsByValue
        : (() => 0);

    function chooseCorrosionTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const rawTargets = (typeof cardLogic.getCorrosionTargets === 'function')
            ? (cardLogic.getCorrosionTargets(cardState, gameState, playerKey) || [])
            : (cardLogic.getSelectableTargets(cardState, gameState, playerKey) || []);
        if (!rawTargets.length) return null;

        const targets = [];
        const seen = new Set();
        for (const one of rawTargets) {
            if (!one || !Number.isInteger(one.row) || !Number.isInteger(one.col)) continue;
            const key = `${one.row},${one.col}`;
            if (seen.has(key)) continue;
            seen.add(key);
            targets.push(one);
        }
        if (!targets.length) return null;

        const markers = cardState && Array.isArray(cardState.markers) ? cardState.markers : [];
        const selfVal = toPlayerValue(playerKey);
        return choosePendingTargetByScore(targets, (target: any) => {
            let score = evaluatePositionValue(target.row, target.col) * 0.15;

            for (const marker of markers) {
                if (!marker || marker.kind !== 'specialStone') continue;
                if (marker.row !== target.row || marker.col !== target.col) continue;
                if (!marker.data || !Number.isFinite(marker.data.remainingOwnerTurns)) continue;

                const remaining = Number(marker.data.remainingOwnerTurns);
                if (remaining <= 0) continue;

                const type = typeof marker.data.type === 'string' ? marker.data.type : '';
                const magnitude = getCorrosionMarkerTypeWeight(type) + (remaining * 280);
                if (marker.owner === playerKey) score -= magnitude;
                else score += magnitude;
            }

            const occupant = getCellOwnerValueForSelfplay(gameState, target.row, target.col);
            if (occupant === -selfVal) score += 180;
            else if (occupant === selfVal) score -= 160;

            if (isCorner(target.row, target.col)) score += (occupant === -selfVal) ? 700 : -700;
            else if (isEdge(target.row, target.col)) score += (occupant === -selfVal) ? 220 : -220;

            score += (rng && typeof rng.random === 'function') ? (rng.random() * 0.01) : 0;
            return score;
        });
    }

    function chooseTemptTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const targets = cardLogic.getSelectableTargets(cardState, gameState, playerKey) || [];
        if (!targets.length) return null;
        return choosePendingTargetByScore(
            targets,
            (target: any) => evaluatePositionValue(target.row, target.col) + rng.random() * 0.01
        );
    }

    function chooseCaptureTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        return chooseTemptTarget(gameState, cardState, playerKey, rng);
    }

    function scoreTimeBombTarget(gameState: any, playerKey: any, target: any, rng: any) {
        if (!gameState || !Array.isArray(gameState.board) || !target) return -Infinity;
        const board = gameState.board;
        const size = board.length;
        if (!Number.isInteger(target.row) || !Number.isInteger(target.col)) return -Infinity;
        if (target.row < 0 || target.col < 0 || target.row >= size || target.col >= size) return -Infinity;

        const playerValue = toPlayerValue(playerKey);
        const discDiff = countDiscsByValue(gameState, playerValue);
        let score = 0;
        let oppCornerHits = 0;
        let ownCornerHits = 0;

        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const row = target.row + dr;
                const col = target.col + dc;
                if (row < 0 || col < 0 || row >= board.length || col >= board[row].length) continue;
                const cell = board[row][col];
                if (cell === 0) continue;
                const corner = isCorner(row, col);
                const edge = isEdge(row, col);
                const weight = corner ? 12 : (edge ? 4 : 2);
                const isOwn = cell === playerValue;
                if (isOwn) {
                    score -= weight * 100;
                    if (corner) ownCornerHits += 1;
                } else {
                    score += weight * 100;
                    if (corner) oppCornerHits += 1;
                }
            }
        }

        if (discDiff <= -8) score += 140;
        if (discDiff <= -14) score += 80;
        if (discDiff >= 8) score -= 140;
        if (discDiff >= 12) score -= 70;
        if (oppCornerHits > 0) score += 2400 * oppCornerHits;
        if (ownCornerHits > 0) score -= 3200 * ownCornerHits;
        if (discDiff >= 0 && oppCornerHits <= 0) score -= 220;

        score += rng.random() * 0.01;
        return score;
    }

    function chooseTimeBombTarget(gameState: any, cardState: any, playerKey: any, rng: any) {
        const targets = (typeof cardLogic.getTimeBombTargets === 'function')
            ? (cardLogic.getTimeBombTargets(cardState, gameState, playerKey) || [])
            : (cardLogic.getSelectableTargets(cardState, gameState, playerKey) || []);
        if (!targets.length) return null;
        return choosePendingTargetByScore(
            targets,
            (target: any) => scoreTimeBombTarget(gameState, playerKey, target, rng)
        );
    }

    return {
        chooseCorrosionTarget,
        chooseTemptTarget,
        chooseCaptureTarget,
        chooseTimeBombTarget,
        scoreTimeBombTarget
    };
}
