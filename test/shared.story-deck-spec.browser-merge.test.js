const fs = require('fs');
const path = require('path');
const vm = require('vm');

describe('shared story deck spec browser merge', () => {
  test('browser build supplements SharedConstants defs with CardCatalog japanese names', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'shared', 'story-deck-spec.js'), 'utf8');
    const sandbox = {
      self: {
        SharedConstants: {
          CARD_DEFS: [
            { id: 'taboo_reverse_01', type: 'TABOO_REVERSE_WILL', cost: 44, enabled: true }
          ]
        },
        CardCatalog: {
          version: 1,
          cards: [
            {
              id: 'taboo_reverse_01',
              name_ja: '禁忌の反転',
              desc_ja: '次に置く石は挟めなくても反転可能。'
            }
          ]
        }
      },
      console
    };
    sandbox.globalThis = sandbox.self;

    vm.runInNewContext(source, sandbox);

    const defs = sandbox.self.StoryDeckSpecHelpers.getEnabledCardDefs();
    expect(defs).toHaveLength(1);
    expect(defs[0].name).toBe('禁忌の反転');
    expect(defs[0].name_ja).toBe('禁忌の反転');
    expect(defs[0].desc).toBe('次に置く石は挟めなくても反転可能。');
  });
});
