export type CpuRuntimeWiringDeps = {
  requireModule: (id: string) => any;
  timerService: any;
  runtimeResolvers: any;
  readCpuSmartnessValueFromSelect: (id: string) => any;
  getPlaybackStateModuleForReset: () => any;
  registerUIGlobals: (globals: Record<string, any>) => any;
  scoreCandidatesInWorker?: (request: any, options?: { signal?: AbortSignal | null }) => Promise<any>;
  isCpuCandidateScoringAvailable?: () => boolean;
  searchCardQuiescenceInWorker?: (request: any, options?: { signal?: AbortSignal | null }) => Promise<any>;
  isCpuCardQuiescenceAvailable?: () => boolean;
  adviseLv10InWorker?: (request: any) => Promise<any>;
  adviseLv11InWorker?: (request: any) => Promise<any>;
  adviseLv12InWorker?: (request: any) => Promise<any>;
};

type RuntimeFunction = (...args: any[]) => any;
type CpuRuntimeGlobals = Record<string, any>;

const DELEGATED_CPU_RUNTIME_FUNCTIONS = [
  'executeMove',
  'processPassTurn'
] as const;

function readGlobalRuntimeFunction(name: string): RuntimeFunction | null {
  try {
    const candidate = typeof globalThis !== 'undefined' ? (globalThis as any)[name] : null;
    return typeof candidate === 'function' ? candidate : null;
  } catch (e: any) {
    return null;
  }
}

function createGlobalFunctionDelegate(name: string, fallback?: any): RuntimeFunction {
  const capturedGlobal = readGlobalRuntimeFunction(name);
  const delegate = (...args: any[]) => {
    const current = readGlobalRuntimeFunction(name);
    if (current && current !== delegate) {
      return current(...args);
    }
    if (capturedGlobal) return capturedGlobal(...args);
    if (typeof fallback === 'function') return fallback(...args);
    return undefined;
  };
  return delegate;
}

function registerDirectRuntimeFunction(target: CpuRuntimeGlobals, name: string, source: any): void {
  if (source && typeof source[name] === 'function') {
    target[name] = source[name];
  }
}

function registerCpuRuntimeGlobals(cpu: any, cpuDecision: any, moveGenerator: any): CpuRuntimeGlobals {
  const cpuGlobals: CpuRuntimeGlobals = {};
  registerDirectRuntimeFunction(cpuGlobals, 'processCpuTurn', cpu);
  registerDirectRuntimeFunction(cpuGlobals, 'processAutoBlackTurn', cpu);
  registerDirectRuntimeFunction(cpuGlobals, 'selectMoveFromOnnxPolicyAsync', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'prepareCpuTurnCardUsabilityAnalysis', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'prepareCpuCandidateScoringRequest', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'prepareCpuPlacementLookaheadRequest', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'prepareCardQuiescenceRequest', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'buildCardQuiescenceSnapshotFromBestMove', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'shouldBuildCardQuiescenceSnapshot', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'selectCpuMoveWithPolicy', cpuDecision);
  registerDirectRuntimeFunction(cpuGlobals, 'resolveCpuDecisionLevelForPlayer', cpuDecision);

  if (moveGenerator && typeof moveGenerator.generateMovesForPlayer === 'function') {
    cpuGlobals.generateMovesForPlayer = createGlobalFunctionDelegate(
      'generateMovesForPlayer',
      moveGenerator.generateMovesForPlayer
    );
  }
  DELEGATED_CPU_RUNTIME_FUNCTIONS.forEach((name) => {
    cpuGlobals[name] = createGlobalFunctionDelegate(name);
  });
  return cpuGlobals;
}

export function installCpuRuntimeWiring(deps: CpuRuntimeWiringDeps): { registeredGlobals: Record<string, any> } {
  const cpu = deps.requireModule('../game/cpu-turn-handler');
  let cpuDecision: any = null;
  try { cpuDecision = deps.requireModule('../game/cpu-decision'); } catch (e: any) { /* ignore */ }
  let moveGenerator: any = null;
  try { moveGenerator = deps.requireModule('../game/move-generator'); } catch (e: any) { /* ignore */ }
  let networkClient: any = null;
  try { networkClient = deps.requireModule('../ui/network-client'); } catch (e: any) { /* ignore */ }
  let perfBenchmarks: any = null;
  try { perfBenchmarks = deps.requireModule('../ui/perf-benchmarks'); } catch (e: any) { /* ignore */ }
  let cardRuntimeIntegrity: any = null;
  try { cardRuntimeIntegrity = deps.requireModule('../ui/card-runtime-integrity'); } catch (e: any) { /* ignore */ }

  const cpuGlobals = registerCpuRuntimeGlobals(cpu, cpuDecision, moveGenerator);
  if (!cpu) return { registeredGlobals: cpuGlobals };

  if (typeof cpu.setCpuTurnTimerService === 'function') {
    cpu.setCpuTurnTimerService(deps.timerService || null);
  }
  if (typeof cpu.setCpuUIImpl === 'function') {
    const runtimeResolvers = deps.runtimeResolvers || {};
    const perfEnabled = !!(
      perfBenchmarks
      && typeof perfBenchmarks.isPerfBenchEnabled === 'function'
      && perfBenchmarks.isPerfBenchEnabled() === true
    );
    const recordCpuTurnStage = perfEnabled && typeof perfBenchmarks.getCpuTurnPerformanceRecorder === 'function'
      ? perfBenchmarks.getCpuTurnPerformanceRecorder()
      : null;
    const createCpuTurnPerformanceCorrelationId = perfEnabled
      && typeof perfBenchmarks.createCpuTurnPerformanceCorrelationId === 'function'
      ? perfBenchmarks.createCpuTurnPerformanceCorrelationId
      : null;
    const scoreCandidatesInWorker = typeof deps.scoreCandidatesInWorker === 'function'
      ? (perfEnabled && typeof perfBenchmarks.recordCpuTurnRuntimeEvidence === 'function'
          ? (...args: any[]) => {
              perfBenchmarks.recordCpuTurnRuntimeEvidence('worker-candidate-scoring');
              return deps.scoreCandidatesInWorker!(args[0], args[1]);
            }
          : deps.scoreCandidatesInWorker)
      : undefined;
    const searchCardQuiescenceInWorker = typeof deps.searchCardQuiescenceInWorker === 'function'
      ? (perfEnabled && typeof perfBenchmarks.recordCpuTurnRuntimeEvidence === 'function'
          ? (...args: any[]) => {
              perfBenchmarks.recordCpuTurnRuntimeEvidence('worker-card-quiescence');
              return deps.searchCardQuiescenceInWorker!(args[0], args[1]);
            }
          : deps.searchCardQuiescenceInWorker)
      : undefined;
    cpu.setCpuUIImpl({
      ...(typeof recordCpuTurnStage === 'function' ? { recordCpuTurnStage } : {}),
      ...(typeof createCpuTurnPerformanceCorrelationId === 'function' ? { createCpuTurnPerformanceCorrelationId } : {}),
      ...(typeof recordCpuTurnStage === 'function' ? {
        readCpuTurnPerformanceNowMs: () => {
          try {
            return typeof performance !== 'undefined' && typeof performance.now === 'function'
              ? performance.now()
              : Number.NaN;
          } catch (e: any) {
            return Number.NaN;
          }
        }
      } : {}),
      readMatchMode: runtimeResolvers.readMatchMode,
      readHumanVsHumanMode: runtimeResolvers.readHumanVsHumanMode,
      readQuerySearch: runtimeResolvers.readQuerySearch,
      isDebugLogAvailable: runtimeResolvers.isDebugLogAvailable,
      debugLog: runtimeResolvers.debugLog,
      readCpuSmartness: () => ({
        black: deps.readCpuSmartnessValueFromSelect('smartBlack'),
        white: deps.readCpuSmartnessValueFromSelect('smartWhite')
      }),
      resolveRuntimeFunction: runtimeResolvers.resolveRuntimeFunction,
      resolveRuntimeValue: runtimeResolvers.resolveRuntimeValue,
      readCpuStateVersion: () => {
        try {
          if (!networkClient || typeof networkClient.getStateVersion !== 'function') return null;
          if (typeof networkClient.isActive === 'function' && networkClient.isActive() !== true) return null;
          return networkClient.getStateVersion();
        } catch (e: any) {
          return null;
        }
      },
      scoreCandidatesInWorker,
      adviseLv10InWorker: deps.adviseLv10InWorker,
      adviseLv11InWorker: deps.adviseLv11InWorker,
      adviseLv12InWorker: deps.adviseLv12InWorker,
      isCpuCandidateScoringAvailable: typeof deps.isCpuCandidateScoringAvailable === 'function'
        ? deps.isCpuCandidateScoringAvailable
        : () => typeof deps.scoreCandidatesInWorker === 'function',
      searchCardQuiescenceInWorker,
      isCpuCardQuiescenceAvailable: typeof deps.isCpuCardQuiescenceAvailable === 'function'
        ? deps.isCpuCardQuiescenceAvailable
        : () => typeof deps.searchCardQuiescenceInWorker === 'function',
      disableSynchronousCardQuiescenceFallback: true,
      handleCardRuntimeIntegrityFailure: (error: unknown, source: string) => {
        if (cardRuntimeIntegrity && typeof cardRuntimeIntegrity.latchCardRuntimeIntegrityFailure === 'function') {
          return cardRuntimeIntegrity.latchCardRuntimeIntegrityFailure(error, { source });
        }
        return false;
      },
      isCardRuntimeIntegrityBlocked: () => {
        if (!cardRuntimeIntegrity || typeof cardRuntimeIntegrity.isCardRuntimeIntegrityBlocked !== 'function') {
          return false;
        }
        try { return cardRuntimeIntegrity.isCardRuntimeIntegrityBlocked() === true; } catch (_error) { return true; }
      },
      readProcessing: () => {
        try {
          const playbackState = deps.getPlaybackStateModuleForReset();
          if (playbackState && typeof playbackState.getProcessing === 'function') {
            return playbackState.getProcessing() === true;
          }
        } catch (e: any) { /* ignore */ }
        try {
          return typeof globalThis !== 'undefined' && (globalThis as any).isProcessing === true;
        } catch (e: any) {
          return false;
        }
      },
      readAnimationBusy: () => {
        try {
          const playbackState = deps.getPlaybackStateModuleForReset();
          if (playbackState && typeof playbackState.getCardAnimating === 'function' && playbackState.getCardAnimating() === true) {
            return true;
          }
          if (playbackState && typeof playbackState.getPlaybackActive === 'function' && playbackState.getPlaybackActive() === true) {
            return true;
          }
        } catch (e: any) { /* ignore */ }
        try {
          if (typeof globalThis !== 'undefined') {
            return (globalThis as any).isCardAnimating === true
              || (globalThis as any).VisualPlaybackActive === true;
          }
        } catch (e: any) { /* ignore */ }
        return false;
      },
      readBenchFastMode: () => {
        try {
          return typeof globalThis !== 'undefined' && (globalThis as any).__BENCH_FAST_MODE === true;
        } catch (e: any) {
          return false;
        }
      },
      getCpuLv6SharedProfile: () => {
        try {
          return typeof globalThis !== 'undefined' ? (globalThis as any).CPU_LV6_SHARED_PROFILE : null;
        } catch (e: any) {
          return null;
        }
      },
      readCpuLv6MinThinkMs: () => {
        try {
          return typeof globalThis !== 'undefined' ? (globalThis as any).CPU_LV6_MIN_THINK_MS : undefined;
        } catch (e: any) {
          return undefined;
        }
      },
      getCpuCardLogic: () => {
        try {
          const cardLogic = deps.requireModule('../game/logic/cards');
          if (cardLogic) return cardLogic;
        } catch (e: any) { /* ignore */ }
        try {
          return typeof globalThis !== 'undefined' ? (globalThis as any).CardLogic : null;
        } catch (e: any) {
          return null;
        }
      },
      TurnPipelineUIAdapter: (() => {
        try {
          return deps.requireModule('../game/turn/pipeline_ui_adapter');
        } catch (e: any) {
          return undefined;
        }
      })(),
      TurnPipeline: (() => {
        try {
          return deps.requireModule('../game/turn/turn_pipeline');
        } catch (e: any) {
          return undefined;
        }
      })(),
      resolveExecuteMove: () => {
        try {
          return typeof globalThis !== 'undefined' && typeof (globalThis as any).executeMove === 'function'
            ? (globalThis as any).executeMove
            : null;
        } catch (e: any) {
          return null;
        }
      },
      resolveProcessPassTurn: () => {
        try {
          return typeof globalThis !== 'undefined' && typeof (globalThis as any).processPassTurn === 'function'
            ? (globalThis as any).processPassTurn
            : null;
        } catch (e: any) {
          return null;
        }
      },
      setProcessing: (next: boolean) => {
        try {
          const playbackState = deps.getPlaybackStateModuleForReset();
          if (playbackState && typeof playbackState.setBusyState === 'function') {
            playbackState.setBusyState({ processing: next === true });
          } else if (playbackState && typeof playbackState.setProcessing === 'function') {
            playbackState.setProcessing(next === true);
          }
        } catch (e: any) { /* ignore */ }
        try {
          if (typeof globalThis !== 'undefined') {
            (globalThis as any).isProcessing = next === true;
          }
        } catch (e: any) { /* ignore */ }
      },
      applyRuntimeStatePatch: (nextCardState: any, nextGameState: any) => {
        try {
          if (nextCardState && typeof globalThis !== 'undefined') {
            (globalThis as any).cardState = nextCardState;
          }
          if (nextGameState && typeof globalThis !== 'undefined') {
            (globalThis as any).gameState = nextGameState;
          }
        } catch (e: any) { /* ignore */ }
      },
      emitLogAdded: (message: any, kind?: any) => {
        try {
          const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitLogAdded : null;
          if (typeof fn !== 'function') return false;
          if (typeof kind === 'undefined') fn(message);
          else fn(message, kind);
          return true;
        } catch (e: any) {
          return false;
        }
      },
      getCommentaryRuntimeRoot: () => {
        try {
          return typeof globalThis !== 'undefined' ? globalThis : null;
        } catch (e: any) {
          return null;
        }
      }
    });
  }

  return { registeredGlobals: cpuGlobals };
}

module.exports = {
  installCpuRuntimeWiring
};
