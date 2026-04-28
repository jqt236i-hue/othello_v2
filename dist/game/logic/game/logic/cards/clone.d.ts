export function applyCloneWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}): {
    applied: boolean;
    reason: any;
    spawnResult?: undefined;
} | {
    applied: boolean;
    spawnResult: any;
    reason?: undefined;
} | {
    applied: boolean;
    source: {
        row: any;
        col: any;
    };
    spawned: {
        row: any;
        col: any;
    }[];
};
export function applySplitWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, prng: any, deps?: {}): {
    applied: boolean;
    reason: any;
    spawnResult?: undefined;
} | {
    applied: boolean;
    spawnResult: any;
    reason?: undefined;
} | {
    applied: boolean;
    source: {
        row: any;
        col: any;
    };
    spawned: {
        row: any;
        col: any;
    }[];
    durationChanges: {
        row: any;
        col: any;
        owner: string;
        special: any;
        durationKey: string;
        previousDuration: number;
        nextDuration: any;
    }[];
};
//# sourceMappingURL=clone.d.ts.map