/**
 * @file init-game.ts
 * @description ゲーム初期化（公開APIのみ）
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

declare const loadCpuPolicy: (() => void) | undefined;
declare const CpuPolicy: {
  loadPolicyForLevel?: (level: number) => Promise<unknown>;
} | undefined;
declare const initPolicyOnnxModel: (() => Promise<void>) | undefined;
declare const initPolicyTableModel: (() => Promise<void>) | undefined;
declare const initOthelloPolicyTableModel: (() => Promise<void>) | undefined;
declare const initLvMaxModels: (() => void) | undefined;
declare const loadLvMaxModels: (() => void) | undefined;
declare const resetGame: ((options?: any) => void) | undefined;
declare const initWorkVisualsHelpers: (() => void) | undefined;
declare const initWorkVisualDiagnosticsAuto: (() => void) | undefined;

function shouldEagerLoadCpuPolicyOnBoot(): boolean {
  try {
    if (typeof window !== 'undefined' && (window as any).CARD_REVERSI_EAGER_CPU_POLICY_BOOT === true) return true;
  } catch (e) { /* ignore */ }
  try {
    const search = (typeof location !== 'undefined' && location && typeof location.search === 'string') ? location.search : '';
    return /[?&]eagerCpuPolicy=1\b/i.test(search) || /[?&]eagerCpuPolicy=true\b/i.test(search);
  } catch (e) { /* ignore */ }
  return false;
}

async function initGameSystems(): Promise<void> {
  if (shouldEagerLoadCpuPolicyOnBoot()) {
    if (typeof loadCpuPolicy === 'function' && typeof CpuPolicy !== 'undefined' && CpuPolicy && typeof CpuPolicy.loadPolicyForLevel === 'function') {
      loadCpuPolicy();
    }
    if (typeof initPolicyOnnxModel === 'function') {
      await initPolicyOnnxModel();
    }
    if (typeof initPolicyTableModel === 'function') {
      await initPolicyTableModel();
    }
    if (typeof initOthelloPolicyTableModel === 'function') {
      await initOthelloPolicyTableModel();
    }
    if (typeof initLvMaxModels === 'function' && typeof loadLvMaxModels === 'function') {
      initLvMaxModels();
    }
  }
  try {
    if (typeof resetGame === 'function') resetGame({ skipNetworkPublish: true, source: 'bootstrap_init' });
  } catch (e: unknown) {
    const err = e as Error;
    console.error('[init] resetGame threw', err && err.message);
  }

  try {
    if (typeof initWorkVisualsHelpers === 'function') initWorkVisualsHelpers();
    if (typeof initWorkVisualDiagnosticsAuto === 'function') initWorkVisualDiagnosticsAuto();
  } catch (e) { /* defensive */ }
}

function readPlaybackFlag(getPlaybackStateModule: () => any, getterName: string, legacyKey: string): boolean {
  try {
    const playbackState = getPlaybackStateModule();
    if (playbackState && typeof playbackState[getterName] === 'function') {
      return playbackState[getterName]() === true;
    }
    if (playbackState && typeof playbackState[legacyKey] !== 'undefined') {
      return playbackState[legacyKey] === true;
    }
  } catch (e) { /* ignore */ }
  try {
    return typeof globalThis !== 'undefined' && (globalThis as any)[legacyKey] === true;
  } catch (e) {
    return false;
  }
}

function publishSnapshotFromNetworkClient(meta: any, isNetworkMatchClientSpectator: (client: any) => boolean): any {
  try {
    if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return undefined;
    const client = (globalThis as any).NetworkMatchClient;
    if (typeof client.publishSnapshot !== 'function') return undefined;
    if (typeof client.isActive === 'function' && client.isActive() !== true) return undefined;
    if (isNetworkMatchClientSpectator(client)) return undefined;
    return client.publishSnapshot(meta);
  } catch (e) {
    return undefined;
  }
}

function installMoveExecutorRuntime(deps: any): void {
  const cfg = (deps && typeof deps === 'object') ? deps : {};
  const timersImpl = cfg.timersImpl || {};
  const timerService = cfg.timerService || null;
  const runtimeResolvers = cfg.runtimeResolvers || {};
  const requireModule = typeof cfg.requireModule === 'function' ? cfg.requireModule : _require;
  let perfBenchmarks: any = null;
  try { perfBenchmarks = requireModule('../ui/perf-benchmarks'); } catch (e) { /* ignore */ }
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
  const getPlaybackStateModule = typeof cfg.getPlaybackStateModuleForReset === 'function'
    ? cfg.getPlaybackStateModuleForReset
    : () => null;
  const isNetworkMatchClientSpectator = typeof cfg.isNetworkMatchClientSpectator === 'function'
    ? cfg.isNetworkMatchClientSpectator
    : () => false;
  const connectUIRuntime = typeof cfg.connectUIRuntime === 'function'
    ? cfg.connectUIRuntime
    : null;

  if (connectUIRuntime) {
    connectUIRuntime('./move-executor-visuals', '../game/move-executor-visuals', (uiMod: any) => ({
      applyFlipAnimations: uiMod.applyFlipAnimations,
      setDiscColorAt: uiMod.setDiscColorAt,
      removeBombOverlayAt: uiMod.removeBombOverlayAt,
      clearAllStoneVisualEffectsAt: uiMod.clearAllStoneVisualEffectsAt,
      syncDiscVisualToCurrentState: uiMod.syncDiscVisualToCurrentState,
      getFlipAnimMs: uiMod.getFlipAnimMs,
      getPhaseGapMs: uiMod.getPhaseGapMs,
      getTurnTransitionGapMs: uiMod.getTurnTransitionGapMs,
      animateFlipsWithDeferredColor: uiMod.animateFlipsWithDeferredColor,
      animateRegenBack: uiMod.animateRegenBack,
      animateFadeOutAt: uiMod.animateFadeOutAt,
      animateDestroyAt: uiMod.animateDestroyAt,
      animateHyperactiveMove: uiMod.animateHyperactiveMove,
      animateHyperactiveMoveChain: uiMod.animateHyperactiveMoveChain,
      hasPlaybackEngine: uiMod.hasPlaybackEngine,
      applyPendingSpecialstoneVisual: uiMod.applyPendingSpecialstoneVisual,
      runMoveVisualSequence: uiMod.runMoveVisualSequence
    }), timersImpl);

    connectUIRuntime('./move-executor-visuals', '../game/move-executor', (uiMod: any, timers: any) => ({
      ...(typeof recordCpuTurnStage === 'function' ? { recordCpuTurnStage } : {}),
      ...(typeof createCpuTurnPerformanceCorrelationId === 'function' ? { createCpuTurnPerformanceCorrelationId } : {}),
      ...(typeof recordCpuTurnStage === 'function' ? {
        readCpuTurnPerformanceNowMs: () => {
          try {
            return typeof performance !== 'undefined' && typeof performance.now === 'function'
              ? performance.now()
              : Number.NaN;
          } catch (e) {
            return Number.NaN;
          }
        }
      } : {}),
      scheduleCpuTurn: (ms: any, cb: any) => { return timers.waitMs(ms || 0).then(cb); },
      processCpuTurn: (() => {
        try {
          const cpu = requireModule('../game/cpu-turn-handler');
          return cpu && typeof cpu.processCpuTurn === 'function' ? cpu.processCpuTurn : null;
        } catch (e) {
          return null;
        }
      })(),
      readMatchMode: runtimeResolvers.readMatchMode,
      readHumanVsHumanMode: runtimeResolvers.readHumanVsHumanMode,
      setProcessing: (next: boolean) => {
        try {
          const playbackState = getPlaybackStateModule();
          if (playbackState && typeof playbackState.setBusyState === 'function') {
            playbackState.setBusyState({ processing: next === true });
          } else if (playbackState && typeof playbackState.setProcessing === 'function') {
            playbackState.setProcessing(next === true);
          }
        } catch (e) { /* ignore */ }
        try {
          if (typeof globalThis !== 'undefined') {
            (globalThis as any).isProcessing = next === true;
          }
        } catch (e) { /* ignore */ }
      },
      readProcessing: () => readPlaybackFlag(getPlaybackStateModule, 'getProcessing', 'isProcessing'),
      readCardAnimating: () => readPlaybackFlag(getPlaybackStateModule, 'getCardAnimating', 'isCardAnimating'),
      writeRuntimeValue: (key: string, value: any) => {
        try {
          if (typeof globalThis !== 'undefined') {
            (globalThis as any)[key] = value;
          }
        } catch (e) { /* ignore */ }
      },
      applyCardStateSnapshot: (snapshot: any) => {
        try {
          if (!snapshot) return false;
          if (typeof globalThis !== 'undefined' && typeof (globalThis as any).applyCardStateSnapshot === 'function') {
            (globalThis as any).applyCardStateSnapshot(snapshot);
            return true;
          }
          if (typeof globalThis !== 'undefined' && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object') {
            const cardStateRef = (globalThis as any).cardState;
            for (const key in cardStateRef) delete cardStateRef[key];
            Object.assign(cardStateRef, snapshot);
            return true;
          }
        } catch (e) { /* ignore */ }
        return false;
      },
      setCardState: (nextCardState: any) => {
        try {
          if (typeof globalThis === 'undefined') return false;
          (globalThis as any).cardState = nextCardState;
          return true;
        } catch (e) {
          return false;
        }
      },
      getPlaybackStateManager: () => getPlaybackStateModule(),
      getTurnPipelineUIAdapter: () => {
        try {
          return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipelineUIAdapter : null;
        } catch (e) {
          return null;
        }
      },
      getTurnPipeline: () => {
        try {
          return typeof globalThis !== 'undefined' ? (globalThis as any).TurnPipeline : null;
        } catch (e) {
          return null;
        }
      },
      getNetworkTurnHandoff: () => {
        try {
          return typeof globalThis !== 'undefined' ? (globalThis as any).NetworkTurnHandoff : null;
        } catch (e) {
          return null;
        }
      },
      getLocalPlayerKey: () => {
        try {
          if (typeof globalThis === 'undefined') return null;
          return (globalThis as any).LOCAL_PLAYER_KEY
            || (globalThis as any).__LOCAL_PLAYER_KEY
            || (globalThis as any).BOARD_VIEWER_KEY
            || null;
        } catch (e) {
          return null;
        }
      },
      getActionManager: () => {
        try {
          return typeof globalThis !== 'undefined' ? (globalThis as any).ActionManager : null;
        } catch (e) {
          return null;
        }
      },
      emitBoardUpdate: () => {
        try {
          const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitBoardUpdate : null;
          if (typeof fn !== 'function') return false;
          return fn() === true;
        } catch (e) {
          return false;
        }
      },
      emitCardStateChange: () => {
        try {
          const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitCardStateChange : null;
          if (typeof fn !== 'function') return false;
          return fn() === true;
        } catch (e) {
          return false;
        }
      },
      emitGameStateChange: () => {
        try {
          const fn = typeof globalThis !== 'undefined' ? (globalThis as any).emitGameStateChange : null;
          if (typeof fn !== 'function') return false;
          return fn() === true;
        } catch (e) {
          return false;
        }
      },
      syncVisibleChargeDisplaysNow: () => {
        try {
          const fn = typeof globalThis !== 'undefined'
            ? ((globalThis as any).syncVisibleChargeDisplaysNow || (globalThis as any).renderVisibleChargeDisplays)
            : null;
          if (typeof fn !== 'function') return false;
          return fn() === true;
        } catch (e) {
          return false;
        }
      },
      now: () => Date.now(),
      waitForPlayback: uiMod.waitForPlaybackIdle,
      publishSnapshot: (meta: any) => publishSnapshotFromNetworkClient(meta, isNetworkMatchClientSpectator),
      isNetworkPublishActive: () => {
        try {
          if (typeof globalThis === 'undefined' || !(globalThis as any).NetworkMatchClient) return false;
          const client = (globalThis as any).NetworkMatchClient;
          if (typeof client.publishSnapshot !== 'function') return false;
          if (isNetworkMatchClientSpectator(client)) return false;
          if (typeof client.isActive === 'function') return client.isActive() === true;
          return true;
        } catch (e) {
          return false;
        }
      },
      emitPresentationEvent: (ev: any) => {
        try {
          if (typeof globalThis === 'undefined') return false;
          const cardStateRef = ((globalThis as any).cardState && typeof (globalThis as any).cardState === 'object')
            ? (globalThis as any).cardState
            : null;
          const boardOps = ((globalThis as any).BoardOps && typeof (globalThis as any).BoardOps.emitPresentationEvent === 'function')
            ? (globalThis as any).BoardOps
            : null;
          if (!cardStateRef || !boardOps) return false;
          boardOps.emitPresentationEvent(cardStateRef, ev);
          return true;
        } catch (e) {
          return false;
        }
      },
      isDebugLogAvailable: () => (typeof cfg.isDebugSessionEnabled === 'function' ? cfg.isDebugSessionEnabled() === true : false)
    }), timersImpl);
  }

  try {
    const moveExecutor = requireModule('../game/move-executor');
    if (moveExecutor && typeof moveExecutor.executeMove === 'function' && typeof globalThis !== 'undefined') {
      (globalThis as any).executeMove = moveExecutor.executeMove;
    }
    if (moveExecutor && typeof moveExecutor.setMoveExecutorTimerService === 'function') {
      moveExecutor.setMoveExecutorTimerService(timerService || null);
    }
  } catch (e) { /* ignore */ }
}

export = {
  initGameSystems,
  installMoveExecutorRuntime
};
