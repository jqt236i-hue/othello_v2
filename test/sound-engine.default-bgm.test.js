const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadSoundEngine() {
  const filePath = path.resolve(__dirname, '..', 'sound-engine.js');
  const source = fs.readFileSync(filePath, 'utf8') + '\nmodule.exports = SoundEngine;';
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    updateBgmButtons: jest.fn(),
    Audio: function Audio() {}
  };
  vm.runInNewContext(source, context, { filename: filePath });
  return context.module.exports;
}

function createMockAudioContext() {
  const gains = [];
  return {
    gains,
    context: {
      state: 'running',
      currentTime: 1,
      sampleRate: 10,
      destination: {},
      resume: jest.fn(),
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
        return {
          connect: jest.fn(),
          start: jest.fn()
        };
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

describe('SoundEngine default BGM', () => {
  test('startup default sound effect master volume is 0.7', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.volume).toBe(0.7);
  });

  test('startup default track points to c-othello-2', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.currentTrackIndex).toBe(1);
    expect(soundEngine.playlist[1]).toEqual({
      name: 'c-othello-2',
      file: 'assets/audio/bgm/c-othello-2.mp3'
    });
    expect(soundEngine.playlist).toEqual(
      expect.arrayContaining([
        {
          name: 'c-othello',
          file: 'assets/audio/bgm/c-othello.mp3'
        }
      ])
    );
  });

  test('playEffectByKey accepts direct filePath overrides', () => {
    const soundEngine = loadSoundEngine();

    expect(soundEngine.getEffectFilePath('tutorial_story_effect', {
      filePath: 'assets/story/sound-ef/テキストをクリックするとき.mp3'
    })).toBe('assets/story/sound-ef/テキストをクリックするとき.mp3');
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
