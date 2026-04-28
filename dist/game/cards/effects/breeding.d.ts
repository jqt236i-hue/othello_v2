/**
 * @file breeding.ts
 * @description Breeding effects wrapper (delegates to game/logic/cards/breeding.js)
 */
declare const exports: {
    processBreedingEffects: (cardState: any, gameState: any, playerKey: any, prng: any, deps?: {}) => {
        spawned: any[];
        destroyed: any[];
        flipped: any[];
        anchors: any[];
    };
    processBreedingEffectsAtAnchor: (cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}) => {
        spawned: any[];
        destroyed: any[];
        flipped: any[];
    };
    processBreedingEffectsAtTurnStartAnchor: (cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}) => {
        spawned: any[];
        destroyed: any[];
        flipped: any[];
        anchors: any[];
    };
};
export = exports;
//# sourceMappingURL=breeding.d.ts.map