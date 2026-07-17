import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  buildPhysicalCaptureUrls,
  computeBrowserArtifactManifest,
  createDesktopChromiumLaunchOptions,
  createBoardPerformanceServer,
  evaluateDesktopPerformancePair,
  listenPerformanceServer,
  normalizeChromiumGraphicsInfo,
  parseArgs,
  validateReferenceDeviceManifest
} from '../scripts/capture-pixijs-playfield-performance';
import {
  BOARD_PERFORMANCE_EVENT_DIGEST,
  BOARD_PERFORMANCE_FIXTURE_DIGEST,
  BOARD_PERFORMANCE_META_SCHEMA_VERSION,
  stablePerformanceJson
} from '../ui/board-visual/performance-harness';

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function referenceDevice(id: string, platform: 'android' | 'ios'): any {
  return {
    id,
    platform,
    ready: true,
    model: platform === 'android' ? 'Android Model' : 'iPhone Model',
    osVersion: '1.2.3',
    osBuild: 'BUILD-1',
    browser: platform === 'android' ? 'Chrome' : 'Safari',
    browserVersion: '100.0',
    screen: { width: 400, height: 800 },
    viewport: { width: 400, height: 700 },
    dpr: 2,
    refreshSetting: '60 Hz fixed',
    orientation: 'portrait-primary',
    powerMode: 'normal'
  };
}

function numericSummary(value: number): any {
  return { count: 2, p50: value, p95: value, p99: value, max: value };
}

function rafSummary(value: number): any {
  return { ...numericSummary(value), jankThresholdMs: 25, jankFrameCount: 0, jankRatio: 0, rafStall50msCount: 0 };
}

function performanceReport(backend: 'dom' | 'pixi', rafP95: number): any {
  const ids = [
    'basic.multi-flip-8x8',
    'heavy.move-8x8',
    'heavy.destroy-spawn-8x8',
    'heavy.status-8x8',
    'heavy.destroy-source-8x8',
    'heavy.theory-manifest-8x8'
  ];
  const scenarios = ids.map((id) => ({
    id,
    rawSamples: [{ modelBuildMs: 1, backendApplySyncMs: 1, hitTestMs: null }],
    summary: {
      raf: rafSummary(rafP95),
      wholeTurnSettlementMs: numericSummary(10),
      presentationStartLatencyMs: numericSummary(1)
    }
  }));
  scenarios.push({
    id: 'micro.full-marker-16x16',
    rawSamples: [{ modelBuildMs: 2, backendApplySyncMs: 3, hitTestMs: 1 }],
    summary: { raf: rafSummary(0) }
  });
  return {
    candidateCommit: 'a'.repeat(40),
    browserArtifactSha256: 'b'.repeat(64),
    fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
    eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
    lane: 'vite',
    backend,
    environment: { userAgent: 'test', viewport: { width: 1366, height: 900 }, dpr: 1 },
    nominal: { nominalFrameIntervalMs: 16 },
    scenarios
  };
}

describe('Pixi playfield performance capture tooling', () => {
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-perf-capture-'));
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  test('hashes sorted per-file artifact entries using stable JSON', () => {
    fs.mkdirSync(path.join(tempRoot, 'nested'));
    fs.writeFileSync(path.join(tempRoot, 'index.html'), 'vite');
    fs.writeFileSync(path.join(tempRoot, 'index.classic.html'), 'classic');
    fs.writeFileSync(path.join(tempRoot, 'nested', 'z.js'), 'z');
    const manifest = computeBrowserArtifactManifest(tempRoot);
    expect(manifest.files.map((entry) => entry.path)).toEqual(['index.classic.html', 'index.html', 'nested/z.js']);
    expect(manifest.sha256).toBe(hash(stablePerformanceJson(manifest.files)));
  });

  test('requires one fully described physical Android and iPhone', () => {
    const manifest = validateReferenceDeviceManifest({
      schemaVersion: 'pixijs_playfield_reference_devices.v1',
      devices: [referenceDevice('android-ref', 'android'), referenceDevice('iphone-ref', 'ios')]
    });
    expect(manifest.devices).toHaveLength(2);
    expect(() => validateReferenceDeviceManifest({
      schemaVersion: 'pixijs_playfield_reference_devices.v1',
      devices: [{ ...referenceDevice('android-ref', 'android'), ready: false }, referenceDevice('iphone-ref', 'ios')]
    })).toThrow(/not ready/);
  });

  test('derives immutable physical URL order from the candidate SHA', () => {
    const even = buildPhysicalCaptureUrls('http://192.0.2.1:4173', `${'0'.repeat(38)}00`, 'android-ref');
    expect(even.map((item) => item.backend)).toEqual(['dom', 'pixi']);
    expect(new URL(even[0].url).searchParams.get('cooldownMs')).toBe('300000');
    expect(new URL(even[1].url).searchParams.get('captureIndex')).toBe('2');
    const odd = buildPhysicalCaptureUrls('http://192.0.2.1:4173', `${'0'.repeat(38)}01`, 'iphone-ref');
    expect(odd.map((item) => item.backend)).toEqual(['pixi', 'dom']);
  });

  test('serves read-only metadata and the artifact digest header', async () => {
    fs.writeFileSync(path.join(tempRoot, 'index.html'), '<!doctype html>');
    fs.writeFileSync(path.join(tempRoot, 'index.classic.html'), '<!doctype html>');
    const artifact = computeBrowserArtifactManifest(tempRoot);
    const commit = `${'0'.repeat(38)}00`;
    const device = referenceDevice('android-ref', 'android');
    const server = createBoardPerformanceServer({
      artifactRoot: tempRoot,
      candidateCommit: commit,
      artifactManifest: artifact,
      captureProfile: 'physical',
      referenceDevices: [device]
    });
    try {
      const port = await listenPerformanceServer(server);
      const response = await fetch(`http://127.0.0.1:${port}/__board_perf_meta.json?referenceDevice=android-ref`, {
        headers: { referer: `http://127.0.0.1:${port}/index.classic.html` }
      });
      const meta: any = await response.json();
      expect(response.headers.get('x-board-perf-artifact-sha256')).toBe(artifact.sha256);
      expect(meta).toMatchObject({
        schemaVersion: BOARD_PERFORMANCE_META_SCHEMA_VERSION,
        candidateCommit: commit,
        browserArtifactSha256: artifact.sha256,
        lane: 'classic',
        captureProfile: 'physical',
        fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
        eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST
      });
      const viteDocument = await fetch(`http://127.0.0.1:${port}/`);
      const classicDocument = await fetch(`http://127.0.0.1:${port}/index.classic.html`);
      const viteCsp = viteDocument.headers.get('content-security-policy') || '';
      const classicCsp = classicDocument.headers.get('content-security-policy') || '';
      expect(viteCsp).not.toContain(" 'unsafe-eval'");
      expect(viteCsp).toContain("worker-src 'self' blob:");
      expect(classicCsp).toContain(" 'unsafe-eval'");
      expect(classicCsp).toContain("worker-src 'self' blob:");
      const probe = await fetch(`http://127.0.0.1:${port}/__board_perf_probe.html`);
      expect(probe.headers.get('x-board-perf-artifact-sha256')).toBe(artifact.sha256);
      expect(await probe.text()).toContain('Reference device browser probe');
      expect((await fetch(`http://127.0.0.1:${port}/../package.json`)).status).toBe(404);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  test('evaluates desktop absolute and DOM/Pixi comparative gates', () => {
    const passing = evaluateDesktopPerformancePair(performanceReport('dom', 17), performanceReport('pixi', 16));
    expect(passing.pass).toBe(true);
    const failing = evaluateDesktopPerformancePair(performanceReport('dom', 16), performanceReport('pixi', 30));
    expect(failing.pass).toBe(false);
    expect((failing.checks as any[]).some((check) => check.name === 'basic.pixi-frame-target' && !check.pass)).toBe(true);
    const dom = performanceReport('dom', 16);
    const pixi = performanceReport('pixi', 16);
    pixi.scenarios.find((entry: any) => entry.id === 'heavy.move-8x8').summary.raf = rafSummary(40);
    const heavyFailure = evaluateDesktopPerformancePair(dom, pixi);
    expect(heavyFailure.pass).toBe(false);
    expect((heavyFailure.checks as any[]).some((check) => check.name === 'heavy.move-8x8.pixi-p95' && !check.pass)).toBe(true);
  });

  test('pins the Windows desktop lane to hardware ANGLE and rejects software WebGL', () => {
    expect(createDesktopChromiumLaunchOptions('win32')).toEqual({
      headless: true,
      args: ['--use-gl=angle', '--use-angle=d3d11']
    });
    expect(createDesktopChromiumLaunchOptions('linux')).toEqual({ headless: true });
    const hardware = normalizeChromiumGraphicsInfo({
      gpu: {
        auxAttributes: {
          glRenderer: 'ANGLE (NVIDIA, GeForce RTX, D3D11)',
          glVendor: 'Google Inc. (NVIDIA)',
          displayType: 'ANGLE_D3D11'
        },
        featureStatus: { gpu_compositing: 'enabled', webgl: 'enabled_on' },
        devices: [{ vendorId: 1, deviceId: 2, deviceString: 'GPU', driverVendor: 'Vendor', driverVersion: '1.0' }]
      }
    });
    expect(hardware).toMatchObject({ hardwareAccelerated: true, displayType: 'ANGLE_D3D11' });
    expect(normalizeChromiumGraphicsInfo({
      gpu: {
        auxAttributes: { glRenderer: 'ANGLE (Google, Vulkan SwiftShader Device)', glVendor: 'Google' },
        featureStatus: { gpu_compositing: 'enabled', webgl: 'enabled' }
      }
    }).hardwareAccelerated).toBe(false);
  });

  test('parses manual and quick CLI modes without accepting unknown arguments', () => {
    expect(parseArgs(['--manual-host', '0.0.0.0', '--port', '4173', '--allow-dirty'])).toMatchObject({
      manualHost: '0.0.0.0',
      port: 4173,
      allowDirty: true
    });
    expect(parseArgs(['--quick', '--no-output']).quick).toBe(true);
    expect(parseArgs(['--probe-host=0.0.0.0']).probeHost).toBe('0.0.0.0');
    expect(() => parseArgs(['--probe-host', '0.0.0.0', '--manual-host', '0.0.0.0'])).toThrow(/mutually exclusive/);
    expect(() => parseArgs(['--mystery'])).toThrow(/Unknown argument/);
  });
});
