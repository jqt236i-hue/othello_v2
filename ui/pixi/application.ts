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
  readonly renderCount: number;
  readonly resizeCount: number;
  readonly resolution: number;
}

export interface PixiBoardApplication {
  readonly ready: Promise<void>;
  initialize(): Promise<void>;
  mount(host: HTMLElement): Promise<HTMLCanvasElement>;
  getApplication(): any;
  getCanvas(): HTMLCanvasElement | null;
  getStage(): any;
  getRenderer(): any;
  getDiagnostics(): PixiBoardApplicationDiagnostics;
  render(): void;
  resize(width: number, height: number, resolution?: number): void;
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
  let resolveReady!: () => void;
  let rejectReady!: (error: unknown) => void;
  let readySettled = false;
  let tickerRunning = false;
  let renderCount = 0;
  let resizeCount = 0;
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

  function cleanupPartialApplication(): void {
    tickerRunning = false;
    try {
      if (application && application.ticker && typeof application.ticker.stop === 'function') {
        application.ticker.stop();
      }
    } catch (_error) { /* best effort during failed initialization */ }
    try { removeCanvas(canvas || resolveCanvas(application)); } catch (_error) { /* best effort */ }
    try { destroyApplication(application); } catch (_error) { /* primary init error wins */ }
    canvas = null;
    host = null;
    application = null;
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
    initialization = (async () => {
      try {
        application = new runtime.Application();
        if (!application || typeof application.init !== 'function') {
          throw new Error('Pixi Application.init is unavailable');
        }
        await application.init({
          ...PIXI_BOARD_APPLICATION_OPTIONS,
          resolution
        });
        canvas = resolveCanvas(application);
        if (!canvas) throw new Error('Pixi Application canvas is unavailable');
        if (application.ticker && typeof application.ticker.stop === 'function') {
          application.ticker.stop();
        }
        tickerRunning = false;
        state = 'ready';
        settleReadySuccess();
      } catch (error) {
        cleanupPartialApplication();
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

  function stopTicker(): void {
    if (!application || !application.ticker || typeof application.ticker.stop !== 'function') {
      tickerRunning = false;
      return;
    }
    if (tickerRunning) application.ticker.stop();
    tickerRunning = false;
  }

  function destroy(): void {
    if (state === 'destroyed') return;
    stopTicker();
    removeCanvas(canvas || resolveCanvas(application));
    destroyApplication(application);
    canvas = null;
    host = null;
    application = null;
    state = 'destroyed';
    if (!readySettled) settleReadyFailure(new Error('PixiBoardApplication destroyed before initialization'));
  }

  function getDiagnostics(): PixiBoardApplicationDiagnostics {
    return Object.freeze({
      state,
      canvasCount: canvas && canvas.parentNode ? 1 : 0,
      contextCount: application && state === 'ready' ? 1 : 0,
      tickerRunning,
      renderCount,
      resizeCount,
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
    render,
    resize,
    startTicker,
    stopTicker,
    destroy
  });
}
