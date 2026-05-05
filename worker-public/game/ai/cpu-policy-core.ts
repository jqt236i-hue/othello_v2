declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

import type { CardState, GameState, PlayerKey } from '../../src/types';

/**
 * @file cpu-policy-core.js
 * @description Pure CPU policy helpers (no UI/DOM/global side effects).
 */

const SharedBoardUtils: any = _require('../../shared/shared-board-utils');
const OthelloCore: any = _require('../../shared/othello-core');
const SharedCardHeuristics: any = _require('../../shared/shared-card-heuristics');
const THROW_CHAIN_CARD_TYPES = Object.freeze(['DOUBLE_PLACE', 'TRIPLE_PLACE', 'QUAD_PLACE', 'INFINITE_PLACE']);
const CHAIN_WILL_CARD_TYPES = Object.freeze(['DOUBLE_CHAIN_WILL', 'TRIPLE_CHAIN_WILL', 'QUAD_CHAIN_WILL', 'INFINITE_CHAIN_WILL']);

const DEFENSIVE_CARD_TYPES = new Set([
    'PROTECTED_NEXT_STONE',
    'AFTERIMAGE_WILL',
    'GHOST_WILL',
    'PERMA_PROTECT_NEXT_STONE',
    'GUARD_WILL',
    'GUARDIAN_GOD',
    'REGEN_WILL',
    'PLUNDER_WILL',
    'HEAVEN_BLESSING',
    'REVEAL_HAND_WILL',
    'CONDEMN_WILL',
    'TRAP_WILL',
    'EXTEND_LIFE_WILL',
    'EXTEND_LIFE_GOD',
    'SNIPER_WILL',
    'LIGHTNING_WILL',
    'SALVATION_WILL',
    'REINFORCEMENT_WILL',
    'LIVING_WILL'
]);

const HIGH_VARIANCE_CARD_TYPES = new Set([
    'ULTIMATE_REVERSE_DRAGON',
    'ULTIMATE_DESTROY_GOD',
    'ULTIMATE_HYPERACTIVE_GOD',
    ...THROW_CHAIN_CARD_TYPES,
    ...CHAIN_WILL_CARD_TYPES,
    'TEMPT_WILL',
    'CAPTURE_WILL',
    'POSITION_SWAP_WILL',
    'SWAP_WITH_ENEMY',
    'TIME_BOMB',
    'TIME_STOP_GOD',
    'CROSS_BOMB',
    'X_BOMB',
    'BREEDING_WILL',
    'STRONG_WIND_WILL',
    'TABOO_REVERSE_WILL',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'REINFORCEMENT_WILL',
    'SNIPER_WILL',
    'HYPERACTIVE_WILL',
    'ESCAPE_WILL',
    'INSTANT_HYPERACTIVE_WILL',
    'EXTREME_HYPERACTIVE_WILL',
    'CLONE_WILL',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'METEOR_WILL',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'RIBO_WILL',
    'LOSS_WILL',
    'CORROSION_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL',
    'CORNER_TRIBUTE',
    'WILL_HUNTER_KING',
    'SEED_WILL'
]);

const CORNER_RECOVERY_CARD_TYPES = (SharedCardHeuristics && typeof SharedCardHeuristics.createExtendedTypeSet === 'function')
    ? SharedCardHeuristics.createExtendedTypeSet(
        SharedCardHeuristics.DEFAULT_CORNER_RECOVERY_CARD_TYPES,
        [
            'CELL_TELEPORT_WILL',
            'FREE_PLACEMENT',
            'LAST_RESORT',
            'DESTROY_DRAGON_WILL',
            'LOSS_WILL',
            'SUPER_BUOYANCY_WILL',
            'SUPER_GRAVITY_WILL',
            'CORNER_TRIBUTE'
        ]
    )
    : new Set([
        'DESTROY_ONE_STONE',
        'SWAP_WITH_ENEMY',
        'POSITION_SWAP_WILL',
        'STRONG_WIND_WILL',
        'TEMPT_WILL',
        'CAPTURE_WILL',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_REVERSE_DRAGON',
        'METEOR_WILL',
        'BOARD_SHRINK_WILL',
        'BOARD_SHRINK_GOD',
        'CELL_TELEPORT_WILL',
        'TABOO_REVERSE_WILL',
        'FREE_PLACEMENT',
        'LAST_RESORT',
        'DESTROY_DRAGON_WILL',
        'LOSS_WILL',
        'SUPER_BUOYANCY_WILL',
        'SUPER_GRAVITY_WILL',
        'CORNER_TRIBUTE'
    ]);

const CORNER_HOLD_CARD_TYPES = (SharedCardHeuristics && typeof SharedCardHeuristics.createExtendedTypeSet === 'function')
    ? SharedCardHeuristics.createExtendedTypeSet(
        SharedCardHeuristics.DEFAULT_CORNER_HOLD_CARD_TYPES,
        [
            'AFTERIMAGE_WILL',
            'GHOST_WILL',
            'TRAP_WILL',
            'SNIPER_WILL',
            'LIGHTNING_WILL',
            'DESTROY_DRAGON_WILL',
            'WILL_HUNTER_KING'
        ]
    )
    : new Set([
        'PROTECTED_NEXT_STONE',
        'GHOST_WILL',
        'PERMA_PROTECT_NEXT_STONE',
        'GUARD_WILL',
        'GUARDIAN_GOD',
        'REGEN_WILL',
        'BLOCKADE_WILL',
        'TRAP_WILL',
        'SNIPER_WILL',
        'LIGHTNING_WILL',
        'DESTROY_DRAGON_WILL',
        'WILL_HUNTER_KING'
    ]);

const CHARGE_RAMP_CARD_TYPES = (SharedCardHeuristics && typeof SharedCardHeuristics.createExtendedTypeSet === 'function')
    ? SharedCardHeuristics.createExtendedTypeSet(
        SharedCardHeuristics.DEFAULT_CHARGE_RAMP_CARD_TYPES,
        [
            'CORNER_TRIBUTE',
            'RIBO_WILL',
            'OBSERVER_WILL'
        ]
    )
    : new Set([
        'TREASURE_BOX',
        'GOLD_STONE',
        'RAINBOW_STONE',
        'SILVER_STONE',
        'CRYSTAL_STONE',
        'PLUNDER_WILL',
        'CORNER_TRIBUTE',
        'WORK_WILL',
    'RIBO_WILL',
    'EXTREME_HYPERACTIVE_WILL'
]);

const REBUILD_KEEP_PRIORITY_CARD_TYPES = new Set([
    'PROTECTED_NEXT_STONE',
    'AFTERIMAGE_WILL',
    'GHOST_WILL',
    'PERMA_PROTECT_NEXT_STONE',
    'GUARD_WILL',
    'GUARDIAN_GOD',
    'REGEN_WILL',
    'BLOCKADE_WILL',
    'EXTEND_LIFE_WILL',
    'EXTEND_LIFE_GOD',
    'DESTROY_ONE_STONE',
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'STRONG_WIND_WILL',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'HEAVEN_BLESSING',
    'CONDEMN_WILL'
]);

const STABILITY_CARD_TYPES = new Set([
    'PROTECTED_NEXT_STONE',
    'AFTERIMAGE_WILL',
    'GHOST_WILL',
    'PERMA_PROTECT_NEXT_STONE',
    'GUARD_WILL',
    'GUARDIAN_GOD',
    'REGEN_WILL',
    'BLOCKADE_WILL',
    'TRAP_WILL',
    'EXTEND_LIFE_WILL',
    'EXTEND_LIFE_GOD',
    'HEAVEN_BLESSING',
    'SNIPER_WILL',
    'LIGHTNING_WILL',
    'WORK_WILL',
    'LIVING_WILL',
    'OBSERVER_WILL',
    'DESTROY_DRAGON_WILL',
    'WILL_HUNTER_KING'
]);

const SWING_CARD_TYPES = new Set([
    'DESTROY_ONE_STONE',
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'STRONG_WIND_WILL',
    'TEMPT_WILL',
    'CAPTURE_WILL',
    'ULTIMATE_DESTROY_GOD',
    'ULTIMATE_REVERSE_DRAGON',
    'TIME_BOMB',
    'CROSS_BOMB',
    'X_BOMB',
    'TABOO_REVERSE_WILL',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'REINFORCEMENT_WILL',
    'METEOR_WILL',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'CLONE_WILL',
    ...CHAIN_WILL_CARD_TYPES,
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'EXTREME_HYPERACTIVE_WILL',
    'LOSS_WILL',
    'CORROSION_WILL',
    'DESTROY_DRAGON_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL',
    'CORNER_TRIBUTE'
]);

const EDGE_CONTEST_CARD_TYPES = new Set([
    'DESTROY_ONE_STONE',
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'STRONG_WIND_WILL',
    'TEMPT_WILL',
    'CAPTURE_WILL',
    'TABOO_REVERSE_WILL',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'METEOR_WILL',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'CLONE_WILL',
    'SNIPER_WILL',
    'BLOCKADE_WILL',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'EXTREME_HYPERACTIVE_WILL',
    'DESTROY_DRAGON_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL'
]);

const LONG_HORIZON_CARD_TYPES = new Set([
    'WORK_WILL',
    'SNIPER_WILL',
    'LIGHTNING_WILL',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'BREEDING_WILL',
    'SEED_WILL',
    'ULTIMATE_DESTROY_GOD',
    'ULTIMATE_REVERSE_DRAGON',
    'ULTIMATE_HYPERACTIVE_GOD',
    'TIME_STOP_GOD',
    'OBSERVER_WILL',
    'RIBO_WILL',
    'ROBOT_VACUUM_WILL',
    'DESTROY_DRAGON_WILL',
    'EXTREME_HYPERACTIVE_WILL',
    'GLUTTONOUS_WILL',
    'WILL_HUNTER_KING'
]);

const WHITE_LV6_CORNER_SWING_KEEP_TYPES = new Set([
    'SWAP_WITH_ENEMY',
    'POSITION_SWAP_WILL',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'TELEPORT_WILL',
    'CELL_TELEPORT_WILL',
    'FREE_PLACEMENT',
    'LAST_RESORT',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL'
]);

const WHITE_LV6_FAST_ROTATE_TYPES = new Set([
    ...CHAIN_WILL_CARD_TYPES,
    'DOUBLE_PLACE',
    'BREEDING_WILL',
    'CLONE_WILL',
    'ESCAPE_WILL',
    'RIBO_WILL',
    'ROBOT_VACUUM_WILL'
]);

const WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES = new Set([
    'TIME_BOMB',
    'TIME_STOP_GOD',
    'LAST_RESORT',
    'DOUBLE_PLACE',
    'TRIPLE_PLACE',
    'QUAD_PLACE',
    'INFINITE_PLACE',
    ...CHAIN_WILL_CARD_TYPES,
    'CROSS_BOMB',
    'X_BOMB',
    'HYPERACTIVE_WILL',
    'INSTANT_HYPERACTIVE_WILL',
    'ULTIMATE_HYPERACTIVE_GOD',
    'ULTIMATE_REVERSE_DRAGON',
    'TABOO_REVERSE_WILL',
    'METEOR_WILL',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'CELL_TELEPORT_WILL',
    'GLUTTONOUS_WILL',
    'TREASURE_BOX',
    'SUPPLY_WILL',
    'LOSS_WILL',
    'CORROSION_WILL',
    'BOARD_EXPANSION_WILL',
    'BOARD_EXPANSION_GOD',
    'BREEDING_WILL',
    'CLONE_WILL',
    'ESCAPE_WILL',
    'RIBO_WILL',
    'ROBOT_VACUUM_WILL',
    'EXTREME_HYPERACTIVE_WILL'
]);

const IMMEDIATE_DESTROY_CARD_TYPES = new Set([
    'TIME_STOP_GOD',
    'CELL_TELEPORT_WILL',
    'FREEZE_WILL'
]);

const LOW_CHARGE_DESTROY_CARD_TYPES = new Set([
    'ESCAPE_WILL',
    'BOARD_EXPANSION_GOD',
    'SUPPLY_WILL',
    'REVEAL_HAND_WILL',
    'FATE_WILL'
]);

const CONDITION_DEPENDENT_DESTROY_CARD_TYPES = new Set([
    'RIBO_WILL',
    'LAST_RESORT',
    'REINFORCEMENT_WILL',
    'CORROSION_WILL',
    'SALVATION_WILL',
    'CORNER_TRIBUTE'
]);

const LOW_CHARGE_DESTROY_MAX_CHARGE = 50;

// Explicit per-card baseline bias so every catalog card type is scored intentionally.
// Positive: generally usable/safer. Negative: volatile or high opportunity cost.
const CARD_TYPE_BASE_SCORE_BONUS: Readonly<Record<string, number>> = Object.freeze({
    BLOCKADE_WILL: 8,
    BOARD_EXPANSION_GOD: -3,
    BOARD_EXPANSION_WILL: -2,
    BOARD_SHRINK_WILL: -3,
    BOARD_SHRINK_GOD: -6,
    BREEDING_WILL: 0,
    DOUBLE_CHAIN_WILL: 4,
    TRIPLE_CHAIN_WILL: 6,
    QUAD_CHAIN_WILL: 8,
    INFINITE_CHAIN_WILL: 6,
    CLONE_WILL: -1,
    CELL_TELEPORT_WILL: -4,
    CONDEMN_WILL: 4,
    REVEAL_HAND_WILL: 2,
    CORROSION_WILL: 4,
    CROSS_BOMB: -2,
    DESTROY_DRAGON_WILL: 7,
    DESTROY_ONE_STONE: 5,
    DOUBLE_PLACE: 8,
    TRIPLE_PLACE: 10,
    QUAD_PLACE: 12,
    INFINITE_PLACE: 6,
    ESCAPE_WILL: -1,
    EXTEND_LIFE_WILL: 8,
    EXTEND_LIFE_GOD: 10,
    EXTREME_HYPERACTIVE_WILL: -8,
    REINFORCEMENT_WILL: 5,
    FATE_WILL: 2,
    FREE_PLACEMENT: 2,
    FREEZE_WILL: -4,
    GLUTTONOUS_WILL: 3,
    GOLD_STONE: 12,
    CRYSTAL_STONE: 10,
    RAINBOW_STONE: 16,
    GUARD_WILL: 12,
    GUARDIAN_GOD: 14,
    AFTERIMAGE_WILL: 12,
    GHOST_WILL: 11,
    HEAVEN_BLESSING: 6,
    HYPERACTIVE_WILL: 0,
    INSTANT_HYPERACTIVE_WILL: 1,
    LAST_RESORT: 8,
    LIGHTNING_WILL: 3,
    LIVING_WILL: 8,
    LOSS_WILL: -2,
    METEOR_WILL: -3,
    OBSERVER_WILL: 8,
    PERMA_PROTECT_NEXT_STONE: 12,
    PLUNDER_WILL: 8,
    CORNER_TRIBUTE: 6,
    POSITION_SWAP_WILL: 6,
    PROLIFERATION_WILL: 1,
    PROTECTED_NEXT_STONE: 10,
    REBUILD_WILL: 0,
    REGEN_WILL: 9,
    RIBO_WILL: 4,
    ROBOT_VACUUM_WILL: 4,
    SALVATION_WILL: 8,
    SEED_WILL: 2,
    SUPPLY_WILL: 8,
    SILVER_STONE: 10,
    SNIPER_WILL: 4,
    STRONG_WIND_WILL: 6,
    SUPER_BUOYANCY_WILL: -3,
    SUPER_GRAVITY_WILL: -3,
    SWAP_WITH_ENEMY: 7,
    TABOO_REVERSE_WILL: 1,
    TELEPORT_WILL: -1,
    TEMPT_WILL: 5,
    CAPTURE_WILL: 5,
    TIME_BOMB: -2,
    TIME_STOP_GOD: -4,
    TRAP_WILL: 2,
    TREASURE_BOX: 14,
    ULTIMATE_DESTROY_GOD: 3,
    ULTIMATE_HYPERACTIVE_GOD: -6,
    ULTIMATE_REVERSE_DRAGON: 1,
    WILL_HUNTER_KING: 4,
    WORK_WILL: 4,
    X_BOMB: -2
});

// Keep an explicit list so newly added cards cannot silently bypass CPU usage tuning.
const ALL_CARD_TYPES_FOR_USAGE_STYLE = Object.freeze([
    'BLOCKADE_WILL',
    'BOARD_EXPANSION_GOD',
    'BOARD_EXPANSION_WILL',
    'BOARD_SHRINK_WILL',
    'BOARD_SHRINK_GOD',
    'BREEDING_WILL',
    'DOUBLE_CHAIN_WILL',
    'TRIPLE_CHAIN_WILL',
    'QUAD_CHAIN_WILL',
    'INFINITE_CHAIN_WILL',
    'CELL_TELEPORT_WILL',
    'CLONE_WILL',
    'CONDEMN_WILL',
    'REVEAL_HAND_WILL',
    'CORNER_TRIBUTE',
    'CORROSION_WILL',
    'CROSS_BOMB',
    'DESTROY_DRAGON_WILL',
    'DESTROY_ONE_STONE',
    'DOUBLE_PLACE',
    'TRIPLE_PLACE',
    'QUAD_PLACE',
    'INFINITE_PLACE',
    'ESCAPE_WILL',
    'EXTEND_LIFE_WILL',
    'EXTEND_LIFE_GOD',
    'EXTREME_HYPERACTIVE_WILL',
    'REINFORCEMENT_WILL',
    'FATE_WILL',
    'FREE_PLACEMENT',
    'FREEZE_WILL',
    'GLUTTONOUS_WILL',
    'GOLD_STONE',
    'CRYSTAL_STONE',
    'RAINBOW_STONE',
    'GUARDIAN_GOD',
    'GUARD_WILL',
    'AFTERIMAGE_WILL',
    'GHOST_WILL',
    'HEAVEN_BLESSING',
    'HYPERACTIVE_WILL',
    'INSTANT_HYPERACTIVE_WILL',
    'LAST_RESORT',
    'LIGHTNING_WILL',
    'LIVING_WILL',
    'LOSS_WILL',
    'METEOR_WILL',
    'OBSERVER_WILL',
    'PERMA_PROTECT_NEXT_STONE',
    'PLUNDER_WILL',
    'POSITION_SWAP_WILL',
    'PROLIFERATION_WILL',
    'PROTECTED_NEXT_STONE',
    'REBUILD_WILL',
    'REGEN_WILL',
    'RIBO_WILL',
    'ROBOT_VACUUM_WILL',
    'SALVATION_WILL',
    'SEED_WILL',
    'SUPPLY_WILL',
    'SILVER_STONE',
    'SNIPER_WILL',
    'STRONG_WIND_WILL',
    'SUPER_BUOYANCY_WILL',
    'SUPER_GRAVITY_WILL',
    'SWAP_WITH_ENEMY',
    'TABOO_REVERSE_WILL',
    'TELEPORT_WILL',
    'TEMPT_WILL',
    'CAPTURE_WILL',
    'TIME_BOMB',
    'TIME_STOP_GOD',
    'TRAP_WILL',
    'TREASURE_BOX',
    'ULTIMATE_DESTROY_GOD',
    'ULTIMATE_HYPERACTIVE_GOD',
    'ULTIMATE_REVERSE_DRAGON',
    'WILL_HUNTER_KING',
    'WORK_WILL',
    'X_BOMB'
]);

// Per-card deltas layered on top of the broad role groups above so all active card
// types can be tuned explicitly without duplicating the whole group matrix.
const CARD_TYPE_USAGE_STYLE_OVERRIDES: Readonly<Record<string, Record<string, number>>> = Object.freeze({
    BLOCKADE_WILL: { lowMobilityBias: 4, endgameBias: 4, cornerNowBias: -2 },
    BOARD_EXPANSION_GOD: { trailingBias: 6, handPressureBias: 6, cornerNowBias: -6 },
    BOARD_EXPANSION_WILL: { trailingBias: 4, handPressureBias: 4, cornerNowBias: -6 },
    BOARD_SHRINK_WILL: { cornerEmergencyBias: 6, trailingBias: 6, leadBias: -4, handPressureBias: 2 },
    BOARD_SHRINK_GOD: { cornerEmergencyBias: 8, trailingBias: 8, leadBias: -6, handPressureBias: 4 },
    BREEDING_WILL: { openingBias: 6, midLateBias: 4, endgameBias: -6, handPressureBias: 3 },
    DOUBLE_CHAIN_WILL: { trailingBias: 6, lowMobilityBias: 6, leadBias: -4, cornerNowBias: -4 },
    TRIPLE_CHAIN_WILL: { trailingBias: 8, lowMobilityBias: 8, leadBias: -6, cornerNowBias: -6 },
    QUAD_CHAIN_WILL: { trailingBias: 10, lowMobilityBias: 10, leadBias: -8, cornerNowBias: -8, handPressureBias: 2 },
    INFINITE_CHAIN_WILL: { trailingBias: 12, lowMobilityBias: 12, leadBias: -10, cornerNowBias: -10, handPressureBias: 4, endgameBias: 2 },
    CLONE_WILL: { midLateBias: 4, cornerNowBias: 4, endgameBias: -4 },
    CONDEMN_WILL: { trailingBias: 2, handPressureBias: 4, cornerNowBias: -2 },
    REVEAL_HAND_WILL: { openingBias: 4, midLateBias: 4, endgameBias: -10, handPressureBias: 2, trailingBias: 2, cornerNowBias: -2 },
    CORNER_TRIBUTE: { trailingBias: 8, cornerEmergencyBias: 8, leadBias: -6, handPressureBias: 2 },
    CORROSION_WILL: { midLateBias: 2, handPressureBias: 2, endgameBias: -2 },
    CROSS_BOMB: { cornerEmergencyBias: 4, endgameBias: -6 },
    DESTROY_DRAGON_WILL: { cornerNowBias: 6, edgeEmergencyBias: 4, midLateBias: 2 },
    DESTROY_ONE_STONE: { cornerEmergencyBias: 4, lowMobilityBias: 4, cornerNowBias: -2 },
    DOUBLE_PLACE: { trailingBias: 6, handPressureBias: 4, cornerNowBias: -6, endgameBias: -4 },
    TRIPLE_PLACE: { trailingBias: 8, handPressureBias: 6, cornerNowBias: -8, endgameBias: -2 },
    QUAD_PLACE: { trailingBias: 10, handPressureBias: 8, cornerNowBias: -10, endgameBias: 0 },
    INFINITE_PLACE: { trailingBias: 12, handPressureBias: 6, cornerNowBias: -12, endgameBias: 2, lowMobilityBias: 8 },
    REINFORCEMENT_WILL: { trailingBias: 6, lowMobilityBias: 3, cornerNowBias: -6, handPressureBias: 2, endgameBias: -4 },
    FATE_WILL: { leadBias: -6, trailingBias: 8, midLateBias: 4, endgameBias: -8, lowMobilityBias: 4, handPressureBias: 2, cornerNowBias: -4 },
    ESCAPE_WILL: { trailingBias: 4, edgeEmergencyBias: 4, handPressureBias: 2 },
    EXTEND_LIFE_WILL: { midLateBias: 4, leadBias: 4, endgameBias: -4 },
    EXTEND_LIFE_GOD: { midLateBias: 6, leadBias: 6, endgameBias: -6 },
    EXTREME_HYPERACTIVE_WILL: { trailingBias: 8, leadBias: -6, cornerEmergencyBias: 4 },
    FREE_PLACEMENT: { cornerEmergencyBias: 6, lowMobilityBias: 6, cornerNowBias: -10 },
    FREEZE_WILL: { leadBias: 4, cornerNowBias: 2, edgeEmergencyBias: 2, endgameBias: -2 },
    GLUTTONOUS_WILL: { trailingBias: 4, cornerNowBias: 4, leadBias: -4 },
    GOLD_STONE: { openingBias: 4, handPressureBias: 2, cornerNowBias: 2 },
    CRYSTAL_STONE: { openingBias: 4, handPressureBias: 2, cornerNowBias: 1 },
    RAINBOW_STONE: { openingBias: 6, handPressureBias: 4, cornerNowBias: 4 },
    GUARDIAN_GOD: { leadBias: 4, cornerNowBias: 4, cornerEmergencyBias: 2 },
    GUARD_WILL: { leadBias: 4, cornerNowBias: 4 },
    AFTERIMAGE_WILL: { leadBias: 4, cornerNowBias: 4, edgeEmergencyBias: 2 },
    GHOST_WILL: { leadBias: 4, cornerNowBias: 4, edgeEmergencyBias: 2 },
    HEAVEN_BLESSING: { openingBias: 4, handPressureBias: -4, endgameBias: -6 },
    HYPERACTIVE_WILL: { trailingBias: 4, leadBias: -4, cornerEmergencyBias: 4 },
    INSTANT_HYPERACTIVE_WILL: { trailingBias: 6, leadBias: -6, cornerEmergencyBias: 4 },
    LAST_RESORT: { cornerEmergencyBias: 8, lowMobilityBias: 8, cornerNowBias: -8 },
    LIGHTNING_WILL: { cornerNowBias: 6, edgeEmergencyBias: 2, endgameBias: -6 },
    LIVING_WILL: { leadBias: 4, openingBias: 4, midLateBias: 2, endgameBias: -4, cornerNowBias: 2 },
    LOSS_WILL: { trailingBias: 4, midLateBias: 2, handPressureBias: 2 },
    METEOR_WILL: { cornerEmergencyBias: 6, trailingBias: 6, leadBias: -4 },
    OBSERVER_WILL: { openingBias: 6, midLateBias: 4, endgameBias: -4 },
    PERMA_PROTECT_NEXT_STONE: { leadBias: 4, cornerNowBias: 4 },
    PLUNDER_WILL: { openingBias: 2, handPressureBias: 4, endgameBias: -4 },
    POSITION_SWAP_WILL: { trailingBias: 6, edgeEmergencyBias: 4, cornerNowBias: -4 },
    PROLIFERATION_WILL: { openingBias: 6, midLateBias: 4, endgameBias: -6, handPressureBias: 2 },
    PROTECTED_NEXT_STONE: { leadBias: 4, cornerNowBias: 4 },
    REBUILD_WILL: { handPressureBias: 8, openingBias: 2, endgameBias: -4 },
    REGEN_WILL: { leadBias: 4, cornerNowBias: 2, trailingBias: -4 },
    RIBO_WILL: { midLateBias: 6, handPressureBias: 4, leadBias: -8, endgameBias: -10 },
    ROBOT_VACUUM_WILL: { midLateBias: 4, cornerEmergencyBias: 2, endgameBias: -4 },
    SALVATION_WILL: { trailingBias: 4, handPressureBias: 2, endgameBias: -2 },
    SEED_WILL: { openingBias: 6, midLateBias: 4, endgameBias: -8, handPressureBias: 4, cornerNowBias: -2 },
    SUPPLY_WILL: { openingBias: 6, midLateBias: 2, endgameBias: -12, cornerNowBias: -4, handPressureBias: -8 },
    SILVER_STONE: { openingBias: 4, handPressureBias: 2, cornerNowBias: 2 },
    SNIPER_WILL: { cornerNowBias: 6, edgeEmergencyBias: 2, endgameBias: -6 },
    STRONG_WIND_WILL: { trailingBias: 6, edgeEmergencyBias: 4, cornerNowBias: -4 },
    SUPER_BUOYANCY_WILL: { trailingBias: 4, cornerEmergencyBias: 4, cornerNowBias: -4 },
    SUPER_GRAVITY_WILL: { trailingBias: 4, cornerEmergencyBias: 4, cornerNowBias: -4 },
    SWAP_WITH_ENEMY: { trailingBias: 4, edgeEmergencyBias: 4, cornerNowBias: -4 },
    TABOO_REVERSE_WILL: { trailingBias: 6, cornerEmergencyBias: 4, leadBias: -6 },
    TELEPORT_WILL: { trailingBias: 4, edgeEmergencyBias: 4, cornerNowBias: -4 },
    CELL_TELEPORT_WILL: { trailingBias: 6, edgeEmergencyBias: 4, cornerNowBias: -6, leadBias: -4 },
    TEMPT_WILL: { trailingBias: 4, edgeEmergencyBias: 4, cornerNowBias: -4 },
    CAPTURE_WILL: { trailingBias: 4, edgeEmergencyBias: 4, cornerNowBias: -4 },
    TIME_BOMB: { trailingBias: 4, cornerEmergencyBias: 4, leadBias: -4 },
    TIME_STOP_GOD: { leadBias: -8, trailingBias: 8, midLateBias: 6, endgameBias: -8, cornerNowBias: 2, cornerEmergencyBias: 6, lowMobilityBias: 4, handPressureBias: 2 },
    TRAP_WILL: { edgeEmergencyBias: 4, cornerEmergencyBias: 2, cornerNowBias: -2 },
    TREASURE_BOX: { openingBias: 4, handPressureBias: 4, cornerNowBias: -4 },
    ULTIMATE_DESTROY_GOD: { trailingBias: 6, cornerNowBias: 4, leadBias: -4 },
    ULTIMATE_HYPERACTIVE_GOD: { trailingBias: 8, leadBias: -8, cornerEmergencyBias: 4 },
    ULTIMATE_REVERSE_DRAGON: { trailingBias: 6, cornerEmergencyBias: 4, leadBias: -6 },
    WILL_HUNTER_KING: { trailingBias: 2, cornerNowBias: 6, edgeEmergencyBias: 2, endgameBias: -6 },
    WORK_WILL: { openingBias: 6, midLateBias: 4, cornerNowBias: 4, endgameBias: -6 },
    X_BOMB: { cornerEmergencyBias: 4, leadBias: -4, endgameBias: -6 }
});

function buildCardTypeUsageStyle(): Record<string, Record<string, number>> {
    const keys = [
        'leadBias',
        'trailingBias',
        'openingBias',
        'midLateBias',
        'endgameBias',
        'cornerNowBias',
        'cornerEmergencyBias',
        'edgeEmergencyBias',
        'lowMobilityBias',
        'handPressureBias'
    ];
    const emptyStyle = (): Record<string, number> => ({
        leadBias: 0,
        trailingBias: 0,
        openingBias: 0,
        midLateBias: 0,
        endgameBias: 0,
        cornerNowBias: 0,
        cornerEmergencyBias: 0,
        edgeEmergencyBias: 0,
        lowMobilityBias: 0,
        handPressureBias: 0
    });
    const style: Record<string, Record<string, number>> = Object.create(null);
    for (const type of ALL_CARD_TYPES_FOR_USAGE_STYLE) style[type] = emptyStyle();
    const patch = (types: any, delta: any) => {
        for (const type of types) {
            if (!Object.prototype.hasOwnProperty.call(style, type)) continue;
            const next = Object.assign({}, style[type]);
            for (const key of keys) {
                const add = Number(delta[key] || 0);
                if (!Number.isFinite(add) || add === 0) continue;
                next[key] = Number(next[key] || 0) + add;
            }
            style[type] = next;
        }
    };

    patch([
        'PROTECTED_NEXT_STONE',
        'GHOST_WILL',
        'PERMA_PROTECT_NEXT_STONE',
        'GUARD_WILL',
        'GUARDIAN_GOD',
        'REGEN_WILL',
        'HEAVEN_BLESSING',
        'BLOCKADE_WILL',
        'EXTEND_LIFE_WILL',
        'EXTEND_LIFE_GOD'
    ], {
        leadBias: 10,
        trailingBias: -6,
        openingBias: 2,
        endgameBias: 6,
        cornerNowBias: 12,
        cornerEmergencyBias: 8,
        edgeEmergencyBias: 4,
        lowMobilityBias: 3,
        handPressureBias: 2
    });

    patch([
        'DESTROY_ONE_STONE',
        'SWAP_WITH_ENEMY',
        'POSITION_SWAP_WILL',
        'STRONG_WIND_WILL',
    'TEMPT_WILL',
    'CAPTURE_WILL',
        'TABOO_REVERSE_WILL',
        'FREE_PLACEMENT',
        'LAST_RESORT',
        'METEOR_WILL',
        'SUPER_BUOYANCY_WILL',
        'SUPER_GRAVITY_WILL',
        'DESTROY_DRAGON_WILL'
    ], {
        leadBias: -8,
        trailingBias: 12,
        openingBias: 2,
        midLateBias: 4,
        endgameBias: -4,
        cornerNowBias: -6,
        cornerEmergencyBias: 14,
        edgeEmergencyBias: 10,
        lowMobilityBias: 8,
        handPressureBias: 2
    });

    patch([
        'GOLD_STONE',
        'CRYSTAL_STONE',
        'RAINBOW_STONE',
        'SILVER_STONE',
        'PLUNDER_WILL',
        'TREASURE_BOX',
        'WORK_WILL',
        'OBSERVER_WILL'
    ], {
        leadBias: -4,
        trailingBias: 6,
        openingBias: 8,
        midLateBias: 3,
        endgameBias: -10,
        cornerNowBias: -8,
        cornerEmergencyBias: -4,
        edgeEmergencyBias: -3,
        lowMobilityBias: -2,
        handPressureBias: 10
    });

    patch([
        'ULTIMATE_REVERSE_DRAGON',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE_GOD',
        'TIME_BOMB',
        'CROSS_BOMB',
        'X_BOMB',
        'HYPERACTIVE_WILL',
        'INSTANT_HYPERACTIVE_WILL',
        'EXTREME_HYPERACTIVE_WILL',
        ...CHAIN_WILL_CARD_TYPES,
        'DOUBLE_PLACE',
        'TRIPLE_PLACE',
        'QUAD_PLACE',
        'INFINITE_PLACE',
        'CLONE_WILL',
        'TELEPORT_WILL',
        'CELL_TELEPORT_WILL',
        'BOARD_EXPANSION_WILL',
        'BOARD_EXPANSION_GOD',
        'BREEDING_WILL',
    ], {
        leadBias: -12,
        trailingBias: 10,
        openingBias: 3,
        midLateBias: 4,
        endgameBias: -14,
        cornerNowBias: -10,
        cornerEmergencyBias: 8,
        edgeEmergencyBias: 5,
        lowMobilityBias: 6,
        handPressureBias: 1
    });

    patch([
        'SNIPER_WILL',
        'LIGHTNING_WILL',
        'TRAP_WILL',
        'ROBOT_VACUUM_WILL',
        'GLUTTONOUS_WILL',
        'CONDEMN_WILL',
        'LOSS_WILL',
        'CORROSION_WILL',
        'ESCAPE_WILL'
    ], {
        leadBias: 4,
        trailingBias: 4,
        openingBias: 1,
        midLateBias: 5,
        endgameBias: -2,
        cornerNowBias: 5,
        cornerEmergencyBias: 6,
        edgeEmergencyBias: 7,
        lowMobilityBias: 4,
        handPressureBias: 3
    });

    patch(['REBUILD_WILL'], {
        leadBias: -6,
        trailingBias: 8,
        openingBias: 2,
        midLateBias: 5,
        endgameBias: -6,
        cornerNowBias: -8,
        cornerEmergencyBias: -4,
        edgeEmergencyBias: 2,
        lowMobilityBias: 6,
        handPressureBias: 16
    });

    for (const type of ALL_CARD_TYPES_FOR_USAGE_STYLE) {
        if (!Object.prototype.hasOwnProperty.call(CARD_TYPE_USAGE_STYLE_OVERRIDES, type)) continue;
        patch([type], CARD_TYPE_USAGE_STYLE_OVERRIDES[type]);
    }

    const frozen = Object.create(null);
    for (const type of ALL_CARD_TYPES_FOR_USAGE_STYLE) {
        frozen[type] = Object.freeze(Object.assign({}, style[type]));
    }
    return Object.freeze(frozen);
}

const CARD_TYPE_USAGE_STYLE = buildCardTypeUsageStyle();

const CARD_MOVE_PLAN_ARCHETYPE_BASE: Readonly<Record<string, Readonly<Record<string, number>>>> = Object.freeze({
    anchorProtect: Object.freeze({
        placementWeight: 2,
        cornerBias: 3,
        edgeBias: 2,
        innerBias: -2,
        bonusBias: 1,
        flipBias: 0,
        mobilityBias: 0,
        emptyAdjBias: -1,
        ownAdjBias: 2,
        oppAdjBias: -1,
        xPenalty: 3,
        cPenalty: 2,
        frontierPenalty: 2,
        stabilityBias: 3
    }),
    anchorEngine: Object.freeze({
        placementWeight: 2,
        cornerBias: 3,
        edgeBias: 2,
        innerBias: -1,
        bonusBias: 0,
        flipBias: 1,
        mobilityBias: 1,
        emptyAdjBias: 0,
        ownAdjBias: 1,
        oppAdjBias: 1,
        xPenalty: 3,
        cPenalty: 2,
        frontierPenalty: 1,
        stabilityBias: 3
    }),
    economyCycle: Object.freeze({
        placementWeight: 1,
        cornerBias: 0,
        edgeBias: 0,
        innerBias: 0,
        bonusBias: 3,
        flipBias: 3,
        mobilityBias: 1,
        emptyAdjBias: 1,
        ownAdjBias: 0,
        oppAdjBias: 0,
        xPenalty: 1,
        cPenalty: 1,
        frontierPenalty: 0,
        stabilityBias: 0
    }),
    recoveryReposition: Object.freeze({
        placementWeight: 1,
        cornerBias: 3,
        edgeBias: 2,
        innerBias: 0,
        bonusBias: 1,
        flipBias: 1,
        mobilityBias: 2,
        emptyAdjBias: 2,
        ownAdjBias: -1,
        oppAdjBias: 2,
        xPenalty: 2,
        cPenalty: 1,
        frontierPenalty: 0,
        stabilityBias: -1
    }),
    explosiveComeback: Object.freeze({
        placementWeight: 1,
        cornerBias: 1,
        edgeBias: 1,
        innerBias: 1,
        bonusBias: 2,
        flipBias: 3,
        mobilityBias: 2,
        emptyAdjBias: 2,
        ownAdjBias: -2,
        oppAdjBias: 2,
        xPenalty: 1,
        cPenalty: 1,
        frontierPenalty: 0,
        stabilityBias: -2
    }),
    spawnMobile: Object.freeze({
        placementWeight: 2,
        cornerBias: 0,
        edgeBias: 1,
        innerBias: 2,
        bonusBias: 1,
        flipBias: 1,
        mobilityBias: 3,
        emptyAdjBias: 3,
        ownAdjBias: 0,
        oppAdjBias: 1,
        xPenalty: 1,
        cPenalty: 1,
        frontierPenalty: 0,
        stabilityBias: 0
    }),
    controlBoard: Object.freeze({
        placementWeight: 1,
        cornerBias: 2,
        edgeBias: 3,
        innerBias: -1,
        bonusBias: 1,
        flipBias: 0,
        mobilityBias: 2,
        emptyAdjBias: 2,
        ownAdjBias: 0,
        oppAdjBias: 1,
        xPenalty: 1,
        cPenalty: 1,
        frontierPenalty: 2,
        stabilityBias: 2
    })
});

const CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES: Readonly<Record<string, Record<string, any>>> = Object.freeze({
    BLOCKADE_WILL: { archetype: 'controlBoard', placementWeight: 0, oppAdjBias: 2, emptyAdjBias: 1 },
    BOARD_EXPANSION_GOD: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 4, edgeBias: 3, emptyAdjBias: 3 },
    BOARD_EXPANSION_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 2, edgeBias: 4, emptyAdjBias: 3 },
    BOARD_SHRINK_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 3, edgeBias: 4, oppAdjBias: 3, emptyAdjBias: 1 },
    BOARD_SHRINK_GOD: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 4, edgeBias: 5, oppAdjBias: 4, emptyAdjBias: 1 },
    BREEDING_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1, oppAdjBias: 2 },
    DOUBLE_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 4, oppAdjBias: 3 },
    TRIPLE_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 5, oppAdjBias: 4, bonusBias: 1 },
    QUAD_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 6, oppAdjBias: 5, bonusBias: 2 },
    INFINITE_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 7, oppAdjBias: 6, bonusBias: 3, stabilityBias: -1 },
    CLONE_WILL: { archetype: 'spawnMobile', placementWeight: 0, ownAdjBias: 1, edgeBias: 2 },
    CONDEMN_WILL: { archetype: 'economyCycle', placementWeight: 0 },
    REVEAL_HAND_WILL: { archetype: 'economyCycle', placementWeight: 0 },
    CORNER_TRIBUTE: { archetype: 'economyCycle', placementWeight: 0 },
    CORROSION_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 3, oppAdjBias: 2 },
    CROSS_BOMB: { archetype: 'explosiveComeback', placementWeight: 3, edgeBias: 2, oppAdjBias: 3 },
    DESTROY_DRAGON_WILL: { archetype: 'anchorEngine', placementWeight: 3, edgeBias: 3, oppAdjBias: 3 },
    DESTROY_ONE_STONE: { archetype: 'recoveryReposition', placementWeight: 0, cornerBias: 4, edgeBias: 3, ownAdjBias: -2 },
    DOUBLE_PLACE: { archetype: 'explosiveComeback', placementWeight: 2, cornerBias: 2, bonusBias: 3, stabilityBias: 1 },
    TRIPLE_PLACE: { archetype: 'explosiveComeback', placementWeight: 2, cornerBias: 3, bonusBias: 4, stabilityBias: 0 },
    QUAD_PLACE: { archetype: 'explosiveComeback', placementWeight: 2, cornerBias: 4, bonusBias: 5, stabilityBias: -1 },
    INFINITE_PLACE: { archetype: 'explosiveComeback', placementWeight: 2, cornerBias: 5, bonusBias: 6, stabilityBias: -2 },
    ESCAPE_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -2, edgeBias: -1, oppAdjBias: -1, emptyAdjBias: 4 },
    EXTEND_LIFE_WILL: { archetype: 'anchorProtect', placementWeight: 0, stabilityBias: 5, ownAdjBias: 3 },
    EXTEND_LIFE_GOD: { archetype: 'anchorProtect', placementWeight: 0, stabilityBias: 6, ownAdjBias: 4 },
    EXTREME_HYPERACTIVE_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -2, oppAdjBias: 2, stabilityBias: -2 },
    REINFORCEMENT_WILL: { archetype: 'recoveryReposition', placementWeight: 0, innerBias: 2, flipBias: 2, stabilityBias: 1 },
    FATE_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 4, edgeBias: 2, mobilityBias: 3, oppAdjBias: 2 },
    FREE_PLACEMENT: { archetype: 'recoveryReposition', placementWeight: 3, cornerBias: 4, edgeBias: 3, innerBias: -2, bonusBias: 2, xPenalty: 3, cPenalty: 2 },
    FREEZE_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 2, edgeBias: 2, stabilityBias: 3, oppAdjBias: 1 },
    GLUTTONOUS_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: 2, edgeBias: 2, oppAdjBias: 3, stabilityBias: 2 },
    GOLD_STONE: { archetype: 'economyCycle', placementWeight: 2, bonusBias: 4, flipBias: 4, stabilityBias: -1 },
    CRYSTAL_STONE: { archetype: 'economyCycle', placementWeight: 2, bonusBias: 8, flipBias: 0, stabilityBias: -1 },
    RAINBOW_STONE: { archetype: 'economyCycle', placementWeight: 2, bonusBias: 6, flipBias: 6, stabilityBias: -2 },
    GUARDIAN_GOD: { archetype: 'anchorProtect', placementWeight: 0, cornerBias: 4, stabilityBias: 4 },
    GUARD_WILL: { archetype: 'anchorProtect', placementWeight: 0, edgeBias: 3, ownAdjBias: 3 },
    AFTERIMAGE_WILL: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 3, stabilityBias: 3, oppAdjBias: 1 },
    GHOST_WILL: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 3, stabilityBias: 3, oppAdjBias: 1 },
    HEAVEN_BLESSING: { archetype: 'economyCycle', placementWeight: 0 },
    HYPERACTIVE_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1, stabilityBias: -1 },
    INSTANT_HYPERACTIVE_WILL: { archetype: 'explosiveComeback', placementWeight: 2, mobilityBias: 4, emptyAdjBias: 4, cornerBias: -1, stabilityBias: -1 },
    LAST_RESORT: { archetype: 'recoveryReposition', placementWeight: 3, cornerBias: 5, edgeBias: 3, innerBias: -3, bonusBias: 2 },
    LIGHTNING_WILL: { archetype: 'anchorEngine', placementWeight: 3, cornerBias: 4, stabilityBias: 4, oppAdjBias: -1 },
    LIVING_WILL: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 3, edgeBias: 2, ownAdjBias: 3, stabilityBias: 5 },
    LOSS_WILL: { archetype: 'controlBoard', placementWeight: 0, edgeBias: 4, oppAdjBias: 2 },
    METEOR_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 3, oppAdjBias: 3, bonusBias: 2 },
    CELL_TELEPORT_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 3, edgeBias: 3, oppAdjBias: 3, emptyAdjBias: 2, stabilityBias: -1 },
    OBSERVER_WILL: { archetype: 'anchorEngine', placementWeight: 2, flipBias: 0, stabilityBias: 4 },
    PERMA_PROTECT_NEXT_STONE: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 4, stabilityBias: 4 },
    PLUNDER_WILL: { archetype: 'economyCycle', placementWeight: 2, flipBias: 4, oppAdjBias: 2 },
    POSITION_SWAP_WILL: { archetype: 'recoveryReposition', placementWeight: 0, cornerBias: 4, edgeBias: 3, emptyAdjBias: 3 },
    PROLIFERATION_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1 },
    PROTECTED_NEXT_STONE: { archetype: 'anchorProtect', placementWeight: 3 },
    REBUILD_WILL: { archetype: 'economyCycle', placementWeight: 0 },
    REGEN_WILL: { archetype: 'anchorProtect', placementWeight: 3, innerBias: -1, flipBias: 1, oppAdjBias: 1 },
    RIBO_WILL: { archetype: 'economyCycle', placementWeight: 0, bonusBias: 1, flipBias: 1 },
    ROBOT_VACUUM_WILL: { archetype: 'spawnMobile', placementWeight: 3, edgeBias: 2, oppAdjBias: 3, stabilityBias: 2 },
    SALVATION_WILL: { archetype: 'recoveryReposition', placementWeight: 0, ownAdjBias: 2, stabilityBias: 2 },
    SEED_WILL: { archetype: 'spawnMobile', placementWeight: 0, edgeBias: 2, emptyAdjBias: 3, ownAdjBias: 2, stabilityBias: 1 },
    SUPPLY_WILL: { archetype: 'economyCycle', placementWeight: 0 },
    SILVER_STONE: { archetype: 'economyCycle', placementWeight: 2, flipBias: 4 },
    SNIPER_WILL: { archetype: 'anchorEngine', placementWeight: 3, mobilityBias: 3, oppAdjBias: -1, stabilityBias: 4 },
    STRONG_WIND_WILL: { archetype: 'recoveryReposition', placementWeight: 0, mobilityBias: 3, emptyAdjBias: 3 },
    SUPER_BUOYANCY_WILL: { archetype: 'recoveryReposition', placementWeight: 0, edgeBias: 3, oppAdjBias: 3 },
    SUPER_GRAVITY_WILL: { archetype: 'recoveryReposition', placementWeight: 0, edgeBias: 3, oppAdjBias: 3 },
    SWAP_WITH_ENEMY: { archetype: 'recoveryReposition', placementWeight: 0, ownAdjBias: -2, oppAdjBias: 3 },
    TABOO_REVERSE_WILL: { archetype: 'explosiveComeback', placementWeight: 3, cornerBias: 3, edgeBias: 2, mobilityBias: 3 },
    TELEPORT_WILL: { archetype: 'recoveryReposition', placementWeight: 0, mobilityBias: 3, emptyAdjBias: 3, xPenalty: 1 },
    TEMPT_WILL: { archetype: 'recoveryReposition', placementWeight: 0, cornerBias: 4, edgeBias: 3, stabilityBias: 0 },
    CAPTURE_WILL: { archetype: 'recoveryReposition', placementWeight: 0, cornerBias: 4, edgeBias: 3, stabilityBias: 0 },
    TIME_BOMB: { archetype: 'explosiveComeback', placementWeight: 0, cornerBias: -2, oppAdjBias: 3, stabilityBias: -1 },
    TIME_STOP_GOD: { archetype: 'anchorEngine', placementWeight: 3, cornerBias: 5, edgeBias: 4, innerBias: -2, emptyAdjBias: -1, ownAdjBias: 3, oppAdjBias: -1, stabilityBias: 6 },
    TRAP_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: -2, oppAdjBias: 3, ownAdjBias: -2, stabilityBias: -2 },
    TREASURE_BOX: { archetype: 'economyCycle', placementWeight: 0, bonusBias: 1, flipBias: 1 },
    ULTIMATE_DESTROY_GOD: { archetype: 'anchorEngine', placementWeight: 3, oppAdjBias: 3, flipBias: 2, stabilityBias: -1 },
    ULTIMATE_HYPERACTIVE_GOD: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1, mobilityBias: 4, oppAdjBias: 2, stabilityBias: -1 },
    ULTIMATE_REVERSE_DRAGON: { archetype: 'anchorEngine', placementWeight: 3, innerBias: 1, oppAdjBias: 3, flipBias: 3 },
    WILL_HUNTER_KING: { archetype: 'anchorEngine', placementWeight: 3, cornerBias: 4, stabilityBias: 4, oppAdjBias: -1 },
    WORK_WILL: { archetype: 'anchorEngine', placementWeight: 3, flipBias: 0, emptyAdjBias: -1, stabilityBias: 5 },
    X_BOMB: { archetype: 'explosiveComeback', placementWeight: 3, innerBias: 2, emptyAdjBias: 3, xPenalty: 0 }
});

function buildCardTypeMovePlanProfile(): Record<string, Record<string, any>> {
    const numericKeys = [
        'placementWeight',
        'cornerBias',
        'edgeBias',
        'innerBias',
        'bonusBias',
        'flipBias',
        'mobilityBias',
        'emptyAdjBias',
        'ownAdjBias',
        'oppAdjBias',
        'xPenalty',
        'cPenalty',
        'frontierPenalty',
        'stabilityBias'
    ];
    const profileByType: Record<string, Record<string, any>> = Object.create(null);
    for (const type of ALL_CARD_TYPES_FOR_USAGE_STYLE) {
        const override = Object.prototype.hasOwnProperty.call(CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES, type)
            ? CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES[type]
            : { archetype: 'economyCycle', placementWeight: 0 };
        const archetypeName = typeof override.archetype === 'string'
            ? override.archetype
            : 'economyCycle';
        const base = Object.prototype.hasOwnProperty.call(CARD_MOVE_PLAN_ARCHETYPE_BASE, archetypeName)
            ? CARD_MOVE_PLAN_ARCHETYPE_BASE[archetypeName]
            : CARD_MOVE_PLAN_ARCHETYPE_BASE.economyCycle;
        const next: Record<string, any> = Object.assign({ archetype: archetypeName }, base);
        for (const key of numericKeys) {
            if (!Object.prototype.hasOwnProperty.call(override, key)) continue;
            const value = Number(override[key]);
            next[key] = Number.isFinite(value) ? value : Number(base[key] || 0);
        }
        profileByType[type] = Object.freeze(next);
    }
    return Object.freeze(profileByType);
}

const CARD_TYPE_MOVE_PLAN_PROFILE = buildCardTypeMovePlanProfile();

function chooseHighestCostCard(usableCardIds: any, getCardCost: any, getCardDef: any): { cardId: any; cardDef: any } | null {
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    const sorted = usableCardIds.slice().sort((a: any, b: any) => {
        const ca = typeof getCardCost === 'function' ? (getCardCost(a) || 0) : 0;
        const cb = typeof getCardCost === 'function' ? (getCardCost(b) || 0) : 0;
        return cb - ca;
    });
    const cardId = sorted[0];
    const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
    return { cardId, cardDef };
}

function isCornerRecoveryCardType(cardType: any): boolean {
    const normalizedType = String(cardType || '');
    if (!normalizedType) return false;
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isRecoveryCardType === 'function') {
        try {
            if (SharedCardHeuristics.isRecoveryCardType(normalizedType) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return CORNER_RECOVERY_CARD_TYPES.has(normalizedType);
}

function isCornerHoldCardType(cardType: any): boolean {
    const normalizedType = String(cardType || '');
    if (!normalizedType) return false;
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isHoldCardType === 'function') {
        try {
            if (SharedCardHeuristics.isHoldCardType(normalizedType) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return CORNER_HOLD_CARD_TYPES.has(normalizedType);
}

function isChargeRampCardType(cardType: any): boolean {
    const normalizedType = String(cardType || '');
    if (!normalizedType) return false;
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isChargeRampCardType === 'function') {
        try {
            if (SharedCardHeuristics.isChargeRampCardType(normalizedType) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return CHARGE_RAMP_CARD_TYPES.has(normalizedType);
}

function hasUsageStyleForCardType(cardType: any): boolean {
    return Object.prototype.hasOwnProperty.call(
        CARD_TYPE_USAGE_STYLE,
        String(cardType || '')
    );
}

function hasBaseScoreBonusForCardType(cardType: any): boolean {
    return Object.prototype.hasOwnProperty.call(
        CARD_TYPE_BASE_SCORE_BONUS,
        String(cardType || '')
    );
}

function hasMovePlanProfileForCardType(cardType: any): boolean {
    return Object.prototype.hasOwnProperty.call(
        CARD_TYPE_MOVE_PLAN_PROFILE,
        String(cardType || '')
    );
}

function getMovePlanProfileForCardType(cardType: any): any {
    const type = String(cardType || '');
    if (!Object.prototype.hasOwnProperty.call(CARD_TYPE_MOVE_PLAN_PROFILE, type)) return null;
    return CARD_TYPE_MOVE_PLAN_PROFILE[type] || null;
}

function getForcedHandDestroyReason(cardId: any, cardType: any, context: any, usableCardIdSet: any): string | null {
    const type = String(cardType || '').trim();
    if (!type) return null;
    if (IMMEDIATE_DESTROY_CARD_TYPES.has(type)) return 'bucket1_never_use';

    const ctx = context || {};
    const ownCharge = Number.isFinite(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
    const handSize = Number.isFinite(ctx.handSize) ? Math.max(0, Math.floor(ctx.handSize)) : 0;
    if (type === 'SUPPLY_WILL' && handSize >= 2) {
        return null;
    }
    if (LOW_CHARGE_DESTROY_CARD_TYPES.has(type) && ownCharge <= LOW_CHARGE_DESTROY_MAX_CHARGE) {
        return 'bucket2_low_charge';
    }

    const safeCardId = String(cardId || '').trim();
    if (
        CONDITION_DEPENDENT_DESTROY_CARD_TYPES.has(type) &&
        safeCardId &&
        !(usableCardIdSet instanceof Set && usableCardIdSet.has(safeCardId))
    ) {
        return 'bucket3_currently_unusable';
    }

    return null;
}

function getForcedHandDestroyPriority(reason: any): number {
    switch (String(reason || '')) {
    case 'bucket1_never_use':
        return 1;
    case 'bucket2_low_charge':
        return 2;
    case 'bucket3_currently_unusable':
        return 3;
    default:
        return 99;
    }
}

function buildBlockedCardUseDecision(cardId: any, cardDef: any, cardType: any, cardCost: any, context: any, reason: any): any {
    const ctx = context || {};
    return {
        cardId,
        cardDef,
        cardType,
        cardCost,
        score: -1000000,
        shouldUse: false,
        minUseScore: Number.isFinite(ctx.minUseScore) ? Number(ctx.minUseScore) : Number.NEGATIVE_INFINITY,
        reason: String(reason || 'blocked')
    };
}

function chooseForcedHandDestroyTarget(handCardIds: any, getCardCost: any, getCardDef: any, context: any, usableCardIdSet: any): any {
    if (!Array.isArray(handCardIds) || handCardIds.length <= 0) return null;
    let best: any = null;

    for (const rawCardId of handCardIds) {
        const cardId = String(rawCardId || '').trim();
        if (!cardId) continue;
        const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
        const cardType = cardDef && typeof cardDef.type === 'string' ? cardDef.type : '';
        const reason = getForcedHandDestroyReason(cardId, cardType, context, usableCardIdSet);
        if (!reason) continue;
        const cardCost = typeof getCardCost === 'function' ? Number(getCardCost(cardId) || 0) : 0;
        const priority = getForcedHandDestroyPriority(reason);

        if (
            !best ||
            priority < best.priority ||
            (priority === best.priority && cardCost > best.cardCost) ||
            (priority === best.priority && cardCost === best.cardCost && cardId < best.cardId)
        ) {
            best = {
                cardId,
                cardDef,
                cardType,
                cardCost,
                priority,
                reason
            };
        }
    }

    if (!best) return null;
    return {
        cardId: best.cardId,
        cardDef: best.cardDef,
        cardType: best.cardType,
        score: Number.NEGATIVE_INFINITY,
        reason: best.reason
    };
}

function countBoardDiscsForPlayer(board: any, playerValue: any): { own: number; opp: number; empties: number } {
    if (!Array.isArray(board)) return { own: 0, opp: 0, empties: 0 };
    if (
        SharedBoardUtils &&
        typeof SharedBoardUtils.collectBoardCoordinates === 'function' &&
        typeof SharedBoardUtils.getCellValue === 'function'
    ) {
        let own = 0;
        let opp = 0;
        let empties = 0;
        for (const cell of SharedBoardUtils.collectBoardCoordinates(board)) {
            const v = SharedBoardUtils.getCellValue(board, cell.row, cell.col);
            if (v === playerValue) own += 1;
            else if (v === -playerValue) opp += 1;
            else if (v === 0) empties += 1;
        }
        return { own, opp, empties };
    }
    let own = 0;
    let opp = 0;
    let empties = 0;
    for (let r = 0; r < board.length; r++) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        for (let c = 0; c < row.length; c++) {
            const v = row[c];
            if (v === playerValue) own += 1;
            else if (v === -playerValue) opp += 1;
            else if (v === 0) empties += 1;
        }
    }
    return { own, opp, empties };
}

function countBoardEdgeDiscsForPlayer(board: any, playerValue: any): { ownEdges: number; oppEdges: number } {
    if (!Array.isArray(board) || board.length <= 0) return { ownEdges: 0, oppEdges: 0 };
    if (SharedBoardUtils && typeof SharedBoardUtils.countEdgeControl === 'function') {
        return SharedBoardUtils.countEdgeControl(board, playerValue);
    }
    const maxRow = board.length - 1;
    let ownEdges = 0;
    let oppEdges = 0;
    for (let row = 0; row < board.length; row++) {
        const line = Array.isArray(board[row]) ? board[row] : [];
        if (line.length <= 0) continue;
        const maxCol = line.length - 1;
        for (let col = 0; col < line.length; col++) {
            const isEdge = row === 0 || row === maxRow || col === 0 || col === maxCol;
            const isCorner = (row === 0 || row === maxRow) && (col === 0 || col === maxCol);
            if (!isEdge || isCorner) continue;
            const value = line[col];
            if (value === playerValue) ownEdges += 1;
            else if (value === -playerValue) oppEdges += 1;
        }
    }
    return { ownEdges, oppEdges };
}

function estimateOwnOppDiscs(discDiff: any, empties: any, totalCells: any): { own: number; opp: number; occupied: number; totalCells: number } {
    const safeTotalCells = Number.isFinite(totalCells)
        ? Math.max(1, Math.floor(totalCells))
        : 64;
    const safeEmpties = Number.isFinite(empties)
        ? Math.max(0, Math.min(safeTotalCells, Math.floor(empties)))
        : 0;
    const occupied = safeTotalCells - safeEmpties;
    const rawOwn = Math.floor((occupied + discDiff) / 2);
    const own = Math.max(0, Math.min(occupied, rawOwn));
    const opp = Math.max(0, occupied - own);
    return { own, opp, occupied, totalCells: safeTotalCells };
}

function buildCardDecisionContext(context: any): any {
    const ctx = context || {};
    const level = Number.isFinite(ctx.level) ? Math.max(1, Math.floor(ctx.level)) : 1;
    const playerValue = Number.isFinite(ctx.playerValue)
        ? (ctx.playerValue >= 0 ? 1 : -1)
        : 1;
    const legalMovesCount = Number.isFinite(ctx.legalMovesCount) ? Math.max(0, Math.floor(ctx.legalMovesCount)) : 0;

    let discDiff: number = Number.isFinite(ctx.discDiff) ? Number(ctx.discDiff) : 0;
    let empties: number = Number.isFinite(ctx.empties) ? Math.max(0, Math.floor(ctx.empties)) : 0;
    let ownDiscs: number = Number.isFinite(ctx.ownDiscs) ? Math.max(0, Math.floor(ctx.ownDiscs)) : 0;
    let oppDiscs: number = Number.isFinite(ctx.oppDiscs) ? Math.max(0, Math.floor(ctx.oppDiscs)) : 0;
    let ownEdges: number = Number.isFinite(ctx.ownEdges) ? Math.max(0, Math.floor(ctx.ownEdges)) : 0;
    let oppEdges: number = Number.isFinite(ctx.oppEdges) ? Math.max(0, Math.floor(ctx.oppEdges)) : 0;
    let totalCells: number = Number.isFinite(ctx.totalCells) ? Math.max(1, Math.floor(ctx.totalCells)) : 64;
    if (Array.isArray(ctx.board)) {
        let cells = 0;
        for (let r = 0; r < ctx.board.length; r++) {
            const row = Array.isArray(ctx.board[r]) ? ctx.board[r] : [];
            cells += row.length;
        }
        if (cells > 0) totalCells = cells;
        const boardStat = countBoardDiscsForPlayer(ctx.board, playerValue);
        const edgeStat = countBoardEdgeDiscsForPlayer(ctx.board, playerValue);
        if (!Number.isFinite(ctx.discDiff)) discDiff = boardStat.own - boardStat.opp;
        if (!Number.isFinite(ctx.empties)) empties = boardStat.empties;
        if (!Number.isFinite(ctx.ownDiscs)) ownDiscs = boardStat.own;
        if (!Number.isFinite(ctx.oppDiscs)) oppDiscs = boardStat.opp;
        if (!Number.isFinite(ctx.ownEdges)) ownEdges = edgeStat.ownEdges;
        if (!Number.isFinite(ctx.oppEdges)) oppEdges = edgeStat.oppEdges;
    }
    if (!Number.isFinite(empties)) empties = 0;
    if (!Number.isFinite(ownDiscs) || !Number.isFinite(oppDiscs)) {
        const est = estimateOwnOppDiscs(discDiff, empties, totalCells);
        if (!Number.isFinite(ownDiscs)) ownDiscs = est.own;
        if (!Number.isFinite(oppDiscs)) oppDiscs = est.opp;
    }
    if (!Number.isFinite(ownEdges)) ownEdges = 0;
    if (!Number.isFinite(oppEdges)) oppEdges = 0;

    const isOpening = empties >= 50;
    const isMidLate = empties <= 32 && empties >= 12;
    const isEndgame = empties < 12;
    const isLowMobility = legalMovesCount <= 3;
    const isLeading = discDiff > 0;
    const isTrailing = discDiff < 0;
    const hasCornerMove = ctx.hasCornerMoveNow === true;
    const cornerEmergency = ctx.cornerEmergency === true;
    const edgeEmergency = ctx.edgeEmergency === true;
    const handPressure = ctx.handPressure === true;

    return {
        level,
        playerValue,
        legalMovesCount,
        discDiff,
        empties,
        ownDiscs,
        oppDiscs,
        ownEdges,
        oppEdges,
        totalCells,
        isOpening,
        isMidLate,
        isEndgame,
        isLowMobility,
        isLeading,
        isTrailing,
        hasCornerMove,
        cornerEmergency,
        edgeEmergency,
        handPressure
    };
}

function scoreCardRetentionPriority(cardType: any, context: any): number {
    const type = String(cardType || '').trim();
    if (!type) return 0;
    const ctx = buildCardDecisionContext(context);
    let score = 0;

    if (hasBaseScoreBonusForCardType(type)) {
        score += CARD_TYPE_BASE_SCORE_BONUS[type] || 0;
    }

    if (hasUsageStyleForCardType(type)) {
        const style = CARD_TYPE_USAGE_STYLE[type];
        if (ctx.isLeading) score += style.leadBias || 0;
        if (ctx.isTrailing) score += style.trailingBias || 0;
        if (ctx.isOpening) score += style.openingBias || 0;
        if (ctx.isMidLate) score += style.midLateBias || 0;
        if (ctx.isEndgame) score += style.endgameBias || 0;
        if (ctx.hasCornerMove) score += style.cornerNowBias || 0;
        if (ctx.cornerEmergency) score += style.cornerEmergencyBias || 0;
        if (ctx.edgeEmergency) score += style.edgeEmergencyBias || 0;
        if (ctx.isLowMobility) score += style.lowMobilityBias || 0;
        if (ctx.handPressure) score += style.handPressureBias || 0;
    }

    if (isCornerRecoveryCardType(type) && (ctx.cornerEmergency || ctx.edgeEmergency)) {
        score += 20;
    }
    if (isCornerHoldCardType(type) && ctx.hasCornerMove) {
        score += 15;
    }
    if (isChargeRampCardType(type) && ctx.isOpening) {
        score += 10;
    }

    return score;
}

function scoreCardUseDecision(cardId: any, cardDef: any, context: any): { score: number; shouldUse: boolean } {
    const type = cardDef && typeof cardDef.type === 'string' ? cardDef.type : '';
    if (!type) return { score: -1000000, shouldUse: false };
    const ctx = buildCardDecisionContext(context);
    let score = scoreCardRetentionPriority(type, context);

    if (ctx.isEndgame && HIGH_VARIANCE_CARD_TYPES.has(type)) {
        score -= 15;
    }
    if (ctx.isLeading && SWING_CARD_TYPES.has(type)) {
        score -= 10;
    }
    if (ctx.isTrailing && DEFENSIVE_CARD_TYPES.has(type)) {
        score += 10;
    }

    const shouldUse = score > (ctx.minUseScore || 0);
    return { score, shouldUse };
}

function scoreMoveForCornerEdgePlan(move: any, planContext: any): number {
    if (!move || !planContext) return 0;
    const row = Number.isFinite(move.row) ? move.row : 0;
    const col = Number.isFinite(move.col) ? move.col : 0;
    const flips = Array.isArray(move.flips) ? move.flips.length : 0;
    const profile = getMovePlanProfileForCardType(planContext.cardType);
    if (!profile) return flips * 100;

    let score = flips * 100;
    if (planContext.isCorner && profile.cornerBias) score += profile.cornerBias * 1000;
    if (planContext.isEdge && profile.edgeBias) score += profile.edgeBias * 500;
    if (planContext.isInner && profile.innerBias) score += profile.innerBias * 100;
    if (planContext.hasBonus && profile.bonusBias) score += profile.bonusBias * 200;

    return score;
}

function scoreMoveHeuristic(move: any, context: any): number {
    if (!move) return 0;
    const row = Number.isFinite(move.row) ? move.row : 0;
    const col = Number.isFinite(move.col) ? move.col : 0;
    const flips = Array.isArray(move.flips) ? move.flips.length : 0;
    const ctx = buildCardDecisionContext(context);
    let score = flips * 100;

    if (ctx.isCorner) score += 1000;
    if (ctx.isEdge) score += 500;
    if (ctx.isXSquare) score -= 300;
    if (ctx.isCSquare) score -= 150;

    return score;
}

export = {
    THROW_CHAIN_CARD_TYPES,
    CHAIN_WILL_CARD_TYPES,
    DEFENSIVE_CARD_TYPES,
    HIGH_VARIANCE_CARD_TYPES,
    CORNER_RECOVERY_CARD_TYPES,
    CORNER_HOLD_CARD_TYPES,
    CHARGE_RAMP_CARD_TYPES,
    REBUILD_KEEP_PRIORITY_CARD_TYPES,
    STABILITY_CARD_TYPES,
    SWING_CARD_TYPES,
    EDGE_CONTEST_CARD_TYPES,
    LONG_HORIZON_CARD_TYPES,
    WHITE_LV6_CORNER_SWING_KEEP_TYPES,
    WHITE_LV6_FAST_ROTATE_TYPES,
    WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES,
    IMMEDIATE_DESTROY_CARD_TYPES,
    LOW_CHARGE_DESTROY_CARD_TYPES,
    CONDITION_DEPENDENT_DESTROY_CARD_TYPES,
    LOW_CHARGE_DESTROY_MAX_CHARGE,
    CARD_TYPE_BASE_SCORE_BONUS,
    ALL_CARD_TYPES_FOR_USAGE_STYLE,
    CARD_TYPE_USAGE_STYLE_OVERRIDES,
    CARD_TYPE_USAGE_STYLE,
    CARD_MOVE_PLAN_ARCHETYPE_BASE,
    CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES,
    CARD_TYPE_MOVE_PLAN_PROFILE,
    buildCardTypeUsageStyle,
    buildCardTypeMovePlanProfile,
    chooseHighestCostCard,
    isCornerRecoveryCardType,
    isCornerHoldCardType,
    isChargeRampCardType,
    hasUsageStyleForCardType,
    hasBaseScoreBonusForCardType,
    hasMovePlanProfileForCardType,
    getMovePlanProfileForCardType,
    getForcedHandDestroyReason,
    getForcedHandDestroyPriority,
    buildBlockedCardUseDecision,
    chooseForcedHandDestroyTarget,
    countBoardDiscsForPlayer,
    countBoardEdgeDiscsForPlayer,
    estimateOwnOppDiscs,
    buildCardDecisionContext,
    scoreCardRetentionPriority,
    scoreCardUseDecision,
    scoreMoveForCornerEdgePlan,
    scoreMoveHeuristic
};