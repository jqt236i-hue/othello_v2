describe('NetworkTurnTimerController', () => {
  let controller: any;
  let stateObj: any;
  let syncLatestState: any;

  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
    jest.setSystemTime(1000);

    syncLatestState = jest.fn(() => Promise.resolve({ ok: true }));
    stateObj = {
      active: true,
      roomId: 'ABC',
      seatKey: 'black',
      seatToken: 'seat_token',
      turnTimer: {
        limitSeconds: 120,
        active: false,
        turnSeatKey: 'black',
        turnStartedAt: null,
        turnDeadlineAt: null
      },
      turnTimerListener: null,
      turnTimerTickHandle: 0,
      turnTimerSyncRequestedDeadline: null,
      serverTimeOffsetMs: 0,
      heartbeatResyncInFlight: false
    };

    const { createNetworkTurnTimerController } = require('../ui/network/turn-timer.js');
    controller = createNetworkTurnTimerController({
      getState: () => stateObj,
      normalizePlayerKey: (value: any) => (String(value || '').trim().toLowerCase() === 'white' ? 'white' : 'black'),
      defaultLimitSeconds: 120,
      scheduleTimeout: setTimeout,
      clearScheduledTimeout: clearTimeout,
      isActive: () => stateObj.active === true && !!stateObj.roomId,
      syncLatestState,
      now: () => Date.now()
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('listener registration emits normalized timer info immediately', () => {
    const listener = jest.fn();

    controller.setTurnTimerListener(listener);

    expect(listener).toHaveBeenCalledWith({
      limitSeconds: 120,
      active: false,
      turnSeatKey: 'black',
      turnStartedAt: null,
      turnDeadlineAt: null,
      remainingMs: null,
      isOwnTurn: false
    });
  });

  test('deadline change clears requested sync guard and updates remaining time', () => {
    stateObj.turnTimerSyncRequestedDeadline = 1500;

    controller.updateTurnTimerFromPayload({
      serverTime: 1000,
      turnTimer: {
        limitSeconds: 90,
        active: true,
        turnSeatKey: 'white',
        turnStartedAt: 500,
        turnDeadlineAt: 2000
      }
    });

    expect(stateObj.turnTimerSyncRequestedDeadline).toBeNull();
    expect(controller.getTurnTimerInfo()).toEqual({
      limitSeconds: 90,
      active: true,
      turnSeatKey: 'white',
      turnStartedAt: 500,
      turnDeadlineAt: 2000,
      remainingMs: 1000,
      isOwnTurn: false
    });
  });

  test('timeout-driven resync runs once per deadline', async () => {
    controller.updateTurnTimerFromPayload({
      serverTime: 1000,
      turnTimer: {
        limitSeconds: 120,
        active: true,
        turnSeatKey: 'black',
        turnStartedAt: 900,
        turnDeadlineAt: 1050
      }
    });

    jest.advanceTimersByTime(250);
    await Promise.resolve();
    expect(syncLatestState).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(syncLatestState).toHaveBeenCalledTimes(1);
    expect(stateObj.turnTimerSyncRequestedDeadline).toBe(1050);
  });

  test('reset clears timer state and server offset', () => {
    stateObj.serverTimeOffsetMs = 250;
    stateObj.turnTimer = {
      limitSeconds: 60,
      active: true,
      turnSeatKey: 'white',
      turnStartedAt: 800,
      turnDeadlineAt: 1800
    };

    controller.resetTurnTimerState();

    expect(controller.getTurnTimerInfo()).toEqual({
      limitSeconds: 120,
      active: false,
      turnSeatKey: 'black',
      turnStartedAt: null,
      turnDeadlineAt: null,
      remainingMs: null,
      isOwnTurn: false
    });
    expect(stateObj.serverTimeOffsetMs).toBe(0);
    expect(stateObj.turnTimerSyncRequestedDeadline).toBeNull();
  });
});
