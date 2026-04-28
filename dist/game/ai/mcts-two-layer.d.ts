/**
 * @file mcts-two-layer.ts
 * @description Two-layer MCTS (Duelyst-style IMC) for Card Othello.
 *
 * Layer 1: Card selection (NO_CARD or use a card)
 * Layer 2: Placement search (standard MCTS after card effect)
 *
 * This allows the model to evaluate card+placement combinations jointly
 * instead of deciding the card only at the root.
 */
declare class TwoLayerMCTS {
    gameInterface: any;
    network: any;
    cardSimulations: number;
    placementSimulations: number;
    maxCardOptions: number;
    c_puct: number;
    temperature: number;
    nodeMap: Map<string, any>;
    constructor({ gameInterface, network, cardSimulations, placementSimulations, maxCardOptions, c_puct, temperature, }: {
        gameInterface: any;
        network: any;
        cardSimulations?: number;
        placementSimulations?: number;
        maxCardOptions?: number;
        c_puct?: number;
        temperature?: number;
    });
    search(rootState: any, rootCardState: any, rootPlayerKey: string): Promise<{
        cardId: string | null;
        placement: any;
    }>;
    _getCardOptions(cardState: any, playerKey: string): (string | null)[];
    _evaluateCardOption(cardId: string | null, state: any, cardState: any, playerKey: string): Promise<number>;
    _runPlacementMCTS(state: any, cardState: any, playerKey: string): Promise<any>;
    _applyCard(state: any, cardState: any, cardId: string, playerKey: string): {
        state: any;
        cardState: any;
    };
    _opportunityCost(cardId: string | null): number;
}
declare const _default: {
    TwoLayerMCTS: typeof TwoLayerMCTS;
};
export = _default;
//# sourceMappingURL=mcts-two-layer.d.ts.map