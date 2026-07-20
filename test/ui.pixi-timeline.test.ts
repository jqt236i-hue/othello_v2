import TimelineModule = require('../ui/pixi/timeline');

function createManualClock(log: string[] = []) {
  const listeners = new Set<(deltaMs: number) => void>();
  let running = false;
  const clock = {
    subscribe: jest.fn((listener: (deltaMs: number) => void) => {
      log.push('clock:subscribe');
      listeners.add(listener);
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        log.push('clock:unsubscribe');
        listeners.delete(listener);
      };
    }),
    start: jest.fn(() => {
      log.push('clock:start');
      running = true;
    }),
    stop: jest.fn(() => {
      log.push('clock:stop');
      running = false;
    }),
    tick(deltaMs: number) {
      if (!running) return;
      for (const listener of Array.from(listeners)) listener(deltaMs);
    },
    get running() { return running; },
    get listenerCount() { return listeners.size; }
  };
  return clock;
}

function callbacks(log: string[], name = '') {
  const suffix = name ? `:${name}` : '';
  return {
    onStart: jest.fn(() => { log.push(`start${suffix}`); }),
    onUpdate: jest.fn((progress: number) => { log.push(`update${suffix}:${progress}`); }),
    onComplete: jest.fn(() => { log.push(`complete${suffix}`); }),
    onError: jest.fn(() => { log.push(`error${suffix}`); }),
    onSettled: jest.fn((settlement: any) => { log.push(`settled${suffix}:${settlement.status}`); })
  };
}

describe('Pixi board timeline', () => {
  test('NOANIM normalizes only duration and keeps the complete callback path', async () => {
    const log: string[] = [];
    const clock = createManualClock(log);
    const resolveDurationMs = jest.fn((context: any) => context.reducedMotion ? 25 : context.baseDurationMs);
    const timeline = TimelineModule.createPixiTimeline({
      clock,
      render: () => { log.push('render'); },
      resolveDurationMs,
      noAnimation: true,
      reducedMotion: true
    });
    const hooks = callbacks(log);

    const result = await timeline.run({ durationMs: 100, effectFamily: 'flip', ...hooks });

    expect(resolveDurationMs).toHaveBeenCalledWith(expect.objectContaining({
      baseDurationMs: 100,
      effectFamily: 'flip',
      noAnimation: true,
      reducedMotion: true
    }));
    expect(result).toMatchObject({ durationMs: 0, elapsedMs: 0, noAnimation: true, reducedMotion: true });
    expect(log).toEqual([
      'start',
      'update:0',
      'render',
      'update:1',
      'render',
      'complete',
      'settled:completed'
    ]);
    expect(clock.subscribe).not.toHaveBeenCalled();
    expect(clock.start).not.toHaveBeenCalled();
    expect(clock.stop).not.toHaveBeenCalled();
    expect(timeline.getDiagnostics()).toMatchObject({
      state: 'idle',
      activeRunCount: 0,
      tickerRunning: false,
      tickerSubscribed: false,
      completedRunCount: 1
    });
  });

  test('reduced motion remains an injected duration policy instead of becoming NOANIM', async () => {
    const clock = createManualClock();
    const timeline = TimelineModule.createPixiTimeline({
      clock,
      render: jest.fn(),
      reducedMotion: true,
      resolveDurationMs: (context) => context.reducedMotion ? 20 : context.baseDurationMs
    });
    const updates: number[] = [];
    const playback = timeline.run({
      durationMs: 100,
      effectFamily: 'move',
      onUpdate: (progress) => { updates.push(progress); }
    });

    expect(timeline.getDiagnostics()).toMatchObject({ state: 'running', tickerRunning: false, activeRunCount: 1 });
    await Promise.resolve();
    expect(timeline.getDiagnostics()).toMatchObject({ tickerRunning: true, activeRunCount: 1 });
    clock.tick(20);

    await expect(playback).resolves.toMatchObject({
      durationMs: 20,
      noAnimation: false,
      reducedMotion: true
    });
    expect(updates).toEqual([0, 1]);
    expect(clock.start).toHaveBeenCalledTimes(1);
    expect(clock.stop).toHaveBeenCalledTimes(1);
  });

  test('advances from a manual clock and stops only after final render and settlement', async () => {
    const log: string[] = [];
    const clock = createManualClock(log);
    const timeline = TimelineModule.createPixiTimeline({ clock, render: () => { log.push('render'); } });
    const hooks = callbacks(log);
    const playback = timeline.run({ durationMs: 100, ...hooks });

    expect(log).toEqual(['start', 'update:0']);
    await Promise.resolve();
    expect(log).toEqual(['start', 'update:0', 'render', 'clock:subscribe', 'clock:start']);
    clock.tick(40);
    clock.tick(60);
    await expect(playback).resolves.toMatchObject({ durationMs: 100, elapsedMs: 100 });

    expect(log).toEqual([
      'start',
      'update:0',
      'render',
      'clock:subscribe',
      'clock:start',
      'update:0.4',
      'render',
      'update:1',
      'render',
      'complete',
      'settled:completed',
      'clock:stop',
      'clock:unsubscribe'
    ]);
    expect(clock.listenerCount).toBe(0);
    expect(timeline.getDiagnostics()).toMatchObject({
      state: 'idle', tickerRunning: false, tickerSubscribed: false,
      tickerStartCount: 1, tickerStopCount: 1
    });
  });

  test('samples an exact debug frame when one private-ticker delta crosses the requested time', async () => {
    const clock = createManualClock();
    let currentProgress = -1;
    const renderedProgress: number[] = [];
    const timeline = TimelineModule.createPixiTimeline({
      clock,
      render: () => { renderedProgress.push(currentProgress); }
    });
    const playback = timeline.run({
      durationMs: 200,
      onUpdate: (progress) => { currentProgress = progress; }
    });
    await Promise.resolve();
    renderedProgress.length = 0;

    const capture = timeline.captureDebugFrameAtElapsed(72, () => currentProgress);
    clock.tick(100);

    await expect(capture).resolves.toEqual({ value: 0.36, elapsedMs: 72 });
    expect(currentProgress).toBe(0.5);
    expect(renderedProgress).toEqual([0.36, 0.5]);
    expect(clock.listenerCount).toBe(1);
    expect(timeline.getDiagnostics()).toMatchObject({
      activeDebugFrameCaptureCount: 0,
      completedDebugFrameCaptureCount: 1,
      failedDebugFrameCaptureCount: 0
    });

    clock.tick(100);
    await expect(playback).resolves.toMatchObject({ elapsedMs: 200 });
  });

  test('rejects a pending debug frame when playback is destroyed', async () => {
    const clock = createManualClock();
    const timeline = TimelineModule.createPixiTimeline({ clock, render: jest.fn() });
    const playback = timeline.run({ durationMs: 200, onUpdate: jest.fn() });
    await Promise.resolve();
    const capture = timeline.captureDebugFrameAtElapsed(72, () => 'frame');

    timeline.destroy();

    await expect(capture).rejects.toMatchObject({ code: 'pixi_timeline_destroyed' });
    await expect(playback).rejects.toMatchObject({ code: 'pixi_timeline_destroyed' });
    expect(timeline.getDiagnostics()).toMatchObject({
      activeDebugFrameCaptureCount: 0,
      completedDebugFrameCaptureCount: 0,
      failedDebugFrameCaptureCount: 1
    });
  });

  test('rejects an unreachable debug frame when a zero-duration run becomes idle', async () => {
    const clock = createManualClock();
    const captureValue = jest.fn(() => 'stale-frame');
    const timeline = TimelineModule.createPixiTimeline({ clock, render: jest.fn() });
    const playback = timeline.run({ durationMs: 0, onUpdate: jest.fn() });
    const capture = timeline.captureDebugFrameAtElapsed(1, captureValue);
    const captureExpectation = expect(capture).rejects.toThrow('became idle');

    await expect(playback).resolves.toMatchObject({ durationMs: 0, elapsedMs: 0 });
    await captureExpectation;
    expect(captureValue).not.toHaveBeenCalled();
    expect(timeline.getDiagnostics()).toMatchObject({
      state: 'idle',
      activeDebugFrameCaptureCount: 0,
      failedDebugFrameCaptureCount: 1
    });
  });

  test.each(['initial-render', 'clock-start'] as const)(
    'rejects pending debug capture on %s failure without carrying it into the next run',
    async (failureMode) => {
      const clock = createManualClock();
      const failure = new Error(`${failureMode}-failed`);
      if (failureMode === 'clock-start') clock.start.mockImplementationOnce(() => { throw failure; });
      let failRender = failureMode === 'initial-render';
      const render = jest.fn(() => {
        if (!failRender) return;
        failRender = false;
        throw failure;
      });
      const captureValue = jest.fn(() => 'stale-frame');
      const timeline = TimelineModule.createPixiTimeline({ clock, render });
      const failedPlayback = timeline.run({ durationMs: 100, onUpdate: jest.fn() });
      const capture = timeline.captureDebugFrameAtElapsed(72, captureValue);
      const captureExpectation = expect(capture).rejects.toBe(failure);

      await expect(failedPlayback).rejects.toBe(failure);
      await captureExpectation;
      expect(captureValue).not.toHaveBeenCalled();
      expect(timeline.getDiagnostics()).toMatchObject({
        state: 'idle',
        activeDebugFrameCaptureCount: 0,
        failedDebugFrameCaptureCount: 1
      });

      const nextPlayback = timeline.run({ durationMs: 10, onUpdate: jest.fn() });
      await Promise.resolve();
      clock.tick(10);
      await expect(nextPlayback).resolves.toMatchObject({ elapsedMs: 10 });
      expect(captureValue).not.toHaveBeenCalled();
    }
  );

  test('shares one ticker across parallel runs and the first completion cannot stop it', async () => {
    const log: string[] = [];
    const clock = createManualClock(log);
    const render = jest.fn(() => { log.push('render:shared'); });
    const timeline = TimelineModule.createPixiTimeline({ clock, render });
    const firstHooks = callbacks(log, 'first');
    const secondHooks = callbacks(log, 'second');
    const first = timeline.run({ ...firstHooks, durationMs: 50 });
    const second = timeline.run({ ...secondHooks, durationMs: 100 });
    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(1);
    render.mockClear();

    expect(clock.subscribe).toHaveBeenCalledTimes(1);
    expect(clock.start).toHaveBeenCalledTimes(1);
    expect(timeline.getDiagnostics()).toMatchObject({ activeRunCount: 2, tickerRunning: true });

    clock.tick(50);
    await expect(first).resolves.toMatchObject({ elapsedMs: 50 });
    expect(render).toHaveBeenCalledTimes(1);
    expect(clock.stop).not.toHaveBeenCalled();
    expect(timeline.getDiagnostics()).toMatchObject({ activeRunCount: 1, tickerRunning: true });

    render.mockClear();
    clock.tick(50);
    await expect(second).resolves.toMatchObject({ elapsedMs: 100 });
    expect(render).toHaveBeenCalledTimes(1);
    expect(clock.stop).toHaveBeenCalledTimes(1);
    expect(clock.subscribe).toHaveBeenCalledTimes(1);
    expect(log.indexOf('clock:stop')).toBeGreaterThan(log.indexOf('settled:second:completed'));
    expect(timeline.getDiagnostics()).toMatchObject({ activeRunCount: 0, tickerRunning: false });
  });

  test.each(['start', 'update-zero', 'update-one', 'complete'] as const)(
    '%s failure calls onError then onSettled once and rejects the originating error',
    async (failurePoint) => {
      const log: string[] = [];
      const error = new Error(`failure:${failurePoint}`);
      const clock = createManualClock(log);
      const timeline = TimelineModule.createPixiTimeline({
        clock,
        noAnimation: true,
        render: () => { log.push('render'); }
      });
      const playback = timeline.run({
        durationMs: 100,
        onStart: () => {
          log.push('start');
          if (failurePoint === 'start') throw error;
        },
        onUpdate: (progress) => {
          log.push(`update:${progress}`);
          if (failurePoint === 'update-zero' && progress === 0) throw error;
          if (failurePoint === 'update-one' && progress === 1) throw error;
        },
        onComplete: () => {
          log.push('complete');
          if (failurePoint === 'complete') throw error;
        },
        onError: (received) => {
          log.push(`error:${(received as Error).message}`);
          throw new Error('secondary-on-error-failure');
        },
        onSettled: (settlement) => {
          log.push(`settled:${settlement.status}`);
          throw new Error('secondary-on-settled-failure');
        }
      });

      await expect(playback).rejects.toBe(error);
      expect(log.slice(-2)).toEqual([`error:${error.message}`, 'settled:failed']);
      expect(log.filter((entry) => entry.startsWith('error:'))).toHaveLength(1);
      expect(log.filter((entry) => entry.startsWith('settled:'))).toHaveLength(1);
      expect(timeline.getDiagnostics()).toMatchObject({
        state: 'idle', activeRunCount: 0, tickerRunning: false, failedRunCount: 1
      });
    }
  );

  test('render and clock failures use the same error settlement path and clean subscriptions', async () => {
    const renderLog: string[] = [];
    const renderError = new Error('renderer-failed');
    const renderTimeline = TimelineModule.createPixiTimeline({
      clock: createManualClock(renderLog),
      render: () => { throw renderError; }
    });
    const renderPlayback = renderTimeline.run({
      durationMs: 100,
      onUpdate: () => { renderLog.push('update'); },
      onError: (error) => { renderLog.push(`error:${(error as Error).message}`); },
      onSettled: (settlement) => { renderLog.push(`settled:${settlement.status}`); }
    });

    await expect(renderPlayback).rejects.toBe(renderError);
    expect(renderLog).toEqual(['update', 'error:renderer-failed', 'settled:failed']);

    const clockLog: string[] = [];
    const clock = createManualClock(clockLog);
    const clockError = new Error('clock-start-failed');
    clock.start.mockImplementationOnce(() => {
      clockLog.push('clock:start-failed');
      throw clockError;
    });
    const clockTimeline = TimelineModule.createPixiTimeline({ clock, render: jest.fn() });
    const clockPlayback = clockTimeline.run({
      durationMs: 100,
      onUpdate: jest.fn(),
      onError: (error) => { clockLog.push(`error:${(error as Error).message}`); },
      onSettled: (settlement) => { clockLog.push(`settled:${settlement.status}`); }
    });

    await expect(clockPlayback).rejects.toBe(clockError);
    expect(clockLog).toEqual([
      'clock:subscribe',
      'clock:start-failed',
      'error:clock-start-failed',
      'settled:failed',
      'clock:stop',
      'clock:unsubscribe'
    ]);
    expect(clock.listenerCount).toBe(0);
    expect(clockTimeline.getDiagnostics()).toMatchObject({
      state: 'idle', activeRunCount: 0, tickerRunning: false, tickerSubscribed: false
    });

    const stopClock = createManualClock();
    const stopError = new Error('clock-stop-failed');
    stopClock.stop.mockImplementationOnce(() => { throw stopError; });
    const stopTimeline = TimelineModule.createPixiTimeline({ clock: stopClock, render: jest.fn() });
    const stopPlayback = stopTimeline.run({ durationMs: 10, onUpdate: jest.fn() });
    await Promise.resolve();
    stopClock.tick(10);

    await expect(stopPlayback).rejects.toBe(stopError);
    expect(stopClock.listenerCount).toBe(0);
    expect(stopTimeline.getDiagnostics()).toMatchObject({
      state: 'idle',
      activeRunCount: 0,
      tickerRunning: true,
      tickerSubscribed: false,
      completedRunCount: 1,
      failedRunCount: 1,
      lastError: stopError
    });

    expect(stopTimeline.abort(stopError)).toBe(0);
    expect(stopClock.stop).toHaveBeenCalledTimes(2);
    expect(stopClock.running).toBe(false);
    expect(stopTimeline.getDiagnostics()).toMatchObject({
      state: 'idle',
      activeRunCount: 0,
      tickerRunning: false,
      tickerSubscribed: false
    });
  });

  test('abort rejects every active run, settles each, then unsubscribes and stops', async () => {
    const log: string[] = [];
    const clock = createManualClock(log);
    const timeline = TimelineModule.createPixiTimeline({ clock, render: jest.fn() });
    const first = timeline.run({ durationMs: 100, ...callbacks(log, 'first') });
    const second = timeline.run({ durationMs: 200, ...callbacks(log, 'second') });
    const error = new Error('phase-aborted');

    await Promise.resolve();
    expect(timeline.abort(error)).toBe(2);

    await expect(first).rejects.toBe(error);
    await expect(second).rejects.toBe(error);
    expect(clock.stop).toHaveBeenCalledTimes(1);
    expect(clock.listenerCount).toBe(0);
    expect(log.indexOf('clock:stop')).toBeGreaterThan(log.indexOf('settled:second:aborted'));
    expect(timeline.getDiagnostics()).toMatchObject({
      state: 'idle', activeRunCount: 0, tickerRunning: false,
      tickerSubscribed: false, abortedRunCount: 2
    });
  });

  test('destroy aborts playback, removes the clock subscription, and remains idle', async () => {
    const clock = createManualClock();
    const timeline = TimelineModule.createPixiTimeline({ clock, render: jest.fn() });
    const playback = timeline.run({ durationMs: 100, onUpdate: jest.fn() });

    await Promise.resolve();
    timeline.destroy();
    timeline.destroy();

    await expect(playback).rejects.toMatchObject({ code: 'pixi_timeline_destroyed' });
    await expect(timeline.run({ durationMs: 0, onUpdate: jest.fn() }))
      .rejects.toMatchObject({ code: 'pixi_timeline_destroyed' });
    expect(clock.stop).toHaveBeenCalledTimes(1);
    expect(clock.listenerCount).toBe(0);
    expect(timeline.getDiagnostics()).toMatchObject({
      state: 'destroyed', activeRunCount: 0, tickerRunning: false, tickerSubscribed: false
    });
  });

  test('application ticker adapter delegates only through the private ticker port', () => {
    const unsubscribe = jest.fn();
    const application = {
      subscribeTicker: jest.fn(() => unsubscribe),
      startTicker: jest.fn(),
      stopTicker: jest.fn()
    };
    const clock = TimelineModule.createPixiApplicationTickerClock(application);
    const listener = jest.fn();

    expect(clock.subscribe(listener)).toBe(unsubscribe);
    clock.start();
    clock.stop();

    expect(application.subscribeTicker).toHaveBeenCalledWith(listener);
    expect(application.startTicker).toHaveBeenCalledTimes(1);
    expect(application.stopTicker).toHaveBeenCalledTimes(1);
  });
});
