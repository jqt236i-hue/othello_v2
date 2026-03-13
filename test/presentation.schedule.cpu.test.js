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

  test('PLAYBACK_EVENTS card_use_animation triggers enemy-card commentary', async () => {
    jest.resetModules();
    const requestCommentaryMock = jest.fn(async () => 'うるさいぞ！');
    jest.doMock('../game/ai/cpu-commentary-runtime', () => ({
      requestCommentary: requestCommentaryMock
    }));

    global.gameState = {
      turnNumber: 7,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.gameState.board[3][3] = 1;
    global.gameState.board[3][4] = -1;
    global.addLog = jest.fn();

    const ph = require('../ui/presentation-handler');
    await ph.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{
        type: 'card_use_animation',
        phase: 1,
        targets: [{ owner: 'black', cardId: 'swap_01', cost: 17, name: '交換の意志' }]
      }]
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(requestCommentaryMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'card_used_by_enemy',
      playerKey: 'white',
      cardId: 'swap_01'
    }));
    expect(global.addLog).toHaveBeenCalledWith('白CPU: うるさいぞ！');
  });

  test('PLAYBACK_EVENTS enemy ownerの大文字と空白を正規化してcommentaryを発火する', async () => {
    jest.resetModules();
    const requestCommentaryMock = jest.fn(async () => 'まだだ！');
    jest.doMock('../game/ai/cpu-commentary-runtime', () => ({
      requestCommentary: requestCommentaryMock
    }));

    global.gameState = {
      turnNumber: 8,
      board: Array.from({ length: 8 }, () => Array(8).fill(0))
    };
    global.addLog = jest.fn();

    const ph = require('../ui/presentation-handler');
    await ph.handlePresentationEvent({
      type: 'PLAYBACK_EVENTS',
      events: [{
        type: 'card_use_animation',
        phase: 1,
        targets: [{ owner: ' BLACK ', cardId: 'swap_02', cost: 17, name: '交換の意志' }]
      }]
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(requestCommentaryMock).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'card_used_by_enemy',
      playerKey: 'white',
      cardId: 'swap_02'
    }));
    expect(global.addLog).toHaveBeenCalledWith('白CPU: まだだ！');
  });
});
