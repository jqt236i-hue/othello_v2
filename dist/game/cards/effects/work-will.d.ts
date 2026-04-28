/**
 * @file work-will.ts
 * @description Work Will effects wrapper (delegates to game/logic/cards/work_will.js)
 */
declare const exports: {
    placeWorkStone: (cardState: any, gameState: any, playerKey: any, row: any, col: any, deps?: {}) => {
        placed: boolean;
    };
    processWorkEffects: (cardState: any, gameState: any, playerKey: any, deps?: {}) => {
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
};
export = exports;
//# sourceMappingURL=work-will.d.ts.map