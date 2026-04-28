declare function buildCardTypeUsageStyle(): any;
declare function buildCardTypeMovePlanProfile(): any;
declare function chooseHighestCostCard(usableCardIds: any, getCardCost: any, getCardDef: any): {
    cardId: any;
    cardDef: any;
} | null;
declare function isCornerRecoveryCardType(cardType: any): any;
declare function isCornerHoldCardType(cardType: any): any;
declare function isChargeRampCardType(cardType: any): any;
declare function hasUsageStyleForCardType(cardType: any): boolean;
declare function hasBaseScoreBonusForCardType(cardType: any): boolean;
declare function hasMovePlanProfileForCardType(cardType: any): boolean;
declare function getMovePlanProfileForCardType(cardType: any): any;
declare function getForcedHandDestroyReason(cardId: any, cardType: any, context: any, usableCardIdSet: any): "bucket1_never_use" | "bucket2_low_charge" | "bucket3_currently_unusable" | null;
declare function getForcedHandDestroyPriority(reason: any): 1 | 99 | 3 | 2;
declare function buildBlockedCardUseDecision(cardId: any, cardDef: any, cardType: any, cardCost: any, context: any, reason: any): {
    cardId: any;
    cardDef: any;
    cardType: any;
    cardCost: any;
    score: number;
    shouldUse: boolean;
    minUseScore: number;
    reason: string;
};
declare function chooseForcedHandDestroyTarget(handCardIds: any, getCardCost: any, getCardDef: any, context: any, usableCardIdSet: any): {
    cardId: any;
    cardDef: any;
    cardType: any;
    score: number;
    reason: any;
} | null;
declare function countBoardDiscsForPlayer(board: any, playerValue: any): {
    own: number;
    opp: number;
    empties: number;
};
declare function countBoardEdgeDiscsForPlayer(board: any, playerValue: any): any;
declare function estimateOwnOppDiscs(discDiff: any, empties: any, totalCells: any): {
    own: number;
    opp: number;
    occupied: number;
    totalCells: number;
};
declare function buildCardDecisionContext(context: any): {
    level: number;
    playerValue: number;
    legalMovesCount: number;
    discDiff: number;
    empties: number | null;
    ownDiscs: number | null;
    oppDiscs: number | null;
    ownEdges: number | null;
    oppEdges: number | null;
    totalCells: number;
    isOpening: boolean;
    isMidLate: boolean;
    isEndgame: boolean;
    isLowMobility: boolean;
    isLeading: boolean;
    isTrailing: boolean;
    hasCornerMove: boolean;
    cornerEmergency: boolean;
    edgeEmergency: boolean;
    handPressure: boolean;
};
declare function scoreCardRetentionPriority(cardType: any, context: any): number;
declare function scoreCardUseDecision(cardId: any, cardDef: any, context: any): {
    score: number;
    shouldUse: boolean;
};
declare function scoreMoveForCornerEdgePlan(move: any, planContext: any): number;
declare function scoreMoveHeuristic(move: any, context: any): number;
declare const _default: {
    THROW_CHAIN_CARD_TYPES: readonly string[];
    CHAIN_WILL_CARD_TYPES: readonly string[];
    DEFENSIVE_CARD_TYPES: Set<string>;
    HIGH_VARIANCE_CARD_TYPES: Set<string>;
    CORNER_RECOVERY_CARD_TYPES: any;
    CORNER_HOLD_CARD_TYPES: any;
    CHARGE_RAMP_CARD_TYPES: any;
    REBUILD_KEEP_PRIORITY_CARD_TYPES: Set<string>;
    STABILITY_CARD_TYPES: Set<string>;
    SWING_CARD_TYPES: Set<string>;
    EDGE_CONTEST_CARD_TYPES: Set<string>;
    LONG_HORIZON_CARD_TYPES: Set<string>;
    WHITE_LV6_CORNER_SWING_KEEP_TYPES: Set<string>;
    WHITE_LV6_FAST_ROTATE_TYPES: Set<string>;
    WHITE_LV6_DESTROY_WHEN_AHEAD_TYPES: Set<string>;
    IMMEDIATE_DESTROY_CARD_TYPES: Set<string>;
    LOW_CHARGE_DESTROY_CARD_TYPES: Set<string>;
    CONDITION_DEPENDENT_DESTROY_CARD_TYPES: Set<string>;
    LOW_CHARGE_DESTROY_MAX_CHARGE: number;
    CARD_TYPE_BASE_SCORE_BONUS: Readonly<{
        BLOCKADE_WILL: 8;
        BOARD_EXPANSION_GOD: -3;
        BOARD_EXPANSION_WILL: -2;
        BOARD_SHRINK_WILL: -3;
        BOARD_SHRINK_GOD: -6;
        BREEDING_WILL: 0;
        DOUBLE_CHAIN_WILL: 4;
        TRIPLE_CHAIN_WILL: 6;
        QUAD_CHAIN_WILL: 8;
        INFINITE_CHAIN_WILL: 6;
        CLONE_WILL: -1;
        CELL_TELEPORT_WILL: -4;
        CONDEMN_WILL: 4;
        REVEAL_HAND_WILL: 2;
        CORROSION_WILL: 4;
        CROSS_BOMB: -2;
        DESTROY_DRAGON_WILL: 7;
        DESTROY_ONE_STONE: 5;
        DOUBLE_PLACE: 8;
        TRIPLE_PLACE: 10;
        QUAD_PLACE: 12;
        INFINITE_PLACE: 6;
        ESCAPE_WILL: -1;
        EXTEND_LIFE_WILL: 8;
        EXTEND_LIFE_GOD: 10;
        EXTREME_HYPERACTIVE_WILL: -8;
        EQUALITY_WILL: 4;
        REINFORCEMENT_WILL: 5;
        FATE_WILL: 2;
        FREE_PLACEMENT: 2;
        FREEZE_WILL: -4;
        GLUTTONOUS_WILL: 3;
        GOLD_STONE: 12;
        CRYSTAL_STONE: 10;
        RAINBOW_STONE: 16;
        GUARD_WILL: 12;
        GUARDIAN_GOD: 14;
        AFTERIMAGE_WILL: 12;
        GHOST_WILL: 11;
        HEAVEN_BLESSING: 6;
        HYPERACTIVE_INHERIT_WILL: -2;
        HYPERACTIVE_WILL: 0;
        INSTANT_HYPERACTIVE_WILL: 1;
        LAST_RESORT: 8;
        LIGHTNING_WILL: 3;
        LIVING_WILL: 8;
        LOSS_WILL: -2;
        METEOR_WILL: -3;
        OBSERVER_WILL: 8;
        PERMA_PROTECT_NEXT_STONE: 12;
        PLUNDER_WILL: 8;
        CORNER_TRIBUTE: 6;
        POSITION_SWAP_WILL: 6;
        PROLIFERATION_WILL: 1;
        PROTECTED_NEXT_STONE: 10;
        REBUILD_WILL: 0;
        REGEN_WILL: 9;
        RIBO_WILL: 4;
        ROBOT_VACUUM_WILL: 4;
        SALVATION_WILL: 8;
        SEED_WILL: 2;
        SUPPLY_WILL: 8;
        SILVER_STONE: 10;
        SNIPER_WILL: 4;
        SPLIT_WILL: -3;
        STRONG_WIND_WILL: 6;
        SUPER_BUOYANCY_WILL: -3;
        SUPER_GRAVITY_WILL: -3;
        SWAP_WITH_ENEMY: 7;
        TABOO_REVERSE_WILL: 1;
        TELEPORT_WILL: -1;
        TEMPT_WILL: 5;
        CAPTURE_WILL: 5;
        TIME_BOMB: -2;
        TIME_STOP_GOD: -4;
        TRAP_WILL: 2;
        TREASURE_BOX: 14;
        ULTIMATE_DESTROY_GOD: 3;
        ULTIMATE_HYPERACTIVE_GOD: -6;
        ULTIMATE_REVERSE_DRAGON: 1;
        WILL_HUNTER_KING: 4;
        WORK_WILL: 4;
        X_BOMB: -2;
    }>;
    ALL_CARD_TYPES_FOR_USAGE_STYLE: readonly string[];
    CARD_TYPE_USAGE_STYLE_OVERRIDES: Readonly<{
        BLOCKADE_WILL: {
            lowMobilityBias: number;
            endgameBias: number;
            cornerNowBias: number;
        };
        BOARD_EXPANSION_GOD: {
            trailingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        BOARD_EXPANSION_WILL: {
            trailingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        BOARD_SHRINK_WILL: {
            cornerEmergencyBias: number;
            trailingBias: number;
            leadBias: number;
            handPressureBias: number;
        };
        BOARD_SHRINK_GOD: {
            cornerEmergencyBias: number;
            trailingBias: number;
            leadBias: number;
            handPressureBias: number;
        };
        BREEDING_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
            handPressureBias: number;
        };
        DOUBLE_CHAIN_WILL: {
            trailingBias: number;
            lowMobilityBias: number;
            leadBias: number;
            cornerNowBias: number;
        };
        TRIPLE_CHAIN_WILL: {
            trailingBias: number;
            lowMobilityBias: number;
            leadBias: number;
            cornerNowBias: number;
        };
        QUAD_CHAIN_WILL: {
            trailingBias: number;
            lowMobilityBias: number;
            leadBias: number;
            cornerNowBias: number;
            handPressureBias: number;
        };
        INFINITE_CHAIN_WILL: {
            trailingBias: number;
            lowMobilityBias: number;
            leadBias: number;
            cornerNowBias: number;
            handPressureBias: number;
            endgameBias: number;
        };
        CLONE_WILL: {
            midLateBias: number;
            cornerNowBias: number;
            endgameBias: number;
        };
        CONDEMN_WILL: {
            trailingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        REVEAL_HAND_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
            handPressureBias: number;
            trailingBias: number;
            cornerNowBias: number;
        };
        CORNER_TRIBUTE: {
            trailingBias: number;
            cornerEmergencyBias: number;
            leadBias: number;
            handPressureBias: number;
        };
        CORROSION_WILL: {
            midLateBias: number;
            handPressureBias: number;
            endgameBias: number;
        };
        CROSS_BOMB: {
            cornerEmergencyBias: number;
            endgameBias: number;
        };
        DESTROY_DRAGON_WILL: {
            cornerNowBias: number;
            edgeEmergencyBias: number;
            midLateBias: number;
        };
        DESTROY_ONE_STONE: {
            cornerEmergencyBias: number;
            lowMobilityBias: number;
            cornerNowBias: number;
        };
        DOUBLE_PLACE: {
            trailingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
            endgameBias: number;
        };
        TRIPLE_PLACE: {
            trailingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
            endgameBias: number;
        };
        QUAD_PLACE: {
            trailingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
            endgameBias: number;
        };
        INFINITE_PLACE: {
            trailingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
            endgameBias: number;
            lowMobilityBias: number;
        };
        EQUALITY_WILL: {
            leadBias: number;
            trailingBias: number;
            midLateBias: number;
            endgameBias: number;
            lowMobilityBias: number;
            handPressureBias: number;
        };
        REINFORCEMENT_WILL: {
            trailingBias: number;
            lowMobilityBias: number;
            cornerNowBias: number;
            handPressureBias: number;
            endgameBias: number;
        };
        FATE_WILL: {
            leadBias: number;
            trailingBias: number;
            midLateBias: number;
            endgameBias: number;
            lowMobilityBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        ESCAPE_WILL: {
            trailingBias: number;
            edgeEmergencyBias: number;
            handPressureBias: number;
        };
        EXTEND_LIFE_WILL: {
            midLateBias: number;
            leadBias: number;
            endgameBias: number;
        };
        EXTEND_LIFE_GOD: {
            midLateBias: number;
            leadBias: number;
            endgameBias: number;
        };
        EXTREME_HYPERACTIVE_WILL: {
            trailingBias: number;
            leadBias: number;
            cornerEmergencyBias: number;
        };
        FREE_PLACEMENT: {
            cornerEmergencyBias: number;
            lowMobilityBias: number;
            cornerNowBias: number;
        };
        FREEZE_WILL: {
            leadBias: number;
            cornerNowBias: number;
            edgeEmergencyBias: number;
            endgameBias: number;
        };
        GLUTTONOUS_WILL: {
            trailingBias: number;
            cornerNowBias: number;
            leadBias: number;
        };
        GOLD_STONE: {
            openingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        CRYSTAL_STONE: {
            openingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        RAINBOW_STONE: {
            openingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        GUARDIAN_GOD: {
            leadBias: number;
            cornerNowBias: number;
            cornerEmergencyBias: number;
        };
        GUARD_WILL: {
            leadBias: number;
            cornerNowBias: number;
        };
        AFTERIMAGE_WILL: {
            leadBias: number;
            cornerNowBias: number;
            edgeEmergencyBias: number;
        };
        GHOST_WILL: {
            leadBias: number;
            cornerNowBias: number;
            edgeEmergencyBias: number;
        };
        HEAVEN_BLESSING: {
            openingBias: number;
            handPressureBias: number;
            endgameBias: number;
        };
        HYPERACTIVE_INHERIT_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
        };
        HYPERACTIVE_WILL: {
            trailingBias: number;
            leadBias: number;
            cornerEmergencyBias: number;
        };
        INSTANT_HYPERACTIVE_WILL: {
            trailingBias: number;
            leadBias: number;
            cornerEmergencyBias: number;
        };
        LAST_RESORT: {
            cornerEmergencyBias: number;
            lowMobilityBias: number;
            cornerNowBias: number;
        };
        LIGHTNING_WILL: {
            cornerNowBias: number;
            edgeEmergencyBias: number;
            endgameBias: number;
        };
        LIVING_WILL: {
            leadBias: number;
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
            cornerNowBias: number;
        };
        LOSS_WILL: {
            trailingBias: number;
            midLateBias: number;
            handPressureBias: number;
        };
        METEOR_WILL: {
            cornerEmergencyBias: number;
            trailingBias: number;
            leadBias: number;
        };
        OBSERVER_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
        };
        PERMA_PROTECT_NEXT_STONE: {
            leadBias: number;
            cornerNowBias: number;
        };
        PLUNDER_WILL: {
            openingBias: number;
            handPressureBias: number;
            endgameBias: number;
        };
        POSITION_SWAP_WILL: {
            trailingBias: number;
            edgeEmergencyBias: number;
            cornerNowBias: number;
        };
        PROLIFERATION_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
            handPressureBias: number;
        };
        PROTECTED_NEXT_STONE: {
            leadBias: number;
            cornerNowBias: number;
        };
        REBUILD_WILL: {
            handPressureBias: number;
            openingBias: number;
            endgameBias: number;
        };
        REGEN_WILL: {
            leadBias: number;
            cornerNowBias: number;
            trailingBias: number;
        };
        RIBO_WILL: {
            midLateBias: number;
            handPressureBias: number;
            leadBias: number;
            endgameBias: number;
        };
        ROBOT_VACUUM_WILL: {
            midLateBias: number;
            cornerEmergencyBias: number;
            endgameBias: number;
        };
        SALVATION_WILL: {
            trailingBias: number;
            handPressureBias: number;
            endgameBias: number;
        };
        SEED_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        SUPPLY_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
            cornerNowBias: number;
            handPressureBias: number;
        };
        SILVER_STONE: {
            openingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        SNIPER_WILL: {
            cornerNowBias: number;
            edgeEmergencyBias: number;
            endgameBias: number;
        };
        SPLIT_WILL: {
            openingBias: number;
            midLateBias: number;
            endgameBias: number;
        };
        STRONG_WIND_WILL: {
            trailingBias: number;
            edgeEmergencyBias: number;
            cornerNowBias: number;
        };
        SUPER_BUOYANCY_WILL: {
            trailingBias: number;
            cornerEmergencyBias: number;
            cornerNowBias: number;
        };
        SUPER_GRAVITY_WILL: {
            trailingBias: number;
            cornerEmergencyBias: number;
            cornerNowBias: number;
        };
        SWAP_WITH_ENEMY: {
            trailingBias: number;
            edgeEmergencyBias: number;
            cornerNowBias: number;
        };
        TABOO_REVERSE_WILL: {
            trailingBias: number;
            cornerEmergencyBias: number;
            leadBias: number;
        };
        TELEPORT_WILL: {
            trailingBias: number;
            edgeEmergencyBias: number;
            cornerNowBias: number;
        };
        CELL_TELEPORT_WILL: {
            trailingBias: number;
            edgeEmergencyBias: number;
            cornerNowBias: number;
            leadBias: number;
        };
        TEMPT_WILL: {
            trailingBias: number;
            edgeEmergencyBias: number;
            cornerNowBias: number;
        };
        CAPTURE_WILL: {
            trailingBias: number;
            edgeEmergencyBias: number;
            cornerNowBias: number;
        };
        TIME_BOMB: {
            trailingBias: number;
            cornerEmergencyBias: number;
            leadBias: number;
        };
        TIME_STOP_GOD: {
            leadBias: number;
            trailingBias: number;
            midLateBias: number;
            endgameBias: number;
            cornerNowBias: number;
            cornerEmergencyBias: number;
            lowMobilityBias: number;
            handPressureBias: number;
        };
        TRAP_WILL: {
            edgeEmergencyBias: number;
            cornerEmergencyBias: number;
            cornerNowBias: number;
        };
        TREASURE_BOX: {
            openingBias: number;
            handPressureBias: number;
            cornerNowBias: number;
        };
        ULTIMATE_DESTROY_GOD: {
            trailingBias: number;
            cornerNowBias: number;
            leadBias: number;
        };
        ULTIMATE_HYPERACTIVE_GOD: {
            trailingBias: number;
            leadBias: number;
            cornerEmergencyBias: number;
        };
        ULTIMATE_REVERSE_DRAGON: {
            trailingBias: number;
            cornerEmergencyBias: number;
            leadBias: number;
        };
        WILL_HUNTER_KING: {
            trailingBias: number;
            cornerNowBias: number;
            edgeEmergencyBias: number;
            endgameBias: number;
        };
        WORK_WILL: {
            openingBias: number;
            midLateBias: number;
            cornerNowBias: number;
            endgameBias: number;
        };
        X_BOMB: {
            cornerEmergencyBias: number;
            leadBias: number;
            endgameBias: number;
        };
    }>;
    CARD_TYPE_USAGE_STYLE: any;
    CARD_MOVE_PLAN_ARCHETYPE_BASE: Readonly<{
        anchorProtect: Readonly<{
            placementWeight: 2;
            cornerBias: 3;
            edgeBias: 2;
            innerBias: -2;
            bonusBias: 1;
            flipBias: 0;
            mobilityBias: 0;
            emptyAdjBias: -1;
            ownAdjBias: 2;
            oppAdjBias: -1;
            xPenalty: 3;
            cPenalty: 2;
            frontierPenalty: 2;
            stabilityBias: 3;
        }>;
        anchorEngine: Readonly<{
            placementWeight: 2;
            cornerBias: 3;
            edgeBias: 2;
            innerBias: -1;
            bonusBias: 0;
            flipBias: 1;
            mobilityBias: 1;
            emptyAdjBias: 0;
            ownAdjBias: 1;
            oppAdjBias: 1;
            xPenalty: 3;
            cPenalty: 2;
            frontierPenalty: 1;
            stabilityBias: 3;
        }>;
        economyCycle: Readonly<{
            placementWeight: 1;
            cornerBias: 0;
            edgeBias: 0;
            innerBias: 0;
            bonusBias: 3;
            flipBias: 3;
            mobilityBias: 1;
            emptyAdjBias: 1;
            ownAdjBias: 0;
            oppAdjBias: 0;
            xPenalty: 1;
            cPenalty: 1;
            frontierPenalty: 0;
            stabilityBias: 0;
        }>;
        recoveryReposition: Readonly<{
            placementWeight: 1;
            cornerBias: 3;
            edgeBias: 2;
            innerBias: 0;
            bonusBias: 1;
            flipBias: 1;
            mobilityBias: 2;
            emptyAdjBias: 2;
            ownAdjBias: -1;
            oppAdjBias: 2;
            xPenalty: 2;
            cPenalty: 1;
            frontierPenalty: 0;
            stabilityBias: -1;
        }>;
        explosiveComeback: Readonly<{
            placementWeight: 1;
            cornerBias: 1;
            edgeBias: 1;
            innerBias: 1;
            bonusBias: 2;
            flipBias: 3;
            mobilityBias: 2;
            emptyAdjBias: 2;
            ownAdjBias: -2;
            oppAdjBias: 2;
            xPenalty: 1;
            cPenalty: 1;
            frontierPenalty: 0;
            stabilityBias: -2;
        }>;
        spawnMobile: Readonly<{
            placementWeight: 2;
            cornerBias: 0;
            edgeBias: 1;
            innerBias: 2;
            bonusBias: 1;
            flipBias: 1;
            mobilityBias: 3;
            emptyAdjBias: 3;
            ownAdjBias: 0;
            oppAdjBias: 1;
            xPenalty: 1;
            cPenalty: 1;
            frontierPenalty: 0;
            stabilityBias: 0;
        }>;
        controlBoard: Readonly<{
            placementWeight: 1;
            cornerBias: 2;
            edgeBias: 3;
            innerBias: -1;
            bonusBias: 1;
            flipBias: 0;
            mobilityBias: 2;
            emptyAdjBias: 2;
            ownAdjBias: 0;
            oppAdjBias: 1;
            xPenalty: 1;
            cPenalty: 1;
            frontierPenalty: 2;
            stabilityBias: 2;
        }>;
    }>;
    CARD_TYPE_MOVE_PLAN_PROFILE_OVERRIDES: Readonly<{
        BLOCKADE_WILL: {
            archetype: string;
            placementWeight: number;
            oppAdjBias: number;
            emptyAdjBias: number;
        };
        BOARD_EXPANSION_GOD: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            emptyAdjBias: number;
        };
        BOARD_EXPANSION_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            emptyAdjBias: number;
        };
        BOARD_SHRINK_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            oppAdjBias: number;
            emptyAdjBias: number;
        };
        BOARD_SHRINK_GOD: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            oppAdjBias: number;
            emptyAdjBias: number;
        };
        BREEDING_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            oppAdjBias: number;
        };
        DOUBLE_CHAIN_WILL: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
            oppAdjBias: number;
        };
        TRIPLE_CHAIN_WILL: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
            oppAdjBias: number;
            bonusBias: number;
        };
        QUAD_CHAIN_WILL: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
            oppAdjBias: number;
            bonusBias: number;
        };
        INFINITE_CHAIN_WILL: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
            oppAdjBias: number;
            bonusBias: number;
            stabilityBias: number;
        };
        CLONE_WILL: {
            archetype: string;
            placementWeight: number;
            ownAdjBias: number;
            edgeBias: number;
        };
        CONDEMN_WILL: {
            archetype: string;
            placementWeight: number;
        };
        REVEAL_HAND_WILL: {
            archetype: string;
            placementWeight: number;
        };
        CORNER_TRIBUTE: {
            archetype: string;
            placementWeight: number;
        };
        CORROSION_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            oppAdjBias: number;
        };
        CROSS_BOMB: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            oppAdjBias: number;
        };
        DESTROY_DRAGON_WILL: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            oppAdjBias: number;
        };
        DESTROY_ONE_STONE: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            ownAdjBias: number;
        };
        DOUBLE_PLACE: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            bonusBias: number;
            stabilityBias: number;
        };
        TRIPLE_PLACE: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            bonusBias: number;
            stabilityBias: number;
        };
        QUAD_PLACE: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            bonusBias: number;
            stabilityBias: number;
        };
        INFINITE_PLACE: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            bonusBias: number;
            stabilityBias: number;
        };
        ESCAPE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            oppAdjBias: number;
            emptyAdjBias: number;
        };
        EXTEND_LIFE_WILL: {
            archetype: string;
            placementWeight: number;
            stabilityBias: number;
            ownAdjBias: number;
        };
        EXTEND_LIFE_GOD: {
            archetype: string;
            placementWeight: number;
            stabilityBias: number;
            ownAdjBias: number;
        };
        EXTREME_HYPERACTIVE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            oppAdjBias: number;
            stabilityBias: number;
        };
        EQUALITY_WILL: {
            archetype: string;
            placementWeight: number;
        };
        REINFORCEMENT_WILL: {
            archetype: string;
            placementWeight: number;
            innerBias: number;
            flipBias: number;
            stabilityBias: number;
        };
        FATE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            mobilityBias: number;
            oppAdjBias: number;
        };
        FREE_PLACEMENT: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            innerBias: number;
            bonusBias: number;
            xPenalty: number;
            cPenalty: number;
        };
        FREEZE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            stabilityBias: number;
            oppAdjBias: number;
        };
        GLUTTONOUS_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            oppAdjBias: number;
            stabilityBias: number;
        };
        GOLD_STONE: {
            archetype: string;
            placementWeight: number;
            bonusBias: number;
            flipBias: number;
            stabilityBias: number;
        };
        CRYSTAL_STONE: {
            archetype: string;
            placementWeight: number;
            bonusBias: number;
            flipBias: number;
            stabilityBias: number;
        };
        RAINBOW_STONE: {
            archetype: string;
            placementWeight: number;
            bonusBias: number;
            flipBias: number;
            stabilityBias: number;
        };
        GUARDIAN_GOD: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            stabilityBias: number;
        };
        GUARD_WILL: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            ownAdjBias: number;
        };
        AFTERIMAGE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            stabilityBias: number;
            oppAdjBias: number;
        };
        GHOST_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            stabilityBias: number;
            oppAdjBias: number;
        };
        HEAVEN_BLESSING: {
            archetype: string;
            placementWeight: number;
        };
        HYPERACTIVE_INHERIT_WILL: {
            archetype: string;
            placementWeight: number;
            emptyAdjBias: number;
            stabilityBias: number;
        };
        HYPERACTIVE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            stabilityBias: number;
        };
        INSTANT_HYPERACTIVE_WILL: {
            archetype: string;
            placementWeight: number;
            mobilityBias: number;
            emptyAdjBias: number;
            cornerBias: number;
            stabilityBias: number;
        };
        LAST_RESORT: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            innerBias: number;
            bonusBias: number;
        };
        LIGHTNING_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            stabilityBias: number;
            oppAdjBias: number;
        };
        LIVING_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            ownAdjBias: number;
            stabilityBias: number;
        };
        LOSS_WILL: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            oppAdjBias: number;
        };
        METEOR_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            oppAdjBias: number;
            bonusBias: number;
        };
        CELL_TELEPORT_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            oppAdjBias: number;
            emptyAdjBias: number;
            stabilityBias: number;
        };
        OBSERVER_WILL: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
            stabilityBias: number;
        };
        PERMA_PROTECT_NEXT_STONE: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            stabilityBias: number;
        };
        PLUNDER_WILL: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
            oppAdjBias: number;
        };
        POSITION_SWAP_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            emptyAdjBias: number;
        };
        PROLIFERATION_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
        };
        PROTECTED_NEXT_STONE: {
            archetype: string;
            placementWeight: number;
        };
        REBUILD_WILL: {
            archetype: string;
            placementWeight: number;
        };
        REGEN_WILL: {
            archetype: string;
            placementWeight: number;
            innerBias: number;
            flipBias: number;
            oppAdjBias: number;
        };
        RIBO_WILL: {
            archetype: string;
            placementWeight: number;
            bonusBias: number;
            flipBias: number;
        };
        ROBOT_VACUUM_WILL: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            oppAdjBias: number;
            stabilityBias: number;
        };
        SALVATION_WILL: {
            archetype: string;
            placementWeight: number;
            ownAdjBias: number;
            stabilityBias: number;
        };
        SEED_WILL: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            emptyAdjBias: number;
            ownAdjBias: number;
            stabilityBias: number;
        };
        SUPPLY_WILL: {
            archetype: string;
            placementWeight: number;
        };
        SILVER_STONE: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
        };
        SNIPER_WILL: {
            archetype: string;
            placementWeight: number;
            mobilityBias: number;
            oppAdjBias: number;
            stabilityBias: number;
        };
        SPLIT_WILL: {
            archetype: string;
            placementWeight: number;
            ownAdjBias: number;
            innerBias: number;
        };
        STRONG_WIND_WILL: {
            archetype: string;
            placementWeight: number;
            mobilityBias: number;
            emptyAdjBias: number;
        };
        SUPER_BUOYANCY_WILL: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            oppAdjBias: number;
        };
        SUPER_GRAVITY_WILL: {
            archetype: string;
            placementWeight: number;
            edgeBias: number;
            oppAdjBias: number;
        };
        SWAP_WITH_ENEMY: {
            archetype: string;
            placementWeight: number;
            ownAdjBias: number;
            oppAdjBias: number;
        };
        TABOO_REVERSE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            mobilityBias: number;
        };
        TELEPORT_WILL: {
            archetype: string;
            placementWeight: number;
            mobilityBias: number;
            emptyAdjBias: number;
            xPenalty: number;
        };
        TEMPT_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            stabilityBias: number;
        };
        CAPTURE_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            stabilityBias: number;
        };
        TIME_BOMB: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            oppAdjBias: number;
            stabilityBias: number;
        };
        TIME_STOP_GOD: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            edgeBias: number;
            innerBias: number;
            emptyAdjBias: number;
            ownAdjBias: number;
            oppAdjBias: number;
            stabilityBias: number;
        };
        TRAP_WILL: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            oppAdjBias: number;
            ownAdjBias: number;
            stabilityBias: number;
        };
        TREASURE_BOX: {
            archetype: string;
            placementWeight: number;
            bonusBias: number;
            flipBias: number;
        };
        ULTIMATE_DESTROY_GOD: {
            archetype: string;
            placementWeight: number;
            oppAdjBias: number;
            flipBias: number;
            stabilityBias: number;
        };
        ULTIMATE_HYPERACTIVE_GOD: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            mobilityBias: number;
            oppAdjBias: number;
            stabilityBias: number;
        };
        ULTIMATE_REVERSE_DRAGON: {
            archetype: string;
            placementWeight: number;
            innerBias: number;
            oppAdjBias: number;
            flipBias: number;
        };
        WILL_HUNTER_KING: {
            archetype: string;
            placementWeight: number;
            cornerBias: number;
            stabilityBias: number;
            oppAdjBias: number;
        };
        WORK_WILL: {
            archetype: string;
            placementWeight: number;
            flipBias: number;
            emptyAdjBias: number;
            stabilityBias: number;
        };
        X_BOMB: {
            archetype: string;
            placementWeight: number;
            innerBias: number;
            emptyAdjBias: number;
            xPenalty: number;
        };
    }>;
    CARD_TYPE_MOVE_PLAN_PROFILE: any;
    buildCardTypeUsageStyle: typeof buildCardTypeUsageStyle;
    buildCardTypeMovePlanProfile: typeof buildCardTypeMovePlanProfile;
    chooseHighestCostCard: typeof chooseHighestCostCard;
    isCornerRecoveryCardType: typeof isCornerRecoveryCardType;
    isCornerHoldCardType: typeof isCornerHoldCardType;
    isChargeRampCardType: typeof isChargeRampCardType;
    hasUsageStyleForCardType: typeof hasUsageStyleForCardType;
    hasBaseScoreBonusForCardType: typeof hasBaseScoreBonusForCardType;
    hasMovePlanProfileForCardType: typeof hasMovePlanProfileForCardType;
    getMovePlanProfileForCardType: typeof getMovePlanProfileForCardType;
    getForcedHandDestroyReason: typeof getForcedHandDestroyReason;
    getForcedHandDestroyPriority: typeof getForcedHandDestroyPriority;
    buildBlockedCardUseDecision: typeof buildBlockedCardUseDecision;
    chooseForcedHandDestroyTarget: typeof chooseForcedHandDestroyTarget;
    countBoardDiscsForPlayer: typeof countBoardDiscsForPlayer;
    countBoardEdgeDiscsForPlayer: typeof countBoardEdgeDiscsForPlayer;
    estimateOwnOppDiscs: typeof estimateOwnOppDiscs;
    buildCardDecisionContext: typeof buildCardDecisionContext;
    scoreCardRetentionPriority: typeof scoreCardRetentionPriority;
    scoreCardUseDecision: typeof scoreCardUseDecision;
    scoreMoveForCornerEdgePlan: typeof scoreMoveForCornerEdgePlan;
    scoreMoveHeuristic: typeof scoreMoveHeuristic;
};
export = _default;
//# sourceMappingURL=cpu-policy-core.d.ts.map