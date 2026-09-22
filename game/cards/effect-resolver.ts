/**
 * @file effect-resolver.ts
 * @description Card effect resolution and context builders (restored from worker-public mirror)
 */

import SharedConstants = require('../../shared-constants');
import CardHandManagerModule = require('../logic/cards-internal/hand-manager');
import CardChargeLedgerModule = require('../logic/cards-internal/charge-ledger');
import CardStateManagerModule = require('./state-manager');
import CardPendingStateManagerModule = require('../logic/cards-internal/pending-state-manager');
import CardUsagePrechecksModule = require('../logic/cards-internal/card-usage-prechecks');
import PendingSelectionRegistryModule = require('../logic/cards-internal/pending-selection-registry');
import CardMarkersModule = require('../logic/cards/markers');
import SpecialStoneRegistryImport = require('../../shared/special-stone-registry-static');
import SpecialCardRegistry = require('../../shared/special-card-registry');
import ManifestStoneRegistry = require('../../shared/manifest-stone-registry');
import CardProtectionContext = require('../logic/cards-internal/protection-context');
import CardSacrificeWillModule = require('../logic/cards/sacrifice_will');
import CardUsageConsumptionStage = require('./card-usage-consumption-stage');
import CardUsagePendingStage = require('./card-usage-pending-stage');
import CardUsageImmediateStage = require('./card-usage-immediate-stage');
import CardUsageSacrificeStage = require('./card-usage-sacrifice-stage');
import CardUsagePresentationStage = require('./card-usage-presentation-stage');
import CardUsageValidationStage = require('./card-usage-validation-stage');

const SpecialStoneRegistry: any = SpecialStoneRegistryImport;

const {
  CARD_DEFS,
  CARD_TYPE_BY_ID,
  BLACK,
  WHITE,
  EMPTY,
  CHARGE_MAX
} = SharedConstants || {};

const MAX_HAND_SIZE = 5;
const RIBO_WILL_UNLOCK_TURN_INDEX = 19;
const TIME_STOP_GOD_SELF_DESTROY_COUNT = 3;

function getCardDef(cardId: any, context?: any) {
  if (!CardHandManagerModule || typeof CardHandManagerModule.getCardDef !== 'function') {
    throw new Error('[effect-resolver.js] CardHandManager.getCardDef not available');
  }
  return CardHandManagerModule.getCardDef(cardId, context);
}

function getCardType(cardId: any, context?: any) {
  if (!CardHandManagerModule || typeof CardHandManagerModule.getCardType !== 'function') {
    throw new Error('[effect-resolver.js] CardHandManager.getCardType not available');
  }
  return CardHandManagerModule.getCardType(cardId, context);
}

function getCardCost(cardId: any, context?: any) {
  if (!CardHandManagerModule || typeof CardHandManagerModule.getCardCost !== 'function') {
    throw new Error('[effect-resolver.js] CardHandManager.getCardCost not available');
  }
  return CardHandManagerModule.getCardCost(cardId, context);
}

function getCardDisplayName(cardId: any, context?: any) {
  if (!CardHandManagerModule || typeof CardHandManagerModule.getCardDisplayName !== 'function') {
    throw new Error('[effect-resolver.js] CardHandManager.getCardDisplayName not available');
  }
  return CardHandManagerModule.getCardDisplayName(cardId, context);
}

function getCardHandManagerContext(deps: any) {
  const {
    hasStandardLegalMoveForPlayer,
    canUseLastResortForPlayer,
    canUseEqualityWillForPlayer,
    canUseReinforcementWillForPlayer,
    canUseSupportTroopsWillForPlayer,
    canUseTimeStopGodForPlayer,
    canUseTimeStopDeityForPlayer,
    canUseChaosSummon,
    buildHeavenBlessingSeedHint,
    buildHeavenBlessingOffers,
    buildCondemnOffers,
    buildObserverWillOffers,
    getLossWillRemovableCount,
    getMassFreezeWillTargetCount,
    getSalvationWillTargetCount,
    getExecutionWillTargetCount,
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
    getReincarnationTargets,
    getHyperactiveInheritTargets,
    getExtendLifeTargets,
    getCorrosionTargets,
    getTimeBombTargets,
    getTeleportTargets,
    getCellTeleportTargets,
    getCloneTargets,
    getSwapTargets,
    getPositionSwapTargets,
    getReinforcementWillTargets,
    getOccupiedBoardShapeCellsForCard,
    getBoardExpansionTargets,
    getBoardExpansionGodTargets,
    getBoardShrinkTargets,
    getBoardShrinkGodTargets,
    getBlockadeTargets,
    getPoisonTargets,
    getMeteorTargets,
    getCausalReplayTargets,
    getFreezeTargets,
    getSeedTargets,
    CardDefsModule,
    CardCostsModule,
    CardSelectorsModule,
    CardBoardExecutorResolutionModule
  } = deps || {};
  const pendingSelectionTargetContext = PendingSelectionRegistryModule && typeof PendingSelectionRegistryModule.buildPendingSelectionTargetContext === 'function'
    ? PendingSelectionRegistryModule.buildPendingSelectionTargetContext(deps)
    : {};

  return {
    helperSelectorLane: 'public',
    constants: {
      CARD_DEFS,
      CARD_TYPE_BY_ID,
      MAX_HAND_SIZE,
      RIBO_WILL_UNLOCK_TURN_INDEX
    },
    helpers: {
      hasStandardLegalMoveForPlayer,
      canUseLastResortForPlayer,
      canUseEqualityWillForPlayer,
      canUseReinforcementWillForPlayer,
      canUseSupportTroopsWillForPlayer,
      canUseTimeStopGodForPlayer,
    canUseTimeStopDeityForPlayer,
      canUseChaosSummon,
      buildHeavenBlessingSeedHint,
      buildHeavenBlessingOffers,
      buildCondemnOffers,
      buildObserverWillOffers,
      getLossWillRemovableCount,
      getMassFreezeWillTargetCount,
      getSalvationWillTargetCount,
      getExecutionWillTargetCount,
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
    getReincarnationTargets,
      getHyperactiveInheritTargets,
      getExtendLifeTargets,
      getCorrosionTargets,
      getTimeBombTargets,
      getTeleportTargets,
      getCellTeleportTargets,
      getCloneTargets,
      getSwapTargets,
      getPositionSwapTargets,
      getReinforcementWillTargets,
      getOccupiedBoardShapeCellsForCard,
      getBoardExpansionTargets,
      getBoardExpansionGodTargets,
      getBoardShrinkTargets,
      getBoardShrinkGodTargets,
      getBlockadeTargets,
      getPoisonTargets,
      getMeteorTargets,
      getCausalReplayTargets,
      getFreezeTargets,
      getSeedTargets,
      ...pendingSelectionTargetContext
    },
    modules: {
      CardDefsModule,
      CardCostsModule,
      CardSelectorsModule,
      CardBoardExecutorResolutionModule
    }
  };
}

function getCardEffectTimingContext(deps: any) {
  const {
    defaultPrng,
    _ensureHandDestroyFlags,
    processRiboWillTurnStartEffects,
    processObserverWillRepaymentsAtTurnStart,
    processBoardExecutorHandTaxAtTurnStart,
    commitDraw,
    getSpecialMarkers,
    getCardContext,
    getFlipsWithContext,
    getOccupiedOriginFlipsWithContext,
    removeMarkersAt,
    isFrozenCellForCard,
    emitPresentationEvent,
    addChargeValue,
    addChargeWithTotal,
    addMarker,
    clearBombAt,
    clearHyperactiveAtPositions,
    applyStrongWill,
    applyRegenWill,
    workDebugLog,
    workDebugError,
    hasBoardShapeCellForCard,
    getCellValueForCard,
    setCellValueForCard,
    clearStoneIdAtForCard,
    CardWorkModule,
    CardLivingWillModule,
    CardZombieWillModule,
    CardSpawnAndFlipModule,
    CardBoardExecutorResolutionModule,
    BoardOpsModule,
    ULTIMATE_DRAGON_TURNS,
    ULTIMATE_DESTROY_GOD_TURNS,
    ULTIMATE_HYPERACTIVE_TURNS,
    STONE_SALVATION_GOD_TURNS,
    EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
    EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
    AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
    AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
    SNIPER_WILL_TURNS,
    DESTROY_DRAGON_TURNS,
    LIGHTNING_WILL_TURNS,
    FIRE_WILL_TURNS,
    WATER_WILL_TURNS,
    GRASS_WILL_TURNS,
    METEOR_GOD_TURNS,
    GHOST_WILL_TURNS,
    SACRIFICE_WILL_TURNS,
    SEED_WILL_TURNS,
    WILL_HUNTER_KING_TURNS,
    ROBOT_VACUUM_TURNS,
    TIME_STOP_GOD_TURNS,
    DOUBLE_PLACE_EXTRA,
    THROW_CHAIN_CONFIG_BY_TYPE,
    MARKER_KINDS,
    FLIP_CHARGE_MULTIPLIER_EFFECTS,
    NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS
  } = deps || {};

  const specialStoneKind = MARKER_KINDS ? MARKER_KINDS.SPECIAL_STONE : 'specialStone';

  return {
    defaultPrng,
    constants: {
      BLACK,
      WHITE,
      EMPTY,
      DRAW_INTERVAL: 1,
      FLIP_CHARGE_MULTIPLIER_EFFECTS: FLIP_CHARGE_MULTIPLIER_EFFECTS || {},
      NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS: NUMBER_CELL_CHARGE_MULTIPLIER_EFFECTS || {},
      ULTIMATE_DRAGON_TURNS,
      ULTIMATE_DESTROY_GOD_TURNS,
      ULTIMATE_HYPERACTIVE_TURNS,
      STONE_SALVATION_GOD_TURNS,
      EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
      EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
      AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
      AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
      SNIPER_WILL_TURNS,
      DESTROY_DRAGON_TURNS,
      LIGHTNING_WILL_TURNS,
      FIRE_WILL_TURNS,
      WATER_WILL_TURNS,
      GRASS_WILL_TURNS,
      METEOR_GOD_TURNS,
      GHOST_WILL_TURNS,
      SACRIFICE_WILL_TURNS,
      SEED_WILL_TURNS,
      WILL_HUNTER_KING_TURNS,
      ROBOT_VACUUM_TURNS,
      TIME_STOP_GOD_TURNS,
      DOUBLE_PLACE_EXTRA,
      THROW_CHAIN_CONFIG_BY_TYPE,
      MARKER_KINDS
    },
    helpers: {
      ensureHandDestroyFlags: _ensureHandDestroyFlags,
      processRiboWillTurnStartEffects,
      processObserverWillRepaymentsAtTurnStart,
      processBoardExecutorHandTaxAtTurnStart,
      commitDraw,
      getSpecialMarkers,
      getCardContext,
      getFlipsWithContext,
      getOccupiedOriginFlipsWithContext,
      removeMarkersAt,
      isFrozenCellForCard,
      emitPresentationEvent,
      addChargeValue,
      addChargeWithTotal,
      addMarker,
      clearBombAt,
      clearHyperactiveAtPositions,
      applyStrongWill,
      applyRegenWill,
      workDebugLog,
      workDebugError,
      hasBoardShapeCellForCard,
      getCellValueForCard,
      setCellValueForCard,
      clearStoneIdAtForCard
    },
    modules: {
      CardWorkModule,
      CardLivingWillModule,
      CardZombieWillModule,
      CardSpawnAndFlipModule,
      CardBoardExecutorResolutionModule,
      ProtectedNextStoneModule: {
        applyProtectedNextStone(cardState: any, playerKey: string, row: number, col: number) {
          if (typeof addMarker === 'function') {
            addMarker(cardState, specialStoneKind, row, col, playerKey, {
              type: 'PROTECTED',
              expiresForPlayer: playerKey
            });
          }
          return { applied: true };
        }
      },
      PermaProtectNextStoneModule: {
        applyPermaProtectNextStone(cardState: any, playerKey: string, row: number, col: number) {
          if (typeof applyStrongWill === 'function') {
            return applyStrongWill(cardState, playerKey, row, col);
          }
          return { applied: false };
        }
      },
      BoardOpsModule
    }
  };
}

function getCardContext(cardState: any, deps: any) {
  if (!CardProtectionContext || typeof CardProtectionContext.buildCardProtectionContext !== 'function') {
    throw new Error('[effect-resolver] CardProtectionContext.buildCardProtectionContext not available');
  }
  if (!SpecialStoneRegistry || typeof SpecialStoneRegistry.getSpecialStoneInfo !== 'function') {
    throw new Error('[effect-resolver] SpecialStoneRegistry.getSpecialStoneInfo not available');
  }
  const {
    createMarkerContextIndex,
    getSpecialMarkers,
    getManifestMarkers,
    getBombMarkers,
    getBlockingMarkers,
    isFrozenCellForCard
  } = deps || {};
  return CardProtectionContext.buildCardProtectionContext(cardState, {
    constants: SharedConstants,
    SpecialStoneRegistry,
    ManifestStoneRegistry,
    createMarkerContextIndex,
    getSpecialMarkers,
    getManifestMarkers,
    getBombMarkers,
    getBlockingMarkers,
    isFrozenCellForCard
  });
}

function clearUsedSelectedCard(cardState: any, cardId: string, ownerKey: string) {
  if (!cardState || !cardId) return;
  if (cardState.selectedCardId !== cardId) return;
  const selectedOwnerKey = cardState.selectedCardOwnerKey;
  if (selectedOwnerKey && selectedOwnerKey !== ownerKey) return;
  cardState.selectedCardId = null;
  cardState.selectedCardOwnerKey = null;
}

/**
 * Apply card usage (Remove from hand, consume charge, set pending effect)
 */
function applyCardUsage(cardState: any, playerKey: string, cardId: string, deps: any) {
  const {
    applyTheoryIncarnationUsage,
    applyChaosSummonUsage,
    applyBoardExecutorUsage,
    removeHandCardAt,
    addCardToDiscard,
    addChargeValue,
    writeCardPendingEffect,
    readCardPendingEffect,
    getBoardExpansionGodRequiredSelectionCount,
    getBoardShrinkSelectionCount,
    workDebugLog,
    emitPresentationEvent,
    addGeneratedThrowChainCard,
    addGeneratedChainWillCard,
    getCardDef: getCardDefFn,
    BoardOpsModule,
    MARKER_KINDS,
    getCellValueForCard,
    getSpecialMarkers,
    SpecialCardRegistryModule
  } = deps || {};

  if (!CardUsageValidationStage || typeof CardUsageValidationStage.prepareCardUsageValidation !== 'function') {
    throw new Error('[effect-resolver] CardUsageValidationStage.prepareCardUsageValidation not available');
  }
  const usageValidation = CardUsageValidationStage.prepareCardUsageValidation({
    cardState,
    playerKey,
    cardId,
    deps,
    getCardCost,
    getCardType,
    CardHandManagerModule,
    CardMarkersModule,
    CardUsagePrechecksModule,
    PendingSelectionRegistryModule,
    RIBO_WILL_UNLOCK_TURN_INDEX,
    TIME_STOP_GOD_SELF_DESTROY_COUNT
  });
  if (!usageValidation || usageValidation.ok !== true) return false;
  const {
    gameState: _gameState,
    opts: _opts,
    chargeOwnerKey,
    handKey,
    handIndex: idx,
    cost,
    cardType,
    heavenOffers,
    condemnOffers,
    observerWillOffers
  } = usageValidation;

  if (!CardUsageConsumptionStage || typeof CardUsageConsumptionStage.consumeCardUsage !== 'function') {
    throw new Error('[effect-resolver] CardUsageConsumptionStage.consumeCardUsage not available');
  }
  const consumption = CardUsageConsumptionStage.consumeCardUsage({
    cardState,
    handKey,
    chargeOwnerKey,
    cardId,
    handIndex: idx,
    cost,
    noConsume: _opts.noConsume === true,
    removeHandCardAt,
    addCardToDiscard,
    addChargeValue,
    clearUsedSelectedCard
  });
  if (!consumption || consumption.ok !== true) return false;
  const removedCard = consumption.removedCard;

  const defFn = typeof getCardDefFn === 'function' ? getCardDefFn : getCardDef;
  const usedCardDef = defFn(cardId);
  if (!CardUsagePresentationStage || typeof CardUsagePresentationStage.createCardUsedPresentationEmitter !== 'function') {
    throw new Error('[effect-resolver] CardUsagePresentationStage.createCardUsedPresentationEmitter not available');
  }
  const emitCardUsedPresentationOnce = CardUsagePresentationStage.createCardUsedPresentationEmitter({
    cardState,
    handKey,
    chargeOwnerKey,
    cardId,
    cost,
    usedCardDef,
    emitPresentationEvent
  });

  if (!CardUsageSacrificeStage || typeof CardUsageSacrificeStage.applySacrificeCardUsageNullification !== 'function') {
    throw new Error('[effect-resolver] CardUsageSacrificeStage.applySacrificeCardUsageNullification not available');
  }
  const sacrificeUsage = CardUsageSacrificeStage.applySacrificeCardUsageNullification({
    cardState,
    gameState: _gameState,
    chargeOwnerKey,
    cardId,
    cardType,
    CardSacrificeWillModule,
    SpecialCardRegistry: SpecialCardRegistryModule || SpecialCardRegistry,
    BoardOpsModule,
    MARKER_KINDS,
    getCellValueForCard,
    getSpecialMarkers,
    EMPTY,
    writeCardPendingEffect,
    emitPresentationEvent,
    emitCardUsedAtEventIndexes: (extraMeta: any, presentationIndex: number, persistIndex: number) => {
      CardUsagePresentationStage.emitCardUsedAtEventIndexes(
        cardState,
        () => emitCardUsedPresentationOnce(extraMeta),
        presentationIndex,
        persistIndex
      );
    }
  });
  if (sacrificeUsage && sacrificeUsage.nullified === true) {
    return true;
  }

  if (!CardUsageImmediateStage || typeof CardUsageImmediateStage.applyImmediateCardUsage !== 'function') {
    throw new Error('[effect-resolver] CardUsageImmediateStage.applyImmediateCardUsage not available');
  }
  const immediateUsage = CardUsageImmediateStage.applyImmediateCardUsage({
    cardState,
    gameState: _gameState,
    playerKey: chargeOwnerKey,
    cardType,
    prng: _opts.prng,
    applyTheoryIncarnationUsage,
    applyChaosSummonUsage,
    applyBoardExecutorUsage
  });
  if (!immediateUsage || immediateUsage.ok !== true) return false;

  if (!CardUsagePendingStage || typeof CardUsagePendingStage.commitCardUsagePendingState !== 'function') {
    throw new Error('[effect-resolver] CardUsagePendingStage.commitCardUsagePendingState not available');
  }
  CardUsagePendingStage.commitCardUsagePendingState({
    cardState,
    gameState: _gameState,
    cardType,
    cardId,
    chargeOwnerKey,
    removedCard,
    heavenOffers,
    condemnOffers,
    observerWillOffers,
    CardPendingStateManagerModule,
    writeCardPendingEffect,
    readCardPendingEffect,
    getBoardExpansionGodRequiredSelectionCount,
    getBoardShrinkSelectionCount,
    workDebugLog
  });

  if (typeof CardUsagePresentationStage.finalizeCardUsagePresentation !== 'function') {
    throw new Error('[effect-resolver] CardUsagePresentationStage.finalizeCardUsagePresentation not available');
  }
  CardUsagePresentationStage.finalizeCardUsagePresentation({
    cardState,
    handKey,
    cardId,
    cardType,
    emitCardUsedPresentationOnce,
    addGeneratedThrowChainCard,
    addGeneratedChainWillCard
  });

  return true;
}

/**
 * Cancel a pending selection card (refund + return card to hand).
 */
function cancelPendingSelection(cardState: any, playerKey: string, opts: any, deps: any) {
  const {
    CardPendingStateManagerModule: CardPendingStateManagerModuleLocal,
    getCardDef: getCardDefFn,
    addChargeValue,
    moveDiscardCardToHandByCardId,
    readCardPendingEffect,
    clearCardPendingEffect
  } = deps || {};

  const pendingMgr = CardPendingStateManagerModuleLocal || CardPendingStateManagerModule;

  if (pendingMgr && typeof pendingMgr.cancelPendingSelection === 'function') {
    const defFn = typeof getCardDefFn === 'function' ? getCardDefFn : getCardDef;
    const result = pendingMgr.cancelPendingSelection(cardState, playerKey, opts, {
      helpers: {
        getCardDef: defFn,
        addChargeValue,
        moveDiscardCardToHandByCardId
      }
    });
    if (result && result.canceled && typeof clearCardPendingEffect === 'function') {
      clearCardPendingEffect(cardState, playerKey);
    }
    return result;
  }

  if (!cardState || !cardState.pendingEffectByPlayer) return { canceled: false, reason: 'no_state' };
  const pending = typeof readCardPendingEffect === 'function'
    ? readCardPendingEffect(cardState, playerKey)
    : (cardState.pendingEffectByPlayer[playerKey] || null);
  if (!pending || pending.stage !== 'selectTarget') return { canceled: false, reason: 'not_pending' };
  if (!(pendingMgr && typeof pendingMgr.isCancellablePendingType === 'function' && pendingMgr.isCancellablePendingType(pending.type))) {
    return { canceled: false, reason: 'not_cancellable' };
  }

  const cardId = pending.cardId;
  const defFn = typeof getCardDefFn === 'function' ? getCardDefFn : getCardDef;
  const cardDef = cardId ? defFn(cardId) : null;
  const cost = cardDef ? cardDef.cost : 0;
  const refundCost = !(opts && opts.refundCost === false);
  const resetUsage = !(opts && opts.resetUsage === false);
  const noConsume = !!(opts && opts.noConsume);

  if (refundCost && !noConsume && typeof addChargeValue === 'function') {
    addChargeValue(cardState, playerKey, cost, 'card_cancel_refund');
  }
  if (resetUsage && !noConsume) {
    cardState.hasUsedCardThisTurnByPlayer[playerKey] = false;
  }
  if (!noConsume) {
    cardState.cardUseCountByPlayer = cardState.cardUseCountByPlayer || { black: 0, white: 0 };
    cardState.cardUseCountByPlayer[playerKey] = Math.max(0, (cardState.cardUseCountByPlayer[playerKey] || 0) - 1);
  }

  if (cardId && typeof moveDiscardCardToHandByCardId === 'function') {
    const handKey = cardState.hands[playerKey] ? playerKey : 'black';
    moveDiscardCardToHandByCardId(cardState, handKey, cardId, { ignoreHandLimit: true });
  }

  if (typeof clearCardPendingEffect === 'function') {
    clearCardPendingEffect(cardState, playerKey);
  }

  return { canceled: true, cardId };
}

export = {
  getCardHandManagerContext,
  getCardEffectTimingContext,
  getCardContext,
  applyCardUsage,
  cancelPendingSelection
};
