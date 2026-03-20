const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSoundEngine(overrides = {}) {
  const filePath = path.resolve(__dirname, '..', 'sound-engine.js');
  const source = fs.readFileSync(filePath, 'utf8') + '\nmodule.exports = SoundEngine;';
  const context = Object.assign({
    module: { exports: {} },
    exports: {},
    console,
    updateBgmButtons: jest.fn(),
    Audio: function Audio() {}
  }, overrides);
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
  test('startup default sound effect master volume is 0.7', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.volume).toBe(0.7);
  });

  test('startup default track points to c-othello-2', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.playlist).toHaveLength(5);
    expect(soundEngine.playlist.map((track) => track.name)).toEqual([
      'c-othello',
      'c-othello-2',
      '盤喰いの小鬼戦',
      '幻想即興曲',
      'ノクターン'
    ]);
    expect(soundEngine.currentTrackIndex).toBe(1);
    expect(soundEngine.playlist[1]).toEqual({
      name: 'c-othello-2',
      file: 'assets/audio/bgm/c-othello-2.mp3'
    });
    expect(soundEngine.playlist[0]).toEqual({
      name: 'c-othello',
      file: 'assets/audio/bgm/c-othello.mp3'
    });
    expect(soundEngine.playlist[3]).toEqual({
      name: '幻想即興曲',
      file: 'assets/audio/bgm/幻想即興曲.mp3'
    });
    expect(soundEngine.playlist[4]).toEqual({
      name: 'ノクターン',
      file: 'assets/audio/bgm/ノクターン.mp3'
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

  test('playEffectByKey accepts direct filePath overrides', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('tutorial_story_effect', {
      filePath: 'assets/story/sound-ef/テキストをクリックするとき.mp3'
    })).toBe('assets/story/sound-ef/テキストをクリックするとき.mp3');
  });

  test('super buoyancy sound key resolves to the shipped filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('super_buoyancy_move')).toBe(
      'assets/audio/sound-effect/超浮力で石を浮かせるタイミング.mp3'
    );
  });

  test('card effect flip sound key resolves to the renamed filename', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('card_effect_flip')).toBe(
      'assets/audio/sound-effect/カード効果で石が反転するタイミング.mp3'
    );
  });

  test('stone placement sound applies its own 0.8 volume scale on top of the SE master volume', () => {
    const soundEngine = loadSoundEngine();
    const { context, gains } = createMockAudioContext();
    soundEngine.ctx = context;
    soundEngine.volume = 0.7;
    soundEngine.currentType = '2';

    expect(soundEngine.resolveStoneClackVolume()).toBeCloseTo(0.56, 6);

    soundEngine.playStoneClack();

    expect(gains).toHaveLength(3);
    expect(gains[0].gain.linearRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(0.224, 6);
    expect(gains[1].gain.linearRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(0.112, 6);
    expect(gains[2].gain.setValueAtTime.mock.calls[0][0]).toBeCloseTo(0.084, 6);
  });
});
