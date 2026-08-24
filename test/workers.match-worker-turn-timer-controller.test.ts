import { createMatchWorkerTurnTimerController } from '../workers/match-worker-turn-timer-controller';
import { createMatchWorkerTurnTimerHelpers } from '../workers/match-worker-turn-timer';

function createTimerHelpers() {
  return createMatchWorkerTurnTimerHelpers({
    limitSeconds: 120,
    resolveTurnSeatKey: (room) => {
      const gameState = room && room.snapshot && typeof room.snapshot === 'object'
        ? (room.snapshot as any).gameState
        : null;
      return gameState && gameState.currentPlayer === -1 ? 'white' : 'black';
    },
    parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
    asRecord: (value) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
    normalizeLimitSeconds: (value, fallback) => {
      const numeric = Number(value);
      return Math.max(3, Math.min(1800, Number.isFinite(numeric) ? Math.trunc(numeric) : Number(fallback) || 120));
    }
  });
}

describe('match worker turn timer controller', () => {
  test('syncTurnTimerAlarm schedules active deadlines and clears paused timers', async () => {
    const room: any = {
      snapshot: { gameState: { currentPlayer: 1 } },
      turnTimer: { active: true, turnDeadlineAt: 9999 }
    };
    let setAlarmArg: any = null;
    let deleteAlarmCount = 0;
    const helpers = createTimerHelpers();
    const controller = createMatchWorkerTurnTimerController({
      getRoom: () => room,
      getStorage: () => ({
        get: async () => null,
        put: async () => undefined,
        delete: async () => true,
        setAlarm: async (when) => { setAlarmArg = when; },
        deleteAlarm: async () => { deleteAlarmCount += 1; }
      }),
      loadCoreLogicModule: async () => ({ isGameOver: () => false }),
      hasTwoActiveSeats: () => true,
      resolveTurnSeatKey: (currentRoom) => ((currentRoom as any).snapshot.gameState.currentPlayer === -1 ? 'white' : 'black'),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      createPausedTurnTimer: helpers.createPausedTurnTimer,
      createActiveTurnTimer: helpers.createActiveTurnTimer,
      areTurnTimersEqual: helpers.areTurnTimersEqual
    });

    await expect(controller.syncTurnTimerAlarm()).resolves.toBe(true);
    expect(setAlarmArg).toBe(9999);

    room.turnTimer = { active: false, turnDeadlineAt: null };
    await expect(controller.syncTurnTimerAlarm()).resolves.toBe(true);
    expect(deleteAlarmCount).toBe(1);
  });

  test('refreshTurnTimer activates when both seats are active and pauses when game is over', async () => {
    const room: any = {
      snapshot: { gameState: { currentPlayer: 1 } },
      turnTimer: { active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null }
    };
    const helpers = createTimerHelpers();
    let gameOver = false;
    let setAlarmArg: any = null;
    let deleteAlarmCount = 0;
    const controller = createMatchWorkerTurnTimerController({
      getRoom: () => room,
      getStorage: () => ({
        get: async () => null,
        put: async () => undefined,
        delete: async () => true,
        setAlarm: async (when) => { setAlarmArg = when; },
        deleteAlarm: async () => { deleteAlarmCount += 1; }
      }),
      loadCoreLogicModule: async () => ({ isGameOver: () => gameOver }),
      hasTwoActiveSeats: () => true,
      resolveTurnSeatKey: (currentRoom) => ((currentRoom as any).snapshot.gameState.currentPlayer === -1 ? 'white' : 'black'),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      createPausedTurnTimer: helpers.createPausedTurnTimer,
      createActiveTurnTimer: helpers.createActiveTurnTimer,
      areTurnTimersEqual: helpers.areTurnTimersEqual
    });

    await expect(controller.refreshTurnTimer({ nowMs: 5000, forceRestart: false })).resolves.toBe(true);
    expect(room.turnTimer).toMatchObject({
      active: true,
      turnSeatKey: 'black',
      turnStartedAt: 5000,
      turnDeadlineAt: 125000
    });
    expect(setAlarmArg).toBe(125000);

    gameOver = true;
    await expect(controller.refreshTurnTimer({ nowMs: 6000, forceRestart: false })).resolves.toBe(true);
    expect(room.turnTimer).toMatchObject({
      active: false,
      turnSeatKey: 'black',
      turnStartedAt: null,
      turnDeadlineAt: null
    });
    expect(deleteAlarmCount).toBe(1);
  });

  test('refreshTurnTimer keeps an already-active same-seat timer without restart', async () => {
    const room: any = {
      snapshot: { gameState: { currentPlayer: 1 } },
      turnTimer: { active: true, turnSeatKey: 'black', turnStartedAt: 10, turnDeadlineAt: 20, limitSeconds: 1 }
    };
    const helpers = createTimerHelpers();
    const controller = createMatchWorkerTurnTimerController({
      getRoom: () => room,
      getStorage: () => ({
        get: async () => null,
        put: async () => undefined,
        delete: async () => true,
        setAlarm: async () => undefined,
        deleteAlarm: async () => undefined
      }),
      loadCoreLogicModule: async () => ({ isGameOver: () => false }),
      hasTwoActiveSeats: () => true,
      resolveTurnSeatKey: (currentRoom) => ((currentRoom as any).snapshot.gameState.currentPlayer === -1 ? 'white' : 'black'),
      parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
      createPausedTurnTimer: helpers.createPausedTurnTimer,
      createActiveTurnTimer: helpers.createActiveTurnTimer,
      areTurnTimersEqual: helpers.areTurnTimersEqual
    });

    await expect(controller.refreshTurnTimer({ nowMs: 5000, forceRestart: false })).resolves.toBe(false);
    expect(room.turnTimer.limitSeconds).toBe(3);
    expect(room.turnTimer.turnStartedAt).toBe(10);
    expect(room.turnTimer.turnDeadlineAt).toBe(20);
  });
});
