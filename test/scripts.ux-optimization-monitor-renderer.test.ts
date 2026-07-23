import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  createUxOptimizationSummary,
  parseRenderArgs,
  renderUxOptimizationSummaryMarkdown,
  validateUxOptimizationComparisonCompatibility,
  verifyUxOptimizationArtifactIdentity
} from '../scripts/perf/render-ux-optimization-monitor-report';
import {
  computeBrowserArtifactManifest
} from '../scripts/capture-pixijs-playfield-performance';
import {
  UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
  UX_OPTIMIZATION_FIXTURE_DIGEST,
  UX_OPTIMIZATION_IDS,
  UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
  UX_OPTIMIZATION_SCENARIO_CAPTURES,
  UX_OPTIMIZATION_SCENARIO_DIGEST
} from '../scripts/perf/ux-optimization-monitor-contract';

function report(profile: 'baseline' | 'standard'): Record<string, any> {
  const pending = profile === 'baseline' ? UX_OPTIMIZATION_IDS.slice() : [];
  return {
    schemaVersion: UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
    profile,
    identity: {
      candidateCommit: profile === 'baseline' ? 'a'.repeat(40) : 'b'.repeat(40),
      dirty: false,
      dirtyPaths: [],
      browserArtifactSha256: 'c'.repeat(64),
      artifactFileCount: 2,
      fixtureDigest: UX_OPTIMIZATION_FIXTURE_DIGEST,
      scenarioDigest: UX_OPTIMIZATION_SCENARIO_DIGEST,
      capturePolicyDigest: UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
      environment: {
        browserVersion: 'Chromium 1',
        os: 'win32',
        viewport: { width: 1366, height: 900 },
        dpr: 1,
        graphics: {
          hardwareAccelerated: true,
          glRenderer: 'ANGLE GPU',
          glVendor: 'Google'
        }
      }
    },
    pendingOptimizationIds: pending,
    normalPlayIsolation: {
      probeGlobalPresent: false,
      boardPerfHarnessPresent: false,
      monitorQueryPresent: false,
      requestedDiagnosticsPayload: false
    },
    deviceValidated: false,
    scenarios: UX_OPTIMIZATION_SCENARIO_CAPTURES.map((capture) => ({
      id: capture.id,
      lane: capture.lane,
      backend: capture.backend,
      cacheProfile: capture.cacheProfile,
      captureStatus: 'pending-optimization',
      phases: [],
      resources: [],
      errors: [],
      metrics: {}
    }))
  };
}

describe('UX optimization summary renderer', () => {
  test('uses baseline/standard roles and rejects an environment mismatch', () => {
    const baseline = report('baseline');
    const candidate = report('standard');
    let checks = validateUxOptimizationComparisonCompatibility(baseline, candidate);
    expect(checks.every((check) => check.verdict === 'pass')).toBe(true);

    candidate.identity.environment.viewport.width = 1280;
    checks = validateUxOptimizationComparisonCompatibility(baseline, candidate);
    expect(checks.find((check) => check.id === 'viewport')?.verdict).toBe('fail');
  });

  test('derives summary verdict and traceability only from validator output', () => {
    const candidate = report('standard');
    candidate.verdict = 'pass';
    const summary = createUxOptimizationSummary(candidate, {
      generatedAt: '2026-07-23T00:00:00.000Z'
    });
    expect(summary.verdict).toBe('fail');
    expect(summary.traceability).toHaveLength(UX_OPTIMIZATION_IDS.length);
    expect(summary.traceability.every((row) => row.verdict === 'fail')).toBe(true);
    expect(renderUxOptimizationSummaryMarkdown(summary)).toContain(
      '総合判定: **FAIL**'
    );
  });

  test('verifies report digest and archive manifest against delivered files', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ux-summary-artifact-'));
    const artifactRoot = path.join(root, 'worker-public');
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(path.join(artifactRoot, 'index.html'), 'vite', 'utf8');
    fs.writeFileSync(path.join(artifactRoot, 'index.classic.html'), 'classic', 'utf8');
    try {
      const artifact = computeBrowserArtifactManifest(artifactRoot);
      const candidate = report('standard');
      candidate.identity.browserArtifactSha256 = artifact.sha256;
      candidate.identity.artifactFileCount = artifact.fileCount;
      const manifestPath = path.join(root, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify({
        candidateCommit: candidate.identity.candidateCommit,
        browserArtifactSha256: artifact.sha256,
        fileCount: artifact.fileCount
      }), 'utf8');
      expect(verifyUxOptimizationArtifactIdentity(
        'candidate',
        candidate,
        artifactRoot,
        {
          expectedCommit: candidate.identity.candidateCommit,
          archiveManifestPath: manifestPath
        }
      ).verdict).toBe('pass');
      fs.writeFileSync(path.join(artifactRoot, 'index.html'), 'tampered', 'utf8');
      expect(verifyUxOptimizationArtifactIdentity(
        'candidate',
        candidate,
        artifactRoot
      ).verdict).toBe('fail');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test('parses fail-closed output and summary paths', () => {
    expect(parseRenderArgs([
      '--input',
      'candidate.json',
      '--baseline',
      'baseline.json',
      '--write-summary',
      'docs/perf/completion.md'
    ])).toEqual({
      inputPath: 'candidate.json',
      baselinePath: 'baseline.json',
      outputJsonPath: null,
      outputMarkdownPath: null,
      writeSummaryPath: 'docs/perf/completion.md',
      candidateArtifactRoot: 'worker-public',
      baselineArtifactRoot: null
    });
    expect(() => parseRenderArgs(['--unknown'])).toThrow('Unknown argument');
    expect(() => parseRenderArgs(['--write-summary'])).toThrow(
      '--write-summary requires a path'
    );
  });
});
