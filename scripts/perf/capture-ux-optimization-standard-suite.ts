import * as fs from 'fs';
import * as path from 'path';

import {
  captureUxOptimizationMonitor
} from './capture-ux-optimization-monitor';
import {
  UX_OPTIMIZATION_CAPTURE_POLICY,
  UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS,
  nearestRankPercentile,
  type UxOptimizationVerdict
} from './ux-optimization-monitor-contract';
import {
  validateUxOptimizationReport
} from './validate-ux-optimization-monitor';
import {
  readCandidateCommit,
  readGitDirtyPaths
} from '../capture-pixijs-playfield-performance';

export const UX_OPTIMIZATION_STANDARD_SUITE_SCHEMA_VERSION =
  'ux_preserving_runtime_optimization_standard_suite.v1';
export const UX_OPTIMIZATION_STANDARD_SUITE_VALIDATION_SCHEMA_VERSION =
  'ux_preserving_runtime_optimization_standard_suite_validation.v1';

type CaptureRole = 'baseline' | 'candidate';

interface StandardSuiteCliOptions {
  readonly baselineReportPath: string;
  readonly outputPath: string;
  readonly sampleCount: number;
}

export interface UxOptimizationStandardSuiteCheck {
  readonly id: string;
  readonly verdict: UxOptimizationVerdict;
  readonly reasons: readonly string[];
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface UxOptimizationStandardSuiteValidation {
  readonly schemaVersion: typeof UX_OPTIMIZATION_STANDARD_SUITE_VALIDATION_SCHEMA_VERSION;
  readonly reportSchemaVersion: string | null;
  readonly overallVerdict: UxOptimizationVerdict;
  readonly checks: readonly UxOptimizationStandardSuiteCheck[];
  readonly aggregates: Readonly<Record<string, unknown>>;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function findScenario(
  report: Record<string, any>,
  id: string,
  lane: string = 'vite'
): Record<string, any> {
  const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];
  return asRecord(scenarios.find((scenario: any) => (
    scenario?.id === id && scenario?.lane === lane
  )));
}

function metric(
  report: Record<string, any>,
  id: string,
  lane: string,
  key: string
): number {
  return Number(asRecord(findScenario(report, id, lane).metrics)[key]);
}

function median(values: readonly number[]): number | null {
  return nearestRankPercentile(values, 0.5);
}

function p95(values: readonly number[]): number | null {
  return nearestRankPercentile(values, 0.95);
}

function sumEncodedBodyBytes(scenario: Record<string, any>): number {
  const resources = Array.isArray(scenario.resources) ? scenario.resources : [];
  return resources.reduce(
    (total: number, resource: any) => total + Math.max(
      0,
      Number(resource?.encodedBodySize) || 0
    ),
    0
  );
}

function comparableEnvironment(report: Record<string, any>): Readonly<Record<string, unknown>> {
  const identity = asRecord(report.identity);
  const environment = asRecord(identity.environment);
  const graphics = asRecord(environment.graphics);
  return Object.freeze({
    fixtureDigest: identity.fixtureDigest ?? null,
    scenarioDigest: identity.scenarioDigest ?? null,
    capturePolicyDigest: identity.capturePolicyDigest ?? null,
    browserVersion: environment.browserVersion ?? null,
    os: environment.os ?? null,
    viewport: environment.viewport ?? null,
    dpr: environment.dpr ?? null,
    hardwareAccelerated: graphics.hardwareAccelerated ?? null,
    glRenderer: graphics.glRenderer ?? null,
    glVendor: graphics.glVendor ?? null
  });
}

function stableComparable(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function buildUxOptimizationStandardCaptureOrder(
  candidateCommit: string,
  sampleCount: number = UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS.standard
): readonly CaptureRole[] {
  if (!/^[a-f0-9]{40}$/.test(candidateCommit)) {
    throw new Error('candidate commit must be a full lowercase git SHA');
  }
  if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
    throw new Error('sample count must be a positive integer');
  }
  const candidateFirst = Number.parseInt(candidateCommit.slice(-1), 16) % 2 === 1;
  const order: CaptureRole[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const roundCandidateFirst = index % 2 === 0
      ? candidateFirst
      : !candidateFirst;
    order.push(
      ...(roundCandidateFirst
        ? ['candidate', 'baseline'] as const
        : ['baseline', 'candidate'] as const)
    );
  }
  return Object.freeze(order);
}

function collectFeatureAggregates(
  candidateReports: readonly Record<string, any>[]
): readonly Readonly<Record<string, unknown>>[] {
  return Object.freeze([
    'profile',
    'rules-help',
    'deck-builder',
    'network'
  ].flatMap((feature) => ['vite', 'classic'].map((lane) => {
    const reports = candidateReports.map((report) => (
      asRecord(findScenario(report, `feature.${feature}`, lane).metrics)
    ));
    const firstOpenValues = reports.map((metrics) => Number(metrics.firstOpenLatencyMs));
    const styleValues = reports.map((metrics) => Number(metrics.firstStyleReadyLatencyMs));
    const clsValues = reports.map((metrics) => Number(metrics.clsDelta));
    const longTaskValues = reports.map(
      (metrics) => Number(metrics.firstOpenLongTaskCount)
    );
    return Object.freeze({
      feature,
      lane,
      firstOpenP95Ms: p95(firstOpenValues),
      stylesheetReadyP95Ms: p95(styleValues),
      maxClsDelta: clsValues.length > 0 ? Math.max(...clsValues) : null,
      totalFirstOpenLongTasks: longTaskValues.reduce(
        (total, value) => total + value,
        0
      )
    });
  })));
}

function collectAggregates(
  baselineReports: readonly Record<string, any>[],
  candidateReports: readonly Record<string, any>[]
): Readonly<Record<string, unknown>> {
  const baselineReady = baselineReports.map(
    (report) => metric(report, 'boot.pixi.cold', 'vite', 'capturedAtMs')
  );
  const candidateReady = candidateReports.map(
    (report) => metric(report, 'boot.pixi.cold', 'vite', 'capturedAtMs')
  );
  const baselineBytes = baselineReports.map((report) => sumEncodedBodyBytes(
    findScenario(report, 'boot.pixi.cold', 'vite')
  ));
  const candidateBytes = candidateReports.map((report) => sumEncodedBodyBytes(
    findScenario(report, 'boot.pixi.cold', 'vite')
  ));
  const baselineReadyMedian = median(baselineReady);
  const candidateReadyMedian = median(candidateReady);
  const baselineBytesMedian = median(baselineBytes);
  const candidateBytesMedian = median(candidateBytes);
  const featureRows = collectFeatureAggregates(candidateReports);
  const resultRows = Object.freeze(['vite', 'classic'].map((lane) => Object.freeze({
    lane,
    stylesheetReadyP95Ms: p95(candidateReports.map(
      (report) => metric(
        report,
        'feature.result',
        lane,
        'normalStylesheetReadyLatencyMs'
      )
    ))
  })));
  const opponentRows = candidateReports.map(
    (report) => asRecord(findScenario(
      report,
      'playback.opponent-actions',
      'vite'
    ).metrics)
  );
  return Object.freeze({
    sampleCount: candidateReports.length,
    boardReady: Object.freeze({
      baselineSamplesMs: Object.freeze(baselineReady),
      candidateSamplesMs: Object.freeze(candidateReady),
      baselineMedianMs: baselineReadyMedian,
      candidateMedianMs: candidateReadyMedian,
      deltaMs: baselineReadyMedian === null || candidateReadyMedian === null
        ? null
        : candidateReadyMedian - baselineReadyMedian,
      deltaRatio: baselineReadyMedian === null
        || candidateReadyMedian === null
        || baselineReadyMedian <= 0
        ? null
        : candidateReadyMedian / baselineReadyMedian - 1
    }),
    bootEncodedBody: Object.freeze({
      baselineSamplesBytes: Object.freeze(baselineBytes),
      candidateSamplesBytes: Object.freeze(candidateBytes),
      baselineMedianBytes: baselineBytesMedian,
      candidateMedianBytes: candidateBytesMedian,
      deltaRatio: baselineBytesMedian === null
        || candidateBytesMedian === null
        || baselineBytesMedian <= 0
        ? null
        : candidateBytesMedian / baselineBytesMedian - 1
    }),
    features: featureRows,
    result: resultRows,
    opponentActions: Object.freeze({
      totalLongTasks: opponentRows.reduce(
        (total, metrics) => total + Number(metrics.longTaskCount),
        0
      ),
      totalRafStalls50ms: opponentRows.reduce(
        (total, metrics) => total + Number(metrics.rafStall50msCount),
        0
      ),
      rafP95Ms: p95(opponentRows.map((metrics) => Number(metrics.rafP95Ms))),
      allTickerIdle: opponentRows.every((metrics) => metrics.tickerIdle === true)
    })
  });
}

export function validateUxOptimizationStandardSuite(
  value: unknown
): UxOptimizationStandardSuiteValidation {
  const suite = asRecord(value);
  const checks: UxOptimizationStandardSuiteCheck[] = [];
  const addCheck = (
    id: string,
    reasons: readonly string[],
    evidence?: Readonly<Record<string, unknown>>
  ): void => {
    checks.push(Object.freeze({
      id,
      verdict: reasons.length === 0 ? 'pass' : 'fail',
      reasons: Object.freeze(reasons.slice()),
      ...(evidence ? { evidence: Object.freeze({ ...evidence }) } : {})
    }));
  };
  addCheck(
    'suite.schema',
    suite.schemaVersion === UX_OPTIMIZATION_STANDARD_SUITE_SCHEMA_VERSION
      ? []
      : [`schemaVersion must be ${UX_OPTIMIZATION_STANDARD_SUITE_SCHEMA_VERSION}`]
  );

  const expectedSampleCount = UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS.standard;
  const baselineReports = Array.isArray(suite.baselineReports)
    ? suite.baselineReports.map(asRecord)
    : [];
  const candidateReports = Array.isArray(suite.candidateReports)
    ? suite.candidateReports.map(asRecord)
    : [];
  const sampleReasons: string[] = [];
  if (Number(suite.sampleCount) !== expectedSampleCount) {
    sampleReasons.push(`sample count must be ${expectedSampleCount}`);
  }
  if (baselineReports.length !== expectedSampleCount) {
    sampleReasons.push(`baseline report count was ${baselineReports.length}`);
  }
  if (candidateReports.length !== expectedSampleCount) {
    sampleReasons.push(`candidate report count was ${candidateReports.length}`);
  }
  addCheck('suite.sample-count', sampleReasons);

  const candidateCommit = String(suite.candidateCommit || '');
  const expectedOrder = /^[a-f0-9]{40}$/.test(candidateCommit)
    ? buildUxOptimizationStandardCaptureOrder(candidateCommit, expectedSampleCount)
    : [];
  const actualOrder = Array.isArray(suite.captureOrder)
    ? suite.captureOrder.map(String)
    : [];
  addCheck(
    'suite.capture-order',
    stableComparable(actualOrder) === stableComparable(expectedOrder)
      ? []
      : ['capture order does not match the candidate-derived alternating order'],
    { expectedOrder, actualOrder }
  );

  const baselineReasons: string[] = [];
  const baselineArtifactIdentity = baselineReports.length > 0
    ? Object.freeze({
      browserArtifactSha256: asRecord(baselineReports[0].identity)
        .browserArtifactSha256 ?? null,
      artifactFileCount: asRecord(baselineReports[0].identity)
        .artifactFileCount ?? null
    })
    : null;
  baselineReports.forEach((report, index) => {
    const validation = validateUxOptimizationReport(report);
    if (!validation.baselineValid) {
      baselineReasons.push(`baseline sample ${index + 1} is invalid`);
    }
    if (report.profile !== 'baseline') {
      baselineReasons.push(`baseline sample ${index + 1} profile was ${String(report.profile)}`);
    }
    if (asRecord(report.identity).candidateCommit !== suite.baselineCommit) {
      baselineReasons.push(`baseline sample ${index + 1} commit changed`);
    }
    if (
      baselineArtifactIdentity === null
      || stableComparable({
        browserArtifactSha256: asRecord(report.identity).browserArtifactSha256 ?? null,
        artifactFileCount: asRecord(report.identity).artifactFileCount ?? null
      }) !== stableComparable(baselineArtifactIdentity)
    ) {
      baselineReasons.push(`baseline sample ${index + 1} artifact identity changed`);
    }
  });
  addCheck('suite.baseline-reports', baselineReasons, {
    artifactIdentity: baselineArtifactIdentity
  });

  const candidateReasons: string[] = [];
  const candidateArtifactIdentity = candidateReports.length > 0
    ? Object.freeze({
      browserArtifactSha256: asRecord(candidateReports[0].identity)
        .browserArtifactSha256 ?? null,
      artifactFileCount: asRecord(candidateReports[0].identity)
        .artifactFileCount ?? null
    })
    : null;
  candidateReports.forEach((report, index) => {
    const validation = validateUxOptimizationReport(report);
    if (validation.overallVerdict !== 'pass' || !validation.candidateEligible) {
      candidateReasons.push(`candidate sample ${index + 1} did not pass as eligible`);
    }
    if (report.profile !== 'standard') {
      candidateReasons.push(`candidate sample ${index + 1} profile was ${String(report.profile)}`);
    }
    if (asRecord(report.identity).candidateCommit !== candidateCommit) {
      candidateReasons.push(`candidate sample ${index + 1} commit changed`);
    }
    if (
      candidateArtifactIdentity === null
      || stableComparable({
        browserArtifactSha256: asRecord(report.identity).browserArtifactSha256 ?? null,
        artifactFileCount: asRecord(report.identity).artifactFileCount ?? null
      }) !== stableComparable(candidateArtifactIdentity)
    ) {
      candidateReasons.push(`candidate sample ${index + 1} artifact identity changed`);
    }
  });
  addCheck('suite.candidate-reports', candidateReasons, {
    artifactIdentity: candidateArtifactIdentity
  });

  const observedOrder = [...baselineReports.map((report) => ({
    role: 'baseline' as const,
    capturedAt: String(report.capturedAt || '')
  })), ...candidateReports.map((report) => ({
    role: 'candidate' as const,
    capturedAt: String(report.capturedAt || '')
  }))].sort((left, right) => left.capturedAt.localeCompare(right.capturedAt));
  const observedOrderReasons: string[] = [];
  if (observedOrder.some((entry) => (
    !/^\d{4}-\d{2}-\d{2}T/.test(entry.capturedAt)
  ))) {
    observedOrderReasons.push('one or more sample capture timestamps are invalid');
  }
  if (new Set(observedOrder.map((entry) => entry.capturedAt)).size !== observedOrder.length) {
    observedOrderReasons.push('sample capture timestamps must be unique');
  }
  if (
    stableComparable(observedOrder.map((entry) => entry.role))
      !== stableComparable(expectedOrder)
  ) {
    observedOrderReasons.push('observed sample timestamps do not alternate in the required order');
  }
  addCheck('suite.observed-capture-order', observedOrderReasons, {
    expectedOrder,
    observedOrder
  });

  const compatibilityReasons: string[] = [];
  const allReports = [...baselineReports, ...candidateReports];
  const referenceEnvironment = allReports.length > 0
    ? comparableEnvironment(allReports[0])
    : null;
  allReports.forEach((report, index) => {
    if (
      referenceEnvironment === null
      || stableComparable(comparableEnvironment(report))
        !== stableComparable(referenceEnvironment)
    ) {
      compatibilityReasons.push(`report ${index + 1} environment/policy is incompatible`);
    }
  });
  addCheck('suite.compatibility', compatibilityReasons, {
    referenceEnvironment
  });

  const aggregates = collectAggregates(baselineReports, candidateReports);
  const boardReady = asRecord(aggregates.boardReady);
  const boardReasons: string[] = [];
  const baselineMedian = Number(boardReady.baselineMedianMs);
  const candidateMedian = Number(boardReady.candidateMedianMs);
  if (!Number.isFinite(baselineMedian) || !Number.isFinite(candidateMedian)) {
    boardReasons.push('board ready median is missing');
  } else if (
    candidateMedian - baselineMedian > 100
    && candidateMedian > baselineMedian * 1.05
  ) {
    boardReasons.push(
      `candidate board ready median regressed ${candidateMedian - baselineMedian}ms`
    );
  }
  addCheck('suite.board-ready', boardReasons, boardReady);

  const body = asRecord(aggregates.bootEncodedBody);
  const bodyReasons: string[] = [];
  const baselineBody = Number(body.baselineMedianBytes);
  const candidateBody = Number(body.candidateMedianBytes);
  if (!Number.isFinite(baselineBody) || !Number.isFinite(candidateBody)) {
    bodyReasons.push('boot encoded body median is missing');
  } else if (baselineBody > 0 && candidateBody > baselineBody * 1.01) {
    bodyReasons.push('candidate boot encoded body increased by more than 1%');
  }
  addCheck('suite.boot-encoded-body', bodyReasons, body);

  const performanceReasons: string[] = [];
  const features = Array.isArray(aggregates.features) ? aggregates.features : [];
  for (const rowValue of features) {
    const row = asRecord(rowValue);
    if (
      !Number.isFinite(Number(row.firstOpenP95Ms))
      || Number(row.firstOpenP95Ms)
        > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
      || !Number.isFinite(Number(row.stylesheetReadyP95Ms))
      || Number(row.stylesheetReadyP95Ms)
        > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
      || Number(row.maxClsDelta) > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.cls
      || Number(row.totalFirstOpenLongTasks) !== 0
    ) {
      performanceReasons.push(
        `${String(row.feature)}:${String(row.lane)} performance gate failed`
      );
    }
  }
  const resultRows = Array.isArray(aggregates.result) ? aggregates.result : [];
  for (const rowValue of resultRows) {
    const row = asRecord(rowValue);
    if (
      !Number.isFinite(Number(row.stylesheetReadyP95Ms))
      || Number(row.stylesheetReadyP95Ms)
        > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.resultStylesheetP95Ms
    ) {
      performanceReasons.push(`result:${String(row.lane)} style gate failed`);
    }
  }
  const opponent = asRecord(aggregates.opponentActions);
  if (
    Number(opponent.totalLongTasks) !== 0
    || Number(opponent.totalRafStalls50ms) !== 0
    || opponent.allTickerIdle !== true
  ) {
    performanceReasons.push('opponent-action performance gate failed');
  }
  addCheck('suite.performance', performanceReasons, {
    features,
    result: resultRows,
    opponentActions: opponent
  });

  const overallPass = checks.every((check) => check.verdict === 'pass');
  return Object.freeze({
    schemaVersion: UX_OPTIMIZATION_STANDARD_SUITE_VALIDATION_SCHEMA_VERSION,
    reportSchemaVersion: typeof suite.schemaVersion === 'string'
      ? suite.schemaVersion
      : null,
    overallVerdict: overallPass ? 'pass' : 'fail',
    checks: Object.freeze(checks),
    aggregates
  });
}

export function parseStandardSuiteArgs(
  argv: readonly string[]
): StandardSuiteCliOptions {
  let baselineReportPath =
    'artifacts/ux-optimization-monitor/baseline/pre-optimization.json';
  let outputPath = 'artifacts/ux-optimization-monitor/standard-suite.json';
  let sampleCount = UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS.standard;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--baseline-report') {
      baselineReportPath = String(argv[++index] || '');
    } else if (arg === '--output') {
      outputPath = String(argv[++index] || '');
    } else if (arg === '--samples') {
      sampleCount = Number(argv[++index]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!baselineReportPath) throw new Error('--baseline-report requires a path');
  if (!outputPath) throw new Error('--output requires a path');
  if (!Number.isInteger(sampleCount) || sampleCount <= 0) {
    throw new Error('--samples requires a positive integer');
  }
  return Object.freeze({ baselineReportPath, outputPath, sampleCount });
}

export async function captureUxOptimizationStandardSuite(
  options: Readonly<{
    rootDir?: string;
    baselineReportPath?: string;
    outputPath?: string;
    sampleCount?: number;
    log?: boolean;
  }> = {}
): Promise<Readonly<Record<string, unknown>>> {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const dirtyPaths = readGitDirtyPaths(rootDir);
  if (dirtyPaths.length > 0) {
    throw new Error(`Standard suite requires a clean checkout:\n${dirtyPaths.join('\n')}`);
  }
  const candidateCommit = readCandidateCommit(rootDir);
  const baselineSeed = asRecord(JSON.parse(fs.readFileSync(
    path.resolve(
      rootDir,
      options.baselineReportPath
        || 'artifacts/ux-optimization-monitor/baseline/pre-optimization.json'
    ),
    'utf8'
  )));
  const baselineIdentity = asRecord(baselineSeed.identity);
  const archive = asRecord(baselineSeed.baselineArtifactArchive);
  const baselineArtifactRoot = String(archive.path || '');
  const baselineCommit = String(baselineIdentity.candidateCommit || '');
  if (!baselineArtifactRoot) {
    throw new Error('Baseline report does not reference an archived browser artifact');
  }
  if (!/^[a-f0-9]{40}$/.test(baselineCommit)) {
    throw new Error('Baseline report commit is invalid');
  }
  const sampleCount = options.sampleCount
    ?? UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS.standard;
  const captureOrder = buildUxOptimizationStandardCaptureOrder(
    candidateCommit,
    sampleCount
  );
  const baselineReports: Record<string, unknown>[] = [];
  const candidateReports: Record<string, unknown>[] = [];
  for (let index = 0; index < captureOrder.length; index += 1) {
    const role = captureOrder[index];
    if (options.log !== false) {
      process.stdout.write(
        `[ux-standard-suite] ${index + 1}/${captureOrder.length} ${role}\n`
      );
    }
    if (role === 'baseline') {
      baselineReports.push(await captureUxOptimizationMonitor({
        rootDir,
        profile: 'baseline',
        artifactRoot: baselineArtifactRoot,
        candidateCommit: baselineCommit,
        bootOnly: true,
        outputPath: null,
        log: false
      }) as Record<string, unknown>);
    } else {
      candidateReports.push(await captureUxOptimizationMonitor({
        rootDir,
        profile: 'standard',
        outputPath: null,
        log: false
      }) as Record<string, unknown>);
    }
  }
  const suite = Object.freeze({
    schemaVersion: UX_OPTIMIZATION_STANDARD_SUITE_SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    candidateCommit,
    baselineCommit,
    sampleCount,
    captureOrder,
    baselineReports: Object.freeze(baselineReports),
    candidateReports: Object.freeze(candidateReports)
  });
  const outputPath = path.resolve(
    rootDir,
    options.outputPath || 'artifacts/ux-optimization-monitor/standard-suite.json'
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(suite, null, 2)}\n`, 'utf8');
  return suite;
}

if (require.main === module) {
  void (async () => {
    try {
      const options = parseStandardSuiteArgs(process.argv.slice(2));
      if (options.sampleCount !== UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS.standard) {
        throw new Error(
          `standard suite requires ${UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS.standard} samples`
        );
      }
      const suite = await captureUxOptimizationStandardSuite({
        baselineReportPath: options.baselineReportPath,
        outputPath: options.outputPath,
        sampleCount: options.sampleCount
      });
      const validation = validateUxOptimizationStandardSuite(suite);
      process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
      if (validation.overallVerdict !== 'pass') process.exitCode = 1;
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`);
      process.exitCode = 1;
    }
  })();
}
