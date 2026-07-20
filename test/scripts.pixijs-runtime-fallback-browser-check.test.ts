const {
  evaluatePixiRuntimeFallbackProbe,
  evaluateSoftwareRendererFallbackProbe
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
      trajectoryOverlayCount: 0,
      trajectorySmoke: {
        attempted: true,
        originalEventTypes: ['destroy', 'flip'],
        trajectoryObserved: true,
        phaseSettled: true,
        canvasCountWhileActive: 0,
        trajectoryOverlayCountAfterSettle: 0,
        initialVisualDigest: 'digest:classic',
        finalVisualDigest: 'digest:classic',
        soundCallCount: 0,
        logEntryDelta: 0,
        error: ''
      },
      bootError: ''
    }, 'classic')).toEqual([]);

    expect(evaluatePixiRuntimeFallbackProbe({
      ready: true,
      capability: {
        lane: 'vite',
        injected: false,
        version: null,
        unavailableReason: 'pixi-import-failed'
      },
      renderer: 'dom',
      cellCount: 64,
      canvasCount: 0,
      trajectoryOverlayCount: 0,
      trajectorySmoke: {
        attempted: true,
        originalEventTypes: ['destroy', 'flip'],
        trajectoryObserved: true,
        phaseSettled: true,
        canvasCountWhileActive: 0,
        trajectoryOverlayCountAfterSettle: 0,
        initialVisualDigest: 'digest:vite',
        finalVisualDigest: 'digest:vite',
        soundCallCount: 0,
        logEntryDelta: 0,
        error: ''
      },
      bootError: ''
    }, 'vite')).toEqual([]);
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
      trajectoryOverlayCount: 1,
      trajectorySmoke: {
        attempted: true,
        originalEventTypes: ['destroy_source_animation'],
        trajectoryObserved: false,
        phaseSettled: false,
        canvasCountWhileActive: 1,
        trajectoryOverlayCountAfterSettle: 1,
        initialVisualDigest: 'before',
        finalVisualDigest: 'after',
        soundCallCount: 1,
        logEntryDelta: 1,
        error: 'failed'
      },
      bootError: 'fatal'
    }, 'vite');

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringMatching(/unexpectedly injected/),
      expect.stringMatching(/unavailable reason/),
      expect.stringMatching(/fallback renderer/),
      expect.stringMatching(/mounted together/),
      expect.stringMatching(/overlay survived/),
      expect.stringMatching(/original destroy\/flip/),
      expect.stringMatching(/not observed/),
      expect.stringMatching(/did not settle/),
      expect.stringMatching(/active DOM trajectory/),
      expect.stringMatching(/not cleaned up/),
      expect.stringMatching(/final visual digest/),
      expect.stringMatching(/replayed sound/),
      expect.stringMatching(/replayed a log/),
      expect.stringMatching(/trajectory fallback smoke failed/),
      expect.stringMatching(/fatal boot error/)
    ]));
  });

  test('accepts a loaded Pixi runtime that falls back exclusively because the renderer is software', () => {
    expect(evaluateSoftwareRendererFallbackProbe({
      ready: true,
      capability: {
        lane: 'vite',
        injected: true,
        version: '8.18.1',
        unavailableReason: null
      },
      renderer: 'dom',
      cellCount: 64,
      canvasCount: 0,
      trajectoryOverlayCount: 0,
      trajectorySmoke: {
        attempted: true,
        originalEventTypes: ['destroy', 'flip'],
        trajectoryObserved: true,
        phaseSettled: true,
        canvasCountWhileActive: 0,
        trajectoryOverlayCountAfterSettle: 0,
        initialVisualDigest: 'digest:software',
        finalVisualDigest: 'digest:software',
        soundCallCount: 0,
        logEntryDelta: 0,
        error: ''
      },
      bootError: ''
    }, 'vite')).toEqual([]);
  });
});
