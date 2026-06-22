export type NetworkIntakeSource =
  | 'publish_response'
  | 'stream'
  | 'state_sync'
  | 'presentation_journal'
  | 'heartbeat_recovery';

export interface NetworkPresentationCursor {
  visualSeq: number;
  stateVersion: number;
}

export interface NetworkSnapshotEnvelope {
  source: NetworkIntakeSource;
  operationId: string | null;
  stateVersion: number | null;
  visualSeq: number | null;
  snapshot: unknown | null;
  presentationFrames: unknown[];
  playbackEvents: unknown[];
  presentationCursor: NetworkPresentationCursor | null;
  force: boolean;
  skipResultOverlay: boolean;
  receivedAt: number;
}

export interface NormalizeNetworkSnapshotEnvelopeInput {
  source: NetworkIntakeSource | string;
  payload?: any;
  operationId?: unknown;
  stateVersion?: unknown;
  visualSeq?: unknown;
  snapshot?: unknown;
  presentationFrames?: unknown;
  playbackEvents?: unknown;
  presentationCursor?: unknown;
  force?: unknown;
  skipResultOverlay?: unknown;
  receivedAt?: unknown;
  now?: () => number;
}

const KNOWN_SOURCES = new Set([
  'publish_response',
  'stream',
  'state_sync',
  'presentation_journal',
  'heartbeat_recovery'
]);

function toIntegerOrNull(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function normalizeSource(value: unknown): NetworkIntakeSource {
  const text = String(value || '').trim();
  return KNOWN_SOURCES.has(text) ? text as NetworkIntakeSource : 'state_sync';
}

function normalizeOperationId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizePresentationCursor(value: unknown): NetworkPresentationCursor | null {
  const cursor = value && typeof value === 'object' ? value as any : null;
  if (!cursor) return null;
  const visualSeq = toIntegerOrNull(cursor.visualSeq);
  const stateVersion = toIntegerOrNull(cursor.stateVersion);
  if (visualSeq === null || stateVersion === null) return null;
  return { visualSeq, stateVersion };
}

function pickSnapshot(input: NormalizeNetworkSnapshotEnvelopeInput, payload: any): unknown | null {
  if (Object.prototype.hasOwnProperty.call(input, 'snapshot')) return input.snapshot ?? null;
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'snapshot')) return payload.snapshot ?? null;
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'baseSnapshot')) return payload.baseSnapshot ?? null;
  return null;
}

function readSnapshotVersion(snapshot: unknown): number | null {
  const record = snapshot && typeof snapshot === 'object' ? snapshot as any : null;
  if (!record) return null;
  return toIntegerOrNull(record.stateVersion)
    ?? toIntegerOrNull(record.version)
    ?? toIntegerOrNull(record._meta && record._meta.version);
}

function firstInteger(values: unknown[]): number | null {
  for (const value of values) {
    const numeric = toIntegerOrNull(value);
    if (numeric !== null) return numeric;
  }
  return null;
}

export function normalizeNetworkSnapshotEnvelope(input: NormalizeNetworkSnapshotEnvelopeInput): NetworkSnapshotEnvelope {
  const sourceInput = input && typeof input === 'object' ? input : { source: 'state_sync' };
  const payload = sourceInput.payload && typeof sourceInput.payload === 'object'
    ? sourceInput.payload
    : {};
  const snapshot = pickSnapshot(sourceInput, payload);
  const presentationCursor = normalizePresentationCursor(
    Object.prototype.hasOwnProperty.call(sourceInput, 'presentationCursor')
      ? sourceInput.presentationCursor
      : payload.presentationCursor
  );
  const stateVersion = firstInteger([
    sourceInput.stateVersion,
    payload.stateVersion,
    readSnapshotVersion(snapshot),
    presentationCursor && presentationCursor.stateVersion
  ]);
  const visualSeq = firstInteger([
    sourceInput.visualSeq,
    payload.visualSeq,
    presentationCursor && presentationCursor.visualSeq
  ]);
  const receivedAt = firstInteger([sourceInput.receivedAt])
    ?? (typeof sourceInput.now === 'function' ? toIntegerOrNull(sourceInput.now()) : null)
    ?? Date.now();

  return {
    source: normalizeSource(sourceInput.source),
    operationId: normalizeOperationId(sourceInput.operationId) ?? normalizeOperationId(payload.operationId),
    stateVersion,
    visualSeq,
    snapshot,
    presentationFrames: normalizeArray(
      Object.prototype.hasOwnProperty.call(sourceInput, 'presentationFrames')
        ? sourceInput.presentationFrames
        : payload.presentationFrames
    ),
    playbackEvents: normalizeArray(
      Object.prototype.hasOwnProperty.call(sourceInput, 'playbackEvents')
        ? sourceInput.playbackEvents
        : payload.playbackEvents
    ),
    presentationCursor,
    force: sourceInput.force === true,
    skipResultOverlay: sourceInput.skipResultOverlay === true,
    receivedAt
  };
}
