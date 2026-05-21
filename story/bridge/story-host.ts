import type { StoryBattleRequest, StoryBattleResult } from '../core/story-schema';

export type StoryHost = {
  startBattle: (request: StoryBattleRequest) => Promise<StoryBattleResult>;
};
