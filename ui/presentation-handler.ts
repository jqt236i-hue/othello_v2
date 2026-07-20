import type { CardState, GameState, PlayerKey } from '../src/types';

'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;
const PlaybackSettlementContract = _require('./playback-settlement');

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
let legacyBoardPresentationSequence = 0;
let detachedLegacyBoardPresentationLease: any = null;

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
    playbackSettlements: [],
    boardPresentationSettlements: [],
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

function finalizePlaybackSettlements(claim: any): void {
  const playbackSettlements = claim && Array.isArray(claim.playbackSettlements)
    ? claim.playbackSettlements
    : [];
  while (playbackSettlements.length > 0) {
    const settlement = requirePlaybackSettlementResult(playbackSettlements[0]);
    if (settlement.finalize() !== true) {
      throw createPlaybackSettlementContractError(
        'local_playback_settlement_rejected',
        `Local playback settlement rejected run ${settlement.runId}`
      );
    }
    playbackSettlements.shift();
  }
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
        await renderer.settleAutoBoardVisualWriter();
      }
    } catch (error) {
      throw error;
    }
  }
  finalizePlaybackSettlements(claim);
  const released = releasePlaybackClaimForPresentation(claim);
  if (released && !hasActivePlaybackClaimForPresentation()) {
    requestBoardSyncAfterPlaybackClaimRelease(reason);
  }
  return released;
}

function createStrictNetworkSettlementError(
  code: string,
  message: string,
  visualSeq: number
): Error & { code: string; strictNetworkPlayback: true; visualSeq: number } {
  const error = new Error(message) as Error & {
    code: string;
    strictNetworkPlayback: true;
    visualSeq: number;
  };
  error.name = 'PresentationPlaybackError';
  error.code = code;
  error.strictNetworkPlayback = true;
  error.visualSeq = visualSeq;
  return error;
}

function createPlaybackSettlementContractError(code: string, message: string, cause?: unknown): any {
  if (
    PlaybackSettlementContract
    && typeof PlaybackSettlementContract.createPlaybackSettlementError === 'function'
  ) {
    return PlaybackSettlementContract.createPlaybackSettlementError(code, message, cause);
  }
  const error: any = new Error(message);
  error.name = 'PresentationPlaybackError';
  error.code = code;
  if (typeof cause !== 'undefined') error.cause = cause;
  return error;
}

function requirePlaybackSettlementResult(value: unknown): any {
  if (
    PlaybackSettlementContract
    && typeof PlaybackSettlementContract.assertPlaybackSettlementResult === 'function'
  ) {
    return PlaybackSettlementContract.assertPlaybackSettlementResult(value);
  }
  throw createPlaybackSettlementContractError(
    'playback_settlement_contract_unavailable',
    'Playback settlement contract is unavailable'
  );
}

function createStrictNetworkSettlementHandle(options: {
  visualSeq: number;
  managerClaim: any;
  boardWriterToken: any;
  renderer: any;
  requiresPlaybackSettlement: boolean;
}) {
  const manager = resolvePlaybackStateManagerForPresentation();
  let handedOff = false;
  let awaitingFrameCommit = false;
  let committedFrameApplied = false;
  let boardReleased = false;
  let managerReleased = false;
  let playbackSettlementFinalized = false;
  let playbackSettlementResult: any = null;
  let applyPromise: Promise<boolean> | null = null;
  let settlePromise: Promise<boolean> | null = null;
  let cancelPromise: Promise<boolean> | null = null;
  let terminalOperation: 'settle' | 'cancel' | null = null;
  const assertOwned = () => {
    if (!options.boardWriterToken || !options.managerClaim) {
      throw new Error('Strict network settlement handle has no active ownership');
    }
  };
  const finalizePlaybackSettlement = (allowMissing = false) => {
    if (!options.requiresPlaybackSettlement) return true;
    if (playbackSettlementFinalized) return true;
    if (!playbackSettlementResult) {
      if (allowMissing) return true;
      throw createPlaybackSettlementContractError(
        'strict_network_playback_settlement_unavailable',
        'Strict network playback settlement result is unavailable'
      );
    }
    if (playbackSettlementResult.finalize() !== true) {
      throw createPlaybackSettlementContractError(
        'strict_network_playback_settlement_rejected',
        `Strict network playback settlement rejected run ${playbackSettlementResult.runId}`
      );
    }
    playbackSettlementFinalized = true;
    return true;
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
      // Animation may already have returned its run-scoped manager settlement
      // before committed-frame preparation fails. Consume that registered
      // result after the writer abort and before releasing the outer claim so
      // VisualPlaybackActive cannot outlive the recovery owner.
      finalizePlaybackSettlement(true);
      if (!manager || typeof manager.releaseVisualPlaybackClaim !== 'function') {
        throw createStrictNetworkSettlementError(
          'strict_network_manager_release_unavailable',
          'PlaybackStateManager cannot release strict network playback before handoff',
          options.visualSeq
        );
      }
      if (manager.releaseVisualPlaybackClaim(options.managerClaim) !== true) {
        throw createStrictNetworkSettlementError(
          'strict_network_manager_release_failed',
          'Strict network playback manager claim was not released before handoff',
          options.visualSeq
        );
      }
      managerReleased = true;
      return true;
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
          if (!boardReleased) {
            options.renderer.releaseBoardVisualWriter(options.boardWriterToken);
            boardReleased = true;
          }
          finalizePlaybackSettlement();
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
        finalizePlaybackSettlement(!handedOff);
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
        try {
          const prepared = options.renderer.beginBoardVisualFrameCommit(options.boardWriterToken);
          if (prepared === false) {
            throw new Error('Strict network committed-frame preparation was rejected');
          }
        } catch (cause) {
          throw createStrictNetworkSettlementError(
            'strict_network_commit_prepare_failed',
            'Strict network committed-frame preparation failed',
            options.visualSeq
          );
        }
        awaitingFrameCommit = true;
      }
      return true;
    },
    setPlaybackSettlement(result: unknown) {
      if (playbackSettlementResult) {
        throw createPlaybackSettlementContractError(
          'strict_network_playback_settlement_registered_twice',
          'Strict network playback settlement was registered twice'
        );
      }
      playbackSettlementResult = requirePlaybackSettlementResult(result);
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
  let payload = normalizePlaybackEventsForUi(Array.isArray(ev && ev.events) ? ev.events : []);
  const strictNetworkPlayback = !!(ev && ev.meta && ev.meta.strictNetworkPlayback === true);
  const outerVisualSeq = Number(ev && ev.meta && ev.meta.visualSeq);
  if (strictNetworkPlayback && Number.isInteger(outerVisualSeq) && outerVisualSeq >= 0) {
    payload = payload.map((event: any) => ({
      ...event,
      visualSeq: Number.isInteger(Number(event && event.visualSeq)) ? Number(event.visualSeq) : outerVisualSeq,
      meta: Object.assign({}, event && event.meta && typeof event.meta === 'object' ? event.meta : {}, {
        visualSeq: event && event.meta && typeof event.meta === 'object'
          && Number.isInteger(Number(event.meta.visualSeq))
          ? Number(event.meta.visualSeq)
          : outerVisualSeq
      })
    }));
  } else if (!strictNetworkPlayback && payload.length) {
    const VisualSeed = _require('./presentation/visual-seed');
    if (!VisualSeed || typeof VisualSeed.withNextPresentationBatchId !== 'function') {
      throw new Error('local_presentation_batch_identity_unavailable');
    }
    payload = Array.from(VisualSeed.withNextPresentationBatchId(payload));
  }
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

  if (!strictNetworkPlayback && activeLocalPresentationDrainClaim) {
    finalizePlaybackSettlements(activeLocalPresentationDrainClaim);
  }
  const playbackClaim = claimPlaybackBatchForPresentation(ev, payload);
  let strictSettlement: any = null;
  let strictOwnershipTransferred = false;
  let activeBoardWriterToken: any = null;
  let playbackSettlementResult: any = null;
  const registerPlaybackSettlementResult = (value: unknown) => {
    if (payload.length === 0) return null;
    if (playbackSettlementResult) {
      throw createPlaybackSettlementContractError(
        'playback_settlement_result_registered_twice',
        'Playback settlement result was registered twice'
      );
    }
    playbackSettlementResult = requirePlaybackSettlementResult(value);
    return playbackSettlementResult;
  };
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
      activeBoardWriterToken = boardWriterToken;
      strictSettlement = createStrictNetworkSettlementHandle({
        visualSeq,
        managerClaim: playbackClaim,
        boardWriterToken,
        renderer,
        requiresPlaybackSettlement: payload.length > 0
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
      playbackClaim.playbackSettlements = [];
      activeBoardWriterToken = playbackClaim.boardWriterToken;
    } catch (error) {
      releasePlaybackClaimForPresentation(playbackClaim);
      throw error;
    }
  }
  try {
    if (!activeBoardWriterToken && activeLocalPresentationDrainClaim) {
      activeBoardWriterToken = activeLocalPresentationDrainClaim.boardWriterToken || null;
    }
    const playbackDispatchDeps = getPlaybackDispatchDeps();
    const playbackEngineDeps = Object.assign({}, playbackDispatchDeps, {
      strictNetworkPlayback,
      deferFinalSettlement: true,
      boardWriterToken: activeBoardWriterToken
    });
    const playbackEventForDispatch = {
      type: 'PLAYBACK_EVENTS',
      events: payload,
      meta: ev && ev.meta && typeof ev.meta === 'object' ? Object.assign({}, ev.meta) : undefined
    };
    const playbackEngine = resolvePlaybackEngine();
    let dispatched = payload.length === 0;
    let playbackDispatchStarted = false;
    if (!dispatched) {
      try {
        if (playbackEngine && typeof playbackEngine.dispatchPresentationEvent === 'function') {
          playbackDispatchStarted = true;
          const startedAt = Date.now();
          emitPresentationDebugConsole('playback_batch_dispatch_engine', {
            payloadCount: payload.length,
            payloadTypes,
            hasAnimationEngine: !!(playbackDispatchDeps && playbackDispatchDeps.AnimationEngine),
            animationEngineHasPlay: !!(playbackDispatchDeps && playbackDispatchDeps.AnimationEngine && typeof playbackDispatchDeps.AnimationEngine.play === 'function')
          });
          const dispatchResult = await playbackEngine.dispatchPresentationEvent(
            playbackEventForDispatch,
            playbackEngineDeps
          );
          registerPlaybackSettlementResult(dispatchResult);
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
        // Once the dispatcher has accepted this batch it may already have
        // emitted sound, global overlays, or board events. Replaying the same
        // payload through the compatibility path would duplicate those side
        // effects, so preserve the original failure for every playback mode.
        throw e;
      }
    }

    if (!dispatched && !playbackDispatchStarted) {
      try {
        const animationEngine = playbackDispatchDeps.AnimationEngine;
        if (animationEngine && typeof animationEngine.play === 'function') {
          const startedAt = Date.now();
          emitPresentationDebugConsole('playback_batch_animation_engine', {
            payloadCount: payload.length,
            payloadTypes
          });
          if (strictNetworkPlayback) {
            const directResult = await animationEngine.play(payload, {
              strictNetworkPlayback: true,
              deferFinalSettlement: true,
              boardWriterToken: activeBoardWriterToken
            });
            registerPlaybackSettlementResult(directResult);
          } else {
            const directResult = await animationEngine.play(payload, {
              deferFinalSettlement: true,
              boardWriterToken: activeBoardWriterToken
            });
            registerPlaybackSettlementResult(directResult);
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
        // The compatibility dispatcher has also started consuming the batch
        // at this point. Preserve its typed renderer/resource failure instead
        // of converting a partial presentation into apparent success.
        throw e;
      }
    }

    if (strictNetworkPlayback) {
      if (payload.length > 0) strictSettlement.setPlaybackSettlement(playbackSettlementResult);
      strictSettlement.beginAwaiting();
      const settlementHandle = strictSettlement.handoff();
      strictOwnershipTransferred = true;
      return settlementHandle;
    }
    if (!playbackSettlementResult) {
      throw createPlaybackSettlementContractError(
        'local_playback_settlement_unavailable',
        'Local playback settlement result is unavailable'
      );
    }
    const finalizationOwner = activeLocalPresentationDrainClaim || playbackClaim;
    if (!finalizationOwner) {
      throw createPlaybackSettlementContractError(
        'local_playback_settlement_owner_unavailable',
        'Local playback settlement owner is unavailable'
      );
    }
    if (!Array.isArray(finalizationOwner.playbackSettlements)) finalizationOwner.playbackSettlements = [];
    finalizationOwner.playbackSettlements.push(playbackSettlementResult);
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

function createLegacyBoardPresentationError(code: string, ev: any, cause?: any): any {
  const eventType = String(ev && ev.type || 'unknown').trim().toLowerCase() || 'unknown';
  const error: any = new Error(`${code}:${eventType}`);
  error.name = 'PresentationPlaybackError';
  error.code = code;
  error.eventType = eventType;
  error.strictNetworkPlayback = false;
  if (cause !== undefined) {
    Object.defineProperty(error, 'cause', {
      value: cause,
      configurable: true,
      enumerable: false,
      writable: false
    });
  }
  return error;
}

function throwIfDetachedLegacyBoardRecoveryIsUnresolved(lease: any, ev: any): void {
  if (lease && lease.token && lease.unresolvedError) {
    throw createLegacyBoardPresentationError(
      'board_writer_recovery_unresolved',
      ev,
      lease.unresolvedError
    );
  }
}

function holdDetachedLegacyBoardRecoveryState(lease: any, ev: any, error: any): void {
  const manager = lease.manager || resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.claimVisualPlayback !== 'function') {
    throw new Error('Detached board recovery playback manager is unavailable');
  }
  lease.manager = manager;
  if (!lease.managerClaim) {
    lease.managerClaim = manager.claimVisualPlayback({
      source: 'presentation-handler',
      scope: 'generic',
      reason: 'detached_board_writer_recovery_unresolved',
      eventCount: 1,
      eventTypes: [String(ev && ev.type || 'unknown').trim() || 'unknown'],
      strictNetworkPlayback: false,
      restoreBusyBaseline: false
    });
  }
  if (!lease.managerClaim) {
    throw new Error('Detached board recovery playback claim was rejected');
  }
  if (typeof manager.setInteractionLock === 'function') {
    manager.setInteractionLock(true);
  } else if (typeof manager.setBusyState === 'function') {
    manager.setBusyState({ processing: true, cardAnimating: true, playbackActive: true });
  } else {
    throw new Error('Detached board recovery interaction lock is unavailable');
  }
  if (typeof manager.recordVisualPlaybackSettlementError !== 'function') {
    throw new Error('Detached board recovery settlement recorder is unavailable');
  }
  if (manager.recordVisualPlaybackSettlementError(lease.managerClaim, error, {
    stage: 'detached-board-writer-recovery'
  }) !== true) {
    throw new Error('Detached board recovery settlement error was rejected');
  }
}

function releaseDetachedLegacyBoardRecoveryClaimAfterRestore(lease: any, ev: any): void {
  if (!lease || !lease.managerClaim) return;
  const manager = lease.manager || resolvePlaybackStateManagerForPresentation();
  let released = false;
  try {
    if (!manager || typeof manager.releaseVisualPlaybackClaim !== 'function') {
      throw new Error('Detached board recovery playback release is unavailable');
    }
    released = manager.releaseVisualPlaybackClaim(lease.managerClaim) === true;
    if (!released) throw new Error('Detached board recovery playback claim was not released');
  } catch (error) {
    const typedError = createLegacyBoardPresentationError('board_writer_manager_release_failed', ev, error);
    lease.unresolvedError = typedError;
    throw typedError;
  }
  lease.managerClaim = null;
  lease.manager = null;
}

async function settleDetachedLegacyBoardPresentationLease(renderer: any, lease: any, ev: any): Promise<any> {
  let settlementError: any = null;
  try {
    if (typeof renderer.settleBoardVisualWriter === 'function') {
      await renderer.settleBoardVisualWriter(lease.token);
    } else {
      renderer.releaseBoardVisualWriter(lease.token);
    }
  } catch (error) {
    settlementError = error && (error as any).name === 'PresentationPlaybackError'
      ? error
      : createLegacyBoardPresentationError('board_writer_settlement_failed', ev, error);
  }
  if (settlementError) {
    try {
      if (typeof renderer.enterBoardVisualRecovery !== 'function') {
        throw new Error('Board writer recovery API unavailable');
      }
      if (typeof renderer.settleBoardVisualWriter !== 'function') {
        throw new Error('Board writer recovery settlement API unavailable');
      }
      await renderer.enterBoardVisualRecovery(lease.token, settlementError);
      await renderer.settleBoardVisualWriter(lease.token);
    } catch (recoveryError) {
      lease.unresolvedError = settlementError;
      Object.defineProperty(settlementError, 'recoveryError', {
        value: recoveryError,
        configurable: true,
        enumerable: false,
        writable: false
      });
      try {
        holdDetachedLegacyBoardRecoveryState(lease, ev, settlementError);
      } catch (managerError) {
        Object.defineProperty(settlementError, 'managerSettlementError', {
          value: managerError,
          configurable: true,
          enumerable: false,
          writable: false
        });
      }
      throw settlementError;
    }
  }
  // A retained manager claim can only reach this point through a future
  // explicit restore/retry. Release it after the writer restore succeeds;
  // a failed manager release keeps the lease/token as an error settlement.
  releaseDetachedLegacyBoardRecoveryClaimAfterRestore(lease, ev);
  lease.token = null;
  lease.unresolvedError = null;
  return settlementError;
}

async function playLegacyBoardPresentationEvent(ev: any): Promise<void> {
  const renderer = _require('./board-renderer');
  if (
    !renderer
    || typeof renderer.playBoardVisualPhase !== 'function'
    || typeof renderer.claimBoardVisualWriter !== 'function'
    || typeof renderer.releaseBoardVisualWriter !== 'function'
  ) {
    throw new Error('legacy_board_presentation_backend_unavailable');
  }
  const drainToken = activeLocalPresentationDrainClaim && activeLocalPresentationDrainClaim.boardWriterToken;
  if (drainToken) {
    await renderer.playBoardVisualPhase(drainToken, [ev]);
    return;
  }

  let lease = detachedLegacyBoardPresentationLease;
  throwIfDetachedLegacyBoardRecoveryIsUnresolved(lease, ev);
  if (lease && lease.closingPromise) {
    try {
      await lease.closingPromise;
    } catch (error) {
      throwIfDetachedLegacyBoardRecoveryIsUnresolved(lease, ev);
      throw error;
    }
    return playLegacyBoardPresentationEvent(ev);
  }
  if (!lease) {
    lease = {
      pending: 0,
      token: null,
      closingPromise: null,
      unresolvedError: null,
      manager: null,
      managerClaim: null,
      tokenPromise: (async () => {
        if (typeof renderer.getBoardVisualControllerReady === 'function') {
          await renderer.getBoardVisualControllerReady();
        }
        lease.token = renderer.claimBoardVisualWriter(
          `local:legacy-presentation:${++legacyBoardPresentationSequence}`,
          'local'
        );
        return lease.token;
      })()
    };
    detachedLegacyBoardPresentationLease = lease;
  }
  lease.pending += 1;
  try {
    const token = await lease.tokenPromise;
    await renderer.playBoardVisualPhase(token, [ev]);
  } finally {
    lease.pending -= 1;
    // Same-turn standalone effects preserve their historical concurrent
    // launch while sharing one exclusive visual writer lease.
    await Promise.resolve();
    if (lease.pending === 0 && detachedLegacyBoardPresentationLease === lease) {
      const closingPromise = (async () => {
        let settlementError: any = null;
        if (lease.token) {
          settlementError = await settleDetachedLegacyBoardPresentationLease(renderer, lease, ev);
        }
        if (detachedLegacyBoardPresentationLease === lease) {
          detachedLegacyBoardPresentationLease = null;
        }
        return settlementError;
      })();
      lease.closingPromise = closingPromise;
      let settlementError: any = null;
      try {
        settlementError = await closingPromise;
      } finally {
        if (lease.closingPromise === closingPromise) {
          lease.closingPromise = null;
        }
      }
      if (settlementError) throw settlementError;
    }
  }
}

function launchLegacyBoardPresentationEvent(ev: any): void {
  const settlement = playLegacyBoardPresentationEvent(ev).catch(function () {
    // These local cosmetic events were historically fire-and-forget.
  });
  const drain = activeLocalPresentationDrainClaim;
  if (drain) {
    if (!Array.isArray(drain.boardPresentationSettlements)) {
      drain.boardPresentationSettlements = [];
    }
    drain.boardPresentationSettlements.push(settlement);
  }
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
      if (ev.meta && ev.meta.strictNetworkPlayback === true) {
        return Promise.reject(new Error('strict_network_standalone_board_event_requires_playback_batch'));
      }
      launchLegacyBoardPresentationEvent(ev);
      return;
    }

    if (ev.type === 'PROTECTION_EXPIRE') {
      if (ev.meta && ev.meta.strictNetworkPlayback === true) {
        return Promise.reject(new Error('strict_network_standalone_board_event_requires_playback_batch'));
      }
      launchLegacyBoardPresentationEvent(ev);
      return;
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
    const renderer = _require('./board-renderer');
    if (renderer && typeof renderer.getBoardVisualControllerReady === 'function') {
      // Keep the queue intact and unclaimed until the exclusive backend mount
      // plus any idle frame resources have settled. This is the boot boundary:
      // initGameSystems may emit boardUpdated before Pixi is ready.
      await renderer.getBoardVisualControllerReady();
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
    if (drainClaim && Array.isArray(drainClaim.boardPresentationSettlements)) {
      await Promise.all(drainClaim.boardPresentationSettlements);
      drainClaim.boardPresentationSettlements.length = 0;
    }
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
    } else {
      const renderer = _require('./board-renderer');
      if (
        renderer
        && typeof renderer.settleAutoBoardVisualWriter === 'function'
      ) {
        await renderer.settleAutoBoardVisualWriter();
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
