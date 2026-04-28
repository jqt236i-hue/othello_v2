declare function applyCloneWill(cardState: any, gameState: any, playerKey: string, row: number, col: number, prng: any, deps?: any): {
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
        row: number;
        col: number;
    };
    spawned: any[];
};
declare function applySplitWill(cardState: any, gameState: any, playerKey: string, row: number, col: number, prng: any, deps?: any): {
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
        row: number;
        col: number;
    };
    spawned: any[];
    durationChanges: any[];
};
declare const _default: {
    applyCloneWill: typeof applyCloneWill;
    applySplitWill: typeof applySplitWill;
};
export = _default;
//# sourceMappingURL=clone.d.ts.map