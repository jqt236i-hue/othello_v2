type CpuDecisionCardActionsConfig = {
    getCardState: () => any;
    getGameState: () => any;
    resolveCardLogic: () => any;
    readPendingEffect: (playerKey: any) => any;
    resolveCpuSmartnessLevel: (playerKey: any) => number;
    readCardUseDisplayLevel: (playerKey: any) => number;
    resolvePlayerValue: (playerKey: any) => any;
    getActiveProtectionForPlayer: (playerValue: any) => any[];
    getFlipBlockers: () => any[];
    getLegalMoves: (gameState: any, protection: any, blockers: any) => any[];
    getTargetAwareUsableCardIds: (playerKey: any) => any;
    buildCardUseDecisionContext: (playerKey: any, level: any, legalMovesCount: any, legalMoves: any, usableCardIds: any) => any;
    chooseHandDestroyTargetForCycle: (hand: any, usableCardIds: any, getCardCost: any, getCardDef: any, decisionContext: any) => any;
    runCpuHandDestroyViaPipeline: (playerKey: any, destroyCardId: any) => any;
    runCpuCardUseViaPipeline: (playerKey: any, cardId: any, cardDef: any) => any;
    resolveTurnPipelineUIAdapter: () => any;
    getRuntime: () => any;
    emitCpuSelectionStateChange: () => any;
    emitCardStateChange: () => any;
    emitBoardUpdate: () => any;
    emitLogAdded: (...args: any[]) => any;
    emitPresentationEventForCpu: (event: any) => any;
    emitCpuCardUseLog: (playerKey: any, level: any, cardDefOrNull: any, cardIdOrNull: any) => any;
    cpuDebugLog: (...args: any[]) => any;
    isOthelloModeForCpuDecision: () => boolean;
    selectCardToUse: (playerKey: any) => any;
    warn?: (...args: any[]) => any;
};

export function createCpuDecisionCardActions(config: CpuDecisionCardActionsConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardActionsConfig;

    function readCardState(): any {
        return cfg.getCardState ? cfg.getCardState() : null;
    }

    function readGameState(): any {
        return cfg.getGameState ? cfg.getGameState() : null;
    }

    function resolveCardLogic(): any {
        return cfg.resolveCardLogic ? cfg.resolveCardLogic() : null;
    }

    function selectHandCardToDestroy(playerKey: any): any {
        const cardState = readCardState();
        if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return null;
        if (cfg.readPendingEffect(playerKey)) return null;
        if (typeof cfg.chooseHandDestroyTargetForCycle !== 'function') return null;
        const cardLogicRef = resolveCardLogic();
        if (!cardLogicRef) return null;

        const hand = cardState.hands[playerKey].slice();
        if (hand.length <= 0) return null;

        const level = cfg.resolveCpuSmartnessLevel(playerKey);
        if (level < 4) return null;

        const playerValue = cfg.resolvePlayerValue(playerKey);
        const protection = cfg.getActiveProtectionForPlayer(playerValue);
        const blockers = cfg.getFlipBlockers();
        const gameState = readGameState();
        const legalMoves = cfg.getLegalMoves(gameState, protection, blockers) || [];
        const usableNow = cfg.getTargetAwareUsableCardIds(playerKey);
        const decisionContext = cfg.buildCardUseDecisionContext(playerKey, level, legalMoves.length, legalMoves, usableNow);

        const selected = cfg.chooseHandDestroyTargetForCycle(
            hand,
            usableNow,
            typeof cardLogicRef.getCardCost === 'function' ? cardLogicRef.getCardCost : () => 0,
            typeof cardLogicRef.getCardDef === 'function' ? cardLogicRef.getCardDef : () => null,
            decisionContext
        );
        if (!selected || !selected.cardId) return null;
        return selected;
    }

    function applyHandCardDestroy(playerKey: any, destroyChoice: any): any {
        if (!destroyChoice || !destroyChoice.cardId) return false;
        const cardState = readCardState();
        if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return false;
        if (!cardState.hands[playerKey].includes(destroyChoice.cardId)) return false;

        const destroyCardId = destroyChoice.cardId;
        const cardLogicRef = resolveCardLogic();
        const destroyCardDef = destroyChoice.cardDef || (
            (cardLogicRef && typeof cardLogicRef.getCardDef === 'function')
                ? cardLogicRef.getCardDef(destroyCardId)
                : null
        );
        const pipelineResult = cfg.runCpuHandDestroyViaPipeline(playerKey, destroyCardId);
        if (pipelineResult && pipelineResult.ok) {
            const level = cfg.readCardUseDisplayLevel(playerKey);
            const cardName = (destroyCardDef && destroyCardDef.name) ? destroyCardDef.name : destroyCardId;
            cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 手札破壊 - ${cardName} (${destroyChoice.reason || 'cycle'})`);
            if (typeof cfg.emitLogAdded === 'function') {
                cfg.emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})が手札を破壊: ${cardName}`);
            }
            return true;
        }
        if (pipelineResult && pipelineResult.ok === false) {
            return false;
        }

        if (!cardLogicRef || typeof cardLogicRef.destroyHandCard !== 'function') return false;
        const direct = cardLogicRef.destroyHandCard(cardState, playerKey, destroyCardId);
        if (!direct || !direct.applied) return false;
        cfg.emitCpuSelectionStateChange();

        const level = cfg.readCardUseDisplayLevel(playerKey);
        const cardName = (destroyCardDef && destroyCardDef.name) ? destroyCardDef.name : destroyCardId;
        cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: 手札破壊(direct) - ${cardName} (${destroyChoice.reason || 'cycle'})`);
        if (typeof cfg.emitLogAdded === 'function') {
            cfg.emitLogAdded(`${playerKey === 'black' ? '黒' : '白'}(Lv${level})が手札を破壊: ${cardName}`);
        }
        return true;
    }

    function cpuMaybeDestroyHandCardWithPolicy(playerKey: any): any {
        if (cfg.isOthelloModeForCpuDecision()) return false;
        const cardState = readCardState();
        if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[playerKey])) return false;
        if (cfg.readPendingEffect(playerKey)) return false;

        const destroyChoice = selectHandCardToDestroy(playerKey);
        if (!destroyChoice) return false;
        return applyHandCardDestroy(playerKey, destroyChoice);
    }

    function playCpuCardUseHandAnimation(payload: any): void {
        try {
            const runtime = cfg.getRuntime ? cfg.getRuntime() : null;
            const playFn = runtime && typeof runtime.playCardUseHandAnimation === 'function'
                ? runtime.playCardUseHandAnimation
                : null;
            if (typeof playFn !== 'function') return;
            const visualPlaybackActive = runtime && typeof runtime.isVisualPlaybackActive === 'function'
                ? runtime.isVisualPlaybackActive() === true
                : false;
            if (visualPlaybackActive) return;
            const result = playFn(payload);
            if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch (e) { /* ignore */ }
    }

    function applyCardChoice(playerKey: any, cardChoice: any): any {
        if (!cardChoice) return false;
        const { cardId, cardDef } = cardChoice;
        const cardState = readCardState();
        const gameState = readGameState();
        if (cardState.hands[playerKey].indexOf(cardId) === -1) return false;
        const level = cfg.readCardUseDisplayLevel(playerKey);
        const fallbackCardCost = (cardDef && Number.isFinite(cardDef.cost)) ? cardDef.cost : null;
        const fallbackCardName = (cardDef && cardDef.name) ? cardDef.name : null;
        const pipelineResult = cfg.runCpuCardUseViaPipeline(playerKey, cardId, cardDef);
        if (pipelineResult && pipelineResult.ok) {
            const appliedCardId = pipelineResult.appliedCardId || cardId;
            const appliedCardDef = pipelineResult.appliedCardDef || cardDef;

            cfg.emitCpuCardUseLog(playerKey, level, appliedCardDef, appliedCardId);
            return true;
        }
        if (pipelineResult && pipelineResult.ok === false) {
            const rejectedReason = pipelineResult.res && pipelineResult.res.rejectedReason
                ? pipelineResult.res.rejectedReason
                : 'PIPELINE_REJECTED';
            cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用拒否(${rejectedReason}) - ${cardDef ? cardDef.name : cardId}`);
            return false;
        }

        const cardLogicRef = resolveCardLogic();
        if (!cardLogicRef || typeof cardLogicRef.applyCardUsage !== 'function') {
            const warn = typeof cfg.warn === 'function' ? cfg.warn : console.warn;
            warn('[CPU] CardLogic.applyCardUsage not available, skipping card use');
            return false;
        }
        const ok = cardLogicRef.applyCardUsage(cardState, gameState, playerKey, cardId);
        if (!ok) return false;

        let emittedCardUsePlayback = false;
        try {
            if (typeof cardLogicRef.flushPresentationEvents === 'function') {
                const pipelineUiAdapter = cfg.resolveTurnPipelineUIAdapter();
                if (pipelineUiAdapter && typeof pipelineUiAdapter.mapToPlaybackEvents === 'function') {
                    const pres = cardLogicRef.flushPresentationEvents(cardState) || [];
                    const playback = pipelineUiAdapter.mapToPlaybackEvents(pres, cardState, gameState) || [];
                    if (playback.length > 0) {
                        cfg.emitPresentationEventForCpu({ type: 'PLAYBACK_EVENTS', events: playback, meta: { source: 'cpu_card_use' } });
                        emittedCardUsePlayback = true;
                    } else {
                        for (const ev of pres) cfg.emitPresentationEventForCpu(ev);
                    }
                }
            }
        } catch (e) {
            // Keep game flow even if animation conversion fails.
        }
        if (!emittedCardUsePlayback) {
            cfg.emitPresentationEventForCpu({
                type: 'PLAYBACK_EVENTS',
                events: [{
                    type: 'card_use_animation',
                    phase: 1,
                    targets: [{
                        player: playerKey,
                        owner: playerKey,
                        cardId: cardId,
                        cost: fallbackCardCost,
                        name: fallbackCardName
                    }]
                }],
                meta: { source: 'cpu_card_use_fallback' }
            });
        }

        playCpuCardUseHandAnimation({
            player: playerKey,
            owner: playerKey,
            cardId: cardId,
            cost: fallbackCardCost,
            name: fallbackCardName
        });

        cfg.emitCpuCardUseLog(playerKey, level, cardDef || null, cardId || null);

        if (typeof cfg.emitCardStateChange === 'function') cfg.emitCardStateChange();
        if (typeof cfg.emitBoardUpdate === 'function') cfg.emitBoardUpdate();

        return true;
    }

    function cpuMaybeUseCardWithPolicy(playerKey: any): any {
        if (cfg.isOthelloModeForCpuDecision()) return false;
        const cardState = readCardState();
        if (!cardState || !cardState.hasUsedCardThisTurnByPlayer) {
            const warn = typeof cfg.warn === 'function' ? cfg.warn : console.warn;
            warn('[CPU] cardState not initialized; skipping card use');
            return false;
        }
        if (cardState.hasUsedCardThisTurnByPlayer[playerKey]) return false;

        const level = cfg.readCardUseDisplayLevel(playerKey);
        const cardChoice = cfg.selectCardToUse(playerKey);
        if (!cardChoice) {
            cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カードスキップ (no candidate)`);
            return false;
        }

        if (applyCardChoice(playerKey, cardChoice)) return true;

        const cardLogicRef = resolveCardLogic();
        if (cardLogicRef) {
            const usable = cfg.getTargetAwareUsableCardIds(playerKey);
            for (const id of usable) {
                if (id === (cardChoice && cardChoice.cardId)) continue;
                const def = cardLogicRef.getCardDef ? cardLogicRef.getCardDef(id) : null;
                if (applyCardChoice(playerKey, { cardId: id, cardDef: def })) return true;
            }
        }

        cfg.cpuDebugLog(`[CPU] Lv${level} ${playerKey}: カード使用に失敗`);
        return false;
    }

    return {
        selectHandCardToDestroy,
        applyHandCardDestroy,
        cpuMaybeDestroyHandCardWithPolicy,
        playCpuCardUseHandAnimation,
        applyCardChoice,
        cpuMaybeUseCardWithPolicy
    };
}
