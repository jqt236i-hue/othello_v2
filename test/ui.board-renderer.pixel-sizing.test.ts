import { JSDOM } from 'jsdom';

describe('board renderer pixel sizing', () => {
  let dom;

  beforeEach(() => {
    jest.resetModules();

    dom = new JSDOM(
      '<!doctype html><html><body><div id="game-container"><div id="board-frame" style="padding: 25px; box-sizing: border-box;"><div id="board"></div></div></div></body></html>'
    );
    global.window = dom.window;
    global.document = dom.window.document;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) {
      // ignore
    }

    delete global.window;
    delete global.document;
  });

  test('syncBoardPixelSizing shrinks an initial 8x9 board from the standard 8x8 baseline', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 8, cols: 9 });

    expect(boardEl.style.width).toBe('693px');
    expect(boardEl.style.height).toBe('616px');
    expect(boardEl.style.getPropertyValue('--board-cell-size-px')).toBe('77px');
    expect(boardEl.style.getPropertyValue('--board-cell-scale')).toBe(String(77 / 87));
    expect(boardEl.style.getPropertyValue('--board-disc-inset-px')).toBe('4px');
    expect(boardEl.style.getPropertyValue('--board-disc-size-px')).toBe('69px');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-width')).toBe('');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-height')).toBe('');
    expect(document.body.classList.contains('board-oversize-active')).toBe(false);
  });

  test('syncBoardPixelSizing progressively shrinks larger initial boards', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 10, cols: 10 });

    expect(boardEl.style.width).toBe('690px');
    expect(boardEl.style.height).toBe('690px');
    expect(boardEl.style.getPropertyValue('--board-cell-size-px')).toBe('69px');
    expect(boardEl.style.getPropertyValue('--board-cell-scale')).toBe(String(69 / 87));
    expect(boardEl.style.getPropertyValue('--board-disc-inset-px')).toBe('3px');
    expect(boardEl.style.getPropertyValue('--board-disc-size-px')).toBe('63px');
  });

  test('syncBoardPixelSizing fits the maximum 16x16 board into the 8x8 baseline area', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 16, cols: 16 });

    expect(boardEl.style.width).toBe('688px');
    expect(boardEl.style.height).toBe('688px');
    expect(boardEl.style.getPropertyValue('--board-cell-size-px')).toBe('43px');
    expect(boardEl.style.getPropertyValue('--board-cell-scale')).toBe(String(43 / 87));
    expect(boardEl.style.getPropertyValue('--board-disc-inset-px')).toBe('2px');
    expect(boardEl.style.getPropertyValue('--board-disc-size-px')).toBe('39px');
  });

  test('syncBoardPixelSizing leaves standard 8x8 frame sizing unchanged', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 8, cols: 8 });

    expect(boardEl.style.width).toBe('696px');
    expect(boardEl.style.height).toBe('696px');
    expect(boardEl.style.getPropertyValue('--board-cell-size-px')).toBe('87px');
    expect(boardEl.style.getPropertyValue('--board-cell-scale')).toBe('1');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-width')).toBe('');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-height')).toBe('');
    expect(document.body.classList.contains('board-oversize-active')).toBe(false);
  });

  test('syncBoardPixelSizing keeps standard 8x8 out of oversize mode even when border-box rounding would expand the frame', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    const originalCreateElement = document.createElement.bind(document);

    frameEl.style.padding = '20.8333px';
    frameEl.style.boxSizing = 'border-box';
    frameEl.getBoundingClientRect = () => ({ width: 463.65625, height: 463.65625 });
    boardEl.style.boxSizing = 'border-box';
    boardEl.style.border = '3px solid #000';

    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);
      if (String(tagName || '').toLowerCase() === 'div') {
        el.getBoundingClientRect = () => ({ width: 458.3333, height: 458.3333 });
      }
      return el;
    });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 8, cols: 8 });

    expect(boardEl.style.width).toBe('422px');
    expect(boardEl.style.height).toBe('422px');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-width')).toBe('');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-height')).toBe('');
    expect(document.body.classList.contains('board-oversize-active')).toBe(false);
  });

  test('syncBoardPixelSizing measures asymmetric board frame padding variables', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    const originalCreateElement = document.createElement.bind(document);
    let probeWidthExpression = '';
    let probeHeightExpression = '';

    frameEl.style.paddingTop = '18px';
    frameEl.style.paddingRight = '25px';
    frameEl.style.paddingBottom = '25px';
    frameEl.style.paddingLeft = '25px';
    frameEl.getBoundingClientRect = () => ({ width: 470, height: 463 });

    jest.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);
      if (String(tagName || '').toLowerCase() === 'div') {
        Object.defineProperty(el.style, 'width', {
          configurable: true,
          set(value) {
            const nextValue = String(value || '');
            if (nextValue.includes('--board-frame-padding')) probeWidthExpression = nextValue;
          },
          get() { return probeWidthExpression; }
        });
        Object.defineProperty(el.style, 'height', {
          configurable: true,
          set(value) {
            const nextValue = String(value || '');
            if (nextValue.includes('--board-frame-padding')) probeHeightExpression = nextValue;
          },
          get() { return probeHeightExpression; }
        });
        el.getBoundingClientRect = function () {
          return { width: 470, height: 463 };
        };
      }
      return el;
    });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 8, cols: 8 });

    expect(probeWidthExpression).toContain('var(--board-frame-padding-left');
    expect(probeWidthExpression).toContain('var(--board-frame-padding-right');
    expect(probeHeightExpression).toContain('var(--board-frame-padding-top');
    expect(probeHeightExpression).toContain('var(--board-frame-padding-bottom');
    expect(boardEl.style.width).toBe('416px');
    expect(boardEl.style.height).toBe('416px');
  });

  test('syncBoardPixelSizing nudges the board onto whole-screen pixels without using transform compositing', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });
    boardEl.getBoundingClientRect = () => ({ width: 783, height: 696, left: 123.25, top: 87.75 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 8, cols: 9 });

    expect(boardEl.style.left).toBe('-0.25px');
    expect(boardEl.style.top).toBe('0.25px');
    expect(boardEl.style.transform).toBe('');
  });

  test('syncBoardPixelSizing anchors existing cells while render bounds grow in any direction', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });
    boardEl.getBoundingClientRect = () => ({ width: 783, height: 696, left: 100, top: 100 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, {
      rows: 8,
      cols: 9,
      baseRows: 8,
      baseCols: 8,
      minRow: 0,
      minCol: -1
    });

    expect(boardEl.style.left).toBe('-43.5px');
    expect(boardEl.style.top).toBe('');

    boardRenderer.syncBoardPixelSizing(boardEl, {
      rows: 8, cols: 9, baseRows: 8, baseCols: 8, minRow: 0, minCol: 0
    });
    expect(boardEl.style.left).toBe('43.5px');
    expect(boardEl.style.top).toBe('');

    boardRenderer.syncBoardPixelSizing(boardEl, {
      rows: 9, cols: 8, baseRows: 8, baseCols: 8, minRow: -1, minCol: 0
    });
    expect(boardEl.style.left).toBe('');
    expect(boardEl.style.top).toBe('-43.5px');

    boardRenderer.syncBoardPixelSizing(boardEl, {
      rows: 9, cols: 8, baseRows: 8, baseCols: 8, minRow: 0, minCol: 0
    });
    expect(boardEl.style.left).toBe('');
    expect(boardEl.style.top).toBe('43.5px');
  });

  test('syncBoardPixelSizing keeps the initial 8x8 scale after card expansion', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, {
      rows: 10,
      cols: 10,
      baseRows: 8,
      baseCols: 8,
      minRow: -1,
      minCol: -1
    });

    expect(boardEl.style.width).toBe('870px');
    expect(boardEl.style.height).toBe('870px');
    expect(boardEl.style.getPropertyValue('--board-cell-size-px')).toBe('87px');
    expect(boardEl.style.getPropertyValue('--board-cell-scale')).toBe('1');
  });

  test('syncBoardPixelSizing retains the asymmetric anchor during resize resync', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });
    boardEl.getBoundingClientRect = () => ({ width: 783, height: 696, left: 100, top: 100 });

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, {
      rows: 8,
      cols: 9,
      baseRows: 8,
      baseCols: 8,
      minRow: 0,
      minCol: -1
    });
    boardRenderer.syncBoardPixelSizing(boardEl);

    expect(boardEl.style.left).toBe('-43.5px');
  });

  test('syncBoardPixelSizing adds border thickness when the board uses border-box sizing', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 750, height: 750 });
    boardEl.style.boxSizing = 'border-box';
    boardEl.style.border = '4px solid #000';

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 8, cols: 9 });

    expect(boardEl.style.width).toBe('701px');
    expect(boardEl.style.height).toBe('624px');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-width')).toBe('');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-height')).toBe('');
  });

  test('syncBoardPixelSizing clears stale inline sizing when the board cannot be measured', () => {
    const frameEl = document.getElementById('board-frame');
    const boardEl = document.getElementById('board');
    frameEl.getBoundingClientRect = () => ({ width: 0, height: 0 });
    boardEl.style.width = '700px';
    boardEl.style.height = '700px';
    boardEl.style.left = '-0.25px';
    boardEl.style.top = '0.25px';
    boardEl.style.setProperty('--board-cell-size-px', '100px');
    boardEl.style.setProperty('--board-cell-scale', '0.8');
    boardEl.style.setProperty('--board-disc-inset-px', '5px');
    boardEl.style.setProperty('--board-disc-size-px', '90px');
    frameEl.style.setProperty('--board-frame-outer-width', '800px');
    frameEl.style.setProperty('--board-frame-outer-height', '780px');
    document.body.classList.add('board-oversize-active');

    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.syncBoardPixelSizing(boardEl, { rows: 7, cols: 7 });

    expect(boardEl.style.width).toBe('');
    expect(boardEl.style.height).toBe('');
    expect(boardEl.style.left).toBe('');
    expect(boardEl.style.top).toBe('');
    expect(boardEl.style.transform).toBe('');
    expect(boardEl.style.getPropertyValue('--board-cell-size-px')).toBe('');
    expect(boardEl.style.getPropertyValue('--board-cell-scale')).toBe('');
    expect(boardEl.style.getPropertyValue('--board-disc-inset-px')).toBe('');
    expect(boardEl.style.getPropertyValue('--board-disc-size-px')).toBe('');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-width')).toBe('');
    expect(frameEl.style.getPropertyValue('--board-frame-outer-height')).toBe('');
    expect(document.body.classList.contains('board-oversize-active')).toBe(false);
  });
});
