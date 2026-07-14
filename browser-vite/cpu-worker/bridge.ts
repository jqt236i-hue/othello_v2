import CpuWorkerConstructor from './worker-entry?worker';
import {
  CpuWorkerClientError,
  createCpuCandidateWorkerScorer,
  createCpuWorkerClient,
  type CpuWorkerClient
} from './client';
import { detachOnnxWorkerExecutor } from './main-thread-fallback';

type RuntimeRoot = Window & Record<string, any>;

const bridges = new WeakMap<object, BrowserCpuWorkerBridge>();
const permanentlyDisabledRoots = new WeakSet<object>();

export interface BrowserCpuWorkerBridge {
  client: CpuWorkerClient;
  scoreCandidatesInWorker: ReturnType<typeof createCpuCandidateWorkerScorer>;
}

export function getCpuWorkerBridge(rootRef: RuntimeRoot): BrowserCpuWorkerBridge | null {
  return bridges.get(rootRef) || null;
}

function updateCapabilities(rootRef: RuntimeRoot, values: Record<string, unknown>): void {
  rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ = Object.freeze(Object.assign(
    {},
    rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__ || {},
    values
  ));
}

export function installCpuWorkerBridge(
  rootRef: RuntimeRoot,
  _documentRef: Document
): BrowserCpuWorkerBridge | null {
  const existing = bridges.get(rootRef);
  if (existing && existing.client && typeof existing.scoreCandidatesInWorker === 'function') return existing;
  if (permanentlyDisabledRoots.has(rootRef)) return null;
  if (typeof rootRef.Worker !== 'function') return null;

  const client = createCpuWorkerClient({
    workerFactory: () => new CpuWorkerConstructor({ name: 'card-reversi-cpu' }) as unknown as Worker,
    defaultTimeoutMs: 15000
  });
  const rawScoreCandidatesInWorker = createCpuCandidateWorkerScorer({ client, timeoutMs: 48 });
  const bridge: BrowserCpuWorkerBridge = {
    client,
    scoreCandidatesInWorker: async (request, options) => {
      try {
        return await rawScoreCandidatesInWorker(request, options);
      } catch (error) {
        if (error instanceof CpuWorkerClientError && error.recoverable === false) {
          disableCpuWorkerBridge(rootRef, bridge);
        }
        throw error;
      }
    }
  };
  bridges.set(rootRef, bridge);
  updateCapabilities(rootRef, {
    dedicatedCpuWorkerConfigured: true,
    cpuCandidateScoringWorker: true
  });
  return bridge;
}

export function disableCpuWorkerBridge(
  rootRef: RuntimeRoot,
  bridge?: BrowserCpuWorkerBridge | null
): void {
  const current = bridges.get(rootRef);
  if (!current && permanentlyDisabledRoots.has(rootRef)) return;
  if (bridge && current && current !== bridge) return;
  const target = current || bridge || null;
  if (target && target.client) target.client.terminate('Dedicated CPU Worker disabled');
  bridges.delete(rootRef);
  permanentlyDisabledRoots.add(rootRef);
  try {
    const bootstrap = rootRef.UIBootstrap;
    if (bootstrap && typeof bootstrap.configureCpuCandidateScoring === 'function') {
      bootstrap.configureCpuCandidateScoring(null);
    }
  } catch (error) { /* local fallback remains available */ }
  const detachResult = detachOnnxWorkerExecutor(rootRef);
  const lazyRuntime = rootRef.LazyRuntimeLoaderModule;
  const activateMainThreadFallback = lazyRuntime && lazyRuntime.activateMainThreadOnnxFallback;
  const fallbackPending = detachResult.hadWorkerExecutor && typeof activateMainThreadFallback === 'function';
  updateCapabilities(rootRef, {
    dedicatedCpuWorkerConfigured: false,
    cpuCandidateScoringWorker: false,
    cpuCandidateScoringInjected: false,
    dedicatedCpuWorker: false,
    onnxInferenceWorker: false,
    onnxWorkerDetachSucceeded: detachResult.errors.length === 0,
    onnxMainThreadFallbackPending: fallbackPending,
    onnxMainThreadFallbackActive: false,
    onnxMainThreadFallbackError: null
  });
  if (!fallbackPending) return;

  const fallbackPromise = Promise.resolve()
    .then(() => activateMainThreadFallback.call(lazyRuntime))
    .then(() => {
      updateCapabilities(rootRef, {
        onnxMainThreadFallbackPending: false,
        onnxMainThreadFallbackActive: true,
        onnxMainThreadFallbackError: null
      });
      return true;
    }, (error) => {
      updateCapabilities(rootRef, {
        onnxMainThreadFallbackPending: false,
        onnxMainThreadFallbackActive: false,
        onnxMainThreadFallbackError: error instanceof Error ? error.message : String(error)
      });
      return false;
    });
  rootRef.__CARD_REVERSI_ONNX_MAIN_THREAD_FALLBACK__ = fallbackPromise;
}
