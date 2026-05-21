import type { StoryBattleStage } from '../core/story-schema';

export const storyBattleStages = {
  prologue_short_battle: {
    id: 'prologue_short_battle',
    title: 'プロローグ短期戦',
    boardSize: { rows: 6, cols: 6 },
    protagonistSide: 'black',
    enemySide: 'white',
    protagonistDeck: { type: 'deckPreset', presetId: 'protagonist_trial' },
    enemyDeck: { type: 'deckPreset', presetId: 'rival_trial' },
    enemyAiPresetId: 'story_easy',
    allowCustomDeck: false,
    notes: '6x6 の story battle stage 検証用。初期配置と CPU は既存対局初期化経路に任せる。'
  },
  prologue_standard_battle: {
    id: 'prologue_standard_battle',
    title: 'プロローグ標準戦',
    boardSize: { rows: 8, cols: 8 },
    protagonistSide: 'black',
    enemySide: 'white',
    protagonistDeck: { type: 'currentPlayerDeck', fallback: 'default' },
    enemyDeck: { type: 'deckPreset', presetId: 'rival_trial' },
    enemyAiPresetId: 'story_easy',
    allowCustomDeck: false,
    notes: '8x8 の story battle stage 検証用。'
  }
} as const satisfies Record<string, StoryBattleStage>;
