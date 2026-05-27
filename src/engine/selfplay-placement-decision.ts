/* eslint-disable @typescript-eslint/no-explicit-any */

type SelfplayPlacementDecisionConfig = {
    Core?: any;
    toPlayerValue?: (playerKey: any) => any;
    getSafeCardContext?: (cardState: any) => any;
    scorePlacementCandidates?: (legalMoves: any, rng: any, context: any, options: any) => any;
};

export function createSelfplayPlacementDecision(config?: SelfplayPlacementDecisionConfig) {
    const cfg = (config && typeof config === 'object') ? config : {} as SelfplayPlacementDecisionConfig;
    const core = cfg.Core || null;
    const toPlayerValue = typeof cfg.toPlayerValue === 'function'
        ? cfg.toPlayerValue
        : ((playerKey: any) => playerKey);
    const getSafeCardContext = typeof cfg.getSafeCardContext === 'function'
        ? cfg.getSafeCardContext
        : (() => null);
    const scorePlacementCandidates = typeof cfg.scorePlacementCandidates === 'function'
        ? cfg.scorePlacementCandidates
        : (() => null);

    function decidePlacementAction(params: {
        activeGameState: any;
        activeCardState: any;
        playerKey: any;
        pending: any;
        legalMoves: any[];
        rng: any;
        options: any;
    }) {
        const {
            activeGameState,
            activeCardState,
            playerKey,
            pending,
            legalMoves,
            rng,
            options
        } = params || {} as any;

        if (!legalMoves.length) {
            const strictLegalMoves = core.getLegalMoves(
                activeGameState,
                toPlayerValue(playerKey),
                getSafeCardContext(activeCardState)
            );
            if (strictLegalMoves.length > 0) {
                const forcedPlacement = scorePlacementCandidates(
                    strictLegalMoves,
                    rng,
                    {
                        gameState: activeGameState,
                        cardState: activeCardState,
                        playerKey,
                        pendingType: pending ? pending.type : null,
                        legalMovesCount: strictLegalMoves.length
                    },
                    options
                );
                const forcedMove = forcedPlacement && forcedPlacement.move
                    ? forcedPlacement.move
                    : strictLegalMoves[0];
                return {
                    action: { type: 'place', row: forcedMove.row, col: forcedMove.col },
                    legalMoves: strictLegalMoves,
                    placementMetrics: forcedPlacement ? forcedPlacement.metrics : null
                };
            }
            return { action: { type: 'pass' }, legalMoves };
        }

        const chosenPlacement = scorePlacementCandidates(
            legalMoves,
            rng,
            {
                gameState: activeGameState,
                cardState: activeCardState,
                playerKey,
                pendingType: pending ? pending.type : null,
                legalMovesCount: legalMoves.length
            },
            options
        );
        const chosenMove = chosenPlacement && chosenPlacement.move ? chosenPlacement.move : legalMoves[0];
        return {
            action: { type: 'place', row: chosenMove.row, col: chosenMove.col },
            legalMoves,
            placementMetrics: chosenPlacement ? chosenPlacement.metrics : null
        };
    }

    return {
        decidePlacementAction
    };
}
