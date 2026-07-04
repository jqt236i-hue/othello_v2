type CpuDecisionActionDeps = {
    resolvePlayerValue: (playerKey: any) => any;
    getActiveProtectionForPlayer: (playerValue: any) => any;
    getFlipBlockers: () => any;
    getGameState: () => any;
    getLegalMoves: (gameState: any, protection: any, perma: any) => any;
    selectCardToUse: (playerKey: any) => any;
    selectCpuMoveWithPolicy: (legalMoves: any, playerKey: any) => any;
};

export function computeCpuActionWithPolicy(playerKey: any, deps: CpuDecisionActionDeps): any {
    const player = deps.resolvePlayerValue(playerKey);
    const protection = deps.getActiveProtectionForPlayer(player);
    const perma = deps.getFlipBlockers();
    const legalMoves = deps.getLegalMoves(deps.getGameState(), protection, perma) || [];

    if (!legalMoves.length) {
        let cardChoice: any = null;
        try {
            cardChoice = deps.selectCardToUse(playerKey);
        } catch (e) {
            cardChoice = null;
        }
        if (cardChoice && cardChoice.cardId) {
            return { type: 'useCard', cardId: cardChoice.cardId, cardDef: cardChoice.cardDef };
        }
        return { type: 'pass' };
    }

    const move = deps.selectCpuMoveWithPolicy(legalMoves, playerKey);
    return { type: 'move', move };
}

