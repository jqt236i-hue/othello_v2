import * as CellView from '../ui/pixi/cell-view';

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
  visible = true;
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
    for (const child of removed) child.parent = null;
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

type GraphicsCommand = { op: string; args?: number[]; style?: any };

class FakeGraphics extends FakeDisplayObject {
  commands: GraphicsCommand[] = [];
  clear() { this.commands = []; return this; }
  rect(...args: number[]) { this.commands.push({ op: 'rect', args }); return this; }
  moveTo(...args: number[]) { this.commands.push({ op: 'moveTo', args }); return this; }
  lineTo(...args: number[]) { this.commands.push({ op: 'lineTo', args }); return this; }
  circle(...args: number[]) { this.commands.push({ op: 'circle', args }); return this; }
  fill(style: any) { this.commands.push({ op: 'fill', style }); return this; }
  stroke(style: any) { this.commands.push({ op: 'stroke', style }); return this; }
}

function createRuntime() {
  return { Container: FakeContainer, Graphics: FakeGraphics };
}

test('Pixi display-object labels do not write the removed v8 name property', () => {
  class LabelOnlyContainer {
    label = '';
    constructor(options?: any) {
      this.label = String(options && options.label || '');
    }
    set name(_value: string) {
      throw new Error('removed Pixi v8 name property was written');
    }
  }

  expect(() => CellView.createPixiContainer(
    { Container: LabelOnlyContainer, Graphics: FakeGraphics },
    'board-cell'
  )).not.toThrow();
});

function createCell(visualSignature: string, marker: Record<string, any>): any {
  return {
    key: '0,0',
    row: 0,
    col: 0,
    renderRow: 0,
    renderCol: 0,
    kind: 'hole',
    expansionSide: null,
    boundaryEdges: { top: 'hole', right: 'hole', bottom: 'hole', left: 'hole' },
    stone: null,
    markers: [marker],
    interaction: {},
    visualSignature,
    surfaceSignature: visualSignature,
    stoneSignature: `stone:${visualSignature}`,
    hintPaintSignature: `hint-paint:${visualSignature}`,
    hintInputSignature: `hint-input:${visualSignature}`,
    interactionSignature: `interaction:${visualSignature}`,
    ephemeral: false
  };
}

function createContext(revisionSignature = 'cell-view:1'): any {
  return {
    layout: { cellSize: 40 },
    theme: {
      surfaceColor: '#18715f',
      gridLineWidth: 1,
      outerBoundaryColor: '#d5b26c',
      markerColor: '#f0cf73'
    },
    surfaceRevisionSignature: revisionSignature,
    stoneRevisionSignature: 'stone-view:1',
    interactionRevisionSignature: 'interaction-view:1',
    sceneOffsetX: 0,
    sceneOffsetY: 0,
    sceneX: 0,
    sceneY: 0,
    textures: null
  };
}

function childWithLabel(root: FakeDisplayObject, label: string): FakeGraphics {
  const child = root.children.find((candidate) => candidate.label === label);
  if (!child) throw new Error(`missing fake Pixi child: ${label}`);
  return child as FakeGraphics;
}

function readSegments(graphics: FakeGraphics): Array<{ from: number[]; to: number[] }> {
  const segments: Array<{ from: number[]; to: number[] }> = [];
  let from: number[] | null = null;
  for (const command of graphics.commands) {
    if (command.op === 'moveTo') from = command.args || null;
    if (command.op === 'lineTo' && from) {
      segments.push({ from, to: command.args || [] });
      from = null;
    }
  }
  return segments;
}

describe('Pixi cell BOARD_FRAME rendering', () => {
  test('draws frame material and only masked inner edges without an internal seam or generic X', () => {
    const view = CellView.createPixiCellView(createRuntime());
    const cell = createCell('frame-hole', {
      kind: 'blockade',
      owner: null,
      value: null,
      data: {
        type: 'METEOR_HOLE',
        visualVariant: 'BOARD_FRAME',
        // Left and right are adjacent shrink holes, so neither may gain an
        // internal edge between the frame tiles.
        innerBoundaryMask: 'top,bottom'
      }
    });

    expect(view.update(cell, createContext())).toBe(true);
    expect(view.getDiagnostics()).toMatchObject({
      boardFrameHole: true,
      boardFrameInnerBoundaryEdges: ['top', 'bottom'],
      renderedMarkerKinds: []
    });

    const frameSurface = childWithLabel(view.surfaceRoot, 'pixi-cell-board-frame-hole-surface');
    const innerEdges = childWithLabel(view.surfaceRoot, 'pixi-cell-board-frame-hole-inner-edges');
    const grid = childWithLabel(view.cellRoot, 'pixi-cell-grid-lines');
    expect(frameSurface.visible).toBe(true);
    expect(innerEdges.visible).toBe(true);
    expect(grid.visible).toBe(false);
    expect(frameSurface.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ op: 'fill', style: expect.objectContaining({ color: '#080909', alpha: 1 }) })
    ]));

    const edgeRects = innerEdges.commands.filter((command) => command.op === 'rect');
    expect(edgeRects).toHaveLength(2);
    expect(edgeRects.every((command) => command.args?.[2] === 40 && command.args?.[3] === 2.5)).toBe(true);
    const edgeSegments = readSegments(innerEdges);
    expect(edgeSegments).toHaveLength(4);
    expect(edgeSegments.every(({ from, to }) => from[1] === to[1])).toBe(true);

    const grainSegments = readSegments(frameSurface);
    expect(grainSegments.length).toBeGreaterThan(4);
    expect(grainSegments.every(({ from, to }) => (
      (to[0] - from[0]) * (to[1] - from[1]) >= 0
    ))).toBe(true);
    expect(view.markerRoot.children).toHaveLength(0);
  });

  test('clears frame layers and restores the existing grid and marker for a normal meteor hole', () => {
    const view = CellView.createPixiCellView(createRuntime());
    view.update(createCell('frame-hole', {
      kind: 'blockade',
      owner: null,
      value: null,
      data: { type: 'METEOR_HOLE', visualVariant: 'BOARD_FRAME', innerBoundaryMask: 'left' }
    }), createContext());

    const normalHole = createCell('normal-hole', {
      kind: 'blockade',
      owner: null,
      value: null,
      data: { type: 'METEOR_HOLE', visualVariant: null, innerBoundaryMask: null }
    });
    expect(view.update(normalHole, createContext())).toBe(true);
    expect(view.getDiagnostics()).toMatchObject({
      boardFrameHole: false,
      boardFrameInnerBoundaryEdges: [],
      renderedMarkerKinds: ['blockade']
    });

    const frameSurface = childWithLabel(view.surfaceRoot, 'pixi-cell-board-frame-hole-surface');
    const innerEdges = childWithLabel(view.surfaceRoot, 'pixi-cell-board-frame-hole-inner-edges');
    const grid = childWithLabel(view.cellRoot, 'pixi-cell-grid-lines');
    expect(frameSurface).toMatchObject({ visible: false, commands: [] });
    expect(innerEdges).toMatchObject({ visible: false, commands: [] });
    expect(grid.visible).toBe(true);
    expect(grid.commands.length).toBeGreaterThan(0);
    const marker = childWithLabel(view.markerRoot, 'pixi-marker-dot:blockade');
    expect(marker.commands.some((command) => command.op === 'circle')).toBe(true);
  });
});
