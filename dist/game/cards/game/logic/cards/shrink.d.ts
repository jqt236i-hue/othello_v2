declare function getBoardShrinkPendingSelectionsForCard(pending: any): any[];
declare function applyBoardShrinkWill(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: any): {
    applied: boolean;
    reason: string;
    completed?: undefined;
    selectedCount?: undefined;
    maxSelections?: undefined;
    remainingSelections?: undefined;
    target?: undefined;
    selectedTargets?: undefined;
    source?: undefined;
    changedTargets?: undefined;
    skippedTargets?: undefined;
} | {
    applied: boolean;
    completed: boolean;
    selectedCount: any;
    maxSelections: number;
    remainingSelections: number;
    target: {
        row: number;
        col: number;
    };
    selectedTargets: any;
    reason?: undefined;
    source?: undefined;
    changedTargets?: undefined;
    skippedTargets?: undefined;
} | {
    applied: boolean;
    completed: boolean;
    source: {
        row: number;
        col: number;
    };
    selectedTargets: {
        row: any;
        col: any;
    }[];
    changedTargets: any[];
    skippedTargets: any[];
    reason?: undefined;
    selectedCount?: undefined;
    maxSelections?: undefined;
    remainingSelections?: undefined;
    target?: undefined;
};
declare function applyBoardShrinkGod(cardState: any, gameState: any, playerKey: string, row: number, col: number, deps: any): {
    applied: boolean;
    reason: string;
    completed?: undefined;
    target?: undefined;
    firstTarget?: undefined;
    lineKey?: undefined;
    lineTargets?: undefined;
    changedTargets?: undefined;
    skippedTargets?: undefined;
} | {
    applied: boolean;
    completed: boolean;
    target: {
        row: number;
        col: number;
    };
    firstTarget: {
        row: number;
        col: number;
    };
    reason?: undefined;
    lineKey?: undefined;
    lineTargets?: undefined;
    changedTargets?: undefined;
    skippedTargets?: undefined;
} | {
    applied: boolean;
    completed: boolean;
    firstTarget: {
        row: any;
        col: any;
    };
    target: {
        row: number;
        col: number;
    };
    lineKey: any;
    lineTargets: any;
    changedTargets: any[];
    skippedTargets: any[];
    reason?: undefined;
};
declare const _default: {
    BOARD_SHRINK_SELECTION_COUNT: number;
    getBoardShrinkPendingSelectionsForCard: typeof getBoardShrinkPendingSelectionsForCard;
    applyBoardShrinkWill: typeof applyBoardShrinkWill;
    applyBoardShrinkGod: typeof applyBoardShrinkGod;
};
export = _default;
//# sourceMappingURL=shrink.d.ts.map