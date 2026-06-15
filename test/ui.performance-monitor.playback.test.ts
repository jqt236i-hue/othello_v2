import path from 'path';

describe('AnimationEngine performance monitor integration', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.doMock('../ui/animation-shared.js', () => ({
      isNoAnim: () => true,
      getTimer: () => ({
        setTimeout: () => 1,
        clearTimeout: () => {},
        clearAll: () => {},
        newScope: () => ({ id: 'scope' }),
        clearScope: () => {}
      })
    }));

    const cellEl = {
      classList: { add() {}, remove() {}, toggle() {} },
      querySelector: () => null,
      getBoundingClientRect: () => ({})
    };
    (global as any).document = { getElementById: () => cellEl };
    (global as any).window = {
      CARD_REVERSI_PERF_MONITOR: true,
      __telemetry__: { watchdogFired: 0, singleVisualWriterHits: 0, abortCount: 0 }
    };
    (global as any).emitBoardUpdate = jest.fn();
    (global as any).SoundEngine = {
      init: jest.fn(),
      playEffectByKey: jest.fn()
    };
  });

  afterEach(() => {
    try {
      const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
      if (monitor && typeof monitor.resetPerformanceMetrics === 'function') {
        monitor.resetPerformanceMetrics();
      }
    } catch (e) { /* ignore */ }
    delete (global as any).document;
    delete (global as any).window;
    delete (global as any).emitBoardUpdate;
    delete (global as any).SoundEngine;
  });

  test('records playback and phase event counts without changing playback order', async () => {
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
    let now = 100;
    monitor.configurePerformanceMonitor({
      enabled: true,
      now: () => {
        now += 5;
        return now;
      }
    });

    const engine = require(path.resolve(__dirname, '../ui/animation-engine.js'));
    const executeOrder: string[] = [];
    const originalExecuteEvent = engine.executeEvent.bind(engine);
    jest.spyOn(engine, 'executeEvent').mockImplementation(async (event: any) => {
      executeOrder.push(`${event.phase}:${event.type}:${event.targets && event.targets[0] && event.targets[0].soundKey}`);
      return originalExecuteEvent(event);
    });

    await engine.play([
      { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'first' }] },
      { type: 'sound_effect', phase: 1, targets: [{ soundKey: 'second' }] },
      { type: 'sound_effect', phase: 2, targets: [{ soundKey: 'third' }] }
    ]);

    expect(executeOrder).toEqual([
      '1:sound_effect:first',
      '1:sound_effect:second',
      '2:sound_effect:third'
    ]);

    const snapshot = monitor.getPerformanceSnapshot();
    expect(snapshot.counters['animation.playback.events'].count).toBe(3);
    expect(snapshot.counters['animation.playback.phase.events'].count).toBe(3);
    expect(snapshot.spans.filter((span: any) => span.name === 'animation.playback')).toHaveLength(1);
    expect(snapshot.spans.filter((span: any) => span.name === 'animation.playback.phase')).toHaveLength(2);
  });
});
