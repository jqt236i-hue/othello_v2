/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayPendingSelectionBridgeConfig = {
    PendingTargetSelector?: any;
    selectors?: any;
    getLegalMovesForAction?: (gameState: any, cardState: any, playerKey: any) => any[];
    buildCardDecisionContext?: (
        gameState: any,
        cardState: any,
        playerKey: any,
        legalMovesCount: any,
        legalMoves: any,
        usableCardIds?: any
    ) => any;
    CpuPolicyCore?: any;
    CardLogic?: any;
};

export function createSelfplayPendingSelectionBridge(config?: SelfplayPendingSelectionBridgeConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayPendingSelectionBridgeConfig;
    const pendingTargetSelector = cfg.PendingTargetSelector || null;
    const selectors = (cfg.selectors && typeof cfg.selectors === 'object') ? cfg.selectors : {};
    const getLegalMovesForAction = typeof cfg.getLegalMovesForAction === 'function'
        ? cfg.getLegalMovesForAction
        : (() => []);
    const buildCardDecisionContext = typeof cfg.buildCardDecisionContext === 'function'
        ? cfg.buildCardDecisionContext
        : (() => null);
    const cpuPolicyCore = cfg.CpuPolicyCore || null;
    const cardLogic = cfg.CardLogic || null;

    function buildPendingSelectionAction(gameState: any, cardState: any, playerKey: any, pendingType: any, rng: any, pending: any) {
        return pendingTargetSelector.buildPendingSelectionAction({
            gameState,
            cardState,
            playerKey,
            pendingType,
            pending: pending || null,
            rng,
            selectors,
            getLegalMovesForAction,
            buildCardDecisionContext,
            cpuPolicyCore,
            cardLogic
        });
    }

    return {
        buildPendingSelectionAction
    };
}
