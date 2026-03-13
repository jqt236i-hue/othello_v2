const { JSDOM } = require('jsdom');
const StoryControllerModule = require('../ui/story/story-controller');
const StoryStateModule = require('../ui/story/story-state');
const TutorialStorageModule = require('../ui/tutorial/tutorial-storage');

describe('story controller chapter unlock + open', () => {
  afterEach(() => {
    StoryStateModule.resetState();
    delete global.localStorage;
  });

  test('chapter1 stays locked until chapter0 clear, then opens from the story overlay', async () => {
    const dom = new JSDOM('<button id="storyBtn">story</button><div id="tutorialOverlay"></div>', {
      url: 'http://localhost/'
    });
    global.localStorage = dom.window.localStorage;

    const button = dom.window.document.getElementById('storyBtn');
    const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
    const controller = StoryControllerModule.createStoryController({
      root: dom.window,
      overlay: overlayRoot,
      button
    });

    expect(controller.getChapterAvailability('chapter1').unlocked).toBe(false);

    TutorialStorageModule.saveTutorialScenarioCleared('chapter0', true);

    const availability = controller.getChapterAvailability('chapter1');
    expect(availability.unlocked).toBe(true);
    expect(TutorialStorageModule.isStoryChapterUnlocked('chapter1')).toBe(true);

    await controller.open({ chapterId: 'chapter1' });

    expect(dom.window.Story.State.getState().chapterId).toBe('chapter1');
    expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');
    expect(overlayRoot.querySelector('.tutorial-speaker').textContent).toBe('オセロの勇者');
  });

  test('chapter2 opens after it is unlocked and starts from the recap scene', async () => {
    const dom = new JSDOM('<button id="storyBtn">story</button><div id="tutorialOverlay"></div>', {
      url: 'http://localhost/'
    });
    global.localStorage = dom.window.localStorage;

    const button = dom.window.document.getElementById('storyBtn');
    const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
    const controller = StoryControllerModule.createStoryController({
      root: dom.window,
      overlay: overlayRoot,
      button
    });

    TutorialStorageModule.saveStoryChapterUnlocked('chapter2', true);

    const availability = controller.getChapterAvailability('chapter2');
    expect(availability.unlocked).toBe(true);

    await controller.open({ chapterId: 'chapter2' });

    expect(dom.window.Story.State.getState().chapterId).toBe('chapter2');
    expect(dom.window.Story.State.getState().stepId).toBe('CHAPTER2_STEP_001');
    expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');
    expect(overlayRoot.querySelector('.tutorial-speaker').textContent).toBe('盤理の観測者');
    expect(overlayRoot.querySelector('.tutorial-support-image').getAttribute('src')).toBe('assets/story/stones/ULTIMATE_DESTROY_GOD-white.png');
  });
});
