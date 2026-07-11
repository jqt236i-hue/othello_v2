import { JSDOM } from 'jsdom';

describe('NetworkMatchClient runtime initialization', () => {
  afterEach(() => {
    try { delete (global as any).window; } catch (e) { /* ignore */ }
    try { delete (global as any).document; } catch (e) { /* ignore */ }
    try { delete (global as any).location; } catch (e) { /* ignore */ }
    try { delete (global as any).localStorage; } catch (e) { /* ignore */ }
  });

  test('importing the facade does not install globals, diagnostics listeners, or a signal bridge', () => {
    jest.resetModules();
    const setSignalBridge = jest.fn();
    jest.doMock('../game/card-effects/selection-flow', () => ({ setSignalBridge }));
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).localStorage = dom.window.localStorage;
    const addEventListener = jest.spyOn(dom.window.document, 'addEventListener');

    const client = require('../ui/network-client.ts');

    expect((dom.window as any).NetworkMatchClient).toBeUndefined();
    expect((dom.window as any).__networkDebugTrace).toBeUndefined();
    expect(addEventListener).not.toHaveBeenCalled();
    expect(setSignalBridge).not.toHaveBeenCalled();
    expect(typeof client.initializeNetworkMatchClientRuntime).toBe('function');
    expect(Object.keys(client)).not.toContain('initializeNetworkMatchClientRuntime');
  });

  test('explicit initialization installs compatibility globals once', () => {
    jest.resetModules();
    const setSignalBridge = jest.fn();
    jest.doMock('../game/card-effects/selection-flow', () => ({ setSignalBridge }));
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).location = dom.window.location;
    (global as any).localStorage = dom.window.localStorage;
    const addEventListener = jest.spyOn(dom.window.document, 'addEventListener');
    const client = require('../ui/network-client.ts');

    expect(client.initializeNetworkMatchClientRuntime(dom.window)).toBe(true);
    expect((dom.window as any).NetworkMatchClient).toBe(client);
    expect((dom.window as any).__networkDebugTrace).toBeDefined();
    expect(setSignalBridge).toHaveBeenCalledTimes(1);
    const firstBindingCount = addEventListener.mock.calls.length;
    expect(firstBindingCount).toBeGreaterThan(0);

    expect(client.initializeNetworkMatchClientRuntime(dom.window)).toBe(false);
    expect(addEventListener).toHaveBeenCalledTimes(firstBindingCount);
  });
});
