'use strict';

declare const __non_webpack_require__: NodeRequire | undefined;

const _require: NodeRequire = (typeof __non_webpack_require__ !== 'undefined')
  ? __non_webpack_require__
  : require;

const DeckSpecHelpers = _require('../shared/deck-spec');

function ensureDeckSpecHelpers(): any {
  if (!DeckSpecHelpers || typeof DeckSpecHelpers.getEnabledCardDefs !== 'function') {
    throw new Error('DeckSpecHelpers is required');
  }
  return DeckSpecHelpers;
}

interface Draft {
  countsById: Record<string, number>;
  totalCount: number;
}

function createEmptyDraft(): Draft {
  return {
    countsById: {},
    totalCount: 0
  };
}

function getEnabledOrder(): any[] {
  return ensureDeckSpecHelpers().getEnabledCardDefs();
}

function normalizeDraft(draft?: any): Draft {
  const source = (draft && typeof draft === 'object') ? draft : {};
  const countsById: Record<string, number> = {};
  let totalCount = 0;
  const enabledIds = new Set(getEnabledOrder().map((cardDef: any) => cardDef.id));
  const rawCounts = (source.countsById && typeof source.countsById === 'object') ? source.countsById : {};

  Object.keys(rawCounts).forEach((cardId: string) => {
    if (!enabledIds.has(cardId)) return;
    const count = Math.max(0, Math.min(ensureDeckSpecHelpers().MAX_DUPLICATES_PER_CARD, Math.trunc(Number(rawCounts[cardId]) || 0)));
    if (!count) return;
    countsById[cardId] = count;
    totalCount += count;
  });

  return {
    countsById,
    totalCount: Math.min(totalCount, ensureDeckSpecHelpers().CUSTOM_DECK_SIZE)
  };
}

function cloneDraft(draft?: any): Draft {
  return normalizeDraft(draft);
}

function createDraftFromDeckSpec(deckSpec: any): Draft {
  const normalizedSpec = ensureDeckSpecHelpers().normalizeDeckSpec(deckSpec);
  const countsById: Record<string, number> = {};
  let totalCount = 0;

  normalizedSpec.cards.forEach((entry: any) => {
    countsById[entry.cardId] = entry.count;
    totalCount += entry.count;
  });

  return {
    countsById,
    totalCount
  };
}

function getSelectedCount(draft: any, cardId: string): number {
  const normalized = normalizeDraft(draft);
  return Number(normalized.countsById[String(cardId || '').trim()] || 0);
}

function canAddCardToDraft(draft: any, cardId: string): boolean {
  const normalized = normalizeDraft(draft);
  const nextCardId = String(cardId || '').trim();
  if (!nextCardId) return false;
  if (normalized.totalCount >= ensureDeckSpecHelpers().CUSTOM_DECK_SIZE) return false;
  return getSelectedCount(normalized, nextCardId) < ensureDeckSpecHelpers().MAX_DUPLICATES_PER_CARD;
}

function addCardToDraft(draft: any, cardId: string): Draft {
  const normalized = normalizeDraft(draft);
  const nextCardId = String(cardId || '').trim();
  if (!canAddCardToDraft(normalized, nextCardId)) {
    return normalized;
  }
  normalized.countsById[nextCardId] = getSelectedCount(normalized, nextCardId) + 1;
  normalized.totalCount += 1;
  return normalized;
}

function removeCardFromDraft(draft: any, cardId: string): Draft {
  const normalized = normalizeDraft(draft);
  const nextCardId = String(cardId || '').trim();
  const current = getSelectedCount(normalized, nextCardId);
  if (!current) return normalized;
  if (current <= 1) {
    delete normalized.countsById[nextCardId];
  } else {
    normalized.countsById[nextCardId] = current - 1;
  }
  normalized.totalCount = Math.max(0, normalized.totalCount - 1);
  return normalized;
}

function clearCardFromDraft(draft: any, cardId: string): Draft {
  const normalized = normalizeDraft(draft);
  const nextCardId = String(cardId || '').trim();
  const current = getSelectedCount(normalized, nextCardId);
  if (!current) return normalized;
  delete normalized.countsById[nextCardId];
  normalized.totalCount = Math.max(0, normalized.totalCount - current);
  return normalized;
}

function advanceCardSelection(draft: any, cardId: string): Draft {
  const normalized = normalizeDraft(draft);
  const nextCardId = String(cardId || '').trim();
  const current = getSelectedCount(normalized, nextCardId);
  if (current >= ensureDeckSpecHelpers().MAX_DUPLICATES_PER_CARD) {
    return clearCardFromDraft(normalized, nextCardId);
  }
  return addCardToDraft(normalized, nextCardId);
}

function createExpandedCardIdsFromDraft(draft: any): string[] {
  const normalized = normalizeDraft(draft);
  const expanded: string[] = [];
  getEnabledOrder().forEach((cardDef: any) => {
    const count = Number(normalized.countsById[cardDef.id] || 0);
    for (let index = 0; index < count; index += 1) {
      expanded.push(cardDef.id);
    }
  });
  return expanded;
}

function createDeckSpecFromDraft(draft: any): any {
  return ensureDeckSpecHelpers().createDeckSpecFromCardIds(createExpandedCardIdsFromDraft(draft));
}

function getDraftSummary(draft: any): any {
  const normalized = normalizeDraft(draft);
  const distinctCount = Object.keys(normalized.countsById).length;
  const remainingCount = Math.max(0, ensureDeckSpecHelpers().CUSTOM_DECK_SIZE - normalized.totalCount);
  return {
    totalCount: normalized.totalCount,
    remainingCount,
    distinctCount,
    canSave: normalized.totalCount === ensureDeckSpecHelpers().CUSTOM_DECK_SIZE
  };
}

function listSelectedCards(draft: any): any[] {
  const normalized = normalizeDraft(draft);
  return getEnabledOrder()
    .filter((cardDef: any) => Number(normalized.countsById[cardDef.id] || 0) > 0)
    .map((cardDef: any) => ({
      cardId: cardDef.id,
      count: Number(normalized.countsById[cardDef.id] || 0),
      cardDef
    }));
}

const DeckBuilderState = {
  createEmptyDraft,
  cloneDraft,
  createDraftFromDeckSpec,
  getSelectedCount,
  canAddCardToDraft,
  addCardToDraft,
  removeCardFromDraft,
  clearCardFromDraft,
  advanceCardSelection,
  createExpandedCardIdsFromDraft,
  createDeckSpecFromDraft,
  getDraftSummary,
  listSelectedCards
};

export = DeckBuilderState;
