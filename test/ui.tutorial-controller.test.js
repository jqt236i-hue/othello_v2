const { JSDOM } = require('jsdom');
const TutorialControllerModule = require('../ui/tutorial/tutorial-controller');

describe('tutorial controller close behavior', () => {
  test('外側クリックと Escape では閉じず、終了ボタンで閉じる', async () => {
    const dom = new JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
    const button = dom.window.document.getElementById('tutorialBtn');
    const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
    const controller = TutorialControllerModule.createTutorialController({
      root: dom.window,
      overlay: overlayRoot,
      button
    });

    await controller.open();

    overlayRoot.querySelector('.tutorial-backdrop').dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');

    dom.window.document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(overlayRoot.getAttribute('aria-hidden')).toBe('false');

    overlayRoot.querySelector('.tutorial-exit-btn').click();
    expect(overlayRoot.getAttribute('aria-hidden')).toBe('true');
  });

  test('会話送りと選択肢決定で story SE を鳴らす', async () => {
    const dom = new JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
    const button = dom.window.document.getElementById('tutorialBtn');
    const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
    const playEffectByKey = jest.fn();
    dom.window.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };

    const controller = TutorialControllerModule.createTutorialController({
      root: dom.window,
      overlay: overlayRoot,
      button
    });

    await controller.open();

    const dialogWindow = overlayRoot.querySelector('.tutorial-dialog-window');
    for (let i = 0; i < 60; i += 1) {
      dialogWindow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (overlayRoot.querySelector('.tutorial-choice-btn')) break;
    }

    expect(playEffectByKey).toHaveBeenCalledWith('tutorial_story_effect', expect.objectContaining({
      filePath: 'assets/story/sound-ef/テキストをクリックするとき.mp3'
    }));
    const textClickCall = playEffectByKey.mock.calls.find(([key, options]) => (
      key === 'tutorial_story_effect'
      && options
      && options.filePath === 'assets/story/sound-ef/テキストをクリックするとき.mp3'
    ));
    expect(textClickCall[1].volumeScale).toBeUndefined();

    const choiceButton = overlayRoot.querySelector('.tutorial-choice-btn');
    expect(choiceButton).toBeTruthy();
    choiceButton.click();
    expect(dom.window.Tutorial.State.getState().mode).toBe('dialogue');

    expect(playEffectByKey).toHaveBeenCalledWith('tutorial_story_effect', expect.objectContaining({
      filePath: 'assets/story/sound-ef/自分視点選択肢を選ぶとき.mp3'
    }));
    const choiceSelectCall = playEffectByKey.mock.calls.find(([key, options]) => (
      key === 'tutorial_story_effect'
      && options
      && options.filePath === 'assets/story/sound-ef/自分視点選択肢を選ぶとき.mp3'
    ));
    expect(choiceSelectCall[1].volumeScale).toBeUndefined();
  });

  test('進行不能な dialog click ではテキスト SE を鳴らさない', async () => {
    const dom = new JSDOM('<button id="tutorialBtn">tutorial</button><div id="tutorialOverlay"></div>');
    const button = dom.window.document.getElementById('tutorialBtn');
    const overlayRoot = dom.window.document.getElementById('tutorialOverlay');
    const playEffectByKey = jest.fn();
    dom.window.SoundEngine = {
      init: jest.fn(),
      playEffectByKey
    };

    const controller = TutorialControllerModule.createTutorialController({
      root: dom.window,
      overlay: overlayRoot,
      button
    });

    await controller.open();
    playEffectByKey.mockClear();

    const dialogWindow = overlayRoot.querySelector('.tutorial-dialog-window');
    for (let i = 0; i < 60; i += 1) {
      dialogWindow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (overlayRoot.querySelector('.tutorial-choice-btn')) break;
    }
    playEffectByKey.mockClear();

    dialogWindow.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    expect(playEffectByKey).not.toHaveBeenCalledWith('tutorial_story_effect', expect.objectContaining({
      filePath: 'assets/story/sound-ef/テキストをクリックするとき.mp3'
    }));
  });
});
