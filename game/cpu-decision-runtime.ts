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
    } catch (e: any) { /* ignore */ }
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
    } catch (e: any) { /* ignore */ }
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
    } catch (e: any) { /* ignore */ }
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

module.exports = {
  createCpuDecisionRuntimeBoundary
};
