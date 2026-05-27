type CpuDecisionCardOnnxConfig = {
    getCpuPolicyCore: () => any;
    resolveCardLogic: () => any;
    resolvePolicyOnnxRuntime: () => any;
    canUseStandardBoardCpuPolicy: (boardRef: any, featureKey: any, playerKey: any, level: any) => any;
    evaluateCpuOnnxLatencyGate: (runtime: any, operation: any, level: any) => any;
    logCpuOnnxLatencyDegrade: (level: any, playerKey: any, operation: any, reason: any) => any;
    resolveCpuLv6OnnxRuntimeBudgetMs: (level: any, operation: any) => any;
    getHandCardIdsForPlayer: (playerKey: any) => any[];
    buildOnnxContext: (playerKey: any, level: any, legalMovesCount: any, handCardIds: any, usableCardIds: any, legalMoves: any) => any;
    awaitCpuPromiseWithinBudget: (promiseFactory: any, budgetMs: any, timeoutValue: any) => Promise<any>;
    getCpuOnnxBudgetTimeout: () => any;
    buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves?: any, usableCardIds?: any) => any;
    resolveCardType: (cardId: any, cardDef?: any) => any;
    isRecoveryCardType: (cardType: any) => any;
    isHoldCardType: (cardType: any) => any;
    isChargeRampCardType: (cardType: any) => any;
    whiteLv6CornerSwingKeepTypes: Set<any>;
    cpuDebugLog: (...args: any[]) => any;
    warn: (...args: any[]) => any;
};

export function createCpuDecisionCardOnnx(config: CpuDecisionCardOnnxConfig): any {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardOnnxConfig;

    function resolveCpuPolicyCore(): any {
        return cfg.getCpuPolicyCore ? cfg.getCpuPolicyCore() : null;
    }

    function resolveCardLogic(): any {
        return cfg.resolveCardLogic ? cfg.resolveCardLogic() : null;
    }

    function canRerankOnnxCardChoice(level: any, usableCardIds: any): any {
        if (!Number.isFinite(level) || level < 6) return false;
        if (!Array.isArray(usableCardIds) || usableCardIds.length <= 1) return false;
        const cpuPolicyCore = resolveCpuPolicyCore();
        if (!cpuPolicyCore || typeof cpuPolicyCore.scoreCardUseDecision !== 'function') return false;
        const cardLogicRef = resolveCardLogic();
        if (!cardLogicRef) return false;
        if (typeof cardLogicRef.getCardCost !== 'function' || typeof cardLogicRef.getCardDef !== 'function') return false;
        return true;
    }

    function scoreCardForOnnxRerank(cardId: any, playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any, prebuiltContext: any): any {
        if (!cardId) return Number.NEGATIVE_INFINITY;
        if (!canRerankOnnxCardChoice(level, usableCardIds)) return Number.NEGATIVE_INFINITY;

        const context = prebuiltContext || cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
        const cardLogicRef = resolveCardLogic();
        const cpuPolicyCore = resolveCpuPolicyCore();
        if (!cardLogicRef || !cpuPolicyCore) return Number.NEGATIVE_INFINITY;
        const decision = cpuPolicyCore.scoreCardUseDecision(
            cardId,
            cardLogicRef.getCardCost,
            cardLogicRef.getCardDef,
            context
        );
        if (!decision || !Number.isFinite(decision.score)) return Number.NEGATIVE_INFINITY;

        const cardDef = cardLogicRef.getCardDef(cardId);
        const cardType = cfg.resolveCardType(cardId, cardDef);
        const whiteLv6Mode = level >= 6 && playerKey === 'white';
        let score = Number(decision.score);

        if (context && context.cornerEmergency === true && cfg.isRecoveryCardType(cardType)) score += 16;
        if (context && context.hasCornerMoveNow === true && cfg.isHoldCardType(cardType)) score += 14;
        if (context && context.cornerHoldMode === true && cfg.isHoldCardType(cardType)) score += 8;
        if (context && context.recoveryCostGap > 0 && cfg.isChargeRampCardType(cardType)) score += 9;
        if (context && context.highBonusMoveAvailable === true && cfg.isChargeRampCardType(cardType)) score += 6;
        if (context && context.hasCornerMoveNow === true && !cfg.isHoldCardType(cardType) && !cfg.isRecoveryCardType(cardType)) score -= 10;
        if (
            whiteLv6Mode &&
            context &&
            context.recoveryCostGap > 0 &&
            !cfg.isChargeRampCardType(cardType) &&
            !cfg.isRecoveryCardType(cardType) &&
            !cfg.isHoldCardType(cardType)
        ) {
            score -= 18;
        }
        if (
            whiteLv6Mode &&
            context &&
            context.cornerEmergency !== true &&
            context.hasCornerMoveNow !== true &&
            cfg.whiteLv6CornerSwingKeepTypes.has(cardType)
        ) {
            score -= 28;
        }
        if (
            whiteLv6Mode &&
            context &&
            context.cornerEmergency === true &&
            cfg.whiteLv6CornerSwingKeepTypes.has(cardType)
        ) {
            score += 20;
        }

        return score;
    }

    function rerankOnnxCardChoice(selectedCardId: any, playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any): any {
        if (!selectedCardId) return { cardId: selectedCardId, changed: false, gap: 0 };
        if (!canRerankOnnxCardChoice(level, usableCardIds)) {
            return { cardId: selectedCardId, changed: false, gap: 0 };
        }

        const context = cfg.buildCardUseDecisionContext(playerKey, level, legalMovesCount, legalMoves, usableCardIds);
        const usable = usableCardIds.filter((id: any) => typeof id === 'string' && id.length > 0);
        if (usable.length <= 1) return { cardId: selectedCardId, changed: false, gap: 0 };

        let bestCardId = selectedCardId;
        let bestScore = scoreCardForOnnxRerank(selectedCardId, playerKey, level, legalMovesCount, legalMoves, usable, context);

        for (const cardId of usable) {
            const score = scoreCardForOnnxRerank(cardId, playerKey, level, legalMovesCount, legalMoves, usable, context);
            if (!Number.isFinite(score)) continue;
            if (!Number.isFinite(bestScore) || score > bestScore) {
                bestScore = score;
                bestCardId = cardId;
                continue;
            }
            if (score === bestScore && String(cardId) < String(bestCardId)) {
                bestCardId = cardId;
            }
        }

        const selectedScore = scoreCardForOnnxRerank(selectedCardId, playerKey, level, legalMovesCount, legalMoves, usable, context);
        const gap = Number.isFinite(bestScore) && Number.isFinite(selectedScore)
            ? (bestScore - selectedScore)
            : Number.POSITIVE_INFINITY;
        const overrideThreshold = (context && (context.cornerEmergency === true || context.hasCornerMoveNow === true)) ? 6 : 12;
        const shouldOverride = bestCardId !== selectedCardId && (gap >= overrideThreshold || !Number.isFinite(selectedScore));

        return {
            cardId: shouldOverride ? bestCardId : selectedCardId,
            changed: shouldOverride,
            gap
        };
    }

    async function selectCardFromOnnxPolicyAsync(playerKey: any, level: any, legalMovesCount: any, usableCardIds: any, legalMoves: any): Promise<any> {
        const runtime = cfg.resolvePolicyOnnxRuntime();
        if (!runtime || typeof runtime.chooseCard !== 'function') return null;
        if (!cfg.canUseStandardBoardCpuPolicy(null, 'onnx-card', playerKey, level)) return null;
        if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
        const filteredUsableCardIds = usableCardIds.slice();
        if (filteredUsableCardIds.length === 0) return null;
        const preGate = cfg.evaluateCpuOnnxLatencyGate(runtime, 'chooseCard', level);
        if (preGate.shouldDegrade) {
            cfg.logCpuOnnxLatencyDegrade(level, playerKey, 'chooseCard', preGate.reason);
            return null;
        }
        const budgetMs = cfg.resolveCpuLv6OnnxRuntimeBudgetMs(level, 'chooseCard');
        const timeoutValue = cfg.getCpuOnnxBudgetTimeout();
        try {
            const handCardIds = cfg.getHandCardIdsForPlayer(playerKey);
            const selectedCardId = await cfg.awaitCpuPromiseWithinBudget(
                () => runtime.chooseCard(
                    filteredUsableCardIds,
                    cfg.buildOnnxContext(playerKey, level, legalMovesCount, handCardIds, filteredUsableCardIds, legalMoves)
                ),
                budgetMs,
                timeoutValue
            );
            if (selectedCardId === timeoutValue) {
                cfg.logCpuOnnxLatencyDegrade(level, playerKey, 'chooseCard', `timeout budget=${budgetMs}ms`);
                return null;
            }
            const postGate = cfg.evaluateCpuOnnxLatencyGate(runtime, 'chooseCard', level);
            if (postGate.shouldDegrade) {
                cfg.logCpuOnnxLatencyDegrade(level, playerKey, 'chooseCard', postGate.reason);
                return null;
            }
            if (!selectedCardId) {
                if (typeof runtime.getStatus === 'function') {
                    const status = runtime.getStatus() || {};
                    if (status.loaded === true && status.hasCardHead === true && status.noCardSupported === true && !status.lastError) {
                        return { hold: true };
                    }
                }
                return null;
            }
            const reranked = rerankOnnxCardChoice(
                selectedCardId,
                playerKey,
                level,
                legalMovesCount,
                legalMoves,
                filteredUsableCardIds
            );
            const resolvedCardId = reranked && reranked.cardId ? reranked.cardId : selectedCardId;
            if (reranked && reranked.changed) {
                cfg.cpuDebugLog(
                    `[CPU] Lv${level} ${playerKey}: ONNXカードを再評価 ${selectedCardId} -> ${resolvedCardId} gap=${Number.isFinite(reranked.gap) ? reranked.gap.toFixed(1) : 'NA'}`
                );
            }
            const cardLogicRef = resolveCardLogic();
            const cardDef = (cardLogicRef && typeof cardLogicRef.getCardDef === 'function')
                ? cardLogicRef.getCardDef(resolvedCardId)
                : null;
            return { cardId: resolvedCardId, cardDef };
        } catch (e) {
            cfg.warn('[CPU] policy-onnx card runtime failed, fallback to default policy', e);
            return null;
        }
    }

    return {
        canRerankOnnxCardChoice,
        scoreCardForOnnxRerank,
        rerankOnnxCardChoice,
        selectCardFromOnnxPolicyAsync
    };
}

module.exports = {
    createCpuDecisionCardOnnx
};
