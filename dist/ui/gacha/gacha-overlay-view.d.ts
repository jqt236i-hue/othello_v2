declare function resolveRefs(docRef: Document, options?: any): any;
declare function writeStatus(statusEl: HTMLElement | null, text: string, isError?: boolean): void;
declare function renderDetails(detailsPanel: HTMLElement | null, catalogItems: any[], helpersModule?: any): void;
declare function renderPullResults(resultsEl: HTMLElement | null, pulls: any[], newlyUnlockedIds: string[]): void;
declare function createGachaOverlayView(options?: any): any;
declare const GachaOverlayView: {
    createGachaOverlayView: typeof createGachaOverlayView;
    resolveRefs: typeof resolveRefs;
    writeStatus: typeof writeStatus;
    renderDetails: typeof renderDetails;
    renderPullResults: typeof renderPullResults;
};
export = GachaOverlayView;
//# sourceMappingURL=gacha-overlay-view.d.ts.map