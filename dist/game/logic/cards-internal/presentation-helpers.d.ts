interface PresentationContext {
    constants?: {
        BLACK?: number;
        EMPTY?: number;
    };
    BoardOpsModule?: any;
    StoneStatusSnapshot?: any;
    [key: string]: any;
}
interface PresentationEvent {
    type: string;
    [key: string]: any;
}
interface Position {
    row: number;
    col: number;
}
declare function compactPresentationMeta(meta: any): any;
declare function getCellVisualPresentationMeta(cardState: any, row: number, col: number, context: PresentationContext): any;
declare function allocateStoneId(cardState: any): string | null;
declare function emitPresentationEvent(cardState: any, ev: PresentationEvent, context: PresentationContext): void;
declare function flushPresentationEvents(cardState: any, context: PresentationContext): PresentationEvent[];
declare function swapOccupiedCellsWithPresentation(cardState: any, gameState: any, posA: Position, posB: Position, options: any, context: PresentationContext): {
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
declare const _default: {
    compactPresentationMeta: typeof compactPresentationMeta;
    getCellVisualPresentationMeta: typeof getCellVisualPresentationMeta;
    swapOccupiedCellsWithPresentation: typeof swapOccupiedCellsWithPresentation;
    allocateStoneId: typeof allocateStoneId;
    emitPresentationEvent: typeof emitPresentationEvent;
    flushPresentationEvents: typeof flushPresentationEvents;
};
export = _default;
//# sourceMappingURL=presentation-helpers.d.ts.map