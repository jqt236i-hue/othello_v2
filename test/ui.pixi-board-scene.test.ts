import * as fs from 'fs';
import * as path from 'path';

import * as BoardVisualModel from '../ui/board-visual/model';
import * as EffectBounds from '../ui/board-visual/effect-bounds';
import * as Theme from '../ui/board-visual/theme';
import * as BoardScene from '../ui/pixi/board-scene';
import * as CellView from '../ui/pixi/cell-view';
import * as StoneView from '../ui/pixi/stone-view';
import * as HintView from '../ui/pixi/hint-view';

class FakePoint {
  x = 0;
  y = 0;
  set(x: number, y = x) {
    this.x = x;
    this.y = y;
  }
}

class FakeDisplayObject {
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

class FakeContainer extends FakeDisplayObject {}

class FakeGraphics extends FakeDisplayObject {
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

class FakeSprite extends FakeDisplayObject {
  texture: any = null;
  constructor(options?: any) {
    super(options);
    this.texture = options && Object.prototype.hasOwnProperty.call(options, 'texture')
      ? options.texture
      : options;
  }
}

class FakeText extends FakeDisplayObject {
  text = '';
  style: any = {};
  constructor(options?: any, style?: any) {
    super(options && typeof options === 'object' ? options : undefined);
    this.text = typeof options === 'object' ? String(options.text || '') : String(options || '');
    this.style = typeof options === 'object' ? options.style || {} : style || {};
  }
}

function renderedGraphicsBounds(root: any, graphics: FakeGraphics): {
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

function createFakeRuntime() {
  const runtime = {
    Container: FakeContainer,
    Graphics: FakeGraphics,
    Sprite: FakeSprite,
    Text: FakeText,
    Texture: { EMPTY: { id: 'empty' } }
  };
  return { runtime, stage: new FakeContainer({ label: 'stage' }) };
}

function makeInteraction(overrides: Record<string, any> = {}) {
  return {
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
    localPendingHintIds: [],
    ...overrides
  };
}

function makeCell(
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

function rectangleKeys(minRow: number, maxRow: number, minCol: number, maxCol: number): string[] {
  const keys: string[] = [];
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) keys.push(`${row},${col}`);
  }
  return keys;
}

function makeTopology(options: {
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

function makeFrame(options: {
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

function materializedCell(raw: any): any {
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
      raw.interaction.selected,
      raw.interaction.selectionKinds,
      raw.interaction.directionHints
    ]),
    hintInputSignature: JSON.stringify([
      raw.kind,
      raw.interaction.legal,
      raw.interaction.legalFree,
      raw.interaction.selectable,
      raw.interaction.interactionLocked,
      raw.interaction.directionHints
    ]),
    interactionSignature: JSON.stringify([raw.kind, raw.interaction]),
    ephemeral: false
  });
}

function viewContext(overrides: Record<string, any> = {}): any {
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

describe('Pixi static retained views', () => {
  test('routes cell markers and stone markers to one visual owner without duplicates', () => {
    const fixture = createFakeRuntime();
    const cellView = CellView.createPixiCellView(fixture.runtime);
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const markers = [
      { kind: 'special', owner: 'black', value: null, data: { type: 'ZOMBIE' } },
      { kind: 'guard', owner: 'black', value: null, data: { remainingOwnerTurns: 4 } },
      { kind: 'breeding-sprout', owner: 'black', value: true, data: { active: true } },
      { kind: 'board-bonus', owner: null, value: 12, data: {} },
      { kind: 'theory-number-cell', owner: null, value: true, data: { active: true } },
      { kind: 'poison-cell', owner: null, value: null, data: { remainingTurns: 3 } }
    ];
    const raw = makeCell('1,1', {
      stone: {
        owner: 'black',
        value: 1,
        specialType: 'ZOMBIE',
        status: { remainingOwnerTurns: 10, regenRemaining: 2 }
      },
      markers
    });
    const cell = materializedCell(raw);
    const blackTexture = { id: 'black-texture' };
    const context = viewContext({
      textures: new Map([['special-stone:ZOMBIE:black', { texture: blackTexture }]])
    });

    expect(cellView.update(cell, context)).toBe(true);
    expect(stoneView.update(cell, context)).toBe(true);
    expect(cellView.update(cell, context)).toBe(false);
    expect(stoneView.update(cell, context)).toBe(false);

    expect(cellView.getDiagnostics()).toMatchObject({
      markerCount: 2,
      renderedMarkerKinds: ['board-bonus', 'poison-cell'],
      markerLabels: ['12', '3'],
      theoryNumberStyle: true
    });
    const poisonSurface = cellView.surfaceRoot.children.find((child: any) => (
      child.label === 'pixi-cell-poison-surface'
    ));
    expect(poisonSurface).toMatchObject({ visible: true });
    expect(poisonSurface.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#6b2b91' }) })
    ]));
    const poisonCorner = cellView.markerRoot.children.find((child: any) => (
      child.label === 'pixi-marker-poison-cell-corner'
    ));
    expect(poisonCorner).toBeDefined();
    expect(poisonCorner.commands.some((command: any) => command.op === 'stroke')).toBe(false);
    expect(stoneView.getDiagnostics()).toMatchObject({
      owner: 'black',
      specialType: 'ZOMBIE',
      timerLabel: '10',
      badgeLabel: '2',
      statusLabels: [
        { kind: 'countdown', value: '10' },
        { kind: 'regen', value: '2' },
        { kind: 'guard', value: '4' }
      ],
      textureBacked: true,
      texturePurpose: 'special-stone:ZOMBIE:black',
      renderedMarkerKinds: ['special', 'guard', 'breeding-sprout']
    });
    const overlap = cellView.getDiagnostics().renderedMarkerKinds.filter((kind) => (
      stoneView.getDiagnostics().renderedMarkerKinds.includes(kind)
    ));
    expect(overlap).toEqual([]);
  });

  test('renders legal/target/preview/keyboard/direction DTOs without deriving authority', () => {
    const fixture = createFakeRuntime();
    const hintView = HintView.createPixiHintView(fixture.runtime);
    const cell = materializedCell(makeCell('2,3', {
      interaction: {
        legal: true,
        legalFree: true,
        selectable: true,
        selected: true,
        hovered: true,
        keyboardCursor: true,
        previewKinds: ['random-spawn'],
        selectionKinds: ['enemy-target'],
        directionHints: [
          { id: 'up-left', kind: 'board-expansion-will', directionKey: 'up-left' },
          { id: 'right', kind: 'board-shrink-will', directionKey: 'right' }
        ],
        directionHintIds: ['up-left', 'right']
      }
    }));
    const context = viewContext();

    expect(hintView.update(cell, context)).toBe(true);
    expect(hintView.update(cell, context)).toBe(false);
    expect(hintView.getDiagnostics()).toMatchObject({
      updateCount: 1,
      hintPaintCount: 1,
      hintInputSyncCount: 1,
      legal: true,
      selectable: true,
      selected: true,
      hovered: true,
      keyboardCursor: true,
      previewKinds: ['random-spawn'],
      selectionKinds: ['enemy-target'],
      directionKeys: ['up-left', 'right'],
      interactionLocked: false
    });
    expect(hintView.interactionRoot.eventMode).toBe('static');
    expect(hintView.interactionRoot.cursor).toBe('pointer');
    expect(hintView.interactionRoot.position).toMatchObject({ x: 32, y: 64 });
    expect(hintView.interactionRoot.hitArea).toMatchObject({ x: 0, y: 0, width: 32, height: 32 });
    expect(hintView.interactionRoot.hitArea.contains(0, 0)).toBe(true);
    expect(hintView.interactionRoot.hitArea.contains(31.99, 31.99)).toBe(true);
    expect(hintView.interactionRoot.hitArea.contains(32, 16)).toBe(false);
  });

  test('syncs lock-only input state without repainting hint Graphics', () => {
    const fixture = createFakeRuntime();
    const hintView = HintView.createPixiHintView(fixture.runtime);
    const unlocked = materializedCell(makeCell('2,3', {
      interaction: { legal: true, hovered: true }
    }));
    const locked = materializedCell(makeCell('2,3', {
      interaction: { legal: true, hovered: true, interactionLocked: true }
    }));
    const context = viewContext();

    expect(hintView.updateDetailed(unlocked, context)).toEqual({
      changed: true,
      painted: true,
      inputSynced: true
    });
    const paintedCommands = (hintView.root as FakeGraphics).commands.slice();
    const surfaceCommands = (hintView.surfaceRoot as FakeGraphics).commands.slice();

    expect(hintView.updateDetailed(locked, context)).toEqual({
      changed: true,
      painted: false,
      inputSynced: true
    });
    expect((hintView.root as FakeGraphics).commands).toEqual(paintedCommands);
    expect((hintView.surfaceRoot as FakeGraphics).commands).toEqual(surfaceCommands);
    expect(hintView.interactionRoot).toMatchObject({
      eventMode: 'static',
      cursor: 'default'
    });
    expect(hintView.getDiagnostics()).toMatchObject({
      updateCount: 2,
      hintPaintCount: 1,
      hintInputSyncCount: 2,
      interactionLocked: true
    });
  });

  test('keeps selectable-stone surface tint behind the stone while retaining foreground cues', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key));
    const target = cells.find((cell) => cell.key === '2,2')!;
    target.stone = { owner: 'black', value: 1, specialType: null, status: {} };
    target.interaction = {
      ...target.interaction,
      selectable: true,
      hovered: true,
      selectionKinds: ['friendly']
    };

    scene.applyFrame(makeFrame({ topology, cells }));
    const targetPosition = scene.getRenderedCell(2, 2)!.position;

    const surface = scene.layers.cell.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-cell-hint-surface'
      && child.position.x === targetPosition.x
      && child.position.y === targetPosition.y
    )) as FakeGraphics;
    const foreground = scene.layers.hint.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-hint-view'
      && child.position.x === targetPosition.x
      && child.position.y === targetPosition.y
    )) as FakeGraphics;
    expect(surface.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({
        op: 'fill',
        style: expect.objectContaining({ color: '#0e7e6f', alpha: 0.38 })
      })
    ]));
    expect(scene.layers.stone.children).toHaveLength(1);
    expect(scene.root.children.indexOf(scene.layers.cell)).toBeLessThan(
      scene.root.children.indexOf(scene.layers.stone)
    );
    expect(scene.root.children.indexOf(scene.layers.stone)).toBeLessThan(
      scene.root.children.indexOf(scene.layers.hint)
    );
    expect(foreground.commands.some((command) => command.op === 'fill')).toBe(false);
  });

  test('removes Pixi cell hit ownership for holes and reset views', () => {
    const fixture = createFakeRuntime();
    const hintView = HintView.createPixiHintView(fixture.runtime);
    const hole = materializedCell(makeCell('2,3', { kind: 'hole' }));

    hintView.update(hole, viewContext());
    expect(hintView.interactionRoot).toMatchObject({ eventMode: 'none', hitArea: null });

    const playable = materializedCell(makeCell('2,3', { interaction: { legal: true } }));
    hintView.update(playable, viewContext({ interactionRevisionSignature: 'static-interaction:playable' }));
    expect(hintView.interactionRoot).toMatchObject({ eventMode: 'static' });

    hintView.reset();
    expect(hintView.interactionRoot).toMatchObject({ eventMode: 'none', hitArea: null });
  });

  test('shows procedural normal/special fallbacks and keeps breeding sprouts as normal-stone overlays', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const plain = materializedCell(makeCell('0,0', {
      stone: { owner: 'black', value: 1, specialType: null, status: {} }
    }));
    stoneView.update(plain, viewContext());
    expect((stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-shadow'
    )) as FakeGraphics).commands.filter((command) => command.op === 'ellipse')).toHaveLength(12);

    const normal = materializedCell(makeCell('0,0', {
      stone: { owner: 'white', value: -1, specialType: 'GUARD', status: { remainingOwnerTurns: 12 } }
    }));

    stoneView.update(normal, viewContext({ stoneRevisionSignature: 'static-stone:2' }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      owner: 'white',
      specialType: 'GUARD',
      timerLabel: '12',
      flipProtectionBadgeVisible: true,
      textureBacked: false
    });
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-flip-protection-badge'
    ))).toMatchObject({
      visible: true,
      text: '反',
      position: { x: 24, y: 17 }
    });

    const whiteTexture = { id: 'white-stone-texture' };
    const breedingTexture = { id: 'breeding-stone-texture' };
    const sproutTextures = new Map([
      ['white-stone', { texture: whiteTexture }],
      ['special-stone:BREEDING:white', { texture: breedingTexture }]
    ]);
    const sprout = materializedCell(makeCell('0,1', {
      stone: { owner: 'white', value: -1, specialType: null, status: {} },
      markers: [{ kind: 'breeding-sprout', owner: null, value: true, data: { active: true, type: 'BREEDING' } }]
    }));
    stoneView.update(sprout, viewContext({
      stoneRevisionSignature: 'static-stone:3',
      textures: sproutTextures
    }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      specialType: null,
      textureBacked: true,
      texturePurpose: 'white-stone',
      renderedMarkerKinds: ['breeding-sprout']
    });
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-texture'
    ))).toMatchObject({ texture: whiteTexture });
    const sproutOverlay = stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-special-ring'
    )) as FakeGraphics;
    expect(sproutOverlay.commands.filter((command) => command.op === 'lineTo')).toHaveLength(1);
    expect(sproutOverlay.commands.filter((command) => command.op === 'circle')).toHaveLength(2);

    const breedingAnchor = materializedCell(makeCell('0,2', {
      stone: { owner: 'white', value: -1, specialType: 'BREEDING', status: { remainingOwnerTurns: 5 } },
      markers: [{
        kind: 'special', owner: 'white', value: null,
        data: { type: 'BREEDING', remainingOwnerTurns: 5 }
      }]
    }));
    stoneView.update(breedingAnchor, viewContext({
      stoneRevisionSignature: 'static-stone:4',
      textures: sproutTextures
    }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      specialType: 'BREEDING',
      timerLabel: '5',
      textureBacked: true,
      texturePurpose: 'special-stone:BREEDING:white',
      renderedMarkerKinds: ['special']
    });
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-texture'
    ))).toMatchObject({ texture: breedingTexture });

    const orphanSprout = materializedCell(makeCell('0,3', {
      markers: [{ kind: 'breeding-sprout', owner: 'white', value: true, data: { active: true } }]
    }));
    stoneView.update(orphanSprout, viewContext({ stoneRevisionSignature: 'static-stone:5' }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: false,
      specialType: null,
      textureBacked: false,
      renderedMarkerKinds: ['breeding-sprout']
    });

    const seedView = CellView.createPixiCellView(fixture.runtime);
    const seed = materializedCell(makeCell('0,4', {
      markers: [{ kind: 'seed', owner: 'white', value: null, data: { remainingOwnerTurns: 2 } }]
    }));
    seedView.update(seed, viewContext({ stoneRevisionSignature: 'static-stone:6' }));
    expect(seedView.getDiagnostics()).toMatchObject({
      markerCount: 1,
      markerLabels: ['2'],
      renderedMarkerKinds: ['seed']
    });
  });

  test('keeps simultaneous stone status labels in deterministic slots and order', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    const cell = materializedCell(makeCell('3,4', {
      stone: {
        owner: 'black',
        value: 1,
        specialType: 'ZOMBIE',
        status: {
          remainingOwnerTurns: 12,
          regenRemaining: 11,
          flipEvadeRemaining: 10,
          destroyEvadeRemaining: 9
        }
      },
      markers: [
        { kind: 'special', owner: 'black', value: null, data: { type: 'ZOMBIE' } },
        { kind: 'bomb', owner: 'black', value: null, data: { remainingOwnerTurns: 8 } },
        { kind: 'guard', owner: 'black', value: null, data: { remainingTurns: 7 } },
        { kind: 'poisoned', owner: 'black', value: null, data: { countdown: 6 } },
        { kind: 'breeding-sprout', owner: 'black', value: true, data: { count: 5 } }
      ]
    }));

    stoneView.update(cell, viewContext());

    expect(stoneView.getDiagnostics().statusLabels).toEqual([
      { kind: 'countdown', value: '12' },
      { kind: 'regen', value: '11' },
      { kind: 'flip-evade', value: '10' },
      { kind: 'destroy-evade', value: '9' },
      { kind: 'bomb', value: '8' },
      { kind: 'guard', value: '7' },
      { kind: 'poison', value: '6' }
    ]);
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-status-labels'
    )).children.map((child: any) => child.label)).toEqual([
      'pixi-stone-status:countdown',
      'pixi-stone-status:regen',
      'pixi-stone-status:flip-evade',
      'pixi-stone-status:destroy-evade',
      'pixi-stone-status:bomb',
      'pixi-stone-status:guard',
      'pixi-stone-status:poison'
    ]);
  });

  test('renders canonical countdown, protection, regen, evasion, and poison marker shapes in fixed slots', () => {
    const fixture = createFakeRuntime();
    const stoneView = StoneView.createPixiStoneView(fixture.runtime);
    let revision = 0;
    const update = (cell: ReturnType<typeof materializedCell>) => {
      revision += 1;
      stoneView.update(cell, viewContext({ stoneRevisionSignature: `marker-contract:${revision}` }));
    };
    const statusText = (kind: string) => stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-status-labels'
    )).children.find((child: any) => child.label === `pixi-stone-status:${kind}`);
    const fillColors = () => (stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-special-ring'
    )) as FakeGraphics).commands
      .filter((command) => command.op === 'fill')
      .map((command) => command.style?.color);

    update(materializedCell(makeCell('1,1', {
      stone: { owner: 'black', value: 1, specialType: 'REGEN', status: { regenRemaining: 3 } },
      markers: [{
        kind: 'special', owner: 'black', value: null, data: { type: 'REGEN', regenRemaining: 3 }
      }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([{ kind: 'regen', value: '3' }]);
    expect(statusText('regen').position.x).toBeCloseTo(4.48);
    expect(statusText('regen').position.y).toBeCloseTo(16);
    expect(fillColors()).toContain('#ff3f98');

    update(materializedCell(makeCell('1,2', {
      stone: {
        owner: 'white', value: -1, specialType: 'ZOMBIE',
        status: { remainingOwnerTurns: 3, regenRemaining: 1 }
      },
      markers: [{
        kind: 'special', owner: 'white', value: null,
        data: { type: 'ZOMBIE', remainingOwnerTurns: 3, regenRemaining: 1 }
      }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([
      { kind: 'countdown', value: '3' },
      { kind: 'regen', value: '1' }
    ]);
    expect(statusText('countdown').position).toMatchObject({ x: 17, y: 27.2 });
    expect(fillColors()).toEqual(expect.arrayContaining(['#ac1c1c', '#8739d6']));

    update(materializedCell(makeCell('1,3', {
      stone: { owner: 'black', value: 1, specialType: 'TIME_STOP', status: { remainingOwnerTurns: 12 } },
      markers: [{
        kind: 'special', owner: 'black', value: null, data: { type: 'TIME_STOP', remainingOwnerTurns: 12 }
      }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([{ kind: 'countdown', value: '12' }]);
    expect(fillColors()).toContain('#ac1c1c');

    update(materializedCell(makeCell('2,1', {
      stone: {
        owner: 'black', value: 1, specialType: 'AFTERIMAGE_WILL',
        status: { remainingOwnerTurns: 6, flipEvadeRemaining: 10, destroyEvadeRemaining: 9 }
      },
      markers: [{
        kind: 'special', owner: 'black', value: null,
        data: {
          type: 'AFTERIMAGE_WILL', remainingOwnerTurns: 6,
          flipEvadeRemaining: 10, destroyEvadeRemaining: 9
        }
      }]
    })));
    expect(statusText('flip-evade').position.x).toBeCloseTo(27.52);
    expect(statusText('flip-evade').position.y).toBeCloseTo(4.48);
    expect(statusText('destroy-evade').position.x).toBeCloseTo(4.48);
    expect(statusText('destroy-evade').position.y).toBeCloseTo(27.52);
    expect(fillColors()).toEqual(expect.arrayContaining(['#5e3a86', '#972828']));

    update(materializedCell(makeCell('2,2', {
      stone: { owner: 'white', value: -1, specialType: 'GUARD', status: {} },
      markers: [{ kind: 'guard', owner: 'white', value: null, data: { remainingOwnerTurns: 4 } }]
    })));
    expect(stoneView.getDiagnostics()).toMatchObject({
      statusLabels: [{ kind: 'guard', value: '4' }],
      flipProtectionBadgeVisible: true
    });
    expect(statusText('guard').position).toMatchObject({ x: 17, y: 7 });
    expect(fillColors()).toContain('#244f8a');

    update(materializedCell(makeCell('2,3', {
      stone: { owner: 'black', value: 1, specialType: 'POISONED', status: {} },
      markers: [{ kind: 'poisoned', owner: 'black', value: null, data: { countdown: 5 } }]
    })));
    expect(stoneView.getDiagnostics().statusLabels).toEqual([{ kind: 'poison', value: '5' }]);
    expect(statusText('poison').position.x).toBeCloseTo(16);
    expect(statusText('poison').position.y).toBeCloseTo(16);
    expect(fillColors()).toContain('#6b2b91');
  });
});

describe('Pixi static board scene', () => {
  test('uses the fixed layer order, one static sprite, sparse stones, and four 8x8 star points', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime, stage: fixture.stage });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key));
    cells.find((cell) => cell.key === '3,3')!.stone = {
      owner: 'black', value: 1, specialType: null, status: {}
    };
    const frame = makeFrame({ topology, cells });
    const textures = new Map<string, any>([
      ['board', { texture: { id: 'board-texture' } }],
      ['black-stone', { texture: { id: 'black-texture' } }]
    ]);

    const first = scene.applyFrame(frame, { textures, textureRevision: 1 });
    const second = scene.applyFrame(frame, { textures, textureRevision: 1 });

    expect(fixture.stage.children).toEqual([scene.root]);
    expect(scene.root.eventMode).toBe('passive');
    expect(scene.root.children.map((layer: any) => layer.label)).toEqual(
      BoardScene.PIXI_BOARD_SCENE_LAYER_ORDER.map((name) => `pixi-board-layer:${name}`)
    );
    expect(scene.root.children
      .filter((layer: any) => layer !== scene.layers.interaction)
      .every((layer: any) => layer.eventMode === 'none')).toBe(true);
    expect(scene.layers.interaction).toMatchObject({ eventMode: 'static' });
    expect(scene.layers.interaction.hitArea).toMatchObject({ x: 0, y: 0, width: 256, height: 256 });
    expect(scene.layers.interaction.hitArea.contains(255.99, 255.99)).toBe(true);
    expect(scene.layers.interaction.hitArea.contains(256, 0)).toBe(false);
    expect(first).toMatchObject({ materializedCount: 64, createdViews: 64, updatedViews: 64 });
    expect(second).toMatchObject({ materializedCount: 64, createdViews: 0, updatedViews: 0, skippedViews: 64 });
    expect(scene.getDiagnostics()).toMatchObject({
      activeViewCount: 64,
      createdViewCount: 64,
      starPointCount: 4,
      boardTextureMode: 'single-surface',
      boardSurfaceUpdateCount: 1,
      boardSurfaceSkippedCount: 1,
      surfaceBoardTextureCount: 1,
      cellBoardTextureCount: 0,
      textureBackedStoneCount: 1,
      activeStoneViewCount: 1,
      staticBakeCount: 1,
      staticBakeSkipCount: 1,
      staticAttachedObjectCount: 1,
      staticTemporaryObjectCount: 0,
      canvasCount: 0,
      domNodeCount: 0,
      layerOrder: BoardScene.PIXI_BOARD_SCENE_LAYER_ORDER
    });
    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      kind: 'playable',
      cell: { usesBoardTexture: false },
      stone: { textureBacked: true, texturePurpose: 'black-stone' }
    });
    expect(scene.layers.surface.children[0]).toMatchObject({
      label: 'pixi-static-board-texture',
      visible: true,
      width: 320,
      height: 320
    });
    expect(scene.layers.surface.children).toHaveLength(1);
  });

  test('clips persistent board layers to the physical viewport without clipping playback or effect gutter', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const frame = makeFrame({
      topology,
      visibleWindow: { minRow: 4, maxRow: 11, minCol: 4, maxCol: 11 }
    });

    scene.applyFrame(frame, {
      canvasViewport: { sceneOffsetX: 64, sceneOffsetY: 64 }
    });

    const maskRoot = scene.layers.interaction.children.find((child: any) => (
      child.label === 'pixi-board-viewport-masks'
    ));
    expect(maskRoot).toBeDefined();
    expect(maskRoot.eventMode).toBe('none');
    expect(maskRoot.children.map((child: any) => child.label)).toEqual(
      BoardScene.PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES.map(
        (name) => `pixi-board-viewport-mask:${name}`
      )
    );
    for (const name of BoardScene.PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
      const mask = scene.layers[name].mask as FakeGraphics;
      expect(mask.parent).toBe(maskRoot);
      expect(mask.commands).toEqual([
        { op: 'rect', args: [64, 64, 256, 256] },
        { op: 'fill', style: { color: '#ffffff', alpha: 1 } }
      ]);
    }
    expect(scene.layers.playback.mask).toBeUndefined();
    expect(scene.layers.effect.mask).toBeUndefined();
    expect(scene.getDiagnostics()).toMatchObject({
      viewportClippedLayerNames: ['surface', 'cell', 'marker', 'stone', 'hint'],
      viewportClipRect: { x: 64, y: 64, width: 256, height: 256 },
      effectGutterCells: 2
    });

    scene.reset();
    expect(scene.getDiagnostics().viewportClipRect).toBeNull();
    for (const name of BoardScene.PIXI_BOARD_VIEWPORT_CLIPPED_LAYER_NAMES) {
      expect((scene.layers[name].mask as FakeGraphics).commands).toEqual([]);
    }

    scene.applyFrame(frame, {
      canvasViewport: { sceneOffsetX: 48, sceneOffsetY: 40 }
    });
    expect(scene.getDiagnostics().viewportClipRect).toEqual({
      x: 48,
      y: 40,
      width: 256,
      height: 256
    });
    scene.destroy();
  });

  test('ignores transaction generation when stable surface and stone resource identities are unchanged', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const frame = makeFrame({ topology });
    const textures = new Map<string, any>([
      ['board', { texture: { id: 'board-texture' } }],
      ['black-stone', { texture: { id: 'black-texture' } }]
    ]);
    const stableLanes = {
      surfaceTextureRevision: '[["board","board:stable"]]',
      stoneTextureRevision: '[["black-stone","black-stone:stable"]]'
    };

    scene.applyFrame(frame, { textures, textureRevision: 1, ...stableLanes });
    const generationOnly = scene.applyFrame(frame, { textures, textureRevision: 2, ...stableLanes });

    expect(generationOnly).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      skippedViews: 64
    });
    expect(scene.getDiagnostics()).toMatchObject({
      boardSurfaceUpdateCount: 1,
      boardSurfaceSkippedCount: 1
    });

    expect(scene.applyFrame(frame, {
      textures,
      textureRevision: 3,
      surfaceTextureRevision: '[["board","board:next"]]',
      stoneTextureRevision: stableLanes.stoneTextureRevision
    })).toMatchObject({ updatedCellViews: 64, updatedStoneViews: 0 });
    expect(scene.applyFrame(frame, {
      textures,
      textureRevision: 4,
      surfaceTextureRevision: '[["board","board:next"]]',
      stoneTextureRevision: '[["black-stone","black-stone:next"]]'
    })).toMatchObject({ updatedCellViews: 0, updatedStoneViews: 0 });
  });

  test('keeps the single board texture on the base board and textures expansion cells separately', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({
      baseRows: 4,
      baseCols: 4,
      minRow: -1,
      maxRow: 3,
      minCol: 0,
      maxCol: 3
    });
    const cells = topology.existingKeys.map((key) => {
      const row = Number(key.split(',')[0]);
      return makeCell(key, {
        renderRow: row + topology.renderRowOffset,
        renderCol: Number(key.split(',')[1]) + topology.renderColOffset,
        expansionSide: row < 0 ? 'top' : null
      });
    });
    const boardTexture = { id: 'board-texture' };
    const frame = makeFrame({ topology, cells, cellSize: 32 });

    scene.applyFrame(frame, {
      textures: new Map([['board', { texture: boardTexture }]]),
      textureRevision: 1
    });

    expect(scene.layers.surface.children).toHaveLength(1);
    expect(scene.layers.surface.children[0]).toMatchObject({
      label: 'pixi-static-board-texture',
      visible: true
    });
    expect(scene.getRenderedCell(0, 0)?.cell.usesBoardTexture).toBe(false);
    expect(scene.getRenderedCell(-1, 0)?.cell.usesBoardTexture).toBe(true);
    expect(scene.getDiagnostics()).toMatchObject({
      boardTextureMode: 'single-surface',
      surfaceBoardTextureCount: 1,
      cellBoardTextureCount: 4
    });
  });

  test('hides 8x8 stars for base voids and only suppresses theory-number intersections', () => {
    const voidFixture = createFakeRuntime();
    const voidScene = BoardScene.createPixiBoardScene({ runtime: voidFixture.runtime });
    const voidKeys = rectangleKeys(0, 7, 0, 7).filter((key) => key !== '0,0');
    const voidTopology = makeTopology({ baseRows: 8, baseCols: 8, existingKeys: voidKeys });
    voidScene.applyFrame(makeFrame({ topology: voidTopology }));
    expect(voidScene.getDiagnostics().starPointCount).toBe(0);

    const theoryFixture = createFakeRuntime();
    const theoryScene = BoardScene.createPixiBoardScene({ runtime: theoryFixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key, {
      markers: key === '2,6'
        ? [{ kind: 'theory-number-cell', owner: null, value: true, data: { active: true } }]
        : []
    }));
    theoryScene.applyFrame(makeFrame({ topology, cells }));
    expect(theoryScene.getDiagnostics().starPointCount).toBe(3);
    expect(theoryScene.getDiagnostics()).toMatchObject({
      staticBakeCount: 1,
      staticAttachedObjectCount: 1
    });
  });

  test('rebakes the static texture for surface dependencies while keeping star count stable', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const baseTheme = Theme.createBoardVisualThemeDescriptor({ revision: 1, surfaceColor: '#112233' });
    scene.applyFrame(makeFrame({ topology, theme: baseTheme }));
    const initialBakeCount = scene.getDiagnostics().staticBakeCount;

    scene.applyFrame(makeFrame({
      topology,
      theme: Object.freeze({ ...baseTheme, revision: 99, markerColor: '#abcdef' })
    }));
    expect(scene.getDiagnostics().staticBakeCount).toBe(initialBakeCount + 1);

    scene.applyFrame(makeFrame({
      topology,
      theme: Object.freeze({ ...baseTheme, revision: 99, surfaceColor: '#445566' })
    }));
    expect(scene.getDiagnostics()).toMatchObject({
      staticBakeCount: initialBakeCount + 2,
      starPointCount: 4,
      staticTemporaryObjectCount: 0
    });
  });

  test('updates only the view whose semantic or appearance dependency changed', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const firstFrame = makeFrame({ topology });
    scene.applyFrame(firstFrame);

    const changedCells = topology.existingKeys.map((key) => makeCell(key, {
      interaction: key === '4,4' ? { legal: true } : undefined
    }));
    const visualChanged = scene.applyFrame(makeFrame({ topology, cells: changedCells, modelRevision: 2 }));
    expect(visualChanged).toMatchObject({
      updatedViews: 1,
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 1,
      skippedViews: 63
    });

    const themeChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(themeChanged).toMatchObject({
      updatedViews: 64,
      updatedCellViews: 64,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      skippedViews: 0
    });

    const appearanceChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 2,
      appearance: { boardImageUrl: 'https://example.test/board-next.png' },
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(appearanceChanged).toMatchObject({
      updatedViews: 64,
      updatedCellViews: 64,
      updatedStoneViews: 0,
      updatedHintViews: 0
    });

    const stoneAppearanceChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 3,
      appearance: {
        boardImageUrl: 'https://example.test/board-next.png',
        blackStoneImageUrl: 'https://example.test/black-next.png'
      },
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(stoneAppearanceChanged).toMatchObject({
      updatedViews: 0,
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0
    });

    const layoutChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 3,
      appearance: {
        boardImageUrl: 'https://example.test/board-next.png',
        blackStoneImageUrl: 'https://example.test/black-next.png'
      },
      layoutRevision: 2,
      orientation: 'rotated-180',
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(layoutChanged).toMatchObject({
      updatedViews: 64,
      updatedCellViews: 64,
      updatedStoneViews: 0,
      updatedHintViews: 64
    });

    const identical = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 99,
      appearanceRevision: 99,
      appearance: {
        boardImageUrl: 'https://example.test/board-next.png',
        blackStoneImageUrl: 'https://example.test/black-next.png'
      },
      layoutRevision: 99,
      orientation: 'rotated-180',
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 99, surfaceColor: '#123456' })
    }));
    expect(identical).toMatchObject({
      updatedViews: 0,
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0,
      skippedViews: 64
    });
    expect(scene.getDiagnostics()).toMatchObject({ boardSurfaceSkippedCount: expect.any(Number) });
  });

  test('keeps lock-only frame changes out of cell, stone, and hint paint work', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key, {
      interaction: { legal: key === '2,3' || key === '3,2' }
    }));

    const initial = scene.applyFrame(makeFrame({ topology, cells, modelRevision: 1 }));
    expect(initial).toMatchObject({
      updatedCellViews: 64,
      updatedStoneViews: 0,
      hintPaintCount: 64,
      hintInputSyncCount: 64
    });

    const locked = scene.applyFrame(makeFrame({
      topology,
      cells,
      modelRevision: 2,
      overlay: { interactionLocked: true }
    }));
    expect(locked).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 64,
      hintPaintCount: 0,
      hintInputSyncCount: 64,
      skippedViews: 0
    });

    const unlocked = scene.applyFrame(makeFrame({
      topology,
      cells,
      modelRevision: 3,
      overlay: { interactionLocked: false }
    }));
    expect(unlocked).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 64,
      hintPaintCount: 0,
      hintInputSyncCount: 64
    });
    expect(scene.getDiagnostics()).toMatchObject({
      cumulativeUpdatedCellViewCount: 64,
      cumulativeUpdatedStoneViewCount: 0,
      cumulativeUpdatedHintViewCount: 192,
      cumulativeHintPaintCount: 64,
      cumulativeHintInputSyncCount: 192
    });
  });

  test('partitions surface, stone, hint, and font theme dependencies', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const baseTheme = Theme.createBoardVisualThemeDescriptor({ revision: 1 });
    scene.applyFrame(makeFrame({ topology, theme: baseTheme }));

    const hintTheme = Object.freeze({
      ...baseTheme,
      revision: 2,
      legalHint: Object.freeze({ ...baseTheme.legalHint, ringColor: '#123456' })
    });
    expect(scene.applyFrame(makeFrame({ topology, theme: hintTheme }))).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 64
    });

    const stoneTheme = Object.freeze({ ...hintTheme, revision: 3, hintColor: '#abcdef' });
    expect(scene.applyFrame(makeFrame({ topology, theme: stoneTheme }))).toMatchObject({
      updatedCellViews: 0,
      updatedStoneViews: 0,
      updatedHintViews: 0
    });

    const fontTheme = Object.freeze({ ...stoneTheme, revision: 4, fontReadyEpoch: stoneTheme.fontReadyEpoch + 1 });
    expect(scene.applyFrame(makeFrame({ topology, theme: fontTheme }))).toMatchObject({
      updatedCellViews: 64,
      updatedStoneViews: 0,
      updatedHintViews: 64
    });
  });

  test('keeps 8x8 initial and full-board display objects within the sparse budgets', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const initialCells = topology.existingKeys.map((key) => makeCell(key, {
      stone: ['3,3', '3,4', '4,3', '4,4'].includes(key)
        ? { owner: key === '3,3' || key === '4,4' ? 'white' : 'black', value: 1, specialType: null, status: {} }
        : null
    }));

    scene.applyFrame(makeFrame({ topology, cells: initialCells }));
    expect(scene.getDiagnostics()).toMatchObject({
      activeStoneViewCount: 4,
      staticAttachedObjectCount: 1,
      staticTemporaryObjectCount: 0
    });
    expect(scene.getDiagnostics().displayObjectCount).toBeLessThan(500);

    const fullCells = topology.existingKeys.map((key, index) => makeCell(key, {
      stone: { owner: index % 2 ? 'white' : 'black', value: 1, specialType: null, status: {} }
    }));
    scene.applyFrame(makeFrame({ topology, cells: fullCells, modelRevision: 2 }));
    expect(scene.getDiagnostics().activeStoneViewCount).toBe(64);
    expect(scene.getDiagnostics().displayObjectCount).toBeLessThan(1000);
  });

  test('bounds 16x16 materialization to visible + one overscan + two-cell gutter and reuses offscreen views', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const first = makeFrame({
      topology,
      visibleWindow: { minRow: 4, maxRow: 6, minCol: 4, maxCol: 6 }
    });
    const firstResult = scene.applyFrame(first);
    expect(firstResult).toMatchObject({
      materializedCount: 81,
      createdViews: 81,
      materializationWindow: { minRow: 1, maxRow: 9, minCol: 1, maxCol: 9 }
    });

    const second = makeFrame({
      topology,
      visibleWindow: { minRow: 9, maxRow: 11, minCol: 9, maxCol: 11 },
      layoutRevision: 2
    });
    const secondResult = scene.applyFrame(second);
    expect(secondResult).toMatchObject({
      materializedCount: 81,
      createdViews: 0,
      reusedViews: 65,
      releasedViews: 65,
      materializationWindow: { minRow: 6, maxRow: 14, minCol: 6, maxCol: 14 }
    });
    expect(scene.getDiagnostics()).toMatchObject({ activeViewCount: 81, createdViewCount: 81 });
    expect(scene.getRenderedCell(1, 1)).toBeNull();

    scene.reset();
    expect(scene.getDiagnostics()).toMatchObject({ activeViewCount: 0, pooledViewCount: 81 });
    expect(scene.layers.interaction).toMatchObject({ eventMode: 'none', hitArea: null });
    const reapplied = scene.applyFrame(first);
    expect(reapplied).toMatchObject({ createdViews: 0, reusedViews: 81 });
    expect(scene.layers.interaction).toMatchObject({ eventMode: 'static' });

    scene.destroy();
    scene.destroy();
    expect(fixture.stage.children).toEqual([]);
    expect(scene.getDiagnostics()).toMatchObject({
      destroyed: true,
      activeViewCount: 0,
      pooledViewCount: 0,
      destroyedViewCount: 81,
      displayObjectCount: 0
    });
    expect(() => scene.applyFrame(first)).toThrow('destroyed');
  });

  test.each([
    [4, 4],
    [4, 16],
    [16, 4],
    [16, 16]
  ])('materializes a bounded %ix%i rectangle', (rows, cols) => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: rows, baseCols: cols });
    const result = scene.applyFrame(makeFrame({ topology }));
    expect(result.materializedCount).toBe(rows * cols);
    expect(scene.getDiagnostics().activeViewCount).toBeLessThanOrEqual(256);
    scene.destroy();
  });

  test('keeps explicit holes, derives ephemeral circle voids, and rotates negative world coordinates', () => {
    const circleFixture = createFakeRuntime();
    const circleScene = BoardScene.createPixiBoardScene({ runtime: circleFixture.runtime });
    const circleKeys: string[] = [];
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        const dr = row - 2.5;
        const dc = col - 2.5;
        if (dr * dr + dc * dc <= 9) circleKeys.push(`${row},${col}`);
      }
    }
    const circleTopology = makeTopology({
      baseRows: 6,
      baseCols: 6,
      existingKeys: circleKeys,
      holeKeys: ['2,2']
    });
    circleScene.applyFrame(makeFrame({ topology: circleTopology }), {
      textures: new Map([['board', { texture: { id: 'circle-board-texture' } }]])
    });
    expect(circleScene.getDiagnostics()).toMatchObject({
      activeViewCount: 36,
      ephemeralVoidCount: 4,
      holeCount: 1,
      boardTextureMode: 'per-cell',
      surfaceBoardTextureCount: 0,
      cellBoardTextureCount: 31
    });
    expect(circleScene.getRenderedCell(0, 0)).toMatchObject({
      kind: 'void',
      cell: { usesBoardTexture: false }
    });
    expect(circleScene.getRenderedCell(2, 2)).toMatchObject({
      kind: 'hole',
      cell: { usesBoardTexture: false }
    });

    const rotatedFixture = createFakeRuntime();
    const rotatedScene = BoardScene.createPixiBoardScene({ runtime: rotatedFixture.runtime });
    const negativeTopology = makeTopology({
      baseRows: 4,
      baseCols: 4,
      minRow: -1,
      maxRow: 2,
      minCol: -2,
      maxCol: 1,
      holeKeys: ['0,0']
    });
    rotatedScene.applyFrame(makeFrame({
      topology: negativeTopology,
      orientation: 'rotated-180',
      cellSize: 32
    }));
    expect(rotatedScene.getRenderedCell(-1, -2)).toMatchObject({
      kind: 'playable',
      position: { x: 160, y: 160 }
    });
    expect(rotatedScene.getRenderedCell(0, 0)?.kind).toBe('hole');
  });

  test('scene/view sources create no DOM or canvas and contain no gameplay legality resolver', () => {
    const rootDir = path.resolve(__dirname, '..');
    for (const relative of [
      'ui/pixi/cell-view.ts',
      'ui/pixi/stone-view.ts',
      'ui/pixi/hint-view.ts',
      'ui/pixi/board-scene.ts'
    ]) {
      const source = fs.readFileSync(path.join(rootDir, relative), 'utf8');
      expect(source).not.toMatch(/document\.createElement|createElement\(['"]canvas|new HTMLCanvasElement/);
      expect(source).not.toMatch(/getLegalMoves|resolveLegal|isLegalMove|NetworkMatchClient|canonicalRng|Math\.random/);
    }
  });
});

describe('Pixi board scene playback projection', () => {
  const blackStone = Object.freeze({
    owner: 'black' as const,
    value: 1,
    specialType: null,
    status: Object.freeze({})
  });
  const whiteStone = Object.freeze({
    owner: 'white' as const,
    value: -1,
    specialType: null,
    status: Object.freeze({})
  });

  test('keeps retained overrides through reflow and clears them only after a successful final apply', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const makeStoneFrame = (stone: typeof blackStone | typeof whiteStone, revision: number) => makeFrame({
      topology,
      modelRevision: revision,
      layoutRevision: revision,
      cells: topology.existingKeys.map((key) => makeCell(key, {
        stone: key === '3,3' ? stone : null
      }))
    });
    const first = makeStoneFrame(blackStone, 1);
    const second = makeStoneFrame(whiteStone, 2);
    scene.applyFrame(first);

    const scope = scene.beginPlaybackScope('writer:1');
    expect(scene.beginPlaybackScope('writer:1')).toBe(scope);
    scene.retainStoneOverride(scope, 3, 3, {
      offsetX: 7,
      offsetY: -5,
      scaleX: 0.4,
      scaleY: 1,
      rotation: 0.25,
      alpha: 0.6
    });
    scene.hideStone(scope, 3, 3);

    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      stone: { owner: 'black', visible: false },
      playback: {
        hidden: true,
        overridden: true,
        offset: { x: 7, y: -5 },
        scale: { x: 0.4, y: 1 },
        rotation: 0.25,
        alpha: 0.6
      }
    });
    expect(() => scene.beginPlaybackScope('writer:2')).toThrow('still active');
    expect(() => scene.applyFrame(null as any)).toThrow('complete BoardVisualFrame');
    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: 'writer:1',
      retainedStoneOverrideCount: 1,
      hiddenStoneCount: 1
    });

    scene.applyFrame(second, { preservePlaybackProjection: true });
    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      stone: { owner: 'white', visible: false },
      playback: { hidden: true, overridden: true }
    });

    scene.applyFrame(second);
    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      stone: { owner: 'white', visible: true },
      playback: {
        hidden: false,
        overridden: false,
        offset: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        alpha: 1
      }
    });
    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      retainedStoneOverrideCount: 0,
      hiddenStoneCount: 0
    });
  });

  test('pools event ghosts without increasing sparse cell materialization', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const frame = makeFrame({
      topology,
      visibleWindow: { minRow: 4, maxRow: 6, minCol: 4, maxCol: 6 }
    });
    scene.applyFrame(frame);
    const retainedCount = scene.getDiagnostics().activeViewCount;
    const scope = scene.beginPlaybackScope('writer:ghosts');
    const offscreen = scene.acquirePlaybackGhost(scope, {
      row: 15,
      col: 15,
      stone: blackStone
    });

    expect(scene.getPlaybackGhost(offscreen)).toMatchObject({
      row: 15,
      col: 15,
      visible: false,
      owner: 'black'
    });
    expect(scene.getDiagnostics()).toMatchObject({
      activeViewCount: retainedCount,
      activePlaybackGhostCount: 1,
      materializedPlaybackGhostCount: 0,
      createdPlaybackGhostCount: 0
    });
    expect(scene.layers.playback.children).toHaveLength(0);

    // MOVE keeps the ghost anchored to its source and animates in scene-space
    // offsets. Culling must follow that transformed position as it crosses
    // from an offscreen source into the materialized viewport.
    scene.updatePlaybackGhost(scope, offscreen, {
      offsetX: -10 * 32,
      offsetY: -10 * 32
    });
    expect(scene.getPlaybackGhost(offscreen)).toMatchObject({
      row: 15,
      col: 15,
      visible: true,
      position: { x: 96, y: 96 },
      offset: { x: -320, y: -320 }
    });
    expect(scene.getDiagnostics()).toMatchObject({
      materializedPlaybackGhostCount: 1,
      createdPlaybackGhostCount: 1
    });

    scene.updatePlaybackGhost(scope, offscreen, {
      row: 5.5,
      col: 5,
      offsetX: 3,
      offsetY: -4,
      scaleX: 0.5,
      scaleY: 1.2,
      rotation: 0.75,
      alpha: 0.4
    });
    expect(scene.getPlaybackGhost(offscreen)).toMatchObject({
      row: 5.5,
      col: 5,
      visible: true,
      position: { x: 99, y: 108 },
      offset: { x: 3, y: -4 },
      scale: { x: 0.5, y: 1.2 },
      rotation: 0.75,
      alpha: 0.4
    });

    scene.hideStone(scope, 5, 5);
    scene.releasePlaybackGhost(scope, offscreen);
    expect(scene.layers.playback.children).toHaveLength(0);
    expect(scene.getPlaybackGhost(offscreen)).toBeNull();
    expect(scene.getDiagnostics()).toMatchObject({
      hiddenStoneCount: 1,
      activePlaybackGhostCount: 0,
      materializedPlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 1
    });

    const reused = scene.acquirePlaybackGhost(scope, { row: 5, col: 5, stone: whiteStone });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackGhostCount: 1,
      materializedPlaybackGhostCount: 1,
      createdPlaybackGhostCount: 1,
      pooledPlaybackGhostCount: 0
    });
    scene.applyFrame(frame);
    expect(scene.getPlaybackGhost(reused)).toBeNull();
    expect(scene.getDiagnostics()).toMatchObject({
      hiddenStoneCount: 0,
      playbackScopeKey: null,
      activePlaybackGhostCount: 0,
      materializedPlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 1
    });
  });

  test('bounds transient effect DisplayObjects by viewport while preserving offscreen logical records', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const firstFrame = makeFrame({
      topology,
      visibleWindow: { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 }
    });
    scene.applyFrame(firstFrame);
    const baselineDisplayObjectCount = scene.getDiagnostics().displayObjectCount;
    const scope = scene.beginPlaybackScope('writer:sparse-effects');
    const handles = topology.playableKeys.map((key) => {
      const [row, col] = key.split(',').map(Number);
      return scene.acquirePlaybackEffect(scope, {
        row,
        col,
        family: 'theory_incarnation',
        kind: 'pulse',
        tone: 'purple'
      });
    });
    const firstWindow = scene.getDiagnostics().materializationWindow!;
    const firstWindowArea = (firstWindow.maxRow - firstWindow.minRow + 1)
      * (firstWindow.maxCol - firstWindow.minCol + 1);

    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 256,
      materializedPlaybackEffectCount: firstWindowArea,
      createdPlaybackEffectCount: firstWindowArea,
      pooledPlaybackEffectCount: 0
    });
    expect(scene.layers.effect.children.filter((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-effect'
    ))).toHaveLength(firstWindowArea);
    expect(scene.getDiagnostics().displayObjectCount - baselineDisplayObjectCount)
      .toBe(firstWindowArea * 3);
    expect(scene.getPlaybackEffect(handles[0])).toMatchObject({ visible: true, row: 0, col: 0 });
    expect(scene.getPlaybackEffect(handles[handles.length - 1])).toMatchObject({
      visible: false,
      row: 15,
      col: 15
    });

    const lastFrame = makeFrame({
      topology,
      visibleWindow: { minRow: 14, maxRow: 15, minCol: 14, maxCol: 15 },
      layoutRevision: 2
    });
    scene.applyFrame(lastFrame, { preservePlaybackProjection: true });
    const lastWindow = scene.getDiagnostics().materializationWindow!;
    const lastWindowArea = (lastWindow.maxRow - lastWindow.minRow + 1)
      * (lastWindow.maxCol - lastWindow.minCol + 1);
    expect(lastWindowArea).toBe(firstWindowArea);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 256,
      materializedPlaybackEffectCount: lastWindowArea,
      createdPlaybackEffectCount: firstWindowArea,
      pooledPlaybackEffectCount: 0
    });
    expect(scene.getPlaybackEffect(handles[0])).toMatchObject({ visible: false });
    expect(scene.getPlaybackEffect(handles[handles.length - 1])).toMatchObject({ visible: true });

    scene.applyFrame(firstFrame, { preservePlaybackProjection: true });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 256,
      materializedPlaybackEffectCount: firstWindowArea,
      createdPlaybackEffectCount: firstWindowArea
    });
    expect(scene.getPlaybackEffect(handles[0])).toMatchObject({ visible: true });
    expect(scene.getPlaybackEffect(handles[handles.length - 1])).toMatchObject({ visible: false });

    for (const handle of handles) scene.releasePlaybackEffect(scope, handle);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 0,
      materializedPlaybackEffectCount: 0,
      pooledPlaybackEffectCount: firstWindowArea
    });
    scene.destroy();
    expect(scene.getDiagnostics()).toMatchObject({
      pooledPlaybackEffectCount: 0,
      destroyedPlaybackEffectCount: firstWindowArea,
      displayObjectCount: 0
    });
  });

  test('keeps the rendered geometry of every board-local family inside the two-cell canvas gutter at all corners and edges', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const frame = makeFrame({ topology, cellSize: 32 });
    scene.applyFrame(frame);
    const scope = scene.beginPlaybackScope('writer:actual-effect-clipping');
    const gutterPx = scene.getDiagnostics().effectGutterCells * frame.layout.cellSize;
    const canvasWidth = frame.layout.camera.viewportWidth + gutterPx * 2;
    const canvasHeight = frame.layout.camera.viewportHeight + gutterPx * 2;
    const placements = [
      { name: 'top-left', row: 0, col: 0 },
      { name: 'top', row: 0, col: 3 },
      { name: 'top-right', row: 0, col: 7 },
      { name: 'right', row: 3, col: 7 },
      { name: 'bottom-right', row: 7, col: 7 },
      { name: 'bottom', row: 7, col: 3 },
      { name: 'bottom-left', row: 7, col: 0 },
      { name: 'left', row: 3, col: 0 }
    ];
    const effectShape = (family: string) => {
      if (family === 'board_shrink') {
        return { kind: 'topology' as const, scale: 1, rotation: 0 };
      }
      if (family === 'theory_incarnation_spawn_roulette') {
        return { kind: 'roulette' as const, scale: 1.08, rotation: 0 };
      }
      if (family === 'crossfade_stone') {
        return { kind: 'aura' as const, scale: 1.12, rotation: 0 };
      }
      if (family === 'destroy' || family === 'legacy_sacrifice_absorb_pulse') {
        return { kind: 'impact' as const, scale: 1.72, rotation: Math.PI * 0.36 };
      }
      return { kind: 'pulse' as const, scale: 1.4, rotation: 0 };
    };

    for (const family of EffectBounds.BOARD_LOCAL_EFFECT_FAMILIES) {
      const shape = effectShape(family);
      for (const placement of placements) {
        const handle = scene.acquirePlaybackEffect(scope, {
          row: placement.row,
          col: placement.col,
          family,
          kind: shape.kind,
          tone: 'purple',
          label: family === 'theory_incarnation_spawn_roulette' ? '19' : null,
          innerBoundaryEdges: family === 'board_shrink'
            ? ['top', 'right', 'bottom', 'left']
            : []
        });
        scene.updatePlaybackEffect(scope, handle, {
          alpha: 1,
          scale: shape.scale,
          rotation: shape.rotation
        });
        const root = scene.layers.effect.children.find((child: FakeDisplayObject) => (
          child.label === 'pixi-playback-effect'
        )) as FakeContainer;
        const graphics = root.children.find((child) => (
          child.label === 'pixi-playback-effect-graphics'
        )) as FakeGraphics;
        const bounds = renderedGraphicsBounds(root, graphics);
        expect({
          family,
          placement: placement.name,
          insideCanvasGutter: bounds.minX >= -0.001
            && bounds.minY >= -0.001
            && bounds.maxX <= canvasWidth + 0.001
            && bounds.maxY <= canvasHeight + 0.001
        }).toEqual({
          family,
          placement: placement.name,
          insideCanvasGutter: true
        });
        scene.releasePlaybackEffect(scope, handle);
      }
    }
  });

  test('renders transient cell highlights below stones and restores the previous tone on release', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const cells = topology.existingKeys.map((key) => makeCell(key));
    cells.find((cell) => cell.key === '2,2')!.stone = {
      owner: 'black', value: 1, specialType: null, status: {}
    };
    const frame = makeFrame({ topology, cells });
    scene.applyFrame(frame);
    const scope = scene.beginPlaybackScope('writer:highlight');
    const positive = scene.acquirePlaybackCellHighlight(scope, 2, 2, 'positive');
    const placement = scene.acquirePlaybackCellHighlight(scope, 2, 2, 'placement');

    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 2,
      renderedPlaybackHighlightCount: 1
    });
    const renderedHighlight = scene.layers.cell.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    )) as FakeGraphics;
    expect(scene.layers.stone.children).toHaveLength(1);
    expect(scene.root.children.indexOf(scene.layers.cell)).toBeLessThan(
      scene.root.children.indexOf(scene.layers.stone)
    );
    expect(scene.layers.effect.children).toHaveLength(0);
    expect(renderedHighlight.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#66a4ff' }) })
    ]));

    scene.releasePlaybackCellHighlight(scope, placement);
    expect(renderedHighlight.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#b466ff' }) })
    ]));
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 1
    });

    scene.releasePlaybackCellHighlight(scope, positive);
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    });

    scene.acquirePlaybackCellHighlight(scope, 2, 2, 'negative');
    scene.applyFrame(frame);
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);
    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0
    });
  });

  test('materializes transient highlights only while their cell is inside the viewport window', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 16, baseCols: 16 });
    const firstFrame = makeFrame({
      topology,
      visibleWindow: { minRow: 0, maxRow: 1, minCol: 0, maxCol: 1 }
    });
    scene.applyFrame(firstFrame);
    const scope = scene.beginPlaybackScope('writer:sparse-highlight');
    const handle = scene.acquirePlaybackCellHighlight(scope, 15, 15, 'positive');
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 0
    });
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);

    scene.applyFrame(makeFrame({
      topology,
      visibleWindow: { minRow: 14, maxRow: 15, minCol: 14, maxCol: 15 },
      layoutRevision: 2
    }), { preservePlaybackProjection: true });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 1,
      pooledPlaybackHighlightCount: 0
    });
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(true);

    scene.applyFrame(firstFrame, { preservePlaybackProjection: true });
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 1,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    });
    expect(scene.layers.cell.children.some((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-cell-highlight'
    ))).toBe(false);

    scene.releasePlaybackCellHighlight(scope, handle);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackHighlightLeaseCount: 0,
      renderedPlaybackHighlightCount: 0,
      pooledPlaybackHighlightCount: 1
    });
  });

  test('draws retained BOARD_FRAME playback topology without a generic X or internal seam', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 4, baseCols: 4 });
    scene.applyFrame(makeFrame({ topology, cellSize: 40 }));
    const scope = scene.beginPlaybackScope('writer:board-frame-hole');
    const handle = scene.acquirePlaybackEffect(scope, {
      row: 1,
      col: 1,
      family: 'board_shrink',
      kind: 'topology',
      innerBoundaryEdges: ['top', 'bottom']
    });

    expect(scene.getPlaybackEffect(handle)).toMatchObject({
      family: 'board_shrink',
      kind: 'topology',
      innerBoundaryEdges: ['top', 'bottom']
    });
    const effectRoot = scene.layers.effect.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-playback-effect'
    )) as FakeContainer;
    const graphics = effectRoot.children.find((child) => (
      child.label === 'pixi-playback-effect-graphics'
    )) as FakeGraphics;
    expect(graphics.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#080909' }) })
    ]));
    const segments: Array<{ from: number[]; to: number[] }> = [];
    let from: number[] | null = null;
    for (const command of graphics.commands) {
      if (command.op === 'moveTo') from = command.args as number[];
      if (command.op === 'lineTo' && from) {
        segments.push({ from, to: command.args as number[] });
        from = null;
      }
    }
    expect(segments.length).toBeGreaterThan(4);
    expect(segments.some(({ from: start, to }) => (
      (to[0] - start[0]) * (to[1] - start[1]) < 0
    ))).toBe(false);
    const edgeRects = graphics.commands.filter((command) => (
      command.op === 'rect' && command.args?.[2] === 40 && command.args?.[3] === 2.5
    ));
    expect(edgeRects).toHaveLength(2);

    scene.releasePlaybackEffect(scope, handle);
    expect(scene.getDiagnostics()).toMatchObject({
      activePlaybackEffectCount: 0,
      pooledPlaybackEffectCount: 1
    });
  });

  test('reset and destroy release playback objects and reject stale scope handles', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 4, baseCols: 4 });
    scene.applyFrame(makeFrame({ topology }));
    const scope = scene.beginPlaybackScope('writer:reset');
    const ghost = scene.acquirePlaybackGhost(scope, { row: 1, col: 1, stone: blackStone });
    scene.acquirePlaybackCellHighlight(scope, 1, 1, 'placement');
    scene.resetPlaybackProjection(scope);

    expect(scene.getDiagnostics()).toMatchObject({
      playbackScopeKey: null,
      activePlaybackGhostCount: 0,
      activePlaybackHighlightLeaseCount: 0
    });
    expect(() => scene.updatePlaybackGhost(scope, ghost, { alpha: 0 })).toThrow('scope is not active');

    const next = scene.beginPlaybackScope('writer:destroy');
    scene.acquirePlaybackGhost(next, { row: 1, col: 1, stone: whiteStone });
    scene.destroy();
    expect(scene.getDiagnostics()).toMatchObject({
      destroyed: true,
      activePlaybackGhostCount: 0,
      pooledPlaybackGhostCount: 0,
      destroyedPlaybackGhostCount: 1,
      displayObjectCount: 0
    });
  });

  test('keeps topology reveal progress across reflow and clears pooled view alpha on reset', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({
      baseRows: 8,
      baseCols: 8,
      minRow: 0,
      maxRow: 7,
      minCol: 0,
      maxCol: 8
    });
    const frame = makeFrame({ topology, cellSize: 32, layoutRevision: 1 });
    scene.applyFrame(frame);
    const handle = scene.beginTopologyReveal(['0,8']);
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 0 });

    scene.updateTopologyReveal(handle, 0.35);
    const beforeReflow = scene.getRenderedCell(0, 8)!;
    expect(beforeReflow.topologyRevealAlpha).toBeCloseTo(0.35);
    const staticPatch = scene.layers.surface.children.find((child: FakeDisplayObject) => (
      child.label === 'pixi-static-board-topology-patch'
    ));
    expect(staticPatch).toBeTruthy();
    expect(staticPatch.alpha).toBeCloseTo(0.35);
    const expectedRoots = [
      ['cell', 'pixi-cell-hint-surface'],
      ['hint', 'pixi-hint-view'],
      ['interaction', 'pixi-interaction-hit-area']
    ] as const;
    for (const [layer, label] of expectedRoots) {
      const visualOnlyGutter = layer === 'interaction'
        ? scene.getDiagnostics().effectGutterCells * frame.layout.cellSize
        : 0;
      const display = scene.layers[layer].children.find((child: FakeDisplayObject) => (
        child.label === label
        && child.position.x === beforeReflow.position.x - visualOnlyGutter
        && child.position.y === beforeReflow.position.y - visualOnlyGutter
      ));
      expect(display).toBeTruthy();
      expect(display.alpha).toBeCloseTo(0.35);
    }

    const reflow = makeFrame({ topology, cellSize: 40, layoutRevision: 2 });
    scene.applyFrame(reflow, { preservePlaybackProjection: true });
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 0.35 });
    expect(scene.getDiagnostics()).toMatchObject({
      activeTopologyRevealCount: 1,
      topologyRevealKeys: ['0,8']
    });

    scene.endTopologyReveal(handle);
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 1 });
    const createdBeforeReset = scene.getDiagnostics().createdViewCount;
    const resetHandle = scene.beginTopologyReveal(['0,8']);
    scene.updateTopologyReveal(resetHandle, 0.12);
    scene.reset();
    expect(scene.getDiagnostics()).toMatchObject({
      activeTopologyRevealCount: 0,
      topologyRevealKeys: []
    });

    scene.applyFrame(frame);
    expect(scene.getRenderedCell(0, 8)).toMatchObject({ topologyRevealAlpha: 1 });
    expect(scene.getDiagnostics().createdViewCount).toBe(createdBeforeReset);
  });
});
