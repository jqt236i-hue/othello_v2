export const BOARD_SHRINK_SELECTION_COUNT: 3;
export function getBoardShrinkPendingSelectionsForCard(pending: any): {
    row: any;
    col: any;
}[];
export function applyBoardShrinkWill(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
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
        row: any;
        col: any;
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
        row: any;
        col: any;
    };
    selectedTargets: {
        row: any;
        col: any;
    }[];
    changedTargets: {
        row: any;
        col: any;
    }[];
    skippedTargets: {
        row: any;
        col: any;
        reason: any;
    }[];
    reason?: undefined;
    selectedCount?: undefined;
    maxSelections?: undefined;
    remainingSelections?: undefined;
    target?: undefined;
};
export function applyBoardShrinkGod(cardState: any, gameState: any, playerKey: any, row: any, col: any, deps: any): {
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
        row: any;
        col: any;
    };
    firstTarget: {
        row: any;
        col: any;
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
        row: any;
        col: any;
    };
    lineKey: any;
    lineTargets: any;
    changedTargets: {
        row: any;
        col: any;
    }[];
    skippedTargets: {
        row: any;
        col: any;
        reason: any;
    }[];
    reason?: undefined;
};
//# sourceMappingURL=shrink.d.ts.map