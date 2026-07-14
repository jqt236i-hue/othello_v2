const {
  evaluatePixiRuntimeFallbackProbe
} = require('../scripts/pixijs-runtime-fallback-browser-check');

describe('Pixi runtime fallback browser check', () => {
  test('accepts an exclusive ready DOM fallback', () => {
    expect(evaluatePixiRuntimeFallbackProbe({
      ready: true,
      capability: {
        lane: 'classic',
        injected: false,
        version: null,
        unavailableReason: 'classic-global-missing'
      },
      renderer: 'legacy-dom',
      cellCount: 64,
      canvasCount: 0,
      bootError: ''
    }, 'classic')).toEqual([]);
  });

  test('rejects simultaneous canvas/DOM mounting and missing fallback evidence', () => {
    const errors = evaluatePixiRuntimeFallbackProbe({
      ready: true,
      capability: {
        lane: 'vite',
        injected: true,
        version: '8.18.1',
        unavailableReason: null
      },
      renderer: 'pixi',
      cellCount: 64,
      canvasCount: 1,
      bootError: 'fatal'
    }, 'vite');

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/unexpectedly injected/),
      expect.stringMatching(/unavailable reason/),
      expect.stringMatching(/fallback renderer/),
      expect.stringMatching(/mounted together/),
      expect.stringMatching(/fatal boot error/)
    ]));
  });
});
