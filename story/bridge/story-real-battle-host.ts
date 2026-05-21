import type { StoryBattleResult, StoryBattleStage } from '../core/story-schema';
import type { StoryDeckPreset } from '../core/story-schema';
import { buildStoryBattleGameInitOptions } from './story-battle-game-adapter';
import { installStoryBattleResultListener } from './story-battle-result-listener';
import type { StoryHost } from './story-host';
import {
  readCurrentPlayerDeckSpec,
  runWithStoryBattleCardInitOptions
} from './story-turn-manager-init-override';

type StoryBattleRoot = Record<string, any>;

export type StoryRealBattleHostOptions = {
  root?: StoryBattleRoot;
  stages: Record<string, StoryBattleStage>;
  deckPresets: Record<string, StoryDeckPreset>;
  getCurrentPlayerDeckSpec?: () => unknown;
};

export function createStoryRealBattleHost(options: StoryRealBattleHostOptions): StoryHost {
  const root = options.root ?? (globalThis as StoryBattleRoot);

  return {
    startBattle(request) {
      const stage = options.stages[request.stageId];
      if (!stage) {
        return Promise.reject(new Error(`Unknown story battle stage: ${request.stageId}`));
      }

      const initOptions = buildStoryBattleGameInitOptions(stage, {
        deckPresets: options.deckPresets,
        currentPlayerDeckSpec: options.getCurrentPlayerDeckSpec?.() ?? readCurrentPlayerDeckSpec(root)
      });

      return new Promise<StoryBattleResult>((resolve, reject) => {
        const resetGame = resolveResetGame(root);
        if (!resetGame) {
          reject(new Error('resetGame is required to start a real story battle.'));
          return;
        }

        const restoreResultHook = installStoryBattleResultListener({
          root,
          stageId: request.stageId,
          protagonistSide: stage.protagonistSide ?? 'black',
          resolve
        });
        try {
          runWithStoryBattleCardInitOptions(root, initOptions, () => {
            resetGame({ skipNetworkPublish: true, source: 'story_battle' });
          });
        } catch (error) {
          restoreResultHook();
          reject(error);
        }
      });
    }
  };
}

function resolveResetGame(root: StoryBattleRoot): ((options?: unknown) => void) | null {
  if (typeof root.resetGame === 'function') return root.resetGame;
  return null;
}
