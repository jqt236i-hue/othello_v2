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
                if (typeof deps.renderCardUI === 'function') deps.renderCardUI();
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
        if (typeof deps.renderCardUI === 'function') deps.renderCardUI();
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
                if (typeof deps.renderCardUI === 'function') deps.renderCardUI();
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
                if (typeof deps.renderCardUI === 'function') deps.renderCardUI();
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
