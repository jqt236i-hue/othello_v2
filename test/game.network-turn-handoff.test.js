describe('network-turn-handoff', () => {
  beforeEach(() => {
    jest.resetModules();
    global.gameState = { currentPlayer: 'black', turnNumber: 4 };
    global.cardState = { pendingEffectByPlayer: { black: null, white: null } };
    global.waitForPlaybackIdle = jest.fn(() => Promise.resolve());
    global.isGameOver = jest.fn(() => false);
    global.showResult = jest.fn();
    global.NetworkMatchClient = null;
    delete global.CPU_TURN_DELAY_MS;
  });

  afterEach(() => {
    delete global.gameState;
    delete global.cardState;
    delete global.waitForPlaybackIdle;
    delete global.isGameOver;
    delete global.showResult;
    delete global.NetworkMatchClient;
    delete global.CPU_TURN_DELAY_MS;
  });

  test('turn start の playbackEvents を publish 前に連結する', async () => {
    const handoff = require('../game/network-turn-handoff');
    const publishSnapshot = jest.fn();
    const onTurnStart = jest.fn(async (currentPlayer) => {
      expect(currentPlayer).toBe('black');
      return {
        playbackEvents: [{ type: 'turn_start_draw', phase: 2 }]
      };
    });
    const afterTurnStart = jest.fn();

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3, turnIndex: 4 },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      onTurnStart,
      publishSnapshot,
      afterTurnStart,
      humanMode: true
    });

    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
    expect(onTurnStart).toHaveBeenCalledTimes(1);
    expect(afterTurnStart).toHaveBeenCalledWith(expect.objectContaining({
      playbackEvents: [{ type: 'flip', phase: 1 }, { type: 'turn_start_draw', phase: 2 }],
      turnStartPlaybackEvents: [{ type: 'turn_start_draw', phase: 2 }]
    }));
    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip', phase: 1 }, { type: 'turn_start_draw', phase: 2 }]
    }));
    expect(publishSnapshot.mock.calls[0][0].snapshot).toBeUndefined();
    expect(result).toMatchObject({ scheduledCpu: false, gameOver: false, nextPlayerKey: 'black' });
  });

  test('command publish では playbackEvents を保ちつつ snapshot を送らない', async () => {
    const handoff = require('../game/network-turn-handoff');
    const publishSnapshot = jest.fn();
    const snapshot = { gameState: { turnNumber: 4 }, cardState: { foo: 'bar' } };

    await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'white',
      actionType: 'reset_game',
      action: { type: 'reset_game', playerKey: 'white' },
      playbackEvents: [{ type: 'deal' }],
      snapshot,
      publishSnapshot,
      humanMode: true
    });

    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'white',
      actionType: 'reset_game',
      action: { type: 'reset_game', playerKey: 'white' },
      playbackEvents: [{ type: 'deal' }]
    }));
    expect(publishSnapshot.mock.calls[0][0].snapshot).toBeUndefined();
  });

  test('white 手番かつ humanMode=false なら CPU scheduling を行う', async () => {
    global.gameState = { currentPlayer: 'white', turnNumber: 12 };
    const handoff = require('../game/network-turn-handoff');
    const publishSnapshot = jest.fn();
    const scheduleCpuTurn = jest.fn();
    const setProcessing = jest.fn();

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip' }],
      publishSnapshot,
      scheduleCpuTurn,
      setProcessing,
      humanMode: false,
      cpuDelayMs: 321
    });

    expect(setProcessing).toHaveBeenCalledWith(true);
    expect(scheduleCpuTurn).toHaveBeenCalledWith({
      delayMs: 321,
      expectedTurnNumber: 12,
      nextPlayerKey: 'white'
    });
    expect(result).toMatchObject({ scheduledCpu: true, gameOver: false, nextPlayerKey: 'white' });
  });

  test('game over なら turn start や CPU scheduling を行わず結果表示と publish だけ行う', async () => {
    global.isGameOver = jest.fn(() => true);
    const handoff = require('../game/network-turn-handoff');
    const publishSnapshot = jest.fn();
    const onTurnStart = jest.fn();
    const scheduleCpuTurn = jest.fn();
    const setProcessing = jest.fn();

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3, turnIndex: 4 },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      publishSnapshot,
      onTurnStart,
      scheduleCpuTurn,
      setProcessing,
      resultOrder: 'beforePublish'
    });

    expect(onTurnStart).not.toHaveBeenCalled();
    expect(scheduleCpuTurn).not.toHaveBeenCalled();
    expect(global.showResult).toHaveBeenCalledTimes(1);
    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip', phase: 1 }]
    }));
    expect(publishSnapshot.mock.calls[0][0].snapshot).toBeUndefined();
    expect(setProcessing).toHaveBeenCalledWith(false);
    expect(result).toMatchObject({ gameOver: true, scheduledCpu: false, nextPlayerKey: 'black' });
  });
});