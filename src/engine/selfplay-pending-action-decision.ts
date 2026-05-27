/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayPendingActionDecisionConfig = {
    buildPendingSelectionAction?: (
        gameState: any,
        cardState: any,
        playerKey: any,
        pendingType: any,
        rng: any,
        pending: any
    ) => any;
};

export function createSelfplayPendingActionDecision(config?: SelfplayPendingActionDecisionConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayPendingActionDecisionConfig;
    const buildPendingSelectionAction = typeof cfg.buildPendingSelectionAction === 'function'
        ? cfg.buildPendingSelectionAction
        : (() => null);

    function decidePendingAction(params: {
        activeGameState: any;
        activeCardState: any;
        playerKey: any;
        pending: any;
        rng: any;
        legalMoves: any[];
    }) {
        const {
            activeGameState,
            activeCardState,
            playerKey,
            pending,
            rng,
            legalMoves
        } = params || {} as any;

        if (!(pending && pending.stage === 'selectTarget')) return null;

        const pendingAction = buildPendingSelectionAction(
            activeGameState,
            activeCardState,
            playerKey,
            pending.type,
            rng,
            pending
        );
        if (pendingAction) {
            return { action: pendingAction, legalMoves };
        }
        return {
            action: { type: 'cancel_card', cancelOptions: { refundCost: false, resetUsage: true } },
            legalMoves
        };
    }

    return {
        decidePendingAction
    };
}
