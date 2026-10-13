const { JSDOM } = require('jsdom');
const AccessibilityLayer = require('../ui/board-accessibility-layer');

function makeCell(directionHints: any[]) {
  return {
    key: '2,3',
    row: 2,
    col: 3,
    interaction: { directionHints }
  };
}

function makeRect(left = 144, top = 288) {
  return {
    left,
    top,
    right: left + 44,
    bottom: top + 44,
    width: 44,
    height: 44,
    layoutRevision: 1
  };
}

function createHarness() {
  const dom = new JSDOM('<!doctype html><div id="board"><div id="board-scroll-viewport"></div><div class="pixi-board-canvas-layer"><canvas></canvas></div></div>');
  const document = dom.window.document;
  const host = document.getElementById('board') as HTMLElement;
  const canvas = host.querySelector('canvas') as HTMLCanvasElement;
  Object.defineProperty(host, 'getBoundingClientRect', {
    value: () => ({ left: 100, top: 200, right: 420, bottom: 520, width: 320, height: 320 })
  });
  const onActivate = jest.fn();
  const onFocus = jest.fn();
  const onBlur = jest.fn();
  const layer = AccessibilityLayer.createBoardAccessibilityLayer({
    document,
    onActivate,
    onFocus,
    onBlur
  });
  return { dom, document, host, canvas, layer, onActivate, onFocus, onBlur };
}

describe('board accessibility layer', () => {
  test('mounts one semantic layer after the Pixi camera and hides the canvas from accessibility', () => {
    const harness = createHarness();
    const first = harness.layer.mount(harness.host, harness.canvas);
    const second = harness.layer.mount(harness.host, harness.canvas);

    expect(first).toBe(second);
    expect(harness.host.querySelectorAll('.board-accessibility-layer')).toHaveLength(1);
    expect(harness.host.lastElementChild).toBe(first);
    expect(harness.canvas.getAttribute('aria-hidden')).toBe('true');
    expect(first.style.pointerEvents).toBe('none');
    expect(harness.layer.getDiagnostics()).toMatchObject({
      mounted: true,
      destroyed: false,
      buttonCount: 0,
      canvasAriaHidden: true,
      viewportScrollListenerActive: true,
      windowListenerCount: 2
    });
  });

  test('publishes only legacy-focusable expansion hints with exact role, label, and real hit bounds', () => {
    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    harness.layer.sync({
      model: {
        boardDigest: 'board.v1.accessibility',
        modelCommitId: 42,
        cells: [makeCell([
          { id: 'expand:up', kind: 'board-expansion-will', directionKey: 'up' },
          { id: 'expand:diagonal', kind: 'board-expansion-god', directionKey: 'down-right' },
          { id: 'shrink:hidden', kind: 'board-shrink-will', directionKey: 'left' }
        ])]
      },
      getCellClientRect: () => makeRect()
    });

    const buttons = Array.from(harness.host.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.dataset.hintId)).toEqual(['expand:up', 'expand:diagonal']);
    expect(buttons[0].type).toBe('button');
    expect(buttons[0].getAttribute('role')).toBe('button');
    expect(buttons[0].tabIndex).toBe(0);
    expect(buttons[0].getAttribute('aria-label')).toBe('盤面を↑方向へ拡張');
    expect(buttons[0].style.pointerEvents).toBe('auto');
    expect(parseFloat(buttons[0].style.width)).toBeCloseTo(20);
    expect(parseFloat(buttons[0].style.height)).toBeCloseTo(20);
    // Cell-local up is (50%, 20%), the same center as the Pixi glyph; host/client offsets are removed.
    expect(parseFloat(buttons[0].style.left)).toBeCloseTo(56);
    expect(parseFloat(buttons[0].style.top)).toBeCloseTo(86.8);
    // The layer itself cannot intercept any pointer outside the two controls.
    expect(harness.layer.getElement().style.pointerEvents).toBe('none');
  });

  test('uses the native button click path for pointer/keyboard activation and mirrors focus', () => {
    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    harness.layer.sync({
      model: {
        boardDigest: 'board.v1.accessibility',
        modelCommitId: 42,
        cells: [makeCell([
          { id: 'expand:right', kind: 'board-expansion-will', directionKey: 'right' }
        ])]
      },
      getCellClientRect: () => makeRect()
    });
    const button = harness.host.querySelector('button') as HTMLButtonElement;

    button.focus();
    expect(harness.onFocus).toHaveBeenCalledWith('2,3', expect.objectContaining({ id: 'expand:right' }));
    button.blur();
    expect(harness.onBlur).toHaveBeenCalledWith('2,3', expect.objectContaining({ id: 'expand:right' }));

    button.dispatchEvent(new harness.dom.window.MouseEvent('click', { bubbles: true }));
    const enter = new harness.dom.window.KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true
    });
    button.dispatchEvent(enter);
    const space = new harness.dom.window.KeyboardEvent('keydown', {
      key: ' ', bubbles: true, cancelable: true
    });
    button.dispatchEvent(space);
    // jsdom does not synthesize native keyboard clicks; model that browser
    // activation explicitly without adding a second application key handler.
    button.click();
    button.click();

    expect(enter.defaultPrevented).toBe(false);
    expect(space.defaultPrevented).toBe(false);
    expect(harness.onActivate).toHaveBeenCalledTimes(3);
    expect(harness.onActivate).toHaveBeenLastCalledWith(
      2,
      3,
      'right',
      expect.objectContaining({
        cellKey: '2,3',
        directionKey: 'right',
        boardDigest: 'board.v1.accessibility',
        modelCommitId: 42
      })
    );
  });

  test('keeps the pointerdown model identity when a keyed hint is synced before click', () => {
    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    const hint = { id: 'expand:right', kind: 'board-expansion-will', directionKey: 'right' };
    harness.layer.sync({
      model: {
        boardDigest: 'board.v1.before-pointer-sync',
        modelCommitId: 41,
        cells: [makeCell([hint])]
      },
      getCellClientRect: () => makeRect()
    });
    const button = harness.host.querySelector('button') as HTMLButtonElement;

    button.dispatchEvent(new harness.dom.window.Event('pointerdown', { bubbles: true }));
    harness.layer.sync({
      model: {
        boardDigest: 'board.v1.after-pointer-sync',
        modelCommitId: 42,
        cells: [makeCell([hint])]
      },
      getCellClientRect: () => makeRect(188, 332)
    });
    expect(harness.host.querySelector('button')).toBe(button);

    button.dispatchEvent(new harness.dom.window.MouseEvent('click', { bubbles: true }));
    expect(harness.onActivate).toHaveBeenLastCalledWith(
      2,
      3,
      'right',
      expect.objectContaining({
        boardDigest: 'board.v1.before-pointer-sync',
        modelCommitId: 41
      })
    );

    button.click();
    expect(harness.onActivate).toHaveBeenLastCalledWith(
      2,
      3,
      'right',
      expect.objectContaining({
        boardDigest: 'board.v1.after-pointer-sync',
        modelCommitId: 42
      })
    );
  });

  test('keeps keyed focus across layout sync and clears stale focus exactly once', () => {
    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    const model = {
      cells: [makeCell([
        { id: 'expand:left', kind: 'board-expansion-god', directionKey: 'left' }
      ])]
    };
    harness.layer.sync({ model, getCellClientRect: () => makeRect() });
    const button = harness.host.querySelector('button') as HTMLButtonElement;
    button.focus();

    harness.layer.sync({ model, getCellClientRect: () => makeRect(188, 332) });
    expect(harness.host.querySelector('button')).toBe(button);
    expect(harness.document.activeElement).toBe(button);
    // Left is centered at 20% of the moved cell, the same point as the Pixi glyph.
    expect(parseFloat(button.style.left)).toBeCloseTo(86.8);

    harness.layer.sync({ model: { cells: [] }, getCellClientRect: () => null });
    expect(harness.host.querySelectorAll('button')).toHaveLength(0);
    expect(harness.onBlur).toHaveBeenCalledTimes(1);
  });

  test('refreshes geometry on camera scroll and window resize without retaining the render model', () => {
    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    let rect = makeRect();
    const model = {
      cells: [makeCell([
        { id: 'expand:up-left', kind: 'board-expansion-will', directionKey: 'up-left' }
      ])]
    };
    harness.layer.sync({ model, getCellClientRect: () => rect });
    const button = harness.host.querySelector('button') as HTMLButtonElement;
    const initialLeft = parseFloat(button.style.left);

    rect = makeRect(188, 332);
    const viewport = harness.host.querySelector('#board-scroll-viewport') as HTMLElement;
    viewport.dispatchEvent(new harness.dom.window.Event('scroll'));
    expect(harness.host.querySelector('button')).toBe(button);
    expect(parseFloat(button.style.left)).toBeCloseTo(initialLeft + 44);

    rect = makeRect(210, 354);
    harness.dom.window.dispatchEvent(new harness.dom.window.Event('resize'));
    expect(parseFloat(button.style.left)).toBeCloseTo(initialLeft + 66);

    // Mutating the old model cannot add canonical/gameplay data to the layer;
    // only the copied semantic descriptors are retained until the next sync.
    model.cells.length = 0;
    harness.layer.refresh();
    expect(harness.host.querySelector('button')).toBe(button);
  });

  test('removes clipped direction hints from the tab order and restores them after scroll', () => {
    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    let rect = makeRect();
    harness.layer.sync({
      model: {
        cells: [makeCell([
          { id: 'expand:right', kind: 'board-expansion-will', directionKey: 'right' }
        ])]
      },
      getCellClientRect: () => rect
    });
    const button = harness.host.querySelector('button') as HTMLButtonElement;
    expect(button.hidden).toBe(false);
    expect(button.tabIndex).toBe(0);

    rect = makeRect(500, 600);
    const viewport = harness.host.querySelector('#board-scroll-viewport') as HTMLElement;
    viewport.dispatchEvent(new harness.dom.window.Event('scroll'));
    expect(button.hidden).toBe(true);
    expect(button.tabIndex).toBe(-1);
    expect(button.style.pointerEvents).toBe('none');

    rect = makeRect(188, 332);
    viewport.dispatchEvent(new harness.dom.window.Event('scroll'));
    expect(harness.host.querySelector('button')).toBe(button);
    expect(button.hidden).toBe(false);
    expect(button.tabIndex).toBe(0);
  });

  test('reattaches after camera host clearing and releases only its semantic DOM on destroy', () => {
    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    harness.host.replaceChildren();
    const replacementCanvas = harness.document.createElement('canvas');
    harness.host.appendChild(replacementCanvas);
    harness.layer.sync({
      model: {
        cells: [makeCell([
          { id: 'expand:down', kind: 'board-expansion-will', directionKey: 'down' }
        ])]
      },
      getCellClientRect: () => makeRect()
    });

    expect(harness.host.querySelectorAll('.board-accessibility-layer')).toHaveLength(1);
    expect(replacementCanvas.getAttribute('aria-hidden')).toBe('true');
    harness.layer.destroy();
    harness.layer.destroy();
    expect(harness.host.querySelectorAll('.board-accessibility-layer')).toHaveLength(0);
    expect(harness.host.querySelector('canvas')).toBe(replacementCanvas);
    expect(harness.layer.getDiagnostics()).toMatchObject({
      mounted: false,
      destroyed: true,
      buttonCount: 0,
      viewportScrollListenerActive: false,
      windowListenerCount: 0,
      visualViewportListenerCount: 0
    });
  });
});

describe('expansion arrow display and hit area share one geometry', () => {
  const { BOARD_DIRECTION_KEYS, getBoardDirectionHintGeometry } = require('../ui/board-direction-hint-geometry');
  const HintView = require('../ui/pixi/hint-view');

  class FakePoint {
    x = 0;
    y = 0;
    set(x: number, y = x) { this.x = x; this.y = y; }
  }
  class FakeDisplayObject {
    label = '';
    parent: any = null;
    children: any[] = [];
    position = new FakePoint();
    anchor = new FakePoint();
    visible = true;
    text = '';
    constructor(options?: any) {
      this.label = String(options && options.label || '');
      if (options && typeof options.text === 'string') this.text = options.text;
    }
    addChild(...values: any[]) { for (const value of values) { value.parent = this; this.children.push(value); } return values[0]; }
    removeChild(value: any) { this.children = this.children.filter((child) => child !== value); value.parent = null; return value; }
    removeFromParent() { if (this.parent) this.parent.removeChild(this); }
    destroy() { this.removeFromParent(); }
    clear() { return this; }
    rect() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    circle() { return this; }
    roundRect() { return this; }
    fill() { return this; }
    stroke() { return this; }
  }

  function renderPixiGlyphCenters(cellSize: number, directionKeys: string[]) {
    const view = HintView.createPixiHintView({
      Container: FakeDisplayObject,
      Graphics: FakeDisplayObject,
      Text: FakeDisplayObject
    });
    const textStyle = { fontFamily: 'sans-serif', fontWeight: '700', fontSizeRatio: 0.4, lineHeight: 1, color: '#fff', doubleDigitScale: 1, shadows: [] };
    view.update({
      key: '2,3',
      row: 2,
      col: 3,
      kind: 'playable',
      hintPaintSignature: `paint:${directionKeys.join(',')}`,
      hintInputSignature: 'input',
      interaction: {
        legal: false,
        legalFree: false,
        selectable: false,
        selected: false,
        keyboardCursor: false,
        hovered: false,
        interactionLocked: false,
        previewKinds: [],
        selectionKinds: [],
        directionHints: directionKeys.map((directionKey) => ({ id: `expand:${directionKey}`, kind: 'board-expansion-will', directionKey }))
      }
    }, {
      layout: { cellSize },
      theme: { gridLineWidth: 1, legalHint: {}, directionHint: textStyle },
      interactionRevisionSignature: 'interaction:1',
      sceneX: 0,
      sceneY: 0,
      sceneOffsetX: 0,
      sceneOffsetY: 0
    });
    const root = view.root || view.displayObject || null;
    const texts: any[] = [];
    const visit = (node: any) => {
      if (!node) return;
      if (String(node.label).startsWith('pixi-direction-hint:')) texts.push(node);
      for (const child of node.children || []) visit(child);
    };
    for (const candidate of [root, ...(Object.values(view) as any[])]) visit(candidate);
    const byKey = new Map<string, { glyph: string; x: number; y: number }>();
    for (const text of texts) {
      byKey.set(String(text.label).replace('pixi-direction-hint:expand:', ''), { glyph: text.text, x: text.position.x, y: text.position.y });
    }
    return byKey;
  }

  test('all eight directions put the transparent button center on the Pixi glyph center', () => {
    expect([...BOARD_DIRECTION_KEYS].sort()).toEqual(['down', 'down-left', 'down-right', 'left', 'right', 'up', 'up-left', 'up-right']);
    const cellSize = 44;
    const glyphs = renderPixiGlyphCenters(cellSize, [...BOARD_DIRECTION_KEYS]);
    expect(glyphs.size).toBe(8);

    const harness = createHarness();
    harness.layer.mount(harness.host, harness.canvas);
    harness.layer.sync({
      model: {
        boardDigest: 'board.v1.geometry',
        modelCommitId: 7,
        cells: [makeCell(BOARD_DIRECTION_KEYS.map((directionKey: string) => ({ id: `expand:${directionKey}`, kind: 'board-expansion-will', directionKey })))]
      },
      getCellClientRect: () => makeRect()
    });
    const buttons = Array.from(harness.host.querySelectorAll('button')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(8);
    const cellLocalLeft = 144 - 100;
    const cellLocalTop = 288 - 200;
    for (const button of buttons) {
      const directionKey = String(button.dataset.direction);
      const size = parseFloat(button.style.width);
      const hitCenter = {
        x: parseFloat(button.style.left) + size / 2 - cellLocalLeft,
        y: parseFloat(button.style.top) + size / 2 - cellLocalTop
      };
      const glyph = glyphs.get(directionKey)!;
      expect({ directionKey, glyph: button.textContent }).toEqual({ directionKey, glyph: glyph.glyph });
      expect(hitCenter.x).toBeCloseTo(glyph.x, 6);
      expect(hitCenter.y).toBeCloseTo(glyph.y, 6);
      const geometry = getBoardDirectionHintGeometry(directionKey);
      expect(glyph.x).toBeCloseTo(geometry.x * cellSize, 6);
      expect(glyph.y).toBeCloseTo(geometry.y * cellSize, 6);
    }
  });

  test('legacy top/bottom keys resolve to the same up/down geometry on both sides', () => {
    const glyphs = renderPixiGlyphCenters(40, ['top', 'bottom']);
    expect(glyphs.get('top')).toEqual({ glyph: '↑', x: 20, y: 8 });
    expect(glyphs.get('bottom')).toEqual({ glyph: '↓', x: 20, y: 32 });
    expect(getBoardDirectionHintGeometry('TOP')).toBe(getBoardDirectionHintGeometry('up'));
    expect(getBoardDirectionHintGeometry('bottom')).toBe(getBoardDirectionHintGeometry('down'));
    expect(getBoardDirectionHintGeometry('sideways')).toBeNull();
  });
});
