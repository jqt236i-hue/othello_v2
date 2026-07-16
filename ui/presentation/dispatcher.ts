import {
  DOM_COMPATIBILITY_FINAL_STATE_EVENT,
  PresentationPlaybackError,
  isBoardPlaybackEvent,
  isHybridPresentationEvent,
  isKnownGlobalPresentationEvent,
  type PresentationPlaybackEvent
} from '../board-visual/playback-types';
import {
  planPresentationPhases,
  type PresentationPhasePlan,
  type PresentationParallelLaunch
} from './phase-planner';

export interface PresentationDispatcherDeps {
  readonly strictNetworkPlayback?: boolean;
  /**
   * Validate the planner-owned step against the active board backend before
   * any board, sound, or global launch in that step starts.
   */
  readonly preflightBoardPhase?: (
    events: readonly PresentationPlaybackEvent[],
    scope: PresentationBoardPhaseScope
  ) => Promise<void> | void;
  readonly playBoardPhase: (
    events: readonly PresentationPlaybackEvent[],
    scope?: PresentationBoardPhaseScope
  ) => Promise<void> | void;
  readonly playGlobalEvent: (event: PresentationPlaybackEvent) => Promise<void> | void;
  readonly playManifestEndingGlobal?: (event: PresentationPlaybackEvent) => Promise<void> | void;
  readonly withParallelContext?: (
    events: readonly PresentationPlaybackEvent[],
    runner: () => Promise<void>
  ) => Promise<void>;
  readonly warnUnhandledLocalEvent?: (event: PresentationPlaybackEvent) => void;
}

export interface PresentationBoardPhaseScope {
  readonly events: readonly PresentationPlaybackEvent[];
  readonly phaseKey: string;
  readonly stepIndex: number;
}

function createBoardPhaseScope(
  plan: PresentationPhasePlan<PresentationPlaybackEvent>,
  stepIndex: number,
  events: readonly PresentationPlaybackEvent[]
): PresentationBoardPhaseScope {
  return Object.freeze({
    events: Object.freeze(Array.from(events)),
    phaseKey: plan.phaseKey,
    stepIndex
  });
}

function collectStepEvents(
  step: PresentationPhasePlan<PresentationPlaybackEvent>['steps'][number]
): readonly PresentationPlaybackEvent[] {
  if (step.kind === 'serial-event') return Object.freeze([step.event]);
  return Object.freeze(step.launches.flatMap((launch) => (
    launch.kind === 'flip-batch' ? Array.from(launch.events) : [launch.event]
  )));
}

function preflightStep(
  plan: PresentationPhasePlan<PresentationPlaybackEvent>,
  stepIndex: number,
  deps: PresentationDispatcherDeps
): PresentationBoardPhaseScope | Promise<PresentationBoardPhaseScope> {
  const events = collectStepEvents(plan.steps[stepIndex]);
  const scope = createBoardPhaseScope(plan, stepIndex, events);
  const needsBoardPreflight = events.some((event) => !isKnownGlobalPresentationEvent(event));
  if (needsBoardPreflight && typeof deps.preflightBoardPhase === 'function') {
    const result = deps.preflightBoardPhase(events, scope);
    if (result && typeof (result as Promise<void>).then === 'function') {
      return Promise.resolve(result).then(() => scope);
    }
  }
  return scope;
}

function isSoundEffect(event: PresentationPlaybackEvent): boolean {
  return String(event && event.type || '').trim().toLowerCase() === 'sound_effect';
}

function collectSoundKeys(event: PresentationPlaybackEvent): string[] {
  const keys: string[] = [];
  if (event && event.soundKey) keys.push(String(event.soundKey).trim());
  const targets = event && Array.isArray(event.targets) ? event.targets : [];
  for (const target of targets) {
    const soundKey = target && typeof target === 'object'
      ? (target as { soundKey?: unknown }).soundKey
      : null;
    if (soundKey) keys.push(String(soundKey).trim());
  }
  return keys.filter(Boolean);
}

/** Keeps the legacy treasure/charge sound de-duplication without reordering. */
export function normalizePresentationPhaseSoundEvents(
  events: readonly PresentationPlaybackEvent[]
): readonly PresentationPlaybackEvent[] {
  const source = Array.isArray(events) ? events : [];
  const hasTreasureGain = source.some((event) => (
    isSoundEffect(event) && collectSoundKeys(event).includes('treasure_gain')
  ));
  if (!hasTreasureGain) return source.slice();

  return source.map((event) => {
    if (!isSoundEffect(event)) return event;
    const filtered = collectSoundKeys(event).filter((key) => key !== 'charge_gain_common');
    if (!filtered.length) return null;
    const nextEvent: PresentationPlaybackEvent = { ...event };
    delete nextEvent.soundKey;
    nextEvent.targets = filtered.map((soundKey) => ({ soundKey }));
    return nextEvent;
  }).filter((event): event is PresentationPlaybackEvent => !!event);
}

async function dispatchHybridEvent(
  event: PresentationPlaybackEvent,
  deps: PresentationDispatcherDeps,
  scope?: PresentationBoardPhaseScope
): Promise<void> {
  const playGlobal = deps.playManifestEndingGlobal || deps.playGlobalEvent;
  // Legacy manifest-ending synchronously normalised board stones and started
  // the world/BGM/overlay transition in the same turn, then awaited the dim.
  // Invoke board first and global immediately after it before awaiting either.
  const boardPromise = Promise.resolve(deps.playBoardPhase([event], scope));
  const globalPromise = Promise.resolve(playGlobal(event));
  await Promise.all([boardPromise, globalPromise]);
}

async function dispatchUnknownEvent(
  event: PresentationPlaybackEvent,
  deps: PresentationDispatcherDeps,
  scope?: PresentationBoardPhaseScope
): Promise<void> {
  if (deps.strictNetworkPlayback === true) {
    throw new PresentationPlaybackError('presentation_event_unimplemented', event, {
      strictNetworkPlayback: true
    });
  }
  if (typeof deps.warnUnhandledLocalEvent === 'function') deps.warnUnhandledLocalEvent(event);
  await deps.playBoardPhase([{
    type: DOM_COMPATIBILITY_FINAL_STATE_EVENT,
    sourceEvent: event,
    targets: event.targets || []
  }], scope);
}

async function launchEvent(
  event: PresentationPlaybackEvent,
  deps: PresentationDispatcherDeps,
  scope?: PresentationBoardPhaseScope
): Promise<void> {
  if (isBoardPlaybackEvent(event)) {
    await deps.playBoardPhase([event], scope);
    return;
  }
  if (isHybridPresentationEvent(event)) {
    await dispatchHybridEvent(event, deps, scope);
    return;
  }
  if (isKnownGlobalPresentationEvent(event)) {
    await deps.playGlobalEvent(event);
    return;
  }
  await dispatchUnknownEvent(event, deps, scope);
}

function launchParallel(
  launch: PresentationParallelLaunch<PresentationPlaybackEvent>,
  deps: PresentationDispatcherDeps,
  scope: PresentationBoardPhaseScope
): Promise<void> {
  if (launch.kind === 'flip-batch') {
    return Promise.resolve(deps.playBoardPhase(launch.events, scope));
  }
  return Promise.resolve(launchEvent(launch.event, deps, scope));
}

export async function dispatchPresentationPhasePlan(
  plan: PresentationPhasePlan<PresentationPlaybackEvent>,
  deps: PresentationDispatcherDeps
): Promise<void> {
  if (!deps || typeof deps.playBoardPhase !== 'function' || typeof deps.playGlobalEvent !== 'function') {
    throw new Error('presentation_dispatcher_dependencies_unavailable');
  }

  for (let stepIndex = 0; stepIndex < plan.steps.length; stepIndex += 1) {
    const step = plan.steps[stepIndex];
    const preflight = preflightStep(plan, stepIndex, deps);
    const scope = preflight && typeof (preflight as Promise<PresentationBoardPhaseScope>).then === 'function'
      ? await preflight
      : preflight as PresentationBoardPhaseScope;
    if (step.kind === 'serial-event') {
      await launchEvent(step.event, deps, scope);
      continue;
    }
    const parallelEvents = scope.events;
    const runParallel = async () => {
      const promises: Promise<void>[] = [];
      // Calling launchParallel before collecting the next promise preserves
      // the legacy synchronous launch order (flip batch first, then non-flip).
      for (const launch of step.launches) promises.push(launchParallel(launch, deps, scope));
      await Promise.all(promises);
    };
    if (typeof deps.withParallelContext === 'function') {
      await deps.withParallelContext(parallelEvents, runParallel);
    } else {
      await runParallel();
    }
  }
}

/**
 * Capability preflight used by AnimationEngine before it claims a local board
 * writer. Dispatch performs the same validation again at each real step so
 * direct dispatcher callers retain the no-partial-start guarantee.
 */
export function preflightPresentationPhase(
  events: readonly PresentationPlaybackEvent[],
  deps: PresentationDispatcherDeps
): Promise<void> | void {
  if (!deps || typeof deps.playBoardPhase !== 'function' || typeof deps.playGlobalEvent !== 'function') {
    throw new Error('presentation_dispatcher_dependencies_unavailable');
  }
  const effectiveEvents = normalizePresentationPhaseSoundEvents(events);
  const plans = planPresentationPhases(effectiveEvents);
  const steps = plans.flatMap((plan) => (
    plan.steps.map((_step, stepIndex) => ({ plan, stepIndex }))
  ));
  const runFrom = (startIndex: number): Promise<void> | void => {
    for (let index = startIndex; index < steps.length; index += 1) {
      const candidate = preflightStep(steps[index].plan, steps[index].stepIndex, deps);
      if (candidate && typeof (candidate as Promise<PresentationBoardPhaseScope>).then === 'function') {
        return Promise.resolve(candidate).then(() => runFrom(index + 1));
      }
    }
  };
  return runFrom(0);
}

export async function dispatchPresentationPhase(
  events: readonly PresentationPlaybackEvent[],
  deps: PresentationDispatcherDeps
): Promise<void> {
  const effectiveEvents = normalizePresentationPhaseSoundEvents(events);
  const plans = planPresentationPhases(effectiveEvents);
  for (const plan of plans) await dispatchPresentationPhasePlan(plan, deps);
}
