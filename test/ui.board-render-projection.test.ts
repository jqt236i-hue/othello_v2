import { JSDOM } from 'jsdom';

describe('per-render board projection', () => {
  let dom: JSDOM;

  beforeEach(() => {
    jest.resetModules();
    dom = new JSDOM('<!doctype html><html><body><div id="board"></div></body></html>');
    (global as any).window = dom.window;
    (global as any).document = dom.window.document;
    (global as any).HTMLElement = dom.window.HTMLElement;
    (global as any).boardEl = dom.window.document.getElementById('board');
    (global as any).BLACK = 1;
    (global as any).WHITE = -1;
    (global as any).EMPTY = 0;
    (global as any).getPlayerKey = (player: number) => player === 1 ? 'black' : 'white';
    (global as any).getLegalMoves = jest.fn(() => [{ row: 2, col: 3, flips: [[3, 3]] }]);
    (global as any).CardLogic = {
      getCardContext: jest.fn(() => ({ protectedStones: [], permaProtectedStones: [], bombs: [], blockedCells: [] })),
      getSelectableTargets: jest.fn(() => []),
      isFreePlacementPendingType: jest.fn(() => false)
    };
    (global as any).gameState = {
      currentPlayer: 1,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    (global as any).gameState.board[5][5] = -1;
    (global as any).cardState = {
      markers: [
        { id: 'protected', kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'PROTECTED', remainingOwnerTurns: 2 } },
        { id: 'bomb', kind: 'specialStone', row: 4, col: 4, owner: 'white', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 2 } },
        { id: 'poison-cell', kind: 'specialStone', row: 5, col: 5, owner: 'black', data: { type: 'POISON_CELL', remainingTurns: 9 } },
        { id: 'poisoned', kind: 'specialStone', row: 5, col: 5, owner: 'white', data: { type: 'POISONED', remainingTurns: 4 } }
      ],
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: {}
    };
  });

  afterEach(() => {
    dom.window.close();
    for (const key of ['window', 'document', 'HTMLElement', 'boardEl', 'BLACK', 'WHITE', 'EMPTY', 'getPlayerKey', 'getLegalMoves', 'CardLogic', 'gameState', 'cardState']) {
      delete (global as any)[key];
    }
  });

  test('reuses context, selectable targets, legal moves, viewer context, and marker maps within one render', () => {
    const diff = require('../ui/diff-renderer.js');
    const counters = { cardContextBuilds: 0, selectableTargetBuilds: 0, legalMoveBuilds: 0 };
    const projection = diff.createBoardRenderProjection(counters);
    const projectedState = diff.buildCurrentCellState(projection);

    expect(counters).toEqual({ cardContextBuilds: 1, selectableTargetBuilds: 1, legalMoveBuilds: 1 });
    expect((global as any).CardLogic.getCardContext).toHaveBeenCalledTimes(1);
    expect((global as any).CardLogic.getSelectableTargets).toHaveBeenCalledTimes(1);
    expect((global as any).getLegalMoves).toHaveBeenCalledTimes(1);
    expect(projection.gameState).toBe((global as any).gameState);
    expect(projection.cardState).toBe((global as any).cardState);
    expect(projectedState[2][3].isLegal).toBe(true);
    expect(projectedState._renderProjection.markerMaps.specialMap.get('3,3')).toEqual(expect.objectContaining({ type: 'PROTECTED' }));
    expect(projectedState._renderProjection.markerMaps.bombMap.get('4,4')).toEqual(expect.objectContaining({ remainingTurns: 2 }));
    expect(projectedState[5][5].poisonCell).toEqual({ remainingTurns: 9 });
    expect(projectedState[5][5].poisoned).toEqual({ remainingTurns: 4 });
    expect(projectedState[5][5].special).toBeNull();
    expect((global as any).gameState._renderProjection).toBeUndefined();
    expect((global as any).cardState._renderProjection).toBeUndefined();
  });

  test('prepared and direct cell states are deeply equal without cross-render caching', () => {
    const diff = require('../ui/diff-renderer.js');
    const projection = diff.createBoardRenderProjection();
    const preparedState = diff.buildCurrentCellState(projection);
    const directState = diff.buildCurrentCellState();

    expect(preparedState).toEqual(directState);
    expect(diff.createBoardRenderProjection()).not.toBe(projection);
    expect(diff.createBoardRenderProjection().gameState).toBe((global as any).gameState);
  });
});
