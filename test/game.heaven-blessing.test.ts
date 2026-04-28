import * as Shared from '../shared-constants.js';
import * as CardLogic from '../game/logic/cards.js';
import * as TurnPipeline from '../game/turn/turn_pipeline.js';

function createState() {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
  cardState.charge.black = 30;
  cardState.charge.white = 30;
  return cardState;
}

describe('HEAVEN_BLESSING core behavior', () => {
  test('offers are unique, exclude self, and selected card is added to hand', () => {
    const heaven = Shared.CARD_DEFS.find((c) => c && c.type === 'HEAVEN_BLESSING');
    expect(heaven).toBeTruthy();

    const cs = createState();
    cs.hands.black = [heaven.id];

    const used = CardLogic.applyCardUsage(cs, 'black', heaven.id);
    expect(used).toBe(true);

    const pending = cs.pendingEffectByPlayer.black;
    expect(pending).toBeTruthy();
    expect(pending.type).toBe('HEAVEN_BLESSING');
    expect(Array.isArray(pending.offers)).toBe(true);
    expect(pending.offers.length).toBeGreaterThan(0);
    expect(pending.offers.length).toBeLessThanOrEqual(5);
    expect(new Set(pending.offers).size).toBe(pending.offers.length);
    expect(pending.offers.includes(heaven.id)).toBe(false);

    const pick = pending.offers[0];
    const result = CardLogic.applyHeavenBlessingChoice(cs, 'black', pick);
    expect(result.applied).toBe(true);
    expect(cs.pendingEffectByPlayer.black).toBeNull();
    expect(cs.hands.black.includes(pick)).toBe(true);
    expect(cs.discard.includes(heaven.id)).toBe(true);
    expect(cs.discard.includes(pick)).toBe(false);
  });

  test('generated-only throw-chain cards are excluded from offers', () => {
    const heaven = Shared.CARD_DEFS.find((c) => c && c.type === 'HEAVEN_BLESSING');
    expect(heaven).toBeTruthy();

    const cs = createState();
    cs.hands.black = [heaven.id];

    const used = CardLogic.applyCardUsage(cs, 'black', heaven.id);
    expect(used).toBe(true);

    const pending = cs.pendingEffectByPlayer.black;
    expect(pending).toBeTruthy();
    expect(pending.offers).not.toEqual(expect.arrayContaining(['triple_01', 'quad_01', 'infinite_01']));
  });

  test('cannot select when hand is full', () => {
    const cs = createState();
    cs.hands.black = ['a', 'b', 'c', 'd', 'e'];
    cs.pendingEffectByPlayer.black = {
      type: 'HEAVEN_BLESSING',
      stage: 'selectTarget',
      offers: ['gold_stone']
    };

    const result = CardLogic.applyHeavenBlessingChoice(cs, 'black', 'gold_stone');
    expect(result.applied).toBe(false);
    expect(result.reason).toBe('hand_full');
    expect(cs.pendingEffectByPlayer.black).not.toBeNull();
  });

  test('turn pipeline resolves selection action without placing a stone', () => {
    const heaven = Shared.CARD_DEFS.find((c) => c && c.type === 'HEAVEN_BLESSING');
    expect(heaven).toBeTruthy();

    const prng = { shuffle: (arr) => arr, random: () => 0 };
    const cs = CardLogic.createCardState(prng);
    const gs = {
      board: Array.from({ length: 8 }, () => Array(8).fill(0)),
      currentPlayer: Shared.BLACK,
      turnNumber: 1,
      consecutivePasses: 0
    };
    cs.debugNoDraw = true;
    cs.charge.black = 30;
    cs.hands.black = [heaven.id];

    TurnPipeline.applyTurn(
      cs,
      gs,
      'black',
      { type: 'use_card', useCardId: heaven.id, useCardOwnerKey: 'black' },
      prng,
      { skipTurnStart: true }
    );

    const selectedCardId = cs.pendingEffectByPlayer.black.offers[0];
    const selectRes = TurnPipeline.applyTurn(
      cs,
      gs,
      'black',
      { type: 'place', heavenBlessingCardId: selectedCardId },
      prng,
      { skipTurnStart: true }
    );

    expect(selectRes.events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type: 'heaven_blessing_selected',
        player: 'black',
        selectedCardId,
        applied: true
      })
    ]));
    expect(cs.pendingEffectByPlayer.black).toBeNull();
    expect(cs.hands.black).toContain(selectedCardId);
    expect(cs.hands.black).not.toContain(heaven.id);
    expect(cs.discard).toContain(heaven.id);
    expect(gs.board.flat().every((cell) => cell === 0)).toBe(true);
  });
});
