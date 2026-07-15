import ApplicationModule = require('../ui/pixi/application');

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

function createRuntime(options: { rejectInit?: boolean } = {}) {
  const instances: any[] = [];
  class Application {
    canvas = { parentNode: null };
    stage = { kind: 'stage' };
    ticker = { start: jest.fn(), stop: jest.fn() };
    renderer = {
      resolution: 1,
      render: jest.fn(),
      resize: jest.fn()
    };
    init = jest.fn(async () => {
      if (options.rejectInit) throw new Error('webgl-init-failed');
    });
    destroy = jest.fn();
    constructor() { instances.push(this); }
  }
  return { runtime: { Application }, instances };
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
    expect(boardApp.getDiagnostics()).toMatchObject({
      state: 'ready', canvasCount: 1, contextCount: 1, tickerRunning: false, resolution: 2
    });
  });

  test('manually renders/resizes and starts the private ticker only on demand', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime, devicePixelRatio: 1.5 });
    await boardApp.mount(createHost());

    boardApp.resize(320, 240, 4);
    boardApp.render();
    boardApp.startTicker();
    boardApp.startTicker();
    expect(boardApp.getDiagnostics()).toMatchObject({
      tickerRunning: true, renderCount: 1, resizeCount: 1, resolution: 2
    });
    expect(fixture.instances[0].renderer.resize).toHaveBeenCalledWith(320, 240, 2);
    expect(fixture.instances[0].renderer.render).toHaveBeenCalledWith({ container: fixture.instances[0].stage });
    expect(fixture.instances[0].ticker.start).toHaveBeenCalledTimes(1);

    boardApp.stopTicker();
    boardApp.stopTicker();
    expect(fixture.instances[0].ticker.stop).toHaveBeenCalledTimes(2);
    expect(boardApp.getDiagnostics().tickerRunning).toBe(false);
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

  test('rejects a second host and invalid backing-store dimensions', async () => {
    const fixture = createRuntime();
    const boardApp = ApplicationModule.createPixiBoardApplication({ runtime: fixture.runtime });
    await boardApp.mount(createHost());
    await expect(boardApp.mount(createHost())).rejects.toThrow('second host');
    expect(() => boardApp.resize(0, 100)).toThrow('positive dimensions');
  });
});
