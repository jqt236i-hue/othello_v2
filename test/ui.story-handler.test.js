const { JSDOM } = require('jsdom');
const StoryHandlerModule = require('../ui/handlers/story');
const StoryControllerModule = require('../ui/story/story-controller');
const StoryStepsModule = require('../ui/story/story-steps');
const TutorialStorageModule = require('../ui/tutorial/tutorial-storage');

describe('story handler menu rendering', () => {
  afterEach(() => {
    delete global.localStorage;
  });

  test('chapter list keeps chapter2 locked until chapter1 is cleared', () => {
    const dom = new JSDOM(
      '<button id="storyBtn">story</button><div id="storyMenuOverlay"></div><div id="tutorialOverlay"></div>',
      { url: 'http://localhost/' }
    );
    global.localStorage = dom.window.localStorage;
    dom.window.StoryControllerModule = StoryControllerModule;
    dom.window.StoryStepsModule = StoryStepsModule;

    const storyBtn = dom.window.document.getElementById('storyBtn');
    const storyMenuOverlay = dom.window.document.getElementById('storyMenuOverlay');
    const tutorialOverlay = dom.window.document.getElementById('tutorialOverlay');

    StoryHandlerModule.setupStoryControls(storyBtn, storyMenuOverlay, tutorialOverlay, {
      root: dom.window
    });

    storyBtn.click();
    let chapterButtons = Array.from(storyMenuOverlay.querySelectorAll('.story-chapter-btn'));
    expect(chapterButtons).toHaveLength(2);
    expect(chapterButtons[0].disabled).toBe(true);
    expect(chapterButtons[0].textContent).toContain('第一章');
    expect(chapterButtons[0].textContent).toContain('プレイするにはチュートリアルをクリアしてください。');
    expect(chapterButtons[1].disabled).toBe(true);
    expect(chapterButtons[1].textContent).toContain('第二章');
    expect(chapterButtons[1].textContent).toContain('第一章をクリアすると解放されます。');

    storyBtn.click();
    TutorialStorageModule.saveTutorialScenarioCleared('chapter0', true);
    storyBtn.click();

    chapterButtons = Array.from(storyMenuOverlay.querySelectorAll('.story-chapter-btn'));
    expect(chapterButtons[0].disabled).toBe(false);
    expect(chapterButtons[0].textContent).toContain('playable');
    expect(chapterButtons[1].disabled).toBe(true);

    storyBtn.click();
    TutorialStorageModule.saveStoryChapterUnlocked('chapter2', true);
    storyBtn.click();

    chapterButtons = Array.from(storyMenuOverlay.querySelectorAll('.story-chapter-btn'));
    expect(chapterButtons[1].disabled).toBe(false);
    expect(chapterButtons[1].textContent).toContain('playable');
  });
});
