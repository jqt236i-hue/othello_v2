const StoryEncounterModule = require('../ui/story/story-encounter');

describe('story encounter result overrides', () => {
  test('win result exposes continue action and story ranking exclusion', async () => {
    const stateStore = {
      setEncounterState: jest.fn()
    };
    const runtime = {
      restoreCpuTurns: jest.fn(),
      waitForResetReady: jest.fn(() => Promise.resolve(true)),
      updateCpuLabel: jest.fn()
    };
    const root = {
      cpuSmartness: { black: 1, white: 1 },
      resetGame: jest.fn(),
      emitLogAdded: jest.fn()
    };

    const encounter = StoryEncounterModule.createStoryEncounter({
      root,
      stateStore,
      runtime
    });

    const onWinContinue = jest.fn(() => Promise.resolve(true));
    await encounter.startEncounter({
      encounterId: 'chapter1_goblin',
      enemyName: '盤喰いの小鬼',
      enemyImageSrc: 'assets/story/cpu/level1.png',
      cpuLevel: 1,
      onWinContinue
    });

    const override = encounter.resolveStoryEncounterResult({ black: 40, white: 24 }, 'black');
    expect(override.title).toBe('勝利');
    expect(override.metaText).toBe('ストーリー対局: ランキング対象外');
    expect(override.primaryLabel).toBe('続ける');

    await override.onPrimary();
    expect(onWinContinue).toHaveBeenCalled();
    expect(root.resetGame).toHaveBeenCalled();
  });

  test('story result exit does not reset the game and preserves enemy portrait info', async () => {
    const stateStore = {
      setEncounterState: jest.fn()
    };
    const runtime = {
      restoreCpuTurns: jest.fn(),
      waitForResetReady: jest.fn(() => Promise.resolve(true)),
      updateCpuLabel: jest.fn()
    };
    const root = {
      cpuSmartness: { black: 1, white: 1 },
      resetGame: jest.fn(),
      emitLogAdded: jest.fn()
    };

    const encounter = StoryEncounterModule.createStoryEncounter({
      root,
      stateStore,
      runtime
    });

    const onAbort = jest.fn(() => Promise.resolve(true));
    await encounter.startEncounter({
      encounterId: 'chapter1_goblin',
      enemyName: '盤喰いの小鬼',
      enemyImageSrc: 'assets/story/cpu/level1.png',
      cpuLevel: 1,
      onAbort
    });
    root.resetGame.mockClear();

    const override = encounter.resolveStoryEncounterResult({ black: 40, white: 24 }, 'black');
    expect(override.layout).toBe('story');
    expect(override.enemyImageSrc).toBe('assets/story/cpu/level1.png');

    await override.onSecondary();

    expect(onAbort).toHaveBeenCalled();
    expect(root.resetGame).not.toHaveBeenCalled();
  });
});
