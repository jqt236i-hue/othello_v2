const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const StoryBattleUiModule = require('../ui/story/story-battle-ui');
const StoryStateModule = require('../ui/story/story-state');
const TutorialOverlayModule = require('../ui/tutorial/tutorial-overlay');

function loadLayoutStyles() {
  return fs.readFileSync(path.resolve(__dirname, '../styles-layout.css'), 'utf8');
}

describe('story battle ui', () => {
  afterEach(() => {
    StoryStateModule.resetState();
    delete global.SoundEngine;
  });

  test('encounter active で専用 settings UI を表示し、音量を同期する', () => {
    const styles = loadLayoutStyles();
    const dom = new JSDOM(
      `<!DOCTYPE html><html><head><style>${styles}</style></head><body>
        <button id="gachaOpenBtn">ガチャ</button>
        <button id="leaderboardOpenBtn">ランキング</button>
        <button id="deckBuilderOpenBtn">デッキ</button>
        <button id="storyBtn">story</button>
        <button id="rulesHelpBtn">help</button>
        <div id="tutorialOverlay"></div>
        <div id="networkChatPanel"></div>
        <div id="side-panel"></div>
        <button id="muteBtn">🔊 ON</button>
        <input id="seVolSlider" type="range" value="0.56">
        <input id="bgmVolSlider" type="range" value="0.07">
        <select id="bgmTrackSelect"><option value="1">c-othello-2</option></select>
      </body></html>`,
      { pretendToBeVisual: true }
    );

    const soundEngine = {
      isMuted: false,
      volume: 0.56,
      bgmVolume: 0.07,
      currentTrackIndex: 1,
      allowBgmPlay: true,
      bgm: { paused: false },
      init: jest.fn(),
      toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
      },
      setVolume(value) {
        this.volume = parseFloat(value);
      },
      setBgmVolume(value) {
        this.bgmVolume = parseFloat(value);
      },
      playBgm() {
        this.allowBgmPlay = true;
        this.bgm = { paused: false };
      },
      pauseBgm() {
        this.allowBgmPlay = false;
        this.bgm = { paused: true };
      }
    };
    global.SoundEngine = soundEngine;
    dom.window.SoundEngine = soundEngine;
    dom.window.TutorialOverlayModule = TutorialOverlayModule;
    dom.window.updateBgmButtons = jest.fn();

    const ui = StoryBattleUiModule.createStoryBattleUi({
      root: dom.window,
      stateApi: StoryStateModule.publicApi,
      soundRefs: {
        muteBtn: dom.window.document.getElementById('muteBtn'),
        seVolSlider: dom.window.document.getElementById('seVolSlider'),
        bgmVolSlider: dom.window.document.getElementById('bgmVolSlider'),
        bgmTrackSelect: dom.window.document.getElementById('bgmTrackSelect')
      }
    });

    expect(ui).toBeTruthy();
    expect(ui.refs.root.getAttribute('aria-hidden')).toBe('true');
    expect(dom.window.getComputedStyle(dom.window.document.getElementById('leaderboardOpenBtn')).position).toBe('fixed');
    expect(dom.window.getComputedStyle(dom.window.document.getElementById('deckBuilderOpenBtn')).position).toBe('fixed');

    StoryStateModule.beginChapter({ chapterId: 'chapter1', stepId: 'STEP_001', mode: 'dialogue' });

    expect(ui.refs.root.getAttribute('aria-hidden')).toBe('false');
    expect(dom.window.document.body.classList.contains('story-mode-active')).toBe(true);
    expect(dom.window.document.body.classList.contains('story-battle-active')).toBe(false);

    StoryStateModule.setEncounterState({ active: true, encounterId: 'chapter1_goblin' });

    expect(ui.refs.root.getAttribute('aria-hidden')).toBe('false');
    expect(dom.window.document.body.classList.contains('story-mode-active')).toBe(true);
    expect(dom.window.document.body.classList.contains('story-battle-active')).toBe(true);
    expect(dom.window.getComputedStyle(dom.window.document.getElementById('side-panel')).display).toBe('none');
    expect(dom.window.getComputedStyle(dom.window.document.getElementById('gachaOpenBtn')).display).toBe('none');
    expect(dom.window.getComputedStyle(dom.window.document.getElementById('leaderboardOpenBtn')).display).toBe('none');
    expect(dom.window.getComputedStyle(dom.window.document.getElementById('deckBuilderOpenBtn')).display).toBe('none');
    expect(dom.window.getComputedStyle(dom.window.document.getElementById('storyBtn')).display).toBe('none');
    expect(ui.refs.settingsButton.textContent).toContain('MENU');
    expect(dom.window.document.getElementById('tutorialOverlay').getAttribute('aria-hidden')).toBe('false');
    expect(dom.window.document.querySelector('.tutorial-exit-btn').disabled).toBe(false);

    ui.refs.settingsButton.click();
    expect(ui.refs.settingsPanel.hidden).toBe(false);

    ui.refs.seVolume.value = '0.55';
    ui.refs.seVolume.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    expect(soundEngine.volume).toBeCloseTo(0.55, 5);
    expect(dom.window.document.getElementById('seVolSlider').value).toBe('0.55');

    ui.refs.seToggleButton.click();
    expect(soundEngine.isMuted).toBe(true);
    expect(dom.window.document.getElementById('muteBtn').textContent).toBe('🔇 OFF');

    ui.refs.bgmToggleButton.click();
    expect(soundEngine.allowBgmPlay).toBe(false);
    expect(ui.refs.bgmToggleButton.textContent).toBe('BGM OFF');

    StoryStateModule.setEncounterState({ active: false });
    expect(ui.refs.root.getAttribute('aria-hidden')).toBe('false');
    expect(dom.window.document.body.classList.contains('story-mode-active')).toBe(true);
    expect(dom.window.document.body.classList.contains('story-battle-active')).toBe(false);

    StoryStateModule.resetState();
    expect(ui.refs.root.getAttribute('aria-hidden')).toBe('true');
    expect(dom.window.document.body.classList.contains('story-mode-active')).toBe(false);
    expect(dom.window.document.getElementById('tutorialOverlay').classList.contains('tutorial-exit-only')).toBe(false);

    ui.destroy();
    dom.window.close();
  });
});
