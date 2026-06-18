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

export function installPassRuntimeWiring(deps: PassRuntimeWiringDeps): { registeredGlobals: Record<string, any> } {
  const passHandler = deps.requireModule('../game/pass-handler');
  const passGlobals: Record<string, any> = {};
  if (passHandler && typeof passHandler.processPassTurn === 'function') passGlobals.processPassTurn = passHandler.processPassTurn;
  if (passHandler && typeof passHandler.ensureCurrentPlayerCanActOrPass === 'function') {
    passGlobals.ensureCurrentPlayerCanActOrPass = passHandler.ensureCurrentPlayerCanActOrPass;
  }
  if (!passHandler) return { registeredGlobals: passGlobals };

  if (typeof passHandler.setPassHandlerTimerService === 'function') {
    passHandler.setPassHandlerTimerService(deps.timerService || null);
  }
  try {
    if (typeof passHandler.setPassHandlerRuntime === 'function') {
      let cpu: any = null;
      const runtimeResolvers = deps.runtimeResolvers || {};
      try { cpu = deps.requireModule('../game/cpu-turn-handler'); } catch (e: any) { /* ignore */ }
      passHandler.setPassHandlerRuntime({
        processCpuTurn: cpu && typeof cpu.processCpuTurn === 'function' ? cpu.processCpuTurn : null,
        readMatchMode: runtimeResolvers.readMatchMode,
        readHumanVsHumanMode: runtimeResolvers.readHumanVsHumanMode,
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
