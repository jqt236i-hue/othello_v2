import {
  renderMarkdown,
  renderComparisonMarkdown,
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
      flipContextCompilesPerGetLegalMoves: 1,
      viewerProjectionBlack: 1,
      viewerProjectionWhite: 1,
      viewerProjectionSpectator: 1,
      acceptedPublishRoomPersists: 1,
      renderSnapshotFullClones: 0
    }));
    expect(heavy.payloadBytes.black).toBeGreaterThan(0);
    expect(heavy.playback.durationMs).toBeGreaterThan(0);
    expect(report.browser).toEqual(expect.objectContaining({ skipped: true }));
    expect(renderMarkdown(report)).toContain('## Browser measurements');
  });

  test('renders two-run timing and deterministic comparison gates', () => {
    const makeReport = (scale: number) => ({
      commit: `commit-${scale}`,
      node: { fixtures: {
        'baseline-light': { timingsMs: {
          protectionContext: { p95: 1 * scale }, legalMoves: { p95: 1 * scale },
          publishPreparation: { p95: 1 * scale }
        } },
        'late-special-20': {
          timingsMs: {
            protectionContext: { median: 1 * scale }, legalMoves: { median: 1 * scale },
            publishPreparation: { median: 1 * scale }
          },
          operationCounts: {
            nestedFullMarkerScans: 0, flipContextCompilesPerGetLegalMoves: 1,
            viewerProjectionBlack: 1, viewerProjectionWhite: 1, viewerProjectionSpectator: 1,
            acceptedPublishRoomPersists: 1, renderSnapshotFullClones: 0
          },
          payloadBytes: { black: 1, white: 1, spectator: 1 },
          playback: { eventCount: 1, phaseCount: 1, durationMs: 1 },
          digests: { canonicalHash: 'a', eventDigest: 'b', playbackDigest: 'c' }
        }
      } },
      browser: { fixtures: {
        'baseline-light': {
          boardProjection: { p95: 1 * scale },
          clientSnapshotApplyAndRenderPreparation: { p95: 1 * scale }
        },
        'late-special-20': {
          boardProjection: { median: 1 * scale },
          clientSnapshotApplyAndRenderPreparation: { median: 1 * scale }
        }
      } }
    });
    const markdown = renderComparisonMarkdown(makeReport(1), [makeReport(0.4), makeReport(0.4)]);
    expect(markdown).toContain('## Timing gates');
    expect(markdown).toContain('payload/playback/digest parity | exact | exact | PASS');
    expect(markdown).not.toContain('| FAIL |');
  });
});
