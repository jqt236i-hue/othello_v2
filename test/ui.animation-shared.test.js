const path = require('path');

describe('ui/animation-shared', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.NOANIM;
    delete global.TimerRegistry;
    delete global.window;
  });

  test('isNoAnim respects process env NOANIM', () => {
    process.env.NOANIM = '1';
    const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
    expect(typeof mod.isNoAnim === 'function').toBeTruthy();
    expect(mod.isNoAnim()).toBeTruthy();
  });

  test('isNoAnim respects window.DISABLE_ANIMATIONS', () => {
    global.window = { DISABLE_ANIMATIONS: true };
    const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
    expect(mod.isNoAnim()).toBeTruthy();
  });

  test('getTimer returns TimerRegistry when present', () => {
    const fakeRegistry = { setTimeout: () => 1, clearTimeout: () => {}, clearAll: () => {}, pendingCount: () => 0 };
    global.TimerRegistry = fakeRegistry;
    const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
    const t = mod.getTimer();
    expect(t).toBe(fakeRegistry);
  });

  test('triggerFlip toggles flip class and removeFlip removes it', () => {
    const mod = require(path.resolve(__dirname, '..', 'ui', 'animation-shared.js'));
    // Create a lightweight fake element with classList and offsetHeight so tests run in node env
    const calls = { removed: [], added: [] };
    const div = {
      classList: {
        remove: (c) => calls.removed.push(c),
        add: (c) => calls.added.push(c),
        contains: (c) => calls.added.includes(c) && !calls.removed.includes(c)
      },
      offsetHeight: 0
    };

    // triggerFlip should remove then add 'flip' without throwing
    mod.triggerFlip(div);
    expect(calls.removed.includes('flip')).toBe(true);
    expect(calls.added.includes('flip')).toBe(true);

    // removeFlip should remove the class
    calls.removed = [];
    mod.removeFlip(div);
    expect(calls.removed.includes('flip')).toBe(true);
  });
});
