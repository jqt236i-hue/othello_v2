/**
 * @file deck-builder.ts
 * @description Deck builder control setup and lazy inner-surface lifecycle
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const LazyFeatureSurface = _require('../assets/lazy-feature-surface');
const { DECK_BUILDER_INNER_HTML } = _require('./deck-builder-template');

const DECK_BUILDER_SURFACE_ID = 'deck-builder';
const DECK_BUILDER_STYLESHEET_GROUPS = Object.freeze([
  'deck-builder',
  'deck-builder-responsive'
]);

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
  stoneSupplyCheckbox: HTMLInputElement | null;
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
  stoneSupplyCheckbox?: HTMLInputElement | null;
}

interface DeckBuilderController {
  open(): void;
  close(): void;
  render(): void;
  attachSurfaceRefs(refs: Partial<DeckBuilderRefs>, context?: any): Readonly<Partial<DeckBuilderRefs>>;
  detachSurfaceRefs(refs?: Partial<DeckBuilderRefs>): boolean;
  // Existing model/network methods remain intentionally opaque at this bootstrap boundary.
  [key: string]: any;
}

interface DeckBuilderControllerModule {
  createDeckBuilderController: (config: {
    root: Window;
    refs: DeckBuilderRefs;
    ensureSurface?: () => Promise<unknown>;
  }) => DeckBuilderController | null;
}

const controllersByDocument = new WeakMap<Document, DeckBuilderController>();

function createDeckBuilderSurface(context: any): DeckBuilderController {
  const docRef = context.document as Document;
  const overlay = docRef.getElementById('deckBuilderOverlay') as HTMLElement | null;
  const modal = docRef.getElementById('deckBuilderModal') as HTMLElement | null;
  const controller = controllersByDocument.get(docRef);
  if (!overlay || !modal || !controller) {
    throw new Error('Deck builder stable shell or controller is unavailable');
  }

  const template = docRef.createElement('template');
  template.innerHTML = String(DECK_BUILDER_INNER_HTML || '').trim();
  modal.replaceChildren(template.content.cloneNode(true));

  const innerRefs = {
    closeBtn: docRef.getElementById('deckBuilderCloseBtn'),
    headerSummary: docRef.getElementById('deckBuilderHeaderSummary'),
    body: docRef.getElementById('deckBuilderBody')
  };
  context.recordDomCreated(modal.childElementCount);
  context.addCleanup(() => {
    controller.detachSurfaceRefs(innerRefs);
    modal.replaceChildren();
    modal.classList.remove('deck-builder-surface-failure');
    overlay.classList.remove('is-open', 'deck-builder-surface-failure');
    overlay.setAttribute('aria-hidden', 'true');
  });
  controller.attachSurfaceRefs(innerRefs, context);
  return controller;
}

const DeckBuilderSurfaceRegistration = Object.freeze({
  id: DECK_BUILDER_SURFACE_ID,
  stylesheetGroups: DECK_BUILDER_STYLESHEET_GROUPS,
  ensureDom: createDeckBuilderSurface,
  onReady: async (_surface: unknown, context: any) => {
    const root = context.document.defaultView;
    if (!root) return;
    const closeBtn = context.document.getElementById('deckBuilderCloseBtn');
    if (closeBtn && typeof root.getComputedStyle === 'function') {
      void root.getComputedStyle(closeBtn).backgroundColor;
    }
    if (typeof root.requestAnimationFrame !== 'function') return;
    await new Promise<void>((resolve) => {
      root.requestAnimationFrame(() => resolve());
    });
  }
});

if (LazyFeatureSurface && typeof LazyFeatureSurface.registerLazyFeatureSurface === 'function') {
  LazyFeatureSurface.registerLazyFeatureSurface(DeckBuilderSurfaceRegistration);
}

function setupDeckBuilderControls(options: DeckBuilderOptions): DeckBuilderController | null {
  const root = (typeof window !== 'undefined' ? window : globalThis as unknown) as Window & {
    DeckBuilderControllerModule?: DeckBuilderControllerModule;
  };
  const docRef = root.document;
  if (
    !docRef
    || !root.DeckBuilderControllerModule
    || typeof root.DeckBuilderControllerModule.createDeckBuilderController !== 'function'
  ) {
    return null;
  }

  const existing = controllersByDocument.get(docRef);
  if (existing) return existing;

  const opts = (options && typeof options === 'object') ? options : {};
  const openBtn = opts.openBtn || null;
  const overlay = opts.overlay || null;
  const modal = docRef.getElementById('deckBuilderModal') as HTMLElement | null;
  if (!openBtn || !overlay || !modal) return null;

  let failureCleanup: (() => void) | null = null;

  function clearFailure(restoreFocus = false): void {
    failureCleanup?.();
    failureCleanup = null;
    modal!.classList.remove('deck-builder-surface-failure');
    overlay!.classList.remove('is-open', 'deck-builder-surface-failure');
    overlay!.setAttribute('aria-hidden', 'true');
    modal!.replaceChildren();
    openBtn!.setAttribute('aria-expanded', 'false');
    if (restoreFocus) {
      try { openBtn!.focus(); } catch (_error) { /* focus return is best-effort */ }
    }
  }

  function showFailure(): void {
    clearFailure(false);
    overlay!.classList.add('is-open', 'deck-builder-surface-failure');
    overlay!.setAttribute('aria-hidden', 'false');
    modal!.classList.add('deck-builder-surface-failure');
    openBtn!.setAttribute('aria-expanded', 'true');

    const title = docRef.createElement('div');
    title.className = 'deck-builder-surface-failure-title';
    title.textContent = 'デッキ構築を読み込めませんでした';
    const message = docRef.createElement('p');
    message.className = 'deck-builder-surface-failure-message';
    message.textContent = '閉じてデッキ構築ボタンをもう一度押すと再試行します。';
    const closeBtn = docRef.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'btn-small';
    closeBtn.textContent = '閉じる';
    modal!.replaceChildren(title, message, closeBtn);

    const close = () => clearFailure(true);
    const onBackdrop = (event: Event) => {
      if (event.target === overlay) close();
    };
    const onKeydown = (event: Event) => {
      if ((event as KeyboardEvent).key !== 'Escape') return;
      event.preventDefault();
      close();
    };
    closeBtn.addEventListener('click', close);
    overlay!.addEventListener('click', onBackdrop);
    docRef.addEventListener('keydown', onKeydown);
    failureCleanup = () => {
      closeBtn.removeEventListener('click', close);
      overlay!.removeEventListener('click', onBackdrop);
      docRef.removeEventListener('keydown', onKeydown);
    };
    try { closeBtn.focus(); } catch (_error) { /* focus is best-effort */ }
  }

  const refs: DeckBuilderRefs = {
    openBtn,
    controlSummary: opts.controlSummary || null,
    overlay,
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
    boardSizeEditorNote: opts.boardSizeEditorNote || null,
    stoneSupplyCheckbox: opts.stoneSupplyCheckbox || null
  };

  let controller: DeckBuilderController | null = null;
  const ensureSurface = () => {
    clearFailure(false);
    openBtn.setAttribute('aria-busy', 'true');
    return Promise.resolve(
      LazyFeatureSurface.ensureLazyFeatureSurface(DECK_BUILDER_SURFACE_ID, docRef)
    ).catch((error: unknown) => {
      showFailure();
      throw error;
    }).finally(() => {
      openBtn.removeAttribute('aria-busy');
    });
  };
  controller = root.DeckBuilderControllerModule.createDeckBuilderController({
    root,
    refs,
    ensureSurface
  });
  if (!controller) return null;
  controllersByDocument.set(docRef, controller);
  return controller;
}

export = {
  DECK_BUILDER_SURFACE_ID,
  setupDeckBuilderControls
};
