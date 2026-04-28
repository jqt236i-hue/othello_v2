declare function syncBoardPixelSizing(boardElement: any, shapeInput: any): {
    rows: number;
    cols: number;
};
declare function applyTimeStopLegalEmphasis(cell: any, active: any): void;
declare function collectPendingSelectedTargetHighlightKeys(pending: any): Set<unknown>;
declare function renderBoard(): void;
declare function renderBoardFull(): void;
declare function updateOccupancyUI(): void;
declare function ensureDiscSkeleton(disc: any): {
    face: any;
    base: any;
    overlay: any;
    hud: any;
};
declare function getDiscHudRoot(disc: any): any;
declare function applyDiscRenderState(disc: any, renderState?: {}): void;
declare function setDiscStoneImage(disc: any, val: any): void;
declare const BoardRenderer: {
    renderBoard: typeof renderBoard;
    renderBoardFull: typeof renderBoardFull;
    updateOccupancyUI: typeof updateOccupancyUI;
    applyTimeStopLegalEmphasis: typeof applyTimeStopLegalEmphasis;
    collectPendingSelectedTargetHighlightKeys: typeof collectPendingSelectedTargetHighlightKeys;
    ensureDiscSkeleton: typeof ensureDiscSkeleton;
    getDiscHudRoot: typeof getDiscHudRoot;
    applyDiscRenderState: typeof applyDiscRenderState;
    setDiscStoneImage: typeof setDiscStoneImage;
    syncBoardPixelSizing: typeof syncBoardPixelSizing;
};
export = BoardRenderer;
//# sourceMappingURL=board-renderer.d.ts.map