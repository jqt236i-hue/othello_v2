import { packPlaybackEvents, unpackPlaybackEvents } from './playback-event-codec';
export const PRESENTATION_ENVELOPE_VERSION = 3 as const;

export interface EnvelopeSnapshotRefV2 {
  readonly kind: 'envelope-snapshot';
  readonly stateVersion: number;
  readonly projectedSnapshotHash: string;
}

export interface PresentationEnvelopeResolveSuccess {
  ok: true;
  payload: Record<string, unknown>;
  resolvedReferenceCount: number;
}

export interface PresentationEnvelopeResolveFailure {
  ok: false;
  reason: string;
  frameIndex: number | null;
}

export type PresentationEnvelopeResolveResult =
  | PresentationEnvelopeResolveSuccess
  | PresentationEnvelopeResolveFailure;

interface SnapshotIdentity {
  stateVersion: number;
  projectedSnapshotHash: string;
  projectionKey: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeInteger(value: unknown): number | null {
  if (value === null || typeof value === 'undefined' || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : null;
}

function normalizeNonEmptyString(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function normalizeRoomId(value: unknown): string | null {
  const text = normalizeNonEmptyString(value);
  return text ? text.toUpperCase() : null;
}

function normalizeSeatKey(value: unknown): 'black' | 'white' | null {
  if (value === 'black' || value === 1 || value === '1' || value === '+1') return 'black';
  if (value === 'white' || value === -1 || value === '-1') return 'white';
  return null;
}

function readProjectionKey(snapshot: Record<string, unknown>): string | null {
  const metadata = asRecord(snapshot._meta);
  if (!metadata) return null;
  const viewerRole = String(metadata.viewerRole || '').trim().toLowerCase();
  const projectedForSeat = normalizeSeatKey(metadata.projectedForSeat);
  if (viewerRole === 'spectator') {
    return projectedForSeat === null ? 'spectator' : null;
  }
  if (viewerRole && viewerRole !== 'seat') return null;
  return projectedForSeat ? `seat:${projectedForSeat}` : null;
}

function readSnapshotIdentity(snapshotValue: unknown): SnapshotIdentity | null {
  const snapshot = asRecord(snapshotValue);
  if (!snapshot) return null;
  const metadata = asRecord(snapshot._meta);
  if (!metadata) return null;
  const stateVersion = normalizeInteger(metadata.version)
    ?? normalizeInteger(snapshot.stateVersion)
    ?? normalizeInteger(snapshot.version);
  const projectedSnapshotHash = normalizeNonEmptyString(metadata.projectedSnapshotHash);
  const projectionKey = readProjectionKey(snapshot);
  if (stateVersion === null || !projectedSnapshotHash || !projectionKey) return null;
  return { stateVersion, projectedSnapshotHash, projectionKey };
}

function roomMatches(
  envelope: Record<string, unknown>,
  frame: Record<string, unknown>,
  snapshot: Record<string, unknown>
): boolean {
  const envelopeRoomId = normalizeRoomId(envelope.roomId);
  const frameRoomId = normalizeRoomId(frame.roomId);
  if (!envelopeRoomId || !frameRoomId || envelopeRoomId !== frameRoomId) return false;
  const snapshotRoomId = normalizeRoomId(snapshot.roomId);
  return snapshotRoomId === null || snapshotRoomId === envelopeRoomId;
}

function isValidPresentationFrame(value: unknown): value is Record<string, unknown> {
  const frame = asRecord(value);
  if (!frame) return false;
  const visualSeq = normalizeInteger(frame.visualSeq);
  const stateVersionFrom = normalizeInteger(frame.stateVersionFrom);
  const stateVersionTo = normalizeInteger(frame.stateVersionTo);
  return visualSeq !== null
    && visualSeq > 0
    && stateVersionFrom !== null
    && stateVersionTo !== null
    && stateVersionTo > stateVersionFrom
    && Array.isArray(frame.playbackEvents);
}

function canReferenceEnvelopeSnapshot(
  envelope: Record<string, unknown>,
  frame: Record<string, unknown>,
  snapshotAfterValue: unknown,
  reference?: EnvelopeSnapshotRefV2 | null
): boolean {
  const envelopeSnapshot = asRecord(envelope.snapshot);
  const snapshotAfter = asRecord(snapshotAfterValue);
  if (!envelopeSnapshot || !snapshotAfter) return false;
  const envelopeIdentity = readSnapshotIdentity(envelopeSnapshot);
  const frameSnapshotIdentity = readSnapshotIdentity(snapshotAfter);
  if (!envelopeIdentity || !frameSnapshotIdentity) return false;
  const frameStateVersion = normalizeInteger(frame.stateVersionTo);
  const frameProjectedHash = normalizeNonEmptyString(frame.projectedSnapshotHash);
  if (
    frameStateVersion === null
    || !frameProjectedHash
    || frameStateVersion !== envelopeIdentity.stateVersion
    || frameStateVersion !== frameSnapshotIdentity.stateVersion
    || frameProjectedHash !== envelopeIdentity.projectedSnapshotHash
    || frameProjectedHash !== frameSnapshotIdentity.projectedSnapshotHash
    || envelopeIdentity.projectionKey !== frameSnapshotIdentity.projectionKey
    || !roomMatches(envelope, frame, envelopeSnapshot)
    || !roomMatches(envelope, frame, snapshotAfter)
  ) {
    return false;
  }
  if (!reference) return true;
  return reference.stateVersion === frameStateVersion
    && reference.projectedSnapshotHash === frameProjectedHash;
}

function normalizeReference(value: unknown): EnvelopeSnapshotRefV2 | null {
  const reference = asRecord(value);
  if (!reference || reference.kind !== 'envelope-snapshot') return null;
  const stateVersion = normalizeInteger(reference.stateVersion);
  const projectedSnapshotHash = normalizeNonEmptyString(reference.projectedSnapshotHash);
  if (stateVersion === null || !projectedSnapshotHash) return null;
  return {
    kind: 'envelope-snapshot',
    stateVersion,
    projectedSnapshotHash
  };
}

export function normalizePresentationEnvelopeCapability(value: unknown): 2 | 3 | null {
  const version = normalizeInteger(value);
  return version === 2 || version === 3 ? version : null;
}

export function compactNetworkPresentationEnvelope(
  payloadValue: unknown,
  capabilityValue: unknown
): Record<string, unknown> {
  const payload = asRecord(payloadValue) || {};
  const capability = normalizePresentationEnvelopeCapability(capabilityValue);
  if (capability === null) {
    return payload;
  }

  const compacted: Record<string, unknown> = {
    ...payload,
    presentationEnvelopeVersion: capability
  };
  const frames = Array.isArray(payload.presentationFrames) ? payload.presentationFrames : [];
  const validFrames = frames.length > 0 && frames.every(isValidPresentationFrame);
  if (validFrames) delete compacted.playbackEvents;

  let changedFrames: unknown[] | null = null;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index] as Record<string, unknown>;
    if (!isValidPresentationFrame(frame)) continue;
    if (!canReferenceEnvelopeSnapshot(payload, frame, frame.snapshotAfter)) continue;
    if (!changedFrames) changedFrames = frames.slice();
    const stateVersion = normalizeInteger(frame.stateVersionTo) as number;
    const projectedSnapshotHash = normalizeNonEmptyString(frame.projectedSnapshotHash) as string;
    const compactFrame: Record<string, unknown> = { ...frame };
    delete compactFrame.snapshotAfter;
    compactFrame.snapshotAfterRef = {
      kind: 'envelope-snapshot',
      stateVersion,
      projectedSnapshotHash
    } satisfies EnvelopeSnapshotRefV2;
    changedFrames[index] = compactFrame;
  }
  if (changedFrames) compacted.presentationFrames = changedFrames;
  if (capability === 3 && validFrames) {
    compacted.presentationFrames = (compacted.presentationFrames as Record<string, unknown>[]).map(frame => {
      const packed = packPlaybackEvents(frame.playbackEvents as unknown[]);
      if (!packed || JSON.stringify(packed).length + 32 >= JSON.stringify(frame.playbackEvents).length) return frame;
      const next: Record<string, unknown> = { ...frame, playbackEventsPacked: packed };
      delete next.playbackEvents;
      return next;
    });
  }
  return compacted;
}

function failure(reason: string, frameIndex: number | null = null): PresentationEnvelopeResolveFailure {
  return { ok: false, reason, frameIndex };
}

export function resolveNetworkPresentationEnvelope(payloadValue: unknown): PresentationEnvelopeResolveResult {
  let payload = asRecord(payloadValue);
  if (!payload) return failure('presentation_envelope_payload_required');
  const hasVersion = hasOwn(payload, 'presentationEnvelopeVersion');
  const rawVersion = hasVersion ? normalizeInteger(payload.presentationEnvelopeVersion) : null;
  let frames = Array.isArray(payload.presentationFrames) ? payload.presentationFrames : [];
  const hasPackedEvents = frames.some(frame => !!asRecord(frame) && hasOwn(frame, 'playbackEventsPacked'));
  if (hasPackedEvents) {
    if (rawVersion !== 3) return failure('presentation_envelope_packed_events_requires_v3');
    const expanded: unknown[] = [];
    for (let i = 0; i < frames.length; i++) {
      const frame = asRecord(frames[i]);
      if (!frame) return failure('presentation_envelope_frame_invalid', i);
      if (!hasOwn(frame, 'playbackEventsPacked')) { expanded.push(frame); continue; }
      if (hasOwn(frame, 'playbackEvents')) return failure('presentation_envelope_playback_ambiguous', i);
      try {
        const next: Record<string, unknown> = { ...frame, playbackEvents: unpackPlaybackEvents(frame.playbackEventsPacked) };
        delete next.playbackEventsPacked;
        expanded.push(next);
      } catch (_) { return failure('presentation_envelope_packed_events_invalid', i); }
    }
    frames = expanded;
    payload = { ...payload, presentationFrames: expanded };
  }
  const hasReference = frames.some((value) => {
    const frame = asRecord(value);
    return !!(frame && hasOwn(frame, 'snapshotAfterRef'));
  });

  if (hasVersion && rawVersion !== 1 && rawVersion !== 2 && rawVersion !== 3) {
    return failure('presentation_envelope_version_unsupported');
  }
  if (rawVersion !== 2 && rawVersion !== 3) {
    return hasReference
      ? failure('presentation_envelope_reference_requires_v2')
      : { ok: true, payload, resolvedReferenceCount: 0 };
  }
  if (frames.length > 0 && hasOwn(payload, 'playbackEvents')) {
    return failure('presentation_envelope_v2_duplicate_playback');
  }

  let resolvedFrames: unknown[] | null = null;
  let resolvedReferenceCount = 0;
  for (let index = 0; index < frames.length; index += 1) {
    const frame = asRecord(frames[index]);
    if (!frame) return failure('presentation_envelope_frame_invalid', index);
    if (!hasOwn(frame, 'snapshotAfterRef')) continue;
    if (hasOwn(frame, 'snapshotAfter')) {
      return failure('presentation_envelope_frame_snapshot_ambiguous', index);
    }
    const reference = normalizeReference(frame.snapshotAfterRef);
    if (!reference) return failure('presentation_envelope_reference_invalid', index);
    if (!canReferenceEnvelopeSnapshot(payload, frame, payload.snapshot, reference)) {
      return failure('presentation_envelope_reference_mismatch', index);
    }
    if (!resolvedFrames) resolvedFrames = frames.slice();
    const resolvedFrame: Record<string, unknown> = { ...frame, snapshotAfter: payload.snapshot };
    delete resolvedFrame.snapshotAfterRef;
    resolvedFrames[index] = resolvedFrame;
    resolvedReferenceCount += 1;
  }

  if (!resolvedFrames) return { ok: true, payload, resolvedReferenceCount: 0 };
  return {
    ok: true,
    payload: { ...payload, presentationFrames: resolvedFrames },
    resolvedReferenceCount
  };
}

export function isFrameSnapshotReferenceCompatible(
  envelopeValue: unknown,
  frameValue: unknown,
  snapshotAfterValue: unknown
): boolean {
  const envelope = asRecord(envelopeValue);
  const frame = asRecord(frameValue);
  return !!(envelope && frame && canReferenceEnvelopeSnapshot(envelope, frame, snapshotAfterValue));
}
