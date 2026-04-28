/**
 * ui/animation-shared.ts
 * 共通アニメーションユーティリティ（UI専用）
 * 目的: _isNoAnim / Timer / Flip トリガー等の重複を集約する
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

interface TimerRegistry {
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  clearAll: () => void;
  pendingCount: () => number;
  newScope: () => null;
  clearScope: () => void;
}

declare const TimerRegistry: unknown;

function isNoAnim(): boolean {
  try {
    if (typeof window !== 'undefined' && (window as Window & { DISABLE_ANIMATIONS?: boolean }).DISABLE_ANIMATIONS === true) return true;
    if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)) return true;
    if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1')) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function getTimer(): TimerRegistry {
  if (typeof TimerRegistry !== 'undefined') {
    return TimerRegistry as TimerRegistry;
  }
  return {
    setTimeout: (fn: () => void, ms: number) => window.setTimeout(fn, ms),
    clearTimeout: (id: number) => window.clearTimeout(id),
    clearAll: () => { /* no-op */ },
    pendingCount: () => 0,
    newScope: () => null,
    clearScope: () => { /* no-op */ }
  };
}

function triggerFlip(disc: Element | null | undefined): void {
  if (!disc) return;
  try {
    disc.classList.remove('flip');
    (disc as HTMLElement).offsetHeight;
    disc.classList.add('flip');
  } catch (e) { /* ignore */ }
}

function removeFlip(disc: Element | null | undefined): void {
  if (!disc) return;
  try {
    disc.classList.remove('flip');
  } catch (e) { /* ignore */ }
}

export = {
  isNoAnim,
  getTimer,
  triggerFlip,
  removeFlip
};
