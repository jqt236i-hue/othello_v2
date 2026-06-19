'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let playbackDigestModule: any = null;

function resolvePlaybackDigestModule(): any {
  if (playbackDigestModule) return playbackDigestModule;
  try {
    playbackDigestModule = _require('../../shared/playback-digest');
  } catch (e) { /* ignore */ }
  if (!playbackDigestModule && typeof globalThis !== 'undefined' && (globalThis as any).PlaybackDigest) {
    playbackDigestModule = (globalThis as any).PlaybackDigest;
  }
  return playbackDigestModule;
}

function createNetworkPlaybackRecoveryController(config?: any): any {
  const cfg = (config && typeof config === 'object') ? config : {};
  const getState = typeof cfg.getState === 'function' ? cfg.getState : function () { return null; };

  function readState(): any {
    const state = getState();
    if (!state || typeof state !== 'object') {
      throw new Error('network_playback_recovery_state_required');
    }
    return state;
  }

  function computeForceSyncPlaybackRecoverySignature(snapshot: any): string {
    if (!snapshot || typeof snapshot !== 'object') return '';
    if (!snapshot.gameState || typeof snapshot.gameState !== 'object') return '';
    if (!snapshot.cardState || typeof snapshot.cardState !== 'object') return '';
    try {
      const cloneData = typeof cfg.cloneData === 'function'
        ? cfg.cloneData
        : function (value: any) { return JSON.parse(JSON.stringify(value)); };
      const signatureCardState = cloneData(snapshot.cardState);
      delete signatureCardState.presentationEvents;
      delete signatureCardState._presentationEventsPersist;
      delete signatureCardState.chargeDeltaEvents;
      return JSON.stringify({
        gameState: cloneData(snapshot.gameState),
        cardState: signatureCardState
      });
    } catch (e) {
      return '';
    }
  }

  function computeCurrentPlaybackRecoverySignature(): string {
    const currentSnapshot = typeof cfg.getCurrentSnapshotForPublish === 'function'
      ? cfg.getCurrentSnapshotForPublish()
      : null;
    return computeForceSyncPlaybackRecoverySignature(currentSnapshot);
  }

  function computePlaybackDigest(playbackEvents: any): string {
    if (typeof cfg.computePlaybackDigest === 'function') {
      try {
        const digest = cfg.computePlaybackDigest(playbackEvents);
        return typeof digest === 'string' ? digest : '';
      } catch (e) {
        return '';
      }
    }
    const digestModule = resolvePlaybackDigestModule();
    if (!digestModule || typeof digestModule.computePlaybackDigest !== 'function') return '';
    try {
      return digestModule.computePlaybackDigest(Array.isArray(playbackEvents) ? playbackEvents : []);
    } catch (e) {
      return '';
    }
  }

  function normalizePlaybackDigest(value: any): string {
    return value ? String(value).trim() : '';
  }

  function resolveAuthoritativePlaybackDigest(authoritativePlaybackEvents: any, authoritativePlaybackDigest?: any): string {
    const digest = normalizePlaybackDigest(authoritativePlaybackDigest);
    return digest || computePlaybackDigest(authoritativePlaybackEvents);
  }

  function playbackDigestsMatch(requestedPlaybackEvents: any, authoritativePlaybackEvents: any, authoritativePlaybackDigest?: any): boolean {
    const requestedDigest = computePlaybackDigest(requestedPlaybackEvents);
    const authoritativeDigest = resolveAuthoritativePlaybackDigest(authoritativePlaybackEvents, authoritativePlaybackDigest);
    return !!requestedDigest && requestedDigest === authoritativeDigest;
  }

  function shouldApplyPublishResponseAsShadowPlayback(trackedPublish: any, snapshot: any, playbackEvents: any, playbackDigest?: any): boolean {
    if (!trackedPublish || typeof trackedPublish !== 'object') return false;
    if (!trackedPublish.requestMeta) return false;
    const requestedPlaybackEvents = typeof cfg.getTrackedPublishRequestedPlaybackEvents === 'function'
      ? cfg.getTrackedPublishRequestedPlaybackEvents(trackedPublish)
      : [];
    if (!Array.isArray(requestedPlaybackEvents) || requestedPlaybackEvents.length === 0) return false;
    if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
    if (!playbackDigestsMatch(requestedPlaybackEvents, playbackEvents, playbackDigest)) return false;
    const snapshotSignature = computeForceSyncPlaybackRecoverySignature(snapshot);
    if (!snapshotSignature) return false;
    const currentSignature = computeCurrentPlaybackRecoverySignature();
    return !!currentSignature && currentSignature === snapshotSignature;
  }

  function shouldSkipPublishResponseSnapshot(trackedPublish: any, snapshot: any): boolean {
    if (!trackedPublish || typeof trackedPublish !== 'object') return false;
    if (trackedPublish.selfSnapshotReceived !== true) return false;

    const snapshotVersion = typeof cfg.getSnapshotStateVersion === 'function'
      ? cfg.getSnapshotStateVersion(snapshot)
      : null;
    const selfSnapshotVersion = Number.isFinite(Number(trackedPublish.selfSnapshotVersion))
      ? Number(trackedPublish.selfSnapshotVersion)
      : null;
    const appliedStateVersion = typeof cfg.getAppliedStateVersion === 'function'
      ? cfg.getAppliedStateVersion()
      : null;
    if (snapshotVersion === null || selfSnapshotVersion === null) return false;
    if (snapshotVersion !== selfSnapshotVersion) return false;
    if (appliedStateVersion !== null && appliedStateVersion < snapshotVersion) return false;

    const snapshotSignature = computeForceSyncPlaybackRecoverySignature(snapshot);
    if (!snapshotSignature) return false;
    const currentSignature = computeCurrentPlaybackRecoverySignature();
    return !!currentSignature && currentSignature === snapshotSignature;
  }

  function shouldApplyStreamSnapshotAsShadowPlayback(trackedPublish: any, playbackEvents: any, playbackDigest?: any): boolean {
    if (!trackedPublish || typeof trackedPublish !== 'object') return false;
    if (!trackedPublish.requestMeta) return false;
    const requestedPlaybackEvents = typeof cfg.getTrackedPublishRequestedPlaybackEvents === 'function'
      ? cfg.getTrackedPublishRequestedPlaybackEvents(trackedPublish)
      : [];
    if (!Array.isArray(requestedPlaybackEvents) || requestedPlaybackEvents.length === 0) return false;
    if (!Array.isArray(playbackEvents) || playbackEvents.length === 0) return false;
    if (!playbackDigestsMatch(requestedPlaybackEvents, playbackEvents, playbackDigest)) return false;
    return true;
  }

  function buildShadowAwarePlaybackApplyOptions(playbackEvents: any, shouldShadowPlayback: any, shadowPlaybackSource: any): any {
    const events = Array.isArray(playbackEvents) ? playbackEvents : [];
    const useShadowPlayback = shouldShadowPlayback === true;
    return {
      playbackEvents: useShadowPlayback ? [] : events,
      shadowPlaybackEvents: useShadowPlayback ? events : [],
      shadowPlaybackSource: useShadowPlayback ? shadowPlaybackSource : undefined
    };
  }

  function clearPendingForceSyncPlaybackRecovery(): void {
    const state = readState();
    state.pendingForceSyncPlaybackVersion = null;
    state.pendingForceSyncPlaybackSource = '';
    state.pendingForceSyncPlaybackSignature = '';
  }

  function rememberPendingForceSyncPlaybackRecovery(snapshot: any, options: any): boolean {
    const state = readState();
    const opts = (options && typeof options === 'object') ? options : {};
    const snapshotVersion = typeof cfg.getSnapshotStateVersion === 'function'
      ? cfg.getSnapshotStateVersion(snapshot)
      : null;
    const playbackEvents = Array.isArray(opts.playbackEvents) ? opts.playbackEvents : [];
    const shadowPlaybackEvents = Array.isArray(opts.shadowPlaybackEvents) ? opts.shadowPlaybackEvents : [];
    if (snapshotVersion === null) {
      clearPendingForceSyncPlaybackRecovery();
      return false;
    }
    if (opts.force !== true || playbackEvents.length > 0 || shadowPlaybackEvents.length > 0) {
      const pendingVersion = Number.isFinite(Number(state.pendingForceSyncPlaybackVersion))
        ? Number(state.pendingForceSyncPlaybackVersion)
        : null;
      if (pendingVersion !== null && snapshotVersion >= pendingVersion) {
        clearPendingForceSyncPlaybackRecovery();
      }
      return false;
    }
    state.pendingForceSyncPlaybackVersion = snapshotVersion;
    state.pendingForceSyncPlaybackSource = typeof opts.source === 'string' ? opts.source : '';
    state.pendingForceSyncPlaybackSignature = computeForceSyncPlaybackRecoverySignature(snapshot);
    return true;
  }

  function consumePendingForceSyncPlaybackRecovery(snapshotOrVersion: any): boolean {
    const state = readState();
    const snapshotVersion = Number.isFinite(Number(snapshotOrVersion))
      ? Number(snapshotOrVersion)
      : (typeof cfg.getSnapshotStateVersion === 'function' ? cfg.getSnapshotStateVersion(snapshotOrVersion) : null);
    const pendingVersion = Number.isFinite(Number(state.pendingForceSyncPlaybackVersion))
      ? Number(state.pendingForceSyncPlaybackVersion)
      : null;
    if (snapshotVersion === null || pendingVersion === null || snapshotVersion < pendingVersion) {
      return false;
    }
    clearPendingForceSyncPlaybackRecovery();
    return true;
  }

  function shouldRecoverForceSyncedStreamPlayback(snapshot: any, playbackEvents: any): boolean {
    const state = readState();
    const pendingVersion = Number.isFinite(Number(state.pendingForceSyncPlaybackVersion))
      ? Number(state.pendingForceSyncPlaybackVersion)
      : null;
    const pendingSignature = typeof state.pendingForceSyncPlaybackSignature === 'string'
      ? state.pendingForceSyncPlaybackSignature
      : '';
    const snapshotVersion = typeof cfg.getSnapshotStateVersion === 'function'
      ? cfg.getSnapshotStateVersion(snapshot)
      : null;
    const localVersion = typeof cfg.getAppliedStateVersion === 'function'
      ? cfg.getAppliedStateVersion()
      : null;
    if (pendingVersion === null || snapshotVersion === null) return false;
    if (snapshotVersion !== pendingVersion) return false;
    if (!Array.isArray(playbackEvents) || playbackEvents.length <= 0) return false;
    if (typeof cfg.shouldSkipForceSyncSnapshot === 'function' && cfg.shouldSkipForceSyncSnapshot(snapshot)) return false;
    if (pendingSignature && computeForceSyncPlaybackRecoverySignature(snapshot) !== pendingSignature) return false;
    return localVersion === snapshotVersion;
  }

  return {
    computeForceSyncPlaybackRecoverySignature,
    computeCurrentPlaybackRecoverySignature,
    computePlaybackDigest,
    shouldApplyPublishResponseAsShadowPlayback,
    shouldSkipPublishResponseSnapshot,
    shouldApplyStreamSnapshotAsShadowPlayback,
    buildShadowAwarePlaybackApplyOptions,
    clearPendingForceSyncPlaybackRecovery,
    rememberPendingForceSyncPlaybackRecovery,
    consumePendingForceSyncPlaybackRecovery,
    shouldRecoverForceSyncedStreamPlayback
  };
}

const NetworkPlaybackRecoveryModule = {
  createNetworkPlaybackRecoveryController
};

export = NetworkPlaybackRecoveryModule;
