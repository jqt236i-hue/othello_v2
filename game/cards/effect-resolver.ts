/**
 * @file effect-resolver.ts
 * @description Card effect resolution and context builders (restored from worker-public mirror)
 */

declare const __non_webpack_require__: NodeRequire | undefined;

function _require(id: string): any {
  if (typeof __non_webpack_require__ !== 'undefined') {
    return __non_webpack_require__(id);
  }
  if (typeof require === 'function') {
    return require(id);
  }
  throw new Error('Unable to require ' + id);
}

function safeRequire(id: string): any {
  try {
    return _require(id);
  } catch (e) {
    return null;
  }
}

const CardModuleResolver = safeRequire('../logic/cards-internal/module-resolver');

function loadRuntimeModule(id: string, globalKey: string, fallbackValue: any = null): any {
  if (CardModuleResolver && typeof CardModuleResolver.resolveModule === 'function') {
    const resolved = CardModuleResolver.resolveModule({
      globalName: globalKey,
      requirePath: id,
      requireFn: _require,
      label: globalKey
    });
    return resolved || fallbackValue;
  }

  return safeRequire(id) || fallbackValue;
}

const SharedConstants = loadRuntimeModule('../../shared-constants', 'SharedConstants', {});
const CardHandManagerModule = loadRuntimeModule('../logic/cards-internal/hand-manager', 'CardHandManager');
const CardChargeLedgerModule = loadRuntimeModule('../logic/cards-internal/charge-ledger', 'CardChargeLedger');
const CardStateManagerModule = loadRuntimeModule('./state-manager', 'CardStateManager');
const CardPendingStateManagerModule = loadRuntimeModule('../logic/cards-internal/pending-state-manager', 'CardPendingStateManager');
const CardUsagePrechecksModule = loadRuntimeModule('../logic/cards-internal/card-usage-prechecks', 'CardUsagePrechecks');

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
    canUseTimeStopGodForPlayer,
    countOpponentOccupiedCornersForPlayer,
    getTemptWillTargets,
    getCaptureWillTargets,
    getStrongWindTargets,
    getSuperBuoyancyTargets,
    getSuperGravityTargets,
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
    getReinforcementWillTargets,
    getOccupiedBoardShapeCellsForCard,
    getBoardExpansionTargets,
    getBoardExpansionGodTargets,
    getBoardShrinkTargets,
    getBoardShrinkGodTargets,
    getBlockadeTargets,
    getMeteorTargets,
    getFreezeTargets,
    CardDefsModule,
    CardCostsModule,
    CardSelectorsModule
  } = deps || {};

  return {
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
      canUseTimeStopGodForPlayer,
      countOpponentOccupiedCornersForPlayer,
      getTemptWillTargets,
      getCaptureWillTargets,
      getStrongWindTargets,
      getSuperBuoyancyTargets,
      getSuperGravityTargets,
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
      getReinforcementWillTargets,
      getOccupiedBoardShapeCellsForCard,
      getBoardExpansionTargets,
      getBoardExpansionGodTargets,
      getBoardShrinkTargets,
      getBoardShrinkGodTargets,
      getBlockadeTargets,
      getMeteorTargets,
      getFreezeTargets
    },
    modules: {
      CardDefsModule,
      CardCostsModule,
      CardSelectorsModule
    }
  };
}

function getCardEffectTimingContext(deps: any) {
  const {
    defaultPrng,
    _ensureHandDestroyFlags,
    processRiboWillTurnStartEffects,
    commitDraw,
    getSpecialMarkers,
    getCardContext,
    removeMarkersAt,
    isFrozenCellForCard,
    emitPresentationEvent,
    addChargeValue,
    addChargeWithTotal,
    addMarker,
    applyStrongWill,
    applyAbsoluteProtect,
    applyRegenWill,
    workDebugLog,
    workDebugError,
    hasBoardShapeCellForCard,
    getCellValueForCard,
    setCellValueForCard,
    clearStoneIdAtForCard,
    CardWorkModule,
    CardLivingWillModule,
    BoardOpsModule,
    ULTIMATE_DRAGON_TURNS,
    ULTIMATE_DESTROY_GOD_TURNS,
    ULTIMATE_HYPERACTIVE_TURNS,
    EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
    EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
    AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
    AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
    SNIPER_WILL_TURNS,
    DESTROY_DRAGON_TURNS,
    LIGHTNING_WILL_TURNS,
    OBSERVER_WILL_TURNS,
    GHOST_WILL_TURNS,
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
      EXTREME_HYPERACTIVE_FLIP_EVADE_LIMIT,
      EXTREME_HYPERACTIVE_DESTROY_EVADE_LIMIT,
      AFTERIMAGE_WILL_FLIP_EVADE_LIMIT,
      AFTERIMAGE_WILL_DESTROY_EVADE_LIMIT,
      SNIPER_WILL_TURNS,
      DESTROY_DRAGON_TURNS,
      LIGHTNING_WILL_TURNS,
      OBSERVER_WILL_TURNS,
      GHOST_WILL_TURNS,
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
      commitDraw,
      getSpecialMarkers,
      getCardContext,
      removeMarkersAt,
      isFrozenCellForCard,
      emitPresentationEvent,
      addChargeValue,
      addChargeWithTotal,
      addMarker,
      applyStrongWill,
      applyAbsoluteProtect,
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
      PlunderWillModule: {
        applyPlunderWill(cardState: any, playerKey: string, flipCount: any) {
          const opponentKey = playerKey === 'black' ? 'white' : 'black';
          const opponentCharge = (cardState && cardState.charge && Number.isFinite(Number(cardState.charge[opponentKey])))
            ? Number(cardState.charge[opponentKey])
            : 0;
          const normalizedFlipCount = Number.isFinite(Number(flipCount))
            ? Math.max(0, Math.trunc(Number(flipCount)))
            : 0;
          const stolen = Math.min(normalizedFlipCount, Math.max(0, opponentCharge));
          if (stolen > 0 && typeof addChargeValue === 'function') {
            addChargeValue(cardState, opponentKey, -stolen, 'plunder_loss');
          }
          return { plundered: stolen };
        }
      },
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
  const { getSpecialMarkers, getBombMarkers, getBlockingMarkers, isFrozenCellForCard } = deps || {};

  const specials = typeof getSpecialMarkers === 'function'
    ? getSpecialMarkers(cardState)
    : (cardState && Array.isArray(cardState.markers) ? cardState.markers.filter((m: any) => m && m.kind === 'specialStone') : []);

  const protectedStones = specials
    .filter((s: any) => s.data && s.data.type === 'PROTECTED')
    .map((s: any) => ({ row: s.row, col: s.col, owner: s.owner }));

  const absoluteProtectedStones = specials
    .filter((s: any) => s.data && s.data.type === 'ABSOLUTE_PROTECTED')
    .map((s: any) => ({
      row: s.row,
      col: s.col,
      owner: s.owner === 'black' ? (BLACK || 1) : (WHITE || -1)
    }));

  const permaProtectedStones = specials
    .filter((s: any) => {
      if (!s.data) return false;
      if (
        s.data.type === 'ABSOLUTE_PROTECTED' ||
        s.data.type === 'PERMA_PROTECTED' ||
        s.data.type === 'DRAGON' ||
        s.data.type === 'BREEDING' ||
        s.data.type === 'DESTROY_DRAGON' ||
        s.data.type === 'LIGHTNING' ||
        s.data.type === 'GLUTTONOUS' ||
        s.data.type === 'ULTIMATE_DESTROY_GOD' ||
        s.data.type === 'GUARD' ||
        s.data.type === 'STONE_SALVATION_GOD' ||
        s.data.type === 'FREEZE'
      ) {
        return true;
      }
      if (typeof isFrozenCellForCard === 'function' && isFrozenCellForCard(cardState, s.row, s.col)) return true;
      return false;
    })
    .map((s: any) => ({
      row: s.row,
      col: s.col,
      owner: s.owner === 'black' ? BLACK : WHITE
    }));

  const bombs = typeof getBombMarkers === 'function'
    ? getBombMarkers(cardState).map((b: any) => ({
      row: b.row,
      col: b.col,
      remainingTurns: b.data ? b.data.remainingTurns : undefined,
      owner: b.owner,
      placedTurn: b.data ? b.data.placedTurn : undefined,
      createdSeq: b.createdSeq
    }))
    : [];

  const blockedCells = typeof getBlockingMarkers === 'function'
    ? getBlockingMarkers(cardState).map((m: any) => ({
      row: m.row,
      col: m.col,
      type: m.data ? m.data.type : null,
      remainingOwnerTurns: m.data ? m.data.remainingOwnerTurns : undefined,
      owner: m.owner
    }))
    : [];

  return {
    protectedStones,
    absoluteProtectedStones,
    permaProtectedStones,
    bombs,
    blockedCells
  };
}

/**
 * Apply card usage (Remove from hand, consume charge, set pending effect)
 */
function applyCardUsage(cardState: any, playerKey: string, cardId: string, deps: any) {
  const {
    gameState,
    handOwnerKey,
    opts,
    getCardCost: getCardCostFn,
    getCardType: getCardTypeFn,
    buildHeavenBlessingSeedHint,
    buildHeavenBlessingOffers,
    buildCondemnOffers,
    hasStandardLegalMoveForPlayer,
    canUseLastResortForPlayer,
    canUseEqualityWillForPlayer,
    canUseReinforcementWillForPlayer,
    canUseTimeStopGodForPlayer,
    countOpponentOccupiedCornersForPlayer,
    getTemptWillTargets,
    getCaptureWillTargets,
    getStrongWindTargets,
    getSuperBuoyancyTargets,
    getSuperGravityTargets,
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
    getPositionSwapTargets,
    getBoardExpansionTargets,
    getBoardExpansionGodTargets,
    getBoardShrinkTargets,
    getBoardShrinkGodTargets,
    getBlockadeTargets,
    getMeteorTargets,
    getFreezeTargets,
    getSeedTargets,
    getTimeStopGodDestroyableCount,
    getLossWillRemovableCount,
    getSalvationWillTargetCount,
    getExecutionWillTargetCount,
    getReinforcementWillTargetCount,
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
    getCardDisplayName: getCardDisplayNameFn,
    CardPendingStateManagerModule: CardPendingStateManagerModuleLocal,
    CardUsagePrechecksModule: CardUsagePrechecksModuleLocal,
    TIME_STOP_GOD_SELF_DESTROY_COUNT: timeStopSelfDestroyCount,
    RIBO_WILL_UNLOCK_TURN_INDEX: riboUnlockTurnIndex
  } = deps || {};

  const _opts = opts || {};
  const _gameState = gameState || null;
  const chargeOwnerKey = playerKey;
  const handKey = (typeof handOwnerKey === 'string' && handOwnerKey) ? handOwnerKey : playerKey;

  if (!cardState || !cardState.hands || !Array.isArray(cardState.hands[handKey])) return false;

  const idx = cardState.hands[handKey].indexOf(cardId);
  if (idx === -1) return false;

  const costFn = typeof getCardCostFn === 'function' ? getCardCostFn : getCardCost;
  const cost = costFn(cardId);

  if (!(_opts.ignoreCost === true)) {
    if (!cardState.charge || cardState.charge[chargeOwnerKey] < cost) return false;
  }

  const typeFn = typeof getCardTypeFn === 'function' ? getCardTypeFn : getCardType;
  const cardType = typeFn(cardId);

  const heavenSeedHint = typeof buildHeavenBlessingSeedHint === 'function'
    ? buildHeavenBlessingSeedHint(cardState, chargeOwnerKey)
    : '';

  const precheckModule = CardUsagePrechecksModuleLocal || CardUsagePrechecksModule;
  const usagePrecheck = precheckModule && typeof precheckModule.validateCardUsagePreconditions === 'function'
    ? precheckModule.validateCardUsagePreconditions({
      cardType,
      cardId,
      cardState,
      gameState: _gameState,
      playerKey: chargeOwnerKey,
      handKey,
      turnIndex: cardState.turnIndex,
      riboUnlockTurnIndex: riboUnlockTurnIndex || RIBO_WILL_UNLOCK_TURN_INDEX,
      prng: _opts.prng,
      heavenSeedHint,
      hasStandardLegalMoveForPlayer,
      canUseLastResortForPlayer,
      canUseEqualityWillForPlayer,
      canUseReinforcementWillForPlayer,
      canUseTimeStopGodForPlayer,
      countOpponentOccupiedCornersForPlayer,
      buildHeavenBlessingOffers,
      buildCondemnOffers,
      getTemptWillTargets,
      getCaptureWillTargets,
      getStrongWindTargets,
      getSuperBuoyancyTargets,
      getSuperGravityTargets,
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
      getPositionSwapTargets,
      getBoardExpansionTargets,
      getBoardExpansionGodTargets,
      getBoardShrinkTargets,
      getBoardShrinkGodTargets,
      getBlockadeTargets,
      getMeteorTargets,
      getFreezeTargets,
      getSeedTargets,
      getTimeStopGodDestroyableCount,
      timeStopGodSelfDestroyCount: timeStopSelfDestroyCount || TIME_STOP_GOD_SELF_DESTROY_COUNT,
      getLossWillRemovableCount,
      getSalvationWillTargetCount,
      getExecutionWillTargetCount,
      getReinforcementWillTargetCount
    })
    : null;

  if (!usagePrecheck || usagePrecheck.ok !== true) return false;
  const heavenOffers = Array.isArray(usagePrecheck.heavenOffers) ? usagePrecheck.heavenOffers : null;
  const condemnOffers = Array.isArray(usagePrecheck.condemnOffers) ? usagePrecheck.condemnOffers : null;

  let removedCard = null;
  if (!(_opts.noConsume === true)) {
    if (typeof removeHandCardAt !== 'function') return false;
    removedCard = removeHandCardAt(cardState, handKey, idx);
    if (!removedCard || removedCard.cardId !== cardId) return false;
    if (typeof addCardToDiscard === 'function') {
      addCardToDiscard(cardState, removedCard.cardId, removedCard.cardCopyId);
    }
    if (typeof addChargeValue === 'function') {
      addChargeValue(cardState, chargeOwnerKey, -cost, 'card_use_cost');
    }
    cardState.hasUsedCardThisTurnByPlayer[chargeOwnerKey] = true;
    cardState.cardUseCountByPlayer = cardState.cardUseCountByPlayer || { black: 0, white: 0 };
    cardState.cardUseCountByPlayer[chargeOwnerKey] = (cardState.cardUseCountByPlayer[chargeOwnerKey] || 0) + 1;
  }
  cardState.lastUsedCardByPlayer[chargeOwnerKey] = cardId;

  const pendingOffers = heavenOffers || condemnOffers || undefined;
  const needsSelection = !!(
    CardPendingStateManagerModule
    && typeof CardPendingStateManagerModule.requiresTargetSelection === 'function'
    && CardPendingStateManagerModule.requiresTargetSelection(cardType)
  );

  const pendingEffectState = CardPendingStateManagerModule && typeof CardPendingStateManagerModule.createPendingEffectState === 'function'
    ? CardPendingStateManagerModule.createPendingEffectState({
      cardType,
      cardId,
      sourceHandIndex: removedCard ? removedCard.handIndex : undefined,
      needsSelection,
      offers: pendingOffers
    })
    : {
      type: cardType,
      cardId,
      sourceHandIndex: removedCard ? removedCard.handIndex : undefined,
      stage: needsSelection ? 'selectTarget' : null,
      offers: pendingOffers,
      selectedCount: (cardType === 'BOARD_EXPANSION_GOD' || cardType === 'BOARD_SHRINK_WILL') ? 0 : undefined,
      maxSelections: cardType === 'BOARD_EXPANSION_GOD'
        ? 2
        : (cardType === 'BOARD_SHRINK_WILL' ? (typeof getBoardShrinkSelectionCount === 'function' ? getBoardShrinkSelectionCount() : 3) : undefined),
      selectedTargets: (cardType === 'BOARD_EXPANSION_GOD' || cardType === 'BOARD_SHRINK_WILL') ? [] : undefined,
      placementsRemaining: cardType === 'LAST_RESORT' ? 3 : undefined
    };

  if (typeof writeCardPendingEffect === 'function') {
    writeCardPendingEffect(cardState, chargeOwnerKey, pendingEffectState);
  }

  if (cardType === 'BOARD_EXPANSION_GOD' && typeof readCardPendingEffect === 'function') {
    const boardExpansionGodPending = readCardPendingEffect(cardState, chargeOwnerKey);
    if (boardExpansionGodPending && typeof getBoardExpansionGodRequiredSelectionCount === 'function') {
      const requiredSelections = getBoardExpansionGodRequiredSelectionCount(cardState, _gameState, chargeOwnerKey);
      boardExpansionGodPending.selectedCount = 0;
      boardExpansionGodPending.maxSelections = requiredSelections > 0 ? requiredSelections : 1;
      boardExpansionGodPending.selectedTargets = Array.isArray(boardExpansionGodPending.selectedTargets)
        ? boardExpansionGodPending.selectedTargets
        : [];
    }
  }

  if (cardType === 'BOARD_SHRINK_WILL' && typeof readCardPendingEffect === 'function') {
    const boardShrinkPending = readCardPendingEffect(cardState, chargeOwnerKey);
    if (boardShrinkPending) {
      boardShrinkPending.selectedCount = 0;
      boardShrinkPending.maxSelections = typeof getBoardShrinkSelectionCount === 'function' ? getBoardShrinkSelectionCount() : 3;
      boardShrinkPending.selectedTargets = Array.isArray(boardShrinkPending.selectedTargets)
        ? boardShrinkPending.selectedTargets
        : [];
    }
  }

  if (cardType === 'WORK_WILL') {
    if (!cardState.workNextPlacementArmedByPlayer) cardState.workNextPlacementArmedByPlayer = { black: false, white: false };
    cardState.workNextPlacementArmedByPlayer[chargeOwnerKey] = true;
    if (typeof workDebugLog === 'function') {
      workDebugLog(cardState, '[WORK_DEBUG] Card played: WORK_WILL armed for', chargeOwnerKey);
    }
  }

  const defFn = typeof getCardDefFn === 'function' ? getCardDefFn : getCardDef;
  const usedCardDef = defFn(cardId);

  if (typeof emitPresentationEvent === 'function') {
    try {
      emitPresentationEvent(cardState, {
        type: 'CARD_USED',
        player: chargeOwnerKey,
        cardId: cardId,
        meta: {
          owner: handKey,
          cost: Number.isFinite(cost) ? cost : null,
          name: (usedCardDef && usedCardDef.name) ? usedCardDef.name : null,
          cardType: (usedCardDef && usedCardDef.type) ? usedCardDef.type : null
        }
      });
    } catch (e) { /* ignore presentation emission failures */ }
  }

  if (typeof addGeneratedThrowChainCard === 'function') {
    addGeneratedThrowChainCard(cardState, handKey, cardId, cardType);
  }
  if (typeof addGeneratedChainWillCard === 'function') {
    addGeneratedChainWillCard(cardState, handKey, cardId, cardType);
  }

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
