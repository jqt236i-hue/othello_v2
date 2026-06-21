export type CpuRuntimeWiringDeps = {
  requireModule: (id: string) => any;
  timerService: any;
  runtimeResolvers: any;
  readCpuSmartnessValueFromSelect: (id: string) => any;
  getPlaybackStateModuleForReset: () => any;
  registerUIGlobals: (globals: Record<string, any>) => any;
};

export function installCpuRuntimeWiring(deps: CpuRuntimeWiringDeps): { registeredGlobals: Record<string, any> } {
  const cpu = deps.requireModule('../game/cpu-turn-handler');
  let cpuDecision: any = null;
  try { cpuDecision = deps.requireModule('../game/cpu-decision'); } catch (e: any) { /* ignore */ }
  let moveGenerator: any = null;
  try { moveGenerator = deps.requireModule('../game/move-generator'); } catch (e: any) { /* ignore */ }

  const createGlobalFunctionDelegate = (name: string, fallback?: any) => {
    const capturedGlobal = (() => {
      try {
        return typeof globalThis !== 'undefined' && typeof (globalThis as any)[name] === 'function'
          ? (globalThis as any)[name]
          : null;
      } catch (e: any) {
        return null;
      }
    })();
    const delegate = (...args: any[]) => {
      try {
        const current = typeof globalThis !== 'undefined' ? (globalThis as any)[name] : null;
        if (typeof current === 'function' && current !== delegate) {
          return current(...args);
        }
      } catch (e: any) { /* fall back below */ }
      if (typeof capturedGlobal === 'function') return capturedGlobal(...args);
      if (typeof fallback === 'function') return fallback(...args);
      return undefined;
    };
    return delegate;
  };

  const cpuGlobals: Record<string, any> = {};
  if (cpu && typeof cpu.processCpuTurn === 'function') cpuGlobals.processCpuTurn = cpu.processCpuTurn;
  if (cpu && typeof cpu.processAutoBlackTurn === 'function') cpuGlobals.processAutoBlackTurn = cpu.processAutoBlackTurn;
  if (cpuDecision && typeof cpuDecision.selectMoveFromOnnxPolicyAsync === 'function') {
    cpuGlobals.selectMoveFromOnnxPolicyAsync = cpuDecision.selectMoveFromOnnxPolicyAsync;
  }
  if (cpuDecision && typeof cpuDecision.selectCpuMoveWithPolicy === 'function') {
    cpuGlobals.selectCpuMoveWithPolicy = cpuDecision.selectCpuMoveWithPolicy;
  }
  if (moveGenerator && typeof moveGenerator.generateMovesForPlayer === 'function') {
    cpuGlobals.generateMovesForPlayer = createGlobalFunctionDelegate(
      'generateMovesForPlayer',
      moveGenerator.generateMovesForPlayer
    );
  }
  cpuGlobals.executeMove = createGlobalFunctionDelegate('executeMove');
  cpuGlobals.processPassTurn = createGlobalFunctionDelegate('processPassTurn');
  if (!cpu) return { registeredGlobals: cpuGlobals };

  if (typeof cpu.setCpuTurnTimerService === 'function') {
    cpu.setCpuTurnTimerService(deps.timerService || null);
  }
  if (typeof cpu.setCpuUIImpl === 'function') {
    const runtimeResolvers = deps.runtimeResolvers || {};
    cpu.setCpuUIImpl({
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
