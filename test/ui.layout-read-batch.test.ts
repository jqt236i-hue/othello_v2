describe('layout read batch', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('caches getBoundingClientRect per element within one batch', () => {
    const { createLayoutReadBatch } = require('../ui/layout-read-batch.js');
    const element = {
      getBoundingClientRect: jest.fn(() => ({
        left: 1,
        top: 2,
        width: 30,
        height: 40,
        right: 31,
        bottom: 42
      }))
    };

    const batch = createLayoutReadBatch();
    const first = batch.readRect(element);
    const second = batch.readRect(element);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(element.getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  test('clear starts a new read cycle', () => {
    const { createLayoutReadBatch } = require('../ui/layout-read-batch.js');
    const element = {
      getBoundingClientRect: jest.fn(() => ({
        left: 4,
        top: 5,
        width: 6,
        height: 7,
        right: 10,
        bottom: 12
      }))
    };

    const batch = createLayoutReadBatch();
    batch.readRect(element);
    batch.clear();
    batch.readRect(element);

    expect(element.getBoundingClientRect).toHaveBeenCalledTimes(2);
  });
});
