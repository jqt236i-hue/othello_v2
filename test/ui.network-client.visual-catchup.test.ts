function createSnapshot(stateVersion: number, label: string) {
  return {
    stateVersion,
    _meta: {
      authority: 'server',
      version: stateVersion,
      projectedForSeat: 'black',
      turnStartReconciled: true
    },
    gameState: {
      currentPlayer: stateVersion % 2 === 0 ? -1 : 1,
      board: [[label]]
    },
    cardState: {
      hands: { black: [], white: [] },
      presentationEvents: [],
      _presentationEventsPersist: []
    }
  };
}

describe('network client visual catch-up', () => {
  beforeEach(() => {
    jest.resetModules();
    (global as any).gameState = createSnapshot(1, 'old').gameState;
    (global as any).cardState = createSnapshot(1, 'old').cardState;
    (global as any).BoardOps = {
      emitPresentationEvent: jest.fn((cardStateRef: any, event: any) => {
        if (!Array.isArray(cardStateRef.presentationEvents)) cardStateRef.presentationEvents = [];
        cardStateRef.presentationEvents.push(event);
      })
    };
    (global as any).emitBoardUpdate = jest.fn();
    (global as any).emitCardStateChange = jest.fn();
    (global as any).emitGameStateChange = jest.fn();
  });

  afterEach(() => {
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).BoardOps;
    delete (global as any).emitBoardUpdate;
    delete (global as any).emitCardStateChange;
    delete (global as any).emitGameStateChange;
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
      gameState: { board: [['new']] }
    });
    expect(visualStateStore.getRenderSnapshot()).toMatchObject({
      stateVersion: 1,
      gameState: { board: [['old']] }
    });
    expect((global as any).cardState.presentationEvents).toEqual([]);

    visualStateStore.commitFrame(frame);

    expect(visualStateStore.getRenderSnapshot()).toMatchObject({
      stateVersion: 2,
      gameState: { board: [['new']] }
    });
  });
});
