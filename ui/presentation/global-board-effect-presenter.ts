import PresentationEffectProfiles = require('../../shared/presentation-effect-profiles');
import TransientOverlayBatch = require('../transient-overlay-batch');

const AnimationDestroySourceEvents: any = require('../animation-destroy-source-events');

export interface GlobalBoardEffectPresenterDeps {
  readonly isNoAnim: () => boolean;
  readonly getCellClientRect: (row: number, col: number) => {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  readonly sleep: (ms: number) => Promise<void>;
  readonly timer: () => {
    setTimeout(fn: () => void, ms: number, scope?: unknown): unknown;
    clearTimeout(id: unknown): void;
  };
  readonly playbackScope: unknown;
  readonly abortSignal?: AbortSignal | null;
  readonly random?: () => number;
  readonly suppressTargetImpact?: boolean;
  readonly documentRef?: Document | null;
}

interface PresenterTimer {
  setTimeout(fn: () => void, ms: number, scope?: unknown): unknown;
  clearTimeout(id: unknown): void;
}

interface ResilientTimerHandle {
  readonly marker: symbol;
  active: boolean;
  hasScopedId: boolean;
  scopedId: unknown;
  nativeId: ReturnType<typeof globalThis.setTimeout> | null;
}

const RESILIENT_TIMER_HANDLE = Symbol('global-board-effect-timer');

const DESTROY_SOURCE_METHOD_BY_PROFILE = Object.freeze({
  sniperShot: 'animateSniperProjectile',
  lightningDestroyed: 'animateUdgLightningStrike',
  destroyDragonBreath: 'animateDestroyDragonBreath',
  udgDestroyed: 'animateUdgLightningStrike',
  meteorGodBlackBeam: 'animateMeteorGodBlackBeam',
  robotVacuumSuck: 'animateRobotVacuumSuction'
} as const);

function resolveSource(target: any): Readonly<{ row: number; col: number }> | null {
  const meta = target?.meta && typeof target.meta === 'object' ? target.meta : {};
  const row = Number(Object.prototype.hasOwnProperty.call(target || {}, 'sourceRow')
    ? target.sourceRow
    : meta.sourceRow);
  const col = Number(Object.prototype.hasOwnProperty.call(target || {}, 'sourceCol')
    ? target.sourceCol
    : meta.sourceCol);
  return Number.isFinite(row) && Number.isFinite(col)
    ? Object.freeze({ row: Math.trunc(row), col: Math.trunc(col) })
    : null;
}

function createScopeResilientTimer(timerFactory: GlobalBoardEffectPresenterDeps['timer']): Readonly<{
  timer: PresenterTimer;
  dispose: () => void;
}> {
  let scopedTimer: PresenterTimer | null = null;
  try {
    const candidate = timerFactory();
    if (candidate && typeof candidate.setTimeout === 'function' && typeof candidate.clearTimeout === 'function') {
      scopedTimer = candidate;
    }
  } catch (_error) { /* native safety timer remains available */ }

  const handles = new Set<ResilientTimerHandle>();

  const clearHandle = (handle: ResilientTimerHandle) => {
    if (!handle.active) return;
    handle.active = false;
    handles.delete(handle);
    if (handle.hasScopedId && scopedTimer) {
      try { scopedTimer.clearTimeout(handle.scopedId); } catch (_error) { /* cleanup */ }
    }
    handle.hasScopedId = false;
    handle.scopedId = null;
    if (handle.nativeId !== null) {
      try { globalThis.clearTimeout(handle.nativeId); } catch (_error) { /* cleanup */ }
      handle.nativeId = null;
    }
  };

  const timer: PresenterTimer = {
    setTimeout(fn, ms, scope) {
      const delayMs = Math.max(0, Number(ms) || 0);
      const handle: ResilientTimerHandle = {
        marker: RESILIENT_TIMER_HANDLE,
        active: true,
        hasScopedId: false,
        scopedId: null,
        nativeId: null
      };
      const finish = () => {
        if (!handle.active) return;
        clearHandle(handle);
        fn();
      };
      handles.add(handle);

      if (scopedTimer) {
        try {
          const scopedId = scopedTimer.setTimeout(finish, delayMs, scope);
          if (handle.active) {
            handle.scopedId = scopedId;
            handle.hasScopedId = true;
          } else {
            try { scopedTimer.clearTimeout(scopedId); } catch (_error) { /* cleanup */ }
          }
        } catch (_error) { /* native safety timer owns settlement */ }
      }

      // TimerRegistry.clearScope()/clearAll() intentionally cannot cancel this
      // mirror. It uses the same deadline, so normal presentation timing stays
      // unchanged while an abort/reset cannot strand the presenter Promise.
      if (handle.active) {
        handle.nativeId = globalThis.setTimeout(finish, delayMs);
      }
      return handle;
    },
    clearTimeout(id) {
      const handle = id as ResilientTimerHandle | null;
      if (handle && handle.marker === RESILIENT_TIMER_HANDLE) {
        clearHandle(handle);
        return;
      }
      if (scopedTimer) {
        try { scopedTimer.clearTimeout(id); } catch (_error) { /* cleanup */ }
      }
    }
  };

  return Object.freeze({
    timer,
    dispose: () => {
      for (const handle of Array.from(handles)) clearHandle(handle);
    }
  });
}

function subscribeToAbort(signal: AbortSignal | null | undefined, onAbort: () => void): () => void {
  if (!signal) return () => undefined;
  if (signal.aborted) {
    onAbort();
    return () => undefined;
  }
  signal.addEventListener('abort', onAbort, { once: true });
  return () => signal.removeEventListener('abort', onAbort);
}

function waitForDelay(
  ms: unknown,
  timer: PresenterTimer,
  playbackScope: unknown,
  abortSignal?: AbortSignal | null
): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    let timeoutId: unknown = null;
    let unsubscribe: () => void = () => undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        try { timer.clearTimeout(timeoutId); } catch (_error) { /* cleanup */ }
        timeoutId = null;
      }
      unsubscribe();
      resolve();
    };
    unsubscribe = subscribeToAbort(abortSignal, finish);
    if (!settled) timeoutId = timer.setTimeout(finish, Math.max(0, Number(ms) || 0), playbackScope);
  });
}

function waitForAnimationFinish(
  animation: any,
  durationMs: unknown,
  paddingMs: unknown,
  timer: PresenterTimer,
  playbackScope: unknown,
  abortSignal?: AbortSignal | null
): Promise<void> {
  const timeoutMs = Math.max(0, Number(durationMs) || 0) + Math.max(0, Number(paddingMs) || 0);
  return new Promise<void>((resolve) => {
    let settled = false;
    let timeoutId: unknown = null;
    let unsubscribe: () => void = () => undefined;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutId !== null) {
        try { timer.clearTimeout(timeoutId); } catch (_error) { /* cleanup */ }
        timeoutId = null;
      }
      unsubscribe();
      resolve();
    };
    unsubscribe = subscribeToAbort(abortSignal, finish);
    if (settled) return;
    try {
      if (animation?.finished && typeof animation.finished.then === 'function') {
        Promise.resolve(animation.finished).then(finish, finish);
      }
    } catch (_error) { /* timeout owns settlement */ }
    timeoutId = timer.setTimeout(finish, timeoutMs, playbackScope);
  });
}

export async function presentDestroySourceAnimation(
  event: any,
  deps: GlobalBoardEffectPresenterDeps
): Promise<void> {
  const target = event?.target || (Array.isArray(event?.targets) ? event.targets[0] : null);
  if (!target || deps.isNoAnim()) return;
  const profileKey = PresentationEffectProfiles.getSpecialDestroyTargetProfileKey(target);
  const methodName = profileKey
    ? (DESTROY_SOURCE_METHOD_BY_PROFILE as Record<string, string>)[profileKey]
    : null;
  const animation = methodName && AnimationDestroySourceEvents
    ? AnimationDestroySourceEvents[methodName]
    : null;
  if (typeof animation !== 'function') return;
  const batch = TransientOverlayBatch && typeof TransientOverlayBatch.createTransientOverlayBatch === 'function'
    ? TransientOverlayBatch.createTransientOverlayBatch({
      documentRef: deps.documentRef || (typeof document !== 'undefined' ? document : null)
    })
    : null;
  const resilientTimer = createScopeResilientTimer(deps.timer);
  try {
    await animation(target, {
      isNoAnim: deps.isNoAnim,
      getCellClientRect: deps.getCellClientRect,
      resolveSniperSource: resolveSource,
      resolveRobotVacuumSource: resolveSource,
      resolveDestroyDragonSource: resolveSource,
      waitForAnimationFinish: (candidate: any, duration: unknown, padding: unknown) => (
        waitForAnimationFinish(
          candidate,
          duration,
          padding,
          resilientTimer.timer,
          deps.playbackScope,
          deps.abortSignal
        )
      ),
      sleep: (ms: unknown) => waitForDelay(ms, resilientTimer.timer, deps.playbackScope, deps.abortSignal),
      timer: () => resilientTimer.timer,
      playbackScope: deps.playbackScope,
      transientOverlayBatch: batch,
      abortSignal: deps.abortSignal,
      random: deps.random || (() => 0.5),
      suppressTargetImpact: deps.suppressTargetImpact === true
    });
  } finally {
    resilientTimer.dispose();
    try { if (batch && typeof batch.cleanup === 'function') batch.cleanup(); } catch (_error) { /* cleanup */ }
  }
}

function prefersReducedMotion(documentRef: Document | null): boolean {
  try {
    return documentRef?.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
  } catch (_error) {
    return false;
  }
}

/**
 * The shadow/fangs can span an arbitrary source-to-target distance, so they
 * stay in the DOM-global presenter.  The target stone pulse and terminal
 * owner remain exclusively owned by the active board backend.
 */
export async function presentZombieBiteSourceAnimation(
  event: any,
  deps: GlobalBoardEffectPresenterDeps
): Promise<void> {
  const target = event?.target || (Array.isArray(event?.targets) ? event.targets[0] : null);
  const documentRef = deps.documentRef || (typeof document !== 'undefined' ? document : null);
  if (!target || !documentRef || deps.isNoAnim() || prefersReducedMotion(documentRef)) return;
  const source = resolveSource(target);
  if (!source) return;
  const sourceRect = deps.getCellClientRect(source.row, source.col);
  const targetRow = Number(Object.prototype.hasOwnProperty.call(target, 'r') ? target.r : target.row);
  const targetCol = Number(Object.prototype.hasOwnProperty.call(target, 'col') ? target.col : target.c);
  const targetRect = deps.getCellClientRect(targetRow, targetCol);
  if (!sourceRect || !targetRect) return;

  const batch = TransientOverlayBatch && typeof TransientOverlayBatch.createTransientOverlayBatch === 'function'
    ? TransientOverlayBatch.createTransientOverlayBatch({ documentRef })
    : null;
  const resilientTimer = createScopeResilientTimer(deps.timer);
  const overlay = documentRef.createElement('div');
  overlay.className = 'zombie-bite-global-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '1250';

  const sourceX = sourceRect.left + sourceRect.width / 2;
  const sourceY = sourceRect.top + sourceRect.height / 2;
  const targetX = targetRect.left + targetRect.width / 2;
  const targetY = targetRect.top + targetRect.height / 2;
  const deltaX = targetX - sourceX;
  const deltaY = targetY - sourceY;
  const distance = Math.max(1, Math.hypot(deltaX, deltaY));
  const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

  const shadow = documentRef.createElement('div');
  shadow.className = 'zombie-bite-shadow';
  shadow.style.left = `${sourceX}px`;
  shadow.style.top = `${sourceY}px`;
  shadow.style.width = `${distance}px`;
  shadow.style.transform = `rotate(${angle}deg)`;

  const upperFang = documentRef.createElement('div');
  upperFang.className = 'zombie-bite-fang zombie-bite-fang--upper';
  const lowerFang = documentRef.createElement('div');
  lowerFang.className = 'zombie-bite-fang zombie-bite-fang--lower';
  for (const fang of [upperFang, lowerFang]) {
    fang.style.left = `${targetX}px`;
    fang.style.top = `${targetY}px`;
    fang.style.setProperty('--zombie-bite-angle', `${angle}deg`);
    overlay.appendChild(fang);
  }
  overlay.insertBefore(shadow, upperFang);

  try {
    if (batch && typeof batch.append === 'function') batch.append(overlay);
    else documentRef.body?.appendChild(overlay);
    await waitForDelay(800, resilientTimer.timer, deps.playbackScope, deps.abortSignal);
  } finally {
    resilientTimer.dispose();
    try { if (overlay.parentElement) overlay.parentElement.removeChild(overlay); } catch (_error) { /* cleanup */ }
    try { if (batch && typeof batch.cleanup === 'function') batch.cleanup(); } catch (_error) { /* cleanup */ }
  }
}

export const GLOBAL_DESTROY_SOURCE_METHOD_BY_PROFILE = DESTROY_SOURCE_METHOD_BY_PROFILE;
