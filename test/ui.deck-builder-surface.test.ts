import { JSDOM } from 'jsdom';

describe('deck builder lazy surface', () => {
  let dom: JSDOM;

  const flushAsyncWork = async (): Promise<void> => {
    await new Promise<void>((resolve) => setImmediate(resolve));
  };

  const styleLinks = (): HTMLLinkElement[] => Array.from(document.querySelectorAll(
    'link[data-card-reversi-feature-style^="deck-builder"]'
  ));

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM(`<!doctype html><html><head>
      <base href="https://example.test/">
      <meta data-card-reversi-feature-style-slot="deck-builder"
        data-card-reversi-feature-style-href="styles-feature-deck-builder.css">
      <meta data-card-reversi-feature-style-slot="deck-builder-responsive"
        data-card-reversi-feature-style-href="styles-feature-deck-builder-responsive.css">
    </head><body>
      <button id="deckBuilderOpenBtn" type="button" aria-controls="deckBuilderOverlay"
        aria-expanded="false">デッキ構築</button>
      <div id="deckBuilderControlSummary"></div>
      <div id="deckBuilderOverlay" aria-hidden="true">
        <div id="deckBuilderModal" role="dialog" aria-modal="true" aria-label="デッキ構築"></div>
      </div>
      <button id="boardSizeOpenBtn" type="button"></button>
      <div id="boardSizeControlSummary"></div>
      <div id="boardSizeEditor"></div>
      <select id="boardShapeSelect"><option value="rectangle">通常</option></select>
      <input id="boardSizeRowsInput" type="number" value="8">
      <input id="boardSizeColsInput" type="number" value="8">
      <button id="boardSizeCloseBtn" type="button"></button>
      <div id="boardSizeEditorNote"></div>
    </body></html>`, {
      url: 'https://example.test/?debug=1&uxMonitor=1'
    });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).history = dom.window.history;
    (global as any).localStorage = dom.window.localStorage;
    (global as any).navigator = dom.window.navigator;
    (window as any).DEBUG_MODE_ALLOWED = true;
    (window as any).DeckBuilderControllerModule = require('../ui/deck-builder-controller.ts');
  });

  afterEach(() => {
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).location;
    delete (global as any).history;
    delete (global as any).localStorage;
    delete (global as any).navigator;
  });

  function setup(): any {
    const module = require('../ui/handlers/deck-builder.ts');
    const controller = module.setupDeckBuilderControls({
      openBtn: document.getElementById('deckBuilderOpenBtn'),
      controlSummary: document.getElementById('deckBuilderControlSummary'),
      overlay: document.getElementById('deckBuilderOverlay'),
      boardSizeOpenBtn: document.getElementById('boardSizeOpenBtn'),
      boardSizeControlSummary: document.getElementById('boardSizeControlSummary'),
      boardSizeEditor: document.getElementById('boardSizeEditor'),
      boardShapeSelect: document.getElementById('boardShapeSelect'),
      boardSizeRowsInput: document.getElementById('boardSizeRowsInput'),
      boardSizeColsInput: document.getElementById('boardSizeColsInput'),
      boardSizeCloseBtn: document.getElementById('boardSizeCloseBtn'),
      boardSizeEditorNote: document.getElementById('boardSizeEditorNote')
    });
    return { module, controller };
  }

  test('keeps the card list and styles out of boot, then retains one ready surface', async () => {
    const { module } = setup();
    const modal = document.getElementById('deckBuilderModal')!;
    const openBtn = document.getElementById('deckBuilderOpenBtn') as HTMLButtonElement;

    expect(modal.childElementCount).toBe(0);
    expect(document.querySelectorAll('.deck-builder-preset-card')).toHaveLength(0);
    expect(styleLinks()).toHaveLength(0);

    openBtn.click();
    const firstLinks = styleLinks();
    expect(firstLinks).toHaveLength(2);
    expect(modal.querySelector('#deckBuilderModalHeader')).not.toBeNull();
    firstLinks.forEach((link) => link.dispatchEvent(new dom.window.Event('load')));
    await flushAsyncWork();

    expect(document.getElementById('deckBuilderOverlay')!.classList.contains('is-open')).toBe(true);
    expect(document.querySelectorAll('.deck-builder-preset-card').length).toBeGreaterThan(0);
    const firstHeader = document.getElementById('deckBuilderModalHeader');
    const firstBody = document.getElementById('deckBuilderBody');

    (document.getElementById('deckBuilderCloseBtn') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(openBtn);
    openBtn.click();
    await flushAsyncWork();

    expect(document.getElementById('deckBuilderModalHeader')).toBe(firstHeader);
    expect(document.getElementById('deckBuilderBody')).toBe(firstBody);
    expect(styleLinks()).toHaveLength(2);
    expect(require('../ui/assets/lazy-feature-surface.ts')
      .getLazyFeatureSurfaceDiagnostics(module.DECK_BUILDER_SURFACE_ID, document))
      .toMatchObject({
        status: 'ready',
        attemptCount: 1,
        stylesheetEnsureCount: 2,
        domEnsureCount: 1,
        domCreatedCount: 2,
        readyCount: 1,
        failureCount: 0
      });
  });

  test('cleans partial DOM and both styles after failure, then retries from a new attempt', async () => {
    const { module } = setup();
    const modal = document.getElementById('deckBuilderModal')!;
    const openBtn = document.getElementById('deckBuilderOpenBtn') as HTMLButtonElement;

    openBtn.click();
    const failedLinks = styleLinks();
    expect(failedLinks).toHaveLength(2);
    failedLinks[0].dispatchEvent(new dom.window.Event('error'));
    failedLinks[1].dispatchEvent(new dom.window.Event('load'));
    await flushAsyncWork();

    expect(styleLinks()).toHaveLength(0);
    expect(modal.querySelector('#deckBuilderModalHeader')).toBeNull();
    expect(modal.classList.contains('deck-builder-surface-failure')).toBe(true);
    expect(modal.textContent).toContain('もう一度押すと再試行');

    (modal.querySelector('button') as HTMLButtonElement).click();
    expect(modal.childElementCount).toBe(0);
    openBtn.click();
    const retryLinks = styleLinks();
    expect(retryLinks).toHaveLength(2);
    retryLinks.forEach((link) => link.dispatchEvent(new dom.window.Event('load')));
    await flushAsyncWork();

    expect(document.getElementById('deckBuilderOverlay')!.classList.contains('is-open')).toBe(true);
    expect(document.querySelectorAll('.deck-builder-preset-card').length).toBeGreaterThan(0);
    expect(require('../ui/assets/lazy-feature-surface.ts')
      .getLazyFeatureSurfaceDiagnostics(module.DECK_BUILDER_SURFACE_ID, document))
      .toMatchObject({
        status: 'ready',
        attemptCount: 2,
        retryCount: 1,
        failureCount: 1,
        readyCount: 1
      });
  });
});
