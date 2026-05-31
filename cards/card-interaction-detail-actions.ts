export {};

import PendingSelectionUiMetadata = require('./pending-selection-ui-metadata');

type CardInteractionDetailActionsDeps = {
    isAutoModeActive: () => boolean;
    canInputPlayerActNow: () => boolean;
    isDebugUnlimitedUsage: () => boolean;
    ensureHandDestroyFlags: () => any;
    hasPlayerUsedCardThisActiveTurn: (playerKey: any) => boolean;
    canInteractWithCardUi: () => boolean;
    isSelectionSettlementLocked: () => boolean;
    getCardDef: (cardId: any) => any;
    getCardStateValue: () => any;
    isSelectedCardUsableNow: (playerKey: any, cardId: any, options?: any) => boolean;
    getLegalMovesForCurrentPlayer: () => any[];
    isVisualPlaybackRunningNow: () => boolean;
    isStaleVisualPlaybackLock: () => boolean;
    isReversiMode: () => boolean;
    getDocumentRef: () => Document | null;
    posToNotation: (row: any, col: any) => string;
};

export function createCardInteractionDetailActions(deps: CardInteractionDetailActionsDeps) {
    const cfg = (deps && typeof deps === 'object') ? deps : {} as CardInteractionDetailActionsDeps;

    function resolveCardDetailActionState(selectionContext: any) {
        const context = selectionContext || {};
        const cardStateValue = typeof cfg.getCardStateValue === 'function' ? (cfg.getCardStateValue() || {}) : {};
        const playerKey = context.playerKey;
        const isAutoMode = cfg.isAutoModeActive();
        const canActThisTurn = cfg.canInputPlayerActNow();
        const isDebugUnlimited = cfg.isDebugUnlimitedUsage();
        cfg.ensureHandDestroyFlags();
        const hasNotUsedThisTurn = isDebugUnlimited ? true : !cfg.hasPlayerUsedCardThisActiveTurn(playerKey);
        const canInteract = isDebugUnlimited ? true : cfg.canInteractWithCardUi();
        const selectionSettlementLocked = isDebugUnlimited
            ? false
            : (typeof cfg.isSelectionSettlementLocked === 'function' && cfg.isSelectionSettlementLocked() === true);
        const selectedCardDef = context.hasSelection ? cfg.getCardDef(context.selectedId) : null;
        const cost = selectedCardDef ? (selectedCardDef.cost || 0) : 0;
        const chargeByPlayer = cardStateValue && cardStateValue.charge ? cardStateValue.charge : {};
        const canAfford = isDebugUnlimited ? true : (chargeByPlayer[playerKey] || 0) >= cost;
        const canUseSelectedCardByRules = !!(context.hasSelection && cfg.isSelectedCardUsableNow(
            playerKey,
            context.selectedId,
            isDebugUnlimited ? { skipCostAndTurnLimit: true } : undefined
        ));
        const noLegalMoves = cfg.getLegalMovesForCurrentPlayer().length === 0;
        const pendingByPlayer = cardStateValue && cardStateValue.pendingEffectByPlayer ? cardStateValue.pendingEffectByPlayer : {};
        const pending = pendingByPlayer[playerKey];
        const isSelectingTarget = !!(pending && pending.stage === 'selectTarget');
        const isHeavenSelecting = !!(
            pending
            && (pending.type === 'HEAVEN_BLESSING' || pending.type === 'CONDEMN_WILL')
            && pending.stage === 'selectTarget'
        );

        let canUse = !isAutoMode
            && canActThisTurn
            && context.hasSelection
            && hasNotUsedThisTurn
            && canInteract
            && canAfford
            && canUseSelectedCardByRules;
        if (isDebugUnlimited) {
            canUse = !!context.hasSelection;
        }
        let canDestroy = !isAutoMode && canActThisTurn && context.hasSelection && canInteract;
        if (isDebugUnlimited) {
            canDestroy = !!context.hasSelection;
        }
        let reason = '';

        if (!context.hasSelection) {
            reason = context.selectedId ? '自分の手札からカードを選択してください' : '';
        } else if (!isDebugUnlimited && !canActThisTurn) {
            reason = '自分のターンではありません';
            canUse = false;
        } else if (isAutoMode) {
            reason = 'AUTO進行中...';
            canUse = false;
        } else if (!hasNotUsedThisTurn) {
            reason = 'このターンは既に使用済み';
            canUse = false;
        } else if (!canAfford) {
            reason = '';
            canUse = false;
        } else if (!canUseSelectedCardByRules) {
            reason = '現在このカードは使用できません（対象不足など）';
            canUse = false;
        } else if (!canInteract) {
            reason = '演出中...';
            canUse = false;
        }

        const canShowPass = canActThisTurn && noLegalMoves && !isSelectingTarget;
        const canPassWhileBusy = !cfg.isVisualPlaybackRunningNow() || cfg.isStaleVisualPlaybackLock();
        const canPass = !selectionSettlementLocked && !isAutoMode && canShowPass && (canInteract || canPassWhileBusy);

        return {
            canActThisTurn,
            isDebugUnlimited,
            canInteract,
            selectedCardDef,
            cost,
            canAfford,
            pending,
            isSelectingTarget,
            isHeavenSelecting,
            canUse,
            canDestroy,
            canShowPass,
            canPass,
            reason
        };
    }

    function syncReversiPassButton(actionState: any) {
        const documentRef = typeof cfg.getDocumentRef === 'function' ? cfg.getDocumentRef() : null;
        if (!documentRef) return;
        const passBtn = (documentRef.getElementById('reversi-pass-btn') || documentRef.getElementById('othello-pass-btn')) as HTMLButtonElement | null;
        if (!passBtn) return;
        const shouldShow = cfg.isReversiMode() && !!(actionState && actionState.canShowPass);
        passBtn.hidden = !shouldShow;
        passBtn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
        passBtn.disabled = !shouldShow || !(actionState && actionState.canPass);
    }

    function getPendingSelectionPrompt(pending: any) {
        return PendingSelectionUiMetadata.getPendingSelectionPrompt(pending, {
            posToNotation: cfg.posToNotation
        });
    }

    return {
        resolveCardDetailActionState,
        syncReversiPassButton,
        getPendingSelectionPrompt
    };
}

module.exports = {
    createCardInteractionDetailActions
};
