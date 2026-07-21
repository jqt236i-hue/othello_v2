import { JSDOM } from 'jsdom';
import { createBoardViewportLayout } from '../ui/board-visual/layout';
import { PresentationPlaybackError } from '../ui/board-visual/playback-types';
import type { BoardVisualFrame } from '../ui/board-visual/types';
import Backend = require('../ui/pixi/board-backend');
import Camera = require('../ui/pixi/camera');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function nextTurn(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function flushMicrotasks(iterations = 8): Promise<void> {
  for (let index = 0; index < iterations; index += 1) await Promise.resolve();
}

function makeFrame(
  token: string,
  revision: number,
  options: {
    boardUrl?: string;
    special?: boolean;
    rows?: number;
    cols?: number;
    renderSessionId?: string;
    viewportWidth?: number;
    viewportHeight?: number;
    existingKeys?: string[];
  } = {}
): BoardVisualFrame {
  const rows = options.rows || 16;
  const cols = options.cols || 16;
  const existingKeys = options.existingKeys || ['0,0'];
  const topology = {
    baseRows: 8,
    baseCols: 8,
    minRow: 0,
    maxRow: rows - 1,
    minCol: 0,
    maxCol: cols - 1,
    renderRowOffset: 0,
    renderColOffset: 0,
    renderRows: rows,
    renderCols: cols,
    existingKeys,
    playableKeys: existingKeys,
    holeKeys: []
  };
  const layout = createBoardViewportLayout(topology, {
    revision,
    cellSize: 40,
    dpr: 2,
    orientation: 'normal',
    frameInset: { top: 0, right: 0, bottom: 0, left: 0 },
    clientOrigin: { x: 10, y: 20 },
    visualViewport: { scale: 1, offsetLeft: 0, offsetTop: 0 },
    camera: {
      scrollLeft: 0,
      scrollTop: 0,
      viewportWidth: options.viewportWidth || 160,
      viewportHeight: options.viewportHeight || 120
    }
  });
  return Object.freeze({
    frameToken: token,
    renderSessionId: options.renderSessionId || 'render-session:default',
    model: Object.freeze({
      visualRevision: revision,
      topology,
      cells: Object.freeze(existingKeys.map((key) => {
        const [row, col] = key.split(',').map(Number);
        return {
          key,
          row,
          col,
          renderRow: row,
          renderCol: col,
          kind: 'playable' as const,
          expansionSide: null,
          boundaryEdges: { top: 'outer' as const, right: 'none' as const, bottom: 'none' as const, left: 'outer' as const },
          stone: {
            owner: 'black' as const,
            value: 1,
            specialType: options.special ? 'TIME_BOMB' : null,
            status: {}
          },
          markers: [],
          interaction: {
            legal: false,
            legalFree: false,
            tabooLegal: false,
            selectable: false,
            interactionLocked: false,
            hovered: false,
            keyboardCursor: false,
            previewKinds: [],
            selected: false,
            selectionKinds: [],
            directionHints: [],
            directionHintIds: [],
            localPendingHintIds: []
          },
          visualSignature: `cell:${revision}:${key}`
        };
      })),
      keyboardCursorKey: null,
      viewerContext: 'black' as const,
      currentPlayer: 'black' as const,
      canControlCurrentTurn: true,
      isHumanTurn: true
    }),
    layout,
    appearance: Object.freeze({
      boardSkinId: `board-${revision}`,
      boardImageUrl: options.boardUrl || `https://example.test/board-${revision}.png`,
      boardFrameSkinId: 'frame-default',
      boardFrameLayout: {},
      stoneSkinId: `stone-${revision}`,
      blackStoneImageUrl: 'https://example.test/black.png',
      whiteStoneImageUrl: 'https://example.test/white.png',
      revision
    }),
    theme: Object.freeze({
      revision,
      fontReadyEpoch: 1,
      surfaceColor: '#075b45',
      gridColor: '#111111',
      outerBoundaryColor: '#eeeeee',
      holeBoundaryColor: '#888888',
      markerColor: '#ffffff',
      hintColor: '#ffff00',
      timerColor: '#ffffff',
      fontFamily: 'sans-serif',
      gridLineWidth: 1,
      boardBonus: {
        fontFamily: 'sans-serif', fontWeight: 700, fontSizeRatio: 0.5, doubleDigitScale: 0.8,
        lineHeight: 1, color: '#fff', shadows: [], glow: null
      },
      timer: {
        fontFamily: 'sans-serif', fontWeight: 700, fontSizeRatio: 0.5, doubleDigitScale: 0.8,
        lineHeight: 1, color: '#fff', shadows: [], glow: null
      },
      directionHint: {
        fontFamily: 'sans-serif', fontWeight: 700, fontSizeRatio: 0.5, doubleDigitScale: 0.8,
        lineHeight: 1, color: '#fff', shadows: [], glow: null
      },
      legalHint: {
        ringColor: '#fff', highlightColor: '#ff0', glowColor: '#ff0', lineWidthRatio: 0.05, glowBlurRatio: 0.1
      }
    })
  });
}

function createApplicationRuntime(document: Document, options: {
  initError?: Error;
  rendererMissing?: boolean;
  rendererType?: string | number;
  rendererText?: string;
  vendorText?: string;
} = {}) {
  const instances: any[] = [];
  class Application {
    canvas = document.createElement('canvas');
    stage = { kind: 'stage' };
    ticker: any;
    renderer: any;
    init = jest.fn(async () => {
      if (options.initError) throw options.initError;
    });
    destroy = jest.fn();

    constructor() {
      this.ticker = {
        started: false,
        start: jest.fn(() => { this.ticker.started = true; }),
        stop: jest.fn(() => { this.ticker.started = false; })
      };
      const debugRendererInfo = options.rendererText != null || options.vendorText != null
        ? { UNMASKED_RENDERER_WEBGL: 37446, UNMASKED_VENDOR_WEBGL: 37445 }
        : null;
      const gl = {
        MAX_TEXTURE_SIZE: 3379,
        RENDERER: 7937,
        VENDOR: 7936,
        getExtension: jest.fn(() => debugRendererInfo),
        getParameter: jest.fn((parameter: number) => {
          if (parameter === 37446) return options.rendererText || '';
          if (parameter === 37445) return options.vendorText || '';
          if (parameter === 7937) return options.rendererText || '';
          if (parameter === 7936) return options.vendorText || '';
          return 2048;
        })
      };
      this.renderer = options.rendererMissing ? null : {
        type: typeof options.rendererType === 'undefined' ? 'webgl' : options.rendererType,
        gl,
        resolution: 1,
        resize: jest.fn((width: number, height: number, resolution = 1) => {
          this.canvas.width = Math.ceil(width * resolution);
          this.canvas.height = Math.ceil(height * resolution);
        }),
        render: jest.fn()
      };
      instances.push(this);
    }
  }
  return {
    runtime: {
      VERSION: '8.18.1',
      Application,
      RendererType: { WEBGL: 1, WEBGPU: 2, CANVAS: 4 }
    },
    instances
  };
}

function createTextureRuntime() {
  const deferredByUrl = new Map<string, ReturnType<typeof deferred<void>>>();
  const destroyed: string[] = [];
  let failAll = false;
  const loadTexture = jest.fn(async (url: string) => {
    if (failAll) throw new Error(`texture-failed:${url}`);
    const waiting = deferredByUrl.get(url);
    if (waiting) await waiting.promise;
    return {
      texture: { url },
      width: 64,
      height: 64,
      destroy: () => destroyed.push(url)
    };
  });
  const runtime = {
    loadTexture,
    createTextureFromBitmap: jest.fn(async (bitmap: any) => ({ texture: { bitmap }, width: bitmap.width, height: bitmap.height })),
    createProceduralTexture: jest.fn(async (purpose: string) => {
      if (failAll) throw new Error(`procedural-failed:${purpose}`);
      return { texture: { procedural: purpose }, width: 1, height: 1 };
    }),
    createImageBitmap: jest.fn(),
    destroyTexture: jest.fn(),
    getMaxTextureSize: () => 8192
  };
  return {
    runtime,
    loadTexture,
    destroyed,
    deferUrl(url: string) {
      const waiting = deferred<void>();
      deferredByUrl.set(url, waiting);
      return waiting;
    },
    setFailAll(value: boolean) { failAll = value; }
  };
}

function createSceneFixture() {
  const applyCalls: Array<{ frame: BoardVisualFrame; context: any }> = [];
  const failTokens = new Set<string>();
  let destroyed = false;
  let resetCount = 0;
  const interactionLayer = { kind: 'interaction-layer' };
  const scene = {
    root: {},
    layers: { interaction: interactionLayer },
    applyFrame: jest.fn((frame: BoardVisualFrame, context: any) => {
      if (failTokens.has(frame.frameToken)) throw new Error(`scene-failed:${frame.frameToken}`);
      applyCalls.push({ frame, context });
      return { materializedCount: 1, createdViews: 1, reusedViews: 0, updatedViews: 1, skippedViews: 0, releasedViews: 0, materializationWindow: null };
    }),
    invalidateStaticViews: jest.fn(),
    getRenderedCell: jest.fn((row: number, col: number) => row === 0 && col === 0 ? { key: '0,0' } : null),
    getDiagnostics: jest.fn(() => ({
      destroyed,
      applyCount: applyCalls.length,
      resetCount,
      activeViewCount: destroyed ? 0 : 1,
      pooledViewCount: 0,
      createdViewCount: 1,
      destroyedViewCount: destroyed ? 1 : 0,
      cumulativeUpdatedViewCount: applyCalls.length,
      cumulativeSkippedViewCount: 0,
      cumulativeReleasedViewCount: 0,
      displayObjectCount: destroyed ? 0 : 9,
      textureBackedStoneCount: 1,
      proceduralStoneCount: 0,
      ephemeralVoidCount: 0,
      holeCount: 0,
      starPointCount: 0,
      objectOverscanCells: 1,
      effectGutterCells: 2,
      canvasCount: 0,
      domNodeCount: 0,
      layerOrder: ['surface', 'cell', 'marker', 'stone', 'hint', 'playback', 'effect', 'interaction'],
      retainedKeys: destroyed ? [] : ['0,0'],
      materializationWindow: null,
      playbackScopeKey: null,
      retainedStoneOverrideCount: 0,
      hiddenStoneCount: 0,
      activePlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 2,
      createdPlaybackGhostCount: 2,
      destroyedPlaybackGhostCount: destroyed ? 2 : 0,
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    })),
    reset: jest.fn(() => { resetCount += 1; }),
    destroy: jest.fn(() => { destroyed = true; })
  };
  return { scene: scene as any, applyCalls, failTokens };
}

function createPlaybackFixture() {
  const timeline = Object.freeze({
    state: 'idle' as const,
    activeRunCount: 0,
    tickerRunning: false,
    tickerSubscribed: false,
    startedRunCount: 0,
    completedRunCount: 0,
    failedRunCount: 0,
    abortedRunCount: 0,
    tickerStartCount: 0,
    tickerStopCount: 0,
    lastError: null
  });
  const playback = {
    kind: 'pixi-board-playback' as const,
    validatePhase: jest.fn((_events: readonly unknown[], _context: unknown) => undefined),
    playPhase: jest.fn(async (_events: readonly unknown[], _context: unknown) => undefined),
    revealTopologyCells: jest.fn(async (_keys: readonly string[]) => undefined),
    onFrameApplied: jest.fn(),
    abort: jest.fn(() => 0),
    getDiagnostics: jest.fn(() => Object.freeze({
      destroyed: false,
      activeScopeKey: null,
      projectedStoneCount: 0,
      retainedFinalGhostCount: 0,
      inFlightEffectCount: 0,
      inFlightTopologyRevealCount: 0,
      phaseCount: 0,
      completedPhaseCount: 0,
      failedPhaseCount: 0,
      timeline
    })),
    destroy: jest.fn()
  };
  return { playback, timeline };
}

function resolvedAppearance(frame: BoardVisualFrame, useDefaults = false, customBoardBlob: Blob | null = null) {
  const prefix = useDefaults ? 'default-' : '';
  const descriptor = frame.appearance;
  return Object.freeze({
    descriptor,
    resources: Object.freeze([
      Object.freeze({
        role: 'board' as const,
        url: useDefaults ? 'https://example.test/default-board.png' : descriptor.boardImageUrl,
        customSkinId: !useDefaults && customBoardBlob ? 'custom:test-board' : null,
        sourceBlob: useDefaults ? null : customBoardBlob,
        contentFingerprint: `${prefix}board`
      }),
      Object.freeze({
        role: 'black-stone' as const,
        url: useDefaults ? 'https://example.test/default-black.png' : descriptor.blackStoneImageUrl,
        customSkinId: null,
        sourceBlob: null,
        contentFingerprint: `${prefix}black`
      }),
      Object.freeze({
        role: 'white-stone' as const,
        url: useDefaults ? 'https://example.test/default-white.png' : descriptor.whiteStoneImageUrl,
        customSkinId: null,
        sourceBlob: null,
        contentFingerprint: `${prefix}white`
      })
    ]),
    contentFingerprint: `${prefix}${descriptor.revision}`
  });
}

function createHarness(options: {
  noAnimation?: boolean;
  initError?: Error;
  rendererMissing?: boolean;
  rendererType?: string | number;
  rendererText?: string;
  vendorText?: string;
  allowSoftwareRenderer?: boolean;
  webglAvailable?: boolean;
  sceneFactoryThrows?: boolean;
  cameraFactory?: any;
  inputFactory?: any;
  playbackFactory?: any;
  getInputController?: () => any;
  customBoardBlob?: Blob | null;
  reducedMotion?: boolean;
  onTopologyRevealStart?: (keys: readonly string[], frame: any) => void;
  contextRecovery?: any;
} = {}) {
  const dom = new JSDOM('<!doctype html><div id="board"><div class="cell">legacy</div></div>', {
    url: 'https://example.test/game/index.html'
  });
  const document = dom.window.document;
  const matchMedia = jest.fn((query: string) => ({
    media: query,
    matches: options.reducedMotion === true
  }));
  (dom.window as any).matchMedia = matchMedia;
  const host = document.getElementById('board') as HTMLElement;
  const app = createApplicationRuntime(document, options);
  const textures = createTextureRuntime();
  const scene = createSceneFixture();
  const leases: Array<{ release: jest.Mock<boolean, []>; label: string }> = [];
  let resizeCallback: (() => void) | null = null;
  let observerDisconnected = false;
  const viewportListeners = new Map<string, Set<EventListener>>();
  const visualViewport = {
    scale: 1,
    offsetLeft: 0,
    offsetTop: 0,
    addEventListener(type: string, listener: EventListener) {
      const listeners = viewportListeners.get(type) || new Set<EventListener>();
      listeners.add(listener);
      viewportListeners.set(type, listeners);
    },
    removeEventListener(type: string, listener: EventListener) {
      viewportListeners.get(type)?.delete(listener);
    }
  };
  const sceneFactory = options.sceneFactoryThrows
    ? jest.fn(() => { throw new Error('scene-init-failed'); })
    : jest.fn(() => scene.scene);
  const backend = Backend.createPixiBoardVisualBackend({
    runtime: app.runtime,
    root: dom.window as any,
    document,
    devicePixelRatio: 2,
    noAnimation: options.noAnimation !== false,
    allowSoftwareRenderer: options.allowSoftwareRenderer,
    webglPreflight: () => options.webglAvailable !== false,
    textureRuntime: textures.runtime as any,
    measureViewport: () => ({ width: 160, height: 120 }),
    visualViewport: visualViewport as any,
    createResizeObserver: (callback: any) => {
      resizeCallback = callback;
      return { observe() {}, disconnect() { observerDisconnected = true; } };
    },
    sceneFactory,
    cameraFactory: options.cameraFactory,
    inputFactory: options.inputFactory,
    playbackFactory: options.playbackFactory,
    getInputController: options.getInputController,
    onTopologyRevealStart: options.onTopologyRevealStart,
    contextRecovery: options.contextRecovery,
    resolveAppearance: (frame) => resolvedAppearance(frame, false, options.customBoardBlob || null),
    resolveDefaultAppearance: (frame) => resolvedAppearance(frame, true),
    acquireAppearanceLease: (appearance) => {
      const label = appearance.descriptor.boardImageUrl;
      const lease = { label, release: jest.fn(() => true) };
      leases.push(lease);
      return Object.freeze({ urls: [], release: lease.release });
    },
    resolveSpecialAppearance: (type, owner) => Object.freeze({
      role: 'special-stone' as const,
      url: `https://example.test/special/${type}/${owner}.png`,
      customSkinId: null,
      sourceBlob: null,
      contentFingerprint: `${type}:${owner}`
    })
  });
  return {
    dom,
    document,
    host,
    app,
    textures,
    scene,
    sceneFactory,
    leases,
    backend,
    matchMedia,
    fireResize() { resizeCallback?.(); },
    observerDisconnected: () => observerDisconnected,
    viewportListeners
  };
}

describe('Pixi board backend integration', () => {
  test('mounts and destroys the normalized board input adapter with the camera viewport', async () => {
    const input = {
      mount: jest.fn(),
      syncViewportMetrics: jest.fn(),
      destroy: jest.fn(),
      getDiagnostics: jest.fn(() => ({ mounted: true }))
    };
    const inputFactory = jest.fn(() => input);
    const controller = { hitTestClientPoint: jest.fn(), handlePointer: jest.fn() };
    const getInputController = jest.fn(() => controller);
    const playbackFixture = createPlaybackFixture();
    const harness = createHarness({
      inputFactory,
      getInputController,
      playbackFactory: () => playbackFixture.playback
    });

    await harness.backend.mount(harness.host, {});

    expect(inputFactory).toHaveBeenCalledWith({ getController: getInputController });
    expect(input.mount).toHaveBeenCalledWith({
      viewport: harness.host.querySelector('#board-scroll-viewport'),
      renderer: harness.app.instances[0].renderer,
      interactionLayer: harness.scene.scene.layers.interaction
    });
    expect(getInputController).not.toHaveBeenCalled();

    const frame = makeFrame('input-metrics', 1, { viewportWidth: 160, viewportHeight: 120 });
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);
    expect(input.syncViewportMetrics).toHaveBeenLastCalledWith({
      width: 160,
      height: 120,
      resolution: 2
    });

    harness.backend.destroy();
    expect(playbackFixture.playback.destroy).toHaveBeenCalledTimes(1);
    expect(input.destroy).toHaveBeenCalledTimes(1);
    expect(playbackFixture.playback.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      harness.scene.scene.destroy.mock.invocationCallOrder[0]
    );
    expect(playbackFixture.playback.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      harness.app.instances[0].destroy.mock.invocationCallOrder[0]
    );
    expect(input.destroy.mock.invocationCallOrder[0]).toBeLessThan(
      harness.scene.scene.destroy.mock.invocationCallOrder[0]
    );
  });

  test('mounts one WebGL canvas, prepares the initial frame, and commits a cell-less static scene', async () => {
    const harness = createHarness();
    const frame = makeFrame('initial', 1, { special: true });

    await harness.backend.mount(harness.host, { diagnostics: { record: jest.fn() } });
    await harness.backend.prepareFrame(frame);
    expect(harness.scene.applyCalls).toHaveLength(0);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);

    expect(harness.host.querySelectorAll('canvas')).toHaveLength(1);
    expect(harness.host.querySelectorAll('.cell')).toHaveLength(0);
    expect(harness.host.querySelectorAll('#board-scroll-viewport')).toHaveLength(1);
    expect(harness.host.querySelectorAll('#board-scroll-surface')).toHaveLength(1);
    expect(harness.app.instances).toHaveLength(1);
    expect(harness.app.instances[0].renderer.gl.getParameter).toHaveBeenCalledWith(3379);
    expect(harness.scene.applyCalls).toHaveLength(1);
    const textureSource = harness.scene.applyCalls[0].context.textures;
    expect(textureSource.get('board')).toMatchObject({ url: frame.appearance.boardImageUrl });
    expect(textureSource.get('special-stone:TIME_BOMB:black')).toMatchObject({
      url: 'https://example.test/special/TIME_BOMB/black.png'
    });
    expect(harness.backend.getRenderedCell(0, 0)).toEqual({ key: '0,0' });
    expect(harness.backend.getDiagnostics()).toMatchObject({
      state: 'ready', mounted: true, canvasCount: 1, contextCount: 1,
      domCellCount: 0, maxTextureSize: 2048, tickerRunning: false,
      committedApplyCount: 1, settledFrameToken: 'initial',
      playback: { destroyed: false },
      timeline: { state: 'idle', activeRunCount: 0 },
      pool: {
        activeViewCount: 1,
        pooledPlaybackGhostCount: 2,
        pooledPlaybackHighlightCount: 1
      }
    });
  });

  test('injects animation policies and settles playback projection only after a successful canonical render', async () => {
    const fixture = createPlaybackFixture();
    const playbackFactory = jest.fn(() => fixture.playback);
    const harness = createHarness({
      noAnimation: false,
      reducedMotion: true,
      playbackFactory
    });

    await harness.backend.mount(harness.host, {});
    const playbackOptions = playbackFactory.mock.calls[0][0];
    expect(playbackOptions).toMatchObject({
      scene: harness.scene.scene,
      noAnimation: false,
      record: expect.any(Function)
    });
    expect(playbackOptions.getFrame()).toBeNull();
    expect(playbackOptions.reducedMotion()).toBe(true);
    expect(harness.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

    const frame = makeFrame('playback-final', 21);
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);
    expect(fixture.playback.onFrameApplied).toHaveBeenCalledTimes(1);
    expect(playbackOptions.getFrame()).toMatchObject({ frameToken: 'playback-final' });
    expect(harness.scene.applyCalls.at(-1)!.context).not.toHaveProperty('preservePlaybackProjection');
    const trajectoryTextureLease = playbackOptions.acquireStoneTextureLease('black');
    expect(trajectoryTextureLease.texture).toBeTruthy();
    expect(trajectoryTextureLease.released).toBe(false);
    expect(harness.backend.getTextureLeaseCounts().external).toBe(1);
    expect(trajectoryTextureLease.release()).toBe(true);
    expect(trajectoryTextureLease.released).toBe(true);
    expect(harness.backend.getTextureLeaseCounts().external).toBe(0);

    playbackOptions.application.startTicker();
    const ticker = harness.app.instances[0].ticker;
    const stopCountBeforeReflow = ticker.stop.mock.calls.length;
    harness.fireResize();
    expect(harness.scene.applyCalls.at(-1)!.context).toMatchObject({
      preservePlaybackProjection: true
    });
    expect(fixture.playback.onFrameApplied).toHaveBeenCalledTimes(1);
    expect(ticker.stop).toHaveBeenCalledTimes(stopCountBeforeReflow);
    expect(harness.backend.getDiagnostics().tickerRunning).toBe(true);
    playbackOptions.application.stopTicker();

    const failedFrame = makeFrame('playback-render-failed', 22);
    await harness.backend.prepareFrame(failedFrame);
    const renderError = new Error('final-render-failed');
    harness.app.instances[0].renderer.render.mockImplementationOnce(() => {
      throw renderError;
    });
    expect(() => harness.backend.applyFrame(failedFrame)).toThrow(
      expect.objectContaining({ code: 'pixi_render_failed', detail: renderError })
    );
    await expect(harness.backend.waitForVisualSettlement(failedFrame)).rejects.toMatchObject({
      code: 'pixi_render_failed', detail: renderError
    });
    expect(fixture.playback.onFrameApplied).toHaveBeenCalledTimes(1);
  });

  test('keeps prepared work identity while applying a layout-only presented frame', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('live-layout', 2);
    const presentedFrame = Object.freeze({
      ...frame,
      layout: Object.freeze({
        ...frame.layout,
        clientOrigin: Object.freeze({ ...frame.layout.clientOrigin, x: 111 })
      })
    }) as BoardVisualFrame;

    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame, presentedFrame);
    await harness.backend.waitForVisualSettlement(frame);

    expect(harness.scene.applyCalls.at(-1)!.frame).toMatchObject({
      frameToken: 'live-layout', model: frame.model, appearance: frame.appearance, theme: frame.theme,
      layout: expect.objectContaining({ clientOrigin: expect.objectContaining({ x: 111 }) })
    });
    expect(harness.backend.getDiagnostics().settledFrameToken).toBe('live-layout');

    const restorePresentation = Object.freeze({
      ...frame,
      layout: Object.freeze({
        ...frame.layout,
        clientOrigin: Object.freeze({ ...frame.layout.clientOrigin, x: 222 })
      })
    }) as BoardVisualFrame;
    await harness.backend.restore(frame, restorePresentation);
    await harness.backend.waitForVisualSettlement(frame);
    expect(harness.scene.applyCalls.at(-1)!.frame.layout.clientOrigin.x).toBe(222);
  });

  test('forwards the frame render-session identity to camera sync', async () => {
    const syncedSessionIds: Array<string | undefined> = [];
    const harness = createHarness({
      cameraFactory: (options: any) => {
        const camera = Camera.createPixiBoardCamera(options);
        return Object.freeze({
          ...camera,
          sync(topology: any, layout: any, renderSessionId?: string) {
            syncedSessionIds.push(renderSessionId);
            return camera.sync(topology, layout, renderSessionId);
          }
        });
      }
    });
    await harness.backend.mount(harness.host, {});

    const first = makeFrame('session-first', 1, { renderSessionId: 'match:first' });
    await harness.backend.prepareFrame(first);
    harness.backend.applyFrame(first);
    await harness.backend.waitForVisualSettlement(first);

    const second = makeFrame('session-second', 2, { renderSessionId: 'match:second' });
    await harness.backend.prepareFrame(second);
    harness.backend.applyFrame(second);
    await harness.backend.waitForVisualSettlement(second);

    expect(syncedSessionIds).toEqual(['match:first', 'match:second']);
    expect(harness.backend.getDiagnostics().camera).toMatchObject({
      renderSessionId: 'match:second'
    });
  });

  test('keeps lane texture identities stable across committed transaction generations', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const first = makeFrame('texture-generation-first', 1);
    const second = makeFrame('texture-generation-second', 1);

    await harness.backend.prepareFrame(first);
    harness.backend.applyFrame(first);
    await harness.backend.waitForVisualSettlement(first);
    await harness.backend.prepareFrame(second);
    harness.backend.applyFrame(second);
    await harness.backend.waitForVisualSettlement(second);

    const [firstContext, secondContext] = harness.scene.applyCalls.map((entry) => entry.context);
    expect(secondContext.textureRevision).toBeGreaterThan(firstContext.textureRevision);
    expect(secondContext.surfaceTextureRevision).toBe(firstContext.surfaceTextureRevision);
    expect(secondContext.stoneTextureRevision).toBe(firstContext.stoneTextureRevision);
  });

  test('drops stale asynchronous preparation without reporting it as a visual commit', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const first = makeFrame('stale', 1, { boardUrl: 'https://example.test/slow-a.png' });
    const latest = makeFrame('latest', 2, { boardUrl: 'https://example.test/slow-b.png' });
    const firstLoad = harness.textures.deferUrl(first.appearance.boardImageUrl);
    const latestLoad = harness.textures.deferUrl(latest.appearance.boardImageUrl);

    harness.backend.applyFrame(first);
    await nextTurn();
    harness.backend.applyFrame(latest);
    await expect(harness.backend.waitForVisualSettlement(first)).resolves.toBeUndefined();
    expect(harness.backend.getDiagnostics().settledFrameToken).toBeNull();

    latestLoad.resolve();
    await harness.backend.waitForVisualSettlement(latest);
    expect(harness.scene.applyCalls.map((entry) => entry.frame.frameToken)).toEqual(['latest']);
    firstLoad.resolve();
    await nextTurn();
    await nextTurn();
    expect(harness.scene.applyCalls.map((entry) => entry.frame.frameToken)).toEqual(['latest']);
    expect(harness.backend.getDiagnostics()).toMatchObject({ stalePrepareCount: 1, settledFrameToken: 'latest' });
  });

  test('keeps the previous texture set on atomic scene failure and releases failed prepared leases', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const oldFrame = makeFrame('old', 1);
    await harness.backend.prepareFrame(oldFrame);
    harness.backend.applyFrame(oldFrame);
    await harness.backend.waitForVisualSettlement(oldFrame);
    const nextFrame = makeFrame('next', 2);
    await harness.backend.prepareFrame(nextFrame);
    harness.scene.failTokens.add('next');

    let applyError: unknown;
    try { harness.backend.applyFrame(nextFrame); }
    catch (error) { applyError = error; }
    expect(applyError).toMatchObject({ code: 'pixi_scene_apply_failed', fallbackEligible: false });
    await expect(harness.backend.waitForVisualSettlement(nextFrame)).rejects.toBe(applyError);
    let repeatedError: unknown;
    try { harness.backend.applyFrame(nextFrame); }
    catch (error) { repeatedError = error; }
    expect(repeatedError).toBe(applyError);
    expect(harness.backend.getDiagnostics().textures).toMatchObject({
      activeSetId: expect.stringContaining('old'), preparedSetCount: 0, sourceLeaseCount: 1
    });
    expect(harness.leases.find((lease) => lease.label === nextFrame.appearance.boardImageUrl)!.release).toHaveBeenCalledTimes(1);

    harness.scene.failTokens.delete('next');
    await harness.backend.restore(nextFrame);
    expect(harness.scene.applyCalls.at(-1)!.frame.frameToken).toBe('next');
    expect(harness.backend.getDiagnostics()).toMatchObject({ restoreCount: 1, settledFrameToken: 'next' });
  });

  test('committed-frame settlement waits for texture preparation and the final render', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('committed', 3, { boardUrl: 'https://example.test/slow-commit.png' });
    const loading = harness.textures.deferUrl(frame.appearance.boardImageUrl);
    harness.backend.applyFrame(frame);
    let settled = false;
    const waiting = harness.backend.waitForVisualSettlement(frame).then(() => { settled = true; });
    await nextTurn();
    expect(settled).toBe(false);
    expect(harness.scene.applyCalls).toHaveLength(0);

    loading.resolve();
    await waiting;
    expect(settled).toBe(true);
    expect(harness.scene.applyCalls.at(-1)!.frame.frameToken).toBe('committed');
    expect(harness.app.instances[0].renderer.render).toHaveBeenCalledTimes(1);
  });

  test('reveals only old/new topology additions while settling at the DOM-compatible first render', async () => {
    const fixture = createPlaybackFixture();
    const onTopologyRevealStart = jest.fn();
    const harness = createHarness({
      noAnimation: false,
      playbackFactory: () => fixture.playback,
      onTopologyRevealStart
    });
    await harness.backend.mount(harness.host, {});

    const initial = makeFrame('topology-initial', 1, { existingKeys: ['0,0'] });
    await harness.backend.prepareFrame(initial);
    harness.backend.applyFrame(initial);
    await harness.backend.waitForVisualSettlement(initial);
    expect(fixture.playback.revealTopologyCells).not.toHaveBeenCalled();
    expect(onTopologyRevealStart).not.toHaveBeenCalled();

    const reveal = deferred<void>();
    fixture.playback.revealTopologyCells.mockReturnValueOnce(reveal.promise);
    const expanded = makeFrame('topology-expanded', 2, {
      existingKeys: ['1,0', '0,0', '0,1']
    });
    await harness.backend.prepareFrame(expanded);
    harness.backend.applyFrame(expanded);

    const idlePlaybackDiagnostics = fixture.playback.getDiagnostics();
    fixture.playback.getDiagnostics.mockReturnValue({
      ...idlePlaybackDiagnostics,
      timeline: {
        ...idlePlaybackDiagnostics.timeline,
        state: 'running',
        activeRunCount: 1,
        tickerRunning: true,
        tickerSubscribed: true
      }
    });
    const ticker = harness.app.instances[0].ticker;
    ticker.start();
    const stopCountBeforeRevealSettlement = ticker.stop.mock.calls.length;

    expect(fixture.playback.revealTopologyCells).toHaveBeenCalledWith(['0,1', '1,0']);
    expect(onTopologyRevealStart).toHaveBeenCalledWith(['0,1', '1,0'], expanded);
    const expansionApplyOrder = harness.scene.scene.applyFrame.mock.invocationCallOrder.at(-1)!;
    const revealStartOrder = fixture.playback.revealTopologyCells.mock.invocationCallOrder.at(-1)!;
    const expansionRenderOrder = harness.app.instances[0].renderer.render.mock.invocationCallOrder.at(-1)!;
    const revealSoundOrder = onTopologyRevealStart.mock.invocationCallOrder.at(-1)!;
    expect(expansionApplyOrder).toBeLessThan(revealStartOrder);
    expect(revealStartOrder).toBeLessThan(expansionRenderOrder);
    expect(expansionRenderOrder).toBeLessThan(revealSoundOrder);

    let settled = false;
    const waiting = harness.backend.waitForVisualSettlement(expanded).then(() => { settled = true; });
    await waiting;
    expect(settled).toBe(true);
    expect(ticker.started).toBe(true);
    expect(ticker.stop).toHaveBeenCalledTimes(stopCountBeforeRevealSettlement);
    expect(harness.backend.getDiagnostics()).toMatchObject({
      committedApplyCount: 2,
      settledFrameToken: 'topology-expanded'
    });
    // The cosmetic 260ms reveal is deliberately independent from canonical
    // visual settlement.  It still owns and cleans its timeline resources.
    reveal.resolve();
    await Promise.resolve();
    fixture.playback.getDiagnostics.mockReturnValue(idlePlaybackDiagnostics);
    await harness.backend.waitForVisualSettlement(expanded);
    expect(ticker.started).toBe(false);
    expect(harness.backend.getDiagnostics().settledFrameToken).toBe('topology-expanded');

    const shrunk = makeFrame('topology-shrunk', 3, { existingKeys: ['0,0'] });
    await harness.backend.prepareFrame(shrunk);
    harness.backend.applyFrame(shrunk);
    await harness.backend.waitForVisualSettlement(shrunk);
    expect(fixture.playback.revealTopologyCells).toHaveBeenCalledTimes(1);
    expect(onTopologyRevealStart).toHaveBeenCalledTimes(1);

    await harness.backend.restore(expanded);
    expect(fixture.playback.revealTopologyCells).toHaveBeenCalledTimes(1);
    expect(onTopologyRevealStart).toHaveBeenCalledTimes(1);
    expect(harness.backend.getDiagnostics()).toMatchObject({
      restoreCount: 1,
      settledFrameToken: 'topology-expanded'
    });
  });

  test('notifies topology reveal sound only after a successful render and permits a same-token retry', async () => {
    const fixture = createPlaybackFixture();
    const onTopologyRevealStart = jest.fn();
    const harness = createHarness({
      noAnimation: false,
      playbackFactory: () => fixture.playback,
      onTopologyRevealStart
    });
    await harness.backend.mount(harness.host, {});

    const initial = makeFrame('topology-retry-initial', 1, { existingKeys: ['0,0'] });
    await harness.backend.prepareFrame(initial);
    harness.backend.applyFrame(initial);
    await harness.backend.waitForVisualSettlement(initial);

    const renderFailure = new Error('topology-retry-render-failed');
    harness.app.instances[0].renderer.render.mockImplementationOnce(() => {
      throw renderFailure;
    });
    const failedAttempt = makeFrame('topology-retry', 2, {
      existingKeys: ['0,0', '0,1']
    });
    await harness.backend.prepareFrame(failedAttempt);
    let applyError: unknown;
    try { harness.backend.applyFrame(failedAttempt); }
    catch (error) { applyError = error; }
    expect(applyError).toMatchObject({
      code: 'pixi_render_failed', stage: 'render', detail: renderFailure
    });
    await expect(harness.backend.waitForVisualSettlement(failedAttempt)).rejects.toBe(applyError);
    expect(fixture.playback.revealTopologyCells).toHaveBeenCalledTimes(1);
    expect(onTopologyRevealStart).not.toHaveBeenCalled();

    const retry = makeFrame('topology-retry', 2, {
      existingKeys: ['0,0', '0,1']
    });
    await harness.backend.prepareFrame(retry);
    harness.backend.applyFrame(retry);
    await harness.backend.waitForVisualSettlement(retry);

    expect(fixture.playback.revealTopologyCells).toHaveBeenCalledTimes(2);
    expect(onTopologyRevealStart).toHaveBeenCalledTimes(1);
    expect(onTopologyRevealStart).toHaveBeenCalledWith(['0,1'], retry);
    const retryRenderOrder = harness.app.instances[0].renderer.render.mock.invocationCallOrder.at(-1)!;
    const retrySoundOrder = onTopologyRevealStart.mock.invocationCallOrder.at(-1)!;
    expect(retryRenderOrder).toBeLessThan(retrySoundOrder);
    expect(harness.backend.getDiagnostics()).toMatchObject({
      committedApplyCount: 2,
      settledFrameToken: 'topology-retry'
    });
  });

  test('bounds the backing store to viewport plus gutter and cleans every owned resource', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('bounded', 4, { rows: 16, cols: 16 });
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);

    const diagnostics = harness.backend.getDiagnostics();
    expect(diagnostics.camera).toMatchObject({
      logicalWidth: 640, logicalHeight: 640, canvasWidth: 320, canvasHeight: 280
    });
    expect(diagnostics.canvasBackingWidth).toBe(640);
    expect(diagnostics.canvasBackingHeight).toBe(560);
    expect(diagnostics.canvasBackingWidth).toBeLessThan(640 * 2);
    harness.fireResize();
    expect(harness.backend.getDiagnostics()).toMatchObject({
      resizeRenderCount: 1,
      application: { resizeCount: 1, resizeSkippedCount: 1 }
    });

    harness.backend.destroy();
    harness.backend.destroy();
    expect(harness.host.querySelectorAll('canvas')).toHaveLength(0);
    expect(harness.host.querySelectorAll('#board-scroll-viewport')).toHaveLength(0);
    expect(harness.observerDisconnected()).toBe(true);
    expect(Array.from(harness.viewportListeners.values()).every((listeners) => listeners.size === 0)).toBe(true);
    expect(harness.leases.every((lease) => lease.release.mock.calls.length === 1)).toBe(true);
    expect(harness.backend.getDisplayObjectCounts()).toEqual({ total: 0, active: 0, pooled: 0, canvas: 0 });
    expect(harness.backend.getTextureLeaseCounts()).toEqual({ total: 0, cached: 0, external: 0, source: 0 });
    expect(harness.backend.getDiagnostics()).toMatchObject({
      state: 'destroyed', canvasCount: 0, contextCount: 0, tickerRunning: false
    });
  });

  test('bounds an expanded custom board derivative to the base viewport plus gutter', async () => {
    const customBoardBlob = new Blob(['custom-board'], { type: 'image/png' });
    const harness = createHarness({ customBoardBlob });
    harness.textures.runtime.createImageBitmap.mockImplementation(async (_source: any, resize?: any) => ({
      width: resize?.resizeWidth || 4096,
      height: resize?.resizeHeight || 4096,
      close: jest.fn()
    }));
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('expanded-custom-board', 41, {
      rows: 64,
      cols: 64,
      viewportWidth: 2560,
      viewportHeight: 2560
    });

    await harness.backend.prepareFrame(frame);

    expect(harness.textures.runtime.createImageBitmap).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ width: 4096, height: 4096 }),
      expect.objectContaining({ resizeWidth: 960, resizeHeight: 960, resizeQuality: 'high' })
    );
    harness.backend.destroy();
  });

  test('keeps an idle camera refresh failure pending across phase and frame work until restore', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('camera-refresh', 5);
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);

    const renderFailure = new Error('camera-refresh-render-failed');
    const ticker = harness.app.instances[0].ticker;
    ticker.started = true;
    const stopCountBeforeFailure = ticker.stop.mock.calls.length;
    harness.app.instances[0].renderer.render.mockImplementationOnce(() => {
      throw renderFailure;
    });
    harness.fireResize();

    const refreshError = await harness.backend.waitForVisualSettlement(frame).catch((error) => error);
    expect(refreshError).toMatchObject({
      code: 'pixi_render_failed', stage: 'render', fallbackEligible: false
    });
    expect(refreshError.detail).toBe(renderFailure);
    expect(ticker.stop).toHaveBeenCalledTimes(stopCountBeforeFailure);
    expect(ticker.started).toBe(true);
    expect(Backend.isPixiCompatibilityFallbackError(refreshError)).toBe(false);
    await expect(harness.backend.waitForVisualSettlement(frame)).rejects.toBe(refreshError);
    expect(harness.backend.getDiagnostics().lastErrorCode).toBe('pixi_render_failed');

    const blockedFrame = makeFrame('camera-refresh-blocked', 6);
    expect(() => harness.backend.validatePhase([{ type: 'place', targets: [] }], {
      strictNetworkPlayback: false
    })).toThrow(refreshError);
    await expect(harness.backend.playPhase([{ type: 'place', targets: [] }], {
      token: { id: 1, frameToken: frame.frameToken, mode: 'local' },
      strictNetworkPlayback: false
    })).rejects.toBe(refreshError);
    expect(() => harness.backend.prepareFrame(blockedFrame)).toThrow(refreshError);
    expect(() => harness.backend.applyFrame(blockedFrame)).toThrow(refreshError);
    await expect(harness.backend.waitForVisualSettlement(blockedFrame)).rejects.toBe(refreshError);

    await harness.backend.restore(blockedFrame);
    await expect(harness.backend.waitForVisualSettlement(blockedFrame)).resolves.toBeUndefined();
    expect(harness.backend.getDiagnostics()).toMatchObject({
      restoreCount: 1, settledFrameToken: 'camera-refresh-blocked', lastErrorCode: null
    });
  });

  test('aborts active playback when a camera refresh cannot render', async () => {
    const fixture = createPlaybackFixture();
    let rejectPlayback!: (error: unknown) => void;
    fixture.playback.playPhase.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
      rejectPlayback = reject;
    }));
    fixture.playback.abort.mockImplementationOnce((error: unknown) => {
      rejectPlayback(error);
      return 1;
    });
    fixture.playback.getDiagnostics.mockReturnValue(Object.freeze({
      destroyed: false,
      activeScopeKey: 'local:1:camera-playback',
      projectedStoneCount: 1,
      retainedFinalGhostCount: 1,
      inFlightEffectCount: 1,
      inFlightTopologyRevealCount: 0,
      phaseCount: 1,
      completedPhaseCount: 0,
      failedPhaseCount: 0,
      timeline: Object.freeze({
        ...fixture.timeline,
        state: 'running' as const,
        activeRunCount: 1,
        tickerRunning: true,
        tickerSubscribed: true
      })
    }));
    const harness = createHarness({ playbackFactory: () => fixture.playback });
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('camera-playback', 6);
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);

    const phasePromise = harness.backend.playPhase([{ type: 'move' }], {
      token: { id: 1, frameToken: 'camera-playback', mode: 'local' },
      strictNetworkPlayback: false
    });
    await Promise.resolve();
    const renderFailure = new Error('camera-playback-render-failed');
    harness.app.instances[0].renderer.render.mockImplementationOnce(() => {
      throw renderFailure;
    });
    harness.fireResize();

    const playbackError = await phasePromise.catch((error) => error);
    expect(playbackError).toMatchObject({ code: 'pixi_render_failed', stage: 'render' });
    expect(playbackError.detail).toBe(renderFailure);
    expect(fixture.playback.abort).toHaveBeenCalledTimes(1);
    expect(fixture.playback.abort).toHaveBeenCalledWith(playbackError);
    await expect(harness.backend.waitForVisualSettlement(frame)).rejects.toBe(playbackError);
  });

  test('uses the strict init-code allowlist and never marks camera, scene, or input failures as DOM fallback candidates', async () => {
    const runtimeUnavailable = createHarness();
    const missingRuntime = Backend.createPixiBoardVisualBackend({
      runtime: {},
      document: runtimeUnavailable.document,
      root: runtimeUnavailable.dom.window as any
    });
    await expect(missingRuntime.mount(runtimeUnavailable.host, {})).rejects.toMatchObject({ code: 'pixi_runtime_unavailable' });

    const webgl = createHarness({ webglAvailable: false });
    await expect(webgl.backend.mount(webgl.host, {})).rejects.toMatchObject({ code: 'pixi_webgl_unavailable' });
    const application = createHarness({ initError: new Error('generic-init-failed') });
    await expect(application.backend.mount(application.host, {})).rejects.toMatchObject({ code: 'pixi_application_init_failed' });
    const webglInit = createHarness({ initError: new Error('WebGL context creation failed') });
    await expect(webglInit.backend.mount(webglInit.host, {})).rejects.toMatchObject({ code: 'pixi_webgl_init_failed' });
    const renderer = createHarness({ rendererMissing: true });
    await expect(renderer.backend.mount(renderer.host, {})).rejects.toMatchObject({ code: 'pixi_renderer_init_failed' });
    const software = createHarness({
      rendererText: 'ANGLE (Google, Vulkan SwiftShader Device)',
      vendorText: 'Google Inc.'
    });
    await expect(software.backend.mount(software.host, {})).rejects.toMatchObject({
      code: 'pixi_software_webgl_renderer',
      stage: 'webgl',
      fallbackEligible: true
    });

    const fallbackErrors = [
      await missingRuntime.mount(runtimeUnavailable.host, {}).catch((error) => error),
      await webgl.backend.mount(webgl.host, {}).catch((error) => error),
      await application.backend.mount(application.host, {}).catch((error) => error),
      await webglInit.backend.mount(webglInit.host, {}).catch((error) => error),
      await renderer.backend.mount(renderer.host, {}).catch((error) => error),
      await software.backend.mount(software.host, {}).catch((error) => error)
    ];
    expect(fallbackErrors.every(Backend.isPixiCompatibilityFallbackError)).toBe(true);
    expect(software.sceneFactory).not.toHaveBeenCalled();

    const camera = createHarness({ cameraFactory: () => { throw new Error('camera-failed'); } });
    const cameraError = await camera.backend.mount(camera.host, {}).catch((error) => error);
    expect(cameraError).toMatchObject({ code: 'pixi_camera_init_failed', fallbackEligible: false });
    expect(Backend.isPixiCompatibilityFallbackError(cameraError)).toBe(false);
    const scene = createHarness({ sceneFactoryThrows: true });
    const sceneError = await scene.backend.mount(scene.host, {}).catch((error) => error);
    expect(sceneError).toMatchObject({ code: 'pixi_scene_init_failed', fallbackEligible: false });
    expect(Backend.isPixiCompatibilityFallbackError(sceneError)).toBe(false);
    const failedInput = {
      mount: jest.fn(() => { throw new Error('input-failed'); }),
      syncViewportMetrics: jest.fn(),
      destroy: jest.fn(),
      getDiagnostics: jest.fn()
    };
    const input = createHarness({
      inputFactory: () => failedInput,
      getInputController: () => ({ hitTestClientPoint: jest.fn(), handlePointer: jest.fn() })
    });
    const inputError = await input.backend.mount(input.host, {}).catch((error) => error);
    expect(inputError).toMatchObject({ code: 'pixi_input_init_failed', fallbackEligible: false });
    expect(Backend.isPixiCompatibilityFallbackError(inputError)).toBe(false);
    expect(failedInput.destroy).toHaveBeenCalledTimes(1);

    const playback = createHarness({
      playbackFactory: () => { throw new Error('playback-failed'); }
    });
    const playbackError = await playback.backend.mount(playback.host, {}).catch((error) => error);
    expect(playbackError).toMatchObject({
      code: 'pixi_playback_init_failed',
      stage: 'playback-init',
      fallbackEligible: false
    });
    expect(Backend.isPixiCompatibilityFallbackError(playbackError)).toBe(false);
  });

  test('allows explicit debug/test software Pixi without changing normal classification', async () => {
    const harness = createHarness({
      rendererText: 'ANGLE (Google, Vulkan SwiftShader Device)',
      vendorText: 'Google Inc.',
      allowSoftwareRenderer: true
    });

    await expect(harness.backend.mount(harness.host, {})).resolves.toBeUndefined();
    expect(harness.sceneFactory).toHaveBeenCalledTimes(1);
    harness.backend.destroy();
  });

  test('accepts Pixi v8 numeric WEBGL and rejects numeric WEBGPU/CANVAS renderers', async () => {
    const webgl = createHarness({ rendererType: 1 });
    await expect(webgl.backend.mount(webgl.host, {})).resolves.toBeUndefined();
    webgl.backend.destroy();

    for (const rendererType of [2, 4]) {
      const harness = createHarness({ rendererType });
      const error = await harness.backend.mount(harness.host, {}).catch((caught) => caught);
      expect(error).toMatchObject({ code: 'pixi_renderer_init_failed', fallbackEligible: true });
      expect(Backend.isPixiCompatibilityFallbackError(error)).toBe(true);
    }
  });

  test('prepares special-stone textures before placement and roulette playback draw their first frame', async () => {
    const fixture = createPlaybackFixture();
    const harness = createHarness({ noAnimation: false, playbackFactory: () => fixture.playback });
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('special-playback-textures', 1);
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);

    fixture.playback.playPhase.mockImplementationOnce(async () => {
      const textureSource = harness.scene.applyCalls.at(-1)?.context?.textures;
      expect(textureSource?.get('special-stone:HYPERACTIVE:black')).toEqual({
        url: 'https://example.test/special/HYPERACTIVE/black.png'
      });
      expect(harness.scene.applyCalls.at(-1)?.context?.preservePlaybackProjection).toBe(true);
    });
    await harness.backend.playPhase([{
      type: 'spawn',
      targets: [{
        r: 2,
        col: 3,
        ownerAfter: 'black',
        after: { owner: 'black', color: 1, special: 'HYPERACTIVE' }
      }]
    }], {
      token: { id: 7, frameToken: frame.frameToken, mode: 'local' },
      strictNetworkPlayback: false
    });

    fixture.playback.playPhase.mockImplementationOnce(async () => {
      const textureSource = harness.scene.applyCalls.at(-1)?.context?.textures;
      expect(textureSource?.get('special-stone:HYPERACTIVE:black')).toEqual({
        url: 'https://example.test/special/HYPERACTIVE/black.png'
      });
      expect(textureSource?.get('special-stone:SNIPER:black')).toEqual({
        url: 'https://example.test/special/SNIPER/black.png'
      });
    });
    await harness.backend.playPhase([{
      type: 'theory_incarnation_spawn_roulette',
      meta: { special: 'SNIPER', owner: 'black' },
      targets: [{
        r: 4,
        col: 6,
        ownerAfter: 'black',
        spawnedMarkerType: 'SNIPER',
        after: { owner: 'black', color: 1, special: 'SNIPER' }
      }]
    }], {
      token: { id: 7, frameToken: frame.frameToken, mode: 'local' },
      strictNetworkPlayback: false
    });

    expect(harness.textures.loadTexture).toHaveBeenCalledWith(
      'https://example.test/special/HYPERACTIVE/black.png',
      'special-stone:HYPERACTIVE:black'
    );
    expect(harness.textures.loadTexture).toHaveBeenCalledWith(
      'https://example.test/special/SNIPER/black.png',
      'special-stone:SNIPER:black'
    );
  });

  test('supersedes an obsolete writer without looping during special-stone texture preparation', async () => {
    const fixture = createPlaybackFixture();
    const harness = createHarness({ playbackFactory: () => fixture.playback });
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('special-playback-writer-switch', 1);
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);

    const hyperactiveTexture = harness.textures.deferUrl(
      'https://example.test/special/HYPERACTIVE/black.png'
    );
    const firstContext = {
      token: { id: 7, frameToken: frame.frameToken, mode: 'local' as const },
      strictNetworkPlayback: false
    };
    const secondContext = {
      token: { id: 8, frameToken: frame.frameToken, mode: 'local' as const },
      strictNetworkPlayback: false
    };
    const firstPhase = harness.backend.playPhase([{
      type: 'spawn',
      targets: [{
        r: 2,
        col: 3,
        after: { owner: 'black', color: 1, special: 'HYPERACTIVE' }
      }]
    }], firstContext);
    await flushMicrotasks();
    const secondEvents = [{
      type: 'spawn',
      targets: [{
        r: 4,
        col: 5,
        after: { owner: 'black', color: 1, special: 'SNIPER' }
      }]
    }];
    const secondPhase = harness.backend.playPhase(secondEvents, secondContext);

    hyperactiveTexture.resolve();
    await expect(firstPhase).rejects.toMatchObject({
      code: 'pixi_playback_texture_prepare_superseded',
      stage: 'texture-prepare'
    });
    await expect(secondPhase).resolves.toBeUndefined();
    expect(fixture.playback.playPhase).toHaveBeenCalledTimes(1);
    expect(fixture.playback.playPhase).toHaveBeenCalledWith(secondEvents, secondContext);
  });

  test('lets context recovery retry special-stone preparation on the replacement texture manager', async () => {
    const fixture = createPlaybackFixture();
    const onContextLost = jest.fn();
    const onContextRestored = jest.fn(async () => true);
    const harness = createHarness({
      playbackFactory: () => fixture.playback,
      contextRecovery: {
        onContextLost,
        onContextRestored,
        onFallbackRequired: jest.fn(async () => true)
      }
    });
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('special-playback-context-recovery', 1);
    await harness.backend.prepareFrame(frame);
    harness.backend.applyFrame(frame);
    await harness.backend.waitForVisualSettlement(frame);

    const specialTextureUrl = 'https://example.test/special/HYPERACTIVE/black.png';
    const specialTexture = harness.textures.deferUrl(specialTextureUrl);
    const events = [{
      type: 'spawn',
      targets: [{
        r: 2,
        col: 3,
        after: { owner: 'black', color: 1, special: 'HYPERACTIVE' }
      }]
    }];
    const context = {
      token: { id: 7, frameToken: frame.frameToken, mode: 'local' as const },
      strictNetworkPlayback: false
    };
    const interruptedPhase = harness.backend.playPhase(events, context);
    const interruptedOutcome = interruptedPhase.catch((error) => error);
    await flushMicrotasks();

    const canvas = harness.app.instances[0].canvas as HTMLCanvasElement;
    canvas.dispatchEvent(new harness.dom.window.Event('webglcontextlost', { cancelable: true }));
    canvas.dispatchEvent(new harness.dom.window.Event('webglcontextrestored'));
    await nextTurn();
    await nextTurn();
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(onContextRestored).toHaveBeenCalledTimes(1);

    const recoveryPhase = harness.backend.playPhase(events, context);
    specialTexture.resolve();
    await expect(interruptedOutcome).resolves.toMatchObject({
      code: 'pixi_playback_texture_prepare_superseded'
    });
    await expect(recoveryPhase).resolves.toBeUndefined();
    expect(harness.textures.loadTexture).toHaveBeenCalledWith(
      specialTextureUrl,
      'special-stone:HYPERACTIVE:black'
    );
    expect(fixture.playback.playPhase).toHaveBeenCalledTimes(1);
  });

  test('delegates Phase 6 playback in animated mode and preserves typed failures', async () => {
    const fixture = createPlaybackFixture();
    const playbackFactory = jest.fn(() => fixture.playback);
    const harness = createHarness({ noAnimation: false, playbackFactory });
    await harness.backend.mount(harness.host, {});
    const context = {
      token: { id: 1, frameToken: 'phase', mode: 'local' as const },
      strictNetworkPlayback: false
    };
    const events = [{ type: 'place', row: 0, col: 0 }];

    const validationContext = {
      strictNetworkPlayback: false,
      phaseScope: { events, phaseKey: '0', stepIndex: 0 }
    };
    expect(() => harness.backend.validatePhase!(events, validationContext)).not.toThrow();
    expect(fixture.playback.validatePhase).toHaveBeenCalledWith(events, validationContext);
    expect(fixture.playback.playPhase).not.toHaveBeenCalled();

    await expect(harness.backend.playPhase(events, context)).resolves.toBeUndefined();
    expect(fixture.playback.playPhase).toHaveBeenCalledWith(events, context);

    const playbackError = new PresentationPlaybackError(
      'board_event_unimplemented',
      { type: 'crossfade_stone' },
      { strictNetworkPlayback: true }
    );
    fixture.playback.playPhase.mockRejectedValueOnce(playbackError as never);
    await expect(harness.backend.playPhase([{ type: 'crossfade_stone' }], {
      ...context,
      strictNetworkPlayback: true
    })).rejects.toBe(playbackError);
    expect(harness.backend.getDiagnostics().lastErrorCode).toBe('board_event_unimplemented');
    expect(Backend.isPixiCompatibilityFallbackError(playbackError)).toBe(false);
  });

  test('does not stop the shared private ticker while a sibling board phase run is active', async () => {
    const fixture = createPlaybackFixture();
    const first = deferred<void>();
    const second = deferred<void>();
    let activeRunCount = 2;
    fixture.playback.playPhase
      .mockImplementationOnce(() => first.promise)
      .mockImplementationOnce(() => second.promise);
    fixture.playback.getDiagnostics.mockImplementation(() => Object.freeze({
      destroyed: false,
      activeScopeKey: 'network:1',
      projectedStoneCount: 1,
      retainedFinalGhostCount: 0,
      inFlightEffectCount: activeRunCount,
      inFlightTopologyRevealCount: 0,
      phaseCount: 2,
      completedPhaseCount: 2 - activeRunCount,
      failedPhaseCount: 0,
      timeline: Object.freeze({
        ...fixture.timeline,
        state: activeRunCount > 0 ? 'running' as const : 'idle' as const,
        activeRunCount,
        tickerRunning: activeRunCount > 0,
        tickerSubscribed: activeRunCount > 0
      })
    }));
    const harness = createHarness({ playbackFactory: () => fixture.playback });
    await harness.backend.mount(harness.host, {});
    const ticker = harness.app.instances[0].ticker;
    const stopCountBeforePhases = ticker.stop.mock.calls.length;
    const context = {
      token: { id: 1, frameToken: 'network:1', mode: 'network' as const },
      strictNetworkPlayback: true
    };

    const firstPhase = harness.backend.playPhase([{ type: 'place' }], context);
    const secondPhase = harness.backend.playPhase([{ type: 'flip' }], context);
    activeRunCount = 1;
    first.resolve();
    await expect(firstPhase).resolves.toBeUndefined();
    expect(ticker.stop).toHaveBeenCalledTimes(stopCountBeforePhases);

    activeRunCount = 0;
    second.resolve();
    await expect(secondPhase).resolves.toBeUndefined();
    expect(ticker.stop).toHaveBeenCalledTimes(stopCountBeforePhases + 1);
  });

  test('reuses a failed preparation as the same typed failure and restore can retry it', async () => {
    const harness = createHarness();
    await harness.backend.mount(harness.host, {});
    const frame = makeFrame('retry', 5);
    harness.textures.setFailAll(true);
    let prepareError: unknown;
    try { await harness.backend.prepareFrame(frame); }
    catch (error) { prepareError = error; }
    expect(prepareError).toMatchObject({ code: 'pixi_texture_prepare_failed', fallbackEligible: false });
    let applyError: unknown;
    try { harness.backend.applyFrame(frame); }
    catch (error) { applyError = error; }
    expect(applyError).toBe(prepareError);
    await expect(harness.backend.waitForVisualSettlement(frame)).rejects.toBe(prepareError);

    harness.textures.setFailAll(false);
    await harness.backend.restore(frame);
    expect(harness.scene.applyCalls.at(-1)!.frame.frameToken).toBe('retry');
    expect(harness.backend.getDiagnostics()).toMatchObject({ restoreCount: 1, settledFrameToken: 'retry' });
  });

  test('locks the controller before aborting Pixi work and reloads texture ownership on context restore', async () => {
    const fixture = createPlaybackFixture();
    const onContextLost = jest.fn();
    const onContextRestored = jest.fn(async () => true);
    const onFallbackRequired = jest.fn(async () => true);
    const harness = createHarness({
      playbackFactory: () => fixture.playback,
      contextRecovery: { onContextLost, onContextRestored, onFallbackRequired }
    });
    await harness.backend.mount(harness.host, {});
    const canvas = harness.app.instances[0].canvas as HTMLCanvasElement;
    const lost = new harness.dom.window.Event('webglcontextlost', { cancelable: true });

    canvas.dispatchEvent(lost);

    expect(lost.defaultPrevented).toBe(true);
    expect(onContextLost).toHaveBeenCalledTimes(1);
    expect(fixture.playback.abort).toHaveBeenCalledTimes(1);
    expect(onContextLost.mock.invocationCallOrder[0])
      .toBeLessThan(fixture.playback.abort.mock.invocationCallOrder[0]);
    expect(harness.backend.getDiagnostics().contextRecovery).toMatchObject({
      state: 'lost', lossCount: 1, timerActive: true
    });
    expect(() => harness.backend.applyFrame(makeFrame('blocked', 9))).toThrow(
      expect.objectContaining({ code: 'pixi_context_lost' })
    );

    canvas.dispatchEvent(new harness.dom.window.Event('webglcontextrestored'));
    await nextTurn();
    await nextTurn();

    expect(onContextRestored).toHaveBeenCalledTimes(1);
    expect(harness.scene.scene.invalidateStaticViews).toHaveBeenCalledTimes(1);
    expect(onFallbackRequired).not.toHaveBeenCalled();
    expect(harness.backend.getDiagnostics()).toMatchObject({
      lastErrorCode: null,
      contextRecovery: {
        state: 'idle', restoreAttemptCount: 1, restoreSuccessCount: 1, timerActive: false
      }
    });
  });

  test('still aborts Pixi work when the controller context-loss hook fails', async () => {
    const fixture = createPlaybackFixture();
    const onRecoveryFailed = jest.fn();
    const harness = createHarness({
      playbackFactory: () => fixture.playback,
      contextRecovery: {
        onContextLost: jest.fn(() => { throw new Error('controller-lock-failed'); }),
        onContextRestored: jest.fn(async () => true),
        onFallbackRequired: jest.fn(async () => true),
        onRecoveryFailed
      }
    });
    await harness.backend.mount(harness.host, {});
    const canvas = harness.app.instances[0].canvas as HTMLCanvasElement;

    canvas.dispatchEvent(new harness.dom.window.Event('webglcontextlost', { cancelable: true }));

    expect(fixture.playback.abort).toHaveBeenCalledTimes(1);
    expect(fixture.playback.abort).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'pixi_context_lost' })
    );
    expect(onRecoveryFailed).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'controller-lock-failed' })
    );
    expect(harness.backend.getDiagnostics().contextRecovery).toMatchObject({
      state: 'failed', failureCount: 1, timerActive: false
    });
    expect(() => harness.backend.applyFrame(makeFrame('still-blocked', 10))).toThrow(
      expect.objectContaining({ code: 'pixi_context_lost' })
    );
  });

  test('requests DOM compatibility once when WebGL checkpoint restore exceeds five seconds', async () => {
    jest.useFakeTimers();
    try {
      const restore = deferred<boolean>();
      const onFallbackRequired = jest.fn(async () => true);
      const harness = createHarness({
        contextRecovery: {
          timeoutMs: 5000,
          onContextLost: jest.fn(),
          onContextRestored: jest.fn(() => restore.promise),
          onFallbackRequired
        }
      });
      await harness.backend.mount(harness.host, {});
      const canvas = harness.app.instances[0].canvas as HTMLCanvasElement;
      canvas.dispatchEvent(new harness.dom.window.Event('webglcontextlost', { cancelable: true }));
      canvas.dispatchEvent(new harness.dom.window.Event('webglcontextrestored'));
      await Promise.resolve();

      jest.advanceTimersByTime(5000);
      await flushMicrotasks();

      expect(onFallbackRequired).toHaveBeenCalledTimes(1);
      expect(harness.backend.getDiagnostics().contextRecovery).toMatchObject({
        state: 'idle', fallbackAttemptCount: 1, fallbackSuccessCount: 1
      });
      restore.resolve(true);
      jest.advanceTimersByTime(5000);
      await flushMicrotasks();
      expect(onFallbackRequired).toHaveBeenCalledTimes(1);
      harness.backend.destroy();
    } finally {
      jest.useRealTimers();
    }
  });
});
