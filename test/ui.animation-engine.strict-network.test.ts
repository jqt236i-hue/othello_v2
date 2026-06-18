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
    }
  });

  test('paused network presentation timeline keeps playback state busy', () => {
    (global as any).NetworkPresentationTimeline = {
      getDiagnostics: () => ({ paused: true })
    };
    const PlaybackState = require('../ui/playback-state-manager');

    expect(PlaybackState.getPlaybackActive()).toBe(true);
    expect(PlaybackState.shouldDeferBoardUpdate({})).toBe(true);
  });
});
