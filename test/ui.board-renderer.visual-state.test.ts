import { JSDOM } from 'jsdom';

describe('board renderer network visual state', () => {
  let dom: JSDOM;

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

  test('renderBoardFull reads visual store snapshot while network visual playback is lagging', () => {
    const boardRenderer = require('../ui/board-renderer.js');

    boardRenderer.renderBoardFull();

    const disc = document.querySelector('.disc');
    expect(disc).toBeTruthy();
    expect(disc?.classList.contains('black')).toBe(true);
    expect(disc?.classList.contains('white')).toBe(false);
    expect((global as any).countDiscs).not.toHaveBeenCalledWith((global as any).gameState);
  });
});
