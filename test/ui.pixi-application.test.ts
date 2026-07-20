import ApplicationModule = require('../ui/pixi/application');
import TimelineModule = require('../ui/pixi/timeline');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function createTicker(initiallyStarted = true) {
  let started = initiallyStarted;
  let pendingElapsedMs = 0;
  const listeners = new Set<(ticker: any) => void>();
  return {
    autoStart: true,
    maxFPS: 0,
    get started() { return started; },
    get listenerCount() { return listeners.size; },
    add: jest.fn((listener: (ticker: any) => void, _context?: any, _priority?: number) => { listeners.add(listener); }),
    remove: jest.fn((listener: (ticker: any) => void, _context?: any) => { listeners.delete(listener); }),
    tick(deltaMS: number) {
      for (const listener of Array.from(listeners)) listener({ deltaMS, elapsedMS: deltaMS });
    },
    advance(deltaMS: number) {
      pendingElapsedMs += deltaMS;
      const maxFPS = Number(this.maxFPS);
      const minimumElapsedMs = maxFPS > 0 ? 1000 / maxFPS : 0;
      if (pendingElapsedMs + 1e-6 < minimumElapsedMs) return;
      const emittedElapsedMs = pendingElapsedMs;
      pendingElapsedMs = 0;
      for (const listener of Array.from(listeners)) {
        listener({ deltaMS: emittedElapsedMs, elapsedMS: emittedElapsedMs });
      }
    },
    start: jest.fn(() => { started = true; }),
    stop: jest.fn(() => { started = false; })
  };
}

function createHost() {
  const children: any[] = [];
  return {
    children,
    appendChild(value: any) {
      if (!children.includes(value)) children.push(value);
      value.parentNode = this;
      return value;
    },
    removeChild(value: any) {
      const index = children.indexOf(value);
      if (index >= 0) children.splice(index, 1);
      value.parentNode = null;
      return value;
    }
  } as any;
}

function createRuntime(options: { rejectInit?: boolean; initGate?: Promise<void> } = {}) {
  const instances: any[] = [];
  const sharedTicker = createTicker();
  const systemTicker = createTicker();
  class Rectangle {
    constructor(
      public x: number,
      public y: number,
      public width: number,
      public height: number
    ) {}
  }
  class Application {
    canvas = { parentNode: null, width: 640, height: 480 };
    stage = { kind: 'stage', renderGroup: { structureDidChange: false } };
    ticker = createTicker();
    render = jest.fn();
    contextCreated = false;
    renderer = {
      resolution: 1,
      screen: { width: 320, height: 240 },
      render: jest.fn(),
      resize: jest.fn(),
      resetState: jest.fn(),
      extract: {
        canvas: jest.fn(() => ({
          toDataURL: jest.fn(() => 'data:image/png;base64,AA==')
        }))
      }
    };
    init = jest.fn(async () => {
      if (options.initGate) await options.initGate;
      this.contextCreated = true;
      if (options.rejectInit) throw new Error('webgl-init-failed');
    });
    destroy = jest.fn();
    constructor() {
      // Pixi 8.18.1 TickerPlugin installs this listener even with autoStart:false.
      this.ticker.add(this.render as any, this, -25);
      instances.push(this);
    }
  }
  return {
    runtime: { Application, Rectangle, Ticker: { shared: sharedTicker, system: systemTicker } },
    instances,
    sharedTicker,
    systemTicker
  };
}

describe('Pixi board Application lifecycle', () => {
  test('initializes fixed WebGL options, mounts exactly one canvas, and stays idle', async () => {
    const fixture = createRuntime();
    const host = createHost();
    const boardApp = ApplicationModule.createPixiBoardApplication({
      runtime: fixture.runtime,
      devicePixelRatio: 3
    });

    const firstCanvas = await boardApp.mount(host);
    const secondCanvas = await boardApp.mount(host);
    await expect(boardApp.ready).resolves.toBeUndefined();

    expect(firstCanvas).toBe(secondCanvas);
    expect(host.children).toEqual([firstCanvas]);
    expect(fixture.instances).toHaveLength(1);
    expect(fixture.instances[0].init).toHaveBeenCalledWith({
      preference: 'webgl',
      autoStart: false,
      sharedTicker: false,
      autoDensity: true,
      resolution: 2,
      antialias: true,
      backgroundAlpha: 0
    });
    expect(fixture.instances[0].ticker.stop).toHaveBeenCalledTimes(1);
    expect(fixture.instances[0].ticker.maxFPS).toBe(ApplicationModule.PIXI_BOARD_MAX_FPS);
    expect(fixture.instances[0].ticker.remove)
      .toHaveBeenCalledWith(fixture.instances[0].render, fixture.instances[0]);
    expect(fixture.sharedTicker.stop).toHaveBeenCalledTimes(1);
    expect(fixture.systemTicker.stop).toHaveBeenCalledTimes(1);
    expect(fixture.sharedTicker.autoStart).toBe(false);
    expect(fixture.systemTicker.autoStart).toBe(false);
    expect(boardApp.getDiagnostics()).toMatchObject({
      state: 'ready', canvasCount: 1, contextCount: 1, tickerRunning: false,
      privateTickerRunning: false, sharedTickerRunning: false, systemTickerRunning: false,
      tickerMaxFps: 60, resolution: 2
    });
  });

  test('manually renders/resizes and starts the private ticker only on demand', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime, devicePixelRatio: 1.5 });
    await boardApp.mount(createHost());

    boardApp.resize(320, 240, 4);
    boardApp.resize(320, 240, 4);
    boardApp.render();
    boardApp.startTicker();
    boardApp.startTicker();
    expect(boardApp.getDiagnostics()).toMatchObject({
      tickerRunning: true, renderCount: 1, resizeCount: 1, resizeSkippedCount: 1, resolution: 2
    });
    expect(fixture.instances[0].renderer.resize).toHaveBeenCalledWith(320, 240, 2);
    expect(fixture.instances[0].renderer.render).toHaveBeenCalledWith({ container: fixture.instances[0].stage });
    expect(fixture.instances[0].ticker.start).toHaveBeenCalledTimes(1);
    expect(fixture.sharedTicker.start).not.toHaveBeenCalled();
    expect(fixture.systemTicker.start).not.toHaveBeenCalled();

    boardApp.stopTicker();
    boardApp.stopTicker();
    expect(fixture.instances[0].ticker.stop).toHaveBeenCalledTimes(2);
    expect(fixture.sharedTicker.stop).toHaveBeenCalledTimes(1);
    expect(fixture.systemTicker.stop).toHaveBeenCalledTimes(1);
    expect(boardApp.getDiagnostics().tickerRunning).toBe(false);
  });

  test('invalidates the resize cache explicitly after context replacement', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(createHost());

    boardApp.resize(320, 240, 1);
    boardApp.resize(320, 240, 1);
    boardApp.invalidateResizeCache();
    boardApp.resize(320, 240, 1);

    expect(fixture.instances[0].renderer.resize).toHaveBeenCalledTimes(2);
    expect(boardApp.getDiagnostics()).toMatchObject({ resizeCount: 2, resizeSkippedCount: 1 });
  });

  test.each([60, 144, 240])(
    'caps integrated timeline renders while preserving duration and settlement for a %iHz source',
    async (refreshRate) => {
      const fixture = createRuntime();
      const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
      await boardApp.mount(createHost());
      const updates: Array<{ progress: number; elapsedMs: number }> = [];
      const settlements: any[] = [];
      const timeline = TimelineModule.createPixiTimeline({
        clock: TimelineModule.createPixiApplicationTickerClock(boardApp),
        render: () => boardApp.render()
      });
      const playback = timeline.run({
        durationMs: 1000,
        onUpdate: (progress, frame) => { updates.push({ progress, elapsedMs: frame.elapsedMs }); },
        onSettled: (settlement) => { settlements.push(settlement); }
      });
      await Promise.resolve();

      const intervalMs = 1000 / refreshRate;
      // A few source ticks cover floating-point boundary drift at exactly 1s;
      // the timeline unsubscribes immediately after its terminal render.
      for (let index = 0; index < refreshRate + 5; index += 1) {
        fixture.instances[0].ticker.advance(intervalMs);
      }

      await expect(playback).resolves.toMatchObject({ durationMs: 1000, elapsedMs: 1000 });
      expect(boardApp.getDiagnostics().renderCount).toBeLessThanOrEqual(65);
      expect(boardApp.getDiagnostics().renderCount).toBeGreaterThanOrEqual(45);
      expect(updates.at(-1)).toEqual({ progress: 1, elapsedMs: 1000 });
      expect(settlements).toEqual([expect.objectContaining({
        status: 'completed', progress: 1, elapsedMs: 1000
      })]);
      expect(timeline.getDiagnostics()).toMatchObject({
        state: 'idle', activeRunCount: 0, tickerRunning: false, tickerSubscribed: false
      });
      expect(boardApp.getDiagnostics()).toMatchObject({ tickerRunning: false, privateTickerRunning: false });
    }
  );

  test('re-stops runtime tickers at the explicit idle settlement boundary', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(createHost());
    fixture.systemTicker.start();
    fixture.sharedTicker.start();
    fixture.instances[0].ticker.start();

    boardApp.settleIdle();

    expect(boardApp.getDiagnostics()).toMatchObject({
      tickerRunning: false,
      privateTickerRunning: false,
      sharedTickerRunning: false,
      systemTickerRunning: false
    });
  });

  test('extracts a complete debug frame through an offscreen render texture', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({
      runtime: fixture.runtime,
      devicePixelRatio: 2
    });
    await boardApp.mount(createHost());

    expect(boardApp.captureFramePngDataUrl()).toBe('data:image/png;base64,AA==');
    expect(fixture.instances[0].renderer.extract.canvas).toHaveBeenCalledWith({
      target: fixture.instances[0].stage,
      frame: expect.objectContaining({ x: 0, y: 0, width: 320, height: 240 }),
      resolution: 2,
      clearColor: [0, 0, 0, 0],
      antialias: true
    });
    expect(fixture.instances[0].renderer.resetState).toHaveBeenCalledTimes(2);
    expect(fixture.instances[0].stage.renderGroup.structureDidChange).toBe(true);
  });

  test('propagates a normal ticker-stop failure and does not report false idle', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(createHost());
    boardApp.startTicker();
    const stopError = new Error('private-ticker-stop-failed');
    fixture.instances[0].ticker.stop.mockImplementationOnce(() => {
      throw stopError;
    });

    expect(() => boardApp.stopTicker()).toThrow(stopError);
    expect(boardApp.getDiagnostics()).toMatchObject({
      tickerRunning: true,
      privateTickerRunning: true
    });
  });

  test('subscribes only to the private ticker and removes listeners idempotently', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(createHost());
    fixture.instances[0].ticker.add.mockClear();
    fixture.instances[0].ticker.remove.mockClear();
    const listener = jest.fn(() => boardApp.render());

    const unsubscribe = boardApp.subscribeTicker(listener);
    boardApp.startTicker();
    fixture.instances[0].ticker.tick(16.5);

    expect(listener).toHaveBeenCalledWith(16.5);
    expect(fixture.instances[0].renderer.render).toHaveBeenCalledTimes(1);
    expect(fixture.instances[0].render).not.toHaveBeenCalled();
    expect(fixture.instances[0].ticker.add).toHaveBeenCalledTimes(1);
    expect(fixture.sharedTicker.add).not.toHaveBeenCalled();
    expect(fixture.systemTicker.add).not.toHaveBeenCalled();
    expect(fixture.sharedTicker.start).not.toHaveBeenCalled();
    expect(fixture.systemTicker.start).not.toHaveBeenCalled();
    expect(boardApp.getDiagnostics()).toMatchObject({
      privateTickerRunning: true,
      tickerListenerCount: 1
    });

    unsubscribe();
    unsubscribe();
    fixture.instances[0].ticker.tick(16.5);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(fixture.instances[0].ticker.remove).toHaveBeenCalledTimes(1);
    expect(boardApp.getDiagnostics().tickerListenerCount).toBe(0);
  });

  test('destroy removes every private ticker subscription before stopping the ticker', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(createHost());
    fixture.instances[0].ticker.add.mockClear();
    fixture.instances[0].ticker.remove.mockClear();
    const first = jest.fn();
    const second = jest.fn();
    boardApp.subscribeTicker(first);
    boardApp.subscribeTicker(second);
    boardApp.startTicker();

    boardApp.destroy();
    fixture.instances[0].ticker.tick(10);

    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(fixture.instances[0].ticker.remove).toHaveBeenCalledTimes(2);
    expect(fixture.instances[0].ticker.remove.mock.invocationCallOrder[1])
      .toBeLessThan(fixture.instances[0].ticker.stop.mock.invocationCallOrder[1]);
    expect(fixture.sharedTicker.stop).toHaveBeenCalledTimes(1);
    expect(fixture.systemTicker.stop).toHaveBeenCalledTimes(1);
    expect(boardApp.getDiagnostics()).toMatchObject({
      state: 'destroyed',
      tickerRunning: false,
      tickerListenerCount: 0
    });
  });

  test('destroys canvas, ticker, context, and application idempotently', async () => {
    const fixture = createRuntime();
    const host = createHost();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(host);
    boardApp.startTicker();

    boardApp.destroy();
    boardApp.destroy();

    expect(host.children).toEqual([]);
    expect(fixture.instances[0].ticker.stop).toHaveBeenCalledTimes(2);
    expect(fixture.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(boardApp.getDiagnostics()).toMatchObject({
      state: 'destroyed', canvasCount: 0, contextCount: 0, tickerRunning: false
    });
    expect(() => boardApp.render()).toThrow('not ready');
  });

  test('cleans every partial resource when asynchronous init fails', async () => {
    const fixture = createRuntime({ rejectInit: true });
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });

    await expect(boardApp.mount(createHost())).rejects.toThrow('webgl-init-failed');
    await expect(boardApp.ready).rejects.toThrow('webgl-init-failed');
    expect(fixture.instances[0].ticker.stop).toHaveBeenCalledTimes(1);
    expect(fixture.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(boardApp.getCanvas()).toBeNull();
    expect(boardApp.getDiagnostics()).toMatchObject({
      state: 'failed', canvasCount: 0, contextCount: 0, tickerRunning: false
    });
  });

  test('destroys a context created after destroy wins an asynchronous initialization race', async () => {
    const gate = deferred<void>();
    const fixture = createRuntime({ initGate: gate.promise });
    const host = createHost();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    const mounting = boardApp.mount(host);
    await Promise.resolve();

    boardApp.destroy();
    expect(boardApp.getDiagnostics().state).toBe('destroyed');
    expect(fixture.instances[0].destroy).not.toHaveBeenCalled();

    gate.resolve();
    await expect(mounting).rejects.toThrow('destroyed before initialization');
    await expect(boardApp.ready).rejects.toThrow('destroyed before initialization');

    expect(fixture.instances[0].contextCreated).toBe(true);
    expect(fixture.instances[0].destroy).toHaveBeenCalledTimes(1);
    expect(host.children).toEqual([]);
    expect(boardApp.getApplication()).toBeNull();
    expect(boardApp.getCanvas()).toBeNull();
    expect(boardApp.getDiagnostics()).toMatchObject({
      state: 'destroyed', canvasCount: 0, contextCount: 0, tickerRunning: false
    });
  });

  test('rejects a second host and invalid backing-store dimensions', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(createHost());
    await expect(boardApp.mount(createHost())).rejects.toThrow('second host');
    expect(() => boardApp.resize(0, 100)).toThrow('positive dimensions');
  });
});
