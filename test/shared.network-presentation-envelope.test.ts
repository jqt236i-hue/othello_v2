import {
  PRESENTATION_ENVELOPE_VERSION,
  compactNetworkPresentationEnvelope,
  isFrameSnapshotReferenceCompatible,
  normalizePresentationEnvelopeCapability,
  resolveNetworkPresentationEnvelope
} from '../shared/network-presentation-envelope';

function snapshot(version: number, hash: string, projection: 'black' | 'white' | 'spectator', marker = ''): any {
  return {
    stateVersion: version,
    _meta: {
      authority: 'server',
      version,
      projectedForSeat: projection === 'spectator' ? null : projection,
      ...(projection === 'spectator' ? { viewerRole: 'spectator' } : {}),
      projectedSnapshotHash: hash
    },
    boardState: {
      board: Array.from({ length: 128 }, (_, index) => `${marker}:${index % 3}`),
      effects: Array.from({ length: 24 }, (_, index) => ({ id: `${marker}:effect:${index}`, active: index % 2 === 0 }))
    },
    cardState: {
      hands: {
        black: Array.from({ length: 12 }, (_, index) => `${marker}:black:${index}`),
        white: Array.from({ length: 12 }, (_, index) => `${marker}:hidden:${index}`)
      }
    }
  };
}

function frame(options: {
  visualSeq: number;
  from: number;
  to: number;
  hash: string;
  snapshotAfter: any;
}): any {
  return {
    roomId: 'ROOM-V2',
    visualSeq: options.visualSeq,
    stateVersionFrom: options.from,
    stateVersionTo: options.to,
    operationId: `operation-${options.visualSeq}`,
    actorSeatKey: 'black',
    actionType: 'use_card',
    playbackEvents: Array.from({ length: 80 }, (_, index) => ({
      type: 'special_card_effect',
      effect: 'lightning',
      index,
      targets: Array.from({ length: 8 }, (__, target) => ({ row: target, col: (target + index) % 8 }))
    })),
    playbackDigest: `digest-${options.visualSeq}`,
    effectLogs: [],
    playbackDiagnostics: null,
    projectedSnapshotHash: options.hash,
    snapshotAfter: options.snapshotAfter,
    createdAt: 1000 + options.visualSeq
  };
}

function fullEnvelope(projection: 'black' | 'white' | 'spectator' = 'black'): any {
  const latest = snapshot(12, `hash-${projection}-12`, projection, 'latest');
  const historical = snapshot(11, `hash-${projection}-11`, projection, 'historical');
  const frames = [
    frame({ visualSeq: 41, from: 10, to: 11, hash: `hash-${projection}-11`, snapshotAfter: historical }),
    frame({ visualSeq: 42, from: 11, to: 12, hash: `hash-${projection}-12`, snapshotAfter: JSON.parse(JSON.stringify(latest)) })
  ];
  return {
    ok: true,
    roomId: 'ROOM-V2',
    stateVersion: 12,
    visualSeq: 42,
    snapshot: latest,
    playbackEvents: frames[1].playbackEvents,
    playbackDigest: frames[1].playbackDigest,
    presentationFrames: frames,
    presentationCursor: { visualSeq: 42, stateVersion: 12 }
  };
}

describe('network presentation envelope V2', () => {
  test('normalizes only explicit version 2 capability and leaves legacy payload identity unchanged', () => {
    expect(normalizePresentationEnvelopeCapability(2)).toBe(PRESENTATION_ENVELOPE_VERSION);
    expect(normalizePresentationEnvelopeCapability('2')).toBe(PRESENTATION_ENVELOPE_VERSION);
    expect(normalizePresentationEnvelopeCapability(1)).toBeNull();
    expect(normalizePresentationEnvelopeCapability(3)).toBeNull();

    const legacy = fullEnvelope();
    expect(compactNetworkPresentationEnvelope(legacy, undefined)).toBe(legacy);
    expect(compactNetworkPresentationEnvelope(legacy, 1)).toBe(legacy);
    expect(compactNetworkPresentationEnvelope(legacy, 999)).toBe(legacy);
  });

  test.each(['black', 'white', 'spectator'] as const)(
    'compacts and resolves the exact latest %s projection without mutating the full envelope',
    (projection) => {
      const full = fullEnvelope(projection);
      const originalJson = JSON.stringify(full);
      const compact = compactNetworkPresentationEnvelope(full, 2);

      expect(compact).not.toBe(full);
      expect(compact.presentationEnvelopeVersion).toBe(2);
      expect(compact).not.toHaveProperty('playbackEvents');
      expect((compact.presentationFrames as any[])[0]).toBe(full.presentationFrames[0]);
      expect((compact.presentationFrames as any[])[0].snapshotAfter).toBe(full.presentationFrames[0].snapshotAfter);
      expect((compact.presentationFrames as any[])[1]).not.toBe(full.presentationFrames[1]);
      expect((compact.presentationFrames as any[])[1]).not.toHaveProperty('snapshotAfter');
      expect((compact.presentationFrames as any[])[1].snapshotAfterRef).toEqual({
        kind: 'envelope-snapshot',
        stateVersion: 12,
        projectedSnapshotHash: `hash-${projection}-12`
      });
      expect(JSON.stringify(full)).toBe(originalJson);

      const resolved = resolveNetworkPresentationEnvelope(compact);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error(resolved.reason);
      expect(resolved.resolvedReferenceCount).toBe(1);
      expect((resolved.payload.presentationFrames as any[])[1].snapshotAfter).toBe(full.snapshot);
      expect((resolved.payload.presentationFrames as any[])[1].playbackDigest).toBe(
        full.presentationFrames[1].playbackDigest
      );
      expect((resolved.payload.presentationFrames as any[])[0].snapshotAfter).toEqual(
        full.presentationFrames[0].snapshotAfter
      );
    }
  );

  test('keeps mismatched version, hash, room, and projection snapshots self-contained', () => {
    const mutations = [
      (payload: any) => { payload.presentationFrames[1].stateVersionTo = 13; },
      (payload: any) => { payload.presentationFrames[1].projectedSnapshotHash = 'other-hash'; },
      (payload: any) => { payload.presentationFrames[1].roomId = 'OTHER-ROOM'; },
      (payload: any) => { payload.presentationFrames[1].snapshotAfter._meta.projectedForSeat = 'white'; }
    ];
    for (const mutate of mutations) {
      const full = fullEnvelope();
      mutate(full);
      const compact = compactNetworkPresentationEnvelope(full, 2);
      expect((compact.presentationFrames as any[])[1]).toHaveProperty('snapshotAfter');
      expect((compact.presentationFrames as any[])[1]).not.toHaveProperty('snapshotAfterRef');
    }
  });

  test('exposes the exact compatibility predicate used by compact and resolve', () => {
    const full = fullEnvelope();
    expect(isFrameSnapshotReferenceCompatible(full, full.presentationFrames[1], full.presentationFrames[1].snapshotAfter)).toBe(true);
    expect(isFrameSnapshotReferenceCompatible(full, full.presentationFrames[0], full.presentationFrames[0].snapshotAfter)).toBe(false);
  });

  test('rejects unsupported versions, references without V2, ambiguous snapshots, and tampered references', () => {
    const compact = compactNetworkPresentationEnvelope(fullEnvelope(), 2) as any;
    const referencedFrame = compact.presentationFrames[1];

    expect(resolveNetworkPresentationEnvelope({ ...compact, presentationEnvelopeVersion: 99 })).toEqual({
      ok: false,
      reason: 'presentation_envelope_version_unsupported',
      frameIndex: null
    });
    const { presentationEnvelopeVersion: _version, ...withoutVersion } = compact;
    expect(resolveNetworkPresentationEnvelope(withoutVersion)).toEqual({
      ok: false,
      reason: 'presentation_envelope_reference_requires_v2',
      frameIndex: null
    });
    expect(resolveNetworkPresentationEnvelope({
      ...compact,
      presentationFrames: [
        compact.presentationFrames[0],
        { ...referencedFrame, snapshotAfter: compact.snapshot }
      ]
    })).toEqual({
      ok: false,
      reason: 'presentation_envelope_frame_snapshot_ambiguous',
      frameIndex: 1
    });
    expect(resolveNetworkPresentationEnvelope({
      ...compact,
      presentationFrames: [
        compact.presentationFrames[0],
        {
          ...referencedFrame,
          snapshotAfterRef: { ...referencedFrame.snapshotAfterRef, projectedSnapshotHash: 'tampered' }
        }
      ]
    })).toEqual({
      ok: false,
      reason: 'presentation_envelope_reference_mismatch',
      frameIndex: 1
    });
  });

  test('rejects duplicated top-level playback in V2 and accepts untouched legacy full envelopes', () => {
    const full = fullEnvelope();
    expect(resolveNetworkPresentationEnvelope(full)).toEqual({
      ok: true,
      payload: full,
      resolvedReferenceCount: 0
    });
    const compact = compactNetworkPresentationEnvelope(full, 2);
    expect(resolveNetworkPresentationEnvelope({
      ...compact,
      playbackEvents: full.playbackEvents
    })).toEqual({
      ok: false,
      reason: 'presentation_envelope_v2_duplicate_playback',
      frameIndex: null
    });
  });

  test('reduces a representative multi-target presentation envelope by at least 30 percent', () => {
    const full = fullEnvelope();
    const compact = compactNetworkPresentationEnvelope(full, 2);
    const legacyBytes = Buffer.byteLength(JSON.stringify(full));
    const compactBytes = Buffer.byteLength(JSON.stringify(compact));

    expect(compactBytes).toBeLessThan(legacyBytes * 0.7);
  });
});

