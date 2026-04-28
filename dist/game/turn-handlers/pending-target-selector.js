"use strict";
const _require = (typeof __non_webpack_require__ !== 'undefined')
    ? __non_webpack_require__
    : require;
function createCancelCardAction() {
    export = {
        type: 'cancel_card',
        cancelOptions: { refundCost: false, resetUsage: true }
    };
}
function isBoardCellTarget(target) {
    return !!target && Number.isInteger(target.row) && Number.isInteger(target.col);
}
function compareBoardCellTargets(left, right) {
    if (!isBoardCellTarget(left))
        return 1;
    if (!isBoardCellTarget(right))
        return -1;
    if (left.row !== right.row)
        return left.row - right.row;
    return left.col - right.col;
}
function choosePendingTargetWithPolicy(options) {
    const targets = Array.isArray(options && options.targets)
        ? options.targets.filter(isBoardCellTarget)
        : [];
    if (!targets.length)
        return null;
    const scoreTarget = (options && typeof options.scoreTarget === 'function')
        ? options.scoreTarget
        : null;
    if (!scoreTarget)
        return targets[0];
    let best = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const target of targets) {
        let score = Number.NEGATIVE_INFINITY;
        try {
            const rawScore = Number(scoreTarget(target));
            score = Number.isFinite(rawScore) ? rawScore : Number.NEGATIVE_INFINITY;
        }
        catch (e) {
            score = Number.NEGATIVE_INFINITY;
        }
        if (!best || score > bestScore || (score === bestScore && compareBoardCellTargets(target, best) < 0)) {
            best = target;
            bestScore = score;
        }
    }
    return best || targets[0];
}
function callSelector(selector, context) {
    if (typeof selector !== 'function')
        return null;
    return selector(context.gameState, context.cardState, context.playerKey, context.rng);
}
function readPendingEffectFromContext(context) {
    if (!context || typeof context !== 'object')
        return null;
    if (context.pending && typeof context.pending === 'object') {
        return context.pending;
    }
    if (typeof context.readPendingEffect === 'function') {
        const pending = context.readPendingEffect(context.cardState, context.playerKey, context);
        if (pending && typeof pending === 'object') {
            return pending;
        }
    }
    return context.cardState && context.cardState.pendingEffectByPlayer
        ? (context.cardState.pendingEffectByPlayer[context.playerKey] || null)
        : null;
}
function buildBoardCellAction(context, selectorName, actionKey) {
    const selector = context.selectors && context.selectors[selectorName];
    const target = callSelector(selector, context);
    if (!target || !Number.isInteger(target.row) || !Number.isInteger(target.col)) {
        return createCancelCardAction();
    }
    return {
        type: 'place',
        [actionKey]: { row: target.row, col: target.col }
    };
}
function buildHeavenBlessingAction(context) {
    const pending = readPendingEffectFromContext(context);
    const offers = pending && Array.isArray(pending.offers)
        ? pending.offers.filter((id) => typeof id === 'string')
        : [];
    if (!offers.length)
        return createCancelCardAction();
    if (!context.cardLogic)
        return createCancelCardAction();
    const legalMoves = typeof context.getLegalMovesForAction === 'function'
        ? context.getLegalMovesForAction(context.gameState, context.cardState, context.playerKey)
        : [];
    const riskContext = typeof context.buildCardDecisionContext === 'function'
        ? context.buildCardDecisionContext(context.gameState, context.cardState, context.playerKey, legalMoves.length, legalMoves)
        : null;
    let bestCardId = offers[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestCost = Number.NEGATIVE_INFINITY;
    for (const cardId of offers) {
        const cost = Number(context.cardLogic.getCardCost(cardId) || 0);
        let score = cost * 0.35;
        if (context.cpuPolicyCore && typeof context.cpuPolicyCore.scoreCardUseDecision === 'function') {
            const decision = context.cpuPolicyCore.scoreCardUseDecision(cardId, context.cardLogic.getCardCost, context.cardLogic.getCardDef, riskContext);
            if (decision && Number.isFinite(decision.score)) {
                score += (decision.score * 0.95);
                if (decision.shouldUse === true)
                    score += 18;
            }
            if (typeof context.cpuPolicyCore.scoreCardRetentionPriority === 'function') {
                const retention = context.cpuPolicyCore.scoreCardRetentionPriority(cardId, context.cardLogic.getCardCost, context.cardLogic.getCardDef, riskContext);
                if (retention && Number.isFinite(retention.score))
                    score += (retention.score * 0.8);
            }
        }
        if (score > bestScore || (score === bestScore && cost > bestCost)) {
            bestScore = score;
            bestCost = cost;
            bestCardId = cardId;
        }
    }
    return { type: 'place', heavenBlessingCardId: bestCardId };
}
function buildCondemnAction(context) {
    const pending = readPendingEffectFromContext(context);
    const offers = pending && Array.isArray(pending.offers) ? pending.offers : [];
    if (!offers.length || !context.cardLogic)
        return createCancelCardAction();
    const opponentKey = context.playerKey === 'black' ? 'white' : 'black';
    const oppLegalMoves = typeof context.getLegalMovesForAction === 'function'
        ? context.getLegalMovesForAction(context.gameState, context.cardState, opponentKey)
        : [];
    const oppRiskContext = typeof context.buildCardDecisionContext === 'function'
        ? context.buildCardDecisionContext(context.gameState, context.cardState, opponentKey, oppLegalMoves.length, oppLegalMoves)
        : null;
    let best = null;
    for (const offer of offers) {
        if (!offer || !Number.isInteger(offer.handIndex) || typeof offer.cardId !== 'string')
            continue;
        let score = Number(context.cardLogic.getCardCost(offer.cardId) || 0) * 3;
        if (context.cpuPolicyCore && typeof context.cpuPolicyCore.scoreCardUseDecision === 'function') {
            const oppScore = context.cpuPolicyCore.scoreCardUseDecision(offer.cardId, context.cardLogic.getCardCost, context.cardLogic.getCardDef, oppRiskContext);
            if (oppScore && Number.isFinite(oppScore.score))
                score += (oppScore.score * 4.5);
        }
        if (!best || score > best.score || (score === best.score && offer.handIndex < best.handIndex)) {
            best = { handIndex: offer.handIndex, score };
        }
    }
    if (!best)
        return createCancelCardAction();
    return { type: 'place', condemnTargetIndex: best.handIndex };
}
function buildPendingSelectionAction(context) {
    const pending = readPendingEffectFromContext(context);
    const pendingType = String((context && context.pendingType) || (pending && pending.type) || '');
    if (!pendingType)
        return createCancelCardAction();
    switch (pendingType) {
        case 'SWAP_WITH_ENEMY':
            return buildBoardCellAction(context, 'chooseSwapTarget', 'swapTarget');
        case 'POSITION_SWAP_WILL':
            return buildBoardCellAction(context, 'choosePositionSwapTarget', 'positionSwapTarget');
        case 'DESTROY_ONE_STONE':
            return buildBoardCellAction(context, 'chooseDestroyTarget', 'destroyTarget');
        case 'STRONG_WIND_WILL':
            return buildBoardCellAction(context, 'chooseStrongWindTarget', 'strongWindTarget');
        case 'SUPER_BUOYANCY_WILL':
            return buildBoardCellAction(context, 'chooseSuperBuoyancyTarget', 'superBuoyancyTarget');
        case 'SUPER_GRAVITY_WILL':
            return buildBoardCellAction(context, 'chooseSuperGravityTarget', 'superGravityTarget');
        case 'TEMPT_WILL':
            return buildBoardCellAction(context, 'chooseTemptTarget', 'temptTarget');
        case 'CAPTURE_WILL':
            return buildBoardCellAction(context, 'chooseCaptureTarget', 'captureTarget');
        case 'TIME_BOMB':
            return buildBoardCellAction(context, 'chooseTimeBombTarget', 'bombTarget');
        case 'GUARD_WILL':
        case 'GUARDIAN_GOD':
            return buildBoardCellAction(context, 'chooseGuardTarget', 'guardTarget');
        case 'LIVING_WILL':
            return buildBoardCellAction(context, 'chooseLivingWillTarget', 'livingWillTarget');
        case 'BOARD_EXPANSION_WILL':
        case 'BOARD_EXPANSION_GOD':
            return buildBoardCellAction(context, 'chooseBoardExpansionTarget', 'expansionTarget');
        case 'BOARD_SHRINK_WILL':
        case 'BOARD_SHRINK_GOD':
            return buildBoardCellAction(context, 'chooseBoardShrinkTarget', 'shrinkTarget');
        case 'BLOCKADE_WILL':
            return buildBoardCellAction(context, 'chooseBlockadeTarget', 'blockadeTarget');
        case 'METEOR_WILL':
            return buildBoardCellAction(context, 'chooseMeteorTarget', 'meteorTarget');
        case 'FREEZE_WILL':
            return buildBoardCellAction(context, 'chooseFreezeTarget', 'freezeTarget');
        case 'SEED_WILL':
            return buildBoardCellAction(context, 'chooseSeedTarget', 'seedTarget');
        case 'TRAP_WILL':
            return buildBoardCellAction(context, 'chooseTrapTarget', 'trapTarget');
        case 'CLONE_WILL':
            return buildBoardCellAction(context, 'chooseCloneTarget', 'cloneTarget');
        case 'SPLIT_WILL':
            return buildBoardCellAction(context, 'chooseSplitTarget', 'splitTarget');
        case 'HYPERACTIVE_INHERIT_WILL':
            return buildBoardCellAction(context, 'chooseHyperactiveInheritTarget', 'hyperactiveInheritTarget');
        case 'TELEPORT_WILL':
            return buildBoardCellAction(context, 'chooseTeleportTarget', 'teleportTarget');
        case 'CELL_TELEPORT_WILL':
            return buildBoardCellAction(context, 'chooseCellTeleportTarget', 'teleportTarget');
        case 'EXTEND_LIFE_WILL':
        case 'EXTEND_LIFE_GOD':
            return buildBoardCellAction(context, 'chooseExtendLifeTarget', 'extendTarget');
        case 'CORROSION_WILL':
            return buildBoardCellAction(context, 'chooseCorrosionTarget', 'corrosionTarget');
        case 'HEAVEN_BLESSING':
            return buildHeavenBlessingAction(context);
        case 'CONDEMN_WILL':
            return buildCondemnAction(context);
        default:
            return createCancelCardAction();
    }
}
module.exports = {
    buildPendingSelectionAction,
    createCancelCardAction,
    choosePendingTargetWithPolicy
};
//# sourceMappingURL=pending-target-selector.js.map