describe('BoardOps kernel dependencies', () => {
  afterEach(() => {
    jest.dontMock('../game/logic/cards/markers.js');
    jest.dontMock('../game/logic/cards/markers.ts');
    jest.resetModules();
  });

  test('fails during module initialization when canonical stone-id access is unavailable', () => {
    jest.doMock('../game/logic/cards/markers.js', () => ({}));
    jest.doMock('../game/logic/cards/markers.ts', () => ({}));

    expect(() => {
      jest.isolateModules(() => {
        require('../game/logic/board_ops.js');
      });
    }).toThrow('CardMarkers stone-id access is required by BoardOps');
  });
});
