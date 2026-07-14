const Store = require('../ui/network/visual-state-store');

describe('NetworkVisualStateStore', () => {
  test('keeps canonical and visual snapshots separated while visual playback catches up', () => {
    const store = Store.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot({
      stateVersion: 1,
      gameState: { board: [['old']] },
      cardState: { hands: { black: [] } }
    }, { visualSeq: 0, visualVersion: 1 });

    store.setCanonicalSnapshot({
      stateVersion: 2,
      gameState: { board: [['new']] },
      cardState: { hands: { black: ['c1'] } }
    }, { stateVersion: 2 });

    expect(store.getRenderSnapshot()).toMatchObject({
      stateVersion: 1,
      gameState: { board: [['old']] }
    });
    expect(store.getDiagnostics()).toMatchObject({
      canonicalVersion: 2,
      visualVersion: 1,
      lagging: true
    });
  });

  test('commits a frame snapshot only after playback completes', () => {
    const store = Store.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot({
      stateVersion: 1,
      gameState: { board: [['old']] },
      cardState: {}
    }, { visualSeq: 0, visualVersion: 1 });
    store.setCanonicalSnapshot({
      stateVersion: 2,
      gameState: { board: [['new']] },
      cardState: {}
    }, { stateVersion: 2 });

    store.commitFrame({
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      snapshotAfter: {
        stateVersion: 2,
        gameState: { board: [['new']] },
        cardState: {}
      }
    });

    expect(store.getRenderSnapshot()).toMatchObject({
      stateVersion: 2,
      gameState: { board: [['new']] }
    });
    expect(store.getDiagnostics()).toMatchObject({
      visualSeq: 1,
      visualVersion: 2,
      canonicalVersion: 2,
      lagging: false
    });
  });

  test('keeps an idempotent receipt current until the visual generation changes', () => {
    const store = Store.createNetworkVisualStateStore();
    const committedFrame = {
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      snapshotAfter: {
        stateVersion: 2,
        gameState: { board: [['committed']] },
        cardState: {}
      }
    };

    const receipt = store.commitFrame(committedFrame, { source: 'stream' });
    expect(store.commitFrame(committedFrame, { source: 'duplicate' })).toBe(receipt);
    expect(store.isCurrentCommitReceipt(receipt)).toBe(true);
    expect(store.getSnapshotForReceipt(receipt)).toMatchObject({
      stateVersion: 2,
      gameState: { board: [['committed']] }
    });

    store.setCanonicalSnapshot({
      stateVersion: 3,
      gameState: { board: [['canonical-newer']] },
      cardState: {}
    });
    expect(store.isCurrentCommitReceipt(receipt)).toBe(true);
    expect(store.getSnapshotForReceipt(receipt).gameState.board[0][0]).toBe('committed');

    store.setBaseVisualSnapshot({
      stateVersion: 3,
      gameState: { board: [['new-base']] },
      cardState: {}
    }, { visualSeq: 1, visualVersion: 3 });
    expect(store.isCurrentCommitReceipt(receipt)).toBe(false);
    expect(store.getSnapshotForReceipt(receipt)).toBeNull();
  });

  test('rejects a conflicting snapshot for the same visual sequence and version', () => {
    const store = Store.createNetworkVisualStateStore();
    const receipt = store.commitFrame({
      visualSeq: 4,
      stateVersionFrom: 4,
      stateVersionTo: 5,
      snapshotAfter: {
        stateVersion: 5,
        gameState: { board: [['accepted']] },
        cardState: {}
      }
    }, { source: 'stream' });

    expect(() => store.commitFrame({
      visualSeq: 4,
      stateVersionFrom: 4,
      stateVersionTo: 5,
      snapshotAfter: {
        stateVersion: 5,
        gameState: { board: [['conflict']] },
        cardState: {}
      }
    }, { source: 'duplicate' })).toThrow('visual_state_commit_conflict');
    expect(store.isCurrentCommitReceipt(receipt)).toBe(true);
    expect(store.getSnapshotForReceipt(receipt)).toMatchObject({
      gameState: { board: [['accepted']] }
    });
  });

  test('invalidates commit receipts when visual state is cleared or the store is reset', () => {
    const store = Store.createNetworkVisualStateStore();
    store.setCanonicalSnapshot({ stateVersion: 1, gameState: { board: [['canonical']] }, cardState: {} });
    const firstReceipt = store.commitFrame({
      visualSeq: 1,
      stateVersionTo: 1,
      snapshotAfter: { stateVersion: 1, gameState: { board: [['first']] }, cardState: {} }
    });

    store.clearVisualSnapshot();
    expect(store.isCurrentCommitReceipt(firstReceipt)).toBe(false);
    expect(store.getSnapshotForReceipt(firstReceipt)).toBeNull();
    expect(store.peekRenderSnapshot()).toMatchObject({ gameState: { board: [['canonical']] } });

    const secondReceipt = store.commitFrame({
      visualSeq: 1,
      stateVersionTo: 2,
      snapshotAfter: { stateVersion: 2, gameState: { board: [['second']] }, cardState: {} }
    });
    expect(store.isCurrentCommitReceipt(secondReceipt)).toBe(true);

    store.reset();
    expect(store.isCurrentCommitReceipt(secondReceipt)).toBe(false);
    expect(store.getSnapshotForReceipt(secondReceipt)).toBeNull();
    expect(store.peekRenderSnapshot()).toBeNull();
    expect(store.getDiagnostics()).toMatchObject({
      canonicalVersion: null,
      visualSeq: 0,
      visualVersion: null,
      hasCanonicalSnapshot: false,
      hasVisualSnapshot: false
    });
  });

  test('does not overwrite an older active visual base with a newer canonical baseline', () => {
    const store = Store.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot({ stateVersion: 1, gameState: { turn: 1 }, cardState: {} }, {
      visualSeq: 0,
      visualVersion: 1
    });
    store.setBaseVisualSnapshot({ stateVersion: 2, gameState: { turn: 2 }, cardState: {} }, {
      visualSeq: 1,
      visualVersion: 2,
      preserveExisting: true
    });

    expect(store.getRenderSnapshot()).toMatchObject({
      stateVersion: 1,
      gameState: { turn: 1 }
    });
    expect(store.getDiagnostics()).toMatchObject({
      visualSeq: 0,
      visualVersion: 1
    });
  });

  test.each([
    ['equal', 2, 2],
    ['older', 1, 1]
  ])('keeps the current commit receipt for %s preserved base input', (_label, visualSeq, visualVersion) => {
    const store = Store.createNetworkVisualStateStore();
    const committedFrame = {
      visualSeq: 2,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      snapshotAfter: {
        stateVersion: 2,
        gameState: { board: [['committed']] },
        cardState: {}
      }
    };
    const receipt = store.commitFrame(committedFrame, { source: 'stream' });

    store.setBaseVisualSnapshot({
      stateVersion: visualVersion,
      gameState: { board: [[`${_label}-base`]] },
      cardState: {}
    }, {
      visualSeq,
      visualVersion,
      preserveExisting: true,
      source: 'network_snapshot_base'
    });

    expect(store.isCurrentCommitReceipt(receipt)).toBe(true);
    expect(store.commitFrame(committedFrame, { source: 'retry' })).toBe(receipt);
    expect(store.getSnapshotForReceipt(receipt)).toBe(store.peekRenderSnapshot());
    expect(store.peekRenderSnapshot()).toMatchObject({
      stateVersion: 2,
      gameState: { board: [['committed']] }
    });
    expect(store.getDiagnostics()).toMatchObject({
      visualSeq: 2,
      visualVersion: 2,
      lastCommitSource: 'stream'
    });
  });

  test('falls back to canonical snapshot when no visual baseline exists', () => {
    const store = Store.createNetworkVisualStateStore();
    store.setCanonicalSnapshot({
      stateVersion: 7,
      gameState: { currentPlayer: -1 },
      cardState: {}
    });

    expect(store.getRenderSnapshot()).toMatchObject({
      stateVersion: 7,
      gameState: { currentPlayer: -1 }
    });
  });
});
