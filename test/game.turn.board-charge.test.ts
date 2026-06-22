import * as TurnBoardCharge from '../game/turn/board-charge.js';

describe('turn board charge helpers', () => {
  test('addChargeWithTotal applies generated gain multiplier before the cap', () => {
    const cardState = {
      charge: { black: 10, white: 0 },
      chargeGainMultiplierByPlayer: { black: 2, white: 1 },
      chargeGainedTotal: { black: 0, white: 0 }
    };

    const added = TurnBoardCharge.addChargeWithTotal(cardState, 'black', 3, { reason: 'test_gain' }, {
      CardUtilsModule: null,
      chargeMax: 99
    });

    expect(added).toBe(6);
    expect(cardState.charge.black).toBe(16);
    expect(cardState.chargeGainedTotal.black).toBe(6);
  });

  test('transferChargeBetweenPlayers does not multiply transferred opponent charge', () => {
    const cardState = {
      charge: { black: 10, white: 0 },
      chargeGainMultiplierByPlayer: { black: 1, white: 2 },
      chargeGainedTotal: { black: 0, white: 0 }
    };

    const moved = TurnBoardCharge.transferChargeBetweenPlayers(cardState, 'black', 'white', 3, 'test_transfer', {
      CardUtilsModule: null,
      chargeMax: 99
    });

    expect(moved).toBe(3);
    expect(cardState.charge).toEqual({ black: 7, white: 3 });
    expect(cardState.chargeGainedTotal).toEqual({ black: 0, white: 3 });
  });
});
