import PixiRuntimeContract = require('./runtime-contract');

export interface PixiBoardApplicationOptions {
  readonly runtime?: any;
  readonly devicePixelRatio?: number;
}

export interface PixiBoardApplicationDiagnostics {
  readonly state: 'new' | 'initializing' | 'ready' | 'destroyed' | 'failed';
  readonly canvasCount: number;
  readonly contextCount: number;
  readonly tickerRunning: boolean;
  readonly privateTickerRunning: boolean;
  readonly sharedTickerRunning: boolean;
  readonly systemTickerRunning: boolean;
  readonly renderCount: number;
  readonly resizeCount: number;
  readonly tickerListenerCount: number;
  readonly resolution: number;
}

export type PixiBoardTickerListener = (deltaMs: number) => void;

export interface PixiBoardApplication {
  readonly ready: Promise<void>;
  initialize(): Promise<void>;
  mount(host: HTMLElement): Promise<HTMLCanvasElement>;
  getApplication(): any;
  getCanvas(): HTMLCanvasElement | null;
  getStage(): any;
  getRenderer(): any;
  getDiagnostics(): PixiBoardApplicationDiagnostics;
  /** Debug/test extraction renders into an offscreen texture; it never relies on the default WebGL buffer. */
  captureFramePngDataUrl(target?: any): string;
  render(): void;
  resize(width: number, height: number, resolution?: number): void;
  /** Subscribe to this Application's private ticker. The caller owns start/stop. */
  subscribeTicker(listener: PixiBoardTickerListener): () => void;
  startTicker(): void;
  stopTicker(): void;
  destroy(): void;
}

export const PIXI_BOARD_APPLICATION_OPTIONS = Object.freeze({
  preference: 'webgl' as const,
  autoStart: false,
  sharedTicker: false,
  autoDensity: true,
  antialias: true,
  backgroundAlpha: 0
});

function normalizeResolution(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 1;
  return Math.min(numeric, 2);
}

function resolveDevicePixelRatio(explicit?: number): number {
  if (typeof explicit !== 'undefined') return normalizeResolution(explicit);
  try {
    if (typeof window !== 'undefined') return normalizeResolution(window.devicePixelRatio || 1);
  } catch (_error) { /* boundary fallback */ }
  return 1;
}

function resolveCanvas(application: any): HTMLCanvasElement | null {
  const candidate = application && (application.canvas || application.view);
  return candidate && typeof candidate === 'object' ? candidate as HTMLCanvasElement : null;
}

function removeCanvas(canvas: HTMLCanvasElement | null): void {
  if (!canvas) return;
  const parent = canvas.parentNode;
  if (parent && typeof parent.removeChild === 'function') parent.removeChild(canvas);
}

function destroyApplication(application: any): void {
  if (!application || typeof application.destroy !== 'function') return;
  application.destroy(true, {
    children: true,
    texture: false,
    textureSource: false
  });
}

function detachAutomaticTickerRender(application: any): void {
  const ticker = application && application.ticker;
  const render = application && application.render;
  if (typeof render !== 'function') return;
  if (!ticker || typeof ticker.remove !== 'function') {
    throw new Error('Pixi private ticker render listener cannot be detached');
  }
  // Pixi's TickerPlugin registers Application.render even when autoStart is
  // false. Board playback renders explicitly after all parallel mutations, so
  // retaining that listener would render twice and could settle before the
  // final automatic render.
  ticker.remove(render, application);
}

export function createPixiBoardApplication(
  options: PixiBoardApplicationOptions = {}
): PixiBoardApplication {
  const runtime = options.runtime || PixiRuntimeContract.getPixiRuntime();
  const resolution = resolveDevicePixelRatio(options.devicePixelRatio);
  let currentResolution = resolution;
  let state: PixiBoardApplicationDiagnostics['state'] = 'new';
  let application: any = null;
  let canvas: HTMLCanvasElement | null = null;
  let host: HTMLElement | null = null;
  let initialization: Promise<void> | null = null;
  let lifecycleEpoch = 0;
  let destroyError: Error | null = null;
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;
  let readySettled = false;
  let tickerRunning = false;
  let renderCount = 0;
  let resizeCount = 0;
  const tickerSubscriptions = new Set<{
    readonly ticker: any;
    readonly adapter: (ticker: any) => void;
    active: boolean;
  }>();
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  // A rejected readiness promise is still surfaced by initialize()/mount().
  // Attach an observer so fallback selection does not create an unhandled
  // rejection before it awaits the public operation.
  ready.catch(() => undefined);

  function settleReadySuccess(): void {
    if (readySettled) return;
    readySettled = true;
    resolveReady();
  }

  function settleReadyFailure(error: unknown): void {
    if (readySettled) return;
    readySettled = true;
    rejectReady(error);
  }

  function getDestroyError(): Error {
    if (!destroyError) destroyError = new Error('PixiBoardApplication destroyed before initialization');
    return destroyError;
  }

  function initializationWasSuperseded(epoch: number): boolean {
    return state === 'destroyed' || epoch !== lifecycleEpoch;
  }

  function tickerStarted(ticker: any): boolean {
    return Boolean(ticker && ticker.started === true);
  }

  function stopPrivateTicker(candidate: any, force = false): void {
    const wasRunning = tickerRunning;
    tickerRunning = false;
    const ticker = candidate && candidate.ticker;
    if (!ticker || typeof ticker.stop !== 'function') return;
    if (!force && !wasRunning && !tickerStarted(ticker)) return;
    try {
      ticker.stop();
    } catch (_error) {
      // Best effort: the caller still owns the primary render/init failure.
    }
  }

  function removeTickerSubscription(subscription: {
    readonly ticker: any;
    readonly adapter: (ticker: any) => void;
    active: boolean;
  }): void {
    if (!subscription.active) return;
    subscription.active = false;
    tickerSubscriptions.delete(subscription);
    subscription.ticker.remove(subscription.adapter);
  }

  function clearTickerSubscriptions(): void {
    for (const subscription of Array.from(tickerSubscriptions)) {
      try {
        removeTickerSubscription(subscription);
      } catch (_error) {
        // Application teardown must continue even if a renderer-owned ticker
        // rejects listener removal.
      }
    }
    tickerSubscriptions.clear();
  }

  function cleanupApplicationInstance(candidate: any): void {
    const candidateCanvas = resolveCanvas(candidate);
    stopPrivateTicker(candidate, true);
    try { removeCanvas(candidateCanvas); } catch (_error) { /* best effort */ }
    try { destroyApplication(candidate); } catch (_error) { /* primary init error wins */ }
    if (application === candidate) application = null;
    if (canvas && canvas === candidateCanvas) canvas = null;
    host = null;
  }

  async function initialize(): Promise<void> {
    if (state === 'ready') return;
    if (state === 'destroyed') throw new Error('PixiBoardApplication is destroyed');
    if (state === 'failed') throw new Error('PixiBoardApplication initialization previously failed');
    if (initialization) return initialization;
    if (!runtime || typeof runtime.Application !== 'function') {
      const error = new Error('Pixi runtime Application is unavailable');
      state = 'failed';
      settleReadyFailure(error);
      throw error;
    }
    state = 'initializing';
    const epoch = ++lifecycleEpoch;
    initialization = (async () => {
      let candidate: any = null;
      try {
        candidate = new runtime.Application();
        application = candidate;
        if (!candidate || typeof candidate.init !== 'function') {
          throw new Error('Pixi Application.init is unavailable');
        }
        await candidate.init({
          ...PIXI_BOARD_APPLICATION_OPTIONS,
          resolution
        });
        if (initializationWasSuperseded(epoch)) {
          throw getDestroyError();
        }
        const candidateCanvas = resolveCanvas(candidate);
        if (!candidateCanvas) throw new Error('Pixi Application canvas is unavailable');
        canvas = candidateCanvas;
        detachAutomaticTickerRender(candidate);
        stopPrivateTicker(candidate, true);
        if (initializationWasSuperseded(epoch)) {
          throw getDestroyError();
        }
        state = 'ready';
        settleReadySuccess();
      } catch (error) {
        cleanupApplicationInstance(candidate);
        if (initializationWasSuperseded(epoch)) {
          const destroyed = getDestroyError();
          settleReadyFailure(destroyed);
          throw destroyed;
        }
        state = 'failed';
        settleReadyFailure(error);
        throw error;
      }
    })();
    return initialization;
  }

  async function mount(nextHost: HTMLElement): Promise<HTMLCanvasElement> {
    if (!nextHost || typeof nextHost.appendChild !== 'function') {
      throw new Error('PixiBoardApplication mount host is unavailable');
    }
    await initialize();
    if (state === 'destroyed') throw getDestroyError();
    if (!canvas) throw new Error('PixiBoardApplication canvas is unavailable');
    if (host && host !== nextHost) throw new Error('PixiBoardApplication cannot mount a second host');
    if (canvas.parentNode && canvas.parentNode !== nextHost) {
      throw new Error('PixiBoardApplication canvas already belongs to another host');
    }
    host = nextHost;
    if (canvas.parentNode !== nextHost) nextHost.appendChild(canvas);
    return canvas;
  }

  function assertReady(): void {
    if (state !== 'ready' || !application) throw new Error('PixiBoardApplication is not ready');
  }

  function render(): void {
    assertReady();
    const renderer = application.renderer;
    if (!renderer || typeof renderer.render !== 'function') {
      throw new Error('Pixi renderer.render is unavailable');
    }
    renderer.render({ container: application.stage });
    renderCount += 1;
  }

  function captureFramePngDataUrl(target?: any): string {
    assertReady();
    const renderer = application.renderer;
    const extract = renderer && renderer.extract;
    const Rectangle = runtime && runtime.Rectangle;
    const screen = renderer && renderer.screen;
    const width = Number(screen && screen.width)
      || Number(canvas && canvas.width) / currentResolution;
    const height = Number(screen && screen.height)
      || Number(canvas && canvas.height) / currentResolution;
    if (!extract || typeof extract.canvas !== 'function') {
      throw new Error('Pixi renderer.extract.canvas is unavailable');
    }
    if (typeof Rectangle !== 'function' || !(width > 0) || !(height > 0)) {
      throw new Error('Pixi frame extraction geometry is unavailable');
    }
    const extractionTarget = target || application.stage;
    const renderGroup = extractionTarget && extractionTarget.renderGroup;
    if (renderGroup) renderGroup.structureDidChange = true;
    if (typeof renderer.resetState === 'function') renderer.resetState();
    let extracted: any;
    try {
      extracted = extract.canvas({
        target: extractionTarget,
        frame: new Rectangle(0, 0, width, height),
        resolution: currentResolution,
        clearColor: [0, 0, 0, 0],
        antialias: true
      });
    } finally {
      if (typeof renderer.resetState === 'function') renderer.resetState();
    }
    if (!extracted || typeof extracted.toDataURL !== 'function') {
      throw new Error('Pixi frame extraction did not return a canvas');
    }
    const value = String(extracted.toDataURL('image/png'));
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=\r\n]+$/.test(value)) {
      throw new Error('Pixi frame extraction returned an invalid PNG data URL');
    }
    return value;
  }

  function resize(width: number, height: number, nextResolution?: number): void {
    assertReady();
    const pixelWidth = Number(width);
    const pixelHeight = Number(height);
    if (!Number.isFinite(pixelWidth) || pixelWidth <= 0 || !Number.isFinite(pixelHeight) || pixelHeight <= 0) {
      throw new Error('PixiBoardApplication resize requires positive dimensions');
    }
    const renderer = application.renderer;
    if (!renderer || typeof renderer.resize !== 'function') {
      throw new Error('Pixi renderer.resize is unavailable');
    }
    const cappedResolution = typeof nextResolution === 'undefined'
      ? resolution
      : normalizeResolution(nextResolution);
    if ('resolution' in renderer) renderer.resolution = cappedResolution;
    renderer.resize(pixelWidth, pixelHeight, cappedResolution);
    currentResolution = cappedResolution;
    resizeCount += 1;
  }

  function startTicker(): void {
    assertReady();
    const ticker = application.ticker;
    if (!ticker || typeof ticker.start !== 'function') throw new Error('Pixi private ticker is unavailable');
    if (tickerRunning) return;
    ticker.start();
    tickerRunning = true;
  }

  function subscribeTicker(listener: PixiBoardTickerListener): () => void {
    assertReady();
    if (typeof listener !== 'function') throw new Error('Pixi ticker listener is unavailable');
    const ticker = application.ticker;
    if (!ticker || typeof ticker.add !== 'function' || typeof ticker.remove !== 'function') {
      throw new Error('Pixi private ticker subscription is unavailable');
    }
    const adapter = (tick: any): void => {
      const rawDelta = Number(tick && (tick.deltaMS ?? tick.elapsedMS));
      listener(Number.isFinite(rawDelta) && rawDelta > 0 ? rawDelta : 0);
    };
    const subscription = { ticker, adapter, active: true };
    tickerSubscriptions.add(subscription);
    try {
      ticker.add(adapter);
    } catch (error) {
      subscription.active = false;
      tickerSubscriptions.delete(subscription);
      throw error;
    }
    return () => removeTickerSubscription(subscription);
  }

  function stopTicker(): void {
    assertReady();
    const ticker = application.ticker;
    if (!ticker || typeof ticker.stop !== 'function') throw new Error('Pixi private ticker is unavailable');
    if (!tickerRunning && !tickerStarted(ticker)) return;
    // Normal playback settlement is a correctness boundary. Unlike terminal
    // teardown, a failed stop must reject the timeline so an actually-running
    // ticker cannot be reported as an idle success.
    ticker.stop();
    if (tickerStarted(ticker)) throw new Error('Pixi private ticker remained active after stop');
    tickerRunning = false;
  }

  function destroy(): void {
    if (state === 'destroyed') return;
    const wasInitializing = state === 'initializing';
    const candidate = application;
    state = 'destroyed';
    lifecycleEpoch += 1;
    clearTickerSubscriptions();
    stopPrivateTicker(candidate, true);
    removeCanvas(canvas || resolveCanvas(candidate));
    if (!wasInitializing) destroyApplication(candidate);
    canvas = null;
    host = null;
    application = null;
    if (!readySettled) settleReadyFailure(getDestroyError());
  }

  function getDiagnostics(): PixiBoardApplicationDiagnostics {
    const privateTickerRunning = tickerStarted(application && application.ticker);
    const sharedTickerRunning = tickerStarted(runtime?.Ticker?.shared);
    const systemTickerRunning = tickerStarted(runtime?.Ticker?.system);
    return Object.freeze({
      state,
      canvasCount: canvas && canvas.parentNode ? 1 : 0,
      contextCount: application && state === 'ready' ? 1 : 0,
      tickerRunning: tickerRunning || privateTickerRunning,
      privateTickerRunning,
      sharedTickerRunning,
      systemTickerRunning,
      renderCount,
      resizeCount,
      tickerListenerCount: tickerSubscriptions.size,
      resolution: currentResolution
    });
  }

  return Object.freeze({
    ready,
    initialize,
    mount,
    getApplication: () => application,
    getCanvas: () => canvas,
    getStage: () => application && application.stage || null,
    getRenderer: () => application && application.renderer || null,
    getDiagnostics,
    captureFramePngDataUrl,
    render,
    resize,
    subscribeTicker,
    startTicker,
    stopTicker,
    destroy
  });
}
