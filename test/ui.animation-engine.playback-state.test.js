describe('animation-engine playback-state integration', () => {
  beforeEach(() => {
    jest.resetModules();
    global.window = {
      __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }
    };
    global.document = {
      getElementById: () => ({
        classList: { add() {}, remove() {} },
        querySelector: () => null,
        getBoundingClientRect: () => ({})
      })
    };
    global.emitBoardUpdate = jest.fn();
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.emitBoardUpdate;
  });

  test('watchdog clears playback through PlaybackStateManager', async () => {
    const playbackStateMock = {
      setInteractionLock: jest.fn(),
      setPlaybackActive: jest.fn(),
      setSuppressNextDiffFlip: jest.fn()
    };

    jest.doMock('../ui/playback-state-manager', () => playbackStateMock);

    const engine = require('../ui/animation-engine');
    await engine.handleWatchdog();

    expect(playbackStateMock.setInteractionLock).toHaveBeenCalledWith(false);
    expect(playbackStateMock.setPlaybackActive).toHaveBeenCalledWith(false);
  });
});
