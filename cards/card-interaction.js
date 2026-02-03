// ===== Card UI State & Interaction (Refactored to use CardLogic) =====

if (typeof CardLogic === 'undefined') {
    console.error('CardLogic is not loaded. Please include game/logic/cards.js');
}

// Note: Debug mode flags are stored on window object:
// - window.DEBUG_HUMAN_VS_HUMAN: HvH mode enabled
// - window.DEBUG_UNLIMITED_USAGE: Unlimited card usage mode

function _getDebugActions() {
    if (typeof DebugActions !== 'undefined') return DebugActions;
    if (typeof require === 'function') {
        try { return require('../game/debug/debug-actions'); } catch (e) { /* ignore */ }
    }
    return null;
}

function ensureDebugActionsLoaded(cb) {
    try {
        if (typeof window === 'undefined') return cb && cb(null);
        if (typeof DebugActions !== 'undefined') return cb && cb(DebugActions);
        if (window.__debugActionsLoading) {
            window.__debugActionsWaiters = window.__debugActionsWaiters || [];
            if (cb) window.__debugActionsWaiters.push(cb);
            return;
        }
        window.__debugActionsLoading = true;
        window.__debugActionsWaiters = window.__debugActionsWaiters || [];
        if (cb) window.__debugActionsWaiters.push(cb);
        const s = document.createElement('script');
        s.src = 'game/debug/debug-actions.js';
        s.async = false;
        s.onload = () => {
            window.__debugActionsLoading = false;
            window.__debugActionsLoaded = true;
            const waiters = window.__debugActionsWaiters || [];
            window.__debugActionsWaiters = [];
            for (const fn of waiters) { try { fn(DebugActions); } catch (e) {} }
        };
        s.onerror = () => {
            window.__debugActionsLoading = false;
            const waiters = window.__debugActionsWaiters || [];
            window.__debugActionsWaiters = [];
            for (const fn of waiters) { try { fn(null); } catch (e) {} }
        };
        document.head.appendChild(s);
    } catch (e) { if (cb) cb(null); }
}
if (typeof window !== 'undefined') {
    window.ensureDebugActionsLoaded = ensureDebugActionsLoaded;
}

let _boardOps = null;
function _getBoardOps() {
    if (_boardOps) return _boardOps;
    if (typeof BoardOps !== 'undefined') return BoardOps;
    if (typeof require === 'function') {
        try { _boardOps = require('../game/logic/board_ops'); } catch (e) { _boardOps = null; }
    }
    return _boardOps;
}

function _emitPresentationEvent(ev) {
    const ops = _getBoardOps();
    if (ops && typeof ops.emitPresentationEvent === 'function') {
        ops.emitPresentationEvent(cardState, ev);
        return true;
    }
    return false;
}

function _runPipelineAction(playerKey, action) {
    if (typeof TurnPipelineUIAdapter === 'undefined' || typeof TurnPipeline === 'undefined') {
        console.error('[CARD_UI] TurnPipeline/Adapter not available for action', action);
        return { ok: false, rejectedReason: 'PIPELINE_UNAVAILABLE' };
    }

    if (action && cardState && typeof cardState.turnIndex === 'number') {
        action.turnIndex = cardState.turnIndex;
    }

    const res = TurnPipelineUIAdapter.runTurnWithAdapter(cardState, gameState, playerKey, action, TurnPipeline);
    if (res.ok === false) return res;

    if (res.nextCardState) cardState = res.nextCardState;
    if (res.nextGameState) gameState = res.nextGameState;

    if (typeof ActionManager !== 'undefined' && ActionManager.ActionManager) {
        try {
            ActionManager.ActionManager.recordAction(action);
            ActionManager.ActionManager.incrementTurnIndex();
        } catch (e) { /* ignore */ }
    }

    if (res.playbackEvents && res.playbackEvents.length) {
        _emitPresentationEvent({ type: 'PLAYBACK_EVENTS', events: res.playbackEvents, meta: { actionType: action.type, cardId: action.useCardId || null } });
    }

    return { ok: true, result: res };
}

// Fill hand with all card types for debug testing
function fillDebugHand() {
    if (!window.DEBUG_HUMAN_VS_HUMAN && !window.DEBUG_UNLIMITED_USAGE) return;
    const shouldFillWhite = window.DEBUG_HUMAN_VS_HUMAN === true;
    const dbg = _getDebugActions();
    if (cardState.debugHandFilled === true) return;
    if (!dbg || typeof dbg.fillDebugHand !== 'function') {
        ensureDebugActionsLoaded((loaded) => {
            if (!loaded || typeof loaded.fillDebugHand !== 'function') {
                console.warn('[CARD_UI] DebugActions.fillDebugHand not available');
                return;
            }
            loaded.fillDebugHand(cardState, { fillWhite: shouldFillWhite });
            addLog('🐛 デバッグ: 全種類のカードを手札に追加');
            if (typeof renderCardUI === 'function') renderCardUI();
        });
        return;
    }
    dbg.fillDebugHand(cardState, { fillWhite: shouldFillWhite });
    addLog('🐛 デバッグ: 全種類のカードを手札に追加');
    if (typeof renderCardUI === 'function') renderCardUI();
}

function updateCardDetailPanel() {
    const nameEl = document.getElementById('card-detail-name');
    const descEl = document.getElementById('card-detail-desc');
    const useBtn = document.getElementById('use-card-btn');
    const reasonEl = document.getElementById('use-card-reason');
    const cancelBtn = document.getElementById('cancel-card-btn');

    if (!nameEl || !descEl || !useBtn || !reasonEl) return;

    const selectedId = cardState.selectedCardId;

    if (selectedId) {
        const cardDef = CardLogic.getCardDef(selectedId);
        nameEl.textContent = cardDef ? cardDef.name : '?';
        descEl.textContent = cardDef && cardDef.desc ? cardDef.desc : '効果はPhase3で実装';
    } else {
        nameEl.textContent = '-';
        descEl.textContent = 'カードを選択してください';
    }

    // Determine if use button should be enabled
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const playerKey = isDebugHvH ? (gameState.currentPlayer === BLACK ? 'black' : 'white') : 'black';
    const isBlackTurn = gameState.currentPlayer === BLACK;
    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true || isDebugHvH;
    const hasSelection = selectedId !== null;
    // 毎ターン1回使用可能（毎ターン開始時にリセット）、ただしデバッグモードでは制限なし
    const hasNotUsedThisTurn = isDebugUnlimited ? true : !cardState.hasUsedCardThisTurnByPlayer[playerKey];
    const canInteract = isDebugUnlimited ? true : (!isProcessing && !isCardAnimating);

    // Check charge (デバッグモードでは無視)
    const cardDef = selectedId ? CardLogic.getCardDef(selectedId) : null;
    const cost = cardDef ? (cardDef.cost || 0) : 0;
    const canAfford = isDebugUnlimited ? true : (cardState.charge[playerKey] || 0) >= cost;

    let canUse = (isBlackTurn || isDebugHvH) && hasSelection && hasNotUsedThisTurn && canInteract && canAfford;
    if (isDebugUnlimited) {
        canUse = (isBlackTurn || isDebugHvH) && hasSelection;
    }
    let reason = '';

    if (!hasSelection) {
        reason = '';
    } else if (!isBlackTurn && !isDebugHvH) {
        reason = '自分のターンではありません';
        canUse = false;
    } else if (!hasNotUsedThisTurn) {
        reason = 'このターンは既に使用済み';
        canUse = false;
        // Diagnostic: unexpected same-turn block
        try { console.warn('[CARD_UI] USE DISABLED - already used this turn', { selectedId, hasUsedThisTurn: cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer[playerKey], playerKey, gameStateCurrentPlayer: gameState && gameState.currentPlayer }); } catch (e) {}
    } else if (!canAfford) {
        reason = '';
        canUse = false;
    } else if (!canInteract) {
        reason = '演出中...';
        canUse = false;
    }

    useBtn.disabled = !canUse;

    if (hasSelection && !canAfford) {
        useBtn.textContent = '布石不足';
        // Diagnostic: log situations where UI shows charge but button disabled unexpectedly
        try {
            const chargeVal = (cardState && cardState.charge) ? cardState.charge[playerKey] : undefined;
            if (typeof chargeVal === 'number' && typeof cost === 'number' && chargeVal >= cost) {
                console.warn('[CARD_UI] USE DISABLED despite sufficient charge', { selectedId, cardId: selectedId, cost, charge: chargeVal, hasUsedThisTurn: cardState.hasUsedCardThisTurnByPlayer && cardState.hasUsedCardThisTurnByPlayer[playerKey], isProcessing: !!isProcessing, isCardAnimating: !!isCardAnimating, currentPlayer: gameState && gameState.currentPlayer });
            }
        } catch (e) { /* ignore */ }
    } else {
        useBtn.textContent = '使用';
    }

    reasonEl.textContent = reason;

    // 選択モード用のキャンセルボタン表示制御
    const pending = cardState.pendingEffectByPlayer[playerKey];
    const selecting = pending && pending.stage === 'selectTarget' &&
        (pending.type === 'DESTROY_ONE_STONE' || pending.type === 'INHERIT_WILL');
    if (cancelBtn) {
        cancelBtn.style.display = selecting ? 'block' : 'none';
        // Add specific listener for HvH mode to ensure it uses the correct context
        cancelBtn.onclick = () => cancelPendingSelection(playerKey);
    }
    if (selecting) {
        reasonEl.textContent = pending.type === 'INHERIT_WILL'
            ? '対象の通常石を選んでください（キャンセル可）'
            : '破壊対象を選んでください（キャンセル可）';
    }
}

function onCardClick(cardId) {
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true || isDebugHvH;
    if (isCardAnimating && !isDebugUnlimited) return;
    if (gameState.currentPlayer !== BLACK && !isDebugHvH) return;

    if (cardState.selectedCardId === cardId) {
        cardState.selectedCardId = null;
    } else {
        cardState.selectedCardId = cardId;
    }

    renderCardUI();
}

function useSelectedCard() {
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true || isDebugHvH;
    if ((isProcessing || isCardAnimating) && !isDebugUnlimited) return;
    if (gameState.currentPlayer !== BLACK && !isDebugHvH) return;
    if (cardState.selectedCardId === null) return;

    // Determine playerKey
    const playerKey = isDebugHvH ? (gameState.currentPlayer === BLACK ? 'black' : 'white') : 'black';

    if (!isDebugUnlimited && cardState.hasUsedCardThisTurnByPlayer[playerKey]) return;

    const cardId = cardState.selectedCardId;
    const cardDef = CardLogic.getCardDef(cardId);

    // Charge Check (in debug mode, skip)
    const cost = cardDef ? cardDef.cost : 0;
    if (!isDebugUnlimited && (cardState.charge[playerKey] || 0) < cost) {
        addLog(`布石不足: ${cardDef ? cardDef.name : cardId} (必要: ${cost}, 所持: ${cardState.charge[playerKey] || 0})`);
        return;
    }

    // Get element for animation before modifying state
    const usedCardEl = document.querySelector(`[data-card-id="${cardId}"]`);

    // Determine ownerKey (actual hand holding the card)
    let ownerKey = playerKey;
    if (isDebugHvH && !cardState.hands[playerKey].includes(cardId)) {
        ownerKey = playerKey === 'black' ? 'white' : 'black';
    }
    const debugOptions = isDebugUnlimited ? { ignoreCost: true, noConsume: true } : null;
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('use_card', playerKey, { useCardId: cardId, useCardOwnerKey: ownerKey, debugOptions })
        : { type: 'use_card', useCardId: cardId, useCardOwnerKey: ownerKey, debugOptions };

    const result = _runPipelineAction(playerKey, action);
    if (!result.ok) {
        addLog(`カード使用に失敗しました`);
        return;
    }

    if (isDebugUnlimited) {
        addLog(`🐛 デバッグ: コスト無視 & 回数制限無視`);
    }

    // Store card def for display
    if (cardDef) {
        cardState.lastUsedCardByPlayer[playerKey] = { id: cardDef.id, name: cardDef.name, desc: cardDef.desc };
    }

    // Log
    const playerName = playerKey === 'black' ? '黒' : '白';
    addLog(`${playerName}がカードを使用: ${cardDef ? cardDef.name : cardId} (布石 -${isDebugUnlimited ? 0 : cost})`);

    // Clear selection
    cardState.selectedCardId = null;

    // Animation
    if (typeof window !== 'undefined') window.isCardAnimating = true; else isCardAnimating = true;

    if (typeof animateCardToCharge === 'function' && usedCardEl) {
        animateCardToCharge(usedCardEl, true).then(() => {
            if (typeof window !== 'undefined') window.isCardAnimating = false; else isCardAnimating = false;
            renderCardUI();
            if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
            else if (typeof renderBoard === 'function') renderBoard();
        });
    } else {
        if (typeof window !== 'undefined') window.isCardAnimating = false; else isCardAnimating = false;
        renderCardUI();
        if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
        else if (typeof renderBoard === 'function') renderBoard();
    }
}

function cancelPendingSelection(specificPlayerKey) {
    const isDebugHvH = window.DEBUG_HUMAN_VS_HUMAN === true;
    const playerKey = specificPlayerKey || (isDebugHvH ? (gameState.currentPlayer === BLACK ? 'black' : 'white') : 'black');

    const pending = cardState.pendingEffectByPlayer[playerKey];
    if (!pending || pending.stage !== 'selectTarget') return;
    if (pending.type !== 'DESTROY_ONE_STONE' && pending.type !== 'INHERIT_WILL') return;

    const isDebugUnlimited = window.DEBUG_UNLIMITED_USAGE === true || isDebugHvH;
    const cancelOptions = isDebugUnlimited ? { refundCost: false, resetUsage: false, noConsume: true } : null;
    const action = (typeof ActionManager !== 'undefined' && ActionManager.ActionManager && typeof ActionManager.ActionManager.createAction === 'function')
        ? ActionManager.ActionManager.createAction('cancel_card', playerKey, { cancelOptions })
        : { type: 'cancel_card', cancelOptions };

    const result = _runPipelineAction(playerKey, action);
    if (!result.ok) {
        addLog(`キャンセルに失敗しました`);
        return;
    }

    addLog(pending.type === 'INHERIT_WILL'
        ? `${playerKey === 'black' ? '黒' : '白'}の意志の継承をキャンセルしました`
        : `${playerKey === 'black' ? '黒' : '白'}の破壊神をキャンセルしました`);
    renderCardUI();
    if (typeof emitBoardUpdate === 'function') emitBoardUpdate();
    else if (typeof renderBoard === 'function') renderBoard();
}

function cancelPendingDestroy(specificPlayerKey) {
    cancelPendingSelection(specificPlayerKey);
}

// Export functions to global window scope for event binding (onclick in HTML etc)
window.fillDebugHand = fillDebugHand;
window.updateCardDetailPanel = updateCardDetailPanel;
window.onCardClick = onCardClick;
window.useSelectedCard = useSelectedCard;
window.cancelPendingDestroy = cancelPendingDestroy;
window.cancelPendingSelection = cancelPendingSelection;
