import { JSDOM } from 'jsdom';
import { createStartBrowserApp } from '../browser-vite/classic-compat-loader';

const contract = {
  runtime: 'public/runtime.js?v=1',
  registry: 'public/module-registry.js?v=2',
  layout: 'ui/layout-stage.js',
  entry: 'entry-browser.js?v=3'
};

function createDom(): JSDOM {
  return new JSDOM(`<!doctype html><html><body>
    <div id="board"></div><button id="resetBtn"></button><button id="debugModeBtn"></button>
    <button id="gachaOpenBtn"></button><button id="modeNetworkBtn"></button><button id="handSkinBtn"></button>
  </body></html>`, { url: 'https://example.test/vite-dist/index.vite.html' });
}

function installReadyGlobals(root: any): void {
  root.gameState = {};
  root.cardState = {};
  root.resetGame = () => {};
  root.forceFullRender = () => {};
  root.LazyRuntimeLoaderModule = {};
}

describe('Vite classic compatibility loader', () => {
  test('loads required scripts in fixed order, initializes once, and is idempotent', async () => {
    const dom = createDom();
    const root: any = dom.window;
    const order: string[] = [];
    const initializeUI = jest.fn(async () => { root.__uiInitialized = true; });
    const starter = createStartBrowserApp({
      root,
      document: root.document,
      contract,
      classicRootUrl: '../',
      loadScript: async (_url, key) => {
        order.push(key);
        if (key === 'entry') {
          installReadyGlobals(root);
          root.initializeUI = initializeUI;
        }
      }
    });
    const first = starter();
    const second = starter();
    expect(second).toBe(first);
    await first;
    expect(order).toEqual(['runtime', 'registry', 'layout', 'entry']);
    expect(initializeUI).toHaveBeenCalledTimes(1);
    expect(root.__CARD_REVERSI_BROWSER_LANE__).toBe('vite');
    expect(root.document.documentElement.dataset.browserBootState).toBe('ready');
  });

  test('surfaces a required script failure and does not continue booting', async () => {
    const dom = createDom();
    const root: any = dom.window;
    const order: string[] = [];
    const starter = createStartBrowserApp({
      root,
      document: root.document,
      contract,
      loadScript: async (_url, key) => {
        order.push(key);
        if (key === 'registry') throw new Error('registry unavailable');
      }
    });
    await expect(starter()).rejects.toThrow('registry unavailable');
    expect(order).toEqual(['runtime', 'registry']);
    expect(root.document.getElementById('browserViteBootError')?.textContent).toContain('registry unavailable');
    expect(root.document.documentElement.dataset.browserBootState).toBe('error');
  });

  test('waits for classic stylesheets before loading the browser entry', async () => {
    const dom = createDom();
    const root: any = dom.window;
    const order: string[] = [];
    let resolveStyles!: () => void;
    root.__CARD_REVERSI_CLASSIC_STYLES_READY__ = new Promise<void>((resolve) => {
      resolveStyles = resolve;
    });
    const starter = createStartBrowserApp({
      root,
      document: root.document,
      contract,
      loadScript: async (_url, key) => {
        order.push(key);
        if (key === 'entry') {
          installReadyGlobals(root);
          root.initializeUI = async () => { root.__uiInitialized = true; };
        }
      }
    });

    const boot = starter();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual(['runtime', 'registry', 'layout']);
    resolveStyles();
    await boot;
    expect(order).toEqual(['runtime', 'registry', 'layout', 'entry']);
  });

  test('installs feature loaders before handlers capture dependencies during UI initialization', async () => {
    const dom = createDom();
    const root: any = dom.window;
    const order: string[] = [];
    const capturedLoaders: any[] = [];
    const beforeInitialize = jest.fn(() => {
      order.push('feature-loader');
      root.loadLazyRuntimeGroup = jest.fn();
    });
    const starter = createStartBrowserApp({
      root,
      document: root.document,
      contract,
      beforeInitialize,
      loadScript: async (_url, key) => {
        order.push(key);
        if (key === 'entry') {
          installReadyGlobals(root);
          root.initializeUI = async () => {
            order.push('initialize-ui');
            capturedLoaders.push(root.loadLazyRuntimeGroup);
            root.__uiInitialized = true;
          };
        }
      }
    });

    await starter();
    expect(order).toEqual(['runtime', 'registry', 'layout', 'entry', 'feature-loader', 'initialize-ui']);
    expect(beforeInitialize).toHaveBeenCalledTimes(1);
    expect(capturedLoaders[0]).toBe(root.loadLazyRuntimeGroup);
  });
});
