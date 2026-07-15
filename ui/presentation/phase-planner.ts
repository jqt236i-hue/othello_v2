export interface PresentationEventLike {
  readonly type?: unknown;
  readonly phase?: unknown;
  readonly sequenceIndex?: unknown;
  readonly actionId?: unknown;
  readonly effectBlockId?: unknown;
}

export interface PresentationEventLaunch<TEvent extends PresentationEventLike> {
  readonly kind: 'event';
  readonly event: TEvent;
  readonly inputIndex: number;
}

export interface PresentationFlipBatchLaunch<TEvent extends PresentationEventLike> {
  readonly kind: 'flip-batch';
  readonly events: readonly TEvent[];
  readonly inputIndices: readonly number[];
}

export type PresentationParallelLaunch<TEvent extends PresentationEventLike> =
  | PresentationFlipBatchLaunch<TEvent>
  | PresentationEventLaunch<TEvent>;

export interface PresentationSerialStep<TEvent extends PresentationEventLike> {
  readonly kind: 'serial-event';
  readonly event: TEvent;
  readonly inputIndex: number;
}

export interface PresentationParallelStep<TEvent extends PresentationEventLike> {
  readonly kind: 'parallel';
  readonly launches: readonly PresentationParallelLaunch<TEvent>[];
}

export type PresentationPhaseStep<TEvent extends PresentationEventLike> =
  | PresentationSerialStep<TEvent>
  | PresentationParallelStep<TEvent>;

export interface PresentationPhasePlan<TEvent extends PresentationEventLike> {
  /** Numeric phase used by the existing AnimationEngine phase loop. */
  readonly phase: number;
  /** Original object-key form used by the legacy phase grouping. */
  readonly phaseKey: string;
  /** Events in their original order within this phase. */
  readonly events: readonly TEvent[];
  /** Exact serial/parallel launch shape of the existing executePhase(). */
  readonly steps: readonly PresentationPhaseStep<TEvent>[];
}

export interface PresentationPhasePlannerOptions {
  readonly flipEventType?: unknown;
  readonly serialEventTypes?: readonly unknown[];
}

interface IndexedEvent<TEvent extends PresentationEventLike> {
  readonly event: TEvent;
  readonly inputIndex: number;
}

const DEFAULT_FLIP_EVENT_TYPE = 'flip';
const DEFAULT_SERIAL_EVENT_TYPES: readonly unknown[] = Object.freeze(['manifest_ending']);

function resolveLegacyPhaseKey(event: PresentationEventLike): string {
  // Keep the legacy `ev.phase || 0` rule. In particular, missing/null/NaN
  // phases remain phase zero and no presentation metadata is inferred here.
  return String(event.phase || 0);
}

function groupIndexedEventsByPhase<TEvent extends PresentationEventLike>(
  events: readonly TEvent[]
): Record<string, IndexedEvent<TEvent>[]> {
  const groups: Record<string, IndexedEvent<TEvent>[]> = {};
  events.forEach((event, inputIndex) => {
    const phaseKey = resolveLegacyPhaseKey(event);
    if (!groups[phaseKey]) groups[phaseKey] = [];
    groups[phaseKey].push(Object.freeze({ event, inputIndex }));
  });
  return groups;
}

/** Immutable equivalent of AnimationEngine.groupByPhase(). */
export function groupPresentationEventsByPhase<TEvent extends PresentationEventLike>(
  events: readonly TEvent[]
): Readonly<Record<string, readonly TEvent[]>> {
  const indexedGroups = groupIndexedEventsByPhase(events);
  const groups: Record<string, readonly TEvent[]> = {};
  for (const phaseKey of Object.keys(indexedGroups)) {
    groups[phaseKey] = Object.freeze(indexedGroups[phaseKey].map(({ event }) => event));
  }
  return Object.freeze(groups);
}

export const groupByPhase = groupPresentationEventsByPhase;

function createPhaseSteps<TEvent extends PresentationEventLike>(
  indexedEvents: readonly IndexedEvent<TEvent>[],
  flipEventType: unknown,
  serialEventTypes: readonly unknown[]
): readonly PresentationPhaseStep<TEvent>[] {
  const steps: PresentationPhaseStep<TEvent>[] = [];
  const serialTypeSet = new Set(serialEventTypes);
  const serialEvents = indexedEvents.filter(({ event }) => serialTypeSet.has(event.type));
  const concurrentEvents = indexedEvents.filter(({ event }) => !serialTypeSet.has(event.type));

  // The current AnimationEngine executes manifest-ending events one by one
  // before any other event in the same phase, regardless of their input slot.
  for (const indexed of serialEvents) {
    steps.push(Object.freeze({
      kind: 'serial-event' as const,
      event: indexed.event,
      inputIndex: indexed.inputIndex
    }));
  }

  if (!concurrentEvents.length) return Object.freeze(steps);

  const flips = concurrentEvents.filter(({ event }) => event.type === flipEventType);
  const nonFlips = concurrentEvents.filter(({ event }) => event.type !== flipEventType);
  const launches: PresentationParallelLaunch<TEvent>[] = [];

  // executePhase() launches one flip batch first, then launches every non-flip
  // event in its original input order before awaiting the whole phase.
  if (flips.length) {
    launches.push(Object.freeze({
      kind: 'flip-batch' as const,
      events: Object.freeze(flips.map(({ event }) => event)),
      inputIndices: Object.freeze(flips.map(({ inputIndex }) => inputIndex))
    }));
  }
  for (const indexed of nonFlips) {
    launches.push(Object.freeze({
      kind: 'event' as const,
      event: indexed.event,
      inputIndex: indexed.inputIndex
    }));
  }

  steps.push(Object.freeze({
    kind: 'parallel' as const,
    launches: Object.freeze(launches)
  }));
  return Object.freeze(steps);
}

/**
 * Builds the immutable presentation execution plan used by AnimationEngine.
 *
 * `sequenceIndex`, `actionId`, and `effectBlockId` remain authoritative event
 * metadata. The UI must not sort, merge, or infer new grouping from them, so
 * this planner keeps each event object and the stable input order unchanged.
 */
export function planPresentationPhases<TEvent extends PresentationEventLike>(
  events: readonly TEvent[],
  options: PresentationPhasePlannerOptions = {}
): readonly PresentationPhasePlan<TEvent>[] {
  const flipEventType = options.flipEventType ?? DEFAULT_FLIP_EVENT_TYPE;
  const serialEventTypes = options.serialEventTypes ?? DEFAULT_SERIAL_EVENT_TYPES;
  const groups = groupIndexedEventsByPhase(events);

  // This intentionally mirrors Object.keys(...).sort(Number(a) - Number(b))
  // from AnimationEngine instead of sorting by presentation metadata.
  const phaseKeys = Object.keys(groups).sort((a, b) => Number(a) - Number(b));
  return Object.freeze(phaseKeys.map((phaseKey) => {
    const indexedEvents = groups[phaseKey];
    const phaseEvents = Object.freeze(indexedEvents.map(({ event }) => event));
    return Object.freeze({
      phase: Number(phaseKey),
      phaseKey,
      events: phaseEvents,
      steps: createPhaseSteps(indexedEvents, flipEventType, serialEventTypes)
    });
  }));
}
