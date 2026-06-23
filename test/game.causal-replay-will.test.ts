import * as CardLogic from '../game/logic/cards.js';
import * as Core from '../game/logic/core.js';
import * as SharedConstants from '../shared-constants.js';
import * as TurnPipelinePhases from '../game/turn/turn_pipeline_phases.js';
import * as BoardOps from '../game/logic/board_ops.js';

function createPrng(randomValue = 0.5) {
  return {
    shuffle: (arr) => arr,
    random: () => randomValue
  };
}

describe('CAUSAL_REPLAY_WILL（因果再生）', () => {
  test('選んだ穴マスを空の通常マスへ戻し、再び因果抹消の対象にできる', () => {
    const cardState = CardLogic.createCardState(createPrng());
    const gameState = Core.createGameState();
    cardState.debugNoDraw = true;
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    gameState.board[3][3] = Core.BLACK;

    cardState.pendingEffectByPlayer.black = { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_01' };
    expect(CardLogic.applyMeteorWill(cardState, gameState, 'black', 3, 3)).toMatchObject({ applied: true });
    expect(CardLogic.isBlockedCell(cardState, 3, 3, gameState)).toBe(true);

    const def = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'CAUSAL_REPLAY_WILL');
    expect(def).toBeTruthy();
    cardState.charge.black = 99;
    cardState.hands.black = [def.id];

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', def.id)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toMatchObject({ type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget' });

    const res = CardLogic.applyCausalReplayWill(cardState, gameState, 'black', 3, 3);
    expect(res).toMatchObject({ applied: true, restored: true, row: 3, col: 3 });
    expect(gameState.board[3][3]).toBe(Core.EMPTY);
    expect(CardLogic.isBlockedCell(cardState, 3, 3, gameState)).toBe(false);
    expect(CardLogic.getMeteorTargets(cardState, gameState, 'black')).toContainEqual({ row: 3, col: 3 });
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState._presentationEventsPersist).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'STATUS_REMOVED',
        row: 3,
        col: 3,
        cause: 'CAUSAL_REPLAY_WILL',
        reason: 'causal_replay_selected',
        meta: expect.objectContaining({
          special: 'METEOR_HOLE',
          cellRestorationCause: 'CAUSAL_REPLAY_WILL'
        })
      })
    ]));
  });

  test('ターン進行経由で causalReplayTarget を解決する', () => {
    const rng = createPrng(0);
    const cardState = CardLogic.createCardState(rng);
    const gameState = Core.createGameState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(Core.EMPTY));
    cardState.pendingEffectByPlayer.black = { type: 'METEOR_WILL', stage: 'selectTarget', cardId: 'meteor_01' };
    expect(CardLogic.applyMeteorWill(cardState, gameState, 'black', 2, 2)).toMatchObject({ applied: true });

    cardState.pendingEffectByPlayer.black = { type: 'CAUSAL_REPLAY_WILL', stage: 'selectTarget', cardId: 'causal_replay_01' };
    const events: any[] = [];

    TurnPipelinePhases.applyActionPhase(
      CardLogic,
      Core,
      cardState,
      gameState,
      'black',
      { type: 'place', causalReplayTarget: { row: 2, col: 2 } },
      events,
      rng,
      BoardOps
    );

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'causal_replay_selected',
        applied: true,
        restored: true,
        target: { row: 2, col: 2 }
      })
    ]));
    expect(CardLogic.isBlockedCell(cardState, 2, 2, gameState)).toBe(false);
  });
});
