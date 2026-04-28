import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('ui/bootstrap lazy install', () => {
  afterEach(() => {
    jest.resetModules();
    try { delete global.window; } catch (e) {}
    try { delete global.document; } catch (e) {}
  });

  test('requiring ui/bootstrap does not eagerly install game DI', () => {
    const cpuFactory = jest.fn(() => ({ processCpuTurn: jest.fn(), processAutoBlackTurn: jest.fn() }));
    const turnManagerFactory = jest.fn(() => ({ setUIImpl: jest.fn() }));

    jest.doMock('../game/cpu-turn-handler', cpuFactory);
    jest.doMock('../game/turn-manager', turnManagerFactory);

    import * as uiBoot from '../ui/bootstrap.js';

    expect(typeof uiBoot.installGameDI).toBe('function');
    expect(typeof uiBoot.isGameDIInstalled).toBe('function');
    expect(uiBoot.isGameDIInstalled()).toBe(false);
    expect(cpuFactory).not.toHaveBeenCalled();
    expect(turnManagerFactory).not.toHaveBeenCalled();
    expect(typeof global.processCpuTurn).toBe('undefined');
  });

  test('initializeUI installs game DI explicitly', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;

    const installGameDIMock = jest.fn();
    const bootstrapPath = path.resolve(__dirname, '..', 'ui', 'bootstrap.js');
    jest.doMock(bootstrapPath, () => ({
      installGameDI: installGameDIMock
    }), { virtual: false });

    const initPath = path.resolve(__dirname, '..', 'ui', 'handlers', 'init.js');
    const initModule = require(initPath);

    initModule.initializeUI();

    expect(installGameDIMock).toHaveBeenCalledTimes(1);
  });
});
