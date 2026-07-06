type CpuPolicyCardTypeFlagsDeps = {
    isCornerRecoveryCardType?: (cardType: unknown) => boolean;
    isCornerHoldCardType?: (cardType: unknown) => boolean;
    isChargeRampCardType?: (cardType: unknown) => boolean;
    throwChainCardTypes?: readonly string[];
    chainWillCardTypes?: readonly string[];
    defensiveCardTypes?: ReadonlySet<string>;
    highVarianceCardTypes?: ReadonlySet<string>;
    stabilityCardTypes?: ReadonlySet<string>;
    swingCardTypes?: ReadonlySet<string>;
    edgeContestCardTypes?: ReadonlySet<string>;
    longHorizonCardTypes?: ReadonlySet<string>;
    whiteLv6CornerSwingKeepTypes?: ReadonlySet<string>;
    whiteLv6FastRotateTypes?: ReadonlySet<string>;
};

export function createCpuPolicyCardTypeFlags(deps?: CpuPolicyCardTypeFlagsDeps) {
    const isCornerRecoveryCardType = typeof deps?.isCornerRecoveryCardType === 'function' ? deps.isCornerRecoveryCardType : (() => false);
    const isCornerHoldCardType = typeof deps?.isCornerHoldCardType === 'function' ? deps.isCornerHoldCardType : (() => false);
    const isChargeRampCardType = typeof deps?.isChargeRampCardType === 'function' ? deps.isChargeRampCardType : (() => false);
    const throwChainCardTypes = Array.isArray(deps?.throwChainCardTypes) ? deps.throwChainCardTypes : [];
    const chainWillCardTypes = Array.isArray(deps?.chainWillCardTypes) ? deps.chainWillCardTypes : [];
    const defensiveCardTypes = deps?.defensiveCardTypes || new Set<string>();
    const highVarianceCardTypes = deps?.highVarianceCardTypes || new Set<string>();
    const stabilityCardTypes = deps?.stabilityCardTypes || new Set<string>();
    const swingCardTypes = deps?.swingCardTypes || new Set<string>();
    const edgeContestCardTypes = deps?.edgeContestCardTypes || new Set<string>();
    const longHorizonCardTypes = deps?.longHorizonCardTypes || new Set<string>();
    const whiteLv6CornerSwingKeepTypes = deps?.whiteLv6CornerSwingKeepTypes || new Set<string>();
    const whiteLv6FastRotateTypes = deps?.whiteLv6FastRotateTypes || new Set<string>();

    function getCpuPolicyCardTypeFlags(rawCardType: unknown) {
        const cardType = String(rawCardType || '');
        const isRecoveryCard = isCornerRecoveryCardType(cardType);
        const isHoldCard = isCornerHoldCardType(cardType);
        const isChargeRampCard = isChargeRampCardType(cardType);
        const isWorkWill = cardType === 'WORK_WILL';
        const isTimeBomb = cardType === 'TIME_BOMB';
        const isTimeStopGod = cardType === 'TIME_STOP_GOD';
        const isTimeStopDeity = cardType === 'TIME_STOP_DEITY';
        const isThrowChainCard = throwChainCardTypes.includes(cardType);
        const isChainWill = chainWillCardTypes.includes(cardType);
        const isLastResort = cardType === 'LAST_RESORT';
        const isEqualityWill = cardType === 'EQUALITY_WILL';
        const isReinforcementWill = (cardType === 'REINFORCEMENT_WILL' || cardType === 'SUPPORT_TROOPS_WILL');
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
        const isObserverWill = cardType === 'OBSERVER_WILL';
        const isBoardExecutor = cardType === 'BOARD_EXECUTOR';
        const isTheoryManifest = cardType === 'THEORY_INCARNATION';
        const isExecutionWill = cardType === 'EXECUTION_WILL';
        const isExtendLifeWill = cardType === 'EXTEND_LIFE_WILL';
        const isExtendLifeGod = cardType === 'EXTEND_LIFE_GOD';
        const isExtendLifeCard = isExtendLifeWill || isExtendLifeGod;
        const isRebuildWill = cardType === 'REBUILD_WILL';
        const isGoldStone = cardType === 'GOLD_STONE';
        const isCrystalStone = cardType === 'CRYSTAL_STONE';
        const isRainbowStone = cardType === 'RAINBOW_STONE';
        const isSilverStone = cardType === 'SILVER_STONE';
        const isTreasureBox = cardType === 'TREASURE_BOX';
        const isLossWill = cardType === 'LOSS_WILL';
        const isCorrosionWill = cardType === 'CORROSION_WILL';
        const isBlockadeWill = cardType === 'BLOCKADE_WILL';
        const isMeteorWill = cardType === 'METEOR_WILL';
        const isMeteorGod = cardType === 'METEOR_GOD';
        const isProtectedNextStone = cardType === 'PROTECTED_NEXT_STONE';
        const isAfterimageWill = cardType === 'AFTERIMAGE_WILL';
        const isGhostWill = cardType === 'GHOST_WILL';
        const isPermaProtectNextStone = cardType === 'PERMA_PROTECT_NEXT_STONE';
        const isGuardWill = cardType === 'GUARD_WILL';
        const isGuardianGod = cardType === 'GUARDIAN_GOD';
        const isRegenWill = cardType === 'REGEN_WILL';
        const isReverseWill = cardType === 'REVERSE_WILL';
        const isLightningWill = cardType === 'LIGHTNING_WILL';
        const isHyperactiveWill = cardType === 'HYPERACTIVE_WILL';
        const isInstantHyperactiveWill = cardType === 'INSTANT_HYPERACTIVE_WILL';
        const isTabooReverseWill = cardType === 'TABOO_REVERSE_WILL';
        const isCrossBomb = cardType === 'CROSS_BOMB';
        const isXBomb = cardType === 'X_BOMB';
        const isUltimateDestroyGod = cardType === 'ULTIMATE_DESTROY_GOD';
        const isUltimateHyperactiveGod = cardType === 'ULTIMATE_HYPERACTIVE_GOD';
        const isDestroyDragonWill = cardType === 'DESTROY_DRAGON_WILL';
        const isBreedingWill = cardType === 'BREEDING_WILL';
        const isTeleportWill = cardType === 'TELEPORT_WILL';
        const isCellTeleportWill = cardType === 'CELL_TELEPORT_WILL';
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
            isMeteorGod ||
            isHyperactiveWill ||
            isInstantHyperactiveWill ||
            isUltimateDestroyGod ||
            isUltimateHyperactiveGod
        );
        const isChargeSwingCard = (
            cardType === 'EQUALITY_WILL' ||
            cardType === 'GOLD_STONE' ||
            cardType === 'CRYSTAL_STONE' ||
            cardType === 'RAINBOW_STONE' ||
            cardType === 'SILVER_STONE'
        );
        const isDefensiveCard = defensiveCardTypes.has(cardType);
        const isHighVarianceCard = highVarianceCardTypes.has(cardType);
        const isStabilityCard = stabilityCardTypes.has(cardType);
        const isSwingCard = swingCardTypes.has(cardType);
        const isEdgeContestCard = edgeContestCardTypes.has(cardType);
        const isLongHorizonCard = longHorizonCardTypes.has(cardType);
        const isWhiteCornerSwingKeepCard = whiteLv6CornerSwingKeepTypes.has(cardType);
        const isFastRotate = whiteLv6FastRotateTypes.has(cardType);
        const isGeneratedKeepPlace = cardType === 'TRIPLE_PLACE' || cardType === 'QUAD_PLACE' || cardType === 'INFINITE_PLACE';

        return {
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
            isObserverWill,
            isBoardExecutor,
            isTheoryManifest,
            isExecutionWill,
            isExtendLifeWill,
            isExtendLifeGod,
            isExtendLifeCard,
            isRebuildWill,
            isGoldStone,
            isCrystalStone,
            isRainbowStone,
            isSilverStone,
            isTreasureBox,
            isLossWill,
            isCorrosionWill,
            isBlockadeWill,
            isMeteorWill,
            isMeteorGod,
            isProtectedNextStone,
            isAfterimageWill,
            isGhostWill,
            isPermaProtectNextStone,
            isGuardWill,
            isGuardianGod,
            isRegenWill,
            isReverseWill,
            isLightningWill,
            isHyperactiveWill,
            isInstantHyperactiveWill,
            isTabooReverseWill,
            isCrossBomb,
            isXBomb,
            isUltimateDestroyGod,
            isUltimateHyperactiveGod,
            isDestroyDragonWill,
            isBreedingWill,
            isTeleportWill,
            isCellTeleportWill,
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
            isWhiteCornerSwingKeepCard,
            isFastRotate,
            isGeneratedKeepPlace
        };
    }

    return {
        getCpuPolicyCardTypeFlags
    };
}
