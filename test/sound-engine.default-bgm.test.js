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
});
