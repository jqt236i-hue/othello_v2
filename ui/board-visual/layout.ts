import type {
  BoardClientRect,
  BoardRenderTopologyModel,
  BoardViewportLayout,
  BoardWorldCoordinate,
  BoardWorldWindow
} from './types';

interface CreateBoardViewportLayoutOptions {
  revision?: number;
  cellSize: number;
  dpr?: number;
  stageScale?: number;
  cellScale?: number;
  orientation?: 'normal' | 'rotated-180';
  frameInset?: Partial<BoardViewportLayout['frameInset']>;
  clientOrigin?: Partial<BoardViewportLayout['clientOrigin']>;
  visualViewport?: Partial<BoardViewportLayout['visualViewport']>;
  camera?: Partial<BoardViewportLayout['camera']>;
}

function finite(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizeWorldWindow(windowValue: BoardWorldWindow, topology: BoardRenderTopologyModel): BoardWorldWindow {
  return {
    minRow: clamp(Math.trunc(windowValue.minRow), topology.minRow, topology.maxRow),
    maxRow: clamp(Math.trunc(windowValue.maxRow), topology.minRow, topology.maxRow),
    minCol: clamp(Math.trunc(windowValue.minCol), topology.minCol, topology.maxCol),
    maxCol: clamp(Math.trunc(windowValue.maxCol), topology.minCol, topology.maxCol)
  };
}

function visibleWorldWindow(
  topology: BoardRenderTopologyModel,
  cellSize: number,
  camera: BoardViewportLayout['camera'],
  orientation: BoardViewportLayout['orientation']
): BoardWorldWindow {
  const firstRenderRow = Math.floor(camera.scrollTop / cellSize);
  const firstRenderCol = Math.floor(camera.scrollLeft / cellSize);
  const lastRenderRow = Math.ceil((camera.scrollTop + camera.viewportHeight) / cellSize) - 1;
  const lastRenderCol = Math.ceil((camera.scrollLeft + camera.viewportWidth) / cellSize) - 1;
  const normal = {
    minRow: firstRenderRow - topology.renderRowOffset,
    maxRow: lastRenderRow - topology.renderRowOffset,
    minCol: firstRenderCol - topology.renderColOffset,
    maxCol: lastRenderCol - topology.renderColOffset
  };
  if (orientation === 'normal') return normalizeWorldWindow(normal, topology);
  return normalizeWorldWindow({
    minRow: topology.maxRow - (normal.maxRow - topology.minRow),
    maxRow: topology.maxRow - (normal.minRow - topology.minRow),
    minCol: topology.maxCol - (normal.maxCol - topology.minCol),
    maxCol: topology.maxCol - (normal.minCol - topology.minCol)
  }, topology);
}

export function createBoardViewportLayout(
  topology: BoardRenderTopologyModel,
  options: CreateBoardViewportLayoutOptions
): BoardViewportLayout {
  const cellSize = Math.max(1, finite(options.cellSize, 1));
  const logicalWidth = topology.renderCols * cellSize;
  const logicalHeight = topology.renderRows * cellSize;
  const frameInset = {
    top: finite(options.frameInset?.top),
    right: finite(options.frameInset?.right),
    bottom: finite(options.frameInset?.bottom),
    left: finite(options.frameInset?.left)
  };
  const clientOrigin = {
    x: finite(options.clientOrigin?.x),
    y: finite(options.clientOrigin?.y)
  };
  const visualViewport = {
    scale: Math.max(0.01, finite(options.visualViewport?.scale, 1)),
    offsetLeft: finite(options.visualViewport?.offsetLeft),
    offsetTop: finite(options.visualViewport?.offsetTop)
  };
  const camera = {
    scrollLeft: clamp(finite(options.camera?.scrollLeft), 0, Math.max(0, logicalWidth - finite(options.camera?.viewportWidth, logicalWidth))),
    scrollTop: clamp(finite(options.camera?.scrollTop), 0, Math.max(0, logicalHeight - finite(options.camera?.viewportHeight, logicalHeight))),
    viewportWidth: Math.max(1, finite(options.camera?.viewportWidth, logicalWidth)),
    viewportHeight: Math.max(1, finite(options.camera?.viewportHeight, logicalHeight))
  };
  const orientation = options.orientation === 'rotated-180' ? 'rotated-180' : 'normal';
  return Object.freeze({
    revision: Math.max(0, Math.trunc(finite(options.revision))),
    cellSize,
    dpr: Math.min(2, Math.max(0.1, finite(options.dpr, 1))),
    stageScale: Math.max(0.01, finite(options.stageScale, 1)),
    cellScale: Math.max(0.01, finite(options.cellScale, 1)),
    orientation,
    frameInset: Object.freeze(frameInset),
    clientOrigin: Object.freeze(clientOrigin),
    visualViewport: Object.freeze(visualViewport),
    camera: Object.freeze(camera),
    logicalWidth,
    logicalHeight,
    visibleWorldWindow: Object.freeze(visibleWorldWindow(topology, cellSize, camera, orientation))
  });
}

export function worldToScene(
  topology: BoardRenderTopologyModel,
  layout: BoardViewportLayout,
  row: number,
  col: number
): { x: number; y: number } {
  const renderRow = layout.orientation === 'normal'
    ? row + topology.renderRowOffset
    : topology.maxRow - row;
  const renderCol = layout.orientation === 'normal'
    ? col + topology.renderColOffset
    : topology.maxCol - col;
  return {
    x: renderCol * layout.cellSize - layout.camera.scrollLeft,
    y: renderRow * layout.cellSize - layout.camera.scrollTop
  };
}

export function sceneToWorld(
  topology: BoardRenderTopologyModel,
  layout: BoardViewportLayout,
  x: number,
  y: number
): BoardWorldCoordinate {
  const renderCol = Math.floor((finite(x) + layout.camera.scrollLeft) / layout.cellSize);
  const renderRow = Math.floor((finite(y) + layout.camera.scrollTop) / layout.cellSize);
  if (layout.orientation === 'normal') {
    return { row: renderRow - topology.renderRowOffset, col: renderCol - topology.renderColOffset };
  }
  return { row: topology.maxRow - renderRow, col: topology.maxCol - renderCol };
}

export function getCellClientRect(
  topology: BoardRenderTopologyModel,
  layout: BoardViewportLayout,
  row: number,
  col: number
): BoardClientRect | null {
  if (row < topology.minRow || row > topology.maxRow || col < topology.minCol || col > topology.maxCol) return null;
  const scene = worldToScene(topology, layout, row, col);
  const left = layout.clientOrigin.x + layout.frameInset.left + scene.x - layout.visualViewport.offsetLeft;
  const top = layout.clientOrigin.y + layout.frameInset.top + scene.y - layout.visualViewport.offsetTop;
  return Object.freeze({
    left,
    top,
    right: left + layout.cellSize,
    bottom: top + layout.cellSize,
    width: layout.cellSize,
    height: layout.cellSize,
    layoutRevision: layout.revision
  });
}

export function getBoardClientRect(layout: BoardViewportLayout): BoardClientRect {
  const left = layout.clientOrigin.x + layout.frameInset.left - layout.visualViewport.offsetLeft;
  const top = layout.clientOrigin.y + layout.frameInset.top - layout.visualViewport.offsetTop;
  return Object.freeze({
    left,
    top,
    right: left + layout.camera.viewportWidth,
    bottom: top + layout.camera.viewportHeight,
    width: layout.camera.viewportWidth,
    height: layout.camera.viewportHeight,
    layoutRevision: layout.revision
  });
}
