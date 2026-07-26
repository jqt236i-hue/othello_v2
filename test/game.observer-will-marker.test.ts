const CardLogic = require('../game/logic/cards.js');
const SharedConstants = require('../shared-constants.js');

function createCardState() {
  return CardLogic.createCardState({ shuffle: (arr) => arr, random: () => 0.5 }, { plainReversi: true });
}

function createObserverWillGameState() {
  const board = Array.from({ length: 4 }, () => Array(4).fill(SharedConstants.EMPTY));
  board[2][3] = SharedConstants.BLACK;
  return {
    board,
    boardConfig: { rows: 4, cols: 4, shape: 'rectangle' },
    boardExpansion: { cells: [] }
  };
}

describe('OBSERVER_WILL marker', () => {
  test('next own placement reservation creates a 5T inviolable observer manifest marker', () => {
    const cardState = createCardState();
    cardState.nextObserverWillStoneByPlayer.black = {
      sourceType: 'OBSERVER_WILL',
      stolenCardId: 'guard_01',
      stolenCardCopyId: 3,
      repaymentIndex: 0
    };
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      markerId: null
    });

    const res = CardLogic.applyObserverWillStoneReservation(cardState, 'black', 2, 3);

    expect(res.applied).toBe(true);
    expect(cardState.nextObserverWillStoneByPlayer.black).toBeNull();
    const marker = cardState.markers.find((entry) => entry && entry.data && entry.data.type === 'OBSERVER_WILL');
    expect(marker).toEqual(expect.objectContaining({ row: 2, col: 3, owner: 'black' }));
    expect(marker.kind).toBe('manifestStone');
    expect(marker.data).toEqual(expect.objectContaining({
      remainingOwnerTurns: 5,
      inviolable: true,
      stolenCardId: 'guard_01'
    }));
    expect(CardLogic.isInviolableCell(cardState, 2, 3)).toBe(true);
  });

  test('owner turn start decrements observer marker and activates repayment on expiry', () => {
    const cardState = createCardState();
    cardState.charge.black = 10;
    CardLogic.addCardToHand(cardState, 'white', 'meteor_01');
    CardLogic.addCardToHand(cardState, 'white', 'guard_01');
    const observedWhiteCopyIds = CardLogic.getHandCopyIds(cardState, 'white');
    const marker = CardLogic.addMarker(cardState, 'specialStone', 2, 3, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 1,
      repaymentIndex: 0,
      stolenCardId: 'guard_01'
    });
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      markerId: marker.id,
      repaymentAmount: 5,
      remainingOwnerTurns: 9
    });
    const gameState = createObserverWillGameState();

    const res = CardLogic.processObserverWillMarkerAtTurnStart(cardState, gameState, 'black', 2, 3, { shuffle: (arr) => arr, random: () => 0.5 });

    expect(res.expired).toHaveLength(1);
    expect(res.repayment).toEqual(expect.objectContaining({
      repaid: 5,
      shortage: false,
      remainingOwnerTurnsAfter: 8
    }));
    expect(cardState.charge.black).toBe(5);
    expect(cardState.markers.some((entry) => entry && entry.id === marker.id)).toBe(false);
    expect(cardState.observerWillRepaymentsByPlayer.black[0]).toEqual(expect.objectContaining({
      status: 'active',
      repaymentAmount: 5,
      remainingOwnerTurns: 8
    }));
    expect(gameState.board[2][3]).toBe(SharedConstants.BLACK);
    for (const copyId of observedWhiteCopyIds) {
      expect(CardLogic.isCardCopyIdRevealedToViewer(cardState, 'black', copyId)).toBe(true);
    }
  });

  test('opponent draw while observer marker is active becomes observed and gets +5 once', () => {
    const cardState = createCardState();
    CardLogic.addMarker(cardState, 'manifestStone', 2, 3, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 4,
      repaymentIndex: 0,
      stolenCardId: 'guard_01'
    });
    CardLogic.ensureCardCopyState(cardState);
    cardState.decks.white = ['silver_stone'];
    cardState._deckCopyIdsByPlayer.white = [2001];

    const drawn = CardLogic.commitDraw(cardState, 'white', { shuffle: (arr) => arr, random: () => 0.5 });

    expect(drawn).toBe('silver_stone');
    expect(CardLogic.isCardCopyIdRevealedToViewer(cardState, 'black', 2001)).toBe(true);
    expect(CardLogic.getEffectiveCardCostForCopy(cardState, 'silver_stone', 2001)).toBe(CardLogic.getCardCost('silver_stone') + 5);

    CardLogic.commitDraw(cardState, 'white', { shuffle: (arr) => arr, random: () => 0.5 });
    const modifiers = cardState.cardCostModifiersByCopyId[String(2001)] || [];
    expect(modifiers.filter((entry) => entry && entry.sourceType === 'OBSERVER_WILL' && entry.delta === 5)).toHaveLength(1);
  });

  test('legacy specialStone observer marker is still processed as a manifestation marker', () => {
    const cardState = createCardState();
    cardState.charge.black = 10;
    const marker = CardLogic.addMarker(cardState, 'specialStone', 2, 3, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 1,
      repaymentIndex: 0,
      stolenCardId: 'guard_01'
    });
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      markerId: marker.id,
      repaymentAmount: 5,
      remainingOwnerTurns: 9
    });
    const gameState = createObserverWillGameState();

    const res = CardLogic.processObserverWillMarkerAtTurnStart(cardState, gameState, 'black', 2, 3, { shuffle: (arr) => arr, random: () => 0.5 });

    expect(res.expired).toHaveLength(1);
    expect(res.repayment).toEqual(expect.objectContaining({ repaid: 5 }));
    expect(cardState.markers.some((entry) => entry && entry.id === marker.id)).toBe(false);
    expect(gameState.board[2][3]).toBe(SharedConstants.BLACK);
  });

  test('living will cannot be applied to observer manifestation stone', () => {
    const prng = { shuffle: (arr) => arr, random: () => 0.5 };
    const cardState = CardLogic.createCardState(prng, { plainReversi: true });
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
      currentPlayer: SharedConstants.BLACK,
      turnNumber: 20,
      consecutivePasses: 0
    };
    cardState.debugNoDraw = true;
    cardState.charge.black = 10;
    gameState.board[2][3] = SharedConstants.BLACK;
    const marker = CardLogic.addMarker(cardState, 'manifestStone', 2, 3, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 1,
      repaymentIndex: 0,
      stolenCardId: 'guard_01'
    });
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      markerId: marker.id,
      repaymentAmount: 5,
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    });
    cardState.pendingEffectByPlayer.black = {
      type: 'LIVING_WILL',
      stage: 'selectTarget',
      cardId: 'living_will_01'
    };
    expect(CardLogic.getLivingWillTargets(cardState, gameState, 'black')).not.toContainEqual({ row: 2, col: 3 });
    expect(CardLogic.applyLivingWill(cardState, gameState, 'black', 2, 3)).toMatchObject({
      applied: false,
      reason: 'invalid_target'
    });

    const observerMarkers = (cardState.markers || []).filter((entry) => (
      entry &&
      entry.row === 2 &&
      entry.col === 3 &&
      entry.data &&
      entry.data.type === 'OBSERVER_WILL'
    ));
    const livingWillMarkers = (cardState.markers || []).filter((entry) => (
      entry &&
      entry.row === 2 &&
      entry.col === 3 &&
      entry.data &&
      entry.data.type === 'LIVING_WILL'
    ));

    expect(observerMarkers).toHaveLength(1);
    expect(observerMarkers[0].data.remainingOwnerTurns).toBe(1);
    expect(livingWillMarkers).toHaveLength(0);
    expect(cardState.charge.black).toBe(10);
    expect(cardState.observerWillRepaymentsByPlayer.black).toEqual([
      expect.objectContaining({
        sourceType: 'OBSERVER_WILL',
        status: 'waiting_for_marker_expire',
        repaymentAmount: 5,
        remainingOwnerTurns: 9
      })
    ]);
  });
});
