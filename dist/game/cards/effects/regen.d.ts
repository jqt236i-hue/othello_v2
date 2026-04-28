/**
 * @file regen.ts
 * @description Regen Will effects wrapper (delegates to game/logic/cards/regen.js)
 */
declare const exports: {
    applyRegenWill: (cardState: any, playerKey: any, row: any, col: any, deps?: {}) => {
        applied: boolean;
    };
    applyRegenAfterFlips: (cardState: any, gameState: any, flips: any, flipperKey: any, skipCapture: any, deps?: {}) => {
        regened: any[];
        captureFlips: any[];
    };
};
export = exports;
//# sourceMappingURL=regen.d.ts.map