import { buildNetworkIntakeApplyOptions, createNetworkIntakeCoordinator } from '../ui/network/intake-coordinator';
import type { NetworkSnapshotEnvelope } from '../ui/network/intake-envelope';

function envelope(overrides: Partial<NetworkSnapshotEnvelope>): NetworkSnapshotEnvelope {
  return {
    source: 'stream',
    roomId: 'ABC',
    operationId: null,
    stateVersion: null,
    visualSeq: null,
    snapshot: null,
    presentationFrames: [],
    playbackEvents: [],
    presentationCursor: null,
    force: false,
    skipResultOverlay: false,
    receivedAt: 1,
    intakeError: null,
    presentationEnvelopeVersion: null,
    resolvedPresentationReferenceCount: 0,
    ...overrides
  };
}

describe('network intake coordinator', () => {
  test('builds snapshot apply options for presentation-frame intake', () => {
    expect(buildNetworkIntakeApplyOptions({
      source: 'stream',
      force: true,
      skipResultOverlay: true,
      playbackEvents: [{ type: 'ignored_when_frames_exist' }],
      presentationFrames: [{ visualSeq: 4 }],
      applyOptions: {
        playbackEvents: [{ type: 'old' }],
        shadowPlaybackEvents: [{ type: 'old_shadow' }],
        shadowPlaybackSource: 'legacy_shadow',
        presentationFrames: [{ visualSeq: 3 }],
        custom: 'kept'
      }
    })).toEqual({
      custom: 'kept',
      force: true,
      skipResultOverlay: true,
      playbackEvents: [],
      shadowPlaybackEvents: [],
      networkCanonicalIntake: true,
      presentationFrameSource: 'stream',
      deferResultUntilVisualSeq: 4,
      networkRoomId: null,
      networkOperationId: null,
      source: 'stream'
    });
  });

  test('dedupes same visualSeq from publish response and stream', () => {
    const applied: string[] = [];
    const enqueued: number[] = [];
    const boardRequests: any[] = [];
    const traces: Array<{ type: string; details: any }> = [];
    const coordinator = createNetworkIntakeCoordinator({
      getRoomId: () => 'ABC',
      getAppliedStateVersion: () => null,
      getPlaybackActive: () => false,
      applyCanonicalSnapshot: (_snapshot, meta) => {
        applied.push(meta.source);
        return true;
      },
      enqueuePresentationFrames: (frames) => {
        enqueued.push(...frames.map((frame: any) => frame.visualSeq));
        return frames.length;
      },
      requestBoardRefresh: (meta) => {
        boardRequests.push(meta);
        return true;
      },
      recordTrace: (type, details) => traces.push({ type, details })
    });

    const frame = {
      visualSeq: 3,
      stateVersionFrom: 2,
      stateVersionTo: 3,
      operationId: 'op_1',
      snapshotAfter: { stateVersion: 3 }
    };
    const first = coordinator.submit(envelope({
      source: 'publish_response',
      operationId: 'op_1',
      stateVersion: 3,
      visualSeq: 3,
      snapshot: { stateVersion: 3 },
      presentationFrames: [frame],
      force: true
    }));
    const second = coordinator.submit(envelope({
      source: 'stream',
      operationId: 'op_1',
      stateVersion: 3,
      visualSeq: 3,
      snapshot: { stateVersion: 3 },
      presentationFrames: [frame],
      receivedAt: 2
    }));

    expect(applied).toEqual(['publish_response']);
    expect(enqueued).toEqual([3]);
    expect(boardRequests).toEqual([]);
    expect(first).toMatchObject({ duplicateOperation: false });
    expect(second).toMatchObject({ duplicateOperation: true });
    expect(traces.map((entry) => entry.type)).toEqual([
      'network_intake_submit',
      'network_intake_submit'
    ]);
    expect(traces.map((entry) => entry.details)).toEqual([
      expect.objectContaining({
        source: 'publish_response',
        operationId: 'op_1',
        stateVersion: 3,
        visualSeq: 3,
        boardWriter: 'network_timeline',
        playbackActive: false,
        decision: 'accepted',
        accepted: true
      }),
      expect.objectContaining({
        source: 'stream',
        operationId: 'op_1',
        stateVersion: 3,
        visualSeq: 3,
        boardWriter: 'none',
        playbackActive: false,
        decision: 'deduped',
        accepted: false,
        skippedReason: 'duplicate_operation_state'
      })
    ]);
  });

  test('requests board refresh for accepted snapshot without playback or presentation frames', () => {
    const boardRequests: any[] = [];
    const recordTrace = jest.fn();
    const coordinator = createNetworkIntakeCoordinator({
      getRoomId: () => 'ABC',
      getAppliedStateVersion: () => 4,
      getVisualCursor: () => ({ visualSeq: 9, visualVersion: 5 }),
      getPlaybackActive: () => true,
      applyCanonicalSnapshot: () => true,
      enqueuePresentationFrames: jest.fn(),
      requestBoardRefresh: (meta) => {
        boardRequests.push(meta);
        return true;
      },
      recordTrace
    });

    const result = coordinator.submit(envelope({
      source: 'state_sync',
      stateVersion: 5,
      visualSeq: 9,
      snapshot: { stateVersion: 5 }
    }));

    expect(result).toMatchObject({
      appliedSnapshot: true,
      enqueuedFrameCount: 0,
      requestedBoardRefresh: true
    });
    expect(boardRequests).toEqual([
      expect.objectContaining({
        reason: 'snapshot_no_playback_visual_sync',
        source: 'state_sync',
        stateVersion: 5,
        visualSeq: 9
      })
    ]);
    expect(recordTrace).toHaveBeenCalledWith('network_intake_submit', expect.objectContaining({
      source: 'state_sync',
      boardWriter: 'render_scheduler',
      playbackActive: true,
      decision: 'refresh_requested',
      accepted: true
    }));
  });

  test('skips stale non-forced snapshots before applying canonical state', () => {
    const applyCanonicalSnapshot = jest.fn(() => true);
    const recordTrace = jest.fn();
    const coordinator = createNetworkIntakeCoordinator({
      getRoomId: () => 'ABC',
      getAppliedStateVersion: () => 8,
      applyCanonicalSnapshot,
      enqueuePresentationFrames: jest.fn(),
      requestBoardRefresh: jest.fn(),
      recordTrace
    });

    const result = coordinator.submit(envelope({
      source: 'stream',
      stateVersion: 7,
      snapshot: { stateVersion: 7 }
    }));

    expect(result).toMatchObject({
      appliedSnapshot: false,
      skippedReason: 'stale_state_version'
    });
    expect(applyCanonicalSnapshot).not.toHaveBeenCalled();
    expect(recordTrace).toHaveBeenCalledWith('network_intake_submit', expect.objectContaining({
      source: 'stream',
      boardWriter: 'none',
      playbackActive: null,
      decision: 'stale',
      accepted: false,
      skippedReason: 'stale_state_version'
    }));
  });

  test('resets visual and operation dedupe at a session boundary', () => {
    let roomId = 'AAA';
    const enqueued: number[] = [];
    const coordinator = createNetworkIntakeCoordinator({
      getRoomId: () => roomId,
      getAppliedStateVersion: () => null,
      applyCanonicalSnapshot: () => true,
      enqueuePresentationFrames: (frames) => {
        enqueued.push(...frames.map((frame: any) => frame.visualSeq));
        return frames.length;
      }
    });
    const firstFrame = {
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      snapshotAfter: { stateVersion: 2 }
    };

    coordinator.submit(envelope({
      roomId: 'AAA',
      operationId: 'op_1',
      stateVersion: 2,
      snapshot: { stateVersion: 2 },
      presentationFrames: [firstFrame]
    }));
    coordinator.reset();
    roomId = 'BBB';
    const second = coordinator.submit(envelope({
      roomId: 'BBB',
      operationId: 'op_1',
      stateVersion: 2,
      snapshot: { stateVersion: 2 },
      presentationFrames: [firstFrame]
    }));

    expect(second).toMatchObject({
      appliedSnapshot: true,
      enqueuedFrameCount: 1,
      duplicateOperation: false
    });
    expect(enqueued).toEqual([1, 1]);
  });

  test('rejects a delayed payload from another room before canonical apply', () => {
    const applyCanonicalSnapshot = jest.fn(() => true);
    const coordinator = createNetworkIntakeCoordinator({
      getRoomId: () => 'NEW',
      getAppliedStateVersion: () => 1,
      applyCanonicalSnapshot,
      enqueuePresentationFrames: jest.fn()
    });

    const result = coordinator.submit(envelope({
      roomId: 'OLD',
      stateVersion: 2,
      snapshot: { stateVersion: 2 }
    }));

    expect(result).toMatchObject({
      appliedSnapshot: false,
      skippedReason: 'room_mismatch'
    });
    expect(applyCanonicalSnapshot).not.toHaveBeenCalled();
  });

  test('rebases instead of dispatching malformed presentation frames', () => {
    const enqueuePresentationFrames = jest.fn();
    const recoverPresentationContinuity = jest.fn(() => true);
    const requestBoardRefresh = jest.fn(() => true);
    const coordinator = createNetworkIntakeCoordinator({
      getRoomId: () => 'ABC',
      getAppliedStateVersion: () => 2,
      getVisualCursor: () => ({ visualSeq: 1, visualVersion: 2 }),
      applyCanonicalSnapshot: () => true,
      enqueuePresentationFrames,
      recoverPresentationContinuity,
      requestBoardRefresh
    });

    const result = coordinator.submit(envelope({
      stateVersion: 3,
      visualSeq: 2,
      snapshot: { stateVersion: 3 },
      presentationCursor: { visualSeq: 2, stateVersion: 3 },
      playbackEvents: [{ type: 'legacy_direct_playback_must_not_run' }],
      presentationFrames: [{
        visualSeq: 2,
        stateVersionFrom: 2,
        stateVersionTo: 3
      }]
    }));

    expect(enqueuePresentationFrames).not.toHaveBeenCalled();
    expect(recoverPresentationContinuity).toHaveBeenCalledWith(
      expect.objectContaining({
        stateVersion: 3,
        visualSeq: 2
      }),
      expect.objectContaining({
        reason: 'presentation_frame_snapshot_required'
      })
    );
    expect(requestBoardRefresh).toHaveBeenCalled();
    expect(result).toMatchObject({
      appliedSnapshot: true,
      enqueuedFrameCount: 0,
      recoveredVisualContinuity: true,
      requestedBoardRefresh: true
    });
  });

  test('treats a zero-frame enqueue result as a continuity gap', () => {
    const recoverPresentationContinuity = jest.fn(() => true);
    const coordinator = createNetworkIntakeCoordinator({
      getRoomId: () => 'ABC',
      getAppliedStateVersion: () => 2,
      getVisualCursor: () => ({ visualSeq: 1, visualVersion: 2 }),
      applyCanonicalSnapshot: () => true,
      enqueuePresentationFrames: () => 0,
      recoverPresentationContinuity,
      requestBoardRefresh: () => true
    });
    const result = coordinator.submit(envelope({
      stateVersion: 3,
      visualSeq: 2,
      snapshot: { stateVersion: 3 },
      presentationCursor: { visualSeq: 2, stateVersion: 3 },
      presentationFrames: [{
        visualSeq: 2,
        stateVersionFrom: 2,
        stateVersionTo: 3,
        snapshotAfter: { stateVersion: 3 }
      }]
    }));

    expect(recoverPresentationContinuity).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ reason: 'presentation_frame_enqueue_partial' })
    );
    expect(result).toMatchObject({
      recoveredVisualContinuity: true,
      requestedBoardRefresh: true
    });
  });

  test('rejects a malformed V2 envelope before canonical apply and requests authoritative recovery', () => {
    const applyCanonicalSnapshot = jest.fn(() => true);
    const enqueuePresentationFrames = jest.fn(() => 1);
    const recoverPresentationContinuity = jest.fn(() => false);
    const requestBoardRefresh = jest.fn(() => true);
    const recordTrace = jest.fn();
    const coordinator = createNetworkIntakeCoordinator({
      applyCanonicalSnapshot,
      enqueuePresentationFrames,
      recoverPresentationContinuity,
      requestBoardRefresh,
      recordTrace
    });

    const result = coordinator.submit(envelope({
      stateVersion: 8,
      visualSeq: 6,
      intakeError: 'presentation_envelope_reference_mismatch'
    }));

    expect(applyCanonicalSnapshot).not.toHaveBeenCalled();
    expect(enqueuePresentationFrames).not.toHaveBeenCalled();
    expect(requestBoardRefresh).not.toHaveBeenCalled();
    expect(recoverPresentationContinuity).toHaveBeenCalledWith(
      expect.objectContaining({ intakeError: 'presentation_envelope_reference_mismatch' }),
      expect.objectContaining({ reason: 'presentation_envelope_reference_mismatch' })
    );
    expect(result).toMatchObject({
      appliedSnapshot: false,
      enqueuedFrameCount: 0,
      requestedBoardRefresh: false,
      skippedReason: 'presentation_envelope_reference_mismatch'
    });
    expect(recordTrace).toHaveBeenCalledWith('network_intake_submit', expect.objectContaining({
      decision: 'rejected',
      accepted: false,
      invalidFrameReason: 'presentation_envelope_reference_mismatch'
    }));
  });
});
