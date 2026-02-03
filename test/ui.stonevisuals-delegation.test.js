const path = require('path');

describe('ui/move-executor-visuals delegation', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('setDiscColorAt delegates to stone-visuals when available', () => {
    const mockSet = jest.fn();
    jest.doMock(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'), () => ({ setDiscColorAt: mockSet }));
    const vis = require(path.resolve(__dirname, '..', 'ui', 'move-executor-visuals.js'));

    // call
    vis.setDiscColorAt(1, 2, 1);
    expect(mockSet).toHaveBeenCalledWith(1, 2, 1);
  });

  test('removeBombOverlayAt delegates to stone-visuals when available', () => {
    const mockRemove = jest.fn();
    jest.doMock(path.resolve(__dirname, '..', 'ui', 'stone-visuals.js'), () => ({ removeBombOverlayAt: mockRemove }));
    const vis = require(path.resolve(__dirname, '..', 'ui', 'move-executor-visuals.js'));

    vis.removeBombOverlayAt(3, 4);
    expect(mockRemove).toHaveBeenCalledWith(3, 4);
  });
});
