import * as chargeLedger from '../game/logic/cards-internal/charge-ledger.js';

describe('cards-internal charge-ledger', () => {
  test('setChargeValue initializes and clamps to configured max', () => {
    const cardState = {};

    const result = chargeLedger.setChargeValue(cardState, 'black', 120, 'test_reason', {
      helpers: { chargeMax: 99 }
    });

    expect(cardState.charge).toEqual({ black: 99, white: 0 });
    expect(result).toEqual({ changed: true, before: 0, after: 99, delta: 99 });
  });

  test('addChargeValue accumulates from existing charge', () => {
    const cardState = { charge: { black: 10, white: 3 } };

    const result = chargeLedger.addChargeValue(cardState, 'black', 7, 'gain', {
      helpers: { chargeMax: 99 }
    });

    expect(cardState.charge.black).toBe(17);
    expect(result).toEqual({ changed: true, before: 10, after: 17, delta: 7 });
  });

  test('addChargeWithTotal tracks only actual positive gain under cap', () => {
    const cardState = {
      charge: { black: 97, white: 0 },
      chargeGainedTotal: { black: 4, white: 0 }
    };

    const added = chargeLedger.addChargeWithTotal(cardState, 'black', 10, {
      helpers: { chargeMax: 99 }
    });

    expect(added).toBe(2);
    expect(cardState.charge.black).toBe(99);
    expect(cardState.chargeGainedTotal.black).toBe(6);
  });

  test('setChargeValue delegates to injected helper when available', () => {
    const helperResult = { changed: true, before: 1, after: 5, delta: 4 };
    const setChargeWithDelta = jest.fn().mockReturnValue(helperResult);
    const cardState = {};

    const result = chargeLedger.setChargeValue(cardState, 'white', 5, 'delegated', {
      helpers: { setChargeWithDelta }
    });

    expect(setChargeWithDelta).toHaveBeenCalledWith(cardState, 'white', 5, 'delegated');
    expect(result).toBe(helperResult);
  });
});