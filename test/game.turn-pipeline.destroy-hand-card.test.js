const Core = require('../game/logic/core');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');

describe('TurnPipeline destroy_hand_card', () => {
  function findHandRemoveEvent(presentationEvents, reason) {
    const events = Array.isArray(presentationEvents) ? presentationEvents : [];
    return events.find((e) => e && e.type === 'HAND_REMOVE' && (!reason || e.reason === reason));
  }

  test('手札破壊アクションで手札から1枚消える', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();

    const first = cardState.decks.black.shift();
    const second = cardState.decks.black.shift();
    cardState.hands.black.push(first, second);

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'destroy_hand_card',
      destroyCardId: first
    });

    expect(res.cardState.hands.black).toContain(second);
    expect(res.cardState.hands.black).not.toContain(first);
    expect(res.cardState.discard).toContain(first);
    expect(res.cardState.hasDestroyedCardThisTurnByPlayer.black).toBe(true);
    expect(res.cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
    expect(res.gameState.currentPlayer).toBe(Core.BLACK);

    const handRemove = findHandRemoveEvent(res.presentationEvents, 'destroy_hand_card');
    expect(handRemove).toMatchObject({ player: 'black', count: 1, cardId: first });
  });

  test('同一ターンに手札破壊を複数回実行できる', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();

    const first = cardState.decks.black.shift();
    const second = cardState.decks.black.shift();
    const third = cardState.decks.black.shift();
    cardState.hands.black.push(first, second, third);

    const firstDestroy = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'destroy_hand_card',
      destroyCardId: first
    });

    const secondDestroy = TurnPipeline.applyTurn(firstDestroy.cardState, firstDestroy.gameState, 'black', {
      type: 'destroy_hand_card',
      destroyCardId: second
    });

    expect(secondDestroy.cardState.hands.black).toContain(third);
    expect(secondDestroy.cardState.hands.black).not.toContain(first);
    expect(secondDestroy.cardState.hands.black).not.toContain(second);
    expect(secondDestroy.cardState.discard).toEqual(expect.arrayContaining([first, second]));
    expect(secondDestroy.cardState.hasUsedCardThisTurnByPlayer.black).toBe(false);
    expect(secondDestroy.gameState.currentPlayer).toBe(Core.BLACK);

    const handRemove = findHandRemoveEvent(secondDestroy.presentationEvents, 'destroy_hand_card');
    expect(handRemove).toMatchObject({ player: 'black', count: 1, cardId: second });
  });

  test('SELL_CARD_WILL選択時にHAND_REMOVEを出す', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();
    cardState.decks.black = [];
    cardState.hands.black = ['sell_a', 'keep_b'];
    cardState.pendingEffectByPlayer.black = { type: 'SELL_CARD_WILL', stage: 'selectTarget' };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'place',
      sellCardId: 'sell_a'
    });

    expect(res.cardState.hands.black).toEqual(['keep_b']);
    const handRemove = findHandRemoveEvent(res.presentationEvents, 'sell_card_will');
    expect(handRemove).toMatchObject({ player: 'black', count: 1, cardId: 'sell_a' });
  });

  test('CONDEMN_WILL選択時に相手側HAND_REMOVEを出す', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();
    cardState.hands.black = [];
    cardState.hands.white = ['enemy_a', 'enemy_b'];
    cardState.pendingEffectByPlayer.black = {
      type: 'CONDEMN_WILL',
      stage: 'selectTarget',
      offers: [{ handIndex: 1, cardId: 'enemy_b' }]
    };

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'place',
      condemnTargetIndex: 1
    });

    expect(res.cardState.hands.white).toEqual(['enemy_a']);
    const handRemove = findHandRemoveEvent(res.presentationEvents, 'condemn_will');
    expect(handRemove).toMatchObject({ player: 'white', count: 1, cardId: 'enemy_b' });
  });

  test('TRAP_WILL発動時に被害側HAND_REMOVEを出す', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();

    gameState.board[0][0] = Core.WHITE;
    cardState.markers.push({
      id: 501,
      kind: 'specialStone',
      row: 0,
      col: 0,
      owner: 'black',
      data: { type: 'TRAP', hidden: true }
    });
    cardState.decks.white = [];
    cardState.hands.white = ['w1', 'w2', 'w3'];

    const res = TurnPipeline.applyTurn(cardState, gameState, 'white', { type: 'use_card' });

    expect(res.cardState.hands.white).toEqual([]);
    const handRemove = findHandRemoveEvent(res.presentationEvents, 'trap_will_triggered');
    expect(handRemove).toMatchObject({ player: 'white', count: 3 });
    expect(Array.isArray(handRemove.cardIds)).toBe(true);
    expect(handRemove.cardIds).toEqual(['w1', 'w2', 'w3']);
  });

  test('STEAL_CARDで相手手札を奪うとHAND_REMOVEを出す', () => {
    const gameState = Core.createGameState();
    const cardState = CardLogic.createCardState();

    cardState.pendingEffectByPlayer.black = { type: 'STEAL_CARD', stage: 'place' };
    cardState.hands.white = ['s1', 's2'];

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', {
      type: 'place',
      row: 2,
      col: 3
    });

    expect(res.cardState.hands.white.length).toBe(1);
    const handRemove = findHandRemoveEvent(res.presentationEvents, 'steal_card');
    expect(handRemove).toMatchObject({ player: 'white', count: 1 });
    expect(Array.isArray(handRemove.cardIds)).toBe(true);
    expect(handRemove.cardIds).toEqual(['s1']);
  });
});
