import SoundEngineAccess = require('../../ui/sound-engine-access');

type RootScope = Record<string, any>;

export type StoryBaseBgmSession = {
  enterStoryMode: () => void;
  leaveStoryMode: () => void;
};

export function createStoryBaseBgmSession(rootScope: RootScope): StoryBaseBgmSession {
  let pausedBaseBgmForStory = false;

  return {
    enterStoryMode() {
      if (pausedBaseBgmForStory) return;
      const engine = SoundEngineAccess.resolveSoundEngine(rootScope);
      if (!engine || typeof (engine as any).pauseBgm !== 'function') return;
      if (!SoundEngineAccess.isBgmPlaying(engine)) return;
      (engine as any).pauseBgm();
      pausedBaseBgmForStory = true;
    },

    leaveStoryMode() {
      if (!pausedBaseBgmForStory) return;
      const engine = SoundEngineAccess.resolveSoundEngine(rootScope);
      pausedBaseBgmForStory = false;
      if (!engine || typeof (engine as any).playBgm !== 'function') return;
      (engine as any).playBgm();
    }
  };
}
