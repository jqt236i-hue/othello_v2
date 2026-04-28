/**
 * @file sniper.ts
 * @description Sniper Will effects wrapper (delegates to game/logic/cards/sniper.js)
 */
declare const exports: {
    processSniperWillEffects: (cardState: any, gameState: any, playerKey: any, deps: any) => {
        destroyed: any[];
        anchors: any[];
        expired: any[];
    };
    processSniperWillEffectsAtTurnStartAnchor: (cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any) => {
        destroyed: any[];
        expired: any[];
    };
};
export = exports;
//# sourceMappingURL=sniper.d.ts.map