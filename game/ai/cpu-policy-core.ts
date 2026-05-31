/* eslint-disable @typescript-eslint/no-explicit-any */
import type {
    CpuPolicyBoard,
    CpuPolicyBoardBonusResolver,
    CpuPolicyCardContext,
    CpuPolicyCardCostResolver,
    CpuPolicyCardDefinitionResolver,
    CpuPolicyCardId,
    CpuPolicyCardScore,
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

type CpuPolicyMovePlanProfile = Record<string, string | number>;
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
const CpuPolicyBoardPrimitivesModule = requireOptionalModule('./cpu-policy-board-primitives');
const CpuPolicyCardProfilesModule = requireOptionalModule('./cpu-policy-card-profiles');
const CpuPolicyCardHelpersModule = requireOptionalModule('./cpu-policy-card-helpers');
const CpuPolicyBoardCountsModule = requireOptionalModule('./cpu-policy-board-counts');
const CpuPolicyBoardFeaturesModule = requireOptionalModule('./cpu-policy-board-features');
const CpuPolicyLookaheadConfigModule = requireOptionalModule('./cpu-policy-lookahead-config');
const CpuPolicyLookaheadBonusModule = requireOptionalModule('./cpu-policy-lookahead-bonus');
const CpuPolicyLookaheadParityModule = requireOptionalModule('./cpu-policy-lookahead-parity');
const CpuPolicySearchKeyModule = requireOptionalModule('./cpu-policy-search-key');
const CpuPolicyLookaheadEvaluationModule = requireOptionalModule('./cpu-policy-lookahead-evaluation');
const CpuPolicySearchOrderModule = requireOptionalModule('./cpu-policy-search-order');
const CpuPolicyPlacementProfilesModule = requireOptionalModule('./cpu-policy-placement-profiles');
const CpuPolicyMovePlanScoringModule = requireOptionalModule('./cpu-policy-move-plan-scoring');
const CpuPolicyMoveSelectionModule = requireOptionalModule('./cpu-policy-move-selection');
const CpuPolicyDecisionContextModule = requireOptionalModule('./cpu-policy-decision-context');
const CpuPolicyCardTypeFlagsModule = requireOptionalModule('./cpu-policy-card-type-flags');
const CpuPolicyCardUseStateModule = requireOptionalModule('./cpu-policy-card-use-state');
const CpuPolicyCardRetentionStateModule = requireOptionalModule('./cpu-policy-card-retention-state');
const CpuPolicyRetentionScoreModule = requireOptionalModule('./cpu-policy-retention-score');
const CpuPolicyHandDestroyCycleModule = requireOptionalModule('./cpu-policy-hand-destroy-cycle');
const CpuPolicyHandDestroyScoreModule = requireOptionalModule('./cpu-policy-hand-destroy-score');
const CpuPolicyLookaheadGuardsModule = requireOptionalModule('./cpu-policy-lookahead-guards');
const CpuPolicyLookaheadRootSearchModule = requireOptionalModule('./cpu-policy-lookahead-root-search');
const CpuPolicyLookaheadPreludeModule = requireOptionalModule('./cpu-policy-lookahead-prelude');
const CpuPolicyLookaheadNegamaxModule = requireOptionalModule('./cpu-policy-lookahead-negamax');
const CpuPolicyLookaheadControllerModule = requireOptionalModule('./cpu-policy-lookahead-controller');
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
    'SUPPORT_TROOPS_WILL',
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
    'SUPPORT_TROOPS_WILL',
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
            'OBSERVER_WILL',
            'THEORY_INCARNATION'
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
        'OBSERVER_WILL',
        'THEORY_INCARNATION'
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
    'THEORY_INCARNATION',
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
    'SUPPORT_TROOPS_WILL',
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
    'SUPPORT_TROOPS_WILL',
    'CORROSION_WILL',
    'SALVATION_WILL',
    'EXECUTION_WILL',
    'CORNER_TRIBUTE'
]);

const LOW_CHARGE_DESTROY_MAX_CHARGE = 50;
const CpuPolicyCardProfiles = (
    CpuPolicyCardProfilesModule &&
    typeof CpuPolicyCardProfilesModule.createCpuPolicyCardProfiles === 'function'
)
    ? CpuPolicyCardProfilesModule.createCpuPolicyCardProfiles({
        chainWillCardTypes: CHAIN_WILL_CARD_TYPES
    })
    : {
        CARD_TYPE_BASE_SCORE_BONUS: Object.freeze({}),
        CARD_TYPE_USAGE_STYLE: Object.freeze({}),
        CARD_TYPE_MOVE_PLAN_PROFILE: Object.freeze({})
    };
const CARD_TYPE_BASE_SCORE_BONUS = CpuPolicyCardProfiles.CARD_TYPE_BASE_SCORE_BONUS;
const CARD_TYPE_USAGE_STYLE = CpuPolicyCardProfiles.CARD_TYPE_USAGE_STYLE;
const CARD_TYPE_MOVE_PLAN_PROFILE = CpuPolicyCardProfiles.CARD_TYPE_MOVE_PLAN_PROFILE;

let CpuPolicyBoardPrimitivesCache: any = null;
let CpuPolicyCardHelpersCache: any = null;
let CpuPolicyBoardCountsCache: any = null;
let CpuPolicyBoardFeaturesCache: any = null;
let CpuPolicyLookaheadConfigCache: any = null;
let CpuPolicyLookaheadBonusCache: any = null;
let CpuPolicyLookaheadParityCache: any = null;
let CpuPolicySearchKeyCache: any = null;
let CpuPolicyLookaheadEvaluationCache: any = null;
let CpuPolicySearchOrderCache: any = null;
let CpuPolicyPlacementProfilesCache: any = null;
let CpuPolicyMovePlanScoringCache: any = null;
let CpuPolicyMoveSelectionCache: any = null;
let CpuPolicyDecisionContextCache: any = null;
let CpuPolicyCardTypeFlagsCache: any = null;
let CpuPolicyCardUseStateCache: any = null;
let CpuPolicyCardRetentionStateCache: any = null;
let CpuPolicyRetentionScoreCache: any = null;
let CpuPolicyHandDestroyCycleCache: any = null;
let CpuPolicyHandDestroyScoreCache: any = null;
let CpuPolicyLookaheadGuardsCache: any = null;
let CpuPolicyLookaheadRootSearchCache: any = null;
let CpuPolicyLookaheadPreludeCache: any = null;
let CpuPolicyLookaheadNegamaxCache: any = null;
let CpuPolicyLookaheadControllerCache: any = null;

function getCpuPolicyBoardPrimitives() {
    if (CpuPolicyBoardPrimitivesCache) return CpuPolicyBoardPrimitivesCache;
    if (!CpuPolicyBoardPrimitivesModule || typeof CpuPolicyBoardPrimitivesModule.createCpuPolicyBoardPrimitives !== 'function') {
        return null;
    }
    CpuPolicyBoardPrimitivesCache = CpuPolicyBoardPrimitivesModule.createCpuPolicyBoardPrimitives({
        SharedBoardUtils,
        OthelloCore,
        isFiniteNumber
    });
    return CpuPolicyBoardPrimitivesCache;
}

function requireCpuPolicyBoardPrimitives() {
    const primitives = getCpuPolicyBoardPrimitives();
    if (!primitives) {
        throw new Error('[cpu-policy-core] cpu-policy-board-primitives module is not available');
    }
    return primitives;
}

function getCpuPolicyCardHelpers() {
    if (CpuPolicyCardHelpersCache) return CpuPolicyCardHelpersCache;
    if (!CpuPolicyCardHelpersModule || typeof CpuPolicyCardHelpersModule.createCpuPolicyCardHelpers !== 'function') {
        return null;
    }
    CpuPolicyCardHelpersCache = CpuPolicyCardHelpersModule.createCpuPolicyCardHelpers({
        SharedCardHeuristics,
        CORNER_RECOVERY_CARD_TYPES,
        CORNER_HOLD_CARD_TYPES,
        CHARGE_RAMP_CARD_TYPES,
        CARD_TYPE_USAGE_STYLE,
        CARD_TYPE_BASE_SCORE_BONUS,
        CARD_TYPE_MOVE_PLAN_PROFILE,
        IMMEDIATE_DESTROY_CARD_TYPES,
        LOW_CHARGE_DESTROY_CARD_TYPES,
        LOW_CHARGE_DESTROY_MAX_CHARGE,
        CONDITION_DEPENDENT_DESTROY_CARD_TYPES,
        asRecord,
        isFiniteNumber
    });
    return CpuPolicyCardHelpersCache;
}

function requireCpuPolicyCardHelpers() {
    const helpers = getCpuPolicyCardHelpers();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-card-helpers module is not available');
    }
    return helpers;
}

function getCpuPolicyBoardCounts() {
    if (CpuPolicyBoardCountsCache) return CpuPolicyBoardCountsCache;
    if (!CpuPolicyBoardCountsModule || typeof CpuPolicyBoardCountsModule.createCpuPolicyBoardCounts !== 'function') {
        return null;
    }
    CpuPolicyBoardCountsCache = CpuPolicyBoardCountsModule.createCpuPolicyBoardCounts({
        SharedBoardUtils,
        isFiniteNumber
    });
    return CpuPolicyBoardCountsCache;
}

function requireCpuPolicyBoardCounts() {
    const helpers = getCpuPolicyBoardCounts();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-board-counts module is not available');
    }
    return helpers;
}

function getCpuPolicyBoardFeatures() {
    if (CpuPolicyBoardFeaturesCache) return CpuPolicyBoardFeaturesCache;
    if (!CpuPolicyBoardFeaturesModule || typeof CpuPolicyBoardFeaturesModule.createCpuPolicyBoardFeatures !== 'function') {
        return null;
    }
    CpuPolicyBoardFeaturesCache = CpuPolicyBoardFeaturesModule.createCpuPolicyBoardFeatures({
        SharedBoardUtils,
        inBoard,
        isXSquare,
        isCSquare,
        hasOwnedAdjacentCorner,
        getLegalMovesBasic,
        isCorner
    });
    return CpuPolicyBoardFeaturesCache;
}

function requireCpuPolicyBoardFeatures() {
    const helpers = getCpuPolicyBoardFeatures();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-board-features module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadConfig() {
    if (CpuPolicyLookaheadConfigCache) return CpuPolicyLookaheadConfigCache;
    if (!CpuPolicyLookaheadConfigModule || typeof CpuPolicyLookaheadConfigModule.createCpuPolicyLookaheadConfig !== 'function') {
        return null;
    }
    CpuPolicyLookaheadConfigCache = CpuPolicyLookaheadConfigModule.createCpuPolicyLookaheadConfig({
        countBoardDiscsForPlayer,
        asRecord,
        isFiniteNumber
    });
    return CpuPolicyLookaheadConfigCache;
}

function requireCpuPolicyLookaheadConfig() {
    const helpers = getCpuPolicyLookaheadConfig();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-config module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadBonus() {
    if (CpuPolicyLookaheadBonusCache) return CpuPolicyLookaheadBonusCache;
    if (!CpuPolicyLookaheadBonusModule || typeof CpuPolicyLookaheadBonusModule.createCpuPolicyLookaheadBonus !== 'function') {
        return null;
    }
    CpuPolicyLookaheadBonusCache = CpuPolicyLookaheadBonusModule.createCpuPolicyLookaheadBonus({
        isFiniteNumber,
        getBoardBonusAtCell
    });
    return CpuPolicyLookaheadBonusCache;
}

function requireCpuPolicyLookaheadBonus() {
    const helpers = getCpuPolicyLookaheadBonus();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-bonus module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadParity() {
    if (CpuPolicyLookaheadParityCache) return CpuPolicyLookaheadParityCache;
    if (!CpuPolicyLookaheadParityModule || typeof CpuPolicyLookaheadParityModule.createCpuPolicyLookaheadParity !== 'function') {
        return null;
    }
    CpuPolicyLookaheadParityCache = CpuPolicyLookaheadParityModule.createCpuPolicyLookaheadParity({
        SharedBoardUtils,
        inBoard
    });
    return CpuPolicyLookaheadParityCache;
}

function requireCpuPolicyLookaheadParity() {
    const helpers = getCpuPolicyLookaheadParity();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-parity module is not available');
    }
    return helpers;
}

function getCpuPolicySearchKey() {
    if (CpuPolicySearchKeyCache) return CpuPolicySearchKeyCache;
    if (!CpuPolicySearchKeyModule || typeof CpuPolicySearchKeyModule.createCpuPolicySearchKey !== 'function') {
        return null;
    }
    CpuPolicySearchKeyCache = CpuPolicySearchKeyModule.createCpuPolicySearchKey({
        SharedBoardUtils
    });
    return CpuPolicySearchKeyCache;
}

function requireCpuPolicySearchKey() {
    const helpers = getCpuPolicySearchKey();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-search-key module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadEvaluation() {
    if (CpuPolicyLookaheadEvaluationCache) return CpuPolicyLookaheadEvaluationCache;
    if (!CpuPolicyLookaheadEvaluationModule || typeof CpuPolicyLookaheadEvaluationModule.createCpuPolicyLookaheadEvaluation !== 'function') {
        return null;
    }
    CpuPolicyLookaheadEvaluationCache = CpuPolicyLookaheadEvaluationModule.createCpuPolicyLookaheadEvaluation({
        SharedBoardUtils,
        inBoard,
        isEdge,
        countBoardDiscsForPlayer,
        countCornersFor,
        countEdgesFor,
        getLegalMovesBasic,
        resolveForcedPassFeature,
        countCornerMovesFor,
        countXsAndCsFor,
        resolveLookaheadParityFeature
    });
    return CpuPolicyLookaheadEvaluationCache;
}

function requireCpuPolicyLookaheadEvaluation() {
    const helpers = getCpuPolicyLookaheadEvaluation();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-evaluation module is not available');
    }
    return helpers;
}

function getCpuPolicySearchOrder() {
    if (CpuPolicySearchOrderCache) return CpuPolicySearchOrderCache;
    if (!CpuPolicySearchOrderModule || typeof CpuPolicySearchOrderModule.createCpuPolicySearchOrder !== 'function') {
        return null;
    }
    CpuPolicySearchOrderCache = CpuPolicySearchOrderModule.createCpuPolicySearchOrder({
        isFiniteNumber,
        resolveBoardGeometry,
        scoreMoveForCornerEdgePlan,
        scoreMoveHeuristic,
        getMoveChargeGain,
        normalizePriorScore,
        inBoard,
        applyMoveToBoard,
        getLegalMovesBasic,
        countCornerMovesFor,
        countFrontierDiscsFor
    });
    return CpuPolicySearchOrderCache;
}

function requireCpuPolicySearchOrder() {
    const helpers = getCpuPolicySearchOrder();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-search-order module is not available');
    }
    return helpers;
}

function getCpuPolicyPlacementProfiles() {
    if (CpuPolicyPlacementProfilesCache) return CpuPolicyPlacementProfilesCache;
    if (!CpuPolicyPlacementProfilesModule || typeof CpuPolicyPlacementProfilesModule.createCpuPolicyPlacementProfiles !== 'function') {
        return null;
    }
    CpuPolicyPlacementProfilesCache = CpuPolicyPlacementProfilesModule.createCpuPolicyPlacementProfiles({
        getBoardCellValueSafe,
        inBoard,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        adjacentCornerFor,
        applyMoveToBoard,
        countAnchoredEdgeDiscsFromCorners
    });
    return CpuPolicyPlacementProfilesCache;
}

function requireCpuPolicyPlacementProfiles() {
    const helpers = getCpuPolicyPlacementProfiles();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-placement-profiles module is not available');
    }
    return helpers;
}

function getCpuPolicyMovePlanScoring() {
    if (CpuPolicyMovePlanScoringCache) return CpuPolicyMovePlanScoringCache;
    if (!CpuPolicyMovePlanScoringModule || typeof CpuPolicyMovePlanScoringModule.createCpuPolicyMovePlanScoring !== 'function') {
        return null;
    }
    CpuPolicyMovePlanScoringCache = CpuPolicyMovePlanScoringModule.createCpuPolicyMovePlanScoring({
        asRecord,
        isFiniteNumber,
        scoreMoveHeuristic,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        adjacentCornerFor,
        getBoardCellValueSafe,
        inBoard,
        isPseudoCornerXSquare,
        getBoardBonusAtCell,
        applyMoveToBoard,
        getLegalMovesBasic,
        getMovePlanProfileForCardType,
        countCornerMovesFor,
        countCornersFor,
        countEdgesFor,
        summarizeEdgeRunsFor,
        countFrontierDiscsFor,
        countAnchoredEdgeDiscsFromCorners,
        computePlacementStabilityProxy,
        countAdjacentCellsByValue,
        countAdjacentLoneEdgeDiscsFor,
        countXsAndCsFor,
        countBoardDiscsForPlayer
    });
    return CpuPolicyMovePlanScoringCache;
}

function requireCpuPolicyMovePlanScoring() {
    const helpers = getCpuPolicyMovePlanScoring();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-move-plan-scoring module is not available');
    }
    return helpers;
}

function getCpuPolicyMoveSelection() {
    if (CpuPolicyMoveSelectionCache) return CpuPolicyMoveSelectionCache;
    if (!CpuPolicyMoveSelectionModule || typeof CpuPolicyMoveSelectionModule.createCpuPolicyMoveSelection !== 'function') {
        return null;
    }
    CpuPolicyMoveSelectionCache = CpuPolicyMoveSelectionModule.createCpuPolicyMoveSelection({
        isFiniteNumber,
        resolveBoardGeometry,
        scoreMoveHeuristic
    });
    return CpuPolicyMoveSelectionCache;
}

function requireCpuPolicyMoveSelection() {
    const helpers = getCpuPolicyMoveSelection();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-move-selection module is not available');
    }
    return helpers;
}

function getCpuPolicyDecisionContext() {
    if (CpuPolicyDecisionContextCache) return CpuPolicyDecisionContextCache;
    if (!CpuPolicyDecisionContextModule || typeof CpuPolicyDecisionContextModule.createCpuPolicyDecisionContext !== 'function') {
        return null;
    }
    CpuPolicyDecisionContextCache = CpuPolicyDecisionContextModule.createCpuPolicyDecisionContext({
        asRecord,
        isFiniteNumber,
        countBoardDiscsForPlayer,
        countBoardEdgeDiscsForPlayer,
        estimateOwnOppDiscs
    });
    return CpuPolicyDecisionContextCache;
}

function requireCpuPolicyDecisionContext() {
    const helpers = getCpuPolicyDecisionContext();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-decision-context module is not available');
    }
    return helpers;
}

function getCpuPolicyCardTypeFlagHelpers() {
    if (CpuPolicyCardTypeFlagsCache) return CpuPolicyCardTypeFlagsCache;
    if (!CpuPolicyCardTypeFlagsModule || typeof CpuPolicyCardTypeFlagsModule.createCpuPolicyCardTypeFlags !== 'function') {
        return null;
    }
    CpuPolicyCardTypeFlagsCache = CpuPolicyCardTypeFlagsModule.createCpuPolicyCardTypeFlags({
        isCornerRecoveryCardType,
        isCornerHoldCardType,
        isChargeRampCardType,
        throwChainCardTypes: THROW_CHAIN_CARD_TYPES,
        chainWillCardTypes: CHAIN_WILL_CARD_TYPES,
        defensiveCardTypes: DEFENSIVE_CARD_TYPES,
        highVarianceCardTypes: HIGH_VARIANCE_CARD_TYPES,
        stabilityCardTypes: STABILITY_CARD_TYPES,
        swingCardTypes: SWING_CARD_TYPES,
        edgeContestCardTypes: EDGE_CONTEST_CARD_TYPES,
        longHorizonCardTypes: LONG_HORIZON_CARD_TYPES,
        whiteLv6CornerSwingKeepTypes: WHITE_LV6_CORNER_SWING_KEEP_TYPES,
        whiteLv6FastRotateTypes: WHITE_LV6_FAST_ROTATE_TYPES
    });
    return CpuPolicyCardTypeFlagsCache;
}

function requireCpuPolicyCardTypeFlagHelpers() {
    const helpers = getCpuPolicyCardTypeFlagHelpers();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-card-type-flags module is not available');
    }
    return helpers;
}

function getCpuPolicyCardUseState() {
    if (CpuPolicyCardUseStateCache) return CpuPolicyCardUseStateCache;
    if (!CpuPolicyCardUseStateModule || typeof CpuPolicyCardUseStateModule.createCpuPolicyCardUseState !== 'function') {
        return null;
    }
    CpuPolicyCardUseStateCache = CpuPolicyCardUseStateModule.createCpuPolicyCardUseState({
        rebuildKeepPriorityCardTypes: REBUILD_KEEP_PRIORITY_CARD_TYPES,
        highVarianceCardTypes: HIGH_VARIANCE_CARD_TYPES,
        stabilityCardTypes: STABILITY_CARD_TYPES,
        whiteLv6FastRotateTypes: WHITE_LV6_FAST_ROTATE_TYPES
    });
    return CpuPolicyCardUseStateCache;
}

function requireCpuPolicyCardUseState() {
    const helpers = getCpuPolicyCardUseState();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-card-use-state module is not available');
    }
    return helpers;
}

function getCpuPolicyCardRetentionState() {
    if (CpuPolicyCardRetentionStateCache) return CpuPolicyCardRetentionStateCache;
    if (!CpuPolicyCardRetentionStateModule || typeof CpuPolicyCardRetentionStateModule.createCpuPolicyCardRetentionState !== 'function') {
        return null;
    }
    CpuPolicyCardRetentionStateCache = CpuPolicyCardRetentionStateModule.createCpuPolicyCardRetentionState();
    return CpuPolicyCardRetentionStateCache;
}

function requireCpuPolicyCardRetentionState() {
    const helpers = getCpuPolicyCardRetentionState();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-card-retention-state module is not available');
    }
    return helpers;
}

function getCpuPolicyRetentionScore() {
    if (CpuPolicyRetentionScoreCache) return CpuPolicyRetentionScoreCache;
    if (!CpuPolicyRetentionScoreModule || typeof CpuPolicyRetentionScoreModule.createCpuPolicyRetentionScore !== 'function') {
        return null;
    }
    CpuPolicyRetentionScoreCache = CpuPolicyRetentionScoreModule.createCpuPolicyRetentionScore();
    return CpuPolicyRetentionScoreCache;
}

function requireCpuPolicyRetentionScore() {
    const helpers = getCpuPolicyRetentionScore();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-retention-score module is not available');
    }
    return helpers;
}

function getCpuPolicyHandDestroyCycle() {
    if (CpuPolicyHandDestroyCycleCache) return CpuPolicyHandDestroyCycleCache;
    if (!CpuPolicyHandDestroyCycleModule || typeof CpuPolicyHandDestroyCycleModule.createCpuPolicyHandDestroyCycle !== 'function') {
        return null;
    }
    CpuPolicyHandDestroyCycleCache = CpuPolicyHandDestroyCycleModule.createCpuPolicyHandDestroyCycle({
        asRecord,
        isFiniteNumber,
        isCornerRecoveryCardType,
        isCornerHoldCardType,
        isChargeRampCardType
    });
    return CpuPolicyHandDestroyCycleCache;
}

function requireCpuPolicyHandDestroyCycle() {
    const helpers = getCpuPolicyHandDestroyCycle();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-hand-destroy-cycle module is not available');
    }
    return helpers;
}

function getCpuPolicyHandDestroyScore() {
    if (CpuPolicyHandDestroyScoreCache) return CpuPolicyHandDestroyScoreCache;
    if (!CpuPolicyHandDestroyScoreModule || typeof CpuPolicyHandDestroyScoreModule.createCpuPolicyHandDestroyScore !== 'function') {
        return null;
    }
    CpuPolicyHandDestroyScoreCache = CpuPolicyHandDestroyScoreModule.createCpuPolicyHandDestroyScore({
        getCpuPolicyCardTypeFlags,
        whiteLv6DestroyWhenAheadTypes: WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES
    });
    return CpuPolicyHandDestroyScoreCache;
}

function requireCpuPolicyHandDestroyScore() {
    const helpers = getCpuPolicyHandDestroyScore();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-hand-destroy-score module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadGuards() {
    if (CpuPolicyLookaheadGuardsCache) return CpuPolicyLookaheadGuardsCache;
    if (!CpuPolicyLookaheadGuardsModule || typeof CpuPolicyLookaheadGuardsModule.createCpuPolicyLookaheadGuards !== 'function') {
        return null;
    }
    CpuPolicyLookaheadGuardsCache = CpuPolicyLookaheadGuardsModule.createCpuPolicyLookaheadGuards({
        isCorner,
        isEdge,
        countCornersFor,
        evaluateImmediateCornerDonation,
        evaluateMoveStabilityProfile,
        countAnchoredEdgeDiscsFromCorners,
        buildSearchMoveOrder
    });
    return CpuPolicyLookaheadGuardsCache;
}

function requireCpuPolicyLookaheadGuards() {
    const helpers = getCpuPolicyLookaheadGuards();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-guards module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadRootSearch() {
    if (CpuPolicyLookaheadRootSearchCache) return CpuPolicyLookaheadRootSearchCache;
    if (!CpuPolicyLookaheadRootSearchModule || typeof CpuPolicyLookaheadRootSearchModule.createCpuPolicyLookaheadRootSearch !== 'function') {
        return null;
    }
    CpuPolicyLookaheadRootSearchCache = CpuPolicyLookaheadRootSearchModule.createCpuPolicyLookaheadRootSearch({
        getMoveChargeGain,
        getBoardBonusAtCell,
        consumeBonusCell,
        applyMoveToBoard,
        normalizePriorScore
    });
    return CpuPolicyLookaheadRootSearchCache;
}

function requireCpuPolicyLookaheadRootSearch() {
    const helpers = getCpuPolicyLookaheadRootSearch();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-root-search module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadPrelude() {
    if (CpuPolicyLookaheadPreludeCache) return CpuPolicyLookaheadPreludeCache;
    if (!CpuPolicyLookaheadPreludeModule || typeof CpuPolicyLookaheadPreludeModule.createCpuPolicyLookaheadPrelude !== 'function') {
        return null;
    }
    CpuPolicyLookaheadPreludeCache = CpuPolicyLookaheadPreludeModule.createCpuPolicyLookaheadPrelude({
        isFiniteNumber,
        countBoardDiscsForPlayer,
        resolveLookaheadEndgameDepth,
        resolveLookaheadDepth,
        resolveLookaheadBranch,
        resolveLookaheadNodeBudget,
        resolveLookaheadTimeBudgetMs,
        resolveLookaheadVirtualTimePerNodeMs,
        createConsumedBonusMap,
        resolveLookaheadMixWeights,
        getLegalMovesBasic,
        resolveLookaheadParityFeature,
        resolveForcedPassFeature,
        resolveLookaheadTranspositionLimit
    });
    return CpuPolicyLookaheadPreludeCache;
}

function requireCpuPolicyLookaheadPrelude() {
    const helpers = getCpuPolicyLookaheadPrelude();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-prelude module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadNegamax() {
    if (CpuPolicyLookaheadNegamaxCache) return CpuPolicyLookaheadNegamaxCache;
    if (!CpuPolicyLookaheadNegamaxModule || typeof CpuPolicyLookaheadNegamaxModule.createCpuPolicyLookaheadNegamax !== 'function') {
        return null;
    }
    CpuPolicyLookaheadNegamaxCache = CpuPolicyLookaheadNegamaxModule.createCpuPolicyLookaheadNegamax({
        evaluateBoardForLookahead,
        evaluateTerminalBoardForLookahead,
        buildBoardSearchKey,
        getLegalMovesBasic,
        buildSearchMoveOrder,
        getMoveChargeGain,
        getBoardBonusAtCell,
        consumeBonusCell,
        applyMoveToBoard
    });
    return CpuPolicyLookaheadNegamaxCache;
}

function requireCpuPolicyLookaheadNegamax() {
    const helpers = getCpuPolicyLookaheadNegamax();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-negamax module is not available');
    }
    return helpers;
}

function getCpuPolicyLookaheadController() {
    if (CpuPolicyLookaheadControllerCache) return CpuPolicyLookaheadControllerCache;
    if (!CpuPolicyLookaheadControllerModule || typeof CpuPolicyLookaheadControllerModule.createCpuPolicyLookaheadController !== 'function') {
        return null;
    }
    CpuPolicyLookaheadControllerCache = CpuPolicyLookaheadControllerModule.createCpuPolicyLookaheadController({
        isFiniteNumber,
        prepareLookaheadPrelude,
        notifyLookaheadSearchMeta,
        createNegamax,
        buildSearchMoveOrder,
        runLookaheadRootSearch,
        applyLookaheadHardGuards
    });
    return CpuPolicyLookaheadControllerCache;
}

function requireCpuPolicyLookaheadController() {
    const helpers = getCpuPolicyLookaheadController();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-lookahead-controller module is not available');
    }
    return helpers;
}

const {
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
    chooseForcedHandDestroyTarget
} = requireCpuPolicyCardHelpers();
const {
    countBoardDiscsForPlayer,
    countBoardEdgeDiscsForPlayer,
    estimateOwnOppDiscs
} = requireCpuPolicyBoardCounts();
const {
    countCornersFor,
    countEdgesFor,
    summarizeEdgeRunsFor,
    countAdjacentLoneEdgeDiscsFor,
    normalizePriorScore,
    countXsAndCsFor,
    countCornerMovesFor
} = requireCpuPolicyBoardFeatures();
const {
    resolveLookaheadDepth,
    resolveLookaheadEndgameDepth,
    resolveLookaheadBranch,
    resolveLookaheadNodeBudget,
    resolveLookaheadTranspositionLimit,
    resolveLookaheadTimeBudgetMs,
    resolveLookaheadVirtualTimePerNodeMs,
    resolveLookaheadMixWeights
} = requireCpuPolicyLookaheadConfig();
const {
    hashBonusCellCoord,
    parseBonusCellKey,
    createConsumedBonusMap,
    consumeBonusCell,
    getMoveChargeGain
} = requireCpuPolicyLookaheadBonus();
const {
    collectEmptyRegionParity,
    resolveLookaheadParityFeature,
    resolveForcedPassFeature
} = requireCpuPolicyLookaheadParity();
const {
    buildBoardSearchKey
} = requireCpuPolicySearchKey();
const {
    countFrontierDiscsFor,
    countAnchoredEdgeDiscsFromCorners,
    evaluateBoardForLookahead,
    evaluateTerminalBoardForLookahead
} = requireCpuPolicyLookaheadEvaluation();
const {
    countAdjacentCellsByValue,
    computePlacementStabilityProxy,
    evaluateMoveStabilityProfile,
    countAdjacentOpponentStrikeProfile,
    collectUltimateHyperactiveLandingProfile
} = requireCpuPolicyPlacementProfiles();
const {
    evaluateImmediateCornerDonation,
    scoreMoveForCornerEdgePlan
} = requireCpuPolicyMovePlanScoring();
const {
    computeLegalMoveMetrics,
    rankMoves,
    chooseMove
} = requireCpuPolicyMoveSelection();
const {
    buildCardDecisionContext
} = requireCpuPolicyDecisionContext();
const {
    getCpuPolicyCardTypeFlags
} = requireCpuPolicyCardTypeFlagHelpers();
const {
    buildCpuPolicyCardUseState
} = requireCpuPolicyCardUseState();
const {
    buildCpuPolicyCardRetentionState
} = requireCpuPolicyCardRetentionState();
const {
    computeCpuPolicyCardRetentionScore
} = requireCpuPolicyRetentionScore();
const {
    buildCpuPolicyHandDestroyCycleState
} = requireCpuPolicyHandDestroyCycle();
const {
    chooseCpuPolicyHandDestroyCandidate
} = requireCpuPolicyHandDestroyScore();
const {
    buildSearchMoveOrder
} = requireCpuPolicySearchOrder();
const {
    applyLookaheadHardGuards
} = requireCpuPolicyLookaheadGuards();
const {
    runLookaheadRootSearch
} = requireCpuPolicyLookaheadRootSearch();
const {
    prepareLookaheadPrelude,
    notifyLookaheadSearchMeta
} = requireCpuPolicyLookaheadPrelude();
const {
    createNegamax
} = requireCpuPolicyLookaheadNegamax();
const {
    chooseMoveByLookahead
} = requireCpuPolicyLookaheadController();

function scoreCardUseDecision(
    cardId: CpuPolicyCardId,
    getCardCost: CpuPolicyCardCostResolver,
    getCardDef: CpuPolicyCardDefinitionResolver,
    context?: CpuPolicyCardContext
): CpuPolicyCardScore {
    const ctx = buildCardDecisionContext(context);
    const cardCost = typeof getCardCost === 'function' ? Number(getCardCost(cardId) || 0) : 0;
    const cardDef = typeof getCardDef === 'function' ? (getCardDef(cardId) || null) : null;
    const {
        cardType,
        isRecoveryCard,
        isHoldCard,
        isChargeRampCard,
        isWorkWill,
        isTimeBomb,
        isTimeStopGod,
        isThrowChainCard,
        isChainWill,
        isLastResort,
        isEqualityWill,
        isReinforcementWill,
        isFreePlacement,
        isSniperWill,
        isStrongWindWill,
        isSwapWithEnemy,
        isPositionSwapWill,
        isTemptWill,
        isCloneWill,
        isBoardExpansionWill,
        isBoardShrinkCard,
        isTrapWill,
        isHeavenBlessing,
        isRevealHandWill,
        isCondemnWill,
        isExecutionWill,
        isExtendLifeWill,
        isExtendLifeGod,
        isExtendLifeCard,
        isRebuildWill,
        isSupplyWill,
        isGoldStone,
        isCrystalStone,
        isTheoryIncarnation,
        isRainbowStone,
        isSilverStone,
        isPlunderWill,
        isTreasureBox,
        isLossWill,
        isCorrosionWill,
        isBlockadeWill,
        isMeteorWill,
        isProtectedNextStone,
        isAfterimageWill,
        isGhostWill,
        isPermaProtectNextStone,
        isGuardWill,
        isGuardianGod,
        isRegenWill,
        isLightningWill,
        isHyperactiveWill,
        isInstantHyperactiveWill,
        isTabooReverseWill,
        isCrossBomb,
        isXBomb,
        isUltimateDestroyGod,
        isUltimateHyperactiveGod,
        isObserverWill,
        isDestroyDragonWill,
        isBreedingWill,
        isTeleportWill,
        isCellTeleportWill,
        isHyperactiveInheritWill,
        isRobotVacuumWill,
        isExtremeHyperactiveWill,
        isGluttonousWill,
        isBuoyancyWill,
        isGravityWill,
        isSuperCrushWill,
        isAnchorPlacementCard,
        isChargeSwingCard,
        isDefensiveCard,
        isHighVarianceCard,
        isStabilityCard,
        isSwingCard,
        isEdgeContestCard,
        isLongHorizonCard,
        isWhiteCornerSwingKeepCard
    } = getCpuPolicyCardTypeFlags(cardDef && typeof cardDef.type === 'string' ? cardDef.type : '');
    const {
        ownCorners,
        oppCorners,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        recoveryCostGap,
        highBonusMoveAvailable,
        ownDiscs,
        ownEdges,
        oppEdges,
        maxLegalFlips,
        avgLegalFlips,
        maxLegalGain,
        maxLegalBoardBonus,
        cloneSplitEligibleSourceCount,
        oppHandSize,
        ownSpecialCount,
        oppSpecialCount,
        ownGuardCount,
        oppGuardCount,
        ownCornerResetCount,
        oppCornerResetCount,
        ownEdgeResetCount,
        oppEdgeResetCount,
        handCardIds,
        usableCardIds,
        usableCardIdSet,
        deckRemaining,
        keepPriorityInHandCount,
        highVarianceInHandCount,
        fastRotateInHandCount,
        stabilityInHandCount,
        edgeDiff,
        cornerDiff,
        ownAnchorResetWeight,
        oppAnchorResetWeight,
        lossEnemyAnchorPayoffIsModest,
        strategicDiff,
        handPressureLevel,
        chargePressureLevel,
        mobilityPressureLevel,
        cardCyclePressure,
        openingPhase,
        midLatePhase,
        endgamePhase,
        leadStable,
        trailingHard,
        trailing,
        edgeEmergency,
        edgeControlMode,
        whiteLv6Mode,
        lowDiscEmergency,
        criticalLowDiscEmergency
    } = buildCpuPolicyCardUseState(ctx, cardId, getCardDef);
    const isCornerTimingCard = (
        isHoldCard ||
        isRecoveryCard ||
        isChargeRampCard ||
        isWorkWill ||
        isObserverWill ||
        isDestroyDragonWill ||
        isAnchorPlacementCard
    );

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
        ((isCrystalStone || isTheoryIncarnation) && maxLegalBoardBonus >= 2) ||
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
    if (ctx.handSize >= 4 && cardCost <= 8 && !isHighVarianceCard) score += 10;

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
        if (cardCyclePressure >= 3 && cardCost <= 10 && !isHighVarianceCard) {
            score += 18;
        }
        if (mobilityPressureLevel >= 2 && (isRecoveryCard || isHoldCard || isEdgeContestCard || isChargeSwingCard || isChargeRampCard || isWorkWill || isObserverWill)) {
            score += 16;
        }
        if (ctx.handSize >= 4 && ctx.ownCharge >= 20 && !isHighVarianceCard) {
            score += 12;
        }
        if (ctx.handSize >= 5 && (isChargeSwingCard || isChargeRampCard || isRebuildWill)) {
            score += 18;
        }
        if (
            mobilityPressureLevel >= 2 &&
            ((maxLegalFlips >= 4 && (isGoldStone || isRainbowStone || isSilverStone)) ||
                (maxLegalBoardBonus >= 2 && (isCrystalStone || isTheoryIncarnation)) ||
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

    if (isHighVarianceCard) {
        score -= 22;
        if (ctx.discDiff >= 0) score -= 18;
        if (ctx.empties <= 18) score -= 10;
        if (ctx.discDiff <= -12) score += 14;
    }

    if (isDefensiveCard) {
        score += 12;
        if (ctx.discDiff >= 0) score += 10;
        if (ctx.empties <= 16) score += 6;
    }

    if (cardCost >= 20 && ctx.discDiff >= 0 && ctx.empties <= 20) score -= 16;
    if (cardCost <= 4 && isDefensiveCard && ctx.discDiff >= 0) score += 8;

    if (!ctx.forceUseCard) {
        if (leadStable) {
            if (isStabilityCard) score += midLatePhase ? 24 : 14;
            if (isSwingCard) score -= 24;
            if (isHighVarianceCard) score -= 10;
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
        if (isSwingCard || isHighVarianceCard) score -= 34;
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

    if (isCrystalStone || isTheoryIncarnation) {
        const multiplier = 2;
        const gross = maxLegalBoardBonus * multiplier;
        const net = gross - cardCost;
        score -= isTheoryIncarnation ? 8 : 18;
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
        if (isTheoryIncarnation && !endgamePhase) score += 80;
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
        if (isHighVarianceCard) score -= 20;
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
    const {
        cardType,
        isRecoveryCard,
        isHoldCard,
        isChargeRampCard,
        isWorkWill,
        isTimeBomb,
        isTimeStopGod,
        isLastResort,
        isEqualityWill,
        isReinforcementWill,
        isHeavenBlessing,
        isRevealHandWill,
        isCondemnWill,
        isExecutionWill,
        isProtectedNextStone,
        isAfterimageWill,
        isGhostWill,
        isPermaProtectNextStone,
        isGuardWill,
        isGuardianGod,
        isRegenWill,
        isLightningWill,
        isHyperactiveWill,
        isInstantHyperactiveWill,
        isTabooReverseWill,
        isCrossBomb,
        isXBomb,
        isUltimateDestroyGod,
        isUltimateHyperactiveGod,
        isThrowChainCard,
        isChainWill,
        isGoldStone,
        isCrystalStone,
        isTheoryIncarnation,
        isRainbowStone,
        isSilverStone,
        isPlunderWill,
        isLossWill,
        isCorrosionWill,
        isTrapWill,
        isTemptWill,
        isExtendLifeWill,
        isExtendLifeGod,
        isExtendLifeCard,
        isBlockadeWill,
        isMeteorWill,
        isBoardShrinkCard,
        isObserverWill,
        isDestroyDragonWill,
        isGluttonousWill,
        isTeleportWill,
        isCellTeleportWill,
        isSuperCrushWill,
        isDefensiveCard,
        isHighVarianceCard
    } = getCpuPolicyCardTypeFlags(cardDef && typeof cardDef.type === 'string' ? cardDef.type : '');
    const {
        ownCorners,
        oppCorners,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerEmergency,
        whiteLv6Mode,
        recoveryCostGap,
        maxLegalFlips,
        maxLegalGain,
        maxLegalBoardBonus,
        highBonusMoveAvailable,
        oppHandSize,
        ownSpecialCount,
        oppSpecialCount,
        ownCornerResetCount,
        oppCornerResetCount,
        ownEdgeResetCount,
        oppEdgeResetCount,
        ownAnchorResetWeight,
        oppAnchorResetWeight
    } = buildCpuPolicyCardRetentionState(ctx);
    const score = computeCpuPolicyCardRetentionScore({
        ctx,
        state: {
            ownCorners,
            oppCorners,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerEmergency,
            whiteLv6Mode,
            recoveryCostGap,
            maxLegalFlips,
            maxLegalGain,
            maxLegalBoardBonus,
            highBonusMoveAvailable,
            oppHandSize,
            ownSpecialCount,
            oppSpecialCount,
            ownCornerResetCount,
            oppCornerResetCount,
            ownEdgeResetCount,
            oppEdgeResetCount,
            ownAnchorResetWeight,
            oppAnchorResetWeight
        },
        flags: {
            cardType,
            isRecoveryCard,
            isHoldCard,
            isChargeRampCard,
            isWorkWill,
            isTimeBomb,
            isTimeStopGod,
            isLastResort,
            isEqualityWill,
            isReinforcementWill,
            isHeavenBlessing,
            isRevealHandWill,
            isCondemnWill,
            isExecutionWill,
            isProtectedNextStone,
            isAfterimageWill,
            isGhostWill,
            isPermaProtectNextStone,
            isGuardWill,
            isGuardianGod,
            isRegenWill,
            isLightningWill,
            isHyperactiveWill,
            isInstantHyperactiveWill,
            isTabooReverseWill,
            isCrossBomb,
            isXBomb,
            isUltimateDestroyGod,
            isUltimateHyperactiveGod,
            isThrowChainCard,
            isChainWill,
            isGoldStone,
            isCrystalStone,
            isRainbowStone,
            isSilverStone,
            isPlunderWill,
            isLossWill,
            isCorrosionWill,
            isTrapWill,
            isTemptWill,
            isExtendLifeWill,
            isExtendLifeGod,
            isExtendLifeCard,
            isBlockadeWill,
            isMeteorWill,
            isBoardShrinkCard,
            isObserverWill,
            isDestroyDragonWill,
            isGluttonousWill,
            isTeleportWill,
            isCellTeleportWill,
            isSuperCrushWill,
            isDefensiveCard,
            isHighVarianceCard
        },
        cardCost
    });

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
    const ctx = buildCardDecisionContext(Object.assign({}, context || {}, {
        handSize: Array.isArray(handCardIds) ? handCardIds.length : 0
    }));
    const {
        hand,
        usable,
        usableSet,
        cornerEmergency,
        hasCornerMoveNow,
        hasEdgeMoveNow,
        cornerHoldMode,
        whiteLv6Mode,
        needRecoveryCard,
        needHoldCard,
        needChargeRampCard,
        shouldCycleForNeededCards,
        lv6FastCycleMode,
        handPressure,
        strongUseReady
    } = buildCpuPolicyHandDestroyCycleState({
        handCardIds,
        usableCardIds,
        getCardCost,
        getCardDef,
        context,
        normalizedContext: ctx,
        scoreCardUseDecision
    });
    if (hand.length <= 0) return null;
    const forcedDestroy = chooseForcedHandDestroyTarget(hand, getCardCost, getCardDef, ctx, usableSet);
    if (forcedDestroy) return forcedDestroy;
    if (ctx.forceUseCard) return null;
    if (handPressure <= 0) return null;
    const allowDestroyByPressure = (
        (handPressure >= 2 && (shouldCycleForNeededCards || usable.length <= 0)) ||
        (handPressure === 1 && shouldCycleForNeededCards && usable.length <= 0)
    );
    if (!allowDestroyByPressure && !lv6FastCycleMode) return null;
    if (strongUseReady && handPressure <= 1) return null;
    if (strongUseReady && handPressure >= 2 && !shouldCycleForNeededCards && !cornerEmergency) return null;
    const best = chooseCpuPolicyHandDestroyCandidate({
        hand,
        loopState: {
            cornerEmergency,
            hasCornerMoveNow,
            hasEdgeMoveNow,
            cornerHoldMode,
            whiteLv6Mode,
            needRecoveryCard,
            needHoldCard,
            needChargeRampCard,
            shouldCycleForNeededCards,
            lv6FastCycleMode,
            handPressure,
            usableSet
        },
        normalizedContext: {
            discDiff: ctx.discDiff,
            legalMovesCount: ctx.legalMovesCount,
            handSize: ctx.handSize,
            forceUseCard: ctx.forceUseCard
        },
        scoreCardRetentionPriority: (candidateId: CpuPolicyCardId) => (
            scoreCardRetentionPriority(candidateId, getCardCost, getCardDef, context)
        )
    });
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
    return requireCpuPolicyBoardPrimitives().resolveBoardGeometry(boardOrRows, colsMaybe);
}

function isCorner(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    return requireCpuPolicyBoardPrimitives().isCorner(row, col, boardOrRows, colsMaybe);
}

function isEdge(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    return requireCpuPolicyBoardPrimitives().isEdge(row, col, boardOrRows, colsMaybe);
}

function isXSquare(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    return requireCpuPolicyBoardPrimitives().isXSquare(row, col, boardOrRows, colsMaybe);
}

function isCSquare(row: number, col: number, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): boolean {
    return requireCpuPolicyBoardPrimitives().isCSquare(row, col, boardOrRows, colsMaybe);
}

function scoreMoveHeuristic(move: CpuPolicyMove, level = 1, boardOrRows?: CpuPolicyBoardShape, colsMaybe?: number | null): number {
    return requireCpuPolicyBoardPrimitives().scoreMoveHeuristic(move, level, boardOrRows, colsMaybe);
}

function cloneBoard(board: CpuPolicyBoard | null | undefined): CpuPolicyBoard {
    return requireCpuPolicyBoardPrimitives().cloneBoard(board);
}

function inBoard(board: CpuPolicyBoard | null | undefined, row: number, col: number): boolean {
    return requireCpuPolicyBoardPrimitives().inBoard(board, row, col);
}

function getFlipsBasic(board: CpuPolicyBoard | null | undefined, row: number, col: number, playerValue: number): CpuPolicyMove['flips'] {
    return requireCpuPolicyBoardPrimitives().getFlipsBasic(board, row, col, playerValue);
}

function getLegalMovesBasic(board: CpuPolicyBoard | null | undefined, playerValue: number): CpuPolicyMove[] {
    return requireCpuPolicyBoardPrimitives().getLegalMovesBasic(board, playerValue);
}

function applyMoveToBoard(board: CpuPolicyBoard | null | undefined, move: CpuPolicyMove | null | undefined, playerValue: number): CpuPolicyBoard {
    return requireCpuPolicyBoardPrimitives().applyMoveToBoard(board, move, playerValue);
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

function resolveMovePlanProfile(context: CpuPolicyCardContext | CpuPolicyDecisionContext | null | undefined): CpuPolicyMovePlanProfile | null {
    const ctx = asRecord(context);
    const cardType = typeof ctx.pendingType === 'string' && ctx.pendingType
        ? ctx.pendingType
        : (typeof ctx.activeCardType === 'string' ? ctx.activeCardType : '');
    if (!cardType) return null;
    if (!Object.prototype.hasOwnProperty.call(CARD_TYPE_MOVE_PLAN_PROFILE, cardType)) return null;
    return CARD_TYPE_MOVE_PLAN_PROFILE[cardType];
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
