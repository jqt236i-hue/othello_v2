export function placeWorkStone(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}): {
    placed: boolean;
};
export function processWorkEffects(cardState: any, gameState: any, playerKey: any, deps?: {}): {
    gained: number;
    removed: boolean;
    row: any;
    col: any;
    removedReason: null;
    incomeStep: null;
} | {
    gained: number;
    removed: boolean;
    row: any;
    col: any;
    removedReason: string;
    incomeStep: null;
} | {
    gained: number;
    removed: boolean;
    row: any;
    col: any;
    removedReason: string | null;
    incomeStep: number;
};
//# sourceMappingURL=work_will.d.ts.map