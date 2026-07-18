import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import {
  evaluatePhysicalPerformancePair,
  parseValidatorArgs,
  validateAutomatedPrecutoverEvidence,
  validateDesktopReport,
  validatePhysicalReport,
  validatePrecutoverEvidence
} from '../scripts/validate-pixijs-mobile-performance-report';
import {
  BOARD_PERFORMANCE_EVENT_DIGEST,
  BOARD_PERFORMANCE_FIXTURE_DIGEST,
  BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST,
  BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION,
  BOARD_PERFORMANCE_SCENARIO_IDS,
  createBoardPerformanceRunConfig,
  stablePerformanceJson,
  summarizeNumericSamples,
  summarizeRafIntervals
} from '../ui/board-visual/performance-harness';

const COMMIT = `${'0'.repeat(38)}00`;
const ARTIFACT = 'a'.repeat(64);

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function device(id: string, platform: 'android' | 'ios'): any {
  return {
    id,
    platform,
    ready: true,
    model: platform === 'android' ? 'Pixel Test' : 'iPhone Test',
    osVersion: '18.0',
    osBuild: 'BUILD-EXACT',
    browser: platform === 'android' ? 'Chrome' : 'Safari',
    browserVersion: '140.0.0',
    screen: { width: 400, height: 800 },
    viewport: { width: 400, height: 700 },
    dpr: 2,
    refreshSetting: '60 Hz fixed',
    orientation: 'portrait-primary',
    powerMode: 'normal; battery saver off'
  };
}

function diagnostics(backend: 'dom' | 'pixi'): any {
  return {
    backend,
    writerMode: 'idle',
    displayObjectCount: backend === 'pixi' ? 64 : 0,
    textureLeaseCount: backend === 'pixi' ? 3 : 0,
    canvasBackingWidth: backend === 'pixi' ? 800 : 0,
    canvasBackingHeight: backend === 'pixi' ? 1200 : 0,
    canvasCount: backend === 'pixi' ? 1 : 0,
    contextCount: backend === 'pixi' ? 1 : 0,
    domCellCount: backend === 'dom' ? 64 : 0,
    tickerRunning: false,
    contextLossCount: 0,
    activeViewCount: backend === 'pixi' ? 64 : 0,
    activeTextureLeaseCount: backend === 'pixi' ? 3 : 0,
    textureUploadCount: backend === 'pixi' ? 3 : 0,
    textureReadyPixelCount: backend === 'pixi' ? 65536 : 0,
    textureActivePixelCount: backend === 'pixi' ? 65536 : 0
  };
}

function summary(samples: any[], nominal = 16): any {
  const metric = (name: string) => samples.flatMap((sample) => sample[name] === null ? [] : [sample[name]]);
  return {
    raf: summarizeRafIntervals(samples.flatMap((sample) => sample.rafIntervalsMs), nominal),
    presentationStartLatencyMs: summarizeNumericSamples(metric('presentationStartLatencyMs')),
    modelBuildMs: summarizeNumericSamples(metric('modelBuildMs')),
    backendApplySyncMs: summarizeNumericSamples(metric('backendApplySyncMs')),
    backendApplySettlementMs: summarizeNumericSamples(metric('backendApplySettlementMs')),
    boardLocalPlaybackMs: summarizeNumericSamples(metric('boardLocalPlaybackMs')),
    globalDomHudMs: summarizeNumericSamples(metric('globalDomHudMs')),
    wholeTurnSettlementMs: summarizeNumericSamples(metric('wholeTurnSettlementMs')),
    hitTestMs: summarizeNumericSamples(metric('hitTestMs'))
  };
}

function measuredScenario(id: string, count: number, backend: 'dom' | 'pixi'): any {
  const micro = id === 'micro.full-marker-16x16';
  const samples = Array.from({ length: count }, () => ({
    rafTimestampsMs: micro ? [] : [0, 16],
    rafIntervalsMs: micro ? [] : [16],
    presentationStartLatencyMs: micro ? 0 : 1,
    modelBuildMs: 1,
    backendApplySyncMs: 1,
    backendApplySettlementMs: 2,
    boardLocalPlaybackMs: micro ? 0 : 10,
    globalDomHudMs: micro ? 0 : 1,
    wholeTurnSettlementMs: micro ? 2 : 11,
    hitTestMs: micro ? 1 : null,
    diagnosticsBefore: diagnostics(backend),
    diagnosticsAfter: diagnostics(backend)
  }));
  return { id, warmupCount: 5, sampleCount: count, rawSamples: samples, summary: summary(samples) };
}

let stabilityTimestamps: number[] | null = null;
function stabilityScenario(backend: 'dom' | 'pixi'): any {
  if (!stabilityTimestamps) stabilityTimestamps = Array.from({ length: 37_501 }, (_value, index) => index * 16);
  const intervals = Array.from({ length: stabilityTimestamps.length - 1 }, () => 16);
  const rawSamples = Array.from({ length: 601 }, (_value, index) => ({
    elapsedMs: index * 1000,
    apply: { modelBuildMs: 1, backendApplySyncMs: 1, backendApplySettlementMs: 1 },
    diagnostics: diagnostics(backend)
  }));
  const firstRaf = intervals.slice(0, 7_500);
  const lastRaf = intervals.slice(-7_501);
  const firstApply = rawSamples.filter((sample) => sample.elapsedMs <= 120_000).map(() => 1);
  const lastApply = rawSamples.filter((sample) => sample.elapsedMs >= 480_000).map(() => 1);
  const steady = diagnostics(backend);
  return {
    id: 'stability.expansion-skin',
    warmupCount: 5,
    sampleCount: rawSamples.length,
    startedAtPerformanceMs: 0,
    durationMs: 600_000,
    requiredDurationMs: 600_000,
    rawSamples,
    rawRafTimestampsMs: stabilityTimestamps,
    rawRafIntervalsMs: intervals,
    summary: {
      nominalFrameIntervalMs: 16,
      firstTwoMinutes: { raf: summarizeRafIntervals(firstRaf, 16), backendApplySettlementMs: summarizeNumericSamples(firstApply) },
      lastTwoMinutes: { raf: summarizeRafIntervals(lastRaf, 16), backendApplySettlementMs: summarizeNumericSamples(lastApply) }
    },
    lifecycle: {
      steadyState: steady,
      sameModelApply: { count: 100, diagnostics: diagnostics(backend) },
      reset: { count: 50, diagnostics: diagnostics(backend) },
      skinSwitch: { count: 50, diagnostics: diagnostics(backend) }
    }
  };
}

function report(
  reference: any,
  backend: 'dom' | 'pixi',
  reportId: string,
  profile: 'physical' | 'desktop' = 'physical'
): any {
  const sequenceIndex = backend === 'dom' ? 1 : 2;
  const scenarios = BOARD_PERFORMANCE_SCENARIO_IDS.map((id) => {
    if (id === 'stability.expansion-skin') return stabilityScenario(backend);
    const count = id === 'basic.multi-flip-8x8' ? 30 : id.startsWith('heavy.') ? 20 : 100;
    return measuredScenario(id, count, backend);
  });
  return {
    schemaVersion: BOARD_PERFORMANCE_REPORT_SCHEMA_VERSION,
    reportId,
    capturedAt: '2026-07-17T00:00:00.000Z',
    captureStartedAt: '2026-07-17T00:00:00.000Z',
    captureUrl: `http://192.0.2.1/?debug=1&boardPerf=1&boardRenderer=${backend}&referenceDevice=${reference.id}&captureOrder=dom-first&captureIndex=${sequenceIndex}&cooldownMs=300000`,
    captureDurationMs: 700_000,
    captureProfile: profile,
    standardRun: true,
    candidateCommit: COMMIT,
    browserArtifactSha256: ARTIFACT,
    artifactFileCount: 3,
    fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
    eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
    lane: 'vite',
    backend,
    captureOrder: { expected: 'dom-first', actual: 'dom-first', sequenceIndex },
    cooldown: { requiredMs: 300_000, observedMs: 300_000, passed: true },
    environment: {
      referenceDevice: reference,
      userAgent: `${reference.browser}/${reference.browserVersion}`,
      platform: reference.platform,
      language: 'en-US',
      screen: { ...reference.screen, availWidth: reference.screen.width, availHeight: reference.screen.height },
      viewport: reference.viewport,
      dpr: reference.dpr,
      orientation: reference.orientation,
      hardwareConcurrency: 8,
      deviceMemory: 8
    },
    readiness: { fontsReady: true, texturesReady: true, applicationReady: true, writerMode: 'idle', backendDiagnostics: diagnostics(backend) },
    delivery: { applicationReadyAtMs: 100, resourceCount: 0, transferSizeBytes: 0, encodedBodySizeBytes: 0, decodedBodySizeBytes: 0, resources: [], textureUploadCount: backend === 'pixi' ? 3 : 0, textureReadyPixelCount: backend === 'pixi' ? 65536 : 0, textureActivePixelCount: backend === 'pixi' ? 65536 : 0 },
    validity: { visibleAtStart: true, focusedAtStart: true, visibilityChangeCount: 0, focusChangeCount: 0, invalidReasons: [], valid: true },
    nominal: { sampleCount: 120, rawTimestampsMs: Array.from({ length: 121 }, (_value, index) => index * 16), rawIntervalsMs: Array.from({ length: 120 }, () => 16), nominalFrameIntervalMs: 16, aggregation: 'median' },
    percentileRule: 'nearest-rank:ceil(p*N)-1',
    rawSamplePolicy: 'unfiltered-no-winsorization',
    attribution: {},
    support: { longAnimationFrame: 'unsupported', longTask: 'unsupported' },
    optionalPerformanceEntries: { longAnimationFrame: [], longTask: [] },
    runConfig: createBoardPerformanceRunConfig(profile),
    scenarios
  };
}

describe('Pixi physical performance evidence validator', () => {
  let root: string;
  const android = device('android-reference', 'android');
  const iphone = device('iphone-reference', 'ios');

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'pixi-perf-validator-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('recomputes every raw summary and accepts a fixed physical report', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const value = report(android, 'pixi', id);
    expect(validatePhysicalReport(value, `pixijs-playfield-${android.id}-pixi-${id}.json`, android)).toEqual([]);
    value.scenarios[0].summary = {
      ...value.scenarios[0].summary,
      raf: { ...value.scenarios[0].summary.raf, p95: 999 }
    };
    expect(validatePhysicalReport(value, `pixijs-playfield-${android.id}-pixi-${id}.json`, android))
      .toEqual(expect.arrayContaining([expect.stringMatching(/rAF summary mismatch/)]));
  });

  test('applies physical basic/heavy/whole-turn DOM comparison gates', () => {
    const dom = report(android, 'dom', '11111111-1111-4111-8111-111111111111');
    const pixi = report(android, 'pixi', '22222222-2222-4222-8222-222222222222');
    expect(evaluatePhysicalPerformancePair(dom, pixi).pass).toBe(true);
    const heavy = pixi.scenarios.find((entry: any) => entry.id === 'heavy.move-8x8');
    heavy.summary = { ...heavy.summary, raf: { ...heavy.summary.raf, max: 120 } };
    expect(evaluatePhysicalPerformancePair(dom, pixi).pass).toBe(false);
  });

  test('validates Android/iPhone × DOM/Pixi identity and writes report-only evidence', () => {
    const incoming = path.join(root, 'incoming');
    fs.mkdirSync(incoming, { recursive: true });
    const reports = [
      report(android, 'dom', '11111111-1111-4111-8111-111111111111'),
      report(android, 'pixi', '22222222-2222-4222-8222-222222222222'),
      report(iphone, 'dom', '33333333-3333-4333-8333-333333333333'),
      report(iphone, 'pixi', '44444444-4444-4444-8444-444444444444')
    ];
    for (const value of reports) {
      const filename = `pixijs-playfield-${value.environment.referenceDevice.id}-${value.backend}-${value.reportId}.json`;
      fs.writeFileSync(path.join(incoming, filename), `${JSON.stringify(value)}\n`);
    }
    const manifestPath = path.join(root, 'reference-devices.json');
    fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 'pixijs_playfield_reference_devices.v1', devices: [android, iphone] }));
    const artifactFiles = [{ path: 'index.classic.html', sha256: '1'.repeat(64) }, { path: 'index.html', sha256: '2'.repeat(64) }];
    const artifactSha = hash(stablePerformanceJson(artifactFiles));
    reports.forEach((value) => { value.browserArtifactSha256 = artifactSha; });
    for (const filename of fs.readdirSync(incoming)) {
      const value = JSON.parse(fs.readFileSync(path.join(incoming, filename), 'utf8'));
      value.browserArtifactSha256 = artifactSha;
      fs.writeFileSync(path.join(incoming, filename), `${JSON.stringify(value)}\n`);
    }
    const desktopReports = (['classic', 'vite'] as const).flatMap((lane) => (['dom', 'pixi'] as const).map((backend) => {
      const value = report(android, backend, backend === 'dom' ? '55555555-5555-4555-8555-555555555555' : '66666666-6666-4666-8666-666666666666', 'desktop');
      value.lane = lane;
      value.browserArtifactSha256 = artifactSha;
      value.phaseZeroMicroComparison = {
        fixtureDigest: BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST,
        standard: true
      };
      return value;
    }));
    const desktopPath = path.join(root, 'desktop.json');
    fs.writeFileSync(desktopPath, JSON.stringify({
      schemaVersion: 'pixijs_playfield_desktop_capture.v1',
      candidateCommit: COMMIT,
      browserArtifact: { fileCount: artifactFiles.length, files: artifactFiles, sha256: artifactSha },
      fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
      eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
      environment: {
        graphics: {
          hardwareAccelerated: true,
          glRenderer: 'ANGLE (Hardware GPU)',
          glVendor: 'Test Vendor'
        }
      },
      phaseZeroEnvironment: { pass: true, checks: [] },
      phaseZeroModelApplyComparison: {
        fixtureDigest: BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST,
        lanes: {
          classic: { immutableDomBaseline: {}, currentDom: {}, currentPixi: {} },
          vite: { immutableDomBaseline: {}, currentDom: {}, currentPixi: {} }
        }
      },
      profile: 'desktop',
      standardRun: true,
      reports: desktopReports,
      crossLaneIdentity: true,
      pass: true
    }));
    fs.mkdirSync(path.join(root, 'docs', 'perf'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'perf', 'pixijs-playfield-baseline.json'), '{}\n');
    const validation = validatePrecutoverEvidence({
      rootDir: root,
      reportsDir: incoming,
      referenceManifestPath: manifestPath,
      desktopCapturePath: desktopPath,
      write: true,
      log: false
    });
    expect(validation.pass).toBe(true);
    expect(validation.rawReports).toHaveLength(4);
    expect(fs.existsSync(path.join(root, 'docs', 'perf', 'pixijs-playfield-mobile', 'optional-physical-validation.json'))).toBe(true);
    expect(fs.readdirSync(path.join(root, 'docs', 'perf', 'pixijs-playfield-mobile', 'reports'))).toHaveLength(4);
  });

  test('validates automated hardware desktop and cross-browser evidence without physical reports', () => {
    const artifactFiles = [{ path: 'index.classic.html', sha256: '1'.repeat(64) }, { path: 'index.html', sha256: '2'.repeat(64) }];
    const artifactSha = hash(stablePerformanceJson(artifactFiles));
    const desktopReports = (['classic', 'vite'] as const).flatMap((lane) => (['dom', 'pixi'] as const).map((backend, index) => {
      const value = report(
        android,
        backend,
        `${lane === 'classic' ? '7' : '8'}${String(index + 1).repeat(7)}-${String(index + 1).repeat(4)}-4${String(index + 1).repeat(3)}-8${String(index + 1).repeat(3)}-${String(index + 1).repeat(12)}`,
        'desktop'
      );
      value.lane = lane;
      value.browserArtifactSha256 = artifactSha;
      value.phaseZeroMicroComparison = { fixtureDigest: BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST, standard: true };
      return value;
    }));
    const desktopCapture = {
      schemaVersion: 'pixijs_playfield_desktop_capture.v1',
      candidateCommit: COMMIT,
      browserArtifact: { fileCount: artifactFiles.length, files: artifactFiles, sha256: artifactSha },
      fixtureDigest: BOARD_PERFORMANCE_FIXTURE_DIGEST,
      eventDigest: BOARD_PERFORMANCE_EVENT_DIGEST,
      environment: {
        graphics: {
          hardwareAccelerated: true,
          glRenderer: 'ANGLE (Hardware GPU)',
          glVendor: 'Test Vendor'
        }
      },
      phaseZeroEnvironment: { pass: true, checks: [] },
      phaseZeroModelApplyComparison: {
        fixtureDigest: BOARD_PERFORMANCE_PHASE_ZERO_MICRO_DIGEST,
        lanes: {
          classic: { immutableDomBaseline: {}, currentDom: {}, currentPixi: {} },
          vite: { immutableDomBaseline: {}, currentDom: {}, currentPixi: {} }
        }
      },
      profile: 'desktop',
      standardRun: true,
      reports: desktopReports,
      crossLaneIdentity: true,
      pass: true
    };
    expect(validateDesktopReport(desktopReports[0], 'classic', 'dom', desktopCapture)).toEqual([]);
    const stalledReport = JSON.parse(JSON.stringify(desktopReports[1]));
    stalledReport.scenarios
      .find((entry: any) => entry.id === 'stability.expansion-skin')
      .rawRafIntervalsMs[10] = 60;
    expect(validateDesktopReport(stalledReport, 'classic', 'pixi', desktopCapture)).toEqual(
      expect.arrayContaining([expect.stringMatching(/rAF stall >= 50ms/)]),
    );
    const staleTimestampReport = JSON.parse(JSON.stringify(desktopReports[1]));
    const staleStability = staleTimestampReport.scenarios
      .find((entry: any) => entry.id === 'stability.expansion-skin');
    staleStability.startedAtPerformanceMs = 1;
    expect(validateDesktopReport(staleTimestampReport, 'classic', 'pixi', desktopCapture)).toEqual(
      expect.arrayContaining([expect.stringMatching(/first rAF timestamp predates the measurement start/)]),
    );

    const scenarioNames = [
      'chromium-desktop',
      'firefox-desktop',
      'webkit-desktop',
      'chromium-touch-mobile',
      'firefox-touch-mobile',
      'webkit-touch-mobile'
    ];
    const probes = scenarioNames.flatMap((name) => (['dom', 'pixi'] as const).map((backend) => ({
      name,
      backend,
      evaluation: { ok: true, errors: [] },
      backendProbe: {
        backend,
        canvasCount: backend === 'pixi' ? 1 : 0,
        contextCount: backend === 'pixi' ? 1 : 0,
        domCellCount: backend === 'dom' ? 64 : 0,
        dpr: name.includes('mobile') ? 2 : 1,
        harnessGlobalPresent: false,
        controlsPresent: false
      },
      registryRequests: [],
      pageErrors: [],
      consoleErrors: [],
      resourceErrors: []
    })));
    const crossPlatform = {
      schemaVersion: 'pixijs_playfield_cross_platform_smoke.v1',
      capturedAt: '2026-07-18T00:00:00.000Z',
      candidateCommit: COMMIT,
      browserArtifactSha256: artifactSha,
      artifactFileCount: artifactFiles.length,
      ok: true,
      errors: [],
      probes
    };
    const desktopPath = path.join(root, 'desktop.json');
    const crossPlatformPath = path.join(root, 'cross-platform.json');
    fs.writeFileSync(desktopPath, JSON.stringify(desktopCapture));
    fs.writeFileSync(crossPlatformPath, JSON.stringify(crossPlatform));
    fs.mkdirSync(path.join(root, 'docs', 'perf'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'perf', 'pixijs-playfield-baseline.json'), '{}\n');
    const validation = validateAutomatedPrecutoverEvidence({
      rootDir: root,
      desktopCapturePath: desktopPath,
      crossPlatformSmokePath: crossPlatformPath,
      write: true,
      log: false
    });
    expect(validation.pass).toBe(true);
    expect(validation.physicalDeviceEvidenceRequired).toBe(false);
    expect(validation.residualRisks).toEqual(expect.arrayContaining([expect.stringMatching(/iPhone GPU/)]));
    expect(fs.readFileSync(path.join(root, 'docs', 'perf', 'pixijs-playfield-precutover.md'), 'utf8'))
      .toContain('not represented as physical Android/iPhone performance evidence');
  });

  test('refuses incomplete evidence and parses only documented CLI options', () => {
    const result = validatePrecutoverEvidence({ rootDir: root, log: false });
    expect(result.pass).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([expect.stringMatching(/Exactly four raw physical reports/)]));
    expect(parseValidatorArgs(['--write', '--reports-dir', 'incoming'])).toEqual({ write: true, reportsDir: 'incoming' });
    expect(parseValidatorArgs(['--automated', '--cross-platform-report', 'cross.json'])).toEqual({
      write: false,
      mode: 'automated',
      crossPlatformSmokePath: 'cross.json'
    });
    expect(() => parseValidatorArgs(['--unknown'])).toThrow(/Unknown argument/);
  });
});
