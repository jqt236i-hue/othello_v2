export function applyPositionSwapWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    completed: boolean;
    firstTarget: {
        row: any;
        col: any;
    };
    reason?: undefined;
    from?: undefined;
    to?: undefined;
} | {
    applied: boolean;
    reason: any;
    completed?: undefined;
    firstTarget?: undefined;
    from?: undefined;
    to?: undefined;
} | {
    applied: boolean;
    completed: boolean;
    from: {
        row: any;
        col: any;
    };
    to: {
        row: any;
        col: any;
    };
    firstTarget?: undefined;
    reason?: undefined;
};
export declare let __esModule: boolean;
//# sourceMappingURL=position-swap.d.ts.map