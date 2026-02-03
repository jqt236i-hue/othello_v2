const path = require('path');

describe('game visual-effects map registration', () => {
  test('registerUIGlobals is called when bootstrap is available', () => {
    const calls = [];
    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => { calls.push(obj); return obj; }
      }), { virtual: false });

      // Require the module which should call registerUIGlobals
      require(path.resolve(__dirname, '..', 'game', 'visual-effects-map.js'));
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    const obj = calls[calls.length - 1];
    expect(obj.GameVisualEffectsMap).toBeDefined();
    expect(obj.STONE_VISUAL_EFFECTS).toBeDefined();
    expect(typeof obj.GameVisualEffectsMap.getSupportedEffectKeys === 'function').toBeTruthy();
  });
});
