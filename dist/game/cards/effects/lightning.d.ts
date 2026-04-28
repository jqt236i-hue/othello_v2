/**
 * @file lightning.ts
 * @description Lightning Will effects wrapper (delegates to game/logic/cards/lightning.js)
 */
declare const exports: {
    processLightningWillEffects: (cardState: any, gameState: any, playerKey: any, deps?: {}) => {
        destroyed: any[];
        anchors: any[];
        expired: any[];
    };
    processLightningWillEffectsAtAnchor: (cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}) => {
        destroyed: any[];
        expired: any[];
    };
    processLightningWillEffectsAtTurnStartAnchor: (cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}) => {
        destroyed: any[];
        expired: any[];
    };
};
export = exports;
//# sourceMappingURL=lightning.d.ts.map