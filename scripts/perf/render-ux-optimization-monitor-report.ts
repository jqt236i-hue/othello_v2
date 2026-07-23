import * as fs from 'fs';
import * as path from 'path';

import {
  computeBrowserArtifactManifest,
  readCandidateCommit,
  readGitDirtyPaths
} from '../capture-pixijs-playfield-performance';
import {
  UX_OPTIMIZATION_IDS,
  UX_OPTIMIZATION_SCENARIOS,
  type UxOptimizationVerdict
} from './ux-optimization-monitor-contract';
import {
  validateUxOptimizationReport,
  type UxOptimizationValidationResult
} from './validate-ux-optimization-monitor';
import {
  validateUxOptimizationStandardSuite,
  type UxOptimizationStandardSuiteValidation
} from './capture-ux-optimization-standard-suite';

export const UX_OPTIMIZATION_SUMMARY_SCHEMA_VERSION =
  'ux_preserving_runtime_optimization_summary.v1';

interface RenderCliOptions {
  readonly inputPath: string;
  readonly baselinePath: string | null;
  readonly suitePath: string | null;
  readonly outputJsonPath: string | null;
  readonly outputMarkdownPath: string | null;
  readonly writeSummaryPath: string | null;
  readonly candidateArtifactRoot: string;
  readonly baselineArtifactRoot: string | null;
}

export interface UxOptimizationIdentityCheck {
  readonly role: 'baseline' | 'candidate';
  readonly verdict: UxOptimizationVerdict;
  readonly reasons: readonly string[];
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface UxOptimizationCompatibilityCheck {
  readonly id: string;
  readonly verdict: UxOptimizationVerdict;
  readonly baseline: unknown;
  readonly candidate: unknown;
}

export interface UxOptimizationTraceabilityRow {
  readonly optimizationId: string;
  readonly kind: 'core' | 'feature';
  readonly scenarioIds: readonly string[];
  readonly requiredCaptureKeys: readonly string[];
  readonly checkIds: readonly string[];
  readonly verdict: UxOptimizationVerdict;
}

export interface UxOptimizationSummaryDocument {
  readonly schemaVersion: typeof UX_OPTIMIZATION_SUMMARY_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly verdict: UxOptimizationVerdict;
  readonly comparisonVerdict: UxOptimizationVerdict | 'not-requested';
  readonly candidate: Readonly<{
    commit: string | null;
    artifactSha256: string | null;
    profile: string | null;
    deviceValidated: boolean;
    validation: UxOptimizationValidationResult;
  }>;
  readonly baseline: Readonly<{
    commit: string | null;
    artifactSha256: string | null;
    profile: string | null;
    validation: UxOptimizationValidationResult;
  }> | null;
  readonly identityChecks: readonly UxOptimizationIdentityCheck[];
  readonly compatibilityChecks: readonly UxOptimizationCompatibilityCheck[];
  readonly traceability: readonly UxOptimizationTraceabilityRow[];
  readonly standardSuiteValidation: UxOptimizationStandardSuiteValidation | null;
  readonly metrics: Readonly<Record<string, unknown>>;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function environmentValue(report: Record<string, any>, key: string): unknown {
  const environment = asRecord(asRecord(report.identity).environment);
  if (key === 'gpu') {
    const graphics = asRecord(environment.graphics);
    return {
      hardwareAccelerated: graphics.hardwareAccelerated ?? null,
      glRenderer: graphics.glRenderer ?? null,
      glVendor: graphics.glVendor ?? null
    };
  }
  return environment[key] ?? null;
}

export function validateUxOptimizationComparisonCompatibility(
  baselineValue: unknown,
  candidateValue: unknown
): readonly UxOptimizationCompatibilityCheck[] {
  const baseline = asRecord(baselineValue);
  const candidate = asRecord(candidateValue);
  const baselineIdentity = asRecord(baseline.identity);
  const candidateIdentity = asRecord(candidate.identity);
  const entries: readonly Readonly<{
    id: string;
    baseline: unknown;
    candidate: unknown;
  }>[] = [
    {
      id: 'profile-role',
      baseline: baseline.profile ?? null,
      candidate: candidate.profile ?? null
    },
    {
      id: 'fixture-digest',
      baseline: baselineIdentity.fixtureDigest ?? null,
      candidate: candidateIdentity.fixtureDigest ?? null
    },
    {
      id: 'scenario-digest',
      baseline: baselineIdentity.scenarioDigest ?? null,
      candidate: candidateIdentity.scenarioDigest ?? null
    },
    {
      id: 'capture-policy-digest',
      baseline: baselineIdentity.capturePolicyDigest ?? null,
      candidate: candidateIdentity.capturePolicyDigest ?? null
    },
    {
      id: 'browser-version',
      baseline: environmentValue(baseline, 'browserVersion'),
      candidate: environmentValue(candidate, 'browserVersion')
    },
    {
      id: 'os',
      baseline: environmentValue(baseline, 'os'),
      candidate: environmentValue(candidate, 'os')
    },
    {
      id: 'gpu',
      baseline: environmentValue(baseline, 'gpu'),
      candidate: environmentValue(candidate, 'gpu')
    },
    {
      id: 'viewport',
      baseline: environmentValue(baseline, 'viewport'),
      candidate: environmentValue(candidate, 'viewport')
    },
    {
      id: 'dpr',
      baseline: environmentValue(baseline, 'dpr'),
      candidate: environmentValue(candidate, 'dpr')
    }
  ];
  return Object.freeze(entries.map((entry) => {
    const compatible = entry.id === 'profile-role'
      ? entry.baseline === 'baseline' && entry.candidate === 'standard'
      : sameJson(entry.baseline, entry.candidate);
    const verdict: UxOptimizationVerdict = compatible ? 'pass' : 'fail';
    return Object.freeze({
      ...entry,
      verdict
    });
  }));
}

export function buildUxOptimizationTraceability(
  validation: UxOptimizationValidationResult
): readonly UxOptimizationTraceabilityRow[] {
  return Object.freeze(UX_OPTIMIZATION_IDS.map((optimizationId) => {
    const scenarios = UX_OPTIMIZATION_SCENARIOS.filter(
      (scenario) => scenario.optimizationIds.includes(optimizationId)
    );
    const scenarioIds = scenarios.map((scenario) => scenario.id);
    const requiredCaptureKeys = scenarios.flatMap(
      (scenario) => scenario.requiredCaptures.map((capture) => capture.key)
    );
    const requiredKeySet = new Set(requiredCaptureKeys);
    const checks = validation.checks.filter((check) => {
      if (!check.id.startsWith('scenario.')) return false;
      return Array.from(requiredKeySet).some(
        (key) => check.id === `scenario.${key}`
      );
    });
    return Object.freeze({
      optimizationId,
      kind: optimizationId.startsWith('feature-') ? 'feature' : 'core',
      scenarioIds: Object.freeze(scenarioIds),
      requiredCaptureKeys: Object.freeze(requiredCaptureKeys),
      checkIds: Object.freeze(checks.map((check) => check.id)),
      verdict: checks.length === requiredCaptureKeys.length
        && checks.every((check) => check.verdict === 'pass')
        ? 'pass'
        : 'fail'
    });
  }));
}

function findScenario(
  report: Record<string, any>,
  id: string,
  lane: string
): Record<string, any> {
  const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];
  return asRecord(scenarios.find((scenario: any) => (
    scenario?.id === id && scenario?.lane === lane
  )));
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

function collectSummaryMetrics(report: Record<string, any>): Readonly<Record<string, unknown>> {
  const bootVite = findScenario(report, 'boot.pixi.cold', 'vite');
  const bootClassic = findScenario(report, 'boot.classic-pixi.cold', 'classic');
  const features = [
    'result',
    'profile',
    'rules-help',
    'deck-builder',
    'network'
  ].flatMap((feature) => ['vite', 'classic'].map((lane) => {
    const scenario = findScenario(report, `feature.${feature}`, lane);
    const metrics = asRecord(scenario.metrics);
    return Object.freeze({
      feature,
      lane,
      firstOpenMs: feature === 'result'
        ? null
        : Number(metrics.firstOpenLatencyMs),
      stylesheetReadyMs: Number(
        feature === 'result'
          ? metrics.normalStylesheetReadyLatencyMs
          : metrics.firstStyleReadyLatencyMs
      ),
      clsDelta: Number(metrics.clsDelta),
      firstOpenLongTaskCount: feature === 'result'
        ? null
        : Number(metrics.firstOpenLongTaskCount)
    });
  }));
  const opponent = asRecord(findScenario(
    report,
    'playback.opponent-actions',
    'vite'
  ).metrics);
  return Object.freeze({
    boot: Object.freeze([
      Object.freeze({
        lane: 'vite',
        readyMs: Number(asRecord(bootVite.metrics).capturedAtMs),
        encodedBodyBytes: sumEncodedBodyBytes(bootVite)
      }),
      Object.freeze({
        lane: 'classic',
        readyMs: Number(asRecord(bootClassic.metrics).capturedAtMs),
        encodedBodyBytes: sumEncodedBodyBytes(bootClassic)
      })
    ]),
    features: Object.freeze(features),
    opponentActions: Object.freeze({
      longTaskCount: Number(opponent.longTaskCount),
      rafP95Ms: Number(opponent.rafP95Ms),
      rafStall50msCount: Number(opponent.rafStall50msCount),
      tickerIdle: opponent.tickerIdle === true
    })
  });
}

export function verifyUxOptimizationArtifactIdentity(
  role: 'baseline' | 'candidate',
  reportValue: unknown,
  artifactRoot: string,
  options: Readonly<{
    expectedCommit?: string;
    archiveManifestPath?: string;
  }> = {}
): UxOptimizationIdentityCheck {
  const report = asRecord(reportValue);
  const identity = asRecord(report.identity);
  const reasons: string[] = [];
  let actualSha256: string | null = null;
  let actualFileCount: number | null = null;
  try {
    const artifact = computeBrowserArtifactManifest(artifactRoot);
    actualSha256 = artifact.sha256;
    actualFileCount = artifact.fileCount;
    if (artifact.sha256 !== identity.browserArtifactSha256) {
      reasons.push('browser artifact digest does not match the report identity');
    }
    if (Number(identity.artifactFileCount) !== artifact.fileCount) {
      reasons.push('browser artifact file count does not match the report identity');
    }
  } catch (error) {
    reasons.push(`browser artifact could not be verified: ${
      error instanceof Error ? error.message : String(error)
    }`);
  }
  if (
    options.expectedCommit
    && identity.candidateCommit !== options.expectedCommit
  ) {
    reasons.push('candidate commit does not match the expected checkout commit');
  }
  if (options.archiveManifestPath) {
    try {
      const manifest = asRecord(JSON.parse(
        fs.readFileSync(options.archiveManifestPath, 'utf8')
      ));
      if (role === 'baseline') {
        const archive = asRecord(report.baselineArtifactArchive);
        if (archive.sha256 !== identity.browserArtifactSha256) {
          reasons.push('report archive digest does not match the report identity');
        }
        if (Number(archive.fileCount) !== Number(identity.artifactFileCount)) {
          reasons.push('report archive file count does not match the report identity');
        }
      }
      if (manifest.candidateCommit !== identity.candidateCommit) {
        reasons.push('artifact archive commit does not match the report identity');
      }
      if (manifest.browserArtifactSha256 !== identity.browserArtifactSha256) {
        reasons.push('artifact archive digest does not match the report identity');
      }
      if (Number(manifest.fileCount) !== Number(identity.artifactFileCount)) {
        reasons.push('artifact archive file count does not match the report identity');
      }
    } catch (error) {
      reasons.push(`artifact archive manifest could not be verified: ${
        error instanceof Error ? error.message : String(error)
      }`);
    }
  }
  return Object.freeze({
    role,
    verdict: reasons.length === 0 ? 'pass' : 'fail',
    reasons: Object.freeze(reasons),
    evidence: Object.freeze({
      reportCommit: identity.candidateCommit ?? null,
      reportArtifactSha256: identity.browserArtifactSha256 ?? null,
      actualArtifactSha256: actualSha256,
      actualFileCount
    })
  });
}

export function createUxOptimizationSummary(
  candidateValue: unknown,
  options: Readonly<{
    baseline?: unknown;
    standardSuite?: unknown;
    identityChecks?: readonly UxOptimizationIdentityCheck[];
    generatedAt?: string;
  }> = {}
): UxOptimizationSummaryDocument {
  const candidate = asRecord(candidateValue);
  const baseline = options.baseline === undefined ? null : asRecord(options.baseline);
  const candidateValidation = validateUxOptimizationReport(candidate);
  const baselineValidation = baseline ? validateUxOptimizationReport(baseline) : null;
  const standardSuiteValidation = options.standardSuite === undefined
    ? null
    : validateUxOptimizationStandardSuite(options.standardSuite);
  const identityChecks = Object.freeze((options.identityChecks || []).slice());
  const compatibilityChecks = baseline
    ? validateUxOptimizationComparisonCompatibility(baseline, candidate)
    : Object.freeze([] as UxOptimizationCompatibilityCheck[]);
  const comparisonRequested = baseline !== null;
  const candidateIdentityChecks = identityChecks.filter(
    (check) => check.role === 'candidate'
  );
  const baselineIdentityChecks = identityChecks.filter(
    (check) => check.role === 'baseline'
  );
  const candidateIdentityValid = candidateIdentityChecks.length === 1
    && candidateIdentityChecks.every((check) => check.verdict === 'pass');
  const baselineIdentityValid = !comparisonRequested || (
    baselineIdentityChecks.length === 1
      && baselineIdentityChecks.every((check) => check.verdict === 'pass')
  );
  const comparisonValid = !comparisonRequested || (
    baselineValidation?.baselineValid === true
      && compatibilityChecks.every((check) => check.verdict === 'pass')
      && baselineIdentityValid
      && (
        standardSuiteValidation === null
          || standardSuiteValidation.overallVerdict === 'pass'
      )
  );
  const verdict: UxOptimizationVerdict = candidateValidation.overallVerdict === 'pass'
    && candidateValidation.candidateEligible
    && candidateIdentityValid
    && (
      standardSuiteValidation === null
        || standardSuiteValidation.overallVerdict === 'pass'
    )
    && (!comparisonRequested || comparisonValid)
    ? 'pass'
    : 'fail';
  const candidateIdentity = asRecord(candidate.identity);
  const baselineIdentity = baseline ? asRecord(baseline.identity) : {};
  return Object.freeze({
    schemaVersion: UX_OPTIMIZATION_SUMMARY_SCHEMA_VERSION,
    generatedAt: options.generatedAt || new Date().toISOString(),
    verdict,
    comparisonVerdict: comparisonRequested
      ? (comparisonValid ? 'pass' : 'fail')
      : 'not-requested',
    candidate: Object.freeze({
      commit: typeof candidateIdentity.candidateCommit === 'string'
        ? candidateIdentity.candidateCommit
        : null,
      artifactSha256: typeof candidateIdentity.browserArtifactSha256 === 'string'
        ? candidateIdentity.browserArtifactSha256
        : null,
      profile: typeof candidate.profile === 'string' ? candidate.profile : null,
      deviceValidated: candidate.deviceValidated === true,
      validation: candidateValidation
    }),
    baseline: baseline && baselineValidation
      ? Object.freeze({
        commit: typeof baselineIdentity.candidateCommit === 'string'
          ? baselineIdentity.candidateCommit
          : null,
        artifactSha256: typeof baselineIdentity.browserArtifactSha256 === 'string'
          ? baselineIdentity.browserArtifactSha256
          : null,
        profile: typeof baseline.profile === 'string' ? baseline.profile : null,
        validation: baselineValidation
      })
      : null,
    identityChecks,
    compatibilityChecks,
    traceability: buildUxOptimizationTraceability(candidateValidation),
    standardSuiteValidation,
    metrics: standardSuiteValidation === null
      ? collectSummaryMetrics(candidate)
      : standardSuiteValidation.aggregates
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  if (typeof value === 'number') return Number.isFinite(value)
    ? `${Math.round(value * 10) / 10}`
    : 'n/a';
  return String(value);
}

function formatByteDelta(
  baselineValue: unknown,
  candidateValue: unknown,
  deltaRatioValue: unknown
): string {
  if (
    typeof baselineValue !== 'number'
    || !Number.isFinite(baselineValue)
    || typeof candidateValue !== 'number'
    || !Number.isFinite(candidateValue)
    || typeof deltaRatioValue !== 'number'
    || !Number.isFinite(deltaRatioValue)
  ) {
    return 'n/a';
  }
  const deltaBytes = Math.round(candidateValue - baselineValue);
  const deltaPercent = Math.round(deltaRatioValue * 10_000) / 100;
  return `${deltaBytes} bytes (${deltaPercent}%)`;
}

export function renderUxOptimizationSummaryMarkdown(
  summary: UxOptimizationSummaryDocument
): string {
  const metrics = asRecord(summary.metrics);
  const boot = Array.isArray(metrics.boot) ? metrics.boot : [];
  const features = Array.isArray(metrics.features) ? metrics.features : [];
  const boardReady = asRecord(metrics.boardReady);
  const bootEncodedBody = asRecord(metrics.bootEncodedBody);
  const result = Array.isArray(metrics.result) ? metrics.result : [];
  const opponentActions = asRecord(metrics.opponentActions);
  const standardSuite = summary.standardSuiteValidation;
  const failedChecks = summary.candidate.validation.checks.filter(
    (check) => check.verdict !== 'pass'
  );
  const failedSuiteChecks = standardSuite?.checks.filter(
    (check) => check.verdict !== 'pass'
  ) || [];
  const measurementSections = standardSuite
    ? [
      '## 標準5サンプル比較',
      '',
      `- sample count: \`${formatValue(metrics.sampleCount)}\``,
      `- suite verdict: \`${standardSuite.overallVerdict}\``,
      '',
      '| metric | baseline median | candidate median | delta |',
      '| --- | ---: | ---: | ---: |',
      `| board ready ms | ${formatValue(boardReady.baselineMedianMs)}`
        + ` | ${formatValue(boardReady.candidateMedianMs)}`
        + ` | ${formatValue(boardReady.deltaMs)} |`,
      `| boot encoded body bytes | ${formatValue(bootEncodedBody.baselineMedianBytes)}`
        + ` | ${formatValue(bootEncodedBody.candidateMedianBytes)}`
        + ` | ${formatByteDelta(
          bootEncodedBody.baselineMedianBytes,
          bootEncodedBody.candidateMedianBytes,
          bootEncodedBody.deltaRatio
        )} |`,
      '',
      '## 遅延feature p95',
      '',
      '| feature | lane | first open p95 ms | stylesheet ready p95 ms | max CLS | Long Task total |',
      '| --- | --- | ---: | ---: | ---: | ---: |',
      ...features.map((entry: any) => (
        `| ${formatValue(entry.feature)} | ${formatValue(entry.lane)}`
        + ` | ${formatValue(entry.firstOpenP95Ms)}`
        + ` | ${formatValue(entry.stylesheetReadyP95Ms)}`
        + ` | ${formatValue(entry.maxClsDelta)}`
        + ` | ${formatValue(entry.totalFirstOpenLongTasks)} |`
      )),
      ...result.map((entry: any) => (
        `| result | ${formatValue(entry.lane)} | n/a`
        + ` | ${formatValue(entry.stylesheetReadyP95Ms)} | n/a | n/a |`
      )),
      '',
      '## 対局中フレーム安定性',
      '',
      `- Long Task total: \`${formatValue(opponentActions.totalLongTasks)}\``,
      `- 50ms RAF stall total: \`${formatValue(opponentActions.totalRafStalls50ms)}\``,
      `- RAF p95 ms: \`${formatValue(opponentActions.rafP95Ms)}\``,
      `- all ticker idle: \`${formatValue(opponentActions.allTickerIdle)}\``,
      ''
    ]
    : [
      '## 起動計測',
      '',
      '| lane | ready ms | encoded body bytes |',
      '| --- | ---: | ---: |',
      ...boot.map((entry: any) => (
        `| ${formatValue(entry.lane)} | ${formatValue(entry.readyMs)} | ${formatValue(entry.encodedBodyBytes)} |`
      )),
      '',
      '## 遅延feature計測',
      '',
      '| feature | lane | first open ms | stylesheet ready ms | CLS | Long Task |',
      '| --- | --- | ---: | ---: | ---: | ---: |',
      ...features.map((entry: any) => (
        `| ${formatValue(entry.feature)} | ${formatValue(entry.lane)}`
        + ` | ${formatValue(entry.firstOpenMs)} | ${formatValue(entry.stylesheetReadyMs)}`
        + ` | ${formatValue(entry.clsDelta)} | ${formatValue(entry.firstOpenLongTaskCount)} |`
      )),
      ''
    ];
  const lines = [
    '# UX維持ランタイム最適化 完了レポート',
    '',
    `- 総合判定: **${summary.verdict.toUpperCase()}**`,
    `- candidate commit: \`${summary.candidate.commit || 'n/a'}\``,
    `- candidate profile: \`${summary.candidate.profile || 'n/a'}\``,
    `- candidate eligible: \`${summary.candidate.validation.candidateEligible}\``,
    `- comparison: \`${summary.comparisonVerdict}\``,
    `- deviceValidated: \`${summary.candidate.deviceValidated}\``,
    `- generatedAt: \`${summary.generatedAt}\``,
    '',
    ...measurementSections,
    '## Traceability',
    '',
    '| optimization | kind | required captures | verdict |',
    '| --- | --- | ---: | --- |',
    ...summary.traceability.map((row) => (
      `| \`${row.optimizationId}\` | ${row.kind} | ${row.requiredCaptureKeys.length}`
      + ` | ${row.verdict} |`
    )),
    '',
    '## Identity / compatibility',
    '',
    ...(
      summary.identityChecks.length === 0 && summary.compatibilityChecks.length === 0
        ? ['- 比較は要求されていません。']
        : [
          ...summary.identityChecks.map((check) => (
            `- ${check.role} artifact identity: ${check.verdict}`
            + (check.reasons.length ? ` — ${check.reasons.join('; ')}` : '')
          )),
          ...summary.compatibilityChecks.map((check) => (
            `- ${check.id}: ${check.verdict}`
          ))
        ]
    ),
    '',
    '## Blocking failures',
    '',
    ...(failedChecks.length === 0 && failedSuiteChecks.length === 0
      ? ['- なし']
      : [
        ...failedChecks.map((check) => (
          `- \`${check.id}\`: ${check.reasons.join('; ')}`
        )),
        ...failedSuiteChecks.map((check) => (
          `- \`${check.id}\`: ${check.reasons.join('; ')}`
        ))
      ]),
    ''
  ];
  return `${lines.join('\n')}\n`;
}

export function parseRenderArgs(argv: readonly string[]): RenderCliOptions {
  let inputPath = 'artifacts/ux-optimization-monitor/candidate.json';
  let baselinePath: string | null = null;
  let suitePath: string | null = null;
  let outputJsonPath: string | null = null;
  let outputMarkdownPath: string | null = null;
  let writeSummaryPath: string | null = null;
  let candidateArtifactRoot = 'worker-public';
  let baselineArtifactRoot: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') inputPath = String(argv[++index] || '');
    else if (arg === '--baseline') baselinePath = String(argv[++index] || '');
    else if (arg === '--suite') suitePath = String(argv[++index] || '');
    else if (arg === '--output-json') outputJsonPath = String(argv[++index] || '');
    else if (arg === '--output-markdown') outputMarkdownPath = String(argv[++index] || '');
    else if (arg === '--write-summary') writeSummaryPath = String(argv[++index] || '');
    else if (arg === '--candidate-artifact-root') {
      candidateArtifactRoot = String(argv[++index] || '');
    } else if (arg === '--baseline-artifact-root') {
      baselineArtifactRoot = String(argv[++index] || '');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!inputPath) throw new Error('--input requires a path');
  if (baselinePath === '') throw new Error('--baseline requires a path');
  if (suitePath === '') throw new Error('--suite requires a path');
  if (suitePath && baselinePath) {
    throw new Error('--suite cannot be combined with --baseline');
  }
  if (outputJsonPath === '') throw new Error('--output-json requires a path');
  if (outputMarkdownPath === '') throw new Error('--output-markdown requires a path');
  if (writeSummaryPath === '') throw new Error('--write-summary requires a path');
  if (!candidateArtifactRoot) throw new Error('--candidate-artifact-root requires a path');
  if (baselineArtifactRoot === '') throw new Error('--baseline-artifact-root requires a path');
  return Object.freeze({
    inputPath,
    baselinePath,
    suitePath,
    outputJsonPath,
    outputMarkdownPath,
    writeSummaryPath,
    candidateArtifactRoot,
    baselineArtifactRoot
  });
}

function writeTextFile(rootDir: string, filePath: string, body: string): void {
  const resolved = path.resolve(rootDir, filePath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, body, 'utf8');
}

export function runRenderCli(
  argv: readonly string[],
  rootDir: string = process.cwd()
): UxOptimizationSummaryDocument {
  const options = parseRenderArgs(argv);
  const standardSuite = options.suitePath
    ? JSON.parse(fs.readFileSync(path.resolve(rootDir, options.suitePath), 'utf8'))
    : undefined;
  const suiteRecord = asRecord(standardSuite);
  const candidate = standardSuite
    ? asRecord(Array.isArray(suiteRecord.candidateReports)
      ? suiteRecord.candidateReports[0]
      : null)
    : JSON.parse(fs.readFileSync(
      path.resolve(rootDir, options.inputPath),
      'utf8'
    ));
  const baseline = standardSuite
    ? asRecord(Array.isArray(suiteRecord.baselineReports)
      ? suiteRecord.baselineReports[0]
      : null)
    : options.baselinePath
      ? JSON.parse(fs.readFileSync(path.resolve(rootDir, options.baselinePath), 'utf8'))
      : undefined;
  const identityChecks: UxOptimizationIdentityCheck[] = [];
  const candidateRoot = path.resolve(rootDir, options.candidateArtifactRoot);
  const candidateIdentity = verifyUxOptimizationArtifactIdentity(
    'candidate',
    candidate,
    candidateRoot,
    { expectedCommit: readCandidateCommit(rootDir) }
  );
  const currentDirtyPaths = readGitDirtyPaths(rootDir);
  identityChecks.push(currentDirtyPaths.length === 0
    ? candidateIdentity
    : Object.freeze({
      ...candidateIdentity,
      verdict: 'fail' as UxOptimizationVerdict,
      reasons: Object.freeze([
        ...candidateIdentity.reasons,
        'summary generation requires a clean checkout'
      ]),
      evidence: Object.freeze({
        ...candidateIdentity.evidence,
        dirtyPathCount: currentDirtyPaths.length
      })
    }));
  if (baseline) {
    const archive = asRecord(asRecord(baseline).baselineArtifactArchive);
    const baselineRoot = path.resolve(
      rootDir,
      options.baselineArtifactRoot || String(archive.path || '')
    );
    identityChecks.push(verifyUxOptimizationArtifactIdentity(
      'baseline',
      baseline,
      baselineRoot,
      {
        archiveManifestPath: path.resolve(
          rootDir,
          String(archive.manifestPath || '')
        )
      }
    ));
  }
  const summary = createUxOptimizationSummary(candidate, {
    baseline,
    standardSuite,
    identityChecks
  });
  const json = `${JSON.stringify(summary, null, 2)}\n`;
  const markdown = renderUxOptimizationSummaryMarkdown(summary);
  if (options.outputJsonPath) writeTextFile(rootDir, options.outputJsonPath, json);
  if (options.outputMarkdownPath) {
    writeTextFile(rootDir, options.outputMarkdownPath, markdown);
  }
  if (options.writeSummaryPath) {
    const docsPerfRoot = path.resolve(rootDir, 'docs/perf');
    const target = path.resolve(rootDir, options.writeSummaryPath);
    if (target !== docsPerfRoot && !target.startsWith(`${docsPerfRoot}${path.sep}`)) {
      throw new Error('--write-summary must target docs/perf/');
    }
    writeTextFile(rootDir, options.writeSummaryPath, markdown);
  }
  process.stdout.write(json);
  return summary;
}

if (require.main === module) {
  try {
    const summary = runRenderCli(process.argv.slice(2));
    if (summary.verdict !== 'pass') process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`);
    process.exitCode = 1;
  }
}
