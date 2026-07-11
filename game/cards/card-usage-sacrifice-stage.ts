type CardUsageSacrificeStageOptions = {
  cardState: any;
  gameState: any;
  chargeOwnerKey: string;
  cardId: string;
  cardType: string;
  CardSacrificeWillModule: any;
  SpecialCardRegistry: any;
  BoardOpsModule: any;
  MARKER_KINDS: any;
  getCellValueForCard: any;
  getSpecialMarkers: any;
  EMPTY: any;
  writeCardPendingEffect: any;
  emitPresentationEvent: any;
  emitCardUsedAtEventIndexes: (extraMeta: any, presentationIndex: number, persistIndex: number) => void;
};

function applySacrificeCardUsageNullification(options: CardUsageSacrificeStageOptions): any {
  const sacrificeModule = options.CardSacrificeWillModule;
  if (
    !sacrificeModule ||
    typeof sacrificeModule.shouldSacrificeNullifyCard !== 'function' ||
    typeof sacrificeModule.findTriggeringSacrificeMarker !== 'function' ||
    typeof sacrificeModule.applySacrificeNullification !== 'function' ||
    !sacrificeModule.shouldSacrificeNullifyCard(options.cardId, options.cardType, {
      SpecialCardRegistry: options.SpecialCardRegistry
    })
  ) {
    return { nullified: false };
  }

  const sacrificeDeps = {
    BoardOpsModule: options.BoardOpsModule,
    SpecialCardRegistry: options.SpecialCardRegistry,
    MARKER_KINDS: options.MARKER_KINDS,
    getCellValueForCard: options.getCellValueForCard,
    getSpecialMarkers: options.getSpecialMarkers,
    EMPTY: options.EMPTY,
    gameState: options.gameState
  };
  const sacrifice = sacrificeModule.findTriggeringSacrificeMarker(
    options.cardState,
    options.chargeOwnerKey,
    sacrificeDeps
  );
  if (!sacrifice) return { nullified: false };

  const presentationStartIndex = Array.isArray(options.cardState.presentationEvents)
    ? options.cardState.presentationEvents.length
    : 0;
  const persistStartIndex = Array.isArray(options.cardState._presentationEventsPersist)
    ? options.cardState._presentationEventsPersist.length
    : 0;
  const nullificationRes = sacrificeModule.applySacrificeNullification(
    options.cardState,
    options.gameState,
    {
      cardId: options.cardId,
      cardType: options.cardType,
      cardUserKey: options.chargeOwnerKey,
      sacrifice
    },
    sacrificeDeps
  );
  if (!nullificationRes || nullificationRes.applied !== true) return { nullified: false };

  if (typeof options.writeCardPendingEffect === 'function') {
    options.writeCardPendingEffect(options.cardState, options.chargeOwnerKey, null, { clearSelectionAction: true });
  } else if (options.cardState.pendingEffectByPlayer) {
    options.cardState.pendingEffectByPlayer[options.chargeOwnerKey] = null;
  }
  options.emitCardUsedAtEventIndexes({
    nullifiedBySacrificeWill: true,
    cardUseVanishEffect: sacrificeModule.SACRIFICE_SEAL_BURN_EFFECT || 'sacrifice_seal_burn',
    sacrificeWill: {
      row: sacrifice.row,
      col: sacrifice.col,
      owner: sacrifice.owner,
      special: 'SACRIFICE'
    }
  }, presentationStartIndex, persistStartIndex);
  if (typeof options.emitPresentationEvent === 'function') {
    try {
      options.emitPresentationEvent(options.cardState, {
        type: 'SPECIAL_STONE_BUBBLE',
        special: 'SACRIFICE',
        scenario: 'card_nullified',
        player: sacrifice.owner,
        row: sacrifice.row,
        col: sacrifice.col,
        text: sacrificeModule.SACRIFICE_TRIGGER_TEXT || 'その一手は、ここで断つ。',
        reason: 'card_nullified',
        cause: 'SACRIFICE_WILL',
        meta: {
          owner: sacrifice.owner,
          special: 'SACRIFICE',
          scenario: 'card_nullified',
          reason: 'card_nullified',
          nullifiedCardId: options.cardId,
          nullifiedCardType: options.cardType,
          nullifiedCardUser: options.chargeOwnerKey
        }
      });
    } catch (e) { /* ignore presentation emission failures */ }
  }
  return { nullified: true, sacrifice, result: nullificationRes };
}

export = {
  applySacrificeCardUsageNullification
};
