import { JSDOM } from 'jsdom';

describe('board DOM layout geometry reader', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board-frame"><div id="board"></div></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
  });

  test('keeps origin live while reusing unchanged frame inset metrics', () => {
    const frame = document.getElementById('board-frame') as HTMLElement;
    const board = document.getElementById('board') as HTMLElement;
    const boardRect = jest.fn(() => ({ left: 9, top: 11 }));
    let frameLeft = 100;
    const frameRect = jest.fn(() => ({ left: frameLeft, top: 200 }));
    board.getBoundingClientRect = boardRect as any;
    frame.getBoundingClientRect = frameRect as any;
    const computedStyle = jest.fn(() => ({
      paddingTop: '18px',
      paddingRight: '25px',
      paddingBottom: '26px',
      paddingLeft: '24px'
    }));
    Object.defineProperty(dom.window, 'getComputedStyle', {
      configurable: true,
      value: computedStyle
    });
    const reader = require('../ui/board-visual/dom-layout-geometry');
    const appearance = {
      boardFrameLayout: { paddingTop: 18, paddingRight: 25, paddingBottom: 26, paddingLeft: 24 }
    };

    const first = reader.readBoardFrameGeometryForLayout(board, appearance, 3);
    frameLeft = 140;
    const second = reader.readBoardFrameGeometryForLayout(board, appearance, 3);

    expect(first.clientOrigin).toEqual({ x: 100, y: 200 });
    expect(second.clientOrigin).toEqual({ x: 140, y: 200 });
    expect(second.frameInset).toBe(first.frameInset);
    expect(frameRect).toHaveBeenCalledTimes(2);
    expect(boardRect).not.toHaveBeenCalled();
    expect(computedStyle).toHaveBeenCalledTimes(1);
  });

  test('invalidates inset metrics when a layout boundary changes', () => {
    const frame = document.getElementById('board-frame') as HTMLElement;
    const board = document.getElementById('board') as HTMLElement;
    frame.getBoundingClientRect = jest.fn(() => ({ left: 0, top: 0 })) as any;
    const computedStyle = jest.fn(() => ({
      paddingTop: '20px',
      paddingRight: '20px',
      paddingBottom: '20px',
      paddingLeft: '20px'
    }));
    Object.defineProperty(dom.window, 'getComputedStyle', {
      configurable: true,
      value: computedStyle
    });
    const reader = require('../ui/board-visual/dom-layout-geometry');
    const appearance = { boardFrameLayout: { paddingTop: 20 } };

    reader.readBoardFrameGeometryForLayout(board, appearance, 1);
    document.documentElement.classList.add('layout-profile-phone-portrait');
    reader.readBoardFrameGeometryForLayout(board, appearance, 1);
    reader.readBoardFrameGeometryForLayout(board, appearance, 2);

    expect(computedStyle).toHaveBeenCalledTimes(3);
  });

  test('reads the host rect only when no board frame exists', () => {
    const board = document.getElementById('board') as HTMLElement;
    document.body.appendChild(board);
    const boardRect = jest.fn(() => ({ left: 31, top: 47 }));
    board.getBoundingClientRect = boardRect as any;
    const reader = require('../ui/board-visual/dom-layout-geometry');

    const geometry = reader.readBoardFrameGeometryForLayout(board, null, 0);

    expect(geometry).toEqual({
      clientOrigin: { x: 31, y: 47 },
      frameInset: { top: 0, right: 0, bottom: 0, left: 0 }
    });
    expect(boardRect).toHaveBeenCalledTimes(1);
  });
});
