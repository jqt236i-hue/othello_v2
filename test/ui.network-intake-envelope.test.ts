import { normalizeNetworkSnapshotEnvelope } from '../ui/network/intake-envelope';
import { compactNetworkPresentationEnvelope } from '../shared/network-presentation-envelope';

describe('network intake envelope normalizer', () => {
  test('normalizes publish response envelope', () => {
    const envelope = normalizeNetworkSnapshotEnvelope({
      source: 'publish_response',
      payload: {
        operationId: 'op_1',
        stateVersion: 7,
        snapshot: { stateVersion: 7 },
        presentationCursor: { visualSeq: 6, stateVersion: 7 },
        presentationFrames: [{ visualSeq: 6, stateVersionFrom: 6, stateVersionTo: 7 }]
      },
      force: true,
      now: () => 1000
    });

    expect(envelope).toMatchObject({
      source: 'publish_response',
      operationId: 'op_1',
      stateVersion: 7,
      visualSeq: 6,
      force: true,
      skipResultOverlay: false,
      receivedAt: 1000
    });
    expect(envelope.snapshot).toEqual({ stateVersion: 7 });
    expect(envelope.presentationCursor).toEqual({ visualSeq: 6, stateVersion: 7 });
    expect(envelope.presentationFrames).toHaveLength(1);
    expect(envelope.playbackEvents).toEqual([]);
  });

  test('uses snapshot version when payload stateVersion is missing', () => {
    const envelope = normalizeNetworkSnapshotEnvelope({
      source: 'stream',
      payload: { snapshot: { stateVersion: 9 } }
    });

    expect(envelope.stateVersion).toBe(9);
    expect(envelope.visualSeq).toBeNull();
  });

  test('prefers authoritative snapshot meta version over top-level snapshot stateVersion', () => {
    const envelope = normalizeNetworkSnapshotEnvelope({
      source: 'stream',
      payload: {
        snapshot: {
          stateVersion: 5,
          _meta: { version: 11 }
        }
      }
    });

    expect(envelope.stateVersion).toBe(11);
  });

  test('normalizes journal recovery shape and defaults arrays', () => {
    const envelope = normalizeNetworkSnapshotEnvelope({
      source: 'presentation_journal',
      payload: {
        baseSnapshot: { stateVersion: '12' },
        presentationCursor: { visualSeq: '10', stateVersion: '12' },
        playbackEvents: { not: 'array' },
        presentationFrames: [{ visualSeq: '10', stateVersionFrom: 11, stateVersionTo: 12 }]
      },
      skipResultOverlay: true
    });

    expect(envelope).toMatchObject({
      source: 'presentation_journal',
      operationId: null,
      stateVersion: 12,
      visualSeq: 10,
      skipResultOverlay: true
    });
    expect(envelope.snapshot).toEqual({ stateVersion: '12' });
    expect(envelope.playbackEvents).toEqual([]);
    expect(envelope.presentationFrames).toEqual([
      { visualSeq: '10', stateVersionFrom: 11, stateVersionTo: 12 }
    ]);
  });

  test('resolves V2 snapshot references before canonical frame normalization', () => {
    const snapshot = {
      stateVersion: 7,
      _meta: {
        version: 7,
        projectedForSeat: 'black',
        projectedSnapshotHash: 'hash-7'
      }
    };
    const full = {
      roomId: 'ROOM-V2',
      stateVersion: 7,
      snapshot,
      playbackEvents: [{ type: 'duplicate_top_level' }],
      presentationFrames: [{
        roomId: 'ROOM-V2',
        visualSeq: 5,
        stateVersionFrom: 6,
        stateVersionTo: 7,
        playbackEvents: [{ type: 'frame_event' }],
        projectedSnapshotHash: 'hash-7',
        snapshotAfter: JSON.parse(JSON.stringify(snapshot))
      }]
    };
    const compact = compactNetworkPresentationEnvelope(full, 2);
    const envelope = normalizeNetworkSnapshotEnvelope({ source: 'stream', payload: compact });

    expect(envelope.intakeError).toBeNull();
    expect(envelope.presentationEnvelopeVersion).toBe(2);
    expect(envelope.resolvedPresentationReferenceCount).toBe(1);
    expect(envelope.playbackEvents).toEqual([]);
    expect((envelope.presentationFrames[0] as any).snapshotAfter).toBe(snapshot);
    expect((envelope.presentationFrames[0] as any)).not.toHaveProperty('snapshotAfterRef');
  });

  test('marks malformed V2 references invalid without exposing snapshot or frames for apply', () => {
    const envelope = normalizeNetworkSnapshotEnvelope({
      source: 'stream',
      payload: {
        presentationEnvelopeVersion: 2,
        roomId: 'ROOM-V2',
        stateVersion: 7,
        snapshot: {
          stateVersion: 7,
          _meta: {
            version: 7,
            projectedForSeat: 'black',
            projectedSnapshotHash: 'hash-7'
          }
        },
        presentationFrames: [{
          roomId: 'ROOM-V2',
          visualSeq: 5,
          stateVersionFrom: 6,
          stateVersionTo: 7,
          playbackEvents: [],
          projectedSnapshotHash: 'hash-7',
          snapshotAfterRef: {
            kind: 'envelope-snapshot',
            stateVersion: 7,
            projectedSnapshotHash: 'tampered'
          }
        }]
      }
    });

    expect(envelope.intakeError).toBe('presentation_envelope_reference_mismatch');
    expect(envelope.snapshot).toBeNull();
    expect(envelope.presentationFrames).toEqual([]);
    expect(envelope.playbackEvents).toEqual([]);
  });
});
