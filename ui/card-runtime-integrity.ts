import { isCardRuntimeUnavailableError } from '../game/logic/card-runtime-errors';
import ReloadRequiredSurface = require('./presentation/reload-required-surface');

export interface CardRuntimeIntegrityFailureOptions {
  readonly source?: string;
  readonly emitLog?: (message: string) => void;
}

export interface CardRuntimeIntegritySettlementOptions {
  readonly cancelUncommittedSelection?: () => void;
  readonly settleInputLocks?: () => void;
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

interface CardRuntimeIntegritySettlementRegistration extends CardRuntimeIntegritySettlementOptions {
  settled: boolean;
}

const settlementOwners = new Map<string, CardRuntimeIntegritySettlementRegistration>();

function runSafely(callback: (() => void) | undefined): void {
  if (typeof callback !== 'function') return;
  try { callback(); } catch (_error) { /* integrity settlement is best-effort at the UI boundary */ }
}

function settleRegistration(registration: CardRuntimeIntegritySettlementRegistration): void {
  if (registration.settled) return;
  registration.settled = true;
  runSafely(registration.cancelUncommittedSelection);
  runSafely(registration.settleInputLocks);
}

function settleRegisteredOwners(): void {
  for (const registration of settlementOwners.values()) {
    settleRegistration(registration);
  }
}

/**
 * Registers cleanup owned by a UI surface before an integrity failure occurs.
 * Each registration settles at most once for the current page lifetime, even
 * when another boundary is the first one to latch the terminal failure.
 */
export function registerCardRuntimeIntegritySettlementOwner(
  ownerValue: string,
  options?: CardRuntimeIntegritySettlementOptions
): () => void {
  const owner = String(ownerValue || '').trim();
  if (!owner) throw new TypeError('card runtime integrity settlement owner is required');
  const opts = options || {};
  const registration: CardRuntimeIntegritySettlementRegistration = {
    cancelUncommittedSelection: opts.cancelUncommittedSelection,
    settleInputLocks: opts.settleInputLocks,
    settled: false
  };
  settlementOwners.set(owner, registration);
  if (integrityState.blocked) settleRegistration(registration);
  return () => {
    if (settlementOwners.get(owner) === registration) settlementOwners.delete(owner);
  };
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
  integrityState = Object.freeze({
    blocked: true,
    source: String(opts.source || 'card-runtime'),
    capability: error.capability,
    cohort: error.cohort
  });
  settleRegisteredOwners();
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
  for (const registration of settlementOwners.values()) {
    registration.settled = false;
  }
  try { ReloadRequiredSurface.clearReloadRequiredSurface(); } catch (_error) { /* no DOM */ }
}
