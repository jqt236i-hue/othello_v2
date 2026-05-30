import SoundEngineModule = require('../sound-engine.ts');

const AnimationFeedbackEvents = require('../ui/animation-feedback-events.js');

function getRegisteredSoundKeys(): string[] {
  const soundEngine = (SoundEngineModule as any).default || SoundEngineModule;
  const map = soundEngine && typeof soundEngine === 'object' && soundEngine.effectSoundFiles
    ? soundEngine.effectSoundFiles
    : {};
  return Object.keys(map)
    .map((key) => String(key || '').trim())
    .filter((key) => key.length > 0)
    .sort();
}

describe('animation feedback sound key coverage', () => {
  test('registered effect sound keys are forwarded to SoundEngine.playEffectByKey', async () => {
    const keys = getRegisteredSoundKeys();
    expect(keys.length).toBeGreaterThan(0);

    const played: string[] = [];
    const deps = {
      soundEngine: {
        init: jest.fn(),
        playEffectByKey: jest.fn((key: string) => {
          played.push(String(key || '').trim());
        })
      }
    };

    for (const key of keys) {
      await AnimationFeedbackEvents.handleSoundEffectEvent(
        {
          type: 'sound_effect',
          phase: 1,
          targets: [{ soundKey: key }]
        },
        deps
      );
    }

    expect(deps.soundEngine.init).toHaveBeenCalledTimes(keys.length);
    expect(new Set(played)).toEqual(new Set(keys));
  });

  test('duplicate sound keys in one playback event are deduplicated before playback', async () => {
    const playEffectByKey = jest.fn();
    await AnimationFeedbackEvents.handleSoundEffectEvent(
      {
        type: 'sound_effect',
        phase: 4,
        soundKey: 'stone_destroy',
        targets: [
          { soundKey: 'stone_destroy' },
          { soundKey: 'card_use_button' },
          { soundKey: 'card_use_button' }
        ]
      },
      {
        consumeSkipNextCardUseButtonSound: () => false,
        soundEngine: {
          init: jest.fn(),
          playEffectByKey
        }
      }
    );

    expect(playEffectByKey.mock.calls.map((call) => call[0])).toEqual([
      'stone_destroy',
      'card_use_button'
    ]);
  });
});
