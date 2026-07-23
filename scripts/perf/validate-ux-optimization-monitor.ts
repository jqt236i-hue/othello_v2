import * as fs from 'fs';
import * as path from 'path';

import {
  UX_OPTIMIZATION_CAPTURE_POLICY,
  UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST,
  UX_OPTIMIZATION_FORBIDDEN_REPORT_KEYS,
  UX_OPTIMIZATION_IDS,
  UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
  UX_OPTIMIZATION_SCENARIO_DIGEST,
  UX_OPTIMIZATION_SCENARIO_CAPTURES,
  UX_OPTIMIZATION_SCENARIOS,
  UX_OPTIMIZATION_VALIDATION_SCHEMA_VERSION,
  isAllowedStaticResourcePath,
  normalizePhaseName,
  type UxOptimizationVerdict
} from './ux-optimization-monitor-contract';

export interface UxOptimizationValidationCheck {
  readonly id: string;
  readonly verdict: UxOptimizationVerdict;
  readonly blocking: boolean;
  readonly reasons: readonly string[];
  readonly evidence?: Readonly<Record<string, unknown>>;
}

export interface UxOptimizationValidationResult {
  readonly schemaVersion: typeof UX_OPTIMIZATION_VALIDATION_SCHEMA_VERSION;
  readonly reportSchemaVersion: string | null;
  readonly overallVerdict: UxOptimizationVerdict;
  readonly baselineValid: boolean;
  readonly developmentValid: boolean;
  readonly focusedVerdict: UxOptimizationVerdict | null;
  readonly targetOptimizationIds: readonly string[];
  readonly candidateEligible: boolean;
  readonly pendingOptimizationIds: readonly string[];
  readonly checks: readonly UxOptimizationValidationCheck[];
}

interface ValidationOptions {
  readonly expectedCandidateCommit?: string;
  readonly expectedArtifactSha256?: string;
  readonly targetOptimizationIds?: readonly string[];
}

const FORBIDDEN_KEYS = new Set(
  UX_OPTIMIZATION_FORBIDDEN_REPORT_KEYS.map((key) => key.toLowerCase())
);

type BootLogicalImageKind = 'hero' | 'default-hand';

const DEFAULT_FRAME_PNG_PATH =
  'assets/images/board/board-frame-marsh-forged-iron-v1.png';
const DEFAULT_FRAME_WEBP_PATH =
  'assets/images/board/board-frame-marsh-forged-iron-v1.webp';

function classifyBootLogicalImagePath(value: unknown): BootLogicalImageKind | null {
  const rawPath = String(value || '').replace(/^\/+/, '');
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch (_error) { /* malformed evidence remains unclassified */ }
  if (
    decodedPath === 'assets/images/hero/hero.png'
    || /^vite-dist\/assets\/hero-[A-Za-z0-9_-]+\.png$/.test(decodedPath)
  ) {
    return 'hero';
  }
  if (
    decodedPath === 'assets/images/hand-skin/勇者の手.png'
    || /^vite-dist\/assets\/勇者の手-[A-Za-z0-9_-]+\.png$/.test(decodedPath)
  ) {
    return 'default-hand';
  }
  return null;
}

export function findForbiddenReportPaths(value: unknown): readonly string[] {
  const violations: string[] = [];
  const seen = new Set<object>();
  const visit = (candidate: unknown, currentPath: string): void => {
    if (!candidate || typeof candidate !== 'object') return;
    if (seen.has(candidate as object)) return;
    seen.add(candidate as object);
    if (Array.isArray(candidate)) {
      candidate.forEach((entry, index) => visit(entry, `${currentPath}[${index}]`));
      return;
    }
    for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
      const nextPath = currentPath ? `${currentPath}.${key}` : key;
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) violations.push(nextPath);
      visit(child, nextPath);
    }
  };
  visit(value, '');
  return Object.freeze(violations);
}

export function validateUxOptimizationReport(
  value: unknown,
  options: ValidationOptions = {}
): UxOptimizationValidationResult {
  const report = value && typeof value === 'object'
    ? value as Record<string, any>
    : {};
  const checks: UxOptimizationValidationCheck[] = [];
  const addCheck = (
    id: string,
    pass: boolean,
    reasons: readonly string[],
    evidence?: Readonly<Record<string, unknown>>
  ): void => {
    checks.push(Object.freeze({
      id,
      verdict: pass ? 'pass' : 'fail',
      blocking: true,
      reasons: Object.freeze(pass ? [] : reasons.slice()),
      ...(evidence ? { evidence: Object.freeze({ ...evidence }) } : {})
    }));
  };

  addCheck(
    'report.schema',
    report.schemaVersion === UX_OPTIMIZATION_REPORT_SCHEMA_VERSION,
    [`schemaVersion must be ${UX_OPTIMIZATION_REPORT_SCHEMA_VERSION}`],
    { actual: report.schemaVersion ?? null }
  );

  const identity = report.identity && typeof report.identity === 'object'
    ? report.identity as Record<string, any>
    : {};
  const identityReasons: string[] = [];
  if (!/^[0-9a-f]{40}$/.test(String(identity.candidateCommit || ''))) {
    identityReasons.push('candidateCommit must be a full lowercase git SHA');
  }
  if (typeof identity.dirty !== 'boolean' || !Array.isArray(identity.dirtyPaths)) {
    identityReasons.push('dirty and dirtyPaths are required');
  }
  if (!/^[0-9a-f]{64}$/.test(String(identity.browserArtifactSha256 || ''))) {
    identityReasons.push('browserArtifactSha256 must be SHA-256');
  }
  if (!/^[0-9a-f]{64}$/.test(String(identity.fixtureDigest || ''))) {
    identityReasons.push('fixtureDigest must be SHA-256');
  }
  if (identity.scenarioDigest !== UX_OPTIMIZATION_SCENARIO_DIGEST) {
    identityReasons.push('scenarioDigest does not match the monitor contract');
  }
  if (identity.capturePolicyDigest !== UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST) {
    identityReasons.push('capturePolicyDigest does not match the monitor contract');
  }
  if (options.expectedCandidateCommit
      && identity.candidateCommit !== options.expectedCandidateCommit) {
    identityReasons.push('candidateCommit does not match the validated checkout');
  }
  if (options.expectedArtifactSha256
      && identity.browserArtifactSha256 !== options.expectedArtifactSha256) {
    identityReasons.push('browserArtifactSha256 does not match the validated artifact');
  }
  const environment = identity.environment;
  if (!environment
      || typeof environment.browserVersion !== 'string'
      || typeof environment.os !== 'string'
      || !environment.viewport
      || !Number.isFinite(Number(environment.viewport.width))
      || !Number.isFinite(Number(environment.viewport.height))
      || !Number.isFinite(Number(environment.dpr))) {
    identityReasons.push('browser/OS/viewport/DPR environment is incomplete');
  }
  addCheck('report.identity', identityReasons.length === 0, identityReasons);

  const forbiddenPaths = findForbiddenReportPaths(report);
  addCheck(
    'report.data-safety',
    forbiddenPaths.length === 0,
    forbiddenPaths.map((entry) => `forbidden key at ${entry}`),
    { forbiddenPaths }
  );

  const scenarios = Array.isArray(report.scenarios) ? report.scenarios : [];
  const captureKey = (entry: any): string => (
    `${String(entry?.id || '')}:${String(entry?.lane || '')}:${String(entry?.backend || '')}`
  );
  const scenarioKeys = scenarios.map(captureKey);
  const duplicateScenarioKeys = scenarioKeys.filter(
    (key: string, index: number) => key && scenarioKeys.indexOf(key) !== index
  );
  const expectedScenarioKeys = UX_OPTIMIZATION_SCENARIO_CAPTURES.map(
    (definition) => definition.key
  );
  const missingScenarioKeys = expectedScenarioKeys.filter(
    (key) => !scenarioKeys.includes(key)
  );
  const unknownScenarioKeys = scenarioKeys.filter(
    (key: string) => !expectedScenarioKeys.includes(key)
  );
  addCheck(
    'report.scenario-set',
    duplicateScenarioKeys.length === 0
      && missingScenarioKeys.length === 0
      && unknownScenarioKeys.length === 0,
    [
      ...duplicateScenarioKeys.map((key: string) => `duplicate scenario capture: ${key}`),
      ...missingScenarioKeys.map((key) => `missing scenario capture: ${key}`),
      ...unknownScenarioKeys.map((key: string) => `unknown scenario capture: ${key}`)
    ],
    { duplicateScenarioKeys, missingScenarioKeys, unknownScenarioKeys }
  );

  for (const definition of UX_OPTIMIZATION_SCENARIO_CAPTURES) {
    const scenario = scenarios.find((entry: any) => captureKey(entry) === definition.key);
    if (!scenario) continue;
    const reasons: string[] = [];
    if (scenario.lane !== definition.lane) reasons.push(`lane must be ${definition.lane}`);
    if (scenario.backend !== definition.backend) reasons.push(`backend must be ${definition.backend}`);
    if (scenario.cacheProfile !== definition.cacheProfile) {
      reasons.push(`cacheProfile must be ${definition.cacheProfile}`);
    }
    const phases = Array.isArray(scenario.phases) ? scenario.phases : [];
    let previousAtMs = -Infinity;
    for (const phase of phases) {
      if (!normalizePhaseName(phase?.name)) reasons.push(`invalid phase: ${String(phase?.name || '')}`);
      const atMs = Number(phase?.atMs);
      if (!Number.isFinite(atMs) || atMs < previousAtMs) reasons.push('phase timestamps are invalid or unordered');
      previousAtMs = atMs;
    }
    const resources = Array.isArray(scenario.resources) ? scenario.resources : [];
    for (const resource of resources) {
      if (!isAllowedStaticResourcePath(resource?.path)) {
        reasons.push(`resource path is not allowlisted: ${String(resource?.path || '')}`);
      }
    }
    const expectedFault = scenario.expectedFault && typeof scenario.expectedFault === 'object'
      ? scenario.expectedFault
      : null;
    const errors = Array.isArray(scenario.errors) ? scenario.errors : [];
    const unexpectedErrors = expectedFault
      ? errors.filter((entry: any) => (
          entry?.kind !== expectedFault.kind || entry?.path !== expectedFault.path
        ))
      : errors;
    const expectedMatches = expectedFault
      ? errors.filter((entry: any) => (
          entry?.kind === expectedFault.kind && entry?.path === expectedFault.path
        ))
      : [];
    if (unexpectedErrors.length > 0) reasons.push(`${unexpectedErrors.length} unexpected browser error(s)`);
    const expectedFaultCount = expectedFault
      ? Math.max(1, Math.trunc(Number(expectedFault.count) || 1))
      : 0;
    if (expectedFault && expectedMatches.length !== expectedFaultCount) {
      reasons.push(`expected fault count must be ${expectedFaultCount}, got ${expectedMatches.length}`);
    }
    if (scenario.captureStatus !== 'complete') {
      reasons.push(`captureStatus is ${String(scenario.captureStatus || 'missing')}`);
    }
    if (
      scenario.captureStatus === 'complete'
      && (
        definition.id === 'boot.pixi.cold'
        || definition.id === 'boot.classic-pixi.cold'
      )
    ) {
      const specialResources = resources.filter((resource: any) => (
        String(resource?.path || '').startsWith('assets/images/special-stones/')
        && String(resource?.initiatorType || '').toLowerCase() !== 'css'
      ));
      const neededIds = Array.isArray(scenario.metrics?.neededSpecialAssetIds)
        ? scenario.metrics.neededSpecialAssetIds.map(String)
        : [];
      if (specialResources.length > neededIds.length * 2) {
        reasons.push(
          `normal Pixi boot requested ${specialResources.length} special-stone resource(s) `
          + `for ${neededIds.length} needed logical id(s)`
        );
      }
      if (specialResources.length > 0 && neededIds.length === 0) {
        reasons.push('normal Pixi boot requested special-stone resources with no needed logical ids');
      }
    }
    if (
      scenario.captureStatus === 'complete'
      && [
        'boot.pixi.cold',
        'boot.pixi.warm',
        'boot.classic-pixi.cold'
      ].includes(definition.id)
    ) {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const bodyCounts: Record<BootLogicalImageKind, number> = {
        hero: 0,
        'default-hand': 0
      };
      for (const resource of resources) {
        const kind = classifyBootLogicalImagePath(resource?.path);
        if (kind) bodyCounts[kind] += 1;
      }
      for (const [kind, count] of Object.entries(bodyCounts)) {
        if (count > 1) reasons.push(`${kind} logical image requested ${count} response bodies`);
      }

      if (!Array.isArray(metrics.imageConstructorAssignments)) {
        reasons.push('image constructor assignment evidence is missing');
      } else {
        const relevantAssignments = metrics.imageConstructorAssignments
          .map(classifyBootLogicalImagePath)
          .filter(Boolean);
        if (relevantAssignments.length > 0) {
          reasons.push(
            `logical boot images used ${relevantAssignments.length} detached Image preload(s)`
          );
        }
      }
      if (!Array.isArray(metrics.logicalImageSrcMutations)) {
        reasons.push('logical image src mutation evidence is missing');
      } else {
        const relevantMutations = metrics.logicalImageSrcMutations.filter((entry: any) => (
          classifyBootLogicalImagePath(entry?.logicalPath) !== null
        ));
        if (relevantMutations.length > 0) {
          reasons.push(
            `logical boot images mutated src ${relevantMutations.length} time(s)`
          );
        }
      }
    }
    if (
      scenario.captureStatus === 'complete'
      && [
        'boot.pixi.cold',
        'boot.classic-pixi.cold'
      ].includes(definition.id)
    ) {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      if (Number(metrics.initialHelpImageSrcCount) !== 0) {
        reasons.push(
          `initial help image src count was ${String(metrics.initialHelpImageSrcCount)}`
        );
      }
      if (Number(metrics.initialHelpImageElementCount) !== 0) {
        reasons.push(
          `initial help image element count was ${String(metrics.initialHelpImageElementCount)}`
        );
      }
      const compatStylesheetResources = resources.filter(
        (resource: any) => String(resource?.path || '') === 'styles-board-dom-compat.css'
      );
      if (compatStylesheetResources.length !== 0) {
        reasons.push(
          `normal Pixi requested DOM compatibility CSS ${compatStylesheetResources.length} time(s)`
        );
      }
      if (Number(metrics.domCompatStylesheetLinkCount) !== 0) {
        reasons.push(
          `normal Pixi mounted ${String(metrics.domCompatStylesheetLinkCount)} DOM compatibility stylesheet link(s)`
        );
      }
      if (Number(metrics.domCompatStylesheetSlotCount) !== 1) {
        reasons.push(
          `DOM compatibility stylesheet slot count was ${String(metrics.domCompatStylesheetSlotCount)}`
        );
      }
      const resultStylesheetResources = resources.filter(
        (resource: any) => String(resource?.path || '') === 'styles-layout-result.css'
      );
      if (resultStylesheetResources.length !== 0) {
        reasons.push(
          `boot requested result CSS ${resultStylesheetResources.length} time(s)`
        );
      }
      if (Number(metrics.resultStylesheetLinkCount) !== 0) {
        reasons.push(
          `boot mounted ${String(metrics.resultStylesheetLinkCount)} result stylesheet link(s)`
        );
      }
      if (Number(metrics.resultStylesheetSlotCount) !== 1) {
        reasons.push(
          `result stylesheet slot count was ${String(metrics.resultStylesheetSlotCount)}`
        );
      }
      if (Number(metrics.featureInnerDomCounts?.result) !== 0) {
        reasons.push(
          `boot result inner DOM count was ${String(metrics.featureInnerDomCounts?.result)}`
        );
      }
      const profileStylesheetResources = resources.filter(
        (resource: any) => String(resource?.path || '') === 'styles-profile.css'
      );
      if (profileStylesheetResources.length !== 0) {
        reasons.push(
          `boot requested profile CSS ${profileStylesheetResources.length} time(s)`
        );
      }
      if (Number(metrics.profileStylesheetLinkCount) !== 0) {
        reasons.push(
          `boot mounted ${String(metrics.profileStylesheetLinkCount)} profile stylesheet link(s)`
        );
      }
      if (Number(metrics.profileStylesheetSlotCount) !== 1) {
        reasons.push(
          `profile stylesheet slot count was ${String(metrics.profileStylesheetSlotCount)}`
        );
      }
      if (Number(metrics.featureInnerDomCounts?.profile) !== 0) {
        reasons.push(
          `boot profile inner DOM count was ${String(metrics.featureInnerDomCounts?.profile)}`
        );
      }
      const rulesHelpStylesheetResources = resources.filter(
        (resource: any) => [
          'styles-feature-rules-help-layout-info.css',
          'styles-feature-rules-help-cards.css',
          'styles-feature-rules-help-responsive.css'
        ].includes(String(resource?.path || ''))
      );
      if (rulesHelpStylesheetResources.length !== 0) {
        reasons.push(
          `boot requested rules help CSS ${rulesHelpStylesheetResources.length} time(s)`
        );
      }
      if (Number(metrics.rulesHelpStylesheetLinkCount) !== 0) {
        reasons.push(
          `boot mounted ${String(metrics.rulesHelpStylesheetLinkCount)} rules help stylesheet link(s)`
        );
      }
      if (Number(metrics.rulesHelpStylesheetSlotCount) !== 3) {
        reasons.push(
          `rules help stylesheet slot count was ${String(metrics.rulesHelpStylesheetSlotCount)}`
        );
      }
      if (Number(metrics.featureInnerDomCounts?.rulesHelp) !== 0) {
        reasons.push(
          `boot rules help inner DOM count was ${String(metrics.featureInnerDomCounts?.rulesHelp)}`
        );
      }
      const deckBuilderStylesheetResources = resources.filter(
        (resource: any) => [
          'styles-feature-deck-builder.css',
          'styles-feature-deck-builder-responsive.css'
        ].includes(String(resource?.path || ''))
      );
      if (deckBuilderStylesheetResources.length !== 0) {
        reasons.push(
          `boot requested deck builder CSS ${deckBuilderStylesheetResources.length} time(s)`
        );
      }
      if (Number(metrics.deckBuilderStylesheetLinkCount) !== 0) {
        reasons.push(
          `boot mounted ${String(metrics.deckBuilderStylesheetLinkCount)} deck builder stylesheet link(s)`
        );
      }
      if (Number(metrics.deckBuilderStylesheetSlotCount) !== 2) {
        reasons.push(
          `deck builder stylesheet slot count was ${String(metrics.deckBuilderStylesheetSlotCount)}`
        );
      }
      if (Number(metrics.featureInnerDomCounts?.deckBuilder) !== 0) {
        reasons.push(
          `boot deck builder inner DOM count was ${String(metrics.featureInnerDomCounts?.deckBuilder)}`
        );
      }
      const networkStylesheetResources = resources.filter(
        (resource: any) => [
          'styles-feature-network-layout-controls.css',
          'styles-feature-network.css',
          'styles-feature-network-responsive.css'
        ].includes(String(resource?.path || ''))
      );
      if (networkStylesheetResources.length !== 0) {
        reasons.push(
          `boot requested network CSS ${networkStylesheetResources.length} time(s)`
        );
      }
      if (Number(metrics.networkStylesheetLinkCount) !== 0) {
        reasons.push(
          `boot mounted ${String(metrics.networkStylesheetLinkCount)} network stylesheet link(s)`
        );
      }
      if (Number(metrics.networkStylesheetSlotCount) !== 3) {
        reasons.push(
          `network stylesheet slot count was ${String(metrics.networkStylesheetSlotCount)}`
        );
      }
      if (Number(metrics.featureInnerDomCounts?.network) !== 0) {
        reasons.push(
          `boot network inner DOM count was ${String(metrics.featureInnerDomCounts?.network)}`
        );
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'feature.result') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const resultResources = resources.filter(
        (resource: any) => String(resource?.path || '') === 'styles-layout-result.css'
      );
      if (metrics.backend !== 'pixi') {
        reasons.push(`result scenario backend was ${String(metrics.backend || 'missing')}`);
      }
      if (Number(metrics.resultStylesheetLinkCountBeforeOpen) !== 0) {
        reasons.push('result stylesheet was mounted before first result preparation');
      }
      if (Number(metrics.resultStylesheetSlotCount) !== 1) {
        reasons.push(`result stylesheet slot count was ${String(metrics.resultStylesheetSlotCount)}`);
      }
      if (Number(metrics.resultDomCountBeforeOpen) !== 0) {
        reasons.push('result DOM existed before first result preparation');
      }
      if (Number(metrics.resultResponseCountBeforeOpen) !== 0) {
        reasons.push('result stylesheet response occurred before first result preparation');
      }
      if (Number(metrics.normalLinkCountImmediately) !== 1 || metrics.normalOverlayImmediate !== false) {
        reasons.push('normal result path did not start one stylesheet during the existing delay');
      }
      if (
        Number(metrics.normalDisplayDelayMs) < 1_900
        || Number(metrics.normalDisplayDelayMs) > 2_300
      ) {
        reasons.push(`normal result display delay was ${String(metrics.normalDisplayDelayMs)}ms`);
      }
      if (
        !Number.isFinite(Number(metrics.normalStylesheetReadyLatencyMs))
        || Number(metrics.normalStylesheetReadyLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.resultStylesheetP95Ms
      ) {
        reasons.push(
          `normal result stylesheet readiness was ${String(metrics.normalStylesheetReadyLatencyMs)}ms`
        );
      }
      if (
        metrics.normalFullStyleReady !== true
        || Number(metrics.normalStyleLeadMs) < 0
        || metrics.normalCascadeOrderPreserved !== true
      ) {
        reasons.push('normal result full style was not ready before display in canonical cascade order');
      }
      if (
        Number(metrics.resultResponseCountAfterNormalOpen) !== 1
        || Number(metrics.normalResultLinkCount) !== 1
        || resultResources.length !== 1
      ) {
        reasons.push('normal result path did not retain exactly one stylesheet request/link');
      }
      if (
        metrics.normalPanelVisible !== true
        || metrics.normalButtonsVisible !== true
        || Number(metrics.normalWarningCount) !== 0
      ) {
        reasons.push('normal result presentation was not fully visible and warning-free');
      }
      if (
        metrics.normalFocusPreserved !== true
        || Number(metrics.normalBgmCallCount) !== 1
        || metrics.normalBgmOutcome !== 'win'
        || metrics.normalAppendBeforeBgm !== true
      ) {
        reasons.push('normal result focus/BGM ordering changed');
      }
      if (
        metrics.normalCloseWorked !== true
        || metrics.normalReopenAvailable !== true
        || metrics.normalReopenWorked !== true
        || Number(metrics.normalLinkCountAfterReopen) !== 1
      ) {
        reasons.push('normal result close/reopen behavior or stylesheet deduplication changed');
      }
      if (
        metrics.directReturnType !== 'undefined'
        || metrics.directDomImmediate !== true
        || Number(metrics.directCallLatencyMs) > 50
      ) {
        reasons.push('direct showResultOverlay synchronous contract changed');
      }
      if (
        metrics.directFullStylePending !== true
        || metrics.directCriticalPosition !== 'fixed'
        || metrics.directCriticalDisplay !== 'flex'
        || metrics.directCriticalZIndex !== '20000'
        || metrics.directCriticalBackgroundImage !== 'none'
        || metrics.directCriticalPanelOverflow !== 'auto'
        || metrics.directCriticalPanelVisible !== true
        || metrics.directCriticalButtonsVisible !== true
      ) {
        reasons.push('direct result critical style was not immediately readable and operable');
      }
      if (
        metrics.directFullStyleReady !== true
        || Number(metrics.directResultLinkCount) !== 1
        || Number(metrics.directResultResponseCount) !== 1
        || metrics.directCascadeOrderPreserved !== true
        || Number(metrics.directUnexpectedErrorCount) !== 0
      ) {
        reasons.push('direct result path did not settle to one full stylesheet without errors');
      }
      if (
        metrics.failureDirectReturnType !== 'undefined'
        || metrics.failureDomImmediate !== true
        || Number(metrics.failureDirectCallLatencyMs) > 50
        || metrics.failureInitialButtonsVisible !== true
        || metrics.failureWarningVisible !== true
        || metrics.failureFallbackClass !== true
        || metrics.failureButtonsVisible !== true
        || Number(metrics.failureResultLinkCount) !== 0
      ) {
        reasons.push('failed result stylesheet did not retain the synchronous critical fallback');
      }
      if (
        Number(metrics.failureResultRequestCount) !== 2
        || Number(metrics.failureResultRequestFailureCount) !== 1
        || Number(metrics.failureResultResponseCount) !== 1
        || Number(metrics.failureConsoleErrorCount) !== 1
        || Number(metrics.failureConsoleWarningCount) !== 1
      ) {
        reasons.push('result stylesheet injected failure evidence was not exact');
      }
      if (
        metrics.failureRetryReady !== true
        || Number(metrics.failureRetryWarningCount) !== 0
        || metrics.failureRetryFallbackClass !== false
        || Number(metrics.failureRetryResultLinkCount) !== 1
      ) {
        reasons.push('result stylesheet retry did not recover to one full-style link');
      }
      if (
        typeof metrics.clsDelta !== 'number'
        || !Number.isFinite(metrics.clsDelta)
        || metrics.clsDelta > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.cls
      ) {
        reasons.push(`result first-open CLS was ${String(metrics.clsDelta)}`);
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'feature.profile') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const profileResources = resources.filter(
        (resource: any) => String(resource?.path || '') === 'styles-profile.css'
      );
      if (metrics.backend !== 'pixi') {
        reasons.push(`profile scenario backend was ${String(metrics.backend || 'missing')}`);
      }
      if (
        Number(metrics.profileStylesheetLinkCountBeforeOpen) !== 0
        || Number(metrics.profileResponseCountBeforeOpen) !== 0
        || Number(metrics.profileInnerDomCountBeforeOpen) !== 0
      ) {
        reasons.push('profile CSS, response, or inner DOM existed before first open');
      }
      if (Number(metrics.profileStylesheetSlotCount) !== 1) {
        reasons.push(`profile stylesheet slot count was ${String(metrics.profileStylesheetSlotCount)}`);
      }
      if (metrics.profileOpenIconReady !== true) {
        reasons.push('profile open control icon was not styled at boot');
      }
      if (
        Number(metrics.firstLinkCount) !== 1
        || Number(metrics.firstInnerDomCount) !== 2
        || metrics.firstPanelVisible !== true
        || metrics.firstFullStyleReady !== true
        || metrics.firstCascadeOrderPreserved !== true
        || Number(metrics.profileResponseCountAfterOpen) !== 1
        || profileResources.length !== 1
      ) {
        reasons.push('profile first open did not settle to one visible DOM/style surface in canonical cascade order');
      }
      if (
        !Number.isFinite(Number(metrics.firstOpenLatencyMs))
        || Number(metrics.firstOpenLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
        || !Number.isFinite(Number(metrics.firstStyleReadyLatencyMs))
        || Number(metrics.firstStyleReadyLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
      ) {
        reasons.push(
          `profile first-open/style latency was ${String(metrics.firstOpenLatencyMs)}/${String(metrics.firstStyleReadyLatencyMs)}ms`
        );
      }
      if (
        metrics.savedNameProjected !== true
        || metrics.savedBioProjected !== true
        || metrics.savedAvatarProjected !== true
        || metrics.savedIdentityProjected !== true
        || metrics.avatarResourceCoverage !== true
      ) {
        reasons.push('profile saved model was not projected after lazy DOM creation');
      }
      if (
        metrics.secretInitiallyHidden !== true
        || metrics.secretRevealWorked !== true
      ) {
        reasons.push('profile recovery secret visibility behavior changed');
      }
      if (
        metrics.initialFocusCorrect !== true
        || metrics.focusTrapStartReady !== true
        || metrics.focusTrapWorked !== true
        || metrics.escapeClosed !== true
        || metrics.escapeFocusReturned !== true
        || metrics.backdropClosed !== true
        || metrics.backdropFocusReturned !== true
      ) {
        reasons.push('profile focus trap, Escape, backdrop, or focus return behavior failed');
      }
      if (
        metrics.reopenSameInnerNode !== true
        || Number(metrics.reopenLinkCount) !== 1
        || Number(metrics.reopenInnerDomCount) !== 2
        || Number(metrics.diagnosticsAttemptCount) !== 1
        || Number(metrics.diagnosticsDomCreatedCount) !== 1
        || Number(metrics.diagnosticsReadyCount) !== 1
        || Number(metrics.diagnosticsFailureCount) !== 0
        || Number(metrics.diagnosticsListenerBindingCount) <= 0
      ) {
        reasons.push('profile reopen regenerated DOM/style or rebound the prepared surface');
      }
      if (
        metrics.failureVisible !== true
        || metrics.failureFocused !== true
        || metrics.failureRetryGuidance !== true
        || Number(metrics.failureInnerDomCount) !== 0
        || Number(metrics.failureLinkCount) !== 0
      ) {
        reasons.push('profile stylesheet failure was not closable or did not clean partial DOM/style');
      }
      if (
        Number(metrics.failureRequestCount) !== 2
        || Number(metrics.failureRequestFailureCount) !== 1
        || Number(metrics.failureResponseCount) !== 1
        || Number(metrics.failureConsoleErrorCount) !== 1
        || Number(metrics.failureConsoleWarningCount) !== 1
      ) {
        reasons.push('profile stylesheet injected failure evidence was not exact');
      }
      if (
        metrics.failureRetryReady !== true
        || Number(metrics.failureRetryLinkCount) !== 1
        || Number(metrics.failureRetryInnerDomCount) !== 2
        || Number(metrics.failureRetryAttemptCount) !== 2
        || Number(metrics.failureRetryFailureCount) !== 1
        || Number(metrics.failureRetryCount) !== 1
      ) {
        reasons.push('profile stylesheet retry did not recover with one retained surface');
      }
      if (
        typeof metrics.clsDelta !== 'number'
        || !Number.isFinite(metrics.clsDelta)
        || metrics.clsDelta > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.cls
      ) {
        reasons.push(`profile first-open CLS was ${String(metrics.clsDelta)}`);
      }
      if (
        metrics.firstOpenLongTaskSupported !== true
        || Number(metrics.firstOpenLongTaskCount) !== 0
      ) {
        reasons.push(
          `profile first-open long tasks were ${String(metrics.firstOpenLongTaskCount)}`
        );
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'feature.rules-help') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const rulesHelpResources = resources.filter(
        (resource: any) => [
          'styles-feature-rules-help-layout-info.css',
          'styles-feature-rules-help-cards.css',
          'styles-feature-rules-help-responsive.css'
        ].includes(String(resource?.path || ''))
      );
      if (metrics.backend !== 'pixi') {
        reasons.push(`rules help scenario backend was ${String(metrics.backend || 'missing')}`);
      }
      if (metrics.uiInitialized !== true) {
        reasons.push('rules help listener initialization did not complete');
      }
      if (
        Number(metrics.rulesHelpStylesheetLinkCountBeforeOpen) !== 0
        || Number(metrics.rulesHelpResponseCountBeforeOpen) !== 0
        || Number(metrics.rulesHelpResourceCountBeforeOpen) !== 0
        || Number(metrics.rulesHelpInnerDomCountBeforeOpen) !== 0
        || Number(metrics.rulesHelpImageElementCountBeforeOpen) !== 0
      ) {
        reasons.push('rules help CSS, response, inner DOM, or images existed before first open');
      }
      if (Number(metrics.rulesHelpStylesheetSlotCount) !== 3) {
        reasons.push(
          `rules help stylesheet slot count was ${String(metrics.rulesHelpStylesheetSlotCount)}`
        );
      }
      if (metrics.rulesHelpOpenIconReady !== true) {
        reasons.push('rules help open control icon was not styled at boot');
      }
      if (
        Number(metrics.firstLinkCount) !== 3
        || Number(metrics.firstInnerDomCount) !== 3
        || metrics.firstPanelVisible !== true
        || metrics.firstFullStyleReady !== true
        || metrics.firstCascadeOrderPreserved !== true
        || Number(metrics.rulesHelpResponseCountAfterOpen) !== 3
        || rulesHelpResources.length !== 3
      ) {
        reasons.push(
          'rules help first open did not settle to three visible DOM/style fragments in canonical cascade order'
        );
      }
      if (
        !Number.isFinite(Number(metrics.firstOpenLatencyMs))
        || Number(metrics.firstOpenLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
        || !Number.isFinite(Number(metrics.firstStyleReadyLatencyMs))
        || Number(metrics.firstStyleReadyLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
      ) {
        reasons.push(
          `rules help first-open/style latency was ${String(metrics.firstOpenLatencyMs)}/${String(metrics.firstStyleReadyLatencyMs)}ms`
        );
      }
      if (
        Number(metrics.firstCardCount) <= 0
        || metrics.firstGuideComplete !== true
        || metrics.firstProtectionComplete !== true
        || metrics.initialOpenControlFocused !== true
      ) {
        reasons.push('rules help initial catalog, images, or focus was incomplete');
      }
      if (
        metrics.searchNoMatchWorked !== true
        || metrics.searchStatusUpdated !== true
        || metrics.searchClearWorked !== true
        || metrics.tagFilterWorked !== true
        || metrics.effectsTabWorked !== true
        || metrics.guideNextWorked !== true
        || metrics.protectionNextWorked !== true
        || metrics.countersTabWorked !== true
      ) {
        reasons.push('rules help search, filter, tab, or slide interaction changed');
      }
      if (
        metrics.focusWithinPanel !== true
        || metrics.escapeClosed !== true
        || metrics.escapeFocusReturned !== true
        || metrics.backdropClosed !== true
        || metrics.backdropFocusReturned !== true
      ) {
        reasons.push('rules help focus, Escape, backdrop, or focus return behavior failed');
      }
      if (
        metrics.reopenSameInnerNode !== true
        || Number(metrics.reopenLinkCount) !== 3
        || Number(metrics.reopenInnerDomCount) !== 3
        || Number(metrics.diagnosticsAttemptCount) !== 1
        || Number(metrics.diagnosticsDomCreatedCount) !== 1
        || Number(metrics.diagnosticsReadyCount) !== 1
        || Number(metrics.diagnosticsFailureCount) !== 0
        || Number(metrics.diagnosticsListenerBindingCount) <= 0
      ) {
        reasons.push('rules help reopen regenerated DOM/style or rebound the prepared surface');
      }
      if (
        metrics.failureVisible !== true
        || metrics.failureFocused !== true
        || metrics.failureDialogStable !== true
        || metrics.failureRetryGuidance !== true
        || Number(metrics.failureNormalInnerDomCount) !== 0
        || Number(metrics.failureLinkCount) !== 0
      ) {
        reasons.push('rules help stylesheet failure was not closable or did not clean partial DOM/style');
      }
      if (
        Number(metrics.failureRequestCount) !== 2
        || Number(metrics.failureRequestFailureCount) !== 1
        || Number(metrics.failureResponseCount) !== 1
        || Number(metrics.failureConsoleErrorCount) !== 1
        || Number(metrics.failureConsoleWarningCount) !== 1
      ) {
        reasons.push('rules help stylesheet injected failure evidence was not exact');
      }
      if (
        metrics.failureRetryReady !== true
        || Number(metrics.failureRetryLinkCount) !== 3
        || Number(metrics.failureRetryInnerDomCount) !== 3
        || Number(metrics.failureRetryAttemptCount) !== 2
        || Number(metrics.failureRetryFailureCount) !== 1
        || Number(metrics.failureRetryCount) !== 1
      ) {
        reasons.push('rules help stylesheet retry did not recover with one retained surface');
      }
      if (
        metrics.firstOpenLongTaskSupported !== true
        || Number(metrics.firstOpenLongTaskCount) !== 0
      ) {
        reasons.push(
          `rules help first-open long tasks were ${String(metrics.firstOpenLongTaskCount)}`
        );
      }
      if (
        typeof metrics.clsDelta !== 'number'
        || !Number.isFinite(metrics.clsDelta)
        || metrics.clsDelta > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.cls
      ) {
        reasons.push(`rules help first-open CLS was ${String(metrics.clsDelta)}`);
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'feature.deck-builder') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const deckBuilderResources = resources.filter(
        (resource: any) => [
          'styles-feature-deck-builder.css',
          'styles-feature-deck-builder-responsive.css'
        ].includes(String(resource?.path || ''))
      );
      if (metrics.backend !== 'pixi') {
        reasons.push(`deck builder scenario backend was ${String(metrics.backend || 'missing')}`);
      }
      if (metrics.uiInitialized !== true) {
        reasons.push('deck builder listener initialization did not complete');
      }
      if (
        Number(metrics.deckBuilderStylesheetLinkCountBeforeOpen) !== 0
        || Number(metrics.deckBuilderResponseCountBeforeOpen) !== 0
        || Number(metrics.deckBuilderResourceCountBeforeOpen) !== 0
        || Number(metrics.deckBuilderInnerDomCountBeforeOpen) !== 0
        || Number(metrics.deckBuilderCardCountBeforeOpen) !== 0
      ) {
        reasons.push('deck builder CSS, response, inner DOM, or cards existed before first open');
      }
      if (Number(metrics.deckBuilderStylesheetSlotCount) !== 2) {
        reasons.push(
          `deck builder stylesheet slot count was ${String(metrics.deckBuilderStylesheetSlotCount)}`
        );
      }
      if (metrics.deckBuilderOpenIconReady !== true) {
        reasons.push('deck builder open control icon was not styled at boot');
      }
      if (metrics.deckModelAvailableBeforeOpen !== true) {
        reasons.push('deck builder model/network API was unavailable before first open');
      }
      if (
        Number(metrics.firstLinkCount) !== 2
        || Number(metrics.firstInnerDomCount) !== 2
        || Number(metrics.firstPresetCardCount) <= 0
        || metrics.firstPanelVisible !== true
        || metrics.firstFullStyleReady !== true
        || metrics.firstCascadeOrderPreserved !== true
        || metrics.firstComputedStylePreserved !== true
        || Number(metrics.deckBuilderResponseCountAfterOpen) !== 2
        || deckBuilderResources.length !== 2
      ) {
        reasons.push(
          'deck builder first open did not settle to two visible DOM/style fragments with preserved cascade and computed style'
        );
      }
      if (
        !Number.isFinite(Number(metrics.firstOpenLatencyMs))
        || Number(metrics.firstOpenLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
        || !Number.isFinite(Number(metrics.firstStyleReadyLatencyMs))
        || Number(metrics.firstStyleReadyLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
      ) {
        reasons.push(
          `deck builder first-open/style latency was ${String(metrics.firstOpenLatencyMs)}/${String(metrics.firstStyleReadyLatencyMs)}ms`
        );
      }
      if (
        metrics.initialOpenControlFocused !== true
        || metrics.presetViewWorked !== true
        || metrics.editorViewWorked !== true
        || metrics.scrollPreserved !== true
        || metrics.randomDeckWorked !== true
        || metrics.detailWorked !== true
        || metrics.saveWorked !== true
        || metrics.networkDeckUpdateWorked !== true
      ) {
        reasons.push('deck builder preset, editor, scroll, card, save, or network behavior changed');
      }
      if (
        metrics.escapeClosed !== true
        || metrics.escapeFocusReturned !== true
        || metrics.backdropClosed !== true
        || metrics.backdropFocusReturned !== true
      ) {
        reasons.push('deck builder Escape, backdrop, or focus return behavior failed');
      }
      if (
        metrics.reopenSameInnerNode !== true
        || Number(metrics.reopenLinkCount) !== 2
        || Number(metrics.reopenInnerDomCount) !== 2
        || Number(metrics.diagnosticsAttemptCount) !== 1
        || Number(metrics.diagnosticsDomCreatedCount) !== 2
        || Number(metrics.diagnosticsReadyCount) !== 1
        || Number(metrics.diagnosticsFailureCount) !== 0
        || Number(metrics.diagnosticsListenerBindingCount) <= 0
      ) {
        reasons.push('deck builder reopen regenerated DOM/style or rebound the prepared surface');
      }
      if (
        metrics.failureVisible !== true
        || metrics.failureFocused !== true
        || metrics.failureDialogStable !== true
        || metrics.failureRetryGuidance !== true
        || Number(metrics.failureNormalInnerDomCount) !== 0
        || Number(metrics.failureLinkCount) !== 0
      ) {
        reasons.push('deck builder stylesheet failure was not closable or did not clean partial DOM/style');
      }
      if (
        Number(metrics.failureRequestCount) !== 2
        || Number(metrics.failureRequestFailureCount) !== 1
        || Number(metrics.failureResponseCount) !== 1
        || Number(metrics.failureConsoleErrorCount) !== 1
        || Number(metrics.failureConsoleWarningCount) !== 1
      ) {
        reasons.push('deck builder stylesheet injected failure evidence was not exact');
      }
      if (
        metrics.failureRetryReady !== true
        || Number(metrics.failureRetryLinkCount) !== 2
        || Number(metrics.failureRetryInnerDomCount) !== 2
        || Number(metrics.failureRetryAttemptCount) !== 2
        || Number(metrics.failureRetryFailureCount) !== 1
        || Number(metrics.failureRetryCount) !== 1
      ) {
        reasons.push('deck builder stylesheet retry did not recover with one retained surface');
      }
      if (
        metrics.firstOpenLongTaskSupported !== true
        || Number(metrics.firstOpenLongTaskCount) !== 0
      ) {
        reasons.push(
          `deck builder first-open long tasks were ${String(metrics.firstOpenLongTaskCount)}`
        );
      }
      if (
        typeof metrics.clsDelta !== 'number'
        || !Number.isFinite(metrics.clsDelta)
        || metrics.clsDelta > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.cls
      ) {
        reasons.push(`deck builder first-open CLS was ${String(metrics.clsDelta)}`);
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'feature.network') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const networkResources = resources.filter(
        (resource: any) => [
          'styles-feature-network-layout-controls.css',
          'styles-feature-network.css',
          'styles-feature-network-responsive.css'
        ].includes(String(resource?.path || ''))
      );
      if (metrics.backend !== 'pixi') {
        reasons.push(`network scenario backend was ${String(metrics.backend || 'missing')}`);
      }
      if (metrics.uiInitialized !== true) {
        reasons.push('network listener initialization did not complete');
      }
      if (
        Number(metrics.networkStylesheetLinkCountBeforeOpen) !== 0
        || Number(metrics.networkResponseCountBeforeOpen) !== 0
        || Number(metrics.networkResourceCountBeforeOpen) !== 0
        || Number(metrics.networkInnerDomCountBeforeOpen) !== 0
      ) {
        reasons.push('network CSS, response, or inner DOM existed before first selection');
      }
      if (Number(metrics.networkStylesheetSlotCount) !== 3) {
        reasons.push(
          `network stylesheet slot count was ${String(metrics.networkStylesheetSlotCount)}`
        );
      }
      if (metrics.networkPublicPresenceApiAvailable !== true) {
        reasons.push('network stored-session boolean API was unavailable at boot');
      }
      if (
        Number(metrics.firstLinkCount) !== 3
        || Number(metrics.firstInnerDomCount) !== 4
        || metrics.firstPanelVisible !== true
        || metrics.firstFullStyleReady !== true
        || metrics.firstCascadeOrderPreserved !== true
        || metrics.firstComputedStylePreserved !== true
        || Number(metrics.networkResponseCountAfterOpen) !== 3
        || networkResources.length !== 3
      ) {
        reasons.push(
          'network first selection did not settle to four inner roots and three preserved CSS fragments'
        );
      }
      if (
        !Number.isFinite(Number(metrics.firstOpenLatencyMs))
        || Number(metrics.firstOpenLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
        || !Number.isFinite(Number(metrics.firstStyleReadyLatencyMs))
        || Number(metrics.firstStyleReadyLatencyMs)
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
      ) {
        reasons.push(
          `network first-open/style latency was ${String(metrics.firstOpenLatencyMs)}/${String(metrics.firstStyleReadyLatencyMs)}ms`
        );
      }
      if (
        metrics.savedProfileProjected !== true
        || metrics.currentModeProjected !== true
        || metrics.clientStateProjected !== true
        || metrics.networkProcessingAfterSurfaceReady !== true
        || metrics.initialFocusCorrect !== true
      ) {
        reasons.push('network profile, mode, client state, readiness order, or focus was not reprojected');
      }
      if (
        metrics.roomSettingsPopupWorked !== true
        || metrics.clipboardWorked !== true
        || metrics.chatPanelWorked !== true
        || metrics.chatSendWorked !== true
        || metrics.leaveWorked !== true
      ) {
        reasons.push('network popup, clipboard, chat, send, or leave behavior changed');
      }
      if (
        metrics.escapeClosed !== true
        || metrics.escapeFocusReturned !== true
        || metrics.backdropClosed !== true
        || metrics.backdropFocusReturned !== true
      ) {
        reasons.push('network Escape, backdrop, or focus return behavior failed');
      }
      if (
        metrics.reopenSameInnerNode !== true
        || Number(metrics.reopenLinkCount) !== 3
        || Number(metrics.reopenInnerDomCount) !== 4
        || Number(metrics.diagnosticsAttemptCount) !== 1
        || Number(metrics.diagnosticsDomCreatedCount) !== 4
        || Number(metrics.diagnosticsReadyCount) !== 1
        || Number(metrics.diagnosticsFailureCount) !== 0
        || Number(metrics.diagnosticsListenerBindingCount) !== 1
      ) {
        reasons.push('network reopen regenerated DOM/style or rebound the prepared surface');
      }
      if (
        metrics.failureVisible !== true
        || metrics.failureFocused !== true
        || metrics.failureDialogStable !== true
        || metrics.failureRetryGuidance !== true
        || metrics.failureModeStayedCpu !== true
        || Number(metrics.failureNetworkProcessingCount) !== 0
        || Number(metrics.failureNormalInnerDomCount) !== 0
        || Number(metrics.failureLinkCount) !== 0
      ) {
        reasons.push('network stylesheet failure did not block mode processing or clean partial DOM/style');
      }
      if (
        Number(metrics.failureRequestCount) !== 2
        || Number(metrics.failureRequestFailureCount) !== 1
        || Number(metrics.failureResponseCount) !== 1
        || Number(metrics.failureConsoleErrorCount) !== 1
        || Number(metrics.failureConsoleWarningCount) !== 1
      ) {
        reasons.push('network stylesheet injected failure evidence was not exact');
      }
      if (
        metrics.failureRetryReady !== true
        || Number(metrics.failureRetryLinkCount) !== 3
        || Number(metrics.failureRetryInnerDomCount) !== 4
        || Number(metrics.failureRetryAttemptCount) !== 2
        || Number(metrics.failureRetryFailureCount) !== 1
        || Number(metrics.failureRetryCount) !== 1
      ) {
        reasons.push('network stylesheet retry did not recover with one retained surface');
      }
      if (
        metrics.firstOpenLongTaskSupported !== true
        || Number(metrics.firstOpenLongTaskCount) !== 0
      ) {
        reasons.push(
          `network first-open long tasks were ${String(metrics.firstOpenLongTaskCount)}`
        );
      }
      if (
        typeof metrics.clsDelta !== 'number'
        || !Number.isFinite(metrics.clsDelta)
        || metrics.clsDelta > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.cls
      ) {
        reasons.push(`network first-open CLS was ${String(metrics.clsDelta)}`);
      }
      if (metrics.sensitiveFieldsAbsent !== true) {
        reasons.push('network feature capture did not attest to secret-free evidence');
      }
    }
    if (
      scenario.captureStatus === 'complete'
      && definition.id === 'feature.network-restore'
    ) {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const networkResources = resources.filter(
        (resource: any) => [
          'styles-feature-network-layout-controls.css',
          'styles-feature-network.css',
          'styles-feature-network-responsive.css'
        ].includes(String(resource?.path || ''))
      );
      if (metrics.backend !== 'pixi' || metrics.uiInitialized !== true) {
        reasons.push('network restore runtime did not initialize on the Pixi backend');
      }
      if (
        Number(metrics.noSessionRestoreInvocationCount) !== 0
        || Number(metrics.noSessionInnerDomCount) !== 0
        || Number(metrics.noSessionStylesheetLinkCount) !== 0
        || metrics.noSessionModeStayedCpu !== true
      ) {
        reasons.push('network restore without a saved session created a surface or invoked restore');
      }
      if (
        Number(metrics.successRestoreInvocationCount) !== 1
        || metrics.successSurfaceReadyBeforeRestore !== true
        || Number(metrics.successInnerDomCount) !== 4
        || Number(metrics.successStylesheetLinkCount) !== 3
        || metrics.successModeProjected !== true
        || metrics.successStatusProjected !== true
        || metrics.successProfileProjected !== true
        || metrics.successOverlayClosed !== true
      ) {
        reasons.push('network successful restore did not prepare and reproject the ready surface');
      }
      if (
        Number(metrics.invalidRestoreInvocationCount) !== 1
        || metrics.invalidSurfaceReadyBeforeRestore !== true
        || Number(metrics.invalidInnerDomCount) !== 4
        || Number(metrics.invalidStylesheetLinkCount) !== 3
        || metrics.invalidModeStayedCpu !== true
        || metrics.invalidStatusProjected !== true
      ) {
        reasons.push('network invalid-session restore did not report through the ready surface');
      }
      if (networkResources.length !== 3 || metrics.sensitiveFieldsAbsent !== true) {
        reasons.push('network restore resources or secret-free evidence were incomplete');
      }
    }
    if (
      scenario.captureStatus === 'complete'
      && ['help.before-idle', 'help.after-idle'].includes(definition.id)
    ) {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      if (metrics.backend !== 'pixi') {
        reasons.push(`help scenario backend was ${String(metrics.backend || 'missing')}`);
      }
      if (metrics.uiInitialized !== true) reasons.push('help listener initialization did not complete');
      if (
        Number(metrics.initialInnerDomCount) !== 0
        || Number(metrics.initialImageElementCount) !== 0
        || Number(metrics.initialStylesheetLinkCount) !== 0
      ) {
        reasons.push('rules help DOM, images, or stylesheet existed before open');
      }
      if (Number(metrics.stylesheetSlotCount) !== 3) {
        reasons.push(
          `rules help stylesheet slot count was ${String(metrics.stylesheetSlotCount)}`
        );
      }
      if (Number(metrics.initialSrcCount) !== 0) {
        reasons.push(`help images had ${String(metrics.initialSrcCount)} initial src attribute(s)`);
      }
      if (metrics.dimensionsReserved !== true) reasons.push('help image dimensions were not reserved');
      if (metrics.panelOpen !== true) reasons.push('rules help panel did not open');
      if (metrics.guideComplete !== true || metrics.protectionComplete !== true) {
        reasons.push('initial help images were not complete after open');
      }
      if (metrics.guideFrameVisible !== true || metrics.protectionFrameVisible !== true) {
        reasons.push('help image frame was not visibly reserved');
      }
      if (Number(metrics.guideDimensions?.width) !== 1920
          || Number(metrics.guideDimensions?.height) !== 1080) {
        reasons.push('guide image dimensions did not match the reserved 1920x1080 box');
      }
      if (Number(metrics.protectionDimensions?.width) !== 1600
          || Number(metrics.protectionDimensions?.height) !== 1080) {
        reasons.push('protection image dimensions did not match the reserved 1600x1080 box');
      }
      if (metrics.focusWithinPanel !== true) reasons.push('help focus did not remain within the panel');
      if (Number(metrics.helpRequestsBeforeFirstFrame) !== 0) {
        reasons.push(
          `help requests before first frame: ${String(metrics.helpRequestsBeforeFirstFrame)}`
        );
      }
      if (Number(metrics.helpResourcePathCount) !== 2) {
        reasons.push(`initial help resource path count was ${String(metrics.helpResourcePathCount)}`);
      }
      if (Number(metrics.helpEncodedBodyBytes) < 300_000) {
        reasons.push(`initial help encoded bytes were ${String(metrics.helpEncodedBodyBytes)}`);
      }
      if (
        typeof metrics.clsDelta !== 'number'
        || !Number.isFinite(metrics.clsDelta)
        || metrics.clsDelta > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.cls
      ) {
        reasons.push(`help first-open CLS was ${String(metrics.clsDelta)}`);
      }
      if (
        typeof metrics.firstOpenLatencyMs !== 'number'
        || !Number.isFinite(metrics.firstOpenLatencyMs)
        || metrics.firstOpenLatencyMs
          > UX_OPTIMIZATION_CAPTURE_POLICY.timingThresholds.featureReadyP95Ms
      ) {
        reasons.push(`help first-open latency was ${String(metrics.firstOpenLatencyMs)}ms`);
      }

      const beforeOpenPaths = Array.isArray(metrics.helpResponsePathsBeforeOpen)
        ? metrics.helpResponsePathsBeforeOpen
        : [];
      const afterOpenPaths = Array.isArray(metrics.helpResponsePathsAfterOpen)
        ? metrics.helpResponsePathsAfterOpen
        : [];
      if (afterOpenPaths.length !== 2) {
        reasons.push(`help response paths after open were ${afterOpenPaths.length}`);
      }
      if (definition.id === 'help.before-idle') {
        if (beforeOpenPaths.length !== 0 || Number(metrics.helpResourceEntriesBeforeOpen) !== 0) {
          reasons.push('immediate help open was preceded by help image loading');
        }
        if (Number(metrics.pendingIdleCallbackCount) <= 0) {
          reasons.push('immediate help open did not exercise a pending idle prefetch');
        }
      } else {
        if (beforeOpenPaths.length !== 2 || Number(metrics.helpResourceEntriesBeforeOpen) < 2) {
          reasons.push('idle help prefetch did not finish before open');
        }
        if (
          typeof metrics.boardIdleAtMs !== 'number'
          || !Number.isFinite(metrics.boardIdleAtMs)
          || typeof metrics.idlePrefetchAtMs !== 'number'
          || !Number.isFinite(metrics.idlePrefetchAtMs)
          || typeof metrics.earliestHelpResourceStartMs !== 'number'
          || !Number.isFinite(metrics.earliestHelpResourceStartMs)
          || metrics.idlePrefetchAtMs < metrics.boardIdleAtMs
          || metrics.earliestHelpResourceStartMs < metrics.idlePrefetchAtMs
        ) {
          reasons.push('help idle prefetch started before the board-idle boundary');
        }
        if (Number(metrics.additionalHelpTransferSizeAfterOpen) !== 0) {
          reasons.push(
            `idle-after open transferred ${String(metrics.additionalHelpTransferSizeAfterOpen)} extra bytes`
          );
        }
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'asset.webp-fallback') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      const admission = metrics.admission && typeof metrics.admission === 'object'
        ? metrics.admission
        : {};
      if (!/^[a-f0-9]{64}$/.test(String(admission.manifestSha256 || ''))) {
        reasons.push('optimized image manifest SHA-256 is missing');
      }
      if (Number(admission.schemaVersion) !== 1 || admission.codec !== 'webp-lossless') {
        reasons.push('optimized image manifest schema/codec is invalid');
      }
      if (admission.admissionStatus !== 'admitted') {
        reasons.push(`default frame admission was ${String(admission.admissionStatus || 'missing')}`);
      }
      if (admission.admittedMappingOutput !== DEFAULT_FRAME_WEBP_PATH) {
        reasons.push('default frame admitted mapping does not point to the WebP output');
      }
      if (admission.visiblePixelsEqual !== true) {
        reasons.push('default frame visible pixels are not equal');
      }
      if (
        Number(admission.minimumSavingsRatio) < 0.1
        || Number(admission.savingsRatio) < Number(admission.minimumSavingsRatio)
        || Number(admission.outputBytes) >= Number(admission.sourceBytes)
      ) {
        reasons.push('default frame encoded size does not meet the admission threshold');
      }
      if (
        !Number.isFinite(Number(admission.width))
        || Number(admission.width) <= 0
        || Number(admission.width) !== Number(admission.height)
      ) {
        reasons.push('default frame dimensions are invalid');
      }
      if (
        admission.sourceSha256 !== admission.actualSourceSha256
        || admission.outputSha256 !== admission.actualOutputSha256
        || !/^[a-f0-9]{64}$/.test(String(admission.sourceSha256 || ''))
        || !/^[a-f0-9]{64}$/.test(String(admission.outputSha256 || ''))
      ) {
        reasons.push('default frame manifest hashes do not match the delivered files');
      }
      const decode = admission.hardwareDecode && typeof admission.hardwareDecode === 'object'
        ? admission.hardwareDecode
        : {};
      const pngMedianMs = Number(decode.pngMedianMs);
      const webpMedianMs = Number(decode.webpMedianMs);
      const allowedDeltaMs = Math.max(2, pngMedianMs * 0.1);
      if (
        decode.verdict !== 'admitted'
        || decode.order !== 'alternating'
        || Number(decode.sampleCountPerFormat) < 5
        || !Number.isFinite(pngMedianMs)
        || !Number.isFinite(webpMedianMs)
        || webpMedianMs - pngMedianMs > allowedDeltaMs
        || Number(decode.allowedDeltaMs) !== allowedDeltaMs
      ) {
        reasons.push('default frame hardware decode evidence does not meet the admission threshold');
      }

      const validateVariant = (
        name: 'normal' | 'forcedPng' | 'forcedWebpFailure',
        expected: {
          webpRequests: number;
          pngRequests: number;
          webpResponses: number;
          pngResponses: number;
          failedWebpRequests: number;
          browserErrors: number;
          cssPath: string;
        }
      ): void => {
        const variant = metrics[name] && typeof metrics[name] === 'object'
          ? metrics[name]
          : {};
        if (variant.backend !== 'pixi' || variant.singleWriter !== true) {
          reasons.push(`${name} did not preserve one Pixi writer`);
        }
        if (
          variant.uiInitialized !== true
          || variant.visiblySized !== true
          || variant.rootSkinId !== 'marsh-forged-iron'
          || variant.elementSkinId !== 'marsh-forged-iron'
        ) {
          reasons.push(`${name} did not finish with the visible default frame`);
        }
        if (
          !String(variant.rootCssValue || '').includes(expected.cssPath)
          || !String(variant.elementCssValue || '').includes(expected.cssPath)
          || !String(variant.computedBackgroundImage || '').includes(expected.cssPath)
        ) {
          reasons.push(`${name} computed frame image did not use ${expected.cssPath}`);
        }
        if (!/^[a-f0-9]{64}$/.test(String(variant.visualScreenshotSha256 || ''))) {
          reasons.push(`${name} visual screenshot evidence is missing`);
        }
        if (
          Number(variant.frameWebpRequestCount) !== expected.webpRequests
          || Number(variant.framePngRequestCount) !== expected.pngRequests
          || Number(variant.frameWebpResponseCount) !== expected.webpResponses
          || Number(variant.framePngResponseCount) !== expected.pngResponses
          || Number(variant.failedWebpRequestCount) !== expected.failedWebpRequests
        ) {
          reasons.push(`${name} logical frame request/fallback counts are invalid`);
        }
        if (Number(variant.browserErrorCount) !== expected.browserErrors) {
          reasons.push(
            `${name} browser error count was ${String(variant.browserErrorCount)}`
          );
        }
      };
      validateVariant('normal', {
        webpRequests: 1,
        pngRequests: 0,
        webpResponses: 1,
        pngResponses: 0,
        failedWebpRequests: 0,
        browserErrors: 0,
        cssPath: 'blob:'
      });
      validateVariant('forcedPng', {
        webpRequests: 0,
        pngRequests: 1,
        webpResponses: 0,
        pngResponses: 1,
        failedWebpRequests: 0,
        browserErrors: 0,
        cssPath: DEFAULT_FRAME_PNG_PATH
      });
      validateVariant('forcedWebpFailure', {
        webpRequests: 1,
        pngRequests: 1,
        webpResponses: 0,
        pngResponses: 1,
        failedWebpRequests: 1,
        browserErrors: 1,
        cssPath: DEFAULT_FRAME_PNG_PATH
      });
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'board.first-special') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      if (metrics.backend !== 'pixi') reasons.push(`first-special backend was ${String(metrics.backend || 'missing')}`);
      if (metrics.singleWriter !== true) reasons.push('first-special did not preserve one Pixi writer');
      if (metrics.accepted !== true) reasons.push('first-special frame was not accepted');
      if (metrics.framePreparedBeforeSettlement !== true) {
        reasons.push('first-special texture/frame preparation was not observed before settlement');
      }
      if (metrics.settledSpecialFrame !== true) reasons.push('first-special frame did not settle');
      const neededIds = Array.isArray(metrics.neededSpecialAssetIds)
        ? metrics.neededSpecialAssetIds.map(String)
        : [];
      if (JSON.stringify(neededIds) !== JSON.stringify(['TIME_BOMB'])) {
        reasons.push(`first-special logical asset ids were ${JSON.stringify(neededIds)}`);
      }
      if (Number(metrics.specialResponseCount) !== 1) {
        reasons.push(`first-special response count was ${String(metrics.specialResponseCount)}`);
      }
    }
    if (
      scenario.captureStatus === 'complete'
      && [
        'fallback.explicit-dom',
        'fallback.pixi-init-failure',
        'fallback.context-loss'
      ].includes(definition.id)
    ) {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      if (metrics.backend !== 'dom') {
        reasons.push(`DOM fallback backend was ${String(metrics.backend || 'missing')}`);
      }
      if (metrics.singleWriter !== true) {
        reasons.push('DOM fallback did not preserve one visual writer');
      }
      if (metrics.fallbackStyled !== true) {
        reasons.push('DOM fallback computed style was not ready');
      }
      if (Number(metrics.domCompatStylesheetResponseCount) !== 1) {
        reasons.push(
          `DOM compatibility CSS response count was ${String(metrics.domCompatStylesheetResponseCount)}`
        );
      }
      if (Number(metrics.domCompatStylesheetLinkCount) !== 1) {
        reasons.push(
          `DOM compatibility stylesheet link count was ${String(metrics.domCompatStylesheetLinkCount)}`
        );
      }
      if (metrics.domCompatStylesheetLoaded !== true) {
        reasons.push('DOM compatibility stylesheet did not report load success');
      }
      if (metrics.domCompatStylesheetAtSlot !== true) {
        reasons.push('DOM compatibility stylesheet was not inserted at its fixed cascade slot');
      }
      const stylesheetReadyAt = Number(metrics.domCompatStylesheetReadyAt);
      const backendMountedAt = Number(metrics.domBackendMountedAt);
      if (
        !Number.isFinite(stylesheetReadyAt)
        || !Number.isFinite(backendMountedAt)
        || stylesheetReadyAt > backendMountedAt
      ) {
        reasons.push(
          `DOM compatibility stylesheet/backend order was ${String(stylesheetReadyAt)} > ${String(backendMountedAt)}`
        );
      }
      if (definition.id === 'fallback.explicit-dom') {
        if (metrics.stylesheetFailurePreventedMount !== true) {
          reasons.push('failed DOM compatibility CSS still allowed backend mount');
        }
        if (metrics.stylesheetFailureSurfaced !== true) {
          reasons.push('DOM compatibility CSS failure was not surfaced');
        }
        if (metrics.stylesheetFailureUiInitialized === true) {
          reasons.push('DOM compatibility CSS failure produced a success-shaped UI initialization');
        }
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'board.lock-toggle') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      if (metrics.backend !== 'pixi') reasons.push(`lock-toggle backend was ${String(metrics.backend || 'missing')}`);
      if (metrics.lockAccepted !== true || metrics.unlockAccepted !== true) {
        reasons.push('lock-toggle frames did not both settle');
      }
      for (const phase of ['lockDelta', 'unlockDelta']) {
        const delta = metrics[phase] && typeof metrics[phase] === 'object' ? metrics[phase] : {};
        if (Number(delta.updatedCellViews) !== 0) {
          reasons.push(`${phase} updated cell views: ${String(delta.updatedCellViews)}`);
        }
        if (Number(delta.updatedStoneViews) !== 0) {
          reasons.push(`${phase} updated stone views: ${String(delta.updatedStoneViews)}`);
        }
        if (Number(delta.hintPaintCount) !== 0) {
          reasons.push(`${phase} painted hint Graphics: ${String(delta.hintPaintCount)}`);
        }
        if (Number(delta.hintInputSyncCount) <= 0) {
          reasons.push(`${phase} did not record the lightweight input sync`);
        }
      }
      if (Number(metrics.lockedCommandCount) !== 0) {
        reasons.push(`locked command count was ${String(metrics.lockedCommandCount)}`);
      }
      if (Number(metrics.unlockCommandCount) !== 1) {
        reasons.push(`unlock command count was ${String(metrics.unlockCommandCount)}`);
      }
      if (Number(metrics.staleInputStateCount) !== 0) {
        reasons.push(`stale input state count was ${String(metrics.staleInputStateCount)}`);
      }
    }
    if (scenario.captureStatus === 'complete' && definition.id === 'playback.opponent-actions') {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      if (metrics.backend !== 'pixi') reasons.push(`opponent-turn backend was ${String(metrics.backend || 'missing')}`);
      if (metrics.settledOpponentTurn !== true) reasons.push('opponent turn did not settle');
      if (metrics.longTaskSupported !== true) reasons.push('Long Task observation was unavailable');
      if (Number(metrics.longTaskCount) !== 0) {
        reasons.push(`opponent-turn Long Task count was ${String(metrics.longTaskCount)}`);
      }
      if (Number(metrics.rafSampleCount) <= 0) reasons.push('opponent-turn RAF samples are missing');
      if (Number(metrics.rafStall50msCount) !== 0) {
        reasons.push(`opponent-turn 50ms RAF stall count was ${String(metrics.rafStall50msCount)}`);
      }
      if (metrics.tickerIdle !== true) reasons.push('Pixi ticker did not return to idle');
    }
    if (
      scenario.captureStatus === 'complete'
      && [
        'fallback.explicit-dom',
        'fallback.pixi-init-failure',
        'fallback.context-loss'
      ].includes(definition.id)
    ) {
      const metrics = scenario.metrics && typeof scenario.metrics === 'object'
        ? scenario.metrics
        : {};
      if (metrics.backend !== 'dom') reasons.push(`fallback backend was ${String(metrics.backend || 'missing')}`);
      if (metrics.singleWriter !== true) reasons.push('fallback did not preserve one DOM writer');
      if (metrics.fallbackStyled !== true) reasons.push('fallback computed styles were not ready');
      if (Number(metrics.specialResponseCount) <= 0) {
        reasons.push('fallback did not complete DOM special-stone preparation');
      }
      if (definition.id === 'fallback.context-loss' && metrics.lossPrevented !== true) {
        reasons.push('context-loss fallback did not prevent the WebGL loss event');
      }
    }
    addCheck(`scenario.${definition.key}`, reasons.length === 0, reasons);
  }

  const pending = Array.isArray(report.pendingOptimizationIds)
    ? Array.from(new Set(report.pendingOptimizationIds.map((entry: unknown) => String(entry))))
    : [];
  const unknownPending = pending.filter(
    (id: string) => !(UX_OPTIMIZATION_IDS as readonly string[]).includes(id)
  );
  const pendingReasons = [
    ...unknownPending.map((id: string) => `unknown pending optimization: ${id}`),
    ...pending.map((id: string) => `pending optimization: ${id}`)
  ];
  addCheck('report.pending-optimizations', pendingReasons.length === 0, pendingReasons, {
    pendingOptimizationIds: pending
  });

  const targetOptimizationIds = Array.from(new Set(
    (options.targetOptimizationIds || []).map(String).filter(Boolean)
  )).sort();
  const unknownTargets = targetOptimizationIds.filter(
    (id) => !(UX_OPTIMIZATION_IDS as readonly string[]).includes(id)
  );
  const targetReasons = unknownTargets.map((id) => `unknown target optimization: ${id}`);
  for (const target of targetOptimizationIds) {
    if (pending.includes(target)) {
      targetReasons.push(`target optimization remains pending: ${target}`);
    }
    const requiredScenarioIds = UX_OPTIMIZATION_SCENARIOS
      .filter((definition) => definition.optimizationIds.includes(target))
      .map((definition) => definition.id);
    const requiredChecks = checks.filter((check) => {
      if (!check.id.startsWith('scenario.')) return false;
      return requiredScenarioIds.some((scenarioId) => (
        check.id.startsWith(`scenario.${scenarioId}:`)
      ));
    });
    if (requiredChecks.length === 0) {
      targetReasons.push(`target optimization has no scenario checks: ${target}`);
    }
    for (const check of requiredChecks) {
      if (check.verdict !== 'pass') {
        targetReasons.push(`${target} requires ${check.id}`);
      }
    }
  }
  const focusedVerdict: UxOptimizationVerdict | null = targetOptimizationIds.length > 0
    ? (targetReasons.length === 0 ? 'pass' : 'fail')
    : null;
  if (targetOptimizationIds.length > 0) {
    checks.push(Object.freeze({
      id: 'report.focused-targets',
      verdict: focusedVerdict as UxOptimizationVerdict,
      blocking: true,
      reasons: Object.freeze(targetReasons),
      evidence: Object.freeze({ targetOptimizationIds })
    }));
  }

  const nonPendingFailures = checks.filter((check) => (
    check.verdict !== 'pass'
      && check.id !== 'report.pending-optimizations'
      && !(
        check.id.startsWith('scenario.')
        && check.reasons.length === 1
        && check.reasons[0] === 'captureStatus is pending-optimization'
      )
  ));
  const baselineValid = report.profile === 'baseline'
    && pending.length === UX_OPTIMIZATION_IDS.length
    && unknownPending.length === 0
    && nonPendingFailures.length === 0;
  const developmentValid = ['baseline', 'quick'].includes(String(report.profile))
    && unknownPending.length === 0
    && unknownTargets.length === 0
    && nonPendingFailures.length === 0;
  const candidateEligible = identity.dirty === false
    && report.profile === 'standard'
    && checks.every((check) => check.verdict === 'pass');
  const overallPass = checks.every((check) => check.verdict === 'pass');
  return Object.freeze({
    schemaVersion: UX_OPTIMIZATION_VALIDATION_SCHEMA_VERSION,
    reportSchemaVersion: typeof report.schemaVersion === 'string' ? report.schemaVersion : null,
    overallVerdict: overallPass ? 'pass' : 'fail',
    baselineValid,
    developmentValid,
    focusedVerdict,
    targetOptimizationIds: Object.freeze(targetOptimizationIds),
    candidateEligible,
    pendingOptimizationIds: Object.freeze(pending.sort()),
    checks: Object.freeze(checks)
  });
}

interface CliOptions {
  readonly inputPath: string;
  readonly outputPath: string | null;
  readonly allowPending: boolean;
  readonly targetOptimizationIds: readonly string[];
}

export function parseValidationArgs(argv: readonly string[]): CliOptions {
  let inputPath = 'artifacts/ux-optimization-monitor/latest.json';
  let outputPath: string | null = null;
  let allowPending = false;
  const targetOptimizationIds: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') inputPath = String(argv[++index] || '');
    else if (arg === '--output') outputPath = String(argv[++index] || '');
    else if (arg === '--allow-pending') allowPending = true;
    else if (arg === '--target') {
      const values = String(argv[++index] || '').split(',').map((entry) => entry.trim()).filter(Boolean);
      if (values.length === 0) throw new Error('--target requires an optimization id');
      targetOptimizationIds.push(...values);
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!inputPath) throw new Error('--input requires a path');
  return {
    inputPath,
    outputPath,
    allowPending,
    targetOptimizationIds: Object.freeze(targetOptimizationIds)
  };
}

export function runValidationCli(argv: readonly string[]): UxOptimizationValidationResult {
  const options = parseValidationArgs(argv);
  const inputPath = path.resolve(process.cwd(), options.inputPath);
  const report = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const validation = validateUxOptimizationReport(report, {
    targetOptimizationIds: options.targetOptimizationIds
  });
  if (options.outputPath) {
    const outputPath = path.resolve(process.cwd(), options.outputPath);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(validation, null, 2)}\n`, 'utf8');
  }
  process.stdout.write(`${JSON.stringify(validation, null, 2)}\n`);
  return validation;
}

if (require.main === module) {
  try {
    const cliOptions = parseValidationArgs(process.argv.slice(2));
    const validation = runValidationCli(process.argv.slice(2));
    const focusedSuccess = validation.focusedVerdict === 'pass';
    const pendingSuccess = cliOptions.allowPending && validation.developmentValid;
    if (validation.overallVerdict !== 'pass' && !focusedSuccess && !pendingSuccess) {
      process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : error}\n`);
    process.exitCode = 1;
  }
}
