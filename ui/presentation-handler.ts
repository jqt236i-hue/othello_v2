import type { CardState, GameState, PlayerKey } from '../src/types';

'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

let gamePresentationRuntime: any = null;
let boardUpdateDrainController: any = null;
const missingRuntimeWarnings: any = Object.create(null);
let commentaryContextHelpers: any = null;
let ownerHelpers: any = null;
let commentaryBroker: any = null;
let stoneVisuals: any = null;
let presentationResolver: any = null;
let playbackEngineModule: any = null;
let pendingLocalBoardVisualSettlementClaim: any = null;
let activeLocalPresentationDrainClaim: any = null;

function isPresentationDebugEnabled(): boolean {
  try {
    const search = (typeof location !== 'undefined' && location && typeof location.search === 'string')
      ? location.search
      : ((typeof globalThis !== 'undefined' && (globalThis as any).location && typeof (globalThis as any).location.search === 'string')
        ? (globalThis as any).location.search
        : '');
    return /[?&]debug=1(?:&|$)/.test(search)
      || /[?&]debug=true(?:&|$)/i.test(search)
      || /[?&]specialDebug=1(?:&|$)/.test(search)
      || /[?&]specialDebug=true(?:&|$)/i.test(search)
      || /[?&]special-debug=1(?:&|$)/.test(search)
      || /[?&]special-debug=true(?:&|$)/i.test(search);
  } catch (e) { /* ignore */ }
  return false;
}

function emitPresentationDebugConsole(eventType: string, details?: any): void {
  if (!isPresentationDebugEnabled()) {
    try {
      const client = resolveFromGlobal('NetworkMatchClient');
      const state = client && typeof client.getState === 'function' ? client.getState() : null;
      if (!state || state.networkDebugEnabled !== true) return;
    } catch (e) {
      return;
    }
  }
  const line = `[presentation-debug] ${String(eventType || '').trim()}`;
  if (!line || line === '[presentation-debug]') return;
  try {
    if (typeof console !== 'undefined' && console && typeof console.log === 'function') {
      if (details && typeof details === 'object') {
        console.log(line, details);
      } else {
        console.log(line);
      }
    }
  } catch (e) { /* ignore */ }
}

function getPlaybackTargetSummary(playbackEvents: any[]): any[] {
  const out: any[] = [];
  const events = Array.isArray(playbackEvents) ? playbackEvents : [];
  for (const event of events) {
    if (!event || typeof event !== 'object') continue;
    const targets = Array.isArray(event.targets) ? event.targets : [];
    out.push({
      type: String(event.type || '').trim(),
      phase: Number.isFinite(Number(event.phase)) ? Number(event.phase) : null,
      targetCount: targets.length,
      causes: Array.from(new Set(targets
        .map((target: any) => String(target && target.cause || '').trim())
        .filter((value: string) => !!value))),
      reasons: Array.from(new Set(targets
        .map((target: any) => String(target && target.reason || '').trim())
        .filter((value: string) => !!value)))
    });
  }
  return out;
}

function resolvePresentationResolver(): any {
  if (presentationResolver) return presentationResolver;
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).AnimationResolver) {
      presentationResolver = (globalThis as any).AnimationResolver;
      return presentationResolver;
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && window && (window as any).AnimationResolver) {
      presentationResolver = (window as any).AnimationResolver;
      return presentationResolver;
    }
  } catch (e) { /* ignore */ }
  if (presentationResolver) return presentationResolver;
  try {
    if (typeof _require === 'function') {
      presentationResolver = _require('./animation-resolver');
      if (presentationResolver) return presentationResolver;
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveFromGlobal(name: string): any {
  const resolver = presentationResolver || resolvePresentationResolver();
  if (resolver && typeof resolver.resolveGlobal === 'function') {
    const resolved = resolver.resolveGlobal(name);
    if (resolved) return resolved;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any)[name]) {
      return (globalThis as any)[name];
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof window !== 'undefined' && window && (window as any)[name]) {
      return (window as any)[name];
    }
  } catch (e) { /* ignore */ }
  return null;
}

function resolveModuleOrGlobal(modulePath: string, globalName: string): any {
  const resolver = presentationResolver || resolvePresentationResolver();
  if (resolver && typeof resolver.resolveModuleOrGlobal === 'function') {
    const resolved = resolver.resolveModuleOrGlobal(modulePath, globalName);
    if (resolved) return resolved;
  }
  const globalResolved = resolveFromGlobal(globalName);
  if (globalResolved) return globalResolved;
  if (typeof _require === 'function') {
    try {
      return _require(modulePath);
    } catch (e) { /* ignore */ }
  }
  return null;
}

function resolveCommentaryContextHelpers(): any {
  if (commentaryContextHelpers) return commentaryContextHelpers;
  commentaryContextHelpers = resolveModuleOrGlobal('../shared/commentary-context-helpers', 'CommentaryContextHelpers');
  if (commentaryContextHelpers) return commentaryContextHelpers;
  return null;
}

function resolveBoardUtils(): any {
  return resolveModuleOrGlobal('../shared/board-utils', 'BoardUtils');
}

function resolveCommentaryBroker(): any {
  if (commentaryBroker) return commentaryBroker;
  commentaryBroker = resolveModuleOrGlobal('./commentary-broker', 'CommentaryBroker');
  if (commentaryBroker) return commentaryBroker;
  return null;
}

function resolveStoneVisuals(): any {
  if (stoneVisuals) return stoneVisuals;
  stoneVisuals = resolveModuleOrGlobal('./stone-visuals', 'StoneVisuals');
  if (stoneVisuals) return stoneVisuals;
  return null;
}

function resolveCrossfadeStoneVisual(): any {
  const visuals = resolveStoneVisuals();
  if (visuals && typeof visuals.crossfadeStoneVisual === 'function') {
    return visuals.crossfadeStoneVisual.bind(visuals);
  }
  if (typeof (crossfadeStoneVisual as any) === 'function') return crossfadeStoneVisual;
  return null;
}

function resolveDiscVisualSync(): any {
  const visuals = resolveStoneVisuals();
  if (visuals && typeof visuals.syncDiscVisualToCurrentState === 'function') {
    return visuals.syncDiscVisualToCurrentState.bind(visuals);
  }
  if (typeof (syncDiscVisualToCurrentState as any) === 'function') return syncDiscVisualToCurrentState;
  return null;
}

function resolveApplyStoneVisualState(): any {
  const visuals = resolveStoneVisuals();
  if (visuals && typeof visuals.applyStoneVisualState === 'function') {
    return visuals.applyStoneVisualState.bind(visuals);
  }
  if (typeof (applyStoneVisualState as any) === 'function') return applyStoneVisualState;
  return null;
}

function ensureCommentaryBrokerInitialized(): any {
  const broker = resolveCommentaryBroker();
  if (!broker || typeof broker.initBroker !== 'function') return broker;
  try {
    broker.initBroker({
      root: (typeof globalThis !== 'undefined') ? globalThis : null,
      addLog: (typeof addLog === 'function') ? addLog : null,
      getShowCpuSpeechBubble: () => {
        try {
          if (typeof globalThis !== 'undefined' && typeof (globalThis as any).showCpuSpeechBubble === 'function') {
            return (globalThis as any).showCpuSpeechBubble;
          }
        } catch (e) { /* ignore */ }
        return null;
      }
    });
  } catch (e) { /* ignore */ }
  return broker;
}

function resolveOwnerHelpers(): any {
  if (ownerHelpers) return ownerHelpers;
  ownerHelpers = resolveModuleOrGlobal('../utils/owner-helpers', 'OwnerHelpers');
  if (ownerHelpers) return ownerHelpers;
  return null;
}

function resolvePlaybackEngine(): any {
  if (playbackEngineModule) return playbackEngineModule;
  playbackEngineModule = resolveModuleOrGlobal('./playback-engine', 'PlaybackEngine');
  return playbackEngineModule;
}

function normalizeCommentaryPlayerKey(value: any, fallbackKey: string): string {
  const helpers = resolveCommentaryContextHelpers();
  if (helpers && typeof helpers.normalizePlayerKey === 'function') {
    return helpers.normalizePlayerKey(value, fallbackKey);
  }
  const normalized = String(value || '').trim().toLowerCase();
  if (value === -1 || normalized === 'white' || normalized === '-1') return 'white';
  if (value === 1 || normalized === 'black' || normalized === '1') return 'black';
  return fallbackKey === 'white' ? 'white' : 'black';
}

function countDiscsFromBoard(board: any): any {
  const boardUtils = resolveBoardUtils();
  if (boardUtils && typeof boardUtils.countDiscs === 'function') {
    return boardUtils.countDiscs(board);
  }
  const helpers = resolveCommentaryContextHelpers();
  if (helpers && typeof helpers.countDiscsFromBoard === 'function') {
    return helpers.countDiscsFromBoard(board);
  }
  const rows = Array.isArray(board) ? board : [];
  let black = 0;
  let white = 0;
  for (let row = 0; row < rows.length; row += 1) {
    const line = Array.isArray(rows[row]) ? rows[row] : [];
    for (let col = 0; col < line.length; col += 1) {
      const value = Number(line[col]);
      if (value === 1) black += 1;
      else if (value === -1) white += 1;
    }
  }
  return { black, white };
}

function getCurrentMatchMode(): string {
  try {
    const w = window as any;
    if (typeof window !== 'undefined' && window && typeof w.getCurrentMatchMode === 'function') {
      return String(w.getCurrentMatchMode() || 'cpu').trim().toLowerCase() || 'cpu';
    }
  } catch (e) { /* ignore */ }
  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).getCurrentMatchMode === 'function') {
      return String((globalThis as any).getCurrentMatchMode() || 'cpu').trim().toLowerCase() || 'cpu';
    }
  } catch (e) { /* ignore */ }
  return 'cpu';
}

function buildBoardSignature(board: any): string {
  try {
    return JSON.stringify(Array.isArray(board) ? board : []);
  } catch (e) {
    return '';
  }
}

function resolveGamePresentationRuntime(): any {
  if (gamePresentationRuntime) return gamePresentationRuntime;

  try {
    if (typeof _require === 'function') {
      const cpuTurnHandler = _require('../game/cpu-turn-handler');
      if (cpuTurnHandler && cpuTurnHandler.PresentationRuntime) {
        gamePresentationRuntime = cpuTurnHandler.PresentationRuntime;
        return gamePresentationRuntime;
      }
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof globalThis !== 'undefined' && (globalThis as any).GamePresentationRuntime) {
      gamePresentationRuntime = (globalThis as any).GamePresentationRuntime;
      return gamePresentationRuntime;
    }
  } catch (e) { /* ignore */ }

  return null;
}

function getBoardUpdateDrainController(): any {
  if (boardUpdateDrainController) return boardUpdateDrainController;

  const runtime = resolveGamePresentationRuntime();
  if (runtime && typeof runtime.createBoardUpdateDrainController === 'function') {
    boardUpdateDrainController = runtime.createBoardUpdateDrainController();
    return boardUpdateDrainController;
  }

  let drainInProgress = false;
  let drainPending = false;
  boardUpdateDrainController = {
    async requestDrain(runDrain: any) {
      drainPending = true;
      if (drainInProgress) return;

      drainInProgress = true;
      try {
        while (drainPending) {
          drainPending = false;
          if (typeof runDrain === 'function') {
            await runDrain();
          }
        }
      } finally {
        drainInProgress = false;
      }
    }
  };
  return boardUpdateDrainController;
}

function warnMissingPresentationRuntime(methodName: string): void {
  const key = String(methodName || '').trim() || 'unknown';
  if (missingRuntimeWarnings[key] === true) return;
  missingRuntimeWarnings[key] = true;
  try {
    console.warn(`[PresentationHandler] GamePresentationRuntime.${key} not available`);
  } catch (e) { /* ignore */ }
}

function getPresentationRuntimeMethod(methodName: string): any {
  const runtime = resolveGamePresentationRuntime();
  if (runtime && typeof runtime[methodName] === 'function') {
    return {
      runtime,
      method: runtime[methodName]
    };
  }
  warnMissingPresentationRuntime(methodName);
  return {
    runtime: null,
    method: null
  };
}

function queueCommentary(resultPromise: any): void {
  if (!resultPromise || typeof resultPromise.then !== 'function') return;
  resultPromise.then((entry: any) => {
    const broker = ensureCommentaryBrokerInitialized();
    if (broker && typeof broker.showCommentaryEntry === 'function') {
      broker.showCommentaryEntry(entry);
    }
  }).catch(() => {
    // Keep presentation flow deterministic.
  });
}

function emitCpuReactionToEnemyCard(ev: any): void {
  const runtime = resolveGamePresentationRuntime();
  if (!runtime || typeof runtime.requestEnemyCardCommentary !== 'function') return;
  queueCommentary(runtime.requestEnemyCardCommentary(ev));
}

function emitCpuReactionToEnemyCardFromPlayback(playbackEvents: any[]): boolean {
  const runtime = resolveGamePresentationRuntime();
  if (!runtime || typeof runtime.requestEnemyCardCommentaryFromPlayback !== 'function') return false;
  queueCommentary(runtime.requestEnemyCardCommentaryFromPlayback(playbackEvents));
  return true;
}

function isRawPresentationPlaybackBatch(payload: any[]): boolean {
  if (!Array.isArray(payload) || payload.length === 0) return false;
  for (let index = 0; index < payload.length; index += 1) {
    const ev = payload[index];
    const type = String(ev && ev.type || '').trim();
    if (!type || !/^[A-Z_]+$/.test(type)) {
      return false;
    }
  }
  return true;
}

function normalizePlaybackEventsForUi(payload: any[]): any[] {
  if (!isRawPresentationPlaybackBatch(payload)) return payload;
  try {
    const adapter = (typeof _require === 'function')
      ? _require('../game/turn/pipeline_ui_adapter')
      : (typeof (TurnPipelineUIAdapter as any) !== 'undefined' ? (TurnPipelineUIAdapter as any) : null);
    if (!adapter || typeof adapter.mapToPlaybackEvents !== 'function') return payload;
    const mapped = adapter.mapToPlaybackEvents(
      payload,
      (typeof cardState !== 'undefined') ? cardState : null,
      (typeof gameState !== 'undefined') ? gameState : null
    );
    const normalized = Array.isArray(mapped) && mapped.length > 0 ? mapped : payload;
    emitPresentationDebugConsole('playback_batch_normalized', {
      rawCount: payload.length,
      rawTypes: payload.map((item: any) => String(item && item.type || '').trim()).filter((value: string) => !!value),
      normalizedCount: Array.isArray(normalized) ? normalized.length : 0,
      normalizedTypes: Array.isArray(normalized)
        ? normalized.map((item: any) => String(item && item.type || '').trim()).filter((value: string) => !!value)
        : [],
      usedAdapter: Array.isArray(mapped) && mapped.length > 0
    });
    return normalized;
  } catch (e) {
    emitPresentationDebugConsole('playback_batch_normalize_failed', {
      rawCount: payload.length,
      rawTypes: payload.map((item: any) => String(item && item.type || '').trim()).filter((value: string) => !!value),
      error: e && (e as any).message ? String((e as any).message) : String(e || '')
    });
    return payload;
  }
}

function getPlaybackDispatchDeps(): any {
  const deps: any = {};
  const animationEngine = resolveFromGlobal('AnimationEngine');
  if (animationEngine) deps.AnimationEngine = animationEngine;
  const scheduleRuntimeMethod = getPresentationRuntimeMethod('scheduleCpuTurn');
  if (scheduleRuntimeMethod.method) {
    deps.scheduleCpuTurnEvent = function (ev: any) {
      return scheduleRuntimeMethod.method.call(scheduleRuntimeMethod.runtime, ev);
    };
  }
  return deps;
}

function resolvePlaybackStateManagerForPresentation(): any {
  const globalManager = resolveFromGlobal('PlaybackStateManager');
  if (globalManager && typeof globalManager === 'object') return globalManager;
  try {
    const manager = _require('./playback-state-manager');
    if (manager && typeof manager === 'object') return manager;
  } catch (e) { /* ignore */ }
  return null;
}

function collectPlaybackEventTypesForClaim(payload: any[]): string[] {
  const seen = new Set<string>();
  for (const item of payload) {
    const type = String(item && item.type ? item.type : '').trim();
    if (type) seen.add(type);
  }
  return Array.from(seen);
}

function getPlaybackEventsFromPresentationEventForClaim(ev: any): any[] {
  if (!ev || typeof ev !== 'object') return [];
  if (ev.type !== 'PLAYBACK_EVENTS') return [];
  if (ev.meta && ev.meta.suppressPlayback === true) return [];
  return normalizePlaybackEventsForUi(Array.isArray(ev.events) ? ev.events : []);
}

function claimPlaybackBatchForPresentation(ev: any, payload: any[]): any {
  const manager = resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.claimVisualPlayback !== 'function') return null;
  const meta = ev && ev.meta && typeof ev.meta === 'object' ? ev.meta : {};
  return manager.claimVisualPlayback({
    source: typeof meta.source === 'string' && meta.source.trim() ? meta.source.trim() : 'presentation_handler',
    reason: 'playback_batch_dispatch',
    scope: 'batch_handoff',
    eventCount: Array.isArray(payload) ? payload.length : 0,
    eventTypes: collectPlaybackEventTypesForClaim(payload),
    strictNetworkPlayback: meta.strictNetworkPlayback === true,
    restoreBusyBaseline: meta.strictNetworkPlayback === true ? false : undefined
  });
}

function claimPresentationDrainForEvents(events: any[]): any {
  const list = Array.isArray(events) ? events : [];
  const playbackPayloads = list
    .map(getPlaybackEventsFromPresentationEventForClaim)
    .filter((payload) => payload.length > 0);
  if (!playbackPayloads.length) return null;
  const mergedPayload = ([] as any[]).concat(...playbackPayloads);
  const manager = resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.claimVisualPlayback !== 'function') return null;
  const strictEvent = list.find((event) => !!(
    event && event.meta && event.meta.strictNetworkPlayback === true
  ));
  const strictNetworkPlayback = !!strictEvent;
  const managerClaim = manager.claimVisualPlayback({
    source: 'presentation_handler',
    reason: 'presentation_queue_drain',
    scope: 'presentation_drain',
    eventCount: mergedPayload.length,
    eventTypes: collectPlaybackEventTypesForClaim(mergedPayload),
    strictNetworkPlayback
  });
  let boardWriterToken: any = null;
  // Strict-network ownership is transferred by the typed dispatcher/timeline
  // settlement handle in Phase 8. Until that handoff exists, keep the existing
  // manager-owned strict drain lifecycle and do not create an orphaned board
  // writer token here. Local drains can complete their final frame atomically.
  if (!strictNetworkPlayback) {
    try {
      const renderer = _require('./board-renderer');
      if (renderer && typeof renderer.claimBoardVisualWriter === 'function') {
        boardWriterToken = renderer.claimBoardVisualWriter(`local:${String(managerClaim.id)}`, 'local');
      }
    } catch (error) {
      manager.releaseVisualPlaybackClaim(managerClaim);
      throw error;
    }
  }
  return {
    managerClaim,
    boardWriterToken,
    managerFinalizers: [],
    meta: {
      scope: 'presentation_drain',
      strictNetworkPlayback
    }
  };
}

function releasePlaybackClaimForPresentation(claim: any): boolean {
  if (!claim) return false;
  const manager = resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.releaseVisualPlaybackClaim !== 'function') return false;
  return manager.releaseVisualPlaybackClaim(claim.managerClaim || claim);
}

function hasActivePlaybackClaimForPresentation(): boolean {
  const manager = resolvePlaybackStateManagerForPresentation();
  if (manager && typeof manager.hasClaimedVisualPlayback === 'function') {
    try { return manager.hasClaimedVisualPlayback() === true; } catch (e) { /* ignore */ }
  }
  return false;
}

function requestBoardSyncAfterPlaybackClaimRelease(reason: string): boolean {
  const payload = {
    source: 'ui.presentation-handler',
    reason: reason || 'playback_claim_released'
  };
  const emitBoardUpdate = resolveFromGlobal('emitBoardUpdate');
  if (typeof emitBoardUpdate === 'function') {
    try { return emitBoardUpdate(payload) !== false; } catch (e) { return false; }
  }
  const renderScheduler = resolveFromGlobal('RenderScheduler');
  if (renderScheduler && typeof renderScheduler.requestBoardRender === 'function') {
    try { return renderScheduler.requestBoardRender(payload) !== false; } catch (e) { return false; }
  }
  const renderBoard = resolveFromGlobal('renderBoard');
  if (typeof renderBoard === 'function') {
    try { renderBoard(); return true; } catch (e) { return false; }
  }
  return false;
}

async function releasePlaybackClaimAndRequestBoardSync(claim: any, reason: string): Promise<boolean> {
  const isFinalLocalSettlement = !!(
    claim && claim.meta && claim.meta.strictNetworkPlayback !== true
    && claim.boardWriterToken
  );
  if (isFinalLocalSettlement) {
    try {
      const renderer = _require('./board-renderer');
      if (claim.boardWriterToken && renderer && typeof renderer.releaseBoardVisualWriter === 'function') {
        if (typeof renderer.settleBoardVisualWriter === 'function') {
          await renderer.settleBoardVisualWriter(claim.boardWriterToken);
        } else {
          if (typeof renderer.renderBoard === 'function') renderer.renderBoard();
          renderer.releaseBoardVisualWriter(claim.boardWriterToken);
        }
        claim.boardWriterToken = null;
      } else if (renderer && typeof renderer.settleAutoBoardVisualWriter === 'function') {
        renderer.settleAutoBoardVisualWriter();
      }
    } catch (error) {
      throw error;
    }
  }
  const managerFinalizers = claim && Array.isArray(claim.managerFinalizers)
    ? claim.managerFinalizers
    : [];
  while (managerFinalizers.length > 0) {
    const finalizer = managerFinalizers[0];
    if (typeof finalizer !== 'function' || finalizer() !== true) {
      throw new Error('Local playback manager did not finalize');
    }
    managerFinalizers.shift();
  }
  const released = releasePlaybackClaimForPresentation(claim);
  if (released && !hasActivePlaybackClaimForPresentation()) {
    requestBoardSyncAfterPlaybackClaimRelease(reason);
  }
  return released;
}

function createStrictNetworkSettlementHandle(options: {
  visualSeq: number;
  managerClaim: any;
  boardWriterToken: any;
  renderer: any;
}) {
  const manager = resolvePlaybackStateManagerForPresentation();
  let handedOff = false;
  let awaitingFrameCommit = false;
  let committedFrameApplied = false;
  let boardReleased = false;
  let managerReleased = false;
  let managerFinalized = false;
  let managerFinalizer: (() => boolean) | null = null;
  let applyPromise: Promise<boolean> | null = null;
  let settlePromise: Promise<boolean> | null = null;
  let cancelPromise: Promise<boolean> | null = null;
  let terminalOperation: 'settle' | 'cancel' | null = null;
  const assertOwned = () => {
    if (!options.boardWriterToken || !options.managerClaim) {
      throw new Error('Strict network settlement handle has no active ownership');
    }
  };
  const abortBeforeHandoff = async (primaryError?: unknown) => {
    if (handedOff || managerReleased) return false;
    try {
      if (!boardReleased) {
        if (typeof options.renderer.abortBoardVisualWriterBeforeHandoff !== 'function') {
          throw new Error('Strict network writer abort API is unavailable');
        }
        await options.renderer.abortBoardVisualWriterBeforeHandoff(options.boardWriterToken);
        boardReleased = true;
      }
    } catch (recoveryError) {
      if (primaryError instanceof Error) {
        Object.defineProperty(primaryError, 'recoveryError', {
          value: recoveryError,
          configurable: true,
          enumerable: false,
          writable: false
        });
        throw primaryError;
      }
      throw recoveryError;
    }
    if (manager && typeof manager.releaseVisualPlaybackClaim === 'function') {
      managerReleased = manager.releaseVisualPlaybackClaim(options.managerClaim) === true;
    }
    return managerReleased;
  };
  const publicHandle = Object.freeze({
    kind: 'strict-network-settlement' as const,
    visualSeq: options.visualSeq,
    async applyCommittedFrame(receipt: any) {
      assertOwned();
      if (terminalOperation) throw new Error('Strict network settlement is already terminating');
      if (committedFrameApplied) return true;
      if (!handedOff) throw new Error('Strict network settlement ownership has not been handed off');
      if (!awaitingFrameCommit) throw new Error('Strict network settlement is not awaiting a committed frame');
      if (
        !receipt
        || receipt.kind !== 'network-visual-commit'
        || receipt.visualSeq !== options.visualSeq
      ) {
        throw new Error('Strict network committed-frame receipt does not match the active visual sequence');
      }
      if (!applyPromise) {
        applyPromise = (async () => {
          const applied = await options.renderer.applyCommittedBoardVisualFrame(options.boardWriterToken, receipt);
          if (applied !== true) throw new Error('Strict network committed board frame was not applied');
          committedFrameApplied = true;
          return true;
        })();
      }
      try {
        return await applyPromise;
      } catch (error) {
        applyPromise = null;
        throw error;
      }
    },
    async settle() {
      assertOwned();
      if (managerReleased) return false;
      if (terminalOperation === 'cancel') return cancelPromise;
      if (terminalOperation === 'settle' && settlePromise) return settlePromise;
      terminalOperation = 'settle';
      if (!settlePromise) {
        settlePromise = (async () => {
          if (applyPromise) await applyPromise;
          if (!committedFrameApplied) throw new Error('Strict network visual frame has not been committed');
          if (!managerFinalizer) throw new Error('Strict network manager finalizer is unavailable');
          if (!boardReleased) {
            options.renderer.releaseBoardVisualWriter(options.boardWriterToken);
            boardReleased = true;
          }
          if (!managerFinalized && managerFinalizer() !== true) {
            throw new Error('Strict network playback manager did not finalize');
          }
          managerFinalized = true;
          if (!manager || typeof manager.releaseVisualPlaybackClaim !== 'function') {
            throw new Error('PlaybackStateManager cannot release strict network settlement');
          }
          if (manager.releaseVisualPlaybackClaim(options.managerClaim) !== true) {
            throw new Error('Strict network playback manager claim was not released');
          }
          managerReleased = true;
          return true;
        })();
      }
      try {
        return await settlePromise;
      } catch (error) {
        settlePromise = null;
        terminalOperation = null;
        throw error;
      }
    },
    async cancel(reason?: any) {
      assertOwned();
      if (managerReleased) return false;
      if (terminalOperation === 'settle') return settlePromise;
      if (terminalOperation === 'cancel' && cancelPromise) return cancelPromise;
      terminalOperation = 'cancel';
      const cancelReason = String(reason || 'strict_network_settlement_cancelled');
      cancelPromise = (async () => {
        if (applyPromise) {
          try { await applyPromise; } catch (e) { /* cancellation restores the pre-frame checkpoint */ }
        }
        if (!manager || typeof manager.recordVisualPlaybackSettlementError !== 'function') {
          throw new Error('PlaybackStateManager cannot record strict network cancellation');
        }
        if (manager.recordVisualPlaybackSettlementError(options.managerClaim, new Error(cancelReason), {
          stage: handedOff ? 'post-handoff-cancel' : 'pre-handoff-recovery-cancel',
          visualSeq: options.visualSeq
        }) !== true) {
          throw new Error('PlaybackStateManager rejected strict network cancellation');
        }
        if (!boardReleased) {
          if (handedOff) {
            if (typeof options.renderer.cancelBoardVisualWriterAfterHandoff !== 'function') {
              throw new Error('Strict network post-handoff writer cancel API is unavailable');
            }
            await options.renderer.cancelBoardVisualWriterAfterHandoff(options.boardWriterToken);
          } else {
            if (typeof options.renderer.abortBoardVisualWriterBeforeHandoff !== 'function') {
              throw new Error('Strict network pre-handoff writer cancel API is unavailable');
            }
            await options.renderer.abortBoardVisualWriterBeforeHandoff(options.boardWriterToken);
          }
          boardReleased = true;
        }
        if (managerFinalizer && !managerFinalized) {
          if (managerFinalizer() !== true) {
            throw new Error('Strict network playback manager did not finalize during cancellation');
          }
          managerFinalized = true;
        }
        if (typeof manager.releaseVisualPlaybackClaim !== 'function') {
          throw new Error('PlaybackStateManager cannot release strict network cancellation');
        }
        if (manager.releaseVisualPlaybackClaim(options.managerClaim) !== true) {
          throw new Error('Strict network cancellation claim was not released');
        }
        managerReleased = true;
        return true;
      })();
      try {
        return await cancelPromise;
      } catch (error) {
        cancelPromise = null;
        terminalOperation = null;
        throw error;
      }
    }
  });
  return Object.freeze({
    publicHandle,
    beginAwaiting() {
      assertOwned();
      if (handedOff) throw new Error('Strict network settlement ownership was handed off before commit wait began');
      if (!awaitingFrameCommit) {
        options.renderer.beginBoardVisualFrameCommit(options.boardWriterToken);
        awaitingFrameCommit = true;
      }
      return true;
    },
    setManagerFinalizer(finalizer: unknown) {
      if (typeof finalizer !== 'function') throw new Error('Strict network manager finalizer is unavailable');
      if (managerFinalizer) throw new Error('Strict network manager finalizer was registered twice');
      managerFinalizer = finalizer as () => boolean;
      return true;
    },
    handoff() {
      if (handedOff) throw new Error('Strict network settlement ownership was handed off twice');
      if (!awaitingFrameCommit) throw new Error('Strict network settlement cannot hand off before commit wait');
      handedOff = true;
      return publicHandle;
    },
    async abortBeforeHandoff(primaryError?: unknown) {
      return abortBeforeHandoff(primaryError);
    }
  });
}

async function playPlaybackEvents(ev: any, options?: any): Promise<any> {
  const payload = normalizePlaybackEventsForUi(Array.isArray(ev && ev.events) ? ev.events : []);
  const strictNetworkPlayback = !!(ev && ev.meta && ev.meta.strictNetworkPlayback === true);
  if (!payload.length && !strictNetworkPlayback) return;
  const suppressPlayback = !!(ev && ev.meta && ev.meta.suppressPlayback === true);
  const payloadTypes = payload.map((item: any) => String(item && item.type || '').trim()).filter((value: string) => !!value);

  const opts = options && typeof options === 'object' ? options : {};
  emitPresentationDebugConsole('playback_batch_received', {
    source: ev && ev.meta && ev.meta.source ? String(ev.meta.source) : '',
    suppressPlayback,
    payloadCount: payload.length,
    payloadTypes,
    targetSummary: getPlaybackTargetSummary(payload)
  });
  if (!suppressPlayback) {
    if (opts.emitEnemyCardReaction !== false) {
      emitCpuReactionToEnemyCardFromPlayback(payload);
    }
  }
  if (suppressPlayback) {
    emitPresentationDebugConsole('playback_batch_suppressed', {
      source: ev && ev.meta && ev.meta.source ? String(ev.meta.source) : '',
      payloadCount: payload.length,
      payloadTypes
    });
    return;
  }

  const playbackClaim = claimPlaybackBatchForPresentation(ev, payload);
  let strictSettlement: any = null;
  let strictOwnershipTransferred = false;
  let deferredManagerFinalizer: (() => boolean) | null = payload.length === 0 ? (() => true) : null;
  if (strictNetworkPlayback) {
    let renderer: any = null;
    let boardWriterToken: any = null;
    try {
      if (!playbackClaim) throw new Error('strict_network_playback_manager_unavailable');
      renderer = _require('./board-renderer');
      if (!renderer || typeof renderer.claimBoardVisualWriter !== 'function') {
        throw new Error('strict_network_board_visual_controller_unavailable');
      }
      const visualSeq = Number(ev && ev.meta && ev.meta.visualSeq);
      if (!Number.isInteger(visualSeq) || visualSeq < 0) {
        throw new Error('strict_network_visual_seq_required');
      }
      boardWriterToken = renderer.claimBoardVisualWriter(`network:${visualSeq}`, 'network');
      strictSettlement = createStrictNetworkSettlementHandle({
        visualSeq,
        managerClaim: playbackClaim,
        boardWriterToken,
        renderer
      });
    } catch (error) {
      if (boardWriterToken && renderer) {
        try {
          if (typeof renderer.abortBoardVisualWriterBeforeHandoff !== 'function') {
            throw new Error('Strict network writer abort API is unavailable');
          }
          await renderer.abortBoardVisualWriterBeforeHandoff(boardWriterToken);
        } catch (recoveryError) {
          if (error instanceof Error) {
            Object.defineProperty(error, 'recoveryError', {
              value: recoveryError,
              configurable: true,
              enumerable: false,
              writable: false
            });
          }
          throw error;
        }
      }
      releasePlaybackClaimForPresentation(playbackClaim);
      throw error;
    }
  } else if (!activeLocalPresentationDrainClaim && playbackClaim && typeof document !== 'undefined') {
    try {
      const renderer = _require('./board-renderer');
      if (!renderer || typeof renderer.claimBoardVisualWriter !== 'function') {
        throw new Error('local_board_visual_controller_unavailable');
      }
      playbackClaim.boardWriterToken = renderer.claimBoardVisualWriter(
        `local-batch:${String(playbackClaim.id)}`,
        'local'
      );
      playbackClaim.managerFinalizers = [];
    } catch (error) {
      releasePlaybackClaimForPresentation(playbackClaim);
      throw error;
    }
  }
  try {
    const playbackDispatchDeps = getPlaybackDispatchDeps();
    const playbackEngineDeps = Object.assign({}, playbackDispatchDeps, {
      strictNetworkPlayback,
      deferFinalSettlement: true,
      onFinalizationReady(finalizer: unknown) {
        if (typeof finalizer !== 'function') throw new Error('playback_manager_finalizer_invalid');
        if (deferredManagerFinalizer) throw new Error('playback_manager_finalizer_registered_twice');
        deferredManagerFinalizer = finalizer as () => boolean;
      }
    });
    const playbackEventForDispatch = {
      type: 'PLAYBACK_EVENTS',
      events: payload,
      meta: ev && ev.meta && typeof ev.meta === 'object' ? Object.assign({}, ev.meta) : undefined
    };
    const playbackEngine = resolvePlaybackEngine();
    let dispatched = payload.length === 0;
    if (!dispatched) {
      try {
        if (playbackEngine && typeof playbackEngine.dispatchPresentationEvent === 'function') {
          const startedAt = Date.now();
          emitPresentationDebugConsole('playback_batch_dispatch_engine', {
            payloadCount: payload.length,
            payloadTypes,
            hasAnimationEngine: !!(playbackDispatchDeps && playbackDispatchDeps.AnimationEngine),
            animationEngineHasPlay: !!(playbackDispatchDeps && playbackDispatchDeps.AnimationEngine && typeof playbackDispatchDeps.AnimationEngine.play === 'function')
          });
          await playbackEngine.dispatchPresentationEvent(playbackEventForDispatch, playbackEngineDeps);
          emitPresentationDebugConsole('playback_batch_dispatch_engine_resolved', {
            payloadCount: payload.length,
            payloadTypes,
            elapsedMs: Date.now() - startedAt
          });
          dispatched = true;
        }
      } catch (e) {
        emitPresentationDebugConsole('playback_batch_dispatch_engine_failed', {
          payloadCount: payload.length,
          payloadTypes,
          error: e && (e as any).message ? String((e as any).message) : String(e || '')
        });
        if (strictNetworkPlayback) throw e;
      }
    }

    if (!dispatched) {
      try {
        const animationEngine = playbackDispatchDeps.AnimationEngine;
        if (animationEngine && typeof animationEngine.play === 'function') {
          const startedAt = Date.now();
          emitPresentationDebugConsole('playback_batch_animation_engine', {
            payloadCount: payload.length,
            payloadTypes
          });
          if (strictNetworkPlayback) {
            await animationEngine.play(payload, {
              strictNetworkPlayback: true,
              deferFinalSettlement: true,
              onFinalizationReady: playbackEngineDeps.onFinalizationReady
            });
          } else {
            await animationEngine.play(payload, {
              deferFinalSettlement: true,
              onFinalizationReady: playbackEngineDeps.onFinalizationReady
            });
          }
          emitPresentationDebugConsole('playback_batch_animation_engine_resolved', {
            payloadCount: payload.length,
            payloadTypes,
            elapsedMs: Date.now() - startedAt
          });
          dispatched = true;
        } else {
          emitPresentationDebugConsole('playback_batch_no_animation_engine', {
            payloadCount: payload.length,
            payloadTypes
          });
          if (strictNetworkPlayback) {
            throw new Error('strict_network_playback_animation_engine_unavailable');
          }
        }
      } catch (e) {
        emitPresentationDebugConsole('playback_batch_failed', {
          payloadCount: payload.length,
          payloadTypes,
          error: e && (e as any).message ? String((e as any).message) : String(e || '')
        });
        try { console.warn('[PresentationHandler] playback failed', e); } catch (e2) { /* ignore */ }
        if (strictNetworkPlayback) throw e;
      }
    }

    if (strictNetworkPlayback) {
      strictSettlement.setManagerFinalizer(deferredManagerFinalizer);
      strictSettlement.beginAwaiting();
      const settlementHandle = strictSettlement.handoff();
      strictOwnershipTransferred = true;
      return settlementHandle;
    }
    if (!deferredManagerFinalizer) throw new Error('local_playback_manager_finalizer_unavailable');
    const finalizationOwner = activeLocalPresentationDrainClaim || playbackClaim;
    if (!Array.isArray(finalizationOwner.managerFinalizers)) finalizationOwner.managerFinalizers = [];
    finalizationOwner.managerFinalizers.push(deferredManagerFinalizer);
  } catch (error) {
    if (strictNetworkPlayback && strictSettlement) {
      try {
        await strictSettlement.abortBeforeHandoff(error);
        strictOwnershipTransferred = true;
      } catch (recoveryError) {
        strictOwnershipTransferred = true;
        if (error && typeof error === 'object') {
          Object.defineProperty(error, 'strictSettlementRecoveryHandle', {
            value: strictSettlement.publicHandle,
            configurable: true,
            enumerable: false,
            writable: false
          });
        }
        throw recoveryError;
      }
    }
    throw error;
  } finally {
    if (!strictNetworkPlayback || !strictOwnershipTransferred) {
      if (playbackClaim && playbackClaim.boardWriterToken) {
        pendingLocalBoardVisualSettlementClaim = playbackClaim;
      }
      if (await releasePlaybackClaimAndRequestBoardSync(playbackClaim, 'playback_batch_claim_released')) {
        if (pendingLocalBoardVisualSettlementClaim === playbackClaim) {
          pendingLocalBoardVisualSettlementClaim = null;
        }
      }
    }
  }
}

function applyCrossfadeStone(ev: any): void {
  const row = ev && ev.row;
  const col = ev && ev.col;
  if (!Number.isFinite(row) || !Number.isFinite(col)) return;

  const tryApply = function (retries: number) {
    try {
      const cell = document.querySelector('.cell[data-row="' + row + '"][data-col="' + col + '"]');
      const disc = cell ? cell.querySelector('.disc') : null;
      if (!disc) {
        if (retries > 0) setTimeout(function () { tryApply(retries - 1); }, 80);
        return;
      }

      try {
        const syncDiscVisual = resolveDiscVisualSync();
        if (typeof syncDiscVisual === 'function') syncDiscVisual(row, col);
      } catch (e) { /* ignore */ }

      const applyStoneVisualState = resolveApplyStoneVisualState();
      const crossfadeStone = resolveCrossfadeStoneVisual();
      if (typeof crossfadeStone === 'function') {
        crossfadeStone(disc, {
          effectKey: ev.effectKey,
          owner: ev.owner,
          newColor: ev.newColor,
          durationMs: ev.durationMs,
          autoFadeOut: ev.autoFadeOut,
          fadeWholeStone: ev.fadeWholeStone
        }).catch(function () { /* Intentionally empty: fire-and-forget animation */ });
      } else if (typeof applyStoneVisualState === 'function') {
        applyStoneVisualState(disc, {
          effectKey: ev.effectKey,
          owner: ev.owner,
          newColor: ev.newColor
        });
      } else if (typeof (applyStoneVisualEffect as any) === 'function') {
        (applyStoneVisualEffect as any)(disc, ev.effectKey, { owner: ev.owner });
      }
    } catch (e) {
      if (retries > 0) setTimeout(function () { tryApply(retries - 1); }, 80);
    }
  };
  tryApply(5);
}

function handlePresentationEvent(ev: any): any {
  try {
    if (!ev || !ev.type) return;

    if (ev.type === 'PLAYBACK_EVENTS') {
      return playPlaybackEvents(ev);
    }

    if (ev.type === 'CARD_USED') {
      const owner = (ev.meta && ev.meta.owner) ? ev.meta.owner : (ev.player || null);
      const sacrificeWill = (ev.meta && ev.meta.sacrificeWill && typeof ev.meta.sacrificeWill === 'object')
        ? ev.meta.sacrificeWill
        : null;
      const playback = [{
        type: 'card_use_animation',
        phase: 1,
        targets: [{
          player: ev.player || null,
          owner: owner,
          cardId: ev.cardId || null,
          cost: (ev.meta && Number.isFinite(ev.meta.cost)) ? ev.meta.cost : null,
          name: (ev.meta && ev.meta.name) ? ev.meta.name : null,
          nullifiedBySacrificeWill: !!(ev.meta && ev.meta.nullifiedBySacrificeWill === true),
          cardUseVanishEffect: (ev.meta && ev.meta.cardUseVanishEffect) ? ev.meta.cardUseVanishEffect : null,
          sacrificeWill
        }]
      }];
      emitCpuReactionToEnemyCard(ev);
      return playPlaybackEvents(
        { events: playback },
        {
          emitEnemyCardReaction: false
        }
      );
    }

    if (ev.type === 'SCHEDULE_CPU_TURN') {
      const playbackEngine = resolvePlaybackEngine();
      const playbackDispatchDeps = getPlaybackDispatchDeps();
      if (playbackEngine && typeof playbackEngine.dispatchPresentationEvent === 'function') {
        return playbackEngine.dispatchPresentationEvent(ev, playbackDispatchDeps);
      }
      if (playbackDispatchDeps.scheduleCpuTurnEvent) {
        return playbackDispatchDeps.scheduleCpuTurnEvent(ev);
      }
      return;
    }

    if (ev.type === 'CROSSFADE_STONE') {
      applyCrossfadeStone(ev);
      return;
    }

    if (ev.type === 'PROTECTION_EXPIRE') {
      if (typeof (animateProtectionExpireAt as any) === 'function') {
        try { (animateProtectionExpireAt as any)(ev.row, ev.col); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) {
    console.error('[PresentationHandler] handlePresentationEvent error', e);
  }
}

function flushPendingPresentationEvents(): any[] {
  const runtimeMethod = getPresentationRuntimeMethod('flushPendingPresentationEvents');
  if (runtimeMethod.method) {
    return runtimeMethod.method.call(runtimeMethod.runtime);
  }
  return [];
}

async function flushBoardPresentationEvents(): Promise<void> {
  let drainClaim: any = null;
  try {
    if (pendingLocalBoardVisualSettlementClaim) {
      const pendingClaim = pendingLocalBoardVisualSettlementClaim;
      if (await releasePlaybackClaimAndRequestBoardSync(pendingClaim, 'presentation_drain_recovery_settled')) {
        pendingLocalBoardVisualSettlementClaim = null;
      }
    }
    const events = flushPendingPresentationEvents();
    drainClaim = claimPresentationDrainForEvents(events);
    if (drainClaim && drainClaim.meta && drainClaim.meta.strictNetworkPlayback !== true) {
      activeLocalPresentationDrainClaim = drainClaim;
    }
    emitPresentationDebugConsole('board_updated_flush', {
      eventCount: Array.isArray(events) ? events.length : 0,
      eventTypes: Array.isArray(events)
        ? events.map((item: any) => String(item && item.type || '').trim()).filter((value: string) => !!value)
        : []
    });
    try {
      const drainChargeDeltaPopups = (typeof window !== 'undefined' && typeof (window as any).drainVisibleChargeDeltaPopups === 'function')
        ? (window as any).drainVisibleChargeDeltaPopups
        : ((typeof (drainVisibleChargeDeltaPopups as any) === 'function') ? drainVisibleChargeDeltaPopups : null);
      if (drainChargeDeltaPopups) {
        drainChargeDeltaPopups({ allowRawFallback: false });
      }
    } catch (e) { /* ignore */ }
    for (const ev of events) {
      await handlePresentationEvent(ev);
    }

  } catch (e) {
    console.error('[PresentationHandler] onBoardUpdated error', e);
  } finally {
    if (activeLocalPresentationDrainClaim === drainClaim) {
      activeLocalPresentationDrainClaim = null;
    }
    if (drainClaim) {
      const isRecoverableLocalClaim = !!(
        drainClaim.meta
        && drainClaim.meta.scope === 'presentation_drain'
        && drainClaim.meta.strictNetworkPlayback !== true
        && drainClaim.boardWriterToken
      );
      if (isRecoverableLocalClaim) pendingLocalBoardVisualSettlementClaim = drainClaim;
      if (await releasePlaybackClaimAndRequestBoardSync(drainClaim, 'presentation_drain_claim_released')) {
        if (pendingLocalBoardVisualSettlementClaim === drainClaim) {
          pendingLocalBoardVisualSettlementClaim = null;
        }
      }
    }
  }
}

function onBoardUpdated(): Promise<void> {
  return getBoardUpdateDrainController().requestDrain(flushBoardPresentationEvents);
}

try {
  if (typeof (GameEvents as any) !== 'undefined' && (GameEvents as any) && (GameEvents as any).gameEvents && typeof (GameEvents as any).gameEvents.on === 'function') {
    (GameEvents as any).gameEvents.on('boardUpdated', onBoardUpdated);
    (GameEvents as any).gameEvents.on('BOARD_UPDATED', onBoardUpdated);
  } else {
    try { console.warn('[PresentationHandler] GameEvents not available; presentation events will not auto-play.'); } catch (e) { /* ignore */ }
    const runtimeMethod = getPresentationRuntimeMethod('flushPendingPresentationEvents');
    if (runtimeMethod.method) {
      setTimeout(function () {
        try {
          Promise.resolve(onBoardUpdated()).catch(function () { /* ignore fallback drain failure */ });
        } catch (e) { /* ignore */ }
      }, 60);
    }
  }
} catch (e) {
  try { console.warn('[PresentationHandler] initialization failed', e); } catch (e2) { /* ignore */ }
}

const PresentationHandler = {
  onBoardUpdated,
  handlePresentationEvent
};

export = PresentationHandler;
