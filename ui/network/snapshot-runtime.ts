'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

function loadRequiredModule(path: string): any {
  try {
    return _require(path);
  } catch (e) { /* ignore */ }
  return null;
}

function createNetworkSnapshotRuntime(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const rootRef = cfg.root || (typeof globalThis !== 'undefined' ? globalThis : null);

  function resolveState(): any {
    return (typeof cfg.getState === 'function' && cfg.getState()) || {};
  }

  function resolveObject(name: string): any {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any)[name] && typeof (globalThis as any)[name] === 'object') {
        return (globalThis as any)[name];
      }
    } catch (e) { /* ignore */ }

    try {
      if (rootRef && rootRef[name] && typeof rootRef[name] === 'object') {
        return rootRef[name];
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function resolveFunction(name: string, injected?: any): any {
    if (typeof injected === 'function') return injected;

    try {
      if (rootRef && typeof rootRef[name] === 'function') {
        return rootRef[name].bind(rootRef);
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof globalThis !== 'undefined' && typeof (globalThis as any)[name] === 'function') {
        return (globalThis as any)[name].bind(globalThis);
      }
    } catch (e) { /* ignore */ }

    return null;
  }

  function setGlobalValue(name: string, value: any): void {
    try {
      if (typeof globalThis !== 'undefined') {
        (globalThis as any)[name] = value;
      }
    } catch (e) { /* ignore */ }

    try {
      if (rootRef) {
        rootRef[name] = value;
      }
    } catch (e) { /* ignore */ }
  }

  function setGlobalFlag(name: string, value: any): void {
    setGlobalValue(name, value);
  }

  function resolveModule(injected: any, globalName: string, requirePath: string): any {
    if (injected && typeof injected === 'object') {
      return injected;
    }

    try {
      if (rootRef && rootRef[globalName] && typeof rootRef[globalName] === 'object') {
        return rootRef[globalName];
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any)[globalName] && typeof (globalThis as any)[globalName] === 'object') {
        return (globalThis as any)[globalName];
      }
    } catch (e) { /* ignore */ }

    const required = loadRequiredModule(requirePath);
    return (required && typeof required === 'object') ? required : null;
  }

  function resolvePlaybackStateModule(): any {
    return resolveModule(cfg.playbackState, 'PlaybackStateManager', '../playback-state-manager');
  }

  function resolveBoardUpdateDispatch(): any {
    return resolveModule(cfg.boardUpdateDispatch, 'BoardUpdateDispatch', '../board-update-dispatch');
  }

  function resolveBoardUpdateSyncRuntime(): any {
    return resolveModule(cfg.boardUpdateSyncRuntime, 'BoardUpdateSyncRuntime', '../board-update-sync-runtime');
  }

  function resolveSharedBoardUtils(): any {
    return resolveModule(cfg.sharedBoardUtils, 'SharedBoardUtils', '../../shared/shared-board-utils');
  }

  function resolveResultPresentationSync(): any {
    const syncResultPresentation = resolveFunction('syncResultPresentationFromSnapshot', cfg.syncResultPresentationFromSnapshot);
    if (typeof syncResultPresentation === 'function') {
      return syncResultPresentation;
    }
    const resultOverlayModule = loadRequiredModule('../result-overlay');
    if (resultOverlayModule && typeof resultOverlayModule.syncResultPresentationFromSnapshot === 'function') {
      return resultOverlayModule.syncResultPresentationFromSnapshot;
    }
    return null;
  }

  function resolveWaitForPlaybackIdle(): any {
    const waitForPlaybackIdle = resolveFunction('waitForPlaybackIdle', cfg.waitForPlaybackIdle);
    return typeof waitForPlaybackIdle === 'function' ? waitForPlaybackIdle : null;
  }

  function armBoardUpdateContext(context: any): any {
    const playbackState = resolvePlaybackStateModule();
    if (!playbackState || typeof playbackState.armBoardUpdateContext !== 'function') return null;
    try {
      return playbackState.armBoardUpdateContext(context);
    } catch (e) { /* ignore */ }
    return null;
  }

  function setBusyState(active: any): boolean {
    const next = (active && typeof active === 'object')
      ? {
        processing: active.processing === true,
        cardAnimating: active.cardAnimating === true,
        playbackActive: active.playbackActive === true
      }
      : {
        processing: active === true,
        cardAnimating: active === true
      };
    const playbackState = resolvePlaybackStateModule();
    if (!playbackState || typeof playbackState !== 'object') return false;
    if (typeof playbackState.setBusyState === 'function') {
      playbackState.setBusyState(next);
      return true;
    }

    if (typeof playbackState.setProcessing === 'function') {
      playbackState.setProcessing(next.processing);
    }
    if (typeof playbackState.setCardAnimating === 'function') {
      playbackState.setCardAnimating(next.cardAnimating);
    }
    if (Object.prototype.hasOwnProperty.call(next, 'playbackActive') && typeof playbackState.setPlaybackActive === 'function') {
      playbackState.setPlaybackActive(next.playbackActive);
    }
    return true;
  }

  function clearBusyStateAndPlaybackLock(): boolean {
    const playbackState = resolvePlaybackStateModule();
    if (playbackState && typeof playbackState.abortPlayback === 'function') {
      playbackState.abortPlayback();
    } else if (playbackState && typeof playbackState.clearPlaybackLock === 'function') {
      playbackState.clearPlaybackLock();
    } else {
      setBusyState(false);
    }

    setGlobalFlag('isProcessing', false);
    setGlobalFlag('isCardAnimating', false);
    setGlobalFlag('VisualPlaybackActive', false);
    setGlobalValue('__playbackActiveSince', null);
    return true;
  }

  function getPlaybackStartedAt(): number | null {
    const playbackState = resolvePlaybackStateModule();
    try {
      if (playbackState && typeof playbackState.getPlaybackStartedAt === 'function') {
        const startedAt = Number(playbackState.getPlaybackStartedAt());
        return Number.isFinite(startedAt) ? startedAt : null;
      }
    } catch (e) { /* ignore */ }

    const startedAt = Number(rootRef && rootRef.__playbackActiveSince);
    return Number.isFinite(startedAt) ? startedAt : null;
  }

  function isPlaybackEngineRunning(): boolean | null {
    try {
      if (
        rootRef
        && rootRef.AnimationEngine
        && typeof rootRef.AnimationEngine.isPlaying === 'boolean'
      ) {
        return rootRef.AnimationEngine.isPlaying === true;
      }
    } catch (e) { /* ignore */ }
    return null;
  }

  function getStalePlaybackTimeoutMs(): number {
    const timeoutMs = Number(rootRef && rootRef.PASS_STALE_PLAYBACK_MS);
    if (Number.isFinite(timeoutMs) && timeoutMs > 0) return timeoutMs;
    return 3500;
  }

  return {
    resolveState,
    resolveObject,
    resolveFunction,
    setGlobalFlag,
    setGlobalValue,
    resolvePlaybackStateModule,
    resolveBoardUpdateDispatch,
    resolveBoardUpdateSyncRuntime,
    resolveSharedBoardUtils,
    resolveResultPresentationSync,
    resolveWaitForPlaybackIdle,
    armBoardUpdateContext,
    setBusyState,
    clearBusyStateAndPlaybackLock,
    getPlaybackStartedAt,
    isPlaybackEngineRunning,
    getStalePlaybackTimeoutMs
  };
}

const NetworkSnapshotRuntime = {
  createNetworkSnapshotRuntime
};

export = NetworkSnapshotRuntime;
