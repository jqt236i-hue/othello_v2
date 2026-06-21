'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PresentationQueue = _require('../shared/presentation-queue');

function getRoot(): any {
  const base: any = (typeof globalThis !== 'undefined' ? globalThis : {});
  if (base && base.window && typeof base.window === 'object') return base.window;
  try {
    if (typeof window !== 'undefined' && window) return window;
  } catch (e) { /* ignore */ }
  return base;
}

function getMirrorTargets(): any[] {
  const targets: any[] = [];
  const primary = getRoot();
  if (primary && typeof primary === 'object') {
    targets.push(primary);
  }
  try {
    if (typeof globalThis !== 'undefined' && globalThis && targets.indexOf(globalThis) === -1) {
      targets.push(globalThis);
    }
  } catch (e) { /* ignore */ }
  return targets;
}

function readMirroredValue(name: string): any {
  const targets = getMirrorTargets();
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    try {
      if (typeof target[name] !== 'undefined') {
        return target[name];
      }
    } catch (e) { /* ignore */ }
  }
  return undefined;
}

function setMirroredValue(name: string, value: any): any {
  const targets = getMirrorTargets();
  for (let index = 0; index < targets.length; index += 1) {
    try {
      targets[index][name] = value;
    } catch (e) { /* ignore */ }
  }
  return value;
}

function getBoardElement(options?: any): HTMLElement | null {
  const config = (options && typeof options === 'object') ? options : {};
  if (config.boardElement && typeof config.boardElement === 'object') return config.boardElement;
  const target = getRoot();
  try {
    if (target && target.document && typeof target.document.getElementById === 'function') {
      return target.document.getElementById('board');
    }
  } catch (e) { /* ignore */ }
  return null;
}

function setBoardLockActive(active: boolean, options?: any): boolean {
  const boardElement = getBoardElement(options);
  const locked = active === true;
  if (boardElement && boardElement.classList && typeof boardElement.classList.toggle === 'function') {
    boardElement.classList.toggle('playback-locked', locked);
  }
  return locked;
}

function getAnimationEngine(options?: any): any {
  const config = (options && typeof options === 'object') ? options : {};
  if (config.animationEngine && typeof config.animationEngine === 'object') return config.animationEngine;
  const target = (config.root && typeof config.root === 'object') ? config.root : getRoot();
  try {
    if (target && target.AnimationEngine && typeof target.AnimationEngine === 'object') {
      return target.AnimationEngine;
    }
  } catch (e) { /* ignore */ }
  return null;
}

let activePlaybackAbortHandle: any = null;
let nextSelectionSettlementLockId = 1;
const selectionSettlementLockIds = new Set<number>();
let nextVisualPlaybackClaimId = 1;
const visualPlaybackClaimIds = new Map<number, any>();
let visualPlaybackClaimBusyBaseline: { processing: boolean; cardAnimating: boolean } | null = null;
let visualPlaybackClaimProcessingCleared = false;

function syncSelectionSettlementLockMirror(): number {
  const count = selectionSettlementLockIds.size;
  setMirroredValue('__selectionSettlementLockCount', count);
  setMirroredValue('__selectionSettlementLockActive', count > 0);
  return count;
}

function normalizeVisualPlaybackClaimMeta(meta?: any): any {
  const source = String(meta && meta.source ? meta.source : 'unknown').trim() || 'unknown';
  const rawScope = String(meta && meta.scope ? meta.scope : '').trim().toLowerCase();
  const scope = rawScope === 'presentation_drain' || rawScope === 'batch_handoff'
    ? rawScope
    : 'generic';
  const eventCount = Number(meta && meta.eventCount);
  const eventTypes = Array.isArray(meta && meta.eventTypes)
    ? meta.eventTypes.map((value: any) => String(value || '').trim()).filter((value: string) => !!value)
    : [];
  const normalized: any = { source, scope };
  if (Number.isFinite(eventCount) && eventCount >= 0) normalized.eventCount = Math.trunc(eventCount);
  if (eventTypes.length > 0) normalized.eventTypes = eventTypes;
  if (typeof meta !== 'undefined' && meta !== null && typeof meta === 'object') {
    if (typeof meta.reason === 'string' && meta.reason.trim()) normalized.reason = meta.reason.trim();
    if (typeof meta.strictNetworkPlayback !== 'undefined') normalized.strictNetworkPlayback = meta.strictNetworkPlayback === true;
  }
  return normalized;
}

function syncVisualPlaybackClaimMirror(): number {
  const count = visualPlaybackClaimIds.size;
  setMirroredValue('__visualPlaybackClaimCount', count);
  setMirroredValue('__visualPlaybackClaimActive', count > 0);
  return count;
}

function hasClaimedVisualPlayback(): boolean {
  if (visualPlaybackClaimIds.size > 0) return true;
  return readMirroredValue('__visualPlaybackClaimActive') === true;
}

function claimVisualPlayback(meta?: any): any {
  if (visualPlaybackClaimIds.size === 0) {
    visualPlaybackClaimBusyBaseline = {
      processing: getProcessing(),
      cardAnimating: getCardAnimating()
    };
    visualPlaybackClaimProcessingCleared = false;
  }
  const token = {
    id: nextVisualPlaybackClaimId++,
    meta: normalizeVisualPlaybackClaimMeta(meta)
  };
  visualPlaybackClaimIds.set(token.id, token);
  syncVisualPlaybackClaimMirror();
  setProcessing(true);
  setCardAnimating(true);
  setBoardLockActive(true);
  return token;
}

function releaseVisualPlaybackClaim(token?: any): boolean {
  const tokenId = Number(token && token.id);
  const removed = Number.isFinite(tokenId) && visualPlaybackClaimIds.delete(tokenId);
  syncVisualPlaybackClaimMirror();
  if (removed !== true) {
    return false;
  }
  if (hasClaimedVisualPlayback()) {
    setProcessing(true);
    setCardAnimating(true);
    setBoardLockActive(true);
    return true;
  }
  const baseline = visualPlaybackClaimBusyBaseline;
  const processingCleared = visualPlaybackClaimProcessingCleared === true;
  visualPlaybackClaimBusyBaseline = null;
  visualPlaybackClaimProcessingCleared = false;
  if (readMirroredValue('VisualPlaybackActive') === true) {
    setProcessing(true);
    setCardAnimating(true);
    setBoardLockActive(true);
    return true;
  }
  setProcessing(processingCleared ? false : (baseline ? baseline.processing === true : false));
  setCardAnimating(baseline ? baseline.cardAnimating === true : false);
  setBoardLockActive(getPlaybackActive());
  return true;
}

function clearVisualPlaybackClaims(): boolean {
  visualPlaybackClaimIds.clear();
  visualPlaybackClaimBusyBaseline = null;
  visualPlaybackClaimProcessingCleared = false;
  syncVisualPlaybackClaimMirror();
  return true;
}

function hasSelectionSettlementLock(): boolean {
  return selectionSettlementLockIds.size > 0;
}

function acquireSelectionSettlementLock(meta?: any): any {
  const token = {
    id: nextSelectionSettlementLockId++,
    meta: (meta && typeof meta === 'object') ? Object.assign({}, meta) : null
  };
  selectionSettlementLockIds.add(token.id);
  syncSelectionSettlementLockMirror();
  setBoardLockActive(true);
  return token;
}

function releaseSelectionSettlementLock(token: any): boolean {
  const tokenId = Number(token && token.id);
  if (!Number.isFinite(tokenId) || !selectionSettlementLockIds.has(tokenId)) {
    return false;
  }
  selectionSettlementLockIds.delete(tokenId);
  syncSelectionSettlementLockMirror();
  setBoardLockActive(getPlaybackActive());
  return true;
}

function clearSelectionSettlementLocks(): boolean {
  selectionSettlementLockIds.clear();
  syncSelectionSettlementLockMirror();
  setBoardLockActive(getPlaybackActive());
  return true;
}

function registerPlaybackAbortHandle(handle: any): any {
  activePlaybackAbortHandle = (handle && typeof handle.abort === 'function') ? handle : null;
  return activePlaybackAbortHandle;
}

function clearPlaybackAbortHandle(handle: any): boolean {
  if (!handle || activePlaybackAbortHandle === handle) {
    activePlaybackAbortHandle = null;
  }
  return true;
}

function isNetworkPresentationTimelinePlaying(): boolean {
  const targets = getMirrorTargets();
  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    try {
      const timeline = target && target.NetworkPresentationTimeline;
      if (timeline && typeof timeline.getDiagnostics === 'function') {
        const diagnostics = timeline.getDiagnostics();
        if (diagnostics && diagnostics.playing === true) return true;
      }
    } catch (e) { /* ignore */ }
  }
  return false;
}

function getPlaybackActive(): boolean {
  return readMirroredValue('VisualPlaybackActive') === true
    || hasClaimedVisualPlayback() === true
    || hasSelectionSettlementLock()
    || isNetworkPresentationTimelinePlaying();
}

function setPlaybackActive(active: boolean): boolean {
  const next = active === true;
  setMirroredValue('VisualPlaybackActive', next);
  if (next) {
    if (getPlaybackStartedAt() === null) {
      setMirroredValue('__playbackActiveSince', Date.now());
    }
  } else {
    setMirroredValue('__playbackActiveSince', null);
  }
  return next;
}

function setPlaybackStartedAt(value: any): any {
  if (value === null || typeof value === 'undefined' || value === '') {
    return setMirroredValue('__playbackActiveSince', null);
  }
  const next = Number(value);
  return setMirroredValue('__playbackActiveSince', Number.isFinite(next) ? next : null);
}

function ensurePlaybackStartedAt(nowValue?: any): number | null {
  if (!getPlaybackActive()) {
    setPlaybackStartedAt(null);
    return null;
  }
  const startedAt = getPlaybackStartedAt();
  if (startedAt !== null) return startedAt;
  const next = Number(nowValue);
  return setPlaybackStartedAt(Number.isFinite(next) ? next : Date.now());
}

function getCardAnimating(): boolean {
  return readMirroredValue('isCardAnimating') === true || hasSelectionSettlementLock() || getPlaybackActive();
}

function setCardAnimating(active: boolean): boolean {
  return setMirroredValue('isCardAnimating', active === true) === true;
}

function getProcessing(): boolean {
  return readMirroredValue('isProcessing') === true || hasSelectionSettlementLock();
}

function setProcessing(active: boolean): boolean {
  if (active !== true && visualPlaybackClaimIds.size > 0) {
    visualPlaybackClaimProcessingCleared = true;
  }
  return setMirroredValue('isProcessing', active === true) === true;
}

function setBusyState(options: any): any {
  const config = (options && typeof options === 'object')
    ? options
    : {
      processing: options === true,
      cardAnimating: options === true
    };

  if (Object.prototype.hasOwnProperty.call(config, 'processing')) {
    setProcessing(config.processing === true);
  }
  if (Object.prototype.hasOwnProperty.call(config, 'cardAnimating')) {
    setCardAnimating(config.cardAnimating === true);
  }
  if (Object.prototype.hasOwnProperty.call(config, 'playbackActive')) {
    setPlaybackActive(config.playbackActive === true);
  }

  return {
    isProcessing: getProcessing(),
    isCardAnimating: getCardAnimating(),
    playbackActive: getPlaybackActive()
  };
}

function setInteractionLock(locked: boolean): boolean {
  setBusyState({
    processing: locked === true,
    cardAnimating: locked === true,
    playbackActive: locked === true
  });
  return locked === true;
}

function getPlaybackStartedAt(): number | null {
  const rawValue = readMirroredValue('__playbackActiveSince');
  if (rawValue === null || typeof rawValue === 'undefined' || rawValue === '') {
    return null;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function getPlaybackStaleMs(options?: any): number {
  const config = (options && typeof options === 'object') ? options : {};
  if (Object.prototype.hasOwnProperty.call(config, 'staleMs')) {
    const explicitMs = Number(config.staleMs);
    if (Number.isFinite(explicitMs) && explicitMs > 0) return explicitMs;
  }
  const target = (config.root && typeof config.root === 'object') ? config.root : getRoot();
  if (target && typeof target === 'object') {
    const targetMs = Number(target.PASS_STALE_PLAYBACK_MS);
    if (Number.isFinite(targetMs) && targetMs > 0) return targetMs;
  }
  return 3500;
}

function isPlaybackRunning(options?: any): boolean {
  if (!getPlaybackActive()) return false;
  const animationEngine = getAnimationEngine(options);
  if (animationEngine && typeof animationEngine.isPlaying === 'boolean') {
    return animationEngine.isPlaying === true;
  }
  return true;
}

function isPlaybackStale(options?: any): boolean {
  if (!getPlaybackActive()) return false;
  const animationEngine = getAnimationEngine(options);
  if (animationEngine && typeof animationEngine.isPlaying === 'boolean') {
    return animationEngine.isPlaying !== true;
  }
  const startedAt = getPlaybackStartedAt();
  if (startedAt !== null && Number.isFinite(startedAt)) {
    return (Date.now() - (startedAt as number)) > getPlaybackStaleMs(options);
  }
  return false;
}

function getPresentationQueueState(source?: any): any {
  const resolved = (source && typeof source === 'object')
    ? source
    : (function () {
      const target = getRoot();
      try {
        if (target && target.cardState && typeof target.cardState === 'object') return target.cardState;
      } catch (e) { /* ignore */ }
      try {
        if (typeof globalThis !== 'undefined' && globalThis && (globalThis as any).cardState && typeof (globalThis as any).cardState === 'object') {
          return (globalThis as any).cardState;
        }
      } catch (e) { /* ignore */ }
      return null;
    }());
  if (PresentationQueue && typeof PresentationQueue.getPresentationQueueState === 'function') {
    return PresentationQueue.getPresentationQueueState(resolved);
  }
  return {
    presentationEvents: [],
    persistentEvents: [],
    entries: [],
    hasPending: false,
    hasVisualPlayback: false
  };
}

function getPresentationQueueEntries(source?: any): any[] {
  const queueState = getPresentationQueueState(source);
  return queueState.presentationEvents.concat(queueState.persistentEvents);
}

function hasPendingPresentationEvents(source?: any): boolean {
  return getPresentationQueueState(source).hasPending === true;
}

function hasPendingVisualPlayback(source?: any): boolean {
  return getPresentationQueueState(source).hasVisualPlayback === true;
}

function resolveVisualPlaybackDrainCardState(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  if (opts.cardState && typeof opts.cardState === 'object') return opts.cardState;
  if (typeof opts.getCardState === 'function') {
    try {
      const resolved = opts.getCardState();
      if (resolved && typeof resolved === 'object') return resolved;
    } catch (e) { /* ignore */ }
  }
  return undefined;
}

function getVisualPlaybackDrainTimeoutMs(options?: any): number {
  const opts = (options && typeof options === 'object') ? options : {};
  const explicit = Number(opts.timeoutMs);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.trunc(explicit);
  const target = (opts.root && typeof opts.root === 'object') ? opts.root : getRoot();
  const configured = Number(target && target.__pendingSelectionPublishSettleTimeoutMs);
  if (Number.isFinite(configured) && configured >= 0) return Math.trunc(configured);
  return 1500;
}

function isVisualPlaybackDrainComplete(options?: any): boolean {
  return readMirroredValue('VisualPlaybackActive') !== true
    && hasClaimedVisualPlayback() !== true
    && hasPendingVisualPlayback(resolveVisualPlaybackDrainCardState(options)) !== true;
}

function waitForVisualPlaybackDrain(options?: any): Promise<void> {
  const opts = (options && typeof options === 'object') ? options : {};
  return new Promise((resolve) => {
    let settled = false;
    let timeoutHandle: any = null;
    let pollHandle: any = null;
    let pollHandleType: 'raf' | 'timeout' | null = null;
    const rootRef = (opts.root && typeof opts.root === 'object') ? opts.root : getRoot();

    const clearPollHandle = () => {
      if (pollHandle === null) return;
      try {
        if (pollHandleType === 'raf') {
          const cancel = rootRef && typeof rootRef.cancelAnimationFrame === 'function'
            ? rootRef.cancelAnimationFrame.bind(rootRef)
            : (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : null);
          if (cancel) cancel(pollHandle);
        } else {
          clearTimeout(pollHandle);
        }
      } catch (e) { /* ignore */ }
      pollHandle = null;
      pollHandleType = null;
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      if (timeoutHandle !== null) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
      clearPollHandle();
      resolve();
    };

    const schedulePoll = (callback: () => void) => {
      if (settled) return;
      clearPollHandle();
      try {
        if (rootRef && typeof rootRef.requestAnimationFrame === 'function') {
          pollHandle = rootRef.requestAnimationFrame(callback);
          pollHandleType = 'raf';
          return;
        }
      } catch (e) { /* ignore */ }
      try {
        if (typeof requestAnimationFrame === 'function') {
          pollHandle = requestAnimationFrame(callback);
          pollHandleType = 'raf';
          return;
        }
      } catch (e) { /* ignore */ }
      pollHandle = setTimeout(callback, 0);
      pollHandleType = 'timeout';
    };

    const poll = () => {
      pollHandle = null;
      pollHandleType = null;
      try {
        if (isVisualPlaybackDrainComplete(opts)) {
          finish();
          return;
        }
      } catch (e) {
        finish();
        return;
      }
      schedulePoll(poll);
    };

    timeoutHandle = setTimeout(finish, getVisualPlaybackDrainTimeoutMs(opts));
    poll();
  });
}

function cloneBoardUpdateContext(context: any): any {
  if (!context || typeof context !== 'object') return null;
  return Object.assign({}, context);
}

function normalizeBoardUpdateContext(context: any): any {
  if (!context || typeof context !== 'object') return null;
  const next: any = {};
  if (context.suppressFallbackFlip === true || context.suppressNextDiffFlip === true) {
    next.suppressFallbackFlip = true;
  }
  if (context.suppressBoardExpansionRevealSound === true || context.suppressNextBoardExpansionRevealSound === true) {
    next.suppressBoardExpansionRevealSound = true;
  }
  if (typeof context.reason === 'string' && context.reason.trim()) {
    next.reason = context.reason.trim();
  }
  if (typeof context.source === 'string' && context.source.trim()) {
    next.source = context.source.trim();
  }
  if (context.allowSelectionEntryDuringPlayback === true) {
    next.allowSelectionEntryDuringPlayback = true;
  }
  return Object.keys(next).length > 0 ? next : null;
}

function getBoardUpdateContext(): any {
  const explicit = normalizeBoardUpdateContext(readMirroredValue('__boardUpdateContext'));
  if (explicit) return cloneBoardUpdateContext(explicit);
  const suppressFallbackFlip = readMirroredValue('__suppressNextDiffFlip') === true;
  const suppressBoardExpansionRevealSound = readMirroredValue('__suppressNextBoardExpansionRevealSound') === true;
  if (suppressFallbackFlip || suppressBoardExpansionRevealSound) {
    return Object.assign(
      {
        reason: 'legacy_board_update_context',
        source: 'legacy_window_flag'
      },
      suppressFallbackFlip ? { suppressFallbackFlip: true } : null,
      suppressBoardExpansionRevealSound ? { suppressBoardExpansionRevealSound: true } : null
    );
  }
  return null;
}

function normalizeSelectionEntryPlayerKey(playerKey: any): string {
  return String(playerKey || '').trim().toLowerCase() === 'white' ? 'white' : 'black';
}

function normalizeSelectionEntryPendingType(pendingType: any): string | null {
  const normalized = String(pendingType || '').trim().toUpperCase();
  return normalized || null;
}

function cloneSelectionEntryPlaybackContext(context: any): any {
  if (!context || typeof context !== 'object') return null;
  return Object.assign({}, context);
}

function normalizeSelectionEntryPlaybackContext(context: any): any {
  if (!context || typeof context !== 'object') return null;
  const next: any = {};
  if (typeof context.playerKey !== 'undefined' && context.playerKey !== null) {
    next.playerKey = normalizeSelectionEntryPlayerKey(context.playerKey);
  }
  if (typeof context.pendingType !== 'undefined' && context.pendingType !== null) {
    next.pendingType = normalizeSelectionEntryPendingType(context.pendingType);
  }
  const expiresAt = Number(context.expiresAt);
  if (Number.isFinite(expiresAt) && expiresAt > 0) {
    next.expiresAt = Math.trunc(expiresAt);
  }
  if (typeof context.source === 'string' && context.source.trim()) {
    next.source = context.source.trim();
  }
  if (typeof context.reason === 'string' && context.reason.trim()) {
    next.reason = context.reason.trim();
  }
  return Object.keys(next).length > 0 ? next : null;
}

function getSelectionEntryPlaybackContext(): any {
  const current = normalizeSelectionEntryPlaybackContext(readMirroredValue('__selectionEntryPlaybackContext'));
  if (!current) return null;
  if (Number.isFinite(current.expiresAt) && current.expiresAt < Date.now()) {
    clearSelectionEntryPlaybackContext();
    return null;
  }
  return cloneSelectionEntryPlaybackContext(current);
}

function setSelectionEntryPlaybackContext(context: any): any {
  const next = normalizeSelectionEntryPlaybackContext(context);
  setMirroredValue('__selectionEntryPlaybackContext', next ? cloneSelectionEntryPlaybackContext(next) : null);
  return getSelectionEntryPlaybackContext();
}

function armSelectionEntryPlaybackContext(context: any): any {
  const next = normalizeSelectionEntryPlaybackContext(context);
  if (!next) {
    clearSelectionEntryPlaybackContext();
    return null;
  }
  if (!Number.isFinite(next.expiresAt)) {
    next.expiresAt = Date.now() + 2500;
  }
  const current = getSelectionEntryPlaybackContext();
  return setSelectionEntryPlaybackContext(current ? Object.assign({}, current, next) : next);
}

function clearSelectionEntryPlaybackContext(): boolean {
  setMirroredValue('__selectionEntryPlaybackContext', null);
  return true;
}

function shouldAllowSelectionEntryDuringPlayback(options?: any): boolean {
  const current = getSelectionEntryPlaybackContext();
  if (!current) return false;
  const opts = (options && typeof options === 'object') ? options : {};
  if (typeof opts.playerKey !== 'undefined' && opts.playerKey !== null) {
    if (normalizeSelectionEntryPlayerKey(opts.playerKey) !== current.playerKey) {
      return false;
    }
  }
  if (typeof opts.pendingType !== 'undefined' && opts.pendingType !== null) {
    if (normalizeSelectionEntryPendingType(opts.pendingType) !== current.pendingType) {
      return false;
    }
  }
  return true;
}

function shouldDeferBoardUpdate(options?: any): boolean {
  const opts = (options && typeof options === 'object') ? options : {};
  if (shouldAllowSelectionEntryDuringPlayback(opts) === true) {
    return false;
  }
  return getPlaybackActive() === true
    || hasClaimedVisualPlayback() === true
    || hasPendingVisualPlayback(opts.cardState)
    || isNetworkPresentationTimelinePlaying();
}

function shouldDeferUiSync(options?: any): boolean {
  const opts = (options && typeof options === 'object') ? options : {};
  if (shouldAllowSelectionEntryDuringPlayback(opts) === true) {
    return false;
  }
  return getPlaybackActive() === true
    || hasClaimedVisualPlayback() === true
    || hasPendingPresentationEvents(opts.cardState)
    || isNetworkPresentationTimelinePlaying();
}

function setBoardUpdateContext(context: any): any {
  const next = normalizeBoardUpdateContext(context);
  setMirroredValue('__boardUpdateContext', next ? cloneBoardUpdateContext(next) : null);
  setMirroredValue('__suppressNextDiffFlip', !!(next && next.suppressFallbackFlip === true));
  setMirroredValue('__suppressNextBoardExpansionRevealSound', !!(next && next.suppressBoardExpansionRevealSound === true));
  return getBoardUpdateContext();
}

function armBoardUpdateContext(context: any): any {
  const next = normalizeBoardUpdateContext(context);
  if (!next) {
    clearBoardUpdateContext();
    return null;
  }
  const current = getBoardUpdateContext();
  if (current && current.suppressFallbackFlip === true) {
    next.suppressFallbackFlip = true;
  }
  return setBoardUpdateContext(current ? Object.assign({}, current, next) : next);
}

function consumeBoardUpdateContext(): any {
  const current = getBoardUpdateContext();
  if (current) clearBoardUpdateContext();
  return current;
}

function clearBoardUpdateContext(): boolean {
  setMirroredValue('__boardUpdateContext', null);
  setMirroredValue('__suppressNextDiffFlip', false);
  setMirroredValue('__suppressNextBoardExpansionRevealSound', false);
  return true;
}

function getSuppressNextDiffFlip(): boolean {
  const context = getBoardUpdateContext();
  return !!(context && context.suppressFallbackFlip === true);
}

function setSuppressNextDiffFlip(active: boolean): boolean {
  if (active === true) {
    return !!(armBoardUpdateContext({
      suppressFallbackFlip: true,
      reason: 'legacy_suppress_next_diff_flip',
      source: 'legacy_playback_state_api'
    }) || {}).suppressFallbackFlip;
  }
  clearBoardUpdateContext();
  return false;
}

function consumeSuppressNextDiffFlip(): boolean {
  const context = consumeBoardUpdateContext();
  return !!(context && context.suppressFallbackFlip === true);
}

function beginPlayback(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  setInteractionLock(true);
  if (opts.startedAt === null) {
    setPlaybackStartedAt(null);
  } else {
    ensurePlaybackStartedAt(opts.startedAt);
  }
  setBoardLockActive(true, opts);
  return {
    playbackActive: getPlaybackActive(),
    isCardAnimating: getCardAnimating(),
    isProcessing: getProcessing(),
    startedAt: getPlaybackStartedAt()
  };
}

function finalizePlayback(options?: any): any {
  const opts = (options && typeof options === 'object') ? options : {};
  if (Object.prototype.hasOwnProperty.call(opts, 'boardUpdateContext')) {
    if (opts.boardUpdateContext) {
      armBoardUpdateContext(opts.boardUpdateContext);
    } else if (opts.clearBoardUpdateContext !== false) {
      clearBoardUpdateContext();
    }
  } else if (opts.clearBoardUpdateContext === true) {
    clearBoardUpdateContext();
  }
  if (opts.clearSelectionEntry !== false) {
    clearSelectionEntryPlaybackContext();
  }
  const keepClaimBusy = hasClaimedVisualPlayback() === true;
  setBusyState({ processing: keepClaimBusy, cardAnimating: keepClaimBusy, playbackActive: false });
  setPlaybackStartedAt(null);
  setBoardLockActive(getPlaybackActive(), opts);
  if (typeof opts.emitBoardUpdate === 'function') {
    opts.emitBoardUpdate();
  }
  return getBoardUpdateContext();
}

function clearPlaybackLock(options?: any): boolean {
  const opts = (options && typeof options === 'object') ? options : {};
  clearVisualPlaybackClaims();
  clearBoardUpdateContext();
  clearSelectionEntryPlaybackContext();
  if (opts.preserveSelectionSettlementLock !== true) {
    clearSelectionSettlementLocks();
  }
  setBusyState({ processing: false, cardAnimating: false, playbackActive: false });
  setPlaybackStartedAt(null);
  setBoardLockActive(getPlaybackActive(), opts);
  return true;
}

function abortPlayback(options?: any): boolean {
  const abortHandle = activePlaybackAbortHandle;
  activePlaybackAbortHandle = null;
  if (abortHandle && typeof abortHandle.abort === 'function') {
    abortHandle.abort();
  }
  clearPlaybackLock(options);
  setPlaybackStartedAt(null);
  return true;
}

let PlaybackRuntimeModule: any = null;

function getPlaybackRuntimeModule(): any {
  if (PlaybackRuntimeModule) return PlaybackRuntimeModule;
  if (typeof _require === 'function') {
    try {
      PlaybackRuntimeModule = _require('./playback-runtime');
    } catch (e) {
      PlaybackRuntimeModule = null;
    }
  }
  if (!PlaybackRuntimeModule) {
    try {
      if (typeof globalThis !== 'undefined' && globalThis && (globalThis as any).PlaybackRuntime) {
        PlaybackRuntimeModule = (globalThis as any).PlaybackRuntime;
      }
    } catch (e) { /* ignore */ }
  }
  return PlaybackRuntimeModule;
}

function getRuntimePlaybackState(): any {
  return {
    getPlaybackActive,
    setPlaybackActive,
    ensurePlaybackStartedAt,
    setPlaybackStartedAt,
    getCardAnimating,
    setCardAnimating,
    getProcessing,
    setProcessing,
    setBusyState,
    setInteractionLock,
    claimVisualPlayback,
    releaseVisualPlaybackClaim,
    clearVisualPlaybackClaims,
    hasClaimedVisualPlayback,
    acquireSelectionSettlementLock,
    releaseSelectionSettlementLock,
    clearSelectionSettlementLocks,
    hasSelectionSettlementLock,
    getPlaybackStartedAt,
    getPlaybackStaleMs,
    isPlaybackRunning,
    isPlaybackStale,
    getBoardUpdateContext,
    setBoardUpdateContext,
    armBoardUpdateContext,
    consumeBoardUpdateContext,
    clearBoardUpdateContext,
    getSelectionEntryPlaybackContext,
    setSelectionEntryPlaybackContext,
    armSelectionEntryPlaybackContext,
    clearSelectionEntryPlaybackContext,
    shouldAllowSelectionEntryDuringPlayback,
    getSuppressNextDiffFlip,
    setSuppressNextDiffFlip,
    consumeSuppressNextDiffFlip,
    registerPlaybackAbortHandle,
    clearPlaybackAbortHandle,
    abortPlayback,
    clearPlaybackLock,
    beginPlayback,
    finalizePlayback,
    getPresentationQueueState,
    getPresentationQueueEntries,
    hasPendingPresentationEvents,
    hasPendingVisualPlayback,
    waitForVisualPlaybackDrain,
    shouldDeferBoardUpdate,
    shouldDeferUiSync,
    setBoardLockActive
  };
}

function syncLegacyWindowFlags(options?: any): any {
  const runtime = getPlaybackRuntimeModule();
  if (runtime && typeof runtime.syncLegacyWindowFlags === 'function') {
    return runtime.syncLegacyWindowFlags(getRuntimePlaybackState(), options);
  }
  return {
    isCardAnimating: getCardAnimating(),
    isProcessing: getProcessing(),
    playbackActive: getPlaybackActive()
  };
}

function ensureDebugRuntime(options?: any): any {
  const runtime = getPlaybackRuntimeModule();
  if (runtime && typeof runtime.ensureDebugRuntime === 'function') {
    return runtime.ensureDebugRuntime(getRuntimePlaybackState(), options);
  }
  return null;
}

function clearDebugRuntime(): boolean {
  const runtime = getPlaybackRuntimeModule();
  if (runtime && typeof runtime.clearDebugRuntime === 'function') {
    return runtime.clearDebugRuntime(getRuntimePlaybackState());
  }
  return true;
}

const PlaybackStateManager = {
  getPlaybackActive,
  setPlaybackActive,
  setPlaybackStartedAt,
  getCardAnimating,
  setCardAnimating,
  getProcessing,
  setProcessing,
  setBusyState,
  setInteractionLock,
  claimVisualPlayback,
  releaseVisualPlaybackClaim,
  clearVisualPlaybackClaims,
  hasClaimedVisualPlayback,
  acquireSelectionSettlementLock,
  releaseSelectionSettlementLock,
  clearSelectionSettlementLocks,
  hasSelectionSettlementLock,
  getPlaybackStartedAt,
  getPlaybackStaleMs,
  isPlaybackRunning,
  isPlaybackStale,
  ensurePlaybackStartedAt,
  beginPlayback,
  finalizePlayback,
  setBoardLockActive,
  getPresentationQueueState,
  getPresentationQueueEntries,
  hasPendingPresentationEvents,
  hasPendingVisualPlayback,
  waitForVisualPlaybackDrain,
  shouldDeferBoardUpdate,
  shouldDeferUiSync,
  getBoardUpdateContext,
  setBoardUpdateContext,
  armBoardUpdateContext,
  consumeBoardUpdateContext,
  clearBoardUpdateContext,
  getSelectionEntryPlaybackContext,
  setSelectionEntryPlaybackContext,
  armSelectionEntryPlaybackContext,
  clearSelectionEntryPlaybackContext,
  shouldAllowSelectionEntryDuringPlayback,
  getSuppressNextDiffFlip,
  setSuppressNextDiffFlip,
  consumeSuppressNextDiffFlip,
  registerPlaybackAbortHandle,
  clearPlaybackAbortHandle,
  abortPlayback,
  clearPlaybackLock,
  syncLegacyWindowFlags,
  ensureDebugRuntime,
  clearDebugRuntime
};

export = PlaybackStateManager;
