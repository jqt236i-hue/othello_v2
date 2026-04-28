"use strict";
(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let cardCatalog = null;
        try {
            cardCatalog = require('../cards/catalog.json');
        }
        catch (e) { /* ignore */ }
        module.exports = factory(require('../shared-constants'), cardCatalog);
    }
    else {
        root.StoryDeckSpecHelpers = factory(root.SharedConstants, root.CardCatalog || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardCatalog) {
    'use strict';
    const STORY_DECK_SPEC_VERSION = 1;
    const RULE_SETS = Object.freeze({
        FREE_30: Object.freeze({
            id: 'free30',
            label: '自由30',
            deckSize: 30,
            duplicateLimit: null,
            description: '30枚固定 / 同一カード上限なし'
        }),
        UNIQUE_30: Object.freeze({
            id: 'unique30',
            label: 'ユニーク30',
            deckSize: 30,
            duplicateLimit: 1,
            description: '30枚固定 / 同一カード1枚まで'
        })
    });
    const DEFAULT_RULE_SET_ID = RULE_SETS.FREE_30.id;
    function createStoryDeckError(code, message, details) {
        const error = new Error(String(message || code || 'STORY_DECK_ERROR'));
        error.code = String(code || 'STORY_DECK_ERROR');
        if (typeof details !== 'undefined') {
            error.details = details;
        }
        return error;
    }
    function getCatalogCardMap() {
        const map = new Map();
        const catalogCards = Array.isArray(CardCatalog && CardCatalog.cards) ? CardCatalog.cards : [];
        catalogCards.forEach((cardDef) => {
            const def = cardDef;
            if (!def || !def.id)
                return;
            map.set(String(def.id).trim(), def);
        });
        return map;
    }
    function getRawCardDefs() {
        const baseDefs = Array.isArray(SharedConstants && SharedConstants.CARD_DEFS)
            ? SharedConstants.CARD_DEFS
            : [];
        const catalogCardMap = getCatalogCardMap();
        return baseDefs.map((cardDef) => {
            const def = cardDef;
            const cardId = String(def && def.id || '').trim();
            const catalogDef = cardId ? catalogCardMap.get(cardId) : null;
            return Object.assign({}, def, {
                name: def && def.name ? def.name : (catalogDef && (catalogDef.name || catalogDef.name_ja) ? (catalogDef.name || catalogDef.name_ja) : ''),
                name_ja: def && def.name_ja ? def.name_ja : (catalogDef && (catalogDef.name_ja || catalogDef.name) ? (catalogDef.name_ja || catalogDef.name) : ''),
                desc: def && def.desc ? def.desc : (catalogDef && (catalogDef.desc || catalogDef.desc_ja) ? (catalogDef.desc || catalogDef.desc_ja) : ''),
                desc_ja: def && def.desc_ja ? def.desc_ja : (catalogDef && (catalogDef.desc_ja || catalogDef.desc) ? (catalogDef.desc_ja || catalogDef.desc) : '')
            });
        });
    }
    function getCatalogVersion() {
        const explicit = Number(CardCatalog && CardCatalog.version);
        if (Number.isFinite(explicit) && explicit >= 1) {
            return Math.trunc(explicit);
        }
        return 1;
    }
    function buildCatalogCache() {
        const enabledDefs = [];
        const enabledById = new Map();
        const enabledByLowerId = new Map();
        getRawCardDefs().forEach((cardDef) => {
            if (!cardDef || !cardDef.id || cardDef.enabled === false)
                return;
            const cardId = String(cardDef.id).trim();
            if (!cardId || enabledById.has(cardId))
                return;
            const normalizedDef = Object.assign({}, cardDef, { id: cardId });
            enabledDefs.push(normalizedDef);
            enabledById.set(cardId, normalizedDef);
            enabledByLowerId.set(cardId.toLowerCase(), normalizedDef);
        });
        return {
            enabledDefs,
            enabledById,
            enabledByLowerId
        };
    }
    function getCatalogCache() {
        return buildCatalogCache();
    }
    function getEnabledCardDefs() {
        return getCatalogCache().enabledDefs.slice();
    }
    function normalizeCardId(value) {
        return String(value || '').trim();
    }
    function resolveEnabledCatalogCard(cardId) {
        const normalized = normalizeCardId(cardId);
        if (!normalized)
            return null;
        const cache = getCatalogCache();
        return cache.enabledById.get(normalized)
            || cache.enabledByLowerId.get(normalized.toLowerCase())
            || null;
    }
    function listRuleSets() {
        return Object.keys(RULE_SETS).map((key) => RULE_SETS[key]);
    }
    function getRuleSet(ruleSetId) {
        const normalized = String(ruleSetId || '').trim();
        if (!normalized)
            return RULE_SETS.FREE_30;
        return listRuleSets().find((ruleSet) => ruleSet.id === normalized) || null;
    }
    function ensureRuleSet(ruleSetId) {
        const ruleSet = getRuleSet(ruleSetId);
        if (!ruleSet) {
            throw createStoryDeckError('RULE_SET_UNKNOWN', `未対応のルールセットです: ${String(ruleSetId || '').trim() || '(empty)'}`);
        }
        return ruleSet;
    }
    function aggregateCardEntries(inputCards) {
        const countsByCardId = new Map();
        const list = Array.isArray(inputCards) ? inputCards : null;
        if (!list) {
            throw createStoryDeckError('STORY_DECK_INVALID', 'cards 配列が必要です');
        }
        list.forEach((entry, index) => {
            let rawCardId = '';
            let count = 1;
            if (typeof entry === 'string') {
                rawCardId = entry;
            }
            else if (entry && typeof entry === 'object') {
                const obj = entry;
                rawCardId = String(obj.cardId || obj.id || '');
                count = Object.prototype.hasOwnProperty.call(obj, 'count') ? Number(obj.count) : 1;
            }
            else {
                throw createStoryDeckError('STORY_DECK_ENTRY_INVALID', `cards[${index}] の形式が不正です`);
            }
            const cardDef = resolveEnabledCatalogCard(rawCardId);
            if (!cardDef) {
                throw createStoryDeckError('CARD_UNKNOWN', `未登録カードです: ${normalizeCardId(rawCardId) || '(empty)'}`);
            }
            if (!Number.isInteger(count) || count < 1) {
                throw createStoryDeckError('COUNT_INVALID', `カード枚数が不正です: ${cardDef.id}`);
            }
            const nextCount = (countsByCardId.get(cardDef.id) || 0) + count;
            countsByCardId.set(cardDef.id, nextCount);
        });
        return countsByCardId;
    }
    function sortDeckCards(cards) {
        const orderMap = new Map();
        getEnabledCardDefs().forEach((cardDef, index) => {
            orderMap.set(cardDef.id, index);
        });
        return cards.slice().sort((left, right) => {
            const leftOrder = orderMap.has(left.cardId) ? orderMap.get(left.cardId) : Number.MAX_SAFE_INTEGER;
            const rightOrder = orderMap.has(right.cardId) ? orderMap.get(right.cardId) : Number.MAX_SAFE_INTEGER;
            if (leftOrder !== rightOrder)
                return leftOrder - rightOrder;
            return String(left.cardId).localeCompare(String(right.cardId), 'en');
        });
    }
    function normalizeStoryDeckSpec(input, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const requireFullDeck = opts.requireFullDeck !== false;
        const raw = (input && typeof input === 'object' && !Array.isArray(input))
            ? input
            : { cards: Array.isArray(input) ? input : [] };
        const version = Object.prototype.hasOwnProperty.call(raw, 'version')
            ? Number(raw.version)
            : STORY_DECK_SPEC_VERSION;
        if (!Number.isInteger(version) || version !== STORY_DECK_SPEC_VERSION) {
            throw createStoryDeckError('STORY_DECK_VERSION_UNSUPPORTED', `未対応の story deck spec version です: ${raw.version}`);
        }
        const requestedCatalogVersion = Object.prototype.hasOwnProperty.call(raw, 'catalogVersion')
            ? Number(raw.catalogVersion)
            : getCatalogVersion();
        const currentCatalogVersion = getCatalogVersion();
        if (!Number.isInteger(requestedCatalogVersion) || requestedCatalogVersion !== currentCatalogVersion) {
            throw createStoryDeckError('CATALOG_VERSION_MISMATCH', `catalogVersion が一致しません: expected=${currentCatalogVersion}, actual=${raw.catalogVersion}`, { expected: currentCatalogVersion, actual: raw.catalogVersion });
        }
        const ruleSetId = Object.prototype.hasOwnProperty.call(raw, 'ruleSetId')
            ? raw.ruleSetId
            : (Object.prototype.hasOwnProperty.call(opts, 'ruleSetId') ? opts.ruleSetId : DEFAULT_RULE_SET_ID);
        const ruleSet = ensureRuleSet(ruleSetId);
        const countsByCardId = aggregateCardEntries(raw.cards);
        const cards = [];
        let totalCount = 0;
        countsByCardId.forEach((count, cardId) => {
            if (Number.isInteger(ruleSet.duplicateLimit) && count > ruleSet.duplicateLimit) {
                throw createStoryDeckError('CARD_DUPLICATE_LIMIT', `同一カードは ${ruleSet.duplicateLimit} 枚までです: ${cardId}`, { cardId, duplicateLimit: ruleSet.duplicateLimit, actual: count });
            }
            totalCount += count;
            cards.push({ cardId, count });
        });
        if (requireFullDeck) {
            if (totalCount !== ruleSet.deckSize) {
                throw createStoryDeckError('DECK_SIZE_INVALID', `story デッキは ${ruleSet.deckSize} 枚固定です`, {
                    expected: ruleSet.deckSize,
                    actual: totalCount
                });
            }
        }
        else if (totalCount > ruleSet.deckSize) {
            throw createStoryDeckError('DECK_SIZE_OVERFLOW', `story デッキは ${ruleSet.deckSize} 枚を超えられません`, {
                expectedMax: ruleSet.deckSize,
                actual: totalCount
            });
        }
        return {
            version: STORY_DECK_SPEC_VERSION,
            catalogVersion: currentCatalogVersion,
            ruleSetId: ruleSet.id,
            cards: sortDeckCards(cards)
        };
    }
    function safeNormalizeStoryDeckSpec(input, options) {
        try {
            return { ok: true, deckSpec: normalizeStoryDeckSpec(input, options), error: null };
        }
        catch (error) {
            return { ok: false, deckSpec: null, error: error };
        }
    }
    function createStoryDeckSpecFromCardIds(cardIds, options) {
        return normalizeStoryDeckSpec(Array.isArray(cardIds) ? cardIds : [], options);
    }
    function expandStoryDeckSpec(deckSpec) {
        const normalized = normalizeStoryDeckSpec(deckSpec);
        const cardIds = [];
        normalized.cards.forEach((entry) => {
            for (let index = 0; index < entry.count; index += 1) {
                cardIds.push(entry.cardId);
            }
        });
        return cardIds;
    }
    function summarizeStoryDeckSpec(deckSpec, options) {
        const normalized = normalizeStoryDeckSpec(deckSpec, Object.assign({}, options || {}, { requireFullDeck: false }));
        const ruleSet = ensureRuleSet(normalized.ruleSetId);
        const deckSize = normalized.cards.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
        return {
            version: normalized.version,
            catalogVersion: normalized.catalogVersion,
            ruleSetId: normalized.ruleSetId,
            deckSize,
            targetDeckSize: ruleSet.deckSize,
            distinctCount: normalized.cards.length,
            duplicateLimit: ruleSet.duplicateLimit
        };
    }
    return {
        STORY_DECK_SPEC_VERSION,
        RULE_SETS,
        DEFAULT_RULE_SET_ID,
        createStoryDeckError,
        getCatalogVersion,
        getEnabledCardDefs,
        getRuleSet,
        listRuleSets,
        normalizeStoryDeckSpec,
        safeNormalizeStoryDeckSpec,
        createStoryDeckSpecFromCardIds,
        expandStoryDeckSpec,
        summarizeStoryDeckSpec
    };
}));
//# sourceMappingURL=story-deck-spec.js.map