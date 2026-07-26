describe('card-resolution BoardView boundary', () => {
  afterEach(() => {
    jest.dontMock('../shared/shared-board-utils.js');
    jest.dontMock('../shared/shared-board-utils.ts');
    jest.resetModules();
  });

  test('fails during module initialization when canonical BoardContext APIs are unavailable', () => {
    jest.doMock('../shared/shared-board-utils.js', () => ({}));
    jest.doMock('../shared/shared-board-utils.ts', () => ({}));

    expect(() => {
      jest.isolateModules(() => {
        require('../game/logic/card-resolution/board-view-access');
      });
    }).toThrow('SharedBoardUtils BoardContext/BoardView APIs are required by card resolution');
  });
});
