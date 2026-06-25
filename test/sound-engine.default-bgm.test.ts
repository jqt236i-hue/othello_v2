import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

function loadSoundEngine(overrides = {}) {
  const filePath = path.resolve(__dirname, '..', 'dist', 'sound-engine.js');
  const source = fs.readFileSync(filePath, 'utf8') + '\nmodule.exports = module.exports.default || exports.default || SoundEngine;';
  const moduleRef = { exports: {} };
  const context = Object.assign({
    module: moduleRef,
    exports: moduleRef.exports,
    require: jest.fn(),
    console,
    updateBgmButtons: jest.fn(),
    Audio: function Audio() {}
  }, overrides);
  if (!context.window) context.window = context;
  if (!context.window.updateBgmButtons) context.window.updateBgmButtons = context.updateBgmButtons;
  vm.runInNewContext(source, context, { filename: filePath });
  return context.module.exports;
}

function createMockHtmlAudioClass() {
  const instances = [];

  function MockAudio(src) {
    this.src = src;
    this.currentTime = 0;
    this.duration = 10;
    this.loop = false;
    this.volume = 1;
    this.paused = true;
    this.preload = '';
    this.play = jest.fn(() => {
      this.paused = false;
      return Promise.resolve();
    });
    this.pause = jest.fn(() => {
      this.paused = true;
    });
    this.load = jest.fn();
    instances.push(this);
  }

  return { MockAudio, instances };
}

function createMockAudioContext() {
  const gains = [];
  const sources = [];
  return {
    gains,
    sources,
    context: {
      state: 'running',
      currentTime: 1,
      sampleRate: 10,
      destination: {},
      resume: jest.fn(),
      decodeAudioData: jest.fn(async () => ({ duration: 12 })),
      createOscillator() {
        return {
          frequency: {
            setValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn()
          },
          connect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn()
        };
      },
      createGain() {
        const gainNode = {
          gain: {
            setValueAtTime: jest.fn(),
            linearRampToValueAtTime: jest.fn(),
            exponentialRampToValueAtTime: jest.fn()
          },
          connect: jest.fn()
        };
        gains.push(gainNode);
        return gainNode;
      },
      createBuffer() {
        return {
          getChannelData() {
            return new Float32Array(2);
          }
        };
      },
      createBufferSource() {
        const source = {
          buffer: null,
          loop: false,
          loopStart: 0,
          loopEnd: 0,
          connect: jest.fn(),
          disconnect: jest.fn(),
          start: jest.fn(),
          stop: jest.fn()
        };
        sources.push(source);
        return source;
      },
      createBiquadFilter() {
        return {
          type: '',
          frequency: { value: 0 },
          connect: jest.fn()
        };
      }
    }
  };
}

async function flushMicrotasks(times = 6) {
  for (let index = 0; index < times; index += 1) {
    await Promise.resolve();
  }
}

async function flushAsyncWork() {
  await flushMicrotasks();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const DEFAULT_MASTER_VOLUME = 1;
const DEFAULT_BGM_OUTPUT_VOLUME = 0.548625 * 0.24752 * DEFAULT_MASTER_VOLUME;

describe('SoundEngine default BGM', () => {
  test('unlockAudio resumes AudioContext and plays a silent buffer once', async () => {
    const { context, sources } = createMockAudioContext();
    context.state = 'suspended';
    context.resume = jest.fn(async () => {
      context.state = 'running';
    });
    const soundEngine = loadSoundEngine();
    soundEngine.ctx = context;

    await expect(soundEngine.unlockAudio()).resolves.toBe(true);

    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
    expect(sources[0].start).toHaveBeenCalledWith(0);
    expect(soundEngine.isAudioUnlocked()).toBe(true);
  });

  test('playEffectByKey uses cached Web Audio buffers after unlock', async () => {
    const { context, sources, gains } = createMockAudioContext();
    context.state = 'running';
    const decodedBuffer = { duration: 0.25 };
    context.decodeAudioData = jest.fn(async () => decodedBuffer);
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
    soundEngine.ctx = context;

    await soundEngine.unlockAudio();
    await soundEngine.primeEffectBuffer('hand_card_select');
    expect(soundEngine.playEffectByKey('hand_card_select')).toBe(true);
    expect(soundEngine.playEffectByKey('hand_card_select')).toBe(true);

    const effectPath = soundEngine.getEffectFilePath('hand_card_select');
    expect(fetchMock).toHaveBeenCalledWith(effectPath);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources.filter((source) => source.buffer === decodedBuffer)).toHaveLength(2);
    expect(gains.length).toBeGreaterThanOrEqual(2);
    expect(instances.filter((audio) => audio.src === effectPath && audio.play.mock.calls.length > 0)).toHaveLength(0);
  });

  test('playEffectByKey falls back to HTMLAudio while effect buffer is still loading', async () => {
    const { context } = createMockAudioContext();
    context.state = 'running';
    let resolveArrayBuffer;
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: () => new Promise((resolve) => {
        resolveArrayBuffer = resolve;
      })
    }));
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
    soundEngine.ctx = context;

    await soundEngine.unlockAudio();
    const loadPromise = soundEngine.primeEffectBuffer('card_use_button');
    await flushMicrotasks(2);
    expect(soundEngine.playEffectByKey('card_use_button')).toBe(true);

    const effectPath = soundEngine.getEffectFilePath('card_use_button');
    const htmlAudio = instances.find((audio) => audio.src === effectPath);
    expect(htmlAudio.play).toHaveBeenCalledTimes(1);

    resolveArrayBuffer(new ArrayBuffer(8));
    await loadPromise;
  });

  test('playEffectByKey falls back to HTMLAudio when cached Web Audio playback throws', async () => {
    const { context } = createMockAudioContext();
    context.state = 'running';
    const decodedBuffer = { duration: 0.25 };
    context.decodeAudioData = jest.fn(async () => decodedBuffer);
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(8)
    }));
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
    soundEngine.ctx = context;

    await soundEngine.unlockAudio();
    await soundEngine.primeEffectBuffer('hand_card_select');

    const originalCreateBufferSource = context.createBufferSource.bind(context);
    context.createBufferSource = jest.fn(() => {
      const source = originalCreateBufferSource();
      source.start.mockImplementation(() => {
        throw new Error('start blocked');
      });
      return source;
    });

    expect(soundEngine.playEffectByKey('hand_card_select')).toBe(true);

    const effectPath = soundEngine.getEffectFilePath('hand_card_select');
    const audio = instances.find((candidate) => candidate.src === effectPath);
    expect(audio.play).toHaveBeenCalledTimes(1);
    expect(soundEngine.getDiagnostics().lastEffectFailures[effectPath]).toMatch(/start blocked/);
  });

  test('effect buffer load failures are reported in diagnostics and HTMLAudio fallback still plays', async () => {
    const { context } = createMockAudioContext();
    context.state = 'running';
    const fetchMock = jest.fn(async () => ({ ok: false, status: 404 }));
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
    soundEngine.ctx = context;

    await soundEngine.unlockAudio();
    await expect(soundEngine.primeEffectBuffer('stone_destroy')).resolves.toBe(false);
    expect(soundEngine.playEffectByKey('stone_destroy')).toBe(true);

    const effectPath = soundEngine.getEffectFilePath('stone_destroy');
    expect(instances.find((audio) => audio.src === effectPath).play).toHaveBeenCalledTimes(1);
    expect(soundEngine.getDiagnostics().lastEffectFailures[effectPath]).toMatch(/404/);
  });

  test('installUserGestureUnlock wires one-shot pointer and touch unlock listeners', async () => {
    const listeners = {};
    const doc = {
      addEventListener: jest.fn((type, handler, options) => {
        listeners[type] = { handler, options };
      }),
      removeEventListener: jest.fn()
    };
    const { context } = createMockAudioContext();
    context.state = 'running';
    const soundEngine = loadSoundEngine();
    soundEngine.ctx = context;
    soundEngine.unlockAudio = jest.fn(async () => true);
    soundEngine.primeCriticalEffectSounds = jest.fn(async () => 3);
    soundEngine.primeRemainingEffectSounds = jest.fn(async () => 10);

    expect(soundEngine.installUserGestureUnlock(doc)).toBe(true);
    expect(soundEngine.installUserGestureUnlock(doc)).toBe(false);
    expect(doc.addEventListener).toHaveBeenCalledWith('pointerdown', expect.any(Function), expect.objectContaining({ capture: true, passive: true }));
    expect(doc.addEventListener).toHaveBeenCalledWith('touchstart', expect.any(Function), expect.objectContaining({ capture: true, passive: true }));
    expect(doc.addEventListener).toHaveBeenCalledWith('click', expect.any(Function), expect.objectContaining({ capture: true, passive: true }));

    await listeners.pointerdown.handler();

    expect(soundEngine.unlockAudio).toHaveBeenCalledTimes(1);
    expect(soundEngine.primeCriticalEffectSounds).toHaveBeenCalledTimes(1);
    expect(soundEngine.primeRemainingEffectSounds).toHaveBeenCalledTimes(1);
    expect(doc.removeEventListener).toHaveBeenCalledWith('pointerdown', listeners.pointerdown.handler, true);
  });

  test('installUserGestureUnlock allows retry when the first unlock attempt fails', async () => {
    const listeners = {};
    const doc = {
      addEventListener: jest.fn((type, handler, options) => {
        listeners[type] = { handler, options };
      }),
      removeEventListener: jest.fn()
    };
    const soundEngine = loadSoundEngine();
    soundEngine.unlockAudio = jest.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    soundEngine.primeCriticalEffectSounds = jest.fn(async () => 3);
    soundEngine.primeRemainingEffectSounds = jest.fn(async () => 10);

    expect(soundEngine.installUserGestureUnlock(doc)).toBe(true);
    const firstHandler = listeners.pointerdown.handler;
    await firstHandler();

    expect(soundEngine.unlockAudio).toHaveBeenCalledTimes(1);
    expect(soundEngine.primeCriticalEffectSounds).not.toHaveBeenCalled();
    expect(soundEngine.installUserGestureUnlock(doc)).toBe(false);
    expect(doc.addEventListener).toHaveBeenCalledTimes(6);

    const secondHandler = listeners.pointerdown.handler;
    expect(secondHandler).not.toBe(firstHandler);
    await secondHandler();

    expect(soundEngine.unlockAudio).toHaveBeenCalledTimes(2);
    expect(soundEngine.primeCriticalEffectSounds).toHaveBeenCalledTimes(1);
    expect(soundEngine.primeRemainingEffectSounds).toHaveBeenCalledTimes(1);
  });

  test('playEffectByKey keeps HTMLAudio fallback when Web Audio effect buffers are unavailable', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: undefined });

    expect(soundEngine.playEffectByKey('card_effect_flip')).toBe(true);

    const effectPath = soundEngine.getEffectFilePath('card_effect_flip');
    const audio = instances.find((candidate) => candidate.src === effectPath);
    expect(audio).toBeTruthy();
    expect(audio.play).toHaveBeenCalledTimes(1);
  });

  test('special_card_use still mutes BGM for three seconds when played through Web Audio', async () => {
    jest.useFakeTimers();
    try {
      const { MockAudio, instances } = createMockHtmlAudioClass();
      const { context } = createMockAudioContext();
      context.state = 'running';
      const fetchMock = jest.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(8)
      }));
      const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock, setTimeout, clearTimeout });
      soundEngine.ctx = context;
      soundEngine.allowBgmPlay = false;
      soundEngine.loadBgm(0);
      const bgm = instances[0];

      await soundEngine.unlockAudio();
      await soundEngine.primeEffectBuffer('special_card_use');

      expect(soundEngine.playEffectByKey('special_card_use')).toBe(true);
      expect(bgm.volume).toBe(0);

      jest.advanceTimersByTime(3000);
      expect(bgm.volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);
    } finally {
      jest.useRealTimers();
    }
  });

  test('startup default sound effect base volume is 0.56 with legacy alias', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.effectBaseVolume).toBe(0.56);
    expect(soundEngine.volume).toBe(0.56);
  });

  test('setVolume updates the effect base volume and legacy alias together', () => {
    const soundEngine = loadSoundEngine();

    soundEngine.setVolume('0.7');

    expect(soundEngine.effectBaseVolume).toBe(0.7);
    expect(soundEngine.volume).toBe(0.7);
    expect(soundEngine.resolveEffectVolume('stone_place')).toBeCloseTo(0.7 * 0.35 * (10 / 7) * DEFAULT_MASTER_VOLUME, 6);
  });

  test('startup default quick master volume is neutral at 1.0', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.masterVolume).toBe(1);
  });

  test('startup default BGM volume is 0.548625', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.bgmVolume).toBe(0.548625);
  });

  test('startup BGM output is globally scaled without moving the volume slider', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });

    soundEngine.allowBgmPlay = false;
    soundEngine.loadBgm(0);

    expect(soundEngine.bgmVolume).toBe(0.548625);
    expect(soundEngine.bgmOutputVolumeScale).toBe(0.24752);
    expect(instances[0].volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);

    soundEngine.setBgmVolume(1);

    expect(soundEngine.bgmVolume).toBe(1);
    expect(instances[0].volume).toBeCloseTo(0.24752 * DEFAULT_MASTER_VOLUME, 6);
  });

  test('master volume scales both BGM output and effect output without overwriting per-channel sliders', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });

    soundEngine.allowBgmPlay = false;
    soundEngine.loadBgm(0);
    soundEngine.setMasterVolume(0.5);

    expect(soundEngine.masterVolume).toBe(0.5);
    expect(soundEngine.volume).toBe(0.56);
    expect(soundEngine.bgmVolume).toBe(0.548625);
    expect(instances[0].volume).toBeCloseTo(0.548625 * 0.24752 * 0.5, 6);
    expect(soundEngine.resolveEffectVolume('hand_card_select')).toBeCloseTo(0.56 * 0.35 * 0.5 * 0.5, 6);
  });

  test('master volume accepts 200 percent as the upper bound', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });

    soundEngine.allowBgmPlay = false;
    soundEngine.bgmVolume = 0.5;
    soundEngine.loadBgm(0);
    soundEngine.setMasterVolume(2);

    expect(soundEngine.masterVolume).toBe(2);
    expect(instances[0].volume).toBeCloseTo(0.5 * 0.24752 * 2, 6);

    soundEngine.setMasterVolume(3);

    expect(soundEngine.masterVolume).toBe(2);
  });

  test('master volume and BGM output scale active result BGM output', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });

    soundEngine.bgm = { paused: false, pause: jest.fn() };
    soundEngine.bgmVolume = 0.8;

    expect(soundEngine.playResultBgm('win')).toBe(true);
    const resultBgm = instances[0];

    expect(resultBgm.volume).toBeCloseTo(0.8 * 0.24752 * DEFAULT_MASTER_VOLUME, 6);

    soundEngine.setMasterVolume(0.25);

    expect(resultBgm.volume).toBeCloseTo(0.8 * 0.24752 * 0.25, 6);
  });

  test('duration-end revert sound uses the renamed asset mapping', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.effectSoundFiles.special_reverted).toBe('特殊石が通常石に戻ったタイミング.mp3');
    expect(soundEngine.effectSoundFiles).not.toHaveProperty('special_expired');
  });

  test('living will grant and board shrink use dedicated sound mappings', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.effectSoundFiles.living_will_selected).toBe('生きる意志を付与するタイミング.mp3');
    expect(soundEngine.effectSoundFiles.board_shrink_selected).toBe('盤面縮小するタイミング.mp3');
    expect(soundEngine.effectSoundFiles.meteor_hole).toBe('因果抹消で穴化するタイミング.mp3');
    expect(soundEngine.effectSoundFiles.causal_replay_restore).toBe('因果再生で穴マスを通常マスに再生するタイミング.mp3');
    expect(soundEngine.effectSoundFiles.position_swap_move).toBe('入替の意志で石が入れ替わるタイミング.mp3');
    expect(soundEngine.effectVolumeScales.board_shrink_selected).toBe(0.7);
    expect(soundEngine.effectVolumeScales.meteor_hole).toBe(0.7);
    expect(soundEngine.effectVolumeScales.causal_replay_restore).toBe(0.7);
  });

  test('startup default track points to 犠牲のテーマ', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.playlist).toHaveLength(7);
    expect(soundEngine.playlist.map((track) => track.name)).toEqual([
      'c-reversi',
      'c-reversi-2',
      '盤喰いの小鬼戦',
      '幻想即興曲',
      'ノクターン',
      'The Observer’s Tears',
      '犠牲のテーマ'
    ]);
    expect(soundEngine.currentTrackIndex).toBe(6);
    expect(soundEngine.playlist[soundEngine.currentTrackIndex]).toEqual({
      name: '犠牲のテーマ',
      file: 'assets/audio/bgm/sacrifice.mp3',
      loopEnd: 40
    });
    expect(soundEngine.playlist[0]).toEqual({
      name: 'c-reversi',
      file: 'assets/audio/bgm/c-reversi.mp3'
    });
    expect(soundEngine.playlist[1]).toEqual({
      name: 'c-reversi-2',
      file: 'assets/audio/bgm/c-reversi-2.mp3'
    });
    expect(soundEngine.playlist[3]).toEqual({
      name: '幻想即興曲',
      file: 'assets/audio/bgm/幻想即興曲.mp3'
    });
    expect(soundEngine.playlist[4]).toEqual({
      name: 'ノクターン',
      file: 'assets/audio/bgm/ノクターン.mp3'
    });
    expect(soundEngine.playlist[5]).toEqual({
      name: 'The Observer’s Tears',
      file: 'assets/audio/bgm/The Observer’s Tears.mp3',
      loopEnd: 58.434783
    });
    expect(soundEngine.playlist[6]).toEqual({
      name: '犠牲のテーマ',
      file: 'assets/audio/bgm/sacrifice.mp3',
      loopEnd: 40
    });
  });

  test('playlist includes 盤喰いの小鬼戦 with intro-skip loop metadata', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.playlist).toEqual(
      expect.arrayContaining([
        {
          name: '盤喰いの小鬼戦',
          file: 'assets/audio/bgm/盤喰いの小鬼戦.mp3',
          loopStart: 1.655
        }
      ])
    );
  });

  test('loopStart track re-enters from the loop point instead of replaying the intro', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });
    const loopTrackIndex = soundEngine.playlist.findIndex((track) => track && track.name === '盤喰いの小鬼戦');

    soundEngine.allowBgmPlay = false;
    soundEngine.loadBgm(loopTrackIndex);

    const bgm = instances[0];
    expect(bgm.loop).toBe(false);
    expect(typeof bgm.ontimeupdate).toBe('function');
    expect(typeof bgm.onended).toBe('function');

    bgm.duration = 12;
    bgm.currentTime = 11.9;
    bgm.ontimeupdate();

    expect(bgm.currentTime).toBeCloseTo(1.655, 6);

    soundEngine.allowBgmPlay = true;
    bgm.paused = true;
    bgm.currentTime = 12;
    bgm.onended();

    expect(bgm.currentTime).toBeCloseTo(1.655, 6);
    expect(bgm.play).toHaveBeenCalledTimes(1);
  });

  test('manifest BGM override pauses normal BGM and resumes it after clearing', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });

    soundEngine.allowBgmPlay = true;
    soundEngine.loadBgm(0);
    const normalBgm = instances[0];
    expect(normalBgm.play).toHaveBeenCalledTimes(1);

    const started = soundEngine.setManifestBgmOverride('observer_will_path', {
      name: '観測の道',
      file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3'
    });

    const manifestBgm = instances[1];
    expect(started).toBe(true);
    expect(normalBgm.pause).toHaveBeenCalledTimes(1);
    expect(manifestBgm.src).toBe('assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3');
    expect(manifestBgm.loop).toBe(true);
    expect(manifestBgm.volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);
    expect(manifestBgm.play).toHaveBeenCalledTimes(1);

    soundEngine.clearManifestBgmOverride();

    expect(manifestBgm.pause).toHaveBeenCalledTimes(1);
    expect(normalBgm.play).toHaveBeenCalledTimes(2);
  });

  test('manifest BGM override crossfades back to normal BGM over the requested duration', () => {
    jest.useFakeTimers();
    try {
      const { MockAudio, instances } = createMockHtmlAudioClass();
      const soundEngine = loadSoundEngine({ Audio: MockAudio, setTimeout, clearTimeout });

      soundEngine.allowBgmPlay = true;
      soundEngine.loadBgm(0);
      const normalBgm = instances[0];
      const normalTargetVolume = normalBgm.volume;

      soundEngine.setManifestBgmOverride('observer_will_path', {
        name: '観測の道',
        file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3'
      });
      const manifestBgm = instances[1];
      const manifestStartVolume = manifestBgm.volume;

      soundEngine.clearManifestBgmOverride({ transitionMs: 2000 });

      expect(manifestBgm.pause).not.toHaveBeenCalled();
      expect(normalBgm.play).toHaveBeenCalledTimes(2);
      expect(normalBgm.volume).toBe(0);

      jest.advanceTimersByTime(350);

      expect(manifestBgm.volume).toBeGreaterThan(0);
      expect(manifestBgm.volume).toBeLessThan(manifestStartVolume);
      expect(normalBgm.volume).toBe(0);

      jest.advanceTimersByTime(650);

      expect(manifestBgm.volume).toBeCloseTo(0, 6);
      expect(normalBgm.volume).toBe(0);

      jest.advanceTimersByTime(500);

      expect(manifestBgm.volume).toBeCloseTo(0, 6);
      expect(normalBgm.volume).toBeGreaterThan(0);
      expect(normalBgm.volume).toBeLessThan(normalTargetVolume);

      jest.advanceTimersByTime(500);

      expect(manifestBgm.pause).toHaveBeenCalledTimes(1);
      expect(normalBgm.volume).toBeCloseTo(normalTargetVolume, 6);
    } finally {
      jest.useRealTimers();
    }
  });

  test('manifest BGM override waits for the special card mute window before starting', () => {
    jest.useFakeTimers();
    try {
      const { MockAudio, instances } = createMockHtmlAudioClass();
      const soundEngine = loadSoundEngine({ Audio: MockAudio, setTimeout, clearTimeout });
      soundEngine.allowBgmPlay = true;
      soundEngine.loadBgm(0);
      const normalBgm = instances[0];
      expect(normalBgm.play).toHaveBeenCalledTimes(1);

      expect(soundEngine.playEffectByKey('special_card_use')).toBe(true);
      const beforeManifestCount = instances.length;
      const started = soundEngine.setManifestBgmOverride('observer_will_path', {
        name: '観測の道',
        file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3'
      });
      const manifestBgm = instances[beforeManifestCount];

      expect(started).toBe(true);
      expect(normalBgm.pause).toHaveBeenCalledTimes(1);
      expect(manifestBgm.play).not.toHaveBeenCalled();

      jest.advanceTimersByTime(2999);
      expect(manifestBgm.play).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      expect(manifestBgm.play).toHaveBeenCalledTimes(1);
      expect(normalBgm.play).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test('manifest BGM override respects a paused normal BGM setting', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });

    soundEngine.allowBgmPlay = false;
    soundEngine.loadBgm(0);
    const normalBgm = instances[0];
    const started = soundEngine.setManifestBgmOverride('observer_will_path', {
      name: '観測の道',
      file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3'
    });
    const manifestBgm = instances[1];

    expect(started).toBe(true);
    expect(normalBgm.pause).not.toHaveBeenCalled();
    expect(manifestBgm.play).not.toHaveBeenCalled();

    soundEngine.clearManifestBgmOverride();

    expect(normalBgm.play).not.toHaveBeenCalled();
  });

  test('manifest BGM with loopEnd uses AudioBuffer looping when Web Audio and fetch are available', async () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const { context, sources } = createMockAudioContext();
    context.decodeAudioData = jest.fn(async () => ({ duration: 62.4 }));
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16)
    }));
    const soundEngine = loadSoundEngine({ Audio: MockAudio, fetch: fetchMock });
    soundEngine.ctx = context;
    soundEngine.allowBgmPlay = true;

    soundEngine.loadBgm(0);
    const normalBgm = instances[0];
    expect(normalBgm.play).toHaveBeenCalledTimes(1);

    const started = soundEngine.setManifestBgmOverride('observer_will_path', {
      name: '観測の道',
      file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3',
      loopStart: 9.6,
      loopEnd: 62.4
    });
    await flushAsyncWork();

    expect(started).toBe(true);
    expect(normalBgm.pause).toHaveBeenCalledTimes(1);
    expect(soundEngine._manifestBgm.__bufferedLoop).toBe(true);
    expect(soundEngine._manifestBgm.paused).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3');
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
    expect(sources[0].loop).toBe(true);
    expect(sources[0].loopStart).toBeCloseTo(9.6, 6);
    expect(sources[0].loopEnd).toBeCloseTo(62.4, 6);
    expect(sources[0].start).toHaveBeenCalledWith(0, 0);
  });

  test('manifest BGM loopEnd falls back to HTML range looping without Web Audio', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });

    soundEngine.allowBgmPlay = false;
    const started = soundEngine.setManifestBgmOverride('observer_will_path', {
      name: '観測の道',
      file: 'assets/audio/bgm/manifest-stones/観測の道-bpm150.mp3',
      loopStart: 9.6,
      loopEnd: 62.4
    });

    const manifestBgm = instances[0];
    expect(started).toBe(true);
    expect(manifestBgm.loop).toBe(false);
    expect(typeof manifestBgm.ontimeupdate).toBe('function');
    expect(typeof manifestBgm.onended).toBe('function');

    manifestBgm.duration = 62.4;
    manifestBgm.currentTime = 62.3;
    manifestBgm.ontimeupdate();

    expect(manifestBgm.currentTime).toBeCloseTo(9.6, 6);
  });

  test('loopStart track uses AudioBuffer looping when Web Audio and fetch are available', async () => {
    const { context, sources } = createMockAudioContext();
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16)
    }));
    const soundEngine = loadSoundEngine({ fetch: fetchMock });
    const loopTrackIndex = soundEngine.playlist.findIndex((track) => track && track.name === '盤喰いの小鬼戦');
    soundEngine.ctx = context;
    soundEngine.allowBgmPlay = true;

    soundEngine.loadBgm(loopTrackIndex);
    await flushAsyncWork();

    expect(soundEngine.bgm.__bufferedLoop).toBe(true);
    expect(soundEngine.bgm.paused).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('assets/audio/bgm/盤喰いの小鬼戦.mp3');
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
    expect(sources[0].loop).toBe(true);
    expect(sources[0].loopStart).toBeCloseTo(1.655, 6);
    expect(sources[0].loopEnd).toBeCloseTo(12, 6);
    expect(sources[0].start).toHaveBeenCalledWith(0, 0);
  });

  test('loopEnd-only track uses AudioBuffer looping from the head when Web Audio and fetch are available', async () => {
    const { context, sources } = createMockAudioContext();
    context.decodeAudioData = jest.fn(async () => ({ duration: 58.43483 }));
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16)
    }));
    const soundEngine = loadSoundEngine({ fetch: fetchMock });
    const loopTrackIndex = soundEngine.playlist.findIndex((track) => track && track.name === 'The Observer’s Tears');
    soundEngine.ctx = context;
    soundEngine.allowBgmPlay = true;

    soundEngine.loadBgm(loopTrackIndex);
    await flushAsyncWork();

    expect(soundEngine.bgm.__bufferedLoop).toBe(true);
    expect(soundEngine.bgm.paused).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith('assets/audio/bgm/The Observer’s Tears.mp3');
    expect(context.decodeAudioData).toHaveBeenCalledTimes(1);
    expect(sources).toHaveLength(1);
    expect(sources[0].loop).toBe(true);
    expect(sources[0].loopStart).toBeCloseTo(0, 6);
    expect(sources[0].loopEnd).toBeCloseTo(58.434783, 6);
    expect(sources[0].start).toHaveBeenCalledWith(0, 0);
  });

  test('buffered loop track resumes from the paused offset instead of replaying the intro', async () => {
    const { context, sources } = createMockAudioContext();
    const fetchMock = jest.fn(async () => ({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(16)
    }));
    const soundEngine = loadSoundEngine({ fetch: fetchMock });
    const loopTrackIndex = soundEngine.playlist.findIndex((track) => track && track.name === '盤喰いの小鬼戦');
    soundEngine.ctx = context;
    soundEngine.allowBgmPlay = true;

    soundEngine.loadBgm(loopTrackIndex);
    await flushAsyncWork();

    context.currentTime = 3;
    soundEngine.pauseBgm();

    expect(soundEngine.bgm.paused).toBe(true);
    expect(sources[0].stop).toHaveBeenCalledTimes(1);

    soundEngine.playBgm();
    await flushAsyncWork();

    expect(sources).toHaveLength(2);
    expect(soundEngine.bgm.paused).toBe(false);
    expect(sources[1].start).toHaveBeenCalledWith(0, 2);
  });

  test('effect API accepts direct filePath overrides', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('stone_place', {
      filePath: 'assets/audio/sound-effect/カードを使ったとき.mp3'
    })).toBe('assets/audio/sound-effect/カードを使ったとき.mp3');
  });

  test('effect keys can resolve direct asset paths outside the default effect directory', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('stone_place')).toBe(
      'assets/audio/sound-effect-skin/default.mp3'
    );
  });

  test('super buoyancy sound key resolves to the shipped filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('super_buoyancy_move')).toBe(
      'assets/audio/sound-effect/浮力系で石が浮上したタイミング.mp3'
    );
  });

  test('super attraction sound key resolves to the shipped filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('super_attraction_move')).toBe(
      'assets/audio/sound-effect/超引力で石が引き寄せられたタイミング.mp3'
    );
  });

  test('card effect flip sound key resolves to the renamed filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('card_effect_flip')).toBe(
      'assets/audio/sound-effect/カード効果で石が反転したタイミング.mp3'
    );
  });

  test('ultimate anchor move sound key resolves to the new filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('ultimate_anchor_move')).toBe(
      'assets/audio/sound-effect/究極反転龍・究極破壊神・意志狩りの王が移動したタイミング.mp3'
    );
  });

  test('strong will promotion sound key resolves to the shipped filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('strong_will_promoted')).toBe(
      'assets/audio/sound-effect/強い意志の石が進化したタイミング.mp3'
    );
  });

  test('seed sprout sound key resolves to the shipped filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('seed_sprout')).toBe(
      'assets/audio/sound-effect/種まきの意志で芽生えるタイミング.mp3'
    );
  });

  test('seed place sound key resolves to the shipped filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('seed_place')).toBe(
      'assets/audio/sound-effect/種まきの意志で種をまいたタイミング.mp3'
    );
  });

  test('living will restored sound key resolves to the shipped filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('living_will_restored')).toBe(
      'assets/audio/sound-effect/生きる意志で復活するタイミング.mp3'
    );
  });

  test('theory incarnation spawn sound key resolves to the roulette-start filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.effectSoundFiles.theory_incarnation_spawn).toBe(
      '理論の化身のルーレットの開始タイミング.mp3'
    );
    expect(soundEngine.getEffectFilePath('theory_incarnation_spawn')).toBe(
      'assets/audio/sound-effect/理論の化身のルーレットの開始タイミング.mp3'
    );
  });

  test('registered effect sound files exist', () => {
    const soundEngine = loadSoundEngine();

    for (const key of Object.keys(soundEngine.effectSoundFiles)) {
      const effectPath = soundEngine.getEffectFilePath(key);
      expect(fs.existsSync(path.resolve(__dirname, '..', effectPath))).toBe(true);
    }
  });

  test('primeEffectSounds preloads one pooled audio element per registered effect path', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });
    const uniqueEffectPathCount = new Set(
      Object.keys(soundEngine.effectSoundFiles).map((key) => soundEngine.getEffectFilePath(key))
    ).size;

    expect(soundEngine.primeEffectSounds()).toBe(uniqueEffectPathCount);
    expect(instances).toHaveLength(uniqueEffectPathCount);
    expect(instances.every((audio) => audio.preload === 'auto')).toBe(true);
    expect(instances.every((audio) => audio.load.mock.calls.length === 1)).toBe(true);
  });

  test('playEffectByKey reuses an idle warmed effect audio instead of rebuilding it', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });
    const originalPrimeEffectSounds = soundEngine.primeEffectSounds.bind(soundEngine);
    const effectPath = soundEngine.getEffectFilePath('card_effect_flip');

    soundEngine.init = jest.fn(() => {
      originalPrimeEffectSounds();
    });

    expect(soundEngine.playEffectByKey('card_effect_flip')).toBe(true);

    const warmedAudio = instances.find((audio) => audio.src === effectPath);
    expect(warmedAudio).toBeTruthy();
    expect(warmedAudio.play).toHaveBeenCalledTimes(1);

    warmedAudio.paused = true;

    expect(soundEngine.playEffectByKey('card_effect_flip')).toBe(true);
    expect(instances.filter((audio) => audio.src === effectPath)).toHaveLength(1);
    expect(warmedAudio.play).toHaveBeenCalledTimes(2);
  });

  test('stone placement sound uses the dedicated mp3 effect while keeping the 0.5 volume ratio', () => {
    const { MockAudio, instances } = createMockHtmlAudioClass();
    const soundEngine = loadSoundEngine({ Audio: MockAudio });
    const originalPrimeEffectSounds = soundEngine.primeEffectSounds.bind(soundEngine);
    const effectPath = soundEngine.getEffectFilePath('stone_place');
    soundEngine.volume = 0.7;
    soundEngine.init = jest.fn(() => {
      originalPrimeEffectSounds();
    });

    expect(soundEngine.effectSoundFiles.stone_place).toBe('assets/audio/sound-effect-skin/default.mp3');
    expect(effectPath).toBe('assets/audio/sound-effect-skin/default.mp3');
    expect(soundEngine.resolveEffectVolume('stone_place')).toBeCloseTo(0.7 * 0.35 * (10 / 7) * DEFAULT_MASTER_VOLUME, 6);
    expect(soundEngine.playEffectByKey('stone_place')).toBe(true);

    const warmedAudio = instances.find((audio) => audio.src === effectPath);
    expect(warmedAudio).toBeTruthy();
    expect(warmedAudio.volume).toBeCloseTo(0.7 * 0.35 * (10 / 7) * DEFAULT_MASTER_VOLUME, 6);
    expect(warmedAudio.play).toHaveBeenCalledTimes(1);
  });

  test('special card use sound mutes BGM output for exactly three seconds', () => {
    jest.useFakeTimers();
    try {
      const { MockAudio, instances } = createMockHtmlAudioClass();
      const soundEngine = loadSoundEngine({ Audio: MockAudio, setTimeout, clearTimeout });
      const originalPrimeEffectSounds = soundEngine.primeEffectSounds.bind(soundEngine);
      soundEngine.allowBgmPlay = false;
      soundEngine.init = jest.fn(() => {
        originalPrimeEffectSounds();
      });
      soundEngine.loadBgm(0);

      const bgm = instances[0];
      expect(bgm.volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);

      expect(soundEngine.playEffectByKey('special_card_use')).toBe(true);

      expect(bgm.volume).toBe(0);

      jest.advanceTimersByTime(2999);
      expect(bgm.volume).toBe(0);

      jest.advanceTimersByTime(1);
      expect(bgm.volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);
    } finally {
      jest.useRealTimers();
    }
  });

  test('repeated special card use keeps BGM muted until three seconds after the latest use', () => {
    jest.useFakeTimers();
    try {
      const { MockAudio, instances } = createMockHtmlAudioClass();
      const soundEngine = loadSoundEngine({ Audio: MockAudio, setTimeout, clearTimeout });
      const originalPrimeEffectSounds = soundEngine.primeEffectSounds.bind(soundEngine);
      soundEngine.allowBgmPlay = false;
      soundEngine.init = jest.fn(() => {
        originalPrimeEffectSounds();
      });
      soundEngine.loadBgm(0);

      const bgm = instances[0];
      expect(soundEngine.playEffectByKey('special_card_use')).toBe(true);
      jest.advanceTimersByTime(2000);
      expect(soundEngine.playEffectByKey('special_card_use')).toBe(true);

      jest.advanceTimersByTime(999);
      expect(bgm.volume).toBe(0);

      jest.advanceTimersByTime(1);
      expect(bgm.volume).toBe(0);

      jest.advanceTimersByTime(2000);
      expect(bgm.volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);
    } finally {
      jest.useRealTimers();
    }
  });

  test('regular effect sounds do not mute BGM output', () => {
    jest.useFakeTimers();
    try {
      const { MockAudio, instances } = createMockHtmlAudioClass();
      const soundEngine = loadSoundEngine({ Audio: MockAudio, setTimeout, clearTimeout });
      const originalPrimeEffectSounds = soundEngine.primeEffectSounds.bind(soundEngine);
      soundEngine.allowBgmPlay = false;
      soundEngine.init = jest.fn(() => {
        originalPrimeEffectSounds();
      });
      soundEngine.loadBgm(0);

      const bgm = instances[0];
      expect(soundEngine.playEffectByKey('card_use_button')).toBe(true);

      expect(bgm.volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);
      jest.advanceTimersByTime(3000);
      expect(bgm.volume).toBeCloseTo(DEFAULT_BGM_OUTPUT_VOLUME, 6);
    } finally {
      jest.useRealTimers();
    }
  });

  test('stone placement sound resolves the selected unlocked gacha sound asset path', () => {
    const selectedSoundId = 'gacha__n__placement_sound__type-1-standard';
    const placementSoundSelection = require('../ui/placement-sound-selection.js');
    const soundEngine = loadSoundEngine({
      localStorage: {
        getItem: jest.fn(() => selectedSoundId),
        setItem: jest.fn()
      },
      PlacementSoundSelectionModule: placementSoundSelection,
      ObservationGachaCatalogAccessModule: {
        getObservationCatalogItemsByKind: jest.fn(() => ([
          {
            id: selectedSoundId,
            kind: 'placement_sound',
            label: 'type-1-standard',
            assetPath: 'assets/images/Gacha/N/type-1-standard.mp3',
            soundPath: 'assets/images/Gacha/N/type-1-standard.mp3'
          }
        ]))
      },
      GachaProgressStorage: {
        listOwnedPlacementSoundIds: jest.fn(() => ['default', selectedSoundId])
      }
    });

    expect(soundEngine.getSelectedPlacementSoundId()).toBe(selectedSoundId);
    expect(soundEngine.getEffectFilePath('stone_place')).toBe('assets/images/Gacha/N/type-1-standard.mp3');
  });
});
