export {};

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
        if (!pending || pending.stage !== 'selectTarget') return '';
        const simplePromptByType: Record<string, string> = {
            STRONG_WIND_WILL: '移動させる石を選んでください',
            BUOYANCY_WILL: '上方向へ移動させる石を選んでください',
            SUPER_BUOYANCY_WILL: '上方向へ移動させる石を選んでください',
            GRAVITY_WILL: '下方向へ移動させる石を選んでください',
            SUPER_GRAVITY_WILL: '下方向へ移動させる石を選んでください',
            SUPER_ATTRACTION_WILL: pending.firstTarget ? '引き寄せ先のマスを選んでください' : '引き寄せる石を選んでください',
            TELEPORT_WILL: 'テレポートさせる石を選んでください',
            CELL_TELEPORT_WILL: 'マステレポートさせるマスを選んでください',
            SWAP_WITH_ENEMY: '交換する敵石を選んでください',
            TRAP_WILL: '罠を設置する自分の石を選んでください（選択後にターン終了）',
            TEMPT_WILL: '対象の相手特殊石を選んでください',
            CAPTURE_WILL: '捕獲する相手特殊石を選んでください',
            GUARD_WILL: '守る石にする自分の石を選んでください',
            GUARDIAN_GOD: '守護神にする自分の石を選んでください',
            HYPERACTIVE_INHERIT_WILL: '多動を継承する自分の石を選んでください',
            TIME_BOMB: '時限爆弾にする自分の石を選んでください',
            CLONE_WILL: '周囲に空きがある自分の石を選んでください',
            BOARD_EXPANSION_WILL: '左右端マスを選んで盤面を拡張してください',
            BOARD_EXPANSION_GOD: '角マスを選んで盤面を拡張してください',
            CORROSION_WILL: '腐食の対象となる特殊石を選んでください',
            SEED_WILL: '種をまく空きマスを選んでください',
            BLOCKADE_WILL: '封鎖する空きマスを選んでください',
            METEOR_WILL: '隕石で破壊するマスを選んでください',
            FREEZE_WILL: '凍結するマスを選んでください',
            HEAVEN_BLESSING: '候補5枚から1枚選択してください',
            CONDEMN_WILL: '相手手札から破壊する1枚を選択してください'
        };
        if (simplePromptByType[pending.type]) {
            return simplePromptByType[pending.type];
        }
        if (pending.type === 'POSITION_SWAP_WILL') {
            const first = pending.firstTarget;
            return first
                ? `2つ目の石を選んでください（1つ目: ${cfg.posToNotation(first.row, first.col)}）`
                : '1つ目の石を選んでください（全ての石が対象）';
        }
        if (pending.type === 'BOARD_SHRINK_WILL') {
            const selectedCount = Number.isFinite(Number(pending.selectedCount)) ? Number(pending.selectedCount) : 0;
            const maxSelections = Number.isFinite(Number(pending.maxSelections)) ? Number(pending.maxSelections) : 3;
            const remainingSelections = Math.max(0, maxSelections - selectedCount);
            return remainingSelections < maxSelections
                ? `盤面縮小: 外周マスをあと${remainingSelections}つ選んでください`
                : '盤面縮小: 外周マスを3つ選んでください';
        }
        if (pending.type === 'BOARD_SHRINK_GOD') {
            const first = pending.firstTarget;
            return first
                ? `盤面縮小神: ${cfg.posToNotation(first.row, first.col)}から伸ばす辺方向を選んでください`
                : '盤面縮小神: 縮小する辺の角マスを選んでください';
        }
        if (pending.type === 'EXTEND_LIFE_WILL' || pending.type === 'EXTEND_LIFE_GOD') {
            return pending.type === 'EXTEND_LIFE_GOD'
                ? '4倍延命する自分の特殊石を選んでください'
                : '延命する自分の特殊石を選んでください';
        }
        return '破壊対象を選んでください（キャンセル可）';
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
