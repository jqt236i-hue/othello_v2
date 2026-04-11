const path = require('path');

describe('shared/ui-bootstrap-shared', () => {
  const sharedPath = path.resolve(__dirname, '..', 'shared', 'ui-bootstrap-shared.js');

  afterEach(() => {
    jest.resetModules();
    try { delete global.__uiImpl_turn_manager; } catch (e) { /* ignore */ }
    try { delete global.SharedUIBootstrap; } catch (e) { /* ignore */ }
  });

  test('register and get work', () => {
    jest.isolateModules(() => {
      const shared = require(sharedPath);
      const result = shared.registerUIGlobals({ a: 1 });
      expect(result.a).toBe(1);
      expect(shared.getRegisteredUIGlobals()).toEqual(expect.objectContaining({ a: 1 }));
    });
  });

  test('resolves playback runtime modules through the shared resolver', () => {
    const playbackStateMock = {
      setBusyState: jest.fn()
    };
    const playbackRuntimeMock = {
      syncLegacyWindowFlags: jest.fn()
    };

    jest.isolateModules(() => {
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'playback-state-manager.js'), () => playbackStateMock, { virtual: false });
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'playback-runtime.js'), () => playbackRuntimeMock, { virtual: false });
      const shared = require(sharedPath);
      expect(shared.resolvePlaybackStateManager()).toBe(playbackStateMock);
      expect(shared.resolvePlaybackRuntime()).toBe(playbackRuntimeMock);
    });
  });

  test('mergeUIImpl syncs the turn-manager impl to root and globalThis', () => {
    jest.isolateModules(() => {
      const shared = require(sharedPath);
      const root = {};
      const buildCardInitOptions = jest.fn(() => ({ initialDeckSpec: null }));

      const merged = shared.mergeUIImpl(root, 'turn_manager', { buildCardInitOptions });

      expect(merged.buildCardInitOptions).toBe(buildCardInitOptions);
      expect(root.__uiImpl_turn_manager.buildCardInitOptions).toBe(buildCardInitOptions);
      expect(global.__uiImpl_turn_manager.buildCardInitOptions).toBe(buildCardInitOptions);
      expect(shared.readUIImpl(root, 'turn_manager').buildCardInitOptions).toBe(buildCardInitOptions);
    });
  });
});
