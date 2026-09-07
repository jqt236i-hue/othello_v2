import {
    measureCpuTurnSync,
    type CpuTurnPerformanceScope
} from './cpu-turn-performance';
import { isCardRuntimeUnavailableError } from './logic/card-runtime-errors';
import { shouldHoldTacticallyUnsafeCard } from './ai/cpu-tactical-safety';

type CpuDecisionCardChoiceConfig = {
    buildCardQuiescenceSnapshot: (playerKey: any, level: any, legalMoves: any, context: any) => any;
    buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usability: any, performanceScope?: CpuTurnPerformanceScope | null) => any;
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
    getTargetAwareCardUsabilityAnalysis?: (playerKey: any) => any;
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
    shouldBuildCardQuiescenceSnapshot?: (level: any, legalMoves: any, context: any, usableCardTypes?: any) => boolean;
    shouldHoldCardByQuiescence: (playerKey: any, level: any, cardId: any, cardDef: any, context: any, snapshot: any) => any;
    shouldUseSharedPolicyTableCoreCardDecision: (level: any) => any;
    warn: (...args: any[]) => void;
};

export function createCpuDecisionCardChoice(config: CpuDecisionCardChoiceConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardChoiceConfig;

    function readCardLogic(): any {
        return cfg.getCardLogic ? cfg.getCardLogic() : null;
    }

    function buildCompatibilityUsabilityAnalysis(playerKey: any): any {
        const ids = typeof cfg.getTargetAwareUsableCardIds === 'function'
            ? cfg.getTargetAwareUsableCardIds(playerKey)
            : [];
        const cardLogic = readCardLogic();
        const usableCardIds = Array.isArray(ids) ? ids.slice() : [];
        const usableCardTypes = usableCardIds.map((cardId: any) => {
            const def = cardLogic && typeof cardLogic.getCardDef === 'function'
                ? cardLogic.getCardDef(cardId)
                : null;
            return String(def && def.type || '');
        });
        return Object.freeze({
            usableCardIds: Object.freeze(usableCardIds),
            usableCardTypes: Object.freeze(usableCardTypes),
            selectorEvidence: Object.freeze({}),
            usableSlots: Object.freeze([])
        });
    }

    function getCardUsabilityAnalysis(playerKey: any): any {
        if (typeof cfg.getTargetAwareCardUsabilityAnalysis === 'function') {
            const analysis = cfg.getTargetAwareCardUsabilityAnalysis(playerKey);
            if (analysis && Array.isArray(analysis.usableCardIds)) return analysis;
        }
        return buildCompatibilityUsabilityAnalysis(playerKey);
    }

    function selectCardFallback(
        cardState: any,
        _gameState: any,
        playerKey: any,
        level: any,
        legalMoves: any,
        prepared: any
    ): any {
        if (typeof cardState === 'undefined' || !cardState) return null;
        const cardLogic = readCardLogic();
        if (!cardLogic) return null;
        const usable = prepared && prepared.usability && Array.isArray(prepared.usability.usableCardIds)
            ? prepared.usability.usableCardIds
            : [];
        if (!usable.length) return null;
        const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
        const decisionContext = prepared && prepared.decisionContext;
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

    function selectCardToUseImpl(
        playerKey: any,
        performanceScope: CpuTurnPerformanceScope | null,
        prepared: any
    ): any {
        const trapId = prepared.trapPrepared === true
            ? (prepared.trapId || null)
            : cfg.prepareCpuTrapOnlyCard(playerKey);
        const level = cfg.resolveCpuSmartnessLevel(playerKey);
        const cardLogic = readCardLogic();
        const currentCardState = cfg.getCardState();
        const currentGameState = cfg.getGameState();
        const currentHand = currentCardState
            && currentCardState.hands
            && Array.isArray(currentCardState.hands[playerKey])
            ? currentCardState.hands[playerKey]
            : [];
        const preparedUsabilityIsCurrent = !!(
            prepared.usability
            && prepared.cardState === currentCardState
            && prepared.gameState === currentGameState
            && prepared.playerKey === playerKey
            && Array.isArray(prepared.handSnapshot)
            && prepared.handSnapshot.length === currentHand.length
            && prepared.handSnapshot.every((cardId: any, index: number) => cardId === currentHand[index])
        );
        const usability = preparedUsabilityIsCurrent
            ? prepared.usability
            : (performanceScope
                ? measureCpuTurnSync(
                    performanceScope,
                    'card-availability',
                    () => getCardUsabilityAnalysis(playerKey)
                )
                : getCardUsabilityAnalysis(playerKey));
        const usableNow = Array.isArray(usability && usability.usableCardIds)
            ? usability.usableCardIds
            : [];
        prepared.cardState = currentCardState;
        prepared.gameState = currentGameState;
        prepared.playerKey = playerKey;
        prepared.level = level;
        prepared.usability = usability;
        prepared.handSnapshot = currentHand.slice();
        if (!cardLogic || usableNow.length === 0) return null;

        const hasPreparedLegalMoves = preparedUsabilityIsCurrent && Array.isArray(prepared.legalMoves);
        const legalMoves = hasPreparedLegalMoves
            ? prepared.legalMoves
            : (() => {
                const player = cfg.resolvePlayerValue(playerKey);
                const protection = cfg.getActiveProtectionForPlayer(player);
                const perma = cfg.getFlipBlockers();
                const safeGameState = cfg.getGameState();
                return cfg.getLegalMoves(safeGameState, protection, perma);
            })();
        const legalMovesCount = Array.isArray(legalMoves) ? legalMoves.length : 0;
        const decisionContext = preparedUsabilityIsCurrent && prepared.decisionContext
            ? prepared.decisionContext
            : cfg.buildCardUseDecisionContext(
                playerKey,
                level,
                legalMovesCount,
                legalMoves,
                usability,
                performanceScope
            );
        const hasPreparedQuiescence = preparedUsabilityIsCurrent && prepared.quiescencePrepared === true;
        const shouldBuildQuiescence = typeof cfg.shouldBuildCardQuiescenceSnapshot === 'function'
            ? cfg.shouldBuildCardQuiescenceSnapshot(
                level,
                legalMoves,
                decisionContext,
                usability && Array.isArray(usability.usableCardTypes) ? usability.usableCardTypes : undefined
            ) !== false
            : true;
        const quiescenceSnapshot = hasPreparedQuiescence
            ? prepared.quiescenceSnapshot
            : (shouldBuildQuiescence
                ? cfg.buildCardQuiescenceSnapshot(playerKey, level, legalMoves, decisionContext)
                : null);
        const cornerPlanState = preparedUsabilityIsCurrent && prepared.cornerPlanState
            ? prepared.cornerPlanState
            : (decisionContext.cornerPlanState || cfg.buildCornerPlanState(playerKey, legalMoves, usableNow));
        prepared.legalMoves = Array.isArray(legalMoves) ? legalMoves : [];
        prepared.legalMovesCount = legalMovesCount;
        prepared.decisionContext = decisionContext;
        prepared.quiescenceSnapshot = quiescenceSnapshot;
        prepared.quiescencePrepared = true;
        prepared.cornerPlanState = cornerPlanState;
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

        if (trapId) {
            if (usableNow.includes(trapId)) {
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
                if (isCardRuntimeUnavailableError(e)) throw e;
                cfg.warn('[CPU] AISystem.selectCardToUse failed', e);
                cardChoice = null;
            }
        }

        if (!cardChoice) {
            const safeCardState = cfg.getCardState();
            const currentGameState = cfg.getGameState();
            cardChoice = selectCardFallback(
                safeCardState,
                currentGameState,
                playerKey,
                level,
                legalMoves,
                prepared
            );
        }
        if (cardChoice && !isAllowedChoice(cardChoice)) {
            return null;
        }
        return cardChoice || null;
    }

    function selectCardDecision(
        playerKey: any,
        performanceScope?: CpuTurnPerformanceScope | null,
        preparedInput?: any
    ): any {
        const resolvedPreparedInput = typeof preparedInput === 'function'
            ? preparedInput()
            : preparedInput;
        const prepared: any = resolvedPreparedInput && typeof resolvedPreparedInput === 'object'
            ? resolvedPreparedInput
            : {};
        let choice = performanceScope
            ? measureCpuTurnSync(
                performanceScope,
                'card-context-base',
                () => selectCardToUseImpl(playerKey, performanceScope, prepared)
            )
            : selectCardToUseImpl(playerKey, null, prepared);
        if (choice && prepared.level >= 6) {
            const safety = shouldHoldTacticallyUnsafeCard({ gameState: cfg.getGameState(), cardState: cfg.getCardState(), playerKey,
                level: prepared.level, cardId: choice.cardId, forceUseCard: prepared.decisionContext?.forceUseCard });
            if (safety.hold) { cfg.cpuDebugLog('[CPU] tactical card hold', safety); choice = null; }
        }
        return { choice: choice || null, prepared };
    }

    function selectCardToUse(playerKey: any, performanceScope?: CpuTurnPerformanceScope | null): any {
        return selectCardDecision(playerKey, performanceScope).choice;
    }

    return {
        selectCardDecision,
        selectCardToUse
    };
}

module.exports = {
    createCpuDecisionCardChoice
};
