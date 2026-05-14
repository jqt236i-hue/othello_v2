describe('DebugActions.fillDebugHand', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('adds every unique card id from the catalog, not just one per type', () => {
    jest.isolateModules(() => {
      jest.doMock('../shared-constants', () => ({
        CARD_DEFS: [
          { id: 'alpha_01', type: 'utility' },
          { id: 'alpha_02', type: 'utility' },
          { id: 'beta_01', type: 'attack' },
          { id: 'gamma_01', type: 'attack' },
          { id: 'beta_01', type: 'attack' }
        ]
      }), { virtual: false });

      const DebugActions = require('../game/debug/debug-actions.js');
      const cardState = {
        hands: {
          black: ['alpha_01'],
          white: []
        }
      };

      expect(DebugActions.fillDebugHand(cardState, { fillWhite: true })).toBe(true);
      expect(cardState.hands.black).toEqual(['alpha_01', 'alpha_02', 'beta_01', 'gamma_01']);
      expect(cardState.hands.white).toEqual(['alpha_01', 'alpha_02', 'beta_01', 'gamma_01']);
      expect(cardState.debugHandFilled).toBe(true);
      expect(cardState.debugNoDraw).toBe(true);
    });
  });

  test('can replace only the requested player hand with specific card ids', () => {
    jest.isolateModules(() => {
      jest.doMock('../shared-constants', () => ({
        CARD_DEFS: [
          { id: 'alpha_01', type: 'utility' },
          { id: 'beta_01', type: 'attack' },
          { id: 'gamma_01', type: 'attack' }
        ]
      }), { virtual: false });

      const DebugActions = require('../game/debug/debug-actions.js');
      const cardState = {
        hands: {
          black: ['legacy_01', 'alpha_01'],
          white: ['white_old_01']
        }
      };

      expect(DebugActions.fillDebugHand(cardState, {
        playerKey: 'black',
        cardIds: ['beta_01', 'alpha_01', 'beta_01'],
        replaceExisting: true
      })).toBe(true);
      expect(cardState.hands.black).toEqual(['beta_01', 'alpha_01']);
      expect(cardState.hands.white).toEqual(['white_old_01']);
      expect(cardState.debugHandFilled).toBe(true);
      expect(cardState.debugNoDraw).toBe(true);
    });
  });
});
