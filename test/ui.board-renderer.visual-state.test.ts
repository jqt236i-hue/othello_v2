import { JSDOM } from 'jsdom';

describe('board renderer network visual state', () => {
  let dom: JSDOM;

  function loadDomBoardRenderer() {
    const boardRenderer = require('../ui/board-renderer.js');
    boardRenderer.configureBoardVisualBackendForTest({ selection: 'dom' });
    return boardRenderer;
  }

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).boardEl = document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getPlayerKey = (player: any) => (player === -1 ? 'white' : 'black');
    (global as any).getLegalMoves = jest.fn(() => []);
    (global as any).countDiscs = jest.fn((state: any) => {
      const cells = Array.isArray(state && state.board) ? state.board.flat() : [];
      return {
        black: cells.filter((value: any) => value === 1).length,
        white: cells.filter((value: any) => value === -1).length
      };
    });
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
    (global as any).gameState = {
      currentPlayer: 1,
      board: [[-1]]
    };
    (global as any).cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null }
    };
    (global as any).NetworkVisualStateStore = {
      getDiagnostics: jest.fn(() => ({
        canonicalVersion: 2,
        visualVersion: 1,
        lagging: true
      })),
      getRenderSnapshot: jest.fn(() => ({
        stateVersion: 1,
        gameState: {
          currentPlayer: 1,
          board: [[1]]
        },
        cardState: {
          markers: [],
          pendingEffectByPlayer: { black: null, white: null }
        }
      }))
    };
  });

  afterEach(() => {
    try { dom.window.close(); } catch (e) { /* ignore */ }
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

  test('renderBoardFull reads visual store snapshot while network visual playback is lagging', async () => {
    const boardRenderer = loadDomBoardRenderer();

    boardRenderer.renderBoardFull();
    await boardRenderer.getBoardVisualController().ready;

    const disc = document.querySelector('.disc');
    expect(disc).toBeTruthy();
    expect(disc?.classList.contains('black')).toBe(true);
    expect(disc?.classList.contains('white')).toBe(false);
    expect((global as any).countDiscs).not.toHaveBeenCalledWith((global as any).gameState);
  });

  test('renderBoardFull keeps the visual store as network render authority after playback catches up', async () => {
    (global as any).NetworkVisualStateStore.getDiagnostics.mockReturnValue({
      canonicalVersion: 2,
      visualVersion: 2,
      lagging: false,
      hasVisualSnapshot: true
    });
    const boardRenderer = loadDomBoardRenderer();

    boardRenderer.renderBoardFull();
    await boardRenderer.getBoardVisualController().ready;

    const disc = document.querySelector('.disc');
    expect(disc).toBeTruthy();
    expect(disc?.classList.contains('black')).toBe(true);
    expect(disc?.classList.contains('white')).toBe(false);
    expect((global as any).NetworkVisualStateStore.getRenderSnapshot).toHaveBeenCalled();
  });

  test('createBoardRenderInputs fixes game/card to one visual-store snapshot read', () => {
    const firstSnapshot = {
      stateVersion: 10,
      gameState: { currentPlayer: 1, board: [[1]], pairId: 'first' },
      cardState: { markers: [], pendingEffectByPlayer: { black: null, white: null }, pairId: 'first' }
    };
    const secondSnapshot = {
      stateVersion: 11,
      gameState: { currentPlayer: -1, board: [[-1]], pairId: 'second' },
      cardState: { markers: [], pendingEffectByPlayer: { black: null, white: null }, pairId: 'second' }
    };
    (global as any).NetworkVisualStateStore.getRenderSnapshot
      .mockImplementationOnce(() => firstSnapshot)
      .mockImplementation(() => secondSnapshot);
    const diff = require('../ui/diff-renderer.js');

    const inputs = diff.createBoardRenderInputs();

    expect((global as any).NetworkVisualStateStore.getRenderSnapshot).toHaveBeenCalledTimes(1);
    expect(inputs.baseVisualState.gameState).toBe(firstSnapshot.gameState);
    expect(inputs.baseVisualState.cardState).toBe(firstSnapshot.cardState);
    expect(inputs.baseVisualState.gameState.pairId).toBe(inputs.baseVisualState.cardState.pairId);
  });

  test('createBoardRenderInputs reads the local game/card pair once each', () => {
    const diff = require('../ui/diff-renderer.js');
    delete (global as any).NetworkVisualStateStore;
    delete (global as any).gameState;
    delete (global as any).cardState;
    const localGameState = { currentPlayer: 1, board: [[1]], pairId: 'local' };
    const localCardState = { markers: [], pendingEffectByPlayer: { black: null, white: null }, pairId: 'local' };
    let gameReads = 0;
    let cardReads = 0;
    Object.defineProperty(global, 'gameState', {
      configurable: true,
      get: () => {
        gameReads += 1;
        return localGameState;
      }
    });
    Object.defineProperty(global, 'cardState', {
      configurable: true,
      get: () => {
        cardReads += 1;
        return localCardState;
      }
    });

    const inputs = diff.createBoardRenderInputs();

    expect(gameReads).toBe(1);
    expect(cardReads).toBe(1);
    expect(inputs.baseVisualState.gameState).toBe(localGameState);
    expect(inputs.baseVisualState.cardState).toBe(localCardState);
  });

  test('prepared visual-store pair also owns permission and viewer projection', () => {
    (global as any).NetworkVisualStateStore.getRenderSnapshot.mockReturnValue({
      stateVersion: 12,
      gameState: { currentPlayer: -1, board: [[0]] },
      cardState: {
        markers: [],
        pendingEffectByPlayer: { black: null, white: null },
        fateWillControllerByTurnOwner: {}
      }
    });
    (global as any).getLegalMoves.mockReturnValue([{ row: 0, col: 0 }]);
    Object.assign((global as any).window, {
      MATCH_MODE: 'network',
      NetworkMatchClient: {
        isActive: () => true,
        isSpectator: () => false,
        getSeatKey: () => 'white'
      }
    });
    const diff = require('../ui/diff-renderer.js');

    const inputs = diff.createBoardRenderInputs();
    // Canonical globals are already ahead; the prepared visual pair remains
    // the only source for current-player permission and hints.
    (global as any).gameState.currentPlayer = 1;
    const projection = diff.createBoardRenderProjection(undefined, inputs);
    const cellState = diff.buildCurrentCellState(projection, inputs);
    const model = diff.buildBoardRenderModel(projection, cellState, {
      inputs,
      overlay: inputs.presentationOverlayState
    });

    expect(projection.gameState.currentPlayer).toBe(-1);
    expect(projection.canControlCurrentTurn).toBe(true);
    expect(cellState[0][0].isLegal).toBe(true);
    expect(model.viewerContext).toBe('white');
  });

  test('spectator viewer context stays read-only in the semantic model', () => {
    Object.assign((global as any).window, {
      MATCH_MODE: 'network',
      NetworkMatchClient: {
        isActive: () => true,
        isSpectator: () => true,
        getSeatKey: () => null
      }
    });
    const diff = require('../ui/diff-renderer.js');
    const inputs = diff.createBoardRenderInputs();
    const projection = diff.createBoardRenderProjection(undefined, inputs);
    const cellState = diff.buildCurrentCellState(projection, inputs);
    const model = diff.buildBoardRenderModel(projection, cellState, {
      inputs,
      overlay: inputs.presentationOverlayState
    });

    expect(projection.canControlCurrentTurn).toBe(false);
    expect(model.viewerContext).toBe('spectator');
  });

  test('applies a strict committed frame from the receipt-bound snapshot only', async () => {
    const Store = require('../ui/network/visual-state-store');
    const store = Store.createNetworkVisualStateStore();
    store.setBaseVisualSnapshot({
      stateVersion: 1,
      gameState: { currentPlayer: 1, board: [[1]] },
      cardState: { markers: [], pendingEffectByPlayer: { black: null, white: null } }
    }, { visualSeq: 0, visualVersion: 1 });
    (global as any).NetworkVisualStateStore = store;
    (global as any).window.NetworkVisualStateStore = store;
    const boardRenderer = loadDomBoardRenderer();
    boardRenderer.renderBoardFull();
    await boardRenderer.getBoardVisualControllerReady();
    const token = boardRenderer.claimBoardVisualWriter('network:1', 'network');
    boardRenderer.beginBoardVisualFrameCommit(token);
    const receipt = store.commitFrame({
      visualSeq: 1,
      stateVersionFrom: 1,
      stateVersionTo: 2,
      snapshotAfter: {
        stateVersion: 2,
        gameState: { currentPlayer: -1, board: [[-1]] },
        cardState: { markers: [], pendingEffectByPlayer: { black: null, white: null } }
      }
    }, { source: 'test' });

    await expect(boardRenderer.applyCommittedBoardVisualFrame(token, Object.freeze({ ...receipt })))
      .rejects.toThrow('not current for the visual store');
    await expect(boardRenderer.applyCommittedBoardVisualFrame(token, receipt)).resolves.toBe(true);

    const disc = document.querySelector('.disc');
    expect(disc?.classList.contains('white')).toBe(true);
    expect(disc?.classList.contains('black')).toBe(false);
    expect(boardRenderer.releaseBoardVisualWriter(token)).toBe(true);
  });
});
