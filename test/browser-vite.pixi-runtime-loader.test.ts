import {
  applyPixiRuntimeOutcome,
  loadPixiRuntime
} from '../browser-vite/pixi-runtime-loader';

describe('Vite Pixi runtime loader', () => {
  test('returns an imported namespace without constructing an Application', async () => {
    const root: any = {};
    const runtime = { VERSION: '8.18.1', Application: jest.fn() };
    const outcome = await loadPixiRuntime({ root, importer: async () => runtime });
    expect(outcome).toEqual({ runtime, version: '8.18.1', unavailableReason: null });
    expect(runtime.Application).not.toHaveBeenCalled();
  });

  test('injects only successful outcomes and records failed imports as fallback capability', () => {
    const runtime = { VERSION: '8.18.1', Application: jest.fn() };
    const configurePixiRuntime = jest.fn(() => true);
    const markPixiRuntimeUnavailable = jest.fn(() => true);
    const root: any = { UIBootstrap: { configurePixiRuntime, markPixiRuntimeUnavailable } };

    expect(applyPixiRuntimeOutcome(root, { runtime, version: '8.18.1', unavailableReason: null })).toBe(true);
    expect(configurePixiRuntime).toHaveBeenCalledWith(runtime);
    expect(markPixiRuntimeUnavailable).not.toHaveBeenCalled();

    configurePixiRuntime.mockClear();
    expect(applyPixiRuntimeOutcome(root, {
      runtime: null,
      version: null,
      unavailableReason: 'pixi-import-failed:offline'
    })).toBe(false);
    expect(configurePixiRuntime).not.toHaveBeenCalled();
    expect(markPixiRuntimeUnavailable).toHaveBeenCalledWith(
      'pixi-import-failed:offline',
      { root, lane: 'vite' }
    );
  });
});
