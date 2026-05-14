import * as path from 'path';

describe('shared/ui-bootstrap-shared', () => {
  const sharedPath = path.resolve(__dirname, '..', 'shared', 'ui-bootstrap-shared.js');

  afterEach(() => {
    jest.resetModules();
    try { delete global.__uiImpl_turn_manager; } catch (e) { /* ignore */ }
    try { delete global.SharedUIBootstrap; } catch (e) { /* ignore */ }
    try { delete global.PlaybackStateManager; } catch (e) { /* ignore */ }
    try { delete global.PlaybackRuntime; } catch (e) { /* ignore */ }
    try { delete global.CoreLogic; } catch (e) { /* ignore */ }
    try { delete global.CardLogic; } catch (e) { /* ignore */ }
    try { delete global.resetGame; } catch (e) { /* ignore */ }
    try { delete global.handleCellClick; } catch (e) { /* ignore */ }
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
      global.PlaybackStateManager = playbackStateMock;
      global.PlaybackRuntime = playbackRuntimeMock;
      const shared = require(sharedPath);
      expect(shared.resolvePlaybackStateManager()).toBe(playbackStateMock);
      expect(shared.resolvePlaybackRuntime()).toBe(playbackRuntimeMock);
    });
  });

  test('mergeUIImpl syncs the turn-manager impl to root and globalThis', () => {
    jest.isolateModules(() => {
      const shared = require(sharedPath);
      global.CoreLogic = require(path.resolve(__dirname, '..', 'game', 'logic', 'core.js'));
      const turnManager = require(path.resolve(__dirname, '..', 'game', 'turn-manager.js'));
      const root = {};
      const buildCardInitOptions = jest.fn(() => ({ initialDeckSpec: null }));

      const merged = shared.mergeUIImpl(root, 'turn_manager', { buildCardInitOptions });

      expect(merged.buildCardInitOptions).toBe(buildCardInitOptions);
      expect(root.__uiImpl_turn_manager.buildCardInitOptions).toBe(buildCardInitOptions);
      expect(global.__uiImpl_turn_manager.buildCardInitOptions).toBe(buildCardInitOptions);
      expect(shared.readUIImpl(root, 'turn_manager').buildCardInitOptions).toBe(buildCardInitOptions);
      expect(turnManager.getUIImpl().buildCardInitOptions).toBe(buildCardInitOptions);
    });
  });

  test('writeUIImpl replaces the turn-manager impl while keeping root and global mirrors in sync', () => {
    jest.isolateModules(() => {
      const shared = require(sharedPath);
      global.CoreLogic = require(path.resolve(__dirname, '..', 'game', 'logic', 'core.js'));
      const turnManager = require(path.resolve(__dirname, '..', 'game', 'turn-manager.js'));
      const root = {};
      const initialBuildCardInitOptions = jest.fn(() => ({ boardConfig: { rows: 8, cols: 8 } }));
      const replacementReadBoardConfig = jest.fn(() => ({ rows: 6, cols: 6 }));

      turnManager.setUIImpl({
        buildCardInitOptions: initialBuildCardInitOptions,
        keepLegacyFlag: true
      });
      shared.writeUIImpl(root, 'turn_manager', { readBoardConfig: replacementReadBoardConfig });

      expect(root.__uiImpl_turn_manager).toEqual({
        readBoardConfig: replacementReadBoardConfig
      });
      expect(global.__uiImpl_turn_manager).toEqual({
        readBoardConfig: replacementReadBoardConfig
      });
      expect(turnManager.getUIImpl()).toEqual({
        readBoardConfig: replacementReadBoardConfig
      });
    });
  });
});
