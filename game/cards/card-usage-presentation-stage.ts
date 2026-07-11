function isBoardExecutorHolePresentationEvent(event: any): boolean {
  if (!event || typeof event !== 'object') return false;
  const eventType = String(event.type || '').trim().toUpperCase();
  const cause = String(event.cause || '').trim().toUpperCase();
  const reason = String(event.reason || '').trim().toLowerCase();
  const meta = event.meta && typeof event.meta === 'object' ? event.meta : {};
  const metaCause = String((meta as any).cellRemovalCause || (meta as any).removalCause || '').trim().toUpperCase();
  const metaReason = String((meta as any).cellRemovalReason || (meta as any).removalReason || '').trim().toLowerCase();
  const removalPolicy = String((meta as any).removalPolicy || '').trim().toLowerCase();
  const removalKind = String((meta as any).removalKind || '').trim().toLowerCase();
  if (eventType !== 'DESTROY' && eventType !== 'STATUS_APPLIED') return false;
  return cause === 'BOARD_EXECUTOR'
    || metaCause === 'BOARD_EXECUTOR'
    || reason === 'board_executor_special_stone_hole'
    || metaReason === 'board_executor_special_stone_hole'
    || removalPolicy === 'board_executor'
    || removalKind === 'board_executor_hole';
}

function moveLastCardUsedBeforeBoardExecutorHoleEvents(events: any): void {
  if (!Array.isArray(events) || events.length <= 1) return;
  const firstHoleIndex = events.findIndex(isBoardExecutorHolePresentationEvent);
  if (firstHoleIndex < 0) return;
  let cardUsedIndex = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index] && events[index].type === 'CARD_USED') {
      cardUsedIndex = index;
      break;
    }
  }
  if (cardUsedIndex < 0 || cardUsedIndex < firstHoleIndex) return;
  const [cardUsedEvent] = events.splice(cardUsedIndex, 1);
  events.splice(firstHoleIndex, 0, cardUsedEvent);
}

function moveLastCardUsedToIndex(events: any, targetIndex: any): void {
  if (!Array.isArray(events) || events.length <= 1) return;
  const insertIndex = Number.isFinite(Number(targetIndex))
    ? Math.max(0, Math.min(events.length, Math.trunc(Number(targetIndex))))
    : 0;
  let cardUsedIndex = -1;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index] && events[index].type === 'CARD_USED') {
      cardUsedIndex = index;
      break;
    }
  }
  if (cardUsedIndex < 0 || cardUsedIndex <= insertIndex) return;
  const [cardUsedEvent] = events.splice(cardUsedIndex, 1);
  events.splice(insertIndex, 0, cardUsedEvent);
}

function createCardUsedPresentationEmitter(options: any): (extraMeta?: any) => void {
  let didEmitCardUsedPresentation = false;
  return (extraMeta?: any) => {
    if (didEmitCardUsedPresentation || typeof options.emitPresentationEvent !== 'function') return;
    didEmitCardUsedPresentation = true;
    const baseMeta: any = {
      owner: options.handKey,
      cost: Number.isFinite(options.cost) ? options.cost : null,
      name: (options.usedCardDef && options.usedCardDef.name) ? options.usedCardDef.name : null,
      cardType: (options.usedCardDef && options.usedCardDef.type) ? options.usedCardDef.type : null
    };
    try {
      options.emitPresentationEvent(options.cardState, {
        type: 'CARD_USED',
        player: options.chargeOwnerKey,
        cardId: options.cardId,
        meta: Object.assign(baseMeta, (extraMeta && typeof extraMeta === 'object') ? extraMeta : {})
      });
    } catch (e) { /* ignore presentation emission failures */ }
  };
}

function emitCardUsedAtEventIndexes(cardState: any, emitCardUsed: () => void, presentationIndex: any, persistIndex: any): void {
  if (typeof emitCardUsed !== 'function') return;
  emitCardUsed();
  moveLastCardUsedToIndex(cardState && cardState.presentationEvents, presentationIndex);
  moveLastCardUsedToIndex(cardState && cardState._presentationEventsPersist, persistIndex);
}

function finalizeCardUsagePresentation(options: any): void {
  const emitCardUsed = options.emitCardUsedPresentationOnce;
  if (options.cardType === 'BOARD_EXECUTOR') {
    if (typeof emitCardUsed === 'function') emitCardUsed();
    moveLastCardUsedBeforeBoardExecutorHoleEvents(options.cardState && options.cardState.presentationEvents);
    moveLastCardUsedBeforeBoardExecutorHoleEvents(options.cardState && options.cardState._presentationEventsPersist);
  } else if (typeof emitCardUsed === 'function') {
    emitCardUsed();
  }

  if (typeof options.addGeneratedThrowChainCard === 'function') {
    options.addGeneratedThrowChainCard(options.cardState, options.handKey, options.cardId, options.cardType);
  }
  if (typeof options.addGeneratedChainWillCard === 'function') {
    options.addGeneratedChainWillCard(options.cardState, options.handKey, options.cardId, options.cardType);
  }
}

export = {
  createCardUsedPresentationEmitter,
  emitCardUsedAtEventIndexes,
  finalizeCardUsagePresentation
};
