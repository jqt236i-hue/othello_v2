const path = require('path');

describe('shared/ui-bootstrap-shared forwarding', () => {
  test('forwards registerUIGlobals to ui/bootstrap when available', () => {
    const calls = [];
    jest.isolateModules(() => {
      jest.resetModules();
      jest.doMock(path.resolve(__dirname, '..', 'ui', 'bootstrap.js'), () => ({
        registerUIGlobals: (obj) => { calls.push(obj); return obj; }
      }), { virtual: false });
      const s = require(path.resolve(__dirname, '..', 'shared', 'ui-bootstrap-shared.js'));
      s.registerUIGlobals({ testKey: 'value' });
    });

    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls[calls.length - 1].testKey).toBe('value');
  });
});
