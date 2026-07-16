import AnimationConstants = require('../animation-constants');
import PresentationEffectProfiles = require('../../shared/presentation-effect-profiles');
import type { PresentationPlaybackEvent } from '../board-visual/playback-types';
import {
  PresentationPlaybackError,
  isBoardPlaybackEvent,
  isHybridPresentationEvent,
  isKnownGlobalPresentationEvent,
  normalizePresentationEventType
} from '../board-visual/playback-types';
import type {
  BoardPlaybackContext,
  BoardPlaybackValidationContext,
  BoardVisualFrame
} from '../board-visual/types';
import type {
  PixiBoardScene,
  PixiPlaybackCellHighlightHandle,
  PixiPlaybackCellHighlightTone,
  PixiPlaybackEffectHandle,
  PixiPlaybackEffectOptions,
  PixiPlaybackEffectUpdate,
  PixiPlaybackGhostHandle,
  PixiPlaybackGhostUpdate,
  PixiPlaybackProjectionScope
} from './board-scene';
import {
  createPixiApplicationTickerClock,
  createPixiTimeline,
  type PixiApplicationTickerPort,
  type PixiTimeline,
  type PixiTimelineBooleanPolicy,
  type PixiTimelineOptions
} from './timeline';
import {
  createPlaybackStoneVisual,
  normalizePlaybackCoordinate,
  type PixiPlaybackStoneVisual
} from './effects/common';
import { playPixiDestroyEffect } from './effects/destroy';
import { playPixiFlipEffect } from './effects/flip';
import { playPixiMoveEffect } from './effects/move';
import { playPixiPlaceEffect } from './effects/place';
import { playPixiSpawnEffect } from './effects/spawn';
import { playPixiStatusEffect } from './effects/status';
import {
  playPixiCrossfadeStoneEffect,
  playPixiLegacyFadeOutEffect,
  playPixiLegacyHyperactiveMoveEffect,
  playPixiLegacySacrificeAbsorbPulseEffect,
  playPixiLegacyStrongWillApplyEffect,
  playPixiProtectionExpireEffect
} from './effects/special-stone';
import { playPixiTheoryIncarnationEffect } from './effects/theory-incarnation';
import { playPixiManifestEndingBoardEffect } from './effects/manifest';
import type {
  PixiBoardEffectPlayer,
  PixiBoardEffectProjection,
  PixiBoardEffectTimings
} from './effects/types';

export interface PixiBoardPlaybackApplicationPort extends PixiApplicationTickerPort {
  render(): void;
}

export interface PixiBoardPlaybackOptions {
  readonly application: PixiBoardPlaybackApplicationPort;
  readonly scene: PixiBoardScene;
  readonly getFrame: () => BoardVisualFrame | null;
  readonly noAnimation?: PixiTimelineBooleanPolicy;
  readonly reducedMotion?: PixiTimelineBooleanPolicy;
  readonly timings?: Partial<PixiBoardEffectTimings>;
  readonly record?: (event: string, detail?: unknown) => void;
  readonly timelineFactory?: (options: PixiTimelineOptions) => PixiTimeline;
}

export interface PixiBoardPlaybackDiagnostics {
  readonly destroyed: boolean;
  readonly activeScopeKey: string | null;
  readonly projectedStoneCount: number;
  readonly retainedFinalGhostCount: number;
  readonly retainedFinalEffectCount: number;
  readonly inFlightEffectCount: number;
  readonly inFlightTopologyRevealCount: number;
  readonly phaseCount: number;
  readonly completedPhaseCount: number;
  readonly failedPhaseCount: number;
  readonly timeline: ReturnType<PixiTimeline['getDiagnostics']>;
}

export interface PixiBoardPlayback {
  readonly kind: 'pixi-board-playback';
  validatePhase(events: readonly unknown[], context: BoardPlaybackValidationContext): void;
  playPhase(events: readonly unknown[], context: BoardPlaybackContext): Promise<void>;
  revealTopologyCells(keys: readonly string[]): Promise<void>;
  /** Call only after a non-reflow scene frame has rendered successfully. */
  onFrameApplied(): void;
  abort(reason?: unknown): number;
  getDiagnostics(): PixiBoardPlaybackDiagnostics;
  destroy(): void;
}

interface PixiPhaseSettlementState {
  readonly expectedFlipLaunch: boolean;
  flipLaunchCompleted: boolean;
  readonly expectedNonFlipCounts: Map<PresentationPlaybackEvent, number>;
  readonly completedNonFlipCounts: Map<PresentationPlaybackEvent, number>;
  readonly terminalProjectionWrites: readonly Readonly<{
    key: string;
    visual: PixiPlaybackStoneVisual | null;
  }>[];
  settled: boolean;
}

interface PixiValidatedPhase {
  readonly sourceSnapshot: ReadonlyMap<string, PixiPlaybackStoneVisual | null>;
  readonly settlement: PixiPhaseSettlementState;
}

const DEFAULT_TIMINGS: PixiBoardEffectTimings = Object.freeze({
  flipMs: Number(AnimationConstants.FLIP_MS) || 462,
  fadeOutMs: Number(AnimationConstants.FADE_OUT_MS) || 500,
  destroySettlementMs: (Number(AnimationConstants.FADE_OUT_MS) || 500) + 200,
  breedingSpawnFadeMs: Number(AnimationConstants.BREEDING_SPAWN_FADE_MS) || 500,
  moveMs: Number(AnimationConstants.MOVE_MS) || 400,
  overlayCrossfadeMs: Number(AnimationConstants.OVERLAY_CROSSFADE_MS) || 600,
  regenConsumeFadeMs: Number(AnimationConstants.REGEN_CONSUME_FADE_MS) || 500,
  positiveHighlightMinimumMs: Number(AnimationConstants.POSITIVE_HIGHLIGHT_MIN_VISIBLE_MS) || 500,
  zombieBiteMs: 800,
  teleportPulseMs: 140,
  strongWillApplyMs: 600,
  sacrificeAbsorbMs: 2600,
  theoryRouletteMs: Number(AnimationConstants.THEORY_SPAWN_ROULETTE_MS) || 2500,
  theoryMaterializeMs: Number(AnimationConstants.THEORY_SPAWN_MATERIALIZE_MS) || 2000,
  manifestEndingMs: 2000
});

const TOPOLOGY_REVEAL_MS = 260;

function coordinateKey(row: number, col: number): string {
  return `${Math.trunc(Number(row))},${Math.trunc(Number(col))}`;
}

function resolveBoolean(policy: PixiTimelineBooleanPolicy | undefined): boolean {
  return typeof policy === 'function' ? policy() === true : policy === true;
}

/** CSS `ease-out` is cubic-bezier(0, 0, 0.58, 1). */
function cssEaseOutProgress(rawProgress: number): number {
  const progress = Math.max(0, Math.min(1, Number(rawProgress) || 0));
  if (progress === 0 || progress === 1) return progress;
  let lower = 0;
  let upper = 1;
  let parameter = progress;
  for (let iteration = 0; iteration < 12; iteration += 1) {
    const inverse = 1 - parameter;
    const x = 3 * inverse * parameter * parameter * 0.58 + parameter * parameter * parameter;
    if (x < progress) lower = parameter;
    else upper = parameter;
    parameter = (lower + upper) / 2;
  }
  const inverse = 1 - parameter;
  return 3 * inverse * parameter * parameter + parameter * parameter * parameter;
}

function scopeKey(context: BoardPlaybackContext): string {
  const token = context && context.token;
  if (!token || !Number.isInteger(token.id) || !String(token.frameToken || '').trim()) {
    throw new Error('Pixi board playback requires an active board writer token');
  }
  return `${token.mode}:${token.id}:${token.frameToken}`;
}

function frameStoneAt(
  frame: BoardVisualFrame,
  row: number,
  col: number
): PixiPlaybackStoneVisual | null {
  const key = coordinateKey(row, col);
  const cell = frame.model.cells.find((candidate) => candidate.key === key);
  if (!cell || !cell.stone) return null;
  return Object.freeze({
    stone: cell.stone,
    markers: cell.markers
  });
}

function combinedFlipEvent(events: readonly PresentationPlaybackEvent[]): PresentationPlaybackEvent {
  const targets: unknown[] = [];
  for (const event of events) {
    for (const target of event.targets || []) targets.push(target);
  }
  return Object.freeze({ type: 'flip', targets: Object.freeze(targets) });
}

function requirePlayer(
  event: PresentationPlaybackEvent,
  context: BoardPlaybackValidationContext
): PixiBoardEffectPlayer {
  switch (normalizePresentationEventType(event)) {
    case 'place': return playPixiPlaceEffect;
    case 'destroy': return playPixiDestroyEffect;
    case 'spawn': return playPixiSpawnEffect;
    case 'move': return playPixiMoveEffect;
    case 'status_applied':
    case 'status_removed': return playPixiStatusEffect;
    case 'crossfade_stone': return playPixiCrossfadeStoneEffect;
    case 'protection_expire': return playPixiProtectionExpireEffect;
    case 'legacy_fade_out': return playPixiLegacyFadeOutEffect;
    case 'legacy_strong_will_apply': return playPixiLegacyStrongWillApplyEffect;
    case 'legacy_hyperactive_move': return playPixiLegacyHyperactiveMoveEffect;
    case 'legacy_sacrifice_absorb_pulse': return playPixiLegacySacrificeAbsorbPulseEffect;
    case 'theory_incarnation_spawn_roulette': return playPixiTheoryIncarnationEffect;
    case 'manifest_ending': return playPixiManifestEndingBoardEffect;
    default:
      throw new PresentationPlaybackError('board_event_unimplemented', event, {
        strictNetworkPlayback: context?.strictNetworkPlayback === true
      });
  }
}

function collectValidationEvents(
  events: readonly unknown[],
  context: BoardPlaybackValidationContext
): readonly unknown[] {
  const output: unknown[] = [];
  const seenObjects = new Set<unknown>();
  const append = (event: unknown) => {
    if (event && typeof event === 'object') {
      if (seenObjects.has(event)) return;
      seenObjects.add(event);
    }
    output.push(event);
  };
  const scoped = context?.phaseScope && Array.isArray(context.phaseScope.events)
    ? context.phaseScope.events
    : [];
  for (const event of scoped) append(event);
  for (const event of Array.from(events || [])) append(event);
  return Object.freeze(output);
}

function validateDestroyPresentation(
  event: PresentationPlaybackEvent,
  context: BoardPlaybackValidationContext
): void {
  const targets = Array.isArray(event.targets) ? event.targets : [];
  const unsupported = targets.find((target) => (
    PresentationEffectProfiles.requiresGlobalDestroyPrelude(target as any)
      && typeof context?.phaseScope?.waitForTargetPrelude !== 'function'
  ));
  if (!unsupported) return;
  throw new PresentationPlaybackError('board_event_unimplemented', event, {
    strictNetworkPlayback: context?.strictNetworkPlayback === true
  });
}

function validatePixiCapabilityEvent(
  candidate: unknown,
  context: BoardPlaybackValidationContext
): void {
  if (isKnownGlobalPresentationEvent(candidate)) return;
  if (!isBoardPlaybackEvent(candidate) && !isHybridPresentationEvent(candidate)) {
    throw new PresentationPlaybackError('board_event_unimplemented', candidate, {
      strictNetworkPlayback: context?.strictNetworkPlayback === true
    });
  }
  const event = candidate as PresentationPlaybackEvent;
  const type = normalizePresentationEventType(event);
  if (type === 'flip') return;
  requirePlayer(event, context);
  if (type === 'destroy') validateDestroyPresentation(event, context);
}

function collectPhaseCoordinateKeys(events: readonly unknown[]): readonly string[] {
  const keys = new Set<string>();
  const add = (candidate: unknown) => {
    const coordinate = normalizePlaybackCoordinate(candidate);
    if (coordinate) keys.add(coordinateKey(coordinate.row, coordinate.col));
  };
  for (const candidate of events) {
    const event = candidate && typeof candidate === 'object'
      ? candidate as PresentationPlaybackEvent
      : null;
    if (!event) continue;
    add(event);
    add((event as any).from);
    add((event as any).to);
    for (const target of event.targets || []) {
      add(target);
      if (target && typeof target === 'object') {
        add((target as any).from);
        add((target as any).to);
        add((target as any).selectedCell);
        for (const candidate of Array.isArray((target as any).candidateCells)
          ? (target as any).candidateCells
          : []) add(candidate);
      }
    }
  }
  return Object.freeze(Array.from(keys));
}

export function createPixiBoardPlayback(options: PixiBoardPlaybackOptions): PixiBoardPlayback {
  if (!options || !options.application || !options.scene || typeof options.getFrame !== 'function') {
    throw new Error('Pixi board playback dependencies are unavailable');
  }
  const application = options.application;
  const scene = options.scene;
  const record = typeof options.record === 'function' ? options.record : () => undefined;
  const timings = Object.freeze({ ...DEFAULT_TIMINGS, ...(options.timings || {}) });
  const timelineFactory = options.timelineFactory || createPixiTimeline;
  const stableRender = application.render.bind(application);
  const timeline = timelineFactory({
    clock: createPixiApplicationTickerClock(application),
    render: stableRender,
    noAnimation: options.noAnimation,
    reducedMotion: options.reducedMotion
  });
  const projectedStones = new Map<string, PixiPlaybackStoneVisual | null>();
  const retainedFinalGhosts = new Map<string, PixiPlaybackGhostHandle>();
  const retainedFinalEffects = new Map<string, PixiPlaybackEffectHandle>();
  const retainedFinalEffectKeysByHandle = new Map<number, string>();
  const phaseSourceSnapshots = new WeakMap<object, ReadonlyMap<string, PixiPlaybackStoneVisual | null>>();
  const phaseSettlements = new WeakMap<object, PixiPhaseSettlementState>();
  const inFlightEffects = new Set<Promise<void>>();
  const inFlightTopologyReveals = new Set<Promise<void>>();
  let activeScope: PixiPlaybackProjectionScope | null = null;
  let destroyed = false;
  let phaseCount = 0;
  let completedPhaseCount = 0;
  let failedPhaseCount = 0;

  function clearBookkeeping(): void {
    activeScope = null;
    projectedStones.clear();
    retainedFinalGhosts.clear();
    retainedFinalEffects.clear();
    retainedFinalEffectKeysByHandle.clear();
  }

  function synchronizeSceneScope(): void {
    if (!activeScope) return;
    if (scene.getDiagnostics().playbackScopeKey !== activeScope.key) clearBookkeeping();
  }

  function readProjectedStone(
    frame: BoardVisualFrame,
    row: number,
    col: number
  ): PixiPlaybackStoneVisual | null {
    const key = coordinateKey(row, col);
    return projectedStones.has(key)
      ? projectedStones.get(key) || null
      : frameStoneAt(frame, row, col);
  }

  function createPhaseSettlementState(
    validationEvents: readonly unknown[]
  ): PixiPhaseSettlementState {
    let expectedFlipLaunch = false;
    const expectedNonFlipCounts = new Map<PresentationPlaybackEvent, number>();
    const mutationCounts = new Map<string, number>();
    const terminalWrites = new Map<string, PixiPlaybackStoneVisual | null>();
    const boardEvents = validationEvents.filter((event) => (
      isBoardPlaybackEvent(event) || isHybridPresentationEvent(event)
    )) as PresentationPlaybackEvent[];
    for (const event of boardEvents) {
      const type = normalizePresentationEventType(event);
      if (type === 'flip') {
        expectedFlipLaunch = true;
        continue;
      }
      expectedNonFlipCounts.set(event, (expectedNonFlipCounts.get(event) || 0) + 1);
    }

    // The executor launches one consolidated FLIP first, then non-FLIP events
    // in scope order. For cells with overlapping writers, remember that order's
    // terminal projection so effect duration cannot decide the final pixels.
    const launchOrderedEvents = [
      ...boardEvents.filter((event) => normalizePresentationEventType(event) === 'flip'),
      ...boardEvents.filter((event) => normalizePresentationEventType(event) !== 'flip')
    ];
    const coordinateKeyOf = (candidate: unknown): string | null => {
      const coordinate = normalizePlaybackCoordinate(candidate);
      return coordinate ? coordinateKey(coordinate.row, coordinate.col) : null;
    };
    const countMutation = (key: string | null) => {
      if (key) mutationCounts.set(key, (mutationCounts.get(key) || 0) + 1);
    };
    const resolveAfterVisual = (
      event: PresentationPlaybackEvent,
      target: any
    ): PixiPlaybackStoneVisual | null => createPlaybackStoneVisual(
      target?.after,
      target?.ownerAfter,
      target?.owner,
      event?.owner
    );
    const recordDirectTargetWrites = (event: PresentationPlaybackEvent) => {
      for (const target of event.targets || []) {
        const key = coordinateKeyOf(target);
        countMutation(key);
        if (key) terminalWrites.set(key, resolveAfterVisual(event, target));
      }
    };
    for (const event of launchOrderedEvents) {
      const type = normalizePresentationEventType(event);
      if (type === 'flip') {
        for (const target of event.targets || []) {
          countMutation(coordinateKeyOf(target));
        }
        continue;
      }
      if (type === 'destroy') {
        for (const target of event.targets || []) {
          if (PresentationEffectProfiles.getSpecialDestroyTargetProfileKey(target as any) === 'gluttonousEat') {
            continue;
          }
          const meta = target && typeof target === 'object' && (target as any).meta
            && typeof (target as any).meta === 'object'
            ? (target as any).meta
            : {};
          const key = coordinateKeyOf(target);
          if (!key) continue;
          if (meta.blockedByGhost === true || meta.proliferated === true || meta.regenerated === true) {
            continue;
          }
          countMutation(key);
          terminalWrites.set(key, null);
        }
        continue;
      }
      if (type === 'legacy_fade_out') {
        const key = coordinateKeyOf(event);
        countMutation(key);
        if (key) terminalWrites.set(key, null);
        continue;
      }
      if (type === 'legacy_hyperactive_move') {
        const fromKey = coordinateKeyOf((event as any).from);
        const toKey = coordinateKeyOf((event as any).to);
        countMutation(fromKey);
        countMutation(toKey);
        if (fromKey) terminalWrites.set(fromKey, null);
        // The move player retains the source visual at the destination. Its
        // concrete terminal write is already deterministic inside that player.
        continue;
      }
      if (type === 'move') {
        for (const rawTarget of event.targets || []) {
          const target: any = rawTarget;
          const fromKey = coordinateKeyOf(target?.from);
          const toKey = coordinateKeyOf(target?.to);
          countMutation(fromKey);
          countMutation(toKey);
          if (fromKey && target?.clone !== true) terminalWrites.set(fromKey, null);
          if (toKey) terminalWrites.set(toKey, resolveAfterVisual(event, target));
        }
        continue;
      }
      recordDirectTargetWrites(event);
    }
    const terminalProjectionWrites = Array.from(terminalWrites, ([key, visual]) => (
      Object.freeze({ key, visual })
    )).filter(({ key }) => (mutationCounts.get(key) || 0) > 1);
    return {
      expectedFlipLaunch,
      flipLaunchCompleted: false,
      expectedNonFlipCounts,
      completedNonFlipCounts: new Map(),
      terminalProjectionWrites: Object.freeze(terminalProjectionWrites),
      settled: false
    };
  }

  function ensurePhaseSettlement(
    validationEvents: readonly unknown[],
    context: BoardPlaybackValidationContext
  ): PixiPhaseSettlementState {
    const phaseScope = context?.phaseScope;
    if (phaseScope && typeof phaseScope === 'object') {
      const installed = phaseSettlements.get(phaseScope);
      if (installed) return installed;
      const created = createPhaseSettlementState(validationEvents);
      phaseSettlements.set(phaseScope, created);
      return created;
    }
    return createPhaseSettlementState(validationEvents);
  }

  function completePhaseLaunch(
    state: PixiPhaseSettlementState,
    phaseEvents: readonly PresentationPlaybackEvent[]
  ): boolean {
    if (state.settled) return false;
    if (phaseEvents.some((event) => normalizePresentationEventType(event) === 'flip')) {
      state.flipLaunchCompleted = true;
    }
    for (const event of phaseEvents) {
      if (normalizePresentationEventType(event) === 'flip') continue;
      const expected = state.expectedNonFlipCounts.get(event) || 0;
      if (expected <= 0) continue;
      const completed = state.completedNonFlipCounts.get(event) || 0;
      state.completedNonFlipCounts.set(event, Math.min(expected, completed + 1));
    }
    if (state.expectedFlipLaunch && !state.flipLaunchCompleted) return false;
    for (const [event, expected] of state.expectedNonFlipCounts) {
      if ((state.completedNonFlipCounts.get(event) || 0) < expected) return false;
    }
    state.settled = true;
    return true;
  }

  function validatePhaseInternal(
    events: readonly unknown[],
    context: BoardPlaybackValidationContext
  ): PixiValidatedPhase {
    if (destroyed) throw new Error('Pixi board playback is destroyed');
    const validationEvents = collectValidationEvents(events, context);
    for (const event of validationEvents) validatePixiCapabilityEvent(event, context);
    const settlement = ensurePhaseSettlement(validationEvents, context);

    const phaseScope = context?.phaseScope;
    if (phaseScope && typeof phaseScope === 'object') {
      const installed = phaseSourceSnapshots.get(phaseScope);
      if (installed) return Object.freeze({ sourceSnapshot: installed, settlement });
    }
    const frame = options.getFrame();
    if (!frame) throw new Error('Pixi board playback requires an applied visual frame');
    const snapshot = new Map<string, PixiPlaybackStoneVisual | null>();
    for (const key of collectPhaseCoordinateKeys(validationEvents)) {
      const [row, col] = key.split(',').map(Number);
      snapshot.set(key, readProjectedStone(frame, row, col));
    }
    const immutableSnapshot: ReadonlyMap<string, PixiPlaybackStoneVisual | null> = snapshot;
    if (phaseScope && typeof phaseScope === 'object') {
      phaseSourceSnapshots.set(phaseScope, immutableSnapshot);
    }
    return Object.freeze({ sourceSnapshot: immutableSnapshot, settlement });
  }

  function getScope(context: BoardPlaybackContext): PixiPlaybackProjectionScope {
    if (destroyed) throw new Error('Pixi board playback is destroyed');
    synchronizeSceneScope();
    const key = scopeKey(context);
    if (activeScope) {
      if (activeScope.key !== key) {
        throw new Error(`Pixi board playback scope ${activeScope.key} is still active`);
      }
      return activeScope;
    }
    const frame = options.getFrame();
    if (!frame) throw new Error('Pixi board playback requires an applied visual frame');
    activeScope = scene.beginPlaybackScope(key);
    return activeScope;
  }

  function releaseRetainedFinalGhost(key: string, scope: PixiPlaybackProjectionScope): void {
    const handle = retainedFinalGhosts.get(key);
    if (!handle) return;
    retainedFinalGhosts.delete(key);
    if (scene.getDiagnostics().playbackScopeKey !== scope.key) return;
    scene.releasePlaybackGhost(scope, handle);
  }

  function releaseRetainedFinalEffect(key: string, scope: PixiPlaybackProjectionScope): void {
    const handle = retainedFinalEffects.get(key);
    if (!handle) return;
    retainedFinalEffects.delete(key);
    retainedFinalEffectKeysByHandle.delete(handle.id);
    if (scene.getDiagnostics().playbackScopeKey !== scope.key) return;
    if (!scene.getPlaybackEffect(handle)) return;
    scene.releasePlaybackEffect(scope, handle);
  }

  function createProjection(
    context: BoardPlaybackContext,
    phaseSourceSnapshot: ReadonlyMap<string, PixiPlaybackStoneVisual | null>
  ): PixiBoardEffectProjection {
    const scope = getScope(context);
    const frame = options.getFrame();
    if (!frame) throw new Error('Pixi board playback visual frame is unavailable');
    return Object.freeze({
      frame,
      phaseEvents: Object.freeze(Array.from(
        context?.phaseScope && Array.isArray(context.phaseScope.events)
          ? context.phaseScope.events
          : []
      )) as readonly PresentationPlaybackEvent[],
      scene,
      scope,
      timeline,
      timings,
      noAnimation: resolveBoolean(options.noAnimation),
      reducedMotion: resolveBoolean(options.reducedMotion),
      waitForTargetPrelude(event: PresentationPlaybackEvent, target: unknown): Promise<void> {
        const gate = context?.phaseScope?.waitForTargetPrelude;
        return typeof gate === 'function'
          ? Promise.resolve(gate(event, target))
          : Promise.resolve();
      },
      getProjectedStone(row: number, col: number): PixiPlaybackStoneVisual | null {
        return readProjectedStone(frame, row, col);
      },
      getPhaseSourceStone(row: number, col: number): PixiPlaybackStoneVisual | null {
        const key = coordinateKey(row, col);
        return phaseSourceSnapshot.has(key)
          ? phaseSourceSnapshot.get(key) || null
          : readProjectedStone(frame, row, col);
      },
      setProjectedStone(row: number, col: number, visual: PixiPlaybackStoneVisual | null): void {
        const key = coordinateKey(row, col);
        releaseRetainedFinalGhost(key, scope);
        projectedStones.set(key, visual);
        scene.hideStone(scope, row, col);
        if (!visual) return;
        retainedFinalGhosts.set(key, scene.acquirePlaybackGhost(scope, {
          row,
          col,
          stone: visual.stone,
          markers: visual.markers
        }));
      },
      acquireTransientGhost(row: number, col: number, visual: PixiPlaybackStoneVisual): PixiPlaybackGhostHandle {
        return scene.acquirePlaybackGhost(scope, {
          row,
          col,
          stone: visual.stone,
          markers: visual.markers
        });
      },
      updateGhost(handle: PixiPlaybackGhostHandle, update: PixiPlaybackGhostUpdate): void {
        scene.updatePlaybackGhost(scope, handle, update);
      },
      releaseGhost(handle: PixiPlaybackGhostHandle): void {
        // A terminal backend destroy or successful canonical frame apply can
        // invalidate the old writer scope before an async `finally` resumes.
        // Releasing that stale handle must not touch a newer scope.
        if (scene.getDiagnostics().playbackScopeKey !== scope.key) return;
        scene.releasePlaybackGhost(scope, handle);
      },
      acquireHighlight(
        row: number,
        col: number,
        tone: PixiPlaybackCellHighlightTone
      ): PixiPlaybackCellHighlightHandle {
        return scene.acquirePlaybackCellHighlight(scope, row, col, tone);
      },
      releaseHighlight(handle: PixiPlaybackCellHighlightHandle): void {
        if (scene.getDiagnostics().playbackScopeKey !== scope.key) return;
        scene.releasePlaybackCellHighlight(scope, handle);
      },
      acquireEffect(effectOptions: PixiPlaybackEffectOptions): PixiPlaybackEffectHandle {
        return scene.acquirePlaybackEffect(scope, effectOptions);
      },
      updateEffect(handle: PixiPlaybackEffectHandle, update: PixiPlaybackEffectUpdate): void {
        scene.updatePlaybackEffect(scope, handle, update);
      },
      retainEffect(row: number, col: number, handle: PixiPlaybackEffectHandle): void {
        const key = coordinateKey(row, col);
        const previous = retainedFinalEffects.get(key);
        if (previous && previous.id !== handle.id) releaseRetainedFinalEffect(key, scope);
        retainedFinalEffects.set(key, handle);
        retainedFinalEffectKeysByHandle.set(handle.id, key);
      },
      releaseEffect(handle: PixiPlaybackEffectHandle): void {
        if (scene.getDiagnostics().playbackScopeKey !== scope.key) return;
        const retainedKey = retainedFinalEffectKeysByHandle.get(handle.id);
        if (retainedKey) {
          retainedFinalEffectKeysByHandle.delete(handle.id);
          retainedFinalEffects.delete(retainedKey);
        }
        scene.releasePlaybackEffect(scope, handle);
      }
    });
  }

  function trackEffect(
    event: PresentationPlaybackEvent,
    player: PixiBoardEffectPlayer,
    projection: PixiBoardEffectProjection,
    detail?: unknown
  ): Promise<void> {
    const eventType = normalizePresentationEventType(event);
    record('pixi-playback:event-start', { eventType, detail });
    let tracked!: Promise<void>;
    tracked = Promise.resolve(player(event, projection)).then(
      () => {
        record('pixi-playback:event-complete', { eventType, detail });
      },
      (error) => {
        record('pixi-playback:event-error', { eventType, detail, error });
        throw error;
      }
    ).finally(() => {
      inFlightEffects.delete(tracked);
    });
    inFlightEffects.add(tracked);
    return tracked;
  }

  async function resetAfterFailure(reason: unknown): Promise<void> {
    timeline.abort(reason);
    const pending = Array.from(inFlightEffects);
    if (pending.length) await Promise.allSettled(pending);
    synchronizeSceneScope();
    if (activeScope && scene.getDiagnostics().playbackScopeKey === activeScope.key) {
      scene.resetPlaybackProjection(activeScope);
    }
    clearBookkeeping();
  }

  function discardPhaseState(context: BoardPlaybackValidationContext): void {
    const phaseScope = context?.phaseScope;
    if (!phaseScope || typeof phaseScope !== 'object') return;
    phaseSourceSnapshots.delete(phaseScope);
    phaseSettlements.delete(phaseScope);
  }

  function validatePhase(
    events: readonly unknown[],
    context: BoardPlaybackValidationContext
  ): void {
    validatePhaseInternal(Array.isArray(events) ? events : [], context);
  }

  async function playPhase(
    events: readonly unknown[],
    context: BoardPlaybackContext
  ): Promise<void> {
    if (destroyed) throw new Error('Pixi board playback is destroyed');
    const phaseEvents = Array.isArray(events) ? Array.from(events) : [];
    const scopedEvents = context?.phaseScope && Array.isArray(context.phaseScope.events)
      ? context.phaseScope.events
      : [];
    if (!phaseEvents.length && !scopedEvents.length) return;
    const validated = validatePhaseInternal(phaseEvents, context);
    if (!phaseEvents.length) return;
    const invalid = phaseEvents.find((event) => (
      !isBoardPlaybackEvent(event) && !isHybridPresentationEvent(event)
    ));
    if (invalid) {
      throw new PresentationPlaybackError('non_board_event_routed_to_board_backend', invalid, {
        strictNetworkPlayback: context?.strictNetworkPlayback === true
      });
    }
    const typedEvents = phaseEvents as PresentationPlaybackEvent[];
    const flipEvents = typedEvents.filter((event) => normalizePresentationEventType(event) === 'flip');
    const nonFlipEvents = typedEvents.filter((event) => normalizePresentationEventType(event) !== 'flip');
    // Validate every handler before starting the first visual mutation. This
    // keeps unsupported Phase 7 events from leaving a partially-started phase.
    const nonFlipPlayers = nonFlipEvents.map((event) => requirePlayer(event, context));
    const projection = createProjection(context, validated.sourceSnapshot);
    const phaseId = ++phaseCount;
    record('pixi-playback:phase-start', {
      phaseId,
      eventTypes: typedEvents.map(normalizePresentationEventType)
    });
    const launches: Promise<void>[] = [];
    try {
      // Match DOM playback: one consolidated FLIP launch starts first, then
      // every non-FLIP event starts in its received order. Do not type-sort.
      if (flipEvents.length) {
        launches.push(trackEffect(
          combinedFlipEvent(flipEvents),
          playPixiFlipEffect,
          projection,
          Object.freeze({ eventCount: flipEvents.length })
        ));
      }
      for (let index = 0; index < nonFlipEvents.length; index += 1) {
        launches.push(trackEffect(nonFlipEvents[index], nonFlipPlayers[index], projection));
      }
      await Promise.all(launches);
      if (completePhaseLaunch(validated.settlement, typedEvents)) {
        let terminalProjectionChanged = false;
        for (const { key, visual } of validated.settlement.terminalProjectionWrites) {
          const [row, col] = key.split(',').map(Number);
          projection.setProjectedStone(row, col, visual);
          terminalProjectionChanged = true;
        }
        if (terminalProjectionChanged) application.render();
      }
      completedPhaseCount += 1;
      record('pixi-playback:phase-complete', { phaseId });
    } catch (error) {
      failedPhaseCount += 1;
      discardPhaseState(context);
      await resetAfterFailure(error);
      const normalized = error instanceof PresentationPlaybackError
        ? error
        : new PresentationPlaybackError('board_renderer_failed', typedEvents[0], {
          strictNetworkPlayback: context?.strictNetworkPlayback === true,
          cause: error
        });
      record('pixi-playback:phase-error', { phaseId, error: normalized });
      throw normalized;
    }
  }

  function revealTopologyCells(rawKeys: readonly string[]): Promise<void> {
    if (destroyed) return Promise.reject(new Error('Pixi board playback is destroyed'));
    const keys = Object.freeze(Array.from(new Set(
      (Array.isArray(rawKeys) ? rawKeys : []).map((key) => String(key || '').trim()).filter(Boolean)
    )));
    if (!keys.length) return Promise.resolve();
    const immediate = resolveBoolean(options.noAnimation);
    const handle = scene.beginTopologyReveal(keys, immediate ? 1 : 0);
    record('pixi-playback:topology-reveal-start', { keys });
    if (immediate) {
      scene.endTopologyReveal(handle);
      record('pixi-playback:topology-reveal-complete', { keys, immediate: true });
      return Promise.resolve();
    }

    let ended = false;
    const endReveal = () => {
      if (ended) return;
      ended = true;
      scene.endTopologyReveal(handle);
    };
    let tracked!: Promise<void>;
    tracked = timeline.run({
      durationMs: TOPOLOGY_REVEAL_MS,
      effectFamily: 'board-expansion',
      onUpdate(progress) {
        scene.updateTopologyReveal(handle, cssEaseOutProgress(progress));
      },
      onSettled() {
        endReveal();
      }
    }).then(() => {
      record('pixi-playback:topology-reveal-complete', { keys, immediate: false });
    }).finally(() => {
      endReveal();
      inFlightTopologyReveals.delete(tracked);
      inFlightEffects.delete(tracked);
    });
    tracked.catch(() => undefined);
    inFlightTopologyReveals.add(tracked);
    inFlightEffects.add(tracked);
    return tracked;
  }

  function onFrameApplied(): void {
    // Scene.applyFrame() owns atomic transient cleanup. The playback layer only
    // drops handles after the canonical frame has also rendered successfully.
    synchronizeSceneScope();
    clearBookkeeping();
  }

  function abort(reason?: unknown): number {
    if (destroyed) return 0;
    const aborted = timeline.abort(reason);
    // Active effect `finally` blocks still own transient handles until their
    // rejected timeline promises resume. Let playPhase's async failure path
    // await those cleanups before resetting the strict scene scope.
    if (inFlightEffects.size === 0) {
      synchronizeSceneScope();
      if (activeScope && scene.getDiagnostics().playbackScopeKey === activeScope.key) {
        scene.resetPlaybackProjection(activeScope);
      }
      clearBookkeeping();
    }
    return aborted;
  }

  function getDiagnostics(): PixiBoardPlaybackDiagnostics {
    synchronizeSceneScope();
    return Object.freeze({
      destroyed,
      activeScopeKey: activeScope?.key || null,
      projectedStoneCount: projectedStones.size,
      retainedFinalGhostCount: retainedFinalGhosts.size,
      retainedFinalEffectCount: retainedFinalEffects.size,
      inFlightEffectCount: inFlightEffects.size,
      inFlightTopologyRevealCount: inFlightTopologyReveals.size,
      phaseCount,
      completedPhaseCount,
      failedPhaseCount,
      timeline: timeline.getDiagnostics()
    });
  }

  function destroy(): void {
    if (destroyed) return;
    abort(new Error('Pixi board playback was destroyed'));
    destroyed = true;
    timeline.destroy();
    for (const pending of inFlightTopologyReveals) inFlightEffects.delete(pending);
    inFlightTopologyReveals.clear();
    clearBookkeeping();
  }

  return Object.freeze({
    kind: 'pixi-board-playback' as const,
    validatePhase,
    playPhase,
    revealTopologyCells,
    onFrameApplied,
    abort,
    getDiagnostics,
    destroy
  });
}
