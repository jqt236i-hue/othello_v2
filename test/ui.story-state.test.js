const StoryStateModule = require('../ui/story/story-state');

describe('story state subscriptions', () => {
  afterEach(() => {
    StoryStateModule.resetState();
  });

  test('subscribe receives chapter and encounter updates', () => {
    const snapshots = [];
    const unsubscribe = StoryStateModule.publicApi.subscribe((state) => {
      snapshots.push({
        chapterId: state.chapterId,
        mode: state.mode,
        encounterActive: !!(state.encounter && state.encounter.active)
      });
    });

    StoryStateModule.beginChapter({
      chapterId: 'chapter1',
      stepId: 'STEP_001',
      mode: 'dialogue'
    });
    StoryStateModule.setEncounterState({
      active: true,
      encounterId: 'chapter1_goblin'
    });
    StoryStateModule.resetState();
    unsubscribe();

    expect(snapshots).toEqual([
      { chapterId: 'chapter1', mode: 'dialogue', encounterActive: false },
      { chapterId: 'chapter1', mode: 'dialogue', encounterActive: true },
      { chapterId: null, mode: 'idle', encounterActive: false }
    ]);
  });
});
