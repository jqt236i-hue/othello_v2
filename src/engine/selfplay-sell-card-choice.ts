/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplaySellCardChoiceConfig = {
    CpuPolicyCore?: any;
    CardLogic?: any;
    getLegalMovesForAction?: (gameState: any, cardState: any, playerKey: any) => any[];
    buildCardDecisionContext?: (
        gameState: any,
        cardState: any,
        playerKey: any,
        legalMovesCount: any,
        legalMoves: any,
        usableCardIds?: any
    ) => any;
};

export function createSelfplaySellCardChoice(config?: SelfplaySellCardChoiceConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplaySellCardChoiceConfig;
    const cpuPolicyCore = cfg.CpuPolicyCore || null;
    const cardLogic = cfg.CardLogic || null;
    const getLegalMovesForAction = typeof cfg.getLegalMovesForAction === 'function'
        ? cfg.getLegalMovesForAction
        : (() => []);
    const buildCardDecisionContext = typeof cfg.buildCardDecisionContext === 'function'
        ? cfg.buildCardDecisionContext
        : (() => null);

    function chooseSellCardTarget(gameState: any, cardState: any, playerKey: any) {
        const hand = cardState && cardState.hands && Array.isArray(cardState.hands[playerKey])
            ? cardState.hands[playerKey]
            : [];
        if (!hand.length) return null;
        if (cpuPolicyCore && typeof cpuPolicyCore.chooseSellCardTargetByRetention === 'function') {
            const legalMoves = getLegalMovesForAction(gameState, cardState, playerKey);
            const context = buildCardDecisionContext(
                gameState,
                cardState,
                playerKey,
                legalMoves.length,
                legalMoves
            );
            const selected = cpuPolicyCore.chooseSellCardTargetByRetention(
                hand,
                cardLogic.getCardCost,
                cardLogic.getCardDef,
                context
            );
            if (selected && selected.cardId) return selected.cardId;
        }

        let bestId = hand[0];
        let bestCost = -Infinity;
        for (const cardId of hand) {
            const cost = cardLogic.getCardCost(cardId) || 0;
            if (cost > bestCost) {
                bestCost = cost;
                bestId = cardId;
            }
        }
        return bestId;
    }

    return {
        chooseSellCardTarget
    };
}
