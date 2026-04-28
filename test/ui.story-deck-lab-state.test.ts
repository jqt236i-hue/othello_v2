import * as StoryDeckLabStateModule from '../ui/story-deck-lab/story-deck-lab-state.js';
import * as StoryDeckSpecHelpers from '../shared/story-deck-spec.js';

describe('story deck lab state', () => {
  test('free30 allows more than 3 copies of the same card', () => {
    const targetCardId = StoryDeckSpecHelpers.getEnabledCardDefs()[0].id;
    let draft = StoryDeckLabStateModule.createEmptyDraft('free30');

    for (let index = 0; index < 5; index += 1) {
      draft = StoryDeckLabStateModule.addCardToDraft(draft, targetCardId);
    }

    expect(StoryDeckLabStateModule.getSelectedCount(draft, targetCardId)).toBe(5);
  });

  test('unique30 clamps duplicate copies to one when switching rule set', () => {
    const targetCardId = StoryDeckSpecHelpers.getEnabledCardDefs()[0].id;
    let draft = StoryDeckLabStateModule.createEmptyDraft('free30');

    draft = StoryDeckLabStateModule.addCardToDraft(draft, targetCardId);
    draft = StoryDeckLabStateModule.addCardToDraft(draft, targetCardId);
    draft = StoryDeckLabStateModule.setRuleSetId(draft, 'unique30');

    expect(StoryDeckLabStateModule.getSelectedCount(draft, targetCardId)).toBe(1);
    expect(StoryDeckLabStateModule.canAddCardToDraft(draft, targetCardId)).toBe(false);
  });

  test('draft can round-trip through story deck spec', () => {
    const cardIds = StoryDeckSpecHelpers.getEnabledCardDefs()
      .slice(0, 2)
      .flatMap((cardDef, index) => new Array(index === 0 ? 14 : 16).fill(cardDef.id));

    const originalDraft = StoryDeckLabStateModule.createDraftFromStoryDeckSpec(
      StoryDeckSpecHelpers.createStoryDeckSpecFromCardIds(cardIds, { ruleSetId: 'free30' })
    );
    const deckSpec = StoryDeckLabStateModule.createStoryDeckSpecFromDraft(originalDraft);
    const restoredDraft = StoryDeckLabStateModule.createDraftFromStoryDeckSpec(deckSpec);

    expect(restoredDraft).toEqual(originalDraft);
  });
});
