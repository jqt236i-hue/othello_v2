const CardLogic = require('../game/logic/cards.js');

function createPrng() {
  return { shuffle: (arr) => arr, random: () => 0.5 };
}

function createState(turnNumber = 18) {
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber
  };
  const cardState = CardLogic.createCardState(createPrng(), { plainReversi: true });
  cardState.turnIndex = turnNumber;
  CardLogic.addCardToHand(cardState, 'black', 'observer_will_01');
  CardLogic.addCardToHand(cardState, 'white', 'meteor_01');
  CardLogic.addCardToHand(cardState, 'white', 'guard_01');
  CardLogic.addCardToHand(cardState, 'white', 'gold_stone');
  cardState.charge.black = 0;
  cardState.charge.white = 0;
  return { gameState, cardState };
}

describe('OBSERVER_WILL pending selection', () => {
  test('cannot be used before 18 turns', () => {
    const { gameState, cardState } = createState(17);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(false);
  });

  test('cannot be used while any manifestation stone is already on the board', () => {
    const { gameState, cardState } = createState(18);
    gameState.board[2][2] = -1;
    cardState.markers.push({
      id: 1001,
      kind: 'manifestStone',
      row: 2,
      col: 2,
      owner: 'white',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, absoluteProtected: true }
    });

    expect(CardLogic.canUseCard(cardState, 'black', 'observer_will_01')).toBe(false);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('can be used when only expired manifestation stones remain', () => {
    const { gameState, cardState } = createState(18);
    gameState.board[2][2] = -1;
    cardState.markers.push({
      id: 1002,
      kind: 'manifestStone',
      row: 2,
      col: 2,
      owner: 'white',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 0, absoluteProtected: true }
    });

    expect(CardLogic.canUseCard(cardState, 'black', 'observer_will_01')).toBe(true);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(true);
  });

  test('creates opponent hand offers at 18 turns', () => {
    const { gameState, cardState } = createState(18);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'OBSERVER_WILL',
      stage: 'selectTarget',
      cardId: 'observer_will_01'
    }));
    expect(cardState.pendingEffectByPlayer.black.offers).toEqual([
      expect.objectContaining({ handIndex: 0, cardId: 'meteor_01' }),
      expect.objectContaining({ handIndex: 1, cardId: 'guard_01' }),
      expect.objectContaining({ handIndex: 2, cardId: 'gold_stone' })
    ]);
  });

  test('selection steals one card, modifies costs, and reserves observation stone', () => {
    const { gameState, cardState } = createState(18);
    CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01');
    const observedWhiteCopyIds = CardLogic.getHandCopyIds(cardState, 'white');
    const [meteorCopyId, stolenCopyId, goldCopyId] = observedWhiteCopyIds;

    const res = CardLogic.applyObserverWillChoice(cardState, gameState, 'black', 1);

    expect(res.applied).toBe(true);
    expect(cardState.hands.black).toContain('guard_01');
    expect(cardState.hands.white).toEqual(['meteor_01', 'gold_stone']);
    expect(cardState.nextObserverWillStoneByPlayer.black).toEqual(expect.objectContaining({
      sourceType: 'OBSERVER_WILL',
      stolenCardId: 'guard_01'
    }));
    expect(cardState.observerWillRepaymentsByPlayer.black[0]).toEqual(expect.objectContaining({
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      stolenCardId: 'guard_01',
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    }));
    for (const copyId of observedWhiteCopyIds) {
      expect(CardLogic.isCardCopyIdRevealedToViewer(cardState, 'black', copyId)).toBe(true);
    }
    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'meteor_01', meteorCopyId)).toBe(CardLogic.getCardCost('meteor_01') + 5);
    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'guard_01', stolenCopyId)).toBe(0);
    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'gold_stone', goldCopyId)).toBe(CardLogic.getCardCost('gold_stone') + 5);
  });

  test('selection applies observed cost tax only once and clears it from the stolen copy', () => {
    const { gameState, cardState } = createState(18);
    CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01');
    const observedWhiteCopyIds = CardLogic.getHandCopyIds(cardState, 'white');
    const [meteorCopyId, stolenCopyId] = observedWhiteCopyIds;
    CardLogic.addCardCostModifierForCopyId(cardState, meteorCopyId, 5, 'OBSERVER_WILL');
    CardLogic.addCardCostModifierForCopyId(cardState, stolenCopyId, 5, 'OBSERVER_WILL');

    const res = CardLogic.applyObserverWillChoice(cardState, gameState, 'black', 1);

    expect(res.applied).toBe(true);
    const meteorModifiers = cardState.cardCostModifiersByCopyId[String(meteorCopyId)] || [];
    const stolenModifiers = cardState.cardCostModifiersByCopyId[String(stolenCopyId)] || [];
    expect(meteorModifiers.filter((entry) => entry && entry.sourceType === 'OBSERVER_WILL' && entry.delta === 5)).toHaveLength(1);
    expect(stolenModifiers.filter((entry) => entry && entry.sourceType === 'OBSERVER_WILL')).toHaveLength(0);
    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'meteor_01', meteorCopyId)).toBe(CardLogic.getCardCost('meteor_01') + 5);
    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'guard_01', stolenCopyId)).toBe(0);
  });

  test('selection allocates repayment id after existing restored ids', () => {
    const { gameState, cardState } = createState(18);
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      repaymentId: 'observer_will_repay_black_3',
      status: 'active',
      stolenCardId: 'silver_stone',
      repaymentAmount: 1,
      remainingOwnerTurns: 8
    });
    delete cardState._nextObserverWillRepaymentSeq;
    CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01');

    const res = CardLogic.applyObserverWillChoice(cardState, gameState, 'black', 1);

    expect(res.applied).toBe(true);
    expect(cardState.observerWillRepaymentsByPlayer.black[1]).toEqual(expect.objectContaining({
      repaymentId: 'observer_will_repay_black_4'
    }));
    expect(cardState.nextObserverWillStoneByPlayer.black).toEqual(expect.objectContaining({
      repaymentId: 'observer_will_repay_black_4'
    }));
  });
});
