import * as BoardVisualModel from '../../ui/board-visual/model';
import * as Theme from '../../ui/board-visual/theme';

export class FakePoint {
  x = 0;
  y = 0;
  set(x: number, y = x) {
    this.x = x;
    this.y = y;
  }
}

export class FakeDisplayObject {
  label = '';
  name = '';
  parent: FakeDisplayObject | null = null;
  children: FakeDisplayObject[] = [];
  position = new FakePoint();
  scale = new FakePoint();
  anchor = new FakePoint();
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  visible = true;
  alpha = 1;
  eventMode = 'none';
  cursor = 'default';
  hitArea: any = null;
  sortableChildren = false;
  destroyed = false;

  constructor(options?: any) {
    this.label = String(options && options.label || '');
    this.name = this.label;
  }

  addChild(...values: FakeDisplayObject[]) {
    for (const value of values) {
      if (value.parent) value.parent.removeChild(value);
      value.parent = this;
      this.children.push(value);
    }
    return values[0];
  }

  removeChild(value: FakeDisplayObject) {
    const index = this.children.indexOf(value);
    if (index >= 0) this.children.splice(index, 1);
    if (value.parent === this) value.parent = null;
    return value;
  }

  removeChildren() {
    const removed = this.children.slice();
    this.children.length = 0;
    removed.forEach((child) => { child.parent = null; });
    return removed;
  }

  removeFromParent() {
    if (this.parent) this.parent.removeChild(this);
  }

  destroy(options?: { children?: boolean }) {
    if (this.destroyed) return;
    this.removeFromParent();
    if (options && options.children) {
      for (const child of this.removeChildren()) child.destroy({ children: true });
    }
    this.destroyed = true;
  }
}

export class FakeContainer extends FakeDisplayObject {}

export class FakeGraphics extends FakeDisplayObject {
  commands: Array<{ op: string; args?: any[]; style?: any }> = [];
  clear() { this.commands = []; return this; }
  rect(...args: any[]) { this.commands.push({ op: 'rect', args }); return this; }
  roundRect(...args: any[]) { this.commands.push({ op: 'roundRect', args }); return this; }
  circle(...args: any[]) { this.commands.push({ op: 'circle', args }); return this; }
  ellipse(...args: any[]) { this.commands.push({ op: 'ellipse', args }); return this; }
  moveTo(...args: any[]) { this.commands.push({ op: 'moveTo', args }); return this; }
  lineTo(...args: any[]) { this.commands.push({ op: 'lineTo', args }); return this; }
  fill(style: any) { this.commands.push({ op: 'fill', style }); return this; }
  stroke(style: any) { this.commands.push({ op: 'stroke', style }); return this; }
}

export class FakeSprite extends FakeDisplayObject {
  texture: any = null;
  constructor(options?: any) {
    super(options);
    this.texture = options && Object.prototype.hasOwnProperty.call(options, 'texture')
      ? options.texture
      : options;
  }
}

export class FakeText extends FakeDisplayObject {
  text = '';
  style: any = {};
  constructor(options?: any, style?: any) {
    super(options && typeof options === 'object' ? options : undefined);
    this.text = typeof options === 'object' ? String(options.text || '') : String(options || '');
    this.style = typeof options === 'object' ? options.style || {} : style || {};
  }
}

export function renderedGraphicsBounds(root: any, graphics: FakeGraphics): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let pendingPoint: number[] | null = null;
  let maxStrokeWidth = 0;
  const include = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const command of graphics.commands) {
    const args = command.args || [];
    if (command.op === 'rect' || command.op === 'roundRect') {
      include(args[0], args[1]);
      include(args[0] + args[2], args[1] + args[3]);
    } else if (command.op === 'circle') {
      include(args[0] - args[2], args[1] - args[2]);
      include(args[0] + args[2], args[1] + args[2]);
    } else if (command.op === 'ellipse') {
      include(args[0] - args[2], args[1] - args[3]);
      include(args[0] + args[2], args[1] + args[3]);
    } else if (command.op === 'moveTo') {
      pendingPoint = args;
      include(args[0], args[1]);
    } else if (command.op === 'lineTo') {
      if (pendingPoint) include(pendingPoint[0], pendingPoint[1]);
      include(args[0], args[1]);
      pendingPoint = args;
    } else if (command.op === 'stroke') {
      maxStrokeWidth = Math.max(maxStrokeWidth, Number(command.style?.width) || 0);
    }
  }
  const strokePad = maxStrokeWidth / 2;
  minX -= strokePad;
  minY -= strokePad;
  maxX += strokePad;
  maxY += strokePad;
  const pivotX = Number(root.pivot?.x) || 0;
  const pivotY = Number(root.pivot?.y) || 0;
  const scaleX = Number(root.scale?.x) || 1;
  const scaleY = Number(root.scale?.y) || 1;
  const rotation = Number(root.rotation) || 0;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const transformed = [
    [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]
  ].map(([x, y]) => {
    const scaledX = (x - pivotX) * scaleX;
    const scaledY = (y - pivotY) * scaleY;
    return {
      x: root.position.x + scaledX * cos - scaledY * sin,
      y: root.position.y + scaledX * sin + scaledY * cos
    };
  });
  return {
    minX: Math.min(...transformed.map((point) => point.x)),
    minY: Math.min(...transformed.map((point) => point.y)),
    maxX: Math.max(...transformed.map((point) => point.x)),
    maxY: Math.max(...transformed.map((point) => point.y))
  };
}
export function createFakeRuntime() {
  const runtime = {
    Container: FakeContainer,
    Graphics: FakeGraphics,
    Sprite: FakeSprite,
    Text: FakeText,
    Texture: { EMPTY: { id: 'empty' } }
  };
  return { runtime, stage: new FakeContainer({ label: 'stage' }) };
}

export function makeInteraction(overrides: Record<string, any> = {}) {
  return {
    legal: false,
    legalFree: false,
    tabooLegal: false,
    selectable: false,
    interactionLocked: false,
    hovered: false,
    keyboardCursor: false,
    previewKinds: [],
    networkPendingPlacementOwner: null,
    selected: false,
    selectionKinds: [],
    directionHints: [],
    directionHintIds: [],
    localPendingHintIds: [],
    ...overrides
  };
}

export function makeCell(
  key: string,
  options: Record<string, any> = {}
) {
  const [row, col] = key.split(',').map(Number);
  return {
    key,
    row,
    col,
    renderRow: options.renderRow ?? row,
    renderCol: options.renderCol ?? col,
    kind: options.kind || 'playable',
    expansionSide: options.expansionSide || null,
    boundaryEdges: options.boundaryEdges || { top: 'none', right: 'none', bottom: 'none', left: 'none' },
    stone: options.stone || null,
    markers: options.markers || [],
    interaction: makeInteraction(options.interaction)
  };
}

export function rectangleKeys(minRow: number, maxRow: number, minCol: number, maxCol: number): string[] {
  const keys: string[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) keys.push(`${row},${col}`);
  }
  return keys;
}

export function makeTopology(options: {
  baseRows: number;
  baseCols: number;
  minRow?: number;
  maxRow?: number;
  minCol?: number;
  maxCol?: number;
  existingKeys?: string[];
  baseKeys?: string[];
  holeKeys?: string[];
}) {
  const minRow = options.minRow ?? 0;
  const maxRow = options.maxRow ?? options.baseRows - 1;
  const minCol = options.minCol ?? 0;
  const maxCol = options.maxCol ?? options.baseCols - 1;
  const existingKeys = options.existingKeys || rectangleKeys(minRow, maxRow, minCol, maxCol);
  const baseKeys = options.baseKeys || existingKeys.filter((key) => {
    const [row, col] = key.split(',').map(Number);
    return row >= 0 && row < options.baseRows && col >= 0 && col < options.baseCols;
  });
  const holes = new Set(options.holeKeys || []);
  return {
    baseShape: 'rectangle' as const,
    baseRows: options.baseRows,
    baseCols: options.baseCols,
    minRow,
    maxRow,
    minCol,
    maxCol,
    renderRowOffset: -minRow,
    renderColOffset: -minCol,
    renderRows: maxRow - minRow + 1,
    renderCols: maxCol - minCol + 1,
    baseKeys,
    existingKeys,
    playableKeys: existingKeys.filter((key) => !holes.has(key)),
    holeKeys: Array.from(holes)
  };
}

export function makeFrame(options: {
  topology: ReturnType<typeof makeTopology>;
  cells?: any[];
  visibleWindow?: { minRow: number; maxRow: number; minCol: number; maxCol: number };
  orientation?: 'normal' | 'rotated-180';
  cellSize?: number;
  layoutRevision?: number;
  appearanceRevision?: number;
  appearance?: Record<string, unknown>;
  theme?: any;
  modelRevision?: number;
  overlay?: Record<string, unknown>;
}): any {
  const topology = options.topology;
  const holes = new Set(topology.holeKeys);
  const rawCells = options.cells || topology.existingKeys.map((key) => makeCell(key, {
    kind: holes.has(key) ? 'hole' : 'playable',
    renderRow: Number(key.split(',')[0]) + topology.renderRowOffset,
    renderCol: Number(key.split(',')[1]) + topology.renderColOffset
  }));
  const model = BoardVisualModel.createBoardRenderModel({
    boardDigest: 'board.v1.pixi-scene-fixture',
    visualRevision: options.modelRevision || 1,
    topology,
    cells: rawCells,
    overlay: options.overlay
  });
  const cellSize = options.cellSize || 32;
  const visibleWindow = options.visibleWindow || {
    minRow: topology.minRow,
    maxRow: topology.maxRow,
    minCol: topology.minCol,
    maxCol: topology.maxCol
  };
  return {
    frameToken: 'static:1',
    model,
    layout: {
      revision: options.layoutRevision || 1,
      cellSize,
      dpr: 1,
      stageScale: 1,
      cellScale: 1,
      orientation: options.orientation || 'normal',
      frameInset: { top: 0, right: 0, bottom: 0, left: 0 },
      clientOrigin: { x: 0, y: 0 },
      visualViewport: { scale: 1, offsetLeft: 0, offsetTop: 0 },
      camera: {
        scrollLeft: Math.max(0, (visibleWindow.minCol + topology.renderColOffset) * cellSize),
        scrollTop: Math.max(0, (visibleWindow.minRow + topology.renderRowOffset) * cellSize),
        viewportWidth: (visibleWindow.maxCol - visibleWindow.minCol + 1) * cellSize,
        viewportHeight: (visibleWindow.maxRow - visibleWindow.minRow + 1) * cellSize
      },
      logicalWidth: topology.renderCols * cellSize,
      logicalHeight: topology.renderRows * cellSize,
      visibleWorldWindow: visibleWindow
    },
    appearance: {
      boardSkinId: 'board-default',
      boardImageUrl: 'https://example.test/board.png',
      boardFrameSkinId: 'frame-default',
      boardFrameLayout: {},
      stoneSkinId: 'stone-default',
      blackStoneImageUrl: 'https://example.test/black.png',
      whiteStoneImageUrl: 'https://example.test/white.png',
      revision: options.appearanceRevision || 1,
      ...options.appearance
    },
    theme: options.theme || Theme.createBoardVisualThemeDescriptor({ revision: 1 })
  };
}

export function materializedCell(raw: any): any {
  return Object.freeze({
    ...raw,
    visualSignature: JSON.stringify(raw),
    surfaceSignature: JSON.stringify([raw.kind, raw.expansionSide, raw.boundaryEdges, raw.markers, !!raw.stone]),
    stoneSignature: JSON.stringify([raw.kind, raw.stone, raw.markers]),
    hintPaintSignature: JSON.stringify([
      raw.kind,
      raw.interaction.legal,
      raw.interaction.legalFree,
      raw.interaction.tabooLegal,
      raw.interaction.selectable,
      raw.interaction.hovered,
      raw.interaction.keyboardCursor,
      raw.interaction.previewKinds,
      raw.interaction.networkPendingPlacementOwner,
      raw.interaction.selected,
      raw.interaction.selectionKinds,
      raw.interaction.directionHints
    ]),
    hintInputSignature: JSON.stringify([
      raw.kind,
      raw.interaction.legal,
      raw.interaction.legalFree,
      raw.interaction.selectable,
      raw.interaction.directionHints
    ]),
    interactionSignature: JSON.stringify([raw.kind, raw.interaction]),
    ephemeral: false
  });
}

export function viewContext(overrides: Record<string, any> = {}): any {
  const topology = makeTopology({ baseRows: 8, baseCols: 8 });
  const frame = makeFrame({ topology });
  return {
    layout: frame.layout,
    theme: frame.theme,
    surfaceRevisionSignature: 'static-surface:1',
    stoneRevisionSignature: 'static-stone:1',
    interactionRevisionSignature: 'static-interaction:1',
    sceneOffsetX: 64,
    sceneOffsetY: 64,
    sceneX: 96,
    sceneY: 128,
    textures: null,
    ...overrides
  };
}
