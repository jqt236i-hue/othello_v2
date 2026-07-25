export {};

type OverlaySelectionDeps = {
    getCardStateValue: () => any;
    getGameStateValue: () => any;
    pendingSelectionFlowModule?: any;
    actionManager?: any;
    canInteractWithCardUi: () => boolean;
    setPendingSelectionBusy: (active: any) => any;
    playUiEffectSound: (effectKey: any) => any;
    resolveCardDef: (cardId: any) => any;
    startNetworkOnlyPendingSelectionPublish: (options: any) => boolean;
    clearHeavenSelection: (playerKey: any) => any;
    hideHeavenOverlay: () => any;
    runPipelineAction: (playerKey: any, action: any) => any;
    addLog: (message: any) => any;
    requestCardUiSync?: (reason?: any) => any;
    renderCardUI?: () => any;
    emitBoardUpdate?: () => any;
    renderBoard?: () => any;
    hasHandRemovePlaybackEvent: (runResult: any) => boolean;
    renderCardUiWithOptionalPlaybackDelay: (shouldDelay: any, options: any) => any;
    ensureCurrentPlayerCanActOrPass?: any;
    ensureCurrentPlayerCanActOrPassSafely: () => any;
    getRunResultPlaybackEvents: (runResult: any) => any[];
    getCardDisplayLabel: (cardId: any, cardDef: any) => any;
};

function requestCardUiRefresh(deps: OverlaySelectionDeps, reason: any) {
    if (typeof deps.requestCardUiSync === 'function') {
        try {
            deps.requestCardUiSync(reason);
            return;
        } catch (e) { /* fall through to direct render */ }
    }
    if (typeof deps.renderCardUI === 'function') deps.renderCardUI();
}

function createPendingSelectionAction(playerKey: any, pendingType: any, actionPayload: any, deps: OverlaySelectionDeps) {
    const cardStateValue = deps.getCardStateValue();
    if (deps.pendingSelectionFlowModule && typeof deps.pendingSelectionFlowModule.createPendingSelectionAction === 'function') {
        return deps.pendingSelectionFlowModule.createPendingSelectionAction(playerKey, pendingType, actionPayload, { cardState: cardStateValue });
    }
    const actionManager = deps.actionManager;
    const action = (actionManager && actionManager.ActionManager && typeof actionManager.ActionManager.createAction === 'function')
        ? actionManager.ActionManager.createAction('place', playerKey, actionPayload)
        : Object.assign({ type: 'place' }, actionPayload || {});
    if (action && cardStateValue && typeof cardStateValue.turnIndex === 'number') {
        action.turnIndex = cardStateValue.turnIndex;
    }
    return action;
}

function hasCurrentPendingSelection(playerKey: any, pendingType: any, deps: OverlaySelectionDeps): boolean {
    const state = deps.getCardStateValue();
    const normalizedPlayerKey = String(playerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
    const pending = state
        && state.pendingEffectByPlayer
        && typeof state.pendingEffectByPlayer === 'object'
        ? state.pendingEffectByPlayer[normalizedPlayerKey]
        : null;
    if (!pending || typeof pending !== 'object') return false;
    const currentType = String(pending.type || '').trim().toUpperCase();
    const expectedType = String(pendingType || '').trim().toUpperCase();
    if (!currentType || currentType !== expectedType) return false;
    return !pending.stage || String(pending.stage) === 'selectTarget';
}

function finalizePendingSelectionAfterRun(playerKey: any, pendingType: any, runResult: any, deps: OverlaySelectionDeps) {
    const playbackEvents = deps.getRunResultPlaybackEvents(runResult);
    if (!deps.pendingSelectionFlowModule || typeof deps.pendingSelectionFlowModule.finalizePendingSelectionFlow !== 'function') {
        deps.setPendingSelectionBusy(false);
        deps.ensureCurrentPlayerCanActOrPassSafely();
        return;
    }
    Promise.resolve().then(() => deps.pendingSelectionFlowModule.finalizePendingSelectionFlow({
        playerKey,
        pendingType,
        playbackEvents,
        gameStateValue: deps.getGameStateValue(),
        cardStateValue: deps.getCardStateValue(),
        ensureCurrentPlayerCanActOrPass: typeof deps.ensureCurrentPlayerCanActOrPass === 'function'
            ? deps.ensureCurrentPlayerCanActOrPass
            : null
    })).then(() => {
        deps.setPendingSelectionBusy(false);
    }).catch(() => {
        deps.setPendingSelectionBusy(false);
        deps.ensureCurrentPlayerCanActOrPassSafely();
    });
}

function executeHeavenSelection(playerKey: any, selectedCardId: any, deps: OverlaySelectionDeps) {
    if (!selectedCardId) return { ok: false, reason: 'no_selection' };
    if (!deps.canInteractWithCardUi()) return { ok: false, reason: 'busy' };
    if (!hasCurrentPendingSelection(playerKey, 'HEAVEN_BLESSING', deps)) {
        requestCardUiRefresh(deps, 'card-interaction:stale-heaven-selection');
        return { ok: false, reason: 'pending_unavailable' };
    }
    deps.setPendingSelectionBusy(true);
    deps.playUiEffectSound('treasure_gain');
    let completed = false;
    try {
        const def = deps.resolveCardDef(selectedCardId);
        const action = createPendingSelectionAction(playerKey, 'HEAVEN_BLESSING', { heavenBlessingCardId: selectedCardId }, deps);
        if (deps.startNetworkOnlyPendingSelectionPublish({
            playerKey,
            action,
            onSuccess: () => {
                deps.clearHeavenSelection(playerKey);
                deps.hideHeavenOverlay();
            },
            onFailure: () => {
                requestCardUiRefresh(deps, 'card-interaction:heaven-selection-publish-failure');
                deps.addLog('天の恵みの選択送信に失敗しました');
            }
        })) {
            completed = true;
            return { ok: true, publishedByNetwork: true };
        }
        const result = deps.runPipelineAction(playerKey, action);
        if (!result.ok) return result;
        deps.addLog(`${playerKey === 'black' ? '黒' : '白'}が天の恵みで${def ? def.name : selectedCardId}を獲得`);
        deps.clearHeavenSelection(playerKey);
        deps.hideHeavenOverlay();
        requestCardUiRefresh(deps, 'card-interaction:heaven-selection');
        if (typeof deps.emitBoardUpdate === 'function') deps.emitBoardUpdate();
        else if (typeof deps.renderBoard === 'function') deps.renderBoard();
        finalizePendingSelectionAfterRun(playerKey, 'HEAVEN_BLESSING', result, deps);
        completed = true;
        return { ok: true };
    } finally {
        if (!completed) deps.setPendingSelectionBusy(false);
    }
}

function executeCondemnSelection(playerKey: any, targetIndex: any, targetCardId: any, deps: OverlaySelectionDeps) {
    if (!Number.isInteger(targetIndex)) return { ok: false, reason: 'no_selection' };
    if (!deps.canInteractWithCardUi()) return { ok: false, reason: 'busy' };
    if (!hasCurrentPendingSelection(playerKey, 'CONDEMN_WILL', deps)) {
        requestCardUiRefresh(deps, 'card-interaction:stale-condemn-selection');
        return { ok: false, reason: 'pending_unavailable' };
    }
    deps.setPendingSelectionBusy(true);
    let completed = false;
    try {
        const targetDef = deps.resolveCardDef(targetCardId);
        const action = createPendingSelectionAction(playerKey, 'CONDEMN_WILL', { condemnTargetIndex: targetIndex }, deps);
        if (deps.startNetworkOnlyPendingSelectionPublish({
            playerKey,
            action,
            onSuccess: () => {
                deps.clearHeavenSelection(playerKey);
                deps.hideHeavenOverlay();
            },
            onFailure: () => {
                requestCardUiRefresh(deps, 'card-interaction:condemn-selection-publish-failure');
                deps.addLog('断罪の意志の選択送信に失敗しました');
            }
        })) {
            completed = true;
            return { ok: true, publishedByNetwork: true };
        }
        const result = deps.runPipelineAction(playerKey, action);
        if (!result.ok) return result;
        deps.addLog(`${playerKey === 'black' ? '黒' : '白'}が断罪の意志で${deps.getCardDisplayLabel(targetCardId, targetDef)}を破壊`);
        deps.clearHeavenSelection(playerKey);
        deps.hideHeavenOverlay();
        const shouldDelayPostActionHandVisual = deps.hasHandRemovePlaybackEvent(result);
        deps.renderCardUiWithOptionalPlaybackDelay(shouldDelayPostActionHandVisual, null);
        if (typeof deps.emitBoardUpdate === 'function') deps.emitBoardUpdate();
        else if (typeof deps.renderBoard === 'function') deps.renderBoard();
        finalizePendingSelectionAfterRun(playerKey, 'CONDEMN_WILL', result, deps);
        completed = true;
        return { ok: true };
    } finally {
        if (!completed) deps.setPendingSelectionBusy(false);
    }
}

function executeObserverWillSelection(playerKey: any, targetIndex: any, targetCardId: any, deps: OverlaySelectionDeps) {
    if (!Number.isInteger(targetIndex)) return { ok: false, reason: 'no_selection' };
    if (!deps.canInteractWithCardUi()) return { ok: false, reason: 'busy' };
    if (!hasCurrentPendingSelection(playerKey, 'OBSERVER_WILL', deps)) {
        requestCardUiRefresh(deps, 'card-interaction:stale-observer-selection');
        return { ok: false, reason: 'pending_unavailable' };
    }
    deps.setPendingSelectionBusy(true);
    let completed = false;
    try {
        const targetDef = deps.resolveCardDef(targetCardId);
        const action = createPendingSelectionAction(playerKey, 'OBSERVER_WILL', { observerWillTargetIndex: targetIndex }, deps);
        if (deps.startNetworkOnlyPendingSelectionPublish({
            playerKey,
            action,
            onSuccess: () => {
                deps.clearHeavenSelection(playerKey);
                deps.hideHeavenOverlay();
            },
            onFailure: () => {
                requestCardUiRefresh(deps, 'card-interaction:observer-selection-publish-failure');
                deps.addLog('盤理の観測者の選択送信に失敗しました');
            }
        })) {
            completed = true;
            return { ok: true, publishedByNetwork: true };
        }
        const result = deps.runPipelineAction(playerKey, action);
        if (!result.ok) return result;
        deps.addLog(`${playerKey === 'black' ? '黒' : '白'}が盤理の観測者で${deps.getCardDisplayLabel(targetCardId, targetDef)}を獲得`);
        deps.clearHeavenSelection(playerKey);
        deps.hideHeavenOverlay();
        const shouldDelayPostActionHandVisual = deps.hasHandRemovePlaybackEvent(result);
        deps.renderCardUiWithOptionalPlaybackDelay(shouldDelayPostActionHandVisual, null);
        if (typeof deps.emitBoardUpdate === 'function') deps.emitBoardUpdate();
        else if (typeof deps.renderBoard === 'function') deps.renderBoard();
        finalizePendingSelectionAfterRun(playerKey, 'OBSERVER_WILL', result, deps);
        completed = true;
        return { ok: true };
    } finally {
        if (!completed) deps.setPendingSelectionBusy(false);
    }
}

module.exports = {
    createPendingSelectionAction,
    finalizePendingSelectionAfterRun,
    executeHeavenSelection,
    executeCondemnSelection,
    executeObserverWillSelection
};
