describe('hand card swipe gesture import safety', () => {
  test('importing the adapter does not read the DOM or register listeners', () => {
    jest.resetModules();
    const originalDocument = (global as any).document;
    const documentProbe = new Proxy({}, {
      get() { throw new Error('hand card swipe gesture module touched document during import'); }
    });
    (global as any).document = documentProbe;
    try {
      expect(() => require('../cards/hand-card-swipe-gesture.ts')).not.toThrow();
    } finally {
      (global as any).document = originalDocument;
    }
  });
});
