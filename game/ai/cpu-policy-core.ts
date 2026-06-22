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
    ownBombCount: number;
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
const CpuPolicyPlacementFeaturesModule = requireOptionalModule('./cpu-policy-placement-features');
const CpuPolicyMovePlanScoringModule = requireOptionalModule('./cpu-policy-move-plan-scoring');
const CpuPolicyMoveSelectionModule = requireOptionalModule('./cpu-policy-move-selection');
const CpuPolicyDecisionContextModule = requireOptionalModule('./cpu-policy-decision-context');
const CpuPolicyCardTypeFlagsModule = requireOptionalModule('./cpu-policy-card-type-flags');
const CpuPolicyCardUseStateModule = requireOptionalModule('./cpu-policy-card-use-state');
const CpuPolicyCardUseDecisionModule = requireOptionalModule('./cpu-policy-card-use-decision');
const CpuPolicyCardRetentionStateModule = requireOptionalModule('./cpu-policy-card-retention-state');
const CpuPolicyRetentionScoreModule = requireOptionalModule('./cpu-policy-retention-score');
const CpuPolicyHandDestroyCycleModule = requireOptionalModule('./cpu-policy-hand-destroy-cycle');
const CpuPolicyHandDestroyScoreModule = requireOptionalModule('./cpu-policy-hand-destroy-score');
const CpuPolicyLookaheadGuardsModule = requireOptionalModule('./cpu-policy-lookahead-guards');
const CpuPolicyLookaheadRootSearchModule = requireOptionalModule('./cpu-policy-lookahead-root-search');
const CpuPolicyLookaheadPreludeModule = requireOptionalModule('./cpu-policy-lookahead-prelude');
const CpuPolicyLookaheadNegamaxModule = requireOptionalModule('./cpu-policy-lookahead-negamax');
const CpuPolicyLookaheadControllerModule = requireOptionalModule('./cpu-policy-lookahead-controller');
const CpuPolicyCardTaxonomyModule = requireOptionalModule('./cpu-policy-card-taxonomy');
const SpecialCardRegistryModule = requireOptionalModule('../../shared/special-card-registry');
const CpuPolicyCardTaxonomy = CpuPolicyCardTaxonomyModule || {};
const THROW_CHAIN_CARD_TYPES = CpuPolicyCardTaxonomy.THROW_CHAIN_CARD_TYPES || Object.freeze(['DOUBLE_PLACE', 'TRIPLE_PLACE', 'QUAD_PLACE', 'INFINITE_PLACE']);
const CHAIN_WILL_CARD_TYPES = CpuPolicyCardTaxonomy.CHAIN_WILL_CARD_TYPES || Object.freeze(['DOUBLE_CHAIN_WILL', 'TRIPLE_CHAIN_WILL', 'QUAD_CHAIN_WILL', 'INFINITE_CHAIN_WILL']);
const DEFENSIVE_CARD_TYPES = CpuPolicyCardTaxonomy.DEFENSIVE_CARD_TYPES || new Set();
const HIGH_VARIANCE_CARD_TYPES = CpuPolicyCardTaxonomy.HIGH_VARIANCE_CARD_TYPES || new Set();
const CORNER_RECOVERY_CARD_TYPES = CpuPolicyCardTaxonomy.CORNER_RECOVERY_CARD_TYPES || new Set();
const CORNER_HOLD_CARD_TYPES = CpuPolicyCardTaxonomy.CORNER_HOLD_CARD_TYPES || new Set();
const CHARGE_RAMP_CARD_TYPES = CpuPolicyCardTaxonomy.CHARGE_RAMP_CARD_TYPES || new Set();
const REBUILD_KEEP_PRIORITY_CARD_TYPES = CpuPolicyCardTaxonomy.REBUILD_KEEP_PRIORITY_CARD_TYPES || new Set();
const STABILITY_CARD_TYPES = CpuPolicyCardTaxonomy.STABILITY_CARD_TYPES || new Set();
const SWING_CARD_TYPES = CpuPolicyCardTaxonomy.SWING_CARD_TYPES || new Set();
const EDGE_CONTEST_CARD_TYPES = CpuPolicyCardTaxonomy.EDGE_CONTEST_CARD_TYPES || new Set();
const LONG_HORIZON_CARD_TYPES = CpuPolicyCardTaxonomy.LONG_HORIZON_CARD_TYPES || new Set();
const WHITE_LV6_CORNER_SWING_KEEP_TYPES = CpuPolicyCardTaxonomy.WHITE_LV6_CORNER_SWING_KEEP_TYPES || new Set();
const WHITE_LV6_FAST_ROTATE_TYPES = CpuPolicyCardTaxonomy.WHITE_LV6_FAST_ROTATE_TYPES || new Set();
const WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES = CpuPolicyCardTaxonomy.WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES || new Set();
const IMMEDIATE_DESTROY_CARD_TYPES = CpuPolicyCardTaxonomy.IMMEDIATE_DESTROY_CARD_TYPES || new Set();
const LOW_CHARGE_DESTROY_CARD_TYPES = CpuPolicyCardTaxonomy.LOW_CHARGE_DESTROY_CARD_TYPES || new Set();
const CONDITION_DEPENDENT_DESTROY_CARD_TYPES = CpuPolicyCardTaxonomy.CONDITION_DEPENDENT_DESTROY_CARD_TYPES || new Set();
const LOW_CHARGE_DESTROY_MAX_CHARGE = Number.isFinite(CpuPolicyCardTaxonomy.LOW_CHARGE_DESTROY_MAX_CHARGE)
    ? CpuPolicyCardTaxonomy.LOW_CHARGE_DESTROY_MAX_CHARGE
    : 50;
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
let CpuPolicyPlacementFeaturesCache: any = null;
let CpuPolicyMovePlanScoringCache: any = null;
let CpuPolicyMoveSelectionCache: any = null;
let CpuPolicyDecisionContextCache: any = null;
let CpuPolicyCardTypeFlagsCache: any = null;
let CpuPolicyCardUseStateCache: any = null;
let CpuPolicyCardUseDecisionCache: any = null;
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

function getCpuPolicyPlacementFeatures() {
    if (CpuPolicyPlacementFeaturesCache) return CpuPolicyPlacementFeaturesCache;
    if (!CpuPolicyPlacementFeaturesModule || typeof CpuPolicyPlacementFeaturesModule.createCpuPolicyPlacementFeatures !== 'function') {
        return null;
    }
    CpuPolicyPlacementFeaturesCache = CpuPolicyPlacementFeaturesModule.createCpuPolicyPlacementFeatures({
        isFiniteNumber,
        isCorner,
        isEdge,
        isXSquare,
        isCSquare,
        adjacentCornerFor,
        getBoardCellValueSafe,
        inBoard,
        applyMoveToBoard,
        getLegalMovesBasic,
        countCornerMovesFor,
        summarizeEdgeRunsFor,
        countAnchoredEdgeDiscsFromCorners,
        countBoardDiscsForPlayer,
        getBoardBonusAtCell
    });
    return CpuPolicyPlacementFeaturesCache;
}

function requireCpuPolicyPlacementFeatures() {
    const helpers = getCpuPolicyPlacementFeatures();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-placement-features module is not available');
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
        countBoardDiscsForPlayer,
        evaluatePlacementCandidate
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

function isInviolableSpecialCardIdForCpuPolicy(cardId: unknown): boolean {
    return !!(
        SpecialCardRegistryModule &&
        typeof SpecialCardRegistryModule.isInviolableSpecialCardId === 'function' &&
        SpecialCardRegistryModule.isInviolableSpecialCardId(cardId)
    );
}

function getCpuPolicyCardUseDecision() {
    if (CpuPolicyCardUseDecisionCache) return CpuPolicyCardUseDecisionCache;
    if (!CpuPolicyCardUseDecisionModule || typeof CpuPolicyCardUseDecisionModule.createCpuPolicyCardUseDecision !== 'function') {
        return null;
    }
    CpuPolicyCardUseDecisionCache = CpuPolicyCardUseDecisionModule.createCpuPolicyCardUseDecision({
        buildCardDecisionContext,
        getCpuPolicyCardTypeFlags,
        buildCpuPolicyCardUseState,
        buildBlockedCardUseDecision,
        getForcedHandDestroyReason,
        cardTypeBaseScoreBonus: CARD_TYPE_BASE_SCORE_BONUS,
        cardTypeUsageStyle: CARD_TYPE_USAGE_STYLE,
        highVarianceCardTypes: HIGH_VARIANCE_CARD_TYPES,
        rebuildKeepPriorityCardTypes: REBUILD_KEEP_PRIORITY_CARD_TYPES,
        whiteLv6DestroyWhenAheadTypes: WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES,
        isInviolableSpecialCardId: isInviolableSpecialCardIdForCpuPolicy
    });
    return CpuPolicyCardUseDecisionCache;
}

function requireCpuPolicyCardUseDecision() {
    const helpers = getCpuPolicyCardUseDecision();
    if (!helpers) {
        throw new Error('[cpu-policy-core] cpu-policy-card-use-decision module is not available');
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
    evaluatePlacementCandidate
} = requireCpuPolicyPlacementFeatures();
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
const {
    scoreCardUseDecision
} = requireCpuPolicyCardUseDecision();
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
    evaluatePlacementCandidate,
    scoreMoveForCornerEdgePlan,
    scoreMoveHeuristic
});

module.exports = cpuPolicyCoreApi;
