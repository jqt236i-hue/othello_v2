const CardLogic = require('../game/logic/cards.js');

function createCardState() {
  return CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 }, { plainReversi: true });
}

describe('OBSERVER_WILL card copy cost ledger', () => {
  test('stores a zero-cost override by card copy id', () => {
    const cardState = createCardState();
    const added = CardLogic.addCardToHand(cardState, 'black', 'meteor_01');
    expect(added.cardCopyId).toBeGreaterThan(0);

    CardLogic.setCardCostOverrideForCopyId(cardState, added.cardCopyId, 0, 'OBSERVER_WILL');

    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'meteor_01', added.cardCopyId)).toBe(0);
  });

  test('stores additive +5 modifiers by card copy id', () => {
    const cardState = createCardState();
    const added = CardLogic.addCardToHand(cardState, 'white', 'guard_01');
    const base = CardLogic.getCardCost('guard_01');

    CardLogic.addCardCostModifierForCopyId(cardState, added.cardCopyId, 5, 'OBSERVER_WILL');

    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'guard_01', added.cardCopyId)).toBe(base + 5);
  });

  test('copyCardState preserves observer cost ledgers', () => {
    const cardState = createCardState();
    const added = CardLogic.addCardToHand(cardState, 'black', 'gold_stone');
    CardLogic.setCardCostOverrideForCopyId(cardState, added.cardCopyId, 0, 'OBSERVER_WILL');
    CardLogic.addCardCostModifierForCopyId(cardState, added.cardCopyId, 5, 'OBSERVER_WILL');

    const cloned = CardLogic.copyCardState(cardState);

    expect(cloned.cardCostOverridesByCopyId[String(added.cardCopyId)].cost).toBe(0);
    expect(cloned.cardCostModifiersByCopyId[String(added.cardCopyId)][0].delta).toBe(5);
  });

  test('effective copy cost gates usage and payment', () => {
    const cardState = createCardState();
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 20
    };
    const stolen = CardLogic.addCardToHand(cardState, 'black', 'supply_01');
    cardState.charge.black = 0;
    CardLogic.setCardCostOverrideForCopyId(cardState, stolen.cardCopyId, 0, 'OBSERVER_WILL');

    expect(CardLogic.canUseCard(cardState, 'black', 'supply_01')).toBe(true);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'supply_01')).toBe(true);
    expect(cardState.charge.black).toBe(0);
  });

  test('selected hand index uses the zero-cost stolen copy when duplicate card ids exist', () => {
    const cardState = createCardState();
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: 1,
      turnNumber: 20
    };
    const original = CardLogic.addCardToHand(cardState, 'black', 'supply_01');
    const stolen = CardLogic.addCardToHand(cardState, 'black', 'supply_01');
    cardState.charge.black = 0;
    CardLogic.setCardCostOverrideForCopyId(cardState, stolen.cardCopyId, 0, 'OBSERVER_WILL');

    expect(CardLogic.canUseCard(cardState, 'black', 'supply_01')).toBe(false);
    expect(CardLogic.canUseCard(cardState, 'black', 'supply_01', { handIndex: 1 })).toBe(true);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'supply_01', 'black', { handIndex: 1 })).toBe(true);

    expect(cardState.charge.black).toBe(0);
    expect(CardLogic.getHandCopyIds(cardState, 'black')).toEqual([original.cardCopyId]);
    expect(cardState._discardCopyIds[cardState._discardCopyIds.length - 1]).toBe(stolen.cardCopyId);
  });

  test('effective +5 modifier blocks use until the modified cost is affordable', () => {
    const cardState = createCardState();
    const added = CardLogic.addCardToHand(cardState, 'white', 'silver_stone');
    CardLogic.addCardCostModifierForCopyId(cardState, added.cardCopyId, 5, 'OBSERVER_WILL');

    cardState.charge.white = CardLogic.getCardCost('silver_stone') + 4;
    expect(CardLogic.canUseCard(cardState, 'white', 'silver_stone')).toBe(false);

    cardState.charge.white = CardLogic.getCardCost('silver_stone') + 5;
    expect(CardLogic.canUseCard(cardState, 'white', 'silver_stone')).toBe(true);
  });
});
