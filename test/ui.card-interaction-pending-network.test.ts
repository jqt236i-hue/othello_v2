async function flushPromises() {
  // Pending-publish settlement intentionally crosses several microtask
  // boundaries so an integrity latch queued beside an authority response can
  // win before UI callbacks. Drain the complete local chain in tests.
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

describe('PlaybackStateManager visual playback drain', () => {
  let playbackStateManager: any;

  beforeEach(() => {
    jest.resetModules();
    playbackStateManager = require('../ui/playback-state-manager.js');
    playbackStateManager.abortPlayback();
    playbackStateManager.clearPlaybackLock();
    delete (global as any).cardState;
  });

  afterEach(() => {
    jest.useRealTimers();
    try {
      playbackStateManager.abortPlayback();
      playbackStateManager.clearPlaybackLock();
    } catch (e) {
      // ignore
    }
    delete (global as any).cardState;
    delete (global as any).__pendingSelectionPublishSettleTimeoutMs;
  });

  test('ignores selection settlement locks when no visual playback remains', async () => {
    const token = playbackStateManager.acquireSelectionSettlementLock({ source: 'unit_test' });

    await expect(playbackStateManager.waitForVisualPlaybackDrain({
      cardState: {},
      timeoutMs: 50
    })).resolves.toBeUndefined();

    expect(playbackStateManager.hasSelectionSettlementLock()).toBe(true);
    expect(playbackStateManager.releaseSelectionSettlementLock(token)).toBe(true);
  });

  test('waits for VisualPlaybackActive and queued playback to drain', async () => {
    jest.useFakeTimers();
    (global as any).cardState = {
      presentationEvents: [{ type: 'PLAYBACK_EVENTS' }],
      _presentationEventsPersist: []
    };
    playbackStateManager.setPlaybackActive(true);
    let resolved = false;

    const drainPromise = playbackStateManager.waitForVisualPlaybackDrain({
      getCardState: () => (global as any).cardState,
      timeoutMs: 100
    }).then(() => {
      resolved = true;
    });
    await flushPromises();

    expect(resolved).toBe(false);

    playbackStateManager.setPlaybackActive(false);
    (global as any).cardState.presentationEvents = [];
    jest.advanceTimersByTime(16);
    await drainPromise;

    expect(resolved).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('waits for visual playback claims to release before authoritative settlement', async () => {
    jest.useFakeTimers();
    const claim = playbackStateManager.claimVisualPlayback({
      source: 'unit_test',
      scope: 'presentation_drain',
      eventTypes: ['destroy']
    });
    let resolved = false;

    const drainPromise = playbackStateManager.waitForVisualPlaybackDrain({
      cardState: {
        presentationEvents: [],
        _presentationEventsPersist: []
      },
      timeoutMs: 100
    }).then(() => {
      resolved = true;
    });
    await flushPromises();
    jest.advanceTimersByTime(16);
    await flushPromises();

    expect(resolved).toBe(false);

    expect(playbackStateManager.releaseVisualPlaybackClaim(claim)).toBe(true);
    jest.advanceTimersByTime(16);
    await drainPromise;

    expect(resolved).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('clears pending timers when drain resolves by timeout', async () => {
    jest.useFakeTimers();
    playbackStateManager.setPlaybackActive(true);

    const drainPromise = playbackStateManager.waitForVisualPlaybackDrain({
      cardState: {},
      timeoutMs: 20
    });

    jest.advanceTimersByTime(20);
    await drainPromise;

    expect(jest.getTimerCount()).toBe(0);
    playbackStateManager.setPlaybackActive(false);
  });
});

describe('card interaction pending network settlement', () => {
  let pendingNetwork: any;
  let deps: any;
  let publishLocks: Record<string, boolean>;
  let resolvePublish: ((value: any) => void) | null;
  let resolveDrain: (() => void) | null;
  let publishPromise: Promise<any>;
  let drainPromise: Promise<void>;

  beforeEach(() => {
    jest.resetModules();
    pendingNetwork = require('../cards/card-interaction-pending-network.js');
    resolvePublish = null;
    resolveDrain = null;
    publishPromise = new Promise((resolve) => {
      resolvePublish = resolve;
    });
    drainPromise = new Promise((resolve) => {
      resolveDrain = resolve;
    });
    publishLocks = { black: false, white: false };
    (global as any).cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      presentationEvents: [{ type: 'PLAYBACK_EVENTS' }],
      _presentationEventsPersist: []
    };
    (global as any).NetworkMatchClient = {
      isActive: jest.fn(() => true),
      publishSnapshot: jest.fn(() => publishPromise)
    };
    deps = {
      getUiRootRef: () => global,
      getCardStateValue: () => (global as any).cardState,
      readDirectWaitForPlaybackIdle: () => null,
      isCardAnimatingNow: jest.fn(() => false),
      isStaleVisualPlaybackLock: jest.fn(() => false),
      releaseStaleVisualPlaybackLock: jest.fn(),
      renderCardUiSafely: jest.fn(),
      playbackStateManager: {
        waitForVisualPlaybackDrain: jest.fn(() => drainPromise)
      },
      setPendingSelectionBusy: jest.fn(),
      normalizeOwnerKey: (ownerKey: any) => String(ownerKey || '') === 'white' ? 'white' : 'black',
      isCardRuntimeIntegrityBlocked: jest.fn(() => false),
      syncPendingSelectionActionCache: jest.fn(),
      publishLocks
    };
  });

  afterEach(() => {
    delete (global as any).NetworkMatchClient;
    delete (global as any).cardState;
  });

  test('keeps publish and busy locks until authoritative playback drain finishes', async () => {
    const onSuccess = jest.fn();
    const onFailure = jest.fn();

    const started = pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 },
      onSuccess,
      onFailure
    }, deps);

    expect(started).toBe(true);
    await flushPromises();
    expect(publishLocks.black).toBe(true);
    expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);

    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).toHaveBeenCalledWith({
      getCardState: deps.getCardStateValue,
      disableTimeout: true
    });
    expect(deps.setPendingSelectionBusy).not.toHaveBeenCalledWith(false);
    expect(publishLocks.black).toBe(true);

    const secondStarted = pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 }
    }, deps);

    expect(secondStarted).toBe(true);
    expect((global as any).NetworkMatchClient.publishSnapshot).toHaveBeenCalledTimes(1);

    resolveDrain && resolveDrain();
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(deps.renderCardUiSafely).toHaveBeenCalledTimes(1);
    expect((global as any).cardState.presentationEvents).toEqual([{ type: 'PLAYBACK_EVENTS' }]);
  });

  test('syncs a stale overlay action only after accepted authoritative playback settles', async () => {
    const pendingCoordinator = require('../game/turn/pending-coordinator.js');
    pendingCoordinator.storePendingSelectionAction(
      'black',
      { type: 'place', player: 'black', condemnTargetIndex: 0, turnIndex: 3 },
      'CONDEMN_WILL'
    );
    deps.syncPendingSelectionActionCache = jest.fn((state: any) => (
      pendingCoordinator.syncPendingSelectionActionCache(state)
    ));
    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 }
    }, deps);
    await flushPromises();

    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).not.toHaveBeenCalled();
    expect(pendingCoordinator.readPendingSelectionAction('black')).not.toBeNull();

    resolveDrain && resolveDrain();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).toHaveBeenCalledWith((global as any).cardState);
    expect(pendingCoordinator.readPendingSelectionAction('black')).toBeNull();
  });

  test('retains the overlay action when authority still exposes the same pending type', async () => {
    const pendingCoordinator = require('../game/turn/pending-coordinator.js');
    pendingCoordinator.storePendingSelectionAction(
      'black',
      { type: 'place', player: 'black', observerWillTargetIndex: 0, turnIndex: 3 },
      'OBSERVER_WILL'
    );
    deps.syncPendingSelectionActionCache = jest.fn((state: any) => (
      pendingCoordinator.syncPendingSelectionActionCache(state)
    ));
    (global as any).cardState.turnIndex = 3;
    (global as any).cardState.pendingEffectByPlayer.black = {
      type: 'OBSERVER_WILL',
      stage: 'selectTarget'
    };

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', observerWillTargetIndex: 0 }
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();
    resolveDrain && resolveDrain();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).toHaveBeenCalledTimes(1);
    expect(pendingCoordinator.readPendingSelectionAction('black')).toMatchObject({
      observerWillTargetIndex: 0,
      turnIndex: 3
    });
  });

  test('does not sync the overlay cache when integrity latches before settlement', async () => {
    let blocked = false;
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' }
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();
    blocked = true;
    resolveDrain && resolveDrain();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).not.toHaveBeenCalled();
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(publishLocks.black).toBe(false);
  });

  test('does not sync or render when integrity latches immediately behind accepted visual settlement', async () => {
    let blocked = false;
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 }
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();

    resolveDrain && resolveDrain();
    queueMicrotask(() => {
      blocked = true;
    });
    await flushPromises();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).not.toHaveBeenCalled();
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(publishLocks.black).toBe(false);
  });

  test('suppresses success rendering when cache synchronization queues an integrity latch', async () => {
    let blocked = false;
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);
    deps.syncPendingSelectionActionCache = jest.fn(() => {
      queueMicrotask(() => {
        blocked = true;
      });
    });

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 }
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();
    resolveDrain && resolveDrain();
    await flushPromises();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).toHaveBeenCalledTimes(1);
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(publishLocks.black).toBe(false);
  });

  test.each([
    ['HEAVEN_BLESSING', { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' }],
    ['CONDEMN_WILL', { type: 'place', player: 'black', condemnTargetIndex: 0 }],
    ['OBSERVER_WILL', { type: 'place', player: 'black', observerWillTargetIndex: 0 }]
  ])('blocks %s direct pending publish after the runtime integrity latch', async (_pendingType, action) => {
    deps.isCardRuntimeIntegrityBlocked.mockReturnValue(true);
    const onSuccess = jest.fn();
    const onFailure = jest.fn();

    expect(pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action,
      onSuccess,
      onFailure
    }, deps)).toBe(false);
    await flushPromises();

    expect((global as any).NetworkMatchClient.publishSnapshot).not.toHaveBeenCalled();
    expect(publishLocks.black).toBe(false);
    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).not.toHaveBeenCalled();
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  test('drains an accepted publish but suppresses callbacks and rendering when integrity latches during the request', async () => {
    let blocked = false;
    const onSuccess = jest.fn();
    const onFailure = jest.fn();
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);

    expect(pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 },
      onSuccess,
      onFailure
    }, deps)).toBe(true);
    await flushPromises();

    resolvePublish && resolvePublish({
      ok: true,
      presentationCursor: { visualSeq: 31, stateVersion: 44 }
    });
    blocked = true;
    await flushPromises();

    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).toHaveBeenCalledTimes(1);
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(publishLocks.black).toBe(true);

    resolveDrain && resolveDrain();
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  test('releases both locks without callbacks when an accepted visual drain rejects after the integrity latch', async () => {
    let blocked = false;
    const onSuccess = jest.fn();
    const onFailure = jest.fn();
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);
    deps.playbackStateManager.waitForVisualPlaybackDrain = jest.fn(() => Promise.reject(new Error('drain failed')));

    expect(pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', observerWillTargetIndex: 0 },
      onSuccess,
      onFailure
    }, deps)).toBe(true);
    await flushPromises();

    resolvePublish && resolvePublish({ ok: true, presentationCursor: { visualSeq: 32 } });
    blocked = true;
    await flushPromises();
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  test('releases busy when a latch is queued immediately behind accepted visual drain rejection', async () => {
    let blocked = false;
    let rejectDrain = null;
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);
    deps.playbackStateManager.waitForVisualPlaybackDrain = jest.fn(() => new Promise((_resolve, reject) => {
      rejectDrain = reject;
    }));
    const onSuccess = jest.fn();
    const onFailure = jest.fn();

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', observerWillTargetIndex: 0 },
      onSuccess,
      onFailure
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();
    expect(rejectDrain).toEqual(expect.any(Function));

    rejectDrain(new Error('visual settlement reset'));
    queueMicrotask(() => {
      blocked = true;
    });
    await flushPromises();
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(deps.syncPendingSelectionActionCache).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  test('treats RUNTIME_UNAVAILABLE as integrity settlement without ordinary failure callbacks', async () => {
    const onSuccess = jest.fn();
    const onFailure = jest.fn();

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 },
      onSuccess,
      onFailure
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: false, reason: 'RUNTIME_UNAVAILABLE' });
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).not.toHaveBeenCalled();
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
  });

  test('waits for publish visualSeq settlement instead of forced queue cleanup', async () => {
    let resolveVisualSettlement: ((value: any) => void) | null = null;
    const visualSettlementPromise = new Promise((resolve) => {
      resolveVisualSettlement = resolve;
    });
    deps.playbackStateManager = {
      waitForNetworkVisualSeq: jest.fn(() => visualSettlementPromise),
      waitForVisualPlaybackDrain: jest.fn()
    };

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 }
    }, deps);

    await flushPromises();
    resolvePublish && resolvePublish({
      ok: true,
      presentationCursor: { visualSeq: 7, stateVersion: 12 }
    });
    await flushPromises();

    expect(deps.playbackStateManager.waitForNetworkVisualSeq).toHaveBeenCalledWith(7, {
      operationId: null
    });
    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).not.toHaveBeenCalled();
    expect(publishLocks.black).toBe(true);
    expect(deps.setPendingSelectionBusy).not.toHaveBeenCalledWith(false);

    resolveVisualSettlement && resolveVisualSettlement({ ok: true, visualSeq: 7 });
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect((global as any).cardState.presentationEvents).toEqual([{ type: 'PLAYBACK_EVENTS' }]);
  });

  test('keeps pending busy until the exact authoritative visualSeq settles', async () => {
    const { createVisualSettlementTracker } = require('../ui/network/visual-settlement');
    const tracker = createVisualSettlementTracker();
    deps.playbackStateManager = {
      waitForNetworkVisualSeq: jest.fn((visualSeq: any, options: any) => tracker.waitForVisualSeq(visualSeq, options)),
      waitForVisualPlaybackDrain: jest.fn()
    };

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 }
    }, deps);

    await flushPromises();
    resolvePublish && resolvePublish({
      ok: true,
      operationId: 'op_pending_12',
      presentationCursor: { visualSeq: 12, stateVersion: 20 }
    });
    await flushPromises();

    expect(deps.playbackStateManager.waitForNetworkVisualSeq).toHaveBeenCalledWith(12, {
      operationId: 'op_pending_12'
    });
    expect(publishLocks.black).toBe(true);
    expect(deps.setPendingSelectionBusy).not.toHaveBeenCalledWith(false);

    tracker.markVisualSeqCompleted(11);
    await flushPromises();

    expect(publishLocks.black).toBe(true);
    expect(deps.setPendingSelectionBusy).not.toHaveBeenCalledWith(false);
    expect((global as any).cardState.presentationEvents).toEqual([{ type: 'PLAYBACK_EVENTS' }]);

    tracker.markVisualSeqCompleted(12);
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).not.toHaveBeenCalled();
    expect((global as any).cardState.presentationEvents).toEqual([{ type: 'PLAYBACK_EVENTS' }]);
  });

  test('does not unlock or render when exact authoritative settlement fails', async () => {
    deps.playbackStateManager = {
      waitForNetworkVisualSeq: jest.fn(async () => ({
        ok: false,
        visualSeq: 14,
        reason: 'reset'
      })),
      waitForVisualPlaybackDrain: jest.fn(),
      setPlaybackActive: jest.fn(),
      setPlaybackStartedAt: jest.fn()
    };

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 }
    }, deps);

    await flushPromises();
    resolvePublish && resolvePublish({
      ok: true,
      operationId: 'op_pending_reset',
      presentationCursor: { visualSeq: 14, stateVersion: 22 }
    });
    await flushPromises();
    await flushPromises();

    expect(deps.playbackStateManager.waitForNetworkVisualSeq).toHaveBeenCalledWith(14, {
      operationId: 'op_pending_reset'
    });
    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).not.toHaveBeenCalledWith(false);
    expect(deps.renderCardUiSafely).not.toHaveBeenCalled();
    expect(deps.playbackStateManager.setPlaybackActive).not.toHaveBeenCalled();
    expect(deps.playbackStateManager.setPlaybackStartedAt).not.toHaveBeenCalled();
    expect((global as any).cardState.presentationEvents).toEqual([{ type: 'PLAYBACK_EVENTS' }]);
  });

  test('successful publish settles only after authoritative playback drain', async () => {
    const order: string[] = [];
    deps.playbackStateManager = {
      waitForVisualPlaybackDrain: jest.fn(() => Promise.resolve().then(() => {
        order.push('drain');
      })),
      setPlaybackActive: jest.fn(() => {
        order.push('clear-active');
      }),
      setPlaybackStartedAt: jest.fn(() => {
        order.push('clear-started');
      })
    };
    deps.setPendingSelectionBusy = jest.fn((next: boolean) => {
      order.push(`busy:${next}`);
    });
    deps.renderCardUiSafely = jest.fn(() => {
      order.push('render');
    });

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', condemnTargetIndex: 0 },
      onSuccess: () => {
        order.push('success');
      }
    }, deps);

    await flushPromises();
    resolvePublish && resolvePublish({ ok: true });
    await flushPromises();
    await flushPromises();

    expect(order).toEqual(['success', 'drain', 'busy:false', 'render']);
  });

  test('visual drain helper prefers playback manager over direct idle wait', async () => {
    const directWait = jest.fn(() => Promise.resolve());
    deps.readDirectWaitForPlaybackIdle = () => directWait;

    const waitFn = pendingNetwork.getVisualPlaybackDrainFn(deps);
    expect(typeof waitFn).toBe('function');

    const waitPromise = waitFn();

    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).toHaveBeenCalledWith({
      root: global,
      getCardState: deps.getCardStateValue,
      disableTimeout: true
    });
    expect(directWait).not.toHaveBeenCalled();

    resolveDrain && resolveDrain();
    await waitPromise;
  });

  test('releases busy and publish locks on publish failure', async () => {
    const onFailure = jest.fn();

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' },
      onFailure
    }, deps);

    await flushPromises();
    resolvePublish && resolvePublish({ ok: false, reason: 'OUT_OF_TURN' });
    await flushPromises();

    expect(publishLocks.black).toBe(false);
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(onFailure).toHaveBeenCalledWith({ ok: false, reason: 'OUT_OF_TURN' });
    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).not.toHaveBeenCalled();
  });

  test('ordinary authority rejection synchronizes and clears a stale overlay action before failure UI', async () => {
    const pendingCoordinator = require('../game/turn/pending-coordinator.js');
    pendingCoordinator.storePendingSelectionAction(
      'black',
      { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1', turnIndex: 4 },
      'HEAVEN_BLESSING'
    );
    deps.syncPendingSelectionActionCache = jest.fn((state: any) => (
      pendingCoordinator.syncPendingSelectionActionCache(state)
    ));
    const onFailure = jest.fn(() => {
      expect(pendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    });

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' },
      onFailure
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: false, reason: 'OUT_OF_TURN' });
    await flushPromises();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).toHaveBeenCalledWith((global as any).cardState);
    expect(pendingCoordinator.readPendingSelectionAction('black')).toBeNull();
    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  test('does not sync or report ordinary rejection when integrity latches immediately behind it', async () => {
    let blocked = false;
    const onFailure = jest.fn();
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' },
      onFailure
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: false, reason: 'OUT_OF_TURN' });
    queueMicrotask(() => {
      blocked = true;
    });
    await flushPromises();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).not.toHaveBeenCalled();
    expect(onFailure).not.toHaveBeenCalled();
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(publishLocks.black).toBe(false);
  });

  test('suppresses rejection UI when cache synchronization queues an integrity latch', async () => {
    let blocked = false;
    const onFailure = jest.fn();
    deps.isCardRuntimeIntegrityBlocked = jest.fn(() => blocked);
    deps.syncPendingSelectionActionCache = jest.fn(() => {
      queueMicrotask(() => {
        blocked = true;
      });
    });

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' },
      onFailure
    }, deps);
    await flushPromises();
    resolvePublish && resolvePublish({ ok: false, reason: 'OUT_OF_TURN' });
    await flushPromises();
    await flushPromises();

    expect(deps.syncPendingSelectionActionCache).toHaveBeenCalledTimes(1);
    expect(onFailure).not.toHaveBeenCalled();
    expect(deps.setPendingSelectionBusy).toHaveBeenCalledWith(false);
    expect(publishLocks.black).toBe(false);
  });

  test('publish failure clears lock and busy before onFailure callback completes', async () => {
    const order: string[] = [];
    deps.setPendingSelectionBusy = jest.fn((next: boolean) => {
      order.push(`busy:${next}`);
    });
    const onFailure = jest.fn(() => {
      order.push(`failure-lock:${publishLocks.black}`);
    });

    pendingNetwork.startNetworkOnlyPendingSelectionPublish({
      playerKey: 'black',
      action: { type: 'place', player: 'black', heavenBlessingCardId: 'offer_1' },
      onFailure
    }, deps);

    await flushPromises();
    expect(publishLocks.black).toBe(true);

    resolvePublish && resolvePublish({ ok: false, reason: 'OUT_OF_TURN' });
    await flushPromises();

    expect(order).toEqual(['busy:false', 'failure-lock:false']);
    expect(onFailure).toHaveBeenCalledWith({ ok: false, reason: 'OUT_OF_TURN' });
    expect(deps.playbackStateManager.waitForVisualPlaybackDrain).not.toHaveBeenCalled();
  });
});
