import { createMatchTurnTimerRules } from '../utils/match-turn-timer-rules';
import { normalizeNetworkTurnLimitSeconds } from '../shared/network-contract';

function createRules() {
  return createMatchTurnTimerRules({
    defaultLimitSeconds: 120,
    normalizeLimitSeconds: normalizeNetworkTurnLimitSeconds,
    resolveTurnSeatKey: (room: any) => (room && room.snapshot && room.snapshot.gameState && room.snapshot.gameState.currentPlayer === -1 ? 'white' : 'black'),
    parseSeatKeyOptional: (value: unknown) => (value === 'black' || value === 'white' ? String(value) : null),
    now: () => 9999
  });
}

describe('shared match turn-timer rules', () => {
  test('pauses the timer when it should not run and reports a replacement', () => {
    const rules = createRules();
    const room: any = { snapshot: { gameState: { currentPlayer: 1 } }, turnTimer: { limitSeconds: 30, active: true, turnSeatKey: 'black', turnStartedAt: 1, turnDeadlineAt: 30001 } };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: false })).toEqual({ changed: true, replaced: true });
    expect(room.turnTimer).toEqual({ limitSeconds: 30, active: false, turnSeatKey: 'black', turnStartedAt: null, turnDeadlineAt: null });
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: false })).toEqual({ changed: false, replaced: true });
  });

  test('keeps a running timer for the same seat and only refreshes its limit', () => {
    const rules = createRules();
    const timer = { limitSeconds: 'x', active: true, turnSeatKey: 'black', turnStartedAt: 100, turnDeadlineAt: 5100 };
    const room: any = { snapshot: { gameState: { currentPlayer: 1 } }, turnTimer: timer };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 2000 })).toEqual({ changed: false, replaced: false });
    expect(room.turnTimer).toBe(timer);
    expect(timer.limitSeconds).toBe(120);
    expect(timer.turnDeadlineAt).toBe(5100);
  });

  test('restarts for a new seat or on forceRestart', () => {
    const rules = createRules();
    const room: any = { snapshot: { gameState: { currentPlayer: -1 } }, turnTimer: { limitSeconds: 3, active: true, turnSeatKey: 'black', turnStartedAt: 100, turnDeadlineAt: 3100 } };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 5000 })).toEqual({ changed: true, replaced: true });
    expect(room.turnTimer).toEqual({ limitSeconds: 3, active: true, turnSeatKey: 'white', turnStartedAt: 5000, turnDeadlineAt: 8000 });
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 6000, forceRestart: true })).toEqual({ changed: true, replaced: true });
    expect(room.turnTimer.turnDeadlineAt).toBe(9000);
  });

  test('public timer exposes remaining time only while active', () => {
    const rules = createRules();
    const active: any = { turnTimer: { limitSeconds: 3, active: true, turnSeatKey: 'white', turnStartedAt: 1000, turnDeadlineAt: 4000 } };
    expect(rules.toPublicTurnTimer(active, 5000)).toEqual({ limitSeconds: 3, active: true, turnSeatKey: 'white', turnStartedAt: 1000, turnDeadlineAt: 4000, remainingMs: 0 });
    expect(rules.toPublicTurnTimer(active, undefined).remainingMs).toBe(0);
    const paused: any = { snapshot: { gameState: { currentPlayer: -1 } }, turnTimer: { limitSeconds: 5, active: false, turnStartedAt: 1, turnDeadlineAt: 2 } };
    expect(rules.toPublicTurnTimer(paused, 0)).toEqual({ limitSeconds: 5, active: false, turnSeatKey: 'white', turnStartedAt: null, turnDeadlineAt: null, remainingMs: null });
  });
});
