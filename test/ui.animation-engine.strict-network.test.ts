import { JSDOM } from 'jsdom';

describe('AnimationEngine strict network playback', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).window.PLAYBACK_WATCHDOG_MS = 10;
  });

  afterEach(() => {
    jest.useRealTimers();
    try { dom.window.close(); } catch (e) { /* ignore */ }
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).NetworkPresentationTimeline;
  });

  test('watchdog rejects strict network playback instead of reporting successful sync', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const AnimationEngine = require('../ui/animation-engine');
    const originalExecutePhase = AnimationEngine.executePhase;
    AnimationEngine.executePhase = jest.fn(() => new Promise(() => {}));

    try {
      const playPromise = AnimationEngine.play([
        { type: 'flip', phase: 1, strictNetworkPlayback: true, targets: [] }
      ], { strictNetworkPlayback: true });

      await Promise.resolve();
      jest.advanceTimersByTime(20);

      await expect(playPromise).rejects.toThrow(/network_playback_watchdog/);
    } finally {
      AnimationEngine.executePhase = originalExecutePhase;
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    }
  });

  test('strict network playback failure does not emit final board sync', async () => {
    const requestBoardUpdate = jest.fn();
    const failure = new Error('strict_phase_failed');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.doMock('../ui/animation-resolver', () => ({
      getAnimationShared: () => null,
      resolveModuleOrGlobal: (modulePath: string) => {
        if (modulePath === './board-update-dispatch') {
          return { requestBoardUpdate };
        }
        return null;
      }
    }));

    try {
      const AnimationEngine = require('../ui/animation-engine');
      const originalExecutePhase = AnimationEngine.executePhase;
      AnimationEngine.executePhase = jest.fn().mockRejectedValue(failure);

      try {
        await expect(AnimationEngine.play([
          { type: 'flip', phase: 1, strictNetworkPlayback: true, targets: [] }
        ], { strictNetworkPlayback: true })).rejects.toThrow(/strict_phase_failed/);

        expect(requestBoardUpdate).not.toHaveBeenCalled();
      } finally {
        AnimationEngine.executePhase = originalExecutePhase;
      }
    } finally {
      errorSpy.mockRestore();
      jest.dontMock('../ui/animation-resolver');
    }
  });

  test('playing network presentation timeline keeps playback state busy', () => {
    (global as any).NetworkPresentationTimeline = {
      getDiagnostics: () => ({ playing: true, paused: false })
    };
    const PlaybackState = require('../ui/playback-state-manager');

    expect(PlaybackState.getPlaybackActive()).toBe(true);
    expect(PlaybackState.shouldDeferBoardUpdate({})).toBe(true);
  });

  test('paused network presentation timeline is diagnostic and does not keep input locked', () => {
    (global as any).NetworkPresentationTimeline = {
      getDiagnostics: () => ({ playing: false, paused: true })
    };
    const PlaybackState = require('../ui/playback-state-manager');

    expect(PlaybackState.getPlaybackActive()).toBe(false);
    expect(PlaybackState.shouldDeferBoardUpdate({})).toBe(false);
  });
});
