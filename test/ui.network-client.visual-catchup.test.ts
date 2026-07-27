jest.mock('../ui/board-renderer.ts', () => ({
  getBoardVisualControllerReady: jest.fn(async () => undefined)
}));

const Shared = require('../shared-constants');
const SharedBoardUtils = require('../shared/shared-board-utils');
const { createGameState } = require('./helpers/game-state-mock');

function createSnapshot(stateVersion: number, label: string) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      boardContractVersion: SharedBoardUtils.BOARD_CONTRACT_VERSION,
      projectedForSeat: 'black',
      turnStartReconciled: true
    },
    gameState: createGameState(Shared, {
      currentPlayer: stateVersion % 2 === 0 ? -1 : 1,
      snapshotLabel: label
    }),
    cardState: {
      hands: { black: [], white: [] },
      presentationEvents: [],
      _presentationEventsPersist: []
    }
  };
}

function flushAsyncWork() {
  return new Promise((resolve) => setImmediate(resolve));
}

let strictNetworkSettlementHandles: any[] = [];

function createStrictNetworkSettlementHandle(event: any) {
  const handle = Object.freeze({
    kind: 'strict-network-settlement',
    visualSeq: Number(event?.meta?.visualSeq),
    applyCommittedFrame: jest.fn(async () => true),
    settle: jest.fn(async () => true),
    cancel: jest.fn(async () => true)
  });
  strictNetworkSettlementHandles.push(handle);
  return handle;
}

describe('network client visual catch-up', () => {
  beforeEach(() => {
    jest.resetModules();
    strictNetworkSettlementHandles = [];
    (global as any).gameState = createSnapshot(1, 'old').gameState;
    (global as any).cardState = createSnapshot(1, 'old').cardState;
    (global as any).BoardOps = {
      emitPresentationEvent: jest.fn((cardStateRef: any, event: any) => {
        if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
        cardStateRef.presentationEvents.push(event);
      })
    };
    (global as any).emitBoardUpdate = jest.fn();
    (global as any).renderBoard = jest.fn();
    (global as any).emitCardStateChange = jest.fn();
    (global as any).emitGameStateChange = jest.fn();
  });

  afterEach(() => {
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).BoardOps;
    delete (global as any).emitBoardUpdate;
    delete (global as any).renderBoard;
    delete (global as any).RenderScheduler;
    delete (global as any).waitForPlaybackIdle;
    delete (global as any).emitCardStateChange;
    delete (global as any).emitGameStateChange;
    delete (global as any).PresentationHandler;
    delete (global as any).NetworkVisualSettlementTracker;
  });

  test('keeps render snapshot behind canonical snapshot until the visual frame commits', () => {
    const { createNetworkSnapshotController } = require('../ui/network/snapshot.js');
    const { createNetworkVisualStateStore } = require('../ui/network/visual-state-store');
    const visualStateStore = createNetworkVisualStateStore();
    const enqueuePresentationFrames = jest.fn(() => 1);
    const stateObj = {
      stateVersion: 1,
      appliedStateVersion: 1,
      lastVisualSeq: 0,
      lastVisualVersion: 1,
      authoritativeMatchState: {}
    };
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };
    const controller = createNetworkSnapshotController({
      getState: () => stateObj,
      visualStateStore,
      enqueuePresentationFrames,
      emitBoardUpdate: (global as any).emitBoardUpdate,
      emitCardStateChange: (global as any).emitCardStateChange,
      emitGameStateChange: (global as any).emitGameStateChange
    });

    const applied = controller.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);
    expect(enqueuePresentationFrames).toHaveBeenCalledWith([frame], {
      source: 'network_snapshot'
    });
    expect(visualStateStore.getCanonicalSnapshot()).toMatchObject({
      stateVersion: 2,
      gameState: { snapshotLabel: 'new' }
    });
    expect(visualStateStore.getRenderSnapshot()).toMatchObject({
      stateVersion: 1,
      gameState: { snapshotLabel: 'old' }
    });
    expect((global as any).cardState.presentationEvents).toEqual([]);

    visualStateStore.commitFrame(frame);

    expect(visualStateStore.getRenderSnapshot()).toMatchObject({
      stateVersion: 2,
      gameState: { snapshotLabel: 'new' }
    });
  });

  test('applies the committed frame through the strict settlement handle without a legacy board refresh', async () => {
    (global as any).PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event: any) => createStrictNetworkSettlementHandle(event)),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    const client = require('../ui/network-client.js');
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 0,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };

    const applied = client.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);
    (global as any).renderBoard.mockClear();

    await flushAsyncWork();
    await flushAsyncWork();

    expect(strictNetworkSettlementHandles).toHaveLength(1);
    expect(strictNetworkSettlementHandles[0].applyCommittedFrame).toHaveBeenCalledTimes(1);
    expect(strictNetworkSettlementHandles[0].settle).toHaveBeenCalledTimes(1);
    expect((global as any).emitBoardUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
      source: 'network_timeline'
    }));
    expect((global as any).renderBoard).not.toHaveBeenCalled();
  });

  test('does not fall back to direct renderBoard when no board writer is available', async () => {
    (global as any).PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event: any) => createStrictNetworkSettlementHandle(event)),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    delete (global as any).emitBoardUpdate;
    delete (global as any).RenderScheduler;
    const client = require('../ui/network-client.js');
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 0,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };

    const applied = client.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);

    await flushAsyncWork();
    await flushAsyncWork();

    expect((global as any).renderBoard).not.toHaveBeenCalled();
  });

  test('marks network visual settlement after a presentation frame commits', async () => {
    (global as any).PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event: any) => createStrictNetworkSettlementHandle(event)),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    const client = require('../ui/network-client.js');
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 0,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };

    const applied = client.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);
    const tracker = (global as any).NetworkVisualSettlementTracker;
    expect(tracker).toBeTruthy();
    const waiter = tracker.waitForVisualSeq(1, { timeoutMs: 5000 });

    await flushAsyncWork();
    await flushAsyncWork();

    await expect(waiter).resolves.toEqual({ ok: true, visualSeq: 1 });
  });

  test('does not request RenderScheduler board updates after strict committed-frame apply', async () => {
    (global as any).PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event: any) => createStrictNetworkSettlementHandle(event)),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    const flushOrder: string[] = [];
    (global as any).RenderScheduler = {
      requestBoardRender: jest.fn(() => {
        flushOrder.push('request');
        return true;
      }),
      flushVisualUpdates: jest.fn((options?: any) => {
        flushOrder.push(options && options.ignorePlayback === true ? 'flush-ignore' : 'flush');
        return false;
      })
    };
    const client = require('../ui/network-client.js');
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 0,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };

    const applied = client.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);

    await flushAsyncWork();
    await flushAsyncWork();

    expect((global as any).RenderScheduler.requestBoardRender).not.toHaveBeenCalled();
    expect((global as any).RenderScheduler.flushVisualUpdates).not.toHaveBeenCalled();
    expect(strictNetworkSettlementHandles[0].applyCommittedFrame).toHaveBeenCalledTimes(1);
    expect(strictNetworkSettlementHandles[0].settle).toHaveBeenCalledTimes(1);
    expect(flushOrder).toEqual([]);
    expect((global as any).renderBoard).not.toHaveBeenCalled();
  });

  test('does not bypass a busy RenderScheduler after strict committed-frame apply', async () => {
    (global as any).PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event: any) => createStrictNetworkSettlementHandle(event)),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    let busy = true;
    const flushOrder: string[] = [];
    (global as any).RenderScheduler = {
      requestBoardRender: jest.fn(() => {
        flushOrder.push('request');
        return true;
      }),
      flushVisualUpdates: jest.fn(() => {
        flushOrder.push('flush');
        if (busy) return false;
        (global as any).renderBoard();
        return true;
      })
    };
    const client = require('../ui/network-client.js');
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 0,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };

    const applied = client.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);

    await flushAsyncWork();
    await flushAsyncWork();

    expect((global as any).RenderScheduler.requestBoardRender).not.toHaveBeenCalled();
    expect((global as any).RenderScheduler.flushVisualUpdates).not.toHaveBeenCalled();
    expect(strictNetworkSettlementHandles[0].applyCommittedFrame).toHaveBeenCalledTimes(1);
    expect(strictNetworkSettlementHandles[0].settle).toHaveBeenCalledTimes(1);
    expect(flushOrder).toEqual([]);
    expect((global as any).renderBoard).not.toHaveBeenCalled();
  });

  test('does not schedule a legacy playback-idle retry after strict committed-frame apply', async () => {
    (global as any).PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event: any) => createStrictNetworkSettlementHandle(event)),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    let releaseIdle: (() => void) | null = null;
    (global as any).waitForPlaybackIdle = jest.fn(() => new Promise<void>((resolve) => {
      releaseIdle = resolve;
    }));
    const flushOrder: string[] = [];
    (global as any).RenderScheduler = {
      requestBoardRender: jest.fn(() => {
        flushOrder.push('request');
        return true;
      }),
      flushVisualUpdates: jest.fn(() => {
        flushOrder.push('flush');
        if (flushOrder.length <= 2) return false;
        (global as any).renderBoard();
        return true;
      })
    };
    const client = require('../ui/network-client.js');
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 0,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };

    const applied = client.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);

    await flushAsyncWork();
    await flushAsyncWork();

    expect((global as any).waitForPlaybackIdle).not.toHaveBeenCalled();
    expect(strictNetworkSettlementHandles[0].applyCommittedFrame).toHaveBeenCalledTimes(1);
    expect(strictNetworkSettlementHandles[0].settle).toHaveBeenCalledTimes(1);
    expect((global as any).renderBoard).not.toHaveBeenCalled();
    expect(releaseIdle).toBeNull();
    expect(flushOrder).toEqual([]);
  });

  test('does not run a post-playback legacy refresh after strict committed-frame apply', async () => {
    (global as any).PresentationHandler = {
      handlePresentationEvent: jest.fn(async (event: any) => createStrictNetworkSettlementHandle(event)),
      onBoardUpdated: jest.fn(async () => undefined)
    };
    let releaseIdle: (() => void) | null = null;
    let idleReleased = false;
    (global as any).waitForPlaybackIdle = jest.fn(() => new Promise<void>((resolve) => {
      releaseIdle = () => {
        idleReleased = true;
        resolve();
      };
    }));
    const flushOrder: string[] = [];
    (global as any).RenderScheduler = {
      requestBoardRender: jest.fn(() => {
        flushOrder.push('request');
        return true;
      }),
      flushVisualUpdates: jest.fn(() => {
        flushOrder.push('flush');
        if (idleReleased) {
          (global as any).renderBoard();
        }
        return true;
      })
    };
    const client = require('../ui/network-client.js');
    const nextSnapshot = createSnapshot(2, 'new');
    const frame = {
      visualSeq: 1,
      stateVersionFrom: 0,
      stateVersionTo: 2,
      playbackEvents: [{ type: 'flip' }],
      snapshotAfter: nextSnapshot
    };

    const applied = client.applySnapshot(nextSnapshot, {
      force: true,
      playbackEvents: [{ type: 'legacy_flip' }],
      presentationFrames: [frame]
    });

    expect(applied).toBe(true);

    await flushAsyncWork();
    await flushAsyncWork();

    expect((global as any).waitForPlaybackIdle).not.toHaveBeenCalled();
    expect(strictNetworkSettlementHandles[0].applyCommittedFrame).toHaveBeenCalledTimes(1);
    expect(strictNetworkSettlementHandles[0].settle).toHaveBeenCalledTimes(1);
    expect(flushOrder).toEqual([]);
    expect((global as any).renderBoard).not.toHaveBeenCalled();
    expect(releaseIdle).toBeNull();
  });
});
