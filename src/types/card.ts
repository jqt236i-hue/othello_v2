/**
 * Card-related type definitions
 */

import { PlayerKey } from './player';
import { CellPosition } from './board';

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  desc: string;
  display_type_ja?: string;
  enabled?: boolean;
}

export type CardType = 
  | 'TREASURE_BOX'
  | 'FREE_PLACEMENT'
  | 'LAST_RESORT'
  | 'SNIPER_WILL'
  | 'PROTECTED_NEXT_STONE'
  | 'GHOST_WILL'
  | 'AFTERIMAGE_WILL'
  | 'SWAP_WITH_ENEMY'
  | 'POSITION_SWAP_WILL'
  | 'PERMA_PROTECT_NEXT_STONE'
  | 'STRONG_WIND_WILL'
  | 'BUOYANCY_WILL'
  | 'SUPER_BUOYANCY_WILL'
  | 'GRAVITY_WILL'
  | 'SUPER_GRAVITY_WILL'
  | 'TRAP_WILL'
  | 'TEMPT_WILL'
  | 'CAPTURE_WILL'
  | 'DOUBLE_CHAIN_WILL'
  | 'TRIPLE_CHAIN_WILL'
  | 'QUAD_CHAIN_WILL'
  | 'INFINITE_CHAIN_WILL'
  | 'TABOO_REVERSE_WILL'
  | 'REGEN_WILL'
  | 'DESTROY_ONE_STONE'
  | 'TIME_BOMB'
  | 'TIME_STOP_GOD'
  | 'ULTIMATE_REVERSE_DRAGON'
  | 'BREEDING_WILL'
  | 'PROLIFERATION_WILL'
  | 'CLONE_WILL'
  | 'TELEPORT_WILL'
  | 'CELL_TELEPORT_WILL'
  | 'CROSS_BOMB'
  | 'X_BOMB'
  | 'HYPERACTIVE_WILL'
  | 'HYPERACTIVE_INHERIT_WILL'
  | 'EXTREME_HYPERACTIVE_WILL'
  | 'ESCAPE_WILL'
  | 'ROBOT_VACUUM_WILL'
  | 'GLUTTONOUS_WILL'
  | 'WILL_HUNTER_KING'
  | 'INSTANT_HYPERACTIVE_WILL'
  | 'REBUILD_WILL'
  | 'SUPPLY_WILL'
  | 'PLUNDER_WILL'
  | 'CORNER_TRIBUTE'
  | 'WORK_WILL'
  | 'RIBO_WILL'
  | 'LOSS_WILL'
  | 'DOUBLE_PLACE'
  | 'TRIPLE_PLACE'
  | 'QUAD_PLACE'
  | 'INFINITE_PLACE'
  | 'HEAVEN_BLESSING'
  | 'REVEAL_HAND_WILL'
  | 'CONDEMN_WILL'
  | 'EXECUTION_WILL'
  | 'GOLD_STONE'
  | 'RAINBOW_STONE'
  | 'SILVER_STONE'
  | 'CRYSTAL_STONE'
  | 'EXTEND_LIFE_WILL'
  | 'EXTEND_LIFE_GOD'
  | 'CORROSION_WILL'
  | 'GUARD_WILL'
  | 'GUARDIAN_GOD'
  | 'LIVING_WILL'
  | 'DESTROY_DRAGON_WILL'
  | 'LIGHTNING_WILL'
  | 'ULTIMATE_DESTROY_GOD'
  | 'ULTIMATE_HYPERACTIVE_GOD'
  | 'BOARD_EXPANSION_WILL'
  | 'BOARD_EXPANSION_GOD'
  | 'BOARD_SHRINK_WILL'
  | 'BOARD_SHRINK_GOD'
  | 'BLOCKADE_WILL'
  | 'METEOR_WILL'
  | 'FREEZE_WILL'
  | 'SEED_WILL'
  | 'OBSERVER_WILL'
  | 'SALVATION_WILL'
  | 'STONE_SALVATION_GOD'
  | 'REINFORCEMENT_WILL'
  | 'EQUALITY_WILL'
  | 'FATE_WILL';

export interface CardState {
  hands: Record<PlayerKey, string[]>;
  decks: Record<PlayerKey, string[]>;
  discards: string[];
  selectedCardId: string | null;
  selectedCardOwnerKey: PlayerKey | null;
  pendingEffects: PendingEffect[];
  markers: Marker[];
  charges: Record<PlayerKey, number>;
  // ... other fields
}

export interface PendingEffect {
  type: CardType;
  player: PlayerKey;
  stage: string | null;
  targets?: CellPosition[];
  offers?: string[];
}

export interface Marker {
  row: number;
  col: number;
  type: string;
  owner: PlayerKey;
  data?: Record<string, unknown>;
}

export interface CardEffectResult {
  applied: boolean;
  reason?: string;
  [key: string]: unknown;
}
