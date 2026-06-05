const SpecialCardRegistry = require('../shared/special-card-registry.ts');
const DeckSpecHelpers = require('../shared/deck-spec.ts');

describe('special card registry', () => {
  test('classifies the three unique special cards as inviolable', () => {
    expect(SpecialCardRegistry.isInviolableSpecialCardId('theory_incarnation_01')).toBe(true);
    expect(SpecialCardRegistry.isInviolableSpecialCardId('board_executor_01')).toBe(true);
    expect(SpecialCardRegistry.isInviolableSpecialCardId('observer_will_01')).toBe(true);
    expect(SpecialCardRegistry.isInviolableSpecialCardId('gold_stone')).toBe(false);
  });

  test('exports the same card id list used by deck special-card constraints', () => {
    expect(SpecialCardRegistry.getInviolableSpecialCardIds()).toEqual([
      'theory_incarnation_01',
      'board_executor_01',
      'observer_will_01'
    ]);
    expect(DeckSpecHelpers.getSpecialFoundationCardIds()).toEqual(
      SpecialCardRegistry.getInviolableSpecialCardIds()
    );
  });

  test('exports observer will cinematic and manifestation BGM metadata', () => {
    expect(SpecialCardRegistry.getSpecialCardPresentation('observer_will_01')).toMatchObject({
      cardId: 'observer_will_01',
      markerType: 'OBSERVER_WILL',
      displayName: '盤理の観測者',
      cinematicKey: 'observer_will',
      quote: '我が観測をもって、悲しき輪廻に新たな一手を示そう',
      quoteLines: [
        '我が観測をもって、悲しき',
        '輪廻に新たな一手を示そう'
      ],
      manifestBgmKey: 'observer_will_path',
      manifestBgmTrack: {
        name: '観測の道',
        file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3'
      }
    });
  });

  test('exports manifestation world background metadata for all special cards', () => {
    expect(SpecialCardRegistry.getSpecialCardPresentation('theory_incarnation_01')).toMatchObject({
      markerType: 'THEORY_INCARNATION',
      manifestBackgroundKey: 'theory_incarnation_world',
      manifestBackgroundImage: 'assets/images/background/manifest-worlds/理論の世界.png',
      characterImage: 'assets/images/special-cards/characters/theory_incarnation.png'
    });
    expect(SpecialCardRegistry.getSpecialCardPresentation('board_executor_01')).toMatchObject({
      markerType: 'BOARD_EXECUTOR',
      manifestBackgroundKey: 'board_executor_world',
      manifestBackgroundImage: 'assets/images/background/manifest-worlds/執行の世界.png',
      characterImage: 'assets/images/special-cards/characters/board_executor.png'
    });
    expect(SpecialCardRegistry.getSpecialCardPresentation('observer_will_01')).toMatchObject({
      markerType: 'OBSERVER_WILL',
      manifestBackgroundKey: 'observer_will_world',
      manifestBackgroundImage: 'assets/images/background/manifest-worlds/観測の世界.png',
      characterImage: 'assets/images/special-cards/characters/observer_will.png'
    });
  });
});
