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

  test('watchdog restarts after each completed phase in a long ordered journal', async () => {
    const AnimationEngine = require('../ui/animation-engine');
    const originalExecutePhase = AnimationEngine.executePhase;
    let resolveFirst!: () => void;
    let resolveSecond!: () => void;
    const firstPhase = new Promise<void>((resolve) => { resolveFirst = resolve; });
    const secondPhase = new Promise<void>((resolve) => { resolveSecond = resolve; });
    AnimationEngine.executePhase = jest.fn()
      .mockImplementationOnce(() => firstPhase)
      .mockImplementationOnce(() => secondPhase);

    try {
      const playPromise = AnimationEngine.play([
        { type: 'place_hand_animation', phase: 1, strictNetworkPlayback: true, targets: [] },
        { type: 'spawn', phase: 2, strictNetworkPlayback: true, targets: [] }
      ], { strictNetworkPlayback: true });

      await Promise.resolve();
      jest.advanceTimersByTime(9);
      resolveFirst();
      await Promise.resolve();
      await Promise.resolve();
      expect(AnimationEngine.executePhase).toHaveBeenCalledTimes(2);

      jest.advanceTimersByTime(9);
      resolveSecond();
      await expect(playPromise).resolves.toBeUndefined();
      expect((global as any).window.__telemetry__?.watchdogFired || 0).toBe(0);
    } finally {
      AnimationEngine.executePhase = originalExecutePhase;
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

  test('strict network playback over the event cap warns and settles every event in order', async () => {
    const requestBoardUpdate = jest.fn();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (global as any).window.PLAYBACK_EVENT_CAP = 2;
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
      const executePhaseSpy = jest.spyOn(AnimationEngine, 'executePhase').mockResolvedValue(undefined);
      const sleepSpy = jest.spyOn(AnimationEngine, '_sleep').mockResolvedValue(undefined);

      try {
        const events = [
          { type: 'flip', phase: 1, strictNetworkPlayback: true, targets: [] },
          { type: 'move', phase: 2, strictNetworkPlayback: true, targets: [] },
          { type: 'destroy', phase: 3, strictNetworkPlayback: true, targets: [] }
        ];
        await expect(AnimationEngine.play(events, { strictNetworkPlayback: true })).resolves.toBeUndefined();

        expect(requestBoardUpdate).toHaveBeenCalledTimes(1);
        expect(executePhaseSpy.mock.calls.map(([phaseEvents]) => phaseEvents.map((event: any) => event.type))).toEqual([
          ['flip'],
          ['move'],
          ['destroy']
        ]);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining('Continuing ordered playback'),
          expect.objectContaining({ original: 3, cap: 2, strictNetworkPlayback: true })
        );
        expect((global as any).window.__telemetry__.playbackEventCapExceeded).toBe(1);
        expect((global as any).window.__telemetry__.playbackFastForwarded).toBeUndefined();
      } finally {
        sleepSpy.mockRestore();
        executePhaseSpy.mockRestore();
      }
    } finally {
      warnSpy.mockRestore();
      jest.dontMock('../ui/animation-resolver');
    }
  });

  test('strict playback without a writer fails typed and never fast-forwards board pixels', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const board = dom.window.document.getElementById('board') as HTMLElement;
    board.innerHTML = '<div class="cell" data-row="0" data-col="0"></div>';
    const AnimationEngine = require('../ui/animation-engine');

    try {
      await expect(AnimationEngine.play([{
        type: 'place',
        phase: 1,
        strictNetworkPlayback: true,
        targets: [{ r: 0, col: 0, after: { color: 1, owner: 'black' } }]
      }], { strictNetworkPlayback: true })).rejects.toEqual(expect.objectContaining({
        name: 'PresentationPlaybackError',
        code: 'board_writer_token_unavailable',
        strictNetworkPlayback: true
      }));
      expect(board.querySelector('.disc')).toBeNull();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('strict cap warning still dispatches every real board phase through one writer', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    (global as any).window.PLAYBACK_EVENT_CAP = 2;
    const renderer = require('../ui/board-renderer');
    await renderer.getBoardVisualControllerReady();
    const token = renderer.claimBoardVisualWriter('local:strict-cap-fixture', 'local');
    const playPhaseSpy = jest.spyOn(renderer, 'playBoardVisualPhase');
    const AnimationEngine = require('../ui/animation-engine');
    const sleepSpy = jest.spyOn(AnimationEngine, '_sleep').mockResolvedValue(undefined);

    try {
      await AnimationEngine.play([
        { type: 'place', phase: 1, targets: [] },
        { type: 'flip', phase: 2, targets: [] },
        { type: 'destroy', phase: 3, targets: [] }
      ], { strictNetworkPlayback: true, boardWriterToken: token });

      expect(playPhaseSpy.mock.calls.map(([, events]: any[]) => events.map((event: any) => event.type))).toEqual([
        ['place'],
        ['flip'],
        ['destroy']
      ]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Continuing ordered playback'),
        expect.objectContaining({ original: 3, cap: 2, strictNetworkPlayback: true })
      );
    } finally {
      renderer.releaseBoardVisualWriter(token);
      sleepSpy.mockRestore();
      playPhaseSpy.mockRestore();
      warnSpy.mockRestore();
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

  test('paused active network presentation settlement keeps input locked', () => {
    (global as any).NetworkPresentationTimeline = {
      getDiagnostics: () => ({
        playing: false,
        paused: true,
        activeSettlementStage: 'apply-committed-frame',
        blocksInput: true
      })
    };
    const PlaybackState = require('../ui/playback-state-manager');

    expect(PlaybackState.getPlaybackActive()).toBe(true);
    expect(PlaybackState.shouldDeferBoardUpdate({})).toBe(true);
  });
});
