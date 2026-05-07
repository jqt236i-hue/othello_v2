const path = require('path');
const { JSDOM } = require('jsdom');

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

    const uiBoot = require('../ui/bootstrap');

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
    // Mock the bootstrap module that init.ts will actually require
    jest.doMock('../ui/bootstrap', () => ({
      installGameDI: installGameDIMock,
      isGameDIInstalled: () => false
    }));

    const initModule = require('../ui/handlers/init');

    initModule.initializeUI();

    expect(installGameDIMock).toHaveBeenCalledTimes(1);
  });
});
