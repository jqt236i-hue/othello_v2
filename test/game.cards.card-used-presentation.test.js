const SharedConstants = require('../shared-constants');
const CardLogic = require('../game/logic/cards');

describe('CardLogic applyCardUsage presentation event', () => {
  test('emits CARD_USED presentation event', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const def = defs.find(d => d && d.id && d.type !== 'TEMPT_WILL');
    expect(def).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    cardState.hands.black = [def.id];
    cardState.charge.black = Number.isFinite(def.cost) ? def.cost : 0;
    cardState.presentationEvents = [];

    const ok = CardLogic.applyCardUsage(cardState, 'black', def.id);
    expect(ok).toBe(true);
    expect(cardState.presentationEvents.some(ev => ev && ev.type === 'CARD_USED' && ev.cardId === def.id)).toBe(true);
    expect(cardState.cardUseCountByPlayer.black).toBe(1);
  });

  test('cancelPendingSelection reverts card use counter for cancellable cards', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const def = defs.find(d => d && d.id && d.type === 'DESTROY_ONE_STONE');
    expect(def).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    cardState.hands.black = [def.id];
    cardState.charge.black = Number.isFinite(def.cost) ? def.cost : 0;

    const ok = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(ok).toBe(true);
    expect(cardState.cardUseCountByPlayer.black).toBe(1);

    const canceled = CardLogic.cancelPendingSelection(cardState, 'black');
    expect(canceled && canceled.canceled).toBe(true);
    expect(cardState.cardUseCountByPlayer.black).toBe(0);
  });

  test('SACRIFICE_WILL destroys own stone, gains charge, and can finish without refund', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const def = defs.find(d => d && d.id && d.type === 'SACRIFICE_WILL');
    expect(def).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1
    };
    gameState.board[3][3] = 1;
    gameState.board[3][4] = 1;

    cardState.hands.black = [def.id];
    cardState.charge.black = Number.isFinite(def.cost) ? def.cost : 0;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', def.id);
    expect(used).toBe(true);

    const applied = CardLogic.applySacrificeWill(cardState, gameState, 'black', 3, 3);
    expect(applied && applied.applied).toBe(true);
    expect(gameState.board[3][3]).toBe(0);
    expect(cardState.charge.black).toBe(5);
    expect(cardState.pendingEffectByPlayer.black).toBeTruthy();

    const canceled = CardLogic.cancelPendingSelection(cardState, 'black');
    expect(canceled && canceled.canceled).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    // No refund after at least one sacrifice.
    expect(cardState.charge.black).toBe(5);
  });

  test('SELL_CARD_WILL sells one hand card and gains its cost', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const sellDef = defs.find(d => d && d.id && d.type === 'SELL_CARD_WILL');
    const soldDef = defs.find(d => d && d.id && d.type === 'GOLD_STONE');
    expect(sellDef).toBeTruthy();
    expect(soldDef).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    cardState.hands.black = [sellDef.id, soldDef.id];
    cardState.charge.black = Number.isFinite(sellDef.cost) ? sellDef.cost : 0;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', sellDef.id);
    expect(used).toBe(true);
    expect(cardState.pendingEffectByPlayer.black && cardState.pendingEffectByPlayer.black.type).toBe('SELL_CARD_WILL');

    const sold = CardLogic.applySellCardWill(cardState, 'black', soldDef.id);
    expect(sold && sold.applied).toBe(true);
    expect(sold.gained).toBe(soldDef.cost);
    expect(cardState.hands.black.includes(soldDef.id)).toBe(false);
    expect(cardState.discard.includes(soldDef.id)).toBe(true);
    expect(cardState.charge.black).toBe(soldDef.cost);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('SELL_CARD_WILL cannot be used when no card remains to sell', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const sellDef = defs.find(d => d && d.id && d.type === 'SELL_CARD_WILL');
    expect(sellDef).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };
    cardState.hands.black = [sellDef.id];
    cardState.charge.black = Number.isFinite(sellDef.cost) ? sellDef.cost : 0;

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', sellDef.id);
    expect(used).toBe(false);
  });

  test('STEAL_CARD removes cards from opponent and receives within hand limit', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const stealDef = defs.find(d => d && d.id && d.type === 'STEAL_CARD');
    expect(stealDef).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };

    cardState.hands.black = [stealDef.id, 'a', 'b', 'c'];
    cardState.hands.white = ['w1', 'w2', 'w3', 'w4', 'w5'];
    cardState.charge.black = Number.isFinite(stealDef.cost) ? stealDef.cost : 0;
    cardState.deck = ['d1'];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', stealDef.id);
    expect(used).toBe(true);

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 3);
    expect(effects.stolenCount).toBe(3);
    expect(cardState.hands.black).toEqual(['a', 'b', 'c', 'w1', 'w2']);
    expect(cardState.hands.white).toEqual(['w4', 'w5']);
    expect(cardState.deck).toEqual(['d1', 'w3']);
  });

  test('STEAL_CARD over-hand cards are added to own deck, not discarded', () => {
    const defs = Array.isArray(SharedConstants.CARD_DEFS) ? SharedConstants.CARD_DEFS : [];
    const stealDef = defs.find(d => d && d.id && d.type === 'STEAL_CARD');
    expect(stealDef).toBeTruthy();

    const prng = { shuffle: () => {}, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng);
    const gameState = { board: Array.from({ length: 8 }, () => Array(8).fill(0)), currentPlayer: 1 };

    // Hand is full before use. After using STEAL_CARD, one slot opens.
    cardState.hands.black = [stealDef.id, 'a', 'b', 'c', 'd'];
    cardState.hands.white = ['w1', 'w2', 'w3', 'w4', 'w5'];
    cardState.charge.black = Number.isFinite(stealDef.cost) ? stealDef.cost : 0;
    cardState.deck = ['d1', 'd2'];
    cardState.discard = [];

    const used = CardLogic.applyCardUsage(cardState, gameState, 'black', stealDef.id);
    expect(used).toBe(true);

    const effects = CardLogic.applyPlacementEffects(cardState, gameState, 'black', 3, 3, 5);
    expect(effects.stolenCount).toBe(5);
    expect(cardState.hands.black).toEqual(['a', 'b', 'c', 'd', 'w1']);
    expect(cardState.hands.white).toEqual([]);
    expect(cardState.deck).toEqual(['d1', 'd2', 'w2', 'w3', 'w4', 'w5']);
    expect(cardState.discard.includes(stealDef.id)).toBe(true);
  });
});
