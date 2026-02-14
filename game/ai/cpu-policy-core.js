/**
 * @file cpu-policy-core.js
 * @description Pure CPU policy helpers (no UI/DOM/global side effects).
 */

'use strict';

const DEFENSIVE_CARD_TYPES = new Set([
    'PROTECTED_NEXT_STONE',
    'PERMA_PROTECT_NEXT_STONE',
    'GUARD_WILL',
    'REGEN_WILL',
    'PLUNDER_WILL',
    'SELL_CARD_WILL',
    'HEAVEN_BLESSING',
    'CONDEMN_WILL',
    'SACRIFICE_WILL'
]);

const HIGH_VARIANCE_CARD_TYPES = new Set([
    'ULTIMATE_REVERSE_DRAGON',
    'ULTIMATE_DESTROY_GOD',
    'ULTIMATE_HYPERACTIVE_GOD',
    'DOUBLE_PLACE',
    'CHAIN_WILL',
    'TEMPT_WILL',
    'POSITION_SWAP_WILL',
    'SWAP_WITH_ENEMY',
    'TIME_BOMB',
    'CROSS_BOMB',
    'BREEDING_WILL',
    'STEAL_CARD',
    'STRONG_WIND_WILL'
]);

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

function countBoardDiscsForPlayer(board, playerValue) {
    if (!Array.isArray(board)) return { own: 0, opp: 0, empties: 0 };
    let own = 0;
    let opp = 0;
    let empties = 0;
    for (let r = 0; r < board.length; r++) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        for (let c = 0; c < row.length; c++) {
            const v = row[c];
            if (v === playerValue) own += 1;
            else if (v === -playerValue) opp += 1;
            else if (v === 0) empties += 1;
        }
    }
    return { own, opp, empties };
}

function buildCardDecisionContext(context) {
    const ctx = context || {};
    const level = Number.isFinite(ctx.level) ? Math.max(1, Math.floor(ctx.level)) : 1;
    const playerValue = Number.isFinite(ctx.playerValue)
        ? (ctx.playerValue >= 0 ? 1 : -1)
        : 1;
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? Math.max(0, Math.floor(ctx.legalMovesCount)) : 0;

    let discDiff = Number.isFinite(ctx.discDiff) ? Number(ctx.discDiff) : 0;
    let empties = Number.isFinite(ctx.empties) ? Math.max(0, Math.floor(ctx.empties)) : null;
    if (Array.isArray(ctx.board)) {
        const boardStat = countBoardDiscsForPlayer(ctx.board, playerValue);
        if (!Number.isFinite(ctx.discDiff)) discDiff = boardStat.own - boardStat.opp;
        if (!Number.isFinite(ctx.empties)) empties = boardStat.empties;
    }
    if (!Number.isFinite(empties)) empties = 0;

    const ownCharge = Number.isFinite(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
    const oppCharge = Number.isFinite(ctx.oppCharge) ? Number(ctx.oppCharge) : 0;
    const handSize = Number.isFinite(ctx.handSize) ? Math.max(0, Math.floor(ctx.handSize)) : 0;
    const forceUseCard = !!ctx.forceUseCard || legalMovesCount <= 0;
    const minUseScore = Number.isFinite(ctx.minUseScore)
        ? Number(ctx.minUseScore)
        : (forceUseCard ? Number.NEGATIVE_INFINITY : (level >= 6 ? 14 : (level >= 4 ? 4 : -12)));

    return {
        level,
        playerValue,
        legalMovesCount,
        discDiff,
        empties,
        ownCharge,
        oppCharge,
        handSize,
        forceUseCard,
        minUseScore
    };
}

function scoreCardUseDecision(cardId, getCardCost, getCardDef, context) {
    const ctx = buildCardDecisionContext(context);
    const cardCost = typeof getCardCost === 'function' ? Number(getCardCost(cardId) || 0) : 0;
    const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
    const cardType = cardDef && typeof cardDef.type === 'string' ? cardDef.type : '';

    let score = cardCost * 2;
    if (ctx.forceUseCard) score += 1000;
    if (ctx.legalMovesCount <= 1) score += 35;

    if (ctx.discDiff >= 10) score -= 20;
    if (ctx.discDiff >= 16) score -= 15;
    if (ctx.discDiff <= -8) score += 20;
    if (ctx.discDiff <= -14) score += 20;

    if (ctx.empties <= 12) {
        if (ctx.discDiff > 0) score -= 25;
        else score += 12;
    }

    if (ctx.ownCharge <= (cardCost + 2)) score -= 8;
    if (ctx.handSize >= 4) score += 6;

    if (HIGH_VARIANCE_CARD_TYPES.has(cardType)) {
        score -= 22;
        if (ctx.discDiff >= 0) score -= 18;
        if (ctx.empties <= 18) score -= 10;
        if (ctx.discDiff <= -12) score += 14;
    }

    if (DEFENSIVE_CARD_TYPES.has(cardType)) {
        score += 12;
        if (ctx.discDiff >= 0) score += 10;
        if (ctx.empties <= 16) score += 6;
    }

    if (cardCost >= 20 && ctx.discDiff >= 0 && ctx.empties <= 20) score -= 16;
    if (cardCost <= 4 && DEFENSIVE_CARD_TYPES.has(cardType) && ctx.discDiff >= 0) score += 8;

    return {
        cardId,
        cardDef,
        cardType,
        cardCost,
        score,
        shouldUse: score >= ctx.minUseScore,
        minUseScore: ctx.minUseScore
    };
}

function chooseCardWithRiskProfile(usableCardIds, getCardCost, getCardDef, context) {
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    let best = null;
    for (const cardId of usableCardIds) {
        const decision = scoreCardUseDecision(cardId, getCardCost, getCardDef, context);
        if (!best) {
            best = decision;
            continue;
        }
        if (decision.score > best.score) {
            best = decision;
            continue;
        }
        if (decision.score === best.score && decision.cardCost > best.cardCost) {
            best = decision;
            continue;
        }
        if (decision.score === best.score && decision.cardCost === best.cardCost && String(decision.cardId) < String(best.cardId)) {
            best = decision;
        }
    }
    if (!best || !best.shouldUse) return null;
    return {
        cardId: best.cardId,
        cardDef: best.cardDef,
        score: best.score
    };
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
    chooseCardWithRiskProfile,
    chooseHighestCostCard,
    chooseMove,
    scoreCardUseDecision,
    scoreMoveHeuristic
};
