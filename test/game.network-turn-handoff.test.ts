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

  test('turn start の playbackEvents を publish 前に後続 phase へずらして連結する', async () => {
    const handoff = require('../game/network-turn-handoff.js');
    const publishSnapshot = jest.fn();
    const onTurnStart = jest.fn(async (currentPlayer) => {
      expect(currentPlayer).toBe('black');
      return {
        playbackEvents: [{ type: 'turn_start_draw', phase: 1 }]
      };
    });
    const afterTurnStart = jest.fn();

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3, turnIndex: 4 },
      playbackEvents: [{ type: 'flip', phase: 1 }, { type: 'sound_effect', phase: 2 }],
      onTurnStart,
      publishSnapshot,
      afterTurnStart,
      humanMode: true
    });

    expect(global.waitForPlaybackIdle).toHaveBeenCalledTimes(1);
    expect(onTurnStart).toHaveBeenCalledTimes(1);
    expect(afterTurnStart).toHaveBeenCalledWith(expect.objectContaining({
      playbackEvents: [{ type: 'flip', phase: 1 }, { type: 'sound_effect', phase: 2 }, { type: 'turn_start_draw', phase: 3 }],
      turnStartPlaybackEvents: [{ type: 'turn_start_draw', phase: 1 }]
    }));
    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip', phase: 1 }, { type: 'sound_effect', phase: 2 }, { type: 'turn_start_draw', phase: 3 }]
    }));
    expect(publishSnapshot.mock.calls[0][0].snapshot).toBeUndefined();
    expect(result).toMatchObject({ scheduledCpu: false, gameOver: false, nextPlayerKey: 'black' });
  });

  test('turn start が自動終了した場合は次プレイヤーの turn start まで進める', async () => {
    const handoff = require('../game/network-turn-handoff.js');
    const publishSnapshot = jest.fn();
    const onTurnStart = jest.fn(async (currentPlayer) => {
      if (currentPlayer === 'black') {
        global.gameState.currentPlayer = 'white';
        return {
          stopAction: true,
          playbackEvents: [{ type: 'turn_start_auto_end', phase: 1 }]
        };
      }
      return {
        playbackEvents: [{ type: 'white_turn_start', phase: 1 }]
      };
    });

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'white',
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3, turnIndex: 4 },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      onTurnStart,
      publishSnapshot,
      humanMode: true
    });

    expect(onTurnStart).toHaveBeenCalledTimes(2);
    expect(onTurnStart).toHaveBeenNthCalledWith(1, 'black');
    expect(onTurnStart).toHaveBeenNthCalledWith(2, 'white');
    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playbackEvents: [
        { type: 'flip', phase: 1 },
        { type: 'turn_start_auto_end', phase: 2 },
        { type: 'white_turn_start', phase: 3 }
      ]
    }));
    expect(result).toMatchObject({ scheduledCpu: false, gameOver: false, nextPlayerKey: 'white' });
  });

  test('command publish では playbackEvents を保ちつつ snapshot を送らない', async () => {
    const handoff = require('../game/network-turn-handoff.js');
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

  test('publishSnapshot 未注入時は root NetworkMatchClient に fallback しない', async () => {
    const handoff = require('../game/network-turn-handoff.js');
    const rootPublishSnapshot = jest.fn();
    global.NetworkMatchClient = {
      isActive: () => true,
      publishSnapshot: rootPublishSnapshot
    };

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3, turnIndex: 4 },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      humanMode: true
    });

    expect(rootPublishSnapshot).not.toHaveBeenCalled();
    expect(result).toMatchObject({ ok: true, scheduledCpu: false });
  });

  test('white 手番かつ humanMode=false なら CPU scheduling を行う', async () => {
    global.gameState = { currentPlayer: 'white', turnNumber: 12 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: { black: null, white: null }
    };
    const handoff = require('../game/network-turn-handoff.js');
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

  test('scheduleCpuTurn が false を返したら processing を戻して human handoff 扱いにする', async () => {
    global.gameState = { currentPlayer: 'white', turnNumber: 12 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: { black: null, white: null }
    };
    const handoff = require('../game/network-turn-handoff.js');
    const publishSnapshot = jest.fn();
    const scheduleCpuTurn = jest.fn(() => false);
    const setProcessing = jest.fn();
    const onHumanTurnReady = jest.fn();

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip' }],
      publishSnapshot,
      scheduleCpuTurn,
      setProcessing,
      onHumanTurnReady,
      humanMode: false,
      cpuDelayMs: 321
    });

    expect(setProcessing).toHaveBeenNthCalledWith(1, true);
    expect(setProcessing).toHaveBeenNthCalledWith(2, false);
    expect(onHumanTurnReady).toHaveBeenCalledWith({ nextPlayerKey: 'white', scheduledCpu: false });
    expect(result).toMatchObject({ scheduledCpu: false, gameOver: false, nextPlayerKey: 'white' });
  });

  test('scheduleCpuTurn が例外を投げたら processing を戻して再送出する', async () => {
    global.gameState = { currentPlayer: 'white', turnNumber: 12 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: { black: null, white: null }
    };
    const handoff = require('../game/network-turn-handoff.js');
    const publishSnapshot = jest.fn();
    const scheduleCpuTurn = jest.fn(() => {
      throw new Error('scheduler blew up');
    });
    const setProcessing = jest.fn();

    await expect(handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      playbackEvents: [{ type: 'flip' }],
      publishSnapshot,
      scheduleCpuTurn,
      setProcessing,
      humanMode: false,
      cpuDelayMs: 321
    })).rejects.toThrow('scheduler blew up');

    expect(setProcessing).toHaveBeenNthCalledWith(1, true);
    expect(setProcessing).toHaveBeenNthCalledWith(2, false);
  });

  test('FATE_WILL で人間が white 手番を代理操作する時は CPU scheduling を行わない', async () => {
    global.gameState = { currentPlayer: 'white', turnNumber: 12 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: { black: null, white: 'black' }
    };
    const handoff = require('../game/network-turn-handoff.js');
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

    expect(setProcessing).toHaveBeenCalledWith(false);
    expect(scheduleCpuTurn).not.toHaveBeenCalled();
    expect(result).toMatchObject({ scheduledCpu: false, gameOver: false, nextPlayerKey: 'white' });
  });

  test('FATE_WILL で white CPU が black 手番を代理操作する時は black 手番として CPU scheduling する', async () => {
    global.gameState = { currentPlayer: 'black', turnNumber: 13 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: { black: 'white', white: null }
    };
    const handoff = require('../game/network-turn-handoff.js');
    const publishSnapshot = jest.fn();
    const scheduleCpuTurn = jest.fn();
    const setProcessing = jest.fn();

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [{ type: 'flip' }],
      publishSnapshot,
      scheduleCpuTurn,
      setProcessing,
      humanMode: false,
      cpuDelayMs: 222
    });

    expect(setProcessing).toHaveBeenCalledWith(true);
    expect(scheduleCpuTurn).toHaveBeenCalledWith({
      delayMs: 222,
      expectedTurnNumber: 13,
      nextPlayerKey: 'black'
    });
    expect(result).toMatchObject({ scheduledCpu: true, gameOver: false, nextPlayerKey: 'black' });
  });

  test('game over なら turn start や CPU scheduling を行わず結果表示と publish だけ行う', async () => {
    global.isGameOver = jest.fn(() => true);
    const handoff = require('../game/network-turn-handoff.js');
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

  test('full board with pending escape explosion defers result until turn start', async () => {
    const rowA = [1, -1, 1, -1, 1, -1, 1, -1];
    const rowB = rowA.slice().reverse();
    global.gameState = {
      currentPlayer: 'white',
      turnNumber: 20,
      consecutivePasses: 0,
      board: [rowA.slice(), rowB.slice(), rowA.slice(), rowB.slice(), rowA.slice(), rowB.slice(), rowA.slice(), rowB.slice()]
    };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      markers: [
        {
          kind: 'specialStone',
          row: 3,
          col: 3,
          owner: 'black',
          data: { type: 'ESCAPE_HYPERACTIVE', remainingOwnerTurns: 5 }
        }
      ]
    };
    global.isGameOver = jest.fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    const handoff = require('../game/network-turn-handoff.js');
    const publishSnapshot = jest.fn();
    const onTurnStart = jest.fn(async () => ({
      playbackEvents: [{ type: 'escape_explosion', phase: 1 }]
    }));

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', row: 7, col: 7, turnIndex: 20 },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      publishSnapshot,
      onTurnStart,
      humanMode: true
    });

    expect(onTurnStart).toHaveBeenCalledTimes(1);
    expect(global.showResult).not.toHaveBeenCalled();
    expect(publishSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      playbackEvents: [{ type: 'flip', phase: 1 }, { type: 'escape_explosion', phase: 2 }]
    }));
    expect(result).toMatchObject({ gameOver: false, scheduledCpu: false, nextPlayerKey: 'white' });
  });

  test('awaitPublishResult 有効時は publish failure を返して CPU scheduling を進めない', async () => {
    global.gameState = { currentPlayer: 'white', turnNumber: 12 };
    global.cardState = {
      pendingEffectByPlayer: { black: null, white: null },
      fateWillControllerByTurnOwner: { black: null, white: null }
    };
    const handoff = require('../game/network-turn-handoff.js');
    const publishSnapshot = jest.fn(() => Promise.resolve({ ok: false, reason: 'OUT_OF_TURN' }));
    const onPublishFailed = jest.fn();
    const scheduleCpuTurn = jest.fn();
    const setProcessing = jest.fn();
    const onHumanTurnReady = jest.fn();

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'black',
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3, turnIndex: 12 },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      publishSnapshot,
      onPublishFailed,
      awaitPublishResult: true,
      scheduleCpuTurn,
      setProcessing,
      onHumanTurnReady,
      humanMode: false,
      cpuDelayMs: 321
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'network_publish_failed',
      result: { ok: false, reason: 'OUT_OF_TURN' },
      scheduledCpu: false
    });
    expect(onPublishFailed).toHaveBeenCalledWith(expect.objectContaining({
      reason: 'network_publish_failed',
      publishResult: { ok: false, reason: 'OUT_OF_TURN' }
    }));
    expect(scheduleCpuTurn).not.toHaveBeenCalled();
    expect(onHumanTurnReady).not.toHaveBeenCalled();
    expect(setProcessing).toHaveBeenCalledWith(false);
  });

  test('perf scope separates network continuation sync slices from Promise waits without leaking into publish data', async () => {
    const handoff = require('../game/network-turn-handoff.js');
    const performance = require('../game/cpu-turn-performance');
    const entries: any[] = [];
    let nowMs = 10;
    const performanceScope = performance.createCpuTurnPerformanceScope({
      recorder: (entry: any) => entries.push(entry),
      correlationId: 'cpu-network-1',
      runId: 3,
      playerKey: 'white',
      level: 1,
      readNowMs: () => ++nowMs
    });
    const publishSnapshot = jest.fn(async () => ({ ok: true }));

    await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'white',
      actionType: 'place',
      action: { type: 'place', row: 2, col: 3 },
      playbackEvents: [{ type: 'flip', phase: 1 }],
      onTurnStart: async () => ({ playbackEvents: [] }),
      afterTurnStart: async () => undefined,
      publishSnapshot,
      humanMode: true,
      performanceScope
    });

    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ stage: 'canonical-commit', kind: 'sync' }),
      expect.objectContaining({ stage: 'presentation-handoff', kind: 'sync' }),
      expect.objectContaining({ stage: 'presentation-handoff', kind: 'wait' })
    ]));
    expect(JSON.stringify(publishSnapshot.mock.calls)).not.toContain('performanceScope');
    expect(JSON.stringify(publishSnapshot.mock.calls)).not.toContain('cpu-network-1');
  });

  test('records a swallowed playback wait rejection as an error outcome', async () => {
    const handoff = require('../game/network-turn-handoff');
    const performance = require('../game/cpu-turn-performance');
    const entries: any[] = [];
    let nowMs = 20;
    global.waitForPlaybackIdle = jest.fn(() => Promise.reject(new Error('playback wait failed')));
    const performanceScope = performance.createCpuTurnPerformanceScope({
      recorder: (entry: any) => entries.push(entry),
      correlationId: 'cpu-network-wait-error',
      runId: 4,
      playerKey: 'white',
      level: 1,
      readNowMs: () => ++nowMs
    });

    const result = await handoff.finalizeNetworkTurnHandoff({
      playerKey: 'white',
      actionType: 'place',
      playbackEvents: [{ type: 'flip', phase: 1 }],
      publishSnapshot: jest.fn(async () => ({ ok: true })),
      humanMode: true,
      performanceScope
    });

    expect(result.ok).toBe(true);
    expect(entries).toEqual(expect.arrayContaining([
      expect.objectContaining({
        stage: 'presentation-handoff',
        kind: 'wait',
        outcome: 'error'
      })
    ]));
  });
});
