type RuntimeRoot = Window & Record<string, any>;

export interface PixiRuntimeLoadOutcome {
  runtime: any | null;
  version: string | null;
  unavailableReason: string | null;
}

interface PixiRuntimePreloadState {
  pending: boolean;
  preloadFailureReason: string | null;
  preloadCandidates: Set<unknown>;
  claimedPreloadErrors: Set<unknown>;
}

interface LoadPixiRuntimeOptions {
  root?: RuntimeRoot;
  importer: () => Promise<any>;
}

const PIXI_PRELOAD_STATE_KEY = '__CARD_REVERSI_PIXI_PRELOAD_STATE__';

function normalizeImportedRuntime(moduleValue: any): any {
  if (moduleValue && (moduleValue.VERSION || moduleValue.Application)) return moduleValue;
  if (moduleValue && moduleValue.default) return moduleValue.default;
  return moduleValue;
}

function readPixiPreloadState(rootRef: RuntimeRoot): PixiRuntimePreloadState | null {
  const state = rootRef && rootRef[PIXI_PRELOAD_STATE_KEY];
  return state && typeof state === 'object' ? state : null;
}

export function isPixiRuntimePreloadPending(rootRef: RuntimeRoot = window as RuntimeRoot): boolean {
  return readPixiPreloadState(rootRef)?.pending === true;
}

export function trackPixiRuntimePreloadCandidate(
  rootRef: RuntimeRoot,
  error: unknown
): boolean {
  const state = readPixiPreloadState(rootRef);
  if (!state || state.pending !== true || !error) return false;
  state.preloadCandidates.add(error);
  return true;
}

export function claimPixiRuntimePreloadFailure(
  rootRef: RuntimeRoot,
  error: unknown
): boolean {
  const state = readPixiPreloadState(rootRef);
  if (!state || !state.preloadCandidates.has(error)) return false;
  state.preloadCandidates.delete(error);
  state.claimedPreloadErrors.add(error);
  state.preloadFailureReason = 'pixi-preload-failed';
  return true;
}

export function consumeClaimedPixiRuntimePreloadFailure(
  rootRef: RuntimeRoot,
  error: unknown
): boolean {
  const state = readPixiPreloadState(rootRef);
  if (!state || !state.claimedPreloadErrors.has(error)) return false;
  state.claimedPreloadErrors.delete(error);
  return true;
}

export async function loadPixiRuntime(options: LoadPixiRuntimeOptions): Promise<PixiRuntimeLoadOutcome> {
  const rootRef = options.root || window as RuntimeRoot;
  const state: PixiRuntimePreloadState = {
    pending: true,
    preloadFailureReason: null,
    preloadCandidates: new Set(),
    claimedPreloadErrors: new Set()
  };
  rootRef[PIXI_PRELOAD_STATE_KEY] = state;
  try {
    const imported = await options.importer();
    const runtime = normalizeImportedRuntime(imported);
    return {
      runtime,
      version: String(runtime && runtime.VERSION || '').trim() || null,
      unavailableReason: null
    };
  } catch (error) {
    claimPixiRuntimePreloadFailure(rootRef, error);
    const message = error instanceof Error ? error.message : String(error || 'unknown');
    return {
      runtime: null,
      version: null,
      unavailableReason: state.preloadFailureReason || `pixi-import-failed:${message}`
    };
  } finally {
    state.pending = false;
  }
}

export function applyPixiRuntimeOutcome(
  rootRef: RuntimeRoot,
  outcome: PixiRuntimeLoadOutcome | null
): boolean {
  const bootstrap = rootRef && rootRef.UIBootstrap;
  if (
    outcome && outcome.runtime
    && bootstrap
    && typeof bootstrap.configurePixiRuntime === 'function'
  ) {
    return bootstrap.configurePixiRuntime(outcome.runtime) === true;
  }
  if (bootstrap && typeof bootstrap.markPixiRuntimeUnavailable === 'function') {
    bootstrap.markPixiRuntimeUnavailable(
      outcome && outcome.unavailableReason || 'pixi-runtime-unavailable',
      { root: rootRef, lane: 'vite' }
    );
  }
  return false;
}
