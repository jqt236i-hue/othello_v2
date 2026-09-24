import { searchLv12 } from '../../game/ai/cpu-lv12-search';
import { parseLv10AdvisorRequest } from '../../game/ai/cpu-lv10-advisor-contract';
import { CPU_WORKER_OPERATIONS, parseCpuWorkerRequest, type CpuWorkerResponse } from './protocol';

/** The evaluated policy runs with its production clock in an independent
 * Worker. Transport/startup allowances never change its search budget. */
export function executeLv12WorkerMessage(raw: unknown): CpuWorkerResponse | null {
  if ((raw as any)?.kind === 'cancel') return null;
  const { payload, kind: _kind, ...identity } = parseCpuWorkerRequest(raw);
  // A warm-up probe only loads this Worker; it never runs a search.
  if (identity.operation === CPU_WORKER_OPERATIONS.PING) return { ...identity, kind: 'response', ok: true, result: { ready: true } };
  try {
    if (identity.operation !== CPU_WORKER_OPERATIONS.LV12_ADVISE) throw new Error('Unsupported Lv12 operation');
    const request = parseLv10AdvisorRequest(payload);
    const result = searchLv12(request.observation, { publicRecipes: request.publicRecipes,
      excludedActions: request.excludedActions, now: () => performance.now() });
    return { ...identity, kind: 'response', ok: true, result };
  } catch (error) {
    return { ...identity, kind: 'response', ok: false, error: {
      code: 'LV12_SEARCH_FAILED', message: error instanceof Error ? error.message : String(error), recoverable: true
    } };
  }
}

if (typeof self !== 'undefined' && typeof document === 'undefined') {
  self.onmessage = event => {
    const result = executeLv12WorkerMessage(event.data);
    if (result) self.postMessage(result);
  };
}
