declare function handlePresentationEvent(ev: any): any;
declare function onBoardUpdated(): Promise<void>;
declare const PresentationHandler: {
    onBoardUpdated: typeof onBoardUpdated;
    handlePresentationEvent: typeof handlePresentationEvent;
};
export = PresentationHandler;
//# sourceMappingURL=presentation-handler.d.ts.map