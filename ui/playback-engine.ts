/*
 * PlaybackEngine
 * Consumes `presentationEvents` emitted from game layer and executes UI-side playback.
 */

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const PresentationQueue = _require('../shared/presentation-queue');

import type { CardState } from '../src/types';

interface AnimationEngine {
  play: (payload: PresentationEvent[], options?: {
    strictNetworkPlayback?: boolean;
    deferFinalSettlement?: boolean;
    onFinalizationReady?: (finalize: () => boolean) => void;
    boardWriterToken?: unknown;
  }) => Promise<void>;
}

interface PresentationEvent {
  type: string;
  events?: PresentationEvent[];
  delayMs?: number;
  [key: string]: unknown;
}

interface UIImplPlayback {
  runMoveVisualSequence?: (payload: PresentationEvent[]) => Promise<void>;
  scheduleCpuTurn?: (delay: number, callback: () => void) => unknown;
  onUnhandledPresentationEvent?: (ev: PresentationEvent) => void;
}

interface PlaybackDeps {
  AnimationEngine?: AnimationEngine;
  strictNetworkPlayback?: boolean;
  deferFinalSettlement?: boolean;
  onFinalizationReady?: (finalize: () => boolean) => void;
  boardWriterToken?: unknown;
  scheduleCpuTurnEvent?: (ev: PresentationEvent) => unknown;
  scheduleCpuTurn?: (delay: number, callback: () => void) => unknown;
  onSchedule?: (callback: (() => void) | null) => void;
  onUnhandledPresentationEvent?: (ev: PresentationEvent) => void;
}

let __uiImpl_playback: UIImplPlayback = {};

function setUIImpl(obj: UIImplPlayback): void {
  __uiImpl_playback = obj || {};
}

function resolveAnimationEngine(deps: PlaybackDeps | null | undefined): AnimationEngine | null {
  const config = (deps && typeof deps === 'object') ? deps : {};
  if (config.AnimationEngine) {
    return config.AnimationEngine;
  }
  try {
    if (typeof globalThis !== 'undefined' && (globalThis as unknown as { AnimationEngine?: AnimationEngine }).AnimationEngine) {
      return (globalThis as unknown as { AnimationEngine?: AnimationEngine }).AnimationEngine ?? null;
    }
  } catch (e) { /* ignore */ }
  try {
    const root = (typeof globalThis !== 'undefined' ? globalThis : {}) as { AnimationEngine?: AnimationEngine };
    if (root && root.AnimationEngine) {
      return root.AnimationEngine;
    }
  } catch (e) { /* ignore */ }
  return null;
}

interface CardStateWithEvents {
  presentationEvents?: PresentationEvent[];
  _presentationEventsPersist?: PresentationEvent[];
}

function consumePresentationEventBuffer(cardState: CardState | null | undefined): PresentationEvent[] {
  if (PresentationQueue && typeof PresentationQueue.drainLivePresentationEvents === 'function') {
    return PresentationQueue.drainLivePresentationEvents(cardState) as PresentationEvent[];
  }
  const state = (cardState && typeof cardState === 'object') ? cardState as CardState & CardStateWithEvents : {} as CardStateWithEvents;
  const events = Array.isArray(state.presentationEvents) ? state.presentationEvents.slice() : [];
  if (Array.isArray(state.presentationEvents)) state.presentationEvents.length = 0;
  return events;
}

function removePersistedPresentationEvent(cardState: CardState | null | undefined, ev: PresentationEvent | null | undefined): boolean {
  if (PresentationQueue && typeof PresentationQueue.removePersistedPresentationEvent === 'function') {
    return PresentationQueue.removePersistedPresentationEvent(cardState, ev) === true;
  }
  return false;
}

async function playPlaybackBatch(events: PresentationEvent[], deps: PlaybackDeps | null | undefined): Promise<void> {
  const payload = Array.isArray(events) ? events : [];
  if (!payload.length) return;
  const config = (deps && typeof deps === 'object') ? deps : {};
  const strictNetworkPlayback = config.strictNetworkPlayback === true;
  const deferFinalSettlement = config.deferFinalSettlement === true;
  const playbackOptions = (strictNetworkPlayback || deferFinalSettlement || !!config.boardWriterToken) ? {
    strictNetworkPlayback,
    deferFinalSettlement: config.deferFinalSettlement === true,
    onFinalizationReady: config.onFinalizationReady,
    boardWriterToken: config.boardWriterToken
  } : undefined;
  const AnimationEngine = resolveAnimationEngine(deps);
  if (AnimationEngine && typeof AnimationEngine.play === 'function') {
    if (playbackOptions) {
      await AnimationEngine.play(payload, playbackOptions);
    } else {
      await AnimationEngine.play(payload);
    }
    return;
  }
  if (typeof __uiImpl_playback.runMoveVisualSequence === 'function') {
    if (strictNetworkPlayback) {
      throw new Error('strict_network_playback_animation_engine_unavailable');
    }
    await __uiImpl_playback.runMoveVisualSequence(payload);
    return;
  }
  if (strictNetworkPlayback) {
    throw new Error('strict_network_playback_animation_engine_unavailable');
  }
  try {
    const isDebugLogAvailable = (typeof (globalThis as unknown as { isDebugLogAvailable?: () => boolean }).isDebugLogAvailable === 'function')
      ? (globalThis as unknown as { isDebugLogAvailable: () => boolean }).isDebugLogAvailable
      : () => false;
    if (isDebugLogAvailable()) {
      console.warn('[PlaybackEngine] No AnimationEngine or runMoveVisualSequence available to play payload');
    }
  } catch (e) { /* ignore */ }
}

function schedulePresentationCpuTurn(ev: PresentationEvent, deps: PlaybackDeps | null | undefined): unknown {
  const config = (deps && typeof deps === 'object') ? deps : {};
  const scheduleCpuTurnEvent = config.scheduleCpuTurnEvent;
  if (typeof scheduleCpuTurnEvent === 'function') {
    return scheduleCpuTurnEvent(ev);
  }

  const scheduleCpuTurnFn = config.scheduleCpuTurn || __uiImpl_playback.scheduleCpuTurn;
  const onScheduleCallback = config.onSchedule || ((cb: (() => void) | null) => cb && cb());
  const delay = Number.isFinite(ev && ev.delayMs) ? ev.delayMs : 0;
  if (typeof scheduleCpuTurnFn === 'function') {
    return scheduleCpuTurnFn(delay || 0, () => onScheduleCallback(() => { /* placeholder */ }));
  }

  return setTimeout(() => {
    try {
      onScheduleCallback(() => { /* placeholder */ });
    } catch (e) {
      console.error(e);
    }
  }, delay || 0);
}

async function dispatchPresentationEvent(ev: PresentationEvent | null | undefined, deps: PlaybackDeps = {}): Promise<unknown> {
  if (!ev || !ev.type) return undefined;
  if (ev.type === 'PLAYBACK_EVENTS') {
    return playPlaybackBatch(ev.events || [], deps);
  }
  if (ev.type === 'SCHEDULE_CPU_TURN') {
    return schedulePresentationCpuTurn(ev, deps);
  }
  if (typeof deps.onUnhandledPresentationEvent === 'function') {
    return deps.onUnhandledPresentationEvent(ev);
  }
  if (typeof __uiImpl_playback.onUnhandledPresentationEvent === 'function') {
    return __uiImpl_playback.onUnhandledPresentationEvent(ev);
  }
  return undefined;
}

async function playPresentationEvents(cardState: CardState | null = null, deps: PlaybackDeps = {}): Promise<void> {
  const events = consumePresentationEventBuffer(cardState);
  for (const ev of events) {
    await dispatchPresentationEvent(ev, deps);
    removePersistedPresentationEvent(cardState, ev);
  }
}

export = {
  consumePresentationEventBuffer,
  playPlaybackBatch,
  schedulePresentationCpuTurn,
  dispatchPresentationEvent,
  playPresentationEvents,
  setUIImpl
};
