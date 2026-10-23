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

  test('adopts a legacy timer identity without extending its deadline', () => {
    const rules = createRules();
    const timer = { limitSeconds: 'x', active: true, turnSeatKey: 'black', turnStartedAt: 100, turnDeadlineAt: 5100 };
    const room: any = { snapshot: { gameState: { currentPlayer: 1 } }, turnTimer: timer };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 2000 })).toEqual({ changed: false, replaced: false });
    expect(room.turnTimer).toBe(timer);
    expect(timer.limitSeconds).toBe(120);
    expect(timer.turnDeadlineAt).toBe(5100);
    expect((timer as any).turnIdentity).toBe('[null,null,null]');
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 3000, forceRestart: true }))
      .toEqual({ changed: false, replaced: false });
  });

  test('restarts when the turn owner changes, not on another input in that turn', () => {
    const rules = createRules();
    const room: any = { snapshot: { gameState: { currentPlayer: -1 } }, turnTimer: { limitSeconds: 3, active: true, turnSeatKey: 'black', turnStartedAt: 100, turnDeadlineAt: 3100 } };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 5000 })).toEqual({ changed: true, replaced: true });
    expect(room.turnTimer).toEqual({ limitSeconds: 3, active: true, turnSeatKey: 'white', turnStartedAt: 5000, turnDeadlineAt: 8000, turnIdentity: '[null,null,null]' });
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 6000, forceRestart: true })).toEqual({ changed: false, replaced: false });
    expect(room.turnTimer.turnDeadlineAt).toBe(8000);
  });

  test.each(['use_card', 'select_target', 'sub_placement', 'destroy_hand_card'])(
    '%s keeps the deadline even when the publisher requests forceRestart', (actionType) => {
      const rules = createRules();
      const room: any = { seed: 17, stateVersion: 1, snapshot: {
        gameState: { currentPlayer: 1, turnNumber: 4 }, cardState: { turnIndex: 5 }, actionType
      } };
      room.turnTimer = rules.createActiveTurnTimer(room, 1000);
      const timer = room.turnTimer;
      // Inputs replace snapshots and advance stateVersion, but not the canonical turn.
      room.stateVersion++;
      room.snapshot = JSON.parse(JSON.stringify(room.snapshot));
      expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 111000, forceRestart: true }))
        .toEqual({ changed: false, replaced: false });
      expect(room.turnTimer).toBe(timer);
      expect(rules.toPublicTurnTimer(room, 111000).remainingMs).toBe(10000);
      expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 122000, forceRestart: true }))
        .toEqual({ changed: false, replaced: false });
      expect(rules.toPublicTurnTimer(room, 122000).remainingMs).toBe(0);
    }
  );

  test.each([
    ['相手の自動パスで同じ席へ戻る', 2],
    ['時間停止で同じ席が連続手番になる', 1]
  ])('%s場合は新しい手番に満額を付与する', (_reason, completedTurns) => {
    const rules = createRules();
    const room: any = { seed: 17, snapshot: {
      gameState: { currentPlayer: 1, turnNumber: 4 }, cardState: { turnIndex: 5 }
    } };
    room.turnTimer = rules.createActiveTurnTimer(room, 1000);
    const previousIdentity = room.turnTimer.turnIdentity;
    room.snapshot.gameState.turnNumber += Number(completedTurns);
    room.snapshot.cardState.turnIndex += Number(completedTurns);
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 111000, forceRestart: true }))
      .toEqual({ changed: true, replaced: true });
    expect(room.turnTimer.turnSeatKey).toBe('black');
    expect(room.turnTimer.turnStartedAt).toBe(111000);
    expect(room.turnTimer.turnDeadlineAt).toBe(231000);
    expect(room.turnTimer.turnIdentity).not.toBe(previousIdentity);
  });

  test.each(['turnNumber', 'turnIndex'])('%sだけが存在する状態でも同色の新手番を識別する', (field) => {
    const rules = createRules();
    const room: any = { seed: 17, snapshot: { gameState: { currentPlayer: 1 }, cardState: {} } };
    const state = field === 'turnNumber' ? room.snapshot.gameState : room.snapshot.cardState;
    state[field] = 4;
    room.turnTimer = rules.createActiveTurnTimer(room, 1000);
    state[field]++;
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 111000 }))
      .toEqual({ changed: true, replaced: true });
    expect(room.turnTimer.turnDeadlineAt).toBe(231000);
  });

  test.each(['reset_game', 'rematch'])('%sは同じ先手・同じ開始手番番号でも必ず満額で開始する', () => {
    const rules = createRules();
    const room: any = { seed: 17, snapshot: {
      gameState: { currentPlayer: 1, turnNumber: 0 }, cardState: { turnIndex: 1 }
    } };
    room.turnTimer = rules.createActiveTurnTimer(room, 1000);
    // These counters can equal the old opening turn. The authority replaces room.seed
    // with the new match seed before refreshing the timer on reset/rematch.
    room.seed = 111000;
    room.snapshot = { gameState: { currentPlayer: 1, turnNumber: 0 }, cardState: { turnIndex: 1 } };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 111000, forceRestart: true }))
      .toEqual({ changed: true, replaced: true });
    expect(room.turnTimer.turnDeadlineAt).toBe(231000);
    expect(room.turnTimer.turnIdentity).toBe('[111000,0,1]');
  });

  test('再戦で手番番号が初期値へ戻り前局の最後と同じ席でも満額を付与する', () => {
    const rules = createRules();
    const room: any = { seed: 17, snapshot: {
      gameState: { currentPlayer: 1, turnNumber: 60 }, cardState: { turnIndex: 61 }
    } };
    room.turnTimer = rules.createActiveTurnTimer(room, 1000);
    room.seed = 111000;
    room.snapshot = { gameState: { currentPlayer: 1, turnNumber: 0 }, cardState: { turnIndex: 1 } };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 111000, forceRestart: true }))
      .toEqual({ changed: true, replaced: true });
    expect(room.turnTimer.turnDeadlineAt).toBe(231000);
  });

  test('保存・再読み込み後も手番識別を維持し、次の同色手番だけ時計を戻す', () => {
    const rules = createRules();
    const room: any = { seed: 17, snapshot: {
      gameState: { currentPlayer: 1, turnNumber: 4 }, cardState: { turnIndex: 5 }
    } };
    room.turnTimer = rules.createActiveTurnTimer(room, 1000);
    const restored = JSON.parse(JSON.stringify(room));
    expect(rules.applyTurnTimerRefresh(restored, { shouldBeActive: true, nowMs: 111000, forceRestart: true }))
      .toEqual({ changed: false, replaced: false });
    expect(restored.turnTimer.turnDeadlineAt).toBe(121000);
    expect(rules.toPublicTurnTimer(restored, 111000)).not.toHaveProperty('turnIdentity');
    restored.snapshot.cardState.turnIndex++;
    restored.snapshot.gameState.turnNumber++;
    expect(rules.applyTurnTimerRefresh(restored, { shouldBeActive: true, nowMs: 112000 }))
      .toEqual({ changed: true, replaced: true });
    expect(restored.turnTimer.turnDeadlineAt).toBe(232000);
  });

  test('a paused timer starts with a full allowance when both seats return', () => {
    const rules = createRules();
    const room: any = { snapshot: { gameState: { currentPlayer: 1 } }, turnTimer: rules.createPausedTurnTimer(null) };
    expect(rules.applyTurnTimerRefresh(room, { shouldBeActive: true, nowMs: 5000, forceRestart: true }))
      .toEqual({ changed: true, replaced: true });
    expect(room.turnTimer.turnDeadlineAt).toBe(125000);
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
