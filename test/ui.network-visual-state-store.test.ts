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
