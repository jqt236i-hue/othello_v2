export function applyRegenWill(cardState: any, playerKey: any, row: any, col: any, deps?: {}): {
    applied: boolean;
};
export function applyRegenAfterFlips(cardState: any, gameState: any, flips: any, flipperKey: any, skipCapture: any, deps?: {}): {
    regened: any[];
    captureFlips: any[];
};
export function applyRegenAfterDestroy(cardState: any, gameState: any, row: any, col: any, triggerMeta: any, deps?: {}): {
    regenerated: boolean;
    regened: never[] | {
        row: any;
        col: any;
    }[];
    captureFlips: never[] | {
        row: any;
        col: any;
    }[];
    owner: any;
    remaining: number | undefined;
};
export function findActiveRegenMarkerAt(cardState: any, row: any, col: any): any;
//# sourceMappingURL=regen.d.ts.map