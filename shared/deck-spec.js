(function (root, factory) {
    if (typeof module !== 'undefined' && module.exports) {
        let cardCatalog = null;
        try {
            cardCatalog = require('../cards/catalog.json');
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../shared-constants'), cardCatalog);
    } else {
        root.DeckSpecHelpers = factory(root.SharedConstants, root.CardCatalog || null);
    }
}(typeof self !== 'undefined' ? self : this, function (SharedConstants, CardCatalog) {
    'use strict';

    const DECK_SPEC_VERSION = 1;
    const CUSTOM_DECK_SIZE = 30;
    const MAX_DUPLICATES_PER_CARD = 3;

    function createDeckSpecError(code, message, details) {
        const error = new Error(String(message || code || 'DECK_SPEC_ERROR'));
        error.code = String(code || 'DECK_SPEC_ERROR');
        if (typeof details !== 'undefined') {
            error.details = details;
        }
        return error;
    }

    function getRawCardDefs() {
        return Array.isArray(SharedConstants && SharedConstants.CARD_DEFS)
            ? SharedConstants.CARD_DEFS
            : [];
    }

    function getCatalogVersion() {
        const explicit = Number(CardCatalog && CardCatalog.version);
        if (Number.isFinite(explicit) && explicit >= 1) {
            return Math.trunc(explicit);
        }
        return 1;
    }

    function buildCatalogCache() {
        const allDefs = [];
        const enabledDefs = [];
        const allById = new Map();
        const allByLowerId = new Map();
        const enabledById = new Map();
        const enabledByLowerId = new Map();

        getRawCardDefs().forEach((cardDef) => {
            if (!cardDef || !cardDef.id) return;
            const cardId = String(cardDef.id).trim();
            if (!cardId || allById.has(cardId)) return;

            const normalizedDef = Object.assign({}, cardDef, { id: cardId });
            allDefs.push(normalizedDef);
            allById.set(cardId, normalizedDef);
            allByLowerId.set(cardId.toLowerCase(), normalizedDef);

            if (normalizedDef.enabled === false) return;
            enabledDefs.push(normalizedDef);
            enabledById.set(cardId, normalizedDef);
            enabledByLowerId.set(cardId.toLowerCase(), normalizedDef);
        });

        return {
            allDefs,
            enabledDefs,
            allById,
            allByLowerId,
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

    function getEnabledCardDefMap() {
        return new Map(getCatalogCache().enabledById);
    }

    function getStandardDeckCardIds() {
        return getEnabledCardDefs().map((cardDef) => cardDef.id);
    }

    function getStandardDeckSize() {
        return getStandardDeckCardIds().length;
    }

    function normalizeCardId(value) {
        return String(value || '').trim();
    }

    function resolveCatalogCard(cardId) {
        const normalized = normalizeCardId(cardId);
        if (!normalized) return null;

        const cache = getCatalogCache();
        return cache.allById.get(normalized)
            || cache.allByLowerId.get(normalized.toLowerCase())
            || null;
    }

    function resolveEnabledCatalogCard(cardId) {
        const normalized = normalizeCardId(cardId);
        if (!normalized) return null;

        const cache = getCatalogCache();
        return cache.enabledById.get(normalized)
            || cache.enabledByLowerId.get(normalized.toLowerCase())
            || null;
    }

    function aggregateCardEntries(inputCards) {
        const countsByCardId = new Map();
        const list = Array.isArray(inputCards) ? inputCards : null;

        if (!list) {
            throw createDeckSpecError('DECK_SPEC_INVALID', 'cards 配列が必要です');
        }

        list.forEach((entry, index) => {
            let rawCardId = '';
            let count = 1;

            if (typeof entry === 'string') {
                rawCardId = entry;
            } else if (entry && typeof entry === 'object') {
                rawCardId = entry.cardId || entry.id || '';
                count = Object.prototype.hasOwnProperty.call(entry, 'count') ? Number(entry.count) : 1;
            } else {
                throw createDeckSpecError('DECK_ENTRY_INVALID', `cards[${index}] の形式が不正です`);
            }

            const catalogCard = resolveCatalogCard(rawCardId);
            if (!catalogCard) {
                throw createDeckSpecError('CARD_UNKNOWN', `未登録カードです: ${normalizeCardId(rawCardId) || '(empty)'}`);
            }
            if (catalogCard.enabled === false) {
                throw createDeckSpecError('CARD_DISABLED', `無効カードは使えません: ${catalogCard.id}`);
            }
            if (!Number.isInteger(count) || count < 1) {
                throw createDeckSpecError('COUNT_INVALID', `カード枚数が不正です: ${catalogCard.id}`);
            }

            const nextCount = (countsByCardId.get(catalogCard.id) || 0) + count;
            countsByCardId.set(catalogCard.id, nextCount);
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
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return String(left.cardId).localeCompare(String(right.cardId), 'en');
        });
    }

    function normalizeDeckSpec(input, options) {
        const opts = (options && typeof options === 'object') ? options : {};
        const requireFullDeck = opts.requireFullDeck !== false;
        const raw = (input && typeof input === 'object' && !Array.isArray(input))
            ? input
            : { cards: Array.isArray(input) ? input : [] };

        const version = Object.prototype.hasOwnProperty.call(raw, 'version')
            ? Number(raw.version)
            : DECK_SPEC_VERSION;
        if (!Number.isInteger(version) || version !== DECK_SPEC_VERSION) {
            throw createDeckSpecError('DECK_VERSION_UNSUPPORTED', `未対応の deck spec version です: ${raw.version}`);
        }

        const requestedCatalogVersion = Object.prototype.hasOwnProperty.call(raw, 'catalogVersion')
            ? Number(raw.catalogVersion)
            : getCatalogVersion();
        const currentCatalogVersion = getCatalogVersion();
        if (!Number.isInteger(requestedCatalogVersion) || requestedCatalogVersion !== currentCatalogVersion) {
            throw createDeckSpecError(
                'CATALOG_VERSION_MISMATCH',
                `catalogVersion が一致しません: expected=${currentCatalogVersion}, actual=${raw.catalogVersion}`,
                { expected: currentCatalogVersion, actual: raw.catalogVersion }
            );
        }

        const countsByCardId = aggregateCardEntries(raw.cards);
        const cards = [];
        let totalCount = 0;

        countsByCardId.forEach((count, cardId) => {
            if (count > MAX_DUPLICATES_PER_CARD) {
                throw createDeckSpecError('CARD_DUPLICATE_LIMIT', `同一カードは ${MAX_DUPLICATES_PER_CARD} 枚までです: ${cardId}`);
            }
            totalCount += count;
            cards.push({ cardId, count });
        });

        if (requireFullDeck) {
            if (totalCount !== CUSTOM_DECK_SIZE) {
                throw createDeckSpecError('DECK_SIZE_INVALID', `カスタムデッキは ${CUSTOM_DECK_SIZE} 枚固定です`, {
                    expected: CUSTOM_DECK_SIZE,
                    actual: totalCount
                });
            }
        } else if (totalCount > CUSTOM_DECK_SIZE) {
            throw createDeckSpecError('DECK_SIZE_OVERFLOW', `カスタムデッキは ${CUSTOM_DECK_SIZE} 枚を超えられません`, {
                expectedMax: CUSTOM_DECK_SIZE,
                actual: totalCount
            });
        }

        return {
            version: DECK_SPEC_VERSION,
            catalogVersion: currentCatalogVersion,
            cards: sortDeckCards(cards)
        };
    }

    function safeNormalizeDeckSpec(input, options) {
        try {
            return { ok: true, deckSpec: normalizeDeckSpec(input, options), error: null };
        } catch (error) {
            return { ok: false, deckSpec: null, error };
        }
    }

    function createDeckSpecFromCardIds(cardIds, options) {
        return normalizeDeckSpec(Array.isArray(cardIds) ? cardIds : [], options);
    }

    function expandDeckSpec(deckSpec) {
        const normalized = normalizeDeckSpec(deckSpec);
        const cardIds = [];
        normalized.cards.forEach((entry) => {
            for (let index = 0; index < entry.count; index += 1) {
                cardIds.push(entry.cardId);
            }
        });
        return cardIds;
    }

    function summarizeDeckSpec(deckSpec, options) {
        const normalized = normalizeDeckSpec(deckSpec, Object.assign({}, options || {}, { requireFullDeck: false }));
        const deckSize = normalized.cards.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
        return {
            version: normalized.version,
            catalogVersion: normalized.catalogVersion,
            deckSize,
            distinctCount: normalized.cards.length
        };
    }

    return {
        DECK_SPEC_VERSION,
        CUSTOM_DECK_SIZE,
        MAX_DUPLICATES_PER_CARD,
        createDeckSpecError,
        getCatalogVersion,
        getEnabledCardDefs,
        getEnabledCardDefMap,
        getStandardDeckCardIds,
        getStandardDeckSize,
        normalizeDeckSpec,
        safeNormalizeDeckSpec,
        createDeckSpecFromCardIds,
        expandDeckSpec,
        summarizeDeckSpec
    };
}));