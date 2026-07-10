import { createCardBoardConfiguration } from '../game/logic/cards-internal/board-configuration';

describe('card board configuration adapter', () => {
  test('delegates configuration, empty-board, and opening-layout operations to the shared board authority', () => {
    const boardUtils = {
      resolveBoardConfig: jest.fn((value) => ({ resolved: value })),
      createEmptyBoard: jest.fn((config, empty) => ({ config, empty })),
      getOpeningPlacements: jest.fn((value) => [{ placement: value }]),
      getOpeningCells: jest.fn((value) => [{ cell: value }])
    };
    const adapter = createCardBoardConfiguration({ boardUtils });

    expect(adapter.resolveCardBoardConfig('config')).toEqual({ resolved: 'config' });
    expect(adapter.createStoneIdBoard('board')).toEqual({ config: { resolved: 'board' }, empty: null });
    expect(adapter.getOpeningPlacementsForState('opening')).toEqual([{ placement: 'opening' }]);
    expect(adapter.getOpeningCellsForState('cells')).toEqual([{ cell: 'cells' }]);
    expect(boardUtils.resolveBoardConfig).toHaveBeenCalledWith('config');
    expect(boardUtils.resolveBoardConfig).toHaveBeenCalledWith('board');
  });

  test('fails during setup when the shared board authority is not available', () => {
    expect(() => createCardBoardConfiguration({ boardUtils: {} })).toThrow(
      '[cards] SharedBoardUtils.resolveBoardConfig is required'
    );
  });
});
