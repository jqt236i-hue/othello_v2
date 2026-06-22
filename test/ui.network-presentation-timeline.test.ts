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
        return { started: true, method: 'test' };
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

  test('notifies after a frame is committed so the board can refresh from visual state', async () => {
    const order: string[] = [];
    const onFrameCommitted = jest.fn((playedFrame: any, meta: any) => {
      order.push(`commit:${playedFrame.visualSeq}:${meta.visualVersion}`);
    });
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      onFrameCommitted
    });

    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    const drained = await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => {
        order.push('playback');
        return { started: true, method: 'test' };
      })
    });

    expect(drained).toBe(1);
    expect(order).toEqual(['playback', 'commit:1:2']);
    expect(onFrameCommitted).toHaveBeenCalledWith(
      expect.objectContaining({ visualSeq: 1, stateVersionTo: 2 }),
      expect.objectContaining({
        source: 'stream',
        visualSeq: 1,
        visualVersion: 2
      })
    );
  });

  test('marks visualSeq completed after a frame commit', async () => {
    const visualSettlementTracker = {
      markVisualSeqCompleted: jest.fn()
    };
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      visualSettlementTracker
    });

    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    await expect(timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => ({ started: true, method: 'test' }))
    })).resolves.toBe(1);

    expect(visualSettlementTracker.markVisualSeqCompleted).toHaveBeenCalledWith(1, expect.objectContaining({
      visualVersion: 2,
      source: 'stream'
    }));
  });

  test('waits for frame commit refresh before reporting the frame drained', async () => {
    const order: string[] = [];
    let releaseCommit: (() => void) | null = null;
    const commitRefresh = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      onFrameCommitted: jest.fn(async () => {
        order.push('commit-start');
        await commitRefresh;
        order.push('commit-finished');
      })
    });

    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    let resolved = false;
    const drainPromise = timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => {
        order.push('playback');
        return { started: true, method: 'test' };
      })
    }).then((drained: number) => {
      resolved = true;
      return drained;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(resolved).toBe(false);
    expect(order).toEqual(['playback', 'commit-start']);
    expect(timeline.getDiagnostics()).toMatchObject({
      playing: true,
      visualSeq: 1,
      visualVersion: 2
    });

    releaseCommit && releaseCommit();

    await expect(drainPromise).resolves.toBe(1);
    expect(order).toEqual(['playback', 'commit-start', 'commit-finished']);
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
        return { started: true, method: 'test' };
      })
    })).toBe(0);

    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'test' });
    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
        return { started: true, method: 'test' };
      })
    })).toBe(2);
    expect(played).toEqual(['event_1', 'event_2']);
  });

  test('can align to the first received frame when an authoritative snapshot already skipped earlier visuals', async () => {
    const played: string[] = [];
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });

    timeline.enqueueFrames([frame(2, 2, 3)], {
      source: 'stream',
      allowBaseCursorAdvance: true
    });

    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
        return { started: true, method: 'test' };
      })
    })).toBe(1);

    expect(played).toEqual(['event_2']);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 3,
      pendingFrameCount: 0,
      paused: false
    });
  });

  test('can align an unplayed visual version back to the incoming frame base', async () => {
    const played: string[] = [];
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 2
    });

    timeline.enqueueFrames([frame(1, 1, 2)], {
      source: 'stream',
      allowBaseCursorAdvance: true
    });

    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
        return { started: true, method: 'test' };
      })
    })).toBe(1);

    expect(played).toEqual(['event_1']);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 2,
      pendingFrameCount: 0,
      paused: false
    });
  });

  test('journal recovery can align base cursor when a later stream frame is already pending', async () => {
    const played: string[] = [];
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });

    timeline.enqueueFrames([frame(2, 1, 2, 'stream_2')], {
      source: 'stream',
      allowBaseCursorAdvance: false
    });
    timeline.enqueueFrames([
      frame(1, 0, 1, 'journal_1'),
      frame(2, 1, 2, 'journal_2')
    ], {
      source: 'journal_recovery',
      allowBaseCursorAdvance: true
    });

    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
        return { started: true, method: 'test' };
      })
    })).toBe(2);

    expect(played).toEqual(['journal_1', 'stream_2']);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 2,
      pendingFrameCount: 0,
      paused: false
    });
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
        return { started: true, method: 'test' };
      })
    });

    expect(played).toEqual(['first']);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 2,
      pendingFrameCount: 0
    });
  });

  test('state sync catch-up plays journal gap and skips duplicated direct frame once', async () => {
    const played: string[] = [];
    const committed: number[] = [];
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 1,
      initialVisualVersion: 2,
      visualStateStore: {
        commitFrame: jest.fn((playedFrame: any) => committed.push(playedFrame.visualSeq))
      }
    });

    expect(timeline.enqueueFrames([frame(3, 3, 4, 'direct_3')], {
      source: 'state_sync',
      allowBaseCursorAdvance: false
    })).toBe(1);

    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
        return { started: true, method: 'test' };
      })
    })).toBe(0);

    expect(timeline.enqueueFrames([
      frame(2, 2, 3, 'journal_2'),
      frame(3, 3, 4, 'journal_duplicate_3')
    ], {
      source: 'state_sync',
      allowBaseCursorAdvance: false
    })).toBe(1);

    expect(await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async (events: any[]) => {
        played.push(events[0].type);
        return { started: true, method: 'test' };
      })
    })).toBe(2);

    expect(played).toEqual(['journal_2', 'direct_3']);
    expect(committed).toEqual([2, 3]);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 3,
      visualVersion: 4,
      pendingFrameCount: 0,
      paused: false
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

  test('pauses instead of committing when dispatcher is unavailable', async () => {
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'test' });

    await expect(timeline.drainPlayableFrames(null)).resolves.toBe(0);

    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 0,
      visualVersion: 1,
      pendingFrameCount: 1,
      paused: true,
      pausedError: {
        visualSeq: 1,
        message: 'network_playback_dispatcher_unavailable'
      }
    });
  });

  test('pauses instead of committing when dispatcher cannot start playback', async () => {
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'test' });

    await expect(timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => ({ started: false, method: 'unavailable' }))
    })).resolves.toBe(0);

    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 0,
      visualVersion: 1,
      pendingFrameCount: 1,
      paused: true,
      pausedError: {
        visualSeq: 1,
        message: 'network_playback_dispatch_failed:unavailable'
      }
    });
  });
});
