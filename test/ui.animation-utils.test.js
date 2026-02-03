const path = require('path');

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