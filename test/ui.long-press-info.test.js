const { JSDOM } = require('jsdom');

describe('board cell long press info', () => {
  function dispatchPointer(target, type, props) {
    const ev = new Event(type, { bubbles: true, cancelable: true });
    const p = props || {};
    Object.defineProperty(ev, 'button', { value: p.button ?? 0 });
    Object.defineProperty(ev, 'clientX', { value: p.clientX ?? 0 });
    Object.defineProperty(ev, 'clientY', { value: p.clientY ?? 0 });
    target.dispatchEvent(ev);
  }

  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    global.window = dom.window;
    global.document = dom.window.document;
    global.Event = dom.window.Event;
    jest.useFakeTimers();

    global.BLACK = 1;
    global.WHITE = -1;
    global.EMPTY = 0;
    global.handleCellClick = jest.fn();
    global.cardState = { markers: [] };
    global.gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    const board = document.createElement('div');
    board.id = 'board';
    document.body.appendChild(board);
  });

  afterEach(() => {
    jest.useRealTimers();
    try { delete global.window; } catch (e) {}
    try { delete global.document; } catch (e) {}
    try { delete global.Event; } catch (e) {}
  });

  test('short press keeps normal click behavior', () => {
    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 2, 3);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 50, clientY: 60 });
    jest.advanceTimersByTime(120);
    dispatchPointer(cell, 'pointerup', { button: 0, clientX: 50, clientY: 60 });

    expect(global.handleCellClick).toHaveBeenCalledTimes(1);
    expect(global.handleCellClick).toHaveBeenCalledWith(2, 3);
  });

  test('long press shows info and does not execute click action', () => {
    global.cardState.markers.push({
      kind: 'specialStone',
      row: 1,
      col: 1,
      owner: 'black',
      data: { type: 'BREEDING', remainingOwnerTurns: 2 }
    });

    const mod = require('../ui/diff-renderer.js');
    const cell = document.createElement('div');
    document.getElementById('board').appendChild(cell);
    mod.attachBoardCellInteraction(cell, 1, 1);

    dispatchPointer(cell, 'pointerdown', { button: 0, clientX: 80, clientY: 90 });
    jest.advanceTimersByTime(430);

    const panel = document.getElementById('stone-info-panel');
    expect(panel).not.toBeNull();
    expect(panel.classList.contains('visible')).toBe(true);
    expect(document.getElementById('stone-info-name').textContent).toBe('繁殖石');
    expect(document.getElementById('stone-info-meta').textContent).toContain('反転保護');
    expect(document.getElementById('stone-info-meta').textContent).toContain('交換保護');

    dispatchPointer(cell, 'pointerup', { button: 0, clientX: 80, clientY: 90 });
    expect(global.handleCellClick).toHaveBeenCalledTimes(0);

    jest.advanceTimersByTime(10000);
    expect(panel.classList.contains('visible')).toBe(true);

    dispatchPointer(document.body, 'pointerdown', { button: 0, clientX: 5, clientY: 5 });
    expect(panel.classList.contains('visible')).toBe(false);
  });
});
