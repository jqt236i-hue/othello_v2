import { createMatchWorkerTurnTimerHelpers } from '../workers/match-worker-turn-timer';

function createHelpers() {
  let currentTime = 1000;
  return createMatchWorkerTurnTimerHelpers({
    limitSeconds: 120,
    limitMs: 120000,
    resolveTurnSeatKey: (room) => {
      const gameState = room && room.snapshot && typeof room.snapshot === 'object'
        ? (room.snapshot as any).gameState
        : null;
      return gameState && gameState.currentPlayer === -1 ? 'white' : 'black';
    },
    parseSeatKeyOptional: (value) => (value === 'black' || value === 'white' ? String(value) : null),
    asRecord: (value) => (value && typeof value === 'object' ? value as Record<string, unknown> : {}),
    now: () => currentTime++
  });
}

describe('match worker turn timer helpers', () => {
  test('paused/active timer objects follow the current turn seat and fixed limit', () => {
    const helpers = createHelpers();
    const room = {
      snapshot: {
        gameState: { currentPlayer: -1 }
      }
    } as any;

    expect(helpers.createPausedTurnTimer(room)).toEqual({
      limitSeconds: 120,
      active: false,
      turnSeatKey: 'white',
      turnStartedAt: null,
      turnDeadlineAt: null
    });

    expect(helpers.createActiveTurnTimer(room, 5000)).toEqual({
      limitSeconds: 120,
      active: true,
      turnSeatKey: 'white',
      turnStartedAt: 5000,
      turnDeadlineAt: 125000
    });
  });

  test('areTurnTimersEqual compares normalized timer values', () => {
    const helpers = createHelpers();

    expect(helpers.areTurnTimersEqual(
      { active: true, turnSeatKey: 'black', turnStartedAt: 10, turnDeadlineAt: 20, limitSeconds: 120 },
      { active: true, turnSeatKey: 'black', turnStartedAt: 10, turnDeadlineAt: 20, limitSeconds: 120 }
    )).toBe(true);

    expect(helpers.areTurnTimersEqual(
      { active: true, turnSeatKey: 'black', turnStartedAt: 10, turnDeadlineAt: 20, limitSeconds: 120 },
      { active: true, turnSeatKey: 'white', turnStartedAt: 10, turnDeadlineAt: 20, limitSeconds: 120 }
    )).toBe(false);
  });

  test('toPublicTurnTimer exposes remainingMs only for active timers', () => {
    const helpers = createHelpers();
    const activeRoom = {
      snapshot: { gameState: { currentPlayer: 1 } },
      turnTimer: {
        active: true,
        turnSeatKey: 'black',
        turnStartedAt: 100,
        turnDeadlineAt: 400
      }
    } as any;
    const pausedRoom = {
      snapshot: { gameState: { currentPlayer: -1 } },
      turnTimer: {
        active: false,
        turnSeatKey: 'white',
        turnStartedAt: 100,
        turnDeadlineAt: 400
      }
    } as any;

    expect(helpers.toPublicTurnTimer(activeRoom, 250)).toEqual({
      limitSeconds: 120,
      active: true,
      turnSeatKey: 'black',
      turnStartedAt: 100,
      turnDeadlineAt: 400,
      remainingMs: 150
    });

    expect(helpers.toPublicTurnTimer(pausedRoom, 250)).toEqual({
      limitSeconds: 120,
      active: false,
      turnSeatKey: 'white',
      turnStartedAt: null,
      turnDeadlineAt: null,
      remainingMs: null
    });
  });
});
