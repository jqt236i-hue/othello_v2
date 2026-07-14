describe('Pixi runtime injection contract', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  function fakeRuntime(version = '8.18.1'): any {
    return { VERSION: version, Application: jest.fn() };
  }

  test('keeps the first valid runtime private and publishes a frozen capability', () => {
    const contract = require('../ui/pixi/runtime-contract');
    const root: any = {
      __CARD_REVERSI_BROWSER_LANE__: 'vite',
      __CARD_REVERSI_BROWSER_CAPABILITIES__: Object.freeze({ esmEntry: true })
    };
    const runtime = fakeRuntime();

    expect(contract.configurePixiRuntime(runtime, { root })).toBe(true);
    expect(contract.configurePixiRuntime(runtime, { root })).toBe(true);
    expect(contract.getPixiRuntime()).toBe(runtime);
    expect(runtime.Application).not.toHaveBeenCalled();
    expect(contract.getPixiRuntimeCapability()).toEqual({
      lane: 'vite', injected: true, version: '8.18.1', unavailableReason: null
    });
    expect(Object.isFrozen(contract.getPixiRuntimeCapability())).toBe(true);
    expect(Object.isFrozen(root.__CARD_REVERSI_BROWSER_CAPABILITIES__)).toBe(true);
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__).toMatchObject({
      esmEntry: true,
      pixiRuntime: { lane: 'vite', injected: true, version: '8.18.1', unavailableReason: null }
    });
    expect(root.__CARD_REVERSI_BROWSER_CAPABILITIES__.pixiRuntime).not.toHaveProperty('Application');
  });

  test('rejects malformed, mismatched, and conflicting runtimes without constructing Application', () => {
    const contract = require('../ui/pixi/runtime-contract');
    const root: any = { __CARD_REVERSI_BROWSER_LANE__: 'test' };
    expect(contract.configurePixiRuntime({ VERSION: '8.18.0', Application: jest.fn() }, { root })).toBe(false);
    expect(contract.getPixiRuntimeCapability()).toMatchObject({
      injected: false,
      version: '8.18.0',
      unavailableReason: 'runtime-version-mismatch:8.18.0'
    });
    expect(contract.configurePixiRuntime({ VERSION: '8.18.1' }, { root })).toBe(false);
    expect(contract.getPixiRuntimeCapability().unavailableReason).toBe('runtime-application-missing');

    const first = fakeRuntime();
    const second = fakeRuntime();
    expect(contract.configurePixiRuntime(first, { root })).toBe(true);
    expect(contract.configurePixiRuntime(second, { root })).toBe(false);
    expect(contract.getPixiRuntime()).toBe(first);
    expect(first.Application).not.toHaveBeenCalled();
    expect(second.Application).not.toHaveBeenCalled();
  });

  test('records an unavailable reason without overriding an injected runtime', () => {
    const contract = require('../ui/pixi/runtime-contract');
    const root: any = { __CARD_REVERSI_BROWSER_LANE__: 'vite' };
    expect(contract.markPixiRuntimeUnavailable('chunk-load-failed', { root })).toBe(true);
    expect(contract.getPixiRuntimeCapability()).toEqual({
      lane: 'vite', injected: false, version: null, unavailableReason: 'chunk-load-failed'
    });
    const runtime = fakeRuntime();
    expect(contract.configurePixiRuntime(runtime, { root })).toBe(true);
    expect(contract.markPixiRuntimeUnavailable('late-failure', { root })).toBe(false);
    expect(contract.getPixiRuntimeCapability().injected).toBe(true);
  });
});
