import { JSDOM } from 'jsdom';
import {
  createStartViteBrowserApp,
  installVitePreloadErrorHandler
} from '../browser-vite/native-app-loader';

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
  root.forceFullRender = () => {};
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
      beforeInitialize: () => {
        order.push('feature-loader');
        root.loadLazyRuntimeGroup = jest.fn();
      }
    });

    const first = starter();
    expect(starter()).toBe(first);
    await first;

    expect(order).toEqual(['layout', 'entry', 'feature-loader', 'initialize-ui']);
    expect(capturedLoaders[0]).toBe(root.loadLazyRuntimeGroup);
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({
      viteBundledModules: true,
      customModuleRegistry: false
    });
    expect(root.__CARD_REVERSI_VITE_MODULE_BRIDGE__).toBeTruthy();
  });
});
