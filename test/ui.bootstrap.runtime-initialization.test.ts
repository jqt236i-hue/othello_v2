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
});
