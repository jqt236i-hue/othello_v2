const path = require('path');
const { JSDOM } = require('jsdom');

describe('animation-utils animateFadeOutAt', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
    delete global.boardEl;
  });

  test('resolves immediately when NOANIM is active', async () => {
    const mockTimer = { setTimeout: jest.fn(), clearTimeout: jest.fn(), clearAll: jest.fn(), pendingCount: () => 0, newScope: () => null, clearScope: () => {} };

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => true,
      getTimer: () => mockTimer
    }));

    const anim = require('../ui/animation-utils');

    // create minimal cell with disc
    const disc = { classList: { contains: () => false, add() {}, remove() {} }, parentElement: { removeChild() {} }, addEventListener() {}, removeEventListener() {} };
    const cell = { querySelector: () => disc };
    global.boardEl = { querySelector: () => cell };

    await anim.animateFadeOutAt(1, 2);
    // timer.setTimeout should not have been used when NOANIM=true
    expect(mockTimer.setTimeout).not.toHaveBeenCalled();
  });

  test('adds destroy-fade class and resolves after timer when animations enabled', async () => {
    const mockRemoveTimeout = jest.fn();
    const timer = {
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: mockRemoveTimeout,
      clearAll: () => {},
      pendingCount: () => 0,
      newScope: () => null,
      clearScope: () => {}
    };

    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => timer
    }));

    const anim = require('../ui/animation-utils');

    let addedClass = null;
    const disc = {
      classList: {
        contains: () => false,
        add: (cls) => { addedClass = cls; },
        remove() {}
      },
      parentElement: { removeChild() {} },
      addEventListener() {},
      removeEventListener() {}
    };
    const cell = { querySelector: () => disc };
    global.boardEl = { querySelector: () => cell };

    const p = anim.animateFadeOutAt(1, 2);
    // class should be added synchronously
    expect(addedClass).toBe('destroy-fade');

    // advance timers beyond default fade (500 + 200 default) to resolve
    jest.advanceTimersByTime(800);
    await p;
  });
});

describe('animation-utils animateHyperactiveMove chained fallback', () => {
  beforeEach(() => {
    jest.resetModules();
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="board">
        <div class="cell" data-row="3" data-col="3"></div>
        <div class="cell" data-row="3" data-col="4"></div>
        <div class="cell" data-row="3" data-col="5"></div>
      </div>
      <div id="card-fx-layer"></div>
    </body></html>`);
    global.window = dom.window;
    global.document = dom.window.document;
    global.boardEl = document.getElementById('board');

    const proto = global.window.Element && global.window.Element.prototype;
    if (proto && typeof proto.animate !== 'function') {
      proto.animate = function () {
        return {
          addEventListener(type, cb) {
            if (type === 'finish') setTimeout(cb, 0);
          }
        };
      };
    }
  });

  afterEach(() => {
    delete global.window;
    delete global.document;
    delete global.boardEl;
  });

  test('animates chained ultimate-hyperactive path from final-state disc via carryDisc', async () => {
    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => true,
      getTimer: () => ({
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        clearAll: () => {},
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => {}
      })
    }));

    const anim = require('../ui/animation-utils');
    const cellB = boardEl.querySelector('.cell[data-row="3"][data-col="4"]');
    const cellC = boardEl.querySelector('.cell[data-row="3"][data-col="5"]');
    const disc = document.createElement('div');
    disc.className = 'disc black';
    cellC.appendChild(disc);

    await anim.animateHyperactiveMove({ row: 3, col: 3 }, { row: 3, col: 4 }, { carryDisc: disc });
    expect(cellB.querySelector('.disc')).toBe(disc);
    expect(cellC.querySelector('.disc')).toBeNull();

    await anim.animateHyperactiveMove({ row: 3, col: 4 }, { row: 3, col: 5 }, { carryDisc: disc });
    expect(cellC.querySelector('.disc')).toBe(disc);
  });

  test('animateHyperactiveMove uses fixed duration regardless of travel distance', async () => {
    jest.doMock(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'), () => ({
      isNoAnim: () => false,
      getTimer: () => ({
        setTimeout: (fn, ms) => setTimeout(fn, ms),
        clearTimeout: (id) => clearTimeout(id),
        clearAll: () => {},
        pendingCount: () => 0,
        newScope: () => null,
        clearScope: () => {}
      })
    }));

    const anim = require('../ui/animation-utils');
    const board = document.getElementById('board');
    const fxLayer = document.getElementById('card-fx-layer');
    fxLayer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 1000, right: 1000, bottom: 1000 });

    const ensureCell = (row, col) => {
      let cell = board.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
      if (!cell) {
        cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = String(row);
        cell.dataset.col = String(col);
        board.appendChild(cell);
      }
      const left = col * 100;
      const top = row * 100;
      cell.getBoundingClientRect = () => ({
        left,
        top,
        width: 100,
        height: 100,
        right: left + 100,
        bottom: top + 100
      });
      return cell;
    };

    const proto = window.Element && window.Element.prototype;
    const originalAnimate = proto ? proto.animate : undefined;
    const animateMock = jest.fn(() => ({
      addEventListener(type, cb) {
        if (type === 'finish') setTimeout(cb, 0);
      },
      removeEventListener() {},
      finished: Promise.resolve()
    }));
    if (proto) proto.animate = animateMock;

    try {
      const shortFrom = ensureCell(3, 3);
      const shortTo = ensureCell(3, 4);
      const shortDisc = document.createElement('div');
      shortDisc.className = 'disc black';
      shortFrom.appendChild(shortDisc);

      await anim.animateHyperactiveMove({ row: 3, col: 3 }, { row: 3, col: 4 });
      const shortDuration = animateMock.mock.calls[0][1].duration;
      animateMock.mockClear();

      const longFrom = ensureCell(4, 0);
      const longTo = ensureCell(4, 6);
      const longDisc = document.createElement('div');
      longDisc.className = 'disc black';
      longFrom.appendChild(longDisc);

      await anim.animateHyperactiveMove({ row: 4, col: 0 }, { row: 4, col: 6 });
      const longDuration = animateMock.mock.calls[0][1].duration;

      expect(shortDuration).toBe(longDuration);
      expect(shortDuration).toBe(400);
      expect(shortTo.querySelector('.disc')).not.toBeNull();
      expect(longTo.querySelector('.disc')).not.toBeNull();
    } finally {
      if (proto) proto.animate = originalAnimate;
    }
  });
});