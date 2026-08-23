import {
  createBoardViewportLayout,
  getBoardClientRect,
  getCellClientRect
} from '../board-visual/layout';
import type {
  BoardClientRect,
  BoardRenderTopologyModel,
  BoardViewportLayout
} from '../board-visual/types';

export interface PixiBoardCanvasViewport {
  readonly width: number;
  readonly height: number;
  readonly gutterPx: number;
  readonly sceneOffsetX: number;
  readonly sceneOffsetY: number;
  readonly leftGutterPx: number;
  readonly topGutterPx: number;
  readonly rightGutterPx: number;
  readonly bottomGutterPx: number;
}

export type PixiBoardCameraLayoutChangeKind = 'client-only' | 'render-space';

export interface PixiBoardCameraDiagnostics {
  readonly mounted: boolean;
  readonly destroyed: boolean;
  readonly revision: number;
  readonly stableCellSize: number | null;
  readonly renderSessionId: string | null;
  readonly logicalWidth: number;
  readonly logicalHeight: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly effectGutterCells: number;
  readonly resizeObserverActive: boolean;
  readonly visualViewportListenerCount: number;
  readonly scrollListenerCount: number;
  readonly pendingRefresh: boolean;
  readonly refreshEventCount: number;
  readonly refreshApplyCount: number;
  readonly refreshCoalescedCount: number;
  readonly layoutApplyCount: number;
  readonly renderLayoutChangeCount: number;
  readonly clientLayoutChangeCount: number;
  readonly noopLayoutChangeCount: number;
}

interface ResizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

interface VisualViewportLike {
  readonly scale?: number;
  readonly offsetLeft?: number;
  readonly offsetTop?: number;
  addEventListener(type: 'resize' | 'scroll', listener: EventListener): void;
  removeEventListener(type: 'resize' | 'scroll', listener: EventListener): void;
}

export interface PixiBoardCameraOptions {
  readonly document?: Document;
  readonly effectGutterCells?: number;
  readonly devicePixelRatio?: number | (() => number);
  readonly visualViewport?: VisualViewportLike | null;
  readonly createResizeObserver?: ((callback: ResizeObserverCallback) => ResizeObserverLike) | null;
  readonly measureViewport?: (viewport: HTMLElement) => Readonly<{
    width: number;
    height: number;
    left?: number;
    top?: number;
  }>;
  readonly requestAnimationFrame?: (callback: FrameRequestCallback) => unknown;
  readonly cancelAnimationFrame?: (handle: unknown) => void;
  readonly onLayoutChange?: (
    layout: BoardViewportLayout,
    canvasViewport: PixiBoardCanvasViewport,
    kind: PixiBoardCameraLayoutChangeKind
  ) => void;
}

export interface PixiBoardCamera {
  mount(host: HTMLElement): HTMLElement;
  sync(
    topology: BoardRenderTopologyModel,
    seedLayout: BoardViewportLayout,
    renderSessionId?: string
  ): BoardViewportLayout;
  refresh(): BoardViewportLayout | null;
  getLayout(): BoardViewportLayout | null;
  getCanvasViewport(): PixiBoardCanvasViewport | null;
  getViewportElement(): HTMLElement | null;
  getSurfaceElement(): HTMLElement | null;
  getCanvasLayerElement(): HTMLElement | null;
  getCellClientRect(row: number, col: number): BoardClientRect | null;
  getBoardClientRect(): BoardClientRect | null;
  getDiagnostics(): PixiBoardCameraDiagnostics;
  destroy(): void;
}

function finite(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function positive(value: unknown, fallback = 1): number {
  return Math.max(1, finite(value, fallback));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function capDpr(value: unknown): number {
  return Math.min(2, Math.max(0.1, finite(value, 1)));
}

function normalizeEffectGutterCells(value: unknown): number {
  const numeric = Math.trunc(finite(value, 2));
  if (numeric < 0 || numeric > 2) {
    throw new Error('Pixi board effect gutter must be between 0 and 2 cells');
  }
  return numeric;
}

function topologySignature(topology: BoardRenderTopologyModel): string {
  const expansion = expansionWorldExtents(topology);
  return [
    topology.minRow,
    topology.maxRow,
    topology.minCol,
    topology.maxCol,
    topology.renderRowOffset,
    topology.renderColOffset,
    topology.renderRows,
    topology.renderCols,
    expansion.left,
    expansion.top,
    expansion.right,
    expansion.bottom
  ].join(':');
}

function parseBoardKey(key: string): { row: number; col: number } | null {
  const parts = String(key).split(',');
  if (parts.length !== 2) return null;
  const row = Number(parts[0]);
  const col = Number(parts[1]);
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  return { row, col };
}

/**
 * World-space cells attached outside the initial base rectangle. Do not use
 * `renderCols - baseCols`: custom/large logical surfaces also inflate render
 * bounds, and that would destroy viewport virtualization.
 */
function expansionWorldExtents(topology: BoardRenderTopologyModel): Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const existingKeys = Array.isArray(topology.existingKeys) ? topology.existingKeys : [];
  const baseKeys = Array.isArray(topology.baseKeys) ? topology.baseKeys : [];
  const baseKeySet = baseKeys.length > 0 ? new Set(baseKeys) : null;
  const baseRows = Math.max(1, Math.trunc(finite(topology.baseRows, topology.renderRows)));
  const baseCols = Math.max(1, Math.trunc(finite(topology.baseCols, topology.renderCols)));
  let left = 0;
  let top = 0;
  let right = 0;
  let bottom = 0;
  for (const key of existingKeys) {
    const parsed = parseBoardKey(key);
    if (!parsed) continue;
    const inBase = baseKeySet
      ? baseKeySet.has(key)
      : parsed.row >= 0 && parsed.row < baseRows && parsed.col >= 0 && parsed.col < baseCols;
    if (inBase) continue;
    if (parsed.col < 0) left = Math.max(left, -parsed.col);
    if (parsed.col > baseCols - 1) right = Math.max(right, parsed.col - (baseCols - 1));
    if (parsed.row < 0) top = Math.max(top, -parsed.row);
    if (parsed.row > baseRows - 1) bottom = Math.max(bottom, parsed.row - (baseRows - 1));
  }
  return Object.freeze({ left, top, right, bottom });
}

function expansionScreenGutterPx(
  topology: BoardRenderTopologyModel,
  orientation: BoardViewportLayout['orientation'],
  cellSize: number,
  effectGutterCells: number
): Readonly<{
  left: number;
  top: number;
  right: number;
  bottom: number;
}> {
  const world = expansionWorldExtents(topology);
  const screen = orientation === 'rotated-180'
    ? { left: world.right, right: world.left, top: world.bottom, bottom: world.top }
    : world;
  const effectPx = effectGutterCells * cellSize;
  return Object.freeze({
    left: Math.max(effectPx, screen.left * cellSize),
    top: Math.max(effectPx, screen.top * cellSize),
    right: Math.max(effectPx, screen.right * cellSize),
    bottom: Math.max(effectPx, screen.bottom * cellSize)
  });
}

function normalizedRenderSessionId(value: unknown): string | null {
  const normalized = String(value == null ? '' : value).trim();
  return normalized || null;
}

function stableBoardIdentity(
  topology: BoardRenderTopologyModel,
  renderSessionId: string | null
): string {
  return [
    renderSessionId || 'legacy-render-session',
    Math.max(1, Math.trunc(finite(topology.baseRows, topology.renderRows))),
    Math.max(1, Math.trunc(finite(topology.baseCols, topology.renderCols)))
  ].join(':');
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return Math.max(aMin, bMin) <= Math.min(aMax, bMax);
}

function renderIndex(
  topology: BoardRenderTopologyModel,
  world: number,
  axis: 'row' | 'col',
  orientation: BoardViewportLayout['orientation']
): number {
  if (orientation === 'normal') {
    return world + (axis === 'row' ? topology.renderRowOffset : topology.renderColOffset);
  }
  return (axis === 'row' ? topology.maxRow : topology.maxCol) - world;
}

/**
 * Keeps an already-visible world cell at the same client coordinate when the
 * topology grows or shrinks. The render-index delta also covers a 180-degree
 * viewer orientation, where a world-right expansion is physically left.
 */
export function reconcilePixiBoardCameraScroll(options: {
  previousTopology: BoardRenderTopologyModel | null;
  nextTopology: BoardRenderTopologyModel;
  orientation: BoardViewportLayout['orientation'];
  previousOrientation?: BoardViewportLayout['orientation'];
  cellSize: number;
  scrollLeft: number;
  scrollTop: number;
}): Readonly<{ scrollLeft: number; scrollTop: number }> {
  const previous = options.previousTopology;
  if (!previous || (options.previousOrientation && options.previousOrientation !== options.orientation)) {
    return Object.freeze({
      scrollLeft: Math.max(0, finite(options.scrollLeft)),
      scrollTop: Math.max(0, finite(options.scrollTop))
    });
  }
  const rowOverlap = rangesOverlap(
    previous.minRow,
    previous.maxRow,
    options.nextTopology.minRow,
    options.nextTopology.maxRow
  );
  const colOverlap = rangesOverlap(
    previous.minCol,
    previous.maxCol,
    options.nextTopology.minCol,
    options.nextTopology.maxCol
  );
  const anchorRow = Math.max(previous.minRow, options.nextTopology.minRow);
  const anchorCol = Math.max(previous.minCol, options.nextTopology.minCol);
  const cellSize = positive(options.cellSize);
  const rowDelta = rowOverlap
    ? renderIndex(options.nextTopology, anchorRow, 'row', options.orientation)
      - renderIndex(previous, anchorRow, 'row', options.orientation)
    : 0;
  const colDelta = colOverlap
    ? renderIndex(options.nextTopology, anchorCol, 'col', options.orientation)
      - renderIndex(previous, anchorCol, 'col', options.orientation)
    : 0;
  return Object.freeze({
    scrollLeft: Math.max(0, finite(options.scrollLeft) + colDelta * cellSize),
    scrollTop: Math.max(0, finite(options.scrollTop) + rowDelta * cellSize)
  });
}

function defaultMeasureViewport(viewport: HTMLElement): Readonly<{
  width: number;
  height: number;
  left?: number;
  top?: number;
}> {
  const rect = typeof viewport.getBoundingClientRect === 'function'
    ? viewport.getBoundingClientRect()
    : null;
  return Object.freeze({
    width: positive(viewport.clientWidth || rect?.width || 1),
    height: positive(viewport.clientHeight || rect?.height || 1),
    left: rect && Number.isFinite(rect.left) ? rect.left : undefined,
    top: rect && Number.isFinite(rect.top) ? rect.top : undefined
  });
}

function layoutFingerprint(
  topology: BoardRenderTopologyModel,
  layout: Omit<BoardViewportLayout, 'revision' | 'visibleWorldWindow'>
): string {
  return JSON.stringify([
    topologySignature(topology),
    layout.cellSize,
    layout.dpr,
    layout.stageScale,
    layout.cellScale,
    layout.orientation,
    layout.frameInset,
    layout.clientOrigin,
    layout.visualViewport,
    layout.camera,
    layout.logicalWidth,
    layout.logicalHeight
  ]);
}

function renderLayoutFingerprint(
  topology: BoardRenderTopologyModel,
  layout: Omit<BoardViewportLayout, 'revision' | 'visibleWorldWindow'>
): string {
  return JSON.stringify([
    topologySignature(topology),
    layout.cellSize,
    layout.dpr,
    layout.stageScale,
    layout.cellScale,
    layout.orientation,
    layout.camera,
    layout.logicalWidth,
    layout.logicalHeight
  ]);
}

function removeOwnedElement(element: HTMLElement | null): void {
  if (element && element.parentNode) element.parentNode.removeChild(element);
}

export function createPixiBoardCamera(options: PixiBoardCameraOptions = {}): PixiBoardCamera {
  const effectGutterCells = normalizeEffectGutterCells(options.effectGutterCells);
  const measureViewport = options.measureViewport || defaultMeasureViewport;
  let host: HTMLElement | null = null;
  let viewport: HTMLElement | null = null;
  let surface: HTMLElement | null = null;
  let canvasLayer: HTMLElement | null = null;
  let latestTopology: BoardRenderTopologyModel | null = null;
  let latestSeedLayout: BoardViewportLayout | null = null;
  let layout: BoardViewportLayout | null = null;
  let canvasViewport: PixiBoardCanvasViewport | null = null;
  let stableCellSize: number | null = null;
  let stableIdentity: string | null = null;
  let latestRenderSessionId: string | null = null;
  let revision = 0;
  let fingerprint: string | null = null;
  let renderFingerprint: string | null = null;
  let destroyed = false;
  let resizeObserver: ResizeObserverLike | null = null;
  let resizeObserverActive = false;
  let visualViewportListenerCount = 0;
  let scrollListenerCount = 0;
  let syncing = false;
  let pendingRefreshFrame: unknown = null;
  let pendingRefreshToken = 0;
  let refreshEventCount = 0;
  let refreshApplyCount = 0;
  let refreshCoalescedCount = 0;
  let layoutApplyCount = 0;
  let renderLayoutChangeCount = 0;
  let clientLayoutChangeCount = 0;
  let noopLayoutChangeCount = 0;

  const doc = options.document || (typeof document !== 'undefined' ? document : null);
  const visualViewport = typeof options.visualViewport !== 'undefined'
    ? options.visualViewport
    : (typeof window !== 'undefined' ? window.visualViewport as VisualViewportLike | null : null);
  const createResizeObserver = typeof options.createResizeObserver !== 'undefined'
    ? options.createResizeObserver
    : (typeof ResizeObserver === 'function'
      ? (callback: ResizeObserverCallback) => new ResizeObserver(callback)
      : null);

  const requestFrame = (callback: FrameRequestCallback): unknown => {
    if (options.requestAnimationFrame) return options.requestAnimationFrame(callback);
    const ownerWindow = doc?.defaultView;
    return typeof ownerWindow?.requestAnimationFrame === 'function'
      ? ownerWindow.requestAnimationFrame(callback)
      : null;
  };

  const cancelFrame = (handle: unknown): void => {
    if (handle == null) return;
    if (options.cancelAnimationFrame) {
      options.cancelAnimationFrame(handle);
      return;
    }
    const ownerWindow = doc?.defaultView;
    if (typeof ownerWindow?.cancelAnimationFrame === 'function') {
      ownerWindow.cancelAnimationFrame(Number(handle));
    }
  };

  function assertAlive(): void {
    if (destroyed) throw new Error('PixiBoardCamera is destroyed');
  }

  function readDpr(seed: BoardViewportLayout): number {
    if (typeof options.devicePixelRatio === 'function') return capDpr(options.devicePixelRatio());
    if (typeof options.devicePixelRatio === 'number') return capDpr(options.devicePixelRatio);
    return capDpr(seed.dpr);
  }

  function readVisualViewport(seed: BoardViewportLayout): BoardViewportLayout['visualViewport'] {
    return {
      scale: Math.max(0.01, finite(visualViewport?.scale, seed.visualViewport.scale)),
      offsetLeft: finite(visualViewport?.offsetLeft, seed.visualViewport.offsetLeft),
      offsetTop: finite(visualViewport?.offsetTop, seed.visualViewport.offsetTop)
    };
  }

  function updateCanvasLayer(next: PixiBoardCanvasViewport): void {
    if (!canvasLayer) return;
    canvasLayer.style.left = `${-next.sceneOffsetX}px`;
    canvasLayer.style.top = `${-next.sceneOffsetY}px`;
    canvasLayer.style.width = `${next.width}px`;
    canvasLayer.style.height = `${next.height}px`;
  }

  function applySync(
    topology: BoardRenderTopologyModel,
    seedLayout: BoardViewportLayout,
    renderSessionId: string | null,
    preserveTopologyPosition: boolean
  ): BoardViewportLayout {
    assertAlive();
    if (!viewport || !surface) throw new Error('PixiBoardCamera must be mounted before sync');
    if (syncing && layout) return layout;
    syncing = true;
    try {
      layoutApplyCount += 1;
      const nextStableIdentity = stableBoardIdentity(topology, renderSessionId);
      const continuesStableBoard = stableIdentity === nextStableIdentity;
      if (stableCellSize == null || !continuesStableBoard) {
        stableCellSize = positive(seedLayout.cellSize);
        stableIdentity = nextStableIdentity;
      }
      const cellSize = stableCellSize;
      const measured = measureViewport(viewport);
      const availableViewportWidth = positive(measured.width, seedLayout.camera.viewportWidth);
      const availableViewportHeight = positive(measured.height, seedLayout.camera.viewportHeight);
      const viewportWidth = Math.min(availableViewportWidth, topology.baseCols * cellSize);
      const viewportHeight = Math.min(availableViewportHeight, topology.baseRows * cellSize);
      const logicalWidth = topology.renderCols * cellSize;
      const logicalHeight = topology.renderRows * cellSize;
      // A canonical topology sync must retain the committed camera offsets:
      // Chromium may reset the hidden viewport while direction controls are
      // replaced. A scroll/resize refresh, however, must consume the live DOM
      // offsets so viewport materialization follows that camera movement.
      const rawScrollLeft = continuesStableBoard && layout
        ? (preserveTopologyPosition ? layout.camera.scrollLeft : viewport.scrollLeft)
        : seedLayout.camera.scrollLeft;
      const rawScrollTop = continuesStableBoard && layout
        ? (preserveTopologyPosition ? layout.camera.scrollTop : viewport.scrollTop)
        : seedLayout.camera.scrollTop;
      const reconciled = preserveTopologyPosition && continuesStableBoard
        ? reconcilePixiBoardCameraScroll({
          previousTopology: latestTopology,
          nextTopology: topology,
          orientation: seedLayout.orientation,
          previousOrientation: layout?.orientation,
          cellSize,
          scrollLeft: rawScrollLeft,
          scrollTop: rawScrollTop
        })
        : { scrollLeft: rawScrollLeft, scrollTop: rawScrollTop };

      const surfaceWidth = `${logicalWidth}px`;
      const surfaceHeight = `${logicalHeight}px`;
      if (surface.style.width !== surfaceWidth) surface.style.width = surfaceWidth;
      if (surface.style.height !== surfaceHeight) surface.style.height = surfaceHeight;
      const nextScrollLeft = clamp(reconciled.scrollLeft, 0, Math.max(0, logicalWidth - viewportWidth));
      const nextScrollTop = clamp(reconciled.scrollTop, 0, Math.max(0, logicalHeight - viewportHeight));
      if (viewport.scrollLeft !== nextScrollLeft) viewport.scrollLeft = nextScrollLeft;
      if (viewport.scrollTop !== nextScrollTop) viewport.scrollTop = nextScrollTop;

      // The seed origin belongs to the frame. The measured viewport is the
      // board content origin after frame padding, so subtract that inset when
      // responsive layout or device rotation moves the board without changing
      // its dimensions.
      const measuredLeft = Number(measured.left);
      const measuredTop = Number(measured.top);
      const clientOrigin = {
        x: Number.isFinite(measuredLeft)
          ? measuredLeft - seedLayout.frameInset.left
          : seedLayout.clientOrigin.x,
        y: Number.isFinite(measuredTop)
          ? measuredTop - seedLayout.frameInset.top
          : seedLayout.clientOrigin.y
      };

      const candidateWithoutRevision = {
        cellSize,
        dpr: readDpr(seedLayout),
        stageScale: seedLayout.stageScale,
        cellScale: seedLayout.cellScale,
        orientation: seedLayout.orientation,
        frameInset: seedLayout.frameInset,
        clientOrigin,
        visualViewport: readVisualViewport(seedLayout),
        camera: {
          scrollLeft: nextScrollLeft,
          scrollTop: nextScrollTop,
          viewportWidth,
          viewportHeight
        },
        logicalWidth,
        logicalHeight
      };
      const nextFingerprint = layoutFingerprint(topology, candidateWithoutRevision);
      const nextRenderFingerprint = renderLayoutFingerprint(topology, candidateWithoutRevision);
      if (nextFingerprint === fingerprint && layout && canvasViewport) {
        latestTopology = topology;
        latestSeedLayout = seedLayout;
        latestRenderSessionId = renderSessionId;
        noopLayoutChangeCount += 1;
        return layout;
      }
      revision += 1;
      fingerprint = nextFingerprint;
      const renderLayoutChanged = nextRenderFingerprint !== renderFingerprint;
      renderFingerprint = nextRenderFingerprint;
      const nextLayout = createBoardViewportLayout(topology, {
        revision,
        cellSize,
        dpr: candidateWithoutRevision.dpr,
        stageScale: candidateWithoutRevision.stageScale,
        cellScale: candidateWithoutRevision.cellScale,
        orientation: candidateWithoutRevision.orientation,
        frameInset: candidateWithoutRevision.frameInset,
        clientOrigin: candidateWithoutRevision.clientOrigin,
        visualViewport: candidateWithoutRevision.visualViewport,
        camera: candidateWithoutRevision.camera
      });
      const gutters = expansionScreenGutterPx(
        topology,
        candidateWithoutRevision.orientation,
        cellSize,
        effectGutterCells
      );
      const nextCanvasWidth = viewportWidth + gutters.left + gutters.right;
      const nextCanvasHeight = viewportHeight + gutters.top + gutters.bottom;
      const gutterPx = Math.max(gutters.left, gutters.top, gutters.right, gutters.bottom);
      const canvasViewportChanged = !canvasViewport
        || canvasViewport.width !== nextCanvasWidth
        || canvasViewport.height !== nextCanvasHeight
        || canvasViewport.gutterPx !== gutterPx
        || canvasViewport.sceneOffsetX !== gutters.left
        || canvasViewport.sceneOffsetY !== gutters.top
        || canvasViewport.leftGutterPx !== gutters.left
        || canvasViewport.topGutterPx !== gutters.top
        || canvasViewport.rightGutterPx !== gutters.right
        || canvasViewport.bottomGutterPx !== gutters.bottom;
      const nextCanvasViewport = canvasViewportChanged
        ? Object.freeze({
          width: nextCanvasWidth,
          height: nextCanvasHeight,
          gutterPx,
          sceneOffsetX: gutters.left,
          sceneOffsetY: gutters.top,
          leftGutterPx: gutters.left,
          topGutterPx: gutters.top,
          rightGutterPx: gutters.right,
          bottomGutterPx: gutters.bottom
        })
        : canvasViewport!;
      if (canvasViewportChanged) updateCanvasLayer(nextCanvasViewport);
      latestTopology = topology;
      latestSeedLayout = seedLayout;
      latestRenderSessionId = renderSessionId;
      layout = nextLayout;
      canvasViewport = nextCanvasViewport;
      if (renderLayoutChanged) {
        renderLayoutChangeCount += 1;
        options.onLayoutChange?.(nextLayout, nextCanvasViewport, 'render-space');
      } else {
        clientLayoutChangeCount += 1;
        options.onLayoutChange?.(nextLayout, nextCanvasViewport, 'client-only');
      }
      return nextLayout;
    } finally {
      syncing = false;
    }
  }

  const applyRefresh = (): void => {
    if (!latestTopology || !latestSeedLayout || destroyed) return;
    refreshApplyCount += 1;
    applySync(latestTopology, latestSeedLayout, latestRenderSessionId, false);
  };

  const cancelPendingRefresh = (): void => {
    if (pendingRefreshFrame == null) return;
    const handle = pendingRefreshFrame;
    pendingRefreshFrame = null;
    pendingRefreshToken += 1;
    cancelFrame(handle);
  };

  const queueRefresh = (): void => {
    if (!latestTopology || !latestSeedLayout || destroyed) return;
    refreshEventCount += 1;
    if (pendingRefreshFrame != null) {
      refreshCoalescedCount += 1;
      return;
    }
    const token = ++pendingRefreshToken;
    const handle = requestFrame(() => {
      if (token !== pendingRefreshToken) return;
      pendingRefreshFrame = null;
      applyRefresh();
    });
    if (handle == null) {
      pendingRefreshToken += 1;
      applyRefresh();
      return;
    }
    pendingRefreshFrame = handle;
  };

  const refreshListener: EventListener = () => queueRefresh();

  function mount(nextHost: HTMLElement): HTMLElement {
    assertAlive();
    if (!doc) throw new Error('PixiBoardCamera requires a document');
    if (host) {
      if (host !== nextHost) throw new Error('PixiBoardCamera cannot mount a second host');
      return canvasLayer!;
    }
    if (!nextHost || typeof nextHost.appendChild !== 'function') {
      throw new Error('PixiBoardCamera mount host is unavailable');
    }
    host = nextHost;
    while (host.firstChild) host.removeChild(host.firstChild);

    viewport = doc.createElement('div');
    viewport.id = 'board-scroll-viewport';
    viewport.className = 'pixi-board-scroll-viewport';
    viewport.style.position = 'absolute';
    viewport.style.inset = '0';
    // This element carries programmatic logical scroll offsets for topology
    // reconciliation. It is not player-facing scroll UI: native scrollbar
    // gutters would shrink the camera viewport and shift board/input geometry.
    viewport.style.overflow = 'hidden';
    viewport.style.overscrollBehavior = 'none';

    surface = doc.createElement('div');
    surface.id = 'board-scroll-surface';
    surface.className = 'pixi-board-scroll-surface';
    surface.setAttribute('aria-hidden', 'true');
    surface.style.position = 'relative';
    surface.style.pointerEvents = 'none';
    viewport.appendChild(surface);

    canvasLayer = doc.createElement('div');
    canvasLayer.className = 'pixi-board-canvas-layer';
    canvasLayer.setAttribute('aria-hidden', 'true');
    canvasLayer.style.position = 'absolute';
    canvasLayer.style.pointerEvents = 'auto';
    canvasLayer.style.overflow = 'visible';

    if (!host.style.position || host.style.position === 'static') host.style.position = 'relative';
    host.appendChild(viewport);
    host.appendChild(canvasLayer);

    viewport.addEventListener('scroll', refreshListener, { passive: true });
    scrollListenerCount = 1;
    if (createResizeObserver) {
      resizeObserver = createResizeObserver(queueRefresh);
      resizeObserver.observe(viewport);
      resizeObserverActive = true;
    }
    if (visualViewport) {
      visualViewport.addEventListener('resize', refreshListener);
      visualViewport.addEventListener('scroll', refreshListener);
      visualViewportListenerCount = 2;
    }
    return canvasLayer;
  }

  function sync(
    topology: BoardRenderTopologyModel,
    seedLayout: BoardViewportLayout,
    renderSessionId?: string
  ): BoardViewportLayout {
    if (!topology || !seedLayout) throw new Error('PixiBoardCamera sync requires topology and layout');
    cancelPendingRefresh();
    return applySync(topology, seedLayout, normalizedRenderSessionId(renderSessionId), true);
  }

  function refresh(): BoardViewportLayout | null {
    if (!latestTopology || !latestSeedLayout) return null;
    cancelPendingRefresh();
    refreshApplyCount += 1;
    return applySync(latestTopology, latestSeedLayout, latestRenderSessionId, false);
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    cancelPendingRefresh();
    if (viewport && scrollListenerCount) viewport.removeEventListener('scroll', refreshListener);
    scrollListenerCount = 0;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
    resizeObserverActive = false;
    if (visualViewport && visualViewportListenerCount) {
      visualViewport.removeEventListener('resize', refreshListener);
      visualViewport.removeEventListener('scroll', refreshListener);
    }
    visualViewportListenerCount = 0;
    removeOwnedElement(canvasLayer);
    removeOwnedElement(viewport);
    host = null;
    viewport = null;
    surface = null;
    canvasLayer = null;
    latestTopology = null;
    latestSeedLayout = null;
    layout = null;
    canvasViewport = null;
    stableCellSize = null;
    stableIdentity = null;
    latestRenderSessionId = null;
    fingerprint = null;
    renderFingerprint = null;
  }

  function getDiagnostics(): PixiBoardCameraDiagnostics {
    return Object.freeze({
      mounted: !!host,
      destroyed,
      revision,
      stableCellSize,
      renderSessionId: latestRenderSessionId,
      logicalWidth: layout?.logicalWidth || 0,
      logicalHeight: layout?.logicalHeight || 0,
      viewportWidth: layout?.camera.viewportWidth || 0,
      viewportHeight: layout?.camera.viewportHeight || 0,
      canvasWidth: canvasViewport?.width || 0,
      canvasHeight: canvasViewport?.height || 0,
      effectGutterCells,
      resizeObserverActive,
      visualViewportListenerCount,
      scrollListenerCount,
      pendingRefresh: pendingRefreshFrame !== null,
      refreshEventCount,
      refreshApplyCount,
      refreshCoalescedCount,
      layoutApplyCount,
      renderLayoutChangeCount,
      clientLayoutChangeCount,
      noopLayoutChangeCount
    });
  }

  return Object.freeze({
    mount,
    sync,
    refresh,
    getLayout: () => layout,
    getCanvasViewport: () => canvasViewport,
    getViewportElement: () => viewport,
    getSurfaceElement: () => surface,
    getCanvasLayerElement: () => canvasLayer,
    getCellClientRect: (row: number, col: number) => latestTopology && layout
      ? getCellClientRect(latestTopology, layout, row, col)
      : null,
    getBoardClientRect: () => layout ? getBoardClientRect(layout) : null,
    getDiagnostics,
    destroy
  });
}
