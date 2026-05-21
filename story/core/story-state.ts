import type {
  StoryBattleRequest,
  StoryChapterId,
  StoryChoiceOption,
  StoryFlagKey,
  StoryFlagValue,
  StoryId,
  StoryLineId,
  StoryNodeId,
  StoryUnlockId
} from './story-schema';

export type StoryBacklogEntry = {
  lineId?: StoryLineId;
  speaker: string;
  text: string;
};

export type StoryPendingChoice = {
  choices: StoryChoiceOption[];
};

export type StoryState = {
  scenarioId: StoryId;
  chapterId: StoryChapterId;
  nodeId: StoryNodeId;
  commandIndex: number;
  flags: Record<StoryFlagKey, StoryFlagValue>;
  unlocked: StoryUnlockId[];
  seenLines: StoryLineId[];
  backlog: StoryBacklogEntry[];
  pendingChoice: StoryPendingChoice | null;
  pendingBattle: StoryBattleRequest | null;
  lastPlayedAt?: string;
};

export type SerializedStoryState = StoryState;
