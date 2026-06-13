type CpuDecisionCardLearnedConfig = {
    resolveCardLogic: () => any;
    getCpuPolicyCore: () => any;
    buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any) => any;
    isCardChoiceAllowedByHighConfidence: (playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any) => any;
    shouldUseSharedPolicyTableCoreCardDecision: (level: any) => any;
};

export function createCpuDecisionCardLearned(config: CpuDecisionCardLearnedConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardLearnedConfig;

    function resolveCardLogic(): any {
        return cfg.resolveCardLogic ? cfg.resolveCardLogic() : null;
    }

    function resolveCpuPolicyCore(): any {
        return cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
    }

    function createCardChoiceFromId(cardId: any): any {
        if (!cardId) return null;
        const cardLogicRef = resolveCardLogic();
        const cardDef = (cardLogicRef && typeof cardLogicRef.getCardDef === 'function')
            ? cardLogicRef.getCardDef(cardId)
            : null;
        return { cardId, cardDef };
    }

    function selectCardBySharedPolicyTableCore(playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any): any {
        if (!Array.isArray(usableCardIds) || usableCardIds.length <= 0) return null;
        const cardLogicRef = resolveCardLogic();
        if (!cardLogicRef) return null;

        const context = prebuiltContext || cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
        const cpuPolicyCore = resolveCpuPolicyCore();

        if (cpuPolicyCore && typeof cpuPolicyCore.chooseCardWithRiskProfile === 'function') {
            const selected = cpuPolicyCore.chooseCardWithRiskProfile(
                usableCardIds,
                cardLogicRef.getCardCost,
                cardLogicRef.getCardDef,
                context
            );
            if (selected && selected.cardId) return selected;
        }

        const usableSortedByCost = usableCardIds.slice().sort((a: any, b: any) => cardLogicRef.getCardCost(b) - cardLogicRef.getCardCost(a));
        if (!cpuPolicyCore || typeof cpuPolicyCore.scoreCardUseDecision !== 'function') {
            return createCardChoiceFromId(usableSortedByCost[0] || null);
        }
        for (const cardId of usableSortedByCost) {
            const score = cpuPolicyCore.scoreCardUseDecision(
                cardId,
                cardLogicRef.getCardCost,
                cardLogicRef.getCardDef,
                context
            );
            if (!score || score.shouldUse === true) {
                return createCardChoiceFromId(cardId);
            }
        }
        return null;
    }

    function selectCardByLevel6Consensus(playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any): any {
        if (!Number.isFinite(level) || level < 6) return null;
        if (!Array.isArray(usableCardIds) || usableCardIds.length <= 0) return null;
        const cpuPolicyCore = resolveCpuPolicyCore();
        if (!cpuPolicyCore || typeof cpuPolicyCore.scoreCardUseDecision !== 'function') return null;
        const cardLogicRef = resolveCardLogic();
        if (!cardLogicRef) return null;
        if (typeof cardLogicRef.getCardCost !== 'function' || typeof cardLogicRef.getCardDef !== 'function') return null;

        const context = prebuiltContext || cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
        const usable = usableCardIds.filter((id: any) => typeof id === 'string' && id.length > 0);
        if (usable.length <= 0) return null;

        let best: any = null;
        let second: any = null;
        for (const cardId of usable) {
            const decision = cpuPolicyCore.scoreCardUseDecision(
                cardId,
                cardLogicRef.getCardCost,
                cardLogicRef.getCardDef,
                context
            );
            if (!decision || !Number.isFinite(decision.score)) continue;

            const score = Number(decision.score);
            const one = { cardId, score, decision };
            if (!best || score > best.score || (score === best.score && String(cardId) < String(best.cardId))) {
                second = best;
                best = one;
            } else if (!second || score > second.score || (score === second.score && String(cardId) < String(second.cardId))) {
                second = one;
            }
        }

        if (!best) return null;
        if (best.decision.shouldUse !== true) return null;

        const stableState = !!context && context.forceUseCard !== true &&
            context.cornerEmergency !== true &&
            Number(context.discDiff || 0) >= 10 &&
            Number(context.handSize || 0) <= 2 &&
            Number(context.ownCharge || 0) <= 18 &&
            Number(context.legalMovesCount || legalMovesCount || 0) >= 5;
        if (stableState) {
            if (!cfg.isCardChoiceAllowedByHighConfidence(playerKey, level, legalMovesCount, best.cardId, context)) {
                return null;
            }
            const gap = second && Number.isFinite(second.score)
                ? (best.score - second.score)
                : Number.POSITIVE_INFINITY;
            if (Number.isFinite(gap) && gap < 8 && context.hasCornerMoveNow === true) {
                return null;
            }
        }

        const cardDef = cardLogicRef.getCardDef(best.cardId);
        return { cardId: best.cardId, cardDef };
    }

    return {
        shouldUseSharedPolicyTableCoreCardDecision: (level: any) => cfg.shouldUseSharedPolicyTableCoreCardDecision(level),
        createCardChoiceFromId,
        selectCardBySharedPolicyTableCore,
        selectCardByLevel6Consensus
    };
}

module.exports = {
    createCpuDecisionCardLearned
};
