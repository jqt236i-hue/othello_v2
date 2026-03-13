const TutorialStepsModule = require('../ui/tutorial/tutorial-steps');

describe('tutorial steps data', () => {
  test('chapter0 keeps fixed intro + 38-step main flow', () => {
    const scenario = TutorialStepsModule.getScenario('chapter0');

    expect(scenario).toBeTruthy();
    expect(scenario.kind).toBe(TutorialStepsModule.SCENARIO_KINDS.TUTORIAL);
    expect(scenario.progressionGroup).toBe(TutorialStepsModule.SCENARIO_KINDS.TUTORIAL);
    expect(scenario.progressionId).toBe('chapter0');
    expect(scenario.entryStepId).toBe('INTRO_SCENE_001');
    expect(scenario.mainEntryStepId).toBe('STEP_001');
    expect(scenario.mainStepIds).toHaveLength(38);
    expect(scenario.mainStepIds[0]).toBe('STEP_001');
    expect(scenario.mainStepIds[37]).toBe('STEP_038');
  });

  test('intro branch and completion flags stay fixed', () => {
    const introScene = TutorialStepsModule.getScenarioStep('chapter0', 'INTRO_SCENE_005');
    const modernScene = TutorialStepsModule.getScenarioStep('chapter0', 'INTRO_SCENE_001');
    const chapterOne = TutorialStepsModule.getScenarioStep('chapter0', 'STEP_001');
    const introBranch = TutorialStepsModule.getScenarioStep('chapter0', 'INTRO_BRANCH');
    const completed = TutorialStepsModule.getScenarioStep('chapter0', 'STEP_038');

    expect(modernScene.sceneBackgroundSrc).toBe('assets/story/background/ただの学生の部屋.png');
    expect(modernScene.sceneTransition).toBe('fade_black');
    expect(modernScene.characterImageSrc).toBe('assets/story/hero/現実世界の勇者.png');
    expect(introScene.sceneBackgroundSrc).toBe('assets/story/background/森背景.png');
    expect(introScene.sceneTransition).toBe('fade_black');
    expect(introScene.headBubbleText).toBeUndefined();
    expect(chapterOne.sceneBackgroundSrc).toBeUndefined();
    expect(chapterOne.observerVisible).toBe(true);
    expect(chapterOne.observerStage).toBe('top');
    expect(introBranch.choices.map((choice) => choice.label)).toEqual(['はい', 'いいえ']);
    expect(introBranch.responseMap.intro_yes.text).toBe('感謝しよう。それではルール説明に入るぞ！');
    expect(introBranch.responseMap.intro_no.text).toBe('お前には失望したよ。ここで消えてもらおうか。');
    expect(completed.result).toEqual({
      unlockNormalGame: true,
      openMatchStartModal: true,
      saveTutorialCleared: true
    });
    expect(TutorialStepsModule.getTutorialScenarioIds()).toEqual(['chapter0']);
    expect(TutorialStepsModule.getStoryScenarioIds()).toEqual([]);
  });
});
