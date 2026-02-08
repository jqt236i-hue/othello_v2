describe('special-effects bombs fallback animation batching', () => {
  beforeEach(() => {
    jest.resetModules();
    global.BLACK = 1;
    global.WHITE = -1;
    global.cardState = {
      markers: [
        { kind: 'bomb', row: 3, col: 3, owner: 'black', data: { remainingTurns: 0 } }
      ]
    };
    global.gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)) };
    global.PlaybackEngine = undefined; // force fallback path
  });

  test('explosion destroy animations are started in one batch', async () => {
    const calls = [];
    let active = 0;
    let maxConcurrent = 0;
    global.animateFadeOutAt = jest.fn((row, col) => {
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

    const { processBombs } = require('../game/special-effects/bombs');
    await processBombs([{
      type: 'bombs_exploded',
      details: {
        exploded: [{ row: 3, col: 3 }],
        destroyed: [{ row: 3, col: 3 }, { row: 3, col: 4 }, { row: 4, col: 3 }]
      }
    }]);

    expect(global.animateFadeOutAt).toHaveBeenCalledTimes(3);
    expect(calls).toEqual(expect.arrayContaining([[3, 3], [3, 4], [4, 3]]));
    expect(maxConcurrent).toBe(3);
  });
});

