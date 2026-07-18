import { JSDOM } from 'jsdom';
import {
  createStartViteBrowserApp,
  installVitePreloadErrorHandler
} from '../browser-vite/native-app-loader';
import { loadPixiRuntime } from '../browser-vite/pixi-runtime-loader';

function createDom(): JSDOM {
  return new JSDOM(`<!doctype html><html><body>
    <div id="board"></div><button id="resetBtn"></button><button id="debugModeBtn"></button>
    <button id="gachaOpenBtn"></button><button id="modeNetworkBtn"></button><button id="handSkinBtn"></button>
  </body></html>`, { url: 'https://example.test/index.html' });
}

function installReadyGlobals(root: any): void {
  root.gameState = {};
  root.cardState = {};
  root.resetGame = () => {};
  root.LazyRuntimeLoaderModule = {};
}

describe('registry-free Vite app loader', () => {
  test('turns a stale preload failure into a reload-required player message', () => {
    const dom = createDom();
    installVitePreloadErrorHandler(dom.window as any, dom.window.document);

    const event = new dom.window.Event('vite:preloadError', { cancelable: true });
    dom.window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(dom.window.document.documentElement.getAttribute('data-browser-boot-state')).toBe('error');
    expect(dom.window.document.getElementById('browserViteBootError')?.textContent).toContain('再読み込み');
  });

  test('installs the bridge and feature hook before one UI initialization', async () => {
    const dom = createDom();
    const root: any = dom.window;
    const order: string[] = [];
    const capturedLoaders: any[] = [];
    const starter = createStartViteBrowserApp({
      root,
      document: root.document,
      loadPixiRuntime: async () => {
        order.push('pixi-load');
        return { runtime: { VERSION: '8.18.1', Application: jest.fn() }, version: '8.18.1', unavailableReason: null };
      },
      loadLayout: async () => { order.push('layout'); },
      loadEntry: async () => {
        order.push('entry');
        installReadyGlobals(root);
        root.initializeUI = async () => {
          order.push('initialize-ui');
          capturedLoaders.push(root.loadLazyRuntimeGroup);
          root.__uiInitialized = true;
        };
      },
      beforeInitialize: (_root, _document, pixiRuntime) => {
        order.push('feature-loader');
        expect(pixiRuntime).toMatchObject({ version: '8.18.1', unavailableReason: null });
        root.loadLazyRuntimeGroup = jest.fn();
      }
    });

    const first = starter();
    expect(starter()).toBe(first);
    await first;

    expect(order).toEqual(['pixi-load', 'layout', 'entry', 'feature-loader', 'initialize-ui']);
    expect(capturedLoaders[0]).toBe(root.loadLazyRuntimeGroup);
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({
      viteBundledModules: true,
      customModuleRegistry: false
    });
    expect(root.__CARD_REVERSI_VITE_MODULE_BRIDGE__).toBeTruthy();
  });

  test('continues DOM boot when the scoped Pixi preload fails', async () => {
    const dom = createDom();
    const root: any = dom.window;
    installVitePreloadErrorHandler(root, root.document);
    let rejectImport!: (error: Error) => void;
    let receivedOutcome: any = null;
    const starter = createStartViteBrowserApp({
      root,
      document: root.document,
      loadPixiRuntime: () => loadPixiRuntime({
        root,
        importer: () => new Promise((_resolve, reject) => { rejectImport = reject; })
      }),
      loadLayout: async () => {},
      loadEntry: async () => {
        installReadyGlobals(root);
        root.initializeUI = async () => { root.__uiInitialized = true; };
      },
      beforeInitialize: (_root, _document, pixiRuntime) => {
        receivedOutcome = pixiRuntime;
      }
    });

    const boot = starter();
    await Promise.resolve();
    const preloadError = new Error('pixi chunk unavailable');
    const event = new dom.window.Event('vite:preloadError', { cancelable: true }) as any;
    event.payload = preloadError;
    root.dispatchEvent(event);
    rejectImport(preloadError);
    await boot;
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(event.defaultPrevented).toBe(false);
    expect(receivedOutcome).toEqual({
      runtime: null,
      version: null,
      unavailableReason: 'pixi-preload-failed'
    });
    expect(root.__uiInitialized).toBe(true);
    expect(root.document.documentElement.getAttribute('data-browser-boot-state')).toBe('ready');
    expect(root.document.getElementById('browserViteBootError')).toBeNull();
  });

  test('keeps an unrelated preload failure fatal while the Pixi import is pending', async () => {
    const dom = createDom();
    const root: any = dom.window;
    installVitePreloadErrorHandler(root, root.document);
    let resolvePixi!: (runtime: any) => void;
    const pixiLoad = loadPixiRuntime({
      root,
      importer: () => new Promise((resolve) => { resolvePixi = resolve; })
    });
    await Promise.resolve();

    const event = new dom.window.Event('vite:preloadError', { cancelable: true }) as any;
    event.payload = new Error('layout chunk unavailable');
    root.dispatchEvent(event);
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(event.defaultPrevented).toBe(false);
    expect(root.document.documentElement.getAttribute('data-browser-boot-state')).toBe('error');
    expect(root.document.getElementById('browserViteBootError')?.textContent).toContain('再読み込み');

    resolvePixi({ VERSION: '8.18.1', Application: jest.fn() });
    await expect(pixiLoad).resolves.toMatchObject({ version: '8.18.1', unavailableReason: null });
  });

  test('keeps layout and entry failures fatal after optional Pixi loading settles', async () => {
    const dom = createDom();
    const root: any = dom.window;
    const loadEntry = jest.fn();
    const starter = createStartViteBrowserApp({
      root,
      document: root.document,
      loadPixiRuntime: async () => ({ runtime: null, version: null, unavailableReason: 'fixture-unavailable' }),
      loadLayout: async () => { throw new Error('layout unavailable'); },
      loadEntry
    });

    await expect(starter()).rejects.toThrow('layout unavailable');
    expect(loadEntry).not.toHaveBeenCalled();
    expect(root.document.documentElement.getAttribute('data-browser-boot-state')).toBe('error');
    expect(root.document.getElementById('browserViteBootError')?.textContent).toContain('layout unavailable');
  });
});
