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
      if (metrics.initialHelpImageDimensionsReserved !== true) {
        reasons.push('initial help image dimensions were not reserved');
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
