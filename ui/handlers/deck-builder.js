(function (root) {
    function setupDeckBuilderControls(options) {
        if (!root.DeckBuilderControllerModule || typeof root.DeckBuilderControllerModule.createDeckBuilderController !== 'function') {
            return null;
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const refs = {
            openBtn: opts.openBtn || null,
            controlSummary: opts.controlSummary || null,
            overlay: opts.overlay || null,
            closeBtn: opts.closeBtn || null,
            headerSummary: opts.headerSummary || null,
            body: opts.body || null,
            boardSizeOpenBtn: opts.boardSizeOpenBtn || null,
            boardSizeControlSummary: opts.boardSizeControlSummary || null,
            boardSizeEditor: opts.boardSizeEditor || null,
            boardSizeRowsInput: opts.boardSizeRowsInput || null,
            boardSizeColsInput: opts.boardSizeColsInput || null,
            boardSizeCloseBtn: opts.boardSizeCloseBtn || null,
            boardSizeEditorNote: opts.boardSizeEditorNote || null
        };

        return root.DeckBuilderControllerModule.createDeckBuilderController({
            root,
            refs
        });
    }

    root.setupDeckBuilderControls = setupDeckBuilderControls;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            setupDeckBuilderControls
        };
    }
}(typeof window !== 'undefined' ? window : globalThis));
