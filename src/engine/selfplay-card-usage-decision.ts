/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayCardUsageDecisionConfig = {
    selectDestroyHandCardId?: (cardState: any, gameState: any, playerKey: any, context: any) => any;
    selectCardIdToUse?: (cardState: any, gameState: any, playerKey: any, options: any, context: any) => any;
    CpuPolicyCore?: any;
    CardLogic?: any;
    buildCardDecisionContext?: (
        gameState: any,
        cardState: any,
        playerKey: any,
        legalMovesCount: any,
        legalMoves: any,
        usableCardIds?: any
    ) => any;
};

export function createSelfplayCardUsageDecision(config?: SelfplayCardUsageDecisionConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayCardUsageDecisionConfig;
    const selectDestroyHandCardId = typeof cfg.selectDestroyHandCardId === 'function'
        ? cfg.selectDestroyHandCardId
        : (() => null);
    const selectCardIdToUse = typeof cfg.selectCardIdToUse === 'function'
        ? cfg.selectCardIdToUse
        : (() => null);
    const cpuPolicyCore = cfg.CpuPolicyCore || null;
    const cardLogic = cfg.CardLogic || null;
    const buildCardDecisionContext = typeof cfg.buildCardDecisionContext === 'function'
        ? cfg.buildCardDecisionContext
        : (() => null);

    function decideCardUsageAction(params: {
        activeGameState: any;
        activeCardState: any;
        playerKey: any;
        options: any;
        pending: any;
        legalMoves: any[];
        mustTakePriorityPlacement: boolean;
        rng: any;
    }) {
        const {
            activeGameState,
            activeCardState,
            playerKey,
            options,
            pending,
            legalMoves,
            mustTakePriorityPlacement,
            rng
        } = params || {} as any;

        const alreadyUsed = !!(
            activeCardState &&
            activeCardState.hasUsedCardThisTurnByPlayer &&
            activeCardState.hasUsedCardThisTurnByPlayer[playerKey]
        );
        const pendingType = pending ? pending.type : null;
        const decisionContext = {
            gameState: activeGameState,
            cardState: activeCardState,
            playerKey,
            pendingType,
            legalMovesCount: Array.isArray(legalMoves) ? legalMoves.length : 0,
            legalMoves
        };

        if (
            options.allowCardUsage &&
            options.allowHandDestroy !== false &&
            !mustTakePriorityPlacement &&
            !alreadyUsed
        ) {
            const destroyCardId = selectDestroyHandCardId(
                activeCardState,
                activeGameState,
                playerKey,
                decisionContext
            );
            if (destroyCardId) {
                return {
                    action: { type: 'destroy_hand_card', destroyCardId },
                    legalMoves
                };
            }
        }

        if (
            options.allowCardUsage &&
            !mustTakePriorityPlacement &&
            !alreadyUsed
        ) {
            const cardDecision = selectCardIdToUse(
                activeCardState,
                activeGameState,
                playerKey,
                options,
                decisionContext
            );
            const cardId = cardDecision && cardDecision.cardId ? cardDecision.cardId : null;
            const mustUseCardToCreateMove = Array.isArray(legalMoves) ? legalMoves.length === 0 : true;
            let adjustedRate = Number.isFinite(options.cardUsageRate) ? options.cardUsageRate : 0;
            let forceUseByRiskScore = false;
            let preferUseByRiskScore = false;
            if (cardId && cpuPolicyCore && typeof cpuPolicyCore.scoreCardUseDecision === 'function') {
                const risk = cpuPolicyCore.scoreCardUseDecision(
                    cardId,
                    cardLogic.getCardCost,
                    cardLogic.getCardDef,
                    buildCardDecisionContext(activeGameState, activeCardState, playerKey, legalMoves.length, legalMoves)
                );
                if (risk && risk.shouldUse === false) {
                    adjustedRate = 0;
                } else if (risk && Number.isFinite(risk.score)) {
                    const minUseScore = Number.isFinite(risk.minUseScore) ? Number(risk.minUseScore) : 0;
                    const scoreMargin = Number(risk.score) - minUseScore;
                    if (scoreMargin >= 28) forceUseByRiskScore = true;
                    else if (scoreMargin >= 14) preferUseByRiskScore = true;
                    if (risk.score >= 60) adjustedRate = Math.min(1, adjustedRate * 1.8);
                    else if (risk.score >= 25) adjustedRate = Math.min(1, adjustedRate * 1.3);
                    else if (risk.score < 10) adjustedRate *= 0.35;
                }
            }
            const handSize = activeCardState && activeCardState.hands && Array.isArray(activeCardState.hands[playerKey])
                ? activeCardState.hands[playerKey].length
                : 0;
            if (handSize >= 5) adjustedRate = Math.max(adjustedRate, 0.88);
            else if (handSize >= 4) adjustedRate = Math.max(adjustedRate, 0.58);
            if (preferUseByRiskScore) adjustedRate = Math.max(adjustedRate, handSize >= 4 ? 0.88 : 0.76);
            if (forceUseByRiskScore) adjustedRate = Math.max(adjustedRate, 0.98);
            const randomUse = rng.random() < adjustedRate;
            if (cardId && (mustUseCardToCreateMove || forceUseByRiskScore || randomUse)) {
                const decisionReasonTags = ['decision:use'];
                if (mustUseCardToCreateMove) decisionReasonTags.push('force_use_card');
                if (handSize >= 4) decisionReasonTags.push('hand_pressure');
                if (forceUseByRiskScore || preferUseByRiskScore) decisionReasonTags.push('threshold_passed');
                if (cardDecision && Array.isArray(cardDecision.candidates)) {
                    const selectedCandidate = cardDecision.candidates.find((one: any) => one && one.cardId === cardId) || null;
                    const selectedScore = Number(selectedCandidate && selectedCandidate.score);
                    const selectedMinUseScore = Number(selectedCandidate && selectedCandidate.minUseScore);
                    if (selectedCandidate && Number.isFinite(selectedScore) && Number.isFinite(selectedMinUseScore) && selectedScore >= selectedMinUseScore) {
                        if (!decisionReasonTags.includes('threshold_passed')) decisionReasonTags.push('threshold_passed');
                    }
                }
                const cardDecisionTrace = cardDecision && typeof cardDecision === 'object'
                    ? Object.assign({}, cardDecision, { reasonTags: decisionReasonTags })
                    : null;
                return {
                    action: { type: 'use_card', useCardId: cardId, useCardOwnerKey: playerKey },
                    legalMoves,
                    cardDecision: cardDecisionTrace
                };
            }
        }

        return null;
    }

    return {
        decideCardUsageAction
    };
}
