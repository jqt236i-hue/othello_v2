(function (root: any, factory) {
    if (root && root.SharedConstants) {
        root.DeckSpecHelpers = factory(root.SharedConstants, root.CardCatalog || null);
    } else if (typeof module !== 'undefined' && module.exports) {
        let cardCatalog = null;
        try {
            const path = require('path');
            cardCatalog = require(path.resolve(process.cwd(), 'cards', 'catalog.json'));
        } catch (e) { /* ignore */ }
        module.exports = factory(require('../shared-constants'), cardCatalog);
    } else {
        root.DeckSpecHelpers = factory(root.SharedConstants, root.CardCatalog || null);
    }
}(typeof self !== 'undefined' ? self : this as unknown as Record<string, unknown>, function (SharedConstants: unknown, CardCatalog: unknown) {
    'use strict';

    interface CardDef {
        id: string;
        enabled?: boolean;
        [key: string]: unknown;
    }

    interface DeckEntry {
        cardId: string;
        count: number;
    }

    interface DeckSpec {
        version: number;
        catalogVersion: number;
        cards: DeckEntry[];
    }

    interface NormalizeOptions {
        requireFullDeck?: boolean;
    }

    interface DeckSpecError extends Error {
        code: string;
        details?: unknown;
    }

    interface ShufflePrng {
        shuffle: (array: unknown[]) => unknown[];
    }

    const DECK_SPEC_VERSION = 1;
    const DEFAULT_DECK_SIZE = 30;
    const CUSTOM_DECK_SIZE = 30;
    const MAX_DUPLICATES_PER_CARD = 3;
    const SpecialCardRegistry = (function resolveSpecialCardRegistry() {
        if (typeof module !== 'undefined' && module.exports) {
            try {
                return require('./special-card-registry');
            } catch (e) { /* ignore */ }
        }
        if (typeof globalThis !== 'undefined' && (globalThis as Record<string, unknown>).SpecialCardRegistry) {
            return (globalThis as Record<string, unknown>).SpecialCardRegistry;
        }
        if (typeof self !== 'undefined' && (self as Record<string, unknown>).SpecialCardRegistry) {
            return (self as Record<string, unknown>).SpecialCardRegistry;
        }
        return null;
    }());
    const SPECIAL_FOUNDATION_CARD_IDS = Object.freeze(
        SpecialCardRegistry && typeof SpecialCardRegistry.getInviolableSpecialCardIds === 'function'
            ? SpecialCardRegistry.getInviolableSpecialCardIds()
            : [
                'theory_incarnation_01',
                'board_executor_01',
                'observer_will_01'
            ]
    );
    const SPECIAL_FOUNDATION_CARD_ID_SET: ReadonlySet<string> = new Set(SPECIAL_FOUNDATION_CARD_IDS);
    const CPU_LV6_WHITE_DECK_CODE = 'D1C1:chest_01.hard_01.swap_01.position_swap_01.perma_01.strong_wind_01.super_buoyancy_01.super_gravity_01.tempt_01.capture_01.regen_01.udr_01.breeding_01.seed_01.teleport_01.hyperactive_01.will_hunter_king_01.loss_will_01.observer_will_01.gold_stone.silver_stone.extend_life_01.guard_01.destroy_dragon_01.lightning_01.ultimate_hyperactive_01.board_expand_01.board_shrink_01.reinforcement_01.support_troops_01';
    const CPU_LV6_BOARD_EXECUTOR_WHITE_DECK_CODE = 'D1C1:sniper_01.ghost_01.afterimage_will_01.swap_01.strong_wind_01.super_buoyancy_01.super_gravity_01.super_attraction_01.trap_01.tempt_01.capture_01.regen_01.destroy_01.proliferation_01.teleport_01.hyperactive_01.will_hunter_king_01.loss_will_01.double_01.board_executor_01.condemn_01.execution_01.guard_01.destroy_dragon_01.lightning_01.udg_01.board_shrink_01.blockade_01.meteor_01.equality_will_01';
    const CPU_LV7_THEORY_INCARNATION_WHITE_DECK_CODE = 'D1C1:perma_01.trap_01.tempt_01.regen_01.udr_01.breeding_01.proliferation_01.hyperactive_01.extreme_hyperactive_01.escape_01.robot_vacuum_01.will_hunter_king_01.instant_hyperactive_01.heaven_01.theory_incarnation_01.gold_stone.rainbow_stone.silver_stone.crystal_stone*3.extend_life_01.extend_life_god_01.guard_01.guardian_god_01.destroy_dragon_01.lightning_01.meteor_god_01.udg_01.ultimate_hyperactive_01';

    function createDeckSpecError(code: string, message: string, details?: unknown): DeckSpecError {
        const error = new Error(String(message || code || 'DECK_SPEC_ERROR')) as DeckSpecError;
        error.code = String(code || 'DECK_SPEC_ERROR');
        if (typeof details !== 'undefined') {
            error.details = details;
        }
        return error;
    }

    function getRawCardDefs(): unknown[] {
        return Array.isArray(SharedConstants && (SharedConstants as { CARD_DEFS?: unknown[] }).CARD_DEFS)
            ? (SharedConstants as { CARD_DEFS: unknown[] }).CARD_DEFS
            : [];
    }

    function getCatalogVersion(): number {
        const explicit = Number(CardCatalog && (CardCatalog as { version?: unknown }).version);
        if (Number.isFinite(explicit) && explicit >= 1) {
            return Math.trunc(explicit);
        }
        return 1;
    }

    function buildCatalogCache() {
        const allDefs: CardDef[] = [];
        const enabledDefs: CardDef[] = [];
        const allById = new Map<string, CardDef>();
        const allByLowerId = new Map<string, CardDef>();
        const enabledById = new Map<string, CardDef>();
        const enabledByLowerId = new Map<string, CardDef>();

        getRawCardDefs().forEach((cardDef) => {
            const def = cardDef as CardDef;
            if (!def || !def.id) return;
            const cardId = String(def.id).trim();
            if (!cardId || allById.has(cardId)) return;

            const normalizedDef: CardDef = Object.assign({}, def, { id: cardId });
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

    function getEnabledCardDefs(): CardDef[] {
        return getCatalogCache().enabledDefs.slice();
    }

    function getEnabledCardDefMap(): Map<string, CardDef> {
        return new Map(getCatalogCache().enabledById);
    }

    function getEnabledCardIds(): string[] {
        return getEnabledCardDefs().map((cardDef) => cardDef.id);
    }

    function getEnabledCardCount(): number {
        return getEnabledCardIds().length;
    }

    function getStandardDeckCardIds(): string[] {
        return getEnabledCardIds();
    }

    function getStandardDeckSize(): number {
        return getStandardDeckCardIds().length;
    }

    function getDefaultDeckSize(): number {
        return DEFAULT_DECK_SIZE;
    }

    function isSpecialFoundationCardId(cardId: unknown): boolean {
        return SPECIAL_FOUNDATION_CARD_ID_SET.has(normalizeCardId(cardId));
    }

    function getSpecialFoundationCardIds(): string[] {
        return SPECIAL_FOUNDATION_CARD_IDS.slice();
    }

    function getMaxCopiesForCardId(cardId: unknown): number {
        return isSpecialFoundationCardId(cardId) ? 1 : MAX_DUPLICATES_PER_CARD;
    }

    function getCpuLv6WhiteDeckCode(): string {
        return CPU_LV6_WHITE_DECK_CODE;
    }

    function getCpuLv6BoardExecutorWhiteDeckCode(): string {
        return CPU_LV6_BOARD_EXECUTOR_WHITE_DECK_CODE;
    }

    function getCpuLv7TheoryIncarnationWhiteDeckCode(): string {
        return CPU_LV7_THEORY_INCARNATION_WHITE_DECK_CODE;
    }

    function getShuffleOnlyPrng(prng: unknown): ShufflePrng {
        if (prng && typeof (prng as ShufflePrng).shuffle === 'function') {
            return prng as ShufflePrng;
        }
        return {
            shuffle(array: unknown[]) {
                return array;
            }
        };
    }

    function sampleDefaultDeckCardIds(prng: unknown): string[] {
        const enabledCardIds = getEnabledCardIds();
        if (enabledCardIds.length < DEFAULT_DECK_SIZE) {
            throw createDeckSpecError(
                'DEFAULT_DECK_POOL_TOO_SMALL',
                `デフォルトデッキを作るには有効カードが ${DEFAULT_DECK_SIZE} 種以上必要です`,
                {
                    expectedMin: DEFAULT_DECK_SIZE,
                    actual: enabledCardIds.length
                }
            );
        }

        const shufflePrng = getShuffleOnlyPrng(prng);
        const enabledSpecialCardIds = enabledCardIds.filter(isSpecialFoundationCardId);
        if (enabledSpecialCardIds.length > 0) {
            const normalCardIds = enabledCardIds.filter((cardId) => !isSpecialFoundationCardId(cardId));
            const requiredNormalCount = DEFAULT_DECK_SIZE - 1;
            if (normalCardIds.length < requiredNormalCount) {
                throw createDeckSpecError(
                    'DEFAULT_DECK_NORMAL_POOL_TOO_SMALL',
                    `デフォルトデッキを作るには通常カードが ${requiredNormalCount} 種以上必要です`,
                    {
                        expectedMin: requiredNormalCount,
                        actual: normalCardIds.length
                    }
                );
            }

            const specialPool = enabledSpecialCardIds.slice();
            shufflePrng.shuffle(specialPool);
            const normalPool = normalCardIds.slice();
            shufflePrng.shuffle(normalPool);
            const sampled = [specialPool[0]].concat(normalPool.slice(0, requiredNormalCount));
            shufflePrng.shuffle(sampled);
            return sampled;
        }

        const sampled = enabledCardIds.slice();
        shufflePrng.shuffle(sampled);
        return sampled.slice(0, DEFAULT_DECK_SIZE);
    }

    function createDefaultDeckSpec(prng: unknown): DeckSpec {
        return normalizeDeckSpec(sampleDefaultDeckCardIds(prng));
    }

    function normalizeCardId(value: unknown): string {
        return String(value || '').trim();
    }

    function resolveCatalogCard(cardId: unknown): CardDef | null {
        const normalized = normalizeCardId(cardId);
        if (!normalized) return null;

        const cache = getCatalogCache();
        return cache.allById.get(normalized)
            || cache.allByLowerId.get(normalized.toLowerCase())
            || null;
    }

    function resolveEnabledCatalogCard(cardId: unknown): CardDef | null {
        const normalized = normalizeCardId(cardId);
        if (!normalized) return null;

        const cache = getCatalogCache();
        return cache.enabledById.get(normalized)
            || cache.enabledByLowerId.get(normalized.toLowerCase())
            || null;
    }

    function aggregateCardEntries(inputCards: unknown[]): Map<string, number> {
        const countsByCardId = new Map<string, number>();
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
                const obj = entry as Record<string, unknown>;
                rawCardId = String(obj.cardId || obj.id || '');
                count = Object.prototype.hasOwnProperty.call(obj, 'count') ? Number(obj.count) : 1;
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

    function sortDeckCards(cards: DeckEntry[]): DeckEntry[] {
        const orderMap = new Map<string, number>();
        getEnabledCardDefs().forEach((cardDef, index) => {
            orderMap.set(cardDef.id, index);
        });

        return cards.slice().sort((left, right) => {
            const leftOrder = orderMap.has(left.cardId) ? orderMap.get(left.cardId)! : Number.MAX_SAFE_INTEGER;
            const rightOrder = orderMap.has(right.cardId) ? orderMap.get(right.cardId)! : Number.MAX_SAFE_INTEGER;
            if (leftOrder !== rightOrder) return leftOrder - rightOrder;
            return String(left.cardId).localeCompare(String(right.cardId), 'en');
        });
    }

    function normalizeDeckSpec(input: unknown, options?: NormalizeOptions): DeckSpec {
        const opts = (options && typeof options === 'object') ? options : {};
        const requireFullDeck = opts.requireFullDeck !== false;
        const raw = (input && typeof input === 'object' && !Array.isArray(input))
            ? input as Record<string, unknown>
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

        const countsByCardId = aggregateCardEntries(raw.cards as unknown[]);
        const cards: DeckEntry[] = [];
        let totalCount = 0;

        countsByCardId.forEach((count, cardId) => {
            const maxCopies = getMaxCopiesForCardId(cardId);
            if (count > maxCopies) {
                throw createDeckSpecError('CARD_DUPLICATE_LIMIT', `同一カードは ${maxCopies} 枚までです: ${cardId}`);
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

    function safeNormalizeDeckSpec(input: unknown, options?: NormalizeOptions): { ok: boolean; deckSpec: DeckSpec | null; error: DeckSpecError | null } {
        try {
            return { ok: true, deckSpec: normalizeDeckSpec(input, options), error: null };
        } catch (error) {
            return { ok: false, deckSpec: null, error: error as DeckSpecError };
        }
    }

    function createDeckSpecFromCardIds(cardIds: unknown[], options?: NormalizeOptions): DeckSpec {
        return normalizeDeckSpec(Array.isArray(cardIds) ? cardIds : [], options);
    }

    function expandDeckSpec(deckSpec: unknown, options?: NormalizeOptions): string[] {
        const normalized = normalizeDeckSpec(deckSpec, options);
        const cardIds: string[] = [];
        normalized.cards.forEach((entry) => {
            for (let index = 0; index < entry.count; index += 1) {
                cardIds.push(entry.cardId);
            }
        });
        return cardIds;
    }

    function summarizeDeckSpec(deckSpec: unknown, options?: NormalizeOptions) {
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
        DEFAULT_DECK_SIZE,
        CUSTOM_DECK_SIZE,
        MAX_DUPLICATES_PER_CARD,
        SPECIAL_FOUNDATION_CARD_IDS,
        CPU_LV6_WHITE_DECK_CODE,
        CPU_LV6_BOARD_EXECUTOR_WHITE_DECK_CODE,
        CPU_LV7_THEORY_INCARNATION_WHITE_DECK_CODE,
        createDeckSpecError,
        getCatalogVersion,
        getEnabledCardDefs,
        getEnabledCardDefMap,
        getEnabledCardIds,
        getEnabledCardCount,
        getStandardDeckCardIds,
        getStandardDeckSize,
        getDefaultDeckSize,
        getSpecialFoundationCardIds,
        isSpecialFoundationCardId,
        getMaxCopiesForCardId,
        getCpuLv6WhiteDeckCode,
        getCpuLv6BoardExecutorWhiteDeckCode,
        getCpuLv7TheoryIncarnationWhiteDeckCode,
        sampleDefaultDeckCardIds,
        createDefaultDeckSpec,
        normalizeDeckSpec,
        safeNormalizeDeckSpec,
        createDeckSpecFromCardIds,
        expandDeckSpec,
        summarizeDeckSpec
    };
}));

export {};
