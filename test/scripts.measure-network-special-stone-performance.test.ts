import {
  renderMarkdown,
  runMeasurement,
  summarize
} from '../scripts/perf/measure-network-special-stone-late-game';

describe('network special-stone performance measurement', () => {
  test('summarizes median and p95 deterministically', () => {
    expect(summarize([5, 1, 4, 2, 3])).toEqual({
      count: 5,
      min: 1,
      max: 5,
      median: 3,
      p95: 5
    });
  });

  test('produces separated Node/browser sections and required operation counts', async () => {
    const report = await runMeasurement({
      warmup: 0,
      iterations: 1,
      integrationIterations: 1,
      browser: false,
      write: false
    });
    const heavy = report.node.fixtures['late-special-20'];

    expect(report.config.fixtureSeeds).toEqual({
      'baseline-light': 101,
      'late-dense': 202,
      'late-special-20': 303
    });
    expect(heavy.summary).toMatchObject({ occupied: 52, markerCount: 20 });
    expect(heavy.timingsMs).toEqual(expect.objectContaining({
      protectionContext: expect.objectContaining({ count: 1 }),
      legalMoves: expect.objectContaining({ count: 1 }),
      publishPreparation: expect.objectContaining({ count: 1 })
    }));
    expect(heavy.operationCounts).toEqual(expect.objectContaining({
      nestedFullMarkerScans: expect.any(Number),
      flipContextCompilesPerGetLegalMoves: 12,
      viewerProjectionBlack: 1,
      viewerProjectionWhite: 1,
      viewerProjectionSpectator: 1,
      acceptedPublishRoomPersists: 2,
      renderSnapshotFullClones: 1
    }));
    expect(heavy.payloadBytes.black).toBeGreaterThan(0);
    expect(heavy.playback.durationMs).toBeGreaterThan(0);
    expect(report.browser).toEqual(expect.objectContaining({ skipped: true }));
    expect(renderMarkdown(report)).toContain('## Browser measurements');
  });
});
