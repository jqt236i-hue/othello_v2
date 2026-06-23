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
  return manager.claimVisualPlayback({
    source: 'presentation_handler',
    reason: 'presentation_queue_drain',
    scope: 'presentation_drain',
    eventCount: mergedPayload.length,
    eventTypes: collectPlaybackEventTypesForClaim(mergedPayload)
  });
}

function releasePlaybackClaimForPresentation(claim: any): boolean {
  if (!claim) return false;
  const manager = resolvePlaybackStateManagerForPresentation();
  if (!manager || typeof manager.releaseVisualPlaybackClaim !== 'function') return false;
  return manager.releaseVisualPlaybackClaim(claim);
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

function releasePlaybackClaimAndRequestBoardSync(claim: any, reason: string): boolean {
  const released = releasePlaybackClaimForPresentation(claim);
  if (released && !hasActivePlaybackClaimForPresentation()) {
    requestBoardSyncAfterPlaybackClaimRelease(reason);
  }
  return released;
}

async function playPlaybackEvents(ev: any, options?: any): Promise<void> {
  const payload = normalizePlaybackEventsForUi(Array.isArray(ev && ev.events) ? ev.events : []);
  if (!payload.length) return;
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
  try {
    const playbackDispatchDeps = getPlaybackDispatchDeps();
    const strictNetworkPlayback = !!(ev && ev.meta && ev.meta.strictNetworkPlayback === true);
    const playbackEngineDeps = strictNetworkPlayback
      ? Object.assign({}, playbackDispatchDeps, { strictNetworkPlayback: true })
      : playbackDispatchDeps;
    const playbackEventForDispatch = {
      type: 'PLAYBACK_EVENTS',
      events: payload,
      meta: ev && ev.meta && typeof ev.meta === 'object' ? Object.assign({}, ev.meta) : undefined
    };
    const playbackEngine = resolvePlaybackEngine();
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
        return;
      }
    } catch (e) {
      emitPresentationDebugConsole('playback_batch_dispatch_engine_failed', {
        payloadCount: payload.length,
        payloadTypes,
        error: e && (e as any).message ? String((e as any).message) : String(e || '')
      });
      if (strictNetworkPlayback) {
        throw e;
      }
    }

    try {
      const animationEngine = playbackDispatchDeps.AnimationEngine;
      if (animationEngine && typeof animationEngine.play === 'function') {
        const startedAt = Date.now();
        emitPresentationDebugConsole('playback_batch_animation_engine', {
          payloadCount: payload.length,
          payloadTypes
        });
        if (strictNetworkPlayback) {
          await animationEngine.play(payload, { strictNetworkPlayback: true });
        } else {
          await animationEngine.play(payload);
        }
        emitPresentationDebugConsole('playback_batch_animation_engine_resolved', {
          payloadCount: payload.length,
          payloadTypes,
          elapsedMs: Date.now() - startedAt
        });
        return;
      }
      emitPresentationDebugConsole('playback_batch_no_animation_engine', {
        payloadCount: payload.length,
        payloadTypes
      });
      if (strictNetworkPlayback) {
        throw new Error('strict_network_playback_animation_engine_unavailable');
      }
    } catch (e) {
      emitPresentationDebugConsole('playback_batch_failed', {
        payloadCount: payload.length,
        payloadTypes,
        error: e && (e as any).message ? String((e as any).message) : String(e || '')
      });
      try { console.warn('[PresentationHandler] playback failed', e); } catch (e2) { /* ignore */ }
      if (strictNetworkPlayback) {
        throw e;
      }
    }
  } finally {
    releasePlaybackClaimAndRequestBoardSync(playbackClaim, 'playback_batch_claim_released');
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
      const playback = [{
        type: 'card_use_animation',
        phase: 1,
        targets: [{
          player: ev.player || null,
          owner: owner,
          cardId: ev.cardId || null,
          cost: (ev.meta && Number.isFinite(ev.meta.cost)) ? ev.meta.cost : null,
          name: (ev.meta && ev.meta.name) ? ev.meta.name : null
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
    const events = flushPendingPresentationEvents();
    drainClaim = claimPresentationDrainForEvents(events);
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
    releasePlaybackClaimAndRequestBoardSync(drainClaim, 'presentation_drain_claim_released');
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
