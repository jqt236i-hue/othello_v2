import * as CardLogic from '../game/logic/cards.js';

describe('special stone duration constants', () => {
  test('uses the configured owner-turn durations for the updated special stones', () => {
    expect(CardLogic.ULTIMATE_DRAGON_TURNS).toBe(8);
    expect(CardLogic.STONE_SALVATION_GOD_TURNS).toBe(12);
    expect(CardLogic.ULTIMATE_HYPERACTIVE_TURNS).toBe(12);
    expect(CardLogic.ULTIMATE_DESTROY_GOD_TURNS).toBe(6);
    expect(CardLogic.GHOST_WILL_TURNS).toBe(8);
    expect(CardLogic.LIGHTNING_WILL_TURNS).toBe(6);
    expect(CardLogic.SNIPER_WILL_TURNS).toBe(6);
    expect(CardLogic.STRONG_WILL_PROMOTION_OWNER_TURNS).toBe(20);
  });
});
