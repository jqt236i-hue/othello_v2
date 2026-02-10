jest.useFakeTimers();

describe('presentation handler CPU scheduling', () => {
  test('SCHEDULE_CPU_TURN uses UIBootstrap registered processCpuTurn when available', async () => {
    // Mock bootstrap to expose processCpuTurn
    const mockProc = jest.fn();
    jest.resetModules();
    jest.doMock('../ui/bootstrap', () => ({ getRegisteredUIGlobals: () => ({ processCpuTurn: mockProc }) }));

    const ph = require('../ui/presentation-handler');

    ph.handlePresentationEvent({ type: 'SCHEDULE_CPU_TURN', delayMs: 0 });

    // Fast-forward timers
    jest.runAllTimers();

    expect(mockProc).toHaveBeenCalled();
  });

  test('SCHEDULE_CPU_TURN skips stale callback when expected player/turn mismatch', async () => {
    const mockProc = jest.fn();
    jest.resetModules();
    jest.doMock('../ui/bootstrap', () => ({ getRegisteredUIGlobals: () => ({ processCpuTurn: mockProc }) }));

    global.WHITE = -1;
    global.BLACK = 1;
    global.gameState = { currentPlayer: 1, turnNumber: 10 };

    const ph = require('../ui/presentation-handler');
    ph.handlePresentationEvent({
      type: 'SCHEDULE_CPU_TURN',
      delayMs: 0,
      expectedPlayerKey: 'white',
      expectedTurnNumber: 9
    });

    jest.runAllTimers();
    expect(mockProc).not.toHaveBeenCalled();
  });
});
