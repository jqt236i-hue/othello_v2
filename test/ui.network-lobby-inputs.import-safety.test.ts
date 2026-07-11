describe('network lobby input bindings import safety', () => {
  test('importing the binding module does not read the DOM or register listeners', () => {
    jest.resetModules();
    const originalDocument = (global as any).document;
    const documentProbe = new Proxy({}, {
      get() { throw new Error('network lobby input module touched document during import'); }
    });
    (global as any).document = documentProbe;
    try {
      expect(() => require('../ui/handlers/match-mode/network-lobby-inputs.ts')).not.toThrow();
    } finally {
      (global as any).document = originalDocument;
    }
  });
});
