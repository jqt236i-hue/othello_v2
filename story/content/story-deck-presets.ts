import type { StoryDeckPreset } from '../core/story-schema';

export const storyDeckPresets = {
  protagonist_trial: {
    id: 'protagonist_trial',
    title: '主人公プロローグデッキ',
    deckCode:
      'D1C1:chest_01.hard_01.swap_01.position_swap_01.perma_01.strong_wind_01.super_buoyancy_01.super_gravity_01.tempt_01.capture_01.regen_01.udr_01.seed_01.teleport_01.hyperactive_01.will_hunter_king_01.loss_will_01.gold_stone.silver_stone.extend_life_01.guard_01.destroy_dragon_01.lightning_01.udg_01.ultimate_hyperactive_01.board_expand_01.board_shrink_01.blockade_01.observer_01.reinforcement_01',
    notes: 'プロローグ検証用。正式なカード構成は素材・シナリオ確定後に差し替える。'
  },
  rival_trial: {
    id: 'rival_trial',
    title: 'ライバルプロローグデッキ',
    deckCode:
      'D1C1:reinforcement_01.observer_01.blockade_01.board_shrink_01.board_expand_01.ultimate_hyperactive_01.udg_01.lightning_01.destroy_dragon_01.guard_01.extend_life_01.silver_stone.gold_stone.loss_will_01.will_hunter_king_01.hyperactive_01.teleport_01.seed_01.udr_01.regen_01.capture_01.tempt_01.super_gravity_01.super_buoyancy_01.strong_wind_01.perma_01.position_swap_01.swap_01.hard_01.chest_01',
    notes: '敵CPU検証用。既存 deckCode 経路の流用確認に使う。'
  }
} as const satisfies Record<string, StoryDeckPreset>;
