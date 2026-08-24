import { isCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';
import ReloadRequiredSurface = require('./presentation/reload-required-surface');

export interface CardRuntimeIntegrityFailureOptions {
  readonly source?: string;
  readonly cancelUncommittedSelection?: () => void;
  readonly settleInputLocks?: () => void;
  readonly emitLog?: (message: string) => void;
}

export interface CardRuntimeIntegrityState {
  readonly blocked: boolean;
  readonly source: string | null;
  readonly capability: string | null;
  readonly cohort: string | null;
}

let integrityState: CardRuntimeIntegrityState = Object.freeze({
  blocked: false,
  source: null,
  capability: null,
  cohort: null
});

function runSafely(callback: (() => void) | undefined): void {
  if (typeof callback !== 'function') return;
  try { callback(); } catch (_error) { /* integrity settlement is best-effort at the UI boundary */ }
}

export function isCardRuntimeIntegrityBlocked(): boolean {
  return integrityState.blocked === true;
}

export function getCardRuntimeIntegrityState(): CardRuntimeIntegrityState {
  return integrityState;
}

export function latchCardRuntimeIntegrityFailure(
  error: unknown,
  options?: CardRuntimeIntegrityFailureOptions
): boolean {
  if (!isCardRuntimeUnavailableError(error)) return false;
  const opts = options || {};

  if (integrityState.blocked) return true;
  runSafely(opts.cancelUncommittedSelection);
  runSafely(opts.settleInputLocks);

  integrityState = Object.freeze({
    blocked: true,
    source: String(opts.source || 'card-runtime'),
    capability: error.capability,
    cohort: error.cohort
  });
  runSafely(() => opts.emitLog?.('ゲーム実行環境を確認できませんでした。ページを再読み込みしてください。'));
  try {
    ReloadRequiredSurface.showReloadRequiredSurface({
      message: 'ゲーム実行環境を確認できませんでした。進行状態を保護するため操作を停止しました。ページを再読み込みしてください。'
    });
  } catch (_error) { /* a missing DOM must not turn integrity handling into gameplay */ }
  return true;
}

/** Test/bootstrap reconstruction helper. Normal recovery requires a page reload. */
export function resetCardRuntimeIntegrityState(): void {
  integrityState = Object.freeze({ blocked: false, source: null, capability: null, cohort: null });
  try { ReloadRequiredSurface.clearReloadRequiredSurface(); } catch (_error) { /* no DOM */ }
}
