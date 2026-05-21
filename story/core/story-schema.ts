export type StoryId = string;
export type StoryChapterId = string;
export type StoryNodeId = string;
export type StoryLineId = string;
export type StoryAssetId = string;
export type StoryFlagKey = string;
export type StoryUnlockId = string;
export type StoryBattleStageId = string;
export type StorySide = 'black' | 'white';

export type StoryFlagValue = boolean | number | string;

export type StoryTransition = 'cut' | 'fade';
export type StoryCharacterSlot = 'left' | 'center' | 'right';
export type StoryCharacterEnter = 'cut' | 'fade' | 'slide';
export type StoryBgmAction = 'play' | 'stop' | 'crossfade';

export type StoryChoiceOption = {
  label: string;
  jump: StoryNodeId;
  setFlag?: StoryFlagKey;
};

export type StoryCommand =
  | { type: 'say'; speaker: string; text: string; lineId?: StoryLineId }
  | { type: 'bg'; id: StoryAssetId; transition?: StoryTransition }
  | { type: 'char'; id: StoryAssetId; pose: string; slot: StoryCharacterSlot; enter?: StoryCharacterEnter }
  | { type: 'hideChar'; slot: StoryCharacterSlot; transition?: StoryTransition }
  | { type: 'bgm'; id: StoryAssetId; action?: StoryBgmAction }
  | { type: 'se'; id: StoryAssetId }
  | { type: 'choice'; choices: StoryChoiceOption[] }
  | { type: 'jump'; target: StoryNodeId }
  | { type: 'setFlag'; key: StoryFlagKey; value: StoryFlagValue }
  | { type: 'battle'; stageId: StoryBattleStageId; winJump: StoryNodeId; loseJump?: StoryNodeId; drawJump?: StoryNodeId }
  | { type: 'unlock'; id: StoryUnlockId }
  | { type: 'wait'; ms: number }
  | { type: 'effect'; id: string; params?: Record<string, unknown> };

export type StoryNode = {
  id: StoryNodeId;
  commands: StoryCommand[];
  next?: StoryNodeId;
};

export type StoryChapter = {
  id: StoryChapterId;
  title?: string;
  nodes: StoryNode[];
  initialNodeId?: StoryNodeId;
};

export type StoryScenario = {
  id: StoryId;
  title?: string;
  chapters: StoryChapter[];
  initialChapterId?: StoryChapterId;
};

export type StoryBattleBoardSize = {
  rows: 6 | 8;
  cols: 6 | 8;
};

export type StoryInitialBoardCell = 'black' | 'white' | null;

export type StoryInitialBoardSetup = {
  rows: 6 | 8;
  cols: 6 | 8;
  cells: StoryInitialBoardCell[][];
  currentPlayer: StorySide;
};

export type StoryBattleDeckSource =
  | { type: 'default' }
  | { type: 'currentPlayerDeck'; fallback?: 'default' | 'error' }
  | { type: 'deckPreset'; presetId: string }
  | { type: 'deckCode'; deckCode: string };

export type StoryBattleStage = {
  id: StoryBattleStageId;
  title?: string;
  boardSize: StoryBattleBoardSize;
  initialBoardCode?: string;
  protagonistSide?: StorySide;
  enemySide?: StorySide;
  protagonistDeck?: StoryBattleDeckSource;
  enemyDeck?: StoryBattleDeckSource;
  enemyAiPresetId?: string;
  allowCustomDeck?: boolean;
  scripted?: boolean;
  notes?: string;
};

export type StoryBattleOutcome = 'win' | 'lose' | 'draw';

export type StoryBattleRequest = {
  scenarioId: StoryId;
  chapterId: StoryChapterId;
  nodeId: StoryNodeId;
  commandIndex: number;
  stageId: StoryBattleStageId;
  winJump: StoryNodeId;
  loseJump?: StoryNodeId;
  drawJump?: StoryNodeId;
};

export type StoryBattleResult = {
  stageId: StoryBattleStageId;
  outcome: StoryBattleOutcome;
};

export type StoryDeckPreset = {
  id: string;
  title?: string;
  deckCode: string;
  notes?: string;
};
