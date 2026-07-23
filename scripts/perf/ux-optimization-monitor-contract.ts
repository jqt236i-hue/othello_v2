import * as crypto from 'crypto';

export const UX_OPTIMIZATION_REPORT_SCHEMA_VERSION =
  'ux_preserving_runtime_optimization_report.v1';
export const UX_OPTIMIZATION_VALIDATION_SCHEMA_VERSION =
  'ux_preserving_runtime_optimization_validation.v1';

export const UX_OPTIMIZATION_PHASES = Object.freeze([
  'navigation',
  'styles-ready',
  'backend-selected',
  'first-frame-preparing',
  'first-frame-committed',
  'board-idle',
  'idle-prefetch',
  'feature-opening',
  'feature-ready',
  'playback',
  'fallback-transition'
] as const);

export type UxOptimizationPhase = typeof UX_OPTIMIZATION_PHASES[number];
export type UxOptimizationVerdict = 'pass' | 'fail' | 'unsupported' | 'not-applicable';
export type UxOptimizationProfile = 'baseline' | 'quick' | 'standard' | 'ci';
export type UxOptimizationLane = 'vite' | 'classic';
export type UxOptimizationBackend = 'pixi' | 'dom' | 'none';
export type UxOptimizationCacheProfile = 'cold' | 'warm' | 'not-applicable';

export interface UxOptimizationScenarioDefinition {
  readonly id: string;
  readonly blocking: boolean;
  readonly optimizationIds: readonly string[];
  readonly requiredCaptures: readonly UxOptimizationScenarioCaptureDefinition[];
}

export interface UxOptimizationScenarioCaptureDefinition {
  readonly key: string;
  readonly id: string;
  readonly lane: UxOptimizationLane;
  readonly backend: UxOptimizationBackend;
  readonly cacheProfile: UxOptimizationCacheProfile;
}

export const UX_OPTIMIZATION_IDS = Object.freeze([
  'special-stone-demand-loading',
  'lock-only-hint-paint',
  'logical-image-deduplication',
  'help-image-lazy-loading',
  'dom-compat-stylesheet-lazy-loading',
  'lossless-webp-admission',
  'feature-result',
  'feature-profile',
  'feature-rules-help',
  'feature-deck-builder',
  'feature-network'
] as const);

export type UxOptimizationId = typeof UX_OPTIMIZATION_IDS[number];

export const UX_OPTIMIZATION_SCENARIOS: readonly UxOptimizationScenarioDefinition[] =
  Object.freeze([
    scenario('boot.pixi.cold', variants(['vite'], 'pixi', 'cold'), [
      'special-stone-demand-loading',
      'logical-image-deduplication',
      'help-image-lazy-loading',
      'dom-compat-stylesheet-lazy-loading',
      'feature-result',
      'feature-profile',
      'feature-rules-help',
      'feature-deck-builder',
      'feature-network'
    ]),
    scenario('boot.pixi.warm', variants(['vite'], 'pixi', 'warm'), [
      'logical-image-deduplication'
    ]),
    scenario('boot.classic-pixi.cold', variants(['classic'], 'pixi', 'cold'), [
      'special-stone-demand-loading',
      'logical-image-deduplication',
      'help-image-lazy-loading',
      'dom-compat-stylesheet-lazy-loading'
    ]),
    scenario('board.lock-toggle', variants(['vite'], 'pixi', 'not-applicable'), [
      'lock-only-hint-paint'
    ]),
    scenario('board.first-special', variants(['vite', 'classic'], 'pixi', 'not-applicable'), [
      'special-stone-demand-loading'
    ]),
    scenario('fallback.explicit-dom', variants(['vite', 'classic'], 'dom', 'cold'), [
      'special-stone-demand-loading',
      'dom-compat-stylesheet-lazy-loading'
    ]),
    scenario('fallback.pixi-init-failure', variants(['vite', 'classic'], 'dom', 'cold'), [
      'special-stone-demand-loading',
      'dom-compat-stylesheet-lazy-loading'
    ]),
    scenario('fallback.context-loss', variants(['vite', 'classic'], 'dom', 'not-applicable'), [
      'dom-compat-stylesheet-lazy-loading'
    ]),
    scenario('help.before-idle', variants(['vite', 'classic'], 'pixi', 'cold'), [
      'help-image-lazy-loading',
      'feature-rules-help'
    ]),
    scenario('help.after-idle', variants(['vite', 'classic'], 'pixi', 'warm'), [
      'help-image-lazy-loading',
      'feature-rules-help'
    ]),
    scenario('feature.result', variants(['vite', 'classic'], 'pixi', 'not-applicable'), [
      'feature-result'
    ]),
    scenario('feature.profile', variants(['vite', 'classic'], 'pixi', 'not-applicable'), [
      'feature-profile'
    ]),
    scenario('feature.rules-help', variants(['vite', 'classic'], 'pixi', 'not-applicable'), [
      'feature-rules-help'
    ]),
    scenario('feature.deck-builder', variants(['vite', 'classic'], 'pixi', 'not-applicable'), [
      'feature-deck-builder'
    ]),
    scenario('feature.network', variants(['vite', 'classic'], 'pixi', 'not-applicable'), [
      'feature-network'
    ]),
    scenario('feature.network-restore', variants(['vite', 'classic'], 'pixi', 'not-applicable'), [
      'feature-network'
    ]),
    scenario('asset.webp-fallback', variants(['vite', 'classic'], 'pixi', 'cold'), [
      'lossless-webp-admission'
    ]),
    scenario('playback.opponent-actions', variants(['vite'], 'pixi', 'not-applicable'), [
      'lock-only-hint-paint'
    ])
  ]);

export const UX_OPTIMIZATION_SCENARIO_CAPTURES:
  readonly UxOptimizationScenarioCaptureDefinition[] = Object.freeze(
  UX_OPTIMIZATION_SCENARIOS.flatMap((definition) => definition.requiredCaptures)
);

export const UX_OPTIMIZATION_PROFILE_SAMPLE_COUNTS: Readonly<Record<UxOptimizationProfile, number>> =
  Object.freeze({
    baseline: 1,
    quick: 1,
    standard: 5,
    ci: 1
  });

export const UX_OPTIMIZATION_FORBIDDEN_REPORT_KEYS = Object.freeze([
  'board',
  'hand',
  'hands',
  'cardState',
  'gameState',
  'seatToken',
  'operationId',
  'snapshot',
  'action'
] as const);

export const UX_OPTIMIZATION_STATIC_PATH_PREFIX_ALLOWLIST = Object.freeze([
  'assets/',
  'cards/',
  'constants/',
  'data/',
  'game/',
  'node_modules/onnxruntime-web/dist/',
  'othello-ai/',
  'public/',
  'shared/',
  'ui/',
  'utils/',
  'vite-dist/'
] as const);

export const UX_OPTIMIZATION_STATIC_ROOT_PATTERNS = Object.freeze([
  /^index(?:\.classic|\.vite)?\.html$/i,
  /^entry-browser\.js$/i,
  /^favicon(?:-[a-z0-9-]+)?\.(?:ico|png)$/i,
  /^manifest\.webmanifest$/i,
  /^styles-[a-z0-9-]+\.css$/i,
  /^(?:card-system|game-events|is-env-capable|shared-constants|sound-engine|ui)\.js$/i
]);

export const UX_OPTIMIZATION_CAPTURE_POLICY = Object.freeze({
  phaseClock: 'performance.timeOrigin',
  percentile: 'nearest-rank',
  viewport: Object.freeze({ width: 1366, height: 900 }),
  dpr: 1,
  timingThresholds: Object.freeze({
    applicationLongTaskMs: 50,
    rafStallMs: 50,
    featureReadyP95Ms: 250,
    resultStylesheetP95Ms: 250,
    cls: 0.01
  })
});

export const UX_OPTIMIZATION_FIXTURE = Object.freeze({
  version: 1,
  bootReadyContract: Object.freeze({
    vite: '[data-browser-boot-state="ready"] and window.__uiInitialized === true',
    classic: 'window.__uiInitialized === true'
  }),
  maintenanceNoticeId: 'maintenanceNotice',
  maintenanceCloseId: 'maintenanceNoticeCloseBtn',
  featureRoots: Object.freeze({
    profile: '#profileOverlay',
    rulesHelp: '#rules-help-panel',
    deckBuilder: '#deckBuilderOverlay',
    network: '#networkOverlay',
    result: '#result-overlay'
  })
});

export const UX_OPTIMIZATION_FIXTURE_DIGEST = sha256StableJson(
  UX_OPTIMIZATION_FIXTURE
);
export const UX_OPTIMIZATION_SCENARIO_DIGEST = sha256StableJson(
  UX_OPTIMIZATION_SCENARIOS
);
export const UX_OPTIMIZATION_CAPTURE_POLICY_DIGEST = sha256StableJson(
  UX_OPTIMIZATION_CAPTURE_POLICY
);

export function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    return `{${Object.keys(objectValue)
      .sort((left, right) => left.localeCompare(right, 'en'))
      .map((key) => `${JSON.stringify(key)}:${stableJson(objectValue[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256StableJson(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

export function nearestRankPercentile(
  values: readonly number[],
  ratio: number
): number | null {
  const finite = values.filter(Number.isFinite).slice().sort((left, right) => left - right);
  if (finite.length === 0) return null;
  const normalizedRatio = Math.max(0, Math.min(1, Number(ratio)));
  const rank = Math.max(1, Math.ceil(finite.length * normalizedRatio));
  return finite[Math.min(finite.length - 1, rank - 1)];
}

export function normalizeStaticResourcePath(value: unknown): string | null {
  const text = String(value || '').trim();
  if (!text) return null;
  let pathname = text;
  try {
    const url = new URL(text, 'http://card-reversi.invalid/');
    if (url.origin !== 'http://card-reversi.invalid') return null;
    pathname = url.pathname;
  } catch (_error) {
    pathname = text.split(/[?#]/, 1)[0];
  }
  const normalized = pathname
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');
  if (!normalized || normalized.includes('../') || normalized === '..') return null;
  return normalized;
}

export function isAllowedStaticResourcePath(value: unknown): boolean {
  const normalized = normalizeStaticResourcePath(value);
  if (!normalized) return false;
  if (UX_OPTIMIZATION_STATIC_PATH_PREFIX_ALLOWLIST.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }
  return UX_OPTIMIZATION_STATIC_ROOT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function normalizePhaseName(value: unknown): UxOptimizationPhase | null {
  const text = String(value || '').trim();
  const base = text.split(':', 1)[0] as UxOptimizationPhase;
  return (UX_OPTIMIZATION_PHASES as readonly string[]).includes(base) ? base : null;
}

function scenario(
  id: string,
  requiredVariants: readonly Readonly<{
    lane: UxOptimizationLane;
    backend: UxOptimizationBackend;
    cacheProfile: UxOptimizationCacheProfile;
  }>[],
  optimizationIds: readonly UxOptimizationId[]
): UxOptimizationScenarioDefinition {
  const requiredCaptures = requiredVariants.map((variant) => Object.freeze({
    key: `${id}:${variant.lane}:${variant.backend}`,
    id,
    lane: variant.lane,
    backend: variant.backend,
    cacheProfile: variant.cacheProfile
  }));
  return Object.freeze({
    id,
    blocking: true,
    optimizationIds: Object.freeze(optimizationIds.slice()),
    requiredCaptures: Object.freeze(requiredCaptures.slice())
  });
}

function variants(
  lanes: readonly UxOptimizationLane[],
  backend: UxOptimizationBackend,
  cacheProfile: UxOptimizationCacheProfile
): readonly Readonly<{
  lane: UxOptimizationLane;
  backend: UxOptimizationBackend;
  cacheProfile: UxOptimizationCacheProfile;
}>[] {
  return Object.freeze(lanes.map((lane) => Object.freeze({
    lane,
    backend,
    cacheProfile
  })));
}
