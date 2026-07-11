describe('network diagnostics import safety', () => {
  test('importing the controller does not read the DOM or register listeners', () => {
    jest.resetModules();
    const originalDocument = (global as any).document;
    const documentProbe = new Proxy({}, {
      get() { throw new Error('diagnostics module touched document during import'); }
    });
    (global as any).document = documentProbe;
    try {
      expect(() => require('../ui/network/diagnostics.ts')).not.toThrow();
    } finally {
      (global as any).document = originalDocument;
    }
  });
});
