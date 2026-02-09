const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');

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
});
