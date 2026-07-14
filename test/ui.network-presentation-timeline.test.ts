const TimelineModule = require('../ui/network/presentation-timeline');
const VisualStateStoreModule = require('../ui/network/visual-state-store');

function commitReceipt(playedFrame: any, meta?: any) {
  return Object.freeze({
    kind: 'network-visual-commit',
    visualSeq: playedFrame.visualSeq,
    visualVersion: playedFrame.stateVersionTo,
    source: meta && meta.source || 'test',
    snapshotOwnership: 'copy_on_commit'
  });
}

function settlementHandle(visualSeq: number, hooks?: any) {
  const callbacks = hooks || {};
  return Object.freeze({
    kind: 'strict-network-settlement',
    visualSeq,
    applyCommittedFrame: jest.fn(async (receipt: any) => {
      if (callbacks.applyCommittedFrame) return callbacks.applyCommittedFrame(receipt);
      return true;
    }),
    settle: jest.fn(async () => {
      if (callbacks.settle) return callbacks.settle();
      return true;
    }),
    cancel: jest.fn(async (reason: any) => {
      if (callbacks.cancel) return callbacks.cancel(reason);
      return true;
    })
  });
}

function trustedVisualStateStore(commitImpl: (playedFrame: any, meta: any) => any) {
  const trusted = new WeakSet<object>();
  return {
    commitFrame: jest.fn((playedFrame: any, meta: any) => {
      const raw = commitImpl(playedFrame, meta);
      const receipt = raw && raw.kind === 'network-visual-commit'
        ? raw
        : commitReceipt(playedFrame, meta);
      trusted.add(receipt);
      return receipt;
    }),
    isCurrentCommitReceipt: jest.fn((receipt: any) => !!receipt && trusted.has(receipt))
  };
}

function createTestTimeline(config?: any) {
  const cfg = { ...(config || {}) };
  if (cfg.visualStateStore && typeof cfg.visualStateStore.commitFrame === 'function') {
    const originalCommit = cfg.visualStateStore.commitFrame.bind(cfg.visualStateStore);
    cfg.visualStateStore = trustedVisualStateStore(originalCommit);
  } else {
    const store = VisualStateStoreModule.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot(
      { stateVersion: cfg.initialVisualVersion || 0 },
      { visualSeq: cfg.initialVisualSeq || 0, visualVersion: cfg.initialVisualVersion || 0 }
    );
    cfg.visualStateStore = store;
  }
  if (!cfg.visualSettlementTracker) {
    cfg.visualSettlementTracker = { markVisualSeqCompleted: jest.fn(() => true) };
  }
  const timeline = TimelineModule.createNetworkPresentationTimeline(cfg);
  const originalDrain = timeline.drainPlayableFrames.bind(timeline);
  timeline.drainPlayableFrames = (dispatcher: any) => {
    if (!dispatcher || typeof dispatcher.dispatchNetworkPlaybackEvents !== 'function') {
      return originalDrain(dispatcher);
    }
    return originalDrain({
      ...dispatcher,
      async dispatchNetworkPlaybackEvents(events: any[], options: any) {
        const result = await dispatcher.dispatchNetworkPlaybackEvents(events, options);
        if (result && result.started === true && !result.settlementHandle) {
          return { ...result, settlementHandle: settlementHandle(options.visualSeq) };
        }
        return result;
      }
    });
  };
  return timeline;
}

const Timeline = { createNetworkPresentationTimeline: createTestTimeline };

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
      markVisualSeqCompleted: jest.fn(() => true)
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

    for (let index = 0; index < 10 && !order.includes('commit-start'); index += 1) {
      await Promise.resolve();
    }

    expect(resolved).toBe(false);
    expect(order).toEqual(['playback', 'commit-start']);
    expect(timeline.getDiagnostics()).toMatchObject({
      playing: true,
      visualSeq: 0,
      visualVersion: 1,
      activeSettlementStage: 'observer'
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

  test('retries only committed-frame apply and preserves dispatch/commit/tracker/observer/settle order', async () => {
    const order: string[] = [];
    let applyAttempt = 0;
    const handle = settlementHandle(1, {
      applyCommittedFrame: async (receipt: any) => {
        applyAttempt += 1;
        order.push(`apply:${applyAttempt}:${receipt.visualSeq}`);
        if (applyAttempt === 1) throw new Error('context lost after commit');
        return true;
      },
      settle: async () => {
        order.push('settle');
        return true;
      }
    });
    const visualStateStore = trustedVisualStateStore((playedFrame: any, meta: any) => {
        order.push('commit');
        return commitReceipt(playedFrame, meta);
      });
    const dispatcher = {
      dispatchNetworkPlaybackEvents: jest.fn(async () => {
        order.push('dispatch');
        return { started: true, method: 'test', settlementHandle: handle };
      })
    };
    const timeline = TimelineModule.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      visualStateStore,
      visualSettlementTracker: {
        markVisualSeqCompleted: jest.fn(() => {
          order.push('tracker');
          return true;
        })
      },
      onFrameCommitted: jest.fn(() => order.push('observer'))
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    await expect(timeline.drainPlayableFrames(dispatcher)).resolves.toBe(0);
    expect(order).toEqual(['dispatch', 'commit', 'apply:1:1']);
    expect(timeline.getDiagnostics()).toMatchObject({
      visualSeq: 0,
      paused: true,
      activeSettlementStage: 'apply-committed-frame'
    });

    await expect(timeline.retryPausedSettlement(dispatcher)).resolves.toBe(1);
    expect(order).toEqual([
      'dispatch',
      'commit',
      'apply:1:1',
      'apply:2:1',
      'tracker',
      'observer',
      'settle'
    ]);
    expect(dispatcher.dispatchNetworkPlaybackEvents).toHaveBeenCalledTimes(1);
    expect(visualStateStore.commitFrame).toHaveBeenCalledTimes(1);
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

  test('does not redispatch an unsafe failed playback batch without a phase checkpoint', async () => {
    const dispatcher = {
      dispatchNetworkPlaybackEvents: jest.fn(async () => {
        throw new Error('board phase failed after side effects started');
      })
    };
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    await expect(timeline.drainPlayableFrames(dispatcher)).resolves.toBe(0);
    await expect(timeline.retryPausedSettlement(dispatcher))
      .rejects.toThrow('network_playback_dispatch_retry_requires_phase_checkpoint');
    expect(dispatcher.dispatchNetworkPlaybackEvents).toHaveBeenCalledTimes(1);
    expect(timeline.getDiagnostics()).toMatchObject({
      paused: true,
      activeSettlementStage: 'dispatch',
      blocksInput: true
    });
  });

  test('retries a dispatch only when failure happened before the presentation handler ran', async () => {
    let attempt = 0;
    const dispatcher = {
      dispatchNetworkPlaybackEvents: jest.fn(async (_events: any[], options: any) => {
        attempt += 1;
        if (attempt === 1) {
          const error: any = new Error('strict_network_board_visual_not_ready');
          error.safeDispatchRetry = true;
          throw error;
        }
        return {
          started: true,
          method: 'test',
          settlementHandle: settlementHandle(options.visualSeq)
        };
      })
    };
    const timeline = Timeline.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    await expect(timeline.drainPlayableFrames(dispatcher)).resolves.toBe(0);
    await expect(timeline.retryPausedSettlement(dispatcher)).resolves.toBe(1);
    expect(dispatcher.dispatchNetworkPlaybackEvents).toHaveBeenCalledTimes(2);
    expect(timeline.getDiagnostics()).toMatchObject({ paused: false, visualSeq: 1 });
  });

  test('keeps ownership paused when the visual settlement tracker rejects completion', async () => {
    const handle = settlementHandle(1);
    const timeline = TimelineModule.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      visualStateStore: VisualStateStoreModule.createNetworkVisualStateStore(),
      visualSettlementTracker: {
        markVisualSeqCompleted: jest.fn(() => false)
      }
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    await expect(timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => ({
        started: true,
        method: 'test',
        settlementHandle: handle
      }))
    })).resolves.toBe(0);

    expect(timeline.getDiagnostics()).toMatchObject({
      paused: true,
      activeSettlementStage: 'tracker',
      blocksInput: true,
      pausedError: { message: 'network_visual_settlement_tracker_rejected' }
    });
    expect(handle.settle).not.toHaveBeenCalled();
    expect(handle.cancel).not.toHaveBeenCalled();
  });

  test('disposes a handed-off paused settlement exactly once before clearing the timeline', async () => {
    const order: string[] = [];
    const handle = settlementHandle(1, {
      applyCommittedFrame: async () => {
        order.push('apply');
        throw new Error('context lost');
      },
      cancel: async (reason: any) => {
        order.push(`cancel:${reason}`);
        return true;
      }
    });
    const timeline = TimelineModule.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      visualStateStore: VisualStateStoreModule.createNetworkVisualStateStore(),
      visualSettlementTracker: { markVisualSeqCompleted: jest.fn(() => true) }
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });
    await timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => ({
        started: true,
        method: 'test',
        settlementHandle: handle
      }))
    });

    await expect(timeline.dispose('session-switch')).resolves.toBe(true);
    await expect(timeline.dispose('duplicate')).resolves.toBe(true);
    expect(order).toEqual(['apply', 'cancel:session-switch']);
    expect(handle.cancel).toHaveBeenCalledTimes(1);
    expect(timeline.getDiagnostics()).toMatchObject({
      disposed: true,
      pendingFrameCount: 0,
      blocksInput: false
    });
    expect(() => timeline.enqueueFrames([frame(2, 2, 3)])).toThrow('network_presentation_timeline_disposed');
  });

  test('dispose accepts a settlement that completes while disposal is waiting for the drain', async () => {
    let resolveSettle: ((value: boolean) => void) | null = null;
    let signalSettleStarted: (() => void) | null = null;
    const settleStarted = new Promise<void>((resolve) => { signalSettleStarted = resolve; });
    const handle = settlementHandle(1, {
      settle: () => {
        if (signalSettleStarted) signalSettleStarted();
        return new Promise<boolean>((resolve) => { resolveSettle = resolve; });
      }
    });
    const timeline = TimelineModule.createNetworkPresentationTimeline({
      initialVisualSeq: 0,
      initialVisualVersion: 1,
      visualStateStore: VisualStateStoreModule.createNetworkVisualStateStore(),
      visualSettlementTracker: { markVisualSeqCompleted: jest.fn(() => true) }
    });
    timeline.enqueueFrames([frame(1, 1, 2)], { source: 'stream' });

    const drainPromise = timeline.drainPlayableFrames({
      dispatchNetworkPlaybackEvents: jest.fn(async () => ({
        started: true,
        method: 'test',
        settlementHandle: handle
      }))
    });
    await settleStarted;
    const disposePromise = timeline.dispose('session-switch-during-settle');
    expect(timeline.getDiagnostics()).toMatchObject({ disposing: true, blocksInput: true });

    expect(resolveSettle).not.toBeNull();
    resolveSettle!(true);
    await expect(drainPromise).resolves.toBe(1);
    await expect(disposePromise).resolves.toBe(true);

    expect(handle.settle).toHaveBeenCalledTimes(1);
    expect(handle.cancel).not.toHaveBeenCalled();
    expect(timeline.getDiagnostics()).toMatchObject({
      disposed: true,
      pendingFrameCount: 0,
      blocksInput: false
    });
  });
});
