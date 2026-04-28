export function applyTemptWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    reason: string;
} | {
    applied: boolean;
    reason?: undefined;
};
export function transferCellMarkerOwnership(cardState: any, row: any, col: any, playerKey: any, deps: any): {
    transferred: boolean;
    hadWork: boolean;
    reason: string;
} | {
    transferred: boolean;
    hadWork: boolean;
    reason?: undefined;
};
export function applyCaptureWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    reason: string;
    target?: undefined;
    livingWillRevived?: undefined;
    sourceSpecialType?: undefined;
    stoneId?: undefined;
    capturedCardId?: undefined;
    capturedCardType?: undefined;
    capturedCardName?: undefined;
    insertIndex?: undefined;
} | {
    applied: boolean;
    target: {
        row: any;
        col: any;
    };
    livingWillRevived: boolean;
    sourceSpecialType: any;
    stoneId: any;
    reason?: undefined;
    capturedCardId?: undefined;
    capturedCardType?: undefined;
    capturedCardName?: undefined;
    insertIndex?: undefined;
} | {
    applied: boolean;
    target: {
        row: any;
        col: any;
    };
    capturedCardId: any;
    capturedCardType: any;
    capturedCardName: any;
    sourceSpecialType: any;
    stoneId: any;
    insertIndex: any;
    reason?: undefined;
    livingWillRevived?: undefined;
};
export declare let __esModule: boolean;
//# sourceMappingURL=ownership.d.ts.map