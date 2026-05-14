/**
 * @file animation-helpers.ts
 * @description Wrapper around ui/animation-shared that provides normalized, safe fallbacks
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

interface AnimationShared {
  isNoAnim?: () => boolean;
  getTimer?: () => TimerRegistry;
  triggerFlip?: (disc: Element) => void;
  removeFlip?: (disc: Element) => void;
}

function getSharedModule(): AnimationShared | null {
  let Shared: AnimationShared | null = null;
  try {
    Shared = (typeof _require === 'function') ? (_require('./animation-shared.js') as AnimationShared | null | undefined) ?? null : (typeof window !== 'undefined' ? (window as Window & { AnimationShared?: AnimationShared }).AnimationShared ?? null : null);
  } catch (e) {
    Shared = (typeof window !== 'undefined' ? (window as Window & { AnimationShared?: AnimationShared }).AnimationShared ?? null : null);
  }
  return Shared;
}

function isNoAnim(): boolean {
  try {
    const Shared = getSharedModule();
    if (Shared && typeof Shared.isNoAnim === 'function') return Shared.isNoAnim();
    if (typeof window !== 'undefined' && (window as Window & { DISABLE_ANIMATIONS?: boolean }).DISABLE_ANIMATIONS === true) return true;
    if (typeof location !== 'undefined' && /[?&]noanim=1/.test(location.search)) return true;
    if (typeof process !== 'undefined' && (process.env.NOANIM === '1' || process.env.NOANIM === 'true' || process.env.DISABLE_ANIMATIONS === '1')) return true;
  } catch (e) { /* ignore */ }
  return false;
}

function getTimer(): TimerRegistry {
  const Shared = getSharedModule();
  try {
    if (Shared && typeof Shared.getTimer === 'function') return Shared.getTimer();
  } catch (e) { /* ignore */ }
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
  try {
    const Shared = getSharedModule();
    if (Shared && typeof Shared.triggerFlip === 'function') {
      Shared.triggerFlip(disc as Element);
      return;
    }
  } catch (e) { /* ignore */ }
  if (!disc) return;
  try {
    disc.classList.remove('flip');
    (disc as HTMLElement).offsetHeight;
    disc.classList.add('flip');
  } catch (e) { /* ignore */ }
}

function removeFlip(disc: Element | null | undefined): void {
  try {
    const Shared = getSharedModule();
    if (Shared && typeof Shared.removeFlip === 'function') {
      Shared.removeFlip(disc as Element);
      return;
    }
  } catch (e) { /* ignore */ }
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
