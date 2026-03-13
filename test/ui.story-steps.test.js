const StoryStepsModule = require('../ui/story/story-steps');

describe('story steps data', () => {
  test('chapter1 keeps fixed opening, goblin encounter, and clear flags', () => {
    const chapter = StoryStepsModule.getChapter('chapter1');

    expect(chapter).toBeTruthy();
    expect(chapter.kind).toBe('story');
    expect(chapter.progressionGroup).toBe('story');
    expect(chapter.progressionId).toBe('chapter1');
    expect(chapter.entryStepId).toBe('CHAPTER1_STEP_001');
    expect(chapter.unlockRequirementTutorialId).toBe('chapter0');
    expect(chapter.unlocksChapterIds).toEqual(['chapter2']);

    const opening = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_001');
    const goblinChoice = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_011');
    const executioner = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_025');
    const completed = StoryStepsModule.getChapterStep('chapter1', 'CHAPTER1_STEP_030');

    expect(opening.sceneBackgroundSrc).toBe('assets/story/background/森背景.png');
    expect(opening.characterImageSrc).toBe('assets/story/hero/hero.png');
    expect(goblinChoice.choices.map((choice) => choice.label)).toEqual(['戦う', '逃げる']);
    expect(goblinChoice.actionByChoice.fight_goblin).toBe('start_goblin_encounter');
    expect(goblinChoice.nextByChoice.run_away).toBe('CHAPTER1_ESCAPE_001');
    expect(executioner.supportImageSrc).toBe('assets/story/stones/ULTIMATE_DESTROY_GOD-white.png');
    expect(completed.result).toEqual({
      saveStoryChapterCleared: true,
      unlockStoryChapterIds: ['chapter2']
    });
  });

  test('chapter2 keeps recap, village/library scenes, and chapter3 unlock flags', () => {
    const chapter = StoryStepsModule.getChapter('chapter2');

    expect(chapter).toBeTruthy();
    expect(chapter.kind).toBe('story');
    expect(chapter.progressionGroup).toBe('story');
    expect(chapter.progressionId).toBe('chapter2');
    expect(chapter.entryStepId).toBe('CHAPTER2_STEP_001');
    expect(chapter.unlocksChapterIds).toEqual(['chapter3']);
    expect(chapter.lockMessage).toBe('第一章をクリアすると解放されます。');

    const recap = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_001');
    const rideChoice = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_006');
    const villageIntro = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_008');
    const theoryScene = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_027');
    const libraryScene = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_034');
    const completed = StoryStepsModule.getChapterStep('chapter2', 'CHAPTER2_STEP_054');

    expect(recap.sceneBackgroundSrc).toBe('assets/story/background/森背景.png');
    expect(recap.supportImageSrc).toBe('assets/story/stones/ULTIMATE_DESTROY_GOD-white.png');
    expect(rideChoice.choices.map((choice) => choice.label)).toEqual(['わかった', '誰がお前なんかに乗るか！']);
    expect(rideChoice.nextByChoice.reject_nigel).toBe('CHAPTER2_GAMEOVER_001');
    expect(villageIntro.sceneBackgroundSrc).toBe('assets/story/background/多動の村.png');
    expect(theoryScene.sceneBackgroundSrc).toBe('assets/story/background/理論の部屋.png');
    expect(theoryScene.characterImageSrc).toBe('assets/story/cpu/level7.png');
    expect(libraryScene.sceneBackgroundSrc).toBe('assets/story/background/古い図書館.png');
    expect(completed.result).toEqual({
      saveStoryChapterCleared: true,
      unlockStoryChapterIds: ['chapter3']
    });
  });
});
