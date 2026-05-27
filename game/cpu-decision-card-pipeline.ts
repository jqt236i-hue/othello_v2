type CpuDecisionCardPipelineConfig = {
    resolveTurnPipelineAdapter: () => any;
    resolveTurnPipeline: () => any;
    createAction: (actionType: any, playerKey: any, actionPayload: any) => any;
    getCardState: () => any;
    getGameState: () => any;
    setCardState: (nextCardState: any) => void;
    setGameState: (nextGameState: any) => void;
    getLastUsedCardId: (playerKey: any) => any;
    resolveCardDef: (cardId: any, fallbackCardDef: any) => any;
    emitPresentationEventForCpu: (event: any) => any;
    emitCpuSelectionStateChange: () => any;
};

export function createCpuDecisionCardPipeline(config: CpuDecisionCardPipelineConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as CpuDecisionCardPipelineConfig;

    function resolveAppliedCardMeta(playerKey: any, fallbackCardId: any, fallbackCardDef: any): any {
        const appliedCardId = cfg.getLastUsedCardId(playerKey) || fallbackCardId;
        const appliedCardDef = cfg.resolveCardDef(appliedCardId, fallbackCardDef) || fallbackCardDef || null;
        const appliedCardCost = (appliedCardDef && Number.isFinite(appliedCardDef.cost)) ? appliedCardDef.cost : null;
        const appliedCardName = (appliedCardDef && appliedCardDef.name) ? appliedCardDef.name : null;
        return { appliedCardId, appliedCardDef, appliedCardCost, appliedCardName };
    }

    function normalizeCardUsePlaybackEvents(playbackEvents: any, playerKey: any, cardMeta: any): any {
        const events = Array.isArray(playbackEvents) ? playbackEvents : [];
        const meta = cardMeta || {};
        return events.map((ev: any) => {
            if (!ev || ev.type !== 'card_use_animation') return ev;
            const targets = Array.isArray(ev.targets) ? ev.targets : [];
            const normalizedTargets = targets.length > 0
                ? targets.map((t: any) => Object.assign({}, t, {
                    cardId: meta.appliedCardId,
                    cost: meta.appliedCardCost,
                    name: meta.appliedCardName
                }))
                : [{
                    player: playerKey,
                    owner: playerKey,
                    cardId: meta.appliedCardId,
                    cost: meta.appliedCardCost,
                    name: meta.appliedCardName
                }];
            return Object.assign({}, ev, { targets: normalizedTargets });
        });
    }

    function runCpuCardUseViaPipeline(playerKey: any, cardId: any, cardDef: any): any {
        const adapter = cfg.resolveTurnPipelineAdapter();
        const pipeline = cfg.resolveTurnPipeline();
        if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

        const cardState = cfg.getCardState();
        const gameState = cfg.getGameState();
        const actionPayload = {
            useCardId: cardId,
            useCardOwnerKey: playerKey
        };
        const action = cfg.createAction('use_card', playerKey, actionPayload);

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
        if (!res || res.ok === false) {
            return { ok: false, res };
        }

        if (res.nextCardState) cfg.setCardState(res.nextCardState);
        if (res.nextGameState) cfg.setGameState(res.nextGameState);

        const cardMeta = resolveAppliedCardMeta(playerKey, cardId, cardDef);

        let emittedCardUsePlayback = false;
        if (res.playbackEvents && res.playbackEvents.length) {
            const normalizedPlaybackEvents = normalizeCardUsePlaybackEvents(res.playbackEvents, playerKey, cardMeta);
            cfg.emitPresentationEventForCpu({
                type: 'PLAYBACK_EVENTS',
                events: normalizedPlaybackEvents,
                meta: { source: 'cpu_card_use_pipeline', cardId: cardMeta.appliedCardId || null }
            });
            emittedCardUsePlayback = true;
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
                        cardId: cardMeta.appliedCardId,
                        cost: cardMeta.appliedCardCost,
                        name: cardMeta.appliedCardName
                    }]
                }],
                meta: { source: 'cpu_card_use_pipeline_fallback' }
            });
        }

        cfg.emitCpuSelectionStateChange();
        return {
            ok: true,
            res,
            emittedCardUsePlayback,
            appliedCardId: cardMeta.appliedCardId,
            appliedCardDef: cardMeta.appliedCardDef,
            appliedCardCost: cardMeta.appliedCardCost,
            appliedCardName: cardMeta.appliedCardName
        };
    }

    function runCpuHandDestroyViaPipeline(playerKey: any, destroyCardId: any): any {
        const adapter = cfg.resolveTurnPipelineAdapter();
        const pipeline = cfg.resolveTurnPipeline();
        if (!adapter || !pipeline || typeof adapter.runTurnWithAdapter !== 'function') return null;

        const cardState = cfg.getCardState();
        const gameState = cfg.getGameState();
        const actionPayload = { destroyCardId };
        const action = cfg.createAction('destroy_hand_card', playerKey, actionPayload);

        if (action && cardState && typeof cardState.turnIndex === 'number') {
            action.turnIndex = cardState.turnIndex;
        }

        const res = adapter.runTurnWithAdapter(cardState, gameState, playerKey, action, pipeline);
        if (!res || res.ok === false) {
            return { ok: false, res };
        }

        if (res.nextCardState) cfg.setCardState(res.nextCardState);
        if (res.nextGameState) cfg.setGameState(res.nextGameState);
        cfg.emitCpuSelectionStateChange();
        return {
            ok: true,
            res
        };
    }

    return {
        resolveAppliedCardMeta,
        normalizeCardUsePlaybackEvents,
        runCpuCardUseViaPipeline,
        runCpuHandDestroyViaPipeline
    };
}
