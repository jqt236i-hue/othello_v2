describe('UI bootstrap early CPU registration', () => {
  const modPath = require.resolve('../ui/bootstrap');
  beforeEach(() => {
    jest.resetModules();
    try { delete global.processCpuTurn; } catch (e) {}
  });

  test('installGameDI registers processCpuTurn when cpu-turn-handler exposes it', () => {
    const mockCpu = { processCpuTurn: jest.fn(), processAutoBlackTurn: jest.fn() };
    jest.doMock('../game/cpu-turn-handler', () => mockCpu);

    const uiBoot = require('../ui/bootstrap');
    // Call installGameDI (returns impl) to perform the registration logic
    const impl = uiBoot.installGameDI();

    const globals = uiBoot.getRegisteredUIGlobals();
    expect(typeof globals.processCpuTurn).toBe('function');
    expect(typeof globals.processAutoBlackTurn).toBe('function');
    // Also mirrors to globalThis for legacy fallback
    expect(typeof global.processCpuTurn === 'function' || typeof globalThis.processCpuTurn === 'function').toBe(true);
  });
});
