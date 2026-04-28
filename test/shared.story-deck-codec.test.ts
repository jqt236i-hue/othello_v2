import * as SharedConstants from '../shared-constants.js';
import * as StoryDeckSpecHelpers from '../shared/story-deck-spec.js';
import * as StoryDeckCodecModule from '../shared/story-deck-codec.js';

function getEnabledIds(count) {
  const ids = (SharedConstants.CARD_DEFS || [])
    .filter((card) => card && card.enabled !== false && card.id)
    .map((card) => card.id)
    .slice(0, count);

  expect(ids).toHaveLength(count);
  return ids;
}

describe('shared story deck codec', () => {
  test('free30 deck encodes and decodes canonically even when duplicates exceed normal 3-copy limit', () => {
    const ids = getEnabledIds(2);
    const deckSpec = StoryDeckSpecHelpers.createStoryDeckSpecFromCardIds(
      new Array(12).fill(ids[0]).concat(new Array(18).fill(ids[1])),
      { ruleSetId: 'free30' }
    );

    const deckCode = StoryDeckCodecModule.encodeStoryDeckSpec(deckSpec);
    const decoded = StoryDeckCodecModule.decodeStoryDeckCode(deckCode);

    expect(deckCode.startsWith('SD1C')).toBe(true);
    expect(deckCode.includes('Rfree30:')).toBe(true);
    expect(decoded).toEqual(deckSpec);
    expect(StoryDeckSpecHelpers.expandStoryDeckSpec(decoded)).toHaveLength(30);
  });

  test('unique30 rejects duplicate cards', () => {
    const ids = getEnabledIds(29);
    const duplicatedDeckIds = ids.concat(ids[0]);

    expect(() => StoryDeckSpecHelpers.createStoryDeckSpecFromCardIds(duplicatedDeckIds, { ruleSetId: 'unique30' }))
      .toThrow(/1 枚まで/);
  });

  test('safeDecodeStoryDeckCode rejects malformed codes', () => {
    const result = StoryDeckCodecModule.safeDecodeStoryDeckCode('not-a-story-deck-code');

    expect(result.ok).toBe(false);
    expect(result.deckSpec).toBeNull();
    expect(result.error).toBeTruthy();
    expect(result.error.code).toBe('STORY_DECK_CODE_INVALID');
  });
});
