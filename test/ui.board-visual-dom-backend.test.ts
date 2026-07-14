import { JSDOM } from 'jsdom';

describe('DomBoardVisualBackend diagnostics', () => {
  afterEach(() => {
    jest.dontMock('../ui/diff-renderer');
    jest.dontMock('../ui/board-visual/model-builder');
    jest.dontMock('../ui/board-visual/frame-presenter');
    jest.resetModules();
  });

  test('reports actual materialized playable, hole, void, and offscreen cells', () => {
    jest.doMock('../ui/diff-renderer', () => ({
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

    const { createDomBoardVisualBackend } = require('../ui/board-visual/dom-backend');
    const dom = new JSDOM('<!doctype html><div id="board"></div>');
    const host = dom.window.document.getElementById('board') as HTMLElement;
    const backend = createDomBoardVisualBackend();
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
    dom.window.close();
  });
});
