/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
    CpuPolicyBoard,
    CpuPolicyBoardBonusResolver,
    CpuPolicyCardContext,
    CpuPolicyCardCostResolver,
    CpuPolicyCardDefinition,
    CpuPolicyCardDefinitionResolver,
    CpuPolicyCardId,
    CpuPolicyCardScore,
    CpuPolicyCardSelection,
    CpuPolicyCoreApi,
    CpuPolicyLegalMoveMetrics,
    CpuPolicyMove,
    CpuPolicyMoveOptions,
    CpuPolicyRandomSource,
    CpuPolicyAiMoveSelector,
    CpuPolicyPosition
} from './cpu-policy-core-types';
import { createCpuPolicyCoreApi } from './cpu-policy-core-api';
/**
 * @file cpu-policy-core.js
 * @description Pure CPU policy helpers (no UI/DOM/global side effects).
 */

'use strict';

type CpuPolicyNumericMap = Record<string, number>;
type CpuPolicyUsageStyle = Record<string, number>;
type CpuPolicyMovePlanProfile = Record<string, string | number>;
type CpuPolicyCardTypeMap<T> = Record<string, T>;
type CpuPolicyForcedDestroyReason = 'bucket1_never_use' | 'bucket2_low_charge' | 'bucket3_currently_unusable';
type CpuPolicyBoardShape = CpuPolicyBoard | number | null | undefined;

interface CpuPolicyBoardGeometry {
    maxR: number;
    maxC: number;
}

interface CpuPolicyEdgeRunSummary extends Record<string, unknown> {
    chainStrength?: number;
    longestRun?: number;
    completeLineCount?: number;
    loneDiscCount?: number;
}

interface CpuPolicyParityFeature {
    regionCount: number;
    oddRegionCount: number;
    evenRegionCount: number;
    oddEmptyCount: number;
    evenEmptyCount: number;
    signal: number;
    score: number;
}

type CpuPolicyBonusConsumedMap = Record<string, boolean | number>;

interface CpuPolicySearchMoveParams extends Omit<CpuPolicyMoveOptions, 'boardBonusConsumedByCell'> {
    board: CpuPolicyBoard;
    playerValue: number;
    branchLimit?: number | null;
    rootPriorScoreFn?: ((move: CpuPolicyMove) => number) | null;
    boardBonusConsumedByCell?: CpuPolicyBonusConsumedMap | null;
}

interface CpuPolicyDecisionContext {
    [key: string]: unknown;
    level: number;
    playerValue: 1 | -1;
    legalMovesCount: number;
    discDiff: number;
    empties: number;
    ownDiscs: number;
    oppDiscs: number;
    ownEdges: number;
    oppEdges: number;
    totalCells: number;
    ownCharge: number;
    oppCharge: number;
    oppHandSize: number;
    handSize: number;
    handCardIds: string[];
    deckRemaining: number | null;
    usableCardIds: string[];
    forceUseCard: boolean;
    minUseScore: number;
    ownCorners: number;
    oppCorners: number;
    hasCornerMoveNow: boolean;
    hasEdgeMoveNow: boolean;
    cornerEmergency: boolean;
    cornerHoldMode: boolean;
    recoveryCostGap: number;
    reserveChargeFloor: number;
    highBonusMoveAvailable: boolean;
    maxLegalFlips: number;
    avgLegalFlips: number;
    maxLegalGain: number;
    maxLegalBoardBonus: number;
    cloneSplitEligibleSourceCount: number | null;
    ownSpecialCount: number;
    oppSpecialCount: number;
    ownGuardCount: number;
    oppGuardCount: number;
    ownCornerResetCount: number;
    oppCornerResetCount: number;
    ownEdgeResetCount: number;
    oppEdgeResetCount: number;
    meteorBestCornerSwing: number;
    meteorBestDestroyValue: number;
    meteorHasCornerPromotion: boolean;
    meteorHasHighValueDestroy: boolean;
    whiteLv6Mode: boolean;
    lowDiscEmergency: boolean;
    criticalLowDiscEmergency: boolean;
}

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function isFiniteNumber(value: unknown): boolean {
    return Number.isFinite(Number(value));
}

function requireOptionalModule(id: string): any {
    try {
        return require(id);
    } catch (e) {
        return null;
    }
}

const SharedBoardUtils = requireOptionalModule('../../shared/shared-board-utils');
const OthelloCore = requireOptionalModule('../../shared/othello-core');
const SharedCardHeuristics = requireOptionalModule('../../shared/shared-card-heuristics');
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
    'EXECUTION_WILL',
    'TRAP_WILL',
    'EXTEND_LIFE_WILL',
    'EXTEND_LIFE_GOD',
    'SNIPER_WILL',
    'LIGHTNING_WILL',
    'SALVATION_WILL',
    'STONE_SALVATION_GOD',
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
    'EQUALITY_WILL',
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
    'HYPERACTIVE_INHERIT_WILL',
    'RIBO_WILL',
    'LOSS_WILL',
    'CORROSION_WILL',
    'BUOYANCY_WILL',
    'SUPER_BUOYANCY_WILL',
    'GRAVITY_WILL',
    'SUPER_GRAVITY_WILL',
    'SUPER_ATTRACTION_WILL',
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
            'BUOYANCY_WILL',
            'SUPER_BUOYANCY_WILL',
            'GRAVITY_WILL',
            'SUPER_GRAVITY_WILL',
            'SUPER_ATTRACTION_WILL',
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
        'BUOYANCY_WILL',
        'SUPER_BUOYANCY_WILL',
        'GRAVITY_WILL',
        'SUPER_GRAVITY_WILL',
        'SUPER_ATTRACTION_WILL',
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
            'WILL_HUNTER_KING',
            'STONE_SALVATION_GOD'
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
        'WILL_HUNTER_KING',
        'STONE_SALVATION_GOD'
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
        'OBSERVER_WILL'
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
    'WILL_HUNTER_KING',
    'STONE_SALVATION_GOD'
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
    'EQUALITY_WILL',
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
    'HYPERACTIVE_INHERIT_WILL',
    'EXTREME_HYPERACTIVE_WILL',
    'LOSS_WILL',
    'CORROSION_WILL',
    'DESTROY_DRAGON_WILL',
    'BUOYANCY_WILL',
    'SUPER_BUOYANCY_WILL',
    'GRAVITY_WILL',
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
    'BUOYANCY_WILL',
    'SUPER_BUOYANCY_WILL',
    'GRAVITY_WILL',
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
    'HYPERACTIVE_INHERIT_WILL',
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
    'BUOYANCY_WILL',
    'SUPER_BUOYANCY_WILL',
    'GRAVITY_WILL',
    'SUPER_GRAVITY_WILL'
]);

const WHITE_LV6_FAST_ROTATE_TYPES = new Set([
    ...CHAIN_WILL_CARD_TYPES,
    'DOUBLE_PLACE',
    'BREEDING_WILL',
    'CLONE_WILL',
    'HYPERACTIVE_INHERIT_WILL',
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
    'HYPERACTIVE_INHERIT_WILL',
    'EXTREME_HYPERACTIVE_WILL'
]);

const IMMEDIATE_DESTROY_CARD_TYPES = new Set([
    'TIME_STOP_GOD',
    'CELL_TELEPORT_WILL',
    'FREEZE_WILL'
]);

const LOW_CHARGE_DESTROY_CARD_TYPES = new Set([
    'ESCAPE_WILL',
    'HYPERACTIVE_INHERIT_WILL',
    'BOARD_EXPANSION_GOD',
    'SUPPLY_WILL',
    'REVEAL_HAND_WILL',
    'FATE_WILL'
]);

const CONDITION_DEPENDENT_DESTROY_CARD_TYPES = new Set([
    'RIBO_WILL',
    'LAST_RESORT',
    'EQUALITY_WILL',
    'REINFORCEMENT_WILL',
    'CORROSION_WILL',
    'SALVATION_WILL',
    'EXECUTION_WILL',
    'CORNER_TRIBUTE'
]);

const LOW_CHARGE_DESTROY_MAX_CHARGE = 50;

// Explicit per-card baseline bias so every catalog card type is scored intentionally.
// Positive: generally usable/safer. Negative: volatile or high opportunity cost.
const CARD_TYPE_BASE_SCORE_BONUS = Object.freeze({
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
    EXECUTION_WILL: 6,
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
    EQUALITY_WILL: 4,
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
    HYPERACTIVE_INHERIT_WILL: -2,
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
    STONE_SALVATION_GOD: 10,
    SEED_WILL: 2,
    SUPPLY_WILL: 8,
    SILVER_STONE: 10,
    SNIPER_WILL: 4,
    STRONG_WIND_WILL: 6,
    BUOYANCY_WILL: -1,
    SUPER_BUOYANCY_WILL: -3,
    GRAVITY_WILL: -1,
    SUPER_GRAVITY_WILL: -3,
    SUPER_ATTRACTION_WILL: -2,
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
    'EXECUTION_WILL',
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
    'EQUALITY_WILL',
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
    'HYPERACTIVE_INHERIT_WILL',
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
    'STONE_SALVATION_GOD',
    'SEED_WILL',
    'SUPPLY_WILL',
    'SILVER_STONE',
    'SNIPER_WILL',
    'STRONG_WIND_WILL',
    'BUOYANCY_WILL',
    'SUPER_BUOYANCY_WILL',
    'GRAVITY_WILL',
    'SUPER_GRAVITY_WILL',
    'SUPER_ATTRACTION_WILL',
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
const CARD_TYPE_USAGE_STYLE_OVERRIDES = Object.freeze({
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
    EXECUTION_WILL: { trailingBias: 4, handPressureBias: 6, cornerNowBias: -2 },
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
    EQUALITY_WILL: { leadBias: -8, trailingBias: 8, midLateBias: 4, endgameBias: -8, lowMobilityBias: 4, handPressureBias: 2 },
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
    HYPERACTIVE_INHERIT_WILL: { openingBias: 4, midLateBias: 4, endgameBias: -6 },
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
    STONE_SALVATION_GOD: { leadBias: 4, trailingBias: 2, cornerNowBias: 4, cornerEmergencyBias: 4, edgeEmergencyBias: 2, endgameBias: 2 },
    SEED_WILL: { openingBias: 6, midLateBias: 4, endgameBias: -8, handPressureBias: 4, cornerNowBias: -2 },
    SUPPLY_WILL: { openingBias: 6, midLateBias: 2, endgameBias: -12, cornerNowBias: -4, handPressureBias: -8 },
    SILVER_STONE: { openingBias: 4, handPressureBias: 2, cornerNowBias: 2 },
    SNIPER_WILL: { cornerNowBias: 6, edgeEmergencyBias: 2, endgameBias: -6 },
    STRONG_WIND_WILL: { trailingBias: 6, edgeEmergencyBias: 4, cornerNowBias: -4 },
    BUOYANCY_WILL: { trailingBias: 3, cornerEmergencyBias: 3, cornerNowBias: -4 },
    SUPER_BUOYANCY_WILL: { trailingBias: 4, cornerEmergencyBias: 4, cornerNowBias: -4 },
    GRAVITY_WILL: { trailingBias: 3, cornerEmergencyBias: 3, cornerNowBias: -4 },
    SUPER_GRAVITY_WILL: { trailingBias: 4, cornerEmergencyBias: 4, cornerNowBias: -4 },
    SUPER_ATTRACTION_WILL: { trailingBias: 5, cornerEmergencyBias: 5, edgeEmergencyBias: 3, cornerNowBias: -5 },
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

function buildCardTypeUsageStyle() {
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
    const emptyStyle = () => ({
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
    const style: CpuPolicyCardTypeMap<CpuPolicyUsageStyle> = Object.create(null);
    for (const type of ALL_CARD_TYPES_FOR_USAGE_STYLE) style[type] = emptyStyle();
    const patch = (types: readonly string[], delta: CpuPolicyNumericMap) => {
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
        'BUOYANCY_WILL',
        'SUPER_BUOYANCY_WILL',
        'GRAVITY_WILL',
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
        'HYPERACTIVE_INHERIT_WILL',
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
        'EXECUTION_WILL',
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
        patch([type], CARD_TYPE_USAGE_STYLE_OVERRIDES[type as keyof typeof CARD_TYPE_USAGE_STYLE_OVERRIDES]);
    }

    const frozen: CpuPolicyCardTypeMap<CpuPolicyUsageStyle> = Object.create(null);
    for (const type of ALL_CARD_TYPES_FOR_USAGE_STYLE) {
        frozen[type] = Object.freeze(Object.assign({}, style[type]));
    }
    return Object.freeze(frozen);
}

const CARD_TYPE_USAGE_STYLE = buildCardTypeUsageStyle();

const CARD_MOVE_PLAN_ARCHETYPE_BASE = Object.freeze({
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

const CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES = Object.freeze({
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
    EXECUTION_WILL: { archetype: 'economyCycle', placementWeight: 0 },
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
    EQUALITY_WILL: { archetype: 'explosiveComeback', placementWeight: 0 },
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
    HYPERACTIVE_INHERIT_WILL: { archetype: 'spawnMobile', placementWeight: 0, emptyAdjBias: 4, stabilityBias: -1 },
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
    STONE_SALVATION_GOD: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 4, edgeBias: 3, ownAdjBias: 3, stabilityBias: 5 },
    SEED_WILL: { archetype: 'spawnMobile', placementWeight: 0, edgeBias: 2, emptyAdjBias: 3, ownAdjBias: 2, stabilityBias: 1 },
    SUPPLY_WILL: { archetype: 'economyCycle', placementWeight: 0 },
    SILVER_STONE: { archetype: 'economyCycle', placementWeight: 2, flipBias: 4 },
    SNIPER_WILL: { archetype: 'anchorEngine', placementWeight: 3, mobilityBias: 3, oppAdjBias: -1, stabilityBias: 4 },
    STRONG_WIND_WILL: { archetype: 'recoveryReposition', placementWeight: 0, mobilityBias: 3, emptyAdjBias: 3 },
    BUOYANCY_WILL: { archetype: 'recoveryReposition', placementWeight: 0, edgeBias: 2, emptyAdjBias: 3 },
    SUPER_BUOYANCY_WILL: { archetype: 'recoveryReposition', placementWeight: 0, edgeBias: 3, oppAdjBias: 3 },
    GRAVITY_WILL: { archetype: 'recoveryReposition', placementWeight: 0, edgeBias: 2, emptyAdjBias: 3 },
    SUPER_GRAVITY_WILL: { archetype: 'recoveryReposition', placementWeight: 0, edgeBias: 3, oppAdjBias: 3 },
    SUPER_ATTRACTION_WILL: { archetype: 'recoveryReposition', placementWeight: 0, cornerBias: 3, edgeBias: 3, oppAdjBias: 4, emptyAdjBias: 2 },
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

function buildCardTypeMovePlanProfile() {
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
    const profileByType: CpuPolicyCardTypeMap<CpuPolicyMovePlanProfile> = Object.create(null);
    for (const type of ALL_CARD_TYPES_FOR_USAGE_STYLE) {
        const override = Object.prototype.hasOwnProperty.call(CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES, type)
            ? CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES[type as keyof typeof CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES]
            : { archetype: 'economyCycle', placementWeight: 0 };
        const archetypeName = typeof override.archetype === 'string'
            ? override.archetype
            : 'economyCycle';
        const base = Object.prototype.hasOwnProperty.call(CARD_MOVE_PLAN_ARCHETYPE_BASE, archetypeName)
            ? CARD_MOVE_PLAN_ARCHETYPE_BASE[archetypeName as keyof typeof CARD_MOVE_PLAN_ARCHETYPE_BASE]
            : CARD_MOVE_PLAN_ARCHETYPE_BASE.economyCycle;
        const next = Object.assign({ archetype: archetypeName }, base);
        for (const key of numericKeys) {
            if (!Object.prototype.hasOwnProperty.call(override, key)) continue;
            const overrideRecord = asRecord(override);
            const baseRecord = asRecord(base);
            const nextRecord = next as CpuPolicyMovePlanProfile;
            const value = Number(overrideRecord[key]);
            nextRecord[key] = Number.isFinite(value) ? value : Number(baseRecord[key] || 0);
        }
        profileByType[type] = Object.freeze(next);
    }
    return Object.freeze(profileByType);
}

const CARD_TYPE_MOVE_PLAN_PROFILE = buildCardTypeMovePlanProfile();

function chooseHighestCostCard(
    usableCardIds: CpuPolicyCardId[],
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef?: CpuPolicyCardDefinitionResolver
): CpuPolicyCardSelection | null {
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    const sorted = usableCardIds.slice().sort((a, b) => {
        const ca = typeof getCardCost === 'function' ? (getCardCost(a) || 0) : 0;
        const cb = typeof getCardCost === 'function' ? (getCardCost(b) || 0) : 0;
        return cb - ca;
    });
    const cardId = sorted[0];
    const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
    return { cardId, cardDef };
}

function isCornerRecoveryCardType(cardType: unknown): boolean {
    const normalizedType = String(cardType || '');
    if (!normalizedType) return false;
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isRecoveryCardType === 'function') {
        try {
            if (SharedCardHeuristics.isRecoveryCardType(normalizedType) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return CORNER_RECOVERY_CARD_TYPES.has(normalizedType);
}

function isCornerHoldCardType(cardType: unknown): boolean {
    const normalizedType = String(cardType || '');
    if (!normalizedType) return false;
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isHoldCardType === 'function') {
        try {
            if (SharedCardHeuristics.isHoldCardType(normalizedType) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return CORNER_HOLD_CARD_TYPES.has(normalizedType);
}

function isChargeRampCardType(cardType: unknown): boolean {
    const normalizedType = String(cardType || '');
    if (!normalizedType) return false;
    if (SharedCardHeuristics && typeof SharedCardHeuristics.isChargeRampCardType === 'function') {
        try {
            if (SharedCardHeuristics.isChargeRampCardType(normalizedType) === true) return true;
        } catch (e) { /* ignore */ }
    }
    return CHARGE_RAMP_CARD_TYPES.has(normalizedType);
}

function hasUsageStyleForCardType(cardType: unknown): boolean {
    return Object.prototype.hasOwnProperty.call(
        CARD_TYPE_USAGE_STYLE,
        String(cardType || '')
    );
}

function hasBaseScoreBonusForCardType(cardType: unknown): boolean {
    return Object.prototype.hasOwnProperty.call(
        CARD_TYPE_BASE_SCORE_BONUS,
        String(cardType || '')
    );
}

function hasMovePlanProfileForCardType(cardType: unknown): boolean {
    return Object.prototype.hasOwnProperty.call(
        CARD_TYPE_MOVE_PLAN_PROFILE,
        String(cardType || '')
    );
}

function getMovePlanProfileForCardType(cardType: unknown): CpuPolicyMovePlanProfile | null {
    const type = String(cardType || '');
    if (!Object.prototype.hasOwnProperty.call(CARD_TYPE_MOVE_PLAN_PROFILE, type)) return null;
    return CARD_TYPE_MOVE_PLAN_PROFILE[type] || null;
}

function getForcedHandDestroyReason(
    cardId: unknown,
    cardType: unknown,
    context: CpuPolicyCardContext | null | undefined,
    usableCardIdSet: Set<string> | null | undefined
): CpuPolicyForcedDestroyReason | null {
    const type = String(cardType || '').trim();
    if (!type) return null;
    if (IMMEDIATE_DESTROY_CARD_TYPES.has(type)) return 'bucket1_never_use';

    const ctx = asRecord(context);
    const ownCharge = isFiniteNumber(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
    const handSize = isFiniteNumber(ctx.handSize) ? Math.max(0, Math.floor(Number(ctx.handSize))) : 0;
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

function getForcedHandDestroyPriority(reason: unknown): number {
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

function buildBlockedCardUseDecision(
    cardId: CpuPolicyCardId,
    cardDef: CpuPolicyCardDefinition | null,
    cardType: string,
    cardCost: number,
    context: CpuPolicyCardContext | null | undefined,
    reason: unknown
): CpuPolicyCardScore {
    const ctx = asRecord(context);
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

function chooseForcedHandDestroyTarget(
    handCardIds: CpuPolicyCardId[],
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef: CpuPolicyCardDefinitionResolver,
    context: CpuPolicyCardContext | null | undefined,
    usableCardIdSet: Set<string> | null | undefined
): CpuPolicyCardScore | null {
    if (!Array.isArray(handCardIds) || handCardIds.length <= 0) return null;
    let best: (CpuPolicyCardScore & { cardCost: number; priority: number; reason: CpuPolicyForcedDestroyReason }) | null = null;

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
                score: Number.NEGATIVE_INFINITY,
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

function countBoardDiscsForPlayer(board: CpuPolicyBoard | null | undefined, playerValue: number): { own: number; opp: number; empties: number } {
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

function countBoardEdgeDiscsForPlayer(board: CpuPolicyBoard | null | undefined, playerValue: number): { ownEdges: number; oppEdges: number } {
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

function estimateOwnOppDiscs(discDiff: unknown, empties: unknown, totalCells: unknown): { own: number; opp: number; occupied: number; totalCells: number } {
    const safeTotalCells = isFiniteNumber(totalCells)
        ? Math.max(1, Math.floor(Number(totalCells)))
        : 64;
    const safeEmpties = isFiniteNumber(empties)
        ? Math.max(0, Math.min(safeTotalCells, Math.floor(Number(empties))))
        : 0;
    const occupied = safeTotalCells - safeEmpties;
    const safeDiscDiff = isFiniteNumber(discDiff) ? Number(discDiff) : 0;
    const rawOwn = Math.floor((occupied + safeDiscDiff) / 2);
    const own = Math.max(0, Math.min(occupied, rawOwn));
    const opp = Math.max(0, occupied - own);
    return { own, opp, occupied, totalCells: safeTotalCells };
}

function buildCardDecisionContext(context: CpuPolicyCardContext | null | undefined): CpuPolicyDecisionContext {
    const ctx = asRecord(context);
    const level = isFiniteNumber(ctx.level) ? Math.max(1, Math.floor(Number(ctx.level))) : 1;
    const playerValue = isFiniteNumber(ctx.playerValue)
        ? (Number(ctx.playerValue) >= 0 ? 1 : -1)
        : 1;
    const legalMovesCount = isFiniteNumber(ctx.legalMovesCount) ? Math.max(0, Math.floor(Number(ctx.legalMovesCount))) : 0;

    let discDiff = isFiniteNumber(ctx.discDiff) ? Number(ctx.discDiff) : 0;
    let empties: number | null = isFiniteNumber(ctx.empties) ? Math.max(0, Math.floor(Number(ctx.empties))) : null;
    let ownDiscs: number | null = isFiniteNumber(ctx.ownDiscs) ? Math.max(0, Math.floor(Number(ctx.ownDiscs))) : null;
    let oppDiscs: number | null = isFiniteNumber(ctx.oppDiscs) ? Math.max(0, Math.floor(Number(ctx.oppDiscs))) : null;
    let ownEdges: number | null = isFiniteNumber(ctx.ownEdges) ? Math.max(0, Math.floor(Number(ctx.ownEdges))) : null;
    let oppEdges: number | null = isFiniteNumber(ctx.oppEdges) ? Math.max(0, Math.floor(Number(ctx.oppEdges))) : null;
    let totalCells = isFiniteNumber(ctx.totalCells) ? Math.max(1, Math.floor(Number(ctx.totalCells))) : 64;
    if (Array.isArray(ctx.board)) {
        let cells = 0;
        for (let r = 0; r < ctx.board.length; r++) {
            const row = Array.isArray(ctx.board[r]) ? ctx.board[r] : [];
            cells += row.length;
        }
        if (cells > 0) totalCells = cells;
        const boardStat = countBoardDiscsForPlayer(ctx.board, playerValue);
        const edgeStat = countBoardEdgeDiscsForPlayer(ctx.board, playerValue);
        if (!isFiniteNumber(ctx.discDiff)) discDiff = boardStat.own - boardStat.opp;
        if (!isFiniteNumber(ctx.empties)) empties = boardStat.empties;
        if (!isFiniteNumber(ctx.ownDiscs)) ownDiscs = boardStat.own;
        if (!isFiniteNumber(ctx.oppDiscs)) oppDiscs = boardStat.opp;
        if (!isFiniteNumber(ctx.ownEdges)) ownEdges = edgeStat.ownEdges;
        if (!isFiniteNumber(ctx.oppEdges)) oppEdges = edgeStat.oppEdges;
    }
    if (!Number.isFinite(empties)) empties = 0;
    if (!Number.isFinite(ownDiscs) || !Number.isFinite(oppDiscs)) {
        const est = estimateOwnOppDiscs(discDiff, empties, totalCells);
        if (!Number.isFinite(ownDiscs)) ownDiscs = est.own;
        if (!Number.isFinite(oppDiscs)) oppDiscs = est.opp;
    }
    if (!Number.isFinite(ownEdges)) ownEdges = 0;
    if (!Number.isFinite(oppEdges)) oppEdges = 0;
    const normalizedEmpties = empties ?? 0;
    const normalizedOwnDiscs = ownDiscs ?? 0;
    const normalizedOppDiscs = oppDiscs ?? 0;
    const normalizedOwnEdges = ownEdges ?? 0;
    const normalizedOppEdges = oppEdges ?? 0;

    const ownCharge = isFiniteNumber(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
    const oppCharge = isFiniteNumber(ctx.oppCharge) ? Number(ctx.oppCharge) : 0;
    const oppHandSize = isFiniteNumber(ctx.oppHandSize) ? Math.max(0, Math.floor(Number(ctx.oppHandSize))) : 0;
    const handSize = isFiniteNumber(ctx.handSize) ? Math.max(0, Math.floor(Number(ctx.handSize))) : 0;
    const handCardIds = Array.isArray(ctx.handCardIds)
        ? ctx.handCardIds.map((id) => String(id || '').trim()).filter((id) => id.length > 0)
        : [];
    const deckRemaining = isFiniteNumber(ctx.deckRemaining)
        ? Math.max(0, Math.floor(Number(ctx.deckRemaining)))
        : null;
    const usableCardIds = Array.isArray(ctx.usableCardIds)
        ? ctx.usableCardIds.map((id) => String(id || '').trim()).filter((id) => id.length > 0)
        : [];
    const forceUseCard = !!ctx.forceUseCard || legalMovesCount <= 0;
    const ownCorners = isFiniteNumber(ctx.ownCorners) ? Number(ctx.ownCorners) : 0;
    const oppCorners = isFiniteNumber(ctx.oppCorners) ? Number(ctx.oppCorners) : 0;
    const hasCornerMoveNow = ctx.hasCornerMoveNow === true;
    const hasEdgeMoveNow = ctx.hasEdgeMoveNow === true;
    const cornerEmergency = ctx.cornerEmergency === true;
    const cornerHoldMode = ctx.cornerHoldMode === true;
    const recoveryCostGap = isFiniteNumber(ctx.recoveryCostGap) ? Math.max(0, Number(ctx.recoveryCostGap)) : 0;
    const highBonusMoveAvailable = ctx.highBonusMoveAvailable === true;
    const maxLegalFlips = isFiniteNumber(ctx.maxLegalFlips) ? Math.max(0, Math.floor(Number(ctx.maxLegalFlips))) : 0;
    const avgLegalFlips = isFiniteNumber(ctx.avgLegalFlips) ? Math.max(0, Number(ctx.avgLegalFlips)) : 0;
    const maxLegalGain = isFiniteNumber(ctx.maxLegalGain)
        ? Math.max(0, Number(ctx.maxLegalGain))
        : maxLegalFlips;
    const maxLegalBoardBonus = isFiniteNumber(ctx.maxLegalBoardBonus)
        ? Math.max(0, Number(ctx.maxLegalBoardBonus))
        : 0;
    const cloneSplitEligibleSourceCount = isFiniteNumber(ctx.cloneSplitEligibleSourceCount)
        ? Math.max(0, Math.floor(Number(ctx.cloneSplitEligibleSourceCount)))
        : null;
    const ownSpecialCount = isFiniteNumber(ctx.ownSpecialCount) ? Math.max(0, Math.floor(Number(ctx.ownSpecialCount))) : 0;
    const oppSpecialCount = isFiniteNumber(ctx.oppSpecialCount) ? Math.max(0, Math.floor(Number(ctx.oppSpecialCount))) : 0;
    const ownGuardCount = isFiniteNumber(ctx.ownGuardCount) ? Math.max(0, Math.floor(Number(ctx.ownGuardCount))) : 0;
    const oppGuardCount = isFiniteNumber(ctx.oppGuardCount) ? Math.max(0, Math.floor(Number(ctx.oppGuardCount))) : 0;
    const ownCornerResetCount = isFiniteNumber(ctx.ownCornerResetCount) ? Math.max(0, Math.floor(Number(ctx.ownCornerResetCount))) : 0;
    const oppCornerResetCount = isFiniteNumber(ctx.oppCornerResetCount) ? Math.max(0, Math.floor(Number(ctx.oppCornerResetCount))) : 0;
    const ownEdgeResetCount = isFiniteNumber(ctx.ownEdgeResetCount) ? Math.max(0, Math.floor(Number(ctx.ownEdgeResetCount))) : 0;
    const oppEdgeResetCount = isFiniteNumber(ctx.oppEdgeResetCount) ? Math.max(0, Math.floor(Number(ctx.oppEdgeResetCount))) : 0;
    const meteorBestCornerSwing = isFiniteNumber(ctx.meteorBestCornerSwing) ? Number(ctx.meteorBestCornerSwing) : 0;
    const meteorBestDestroyValue = isFiniteNumber(ctx.meteorBestDestroyValue) ? Number(ctx.meteorBestDestroyValue) : 0;
    const meteorHasCornerPromotion = ctx.meteorHasCornerPromotion === true;
    const meteorHasHighValueDestroy = ctx.meteorHasHighValueDestroy === true;
    let reserveChargeFloor = isFiniteNumber(ctx.reserveChargeFloor)
        ? Math.max(0, Math.floor(Number(ctx.reserveChargeFloor)))
        : (normalizedEmpties <= 12 ? 4 : (normalizedEmpties <= 30 ? 6 : 8));
    if (cornerEmergency) reserveChargeFloor = Math.max(2, reserveChargeFloor - 2);
    if (forceUseCard) reserveChargeFloor = 0;
    let minUseScore = Number.isFinite(ctx.minUseScore)
        ? Number(ctx.minUseScore)
        : (forceUseCard ? Number.NEGATIVE_INFINITY : (level >= 6 ? 18 : (level >= 4 ? 6 : -8)));
    const whiteLv6Mode = level >= 6 && playerValue < 0;
    const lowDiscEmergency = normalizedOwnDiscs <= Math.max(6, Math.floor(totalCells * 0.15));
    const criticalLowDiscEmergency = normalizedOwnDiscs <= 4;
    // Hand cap is 5. When hand gets saturated, lower the threshold to keep card cycle healthy.
    if (!forceUseCard) {
        if (handSize >= 5) minUseScore = Math.min(minUseScore, level >= 6 ? 4 : 0);
        else if (handSize >= 4) minUseScore = Math.min(minUseScore, level >= 6 ? 8 : 4);
        else if (handSize >= 3 && level >= 6) minUseScore = Math.min(minUseScore, 12);
        if (level >= 6 && ownCharge >= 24 && handSize >= 3) {
            minUseScore = Math.min(minUseScore, 10);
        }
        if (level >= 6 && ownCharge >= 36) {
            minUseScore = Math.min(minUseScore, 8);
        }
        if (level >= 6 && ctx.highBonusMoveAvailable === true && ownCharge >= 16) {
            minUseScore = Math.min(minUseScore, 9);
        }
        if (level >= 6 && legalMovesCount <= 2) {
            minUseScore = Math.min(minUseScore, 8);
        }
        if (whiteLv6Mode && (cornerEmergency || lowDiscEmergency || legalMovesCount <= 2)) {
            minUseScore = Math.min(minUseScore, 6);
        }
        if (whiteLv6Mode && criticalLowDiscEmergency) {
            minUseScore = Math.min(minUseScore, 2);
        }
        if (whiteLv6Mode && handSize >= 4) {
            minUseScore = Math.min(minUseScore, 6);
        }
        if (whiteLv6Mode && ownCharge >= 28 && handSize >= 3) {
            minUseScore = Math.min(minUseScore, 7);
        }
    }

    return {
        level,
        playerValue,
        legalMovesCount,
        discDiff,
        empties: normalizedEmpties,
        ownDiscs: normalizedOwnDiscs,
        oppDiscs: normalizedOppDiscs,
        ownEdges: normalizedOwnEdges,
        oppEdges: normalizedOppEdges,
        totalCells,
        ownCharge,
        oppCharge,
        oppHandSize,
        handSize,
        handCardIds,
        deckRemaining,
        usableCardIds,
        forceUseCard,
        minUseScore,
        ownCorners,
        oppCorners,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        cornerHoldMode,
        recoveryCostGap,
        reserveChargeFloor,
        highBonusMoveAvailable,
        maxLegalFlips,
        avgLegalFlips,
        maxLegalGain,
        maxLegalBoardBonus,
        cloneSplitEligibleSourceCount,
        ownSpecialCount,
        oppSpecialCount,
        ownGuardCount,
        oppGuardCount,
        ownCornerResetCount,
        oppCornerResetCount,
        ownEdgeResetCount,
        oppEdgeResetCount,
        meteorBestCornerSwing,
        meteorBestDestroyValue,
        meteorHasCornerPromotion,
        meteorHasHighValueDestroy,
        whiteLv6Mode,
        lowDiscEmergency,
        criticalLowDiscEmergency
    };
}

function scoreCardUseDecision(
    cardId: CpuPolicyCardId,
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef: CpuPolicyCardDefinitionResolver,
    context?: CpuPolicyCardContext
): CpuPolicyCardScore {
    const ctx = buildCardDecisionContext(context);
    const cardCost = typeof getCardCost === 'function' ? Number(getCardCost(cardId) || 0) : 0;
    const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
    const cardType = cardDef && typeof cardDef.type === 'string' ? cardDef.type : '';
    const isRecoveryCard = isCornerRecoveryCardType(cardType);
    const isHoldCard = isCornerHoldCardType(cardType);
    const isChargeRampCard = isChargeRampCardType(cardType);
    const isWorkWill = cardType === 'WORK_WILL';
    const isTimeBomb = cardType === 'TIME_BOMB';
    const isTimeStopGod = cardType === 'TIME_STOP_GOD';
    const isThrowChainCard = THROW_CHAIN_CARD_TYPES.includes(cardType);
    const isChainWill = CHAIN_WILL_CARD_TYPES.includes(cardType);
    const isLastResort = cardType === 'LAST_RESORT';
    const isEqualityWill = cardType === 'EQUALITY_WILL';
    const isReinforcementWill = cardType === 'REINFORCEMENT_WILL';
    const isFreePlacement = (cardType === 'FREE_PLACEMENT' || cardType === 'LAST_RESORT');
    const isSniperWill = cardType === 'SNIPER_WILL';
    const isStrongWindWill = cardType === 'STRONG_WIND_WILL';
    const isSwapWithEnemy = cardType === 'SWAP_WITH_ENEMY';
    const isPositionSwapWill = cardType === 'POSITION_SWAP_WILL';
    const isTemptWill = cardType === 'TEMPT_WILL' || cardType === 'CAPTURE_WILL';
    const isCloneWill = cardType === 'CLONE_WILL';
    const isBoardExpansionWill = (cardType === 'BOARD_EXPANSION_WILL' || cardType === 'BOARD_EXPANSION_GOD');
    const isBoardShrinkCard = (cardType === 'BOARD_SHRINK_WILL' || cardType === 'BOARD_SHRINK_GOD');
    const isTrapWill = cardType === 'TRAP_WILL';
    const isHeavenBlessing = cardType === 'HEAVEN_BLESSING';
    const isRevealHandWill = cardType === 'REVEAL_HAND_WILL';
    const isCondemnWill = cardType === 'CONDEMN_WILL';
    const isExecutionWill = cardType === 'EXECUTION_WILL';
    const isExtendLifeWill = cardType === 'EXTEND_LIFE_WILL';
    const isExtendLifeGod = cardType === 'EXTEND_LIFE_GOD';
    const isExtendLifeCard = isExtendLifeWill || isExtendLifeGod;
    const isRebuildWill = cardType === 'REBUILD_WILL';
    const isSupplyWill = cardType === 'SUPPLY_WILL';
    const isGoldStone = cardType === 'GOLD_STONE';
    const isCrystalStone = cardType === 'CRYSTAL_STONE';
    const isRainbowStone = cardType === 'RAINBOW_STONE';
    const isSilverStone = cardType === 'SILVER_STONE';
    const isPlunderWill = cardType === 'PLUNDER_WILL';
    const isTreasureBox = cardType === 'TREASURE_BOX';
    const isLossWill = cardType === 'LOSS_WILL';
    const isCorrosionWill = cardType === 'CORROSION_WILL';
    const isBlockadeWill = cardType === 'BLOCKADE_WILL';
    const isMeteorWill = cardType === 'METEOR_WILL';
    const isProtectedNextStone = cardType === 'PROTECTED_NEXT_STONE';
    const isAfterimageWill = cardType === 'AFTERIMAGE_WILL';
    const isGhostWill = cardType === 'GHOST_WILL';
    const isPermaProtectNextStone = cardType === 'PERMA_PROTECT_NEXT_STONE';
    const isGuardWill = cardType === 'GUARD_WILL';
    const isGuardianGod = cardType === 'GUARDIAN_GOD';
    const isRegenWill = cardType === 'REGEN_WILL';
    const isLightningWill = cardType === 'LIGHTNING_WILL';
    const isHyperactiveWill = cardType === 'HYPERACTIVE_WILL';
    const isInstantHyperactiveWill = cardType === 'INSTANT_HYPERACTIVE_WILL';
    const isTabooReverseWill = cardType === 'TABOO_REVERSE_WILL';
    const isCrossBomb = cardType === 'CROSS_BOMB';
    const isXBomb = cardType === 'X_BOMB';
    const isUltimateDestroyGod = cardType === 'ULTIMATE_DESTROY_GOD';
    const isUltimateHyperactiveGod = cardType === 'ULTIMATE_HYPERACTIVE_GOD';
    const isObserverWill = cardType === 'OBSERVER_WILL';
    const isDestroyDragonWill = cardType === 'DESTROY_DRAGON_WILL';
    const isBreedingWill = cardType === 'BREEDING_WILL';
    const isTeleportWill = cardType === 'TELEPORT_WILL';
    const isCellTeleportWill = cardType === 'CELL_TELEPORT_WILL';
    const isHyperactiveInheritWill = cardType === 'HYPERACTIVE_INHERIT_WILL';
    const isRobotVacuumWill = cardType === 'ROBOT_VACUUM_WILL';
    const isExtremeHyperactiveWill = cardType === 'EXTREME_HYPERACTIVE_WILL';
    const isGluttonousWill = cardType === 'GLUTTONOUS_WILL';
    const isBuoyancyWill = cardType === 'BUOYANCY_WILL' || cardType === 'SUPER_BUOYANCY_WILL';
    const isGravityWill = cardType === 'GRAVITY_WILL' || cardType === 'SUPER_GRAVITY_WILL';
    const isSuperCrushWill = isBuoyancyWill || isGravityWill;
    const isAnchorPlacementCard = (
        isProtectedNextStone ||
        isAfterimageWill ||
        isGhostWill ||
        isPermaProtectNextStone ||
        isLightningWill ||
        isHyperactiveWill ||
        isInstantHyperactiveWill ||
        isUltimateDestroyGod ||
        isUltimateHyperactiveGod
    );
    const isChargeSwingCard = (
        cardType === 'PLUNDER_WILL' ||
        cardType === 'GOLD_STONE' ||
        cardType === 'CRYSTAL_STONE' ||
        cardType === 'RAINBOW_STONE' ||
        cardType === 'SILVER_STONE'
    );
    const ownCorners = Number.isFinite(ctx.ownCorners) ? Number(ctx.ownCorners) : 0;
    const oppCorners = Number.isFinite(ctx.oppCorners) ? Number(ctx.oppCorners) : 0;
    const hasCornerMoveNow = ctx.hasCornerMoveNow === true;
    const hasEdgeMoveNow = ctx.hasEdgeMoveNow === true;
    const cornerEmergency = !!ctx.cornerEmergency || (oppCorners > ownCorners);
    const recoveryCostGap = Number.isFinite(ctx.recoveryCostGap) ? Math.max(0, Number(ctx.recoveryCostGap)) : 0;
    const highBonusMoveAvailable = ctx.highBonusMoveAvailable === true;
    const ownDiscs = Number.isFinite(ctx.ownDiscs) ? Math.max(0, Math.floor(ctx.ownDiscs)) : 0;
    const ownEdges = Number.isFinite(ctx.ownEdges) ? Math.max(0, Math.floor(ctx.ownEdges)) : 0;
    const oppEdges = Number.isFinite(ctx.oppEdges) ? Math.max(0, Math.floor(ctx.oppEdges)) : 0;
    const maxLegalFlips = Number.isFinite(ctx.maxLegalFlips) ? Math.max(0, Math.floor(ctx.maxLegalFlips)) : 0;
    const avgLegalFlips = Number.isFinite(ctx.avgLegalFlips) ? Math.max(0, Number(ctx.avgLegalFlips)) : 0;
    const maxLegalGain = Number.isFinite(ctx.maxLegalGain) ? Math.max(0, Number(ctx.maxLegalGain)) : maxLegalFlips;
    const maxLegalBoardBonus = Number.isFinite(ctx.maxLegalBoardBonus) ? Math.max(0, Number(ctx.maxLegalBoardBonus)) : 0;
    const cloneSplitEligibleSourceCount = Number.isFinite(ctx.cloneSplitEligibleSourceCount)
        ? Math.max(0, Math.floor(Number(ctx.cloneSplitEligibleSourceCount)))
        : null;
    const oppHandSize = Number.isFinite(ctx.oppHandSize) ? Math.max(0, Math.floor(ctx.oppHandSize)) : 0;
    const ownSpecialCount = Number.isFinite(ctx.ownSpecialCount) ? Math.max(0, Math.floor(ctx.ownSpecialCount)) : 0;
    const oppSpecialCount = Number.isFinite(ctx.oppSpecialCount) ? Math.max(0, Math.floor(ctx.oppSpecialCount)) : 0;
    const ownGuardCount = Number.isFinite(ctx.ownGuardCount) ? Math.max(0, Math.floor(ctx.ownGuardCount)) : 0;
    const oppGuardCount = Number.isFinite(ctx.oppGuardCount) ? Math.max(0, Math.floor(ctx.oppGuardCount)) : 0;
    const ownCornerResetCount = Number.isFinite(ctx.ownCornerResetCount) ? Math.max(0, Math.floor(ctx.ownCornerResetCount)) : 0;
    const oppCornerResetCount = Number.isFinite(ctx.oppCornerResetCount) ? Math.max(0, Math.floor(ctx.oppCornerResetCount)) : 0;
    const ownEdgeResetCount = Number.isFinite(ctx.ownEdgeResetCount) ? Math.max(0, Math.floor(ctx.ownEdgeResetCount)) : 0;
    const oppEdgeResetCount = Number.isFinite(ctx.oppEdgeResetCount) ? Math.max(0, Math.floor(ctx.oppEdgeResetCount)) : 0;
    const handCardIds: CpuPolicyCardId[] = Array.isArray(ctx.handCardIds) ? ctx.handCardIds.map((id) => String(id)) : [];
    const usableCardIds: CpuPolicyCardId[] = Array.isArray(ctx.usableCardIds) ? ctx.usableCardIds.map((id) => String(id)) : [];
    const usableCardIdSet = new Set(usableCardIds);
    const deckRemaining = Number.isFinite(ctx.deckRemaining) ? Math.max(0, Math.floor(Number(ctx.deckRemaining))) : null;
    let keepPriorityInHandCount = 0;
    let highVarianceInHandCount = 0;
    let fastRotateInHandCount = 0;
    let stabilityInHandCount = 0;
    for (const handId of handCardIds) {
        if (!handId || handId === cardId) continue;
        const handDef = typeof getCardDef === 'function' ? (getCardDef(handId) || null) : null;
        const handType = handDef && typeof handDef.type === 'string' ? handDef.type : '';
        if (!handType) continue;
        if (REBUILD_KEEP_PRIORITY_CARD_TYPES.has(handType)) keepPriorityInHandCount += 1;
        if (HIGH_VARIANCE_CARD_TYPES.has(handType)) highVarianceInHandCount += 1;
        if (WHITE_LV6_FAST_ROTATE_TYPES.has(handType)) fastRotateInHandCount += 1;
        if (STABILITY_CARD_TYPES.has(handType)) stabilityInHandCount += 1;
    }
    const edgeDiff = ownEdges - oppEdges;
    const cornerDiff = ownCorners - oppCorners;
    const ownAnchorResetWeight = (ownCornerResetCount * 2) + ownEdgeResetCount;
    const oppAnchorResetWeight = (oppCornerResetCount * 2) + oppEdgeResetCount;
    const lossEnemyAnchorPayoffIsModest = oppSpecialCount <= (ownSpecialCount + 1) && oppAnchorResetWeight <= ownAnchorResetWeight;
    const strategicDiff = Number(ctx.discDiff || 0) + (cornerDiff * 4) + edgeDiff;
    const handPressureLevel = Math.max(0, ctx.handSize - 2);
    const chargePressureLevel = ctx.ownCharge >= 40 ? 2 : (ctx.ownCharge >= 28 ? 1 : 0);
    const mobilityPressureLevel = ctx.legalMovesCount <= 1 ? 3 : (ctx.legalMovesCount <= 2 ? 2 : (ctx.legalMovesCount <= 3 ? 1 : 0));
    const cardCyclePressure = handPressureLevel + chargePressureLevel + mobilityPressureLevel;
    const openingPhase = ctx.empties >= 42;
    const midLatePhase = ctx.empties <= 28;
    const endgamePhase = ctx.empties <= 14;
    const leadStable = strategicDiff >= 8;
    const trailingHard = strategicDiff <= -10;
    const trailing = strategicDiff <= -6;
    const edgeEmergency = edgeDiff <= -3;
    const edgeControlMode = edgeDiff >= 3 && cornerDiff >= 0;
    const isStabilityCard = STABILITY_CARD_TYPES.has(cardType);
    const isSwingCard = SWING_CARD_TYPES.has(cardType);
    const isEdgeContestCard = EDGE_CONTEST_CARD_TYPES.has(cardType);
    const isLongHorizonCard = LONG_HORIZON_CARD_TYPES.has(cardType);
    const isCornerTimingCard = (
        isHoldCard ||
        isRecoveryCard ||
        isChargeRampCard ||
        isWorkWill ||
        isObserverWill ||
        isDestroyDragonWill ||
        isAnchorPlacementCard
    );
    const whiteLv6Mode = ctx.whiteLv6Mode === true || (ctx.level >= 6 && ctx.playerValue < 0);
    const lowDiscEmergency = ctx.lowDiscEmergency === true || ownDiscs <= 8;
    const criticalLowDiscEmergency = ctx.criticalLowDiscEmergency === true || ownDiscs <= 4;
    const isWhiteCornerSwingKeepCard = WHITE_LV6_CORNER_SWING_KEEP_TYPES.has(cardType);

    const forcedDestroyReason = getForcedHandDestroyReason(cardId, cardType, ctx, usableCardIdSet);
    if (forcedDestroyReason) {
        return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, forcedDestroyReason);
    }
    if (isLossWill && ownSpecialCount > 0 && lossEnemyAnchorPayoffIsModest) {
        return buildBlockedCardUseDecision(cardId, cardDef, cardType, cardCost, ctx, 'loss_will_own_special');
    }
    let score = cardCost * 2;
    if (Object.prototype.hasOwnProperty.call(CARD_TYPE_BASE_SCORE_BONUS, cardType)) {
        score += Number((CARD_TYPE_BASE_SCORE_BONUS as Readonly<Record<string, number>>)[cardType] || 0);
    }
    if (ctx.forceUseCard) score += 1000;
    if (ctx.legalMovesCount <= 1) score += 35;

    const remainingCharge = ctx.ownCharge - cardCost;
    const reserveGap = Number.isFinite(ctx.reserveChargeFloor)
        ? Math.max(0, Number(ctx.reserveChargeFloor) - remainingCharge)
        : 0;
    const lowFlipMargin = maxLegalFlips <= 2;
    const lowGainMargin = maxLegalGain <= 2;
    const resourceTight = !ctx.forceUseCard && remainingCharge <= Math.max(6, ctx.reserveChargeFloor + 2);
    const setupBudgetTight = whiteLv6Mode && resourceTight && !cornerEmergency && !criticalLowDiscEmergency;
    if (ctx.level >= 6 && isCloneWill && cloneSplitEligibleSourceCount === 0) {
        return {
            cardId,
            cardDef,
            cardType,
            cardCost,
            score: -1000000,
            shouldUse: false,
            minUseScore: ctx.minUseScore
        };
    }
    const highYieldChargeRecovery = (
        ((isGoldStone || isRainbowStone || isSilverStone) &&
            maxLegalFlips >= 3 &&
            maxLegalGain >= 3) ||
        (isCrystalStone && maxLegalBoardBonus >= 2) ||
        (isPlunderWill &&
            maxLegalFlips >= 3 &&
            maxLegalGain >= 3 &&
            Number.isFinite(ctx.oppCharge) &&
            Number(ctx.oppCharge) >= 3)
    );
    if (!ctx.forceUseCard && reserveGap > 0) {
        let reservePenalty = reserveGap * 26;
        if (isChargeRampCard && !isWorkWill) reservePenalty *= 0.45;
        if (highYieldChargeRecovery) reservePenalty *= 0.25;
        if (isHoldCard || isRecoveryCard) reservePenalty *= 0.35;
        if (cornerEmergency && (isHoldCard || isRecoveryCard || isTimeBomb || isTimeStopGod)) reservePenalty *= 0.25;
        score -= reservePenalty;
    }

    const counterThreatHigh = (
        (Number.isFinite(ctx.oppCharge) && Number(ctx.oppCharge) >= 20) ||
        oppSpecialCount >= (ownSpecialCount + 2) ||
        (cornerEmergency && !hasCornerMoveNow)
    );
    if (
        whiteLv6Mode &&
        !ctx.forceUseCard &&
        counterThreatHigh &&
        recoveryCostGap > 0 &&
        !isRecoveryCard &&
        !isHoldCard &&
        !isChargeRampCard &&
        !highYieldChargeRecovery &&
        !isWhiteCornerSwingKeepCard
    ) {
        score -= 34;
        if (isChargeSwingCard || isTreasureBox || isSupplyWill || isRebuildWill) score -= 18;
    }

    if (ctx.discDiff >= 10) score -= 20;
    if (ctx.discDiff >= 16) score -= 15;
    if (ctx.discDiff <= -8) score += 20;
    if (ctx.discDiff <= -14) score += 20;

    if (ctx.empties <= 12) {
        if (ctx.discDiff > 0) score -= 25;
        else score += 12;
    }

    if (ctx.ownCharge <= (cardCost + 2)) score -= 8;
    if (ctx.ownCharge >= (cardCost + 10)) score += 10;
    if (ctx.ownCharge >= (cardCost + 16)) score += 12;
    if (ctx.ownCharge >= 28 && ctx.handSize >= 3 && !cornerEmergency) score += 14;
    if (ctx.handSize >= 5) score += 30;
    else if (ctx.handSize >= 4) score += 14;
    if (ctx.handSize >= 4 && cardCost <= 8 && !HIGH_VARIANCE_CARD_TYPES.has(cardType)) score += 10;

    if (whiteLv6Mode && !ctx.forceUseCard) {
        if (recoveryCostGap > 0 && !isRecoveryCard && !isHoldCard && !isChargeRampCard && !isWhiteCornerSwingKeepCard) {
            score -= Math.min(84, recoveryCostGap * 8);
        }
        if (recoveryCostGap > 0 && highYieldChargeRecovery) {
            score += Math.min(72, recoveryCostGap * 10);
        }
        if ((cornerEmergency || !hasCornerMoveNow) && isWhiteCornerSwingKeepCard) score += 42;
        if (!cornerEmergency && !hasCornerMoveNow && isWhiteCornerSwingKeepCard) score -= 34;
        if (lowDiscEmergency && (isSwingCard || isRecoveryCard || isHoldCard || isWhiteCornerSwingKeepCard)) score += 38;
        if (
            criticalLowDiscEmergency &&
            (
                isRecoveryCard ||
                isHoldCard ||
                isEdgeContestCard ||
                isFreePlacement ||
                isChargeSwingCard ||
                isChargeRampCard ||
                isBlockadeWill ||
                isStrongWindWill ||
                isSwapWithEnemy ||
                isPositionSwapWill ||
                isTemptWill ||
                isBoardExpansionWill ||
                isBoardShrinkCard ||
                isTeleportWill ||
                isCellTeleportWill ||
                isDestroyDragonWill ||
                isSuperCrushWill ||
                isObserverWill ||
                isWorkWill
            )
        ) score += 138;
        if ((isThrowChainCard || isChainWill) && !cornerEmergency) score -= 180;
        if (cardCyclePressure > 0 && (isStabilityCard || isChargeRampCard || isChargeSwingCard || isEdgeContestCard || isWorkWill || isObserverWill || isDestroyDragonWill || isRebuildWill)) {
            score += cardCyclePressure * 8;
        }
        if (cardCyclePressure >= 3 && cardCost <= 10 && !HIGH_VARIANCE_CARD_TYPES.has(cardType)) {
            score += 18;
        }
        if (mobilityPressureLevel >= 2 && (isRecoveryCard || isHoldCard || isEdgeContestCard || isChargeSwingCard || isChargeRampCard || isWorkWill || isObserverWill)) {
            score += 16;
        }
        if (ctx.handSize >= 4 && ctx.ownCharge >= 20 && !HIGH_VARIANCE_CARD_TYPES.has(cardType)) {
            score += 12;
        }
        if (ctx.handSize >= 5 && (isChargeSwingCard || isChargeRampCard || isRebuildWill)) {
            score += 18;
        }
        if (
            mobilityPressureLevel >= 2 &&
            ((maxLegalFlips >= 4 && (isGoldStone || isRainbowStone || isSilverStone)) ||
                (maxLegalBoardBonus >= 2 && isCrystalStone) ||
                isGluttonousWill)
        ) {
            score += 84;
        }
        if (lowDiscEmergency && highYieldChargeRecovery) {
            score += 42;
        }
        if (
            (mobilityPressureLevel >= 2 || criticalLowDiscEmergency) &&
            WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES.has(cardType) &&
            !isWhiteCornerSwingKeepCard
        ) {
            score -= 72;
        }
    }

    if (HIGH_VARIANCE_CARD_TYPES.has(cardType)) {
        score -= 22;
        if (ctx.discDiff >= 0) score -= 18;
        if (ctx.empties <= 18) score -= 10;
        if (ctx.discDiff <= -12) score += 14;
    }

    if (DEFENSIVE_CARD_TYPES.has(cardType)) {
        score += 12;
        if (ctx.discDiff >= 0) score += 10;
        if (ctx.empties <= 16) score += 6;
    }

    if (cardCost >= 20 && ctx.discDiff >= 0 && ctx.empties <= 20) score -= 16;
    if (cardCost <= 4 && DEFENSIVE_CARD_TYPES.has(cardType) && ctx.discDiff >= 0) score += 8;

    if (!ctx.forceUseCard) {
        if (leadStable) {
            if (isStabilityCard) score += midLatePhase ? 24 : 14;
            if (isSwingCard) score -= 24;
            if (HIGH_VARIANCE_CARD_TYPES.has(cardType)) score -= 10;
            if (endgamePhase && isLongHorizonCard) score -= 58;
            if (cornerDiff >= 1 && edgeDiff >= 1 && isHoldCard) score += 18;
        }

        if (trailing) {
            if (isSwingCard) score += trailingHard ? 56 : 30;
            if (isEdgeContestCard) score += edgeEmergency ? 36 : 14;
            if (isRecoveryCard && (cornerDiff < 0 || !hasCornerMoveNow)) score += 26;
            if (isStabilityCard && !cornerEmergency && !hasCornerMoveNow) score -= 14;
            if (isChargeRampCard && ctx.ownCharge <= 16 && ctx.handSize >= 3) score += 12;
        }

        if (edgeEmergency) {
            if (isEdgeContestCard) score += 30;
            if (isHoldCard && !cornerEmergency && !hasCornerMoveNow) score -= 18;
            if (isStabilityCard && !isEdgeContestCard && !cornerEmergency) score -= 24;
            if (ctx.legalMovesCount <= 2 && isEdgeContestCard) score += 16;
        } else if (edgeControlMode && ctx.discDiff >= 0) {
            if (isStabilityCard) score += 12;
            if (isSwingCard && !cornerEmergency) score -= 10;
        }

        if (openingPhase && cornerEmergency && isLongHorizonCard) score -= 20;
    }

    const style = Object.prototype.hasOwnProperty.call(CARD_TYPE_USAGE_STYLE, cardType)
        ? CARD_TYPE_USAGE_STYLE[cardType]
        : null;
    if (style && !ctx.forceUseCard) {
        if (leadStable) score += Number(style.leadBias || 0);
        if (trailing) score += Number(style.trailingBias || 0);
        if (openingPhase) score += Number(style.openingBias || 0);
        if (!openingPhase && !endgamePhase) score += Number(style.midLateBias || 0);
        if (endgamePhase) score += Number(style.endgameBias || 0);
        if (hasCornerMoveNow) score += Number(style.cornerNowBias || 0);
        if (cornerEmergency) score += Number(style.cornerEmergencyBias || 0);
        if (edgeEmergency) score += Number(style.edgeEmergencyBias || 0);
        if (ctx.legalMovesCount <= 2) score += Number(style.lowMobilityBias || 0);
        if (ctx.handSize >= 4) score += Number(style.handPressureBias || 0);
    }

    if (isRecoveryCard) {
        score -= 18;
        if (!cornerEmergency && !ctx.forceUseCard) score -= 75;
        if (cornerEmergency) score += 65;
    }

    if (isHoldCard) {
        if (hasCornerMoveNow) score += 110;
        if (!hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 20;
    }

    if (hasCornerMoveNow && !isHoldCard && !ctx.forceUseCard) {
        score -= 28;
        // When corner is available, strongly discourage off-plan card usage.
        if (!isCornerTimingCard) score -= 52;
        if (isSwingCard || HIGH_VARIANCE_CARD_TYPES.has(cardType)) score -= 34;
        if (ctx.discDiff >= 0 && remainingCharge <= (ctx.reserveChargeFloor + 4)) score -= 24;
    }
    if (hasCornerMoveNow && !ctx.forceUseCard) {
        score -= 160;
        if (whiteLv6Mode && !criticalLowDiscEmergency) {
            score -= 120;
        }
        if (isHoldCard || isGuardWill || isGuardianGod || isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isRegenWill) {
            score -= 220;
        }
    }
    if (
        !ctx.forceUseCard &&
        whiteLv6Mode &&
        !cornerEmergency &&
        remainingCharge <= Math.max(6, ctx.reserveChargeFloor + 1) &&
        !criticalLowDiscEmergency &&
        !isRecoveryCard &&
        !isWhiteCornerSwingKeepCard
    ) {
        score -= 180;
        if (isHoldCard || isGuardWill || isGuardianGod || isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isRegenWill) {
            score -= 120;
        }
    }

    if (!hasCornerMoveNow && hasEdgeMoveNow && isHoldCard) {
        score += 8;
    }

    if (isChargeRampCard && !isWorkWill) {
        if (recoveryCostGap > 0) score += Math.min(40, recoveryCostGap * 2);
        if (highBonusMoveAvailable) score += 18;
        if (highBonusMoveAvailable && ctx.ownCharge >= 18) score += 22;
        if (ctx.discDiff >= 8 && !cornerEmergency && !ctx.forceUseCard) score -= 34;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 46;
        if (ctx.discDiff <= -10 && cornerEmergency) score += 20;
        if (ctx.handSize >= 4 && ctx.ownCharge <= 16) score += 8;
    }

    if (isChargeSwingCard) {
        score -= 10;
        if (cornerEmergency && recoveryCostGap > 0) score += 34;
        if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 26;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 22;
        if (ctx.handSize >= 4) score += 10;
    }

    // Charge ROI cards should be evaluated by
    // expected immediate gain from currently available legal moves.
    if (isGoldStone || isRainbowStone || isSilverStone) {
        const multiplier = isRainbowStone ? 6 : (isGoldStone ? 4 : 3);
        const gross = maxLegalGain * multiplier;
        const net = gross - cardCost;
        score -= 12;
        score += net * 6;
        if (maxLegalFlips < 3 && !ctx.forceUseCard) {
            score -= isRainbowStone ? 280 : 320;
            if (whiteLv6Mode) score -= 140;
            if (setupBudgetTight) score -= 72;
        }
        if (maxLegalGain <= 1) score -= 180;
        else if (maxLegalGain <= 2) {
            score -= 90;
            if (whiteLv6Mode && setupBudgetTight) score -= 48;
        }
        if (maxLegalFlips >= 3) score += isRainbowStone ? 148 : 112;
        if (hasCornerMoveNow) score += 22;
        if (cornerEmergency && maxLegalGain <= 2) score -= 55;
        if (endgamePhase && maxLegalGain <= 2) score -= 55;
        if (criticalLowDiscEmergency && maxLegalFlips >= 3) score += 48;
    }

    if (isCrystalStone) {
        const multiplier = 2;
        const gross = maxLegalBoardBonus * multiplier;
        const net = gross - cardCost;
        score -= 18;
        score += net * 7;
        if (maxLegalBoardBonus <= 0 && !ctx.forceUseCard) {
            score -= 360;
            if (whiteLv6Mode) score -= 160;
            if (setupBudgetTight) score -= 72;
        } else if (maxLegalBoardBonus === 1) {
            score -= 180;
            if (whiteLv6Mode && setupBudgetTight) score -= 48;
        } else if (maxLegalBoardBonus === 2) {
            score -= 260;
            if (whiteLv6Mode) score -= 60;
            if (cornerEmergency) score -= 48;
            if (openingPhase) score -= 24;
        } else if (maxLegalBoardBonus >= 3) {
            score += 132;
        } else {
            score += 72;
        }
        if (highBonusMoveAvailable) score += 24;
        if (cornerEmergency && maxLegalBoardBonus <= 1) score -= 55;
        if (endgamePhase && maxLegalBoardBonus <= 1) score -= 45;
        if (criticalLowDiscEmergency && maxLegalBoardBonus >= 2) score += 42;
    }

    if (isPlunderWill) {
        const siphon = Math.min(Math.max(0, Math.floor(ctx.oppCharge || 0)), maxLegalFlips);
        score -= 8;
        score += (siphon - cardCost) * 8;
        if (avgLegalFlips >= 2.5) score += 10;
        if (maxLegalFlips < 3 && !ctx.forceUseCard) {
            score -= 240;
            if (whiteLv6Mode) score -= 150;
            if (setupBudgetTight) score -= 72;
        }
        if (siphon <= 1) score -= 120;
        else if (siphon <= 2) {
            score -= 70;
            if (whiteLv6Mode && setupBudgetTight) score -= 54;
        }
        if (siphon >= 3) score += 44;
        if (cornerEmergency && siphon <= 2) score -= 30;
    }

    if (isTreasureBox) {
        score += 12;
        if (ctx.ownCharge <= 8) score += 16;
        if (ctx.handSize >= 4) score += 8;
        if (leadStable && hasCornerMoveNow && !ctx.forceUseCard) score -= 6;
    }

    if (isSupplyWill) {
        score += 10;
        if (ctx.handSize <= 1) score += 90;
        else if (ctx.handSize === 2) score += 72;
        else if (ctx.handSize === 3) score += 34;
        else if (ctx.handSize >= 5) score -= 150;
        else if (ctx.handSize >= 4) score -= 26;

        if (usableCardIds.length <= 1 && ctx.handSize <= 3) score += 18;
        if (openingPhase) score += 22;
        if (midLatePhase) score += 8;
        if (endgamePhase) score -= 80;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 26;
        if (leadStable && ctx.handSize >= 4 && !ctx.forceUseCard) score -= 18;
        if (cardCyclePressure >= 2 && ctx.handSize <= 3) score += 18;

        if (deckRemaining !== null) {
            if (deckRemaining <= 1) score -= 180;
            else if (deckRemaining <= 2) score -= 96;
            else if (deckRemaining <= 4) score -= 28;
            else if (deckRemaining >= 8 && ctx.handSize <= 2) score += 16;
        }
    }

    // FREE_PLACEMENT is strongest when legal mobility is poor and corner access is denied.
    if (isFreePlacement) {
        score -= 20;
        if (ctx.legalMovesCount <= 1) score += 95;
        if (!hasCornerMoveNow && cornerEmergency) score += 75;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 80;
        if (ctx.discDiff >= 6 && !ctx.forceUseCard) score -= 55;
    }

    // SNIPER_WILL is long-horizon: prefer stable deployment (corner/edge) and avoid panic waste.
    if (isSniperWill) {
        score -= 30;
        if (hasCornerMoveNow) score += 90;
        else if (hasEdgeMoveNow) score += 35;
        else score -= 95;
        if (ctx.empties <= 16) score -= 55;
        if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 45;
    }

    if (isStrongWindWill) {
        score -= 12;
        if (cornerEmergency) score += 54;
        if (trailingHard) score += 68;
        else if (trailing) score += 30;
        if (edgeEmergency) score += 26;
        if (ctx.legalMovesCount <= 1 && edgeDiff < 0 && hasEdgeMoveNow && !cornerEmergency) score += 18;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 46;
        if (leadStable && !ctx.forceUseCard) score -= 78;
        if (endgamePhase && leadStable) score -= 28;
    }

    if (isSwapWithEnemy || isPositionSwapWill) {
        score -= isPositionSwapWill ? 16 : 10;
        if (cornerEmergency) score += isPositionSwapWill ? 62 : 54;
        if (trailingHard) score += isPositionSwapWill ? 78 : 62;
        else if (trailing) score += isPositionSwapWill ? 34 : 26;
        if (edgeEmergency) score += 26;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 42;
        if (leadStable && !ctx.forceUseCard) score -= isPositionSwapWill ? 86 : 72;
        if (endgamePhase && leadStable) score -= 30;
    }

    if (isTemptWill) {
        score -= 8;
        if (cornerEmergency) score += 42;
        if (trailingHard) score += 58;
        else if (trailing) score += 24;
        if (edgeEmergency) score += 18;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 38;
        if (leadStable && !ctx.forceUseCard) score -= 62;
        if (endgamePhase && leadStable) score -= 26;
        if (oppSpecialCount <= 0) score -= 180;
        else if (oppSpecialCount <= 1 && !cornerEmergency) score -= 42;
    }

    if (isCloneWill) {
        score -= 42;
        if (ctx.discDiff >= 6 && ownCorners >= oppCorners && maxLegalFlips >= 3 && !setupBudgetTight) score += 35;
        if (cornerEmergency && !ctx.forceUseCard) score -= 70;
        if (ctx.empties <= 14) score -= 45;
        if (lowFlipMargin && !ctx.forceUseCard) score -= 88;
        if (lowGainMargin && !cornerEmergency) score -= 42;
        if (setupBudgetTight) score -= 84;
        if (ctx.handSize <= 2 && !trailingHard) score -= 46;
        if (!hasCornerMoveNow && !hasEdgeMoveNow && !cornerEmergency) score -= 30;
        if (leadStable && !cornerEmergency && !ctx.forceUseCard && lowFlipMargin) score -= 36;
    }

    if (isThrowChainCard) {
        score -= 26;
        if (trailingHard || cornerEmergency) score += 84;
        else if (trailing) score += 32;
        if (ctx.legalMovesCount <= 2) score += 18;
        if (ctx.handSize >= 4) score += 14;
        if (ctx.ownCharge < 70 && !cornerEmergency && !trailingHard) score -= 120;
        if (ctx.ownCharge >= 70 && (ctx.discDiff >= 0 || endgamePhase)) score += 46;
        if (maxLegalGain <= 3 && !cornerEmergency) score -= 34;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 54;
        if (leadStable && !ctx.forceUseCard) score -= 108;
        if (endgamePhase) score -= 66;
    }

    if (isChainWill) {
        score -= 20;
        if (trailingHard || cornerEmergency) score += 76;
        else if (trailing) score += 34;
        if (ctx.legalMovesCount <= 2) score += 26;
        if (maxLegalFlips >= 4) score += 18;
        if (ctx.ownCharge < 70 && !cornerEmergency && !trailingHard) score -= 104;
        if (ctx.ownCharge >= 70 && (ctx.discDiff >= 0 || endgamePhase)) score += 40;
        if (maxLegalGain <= 3 && maxLegalFlips <= 3 && !cornerEmergency) score -= 42;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 52;
        if (leadStable && !ctx.forceUseCard) score -= 96;
        if (endgamePhase) score -= 58;
    }

    if (isBoardExpansionWill) {
        score -= cardType === 'BOARD_EXPANSION_GOD' ? 58 : 42;
        if (ctx.handSize >= 4) score += 18;
        if (ctx.ownCharge >= 28) score += 12;
        if (ctx.legalMovesCount <= 2) score += 14;
        if (cornerEmergency && ctx.discDiff <= -8) score += 96;
        if (ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 86;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 30;
        if (ctx.empties <= 18) score -= cardType === 'BOARD_EXPANSION_GOD' ? 72 : 48;
    }

    if (isBoardShrinkCard) {
        score -= cardType === 'BOARD_SHRINK_GOD' ? 82 : 56;
        if (cornerEmergency) score += cardType === 'BOARD_SHRINK_GOD' ? 126 : 92;
        if (trailingHard) score += cardType === 'BOARD_SHRINK_GOD' ? 144 : 108;
        else if (trailing) score += cardType === 'BOARD_SHRINK_GOD' ? 62 : 38;
        if (edgeEmergency) score += 34;
        if (leadStable && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 190 : 150;
        if (ctx.discDiff >= 0 && !cornerEmergency && !ctx.forceUseCard) score -= 88;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 42;
        if (endgamePhase && leadStable) score -= 64;
        if (ctx.ownCharge <= (cardCost + 8) && !ctx.forceUseCard) score -= 76;
    }

    if (isTrapWill) {
        score += 8;
        if (cornerEmergency || ctx.discDiff <= -6) score += 35;
        if (ctx.discDiff >= 10 && !ctx.forceUseCard) score -= 35;
        if (hasCornerMoveNow && !ctx.forceUseCard) score -= 18;
        if (!cornerEmergency && !edgeEmergency && ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 84;
        if (endgamePhase && !cornerEmergency) score -= 32;
    }

    if (isHeavenBlessing) {
        score += 20;
        if (openingPhase) score += 34;
        if (midLatePhase && !endgamePhase) score += 12;
        if (endgamePhase) score -= 150;
        if (ctx.handSize >= 5) score -= 220;
        else if (ctx.handSize >= 4) score -= 90;
        else if (ctx.handSize <= 2) score += 32;
        if (deckRemaining != null) {
            if (deckRemaining <= 2) score -= 140;
            else if (deckRemaining <= 4) score -= 48;
            else if (deckRemaining >= 8 && ctx.handSize <= 2) score += 18;
        }
        if (cornerEmergency && recoveryCostGap > 0) score += 26;
        if (cardCyclePressure >= 2 && ctx.handSize <= 3) score += 20;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 22;
        if (keepPriorityInHandCount >= 2) score -= 18;
    }

    if (isRevealHandWill) {
        score += 10 + (oppHandSize * 8);
        if (oppHandSize >= 4) score += 24;
        else if (oppHandSize <= 1) score -= 110;
        else if (oppHandSize <= 2 && !cornerEmergency) score -= 28;
        if (openingPhase) score += 18;
        if (midLatePhase && !endgamePhase) score += 10;
        if (cornerEmergency || trailingHard) score += 18;
        else if (trailing) score += 8;
        if (leadStable && oppHandSize <= 2 && !ctx.forceUseCard) score -= 24;
        if (hasCornerMoveNow && !cornerEmergency && oppHandSize <= 2 && !ctx.forceUseCard) score -= 14;
        if (ctx.handSize >= 4) score += 4;
        if (endgamePhase) score -= 44;
    }

    if (isCondemnWill) {
        score += 8 + (oppHandSize * 14);
        if (oppHandSize >= 4) score += 38;
        else if (oppHandSize <= 1) score -= 120;
        else if (oppHandSize <= 2 && !cornerEmergency) score -= 38;
        if (cornerEmergency || trailingHard) score += 34;
        else if (trailing) score += 14;
        if (leadStable && oppHandSize <= 2 && !ctx.forceUseCard) score -= 34;
        if (hasCornerMoveNow && !cornerEmergency && oppHandSize <= 2 && !ctx.forceUseCard) score -= 18;
        if (ctx.handSize >= 4) score += 8;
        if (endgamePhase && oppHandSize <= 1) score -= 30;
    }

    if (isExecutionWill) {
        score += 16 + (oppHandSize * 18);
        if (oppHandSize >= 4) score += 30;
        else if (oppHandSize <= 1) score -= 96;
        else if (oppHandSize <= 2 && !cornerEmergency) score -= 24;
        if (cornerEmergency || trailingHard) score += 30;
        else if (trailing) score += 16;
        if (leadStable && oppHandSize <= 2 && !ctx.forceUseCard) score -= 24;
        if (hasCornerMoveNow && !cornerEmergency && oppHandSize <= 2 && !ctx.forceUseCard) score -= 12;
        if (ctx.handSize >= 4) score += 6;
        if (endgamePhase && oppHandSize <= 1) score -= 20;
    }

    if (isExtendLifeCard) {
        score += 16 + (ownSpecialCount * 12);
        if (ctx.empties >= 22 && ctx.empties <= 42) score += 12;
        if (midLatePhase) score += 8;
        if (endgamePhase) score -= 72;
        if (hasCornerMoveNow) score += 36;
        else if (hasEdgeMoveNow) score += 16;
        if (leadStable) score += 18;
        if (cornerEmergency && !hasCornerMoveNow) score -= 34;
        if (ownSpecialCount <= 1 && endgamePhase) score -= 28;
        if (isExtendLifeGod) {
            score += 28 + (ownSpecialCount * 10);
            if (midLatePhase) score += 8;
            if (endgamePhase) score -= 36;
            if (leadStable) score += 12;
        }
    }

    if (isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isGuardWill || isGuardianGod || isRegenWill) {
        score += 10;
        if (hasCornerMoveNow) score += 70;
        else if (hasEdgeMoveNow) score += 26;
        else if (!ctx.forceUseCard) score -= 62;
        if (cornerEmergency && !hasCornerMoveNow) score -= 36;
        if (leadStable && (hasCornerMoveNow || hasEdgeMoveNow)) score += 20;
        if (endgamePhase && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 42;
    }

    if (isLightningWill) {
        score -= 26;
        if (hasCornerMoveNow) score += 120;
        else if (hasEdgeMoveNow) score += 36;
        else score -= 140;
        if (cornerEmergency && !hasCornerMoveNow) score -= 54;
        if (trailingHard) score += 42;
        else if (trailing) score += 16;
        if (leadStable && !cornerEmergency && !ctx.forceUseCard) score -= 90;
        if (endgamePhase) score -= 96;
    }

    if (isHyperactiveWill || isInstantHyperactiveWill) {
        score -= isInstantHyperactiveWill ? 56 : 34;
        if (trailingHard || cornerEmergency) score += isInstantHyperactiveWill ? 86 : 58;
        else if (trailing) score += isInstantHyperactiveWill ? 28 : 20;
        if (hasCornerMoveNow && !cornerEmergency) score += 16;
        if (leadStable && !ctx.forceUseCard) score -= isInstantHyperactiveWill ? 132 : 88;
        if (endgamePhase) score -= isInstantHyperactiveWill ? 90 : 62;
    }

    if (isTabooReverseWill) {
        score -= 110;
        if (hasCornerMoveNow) score += 168;
        if (cornerEmergency) score += 92;
        if (trailingHard) score += 78;
        else if (trailing) score += 30;
        if (leadStable && !cornerEmergency && !ctx.forceUseCard) score -= 180;
        if (endgamePhase && ctx.discDiff >= 0) score -= 120;
        if (ctx.ownCharge <= (cardCost + 6) && !ctx.forceUseCard) score -= 75;
        if (ctx.legalMovesCount <= 1) score += 32;
    }

    if (isCrossBomb || isXBomb) {
        score -= 36;
        if (trailingHard || cornerEmergency) score += 76;
        else if (trailing) score += 24;
        if (edgeEmergency) score += 20;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 36;
        if (leadStable && !ctx.forceUseCard) score -= 96;
        if (endgamePhase) score -= 82;
    }

    if (isUltimateDestroyGod) {
        score -= 64;
        if (hasCornerMoveNow) score += 132;
        else if (hasEdgeMoveNow) score += 44;
        else score -= 66;
        if (trailingHard) score += 96;
        else if (trailing) score += 38;
        if (cornerEmergency && !hasCornerMoveNow) score -= 24;
        if (leadStable && !cornerEmergency && !ctx.forceUseCard) score -= 110;
        if (endgamePhase) score -= 95;
    }

    if (isUltimateHyperactiveGod) {
        score -= 96;
        if (trailingHard) score += 136;
        else if (trailing) score += 52;
        if (cornerEmergency) score += 34;
        if (hasCornerMoveNow && !cornerEmergency) score += 18;
        if (leadStable && !ctx.forceUseCard) score -= 188;
        if (endgamePhase) score -= 190;
        if (ctx.ownCharge <= (cardCost + 10) && !ctx.forceUseCard) score -= 46;
    }

    if (isObserverWill) {
        score -= 8;
        if (openingPhase) score += 44;
        if (midLatePhase) score += 18;
        if (endgamePhase) score -= 64;
        if (hasCornerMoveNow) score += 28;
        else if (hasEdgeMoveNow) score += 18;
        else score -= 18;
        if (cornerEmergency && !hasCornerMoveNow) score -= 42;
        if (leadStable && (hasCornerMoveNow || hasEdgeMoveNow)) score += 16;
        if (ctx.handSize >= 4 && cardCyclePressure >= 1) score += 8;
    }

    if (isDestroyDragonWill) {
        score -= 10;
        if (hasCornerMoveNow) score += 110;
        else if (hasEdgeMoveNow) score += 54;
        else score -= 58;
        if (cornerEmergency && !hasCornerMoveNow) score -= 42;
        if (ctx.discDiff <= -8) score += 34;
        if (ctx.empties <= 12) score -= 62;
        if (leadStable && hasCornerMoveNow) score += 28;
        if (leadStable && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 26;
    }

    if (isBreedingWill) {
        score -= 24;
        if (openingPhase) score += 30;
        if (midLatePhase && !endgamePhase) score += 18;
        if (hasCornerMoveNow) score += 42;
        else if (hasEdgeMoveNow) score += 18;
        else score -= 28;
        if (cornerEmergency && !hasCornerMoveNow) score -= 44;
        if (trailingHard) score += 28;
        else if (trailing) score += 12;
        if (leadStable && !ctx.forceUseCard) score -= 42;
        if (endgamePhase) score -= 104;
    }

    if (isTeleportWill) {
        score -= 22;
        if (cornerEmergency || trailingHard) score += 110;
        else if (trailing) score += 34;
        if (oppCorners > ownCorners) score += 42;
        if (leadStable && oppCorners <= ownCorners && !ctx.forceUseCard) score -= 120;
        if (endgamePhase) score -= 48;
        if (hasCornerMoveNow && oppCorners <= ownCorners && !cornerEmergency && !ctx.forceUseCard) score -= 30;
    }

    if (isCellTeleportWill) {
        score -= 58;
        if (cornerEmergency || trailingHard) score += 96;
        else if (trailing) score += 34;
        if (leadStable && !ctx.forceUseCard) score -= 112;
        if (endgamePhase) score -= 62;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 36;
    }

    if (isHyperactiveInheritWill) {
        score -= 26;
        if (openingPhase) score += 24;
        if (midLatePhase) score += 10;
        if (endgamePhase) score -= 70;
        if (trailing) score += 20;
        if (leadStable && !ctx.forceUseCard) score -= 38;
        if (hasCornerMoveNow) score += 12;
    }

    if (isRobotVacuumWill) {
        score -= 24;
        if (ctx.empties >= 20 && ctx.empties <= 46) score += 24;
        if (ctx.empties <= 12) score -= 65;
        if (hasCornerMoveNow) score += 40;
        else if (hasEdgeMoveNow) score += 18;
        if (cornerEmergency && !hasCornerMoveNow) score -= 26;
        if (trailing) score += 18;
    }

    if (isEqualityWill) {
        score -= 24;
        if (ctx.discDiff <= -10) score += 52;
        else if (!ctx.forceUseCard) score -= 120;
        if (ctx.discDiff <= -14) score += 24;
        if (lowDiscEmergency) score += 18;
        if (criticalLowDiscEmergency) score += 24;
        if (ctx.empties <= 12) score -= 42;
        else if (ctx.empties <= 18) score -= 16;
    }

    if (isReinforcementWill) {
        score -= 6;
        if (cornerEmergency || ctx.discDiff <= -8) score += 36;
        if (ctx.discDiff <= -12) score += 18;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 46;
        if (ctx.discDiff >= 6 && !cornerEmergency && !ctx.forceUseCard) score -= 60;
        if (endgamePhase && ctx.discDiff >= 0) score -= 42;
        if (ctx.legalMovesCount <= 1) score += 18;
    }

    if (isGluttonousWill) {
        score -= 42;
        if (hasCornerMoveNow) score += 78;
        else if (hasEdgeMoveNow) score += 30;
        else score -= 48;
        if (maxLegalFlips < 4 && !ctx.forceUseCard) score -= 260;
        if (whiteLv6Mode && maxLegalFlips < 4 && !ctx.forceUseCard) score -= 60;
        if (maxLegalFlips >= 4) score += 108;
        if (cornerEmergency && !hasCornerMoveNow) score += 40;
        if (trailingHard) score += 52;
        else if (trailing) score += 24;
        if (leadStable && !ctx.forceUseCard) score -= 72;
        if (endgamePhase) score -= 92;
        if (keepPriorityInHandCount >= 2) score -= 80;
        if (highVarianceInHandCount >= 2 || fastRotateInHandCount >= 2) score += 20;
        if (ctx.handSize <= 2) score -= 46;
        if (criticalLowDiscEmergency && maxLegalFlips >= 4) score += 52;
    }

    if (isExtremeHyperactiveWill) {
        score -= 62;
        if (openingPhase) score += 20;
        if (midLatePhase && !endgamePhase) score += 12;
        if (hasCornerMoveNow) score += 62;
        else if (hasEdgeMoveNow) score += 24;
        else score -= 42;
        if (trailingHard) score += 118;
        else if (trailing) score += 46;
        if (cornerEmergency && !hasCornerMoveNow) score += 24;
        if (leadStable && !ctx.forceUseCard) score -= 140;
        if (endgamePhase) score -= 168;
        if (ctx.ownCharge <= (cardCost + 8) && !ctx.forceUseCard) score -= 44;
    }

    if (isSuperCrushWill) {
        score -= 42;
        if (cornerEmergency || trailingHard) score += 96;
        else if (trailing) score += 34;
        if (edgeEmergency) score += 26;
        if (openingPhase && !cornerEmergency && edgeDiff >= -1 && maxLegalFlips <= 2 && maxLegalGain <= 2) score -= 140;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 48;
        if (leadStable && !ctx.forceUseCard) score -= 108;
        if (endgamePhase) score -= 78;
    }

    if (isBlockadeWill) {
        score += 12;
        if (mobilityPressureLevel >= 2) score += 54;
        else if (mobilityPressureLevel >= 1) score += 22;
        if (cornerEmergency) score += 42;
        if (edgeEmergency) score += 20;
        if (leadStable && ctx.legalMovesCount >= 4 && !cornerEmergency) score -= 24;
        if (openingPhase && ctx.legalMovesCount >= 4 && !cornerEmergency) score -= 18;
        if (endgamePhase) score += 18;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= 20;
    }

    if (isObserverWill) {
        score -= 24;
        if (hasCornerMoveNow) score += 150;
        else if (hasEdgeMoveNow) score += 48;
        else score -= 170;
        if (!hasCornerMoveNow && !hasEdgeMoveNow && !ctx.forceUseCard) score -= 90;
        if (cornerEmergency && !hasCornerMoveNow) score -= 52;
        if (leadStable && !ctx.forceUseCard) score += 16;
        if (endgamePhase) score -= 82;
        if (criticalLowDiscEmergency && (hasCornerMoveNow || hasEdgeMoveNow)) score += 54;
    }

    if (isMeteorWill || isBoardShrinkCard) {
        score -= cardType === 'BOARD_SHRINK_GOD' ? 86 : (cardType === 'BOARD_SHRINK_WILL' ? 72 : 64);
        if (cornerEmergency) score += cardType === 'BOARD_SHRINK_GOD' ? 144 : (cardType === 'BOARD_SHRINK_WILL' ? 128 : 120);
        if (trailingHard) score += cardType === 'BOARD_SHRINK_GOD' ? 176 : (cardType === 'BOARD_SHRINK_WILL' ? 160 : 150);
        else if (trailing) score += cardType === 'BOARD_SHRINK_GOD' ? 70 : (cardType === 'BOARD_SHRINK_WILL' ? 60 : 54);
        if (edgeEmergency) score += cardType === 'BOARD_SHRINK_GOD' ? 56 : 42;
        if (leadStable && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 220 : (cardType === 'BOARD_SHRINK_WILL' ? 196 : 180);
        if (ctx.discDiff >= 0 && !cornerEmergency && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 96 : 72;
        if (hasCornerMoveNow && !cornerEmergency && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 60 : 42;
        if (endgamePhase && leadStable) score -= cardType === 'BOARD_SHRINK_GOD' ? 84 : 60;
        if (ctx.ownCharge <= (cardCost + 6) && !ctx.forceUseCard) score -= cardType === 'BOARD_SHRINK_GOD' ? 90 : 70;
        if (ctx.meteorBestCornerSwing > 0) score += Math.min(180, ctx.meteorBestCornerSwing * 75);
        if (ctx.meteorBestDestroyValue > 0) score += Math.min(220, ctx.meteorBestDestroyValue * 0.22);
        const meteorHasGoodTarget = (
            ctx.meteorHasCornerPromotion === true ||
            ctx.meteorHasHighValueDestroy === true ||
            ctx.meteorBestCornerSwing > 0 ||
            ctx.meteorBestDestroyValue >= 320
        );
        if (!highBonusMoveAvailable && !meteorHasGoodTarget) {
            if (cornerEmergency && !hasCornerMoveNow && !hasEdgeMoveNow) {
                score -= ctx.forceUseCard ? 920 : 220;
            } else if (!ctx.forceUseCard) {
                score -= 90;
            }
        }
    }

    // In stable lead, avoid spending swing/high-variance cards unless emergency.
    if (!ctx.forceUseCard && leadStable && !cornerEmergency) {
        if (isSwingCard) score -= 28;
        if (HIGH_VARIANCE_CARD_TYPES.has(cardType)) score -= 20;
        if (isChargeSwingCard && hasCornerMoveNow) score -= 26;
    }

    if (isLossWill) {
        const specialDiff = oppSpecialCount - ownSpecialCount;
        const anchorResetDiff = oppAnchorResetWeight - ownAnchorResetWeight;
        score -= 38;
        score += specialDiff * 52;
        score += anchorResetDiff * 44;
        if (oppSpecialCount <= 0 && ownSpecialCount <= 0) score -= 180;
        if (oppSpecialCount <= 0) score -= 90;
        if (specialDiff >= 2) score += 70;
        if (specialDiff <= -1) score -= 210;
        if (oppCornerResetCount > 0) score += (oppCornerResetCount * 56);
        if (ownCornerResetCount > 0) score -= (ownCornerResetCount * 150);
        if (ownEdgeResetCount > 0) score -= (ownEdgeResetCount * 48);
        if (cornerEmergency && oppSpecialCount > 0) score += 28;
        if (!ctx.forceUseCard && !cornerEmergency && ownAnchorResetWeight > 0 && anchorResetDiff <= 0) score -= 180;
        if (!ctx.forceUseCard && ownCornerResetCount > 0 && oppCornerResetCount < ownCornerResetCount) score -= 220;
        if (
            !ctx.forceUseCard &&
            ownAnchorResetWeight > 0 &&
            specialDiff <= 2 &&
            oppAnchorResetWeight <= ownAnchorResetWeight
        ) {
            score -= 110;
        }
        if (leadStable && specialDiff <= 0) score -= 45;
        if (endgamePhase && specialDiff <= 1) score -= 30;
        if (ownGuardCount > 0 && oppGuardCount <= ownGuardCount) score -= 20;
    }

    if (isCorrosionWill) {
        const specialDiff = oppSpecialCount - ownSpecialCount;
        score -= 26;
        score += specialDiff * 34;
        if (oppSpecialCount <= 0 && ownSpecialCount <= 0) score -= 160;
        if (oppSpecialCount <= 0) score -= 72;
        if (specialDiff >= 2) score += 48;
        if (specialDiff <= -1) score -= 165;
        if (cornerEmergency && oppSpecialCount > 0) score += 20;
        if (leadStable && specialDiff <= 0) score -= 34;
        if (endgamePhase && specialDiff <= 1) score -= 26;
        if (ownGuardCount > oppGuardCount) score -= 16;
    }

    if (isRebuildWill) {
        let keepPriorityCount = 0;
        let highVarianceInHandCount = 0;
        for (const handId of handCardIds) {
            if (!handId || handId === cardId) continue;
            const handDef = typeof getCardDef === 'function' ? (getCardDef(handId) || null) : null;
            const handType = handDef && typeof handDef.type === 'string' ? handDef.type : '';
            if (!handType) continue;
            if (REBUILD_KEEP_PRIORITY_CARD_TYPES.has(handType)) keepPriorityCount += 1;
            if (HIGH_VARIANCE_CARD_TYPES.has(handType) || handType === 'TIME_BOMB') {
                highVarianceInHandCount += 1;
            }
        }

        const usableCount = usableCardIds.length;
        const unusableCount = Math.max(0, ctx.handSize - usableCount);

        score -= 95;
        if (ctx.handSize >= 4) score += 95;
        if (ctx.handSize >= 5) score += 30;
        if (unusableCount >= 2) score += 55;
        if (unusableCount >= 3) score += 30;
        if (highVarianceInHandCount >= 2) score += 35;

        if (ctx.handSize <= 2) score -= 130;
        if (keepPriorityCount >= 1) score -= 70;
        if (keepPriorityCount >= 2) score -= 80;
        if (cornerEmergency && keepPriorityCount >= 1) score -= 90;

        if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 45;
        if (ctx.discDiff <= -10 && ctx.handSize >= 4 && keepPriorityCount === 0) score += 24;

        if (deckRemaining !== null) {
            if (deckRemaining <= 1) score -= 180;
            else if (deckRemaining <= 2) score -= 95;
            else if (deckRemaining <= 3) score -= 45;
            else if (deckRemaining >= 8 && ctx.handSize >= 4) score += 12;
        }
    }

    // WORK_WILL is a long-horizon card. Prefer using it only when we can anchor
    // the next stone on stable cells (corner/edge), and avoid it in emergency.
    if (isWorkWill) {
        score -= 30;
        if (cornerEmergency && !ctx.forceUseCard) score -= 120;
        if (hasCornerMoveNow) score += 180;
        else if (hasEdgeMoveNow) score += 40;
        else score -= 220;
        if (!hasCornerMoveNow && !hasEdgeMoveNow && !ctx.forceUseCard) score -= 80;
        if (ctx.discDiff >= 8 && !ctx.forceUseCard) score -= 90;
        if (ctx.empties <= 14) score -= 120;
        if (highBonusMoveAvailable) score += 12;
        if (highBonusMoveAvailable && ctx.ownCharge >= 20) score += 40;
        if (whiteLv6Mode && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 55;
        if (criticalLowDiscEmergency && (hasCornerMoveNow || hasEdgeMoveNow)) score += 64;
    }

    // TIME_BOMB is a comeback tool. Avoid reckless usage while ahead.
    if (isTimeBomb) {
        score -= 15;
        if (cornerEmergency || ctx.discDiff <= -8) score += 95;
        if (ctx.discDiff <= -14) score += 40;
        if (ctx.discDiff >= 8 && !cornerEmergency && !ctx.forceUseCard) score -= 140;
        if (ctx.discDiff >= 12 && !ctx.forceUseCard) score -= 80;
        if (hasCornerMoveNow && ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 55;
        if (ownCorners > oppCorners && !cornerEmergency && !ctx.forceUseCard) score -= 65;
        if (ctx.empties <= 10 && ctx.discDiff > 0) score -= 45;
        if (whiteLv6Mode && leadStable && !cornerEmergency) score -= 120;
    }

    if (isTimeStopGod) {
        score -= 55;
        if (cornerEmergency || ctx.discDiff <= -8) score += 105;
        if (ctx.discDiff <= -14) score += 35;
        if (ctx.discDiff >= 6 && !cornerEmergency && !ctx.forceUseCard) score -= 150;
        if (ctx.discDiff >= 10 && !ctx.forceUseCard) score -= 80;
        if (hasCornerMoveNow && ctx.discDiff >= 0 && !ctx.forceUseCard) score -= 65;
        if (ownCorners > oppCorners && !cornerEmergency && !ctx.forceUseCard) score -= 80;
        if (ctx.empties <= 12 && !ctx.forceUseCard) score -= 110;
        if (ownDiscs <= 6 && !ctx.forceUseCard) score -= 220;
        if (whiteLv6Mode && leadStable && !cornerEmergency) score -= 160;
    }


    if (whiteLv6Mode && isLastResort && !ctx.forceUseCard) {
        if (ctx.legalMovesCount > 0) score -= 420;
        if (ctx.legalMovesCount > 0 && ctx.handSize >= 4) score -= 180;
        if (ctx.discDiff >= 0) score -= 420;
        if (leadStable && !cornerEmergency) score -= 110;
    }

    return {
        cardId,
        cardDef,
        cardType,
        cardCost,
        score,
        shouldUse: score >= ctx.minUseScore,
        minUseScore: ctx.minUseScore
    };
}

function chooseCardWithRiskProfile(
    usableCardIds: CpuPolicyCardId[],
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef: CpuPolicyCardDefinitionResolver,
    context?: CpuPolicyCardContext
): CpuPolicyCardScore | null {
    if (!Array.isArray(usableCardIds) || usableCardIds.length === 0) return null;
    let best: CpuPolicyCardScore | null = null;
    for (const cardId of usableCardIds) {
        const decision = scoreCardUseDecision(cardId, getCardCost, getCardDef, context);
        if (!best) {
            best = decision;
            continue;
        }
        if (decision.score > best.score) {
            best = decision;
            continue;
        }
        if (decision.score === best.score && Number(decision.cardCost || 0) > Number(best.cardCost || 0)) {
            best = decision;
            continue;
        }
        if (decision.score === best.score && Number(decision.cardCost || 0) === Number(best.cardCost || 0) && String(decision.cardId) < String(best.cardId)) {
            best = decision;
        }
    }
    if (!best || !best.shouldUse) return null;
    return {
        cardId: best.cardId,
        cardDef: best.cardDef,
        score: best.score
    };
}

function scoreCardRetentionPriority(
    cardId: CpuPolicyCardId,
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef: CpuPolicyCardDefinitionResolver,
    context?: CpuPolicyCardContext
): CpuPolicyCardScore {
    const ctx = buildCardDecisionContext(context);
    const cardCost = typeof getCardCost === 'function' ? Number(getCardCost(cardId) || 0) : 0;
    const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
    const cardType = cardDef && typeof cardDef.type === 'string' ? cardDef.type : '';
    const isRecoveryCard = isCornerRecoveryCardType(cardType);
    const isHoldCard = isCornerHoldCardType(cardType);
    const isChargeRampCard = isChargeRampCardType(cardType);
    const isWorkWill = cardType === 'WORK_WILL';
    const isTimeBomb = cardType === 'TIME_BOMB';
    const isTimeStopGod = cardType === 'TIME_STOP_GOD';
    const isLastResort = cardType === 'LAST_RESORT';
    const isEqualityWill = cardType === 'EQUALITY_WILL';
    const isReinforcementWill = cardType === 'REINFORCEMENT_WILL';
    const isHeavenBlessing = cardType === 'HEAVEN_BLESSING';
    const isRevealHandWill = cardType === 'REVEAL_HAND_WILL';
    const isCondemnWill = cardType === 'CONDEMN_WILL';
    const isExecutionWill = cardType === 'EXECUTION_WILL';
    const isProtectedNextStone = cardType === 'PROTECTED_NEXT_STONE';
    const isAfterimageWill = cardType === 'AFTERIMAGE_WILL';
    const isGhostWill = cardType === 'GHOST_WILL';
    const isPermaProtectNextStone = cardType === 'PERMA_PROTECT_NEXT_STONE';
    const isGuardWill = cardType === 'GUARD_WILL';
    const isGuardianGod = cardType === 'GUARDIAN_GOD';
    const isRegenWill = cardType === 'REGEN_WILL';
    const isLightningWill = cardType === 'LIGHTNING_WILL';
    const isHyperactiveWill = cardType === 'HYPERACTIVE_WILL';
    const isInstantHyperactiveWill = cardType === 'INSTANT_HYPERACTIVE_WILL';
    const isTabooReverseWill = cardType === 'TABOO_REVERSE_WILL';
    const isCrossBomb = cardType === 'CROSS_BOMB';
    const isXBomb = cardType === 'X_BOMB';
    const isUltimateDestroyGod = cardType === 'ULTIMATE_DESTROY_GOD';
    const isUltimateHyperactiveGod = cardType === 'ULTIMATE_HYPERACTIVE_GOD';
    const isThrowChainCard = THROW_CHAIN_CARD_TYPES.includes(cardType);
    const isChainWill = CHAIN_WILL_CARD_TYPES.includes(cardType);
    const isGoldStone = cardType === 'GOLD_STONE';
    const isCrystalStone = cardType === 'CRYSTAL_STONE';
    const isRainbowStone = cardType === 'RAINBOW_STONE';
    const isSilverStone = cardType === 'SILVER_STONE';
    const isPlunderWill = cardType === 'PLUNDER_WILL';
    const isLossWill = cardType === 'LOSS_WILL';
    const isCorrosionWill = cardType === 'CORROSION_WILL';
    const isTrapWill = cardType === 'TRAP_WILL';
    const isTemptWill = cardType === 'TEMPT_WILL' || cardType === 'CAPTURE_WILL';
    const isExtendLifeWill = cardType === 'EXTEND_LIFE_WILL';
    const isExtendLifeGod = cardType === 'EXTEND_LIFE_GOD';
    const isExtendLifeCard = isExtendLifeWill || isExtendLifeGod;
    const isBlockadeWill = cardType === 'BLOCKADE_WILL';
    const isMeteorWill = cardType === 'METEOR_WILL';
    const isBoardShrinkCard = (cardType === 'BOARD_SHRINK_WILL' || cardType === 'BOARD_SHRINK_GOD');
    const isObserverWill = cardType === 'OBSERVER_WILL';
    const isDestroyDragonWill = cardType === 'DESTROY_DRAGON_WILL';
    const isGluttonousWill = cardType === 'GLUTTONOUS_WILL';
    const isTeleportWill = cardType === 'TELEPORT_WILL';
    const isCellTeleportWill = cardType === 'CELL_TELEPORT_WILL';
    const isBuoyancyWill = cardType === 'BUOYANCY_WILL' || cardType === 'SUPER_BUOYANCY_WILL';
    const isGravityWill = cardType === 'GRAVITY_WILL' || cardType === 'SUPER_GRAVITY_WILL';
    const isSuperCrushWill = isBuoyancyWill || isGravityWill;
    const ownCorners = Number.isFinite(ctx.ownCorners) ? Number(ctx.ownCorners) : 0;
    const oppCorners = Number.isFinite(ctx.oppCorners) ? Number(ctx.oppCorners) : 0;
    const hasCornerMoveNow = ctx.hasCornerMoveNow === true;
    const hasEdgeMoveNow = ctx.hasEdgeMoveNow === true;
    const cornerEmergency = !!ctx.cornerEmergency || (oppCorners > ownCorners);
    const whiteLv6Mode = ctx.whiteLv6Mode === true || (ctx.level >= 6 && ctx.playerValue < 0);
    const recoveryCostGap = Number.isFinite(ctx.recoveryCostGap) ? Math.max(0, Number(ctx.recoveryCostGap)) : 0;
    const maxLegalFlips = Number.isFinite(ctx.maxLegalFlips) ? Math.max(0, Math.floor(ctx.maxLegalFlips)) : 0;
    const maxLegalGain = Number.isFinite(ctx.maxLegalGain) ? Math.max(0, Number(ctx.maxLegalGain)) : maxLegalFlips;
    const maxLegalBoardBonus = Number.isFinite(ctx.maxLegalBoardBonus) ? Math.max(0, Number(ctx.maxLegalBoardBonus)) : 0;
    const highBonusMoveAvailable = ctx.highBonusMoveAvailable === true || false;
    const oppHandSize = Number.isFinite(ctx.oppHandSize) ? Math.max(0, Math.floor(ctx.oppHandSize)) : 0;
    const ownSpecialCount = Number.isFinite(ctx.ownSpecialCount) ? Math.max(0, Math.floor(ctx.ownSpecialCount)) : 0;
    const oppSpecialCount = Number.isFinite(ctx.oppSpecialCount) ? Math.max(0, Math.floor(ctx.oppSpecialCount)) : 0;
    const ownCornerResetCount = Number.isFinite(ctx.ownCornerResetCount) ? Math.max(0, Math.floor(ctx.ownCornerResetCount)) : 0;
    const oppCornerResetCount = Number.isFinite(ctx.oppCornerResetCount) ? Math.max(0, Math.floor(ctx.oppCornerResetCount)) : 0;
    const ownEdgeResetCount = Number.isFinite(ctx.ownEdgeResetCount) ? Math.max(0, Math.floor(ctx.ownEdgeResetCount)) : 0;
    const oppEdgeResetCount = Number.isFinite(ctx.oppEdgeResetCount) ? Math.max(0, Math.floor(ctx.oppEdgeResetCount)) : 0;
    const ownAnchorResetWeight = (ownCornerResetCount * 2) + ownEdgeResetCount;
    const oppAnchorResetWeight = (oppCornerResetCount * 2) + oppEdgeResetCount;

    let score = cardCost * 3;
    if (whiteLv6Mode && cardCost >= 20) {
        score -= (220 + (cardCost * 5));
    }
    if (isHoldCard) score += 220;
    if (isRecoveryCard) score += cornerEmergency ? 220 : 120;
    if (isChargeRampCard && !isWorkWill) score += 85;
    if (isWorkWill) score += hasCornerMoveNow ? 110 : 35;
    if (isWorkWill && !cornerEmergency && !hasCornerMoveNow && !hasEdgeMoveNow) score += 90;
    if (DEFENSIVE_CARD_TYPES.has(cardType)) score += 40;
    if (HIGH_VARIANCE_CARD_TYPES.has(cardType)) score -= 35;
    if (hasCornerMoveNow && isHoldCard) score += 55;
    if (recoveryCostGap > 0 && isChargeRampCard && !isWorkWill) {
        score += Math.min(95, recoveryCostGap * 3);
    }

    if (isTimeBomb) {
        if (cornerEmergency || ctx.discDiff <= -8) score += 70;
        if (ctx.discDiff >= 8 && !cornerEmergency) score -= 130;
    }

    if (isTimeStopGod) {
        if (cornerEmergency || ctx.discDiff <= -8) score += 80;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 150;
        if (ctx.empties <= 12 && !cornerEmergency) score -= 70;
        if (Number.isFinite(ctx.ownDiscs) && Number(ctx.ownDiscs) <= 6) score -= 120;
    }


    if (isLastResort) {
        if (ctx.legalMovesCount > 0) score -= 220;
        if (ctx.discDiff >= 0) score -= 260;
        if (ctx.legalMovesCount <= 0 && ctx.discDiff < 0) score += 40;
    }

    if (isEqualityWill) {
        if (ctx.discDiff <= -10) score += 150;
        else score -= 220;
        if (ctx.discDiff <= -14) score += 40;
        if (ctx.empties <= 12) score -= 34;
    }

    if (isReinforcementWill) {
        if (cornerEmergency || ctx.discDiff <= -8) score += 80;
        if (ctx.discDiff <= -12) score += 24;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 150;
        if (hasCornerMoveNow && !cornerEmergency) score -= 45;
        if (ctx.empties <= 10 && ctx.discDiff > 0) score -= 35;
    }

    if (whiteLv6Mode && (isThrowChainCard || isChainWill)) score -= 260;
    if (
        whiteLv6Mode &&
        (cardType === 'TRIPLE_PLACE' || cardType === 'QUAD_PLACE' || cardType === 'INFINITE_PLACE') &&
        ctx.discDiff >= 4 &&
        !cornerEmergency
    ) score += 520;
    if (whiteLv6Mode && isLastResort && ctx.discDiff >= 0 && !cornerEmergency) score -= 220;
    if (whiteLv6Mode && isLastResort && ctx.legalMovesCount > 0) score -= 520;
    if (whiteLv6Mode && isLastResort && ctx.legalMovesCount > 0 && ctx.handSize >= 4) score -= 220;
    if (whiteLv6Mode && isTimeBomb && ctx.discDiff >= 2 && !cornerEmergency) score -= 240;
    if (whiteLv6Mode && isTimeStopGod && ctx.discDiff >= 2 && !cornerEmergency) score -= 260;
    if (whiteLv6Mode && (isThrowChainCard || isChainWill) && ctx.ownCharge < 70 && !cornerEmergency) score -= 180;
    if (whiteLv6Mode && (isThrowChainCard || isChainWill) && ctx.ownCharge >= 70 && ctx.empties <= 20) score += 64;

    if (isProtectedNextStone || isAfterimageWill || isGhostWill || isPermaProtectNextStone || isGuardWill || isGuardianGod || isRegenWill) {
        if (hasCornerMoveNow) score += 180;
        else if (hasEdgeMoveNow) score += 70;
        else score -= 80;
        if (cornerEmergency && !hasCornerMoveNow) score -= 90;
        if (ctx.empties <= 12 && !hasCornerMoveNow) score -= 50;
    }

    if (isLightningWill) {
        if (hasCornerMoveNow) score += 120;
        else if (hasEdgeMoveNow) score += 50;
        else score -= 100;
        if (cornerEmergency && !hasCornerMoveNow) score -= 70;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 60;
        if (ctx.empties <= 14) score -= 110;
    }

    if (isHyperactiveWill || isInstantHyperactiveWill) {
        score -= isInstantHyperactiveWill ? 80 : 60;
        if (ctx.discDiff <= -10 || cornerEmergency) score += 70;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 140;
        if (ctx.empties <= 16) score -= 85;
    }

    if (isCrossBomb || isXBomb) {
        score -= 70;
        if (ctx.discDiff <= -10 || cornerEmergency) score += 62;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 120;
        if (ctx.empties <= 14) score -= 80;
    }

    if (isTabooReverseWill) {
        score -= 90;
        if (hasCornerMoveNow) score += 140;
        if (cornerEmergency) score += 50;
        if (ctx.discDiff >= 4 && !cornerEmergency) score -= 220;
        if (ctx.ownCharge <= (cardCost + 6)) score -= 120;
    }

    if (isUltimateDestroyGod) {
        score -= 30;
        if (hasCornerMoveNow) score += 110;
        else if (hasEdgeMoveNow) score += 30;
        if (ctx.discDiff <= -10 || cornerEmergency) score += 58;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 110;
        if (ctx.empties <= 14) score -= 85;
    }

    if (isUltimateHyperactiveGod) {
        score -= 95;
        if (ctx.discDiff <= -10 || cornerEmergency) score += 85;
        if (ctx.discDiff >= 4 && !cornerEmergency) score -= 220;
        if (ctx.empties <= 18) score -= 110;
    }

    if (isGoldStone || isRainbowStone || isSilverStone) {
        if (maxLegalFlips < 3) score -= isRainbowStone ? 80 : 110;
        if (maxLegalGain <= 1) score -= 90;
        else if (maxLegalGain <= 2) score -= 30;
        else score += Math.min(isRainbowStone ? 110 : 80, maxLegalGain * (isRainbowStone ? 12 : 10));
    }
    if (isCrystalStone) {
        if (maxLegalBoardBonus <= 0) score -= 150;
        else if (maxLegalBoardBonus === 1) score -= 40;
        else score += Math.min(104, maxLegalBoardBonus * 30);
        if (ctx.highBonusMoveAvailable === true) score += 20;
    }
    if (isHeavenBlessing) {
        score += 30;
        if (ctx.handSize >= 4) score -= 120;
        if (ctx.handSize >= 5) score -= 80;
        if (ctx.empties <= 14) score -= 130;
        if (ctx.empties >= 24 && ctx.handSize <= 2) score += 36;
        const heavenDeckRemaining = Number.isFinite(ctx.deckRemaining) ? Number(ctx.deckRemaining) : null;
        if (heavenDeckRemaining !== null) {
            if (heavenDeckRemaining <= 2) score -= 140;
            else if (heavenDeckRemaining <= 4) score -= 50;
        }
    }
    if (isRevealHandWill) {
        score += Math.min(72, oppHandSize * 16);
        if (oppHandSize <= 1) score -= 120;
        else if (oppHandSize <= 2 && !cornerEmergency) score -= 40;
        if (cornerEmergency || ctx.discDiff <= -6) score += 16;
        if (ctx.discDiff >= 6 && oppHandSize <= 2) score -= 24;
        if (ctx.empties <= 12) score -= 48;
    }
    if (isCondemnWill) {
        score += Math.min(120, oppHandSize * 24);
        if (oppHandSize <= 1) score -= 140;
        else if (oppHandSize <= 2 && !cornerEmergency) score -= 48;
        if (cornerEmergency || ctx.discDiff <= -8) score += 24;
        if (ctx.discDiff >= 6 && oppHandSize <= 2) score -= 32;
    }
    if (isExecutionWill) {
        score += Math.min(132, oppHandSize * 28);
        if (oppHandSize <= 1) score -= 120;
        else if (oppHandSize <= 2 && !cornerEmergency) score -= 36;
        if (cornerEmergency || ctx.discDiff <= -8) score += 26;
        if (ctx.discDiff >= 6 && oppHandSize <= 2) score -= 24;
    }
    if (isTrapWill) {
        if (cornerEmergency || ctx.discDiff <= -8) score += 28;
        else score -= 140;
        if (ctx.handSize >= 4) score -= 36;
    }
    if (isTemptWill) {
        if (oppSpecialCount <= 0) score -= 260;
        else score += Math.min(120, oppSpecialCount * 42);
        if (ctx.discDiff >= 6 && !cornerEmergency && oppSpecialCount <= 1) score -= 82;
    }
    if (isPlunderWill) {
        const siphon = Math.min(Math.max(0, Math.floor(ctx.oppCharge || 0)), maxLegalFlips);
        if (maxLegalFlips < 3) score -= 60;
        if (siphon <= 1) score -= 90;
        else score += Math.min(90, siphon * 12);
    }
    if (isLossWill) {
        const specialDiff = oppSpecialCount - ownSpecialCount;
        const anchorResetDiff = oppAnchorResetWeight - ownAnchorResetWeight;
        if (specialDiff <= 0) score -= 300;
        else score += Math.min(200, specialDiff * 70);
        score += anchorResetDiff * 60;
        if (oppCornerResetCount > 0) score += (oppCornerResetCount * 90);
        if (ownCornerResetCount > 0) score -= (ownCornerResetCount * 260);
        if (ownEdgeResetCount > 0) score -= (ownEdgeResetCount * 84);
        if (ownAnchorResetWeight > 0 && anchorResetDiff <= 0) score -= 140;
    }
    if (isCorrosionWill) {
        const specialDiff = oppSpecialCount - ownSpecialCount;
        if (specialDiff <= 0) score -= 240;
        else score += Math.min(150, specialDiff * 52);
    }
    if (isExtendLifeCard) {
        score += (ownSpecialCount * 24);
        if (ownSpecialCount <= 0) score -= 200;
        if (ctx.empties <= 14) score -= 70;
        if (ctx.discDiff >= 4) score += 18;
        if (cornerEmergency && !hasCornerMoveNow) score -= 24;
        if (isExtendLifeGod) {
            score += (ownSpecialCount * 20);
            if (ctx.empties <= 18) score -= 30;
            if (ctx.discDiff >= 4) score += 24;
        }
    }
    if (isBlockadeWill) {
        score += (ctx.legalMovesCount <= 2 ? 90 : (ctx.legalMovesCount <= 3 ? 42 : 10));
        if (cornerEmergency) score += 28;
        if (ctx.discDiff >= 6 && ctx.legalMovesCount >= 4 && !cornerEmergency) score -= 36;
    }
    if (isMeteorWill || isBoardShrinkCard) {
        score -= cardType === 'BOARD_SHRINK_GOD' ? 84 : (cardType === 'BOARD_SHRINK_WILL' ? 66 : 55);
        if (cornerEmergency || ctx.discDiff <= -8) score += cardType === 'BOARD_SHRINK_GOD' ? 122 : (cardType === 'BOARD_SHRINK_WILL' ? 102 : 90);
        if (ctx.discDiff >= 4 && !cornerEmergency) score -= cardType === 'BOARD_SHRINK_GOD' ? 176 : (cardType === 'BOARD_SHRINK_WILL' ? 152 : 140);
        if (ctx.empties <= 12 && ctx.discDiff >= 0) score -= cardType === 'BOARD_SHRINK_GOD' ? 90 : 70;
    }
    if (isObserverWill) {
        if (hasCornerMoveNow) score += 95;
        else if (hasEdgeMoveNow) score += 42;
        else score -= 36;
        if (ctx.empties <= 14) score -= 85;
    }
    if (isDestroyDragonWill) {
        if (hasCornerMoveNow) score += 110;
        else if (hasEdgeMoveNow) score += 56;
        else score -= 52;
        if (cornerEmergency && !hasCornerMoveNow) score -= 34;
        if (ctx.empties <= 14) score -= 72;
    }
    if (isGluttonousWill) {
        score -= 120;
        if (hasCornerMoveNow) score += 100;
        else if (hasEdgeMoveNow) score += 34;
        if (ctx.discDiff <= -10) score += 52;
        if (ctx.discDiff >= 4 && !cornerEmergency) score -= 120;
        if (ctx.handSize <= 2) score -= 80;
        if (ctx.empties <= 16) score -= 100;
    }

    if (cardType === 'EXTREME_HYPERACTIVE_WILL') {
        score -= 80;
        if (ctx.empties <= 18) score -= 120;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 85;
        if (cornerEmergency || ctx.discDiff <= -10) score += 78;
        if (hasCornerMoveNow) score += 24;
        if (ctx.ownCharge <= 24 && !cornerEmergency) score -= 24;
    }

    if (isSuperCrushWill) {
        score += 96;
        if (cornerEmergency || ctx.discDiff <= -10) score += 105;
        else score -= 96;
        if (oppCorners > ownCorners) score += 26;
        if (hasCornerMoveNow && ctx.discDiff >= 0 && !cornerEmergency) score -= 52;
        if (!cornerEmergency && !hasCornerMoveNow && !hasEdgeMoveNow) score -= 110;
        if (ctx.empties <= 12) score -= 82;
    }
    if (isTeleportWill) {
        score += 140;
        if (cornerEmergency) score += 120;
        if (ctx.discDiff >= 6 && !cornerEmergency && hasCornerMoveNow) score -= 40;
    }
    if (isCellTeleportWill) {
        score -= 30;
        if (cornerEmergency) score += 36;
        if (ctx.discDiff >= 6 && !cornerEmergency) score -= 48;
    }

    // Hand cap pressure: prefer rotating low-impact cards first.
    if (ctx.handSize >= 5) {
        if (!isHoldCard && !isRecoveryCard && !isChargeRampCard && !isWorkWill) score -= 55;
        if (cardCost <= 4 && !isHoldCard && !isRecoveryCard) score -= 30;
        if (ctx.discDiff >= 0 && HIGH_VARIANCE_CARD_TYPES.has(cardType)) score -= 45;
    }

    return {
        cardId,
        cardDef,
        cardType,
        cardCost,
        score
    };
}

function chooseLowestRetentionCard(
    handCardIds: CpuPolicyCardId[],
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef: CpuPolicyCardDefinitionResolver,
    context?: CpuPolicyCardContext
): CpuPolicyCardScore | null {
    if (!Array.isArray(handCardIds) || handCardIds.length === 0) return null;
    let best: CpuPolicyCardScore | null = null;
    for (const cardId of handCardIds) {
        const scored = scoreCardRetentionPriority(cardId, getCardCost, getCardDef, context);
        if (!best) {
            best = scored;
            continue;
        }
        // Lower retention score means a better card to rotate out.
        if (scored.score < best.score) {
            best = scored;
            continue;
        }
        // Tie-break: rotate the higher-cost expendable card first.
        if (scored.score === best.score && Number(scored.cardCost || 0) > Number(best.cardCost || 0)) {
            best = scored;
            continue;
        }
        if (scored.score === best.score && Number(scored.cardCost || 0) === Number(best.cardCost || 0) && String(scored.cardId) < String(best.cardId)) {
            best = scored;
        }
    }
    return best;
}

function chooseHandDestroyTargetForCycle(
    handCardIds: CpuPolicyCardId[],
    usableCardIds: CpuPolicyCardId[],
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef: CpuPolicyCardDefinitionResolver,
    context?: CpuPolicyCardContext
): CpuPolicyCardScore | null {
    if (!Array.isArray(handCardIds) || handCardIds.length === 0) return null;
    const rawContext = asRecord(context);
    const hand = handCardIds
        .map((id) => String(id || '').trim())
        .filter((id) => id.length > 0);
    if (hand.length <= 0) return null;

    const ctx = buildCardDecisionContext(Object.assign({}, context || {}, {
        handSize: hand.length
    }));

    const usable = Array.isArray(usableCardIds)
        ? usableCardIds.map((id) => String(id || '').trim()).filter((id) => id.length > 0)
        : [];
    const usableSet = new Set(usable);
    const forcedDestroy = chooseForcedHandDestroyTarget(hand, getCardCost, getCardDef, ctx, usableSet);
    if (forcedDestroy) return forcedDestroy;
    if (ctx.forceUseCard) return null;

    let hasRecoveryCard = false;
    let hasHoldCard = false;
    let hasChargeRampCard = false;
    for (const cardId of hand) {
        const def = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
        const type = def && typeof def.type === 'string' ? def.type : '';
        if (!type) continue;
        if (isCornerRecoveryCardType(type)) hasRecoveryCard = true;
        if (isCornerHoldCardType(type)) hasHoldCard = true;
        if (isChargeRampCardType(type)) hasChargeRampCard = true;
    }

    const ownCorners = Number.isFinite(rawContext.ownCorners) ? Number(rawContext.ownCorners) : 0;
    const oppCorners = Number.isFinite(rawContext.oppCorners) ? Number(rawContext.oppCorners) : 0;
    const cornerEmergency = !!rawContext.cornerEmergency || (oppCorners > ownCorners);
    const hasCornerMoveNow = rawContext.hasCornerMoveNow === true;
    const hasEdgeMoveNow = rawContext.hasEdgeMoveNow === true;
    const cornerHoldMode = rawContext.cornerHoldMode === true;
    const whiteLv6Mode = ctx.level >= 6 && Number(ctx.playerValue) < 0;
    const needRecoveryCard = (cornerEmergency || !hasCornerMoveNow) && !hasRecoveryCard;
    const needHoldCard = (hasCornerMoveNow || cornerHoldMode) && !hasHoldCard;
    const needChargeRampCard = (
        Number.isFinite(rawContext.recoveryCostGap) &&
        Number(rawContext.recoveryCostGap) > 0 &&
        !hasChargeRampCard
    );
    const shouldCycleForNeededCards = needRecoveryCard || needHoldCard || needChargeRampCard;

    const noUsableCardsNow = usable.length <= 0;
    const lv6FastCycleMode = (
        ctx.level >= 6 &&
        ctx.handSize >= 3 &&
        noUsableCardsNow &&
        !ctx.forceUseCard
    );
    const handPressure = ctx.handSize >= 5 ? 2 : (ctx.handSize >= 4 ? 1 : (lv6FastCycleMode ? 1 : 0));
    if (handPressure <= 0) return null;

    let strongUseReady = false;
    if (usable.length > 0) {
        let bestUse = null;
        for (const cardId of usable) {
            const decision = scoreCardUseDecision(cardId, getCardCost, getCardDef, context);
            if (!bestUse || decision.score > bestUse.score) {
                bestUse = decision;
            }
        }
        if (bestUse && bestUse.shouldUse && bestUse.score >= (Number(bestUse.minUseScore) + 18)) {
            strongUseReady = true;
        }
    }
    const allowDestroyByPressure = (
        (handPressure >= 2 && (shouldCycleForNeededCards || usable.length <= 0)) ||
        (handPressure === 1 && shouldCycleForNeededCards && usable.length <= 0)
    );
    if (!allowDestroyByPressure && !lv6FastCycleMode) return null;
    if (strongUseReady && handPressure <= 1) return null;
    if (strongUseReady && handPressure >= 2 && !shouldCycleForNeededCards && !cornerEmergency) return null;

    let best = null;
    for (const cardId of hand) {
        const retention = scoreCardRetentionPriority(cardId, getCardCost, getCardDef, context);
        let destroyScore = Number.isFinite(retention.score) ? Number(retention.score) : 0;
        const cardType = retention.cardType || '';
        const isRecoveryCard = isCornerRecoveryCardType(cardType);
        const isHoldCard = isCornerHoldCardType(cardType);
        const isRampCard = isChargeRampCardType(cardType);
        const isTimeBomb = cardType === 'TIME_BOMB';
        const isTimeStopGod = cardType === 'TIME_STOP_GOD';
        const isLastResort = cardType === 'LAST_RESORT';
        const isSuperCrushWill = cardType === 'BUOYANCY_WILL' || cardType === 'SUPER_BUOYANCY_WILL' || cardType === 'GRAVITY_WILL' || cardType === 'SUPER_GRAVITY_WILL';
        const isGeneratedKeepPlace = cardType === 'TRIPLE_PLACE' || cardType === 'QUAD_PLACE' || cardType === 'INFINITE_PLACE';
        const isFastRotate = WHITE_LV6_FAST_ROTATE_TYPES.has(cardType);
        const isWhiteCornerKeep = WHITE_LV6_CORNER_SWING_KEEP_TYPES.has(cardType);

        // Keep recovery/hold/ramp cards when they are currently needed.
        if (needRecoveryCard && isRecoveryCard) destroyScore += 520;
        if (needHoldCard && isHoldCard) destroyScore += 460;
        if (needChargeRampCard && isRampCard) destroyScore += 220;
        if (needRecoveryCard && isTimeBomb) destroyScore -= 220;

        // Prefer rotating risky cards while stable, especially in hand-saturated states.
        if (isTimeBomb && !cornerEmergency && ctx.discDiff >= 0) destroyScore -= 210;
        if (isTimeStopGod && !cornerEmergency && ctx.discDiff >= 0) destroyScore -= 240;
        if (HIGH_VARIANCE_CARD_TYPES.has(cardType) && ctx.discDiff >= 0) destroyScore -= 70;

        // Keep immediately usable cards unless the hand is fully saturated.
        if (usableSet.has(cardId) && handPressure < 2) destroyScore += 40;

        // If we are explicitly cycling for missing role cards, prefer non-usable cards first.
        if (shouldCycleForNeededCards && !usableSet.has(cardId)) destroyScore -= 28;
        if (lv6FastCycleMode && !usableSet.has(cardId)) destroyScore -= 36;

        if (whiteLv6Mode) {
            if ((cornerEmergency || hasCornerMoveNow || cornerHoldMode) && isWhiteCornerKeep) destroyScore += 520;
            if (isFastRotate) destroyScore -= 380;
            if (ctx.discDiff >= 4 && WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES.has(cardType) && !isGeneratedKeepPlace) destroyScore -= 360;
            if ((ctx.legalMovesCount <= 2 || ctx.handSize >= 4) && WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES.has(cardType) && !isWhiteCornerKeep && !isGeneratedKeepPlace) {
                destroyScore -= 220;
            }
            if (!cornerEmergency && !hasCornerMoveNow && !hasEdgeMoveNow && isSuperCrushWill) destroyScore -= 160;
            if (ctx.legalMovesCount <= 1 && HIGH_VARIANCE_CARD_TYPES.has(cardType) && !isWhiteCornerKeep) {
                destroyScore -= 180;
            }
            if (isLastResort && !ctx.forceUseCard && ctx.discDiff >= 0) destroyScore -= 220;
        }

        if (!best || destroyScore < best.destroyScore) {
            best = {
                cardId,
                cardDef: retention.cardDef,
                cardCost: retention.cardCost,
                cardType,
                destroyScore
            };
        } else if (best && destroyScore === best.destroyScore && Number(retention.cardCost || 0) > Number(best.cardCost || 0)) {
            best = {
                cardId,
                cardDef: retention.cardDef,
                cardCost: retention.cardCost,
                cardType,
                destroyScore
            };
        }
    }
    if (!best) return null;

    const destroyThreshold = lv6FastCycleMode
        ? (shouldCycleForNeededCards ? 260 : 115)
        : (shouldCycleForNeededCards
            ? (handPressure >= 2 ? 360 : 220)
            : (handPressure >= 2 ? 150 : 80));
    if (best.destroyScore > destroyThreshold) return null;

    return {
        cardId: best.cardId,
        cardDef: best.cardDef,
        cardType: best.cardType,
        score: best.destroyScore,
        reason: lv6FastCycleMode
            ? 'lv6_fast_cycle'
            : (shouldCycleForNeededCards ? 'missing_role_card' : 'hand_pressure')
    };
}

function resolveBoardGeometry(boardOrRows: CpuPolicyBoardShape, colsMaybe?: number | null): CpuPolicyBoardGeometry {
    if (Array.isArray(boardOrRows)) {
        if (boardOrRows.length <= 0) return { maxR: 7, maxC: 7 };
        let maxC = -1;
        for (const oneRow of boardOrRows) {
            if (Array.isArray(oneRow) && oneRow.length > 0) {
                maxC = Math.max(maxC, oneRow.length - 1);
            }
        }
        if (maxC < 0) maxC = boardOrRows.length - 1;
        return { maxR: boardOrRows.length - 1, maxC };
    }
    const rows = isFiniteNumber(boardOrRows) ? Math.max(1, Math.floor(Number(boardOrRows))) : 8;
    const cols = isFiniteNumber(colsMaybe) ? Math.max(1, Math.floor(Number(colsMaybe))) : rows;
    return { maxR: rows - 1, maxC: cols - 1 };
}

function isCorner(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    if (SharedBoardUtils && typeof SharedBoardUtils.isCorner === 'function') {
        return SharedBoardUtils.isCorner(row, col, boardOrRows, colsMaybe);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
    return (row === 0 || row === geom.maxR) && (col === 0 || col === geom.maxC);
}

function isEdge(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    if (SharedBoardUtils && typeof SharedBoardUtils.isEdge === 'function') {
        return SharedBoardUtils.isEdge(row, col, boardOrRows, colsMaybe);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
    return row === 0 || row === geom.maxR || col === 0 || col === geom.maxC;
}

function isXSquare(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    if (SharedBoardUtils && typeof SharedBoardUtils.isXSquare === 'function') {
        return SharedBoardUtils.isXSquare(row, col, boardOrRows, colsMaybe);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
    if (geom.maxR < 2 || geom.maxC < 2) return false;
    const nearTopBottomRows = row === 1 || row === (geom.maxR - 1);
    const nearLeftRightCols = col === 1 || col === (geom.maxC - 1);
    return nearTopBottomRows && nearLeftRightCols;
}

function isCSquare(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    if (SharedBoardUtils && typeof SharedBoardUtils.isCSquare === 'function') {
        return SharedBoardUtils.isCSquare(row, col, boardOrRows, colsMaybe);
    }
    if (!Number.isInteger(row) || !Number.isInteger(col)) return false;
    const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
    if (geom.maxR < 2 || geom.maxC < 2) return false;
    const nearTopBottom = (row === 0 || row === geom.maxR) && (col === 1 || col === (geom.maxC - 1));
    const nearLeftRight = (col === 0 || col === geom.maxC) && (row === 1 || row === (geom.maxR - 1));
    return nearTopBottom || nearLeftRight;
}

function scoreMoveHeuristic(move: CpuPolicyMove, level = 1, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): number {
    const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
    const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
    const flips = Array.isArray(move.flips) ? move.flips.length : 0;

    let score = flips * 100;
    if (isCorner(row, col, boardOrRows, colsMaybe)) score += 10000;
    if (isEdge(row, col, boardOrRows, colsMaybe)) score += 600;
    if (isXSquare(row, col, boardOrRows, colsMaybe)) score -= 600;
    if (isCSquare(row, col, boardOrRows, colsMaybe)) score -= 300;
    if (level >= 6 && isXSquare(row, col, boardOrRows, colsMaybe)) score -= 1200;
    if (level >= 6 && isCSquare(row, col, boardOrRows, colsMaybe)) score -= 700;

    if (level >= 5 && isCorner(row, col, boardOrRows, colsMaybe)) score += 5000;
    return score;
}

function cloneBoard(board: CpuPolicyBoard | null | undefined): CpuPolicyBoard {
    if (SharedBoardUtils && typeof SharedBoardUtils.cloneBoard === 'function') {
        return SharedBoardUtils.cloneBoard(board);
    }
    if (!Array.isArray(board)) return [];
    return board.map((row) => Array.isArray(row) ? row.slice() : []);
}

function inBoard(board: CpuPolicyBoard | null | undefined, row: number, col: number): boolean {
    if (SharedBoardUtils && typeof SharedBoardUtils.hasPlayableCell === 'function') {
        return SharedBoardUtils.hasPlayableCell(board, row, col);
    }
    return (
        Array.isArray(board) &&
        Number.isInteger(row) &&
        Number.isInteger(col) &&
        row >= 0 &&
        row < board.length &&
        Array.isArray(board[row]) &&
        col >= 0 &&
        col < board[row].length
    );
}

function getFlipsBasic(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): CpuPolicyMove['flips'] {
    if (OthelloCore && typeof OthelloCore.getFlipsBasic === 'function') {
        return OthelloCore.getFlipsBasic(board, row, col, playerValue);
    }
    if (SharedBoardUtils && typeof SharedBoardUtils.getFlipsBasic === 'function') {
        return SharedBoardUtils.getFlipsBasic(board, row, col, playerValue);
    }
    return [];
}

function getLegalMovesBasic(board: CpuPolicyBoard | null | undefined, playerValue: number): CpuPolicyMove[] {
    if (OthelloCore && typeof OthelloCore.getLegalMovesBasic === 'function') {
        return OthelloCore.getLegalMovesBasic(board, playerValue);
    }
    if (SharedBoardUtils && typeof SharedBoardUtils.getLegalMovesBasic === 'function') {
        return SharedBoardUtils.getLegalMovesBasic(board, playerValue);
    }
    return [];
}

function applyMoveToBoard(board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number): CpuPolicyBoard {
    const out = cloneBoard(board);
    if (!move || !inBoard(out, move.row, move.col)) return out;
    if (SharedBoardUtils && typeof SharedBoardUtils.setCellValue === 'function') {
        SharedBoardUtils.setCellValue(out, move.row, move.col, playerValue);
    } else {
        out[move.row][move.col] = playerValue;
    }
    const flips: CpuPolicyPosition[] = Array.isArray(move.flips) && move.flips.length > 0
        ? move.flips
        : (getFlipsBasic(out, move.row, move.col, playerValue) || []);
    for (const one of flips) {
        if (!one || !inBoard(out, one.row, one.col)) continue;
        if (SharedBoardUtils && typeof SharedBoardUtils.setCellValue === 'function') {
            SharedBoardUtils.setCellValue(out, one.row, one.col, playerValue);
        } else {
            out[one.row][one.col] = playerValue;
        }
    }
    return out;
}

function countCornersFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    if (SharedBoardUtils && typeof SharedBoardUtils.countCornerControl === 'function') {
        return Number(SharedBoardUtils.countCornerControl(board, playerValue).ownCorners || 0);
    }
    if (!Array.isArray(board) || board.length <= 0) return 0;
    const maxR = board.length - 1;
    const maxC = Array.isArray(board[0]) ? (board[0].length - 1) : maxR;
    const corners = [
        [0, 0],
        [0, maxC],
        [maxR, 0],
        [maxR, maxC]
    ];
    let count = 0;
    for (const p of corners) {
        if (inBoard(board, p[0], p[1]) && board[p[0]][p[1]] === playerValue) count += 1;
    }
    return count;
}

function adjacentCornerFor(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): CpuPolicyPosition | null {
    if (SharedBoardUtils && typeof SharedBoardUtils.getCornerProximity === 'function') {
        const hint = SharedBoardUtils.getCornerProximity(row, col, boardOrRows, colsMaybe);
        if (hint && Array.isArray(hint.corner) && hint.corner.length === 2) {
            return {
                row: Number(hint.corner[0]),
                col: Number(hint.corner[1])
            };
        }
    }
    const geom = resolveBoardGeometry(boardOrRows, colsMaybe);
    const maxR = geom.maxR;
    const maxC = geom.maxC;
    if (maxR < 1 || maxC < 1) return null;
    const rowNearTop = row === 1;
    const rowNearBottom = row === (maxR - 1);
    const colNearLeft = col === 1;
    const colNearRight = col === (maxC - 1);

    if ((rowNearTop || rowNearBottom) && (colNearLeft || colNearRight)) {
        return {
            row: rowNearTop ? 0 : maxR,
            col: colNearLeft ? 0 : maxC
        };
    }

    if ((row === 0 || row === maxR) && (colNearLeft || colNearRight)) {
        return {
            row,
            col: colNearLeft ? 0 : maxC
        };
    }

    if ((col === 0 || col === maxC) && (rowNearTop || rowNearBottom)) {
        return {
            row: rowNearTop ? 0 : maxR,
            col
        };
    }

    return null;
}

function getBoardBonusAtCell(
    boardBonusByCell: Record<string, number> | null | undefined,
    boardBonusConsumedByCell: Record<string, boolean | number> | null | undefined,
    row: number,
    col: number
): number {
    if (!Number.isInteger(row) || !Number.isInteger(col)) return 0;
    const key = `${row},${col}`;
    if (boardBonusConsumedByCell && boardBonusConsumedByCell[key] === true) return 0;
    const raw = boardBonusByCell ? Number(boardBonusByCell[key] || 0) : 0;
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

function getBoardCellValueSafe(board: CpuPolicyBoard | null | undefined, row: number, col: number) {
    if (!inBoard(board, row, col)) return null;
    if (SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function') {
        return SharedBoardUtils.getCellValue(board, row, col);
    }
    return Array.isArray(board) && Array.isArray(board[row]) ? board[row][col] : null;
}

function hasOwnedAdjacentCorner(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): boolean {
    const adjacentCorner = adjacentCornerFor(row, col, board);
    if (!adjacentCorner || !inBoard(board, adjacentCorner.row, adjacentCorner.col)) return false;
    return getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col) === playerValue;
}

function isPseudoCornerXSquare(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): boolean {
    if (!Array.isArray(board) || !isXSquare(row, col, board)) return false;
    const adjacentCorner = adjacentCornerFor(row, col, board);
    if (!adjacentCorner || !inBoard(board, adjacentCorner.row, adjacentCorner.col)) return false;
    if (getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col) !== playerValue) return false;
    return (
        getBoardCellValueSafe(board, row, adjacentCorner.col) === playerValue &&
        getBoardCellValueSafe(board, adjacentCorner.row, col) === playerValue
    );
}

function computeLegalMoveMetrics(legalMoves: CpuPolicyMove[], getBoardBonus?: CpuPolicyBoardBonusResolver): CpuPolicyLegalMoveMetrics {
    const safeLegalMoves = Array.isArray(legalMoves) ? legalMoves : [];
    let maxLegalFlips = 0;
    let totalLegalFlips = 0;
    let maxLegalGain = 0;
    let maxLegalBoardBonus = 0;
    for (const move of safeLegalMoves) {
        if (!move) continue;
        const flips = Array.isArray(move.flips) ? move.flips.length : 0;
        totalLegalFlips += flips;
        if (flips > maxLegalFlips) maxLegalFlips = flips;
        const rawBonus = (typeof getBoardBonus === 'function' && Number.isInteger(move.row) && Number.isInteger(move.col))
            ? Number(getBoardBonus(move.row, move.col, move) || 0)
            : 0;
        const bonus = Number.isFinite(rawBonus) && rawBonus > 0 ? rawBonus : 0;
        if (bonus > maxLegalBoardBonus) maxLegalBoardBonus = bonus;
        const gain = flips + bonus;
        if (gain > maxLegalGain) maxLegalGain = gain;
    }
    return {
        maxLegalFlips,
        avgLegalFlips: safeLegalMoves.length > 0 ? (totalLegalFlips / safeLegalMoves.length) : 0,
        maxLegalGain,
        maxLegalBoardBonus
    };
}

function countAdjacentCellsByValue(board: CpuPolicyBoard | null | undefined, row: number, col: number, value: number): number {
    if (!Array.isArray(board) || !Number.isInteger(row) || !Number.isInteger(col)) return 0;
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = row + dr;
            const nc = col + dc;
            if (getBoardCellValueSafe(board, nr, nc) === value) count += 1;
        }
    }
    return count;
}

function computePlacementStabilityProxy(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): number {
    if (!Array.isArray(board) || !inBoard(board, row, col)) return 0;
    let score = 0;
    if (isCorner(row, col, board)) score += 4.2;
    else if (isEdge(row, col, board)) score += 2.1;
    else score -= 0.8;

    if (isXSquare(row, col, board)) score -= 2.8;
    if (isCSquare(row, col, board)) score -= 1.7;

    const ownAdj = countAdjacentCellsByValue(board, row, col, playerValue);
    const oppAdj = countAdjacentCellsByValue(board, row, col, -playerValue);
    const emptyAdj = countAdjacentCellsByValue(board, row, col, 0);
    score += (ownAdj * 0.65);
    score += (oppAdj * 0.2);
    score -= (emptyAdj * 0.75);

    const adjacentCorner = adjacentCornerFor(row, col, board);
    if (adjacentCorner && inBoard(board, adjacentCorner.row, adjacentCorner.col)) {
        const cornerVal = getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col);
        if (cornerVal === playerValue) score += 1.5;
        else if (cornerVal === -playerValue) score -= 0.6;
    }

    return score;
}

function evaluateMoveStabilityProfile(
    board: CpuPolicyBoard | null | undefined,
    move: CpuPolicyMove | null | undefined,
    playerValue: number,
    ownAnchoredEdgesBefore?: number | null
): { stabilityProxy: number; anchoredEdgeDelta: number } {
    if (!Array.isArray(board) || !move) {
        return {
            stabilityProxy: Number.NEGATIVE_INFINITY,
            anchoredEdgeDelta: Number.NEGATIVE_INFINITY
        };
    }
    const row = Number(move.row);
    const col = Number(move.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || !inBoard(board, row, col)) {
        return {
            stabilityProxy: Number.NEGATIVE_INFINITY,
            anchoredEdgeDelta: Number.NEGATIVE_INFINITY
        };
    }
    const after = applyMoveToBoard(board, move, playerValue);
    const anchoredBefore = Number.isFinite(ownAnchoredEdgesBefore)
        ? Number(ownAnchoredEdgesBefore)
        : countAnchoredEdgeDiscsFromCorners(board, playerValue);
    return {
        stabilityProxy: computePlacementStabilityProxy(after, row, col, playerValue),
        anchoredEdgeDelta: countAnchoredEdgeDiscsFromCorners(after, playerValue) - anchoredBefore
    };
}

function resolveMovePlanProfile(context: CpuPolicyCardContext | CpuPolicyDecisionContext | null | undefined): CpuPolicyMovePlanProfile | null {
    const ctx = asRecord(context);
    const cardType = typeof ctx.pendingType === 'string' && ctx.pendingType
        ? ctx.pendingType
        : (typeof ctx.activeCardType === 'string' ? ctx.activeCardType : '');
    if (!cardType) return null;
    if (!Object.prototype.hasOwnProperty.call(CARD_TYPE_MOVE_PLAN_PROFILE, cardType)) return null;
    return CARD_TYPE_MOVE_PLAN_PROFILE[cardType];
}

function countAdjacentOpponentStrikeProfile(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number) {
    const out = {
        oppAdjCount: 0,
        oppCornerCount: 0,
        oppEdgeCount: 0
    };
    if (!Array.isArray(board) || !inBoard(board, row, col)) return out;
    const opponentValue = -playerValue;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const targetRow = row + dr;
            const targetCol = col + dc;
            if (getBoardCellValueSafe(board, targetRow, targetCol) !== opponentValue) continue;
            out.oppAdjCount += 1;
            if (isCorner(targetRow, targetCol, board)) out.oppCornerCount += 1;
            else if (isEdge(targetRow, targetCol, board)) out.oppEdgeCount += 1;
        }
    }
    return out;
}

function collectUltimateHyperactiveLandingProfile(
    board: CpuPolicyBoard | null | undefined,
    row: number,
    col: number,
    playerValue: number,
    maxDistance?: number | null
) {
    const out = {
        count: 0,
        maxDistance: 0,
        longRangeCount: 0,
        enemyAdjSum: 0,
        cornerPressureCount: 0,
        edgeLandingCount: 0
    };
    if (!Array.isArray(board) || !inBoard(board, row, col)) return out;
    const opponentValue = -playerValue;
    const normalizedMaxDistance = Number(maxDistance);
    const maxRange = Number.isInteger(normalizedMaxDistance) && normalizedMaxDistance > 0 ? normalizedMaxDistance : 5;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            for (let distance = 1; distance <= maxRange; distance++) {
                const targetRow = row + (dr * distance);
                const targetCol = col + (dc * distance);
                if (!inBoard(board, targetRow, targetCol)) break;
                if (getBoardCellValueSafe(board, targetRow, targetCol) !== 0) continue;
                out.count += 1;
                if (distance > out.maxDistance) out.maxDistance = distance;
                if (distance >= 3) out.longRangeCount += 1;
                out.enemyAdjSum += countAdjacentCellsByValue(board, targetRow, targetCol, opponentValue);
                if (isEdge(targetRow, targetCol, board)) out.edgeLandingCount += 1;
                const strike = countAdjacentOpponentStrikeProfile(board, targetRow, targetCol, playerValue);
                if (strike.oppCornerCount > 0) out.cornerPressureCount += 1;
            }
        }
    }
    return out;
}

function scoreMoveForCornerEdgePlan(move: CpuPolicyMove, context?: CpuPolicyCardContext): number {
    const ctx = asRecord(context);
    const level = isFiniteNumber(ctx.level) ? Math.max(1, Math.floor(Number(ctx.level))) : 1;
    const whiteLv6Mode = level >= 6 && Number(ctx.playerValue) < 0;
    const row = isFiniteNumber(move && move.row) ? Number(move.row) : -1;
    const col = isFiniteNumber(move && move.col) ? Number(move.col) : -1;
    if (row < 0 || col < 0) return -999999;
    const board = Array.isArray(ctx.board) ? ctx.board as CpuPolicyBoard : null;

    let score = scoreMoveHeuristic(move, level, board);
    if (isCorner(row, col, board)) score += 32000;
    if (!isCorner(row, col, board) && isEdge(row, col, board)) score += 5200;
    const playerValue = isFiniteNumber(ctx.playerValue)
        ? (Number(ctx.playerValue) >= 0 ? 1 : -1)
        : 1;
    const ownMovesBefore = getLegalMovesBasic(board, playerValue);
    const ownDiscsBefore = isFiniteNumber(ctx.ownDiscs)
        ? Math.max(0, Math.floor(Number(ctx.ownDiscs)))
        : null;
    const lowMobilityBefore = ownMovesBefore.length <= 2;
    const lowDiscEmergency = ownDiscsBefore != null && ownDiscsBefore <= 8;
    const criticalLowDiscEmergency = ownDiscsBefore != null && ownDiscsBefore <= 4;
    const xSquare = isXSquare(row, col, board);
    const cSquare = !xSquare && isCSquare(row, col, board);

    const adjacentCorner = adjacentCornerFor(row, col, board);
    if (adjacentCorner && board && inBoard(board, adjacentCorner.row, adjacentCorner.col)) {
        const cornerVal = getBoardCellValueSafe(board, adjacentCorner.row, adjacentCorner.col);
        const cornerEmpty = cornerVal === 0;
        if (cornerEmpty && xSquare) score -= 12000;
        if (cornerEmpty && cSquare) score -= 9000;
        if (cornerVal === playerValue && xSquare) {
            score += isPseudoCornerXSquare(board, row, col, playerValue) ? 2400 : 1800;
        }
        if (cornerVal === playerValue && cSquare) score += 800;
    }

    const bonusValue = getBoardBonusAtCell(
        asRecord(ctx.boardBonusByCell) as Record<string, number>,
        asRecord(ctx.boardBonusConsumedByCell) as Record<string, boolean>,
        row,
        col
    );
    if (bonusValue > 0) {
        const bonusWeight = whiteLv6Mode ? 200 : 220;
        score += bonusValue * bonusWeight;
        if (whiteLv6Mode && !isCorner(row, col, board) && !isEdge(row, col, board)) {
            score += bonusValue * 36;
        }
        const reserveRecoveryCardCostGap = isFiniteNumber(ctx.reserveRecoveryCardCostGap)
            ? Number(ctx.reserveRecoveryCardCostGap)
            : 0;
        if (reserveRecoveryCardCostGap > 0) {
            score += bonusValue * 80;
        }
    }

    if (!board || !inBoard(board, row, col)) return score;

    const after = applyMoveToBoard(board, move, playerValue);
    const oppMoves = getLegalMovesBasic(after, -playerValue);
    const ownMovesAfter = getLegalMovesBasic(after, playerValue);
    const ownCornerRepliesAfter = countCornerMovesFor(after, playerValue);
    const movePlanProfile = resolveMovePlanProfile(ctx);
    let oppCornerMoves = 0;
    let oppEdgeMoves = 0;
    for (const one of oppMoves) {
        if (!one) continue;
        if (isCorner(one.row, one.col, after)) oppCornerMoves += 1;
        if (!isCorner(one.row, one.col, after) && isEdge(one.row, one.col, after)) oppEdgeMoves += 1;
    }

    if (!isCorner(row, col, board) && oppCornerMoves > 0) {
        const mitigation = ctx.reserveRecoveryCardReady === true ? 0.55 : 1;
        const cornerPunishBase = level >= 6 ? 25000 : 14500;
        score -= Math.round(oppCornerMoves * cornerPunishBase * mitigation);
    }
    if (level >= 6 && !isCorner(row, col, board) && oppCornerMoves > 0 && ownCornerRepliesAfter <= 0) {
        const afterStat = countBoardDiscsForPlayer(after, playerValue);
        const emptiesAfter = Number.isFinite(afterStat.empties) ? Number(afterStat.empties) : 0;
        const phaseWeight = emptiesAfter >= 24 ? 1.2 : (emptiesAfter >= 14 ? 1.0 : 0.7);
        score -= Math.round(oppCornerMoves * 22000 * phaseWeight);
        if (whiteLv6Mode) {
            score -= Math.round(oppCornerMoves * 5000 * phaseWeight);
        }
    }
    if (
        whiteLv6Mode &&
        bonusValue > 0 &&
        !isCorner(row, col, board) &&
        oppCornerMoves > 0
    ) {
        score -= (4200 + (bonusValue * 380));
    }

    if (isCorner(row, col, board)) {
        score += 5000;
        if (ctx.hasCornerHoldCardReady === true) score += 2200;
    }
    if (whiteLv6Mode && !isCorner(row, col, board) && isEdge(row, col, board)) {
        score += 980;
    }
    if (whiteLv6Mode && !isCorner(row, col, board) && !isEdge(row, col, board) && bonusValue <= 0) {
        score -= 320;
    }

    score += Math.max(-2500, (14 - oppMoves.length) * 95);
    score += Math.max(-1800, -oppEdgeMoves * 130);

    if (whiteLv6Mode && criticalLowDiscEmergency) {
        if (ownMovesAfter.length <= 0) score -= 4200;
        else if (ownMovesAfter.length === 1) score -= 1800;
        else score += Math.min(1600, ownMovesAfter.length * 260);
        if (oppMoves.length <= 2) score += (3 - oppMoves.length) * 380;
    }

    const ownCornersAfter = countCornersFor(after, playerValue);
    const oppCornersAfter = countCornersFor(after, -playerValue);
    const ownCornersBefore = countCornersFor(board, playerValue);
    const oppCornersBefore = countCornersFor(board, -playerValue);
    const ownEdgesBefore = countEdgesFor(board, playerValue);
    const oppEdgesBefore = countEdgesFor(board, -playerValue);
    const ownEdgesAfter = countEdgesFor(after, playerValue);
    const oppEdgesAfter = countEdgesFor(after, -playerValue);
    const ownEdgeRunBefore = summarizeEdgeRunsFor(board, playerValue);
    const oppEdgeRunBefore = summarizeEdgeRunsFor(board, -playerValue);
    const ownEdgeRunAfter = summarizeEdgeRunsFor(after, playerValue);
    const oppEdgeRunAfter = summarizeEdgeRunsFor(after, -playerValue);
    const ownFrontierBefore = countFrontierDiscsFor(board, playerValue);
    const ownFrontierAfter = countFrontierDiscsFor(after, playerValue);
    const ownAnchoredEdgesBefore = countAnchoredEdgeDiscsFromCorners(board, playerValue);
    const ownAnchoredEdgesAfter = countAnchoredEdgeDiscsFromCorners(after, playerValue);
    const frontierDelta = ownFrontierAfter - ownFrontierBefore;
    const anchoredEdgeDelta = ownAnchoredEdgesAfter - ownAnchoredEdgesBefore;
    const stabilityProxy = computePlacementStabilityProxy(after, row, col, playerValue);
    const cornerLead = ownCornersAfter - oppCornersAfter;
    const edgeLeadBefore = ownEdgesBefore - oppEdgesBefore;
    const edgeLeadAfter = ownEdgesAfter - oppEdgesAfter;
    const edgeLeadDelta = edgeLeadAfter - edgeLeadBefore;
    const oppEdgeDelta = oppEdgesAfter - oppEdgesBefore;
    const ownEdgeChainDelta = Number(ownEdgeRunAfter.chainStrength || 0) - Number(ownEdgeRunBefore.chainStrength || 0);
    const oppEdgeChainDelta = Number(oppEdgeRunAfter.chainStrength || 0) - Number(oppEdgeRunBefore.chainStrength || 0);
    const ownLongestEdgeRunDelta = Number(ownEdgeRunAfter.longestRun || 0) - Number(ownEdgeRunBefore.longestRun || 0);
    const oppLongestEdgeRunDelta = Number(oppEdgeRunAfter.longestRun || 0) - Number(oppEdgeRunBefore.longestRun || 0);
    const ownCompleteEdgeLineDelta = Number(ownEdgeRunAfter.completeLineCount || 0) - Number(ownEdgeRunBefore.completeLineCount || 0);
    const oppCompleteEdgeLineDelta = Number(oppEdgeRunAfter.completeLineCount || 0) - Number(oppEdgeRunBefore.completeLineCount || 0);
    const ownLoneEdgeDiscDelta = Number(ownEdgeRunAfter.loneDiscCount || 0) - Number(ownEdgeRunBefore.loneDiscCount || 0);
    const adjacentLoneEnemyEdgeCount = countAdjacentLoneEdgeDiscsFor(board, row, col, -playerValue);
    score += cornerLead * 2800;

    // Lv6: even before corner lead is secured, prefer lines that claw back edge
    // control instead of expanding inside while the opponent owns the rim.
    if (
        level >= 6 &&
        cornerLead <= 0 &&
        (edgeLeadBefore <= -2 || lowMobilityBefore || lowDiscEmergency || (whiteLv6Mode && edgeLeadBefore <= -1))
    ) {
        const edgeRecoveryWeight = whiteLv6Mode ? 380 : 260;
        const oppEdgeRecoveryWeight = whiteLv6Mode ? 280 : 190;
        const oppEdgePenaltyWeight = whiteLv6Mode ? 320 : 220;
        if (edgeLeadDelta !== 0) score += edgeLeadDelta * edgeRecoveryWeight;
        if (oppEdgeDelta > 0) {
            score -= oppEdgeDelta * oppEdgePenaltyWeight;
        } else if (oppEdgeDelta < 0) {
            score += (-oppEdgeDelta) * oppEdgeRecoveryWeight;
        }
        if (edgeLeadBefore <= -2 && edgeLeadAfter > edgeLeadBefore) {
            const recoveredLead = edgeLeadAfter - edgeLeadBefore;
            score += Math.min(1600, recoveredLead * (whiteLv6Mode ? 220 : 160));
        }
        if (!isCorner(row, col, board) && !isEdge(row, col, board) && edgeLeadAfter < edgeLeadBefore) {
            score -= whiteLv6Mode ? 260 : 180;
        }
    }

    if (level >= 6) {
        if (ownEdgeChainDelta !== 0) {
            score += ownEdgeChainDelta * (whiteLv6Mode ? 260 : 220);
        }
        if (oppEdgeChainDelta > 0) {
            score -= oppEdgeChainDelta * (whiteLv6Mode ? 280 : 230);
        } else if (oppEdgeChainDelta < 0) {
            score += (-oppEdgeChainDelta) * (whiteLv6Mode ? 170 : 140);
        }
        if (ownLongestEdgeRunDelta > 0) {
            score += ownLongestEdgeRunDelta * (whiteLv6Mode ? 960 : 760);
        }
        if (oppLongestEdgeRunDelta > 0) {
            score -= oppLongestEdgeRunDelta * (whiteLv6Mode ? 1280 : 980);
        } else if (oppLongestEdgeRunDelta < 0) {
            score += (-oppLongestEdgeRunDelta) * (whiteLv6Mode ? 540 : 420);
        }
        if (ownCompleteEdgeLineDelta > 0) {
            score += ownCompleteEdgeLineDelta * (whiteLv6Mode ? 5200 : 4200);
        }
        if (oppCompleteEdgeLineDelta > 0) {
            score -= oppCompleteEdgeLineDelta * (whiteLv6Mode ? 5600 : 4500);
        }
        if (ownLoneEdgeDiscDelta < 0) {
            score += (-ownLoneEdgeDiscDelta) * (whiteLv6Mode ? 360 : 260);
        } else if (!isCorner(row, col, board) && isEdge(row, col, board) && ownLoneEdgeDiscDelta > 0) {
            score -= ownLoneEdgeDiscDelta * (whiteLv6Mode ? 760 : 520);
        }
    }

    if (level >= 6 && !isCorner(row, col, board) && isEdge(row, col, board) && adjacentLoneEnemyEdgeCount > 0) {
        let loneEnemyPenalty = adjacentLoneEnemyEdgeCount * (whiteLv6Mode ? 3400 : 2600);
        if (ownEdgeChainDelta <= 0) {
            loneEnemyPenalty += adjacentLoneEnemyEdgeCount * (whiteLv6Mode ? 1700 : 1200);
        }
        if (oppEdgeChainDelta > 0 || oppLongestEdgeRunDelta > 0) {
            loneEnemyPenalty += adjacentLoneEnemyEdgeCount * (whiteLv6Mode ? 2200 : 1600);
        }
        if (ownCompleteEdgeLineDelta > 0 || ownLongestEdgeRunDelta >= 2) {
            loneEnemyPenalty = Math.round(loneEnemyPenalty * 0.42);
        }
        score -= loneEnemyPenalty;
    }

    // Lv6: once corners are secured, prefer stabilizing edge control over loose inner expansion.
    if (level >= 6 && cornerLead > 0) {
        score += edgeLeadAfter * 460;
        if (!isCorner(row, col, board) && isEdge(row, col, board)) {
            score += 900 * cornerLead;
            if (ownEdgesAfter > ownEdgesBefore) score += 550;
        } else if (!isCorner(row, col, board) && !isEdge(row, col, board)) {
            score -= 320 * cornerLead;
        }

        // If corner lead is established, prioritize reducing opponent mobility (early squeeze path).
        if (oppMoves.length <= 4) {
            score += (5 - oppMoves.length) * 780;
        } else {
            score += Math.max(-1200, (10 - oppMoves.length) * 160);
        }
    }

    // Lv6 survival mode: when discs or mobility are low, preserve future legal
    // moves and prefer edge stabilization over loose inner growth.
    if (level >= 6 && (lowMobilityBefore || lowDiscEmergency)) {
        const survivalWeight = criticalLowDiscEmergency ? 1.4 : (lowMobilityBefore ? 1.18 : 1.0);
        if (ownMovesAfter.length <= 0) {
            score -= Math.round(5200 * survivalWeight);
        } else if (ownMovesAfter.length === 1) {
            score -= Math.round(2100 * survivalWeight);
        } else {
            score += Math.round(Math.min(2600, (ownMovesAfter.length - 1) * 520) * survivalWeight);
        }

        if (!isCorner(row, col, board) && isEdge(row, col, board)) {
            score += Math.round(1500 * survivalWeight);
            if (ownEdgesAfter > ownEdgesBefore) score += Math.round(880 * survivalWeight);
        } else if (!isCorner(row, col, board) && !isEdge(row, col, board)) {
            score -= Math.round(620 * survivalWeight);
        }

        if (oppMoves.length <= 2) score += Math.round((3 - oppMoves.length) * 620 * survivalWeight);
        if (lowMobilityBefore && ownMovesAfter.length < ownMovesBefore.length) {
            score -= Math.round((ownMovesBefore.length - ownMovesAfter.length) * 1800 * survivalWeight);
        }
    }

    // Lv6 specialization: when no corner is available, bias toward safe edges over inner growth.
    if (level >= 6 && !isCorner(row, col, board)) {
        if (isEdge(row, col, board)) {
            score += 1500;
            if (oppMoves.length <= 4) score += 620;
        } else {
            score -= 520;
            if (oppMoves.length <= 4) score -= 460;
        }
    }

    // Lv6: when this move newly acquires corner lead, bias toward immediate edge follow-up shape.
    const cornerLeadBefore = ownCornersBefore - oppCornersBefore;
    if (level >= 6 && cornerLeadBefore <= 0 && cornerLead > 0) {
        if (!isCorner(row, col, board) && isEdge(row, col, board)) score += 1800;
        if (!isCorner(row, col, board) && !isEdge(row, col, board)) score -= 950;
    }

    if (ctx.preferEdgeRetention === true && !isCorner(row, col, board) && isEdge(row, col, board)) {
        score += 700;
    }
    if (ctx.preferEdgeRetention === true && !isCorner(row, col, board) && !isEdge(row, col, board)) {
        score -= 280;
    }

    if (level >= 6) {
        const boundedStability = Math.max(-5, Math.min(6, stabilityProxy));
        score += Math.round(boundedStability * (whiteLv6Mode ? 210 : 170));
        if (!isCorner(row, col, board) && isEdge(row, col, board)) {
            score += anchoredEdgeDelta * (whiteLv6Mode ? 560 : 420);
            if (
                anchoredEdgeDelta <= 0 &&
                stabilityProxy <= 0.5 &&
                cornerLead <= 0 &&
                !lowMobilityBefore &&
                !lowDiscEmergency
            ) {
                score -= whiteLv6Mode ? 9800 : 7600;
            }
        } else if (!isCorner(row, col, board) && !isEdge(row, col, board) && anchoredEdgeDelta > 0) {
            score += anchoredEdgeDelta * (whiteLv6Mode ? 240 : 180);
        }
        if (!isCorner(row, col, board) && frontierDelta > 0) {
            score -= frontierDelta * (whiteLv6Mode ? 170 : 120);
        }
    }

    // If recovery/hold counters are not online yet, bias toward charge-positive
    // bonus cells and safe edges rather than low-value inner expansion.
    if (
        level >= 6 &&
        Number.isFinite(ctx.reserveRecoveryCardCostGap) &&
        Number(ctx.reserveRecoveryCardCostGap) > 0
    ) {
        const recoveryGap = Math.min(4, Math.max(0, Number(ctx.reserveRecoveryCardCostGap)));
        if (bonusValue > 0) score += Math.round(bonusValue * 110 * recoveryGap);
        if (!isCorner(row, col, board) && isEdge(row, col, board)) score += Math.round(280 * recoveryGap);
        if (
            !isCorner(row, col, board) &&
            !isEdge(row, col, board) &&
            bonusValue <= 0 &&
            ownMovesAfter.length <= ownMovesBefore.length
        ) {
            score -= Math.round(240 * recoveryGap);
        }
    }

    if (movePlanProfile && Number(movePlanProfile.placementWeight) > 0) {
        const flipCount = Array.isArray(move.flips) ? move.flips.length : 0;
        const oppMovesBefore = getLegalMovesBasic(board, -playerValue);
        const ownAdjAfter = countAdjacentCellsByValue(after, row, col, playerValue);
        const oppAdjBefore = countAdjacentCellsByValue(board, row, col, -playerValue);
        const emptyAdjBefore = countAdjacentCellsByValue(board, row, col, 0);
        const ownRiskBefore = countXsAndCsFor(board, playerValue);
        const ownRiskAfter = countXsAndCsFor(after, playerValue);
        const ownMobilityDelta = ownMovesAfter.length - ownMovesBefore.length;
        const oppMobilityPressure = oppMovesBefore.length - oppMoves.length;
        const profileScale = 0.32 + (Number(movePlanProfile.placementWeight) * 0.14);

        let profileScore = 0;
        if (isCorner(row, col, board)) profileScore += Number(movePlanProfile.cornerBias || 0) * 2500;
        else if (isEdge(row, col, board)) profileScore += Number(movePlanProfile.edgeBias || 0) * 1250;
        else profileScore += Number(movePlanProfile.innerBias || 0) * 900;

        profileScore += bonusValue * Number(movePlanProfile.bonusBias || 0) * 180;
        profileScore += flipCount * Number(movePlanProfile.flipBias || 0) * 240;
        profileScore += ownMobilityDelta * Number(movePlanProfile.mobilityBias || 0) * 165;
        profileScore += oppMobilityPressure * Math.max(0, Number(movePlanProfile.mobilityBias || 0)) * 95;
        profileScore += emptyAdjBefore * Number(movePlanProfile.emptyAdjBias || 0) * 145;
        profileScore += ownAdjAfter * Number(movePlanProfile.ownAdjBias || 0) * 155;
        profileScore += oppAdjBefore * Number(movePlanProfile.oppAdjBias || 0) * 155;
        profileScore -= Math.max(0, frontierDelta) * Number(movePlanProfile.frontierPenalty || 0) * 180;
        profileScore += Math.max(-5, Math.min(6, stabilityProxy)) * Number(movePlanProfile.stabilityBias || 0) * 175;
        profileScore += anchoredEdgeDelta * Math.max(0, Number(movePlanProfile.stabilityBias || 0)) * 220;
        profileScore -= Math.max(0, ownRiskAfter.x - ownRiskBefore.x) * Number(movePlanProfile.xPenalty || 0) * 900;
        profileScore -= Math.max(0, ownRiskAfter.c - ownRiskBefore.c) * Number(movePlanProfile.cPenalty || 0) * 520;

        if (isXSquare(row, col, board)) profileScore -= Number(movePlanProfile.xPenalty || 0) * 1200;
        if (isCSquare(row, col, board)) profileScore -= Number(movePlanProfile.cPenalty || 0) * 720;

        if (
            String(ctx.pendingType || '') === 'LAST_RESORT' &&
            Number.isFinite(ctx.pendingPlacementsRemaining) &&
            Number(ctx.pendingPlacementsRemaining) >= 2 &&
            !isCorner(row, col, board) &&
            !isEdge(row, col, board)
        ) {
            profileScore -= 900;
        }

        if (
            Number(movePlanProfile.stabilityBias || 0) >= 2 &&
            !isCorner(row, col, board) &&
            !isEdge(row, col, board) &&
            oppCornerMoves > 0
        ) {
            profileScore -= 1800;
        }

        score += Math.round(profileScore * profileScale);
    }

    return score;
}

function rankMoves(candidateMoves: CpuPolicyMove[], level = 1, options?: CpuPolicyMoveOptions | null): CpuPolicyMove[] {
    const opts = options || {};
    const useHeuristic = !!opts.enableHeuristic;
    const scoreMove = typeof opts.scoreMove === 'function' ? opts.scoreMove : null;
    const board = Array.isArray(opts.board) ? opts.board : null;
    const geom = resolveBoardGeometry(board);
    const tieMaxR = geom.maxR >= 0 ? geom.maxR : 7;
    const tieMaxC = geom.maxC >= 0 ? geom.maxC : 7;
    if (!useHeuristic && !scoreMove) return candidateMoves.slice();

    const scored = candidateMoves.map((move, idx) => {
        const learnedScore = scoreMove ? (scoreMove(move) || 0) : 0;
        const heuristicScore = useHeuristic ? scoreMoveHeuristic(move, level, board) : 0;
        // Stable deterministic tie-break (avoid random in policy layer)
        const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
        const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
        const tie = (tieMaxR - row) * 0.001 + (tieMaxC - col) * 0.0001 + (candidateMoves.length - idx) * 0.00001;
        return { move, score: learnedScore + heuristicScore + tie };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.move);
}

function chooseMove(
    candidateMoves: CpuPolicyMove[],
    level = 1,
    rng?: CpuPolicyRandomSource | null,
    selectMoveWithAi?: CpuPolicyAiMoveSelector | null,
    options?: CpuPolicyMoveOptions | null
): CpuPolicyMove | null {
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
    const safeRng = rng && typeof rng.random === 'function' ? rng : { random: () => 0.5 };
    const rankedMoves = rankMoves(candidateMoves, level, options);

    if (typeof selectMoveWithAi === 'function') {
        try {
            const move = selectMoveWithAi(rankedMoves, level);
            if (move) return move;
        } catch (e) { /* fallback below */ }
    }

    if (options && options.enableHeuristic) return rankedMoves[0];
    return rankedMoves[Math.floor(safeRng.random() * rankedMoves.length)];
}

function countEdgesFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    if (SharedBoardUtils && typeof SharedBoardUtils.countEdgeControl === 'function') {
        return Number(SharedBoardUtils.countEdgeControl(board, playerValue).ownEdges || 0);
    }
    if (!Array.isArray(board) || board.length <= 0) return 0;
    let count = 0;
    const maxR = board.length - 1;
    for (let r = 0; r < board.length; r++) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        if (row.length <= 0) continue;
        const maxC = row.length - 1;
        for (let c = 0; c < row.length; c++) {
            const corner = (r === 0 || r === maxR) && (c === 0 || c === maxC);
            const edge = (r === 0 || r === maxR || c === 0 || c === maxC);
            if (edge && !corner && row[c] === playerValue) count += 1;
        }
    }
    return count;
}

function summarizeEdgeRunsFor(board: CpuPolicyBoard | null | undefined, playerValue: number): CpuPolicyEdgeRunSummary {
    if (SharedBoardUtils && typeof SharedBoardUtils.summarizeEdgeRuns === 'function') {
        return SharedBoardUtils.summarizeEdgeRuns(board, playerValue);
    }
    return {
        totalLines: 0,
        maxLineLength: 0,
        totalLineCells: 0,
        totalOwnedCells: 0,
        chainStrength: 0,
        longestRun: 0,
        longestRunShare: 0,
        completeLineCount: 0,
        segmentCount: 0,
        loneDiscCount: 0
    };
}

function countAdjacentLoneEdgeDiscsFor(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): number {
    if (SharedBoardUtils && typeof SharedBoardUtils.countAdjacentLoneEdgeDiscs === 'function') {
        return Number(SharedBoardUtils.countAdjacentLoneEdgeDiscs(board, row, col, playerValue) || 0);
    }
    return 0;
}

function normalizePriorScore(score: unknown): number {
    const n = Number(score);
    if (!Number.isFinite(n) || n === 0) return 0;
    return Math.sign(n) * Math.log1p(Math.abs(n));
}

function countXsAndCsFor(board: CpuPolicyBoard | null | undefined, playerValue: number): { x: number; c: number } {
    if (!Array.isArray(board) || board.length <= 0) {
        return { x: 0, c: 0 };
    }
    let x = 0;
    let c = 0;
    for (let r = 0; r < board.length; r++) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        for (let col = 0; col < row.length; col++) {
            if (row[col] !== playerValue) continue;
            const xSquare = isXSquare(r, col, board);
            const cSquare = !xSquare && isCSquare(r, col, board);
            if (!xSquare && !cSquare) continue;
            if (hasOwnedAdjacentCorner(board, r, col, playerValue)) continue;
            if (xSquare) x += 1;
            else c += 1;
        }
    }
    return { x, c };
}

function countCornerMovesFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    const legal = getLegalMovesBasic(board, playerValue);
    if (!Array.isArray(legal) || legal.length <= 0) return 0;
    let count = 0;
    for (const move of legal) {
        if (move && isCorner(move.row, move.col, board)) count += 1;
    }
    return count;
}

function evaluateImmediateCornerDonation(
    board: CpuPolicyBoard | null | undefined,
    move: CpuPolicyMove | null | undefined,
    playerValue: number
): { oppCornerMoves: number; donatesCornerNow: boolean } {
    if (!Array.isArray(board) || !move) {
        return {
            oppCornerMoves: 0,
            donatesCornerNow: false
        };
    }
    const row = Number(move.row);
    const col = Number(move.col);
    if (!Number.isInteger(row) || !Number.isInteger(col) || !inBoard(board, row, col)) {
        return {
            oppCornerMoves: 0,
            donatesCornerNow: false
        };
    }
    const after = applyMoveToBoard(board, move, playerValue);
    const oppCornerMoves = countCornerMovesFor(after, -playerValue);
    return {
        oppCornerMoves,
        donatesCornerNow: oppCornerMoves > 0
    };
}

function countFrontierDiscsFor(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    const dirs = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];
    let count = 0;
    const cells = (
        SharedBoardUtils &&
        typeof SharedBoardUtils.collectBoardCoordinates === 'function'
    )
        ? SharedBoardUtils.collectBoardCoordinates(board)
        : null;
    if (Array.isArray(cells)) {
        for (const cell of cells) {
            if (!cell) continue;
            const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                ? SharedBoardUtils.getCellValue(board, cell.row, cell.col)
                : (Array.isArray(board[cell.row]) ? board[cell.row][cell.col] : null);
            if (value !== playerValue) continue;
            let frontier = false;
            for (const d of dirs) {
                const nr = cell.row + d[0];
                const nc = cell.col + d[1];
                if (!inBoard(board, nr, nc)) continue;
                const neighborValue = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                    ? SharedBoardUtils.getCellValue(board, nr, nc)
                    : board[nr][nc];
                if (neighborValue === 0) {
                    frontier = true;
                    break;
                }
            }
            if (frontier) count += 1;
        }
        return count;
    }
    for (let r = 0; r < board.length; r++) {
        const row = Array.isArray(board[r]) ? board[r] : [];
        for (let c = 0; c < row.length; c++) {
            if (row[c] !== playerValue) continue;
            let frontier = false;
            for (const d of dirs) {
                const nr = r + d[0];
                const nc = c + d[1];
                if (!inBoard(board, nr, nc)) continue;
                if (board[nr][nc] === 0) {
                    frontier = true;
                    break;
                }
            }
            if (frontier) count += 1;
        }
    }
    return count;
}

function countAnchoredEdgeDiscsFromCorners(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    if (!Array.isArray(board) || board.length <= 0) return 0;
    const anchored = new Set<string>();
    const corners = (
        SharedBoardUtils &&
        typeof SharedBoardUtils.getCornerCells === 'function'
    )
        ? SharedBoardUtils.getCornerCells(board)
        : [
            { row: 0, col: 0 },
            { row: 0, col: Array.isArray(board[0]) ? (board[0].length - 1) : 0 },
            { row: board.length - 1, col: 0 },
            { row: board.length - 1, col: Array.isArray(board[0]) ? (board[0].length - 1) : 0 }
        ];
    const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
    ];
    const pushIfOwn = (r: number, c: number) => {
        const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
            ? SharedBoardUtils.getCellValue(board, r, c)
            : (Array.isArray(board[r]) ? board[r][c] : null);
        if (inBoard(board, r, c) && value === playerValue) anchored.add(`${r},${c}`);
    };
    const walkLine = (startR: number, startC: number, dr: number, dc: number) => {
        let r = startR;
        let c = startC;
        while (inBoard(board, r, c)) {
            const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                ? SharedBoardUtils.getCellValue(board, r, c)
                : board[r][c];
            if (value !== playerValue) break;
            anchored.add(`${r},${c}`);
            r += dr;
            c += dc;
        }
    };

    for (const corner of corners) {
        if (!corner || !inBoard(board, corner.row, corner.col)) continue;
        pushIfOwn(corner.row, corner.col);
        const cornerValue = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
            ? SharedBoardUtils.getCellValue(board, corner.row, corner.col)
            : board[corner.row][corner.col];
        if (cornerValue !== playerValue) continue;
        for (const dir of directions) {
            const nr = corner.row + dir[0];
            const nc = corner.col + dir[1];
            if (!inBoard(board, nr, nc) || !isEdge(nr, nc, board)) continue;
            walkLine(corner.row, corner.col, dir[0], dir[1]);
        }
    }
    return anchored.size;
}

function resolveLookaheadDepth(board: CpuPolicyBoard | null | undefined, level: number, preferredDepth?: number | null): number {
    if (isFiniteNumber(preferredDepth)) {
        return Math.max(1, Math.min(64, Math.floor(Number(preferredDepth))));
    }
    const stat = countBoardDiscsForPlayer(board, 1);
    const empties = Number.isFinite(stat.empties) ? stat.empties : 24;
    if (level >= 6) {
        if (empties <= 14) return 5;
        if (empties <= 30) return 4;
        return 3;
    }
    if (level >= 5) return empties <= 20 ? 4 : 3;
    return 2;
}

function resolveLookaheadEndgameDepth(options: CpuPolicyMoveOptions | null | undefined, empties: number): number {
    const opts = asRecord(options);
    if (isFiniteNumber(opts.endgameDepth)) {
        return Math.max(1, Math.min(64, Math.floor(Number(opts.endgameDepth))));
    }
    const remaining = Number.isFinite(empties) ? Math.max(0, Math.floor(empties)) : 0;
    return Math.max(30, Math.min(64, remaining + 2));
}

function resolveLookaheadBranch(board: CpuPolicyBoard | null | undefined, preferredBranch?: number | null): number {
    if (isFiniteNumber(preferredBranch)) {
        return Math.max(2, Math.min(24, Math.floor(Number(preferredBranch))));
    }
    const stat = countBoardDiscsForPlayer(board, 1);
    const empties = Number.isFinite(stat.empties) ? stat.empties : 24;
    if (empties >= 40) return 7;
    if (empties >= 24) return 9;
    if (empties >= 14) return 11;
    return 16;
}

function resolveLookaheadNodeBudget(preferredBudget: number | null | undefined, depth: number, branchLimit: number | null, endgameMode: boolean): number {
    if (isFiniteNumber(preferredBudget)) {
        return Math.max(500, Math.floor(Number(preferredBudget)));
    }
    const depthFactor = Math.max(1, Number(depth) || 1);
    if (endgameMode) {
        return Math.max(200_000, Math.min(4_000_000, (depthFactor * depthFactor * 7_200)));
    }
    const branchFactor = Math.max(2, Number(branchLimit) || 8);
    return Math.max(8_000, Math.min(80_000, (depthFactor * depthFactor * branchFactor * 650)));
}

function resolveLookaheadTimeBudgetMs(options: CpuPolicyMoveOptions | null | undefined, level: number, endgameMode: boolean): number | null {
    const opts = asRecord(options);
    const preferred = endgameMode ? opts.endgameMaxTimeMs : opts.maxTimeMs;
    if (isFiniteNumber(preferred)) {
        const n = Math.floor(Number(preferred));
        if (n <= 0) return null;
        return Math.max(50, Math.min(120_000, n));
    }
    if (endgameMode) return level >= 6 ? 12_000 : 8_000;
    if (level >= 6) return 2_200;
    return 1_200;
}

function resolveLookaheadVirtualTimePerNodeMs(options: CpuPolicyMoveOptions | null | undefined): number | null {
    const opts = asRecord(options);
    const preferred = Number(opts.virtualTimePerNodeMs);
    if (!Number.isFinite(preferred) || preferred <= 0) return null;
    return Math.max(0.001, Math.min(1_000, preferred));
}

function collectEmptyRegionParity(board: CpuPolicyBoard | null | undefined): CpuPolicyParityFeature {
    const out = {
        regionCount: 0,
        oddRegionCount: 0,
        evenRegionCount: 0,
        oddEmptyCount: 0,
        evenEmptyCount: 0,
        signal: 0,
        score: 0
    };
    if (!Array.isArray(board) || board.length <= 0) return out;

    const visited = new Set<string>();
    const dirs = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1]
    ];

    const cells = (
        SharedBoardUtils &&
        typeof SharedBoardUtils.collectBoardCoordinates === 'function'
    )
        ? SharedBoardUtils.collectBoardCoordinates(board)
        : null;

    const iter = Array.isArray(cells)
        ? cells
        : board.flatMap((row, r) => (Array.isArray(row) ? row.map((_, c) => ({ row: r, col: c })) : []));

    for (const cell of iter) {
        const r = Number(cell && cell.row);
        const c = Number(cell && cell.col);
        const value = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
            ? SharedBoardUtils.getCellValue(board, r, c)
            : (Array.isArray(board[r]) ? board[r][c] : null);
        if (value !== 0) continue;
        const rootKey = `${r},${c}`;
        if (visited.has(rootKey)) continue;

        let size = 0;
        const stack: CpuPolicyPosition[] = [{ row: r, col: c }];
        visited.add(rootKey);
        while (stack.length > 0) {
            const current = stack.pop();
            if (!current) break;
            const cr = current.row;
            const cc = current.col;
            size += 1;
            for (const d of dirs) {
                const nr = cr + d[0];
                const nc = cc + d[1];
                const nextValue = SharedBoardUtils && typeof SharedBoardUtils.getCellValue === 'function'
                    ? SharedBoardUtils.getCellValue(board, nr, nc)
                    : (inBoard(board, nr, nc) ? board[nr][nc] : null);
                if (!inBoard(board, nr, nc) || nextValue !== 0) continue;
                const nextKey = `${nr},${nc}`;
                if (visited.has(nextKey)) continue;
                visited.add(nextKey);
                stack.push({ row: nr, col: nc });
            }
        }

        out.regionCount += 1;
        if ((size % 2) === 1) {
            out.oddRegionCount += 1;
            out.oddEmptyCount += size;
        } else {
            out.evenRegionCount += 1;
            out.evenEmptyCount += size;
        }
    }

    return out;
}

function resolveLookaheadParityFeature(board: CpuPolicyBoard | null | undefined, empties: number): CpuPolicyParityFeature {
    const parity = collectEmptyRegionParity(board);
    if (!Number.isFinite(empties) || empties <= 0 || empties > 20 || parity.regionCount <= 0) {
        return Object.assign(parity, {
            signal: 0,
            score: 0
        });
    }

    const signal = (parity.oddRegionCount % 2 === 1) ? 1 : -1;
    const baseWeight = empties <= 8 ? 960 : (empties <= 12 ? 720 : (empties <= 16 ? 520 : 320));
    const oddRegionBias = Math.min(180, parity.oddRegionCount * 45);
    return Object.assign(parity, {
        signal,
        score: (signal * baseWeight) + (signal * oddRegionBias)
    });
}

function resolveForcedPassFeature(ownMoves: number, oppMoves: number, empties: number): { signal: number; score: number } {
    const noOwnMoves = !Number.isFinite(ownMoves) || ownMoves <= 0;
    const noOppMoves = !Number.isFinite(oppMoves) || oppMoves <= 0;
    if (noOwnMoves === noOppMoves) {
        return {
            signal: 0,
            score: 0
        };
    }
    const weight = empties <= 8 ? 2400 : (empties <= 14 ? 1650 : (empties <= 24 ? 980 : 460));
    return {
        signal: noOwnMoves ? -1 : 1,
        score: noOwnMoves ? -weight : weight
    };
}

function resolveLookaheadMixWeights(
    level: number,
    empties: number,
    priorWeight: number | null | undefined,
    searchWeight: number | null | undefined
): { priorWeight: number; searchWeight: number } {
    const resolved = {
        priorWeight: Number.isFinite(priorWeight) ? Number(priorWeight) : 120,
        searchWeight: Number.isFinite(searchWeight) ? Number(searchWeight) : 1
    };
    if (!Number.isFinite(level) || level < 6) return resolved;

    if (empties <= 12) {
        resolved.priorWeight *= 0.18;
        resolved.searchWeight *= 1.22;
    } else if (empties <= 20) {
        resolved.priorWeight *= 0.34;
        resolved.searchWeight *= 1.15;
    } else if (empties <= 28) {
        resolved.priorWeight *= 0.58;
        resolved.searchWeight *= 1.08;
    }

    return resolved;
}

function hashBonusCellCoord(row: number, col: number): number {
    const r = (Number(row) | 0) + 1;
    const c = (Number(col) | 0) + 1;
    const mixed = Math.imul(r, 0x9e3779b1) ^ Math.imul(c, 0x85ebca6b);
    return (mixed >>> 0);
}

function parseBonusCellKey(key: string): CpuPolicyPosition | null {
    const raw = String(key || '');
    const sep = raw.indexOf(',');
    if (sep <= 0 || sep >= raw.length - 1) return null;
    const row = Number(raw.slice(0, sep));
    const col = Number(raw.slice(sep + 1));
    if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
    return { row, col };
}

function createConsumedBonusMap(boardBonusConsumedByCell: Record<string, boolean> | CpuPolicyBonusConsumedMap | null | undefined): CpuPolicyBonusConsumedMap {
    const out: CpuPolicyBonusConsumedMap = Object.create(null);
    out.__bonusHash = 0;
    out.__bonusCount = 0;
    if (!boardBonusConsumedByCell || typeof boardBonusConsumedByCell !== 'object') return out;
    for (const key of Object.keys(boardBonusConsumedByCell)) {
        if (boardBonusConsumedByCell[key] !== true) continue;
        const parsed = parseBonusCellKey(key);
        if (!parsed) continue;
        out[key] = true;
        out.__bonusHash = (Number(out.__bonusHash) ^ hashBonusCellCoord(parsed.row, parsed.col)) >>> 0;
        out.__bonusCount = (Number(out.__bonusCount) || 0) + 1;
    }
    return out;
}

function consumeBonusCell(consumedMap: CpuPolicyBonusConsumedMap | null | undefined, row: number, col: number): CpuPolicyBonusConsumedMap {
    const key = `${row},${col}`;
    if (consumedMap && consumedMap[key] === true) return consumedMap || Object.create(null);
    const next: CpuPolicyBonusConsumedMap = Object.assign(Object.create(null), consumedMap || null);
    next[key] = true;
    const prevHash = Number(consumedMap && consumedMap.__bonusHash) >>> 0;
    const prevCount = Math.max(0, Number(consumedMap && consumedMap.__bonusCount) || 0);
    next.__bonusHash = (prevHash ^ hashBonusCellCoord(row, col)) >>> 0;
    next.__bonusCount = prevCount + 1;
    return next;
}

function getMoveChargeGain(
    move: CpuPolicyMove | null | undefined,
    boardBonusByCell: Record<string, number> | null | undefined,
    consumedMap: Record<string, boolean> | CpuPolicyBonusConsumedMap | null | undefined
): number {
    if (!move) return 0;
    const flips = Array.isArray(move.flips) ? move.flips.length : 0;
    const row = isFiniteNumber(move.row) ? Number(move.row) : -1;
    const col = isFiniteNumber(move.col) ? Number(move.col) : -1;
    const bonus = getBoardBonusAtCell(boardBonusByCell, consumedMap as Record<string, boolean>, row, col);
    return flips + bonus;
}

function evaluateBoardForLookahead(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    const disc = countBoardDiscsForPlayer(board, playerValue);
    const discDiff = disc.own - disc.opp;
    const empties = Number.isFinite(disc.empties) ? disc.empties : 0;
    const discWeight = empties <= 10 ? 34 : (empties <= 22 ? 16 : 8);

    const ownCorners = countCornersFor(board, playerValue);
    const oppCorners = countCornersFor(board, -playerValue);
    const cornerDiff = ownCorners - oppCorners;

    const ownEdges = countEdgesFor(board, playerValue);
    const oppEdges = countEdgesFor(board, -playerValue);
    const edgeDiff = ownEdges - oppEdges;

    const ownMoves = getLegalMovesBasic(board, playerValue).length;
    const oppMoves = getLegalMovesBasic(board, -playerValue).length;
    const mobilityDiff = ownMoves - oppMoves;
    const passPressure = resolveForcedPassFeature(ownMoves, oppMoves, empties);
    const ownCornerMoves = countCornerMovesFor(board, playerValue);
    const oppCornerMoves = countCornerMovesFor(board, -playerValue);
    const cornerMobilityDiff = ownCornerMoves - oppCornerMoves;
    const ownFrontier = countFrontierDiscsFor(board, playerValue);
    const oppFrontier = countFrontierDiscsFor(board, -playerValue);
    const frontierDiff = oppFrontier - ownFrontier;
    const ownAnchoredEdges = countAnchoredEdgeDiscsFromCorners(board, playerValue);
    const oppAnchoredEdges = countAnchoredEdgeDiscsFromCorners(board, -playerValue);
    const anchoredEdgeDiff = ownAnchoredEdges - oppAnchoredEdges;

    const ownRisk = countXsAndCsFor(board, playerValue);
    const oppRisk = countXsAndCsFor(board, -playerValue);
    const parityFeature = resolveLookaheadParityFeature(board, empties);

    return (
        (cornerDiff * 3400) +
        (edgeDiff * 180) +
        (anchoredEdgeDiff * 320) +
        (mobilityDiff * 225) +
        passPressure.score +
        (cornerMobilityDiff * 1450) +
        (frontierDiff * 105) +
        (discDiff * discWeight) +
        parityFeature.score +
        ((oppRisk.x - ownRisk.x) * 520) +
        ((oppRisk.c - ownRisk.c) * 230)
    );
}

function evaluateTerminalBoardForLookahead(board: CpuPolicyBoard | null | undefined, playerValue: number): number {
    const disc = countBoardDiscsForPlayer(board, playerValue);
    const diff = disc.own - disc.opp;
    if (diff === 0) return 0;
    const score = 1_000_000 + (Math.abs(diff) * 10_000);
    return diff > 0 ? score : -score;
}

function buildBoardSearchKey(
    board: CpuPolicyBoard,
    currentPlayer: number,
    depthLeft: number,
    passed: boolean,
    consumedMap: CpuPolicyBonusConsumedMap | null | undefined
): string {
    let out = currentPlayer > 0 ? '1' : '2';
    out += `:${depthLeft}:${passed ? 1 : 0}:`;
    if (SharedBoardUtils && typeof SharedBoardUtils.encodeBoard === 'function') {
        out += SharedBoardUtils.encodeBoard(board);
    } else {
        for (let r = 0; r < board.length; r++) {
            const row = Array.isArray(board[r]) ? board[r] : [];
            for (let c = 0; c < row.length; c++) {
                const v = row[c];
                if (v === 1) out += '1';
                else if (v === -1) out += '2';
                else out += '0';
            }
        }
    }
    const consumedHash = Number(consumedMap && consumedMap.__bonusHash) >>> 0;
    const consumedCount = Math.max(0, Number(consumedMap && consumedMap.__bonusCount) || 0);
    out += `:${consumedHash.toString(36)}:${consumedCount}`;
    return out;
}

function buildSearchMoveOrder(moves: CpuPolicyMove[], params: CpuPolicySearchMoveParams): CpuPolicyMove[] {
    const p = params || {};
    const level = isFiniteNumber(p.level) ? Number(p.level) : 6;
    const board = Array.isArray(p.board) ? p.board : [];
    const playerValue = isFiniteNumber(p.playerValue) ? (Number(p.playerValue) >= 0 ? 1 : -1) : 1;
    const boardBonusByCell: Record<string, number> | null = p.boardBonusByCell && typeof p.boardBonusByCell === 'object'
        ? p.boardBonusByCell as Record<string, number>
        : null;
    const consumedMap = p.boardBonusConsumedByCell && typeof p.boardBonusConsumedByCell === 'object'
        ? p.boardBonusConsumedByCell
        : Object.create(null);
    const priorFn = typeof p.rootPriorScoreFn === 'function' ? p.rootPriorScoreFn : null;
    const priorWeight = Number.isFinite(p.priorWeight) ? Number(p.priorWeight) : 120;
    const branchLimit = isFiniteNumber(p.branchLimit) ? Math.max(2, Math.floor(Number(p.branchLimit))) : null;
    const geom = resolveBoardGeometry(board);
    const tieMaxR = geom.maxR >= 0 ? geom.maxR : 7;
    const tieMaxC = geom.maxC >= 0 ? geom.maxC : 7;

    const scored = (Array.isArray(moves) ? moves : []).map((move, idx) => {
        let planScore = 0;
        try {
            planScore = Number(scoreMoveForCornerEdgePlan(move, {
                level,
                board,
                playerValue,
                boardBonusByCell,
                boardBonusConsumedByCell: consumedMap
            }) || 0);
        } catch (e) {
            planScore = Number(scoreMoveHeuristic(move, level, board) || 0);
        }
        const chargeGain = getMoveChargeGain(move, boardBonusByCell, consumedMap);
        const gainScore = chargeGain * 95;
        const priorScore = priorFn ? (normalizePriorScore(priorFn(move)) * priorWeight) : 0;
        let tacticalPreviewScore = 0;
        if (level >= 6 && board && inBoard(board, Number(move && move.row), Number(move && move.col))) {
            try {
                const after = applyMoveToBoard(board, move, playerValue);
                const oppMovesAfter = getLegalMovesBasic(after, -playerValue);
                const oppCornerMovesAfter = countCornerMovesFor(after, -playerValue);
                const ownCornerMovesAfter = countCornerMovesFor(after, playerValue);
                const ownFrontierAfter = countFrontierDiscsFor(after, playerValue);
                const oppFrontierAfter = countFrontierDiscsFor(after, -playerValue);
                tacticalPreviewScore += Math.max(-2200, (16 - oppMovesAfter.length) * 145);
                const oppCornerPenalty = level >= 6 ? 9800 : 6200;
                tacticalPreviewScore -= oppCornerMovesAfter * oppCornerPenalty;
                tacticalPreviewScore += ownCornerMovesAfter * 1800;
                tacticalPreviewScore += Math.max(-1800, Math.min(1800, (oppFrontierAfter - ownFrontierAfter) * 75));
            } catch (e) {
                tacticalPreviewScore += 0;
            }
        }
        const row = isFiniteNumber(move && move.row) ? Number(move.row) : 0;
        const col = isFiniteNumber(move && move.col) ? Number(move.col) : 0;
        const tie = (tieMaxR - row) * 0.001 + (tieMaxC - col) * 0.0001 + ((moves.length - idx) * 0.00001);
        return {
            move,
            score: planScore + gainScore + priorScore + tacticalPreviewScore + tie
        };
    });

    scored.sort((a, b) => b.score - a.score);
    const ordered = scored.map((one) => one.move);
    return branchLimit ? ordered.slice(0, branchLimit) : ordered;
}

function chooseMoveByLookahead(candidateMoves: CpuPolicyMove[], options?: CpuPolicyMoveOptions | null): CpuPolicyMove | null {
    if (!Array.isArray(candidateMoves) || candidateMoves.length === 0) return null;
    const opts = options || {};
    const board = Array.isArray(opts.board) ? opts.board : null;
    if (!board) return null;
    const playerValue = isFiniteNumber(opts.playerValue) ? (Number(opts.playerValue) >= 0 ? 1 : -1) : 1;
    const level = isFiniteNumber(opts.level) ? Math.max(1, Math.floor(Number(opts.level))) : 6;
    const boardStat = countBoardDiscsForPlayer(board, playerValue);
    const empties = Number.isFinite(boardStat.empties) ? boardStat.empties : 0;
    const endgameSolveEmpties = isFiniteNumber(opts.endgameSolveEmpties)
        ? Math.max(4, Math.min(48, Math.floor(Number(opts.endgameSolveEmpties))))
        : 30;
    const endgameMode = level >= 6 && opts.disableEndgameSolve !== true && empties <= endgameSolveEmpties;
    const depth = endgameMode
        ? resolveLookaheadEndgameDepth(opts, empties)
        : resolveLookaheadDepth(board, level, opts.depth);
    const branchLimit = endgameMode ? null : resolveLookaheadBranch(board, opts.maxBranch);
    const nodeBudget = resolveLookaheadNodeBudget(
        endgameMode ? opts.endgameNodeBudget : opts.nodeBudget,
        depth,
        branchLimit,
        endgameMode
    );
    const timeBudgetMs = resolveLookaheadTimeBudgetMs(opts, level, endgameMode);
    let visited = 0;
    let budgetHit = false;
    let timeHit = false;
    const virtualTimePerNodeMs = resolveLookaheadVirtualTimePerNodeMs(opts);
    const readNowMs = virtualTimePerNodeMs !== null
        ? () => visited * virtualTimePerNodeMs
        : () => Date.now();
    const deadlineMs = timeBudgetMs !== null ? (readNowMs() + timeBudgetMs) : null;
    const boardBonusByCell: Record<string, number> | null = opts.boardBonusByCell && typeof opts.boardBonusByCell === 'object'
        ? opts.boardBonusByCell
        : null;
    const baseConsumedMap = createConsumedBonusMap(opts.boardBonusConsumedByCell);
    const priorFn = typeof opts.scoreMove === 'function' ? opts.scoreMove : null;
    const mixWeights = resolveLookaheadMixWeights(
        level,
        empties,
        Number.isFinite(opts.priorWeight) ? Number(opts.priorWeight) : 120,
        Number.isFinite(opts.searchWeight) ? Number(opts.searchWeight) : 1
    );
    const priorWeight = mixWeights.priorWeight;
    const searchWeight = mixWeights.searchWeight;
    const rootOwnMoves = getLegalMovesBasic(board, playerValue).length;
    const rootOppMoves = getLegalMovesBasic(board, -playerValue).length;
    const rootParity = resolveLookaheadParityFeature(board, empties);
    const rootPassPressure = resolveForcedPassFeature(rootOwnMoves, rootOppMoves, empties);
    const transposition = new Map<string, number>();
    const transpositionLimit = (() => {
        const base = endgameMode ? 400_000 : 80_000;
        const scaled = Math.floor((Number(nodeBudget) || 0) * 0.6);
        const cap = endgameMode ? 2_200_000 : 1_200_000;
        return Math.max(base, Math.min(cap, scaled));
    })();

    if (typeof opts.onSearchMeta === 'function') {
        try {
            opts.onSearchMeta({
                endgameMode,
                empties,
                depth,
                branchLimit,
                nodeBudget,
                timeBudgetMs,
                ownMoves: rootOwnMoves,
                oppMoves: rootOppMoves,
                effectivePriorWeight: priorWeight,
                effectiveSearchWeight: searchWeight,
                parityOddRegionCount: rootParity.oddRegionCount,
                parityEvenRegionCount: rootParity.evenRegionCount,
                paritySignal: rootParity.signal,
                forcedPassSignal: rootPassPressure.signal
            });
        } catch (_) {
            // ignore diagnostic callback errors
        }
    }

    function storeTransposition(key: string, value: number): number {
        if (!key || !Number.isFinite(value)) return value;
        if (transposition.size >= transpositionLimit) transposition.clear();
        transposition.set(key, value);
        return value;
    }

    function negamax(
        boardNode: CpuPolicyBoard,
        currentPlayer: number,
        depthLeft: number,
        alpha: number,
        beta: number,
        passed: boolean,
        consumedMap: CpuPolicyBonusConsumedMap
    ): number {
        if (deadlineMs !== null && readNowMs() >= deadlineMs) {
            timeHit = true;
            return evaluateBoardForLookahead(boardNode, currentPlayer);
        }
        if (visited >= nodeBudget) {
            budgetHit = true;
            return evaluateBoardForLookahead(boardNode, currentPlayer);
        }
        visited += 1;

        if (depthLeft <= 0) {
            return evaluateBoardForLookahead(boardNode, currentPlayer);
        }

        const transpositionKey = buildBoardSearchKey(boardNode, currentPlayer, depthLeft, passed, consumedMap);
        if (transposition.has(transpositionKey)) {
            const cached = transposition.get(transpositionKey);
            if (cached !== undefined) return cached;
        }

        const legal = getLegalMovesBasic(boardNode, currentPlayer);
        if (!Array.isArray(legal) || legal.length <= 0) {
            if (passed) {
                const terminalScore = endgameMode
                    ? evaluateTerminalBoardForLookahead(boardNode, currentPlayer)
                    : evaluateBoardForLookahead(boardNode, currentPlayer);
                return storeTransposition(transpositionKey, terminalScore);
            }
            const passedScore: number = -negamax(boardNode, -currentPlayer, depthLeft - 1, -beta, -alpha, true, consumedMap);
            return storeTransposition(transpositionKey, passedScore);
        }

        const ordered = buildSearchMoveOrder(legal, {
            level,
            board: boardNode,
            playerValue: currentPlayer,
            boardBonusByCell,
            boardBonusConsumedByCell: consumedMap,
            branchLimit
        });

        let best = Number.NEGATIVE_INFINITY;
        for (const move of ordered) {
            const immediate = getMoveChargeGain(move, boardBonusByCell, consumedMap) * 70;
            const bonusAtCell = getBoardBonusAtCell(boardBonusByCell, consumedMap, Number(move.row), Number(move.col));
            const nextConsumed = bonusAtCell > 0
                ? consumeBonusCell(consumedMap, Number(move.row), Number(move.col))
                : consumedMap;
            const nextBoard = applyMoveToBoard(boardNode, move, currentPlayer);
            const child = -negamax(nextBoard, -currentPlayer, depthLeft - 1, -beta, -alpha, false, nextConsumed);
            const score = immediate + child;
            if (score > best) best = score;
            if (score > alpha) alpha = score;
            if (alpha >= beta || budgetHit || timeHit) break;
        }
        return storeTransposition(transpositionKey, best);
    }

    const orderedRootBase = buildSearchMoveOrder(candidateMoves, {
        level,
        board,
        playerValue,
        boardBonusByCell,
        boardBonusConsumedByCell: baseConsumedMap,
        rootPriorScoreFn: priorFn,
        priorWeight,
        branchLimit
    });

    const sameMove = (a: CpuPolicyMove | null | undefined, b: CpuPolicyMove | null | undefined): boolean => !!a && !!b && Number(a.row) === Number(b.row) && Number(a.col) === Number(b.col);
    const reorderRootMoves = (moves: CpuPolicyMove[], firstMove: CpuPolicyMove | null): CpuPolicyMove[] => {
        if (!firstMove || !Array.isArray(moves) || moves.length <= 1) return moves;
        const top: CpuPolicyMove[] = [];
        const rest: CpuPolicyMove[] = [];
        for (const mv of moves) {
            if (top.length === 0 && sameMove(mv, firstMove)) top.push(mv);
            else rest.push(mv);
        }
        return top.length > 0 ? top.concat(rest) : moves;
    };

    const searchRootAtDepth = (depthToUse: number, rootMoves: CpuPolicyMove[]): { move: CpuPolicyMove | null; score: number } => {
        let localBestMove: CpuPolicyMove | null = null;
        let localBestScore = Number.NEGATIVE_INFINITY;
        for (const move of rootMoves) {
            const immediate = getMoveChargeGain(move, boardBonusByCell, baseConsumedMap) * 85;
            const bonusAtCell = getBoardBonusAtCell(boardBonusByCell, baseConsumedMap, Number(move.row), Number(move.col));
            const nextConsumed = bonusAtCell > 0
                ? consumeBonusCell(baseConsumedMap, Number(move.row), Number(move.col))
                : baseConsumedMap;
            const nextBoard = applyMoveToBoard(board, move, playerValue);
            const childScore = -negamax(
                nextBoard,
                -playerValue,
                depthToUse - 1,
                Number.NEGATIVE_INFINITY,
                Number.POSITIVE_INFINITY,
                false,
                nextConsumed
            );
            const prior = priorFn ? (normalizePriorScore(priorFn(move)) * priorWeight) : 0;
            const total = ((childScore + immediate) * searchWeight) + prior;
            if (total > localBestScore) {
                localBestScore = total;
                localBestMove = move;
            } else if (total === localBestScore && localBestMove) {
                const bestRow = Number(localBestMove.row);
                const bestCol = Number(localBestMove.col);
                const row = Number(move.row);
                const col = Number(move.col);
                if (row < bestRow || (row === bestRow && col < bestCol)) {
                    localBestMove = move;
                }
            }
            if (budgetHit || timeHit) break;
        }
        return {
            move: localBestMove,
            score: localBestScore
        };
    };

    let bestMove = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    let rootMoves = orderedRootBase;

    if (!endgameMode && depth >= 6) {
        const schedule = [];
        if (depth <= 8) {
            schedule.push(4, 6, depth);
        } else if (depth <= 12) {
            schedule.push(4, 6, 8, 10, depth);
        } else {
            schedule.push(5, 7, 9, 11, 13, depth);
        }
        const seen = new Set();
        for (const d of schedule) {
            const depthStep = Math.max(2, Math.min(depth, Math.floor(d)));
            if (seen.has(depthStep)) continue;
            seen.add(depthStep);
            const out = searchRootAtDepth(depthStep, rootMoves);
            if (out.move) {
                bestMove = out.move;
                bestScore = out.score;
                rootMoves = reorderRootMoves(rootMoves, out.move);
            }
            if (budgetHit || timeHit) break;
        }
    } else {
        const out = searchRootAtDepth(depth, rootMoves);
        bestMove = out.move;
        bestScore = out.score;
    }

    if (!bestMove && orderedRootBase.length > 0) bestMove = orderedRootBase[0];
    if (!bestMove && candidateMoves.length > 0) bestMove = candidateMoves[0];
    if ((budgetHit || timeHit) && !bestMove && candidateMoves.length > 0) return candidateMoves[0];

    if (bestMove && level >= 6) {
        const ownAnchoredEdgesBefore = countAnchoredEdgeDiscsFromCorners(board, playerValue);
        const rankedAllMoves = buildSearchMoveOrder(candidateMoves, {
            level,
            board,
            playerValue,
            boardBonusByCell,
            boardBonusConsumedByCell: baseConsumedMap,
            rootPriorScoreFn: priorFn,
            priorWeight,
            branchLimit: null
        });

        // Hard guard #1 (Lv6): if a corner is available, always take a corner.
        if (!isCorner(bestMove.row, bestMove.col, board)) {
            const cornerMove = rankedAllMoves.find((move) => move && isCorner(move.row, move.col, board));
            if (cornerMove) {
                bestMove = cornerMove;
            }
        }

        // Hard guard #2 (Lv6): avoid immediate corner donation if a safe alternative exists.
        if (!isCorner(bestMove.row, bestMove.col, board)) {
            const selectedRisk = evaluateImmediateCornerDonation(board, bestMove, playerValue);
            if (selectedRisk.donatesCornerNow) {
                for (const move of rankedAllMoves) {
                    if (!move || sameMove(move, bestMove)) continue;
                    const altRisk = evaluateImmediateCornerDonation(board, move, playerValue);
                    if (altRisk.donatesCornerNow) continue;
                    bestMove = move;
                    break;
                }
            }
        }

        // Hard guard #3 (Lv6): while leading in corners, prefer stable edge consolidation over inner moves.
        if (!isCorner(bestMove.row, bestMove.col, board) && !isEdge(bestMove.row, bestMove.col, board)) {
            const ownCornersNow = countCornersFor(board, playerValue);
            const oppCornersNow = countCornersFor(board, -playerValue);
            if (ownCornersNow > oppCornersNow) {
                const selectedRisk = evaluateImmediateCornerDonation(board, bestMove, playerValue);
                const selectedProfile = evaluateMoveStabilityProfile(board, bestMove, playerValue, ownAnchoredEdgesBefore);
                for (const move of rankedAllMoves) {
                    if (!move) continue;
                    if (isCorner(move.row, move.col, board)) continue;
                    if (!isEdge(move.row, move.col, board)) continue;
                    const altRisk = evaluateImmediateCornerDonation(board, move, playerValue);
                    if (altRisk.donatesCornerNow) continue;
                    const altProfile = evaluateMoveStabilityProfile(board, move, playerValue, ownAnchoredEdgesBefore);
                    const meaningfullyMoreStable = (
                        altProfile.anchoredEdgeDelta > selectedProfile.anchoredEdgeDelta ||
                        altProfile.stabilityProxy > (selectedProfile.stabilityProxy + 0.75)
                    );
                    if (!meaningfullyMoreStable) continue;
                    bestMove = move;
                    break;
                }
            }
        }

        // Hard guard #4 (Lv6): even without corner lead, prefer a safe edge over an inner move when no corner exists.
        if (!isCorner(bestMove.row, bestMove.col, board) && !isEdge(bestMove.row, bestMove.col, board)) {
            const anyCornerExists = rankedAllMoves.some((move) => move && isCorner(move.row, move.col, board));
            if (!anyCornerExists) {
                const selectedRisk = evaluateImmediateCornerDonation(board, bestMove, playerValue);
                const selectedProfile = evaluateMoveStabilityProfile(board, bestMove, playerValue, ownAnchoredEdgesBefore);
                for (const move of rankedAllMoves) {
                    if (!move) continue;
                    if (isCorner(move.row, move.col, board)) continue;
                    if (!isEdge(move.row, move.col, board)) continue;
                    const altRisk = evaluateImmediateCornerDonation(board, move, playerValue);
                    if (altRisk.donatesCornerNow) continue;
                    const altProfile = evaluateMoveStabilityProfile(board, move, playerValue, ownAnchoredEdgesBefore);
                    const meaningfullySaferEdge = altProfile.anchoredEdgeDelta > 0;
                    if (!meaningfullySaferEdge) continue;
                    bestMove = move;
                    break;
                }
            }
        }
    }

    return bestMove;
}

const cpuPolicyCoreApi: CpuPolicyCoreApi = createCpuPolicyCoreApi({
    chooseHandDestroyTargetForCycle,
    chooseCardWithRiskProfile,
    chooseHighestCostCard,
    chooseLowestRetentionCard,
    chooseSellCardTargetByRetention: chooseLowestRetentionCard,
    chooseMoveByLookahead,
    chooseMove,
    computeLegalMoveMetrics,
    getMovePlanProfileForCardType,
    isChargeRampCardType,
    isCornerHoldCardType,
    isCornerRecoveryCardType,
    hasBaseScoreBonusForCardType,
    hasMovePlanProfileForCardType,
    hasUsageStyleForCardType,
    scoreCardRetentionForSell: scoreCardRetentionPriority,
    scoreCardRetentionPriority,
    scoreCardUseDecision,
    scoreMoveForCornerEdgePlan,
    scoreMoveHeuristic
});

module.exports = cpuPolicyCoreApi;
