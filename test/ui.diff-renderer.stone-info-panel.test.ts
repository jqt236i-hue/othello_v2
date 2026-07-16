import { JSDOM } from 'jsdom';

describe('DiffRenderer stone info panel DOM shell', () => {
  function setupDom(body = '<div id="board"></div>') {
    jest.resetModules();
    const dom = new JSDOM(`<!doctype html><html><body>${body}</body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.handleCellClick = jest.fn();
    global.cardState = { markers: [] };
    global.gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    const inputController = {
      handlePointer: jest.fn(),
      handleKeyboard: jest.fn(),
      getState: jest.fn(() => ({ activePointerId: null }))
    };
    require('../ui/board-renderer/stone-helpers.ts').setBoardRendererStoneHelpers({
      getBoardInputController: () => inputController
    });
    return require('../ui/diff-renderer.js');
  }

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.Event;
    delete global.BLACK;
    delete global.WHITE;
    delete global.EMPTY;
    delete global.handleCellClick;
    delete global.cardState;
    delete global.gameState;
    delete (global as any).BoardRendererStoneHelpers;
  });

  test('creates stone info panel below manifest panel when the left stack exists', () => {
    const mod = setupDom('<div id="board"></div><div id="left-info-stack"><div id="effect-live-panel"></div><div id="manifest-effect-panel"></div></div>');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);

    mod.attachBoardCellInteraction(cell, 1, 1);

    const stackChildren = Array.from(document.getElementById('left-info-stack').children).map((el) => el.id);
    expect(stackChildren).toEqual(['effect-live-panel', 'manifest-effect-panel', 'stone-info-panel']);
  });

  test('reuses an existing stone info panel', () => {
    const mod = setupDom('<div id="board"></div><div id="stone-info-panel" class="stone-info-panel"><div id="stone-info-name"></div><div id="stone-info-desc"></div><div id="stone-info-meta"></div></div>');
    const existing = document.getElementById('stone-info-panel');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);

    mod.attachBoardCellInteraction(cell, 1, 1);

    expect(document.getElementById('stone-info-panel')).toBe(existing);
  });

  test('hover-capable and hover-none media query branches do not throw', () => {
    const mod = setupDom();
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 1, 1);
    window.matchMedia = jest.fn((query) => ({ matches: query.includes('hover: none') }));

    expect(() => {
      cell.dispatchEvent(new Event('pointerenter', { bubbles: true }));
      cell.dispatchEvent(new Event('pointerup', { bubbles: true }));
    }).not.toThrow();
  });
});
