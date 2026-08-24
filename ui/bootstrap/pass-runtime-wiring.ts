export type PassRuntimeWiringDeps = {
  requireModule: (id: string) => any;
  timerService: any;
  runtimeResolvers: any;
  getPlaybackStateModuleForReset: () => any;
  registerUIGlobals: (globals: Record<string, any>) => any;
};

function isNetworkMatchClientSpectator(client: any): boolean {
  try {
    return !!(client && typeof client.isSpectator === 'function' && client.isSpectator() === true);
  } catch (e: any) {
    return false;
  }
}

function createLazyProcessCpuTurn(runtimeResolvers: any): (...args: any[]) => any {
  return function processCpuTurnFromRuntime(...args: any[]): any {
    try {
      const candidate = runtimeResolvers && typeof runtimeResolvers.resolveRuntimeFunction === 'function'
        ? runtimeResolvers.resolveRuntimeFunction('processCpuTurn')
        : null;
      if (typeof candidate === 'function') return candidate(...args);
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any).processCpuTurn === 'function') {
        return (globalThis as any).processCpuTurn(...args);
      }
    } catch (e: any) { /* ignore */ }
    return undefined;
  };
}

function createLazyCpuDecisionLevelResolver(runtimeResolvers: any): (playerKey: any) => any {
  return function resolveCpuDecisionLevelFromRuntime(playerKey: any): any {
    try {
      const candidate = runtimeResolvers && typeof runtimeResolvers.resolveRuntimeFunction === 'function'
        ? runtimeResolvers.resolveRuntimeFunction('resolveCpuDecisionLevelForPlayer')
        : null;
      return typeof candidate === 'function' ? candidate(playerKey) : undefined;
    } catch (e: any) {
      return undefined;
    }
  };
}

export function installPassRuntimeWiring(deps: PassRuntimeWiringDeps): { registeredGlobals: Record<string, any> } {
  const passHandler = deps.requireModule('../game/pass-handler');
  let perfBenchmarks: any = null;
  try { perfBenchmarks = deps.requireModule('../ui/perf-benchmarks'); } catch (e: any) { /* ignore */ }
  let cardRuntimeIntegrity: any = null;
  try { cardRuntimeIntegrity = deps.requireModule('../ui/card-runtime-integrity'); } catch (e: any) { /* ignore */ }
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
  const passGlobals: Record<string, any> = {};
  if (passHandler && typeof passHandler.processPassTurn === 'function') passGlobals.processPassTurn = passHandler.processPassTurn;
  if (passHandler && typeof passHandler.ensureCurrentPlayerCanActOrPass === 'function') {
    passGlobals.ensureCurrentPlayerCanActOrPass = passHandler.ensureCurrentPlayerCanActOrPass;
  }
  let showAutoPassNoticeFn: any = null;
  try {
    const feedbackEvents = deps.requireModule('./animation-feedback-events');
    if (feedbackEvents && typeof feedbackEvents.showAutoPassNotice === 'function') {
      showAutoPassNoticeFn = feedbackEvents.showAutoPassNotice;
      passGlobals.showAutoPassNotice = showAutoPassNoticeFn;
    }
  } catch (e: any) { /* ignore */ }
  if (!passHandler) return { registeredGlobals: passGlobals };

  if (typeof passHandler.setPassHandlerTimerService === 'function') {
    passHandler.setPassHandlerTimerService(deps.timerService || null);
  }
  try {
    if (typeof passHandler.setPassHandlerRuntime === 'function') {
      const runtimeResolvers = deps.runtimeResolvers || {};
      passHandler.setPassHandlerRuntime({
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
        processCpuTurn: createLazyProcessCpuTurn(runtimeResolvers),
        resolveCpuDecisionLevelForPlayer: createLazyCpuDecisionLevelResolver(runtimeResolvers),
        readExplicitCpuTurnDelayMs: () => {
          try {
            return typeof runtimeResolvers.readExplicitCpuTurnDelayMs === 'function'
              ? runtimeResolvers.readExplicitCpuTurnDelayMs()
              : null;
          } catch (e: any) {
            return null;
          }
        },
        readMatchMode: runtimeResolvers.readMatchMode,
        readHumanVsHumanMode: runtimeResolvers.readHumanVsHumanMode,
        isCardRuntimeIntegrityBlocked: () => cardRuntimeIntegrity
          && typeof cardRuntimeIntegrity.isCardRuntimeIntegrityBlocked === 'function'
          && cardRuntimeIntegrity.isCardRuntimeIntegrityBlocked() === true,
        handleCardRuntimeIntegrityFailure: (error: unknown, source: string) => cardRuntimeIntegrity
          && typeof cardRuntimeIntegrity.latchCardRuntimeIntegrityFailure === 'function'
          && cardRuntimeIntegrity.latchCardRuntimeIntegrityFailure(error, { source }),
        readNetworkSeatKey: () => {
          try {
            if (typeof globalThis === 'undefined') return null;
            const root = globalThis as any;
            const client = root.NetworkMatchClient;
            if (client && typeof client.getSeatKey === 'function') {
              const seatKey = client.getSeatKey();
              if (seatKey === 'black' || seatKey === 'white') return seatKey;
            }
            if (root.LOCAL_PLAYER_KEY === 'black' || root.LOCAL_PLAYER_KEY === 'white') return root.LOCAL_PLAYER_KEY;
            if (root.__LOCAL_PLAYER_KEY === 'black' || root.__LOCAL_PLAYER_KEY === 'white') return root.__LOCAL_PLAYER_KEY;
            if (root.BOARD_VIEWER_KEY === 'black' || root.BOARD_VIEWER_KEY === 'white') return root.BOARD_VIEWER_KEY;
          } catch (e: any) { /* ignore */ }
          return null;
        },
        resolveRuntimeFunction: runtimeResolvers.resolveRuntimeFunction,
        showResult: () => {
          try {
            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).showResult : null;
            if (typeof fn !== 'function') return false;
            fn();
            return true;
          } catch (e: any) {
            return false;
          }
        },
        showAutoPassNotice: (notice: any) => {
          try {
            const fn = showAutoPassNoticeFn
              || (typeof globalThis !== 'undefined' ? (globalThis as any).showAutoPassNotice : null);
            if (typeof fn !== 'function') return false;
            fn(notice);
            return true;
          } catch (e: any) {
            return false;
          }
        },
        getActionManager: () => {
          try {
            return typeof globalThis !== 'undefined' ? (globalThis as any).ActionManager : null;
          } catch (e: any) {
            return null;
          }
        },
        getNetworkTurnHandoff: () => {
          try {
            return typeof globalThis !== 'undefined' ? (globalThis as any).NetworkTurnHandoff : null;
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
        publishSnapshot: (meta: any) => {
          try {
            if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return undefined;
            const client = (globalThis as any).NetworkMatchClient;
            if (typeof client.publishSnapshot !== 'function') return undefined;
            if (typeof client.isActive === 'function' && client.isActive() !== true) return undefined;
            if (isNetworkMatchClientSpectator(client)) return undefined;
            return client.publishSnapshot(meta);
          } catch (e: any) {
            return undefined;
          }
        },
        emitBoardUpdate: () => {
          try {
            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitBoardUpdate : null;
            if (typeof fn !== 'function') return false;
            return fn() === true;
          } catch (e: any) {
            return false;
          }
        },
        emitGameStateChange: () => {
          try {
            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitGameStateChange : null;
            if (typeof fn !== 'function') return false;
            return fn() === true;
          } catch (e: any) {
            return false;
          }
        },
        emitLogAdded: (message: any, kind?: any) => {
          try {
            const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitLogAdded : null;
            if (typeof fn !== 'function') return false;
            fn(message, kind);
            return true;
          } catch (e: any) {
            return false;
          }
        }
      });
    }
  } catch (e: any) { /* ignore */ }

  return { registeredGlobals: passGlobals };
}

module.exports = {
  installPassRuntimeWiring
};
