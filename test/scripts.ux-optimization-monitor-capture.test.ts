import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  UX_OPTIMIZATION_BOOT_SCENARIO_IDS,
  archiveBaselineBrowserArtifact,
  buildBootCaptureUrl,
  createInitialScenarioCaptures,
  parseCaptureArgs
} from '../scripts/perf/capture-ux-optimization-monitor';
import {
  computeBrowserArtifactManifest
} from '../scripts/capture-pixijs-playfield-performance';
import {
  UX_OPTIMIZATION_SCENARIO_CAPTURES
} from '../scripts/perf/ux-optimization-monitor-contract';

describe('UX optimization monitor capture orchestration', () => {
  test('starts with every contract scenario explicitly pending', () => {
    const captures = createInitialScenarioCaptures();
    expect(captures.map((capture) => (
      `${String(capture.id)}:${String(capture.lane)}:${String(capture.backend)}`
    ))).toEqual(
      UX_OPTIMIZATION_SCENARIO_CAPTURES.map((scenario) => scenario.key)
    );
    expect(captures.every((capture) => capture.captureStatus === 'pending-optimization')).toBe(true);
    expect(UX_OPTIMIZATION_BOOT_SCENARIO_IDS).toEqual(new Set([
      'boot.pixi.cold',
      'boot.pixi.warm',
      'boot.classic-pixi.cold'
    ]));
  });

  test('builds capture-only Vite and classic URLs', () => {
    const vite = UX_OPTIMIZATION_SCENARIO_CAPTURES.find(
      (scenario) => scenario.id === 'boot.pixi.cold' && scenario.lane === 'vite'
    )!;
    const classic = UX_OPTIMIZATION_SCENARIO_CAPTURES.find(
      (scenario) => scenario.id === 'boot.classic-pixi.cold' && scenario.lane === 'classic'
    )!;
    expect(buildBootCaptureUrl('http://127.0.0.1:1234', vite)).toBe(
      'http://127.0.0.1:1234/?debug=1&uxMonitor=1&boardRenderer=pixi&noanim=1'
    );
    expect(buildBootCaptureUrl('http://127.0.0.1:1234', classic)).toBe(
      'http://127.0.0.1:1234/index.classic.html?debug=1&uxMonitor=1&boardRenderer=pixi&noanim=1'
    );
  });

  test('parses baseline and standard CLI profiles fail closed', () => {
    expect(parseCaptureArgs([
      '--profile',
      'baseline',
      '--allow-dirty',
      '--output',
      'artifacts/custom.json'
    ])).toEqual({
      profile: 'baseline',
      allowDirty: true,
      outputPath: 'artifacts/custom.json'
    });
    expect(() => parseCaptureArgs(['--profile', 'fast'])).toThrow('Invalid profile');
    expect(() => parseCaptureArgs(['--unknown'])).toThrow('Unknown argument');
  });

  test('archives and revalidates the exact baseline browser artifact', () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ux-monitor-archive-'));
    const artifactRoot = path.join(rootDir, 'worker-public');
    fs.mkdirSync(artifactRoot, { recursive: true });
    fs.writeFileSync(path.join(artifactRoot, 'index.html'), 'vite', 'utf8');
    fs.writeFileSync(path.join(artifactRoot, 'index.classic.html'), 'classic', 'utf8');
    try {
      const artifact = computeBrowserArtifactManifest(artifactRoot);
      const archive = archiveBaselineBrowserArtifact(
        rootDir,
        artifact,
        'a'.repeat(40)
      );
      expect(archive.sha256).toBe(artifact.sha256);
      expect(computeBrowserArtifactManifest(
        path.join(rootDir, archive.path)
      ).sha256).toBe(artifact.sha256);
      expect(JSON.parse(fs.readFileSync(
        path.join(rootDir, archive.manifestPath),
        'utf8'
      )).candidateCommit).toBe('a'.repeat(40));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
