const VISUAL_SEED_NAMESPACE = 'card-reversi:presentation-seed:v1';
const LOCAL_PRESENTATION_BATCH_PREFIX = 'local-presentation:';
let nextLocalPresentationBatchIndex = 0;

export interface VisualSeedEventLike {
  visualSeq?: unknown;
  presentationBatchId?: unknown;
  sequenceIndex?: unknown;
  actionId?: unknown;
  effectBlockId?: unknown;
  effectKind?: unknown;
  kind?: unknown;
  type?: unknown;
  target?: unknown;
  row?: unknown;
  col?: unknown;
  r?: unknown;
  c?: unknown;
  meta?: Record<string, unknown> | null;
}

export interface VisualSeedInput extends VisualSeedEventLike {
  event?: VisualSeedEventLike | null;
}

export type PresentationBatchEvent<T extends Record<string, unknown>> = T & {
  presentationBatchId: string;
};

function hasOwn(source: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(source, key);
}

function firstDefined(values: readonly unknown[]): unknown {
  for (const value of values) {
    if (typeof value !== 'undefined') return value;
  }
  return undefined;
}

function normalizeInteger(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function normalizeIdentifier(value: unknown): string | null {
  if (value === null || typeof value === 'undefined') return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function stableSerialize(value: unknown, ancestors: Set<object> = new Set()): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return JSON.stringify(String(value));
    return Object.is(value, -0) ? '-0' : String(value);
  }
  if (typeof value === 'bigint') return JSON.stringify(`${String(value)}n`);
  if (typeof value === 'undefined') return '"[undefined]"';
  if (typeof value === 'symbol' || typeof value === 'function') {
    return JSON.stringify(`[${typeof value}]`);
  }
  if (ancestors.has(value)) throw new Error('visual_seed_target_circular');

  ancestors.add(value);
  let serialized: string;
  if (Array.isArray(value)) {
    serialized = `[${value.map((entry) => stableSerialize(entry, ancestors)).join(',')}]`;
  } else {
    const source = value as Record<string, unknown>;
    const entries = Object.keys(source)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(source[key], ancestors)}`);
    serialized = `{${entries.join(',')}}`;
  }
  ancestors.delete(value);
  return serialized;
}

function normalizeTarget(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const source = value as VisualSeedEventLike;
  const row = firstDefined([source.row, source.r]);
  const col = firstDefined([source.col, source.c]);
  if (typeof row === 'undefined' && typeof col === 'undefined') return value;
  return Object.freeze({ row: normalizeInteger(row), col: normalizeInteger(col) });
}

function readCoordinateTarget(source: VisualSeedEventLike | null | undefined): unknown {
  if (!source) return undefined;
  if (hasOwn(source, 'target')) return normalizeTarget(source.target);
  const row = firstDefined([source.row, source.r]);
  const col = firstDefined([source.col, source.c]);
  if (typeof row === 'undefined' && typeof col === 'undefined') return undefined;
  return { row: normalizeInteger(row), col: normalizeInteger(col) };
}

function resolveSeedTuple(input: VisualSeedInput): readonly unknown[] {
  const source = input && typeof input === 'object' ? input : {};
  const event = source.event && typeof source.event === 'object' ? source.event : null;
  const sourceMeta = source.meta && typeof source.meta === 'object' ? source.meta : null;
  const eventMeta = event && event.meta && typeof event.meta === 'object' ? event.meta : null;
  const visualSeq = normalizeInteger(firstDefined([
    source.visualSeq,
    event?.visualSeq,
    sourceMeta?.visualSeq,
    eventMeta?.visualSeq
  ]));
  const presentationBatchId = normalizeIdentifier(firstDefined([
    source.presentationBatchId,
    event?.presentationBatchId,
    sourceMeta?.presentationBatchId,
    eventMeta?.presentationBatchId
  ]));
  if (visualSeq === null && presentationBatchId === null) {
    throw new Error('visual_seed_identity_required');
  }
  const sequenceIndex = normalizeInteger(firstDefined([
    source.sequenceIndex,
    event?.sequenceIndex,
    sourceMeta?.sequenceIndex,
    eventMeta?.sequenceIndex
  ]));
  const actionId = normalizeIdentifier(firstDefined([
    source.actionId,
    event?.actionId,
    sourceMeta?.actionId,
    eventMeta?.actionId
  ]));
  const effectBlockId = normalizeIdentifier(firstDefined([
    source.effectBlockId,
    event?.effectBlockId,
    sourceMeta?.effectBlockId,
    eventMeta?.effectBlockId
  ]));
  const effectKind = normalizeIdentifier(firstDefined([
    source.effectKind,
    source.kind,
    source.type,
    event?.effectKind,
    event?.kind,
    event?.type,
    sourceMeta ? firstDefined([sourceMeta.effectKind, sourceMeta.kind, sourceMeta.type]) : undefined,
    eventMeta ? firstDefined([eventMeta.effectKind, eventMeta.kind, eventMeta.type]) : undefined
  ]));
  if (effectKind === null) throw new Error('visual_seed_effect_kind_required');

  const target = firstDefined([
    readCoordinateTarget(source),
    readCoordinateTarget(event),
    readCoordinateTarget(sourceMeta as VisualSeedEventLike | null),
    readCoordinateTarget(eventMeta as VisualSeedEventLike | null)
  ]);

  return Object.freeze([
    VISUAL_SEED_NAMESPACE,
    visualSeq,
    visualSeq === null ? presentationBatchId : null,
    sequenceIndex,
    actionId,
    effectBlockId,
    effectKind,
    typeof target === 'undefined' ? null : target
  ]);
}

function fnv1a32(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 2166136261;
}

export function createPresentationBatchId(orderedBatchIndex: unknown): string {
  const index = normalizeInteger(orderedBatchIndex);
  if (index === null || index < 0 || Number(orderedBatchIndex) !== index) {
    throw new Error('presentation_batch_index_invalid');
  }
  return `${LOCAL_PRESENTATION_BATCH_PREFIX}${index}`;
}

export function withPresentationBatchId<T extends Record<string, unknown>>(
  events: readonly T[],
  orderedBatchIndex: unknown
): readonly PresentationBatchEvent<T>[] {
  if (!Array.isArray(events)) throw new Error('presentation_batch_events_invalid');
  const presentationBatchId = createPresentationBatchId(orderedBatchIndex);
  return Object.freeze(events.map((event) => ({ ...event, presentationBatchId })));
}

function hasPresentationIdentity(event: Record<string, unknown>): boolean {
  const meta = event && event.meta && typeof event.meta === 'object'
    ? event.meta as Record<string, unknown>
    : null;
  return normalizeInteger(firstDefined([event.visualSeq, meta?.visualSeq])) !== null
    || normalizeIdentifier(firstDefined([event.presentationBatchId, meta?.presentationBatchId])) !== null;
}

/** Assigns one process-ordered local identity at the shared playback ingress. */
export function withNextPresentationBatchId<T extends Record<string, unknown>>(
  events: readonly T[]
): readonly T[] {
  if (!Array.isArray(events)) throw new Error('presentation_batch_events_invalid');
  if (!events.some((event) => !hasPresentationIdentity(event))) return Object.freeze(events.slice());
  const presentationBatchId = createPresentationBatchId(nextLocalPresentationBatchIndex++);
  return Object.freeze(
    events.map((event) => (
      hasPresentationIdentity(event) ? event : { ...event, presentationBatchId }
    )) as readonly T[]
  );
}

export function createVisualSeedKey(input: VisualSeedInput): string {
  return stableSerialize(resolveSeedTuple(input));
}

export function createVisualSeed(input: VisualSeedInput): number {
  return fnv1a32(createVisualSeedKey(input));
}

/** Small UI-only deterministic PRNG. It never reads canonical/game RNG. */
export function createVisualRandom(seedInput: number | VisualSeedInput): () => number {
  let state = typeof seedInput === 'number'
    ? (seedInput >>> 0)
    : createVisualSeed(seedInput);
  if (state === 0) state = 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
}

export const VisualSeedConstants = Object.freeze({
  namespace: VISUAL_SEED_NAMESPACE,
  localPresentationBatchPrefix: LOCAL_PRESENTATION_BATCH_PREFIX
});
