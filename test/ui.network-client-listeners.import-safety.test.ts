describe('network client listener bindings import safety', () => {
  test('importing the binding module does not read the DOM or register listeners', () => {
    jest.resetModules();
    const originalDocument = (global as any).document;
    const documentProbe = new Proxy({}, {
      get() { throw new Error('network client listener module touched document during import'); }
    });
    (global as any).document = documentProbe;
    try {
      expect(() => require('../ui/handlers/match-mode/network-client-listeners.ts')).not.toThrow();
    } finally {
      (global as any).document = originalDocument;
    }
  });
});
