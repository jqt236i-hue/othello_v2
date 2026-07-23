const TEST_DOCUMENT_BASE_URL = 'https://card-reversi.test/';

export function installLoadedBoardCompatibilityStylesheet(documentRef: Document): HTMLLinkElement {
  let base = documentRef.querySelector('base[data-card-reversi-test-base]') as HTMLBaseElement | null;
  try {
    const baseUrl = new URL(documentRef.baseURI);
    if (baseUrl.protocol === 'about:') throw new Error('non-hierarchical test document URL');
  } catch (_error) {
    if (!base) {
      base = documentRef.createElement('base');
      base.dataset.cardReversiTestBase = 'true';
      documentRef.head.prepend(base);
    }
    base.href = TEST_DOCUMENT_BASE_URL;
  }

  let link = documentRef.querySelector(
    'link[data-card-reversi-feature-style="board-dom-compat"]'
  ) as HTMLLinkElement | null;
  if (!link) {
    link = documentRef.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'styles-board-dom-compat.css';
    link.dataset.cardReversiFeatureStyle = 'board-dom-compat';
    documentRef.head.appendChild(link);
  }
  link.dataset.cardReversiFeatureStyleLoaded = 'true';
  return link;
}

export function installInstantImagePreparation(documentRef: Document): void {
  const windowRef = documentRef.defaultView;
  if (!windowRef) return;
  class ImmediatelyLoadedImage {
    decoding = 'auto';
    onload: ((event: Event) => unknown) | null = null;
    onerror: ((event: Event | string) => unknown) | null = null;
    private source = '';

    get src(): string {
      return this.source;
    }

    set src(value: string) {
      this.source = String(value || '');
      Promise.resolve().then(() => {
        this.onload?.(new windowRef.Event('load'));
      });
    }

    decode(): Promise<void> {
      return Promise.resolve();
    }
  }
  Object.defineProperty(windowRef, 'Image', {
    configurable: true,
    writable: true,
    value: ImmediatelyLoadedImage
  });
}

export function installPreparedDomBoardDependencies(documentRef: Document): void {
  installLoadedBoardCompatibilityStylesheet(documentRef);
  installInstantImagePreparation(documentRef);
}

export function configureNoopDomBoardBackend(boardRenderer: any): void {
  boardRenderer.configureBoardVisualBackendForTest({
    selection: 'dom',
    createDomBackend: () => ({
      kind: 'dom',
      mount: async () => undefined,
      applyFrame: () => undefined,
      playPhase: async () => undefined,
      getCellClientRect: () => null,
      resize: () => undefined,
      restore: async () => undefined,
      destroy: () => undefined
    })
  });
}
