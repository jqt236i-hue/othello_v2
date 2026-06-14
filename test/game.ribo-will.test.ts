import * as TurnPipeline from '../game/turn/turn_pipeline.js';
import * as CardLogic from '../game/logic/cards.js';
import * as SharedConstants from '../shared-constants.js';

function makeState(randomValue = 0.5) {
  const prng = {
    shuffle: () => {},
    random: () => randomValue
  };
  const cardState = CardLogic.createCardState(prng);
  const gameState = {
    board: Array.from({ length: 8 }, () => Array(8).fill(SharedConstants.EMPTY)),
    currentPlayer: SharedConstants.BLACK,
    turnNumber: 1,
    consecutivePasses: 0
  };
  return { prng, cardState, gameState };
}

describe('RIBO_WILL（リボ払いの意志）', () => {
  const riboDef = (SharedConstants.CARD_DEFS || []).find((card) => card && card.type === 'RIBO_WILL');

  test('18手経過後にのみ使用できる', () => {
    expect(riboDef).toBeTruthy();

    const { cardState, gameState } = makeState();
    cardState.hands.black = [riboDef.id];
    cardState.charge.black = 0;
    cardState.turnIndex = 18;

    expect(CardLogic.canUseCard(cardState, 'black', riboDef.id)).toBe(false);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([]);
    expect(CardLogic.applyCardUsage(cardState, gameState, 'black', riboDef.id)).toBe(false);

    cardState.turnIndex = 19;

    expect(CardLogic.canUseCard(cardState, 'black', riboDef.id)).toBe(true);
    expect(CardLogic.getUsableCardIds(cardState, gameState, 'black')).toEqual([riboDef.id]);
  });

  test('使用時に布石30を得て、9ターンの返済を起動する', () => {
    expect(riboDef).toBeTruthy();

    const { prng, cardState, gameState } = makeState();
    cardState.debugNoDraw = true;
    cardState.turnIndex = 19;
    cardState.lastTurnStartedFor = 'black';
    cardState.hands.black = [riboDef.id];
    cardState.charge.black = 0;

    const action = { type: 'use_card', useCardId: riboDef.id };
    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', action, prng);

    expect(res.events.some((event) => event && event.type === 'card_used' && event.cardId === riboDef.id)).toBe(true);
    expect(res.events).toContainEqual(expect.objectContaining({
      type: 'ribo_will_resolved',
      player: 'black',
      gained: 30,
      repaymentAmount: 4,
      remainingOwnerTurns: 9
    }));
    expect(cardState.pendingEffectByPlayer.black).toBeNull();
    expect(cardState.charge.black).toBe(30);
    expect(cardState.riboRepaymentsByPlayer.black).toEqual([
      expect.objectContaining({
        remainingOwnerTurns: 9,
        repaymentAmount: 4,
        shortageDestroyCount: 4
      })
    ]);
    expect(cardState.discard).toContain(riboDef.id);
  });

  test('自ターン開始時、布石が足りていれば4返済して残りターンを減らす', () => {
    const { prng, cardState, gameState } = makeState();
    cardState.debugNoDraw = true;
    cardState.lastTurnStartedFor = 'white';
    cardState.charge.black = 10;
    cardState.riboRepaymentsByPlayer.black = [{
      remainingOwnerTurns: 9,
      repaymentAmount: 4,
      shortageDestroyCount: 4
    }];

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' }, prng);
    const repayEvent = res.events.find((event) => event && event.type === 'ribo_will_repaid');

    expect(repayEvent).toMatchObject({
      player: 'black',
      repaid: 4,
      remainingOwnerTurns: 8,
      completed: false
    });
    expect(cardState.charge.black).toBe(6);
    expect(cardState.chargeDeltaEvents).toEqual([
      { seq: 1, player: 'black', delta: -4, before: 10, after: 6, reason: 'ribo_will_repayment' }
    ]);
    expect(cardState.riboRepaymentsByPlayer.black).toEqual([
      expect.objectContaining({
        remainingOwnerTurns: 8,
        repaymentAmount: 4,
        shortageDestroyCount: 4
      })
    ]);
  });

  test('布石不足ならランダム4個まで自石を破壊し、布石は減らない', () => {
    const { prng, cardState, gameState } = makeState(0);
    cardState.debugNoDraw = true;
    cardState.lastTurnStartedFor = 'white';
    cardState.charge.black = 3;
    cardState.riboRepaymentsByPlayer.black = [{
      remainingOwnerTurns: 9,
      repaymentAmount: 4,
      shortageDestroyCount: 4
    }];

    gameState.board[0][0] = SharedConstants.BLACK;
    gameState.board[0][1] = SharedConstants.BLACK;
    gameState.board[0][2] = SharedConstants.BLACK;
    gameState.board[0][3] = SharedConstants.BLACK;
    gameState.board[0][4] = SharedConstants.BLACK;

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' }, prng);
    const shortageEvent = res.events.find((event) => event && event.type === 'ribo_will_shortage');
    const destroyEvents = (res.presentationEvents || []).filter((event) => (
      event &&
      event.type === 'DESTROY' &&
      event.cause === 'RIBO_WILL' &&
      event.reason === 'ribo_repayment_shortage'
    ));

    expect(shortageEvent).toMatchObject({
      player: 'black',
      destroyedCount: 4,
      remainingOwnerTurns: 8,
      completed: false
    });
    expect(cardState.charge.black).toBe(3);
    expect(gameState.board[0][0]).toBe(SharedConstants.EMPTY);
    expect(gameState.board[0][1]).toBe(SharedConstants.EMPTY);
    expect(gameState.board[0][2]).toBe(SharedConstants.EMPTY);
    expect(gameState.board[0][3]).toBe(SharedConstants.EMPTY);
    expect(gameState.board[0][4]).toBe(SharedConstants.BLACK);
    expect(destroyEvents).toHaveLength(4);
  });

  test('布石不足のランダム自石破壊は絶対保護・不可侵・守護・凍結を候補にしない', () => {
    const { prng, cardState, gameState } = makeState(0);
    cardState.debugNoDraw = true;
    cardState.lastTurnStartedFor = 'white';
    cardState.charge.black = 0;
    cardState.riboRepaymentsByPlayer.black = [{
      remainingOwnerTurns: 9,
      repaymentAmount: 4,
      shortageDestroyCount: 4
    }];
    for (let col = 0; col < 8; col += 1) gameState.board[0][col] = SharedConstants.BLACK;
    CardLogic.addMarker(cardState, 'specialStone', 0, 0, 'black', { type: 'ABSOLUTE_PROTECTED', remainingOwnerTurns: 5 });
    CardLogic.addMarker(cardState, 'manifestStone', 0, 1, 'black', { type: 'THEORY_INCARNATION', remainingOwnerTurns: 5, absoluteProtected: true });
    CardLogic.addMarker(cardState, 'specialStone', 0, 2, 'black', { type: 'GUARD', remainingOwnerTurns: 3 });
    CardLogic.addMarker(cardState, 'specialStone', 0, 3, 'black', { type: 'FREEZE', remainingOwnerTurns: 2 });

    const res = TurnPipeline.applyTurn(cardState, gameState, 'black', { type: 'pass' }, prng);
    const shortageEvent = res.events.find((event) => event && event.type === 'ribo_will_shortage');

    expect(shortageEvent).toMatchObject({ destroyedCount: 4, remainingOwnerTurns: 8 });
    expect(gameState.board[0][0]).toBe(SharedConstants.BLACK);
    expect(gameState.board[0][1]).toBe(SharedConstants.BLACK);
    expect(gameState.board[0][2]).toBe(SharedConstants.BLACK);
    expect(gameState.board[0][3]).toBe(SharedConstants.BLACK);
    expect(gameState.board[0][4]).toBe(SharedConstants.EMPTY);
    expect(gameState.board[0][5]).toBe(SharedConstants.EMPTY);
    expect(gameState.board[0][6]).toBe(SharedConstants.EMPTY);
    expect(gameState.board[0][7]).toBe(SharedConstants.EMPTY);
  });

  test('9回の自ターン開始で効果が終了する', () => {
    const { prng, cardState, gameState } = makeState();
    cardState.debugNoDraw = true;
    cardState.charge.black = 40;
    cardState.riboRepaymentsByPlayer.black = [{
      remainingOwnerTurns: 9,
      repaymentAmount: 4,
      shortageDestroyCount: 4
    }];

    let lastSummary = null;
    for (let i = 0; i < 9; i += 1) {
      lastSummary = CardLogic.onTurnStart(cardState, 'black', gameState, prng);
    }

    expect(cardState.charge.black).toBe(4);
    expect(cardState.riboRepaymentsByPlayer.black).toEqual([]);
    expect(lastSummary && lastSummary.ribo && lastSummary.ribo.completedCount).toBe(1);
  });
});
