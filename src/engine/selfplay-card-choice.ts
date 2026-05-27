/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayCardChoiceConfig = {
    CardLogic?: any;
    CpuPolicyCore?: any;
    getDirectUsableCardIds?: (cardState: any, gameState: any, playerKey: any) => any[];
    buildCardDecisionContext?: (
        gameState: any,
        cardState: any,
        playerKey: any,
        legalMovesCount: any,
        legalMoves: any,
        usableCardIds?: any[]
    ) => any;
    resolveCardType?: (cardId: any) => string;
    getPolicyActionScoreByKey?: (options: any, context: any, actionKey: any) => any;
    applyTeacherCommitteeToCardCandidates?: (candidates: any, options: any) => void;
    readSelfplayPendingEffect?: (cardState: any, playerKey: any) => any;
};

export function createSelfplayCardChoice(config?: SelfplayCardChoiceConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayCardChoiceConfig;
    const cardLogic = cfg.CardLogic || null;
    const cpuPolicyCore = cfg.CpuPolicyCore || null;
    const getDirectUsableCardIds = typeof cfg.getDirectUsableCardIds === 'function'
        ? cfg.getDirectUsableCardIds
        : (() => []);
    const buildCardDecisionContext = typeof cfg.buildCardDecisionContext === 'function'
        ? cfg.buildCardDecisionContext
        : (() => null);
    const resolveCardType = typeof cfg.resolveCardType === 'function'
        ? cfg.resolveCardType
        : (() => '');
    const getPolicyActionScoreByKey = typeof cfg.getPolicyActionScoreByKey === 'function'
        ? cfg.getPolicyActionScoreByKey
        : (() => null);
    const applyTeacherCommitteeToCardCandidates = typeof cfg.applyTeacherCommitteeToCardCandidates === 'function'
        ? cfg.applyTeacherCommitteeToCardCandidates
        : (() => {});
    const readSelfplayPendingEffect = typeof cfg.readSelfplayPendingEffect === 'function'
        ? cfg.readSelfplayPendingEffect
        : (() => null);

    function selectCardIdToUse(cardState: any, gameState: any, playerKey: any, options: any, context: any) {
        const usable = getDirectUsableCardIds(cardState, gameState, playerKey);
        if (!usable.length) return null;
        const riskContext = buildCardDecisionContext(
            gameState,
            cardState,
            playerKey,
            context && Number.isFinite(context.legalMovesCount) ? context.legalMovesCount : 0,
            context && Array.isArray(context.legalMoves) ? context.legalMoves : [],
            usable
        );

        const candidates = usable.map((cardId: any) => {
            const cardCost = Number(cardLogic && typeof cardLogic.getCardCost === 'function' ? (cardLogic.getCardCost(cardId) || 0) : 0);
            const cardDef = cardLogic && typeof cardLogic.getCardDef === 'function'
                ? (cardLogic.getCardDef(cardId) || null)
                : null;
            const cardType = cardDef && typeof cardDef.type === 'string'
                ? cardDef.type
                : resolveCardType(cardId);
            const policyScore = (options && options.policyTableModel && context)
                ? getPolicyActionScoreByKey(options, context, `use_card:${cardId}`)
                : null;
            const scored = (
                cpuPolicyCore &&
                typeof cpuPolicyCore.scoreCardUseDecision === 'function'
            )
                ? cpuPolicyCore.scoreCardUseDecision(
                    cardId,
                    cardLogic && cardLogic.getCardCost,
                    cardLogic && cardLogic.getCardDef,
                    riskContext
                )
                : null;
            const riskScore = scored && Number.isFinite(scored.score)
                ? Number(scored.score)
                : Number.NEGATIVE_INFINITY;
            const minUseScore = scored && Number.isFinite(scored.minUseScore)
                ? Number(scored.minUseScore)
                : null;
            const shouldUse = scored ? scored.shouldUse !== false : true;
            const baseScore = Number.isFinite(policyScore)
                ? Number(policyScore)
                : (Number.isFinite(riskScore) ? riskScore : cardCost);
            return {
                actionType: 'use_card',
                decisionKind: 'use',
                cardId,
                cardType,
                cardCost,
                score: Number.isFinite(riskScore) ? riskScore : null,
                riskScore,
                policyScore: Number.isFinite(policyScore) ? Number(policyScore) : Number.NEGATIVE_INFINITY,
                costScore: cardCost,
                minUseScore,
                shouldUse,
                baseScore,
                finalScore: baseScore,
                committeeScore: 0,
                committeeVotes: 0,
                isSelected: false
            };
        });

        applyTeacherCommitteeToCardCandidates(candidates, options);

        const selectable = candidates.filter((one: any) => one && one.shouldUse !== false);
        if (selectable.length <= 0) {
            return {
                cardId: null,
                selectedActionKey: 'keep',
                candidates,
                scoreSummary: {
                    bestScore: candidates.reduce((best: any, one: any) => Math.max(best, Number(one && one.score) || Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY),
                    bestFinalScore: candidates.reduce((best: any, one: any) => Math.max(best, Number(one && one.finalScore) || Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY),
                    lowerScoreIsBetter: false
                }
            };
        }

        let selected = null;
        for (const one of selectable) {
            if (!selected) {
                selected = one;
                continue;
            }
            if (Number(one.finalScore) > Number(selected.finalScore)) {
                selected = one;
                continue;
            }
            if (Number(one.finalScore) === Number(selected.finalScore) && Number(one.cardCost) > Number(selected.cardCost)) {
                selected = one;
                continue;
            }
            if (Number(one.finalScore) === Number(selected.finalScore) && Number(one.cardCost) === Number(selected.cardCost) && String(one.cardId) < String(selected.cardId)) {
                selected = one;
            }
        }
        if (!selected) return null;
        selected.isSelected = true;

        return {
            cardId: selected.cardId,
            selectedActionKey: `use:${selected.cardId}`,
            candidates,
            scoreSummary: {
                selectedScore: Number.isFinite(selected.score) ? Number(selected.score) : null,
                selectedPolicyScore: Number.isFinite(selected.policyScore) ? Number(selected.policyScore) : null,
                selectedFinalScore: Number.isFinite(selected.finalScore) ? Number(selected.finalScore) : null,
                selectedCommitteeScore: Number.isFinite(selected.committeeScore) ? Number(selected.committeeScore) : 0,
                selectedCommitteeVotes: Number.isFinite(selected.committeeVotes) ? Number(selected.committeeVotes) : 0,
                bestScore: selectable.reduce((best: any, one: any) => Math.max(best, Number(one && one.score) || Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY),
                bestFinalScore: selectable.reduce((best: any, one: any) => Math.max(best, Number(one && one.finalScore) || Number.NEGATIVE_INFINITY), Number.NEGATIVE_INFINITY),
                minUseScore: Number.isFinite(selected.minUseScore) ? Number(selected.minUseScore) : null,
                lowerScoreIsBetter: false
            }
        };
    }

    function selectDestroyHandCardId(cardState: any, gameState: any, playerKey: any, context: any) {
        const ownKey = playerKey === 'black' ? 'black' : 'white';
        if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[ownKey])) return null;
        if (readSelfplayPendingEffect(cardState, ownKey)) return null;
        if (!cpuPolicyCore || typeof cpuPolicyCore.chooseHandDestroyTargetForCycle !== 'function') return null;

        const hand = cardState.hands[ownKey].slice();
        if (hand.length <= 0) return null;

        const legalMoves = (context && Array.isArray(context.legalMoves)) ? context.legalMoves : [];
        const legalMovesCount = (context && Number.isFinite(context.legalMovesCount))
            ? Number(context.legalMovesCount)
            : legalMoves.length;
        const usable = getDirectUsableCardIds(cardState, gameState, ownKey);
        const riskContext = buildCardDecisionContext(gameState, cardState, ownKey, legalMovesCount, legalMoves, usable);
        const selected = cpuPolicyCore.chooseHandDestroyTargetForCycle(
            hand,
            usable,
            cardLogic && cardLogic.getCardCost,
            cardLogic && cardLogic.getCardDef,
            riskContext
        );
        return selected && selected.cardId ? selected.cardId : null;
    }

    return {
        selectCardIdToUse,
        selectDestroyHandCardId
    };
}
