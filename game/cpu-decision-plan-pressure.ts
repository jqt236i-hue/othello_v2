export {};

function makePlanPressureProfile(basePressure: any, cornerWindowPressure: any, recoveryGapPressure: any, recoveryEmergencyPressure: any): any {
    return Object.freeze({
        basePressure: Math.max(0, Number(basePressure) || 0),
        cornerWindowPressure: Math.max(0, Number(cornerWindowPressure) || 0),
        recoveryGapPressure: Math.max(0, Number(recoveryGapPressure) || 0),
        recoveryEmergencyPressure: Math.max(0, Number(recoveryEmergencyPressure) || 0)
    });
}

const EMPTY_PLAN_PRESSURE_PROFILE = makePlanPressureProfile(0, 0, 0, 0);

const GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE = Object.freeze({
    DOUBLE_PLACE: makePlanPressureProfile(2, 4, 2, 3),
    TRIPLE_PLACE: makePlanPressureProfile(3, 5, 3, 4),
    QUAD_PLACE: makePlanPressureProfile(4, 6, 4, 5),
    INFINITE_PLACE: makePlanPressureProfile(5, 7, 5, 6)
});

const CARD_TYPE_PLAN_PRESSURE_PROFILE = Object.freeze({
    BLOCKADE_WILL: makePlanPressureProfile(1, 2, 1, 1),
    BOARD_EXECUTOR: makePlanPressureProfile(2, 3, 2, 3),
    BOARD_EXPANSION_GOD: makePlanPressureProfile(3, 4, 3, 4),
    BOARD_EXPANSION_WILL: makePlanPressureProfile(2, 3, 2, 3),
    BOARD_SHRINK_WILL: makePlanPressureProfile(3, 4, 3, 2),
    BOARD_SHRINK_GOD: makePlanPressureProfile(4, 5, 4, 3),
    BREEDING_WILL: makePlanPressureProfile(2, 2, 2, 3),
    PROLIFERATION_WILL: makePlanPressureProfile(1, 2, 1, 2),
    CHAIN_WILL: makePlanPressureProfile(2, 4, 2, 3),
    DOUBLE_CHAIN_WILL: makePlanPressureProfile(2, 4, 2, 3),
    TRIPLE_CHAIN_WILL: makePlanPressureProfile(3, 5, 3, 4),
    QUAD_CHAIN_WILL: makePlanPressureProfile(4, 6, 4, 5),
    INFINITE_CHAIN_WILL: makePlanPressureProfile(5, 7, 5, 6),
    CLONE_WILL: makePlanPressureProfile(2, 2, 2, 3),
    CONDEMN_WILL: makePlanPressureProfile(1, 2, 1, 1),
    EXECUTION_WILL: makePlanPressureProfile(1, 2, 1, 2),
    CORNER_TRIBUTE: makePlanPressureProfile(1, 3, 0, 2),
    CORROSION_WILL: makePlanPressureProfile(1, 2, 1, 1),
    CROSS_BOMB: makePlanPressureProfile(3, 4, 3, 3),
    DESTROY_DRAGON_WILL: makePlanPressureProfile(1, 2, 1, 2),
    DESTROY_ONE_STONE: makePlanPressureProfile(4, 5, 4, 0),
    DOUBLE_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.DOUBLE_PLACE,
    TRIPLE_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.TRIPLE_PLACE,
    QUAD_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.QUAD_PLACE,
    INFINITE_PLACE: GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE.INFINITE_PLACE,
    ESCAPE_WILL: makePlanPressureProfile(2, 3, 2, 2),
    EXTEND_LIFE_WILL: makePlanPressureProfile(1, 1, 1, 2),
    EXTEND_LIFE_GOD: makePlanPressureProfile(1, 1, 1, 3),
    EXTREME_HYPERACTIVE_WILL: makePlanPressureProfile(3, 4, 3, 3),
    EQUALITY_WILL: makePlanPressureProfile(2, 3, 2, 2),
    REINFORCEMENT_WILL: makePlanPressureProfile(1, 2, 1, 2),
    SUPPORT_TROOPS_WILL: makePlanPressureProfile(1, 2, 1, 2),
    FATE_WILL: makePlanPressureProfile(2, 3, 2, 2),
    FREE_PLACEMENT: makePlanPressureProfile(2, 4, 2, 0),
    FREEZE_WILL: makePlanPressureProfile(1, 2, 1, 1),
    SEED_WILL: makePlanPressureProfile(2, 3, 1, 3),
    GLUTTONOUS_WILL: makePlanPressureProfile(3, 4, 3, 3),
    GOLD_STONE: makePlanPressureProfile(1, 2, 0, 2),
    CRYSTAL_STONE: makePlanPressureProfile(1, 2, 1, 2),
    RAINBOW_STONE: makePlanPressureProfile(1, 3, 0, 3),
    AFTERIMAGE_WILL: makePlanPressureProfile(0, 0, 0, 1),
    HARD_WILL: makePlanPressureProfile(0, 0, 0, 0),
    GUARDIAN_GOD: makePlanPressureProfile(0, 0, 0, 0),
    GUARD_WILL: makePlanPressureProfile(0, 0, 0, 0),
    GHOST_WILL: makePlanPressureProfile(0, 0, 0, 1),
    HEAVEN_BLESSING: makePlanPressureProfile(1, 2, 1, 2),
    OBSERVER_WILL: makePlanPressureProfile(1, 2, 1, 2),
    REVEAL_HAND_WILL: makePlanPressureProfile(1, 2, 0, 1),
    HYPERACTIVE_WILL: makePlanPressureProfile(3, 3, 3, 3),
    INSTANT_HYPERACTIVE_WILL: makePlanPressureProfile(3, 4, 3, 4),
    LAST_RESORT: makePlanPressureProfile(3, 4, 3, 0),
    LIGHTNING_WILL: makePlanPressureProfile(1, 1, 1, 2),
    LIVING_WILL: makePlanPressureProfile(1, 2, 1, 3),
    LOSS_WILL: makePlanPressureProfile(1, 2, 1, 2),
    METEOR_GOD: makePlanPressureProfile(3, 4, 3, 2),
    METEOR_WILL: makePlanPressureProfile(3, 4, 3, 2),
    PERMA_PROTECT_NEXT_STONE: makePlanPressureProfile(0, 0, 0, 1),
    PLUNDER_WILL: makePlanPressureProfile(1, 2, 0, 2),
    POSITION_SWAP_WILL: makePlanPressureProfile(2, 3, 2, 2),
    PROTECTED_NEXT_STONE: makePlanPressureProfile(0, 0, 0, 1),
    REBUILD_WILL: makePlanPressureProfile(1, 2, 1, 2),
    REGEN_WILL: makePlanPressureProfile(0, 0, 0, 1),
    REVERSE_WILL: makePlanPressureProfile(2, 3, 2, 2),
    RIBO_WILL: makePlanPressureProfile(1, 2, 0, 2),
    ROBOT_VACUUM_WILL: makePlanPressureProfile(2, 2, 2, 3),
    SALVATION_WILL: makePlanPressureProfile(1, 2, 1, 2),
    STONE_SALVATION_GOD: makePlanPressureProfile(1, 2, 1, 2),
    SUPPLY_WILL: makePlanPressureProfile(1, 2, 0, 2),
    SILVER_STONE: makePlanPressureProfile(1, 2, 0, 2),
    SNIPER_WILL: makePlanPressureProfile(1, 1, 1, 2),
    STRONG_WIND_WILL: makePlanPressureProfile(2, 3, 2, 2),
    BUOYANCY_WILL: makePlanPressureProfile(2, 3, 2, 1),
    SUPER_BUOYANCY_WILL: makePlanPressureProfile(2, 4, 2, 0),
    GRAVITY_WILL: makePlanPressureProfile(2, 3, 2, 1),
    SUPER_GRAVITY_WILL: makePlanPressureProfile(2, 4, 2, 0),
    SUPER_ATTRACTION_WILL: makePlanPressureProfile(3, 4, 3, 0),
    SWAP_WITH_ENEMY: makePlanPressureProfile(2, 3, 2, 2),
    TABOO_REVERSE_WILL: makePlanPressureProfile(3, 4, 3, 2),
    TELEPORT_WILL: makePlanPressureProfile(2, 3, 2, 2),
    CELL_TELEPORT_WILL: makePlanPressureProfile(3, 4, 3, 2),
    TEMPT_WILL: makePlanPressureProfile(2, 3, 2, 2),
    CAPTURE_WILL: makePlanPressureProfile(2, 3, 2, 2),
    THEORY_INCARNATION: makePlanPressureProfile(2, 3, 2, 3),
    TIME_BOMB: makePlanPressureProfile(3, 4, 3, 2),
    TIME_STOP_GOD: makePlanPressureProfile(3, 4, 3, 2),
    TRAP_WILL: makePlanPressureProfile(1, 2, 1, 2),
    TREASURE_BOX: makePlanPressureProfile(1, 2, 0, 2),
    ULTIMATE_DESTROY_GOD: makePlanPressureProfile(3, 4, 3, 2),
    ULTIMATE_HYPERACTIVE_GOD: makePlanPressureProfile(4, 5, 4, 3),
    ULTIMATE_REVERSE_DRAGON: makePlanPressureProfile(3, 4, 3, 3),
    WILL_HUNTER_KING: makePlanPressureProfile(3, 4, 3, 4),
    WORK_WILL: makePlanPressureProfile(1, 0, 1, 2),
    X_BOMB: makePlanPressureProfile(3, 4, 3, 3)
});

function getGeneratedThrowChainPlanPressureProfile(cardType: any): any {
    const type = String(cardType || '');
    return Object.prototype.hasOwnProperty.call(GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE, type)
        ? (GENERATED_THROW_CHAIN_PLAN_PRESSURE_PROFILE as any)[type]
        : null;
}

function hasPlanPressureProfileForCardType(cardType: any): any {
    const type = String(cardType || '');
    const hasDirectProfile = Object.prototype.hasOwnProperty.call(CARD_TYPE_PLAN_PRESSURE_PROFILE, type);
    return hasDirectProfile || !!getGeneratedThrowChainPlanPressureProfile(type);
}

function getCardPlanPressureProfile(cardType: any): any {
    const type = String(cardType || '');
    return Object.prototype.hasOwnProperty.call(CARD_TYPE_PLAN_PRESSURE_PROFILE, type)
        ? (CARD_TYPE_PLAN_PRESSURE_PROFILE as any)[type]
        : getGeneratedThrowChainPlanPressureProfile(type);
}

function computeCardPlanPressure(level: any, legalMovesCount: any, planState: any, decisionContext: any): any {
    const plan = planState || {};
    const ctx = decisionContext || {};
    const discDiff = Number.isFinite(ctx.discDiff) ? Number(ctx.discDiff) : 0;
    const handSize = Number.isFinite(ctx.handSize) ? Number(ctx.handSize) : 0;
    const ownCharge = Number.isFinite(ctx.ownCharge) ? Number(ctx.ownCharge) : 0;
    const ownEdges = Number.isFinite(ctx.ownEdges) ? Number(ctx.ownEdges) : 0;
    const oppEdges = Number.isFinite(ctx.oppEdges) ? Number(ctx.oppEdges) : 0;
    const ownSpecialCount = Number.isFinite(ctx.ownSpecialCount) ? Number(ctx.ownSpecialCount) : 0;
    const oppSpecialCount = Number.isFinite(ctx.oppSpecialCount) ? Number(ctx.oppSpecialCount) : 0;

    let pressure = 0;
    if (plan.cornerEmergency === true) pressure += 2;
    else if (Number(plan.oppCorners || 0) > Number(plan.ownCorners || 0)) pressure += 1;

    if (discDiff <= -12) pressure += 2;
    else if (discDiff <= -6) pressure += 1;

    if (legalMovesCount <= 1) pressure += 2;
    else if (legalMovesCount <= 2) pressure += 1;

    if (handSize >= 5) pressure += 2;
    else if (handSize >= 4) pressure += 1;

    if (ownCharge >= 36) pressure += 2;
    else if (ownCharge >= 28) pressure += 1;

    if ((ownEdges - oppEdges) <= -4) pressure += 1;
    if (oppSpecialCount >= (ownSpecialCount + 2)) pressure += 1;
    if (ctx.highBonusMoveAvailable === true) pressure += 1;

    if (plan.cornerEmergency !== true) {
        if (discDiff >= 12) pressure -= 2;
        else if (discDiff >= 6) pressure -= 1;
        if (plan.hasCornerMoveNow === true && legalMovesCount > 1) pressure -= 1;
    }

    return Math.max(0, Math.min(7, pressure));
}

function resolveCardPlanPressureThreshold(legalMovesCount: any, planState: any, profile: any): any {
    const plan = planState || {};
    const activeProfile = profile || EMPTY_PLAN_PRESSURE_PROFILE;
    if (plan.cornerEmergency === true) return activeProfile.recoveryEmergencyPressure;
    if (plan.hasCornerMoveNow === true && legalMovesCount > 1) return activeProfile.cornerWindowPressure;
    if (Number(plan.recoveryCostGap || 0) > 0) return activeProfile.recoveryGapPressure;
    return activeProfile.basePressure;
}

module.exports = {
    makePlanPressureProfile,
    getGeneratedThrowChainPlanPressureProfile,
    hasPlanPressureProfileForCardType,
    getCardPlanPressureProfile,
    computeCardPlanPressure,
    resolveCardPlanPressureThreshold
};
