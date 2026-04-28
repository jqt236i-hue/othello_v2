export function compactPresentationMeta(meta: any): {} | undefined;
export function getCellVisualPresentationMeta(cardState: any, row: any, col: any, context: any): {} | undefined;
export function swapOccupiedCellsWithPresentation(cardState: any, gameState: any, posA: any, posB: any, options: any, context: any): {
    swapped: boolean;
    reason: string;
    first?: undefined;
    second?: undefined;
} | {
    swapped: boolean;
    first: {
        row: number;
        col: number;
    };
    second: {
        row: number;
        col: number;
    };
    reason?: undefined;
};
export function allocateStoneId(cardState: any): string | null;
export function emitPresentationEvent(cardState: any, ev: any, context: any): void;
export function flushPresentationEvents(cardState: any, context: any): any;
//# sourceMappingURL=presentation-helpers.d.ts.map