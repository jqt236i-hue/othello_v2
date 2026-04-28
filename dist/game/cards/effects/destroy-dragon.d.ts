/**
 * @file destroy-dragon.ts
 * @description Destroy Dragon effects wrapper (delegates to game/logic/cards/destroy_dragon.js)
 */
declare const exports: {
    processDestroyDragonEffects: (cardState: any, gameState: any, playerKey: any, deps?: {}) => {
        destroyed: any[];
        anchors: any[];
        expired: any[];
    };
    processDestroyDragonEffectsAtAnchor: (cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}) => {
        destroyed: any[];
        expired: any[];
    };
    processDestroyDragonEffectsAtTurnStartAnchor: (cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}) => {
        destroyed: any[];
        expired: any[];
    };
};
export = exports;
//# sourceMappingURL=destroy-dragon.d.ts.map