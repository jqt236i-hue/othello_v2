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

describe('SoundEngine default BGM', () => {
  test('startup default sound effect master volume is 0.56', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.volume).toBe(0.56);
  });

  test('startup default BGM volume is 1.1', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.bgmVolume).toBe(1.1);
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
    expect(soundEngine.effectSoundFiles.position_swap_move).toBe('入替の意志で石が入れ替わるタイミング.mp3');
    expect(soundEngine.effectVolumeScales.board_shrink_selected).toBe(0.7);
  });

  test('startup default track points to The Observer’s Tears', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.playlist).toHaveLength(6);
    expect(soundEngine.playlist.map((track) => track.name)).toEqual([
      'c-reversi',
      'c-reversi-2',
      '盤喰いの小鬼戦',
      '幻想即興曲',
      'ノクターン',
      'The Observer’s Tears'
    ]);
    expect(soundEngine.currentTrackIndex).toBe(5);
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

  test('stone placement sound uses the dedicated mp3 effect while keeping the 0.75 volume ratio', () => {
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
    expect(soundEngine.resolveEffectVolume('stone_place')).toBeCloseTo(0.525, 6);
    expect(soundEngine.playEffectByKey('stone_place')).toBe(true);

    const warmedAudio = instances.find((audio) => audio.src === effectPath);
    expect(warmedAudio).toBeTruthy();
    expect(warmedAudio.volume).toBeCloseTo(0.525, 6);
    expect(warmedAudio.play).toHaveBeenCalledTimes(1);
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
