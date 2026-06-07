const SpecialCardRegistry = require('../shared/special-card-registry');

describe('SpecialCardRegistry', () => {
  test('finds presentation by marker type', () => {
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('OBSERVER_WILL')).toEqual(expect.objectContaining({
      cardId: 'observer_will_01',
      markerType: 'OBSERVER_WILL',
      displayName: '盤理の観測者',
      manifestBgmKey: 'observer_will_path',
      manifestBgmTrack: expect.objectContaining({
        name: '観測の道',
        file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3',
        loopStart: 9.6,
        loopEnd: 62.4
      })
    }));
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('THEORY_INCARNATION')).toEqual(expect.objectContaining({
      cardId: 'theory_incarnation_01',
      markerType: 'THEORY_INCARNATION',
      displayName: '理論の化身',
      manifestBgmKey: 'theory_incarnation_path',
      manifestBgmTrack: expect.objectContaining({
        name: '理論の道',
        file: 'assets/audio/bgm/manifest-stones/理論の道-BPM135.mp3',
        loopStart: 0,
        loopEnd: 28.444444
      })
    }));
    expect(SpecialCardRegistry.getSpecialCardPresentationByMarkerType('GHOST')).toBeNull();
  });
});
