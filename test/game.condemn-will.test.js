const Shared = require('../shared-constants');
const CardLogic = require('../game/logic/cards');

function createState() {
  const cardState = CardLogic.createCardState({ shuffle: (arr) => arr });
  cardState.charge.black = 30;
  cardState.charge.white = 30;
  return cardState;
}

describe('CONDEMN_WILL core behavior', () => {
  test('reveals opponent hand offers and destroys selected card by hand index', () => {
    const condemn = Shared.CARD_DEFS.find((c) => c && c.type === 'CONDEMN_WILL');
    expect(condemn).toBeTruthy();

    const cs = createState();
    cs.hands.black = [condemn.id];
    cs.hands.white = ['silver_stone', 'silver_stone', 'gold_stone'];

    const used = CardLogic.applyCardUsage(cs, 'black', condemn.id);
    expect(used).toBe(true);

    const pending = cs.pendingEffectByPlayer.black;
    expect(pending).toBeTruthy();
    expect(pending.type).toBe('CONDEMN_WILL');
    expect(Array.isArray(pending.offers)).toBe(true);
    expect(pending.offers.length).toBe(3);
    expect(pending.offers[1]).toEqual({ handIndex: 1, cardId: 'silver_stone' });

    const result = CardLogic.applyCondemnWill(cs, 'black', 1);
    expect(result.applied).toBe(true);
    expect(result.destroyedCardId).toBe('silver_stone');
    expect(cs.pendingEffectByPlayer.black).toBeNull();
    expect(cs.hands.white).toEqual(['silver_stone', 'gold_stone']);
    expect(cs.discard.includes(condemn.id)).toBe(true);
    expect(cs.discard.includes('silver_stone')).toBe(true);
  });

  test('cannot use when opponent hand is empty', () => {
    const condemn = Shared.CARD_DEFS.find((c) => c && c.type === 'CONDEMN_WILL');
    expect(condemn).toBeTruthy();

    const cs = createState();
    cs.hands.black = [condemn.id];
    cs.hands.white = [];

    const used = CardLogic.applyCardUsage(cs, 'black', condemn.id);
    expect(used).toBe(false);
    expect(cs.pendingEffectByPlayer.black).toBeNull();
  });
});
