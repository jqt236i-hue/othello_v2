import { JSDOM } from 'jsdom';
import {
  BOARD_PERFORMANCE_EVENT_DIGEST,
  BOARD_PERFORMANCE_FIXTURE_DIGEST,
  BOARD_PERFORMANCE_META_SCHEMA_VERSION,
  BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS,
  BOARD_PERFORMANCE_PHYSICAL_STABILITY_MS,
  BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION,
  BOARD_PERFORMANCE_SCENARIO_IDS,
  createBoardPerformanceRunConfig,
  expectedCaptureOrder,
  exportBoardPerformanceReport,
  installBoardVisualPerformanceHarness,
  isBoardPerformanceHarnessRequested,
  nearestRank,
  stablePerformanceJson,
  summarizeRafIntervals
} from '../ui/board-visual/performance-harness';

describe('board visual performance harness contract', () => {
  let dom: JSDOM;
  let documentRef: Document;

  beforeEach(() => {
    dom = new JSDOM('<!doctype html><html><body></body></html>');
    documentRef = dom.window.document;
  });

  afterEach(() => {
    dom.window.close();
  });

  test('keeps schema scenario IDs and deterministic digests fixed', () => {
    expect(BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION).toBe('pixijs_playfield_performance_report.v1');
    expect(BOARD_PERFORMANCE_SCENARIO_IDS).toEqual([
      'basic.multi-flip-8x8',
      'heavy.move-8x8',
      'heavy.destroy-spawn-8x8',
      'heavy.status-8x8',
      'heavy.destroy-source-8x8',
      'heavy.theory-manifest-8x8',
      'micro.full-marker-16x16',
      'stability.expansion-skin'
    ]);
    expect(BOARD_PERFORMANCE_FIXTURE_DIGEST).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(BOARD_PERFORMANCE_EVENT_DIGEST).toMatch(/^fnv1a32:[0-9a-f]{8}$/);
    expect(stablePerformanceJson({ z: 1, a: { d: 2, b: 3 } })).toBe('{"a":{"b":3,"d":2},"z":1}');
  });

  test('uses nearest-rank summaries without sample filtering', () => {
    const samples = Array.from({ length: 20 }, (_value, index) => index + 1);
    expect(nearestRank(samples, 0.5)).toBe(10);
    expect(nearestRank(samples, 0.95)).toBe(19);
    expect(nearestRank(samples, 0.99)).toBe(20);
    expect(summarizeRafIntervals([10, 20, 50, 16], 16)).toEqual({
      count: 4,
      p50: 16,
      p95: 50,
      p99: 50,
      max: 50,
      jankThresholdMs: 24,
      jankFrameCount: 1,
      jankRatio: 0.25,
      rafStall50msCount: 1
    });
  });

  test('derives capture order from the final commit byte', () => {
    expect(expectedCaptureOrder(`${'0'.repeat(38)}00`)).toBe('dom-first');
    expect(expectedCaptureOrder(`${'0'.repeat(38)}01`)).toBe('pixi-first');
    expect(() => expectedCaptureOrder('deadbeef')).toThrow(/full 40-character SHA/);
  });

  test('fixes physical counts, cooldown and stability duration', () => {
    const physical = createBoardPerformanceRunConfig('physical');
    expect(physical).toMatchObject({
      warmupCount: 5,
      basicSampleCount: 30,
      heavySampleCount: 20,
      microSampleCount: 100,
      nominalRafSampleCount: 120,
      stabilityDurationMs: BOARD_PERFORMANCE_PHYSICAL_STABILITY_MS,
      sameModelApplyCount: 100,
      resetCount: 50,
      skinSwitchCount: 50,
      standard: true
    });
    expect(BOARD_PERFORMANCE_PHYSICAL_COOLDOWN_MS).toBe(300_000);
    expect(createBoardPerformanceRunConfig('physical', { basicSampleCount: 1 }).standard).toBe(false);
  });

  test('does not install controls or globals outside the exact query gate', async () => {
    const root: any = { location: { search: '?debug=1' } };
    expect(isBoardPerformanceHarnessRequested(root.location)).toBe(false);
    await expect(installBoardVisualPerformanceHarness({ root, document: documentRef })).resolves.toBeNull();
    expect(root.__boardPerfHarness).toBeUndefined();
    expect(documentRef.querySelector('[data-board-perf-controls]')).toBeNull();
  });

  test('installs one authenticated debug API for an eligible desktop page', async () => {
    const candidateCommit = `${'0'.repeat(38)}00`;
    const root: any = {
      location: { search: '?debug=1&boardPerf=1&boardRenderer=dom' },
      performance: { now: () => 100 },
      setTimeout,
      crypto: dom.window.crypto
    };
    const api = await installBoardVisualPerformanceHarness({
      root,
      document: documentRef,
      meta: {
        schemaVersion: BOARD_PERFORMANCE_META_SCHEMA_VERSION,
        candidateCommit,
        browserArtifactSha256: 'a'.repeat(64),
        fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
        eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
        lane: 'vite',
        captureProfile: 'desktop',
        referenceDevice: {},
        captureOrder: 'dom-first'
      }
    });
    expect(api).toBe(root.__boardPerfHarness);
    expect(api.getRunConfig().standard).toBe(true);
    expect(documentRef.querySelector('[data-board-perf-controls]')).not.toBeNull();
    await expect(installBoardVisualPerformanceHarness({ root, document: documentRef })).resolves.toBe(api);
    expect(documentRef.querySelectorAll('[data-board-perf-controls]')).toHaveLength(1);
  });

  test('revokes fallback download object URLs after export', async () => {
    const revokeObjectURL = jest.fn();
    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.fn();
    const root: any = {
      File: class FakeFile {},
      Blob: class FakeBlob {},
      navigator: { canShare: () => false },
      URL: { createObjectURL: () => 'blob:report', revokeObjectURL },
      setTimeout: (callback: () => void) => callback()
    };
    const fakeDocument: any = {
      body: { appendChild },
      createElement: () => ({ click, remove, hidden: false, href: '', download: '' })
    };
    const report = {
      schemaVersion: BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION,
      reportId: '11111111-1111-4111-8111-111111111111',
      backend: 'pixi',
      environment: { referenceDevice: { id: 'iphone' } }
    };
    await expect(exportBoardPerformanceReport(root, fakeDocument, report)).resolves.toEqual({
      method: 'download',
      filename: 'pixijs-playfield-iphone-pixi-11111111-1111-4111-8111-111111111111.json'
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:report');
  });
});
