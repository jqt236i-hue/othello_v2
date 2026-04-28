/**
 * @file deck-builder.ts
 * @description Deck builder control setup
 */
interface DeckBuilderOptions {
    openBtn?: HTMLElement | null;
    controlSummary?: HTMLElement | null;
    overlay?: HTMLElement | null;
    closeBtn?: HTMLElement | null;
    headerSummary?: HTMLElement | null;
    body?: HTMLElement | null;
    boardSizeOpenBtn?: HTMLElement | null;
    boardSizeControlSummary?: HTMLElement | null;
    boardSizeEditor?: HTMLElement | null;
    boardSizeRowsInput?: HTMLInputElement | null;
    boardSizeColsInput?: HTMLInputElement | null;
    boardSizeCloseBtn?: HTMLElement | null;
    boardSizeEditorNote?: HTMLElement | null;
}
interface DeckBuilderController {
    [key: string]: any;
}
declare function setupDeckBuilderControls(options: DeckBuilderOptions): DeckBuilderController | null;
declare const _default: {
    setupDeckBuilderControls: typeof setupDeckBuilderControls;
};
export = _default;
//# sourceMappingURL=deck-builder.d.ts.map