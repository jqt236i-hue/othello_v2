import CpuWorkerConstructor from './worker-entry?worker';
import Lv10WorkerConstructor from './lv10-worker-entry?worker';
import Lv11WorkerConstructor from './lv11-worker-entry?worker';
import Lv12WorkerConstructor from './lv12-worker-entry?worker';
import Lv13WorkerConstructor from './lv13-worker-entry?worker';
import {
  CpuWorkerClientError,
  createCpuCardQuiescenceWorkerSearcher,
  createCpuCandidateWorkerScorer,
  createCpuWorkerClient,
  type CpuWorkerClient
} from './client';
import { detachOnnxWorkerExecutor } from './main-thread-fallback';
import { CPU_WORKER_OPERATIONS } from './protocol';
import { parseLv10AdvisorResult, type Lv10AdvisorRequest } from '../../game/ai/cpu-lv10-advisor-contract';
import type { Lv10SearchResult } from '../../game/ai/cpu-lv10-search';

type RuntimeRoot = Window & Record<string, any>;


const bridges = new WeakMap<object, BrowserCpuWorkerBridge>();
const permanentlyDisabledRoots = new WeakSet<object>();

export interface BrowserCpuWorkerBridge {
  client: CpuWorkerClient;
  lv10Client: CpuWorkerClient;
  lv11Client: CpuWorkerClient;
  lv12Client: CpuWorkerClient;
  lv13Client: CpuWorkerClient;
  scoreCandidatesInWorker: ReturnType<typeof createCpuCandidateWorkerScorer>;
  searchCardQuiescenceInWorker: ReturnType<typeof createCpuCardQuiescenceWorkerSearcher>;
  adviseLv10InWorker: (request: Lv10AdvisorRequest) => Promise<Lv10SearchResult>;
  adviseLv11InWorker: (request: Lv10AdvisorRequest) => Promise<Lv10SearchResult>;
  adviseLv12InWorker: (request: Lv10AdvisorRequest) => Promise<Lv10SearchResult>;
  adviseLv13InWorker: (request: Lv10AdvisorRequest) => Promise<Lv10SearchResult>;
  /** Loads the advisor Worker for a Lv10+ match after boot; never searches. */
  warmUpAdvisor: (level: number) => void;
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
  if (existing
    && existing.client
    && typeof existing.scoreCandidatesInWorker === 'function'
    && typeof existing.searchCardQuiescenceInWorker === 'function') return existing;
  if (permanentlyDisabledRoots.has(rootRef)) return null;
  if (typeof rootRef.Worker !== 'function') return null;

  const client = createCpuWorkerClient({
    workerFactory: () => new CpuWorkerConstructor({ name: 'card-reversi-cpu' }) as unknown as Worker,
    defaultTimeoutMs: 15000
  });
  const rawScoreCandidatesInWorker = createCpuCandidateWorkerScorer({ client, timeoutMs: 48 });
  const lv10Client = createCpuWorkerClient({
    workerFactory: () => new Lv10WorkerConstructor({ name: 'card-reversi-lv10' }) as unknown as Worker,
    defaultTimeoutMs: 3000
  });
  const rawSearchCardQuiescenceInWorker = createCpuCardQuiescenceWorkerSearcher({ client, timeoutMs: 2500 });
  const lv11Client = createCpuWorkerClient({
    workerFactory: () => new Lv11WorkerConstructor({ name: 'card-reversi-lv11' }) as unknown as Worker,
    defaultTimeoutMs: 8000
  });
  const lv12Client = createCpuWorkerClient({
    workerFactory: () => new Lv12WorkerConstructor({ name: 'card-reversi-lv12' }) as unknown as Worker,
    defaultTimeoutMs: 8000
  });
  const lv13Client = createCpuWorkerClient({
    workerFactory: () => new Lv13WorkerConstructor({ name: 'card-reversi-lv13' }) as unknown as Worker,
    defaultTimeoutMs: 8000
  });
  // A cold advisor Worker spends part of the first CPU turn's deadline
  // loading its bundle. When a Lv10+ opponent is shown, load it ahead of that
  // turn, but only after boot so startup never creates a CPU Worker. Failures
  // are left to the advise request, which keeps its existing error handling.
  const warmedAdvisorLevels = new Set<number>();
  let pendingWarmUpLevel: number | null = null;
  const isBootReady = () => _documentRef?.documentElement?.getAttribute('data-browser-boot-state') === 'ready';
  const startWarmUp = (level: number) => {
    const advisor = level === 10 ? lv10Client : level === 11 ? lv11Client : level === 12 ? lv12Client : level === 13 ? lv13Client : null;
    if (!advisor || warmedAdvisorLevels.has(level)) return;
    warmedAdvisorLevels.add(level);
    void advisor.probe(level === 10 ? 3000 : 8000).catch(() => { warmedAdvisorLevels.delete(level); });
  };
  const warmUpAdvisor = (levelValue: number) => {
    const level = Math.floor(Number(levelValue));
    if (!(level >= 10 && level <= 13)) return;
    if (isBootReady()) { startWarmUp(level); return; }
    const alreadyWaiting = pendingWarmUpLevel !== null;
    pendingWarmUpLevel = level;
    if (alreadyWaiting || typeof rootRef.addEventListener !== 'function') return;
    rootRef.addEventListener('card-reversi:browser-ready', () => {
      const pending = pendingWarmUpLevel;
      pendingWarmUpLevel = null;
      if (pending !== null) startWarmUp(pending);
    }, { once: true });
  };
  const bridge: BrowserCpuWorkerBridge = {
    warmUpAdvisor,
    client,
    lv10Client,
    lv11Client,
    lv12Client,
    lv13Client,
    adviseLv11InWorker: async request => {
      try {
        return parseLv10AdvisorResult(await lv11Client.request(CPU_WORKER_OPERATIONS.LV11_ADVISE, request, {
          turnNumber: request.observation.gameState.turnNumber, timeoutMs: 8000
        }));
      } catch (error) {
        if (error instanceof CpuWorkerClientError && error.recoverable === false) {
          lv11Client.terminate('Lv11 Worker failed');
          updateCapabilities(rootRef, { cpuLv11AdvisorWorker: false });
        }
        throw error;
      }
    },
    adviseLv12InWorker: async request => {
      try {
        return parseLv10AdvisorResult(await lv12Client.request(CPU_WORKER_OPERATIONS.LV12_ADVISE, request, {
          turnNumber: request.observation.gameState.turnNumber, timeoutMs: 8000
        }));
      } catch (error) {
        if (error instanceof CpuWorkerClientError && error.recoverable === false) {
          lv12Client.terminate('Lv12 Worker failed');
          updateCapabilities(rootRef, { cpuLv12AdvisorWorker: false });
        }
        throw error;
      }
    },
    adviseLv13InWorker: async request => {
      try {
        return parseLv10AdvisorResult(await lv13Client.request(CPU_WORKER_OPERATIONS.LV13_ADVISE, request, {
          turnNumber: request.observation.gameState.turnNumber, timeoutMs: 8000
        }));
      } catch (error) {
        if (error instanceof CpuWorkerClientError && error.recoverable === false) {
          lv13Client.terminate('Lv13 Worker failed');
          updateCapabilities(rootRef, { cpuLv13AdvisorWorker: false });
        }
        throw error;
      }
    },
    adviseLv10InWorker: async (request) => {
      try {
        return parseLv10AdvisorResult(await lv10Client.request(CPU_WORKER_OPERATIONS.LV10_ADVISE, request, {
          turnNumber: request.observation.gameState.turnNumber, timeoutMs: 3000
        }));
      } catch (error) {
        if (error instanceof CpuWorkerClientError && error.recoverable === false) {
          lv10Client.terminate('Lv10 Worker failed');
          updateCapabilities(rootRef, { cpuLv10AdvisorWorker: false });
        }
        throw error;
      }
    },
    scoreCandidatesInWorker: async (request, options) => {
      try {
        return await rawScoreCandidatesInWorker(request, options);
      } catch (error) {
        if (error instanceof CpuWorkerClientError && error.recoverable === false) {
          disableCpuWorkerBridge(rootRef, bridge);
        }
        throw error;
      }
    },
    searchCardQuiescenceInWorker: async (request, options) => {
      try {
        return await rawSearchCardQuiescenceInWorker(request, options);
      } catch (error) {
        if (error instanceof CpuWorkerClientError && error.recoverable === false) {
          disableCpuWorkerBridge(rootRef, bridge);
        }
        throw error;
      }
    }
  };
  bridges.set(rootRef, bridge);
  rootRef.__CARD_REVERSI_WARM_CPU_ADVISOR__ = warmUpAdvisor;
  updateCapabilities(rootRef, {
    dedicatedCpuWorkerConfigured: true,
    cpuCandidateScoringWorker: true,
    cpuCardQuiescenceWorker: true,
    cpuLv10AdvisorWorker: true,
    cpuLv11AdvisorWorker: true,
    cpuLv12AdvisorWorker: true,
    cpuLv13AdvisorWorker: true
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
  // A failed ONNX/legacy Worker must not terminate the independent Lv10 client.
  // Keep the legacy bridge disabled, but retain only the Lv10 bootstrap injection.
  const lv10Advisor = target && typeof target.adviseLv10InWorker === 'function'
    && rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__?.cpuLv10AdvisorWorker !== false
    ? target.adviseLv10InWorker
    : null;
  const lv11Advisor = target && typeof target.adviseLv11InWorker === 'function'
    && rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__?.cpuLv11AdvisorWorker !== false
    ? target.adviseLv11InWorker : null;
  const lv12Advisor = target && typeof target.adviseLv12InWorker === 'function'
    && rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__?.cpuLv12AdvisorWorker !== false
    ? target.adviseLv12InWorker : null;
  const lv13Advisor = target && typeof target.adviseLv13InWorker === 'function'
    && rootRef.__CARD_REVERSI_BROWSER_CAPABILITIES__?.cpuLv13AdvisorWorker !== false
    ? target.adviseLv13InWorker : null;
  bridges.delete(rootRef);
  permanentlyDisabledRoots.add(rootRef);
  try {
    const bootstrap = rootRef.UIBootstrap;
    if (bootstrap && typeof bootstrap.configureCpuCandidateScoring === 'function') {
      bootstrap.configureCpuCandidateScoring(lv10Advisor || lv11Advisor || lv12Advisor || lv13Advisor ? {
        ...(lv10Advisor ? { adviseLv10InWorker: lv10Advisor } : {}),
        ...(lv11Advisor ? { adviseLv11InWorker: lv11Advisor } : {}),
        ...(lv12Advisor ? { adviseLv12InWorker: lv12Advisor } : {}),
        ...(lv13Advisor ? { adviseLv13InWorker: lv13Advisor } : {})
      } : null);
    }
  } catch (error) { /* local fallback remains available */ }
  const detachResult = detachOnnxWorkerExecutor(rootRef);
  const lazyRuntime = rootRef.LazyRuntimeLoaderModule;
  const activateMainThreadFallback = lazyRuntime && lazyRuntime.activateMainThreadOnnxFallback;
  const fallbackPending = detachResult.hadWorkerExecutor && typeof activateMainThreadFallback === 'function';
  updateCapabilities(rootRef, {
    dedicatedCpuWorkerConfigured: false,
    cpuCandidateScoringWorker: false,
    cpuCardQuiescenceWorker: false,
    cpuLv10AdvisorWorker: !!lv10Advisor,
    cpuLv11AdvisorWorker: !!lv11Advisor,
    cpuLv12AdvisorWorker: !!lv12Advisor,
    cpuLv13AdvisorWorker: !!lv13Advisor,
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
