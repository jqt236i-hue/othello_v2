const TurnPipeline = require('../game/turn/turn_pipeline');
const CardLogic = require('../game/logic/cards');

describe('SUPPLY_WILL (補給の意志)', () => {
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

  test('use card: draws 2 cards immediately', () => {
    const { cardState, gameState } = makeState();
    cardState.debugNoDraw = true;
    cardState.hands.black = ['supply_01', 'gold_stone'];
    cardState.decks.black = ['deck_a', 'deck_b', 'deck_c'];
    cardState.charge.black = 1;

    const action = { type: 'use_card', useCardId: 'supply_01' };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });

    expect(res.events.some((e) => e && e.type === 'card_used' && e.cardId === 'supply_01')).toBe(true);
    expect(res.events.some((e) => e && e.type === 'supply_will_resolved' && e.drawnCount === 2)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.charge.black).toBe(0);
    expect(cardState.hands.black).toEqual(['gold_stone', 'deck_c', 'deck_b']);
    expect(cardState.discard).toEqual(expect.arrayContaining(['supply_01']));

    const handClearEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'HAND_CLEAR');
    const drawEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'DRAW_CARD');
    expect(handClearEvents).toHaveLength(0);
    expect(drawEvents).toHaveLength(2);
  });

  test('use card: hand limit remains 5', () => {
    const { cardState, gameState } = makeState();
    cardState.debugNoDraw = true;
    cardState.hands.black = ['supply_01', 'gold_stone', 'silver_stone', 'hard_01', 'work_01'];
    cardState.decks.black = ['deck_a', 'deck_b'];
    cardState.charge.black = 1;

    const action = { type: 'use_card', useCardId: 'supply_01' };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, { shuffle: () => {}, random: () => 0.5 });

    expect(res.events.some((e) => e && e.type === 'supply_will_resolved' && e.drawnCount === 1)).toBe(true);
    expect(cardState.hands.black).toEqual(['gold_stone', 'silver_stone', 'hard_01', 'work_01', 'deck_b']);
    expect(cardState.hands.black).toHaveLength(5);

    const drawEvents = (res.presentationEvents || []).filter((e) => e && e.type === 'DRAW_CARD');
    expect(drawEvents).toHaveLength(1);
  });
});