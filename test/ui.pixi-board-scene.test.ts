import * as fs from 'fs';
import * as path from 'path';

import * as BoardVisualModel from '../ui/board-visual/model';
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
  holeKeys?: string[];
}) {
  const minRow = options.minRow ?? 0;
  const maxRow = options.maxRow ?? options.baseRows - 1;
  const minCol = options.minCol ?? 0;
  const maxCol = options.maxCol ?? options.baseCols - 1;
  const existingKeys = options.existingKeys || rectangleKeys(minRow, maxRow, minCol, maxCol);
  const holes = new Set(options.holeKeys || []);
  return {
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
  theme?: any;
  modelRevision?: number;
}): any {
  const topology = options.topology;
  const holes = new Set(topology.holeKeys);
  const rawCells = options.cells || topology.existingKeys.map((key) => makeCell(key, {
    kind: holes.has(key) ? 'hole' : 'playable',
    renderRow: Number(key.split(',')[0]) + topology.renderRowOffset,
    renderCol: Number(key.split(',')[1]) + topology.renderColOffset
  }));
  const model = BoardVisualModel.createBoardRenderModel({
    visualRevision: options.modelRevision || 1,
    topology,
    cells: rawCells
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
      revision: options.appearanceRevision || 1
    },
    theme: options.theme || Theme.createBoardVisualThemeDescriptor({ revision: 1 })
  };
}

function materializedCell(raw: any): any {
  return Object.freeze({
    ...raw,
    visualSignature: JSON.stringify(raw),
    ephemeral: false
  });
}

function viewContext(overrides: Record<string, any> = {}): any {
  const topology = makeTopology({ baseRows: 8, baseCols: 8 });
  const frame = makeFrame({ topology });
  return {
    layout: frame.layout,
    theme: frame.theme,
    revisionSignature: 'static-view:1',
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
    expect(stoneView.getDiagnostics()).toMatchObject({
      owner: 'black',
      specialType: 'ZOMBIE',
      timerLabel: '10',
      badgeLabel: '2',
      statusLabels: [
        { kind: 'special', value: '10' },
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
    expect(hintView.interactionRoot.eventMode).toBe('none');
  });

  test('shows procedural normal/special/sprout fallback and double-digit timer styles', () => {
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

    stoneView.update(normal, viewContext({ revisionSignature: 'static-view:2' }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      owner: 'white',
      specialType: 'GUARD',
      timerLabel: '12',
      textureBacked: false
    });

    const sprout = materializedCell(makeCell('0,1', {
      markers: [{ kind: 'breeding-sprout', owner: 'white', value: true, data: { active: true } }]
    }));
    stoneView.update(sprout, viewContext({ revisionSignature: 'static-view:3' }));
    expect(stoneView.getDiagnostics()).toMatchObject({
      visible: true,
      specialType: 'BREEDING',
      textureBacked: false,
      renderedMarkerKinds: ['breeding-sprout']
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
      { kind: 'special', value: '12' },
      { kind: 'regen', value: '11' },
      { kind: 'flip-evade', value: '10' },
      { kind: 'destroy-evade', value: '9' },
      { kind: 'bomb', value: '8' },
      { kind: 'guard', value: '7' },
      { kind: 'poison', value: '6' },
      { kind: 'breeding', value: '5' }
    ]);
    expect(stoneView.root.children.find((child: any) => (
      child.label === 'pixi-stone-status-labels'
    )).children.map((child: any) => child.label)).toEqual([
      'pixi-stone-status:special',
      'pixi-stone-status:regen',
      'pixi-stone-status:flip-evade',
      'pixi-stone-status:destroy-evade',
      'pixi-stone-status:bomb',
      'pixi-stone-status:guard',
      'pixi-stone-status:poison',
      'pixi-stone-status:breeding'
    ]);
  });
});

describe('Pixi static board scene', () => {
  test('uses the fixed layer order, one retained view per key, and four 8x8 star points', () => {
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
    expect(scene.root.children.map((layer: any) => layer.label)).toEqual(
      BoardScene.PIXI_BOARD_SCENE_LAYER_ORDER.map((name) => `pixi-board-layer:${name}`)
    );
    expect(first).toMatchObject({ materializedCount: 64, createdViews: 64, updatedViews: 64 });
    expect(second).toMatchObject({ materializedCount: 64, createdViews: 0, updatedViews: 0, skippedViews: 64 });
    expect(scene.getDiagnostics()).toMatchObject({
      activeViewCount: 64,
      createdViewCount: 64,
      starPointCount: 4,
      boardTextureMode: 'single-surface',
      surfaceBoardTextureCount: 1,
      cellBoardTextureCount: 0,
      textureBackedStoneCount: 1,
      canvasCount: 0,
      domNodeCount: 0,
      layerOrder: BoardScene.PIXI_BOARD_SCENE_LAYER_ORDER
    });
    const starGraphics = scene.layers.marker.children[0] as FakeGraphics;
    expect(starGraphics.commands.filter((command) => command.op === 'circle').map((command) => command.args)).toEqual([
      [128, 128, expect.any(Number)],
      [256, 128, expect.any(Number)],
      [128, 256, expect.any(Number)],
      [256, 256, expect.any(Number)]
    ]);
    expect(scene.getRenderedCell(3, 3)).toMatchObject({
      kind: 'playable',
      cell: { usesBoardTexture: false },
      stone: { textureBacked: true, texturePurpose: 'black-stone' }
    });
    expect(scene.layers.surface.children[0]).toMatchObject({
      label: 'pixi-board-surface-fill',
      visible: true
    });
    expect(scene.layers.surface.children[1]).toMatchObject({
      label: 'pixi-board-surface-texture',
      visible: true,
      width: 256,
      height: 256
    });
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

    const surfaceTexture = scene.layers.surface.children.find((child: any) => (
      child.label === 'pixi-board-surface-texture'
    ));
    expect(surfaceTexture).toMatchObject({
      texture: boardTexture,
      position: { x: 64, y: 96 },
      width: 128,
      height: 128,
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
    const starGraphics = theoryScene.layers.marker.children[0] as FakeGraphics;
    expect(starGraphics.commands.filter((command) => command.op === 'circle').map((command) => command.args)).toEqual([
      [128, 128, expect.any(Number)],
      [128, 256, expect.any(Number)],
      [256, 256, expect.any(Number)]
    ]);
  });

  test('updates one changed visual signature but all visible views for theme/appearance/layout changes', () => {
    const fixture = createFakeRuntime();
    const scene = BoardScene.createPixiBoardScene({ runtime: fixture.runtime });
    const topology = makeTopology({ baseRows: 8, baseCols: 8 });
    const firstFrame = makeFrame({ topology });
    scene.applyFrame(firstFrame);

    const changedCells = topology.existingKeys.map((key) => makeCell(key, {
      interaction: key === '4,4' ? { legal: true } : undefined
    }));
    const visualChanged = scene.applyFrame(makeFrame({ topology, cells: changedCells, modelRevision: 2 }));
    expect(visualChanged).toMatchObject({ updatedViews: 1, skippedViews: 63 });

    const themeChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(themeChanged).toMatchObject({ updatedViews: 64, skippedViews: 0 });

    const appearanceChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 2,
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(appearanceChanged.updatedViews).toBe(64);

    const layoutChanged = scene.applyFrame(makeFrame({
      topology,
      cells: changedCells,
      modelRevision: 2,
      appearanceRevision: 2,
      layoutRevision: 2,
      theme: Theme.createBoardVisualThemeDescriptor({ revision: 2, surfaceColor: '#123456' })
    }));
    expect(layoutChanged.updatedViews).toBe(64);
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
    const reapplied = scene.applyFrame(first);
    expect(reapplied).toMatchObject({ createdViews: 0, reusedViews: 81 });

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
