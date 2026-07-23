import {
  UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL,
  normalizeBrowserProbeSnapshot
} from '../scripts/perf/ux-optimization-browser-probe';

describe('UX optimization browser probe', () => {
  test('uses one capture-only global key', () => {
    expect(UX_OPTIMIZATION_BROWSER_PROBE_GLOBAL).toBe(
      '__CARD_REVERSI_UX_OPTIMIZATION_PROBE__'
    );
  });

  test('normalizes untrusted browser snapshots without gameplay data', () => {
    const snapshot = normalizeBrowserProbeSnapshot({
      timeOrigin: 100,
      capturedAtMs: 25,
      phases: [
        { name: 'navigation', atMs: 0 },
        { name: '', atMs: 1 },
        { name: 'board-idle', atMs: '25' }
      ],
      resources: [
        {
          path: 'assets/help.png',
          initiatorType: 'img',
          startMs: 3,
          endMs: 10,
          encodedBodySize: 123
        },
        { path: '', startMs: 0, endMs: 1 }
      ],
      longTasks: [{ startMs: 4, durationMs: 51 }],
      rafIntervalsMs: [16.7, '17', 'bad'],
      imageConstructorCount: 2,
      imageConstructorAssignments: [
        'assets/images/hero/hero.png',
        '',
        null
      ],
      logicalImageSrcMutations: [
        {
          logicalPath: 'assets/images/hero/hero.png',
          sourcePath: 'vite-dist/assets/hero-HASHED.png'
        },
        { logicalPath: '', sourcePath: 'ignored.png' }
      ],
      cls: 0.002,
      visibility: 'visible',
      focused: true,
      capabilities: {
        longTask: true,
        layoutShift: true,
        resourceTiming: true
      }
    });

    expect(snapshot.phases).toEqual([
      { name: 'navigation', atMs: 0 },
      { name: 'board-idle', atMs: 25 }
    ]);
    expect(snapshot.resources).toHaveLength(1);
    expect(snapshot.rafIntervalsMs).toEqual([16.7, 17]);
    expect(snapshot.longTasks).toEqual([{ startMs: 4, durationMs: 51 }]);
    expect(snapshot.imageConstructorCount).toBe(2);
    expect(snapshot.imageConstructorAssignments).toEqual([
      'assets/images/hero/hero.png'
    ]);
    expect(snapshot.logicalImageSrcMutations).toEqual([{
      logicalPath: 'assets/images/hero/hero.png',
      sourcePath: 'vite-dist/assets/hero-HASHED.png'
    }]);
    expect(snapshot.focused).toBe(true);
  });
});
