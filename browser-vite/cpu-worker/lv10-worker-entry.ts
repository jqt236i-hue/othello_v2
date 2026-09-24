import { searchLv10 } from '../../game/ai/cpu-lv10-search';
import { parseLv10AdvisorRequest } from '../../game/ai/cpu-lv10-advisor-contract';
import { CPU_WORKER_OPERATIONS, parseCpuWorkerRequest, type CpuWorkerResponse } from './protocol';

/** Separate from the Lv1–9 ONNX Worker, so initialization or timeout in the
 * full-rule advisor cannot invalidate an existing model session. */
export function executeLv10WorkerMessage(raw: unknown): CpuWorkerResponse | null {
    if ((raw as any)?.kind === 'cancel') return null;
    const { payload, kind: _kind, ...identity } = parseCpuWorkerRequest(raw);
    // A warm-up probe only loads this Worker; it never runs a search.
    if (identity.operation === CPU_WORKER_OPERATIONS.PING) return { ...identity, kind: 'response', ok: true, result: { ready: true } };
    try {
        if (identity.operation !== CPU_WORKER_OPERATIONS.LV10_ADVISE) throw new Error('Unsupported Lv10 operation');
        const request = parseLv10AdvisorRequest(payload);
        const result = searchLv10(request.observation, { publicRecipes: request.publicRecipes,
            excludedActions: request.excludedActions, now: () => performance.now() });
        return { ...identity, kind: 'response', ok: true, result };
    } catch (error) {
        return { ...identity, kind: 'response', ok: false, error: {
            code: 'LV10_SEARCH_FAILED', message: error instanceof Error ? error.message : String(error), recoverable: true
        } };
    }
}

if (typeof self !== 'undefined' && typeof document === 'undefined') {
    self.onmessage = (event) => {
        const result = executeLv10WorkerMessage(event.data);
        if (result) self.postMessage(result);
    };
}
