import { normalizeNetworkSnapshotEnvelope } from '../ui/network/intake-envelope';

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
});
