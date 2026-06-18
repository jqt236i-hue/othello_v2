const Timeline = require('../ui/network/presentation-timeline');

function frame(visualSeq: number, from: number, to: number, type?: string) {
  return {
    roomId: 'ABC',
    visualSeq,
    stateVersionFrom: from,
    stateVersionTo: to,
    operationId: `op_${visualSeq}`,
    actorSeatKey: 'black',
    actionType: 'place',
    playbackEvents: [{ type: type || `event_${visualSeq}` }],
    snapshotAfter: { stateVersion: to, gameState: { turn: to }, cardState: { hands: {} } },
    createdAt: 1000 + visualSeq
  };
}

describe('NetworkPresentationTimeline', () => {
  test('plays contiguous frames in visualSeq order and commits after playback', async () => {
    const played: string[] = [];
    const committed: number[] = [];
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      visualStateStore: {
        commitFrame: jest.fn((playedFrame: any) => committed.push(playedFrame.visualSeq))
      }
    });

    timeline.enqueueFrames([
      frame(2, 2, 3),
      frame(1, 1, 2)
    ], { source: 'test' });

    const drained = await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
      })
    });

    expect(drained).toBe(2);
    expect(played).toEqual(['event_1', 'event_2']);
    expect(committed).toEqual([1, 2]);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 3,
      pendingFrameCount: 0,
      paused: false
    });
  });

  test('waits for missing visualSeq before playing later frames', async () => {
    const played: string[] = [];
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });

    timeline.enqueueFrames([frame(2, 2, 3)], { source: 'test' });
    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
      })
    })).toBe(0);

    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'test' });
    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
      })
    })).toBe(2);
    expect(played).toEqual(['event_1', 'event_2']);
  });

  test('ignores duplicate visualSeq entries', async () => {
    const played: string[] = [];
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });

    timeline.enqueueFrames([
      frame(1, 1, 2, 'first'),
      frame(1, 1, 2, 'duplicate')
    ], { source: 'test' });

    await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
      })
    });

    expect(played).toEqual(['first']);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 2,
      pendingFrameCount: 0
    });
  });

  test('pauses diagnostics when strict playback dispatch fails', async () => {
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'test' });

    const drained = await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => {
        throw new Error('network_playback_watchdog');
      })
    });

    expect(drained).toBe(0);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 0,
      visualVersion: 1,
      pendingFrameCount: 1,
      paused: true,
      pausedError: {
        visualSeq: 1,
        message: 'network_playback_watchdog'
      }
    });
  });
});
