const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');
const TurnPipeline = require('../game/turn/turn_pipeline');
const BoardOps = require('../game/logic/board_ops');

function createPrng(sequence = [0.5]) {
  let index = 0;
  return {
    shuffle: (arr) => arr,
    random: () => {
      const safeIndex = Math.min(index, sequence.length - 1);
      const value = sequence[safeIndex];
      index += 1;
      return value;
    }
  };
}

function createGameState() {
  return {
    board: Array.from({ length: 8 }, () => Array(8).fill(Shared.EMPTY)),
    currentPlayer: Shared.BLACK,
    turnNumber: 1,
    consecutivePasses: 2
  };
}

function createCardState(prng, cardId, chargeByPlayer = { black: 0, white: 25 }) {
  const cardState = CardLogic.createCardState(prng);
  cardState.debugNoDraw = true;
  cardState.hands.black = [cardId];
  cardState.charge.black = Number(chargeByPlayer.black) || 0;
  cardState.charge.white = Number(chargeByPlayer.white) || 0;
  cardState.chargeGainedTotal.black = 0;
  cardState.chargeGainedTotal.white = 0;
  cardState.chargeDeltaEvents = [];
  cardState._nextChargeDeltaSeq = 1;
  return cardState;
}

function getEqualityWillDef() {
  return (Shared.CARD_DEFS || []).find((card) => card && card.type === 'EQUALITY_WILL');
}

function getLatestEqualityResolvedEvent(result) {
  const resolved = (result.events || []).filter((event) => event && event.type === 'equality_will_resolved');
  return resolved.length > 0 ? resolved[resolved.length - 1] : null;
}

describe('EQUALITY_WILL（平等の意志）', () => {
  const equalityWillDef = getEqualityWillDef();

  test('自分の布石が0なら使用可能', () => {
    expect(equalityWillDef).toBeTruthy();

    const prng = createPrng();
    const cardState = createCardState(prng, equalityWillDef.id, { black: 0, white: 25 });
    const gameState = createGameState();

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([equalityWillDef.id]);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', equalityWillDef.id)).toBe(true);
    expect(cardState.pendingEffectByPlayer.black).toEqual(expect.objectContaining({
      type: 'EQUALITY_WILL',
      cardId: equalityWillDef.id,
      stage: null
    }));
  });

  test('自分の布石が1以上なら使用不可', () => {
    expect(equalityWillDef).toBeTruthy();

    const prng = createPrng();
    const cardState = createCardState(prng, equalityWillDef.id, { black: 1, white: 25 });
    const gameState = createGameState();

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', equalityWillDef.id)).toBe(false);
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
  });

  test('直接解決でも自分の布石が1以上なら奪取しない', () => {
    expect(equalityWillDef).toBeTruthy();

    const prng = createPrng();
    const cardState = createCardState(prng, equalityWillDef.id, { black: 1, white: 25 });
    const gameState = createGameState();

    const result = CardLogic.resolveEqualityWillUsage(cardState, gameState, 'black');

    expect(result).toEqual(expect.objectContaining({
      applied: false,
      reason: 'own_charge_not_zero',
      requestedAmount: 10,
      stolenAmount: 0,
      playerChargeBefore: 1,
      playerChargeAfter: 1,
      opponentChargeBefore: 25,
      opponentChargeAfter: 25
    }));
    expect(cardState.charge.black).toBe(1);
    expect(cardState.charge.white).toBe(25);
    expect(cardState.chargeDeltaEvents).toEqual([]);
  });

  test('相手布石25なら10奪い、自分10・相手15になる', () => {
    expect(equalityWillDef).toBeTruthy();

    const prng = createPrng();
    const cardState = createCardState(prng, equalityWillDef.id, { black: 0, white: 25 });
    const gameState = createGameState();
    const spawnSpy = jest.spyOn(BoardOps, 'spawnAt');

    try {
      const result = TurnPipeline.applyTurn(
        cardState,
        gameState,
        'black',
        { type: 'use_card', useCardId: equalityWillDef.id },
        prng
      );

      const resolveEvent = getLatestEqualityResolvedEvent(result);

      expect(result.cardState.pendingEffectByPlayer.black).toBeNull();
      expect(result.cardState.charge.black).toBe(10);
      expect(result.cardState.charge.white).toBe(15);
      expect(result.cardState.chargeGainedTotal.black).toBe(10);
      expect(resolveEvent).toMatchObject({
        type: 'equality_will_resolved',
        player: 'black',
        opponent: 'white',
        requestedAmount: 10,
        stolenAmount: 10,
        playerChargeBefore: 0,
        playerChargeAfter: 10,
        opponentChargeBefore: 25,
        opponentChargeAfter: 15
      });
      expect(result.presentationEvents || []).toEqual(expect.not.arrayContaining([
        expect.objectContaining({ cause: 'EQUALITY_WILL', reason: 'equality_will_spawn' }),
        expect.objectContaining({ cause: 'EQUALITY_WILL', reason: 'equality_will_flip' })
      ]));
      expect((result.events || []).some((event) => event && (event.type === 'spawn' || event.type === 'flip'))).toBe(false);
      expect(spawnSpy).not.toHaveBeenCalled();
      expect(gameState.consecutivePasses).toBe(2);
      expect(result.cardState.chargeDeltaEvents).toEqual(expect.arrayContaining([
        expect.objectContaining({ player: 'black', delta: 10, before: 0, after: 10, reason: 'equality_will_gain' }),
        expect.objectContaining({ player: 'white', delta: -10, before: 25, after: 15, reason: 'equality_will_loss' })
      ]));
    } finally {
      spawnSpy.mockRestore();
    }
  });

  test('相手布石7なら7奪い、自分7・相手0になる', () => {
    expect(equalityWillDef).toBeTruthy();

    const prng = createPrng();
    const cardState = createCardState(prng, equalityWillDef.id, { black: 0, white: 7 });
    const gameState = createGameState();

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: equalityWillDef.id },
      prng
    );

    expect(result.cardState.charge.black).toBe(7);
    expect(result.cardState.charge.white).toBe(0);
    expect(getLatestEqualityResolvedEvent(result)).toMatchObject({
      requestedAmount: 10,
      stolenAmount: 7,
      playerChargeBefore: 0,
      playerChargeAfter: 7,
      opponentChargeBefore: 7,
      opponentChargeAfter: 0
    });
  });

  test('相手布石0でも奪取量0として使用が成立する', () => {
    expect(equalityWillDef).toBeTruthy();

    const prng = createPrng();
    const cardState = createCardState(prng, equalityWillDef.id, { black: 0, white: 0 });
    const gameState = createGameState();

    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([equalityWillDef.id]);

    const result = TurnPipeline.applyTurn(
      cardState,
      gameState,
      'black',
      { type: 'use_card', useCardId: equalityWillDef.id },
      prng
    );

    expect(result.cardState.charge.black).toBe(0);
    expect(result.cardState.charge.white).toBe(0);
    expect(getLatestEqualityResolvedEvent(result)).toMatchObject({
      requestedAmount: 10,
      stolenAmount: 0,
      playerChargeBefore: 0,
      playerChargeAfter: 0,
      opponentChargeBefore: 0,
      opponentChargeAfter: 0
    });
  });

  test('布石ライブ状態 helper は使用者視点の自分・相手布石を返す', () => {
    const cardState = { charge: { black: 0, white: 25 } };

    expect(CardLogic.getEqualityWillChargeState(cardState, 'black')).toEqual({ own: 0, opponent: 25 });
    expect(CardLogic.getEqualityWillChargeState(cardState, 'white')).toEqual({ own: 25, opponent: 0 });
  });
});
