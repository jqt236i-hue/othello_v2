export function applyBoardExpansionWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    reason: string;
    side?: undefined;
    row?: undefined;
    col?: undefined;
} | {
    applied: boolean;
    side: string;
    row: any;
    col: number;
    reason?: undefined;
};
export function applyBoardExpansionGod(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
    applied: boolean;
    reason: string;
    completed?: undefined;
    selectedCount?: undefined;
    maxSelections?: undefined;
    remainingSelections?: undefined;
    target?: undefined;
    selectedTargets?: undefined;
    source?: undefined;
    sources?: undefined;
    added?: undefined;
} | {
    applied: boolean;
    completed: boolean;
    selectedCount: any;
    maxSelections: any;
    remainingSelections: number;
    target: {
        row: any;
        col: any;
    };
    selectedTargets: any;
    reason?: undefined;
    source?: undefined;
    sources?: undefined;
    added?: undefined;
} | {
    applied: boolean;
    completed: boolean;
    source: {
        row: any;
        col: any;
    };
    sources: any;
    selectedTargets: any;
    added: {
        row: any;
        col: any;
    }[];
    reason?: undefined;
    selectedCount?: undefined;
    maxSelections?: undefined;
    remainingSelections?: undefined;
    target?: undefined;
};
export declare let __esModule: boolean;
//# sourceMappingURL=board-expansion-apply.d.ts.map