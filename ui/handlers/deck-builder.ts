/**
 * @file deck-builder.ts
 * @description Deck builder control setup
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface DeckBuilderRefs {
  openBtn: HTMLElement | null;
  controlSummary: HTMLElement | null;
  overlay: HTMLElement | null;
  closeBtn: HTMLElement | null;
  headerSummary: HTMLElement | null;
  body: HTMLElement | null;
  boardSizeOpenBtn: HTMLElement | null;
  boardSizeControlSummary: HTMLElement | null;
  boardSizeEditor: HTMLElement | null;
  boardShapeSelect: HTMLSelectElement | null;
  boardSizeRowsInput: HTMLInputElement | null;
  boardSizeColsInput: HTMLInputElement | null;
  boardSizeCloseBtn: HTMLElement | null;
  boardSizeEditorNote: HTMLElement | null;
}

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
  boardShapeSelect?: HTMLSelectElement | null;
  boardSizeRowsInput?: HTMLInputElement | null;
  boardSizeColsInput?: HTMLInputElement | null;
  boardSizeCloseBtn?: HTMLElement | null;
  boardSizeEditorNote?: HTMLElement | null;
}

interface DeckBuilderController {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface DeckBuilderControllerModule {
  createDeckBuilderController: (config: { root: Window; refs: DeckBuilderRefs }) => DeckBuilderController | null;
}

function setupDeckBuilderControls(options: DeckBuilderOptions): DeckBuilderController | null {
  const root = (typeof window !== 'undefined' ? window : globalThis as unknown) as Window & {
    DeckBuilderControllerModule?: DeckBuilderControllerModule;
  };

  if (!root.DeckBuilderControllerModule || typeof root.DeckBuilderControllerModule.createDeckBuilderController !== 'function') {
    return null;
  }

  const opts = (options && typeof options === 'object') ? options : {};
  const refs: DeckBuilderRefs = {
    openBtn: opts.openBtn || null,
    controlSummary: opts.controlSummary || null,
    overlay: opts.overlay || null,
    closeBtn: opts.closeBtn || null,
    headerSummary: opts.headerSummary || null,
    body: opts.body || null,
    boardSizeOpenBtn: opts.boardSizeOpenBtn || null,
    boardSizeControlSummary: opts.boardSizeControlSummary || null,
    boardSizeEditor: opts.boardSizeEditor || null,
    boardShapeSelect: opts.boardShapeSelect || null,
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

export = {
  setupDeckBuilderControls
};
