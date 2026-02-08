require('../game/turn-manager');

describe('turn-manager scheduling', () => {
  beforeEach(() => {
    // minimal state
    global.timers = null;
    global.isCardAnimating = false;
    global.isProcessing = false;
    global.BLACK = 1; global.WHITE = -1;
    global.gameState = { currentPlayer: global.BLACK };
    global.cardState = { pendingEffectByPlayer: {} };
    global.getActiveProtectionForPlayer = jest.fn(() => []);
    global.getFlipBlockers = jest.fn(() => []);
    global.findMoveForCell = jest.fn((player, r, c, pending, protection, perma) => ({ row: r, col: c, flips: [] }));
    global.executeMove = jest.fn();
    global.playHandAnimation = (player, row, col, cb) => { global.isCardAnimating = true; cb(); };
  });

  afterEach(() => {
    delete global.timers;
    delete global.findMoveForCell;
    delete global.playHandAnimation;
    delete global.executeMove;
  });

  test('handleCellClick executes move immediately after hand animation callback', async () => {
    // Spy on internal timers module to ensure no settle-delay wait is used
    const timersModule = require('../game/timers');
    const spy = jest.spyOn(timersModule, 'waitMs').mockImplementation(() => Promise.resolve());

    const rm = require('../game/turn-manager');
    rm.handleCellClick(0, 0);
    expect(global.executeMove).toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
