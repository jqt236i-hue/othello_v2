import { JSDOM } from 'jsdom';

describe('gacha reveal player', () => {
  let dom;

  beforeEach(() => {
    jest.doMock('../dist/ui/animation-shared', () => ({
      ...jest.requireActual('../dist/ui/animation-shared'),
      isNoAnim: () => !!(global.window && global.window.DISABLE_ANIMATIONS === true)
    }));
  });

  function setDom() {
    dom = new JSDOM(`<!doctype html><html><body>
      <div id="gachaOverlay"></div>
    </body></html>`, { url: 'https://example.test/' });

    global.window = dom.window;
    global.document = dom.window.document;
  }

  function createPull(id, rarity, label) {
    return {
      rarity,
      item: {
        id,
        label,
        imagePath: `assets/images/Gacha/${rarity}/${label}.png`
      }
    };
  }

  function createAudioStub() {
    const handlers = {};
    return {
      play: jest.fn(() => Promise.resolve()),
      pause: jest.fn(),
      addEventListener: jest.fn((name, handler) => {
        handlers[name] = handler;
      }),
      removeEventListener: jest.fn((name, handler) => {
        if (handlers[name] === handler) {
          delete handlers[name];
        }
      }),
      emit(name) {
        if (typeof handlers[name] === 'function') {
          handlers[name]();
        }
      }
    };
  }

  afterEach(() => {
    jest.useRealTimers();
    try {
      if (dom && dom.window && typeof dom.window.close === 'function') {
        dom.window.close();
      }
    } catch (e) { /* Intentionally empty: test cleanup guard */ }
    delete global.window;
    delete global.document;
    jest.dontMock('../dist/ui/animation-shared');
  });

  test('plays a single-pull reveal and leaves hero content for the final item', async () => {
    jest.useFakeTimers();
    jest.resetModules();
    setDom();
    const audio = createAudioStub();
    window.SoundEngine = {
      volume: 0.56,
      bgm: { paused: false },
      allowBgmPlay: true,
      pauseBgm: jest.fn(function () {
        this.allowBgmPlay = false;
        this.bgm.paused = true;
      }),
      playBgm: jest.fn(function () {
        this.allowBgmPlay = true;
        this.bgm.paused = false;
      })
    };
    const mod = require('../ui/gacha-reveal-player.js');
    const player = mod.createGachaRevealPlayer({
      root: window,
      overlay: document.getElementById('gachaOverlay'),
      createAudio: () => audio,
      timings: { introMs: 1, heroMs: 1, gridMs: 1, finishMs: 1 }
    });

    const playPromise = player.play({
      pulls: [createPull('gacha__sr__虹の手', 'SR', '虹の手')],
      newlyUnlockedIds: ['gacha__sr__虹の手']
    });
    const stage = document.getElementById('gachaRevealStage');
    await jest.advanceTimersByTimeAsync(80);
    expect(stage).toBeTruthy();
    expect(stage.getAttribute('aria-hidden')).toBe('false');
    expect(stage.classList.contains('is-awaiting-dismiss')).toBe(true);
    expect(stage.querySelector('.gacha-reveal-headline').textContent).toBe('観測が収束しました');
    expect(stage.querySelector('.gacha-reveal-hero-name').textContent).toBe('虹の手');
    expect(stage.querySelector('.gacha-reveal-hero-status').textContent).toBe('NEW');
    expect(audio.play).toHaveBeenCalled();
    expect(window.SoundEngine.pauseBgm).toHaveBeenCalled();

    stage.click();
    await jest.advanceTimersByTimeAsync(40);
    const result = await playPromise;
    expect(result.finishedWith).toBe('animated');
    expect(result.highestRarity).toBe('SR');
    expect(stage.getAttribute('aria-hidden')).toBe('true');
    expect(audio.pause).toHaveBeenCalled();
    expect(window.SoundEngine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('skip button short-circuits a ten-pull reveal and resumes BGM', async () => {
    jest.useFakeTimers();
    jest.resetModules();
    setDom();
    const audio = createAudioStub();
    window.SoundEngine = {
      volume: 0.56,
      bgm: { paused: false },
      allowBgmPlay: true,
      pauseBgm: jest.fn(function () {
        this.allowBgmPlay = false;
        this.bgm.paused = true;
      }),
      playBgm: jest.fn(function () {
        this.allowBgmPlay = true;
        this.bgm.paused = false;
      })
    };
    const mod = require('../ui/gacha-reveal-player.js');
    const player = mod.createGachaRevealPlayer({
      root: window,
      overlay: document.getElementById('gachaOverlay'),
      createAudio: () => audio,
      timings: { introMs: 60, heroMs: 60, gridMs: 60, finishMs: 60 }
    });

    const playPromise = player.play({
      pulls: [
        createPull('gacha__sr__虹の手', 'SR', '虹の手'),
        createPull('gacha__r__猫の手', 'R', '猫の手'),
        createPull('gacha__r__支配の手', 'R', '支配の手'),
        createPull('gacha__n__魚眼ハンド', 'N', '魚眼ハンド'),
        createPull('gacha__n__小鬼の手', 'N', '小鬼の手'),
        createPull('gacha__n__魚眼ハンド_2', 'N', '魚眼ハンド'),
        createPull('gacha__n__小鬼の手_2', 'N', '小鬼の手'),
        createPull('gacha__r__猫の手_2', 'R', '猫の手'),
        createPull('gacha__r__支配の手_2', 'R', '支配の手'),
        createPull('gacha__n__魚眼ハンド_3', 'N', '魚眼ハンド')
      ],
      newlyUnlockedIds: []
    });

    await jest.advanceTimersByTimeAsync(24);
    document.getElementById('gachaRevealSkipBtn').click();
    await jest.advanceTimersByTimeAsync(120);
    const result = await playPromise;

    expect(result.finishedWith).toBe('skipped');
    expect(document.getElementById('gachaRevealStage').getAttribute('aria-hidden')).toBe('true');
    expect(audio.pause).toHaveBeenCalled();
    expect(window.SoundEngine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('default timing waits 2 seconds before the first item appears', async () => {
    jest.resetModules();
    jest.useFakeTimers();
    setDom();
    const audio = createAudioStub();
    const mod = require('../ui/gacha-reveal-player.js');
    const player = mod.createGachaRevealPlayer({
      root: window,
      overlay: document.getElementById('gachaOverlay'),
      createAudio: () => audio
    });

    const playPromise = player.play({
      pulls: [createPull('gacha__sr__虹の手', 'SR', '虹の手')],
      newlyUnlockedIds: ['gacha__sr__虹の手']
    });
    const stage = document.getElementById('gachaRevealStage');

    expect(stage.getAttribute('data-reveal-effect')).toBe('prism');
    expect(stage.classList.contains('is-hero-visible')).toBe(false);
    expect(stage.classList.contains('is-impact-visible')).toBe(false);
    await jest.advanceTimersByTimeAsync(1999);
    expect(stage.classList.contains('is-hero-visible')).toBe(false);
    expect(stage.classList.contains('is-impact-visible')).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(stage.classList.contains('is-hero-visible')).toBe(true);
    expect(stage.classList.contains('is-impact-visible')).toBe(true);

    document.getElementById('gachaRevealSkipBtn').click();
    await jest.advanceTimersByTimeAsync(400);
    await playPromise;
  });

  test('maps each rarity to a distinct reveal effect key', () => {
    jest.resetModules();
    const mod = require('../ui/gacha-reveal-player.js');
    expect(mod.resolveRevealEffectKey('N')).toBe('subtle');
    expect(mod.resolveRevealEffectKey('R')).toBe('slash');
    expect(mod.resolveRevealEffectKey('SR')).toBe('prism');
    expect(mod.resolveRevealEffectKey('SSR')).toBe('nova');
    expect(mod.resolveRevealEffectKey('UR')).toBe('cataclysm');
    expect(mod.resolveRevealEffectKey('EXR')).toBe('singularity');
  });

  test('DISABLE_ANIMATIONS uses the instant reveal path', async () => {
    jest.resetModules();
    setDom();
    window.DISABLE_ANIMATIONS = true;
    const mod = require('../ui/gacha-reveal-player.js');
    const player = mod.createGachaRevealPlayer({
      root: window,
      overlay: document.getElementById('gachaOverlay')
    });

    const result = await player.play({
      pulls: [createPull('gacha__n__小鬼の手', 'N', '小鬼の手')],
      newlyUnlockedIds: []
    });

    expect(result.finishedWith).toBe('instant');
    expect(document.getElementById('gachaRevealStage').getAttribute('aria-hidden')).toBe('true');
  });
});
