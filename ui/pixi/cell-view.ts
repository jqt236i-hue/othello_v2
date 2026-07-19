import type {
  BoardVisualTextStyleDescriptor,
  BoardVisualThemeDescriptor,
  BoardViewportLayout,
  MaterializedBoardCellVisualState
} from '../board-visual/types';

export interface PixiStaticViewRuntime {
  readonly Container: new (...args: any[]) => any;
  readonly Graphics: new (...args: any[]) => any;
  readonly Sprite?: new (...args: any[]) => any;
  readonly Text?: new (...args: any[]) => any;
  readonly Texture?: { readonly EMPTY?: unknown };
}

export type PixiStaticTextureSource =
  | ReadonlyMap<string, unknown>
  | Readonly<Record<string, unknown>>
  | { get(purpose: string): unknown };

export type PixiStaticBoardTextureMode = 'none' | 'single-surface' | 'per-cell';

export interface PixiStaticViewContext {
  readonly layout: BoardViewportLayout;
  readonly theme: BoardVisualThemeDescriptor;
  readonly revisionSignature: string;
  readonly sceneOffsetX: number;
  readonly sceneOffsetY: number;
  readonly sceneX: number;
  readonly sceneY: number;
  readonly textures?: PixiStaticTextureSource | null;
  readonly boardTextureMode?: PixiStaticBoardTextureMode;
}

export interface PixiCellViewDiagnostics {
  readonly updateCount: number;
  readonly resetCount: number;
  readonly destroyed: boolean;
  readonly key: string | null;
  readonly kind: MaterializedBoardCellVisualState['kind'] | null;
  readonly markerCount: number;
  readonly renderedMarkerKinds: readonly string[];
  readonly markerLabels: readonly string[];
  readonly theoryNumberStyle: boolean;
  readonly usesBoardTexture: boolean;
  readonly boardFrameHole: boolean;
  readonly boardFrameInnerBoundaryEdges: readonly BoardFrameInnerBoundaryEdge[];
  readonly position: Readonly<{ x: number; y: number }>;
}

export interface PixiCellView {
  readonly surfaceRoot: any;
  readonly cellRoot: any;
  readonly markerRoot: any;
  update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean;
  reset(): void;
  destroy(): void;
  getDiagnostics(): PixiCellViewDiagnostics;
}

function setLabel(target: any, label: string): void {
  if (!target) return;
  target.label = label;
}

export function createPixiContainer(runtime: PixiStaticViewRuntime, label: string): any {
  if (!runtime || typeof runtime.Container !== 'function') throw new Error('Pixi Container runtime is unavailable');
  let container: any;
  try { container = new runtime.Container({ label }); }
  catch (_error) { container = new runtime.Container(); }
  setLabel(container, label);
  return container;
}

export function createPixiGraphics(runtime: PixiStaticViewRuntime, label: string): any {
  if (!runtime || typeof runtime.Graphics !== 'function') throw new Error('Pixi Graphics runtime is unavailable');
  let graphics: any;
  try { graphics = new runtime.Graphics({ label }); }
  catch (_error) { graphics = new runtime.Graphics(); }
  setLabel(graphics, label);
  return graphics;
}

export function createPixiSprite(runtime: PixiStaticViewRuntime, label: string): any | null {
  if (!runtime || typeof runtime.Sprite !== 'function') return null;
  const emptyTexture = runtime.Texture && runtime.Texture.EMPTY;
  let sprite: any;
  try { sprite = new runtime.Sprite({ texture: emptyTexture }); }
  catch (_error) {
    try { sprite = new runtime.Sprite(emptyTexture); }
    catch (_secondError) { sprite = new runtime.Sprite(); }
  }
  setLabel(sprite, label);
  sprite.visible = false;
  return sprite;
}

export function createPixiText(
  runtime: PixiStaticViewRuntime,
  label: string,
  text = '',
  style: Readonly<Record<string, unknown>> = {}
): any | null {
  if (!runtime || typeof runtime.Text !== 'function') return null;
  let display: any;
  try { display = new runtime.Text({ text, style }); }
  catch (_error) {
    try { display = new runtime.Text(text, style); }
    catch (_secondError) { display = new runtime.Text(); }
  }
  setLabel(display, label);
  display.text = text;
  display.style = style;
  return display;
}

export function addPixiChild(parent: any, ...children: any[]): void {
  const filtered = children.filter(Boolean);
  if (!parent || !filtered.length || typeof parent.addChild !== 'function') return;
  parent.addChild(...filtered);
}

export function removePixiFromParent(target: any): void {
  if (!target) return;
  if (typeof target.removeFromParent === 'function') {
    target.removeFromParent();
    return;
  }
  const parent = target.parent || target.parentContainer;
  if (parent && typeof parent.removeChild === 'function') parent.removeChild(target);
}

export function removeAndDestroyPixiChildren(parent: any): void {
  if (!parent) return;
  let children: any[] = [];
  if (typeof parent.removeChildren === 'function') {
    const removed = parent.removeChildren();
    if (Array.isArray(removed)) children = removed;
  } else if (Array.isArray(parent.children)) {
    children = parent.children.slice();
    for (const child of children) {
      if (typeof parent.removeChild === 'function') parent.removeChild(child);
    }
  }
  for (const child of children) {
    if (child && typeof child.destroy === 'function') child.destroy({ children: true });
  }
}

export function destroyPixiDisplayObject(target: any): void {
  if (!target) return;
  removePixiFromParent(target);
  if (typeof target.destroy === 'function') target.destroy({ children: true });
}

export function setPixiPosition(target: any, x: number, y: number): void {
  if (!target) return;
  if (target.position && typeof target.position.set === 'function') target.position.set(x, y);
  else {
    target.x = x;
    target.y = y;
  }
}

export function setPixiAnchor(target: any, x: number, y = x): void {
  if (!target) return;
  if (target.anchor && typeof target.anchor.set === 'function') target.anchor.set(x, y);
  else target.anchor = { x, y };
}

export function setPixiScale(target: any, x: number, y = x): void {
  if (!target) return;
  if (target.scale && typeof target.scale.set === 'function') target.scale.set(x, y);
  else target.scale = { x, y };
}

export function clearPixiGraphics(graphics: any): void {
  if (graphics && typeof graphics.clear === 'function') graphics.clear();
}

interface PixiFillStyle {
  readonly color?: string | number;
  readonly alpha?: number;
  readonly texture?: unknown;
}

interface PixiStrokeStyle extends PixiFillStyle {
  readonly width: number;
}

function applyFill(graphics: any, style: PixiFillStyle): void {
  if (typeof graphics.fill === 'function') graphics.fill(style);
  else if (typeof graphics.beginFill === 'function') {
    graphics.beginFill(style.color, style.alpha);
    if (typeof graphics.endFill === 'function') graphics.endFill();
  }
}

function applyStroke(graphics: any, style: PixiStrokeStyle): void {
  if (typeof graphics.stroke === 'function') graphics.stroke(style);
  else if (typeof graphics.lineStyle === 'function') graphics.lineStyle(style.width, style.color, style.alpha);
}

export function drawPixiRect(
  graphics: any,
  x: number,
  y: number,
  width: number,
  height: number,
  fill?: PixiFillStyle | null,
  stroke?: PixiStrokeStyle | null,
  radius = 0
): void {
  if (!graphics) return;
  const draw = () => {
    if (radius > 0 && typeof graphics.roundRect === 'function') graphics.roundRect(x, y, width, height, radius);
    else if (typeof graphics.rect === 'function') graphics.rect(x, y, width, height);
    else if (typeof graphics.drawRoundedRect === 'function' && radius > 0) graphics.drawRoundedRect(x, y, width, height, radius);
    else if (typeof graphics.drawRect === 'function') graphics.drawRect(x, y, width, height);
  };
  if (fill) {
    draw();
    applyFill(graphics, fill);
  }
  if (stroke) {
    draw();
    applyStroke(graphics, stroke);
  }
}

export function drawPixiCircle(
  graphics: any,
  x: number,
  y: number,
  radius: number,
  fill?: PixiFillStyle | null,
  stroke?: PixiStrokeStyle | null
): void {
  if (!graphics) return;
  const draw = () => {
    if (typeof graphics.circle === 'function') graphics.circle(x, y, radius);
    else if (typeof graphics.drawCircle === 'function') graphics.drawCircle(x, y, radius);
  };
  if (fill) {
    draw();
    applyFill(graphics, fill);
  }
  if (stroke) {
    draw();
    applyStroke(graphics, stroke);
  }
}

export function drawPixiPolygon(
  graphics: any,
  points: readonly Readonly<{ x: number; y: number }>[],
  fill?: PixiFillStyle | null,
  stroke?: PixiStrokeStyle | null
): void {
  if (!graphics || points.length < 3) return;
  const draw = () => {
    const flattened = points.flatMap((point) => [point.x, point.y]);
    if (typeof graphics.poly === 'function') {
      graphics.poly(flattened, true);
      return;
    }
    if (typeof graphics.moveTo !== 'function' || typeof graphics.lineTo !== 'function') return;
    graphics.moveTo(points[0].x, points[0].y);
    for (let index = 1; index < points.length; index += 1) {
      graphics.lineTo(points[index].x, points[index].y);
    }
    graphics.lineTo(points[0].x, points[0].y);
  };
  if (fill) {
    draw();
    applyFill(graphics, fill);
  }
  if (stroke) {
    draw();
    applyStroke(graphics, stroke);
  }
}

export function drawPixiEllipse(
  graphics: any,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  fill?: PixiFillStyle | null,
  stroke?: PixiStrokeStyle | null
): void {
  if (!graphics) return;
  const draw = () => {
    if (typeof graphics.ellipse === 'function') graphics.ellipse(x, y, radiusX, radiusY);
    else if (typeof graphics.drawEllipse === 'function') graphics.drawEllipse(x, y, radiusX, radiusY);
  };
  if (fill) {
    draw();
    applyFill(graphics, fill);
  }
  if (stroke) {
    draw();
    applyStroke(graphics, stroke);
  }
}

export function drawPixiLine(
  graphics: any,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  stroke: PixiStrokeStyle
): void {
  if (!graphics) return;
  if (typeof graphics.moveTo === 'function' && typeof graphics.lineTo === 'function') {
    graphics.moveTo(fromX, fromY);
    graphics.lineTo(toX, toY);
    applyStroke(graphics, stroke);
  }
}

function readTextureSource(source: PixiStaticTextureSource | null | undefined, purpose: string): unknown {
  if (!source) return null;
  if (typeof (source as { get?: unknown }).get === 'function') {
    return (source as { get(key: string): unknown }).get(purpose);
  }
  return (source as Readonly<Record<string, unknown>>)[purpose];
}

/** Accepts both raw Pixi textures and texture-manager resource wrappers. */
export function resolvePixiStaticTexture(
  source: PixiStaticTextureSource | null | undefined,
  purposes: readonly string[]
): unknown | null {
  for (const purpose of purposes) {
    const candidate = readTextureSource(source, purpose);
    if (!candidate) continue;
    if (typeof candidate === 'object' && Object.prototype.hasOwnProperty.call(candidate, 'texture')) {
      return (candidate as { texture: unknown }).texture || null;
    }
    return candidate;
  }
  return null;
}

export function toPixiTextStyle(
  descriptor: BoardVisualTextStyleDescriptor,
  cellSize: number,
  text: string
): Readonly<Record<string, unknown>> {
  const doubleDigitScale = text.length >= 2 ? descriptor.doubleDigitScale : 1;
  const shadow = descriptor.shadows[0] || null;
  return Object.freeze({
    fontFamily: descriptor.fontFamily,
    fontWeight: descriptor.fontWeight,
    fontSize: Math.max(1, cellSize * descriptor.fontSizeRatio * doubleDigitScale),
    lineHeight: Math.max(1, cellSize * descriptor.fontSizeRatio * descriptor.lineHeight),
    fill: descriptor.color,
    align: 'center',
    dropShadow: shadow ? Object.freeze({
      color: shadow.color,
      alpha: 1,
      blur: Math.max(0, cellSize * shadow.blurRatio),
      distance: Math.hypot(shadow.offsetXRatio, shadow.offsetYRatio) * cellSize,
      angle: Math.atan2(shadow.offsetYRatio, shadow.offsetXRatio)
    }) : undefined
  });
}

function markerLabel(marker: MaterializedBoardCellVisualState['markers'][number]): string {
  if (typeof marker.value === 'number' || typeof marker.value === 'string') return String(marker.value);
  const data = marker.data || {};
  for (const key of ['boardBonus', 'remainingOwnerTurns', 'remainingTurns', 'count', 'value']) {
    const value = data[key];
    if (typeof value === 'number' || typeof value === 'string') return String(value);
  }
  return '';
}

function isBoardBonusMarker(kind: unknown): boolean {
  return String(kind || '').trim().toLowerCase().replace(/_/g, '-').includes('board-bonus');
}

const BOARD_FRAME_INNER_BOUNDARY_EDGES = ['top', 'right', 'bottom', 'left'] as const;
export type BoardFrameInnerBoundaryEdge = typeof BOARD_FRAME_INNER_BOUNDARY_EDGES[number];

function isBoardFrameHoleMarker(
  marker: MaterializedBoardCellVisualState['markers'][number]
): boolean {
  if (String(marker && marker.kind || '').trim().toLowerCase().replace(/_/g, '-') !== 'blockade') return false;
  const data = marker && marker.data && typeof marker.data === 'object' ? marker.data : {};
  return String(data.type || '').trim().toUpperCase() === 'METEOR_HOLE'
    && String(data.visualVariant || '').trim().toUpperCase() === 'BOARD_FRAME';
}

function readBoardFrameInnerBoundaryEdges(
  marker: MaterializedBoardCellVisualState['markers'][number] | null
): readonly BoardFrameInnerBoundaryEdge[] {
  if (!marker) return Object.freeze([]);
  const raw = marker.data && marker.data.innerBoundaryMask;
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const allowed = new Set<string>(BOARD_FRAME_INNER_BOUNDARY_EDGES);
  const seen = new Set<string>();
  const edges: BoardFrameInnerBoundaryEdge[] = [];
  for (const value of values) {
    const edge = String(value || '').trim().toLowerCase();
    if (!allowed.has(edge) || seen.has(edge)) continue;
    seen.add(edge);
    edges.push(edge as BoardFrameInnerBoundaryEdge);
  }
  return Object.freeze(edges);
}

function drawClippedBoardFrameGrainLine(
  graphics: any,
  startX: number,
  cellSize: number,
  stroke: PixiStrokeStyle
): void {
  let fromX = startX;
  let fromY = 0;
  let toX = startX + cellSize;
  let toY = cellSize;
  if (fromX < 0) {
    fromY = -fromX;
    fromX = 0;
  }
  if (toX > cellSize) {
    toY -= toX - cellSize;
    toX = cellSize;
  }
  if (fromY > cellSize || toY < 0) return;
  drawPixiLine(graphics, fromX, fromY, toX, toY, stroke);
}

/**
 * Procedural counterpart of the retained DOM board-frame fill. Keep all grain
 * strokes in one direction: this is frame material, never a generic X marker.
 */
export function drawPixiBoardFrameHoleSurface(graphics: any, cellSize: number): void {
  drawPixiRect(graphics, 0, 0, cellSize, cellSize, { color: '#080909', alpha: 1 });
  const bandCount = 10;
  for (let index = 0; index < bandCount; index += 1) {
    const y = (cellSize * index) / bandCount;
    const height = cellSize / bandCount + 0.25;
    drawPixiRect(graphics, 0, y, cellSize, height, {
      color: index % 2 === 0 ? '#2a2b2b' : '#000000',
      alpha: index % 2 === 0 ? 0.17 : 0.12
    });
  }
  const grainSpacing = Math.max(2, cellSize / 12);
  for (let startX = -cellSize; startX < cellSize; startX += grainSpacing) {
    drawClippedBoardFrameGrainLine(graphics, startX, cellSize, {
      color: '#ffffff', alpha: 0.045, width: Math.max(0.5, cellSize * 0.012)
    });
    drawClippedBoardFrameGrainLine(graphics, startX + Math.max(0.5, cellSize * 0.018), cellSize, {
      color: '#000000', alpha: 0.22, width: Math.max(0.5, cellSize * 0.014)
    });
  }
  const vignetteWidth = Math.max(1, cellSize * 0.025);
  drawPixiRect(graphics, vignetteWidth / 2, vignetteWidth / 2, cellSize - vignetteWidth, cellSize - vignetteWidth, null, {
    color: '#000000', alpha: 0.72, width: vignetteWidth
  });
  drawPixiRect(graphics, vignetteWidth * 1.5, vignetteWidth * 1.5, cellSize - vignetteWidth * 3, cellSize - vignetteWidth * 3, null, {
    color: '#000000', alpha: 0.28, width: vignetteWidth * 2
  });
}

export function drawPixiBoardFrameHoleInnerEdges(
  graphics: any,
  cellSize: number,
  edges: readonly BoardFrameInnerBoundaryEdge[]
): void {
  const edgeThickness = Math.max(2, cellSize * 0.0625);
  const highlightWidth = Math.max(0.75, edgeThickness * 0.3);
  const shadowWidth = Math.max(0.75, edgeThickness * 0.42);
  for (const edge of edges) {
    if (edge === 'top' || edge === 'bottom') {
      const y = edge === 'top' ? 0 : cellSize - edgeThickness;
      drawPixiRect(graphics, 0, y, cellSize, edgeThickness, { color: '#000000', alpha: 0.42 });
      const highlightY = edge === 'top' ? highlightWidth / 2 : cellSize - highlightWidth / 2;
      const shadowY = edge === 'top'
        ? edgeThickness - shadowWidth / 2
        : cellSize - edgeThickness + shadowWidth / 2;
      drawPixiLine(graphics, 0, highlightY, cellSize, highlightY, {
        color: '#ffffff', alpha: edge === 'top' ? 0.22 : 0.18, width: highlightWidth
      });
      drawPixiLine(graphics, 0, shadowY, cellSize, shadowY, {
        color: '#000000', alpha: 0.62, width: shadowWidth
      });
      continue;
    }
    const x = edge === 'left' ? 0 : cellSize - edgeThickness;
    drawPixiRect(graphics, x, 0, edgeThickness, cellSize, { color: '#000000', alpha: 0.42 });
    const highlightX = edge === 'left' ? highlightWidth / 2 : cellSize - highlightWidth / 2;
    const shadowX = edge === 'left'
      ? edgeThickness - shadowWidth / 2
      : cellSize - edgeThickness + shadowWidth / 2;
    drawPixiLine(graphics, highlightX, 0, highlightX, cellSize, {
      color: '#ffffff', alpha: 0.22, width: highlightWidth
    });
    drawPixiLine(graphics, shadowX, 0, shadowX, cellSize, {
      color: '#000000', alpha: 0.62, width: shadowWidth
    });
  }
}

const CELL_MARKER_KINDS = new Set(['board-bonus', 'blockade', 'seed', 'poison-cell']);

export function createPixiCellView(runtime: PixiStaticViewRuntime): PixiCellView {
  const surfaceRoot = createPixiContainer(runtime, 'pixi-cell-surface');
  const cellRoot = createPixiContainer(runtime, 'pixi-cell-grid');
  const markerRoot = createPixiContainer(runtime, 'pixi-cell-markers');
  const surface = createPixiGraphics(runtime, 'pixi-cell-surface-fill');
  const surfaceTexture = createPixiSprite(runtime, 'pixi-cell-surface-texture');
  const boardFrameHoleSurface = createPixiGraphics(runtime, 'pixi-cell-board-frame-hole-surface');
  const boardFrameHoleInnerEdges = createPixiGraphics(runtime, 'pixi-cell-board-frame-hole-inner-edges');
  const grid = createPixiGraphics(runtime, 'pixi-cell-grid-lines');
  addPixiChild(surfaceRoot, surface, surfaceTexture, boardFrameHoleSurface, boardFrameHoleInnerEdges);
  addPixiChild(cellRoot, grid);
  let signature: string | null = null;
  let key: string | null = null;
  let kind: MaterializedBoardCellVisualState['kind'] | null = null;
  let markerLabels: string[] = [];
  let renderedMarkerKinds: string[] = [];
  let theoryNumberStyle = false;
  let usesBoardTexture = false;
  let boardFrameHole = false;
  let boardFrameInnerBoundaryEdges: readonly BoardFrameInnerBoundaryEdge[] = Object.freeze([]);
  let updateCount = 0;
  let resetCount = 0;
  let destroyed = false;
  let position = { x: 0, y: 0 };

  function assertAlive(): void {
    if (destroyed) throw new Error('PixiCellView is destroyed');
  }

  function update(cell: MaterializedBoardCellVisualState, context: PixiStaticViewContext): boolean {
    assertAlive();
    const nextSignature = `${context.revisionSignature}|${cell.visualSignature}`;
    if (signature === nextSignature) return false;
    signature = nextSignature;
    key = cell.key;
    kind = cell.kind;
    updateCount += 1;
    const cellSize = context.layout.cellSize;
    position = {
      x: context.sceneX,
      y: context.sceneY
    };
    setPixiPosition(surfaceRoot, position.x, position.y);
    setPixiPosition(cellRoot, position.x, position.y);
    setPixiPosition(markerRoot, position.x, position.y);
    surfaceRoot.visible = cell.kind !== 'void';
    cellRoot.visible = cell.kind !== 'void';
    markerRoot.visible = cell.kind !== 'void';
    clearPixiGraphics(surface);
    clearPixiGraphics(boardFrameHoleSurface);
    clearPixiGraphics(boardFrameHoleInnerEdges);
    clearPixiGraphics(grid);
    removeAndDestroyPixiChildren(markerRoot);
    markerLabels = [];
    renderedMarkerKinds = [];
    theoryNumberStyle = cell.markers.some((marker) => marker.kind === 'theory-number-cell');
    usesBoardTexture = false;
    const boardFrameHoleMarker = cell.kind === 'hole'
      ? cell.markers.find(isBoardFrameHoleMarker) || null
      : null;
    boardFrameHole = !!boardFrameHoleMarker;
    boardFrameInnerBoundaryEdges = readBoardFrameInnerBoundaryEdges(boardFrameHoleMarker);
    boardFrameHoleSurface.visible = boardFrameHole;
    boardFrameHoleInnerEdges.visible = boardFrameHole;
    grid.visible = !boardFrameHole;

    if (cell.kind === 'void') {
      if (surfaceTexture) surfaceTexture.visible = false;
      return true;
    }

    const shouldUseCellBoardTexture = typeof context.boardTextureMode === 'undefined'
      || context.boardTextureMode === 'per-cell'
      || (context.boardTextureMode === 'single-surface' && cell.expansionSide !== null);
    const boardTexture = cell.kind === 'hole'
      ? null
      : shouldUseCellBoardTexture
      ? resolvePixiStaticTexture(context.textures, ['board'])
      : null;
    drawPixiRect(surface, 0, 0, cellSize, cellSize, {
      color: cell.kind === 'hole' ? '#000000' : context.theme.surfaceColor,
      alpha: cell.kind === 'hole'
        ? 1
        : context.boardTextureMode === 'single-surface' && cell.expansionSide === null
          ? 0
          : 1
    });
    if (surfaceTexture) {
      usesBoardTexture = !!boardTexture;
      surfaceTexture.visible = !!boardTexture;
      if (boardTexture) surfaceTexture.texture = boardTexture;
      surfaceTexture.x = 0;
      surfaceTexture.y = 0;
      surfaceTexture.width = cellSize;
      surfaceTexture.height = cellSize;
    }
    if (boardFrameHole) {
      drawPixiBoardFrameHoleSurface(boardFrameHoleSurface, cellSize);
      drawPixiBoardFrameHoleInnerEdges(boardFrameHoleInnerEdges, cellSize, boardFrameInnerBoundaryEdges);
    }

    const gridWidth = Math.max(0.5, context.theme.gridLineWidth);
    const gridInset = gridWidth / 2;
    if (cell.kind === 'playable') {
      // Mirror the retained DOM cell's vertical surface gradient. Two
      // premultiplied low-alpha bands approximate the CSS interpolation while
      // keeping the texture itself a single shared board sprite.
      const surfaceBands = 11;
      for (let index = 0; index < surfaceBands; index += 1) {
        const t = (index + 0.5) / surfaceBands;
        const y = (cellSize * index) / surfaceBands;
        const height = cellSize / surfaceBands + 0.25;
        const warmAlpha = 0.022 * (1 - t);
        const shadeAlpha = 0.065 * t;
        if (warmAlpha > 0) {
          drawPixiRect(grid, 0, y, cellSize, height, {
            color: '#fff7ce', alpha: warmAlpha
          });
        }
        if (shadeAlpha > 0) {
          drawPixiRect(grid, 0, y, cellSize, height, {
            color: '#000000', alpha: shadeAlpha
          });
        }
      }
    }
    // DOM cells use a dark top/left bevel and a faint warm right/bottom
    // bevel. Keep both one-cell-local so adjacent cells retain the same
    // two-sided grid instead of collapsing it into one canvas stroke.
    drawPixiLine(grid, 0, gridInset, cellSize, gridInset, {
      color: 'rgba(4, 12, 12, 0.54)',
      alpha: 1,
      width: gridWidth
    });
    drawPixiLine(grid, gridInset, 0, gridInset, cellSize, {
      color: 'rgba(4, 12, 12, 0.58)',
      alpha: 1,
      width: gridWidth
    });
    drawPixiLine(grid, cellSize - gridInset, 0, cellSize - gridInset, cellSize, {
      color: 'rgba(230, 187, 104, 0.18)',
      alpha: 1,
      width: gridWidth
    });
    drawPixiLine(grid, 0, cellSize - gridInset, cellSize, cellSize - gridInset, {
      color: 'rgba(230, 187, 104, 0.14)',
      alpha: 1,
      width: gridWidth
    });
    drawPixiLine(grid, 0, Math.max(gridInset, cellSize - gridWidth * 1.5), cellSize, Math.max(gridInset, cellSize - gridWidth * 1.5), {
      color: '#000000', alpha: 0.18, width: gridWidth
    });
    const boundaryWidth = Math.max(gridWidth, cellSize * 0.045);
    const boundaryInset = boundaryWidth / 2;
    const edgeLines: Record<string, readonly [number, number, number, number]> = {
      top: [0, boundaryInset, cellSize, boundaryInset],
      right: [cellSize - boundaryInset, 0, cellSize - boundaryInset, cellSize],
      bottom: [0, cellSize - boundaryInset, cellSize, cellSize - boundaryInset],
      left: [boundaryInset, 0, boundaryInset, cellSize]
    };
    for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
      const boundary = cell.boundaryEdges[edge];
      if (boundary === 'none') continue;
      // DOM meteor holes retain an ordinary dark cell/grid; they do not add
      // a second red contour. A complete rectangular board likewise relies
      // on the retained DOM frame art instead of a CSS contour around cells.
      if (boundary === 'hole') continue;
      if (boundary === 'outer'
        && context.boardTextureMode === 'single-surface'
        && cell.expansionSide === null) continue;
      const [fromX, fromY, toX, toY] = edgeLines[edge];
      drawPixiLine(grid, fromX, fromY, toX, toY, {
        color: context.theme.outerBoundaryColor,
        alpha: 1,
        width: boundaryWidth
      });
    }

    let badgeIndex = 0;
    for (const marker of cell.markers) {
      if (!CELL_MARKER_KINDS.has(marker.kind)) continue;
      // The board-frame material is the complete visual for this blockade.
      // Keeping the generic badge would diverge from the DOM mark and resemble
      // a second effect layered over the hole.
      if (marker === boardFrameHoleMarker) continue;
      if (marker.kind === 'seed' && cell.stone) continue;
      const label = markerLabel(marker);
      markerLabels.push(label);
      renderedMarkerKinds.push(marker.kind);
      if (isBoardBonusMarker(marker.kind) && label) {
        const text = createPixiText(
          runtime,
          `pixi-marker-board-bonus:${marker.kind}`,
          label,
          toPixiTextStyle(context.theme.boardBonus, cellSize, label)
        );
        if (text) {
          setPixiAnchor(text, 0.5);
          setPixiPosition(text, cellSize / 2, cellSize / 2);
          addPixiChild(markerRoot, text);
        }
        continue;
      }
      const radius = Math.max(2, cellSize * 0.075);
      const centerX = cellSize * (0.16 + (badgeIndex % 4) * 0.22);
      const centerY = cellSize * 0.16;
      badgeIndex += 1;
      const dot = createPixiGraphics(runtime, `pixi-marker-dot:${marker.kind}`);
      drawPixiCircle(dot, centerX, centerY, radius, {
        color: context.theme.markerColor,
        alpha: 0.86
      }, {
        color: context.theme.outerBoundaryColor,
        alpha: 0.9,
        width: Math.max(1, cellSize * 0.015)
      });
      addPixiChild(markerRoot, dot);
      if (label) {
        const text = createPixiText(
          runtime,
          `pixi-marker-label:${marker.kind}`,
          label,
          toPixiTextStyle(context.theme.timer, cellSize * 0.72, label)
        );
        if (text) {
          setPixiAnchor(text, 0.5);
          setPixiPosition(text, centerX, centerY);
          addPixiChild(markerRoot, text);
        }
      }
    }
    return true;
  }

  function reset(): void {
    if (destroyed) return;
    signature = null;
    key = null;
    kind = null;
    markerLabels = [];
    renderedMarkerKinds = [];
    theoryNumberStyle = false;
    usesBoardTexture = false;
    boardFrameHole = false;
    boardFrameInnerBoundaryEdges = Object.freeze([]);
    position = { x: 0, y: 0 };
    surfaceRoot.visible = false;
    cellRoot.visible = false;
    markerRoot.visible = false;
    clearPixiGraphics(surface);
    clearPixiGraphics(boardFrameHoleSurface);
    clearPixiGraphics(boardFrameHoleInnerEdges);
    clearPixiGraphics(grid);
    boardFrameHoleSurface.visible = false;
    boardFrameHoleInnerEdges.visible = false;
    grid.visible = true;
    if (surfaceTexture) surfaceTexture.visible = false;
    removeAndDestroyPixiChildren(markerRoot);
    removePixiFromParent(surfaceRoot);
    removePixiFromParent(cellRoot);
    removePixiFromParent(markerRoot);
    resetCount += 1;
  }

  function destroy(): void {
    if (destroyed) return;
    reset();
    destroyed = true;
    destroyPixiDisplayObject(surfaceRoot);
    destroyPixiDisplayObject(cellRoot);
    destroyPixiDisplayObject(markerRoot);
  }

  function getDiagnostics(): PixiCellViewDiagnostics {
    return Object.freeze({
      updateCount,
      resetCount,
      destroyed,
      key,
      kind,
      markerCount: markerLabels.length,
      renderedMarkerKinds: Object.freeze(renderedMarkerKinds.slice()),
      markerLabels: Object.freeze(markerLabels.slice()),
      theoryNumberStyle,
      usesBoardTexture,
      boardFrameHole,
      boardFrameInnerBoundaryEdges: Object.freeze(boardFrameInnerBoundaryEdges.slice()),
      position: Object.freeze({ ...position })
    });
  }

  return Object.freeze({ surfaceRoot, cellRoot, markerRoot, update, reset, destroy, getDiagnostics });
}
