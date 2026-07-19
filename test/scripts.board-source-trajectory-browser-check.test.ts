import * as fs from 'fs';
import * as path from 'path';
import {
  BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS,
  BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS,
  evaluateBoardSourceTrajectoryBrowserReport,
  type BoardSourceTrajectoryBrowserReport,
  type BoardSourceTrajectoryBrowserSample
} from '../scripts/board-source-trajectory-browser-check';

const boardViewport = Object.freeze({
  left: 100, top: 100, right: 500, bottom: 500, width: 400, height: 400
});
const paintedHaloOwner = Object.freeze({
  left: 0, top: 0, right: 600, bottom: 600, width: 600, height: 600
});

function sample(
  profileKey: string,
  fixture: string,
  overrides: Partial<BoardSourceTrajectoryBrowserSample> = {}
): BoardSourceTrajectoryBrowserSample {
  return Object.freeze({
    profileKey,
    fixture,
    viewport: 'fixture',
    dpr: 1,
    direction: profileKey === 'robotVacuumSuck' ? 'target-to-source' : 'source-to-target',
    logicalSource: Object.freeze({ row: 1, col: 1 }),
    logicalTarget: Object.freeze({ row: 6, col: 6 }),
    boardViewport,
    paintedHaloOwner,
    paintedBoundsUnion: Object.freeze({
      left: 120, top: 120, right: 480, bottom: 480, width: 360, height: 360
    }),
    expectedClippedPaintedBounds: Object.freeze({
      left: 120, top: 120, right: 480, bottom: 480, width: 360, height: 360
    }),
    legacyOverflow: false,
    frameCount: 12,
    elapsedMs: 300,
    maxOverlayNodeCount: 5,
    maxZIndex: 1250,
    remainingOverlayNodeCount: 0,
    error: null,
    ...overrides
  });
}

function validReport(): BoardSourceTrajectoryBrowserReport {
  return Object.freeze({
    backend: 'dom' as const,
    baseline: true,
    captures: Object.freeze(BOARD_SOURCE_TRAJECTORY_BROWSER_VIEWPORTS.map((viewport) => Object.freeze({
      viewport: viewport.name,
      dpr: viewport.dpr,
      smokeOk: true,
      smokeErrors: Object.freeze([]),
      samples: Object.freeze([
        ...BOARD_SOURCE_TRAJECTORY_BROWSER_PROFILE_KEYS.flatMap((profileKey) => [
          sample(profileKey, 'normal', { viewport: viewport.name, dpr: viewport.dpr }),
          sample(profileKey, 'scrolled-expanded', { viewport: viewport.name, dpr: viewport.dpr })
        ]),
        sample('sniperShot', 'long-range-offscreen-sniper', {
          viewport: viewport.name,
          dpr: viewport.dpr,
          logicalSource: Object.freeze({ row: 0, col: 0 }),
          logicalTarget: Object.freeze({ row: 15, col: 15 }),
          paintedBoundsUnion: Object.freeze({
            left: -80, top: -80, right: 850, bottom: 850, width: 930, height: 930
          }),
          expectedClippedPaintedBounds: paintedHaloOwner,
          legacyOverflow: true
        })
      ])
    })))
  });
}

describe('board source trajectory browser check evaluator', () => {
  test('accepts all seven profiles, both supported viewports, cleanup, and recorded legacy overflow', () => {
    expect(evaluateBoardSourceTrajectoryBrowserReport(validReport())).toEqual({
      ok: true,
      errors: []
    });
  });

  test('fails closed for a missing profile sample and a leaked overlay', () => {
    const report = validReport();
    const captures = report.captures.map((capture, captureIndex) => Object.freeze({
      ...capture,
      samples: captureIndex === 0
        ? Object.freeze(capture.samples.filter((candidate) => !(
          candidate.profileKey === 'udgDestroyed' && candidate.fixture === 'normal'
        )).map((candidate) => (
          candidate.profileKey === 'sniperShot' && candidate.fixture === 'normal'
            ? Object.freeze({ ...candidate, remainingOverlayNodeCount: 1 })
            : candidate
        )))
        : capture.samples
    }));
    const evaluation = evaluateBoardSourceTrajectoryBrowserReport(Object.freeze({
      ...report,
      captures: Object.freeze(captures)
    }));
    expect(evaluation.ok).toBe(false);
    expect(evaluation.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('udgDestroyed sample is missing'),
      expect.stringContaining('transient overlay leaked')
    ]));
  });

  test('samples the complete animation lifetime at requestAnimationFrame boundaries', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'scripts', 'board-source-trajectory-browser-check.ts'),
      'utf8'
    );
    expect(source).toContain('requestAnimationFrame');
    expect(source).toContain('paintedBoundsUnion');
    expect(source).toContain('long-range-offscreen-sniper');
    expect(source).toContain("entryPath: '/?boardRenderer=pixi'");
  });
});
