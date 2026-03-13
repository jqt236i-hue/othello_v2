(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../shared/deck-spec'));
    } else {
        root.DeckBuilderStateModule = factory(root.DeckSpecHelpers);
    }
}(typeof self !== 'undefined' ? self : this, function (DeckSpecHelpers) {
    'use strict';

    function ensureDeckSpecHelpers() {
        if (!DeckSpecHelpers || typeof DeckSpecHelpers.getEnabledCardDefs !== 'function') {
            throw new Error('DeckSpecHelpers is required');
        }
        return DeckSpecHelpers;
    }

    function createEmptyDraft() {
        return {
            countsById: {},
            totalCount: 0
        };
    }

    function getEnabledOrder() {
        return ensureDeckSpecHelpers().getEnabledCardDefs();
    }

    function normalizeDraft(draft) {
        const source = (draft && typeof draft === 'object') ? draft : {};
        const countsById = {};
        let totalCount = 0;
        const enabledIds = new Set(getEnabledOrder().map((cardDef) => cardDef.id));
        const rawCounts = (source.countsById && typeof source.countsById === 'object') ? source.countsById : {};

        Object.keys(rawCounts).forEach((cardId) => {
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

    function cloneDraft(draft) {
        return normalizeDraft(draft);
    }

    function createDraftFromDeckSpec(deckSpec) {
        const normalizedSpec = ensureDeckSpecHelpers().normalizeDeckSpec(deckSpec);
        const countsById = {};
        let totalCount = 0;

        normalizedSpec.cards.forEach((entry) => {
            countsById[entry.cardId] = entry.count;
            totalCount += entry.count;
        });

        return {
            countsById,
            totalCount
        };
    }

    function getSelectedCount(draft, cardId) {
        const normalized = normalizeDraft(draft);
        return Number(normalized.countsById[String(cardId || '').trim()] || 0);
    }

    function canAddCardToDraft(draft, cardId) {
        const normalized = normalizeDraft(draft);
        const nextCardId = String(cardId || '').trim();
        if (!nextCardId) return false;
        if (normalized.totalCount >= ensureDeckSpecHelpers().CUSTOM_DECK_SIZE) return false;
        return getSelectedCount(normalized, nextCardId) < ensureDeckSpecHelpers().MAX_DUPLICATES_PER_CARD;
    }

    function addCardToDraft(draft, cardId) {
        const normalized = normalizeDraft(draft);
        const nextCardId = String(cardId || '').trim();
        if (!canAddCardToDraft(normalized, nextCardId)) {
            return normalized;
        }
        normalized.countsById[nextCardId] = getSelectedCount(normalized, nextCardId) + 1;
        normalized.totalCount += 1;
        return normalized;
    }

    function removeCardFromDraft(draft, cardId) {
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

    function clearCardFromDraft(draft, cardId) {
        const normalized = normalizeDraft(draft);
        const nextCardId = String(cardId || '').trim();
        const current = getSelectedCount(normalized, nextCardId);
        if (!current) return normalized;
        delete normalized.countsById[nextCardId];
        normalized.totalCount = Math.max(0, normalized.totalCount - current);
        return normalized;
    }

    function advanceCardSelection(draft, cardId) {
        const normalized = normalizeDraft(draft);
        const nextCardId = String(cardId || '').trim();
        const current = getSelectedCount(normalized, nextCardId);
        if (current >= ensureDeckSpecHelpers().MAX_DUPLICATES_PER_CARD) {
            return clearCardFromDraft(normalized, nextCardId);
        }
        return addCardToDraft(normalized, nextCardId);
    }

    function createExpandedCardIdsFromDraft(draft) {
        const normalized = normalizeDraft(draft);
        const expanded = [];
        getEnabledOrder().forEach((cardDef) => {
            const count = Number(normalized.countsById[cardDef.id] || 0);
            for (let index = 0; index < count; index += 1) {
                expanded.push(cardDef.id);
            }
        });
        return expanded;
    }

    function createDeckSpecFromDraft(draft) {
        return ensureDeckSpecHelpers().createDeckSpecFromCardIds(createExpandedCardIdsFromDraft(draft));
    }

    function getDraftSummary(draft) {
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

    function listSelectedCards(draft) {
        const normalized = normalizeDraft(draft);
        return getEnabledOrder()
            .filter((cardDef) => Number(normalized.countsById[cardDef.id] || 0) > 0)
            .map((cardDef) => ({
                cardId: cardDef.id,
                count: Number(normalized.countsById[cardDef.id] || 0),
                cardDef
            }));
    }

    return {
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
}));