// Lightweight resolver to safely provide AnimationHelpers and related helpers.

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

function getRoot(): Window {
  const root = (typeof globalThis !== 'undefined' ? globalThis : {}) as Window;
  if (root && root.window && typeof root.window === 'object') return root.window;
  return root || {} as Window;
}

function resolveGlobal(name: string): unknown {
  if (!name) return null;
  const candidates: unknown[] = [getRoot()];
  try {
    if (typeof globalThis !== 'undefined' && globalThis && candidates.indexOf(globalThis) === -1) {
      candidates.push(globalThis);
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && window && candidates.indexOf(window) === -1) {
      candidates.push(window);
    }
  } catch (e) { /* ignore */ }
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    try {
      if (candidate && typeof (candidate as Record<string, unknown>)[name] !== 'undefined') {
        return (candidate as Record<string, unknown>)[name];
      }
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveModule(modulePath: string): unknown {
  if (typeof _require !== 'function' || !modulePath) return null;
  try {
    return _require(modulePath);
  } catch (e) {
    return null;
  }
}

function resolveModuleOrGlobal(modulePath: string, globalName: string): unknown {
  return resolveModule(modulePath) || resolveGlobal(globalName);
}

function resolveExport(modulePath: string, globalName: string, exportName: string | null): unknown {
  const resolved = resolveModuleOrGlobal(modulePath, globalName);
  if (!resolved) {
    return exportName ? resolveGlobal(exportName) : null;
  }
  if (!exportName) return resolved;
  if (typeof (resolved as Record<string, unknown>)[exportName] !== 'undefined') {
    return (resolved as Record<string, unknown>)[exportName];
  }
  return resolveGlobal(exportName);
}

function resolveMethod(modulePath: string, globalName: string, methodName: string): ((...args: unknown[]) => unknown) | null {
  const owner = resolveModuleOrGlobal(modulePath, globalName);
  if (owner && typeof (owner as Record<string, unknown>)[methodName] === 'function') {
    return ((owner as Record<string, (...args: unknown[]) => unknown>)[methodName]).bind(owner);
  }
  const globalFn = resolveGlobal(methodName);
  return typeof globalFn === 'function' ? globalFn as (...args: unknown[]) => unknown : null;
}

function getAnimationShared(): AnimationShared | null {
  return (resolveModuleOrGlobal('./animation-helpers', 'AnimationHelpers') as AnimationShared | null)
    || (resolveGlobal('AnimationShared') as AnimationShared | null)
    || null;
}

function isNoAnim(): () => boolean {
  const shared = getAnimationShared();
  return (shared && typeof shared.isNoAnim === 'function')
    ? shared.isNoAnim
    : function () { return false; };
}

function getTimer(): TimerRegistry {
  const shared = getAnimationShared();
  try {
    if (shared && typeof shared.getTimer === 'function') return shared.getTimer();
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

export = {
  getRoot,
  resolveGlobal,
  resolveModule,
  resolveModuleOrGlobal,
  resolveExport,
  resolveMethod,
  getAnimationShared,
  isNoAnim,
  getTimer
};
