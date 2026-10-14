import * as Core from '../game/logic/core.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';

function createCardState() {
  return {
    charge: { black: 0, white: 0 },
    chargeGainedTotal: { black: 0, white: 0 },
    chargeDeltaEvents: [],
    _nextChargeDeltaSeq: 1,
    presentationEvents: [],
    _presentationEventsPersist: [],
    pendingEffectByPlayer: { black: null, white: null },
    lastTurnStartedFor: null,
    markers: []
  };
}

function createTurnStartCardLogic() {
  return {
    onTurnStart: jest.fn(() => null),
    emitPresentationEvent: jest.fn((cardState, ev) => {
      cardState.presentationEvents.push(ev);
    })
  };
}

describe('round bonus', () => {
  test('same player consecutive completed turns do not advance the round until the opponent also completes one', () => {
    const gameState = Core.createGameState();

    Core.advanceRoundAfterCompletedTurn(gameState, 'black');
    expect(gameState.roundNumber).toBe(1);
    expect(gameState.roundCompletionByPlayer).toEqual({ black: true, white: false });

    Core.advanceRoundAfterCompletedTurn(gameState, 'black');
    expect(gameState.roundNumber).toBe(1);
    expect(gameState.roundCompletionByPlayer).toEqual({ black: true, white: false });

    Core.advanceRoundAfterCompletedTurn(gameState, 'white');
    expect(gameState.roundNumber).toBe(2);
    expect(gameState.roundCompletionByPlayer).toEqual({ black: false, white: false });
    expect(gameState.pendingRoundBonus).toBeNull();
  });

  test('applyPass also advances the authoritative round state and schedules a round 10 bonus', () => {
    const gameState = Core.createGameState();
    gameState.currentPlayer = Core.WHITE;
    gameState.roundNumber = 9;
    gameState.roundCompletionByPlayer = { black: true, white: false };

    const nextState = Core.applyPass(gameState);

    expect(nextState.currentPlayer).toBe(Core.BLACK);
    expect(nextState.turnNumber).toBe(1);
    expect(nextState.roundNumber).toBe(10);
    expect(nextState.roundCompletionByPlayer).toEqual({ black: false, white: false });
    expect(nextState.pendingRoundBonus).toEqual({ roundNumber: 10, amount: 5 });
  });

  test('turn start consumes the pending bonus, grants both players charge, and emits the round banner', () => {
    const cardState = createCardState();
    const gameState = Core.createGameState();
    const CardLogic = createTurnStartCardLogic();
    const events = [];

    gameState.roundNumber = 10;
    gameState.pendingRoundBonus = { roundNumber: 10, amount: 5 };

    TurnPipelinePhases.applyTurnStartPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      events
    );

    expect(cardState.charge).toEqual({ black: 5, white: 5 });
    expect(cardState.chargeGainedTotal).toEqual({ black: 5, white: 5 });
    expect(cardState.chargeDeltaEvents).toEqual([
      { seq: 1, player: 'black', before: 0, after: 5, delta: 5, reason: 'round_bonus' },
      { seq: 2, player: 'white', before: 0, after: 5, delta: 5, reason: 'round_bonus' }
    ]);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'round_bonus_gain',
        roundNumber: 10,
        amount: 5,
        gainedByPlayer: { black: 5, white: 5 }
      }),
      expect.objectContaining({ type: 'turn_start', player: 'black' })
    ]));
    expect(cardState.presentationEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'ROUND_BONUS_BANNER',
        roundNumber: 10,
        amount: 5,
        text: 'BONUS ROUND +5'
      })
    ]));
    expect(gameState.pendingRoundBonus).toBeNull();
    expect(CardLogic.onTurnStart).toHaveBeenCalledWith(cardState, 'black', gameState, undefined, expect.objectContaining({
      skipStoneSalvationGodRevives: true
    }));
  });
});

describe('round rules are shared by Core and the turn adapter', () => {
  const TurnRoundState = require('../game/turn/round-state.ts');
  const normalizePlayerKey = (player: any) => (player === 'white' || player === -1 ? 'white' : (player === 'black' || player === 1 ? 'black' : null));

  function runSequence(advance: (state: any, player: any, options: any) => any, consume: (state: any) => any) {
    const state: any = { roundNumber: 8, roundCompletionByPlayer: { black: false, white: false }, pendingRoundBonus: null };
    const steps: any[] = [];
    const sequence: Array<[any, any]> = [
      ['black', null], ['black', null], ['white', null],          // round 8 -> 9 (same color twice first)
      ['white', null], ['black', null],                          // round 9 -> 10, bonus +5 scheduled
      ['black', { scheduleBonus: false }], ['white', { scheduleBonus: false }], // round 10 -> 11, keeps pending bonus
      ['nobody', null]
    ];
    for (const [player, options] of sequence) {
      steps.push({ result: advance(state, player, options), state: JSON.parse(JSON.stringify(state)) });
    }
    steps.push({ consumed: consume(state), again: consume(state), state: JSON.parse(JSON.stringify(state)) });
    return steps;
  }

  test('Core and the Core-free adapter path produce identical rounds, bonuses, and single consumption', () => {
    const viaCore = runSequence(
      (state, player, options) => Core.advanceRoundAfterCompletedTurn(state, player, options),
      (state) => Core.consumePendingRoundBonus(state)
    );
    const viaAdapter = runSequence(
      (state, player, options) => TurnRoundState.advanceGameRoundAfterCompletedTurn({ Core: null, gameState: state, playerKey: player, options, normalizePlayerKey }),
      (state) => TurnRoundState.applyPendingRoundBonusAtTurnStart({
        CardLogic: null,
        Core: null,
        cardState: {},
        gameState: state,
        events: [],
        addChargeWithTotal: () => 0
      })
    );
    expect(viaAdapter.slice(0, -1)).toEqual(viaCore.slice(0, -1));
    expect(viaCore[4].state.pendingRoundBonus).toEqual({ roundNumber: 10, amount: 5 });
    expect(viaCore[6].state).toEqual(expect.objectContaining({ roundNumber: 11, pendingRoundBonus: { roundNumber: 10, amount: 5 } }));
    expect(viaCore[viaCore.length - 1]).toEqual(expect.objectContaining({ consumed: { roundNumber: 10, amount: 5 }, again: null }));
    expect(viaAdapter[viaAdapter.length - 1].state.pendingRoundBonus).toBeNull();
  });
});
