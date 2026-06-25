const CardLogic = require('../game/logic/cards.js');
const Core = require('../game/logic/core.js');
const BoardOps = require('../game/logic/board_ops.js');

function prng() {
  return { shuffle: (arr) => arr, random: () => 0 };
}

function createState(turnNumber = 20) {
  const cardState = CardLogic.createCardState(prng(), { plainReversi: true });
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(0)),
    currentPlayer: 1,
    turnNumber
  };
  cardState.turnIndex = turnNumber;
  cardState.charge.black = 99;
  cardState.charge.white = 99;
  return { cardState, gameState };
}

function addManifestStone(cardState, gameState, row, col, owner = 'black', type = 'OBSERVER_WILL') {
  gameState.board[row][col] = owner === 'white' ? -1 : 1;
  cardState.markers.push({
    id: 900 + row * 8 + col,
    kind: 'manifestStone',
    row,
    col,
    owner,
    data: { type, remainingOwnerTurns: 4, inviolable: true }
  });
}

describe('inviolable special cards in hand effects', () => {
  test('CONDEMN_WILL offers exclude opponent special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'condemn_01');
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');
    CardLogic.addCardToHand(cardState, 'white', 'gold_stone');

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'condemn_01')).toBe(true);

    expect(cardState.pendingEffectByPlayer.black.offers).toEqual([
      expect.objectContaining({ handIndex: 1, cardId: 'gold_stone' })
    ]);
  });

  test('OBSERVER_WILL offers exclude opponent special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'observer_will_01');
    CardLogic.addCardToHand(cardState, 'white', 'board_executor_01');
    CardLogic.addCardToHand(cardState, 'white', 'silver_stone');

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(true);

    expect(cardState.pendingEffectByPlayer.black.offers).toEqual([
      expect.objectContaining({ handIndex: 1, cardId: 'silver_stone' })
    ]);
  });

  test('OBSERVER_WILL observation does not apply observed cost tax to opponent special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'observer_will_01');
    CardLogic.addCardToHand(cardState, 'white', 'board_executor_01');
    CardLogic.addCardToHand(cardState, 'white', 'silver_stone');
    const [specialCopyId, silverCopyId] = CardLogic.getHandCopyIds(cardState, 'white');

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'observer_will_01')).toBe(true);
    const res = CardLogic.applyObserverWillChoice(cardState, gameState, 'black', 1);

    expect(res.applied).toBe(true);
    expect(CardLogic.isCardCopyIdRevealedToViewer(cardState, 'black', specialCopyId)).toBe(true);
    expect(cardState.cardCostModifiersByCopyId[String(specialCopyId)]).toBeUndefined();
    expect(cardState.cardCostOverridesByCopyId[String(silverCopyId)]).toEqual(expect.objectContaining({ cost: 0 }));
  });

  test('OBSERVER_WILL active observation does not tax special cards drawn by the opponent', () => {
    const { cardState } = createState();
    CardLogic.addMarker(cardState, 'manifestStone', 2, 3, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 4,
      inviolable: true
    });
    CardLogic.ensureCardCopyState(cardState);
    cardState.decks.white = ['observer_will_01'];
    cardState._deckCopyIdsByPlayer.white = [3001];

    const drawn = CardLogic.commitDraw(cardState, 'white', prng());

    expect(drawn).toBe('observer_will_01');
    expect(CardLogic.isCardCopyIdRevealedToViewer(cardState, 'black', 3001)).toBe(true);
    expect(cardState.cardCostModifiersByCopyId[String(3001)]).toBeUndefined();
  });

  test('hand-target cards are not usable when opponent hand has only special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'condemn_01');
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'condemn_01')).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('EXECUTION_WILL skips opponent special cards during random destruction', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'execution_01');
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');
    CardLogic.addCardToHand(cardState, 'white', 'gold_stone');
    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [{ owner: 'black' }],
      white: []
    };

    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'execution_01')).toBe(true);
    const result = CardLogic.applyExecutionWill(cardState, 'black', prng());

    expect(result.applied).toBe(true);
    expect(result.destroyedCardIds).toEqual(['gold_stone']);
    expect(cardState.hands.white).toEqual(['observer_will_01']);
    expect(cardState.discard).toEqual(expect.arrayContaining(['gold_stone']));
    expect(cardState.discard).not.toEqual(expect.arrayContaining(['observer_will_01']));
  });

  test('EXECUTION_WILL is not usable when opponent hand has only special cards', () => {
    const { cardState, gameState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'execution_01');
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');
    cardState.prevOpponentTurnDestroyedStonesByPlayer = {
      black: [{ owner: 'black' }],
      white: []
    };

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).not.toContain('execution_01');
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', 'execution_01')).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('destroyHandCard rejects opponent-caused destruction of a special card', () => {
    const { cardState } = createState();
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');

    const result = CardLogic.destroyHandCard(cardState, 'white', 'observer_will_01', {
      sourcePlayerKey: 'black',
      reason: 'test_opponent_destroy'
    });

    expect(result).toEqual(expect.objectContaining({
      applied: false,
      reason: 'inviolable_special_card'
    }));
    expect(cardState.hands.white).toEqual(['observer_will_01']);
  });

  test('destroyHandCard rejects owner-controlled destruction of own special card', () => {
    const { cardState } = createState();
    CardLogic.addCardToHand(cardState, 'white', 'observer_will_01');

    const result = CardLogic.destroyHandCard(cardState, 'white', 'observer_will_01', {
      sourcePlayerKey: 'white',
      reason: 'self_discard'
    });

    expect(result).toEqual(expect.objectContaining({
      applied: false,
      reason: 'inviolable_special_card'
    }));
    expect(cardState.hands.white).toEqual(['observer_will_01']);
    expect(cardState.discard).not.toEqual(expect.arrayContaining(['observer_will_01']));
  });

  test('clearHandToDiscard leaves special cards in hand and discards only normal cards', () => {
    const { cardState } = createState();
    CardLogic.addCardToHand(cardState, 'black', 'observer_will_01');
    CardLogic.addCardToHand(cardState, 'black', 'gold_stone');
    CardLogic.addCardToHand(cardState, 'black', 'board_executor_01');
    CardLogic.addCardToHand(cardState, 'black', 'silver_stone');

    const result = CardLogic.clearHandToDiscard(cardState, 'black');

    expect(result.destroyedCards).toEqual(['gold_stone', 'silver_stone']);
    expect(cardState.hands.black).toEqual(['observer_will_01', 'board_executor_01']);
    expect(cardState.discard).toEqual(expect.arrayContaining(['gold_stone', 'silver_stone']));
    expect(cardState.discard).not.toEqual(expect.arrayContaining(['observer_will_01', 'board_executor_01']));
  });

  test('manifestation stones are not targets for ordinary special-stone effects', () => {
    const { cardState, gameState } = createState();
    gameState.board[2][2] = -1;
    cardState.markers.push({
      id: 701,
      kind: 'manifestStone',
      row: 2,
      col: 2,
      owner: 'white',
      data: { type: 'OBSERVER_WILL', remainingOwnerTurns: 4, inviolable: true }
    });

    expect(CardLogic.getTemptWillTargets(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.getCaptureWillTargets(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.getCorrosionTargets(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.getLossWillRemovableCount(cardState, gameState, 'black')).toBe(0);
  });

  test('manifestation stones reject ordinary status attachment cards', () => {
    const { cardState, gameState } = createState();
    addManifestStone(cardState, gameState, 2, 2, 'black');

    cardState.pendingEffectByPlayer.black = {
      type: 'GUARD_WILL',
      stage: 'selectTarget',
      cardId: 'guard_01'
    };

    expect(CardLogic.getGuardTargets(cardState, gameState, 'black')).not.toContainEqual({ row: 2, col: 2 });
    expect(CardLogic.applyGuardWill(cardState, gameState, 'black', 2, 2)).toEqual(expect.objectContaining({
      applied: false,
      reason: 'invalid_target'
    }));
    expect((cardState.markers || []).some((marker) => (
      marker &&
      marker.row === 2 &&
      marker.col === 2 &&
      marker.data &&
      marker.data.type === 'GUARD'
    ))).toBe(false);

    cardState.pendingEffectByPlayer.black = {
      type: 'LIVING_WILL',
      stage: 'selectTarget',
      cardId: 'living_will_01'
    };

    expect(CardLogic.getLivingWillTargets(cardState, gameState, 'black')).not.toContainEqual({ row: 2, col: 2 });
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 2)).toEqual(expect.objectContaining({
      applied: false,
      reason: 'invalid_target'
    }));
    expect((cardState.markers || []).some((marker) => (
      marker &&
      marker.row === 2 &&
      marker.col === 2 &&
      marker.data &&
      marker.data.type === 'LIVING_WILL'
    ))).toBe(false);
  });

  test('manifestation stones reject direct board effects and normal flips', () => {
    const { cardState, gameState } = createState();
    gameState.board = Array.from({ length: 8 }, () => Array(8).fill(0));
    gameState.board[3][1] = 1;
    addManifestStone(cardState, gameState, 3, 2, 'white');

    const context = CardLogic.getCardContext(cardState);
    expect(Core.getFlipsWithContext(gameState, 3, 3, 1, context)).toEqual([]);

    expect(CardLogic.getDestroyTargets(cardState, gameState)).not.toContainEqual({ row: 3, col: 2 });
    expect(BoardOps.destroyAt(cardState, gameState, 3, 2, 'UNIT_TEST', 'manifest_destroy')).toEqual(expect.objectContaining({
      destroyed: false,
      reason: 'inviolable'
    }));
    expect(BoardOps.changeAt(cardState, gameState, 3, 2, 'black', 'UNIT_TEST', 'manifest_change')).toEqual(expect.objectContaining({
      changed: false,
      reason: 'inviolable'
    }));
    expect(gameState.board[3][2]).toBe(-1);
    expect(CardLogic.isManifestStoneAt(cardState, 3, 2)).toBe(true);
  });
});
