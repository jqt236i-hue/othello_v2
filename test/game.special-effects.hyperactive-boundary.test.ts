describe('special-effects hyperactive turn-start events', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.cardState = { markers: [] };
    global.gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
  });

  afterEach(() => {
    delete global.BLACK;
    delete global.WHITE;
    delete global.cardState;
    delete global.gameState;
  });

  test('empty pipeline events is a normal case and does not log an error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const hyperactive = require('../game/special-effects/hyperactive.js');
      await hyperactive.processHyperactiveMovesAtTurnStart(global.BLACK, null, []);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }
  });

  test('missing (non-array) pipeline events is still reported as an error', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const hyperactive = require('../game/special-effects/hyperactive.js');
      await hyperactive.processHyperactiveMovesAtTurnStart(global.BLACK, null, null);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[HYPERACTIVE] No precomputed pipeline events provided'));
    } finally {
      errorSpy.mockRestore();
    }
  });
});
