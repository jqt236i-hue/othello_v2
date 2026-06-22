import { createNetworkIntakeCoordinator } from '../ui/network/intake-coordinator';
import type { NetworkSnapshotEnvelope } from '../ui/network/intake-envelope';

function envelope(overrides: Partial<NetworkSnapshotEnvelope>): NetworkSnapshotEnvelope {
  return {
    source: 'stream',
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
    ...overrides
  };
}

describe('network intake coordinator', () => {
  test('dedupes same visualSeq from publish response and stream', () => {
    const applied: string[] = [];
    const enqueued: number[] = [];
    const traces: Array<{ type: string; details: any }> = [];
    const coordinator = createNetworkIntakeCoordinator({
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
      requestBoardRefresh: () => true,
      recordTrace: (type, details) => traces.push({ type, details })
    });

    const frame = { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, operationId: 'op_1' };
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
    expect(first).toMatchObject({ duplicateOperation: false });
    expect(second).toMatchObject({ duplicateOperation: true });
    expect(traces.map((entry) => entry.details)).toEqual([
      expect.objectContaining({
        source: 'publish_response',
        boardWriter: 'network_timeline',
        playbackActive: false,
        decision: 'accepted',
        accepted: true
      }),
      expect.objectContaining({
        source: 'stream',
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
      getAppliedStateVersion: () => 4,
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
});
