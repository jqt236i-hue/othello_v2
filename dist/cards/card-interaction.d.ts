declare function fillDebugHand(): void;
declare function updateCardDetailPanel(): void;
declare function toggleCardDetailExpanded(): void;
declare function onCardClick(cardId: any, ownerKey: any): void;
declare function destroySelectedHandCard(): void;
declare function useSelectedCard(): void;
declare function passCurrentTurn(): void;
declare function cancelPendingSelection(specificPlayerKey: any): void;
declare function cancelPendingDestroy(specificPlayerKey: any): void;
declare const _default: {
    fillDebugHand: typeof fillDebugHand;
    updateCardDetailPanel: typeof updateCardDetailPanel;
    onCardClick: typeof onCardClick;
    destroySelectedHandCard: typeof destroySelectedHandCard;
    useSelectedCard: typeof useSelectedCard;
    toggleCardDetailExpanded: typeof toggleCardDetailExpanded;
    passCurrentTurn: typeof passCurrentTurn;
    cancelPendingDestroy: typeof cancelPendingDestroy;
    cancelPendingSelection: typeof cancelPendingSelection;
};
export = _default;
//# sourceMappingURL=card-interaction.d.ts.map