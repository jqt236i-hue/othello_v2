type PlayerSlotOwnerKey = 'black' | 'white';

type PlayerSlotElementResolverDeps = {
  getDocumentRef?: () => Document | null;
  getOwnerHelpersModule?: () => any;
};

function normalizeOwnerKey(value: any, ownerHelpersModule?: any): PlayerSlotOwnerKey {
  if (ownerHelpersModule && typeof ownerHelpersModule.normalizePlayerKey === 'function') {
    return ownerHelpersModule.normalizePlayerKey(value, 'black') === 'white' ? 'white' : 'black';
  }
  if (value === 'white' || value === -1 || value === '-1') return 'white';
  return 'black';
}

function getElementById(documentRef: Document | null, id: string): HTMLElement | null {
  return documentRef && typeof documentRef.getElementById === 'function'
    ? documentRef.getElementById(id)
    : null;
}

function createPlayerSlotElementResolver(deps?: PlayerSlotElementResolverDeps) {
  const cfg = (deps && typeof deps === 'object') ? deps : {};
  const getDocumentRef = () => (typeof cfg.getDocumentRef === 'function'
    ? cfg.getDocumentRef()
    : (typeof document !== 'undefined' ? document : null));
  const getOwnerHelpers = () => (typeof cfg.getOwnerHelpersModule === 'function'
    ? cfg.getOwnerHelpersModule()
    : null);
  const normalize = (value: any): PlayerSlotOwnerKey => normalizeOwnerKey(value, getOwnerHelpers());

  function getHandElementsByOwner(playerKey: any): HTMLElement[] {
    const documentRef = getDocumentRef();
    if (!documentRef) return [];
    const ownerKey = normalize(playerKey);
    const handBlackEl = getElementById(documentRef, 'hand-black');
    const handWhiteEl = getElementById(documentRef, 'hand-white');
    const handElements = [handBlackEl, handWhiteEl].filter(Boolean) as HTMLElement[];
    const ownerHelpers = getOwnerHelpers();
    if (ownerHelpers && typeof ownerHelpers.filterOwnerMatchedElements === 'function') {
      const matched = ownerHelpers.filterOwnerMatchedElements(handElements, ownerKey);
      if (matched.length > 0) return matched;
    }
    const fallbackHandEl = getElementById(documentRef, ownerKey === 'white' ? 'hand-white' : 'hand-black');
    return fallbackHandEl ? [fallbackHandEl] : [];
  }

  function resolveHandElementByOwner(playerKey: any): HTMLElement | null {
    const handElements = getHandElementsByOwner(playerKey);
    return handElements.length > 0 ? handElements[0] : null;
  }

  function resolveDeckElementByOwner(playerKey: any): HTMLElement | null {
    const documentRef = getDocumentRef();
    if (!documentRef) return null;
    const ownerKey = normalize(playerKey);
    const deckBlackEl = getElementById(documentRef, 'deck-black');
    const deckWhiteEl = getElementById(documentRef, 'deck-white');
    const deckElements = [deckBlackEl, deckWhiteEl].filter(Boolean) as HTMLElement[];
    const ownerHelpers = getOwnerHelpers();

    if (ownerHelpers && typeof ownerHelpers.resolveOwnerMatchedElement === 'function') {
      const fallbackDeckEl = getElementById(documentRef, ownerKey === 'white' ? 'deck-white' : 'deck-black');
      return ownerHelpers.resolveOwnerMatchedElement(deckElements, ownerKey, fallbackDeckEl);
    }

    for (const deckEl of deckElements) {
      const slotOwnerKey = deckEl && deckEl.dataset && deckEl.dataset.ownerKey
        ? normalize(deckEl.dataset.ownerKey)
        : null;
      if (slotOwnerKey === ownerKey) return deckEl;
    }

    return getElementById(documentRef, ownerKey === 'white' ? 'deck-white' : 'deck-black');
  }

  function isOwnerOnBottomSlot(playerKey: any): boolean {
    const documentRef = getDocumentRef();
    const ownerKey = normalize(playerKey);
    if (!documentRef) return ownerKey === 'black';

    const bottomEl = getElementById(documentRef, 'hand-black');
    const topEl = getElementById(documentRef, 'hand-white');
    const ownerHelpers = getOwnerHelpers();
    if (ownerHelpers && typeof ownerHelpers.isOwnerOnBottomSlot === 'function') {
      return ownerHelpers.isOwnerOnBottomSlot(ownerKey, bottomEl, topEl, {
        defaultBottomOwnerKey: 'black',
        defaultTopOwnerKey: 'white'
      });
    }
    const bottomOwnerKey = (bottomEl && bottomEl.dataset && bottomEl.dataset.ownerKey)
      ? normalize(bottomEl.dataset.ownerKey)
      : 'black';
    const topOwnerKey = (topEl && topEl.dataset && topEl.dataset.ownerKey)
      ? normalize(topEl.dataset.ownerKey)
      : 'white';

    if (bottomOwnerKey === ownerKey) return true;
    if (topOwnerKey === ownerKey) return false;
    return ownerKey === 'black';
  }

  return {
    getHandElementsByOwner,
    isOwnerOnBottomSlot,
    normalizeOwnerKey: normalize,
    resolveDeckElementByOwner,
    resolveHandElementByOwner,
  };
}

export {
  createPlayerSlotElementResolver,
  normalizeOwnerKey,
};
