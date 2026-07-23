import { JSDOM } from 'jsdom';

describe('DomBoardVisualBackend diagnostics', () => {
  afterEach(() => {
    jest.dontMock('../ui/board-dom-compat/renderer');
    jest.dontMock('../ui/board-visual/model-builder');
    jest.dontMock('../ui/board-visual/frame-presenter');
    jest.resetModules();
  });

  test('reports actual materialized playable, hole, void, and offscreen cells', () => {
    jest.doMock('../ui/board-dom-compat/renderer', () => ({
      renderBoardDiff: jest.fn((host: HTMLElement) => {
        host.innerHTML = [
          '<div class="cell" data-row="0" data-col="0"></div>',
          '<div class="cell" data-row="0" data-col="1"></div>',
          '<div class="cell cell-void" data-row="1" data-col="1" aria-hidden="true"></div>'
        ].join('');
      }),
      resetRenderStats: jest.fn()
    }));
    jest.doMock('../ui/board-visual/model-builder', () => ({
      buildDomCompatibilityRenderState: jest.fn(() => ({
        renderProjection: { valid: true },
        cellState: []
      }))
    }));
    jest.doMock('../ui/board-visual/frame-presenter', () => ({
      presentBoardFrame: jest.fn()
    }));

    const { createDomBoardVisualBackend } = require('../ui/board-dom-compat/backend');
    const compatibilityRenderer = require('../ui/board-dom-compat/renderer');
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const backend = createDomBoardVisualBackend({ compatibilityRenderer });
    const playable = Object.freeze({
      key: '0,0', row: 0, col: 0, kind: 'playable', visualSignature: 'playable:0,0'
    });
    const hole = Object.freeze({
      key: '0,1', row: 0, col: 1, kind: 'hole', visualSignature: 'hole:0,1'
    });
    const offscreenPlayable = Object.freeze({
      key: '2,2', row: 2, col: 2, kind: 'playable', visualSignature: 'playable:2,2'
    });
    const frame = {
      frameToken: 'idle:materialization',
      model: {
        visualRevision: 1,
        topology: { minRow: 0, maxRow: 2, minCol: 0, maxCol: 2 },
        cells: [playable, hole, offscreenPlayable]
      },
      layout: {},
      appearance: {},
      theme: {}
    } as any;

    backend.mount(host, {});
    backend.applyFrame(frame);

    expect(backend.getDiagnostics()).toEqual({
      canvasCount: 0,
      contextCount: 0,
      domCellCount: 3,
      computedStyleReady: false
    });
    expect(backend.getDisplayObjectCounts()).toEqual({ total: 3, active: 3, pooled: 0 });
    expect(backend.getTextureLeaseCounts()).toEqual({ total: 0, active: 0, pooled: 0 });
    expect(Object.isFrozen(backend.getDiagnostics())).toBe(true);

    expect(backend.getRenderedCell(0, 0)).toMatchObject({
      kind: 'playable', semanticKind: 'playable', rendered: true, ephemeral: false
    });
    expect(backend.getRenderedCell(0, 1)).toMatchObject({
      kind: 'hole', semanticKind: 'hole', rendered: true, ephemeral: false
    });
    expect(backend.getRenderedCell(1, 1)).toEqual({
      key: '1,1',
      row: 1,
      col: 1,
      kind: 'void',
      semanticKind: 'void',
      rendered: true,
      ephemeral: true,
      visualSignature: 'void:1,1'
    });
    expect(backend.getRenderedCell(2, 2)).toEqual({
      key: '2,2',
      row: 2,
      col: 2,
      kind: 'offscreen',
      semanticKind: 'playable',
      rendered: false,
      ephemeral: false,
      visualSignature: 'playable:2,2'
    });
    expect(backend.getRenderedCell(5, 5)).toBeNull();
    expect(Object.isFrozen(backend.getRenderedCell(0, 0))).toBe(true);

    backend.destroy();
    expect(backend.getRenderedCell(0, 0)).toBeNull();
    expect(backend.getDiagnostics()).toMatchObject({ domCellCount: 0 });
    dom.window.close();
  });

  test('controller writer routes compatibility board pixels through the owned DOM runtime', async () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board"><div class="cell" data-row="1" data-col="2"></div></div>
    </body></html>`);
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;

    try {
      const { createDomBoardVisualBackend } = require('../ui/board-dom-compat/backend');
      const { createBoardVisualController } = require('../ui/board-visual/controller');
      const host = dom.window.document.getElementById('board') as HTMLElement;
      const backend = createDomBoardVisualBackend();
      const controller = createBoardVisualController({ backend });
      await controller.mount(host);
      const token = controller.claimWriter('local:dom-runtime-test', 'local');

      await controller.playPhase(token, [{
        type: '__dom_compatibility_final_state',
        sourceEvent: {
          type: 'legacy_fixture',
          targets: [{ r: 1, col: 2, after: { color: 1, owner: 'black', special: null } }]
        }
      }]);

      expect(host.querySelector('.cell[data-row="1"][data-col="2"] .disc.black')).toBeTruthy();
      expect(controller.releaseWriter(token)).toBe(true);
      controller.destroy();
    } finally {
      dom.window.close();
      delete (global as any).window;
      delete (global as any).document;
    }
  });

  test('waits for stone visual preparation before claiming the DOM host', async () => {
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    let resolvePreparation: ((value: any) => void) | null = null;
    const prepareStoneVisuals = jest.fn(() => new Promise((resolve) => {
      resolvePreparation = resolve;
    }));
    const { createDomBoardVisualBackend } = require('../ui/board-dom-compat/backend');
    const compatibilityRenderer = {
      renderBoardDiff: jest.fn(),
      resetRenderStats: jest.fn()
    };
    const backend = createDomBoardVisualBackend({ compatibilityRenderer, prepareStoneVisuals });
    const mount = backend.mount(host, {});

    expect(prepareStoneVisuals).toHaveBeenCalledWith(dom.window.document);
    expect(backend.getDiagnostics()).toMatchObject({ domCellCount: 0 });
    resolvePreparation!({ success: true, loaded: [], failed: [] });
    await expect(mount).resolves.toBeUndefined();
    dom.window.close();
  });

  test('waits for compatibility stylesheet before assets and DOM host ownership', async () => {
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    let resolveStylesheet!: () => void;
    const order: string[] = [];
    const prepareStylesheet = jest.fn(() => new Promise<void>((resolve) => {
      resolveStylesheet = () => {
        order.push('stylesheet-ready');
        resolve();
      };
    }));
    const prepareStoneVisuals = jest.fn(async () => {
      order.push('stone-visuals-ready');
      return { success: true, loaded: [], failed: [] };
    });
    const { createDomBoardVisualBackend } = require('../ui/board-dom-compat/backend');
    const backend = createDomBoardVisualBackend({
      compatibilityRenderer: {
        renderBoardDiff: jest.fn(),
        resetRenderStats: jest.fn()
      },
      prepareStylesheet,
      prepareStoneVisuals
    });

    const mount = backend.mount(host, {});
    expect(prepareStylesheet).toHaveBeenCalledWith(dom.window.document);
    expect(prepareStoneVisuals).not.toHaveBeenCalled();
    expect(host.dataset.cardReversiDomBackendMountedAt).toBeUndefined();

    resolveStylesheet();
    await expect(mount).resolves.toBeUndefined();
    expect(order).toEqual(['stylesheet-ready', 'stone-visuals-ready']);
    expect(Number(host.dataset.cardReversiDomBackendMountedAt)).toBeGreaterThanOrEqual(0);
    dom.window.close();
  });

  test('does not claim the DOM host when compatibility stylesheet loading fails', async () => {
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const stylesheetError = new Error('compatibility CSS unavailable');
    const prepareStoneVisuals = jest.fn();
    const { createDomBoardVisualBackend } = require('../ui/board-dom-compat/backend');
    const backend = createDomBoardVisualBackend({
      compatibilityRenderer: {
        renderBoardDiff: jest.fn(),
        resetRenderStats: jest.fn()
      },
      prepareStylesheet: jest.fn(async () => {
        throw stylesheetError;
      }),
      prepareStoneVisuals
    });

    await expect(backend.mount(host, {})).rejects.toBe(stylesheetError);
    expect(prepareStoneVisuals).not.toHaveBeenCalled();
    expect(host.dataset.cardReversiDomBackendMountedAt).toBeUndefined();
    expect(backend.getDiagnostics()).toMatchObject({ domCellCount: 0 });
    dom.window.close();
  });

  test('rejects DOM mount when required stone visuals cannot be prepared', async () => {
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const { createDomBoardVisualBackend } = require('../ui/board-dom-compat/backend');
    const backend = createDomBoardVisualBackend({
      compatibilityRenderer: {
        renderBoardDiff: jest.fn(),
        resetRenderStats: jest.fn()
      },
      prepareStoneVisuals: jest.fn(async () => ({
        success: false,
        loaded: [],
        failed: [{ src: '/special.png', reason: 'load failed' }]
      }))
    });

    await expect(backend.mount(host, {})).rejects.toMatchObject({
      code: 'dom_compatibility_stone_visual_prepare_failed',
      stage: 'compatibility-assets',
      failedAssets: [{ src: '/special.png', reason: 'load failed' }]
    });
    expect(backend.getDiagnostics()).toMatchObject({ domCellCount: 0 });
    dom.window.close();
  });
});
