export type RegisteredGlobalsReader = () => Record<string, any> | null;

export type RuntimeResolverDeps = {
  getRegisteredUIGlobals: RegisteredGlobalsReader;
  readDebugQueryString?: () => string;
  isDebugSessionEnabled?: () => boolean;
  debugLog?: (...args: any[]) => any;
};

export function createRuntimeResolvers(deps: RuntimeResolverDeps) {
  const safeDeps = (deps || {}) as RuntimeResolverDeps;

  function resolveRuntimeFunction(name: string): Function | null {
    try {
      if (typeof name !== 'string') return null;
      const registered = typeof safeDeps.getRegisteredUIGlobals === 'function'
        ? safeDeps.getRegisteredUIGlobals()
        : null;
      const registeredCandidate = registered && (registered as any)[name];
      if (typeof registeredCandidate === 'function') return registeredCandidate;
      if (typeof globalThis === 'undefined') return null;
      const candidate = (globalThis as any)[name];
      return typeof candidate === 'function' ? candidate : null;
    } catch (e: any) {
      return null;
    }
  }

  function resolveRuntimeValue(name: string): any {
    try {
      if (typeof name !== 'string' || typeof globalThis === 'undefined') return undefined;
      return Object.prototype.hasOwnProperty.call(globalThis, name)
        ? (globalThis as any)[name]
        : undefined;
    } catch (e: any) {
      return undefined;
    }
  }

  function readMatchMode(): any {
    try {
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
        return (globalThis as any).getCurrentMatchMode();
      }
      if (typeof globalThis !== 'undefined') return (globalThis as any).MATCH_MODE;
    } catch (e: any) { /* ignore */ }
    return null;
  }

  function readHumanVsHumanMode(): boolean {
    try {
      return typeof globalThis !== 'undefined' && (globalThis as any).DEBUG_HUMAN_VS_HUMAN === true;
    } catch (e: any) { /* ignore */ }
    return false;
  }

  return {
    resolveRuntimeFunction,
    resolveRuntimeValue,
    readMatchMode,
    readHumanVsHumanMode,
    readQuerySearch: () => (
      typeof safeDeps.readDebugQueryString === 'function' ? safeDeps.readDebugQueryString() : ''
    ),
    isDebugLogAvailable: () => (
      typeof safeDeps.isDebugSessionEnabled === 'function' && safeDeps.isDebugSessionEnabled() === true
    ),
    debugLog: typeof safeDeps.debugLog === 'function' ? safeDeps.debugLog : function noopDebugLog() { return false; }
  };
}

module.exports = {
  createRuntimeResolvers
};
