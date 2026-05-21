import type { StoryBattleRequest, StoryBattleResult, StoryBattleStage } from '../core/story-schema';
import type { StoryHost } from './story-host';

export type StoryBattleBridgeOptions = {
  stages: Record<string, StoryBattleStage>;
  host: StoryHost;
};

export type ResolvedStoryBattle = {
  request: StoryBattleRequest;
  stage: StoryBattleStage;
};

export class StoryBattleBridge {
  private readonly stages: Record<string, StoryBattleStage>;
  private readonly host: StoryHost;

  constructor(options: StoryBattleBridgeOptions) {
    this.stages = options.stages;
    this.host = options.host;
  }

  resolve(request: StoryBattleRequest): ResolvedStoryBattle {
    const stage = this.stages[request.stageId];
    if (!stage) {
      throw new Error(`Unknown story battle stage: ${request.stageId}`);
    }
    return { request, stage };
  }

  async start(request: StoryBattleRequest): Promise<StoryBattleResult> {
    this.resolve(request);
    return this.host.startBattle(request);
  }
}

export function createMockStoryBattleHost(outcome: StoryBattleResult['outcome'] = 'win'): StoryHost {
  return {
    async startBattle(request) {
      return { stageId: request.stageId, outcome };
    }
  };
}
