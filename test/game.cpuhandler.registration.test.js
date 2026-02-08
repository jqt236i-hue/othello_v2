const path = require('path');

describe('cpu-turn-handler registration', () => {
  test('registerUIGlobals is called with CPU functions when bootstrap is available', () => {
    const calls = [];
    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'shared', 'ui-bootstrap-shared.js'), () => ({
        registerUIGlobals: (obj) => { calls.push(obj); return obj; }
      }), { virtual: false });

      require(path.resolve(__dirname, '..', 'game', 'cpu-turn-handler.js'));
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    const obj = calls[calls.length - 1];
    expect(typeof obj.processCpuTurn === 'function').toBeTruthy();
    expect(typeof obj.processAutoBlackTurn === 'function').toBeTruthy();
  });
});
