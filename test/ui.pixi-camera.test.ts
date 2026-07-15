const { JSDOM } = require('jsdom');
const Camera = require('../ui/pixi/camera');
const Layout = require('../ui/board-visual/layout');

function topology(overrides: Record<string, number> = {}) {
  const minRow = overrides.minRow ?? 0;
  const maxRow = overrides.maxRow ?? 15;
  const minCol = overrides.minCol ?? 0;
  const maxCol = overrides.maxCol ?? 15;
  return {
    baseRows: 8,
    baseCols: 8,
    minRow,
    maxRow,
    minCol,
    maxCol,
    renderRowOffset: -minRow,
    renderColOffset: -minCol,
    renderRows: maxRow - minRow + 1,
    renderCols: maxCol - minCol + 1,
    existingKeys: [],
    playableKeys: [],
    holeKeys: []
  };
}

function seedLayout(nextTopology: any, orientation: 'normal' | 'rotated-180' = 'normal') {
  return Layout.createBoardViewportLayout(nextTopology, {
    cellSize: 40,
    dpr: 3,
    orientation,
    clientOrigin: { x: 100, y: 200 },
    frameInset: { left: 5, top: 7 },
    visualViewport: { scale: 1, offsetLeft: 0, offsetTop: 0 },
    camera: { viewportWidth: 160, viewportHeight: 120 }
  });
}

function createHarness(options: Record<string, unknown> = {}) {
  const dom = new JSDOM('<!doctype html><div id="board"><div class="cell"></div></div>');
  const document = dom.window.document;
  const host = document.getElementById('board');
  let width = 160;
  let height = 120;
  let resizeCallback: (() => void) | null = null;
  let observerDisconnected = false;
  const listeners = new Map<string, Set<EventListener>>();
  const visualViewport = {
    scale: 1,
    offsetLeft: 0,
    offsetTop: 0,
    addEventListener(type: string, listener: EventListener) {
      const set = listeners.get(type) || new Set<EventListener>();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type: string, listener: EventListener) {
      listeners.get(type)?.delete(listener);
    }
  };
  const changes: any[] = [];
  const camera = Camera.createPixiBoardCamera({
    document,
    visualViewport,
    devicePixelRatio: 4,
    measureViewport: () => ({ width, height }),
    createResizeObserver: (callback: () => void) => {
      resizeCallback = callback;
      return { observe() {}, disconnect() { observerDisconnected = true; } };
    },
    onLayoutChange: (layout: any, canvas: any) => changes.push({ layout, canvas }),
    ...options
  });
  camera.mount(host);
  return {
    camera,
    host,
    visualViewport,
    listeners,
    changes,
    setSize(nextWidth: number, nextHeight: number) { width = nextWidth; height = nextHeight; },
    fireResize() { resizeCallback?.(); },
    observerDisconnected: () => observerDisconnected
  };
}

describe('Pixi board camera', () => {
  test('mounts only a cell-less logical spacer and bounds canvas to viewport plus gutter', () => {
    const harness = createHarness();
    const nextTopology = topology();
    const layout = harness.camera.sync(nextTopology, seedLayout(nextTopology));

    expect(harness.host.querySelectorAll('.cell')).toHaveLength(0);
    expect(harness.host.querySelectorAll('#board-scroll-viewport')).toHaveLength(1);
    expect(harness.host.querySelectorAll('#board-scroll-surface')).toHaveLength(1);
    expect(harness.camera.getSurfaceElement().style.width).toBe('640px');
    expect(layout.dpr).toBe(2);
    expect(harness.camera.getCanvasViewport()).toEqual({
      width: 320,
      height: 280,
      gutterPx: 80,
      sceneOffsetX: 80,
      sceneOffsetY: 80
    });
    expect(harness.camera.getDiagnostics()).toMatchObject({
      logicalWidth: 640,
      canvasWidth: 320,
      effectGutterCells: 2,
      scrollListenerCount: 1,
      visualViewportListenerCount: 2,
      resizeObserverActive: true
    });
  });

  test('keeps an existing cell client rect invariant across all normal-orientation sides', () => {
    const harness = createHarness({ effectGutterCells: 1 });
    const initial = topology({ maxRow: 7, maxCol: 7 });
    harness.camera.sync(initial, seedLayout(initial));
    const before = harness.camera.getCellClientRect(2, 2);

    const top = topology({ minRow: -1, maxRow: 7, maxCol: 7 });
    harness.camera.sync(top, seedLayout(top));
    expect(harness.camera.getCellClientRect(2, 2)).toMatchObject({ left: before.left, top: before.top });
    expect(harness.camera.getLayout().camera.scrollTop).toBe(40);

    const left = topology({ minRow: -1, maxRow: 7, minCol: -2, maxCol: 7 });
    harness.camera.sync(left, seedLayout(left));
    expect(harness.camera.getCellClientRect(2, 2)).toMatchObject({ left: before.left, top: before.top });
    expect(harness.camera.getLayout().camera.scrollLeft).toBe(80);

    const right = topology({ minRow: -1, maxRow: 7, minCol: -2, maxCol: 9 });
    harness.camera.sync(right, seedLayout(right));
    expect(harness.camera.getCellClientRect(2, 2)).toMatchObject({ left: before.left, top: before.top });
    expect(harness.camera.getLayout().camera.scrollLeft).toBe(80);

    const bottom = topology({ minRow: -1, maxRow: 10, minCol: -2, maxCol: 9 });
    harness.camera.sync(bottom, seedLayout(bottom));
    expect(harness.camera.getCellClientRect(2, 2)).toMatchObject({ left: before.left, top: before.top });
    expect(harness.camera.getLayout().camera.scrollTop).toBe(40);
  });

  test('uses render-index compensation for rotated viewer orientation', () => {
    const harness = createHarness();
    const initial = topology({ maxRow: 7, maxCol: 7 });
    harness.camera.sync(initial, seedLayout(initial, 'rotated-180'));
    const before = harness.camera.getCellClientRect(2, 2);

    const worldRight = topology({ maxRow: 7, maxCol: 8 });
    harness.camera.sync(worldRight, seedLayout(worldRight, 'rotated-180'));
    expect(harness.camera.getLayout().camera.scrollLeft).toBe(40);
    expect(harness.camera.getCellClientRect(2, 2)).toMatchObject({ left: before.left, top: before.top });

    const worldBottom = topology({ maxRow: 9, maxCol: 8 });
    harness.camera.sync(worldBottom, seedLayout(worldBottom, 'rotated-180'));
    expect(harness.camera.getLayout().camera.scrollTop).toBe(80);
    expect(harness.camera.getCellClientRect(2, 2)).toMatchObject({ left: before.left, top: before.top });
  });

  test('refreshes visualViewport offsets and viewport size without changing stable cell size', () => {
    const harness = createHarness();
    const nextTopology = topology();
    const first = harness.camera.sync(nextTopology, seedLayout(nextTopology));
    const firstRect = harness.camera.getCellClientRect(0, 0);
    harness.visualViewport.scale = 2;
    harness.visualViewport.offsetLeft = 11;
    harness.visualViewport.offsetTop = 13;
    harness.setSize(200, 180);
    harness.fireResize();
    const second = harness.camera.getLayout();
    const secondRect = harness.camera.getCellClientRect(0, 0);

    expect(second.revision).toBeGreaterThan(first.revision);
    expect(second.cellSize).toBe(40);
    expect(second.visualViewport).toEqual({ scale: 2, offsetLeft: 11, offsetTop: 13 });
    expect(second.camera).toMatchObject({ viewportWidth: 200, viewportHeight: 180 });
    expect(secondRect.left).toBe(firstRect.left - 11);
    expect(secondRect.top).toBe(firstRect.top - 13);
  });

  test('does not advance layout revision for an identical apply and releases observers/listeners', () => {
    const harness = createHarness();
    const nextTopology = topology();
    const first = harness.camera.sync(nextTopology, seedLayout(nextTopology));
    const second = harness.camera.sync(nextTopology, seedLayout(nextTopology));
    expect(second.revision).toBe(first.revision);

    harness.camera.destroy();
    expect(harness.observerDisconnected()).toBe(true);
    expect(Array.from(harness.listeners.values()).every((set) => set.size === 0)).toBe(true);
    expect(harness.host.children).toHaveLength(0);
    expect(harness.camera.getDiagnostics()).toMatchObject({
      mounted: false,
      destroyed: true,
      resizeObserverActive: false,
      visualViewportListenerCount: 0,
      scrollListenerCount: 0
    });
  });

  test('rejects a gutter larger than the documented two-cell bound', () => {
    expect(() => createHarness({ effectGutterCells: 3 })).toThrow(/between 0 and 2/);
  });
});
