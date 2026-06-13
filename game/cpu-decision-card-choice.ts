type CpuDecisionCardChoiceConfig = {
    buildCardQuiescenceSnapshot: (playerKey: any, level: any, legalMoves: any, context: any) => any;
    buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any) => any;
    buildCornerPlanState: (playerKey: any, legalMoves?: any, usableCardIds?: any) => any;
    cpuDebugLog: (...args: any[]) => void;
    getActiveProtectionForPlayer: (playerValue: any) => any;
    getAISystem: () => any;
    getCardLogic: () => any;
    getCardState: () => any;
    getCpuPolicyCore: () => any;
    getFlipBlockers: () => any;
    getGameState: () => any;
    getLegalMoves: (gameState: any, protection: any, perma: any) => any;
    getTargetAwareUsableCardIds: (playerKey: any) => any;
    isAISystemAvailable: () => any;
    isCardChoiceAllowedByHighConfidence: (playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any) => any;
    isCardChoiceAllowedByPlan: (playerKey: any, level: any, legalMovesCount: any, cardId: any, cardDef: any, cornerPlanState: any, prebuiltContext: any) => any;
    isCardChoiceAllowedByRisk: (playerKey: any, level: any, legalMovesCount: any, cardId: any, prebuiltContext: any) => any;
    prepareCpuTrapOnlyCard: (playerKey: any) => any;
    resolveCpuSmartnessLevel: (playerKey: any) => any;
    resolvePlayerValue: (playerKey: any) => any;
    selectCardByLevel6Consensus: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any) => any;
    selectCardBySharedPolicyTableCore: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any) => any;
    shouldHoldCardByQuiescence: (playerKey: any, level: any, cardId: any, cardDef: any, context: any, snapshot: any) => any;
    shouldUseSharedPolicyTableCoreCardDecision: (level: any) => any;
    warn: (...args: any[]) => void;
};

export function createCpuDecisionCardChoice(config: CpuDecisionCardChoiceConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardChoiceConfig;

    function readCardLogic(): any {
        return cfg.getCardLogic ? cfg.getCardLogic() : null;
    }

    function selectCardFallback(cardState: any, _gameState: any, playerKey: any, level: any, legalMoves: any): any {
        if (typeof cardState === 'undefined' || !cardState) return null;
        const cardLogic = readCardLogic();
        if (!cardLogic) return null;
        const usable = cfg.getTargetAwareUsableCardIds(playerKey);
        if (!usable.length) return null;
        const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
        const decisionContext = cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usable);
        const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;

        if (cpuPolicyCore && typeof cpuPolicyCore.chooseCardWithRiskProfile === 'function') {
            const selected = cpuPolicyCore.chooseCardWithRiskProfile(
                usable,
                cardLogic.getCardCost,
                cardLogic.getCardDef,
                decisionContext
            );
            if (selected) return selected;
        }
        if (cpuPolicyCore && typeof cpuPolicyCore.chooseHighestCostCard === 'function') {
            const fallback = cpuPolicyCore.chooseHighestCostCard(usable, cardLogic.getCardCost, cardLogic.getCardDef);
            if (!fallback) return null;
            return cfg.isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, fallback.cardId, decisionContext)
                ? fallback
                : null;
        }
        const choiceId = usable[0];
        const cardDef = (typeof cardLogic.getCardDef === 'function') ? cardLogic.getCardDef(choiceId) : null;
        if (!cfg.isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choiceId, decisionContext)) return null;
        return { cardId: choiceId, cardDef };
    }

    function selectCardToUse(playerKey: any): any {
        const level = cfg.resolveCpuSmartnessLevel(playerKey);
        const player = cfg.resolvePlayerValue(playerKey);
        const protection = cfg.getActiveProtectionForPlayer(player);
        const perma = cfg.getFlipBlockers();
        const safeGameState = cfg.getGameState();
        const legalMoves = cfg.getLegalMoves(safeGameState, protection, perma);
        const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
        const cardLogic = readCardLogic();
        const usableNow = cardLogic ? cfg.getTargetAwareUsableCardIds(playerKey) : [];
        const decisionContext = cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableNow);
        const quiescenceSnapshot = cfg.buildCardQuiescenceSnapshot(playerKey, level, legalMoves, decisionContext);
        const cornerPlanState = decisionContext.cornerPlanState || cfg.buildCornerPlanState(playerKey, legalMoves, usableNow);
        const isAllowedChoice = (choice: any) => {
            if (!choice || !choice.cardId) return false;
            if (!cfg.isCardChoiceAllowedByPlan(playerKey, level, legalMovesCount, choice.cardId, choice.cardDef, cornerPlanState, decisionContext)) {
                return false;
            }
            if (!cfg.isCardChoiceAllowedByRisk(playerKey, level, legalMovesCount, choice.cardId, decisionContext)) {
                return false;
            }
            const stableLeadState = !!(decisionContext &&
                Number(decisionContext.discDiff || 0) >= 10 &&
                Number(decisionContext.handSize || 0) <= 2 &&
                Number(decisionContext.ownCharge || 0) <= 18 &&
                Number(decisionContext.legalMovesCount || legalMovesCount || 0) >= 5 &&
                decisionContext.highBonusMoveAvailable !== true &&
                decisionContext.lowDiscEmergency !== true);
            const requireHighConfidence = Number.isFinite(level) && level >= 6 &&
                decisionContext &&
                decisionContext.forceUseCard !== true &&
                decisionContext.cornerEmergency !== true &&
                stableLeadState;
            if (requireHighConfidence) {
                if (!cfg.isCardChoiceAllowedByHighConfidence(playerKey, level, legalMovesCount, choice.cardId, decisionContext)) {
                    return false;
                }
            }
            if (cfg.shouldHoldCardByQuiescence(playerKey, level, choice.cardId, choice.cardDef, decisionContext, quiescenceSnapshot)) {
                cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 高分散カードを保留(静止探索) - ${choice.cardId}`);
                return false;
            }
            return true;
        };

        const trapId = cfg.prepareCpuTrapOnlyCard(playerKey);
        if (trapId) {
            const usableTrap = cfg.getTargetAwareUsableCardIds(playerKey);
            if (usableTrap.includes(trapId)) {
                const trapDef = (cardLogic && typeof cardLogic.getCardDef === 'function')
                    ? cardLogic.getCardDef(trapId)
                    : null;
                return { cardId: trapId, cardDef: trapDef };
            }
        }

        if (cardLogic) {
            const usable = usableNow;
            if (cfg.shouldUseSharedPolicyTableCoreCardDecision(level)) {
                const sharedCoreChoice = cfg.selectCardBySharedPolicyTableCore(
                    playerKey,
                    level,
                    legalMoves.length,
                    legalMoves,
                    usable,
                    decisionContext
                ) || null;
                if (isAllowedChoice(sharedCoreChoice)) {
                    return sharedCoreChoice;
                }
            }
            if (usable.length) {
                const lv6Consensus = cfg.selectCardByLevel6Consensus(
                    playerKey,
                    level,
                    legalMoves.length,
                    legalMoves,
                    usable,
                    decisionContext
                );
                if (isAllowedChoice(lv6Consensus)) {
                    return lv6Consensus;
                }
            }
            if (usable.length) {
                const cpuPolicyCore = cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
                if (cpuPolicyCore && typeof cpuPolicyCore.chooseCardWithRiskProfile === 'function') {
                    const selected = cpuPolicyCore.chooseCardWithRiskProfile(
                        usable,
                        cardLogic.getCardCost,
                        cardLogic.getCardDef,
                        decisionContext
                    );
                    if (isAllowedChoice(selected)) return selected;
                }
                if (cpuPolicyCore && typeof cpuPolicyCore.chooseHighestCostCard === 'function') {
                    const fallback = cpuPolicyCore.chooseHighestCostCard(usable, cardLogic.getCardCost, cardLogic.getCardDef);
                    if (isAllowedChoice(fallback)) {
                        return fallback;
                    }
                }
                const choiceId = usable[0];
                const cardDef = (typeof cardLogic.getCardDef === 'function') ? cardLogic.getCardDef(choiceId) : null;
                if (isAllowedChoice({ cardId: choiceId, cardDef })) {
                    return { cardId: choiceId, cardDef };
                }
            }
        }

        let cardChoice: any = null;
        const aiSystem = cfg.getAISystem ? cfg.getAISystem() : null;
        if (cfg.isAISystemAvailable() && aiSystem && typeof aiSystem.selectCardToUse === 'function') {
            try {
                const safeCardState = cfg.getCardState();
                const currentGameState = cfg.getGameState();
                cardChoice = aiSystem.selectCardToUse(safeCardState, currentGameState, playerKey, level, legalMoves, null);
            } catch (e) {
                cfg.warn('[CPU] AISystem.selectCardToUse failed', e);
                cardChoice = null;
            }
        }

        if (!cardChoice) {
            const safeCardState = cfg.getCardState();
            const currentGameState = cfg.getGameState();
            cardChoice = selectCardFallback(safeCardState, currentGameState, playerKey, level, legalMoves);
        }
        if (cardChoice && !isAllowedChoice(cardChoice)) {
            return null;
        }
        return cardChoice || null;
    }

    return {
        selectCardToUse
    };
}

module.exports = {
    createCpuDecisionCardChoice
};
