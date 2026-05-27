import { createCardFateEffect } from '../game/logic/cards-internal/fate-effect.js';

describe('card fate effect module', () => {
  test('getFateWillControllerForTurnOwner reads only black/white keys safely', () => {
    const effect = createCardFateEffect();
    const cardState = {
      fateWillControllerByTurnOwner: { black: null, white: 'black' }
    };

    expect(effect.getFateWillControllerForTurnOwner(cardState, 'white')).toBe('black');
    expect(effect.getFateWillControllerForTurnOwner(cardState, 'black')).toBeNull();
    expect(effect.getFateWillControllerForTurnOwner(cardState, 'invalid')).toBeNull();
    expect(effect.getFateWillControllerForTurnOwner(null, 'white')).toBeNull();
  });

  test('applyFateWill initializes map, blocks stacking, and clears pending', () => {
    const clearPending = jest.fn();
    const effect = createCardFateEffect({
      readCardPendingEffect: () => ({ type: 'FATE_WILL' }),
      clearCardPendingEffect: clearPending
    });
    const cardState: any = {};

    const first = effect.applyFateWill(cardState, 'black');
    expect(first).toEqual({
      applied: true,
      stacked: false,
      controllerKey: 'black',
      turnOwnerKey: 'white'
    });
    expect(cardState.fateWillControllerByTurnOwner).toEqual({ black: null, white: 'black' });

    const second = effect.applyFateWill(cardState, 'black');
    expect(second).toEqual({
      applied: true,
      stacked: true,
      controllerKey: 'black',
      turnOwnerKey: 'white'
    });
    expect(cardState.fateWillControllerByTurnOwner).toEqual({ black: null, white: 'black' });
    expect(clearPending).toHaveBeenCalledTimes(2);
  });
});
