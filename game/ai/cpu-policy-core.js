/**
 * @file cpu-policy-core.js
 * @description Pure CPU policy helpers (no UI/DOM/global side effects).
 */

'use strict';

function chooseHighestCostCard(usableCardIds, getCardCost, getCardDef) {
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    const sorted = usableCardIds.slice().sort((a, b) => {
        const ca = typeof getCardCost === 'function' ? (getCardCost(a) || 0) : 0;
        const cb = typeof getCardCost === 'function' ? (getCardCost(b) || 0) : 0;
        return cb - ca;
    });
    const cardId = sorted[0];
    const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
    return { cardId, cardDef };
}

function isCorner(row, col) {
    return (row === 0 || row === 7) && (col === 0 || col === 7);
}

function isEdge(row, col) {
    return row === 0 || row === 7 || col === 0 || col === 7;
}

function isXSquare(row, col) {
    return (row === 1 || row === 6) && (col === 1 || col === 6);
}

function isCSquare(row, col) {
    const nearTopBottom = (row === 0 || row === 7) && (col === 1 || col === 6);
    const nearLeftRight = (col === 0 || col === 7) && (row === 1 || row === 6);
    return nearTopBottom || nearLeftRight;
}

function scoreMoveHeuristic(move, level) {
    const row = Number.isFinite(move && move.row) ? move.row : 0;
    const col = Number.isFinite(move && move.col) ? move.col : 0;
    const flips = Array.isArray(move && move.flips) ? move.flips.length : 0;

    let score = flips * 100;
    if (isCorner(row, col)) score += 10000;
    if (isEdge(row, col)) score += 250;
    if (isXSquare(row, col)) score -= 600;
    if (isCSquare(row, col)) score -= 300;

    if (level >= 5 && isCorner(row, col)) score += 5000;
    return score;
}

function rankMoves(candidateMoves, level, options) {
    const opts = options || {};
    const useHeuristic = !!opts.enableHeuristic;
    const scoreMove = typeof opts.scoreMove === 'function' ? opts.scoreMove : null;
    if (!useHeuristic && !scoreMove) return candidateMoves.slice();

    const scored = candidateMoves.map((move, idx) => {
        const learnedScore = scoreMove ? (scoreMove(move) || 0) : 0;
        const heuristicScore = useHeuristic ? scoreMoveHeuristic(move, level) : 0;
        // Stable deterministic tie-break (avoid random in policy layer)
        const row = Number.isFinite(move && move.row) ? move.row : 0;
        const col = Number.isFinite(move && move.col) ? move.col : 0;
        const tie = (7 - row) * 0.001 + (7 - col) * 0.0001 + (candidateMoves.length - idx) * 0.00001;
        return { move, score: learnedScore + heuristicScore + tie };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.move);
}

function chooseMove(candidateMoves, level, rng, selectMoveWithAi, options) {
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
    const safeRng = rng && typeof rng.random === 'function' ? rng : { random: () => 0.5 };
    const rankedMoves = rankMoves(candidateMoves, level, options);

    if (typeof selectMoveWithAi === 'function') {
        try {
            const move = selectMoveWithAi(rankedMoves, level);
            if (move) return move;
        } catch (e) { /* fallback below */ }
    }

    if (options && options.enableHeuristic) return rankedMoves[0];
    return rankedMoves[Math.floor(safeRng.random() * rankedMoves.length)];
}

module.exports = {
    chooseHighestCostCard,
    chooseMove,
    scoreMoveHeuristic
};
