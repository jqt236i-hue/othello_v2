type CpuPolicyNumericMap = Record<string, number>;
type CpuPolicyUsageStyle = Record<string, number>;
type CpuPolicyMovePlanProfile = Record<string, string | number>;
type CpuPolicyCardTypeMap<T> = Record<string, T>;

type CpuPolicyCardProfilesDeps = {
    chainWillCardTypes?: readonly string[];
};

function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function createCpuPolicyCardProfiles(deps?: CpuPolicyCardProfilesDeps) {
    const chainWillCardTypes = Array.isArray(deps?.chainWillCardTypes)
        ? deps.chainWillCardTypes.map((type) => String(type || ''))
        : [];

    // Explicit per-card baseline bias so every catalog card type is scored intentionally.
    // Positive: generally usable/safer. Negative: volatile or high opportunity cost.
    const CARD_TYPE_BASE_SCORE_BONUS = Object.freeze({
        BLOCKADE_WILL: 8,
        BOARD_EXPANSION_GOD: -3,
        BOARD_EXPANSION_WILL: -2,
        BOARD_EXECUTOR: 3,
        BOARD_SHRINK_WILL: -3,
        BOARD_SHRINK_GOD: -6,
        BREEDING_WILL: 0,
        CAUSAL_REPLAY_WILL: 0,
        CHAOS_SUMMON: 0,
        DOUBLE_CHAIN_WILL: 4,
        TRIPLE_CHAIN_WILL: 6,
        QUAD_CHAIN_WILL: 8,
        INFINITE_CHAIN_WILL: 6,
        CLONE_WILL: -1,
        CELL_TELEPORT_WILL: -4,
        CONDEMN_WILL: 4,
        OBSERVER_WILL: 5,
        THEORY_INCARNATION: 2,
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
        SUPPORT_TROOPS_WILL: 5,
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
        SACRIFICE_WILL: 0,
        GHOST_WILL: 11,
        HEAVEN_BLESSING: 6,
        HYPERACTIVE_WILL: 0,
        INSTANT_HYPERACTIVE_WILL: 1,
        LAST_RESORT: 8,
        LIGHTNING_WILL: 3,
        METEOR_GOD: 4,
        LIVING_WILL: 8,
        LOSS_WILL: -2,
        METEOR_WILL: -3,
        PERMA_PROTECT_NEXT_STONE: 12,
        POSITION_SWAP_WILL: 6,
        PROLIFERATION_WILL: 1,
        PROTECTED_NEXT_STONE: 10,
        REBUILD_WILL: 0,
        REGEN_WILL: 9,
        REVERSE_WILL: 3,
        RIBO_WILL: 4,
        ROBOT_VACUUM_WILL: 4,
        SALVATION_WILL: 8,
        STONE_SALVATION_GOD: 10,
        SEED_WILL: 2,
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
        TIME_STOP_DEITY: -6,
        TRAP_WILL: 2,
        TREASURE_BOX: 14,
        ULTIMATE_DESTROY_GOD: 3,
        ULTIMATE_HYPERACTIVE_GOD: -6,
        ULTIMATE_REVERSE_DRAGON: 1,
        WILL_HUNTER_KING: 4,
        WORK_WILL: 4,
        X_BOMB: -2,
        ZOMBIE_WILL: 0
    });

    // Keep an explicit list so newly added cards cannot silently bypass CPU usage tuning.
    const allCardTypesForUsageStyle = Object.freeze([
        'BLOCKADE_WILL',
        'BOARD_EXPANSION_GOD',
        'BOARD_EXPANSION_WILL',
        'BOARD_SHRINK_WILL',
        'BOARD_SHRINK_GOD',
        'BREEDING_WILL',
        'CAUSAL_REPLAY_WILL',
        'CHAOS_SUMMON',
        'DOUBLE_CHAIN_WILL',
        'TRIPLE_CHAIN_WILL',
        'QUAD_CHAIN_WILL',
        'INFINITE_CHAIN_WILL',
        'CELL_TELEPORT_WILL',
        'CLONE_WILL',
        'CONDEMN_WILL',
        'OBSERVER_WILL',
        'BOARD_EXECUTOR',
        'THEORY_INCARNATION',
        'EXECUTION_WILL',
        'REVEAL_HAND_WILL',
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
        'SUPPORT_TROOPS_WILL',
        'FATE_WILL',
        'FREE_PLACEMENT',
        'FREEZE_WILL',
        'GLUTTONOUS_WILL',
        'GOLD_STONE',
        'CRYSTAL_STONE',
        'RAINBOW_STONE',
        'SACRIFICE_WILL',
        'GUARDIAN_GOD',
        'GUARD_WILL',
        'AFTERIMAGE_WILL',
        'GHOST_WILL',
        'HEAVEN_BLESSING',
        'HYPERACTIVE_WILL',
        'INSTANT_HYPERACTIVE_WILL',
        'LAST_RESORT',
        'LIGHTNING_WILL',
        'METEOR_GOD',
        'LIVING_WILL',
        'LOSS_WILL',
        'METEOR_WILL',
        'PERMA_PROTECT_NEXT_STONE',
        'POSITION_SWAP_WILL',
        'PROLIFERATION_WILL',
        'PROTECTED_NEXT_STONE',
        'REBUILD_WILL',
        'REGEN_WILL',
        'REVERSE_WILL',
        'RIBO_WILL',
        'ROBOT_VACUUM_WILL',
        'SALVATION_WILL',
        'STONE_SALVATION_GOD',
        'SEED_WILL',
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
        'TIME_STOP_DEITY',
        'TRAP_WILL',
        'TREASURE_BOX',
        'ULTIMATE_DESTROY_GOD',
        'ULTIMATE_HYPERACTIVE_GOD',
        'ULTIMATE_REVERSE_DRAGON',
        'WILL_HUNTER_KING',
        'WORK_WILL',
        'X_BOMB',
        'ZOMBIE_WILL'
    ]);

    const cardTypeUsageStyleOverrides = Object.freeze({
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
        OBSERVER_WILL: { openingBias: -6, midLateBias: 6, endgameBias: -2, handPressureBias: 4, trailingBias: 3, cornerNowBias: -2 },
        BOARD_EXECUTOR: { openingBias: -8, midLateBias: 5, endgameBias: -4, handPressureBias: 3, trailingBias: 5, cornerNowBias: -3 },
        THEORY_INCARNATION: { openingBias: -10, midLateBias: 4, endgameBias: -8, handPressureBias: 2, trailingBias: 4, cornerNowBias: -4 },
        EXECUTION_WILL: { trailingBias: 4, handPressureBias: 6, cornerNowBias: -2 },
        REVEAL_HAND_WILL: { openingBias: 4, midLateBias: 4, endgameBias: -10, handPressureBias: 2, trailingBias: 2, cornerNowBias: -2 },
        CORROSION_WILL: { midLateBias: 2, handPressureBias: 2, endgameBias: -2 },
        CROSS_BOMB: { cornerEmergencyBias: 4, endgameBias: -6 },
        DESTROY_DRAGON_WILL: { cornerNowBias: 6, edgeEmergencyBias: 4, midLateBias: 2 },
        DESTROY_ONE_STONE: { cornerEmergencyBias: 4, lowMobilityBias: 4, cornerNowBias: -2 },
        DOUBLE_PLACE: { trailingBias: 6, handPressureBias: 4, cornerNowBias: -6, endgameBias: -4 },
        TRIPLE_PLACE: { trailingBias: 8, handPressureBias: 6, cornerNowBias: -8, endgameBias: -2 },
        QUAD_PLACE: { trailingBias: 10, handPressureBias: 8, cornerNowBias: -10, endgameBias: 0 },
        INFINITE_PLACE: { trailingBias: 12, handPressureBias: 6, cornerNowBias: -12, endgameBias: 2, lowMobilityBias: 8 },
        EQUALITY_WILL: { midLateBias: 2, endgameBias: -4, handPressureBias: 6 },
        REINFORCEMENT_WILL: { trailingBias: 6, lowMobilityBias: 3, cornerNowBias: -6, handPressureBias: 2, endgameBias: -4 },
        SUPPORT_TROOPS_WILL: { trailingBias: 6, lowMobilityBias: 3, cornerNowBias: -6, handPressureBias: 2, endgameBias: -4 },
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
        METEOR_GOD: { cornerNowBias: 6, edgeEmergencyBias: 3, cornerEmergencyBias: 4, trailingBias: 6, leadBias: -4, endgameBias: -8 },
        LIVING_WILL: { leadBias: 4, openingBias: 4, midLateBias: 2, endgameBias: -4, cornerNowBias: 2 },
        LOSS_WILL: { trailingBias: 4, midLateBias: 2, handPressureBias: 2 },
        METEOR_WILL: { cornerEmergencyBias: 6, trailingBias: 6, leadBias: -4 },
        PERMA_PROTECT_NEXT_STONE: { leadBias: 4, cornerNowBias: 4 },
        POSITION_SWAP_WILL: { trailingBias: 6, edgeEmergencyBias: 4, cornerNowBias: -4 },
        PROLIFERATION_WILL: { openingBias: 6, midLateBias: 4, endgameBias: -6, handPressureBias: 2 },
        PROTECTED_NEXT_STONE: { leadBias: 4, cornerNowBias: 4 },
        REBUILD_WILL: { handPressureBias: 8, openingBias: 2, endgameBias: -4 },
        REGEN_WILL: { leadBias: 4, cornerNowBias: 2, trailingBias: -4 },
        REVERSE_WILL: { trailingBias: 4, midLateBias: 2, cornerEmergencyBias: 2, leadBias: -3 },
        RIBO_WILL: { midLateBias: 6, handPressureBias: 4, leadBias: -8, endgameBias: -10 },
        ROBOT_VACUUM_WILL: { midLateBias: 4, cornerEmergencyBias: 2, endgameBias: -4 },
        SALVATION_WILL: { trailingBias: 4, handPressureBias: 2, endgameBias: -2 },
        STONE_SALVATION_GOD: { leadBias: 4, trailingBias: 2, cornerNowBias: 4, cornerEmergencyBias: 4, edgeEmergencyBias: 2, endgameBias: 2 },
        SEED_WILL: { openingBias: 6, midLateBias: 4, endgameBias: -8, handPressureBias: 4, cornerNowBias: -2 },
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
        TIME_STOP_DEITY: { leadBias: -10, trailingBias: 10, midLateBias: 8, endgameBias: -10, cornerNowBias: 2, cornerEmergencyBias: 6, lowMobilityBias: 4, handPressureBias: 2 },
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
        for (const type of allCardTypesForUsageStyle) style[type] = emptyStyle();
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
            'TREASURE_BOX',
            'WORK_WILL',
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
            ...chainWillCardTypes,
            'DOUBLE_PLACE',
            'TRIPLE_PLACE',
            'QUAD_PLACE',
            'INFINITE_PLACE',
            'CLONE_WILL',
            'TELEPORT_WILL',
            'CELL_TELEPORT_WILL',
            'BOARD_EXPANSION_WILL',
            'BOARD_EXPANSION_GOD',
            'BREEDING_WILL'
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
            'METEOR_GOD',
            'TRAP_WILL',
            'ROBOT_VACUUM_WILL',
            'GLUTTONOUS_WILL',
            'CONDEMN_WILL',
            'OBSERVER_WILL',
            'THEORY_INCARNATION',
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

        for (const type of allCardTypesForUsageStyle) {
            if (!Object.prototype.hasOwnProperty.call(cardTypeUsageStyleOverrides, type)) continue;
            patch([type], cardTypeUsageStyleOverrides[type as keyof typeof cardTypeUsageStyleOverrides]);
        }

        const frozen: CpuPolicyCardTypeMap<CpuPolicyUsageStyle> = Object.create(null);
        for (const type of allCardTypesForUsageStyle) {
            frozen[type] = Object.freeze(Object.assign({}, style[type]));
        }
        return Object.freeze(frozen);
    }

    const cardTypeUsageStyle = buildCardTypeUsageStyle();

    const cardMovePlanArchetypeBase = Object.freeze({
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

    const cardTypeMovePlanProfileOverrides = Object.freeze({
        BLOCKADE_WILL: { archetype: 'controlBoard', placementWeight: 0, oppAdjBias: 2, emptyAdjBias: 1 },
        BOARD_EXPANSION_GOD: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 4, edgeBias: 3, emptyAdjBias: 3 },
        BOARD_EXPANSION_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 2, edgeBias: 4, emptyAdjBias: 3 },
        BOARD_SHRINK_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 3, edgeBias: 4, oppAdjBias: 3, emptyAdjBias: 1 },
        BOARD_SHRINK_GOD: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 4, edgeBias: 5, oppAdjBias: 4, emptyAdjBias: 1 },
        BREEDING_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1, oppAdjBias: 2 },
        // These types previously had no plan entry. placementWeight: 0 preserves that
        // no-op scoring path while making the catalog coverage explicit.
        CAUSAL_REPLAY_WILL: { archetype: 'economyCycle', placementWeight: 0 },
        CHAOS_SUMMON: { archetype: 'economyCycle', placementWeight: 0 },
        DOUBLE_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 4, oppAdjBias: 3 },
        TRIPLE_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 5, oppAdjBias: 4, bonusBias: 1 },
        QUAD_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 6, oppAdjBias: 5, bonusBias: 2 },
        INFINITE_CHAIN_WILL: { archetype: 'explosiveComeback', placementWeight: 2, flipBias: 7, oppAdjBias: 6, bonusBias: 3, stabilityBias: -1 },
        CLONE_WILL: { archetype: 'spawnMobile', placementWeight: 0, ownAdjBias: 1, edgeBias: 2 },
        CONDEMN_WILL: { archetype: 'economyCycle', placementWeight: 0 },
        OBSERVER_WILL: { archetype: 'economyCycle', placementWeight: 0 },
        BOARD_EXECUTOR: { archetype: 'controlBoard', placementWeight: 0, stabilityBias: -3 },
        THEORY_INCARNATION: { archetype: 'economyCycle', placementWeight: 0, bonusBias: 5, stabilityBias: -2 },
        EXECUTION_WILL: { archetype: 'economyCycle', placementWeight: 0 },
        REVEAL_HAND_WILL: { archetype: 'economyCycle', placementWeight: 0 },
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
        EQUALITY_WILL: { archetype: 'economyCycle', placementWeight: 0 },
        REINFORCEMENT_WILL: { archetype: 'recoveryReposition', placementWeight: 0, innerBias: 2, flipBias: 2, stabilityBias: 1 },
        SUPPORT_TROOPS_WILL: { archetype: 'recoveryReposition', placementWeight: 0, innerBias: 2, flipBias: 2, stabilityBias: 1 },
        FATE_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 4, edgeBias: 2, mobilityBias: 3, oppAdjBias: 2 },
        FREE_PLACEMENT: { archetype: 'recoveryReposition', placementWeight: 3, cornerBias: 4, edgeBias: 3, innerBias: -2, bonusBias: 2, xPenalty: 3, cPenalty: 2 },
        FREEZE_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 2, edgeBias: 2, stabilityBias: 3, oppAdjBias: 1 },
        GLUTTONOUS_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: 2, edgeBias: 2, oppAdjBias: 3, stabilityBias: 2 },
        GOLD_STONE: { archetype: 'economyCycle', placementWeight: 2, bonusBias: 4, flipBias: 4, stabilityBias: -1 },
        CRYSTAL_STONE: { archetype: 'economyCycle', placementWeight: 2, bonusBias: 8, flipBias: 0, stabilityBias: -1 },
        RAINBOW_STONE: { archetype: 'economyCycle', placementWeight: 2, bonusBias: 6, flipBias: 6, stabilityBias: -2 },
        SACRIFICE_WILL: { archetype: 'economyCycle', placementWeight: 0 },
        GUARDIAN_GOD: { archetype: 'anchorProtect', placementWeight: 0, cornerBias: 4, stabilityBias: 4 },
        GUARD_WILL: { archetype: 'anchorProtect', placementWeight: 0, edgeBias: 3, ownAdjBias: 3 },
        AFTERIMAGE_WILL: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 3, stabilityBias: 3, oppAdjBias: 1 },
        GHOST_WILL: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 3, stabilityBias: 3, oppAdjBias: 1 },
        HEAVEN_BLESSING: { archetype: 'economyCycle', placementWeight: 0 },
        HYPERACTIVE_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1, stabilityBias: -1 },
        INSTANT_HYPERACTIVE_WILL: { archetype: 'explosiveComeback', placementWeight: 2, mobilityBias: 4, emptyAdjBias: 4, cornerBias: -1, stabilityBias: -1 },
        LAST_RESORT: { archetype: 'recoveryReposition', placementWeight: 3, cornerBias: 5, edgeBias: 3, innerBias: -3, bonusBias: 2 },
        LIGHTNING_WILL: { archetype: 'anchorEngine', placementWeight: 3, cornerBias: 4, stabilityBias: 4, oppAdjBias: -1 },
        METEOR_GOD: { archetype: 'anchorEngine', placementWeight: 3, cornerBias: 4, edgeBias: 2, stabilityBias: 4, oppAdjBias: -1 },
        LIVING_WILL: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 3, edgeBias: 2, ownAdjBias: 3, stabilityBias: 5 },
        LOSS_WILL: { archetype: 'controlBoard', placementWeight: 0, edgeBias: 4, oppAdjBias: 2 },
        METEOR_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 3, oppAdjBias: 3, bonusBias: 2 },
        CELL_TELEPORT_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: 3, edgeBias: 3, oppAdjBias: 3, emptyAdjBias: 2, stabilityBias: -1 },
        PERMA_PROTECT_NEXT_STONE: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 4, stabilityBias: 4 },
        POSITION_SWAP_WILL: { archetype: 'recoveryReposition', placementWeight: 0, cornerBias: 4, edgeBias: 3, emptyAdjBias: 3 },
        PROLIFERATION_WILL: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1 },
        PROTECTED_NEXT_STONE: { archetype: 'anchorProtect', placementWeight: 3 },
        REBUILD_WILL: { archetype: 'economyCycle', placementWeight: 0 },
        REGEN_WILL: { archetype: 'anchorProtect', placementWeight: 3, innerBias: -1, flipBias: 1, oppAdjBias: 1 },
        REVERSE_WILL: { archetype: 'controlBoard', placementWeight: 0, flipBias: 3, oppAdjBias: 2 },
        RIBO_WILL: { archetype: 'economyCycle', placementWeight: 0, bonusBias: 1, flipBias: 1 },
        ROBOT_VACUUM_WILL: { archetype: 'spawnMobile', placementWeight: 3, edgeBias: 2, oppAdjBias: 3, stabilityBias: 2 },
        SALVATION_WILL: { archetype: 'recoveryReposition', placementWeight: 0, ownAdjBias: 2, stabilityBias: 2 },
        STONE_SALVATION_GOD: { archetype: 'anchorProtect', placementWeight: 3, cornerBias: 4, edgeBias: 3, ownAdjBias: 3, stabilityBias: 5 },
        SEED_WILL: { archetype: 'spawnMobile', placementWeight: 0, edgeBias: 2, emptyAdjBias: 3, ownAdjBias: 2, stabilityBias: 1 },
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
        TIME_STOP_DEITY: { archetype: 'anchorEngine', placementWeight: 4, cornerBias: 5, edgeBias: 4, innerBias: -2, emptyAdjBias: -1, ownAdjBias: 3, oppAdjBias: -1, stabilityBias: 6 },
        TRAP_WILL: { archetype: 'controlBoard', placementWeight: 0, cornerBias: -2, oppAdjBias: 3, ownAdjBias: -2, stabilityBias: -2 },
        TREASURE_BOX: { archetype: 'economyCycle', placementWeight: 0, bonusBias: 1, flipBias: 1 },
        ULTIMATE_DESTROY_GOD: { archetype: 'anchorEngine', placementWeight: 3, oppAdjBias: 3, flipBias: 2, stabilityBias: -1 },
        ULTIMATE_HYPERACTIVE_GOD: { archetype: 'spawnMobile', placementWeight: 3, cornerBias: -1, mobilityBias: 4, oppAdjBias: 2, stabilityBias: -1 },
        ULTIMATE_REVERSE_DRAGON: { archetype: 'anchorEngine', placementWeight: 3, innerBias: 1, oppAdjBias: 3, flipBias: 3 },
        WILL_HUNTER_KING: { archetype: 'anchorEngine', placementWeight: 3, cornerBias: 4, stabilityBias: 4, oppAdjBias: -1 },
        WORK_WILL: { archetype: 'anchorEngine', placementWeight: 3, flipBias: 0, emptyAdjBias: -1, stabilityBias: 5 },
        X_BOMB: { archetype: 'explosiveComeback', placementWeight: 3, innerBias: 2, emptyAdjBias: 3, xPenalty: 0 },
        ZOMBIE_WILL: { archetype: 'economyCycle', placementWeight: 0 }
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
        for (const type of allCardTypesForUsageStyle) {
            const override = Object.prototype.hasOwnProperty.call(cardTypeMovePlanProfileOverrides, type)
                ? cardTypeMovePlanProfileOverrides[type as keyof typeof cardTypeMovePlanProfileOverrides]
                : { archetype: 'economyCycle', placementWeight: 0 };
            const archetypeName = typeof override.archetype === 'string'
                ? override.archetype
                : 'economyCycle';
            const base = Object.prototype.hasOwnProperty.call(cardMovePlanArchetypeBase, archetypeName)
                ? cardMovePlanArchetypeBase[archetypeName as keyof typeof cardMovePlanArchetypeBase]
                : cardMovePlanArchetypeBase.economyCycle;
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

    const cardTypeMovePlanProfile = buildCardTypeMovePlanProfile();

    return {
        CARD_TYPE_BASE_SCORE_BONUS,
        CARD_TYPE_USAGE_STYLE: cardTypeUsageStyle,
        CARD_TYPE_MOVE_PLAN_PROFILE: cardTypeMovePlanProfile
    };
}
