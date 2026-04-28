declare function createDeckBuilderController(options: any): {
    open: () => void;
    close: () => void;
    render: (optionsOverride: any) => void;
    buildCardInitOptions: () => {
        boardConfig: {
            rows: any;
            cols: any;
            standard8x8: boolean;
            baseBounds: any;
            outerBounds: any;
        };
    };
    readActiveDeckSpec: () => any;
    readBoardConfig: () => {
        rows: any;
        cols: any;
        standard8x8: boolean;
        baseBounds: any;
        outerBounds: any;
    };
    getLocalBoardConfig: () => {
        rows: any;
        cols: any;
        standard8x8: boolean;
        baseBounds: any;
        outerBounds: any;
    };
    setLocalBoardConfig: (nextBoardConfig: any) => void;
    getActiveLocalChoice: () => {
        source: any;
        mode: string;
        name: any;
        deckCode: string;
        deckSpec: null;
        deckSize: any;
        presetId: any;
    };
};
declare const DeckBuilderController: {
    createDeckBuilderController: typeof createDeckBuilderController;
};
export = DeckBuilderController;
//# sourceMappingURL=deck-builder-controller.d.ts.map