import { JSDOM } from 'jsdom';

describe('ui bootstrap debug logging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
    try { delete global.window; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.document; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.location; } catch (e) { /* Intentionally empty: test cleanup guard */ }
    try { delete global.debugLog; } catch (e) { global.debugLog = undefined; }
  });

  test('addLog stores DOM log entries while keeping console mirroring debug-gated', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="log"></div></body></html>', {
      url: 'http://localhost/'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const bootstrap = require('../ui/bootstrap.js');
    bootstrap.addLog('quiet entry');
    expect(Array.from(document.querySelectorAll('#log .logEntry')).map((el) => el.textContent)).toEqual(['quiet entry']);
    expect(document.getElementById('log')?.classList.contains('is-visible')).toBe(false);
    expect(document.getElementById('log')?.getAttribute('aria-hidden')).toBe('true');
    expect(logSpy).not.toHaveBeenCalled();

    bootstrap.registerUIGlobals({ DEBUG_MODE_ALLOWED: true });
    bootstrap.addLog('debug entry');
    expect(Array.from(document.querySelectorAll('#log .logEntry')).map((el) => el.textContent)).toEqual(['quiet entry', 'debug entry']);
    expect(document.getElementById('log')?.classList.contains('is-visible')).toBe(false);
    expect(document.getElementById('log')?.getAttribute('aria-hidden')).toBe('true');
    expect(logSpy).toHaveBeenCalledWith('[log]', 'debug entry');

    dom.window.close();
  });

  test('registerUIGlobals installs and removes global debugLog with debug gating', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const bootstrap = require('../ui/bootstrap.js');
    const envCapable = require('../is-env-capable.js');
    expect(envCapable.isDebugLogAvailable()).toBe(false);

    bootstrap.registerUIGlobals({ DEBUG_UNLIMITED_USAGE: true });
    expect(envCapable.isDebugLogAvailable()).toBe(true);
    expect(global.window.debugLog).toBe(bootstrap.debugLog);
    expect(globalThis.debugLog).toBe(bootstrap.debugLog);
    expect(bootstrap.debugLog('turn advanced', 'info', { turn: 4 })).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith('[debug:info]', 'turn advanced', { turn: 4 });

    bootstrap.registerUIGlobals({ DEBUG_UNLIMITED_USAGE: false, DEBUG_MODE_ALLOWED: false });
    expect(envCapable.isDebugLogAvailable()).toBe(false);
    expect(global.window.debugLog).toBeUndefined();
    expect(globalThis.debugLog).toBeUndefined();
    expect(bootstrap.debugLog('hidden trace')).toBe(false);

    dom.window.close();
  });

  test('query debug flag enables initial console mirroring and global debugLog', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="log"></div></body></html>', {
      url: 'http://localhost/?debug=1'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const bootstrap = require('../ui/bootstrap.js');
    const envCapable = require('../is-env-capable.js');
    expect(envCapable.isDebugLogAvailable()).toBe(true);
    expect(global.window.debugLog).toBe(bootstrap.debugLog);

    bootstrap.addLog('query debug trace');
    expect(logSpy).toHaveBeenCalledWith('[log]', 'query debug trace');

    dom.window.close();
  });

  test('network local debug mode also enables global debugLog without unlimited usage', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      url: 'http://localhost/'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;

    const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    const bootstrap = require('../ui/bootstrap.js');
    const envCapable = require('../is-env-capable.js');
    expect(envCapable.isDebugLogAvailable()).toBe(false);

    bootstrap.registerUIGlobals({ NETWORK_LOCAL_DEBUG_MODE: true, DEBUG_UNLIMITED_USAGE: false, DEBUG_MODE_ALLOWED: false });
    expect(envCapable.isDebugLogAvailable()).toBe(true);
    expect(global.window.debugLog).toBe(bootstrap.debugLog);
    expect(bootstrap.debugLog('network local trace', 'info')).toBe(true);
    expect(infoSpy).toHaveBeenCalledWith('[debug:info]', 'network local trace');

    bootstrap.registerUIGlobals({ NETWORK_LOCAL_DEBUG_MODE: false, DEBUG_UNLIMITED_USAGE: false, DEBUG_MODE_ALLOWED: false });
    expect(envCapable.isDebugLogAvailable()).toBe(false);

    dom.window.close();
  });

  test('window.addLog keeps routing to the bootstrap DOM logger after ui exports are mirrored onto window', () => {
    const dom = new JSDOM('<!doctype html><html><body><div id="board"></div><div id="log"></div></body></html>', {
      url: 'http://localhost/'
    });
    global.window = dom.window;
    global.document = dom.window.document;
    global.location = dom.window.location;

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const bootstrap = require('../ui/bootstrap.js');
    const uiModule = require('../ui.ts');
    Object.assign(global.window, uiModule);

    global.window.addLog('window routed entry');

    expect(Array.from(document.querySelectorAll('#log .logEntry')).map((el) => el.textContent)).toEqual(['window routed entry']);
    expect(logSpy).not.toHaveBeenCalled();

    dom.window.close();
  });
});
