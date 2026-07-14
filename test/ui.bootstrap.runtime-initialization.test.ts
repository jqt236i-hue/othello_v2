import { JSDOM } from 'jsdom';

describe('UIBootstrap runtime initialization', () => {
  afterEach(() => {
    try { delete (global as any).window; } catch (e) { /* ignore */ }
    try { delete (global as any).document; } catch (e) { /* ignore */ }
  });

  test('importing the bootstrap facade does not install compatibility globals', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    const bootstrap = require('../ui/bootstrap.ts');

    expect((dom.window as any).UIBootstrap).toBeUndefined();
    expect((dom.window as any).OwnerHelpers).toBeUndefined();
    expect(typeof bootstrap.initializeUIBootstrapRuntime).toBe('function');
    expect(Object.keys(bootstrap)).not.toContain('initializeUIBootstrapRuntime');
  });

  test('explicit initialization installs compatibility globals once', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    const bootstrap = require('../ui/bootstrap.ts');

    expect(bootstrap.initializeUIBootstrapRuntime(dom.window)).toBe(true);
    expect((dom.window as any).UIBootstrap).toBe(bootstrap);
    expect((dom.window as any).OwnerHelpers).toBeDefined();
    expect(bootstrap.initializeUIBootstrapRuntime(dom.window)).toBe(false);
  });

  test('classic initialization injects the UMD runtime before UI discovery', () => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const root = dom.window as any;
    root.__CARD_REVERSI_BROWSER_LANE__ = 'classic';
    root.PIXI = { VERSION: '8.18.1', Application: jest.fn() };
    (global as any).window = root;
    (global as any).document = root.document;
    const bootstrap = require('../ui/bootstrap.ts');

    expect(bootstrap.initializeUIBootstrapRuntime(root)).toBe(true);
    expect(bootstrap.getPixiRuntimeCapability()).toEqual({
      lane: 'classic', injected: true, version: '8.18.1', unavailableReason: null
    });
    expect(root.PIXI.Application).not.toHaveBeenCalled();
  });

  test('classic missing global is a fallback capability while Vite waits for module injection', () => {
    jest.resetModules();
    const classicDom = new JSDOM('<!doctype html><html><body></body></html>');
    const classicRoot = classicDom.window as any;
    classicRoot.__CARD_REVERSI_BROWSER_LANE__ = 'classic';
    (global as any).window = classicRoot;
    (global as any).document = classicRoot.document;
    const classicBootstrap = require('../ui/bootstrap.ts');
    classicBootstrap.initializeUIBootstrapRuntime(classicRoot);
    expect(classicBootstrap.getPixiRuntimeCapability()).toMatchObject({
      lane: 'classic', injected: false, unavailableReason: 'classic-global-missing'
    });

    jest.resetModules();
    const viteDom = new JSDOM('<!doctype html><html><body></body></html>');
    const viteRoot = viteDom.window as any;
    viteRoot.__CARD_REVERSI_BROWSER_LANE__ = 'vite';
    (global as any).window = viteRoot;
    (global as any).document = viteRoot.document;
    const viteBootstrap = require('../ui/bootstrap.ts');
    viteBootstrap.initializeUIBootstrapRuntime(viteRoot);
    expect(viteBootstrap.getPixiRuntimeCapability()).toMatchObject({
      lane: 'unknown', injected: false, unavailableReason: 'not-configured'
    });
  });
});
