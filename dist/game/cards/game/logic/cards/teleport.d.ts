export function applyTeleportWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}): {
    applied: boolean;
    reason: string;
    from?: undefined;
    to?: undefined;
} | {
    applied: boolean;
    from: {
        row: any;
        col: any;
    };
    to: any;
    reason?: undefined;
};
export function applyCellTeleportWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}): {
    applied: boolean;
    reason: string;
    from?: undefined;
    to?: undefined;
    createdDestination?: undefined;
} | {
    applied: boolean;
    from: {
        row: any;
        col: any;
    };
    to: {
        row: any;
        col: any;
    };
    createdDestination: boolean;
    reason?: undefined;
};
//# sourceMappingURL=teleport.d.ts.map