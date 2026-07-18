type PixiRuntimeLane = 'classic' | 'vite' | 'test' | 'unknown';

interface PixiRuntimeCapability {
  readonly lane: PixiRuntimeLane;
  readonly injected: boolean;
  readonly version: string | null;
  readonly unavailableReason: string | null;
}

interface PixiRuntimeContractOptions {
  root?: Record<string, any> | null;
  lane?: PixiRuntimeLane | string | null;
}

const PIXI_RUNTIME_VERSION = '8.18.1';
const PIXI_BOARD_SUBSET_SAFE_METRICS_STRING = '|Mq';

let pixiRuntime: any = null;
let pixiCapability: PixiRuntimeCapability = Object.freeze({
  lane: 'unknown',
  injected: false,
  version: null,
  unavailableReason: 'not-configured'
});

function resolveRoot(root?: Record<string, any> | null): Record<string, any> | null {
  if (root) return root;
  try {
    if (typeof window !== 'undefined' && window) return window as unknown as Record<string, any>;
  } catch (_error) { /* ignore */ }
  return null;
}

function resolveLane(root: Record<string, any> | null, lane?: string | null): PixiRuntimeLane {
  const candidate = String(lane || (root && root.__CARD_REVERSI_BROWSER_LANE__) || '').trim().toLowerCase();
  if (candidate === 'classic' || candidate === 'vite' || candidate === 'test') return candidate;
  return 'unknown';
}

function publishCapability(
  next: PixiRuntimeCapability,
  root?: Record<string, any> | null
): PixiRuntimeCapability {
  pixiCapability = Object.freeze({
    lane: next.lane,
    injected: next.injected === true,
    version: next.version || null,
    unavailableReason: next.unavailableReason || null
  });
  const target = resolveRoot(root);
  if (target) {
    const current = target.__CARD_REVERSI_BROWSER_CAPABILITIES__;
    target.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze(Object.assign(
      {},
      current && typeof current === 'object' ? current : {},
      { pixiRuntime: pixiCapability }
    ));
    target.__CARD_REVERSI_PIXI_RUNTIME_CAPABILITY__ = pixiCapability;
  }
  return pixiCapability;
}

function validateRuntime(runtime: any): { valid: boolean; version: string | null; reason: string | null } {
  if (!runtime || (typeof runtime !== 'object' && typeof runtime !== 'function')) {
    return { valid: false, version: null, reason: 'runtime-missing' };
  }
  const version = String(runtime.VERSION || '').trim() || null;
  if (version !== PIXI_RUNTIME_VERSION) {
    return {
      valid: false,
      version,
      reason: `runtime-version-mismatch:${version || 'missing'}`
    };
  }
  if (typeof runtime.Application !== 'function') {
    return { valid: false, version, reason: 'runtime-application-missing' };
  }
  return { valid: true, version, reason: null };
}

function configureSubsetSafeCanvasTextMetrics(runtime: any): void {
  const metrics = runtime?.CanvasTextMetrics;
  if (!metrics || metrics.METRICS_STRING !== '|ÉqÅ') return;
  // Pixi's default font-height probe contains accented Latin glyphs that are
  // intentionally absent from the game's startup subset. Configure the shared
  // runtime before either browser lane can create Text, so numeric board labels
  // do not fetch the multi-megabyte full fallback face. M/q retain ascender and
  // descender coverage; actual missing glyphs keep the unchanged font fallback.
  metrics.METRICS_STRING = PIXI_BOARD_SUBSET_SAFE_METRICS_STRING;
}

function configurePixiRuntime(runtime: any, options: PixiRuntimeContractOptions = {}): boolean {
  const target = resolveRoot(options.root);
  const lane = resolveLane(target, options.lane || null);
  if (pixiRuntime) {
    if (pixiRuntime !== runtime) return false;
    publishCapability({ lane, injected: true, version: PIXI_RUNTIME_VERSION, unavailableReason: null }, target);
    return true;
  }
  const validation = validateRuntime(runtime);
  if (!validation.valid) {
    publishCapability({
      lane,
      injected: false,
      version: validation.version,
      unavailableReason: validation.reason
    }, target);
    return false;
  }
  configureSubsetSafeCanvasTextMetrics(runtime);
  pixiRuntime = runtime;
  publishCapability({ lane, injected: true, version: validation.version, unavailableReason: null }, target);
  return true;
}

function markPixiRuntimeUnavailable(
  reason: unknown,
  options: PixiRuntimeContractOptions = {}
): boolean {
  if (pixiRuntime) return false;
  const target = resolveRoot(options.root);
  publishCapability({
    lane: resolveLane(target, options.lane || null),
    injected: false,
    version: null,
    unavailableReason: String(reason || 'runtime-unavailable')
  }, target);
  return true;
}

function getPixiRuntime(): any {
  return pixiRuntime;
}

function getPixiRuntimeCapability(): PixiRuntimeCapability {
  return pixiCapability;
}

export = {
  PIXI_BOARD_SUBSET_SAFE_METRICS_STRING,
  PIXI_RUNTIME_VERSION,
  configurePixiRuntime,
  getPixiRuntime,
  getPixiRuntimeCapability,
  markPixiRuntimeUnavailable,
  validateRuntime
};
