export function applyStrongWindWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}): {
    applied: boolean;
    reason: string;
    from?: undefined;
    to?: undefined;
    direction?: undefined;
    movedDistance?: undefined;
    chargeGained?: undefined;
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
    direction: any;
    movedDistance: number;
    chargeGained: number;
    reason?: undefined;
};
export function applySuperBuoyancyWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}): {
    applied: boolean;
    reason: string;
    failedAt?: undefined;
    from?: undefined;
    to?: undefined;
    destroyed?: undefined;
    destroyedCount?: undefined;
    movedDistance?: undefined;
    direction?: undefined;
} | {
    applied: boolean;
    reason: string;
    failedAt: {
        row: any;
        col: any;
    };
    from?: undefined;
    to?: undefined;
    destroyed?: undefined;
    destroyedCount?: undefined;
    movedDistance?: undefined;
    direction?: undefined;
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
    destroyed: {
        row: any;
        col: any;
    }[];
    destroyedCount: number;
    movedDistance: number;
    direction: any[];
    reason?: undefined;
    failedAt?: undefined;
};
export function applySuperGravityWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}): {
    applied: boolean;
    reason: string;
    failedAt?: undefined;
    from?: undefined;
    to?: undefined;
    destroyed?: undefined;
    destroyedCount?: undefined;
    movedDistance?: undefined;
    direction?: undefined;
} | {
    applied: boolean;
    reason: string;
    failedAt: {
        row: any;
        col: any;
    };
    from?: undefined;
    to?: undefined;
    destroyed?: undefined;
    destroyedCount?: undefined;
    movedDistance?: undefined;
    direction?: undefined;
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
    destroyed: {
        row: any;
        col: any;
    }[];
    destroyedCount: number;
    movedDistance: number;
    direction: any[];
    reason?: undefined;
    failedAt?: undefined;
};
//# sourceMappingURL=movement.d.ts.map