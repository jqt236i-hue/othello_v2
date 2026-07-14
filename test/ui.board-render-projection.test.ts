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

  test('builds one immutable sparse semantic model from explicit render inputs', () => {
    const diff = require('../ui/diff-renderer.js');
    const inputs = diff.createBoardRenderInputs({ hoveredCellKey: '2,3' });
    const projection = diff.createBoardRenderProjection(undefined, inputs);
    const cellState = diff.buildCurrentCellState(projection, inputs);
    const model = diff.buildBoardRenderModel(projection, cellState, {
      visualRevision: 3,
      overlay: inputs.presentationOverlayState,
      inputs
    });

    expect(model.cells).toHaveLength(64);
    expect(model.cells.some((cell: any) => cell.kind === 'void')).toBe(false);
    expect(model.cells.find((cell: any) => cell.key === '2,3').interaction.hovered).toBe(true);
    expect(model.cells.find((cell: any) => cell.key === '5,5').stone.owner).toBe('white');
    expect(model).not.toHaveProperty('_renderProjection');
    expect(Object.isFrozen(model)).toBe(true);
    expect((global as any).getLegalMoves).toHaveBeenCalledTimes(1);
  });

  test('applies the prepared visual frame atomically after canonical globals advance', () => {
    const diff = require('../ui/diff-renderer.js');
    const modelBuilder = require('../ui/board-visual/model-builder');
    const inputs = diff.createBoardRenderInputs();
    const projection = diff.createBoardRenderProjection(undefined, inputs);
    const cellState = diff.buildCurrentCellState(projection, inputs);
    const overlay = diff.createBoardPresentationOverlayState(
      projection,
      cellState,
      inputs.presentationOverlayState
    );
    const model = diff.buildBoardRenderModel(projection, cellState, {
      visualRevision: 4,
      overlay,
      inputs: { baseVisualState: inputs.baseVisualState, presentationOverlayState: overlay }
    });

    (global as any).gameState = {
      currentPlayer: -1,
      board: Array.from({ length: 4 }, () => Array(4).fill(0))
    };
    (global as any).gameState.board[0][0] = 1;
    (global as any).cardState = {
      markers: [],
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: {}
    };

    const compatibilityState = modelBuilder.buildDomCompatibilityRenderState(model);
    expect(modelBuilder.getDomCompatibilityPayload).toBeUndefined();
    expect(compatibilityState.renderProjection.gameState).not.toBe(projection.gameState);
    expect(compatibilityState.renderProjection.cardState).not.toBe(projection.cardState);

    diff.renderBoardDiff(
      (global as any).boardEl,
      compatibilityState.renderProjection,
      compatibilityState.cellState,
      model,
      { authorizedByBoardVisualController: true }
    );

    expect((global as any).boardEl.querySelectorAll('.cell')).toHaveLength(64);
    expect((global as any).boardEl.querySelector('.cell[data-row="5"][data-col="5"] .disc.white')).not.toBeNull();
    expect((global as any).boardEl.querySelector('.cell[data-row="0"][data-col="0"] .disc')).toBeNull();
  });

  test('DOM compatibility materializes only the frame viewport plus bounded overscan/gutter', () => {
    const diff = require('../ui/diff-renderer.js');
    const inputs = diff.createBoardRenderInputs();
    const projection = diff.createBoardRenderProjection(undefined, inputs);
    const cellState = diff.buildCurrentCellState(projection, inputs);
    const model = diff.buildBoardRenderModel(projection, cellState, {
      inputs,
      overlay: inputs.presentationOverlayState
    });

    diff.initializeBoardDOM((global as any).boardEl, model, {
      visibleWorldWindow: { minRow: 0, maxRow: 0, minCol: 0, maxCol: 0 }
    });

    // one visible cell + one-cell overscan + capped two-cell effect gutter,
    // clipped at the top/left topology boundary => 4 x 4 DOM views.
    expect((global as any).boardEl.querySelectorAll('.cell')).toHaveLength(16);
    expect((global as any).boardEl.querySelector('.cell[data-row="4"][data-col="4"]')).toBeNull();
  });
});
