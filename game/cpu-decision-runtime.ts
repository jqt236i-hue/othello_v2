import { isCardRuntimeUnavailableError } from './logic/card-runtime-errors';

export type CpuDecisionRuntime = Record<string, any> | null;

export function createCpuDecisionRuntimeBoundary() {
  let runtime: CpuDecisionRuntime = null;

  function getRuntime(): CpuDecisionRuntime {
    return runtime;
  }

  function setCpuDecisionRuntime(next: any): void {
    if (!next || typeof next !== 'object') {
      runtime = null;
      return;
    }
    runtime = Object.assign({}, runtime || {}, next);
  }

  function readRuntimeModule(moduleKey: any): any {
    try {
      if (runtime && typeof runtime.readModule === 'function') {
        const moduleRef = runtime.readModule(moduleKey);
        if (moduleRef) return moduleRef;
      }
    } catch (error: any) {
      if (isCardRuntimeUnavailableError(error)) throw error;
      /* preserve compatibility fallback */
    }
    return null;
  }

  function resolveCpuDecisionMatchMode(): string {
    try {
      if (runtime && typeof runtime.readMatchMode === 'function') {
        const mode = String(runtime.readMatchMode() || '').trim().toLowerCase();
        if (mode) return mode;
      }
      if (runtime && typeof runtime.getCurrentMatchMode === 'function') {
        const mode = String(runtime.getCurrentMatchMode() || '').trim().toLowerCase();
        if (mode) return mode;
      }
      if (runtime && typeof runtime.MATCH_MODE !== 'undefined') {
        const mode = String(runtime.MATCH_MODE || '').trim().toLowerCase();
        if (mode) return mode;
      }
    } catch (error: any) {
      if (isCardRuntimeUnavailableError(error)) throw error;
      /* preserve compatibility fallback */
    }
    return '';
  }

  function isOthelloModeForCpuDecision(): boolean {
    const mode = resolveCpuDecisionMatchMode();
    return mode === 'reversi' || mode === 'othello';
  }

  function readCpuDecisionQuerySearch(): string {
    try {
      if (runtime && typeof runtime.readQuerySearch === 'function') {
        const qs = runtime.readQuerySearch();
        return typeof qs === 'string' ? qs : String(qs || '');
      }
    } catch (error: any) {
      if (isCardRuntimeUnavailableError(error)) throw error;
      /* preserve compatibility fallback */
    }
    return '';
  }

  function readDebugFlag(name: string): boolean {
    try {
      return !!(runtime && typeof runtime.readDebugFlag === 'function' && runtime.readDebugFlag(name) === true);
    } catch (e: any) { /* ignore */ }
    return false;
  }

  function isDebugLogAvailable(): boolean {
    try {
      return !!(runtime && typeof runtime.isDebugLogAvailable === 'function' && runtime.isDebugLogAvailable() === true);
    } catch (e: any) { /* ignore */ }
    return false;
  }

  return {
    getRuntime,
    setCpuDecisionRuntime,
    readRuntimeModule,
    resolveCpuDecisionMatchMode,
    isOthelloModeForCpuDecision,
    readCpuDecisionQuerySearch,
    readDebugFlag,
    isDebugLogAvailable
  };
}

export function createCpuTurnRuntimeBoundary(deps?: any) {
  const cfg = (deps && typeof deps === 'object') ? deps : {};

  function readUiImpl(): Record<string, any> | null {
    try {
      if (typeof cfg.getUiImpl === 'function') {
        const uiImpl = cfg.getUiImpl();
        return uiImpl && typeof uiImpl === 'object' ? uiImpl : null;
      }
    } catch (error: any) {
      if (isCardRuntimeUnavailableError(error)) throw error;
      /* preserve compatibility fallback */
    }
    return null;
  }

  function resolveRuntimeFunction(name: string): Function | null {
    try {
      const uiImpl = readUiImpl();
      if (uiImpl && typeof uiImpl.resolveRuntimeFunction === 'function') {
        const candidate = uiImpl.resolveRuntimeFunction(name);
        if (typeof candidate === 'function') return candidate;
      }
      if (uiImpl && typeof uiImpl[name] === 'function') {
        return uiImpl[name];
      }
    } catch (e: any) { /* ignore */ }
    return null;
  }

  function resolveRuntimeValue(name: string): any {
    try {
      const uiImpl = readUiImpl();
      if (uiImpl && typeof uiImpl.resolveRuntimeValue === 'function') {
        const value = uiImpl.resolveRuntimeValue(name);
        if (typeof value !== 'undefined') return value;
      }
      if (uiImpl && Object.prototype.hasOwnProperty.call(uiImpl, name)) {
        return uiImpl[name];
      }
    } catch (e: any) { /* ignore */ }
    try {
      if (typeof globalThis !== 'undefined' && Object.prototype.hasOwnProperty.call(globalThis, name)) {
        return (globalThis as any)[name];
      }
    } catch (e: any) { /* ignore */ }
    return undefined;
  }

  function resolveCpuCardLogic(): any {
    try {
      const uiImpl = readUiImpl();
      if (uiImpl && typeof uiImpl.getCpuCardLogic === 'function') {
        const logic = uiImpl.getCpuCardLogic();
        if (logic && typeof logic === 'object') return logic;
      }
      if (uiImpl && uiImpl.CardLogic && typeof uiImpl.CardLogic === 'object') {
        return uiImpl.CardLogic;
      }
    } catch (error: any) {
      if (isCardRuntimeUnavailableError(error)) throw error;
      /* preserve compatibility fallback */
    }
    const runtimeCardLogic = resolveRuntimeValue('CardLogic');
    if (runtimeCardLogic && typeof runtimeCardLogic === 'object') return runtimeCardLogic;
    try {
      if (typeof cfg.getFallbackCardLogic === 'function') {
        const fallbackCardLogic = cfg.getFallbackCardLogic();
        if (fallbackCardLogic && typeof fallbackCardLogic === 'object') return fallbackCardLogic;
      }
    } catch (error: any) {
      if (isCardRuntimeUnavailableError(error)) throw error;
      /* preserve compatibility fallback */
    }
    return null;
  }

  function readProcessing(): boolean {
    try {
      const uiImpl = readUiImpl();
      if (uiImpl && typeof uiImpl.readProcessing === 'function') {
        return uiImpl.readProcessing() === true;
      }
    } catch (e: any) { /* ignore */ }
    const runtimeProcessing = resolveRuntimeValue('isProcessing');
    if (typeof runtimeProcessing !== 'undefined') return runtimeProcessing === true;
    return false;
  }

  function setProcessing(active: any): boolean {
    const next = active === true;
    let handled = false;
    try {
      const uiImpl = readUiImpl();
      if (uiImpl && typeof uiImpl.setProcessing === 'function') {
        uiImpl.setProcessing(next);
        handled = true;
      }
    } catch (e: any) { /* ignore */ }
    if (!handled) {
      try {
        const runtimeRoot = (typeof globalThis !== 'undefined')
          ? (globalThis as any)
          : (typeof self !== 'undefined' ? (self as any) : null);
        if (runtimeRoot && typeof runtimeRoot === 'object') {
          runtimeRoot.isProcessing = next;
        }
      } catch (e: any) { /* ignore */ }
    }
    return next;
  }

  function isAnimationBusy(): boolean {
    try {
      const uiImpl = readUiImpl();
      if (uiImpl && typeof uiImpl.readAnimationBusy === 'function') {
        return uiImpl.readAnimationBusy() === true;
      }
    } catch (e: any) { /* ignore */ }
    const runtimeCard = resolveRuntimeValue('isCardAnimating');
    const runtimePlayback = resolveRuntimeValue('VisualPlaybackActive');
    const localCard = typeof runtimeCard !== 'undefined' ? runtimeCard === true : false;
    const winPlayback = typeof runtimePlayback !== 'undefined' ? runtimePlayback === true : false;
    return localCard || winPlayback;
  }

  return {
    resolveRuntimeFunction,
    resolveRuntimeValue,
    resolveCpuCardLogic,
    readProcessing,
    setProcessing,
    isAnimationBusy
  };
}

module.exports = {
  createCpuDecisionRuntimeBoundary,
  createCpuTurnRuntimeBoundary
};
