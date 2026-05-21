describe('special-effects bombs fallback animation batching', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.cardState = {
      markers: [
        { kind: 'specialStone', row: 3, col: 3, owner: 'black', data: { type: 'TIME_BOMB', category: 'bomb', remainingTurns: 0 } }
      ]
    };
    global.gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    global.PlaybackEngine = undefined; // force fallback path
  });

  afterEach(() => {
    const bombs = require('../game/special-effects/bombs.js');
    if (bombs && typeof bombs.setUIImpl === 'function') {
      bombs.setUIImpl({});
    }
    delete global.BLACK;
    delete global.WHITE;
    delete global.cardState;
    delete global.gameState;
    delete global.PlaybackEngine;
  });

  test('explosion destroy animations are started in one batch', async () => {
    const calls = [];
    let active = 0;
    let maxConcurrent = 0;
    const animateFadeOutAt = jest.fn((row, col) => {
      calls.push([row, col]);
      active++;
      if (active > maxConcurrent) maxConcurrent = active;
      return new Promise((resolve) => {
        setTimeout(() => {
          active--;
          resolve();
        }, 20);
      });
    });

    const { processBombs, setUIImpl } = require('../game/special-effects/bombs.js');
    setUIImpl({ animateFadeOutAt });
    await processBombs([{
      type: 'bombs_exploded',
      details: {
        exploded: [{ row: 3, col: 3 }],
        destroyed: [{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 3 }]
      }
    }]);

    expect(animateFadeOutAt).toHaveBeenCalledTimes(3);
    expect(calls).toEqual(expect.arrayContaining([[3, 3], [3, 4], [4, 3]]));
    expect(maxConcurrent).toBe(3);
  });

  test('explodeBombUI includes expansion cells in fallback destroy payload', async () => {
    global.gameState.boardExpansion = {
      active: false,
      side: null,
      row: null,
      owner: 0,
      usedByPlayer: { black: true, white: true },
      cells: [
        { side: 'left', row: -1, col: -1, owner: 0 },
        { side: 'top', row: -1, col: 0, owner: 0 },
        { side: 'left', row: 0, col: -1, owner: 0 }
      ]
    };
    const playAnimationEvents = jest.fn(() => Promise.resolve());

    const { explodeBombUI, setUIImpl } = require('../game/special-effects/bombs.js');
    setUIImpl({ playAnimationEvents });
    await explodeBombUI(0, 0);

    expect(playAnimationEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'destroy',
        phase: 3,
        targets: expect.arrayContaining([
          expect.objectContaining({ r: -1, col: -1 }),
          expect.objectContaining({ r: -1, col: 0 }),
          expect.objectContaining({ r: 0, col: -1 }),
          expect.objectContaining({ r: 0, col: 0 })
        ])
      })
    ]);
  });
});
