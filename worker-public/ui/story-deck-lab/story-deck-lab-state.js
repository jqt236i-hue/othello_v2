(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = factory(require('../../shared/story-deck-spec'));
    } else {
        root.StoryDeckLabStateModule = factory(root.StoryDeckSpecHelpers);
    }
}(typeof self !== 'undefined' ? self : this, function (StoryDeckSpecHelpers) {
    'use strict';

    function ensureHelpers() {
        if (!StoryDeckSpecHelpers || typeof StoryDeckSpecHelpers.getEnabledCardDefs !== 'function') {
            throw new Error('StoryDeckSpecHelpers is required');
        }
        return StoryDeckSpecHelpers;
    }

    function createEmptyDraft(ruleSetId) {
        const helpers = ensureHelpers();
        const resolvedRuleSet = helpers.getRuleSet(ruleSetId) || helpers.getRuleSet(helpers.DEFAULT_RULE_SET_ID);
        return {
            ruleSetId: resolvedRuleSet.id,
            countsById: {},
            totalCount: 0
        };
    }

    function getEnabledOrder() {
        return ensureHelpers().getEnabledCardDefs();
    }

    function normalizeDraft(draft) {
        const helpers = ensureHelpers();
        const source = (draft && typeof draft === 'object') ? draft : {};
        const resolvedRuleSet = helpers.getRuleSet(source.ruleSetId) || helpers.getRuleSet(helpers.DEFAULT_RULE_SET_ID);
        const rawCounts = (source.countsById && typeof source.countsById === 'object') ? source.countsById : {};
        const enabledIds = new Set(getEnabledOrder().map((cardDef) => cardDef.id));
        const countsById = {};
        let totalCount = 0;

        Object.keys(rawCounts).forEach((cardId) => {
            if (!enabledIds.has(cardId)) return;
            let count = Math.max(0, Math.trunc(Number(rawCounts[cardId]) || 0));
            if (!count) return;
            if (Number.isInteger(resolvedRuleSet.duplicateLimit)) {
                count = Math.min(count, resolvedRuleSet.duplicateLimit);
            }
            const remaining = Math.max(0, resolvedRuleSet.deckSize - totalCount);
            if (!remaining) return;
            count = Math.min(count, remaining);
            if (!count) return;
            countsById[cardId] = count;
            totalCount += count;
        });

        return {
            ruleSetId: resolvedRuleSet.id,
            countsById,
            totalCount
        };
    }

    function cloneDraft(draft) {
        return normalizeDraft(draft);
    }

    function createDraftFromStoryDeckSpec(deckSpec) {
        const helpers = ensureHelpers();
        const normalizedSpec = helpers.normalizeStoryDeckSpec(deckSpec);
        const countsById = {};
        let totalCount = 0;

        normalizedSpec.cards.forEach((entry) => {
            countsById[entry.cardId] = entry.count;
            totalCount += entry.count;
        });

        return normalizeDraft({
            ruleSetId: normalizedSpec.ruleSetId,
            countsById,
            totalCount
        });
    }

    function setRuleSetId(draft, ruleSetId) {
        const normalized = normalizeDraft(draft);
        return normalizeDraft({
            ruleSetId,
            countsById: normalized.countsById
        });
    }

    function getSelectedCount(draft, cardId) {
        const normalized = normalizeDraft(draft);
        return Number(normalized.countsById[String(cardId || '').trim()] || 0);
    }

    function canAddCardToDraft(draft, cardId) {
        const helpers = ensureHelpers();
        const normalized = normalizeDraft(draft);
        const ruleSet = helpers.getRuleSet(normalized.ruleSetId);
        const nextCardId = String(cardId || '').trim();
        if (!nextCardId) return false;
        if (normalized.totalCount >= ruleSet.deckSize) return false;
        if (Number.isInteger(ruleSet.duplicateLimit)) {
            return getSelectedCount(normalized, nextCardId) < ruleSet.duplicateLimit;
        }
        return true;
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

    function clearDraft(draft) {
        const normalized = normalizeDraft(draft);
        return createEmptyDraft(normalized.ruleSetId);
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

    function createStoryDeckSpecFromDraft(draft) {
        const normalized = normalizeDraft(draft);
        return ensureHelpers().createStoryDeckSpecFromCardIds(
            createExpandedCardIdsFromDraft(normalized),
            { ruleSetId: normalized.ruleSetId }
        );
    }

    function getDraftSummary(draft) {
        const helpers = ensureHelpers();
        const normalized = normalizeDraft(draft);
        const ruleSet = helpers.getRuleSet(normalized.ruleSetId);
        const distinctCount = Object.keys(normalized.countsById).length;
        const remainingCount = Math.max(0, ruleSet.deckSize - normalized.totalCount);
        return {
            ruleSetId: normalized.ruleSetId,
            deckSize: ruleSet.deckSize,
            totalCount: normalized.totalCount,
            remainingCount,
            distinctCount,
            canExport: normalized.totalCount === ruleSet.deckSize,
            duplicateLimit: ruleSet.duplicateLimit
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
        normalizeDraft,
        cloneDraft,
        createDraftFromStoryDeckSpec,
        setRuleSetId,
        getSelectedCount,
        canAddCardToDraft,
        addCardToDraft,
        removeCardFromDraft,
        clearCardFromDraft,
        clearDraft,
        createExpandedCardIdsFromDraft,
        createStoryDeckSpecFromDraft,
        getDraftSummary,
        listSelectedCards
    };
}));
