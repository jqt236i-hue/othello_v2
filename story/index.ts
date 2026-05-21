// Public entry point for story mode. Keep external integrations routed through this file.
export type {
  StoryInitialBoardCell,
  StoryInitialBoardSetup,
  StoryBattleBoardSize,
  StoryBattleDeckSource,
  StoryBattleRequest,
  StoryBattleResult,
  StoryBattleStage,
  StoryChapter,
  StoryCommand,
  StoryDeckPreset,
  StoryNode,
  StoryScenario,
  StorySide
} from './core/story-schema';

export type {
  StoryBoardCodeDecodeResult,
  StoryBoardCodeValidationIssue,
  StoryBoardCodeValidationSeverity,
} from './core/story-board-codec';

export {
  decodeStoryBoardCode,
  encodeStoryBoardCode,
  safeDecodeStoryBoardCode,
  validateStoryInitialBoardSetup
} from './core/story-board-codec';

export type {
  SerializedStoryState,
  StoryBacklogEntry,
  StoryPendingChoice,
  StoryState
} from './core/story-state';

export {
  validateBattleStage,
  validateStoryScenario
} from './core/story-validator';

export type {
  StoryValidatorBoardCodeResult,
  StoryValidationIssue,
  StoryValidatorAssets,
  StoryValidatorDeckCodeResult,
  StoryValidatorOptions,
  StoryValidatorSeverity
} from './core/story-validator';

export { storyAssets } from './content/story-assets';
export type { StoryAssetRegistry } from './content/story-assets';
export { storyBattleStages } from './content/story-battle-stages';
export { validateStoryBoardCode } from './content/story-board-code-validator';
export { validateStoryDeckCode } from './content/story-deck-code-validator';
export { storyDeckPresets } from './content/story-deck-presets';
export { prologueStory } from './content/chapters/prologue.story';
export type {
  StoryEffectOverlayKind,
  StoryEffectPreset,
  StoryEffectPresetValidationIssue,
  StoryEffectStep,
  StoryEffectTextMotion
} from './effects/story-effect-schema';
export {
  getStoryEffectPreset,
  storyEffectPresets,
  validateStoryEffectPresets
} from './effects/story-effect-presets';
