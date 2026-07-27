import type { CardState, GameState, PlayerKey } from '../../src/types';
import PendingSelectionRegistry = require('../logic/cards-internal/pending-selection-registry');

type BoardCellTarget = {
    row: number;
    col: number;
    directionKey?: string;
    side?: string;
    additions?: Array<{ row: number; col: number }>;
};
type PendingTargetSelectorContext = {
    gameState?: GameState;
    cardState?: CardState;
    playerKey?: PlayerKey | string;
    rng?: unknown;
    pending?: Record<string, unknown> | null;
    pendingType?: string;
    selectors?: Record<string, (gameState?: GameState, cardState?: CardState, playerKey?: string, rng?: unknown) => BoardCellTarget | null>;
    scoreTarget?: (target: BoardCellTarget) => number;
    readPendingEffect?: (cardState?: CardState, playerKey?: string, context?: PendingTargetSelectorContext) => Record<string, unknown> | null;
    cardLogic?: {
        getCardCost?: (cardId: string) => number;
        getCardDef?: (cardId: string) => unknown;
    };
    cpuPolicyCore?: {
        scoreCardUseDecision?: (...args: unknown[]) => { score?: number; shouldUse?: boolean } | null;
        scoreCardRetentionPriority?: (...args: unknown[]) => { score?: number } | null;
    };
    getLegalMovesForAction?: (gameState?: GameState, cardState?: CardState, playerKey?: string) => unknown[];
    buildCardDecisionContext?: (...args: unknown[]) => unknown;
};

function createCancelCardAction(): { type: 'cancel_card'; cancelOptions: { refundCost: false; resetUsage: true } } {
    return {
        type: 'cancel_card',
        cancelOptions: { refundCost: false, resetUsage: true }
    };
}

function isBoardCellTarget(target: unknown): target is BoardCellTarget {
    const maybe = target as BoardCellTarget | null;
    return !!maybe && Number.isInteger(maybe.row) && Number.isInteger(maybe.col);
}

function cloneBoardCellTarget(target: BoardCellTarget): BoardCellTarget {
    const clone: BoardCellTarget = { row: target.row, col: target.col };
    if (typeof target.directionKey === 'string' && target.directionKey) {
        clone.directionKey = target.directionKey;
    }
    if (typeof target.side === 'string' && target.side) {
        clone.side = target.side;
    }
    if (
        Array.isArray(target.additions) &&
        target.additions.every((cell) => (
            !!cell &&
            Number.isInteger(cell.row) &&
            Number.isInteger(cell.col)
        ))
    ) {
        clone.additions = target.additions.map((cell) => ({
            row: cell.row,
            col: cell.col
        }));
    }
    return clone;
}

function compareBoardCellTargets(left: unknown, right: unknown): number {
    if (!isBoardCellTarget(left)) return 1;
    if (!isBoardCellTarget(right)) return -1;
    if (left.row !== right.row) return left.row - right.row;
    return left.col - right.col;
}

function choosePendingTargetWithPolicy(options: { targets?: unknown[]; scoreTarget?: (target: BoardCellTarget) => number } | null | undefined): BoardCellTarget | null {
    const rawTargets = options && Array.isArray(options.targets) ? options.targets : [];
    const targets = Array.isArray(rawTargets)
        ? rawTargets.filter(isBoardCellTarget)
        : [];
    if (!targets.length) return null;

    const scoreTarget = (options && typeof options.scoreTarget === 'function')
        ? options.scoreTarget
        : null;
    if (!scoreTarget) return targets[0] || null;

    let best: BoardCellTarget | null = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const target of targets) {
        let score = Number.NEGATIVE_INFINITY;
        try {
            const rawScore = Number(scoreTarget(target));
            score = Number.isFinite(rawScore) ? rawScore : Number.NEGATIVE_INFINITY;
        } catch (e) {
            score = Number.NEGATIVE_INFINITY;
        }

        if (!best || score > bestScore || (score === bestScore && compareBoardCellTargets(target, best) < 0)) {
            best = target;
            bestScore = score;
        }
    }

    return best || targets[0] || null;
}

function callSelector(selector: unknown, context: PendingTargetSelectorContext): BoardCellTarget | null {
    if (typeof selector !== 'function') return null;
    return selector(context.gameState, context.cardState, String(context.playerKey || ''), context.rng);
}

function readPendingEffectFromContext(context: PendingTargetSelectorContext): Record<string, unknown> | null {
    if (!context || typeof context !== 'object') return null;
    if (context.pending && typeof context.pending === 'object') return context.pending;
    if (typeof context.readPendingEffect === 'function') {
        const pending = context.readPendingEffect(context.cardState, String(context.playerKey || ''), context);
        if (pending && typeof pending === 'object') return pending;
    }
    const pendingByPlayer = context.cardState && (context.cardState as any).pendingEffectByPlayer;
    return pendingByPlayer ? (pendingByPlayer[String(context.playerKey || '')] || null) : null;
}

function buildBoardCellAction(context: PendingTargetSelectorContext, selectorName: string, actionKey: string): Record<string, unknown> {
    const selector = context.selectors && context.selectors[selectorName];
    const target = callSelector(selector, context);
    if (!target) return createCancelCardAction();
    return {
        type: 'place',
        [actionKey]: cloneBoardCellTarget(target)
    };
}

function buildHeavenBlessingAction(context: PendingTargetSelectorContext): Record<string, unknown> {
    const pending = readPendingEffectFromContext(context);
    const offers = pending && Array.isArray(pending.offers)
        ? pending.offers.filter((id: unknown): id is string => typeof id === 'string')
        : [];
    if (!offers.length || !context.cardLogic) return createCancelCardAction();

    const legalMoves = typeof context.getLegalMovesForAction === 'function'
        ? context.getLegalMovesForAction(context.gameState, context.cardState, String(context.playerKey || ''))
        : [];
    const riskContext = typeof context.buildCardDecisionContext === 'function'
        ? context.buildCardDecisionContext(context.gameState, context.cardState, String(context.playerKey || ''), legalMoves.length, legalMoves)
        : null;

    let bestCardId = offers[0] || '';
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestCost = Number.NEGATIVE_INFINITY;
    for (const cardId of offers) {
        const cost = Number((context.cardLogic.getCardCost && context.cardLogic.getCardCost(cardId)) || 0);
        let score = cost * 0.35;
        if (context.cpuPolicyCore && typeof context.cpuPolicyCore.scoreCardUseDecision === 'function') {
            const decision = context.cpuPolicyCore.scoreCardUseDecision(cardId, context.cardLogic.getCardCost, context.cardLogic.getCardDef, riskContext);
            if (decision && Number.isFinite(Number(decision.score))) score += Number(decision.score) * 0.95;
            if (decision && decision.shouldUse === true) score += 18;
            if (typeof context.cpuPolicyCore.scoreCardRetentionPriority === 'function') {
                const retention = context.cpuPolicyCore.scoreCardRetentionPriority(cardId, context.cardLogic.getCardCost, context.cardLogic.getCardDef, riskContext);
                if (retention && Number.isFinite(Number(retention.score))) score += Number(retention.score) * 0.8;
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

function buildCondemnAction(context: PendingTargetSelectorContext): Record<string, unknown> {
    const pending = readPendingEffectFromContext(context);
    const offers = pending && Array.isArray(pending.offers) ? pending.offers : [];
    if (!offers.length || !context.cardLogic) return createCancelCardAction();

    const opponentKey = String(context.playerKey || '') === 'black' ? 'white' : 'black';
    const oppLegalMoves = typeof context.getLegalMovesForAction === 'function'
        ? context.getLegalMovesForAction(context.gameState, context.cardState, opponentKey)
        : [];
    const oppRiskContext = typeof context.buildCardDecisionContext === 'function'
        ? context.buildCardDecisionContext(context.gameState, context.cardState, opponentKey, oppLegalMoves.length, oppLegalMoves)
        : null;

    let best: { handIndex: number; score: number } | null = null;
    for (const offer of offers) {
        const candidate = offer as { handIndex?: number; cardId?: string } | null;
        if (!candidate || !Number.isInteger(candidate.handIndex) || typeof candidate.cardId !== 'string') continue;
        let score = Number((context.cardLogic.getCardCost && context.cardLogic.getCardCost(candidate.cardId)) || 0) * 3;
        if (context.cpuPolicyCore && typeof context.cpuPolicyCore.scoreCardUseDecision === 'function') {
            const oppScore = context.cpuPolicyCore.scoreCardUseDecision(candidate.cardId, context.cardLogic.getCardCost, context.cardLogic.getCardDef, oppRiskContext);
            if (oppScore && Number.isFinite(Number(oppScore.score))) score += Number(oppScore.score) * 4.5;
        }
        if (!best || score > best.score || (score === best.score && Number(candidate.handIndex) < best.handIndex)) {
            best = { handIndex: Number(candidate.handIndex), score };
        }
    }
    if (!best) return createCancelCardAction();
    return { type: 'place', condemnTargetIndex: best.handIndex };
}

function buildObserverWillAction(context: PendingTargetSelectorContext): Record<string, unknown> {
    const pending = readPendingEffectFromContext(context);
    const offers = pending && Array.isArray(pending.offers) ? pending.offers : [];
    if (!offers.length || !context.cardLogic) return createCancelCardAction();

    let best: { handIndex: number; score: number } | null = null;
    for (const offer of offers) {
        const candidate = offer as { handIndex?: number; cardId?: string } | null;
        if (!candidate || !Number.isInteger(candidate.handIndex) || typeof candidate.cardId !== 'string') continue;
        const cost = Number((context.cardLogic.getCardCost && context.cardLogic.getCardCost(candidate.cardId)) || 0);
        const def = context.cardLogic.getCardDef ? context.cardLogic.getCardDef(candidate.cardId) as any : null;
        const typeBonus = def && typeof def.type === 'string' && def.type.indexOf('WILL') >= 0 ? 2 : 0;
        const score = cost + typeBonus;
        if (!best || score > best.score || (score === best.score && Number(candidate.handIndex) < best.handIndex)) {
            best = { handIndex: Number(candidate.handIndex), score };
        }
    }
    if (!best) return createCancelCardAction();
    return { type: 'place', observerWillTargetIndex: best.handIndex };
}

function buildPendingSelectionAction(context: PendingTargetSelectorContext): Record<string, unknown> {
    const pending = readPendingEffectFromContext(context);
    const pendingType = String((context && context.pendingType) || (pending && pending.type) || '');
    if (!pendingType) return createCancelCardAction();

    const actionConfig = PendingSelectionRegistry.getPendingSelectionActionConfig(pendingType);
    if (actionConfig && actionConfig.policyMethod && actionConfig.field) {
        return buildBoardCellAction(context, actionConfig.policyMethod, actionConfig.field);
    }

    switch (pendingType) {
    case 'HEAVEN_BLESSING': return buildHeavenBlessingAction(context);
    case 'CONDEMN_WILL': return buildCondemnAction(context);
    case 'OBSERVER_WILL': return buildObserverWillAction(context);
    default: return createCancelCardAction();
    }
}

export {
    buildPendingSelectionAction,
    choosePendingTargetWithPolicy,
    createCancelCardAction
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        buildPendingSelectionAction,
        choosePendingTargetWithPolicy,
        createCancelCardAction
    };
}
