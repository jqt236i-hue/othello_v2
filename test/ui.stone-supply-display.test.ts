import { JSDOM } from 'jsdom';

type Player = 'black' | 'white';
type RenderStoneSupplyTrays = (frame: HTMLElement | null, cardState: unknown) => void;

function supplyState(initial = 30, black = initial, white = initial) {
  return { stoneSupply: { initial, remainingByPlayer: { black, white } } };
}

function getTray(frame: HTMLElement, player: Player): HTMLElement {
  const trays = frame.querySelectorAll<HTMLElement>(`.board-stone-supply--${player}`);
  expect(trays).toHaveLength(1);
  return trays[0];
}

function expectSupply(frame: HTMLElement, player: Player, remaining: number, visibleDiscs: number) {
  const tray = getTray(frame, player);
  expect(tray.hidden).toBe(false);
  expect(tray.dataset.player).toBe(player);
  const counts = tray.querySelectorAll('.board-stone-supply-count');
  expect(counts).toHaveLength(1);
  expect(counts[0].textContent?.trim()).toBe(String(remaining));
  const stacks = tray.querySelectorAll('.board-stone-supply-stack');
  expect(stacks).toHaveLength(1);
  expect(stacks[0].querySelectorAll('.board-stone-supply-disc')).toHaveLength(visibleDiscs);
  expect(tray.querySelectorAll('.board-stone-supply-disc')).toHaveLength(visibleDiscs);
  return tray;
}

function expectDisabled(frame: HTMLElement) {
  // Removing the trays entirely and clearing retained, hidden trays are both valid.
  for (const player of ['white', 'black'] as const) {
    const trays = frame.querySelectorAll<HTMLElement>(`.board-stone-supply--${player}`);
    expect(trays.length).toBeLessThanOrEqual(1);
    for (const tray of trays) {
      expect(tray.hidden).toBe(true);
      expect(tray.querySelectorAll('.board-stone-supply-disc')).toHaveLength(0);
      expect(tray.title).not.toMatch(/\d/);
      for (const count of tray.querySelectorAll('.board-stone-supply-count')) {
        expect(count.textContent?.trim()).toBe('');
      }
      // Accessible tray labels must not retain a previous numeric remainder either.
      for (const labelled of [tray, ...Array.from(tray.querySelectorAll('[aria-label]'))]) {
        expect(labelled.getAttribute('aria-label') || '').not.toMatch(/\d/);
      }
    }
  }
}

describe('board stone supply trays', () => {
  let dom: JSDOM;
  let frame: HTMLElement;
  let renderStoneSupplyTrays: RenderStoneSupplyTrays;
  let previousWindow: PropertyDescriptor | undefined;
  let previousDocument: PropertyDescriptor | undefined;

  beforeEach(() => {
    previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    dom = new JSDOM(
      '<!doctype html><html><body>' +
      '<div id="board-frame">' +
      '<div id="board" data-owner="board-renderer"><button class="cell">盤面</button></div>' +
      '<canvas id="board-canvas" width="480" height="480" data-owner="pixi"></canvas>' +
      '</div>' +
      '</body></html>',
      { url: 'http://localhost/' }
    );
    Object.defineProperty(globalThis, 'window', {
      configurable: true, writable: true, value: dom.window
    });
    Object.defineProperty(globalThis, 'document', {
      configurable: true, writable: true, value: dom.window.document
    });
    frame = dom.window.document.getElementById('board-frame') as HTMLElement;
    jest.resetModules();
    // Require the source directly: this suite must not depend on a browser build.
    ({ renderStoneSupplyTrays } = require('../ui/stone-supply-display.ts'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    dom.window.close();
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as any).window;
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument);
    else delete (globalThis as any).document;
  });

  test('creates one white and one black tray as separate frame children, outside the board and canvas', () => {
    renderStoneSupplyTrays(frame, supplyState());

    const white = expectSupply(frame, 'white', 30, 30);
    const black = expectSupply(frame, 'black', 30, 30);
    expect(white.parentElement).toBe(frame);
    expect(black.parentElement).toBe(frame);
    expect(frame.querySelector('#board .board-stone-supply-disc')).toBeNull();
    expect(frame.querySelector('canvas .board-stone-supply-disc')).toBeNull();
  });

  test('removes exactly one displayed disc for each stone spent on a standard board', () => {
    const state = supplyState();
    renderStoneSupplyTrays(frame, state);

    state.stoneSupply.remainingByPlayer.black -= 1;
    renderStoneSupplyTrays(frame, state);
    expectSupply(frame, 'black', 29, 29);
    expectSupply(frame, 'white', 30, 30);

    state.stoneSupply.remainingByPlayer.white -= 1;
    renderStoneSupplyTrays(frame, state);
    expectSupply(frame, 'black', 29, 29);
    expectSupply(frame, 'white', 29, 29);

    state.stoneSupply.remainingByPlayer.black -= 1;
    renderStoneSupplyTrays(frame, state);
    expectSupply(frame, 'black', 28, 28);
    expectSupply(frame, 'white', 29, 29);
  });

  test.each([4, 12, 30])('uses actual disc counts when the initial supply is %i (at most 30)', (initial) => {
    renderStoneSupplyTrays(frame, supplyState(initial, initial, initial - 1));
    expectSupply(frame, 'black', initial, initial);
    expectSupply(frame, 'white', initial - 1, initial - 1);
  });

  test.each([
    [70, 70, 30],
    [70, 69, 30],
    [70, 35, 15],
    [70, 34, 15],
    [70, 1, 1],
    [70, 0, 0],
    [126, 64, 16]
  ])('scales initial %i / remaining %i to %i discs while keeping the exact count', (initial, remaining, discs) => {
    renderStoneSupplyTrays(frame, supplyState(initial, remaining, initial));
    expectSupply(frame, 'black', remaining, discs);
    expectSupply(frame, 'white', initial, 30);
  });

  test('keeps an empty tray and a visible zero when a player has no stones left', () => {
    renderStoneSupplyTrays(frame, supplyState(30, 1, 1));
    renderStoneSupplyTrays(frame, supplyState(30, 0, 1));
    expectSupply(frame, 'black', 0, 0);
    expectSupply(frame, 'white', 1, 1);

    renderStoneSupplyTrays(frame, supplyState(30, 0, 0));
    expectSupply(frame, 'black', 0, 0);
    expectSupply(frame, 'white', 0, 0);
  });

  test.each([
    ['missing stoneSupply', {}],
    ['null stoneSupply', { stoneSupply: null }],
    ['null cardState', null],
    ['undefined cardState', undefined]
  ])('clears old discs and counts when disabled by %s, then restores fresh values', (_label, disabledState) => {
    renderStoneSupplyTrays(frame, supplyState(30, 27, 19));
    expectSupply(frame, 'black', 27, 27);
    expectSupply(frame, 'white', 19, 19);

    renderStoneSupplyTrays(frame, disabledState);
    expectDisabled(frame);
    renderStoneSupplyTrays(frame, disabledState);
    expectDisabled(frame);

    renderStoneSupplyTrays(frame, supplyState(70, 35, 1));
    expectSupply(frame, 'black', 35, 15);
    expectSupply(frame, 'white', 1, 1);
  });

  test('recalculates the proportional baseline after reset even if remaining counts do not change', () => {
    renderStoneSupplyTrays(frame, supplyState(30, 30, 15));
    expectSupply(frame, 'black', 30, 30);
    expectSupply(frame, 'white', 15, 15);

    renderStoneSupplyTrays(frame, supplyState(60, 30, 15));
    expectSupply(frame, 'black', 30, 15);
    expectSupply(frame, 'white', 15, 8);

    renderStoneSupplyTrays(frame, supplyState(120, 30, 15));
    expectSupply(frame, 'black', 30, 8);
    expectSupply(frame, 'white', 15, 4);

    renderStoneSupplyTrays(frame, supplyState(30, 30, 15));
    expectSupply(frame, 'black', 30, 30);
    expectSupply(frame, 'white', 15, 15);
  });

  test('does not duplicate trays and preserves all existing nodes for unchanged values', () => {
    renderStoneSupplyTrays(frame, supplyState(30, 29, 17));
    const white = getTray(frame, 'white');
    const black = getTray(frame, 'black');
    const whiteNodes = Array.from(white.querySelectorAll('*'));
    const blackNodes = Array.from(black.querySelectorAll('*'));

    for (let i = 0; i < 5; i += 1) {
      // New state objects with the same values must not rebuild the display.
      renderStoneSupplyTrays(frame, supplyState(30, 29, 17));
    }

    expect(expectSupply(frame, 'white', 17, 17)).toBe(white);
    expect(expectSupply(frame, 'black', 29, 29)).toBe(black);
    Array.from(white.querySelectorAll('*')).forEach((node, index) => expect(node).toBe(whiteNodes[index]));
    Array.from(black.querySelectorAll('*')).forEach((node, index) => expect(node).toBe(blackNodes[index]));

    renderStoneSupplyTrays(frame, supplyState(30, 28, 17));
    expectSupply(frame, 'black', 28, 28);
    expect(expectSupply(frame, 'white', 17, 17)).toBe(white);
    Array.from(white.querySelectorAll('*')).forEach((node, index) => expect(node).toBe(whiteNodes[index]));
  });

  test('never changes board/canvas nodes, attributes, contents, or canvas rendering', () => {
    const board = frame.querySelector('#board') as HTMLElement;
    const cell = board.querySelector('.cell') as HTMLElement;
    const canvas = frame.querySelector('canvas') as HTMLCanvasElement;
    const boardHtml = board.outerHTML;
    const canvasHtml = canvas.outerHTML;
    const click = jest.fn();
    cell.addEventListener('click', click);
    const getContext = jest.spyOn(canvas, 'getContext');
    const boardObserver = new dom.window.MutationObserver(() => {});
    const canvasObserver = new dom.window.MutationObserver(() => {});
    const options = { attributes: true, childList: true, characterData: true, subtree: true };
    boardObserver.observe(board, options);
    canvasObserver.observe(canvas, options);

    renderStoneSupplyTrays(frame, supplyState());
    renderStoneSupplyTrays(frame, supplyState(30, 29, 0));
    renderStoneSupplyTrays(frame, { stoneSupply: null });
    renderStoneSupplyTrays(frame, supplyState(70, 35, 1));

    expect(frame.querySelector('#board')).toBe(board);
    expect(frame.querySelector('.cell')).toBe(cell);
    expect(frame.querySelector('canvas')).toBe(canvas);
    expect(board.outerHTML).toBe(boardHtml);
    expect(canvas.outerHTML).toBe(canvasHtml);
    expect(boardObserver.takeRecords()).toHaveLength(0);
    expect(canvasObserver.takeRecords()).toHaveLength(0);
    expect(getContext).not.toHaveBeenCalled();
    cell.click();
    expect(click).toHaveBeenCalledTimes(1);
    boardObserver.disconnect();
    canvasObserver.disconnect();
  });

  test('treats a missing frame as a no-op without changing existing trays', () => {
    renderStoneSupplyTrays(frame, supplyState(30, 29, 17));
    const before = dom.window.document.body.innerHTML;
    expect(() => renderStoneSupplyTrays(null, supplyState(70, 0, 0))).not.toThrow();
    expect(() => renderStoneSupplyTrays(null, null)).not.toThrow();
    expect(dom.window.document.body.innerHTML).toBe(before);
    expectSupply(frame, 'black', 29, 29);
    expectSupply(frame, 'white', 17, 17);
  });

  test.each([false, true])('updateBattleStatusPanel updates trays with battle panel present=%s', (withPanel) => {
    if (withPanel) {
      const panel = dom.window.document.createElement('div');
      panel.id = 'effect-live-panel';
      dom.window.document.body.appendChild(panel);
    }
    const runtime = dom.window as any;
    runtime.gameState = {
      board: Array.from({ length: 8 }, () => Array<number>(8).fill(0)),
      currentPlayer: null, turnNumber: 0, roundNumber: 1
    };
    runtime.cardState = supplyState(30, 29, 23);
    runtime.MatchMode = { isNetworkModeActive: () => true };
    runtime.NetworkMatchClient = { getSeatKey: () => 'white' };
    const statusDisplay = require('../ui/status-display.ts');

    statusDisplay.updateBattleStatusPanel();
    const white = expectSupply(frame, 'white', 23, 23);
    const black = expectSupply(frame, 'black', 29, 29);
    expect(white.parentElement).toBe(frame);
    expect(black.parentElement).toBe(frame);

    // Local seat changes must not swap the fixed white/black trays.
    runtime.NetworkMatchClient.getSeatKey = () => 'black';
    runtime.cardState.stoneSupply.remainingByPlayer.white = 22;
    statusDisplay.updateBattleStatusPanel();
    expectSupply(frame, 'white', 22, 22);
    expectSupply(frame, 'black', 29, 29);

    runtime.cardState = { stoneSupply: null };
    statusDisplay.updateBattleStatusPanel();
    expectDisabled(frame);
  });
});
