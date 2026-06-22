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
    const coordinator = createNetworkIntakeCoordinator({
      getAppliedStateVersion: () => null,
      applyCanonicalSnapshot: (_snapshot, meta) => {
        applied.push(meta.source);
        return true;
      },
      enqueuePresentationFrames: (frames) => {
        enqueued.push(...frames.map((frame: any) => frame.visualSeq));
        return frames.length;
      },
      requestBoardRefresh: () => true,
      recordTrace: () => undefined
    });

    const frame = { visualSeq: 3, stateVersionFrom: 2, stateVersionTo: 3, operationId: 'op_1' };
    coordinator.submit(envelope({
      source: 'publish_response',
      operationId: 'op_1',
      stateVersion: 3,
      visualSeq: 3,
      snapshot: { stateVersion: 3 },
      presentationFrames: [frame],
      force: true
    }));
    coordinator.submit(envelope({
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
  });

  test('requests board refresh for accepted snapshot without playback or presentation frames', () => {
    const boardRequests: any[] = [];
    const coordinator = createNetworkIntakeCoordinator({
      getAppliedStateVersion: () => 4,
      applyCanonicalSnapshot: () => true,
      enqueuePresentationFrames: jest.fn(),
      requestBoardRefresh: (meta) => {
        boardRequests.push(meta);
        return true;
      },
      recordTrace: jest.fn()
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
  });

  test('skips stale non-forced snapshots before applying canonical state', () => {
    const applyCanonicalSnapshot = jest.fn(() => true);
    const coordinator = createNetworkIntakeCoordinator({
      getAppliedStateVersion: () => 8,
      applyCanonicalSnapshot,
      enqueuePresentationFrames: jest.fn(),
      requestBoardRefresh: jest.fn(),
      recordTrace: jest.fn()
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
  });
});
