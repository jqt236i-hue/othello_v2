type CardUsageValidationStageOptions = {
  cardState: any;
  playerKey: string;
  cardId: string;
  deps: any;
  getCardCost: any;
  getCardType: any;
  CardHandManagerModule: any;
  CardMarkersModule: any;
  CardUsagePrechecksModule: any;
  PendingSelectionRegistryModule: any;
  RIBO_WILL_UNLOCK_TURN_INDEX: number;
  TIME_STOP_GOD_SELF_DESTROY_COUNT: number;
};

function prepareCardUsageValidation(options: CardUsageValidationStageOptions): any {
  const {
    gameState,
    handOwnerKey,
    opts,
    getCardCost: getCardCostFn,
    getHandCopyIdAt,
    getEffectiveCardCostForCopy,
    getCardType: getCardTypeFn,
    buildHeavenBlessingSeedHint,
    buildHeavenBlessingOffers,
    buildCondemnOffers,
    buildObserverWillOffers,
    hasStandardLegalMoveForPlayer,
    canUseLastResortForPlayer,
    canUseEqualityWillForPlayer,
    canUseReinforcementWillForPlayer,
    canUseSupportTroopsWillForPlayer,
    canUseTimeStopGodForPlayer,
    canUseTimeStopDeityForPlayer,
    canUseChaosSummon,
    countOpponentOccupiedCornersForPlayer,
    getDestroyTargets,
    getReverseWillTargets,
    getTemptWillTargets,
    getCaptureWillTargets,
    getStrongWindTargets,
    getBuoyancyTargets,
    getSuperBuoyancyTargets,
    getGravityTargets,
    getSuperGravityTargets,
    getSuperAttractionTargets,
    getTrapTargets,
    getGuardTargets,
    getLivingWillTargets,
    getHyperactiveInheritTargets,
    getExtendLifeTargets,
    getCorrosionTargets,
    getTimeBombTargets,
    getTeleportTargets,
    getCellTeleportTargets,
    getCloneTargets,
    getSwapTargets,
    getPositionSwapTargets,
    getBoardExpansionTargets,
    getBoardExpansionGodTargets,
    getBoardShrinkTargets,
    getBoardShrinkGodTargets,
    getBlockadeTargets,
    getMeteorTargets,
    getCausalReplayTargets,
    getFreezeTargets,
    getSeedTargets,
    getTimeStopGodDestroyableCount,
    getLossWillRemovableCount,
    getMassFreezeWillTargetCount,
    getSalvationWillTargetCount,
    getExecutionWillTargetCount,
    getReinforcementWillTargetCount,
    isCardPlayLockedForPlayer,
    CardUsagePrechecksModule: CardUsagePrechecksModuleLocal,
    CardBoardExecutorResolutionModule,
    TIME_STOP_GOD_SELF_DESTROY_COUNT: timeStopSelfDestroyCount,
    RIBO_WILL_UNLOCK_TURN_INDEX: riboUnlockTurnIndex
  } = options.deps || {};

  const validationOptions = opts || {};
  const resolvedGameState = gameState || null;
  const chargeOwnerKey = options.playerKey;
  const handKey = (typeof handOwnerKey === 'string' && handOwnerKey) ? handOwnerKey : options.playerKey;
  if (!options.cardState || !options.cardState.hands || !Array.isArray(options.cardState.hands[handKey])) return { ok: false };

  const cardPlayLocked = typeof isCardPlayLockedForPlayer === 'function'
    ? isCardPlayLockedForPlayer(options.cardState, chargeOwnerKey) === true
    : !!(options.CardMarkersModule && typeof options.CardMarkersModule.isCardPlayLockedForPlayer === 'function'
      && options.CardMarkersModule.isCardPlayLockedForPlayer(options.cardState, chargeOwnerKey));
  if (cardPlayLocked) return { ok: false };

  const handIndex = options.CardHandManagerModule && typeof options.CardHandManagerModule.resolveHandIndexForCard === 'function'
    ? options.CardHandManagerModule.resolveHandIndexForCard(options.cardState, handKey, options.cardId, validationOptions)
    : options.cardState.hands[handKey].indexOf(options.cardId);
  if (handIndex === -1) return { ok: false };

  const costFn = typeof getCardCostFn === 'function' ? getCardCostFn : options.getCardCost;
  const cardCopyIdForCost = typeof getHandCopyIdAt === 'function'
    ? getHandCopyIdAt(options.cardState, handKey, handIndex)
    : null;
  const cost = typeof getEffectiveCardCostForCopy === 'function'
    ? getEffectiveCardCostForCopy(options.cardState, options.cardId, cardCopyIdForCost)
    : costFn(options.cardId);
  if (!(validationOptions.ignoreCost === true)) {
    if (!options.cardState.charge || options.cardState.charge[chargeOwnerKey] < cost) return { ok: false };
  }

  const typeFn = typeof getCardTypeFn === 'function' ? getCardTypeFn : options.getCardType;
  const cardType = typeFn(options.cardId);
  const heavenSeedHint = typeof buildHeavenBlessingSeedHint === 'function'
    ? buildHeavenBlessingSeedHint(options.cardState, chargeOwnerKey)
    : '';
  const pendingSelectionTargetContext = options.PendingSelectionRegistryModule
    && typeof options.PendingSelectionRegistryModule.buildPendingSelectionTargetContext === 'function'
    ? options.PendingSelectionRegistryModule.buildPendingSelectionTargetContext(options.deps)
    : {};
  const precheckModule = CardUsagePrechecksModuleLocal || options.CardUsagePrechecksModule;
  const usagePrecheck = precheckModule && typeof precheckModule.validateCardUsagePreconditions === 'function'
    ? precheckModule.validateCardUsagePreconditions({
      cardType,
      cardId: options.cardId,
      cardState: options.cardState,
      gameState: resolvedGameState,
      playerKey: chargeOwnerKey,
      handKey,
      turnIndex: options.cardState.turnIndex,
      riboUnlockTurnIndex: riboUnlockTurnIndex || options.RIBO_WILL_UNLOCK_TURN_INDEX,
      prng: validationOptions.prng,
      heavenSeedHint,
      hasStandardLegalMoveForPlayer,
      canUseLastResortForPlayer,
      canUseEqualityWillForPlayer,
      canUseReinforcementWillForPlayer,
      canUseSupportTroopsWillForPlayer,
      canUseTimeStopGodForPlayer,
      canUseTimeStopDeityForPlayer,
      canUseChaosSummon,
      countOpponentOccupiedCornersForPlayer,
      getDestroyTargets,
      getReverseWillTargets,
      buildHeavenBlessingOffers,
      buildCondemnOffers,
      buildObserverWillOffers,
      getTemptWillTargets,
      getCaptureWillTargets,
      getStrongWindTargets,
      getBuoyancyTargets,
      getSuperBuoyancyTargets,
      getGravityTargets,
      getSuperGravityTargets,
      getSuperAttractionTargets,
      getTrapTargets,
      getGuardTargets,
      getLivingWillTargets,
      getHyperactiveInheritTargets,
      getExtendLifeTargets,
      getCorrosionTargets,
      getTimeBombTargets,
      getTeleportTargets,
      getCellTeleportTargets,
      getCloneTargets,
      getSwapTargets,
      getPositionSwapTargets,
      getBoardExpansionTargets,
      getBoardExpansionGodTargets,
      getBoardShrinkTargets,
      getBoardShrinkGodTargets,
      getBlockadeTargets,
      getMeteorTargets,
      getCausalReplayTargets,
      getFreezeTargets,
      getSeedTargets,
      ...pendingSelectionTargetContext,
      getTimeStopGodDestroyableCount,
      timeStopGodSelfDestroyCount: timeStopSelfDestroyCount || options.TIME_STOP_GOD_SELF_DESTROY_COUNT,
      getLossWillRemovableCount,
      getMassFreezeWillTargetCount,
      getSalvationWillTargetCount,
      getExecutionWillTargetCount,
      getReinforcementWillTargetCount,
      CardBoardExecutorResolutionModule
    })
    : null;
  if (!usagePrecheck || usagePrecheck.ok !== true) return { ok: false };

  return {
    ok: true,
    gameState: resolvedGameState,
    opts: validationOptions,
    chargeOwnerKey,
    handKey,
    handIndex,
    cost,
    cardType,
    heavenOffers: Array.isArray(usagePrecheck.heavenOffers) ? usagePrecheck.heavenOffers : null,
    condemnOffers: Array.isArray(usagePrecheck.condemnOffers) ? usagePrecheck.condemnOffers : null,
    observerWillOffers: Array.isArray(usagePrecheck.observerWillOffers) ? usagePrecheck.observerWillOffers : null
  };
}

export = {
  prepareCardUsageValidation
};
