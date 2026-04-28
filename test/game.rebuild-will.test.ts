import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as CardLogic from '../game/logic/cards.js';

describe('REBUILD_WILL (再構築の意志)', () => {
  function makeState() {
    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 1,
      consecutivePasses: 0
    };
    return { cardState, gameState };
  }

  test('use card: destroys all remaining hand cards and draws 3', () => {
    const { cardState, gameState } = makeState();
    cardState.debugNoDraw = true;
    cardState.hands.black = ['rebuild_01', 'gold_stone', 'silver_stone'];
    cardState.decks.black = ['deck_a', 'deck_b', 'deck_c', 'deck_d', 'deck_e'];
    cardState.charge.black = 0;

    const action = { type: 'use_card', useCardId: 'rebuild_01' };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });

    expect(res.events.some((e) => e && e.type === 'card_used' && e.cardId === 'rebuild_01')).toBe(true);
    expect(res.events.some((e) => e && e.type === 'rebuild_will_resolved' && e.destroyedCount === 2 && e.drawnCount === 3)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.hands.black).toEqual(['deck_e', 'deck_d', 'deck_c']);
    expect(cardState.discard).toEqual(expect.arrayContaining(['rebuild_01', 'gold_stone', 'silver_stone']));

    const handClearEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'HAND_CLEAR');
    const drawEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'DRAW_CARD');
    expect(handClearEvents.length).toBe(1);
    expect(handClearEvents[0]).toMatchObject({ player: 'black', count: 2, reason: 'rebuild_will' });
    expect((res.presentationEvents || []).findIndex((e) => e && e.type === 'HAND_CLEAR')).toBeLessThan(
      (res.presentationEvents || []).findIndex((e) => e && e.type === 'DRAW_CARD')
    );
    expect(drawEvents.length).toBe(3);
  });

  test('use card: deck shortage draws only available cards', () => {
    const { cardState, gameState } = makeState();
    cardState.debugNoDraw = true;
    cardState.hands.black = ['rebuild_01', 'gold_stone'];
    cardState.decks.black = ['deck_only'];
    cardState.charge.black = 0;

    const action = { type: 'use_card', useCardId: 'rebuild_01' };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });

    expect(res.events.some((e) => e && e.type === 'rebuild_will_resolved' && e.destroyedCount === 1 && e.drawnCount === 1)).toBe(true);
    expect(cardState.hands.black).toEqual(['deck_only']);
    expect(cardState.discard).toEqual(expect.arrayContaining(['rebuild_01', 'gold_stone']));
  });
});
