const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('special stone visual rule browser load order', () => {
  test('CardUtils still resolves special stone visuals when GameVisualEffectsMap loads later', () => {
    const context = {
      console,
      SharedConstants: require('../shared-constants'),
      OwnerHelpers: null,
      MarkersAdapter: {
        MARKER_KINDS: {
          SPECIAL_STONE: 'specialStone',
          BOMB: 'bomb'
        }
      }
    };
    context.globalThis = context;
    context.self = context;

    const utilsSource = fs.readFileSync(
      path.resolve(__dirname, '../game/logic/cards/utils.js'),
      'utf8'
    );
    vm.runInNewContext(utilsSource, context);

    context.GameVisualEffectsMap = require('../game/visual-effects-map');

    const cardState = {
      markers: [
        {
          id: 1,
          kind: 'specialStone',
          row: 2,
          col: 2,
          owner: 'white',
          data: { type: 'WORK', remainingOwnerTurns: 3 }
        }
      ]
    };

    expect(context.CardUtils.isSpecialStoneAt(cardState, 2, 2)).toBe(true);
    expect(context.CardUtils.getSpecialOwnerAt(cardState, 2, 2)).toBe('white');
  });
});
