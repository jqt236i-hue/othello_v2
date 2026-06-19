import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

describe('gacha reveal audio session', () => {
  function createAudioStub() {
    const handlers = {};
    return {
      play: jest.fn(() => Promise.resolve()),
      pause: jest.fn(),
      load: jest.fn(),
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

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('keeps BGM paused after the pull audio ends and resumes it when the reveal is closed', async () => {
    const mod = require('../ui/gacha/gacha-reveal-audio.js');
    const audio = createAudioStub();
    const root = {
      SoundEngine: {
        volume: 0.42,
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
      }
    };

    const session = mod.createGachaRevealAudioSession({
      root,
      createAudio: () => audio
    });

    expect(session.play()).toBe(true);
    await Promise.resolve();

    expect(audio.play).toHaveBeenCalled();
    expect(audio.volume).toBeCloseTo(0.42);
    expect(root.SoundEngine.pauseBgm).toHaveBeenCalled();

    audio.emit('ended');
    expect(root.SoundEngine.playBgm).not.toHaveBeenCalled();

    session.destroy();
    expect(root.SoundEngine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('preloads pull audio when the reveal session is created and plays the warmed instance on click', async () => {
    const mod = require('../ui/gacha/gacha-reveal-audio.js');
    const audio = createAudioStub();
    const nextAudio = createAudioStub();
    const createAudio = jest
      .fn()
      .mockReturnValueOnce(audio)
      .mockReturnValueOnce(nextAudio);
    const root = {
      SoundEngine: {
        volume: 0.5,
        bgm: { paused: true },
        allowBgmPlay: false,
        pauseBgm: jest.fn(),
        playBgm: jest.fn()
      }
    };

    const session = mod.createGachaRevealAudioSession({
      root,
      createAudio
    });

    expect(createAudio).toHaveBeenCalledTimes(1);
    expect(audio.preload).toBe('auto');
    expect(audio.load).toHaveBeenCalledTimes(1);

    expect(session.play()).toBe(true);
    await Promise.resolve();

    expect(createAudio).toHaveBeenCalledTimes(2);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(nextAudio.load).toHaveBeenCalledTimes(1);
  });

  test('applies quick master volume to active pull audio', async () => {
    const mod = require('../ui/gacha/gacha-reveal-audio.js');
    const dom = new JSDOM('<!doctype html><html><body></body></html>');
    const audio = createAudioStub();
    dom.window.SoundEngine = {
      volume: 0.42,
      masterVolume: 0.5,
      bgm: { paused: true },
      allowBgmPlay: false,
      pauseBgm: jest.fn(),
      playBgm: jest.fn()
    };

    const session = mod.createGachaRevealAudioSession({
      root: dom.window,
      createAudio: () => audio
    });

    expect(session.play()).toBe(true);
    await Promise.resolve();

    expect(audio.volume).toBeCloseTo(0.21);

    dom.window.SoundEngine.masterVolume = 2;
    dom.window.dispatchEvent(new dom.window.CustomEvent('sound:master-volume-changed', {
      detail: { masterVolume: 2 }
    }));

    expect(audio.volume).toBeCloseTo(0.84);

    session.destroy();
    dom.window.close();
  });

  test('destroy stops active pull audio and resumes paused BGM immediately', async () => {
    const mod = require('../ui/gacha/gacha-reveal-audio.js');
    const audio = createAudioStub();
    const root = {
      SoundEngine: {
        volume: 0.5,
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
      }
    };

    const session = mod.createGachaRevealAudioSession({
      root,
      createAudio: () => audio
    });

    session.play();
    await Promise.resolve();
    session.destroy();

    expect(audio.pause).toHaveBeenCalled();
    expect(root.SoundEngine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('pauses BGM even when the controller does not expose paused=false explicitly', async () => {
    const mod = require('../ui/gacha/gacha-reveal-audio.js');
    const audio = createAudioStub();
    const root = {
      SoundEngine: {
        volume: 0.5,
        bgm: {},
        allowBgmPlay: true,
        pauseBgm: jest.fn(function () {
          this.allowBgmPlay = false;
        }),
        playBgm: jest.fn(function () {
          this.allowBgmPlay = true;
        })
      }
    };

    const session = mod.createGachaRevealAudioSession({
      root,
      createAudio: () => audio
    });

    expect(session.play()).toBe(true);
    await Promise.resolve();

    expect(root.SoundEngine.pauseBgm).toHaveBeenCalled();

    audio.emit('ended');
    expect(root.SoundEngine.playBgm).not.toHaveBeenCalled();
    session.destroy();
    expect(root.SoundEngine.playBgm).toHaveBeenCalledTimes(1);
  });

  test('a later play after destroy can pause and resume BGM again', async () => {
    const mod = require('../ui/gacha/gacha-reveal-audio.js');
    const firstAudio = createAudioStub();
    const secondAudio = createAudioStub();
    const createAudio = jest
      .fn()
      .mockReturnValueOnce(firstAudio)
      .mockReturnValueOnce(secondAudio);
    const root = {
      SoundEngine: {
        volume: 0.5,
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
      }
    };

    const session = mod.createGachaRevealAudioSession({
      root,
      createAudio
    });

    session.play();
    await Promise.resolve();
    session.destroy();
    expect(root.SoundEngine.playBgm).toHaveBeenCalledTimes(1);

    session.play();
    await Promise.resolve();
    session.destroy();

    expect(root.SoundEngine.pauseBgm).toHaveBeenCalledTimes(2);
    expect(root.SoundEngine.playBgm).toHaveBeenCalledTimes(2);
    expect(firstAudio.pause).toHaveBeenCalled();
    expect(secondAudio.pause).toHaveBeenCalled();
  });

  test('classic-script runtime resolves the real SoundEngine even when window.SoundEngine is undefined', async () => {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', {
      runScripts: 'outside-only',
      url: 'http://localhost/'
    });
    const { window } = dom;
    const soundEngineSource = fs.readFileSync(path.resolve(__dirname, '../dist/sound-engine.js'), 'utf8');
    const gachaAudioSource = fs.readFileSync(path.resolve(__dirname, '../dist/ui/gacha/gacha-reveal-audio.js'), 'utf8');
    window.eval(`var require = function () { throw new Error('unexpected require'); };\n(function () { var module = { exports: {} }; var exports = module.exports;\n${soundEngineSource}\nwindow.__SoundEngineUnderTest = module.exports.default || exports.default || SoundEngine; }());\n(function () { var module = { exports: {} }; var exports = module.exports;\n${gachaAudioSource}\nwindow.GachaRevealAudioModule = module.exports; }()); require = undefined;\nwindow.SoundEngineAccessModule = { resolveSoundEngine: function () { return window.__SoundEngineUnderTest; } };\nwindow.__configureGachaSoundTest = function () {\n  window.__SoundEngineUnderTest.bgm = { paused: false };\n  window.__SoundEngineUnderTest.allowBgmPlay = true;\n  window.__SoundEngineUnderTest.pauseCalls = 0;\n  window.__SoundEngineUnderTest.playCalls = 0;\n  window.__SoundEngineUnderTest.pauseBgm = function () {\n    this.pauseCalls += 1;\n    this.allowBgmPlay = false;\n    this.bgm.paused = true;\n  };\n  window.__SoundEngineUnderTest.playBgm = function () {\n    this.playCalls += 1;\n    this.allowBgmPlay = true;\n    this.bgm.paused = false;\n  };\n};\nwindow.__readGachaSoundTestState = function () {\n  return { pauseCalls: window.__SoundEngineUnderTest.pauseCalls, playCalls: window.__SoundEngineUnderTest.playCalls };\n};`);

    expect(window.SoundEngine).toBeUndefined();
    window.__configureGachaSoundTest();

    const mod = window.GachaRevealAudioModule;
    const audio = createAudioStub();
    const session = mod.createGachaRevealAudioSession({
      root: window,
      createAudio: () => audio
    });

    expect(session.play()).toBe(true);
    await Promise.resolve();
    expect(window.__readGachaSoundTestState().pauseCalls).toBe(1);

    session.destroy();
    expect(window.__readGachaSoundTestState().playCalls).toBe(1);

    dom.window.close();
  });
});
