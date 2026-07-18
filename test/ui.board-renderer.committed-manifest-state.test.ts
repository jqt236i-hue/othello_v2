import { JSDOM } from 'jsdom';

describe('board renderer committed manifestation state', () => {
  let dom: JSDOM;
  let controller: any;

  beforeEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
    dom = new JSDOM(
      '<!doctype html><html><body><div id="board-stack"><div id="board-frame"><div id="board"></div></div><div id="board-expansion-layer"></div></div></body></html>',
      { url: 'https://example.test/game' }
    );
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).boardEl = document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getPlayerKey = (player: any) => (player === -1 ? 'white' : 'black');
    (global as any).getLegalMoves = jest.fn(() => []);
    (global as any).countDiscs = jest.fn(() => ({ black: 1, white: 0 }));
    (global as any).handleCellClick = jest.fn();
    (global as any).applyStoneVisualEffect = jest.fn();
    (global as any).CardLogic = {
      getCardContext: () => ({
        protectedStones: [],
        permaProtectedStones: [],
        bombs: []
      }),
      getSelectableTargets: () => []
    };
    (global as any).gameState = { currentPlayer: 1, board: [[1]] };
    (global as any).cardState = {
      markers: [],
      hands: { black: [], white: [] },
      pendingEffectByPlayer: { black: null, white: null }
    };
  });

  afterEach(() => {
    try { controller?.destroy?.(); } catch (_error) { /* test cleanup */ }
    try { dom.window.close(); } catch (_error) { /* test cleanup */ }
    jest.restoreAllMocks();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).boardEl;
    delete (global as any).BLACK;
    delete (global as any).WHITE;
    delete (global as any).EMPTY;
    delete (global as any).getPlayerKey;
    delete (global as any).getLegalMoves;
    delete (global as any).countDiscs;
    delete (global as any).handleCellClick;
    delete (global as any).applyStoneVisualEffect;
    delete (global as any).CardLogic;
    delete (global as any).gameState;
    delete (global as any).cardState;
    delete (global as any).NetworkVisualStateStore;
  });

  test('presents one immutable frame snapshot only after strict committed-frame settlement succeeds', async () => {
    let resolveSettlement!: () => void;
    const settlement = new Promise<void>((resolve) => {
      resolveSettlement = resolve;
    });
    const backend = {
      kind: 'pixi',
      mount: jest.fn(),
      applyFrame: jest.fn(),
      playPhase: jest.fn(async () => undefined),
      getCellClientRect: jest.fn(() => null),
      resize: jest.fn(),
      restore: jest.fn(),
      destroy: jest.fn(),
      waitForVisualSettlement: jest.fn(() => settlement)
    };
    const Store = require('../ui/network/visual-state-store');
    const store = Store.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot({
      stateVersion: 1,
      gameState: { currentPlayer: 1, board: [[1]] },
      cardState: {
        markers: [],
        hands: { black: [], white: [] },
        pendingEffectByPlayer: { black: null, white: null }
      }
    }, { visualSeq: 0, visualVersion: 1 });
    (global as any).NetworkVisualStateStore = store;
    (global as any).window.NetworkVisualStateStore = store;

    const committedWorldState = require('../ui/presentation/committed-world-state');
    const presentCommittedWorldState = jest.spyOn(committedWorldState, 'presentCommittedWorldState');
    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.configureBoardVisualBackendForTest({
      selection: 'pixi',
      createPixiBackend: () => backend
    });
    controller = boardRenderer.getBoardVisualController();
    await controller.waitUntilReady();

    const committedCardState: any = {
      markers: [{
        id: 'observer-will:captured',
        kind: 'manifestStone',
        owner: 'black',
        data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 3 }
      }],
      hands: { black: ['b1'], white: ['w1'] },
      pendingEffectByPlayer: { black: null, white: null },
      unrelatedCanonicalField: { mutable: true }
    };
    const token = boardRenderer.claimBoardVisualWriter('network:1', 'network');
    boardRenderer.beginBoardVisualFrameCommit(token);
    const receipt = store.commitFrame({
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      snapshotAfter: {
        stateVersion: 2,
        gameState: { currentPlayer: -1, board: [[-1]] },
        cardState: committedCardState
      }
    }, { source: 'test' });

    const applying = boardRenderer.applyCommittedBoardVisualFrame(token, receipt);
    committedCardState.markers[0].data.type = 'THEORY_INCARNATION';
    committedCardState.markers[0].data.remainingOwnerTurns = 1;
    committedCardState.hands.black.push('b2');

    await Promise.resolve();
    expect(presentCommittedWorldState).not.toHaveBeenCalled();
    expect(document.getElementById('manifest-effect-panel')).toBeNull();

    resolveSettlement();
    await expect(applying).resolves.toBe(true);

    expect(presentCommittedWorldState).toHaveBeenCalledTimes(1);
    const committedPresentationState = presentCommittedWorldState.mock.calls[0][0] as any;
    expect(committedPresentationState).not.toBe(committedCardState);
    expect(Object.isFrozen(committedPresentationState)).toBe(true);
    expect(Object.isFrozen(committedPresentationState.markers)).toBe(true);
    expect(Object.isFrozen(committedPresentationState.markers[0].data)).toBe(true);
    expect(committedPresentationState).not.toHaveProperty('unrelatedCanonicalField');
    expect(committedPresentationState.markers[0].data).toEqual({
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 3
    });
    expect(document.getElementById('manifest-effect-title')?.textContent)
      .toBe('観測領域　残り3ターン');
  });
});
