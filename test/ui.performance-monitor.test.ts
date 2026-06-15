import { JSDOM } from 'jsdom';
import path from 'path';

describe('UI performance monitor', () => {
  beforeEach(() => {
    jest.resetModules();
    delete (global as any).window;
    delete (global as any).document;
  });

  afterEach(() => {
    try {
      const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
      if (monitor && typeof monitor.resetPerformanceMetrics === 'function') {
        monitor.resetPerformanceMetrics();
      }
    } catch (e) { /* ignore */ }
    if ((global as any).window && typeof (global as any).window.close === 'function') {
      (global as any).window.close();
    }
    delete (global as any).window;
    delete (global as any).document;
  });

  test('stays disabled by default and exposes empty snapshots', () => {
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));

    monitor.resetPerformanceMetrics();
    monitor.count('dom.createElement');

    expect(monitor.getPerformanceSnapshot()).toEqual({
      enabled: false,
      counters: {},
      spans: [],
      activeSpans: 0
    });
  });

  test('records counters and spans when explicitly enabled', () => {
    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
    let now = 10;

    monitor.configurePerformanceMonitor({ enabled: true, now: () => now });
    monitor.count('playback.phase.events', 3, { phase: 1 });
    const token = monitor.beginSpan('playback.phase', { phase: 1, eventCount: 3 });
    now = 25;
    monitor.endSpan(token, { completed: true });

    const snapshot = monitor.getPerformanceSnapshot();
    expect(snapshot.enabled).toBe(true);
    expect(snapshot.counters['playback.phase.events'].count).toBe(3);
    expect(snapshot.counters['playback.phase.events'].lastMeta).toEqual({ phase: 1 });
    expect(snapshot.spans).toHaveLength(1);
    expect(snapshot.spans[0]).toMatchObject({
      name: 'playback.phase',
      durationMs: 15,
      meta: { phase: 1, eventCount: 3 },
      endMeta: { completed: true }
    });
  });

  test('DOM probe counts creation, append, and layout reads without changing DOM behavior', () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document as any;
    (dom.window as any).CARD_REVERSI_PERF_MONITOR = true;

    const monitor = require(path.resolve(__dirname, '../ui/performance-monitor.js'));
    monitor.configurePerformanceMonitor({ enabled: true, now: () => 0 });
    monitor.installDomPerformanceProbe(dom.window.document);

    const div = dom.window.document.createElement('div');
    const svg = dom.window.document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    dom.window.document.body.appendChild(div);
    div.getBoundingClientRect();

    expect(div.tagName).toBe('DIV');
    expect(svg.nodeName.toLowerCase()).toBe('svg');
    expect(dom.window.document.body.contains(div)).toBe(true);

    const snapshot = monitor.getPerformanceSnapshot();
    expect(snapshot.counters['dom.createElement'].count).toBe(1);
    expect(snapshot.counters['dom.createElementNS'].count).toBe(1);
    expect(snapshot.counters['dom.appendChild'].count).toBe(1);
    expect(snapshot.counters['layout.getBoundingClientRect'].count).toBe(1);
  });
});
