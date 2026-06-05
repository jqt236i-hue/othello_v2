const CardLogic = require('../game/logic/cards.js');
const TurnPipeline = require('../game/turn/turn_pipeline.js');
const SharedConstants = require('../shared-constants.js');

function createPrng() {
  return { shuffle: (arr) => arr, random: () => 0 };
}

function createCardState() {
  return CardLogic.createCardState(createPrng(), { plainReversi: true });
}

function createGameState() {
  return {
    board: [
      [1, 1, 1, 1],
      [1, -1, -1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0]
    ],
    currentPlayer: 1,
    turnNumber: 20
  };
}

describe('OBSERVER_WILL repayments', () => {
  test('active repayment subtracts charge and decrements remaining turns', () => {
    const cardState = createCardState();
    const gameState = createGameState();
    cardState.charge.black = 7;
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      status: 'active',
      stolenCardId: 'meteor_01',
      repaymentAmount: 3,
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    });

    const summary = CardLogic.processObserverWillRepaymentsAtTurnStart(cardState, gameState, 'black', createPrng());

    expect(summary.entries[0]).toEqual(expect.objectContaining({
      repaid: 3,
      shortage: false,
      remainingOwnerTurnsAfter: 8
    }));
    expect(cardState.charge.black).toBe(4);
    expect(cardState.chargeDeltaEvents).toEqual([
      { seq: 1, player: 'black', delta: -3, before: 7, after: 4, reason: 'observer_will_repayment' }
    ]);
    expect(cardState.observerWillRepaymentsByPlayer.black[0].remainingOwnerTurns).toBe(8);
  });

  test('shortage destroys up to four own stones instead of subtracting charge', () => {
    const cardState = createCardState();
    const gameState = createGameState();
    cardState.charge.black = 1;
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      status: 'active',
      stolenCardId: 'meteor_01',
      repaymentAmount: 3,
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4
    });

    const summary = CardLogic.processObserverWillRepaymentsAtTurnStart(cardState, gameState, 'black', createPrng());

    expect(summary.entries[0]).toEqual(expect.objectContaining({
      shortage: true,
      destroyedCount: 4,
      remainingOwnerTurnsAfter: 8
    }));
    const blackCount = gameState.board.flat().filter((value) => value === 1).length;
    expect(blackCount).toBe(1);
  });

  test('marker expiry turn immediately applies the first repayment in turn pipeline', () => {
    const prng = createPrng();
    const cardState = CardLogic.createCardState(prng);
    const gameState = {
      board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
      currentPlayer: SharedConstants.BLACK,
      turnNumber: 20,
      consecutivePasses: 0
    };

    cardState.debugNoDraw = true;
    cardState.lastTurnStartedFor = 'white';
    cardState.charge.black = 10;
    gameState.board[2][3] = SharedConstants.BLACK;
    const marker = CardLogic.addMarker(cardState, 'specialStone', 2, 3, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 1,
      repaymentIndex: 0,
      stolenCardId: 'meteor_01'
    });
    cardState.observerWillRepaymentsByPlayer.black.push({
      sourceType: 'OBSERVER_WILL',
      status: 'waiting_for_marker_expire',
      stolenCardId: 'meteor_01',
      repaymentAmount: 5,
      remainingOwnerTurns: 9,
      shortageDestroyCount: 4,
      markerId: marker.id
    });

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' }, prng);
    const expiredIndex = res.events.findIndex((event) => event && event.type === 'observer_will_marker_expired');
    const repaidIndex = res.events.findIndex((event) => event && event.type === 'observer_will_repaid');

    expect(cardState.charge.black).toBe(5);
    expect(cardState.observerWillRepaymentsByPlayer.black).toEqual([
      expect.objectContaining({
        sourceType: 'OBSERVER_WILL',
        status: 'active',
        stolenCardId: 'meteor_01',
        repaymentAmount: 5,
        remainingOwnerTurns: 8,
        shortageDestroyCount: 4
      })
    ]);
    expect(expiredIndex).toBeGreaterThanOrEqual(0);
    expect(repaidIndex).toBeGreaterThanOrEqual(0);
    expect(expiredIndex).toBeLessThan(repaidIndex);
  });

  test('marker expiry activates the matching repayment when earlier entries were compacted', () => {
    const cardState = createCardState();
    const gameState = createGameState();
    cardState.charge.black = 20;
    gameState.board[2][2] = 1;

    cardState.observerWillRepaymentsByPlayer.black.push(
      {
        sourceType: 'OBSERVER_WILL',
        repaymentId: 'observer_will_repay_old',
        status: 'active',
        stolenCardId: 'gold_stone',
        repaymentAmount: 2,
        remainingOwnerTurns: 1,
        shortageDestroyCount: 4
      },
      {
        sourceType: 'OBSERVER_WILL',
        repaymentId: 'observer_will_repay_later',
        status: 'waiting_for_marker_expire',
        stolenCardId: 'meteor_01',
        repaymentAmount: 5,
        remainingOwnerTurns: 9,
        shortageDestroyCount: 4,
        markerId: null
      }
    );
    const marker = CardLogic.addMarker(cardState, 'specialStone', 2, 2, 'black', {
      type: 'OBSERVER_WILL',
      remainingOwnerTurns: 1,
      repaymentId: 'observer_will_repay_later',
      repaymentIndex: 1,
      stolenCardId: 'meteor_01'
    });
    cardState.observerWillRepaymentsByPlayer.black[1].markerId = marker.id;

    const summary = CardLogic.processObserverWillRepaymentsAtTurnStart(cardState, gameState, 'black', createPrng());
    expect(summary.completedCount).toBe(1);
    expect(cardState.observerWillRepaymentsByPlayer.black).toEqual([
      expect.objectContaining({
        repaymentId: 'observer_will_repay_later',
        status: 'waiting_for_marker_expire',
        remainingOwnerTurns: 9
      })
    ]);

    const markerRes = CardLogic.processObserverWillMarkerAtTurnStart(cardState, gameState, 'black', 2, 2, createPrng());

    expect(markerRes.repayment).toEqual(expect.objectContaining({
      stolenCardId: 'meteor_01',
      repaid: 5,
      remainingOwnerTurnsAfter: 8
    }));
    expect(cardState.charge.black).toBe(13);
    expect(cardState.observerWillRepaymentsByPlayer.black).toEqual([
      expect.objectContaining({
        repaymentId: 'observer_will_repay_later',
        status: 'active',
        remainingOwnerTurns: 8
      })
    ]);
  });
});
